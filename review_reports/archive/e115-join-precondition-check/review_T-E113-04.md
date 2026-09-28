# Review — T-E113-04 (e113-feature-level-rollup)

covers: T-E113-01, T-E113-02, T-E113-04

Round 1 — CHANGES_REQUESTED — by code-reviewer (opus)

Base `1b5a48c`, branch `feat/e113-feature-level-rollup`, reviewed as uncommitted
working tree (no commits exist on the lane yet).

## Summary

- T-E113-01 (`content/coord-03-core-fallback.md`) is **clean**: one new sentence,
  correct paragraph, correct position, correctly origin-tagged, not fenced, not
  restated. AC1 passes with zero findings.
- T-E113-02 ships `tools/feature-rollup.ts` (370 lines) + `scripts/feature-rollup.mjs`
  (thin CLI) + compiled `dist/`. Degrade-honestly plumbing for the *enumerated*
  failure cases (AC4/AC5) is genuinely well built and verified working.
- **Blocking**: `computeFeatureRollup` never filters lanes to the feature. The
  `featureId` argument is used only as a display label; `LaneInfo.activeFeature`
  is collected by the provider and then silently discarded. In the healthy
  multi-worktree case — which is exactly AC3's scenario — `degraded` is `false`,
  so **no banner fires**, and the surface prints a confident, unqualified
  whole-repo sum labelled as this feature's total.
- Observed live in this repo: the true hop count for `e113-feature-level-rollup`
  is **3**; the tool reports **54** under the heading `Feature roll-up:
  e113-feature-level-rollup`, with the verdict line *"feature total hop_count
  exceeds the cap by 44"* and no banner. That is an 18x over-report asserted as
  fact. This reproduces the exact defect class E113 was written to eliminate.
- AC6, AC8, the E130/Wave-7 hook and the `HOP_CAP_EXPORTED` import all pass.
  AC2's marker and injection point are present, with one seam-leak caveat below.
- Verdict: CHANGES_REQUESTED on a single blocking defect (Correctness #1). The
  rest of the cut is sound and should survive the fix largely untouched.

## Correctness

### 1. BLOCKING — the roll-up reports a whole-repo total as the feature total, unbannered

`tools/feature-rollup.ts:207-304` (`computeFeatureRollup`), `:231-275` (the lane map).

`featureId` is consumed in exactly four places, none of which filter anything:

```
185:  featureId: string;                                   // interface field
208:  featureId: string,                                   // parameter
292:    featureId,                                          // echoed into the report
329:  lines.push(`Feature roll-up: ${report.featureId}`);   // printed as a title
```

Every lane returned by the provider is summed unconditionally:

```ts
const totalHop = lanes.reduce((sum, lane) => sum + (lane.hopCount ?? 0), 0);   // :277
```

`localFallbackLaneList` *does* read each lane's `active_feature` (`:124`), but
`RollupReportLane` (`:176-182`) has no `activeFeature` field, so the value is
dropped in the map at `:231-275` and never reaches the report or the rendered
table.

I ran the shipped CLI in this repo rather than relying on a description:

```
$ node scripts/feature-rollup.mjs e113-feature-level-rollup

Feature roll-up: e113-feature-level-rollup

workspace | status | hop_count | tickets | readable
--- | --- | --- | --- | ---
<repo-root>        | In_Progress | 7 | 0 | true
<lanes-root>/e112  | In_Progress | 1 | 0 | true
<lanes-root>/e113  | In_Progress | 3 | 0 | true
<lanes-root>/e114  | PASS        | 6 | 3 | true
... 8 more unrelated lanes ...

Totals — hop: 54 (cap 10, OVER BY 44), tickets: 20
VERDICT: feature total hop_count exceeds the cap by 44, even though no single
lane's own tw_get_state read ever showed it — surface this to the human before
declaring the feature closed.
```

The true figure for `e113-feature-level-rollup` is the `e113` row: **3**, well
under the cap of 10. The tool reports **54**, over cap by 44, and instructs the
human to escalate.

**Why the degraded banner does not save this.** sr-engineer's position (and the
dispatch brief's framing) is that the `ROLL-UP INCOMPLETE` banner plus the
per-lane breakdown is the guard. It is not, for three independent reasons:

1. **The banner structurally cannot fire here.** `degraded` is set only by
   provider-level failure or an unreadable lane (`:284`). When all 12 worktrees
   parse cleanly — the normal, healthy case, and *precisely* the precondition
   AC3 states ("2+ git worktrees each holding a valid `.current/handoff.md`") —
   `degraded` is `false` and `renderRollupReport`'s banner block at `:319-327`
   is skipped entirely. The guard is absent from the only case that matters.
   Every failure mode the banner covers is a case where the tool prints *fewer*
   numbers; the misreport happens on the success path.

2. **The breakdown does not let a human do the filtering.** The rendered table
   (`:335-343`) is `workspace | status | hop_count | tickets | readable` — there
   is **no feature column**. `activeFeature` is the one field that would let a
   reader attribute rows to features, and it is collected and then thrown away.
   A human sees twelve opaque worktree paths. "A candidate list for the human to
   eyeball" is not achievable when the attribute being eyeballed was deleted
   before rendering.

3. **The prose actively contradicts the caveat.** Far from hedging, the output
   asserts `Totals — hop: 54` and then editorialises: *"feature total hop_count
   exceeds the cap by 44, even though no single lane's own tw_get_state read
   ever showed it."* That sentence is a direct restatement of the spec's
   28-vs-10 Problem Statement, applied to a number that is not the feature's.
   The surface is at its most confident exactly where it is most wrong.

**On AC3's wording.** AC3 says the report "includes every worktree found by
`git worktree list --porcelain`". Read in isolation this licenses the current
behaviour, and I considered accepting it on that basis. I do not, because that
reading puts AC3 in direct conflict with the document it lives in:

- The Problem Statement defines the deliverable as "the feature's true total"
  and the fix as "enumerate **every lane's** ticket, status, and hop, sum them,
  and put **the true total** in front of a human".
- User Story 1 asks for "a single command that sums every lane's ticket, status,
  and hop" for a *fanned-out feature*.
- User Story 4 and AC5 both demand the surface never let a number be "mistaken
  for a feature total".
- The command's required first argument is `<feature>`, and the output is titled
  `Feature roll-up: <feature>`.

AC3's clause describes where the local fallback's *candidate set* comes from —
git worktree enumeration rather than E132's registry — which is the genuine
contrast that sentence was drawing. It is not a licence to publish the repo-wide
sum as a feature figure. Where an AC's literal reading contradicts the spec's
stated purpose, the purpose governs; and for a ticket whose entire reason for
existing is "this surface must not misreport", resolving the ambiguity *toward*
misreporting is not defensible.

**This is fixable inside this cut — E132 is not needed.** The required input is
already in hand: `LaneInfo.activeFeature` is populated at `:124` and merely
needs to survive into `RollupReportLane` and the render. A sufficient fix:

- carry `activeFeature` through to `RollupReportLane` and add a feature column
  to the table;
- partition lanes into matching (`activeFeature === featureId`) and non-matching,
  and sum **only** the matching set into `totals`/`capComparison`;
- treat attribution uncertainty as what `degraded` already exists for — set
  `degraded: true` with a `degradedReason` when zero lanes match the feature id,
  or when any lane's `activeFeature` is null/unattributable, since a lane that
  has since moved on to another feature genuinely cannot be attributed by this
  heuristic.

That last point matters and should not be over-engineered: `active_feature`
attribution is a heuristic, not ground truth (a lane may have rolled over to a
later feature). Exactness is E132's job. What AC5 requires today is that the
surface not present an unattributed sum *as if* it were verified — the degraded
path is the correct home for that imprecision, and it is already built.

I also note the fix should keep `anySingleLaneReportsOverCap` (`:280-282`)
scoped to the same filtered set, or it will fire off unrelated lanes.

### 2. Non-blocking — `computeFeatureRollup` can downgrade a provider's readable lane

`tools/feature-rollup.ts:246-274`. After the provider returns a lane as
`readable: true`, `computeFeatureRollup` independently re-reads it with
`parseHandoff(lane.workspacePath)` to obtain `completed_tasks`, and marks the
lane `readable: false` if that second read fails. I verified this by passing a
synthetic provider reporting readable lanes at paths with no handoff on disk:
the banner rendered `0 of 2 lane(s) readable` despite the provider reporting
both readable. Behaviour is *honest* (it degrades, it does not fabricate), so
this is not blocking — but see Architecture for why it weakens the E132 seam.

### 3. Non-blocking — the `hopCount: null` zero-fill is safe, confirmed

The brief asked me to verify that a null `hopCount` contributing `0` to the sum
at `:277` can only ever surface under the degraded banner. **It can.** I traced
it: `tools/handoff-parse.ts:292-300` always materialises `hop_count` as a number
(missing/malformed values are seeded to `0`), and `tools/handoff-types.ts:72`
types it `hop_count: number`, so the ternary at `:126`
(`typeof state.hop_count === "number" ? state.hop_count : null`) can only yield
`null` on the unreadable path — which sets `anyUnreadable`/`anyLaneUnreadableHere`
and therefore `degraded: true`. AC4 passes. The defensive ternary is effectively
unreachable but harmless and appropriate. (That a malformed `hop_count` is
parser-seeded to `0` rather than flagged is pre-existing `parseHandoff` posture,
not this cut's defect, and out of scope here.)

## Quality

No blocking findings.

- AC1 prose is well executed. Placement is exactly as specified: appended to the
  Feature-Scope Gate paragraph at `content/coord-03-core-fallback.md:9`,
  immediately following the last sentence of the E109 Anchoring-rule run, same
  paragraph. Tagged `<!-- origin:start --> (E113)<!-- origin:end -->`, matching
  the file's convention of wrapping only the ticket ref.
- **Not inside a rationale fence** — confirmed. The file's only fence is at
  `:55`, unrelated (release-engineer step 7a). The new sentence is plain
  paragraph prose and will survive the default compose pass. The Wave 2 hazard
  called out in the brief was correctly avoided.
- **Not restated elsewhere** — `grep -rn "roll-up obligation\|feature-rollup\|Feature-close roll-up" content/` returns exactly one hit, the new sentence. E59/E109 AC1 precedent honoured.
- The prose reads as a reporting obligation and explicitly disclaims being a new
  cap ("This is a reporting obligation, not a new cap … nothing here makes
  `hop`/round caps span workspaces"), which is the E109-compatibility point.
- Module and CLI header comments are unusually good — they state the *why* and
  name the degrade-honestly property as load-bearing. `scripts/feature-rollup.mjs`
  correctly follows the `summarize-metrics.mjs` pattern with zero script-level
  logic.
- Naming (`LaneInfo`, `LaneListResult`, `LaneListProvider`, `RollupReport`)
  matches the spec's Design section verbatim.
- Minor: `RollupReportLane` is exported but not named in the spec's interface
  list. Harmless and arguably an improvement over the inline type.

## Architecture

AC2's mechanical requirements are met: `SEAM FOR E132` is present at
`tools/feature-rollup.ts:63`, `LaneListProvider` is declared at `:61`,
`localFallbackLaneList` is the default at `:212`
(`opts?.laneListProvider ?? localFallbackLaneList`), and E132 can be dropped in
with **zero call-site change** to `computeFeatureRollup`. The defensive
try/catch around the provider call (`:215-228`) is a good call — a future
provider that throws degrades rather than crashing.

One caveat the brief asked me to judge on shape rather than comment, recorded as
non-blocking but worth carrying into E132's ticket: **the seam is leaky.**
`computeFeatureRollup` does not source all lane data through the provider — at
`:246-247` it bypasses the provider and calls `parseHandoff(lane.workspacePath)`
directly to obtain `completed_tasks`. The comment at `:242-245` shows this was
deliberate (keeping `LaneListProvider` minimal so a registry provider need not
carry ticket lists), which is a reasonable trade. But it means swapping in
E132's registry provider does **not** fully swap the data source: ticket counts
would still come from a direct local `.current/handoff.md` read, so an E132
provider describing lanes that are not local worktrees would have every lane
downgraded to `readable: false` by finding #2. Since AC2 asks only for zero
call-site change, this does not block — but E132's cut should expect to either
extend `LaneListProvider` with an optional `ticketsCompleted`, or have
`computeFeatureRollup` prefer provider-supplied ticket data when present.

The "new module, not `scripts/verify-release.mjs`" decision is correctly honoured
and keeps E115 uncollided, per the Design section's stated precedent.

**E130/Wave-7 forward hook: passes.** `computeFeatureRollup` and
`renderRollupReport` are plain named exports from a compiled `tools/*.ts`
module; `import { computeFeatureRollup, renderRollupReport } from "../tools/feature-rollup.js"` works as-is with no refactoring. The CLI is a pure wrapper
holding no logic, so `agc feature finish` will not need to reimplement anything.
Note the blocking fix above should be made *inside* `computeFeatureRollup`, not
in the CLI, so E130 inherits the corrected behaviour automatically.

## Security

No findings.

- `execFileSync("git", ["worktree", "list", "--porcelain"], …)` at `:72-75` uses
  the argv-array form with a fixed binary and fixed arguments — no shell, no
  interpolation, so no command-injection surface. `repoRoot` reaches only `cwd`,
  which is not a shell context.
- `featureId` comes from argv and is only ever string-interpolated into stdout;
  it is never used in a path, a command, or a query.
- No secrets, no network calls, no writes — the module is read-only and prints
  to stdout.
- Error messages surface `err.message` from git/`parseHandoff` and local
  filesystem paths. Appropriate for a local developer CLI; no credential or
  token material is in scope.

## Performance

No blocking findings; no regression vs base (all code is new).

- **2N handoff reads instead of N** (`:107` in the provider, then `:247` in
  `computeFeatureRollup`): every readable lane's `.current/handoff.md` is parsed
  twice per run. At observed scale (12 worktrees, 24 reads) this is immaterial
  and I am not asking for a change. Resolving the finding-#2 seam leak would
  naturally collapse it to N.
- Single `git` subprocess for the whole run — correctly not per-lane.
- All loops are O(n) in lane count; no nested scans, no unbounded caches, no
  retained listeners.

## Boundary / scope checks (AC6, AC8)

Verified directly against the tree rather than taken on trust:

- `git status --porcelain` shows source changes limited to
  `content/coord-03-core-fallback.md` (M), `tools/feature-rollup.ts` (new),
  `scripts/feature-rollup.mjs` (new), `specs/e113-feature-level-rollup.md` (new),
  and generated `dist/tools/feature-rollup.{js,d.ts,js.map,d.ts.map}`.
- **Zero `test/**` changes** — AC6 / Constitution §2 respected; T-E113-03 is
  correctly left to qa.
- `git diff --stat HEAD -- scripts/verify-release.mjs tools/handoff-write.ts tools/drift.ts tools/lane-registry.ts` prints nothing. Boundary intact.
- `docs/backlog.md` untouched — AC8 passes, no premature done-mark.
- `.current/handoff.md`, `.current/telemetry.jsonl` and `tasks.md` are modified
  as ordinary governance-state churn, not source changes.
- AC7 (context-budget floor + compose-golden re-baseline) is qa-owned and
  correctly absent from this cut; its absence is not a finding against
  sr-engineer. Note for qa: the AC1 sentence is unfenced normative prose, so the
  floor **will** move — that is expected and must not be avoided by fencing.

## Model-bias note

sr-engineer ran pinned to `fable`; this review ran on `opus`. Different models,
so no same-model blind-spot concern. sr-engineer disclosed the lane-filtering
gap honestly in its handoff rather than concealing it — the disagreement here is
about whether AC3's wording licenses it, not about disclosure, and the finding
was independently confirmed by reading the code and running the shipped CLI.

## Verdict

**CHANGES_REQUESTED** — `computeFeatureRollup` never filters lanes to the feature
under roll-up (`featureId` is a display label only, `activeFeature` is collected
then discarded), so on the healthy multi-worktree path — where `degraded` is
`false` and the `ROLL-UP INCOMPLETE` banner cannot fire — the surface presents a
whole-repo sum (observed: 54 vs a true 3, "OVER BY 44") as a verified feature
total, reproducing the exact misreporting defect E113 exists to eliminate.
T-E113-01 is approved as-is and needs no rework; the fix is confined to
`tools/feature-rollup.ts` and requires no E132 dependency.

---

## Round 2 — APPROVED — by code-reviewer (opus)

Base `1b5a48c`, branch `feat/e113-feature-level-rollup`, reviewed as uncommitted
working tree. **Scope this round: `tools/feature-rollup.ts` + its regenerated
`dist/` output only.** `content/coord-03-core-fallback.md` was approved in round
1, is unmodified (`git diff --stat 1b5a48c -- content/coord-03-core-fallback.md`
= 1 file, 1 insertion, 1 deletion — the round-1 sentence), and was not
re-reviewed. The round-1 blocking finding (Correctness #1) is the only item under
judgment.

### Summary

- **Round-1 blocking finding is resolved.** `computeFeatureRollup` now filters
  lanes to the feature before summing anything. `featureId` is load-bearing, not
  a display label.
- Verified by construction (reading the filter and every consumer of it), not by
  re-running the happy path the coordinator already ran. I exercised the paths
  that were *not* exercised — zero matches, all-unattributable, match +
  unreadable, match + unattributable, single matching lane over cap, single
  matching lane exactly at cap, provider throwing, empty lane list with a
  provider claiming `degraded: false` — via injected `LaneListProvider`s against
  the compiled `dist/` module.
- **The AC5 property holds on every path reached.** In all 9 degraded cases the
  `ROLL-UP INCOMPLETE` banner is at rendered line index **0** — before the
  feature title, the table, the "Rolled up N of M" line, and `Totals`. In all
  non-degraded cases the totals are derived exclusively from readable,
  attributable, matching lanes. I found **no** path that prints a number that is
  not this feature's total without a banner.
- `anySingleLaneReportsOverCap` is correctly scoped to the filtered set —
  confirmed empirically, not just by reading the `.some()` receiver.
- Round-1 passes all survive: AC2 seam, AC4, AC6, AC8, E130 plain-export hook,
  `HOP_CAP_EXPORTED` imported. `npx tsc --noEmit` exits 0.
- Verdict: **APPROVED**. Five non-blocking notes below, three of them carry-
  forwards for E132's cutter.

### Correctness

#### Round-1 finding #1 — RESOLVED

The fix is at `tools/feature-rollup.ts:298`:

```ts
const matchingLanes = lanes.filter((lane) => lane.activeFeature === featureId);
```

and every downstream number reads from `matchingLanes`, not `lanes`:

```
:304  const totalHop = matchingLanes.reduce(...)
:305  const ticketCount = matchingLanes.reduce(...)
:306  const overCapBy = Math.max(0, totalHop - HOP_CAP_EXPORTED);
:307  const anySingleLaneReportsOverCap = matchingLanes.some(...)
```

I grepped the whole module for any remaining read of the unfiltered `lanes` in a
numeric context. The only survivors are `lanes` itself (the carried report
array), `anyUnattributableLane` at `:300`, and the render's `totalLanes` /
`readableLanes` / `matchingLaneCount` at `:348-349`, `:379` — all of which are
*supposed* to span every lane, because AC4 requires every lane to stay visible.
No sum, no cap comparison, and no verdict input reads the unfiltered list.

The three lane-map branches all carry `activeFeature` from `LaneInfo` as claimed:
`:249` (provider-unreadable), `:266` (second-level `parseHandoff` returned null),
`:285` (second-level `parseHandoff` threw), plus `:275` (readable). The field is
declared on `RollupReportLane` at `:190` and emitted into
`dist/tools/feature-rollup.d.ts:31`, so E130's future import sees it.

#### `anySingleLaneReportsOverCap` cannot read from the unfiltered list — confirmed empirically

Reading `:307` shows the receiver is `matchingLanes`, but a receiver can be right
and the behaviour still wrong if the filter is populated wrongly, so I forced the
case. Provider returning three readable lanes — one matching at `hopCount: 4`,
two non-matching at `hopCount: 99` each:

```
Rolled up 1 of 3 lane(s) with active_feature === "F"; totals below reflect only the matching lane(s).
Totals — hop: 4 (cap 10)
VERDICT: feature total is within cap across all lanes.
```

`anySingleLaneReportsOverCap: false` and `overCapBy: 0` with 198 unrelated
over-cap hops sitting in the same `lanes` array. Pre-fix this would have reported
`202, OVER BY 192` and fired the note line. The scoping is real.

#### The two new `degraded` triggers fire where they should

`:299` (`zeroMatchingLanes`), `:300-302` (`anyUnattributableLane`), both folded
into the existing `degraded` at `:311-312` with no new field, as reported.
Measured:

| case | `degraded` | banner line idx | reason fired |
|---|---|---|---|
| 2 readable lanes, none matching | true | 0 | zero-match |
| 2 readable lanes, both `activeFeature: null` | true | 0 | zero-match |
| 1 matching + 1 readable w/ `activeFeature: null` | true | 0 | unattributable |
| 1 matching + 1 unreadable | true | 0 | unreadable |
| provider throws | true | 0 | provider-threw |
| `lanes: []` + provider claims `degraded: false` | true | 0 | zero-match |
| 2 matching, sum over cap | false | — | (correctly clean) |
| 1 matching over cap + 1 non-matching | false | — | (correctly clean) |
| 1 matching + 2 non-matching | false | — | (correctly clean) |

Two things worth stating because they are load-bearing and not obvious:

1. **A lane that is unreadable can never sneak into `matchingLanes` via the
   default provider.** `localFallbackLaneList` sets `activeFeature: null` on both
   failure branches (`:121`, `:149`), and `null === featureId` is false for every
   string, so unreadable lanes are structurally unmatchable. A *custom* provider
   could return `readable: false` with a non-null `activeFeature` — I tested that
   too, and it enters the sum, but `:245-246` sets `anyLaneUnreadableHere` first,
   so the result is degraded and the banner fires. Honest either way.
2. **The zero-fill at `:304` (`lane.hopCount ?? 0`) is still unreachable for a
   clean matching lane.** Re-verified for round 2: `tools/handoff-parse.ts:295-297`
   always materialises `hop_count` as a finite number ≥ 0 and
   `tools/handoff-types.ts:72` types it `hop_count: number`, so the guard at
   `:135` can only yield `null` on a path that has already set
   `anyUnreadable`/`anyLaneUnreadableHere`. A silent zero-filled lane inside a
   banner-less total is not reachable. This was the sharpest remaining way to
   print a wrong number quietly, and it is closed.

I also confirmed `state.completed_tasks` is always an array
(`tools/handoff-parse.ts:225`, typed `string[]`), so `:305` and `:374` cannot
throw on a partially-populated handoff — `computeFeatureRollup`'s "never throws"
contract holds.

#### AC5 — no regression, and now stronger than round 1

`renderRollupReport:351-359` pushes the banner into an empty `lines[]` before any
other push, unconditionally on `report.degraded`. There is no early-return, no
alternate entry point, and no branch that emits a total ahead of it. Measured
across all 9 degraded fixtures: banner at index 0, `Totals —` at index 8 or 11.
Round 1 verified this empirically for the read-failure cases only; it now also
holds for the two attribution cases, which is a strict expansion of the property,
not a regression.

#### Is there any remaining path where a non-feature number prints without a banner?

This was the question to hunt, so I want to be explicit about the one residual I
found and why it does not block.

**A lane that has since rolled on to a later feature is silently excluded.** If
lane X burned 6 hops on feature F and its `active_feature` has since advanced to
G, X does not match, contributes nothing, and nothing degrades — the printed
total *under*-reports F. No banner.

I am not blocking on it, for reasons that are about the shape of the disclosure
rather than charity toward the fix:

- The number is not mislabelled. `:379-383` prints `Rolled up N of M lane(s) with
  active_feature === "<F>"; totals below reflect only the matching lane(s)`
  immediately above `Totals`, and the table carries an `active_feature` column
  and a `matches` column for every lane. A human reading the output can see both
  the rule and every row it excluded. Round 1's defect was the opposite: twelve
  opaque paths, no feature column, and a confident whole-repo sum.
- The direction of the error is now conservative. Round 1 over-reported 54 vs a
  true 3 and instructed escalation; this under-reports only for lanes that have
  already moved on, which at feature-close time — the moment the coord-03
  obligation fires — is precisely when `active_feature` is most accurate.
- Exactness here needs a lane→feature history, which is `tools/lane-registry.ts`
  (E132) by the spec's own division of labour. The module says so at `:36-40`.

Recorded below as a carry-forward, not a finding against this cut.

#### Note on AC3's literal wording

Round 1 resolved AC3's "includes every worktree found … sums their `hop_count`s"
against the Problem Statement. The fix satisfies both readings simultaneously and
the tension is now moot: every worktree found *is* included in the report
(`:369-376` iterates `report.lanes`, all 12 rows present in the live run), and
only the attributable subset is summed. No further action.

### Quality

No blocking findings. Three nits, all cosmetic:

1. **`:353` — the banner's readable-count is a non-sequitur for the two new
   triggers.** On an attribution-only degradation it renders `ROLL-UP INCOMPLETE
   — 12 of 12 lane(s) readable; totals below are NOT a verified feature total.`
   Twelve of twelve *is* the truth, and the load-bearing clause ("NOT a verified
   feature total") plus the `Reason:` line carry the real cause — so AC5 is
   satisfied and this is not a finding. But a reader may briefly wonder why a
   fully-readable roll-up is incomplete. A conditional lead (readability count
   when the cause is readability, match count when it is attribution) would read
   better. Not worth a round.
2. **`:403` — `VERDICT: feature total is within cap across all lanes.`** "across
   all lanes" overstates when only a subset matched; in the live run it follows a
   line that just said 1 of 12. `across the N matching lane(s)` would be exact.
   The same phrase in the over-cap branch at `:400` has the same looseness. Again
   the qualifying line is two lines above and the table is directly present, so
   nothing is concealed.
3. **`:379` recomputes the match filter** already computed at `:298` in
   `computeFeatureRollup`. The two predicates are byte-identical today, so the
   "Rolled up N" count cannot disagree with the totals — but they are two
   independent copies of one rule, and a future edit to one is a silent
   divergence between the stated scope and the summed scope. Threading
   `matchingLaneCount` onto `RollupReport` would make the coupling structural.
   Low priority; flagging it because this module's whole purpose is that the
   printed scope and the summed scope agree.

The round-2 additions to the module header (`:33-40`) are good: they state the
attribution rule, name it a heuristic, and name E132 as the owner of exactness.

### Architecture

**AC2 seam intact — zero call-site change for a future provider.** The seam is
the `LaneListProvider` signature `(repoRoot: string) => LaneListResult` at `:70`
and the injection point at `:225` (`opts?.laneListProvider ?? localFallbackLaneList`).
Neither changed this round. Critically, the fix required **no** widening of the
provider contract: `LaneInfo.activeFeature` was already in the spec's interface
(`specs/e113-feature-level-rollup.md:121`) and already populated by the default
provider at `:133`; round 2 only stopped discarding it. `SEAM FOR E132` is at
`:72`. E132 drops in unchanged.

**One intentional deviation from the spec's literal interface listing.**
`specs/e113-feature-level-rollup.md:148` types `RollupReport.lanes` as
`Array<{ workspacePath; ticketsCompleted; status; hopCount; readable }>` — no
`activeFeature`. The implementation adds it. This is additive (a superset), it is
what the round-1 finding required, and it cannot break a consumer that reads
fields rather than constructs them — which is exactly E130's usage. Approved as a
justified widening; noting it so E115's/E130's cutters diff against the built
shape, not the spec snippet.

**E130/Wave-7 hook — no regression.** `computeFeatureRollup` and
`renderRollupReport` remain plain named exports (`:220`, `:346`) from a compiled
`tools/*.ts`; `dist/tools/feature-rollup.d.ts` emits both with the widened lane
shape. The fix landed inside `computeFeatureRollup`, not in the CLI, so
`agc feature finish` inherits the corrected attribution automatically — which is
what round 1 asked for.

**Carry-forwards for E132's cutter** (round-1 non-blocking items, re-checked and
still applicable — deliberately out of sr's scope this round, not blocking now):

- *Provider bypass*, round 1 cited at `:246-247`, now at **`:261`**:
  `computeFeatureRollup` still calls `parseHandoff(lane.workspacePath)` directly
  for `completed_tasks` instead of sourcing it through the provider. An E132
  registry describing lanes that are not local worktrees would have every lane
  downgraded to `readable: false`. E132 should either extend `LaneListProvider`
  with an optional `ticketsCompleted`, or have `computeFeatureRollup` prefer
  provider-supplied ticket data when present.
- *2N handoff reads* (`:116` in the provider, `:261` here). Immaterial at 12
  worktrees; collapses to N if the bypass above is resolved.
- *Heuristic attribution* (new this round): a lane that has advanced past the
  feature is excluded silently. E132's registry is the place to give
  `computeFeatureRollup` a lane→feature history so historical lanes can be summed
  (or explicitly disclosed) rather than dropped.

### Security

No findings; no new surface this round. `execFileSync` at `:81-84` is unchanged —
still the argv-array form, fixed binary, fixed arguments, no shell. The new code
paths add only array filtering and string interpolation into stdout. `featureId`
is now compared against `activeFeature` and interpolated into the report; it
still never reaches a path, a command, or a query.

### Performance

No blocking findings; no regression vs round 1.

- The fix adds one `.filter()` (`:298`), one `.some()` (`:300`), and one
  `.filter().length` in the render (`:379`) — three extra O(n) passes over the
  lane array, n = worktree count (12 observed). Immaterial.
- The reduces at `:304-305` now run over `matchingLanes` (≤ n) rather than
  `lanes`, so the arithmetic is strictly cheaper than round 1.
- No change to I/O: still one `git` subprocess, still 2N handoff parses (carried
  forward above, unchanged this round). No new caches, listeners, or retained
  references.

### Boundary / scope checks

Verified against the tree, not taken on trust:

- `git diff --stat 1b5a48c -- test/` → empty. **Zero `test/**` changes** (AC6,
  Constitution §2). T-E113-03 correctly left to qa; its absence is not a finding.
- `git diff --stat 1b5a48c -- scripts/verify-release.mjs tools/handoff-write.ts tools/drift.ts tools/lane-registry.ts` → empty. Boundary intact.
- `git diff --stat 1b5a48c -- docs/backlog.md` → empty. **AC8 passes**, no
  premature done-mark.
- `content/coord-03-core-fallback.md`: 1 insertion / 1 deletion vs base — the
  round-1 sentence, untouched this round. Not re-reviewed, per scope.
- Working tree source changes this round are confined to `tools/feature-rollup.ts`
  and the regenerated `dist/tools/feature-rollup.{js,d.ts,js.map,d.ts.map}`.
  `dist` and source share an mtime and `dist` carries the fix (`matchingLanes`,
  `zeroMatchingLanes`, `anyUnattributableLane` all present in the compiled
  output) — the build is not stale.
- `npx tsc --noEmit` → exit 0.
- No bare `10` literal anywhere in the module; the cap reaches all four use sites
  (`:306`, `:308`, `:328`, and the doc comment at `:214`) via the `:44` import of
  `HOP_CAP_EXPORTED`. **Not hardcoded.**

### Model-bias note

sr-engineer ran pinned to `fable`; this review ran on `opus`, as in round 1.
Different models, no same-model blind-spot concern. sr's handoff notes described
the fix accurately — every claim I checked (three lane-map branches, filtered
derivation, two triggers routed through the existing path, no new field, four
render additions) matched the code. I verified each independently rather than
accepting the summary, and the one thing the notes did not mention — that a
rolled-on lane is now silently excluded — I found by reading, not by being told.
That is a limitation of the approach, not a concealment.

### Verdict

**APPROVED** — `computeFeatureRollup` now attributes lanes to `featureId` before
summing (`:298`), every total and cap comparison including
`anySingleLaneReportsOverCap` reads only the matching set, and the two new
attribution failures route through the existing degrade-honestly path so the
`ROLL-UP INCOMPLETE` banner leads the output in every degraded case. Across nine
injected-provider fixtures plus the live 12-worktree run I found no path that
prints a number other than this feature's total without a banner. Five
non-blocking notes recorded: two render-wording nits, one duplicated-predicate
nit, and three carry-forwards for E132's cutter (provider bypass at `:261`, 2N
reads, heuristic attribution of rolled-on lanes).
