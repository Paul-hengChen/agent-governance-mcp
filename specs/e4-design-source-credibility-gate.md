# Spec: Design-Auditor Source-Credibility Attestation + Build-Entry Gate

> v1.0 — authored 2026-07-12 by @pm

## Problem Statement

`content/skill-design-auditor.md` step 2b (Source-Credibility Classification,
v3.38.0) already instructs the design-auditor to classify every fetch-based
target node as (a) full-page/screen composite frame, (b) component-variant /
component-set child, (c) read-only review/overview page, or (d) other — and
to STOP (`status=Blocked`, `next_role=pm`) before extracting any values when
the classification is not (a). This is the retrospectives' single
highest-leverage lever: Mode P2 was saved by an agent correctly applying this
check pre-build (zero rework); Mode P1 was reopened for skipping it
(mis-sourced per-card crops, full-round redo); Language's lossy-geometry root
cause cost 4 rework rounds (55.6% of 1.05M tokens,
`research/mode-feature-process-retrospective.md`). Today the check is **SOP
prose only** — nothing records that the classification ran, and nothing
server-side verifies it before the pm→build hop. An agent (careless, under
context pressure, or simply a weaker model) can skip step 2b silently and
extract from a wrong node, and no gate catches it — the exact gap that
reopened Mode P1. This spec closes it the same way `B8` closed the analogous
gap for external references: turn a self-reported SOP step into a recorded
attestation the server checks before build starts
(`specs/b8-external-ref-ledger.md` pattern).

## User Stories

- As a PM routing a design-armed feature to build, I want the server to
  refuse the pm→build hop when the design artifact's `## Source` manifest
  lacks a recorded source-credibility attestation on an audited row, so a
  skipped or failed step-2b classification cannot silently reach
  implementation.
- As a design-auditor, I want my step-2b verdict recorded as a structured,
  parseable field in `design/<feature>.md`, so the server — not just my own
  SOP discipline — confirms the check ran before any downstream role builds
  against my baselines.
- As an architect/sr-engineer receiving the pm→build handoff, I want to trust
  that every audited manifest row was verified as the correct full-page
  composite, without re-deriving that provenance myself.
- As a coordinator running auto-routing, I want a documented stop-condition
  for this gate so auto-routing halts and surfaces the problem to the human
  instead of looping on a rejected transition.

## Acceptance Criteria

**AC-1 — `credibility` attestation column on the `## Source` manifest:**
Given design-auditor writes an `audited` row to the `## Source` manifest for
a fetch-based mode (`figma`/`sketch`/`xd`/`penpot`), When the row is written,
Then it MUST carry a `credibility` cell whose value is the literal
`full-page-composite` — the only value an `audited` row can legally carry,
because step 2b's existing STOP rule (AC-2 below) means classifications (b)/
(c)/(d) never reach an `audited` row in the first place. This makes the
already-mandatory-but-unverified step 2b classification a durable,
machine-checkable artifact rather than a self-reported SOP action.

**AC-2 — existing STOP behavior is unchanged (regression guard):**
Given step 2b classifies a target node as (b) component-variant, (c)
read-only review page, or (d) other, When design-auditor would otherwise
record that node's row, Then it MUST still STOP per the existing Escalation
Route (`status=Blocked`, `next_role=pm`, unchanged from v3.38.0) — this spec
adds an attestation column and a server gate on top of that behavior, it does
not relax or replace it.

**AC-3 — server gate blocks the pm→build hop on a missing/wrong attestation:**
Given `design/<active_feature>.md` exists, its `## Mode` is one of
`figma`/`sketch`/`xd`/`penpot`, and its `## Source` manifest contains at
least one `audited` row whose `credibility` cell is empty, absent, or any
value other than `full-page-composite`, When `tw_update_state` is called on
the `pm:In_Progress → {architect,sr-engineer}:In_Progress` edge, Then the
server returns a new gate error (recommend `SOURCE_CREDIBILITY_UNVERIFIED`)
in the standard orchestrator-json envelope (`{error, attempted, allowed,
hint}`), and the hint names the offending row(s) (medium + pointer).

**AC-4 — dormant outside the fetch-based-mode arm (no false positives):**
Given `design/<active_feature>.md` mode is `image`/`pdf`/`paper`/`no-design`,
OR no `design/<active_feature>.md` exists, OR the design file has no `##
Source` section at all (pre-2c/pre-this-feature audits), When the same edge
is attempted, Then the gate does NOT fire — mirrors the existing opt-in /
backwards-compat philosophy of `checkBaselineManifest` (`gates/visual.ts`
AC-4/AC-N3): image/pdf/paper/no-design modes are human-confirmed sources that
step 2b itself already skips (skill-design-auditor.md step 2b, "`image`/
`pdf`/`paper`/`no-design` modes skip this gate"), and a manifest lacking the
whole `## Source` section is dormant the same way `BASELINE_MANIFEST_MISSING`
is.

**AC-5 — independent of, and additive to, the existing baseline-manifest
gates:**
Given `design/<active_feature>.md` already satisfies (or fails)
`BASELINE_MANIFEST_MISSING` / `BASELINE_PROVENANCE_INCOMPLETE` (existing
PASS-time gates in `gates/visual.ts`), When the pm→build hop is attempted,
Then `SOURCE_CREDIBILITY_UNVERIFIED` is evaluated as a wholly separate check
at a different edge (build-entry, not PASS) — passing the baseline-manifest
gates does not imply passing this one, and vice versa. Both must be
independently satisfiable; this spec does not fold one into the other.

**AC-6 — gate is pinned to the pm:In_Progress predecessor (resume safety):**
Given `architect:In_Progress → sr-engineer:In_Progress` or any self-loop edge
(prev agent ≠ pm), When `tw_update_state` is called, Then the gate does NOT
fire regardless of manifest contents — resume/re-entry into a stranded
downstream role (Amend-Resume Edge, Constitution §3.1) is never re-blocked by
an attestation problem recorded on an earlier PM write. Same pinning
discipline as `SCOPE_DECISION_REQUIRED`/`CUT_APPROVAL_REQUIRED`/
`EXTERNAL_REFS_UNRESOLVED`.

**AC-7 — storage-mode agnostic (unlike the handoff-YAML ledger gates):**
Given the active storage is `SqliteHandoffStorage` (HTTP/SQLite mode) or
`FileHandoffStorage` (stdio mode), When the gated edge is attempted with an
armed design file, Then the gate fires identically in both modes — the
attestation lives in `design/<feature>.md` (a workspace file `gates/visual.ts`
already reads directly via `fs`, independent of handoff storage kind), NOT in
handoff YAML frontmatter. This is a deliberate DIFFERENCE from
`cut_approved`/`external_refs` (file-mode-only) and a deliberate SIMILARITY to
`hasDesignModeRequiringVisual`/`checkBaselineManifest` (mode-agnostic). No
handoff schema version bump, no `tools/handoff.ts` changes, no
`tools/registry.ts` zod schema changes are needed for this feature — the
attestation is authored entirely inside `design/<feature>.md`.

**AC-8 — hint format + cross-references:**
Given the gate fires, When the error is returned, Then the hint text follows
the existing `hintStatic` split convention (dynamic prefix built at the
orchestrator emit site + static suffix from `gate("SOURCE_CREDIBILITY_UNVERIFIED").hintStatic`)
and the static suffix names `content/skill-design-auditor.md` step 2b and
this spec.

**AC-9 — coordinator Auto-Routing stop-condition:**
Given Auto-Routing reads pending state after a PM handoff, When the gate has
fired (or would fire), Then the coordinator stop-condition list includes this
gate as a documented halt — same shape as the existing cut-approval /
external-refs stop-conditions — so auto-routing surfaces the problem to the
human instead of retrying the same rejected write in a loop.

**AC-10 — build gate: npm run build + audit + tests pass:**
Given all code changes are in place, When `npm run build && npm audit
--audit-level=high && npm test` are run, Then all three commands exit 0.

## Copy / Strings

All strings are error envelope values, a manifest column header, or SOP text
authored in-server — no external design source.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S01 | `SOURCE_CREDIBILITY_UNVERIFIED` | authored-here — error code, mirrors `SCOPE_DECISION_REQUIRED`/`EXTERNAL_REFS_UNRESOLVED` naming pattern |
| S02 | `"Source-credibility attestation missing or unverified for: {rows}. Every audited row in a fetch-based design (figma/sketch/xd/penpot) must carry credibility: full-page-composite in the ## Source manifest before routing to build. See content/skill-design-auditor.md step 2b and specs/e4-design-source-credibility-gate.md."` | authored-here — hint string; `{rows}` is the dynamic interpolation (comma-joined offending medium/pointer pairs), static suffix lives in `gate("SOURCE_CREDIBILITY_UNVERIFIED").hintStatic` |
| S03 | `credibility` | authored-here — new `## Source` manifest column header; only legal value on an `audited` row is `full-page-composite` (AC-1) |
| S04 | `full-page-composite` | authored-here — closed attestation value, verbatim label for step 2b classification (a); the only value a compliant `audited` row can carry |

## Visual Tokens

N/A — this feature introduces no visual UI. All output is MCP error
envelopes, a markdown table column, and SOP/constitution-adjacent text.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual tokens | authored-here — server-only feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — no `design/e4-design-source-credibility-gate.md` exists; this feature
is infra/meta (it changes how *other* features' design docs are gated), no
design mode is armed for it.

## Out of Scope

- Automatically verifying that a node classified `full-page-composite` is
  *actually* correct (i.e., re-deriving whether the frame truly composes the
  intended screen). That judgment remains step 2b's job (an SOP/human-style
  check); this spec only makes the fact that the check ran, and its verdict,
  machine-checkable — the same "record the decision, don't re-implement the
  decision" boundary B8 drew for external-reference fetch/index/ignore calls.
- Retroactively populating `credibility` for `design/<feature>.md` files
  written before this feature ships — no backfill; AC-4's "no `## Source`
  section at all" dormancy also covers pre-2c designs that predate the
  manifest itself.
- Extending the attestation concept to `image`/`pdf`/`paper` modes. Step 2b
  itself already scopes the classification to fetch-based modes only
  (human-confirmed sources for the others); this spec does not change that
  scope.
- Any change to the `BASELINE_MANIFEST_MISSING` / `BASELINE_PROVENANCE_INCOMPLETE`
  gates' own logic — AC-5 keeps them fully independent.
- Enforcing this gate in lite-mode / in-context paths that emit no
  `tw_update_state` transition — same acknowledged limitation as
  `pm-cut-approval-gate` AC-3 (SOP-level instruction only for those paths).
- Any handoff schema version bump, `tools/handoff.ts` YAML changes, or
  `tools/registry.ts` zod schema changes — per AC-7, the attestation lives
  entirely in `design/<feature>.md`, not in handoff state.

## Dependencies / Prerequisites

### Cross-module scope → architect first

This ticket touches `content/skill-design-auditor.md` (Artifact Schema `##
Source` manifest row + step 2b instruction to record `credibility`),
`gates/visual.ts` (extend `parseBaselineManifestRows`/`BaselineManifestRow`
with a `credibility` cell, or add a sibling parser — architect to decide) plus
a new composition predicate (`checkSourceCredibility` or similar, mirroring
`checkBaselineManifest`'s shape), `gates/registry.ts` (new
`SOURCE_CREDIBILITY_UNVERIFIED` `GateErrorCode` + registry entry),
`tools/handoff-orchestrator.ts` (new gate check wired into the frozen
check-order comment block, at the same `pm:In_Progress →
{architect,sr-engineer}:In_Progress` edge as `SCOPE_DECISION_REQUIRED`/
`CUT_APPROVAL_REQUIRED`), `content/skill-coordinator.md` (+
`content/skill-coordinator-lite.md` if its Auto-Routing section independently
enumerates stop-conditions) for the AC-9 stop-condition, and a one-line
`content/skill-pm.md` Gate Summary/SOP cross-reference for awareness (PM does
not author this attestation — design-auditor does, upstream — so no new
PM-side gate row is needed, just a pointer). This is the same shape as
`b8-external-ref-ledger` (which routed PM→architect) minus the schema/
migration/handoff.ts/registry.ts-zod work — B8's ledger lived in handoff YAML
and needed a version bump; this attestation lives in an existing
already-read workspace file and needs none. The architect must:

1. Decide the exact parser placement: extend the existing
   `BaselineManifestRow`/`parseBaselineManifestRows` (`gates/visual.ts`) with
   a `credibility` field (DRY — same table, same section, one read), versus a
   fully separate parser. PM's recommendation: extend the existing parser,
   since both checks read the identical `## Source` table.
2. Confirm the exact insertion point in `tools/handoff-orchestrator.ts`'s
   frozen check-order sequence — PM's recommendation: immediately alongside
   the existing Scope-Decision / Cut-Approval / External-Refs build-entry
   attestation checks (same edge, same predecessor-pinning), so all
   build-entry attestation gates for a design-armed feature run back-to-back.
3. Confirm whether `SOURCE_CREDIBILITY_UNVERIFIED` needs a
   `TRANSITION_REJECTED` union-member doc-comment in `tools/transitions.ts`
   (mirrors `EXTERNAL_REFS_UNRESOLVED`'s comment block) for envelope
   consistency and the `ALL_GATE_CODES`/gate-count test invariant, even
   though it is handler-side-only (reads a workspace file, not
   `validateTransition`'s pure inputs).
4. Confirm the fetch-based-mode allow-list (`figma`/`sketch`/`xd`/`penpot`)
   is encoded as an explicit inclusion list (NOT `hasDesignModeRequiringVisual`'s
   broader "any mode != no-design" exclusion pattern) — this gate is
   deliberately narrower than the Scope-Decision arm, matching step 2b's own
   scope, and conflating the two arm conditions would falsely fire on
   `image`/`pdf`/`paper` modes.

### Test coverage

`test/error-code-contract.test.mjs` needs the gate-count re-baseline (mirror
the inline b8/c9/c15/c16/d9 count-bump precedent comments already in the
file). The closest functional analog is the `BASELINE_MANIFEST_MISSING`/
`BASELINE_PROVENANCE_INCOMPLETE` test coverage in
`test/*visual*gate*.test.mjs` (dormancy conditions, row-parsing, backwards
compat) plus the resume-safety pattern in `test/cut-approval-gate.test.mjs` /
`test/feature-scope-gate.test.mjs` (prev-pinned-to-pm). qa-engineer should
extend existing files rather than create a parallel test surface, per current
test-ownership practice.

### E8 boundary check (explicit, per coordinator routing note)

E8 (success-side telemetry, in progress elsewhere) owns telemetry emission
and a release-SOP line. This ticket does not touch `content/skill-release-engineer.md`,
any telemetry emission code, or release-time reporting — the new gate fires
at the pm→build hop, entirely upstream of release. No overlap found; no
deferred-boundary note needed beyond this confirmation.

### Known accumulated drift (out of scope for this ticket)

`tw_detect_drift` reports 12 historical tasks-ahead entries
(`T-C5C18-09`…`T-C12-06`) from prior released features, plus
`T-E2-REL`/`T-E2-DONE` incomplete in the task list. Pre-existing, unrelated to
this ticket — not reconciled here per standing instruction.
