covers: T-E217-01, T-E217-02, T-E215-01, T-E217-03, T-E215-02

# QA review — e217-lane-lifecycle-gaps (E217 + E215)

Spec: specs/e217-lane-lifecycle-gaps.md. Code review: review_reports/review_T-E217-01.md (APPROVED, eedb644).
Judged: sr tasks T-E217-01, T-E217-02, T-E215-01. Authored: T-E217-03, T-E215-02.

## Phase 0.5
Phase 0.5: skipped (no expected-red manifest declared)

## Phase 1 / 1.5
Copy audit: spec strings e217.specs-harvest-line, e180 refuse line, e217.specs-symlink-refuse-line, e217.specs-read-fail-line, e217.specs-copy-fail-line, e217.usage-abandoned and e215.hooks-missing are asserted verbatim in the new tests (copy/read fail and symlink lines with escaped paths). No unlisted user-facing string observed.
Visual Tokens / Widgets: N/A. Phase 1.5: skipped (no Visual Baselines declared).

## Phase 3 — AC to test map
Test-file placement: creation pre-authorized by the dispatch brief (both new files).

| AC | test |
|---|---|
| AC-E217-1 | e217 "AC-E217-1" |
| AC-E217-2 | e217 "AC-E217-2" |
| AC-E217-3 | e217 "AC-E217-3" |
| AC-E217-4 | e217 "AC-E217-4" (qa file, backlog, history, branch head, worktree unchanged) |
| AC-E217-5 | e217 "AC-E217-5" x2 (identical dest; failing .current harvest then fixed re-run) |
| AC-E217-6 | e217 "AC-E217-6" |
| AC-E217-7 | e217 "AC-E217-7" |
| AC-E217-8 | e217 "AC-E217-8" |
| AC-E217-9 | e217 "AC-E217-9" x5 (harvest line, differs refusal, symlink refusal, copy-fail, read-fail) |
| AC-E217-10 | test/e213-shipped-ignored-shape.test.mjs unmodified, passes |
| AC-E217-11 | test/e180-abandoned-harvest.test.mjs unmodified, passes |
| AC-E217-12 | e217 "AC-E217-12" |
| AC-E215-1..5 | e215 "AC-E215-1", "-2" (a-e), "-3", "-4" (4 refusals), "-5" |
| AC-E215-6 | e215 "AC-E215-6" via a PATH git shim returning exit 2 for `config --get core.hooksPath` (forced, not review-only) |
| AC-E215-7 | test/e291-start-link-locations.test.mjs unmodified, passes |
| AC-E215-8 | grep of `git diff e5f325d...HEAD -- bin/agc-init.mjs` prints nothing |

New tests: test/e217-abandoned-specs-harvest.test.mjs 15/15; test/e215-start-hooks-path.test.mjs 13/13.
Unmodified suites e213 + e180 + e291: 68/68. No existing test re-pinned. Fixtures are hermetic (os.tmpdir, runtime-built).
Chmod-based cases skip when running as root. Coverage tooling not measured; every new branch of the two features has at least one test.

## Phase 3.5
Phase 3.5: ACs carry proof: annotations; executed above. Each proof's test or grep ran green.

## AC Execution Log
- AC-E217-1..9, 12: `node --test test/e217-abandoned-specs-harvest.test.mjs` -> 15 pass, 0 fail.
- AC-E217-10: `node --test test/e213-shipped-ignored-shape.test.mjs` pass; file not in `git diff e5f325d...HEAD --name-only`.
- AC-E217-11: `node --test test/e180-abandoned-harvest.test.mjs` pass; unmodified.
- AC-E215-1..6: `node --test test/e215-start-hooks-path.test.mjs` -> 13 pass, 0 fail.
- AC-E215-7: `node --test test/e291-start-link-locations.test.mjs` pass; unmodified.
- AC-E215-8: `git diff e5f325d...HEAD -- bin/agc-init.mjs | grep -nE '^\+.*(execFileSync|spawnSync|execSync|spawn)\(\s*"(npm|npx|pnpm|yarn|husky)"'` -> no output, exit 1.
- AC-LANE-2: changed paths = bin/agc-init.mjs, specs/e217-lane-lifecycle-gaps.md, review_reports/review_T-E217-01.md, .current/e217/** (before this hop's tests/report) — all owned.
- AC-LANE-3: no path under tools, dist, docs, schema.
- AC-LANE-1: see Phase 4.

## Phase 4 — full suite
`node scripts/test-lock.mjs -- npm test` on HEAD a9c1909, clean tree: 3716 pass / 1 fail / 2 skipped of 3719.
The single red: test/e177b-mailbox-watch.test.mjs "AC17: a second, independent mailbox-watch process ... refuses to start" (waitFor: timed out). Unrelated to this lane (mailbox watcher; no mailbox file touched by the lane diff); run on its own it passes 22/22. Disposition: load-induced timing flake in a full-suite run.

Verdict: PASS. No required findings. Non-blocking: code-reviewer's note about trimming the 11-line laneHooksPathWarning comment stands.
