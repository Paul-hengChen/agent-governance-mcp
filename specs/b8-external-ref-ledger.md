# Spec: §7 External-Reference Ledger + Build-Entry Gate

> v1.0 — authored 2026-07-09 by @pm

## Problem Statement

Constitution §7 (`content/const-15-core-tail.md`) states that a spec referencing
external artifacts (URLs, design files, ticket IDs, mockups, "see XYZ") is
presumed **incomplete** until each reference is fetched, indexed, or
user-confirmed ignorable — but this is prose only. `tw_update_state` never
verifies it (compare §3 pre-flight, which IS server-enforced). The origin
incident: an OOBE PRD had per-section Figma placeholders while the real
Figma link sat only in a trailing "相關連結" section; a PM reading
section-by-section could skip it with every other gate green. This spec adds
a server-enforced ledger — mirroring the proven `scope_decision`/`cut_approved`
pattern (`specs/pm-cut-approval-gate.md`, `specs/server-scope-decision-gate.md`)
— that blocks the PM→build hop while any recorded external reference remains
`unresolved`.

## User Stories

- As a human reviewer, I want the server to block build-entry if the PM's
  spec has an unresolved external reference, so that engineers never build
  against a spec with a silently-dropped design/requirement doc.
- As a PM agent, I want a structured place to record each external reference
  and its resolution state, so my Resource Audit Gate decisions are
  machine-checked, not just prose in the spec body.
- As an architect, I want the same ledger surfaced to me so `Deferred
  Resources` reflects reality instead of relying on me re-reading the spec
  for missed links.
- As a coordinator, I want a documented stop-condition for this gate so
  auto-routing halts and surfaces the unresolved refs to the human instead of
  looping.

## Acceptance Criteria

**AC-1 — Server gate blocks build entry while any ref is unresolved:**
Given a handoff with `last_agent: pm`, `status: In_Progress`, and
`external_refs` containing at least one entry with `state: "unresolved"`,
When `tw_update_state` is called with `agent_id` in `{architect, sr-engineer}`
and `status: In_Progress` (the `pm:In_Progress → {architect,sr-engineer}:In_Progress`
edge),
Then the server returns `error: "EXTERNAL_REFS_UNRESOLVED"` in the standard
orchestrator-json envelope (`{error, attempted, allowed, hint}`), and the
hint enumerates the unresolved `ref` values.

**AC-2 — Resolved or absent ledger clears the gate:**
Given a handoff where `external_refs` is either absent, empty, or every
entry has `state` in `{fetched, indexed, user-confirmed-ignorable}`,
When `tw_update_state` is called on the same edge,
Then the gate does NOT fire and the transition proceeds normally. Absence of
`external_refs` means "PM's Resource Audit Gate found zero external
references" — a legitimate, common, non-blocking state — NOT an
unresolved sentinel. (This is the inverse of `cut_approved`, where absence
blocks; documented explicitly here to prevent the two gates being implemented
by analogy with the wrong polarity.)

**AC-3 — Gate is pinned to the pm:In_Progress predecessor:**
Given `architect:In_Progress → sr-engineer:In_Progress` or any self-loop edge
(prev agent ≠ pm),
When `tw_update_state` is called,
Then the gate does NOT fire, regardless of ledger contents — resume/re-entry
into a stranded downstream role (Amend-Resume Edge, Constitution §3.1) is
never re-blocked by a ledger populated on an earlier PM write.

**AC-4 — Gate fires on both PM→architect and PM→sr-engineer:**
Given the same unresolved-ledger precondition as AC-1,
When `tw_update_state` targets EITHER `architect:In_Progress` OR
`sr-engineer:In_Progress` from `pm:In_Progress`,
Then the gate fires on both edges identically — this is the B8-specific
requirement ("gate at PM→architect, not only PM→sr") — matching how
`SCOPE_DECISION_REQUIRED` and `CUT_APPROVAL_REQUIRED` already gate both
edges.

**AC-5 — File-mode only (mirrors cut_approved D5):**
Given the active storage is `SqliteHandoffStorage` (HTTP/SQLite mode),
When `tw_update_state` is called on the gated edge with any `external_refs`
value,
Then the gate is skipped unconditionally (`getActiveStorage() instanceof
FileHandoffStorage` check, identical guard to `CUT_APPROVAL_REQUIRED`) —
`external_refs` is handoff-YAML-only; SQLite mode has no column, so the field
never round-trips through `prevState` there. Skipping (rather than gating on
an always-empty read) makes this explicit rather than accidental.

**AC-6 — Ledger field: type, persistence, and reset-on-feature-change:**
Given PM calls `tw_update_state` with `external_refs: [{ref, state}, ...]`,
When the write succeeds,
Then the array is persisted verbatim in handoff YAML frontmatter under
`external_refs`; a subsequent write in the SAME `active_feature` that omits
`external_refs` preserves the existing array (same preserve-if-omitted rule
as `scope_decision`/`cut_approved`); a write with a DIFFERENT `active_feature`
resets it to absent (feature-scoped, same re-arming rule as `cut_approved`).
Passing `external_refs` on a write always REPLACES the array wholesale (same
semantics as `completed_tasks` — not merged/appended).

**AC-7 — Schema: `external_refs` field + migration:**
Given an existing handoff at `schema_version: 5`,
When the server reads it after upgrade,
Then it is lazily migrated to `schema_version: 6` with `external_refs`
absent (not seeded to `[]` — absence is the "zero refs found" state, per
AC-2). `CURRENT_VERSIONS.handoff` bumps 5 → 6 in `schema/versions.ts`.

**AC-8 — Migration is pure and lossless:**
Given any handoff payload at schema_version 5,
When the v5→v6 migration runs,
Then only `schema_version` is bumped; no existing field is modified,
removed, or seeded.

**AC-9 — Ref state enum is closed:**
Given a `tw_update_state` call with an `external_refs` entry whose `state` is
not one of `fetched`, `indexed`, `user-confirmed-ignorable`, `unresolved`,
When the zod schema validates the input,
Then the call is rejected before reaching the transition/gate logic (schema
validation failure, standard zod error path — no new server-side error code
needed for this case).

**AC-10 — Constitution §7 wording reflects enforcement:**
Given `content/const-15-core-tail.md` §7 "External-reference policy",
When a reader reviews it after this feature ships,
Then the bullet states that the audit is now backed by a per-spec ledger
(`external_refs`) and that `tw_update_state` rejects the PM→build hop while
any entry is `unresolved`, replacing the current "no role may unilaterally
treat them as out-of-scope" prose-only framing with a concrete mechanism
reference.

**AC-11 — skill-pm Gate Summary reflects the ledger:**
Given `content/skill-pm.md` §Gate Summary, row "Resource Audit Gate",
When PM reads the clearing-action cell after this feature ships,
Then it instructs PM to record each hit's `fetch`/`index`/`ignore`
classification as an `external_refs` entry (state
`fetched`/`indexed`/`user-confirmed-ignorable`) via `tw_update_state`, and
explicitly warns that leaving an entry `unresolved` (or omitting a
known-load-bearing ref entirely) blocks the step-8 routing write.

**AC-12 — coordinator skill Auto-Routing stop-condition:**
Given Auto-Routing is reading `pending_notes`/handoff state after a PM
handoff,
When the ledger contains an `unresolved` entry,
Then the coordinator stop-condition list (mirroring the cut-approval
stop-condition, AC-8 of `specs/pm-cut-approval-gate.md`) includes this gate
as a documented halt: surface the unresolved refs to the human and wait, not
auto-hop through to build.

**AC-13 — Build gate: npm run build + audit + tests pass:**
Given all code changes are in place,
When `npm run build && npm audit --audit-level=high && npm test` are run,
Then all three commands exit 0.

## Copy / Strings

All strings are error envelope values or SOP text authored in-server — no
external design source.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S01 | `EXTERNAL_REFS_UNRESOLVED` | authored-here — error code, mirrors `SCOPE_DECISION_REQUIRED`/`CUT_APPROVAL_REQUIRED` naming pattern |
| S02 | `"External reference(s) unresolved: {refs}. Each entry in external_refs must be fetched, indexed, or user-confirmed-ignorable before routing to build. See content/skill-pm.md §Resource Audit Gate and specs/b8-external-ref-ledger.md."` | authored-here — hint string; `{refs}` is the dynamic interpolation (comma-joined unresolved `ref` values), static suffix lives in `gate("EXTERNAL_REFS_UNRESOLVED").hintStatic` |
| S03 | `fetched` / `indexed` / `user-confirmed-ignorable` / `unresolved` | authored-here — closed enum for `external_refs[].state`, verbatim from the B8 backlog fix description |

## Visual Tokens

N/A — this feature introduces no visual UI. All output is MCP error
envelopes and SOP/constitution text.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual tokens | authored-here — server-only feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — `design/<feature>.md` does not exist; no design mode is armed for this
feature.

## Out of Scope

- Automated URL-scraping / heuristic detection of external references in
  spec prose. The backlog fix explicitly prefers an "explicit PM-populated
  ledger over URL-scraping the spec (heuristic, error-prone)" — PM populates
  `external_refs` by hand during the Resource Audit Gate, same as
  `scope_decision`/`cut_approved` are hand-set attestations, not
  server-inferred.
- Adding `external_refs` to the SQLite schema — file-mode-YAML only (AC-5),
  same precedent as `cut_approved` (D5 in `specs/pm-cut-approval-gate-architecture.md`).
  HTTP/SQLite-mode deployments do not enforce this gate.
- Validating that a `ref` string is a real, reachable URL/id — the field is
  free text; only `state` is validated against the closed enum.
- Any change to `tw_index_prd` itself, or to how `fetched`/`indexed`
  decisions are technically executed — this spec only adds the
  bookkeeping/gate layer on top of the existing (unchanged) fetch/index
  mechanisms referenced in §7.
- Enforcing this gate in lite-mode / in-context paths that emit no
  `tw_update_state` transition — same acknowledged limitation as
  `pm-cut-approval-gate` AC-3 (SOP-level instruction only for those paths;
  see Dependencies below).
- Retroactively populating `external_refs` for specs written before this
  feature ships — no backfill.

## Dependencies / Prerequisites

### Cross-module scope → architect first

This ticket touches `tools/transitions.ts` (rejection-union doc-comment),
`gates/registry.ts` + a new `gates/external-refs.ts` predicate module,
`tools/handoff-orchestrator.ts` (new gate check wired into the FROZEN
check-order comment block), `tools/handoff.ts` (schema field + YAML
round-trip + preserve/reset logic), `schema/versions.ts` +
`schema/migrations-handoff.ts` (v5→v6 migration), `tools/registry.ts` (zod
schema + tool descriptor text), plus two content files
(`content/const-15-core-tail.md`, `content/skill-pm.md`). This is the same
shape and module count as `gate-registry` (A10) and `pm-cut-approval-gate`,
both of which routed PM→architect. The architect must:

1. Confirm the exact insertion point of the new gate check in
   `tools/handoff-orchestrator.ts`'s frozen check-order sequence (this spec's
   recommendation: immediately after the Cut-Approval Gate block, before the
   QA evidence record — i.e., all three build-entry attestation gates run
   back-to-back: scope-decision → cut-approval → external-refs).
2. Confirm whether `EXTERNAL_REFS_UNRESOLVED` needs a `TRANSITION_REJECTED`
   union-member doc-comment in `tools/transitions.ts` (mirrors
   `CUT_APPROVAL_REQUIRED`'s comment block, lines 83-89) even though it is
   handler-side-only, for envelope-consistency and to keep the "18-gate
   catalog" (`gates/registry.ts`) and the `ALL_GATE_CODES` test invariant in
   sync (now 19 gates).
3. Decide the exact YAML shape for `external_refs` in `tools/handoff.ts` —
   this spec specifies `Array<{ref: string; state: ExternalRefState}>`; the
   architect confirms js-yaml round-trips array-of-object frontmatter fields
   cleanly (no existing handoff field is array-of-object; `completed_tasks`/
   `pending_notes` are array-of-string) and specifies the parse/serialize
   code precisely.
4. Confirm the persistence/reset algorithm (AC-6) slots into the existing
   `effectiveScopeDecision`/`effectiveCutApproved` preserve-logic block in
   `tools/handoff.ts` (~lines 435-492) without reordering it.

### Schema version bump

Current `CURRENT_VERSIONS.handoff` is `5` (`schema/versions.ts`, bumped by
`pm-cut-approval-gate`). This feature bumps it to `6`. The architect must
confirm no concurrent feature is also bumping this version at merge time.

### Constitution §7 + skill-pm wording (this spec's own scope)

AC-10/AC-11 changes are content-only (`content/const-15-core-tail.md`,
`content/skill-pm.md`) and can be authored alongside the code changes by
sr-engineer once the architecture doc fixes the exact gate name/mechanics —
no separate architect sign-off needed for the prose itself, only for where
it points.

### Coordinator stop-condition (AC-12)

`content/skill-coordinator.md` (or `skill-coordinator-lite.md` if
applicable) Auto-Routing section gains one stop-condition entry, same shape
as the existing cut-approval stop-condition (`pm-cut-approval-gate.md` AC-8 /
S04). Confirm exact file/section with the architect since it wasn't named in
the B8 backlog owner-scope line but is required for auto-routing correctness
(an unresolved-ref halt that only the server enforces, with no coordinator
awareness, means auto-routing spins on `EXTERNAL_REFS_UNRESOLVED` instead of
surfacing it).

### Test coverage

`test/cut-approval-gate.test.mjs` and `test/feature-scope-gate.test.mjs` are
the closest analogs (same edge, same file-mode-only pattern, same
prev-pinned-to-pm resume safety). `test/handoff-migration.test.mjs` and
`test/schema-versions.test.mjs` cover the v5→v6 migration precedent
(`test/handoff-migration.test.mjs` already has the v4→v5 case for
`cut_approved`). qa-engineer should extend these existing files rather than
create a parallel test surface, per current test-ownership practice.
