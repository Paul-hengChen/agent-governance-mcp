# c9-protocol-fields

## Problem Statement
Three load-bearing routing/gating signals — which role should act next
(`next_role:`), which stranded role a PM amendment resumes
(`resume_of:`), and a code-reviewer's verdict (`review: APPROVED` /
`review: CHANGES_REQUESTED`) — currently live as free-text string
conventions embedded inside `pending_notes`. Humans and skill-driven
agents write and read these by convention; the ONE place the server
itself depends on a convention token (`resume_of: <target>`, consumed by
`tools/transitions.ts`'s Amend-Resume Edge) does so via a substring grep
over `pending_notes`, not a validated field. A10 (backlog) data-fied the
gate *definitions* (`gates/registry.ts`); the *signals* that clear/route
those gates remain stringly-typed, so a typo (`next_rol:`, `resume-of:`,
`review:APPROVED` with no space) silently fails to match and produces no
error — exactly the drift class A10 eliminated for gate definitions.

## User Stories
- As the coordinator (human or LLM), I want `next_role` to be a
  structured field I can read directly from `tw_get_state`, so that I
  don't have to parse routing intent out of prose and risk a
  mismatched/garbled token silently derailing the chain.
- As the server, I want `resume_of` to be a validated enum field
  consumed by `validateTransition`, so that the Amend-Resume Edge no
  longer depends on an unvalidated substring match against free-text
  notes.
- As a code-reviewer, I want to record my verdict in a dedicated field
  with server-checked consistency against `status`, so that an
  `APPROVED` verdict can never be written alongside a `FAIL` status (or
  vice versa) without the server catching it.
- As a human operator, I want `pending_notes` to revert to plain prose
  once the three tokens move out, so that the field reads as a note to
  a person, not a semi-structured protocol payload.

## Acceptance Criteria

**AC-1 — Schema bump (handoff v6 → v7)**
- Given the current handoff schema is v6 (`CURRENT_VERSIONS.handoff = 6`
  per `schema/versions.ts`; note `docs/schema-versions.md`'s "Handoff
  version history" table is stale — it stops at v5 and is missing the
  v6 `external_refs` row already shipped in code; this ticket's
  migration work must add BOTH the missing v6 row and the new v7 row).
- When this feature ships, then `CURRENT_VERSIONS.handoff` is `7`, and
  `schema/migrations-handoff.ts` registers a stamp-only v6→v7 migration
  (no field seeding — mirrors the v3→v4 and v4→v5 precedent: absence of
  the new fields on a migrated v6 file means "no routing signal
  recorded", not a synthesized default).

**AC-2 — Three new optional handoff fields**
- Given a `tw_update_state` write, when the caller passes `next_role`,
  it MUST be one of the 8 `AgentName` values from `tools/transitions.ts`
  (`pm | researcher | design-auditor | architect | sr-engineer |
  code-reviewer | qa-engineer | release-engineer`); an out-of-enum value
  is rejected by zod at the tool boundary (`tools/registry.ts`), before
  any gate runs — mirrors the `external_refs.state` closed-enum pattern
  (AC-9 of b8-external-ref-ledger).
- When the caller passes `resume_of`, it MUST be one of `code-reviewer |
  qa-engineer` (the exact target set the Amend-Resume Edge already
  restricts to in `tools/transitions.ts`).
- When the caller passes `review_verdict`, it MUST be one of `APPROVED |
  CHANGES_REQUESTED`.
- All three fields are surfaced verbatim in the `tw_get_state` JSON view
  (same `{ ...state }` passthrough pattern as `external_refs`).

**AC-3 — Transient, write-scoped semantics (NOT blindly preserved)**
- Given a write that omits `next_role` / `resume_of` / `review_verdict`,
  when the handoff is persisted, then all three fields are absent on
  that write — they are NOT carried forward from the previous state the
  way `prd_path` / `scope_decision` are blindly preserved, and NOT
  feature-scoped-preserved the way `external_refs` is.
- Rationale (record as a Decision Record in the architecture doc): these
  three fields are single-hop directives to the IMMEDIATE next reader —
  identical in lifetime to the `pending_notes` lines they replace, which
  are wholesale-replaced every write, never carried forward. Blindly
  preserving them would be a behavioral regression versus today (a
  stale `next_role: architect` from three writes ago would linger
  silently). Contrast explicitly with `cut_approved` (feature-scoped,
  re-arms on PM re-entry) and `external_refs` (feature-scoped, no
  re-arm) in the architecture doc so a future reader doesn't "fix" this
  into blind-preserve by analogy.

**AC-4 — `resume_of` replaces the pending_notes substring grep**
- Given `tools/transitions.ts`'s `resumeMarkerNames` helper currently
  greps `next_pending_notes` for an exact-trimmed `resume_of: <target>`
  line, when this feature ships, then the Amend-Resume Edge check reads
  a structured `next_resume_of` field on `TransitionRequest` instead
  (populated by `tools/handoff-orchestrator.ts` from
  `parsed.resume_of`), and the pending_notes-token parsing path is
  removed — not kept as a fallback. This repo ships the server change
  and the skill-text change (AC-7) in the same release, so no dual-read
  backwards-compat window is needed.
- The existing Amend-Resume Edge trust boundary is unchanged: the server
  validates only that the field names the exact target role being
  handed off to; whether that role was genuinely stranded remains the
  PM's honest attestation (same trust class as `scope_decision_why`).

**AC-5 — `review_verdict` / `status` consistency gate (new validation,
not just field promotion)**
- Given `agent_id === "code-reviewer"` and `review_verdict` is present
  on the write, when `review_verdict === "APPROVED"` and `status !==
  "In_Progress"`, OR `review_verdict === "CHANGES_REQUESTED"` and
  `status !== "FAIL"`, then the write is rejected with a new gate error
  code `REVIEW_VERDICT_STATUS_MISMATCH` (registered in
  `gates/registry.ts`'s `GateErrorCode` union + `GATE_REGISTRY`, with a
  `hintStatic` documented in >= 1 `content/*.md` file per the existing
  generative parity check in `test/error-code-contract.test.mjs`).
- This is the concrete "server validates enums instead of
  substring-matching" upgrade: today NOTHING checks that `review:
  APPROVED` in `pending_notes` agrees with the write's `status` — a
  code-reviewer could (by copy-paste error) write `status=FAIL` with a
  stray `review: APPROVED` note and nothing would catch it. Model this
  gate as a simple `plain-text` envelope check in
  `tools/handoff-orchestrator.ts`, analogous to `MISSING_EVIDENCE` /
  `MISSING_REVIEW_EVIDENCE` (NOT threaded through
  `TransitionRejection["error"]` — those two precedents are also outside
  that union, so this gate does not disturb the DR-8 pinned-cardinality
  test in `test/error-code-contract.test.mjs`).
- `review_verdict` is optional even for code-reviewer writes (a
  code-reviewer FAIL write with no verdict field is legal) — the gate
  only fires when the field is PRESENT and mismatched, never on
  absence.

**AC-6 — `next_role` is advisory metadata, not a transition input**
- `next_role` receives enum-shape validation only (AC-2). It is
  explicitly OUT OF SCOPE for this feature to cross-check `next_role`
  against `ALLOWED_TRANSITIONS` for the actual next write (that would
  require re-deriving legal edges from the CURRENT tuple at write time —
  a materially larger feature with its own false-positive risk, e.g. a
  PM legitimately routing to `pm` itself for a Blocked note). Document
  this exclusion explicitly in Out of Scope so a future reader doesn't
  assume it was an oversight.

**AC-7 — `pending_notes` reverts to prose; skill/constitution text
updated**
- Given the skill and constitution files that currently instruct roles
  to embed `next_role:`, `resume_of:`, or `review: APPROVED|
  CHANGES_REQUESTED` lines inside `pending_notes`, when this feature
  ships, then those files are updated to instruct setting the
  corresponding top-level field instead. `pending_notes` itself is
  described as free text for humans (situation description, rationale)
  — no remaining token convention.
- In-scope files (content-authored SOPs the coordinator/roles actually
  read at runtime): `content/const-05-core-standards.md`,
  `content/const-08-chain-31-mid.md`, `content/const-12-chain-r10-s4.md`,
  `content/skill-coordinator.md`, `content/skill-pm.md`,
  `content/skill-sr-engineer.md`, `content/skill-architect.md`,
  `content/skill-code-reviewer.md`, `content/skill-qa-visual.md`,
  `content/skill-release-engineer.md`, `content/skill-design-auditor.md`,
  `content/skill-doc-writer.md`, `content/skill-researcher.md` (13
  files — every `content/*.md` hit for `next_role:` / `resume_of` /
  the `review:` verdict token, confirmed by repo-wide grep during
  spec authoring).
- Out of scope for this feature (see Out of Scope): `docs/skills/*.md`
  (doc-writer-owned prose rewrites, refreshed post-PASS, not this
  ticket) and every historical `specs/*.md` file that documents an
  ALREADY-SHIPPED feature's use of the old convention (rewriting shipped
  history is not this ticket's job).

**AC-8 — dispatch_pins explicitly deferred (not this ticket)**
- `dispatch_pins: <role>=<model>` (the C8 model-tier pin convention) is
  NOT promoted to a first-class field by this feature. See Out of Scope
  for the reasoning; it remains a `pending_notes` convention exactly as
  specified by `specs/c8-crash-resume-protocol.md`.

**AC-9 — Backwards compatibility on migrate**
- Given an on-disk handoff.md at schema v6 whose `pending_notes` still
  contains legacy `next_role: x` / `resume_of: y` / `review: APPROVED`
  lines (written before this feature shipped), when it is next read,
  then the v6→v7 migration stamps the version and leaves
  `pending_notes` untouched verbatim (no semantic extraction into the
  new fields — mirrors the "stamp-only, seeds nothing" precedent). The
  new structured fields are simply absent on that file until the next
  writer sets them explicitly.

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
- **`dispatch_pins` promotion.** The C8 spec (`specs/c8-crash-resume-protocol.md`)
  explicitly named `dispatch_pins` as "backlog C9, a distinct future
  ticket" when it deferred the field. Backlog C9's own "Fix" text names
  only `next_role`, `resume_of`, `review_verdict` — `dispatch_pins` is
  not among them. Deciding this explicitly (per this ticket's
  assignment): **`dispatch_pins` stays deferred, again**, for three
  reasons — (1) backlog C9's fix text does not name it; (2) it is
  shaped differently from the other three (potentially multiple
  `<role>=<model>` entries per write, one per pinned role, vs. the other
  three which are single-value-per-write) and deserves its own schema
  design pass rather than being force-fit into this ticket's
  single-scalar-field pattern; (3) fine-grained ticket slicing has a
  better track record in this workspace than bundling adjacent-but-
  distinct concerns into one cut. It should be cut as its own future
  ticket (suggest: C9-b or a fresh backlog letter) once this ticket's
  pattern (schema bump + zod enum + skill-text migration) is proven in
  production.
- **`docs/skills/*.md` refresh.** These are doc-writer-authored,
  human-readable prose rewrites of the `content/skill-*.md` files
  (verified during spec authoring: they are NOT auto-generated, and NOT
  byte-similar to their `content/` counterparts). Refreshing them is
  doc-writer's standard post-PASS job, not this ticket's.
- **Historical `specs/*.md` files.** Every already-shipped spec that
  documents the OLD `next_role:` / `resume_of:` / `review:` pending_notes
  convention as historical record (e.g. `specs/c8-crash-resume-protocol.md`,
  `specs/a11-escalation-grammar.md`, `specs/pm-repair-resume-routing-architecture.md`)
  is left untouched. Rewriting shipped-feature history to match a later
  convention is out of scope and would corrupt the audit trail.
- **`ALLOWED_TRANSITIONS` cross-validation of `next_role`.** See AC-6.
- **Dual-read backwards-compat window for `resume_of`.** See AC-4 — this
  repo ships client (skill text) and server together, so no transition
  period supporting both the old pending_notes token AND the new field
  is built.

## Dependencies / Prerequisites
- **Resource Audit Gate (constitution §7):** scanned `docs/backlog.md`'s
  C9 entry, `specs/c8-crash-resume-protocol.md` (the deferral notes),
  `docs/schema-versions.md`, `tools/handoff.ts`, `tools/transitions.ts`,
  `tools/registry.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts`,
  and the 13 `content/*.md` files listed in AC-7 for `http(s)://`,
  `figma`, `sketch`, `mockup`, `URL`, `link`, `see <ticket>`, `Azure
  DevOps`, `JIRA`. **Zero hits** — every reference in scope is an
  in-repo file path. `external_refs` is omitted from this ticket's
  `tw_update_state` write (absence = zero external refs found =
  non-blocking).
- **No `design/c9-protocol-fields.md`** exists; mode = no-design. The
  Scope Decision Gate and Visual gates are not armed for this feature.
- Depends on the existing gate-registry infrastructure (A10) and the
  schema-versioning framework (`docs/schema-versions.md`) being in their
  current shipped state — both are already in production as of
  v3.54.0.
- Sequencing note for the architect: `tools/handoff.ts` (schema fields)
  must land before `tools/registry.ts` (zod validation) and
  `tools/transitions.ts` (Amend-Resume Edge rewire), which must land
  before `tools/handoff-orchestrator.ts` (wiring + new gate) and
  `gates/registry.ts` (new error code). Content/skill-text updates
  (AC-7) should land last, after the fields they describe actually
  exist and validate.
