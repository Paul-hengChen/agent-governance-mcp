# e123a-lane-layout-migration

F0 of the v4.0.0 Wave 4 split (`.current/feature-split.md` order 0). Ships the
handoff schema bump (carrying E99's per-hop dispatch-mechanism fields plus a
per-lane sidecar for their durability), the flat→`.current/<lane>/` migration
runner and its reverse, a lane-path resolver that is a zero-behaviour-change
stub, and the E157 gitignore decision. F1 (`e123b-lane-path-resolution`)
wires everything this ticket leaves inert.

**Amended 2026-09-23** (human, in the coordinator's chat, after this spec's
first cut — see `.current/feature-split.md` Decisions, which now carries both
verbatim): (1) D2 is now **A′ + monthly grouping**, not plain A — a lane's
final resting place, decided here for the record but implemented later, is
`.current/history/<YYYY-MM>/<lane>/`; (2) E99's two handoff fields stay
transient exactly as originally designed, but now also durably append to a
new per-lane sidecar so the lane's dispatch history survives past the last
hop. Both amendments are reflected below; neither changes this ticket's
"unwired" posture.

**Second amendment, 2026-09-23** (human, approved in the coordinator's
chat): the five lane-scoped filenames must live in exactly ONE place — an
exported `LANE_FILES` registry in `tools/lane-paths.ts` — not enumerated a
second time inside `resolveLanePaths` or either migration runner. This is an
implementation-shape change only (no scope/file-count/task-count change;
absorbed into the lane-paths/dispatch-log/lane-migrate tasks, which also
reordered: `lane-paths.ts` now ships first, since `dispatch-log.ts` reads
its sidecar filename FROM `LANE_FILES` rather than the other way round),
motivated by `tasks.md` and `specs/<feature>.md` likely joining the
lane-file set later, via E125's cut (NOT this ticket — see
`NEW-TICKETS.md` `L-SCHEMA-NEW-1..4`): a registry makes that a
one-entry-plus-migration-step addition instead of a second place to
remember to update.

## Problem Statement

`.current/` state files are flat and tracked, so every worktree lane collides
with every other lane on files that are pure per-lane working state
(`docs/backlog.md` E123, measured 2026-09-15: two lanes' `telemetry.jsonl`
diverged at identical line positions with no length change to notice; a
merge silently drops one lane's gate-fire history). The fix is a per-lane
`.current/<lane>/` subdirectory layout, tracked in git (so lane governance
history survives), requiring a schema bump and a migration that can convert
an existing flat workspace and — for a clean rollback path — convert back.
Separately, a role hop today records nothing about which dispatch mechanism
carried it (`docs/backlog.md` E99) — `Task(...)` and `tw_switch_role(...)`
produce byte-identical handoff records, so an in-context judge is
indistinguishable from an independent one after the fact, and the tier a
role actually reports has already been observed to disagree with the tier
the coordinator pinned. Both need a schema bump; the wave plan (Wave 4,
`docs/v4.0.0-execution-plan.md`) folds them into one migration rather than
paying for two.

This ticket (F0) builds the schema field, the migration runner, the reverse
runner, and a path-resolution seam for F1 — but ships all of it **unwired**:
nothing added here may run automatically or change any reader's behavior.
`readHandoffState`'s heal path, every gate, and the 28 `.current`-touching
call sites F1 will repoint stay exactly as they are today. A lane's
eventual move out of the live `.current/<lane>/` slot — to
`.current/history/<YYYY-MM>/<lane>/` at lane close, before merge — is stated
here as the decided destination but is **not implemented by this ticket**;
the mover is E73 (`agc feature finish`) or E125 (writeback), sequenced after
F0/F1, and out of scope below.

## User Stories

- As a lane worktree, I want my own `handoff.md`/`telemetry.jsonl`/
  `metrics.jsonl`/`usage.jsonl`/`dispatch.jsonl`, so that a sibling lane's
  merge can never silently clobber my governance history.
- As a maintainer converting an existing flat workspace, I want a migration
  that moves those five files into `.current/<lane>/` and a reverse that
  moves them back, so that the change is a safe, provably reversible
  operation rather than a one-way door.
- As a role hop's downstream reader, I want the acting role's self-reported
  dispatch mechanism and model tier recorded on the handoff, so that a
  pin-vs-actual mismatch (already observed twice, see E99) is at least
  visible in the record instead of silently unrecoverable.
- As F1's implementer, I want a `resolveLaneName`/`resolveLanePaths` seam
  already in place and already tested, so that flipping it to lane-aware
  later is a substitution, not a from-scratch design.
- As E125's future cut, I want the lane-owned filename set already
  centralized in one registry, so that adding `tasks.md`/
  `specs/<feature>.md` as lane files later is a registry entry plus a
  schema migration step, not a hunt through the resolver and both runners
  for every place a filename was hardcoded a second time.
- As a lane whose `handoff.md` only ever holds the last hop, I want every
  hop's self-reported dispatch mechanism and tier durably appended
  somewhere, so that a lane's dispatch history isn't silently reduced to
  "whatever the final write happened to say" once earlier hops are
  overwritten.

## Acceptance Criteria

- **AC1** — Given the handoff schema is at v14, when `schema/versions.ts`
  bumps `CURRENT_VERSIONS.handoff` to `15` and `schema/migrations-handoff.ts`
  registers the v14→v15 step, then a stale v14-or-older `handoff.md` is
  lazily upgraded to `schema_version: 15` on next read, with
  `dispatch_mechanism` / `dispatch_mechanism_tier` left **absent**
  (stamp-only, seeds nothing — absence === "not attested for this hop",
  the v10 `dispatched_at` precedent, not the `hop_count` seed-0 precedent).
  proof: `test/handoff-versioning.test.mjs` v14→v15 fixture — `applied: [15]`,
  neither new key present post-migration.

- **AC2** — Given a role's `tw_update_state` call sets
  `dispatch_mechanism: "task"` and `dispatch_mechanism_tier: "fable"`, when
  the write is accepted, then both values persist verbatim in that write's
  handoff frontmatter. Given the *next* write (same `active_feature`) omits
  both fields, then both are **absent** afterward — TRANSIENT, the exact
  `next_role`/`review_verdict` per-hop lifetime, **not** the
  `dispatch_pins`/`external_refs` feature-scoped carry-forward lifetime. Do
  not let either field survive a write that doesn't restate it.
  proof: a write/read round trip in the new qa-owned
  `test/dispatch-mechanism.test.mjs` — write A sets both, read-back confirms;
  write B (same feature, fields omitted) confirms both absent.

- **AC3** — Given `dispatch_mechanism` is supplied outside
  `"task" | "switch_role" | "inline"`, when `tw_update_state` runs, then the
  zod boundary in `tools/registry.ts` rejects the call before the handler
  runs (the `dispatch_mode`/`review_verdict` enforcement class).
  `dispatch_mechanism_tier` is a bounded free string (model-tier vocabulary
  is not owned by this server — the `dispatch_pins` precedent).
  proof: a zod-boundary unit test asserting `dispatch_mechanism: "bogus"`
  throws `ZodError`.

- **AC4** — Given `active_feature` is `"e163-ci-gate-ordering"`, when
  `resolveLaneName` (new module `tools/lane-paths.ts`) runs, then it returns
  `"e163"`. Given `"e123a-lane-layout-migration"`, then `"e123a"`. Given
  `active_feature` is absent, empty, or doesn't match the ticket-id shape
  (e.g. `"lane-layout-migration"`), then it returns `"_legacy"`.
  `resolveLaneName` MUST NEVER return `"_primary"` — that branch-based
  fallback belongs to E73's later explicit-key bootstrap, not this ticket
  (D1, `.current/feature-split.md` Decisions). This ticket's
  `resolveLaneName` is the migration-time resolver ONLY (parses an
  *existing* flat handoff's `active_feature`); the LIVE resolver F1 flips
  additionally needs branch-based resolution (`feat/<id>-*`) and the
  `_primary` fallback for a workspace with no flat handoff yet to parse —
  that is explicitly F1-owed (see Out of Scope), not a gap in this AC.
  proof: `test/lane-paths.test.mjs` table-driven fixture, ≥4 cases including
  both examples above.

- **AC5** — Given `tools/lane-paths.ts` exports a single registry
  `LANE_FILES: ReadonlyArray<{ key: string; filename: string; required: boolean }>`
  — `{key: "handoff", filename: "handoff.md", required: true}` plus
  `telemetry`/`metrics`/`usage`/`dispatch` entries with `required: false` —
  when `resolveLanePaths(workspacePath, lane)` runs, then it derives its
  returned `{ handoffPath, telemetryPath, metricsPath, usagePath,
  dispatchLogPath }` shape BY ITERATING `LANE_FILES` (not by restating the
  five filenames a second time), and for any workspace path and any `lane`
  argument (a real ticket id, `_legacy`, or garbage) it returns exactly
  today's flat paths — `<ws>/.current/<filename>` for each registry entry
  — **identical for every `lane` value** (zero behaviour change). It has
  **zero production callers** anywhere in the tree. `tools/dispatch-log.ts`
  imports its filename FROM `LANE_FILES`' `dispatch` entry (`lane-paths.ts`
  is the single canonical owner of every lane filename; `dispatch-log.ts`
  is a consumer, not a second source).
  proof: unit test asserting output equality across 3+ distinct `lane` args;
  `grep -rln "lane-paths" tools/ gates/ guards/ prompts/ bin/ index.ts` names
  only `tools/lane-paths.ts` itself.
  *Erratum (2026-09-23, integration; L-SCHEMA-NEW-6)*: as written, this grep can
  never pass. AC15 requires `tools/dispatch-log.ts` and `tools/lane-migrate.ts` to
  import `lane-paths.ts`, so both always match. QA proved the zero-production-caller
  property with `grep -rn resolveLanePaths` instead (see `qa_reports/review_T-E123A3-08.md`).
  That is the operative proof.

- **AC6** — Given a flat workspace with `.current/handoff.md` (the
  `LANE_FILES` entry marked `required: true`) and any subset of the four
  `required: false` entries (`telemetry`/`metrics`/`usage`/`dispatch`)
  present, when `migrateFlatToLane(workspacePath)` (new module
  `tools/lane-migrate.ts`) runs, then: its candidate file set is derived by
  ITERATING `LANE_FILES` (`tools/lane-paths.ts`) — never a second
  hardcoded list of the five filenames; the lane name comes from
  `resolveLaneName` applied to the flat handoff's `active_feature`;
  `.current/<lane>/` is created; each present file is **moved**, not
  copied; each absent optional entry is silently skipped; and
  `.current/.config.json`, a workspace's `exemptions.json`, `tasks.md`, and
  `.current/feature-split.md` are **never touched** (none of them are
  `LANE_FILES` entries). The relocated `handoff.md` write reuses the
  existing atomic tmp+rename + `withFileLock` primitives — no hand-rolled
  unsafe write.
  proof: `test/lane-migrate.test.mjs` — full-fixture case (all 5 files) →
  assert post-move directory listing; handoff-only fixture → assert the 4
  optional files are skipped without error.

- **AC7** — Given `.current/<lane>/handoff.md` already exists with content
  that differs from the source about to be moved (a stale or partial prior
  run), when `migrateFlatToLane` runs, then it throws and leaves **both**
  the source and the destination unmodified — no silent clobber.
  proof: fixture pre-seeds a conflicting `.current/e163/handoff.md`, asserts
  the call throws and neither file's content changed.

- **AC8** — Given `.current/<lane>/` holds the five (or fewer) relocated
  files, when `migrateLaneToFlat(workspacePath, lane)` runs, then its
  candidate set is likewise derived from `LANE_FILES` (never restated),
  each present file moves back to flat `.current/`, and the now-empty
  `.current/<lane>/` directory is removed.
  proof: `test/lane-migrate.test.mjs` reverse case — asserts
  `.current/<lane>/` no longer exists and the flat files are back.

- **AC9** (Wave 4 DoD reversibility item) — Given a flat workspace, when
  `migrateFlatToLane` then `migrateLaneToFlat` run back-to-back, then every
  one of the five candidate files is byte-identical before vs. after,
  **except** `handoff.md`'s `schema_version`, which may already read `15`
  if any read during fixture setup triggered the ordinary lazy migration
  (AC1) — that stamp is expected and is not a round-trip defect.
  proof: `test/lane-migrate.test.mjs` round-trip fixture — `diff`
  before/after content for all five files, allowing only the
  `schema_version` line to change on `handoff.md`.

- **AC10** — Given the full task set for this ticket is complete, when the
  tree is searched, then `migrateFlatToLane` / `migrateLaneToFlat` are
  referenced **only** by their own test file — not by `readHandoffState`,
  `tw_get_state`, `tw_update_state`, any `gates/` predicate, `index.ts`, or
  `tools/registry.ts`'s `TOOL_REGISTRY`/`PROMPT_REGISTRY`.
  proof: `grep -rn "migrateFlatToLane\|migrateLaneToFlat" --include=*.ts . | grep -v /test/`
  returns only `tools/lane-migrate.ts` itself.

- **AC11** (E157) — Given `.gitignore` gains a `.current/archive/` entry and
  the already-tracked `.current/archive/e142-release-tooling-wave25....md`
  is removed from the git index (`git rm --cached`, content kept on disk),
  when `git ls-files .current/archive/` runs, then it returns **empty**,
  while `ls .current/archive/` still lists the file(s) on disk.
  proof: `git ls-files .current/archive/` → empty; `ls .current/archive/`
  → unchanged file count.

- **AC12** — Given `CURRENT_VERSIONS.handoff` is now `15`, when the full
  suite runs, then every existing fixture asserting "current handoff
  version is 14" is updated to 15 (qa-owned, Constitution §2 — sr-engineer
  does not touch `test/`), and `npm test` exits 0.
  proof: `npm test` full run, exit 0.

- **AC13** (E99 per-hop durability — human amendment 2026-09-23) — Given a
  `tw_update_state` write carries `dispatch_mechanism` (with or without
  `dispatch_mechanism_tier`), when the write is accepted, then exactly one
  JSON line — `{ ts, feature, agent_id, dispatch_mechanism,
  dispatch_mechanism_tier }` — is appended to `.current/dispatch.jsonl`
  (new module `tools/dispatch-log.ts`, called from
  `tools/handoff-orchestrator.ts`'s `tw_update_state` handler after the
  write succeeds). Given a write omits `dispatch_mechanism`, then **no**
  line is appended — no empty/null records. The append is best-effort and
  NEVER throws and NEVER alters the tool's `ToolResult` on failure (the
  `emitGateTelemetry` contract in `tools/telemetry.ts`). It is a raw,
  unconsumed append-only log in this ticket — no aggregator reads it (that
  would be a future, separately-cut ticket; see Dependencies).
  proof: `test/dispatch-log.test.mjs` — a write with the field present
  increments the line count by exactly 1; a write without it leaves the
  line count unchanged; a forced write failure (bad workspace path) still
  returns the normal `ToolResult`, not a throw.

- **AC14** (sidecar isolation) — Given `.current/dispatch.jsonl` exists,
  when any write happens, then `.current/metrics.jsonl` (one line per
  SHIPPED feature, deduped per-feature by `tw_gate_stats`) and
  `.current/telemetry.jsonl` (gate-fire events only) are **never** written
  to by the dispatch-log append path — the three sidecars stay disjoint
  streams, mirroring `tools/telemetry.ts`'s own file-header discipline.
  proof: `test/dispatch-log.test.mjs` — assert `metrics.jsonl` and
  `telemetry.jsonl` line counts are unchanged by a dispatch-log append.

- **AC15** (single source of truth — human amendment 2026-09-23) — Given
  `tools/lane-paths.ts` exports `LANE_FILES`, when the tree is searched,
  then NO second literal list of the five lane filenames
  (`handoff.md`/`telemetry.jsonl`/`metrics.jsonl`/`usage.jsonl`/
  `dispatch.jsonl`) exists anywhere outside `LANE_FILES` itself and its own
  test fixture — not in `resolveLanePaths`, not in `migrateFlatToLane`,
  not in `migrateLaneToFlat`, not in `tools/dispatch-log.ts`. Each of those
  four consumers' file/key set is provably DERIVED FROM (iterates)
  `LANE_FILES` and EQUAL TO it (same count, same keys), not merely
  coincidentally matching.
  proof: `test/lane-paths.test.mjs` asserts `resolveLanePaths`'s returned
  key count equals `LANE_FILES.length`; `test/lane-migrate.test.mjs`
  asserts both runners' moved-or-skipped key count equals
  `LANE_FILES.length` on the full fixture; qa-checkable grep —
  `grep -n "handoff\.md\|telemetry\.jsonl\|metrics\.jsonl\|usage\.jsonl\|dispatch\.jsonl" tools/lane-paths.ts tools/lane-migrate.ts tools/dispatch-log.ts`
  shows every hit inside `lane-paths.ts`'s own `LANE_FILES` declaration (or
  a comment), never a second string literal in the other two files.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no new user-facing strings (zod error text is developer/tool-boundary diagnostics, not product copy) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (no `design/<feature>.md`; non-visual server-internal feature) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **F1 (`e123b-lane-path-resolution`)**: migrating the ~28 `.current`-
  touching call sites (`tools/`, `gates/`, `guards/`, `prompts/`, three
  `bin/` hooks) onto `resolveLanePaths`, flipping the resolver to
  lane-aware, and wiring `migrateFlatToLane`/`migrateLaneToFlat` into a real
  invocation point (heal path, explicit tool, or CLI — F1's call).
- **F1-owed (c)**: the LIVE resolver's branch-based lane resolution
  (`feat/<id>-*` → ticket id) and its `_primary` fallback for a workspace
  with no flat handoff left to parse. This ticket's `resolveLaneName`
  deliberately covers only the migration-time case (parse an existing flat
  handoff's `active_feature`, else `_legacy`) — confirmed correct scope by
  the coordinator's review of the first cut, recorded here explicitly so
  F1 doesn't have to re-derive it.
- **E73 or E125 (a)** (later, separate ticket, human amendment 2026-09-23):
  the mechanism that moves a closed lane from `.current/<lane>/` to
  `.current/history/<YYYY-MM>/<lane>/` — unchanged, raw files kept — before
  merge. Whichever of `agc feature finish` (E73) or the writeback (E125)
  ends up owning it, **it must exist in every adopter workspace, not only
  at this repo's own releases** — this repo dogfoods itself but the
  mechanism is a server/tooling feature, not a one-off release step.
  Also owns: the explicit `.current/.config.json` lane-name key written at
  `agc feature start` bootstrap (E73), which supersedes this ticket's
  convention-parsed name for newly-bootstrapped lanes.
- **F1-owed (b)**: re-pointing E132's `getLaneFeatureHistory` at **live**
  lane directories **and** `.current/history/<YYYY-MM>/<lane>/` (both
  locations a closed lane's history can now be found in) — a read-path
  change, deliberately not bundled here per the coordinator's scope
  boundary.
- **F2 (`e123c-cross-lane-aggregation`)**: `tw_gate_stats` +
  `tools/usage-accounting.ts` glob-across-N-lanes aggregation — an
  independent behaviour change to the E6 retro data source, not a path
  rename. Per the D2 amendment, F2 must glob across **both** live
  `.current/<lane>/` directories **and** every `.current/history/*/*/`
  directory — a closed lane's data does not stop counting once archived.
- **E125**: its `tasks.md`/backlog writeback half is untouched and remains
  owed elsewhere; its snapshot-to-archive half is superseded by the D2′
  package (monthly-grouped history, not a lossy summary) already settled
  in `.current/feature-split.md` (nothing to do here beyond AC11).
- **`tasks.md` / `specs/<feature>.md` are NOT added to `LANE_FILES` in this
  ticket.** The human has decided they will likely become lane-scoped files
  later (human, 2026-09-23), filed as `NEW-TICKETS.md`
  `L-SCHEMA-NEW-1..4` (Lane: L-SCHEMA (Wave 4)) and routed to **E125's cut**
  (Wave 6, not yet run) per `v4.0.0-execution-plan.md` §2.4. `LANE_FILES`
  (AC5/AC15) is this ticket's answer to that follow-up's enabler note
  (`L-SCHEMA-NEW-2`): adding either file later is one registry entry plus a
  schema migration step, not a hunt through the resolver and both runners.
- **E99 option (ii)** (a new drift/retro surface that makes a
  `dispatch_mechanism` mismatch *countable*, and an aggregator that reads
  the new `dispatch.jsonl` sidecar this ticket adds) is deliberately not
  built in this ticket — see Dependencies below. The sidecar this ticket
  ships is raw and unconsumed, the exact posture `telemetry.jsonl` shipped
  in before `tw_gate_stats` was cut as its own later ticket.
- **Deferred `content/` change**: getting every role's SOP to actually SET
  `dispatch_mechanism`/`dispatch_mechanism_tier` on its own
  `tw_update_state` writes (`content/skill-sr-engineer.md`,
  `content/skill-code-reviewer.md`, etc.) is NOT built here — this ticket
  only makes the fields and the sidecar exist and function correctly when
  supplied. The SOP-text obligation is sequenced **after E110**
  (`docs/v4.0.0-execution-plan.md` §2.1 — `content/` has exactly one lane
  this wave, and E110 already holds it) to avoid a second lane collision
  on the same files.
- `.current/.config.json` and a workspace's `exemptions.json` never move,
  in this ticket or any later one.
- No new `tw_*` tool, no new gate, no new `GateErrorCode`.

## Dependencies / Prerequisites

- Reads: `.current/feature-split.md` (Split Table + Decisions, the
  authority for D1/D2/D3/E157 — none of those are re-opened here);
  `docs/backlog.md` rows E123, E99, E157 (E125/E132 read for the F1-owed
  boundary only); `docs/v4.0.0-execution-plan.md` §"Wave 4 — 儲存結構" and
  §6 (E123's suggested 3-task split, mapped 1:1 onto this ticket's
  predecessor `T-E123-01`); `docs/schema-versions.md` (the migration
  framework this ticket's AC1 follows).
- Resource Audit Gate (Constitution §7): all four source documents were
  grepped for `http(s)://` / `figma` / `sketch` / external-ticket
  references. The only hit is `feature-split.md`'s empty "figma link"
  table *column header* (no row has a populated link) — zero load-bearing
  external references found. `external_refs` omitted from this spec's
  handoff write (absence === non-blocking).
- **Runtime layout-detection mechanism is F1-owed, not decided here.**
  This ticket does not add a `.config.json` "layout: flat|lane" flag or a
  `lane` field on `handoff.md` itself — the physical location of the five
  files (flat vs. `.current/<lane>/`) is the only signal. F1 decides
  whether its flipped `resolveLanePaths` detects mode by directory
  existence or by a persisted flag; that decision is out of scope here and
  must not be pre-empted by this ticket's file shapes.
- **E99 decision — CONFIRMED by the coordinator/human 2026-09-23**: this
  spec implements option (i) plus the self-reported tier —
  `dispatch_mechanism` + `dispatch_mechanism_tier`, attested not verified,
  as TRANSIENT per-hop handoff fields (unchanged from the first cut).
  Reasoning stands: Wave 4's own execution plan names hop-budget
  exhaustion as this wave's most likely failure mode; a new drift/retro
  surface (option ii) would add a gate, a predicate, and its own test
  surface for no gain until the field has real data to retro against.
  **Amendment on top, same decision**: the human separately required
  per-hop *durability* (AC13/AC14) — since `handoff.md` keeps only the
  last hop, a lane's dispatch history would otherwise be lost the moment a
  second hop overwrites the first. The new `.current/dispatch.jsonl`
  sidecar is a plain append-only log (the `telemetry.jsonl` precedent, not
  the `metrics.jsonl` per-feature-dedup precedent — explicitly do NOT
  route through `tw_gate_stats`' dedup path) — durability, not
  countability. This does **not** reopen option (ii): nothing in this
  ticket reads, aggregates, or gates on `dispatch.jsonl`'s contents.
- **Lane lifecycle, decided for the record (D2 amendment,
  `.current/feature-split.md` Decisions), implemented later**: a lane is
  live at `.current/<lane>/` while in flight, then moved unchanged (raw
  files kept, no lossy compaction — a lossy summary was explicitly
  rejected as irreversible) to `.current/history/<YYYY-MM>/<lane>/` at
  lane close, before merge, so the PR itself carries the move. `YYYY-MM`
  is the close date. This ticket's `migrateFlatToLane`/`migrateLaneToFlat`
  operate ONLY on the flat ⇄ live-lane boundary; the live-lane ⇄ history
  move is a structurally different operation (E73/E125, out of scope) and
  must not be conflated with or half-implemented by this ticket's runners.
