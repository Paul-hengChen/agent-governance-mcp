# e123c-cross-lane-aggregation

## Problem Statement

`tw_gate_stats` (`tools/gate-stats.ts`) and the D2 token-usage sidecar
(`tools/usage-accounting.ts`) still read a single flat path —
`.current/telemetry.jsonl`, `.current/metrics.jsonl`, `.current/usage.jsonl` —
even though E123 F0/F1/J2 (e123a/e123b0-3/e123b9) already flipped every live
*writer* of those sidecars (`tools/telemetry.ts`, `tools/metrics.ts`) to write
lane-scoped paths (`.current/<lane>/<file>`) once a workspace has been
migrated. Since the flip, a workspace that has ever run a single `tw_*` call
writes new gate-fire/metrics records to `.current/<lane>/…`, but
`tw_gate_stats` keeps reading `.current/telemetry.jsonl`/`.current/metrics.jsonl`
— the pre-flip flat path — so it silently reports **zero new activity since
the flip**, on every migrated workspace, including this repo's own primary
checkout (`.current/_primary/`). `tools/usage-accounting.ts`'s own
`usagePath()` was left deliberately unflipped by e123b9 (its own test suite
says so explicitly), pending this ticket.

This is a **behaviour change to the E6 retro data source, not a rename**
(feature-split.md row 2): the fix is not "point at the new path instead of the
old one" — it's "sum across every lane a workspace's `.current/` has ever
hosted, live or closed, plus whatever a not-yet-migrated flat file still
holds," while guaranteeing no record is double-counted and none is missed.

Two related gaps, found during e123b9 (J2) and explicitly assigned to this
ticket, compound the same root problem — a caller resolves only the
lane-scoped path and never falls back to the flat one, so it goes blind on an
unmigrated workspace:

- **J2-NEW-3 (first bullet) + J2-NEW-9** — `tools/drift.ts`'s schema-version-skew
  precheck (`readArtifactVersion`, handoff branch, ~line 248) resolves only
  `resolveCurrentLanePaths(ws).handoffPath`. On an unmigrated flat workspace it
  sees nothing, so a from-the-future `schema_version` in the flat
  `handoff.md` isn't caught by the precheck — `parseHandoff`'s AC13 fallback
  then throws the raw "on-disk version > server max" refusal instead of the
  graceful "Schema version skew" drift reason this file exists to produce.
  Already documented as `test/drift-skew.test.mjs`'s "KNOWN GAP (J2-NEW-9)" test.
- **J2-NEW-3 (second bullet)** — `bin/agent-governance-usage-hook.mjs`'s
  `readActiveFeature` reads only the lane-scoped `handoffPath`. On an
  unmigrated workspace a `PostToolUse` event records `feature: null` instead
  of the real `active_feature`.

And one stale-prose finding:

- **L1-NEW-1** — `tools/registry.ts` still describes `tw_gate_stats` (tool
  description, ~:932) and a `workspace_path` refine comment (~:359) in
  flat-path terms. Both go stale the moment this ticket ships lane-aware
  aggregation.

## User Stories

- As the E6 rule-retirement retro owner, I want `tw_gate_stats` to count gate
  fires and feature outcomes across every lane a workspace has hosted (live,
  closed, and not-yet-migrated), so that the retro's zero-fire /
  fired-N-times numbers reflect everything that actually happened, not just
  whatever predates the lane flip.
- As the coordinator's Token Budget Brake, I want `sumUsageForFeature` to see
  every usage record for a feature regardless of which lane era wrote it, so
  that the brake doesn't silently reset to zero the moment a workspace
  migrates.
- As an operator reading `tw_detect_drift` on a workspace nobody has touched
  since the flip, I want a future-schema flat handoff to surface as a
  graceful "Schema version skew" drift reason, not an unhandled throw.

## Acceptance Criteria

- **AC1 (legacy single-workspace behaviour unchanged)** — Given a workspace
  with only a flat `.current/telemetry.jsonl` + `.current/metrics.jsonl` (no
  `.current/<lane>/` directories at all — the pre-E123 shape), when
  `tw_gate_stats` runs, then every count (`total_fires`, per-code `fires`,
  `metrics.features`, etc.) is byte-identical to reading that flat file alone.
  proof: `test/e26-gate-stats.test.mjs` — new case "flat-only workspace: counts
  unchanged from pre-F2 baseline".
- **AC2 (fan-out sum across live lanes)** — Given a workspace with two live
  lanes, `.current/lane-a/telemetry.jsonl` (3 fires) and
  `.current/lane-b/telemetry.jsonl` (2 fires), when `tw_gate_stats` runs, then
  `total_fires` = 5 and both lanes' `feature`/`agent_id` values appear in the
  matching code's `by_feature`/`by_agent` maps.
  proof: `test/e26-gate-stats.test.mjs` — new case "two live lanes: sums both,
  by_feature/by_agent carry both".
- **AC3 (closed-history lanes counted)** — Given a workspace with one live
  lane (1 fire) and one closed lane at
  `.current/history/2026-09/lane-c/telemetry.jsonl` (4 fires, distinct lane
  name from the live one), when `tw_gate_stats` runs, then `total_fires` = 5.
  proof: `test/e26-gate-stats.test.mjs` — new case "live + closed-history lane:
  both counted".
- **AC4 (double-count hazard 1 — live-vs-history same lane name, CONTENT
  rule; amended by the human 2026-09-24)** — dedup is by content, never by
  name alone. A history copy of lane `L` is skipped ONLY when its bytes are a
  prefix of, or identical to, the live `L` copy's bytes (a mid-move
  artifact); otherwise both are counted.
  (a) Given `lane-x` live (`.current/lane-x/telemetry.jsonl`, 2 fires) AND
  `.current/history/2026-09/lane-x/telemetry.jsonl` whose bytes are identical
  to (or a prefix of) the live file, when `tw_gate_stats` runs, then
  `total_fires` = 2 and a `caveats` entry names the skipped history path.
  (b) Given `_primary` live (`.current/_primary/telemetry.jsonl`, 2 fires for
  the current feature) AND `.current/history/2026-09/_primary/telemetry.jsonl`
  (3 fires for an earlier feature, content NOT a prefix of live), when
  `tw_gate_stats` runs, then `total_fires` = 5 — a long-lived lane keeps its
  whole history, no caveat.
  proof: `test/e26-gate-stats.test.mjs` — new cases "same lane live AND
  history, history is prefix/identical: skipped + caveat" and "_primary live
  + different-content history: both counted".
- **AC5 (flat + lane with disjoint content — both summed)** — Given a
  workspace with a flat `.current/telemetry.jsonl` (2 older fires) AND a live
  lane `.current/e123c/telemetry.jsonl` (3 newer, disjoint fires — the flat
  bytes are NOT a prefix of the lane bytes), when `tw_gate_stats` runs, then
  `total_fires` = 5.
  proof: `test/e26-gate-stats.test.mjs` — new case "flat + live lane coexist
  with disjoint content: both summed".
- **AC5b (double-count hazard 2 — interrupted flat->lane merge; added by the
  human 2026-09-24)** — `tools/lane-migrate.ts` `mergeSidecar` publishes
  `flat ++ lane` at the lane path and only THEN unlinks the flat file; an
  interruption between the two leaves a flat file whose bytes are a prefix of
  the lane file. Given a flat `.current/telemetry.jsonl` (2 fires) AND a live
  lane `.current/e123c/telemetry.jsonl` whose bytes begin with the flat
  file's bytes (2 + 3 = 5 fires), when `tw_gate_stats` runs, then
  `total_fires` = 5 (flat skipped) and a `caveats` entry names the skipped
  flat path as a half-merged sidecar. Same predicate as AC4 (prefix or
  identical), sharing ONE byte-prefix helper with `lane-migrate.ts`'s existing
  (currently unexported) `startsWith` rather than a second implementation —
  e.g. move it into `tools/lane-paths.ts` and have `lane-migrate.ts` import it
  (no import cycle; `tools/lane-migrate.ts` is in T-E123C-01's file set for
  this).
  proof: `test/e26-gate-stats.test.mjs` — new case "flat bytes are a prefix of
  the lane file (interrupted merge): flat skipped, caveat names it".
- **AC6 (usage-accounting fans out the same way, same dedup rule)** — Given
  the same three-source layout (live / history / flat) with `usage.jsonl`
  records for feature `"f1"` split across all three (including a
  live-vs-history prefix/identical duplicate AND a half-merged flat file),
  when `sumUsageForFeature(ws, "f1")` runs, then the total equals every
  source except those skipped by AC4/AC5b's content rule — the exact same
  predicate, reused.
  proof: `test/usage-accounting.test.mjs` — new case "sumUsageForFeature
  aggregates across live/history/flat with the same dedup rule".
- **AC7 (usage writer targets the current lane, not flat)** — Given a
  workspace on branch `feat/e123c-cross-lane-aggregation`, when
  `appendUsageRecord` is called, then the record is appended to
  `.current/e123c/usage.jsonl` — never `.current/usage.jsonl`.
  proof: `test/usage-accounting.test.mjs` — new case "appendUsageRecord writes
  to the current lane's usage.jsonl, not the flat path".
- **AC8 (drift.ts skew precheck gets the flat fallback — closes J2-NEW-9 /
  J2-NEW-3's drift.ts bullet)** — Given an unmigrated flat workspace (no lane
  dir yet) whose flat `handoff.md` carries a from-the-future
  `schema_version`, when `tw_detect_drift` runs, then it reports a graceful
  "Schema version skew: …" drift reason instead of the raw parser throw.
  proof: `test/drift-skew.test.mjs` — flip the existing "KNOWN GAP (J2-NEW-9,
  non-blocking)" test to assert the graceful reason; rename off "KNOWN GAP".
- **AC9 (usage hook reads the right feature on an unmigrated workspace —
  closes J2-NEW-3's second bullet)** — Given an unmigrated flat workspace
  with `active_feature: "foo"` in its flat `handoff.md` and
  `tokenBudgetPerFeature` set in `.config.json`, when a `PostToolUse` Task
  event runs through `bin/agent-governance-usage-hook.mjs`, then the appended
  record's `feature` field is `"foo"`, not `null`.
  proof: `test/usage-accounting.test.mjs` — new hook-level case "hook records
  active_feature from the flat handoff on an unmigrated workspace".
- **AC10 (stale prose fixed — L1-NEW-1)** — Given `tools/registry.ts`'s
  `tw_gate_stats` description and the `workspace_path` refine comment, when
  read after this ticket, then neither states or implies a single flat
  sidecar path; both describe the lane-aware, aggregated-across-sources
  behaviour.
  proof: `grep -n "Aggregate .current/telemetry.jsonl" tools/registry.ts`
  returns no match (the literal flat-path description string is gone).
- **AC11 (no unlisted lane-paths importer slips through)** — Given
  `tools/gate-stats.ts` and `tools/usage-accounting.ts` now import from
  `tools/lane-paths.ts`, when `test/lane-paths.test.mjs` runs, then CALLERS2
  passes with both files added to `SANCTIONED_LANE_PATHS_IMPORTERS` (and no
  other, unlisted importer appears).
  proof: `node --test test/lane-paths.test.mjs` (CALLERS2 case).
- **AC12 (full suite green)**.
  proof: `npm test` exits 0 (1633+ tests, all green).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings (server-internal tool description + code comments only) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Design — the dedup rule (normative; both tasks implement this identically)

**Scope of aggregation**: per-`workspace_path`, never cross-worktree. "A
feature fanned out over multiple lanes" means every lane name that has ever
lived under **this** workspace's own `.current/` tree — live top-level
directories plus closed `.current/history/<YYYY-MM>/<lane>/` directories —
never a `git worktree list` scan of sibling checkouts. That is a *different*,
already-shipped concern (E113/E132's feature-level roll-up, which already
does cross-workspace derivation for a different purpose: advisory
"who else is working on this feature" reporting, not gate-fire/usage
accounting). Keeping F2 intra-workspace matches E109's declared framing
(workspace = the budget unit) and needs no `git` subprocess, consistent with
`tools/gate-stats.ts`'s and `tools/usage-accounting.ts`'s existing
never-throws, pure-fs-read posture.

**Sources, per sidecar key (`telemetry` / `metrics` / `usage`)**:

1. **Live**: `.current/<lane>/<file>` for every directory directly under
   `.current/` that is a safe lane name (`isSafeLaneName`) and not one of the
   two reserved directories (`archive`, `history`) — the exact filter
   `tools/lane-registry.ts`'s `getLaneFeatureHistory` already uses for
   `NON_LANE_DIRS`/`isSafeLaneName`, reused (not reimplemented) via a new
   shared helper in `tools/lane-paths.ts` (see Implementation Notes).
2. **Closed/history**: `.current/history/<YYYY-MM>/<lane>/<file>` for every
   `YYYY-MM`-shaped bucket directory under `.current/history/`, for every
   lane subdirectory inside it. Two different months holding the SAME lane
   name are two genuinely distinct closures (e.g. a reopened ticket) and are
   **both** kept, summed independently — never merged with each other.
3. **Flat**: the single legacy `.current/<file>` at the workspace root, if it
   exists.

**Double-count rule — by CONTENT, never by name (amended by the human
2026-09-24; supersedes the PM draft's "same name => skip history" and "flat
is never deduped")**. One predicate, `isBytePrefix(candidate, authority)`
(candidate bytes identical to, or a prefix of, authority bytes), shared with
`tools/lane-migrate.ts`'s existing `startsWith` drop check:

- **Live vs. history, same lane name `L`** (AC4): each history copy of `L`
  is skipped ONLY when `isBytePrefix(history, live)` — a mid-move artifact
  (`agc feature finish`/E125 copies-then-deletes; a crash can leave both).
  Otherwise both are counted. Name alone is never grounds to skip: a
  long-lived lane such as `_primary` legitimately has a live dir for its
  current feature AND history dirs for earlier features, and a name-based
  skip would silently drop its whole history.
- **Flat vs. its lane copy** (AC5/AC5b): the flat file is skipped ONLY when
  `isBytePrefix(flat, lane)` — `mergeSidecar` publishes `flat ++ lane` at
  the lane path and only then unlinks the flat file, so an interruption
  between the two leaves exactly this shape (the migrator's own resume drops
  it). Otherwise flat and lane are temporally disjoint (e123b9 AC15) and both
  are summed.
- Every skip is disclosed as a `caveats` entry naming the skipped path in
  `tw_gate_stats`; `sumUsageForFeature` returns a single number with no
  caveats channel, so it applies the identical skip silently.
- Empty candidate files are trivially a prefix; they contribute zero records
  either way, so skipping them changes no count (no caveat needed for them).

**Metrics gets an extra, pre-existing safety net for free**: `metrics.jsonl`
records already dedupe globally on the `(feature, released_version)`
idempotency key (existing `duplicates_skipped` logic, E12) — this is
computed *after* concatenating every source's records, so it also catches
the (believed-impossible, but unverified-impossible) case of the exact same
shipped-feature record appearing in two sources at once. `telemetry.jsonl`
has no equivalent natural key (a gate fire has no idempotency field), so the
live-wins-over-history skip is its only guard.

## Implementation Notes (non-normative, but the intended shape)

- New shared helper in `tools/lane-paths.ts` (the canonical, sole owner of
  lane-file-set derivation per its existing AC15 lineage — every consumer
  derives its file set by iterating `LANE_FILES`, never by restating a
  filename): something like
  `enumerateLaneSidecarSources(workspacePath, key: LaneFileKey): { sources: {path, kind: "live"|"history"|"flat", lane: string}[], skippedHistoryLanes: string[] }`,
  implementing exactly the source list + dedup rule above. `tools/gate-stats.ts`
  and `tools/usage-accounting.ts` both call it instead of duplicating
  directory-walking logic. This makes `laneFile()` (currently annotated
  "test-only… no production caller") gain its first production caller —
  update that comment.
- `tools/gate-stats.ts`: replace the two flat `path.join(workspacePath,
  ".current", "telemetry.jsonl"|"metrics.jsonl")` constructions with calls to
  the new helper; loop `readJsonlSidecar` over every returned source path,
  concatenating records (and `exists`/`lines_total`/`lines_malformed` across
  all sources) before the existing aggregation logic runs unchanged. Surface
  `skippedHistoryLanes` as a `caveats` entry when non-empty.
- `tools/usage-accounting.ts`: `sumUsageForFeature` gets the same
  source-list + concatenate-then-filter-by-feature treatment.
  `appendUsageRecord` switches its write target from the module's own
  `usagePath(workspacePath)` (flat) to
  `resolveCurrentLanePaths(workspacePath).usagePath` (current lane) — AC7.
  Keep the exported `usagePath()` function itself unchanged (it remains the
  "flat legacy path" helper, now used only as the flat source's path, and by
  existing tests) — do not rename or remove it.
- `tools/drift.ts`: `readArtifactVersion`'s `"handoff"` branch adds a
  read-only lane-then-flat fallback, mirroring `readAndMigrate`'s existing
  AC13 fallback exactly (try the lane path; if it doesn't exist, try the flat
  path; if neither exists, `null`) — no lock, no migration, no write, same as
  every other read-only fallback in this codebase.
- `bin/agent-governance-usage-hook.mjs`: `readActiveFeature`'s caller adds
  the identical lane-then-flat fallback before reading `handoffPath`.
- `tools/registry.ts`: prose-only — reword the `tw_gate_stats` description
  and the `workspace_path` refine comment to describe lane-aware aggregation
  instead of a single flat path (L1-NEW-1). No schema/behavior change to the
  refine itself.

## Out of Scope

- **Cross-worktree aggregation** (reading sibling worktrees' `.current/`
  trees). That's E113/E132's already-shipped feature-level roll-up, a
  different concern (advisory "who else is working on this feature," not
  gate-fire/usage accounting). Not touched here.
- **J2-NEW-1** (`bin/agent-governance-context.mjs`, `prompts/build.ts` —
  direct `handoffPath` reads with no flat fallback). Explicitly NOT a cut
  input for F2 (only J2-NEW-3 + J2-NEW-9 are); remains open as its own
  ticket.
- **`.current/history/` write mechanism** (the "lane close" move itself).
  Not shipped by anything yet (E73/E125, Wave 5+, per J2-NEW-4) — this
  ticket only reads that directory shape if/when it exists; it does not
  create it.
- **`LANE_FILES` contents** — untouched. `.config.json`, `exemptions.json`,
  `tasks.md`, `.current/feature-split.md` remain workspace-wide, not lane
  files, per the standing D1-D3 decisions.
- **Post-merge invariant checking** (E126, Wave 6) — this ticket does not add
  a "lane present in both live and history" *hard* check; it only makes the
  read-side degrade correctly (skip + disclose) when that state is observed.
- **`docs/v4.0.0-execution-plan.md`'s Wave 4 DoD checkbox** — marking it done
  is the integrator's job at wave close, not this ticket's file scope.

## Dependencies / Prerequisites

- `.current/feature-split.md` row 2 (`e123c-cross-lane-aggregation`,
  `depends_on: F1`) — F1 (`e123b9-lane-flip`) is `done` per the lane registry
  (`tw_get_state` shows it `PASS`/`qa-engineer`). This ticket may proceed.
- Cut inputs, all confirmed read before this spec was written: L1-NEW-1
  (`NEW-TICKETS.md`), J2-NEW-3 + J2-NEW-9 (`NEW-TICKETS.md`),
  `specs/e123b9-lane-flip.md` AC13/AC14/AC15 (the flat-vs-lane fallback and
  merge semantics this ticket's dedup rule extends), `tools/lane-paths.ts`
  (`LANE_FILES`, `resolveCurrentLanePaths`, `resolveCurrentLane`).
- Resource Audit Gate: zero external references (URL/Figma/ticket-link) found
  in the assignment or the source docs beyond this repo's own tree —
  `external_refs` omitted (non-blocking).
- No `design/<feature>.md` exists for this feature (non-design, server-internal
  tooling) — Scope Decision Gate and Visual Structural Assertions section are
  not triggered.
