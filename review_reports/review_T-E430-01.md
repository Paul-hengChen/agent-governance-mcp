# Review — T-E430-01 (batched round, feature e430-mailbox-and-verify-rule)

covers: T-E430-01, T-E449-01, T-E430-02, T-E430-03, T-E449-02, T-E449-03

## Round 1 — APPROVED — by code-reviewer

Base `f08ea57`, head `81c9391`. Inputs read: `git diff f08ea57...HEAD`, `specs/e430-mailbox-and-verify-rule.md` (ACs, Copy / Strings, human ruling Q1 (a) / Q2 (a) / Q3), the wave manifest lane row and Decisions (`specs/fanout-post-v5-w3.md`; the primary checkout's copy holds the e410 assignment row), `qa_reports/expected-red_e430-mailbox-and-verify-rule.txt`, `qa_reports/tests_e430-mailbox-and-verify-rule.md`, and the tool code the new text makes claims about (`scripts/mailbox-watch.mjs`, `tools/fanout-handoff.ts`, `tools/lane-status.ts`, `bin/agc-init.mjs` mailbox teardown). No ticket file (`ticketDir` not configured): the spec's ACs stand in as the scenarios.

## Summary
- E430: `content/skill-integrator.md` gains C-IN1 (relay bullet), C-IN4 (Watch bullet, sentence replaced in place), C-IN2 (`### Sessions outside a lane` in Stage 4) and C-IN3 (Take-over step 5 *Watch check*); `docs/lane-protocol.md` §5 gains C-LP1 (`### 非 lane 的 session`).
- E449: `content/const-15-core-tail.md` §7 gains C-E449 (*Verify before asserting*) directly after *Fail loud*.
- Shared artifacts (T-E449-03): eleven compose goldens re-captured (+1 line each, the C-E449 line only), four context-budget caps set to measured values with one comment line each, `e410` row numbers and line count re-pinned.
- Every Copy / Strings entry is byte-equal to the spec and occurs exactly once at its named anchor; nothing else in the three files changed. Tests are red at base for the right reason and catch mutations. Full suite green.
- Verdict: **APPROVED**; two `recommended` and two `optional` notes, none blocking.

## AC Completeness
AC1 — implemented — `content/skill-integrator.md:113` (C-IN4 in the Watch bullet), `:125` (C-IN1), `:139-145` (C-IN2 between `### Mid-wave base fix` and `## Stage 5`); Stage 3 check 3 (`:105`) byte-unchanged (test `BASE_MAILBOX_READY`).
AC2 — implemented — `docs/lane-protocol.md:126-140` (C-LP1 after rule 6, before `## 6. 收工回報格式`); finish sentence kept; eight `## ` lines unchanged.
AC3 — implemented — `content/skill-integrator.md:249` (C-IN3, directly after the byte-unchanged step 4; section still directly before `## Status (any time)`).
AC4 — implemented — added/changed integrator lines carry no repo-only path, bare ticket id or gate code (served text; the pre-existing origin-tagged id on the Watch line is stripped as served).
AC5 — implemented — `content/const-15-core-tail.md:44`; exactly once under §7 in all eleven compositions (8 build modes, both hook outputs, fragment concat).
AC6 — implemented — the C-E449 line has no repo-only path, no ticket id, no digit.
AC7 — implemented — 11 goldens (each only the C-E449 line), `skill-coordinator-monolith.txt` unchanged; caps 6074 / 9407 / 19520 / 7495 equal my own measurement (base measured 6003 / 9336 / 19449 / 7424, +71 each); e410 rows 187 / 191 / 260, count 261, spans unchanged; GATE_REGISTRY 33, pipeline 17; `npm run build` leaves no `dist/` diff; suite green.

## Correctness
No blocking findings.

- **Copy audit (step 5a).** Extracted every C-* string mechanically from the spec (table cells and the two fenced blocks) and counted occurrences in the target file: C-E449 1, C-IN1 1, C-IN2 1, C-IN3 1, C-IN4 1, C-LP1 1. `git diff f08ea57...HEAD -- content docs` shows only those hunks (1 + 13 + 16 changed lines), each with one blank line before/after the inserted blocks. No user-facing string outside the table.
- **Tests are not vacuous (step 4).** Ran both new test files against a copy of the tree with the three files restored to base: 0/6 pass; each fails on the absence of its new text (heading not found / step 5 missing / C-E449 count 0). Mutation control on a copy with head text: `each at the count` → `each at a count` (C-IN2) fails AC1; `規則 4–6` → `規則 4-6` fails AC2; C-E449 moved one line down (after *External-reference policy*) fails AC5. Assertions are exact-equality on line ranges and on frozen base lines, so the "byte-unchanged" clauses are really pinned.
- **Named tests (step 4a).** The six titles in the Scenario → Test Map exist verbatim in the two files and check their AC.
- **No qa-written test edited by sr.** `git diff 28ef68b HEAD -- test/e430-mailbox-outside-lane.test.mjs test/e449-verify-before-asserting.test.mjs` is empty; sr's commits `b86f965` and `81c9391` touch only the three content/docs files and `.current/e430/`.
- **Tool claims in the new text are true (Constitution §7, the new bullet applied to itself).** Read the code:
  - C-IN2 "stop the running watch and arm a new one … the new one at 0": `scripts/mailbox-watch.mjs:360` refuses a file already watched (exit 4, "stop that watch first"); `:380-384` arms a file with no `--baseline` key at its current count and prints `[<key>] armed: baseline N, current M`; the key is the parent directory, so a session folder name distinct from every lane name avoids the duplicate-key refusal (`:100`). Consistent with Stage 3 check 3 (explicit file names, never a glob) and the Watch bullet's "re-arm from the printed baseline".
  - C-IN3 (b) "a lane's baseline taken from the handoff's `watch baseline` line, a session's only after you have read every message already in its file": `tools/fanout-handoff.ts:376-395` builds `watch baseline` from `m.dispatchable` lanes only, so a session's file is never in it — the read-everything rule for sessions is the right fallback, and the Decisions row is what makes the session findable.
  - C-IN2 / C-LP1 "no `agc feature finish` runs for it" and the integrator deletes the folder: `bin/agc-init.mjs:2461-2466` removes only `<worktree-parent>/_mailbox/<ticketId>/` of the finished lane.
  - C-IN2 "Stage 3 never creates one for it": Stage 3 check 3 creates `<lanes-root>/_mailbox/<lane>/` per lane only.
- **C-LP1 vs §5's other rules.** Rule 1 and rule 3 apply as written; rule 2's cut pre-review and `check --cut` are excluded (no PM hop); `from:` = session name and `hop: —` fit the block format. Coherent.

## Quality
- `recommended` — `docs/lane-protocol.md:131` (C-LP1) tells a non-lane session to write `hop: —`. That is valid for a hand-written block (§5 never mandates the tool), but `scripts/mailbox-watch.mjs --send` cannot produce it for a non-integrator sender: `resolveHop` (`scripts/mailbox-watch.mjs:436-461`) returns `—` only for `--from integrator`; otherwise `--hop` must match `^\d+(/\d+)?$` and, absent `--hop`, it reads `hop_count` from a handoff the session does not have and throws `cannot read hop_count … pass --hop <n>`. A session that reaches for the tool must therefore write the block by hand. The text is the human-ruled wording (Q3), so this is report-only; a future tool change (accept `--hop —` for a non-lane sender) would close it.
- `recommended` — the Stage 4 *Two-hour idle stop* sub-bullet (unchanged, `content/skill-integrator.md:114`) still resumes the mailbox watch "from that section's `watch baseline` line", which by the tool's construction names lanes only, and its keep-watching exception names "a lane still working". A same-session resume after an idle stop is not covered by the new Take-over step 5, so a session's file could be left out until the integrator recalls the Decisions row. Out of this spec's scope (AC1 freezes the rest of the Watch line; the sub-bullet was not in the cut); report-only.
- `optional` — C-IN1 now says "record a Decisions row naming the session" in a bullet about cross-lane notices; "session" reads as "the lane or session whose mailbox was unavailable", which is the intended generalisation. No change needed.
- Comment check (step 5d): the diff adds one-line `E449 re-baseline` comments per cap (`test/context-budget.test.mjs`, required by AC7) and a two-line `E430 re-pin` comment (`test/e410-task-alias-content-tail.test.mjs`). `agc check` reports one `high-ratio` advisory on `test/context-budget.test.mjs` (41.5%) — kept: pre-existing whole-file ratio built from the cap-history convention the spec requires; this diff adds four one-line comments.

## Architecture
No architecture spec (none required: no gate, schema, pipeline or `.ts` change). Scope: `git diff --stat f08ea57...HEAD` touches only owned files — the three content/docs files, `test/e430-*`, `test/e449-*`, `test/fixtures/compose-golden/**` (11), `test/context-budget.test.mjs`, `test/e410-task-alias-content-tail.test.mjs` (integrator-assigned under the standing unowned-red-file rule; Decisions row 2026-11-26 in the primary's `specs/fanout-post-v5-w3.md`), `specs/e430-*.md`, `qa_reports/`, `.current/e430/**`. No `.ts`, `dist/**`, `scripts/**`, other `content/**` / `docs/**` or forbidden root file. Q2 (a) respected: no role SOP points at the new bullet (AC5 counts C-E449 once in every whole composition).

## Security
No findings. Prose and test changes only; no new input crosses a trust boundary. Content hygiene (Constitution §6): the new content lines name no repo-only path (`docs/lane-protocol.md` and `<agc install>/…` are agc-shipped), no bare ticket id and restate no numeric limit. `npm audit --audit-level=high` exit 0 (1 low / 6 moderate, pre-existing; no dependency change).

## Performance
No findings. +71 ~tok on every bundle that holds §7 (the measured, human-accepted cost of ruling Q1 (a)); the integrator SOP sits in no cap. Tests read files and compose in-process; the hook test spawns two short `node` processes, in line with the existing compose tests.

## Verdict
APPROVED — every AC is implemented byte-equal to the human-ruled strings, the tests pin each scenario and fail at base and under mutation, scope and generated artifacts are exactly as planned, and the full suite is green (`node scripts/test-lock.mjs -- npm test` exit 0, 4765 / 4767 pass, 0 fail, 2 skipped); the notes above are report-only. Judge report: `qa_reports/review_T-E430-01.md`.
