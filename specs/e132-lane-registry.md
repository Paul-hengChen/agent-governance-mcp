# e132-lane-registry — E132

Ticket: `docs/backlog.md:254` E132 — Wave 3 of `docs/v4.0.0-execution-plan.md`,
row `13t` (`docs/backlog.md:317`, mini-chain: one new read-only module + one
integration point + qa-owned cases). Sequenced into Wave 3 alongside
E112–E116 because E113 (already shipped, v3.114.0) has no other data source
for its feature roll-up. Uses a NEW module specifically to avoid colliding
with E116's `tools/handoff-write.ts` work in the same wave — its single
`tw_get_state` integration line falls in L-STATE's territory (E116 lands
first; this cut wires in after).

Lane: worktree `<lanes-root>/e132`, branch
`feat/e132-lane-registry`, base `e784a3b`. One lane, one review round, one QA
round. `qa_reports/`, `review_reports/`, `specs/` are tracked real
directories in this worktree (no symlink bootstrap needed).

## Problem Statement

Each git worktree holds its own `.current/`, a different filesystem tree, so
an in-flight lane is structurally invisible to its siblings: scanning
`.current/` finds only lanes that already merged, which is exactly backwards
from what a coordinator needs. `git worktree list --porcelain` already knows
every worktree of the repo and its branch — the metadata lives in the shared
`$GIT_COMMON_DIR`, so any lane can read it — and each worktree's own handoff
supplies `active_feature`, `status`, `hop_count`, and the current role. E113
already built `localFallbackLaneList` (`tools/feature-rollup.ts`), a fully
functional standalone provider that derives exactly this list on demand for
its feature-level roll-up. This ticket promotes that mechanism into a
dedicated, richer module wired into the one surface every role already
reads — `tw_get_state` — and closes three specific gaps E113 left for E132
by name (see *E113 hand-forward dispositions* below).

**Deliberately NOT a registry file that lanes write into.** A written
registry re-introduces a shared write target — precisely what the E123
layout exists to eliminate — and goes stale the moment a lane dies without
cleaning up. A derived list cannot be wrong because it has no stored copy to
drift. This module is read-only: it performs no writes, creates no lockfile,
sends no heartbeat, and authors no lane-side state.

### Design question the ticket asks PM to settle: what does a new module add over promoting `localFallbackLaneList`?

Honest answer, stated up front rather than padded: **mechanically, nothing
new is invented.** `tools/lane-registry.ts` does not re-shell `git worktree
list` — it imports and calls `localFallbackLaneList` for the actual
derivation, so there is exactly one place in the codebase that shells out to
git for worktree enumeration. What justifies a *separate* module rather than
editing `localFallbackLaneList` in place are two genuinely different
capabilities, each with a different cost profile that the OTHER consumer
does not want to pay:

1. **Feature-history attribution** (the fix for hand-forward item 3 below).
   `localFallbackLaneList` only ever reports a lane's *current*
   `active_feature`. Recovering a lane's *past* features requires an extra
   filesystem scan of `.current/archive/` per lane (E116's archive) — real
   but non-trivial I/O that `computeFeatureRollup`'s existing callers never
   asked for and should not silently start paying on every roll-up.
2. **A second, cheaper entry point for `tw_get_state`.** `tw_get_state` is
   the hottest read in the server (every role's mandatory first action). It
   must not pay for a ticket-list read or an archive scan just to answer "who
   else is working, and on what." That is a different cost/safety contract
   than `computeFeatureRollup`'s (occasional, human-invoked, tickets-and-all).

So `tools/lane-registry.ts` is thin by design: one function
(`laneRegistryList`) that decorates `localFallbackLaneList`'s output with
feature history for the roll-up consumer, and one function
(`getLaneRegistrySummary`) that calls `localFallbackLaneList` directly with a
hard cost ceiling and projects a minimal shape for the `tw_get_state`
consumer. Neither reimplements worktree enumeration or handoff parsing.

## User Stories

- As a coordinator working in one worktree, I want `tw_get_state` to tell me
  when sibling lanes exist and what they're doing, so I never again have to
  discover a third worktree by accident (as happened live, 2026-09-15).
- As E113's feature roll-up, I want a lane-list provider that also knows
  which lanes have *previously* worked a feature (not just currently), so a
  lane that moved on after doing real work no longer silently vanishes from
  the total with no degrade flag.
- As a human reading a roll-up or a `tw_get_state` advisory, I want an
  unreadable or unattributable lane to always be visible with the reason
  stated, never dropped and never presented as zero — the same
  degrade-honestly contract E113 established.
- As the server's hottest read path, I want the new advisory to cost almost
  nothing when there is nothing to report (no worktree fan-out, git
  unavailable), and to never throw or block regardless of what git does.

## E113 hand-forward dispositions (DoD item 4 — each resolved, not deferred)

**1. Provider bypass → FIXED.** `LaneInfo` gains an optional
`completedTasks?: string[] | null`. `localFallbackLaneList` (already reading
each lane's full handoff via `parseHandoff`) now populates it on the readable
branch. `computeFeatureRollup` prefers `lane.completedTasks` when the
provider populated it (an array, checked via `Array.isArray`), and falls
back to its own direct `parseHandoff` read only when the provider left the
field absent — preserving today's behavior for any third-party provider that
doesn't yet populate it.

**2. 2N handoff reads → FIXED as a consequence of (1).** When a provider
populates `completedTasks` (both `localFallbackLaneList` and
`laneRegistryList` do), `computeFeatureRollup` skips its own re-read
entirely: N reads total, not 2N. No behavior change is needed beyond (1).

**3. Silent under-report (the one that matters) → FIXED, scoped
deliberately narrow.** `LaneInfo` gains `featureHistory?: string[] | null`,
populated only by `laneRegistryList` (never by `localFallbackLaneList` — see
the cost-profile argument above). `computeFeatureRollup` now also computes
`anyHistoricalOnlyMatch`: true when a lane's *current* `activeFeature` !==
the requested `featureId` but its `featureHistory` array contains
`featureId`. This lane is still excluded from `totals`/`capComparison` — see
below for why — but it now sets `degraded: true` and a stated
`degradedReason` naming the count, and `renderRollupReport` prints an
explicit note line. **Scope decision, stated rather than silently taken:**
this cut does NOT retroactively sum a historically-matched lane's ticket
count or hop into the feature total. E116's archive holds the exact
snapshot at the moment the lane moved on, so recovering that number is
technically possible, but doing so risks double-counting against a cap
whose semantics (E109) are anchored to a lane's *current* feature, and
widens this cut well past its declared ~2-file, mini-chain budget. The
requirement this ticket exists to satisfy is **visibility** — no under-report
happens silently — not retroactive arithmetic; visibility is what ships.
Precedence when multiple degrade conditions hold simultaneously (most
actionable first): lane-list derivation failure → per-lane read failure →
historical-only match → zero current matches → unattributable (no
`active_feature` at all) lane.

## Design

### New module: `tools/lane-registry.ts`

Imports `localFallbackLaneList`, `LaneInfo`, `LaneListResult`,
`LaneListProvider` (types only) from `./feature-rollup.js`. No other module
shells out to `git worktree list` — this stays true after this cut.

```ts
/** Per-lane feature history, best-effort, derived from .current/archive/
 *  (E116). null = the archive directory does not exist for this lane (the
 *  lane has never changed active_feature — NOT the same as "no history
 *  found"); [] = the directory exists but yielded no parseable entries.
 *  Non-null entries are the exact (unsanitized) active_feature string
 *  recovered from each archived handoff's frontmatter, oldest to newest,
 *  ordered by each archived file's filesystem mtime (not by parsing the
 *  filename — the sanitized-feature segment may itself contain dots,
 *  making positional parsing ambiguous; mtime is set once by
 *  fs.copyFileSync at archive time and never touched again). */
export interface LaneFeatureHistory {
  featureHistory: string[] | null;
}

/** LaneListProvider-conformant (same signature as localFallbackLaneList) —
 *  the provider E113's roll-up wires in (DoD 2). Delegates worktree
 *  enumeration + handoff parsing to localFallbackLaneList (zero duplicated
 *  git-shelling) and additionally attaches featureHistory per lane.
 *  `source` reads "lane-registry" (the union member E113 reserved for this
 *  module) whenever this function, not localFallbackLaneList, is used. */
export function laneRegistryList(repoRoot: string): LaneListResult;

/** Exported for direct/unit use. Reads .current/archive/*.md under
 *  workspacePath; extracts only the `active_feature` frontmatter field via
 *  a local `---\n...\n---` regex + `yaml.load` (NOT parseHandoff — an
 *  archived file is a historical snapshot at an arbitrary path, not the
 *  live workspace's canonical handoff). Any file that fails to parse, has
 *  no frontmatter, or has a non-string active_feature is skipped silently
 *  (best-effort; never throws; never included as a null/empty-string
 *  history entry). */
export function getLaneFeatureHistory(workspacePath: string): LaneFeatureHistory;

export interface LaneRegistryAdvisoryLane {
  workspace_path: string;
  active_feature: string | null;
  status: string | null;
  last_agent: string | null;
}

export interface LaneRegistryAdvisory {
  lanes: LaneRegistryAdvisoryLane[];
  degraded: boolean;
  degraded_reason?: string;
}

/** Fast, cost-ceilinged summary for tw_get_state (DoD 3). Calls
 *  localFallbackLaneList(repoRoot, { timeoutMs: 200 }) directly — NOT
 *  laneRegistryList — deliberately skipping the archive scan: tw_get_state
 *  does not need feature history, and every lane on this path pays for
 *  every sibling's extra I/O on every single read. Returns null (no
 *  advisory to report) when there are 0 or 1 worktrees total (nothing to
 *  show — most workspaces are not part of a fan-out, and reporting nothing
 *  for the common case keeps the legacy tw_get_state payload byte-identical
 *  there, matching the exemptions/stale_dispatch precedent) or when git is
 *  unavailable/times out with zero lanes recovered. When 2+ worktrees are
 *  found and at least one sibling's handoff can't be read, returns the
 *  advisory with degraded: true and a stated reason (that lane is still
 *  carried, never dropped). Wrapped in try/catch as defense-in-depth
 *  (localFallbackLaneList already never throws, but this function must
 *  never be the reason tw_get_state's mandatory first-action read fails). */
export function getLaneRegistrySummary(
  repoRoot: string,
  opts?: { timeoutMs?: number },
): LaneRegistryAdvisory | null;
```

**Cost ceiling for `getLaneRegistrySummary` (the hottest-read concern):** one
`git worktree list --porcelain` subprocess call bounded by a 200ms timeout
(new optional `timeoutMs` on `localFallbackLaneList`, see below; fixed
constant here, not config-driven — same posture as `STALE_DISPATCH_THRESHOLD_MIN`
and `HOP_CAP`), plus one synchronous `parseHandoff` file read per sibling
lane (no archive scan, no ticket-list parse). Worktree counts are human-scale
(single digits to low tens); no parallelization is attempted. A timeout or
any git failure with zero lanes recovered degrades to `null` (key omitted
entirely from `tw_get_state`'s payload) rather than throwing or surfacing a
false alarm on every non-worktree workspace on earth.

### `tools/feature-rollup.ts` changes (additive only)

- `LaneInfo` gains `branch: string | null` (non-optional — always known once
  git succeeds; `null` only for detached HEAD or an unparseable porcelain
  block), `completedTasks?: string[] | null`, `featureHistory?: string[] | null`.
- `localFallbackLaneList`'s porcelain-block parser is extended to also
  capture each block's `branch refs/heads/<name>` (or `detached`) line
  alongside its `worktree <path>` line, and to populate `completedTasks`
  from `state.completed_tasks` on the readable branch. `featureHistory` is
  left `undefined` here (see the cost-profile argument above) — only
  `laneRegistryList` populates it.
- `localFallbackLaneList` gains an optional second parameter
  `opts?: { timeoutMs?: number }`, passed through to `execFileSync`'s
  `timeout` option. `undefined` (the default, used by every existing call
  site including `scripts/feature-rollup.mjs`) preserves today's behavior
  exactly — no timeout, matching the existing test suite. Only
  `getLaneRegistrySummary` passes an explicit `timeoutMs`.
- `RollupReportLane` gains `featureHistory?: string[] | null` (passthrough).
- `computeFeatureRollup`: the per-lane ticket-list branch prefers
  `lane.completedTasks` (via `Array.isArray`) over its own `parseHandoff`
  call (hand-forward items 1/2); `featureHistory` passes through on every
  returned lane. `anyHistoricalOnlyMatch` is computed per hand-forward item
  3 and folds into `degraded` and the `degradedReason` precedence chain
  above.
- `renderRollupReport`: when `anyHistoricalOnlyMatch` lanes exist, prints one
  additional note line naming the count and stating they are excluded from
  the totals — see Copy/Strings.

**New three-module import cycle, documented not avoided:**
`tools/handoff-parse.ts` → `tools/lane-registry.ts` → `tools/feature-rollup.ts`
→ `tools/handoff-parse.ts` (via `parseHandoff`). This is the same shape,
generalized to three nodes, as the existing documented
`tools/handoff-parse.ts` ↔ `tools/handoff-write.ts` cycle: every cross-edge
is a function reference used only inside a function body at call time, never
read at module-init time, so Node's ESM live-binding resolution is safe
regardless of load order. `tools/lane-registry.ts` carries a comment saying
so, mirroring the existing one. **Required verification (not optional):**
`npm run build` clean, plus the CLAUDE.md-documented boot smoke test (spawn
`dist/index.js`, send `initialize`, expect `"online"` on stderr) — a TDZ/
circular-import failure would surface there, not in unit tests.

### `scripts/feature-rollup.mjs` change (DoD 2 — "actually consuming it")

Import `laneRegistryList` from `../dist/tools/lane-registry.js` and pass it
as `laneListProvider` on the existing `computeFeatureRollup` call:

```js
import { computeFeatureRollup, renderRollupReport } from "../dist/tools/feature-rollup.js";
import { laneRegistryList } from "../dist/tools/lane-registry.js";
...
const report = computeFeatureRollup(featureId, { repoRoot, laneListProvider: laneRegistryList });
```

This is the manual entry point `content/coord-03-core-fallback.md`'s
Feature-close roll-up obligation already points a PM/coordinator at
(`content/` is out of scope for this cut — already correct prose, no edit
needed). After this change, running it produces `source: "lane-registry"`
reports carrying `featureHistory`, satisfying DoD 2 with no change to
`tools/feature-rollup.ts`'s own default (which stays `localFallbackLaneList`,
avoiding a circular default-value dependency at that module's own
top level).

### `tools/handoff-parse.ts` change (DoD 3 — wired into `tw_get_state`)

Alongside the existing `exemptions` / `configError` computations
(`readHandoffState`, near line 391), add:

```ts
const laneRegistry = getLaneRegistrySummary(workspacePath);
```

and spread it into **both** returned JSON shapes exactly like `exemptions`
(the `exists: false` early return AND the final return at
`tools/handoff-parse.ts:586-593`):

```ts
...(laneRegistry && { lane_registry: laneRegistry }),
```

Byte-identical legacy payload when `laneRegistry` is `null` (the common,
non-fan-out case). Never throws (see cost ceiling above); never blocks or
slows the read path beyond the stated 200ms worst case. `repoRoot` passed is
`workspacePath` itself (git resolves the shared `$GIT_COMMON_DIR` from any
worktree's own path; same call convention `localFallbackLaneList` already
uses). This is a pure read-time computation, like `stale_dispatch` and
`exemptions` — no `schema_version` bump, no new persisted `HandoffState`
field, no gate.

**File-mode only, matching the sibling E10/E18/E24 posture** (see the
existing `exemptions` comment at `tools/handoff-parse.ts:389`: "File-mode
read path only"). SQLite-mode `readState` (`tools/storage-sqlite.ts`) is
untouched — HTTP/containerized deployments have no local git worktree
concept to derive from, and `CLAUDE.md`'s own "What this server does NOT do"
already states the server is not cross-machine.

**Merge-attention flag:** E112's concurrently-running lane (`<lanes-root>/e112`)
edits `test/token-efficiency.test.mjs`. This cut's `tw_get_state` payload
change is additive-and-conditional (key present only with 2+ worktrees and
something to report), so no existing single-checkout test run should see a
new key — but the qa task below re-runs the full suite specifically to catch
any unexpected interaction before merge.

## Acceptance Criteria

- **AC1 (executable, read-only)** — Given a git checkout with 2+ worktrees
  each holding a `.current/handoff.md`, when `laneRegistryList(repoRoot)` is
  called, then it returns `source: "lane-registry"` and one lane entry per
  worktree found by `git worktree list --porcelain`, and it performs zero
  filesystem writes anywhere under any worktree.
  proof: `node --test test/e132-lane-registry.test.mjs -t "laneRegistryList is read-only"` — the test snapshots the mtime of every worktree's `.current/` directory (recursively) before and after the call and asserts no path's mtime changed.
- **AC2 (LaneListProvider + actually consumed)** — Given the merged change,
  when `scripts/feature-rollup.mjs <feature>` is run against a 2+-worktree
  repo, then its output's underlying `RollupReport` was computed with
  `laneRegistryList` as the provider (not the default), verified by
  `source: "lane-registry"` appearing in the underlying `LaneListResult`.
  proof: `node --test test/e132-lane-registry.test.mjs -t "scripts/feature-rollup.mjs wires laneRegistryList"`.
- **AC3 (wired into tw_get_state, non-blocking)** — Given a workspace that is
  one of 2+ git worktrees, when `tw_get_state` is called, then the returned
  JSON includes a `lane_registry` key shaped per `LaneRegistryAdvisory`;
  given a workspace that is the only worktree (or git is unavailable), when
  `tw_get_state` is called, then the returned JSON has NO `lane_registry` key
  and is otherwise byte-identical to the pre-E132 payload.
  proof: `node --test test/e132-lane-registry.test.mjs -t "tw_get_state lane_registry advisory"`.
- **AC4 (cost ceiling honored)** — Given `git worktree list` hangs or errors,
  when `getLaneRegistrySummary` is called, then it returns within the stated
  200ms ceiling (never blocks) and returns `null` rather than throwing.
  proof: `node --test test/e132-lane-registry.test.mjs -t "getLaneRegistrySummary never blocks or throws"` (stubs `execFileSync` to hang past the timeout).
- **AC5 (hand-forward item 1/2 — provider preference, N not 2N reads)** —
  Given a provider that populates `completedTasks` on every lane, when
  `computeFeatureRollup` runs, then it calls `parseHandoff` exactly once per
  lane in total (not twice), and the returned `ticketsCompleted` matches the
  provider's `completedTasks` verbatim.
  proof: `node --test test/feature-rollup.test.mjs -t "prefers provider completedTasks, one read per lane"` (spies on `parseHandoff` call count).
- **AC6 (hand-forward item 3 — historical-only match surfaced, not summed)**
  — Given a lane whose current `active_feature` differs from the requested
  `featureId` but whose `featureHistory` includes `featureId`, when
  `computeFeatureRollup(featureId)` runs, then that lane is excluded from
  `totals`/`capComparison` (unchanged arithmetic) AND `degraded` is `true`
  with a `degradedReason` naming the historical-only-match count, AND
  `renderRollupReport`'s output contains a note line naming the count.
  proof: `node --test test/feature-rollup.test.mjs -t "historical-only match sets degrade flag, excluded from totals"`.
- **AC7 (degrade-honestly holds for the new module)** — Given a lane whose
  `.current/archive/` directory does not exist, when
  `getLaneFeatureHistory(workspacePath)` runs, then it returns
  `featureHistory: null` (not `[]`) and never throws; given an archive
  directory containing one file with malformed frontmatter and one valid
  file, when it runs, then the malformed file is skipped and the valid
  file's `active_feature` is returned (never a crash, never a silent
  false-empty result presented as "definitely no history").
  proof: `node --test test/e132-lane-registry.test.mjs -t "getLaneFeatureHistory degrades honestly"`.
- **AC8 (no writable state introduced)** — Given `tools/lane-registry.ts`,
  when its source is scanned, then it contains no call to `fs.writeFile`,
  `fs.writeFileSync`, `fs.mkdir`, `fs.mkdirSync`, `fs.appendFile`, or
  `fs.appendFileSync` — no registry file, no lockfile, no heartbeat.
  proof: `grep -nE "fs\.(write|append|mkdir)" tools/lane-registry.ts` prints nothing.
- **AC9 (build + boot safety for the new import cycle)** — Given the merged
  change, when `npm run build` runs, then it exits 0; when the CLAUDE.md
  boot smoke test runs (`node -e "..."` spawning `dist/index.js`, sending
  `initialize`), then `"online"` appears on stderr with no thrown error.
  proof: `npm run build && node -e "$(cat <<'EOF'\n<boot smoke test body, see CLAUDE.md>\nEOF\n)"` exits 0.
- **AC10 (full suite green, no forbidden touches)** — Given the merged
  change, when `npm test` runs, then it is fully green, AND `git diff --stat
  main -- tools/drift.ts content/ scripts/verify-release.mjs docs/backlog.md`
  prints nothing (none of these files touched by this cut).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature is internal governance tooling/prose (a new `renderRollupReport` note line and JSON advisory keys), not user-facing product copy — same posture as E113's own spec |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets (backend module + CLI/JSON output only) |

## Out of Scope

- **A writable lane registry file, lockfile, or heartbeat mechanism** — hard
  requirement from the ticket, not a preference; the whole point of
  derivation is that there is no stored copy to drift.
- **E133** (two sessions on the same ticket in the same workspace) —
  explicitly deferred by E132's own backlog row; not absorbed here.
- **Cross-machine lane visibility** — inherited limit, not new; derivation
  only works where every worktree is on one machine (`CLAUDE.md`'s own "What
  this server does NOT do").
- **Retroactively summing a historically-matched lane's ticket/hop count
  into `computeFeatureRollup`'s totals** — see hand-forward item 3's scope
  decision above; this cut ships visibility of the gap, not arithmetic
  across it.
- **SQLite/HTTP-mode `readState`** — file-mode only, matching the sibling
  E10/E18/E24 posture; no local git worktree concept exists to derive from
  in that mode.
- **Any part of E112 (`tools/drift.ts`) or E115 (`scripts/verify-release.mjs`)**
  — separate Wave 3 lanes, hard-boundaried out per the assignment.
- **`docs/backlog.md` done-marking** — release-engineer, post-PASS.

## Dependencies / Prerequisites

- E113 merged (v3.114.0) — `tools/feature-rollup.ts`'s `LaneListProvider`
  seam, `localFallbackLaneList`, and the reserved `"lane-registry"` source
  tag already exist; this cut is the promised drop-in.
- E116 merged (v3.116.0 lineage, `tools/handoff-write.ts` archive-on-feature-
  change) — `.current/archive/<feature>.<pid>.<epoch>.md` is the exact,
  ordered per-lane feature-history record this cut's `getLaneFeatureHistory`
  reads. A lane that has never changed `active_feature` has no archive
  directory at all — `featureHistory: null` in that case, not `[]` (see
  AC7); this is a best-effort source, not a guarantee.
- **Known drift, do not reconcile**: this lane's committed `tasks.md` carries
  `[x]` marks for T-E113-01–05 and T-E116-01/03/04 that the committed
  `.current/handoff.md`'s `completed_tasks` does not — accumulated drift from
  the already-merged E113/E116 lanes. Not this cut's to fix; do not
  `tw_sync` or roll back.
- **Merge-attention item**: E112's concurrently-running sibling lane
  (`<lanes-root>/e112`) edits `test/token-efficiency.test.mjs`;
  this cut does not touch that file, but qa re-runs the full suite before
  PASS specifically to catch any unexpected interaction at merge time.
