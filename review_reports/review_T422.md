# Review T420–T423 — Subagent Short Names (`@lite` + `@teamwork`)

## Round 1 — APPROVED — by code-reviewer

## Summary

- `templates/claude-code-agents/coordinator-lite.md` → `lite.md` via `git mv` (rename detected at 95 % similarity); frontmatter `name:` field updated from `coordinator-lite` to `lite`. Model (`haiku`), description, and body unchanged.
- New `templates/claude-code-agents/teamwork.md` carries `name: teamwork`, `model: sonnet`, description S04 verbatim, body S05 verbatim — delegates by file path to `content/skill-coordinator.md` instead of `tw_switch_role` (correctly avoids the missing-enum-entry pitfall).
- README `### Claude Code subagent install (auto model-routing)` sub-section rewritten to surface `@teamwork` + `@lite` as primary entry points alongside per-role subagents; migration note S06 included.
- Version bumped 3.19.1-skipping-3.20.0 → 3.21.0 across `package.json`, `index.ts` Server literal, `package-lock.json`. CHANGELOG `[3.21.0]` entry documents AC1–AC6 plus the v3.20.0 AC2 reversal citing Dynamic Workflows.

## Correctness

- `templates/claude-code-agents/lite.md:2` — only the `name:` field changed (`coordinator-lite` → `lite`); model/description/body verified byte-for-byte preserved per the git rename + 1-line diff. AC1 satisfied.
- `templates/claude-code-agents/teamwork.md:1-7` — file structure correct:
  - L2: `name: teamwork` ✓
  - L3: `model: sonnet` ✓ — matches `content/skill-coordinator.md` frontmatter `recommended_model: sonnet` (v3.19.0 regression-guard contract); programmatic verification deferred to qa (T424 will update the test's `ROLE_TO_SKILL` map).
  - L4: description = S04 verbatim ✓
  - L7: body = S05 verbatim; explicitly says "load it via the Read tool, NOT via tw_switch_role — coordinator is not in the RoleName enum" — closes the only correctness pitfall the PM spec flagged (Out of Scope §3).
- `README.md:117-138` — install snippet updated to "12 templates" (was 11); primary-entry-points block lists `@teamwork` / `@lite` / per-role; migration note S06 verbatim. AC4 satisfied.
- `CHANGELOG.md [3.21.0]` — Added / Changed / Reversed / Notes sections present; AC3 reversal explicit with citation to `research/multi-agent-auto-model-routing-directions.md` §E1 and `specs/subagent-short-names.md` §AC3.
- `package.json:3` and `index.ts:200` both at `3.21.0`; `package-lock.json` refreshed by prebuild `check:version` hook. AC7 satisfied.
- **Test failures expected**, NOT a regression: `test/subagent-templates.test.mjs` was written against the v3.20.0 shape (11 templates, includes `coordinator-lite`, forbids `coordinator`). PM spec AC5 + T424 explicitly allocate the test update to qa-engineer per Constitution §2 (sr-engineer cannot touch tests). Verified by re-reading PM spec lines 84-99: AC5 enumerates the exact `EXPECTED_ROLES` / `LITE_EXEMPT` / `ROLE_TO_SKILL` updates and the FORBIDDEN_ROLES test removal. **Not a CHANGES_REQUESTED finding** — this is by-design scope splitting between sr-engineer (implementation) and qa-engineer (regression-guard refresh).

No off-by-one, race condition, or missed edge case in the implementation.

## Quality

- Naming clean: `lite.md` / `teamwork.md` filenames match their `name:` frontmatter values (Claude Code convention).
- No SOP duplication: both templates delegate (lite by file path, teamwork by file path) — single source of truth stays in `content/skill-*.md`.
- README list-item style consistent with existing `## Per-Role Model Routing` section (bold name, em-dash separator, sentence-case description).
- CHANGELOG `[3.21.0]` follows the Added / Changed / Notes structure of `[3.20.0]` / `[3.19.0]`; the new `### Reversed (from v3.20.0)` sub-heading is a deliberate format extension to surface the AC2 reversal — acceptable; matches Keep-a-Changelog spirit.

## Architecture

- Implementation follows `specs/subagent-short-names.md` exactly:
  - AC1: rename ✓
  - AC2: teamwork.md created ✓
  - AC3: AC2 reversal in CHANGELOG with Dynamic Workflows citation ✓
  - AC4: README + migration note ✓
  - AC5: test update DEFERRED to qa (correct per Constitution §2)
  - AC6: server-side identifiers verified unchanged via diff (no entries in `content/`, `prompts/`, `tools/transitions.ts`, MCP prompt names beyond the `dist/index.js` version-literal byte change)
  - AC7: version + CHANGELOG ✓
- Decision Records honored:
  - `model: sonnet` for teamwork matches v3.19.0 tier table for coordinator ✓
  - `teamwork.md` body delegates by file path (matches lite pattern; correctly avoids the not-in-RoleName-enum pitfall per spec Out of Scope §3) ✓
  - `lite.md` rename preserves model/description/body — minimal surgical change per Constitution §1 ✓

## Security

- Templates are static markdown — no execution surface, no user input, no secrets / API keys / credentials.
- `teamwork.md` body instructs subagent to read `content/skill-coordinator.md` via the Read tool; that file is under workspace control, already part of the trusted prompt-building surface (`prompts/build.ts:246`).
- No new attack surface introduced.

## Performance

- Pure file-system rename (`git mv`) + one new ~250-byte template + README/CHANGELOG additions + version literal change.
- `dist/index.js` rebuild is a 2-byte version-string change.
- No algorithmic surface introduced; no O(n²), no unbatched I/O, no leak.
- Coordinator-skill load path (`prompts/build.ts buildPromptForRole` → `parseSkillFile` → text concat) is unchanged.

No regression vs base.

## Verdict

`APPROVED` — implementation matches PRD AC1–AC4, AC6, AC7 in full; AC5 (test update) deferred to qa-engineer per Constitution §2 and PM spec design; build green; audit clean; server-side wire contract verified unchanged. Test-suite refresh (AC5) and AC8 final-run verification remain for qa-engineer per T424.
