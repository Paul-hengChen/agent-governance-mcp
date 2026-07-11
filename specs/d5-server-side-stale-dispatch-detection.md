# Spec: d5-server-side-stale-dispatch-detection

## Problem Statement

The Crash-Resume Protocol (`content/skill-coordinator.md` §Crash-Resume
Protocol, v3.53.0) exists to recover when a Task-dispatched subagent is
externally killed mid-task (session/usage-limit kill, host crash) before its
own `tw_update_state` lands. Today that protocol is triggered entirely by the
**coordinator's own memory**: the Escalation Routes "Crash detection" row
fires when the coordinator itself notices "a dispatched `Task(...)` call
returns a tool-error or empty/truncated reply... BEFORE that role's own
`tw_update_state` landed." This works as long as the coordinator that issued
the dispatch survives to notice the failure.

It does not work when the **coordinator itself** is compacted or killed after
dispatching but before the dispatched role writes back. In that scenario the
handoff shows a stale tuple (`last_agent`/`status` still the pre-dispatch
values, or `next_role` still naming the dead role) and nothing on disk marks
that a dispatch is actually in flight. A fresh coordinator session (or the
same one, post-compaction) reading `tw_get_state` sees an ordinary-looking
handoff and has no way to distinguish "nobody has been dispatched yet" from
"someone was dispatched and silently died" — the wedge is invisible to
exactly the context that would otherwise run Crash-Resume (backlog
`docs/backlog.md` D5, C8 follow-on).

This is structurally the same class of problem D2 (hop counter, token
accounting) already solved for cost-side circuit breakers: coordinator-memory
bookkeeping is not durable across compaction/crash, so it must become a
server-computed, persisted field instead. D5 applies the identical
"model arithmetic/memory → durable server/file accounting" fix to the
dispatch-liveness signal specifically.

## Architecture Decision Required — deferred to architect

The backlog frames the fix as: "orchestrator stamps `dispatched_at` + target
role on (or alongside) the state write preceding a dispatch; `tw_get_state`
surfaces 'stale in-flight dispatch: `<role>`, no state write for >N min' so
ANY context ... can detect the dead role and run Crash-Resume without
dispatch-side memory." PM's reading of the existing mechanism, flagged here
for the architect to confirm, adjust, or override:

- **"The state write preceding a dispatch" already exists and is
  identifiable.** Per `content/skill-coordinator.md` §Auto-Routing: "After
  each role's handoff, read the just-written state... If the first-class
  `next_role` field is set... dispatch to the role it names." The write that
  sets `next_role` (handoff schema v7, c9-protocol-fields) IS the state write
  immediately preceding every dispatch in the current protocol — there is no
  separate "about to dispatch" tool call today. `next_role` is also already
  **transient** (`tools/handoff.ts` — "emitted into frontmatter ONLY when set
  on THIS write... a write that omits any of the three drops it — they are
  never preserved from the existing state"): it is present on the persisted
  handoff if and only if no subsequent write has landed since. That
  transience is exactly the liveness signal D5 needs — a target role that
  wrote back would either omit `next_role` (chain paused/ended) or set its
  OWN new `next_role` (chain continues), either way overwriting the stale
  one.
- **PM recommendation (non-binding): piggyback, don't invent a new tool
  call.** Add one companion field, tentatively `dispatched_at?: string` (ISO
  timestamp), stamped **server-side** (not client-supplied) by the
  orchestrator (`tools/handoff-orchestrator.ts`) whenever an incoming write
  sets `next_role` — mirroring `next_role`'s own transient lifecycle
  byte-for-byte (present only when `next_role` is present on the same write;
  dropped whenever a subsequent write replaces or omits it). This requires
  zero new arguments from any `tw_update_state` caller and zero new
  coordinator-side bookkeeping — the server derives both "target role" (=
  `next_role`, already captured) and "dispatched at" (= `now()` at write
  time) from information the write already carries.
- **Staleness is then a pure read-time computation, not a new gate.** On
  `tw_get_state`, if the persisted state carries `next_role` and
  `dispatched_at`, and `now() - dispatched_at > N minutes`, surface an
  advisory field/message (exact shape pinned by architect) — e.g. `"stale
  in-flight dispatch: <next_role>, no state write for >N min"`. This is
  **informational only**: it does not block any `tw_update_state` write and
  needs no new `GateErrorCode` in `gates/registry.ts` (nothing is being
  rejected; the existing write-side check order in
  `tools/handoff-orchestrator.ts` is untouched). It is a `tw_get_state`
  read-path addition only — the architect should confirm this framing (no
  gate) is correct, since it means D5 does NOT extend the
  `GateErrorCode` union, unlike every one of D2/C9/C14/A10's changes.
- **Open for the architect to pin:**
  1. Exact field name(s) — `dispatched_at` is a placeholder; the architect
     may also decide a distinct advisory output key is needed on the
     `tw_get_state` JSON response (vs. letting every caller re-derive the
     "> N min" check from `dispatched_at` + `next_role` themselves).
  2. The **N-minute threshold** — a fixed constant (mirroring `HOP_CAP = 10`
     in `content/const-01-core-head.md`), or an opt-in
     `.current/.config.json` field (mirroring `tokenBudgetPerFeature`'s
     "absent = feature disabled" precedent, `tools/config.ts`). PM leans
     toward a sane hardcoded default (candidate: 15 min, refinable) with NO
     config knob, since (unlike the token budget) there's no legitimate
     reason a workspace would want this advisory disabled — but the
     opt-in-config precedent is available if the architect disagrees.
  3. **Storage-mode scope** — `next_role` today is explicitly **file-mode
     only** (v7, DR-5: "SqliteHandoffStorage.writeState ignores all three").
     Does `dispatched_at` inherit that same file-mode-only restriction (the
     natural default, since it is `next_role`'s direct companion), or does
     the architect want SQLite/HTTP-mode parity? PM recommends inheriting
     file-mode-only unless a concrete HTTP-mode Crash-Resume use case is
     identified — extending SQLite scope is new surface, not this ticket's
     stated problem.
  4. **`schema_version` impact** — a new optional field on the handoff
     frontmatter is an additive change; per `docs/schema-versions.md` v9 is
     the current handoff version (`hop_count`), so this is a v9→v10 bump,
     stamp-only, seeding nothing (mirrors v4/v6/v7/v8's "absence = no
     signal recorded" precedent, NOT v9's "seed 0" precedent — there is no
     true pre-feature value to seed; absence of `dispatched_at` simply means
     "no dispatch currently in flight").
  5. Whether the Crash-Resume Protocol's existing 3-step procedure (ground
     truth the tree → restate findings → re-assert `dispatch_pins`) needs a
     new **step 0** ("read the stale-dispatch signal from `tw_get_state`
     when a fresh session cannot rely on its own memory of having
     dispatched anything") or whether the existing "Crash detection" trigger
     row in the Escalation Routes table gets a second clause covering the
     fresh-session case. The architect's file-by-file diff plan should
     specify the exact skill-prose edit.

The architect makes the final call in
`specs/d5-server-side-stale-dispatch-detection-architecture.md`, sized so no
single sr-engineer task exceeds the `task_size` budget (≤5 files/300 lines) —
splitting the draft task list below further if needed, preserving task
ordering and `depends_on` chains.

## User Stories

- As the coordinator, if I am compacted or crash after dispatching a role but
  before that role's own `tw_update_state` lands, I want the NEXT session
  (mine, post-compaction, or a completely fresh one) to see from
  `tw_get_state` alone that a dispatch is in flight and stale, so that
  Crash-Resume can run without depending on my own dead memory of having
  dispatched anything.
- As a fresh coordinator session picking up a workspace I've never seen
  before, I want `tw_get_state` to proactively surface "stale in-flight
  dispatch: `<role>`, no state write for >N min" rather than silently
  presenting an ordinary-looking handoff tuple, so I know to run
  Crash-Resume BEFORE re-dispatching or resuming.
- As a maintainer, I want this mechanism to reuse the existing `next_role`
  field's transient lifecycle rather than invent a new one-off dispatch-ack
  tool call, so the codebase doesn't grow a parallel bookkeeping convention
  for what is fundamentally "is `next_role` stale."
- As the coordinator running a healthy, fast-moving chain, I want the
  staleness check to never fire a false positive while a dispatched role is
  still actively working within a normal time window, so the signal stays
  trustworthy and isn't muted out of alert fatigue.

## Acceptance Criteria

**AC-1 — Dispatch stamp is persisted, not coordinator memory**
Given a `tw_update_state` write sets the first-class `next_role` field, when
the write lands, then the server (not the coordinator's own context) persists
a companion timestamp recording when that dispatch directive was written —
mirroring `next_role`'s own transient, write-scoped lifecycle. Exact field
name(s) pinned by the architect (AC-10).

**AC-2 — Staleness is surfaced on read, not enforced on write**
Given the persisted state carries a dispatch stamp whose age exceeds the
N-minute threshold, when any context calls `tw_get_state`, then the response
includes an explicit advisory signal (exact shape pinned by architect)
identifying the stale target role and elapsed time — this is informational
only; no `tw_update_state` write is rejected because of it (no new
`GateErrorCode`, unless the architect's design finds a concrete reason one is
needed).

**AC-3 — Stamp clears when the dispatched role writes back**
Given the dispatched role's own `tw_update_state` write lands (with or
without setting its own new `next_role`), when the write is persisted, then
the prior dispatch stamp is superseded (dropped if the new write sets no
`next_role`, replaced if it does) — the same overwrite semantics `next_role`
itself already has; no separate "acknowledge dispatch" call is required.

**AC-4 — Detection works from a completely fresh context**
Given a fresh coordinator session (new process, no transcript, no memory of
any prior dispatch) that has never seen this workspace before, when it calls
`tw_get_state` on a workspace with a stale dispatch stamp, then it receives
the same "stale in-flight dispatch" signal a continuing session would —
correct by construction, because the signal is derived entirely from
persisted state plus wall-clock time, never from in-context memory.

**AC-5 — No false positive within the threshold window**
Given a dispatch stamp younger than the N-minute threshold, when
`tw_get_state` is called, then no staleness signal is surfaced — a role that
is still legitimately working must not be flagged as dead.

**AC-6 — Feature-scoped: no stale-dispatch bleed across features**
Given `active_feature` changes on a `tw_update_state` write, when the server
persists the new tuple, then any prior dispatch stamp from the previous
feature is dropped — mirroring the `dispatch_pins`/`external_refs`
feature-scoped-reset precedent (drops on `active_feature` change).

**AC-7 — Crash-Resume Protocol references the new signal**
Given `content/skill-coordinator.md`'s Crash-Resume Protocol and Escalation
Routes table, when a fresh or continuing coordinator encounters a stale
dispatch stamp, then the skill prose explicitly directs it to run
Crash-Resume using the `tw_get_state`-surfaced signal as the trigger (in
addition to, not instead of, the existing same-session "tool-error/empty
reply" trigger) — exact prose location/wording pinned by architect (AC-10.5).

**AC-8 — Existing routing/round-cap/pin mechanisms unchanged**
Given this feature ships, when `next_role`, `hop_count`,
`qa_round`/`review_round`/`visual_round`, `dispatch_pins`, `cut_approved`, and
`external_refs` behavior is exercised, then all remain byte-identical to
pre-feature behavior — D5 adds a read-time advisory derived from existing
fields, it does not alter any existing field's write/gate semantics.

**AC-9 — SQLite/HTTP-mode scope is explicit, not silently dropped**
Given the architect pins `dispatched_at` as file-mode-only (PM
recommendation) or SQLite-inclusive, when either storage backend is
exercised, then the chosen scope is documented and tested — an unstated gap
(the feature silently doing nothing in SQLite mode with no test or doc note)
is not acceptable, even if file-mode-only is the correct call.

**AC-10 — Architecture decision recorded before build**
Given the open questions in the Architecture Decision Required section
above, when the architect produces
`specs/d5-server-side-stale-dispatch-detection-architecture.md`, then it
pins: exact field name(s), the N-minute threshold (value + fixed-constant vs.
config-driven), storage-mode scope (AC-9), `schema_version` impact (v9→v10
per `docs/schema-versions.md`), the exact `content/skill-coordinator.md`
prose edit (AC-7), and a file-by-file diff plan with no single sr-engineer
task exceeding the `task_size` budget (≤5 files/300 lines) — splitting the
draft task list below further if needed, preserving task ordering and
`depends_on` chains.

## Copy / Strings

This feature introduces one new advisory message surfaced via `tw_get_state`
JSON (not user-facing prose in the constitution/skill sense — it is a
tool-response field consumed by an agent, not a rendered UI string). The
backlog's own fix-direction quotes a candidate wording verbatim; treated as
`authored-here` pending the architect's exact field-shape decision (AC-10).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| stale_dispatch.message | `stale in-flight dispatch: {role}, no state write for >{n} min` | authored-here — verbatim from `docs/backlog.md` D5 fix-direction paragraph; architect may adjust interpolation shape, not the substance |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (server-internal, non-design) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **A new gate / `GateErrorCode`** — per the Architecture Decision Required
  section, this is a read-time advisory, not a write-time rejection. If the
  architect's design finds a concrete need for a blocking gate, that is a
  deviation to justify explicitly in the architecture doc, not a default.
- **Auto-recovery / auto-re-dispatch** — detecting staleness does not mean
  the server (or the coordinator) automatically re-dispatches the stale
  role. The existing Crash-Resume Protocol's human-in-the-loop-adjacent
  ground-truth steps (verify the tree, restate findings, re-assert pins)
  remain required; D5 only makes the TRIGGER visible without coordinator
  memory, it does not shortcut the PROCEDURE.
- **Detecting non-dispatch crashes** — a role invoked via `tw_switch_role`
  fallback (no `Task` tool, e.g. Cursor/Continue) that then hangs is out of
  scope for a NEW mechanism here only insofar as it already lacks a
  `next_role`-driven dispatch step to stamp; if `next_role` is set before
  that fallback path too (current skill prose treats both dispatch
  mechanisms uniformly under Auto-Routing), the same stamp/detection applies
  for free — no separate mechanism is being built for the fallback path.
- **Multi-dispatch / fan-out tracking** — the current protocol dispatches one
  role at a time; tracking multiple concurrent in-flight dispatches is not a
  scenario this ticket's single-tuple handoff model supports and is not
  being added here.
- **Retention/rotation of the new field** — a single scalar field on the
  existing handoff frontmatter has no retention concern (unlike D3's/D5's
  sibling append-only sidecar files); not applicable.
- **Any other open backlog ticket** (D4 shipped; D6, D7, D8 untouched).

## Dependencies / Prerequisites

### Resource Audit Gate (constitution §7)

Scanned `docs/backlog.md`'s D5 section (lines 819–831) and this spec's own
sources for `http(s)://`, `figma`, `sketch`, `mockup`, `URL`, `link`, `see
<ticket>`, `Azure DevOps`, `JIRA`. Result: **zero external references
found** — every pointer is an in-repo path (`content/skill-coordinator.md`,
`tools/handoff.ts`, `tools/handoff-orchestrator.ts`, `tools/transitions.ts`,
`gates/registry.ts`, `docs/schema-versions.md`, `tools/config.ts`). No
fetch/index/ignore classification needed; `external_refs` omitted from the
state write.

### Question Batch Gate

No clarifications accumulated requiring human input. The mechanism-shape
choices (exact field name, threshold value/source, storage-mode scope) are
implementation decisions explicitly delegated to the architect (mirroring
D2's identical delegation of its (a)/(b) choice) — not product ambiguities.
No `AskUserQuestion` batch was needed.

### Scope Decision Gate

Not armed — no `design/d5-server-side-stale-dispatch-detection.md` exists,
and this feature has no visual surface. Recorded here for the audit trail
(same precedent as `d2-server-brake-accounting.md`):
`scope_decision: single-feature` — one coherent mechanism (dispatch-liveness
stamp + read-time staleness surfacing + skill-prose update) spanning the
handoff schema, orchestrator, and coordinator skill; not split further
because the backlog itself scoped this as one ticket (D5) and the mechanism
is a single data flow (write-time stamp → read-time check → prose
consumption), not several independent concerns.

### Prerequisites shipped

- **D2** (server brake accounting, v3.68.0) ✓ — direct precedent for adding
  a new server-computed, persisted handoff field (`hop_count`, v8→v9) with
  its own schema bump, read-time exposure via `tw_get_state`, and a
  companion `docs/schema-versions.md` entry. D5 follows the identical
  authoring recipe (`docs/schema-versions.md` "Authoring a v(N)→v(N+1)
  migration" section) for its own field.
- **C9** (`next_role`/`resume_of`/`review_verdict` protocol fields, handoff
  schema v7) ✓ — D5's entire mechanism is a companion to the existing
  `next_role` field's transient lifecycle; the architect and implementers
  MUST read `tools/handoff.ts`'s `next_role` field comments and
  `writeHandoffState`'s v7 handling block (write-scoped, never preserved
  across omitting writes) as the load-bearing precedent for whatever
  `dispatched_at` companion field is added.
- **C14** (`dispatch_pins`, handoff schema v8) ✓ — precedent for a
  feature-scoped field with its own reset-on-`active_feature`-change rule
  (AC-6), if the architect's design needs that exact carry-forward
  algorithm rather than `next_role`'s stricter every-write-scoped one.
- **A10** (gate registry, v3.61.0-line) ✓ — `gates/registry.ts`'s
  `GateDefinition` shape is the precedent to consult ONLY IF the architect's
  design concludes a blocking gate IS needed (deviation from the PM's
  no-new-gate recommendation above) — kept in scope here so that decision,
  if made, has an existing pattern to reuse rather than inventing a fourth.
- **D3** (gate-fire telemetry, v3.66.0) ✓ — not a direct dependency (D5 adds
  no new telemetry event; it is a read-path advisory, not a gate rejection),
  but the architect should confirm this feature does NOT need a
  `.current/telemetry.jsonl` entry, since it never rejects a write.

### Task-granularity note for the architect

The task list below (`tw_add_task`) is a best-estimate split at PM time,
consistent with this workspace's preference for fine-grained tickets
(smaller rows have historically succeeded more autonomously). Per PM SOP
("one task = one sr-engineer session, ≤5 files/300 lines"), the architect
blueprint MUST further split any task below whose file-by-file diff plan
shows it exceeding that budget once the field name(s)/threshold/storage
scope are pinned — preserve task ordering and `depends_on` chains; do not
silently merge or drop tasks.

## Tasks

- [ ] T-D5-ARCH [P0] architect: produce
  `specs/d5-server-side-stale-dispatch-detection-architecture.md` — pin exact
  field name(s) (dispatch-stamp + reuse of `next_role`), the N-minute
  threshold (fixed constant vs. config-driven, exact value), storage-mode
  scope (file-mode-only vs. SQLite-inclusive, AC-9), whether any new
  `GateErrorCode` is genuinely needed (PM recommends none), the exact
  `schema_version` bump (v9→v10 per `docs/schema-versions.md`) and migration
  step, the exact `content/skill-coordinator.md` prose edit locations
  (Crash-Resume Protocol + Escalation Routes "Crash detection" row, AC-7),
  and a file-by-file diff plan sized to the `task_size` budget, splitting
  T-D5-01/02/03 below if needed. | depends_on: none
- [ ] T-D5-01 [P0] sr-engineer: implement the handoff schema field(s) —
  `tools/handoff.ts` (parse/write/comment per the `next_role` precedent),
  `schema/migrations-handoff.ts` (v9→v10 step), `schema/versions.ts` (bump
  `CURRENT_VERSIONS.handoff`), and `docs/schema-versions.md` (new version-
  history row) per the architect blueprint (AC-1, AC-3, AC-6, AC-10). |
  depends_on: T-D5-ARCH
- [ ] T-D5-02 [P0] sr-engineer: implement the orchestrator stamp-on-dispatch
  write (`tools/handoff-orchestrator.ts`) and the `tw_get_state` staleness
  surfacing (`tools/handoff.ts` `readHandoffState` or a new small helper) per
  the architect blueprint (AC-1, AC-2, AC-3, AC-4, AC-5, AC-9). | depends_on:
  T-D5-01
- [ ] T-D5-03 [P1] sr-engineer: update `content/skill-coordinator.md`'s
  Crash-Resume Protocol and Escalation Routes "Crash detection" row to
  reference the new `tw_get_state`-surfaced stale-dispatch signal as an
  additional trigger for a fresh/continuing session, per the architect
  blueprint (AC-7). | depends_on: T-D5-02
- [ ] T-D5-04 [P0] code-reviewer: review the diff — confirm the dispatch
  stamp is a genuine companion to `next_role`'s existing transient lifecycle
  with zero behavior change to `next_role`/`hop_count`/round-caps/
  `dispatch_pins`/`cut_approved`/`external_refs` (AC-8), confirm the
  staleness signal is read-only/advisory and never blocks a
  `tw_update_state` write unless the architect explicitly added a gate
  (confirm that decision was justified, not a default), confirm the
  storage-mode scope decision (AC-9) is implemented and documented as
  pinned, confirm feature-scoped reset (AC-6) holds. | depends_on: T-D5-03
- [ ] T-D5-05 [P0][qa-engineer] Add tests: dispatch stamp is set when
  `next_role` is written and cleared/replaced on the next write (AC-1, AC-3);
  a simulated crash/compaction (fresh read, no in-memory state, stamp older
  than threshold) surfaces the stale-dispatch signal (AC-2, AC-4); no signal
  fires within the threshold window (AC-5); stamp resets on `active_feature`
  change (AC-6); existing `next_role`/`hop_count`/round-cap/`dispatch_pins`
  tests remain green unmodified (AC-8); storage-mode scope behaves and is
  tested per the architect's pin (AC-9). Run full suite green. | depends_on:
  T-D5-04
- [ ] T-D5-REL [P1] release-engineer (post-PASS): version bump, CHANGELOG
  entry, build, tag, release per skill-release-engineer. | depends_on:
  T-D5-05
- [ ] T-D5-DONE [P2] pm/coordinator (post-release): mark backlog D5 done in
  `docs/backlog.md` with mechanism summary and commit reference. | depends_on:
  T-D5-REL
