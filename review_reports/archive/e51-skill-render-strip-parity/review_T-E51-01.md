# Review — T-E51-01

covers: T-E51-01, T-E51-02

## Round 1 — APPROVED — by code-reviewer

## Summary

- E51 closes the skill-render strip-parity gap: `stripOriginTags` / `stripRationale` ran on `prompts/build.ts`'s path only, so every role SOP delivered through `tw_switch_role` (the dominant subagent-dispatch path in this repo) leaked raw `<!-- origin:… -->` / `<!-- rationale:… -->` markers to the acting agent.
- 3 source files: `prompts/text-transforms.ts` (new, 2 functions relocated + `applyTextTransforms`), `prompts/build.ts` (import + value re-export, both call sites routed through the shared pass), `tools/role.ts` (pass applied to the parsed body, `fullDetail: false`).
- Both relocated function bodies verified **byte-identical to `HEAD:prompts/build.ts`** by extraction-and-compare, not by eyeballing the diff.
- Scope discipline held: `bin/agent-governance-context.mjs` untouched per the cut's decision 4; zero files under `test/` touched (§2 respected).
- Verdict: **APPROVED**. Two Architecture notes and one count correction for qa, none blocking.

**Reviewer independence disclosure (Hard rules, same-model/same-context bias):** this round ran in the SAME context and model as the sr-engineer that wrote the diff — the `tw_switch_role` in-context fallback is this session's dispatch mode, so the clean-context guarantee this role exists to provide is **weakened by construction**. Mitigation applied: every claim below is re-derived from the tree (`git show HEAD:…`, `git status`, direct `dist/` execution), not from the sr-engineer's `pending_notes`. Treat the independence of this verdict as reduced accordingly.

## Correctness

No blocking findings.

- **Order equivalence (the load-bearing question).** Old constitution site: `originClean = stripOriginTags(assembled)` then `fullDetail ? originClean : stripRationale(originClean)`. Old skill-body site: `rawBody = stripOriginTags(taggedBody)` then `fullDetail ? rawBody : stripRationale(rawBody)`. `applyTextTransforms` (`prompts/text-transforms.ts:65-72`) is exactly `stripOriginTags` → `fullDetail ? clean : stripRationale(clean)`. Both substitutions are behaviour-preserving; `fullDetail` gating survives on both.
- **Relocation fidelity.** Extracted `stripRationale` and `stripOriginTags` from `git show HEAD:prompts/build.ts` and from `prompts/text-transforms.ts` and compared: **BYTE-IDENTICAL** both. Both regexes, both `[ \t]+\n` collapses, both `\n{3,}` collapses, and the deliberate no-trailing-newline asymmetry in the origin regex (governance-text-load-architecture DR-7) are intact.
- **`tools/role.ts` strips the body only** (`tools/role.ts:97-105`). `parseSkillFile` splits frontmatter off first, and `frontmatter.recommended_model` is read after (`:111-124`) from the untouched frontmatter object — so the `recommended_model` hint and the `instruction` string cannot be corrupted by a fence in body prose. `body` feeds `response.sop` and nothing else.
- **`fullDetail: false` is the right constant for `switchRole`.** No full-detail/authoring mode exists on that path, and the acting agent is precisely the reader the fences exist to hide provenance from. A future full-detail reader would add a parameter, not change this default.
- **Whole-file `.current/` override is now stripped too on the `switchRole` path.** Behaviour change, and the correct one: `buildPromptForRole` already strips overrides, so this removes an asymmetry rather than creating one. No finding.
- AC1 re-verified independently against the rebuilt `dist/`: `switchRole()` output for every role in `ROLE_SKILL_MAP` contains zero `<!-- origin:` and zero `<!-- rationale:` occurrences. AC3 re-verified: both names still import as functions from `dist/prompts/build.js`, and `dist/prompts/build.d.ts:6` carries the re-export so the **type** surface is preserved, not just the runtime one.

## Quality

No findings.

- Comment hygiene is the part most likely to have been skipped and was not: all three now-false claims were corrected — the two `build.ts` "only buildPromptForRole calls it" statements and the `tools/role.ts:89-92` "does NOT flow through buildPromptForRole" comment, which now explains the strip parity as well as the partial expansion.
- Naming matches the module's neighbours (`partials-manifest`, `skill-manifest`, `constitution-manifest` → `text-transforms`). No dead code; the old definitions are gone rather than left shadowed.

## Architecture

Two notes, neither blocking.

1. **`governance-text-load-architecture.md` DR-2 is now stale prose (recommend a follow-up row, not an in-cut fix).** DR-2 reads: *"Keep exactly ONE load-bearing copy of `stripRationale` (in `prompts/build.ts`)"*, justified by *"Rationale-stripping is only needed at one production call-site (`buildPromptForRole`)"*. E51 satisfies DR-2's **decision** (there is still exactly one implementation — relocated and shared, never duplicated, and `prompts/text-transforms.ts` imports nothing) but falsifies its **premise**: there are demonstrably two production call-sites, and the second one is the busier of the two. Not treated as a contradiction warranting `CHANGES_REQUESTED`, because these `specs/*-architecture.md` files are dated point-in-time design records (this one carries its own "Round-2 Amendment (2026-06-10)" section), not live mirrors with a header sync rule like `tools/transitions.ts:3`. Amending a historical record in a cut scoped to 3 files would be the scope creep the cut explicitly bounded. **This is the same "spec claims something the source no longer does" class as E39/E48** — recommend it be folded into that cluster or filed alongside it.
2. **DR-4 verified honored, not assumed.** DR-4 / DR-11 pin the hook as a deliberate non-caller. `bin/agent-governance-context.mjs` is absent from `git status`, and the new module's header records the omission as a standing decision rather than an oversight — so a future maintainer reading `text-transforms.ts` cannot mistake the hook's absence for a bug to "fix".
3. **Layering is fine.** `tools/role.ts` importing from `prompts/` is pre-existing (`partials-manifest`, `skill-manifest`). Choosing a new leaf module over importing `build.ts` avoided a real hazard: `build.ts` pulls in storage, RAG, and gates, and `tools/role.ts` → `prompts/build.ts` would have created a heavy and cycle-prone edge. Zero-import leaf confirmed.

## Security

No findings.

- No new input crosses a trust boundary; both regexes operate on repo-local governance content, unchanged from `HEAD`.
- No secrets, no injection surface, no ReDoS regression (the lazy `[\s\S]*?` spans and their literal terminators are byte-identical to the pre-change versions).
- **§6 dependency audit — waiver endorsed, but this is a waiver and not a pass.** `npm audit --audit-level=high` exits 1 with 5 HIGH / 0 CRITICAL (`sharp` ← libvips CVE-2026-33327/33328/35590, `@xenova/transformers` ← `sharp`, `fast-uri`, `ip-address`, `js-yaml`). The sr-engineer's causation claim was independently checked, not accepted: `git status -- package.json package-lock.json` returns 0 changed files, so E51 added no dependency and cannot have introduced any of the five. Waiver granted on that basis per §6's "unless waived with rationale". Recommend a standalone backlog row — `js-yaml` is load-bearing for `tools/handoff.ts` and `sharp` for the RAG/visual path, so neither is inertly dev-only.

## Performance

No findings.

- `switchRole` gains two linear regex passes over one skill body, once per dispatch. Not a hot path.
- `buildPromptForRole` is unchanged in complexity — same two passes, same order, now behind one call.
- No fixture drift, which is itself the evidence: `git status --short test/` returns 0 files, so all 8 `test/fixtures/compose-golden/*` are byte-identical on disk and the build path is a genuine no-op refactor. Full suite 1669/1669, 0 fail.

## Notes for qa-engineer (T-E51-03)

- **Count correction — `ROLE_SKILL_MAP` has 9 entries, not 10.** The cut's AC1 text says "all 10"; `tools/role.ts:27-42` declares 9 (`pm`, `researcher`, `design-auditor`, `sr-engineer`, `code-reviewer`, `qa-engineer`, `architect`, `doc-writer`, `release-engineer`), matching the 9-value enum on the `tw_switch_role` tool. `teamwork` / `teamwork-lite` are prompt ids, not `switchRole` roles. Assert 9 and do not hunt for a 10th.
- **AC2 must be assert-not-rebaseline.** If any `compose-golden` fixture differs, that is a FAIL of the "pure refactor" claim — regenerating it would erase the only evidence that the `buildPromptForRole` path is unchanged.
- **Operational, worth one assertion or at least a note: the running MCP server serves a stale `dist/`.** The `tw_switch_role` response received in this session still contained raw origin markers *after* the rebuild, because the server process loaded `dist/tools/role.js` at startup. Verification must target the rebuilt `dist/` directly (as done here); the live fix needs a server restart. Not a defect — but it is exactly the trap that would make a manual "is it fixed?" spot-check report a false negative.
