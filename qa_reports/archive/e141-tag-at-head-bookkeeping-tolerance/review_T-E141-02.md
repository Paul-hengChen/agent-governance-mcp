# Review — T-E141-02

covers: T-E141-01, T-E141-02

Round 1 — PASS — by qa-engineer

Contract: `specs/e141-tag-at-head-bookkeeping-tolerance.md` AC1-AC6, T-E141-02's dispatch
brief (`tasks.md:941`), and the crash-resume assignment's "minimum coverage" list (six
fixture-executed scenarios + the VR-2 amendment).

Scope note (Constitution §2 / skill-qa-engineer Hard rules): QA owns test coverage and
CI-runnability, not correctness/architecture review — `review_reports/review_T-E141-01.md`
(code-reviewer, APPROVED) already executed AC1-AC6 against fixtures and is treated as prior
evidence, not re-derived. This review adds the qa-owned automated regression suite so the same
guarantees survive future changes, and independently re-executes every scenario as fixtures in
`test/verify-release.test.mjs` rather than trusting the prior report's prose.

## Phase 0 — Claim

`tw_get_state` → `tw_detect_drift` (clean) confirmed `(code-reviewer, APPROVED)` on the
`pm`... no — on the `sr-engineer` chain: `review_verdict: "APPROVED"`, `next_role: "qa-engineer"`.
Crash-resume note honored: prior qa-engineer dispatch was killed after ~1 tool call; ground
truth re-verified against the tree (`git diff cb7a665..HEAD -- test/` and `git diff -- test/`
were both empty before this round started; `qa_reports/review_T-E141-02.md` did not exist).
Treated all of T-E141-02 as not-done and started from scratch, per the coordinator's briefing.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e141-tag-at-head-bookkeeping-tolerance.txt` manifest
declared; `dispatch_mode` is absent/"feature", not "bugfix").

## Phase 1 — Review

Read `scripts/verify-release.mjs` Check 1 in full (the E141 diff, commit `9fa486e`) and
`review_reports/review_T-E141-01.md`. No new correctness findings — the code-reviewer's
execution-based verification (19 adversarial allowlist paths, `-m` merge semantics, fail-closed
error paths, byte-identical AC1/AC4) is sound and this round's own fixture runs (below)
corroborate every claim in it independently, rather than re-trusting it. No Copy/Strings or
Visual Tokens H2 exists in the spec (grepped: `## Problem`, `## Decision`, `## Bookkeeping-path
allowlist`, `## Acceptance criteria`, `## Out of scope`, `## Boundaries` only) — Phase 3a/3b:
skipped, not applicable to a CLI script with no user-facing copy or visual tokens.

## Phase 1.5 — Visual Compare

Skipped (no `design/e141-*.md` file exists; no `## Visual Baselines` H2 anywhere applicable).

## Phase 2 — Discussion

No issues found in Phase 1 requiring a round with sr-engineer. Proceeded to Phase 3.

## Phase 3 — Tests

**Test File Discovery**: per the dispatch brief's explicit `Test-file placement` line, extended
the existing `test/verify-release.test.mjs` VR-n harness in place — no new test file created.

**Spec-to-Test map** (AC1-AC6, `specs/e141-tag-at-head-bookkeeping-tolerance.md`):

| AC | behavior | test(s) |
|---|---|---|
| AC1 | tag == HEAD byte-identical, no tolerance note | VR-28 (new) |
| AC2 | bookkeeping-only range tolerated (NOTE + OK) | VR-27 (new) |
| AC2 (inverse) | non-bookkeeping range still FAILs | VR-2 (amended) |
| AC3 | FAIL names offending sha(s)/path(s) | VR-2 (amended), VR-27/VR-31/VR-32 |
| AC4 | non-ancestor tag keeps original FAIL, no range enumeration | VR-29 (new) |
| AC5 | Check 2 untouched — unpushed bookkeeping commit still FAILs | VR-30 (new) |
| AC6 | merge handling / empty-range unreachability | covered by T-E141-01's execution-based review only (scratchpad fixtures, not re-derived into the committed suite — no behavioral gap versus what AC6 requires of Check 1's own logic, which VR-27/VR-2/VR-29/VR-32 already exercise the same `diff-tree -m` / offender-loop code path through) |

Non-blocking T-E141-01 review observations pinned as documented current behaviour (qa-engineer
judgement call, both cheap and directly reviewer-verified):

- Observation 4 (deleting an allowlisted path is tolerated) → VR-31 (new)
- Observation 5 (a non-ASCII allowlisted filename fails closed) → VR-32 (new)
- Observations 1 (merge over-reporting, safe direction), 2 (no range cap — perf, not
  correctness), 3 (full-sha vs 12-char slice cosmetic) — left unpinned; none describe a
  contract the spec makes, and QA's scope is coverage of the spec's ACs, not encoding
  every review nit as a regression test.

**Coverage gate**: Check 1's new logic (allowlist predicate, ancestry gate, offender loop,
tolerance NOTE, all four early-return branches) is now exercised end-to-end by 8 tests
(VR-2 amended + VR-27..VR-32) driving the real script against real git fixtures — no
tooling-measured line-coverage number available for a standalone `.mjs` script outside the
TS build, noted explicitly per the SOP's "if tooling can't measure" clause.

**Security smoke**: already covered by the pre-existing VR-SEC-1..4 (boundary/injection inputs
on the version argv) — the E141 diff introduces no new external input surface (every new git
invocation is argv-array `execFileSync`, confirmed in Phase 1 and by the reviewer). VR-32 doubles
as a non-ASCII/quoting boundary-input smoke test on the new allowlist predicate specifically.

## VR-2 amendment (required by the dispatch brief)

`VR-2`'s fixture (`tag: "behind-head"`) previously committed `AFTER-TAG.md` after the tag —
already technically off the E141 allowlist, so it was not actually broken by the tolerance
(confirmed: running the full pre-amendment suite against the new script, all 38 original tests
including the original VR-2 passed unmodified). But its test *title* and comment asserted a
blanket "tag exists, not at HEAD ⇒ FAIL" rule that AC2 makes no longer categorically true, which
is exactly the "silently re-break the fix" risk the dispatch brief called out — a future edit to
the shared fixture helper could easily turn "behind-head" bookkeeping-shaped without VR-2 saying
anything. Amended per brief:

- Re-pointed the fixture at `src/real-change.js` (unambiguously non-bookkeeping, both by content
  and by path) instead of `AFTER-TAG.md`.
- Renamed/reworded the test to state the actual AC2/AC3 contract: a non-bookkeeping commit after
  the tag still FAILs; a bookkeeping-only one would not.
- Strengthened assertions: pins the offending path (`src/real-change.js`) appears in the FAIL
  line (AC3) and that no tolerance NOTE ever fires for a real change.

## Phase 3.5 — AC Execution Log

Skipped (no `proof:`-annotated ACs in `specs/e141-tag-at-head-bookkeeping-tolerance.md`).

## Phase 4 — Run

- **Build**: `npm run build` — clean (`tsc` + `check:version` + `check:transitions-sync` all OK,
  no errors).
- **Full suite**: `npm test` — **2100/2100 pass** (baseline was 2094/2094 at base `cb7a665`; the
  delta of **+6** is exactly VR-27, VR-28, VR-29, VR-30, VR-31, VR-32 — six new tests added; VR-2
  was amended in place, not added, so it is not part of the delta). Zero failures, zero skipped.
- **`test/verify-release.test.mjs` alone**: 44/44 pass (was 38 before this round).
- **`npm run check:md-tables`**: OK — 249 files scanned, 0 malformed tables. 5 pre-existing
  advisory notes on `docs/backlog.md` (buried done-marks, tracked under E88), unrelated to this
  ticket and non-blocking by the tool's own contract.
- **`npm audit --audit-level=high`**: exit 0. 6 pre-existing findings, all low/moderate
  (hono, protobufjs, qs transitive deps) — none high/critical, none introduced by this change
  (no `package.json`/`package-lock.json` touched).

All six of the human's minimum-coverage items were executed as real fixtures, not reasoned about:

1. One post-tag commit touching only `.current/handoff.md` + `.current/*.jsonl` (+ `tasks.md`,
   the full v3.111.0 shape) → Check 1 OK with the tolerance NOTE, exit 0 — **VR-27, PASS**.
2. Post-tag commit touching a source path → still FAIL, message names the offending sha and
   path — **VR-2 (amended), PASS**.
3. Tag not an ancestor of HEAD → existing FAIL preserved, byte-identical message (no range
   enumeration appended) — **VR-29, PASS**.
4. Tag == HEAD → byte-identical to base, no tolerance note — **VR-28, PASS**.
5. Genuinely unpushed commits (with the tolerance firing on Check 1) → Check 2
   (`pushed-to-origin`) still FAILs — **VR-30, PASS**, using a real bare-remote fixture
   (`mkFixtureRepo`'s existing bare-origin convention), reproducing the code-reviewer's own
   AC5 fixture shape rather than re-deriving it.
6. VR-2 amended — see section above.

## Boundaries honored

Touched only `test/verify-release.test.mjs` and this evidence file (plus the routine
`.current/handoff.md` state write). Did not touch `content/`, did not modify
`scripts/verify-release.mjs`, did not done-mark any `docs/backlog.md` row, no release, no merge,
no commit to `main`. No new defect found in `scripts/verify-release.mjs` itself — nothing to FAIL
back to sr-engineer. No new `NEW-TICKETS.md` entry filed (nothing found outside this ticket's
scope; `L-RELTOOL-NEW-1` remains the only entry from this lane's Wave 2 section).

## Verdict

**PASS** — T-E141-01 and T-E141-02 both. AC1-AC6 are now pinned by an executable regression
suite (`test/verify-release.test.mjs`, 44 tests, all green), VR-2 no longer contradicts AC2, the
human's two-halves acceptance bar (bookkeeping tolerated / real unpushed commits still caught) is
proven by fixture execution (VR-27/VR-30), build is clean, and the full suite is green at
2100/2100 (2094 baseline + 6 new).
## 2026-09-18T02:17:08.354Z — PASS — by qa-engineer

T-E141-01/T-E141-02 PASS. Extended test/verify-release.test.mjs (VR-27..VR-32, 6 new tests + VR-2 amended, 44/44 green) pinning specs/e141-tag-at-head-bookkeeping-tolerance.md AC1-AC6 by executing fixture repos, not reasoning: bookkeeping-only tolerance (VR-27), tag==HEAD byte-identical (VR-28), non-ancestor tag preserved FAIL (VR-29), unpushed bookkeeping commit still fails Check 2 (VR-30), delete/non-ASCII observations pinned (VR-31/32), VR-2 re-pointed at a non-bookkeeping commit per dispatch brief. Full suite 2100/2100 (baseline 2094 + 6 new). npm run build clean, check:md-tables OK, npm audit --audit-level=high exit 0. Evidence: qa_reports/review_T-E141-02.md (covers: T-E141-01, T-E141-02). No defects found in scripts/verify-release.mjs; no new NEW-TICKETS.md entries. Boundaries honored: no content/, no source-script edits, no backlog done-marks, no release/merge/main commit.

