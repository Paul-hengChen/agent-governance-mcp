# Judge report — T-E465-01

covers: T-E465-01, T-E465-02, T-E465-03, T-E465-04, T-E465-05, T-E465-06, T-E465-07

## Round 1 — APPROVED — by code-reviewer

Suite: `node scripts/test-lock.mjs -- npm test` on a clean tree at be06e542 (`npm run build` leaves no dist diff) — exit 0, 5011 tests, 5008 pass, 0 fail, 3 skipped.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e465-launcher-wave-done.txt` has 16 entries. The actual reds at be06e542 are none (0 fail).

- test/e465-config.test.mjs | S1: loadConfig surfaces waveDoneAt only as merged or pr-open and fills no default; the resolver defaults to merged — scenario test, now green: built
- test/e465-config.test.mjs | S1: any other waveDoneAt value is reported by name and resolves to merged, never a config error — scenario test, now green: built
- test/e465-config.test.mjs | S1: the launcher names an unusable waveDoneAt once on standard error and runs on with merged, exit code unaffected — scenario test, now green: built
- test/e465-config.test.mjs | S7: docs/config.md documents waveDoneAt with both values and the default, right after the laneLaunchLimit section — scenario test, now green: built
- test/e465-config.test.mjs | S7: the launcher's usage line and script header name --wake-weekly and --close-finished — scenario test, now green: built
- test/e465-config.test.mjs | S7: an unknown option, a missing manifest or two manifests still print the usage line and exit 2 — scenario test, now green: built
- test/e465-dependency.test.mjs | S2: pr-open, A shipped but its pull request not merged — D starts, C waits naming A's work as not merged into main — scenario test, now green: built
- test/e465-dependency.test.mjs | S2: pr-open, A's branch still exists but is not merged — C waits with the not-merged reason — scenario test, now green: built
- test/e465-dependency.test.mjs | S2: pr-open, A's branch is gone and the launcher never recorded a tip — a finish record alone does not meet the dependency — scenario test, now green: built
- test/e465-dependency.test.mjs | S2: pr-open with knowledge local — the finish record is still required, and the merged check applies too — scenario test, now green: built
- test/e465-dependency.test.mjs | S3: after the pull request carrying A merges into main, a re-run starts C from main and does not start D again — scenario test, now green: built
- test/e465-window.test.mjs | S5: without --wake-weekly a paused-weekly lane is not woken; with it the wake line goes into the same window and the lane is running — scenario test, now green: built
- test/e465-window.test.mjs | S6: --close-finished sends /exit to the finished lane's window only, keeps stopped lanes' windows, records it closed — scenario test, now green: built
- test/e465-window.test.mjs | S6: a finished lane whose worktree is gone (agc feature finish --shipped ran) gets /exit; a stopped lane keeps its window — scenario test, now green: built
- test/e465-window.test.mjs | S6: a --close-finished run starts nothing even when a lane of the next wave is startable, and exits 0 — scenario test, now green: built
- test/e465-window.test.mjs | S6: given --wake-weekly and --close-finished together, the close-only rule wins — nothing is woken or started — scenario test, now green: built

Off-manifest reds: none. Both S4 tests were green before the build (a regression guard) and are still green.

## AC Execution Log

- S1 — test test/e465-config.test.mjs — S1: any other waveDoneAt value is reported by name and resolves to merged, never a config error — ok (also the two other S1 tests ok) — pass
- S2 — test test/e465-dependency.test.mjs — S2: pr-open, A shipped but its pull request not merged — D starts, C waits naming A's work as not merged into main — ok (also the three other S2 tests ok) — pass
- S3 — test test/e465-dependency.test.mjs — S3: after the pull request carrying A merges into main, a re-run starts C from main and does not start D again — ok — pass
- S4 — test test/e465-dependency.test.mjs — S4: merged mode — the E443b dependency reasons are unchanged (not an ancestor; gone without finish record; knowledge local) — ok (also the other S4 test, and the unedited test/e443b-*.test.mjs, ok) — pass
- S5 — test test/e465-window.test.mjs — S5: without --wake-weekly a paused-weekly lane is not woken; with it the wake line goes into the same window and the lane is running — ok — pass
- S6 — test test/e465-window.test.mjs — S6: --close-finished sends /exit to the finished lane's window only, keeps stopped lanes' windows, records it closed — ok (also the three other S6 tests ok) — pass
- S7 — test test/e465-config.test.mjs — S7: docs/config.md documents waveDoneAt with both values and the default, right after the laneLaunchLimit section — ok (also the two other S7 tests ok) — pass

Command: `node --test test/e465-*.test.mjs` — 18 tests, 18 pass, 0 fail; the full suite (above) has exit 0.
## 2026-11-27T16:57:40.829Z — PASS — by code-reviewer

suite-result: 5008/5011 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED. S1–S7 all implemented and pinned by exact tests on the public interface; all 7 ticket Verification titles match tests in the named files. Negative controls (pr-open forced off; windowClosed guard dropped) turn the S2/S3 and S6 tests red. Expected-red manifest: all 16 entries green, no off-manifest red. Scope: diff inside allowed paths; docs/lane-protocol.md and forbidden tests untouched; ticket file changed only in its 7 Verification lines; no config schema bump; loadConfig fills no default. Findings: 0 required, 0 recommended, 3 optional (silent swallow of a failed /exit send; duplicate option = usage error, accepted; tip recorded only at finish transition / dependency check, fail-safe and documented). Reports: review_reports/review_T-E465-01.md (covers T-E465-01..07).

