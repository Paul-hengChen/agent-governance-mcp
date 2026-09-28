# QA Review — T-E145-01 / T-E145-02

covers: T-E145-01, T-E145-02

Feature: `e145-md-tables-cited-donemark` · lane `<lanes-root>/e145` ·
branch `feat/e145-md-tables-cited-donemark` · base `e1d62e2`.

## Phase 0 — Claim

`tw_get_state` confirmed `(code-reviewer, In_Progress) -> (qa-engineer, In_Progress)`,
`review_verdict: APPROVED`, `cut_approved: true`. `tw_detect_drift` returned clean
(no drift). Claimed review of T-E145-01 (sr-engineer's, already implemented and
APPROVED) and T-E145-02 (this round: test authorship).

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e145-md-tables-cited-donemark.txt` manifest
declared; this is feature-mode, non-red work).

## Phase 1 — Review

Read `review_reports/review_T-E145-01.md` in full (code-reviewer round 1,
APPROVED) and the diff itself (`scripts/check-md-tables.mjs`,
`findCitationQuoteRanges()` + its wiring into `findGenuineDoneMark()`).
Per this role's scope (QA rejects only for failing tests / missing coverage /
test-infra defects — correctness and architecture are code-reviewer's job and
were already APPROVED), this round did not re-litigate C1-C7/Q1-Q5/P1: it
verified the fix behaves exactly as the report measured, then closed the
report's own named gap (zero direct test coverage on the new function).

Confirmed the coordinator's forensics independently by re-running the real
corpus (see Phase 4): the 4 genuine buried marks are E39 (`:165`), E40 (`:166`),
E58 (`:180`), E59 (`:181`) — `:181` is E59's own close-out mark (same version
`v3.99.0` AND same commit `25d231e` as its own last cell), not a citation of
E57 (which shipped `v3.98.0`). The one false positive is E145's own row
(`:267`), which quotes E59's mark inside a `*"…"*` citation span — exactly the
shape the fix now excludes.

Confirmed the post-review comment-only round is byte-identical in executable
lines to what code-reviewer approved: the Q1 label at `scripts/check-md-tables.mjs`
around the unpaired-opener branch now correctly says the candidate "falls
through ... and a qualifying one still ADVISES" (not "SILENCE"), and the C3/C4
residuals are recorded in the comment block above `findCitationQuoteRanges()` —
matching the code-reviewer's Q1/Q2 asks. No executable-line diff from the
reviewed version.

## Phase 1.5 — Visual Compare

Skipped (no `design/<feature>.md`, no Visual Baselines H2 — this is a lint
script change, not a UI feature).

## Phase 3 — Tests

**Test File Placement**: per this dispatch's explicit brief ("extend the
EXISTING `test/check-md-tables.test.mjs`, its `mkFixtureRepo` harness — do not
create a new test file"), all 10 new cases were added to
`test/check-md-tables.test.mjs`, using the file's own `mkFixtureRepo` /
`run()` helpers and its established ticket-table fixture shape
(`id | desc | priority | depends_on | est. files | design-link`).

**Spec-to-Test Map**: no `specs/e145-*.md` exists (mini-chain, the backlog row
is the spec — confirmed by code-reviewer's Architecture section). The
authoritative case list is code-reviewer's "Required follow-through for
qa-engineer" section in `review_reports/review_T-E145-01.md`. All 9 named
cases, plus the report's non-regression ask, were authored:

| report case | test name | asserts |
|---|---|---|
| 1. CQ-CITED-MARK-SUPPRESSED | `CQ-CITED-MARK-SUPPRESSED` | mark only inside `*"…"*` -> no advisory |
| 2. CQ-MULTI-CANDIDATE | `CQ-MULTI-CANDIDATE` | citation-excluded 1st candidate does not stop the scan; 2nd, genuine candidate fires |
| 3. CQ-GENUINE-OUTSIDE-QUOTE | `CQ-GENUINE-OUTSIDE-QUOTE` | genuine mark between two citation spans still fires |
| 4. CQ-UNPAIRED-OPENER | `CQ-UNPAIRED-OPENER` | unpaired `*"` opener yields no range -> candidate still fires (guards the Q1 label correction) |
| 5. CQ-CELL-START / CQ-CELL-END | `CQ-CELL-START`, `CQ-CELL-END` | citation span at offset 0 / at cell end still recognized -> no advisory |
| 6. CQ-ESCAPED-PIPE-IN-CITATION | `CQ-ESCAPED-PIPE-IN-CITATION` | escaped `\|` inside a citation span: one cell, no rule-1 violation, no advisory |
| 7. CQ-BOLD-RUN-NOT-AN-OPENER | `CQ-BOLD-RUN-NOT-AN-OPENER` | `**"…"**` costume NOT excluded -> still fires (pins C4 residual as intended) |
| 8. CQ-RESIDUAL-SPAN-SWALLOW | `CQ-RESIDUAL-SPAN-SWALLOW` | opener inside a code span + distant `"*` -> over-broad range, SILENT today (pins C3 as a recorded residual) |
| 9. Non-regression (row identity, not line number) | `CQ-9` | real `docs/backlog.md`: exit 0, advises on E39/E40/E58/E59 rows (looked up live by `^\| <id> \|`), silent on the E145 row |

**Coverage Gate**: `findCitationQuoteRanges()` (the only new function in this
diff) now has direct positive AND negative coverage for every branch
code-reviewer's report exercised by hand: matched pair at cell start, matched
pair at cell end, matched pair mid-cell with a genuine mark inside/outside/
between spans, unpaired opener (no range), and the two named residuals (C3
swallow, C4 narrow predicate) pinned as tests so a future change to either
must deliberately flip the corresponding test rather than regress silently.
Line-coverage tooling is not wired into this repo's `npm test`; noted per SOP
6c ("if tooling can't measure, note explicitly").

**Security Smoke**: boundary shapes already covered by the existing CS-* block
(empty cell paths, unmatched delimiters) apply identically here; `CQ-ESCAPED-PIPE-IN-CITATION`
adds the escape+citation boundary interaction. No new I/O or external input is
introduced by this diff (code-reviewer's Security section already confirmed
this; unchanged).

## Phase 3.5 — AC Execution Log

Skipped (no `specs/e145-md-tables-cited-donemark.md` — this feature has no
spec file at all, mini-chain with the backlog row as spec; the `proof:`
annotations in `specs/e88-e105-md-table-checker.md` belong to the prior
E88/E105 feature, not `active_feature` for this round).

## Phase 4 — Run

- **Targeted**: `node --test test/check-md-tables.test.mjs` -> **49/49 pass**
  (39 pre-existing + 10 new: the 9 `CQ-*` cases + `CQ-9`).
- **Build**: `npm run build` -> clean (`check:version` OK 3.112.0,
  `tsc` clean, `check:transitions-sync` OK 21 keys).
- **Full suite**: `npm test` was run once as instructed and returned
  2107/2110 pass, 3 unrelated failures; a direct `node --test test/*.test.mjs`
  re-run (same built `dist/`, no `pretest` rebuild) immediately after came
  back **2110/2110 pass, 0 fail** — the 3 failures did not reproduce and this
  lane's `git status` shows only `scripts/check-md-tables.mjs`,
  `test/check-md-tables.test.mjs`, `tasks.md`, `.current/handoff.md`, and
  `.current/telemetry.jsonl` touched, none of which are in this repo's HTTP/
  concurrency-sensitive surface. Attributed to host-level flakiness (three
  other governance sessions are live on this same host) rather than a
  regression from this diff; recorded here rather than silently dropped,
  per this file's own "record, don't hide" convention. Baseline (2100/2100)
  + 10 new = 2110, matching the clean rerun exactly.
- **`npm run check:md-tables`** (real corpus, this lane's `docs/backlog.md`):
  exit 0, `249 file(s) scanned, 0 malformed tables`, exactly 4 advisories —
  `docs/backlog.md:165`, `:166`, `:180`, `:181` — and `:267` (E145's own row)
  silent. Matches code-reviewer's independently re-derived measurement
  exactly.
- **`npm audit --audit-level=high`**: exit 0. 6 findings, all moderate/low
  (hono/node-server, body-parser, esbuild, hono, protobufjs, qs) — zero
  HIGH/CRITICAL, so no Constitution §6 disposition is required.

## Verdict

**PASS.** Code-reviewer's APPROVED verdict stands; this round closes the
report's own named gap (zero direct coverage on `findCitationQuoteRanges()`)
with all 9 requested cases plus the row-identity non-regression check, all
green, full suite green on re-run, build clean, real-corpus check exits 0
with exactly the 4 true positives and the one false positive silenced,
`npm audit` clean of HIGH/CRITICAL.
## 2026-09-18T07:18:20.914Z — PASS — by qa-engineer

PASS. code-reviewer's APPROVED verdict for T-E145-01 (findCitationQuoteRanges() exclusion fix, scripts/check-md-tables.mjs) stands unchanged — post-review comment-only correction (Q1 label fix + C3/C4 residuals recorded) verified byte-identical in executable lines to the reviewed diff. T-E145-02: authored all 9 CQ-* cases named in review_reports/review_T-E145-01.md's "Required follow-through for qa-engineer" plus a row-identity (not line-number) non-regression case, extending the existing test/check-md-tables.test.mjs per dispatch brief (mkFixtureRepo harness, no new test file). node --test test/check-md-tables.test.mjs: 49/49 pass (39 pre-existing + 10 new). npm run build clean. Full npm test: first run 2107/2110 (3 unrelated failures, host-level flakiness with 3 other live governance sessions, no touched files in that surface); immediate node --test re-run on same dist/: 2110/2110 clean, matching baseline 2100 + 10 new exactly. npm run check:md-tables on real corpus: exit 0, 249 files scanned, 0 malformed tables, exactly 4 advisories (docs/backlog.md:165/166/180/181 = E39/E40/E58/E59), :267 (E145's own row) silent — matches code-reviewer's independently re-derived measurement. npm audit --audit-level=high: exit 0, 6 findings all moderate/low, zero HIGH/CRITICAL, no Constitution §6 disposition needed. Evidence: qa_reports/review_T-E145-02.md (covers T-E145-01, T-E145-02).

