covers: T-E320-01, T-E319-01, T-E317-01, T-E320-02

# QA review — T-E320-02 (covers T-E320-01, T-E319-01, T-E317-01)

Spec: specs/e320-ci-check-sha-and-small-fixes.md. Lane base cac3036. Code-review APPROVED (review_reports/review_T-E320-01.md, review_T-E319-01.md, review_T-E317-01.md; sr commits f4ef626..c373650).

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared; mode no-design). Copy audit (3a): the two Copy/Strings entries are emitted by the script — `FAIL: CI ground-truth`, `no completed CI run`, 12-char sha, and `--sha` + value all appear verbatim in stderr and are matched by the tests below. Visual audit (3b): N/A.
Phase 3: test placement used the dispatch brief's pre-authorized files (new `test/e320-ci-check-sha.test.mjs`; appended cases to the three named files). `test/verify-release.test.mjs` was NOT edited.

## Tests added

- test/e320-ci-check-sha.test.mjs (new, 15 tests): real script in a throwaway git fixture (main checked out + a lane branch commit), PATH shims for `gh` (argv log + per-call responses + exit codes) and a logging `git` wrapper; poll budgets 0-30 s with no wall-clock assertion.
- test/source-credibility-gate.test.mjs (+5), test/visual-evidence-gate.test.mjs (+5): E319 cases.
- test/e303-zod-boundary-telemetry.test.mjs (+3): E317 cases.

## AC to test map

| AC | test (title prefix) | result |
|---|---|---|
| AC-E320-1 | `E320 AC-E320-1/3: green run on another branch` — argv has `--commit <full 40-hex sha>`, no `--branch`, `--workflow CI` | pass |
| AC-E320-2 | `E320 AC-E320-2: red run` — exit 1, stderr FAIL + `failure` + 12-char sha, stdout lacks PASSED | pass |
| AC-E320-3 | same green test — exit 0, `CI-CHECK PASSED (<sha12>)` | pass |
| AC-E320-4 | 4 tests: empty list budget 0 -> FAIL `no completed CI run`, no `graceful degradation`; only other-sha runs -> FAIL; `[]` then success with a 30 s budget -> PASSED and >= 2 gh calls (poll); `[]` forever with 3 s budget -> FAIL after >= 2 gh calls | pass |
| AC-E320-5 | abbreviated 7-char `--sha` -> shim keyed on full sha matches, stdout `CI-only check (lenient) for <resolved sha12>`, argv has full sha; `--sha deadbee` -> exit 1, stderr names `deadbee` and `--sha`, gh never called | pass |
| reviewer must-tests | `--sha ""` -> exit 1, gh never called; `--sha -x` -> exit 1, git log lacks `-x`, gh never called | pass |
| AC-E320-6 | `--sha` + gh non-array JSON -> lenient WARN with `graceful degradation, E14`, exit 0; gh exit 1 -> lenient WARN exit 0, `--strict` -> FAIL exit 1; gh not on PATH -> lenient WARN exit 0 | pass |
| AC-E320-7 | no-`--sha` `--ci-check` still queries `--branch main`, no `--commit`, empty list still WARN exit 0 (new test); plus `git diff cac3036 -- test/verify-release.test.mjs` is empty (below) | pass |
| AC-E320-8 | `git diff cac3036 --stat -- test/verify-release.test.mjs` prints nothing, so no line of that file was touched. Note: the file carries no test with "E238" in its name (the only E238-named file text is in test/e295-hop-cap-and-sop-halves.test.mjs), so there are no E238 names to quote from it. | verified |
| AC-E320-9 | `E320 AC-E320-9: detached HEAD + --sha` — green -> exit 0 and no `detached HEAD` text; red -> exit 1 | pass |
| AC-E319-1 | source-credibility `E319 AC-E319-1/3: image (no Figma)` — mode image, ok true, with a non-compliant audited figma row that would fire if mis-parsed as figma | pass |
| AC-E319-2 | visual-evidence `E319 AC-E319-2: mode: no-design (no Figma)` — mode no-design, required false | pass |
| AC-E319-3 | both consumers: visual arm `image (no Figma)` -> image/required true; source-credibility `no-design (no Figma)` -> no-design/dormant | pass |
| AC-E319-4 | multi-mode `paper / figma` -> paper in both consumers (leftmost wins) | pass |
| AC-E319-5 | existing cases unmodified and green; added backtick + trailing prose (`` `pdf` — exported from Figma `` -> pdf) in both files; unknown mode `freehand` -> null/required false; plain `figma` still arms and fires | pass |
| AC-E319-6 | `git diff cac3036 --stat -- gates/ dist/gates/` lists only gates/visual.ts and dist/gates/visual.{js,js.map,d.ts.map} (4 files) — checked once here, not a resident assertion | verified |
| AC-E317-1 | e303 file: `<ws>/.current` and `<ws>/.current/` + bad tier -> error matches DISPATCH_PIN_TIER_REJECTED, `<ws>/.current/.current` absent | pass |
| AC-E317-2 | existing E303-E2E1/E2E2 unmodified and green; added normal-workspace emit test (count 1 under fired) | pass |

## Negative control (scratch copy of cac3036 outside the worktree, no git stash)

Ran the new/extended test files against the base tree (`git archive cac3036`, scratch copy under $TMPDIR). First run (e320 + source-credibility + visual-evidence files): 18 failures on base — 10 in test/e320-ci-check-sha.test.mjs (by-commit query, empty-list FAIL x2, poll-then-success, poll-exhausted, abbreviated sha, unresolvable sha, `--sha ""`, `--sha -x`, detached HEAD), 4 in source-credibility (image/no-design negation, multi-mode, backtick) and 4 in visual-evidence (same shapes); the remaining new tests are pins of behavior that is intentionally unchanged (no-`--sha` path, gh-unavailable/strict cases, plain `figma` still arms). Second run (e303 file): the two E317 `.current` tests (bare + trailing slash) fail on base because the stray `.current/.current/_primary/telemetry.jsonl` is created, and pass on the lane; the normal-workspace and E2E tests pass on both. The new tests therefore detect the defects and are not vacuous.

## AC Execution Log (Phase 3.5, proofs declared in the spec)

| AC | command | output | verdict |
|---|---|---|---|
| AC-E320-1..6, 9 | `node --test test/e320-ci-check-sha.test.mjs` | 15 tests, 15 pass, 0 fail | pass |
| AC-E319-1..5 | `node --test test/source-credibility-gate.test.mjs test/visual-evidence-gate.test.mjs` | all pass, 0 fail (the combined run of these two files, the e303 file's pre-E317 tests and the e320 file reported `# pass 91 # fail 0`) | pass |
| AC-E317-1..2 | `node --test test/e303-zod-boundary-telemetry.test.mjs` | 5 tests, 5 pass (E2E1, E2E2, 2x AC-E317-1, AC-E317-2) | pass |
| AC-E320-7 | `git diff cac3036 --stat -- test/verify-release.test.mjs` | empty output (file untouched, so every pre-existing VR test is unmodified) | pass |
| AC-E319-6 | `git diff cac3036 --stat -- gates/ dist/gates/` | 4 files: gates/visual.ts, dist/gates/visual.{d.ts.map,js,js.map} | pass |
| AC-LANE-3 | review of the new tests | no real `specs/fanout-*.md` content and no fixed-base sha diff is asserted | pass |

## Security smoke

Boundary inputs exercised for `--sha`: empty string, single-dash value (`-x`), unresolvable hex (`deadbee`), abbreviated sha, ref-like values are resolved through git only; oversized/special characters were covered by the reviewer's probes (`HEAD --all` as a single argv element -> unresolvable FAIL). gh and git were never handed the dash-led value (asserted via the logging git wrapper and gh argv log).

## Coverage

Line coverage not measured (no coverage tooling in `npm test`); instead every changed branch is hit: byCommit query, resolve success/failure/empty/dash-led, poll-then-success, poll-exhausted FAIL, non-array WARN, gh-exit lenient/strict, ENOENT, detached HEAD; parseDesignMode leftmost rule, negation, multi-mode, backtick, null; registry basename guard (bare + trailing slash).

## Review-report comment-check note

Reviewer's four advisory comment warnings (visual.ts:98, visual.ts ratio, verify-release.mjs:2, :381) are advisory only and out of QA scope.

## Full suite

Command: `node scripts/test-lock.mjs -- npm test`, run after the tests and evidence were committed, on a clean tree (no untracked files), on HEAD a08049c (the evidence-only commit that records this result follows it; it changes no code or test).

Result: tests 3213, pass 3210, fail 0, cancelled 0, skipped 3, exit 0. The 3 skips are the pre-existing loud-skips (no new skip introduced by this lane). Shared generated files (content/**, compose goldens, context-budget) unchanged and green; nothing re-baselined. E238-named timing tests: none exist in test/verify-release.test.mjs; that file has an empty diff against cac3036 and the whole file passed in this run.
