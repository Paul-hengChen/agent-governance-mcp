# Review — T-E75-01

Feature: `e75-rationale-fence-relocation` (backlog E75, docs/backlog.md:198, order row 8i)
Round 1 — by code-reviewer (opus). sr-engineer ran pinned to `fable` (`dispatch_pins`), so this review is cross-model; no same-model blind-spot risk flagged.

## Summary
- Four asymmetric `<!-- rationale:start -->` fences relocated onto their own lines across three role SOPs — `content/skill-pm.md` (2), `content/skill-architect.md` (1), `content/skill-qa-engineer.md` (1) — matching the E69 precedent (`bd5f3b7`) byte-for-byte in shape.
- Prose invariance verified independently and stronger than a word-diff: non-whitespace character sequence is byte-identical to HEAD in all three files, and whitespace was **only added, never removed** (4 insertions total, one per site, each immediately after a `-->`), so no word-merge could hide in the "whitespace-only" claim.
- Fix verified effective through **both** render paths (`switchRole` and `buildPromptForRole`) for all 9 roles: 0 glue findings, down from pm 2 / architect 1 / qa-engineer 1.
- No stripping regression: the post-`applyTextTransforms({fullDetail:false})` render is character-identical to HEAD's modulo whitespace (identical length), so no rule text entered or left a rationale span.
- Class is complete: 0 asymmetric spans remain across all 35 `content/*.md`. Scope is clean; expected-red manifest is exact. Verdict: **APPROVED**.

## Correctness

**No findings.**

*1 — Prose invariance (the ticket's hard constraint).* Two independent checks, both run by me:
- `tr -d '[:space:]' | shasum -a 256` against `git show HEAD:<file>` — identical digests for all three files (pm `49bea7c9…`, architect `e0999977…`, qa `5f8b0628…`).
- A stronger positional check (python, `scratchpad/`): built a per-character "is a whitespace run present after this non-whitespace char" signature for HEAD and the working tree and diffed them. Result per file: non-whitespace sequence identical, **whitespace REMOVED at 0 positions** (this is the check a bare `tr -d`/digest comparison cannot make — a deleted space merging two words would pass the digest test and fail here), whitespace ADDED at exactly 2 / 1 / 1 positions, each one immediately after the `-->` of a `rationale:start` marker. That is exactly the four sites the row enumerates and nothing else. The `git diff --word-diff` token splits sr-engineer flagged are accounted for by these four insertions.
- No trailing whitespace introduced (`grep -nE '[ \t]+$'` clean on all three files).

*2 — The fix works, both render paths.* Rebuilt `dist/` (`npm run build`: tsc + check:version 3.102.3 + check:transitions-sync 21 keys, all OK), then ran my own re-implementation of both detectors (written from the root-cause definition, not copied from the ratchet) over `dist/tools/role.js` `switchRole` and `dist/prompts/build.js` `buildPromptForRole` for all 9 roles. Result: **0 glue findings for every role through both paths**. My symptom detector additionally flagged `skill-pm.md`'s `` `- [ ] T-BUG-01 …` `` line — that is the documented backtick-code-span false positive (`test/render-structure.test.mjs:120-131`), it is a quoted illustration nowhere near a rationale fence, it is present at HEAD unchanged, and the source-level detector does not flag it. With the exclusion applied, pm is 0 too — corroborated by the suite's own failure output, `switchRole("pm") … (found: [])`, `expected: 2, actual: 0`.

*3 — No regression at the other end of the span (highest-value check).* Applied `applyTextTransforms(text, {fullDetail:false})` to HEAD's bytes and to the working tree's bytes for each of the three files and diffed the outputs. The stripped renders are **identical in non-whitespace content and identical in total length** (pm 16532/16532, architect 8919/8919, qa 14809/14809). Nothing was newly swallowed and nothing newly surfaced — a rule that had moved inside the span would have shortened the stripped output. What the diff shows is purely the intended structural repair:
- `skill-pm.md`: three top-level spec-section bullets — **Copy / Strings**, **Visual Tokens**, **Visual Widgets** — previously rendered fused into a single line; each now begins its own line. (Two fences, three bullets, because the fused run chained.)
- `skill-architect.md`: `- **Columns (required, exactly):**` is restored as an indented list item under the Baseline Reachability Matrix, at the same 4-space indent as its sibling rows, instead of trailing mid-line off the preceding sentence.
- `skill-qa-engineer.md`: `- **An actual red NOT on the manifest …**` is restored as its own Phase-0.5 disposition bullet.
These are exactly the "table/column definitions and disposition rules" the backlog row names as the consequence.

*4 — Completeness of the class.* Swept all 35 `content/*.md` (not just the `skill-`/`const-`/`coord-` prefixes the ratchet globs) with the source-level detector: **0 asymmetric spans, 0 introduced**. Repo-wide grep for `rationale:start` outside `content/` finds only specs, tests, fixtures, reports, backlog and `text-transforms.ts` prose — no second copy of these SOP bodies in `templates/` or elsewhere that would need a parallel edit.

*5 — Expected-red manifest.* `qa_reports/expected-red_e75-rationale-fence-relocation.txt` exists and is well-formed (`<path> | <exact test name>`). SOP 4a sampling, all 3 entries (fewer than 3 would be all; here it is all anyway): each named test string is present verbatim in `test/render-structure.test.mjs` — 3/3 locatable, 0 misses. `npm test`: **1742 tests, 1739 pass, 3 fail**, and the three failures are precisely the three manifest entries, with no fourth red anywhere in the suite. Failure directions are the ratchet-decrement-owed direction and nothing else: structural sweep `actual: {}` vs the pinned 2/1/1 map; both render sweeps `actual: 0, expected: 2` at pm. Note for qa (not a defect): the two render-sweep tests fail-fast on the first role, so their output does not itself exercise architect/qa-engineer — my all-role sweep above covers that gap.

## Quality

**No findings.** The relocation reproduces E69's shipped pattern exactly: marker alone on its own line at column 0, rationale body starting the following line, `<!-- rationale:end -->` still terminating that line. I diffed `bd5f3b7`'s `content/skill-release-engineer.md` hunks to confirm the precedent placed the marker at column 0 too, including inside indented list contexts — so this cut is consistent with the shipped convention rather than inventing a second one.

Observation, non-blocking: the relocated marker and rationale body sit at column 0 even where the surrounding prose is an indented list item (architect, qa-engineer). This is invisible in every production render, because both role-SOP paths pass `fullDetail: false` unconditionally (`tools/role.ts:105`; `index.ts:162-168` passes `false`; the `prompts/<role>.ts` wrappers take the `fullDetail = false` default at `prompts/build.ts:285`) — the block is always stripped. In a raw markdown view the column-0 body is a lazy continuation of the preceding list item, so it still renders inside the item. No action needed; recorded so a future reader does not re-litigate it.

## Architecture

**No findings.** No architecture spec exists for this mini-chain — the backlog row is the spec, per the E69/E71/E76/E78 precedent recorded in `scope_decision_why`. The change respects the layering the defect lives in: the contract that a rationale fence is symmetric is enforced in `content/`, not by loosening the transform, which is the decision E69 already made and this cut inherits rather than reopens.

Scope discipline holds. `git diff --stat` is empty for both `prompts/text-transforms.ts` and `test/render-structure.test.mjs` — the ratchet decrement is correctly left to qa as T-E75-02 (§2 test ownership). `dist/` is unmodified after a full rebuild, confirming `content/*.md` is read from the workspace root at runtime and not compiled in. The working tree's other changes (`docs/backlog.md`, `.current/*`, `tasks.md`) are out of this cut and were not reviewed beyond confirming `docs/backlog.md` is a 2-line status-cell edit.

## Security

**No findings.** Whitespace-only edits to governance prose. No secrets, no input crossing a trust boundary, no new parsing surface, no executable path touched. `npm audit --audit-level=high`: 5 vulnerabilities, **2 low + 3 moderate, zero high/critical** (esbuild, hono, protobufjs, all transitive) — no `docs/dependency-advisories.md` entry owed per Constitution §6.

## Performance

**No findings.** No hot path, no algorithmic change. The rendered SOP payload is unchanged in length after stripping (identical byte counts before and after, per Correctness item 3), so per-dispatch context budget is unaffected.

## Verdict

**APPROVED** — the newline-only constraint is proven with a check that would catch a lost space, the glue is gone through both render paths for all four sites, the stripped render is provably byte-equivalent so nothing was newly hidden or exposed, the class is empty across all of `content/`, and the expected-red manifest names exactly the three assertions that fail and no others.
