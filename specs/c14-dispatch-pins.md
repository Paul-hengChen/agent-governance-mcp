# c14-dispatch-pins

Source: `docs/backlog.md` §C14 — "dispatch_pins survives only by hand-carried
pending_notes" (P1, observed 2026-07-09; C9 follow-on).

## Problem Statement

`specs/c8-crash-resume-protocol.md` gave the coordinator a `dispatch_pins:
<role>=<model>` **pending_notes convention** so a human's model-tier pin
(e.g. "pin `sr-engineer` to `fable` for this feature") survives context loss
and crash-resume. `specs/c9-protocol-fields.md` later promoted three other
pending_notes tokens (`next_role`, `resume_of`, `review_verdict`) to
first-class handoff fields, but explicitly **re-deferred** `dispatch_pins`
(AC-8 / Out of Scope) — its shape differs (potentially several
`<role>=<model>` entries per write, vs. the other three's one-value-per-write
scalar) and c9 judged it deserved its own schema-design pass.

In the live c9-protocol-fields run, the deferral's cost showed up
immediately: the human's `sr-engineer=fable` pin survived four role hops and
two crash-resumes **only** because the coordinator manually wrote "carry
`dispatch_pins: sr-engineer=fable` VERBATIM" into every dispatch brief.
`pending_notes` is replaced wholesale on every `tw_update_state` write — one
role forgetting the line silently drops the pin, and the next dispatch (or a
crash-resume) degrades to the frontmatter/`recommended_model:` default with
**no error surfaced**. The only defense today is the coordinator's own
Subagent Reply Watermark Validation "Pinned-tier expectation" clause, which
is a **post-hoc string patch** — it can correct the watermark's printed tier,
but it cannot make the wrong model have executed the role's work.

This ticket does what c9 deferred: give `dispatch_pins` a first-class,
schema-validated, **persistent** handoff field, and close the self-correction
gap by letting the dispatched role itself read its own pin (rather than
depending solely on the coordinator's after-the-fact correction).

## User Stories

- As the coordinator, I want `dispatch_pins` to persist automatically across
  every write that doesn't touch it, so a human's model-tier pin can never be
  silently dropped by a role forgetting to restate a note line.
- As a dispatched role subagent, I want to read my own pin directly from
  `tw_get_state`, so I can stamp my own watermark correctly at the source
  instead of relying entirely on the coordinator's post-hoc string
  correction.
- As the coordinator running the Crash-Resume Protocol, I want step 3 to
  read a validated field, not grep free text, so a misspelled or malformed
  `pending_notes` line can no longer silently fail to match.
- As a human operator, I want pins scoped to the feature that's currently
  active, so a pin from a finished feature doesn't leak into the next one
  without me re-asserting it.

## Acceptance Criteria

**AC-1 — Schema bump (handoff v7 → v8)**
- Given the current handoff schema is v7 (`CURRENT_VERSIONS.handoff = 7` per
  `schema/versions.ts`, shipped by c9-protocol-fields / v3.55.0), when this
  feature ships, then `CURRENT_VERSIONS.handoff` is `8`, and
  `schema/migrations-handoff.ts` registers a stamp-only v7→v8 migration (no
  field seeding — mirrors the v3→v4, v4→v5, v6→v7 precedent: absence of the
  new field on a migrated v7 file means "no pins recorded," not a
  synthesized default). `docs/schema-versions.md`'s "Handoff version
  history" table gets the new v8 row.

**AC-2 — `dispatch_pins` field shape: closed keys, open values**
- Given a `tw_update_state` write, when the caller passes `dispatch_pins`,
  it MUST be an object whose keys are drawn from the same closed 8-value
  `AgentName` set `next_role` already validates against (`pm | researcher |
  design-auditor | architect | sr-engineer | code-reviewer | qa-engineer |
  release-engineer`) — an unknown key is rejected by zod at the tool
  boundary (`tools/registry.ts`), before any gate runs, mirroring the
  `next_role` closed-enum precedent (c9 AC-2).
- Each value is a bounded free-text string (non-empty, ≤ 100 chars) naming
  the pinned model tier (e.g. `fable`, `opus`, `sonnet`, `haiku`, or a
  fully-qualified model id). Values are deliberately **NOT** closed-enum —
  unlike `next_role`/`resume_of`/`review_verdict`, the legal model-tier
  vocabulary is not owned by this server and evolves independently (new
  tiers ship on Anthropic's cadence, not this repo's). A typo'd model name
  is a client-side error the server does not gate on here — same trust class
  as `scope_decision_why`.
- The field is surfaced verbatim in the `tw_get_state` JSON view (same
  `{ ...state }` passthrough pattern as `external_refs` / `next_role`).

**AC-3 — Write semantics: REPLACE wholesale, not merged**
- Given a write that passes `dispatch_pins`, when the write is persisted,
  then the ENTIRE map is replaced with exactly what was passed — the server
  does **not** merge the incoming keys into the previously-persisted map
  key-by-key. This mirrors `external_refs`' and `completed_tasks`' existing
  REPLACE convention; no field in this schema currently does server-side
  per-key merge, and introducing that as a new semantic class is explicitly
  out of scope (see Out of Scope).
- Decision Record: this means a caller adding or changing ONE role's pin
  MUST read the existing `dispatch_pins` (via `tw_get_state`) and include
  every still-wanted entry in the write, exactly the discipline the old
  `pending_notes` convention already demanded of the coordinator (C8 spec:
  "carry every note you still want kept"). The difference this ticket adds
  is AC-4 below: a write that omits the field ENTIRELY no longer drops it —
  only a write that explicitly supplies a narrower map can shrink it.

**AC-4 — Persistence: feature-scoped, no PM-re-entry re-arm**
- Given a write that OMITS `dispatch_pins`, when the write is persisted,
  then the existing map is carried forward unchanged IF
  `existing.active_feature === this write's active_feature`, and dropped
  (`undefined`) if `active_feature` changed. This is the exact algorithm
  `external_refs` already uses (c9/b8 precedent) — **not** the
  `cut_approved` algorithm (which re-arms to `undefined` on every PM
  `In_Progress` re-entry) and **not** the `next_role`/`resume_of`/
  `review_verdict` algorithm (transient — dropped on ANY omitting write,
  never carried forward at all, per c9 AC-3).
- Rationale (record as a Decision Record, cross-referencing c9 AC-3 so a
  future reader doesn't "fix" this into either sibling pattern by analogy):
  `dispatch_pins` is a **durable directive**, not a single-hop routing
  signal (unlike `next_role`/`resume_of`/`review_verdict`) — it must survive
  every write in the chain that doesn't concern it, which is exactly the
  bug this ticket fixes. It is also not an approval gate that should force
  re-attestation on PM re-entry (unlike `cut_approved`) — a PM bouncing a QA
  FAIL back to `In_Progress` should not silently un-pin a role mid-feature.
  It empties only when the feature itself changes, same polarity and same
  rationale as `external_refs`.
- Emit only a non-empty map to frontmatter (empty object is NOT serialized —
  mirrors `external_refs`' "empty === absence" rule, keeps the file clean).

**AC-5 — File-mode only, no new gate**
- `dispatch_pins` round-trips in the handoff YAML frontmatter only.
  `SqliteHandoffStorage.writeState` ignores it, same as `cut_approved`/
  `external_refs`/the three v7 protocol fields (DR-5 precedent). SQLite
  `schema_version` stays at its current value — no DDL change.
- `dispatch_pins` is advisory bookkeeping, like `next_role` (c9 AC-6) — it is
  **not** cross-checked against `ALLOWED_TRANSITIONS`, does not gate any
  transition, and registers **no** new `GateErrorCode` in
  `gates/registry.ts`. `tools/handoff-orchestrator.ts` only needs to thread
  the parsed value through to `storage.writeState(...)`'s options — no new
  validation branch.

**AC-6 — Coordinator skill text reads the field, not `pending_notes`**
- `content/skill-coordinator.md`'s three `dispatch_pins`-touching passages
  are rewritten to use the field instead of the pending_notes convention:
  1. The **"Dispatch-time overrides (`dispatch_pins`)"** paragraph (Auto-
     Routing section): the persist-before-dispatch obligation now calls
     `tw_update_state(dispatch_pins: {...})` (still a same-tuple amendment
     before the `Task(...)` call — same pattern as the Cut-approval gate
     writer obligation) instead of appending a `pending_notes` line. State
     the AC-3 REPLACE-wholesale caveat explicitly (read-then-include-every-
     still-wanted-entry).
  2. **Crash-Resume Protocol step 3**: "read `pending_notes` for a
     `dispatch_pins: <role>=<model>` entry" becomes "read the `dispatch_pins`
     field (via `tw_get_state`) for an entry naming the role being resumed."
  3. **"Pinned-tier expectation"** paragraph (Subagent Reply Watermark
     Validation section): "if `pending_notes` carries a `dispatch_pins:
     <role>=<model>` entry" becomes "if the `dispatch_pins` field carries an
     entry for the dispatched role."
  Remove the now-stale "this is a note-convention, not a schema field
  (backlog C9 ... out of scope here)" pointer text — this ticket is that
  promotion landing.

**AC-7 — Self-correcting watermark: one shared constitution rule, not eight
duplicated skill-file rules**
- The backlog's fix text asks for "a one-line skill rule in each role: never
  re-derive model tier from frontmatter when a pin covers the role."
  `content/const-01-core-head.md` line 4 states "Skills inherit everything
  below — they MUST NOT restate these rules," and its own `## 1. Output
  Directives` section already owns the Watermark rule (the `<tier>` format
  table) that every role's skill inherits. Duplicating the same one-line
  rule into all 8 `content/skill-<role>.md` files would violate that
  standing mandate.
- Given this feature ships, then `content/const-01-core-head.md`'s Watermark
  bullet gains exactly ONE new line/row: when `dispatch_pins` (read via
  `tw_get_state`) names the CURRENT role, the `<tier>` in the "Task-spawned
  with `model:` pinned by the parent" row MUST be the pin value — never
  re-derived from `~/.claude/agents/<role>.md` frontmatter or a skill's own
  `recommended_model:` default. This single shared edit satisfies "each
  role" because every role inherits `const-01-core-head.md` (per dispatch
  mode composition, `prompts/constitution-manifest.ts`).
- This lets the dispatched role self-correct its OWN watermark at the
  source, closing the gap the existing coordinator-side "Pinned-tier
  expectation" post-hoc string patch (AC-6.3) cannot: a corrected watermark
  string still doesn't mean the pinned model executed, but a role that reads
  its own pin before replying has no reason to stamp the wrong tier in the
  first place. The coordinator-side check remains as a second line of
  defense (a role that ignores this new rule is still caught downstream).

**AC-8 — Backwards compatibility on migrate**
- Given an on-disk `handoff.md` at schema v7 whose `pending_notes` still
  contains a legacy `dispatch_pins: <role>=<model>` line (written under the
  C8-era convention, before this feature shipped), when it is next read,
  then the v7→v8 migration stamps the version and leaves `pending_notes`
  untouched verbatim — no semantic extraction into the new field (mirrors
  c9 AC-9's "stamp-only, seeds nothing" precedent for its three fields). The
  legacy line becomes inert prose; the new field is absent until the next
  writer sets it explicitly.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings (protocol/schema change only) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **Per-key server-side merge semantics.** See AC-3's Decision Record —
  `dispatch_pins` follows the existing wholesale-REPLACE convention shared
  by `completed_tasks`/`external_refs`; introducing a new per-key-merge
  semantic (with its own removal-sentinel design) is a materially different
  and larger feature. If the wholesale-replace footgun manifests again in
  production (a coordinator drops another role's pin by omitting it from a
  write), cut a follow-on ticket then — do not speculatively build it now
  (this workspace's fine-grained-ticket-slicing precedent, cf. c9 AC-8's own
  reasoning for deferring this ticket in the first place).
- **SQLite/HTTP-mode persistence.** File-mode only (AC-5), mirrors the v6/v7
  DR-5 precedent. No `schema/migrations-sqlite.ts` step, no DDL, no sqlite
  `schema_version` bump.
- **`ALLOWED_TRANSITIONS` cross-validation of `dispatch_pins`.** Advisory
  metadata only, like `next_role` (c9 AC-6) — no new gate, no new
  `GateErrorCode`.
- **Model-value validation.** Values stay free text (AC-2) — the server does
  not maintain or enforce a canonical model-tier vocabulary.
- **Duplicating the frontmatter-override rule into each
  `content/skill-<role>.md` file.** See AC-7 — the single shared
  `const-01-core-head.md` edit is the correct implementation of "each role"
  given the "MUST NOT restate" mandate already governing this repo's
  content architecture.
- **`content/skill-coordinator-lite.md`.** Same rationale as
  `c8-crash-resume-protocol` AC-5: lite is server-read-only, single-shot,
  never runs a multi-hop chain, and never dispatches a role with a model
  override — there is no pin to lose.
- **`docs/skills/*.md` refresh.** Doc-writer-owned prose rewrites of the
  `content/skill-*.md` files, refreshed post-PASS — not this ticket's job
  (c9 precedent).
- **Historical `specs/*.md` files.** `specs/c8-crash-resume-protocol.md` and
  `specs/c9-protocol-fields.md` document the OLD `pending_notes` convention
  and its deferral as historical record; both are left untouched — rewriting
  shipped-feature history would corrupt the audit trail (c9 precedent).
- **C17 (coordinator dispatch briefs restate protocol by hand).** Backlog
  C17 explicitly notes it overlaps this ticket ("pin block drops out of the
  template once pins are a field") and should sequence AFTER it — not
  addressed here.

## Dependencies / Prerequisites

- **Resource Audit Gate (Constitution §7):** scanned `docs/backlog.md`'s C14
  entry, `specs/c8-crash-resume-protocol.md`, `specs/c9-protocol-fields.md`
  (Out of Scope / AC-8), `docs/schema-versions.md`, `tools/handoff.ts`,
  `tools/registry.ts`, `tools/handoff-orchestrator.ts`, `tools/storage.ts`,
  `tools/storage-sqlite.ts`, `tools/transitions.ts`, `gates/registry.ts`,
  `content/const-01-core-head.md`, `content/skill-coordinator.md`, and each
  `content/skill-<role>.md`'s `recommended_model:` frontmatter, for
  `http(s)://`, `figma`, `sketch`, `mockup`, `URL`, `link`, `see <ticket>`,
  `Azure DevOps`, `JIRA`. **Zero hits** — every reference in scope is an
  in-repo file path. `external_refs` is omitted from this ticket's
  `tw_update_state` write (absence = zero external refs found =
  non-blocking).
- **No `design/c14-dispatch-pins.md`** exists; mode = no-design. The Scope
  Decision Gate and Visual gates are not armed for this feature.
- Depends on `c8-crash-resume-protocol` (the `dispatch_pins` pending_notes
  convention, v3.53.0) and `c9-protocol-fields` (the v7 field-promotion
  pattern this ticket reuses — schema bump + zod closed-enum + skill-text
  migration — plus its explicit AC-8 deferral naming this exact follow-on),
  both already shipped in production.
- Sequencing note for the architect: `tools/handoff.ts` (schema field, v7→v8
  migration wiring, read/write REPLACE + feature-scoped-preserve logic) must
  land before `tools/registry.ts` (zod validation), which must land before
  `tools/handoff-orchestrator.ts` (pass-through wiring; no new gate) and
  `tools/storage-sqlite.ts` (confirm/document the ignore). `docs/schema-
  versions.md`'s table update can land alongside the schema-file changes.
  `content/const-01-core-head.md` (AC-7) and `content/skill-coordinator.md`
  (AC-6) should land last, after the field actually exists and validates —
  same ordering rationale as c9's AC-7 content updates.
