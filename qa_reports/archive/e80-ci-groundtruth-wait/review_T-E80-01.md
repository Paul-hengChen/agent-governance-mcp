# QA review — T-E80-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-08-19T04:11:37.935Z — PASS — by qa-engineer

PASS T-E80-01+T-E80-02. Reviewed diff: scripts/verify-release.mjs Check 6 bounded-poll (sha-not-found branch only) + skill-release-engineer.md step 9a wait-vs-degraded rewrite (code-reviewer APPROVED, zero blocking, review_reports/review_T-E80-01.md). Added 3 new tests VR-20/21/22 in test/verify-release.test.mjs pinning: (a) sha absent then present+success mid-poll -> OK no WARN; (b) budget expiry with sha still absent -> byte-identical pre-E80 WARN, green, exit 0 (E78 contract intact, no new FAIL mode); (c) AGC_VERIFY_CI_WAIT_SECONDS=0 -> exactly 1 gh call, no wall-clock wait (verified via call-counter shim, not just timing). Retargeted VR-9 with 3 new assertions for step 9a's bounded-poll/env-var wording and the two-case WARN scoping. Actioned the reviewer's blocking heads-up: VR-17/VR-18 drove the sha-not-found branch with no env override and would have blocked 600s each under the new poll code — amended runVerifyWithPath with an extraEnv param and pinned AGC_VERIFY_CI_WAIT_SECONDS=0 on both. Reviewer's 4 non-blocking nits left unfixed per scope (recorded in review_reports/review_T-E80-01.md); verify-release.mjs:280 stale wording correctly left untouched (VR-11 byte-pins it). Full npm test: 1745/1745 green, ~58.3s wall-clock total (verify-release.test.mjs alone: 32/32, ~34.9s — no test approaches the 600s default). Evidence: qa_reports/review_T-E80-02.md (covers: T-E80-01, T-E80-02).

