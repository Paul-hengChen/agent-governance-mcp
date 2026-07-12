# Review — T-E11E12-03

covers: T-E11-01, T-E12-01, T-E11E12-02, T-E11E12-03

## Summary
QA verification pass on the `e11-e12-release-integrity-batch` implementation
(E11 — `scripts/check-version.mjs` dist/index.js parity check; E12 —
`tools/metrics.ts` per-release dedupe guard), following code-reviewer's
APPROVED verdict (`review_reports/review_T-E11E12-02.md`, covering
T-E11-01/T-E12-01/T-E11E12-02). QA's job on this batch is test authorship
(AC5, AC13) plus full regression — code-reviewer already owns correctness/
architecture/security/performance sign-off and found zero findings.

Verdict: **PASS**.

## Phase 0.5 — Expected-Red Diff
Skipped (no expected-red manifest declared) — no
`qa_reports/expected-red_e11-e12-release-integrity-batch.txt` exists, and
`dispatch_mode` is absent (default feature mode) on the handoff state. Zero
overhead per the SOP's non-red-feature branch.

## Phase 1 — Review
Read both implementation diffs directly (`scripts/check-version.mjs` lines
33-66 for the new dist-parity block; `tools/metrics.ts` lines 72-104 for the
dedupe guard) against `specs/e11-e12-release-integrity-batch.md` AC1-AC12.
Matches the code-reviewer's account exactly: E11's dist check sits additively
between the index.ts assertion and the CHANGELOG check with no behavior
change to the pre-existing checks; E12's guard sits entirely inside
`emitFeatureMetrics`'s outer never-throw `try`, keyed on the
`(feature, released_version)` pair with `null` as a real key (not a
wildcard), and never rewrites/truncates `.current/metrics.jsonl`. No new
findings — code-reviewer's APPROVED stands.

### Copy Audit Gate
N/A — spec's Copy/Strings table is explicitly "N/A ... developer/CI-facing
tooling output, not product copy." No gate to run.

### Visual Audit Gate
N/A — spec's Visual Tokens/Visual Widgets tables are explicitly "N/A ...
feature has no visual literals / no non-visual widgets."

## Phase 1.5 — Visual Compare
Skipped (no `design/<feature>.md`, no Visual Baselines H2 — batch is
code+test only, no design-auditor routed per the spec's Dependencies
section).

## Phase 2 — Discussion
No issues found in Phase 1 — proceeded directly to Phase 3.

## Phase 3 — Tests

### Test File Discovery
- E11: no `test/check-version.test.mjs` existed prior to this task. Per the
  dispatch's explicit pre-authorization (tasks.md T-E11E12-03 / the approved
  cut), created **`test/check-version.test.mjs`** (new file) rather than
  asking first.
- E12: `test/success-metrics.test.mjs` (E8's suite) already exists and is the
  right home for the dedupe-guard tests — extended it in place rather than
  creating a parallel file.

### Spec-to-Test Map

| AC | Test(s) | File |
|---|---|---|
| AC1 (dist matches — exit 0, existing checks unchanged) | CV-1 | test/check-version.test.mjs |
| AC2 (dist mismatch — exit non-zero, names both versions) | CV-2 | test/check-version.test.mjs |
| AC3 (dist parse-fail — exit non-zero, fail loud) | CV-3 | test/check-version.test.mjs |
| AC3 (dist absent — exit 0, skip note, no crash) | CV-4 | test/check-version.test.mjs |
| AC4 (success line unchanged; dist-parity line visible) | CV-1, CV-4 | test/check-version.test.mjs |
| AC7 (same feature+version dispatched twice -> 1 line) | E12-D1 | test/success-metrics.test.mjs |
| AC8 (version changes between dispatches -> 2 lines; cross-feature no collision) | E12-D2, E12-U2 | test/success-metrics.test.mjs |
| AC9 (null released_version dedupes against null only) | E12-U1 | test/success-metrics.test.mjs |
| AC10 (malformed pre-existing line doesn't crash the read; missing file = no records) | E12-D3, all D/U tests (missing-file case implicit in every first-emit) | test/success-metrics.test.mjs |
| AC11 (dedupe read failure fails OPEN — falls back to append) | E12-U3 | test/success-metrics.test.mjs |
| AC12 (existing duplicate records untouched) | verified directly — see below, not a unit test | — |
| AC6 (net-new (feature, version) pair appends unchanged) | pre-existing E8-E1/E8-E2 + E12-U2/D2 exercise this path | test/success-metrics.test.mjs |

### Coverage Gate
New/modified files: `test/check-version.test.mjs` (new, 100% of its own
assertions exercise the 4 branches of the new dist-parity block) and the
E12 additions to `test/success-metrics.test.mjs` (6 new tests covering every
branch of the dedupe guard: hit/skip, version-change/append, null-key,
cross-feature, malformed-line-skip, fail-open-on-read-error). Both source
files under test (`scripts/check-version.mjs`'s new block,
`tools/metrics.ts`'s dedupe block) are covered branch-by-branch;
`npm test`'s pass count moved from the pre-existing baseline to 1323/1323
with these tests included. Tooling doesn't emit a numeric coverage report
(no `c8`/`nyc` wired into this repo's `npm test`), noted explicitly per the
SOP's "if tooling can't measure, note explicitly" clause.

### Security Smoke Tests
- Boundary inputs: E11 tests exercise "file present but unparseable" (CV-3)
  and "file entirely absent" (CV-4) as the two edge shapes of the dist-parity
  input; E12 tests exercise malformed JSON (E12-D3), a `null` key (E12-U1),
  and an unreadable-file permissions failure (E12-U3, `chmod 0o200` —
  write-only, forcing `readFileSync` to throw `EACCES` while
  `appendFileSync` still succeeds, isolating the fail-open branch from the
  already-covered "file entirely unwritable" case in the code-reviewer's
  report).
- No auth/permission surface — neither ticket has access control; N/A.

## Test Design Notes (why, not just what)
- **check-version.mjs is not parameterized** — `root` is derived from
  `import.meta.url` (the script's own file location), not cwd/argv. Each
  test therefore copies the byte-for-byte real script into a fresh temp
  fixture root's `scripts/` dir alongside synthetic `package.json`/
  `index.ts`/`dist/index.js`, and spawns that copy — this drives the actual
  shipped logic rather than a reimplementation, while never touching the
  real repo's `package.json`/`index.ts`/`dist/index.js`. A sanity assertion
  at module load (`EXPECTED_REGEX_SOURCE` substring check) fails loudly if
  the real script's `Server()` regex ever drifts out from under the fixture
  builder, rather than the fixtures silently testing stale behavior.
- **E12-U3's fail-open isolation**: the naive approach (`chmod 0o000`) blocks
  BOTH read and write, which conflates "dedupe read fails, append still
  succeeds" (AC11's actual claim) with "file is entirely unwritable, record
  silently dropped" (a different, already-accepted environment-failure path
  per the code-reviewer's Performance section). Using `0o200` (write-only)
  isolates the read failure so `readFileSync` throws `EACCES` while
  `appendFileSync`'s `O_APPEND` open (write-permission only) still succeeds
  — this is what actually exercises the fail-open `catch` branch rather than
  accidentally hitting the "append also fails" branch. The assertion itself
  (`own.length === 1`) is written to hold under both root and non-root test
  runners: under root, permission bits don't block the read either, so the
  guard takes its normal (non-thrown) path and reaches the same correct
  outcome — the test verifies the *outcome* (record present exactly once),
  not which code path produced it, so it isn't flaky across sandboxes.
- **AC12 (pre-existing duplicates untouched)**: every E12 test uses an
  isolated `mkWs`/temp-fixture workspace (mirrors the existing E8 suite's
  pattern) — none touch the real repo's `.current/metrics.jsonl`. Verified
  directly post-run: `git status --short .current/metrics.jsonl` reports no
  changes; file still holds exactly the 2 pre-existing
  `e8-success-telemetry`/`3.74.0` duplicate records (ts ~06:28:03/06:28:25),
  byte-identical to before this task.

## Phase 4 — Run
- **Build**: `npm run build` — zero errors (prebuild's `check:version` also
  passes cleanly against the live repo, confirming E11's new dist-parity
  block doesn't regress the real checkout).
- **Audit**: `npm audit --audit-level=high` — exit 0. One low-severity
  finding (`esbuild` dev-dependency, Windows-dev-server-only advisory,
  below the `--audit-level=high` gate) — no high/critical findings.
- **Full suite**: `npm test` — **1323/1323 pass, 0 fail** (includes the 4 new
  `test/check-version.test.mjs` tests and the 6 new E12 tests appended to
  `test/success-metrics.test.mjs`).
- **CI runnability**: both new/extended test files run headlessly via
  `node --test`, no human interaction, consistent with the rest of `test/`.

## Verdict
**PASS** — AC1-AC13 all covered by tests that pass; AC12 verified untouched
directly; full regression green (build clean, audit clean at `--audit-level=
high`, 1323/1323 tests). No release bookkeeping performed here (version
bump / CHANGELOG / backlog done-marking is release-engineer's job,
post-PASS, per this role's Hard Rules).
## 2026-07-12T07:28:54.123Z — PASS — by qa-engineer

PASS — T-E11E12-03 (covers T-E11-01/T-E12-01/T-E11E12-02 per code-reviewer batch). New test/check-version.test.mjs (4 tests: CV-1..CV-4) covers E11 AC1-AC4/AC5 (dist match/mismatch/parse-fail/absent). Extended test/success-metrics.test.mjs (+6 tests: E12-D1..D3, E12-U1..U3) covers E12 AC6-AC12/AC13 (same-pair dedupe, version-change append, cross-feature no collision, null-key dedupe, malformed-line skip, fail-open on read error). AC12 verified untouched via git status. Full regression: npm run build clean, npm audit --audit-level=high exit 0 (1 low finding only), npm test 1323/1323 pass. Evidence: qa_reports/review_T-E11E12-03.md.

