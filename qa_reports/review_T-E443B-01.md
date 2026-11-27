# Judge report — T-E443B-01 (lane e443b, e443b-lane-launcher)

covers: T-E443B-01, T-E443B-07, T-E443B-08, T-E443B-09, T-E443B-10, T-E443B-11, T-E443B-12, T-E443B-13, T-E443B-14

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Suite: `node scripts/test-lock.mjs -- npm test` at `308c071`, Node 22: 4970 tests, 4968 pass, 0 fail, 2 skipped, exit 0.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e443b-lane-launcher.txt` lists 35 entries; the suite has 0 actual reds.
- The 27 scenario tests (A2-1..A2-27) in `test/e443b-*.test.mjs`: scenario tests, now green — built (T-E443B-07..13).
- `test/e115-join-precondition.test.mjs` AC5: re-pin, now green — three-parameter `checkLaneAncestry` built (T-E443B-07).
- `test/e349-integrator-repo-facts.test.mjs` AC-E349-2: re-pin, now green — addendum tool line written (T-E443B-12).
- `test/e425-stop-ticket-batch.test.mjs` AC1: re-pin, now green — `lp.s3-launcher` written (T-E443B-13).
- `test/context-budget.test.mjs` AC8/AC-P2-7: now green — cap re-baselined to the measured 20005 (T-E443B-14).
- `test/skill-manifest.test.mjs` t-golden-byte-identity: now green — golden re-captured (T-E443B-14), file not edited.
- `test/e428-tracker-mirror.test.mjs` AC6, AC12: now green — `BASE[IN_FILE].sha` re-pinned (T-E443B-14).
- `test/lane-paths.test.mjs` CALLERS2: now green — allow-list entry added under integrator ruling to-lane#5 (T-E443B-14).
- Actual reds not on the manifest: none.

## AC Execution Log

- A2-1 — `node --test --test-name-pattern "^A2-1:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-2 — `node --test --test-name-pattern "^A2-2:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-3 — `node --test --test-name-pattern "^A2-3:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-4 — `node --test --test-name-pattern "^A2-4:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-5 — `node --test --test-name-pattern "^A2-5:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-6 — `node --test --test-name-pattern "^A2-6:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-7 — `node --test --test-name-pattern "^A2-7:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-8 — `node --test --test-name-pattern "^A2-8:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-9 — `node --test --test-name-pattern "^A2-9:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-10 — `node --test --test-name-pattern "^A2-10:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-11 — `node --test --test-name-pattern "^A2-11:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-12 — `node --test --test-name-pattern "^A2-12:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-13 — `node --test --test-name-pattern "^A2-13:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-14 — `node --test --test-name-pattern "^A2-14:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-15 — `node --test --test-name-pattern "^A2-15:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-16 — `node --test --test-name-pattern "^A2-16:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-17 — `node --test --test-name-pattern "^A2-17:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-18 — `node --test --test-name-pattern "^A2-18:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-19 — `node --test --test-name-pattern "^A2-19:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-20 — `node --test --test-name-pattern "^A2-20:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-21 — `node --test --test-name-pattern "^A2-21:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-22 — `node --test --test-name-pattern "^A2-22:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-23 — `node --test --test-name-pattern "^A2-23:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-24 — `node --test --test-name-pattern "^A2-24:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-25 — `node --test --test-name-pattern "^A2-25:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-26 — `node --test --test-name-pattern "^A2-26:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-27 — `node --test --test-name-pattern "^A2-27:" test/e443b-*.test.mjs` — exit 0 — pass

Every scenario passes. The rejection comes from the review's one required finding (`scripts/lane-launch.mjs`, see `review_reports/review_T-E443B-01.md`), not from a failing scenario.
## 2026-11-27T10:04:20.646Z — FAIL — by code-reviewer

suite-result: 4968/4970 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Round 1 CHANGES_REQUESTED. One required finding (implementation only; tests are sound): scripts/lane-launch.mjs wraps runLaneLaunchCli in try/catch and prints `lane-launch: error — <first line>` (exit 1), with the header changed to "1 = refused (stderr) or an unexpected error". That user-facing string is in neither the cut's Copy / Strings nor the architecture's closed Open Question 3, and the architecture gives this script's body verbatim; commit c61ac9b records no reason. Fix: restore the architecture's script as written (no try/catch, header "Exit: 0 = no lane of the current wave is running, 1 = refused (stderr), 2 = usage."). If a catch-all line is wanted, PM must add it to Copy first. Everything else is clean: A2-1..A2-27 implemented and each proof command exits 0; 13 seeded mutations against the real dist each turned their scenario red; dist matches a fresh build; npm audit high exit 0; agc check exit 0 (comment warnings dispositioned in the review report); CLAUDE.md 250 lines; diff touches owned paths only; osascript gets untrusted text only as argv; strict TS with no any; information-hygiene grep clean. Expected-red manifest fully resolved, no off-manifest red. Recommended/optional (non-blocking): fill() doc comment overstates the finished-while-queued drop; open/wake driver throws end the run (lock released); microsecond lock-content race. Review: review_reports/review_T-E443B-01.md (covers all nine ids).


## Round 2 — APPROVED — by code-reviewer

Suite: `node scripts/test-lock.mjs -- npm test` at `19611b7`, Node 22: 4970 tests, 4968 pass, 0 fail, 2 skipped, exit 0.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e443b-lane-launcher.txt` (35 entries, unchanged since round 1, fully resolved per its last qa note); the suite has 0 actual reds.
- All 35 manifest entries: green — dispositions as in round 1 (27 A2 scenario tests built by T-E443B-07..13; e115 AC5, e349 AC-E349-2 and e425 AC1 re-pins; context-budget cap, compose golden, e428 AC6 / AC12 and lane-paths CALLERS2 re-pinned by T-E443B-14).
- Actual reds not on the manifest: none.

## AC Execution Log

- A2-1 — `node --test --test-name-pattern "^A2-1:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-2 — `node --test --test-name-pattern "^A2-2:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-3 — `node --test --test-name-pattern "^A2-3:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-4 — `node --test --test-name-pattern "^A2-4:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-5 — `node --test --test-name-pattern "^A2-5:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-6 — `node --test --test-name-pattern "^A2-6:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-7 — `node --test --test-name-pattern "^A2-7:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-8 — `node --test --test-name-pattern "^A2-8:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-9 — `node --test --test-name-pattern "^A2-9:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-10 — `node --test --test-name-pattern "^A2-10:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-11 — `node --test --test-name-pattern "^A2-11:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-12 — `node --test --test-name-pattern "^A2-12:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-13 — `node --test --test-name-pattern "^A2-13:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-14 — `node --test --test-name-pattern "^A2-14:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-15 — `node --test --test-name-pattern "^A2-15:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-16 — `node --test --test-name-pattern "^A2-16:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-17 — `node --test --test-name-pattern "^A2-17:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-18 — `node --test --test-name-pattern "^A2-18:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-19 — `node --test --test-name-pattern "^A2-19:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-20 — `node --test --test-name-pattern "^A2-20:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-21 — `node --test --test-name-pattern "^A2-21:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-22 — `node --test --test-name-pattern "^A2-22:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-23 — `node --test --test-name-pattern "^A2-23:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-24 — `node --test --test-name-pattern "^A2-24:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-25 — `node --test --test-name-pattern "^A2-25:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-26 — `node --test --test-name-pattern "^A2-26:" test/e443b-*.test.mjs` — exit 0 — pass
- A2-27 — `node --test --test-name-pattern "^A2-27:" test/e443b-*.test.mjs` — exit 0 — pass

Every scenario passes. The A2-11 / A2-12 real-script and usage subtests re-ran against the restored `scripts/lane-launch.mjs`: 10/10 pass.
## 2026-11-27T10:16:14.607Z — PASS — by code-reviewer

suite-result: 4968/4970 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Round 2 APPROVED. The round-1 required finding is resolved: scripts/lane-launch.mjs is byte-identical (cmp, 516 bytes) to the specs/e443b-lane-launcher-architecture.md §L js block. There is no try/catch, the `lane-launch: error` string is nowhere in tools/, dist/, scripts/, content/, docs/, test/ or specs/, and the header reads "1 = refused (stderr), 2 = usage". Since round 1 (git diff 25ee478..HEAD) only scripts/lane-launch.mjs, the sr reply in the review report and .current/e443b/ state changed. All other round-1 findings stand. Re-run at 19611b7, Node 22: A2-11/A2-12 real-script and usage subtests 10/10 pass; spawned script usage/unreadable-manifest exit 2 per the §L CLI contract; test/e443b-*.test.mjs + test/lane-paths.test.mjs 123/123; each A2-1..A2-27 proof command exit 0; npm run build exit 0 with no dist/ diff; npm audit --audit-level=high exit 0; agc check exit 0 (same 8 comment warnings, kept per round 1); full suite 4968/4970 pass, 0 fail, 2 skipped. Expected-red manifest fully resolved, no off-manifest red. Hygiene grep of changed files: no absolute local path. Non-blocking, carried from round 1: (recommended) the fill() doc comment overstates the finished-while-queued drop; (optional) driver.open/wake throws end the run, but the lock is released; (optional) a microsecond lock-content race. Review: review_reports/review_T-E443B-01.md (covers all nine ids).

