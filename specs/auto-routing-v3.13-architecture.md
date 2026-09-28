# Architecture: auto-routing-v3.13

## Affected Files

| File | Change kind | Owned by | Lines (est.) |
|---|---|---|---|
| `content/skill-coordinator.md` | EDIT — insert new `## Auto-Routing` H2 between existing `## Design-source detection` and `## SOP`; extend SOP step 1 to check `AGC_AUTO_ROUTE` env var | T87 | +18 |
| `content/skill-pm.md` | EDIT — insert new SOP step **Question Batch Gate** that batches the existing Resource Audit Gate (step 3) + Ambiguity Gate (step 4) questions into one upfront `AskUserQuestion` call; preserve the substantive rules of both existing gates as referenced behaviour | T88 | +5 |
| `content/skill-coordinator-lite.md` | EDIT — append the one-line `Auto-routing is NOT applied in lite mode.` disclaimer to the existing **Hard rules** block | T89 | +1 |
| `content/constitution.md` | EDIT — append the one-line auto-routing hop-cap pointer bullet to §5 Anti-Loop Circuit Breaker | T90 | +1 |
| `specs/auto-routing-v3.13-architecture.md` | CREATE (this file) | architect | — |

**No production-code (`.ts`) changes.** `prompts/build.ts` concatenates `content/*.md` verbatim; section additions/edits within those files cannot break the prompt-build path. The env-var check is performed agent-side via the existing Bash tool (`echo $AGC_AUTO_ROUTE` or `printenv`) — no server-side env-var plumbing required.

## Data Structures

### Auto-Routing state (agent-side, in-memory)

No persisted data structure. The coordinator agent holds two pieces of state in working memory for the duration of a `/teamwork` session:

```text
hop_count : integer    # increments by 1 after each successful tw_switch_role
auto_mode : boolean    # true unless AGC_AUTO_ROUTE=0 at session start
```

Both are scoped to the current model-side conversation; they reset when the user starts a new `/teamwork` session. Neither is written to `handoff.md`, the SQLite DB, or any tool argument — the spec's Out of Scope section explicitly rules out persisted hop counters.

### Stop-condition predicate (agent-side, evaluated after each role hop)

```text
should_stop(state, hop_count) ==
    state.status == "Blocked"
    OR state.status == "PASS"
    OR "next_role: human" in state.pending_notes
    OR (no line starting with "next_role:" exists in state.pending_notes)
    OR hop_count >= 10
```

The five conditions are OR'd; any one triggers an immediate yield to the human. The agent surfaces the stop reason in chat (one short sentence) before pausing.

### Question Batch (PM stage, in-memory)

Per PM session:

```text
pending_questions : list of (question_text, options_or_freeform, header)
```

Accumulated while PM walks the existing Resource Audit Gate + Ambiguity Gate substantive rules. Emitted as exactly one `AskUserQuestion` call (or two, if > 4 questions accumulated — `AskUserQuestion` caps at 4 questions per call). If the list is empty after both gates run, no `AskUserQuestion` call is made.

## Interface Contracts

### Coordinator SOP extension (T87) — `content/skill-coordinator.md`

**New section** (insert between line ~50 `## Design-source detection` end and line ~52 `## SOP`):

```markdown
## Auto-Routing

Default-ON in `/teamwork` (this skill). Disabled in `/teamwork-lite` (different skill).

After each role's handoff, read the just-written `pending_notes`. If a `next_role: <name>` line is present and none of the stop conditions below fire, immediately call `tw_switch_role(<next_role>)` and follow the returned SOP. Increment your in-memory hop counter by 1 per successful switch.

**Stop conditions** (any one yields to the human — surface the reason in one sentence):
1. `status: Blocked` on the last `tw_update_state`.
2. `status: PASS` on the last `tw_update_state` (terminal success; release-engineer is a deliberate human decision, not an auto-hop).
3. `pending_notes` contains a line beginning with `next_role: human`.
4. `pending_notes` contains NO line beginning with `next_role:` (the prior role forgot or finished without nominating a successor — surface as ambiguous).
5. Hop counter ≥ `10` for this `/teamwork` session.

**Opt-out**: if `AGC_AUTO_ROUTE=0` at session start, do NOT auto-hop. Honour the pre-v3.13 manual-routing behaviour: surface the next_role recommendation in chat and wait for the human to issue `tw_switch_role` themselves.

**Hop counter scope**: in-memory only, for the lifetime of one `/teamwork` invocation. Do NOT persist to `handoff.md` or any tool argument.
```

**SOP step 1 modification** (insert a substep before "Skip state sync for..."):

```markdown
1a. **Auto-routing pre-check**: run `printenv AGC_AUTO_ROUTE` (or read your shell environment). If the value is exactly `0`, set your auto_mode to off for this session — all subsequent SOP behaviour is identical, except step 4 yields to the human instead of auto-hopping. If the env var is unset or any other value, auto_mode is on (default).
```

### PM Question Batch Gate (T88) — `content/skill-pm.md`

**New SOP step** (insert between current step 3 *Resource Audit Gate* and step 4 *Ambiguity Gate* — renumbering: existing step 4 becomes step 5, step 5 becomes step 6, etc.):

```markdown
4. **Question Batch Gate**: before writing the spec, consolidate every human-input request into a single upfront `AskUserQuestion` call. Walk steps 2-3's substantive rules and the would-be Ambiguity Gate triggers; for each clarification you would have asked mid-flow, append it to a question list. Emit ONE `AskUserQuestion` call covering all (`AskUserQuestion` allows up to 4 questions per call — split into two batches if needed). If zero clarifications accumulate, this gate is a no-op. Recording the answers inline in the spec's **Dependencies / Prerequisites** section satisfies the Resource Audit Gate's record-keeping requirement; mid-flow asks are then redundant.

   Reason: each mid-flow `Blocked` round-trip costs a context-switch for the human. Batching upfront converts N round-trips into 1 and lets the auto-routing chain (skill-coordinator §Auto-Routing) run uninterrupted from PM onward.
```

Steps 5-8 are the existing steps 4-7 renumbered. The substantive rules of Resource Audit Gate (step 3) and Ambiguity Gate (now step 5) remain unchanged — Question Batch Gate is the *delivery mechanism*, not a replacement.

### Lite disclaimer (T89) — `content/skill-coordinator-lite.md`

Append to the existing **Hard rules** block (after the "No code-reviewer step" bullet):

```markdown
- **No auto-routing.** Auto-routing is NOT applied in lite mode. Lite is single-shot; the auto-hop loop lives in `/teamwork` only.
```

### Constitution §5 pointer (T90) — `content/constitution.md`

Append to §5 *Anti-Loop Circuit Breaker* bullet list (after the "Escalation" bullet):

```markdown
- **Auto-routing hop cap**: per `/teamwork` session, max 10 role transitions. See `skill-coordinator` §Auto-Routing for the full stop-condition list. Lite mode is exempt (no auto-routing).
```

### Build & test gate (T91)

```bash
npm run build   # MUST exit 0 with zero TS errors
npm test        # MUST pass all 303 existing tests
```

Same content-only gate as v3.12 (T85). No server-code change; build verifies the surrounding TS layer is unaffected by Markdown edits.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant H as Human
    participant C as Coordinator (auto_mode=on)
    participant PM as PM (Question Batch Gate)
    participant A as Architect
    participant SR as Sr-engineer
    participant CR as Code-reviewer
    participant QA as QA-engineer

    H->>C: /teamwork <request>
    C->>C: SOP 1a — check AGC_AUTO_ROUTE; auto_mode=on
    C->>C: Scope Gate → multi-phase
    C->>PM: tw_switch_role(pm) [hop=1]
    PM->>PM: Resource Audit + Ambiguity scan
    PM->>H: AskUserQuestion (batched, ≤4 questions)
    H-->>PM: all answers
    PM->>PM: write spec + tasks
    PM->>A: tw_update_state(next_role: architect)
    C->>C: read pending_notes → no stop condition
    C->>A: tw_switch_role(architect) [hop=2]
    A->>SR: tw_update_state(next_role: sr-engineer)
    C->>SR: tw_switch_role [hop=3]
    SR->>CR: tw_update_state(next_role: code-reviewer)
    C->>CR: tw_switch_role [hop=4]
    CR->>QA: tw_update_state(review: APPROVED, next_role: qa-engineer)
    C->>QA: tw_switch_role [hop=5]
    QA->>QA: PASS
    QA-->>C: tw_update_state(status=PASS)
    C->>C: stop condition #2 (PASS) → YIELD
    C->>H: "v3.13 PASS. Hand off to release-engineer?"
```

The diagram shows the happy path: 5 hops, no Blocked, no human intervention between hops 1 and 5. PM is the only human-touch checkpoint (Question Batch). Edge cases:

- A review_round FAIL would re-route CR → SR (hop 6); a second FAIL → SR (hop 7); a third FAIL → PM (hop 8) per existing transition matrix. Still well under the 10-hop cap.
- A QA FAIL behaves symmetrically: QA → SR (hop 6) → QA (hop 7) → SR (hop 8) → QA (hop 9) → PM at Round 4 (hop 10) → cap trips, yield. The human sees the chain exactly when the existing circuit breakers fire.

## Deferred Resources

_Empty — the spec's *Dependencies / Prerequisites* section has zero external references. All four design parameters were resolved by the coordinator's upfront `AskUserQuestion` batch before this architect stage began._

## Open Questions

_None._ The four design parameters (default-ON, hop cap = 10, agent-side in-memory counter, PM Question Batch included this release) were all confirmed by the user upfront, and the architecture encodes them as concrete strings/numbers without ambiguity.

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Where to place the Auto-Routing instructions: new file, append to existing SOP, or new H2 section in skill-coordinator.md | New H2 section between Design-source detection and SOP | Keeps related routing logic in one file; readers see the full coordinator behaviour without jumping; SOP step 1a adds the env-var check inline. Rejected alternative: new `content/skill-auto-routing.md` — fragmenting an already-cohesive skill costs more in prompt-build orchestration than it saves in modularity. |
| Hop counter: agent-side in-memory vs persisted handoff field | Agent-side in-memory (per user's upfront decision) | Zero server change, ships in this content-only release. Trade-off: cross-session hop limit cannot be enforced (a user manually restarting `/teamwork` resets the counter) — acceptable because the user is in the loop at session boundaries by definition. |
| PM Question Batch Gate placement: replace existing gates vs new step | New step that *batches* existing gates' asks; existing substantive rules preserved | Backwards-compatible: any PM still reading the old steps 3-4 still does the right substantive work. Adds one step of indirection vs a clean rewrite, but the audit trail (Resource Audit Gate's record-keeping mandate) is unchanged. |
| Stop condition #4 (no `next_role:` line) | Treat as stop, not as auto-continue with default | Forces every role to be explicit about the next hop; surfaces silent terminations (e.g. a role that finished without nominating successor) as ambiguous rather than as success. Cost: a single forgotten `next_role:` line yields to human — acceptable. |
| Lite mode exemption | Hard-coded in skill-coordinator-lite.md's Hard rules; constitution §5 pointer also names lite as exempt | Two-place authoritative statement prevents drift if either file is edited in isolation. Cost: one extra line of duplication, justified by safety. |
