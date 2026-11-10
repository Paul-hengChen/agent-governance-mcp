# QA review — e196-agc-init-lane-checks

covers: T-E196-01, T-E196-02, T-E196-03, T-E196-04, T-E196-05, T-E196-06, T-E196-08, T-E196-09, T-E196-10

Spec: `specs/e196-agc-init-lane-checks.md`. Code-review round 2 APPROVED (`review_reports/review_T-E196-01.md`, covers T-E196-01/02/03/08). Mode: no-design (no Copy-adjacent visual literals).

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e196-agc-init-lane-checks.txt` (2 entries). Run BEFORE any re-baseline edit: the pre-re-pin copies of both test files (as committed at 8e16e99) were run against the unchanged implementation/doc. Actual reds: exactly `AC-E351-3` (test/e351-lane-protocol-gaps.test.mjs) and `AC-E383-7` (test/e383-lane-ledger-worktree.test.mjs); 13 other cases in the two files green.

Phase 0.5: clean (2/2 manifest entries confirmed red, 0 unexplained reds).

Disposition after T-E196-09: both entries are now green (re-pinned to the E383 ledger sub-item, AC-E196-9). The manifest file is kept as sr's record; nothing is red against it. Re-pin diff touches only the AC-E351-3 body + the `S3_GAPS` const and the AC-E383-7 title/assertion.

## Phase 1.5 / Copy / Visual

Phase 1.5: skipped (no Visual Baselines declared). Visual Tokens / Widgets: N/A. Copy audit: the `e196.*`, `e225.*`, `e205.*` strings are asserted verbatim in the new tests (head lines, orphan lines, copy-fail tail); `doc.s6-agc-check` and the §3 removal were verified by code-review round 2 and by grep (below).

## AC to test map

| AC | test (file : case) |
|---|---|
| AC-E196-1 | test/e196-ignored-lane-state.test.mjs : AC-E196-1 |
| AC-E196-2 | e196 : AC-E196-2 |
| AC-E196-3 | e196 : AC-E196-3 (+ e180, agc-feature-finish-history unmodified) |
| AC-E196-4 | e196 : AC-E196-4 (4 `laneIgnoredStateFiles(` occurrences, one definition) |
| AC-E196-5 | e196 : AC-E196-5 (--shipped, failure planted by a post-commit hook so the copy fails after the close commit; re-run finishes), AC-E196-5 (--abandoned), AC-E196-5 exception |
| AC-E196-6 / -6-carry | e196 : AC-E196-6, AC-E196-6-carry (primary holds a differing excluded copy; refuse, primary bytes intact, HEAD unchanged, worktree + branch kept) |
| AC-E196-7 | e213, e180, e217 unmodified, green |
| AC-E196-8 | grep (log below) |
| AC-E196-9 | e351 AC-E351-3, e383 AC-E383-7 (re-pinned) |
| AC-E225-1..4 | test/e225-pending-tickets-check.test.mjs : 6 cases |
| AC-E225-5 | diff command (log below) |
| AC-E225-6 | diff command (log below) |
| AC-E205-1..5, 7 | test/e205-primary-side-effects.test.mjs : 7 cases |
| AC-E205-6 | code-reviewer item, no test required |

New test counts: e196 9 cases, e225 6 cases, e205 7 cases (22 total), 9 + 6 + 7 pass on Node 22 and Node 20.

Resident-test hygiene: temp repos only; no real `specs/fanout-*.md`, no fixed base sha, no historical SHA pins, no absolute local paths. Platform note: AC-E196-5 --shipped uses a POSIX `sh` post-commit hook (git runs hooks through its own sh on every platform).

## AC Execution Log

- AC-E196-1/2/5/6: `node --test test/e196-ignored-lane-state.test.mjs` -> 9/9 pass (Node 22 and Node 20).
- AC-E196-3: `node --test test/e180-abandoned-harvest.test.mjs test/agc-feature-finish-history.test.mjs test/e196-ignored-lane-state.test.mjs` -> all pass.
- AC-E196-6: `node --test test/e287-finish-findings.test.mjs test/e335-symlinked-pending-harvest.test.mjs test/e196-ignored-lane-state.test.mjs` -> all pass.
- AC-E196-7: `node --test test/e213-shipped-ignored-shape.test.mjs test/e180-abandoned-harvest.test.mjs test/e217-abandoned-specs-harvest.test.mjs` -> pass, unmodified.
- AC-E196-8: `grep -c "已知缺口" docs/lane-protocol.md` -> 0; `grep -c E196 docs/lane-protocol.md` -> 0; diff vs merge-base shows one removed §3 line.
- AC-E196-9: `node --test test/e351-lane-protocol-gaps.test.mjs test/e383-lane-ledger-worktree.test.mjs` -> 15/15 pass; diff touches only AC-E351-3 body, `S3_GAPS`, AC-E383-7.
- AC-E225-1..4: `node --test test/e225-pending-tickets-check.test.mjs` -> 6/6 pass; `test/agc-adapters.test.mjs` and `test/agc-feature-lifecycle.test.mjs` pass unmodified (full suite).
- AC-E225-5: `git diff --name-only 4b25061..HEAD -- tools/ dist/` -> empty; `test/lane-ticket-allocation.test.mjs`, `test/agc-feature-lifecycle.test.mjs` pass (full suite).
- AC-E225-6: diff of `docs/lane-protocol.md` = one added §6 line (`doc.s6-agc-check`) + one removed §3 line; `test/e290-lane-protocol-generic.test.mjs` passes unmodified.
- AC-E205-1..5, 7: `node --test test/e205-primary-side-effects.test.mjs` -> 7/7 pass; `test/e291-start-link-locations.test.mjs` and the existing finish suites pass unmodified (full suite).

## Lane verification (T-E196-10)

- AC-L1: `git diff --name-only 4b25061..HEAD` lists only `bin/agc-init.mjs`, `docs/lane-protocol.md`, the spec, the expected-red manifest, review/qa reports, `.current/e196/**` and the five owned test files. In scope.
- AC-L2: `npm run build` then `git status --porcelain dist/` -> empty (zero diff).
- AC-L3: `node bin/agc-init.mjs check` -> exit 0 ("all adapters current").
- AC-L5: `fnm exec --using=20 node --test <spec's 10 suites>` -> Node v20.20.2, 184/184 pass (Node 22 run of the same new suites also green).
- AC-L6: `npm audit --audit-level=high` exit 0; `npm run check:bookkeeping` exit 0.
- AC-L7: e130, e125a, e106, e108, e246, e290, e291, e298, e335 unmodified (no diff) and green in the full suite; e351/e383 changed only in AC-E351-3 / AC-E383-7.
- AC-L4: full suite on the final committed HEAD, clean tree: recorded in `qa_suite_result` of the PASS write.

## Notes (optional, non-blocking)

- Code-review optional finding carried: `e196.copy-item` rel is unescaped (same as e125b).
- Review C1: primary's own non-findings ignored file with the same relpath is overwritten by the lane's bytes; documented in the spec's Out of Scope.
- Backlog `docs/backlog.md` done-marks (E196, E206, E225, E353 CLOSED, E205) are release/integrator work.
## 2026-11-10T06:21:18.549Z — PASS — by qa-engineer

suite-result: 4140/4142 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

covers: T-E196-01, T-E196-02, T-E196-03, T-E196-04, T-E196-05, T-E196-06, T-E196-08, T-E196-09, T-E196-10. Full detail incl. Expected-Red Diff and AC Execution Log in the pre-written review section above. Summary: new suites e196 (9), e225 (6), e205 (7) all green on Node 22 and Node 20; AC-E351-3 / AC-E383-7 re-pinned (15/15); expected-red manifest confirmed 2/2 red pre-re-pin, 0 unexplained. Node 20 (v20.20.2) spec command 184/184. Build dist zero diff; agc check exit 0; npm audit --audit-level=high exit 0; check:bookkeeping exit 0. Full suite on committed HEAD dfe584b, clean tree: 4140 pass, 0 fail, 2 skipped of 4142.

