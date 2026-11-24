# Judge report — E435 remove the old build path

covers: T-E435-01, T-E435-02, T-E435-03, T-E435-04, T-E435-05, T-E435-06, T-E435-07, T-E435-08, T-E435-09, T-E435-10, T-E435-11, T-E435-12, T-E435-13, T-E435-14, T-E435-15, T-E435-16, T-E435-17, T-E435-18, T-E435-19, T-E435-20, T-E435-21, T-E435-22, T-E435-23, T-E435-24, T-E435-25, T-E435-26, T-E435-27, T-E435-28, T-E435-29, T-E435-30, T-E435-31, T-E435-32, T-E435-33, T-E435-34, T-E435-35, T-E435-36, T-E435-37, T-E435-38, T-E435-39, T-E435-40, T-E435-41, T-E435-42, T-E435-43, T-E435-44, T-E435-45, T-E435-46, T-E435-47, T-E435-48, T-E435-49, T-E435-50

## Round 1 — APPROVED (PASS pending the human ruling on AC11 `npm run eval`) — by code-reviewer

Review report: `review_reports/review_T-E435-01.md` (per-task verdicts and the five coordinator rulings). Head `01ddec4d`, base `a1a36b2`. Suite: `node scripts/test-lock.mjs -- npm test` on the clean tree → 4579 tests, 4576 pass, 0 fail, 3 skipped, exit 0.

## Expected-Red Diff
Manifest `qa_reports/expected-red_e435-remove-old-path.txt`: 72 lines, 0 open rows (only `#` comment / section lines; 454 rows were recorded red at base by qa and cleared by sr). Actual reds in the suite: 0. Differences: none.
- Skipped (not red, not on the manifest, innocent): `AC4: zero code changes … outside content/**` and `AC14: every path changed since 121ddc8 …` (e130 history-dependent, commit not in this clone's history); `E417 F6: a partial clone never fetches …` (local git < 2.44). All three pre-date E435; none is an E435 scenario test.

## AC Execution Log
| AC | command | raw outcome | result |
|---|---|---|---|
| AC1 | `node --test --test-name-pattern="^AC1" test/e435-remove-old-path.test.mjs` | exit 0 | pass |
| AC2 | `node --test --test-name-pattern="^AC2" test/e435-remove-old-path.test.mjs` | exit 0 | pass |
| AC3 | `node --test --test-name-pattern="^AC3" test/e435-remove-old-path.test.mjs` | exit 0 | pass |
| AC4 | `node --test --test-name-pattern="^AC4" test/e435-remove-old-path.test.mjs` | exit 0 | pass |
| AC5 | `node --test test/error-code-contract.test.mjs test/e434-reviewer-visual.test.mjs test/e35-pipeline-order.test.mjs test/e26-gate-stats.test.mjs` | 82 tests, 82 pass, 0 fail | pass |
| AC6 | `node --test --test-name-pattern="^AC6" test/e435-remove-old-path.test.mjs` | exit 0 | pass |
| AC7 | `node --test --test-name-pattern="^AC7" test/e435-remove-old-path.test.mjs` | exit 0 | pass |
| AC8 | `node --test --test-name-pattern="^AC8" test/e435-remove-old-path.test.mjs` | exit 0 | pass |
| AC9 | `node --test --test-name-pattern="^AC9" test/e435-remove-old-path.test.mjs` | exit 0 (ran, not skipped: suite line `ok 2788 - AC9: …`) | pass |
| AC10 | `node scripts/test-lock.mjs -- npm test` | 4579 / 4576 pass / 0 fail / 3 skipped, exit 0; expected-red 0 open rows | pass |
| AC11 (part) | `npm run build` → `git status --porcelain` | build OK, `check:transitions-sync — OK (22 keys …)`; status shows only `.current/e435/{dispatch.jsonl,handoff.md}` (this hop's own state write), no `dist/` path | pass |
| AC11 (part) | `node bin/agc-init.mjs check` | `agc check — OK (4.23.0) — all adapters current` (comment / hygiene advisories only), exit 0 | pass |
| AC11 (part) | `npm audit --audit-level=high` | exit 0 | pass |
| AC11 (part) | CLAUDE.md Layout line 78, "17-step" mentions, Execution Profile sentence vs `templates/agent-adapters/claude.md` | in sync (diff read; e395 / agc-adapters / e435 AC7 green) | pass |
| AC11 (part) | `npm run eval` | not run — pending the human ruling (needs an API key); not judged, not relaxed | pending |
| extra | `node scripts/smoke-qa-flow.mjs` | `12/12 smoke tests passed.` | pass |
| scope | `git diff --name-only a1a36b2...HEAD` | every path inside the e435 owned set (manifest Lanes row); no forbidden path; no `agc-version` stamp change; no `CHANGELOG.md` / `package.json` / `package-lock.json` / `index.ts` change | pass |
