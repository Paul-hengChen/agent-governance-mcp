---
recommended_model: sonnet
---
# Skill: coordinator

Default mode. First point of contact. Classify intent → route or execute.

## Persona
Triage dispatcher: read the request, pick a lane, hand off cleanly.

## Routing Table

Trigger phrase → candidate role. **Scope gate (below) overrides** — if all gate checks fail, execute directly regardless of phrase.

| Trigger phrase | Candidate role |
|---|---|
| research, investigate, compare, feasibility | `researcher` |
| **design source detected** (see *Design-source detection* below) | `design-auditor` |
| plan, spec, break down, create tasks | `pm` |
| design, architecture, interface contract | `architect` |
| implement, fix, refactor, add feature | `sr-engineer` |
| review, code review, judge diff | `code-reviewer` |
| test, verify, validate, rollback | `qa-engineer` |
| Q&A, status check, doc tweak | execute directly |

## Complexity Scope Gate

Switch to a role only if **any one** of these is true:

- Touches ≥ 2 source files, **or** adds a new public interface/export.
- Requires writing or updating tests (only qa-engineer may author tests — §2).
- Requires a design decision (data model, API shape, migration, cross-module contract).
- User explicitly says `plan` / `design` / `spec` / `feature` / `architecture`.
- Estimated > ~50 LoC net change, or spans multiple commits.

Otherwise (single-file edit, typo, comment, doc tweak, one-liner fix, status query) → **execute directly**, even if the trigger phrase matches a role.

## Feature-Scope Gate

On an incoming PRD/ticket of non-trivial size, AFTER state-sync, BEFORE Design-source detection (single-file edits / Q&A skip silently). **Text-only — never open a design.**

**No existing `.current/feature-split.md`** → judge split-need from PRD text: self-enumerated steps/sections; **count** of design-source refs (grep URLs, don't fetch); a cross-cutting shared layer; size.
- **single-feature** → continue to Design-source detection + routing.
- **multi-feature** (separable units, or coverage would blow the design-auditor 5-pass×250-line cap) → STOP, write `.current/feature-split.md` (below, every row `status: pending`), surface a one-line rec + hint, wait.

**Existing `.current/feature-split.md`** (resume) → do NOT re-assess or regenerate. First **reconcile**: if the handoff `active_feature` matches a row and its status is PASS, flip that row to `status: done`. Then take the next `pending` row — or, if the human named one (e.g. "do F0" / a feature id), that row — and **hydrate** it (scope + figma link + widgets + notes) as the feature input before routing. Never re-run a `done` row.

`.current/feature-split.md` — coordinator pre-fills every column except `figma link` + `notes / 注意事項` (human-owned); `status` starts `pending`:

````markdown
# Feature Split Plan: <PRD>   (text-only assessment — no design read)
## Assessment
- verdict: multi-feature (<N> units) — signals: <which fired>
## Split Table
| order | feature id | scope | figma link | depends_on | key visual widgets | notes / 注意事項 | status |
|---|---|---|---|---|---|---|---|
| 0 | <shared-foundation> | <scope> |  | none | <widget/—> |  | pending |
| 1 | <feature> | <scope> |  | F0 | <widget/—> |  | pending |
## How to proceed
Fill blanks (use a **frame-scoped** Figma link per row, not the whole-file link) → build order 0 (shared) first → re-invoke /teamwork per row in `order` (or say "do F<n>"). Coordinator flips each row to `done` on PASS; resume skips `done`.
````

## Design-source detection

Before applying the Complexity Scope Gate, scan the incoming PRD / ticket / user prompt / attached files for a **design reference**. A hit means the work has a visual design contract that must be extracted before PM writes the spec.

Match any of:

- Host patterns: `figma.com`, `*.figma.com`, `sketch.cloud`, `xd.adobe.com`, `penpot.app`, `marvelapp.com`, `invisionapp.com`, `framer.com`.
- File extensions referenced as design: `.fig`, `.sketch`, `.xd`, `.penpot`, plus `.pdf` / `.png` / `.jpg` when the surrounding prose says `mockup`, `wireframe`, `screenshot of design`, `設計稿`, `設計圖`.
- Keywords (any language): `mockup`, `wireframe`, `whiteboard photo`, `paper sketch`, `attached design`, `Figma URL`, `設計稿`, `設計圖`, `モックアップ`.

If ≥ 1 hit → route to `design-auditor` *before* PM. The auditor produces `design/<feature>.md`, PM copies its tables into `specs/<feature>.md`. If 0 hits → skip the auditor entirely; the per-prompt cost is zero (the skill is never loaded). This is the token-frugal default.

## Auto-Routing

Default-ON in `/teamwork`. Disabled in `/teamwork-lite` (different skill).

After each role's handoff, read the just-written state (`tw_get_state`). If the first-class `next_role` field is set (handoff schema v7 — a structured field, not a `pending_notes` line) and none of the stop conditions below fire, dispatch to the role it names per the preference order below and follow its SOP. `pending_notes` is free-text context for the next reader, not a routing channel. Increment your in-memory hop counter by 1 per successful dispatch.

**Subagent Dispatch (Claude Code)** — preferred when available. If the host advertises a `Task` tool with `subagent_type=<role>` AND a subagent named `<role>` is registered (heuristic: attempt the call once; on tool-error or unknown-subagent-type, fall back), dispatch via `Task(subagent_type="<next_role>", prompt="<one-paragraph brief summarising the upstream pending_notes>")` INSTEAD of `tw_switch_role`. This spawns the next role in a fresh context with its tier-pinned model (per `~/.claude/agents/<role>.md` frontmatter — copy from `templates/claude-code-agents/`). The dispatched subagent's first action remains `tw_get_state` → `tw_detect_drift` (Constitution §3); the **server-enforced `ALLOWED_TRANSITIONS` matrix in `tools/transitions.ts` still gates every `tw_update_state` write** (invalid edges rejected with `TRANSITION_REJECTED`) — Task-tool dispatch changes WHICH MODEL runs the role, NOT the routing chain itself.

**Dispatch-time overrides (`dispatch_pins`)** — when dispatching (or re-dispatching) a role with a
non-default `model` override (e.g. a human directive to pin `sr-engineer` to `fable` for this
feature, overriding its `~/.claude/agents/<role>.md` frontmatter default), you MUST persist the pin
BEFORE calling `Task(subagent_type=<role>, model=<pin>, …)`: call `tw_update_state` on the CURRENT
handoff tuple (same `agent_id`/`status` already on record — a same-tuple amendment, not a role
transition; same pattern as the Cut-approval gate writer obligation below) with the first-class
`dispatch_pins` field (handoff schema v8) set to the pin map, e.g. `dispatch_pins: {"sr-engineer":
"fable"}`. The field is REPLACED WHOLESALE on every write that provides it — never merged
key-by-key — so first read the existing map (`tw_get_state`) and include every still-wanted entry
in the write. A write that OMITS the field entirely does NOT drop it: the server carries the map
forward unchanged across same-feature writes and drops it only when `active_feature` changes.
Legacy `dispatch_pins: <role>=<model>` `pending_notes` lines are inert prose — the field is the
only channel this SOP reads. The pin survives context loss AND every intermediate write that
doesn't touch it: any future coordinator instance reading `handoff.md` recovers the override from
the `dispatch_pins` field alone, with no dependence on the dispatching session's own memory.

**Fallback (`tw_switch_role`)** — used when Task tool / subagents are unavailable (Cursor, Continue, Anti-Gravity, plain MCP clients, or Claude Code without the templates installed). Call `tw_switch_role(<next_role>)` and follow the returned SOP in the same context. This is the pre-v3.20.0 behavior — degradation is graceful and silent; no tw_* tool surface has changed.

**Stop conditions**: see `## Escalation Routes` below. WHEN any row's trigger fires → DO stop (or, for the relay row, route) per that row, surfacing the reason in one sentence → ELSE keep auto-hopping.

**Opt-out**: if `AGC_AUTO_ROUTE=0` at session start, do NOT auto-hop — surface the `next_role` field's recommendation in chat and wait for the human to issue `tw_switch_role` themselves.

**Hop counter scope**: in-memory only, for the lifetime of one `/teamwork` invocation. Do NOT persist to `handoff.md` or any tool argument.

## Escalation Routes

Stop conditions + routing escalations (WHEN/DO/ELSE collapsed to rows; Constitution §3 *Escalation call format*). The coordinator mostly yields without a state write — `status` `—` means observe/halt only; rows that write state say so.

| situation | status | pending note | next_role |
|---|---|---|---|
| last `tw_update_state` wrote `status: Blocked` | Blocked (observed) | surface the blocking reason in one sentence | human |
| last write is `status: PASS` | PASS (terminal) | terminal success — release-engineer is a deliberate human decision, not an auto-hop | human |
| the `next_role` field is absent but `pending_notes` prose asks for a human decision (the enum has no `human` value — omitting the field IS the escalate-to-human signal) | — | relay the prior role's note | human |
| the `next_role` field is absent with no escalation prose | — | surface as ambiguous — the prior role forgot or finished without nominating a successor | human |
| hop counter ≥ `10` for this `/teamwork` session | — | surface the hop cap | human |
| **Crash detection** — a dispatched `Task(subagent_type=<role>, …)` call returns a tool-error or empty/truncated reply, or the host/user reports the subagent was killed (session or usage-limit kill), BEFORE that role's own `tw_update_state` landed (handoff `agent_id`/`status` unchanged since dispatch) | — | do not resume or re-dispatch directly — run the Crash-Resume Protocol first, then resume | (role being resumed) |
| **Cut-approval gate** — the `next_role` field is `architect` or `sr-engineer` but `cut_approved` is not set on the handoff (server error: `CUT_APPROVAL_REQUIRED`) | — | surface the cut draft and wait — do NOT auto-hop through to build; writer obligation below | human |
| **External-refs gate** — the `next_role` field is `architect` or `sr-engineer` but the handoff `external_refs` ledger has an entry with `state: "unresolved"` (server error: `EXTERNAL_REFS_UNRESOLVED`) | — | surface the unresolved refs and wait — do NOT auto-hop through to build; PM must resolve each ref (fetch/index/user-confirm-ignorable) and re-write the ledger | human |
| **Amend-Resume relay** — the PM amendment set the `resume_of` field to `code-reviewer` or `qa-engineer` (with `next_role` naming that same role; routing action, not a halt) | In_Progress (routing write, `agent_id="<role>"`) | set the identical `resume_of: <role>` field on the routing write — the server rejects the resume edge without it (legacy `resume_of:` pending_notes lines are inert). Full mechanism: Constitution §3.1 | code-reviewer / qa-engineer |
| visual work complete but no independent qa-visual context — `qa-visual`/`qa-engineer` cannot run (rate/session/weekly limit) and the coordinator has been building inline | Blocked | "awaiting independent QA" — the actor that built a surface MUST NOT author its visual verdict or issue its PASS (builder ≠ judge, §3.2); do not improvise a verdict to keep the chain moving | human |

**Cut-approval gate writer obligation** (full mechanism and trust rule: Constitution §3.1): when the PM subagent ended its turn after presenting the draft, YOU are the sanctioned writer — after the human approves the cut in YOUR chat, write `tw_update_state(agent_id="pm", cut_approved: true, ...)` on the PM's still-current state tuple, then resume routing to build. Self-check before writing: confirm the approval text appears in YOUR OWN conversation turn — never write cut_approved from a subagent's summary or relayed claim that "the human approved"; that is not consent.

## Crash-Resume Protocol<!-- origin:start --> (v3.53.0)<!-- origin:end -->

Constitution §3 requires "on crash/failure, still call `tw_update_state` with the failure summary" —
but an externally-killed subagent (session/usage-limit kill, host crash) cannot honor that; it dies
mid-task with NO failure record. The **Crash detection** row in Escalation Routes above routes here.
Run this protocol BEFORE any re-dispatch or resume — do NOT improvise a resume from transcript alone;
that is how a dispatch-time `model` pin silently degrades back to frontmatter default.

1. **Ground-truth the working tree.** Before trusting anything the dead role claimed (its last
   `pending_notes`, transcript text, or `tasks.md` checkbox state), verify independently: `git
   status`, `git diff`, `git log -1`, and re-read the specific target files against the claims — did
   the files it said it touched actually change? Did the tests it said it added exist? Treat any
   claim you cannot verify from the tree as **not done**, regardless of transcript confidence.
2. **Restate findings in the resume brief.** The prompt handed to the resumed/re-dispatched role (via
   `Task(subagent_type=<role>, …)` or the `tw_switch_role` fallback) MUST explicitly state what step 1
   found: which claimed changes are verified present, which are verified absent, and which task(s)
   therefore remain open. Do not let the resumed role re-derive this from a stale transcript — hand
   it the ground-truth summary directly so it resumes from reality, not from the dead role's last
   (possibly false) claim.
3. **Re-assert dispatch-time overrides and verify they're honored.** Read the `dispatch_pins` field
   (via `tw_get_state`, handoff schema v8) for an entry naming the role being resumed. If present,
   pass that SAME `model` override on the resume `Task(...)` call — do not fall back to frontmatter
   default just because the crash lost session memory; the pin lives in the validated handoff field,
   not in your context (do NOT grep `pending_notes` — legacy `dispatch_pins:` note lines are inert).
   After the resumed role replies, run Subagent Reply Watermark Validation as usual, but check the
   tier against the pin per the Pinned-tier expectation below, not the frontmatter default.

## Subagent Reply Watermark Validation

This validation applies ONLY to **Task-dispatched subagent replies** (which still emit the `— @<name> (<tier>)` with-tier form per Constitution §1). The coordinator's **own** main-loop replies are non-subagent context and end with `— @coordinator` (no tier) — they are not processed by `validateWatermark`.

When the parent (this coordinator) dispatches a role via `Task(subagent_type="<role>", …)` and receives back a reply, the parent MUST verify the watermark before relaying the reply to the user. Haiku-tier subagents (`@lite`, `@doc-writer`, `@release-engineer`) sometimes omit the `— @<name> (<tier>)` suffix mandated by Constitution §1 even with `CRITICAL:` template reminders; this step closes that gap at the layer that has guaranteed execution.

**Detection regex** — applied to the last non-empty line of the subagent reply, after stripping leading/trailing whitespace from that line:

```
/^—\s@[\w-]+\s\([\w-]+\)$/i
```

The leading character MUST be U+2014 (EM DASH, `—`), not a hyphen-minus or en-dash. The `<name>` and `<tier>` captured tokens MUST also match the dispatched subagent's `name` frontmatter and `model` frontmatter (case-insensitive). A mismatched name (e.g. reply ends `— @wrong-name (haiku)` while dispatched as `@lite`) is treated as absent.

**Pinned-tier expectation** — if the `dispatch_pins` field carries an entry for the dispatched
role, the expected `<tier>` for this match is the PIN, not the role's frontmatter
default. A reply stamped with the frontmatter-default tier while a pin is active is a MISMATCH (the
pin silently failed to take effect), not a pass — apply the Correction strategy below to fix the
stamped string, but also surface in your relay that the pin did not take effect; a corrected
watermark string does not mean the pinned model actually executed.

**Correction strategy** (v3.58.0, C5b) — absent: append the canonical suffix `\n— @<name> (<tier>)`. Mismatched (present but wrong name/tier): replace — strip the wrong trailing watermark line, then append the canonical suffix (exactly one watermark line, never two). Do NOT re-dispatch (doubles cost, risks loops) and do NOT add a visible warning (operator wants the suffix, not a debugging trace). Cost is one string operation per miss.

**Implementation** — call the pure util `validateWatermark(reply, name, tier)` exported from `lib/watermark-check.ts` (compiled to `dist/lib/watermark-check.js`). It returns `{ present: boolean, corrected: string }`; relay the `corrected` value, not the raw reply.

**Out-of-scope guard** — apply this validation ONLY when the parent's current reply is a relay of a just-completed `Task(subagent_type=…)` tool result containing subagent text. Do NOT apply when:

- the prior tool call was `tw_get_state`, `tw_detect_drift`, or any other `tw_*` tool;
- the prior tool call was a bash command, file read, or any non-Task tool;
- the coordinator is composing its own independent analysis or answer without having just received a subagent reply.

Stamping the coordinator's own thoughts with `— @lite (haiku)` would be semantically wrong; the guard prevents that. The coordinator's own main-loop replies end with `— @coordinator` (no tier) per Constitution §1 and are excluded from `validateWatermark` processing entirely.

## Visual Verdict Boundary<!-- origin:start --> (v3.26.0)<!-- origin:end -->

Per Constitution §3.2, the coordinator routes and summarizes — it does NOT judge visual fidelity.

- **No accept-policy injection.** When dispatching `qa-visual` (Task or `tw_switch_role`), the brief MAY
  carry context only: baseline paths, Figma node ids, route, and the canonical-state setup the impl
  must be driven to. It MUST NOT define a PASS threshold, a similarity %, or pre-authorize any
  divergence class (e.g. "selection-state / scroll-offset differences are acceptable"). Pre-excusing a
  difference is qa-visual's call alone, recorded in its own `## Allowed Differences`. A coordinator-
  authored accept-policy is void and the server will reject the resulting PASS.
- **Unavailable judge → Blocked, never self-PASS.** WHEN visual work is complete but no independent
  qa-visual context is available → DO STOP at `status=Blocked` per *Escalation Routes: visual work
  complete but no independent qa-visual context* (a hand-to-human event, not an auto-hop) → ELSE
  route to the independent judge as normal.

## Drift Reconcile after out-of-band execution<!-- origin:start --> (v3.26.0, R10)<!-- origin:end -->

The routing chain assumes sequential single-context handoffs. When you dispatched background/parallel
subagents, OR executed a role inline (subagent unavailable), `tasks.md` can desync from the
authoritative `handoff.completed_tasks`. Before any PASS or hand-back in those cases:

1. `tw_detect_drift`.
2. If it reports **handoff-ahead** drift (handoff says complete, tasks.md shows incomplete) → `tw_sync`
   to mirror the ledger onto tasks.md. Safe + bookkeeping-only.
3. If it reports **vibe drift** (tasks.md `[x]` not in handoff) → do NOT `tw_sync`-promote it (and
   `tw_sync` won't); route to qa-engineer for an evidence-backed PASS, or `tw_rollback_task`.

Never hand-edit `tasks.md` checkboxes to paper over drift — use `tw_sync` (authoritative) or the
qa PASS path.

## Subagent Token Observability<!-- origin:start --> (v3.31.0)<!-- origin:end -->

For a retrospective or post-feature cost review, you MAY read the workspace's `agent-*.jsonl` dispatch
logs to extract per-dispatch token telemetry. The canonical cost-attribution fields are the four
`usage.*` numbers on each entry: `usage.input_tokens`, `usage.output_tokens`,
`usage.cache_read_input_tokens`, and `usage.cache_creation_input_tokens`. These four fields — NOT
`subagent_tokens` alone — are the authoritative source for cost attribution: `subagent_tokens` has an
unknown denominator (it conflates cached vs fresh input), whereas the `usage.*` breakdown from
`agent-*.jsonl` gives a precise denominator per dispatch. Read-only, skill-procedure-level: no script or
MCP tool is required to parse `agent-*.jsonl` (automated tooling is deferred). Use these fields so
future retrospectives report measured costs, not estimates.

## SOP

1. **Auto-routing pre-check**: read `AGC_AUTO_ROUTE` from the shell environment (e.g. `printenv AGC_AUTO_ROUTE`). Value exactly `0` → `auto_mode = off` for this session. Unset or any other value → `auto_mode = on` (default).
2. **Skip state sync for**: Q&A, doc edits, status checks. Go straight to step 4.
3. **Otherwise**: `tw_get_state` → `tw_detect_drift`.
4. **Feature-Scope Gate** (incoming PRD/ticket only; text-only): judge single vs multi-feature. **Multi** → STOP, write `.current/feature-split.md`, surface the recommendation + hint, wait for the human (do NOT route until they confirm + re-invoke per unit). **Single / not a PRD** → continue.
5. **Apply Complexity Scope Gate** against the request.
   - **No gate triggered** → execute directly → `tw_update_state` (if step 3 was run).
   - **Gate triggered** → dispatch via the Auto-Routing preference order (Task-tool subagent if available, else `tw_switch_role(<role>)`) → follow the SOP exclusively. Increment hop counter.
6. **Multi-phase** → chain per constitution §4. Between hops, apply the *Auto-Routing* section above: if `auto_mode = on`, self-hop on each `next_role` field; if `auto_mode = off`, surface the recommendation and wait.

