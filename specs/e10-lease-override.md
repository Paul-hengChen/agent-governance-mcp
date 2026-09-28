# e10-lease-override

## Problem Statement

The feature-lease gate (`gates/feature-lease.ts`, E1/E1A, hardened by E13) has two
false-positive classes surfaced by the 2026-07-12 E8-start incident, both distinct
from the E13 terminal-marker fragility (E13 fixed the release-engineer
closing-write signature; both classes below happen on a still-live incumbent,
not a closing write): (1) a PM crash/failure-record write — Constitution §3
requires PM to still call `tw_update_state` with a failure summary on
crash/failure, and the only legal edges from `pm:*` are `(pm, In_Progress)` /
`(pm, Blocked)` self-loops — refreshes `last_updated` on the incumbent feature
even though the write records no forward progress; (2) `readHandoffState`'s
fire-and-forget schema-migration heal-write (`tools/handoff.ts` ~line 506-544)
does the same on every read that trips a migration, including reads with no
human present. Both are same-feature self-loop writes, so neither trips
`FEATURE_LEASE_HELD` for itself — the damage lands on the NEXT write, which
tries to claim a *different* feature and finds the incumbent's `last_updated`
falsely fresh. Net effect (documented incident): ~34 minutes of timeout-waiting
to start approved work (E8) in a workspace everyone present agreed was idle.
There is also no sanctioned path for a human to attest "this lease is dead"
and force the write through when the TTL/terminal-marker heuristics haven't
(yet) caught up — the only recourse today is waiting, using a worktree, or a
hand-edit (exactly the discipline-erosion the lease exists to prevent).

## User Stories

- As a PM whose crash/failure-record write is the only legal self-loop
  available, I want that write to NOT reset the incumbent feature's lease
  clock, so that a genuinely idle workspace doesn't re-arm a ~30-minute stall
  for the next feature.
- As the server's own migration-heal mechanism, I want my fire-and-forget
  write-back to preserve the pre-heal `last_updated` verbatim, so that a
  read-triggered schema heal — which is not evidence the feature is alive —
  cannot itself extend a dead lease.
- As a human present in the workspace who can see the incumbent feature has
  genuinely shipped or been abandoned, I want a sanctioned, audited way to
  declare "this lease is dead" and have the next write go through immediately,
  so that I am never again reduced to waiting out a TTL, spinning up a
  worktree, or asking an agent to hand-edit `.current/handoff.md`.
- As a maintainer, I want both new mechanisms scoped tightly enough that they
  cannot become a new clobber vector (the exact D9/D10 race the lease was
  built to close), so that fixing today's false positives doesn't reopen
  yesterday's true positive.

## Decision

Two independent, additive mechanisms — both file-mode only, both new
first-class `tw_update_state` fields, both transient (write-scoped, never
carried forward — the `next_role`/`resume_of`/`review_verdict` precedent, NOT
the persistent `cut_approved`/`dispatch_mode` precedent, since each is a
one-shot attestation about *this write*, not a durable feature property):

1. **`lease_override: true`** — a human-attested escape hatch that bypasses
   `FEATURE_LEASE_HELD` for the write it is set on, regardless of TTL or
   terminal-marker state. Mirrors the `cut_approved` §3.1 trust mechanics
   verbatim in shape: sanctioned writer is whichever context directly
   witnessed the human's chat-turn attestation (same-context dispatch: the
   acting role itself; Task-subagent dispatch: the coordinator, on the
   stranded role's still-current tuple) — never inferred from another agent's
   summary. UNLIKE `cut_approved`, this is not pinned to one edge (build-entry)
   — `FEATURE_LEASE_HELD` can fire on any incoming write, so `lease_override`
   must be usable on any edge. Audit-trail requirement (new, stricter than
   `cut_approved`'s bare boolean): the write MUST also carry `pending_notes[0]`
   matching `/^lease-override:/` with a human-readable reason — mirrors the
   `pending_notes[0]` signature convention E13 introduced for the closing-write
   marker (`/^Released v/`), reused here as a load-bearing audit line rather
   than a passive marker. A `lease_override: true` write whose `pending_notes[0]`
   does not match is rejected loud (own error code), never silently accepted
   unaudited.
2. **`bookkeeping_write: true`** — an attestation that THIS write is
   non-substantive (a failure-record / administrative-note / heal-equivalent
   touch, not forward progress), causing the server to PRESERVE the existing
   on-disk `last_updated` verbatim instead of stamping fresh `now()` (the
   unconditional `now = new Date().toISOString()` at `tools/handoff.ts`
   ~line 827). **Load-bearing restriction**: valid ONLY on a same-`active_feature`
   write (the incoming write's `active_feature` must equal the existing
   on-disk `active_feature`) — a differently-featured write is itself a fresh
   claim, and suppressing ITS freshness stamp would be actively dangerous (an
   attacker or a mistake could make a genuinely new feature's own lease look
   pre-aged, inviting exactly the premature-clobber race E1/E1A closed). A
   `bookkeeping_write: true` write whose `active_feature` differs from the
   existing state's is rejected loud (own error code), not silently accepted
   or silently downgraded to a normal write.
3. **`readHandoffState`'s migration heal-write is hard-wired to the
   `bookkeeping_write` behavior unconditionally** — no attestation needed,
   because it is server-internal and mechanically 100% non-substantive by
   construction (a schema heal is never a real state transition; this is the
   existing, accepted trust posture the `pendingNotes` passthrough at that
   call site already relies on). This closes false-positive class (2)
   directly; `bookkeeping_write: true` on a role-authored write closes class
   (1).

**Why NOT the literal backlog option (3)** ("a distinct administrative-note
`status`/flag"): a new `status` enum member ripples through
`ALLOWED_TRANSITIONS`, `validateTransition`, the four round-cap circuit
breakers, and every existing status-keyed gate in
`tools/handoff-orchestrator.ts` — a much larger blast radius than this
ticket's incident warrants. `bookkeeping_write` achieves the same practical
goal (stop conflating "record of being blocked" with "work in progress" for
LEASE purposes specifically) as a sidecar boolean attestation, the same
pattern already used for `cut_approved` / `scope_decision` / `dispatch_mode` /
`dispatch_pins` — zero new transition edges, zero new status values.

**Why NOT inferring "non-substantive" automatically** (e.g., from
agent/status tuple equality, or from `status != In_Progress`): PM's
crash-record write and a PM re-entry that is genuinely resuming real work look
identical in (agent_id, status) shape — both are `(pm, In_Progress)` or
`(pm, Blocked)` self-loops. Only the writer knows which one this is; an
attested, explicit, auditable flag is the honest trust boundary (same posture
as `scope_decision_why` / `resume_of` — attested, not server-verified for
*truthfulness*, but server-verified for *shape*, i.e. the same-feature
restriction in mechanism 2 above and the audit-note-format requirement in
mechanism 1).

**Schema impact**: unlike E13 (zero new fields, zero schema bump), this ticket
adds two new frontmatter-eligible fields — matching the `dispatch_pins`/v8,
`dispatch_mode`/v11, cumulative-totals/v12 precedent, this is expected to bump
`CURRENT_VERSIONS.handoff` from 12 to 13 (`schema/versions.ts`,
`docs/schema-versions.md` procedure). Confirm exact migration-registry
mechanics is an architect decision (see Dependencies) — flagged here so it is
not missed as an implementation afterthought.

## Acceptance Criteria

- **AC1** — Given `FEATURE_LEASE_HELD` would otherwise reject an incoming
  `tw_update_state` write (incumbent lease fresh and non-terminal per the
  existing predicate), when the write carries `lease_override: true` AND
  `pending_notes[0]` matches `/^lease-override:/`, then the write is accepted
  — the lease-held check is bypassed for this write only, on any edge.
  proof: `test/feature-lease.test.mjs` — new case: stale-fails-normally
  predicate state + `lease_override: true` + matching note → orchestrator
  accepts.
- **AC2** — Given `lease_override: true` is set but `pending_notes[0]` does
  NOT match `/^lease-override:/` (or `pending_notes` is empty), when the write
  is submitted, then the server rejects it with a distinct error code
  (e.g. `LEASE_OVERRIDE_AUDIT_MISSING`) — an unaudited bypass is never
  silently accepted.
  proof: `test/feature-lease.test.mjs` — new case: `lease_override: true`,
  no/mismatched note → rejected, `FEATURE_LEASE_HELD`'s original rejection
  does NOT silently fall through as an accept.
- **AC3** — Given `lease_override` is set on a write whose `active_feature`
  differs from the incumbent's (the exact shape the mechanism exists for),
  when the write succeeds, then `lease_override` is NOT persisted / carried
  forward to any subsequent write (transient, write-scoped) — a later write
  omitting the field is evaluated by the normal `FEATURE_LEASE_HELD` predicate
  with no residual bypass.
  proof: `test/feature-lease.test.mjs` — new case: write N sets
  `lease_override: true` and succeeds; write N+1 (same or different feature,
  omitting the field) against a freshly-stamped incumbent is evaluated
  normally.
- **AC4** — Given `readHandoffState` triggers its migration heal-write (a
  schema migration was applied on this read), when the heal-write persists,
  then `last_updated` is preserved verbatim from the pre-heal on-disk value
  instead of being stamped to `now()` — no attestation field required (server
  path, not role-authored).
  proof: `test/feature-lease.test.mjs` or a `tools/handoff.test.mjs`-adjacent
  case — new test: simulate a migration-triggering read, assert post-heal
  `last_updated` equals pre-heal `last_updated`, and that a subsequent
  different-feature write is evaluated against the ORIGINAL age, not a
  refreshed one.
- **AC5** — Given a role-authored `tw_update_state` write carries
  `bookkeeping_write: true` and its `active_feature` equals the existing
  on-disk state's `active_feature` (the PM crash/failure-record shape), when
  the write persists, then `last_updated` is preserved verbatim from the
  existing on-disk state rather than refreshed — the incumbent lease's
  measured age continues to reflect the last REAL write, not the bookkeeping
  touch. A sibling write omitting the flag stamps fresh `now()` as today
  (unchanged default).
  proof: `test/feature-lease.test.mjs` — new case pair: (a) same-feature
  write with `bookkeeping_write: true` → `last_updated` unchanged from
  pre-write state; (b) identical write without the flag → `last_updated`
  refreshed (regression guard on the unflagged default).
- **AC6** — Given a `bookkeeping_write: true` write whose `active_feature`
  DIFFERS from the existing on-disk state's `active_feature`, when the write
  is submitted, then the server REJECTS the combination with a distinct error
  code (e.g. `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`) rather than silently
  accepting it or silently downgrading to a normal (refreshed) write — closes
  the footgun where marking a brand-new feature's own claim as "bookkeeping"
  would let it look artificially pre-aged.
  proof: `test/feature-lease.test.mjs` — new case: `bookkeeping_write: true`
  + `active_feature` != existing → rejected.
- **AC7** (repro-first discipline, engineering practice — NOT server-gated,
  see dispatch-mode rationale below) — Given this ticket's `dispatch_mode` is
  `"feature"` (the server's `REPRO_MANIFEST_MISSING` gate does not arm), when
  sr-engineer implements the AC4 migration-heal-write timestamp fix, then a
  failing reproduction test demonstrating the CURRENT bug (heal-write
  refreshing `last_updated`) is authored and recorded in
  `qa_reports/expected-red_e10-lease-override.txt` BEFORE the fix lands, and
  QA confirms it turns green after, with zero unexplained new reds elsewhere
  in the suite — same discipline as E13's server-enforced AC7, applied here
  voluntarily since the root-cause half of this ticket (AC4) is bugfix-shaped
  even though the ticket as a whole is not.
  proof: `qa_reports/expected-red_e10-lease-override.txt` names the exact new
  test id(s); QA confirms red→green turnover at PASS.
- **AC8** — Given `content/const-08-chain-31-mid.md` (Constitution §3.1), when
  read after this ticket ships, then it carries two new bullets: (a) the
  **Lease-Override** mechanism, documenting the sanctioned-writer /
  coordinator-attested trust rule (same structure as the existing
  Cut-Approval Gate bullet) plus the audit-note-format requirement and
  any-edge scope; (b) the **Bookkeeping-Write** mechanism, documenting the
  timestamp-preservation semantics, the same-`active_feature` restriction, and
  that the migration heal-write is its hard-wired unconditional equivalent.
  Both cross-reference `gates/feature-lease.ts`'s existing E1/E1A/E13 header
  comment lineage rather than restating it.
  proof: grep-based constitution-text pinning test (mirrors the existing
  skill/constitution pinning-test convention, e.g. E13's AC6 test).
- **AC9** (storage-mode scoping, mirrors E13 AC4) — Given SQLite/HTTP storage
  mode, when a write carries `lease_override` and/or `bookkeeping_write`, then
  neither field is persisted or has any effect on lease/timestamp behavior —
  both live in the handoff YAML frontmatter only (file-mode only), matching
  the existing `cut_approved` / `external_refs` / `dispatch_mode` asymmetry;
  SQLite-mode lease behavior stays byte-for-byte unchanged (TTL-bounded only).
  proof: `test/feature-lease.test.mjs` — new SQLite-mode orchestrator-path
  test: both fields set, SQLite storage → no effect, unchanged from pre-fix
  behavior.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no new user-facing strings (internal governance-tooling fix, mirrors E13) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **E13** (`e13-terminal-marker-advisory`) — already shipped (v3.79.0,
  commit df057f5). This ticket is additive to the current
  `gates/feature-lease.ts` shape; it does NOT reopen or modify the E13
  terminal-marker disjunct (`next_role === "pm" || /^Released v/.test(...)`).
  Same trust surface (feature-lease gate), separate concern (still-live
  incumbent vs. a closing write).
- Backlog's literal option (3) ("a distinct administrative-note
  `status`/flag") — NOT implemented as a new `status` enum value; folded into
  the `bookkeeping_write` boolean attestation instead (see Decision — blast
  radius rationale).
- Extending either new mechanism to SQLite/HTTP mode — deliberately deferred
  (AC9), matching E13's precedent; a future ticket's explicit decision.
- Changing `LEASE_TTL_MIN` (30 min, `tools/handoff-orchestrator.ts`) itself —
  untouched.
- Root-causing WHY a migration heal fires mid-PM-session at all (the
  underlying migration-triggering read) — out of scope, same posture as
  E13's Out-of-Scope carve-out for the heal mechanism itself; this ticket
  makes the heal's *timestamp effect* safe, not the heal's *existence*.
- Changing `next_role` / `resume_of` / `review_verdict` / `cut_approved` /
  `scope_decision` / `dispatch_mode` / `dispatch_pins` semantics anywhere —
  untouched.
- Any inference-based ("automatic") detection of non-substantive writes —
  explicitly rejected in favor of the attested `bookkeeping_write` flag (see
  Decision).
- A general-purpose "any write can suppress its own timestamp" capability —
  `bookkeeping_write` is restricted to same-`active_feature` writes only
  (AC6); this is a hard boundary, not a convenience default.

## Dependencies / Prerequisites

- **E13** (`specs/e13-terminal-marker-advisory.md`, shipped v3.79.0) — read in
  full before implementation; this spec's predicate additions land alongside,
  not instead of, E13's terminal-marker disjunct in the same file
  (`gates/feature-lease.ts`).
- **Constitution §3.1** (`content/const-08-chain-31-mid.md`) — the
  Cut-Approval Gate bullet is the structural template for the new
  Lease-Override bullet (AC8); do not restate the mechanism in
  `skill-pm.md`/`skill-coordinator.md` beyond a pointer, matching the existing
  convention for `resume_of`/`review_verdict`.
- **Touch points** (from backlog + code-reading this ticket cycle):
  `gates/feature-lease.ts` (predicate — likely a new sibling predicate module
  `gates/lease-override.ts` mirroring `gates/cut-approval.ts`'s shape, per
  the registry pattern), `tools/handoff-orchestrator.ts` (~line 196
  `FEATURE_LEASE_HELD` block — new bypass branch; new audit-format and
  same-feature-restriction gates), `tools/handoff.ts` (`writeHandoffState`
  ~line 827 unconditional `now` stamp needs a preserve-existing branch; the
  migration heal-write call site ~line 518-544 needs to opt into it
  unconditionally), `schema/versions.ts` + `schema/migrations-handoff.ts` +
  `docs/schema-versions.md` (anticipated v12→v13 bump — see Decision).
- **Zero external references** (no URLs/Figma/tickets) found in the backlog
  entry, the E13 spec, or intake instructions — Resource Audit Gate: no
  action needed; `external_refs` omitted on the routing write.
- Architect owns the exact mechanism split across these files (new predicate
  module vs. inline orchestrator logic; where the same-feature-restriction
  check lives; exact error-code names) and the schema-version-bump procedure
  per `docs/schema-versions.md` — this spec fixes the *behavior* (ACs above),
  not the file-by-file implementation.
