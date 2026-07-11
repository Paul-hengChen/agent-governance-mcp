# Spec: d2-server-brake-accounting

## Problem Statement

The `/teamwork` coordinator runs two cost-side circuit breakers, and both are
"in-memory, model-maintained arithmetic" (`content/skill-coordinator.md`
§Auto-Routing, §Token Budget Brake): (1) the **hop counter** — the
coordinator increments an in-memory counter by 1 per successful dispatch and
compares it to the `hop` cap (10, `content/const-01-core-head.md` Limits);
and (2) the **token budget brake** (B9, v3.63.0) — the coordinator reads each
dispatch's `usage.*` fields from `agent-*.jsonl` and sums them by hand against
`tokenBudgetPerFeature` (`.current/.config.json`, opt-in). Both explicitly
declare "in-memory only ... Do NOT persist to `handoff.md`" as their scope
discipline. Context compaction or a coordinator crash silently resets both
counters to zero — the brakes exist specifically to catch long, expensive
sessions, and those are exactly the sessions correlated with compaction
(`docs/backlog.md` D2's own "risk if skipped" framing). Model arithmetic is
also inherently unreliable (miscounts, skipped increments) in a way a
persisted, server-checked field is not.

This is not a novel problem for this codebase: the three existing round caps
(`qa_round`, `review_round`, `visual_round`) already solved the identical
problem for QA/review/visual loop cycling — they are persisted `handoff.md`
fields, incremented deterministically by `tools/transitions.ts`'s
`computeRoundState`, and enforced server-side (`QA_ROUND_EXCEEDED`,
`REVIEW_ROUND_EXCEEDED`, `VISUAL_ROUND_EXCEEDED` gates in
`validateTransition`, `tools/transitions.ts:315-349`). The hop counter is the
one remaining cost-side cap that never got this treatment. C9/C14 already
proved the general pattern (prose-token bookkeeping → validated first-class
mechanism) for other coordinator conventions; this ticket applies it here.

D3 (gate-fire telemetry, shipped v3.66.0) is a direct prerequisite and
precedent: it added the one append-only sidecar file
(`.current/telemetry.jsonl`, via `tools/telemetry.ts`'s
`emitGateTelemetry`) and explicitly reserved its own module boundary as "the
extension point for D2's future hop/token fields" (`tools/telemetry.ts`
header comment, AC-9 of its spec). This feature is that promised consumer.

## Architecture Decision Required — deferred to architect

The backlog (`docs/backlog.md` D2) frames the fix as a straight (a)/(b)
choice and explicitly says "decide (a)/(b) at architecture time." Per PM's
own reading of the two breakers' underlying data, the choice is not
symmetric across them — flagging this asymmetry for the architect rather
than pre-deciding it:

- **The hop counter is a pure `handoff.md`/orchestrator concern.** Every
  role-transition write already lands in
  `tools/handoff-orchestrator.ts`'s `handleUpdateState`, and
  `tools/transitions.ts` already computes and enforces three sibling
  round-cap fields the identical way option (a) describes: "a per-feature
  counter field stamped on each role-transition write, checked server-side
  against the cap." The server already has full visibility into every hop —
  no new data source is needed.
- **The token budget brake is NOT something the MCP server can see at all.**
  `usage.*` token counts are a Claude-Code-host concept, visible only in
  `agent-*.jsonl` dispatch logs the coordinator reads after each `Task(...)`
  call. `tools/handoff-orchestrator.ts` never receives token usage as a tool
  argument today, and inventing one would mean the coordinator still has to
  report it by hand (the same "model-maintained arithmetic" failure mode,
  just relocated) — UNLESS a **PostToolUse hook on `Task`** (option (b))
  appends usage to a `.current/` side file out-of-band, independent of
  coordinator memory, which the coordinator then reads instead of summing.

**PM recommendation (non-binding):** a **hybrid**, not a single uniform
choice — (a) for the hop counter (reuse the existing round-cap
schema-field + `tools/transitions.ts`-check pattern verbatim; a new
`HOP_CAP_EXCEEDED`-shaped gate is the natural sibling of
`QA_ROUND_EXCEEDED`/`REVIEW_ROUND_EXCEEDED`/`VISUAL_ROUND_EXCEEDED`), and (b)
for the token budget brake (a PostToolUse hook — net-new pattern for this
repo; the only existing hook is the SessionStart hook,
`bin/agent-governance-context.mjs` — appending `{ts, feature, dispatch,
usage}` lines to a durable sidecar the coordinator reads, replacing hand-summing
without requiring the MCP server to gain token-usage visibility it
structurally cannot have). The architect makes the final call in
`specs/d2-server-brake-accounting-architecture.md`, including whether the
sidecar shares a file/shape with D3's `telemetry.jsonl` or uses a separate
file (AC-6 requires the two streams stay distinguishable either way), the
exact new field/gate-error-code names, `schema_version` impact (precedent:
`dispatch_pins` bumped handoff to v8; `tokenBudgetPerFeature` needed NO
config schema bump — this ticket likely needs a handoff bump for the hop
field and, if a hook script is chosen, a settings.json wiring note but no
schema bump for the sidecar itself), and a file-by-file diff plan sized so no
single sr-engineer task exceeds the `task_size` budget (≤5 files/300 lines).

## User Stories

- As the coordinator running a long or multi-session `/teamwork` feature, I
  want the hop cap enforced from a value the server itself tracks, so that a
  context compaction or crash mid-chain cannot silently reset the counter to
  zero and let routing exceed the cap unnoticed.
- As the coordinator with `tokenBudgetPerFeature` configured, I want the
  running token total to come from a durable, out-of-band record instead of
  my own hand-summed arithmetic, so that a compaction (which is itself
  correlated with high spend, per the brake's original motivation) cannot
  erase the very total the brake exists to catch.
- As a maintainer, I want the hop-counter mechanism to reuse the existing
  `qa_round`/`review_round`/`visual_round` pattern rather than invent a
  fourth parallel bookkeeping mechanism, so the codebase doesn't grow a new
  one-off convention for what is structurally the same problem.
- As D3's future consumer (named explicitly in its own spec, AC-9), I want
  this feature to reuse D3's sidecar module boundary where it fits, so the
  server doesn't end up with two independent, differently-shaped append-only
  telemetry files for adjacent concerns.

## Acceptance Criteria

**AC-1 — Hop count is a persisted, server-computed field, not coordinator arithmetic**
Given a `/teamwork` session performs role-transition `tw_update_state`
writes for the current `active_feature`, when each transition lands, then
the server (not the coordinator's own memory) computes and persists the
count of transitions so far for this feature — mirroring
`computeRoundState`'s existing `qa_round`/`review_round`/`visual_round`
computation in `tools/transitions.ts`. Exact field name and increment rule
(which `(agent, status)` transitions count as a "hop") are pinned by the
architect.

**AC-2 — Hop cap is enforced server-side**
Given the persisted hop count reaches or exceeds the `hop` cap (10), when
the next role-transition `tw_update_state` write is attempted, then the
server rejects it with a new gate error code (sibling to
`QA_ROUND_EXCEEDED`/`REVIEW_ROUND_EXCEEDED`/`VISUAL_ROUND_EXCEEDED`; exact
name pinned by architect) — the same enforcement mechanism as the three
existing round caps, not an advisory-only coordinator SOP note.

**AC-3 — Hop count resets per feature**
Given `active_feature` changes on a `tw_update_state` write, when the
server computes the hop count, then it resets to reflect only transitions
recorded since the current `active_feature` began — the same
feature-scoped-reset precedent already governing `dispatch_pins` and
`external_refs` ("drops when `active_feature` changes").

**AC-4 — Hop count survives coordinator crash/compaction**
Given a coordinator crashes or its context compacts mid-chain, when a fresh
coordinator instance (or the same one, post-compaction) calls
`tw_get_state`, then the returned hop count reflects every transition
actually persisted so far — correct by construction, because it was never
held only in the crashed/compacted context.

**AC-5 — Token usage accounting is durable, not hand-summed**
Given `tokenBudgetPerFeature` is set (opt-in, per B9), when a `Task`
dispatch completes, then that dispatch's `usage.*` totals are recorded to a
durable, out-of-band store (mechanism — hook-appended sidecar file vs. other
— pinned by architect) without requiring the coordinator to read and sum
`agent-*.jsonl` by hand.

**AC-6 — Token budget brake reads the durable record**
Given the durable record's summed `usage.*` total for the current
`active_feature` reaches ≥80% of `tokenBudgetPerFeature`, when the
coordinator is about to auto-hop, then it halts to the human per the
existing Token Budget Brake Escalation Routes row — same halt semantics and
80% threshold as today (B9 AC-3), only the source of the running total
changes from mental arithmetic to a file/field read.

**AC-7 — No duplicate or conflated telemetry streams**
Given D3 already ships `.current/telemetry.jsonl` (gate-rejection events:
`{ts, gate, error_code, agent_id, feature}`), when this feature adds its own
durable record(s) for hop count and/or token usage, then the two concerns
remain distinguishable per line/record — either a distinct file, or an
additive field set on the same event shape with a discriminator — architect's
call, but a reader must be able to tell a gate-rejection line from a
dispatch-accounting line without ambiguity.

**AC-8 — Existing round caps unchanged**
Given this feature ships, when `qa_round`/`review_round`/`visual_round`
enforcement is exercised, then their existing behavior, field names, and gate
error codes are byte-identical to pre-feature behavior — this ticket adds a
sibling mechanism, it does not touch the three existing ones.

**AC-9 — Token budget brake stays opt-in; absence = no behavior change**
Given `.current/.config.json` has no `tokenBudgetPerFeature` key (or the
file doesn't exist), when a `/teamwork*` session runs, then no token-usage
accounting or check occurs — regression guard carried forward from B9
AC-1/AC-6, unchanged by relocating the running total off model arithmetic.

**AC-10 — Architecture decision recorded before build**
Given the (a)/(b) choice per breaker described above, when the architect
produces `specs/d2-server-brake-accounting-architecture.md`, then it pins:
the mechanism per breaker (with justification for any deviation from the PM
recommendation), the exact new field name(s) and/or gate error code(s),
`schema_version` impact for each of the four persisted artifacts
(`handoff.md`, `tasks.md`, SQLite, `.config.json`), whether/how the sidecar
relates to D3's `telemetry.jsonl` (AC-7), and a file-by-file diff plan with
no single sr-engineer task exceeding the `task_size` budget (≤5 files/300
lines) — splitting the draft task list below further if needed, preserving
task ordering and `depends_on` chains.

## Copy / Strings

This feature introduces no new user-facing copy beyond one halt-message
string, already authored by B9 and unchanged here (`content/skill-
coordinator.md` §Escalation Routes token-budget row: `token budget:
{running_total} / {tokenBudgetPerFeature} ({pct}%) — handing to human`).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | no new copy; existing B9 halt-message string is reused verbatim, not modified |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (server-internal, non-design) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **Dollar-cost conversion** (token → currency) — already deferred by B9;
  not reopened here.
- **Per-feature `tokenBudgetPerFeature` override maps** — already deferred by
  B9; not reopened here.
- **Cross-`/teamwork`-invocation accumulation** — whether the hop count or
  token total should persist across separate coordinator *invocations* of
  the same feature (vs. just surviving crash/compaction *within* one
  invocation) is an architect decision (AC-10); if deferred, it is an
  explicit, documented limitation, not silently dropped.
- **Rewriting `qa_round`/`review_round`/`visual_round`** — AC-8 requires
  these stay byte-identical; this ticket only adds a sibling mechanism.
- **Retention/rotation of any new sidecar file** — mirrors D3's own deferred
  retention gap (backlog D7); not solved here.
- **A dashboard or reporting tool** for the new record(s) — same MVP-scope
  limit D3 applied to `telemetry.jsonl` (AC-8's retro procedure is
  grep/group-by, not a built tool); no new tool here either.
- **Any other open backlog ticket** (C-series already shipped; D1, D3
  shipped; D4–D8 untouched).

## Dependencies / Prerequisites

### Resource Audit Gate (constitution §7)

Scanned `docs/backlog.md`'s D2 section (lines 764–780) and this spec's own
sources for `http(s)://`, `figma`, `sketch`, `mockup`, `URL`, `link`, `see
<ticket>`, `Azure DevOps`, `JIRA`. Result: **zero external references
found** — every pointer is an in-repo path (`tools/transitions.ts`,
`tools/handoff-orchestrator.ts`, `tools/telemetry.ts`,
`content/skill-coordinator.md`, `.current/.config.json`). No fetch/index/
ignore classification needed; `external_refs` omitted from the state write.

### Question Batch Gate

No clarifications accumulated. The (a)/(b) mechanism choice is explicitly
delegated to the architect by the backlog itself ("decide (a)/(b) at
architecture time") and by this dispatch's own assignment — it is an
implementation decision, not a product ambiguity requiring human input, so
no `AskUserQuestion` batch was needed.

### Scope Decision Gate

Not armed — no `design/d2-server-brake-accounting.md` exists, and this
feature has no visual surface. Recorded here for the audit trail (same
precedent as `b9-token-budget-brake.md` and `gate-registry.md`):
`scope_decision: single-feature` — one coherent mechanism (hop counter +
token accounting) spanning the orchestrator, transitions, coordinator skill,
and config; not split into separate features because both breakers share
the same "model arithmetic → durable accounting" root cause and both were
scoped as one ticket (D2) by the backlog itself.

### Prerequisites shipped

- **D3** (gate-fire telemetry, v3.66.0) ✓ — `tools/telemetry.ts`'s
  `emitGateTelemetry`/`TelemetryEvent` module boundary was explicitly reserved
  as this feature's extension point (D3 spec AC-9). This feature is the
  named consumer; do not build a second, unrelated sidecar mechanism without
  first checking whether extending `tools/telemetry.ts` satisfies AC-7.
- **B9** (token budget brake, v3.63.0) ✓ — the 80% threshold, opt-in
  `tokenBudgetPerFeature` config field, and the Token Budget Brake Escalation
  Routes row already exist; this feature relocates the running-total source,
  it does not change the threshold, the config key, or the opt-in default
  (AC-6/AC-9).
- **C14** (`dispatch_pins` first-class field, v3.56.0) ✓ — direct precedent
  for adding a new first-class, feature-scoped `handoff.md` field
  (schema bump v7→v8) if the architect's hop-counter design needs one.
- **A10** (gate registry, v3.61.0-line) ✓ — `gates/registry.ts`'s
  `GateDefinition` shape is the precedent for adding a new gate error code
  (e.g. a `HOP_CAP_EXCEEDED`-shaped entry) if the architect's design adds
  one, keeping error code / hint text sourced from the shared registry
  rather than a fourth hand-authored copy.

### Existing round-cap pattern (verified by inspection, `tools/transitions.ts`)

`computeRoundState` (lines ~398–435) computes `qa_round`/`review_round`/
`visual_round` deterministically from the previous persisted value plus the
new `(agent, status)` transition; `validateTransition` (lines ~315–349)
rejects the write with `QA_ROUND_EXCEEDED`/`REVIEW_ROUND_EXCEEDED`/
`VISUAL_ROUND_EXCEEDED` once the persisted value reaches its cap. This is
the exact shape option (a) proposes for the hop counter — the architect
should treat it as the load-bearing precedent, not a fresh design.

### Task-granularity note for the architect

The task list below (`tw_add_task`) is a best-estimate split at PM time,
consistent with this workspace's preference for fine-grained tickets. Per
PM SOP ("one task = one sr-engineer session, ≤5 files/300 lines"), the
architect blueprint MUST further split any task below whose file-by-file
diff plan shows it exceeding that budget once the (a)/(b) mechanism is
pinned — preserve task ordering and `depends_on` chains; do not silently
merge or drop tasks.

## Tasks

- [ ] T-D2-ARCH [P0] architect: produce
  `specs/d2-server-brake-accounting-architecture.md` — decide the
  hop-counter mechanism and the token-usage mechanism (Architecture Decision
  Required section above; PM recommendation is non-binding), pin exact new
  field name(s)/gate error code(s), `schema_version` impact across the four
  persisted artifacts, resolve AC-7 against D3's `telemetry.jsonl`, and
  produce a file-by-file diff plan sized to the `task_size` budget,
  splitting T-D2-01/02/03 below if needed. | depends_on: none
- [ ] T-D2-01 [P0] sr-engineer: implement the server-side, persisted hop
  count + server-enforced `hop` cap gate (mirrors
  `qa_round`/`review_round`/`visual_round` in `tools/transitions.ts`) per
  the architect blueprint (AC-1, AC-2, AC-3, AC-4, AC-8). | depends_on:
  T-D2-ARCH
- [ ] T-D2-02 [P0] sr-engineer: implement the durable token-usage accounting
  mechanism (hook-appended sidecar or other, per architect blueprint),
  reusing/extending `tools/telemetry.ts`'s module boundary where AC-7
  permits (AC-5, AC-6, AC-7, AC-9). | depends_on: T-D2-01
- [ ] T-D2-03 [P1] sr-engineer: update `content/skill-coordinator.md`
  §Auto-Routing (hop counter) and §Token Budget Brake to read the new
  server/file-backed sources instead of model-summed arithmetic; update
  `.current/.config.json` inline docs/comments (`tools/config.ts` header)
  and any settings.json hook-wiring note the architect's design requires.
  | depends_on: T-D2-02
- [ ] T-D2-04 [P0] code-reviewer: review the diff — confirm the hop-cap
  gate is a genuine sibling of the three existing round caps with zero
  behavior change to them (AC-8), confirm the token-usage record is durable
  and never masks/blocks the coordinator on a write failure (same
  best-effort-append discipline D3 established for `telemetry.jsonl`),
  confirm AC-7's stream-distinguishability holds, confirm the brake stays
  opt-in with zero-config behavior unchanged (AC-9). | depends_on: T-D2-03
- [ ] T-D2-05 [P0][qa-engineer] Add tests: hop-cap gate fires at the cap and
  resets on `active_feature` change (AC-2, AC-3); a simulated
  crash/compaction (fresh read with no in-memory state) reconstructs the
  correct hop count and token total from disk (AC-4, AC-5); token brake
  absence-of-config regression (AC-9); existing round-cap tests remain green
  unmodified (AC-8). Run full suite green. | depends_on: T-D2-04
- [ ] T-D2-REL [P1] release-engineer (post-PASS): version bump, CHANGELOG
  entry, build, tag, release per skill-release-engineer. | depends_on:
  T-D2-05
- [ ] T-D2-DONE [P2] pm/coordinator (post-release): mark backlog D2 done in
  `docs/backlog.md` with mechanism summary and commit reference.
  | depends_on: T-D2-REL
