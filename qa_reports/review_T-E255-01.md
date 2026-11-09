covers: T-E255-01, T-E255-02, T-E255-03, T-E255-04, T-E255-05, T-E255-06, T-E255-07, T-E255-08

# QA review — E255 product-prefix cleanup (T-E255-01..08)

Phase 0.5: skipped (no expected-red manifest declared).
Phase 1.5: skipped (no Visual Baselines declared).
Phase 3: skipped (no new test; T-E255-07 edits two existing fixtures; no standing regression test warranted, the AC10 grep is a one-shot tree property).

T-E255-07 (AC6): fixture baseline row in `test/visual-evidence-gate.test.mjs:29` and `test/visual-gate-e2e.test.mjs:38` renamed to class name `wizard` (surface id and baseline path, one line each; no other line in either file names them; e2e line 252 uses `${mode}`). `node --test` on both files: 69 pass / 0 fail.

## AC Execution Log

Base = 2425e04. The product-style prefix is derived at runtime from `.current/history/2026-09/e232/tasks.md` line 6 into a scratch pattern file and used with `-f`; it is never typed.

| AC | proof run | observed | verdict |
|---|---|---|---|
| AC1 | `git grep -n -i -f <pat> -- content/`; `git diff --numstat <base> -- content/` | no hits (rc 1); numstat 3/3 constitution-rationale, 1/1 skill-design-auditor, 1/1 skill-pm, 1/1 skill-qa-engineer | PASS |
| AC2 | `awk 'NR==30{print length($0)}' content/skill-pm.md` | 232 (<= 236) | PASS |
| AC3 | `git diff --quiet <base> -- test/context-budget.test.mjs` | rc 0; context-budget and golden tests green inside the full suite; build clean | PASS |
| AC4 | `git diff -M --name-status <base> HEAD -- research/`; `test -f` new file; `git ls-files \| grep -i -c -f <pat>` | one R100 line to `research/visual-fidelity-retrospective-2026-06-05.md`; test -f rc 0; filename count 0 | PASS |
| AC5 | citation grep with the spec's exclusion filters | prints nothing | PASS |
| AC6 | `git grep -n -i -f <pat> -- test/`; both test files; `git diff --numstat <base> -- test/` | no hits; 69 pass / 0 fail; 1/1 on each of the two files, nothing else | PASS |
| AC7 | `git grep -n -i -f <pat> -- research/ specs/ docs/ ':!docs/backlog.md'` | prints nothing | PASS |
| AC8 | `git diff --numstat <base> -- CHANGELOG.md`; hunk headers | 4/4; hunks at 4460, 4511, 5933, 5982 | PASS |
| AC9 | numstat on the five E232 evidence files; `npm run check:bookkeeping` | 5/5, 2/2, 2/2, 1/1, 1/1; check:bookkeeping OK | PASS |
| AC10 | `git grep -n -i -f <pat> \| cut -d: -f1,2` | exactly `.current/history/2026-09/e232/tasks.md:6`, `docs/backlog.md:226`, `docs/backlog.md:1345` | PASS |
| AC11 | `node scripts/test-lock.mjs -- npm test`; `npm run check:md-tables`; porcelain | see suite note below; md-tables OK (745 files, 0 malformed); `git status --porcelain` empty after the T-E255-07 commit | PASS |
| AC12 | commit-message grep since base; spec grep; lane evidence files | commit messages 0; spec 0; `review_reports/review_T-E255-01.md` 0; this file 0 | PASS |

Suite note (AC11). Final HEAD for code and test changes: the T-E255-07 commit. Full suite under the test lock: 4061 tests, 4058 pass, 1 fail, 2 skipped. The single red is `VR-22 (E80)` in `test/verify-release.test.mjs:935` ("wait=0 must not incur any wall-clock poll sleep; took 5088ms"), a wall-clock assertion. It ran at machine load average above 30 with several other lanes' suites running. This lane did not touch `test/verify-release.test.mjs` or `scripts/verify-release.mjs` (empty diff against base). Re-run of that file alone: 63 pass / 0 fail; VR-22 alone also passes at load average 48. Verdict: environmental, not this lane's. `npm run build` was exercised by the suite's prebuild step; `dist/` shows no porcelain change.

Not done: the `docs/backlog.md:226` and `:1345` rewrites are integrator bookkeeping by instruction; `review_reports/review_T-E232-05.md:14` stays inconsistent until the integrator renames the backlog entry.
## 2026-11-09T09:20:50.740Z — PASS — by qa-engineer

suite-result: 4058/4061 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

T-E255-01..08 PASS. AC1-AC12 proofs all run and recorded in the AC Execution Log. T-E255-07 renamed both fixture baseline rows to wizard (69/69 in the two test files). Tracked-tree remainder is exactly docs/backlog.md:226, docs/backlog.md:1345 and .current/history/2026-09/e232/tasks.md:6 (integrator bookkeeping); tracked file names 0; commit messages since 2425e04 0. Full suite under test lock: 4061 tests, 4058 pass, 1 fail, 2 skipped. The one red, VR-22 in test/verify-release.test.mjs:935, is a wall-clock assertion that fired at load average above 30; the lane did not touch that file, and a re-run of the file passes 63/63 (VR-22 alone also passes at load 48). Environmental, not this lane's.

