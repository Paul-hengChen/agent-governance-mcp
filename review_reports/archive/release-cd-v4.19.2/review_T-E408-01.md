# Review — T-E408-01 (batched round)

covers: T-E408-01, T-E408-02, T-E408-03

Base: cut commit `114f71c` (lane base `c337d5b` for the AC3/AC4/AC6/AC7 review-time checks).
Range reviewed: `114f71c..HEAD` (ce172a6, 02c6d05, 52a3e7a, c090555 state). Spec:
`specs/e408-core-task-alias-tail.md`. No architecture spec (mini-chain, no architect).
Reviewer model: opus; sr-engineer was also opus (same-model bias possible: the checks below are
byte-level and scripted, which reduces it).

## Summary
- T-E408-01: six `Task` spans in the core coordinator fragments (coord-03:31/77/88/95, coord-05:5,
  coord-07:14) replaced with Copy / Strings `c03.31`..`c07.14`.
- T-E408-02: `templates/claude-code-agents/lite.md` line 9 tail replaced with `lite.forbid` +
  `lite.tier`.
- T-E408-03: `tools/role.ts` lines 36-40 comment rewritten to `role.comment`; `dist/tools/role.js`
  and `.js.map` rebuilt.
- Every edit matches the spec's strings byte-for-byte, the rest of each line and file is unchanged,
  and no file outside the lane-owned set changes. Verdict: APPROVED.

## AC Completeness
Scope is T-E408-01..03. AC1, AC2, AC5 and AC6 are partly qa-test-backed (T-E408-04); the lines
below are the review-time evidence.
AC1 — implemented — scripted scan: coord-01/03/05/07 at HEAD have 0 lines containing `Task` once `tasks.md` / `_task` / `completed_tasks` are removed.
AC2 — implemented — scripted check per site: base line `.count(old)==1` and `base.replace(old, new) == HEAD line`. OK for content/coord-03-core-fallback.md:31, :77, :88, :95, content/coord-05-core-visual-drift.md:5, content/coord-07-core-sop.md:14; line counts unchanged (103/23/17); every other line byte-identical.
AC3 — implemented (review-time half) — coord-01/02/04/06 are not in `git diff --name-only c337d5b HEAD`; coord-02 line 1 still holds the only alias definition ("`Task(...)` throughout this SOP is shorthand for Claude Code's subagent-dispatch tool, named `Agent`"), and the new noun "subagent-dispatch tool" is that sentence's own noun, so on the Claude Code path the six sentences resolve to the same tool. The composed-bundle assertion is qa's (T-E408-04).
AC4 — implemented — `git diff --numstat c337d5b HEAD -- content/` prints exactly `4 4 coord-03`, `1 1 coord-05`, `1 1 coord-07`.
AC5 — implemented — templates/claude-code-agents/lite.md:9: `base.replace("(server rejects lite-mode writes).", lite.forbid + " " + lite.tier) == HEAD` (OK); 11 lines; lines 1-8, 10, 11 byte-identical; `model: haiku` present; `content/skill-coordinator-lite.md` still on line 9; no `server rejects`, no `Task`; content/skill-coordinator-lite.md not in the diff.
AC6 — implemented — tools/role.ts:36-40 equal the five `role.comment` lines exactly; `git diff -U0 c337d5b HEAD -- tools/role.ts` is one hunk `@@ -36,5 +36,5 @@`, all lines `//`; no `integrator` in the file; `"doc-writer"` / `"release-engineer"` map entries untouched.
AC7 — implemented — fresh `npm run build` at HEAD, then `git status --porcelain` shows no dist/ entry; `git diff --stat c337d5b HEAD -- dist/` lists only dist/tools/role.js (comment hunk `@@ -27,5 +27,5 @@` only) and dist/tools/role.js.map; role.d.ts / role.d.ts.map unchanged.
AC8 — not in scope (T-E408-04, qa).
AC9 — not in scope (T-E408-04, qa); test/context-budget.test.mjs was run and is green.
AC10 — not in scope (T-E408-04, qa).

## Correctness
No required findings.
- Fact check for `role.comment`: tools/transitions.ts:8-16 `AgentName` includes `"release-engineer"` and no `doc-writer`; tools/transitions.ts:265-270 key `qa-engineer:PASS` lists `{ agent: "release-engineer", status: "In_Progress" }` under the `v3.49.0 (C13)` note; `doc-writer` appears nowhere in tools/transitions.ts; content/skill-doc-writer.md:15 is the only "Side-channel constraint" clause in `content/skill-*.md`. All claims in the comment are true.
- Fact check for `lite.forbid`: content/skill-coordinator-lite.md:15-16, under `## Hard rules`, ends "Do NOT call them" for the four write tools, so "that SOP's Hard rules forbid them" is true.
- Fact check for `lite.tier`: specs/d8-lite-recommended-model.md:36-40 (no corrective layer on the direct surface vs coordinator `validateWatermark` on Task dispatch), Amendment (line 77) and AC8 (line 191) back the stated rationale; the current location of that validation step is content/coord-04-host-watermark.md:5, which still names `@lite`.
- Grammar check of the six sentences at HEAD: all read correctly ("If you saw the dispatched subagent call fail this session"; "(via the subagent-dispatch tool or the `tw_switch_role` fallback)"; "on the resume call to the subagent-dispatch tool —"; "(subagent-dispatch tool or `tw_switch_role`)"; "(subagent-dispatch tool if available, else `tw_switch_role(<role>)`)").
- Step 4a (expected red): the targeted run (16 test files from the spec's pin-audit table, 246 tests) has exactly one red, test/skill-manifest.test.mjs `t-golden-byte-identity`, which I confirmed is a real, locatable test. The spec's pin-audit table predicts it and assigns the golden re-capture to qa (T-E408-04); sr-engineer may not edit test fixtures (§2). No `qa_reports/expected-red_e408-core-task-alias-tail.txt` exists. This is feature mode (`dispatch_mode` absent), so qa's Phase 0.5 check is advisory and the red is fully explained by the diff and the spec. Recorded as recommended, not required (see Quality R1).

## Quality
- R1 (recommended): no expected-red manifest for the predicted golden red. A one-line `qa_reports/expected-red_e408-core-task-alias-tail.txt` (`test/skill-manifest.test.mjs | t-golden-byte-identity (AC1/AC5): ...`) would let qa's Phase 0.5 handle it mechanically instead of relying on the spec table. Does not block approval: the red is predicted in the human-approved spec and is in qa's task.
- O1 (optional, spec text, not an sr defect): in `lite.tier`, "when a coordinator dispatches this subagent it validates the reply watermark", the word "it" could be read as the subagent. Context makes the coordinator reading the natural one. The text matches the approved Copy / Strings exactly, so a fix would need a spec amendment; noting it only.
- Comment check (step 4b): `agc check` gives one comments warning that touches the diff, `tools/role.ts high-ratio 32% of 125 non-blank lines`. Kept: the five-line comment replaces five comment lines, so the ratio is the same as at base. AC7 fixes the five-line height (to keep role.d.ts / .d.ts.map unchanged), so it cannot be shortened.

## Architecture
No architecture spec (mini-chain). File boundary: `git diff --name-only c337d5b HEAD` is `.current/e408/**`, the three coord fragments, dist/tools/role.js(.map), specs/e408-core-task-alias-tail.md, templates/claude-code-agents/lite.md and tools/role.ts. All are inside the e408 row of the plan's Lanes table (coord lines limited to the named sites, role.ts limited to lines 36-40, which AC2/AC6 checks confirm). No `const-*`, no other `skill-*`, no other template, no other `tools/**` / `dist/**` file. Ruling 2 (a) is respected: coord-02/04/06 are untouched and no alias definition moved into the core fragments.

## Security
No findings. Text and comment edits only; no executable change (the role.ts and role.js diffs are comment lines only and the build is reproducible). §6 information hygiene: no absolute paths, hosts, credentials or personal data in any added line. The role.ts comment uses repo-relative names; its internal tags `(v3.49.0, C13)` come with a plain-language statement of the fact (release-engineer is in `AgentName` and opens on the `qa-engineer:PASS -> release-engineer:In_Progress` edge) and match the tag style already used in tools/transitions.ts. The lite template cites `specs/d8-lite-recommended-model.md`, a repo-relative path that matches the template's existing `content/skill-coordinator-lite.md` reference style, and gives the plain-language reason in the same sentence.

## Performance
No findings. The composed coordinator bundle grows by +21 bytes per the spec's dry run; test/context-budget.test.mjs is green with caps unchanged. Recording before/after values is qa's job (AC9).

## Verdict
APPROVED — all seven text sites and the five-line comment match the approved Copy / Strings byte-for-byte, the rest of each file is unchanged, dist/ matches a fresh build, every factual claim checks out against the source, and the only red test is the golden re-capture assigned to T-E408-04.
