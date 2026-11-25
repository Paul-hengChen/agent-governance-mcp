# Judge report — T-E425-01

covers: T-E425-01, T-E425-02, T-E425-03, T-E425-04, T-E425-05, T-E425-06

## Round 1 — APPROVED — by code-reviewer

## Expected-Red Diff

Manifest `qa_reports/expected-red_e425-stop-ticket-batch.txt`: 14 entries, all in `test/e425-stop-ticket-batch.test.mjs`. Full suite on a clean tree @ a05f1179 (`node scripts/test-lock.mjs -- npm test`): 0 actual reds.

- AC1 … AC14 (14 manifest entries) — scenario tests, now green — built (T-E425-02..05).
- Actual reds off the manifest: none. The spec's expected reds outside the manifest (compose-equivalence, skill-manifest, context-budget) and the integrator-assigned re-pins (e118 AC7, e410 AC2, e349 AC-E349-2) are green after T-E425-06.

## AC Execution Log

No ticket file (spec Acceptance Criteria stand in as scenarios). Commands run by code-reviewer this round.

- AC1 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC1) and `node --test test/e290-lane-protocol-generic.test.mjs test/e433-test-first-rules.test.mjs test/e383-lane-ledger-worktree.test.mjs test/e385-worktree-evidence.test.mjs` — ok; 36/36, exit 0; `git diff 976a7890...HEAD -- docs/lane-protocol.md` changes no line before 41 — pass
- AC2 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC2) — ok — pass
- AC3 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC3) — ok — pass
- AC4 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC4) — ok — pass
- AC5 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC5) — ok — pass
- AC6 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC6) — ok — pass
- AC7 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC7) — ok; negative control (waiting branch disabled, scratch copy) red — pass
- AC8 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC8) — ok — pass
- AC9 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC9) — ok — pass
- AC10 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC10) — ok — pass
- AC11 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC11) — ok — pass
- AC12 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC12) — ok — pass
- AC13 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC13) — ok; negative control (C-CR renumbered 4b) red — pass
- AC14 — `node --test test/e425-stop-ticket-batch.test.mjs` (AC14) — ok — pass
- AC15 — `node scripts/test-lock.mjs -- npm test` — exit 0, 4760 tests: 4757 pass, 0 fail, 3 skipped; `git diff --stat 976a7890...HEAD -- test/fixtures/compose-golden` lists exactly the seven goldens; `GATE_REGISTRY` 33, `UPDATE_STATE_GATE_PIPELINE` 17 (from `dist/`) — pass

Also run: `npm run build` exit 0 (tree clean after, `dist/` unchanged); `npm audit --audit-level=high` exit 0; `node --test test/e425-*.test.mjs` 14/14.
