# Judge report — T-E447-10 (round 2, batched)

covers: T-E447-01, T-E447-02, T-E447-03, T-E447-04, T-E447-05, T-E447-06, T-E447-07, T-E447-08, T-E447-09, T-E447-10

## Round 2 — APPROVED — by code-reviewer

Full suite on HEAD 4d706b4 (code 9b468e3 plus state commits; the tree was clean at the start): `node scripts/test-lock.mjs -- npm test` → tests 4836, pass 4834, fail 0, skipped 2, exit 0 (duration 445 s). `npm run build` → exit 0, and `git status --porcelain` shows no `dist/` change. `npm audit --audit-level=high` → exit 0 (1 low + 6 moderate, pre-existing, no dependency change).

## Expected-Red Diff

The manifest `qa_reports/expected-red_e447-local-knowledge-files.txt` has 42 entries: 39 from round 1, all green since round 1, and 3 from round 2. Actual reds in the judge's full suite: 0.

- 39 round-1 entries (24 e447 scenario tests, plus 15 re-pins: lane-paths REG1, compose goldens, context-budget caps, e410, e428): still green.
- `test/e447-lane-seed-finish.test.mjs | AC15 …`: scenario test, now green. D11 was built in 9b468e3.
- `test/e447-lane-seed-finish.test.mjs | AC16 (iv) …`: scenario test, now green. The mode-on wording was built in 9b468e3.
- `test/e447-served-text.test.mjs | AC20 …`: scenario test, now green. R3 was fixed in 9b468e3 (`docs/install.md:235`).
- qa's comment-only note on the two `test/check-md-tables.test.mjs` real-corpus reds (not manifest entries): both are green after the whitespace-only Tasks-table join 4d3750f (one blank line deleted).
- Actual reds not on the manifest: none.

## AC Execution Log

- AC1 — test/e447-init-knowledge.test.mjs `AC1: …` (full suite) — ok — pass
- AC2 — test/e447-init-knowledge.test.mjs `AC2 (a)`…`AC2 (f)` (6 tests) — ok — pass
- AC3 — test/e447-lane-seed-finish.test.mjs `AC3: …` — ok — pass
- AC4 — test/e447-lane-seed-finish.test.mjs `AC4: …` — ok — pass
- AC5 — test/e447-lane-seed-finish.test.mjs `AC5: …` — ok — pass
- AC6 — test/e447-lane-seed-finish.test.mjs `AC6 overwrite`, `AC6 both changed` — ok — pass
- AC7 — test/e447-lane-seed-finish.test.mjs `AC7: …` — ok — pass
- AC8 — test/e447-lane-seed-finish.test.mjs `AC8: …` — ok — pass
- AC9 — test/e447-cut-reseed.test.mjs `AC9 match` / `AC9 changed` / `AC9 reseed` / `AC9 reseed refuses` / `AC9 reseed boundaries` — ok — pass
- AC10 — `node scripts/test-lock.mjs -- npm test` on 4d706b4: 4834 pass / 0 fail / 2 skipped of 4836 (round-1 baseline 4815/0/2 of 4817, plus the 19 T-E447-08 tests); plus test/e447-mode-off.test.mjs (the round-1 AC10 tests and `AC10 (amended)`) — exit 0 — pass
- AC11 — test/e447-served-text.test.mjs `AC11: …` — ok — pass
- AC12 — test/e447-served-text.test.mjs `AC12: …` — ok — pass. Judge run of `git diff 07a6d47..HEAD -- docs/config.md docs/install.md docs/lane-protocol.md`: the only `-` line is the (iii) eject row, whose old cell is an exact prefix of the new (DOC-INST-5, consented). The R3 line at `docs/install.md:235` is this lane's own addition, so it does not appear as a removal against the base. — pass
- AC13 — test/e447-lane-seed-finish.test.mjs `AC13: no seed record -> …` — ok — pass
- AC14 — test/e447-lane-seed-finish.test.mjs `AC14 numbered: …`, `AC14 both changed: …` — ok — pass
- AC15 — test/e447-lane-seed-finish.test.mjs `AC15: AC14 lane + forced late failure, … re-run -> exit 0 …` — ok — pass
- AC16 — test/e447-lane-seed-finish.test.mjs `AC16 (i)`…`AC16 (iv)` — ok — pass
- AC17 — test/e447-cut-reseed.test.mjs `AC17 (i)`…`AC17 (vi)` — ok — pass
- AC18 — test/e447-init-knowledge.test.mjs `AC18: ticketDir "work/tick*ts" -> …` — ok — pass
- AC19 — test/e447-cut-reseed.test.mjs `AC19 (a)`, `AC19 (b)` — ok — pass
- AC20 — test/e447-served-text.test.mjs `AC20: …` — ok — pass
- e447 files alone — `node --test test/e447-*.test.mjs` — 45 tests, 45 pass, 0 fail — pass
- Cut check — `node scripts/fanout.mjs check --cut specs/fanout-post-v5-w6.md e447 specs/e447-local-knowledge-files.md` — exit 1. Output: `FAIL APPROVAL_HUMAN` plus exactly 14 OUT tokens: the 12 `dist/tools/{config,lane-paths,fanout-manifest}.*` outputs, `test/lane-paths.test.mjs` and `test/e410-task-alias-content-tail.test.mjs`. No `MANIFEST_CHANGED`. — pass (as expected)
- Scope — `git diff --stat 07a6d47..HEAD`: 52 files, all in the e447 owned set, the implicit lane bookkeeping, or the integrator-assigned tests (lane-paths, e410, e428). Nothing under `gates/**`, `prompts/**` or `templates/**`, and no change to `tools/transitions.ts`, `tools/handoff-orchestrator.ts` or e446's files. No `content/**` change since round 1, so the coord-03 Task-alias sentences are untouched (`test/e408-core-task-alias-tail.test.mjs` is green). `gates/registry.ts` declares 33 gate codes, and the 17-step pipeline is unchanged: the diff touches neither file, and `test/e35-pipeline-order.test.mjs` is green. — pass
- Judge probe D11-a (scratch repo, `/private/tmp/…/probe/d11-partial.mjs primary-fail`). Setup: a lane-changed backlog, 1 pending block, and the primary `docs/` made read-only. First `finish --shipped`: exit 1, `harvest of docs/backlog.md into the primary checkout failed (EACCES … <primary>/docs/.agc-seed-*.tmp) … (re-running finish is safe)`; the lane copy holds the lane bytes + E16 and the primary is still seeded. After the chmod is restored, the re-run exits 0: it harvests the final bytes, prints `e9/L1 already applied, skipping (backlog row E16)` and no `appended` line, the primary equals the lane + E16, the worktree is removed, and `git status` is empty — pass
- Judge probe D11-b (`… lane-fail`). Setup: the lane's `docs/` made read-only. First run: exit 1, the same message naming the lane's temp file in `(<error>)`; neither copy changed. Re-run: exit 0, E16 numbered once, worktree removed, `git status` empty — pass
- Copy audit (5a) — every A1 row was grepped against `bin/agc-init.mjs`: `:486`, `:615` (+ `:796` prefix), `:1322–1327`, `:2056`, `:2091`, `:2103`, the reseed and finish sites, and `:3097–3103`. All match verbatim, and the diff since round 1 adds no unlisted user-facing string — pass
## 2026-11-27T03:04:44.481Z — PASS — by code-reviewer

suite-result: 4834/4836 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED (round 2, T-E447-10; covers T-E447-01..10). R1 resolved: the 12 strings are Copy rows [A1], kept verbatim, and match the code. R2 resolved: AC13-AC19 with tests. R3 resolved: docs/install.md:235 now names specs/archive/<ticket-id>/. R4 resolved: D11 is built (final backlog composed in planning; lane copy first, then primary; no second primary write); AC15 is green, and two judge probes re-run to completion (primary write failed / lane write failed). AC1-AC20 (AC10 as amended) are implemented and green. Full suite at 4d706b4: 4834 pass / 0 fail / 2 skipped of 4836, exit 0. e447 files alone: 45/45. The 3 round-2 expected reds are now green, and there are no reds off the manifest; the check-md-tables reds are green after 4d3750f. Build: no dist diff. npm audit high: exit 0. AC12 docs diff: the only removal is the consented (iii) prefix-extension. check --cut: exit 1, APPROVAL_HUMAN plus the 14 expected OUT tokens. Scope is clean: no gates/prompts/templates/e446 files; GATE_REGISTRY 33; pipeline 17; content/** unchanged since round 1. The harvest-failed text on a lane-copy failure is acceptable: it is human-approved Copy, re-running is safe (probed), and (<error>) names the real path. Optional notes only. Report: review_reports/review_T-E447-10.md.

