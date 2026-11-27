covers: T-E463-01, T-E463-02, T-E463-03, T-E463-04, T-E463-05, T-E463-06

# Judge report — e463-release-gh-checks (E463 + E464)

## Round 1 — APPROVED — by code-reviewer

Review report: review_reports/review_T-E463-01.md. Suite run on committed HEAD `98bbe04` with a clean worktree before and after:
`node scripts/test-lock.mjs -- npm test` exit 0 — tests 4930, pass 4928, fail 0, skipped 2.

## Expected-Red Diff

Manifest: qa_reports/expected-red_e463-release-gh-checks.txt (19 entries, all in test/e463-release-gh-checks.test.mjs). Actual reds in the full suite: none.

- E463-AC2 publish / publish --dry-run (2): scenario tests, now green — built (viewPr retry + stop.lookup_failed).
- E463-AC3 1 / 2 failed lookup(s) (2): scenario tests, now green — built.
- E463-AC4 close-out pre-check, prepare 8a-6 before create, prepare 8a-6 after create, close-out 13a-5, publish merge wait 8c-2, close-out merge wait 13a-6 (6): scenario tests, now green — built (every call site awaits the retrying viewPr).
- E463-AC5 wait test (1): scenario test, now green — built (AGC_RELEASE_GH_RETRY_SECONDS via envSeconds, ms through deps.sleep).
- E463-AC5 helper exports (1): scenario test, now green — scripts/gh-compat.mjs built.
- E464-AC6 helper / allow-list (1): scenario test, now green — built.
- E463-AC6, E464-AC1 doc paragraphs (2): scenario tests, now green — docs/release-cd.md paragraphs added verbatim.
- E464-AC2, E464-AC3, E464-AC4, E464-AC5 (4): scenario tests, now green — preGh version check built.
- Extras (red but not on the manifest): none. The 2 skipped tests are the pre-existing history-dependent e130 AC4 / AC14 skips (commit not resolvable in this clone), unrelated to this lane.

## AC Execution Log

- E463-AC1 — node --test --test-name-pattern "E463-AC1" test/e463-*.test.mjs — exit 0, pass 2 fail 0 — pass
- E463-AC2 — node --test --test-name-pattern "E463-AC2" test/e463-*.test.mjs — exit 0, pass 2 fail 0 — pass
- E463-AC3 — node --test --test-name-pattern "E463-AC3" test/e463-*.test.mjs — exit 0, pass 2 fail 0 — pass
- E463-AC4 — node --test --test-name-pattern "E463-AC4" test/e463-*.test.mjs — exit 0, pass 7 fail 0 — pass
- E463-AC5 — node --test --test-name-pattern "E463-AC5" test/e463-*.test.mjs — exit 0, pass 2 fail 0 — pass
- E463-AC6 — node --test --test-name-pattern "E463-AC6" test/e463-*.test.mjs — exit 0, pass 1 fail 0 — pass
- E464-AC1 — node --test --test-name-pattern "E464-AC1" test/e463-*.test.mjs — exit 0, pass 1 fail 0 — pass
- E464-AC2 — node --test --test-name-pattern "E464-AC2" test/e463-*.test.mjs — exit 0, pass 1 fail 0 — pass
- E464-AC3 — node --test --test-name-pattern "E464-AC3" test/e463-*.test.mjs — exit 0, pass 1 fail 0 — pass
- E464-AC4 — node --test --test-name-pattern "E464-AC4" test/e463-*.test.mjs — exit 0, pass 1 fail 0 — pass
- E464-AC5 — node --test --test-name-pattern "E464-AC5" test/e463-*.test.mjs — exit 0, pass 1 fail 0 — pass
- E464-AC6 — node --test --test-name-pattern "E464-AC6" test/e463-*.test.mjs — exit 0, pass 1 fail 0 — pass
- E464-AC6 (byte-identity clause) — git diff --exit-code e3a3db6 HEAD -- scripts/verify-release.mjs — exit 0, no output — pass
- X-AC1 (diff) — git diff --name-only e3a3db6...HEAD -- CLAUDE.md content test/release-staging.test.mjs test/e433-test-first-rules.test.mjs test/e297-main-protected-sop.test.mjs test/e336-portable-pull.test.mjs test/e130-lane-default.test.mjs test/feature-lease.test.mjs scripts/verify-release.mjs .github package.json package-lock.json CHANGELOG.md dist — exit 0, prints nothing — pass
- X-AC1 (forbidden tests) — node --test test/release-staging.test.mjs test/e297-main-protected-sop.test.mjs test/e336-portable-pull.test.mjs (run together with the e394, e405-runner, e405-docs and e432 files) — exit 0, 229/229 pass — pass
- X-AC1 (static) — node --test --test-name-pattern "X-AC1" test/e463-*.test.mjs — exit 0, pass 1 fail 0; EXIT_CLASSES deep-equal to the base copy (42 entries); viewPr --json literal count 1 in base and head — pass
- X-AC2 — node scripts/test-lock.mjs -- npm test — exit 0, 4928/4930 pass, 0 fail, 2 skipped; git status --porcelain empty before and after — pass

Additional checks: `npm run build` exit 0, no dist/ diff; `npm audit --audit-level=high` exit 0 (moderate advisories only, pre-existing, no dependency change in this diff).
Negative controls on a copy outside the worktree: viewPr forced to return null on any failure → 8 of 9 E463-AC2/AC4 tests red; not-found check and version stop removed → E463-AC1 (2), E464-AC3, E464-AC4, E464-AC5 red.
## 2026-11-27T08:56:42.740Z — PASS — by code-reviewer

suite-result: 4928/4930 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED round 1. Every spec AC (E463-AC1..AC6, E464-AC1..AC6, X-AC1, X-AC2) implemented and pinned by an exact test or a command proof run by the judge; all 13 proof patterns exit 0. Expected-red manifest: 19/19 entries green, no red off the manifest. Scope: only owned paths changed; scripts/verify-release.mjs byte-identical; EXIT_CLASSES deep-equal to base; PHASES, pullMain, STAGE_PATHS and the viewPr --json literal untouched. Negative controls red the targeted tests. Re-pins in e394/e405-runner/e432 add only the gh --version answer; e394 AC-S9 narrowed to admit exactly ./gh-compat.mjs per spec Decision 2. Build exit 0 with no dist diff; npm audit --audit-level=high exit 0. Non-blocking: recommended — trim the 15-line head comment of test/e463-release-gh-checks.test.mjs (agc check comments advisory); optional — a few // summary lines over 80 columns, consistent with the file. review_report: review_reports/review_T-E463-01.md

