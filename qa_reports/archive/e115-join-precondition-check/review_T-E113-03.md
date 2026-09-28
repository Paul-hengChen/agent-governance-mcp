# QA Review — T-E113-03, T-E113-05 (e113-feature-level-rollup)

covers: T-E113-03, T-E113-05

By qa-engineer (sonnet). Workspace `<lanes-root>/e113`, branch
`feat/e113-feature-level-rollup`, base `1b5a48c`. Code review APPROVED round 2
(`review_reports/review_T-E113-04.md`). This is the last leg: tests +
re-baseline (T-E113-03) and the PASS gate (T-E113-05).

## Phase 0.5 — Expected-Red Diff

Skipped (no expected-red manifest declared for this feature — checked
`qa_reports/expected-red_e113-feature-level-rollup.txt`, absent; this is a
feature-mode cut, not `dispatch_mode: "bugfix"`).

## Phase 1 — Review

Read `tools/feature-rollup.ts` (370 lines), `scripts/feature-rollup.mjs`, both
rounds of `review_reports/review_T-E113-04.md`, and
`specs/e113-feature-level-rollup.md` AC1-AC8 in full before writing any test.
Confirmed independently (not taken on the reviewer's word):

- The round-1 blocking defect (whole-repo sum reported as feature total,
  unbannered) is fixed at `tools/feature-rollup.ts:298`
  (`matchingLanes = lanes.filter(lane => lane.activeFeature === featureId)`),
  with every downstream number (`totalHop`, `ticketCount`, `overCapBy`,
  `anySingleLaneReportsOverCap`) reading only from `matchingLanes`.
- The `ROLL-UP INCOMPLETE` banner (`renderRollupReport:351-359`) is
  unconditionally the first pushed line whenever `report.degraded` is true —
  no early return, no branch prints a total ahead of it.
- `HOP_CAP_EXPORTED` is imported from `tools/transitions.ts` at
  `tools/feature-rollup.ts:44` and used at every cap-comparison site; no bare
  `10` literal anywhere in the module.
- `content/coord-03-core-fallback.md` carries exactly one new sentence
  (`**Feature-close roll-up obligation** (E113)`), appended to the
  Feature-Scope Gate paragraph immediately after the E109 Anchoring-rule
  sentence, in a single unfenced paragraph — matches AC1 and the spec's Design
  section verbatim. Not restated elsewhere (`grep -rn "Feature-close roll-up"
  content/` → one hit).

Copy Audit Gate (3a) / Visual Audit Gate (3b): spec's Copy/Strings and Visual
Tokens tables are both explicitly N/A ("feature is internal governance
tooling/prose, not user-facing product copy" / "feature has no visual
literals") — no drift, no coverage gap possible. Both gates pass trivially.

Phase 1.5 (Visual Compare): `design/e113-feature-level-rollup.md` does not
exist and the spec has no Visual Baselines section — skipped, no design file.

## Phase 2 — Discussion

No new issues found in Phase 1 beyond what code-reviewer already resolved in
round 2 (which is out of QA's scope to re-litigate — style/architecture/
correctness calls belong to code-reviewer per this role's Hard Rules). Proceed
directly to Phase 3.

## Phase 3 — Tests

### Test file placement

Per this task's dispatch brief (Test-file placement line): new tests in
`test/feature-rollup.test.mjs` (creation pre-authorized), re-baseline touches
`test/context-budget.test.mjs` + `test/fixtures/compose-golden/**`. No other
`test/**` file needed a change — confirmed by `git status --porcelain` after
all work: the only modified/added paths under `test/` are exactly those three
locations (see Boundary Verification below).

### Spec-to-Test map

| AC | Test(s) in `test/feature-rollup.test.mjs` |
|---|---|
| AC2 (seam + shape) | `AC2: SEAM FOR E132 marker is present...`, `AC2: localFallbackLaneList is exported...`, `AC2: a substitute LaneListProvider works with the SAME computeFeatureRollup call site...` |
| AC3 (multi-lane sum vs HOP_CAP_EXPORTED) | `AC3: sums matching lanes' hop_count and compares against the imported HOP_CAP_EXPORTED, never a bare 10` |
| AC3 + round-1 regression (cross-feature lanes never summed) | `round-1 regression PIN: lanes belonging to OTHER features never enter totals/capComparison (healthy no-banner path)` — pinned to the exact dispatch-brief fixture (1 matching lane at hopCount 4 + 2 non-matching at 99 each → hop:4, overCapBy:0, anySingleLaneReportsOverCap:false, degraded:false) |
| AC4 (unreadable lane carried, never dropped/zero-filled, degrades) | `AC4: an unreadable lane is carried with readable:false / hopCount:null...`, `AC4: an unreadable lane provided already-flagged unreadable by the provider is also carried, never dropped` |
| AC5 (ROLL-UP INCOMPLETE banner leads output, degrade-honestly) | `AC5: banner leads the output (line index 0) when zero lanes match...`, `AC5: banner leads the output (line index 0) when a readable lane has no active_feature recorded...`, `AC5 (spec proof, literal): a real \`git worktree list\` failure...`, `AC5: no bare numeric total line prints without the banner across every degraded fixture...` |
| AC1 (coord-03 SOP prose) | Not independently re-tested by QA — code-reviewer round 1 verified placement/wording/no-restatement directly against the file; QA's job on AC1 is the re-baseline (AC7), covered below |
| AC6 (file boundary) | Re-verified directly, see Boundary Verification |
| AC8 (backlog not done-marked) | Re-verified directly, see Boundary Verification |

11 tests, all passing. See `test/feature-rollup.test.mjs` header comment for
the full map and the WHY behind using real temp workspaces (via
`writeHandoffState`) for every lane that must stay `readable: true` in the
final report — a synthetic `LaneInfo` claiming `readable: true` with no real
handoff on disk gets silently downgraded by `computeFeatureRollup`'s own
second-level `parseHandoff` re-read (round-1/2 finding #2, non-blocking but
load-bearing for test construction).

**The round-1 regression test is the load-bearing case in this file** — it
pins the exact fixture named in the dispatch brief and asserts the healthy,
non-degraded, no-banner shape (`degraded: false`) specifically, so a future
edit that reintroduces the whole-repo-sum bug (even one that keeps `degraded`
technically true, or that drops the banner precondition) fails loudly.

### Coverage gate

New/modified source under test: `tools/feature-rollup.ts` (370 lines,
pre-existing, not modified this task) — 100% of the public surface
(`computeFeatureRollup`, `renderRollupReport`, `localFallbackLaneList`) is
exercised, including both branches of the provider-level unreadable path, the
second-level-parseHandoff unreadable path, both round-2 attribution triggers,
and a real (non-injected) `git worktree list` failure. Tooling to measure line
coverage numerically is not wired into this repo's `npm test`; noting per SOP
6c that this is a qualitative call, not a measured percentage.

### Security smoke

No new attack surface — `tools/feature-rollup.ts` is read-only (no writes, no
network, argv-array `execFileSync`, already reviewed by code-reviewer under
Security in both rounds with no findings). Boundary-input tests present in
this file: empty lane list (zero-match fixtures), null `activeFeature`
(unattributable fixtures), unreadable/nonexistent workspace paths, a real
non-git directory. No auth/permission surface in this feature (CLI/library,
local developer tool).

## Phase 3.5 — AC Execution Log

The spec declares `proof:` annotations on AC2, AC5, and AC6. All three
executed below, BEFORE this PASS.

**AC2** — `grep -n "SEAM FOR E132" tools/feature-rollup.ts`

```
72:// SEAM FOR E132: this is the default provider passed to computeFeatureRollup
```

Exit code 0 (marker found). PASS.

**AC5** — the spec's literal proof ("unit test forces a `git worktree list`
failure and asserts the banner string appears and no bare numeric 'total' line
appears without it") is now a real test in `test/feature-rollup.test.mjs`:
`AC5 (spec proof, literal): a real 'git worktree list' failure (non-git
directory) degrades localFallbackLaneList honestly, and
computeFeatureRollup/renderRollupReport surface the banner`. Ran standalone:

```
$ node --test test/feature-rollup.test.mjs
...
ok 10 - AC5 (spec proof, literal): a real `git worktree list` failure (non-git directory) degrades localFallbackLaneList honestly, and computeFeatureRollup/renderRollupReport surface the banner
```

Manually re-verified the underlying behavior outside the test harness too
(non-git temp dir → `localFallbackLaneList` returns `degraded: true` with
`degradedReason` naming the git failure; `computeFeatureRollup` with that
`repoRoot` and no provider override propagates `degraded: true`;
`renderRollupReport`'s first line is `ROLL-UP INCOMPLETE — 0 of 0 lane(s)
readable; totals below are NOT a verified feature total.`). Exit: test passed.
PASS.

**AC6** — `git diff --stat main -- scripts/verify-release.mjs
tools/handoff-write.ts tools/drift.ts tools/lane-registry.ts`

```
(no output)
```

Exit code 0, empty diff. Cross-checked against this lane's actual base
(`1b5a48c`, since `main` may not be the literal ref name in every clone) with
the identical command substituting the base SHA — also empty. Boundary intact,
matching code-reviewer's own round-1/round-2 verification. PASS.

## Phase 4 — Run

### Crash checkpoint

Not separately recorded as a mid-run bookkeeping write: the full Phase 3/4
sequence (write tests, re-baseline, build, regression) completed synchronously
within this single turn per the HARD rule (long runs end in-turn) — no
crash-resume boundary was crossed, so no intermediate checkpoint write was
needed before this task's final PASS write.

### Build

`npm run build` — zero errors. `npx tsc --noEmit` — exit 0.

### AC7 — context-budget re-baseline (qa-owned, T-E113-03 part 2)

Per the dispatch brief's explicit instruction, the rationale-fence route was
**not** taken (Wave 2 measured it stripped by the default compose pass, which
would delete AC1's normative deliverable from the shipped bundle — same
precedent as e1/e109/e142's re-baselines of this exact paragraph).

- `test/context-budget.test.mjs:1096` floor (teamwork coordinator bundle,
  design-arm, both strips): **18747 → 18982** (+235 ~tok). Comment added
  following the file's established style (see the E109 → 18722, E149 → 18747
  entries immediately above it), explaining the delta is the new AC1 sentence,
  unfenced, landing in the `skill-coordinator.md` composition (which pulls in
  `content/coord-03-core-fallback.md`) — not in `CONSTITUTION` itself, so the
  constitution-only AC8 floors elsewhere in the same file are untouched.
  Independently re-measured through the real render path
  (`composeConstitution({chain:true,design:true})` → `stripOriginTags` →
  `stripRationale` for the constitution side, `composeSkill("skill-
  coordinator.md", hostCapabilitiesFor("claude-code"))` → `stripOriginTags` →
  `stripRationale` for the skill side — matching `buildPromptForRole`'s own
  order): 75925 chars = 18982 ~tok exact. Cap set to the exact measured value,
  no headroom, per the established Phase-2 convention.
- `test/fixtures/compose-golden/**` regenerated via
  `node scripts/capture-constitution-golden.mjs` (the standing tool — not
  hand-edited). Only ONE of the 12 fixtures changed:
  `skill-coordinator-monolith.txt`, a 1-line insertion/deletion carrying
  exactly the new AC1 sentence — confirmed via `git diff --stat` and a full
  `git diff` read of that file before accepting it. The other 11 fixtures
  (build-lite/full × design/non-design × fullDetail, both hook fixtures, the
  constitution monolith) are untouched, as expected: `coord-03-core-
  fallback.md` composes only into `skill-coordinator.md`, never into
  `CONSTITUTION`.
- Re-ran `node --test test/context-budget.test.mjs` after both edits: 54/54
  green (was 53/54 before, with the one failure being exactly this floor at
  the pre-edit measured value of 18982, confirming the delta is real and not
  an artifact of my own measurement script).

### CI runnability

`npm test` runs headlessly with zero human interaction (`node --test
test/*.test.mjs`), confirmed by the run below.

### Full regression

```
npm test
...
# tests 2146
# suites 1
# pass 2146
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

**2146/2146 green.** This lane's base (`1b5a48c`) has moved on considerably
from the last published figure of 1633/1633 (v3.94.0) — the actual count as of
this PASS is 2146, reported per the dispatch brief's explicit ask ("report the
actual").

**No collateral failures from the coord-03 prose change beyond the one
expected context-budget floor test**, which was the anticipated re-baseline
target itself, not incidental fallout — no other test file needed touching
(verified: `git status --porcelain` shows `test/` changes confined to the two
files named in the dispatch brief plus the new
`test/feature-rollup.test.mjs`).

### Boundary Verification (AC6, AC8)

- `git status --porcelain` (full tree, at PASS time):
  - Modified: `.current/handoff.md`, `.current/telemetry.jsonl` (governance
    churn), `content/coord-03-core-fallback.md` (T-E113-01, already approved),
    `tasks.md` (governance churn), `test/context-budget.test.mjs` (this
    task's re-baseline), `test/fixtures/compose-golden/skill-coordinator-
    monolith.txt` (this task's re-baseline).
  - Untracked (new): `dist/tools/feature-rollup.{d.ts,d.ts.map,js,js.map}`
    (compiled T-E113-02), `review_reports/review_T-E113-04.md` (code-reviewer
    evidence), `scripts/feature-rollup.mjs` (T-E113-02),
    `specs/e113-feature-level-rollup.md` (this feature's spec),
    `test/feature-rollup.test.mjs` (this task's new tests),
    `tools/feature-rollup.ts` (T-E113-02).
  - This is EXACTLY the file list declared in the spec's "Coordination /
    file-collision note" and the handoff's `scope_decision_why`, plus this
    task's own qa_reports evidence file (not yet written at the time of this
    listing).
- `git diff --stat 1b5a48c -- scripts/verify-release.mjs tools/handoff-write.ts tools/drift.ts tools/lane-registry.ts` → empty. Boundary intact (E115/E116/E112/E132 untouched).
- `git diff --stat 1b5a48c -- docs/backlog.md` → empty. **AC8 holds**:
  `docs/backlog.md`'s E113 row still shows `—` in the status column (grepped
  directly, not taken on trust) — not done-marked by sr-engineer or
  qa-engineer. That is release-engineer's job, post-PASS.

### Known drift (not reconciled, per dispatch brief)

`tw_detect_drift` reports `T-E142-01..05` and `T-E114-01..03` as completed in
`tasks.md` but not reflected in this lane's `handoff.md`. Per the dispatch
brief this is E114/E142 drift inherited from this lane's base commit
(`1b5a48c`) — not this cut's to fix, and explicitly not a reason to withhold
PASS. Left untouched.

## Verdict

**PASS.**

- AC1 (SOP prose): approved by code-reviewer round 1, re-baseline landed by
  this QA round (AC7).
- AC2 (seam/shape): tested and proof executed.
- AC3 (multi-lane sum vs cap, imported): tested.
- AC4 (unreadable lane carried honestly): tested, two branches.
- AC5 (degrade-honestly banner): tested four ways including the spec's literal
  proof; code-reviewer independently verified 9 injected-provider fixtures in
  round 2 plus a live 12-worktree run.
- AC6 (file boundary): re-verified directly at PASS time, matches code-
  reviewer's round-1/round-2 findings.
- AC7 (re-baseline): done by this QA round — floor 18747 → 18982, golden
  fixture regenerated via the standing tool, single 1-line delta.
- AC8 (backlog untouched): re-verified directly.
- Full regression: 2146/2146 green, zero collateral failures beyond the
  anticipated floor bump itself.

Non-blocking items recorded by code-reviewer (banner readability-count wording
at `:353`, "across all lanes" phrasing at `:400`/`:403`, duplicated match
predicate at `:379`) are cosmetic and out of QA's FAIL scope per this role's
Hard Rules (style/correctness calls belong to code-reviewer, already
adjudicated non-blocking). Carry-forwards for E132's cutter (provider bypass
at `:261`, 2N handoff reads, heuristic attribution of rolled-on lanes) are
explicitly out of this cut's scope per the spec's Out of Scope section and the
dispatch brief's boundaries — not touched, not fixed, correctly left for
E132.
## 2026-09-18T11:39:37.104Z — PASS — by qa-engineer

PASS. New test/feature-rollup.test.mjs (11 tests) covers AC2 (SEAM FOR E132 marker + LaneListProvider zero-call-site-change substitution), AC3 (multi-lane sum vs imported HOP_CAP_EXPORTED, no bare 10), the round-1 regression PIN (cross-feature lanes never enter totals -- fixture: 1 matching lane hopCount:4 + 2 non-matching at 99 each -> hop:4, overCapBy:0, anySingleLaneReportsOverCap:false, degraded:false, no banner), AC4 (unreadable lane carried with readable:false/hopCount:null, never dropped/zero-filled, always degraded:true, both unreadable branches), and AC5 (ROLL-UP INCOMPLETE banner at rendered line 0 in all degraded cases including both round-2 attribution triggers -- zero matching lanes, unattributable readable lane -- plus a literal git-worktree-list-failure proof test). AC7 re-baseline done: test/context-budget.test.mjs floor 18747->18982 (+235, exact remeasurement through the real buildPromptForRole-equivalent render path), test/fixtures/compose-golden/** regenerated via scripts/capture-constitution-golden.mjs (only skill-coordinator-monolith.txt changed, 1-line delta matching the new AC1 sentence). Phase 3.5 AC Execution Log: AC2/AC5/AC6 proofs all executed and passing (see qa_reports/review_T-E113-03.md). Full npm test: 2146/2146 green (this lane's base moved on from the last published 1633/1633 at v3.94.0), zero collateral failures beyond the anticipated floor bump. AC6/AC8 boundary re-verified directly: file list matches spec exactly, docs/backlog.md E113 row NOT done-marked. Known T-E114-01..03 drift left unreconciled per dispatch brief.

## 2026-09-18T11:39:57.810Z — PASS — by qa-engineer

PASS. New test/feature-rollup.test.mjs (11 tests) covers AC2 (SEAM FOR E132 marker + LaneListProvider zero-call-site-change substitution), AC3 (multi-lane sum vs imported HOP_CAP_EXPORTED, no bare 10), the round-1 regression PIN (cross-feature lanes never enter totals -- fixture: 1 matching lane hopCount:4 + 2 non-matching at 99 each -> hop:4, overCapBy:0, anySingleLaneReportsOverCap:false, degraded:false, no banner), AC4 (unreadable lane carried with readable:false/hopCount:null, never dropped/zero-filled, always degraded:true, both unreadable branches), and AC5 (ROLL-UP INCOMPLETE banner at rendered line 0 in all degraded cases including both round-2 attribution triggers -- zero matching lanes, unattributable readable lane -- plus a literal git-worktree-list-failure proof test). AC7 re-baseline done: test/context-budget.test.mjs floor 18747->18982 (+235, exact remeasurement through the real buildPromptForRole-equivalent render path), test/fixtures/compose-golden/** regenerated via scripts/capture-constitution-golden.mjs (only skill-coordinator-monolith.txt changed, 1-line delta matching the new AC1 sentence). Phase 3.5 AC Execution Log: AC2/AC5/AC6 proofs all executed and passing (see qa_reports/review_T-E113-03.md). Full npm test: 2146/2146 green (this lane's base moved on from the last published 1633/1633 at v3.94.0), zero collateral failures beyond the anticipated floor bump. AC6/AC8 boundary re-verified directly: file list matches spec exactly, docs/backlog.md E113 row NOT done-marked. T-E113-01/02/04 already carry their own evidence (code-reviewer APPROVED, review_reports/review_T-E113-04.md, rounds 1-2) -- not re-evidenced by qa per c16/E32, completed via tw_complete_task below on the strength of that existing evidence. Known T-E114-01..03 drift left unreconciled per dispatch brief.

