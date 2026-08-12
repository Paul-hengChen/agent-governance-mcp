# QA Review — T-E53-01

covers: T-E53-01, T-E53-02, T-E53-03

## Round 1 — PASS — by qa-engineer

## Scope

E53 (backlog row, mini-chain — PM/architect skipped, the backlog row is the
spec). Pinned 4-file cut: `tools/transitions.ts`, `specs/qa-flow-enforcement-architecture.md`,
`content/skill-release-engineer.md`, `dist/tools/transitions.*` (T-E53-01/02,
sr-engineer, code-reviewer APPROVED round 1 per `review_reports/review_T-E53-01.md`)
plus the qa-engineer-owned test work (T-E53-03, this review).

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e53-blocked-reachability.txt` manifest —
feature-mode, the diff touches zero test files on the sr-engineer/code-reviewer
side, and the two known reds are fully explained by AC1 per the review report).

## Phase 1 — Review

Read `tools/transitions.ts`, `specs/qa-flow-enforcement-architecture.md:159/164/165`,
and `content/skill-release-engineer.md` end-to-end, plus `review_reports/review_T-E53-01.md`
in full. Independently re-verified, rather than trusting the review report at
face value:

- **AC1** — `release-engineer:In_Progress -> release-engineer:Blocked`: confirmed
  present in `ALLOWED` (`tools/transitions.ts:338`) and confirmed ACCEPT via
  `validateTransition` (T-E53-03(a)).
- **AC2** — `release-engineer:Blocked -> {release-engineer:In_Progress, pm:In_Progress,
  qa-engineer:In_Progress}`: confirmed present as a new key (`:352-356`) and
  confirmed ACCEPT for all three via `validateTransition` (T-E53-03(b)-(d)),
  plus a row-equality pin on the full key (T-E53-03(f)).
- **AC3** — `sr-engineer:Blocked -> design-auditor:In_Progress`: confirmed present
  (`:235`) and ACCEPT (T-E53-03(e)), with a row-equality pin (T-E53-03(g)).
  Cross-checked against `content/skill-sr-engineer.md:50`'s "visual structure
  unspecified" row — the destination matches.
- **AC4** — no other previously-rejected edge opened: independently re-derived
  (not reused) the reviewer's exhaustive differential as a durable in-suite
  test (T-E53-03(h)) — 33 prev tuples x 32 next tuples = 1056 combos, accepted
  set pinned as a literal 68-entry snapshot. Matches the reviewer's 63 -> 68,
  0 closed. This closes AC4 as a standing regression guard, not just a
  point-in-time review claim.
- **AC5** — mirror rows: read `specs/qa-flow-enforcement-architecture.md:159/164/165`
  by hand against the compiled map; all three match order-exact (same
  conclusion as the review report, independently re-checked).
- **AC6** — SOP reconcile: grepped `content/skill-release-engineer.md` for
  `unreachable` — zero hits (T-E53-03 content test). Confirmed step 7a's STOP
  is now a real Escalation Routes table row (7 data rows total, new row last —
  T-E53-03 content test), and confirmed rows `:152-157`'s text for the four
  rows NOT already byte-pinned by `test/release-staging.test.mjs:757` (D10,
  `:155`) and `test/verify-release.test.mjs:701` (release self-check, `:157`) —
  i.e. `:152` (unrelated uncommitted changes), `:153` (npm test regression),
  `:154` (tag exists), `:156` (gh CLI missing) — are unchanged, via exact
  substring pins.
- **Escaping caveat** (flagged by code-reviewer, addressed to QA specifically):
  the new row's pending-note cell escapes its literal pipe as `<qa_reports\|review_reports>`
  (required inside a markdown table cell) while the step 7a prose at `:84`
  keeps the bare `<qa_reports|review_reports>` — semantically verbatim, not
  byte-equal. Verified this directly: the two raw strings differ, and are
  identical after normalising `\|` -> `|`. Encoded as its own test
  (`test/release-staging.test.mjs` "E53: pending-note escaping caveat...")
  rather than folded into a byte-equality assertion that would have failed
  spuriously, per the caveat.
- **AC7** — build + suite: `npm run build` clean (tsc, zero errors, idempotent
  — no dist delta on rebuild). `npm test`: 1690/1690 (grew from the pre-cut
  1677 by the 13 tests this round adds: 8 in `test/qa-flow.test.mjs`, 5 in
  `test/release-staging.test.mjs`). `npm audit --audit-level=high`: unchanged
  from base — 5 standing HIGH advisories (sharp/libvips, @xenova/transformers,
  fast-uri, ip-address, js-yaml), all pre-existing and tracked under E57; this
  cut adds none (no dependency changes — the diff touches zero
  package.json/package-lock.json).

**Copy Audit Gate / Visual Audit Gate / Phase 1.5 Visual Compare**: N/A — no
`specs/e53-blocked-reachability.md` or `design/e53-blocked-reachability.md`
exists (mini-chain, backlog-row-as-spec). Skipped per SOP absent-branch, zero
overhead.

**Contract Defect vs Implementation Failure**: not applicable — no drift
between spec/design and implementation was found; this is a pure additive
state-machine + SOP-content change, not a stylistic-AC mismatch.

## Phase 2 — Discussion

No issues found in Phase 1. Proceeding directly to Phase 3 per SOP's "no
issues found" branch.

## Phase 3 — Tests

**Test File Discovery**: `test/qa-flow.test.mjs` (transitions/state-machine)
and `test/release-staging.test.mjs` (skill-release-engineer.md content) both
already exist and already cover this exact scope — modified in place per
Constitution §2, no new test file created.

**Spec-to-Test map** (backlog row T-E53-03 IS the AC source, mini-chain):

| AC | test |
|---|---|
| Retarget the two stale `deepEqual` shape pins (T-MATRIX-C13, `release-engineer:In_Progress` row grew from 1 to 2 successors) | `test/qa-flow.test.mjs` — the two `T-MATRIX-C13` tests at the former `:1767`/`:1806` (sr-engineer-probe rejection shape, static-row shape), retargeted to `[{pm, release-engineer:Blocked}]` |
| AC1 edge: `release-engineer:In_Progress -> release-engineer:Blocked` | `test/qa-flow.test.mjs` T-E53-03(a) |
| AC2 edges: `release-engineer:Blocked -> {release-engineer:In_Progress, pm:In_Progress, qa-engineer:In_Progress}` | `test/qa-flow.test.mjs` T-E53-03(b)/(c)/(d) + row-equality pin T-E53-03(f) |
| AC3 edge: `sr-engineer:Blocked -> design-auditor:In_Progress` | `test/qa-flow.test.mjs` T-E53-03(e) + row-equality pin T-E53-03(g) |
| AC4: no other previously-rejected edge opened | `test/qa-flow.test.mjs` T-E53-03(h) — durable exhaustive 1056-tuple sweep, positive pin on the accepted set (not a hand-listed rejected-tuple list, per the ticket's "your call as test owner") |
| AC6: zero remaining "unreachable" claims | `test/release-staging.test.mjs` "E53: zero remaining claims..." |
| AC6: step 7a STOP is a real table row | `test/release-staging.test.mjs` "E53: step 7a's empty-baseline STOP is now a genuine Escalation Routes table row..." + "...gains exactly one new row..." |
| AC6: rows `:152-157` unchanged (uncovered subset) | `test/release-staging.test.mjs` "E53: Escalation Routes rows :152-154 and :156..." |
| Escaping caveat | `test/release-staging.test.mjs` "E53: pending-note escaping caveat..." |

**Coverage Gate**: `tools/transitions.ts`'s change is a pure declarative data
table (3 new rows/entries, 0 control-flow lines) — every new entry has a
dedicated positive-accept test plus row-equality-pin coverage; the exhaustive
sweep additionally covers the entire existing map as a byproduct, well beyond
80% line coverage on the touched lines. `content/skill-release-engineer.md`
is prose/SOP, not executable — coverage is measured by assertion-per-claim
instead (every deleted claim and every added row/clause has its own test).

**Security Smoke Tests**: N/A — no new input crosses a trust boundary (static
map of string literals + prose edits, no user-supplied keys, no I/O). Matches
code-reviewer's Security finding (no findings).

## Phase 3.5 — AC Execution

Skipped — no `specs/e53-blocked-reachability.md` exists, so there is no
`proof:`-annotated AC to execute (mini-chain, backlog-row-as-spec).

## Phase 4 — Run

- Project build: `npm run build` — ZERO errors, idempotent.
- CI Runnability: `npm test` runs headlessly with zero human interaction.
- Full regression: **1690/1690 passing, 0 failures.** (Pre-cut baseline 1677;
  code-reviewer's two known-red `T-MATRIX-C13` deepEqual pins are now GREEN,
  retargeted to the new intended shape without weakening the wedge-regression
  guard they exist for — every other assertion inside those two tests was
  already passing and remains unchanged.)
- `npm run build`: clean, zero compile errors.
- `npm audit --audit-level=high`: unchanged — 5 pre-existing HIGH advisories
  (sharp/libvips, @xenova/transformers, fast-uri, ip-address, js-yaml),
  tracked under E57; this cut introduces none.

**Verdict: PASS.** All 7 backlog-row ACs verified (AC4 now as a durable
in-suite regression guard, not just a review-time claim); the two stale
`deepEqual` pins are retargeted, not weakened; the escaping caveat is handled
correctly per code-reviewer's flag; rows `:152-157` confirmed unchanged in
full (the two already-covered rows left untouched, the four uncovered rows
now covered here). Finding C1 (`content/skill-pm.md:28` / `pm:Blocked ->
design-auditor:In_Progress` still unreachable) remains out of scope for this
cut per the human's pinned 4-file scope and AC4's "no other edge opened"
constraint — not qa-engineer's to fix, left for the coordinator to file as
its own ticket, per the CLAUDE.md task brief.
## 2026-08-11T11:08:12.501Z — PASS — by qa-engineer

PASS. Verified all 7 backlog-row ACs independently (not just re-reading the review report): AC1-3 (the 5 new edges) confirmed ACCEPT via validateTransition; AC4 (no other edge opened) re-derived as a durable in-suite exhaustive sweep (33x32=1056 combos, 68-entry accepted-set snapshot) rather than trusted from the one-off review differential; AC5 mirror rows order-exact; AC6 zero remaining "unreachable" claims, step 7a STOP is now a real Escalation Routes row (7 data rows, new one last), rows :152-157 confirmed unchanged for the 4 rows not already byte-pinned by release-staging.test.mjs:757/verify-release.test.mjs:701; AC7 build clean, audit unchanged (5 pre-existing HIGH advisories, E57). Retargeted the two stale T-MATRIX-C13 deepEqual shape pins (release-engineer:In_Progress row grew 1->2 successors) to the new intended shape without weakening the wedge-regression guard. Added test/qa-flow.test.mjs T-E53-03(a)-(h): 5 positive-accept edges, 2 row-equality pins, 1 exhaustive negative-pin sweep. Added test/release-staging.test.mjs 5 content tests covering the unreachable-claim deletion, the new table row, the escaping caveat (normalise \| before byte-equality — code-reviewer's flag), and the 4 unchanged Escalation Routes rows not already pinned elsewhere. Full suite 1690/1690 (grew from 1677 by these 13 new tests), npm run build clean, npm audit unchanged. Modified existing test files only, per Constitution §2 — no new test file created. Finding C1 (pm:Blocked -> design-auditor:In_Progress still unreachable) confirmed real but correctly out of this cut's pinned 4-file scope and AC4's "no other edge opened" constraint; left for coordinator to file as its own ticket, not fixed here. Full detail: qa_reports/review_T-E53-01.md (covers T-E53-01/02/03).

