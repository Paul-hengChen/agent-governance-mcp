# e113-feature-level-rollup — E113

Ticket: `docs/backlog.md:235` E113 — Wave 3 of `docs/v4.0.0-execution-plan.md`
("扇出語意", `:533`), lane **L-CONTENT** (the only Wave 3 lane permitted to touch
`content/`, per the Wave 3 派工卡 at `:557`). Pre-sliced by
`docs/v4.0.0-execution-plan.md:839` ("E113（跨兩個 surface）") into T-E113-01
(SOP obligation prose) and T-E113-02 (the close-out surface it writes to).
Constrained by E109 (`docs/backlog.md:231`, already decided — declare-as-designed,
shipped v3.113.0), E132 (`docs/backlog.md:254`, NOT built yet — sibling Wave 3
lane, queued behind E116), and E130 (`docs/backlog.md:252`, Wave 7 — will call
this same surface at close-out).

Lane: worktree `<lanes-root>/e113`, branch
`feat/e113-feature-level-rollup`, base `1b5a48c`. One lane, one review round, one
QA round.

## Problem Statement

Every feature-scoped cost brake (`hop_count`, `review_round`/`qa_round`, telemetry,
token budget) is computed and capped **per workspace**. E109 already settled that
this per-lane scoping is *correct* — a lane is a bounded work unit, and making
caps span workspaces would need cross-workspace reads the server deliberately
does not do. But when one feature fans out across N lanes, the caps' correctness
*within* a lane produces a blind spot *across* lanes: no single `tw_get_state`
read, from any one lane, ever shows the feature's true total.

Measured on one NDI feature (`screen-source-list`, 7 tickets, 5 lanes): `hop` cap
is 10; actual consumption was 8+4+6+4+6 = **28**, a 2.8x overshoot, and no single
lane's read ever showed more than 8 — the cap structurally cannot fire.
`review_round`/`qa_round` are per-lane, so four lanes could burn 12
`CHANGES_REQUESTED` rounds without ever locking back to PM (the per-lane
`ROUND_CAP`/`REVIEW_ROUND_CAP` = 4 each). Telemetry splits N ways (measured
67/1/2/1/2 on the same feature), so `tw_gate_stats` — the data source the E6
retirement retro runs on — under-reports for any fanned-out feature. The token
brake divides identically: N `usage.jsonl` sidecars at ~1/N of the true total
each, so an 80%-of-budget brake never trips.

**Direction is settled by E109 — not re-litigated here.** The fix is NOT making
caps span lanes; a per-lane budget is correct for a lane. The fix is an explicit
**PM/coordinator obligation at feature close**: enumerate every lane's ticket,
status, and hop, sum them, and put the true total in front of a human at least
once. Today only prose in a tracked backlog does this, by accident — E113 makes
it a stated SOP obligation backed by a real surface, not a hoped-for human habit.

**The hard part is not the arithmetic — it's the data source.** The derived lane
list (`git worktree list --porcelain` + each worktree's own handoff) is E132's
deliverable, and **E132 is not built yet** (queued behind E116 in this same
wave). E113 cannot block on E132. This spec defines the roll-up obligation and
surface with a clean seam for E132's lane list to be plugged in later — the
surface must be genuinely useful today (via a local fallback derivation) and
require zero changes to its call sites once E132 ships.

## User Stories

- As a PM/coordinator closing out a fanned-out feature, I want a single command
  that sums every lane's ticket, status, and hop, so the 28-vs-10 class of
  overshoot reaches a human at least once instead of staying invisible inside
  five separate per-lane reads.
- As the future E130 close-out path (Wave 7, `agc feature finish`), I want this
  roll-up surface already built and importable, so Wave 7 does not have to
  rebuild the same lane-summation logic E113 already wrote.
- As the future E132 lane-list module, I want a single, explicit injection point
  to plug into, so landing E132 requires zero changes to E113's call sites — only
  swapping which lane-list function is passed in.
- As a human reading the roll-up output, when the lane list cannot be derived
  (git failure, unreadable lane handoff, or the current tree isn't in a
  worktree-fan-out at all), I want the surface to say so explicitly, so a
  one-lane number is never mistaken for a feature total.

## Design

### T-E113-01 — SOP obligation prose (`content/coord-03-core-fallback.md`)

Add a new sentence to the **Feature-Scope Gate** paragraph, immediately after the
existing E109 "Anchoring rule" sentence (same paragraph — both sentences are
about what per-workspace scoping means for a fanned-out feature; splitting them
into separate paragraphs would restate context already stated once).

New normative text (bold lead-in, `<!-- origin:start/end -->` tagged E113, exact
wording finalized by sr-engineer against the measured-bundle budget below):

> **Feature-close roll-up obligation** (E113): because every cap above is
> per-workspace, a fanned-out feature's true total (summed `hop_count`, summed
> review/qa rounds, summed ticket count) is invisible to any single lane's
> `tw_get_state` read and can silently exceed a cap no individual lane ever
> hits. Before declaring a multi-lane feature closed, the PM or coordinator MUST
> derive the lane list, sum each lane's ticket/status/hop, and present the total
> against the relevant cap(s) to the human at least once — run
> `node scripts/feature-rollup.mjs <feature>` (or call
> `computeFeatureRollup()` programmatically) and quote its output. If the lane
> list cannot be derived, the surface says so explicitly — it never reports a
> single lane's numbers as if they were the feature's. This is a reporting
> obligation, not a new cap: per-lane budgets remain correct for a lane (see
> Anchoring rule above); nothing here makes `hop`/round caps span workspaces.

This is the single deliverable for T-E113-01 — do not restate it a second time
in the same file (E59 precedent, reused by E109's own AC1).

### T-E113-02 — the close-out surface (NEW module, NOT `scripts/verify-release.mjs`)

**Deliberately a new module, not an addition to `scripts/verify-release.mjs`.**
E115's join self-check (not yet started) is also likely to land in
`scripts/verify-release.mjs` — see *Coordination / file-collision note* below.
Following the standing precedent of E132 dodging E116 by using a new
`tools/lane-registry.ts` rather than editing `tools/handoff-write.ts`, E113 dodges
E115 the same way: a new module, not a shared one.

**New files:**

- `tools/feature-rollup.ts` — the core logic (compiled to `dist/tools/feature-rollup.js`
  like every other `tools/*.ts`; testable directly with `node --test`).
- `scripts/feature-rollup.mjs` — a thin CLI wrapper over the compiled module,
  following the existing `scripts/summarize-metrics.mjs` / `scripts/smoke-rag.mjs`
  pattern (plain Node ESM script importing from `dist/tools/*.js`).

**Interface (`tools/feature-rollup.ts`):**

```ts
export interface LaneInfo {
  workspacePath: string;
  activeFeature: string | null;
  status: string | null;
  hopCount: number | null;
  lastAgent: string | null;
  lastUpdated: string | null;
  readable: boolean;      // false when this lane's handoff could not be parsed
  error?: string;
}

export interface LaneListResult {
  source: "lane-registry" | "local-fallback";
  lanes: LaneInfo[];
  degraded: boolean;         // true if derivation was partial or unavailable
  degradedReason?: string;
}

export type LaneListProvider = (repoRoot: string) => LaneListResult;

// SEAM FOR E132: the default provider. Once tools/lane-registry.ts ships,
// pass its exported list function as the `laneListProvider` option below —
// computeFeatureRollup's internals do not change; only which provider is
// passed changes. Never throws: git failures, a non-worktree tree, or an
// unreadable lane handoff degrade the result, they never crash the caller.
export function localFallbackLaneList(repoRoot: string): LaneListResult;

export interface RollupReport {
  featureId: string;
  lanes: Array<{ workspacePath: string; ticketsCompleted: string[]; status: string | null; hopCount: number | null; readable: boolean }>;
  totals: { hopCount: number; ticketCount: number };
  capComparison: { hopCap: number; totalHop: number; overCapBy: number; anySingleLaneReportsOverCap: boolean };
  degraded: boolean;
  degradedReason?: string;   // set whenever `degraded` is true; always human-readable
}

export function computeFeatureRollup(
  featureId: string,
  opts?: { repoRoot?: string; laneListProvider?: LaneListProvider },
): RollupReport;

export function renderRollupReport(report: RollupReport): string; // human-readable table + verdict line
```

`computeFeatureRollup` imports `HOP_CAP_EXPORTED` from `tools/transitions.ts`
(never hardcodes the cap) and `parseHandoff`/`readHandoffState` from
`tools/handoff-parse.ts` to read each lane's own `.current/handoff.md`.
`localFallbackLaneList` shells out to `git worktree list --porcelain`, and for
each worktree path attempts `parseHandoff(worktreePath)`; a worktree whose
handoff cannot be read/parsed is included in `lanes` with `readable: false` and
`degraded: true` on the overall result, never silently dropped or silently
zero-filled.

**Degrade-honestly requirement (hard AC):** when lane-list derivation fails
outright (not a git repo, `git worktree list` errors, or the only worktree found
is the current one with no siblings), `RollupReport.degraded` is `true`,
`degradedReason` states the cause in plain language, and `renderRollupReport`'s
output leads with an explicit banner (e.g. `"ROLL-UP INCOMPLETE — N of M lanes
readable; totals below are NOT a verified feature total"`) rather than silently
presenting a partial or single-lane sum as the feature total.

**Forward hook for E130 (Wave 7):** `computeFeatureRollup`/`renderRollupReport`
are plain exported functions from a compiled `tools/*.ts` module — the same
shape every other `tw_*`-adjacent tool uses. E130/E73's eventual
`agc feature finish` (Wave 5/7) calls them directly
(`import { computeFeatureRollup, renderRollupReport } from "../tools/feature-rollup.js"`)
with no interface change required; `scripts/feature-rollup.mjs` remains the
manual entry point until that automation exists. This satisfies the ticket's
"leave the interface callable from there so Wave 7 does not rebuild it."

**Coordination / file-collision note (hard DoD item):** this cut's file list is
declared verbatim in the `tw_update_state` `scope_decision_why` field so the
session that later cuts E115 can diff against it:

- `content/coord-03-core-fallback.md` (T-E113-01)
- `tools/feature-rollup.ts` (NEW, T-E113-02)
- `scripts/feature-rollup.mjs` (NEW, T-E113-02)
- `test/feature-rollup.test.mjs` (NEW, qa-owned per Constitution §2)
- `test/context-budget.test.mjs` (qa re-baseline task — floor move only)
- `test/fixtures/compose-golden/**` (qa re-baseline — regenerated via
  `scripts/capture-constitution-golden.mjs`, not hand-edited)
- `specs/e113-feature-level-rollup.md` (this file)

Explicitly NOT touched: `scripts/verify-release.mjs`, `tools/handoff-write.ts`
(E116's lane), `tools/drift.ts` (E112's lane), `tools/lane-registry.ts` (E132's
lane — not implemented here, only seamed against by name/shape),
`docs/backlog.md` done-marks (release-engineer, post-PASS).

## Acceptance Criteria

- **AC1** — Given the merged change, when `content/coord-03-core-fallback.md`'s
  Feature-Scope Gate paragraph is read, then it states, in normative language,
  the feature-close roll-up obligation from the Design section above: PM/
  coordinator MUST derive the lane list, sum ticket/status/hop across lanes, and
  present the total against the cap to the human before declaring a multi-lane
  feature closed. Single deliverable — not restated elsewhere in the file.
- **AC2** — Given the merged change, when `tools/feature-rollup.ts` is read, then
  it exports `computeFeatureRollup`, `renderRollupReport`, `localFallbackLaneList`,
  and the `LaneInfo`/`LaneListResult`/`RollupReport`/`LaneListProvider` shapes
  from the Design section, with `localFallbackLaneList` as the default provider
  and a code comment marking it as the E132 seam.
  proof: `grep -n "SEAM FOR E132" tools/feature-rollup.ts` finds the marker comment.
- **AC3** — Given a repo with 2+ git worktrees each holding a valid
  `.current/handoff.md`, when `node scripts/feature-rollup.mjs <feature>` is run
  from any one of them, then the printed report includes every worktree found by
  `git worktree list --porcelain`, sums their `hop_count`s, and compares the sum
  against `HOP_CAP_EXPORTED` (imported, not hardcoded).
- **AC4** — Given a lane whose `.current/handoff.md` is missing or unparseable,
  when the roll-up runs, then that lane appears in the report with
  `readable: false` (never silently dropped, never treated as `hopCount: 0`),
  and the overall result is `degraded: true` with a stated `degradedReason`.
- **AC5 (degrade-honestly, hard AC)** — Given a tree where lane-list derivation
  fails outright (e.g. not a git repo, or `git worktree list` errors), when the
  roll-up runs, then `renderRollupReport`'s output leads with an explicit
  "ROLL-UP INCOMPLETE" banner and does NOT present any single-lane total as the
  feature total.
  proof: unit test forces a `git worktree list` failure and asserts the banner
  string appears and no bare numeric "total" line appears without it.
- **AC6** — Given the merged change, when `git diff --stat` against the
  pre-lane commit is inspected, then the touched files are exactly the list in
  the Design section's "Coordination / file-collision note" (plus the spec file
  itself) — zero touches to `scripts/verify-release.mjs`, `tools/handoff-write.ts`,
  `tools/drift.ts`, or `tools/lane-registry.ts`.
  proof: `git diff --stat main -- scripts/verify-release.mjs tools/handoff-write.ts tools/drift.ts tools/lane-registry.ts` prints nothing.
- **AC7** — Given the merged change, when the compose-golden fixture and the
  context-budget floor covering `content/coord-03-core-fallback.md` (currently
  18747, `test/context-budget.test.mjs:1096`) are re-run, then they are
  re-baselined to the new measured value (qa-owned, not sr-engineer's — see
  Dependencies below). Before raising the floor, qa-engineer checks whether the
  new prose can be wrapped in a rationale fence instead — per the assignment's
  explicit warning, do NOT take that route: Wave 2 measured and rejected it,
  because the fence is stripped by the default compose pass, deleting normative
  obligation prose from the bundle. Expect the floor to move; do not attempt to
  avoid moving it via fencing.
- **AC8** — Given the merged change, when `docs/backlog.md`'s E113 row is
  inspected, then it has NOT been done-marked by sr-engineer or qa-engineer —
  that is release-engineer's job, post-PASS.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature is internal governance tooling/prose, not user-facing product copy |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets (CLI text output only) |

## Out of Scope

- Building E132's `tools/lane-registry.ts` or its `tw_get_state` integration
  point — E113 only seams against its future shape (a `LaneListProvider`
  matching the interface above); consuming it is an integration-layer item
  explicitly owned by the E132/integrator session, not this cut.
- Building E115's join self-check, or resolving where it lands in
  `scripts/verify-release.mjs` — E113 dodges the collision by using a new
  module; E115's own cut decides its own file.
- Building E116's ledger-overwrite fix or E112's drift-detection fix — separate
  Wave 3 lanes, hard-boundaried out per the assignment.
- Building E73's `agc feature start`/`agc feature finish` or E130's worktree-
  default switch — Wave 5/7; this spec only documents the forward-hook call
  shape they will use.
- Making any cap (`hop`, `review_round`, `qa_round`, telemetry, token budget)
  span workspaces — explicitly rejected by E109; the roll-up is a report, not a
  new enforcement mechanism, and fires no gate.
- `docs/backlog.md` done-marking — release-engineer, post-PASS (SOP step 7c).

## Dependencies / Prerequisites

- E109 merged (v3.113.0) — the Anchoring rule sentence this obligation attaches
  to already exists in `content/coord-03-core-fallback.md`.
- E132 NOT required and NOT blocking — `localFallbackLaneList` (git
  worktree list --porcelain, direct handoff reads) is a fully functional
  standalone data source; E132, when it ships, is a drop-in replacement passed
  via `laneListProvider`, not a prerequisite.
- **qa-engineer, not sr-engineer, owns**: re-baselining the golden compose
  fixture and the `content/coord-03-core-fallback.md` context-budget floor this
  edit moves (currently 18747, per E109/E142 precedent of splitting this into
  its own qa-owned task). Do not fence the new prose to avoid the re-baseline —
  see AC7.
- Known drift in this lane's `.current/handoff.md` vs `tasks.md` — T-E114-01,
  T-E114-02, T-E114-03 — is E114's, landed on this lane's base commit ahead of
  this lane's own handoff snapshot; not reconciled by this cut.
