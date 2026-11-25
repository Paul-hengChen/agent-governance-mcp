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
## 2026-11-25T17:50:40.641Z — PASS — by code-reviewer

suite-result: 4757/4760 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED (round 1, covers T-E425-01..06). AC1-AC15 implemented and each genuinely tested (14 e425 tests on served prompts / shipped docs / black-box script; negative control in a scratch copy turned AC7, AC13, AC14 red). Copy/Strings verbatim (content/** byte-exact; ticket-format wrapped to doc column, whitespace-normalised equal); C-BS output, messages and exit codes match. Stop/waiting/manual-verification semantics consistent across lane-protocol C-LP2, C-C08, C-CO3/C-CO7, C-IN1..3, C-TF1/2 and scripts/batch-summary.mjs (read-only, relative paths only). content/** additions: no repo-only path, no bare ticket id. GATE_REGISTRY 33, pipeline 17, no .ts/dist change. Goldens: exactly 7 changed, 5 lite unchanged; caps 9336/7424/19449 (+100/+100/+228, ~9-10% of E418 saving) with per-hunk comments. Integrator grants respected (addendum one entry; e118 AC7 cap, e410 AC2 lines/counts, e349 TOOLS). Build exit 0, npm audit high exit 0, full suite 4757/0/3 of 4760 on clean tree @ a05f1179. Recommended (non-blocking): ticket-format Status values example 'stopped — waiting on vendor firmware' collides with the fixed 'waiting on <id>' wording. review_report: review_reports/review_T-E425-01.md

