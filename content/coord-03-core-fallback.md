**Fallback (`tw_switch_role`)** — used when Task tool / subagents are unavailable (Cursor, Continue, Anti-Gravity, plain MCP clients, or Claude Code without the templates installed). Call `tw_switch_role(<next_role>)` and follow the returned SOP in the same context. This is the pre-v3.20.0 behavior — degradation is graceful and silent; no tw_* tool surface has changed.

**Stop conditions**: see `## Escalation Routes` below. WHEN any row's trigger fires → DO stop (or, for the relay row, route) per that row, surfacing the reason in one sentence → ELSE keep auto-hopping.

**Opt-out**: if `AGC_AUTO_ROUTE=0` at session start, do NOT auto-hop — surface the `next_role` field's recommendation in chat and wait for the human to issue `tw_switch_role` themselves.

**Hop counter scope**<!-- origin:start --> (v3.67.0, D2)<!-- origin:end -->: server-tracked and feature-scoped — `hop_count` is a persisted `handoff.md` field computed by the orchestrator (a sibling of `qa_round`/`review_round`/`visual_round`); it resets ONLY on `active_feature` change (NOT on PM re-entry) and therefore persists across `/teamwork` invocations of the same feature. Read it from `tw_get_state`; do NOT compute, cache, or write it yourself — the pre-D2 in-memory counter is retired. WHEN a feature's `hop_count` is already at/over the `hop` cap (const-01 Limits) → the server rejects the next counted role-transition write with `HOP_CAP_EXCEEDED`, allowing only the `(pm, In_Progress)` landing edge (which records the halt WITHOUT resetting the counter — only a feature change clears it) → surface the halt per the *hop cap* Escalation Routes row. Self-loops and same-agent status changes are not role transitions and are never hop-counted or hop-blocked.

**Feature-Scope Gate** (E1): the server holds a derived per-workspace feature lease — a second `active_feature` cannot start while the incumbent feature is non-terminal (`status != PASS`; `Blocked` counts as held) and fresh (`last_updated` within the 30-min TTL). Any `tw_update_state` write carrying a different `active_feature` is rejected with `FEATURE_LEASE_HELD` (never hand-edit around it). Surface to the human and wait — or run the second feature in a separate git worktree (distinct `workspace_path`, already isolated at zero server cost).

## Escalation Routes

Stop conditions + routing escalations (WHEN/DO/ELSE collapsed to rows; Constitution §3 *Escalation call format*). The coordinator mostly yields without a state write — `status` `—` means observe/halt only; rows that write state say so.

| situation | status | pending note | next_role |
|---|---|---|---|
| last `tw_update_state` wrote `status: Blocked` | Blocked (observed) | surface the blocking reason in one sentence | human |
| last write is `status: PASS` | PASS (terminal) | terminal success — release-engineer is a deliberate human decision, not an auto-hop | human |
| the `next_role` field is absent but `pending_notes` prose asks for a human decision (the enum has no `human` value — omitting the field IS the escalate-to-human signal) | — | relay the prior role's note | human |
| the `next_role` field is absent with no escalation prose | — | surface as ambiguous — the prior role forgot or finished without nominating a successor | human |
| `hop_count` from `tw_get_state` ≥ the `hop` cap for the active feature — or a `tw_update_state` write was rejected with `HOP_CAP_EXCEEDED` (server-enforced) | — | surface the hop cap (`hop_count={n}`) — autonomous dispatch is frozen at PM until a human re-scopes into a new feature or overrides | human |
| **Token budget brake** — `.current/.config.json` sets `tokenBudgetPerFeature` AND the feature-scoped running total summed from `.current/usage.jsonl` (fallback: the `agent-*.jsonl` hand-sum when the sidecar is absent; see §Token Budget Brake) ≥ 80% of it | — | `token budget: {running_total} / {tokenBudgetPerFeature} ({pct}%) — handing to human` | human |
| **Crash detection** — a dispatched `Task(subagent_type=<role>, …)` call returns a tool-error or empty/truncated reply, or the host/user reports the subagent was killed (session or usage-limit kill), BEFORE that role's own `tw_update_state` landed (handoff `agent_id`/`status` unchanged since dispatch) | — | do not resume or re-dispatch directly — run the Crash-Resume Protocol first, then resume (fresh-session counterpart: the Stale-dispatch detection row below) | (role being resumed) |
| **Stale-dispatch detection** — `tw_get_state` returns a `stale_dispatch` advisory (a `next_role` was stamped `dispatched_at` more than 15 min ago with no subsequent write; surfaced from persisted state alone, so a fresh/post-compaction session with NO memory of dispatching still sees it) | — | do not resume or re-dispatch directly — run the Crash-Resume Protocol first, then resume | (role named by `stale_dispatch.role`) |
| **Cut-approval gate** — the `next_role` field is `architect` or `sr-engineer` but `cut_approved` is not set on the handoff (server error: `CUT_APPROVAL_REQUIRED`) | — | surface the cut draft and wait — do NOT auto-hop through to build; writer obligation below | human |
| **External-refs gate** — the `next_role` field is `architect` or `sr-engineer` but the handoff `external_refs` ledger has an entry with `state: "unresolved"` (server error: `EXTERNAL_REFS_UNRESOLVED`) | — | surface the unresolved refs and wait — do NOT auto-hop through to build; PM must resolve each ref (fetch/index/user-confirm-ignorable) and re-write the ledger | human |
| **Feature-lease gate** — a write for a NEW `active_feature` was rejected with `FEATURE_LEASE_HELD` (incumbent feature non-terminal and fresh — see Feature-Scope Gate above) | — | surface the held lease (incumbent feature + status from the rejection envelope) and wait for PASS or lease expiry — do NOT auto-hop, do NOT clobber; offer the separate-git-worktree route for genuinely parallel work | human |
| **Amend-Resume relay** — the PM amendment set the `resume_of` field to `code-reviewer` or `qa-engineer` (with `next_role` naming that same role; routing action, not a halt) | In_Progress (routing write, `agent_id="<role>"`) | set the identical `resume_of: <role>` field on the routing write — the server rejects the resume edge without it (legacy `resume_of:` pending_notes lines are inert). Full mechanism: Constitution §3.1 | code-reviewer / qa-engineer |
| visual work complete but no independent qa-visual context — `qa-visual`/`qa-engineer` cannot run (rate/session/weekly limit) and the coordinator has been building inline | Blocked | "awaiting independent QA" — the actor that built a surface MUST NOT author its visual verdict or issue its PASS (builder ≠ judge, §3.2); do not improvise a verdict to keep the chain moving | human |

**Cut-approval gate writer obligation** (full mechanism and trust rule: Constitution §3.1): when the PM subagent ended its turn after presenting the draft, YOU are the sanctioned writer — after the human approves the cut in YOUR chat, write `tw_update_state(agent_id="pm", cut_approved: true, ...)` on the PM's still-current state tuple, then resume routing to build. Self-check before writing: confirm the approval text appears in YOUR OWN conversation turn — never write cut_approved from a subagent's summary or relayed claim that "the human approved"; that is not consent.

## Crash-Resume Protocol<!-- origin:start --> (v3.53.0)<!-- origin:end -->

Constitution §3 requires "on crash/failure, still call `tw_update_state` with the failure summary" —
but an externally-killed subagent (session/usage-limit kill, host crash) cannot honor that; it dies
mid-task with NO failure record. BOTH the **Crash detection** row (same-session trigger) and the
**Stale-dispatch detection** row (fresh-session trigger) in Escalation Routes above route here.
Run this protocol BEFORE any re-dispatch or resume — do NOT improvise a resume from transcript alone;
that is how a dispatch-time `model` pin silently degrades back to frontmatter default.

0. **Identify the in-flight role without relying on your own memory.** If you saw
   the `Task(...)` fail this session, that reply names the role directly. If you
   are fresh / post-compaction and have NO memory of dispatching, read the
   `stale_dispatch` field from `tw_get_state`: `stale_dispatch.role` IS the role
   in flight and the signal is your trigger. Either path, resume THAT role and
   proceed to step 1.
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

