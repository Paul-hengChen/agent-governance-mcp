covers: T-E405-01, T-E405-02, T-E405-03, T-E405-04, T-E405-05, T-E405-06, T-E405-07, T-E405-08, T-E405-09, T-E405-10, T-E405-11, T-E405-12

# QA round 1 — e405-release-cd (T-E405-01..12)

Verdict: PASS. Reviewer: qa-engineer (sonnet), Task-spawned. Code review round 1 was APPROVED (`review_reports/review_T-E405-02.md`, covers 02..07).
The suite result is recorded by the server on the PASS write (`qa_suite_result`, command `node scripts/test-lock.mjs -- npm test`), run on the final HEAD after the evidence commit with `git status --porcelain` empty.

## Per-task verification

| task | what was verified | verdict |
|---|---|---|
| T-E405-01 architecture | the architecture's Exit-Code Table has 42 rows and `EXIT_CLASSES` equals it row for row (RS "AC-R10 exit table equals …"); the 31 E394 rows keep code, id and gain only phases; the Test seams are implemented as written | PASS |
| T-E405-02 skeleton | RN: AC-R1 (tuple check before any write, byte-for-byte `state.md` outside the root), AC-R2 (opening write order, args, rejected / throwing / unloadable server → 61, dry run loads nothing), O1 (real compiled orchestrator), AC-R13 (stop file = last stderr line), AC-R10 runner classes | PASS |
| T-E405-03 pre-flight, version, branch, bumps | RN: AC-R3 (lenient `--ci-check`, red → 63, WARN continues, dry run wait 0), AC-R4 (patch/minor/major, local and origin branch → 64, no branch created), AC-R5 (bumps, CHANGELOG move, lockfile parity → 71, empty Unreleased → 70 with nothing written) | PASS |
| T-E405-04 build, test, audit, done-mark, message | RN: AC-R6 (72, 12, 73, 74, 75 at s3 and at s9, recorded advisory named twice), AC-R7 (only the named pre-marked row amended, `none` writes nothing, three DONE_MARK stops), AC-R8 (message outside the root, OQ2 summary, no trailer, `version` written last), AC-R11 (only the enumerated npm/npx shapes; refused forms throw INTERNAL under read, deferred and mutate) | PASS |
| T-E405-05 record, E401, dry run | RN: AC-R9 (closing triple args, four read-back mismatch fields → 62, rejected → 61, no tag → USAGE), AC-R14 (start and record dry runs; all five phases execute no mutating call and no state call), AC-E1 (passed / pending / unverified print one line, wait 0, no sleep; red → 41; real run keeps `--strict --sha` and wait 900) | PASS |
| T-E405-06 workflow | WF: 14 tests, AC-W1..W10, plus the issue step's shell executed against a fake `gh` (stop line byte-for-byte, `NO_STOP_LINE`, hostile class text refused), every flag in `release.mjs --help` | PASS |
| T-E405-07 docs, SOP, CONTRIBUTING | DC: AC-D1, AC-D2, AC-D4; SP: AC-E2, AC-D3, AC-H5; `git diff --numstat` shows CONTRIBUTING +1 and the SOP +2/-1 (the pointer line and the step-13 line) | PASS |
| T-E405-08 | `test/e405-release-workflow.test.mjs`, 14 tests, all pass | PASS |
| T-E405-09 | `test/e405-release-runner.test.mjs`, 27 tests, all pass; single-file wall time 23.5 s (`node --test`, duration_ms 23466) | PASS |
| T-E405-10 | `test/e394-release-script.test.mjs` re-pinned; 59 tests pass | PASS |
| T-E405-11 | `test/e394-release-sop.test.mjs` (29 pass), `test/release-staging.test.mjs` (one assertion), `test/e405-release-docs.test.mjs` (4 pass) | PASS |
| T-E405-12 | hard conditions below; full suite on the final HEAD | PASS |

## Expected-Red Diff

Manifest `qa_reports/expected-red_e405-release-cd.txt` lists five entries. Before re-pinning, the sr's record and the code review's run gave 5 failures out of 215/222. I re-ran the five ORIGINAL test files (taken from the commit before my edits, in a scratch copy outside the worktree) against the current code:

| manifest entry | original test against current code |
|---|---|
| RS `AC-S2 exit table equals the architecture table row for row` | red |
| RS `AC-S2 one exit code per failure class` | red |
| ST `E53/E163: the Escalation Routes table is one row per exit class …` | red |
| SP `AC-P4 one row per exit code, valid next_role` | red |
| RS `AC-S3 isAllowed admits the allow-list and refuses every absent verb` | red |

Phase 0.5: clean (5/5 manifest entries confirmed red before the re-pin; 0 unexplained reds in the review's full run). Note: the full-suite run was not repeated before the re-pin; the per-entry check above plus the reviewer's recorded run (5 failures = the manifest) stand in for it. After the re-pins all five are green (RS 59/59, SP 29/29, ST file green). The manifest file is left as the sr's record.

## Re-pinned titles (AC-R12: each edited title names its AC)

| old title | new title | AC |
|---|---|---|
| AC-S2 exit table equals the architecture table row for row | AC-R10 exit table equals the E394 and E405 architecture tables row for row (AC-S2) | AC-R10 |
| AC-S2 one exit code per failure class | AC-R10 one exit code per manual-phase failure class (AC-S2) | AC-R10 |
| AC-S3 isAllowed admits the allow-list and refuses every absent verb | AC-R11 isAllowed admits the allow-list, the six new shapes, and refuses every absent verb (AC-S3) | AC-R11 |
| AC-P4 one row per exit code, valid next_role (SP) | unchanged title; body filters to the manual-phase rows (AC-D3) | AC-D3 |
| E53/E163 … one row per exit class … (ST) | unchanged title; the one assertion filters to the manual-phase rows (OQ1) | AC-D3 / OQ1 |

The E401 gate has no RS re-pin: RS AC-S7 "only CI-CHECK PASSED continues …" and L:E163 "publish gate is --ci-check --strict" are unedited and green (the architecture places the dry-run gate assertion in RN). Nothing else in `test/release-staging.test.mjs` changed.

## Copy Audit (Phase 3a)

Every Copy / Strings row was checked against the source: the 11 stop class ids and codes (RN AC-R10 runner classes, DC AC-D2), `Release`, `release` concurrency, `File failure issue`, `Release failed: <CLASS_ID>`, the three body lines, `NO_STOP_LINE` (WF executes the step), `state.opening` and `state.closing` (RN args deep-equal), `not yet released` → `shipped vX.Y.Z` (RN), `commit.subject` and `changelog.version` (RN), `sop.cd-pointer` and `sop.e401` (SP, exact string and 166 bytes), `contrib.pointer` (DC, exact line, once), `docs.trigger` (DC). No drift. Coverage gap: none for user-facing spec strings; the script's own stdout progress lines are the architecture's, not spec Copy. Phase 1b / 1.5: not applicable (no Visual Tokens, no design file; `Phase 1.5: skipped (no Visual Baselines declared)`).

## AC Execution Log

| AC | proof run | result |
|---|---|---|
| W1 | WF "AC-W1 dispatch-only trigger with exactly bump, tickets, dry_run" | pass |
| W2 | WF "AC-W2 main-only guard and a single release concurrency group" | pass |
| W3 | WF "AC-W3 checkout with full history and the release token, Node 22, npm ci then build before the script" (+ step names and order) | pass |
| W4 | WF "AC-W4 every push, pull request and tag path uses RELEASE_TOKEN; GITHUB_TOKEN only files the issue" | pass |
| W5 | WF "AC-W5 phase order and state continuity across the run" | pass |
| W6 | WF "AC-W6 dry_run puts --dry-run on every script call and nothing else mutates" | pass |
| W7 | WF "AC-W7 inputs reach run blocks only through env" | pass |
| W8 | WF "AC-W8 one failure-only issue step …" and the executed-shell test | pass |
| W9 | WF "AC-W9 explicit wait budgets inside the job timeout" (7200 s > 4500 s) | pass |
| W10 | `git diff --stat 18ffbc0...HEAD -- .github/workflows/ci.yml` printed nothing; WF W1 asserts the name `Release` != `CI` | pass |
| R1..R9, R11, R13, R14, E1 | RN, 27 tests, 0 fail (names above) | pass |
| R10 | RS "AC-R10 exit table equals …" | pass |
| R12 | `node --test test/e394-release-script.test.mjs`: 59 pass, 0 fail (flags, stdout lines, stop lines and codes of the manual phases unchanged) | pass |
| E1 | RN "AC-E1 publish --dry-run reports the CI state without waiting"; RS AC-S7 and L:E163 green | pass |
| E2 | SP "AC-E2 step 13 says the dry-run CI gate never waits" | pass |
| D1, D2, D4 | DC (4 tests) | pass |
| D3 | SP "AC-D3 one CD pointer under SOP", "AC-H5 size is at most 15000 bytes", "AC-P4 …"; `git diff --numstat` on the SOP: 2 added, 1 removed (two changed lines) | pass |
| H1 | `npm run build`, then `git status --porcelain` shows no `dist/` change; diff against the base has no `dist/` path | pass |
| H2 | `npm run -s check:version; echo exit=$?` → `exit=0`; `npm run -s check:bookkeeping; echo exit=$?` → `exit=0` | pass |
| H3 | `git diff --stat 18ffbc0...HEAD` over the three absorbed scripts and their five tests printed nothing; those five tests plus render-structure, skill-manifest, e92-e86, check-md-tables, e391*, subagent-templates* ran under test-lock: 410 tests, 410 pass | pass |
| H4 | `wc -c < content/skill-release-engineer.md` = 14690 (≤ 15000) | pass |
| H5 | the spec's grep for token values, personal paths and literal URLs, run over the workflow, docs, script, SOP and the three new tests printed nothing | pass |
| H6 | the spec's grep for fanout references over `test/e405-*.test.mjs` printed nothing; no test diffs against a literal sha; every gh/npm/node-script call is canned in the injected `spawn`; the only real subprocesses are local git, the repo's own scripts and a fake `gh` shell shim | pass |
| H7 | `git diff --name-only 18ffbc0...HEAD`: workflow, docs, SOP, CONTRIBUTING, `scripts/release.mjs`, `specs/e405-*`, `test/e405-*`, the two e394 tests, `test/release-staging.test.mjs` (OQ1, one assertion), `qa_reports/`, `review_reports/`, `.current/e405/**` — all in the owned cell | pass |
| H8 | the render / skill-manifest / write-boundary / check-md-tables set is part of the 410-test run above | pass |
| H9 | full suite on the final HEAD: see the server-recorded `suite-result` line | recorded on the PASS write |

## Negative controls (mutated copies outside the worktree)

Each mutation turned the named test red, and was removed: E401 dry-run wait budget left at the runner's (RN AC-E1); the dry-run guard of the orchestrator removed (RN AC-R2, R14 x3); the npm/npx env scrub disabled (RN AC-R11); `npm ci` added to `ALLOWED` (RS AC-R11); a publish step switched to `github.token` (WF AC-W4); an `${{ inputs.bump }}` put inline in a run block (WF AC-W7); `timeout-minutes` lowered to 60 (WF AC-W9).

## Findings for the integrator (no FAIL)

- O2 (first-run watch item, not a defect): `start` pre-3 and the lenient `--ci-check` assume `actions/checkout@v4` leaves `main` tracking `origin/main`; only the first real run (v4.19.0) can confirm it.
- RN uses real local git subprocesses; the single-file time is 23.5 s here (integrator note c). A first attempt that let a fake `gh` leave a pull request OPEN looped in `waitMerged` under an instant fake `sleep`; the test env now sets `AGC_RELEASE_MERGE_WAIT_SECONDS` to 0. This was a test-harness bug, not a script defect: the real script bounds the wait by wall-clock time.
- The new-test jobs do not install anything and call no network.
## 2026-11-04T07:48:12.634Z — PASS — by qa-engineer

suite-result: 4003/4005 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

QA round 1 PASS for e405-release-cd. New tests: workflow (14), runner (27, incl. real compiled orchestrator opening write, O1), docs (4). Re-pins: RS AC-R10/AC-R11, SP AC-P4/AC-E2/AC-D3, ST one assertion (OQ1). Expected-red manifest: 5/5 confirmed red on the original tests, all five now green. AC-W1..W10, R1..R14, E1, E2, D1..D4, H1..H9 executed and passing; negative controls turned the relevant tests red. Full suite 4003 pass, 0 fail, 2 skipped of 4005 under test-lock on the final HEAD with a clean tree. Evidence: qa_reports/review_T-E405-01.md (covers all twelve ids).

