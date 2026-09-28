covers: T-E178B-05

# QA review — T-E178B-05 (fanout E208 tests + whole-ticket gate)

The full Phase 0.5–3.5 record for the whole ticket (T-E178B-01..05), including the Copy Audit, Spec-to-Test map, mutation checks, coverage and the AC Execution Log for AC1–AC19, is in `qa_reports/review_T-E178B-04.md`. This file records the AC16–AC19 tests authored under this task and the post-commit whole-ticket gate (AC20, AC21).

## Tests authored (T-E178B-05)
`test/e178b-fanout-unmatched.test.mjs` contains:
- `AC16 unmatched exact token warns`
- `AC17 no false warnings`
- `AC18 exit codes and line order`
- `AC19 E208 regression`

It uses the fixture `test/fixtures/e178b/fanout-wave7-e177a.md`, a verbatim copy of wave7's e177a row; `specs/fanout-*.md` was not edited. `test/e177a-*` is unchanged and green.

Commits:
- 7833500 — lane-status tests, fixtures and review_T-E178B-04.md. Its title also names the fanout tests, but that file actually landed in 41db8c9.
- 41db8c9 — fanout tests.
- 6dc50a2, abeb4e9 — lane bookkeeping.

## AC Execution Log (whole ticket, post-commit)
- **AC20.** Command: `cd <lanes-root>/e178b && npm run build && git status --porcelain dist/ && npm test`.
  - The run was at HEAD abeb4e9, on a clean tree: `git status --porcelain --untracked-files=all` printed 0 lines before the run and 0 after it.
  - `npm run build` exited 0 (tsc, then `check:transitions-sync — OK`).
  - `git status --porcelain dist/` was empty, so `dist/` matches a fresh build.
  - `npm test` (run 1 of 1) finished with **2778/2778 pass, 0 fail, exit 0** (duration about 142 s). That is the previous 2754 plus the 24 new e178b tests. The run includes `test/e177a-*`, `test/e177b-*`, `test/lane-paths.test.mjs` (CALLERS allow-list unchanged) and `test/error-code-contract.test.mjs` (no new code literal).
  - Concurrency record for the known flake (integrator to-lane#2, E178B-NEW-2):
    - Just before this run, e130's own `npm test` (pid 34458, cwd `<lanes-root>/e130`) was in flight. I waited for it to exit (about 60 s) before starting, and `ps` showed no e130 test process at start.
    - From t+50 s onward, one `node --test` process with cwd `<repo-root>` (primary) ran concurrently. No e130 process appeared during the run.
    - The flaky `e177b-test-lock` AC10/AC13b and `e177b-mailbox-watch` AC17 tests all passed in this run. No flake was observed and none was re-run.
  - Verdict: PASS.
- **AC21.** Command: `node scripts/fanout.mjs check specs/fanout-wave7.2.md e178b --base 121ddc8`.
  - Output: `fanout check: e178b — 31 file(s) changed, 0 out of bounds`, then the E158 and prose notes. There were 0 `WARN` lines and exit 0.
  - Verdict: PASS.
## 2026-09-27T08:03:35.441Z — PASS — by qa-engineer

PASS — AC1-AC21 all satisfied. New test/e178b-lane-watch.test.mjs (AC1-AC9, AC15; 12 tests), test/e178b-cut-prereview.test.mjs (AC10-AC14 + 2 security smokes), test/e178b-fanout-unmatched.test.mjs (AC16-AC19), fixtures under test/fixtures/e178b/ (mailbox corpus copies + verbatim copy of wave7's e177a row); 24/24, mutation-checked (fold removal, recognizer widening, delta order, --full-tree removal, added-file exemption removal all turn tests red). Copy Audit: every Copy/Strings row verbatim incl. round-1 fold (watch cut_prereview=sent_(to-integrator#<seq>), one-shot 'cut pre-review: sent (to-integrator#<seq>)'); stderr/error-path diagnostics judged outside the rendered-text contract (fanout degrade-path 'note: ... existence check skipped' surfaced for E178a). Visual N/A. Phase 0.5/1.5 skipped (no manifest/baselines). Coverage lane-status.js 94.9% / fanout-manifest.js 93.4% line. Decision (j) byte-identity vs 121ddc8 dist confirmed for every non-watch one-shot/rollup/json mode and fanout check. AC20: clean tree at abeb4e9, npm run build exit 0, dist porcelain empty, npm test 2778/2778 exit 0 (run 1; e130 test run waited out before start, no flake observed). AC21: fanout check e178b --base 121ddc8 -> 0 out of bounds, 0 WARN, exit 0. Evidence: qa_reports/review_T-E178B-04.md (covers 01-05, AC Execution Log), qa_reports/review_T-E178B-05.md (AC20/AC21).

