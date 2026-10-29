# QA review — T-E366-02, T-E161-03, T-E184-02, T-E161-04

covers: T-E366-02, T-E161-03, T-E184-02, T-E161-04, T-E161-01, T-E366-01, T-E161-02, T-E184-01

## Per-id verdicts (build tasks verified through the ACs they implement)

- T-E161-01: PASS. AC-E161-1 (`grep -n "D-E161"` on the architecture doc prints lines; D-E161 confirmed, four checks answered).
- T-E366-01: PASS. AC-E366-1..4 in `test/e366-sqlite-rejected-write-evidence.test.mjs`; AC-E366-5 named existing tests green unmodified.
- T-E161-02: PASS. AC-E161-2..9 in `test/e161-qa-suite-result.test.mjs`; AC-L1 pipeline-order and error-code-contract green.
- T-E184-01: PASS. AC-E184-1..3 in `test/e184-get-state-omits-tier.test.mjs`; AC-E184-4 dispatch-log and dispatch-mechanism green.

Lane `e161`, feature `e161-qa-claim-and-state-reads`. Code review APPROVED round 1 (`review_reports/review_T-E366-01.md`). Tests run against the lane's built `dist/` (`npm run build` first, clean).

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared; no-design mode). Copy Audit (3a): the three Copy/Strings entries (`e161.suite-line`, `e161.suite-line-cmd`, `e161.schema-desc`) are pinned verbatim by AC-E161-2/3/8/9. Visual Audit (3b): N/A (no visual literals). Phase 3 placement: the dispatch brief pre-authorized the three new test files and a retitle-only edit of RT2.

## Spec-to-Test Map

| AC | verdict | evidence |
|---|---|---|
| AC-E366-1 | PASS | `test/e366-sqlite-rejected-write-evidence.test.mjs` AC-E366-1 (MISSING_EVIDENCE rejection; pre-existing row kept, rejected T1 row gone, `hasEvidence(T1)` still missing) |
| AC-E366-2 | PASS | same file, AC-E366-2 (injected `writeState` throw, PASS and FAIL; error propagates; rows equal pre-write) |
| AC-E366-3 | PASS | same file, AC-E366-3 (positive control: same-write evidence satisfies MISSING_EVIDENCE; rows remain) |
| AC-E366-4 | PASS | same file, AC-E366-4 (different `created_at` row untouched; edited row untouched; idempotent; closed database deletes nothing, never throws) |
| AC-E366-5 | PASS | e236 / qa-flow / sqlite-versioning / qa-review-scoped-append run green, unmodified (see log) |
| AC-E161-1 | PASS | architecture doc has `## D-E161 — confirmed` and answers the checks |
| AC-E161-2 | PASS | `test/e161-qa-suite-result.test.mjs` AC-E161-2 (line, blank line, trimmed text, server line before any qa subsection; heading/header equal `recordReviewInFile` output; FAIL also recorded) |
| AC-E161-3 | PASS | same file, AC-E161-3 (SQLite notes with and without `command`, every row) |
| AC-E161-4 | PASS | same file, AC-E161-4 (file bytes equal `recordReviewInFile` for untrimmed notes; SQLite notes equal `qa_review` verbatim) |
| AC-E161-5 | PASS | same file, AC-E161-5: 23 malformed values through `TOOL_REGISTRY` zod, each names `qa_suite_result`, no gate code, handoff and evidence byte-unchanged; two boundary positives accepted (see OQ-1 list below) |
| AC-E161-6 | PASS | same file, AC-E161-6 (non-qa agent, qa In_Progress, qa PASS without qa_review: same accept/reject and envelope with and without the field; a write rejected for other reasons rejects identically; field never in the handoff) |
| AC-E161-7 | PASS | same file, AC-E161-7 (file: EXPECTED_RED_DIFF_MISSING leaves the evidence directory byte-identical; SQLite: MISSING_EVIDENCE leaves no row) |
| AC-E161-8 | PASS | same file, AC-E161-8 (2144/2146 and 0/3 recorded verbatim, not rejected; both modes) |
| AC-E161-9 | PASS | same file, AC-E161-9 (type object, required passed/total, `additionalProperties: false`, description states recorded / not persisted / gates nothing / attested) |
| AC-E184-1 | PASS | `test/e184-get-state-omits-tier.test.mjs` AC-E184-1 (tier key absent; every other key including `dispatch_mechanism` deep-equals `storage.readState`; file bytes and `readHandoffState` still carry the tier) |
| AC-E184-2 | PASS | same file, AC-E184-2 (no tier, file and SQLite: byte-identical text; a note that merely mentions the name is left alone) |
| AC-E184-3 | PASS | same file, AC-E184-3 (out-of-enum pin: advisory exactly as before, tier omitted) |
| AC-E184-4 | PASS | `test/dispatch-log.test.mjs` unmodified green; `test/dispatch-mechanism.test.mjs` assertions unchanged green |
| AC-L1 | PASS | e35-pipeline-order and error-code-contract green, unmodified |
| AC-L2 | PASS | `git diff --stat f5485a7 -- schema docs/schema-versions.md` printed nothing |
| AC-L3 | PASS | `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e161` exit 0, 29 files changed, 0 out of bounds |
| AC-L4 | PASS | full suite on a clean tree, see Lane close |

OQ-1 malformed `command` values (all written as `\u` escapes in the test source): LF, CR, CRLF, tab, NUL, ESC, US (C0 controls), DEL, U+0085, U+2028, U+2029, empty, spaces only, 201 characters. The committed file was scanned for raw U+0085 / U+2028 / U+2029 / control bytes and has none; a hygiene test in the file keeps checking this. Note for the integrator: the editor tool in this environment did rewrite the U+0085 / U+2028 / U+2029 escapes into raw characters on the first write; they were restored to `\u` escapes with a byte-level replacement before commit.

## RT2 retitle

`test/dispatch-mechanism.test.mjs` RT2: name and two assertion messages now say "library read (readHandoffState)" instead of "tw_get_state-equivalent read", since `tw_get_state` no longer surfaces the tier. Assertions unchanged (3 lines changed in the diff).

## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC-E161-1 | `grep -n "D-E161" specs/e161-qa-claim-and-state-reads-architecture.md` | prints lines 7, 9, 363 | pass |
| AC-E161-2..9 | `node --test test/e161-qa-suite-result.test.mjs` | 9 tests, 9 pass, 0 fail | pass |
| AC-E184-1..3 | `node --test test/e184-get-state-omits-tier.test.mjs` | 3 tests, 3 pass, 0 fail | pass |
| AC-E366-1..4 | `node --test test/e366-sqlite-rejected-write-evidence.test.mjs` | 4 tests, 4 pass, 0 fail | pass |
| AC-E366-5, AC-E184-4, AC-L1 | `node --test` on e184, dispatch-log, dispatch-mechanism, e236, qa-flow, sqlite-versioning, qa-review-scoped-append, e35-pipeline-order, error-code-contract | 224 tests, 224 pass, 0 fail | pass |
| AC-L2 | `git diff --stat f5485a7 -- schema docs/schema-versions.md` | empty | pass |
| AC-L3 | `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e161` | exit 0; 29 files, 0 out of bounds | pass |
| AC-L4 | `node scripts/test-lock.mjs -- npm test` | exit 0; tests 3767, pass 3765, fail 0, skipped 2 | pass |

## Lane close

- Full suite run on HEAD 22f03f8 (the tests commit), tree clean (`git status --porcelain` empty) before the run: `# tests 3767`, `# pass 3765`, `# fail 0`, `# skipped 2`, exit 0. Commits after 22f03f8 add only this report and `.current/e161/` bookkeeping.
- No red test, so nothing outside the spec's expected-hits list went red; no test other than the RT2 retitle was modified.
- `npm audit --audit-level=high`: no high or critical findings (7 vulnerabilities: 1 low, 6 moderate); exit 0.
- Coverage: the new tests drive the real orchestrator, registry zod boundary and both storage backends; line coverage tooling was not run (not available in this repo's test setup).
- Negative control (break the code, see a test fail) was not run for this round; the reviewer verified the source and the positive/negative pairs inside each test (for example AC-E366-1 asserts the pre-write rows, so a missing undo leaves a T1 row and fails).
- Doubtful: none.
## 2026-10-29T08:26:31.551Z — PASS — by qa-engineer

PASS for T-E366-02, T-E161-03, T-E184-02, T-E161-04 (lane e161). New tests: e366-sqlite-rejected-write-evidence (4/4), e161-qa-suite-result (9/9, includes every OQ-1 malformed command class as \u escapes, no raw U+0085/U+2028/U+2029), e184-get-state-omits-tier (3/3). AC-E366-5, AC-E184-4, AC-L1 named existing tests green unmodified (RT2 retitled only, assertions unchanged). AC-L2 empty diff; AC-L3 fanout check exit 0. Full suite via test-lock on clean-tree HEAD 22f03f8: 3765/3767 pass, 0 fail, 2 skipped, exit 0. npm audit --audit-level=high: no high/critical (1 low, 6 moderate). Details and AC Execution Log in qa_reports/review_T-E366-02.md.

