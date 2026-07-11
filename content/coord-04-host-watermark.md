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

