# e174-flat-path-sweep

## Problem Statement

E123 (Wave 4) flipped every LIVE call site so a workspace's governance state is
read/written at `.current/<lane>/{handoff.md,telemetry.jsonl,metrics.jsonl,usage.jsonl,dispatch.jsonl}`
(`tools/lane-paths.ts`'s `LANE_FILES` registry) instead of the flat
`.current/{handoff.md,*.jsonl}` layout. E174a (shipped v3.117.0) closed the one
release-blocking site (release step 13a + `scripts/verify-release.mjs`). This
ticket is the rest of the Wave-4-close prose cleanup (`docs/backlog.md` E174
row, `docs/v4.0.0-execution-plan.md` Wave 5 L-CONTENT row): (a) every remaining
flat-path mention in `content/**` / in-scope `docs/**` that would send a reader
to a file that no longer exists at that path, and (b) the E99 obligation that
shipped the `dispatch_mechanism` / `dispatch_mechanism_tier` handoff-v15 fields
and the `.current/<lane>/dispatch.jsonl` sidecar (`tools/dispatch-log.ts`) but
never told any role's SOP to populate them — motivating instance: two PM
dispatches self-reported a tier that differed from the tier they were actually
dispatched with, on 2026-09-23.

## Inventory

Grepped `content/**` and `docs/**` (excluding `docs/install.md`,
`docs/backlog.md`, `docs/v4.0.0-*.md` per assignment) for every mention of a
`LANE_FILES` filename (`handoff.md`, `telemetry.jsonl`, `metrics.jsonl`,
`usage.jsonl`, `dispatch.jsonl`) preceded by the flat `.current/` prefix (i.e.
NOT already `.current/<lane>/…` or a `.current/**` glob). Non-lane files
(`.current/.config.json`, `exemptions.json`, `feature-split.md`, `archive/`)
are confirmed NOT defects per `tools/lane-paths.ts`'s own registry comment
("deliberately NOT lane files ... must never be added here by this ticket")
and are excluded below.

### Retarget (scope a)

| file:line | current text | disposition |
|---|---|---|
| `content/coord-03-core-fallback.md:9` | "...never inferred from or reconciled across per-lane `.current/handoff.md` files." | retarget → `.current/<lane>/handoff.md` |
| `content/coord-03-core-fallback.md:24` | "...the feature-scoped running total summed from `.current/usage.jsonl`..." | retarget → the CURRENT lane's `.current/<lane>/usage.jsonl` (writer side; `appendUsageRecord` targets the current lane only, `tools/usage-accounting.ts`) |
| `content/coord-06-host-token.md:21` | "sidecar `.current/usage.jsonl` — populated per dispatch by the opt-in PostToolUse hook" | retarget → `.current/<lane>/usage.jsonl` |
| `content/coord-06-host-token.md:30` | "`.current/usage.jsonl` is absent (hook not wired) → DO fall back..." | retarget → `.current/<lane>/usage.jsonl` |
| `docs/architecture.md:15` | `│  + .current/handoff.md state                               │` (diagram) | retarget → `.current/<lane>/handoff.md` |
| `docs/architecture.md:45` | "Every `tw_update_state` call runs this **before** `.current/handoff.md` (or the SQLite row) is touched." | retarget → `.current/<lane>/handoff.md` |
| `docs/architecture.md:60` | `│    O_EXCL on .current/handoff.md.lock + stale-PID detection     │` (diagram) | retarget → `.current/<lane>/.handoff.lock` (exact lock basename: `HANDOFF_LOCK_FILENAME` in `tools/lane-paths.ts`, composed by `resolveLaneLockPath`; the diagram's old `.handoff.md.lock` spelling was never the real basename either — fix both the lane-scoping and the name in the same edit) |
| `docs/architecture.md:286` | `\| State location \| `.current/handoff.md` + `tasks.md` per workspace \| SQLite DB (single file) \|` | retarget the `handoff.md` half only → `.current/<lane>/handoff.md` + `tasks.md` (tasks.md stays flat — not a `LANE_FILES` entry) |
| `docs/gate-retro-procedure.md:4` | "one JSON line to `<workspace>/.current/telemetry.jsonl` for every..." | retarget → `<workspace>/.current/<lane>/telemetry.jsonl` (describes the per-write append target only, not a totals claim) |
| `docs/gate-retro-procedure.md:24` | "Read `.current/telemetry.jsonl` (append-only JSONL...)" | retarget → `.current/<lane>/telemetry.jsonl` (current lane only) PLUS a note: for real cross-lane/cross-history totals use `tw_gate_stats` — it already de-duplicates identical sidecar copies (`tools/gate-stats.ts`; e.g. a lane merged back to `main` leaves the same telemetry bytes under both `.current/_primary/` and `.current/<lane>/`, and a hand-rolled glob would double-count it, `tw_gate_stats` does not). Do NOT re-glob this line to `.current/*/telemetry.jsonl` (human decision 2026-09-24: totals must route through `tw_gate_stats`, which dedupes; a glob does not). |
| `docs/gate-retro-procedure.md:36` | ``jq -r .error_code .current/telemetry.jsonl \| sort \| uniq -c \| sort -rn`` | retarget to the CURRENT lane's path only → `jq -r .error_code .current/<lane>/telemetry.jsonl \| sort \| uniq -c \| sort -rn`. Do NOT glob for totals. If a cross-lane glob variant is shown at all, it MUST carry an explicit inline comment that it is an ad-hoc/one-off query only and does NOT de-duplicate (merged-back lanes double-count) — `tw_gate_stats` is the correct tool for real totals. |
| `docs/gate-retro-procedure.md:42` | ``jq -r '[.error_code, .feature] \| @tsv' .current/telemetry.jsonl \| sort \| uniq -c \| sort -rn`` | same fix as :36 — retarget to `.current/<lane>/telemetry.jsonl`, no totals-glob, same ad-hoc/no-dedup caveat if a glob variant is shown |
| `docs/gate-retro-procedure.md:82` | "separate sidecar, `.current/metrics.jsonl` — one JSON line per SHIPPED feature..." | retarget → `.current/<lane>/metrics.jsonl` (current lane); note `tw_gate_stats`'s "deduped metrics summary" (already described at line ~25 of this same doc) is the correct source for cross-lane metrics totals, same reasoning as the telemetry side |
| `docs/gate-retro-procedure.md:89` | `node scripts/summarize-metrics.mjs   # default: .current/metrics.jsonl` | do NOT rewrite the default path in the comment — `scripts/summarize-metrics.mjs`'s default arg genuinely is still the flat path (verified; the script itself is a forbidden file for this ticket, tracked as `L-CONTENT-NEW-4` below). Add one clause instead: pass the CURRENT lane's path explicitly for a single-lane snapshot (`node scripts/summarize-metrics.mjs .current/<lane>/metrics.jsonl`); for real cross-lane totals prefer `tw_gate_stats`'s deduped metrics summary — do NOT glob multiple `metrics.jsonl` copies into this script, it has no dedup logic either |
| `docs/http-mode.md:53` | "...\"I want my team to share state\" + everyone has Git → just commit `.current/handoff.md` to Git. Async sync via PR is often enough." | retarget per `v4.0.0-execution-plan.md` §2.3's post-flip rule A′ → "commit your lane's `.current/<lane>/` directory to Git" (the whole directory, not just the one file — matches the committed-lane-history convention) |
| `docs/arming.md:26` | "...one JSON record (feature, dispatched role, the four canonical `usage.*` token fields) is appended to `.current/usage.jsonl`;..." | retarget → `.current/<lane>/usage.jsonl` |
| `docs/arming.md:31` | "**Verify it's live**: dispatch any subagent via `Task`, then check `.current/usage.jsonl` exists..." | retarget → `.current/<lane>/usage.jsonl` |

### Leave-as-is (classified, no edit)

| file:line | reason |
|---|---|
| `docs/schema-versions.md:57` ("Refuse-loud on dual presence: if both `.current/handoff.md` and `.current/<lane>/handoff.md` exist...") | intentionally names BOTH paths — it documents the `HANDOFF_LAYOUT_CONFLICT` migration-detection check itself, which by definition compares the flat path against the lane path. Editing it would make the doc wrong. |
| `docs/agc-feedback-2026-09-08.md` (all `.current/handoff.md` / `.current/*.jsonl` mentions) | dated 2026-09-08 discussion/incident log, explicitly a historical record ("討論暫存檔"/"待決事項的來源"), cited elsewhere (`v4.0.0-execution-plan.md`) as evidence of what the layout was AT THE TIME. Entries describe the pre-E123 layout in effect when written; retargeting would misrepresent the historical record. |
| `docs/dependency-advisories.md:40,52` ("`yaml.load()` runs on every `.current/handoff.md` read...") | the doc states its own no-retroactive-edit policy in the text itself ("Round 1's disposition is left intact above rather than edited, so the record shows what was decided when"); round 2 explicitly says "unchanged from round 1". Editing the path would violate the doc's stated editorial policy for a per-advisory decision record. The reachability substance (parsed on every handoff read) is unaffected by which literal path is named. |
| `content/const-05-core-standards.md`, `content/const-08-chain-31-mid.md`, `content/coord-01-core-head.md`, `content/coord-07-core-sop.md`, `content/constitution-rationale.md`, `content/skill-design-auditor.md`, `content/skill-pm.md`, `content/skill-coordinator-lite.md`, `content/coord-02-host-dispatch.md` (pre-existing mentions) | all reference `.current/feature-split.md`, `.current/.config.json`, `.current/exemptions.json`, or a `.current/**` glob — confirmed non-`LANE_FILES` paths that correctly stay top-level. Not defects. |
| `docs/config.md:5,157`, `docs/backlog-refactor-report.md:53`, `docs/retro-2026-07-15-gate-fire.md:68` | bare filename mentions (`handoff.md`, `metrics.jsonl`) with no `.current/` path prefix at all — nothing to retarget. The latter two are also dated historical reports. |
| `content/skill-release-engineer.md` (all) | verified clean — E174a already retargeted every flat-path mention (13a, the Artifact list at :41-42, step 11b, the hand-edit prohibitions at :20-21) to `.current/<lane>/…`. No leftover flat mentions found by this inventory's grep. |

### Forbidden-file findings (out of scope for this cut; logged to `NEW-TICKETS.md`)

Allowed files for this ticket are `content/**`, `test/fixtures/compose-golden/**`,
`test/context-budget.test.mjs`, `docs/**` (minus the three excluded pages).
`templates/**`, `bin/**`, `scripts/**` are FORBIDDEN. The same inventory grep
over those trees found 4 more flat-path mentions — logged as
`L-CONTENT-NEW-1..4` in `<lanes-root>/e174/NEW-TICKETS.md`
(uncommitted, per assignment) rather than cut here:

1. `templates/claude-code-agents/release-engineer.md:15,19` — mirrors
   `content/skill-release-engineer.md`'s hand-edit-prohibition lines, but
   still says `.current/handoff.md`; drifted out of sync when E174a fixed the
   source file.
2. `bin/agc-init.mjs:9,351` — comments referencing `.current/handoff.md` (E34
   legacy scaffolding note).
3. `scripts/capture-constitution-golden.mjs:154` — comment referencing a
   `.current/handoff.md` marker file used to detect a managed tmp workspace.
4. `scripts/summarize-metrics.mjs:4,11,20` — the default arg
   (`path.join(".current", "metrics.jsonl")`) is a genuine functional
   staleness, not just a comment: run with no argument in a lane workspace
   post-flip, it reads nothing and silently reports zero features.

## User Stories

- As a role or human following `content/**` / `docs/**` prose about governance
  state, I want every flat `.current/<file>` path mention to point at a file
  that actually exists post-E123, so I don't waste a hop looking in the wrong
  place or, worse, silently read stale/empty data (the retro jq one-liners).
- As any role performing a `tw_update_state` write, I want an unambiguous,
  self-contained rule — delivered at the point of dispatch (Task brief,
  Fallback SOP) rather than a constitution cross-reference — for what
  `dispatch_mechanism` / `dispatch_mechanism_tier` to record for THIS hop, so
  a pin-vs-actual mismatch is visible in `.current/<lane>/dispatch.jsonl`
  instead of silently wrong.

## Acceptance Criteria

- **AC1** — Given `content/coord-03-core-fallback.md`, when the two flat-path
  mentions at (current) lines 9 and 24 are retargeted per the Inventory table,
  then no `.current/handoff.md` or `.current/usage.jsonl` (flat) substring
  remains in the file.
  proof: `grep -c '\.current/handoff\.md\|\.current/usage\.jsonl' content/coord-03-core-fallback.md` prints `0`.

- **AC2** — **AMENDED (human decision 2026-09-24, "修", from
  `L-CONTENT-NEW-5`, filed by sr-engineer during T-E174-01 round 1)**. Given
  `content/coord-03-core-fallback.md`, when a `dispatch_mechanism:
  "switch_role"` attestation line is added directly after the Fallback
  description ("Call `tw_switch_role(<next_role>)` and follow the returned
  SOP in the same context."), then the line sets `dispatch_mechanism_tier` to
  the model tier the writer is ACTUALLY running as right now, self-identified
  from its own host/session context — NEVER the `dispatch_pins` entry for
  this role, and NEVER `tw_switch_role`'s `recommended_model` field (both are
  expected/requested values only, not a measurement of what the writer
  actually is — recording either one would make the field unable to ever
  disagree with itself). Re-derive fresh on every write, never copied from a
  previous hop. The line explicitly states: if a `dispatch_pins` entry for
  this role differs from the tier you record, do NOT correct your recorded
  tier to match the pin — that gap IS the pin-vs-actual mismatch E99 exists
  to surface in `.current/<lane>/dispatch.jsonl`.
  proof: `grep -n 'dispatch_mechanism' content/coord-03-core-fallback.md` shows the `"switch_role"` line names neither `dispatch_pins` nor `recommended_model` as its tier source, and states the no-correct-to-pin rule.

- **AC2b** — **AMENDED (same decision as AC2)**. Given the same file (one
  edit pass with AC1/AC2 — T-E174-01), when a `dispatch_mechanism: "inline"`
  line is added covering the case where a role is acted under in-context
  WITHOUT a fresh `tw_switch_role` call this turn (an initial session agent,
  coordinator/coordinator-lite writing directly under a role, or a role
  continuing under context it already held from an earlier hop), then the
  line likewise sets `dispatch_mechanism_tier` to the writer's own
  actually-running model tier, self-identified — NEVER the `dispatch_pins`
  entry for this role — re-derive fresh on every write, and states the same
  no-correct-to-pin rule as AC2.
  proof: `grep -n 'dispatch_mechanism' content/coord-03-core-fallback.md` shows an `"inline"` line, distinct from `"switch_role"`, that does not name `dispatch_pins` as a tier source and states the no-correct-to-pin rule.

  **AC4 (task, coord-02-host-dispatch.md) is UNCHANGED by this amendment** —
  for a real Task dispatch, the `model=` argument the coordinator passes IS
  what the subagent is actually dispatched to run on (assuming a
  well-behaved host), so "same tier as the Watermark line above" (= the
  `dispatch_pins`/`recommended_model` resolution) remains the correct,
  already-actual value there. The AC2/AC2b fix is specific to `switch_role`/
  `inline`, where the writer never left the caller's own context and a pin
  can never have been "dispatched" in the first place.

- **AC3** — Given `content/coord-06-host-token.md`, when the two
  `.current/usage.jsonl` mentions (lines 21, 30) are retargeted, then no flat
  `.current/usage.jsonl` substring remains.
  proof: `grep -c '\.current/usage\.jsonl' content/coord-06-host-token.md` prints `0`.

- **AC4** — Given `content/coord-02-host-dispatch.md`'s Dispatch Brief
  Template, when a new invariant line is added directly after the existing
  `Watermark your reply per Constitution §1 (...)` line, then it reads
  (substance, exact wording sr-engineer's judgment): "On your own
  `tw_update_state` write(s) this hop, set `dispatch_mechanism: \"task\"` and
  `dispatch_mechanism_tier` to the SAME `<tier>` as the Watermark line above —
  never a different value." This is already self-contained — it references
  the Watermark line directly above it IN THE SAME TEMPLATE (which the
  coordinator copies verbatim into every Task dispatch prompt, so the
  dispatched subagent sees both lines together even though it never loads
  `content/coord-02-host-dispatch.md` itself) — no `content/const-01-*`
  cross-reference, per the human's option-B decision (2026-09-24). The
  Dispatch Brief Template fenced block is still copy-verbatim-safe (no broken
  markdown fencing).
  proof: `grep -n 'dispatch_mechanism' content/coord-02-host-dispatch.md` shows a `"task"` line immediately following the Watermark line inside the fenced template.

- **AC5** — **DROPPED (human decision 2026-09-24, option B)**.
  `content/const-01-core-head.md` is untouched by this cut — the E99
  dispatch-attestation rule lives coordinator-side only, spread
  self-containedly across AC2 (switch_role), AC2b (inline), and AC4 (task).
  `T-E174-04` (the const-01 task) is VOIDED
  (`tw_void_task` reason: "human chose coordinator-side placement (option
  B)"). No sr-engineer task touches `content/const-01-core-head.md` in this
  cut.

- **AC6** — Given `docs/architecture.md`, when the four retarget rows in the
  Inventory table (lines 15, 45, 60, 286) are applied, then no flat
  `.current/handoff.md` or `.current/handoff.md.lock` substring remains, and
  line 60's diagram names the real lock basename `.current/<lane>/.handoff.lock`
  (matching `resolveLaneLockPath` / `HANDOFF_LOCK_FILENAME` in
  `tools/lane-paths.ts`).
  proof: `grep -c '\.current/handoff\.md[^/]' docs/architecture.md` (a flat handoff.md NOT followed by `/`, i.e. not part of a longer lane path) prints `0`.

- **AC7** — Given `docs/gate-retro-procedure.md`, when the six rows in the
  Inventory table (lines 4, 24, 36, 42, 82, 89) are applied, then: (a) every
  telemetry/metrics path mention is lane-scoped to the CURRENT lane
  (`.current/<lane>/…`), NEVER a cross-lane glob presented as a totals
  source; (b) both step-1/step-2 prose (lines 24, 82) explicitly names
  `tw_gate_stats` as the correct tool for cross-lane/cross-history totals,
  citing its de-duplication of merged-lane copies; (c) the two jq one-liners
  (lines 36, 42) are single-lane — if a glob variant is shown at all it
  carries an explicit ad-hoc/no-dedup caveat, never framed as a totals
  command; (d) line 89 keeps `scripts/summarize-metrics.mjs`'s own (still
  flat, unfixed — `L-CONTENT-NEW-4`) default literally as-is and adds the
  explicit-lane-path clause instead of rewriting the default.
  proof: `grep -n '\.current/telemetry\.jsonl\|\.current/metrics\.jsonl' docs/gate-retro-procedure.md` — every remaining hit is either lane-scoped (`.current/<lane>/…`) or the one `scripts/summarize-metrics.mjs` default-arg clause; NO hit is a bare `.current/*/…` glob presented without an ad-hoc/no-dedup caveat. `grep -c 'tw_gate_stats' docs/gate-retro-procedure.md` is ≥ 3 (its pre-existing step-2 mention, plus the new metrics-totals mention, plus the new no-dedup-glob caveat referencing it).

- **AC8** — Given `docs/http-mode.md`, when line 53 is retargeted per the
  Inventory table, then the "share state via Git" guidance names the lane
  directory, not the flat file.
  proof: `grep -n 'commit.*\.current' docs/http-mode.md` shows `.current/<lane>/` (directory), not `.current/handoff.md`.

- **AC9** — Given `docs/arming.md`, when lines 26 and 31 are retargeted, then
  no flat `.current/usage.jsonl` substring remains.
  proof: `grep -c '\.current/usage\.jsonl' docs/arming.md` prints `0`.

- **AC10** — Given the full `content/**` + in-scope `docs/**` tree after
  AC1–AC9 land, when re-run, the Inventory grep (the flat-`LANE_FILES`-path
  pattern from the Inventory section header) returns ONLY the Leave-as-is
  rows recorded above — no new, unclassified flat-path hit. This now
  explicitly includes `docs/gate-retro-procedure.md`'s
  `scripts/summarize-metrics.mjs` default-arg line (AC7(d) keeps
  `.current/metrics.jsonl` there verbatim, on purpose) — excluded from the
  proof grep by matching its CONTENT (`# default: .current/metrics.jsonl`),
  not its line number, since earlier edits in the same file have already
  moved it once (from :89 at spec-authoring time to :101 after T-E174-06
  landed) and will move it again.
  proof: `grep -rn '\.current/handoff\.md\|\.current/telemetry\.jsonl\|\.current/metrics\.jsonl\|\.current/usage\.jsonl\|\.current/dispatch\.jsonl' content/ docs/ | grep -v 'docs/install.md\|docs/backlog.md\|docs/v4.0.0-\|docs/schema-versions.md:57\|docs/agc-feedback-2026-09-08.md\|docs/dependency-advisories.md\|# default: \.current/metrics\.jsonl'` returns empty.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | prose/doc-only ticket, no product-facing strings |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | feature has no visual literals | — |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `docs/install.md`, `docs/backlog.md`, `docs/v4.0.0-*.md` — explicitly
  excluded by the assignment; not touched even where a flat-path mention was
  checked and found clean (`docs/install.md`) or intentionally out of this
  cut's file ownership.
- `templates/**`, `bin/**`, `scripts/**` — forbidden files for this cut. Their
  flat-path findings are logged to `NEW-TICKETS.md` as `L-CONTENT-NEW-1..4`,
  not fixed here.
- E137 policy prose (render-injection sanitization), E124b release close-out,
  E73/E130 coord-03 Feature-Scope Gate wording — explicitly named as
  do-not-pre-do in the assignment; not touched even though some sit in files
  this cut edits (`content/coord-03-core-fallback.md`).
- A new drift/retro surface that makes a `dispatch_mechanism` vs
  `dispatch_pins` mismatch *countable* (E99 option (ii), the spec for
  `e123a-lane-layout-migration` explicitly deferred this as a separate,
  future ticket) — this cut only adds the SOP obligation to populate the
  fields honestly, not a new gate/aggregator that reads them.
- Individual `content/skill-<role>.md` files do NOT get a restated copy of
  the dispatch-attestation rule. Human decision 2026-09-24 (option B): the
  rule lives coordinator-side only, in `content/coord-02-host-dispatch.md`
  (task) and `content/coord-03-core-fallback.md` (switch_role, inline) — NOT
  in the constitution. This works because coord-02's Dispatch Brief Template
  is copied VERBATIM into every Task-dispatch prompt (the dispatched
  subagent sees it without ever loading `coord-02-host-dispatch.md` itself),
  and switch_role/inline writes are, by construction, made by a session that
  already has `content/coord-*.md` loaded (the coordinator/teamwork prompt).
  `content/const-01-core-head.md` is untouched by this cut (AC5 dropped).
- Fixing `scripts/summarize-metrics.mjs`'s stale default path, or
  `bin/agc-init.mjs`'s / `scripts/capture-constitution-golden.mjs`'s stale
  comments, or `templates/claude-code-agents/release-engineer.md`'s drifted
  copy — all forbidden-file, logged as new tickets instead.

## Dependencies / Prerequisites

- Depends on E123 (shipped, v3.117.0) and E174a (shipped, v3.117.0) — both
  ✓ per `docs/backlog.md`.
- `test/fixtures/compose-golden/**` regeneration
  (`node scripts/capture-constitution-golden.mjs`) is qa-owned. AC5 is
  dropped (no `const-01-core-head.md` edit), so the constitution itself, its
  monolith golden, and every non-coordinator build/hook variant are
  UNTOUCHED by this cut. AC1/AC2/AC2b/AC4's `coord-03-core-fallback.md` +
  `coord-02-host-dispatch.md` edits affect ONLY `skill-coordinator-monolith.txt`
  and the `build-full-*` / `hook-full-*` variants (coordinator fragments are
  never composed into lite-mode or single-role builds — `coord-*.md` is never
  part of the bare `CONSTITUTION` floor). qa re-measures
  `test/context-budget.test.mjs` and adjusts ONLY the ONE floor this pushes —
  "AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is
  at/below the floor (≤ 18990 ~tok)" (`test/context-budget.test.mjs:1118`) —
  per §2.2 of `v4.0.0-execution-plan.md`. No other floor moves.
- `NEW-TICKETS.md` (`L-CONTENT-NEW-1..4`) already appended by pm during this
  cut — no sr-engineer task needed for that step.
- No external references (URLs, Figma, tickets) found in this assignment —
  Resource Audit Gate is a no-op (field omitted).
