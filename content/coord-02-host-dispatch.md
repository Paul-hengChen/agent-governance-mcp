**Subagent Dispatch (Claude Code)** — preferred when available. If the host advertises a `Task` tool with `subagent_type=<role>` AND a subagent named `<role>` is registered (heuristic: attempt the call once; on tool-error or unknown-subagent-type, fall back), dispatch via `Task(subagent_type="<next_role>", prompt="<brief composed per the **Dispatch Brief Template** below>")` INSTEAD of `tw_switch_role`. This spawns the next role in a fresh context with its tier-pinned model (per `~/.claude/agents/<role>.md` frontmatter — copy from `templates/claude-code-agents/`). The dispatched subagent's first action remains `tw_get_state` → `tw_detect_drift` (Constitution §3); the **server-enforced `ALLOWED_TRANSITIONS` matrix in `tools/transitions.ts` still gates every `tw_update_state` write** (invalid edges rejected with `TRANSITION_REJECTED`) — Task-tool dispatch changes WHICH MODEL runs the role, NOT the routing chain itself.

**Dispatch Brief Template** — every Task-dispatch `prompt` MUST open with these invariant lines verbatim, in order (copy from here — never re-derive or paraphrase them from memory), followed by the per-hop `Assignment:` delta paragraph:

````markdown
First action: `tw_get_state(workspace_path=<workspace_path>)` → `tw_detect_drift`.
Known drift, ignore (do not reconcile): <ids from this session's `tw_detect_drift` vibe-drift list, or "none — drift clean">.
Dispatch pins in effect: <current `dispatch_pins` map per `tw_get_state`, or "none">.
Do NOT set `cut_approved` — you are Task-dispatched; the coordinator attests approval after the human approves in the coordinator's chat.
Watermark your reply per Constitution §1 (Task-spawned: `— @<role> (<tier>)`; `<tier>` = the `dispatch_pins` entry above if it names your role, else your frontmatter default).

Assignment: <per-hop delta — feature, task id(s), scope, upstream `pending_notes` summary>.
````

Fill the drift and pins lines from this session's `tw_detect_drift` / `tw_get_state`, quoting the first-class `dispatch_pins` field directly (the `pending_notes` pin convention is retired, C14). The known-drift line is ALWAYS present — render the literal `"none — drift clean"` on a clean check rather than omitting the line; its presence is what makes a forgotten drift check visible in the transcript. The `cut_approved` line is included ONLY when the dispatch target's `next_role` is `pm`; omit it for every other role.

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

