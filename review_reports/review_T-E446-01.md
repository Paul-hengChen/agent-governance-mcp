# Review — T-E446-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- T-E446-01 (qa-engineer) adds `test/e446-doc-writer-close.test.mjs` (AC1–AC8, 8 tests) and re-pins `test/e408-core-task-alias-tail.test.mjs` AC6 from the five base comment lines to the six `C-RT1` lines (`want` array, assertion message, one comment line; every other assertion untouched).
- Base `content/skill-doc-writer.md` is frozen as a 36-line literal (no git lookup, no lane sha), so AC5/AC8 detect drift on any other line; served text is checked through both render paths (`switchRole(...).sop`, `buildPromptForRole` skill slice).
- Scope: two test files, inside the e446 owned set. Verdict: APPROVED.

## AC Completeness
AC1 — implemented — test/e446-doc-writer-close.test.mjs:107-123 (no `tw_update_state(`, `pending_notes`, `<upstream-caller>`, `next_role`; exactly two mentions, both prohibitions; raw + both served texts)
AC2 — implemented — test/e446-doc-writer-close.test.mjs:125-139 (line 15 == C-DW1; e437 anchor once; no `tools/transitions.ts`; commit + final reply)
AC3 — implemented — test/e446-doc-writer-close.test.mjs:141-152 (line 32 == C-DW2; single CHANGELOG bullet)
AC4 — implemented — test/e446-doc-writer-close.test.mjs:154-168 (line 36 == C-DW3; Output rule line == base line 10, served unchanged)
AC5 — implemented — test/e446-doc-writer-close.test.mjs:170-194 (36 lines; all lines but 15/32/36 == base; step 1; five headings in order; empty backtick error-code set vs `ALL_GATE_CODES`)
AC6 — implemented — test/e446-doc-writer-close.test.mjs:196-228 (`validateTransition` rejects (code-reviewer, PASS) → code-reviewer × {In_Progress, PASS, FAIL, Blocked} with `TRANSITION_REJECTED`, `allowed` exactly pm/researcher/release-engineer/design-auditor In_Progress; `doc-writer` × 4 statuses → `AGENT_ID_REQUIRED`; `doc-writer` absent from `tools/transitions.ts` and its dist). The byte-identity half is the judge-run command (logged in qa_reports/review_T-E446-01.md).
AC7 — implemented — test/e446-doc-writer-close.test.mjs:230-250 plus test/e408-core-task-alias-tail.test.mjs:94-110 (six C-RT1 lines, contiguous, once, directly above the map entry, no seventh comment line; dist carries them trimmed). The non-comment-line half is the judge-run command.
AC8 — implemented — test/e446-doc-writer-close.test.mjs:252-275 (changed set exactly {15, 32, 36}; no URL, repo-only path, bare ticket id, version label, backtick gate code; each changed line renders as its own line). Render glue count 0 is `test/render-structure.test.mjs`.
AC9 — implemented (command scenario, no test by design) — judge-run full suite + owned-set diff.

## Correctness
No findings.
- Each test fails on a wrong result. Negative control (scratch copy outside the worktree, step 6 reverted to base text only): AC1 fails with `raw content/skill-doc-writer.md: no tw_update_state( call form` — a regression back to a state-write instruction is caught. A rewording without the call form is still caught by the exact-two-mentions + prohibition-phrase assertions (lines 116-121).
- AC6 is a genuine server-side check: it calls the real `validateTransition` from `dist/tools/transitions.js`, and the `tw_update_state` pipeline's first step `TRANSITION_VALIDATION` (tools/handoff-orchestrator.ts:229-258) feeds it `prevTuple` built straight from the persisted `last_agent`/`status` (tools/handoff-orchestrator.ts:1307-1310), with `feature_changed` bypassing only the hop cap — so the pure-function result is what the handler returns.
- AC8's error-code check uses `ALL_GATE_CODES` (33 codes, includes `TRANSITION_REJECTED` and `AGENT_ID_REQUIRED` — verified), not a loose regex; correct, since `ALLOWED_TRANSITIONS` is a legitimately quoted non-code identifier.
- Open interface details in `qa_reports/tests_e446-doc-writer-close.md` (skill-slice extraction, trimmed dist comparison, order-insensitive `allowed`) contradict no AC and no existing interface; accepted.
- Coverage: tests are text/behaviour assertions over a Markdown file and a comment; line coverage tooling does not apply.

## Quality
No findings. Test titles start with their AC id as the spec requires; Copy constants are verbatim from the spec blocks (byte-compared to the shipped lines by AC2–AC4). The e408 re-pin is minimal and its added comment line is one line.
- optional: AC6 is the pure-function minimum the spec allows; an end-to-end replay through the `tw_update_state` handler on a throwaway workspace would also pin the orchestrator wiring. Not needed for PASS — the wiring was read and is direct (see Correctness).

## Architecture
No architecture spec (none required; no `.ts` behaviour change). Tests import only built `dist/` modules, consistent with the surrounding suites.

## Security
No findings. Tests read repo files and call pure functions; no network, no writes.

## Performance
No findings. Eight synchronous file reads and a few in-memory render calls per run.

## Verdict
APPROVED — every automatable AC has a test on the public interface whose assertion fails on a wrong result (negative control confirmed for AC1), and the re-pin is limited to the six C-RT1 lines.
