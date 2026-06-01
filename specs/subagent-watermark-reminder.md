# Subagent Watermark Reminder

## Problem Statement

Constitution v3.14.1 §1 mandates every chat reply end with `— @<current-role> (<model>)`. Subagents dispatched via Claude Code (`templates/claude-code-agents/*.md`) currently rely on the SOP loaded by `tw_switch_role` to surface that rule, but empirical observation in v3.21.0 shows subagents frequently omit the watermark on short replies (greetings, single-line answers). The shim body has no explicit reminder, so the rule only fires if the subagent reads the constitution attentively. An in-shim one-line reminder closes the gap.

## User Stories

- As an agc operator, I want each dispatched subagent reply to carry the canonical `— @<role> (<tier>)` watermark, so I can identify which role + tier just spoke without inspecting frontmatter.

## Acceptance Criteria

- **AC1** — Given any file under `templates/claude-code-agents/*.md`, when its body is read, then it MUST contain the literal line `End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark).` where `<name>` is replaced verbatim with the file's frontmatter `name:` value and `<tier>` with its frontmatter `model:` value (e.g. `lite.md` carries `End every reply with \`— @lite (haiku)\` per Constitution §1 (watermark).`).
- **AC2** — Given `npm test`, when `test/subagent-templates.test.mjs` runs, then a new test asserts AC1 for every entry in `EXPECTED_ROLES` and fails if any template is missing the line.
- **AC3** — Given the existing AC1–AC6 tests in `test/subagent-templates.test.mjs`, when the new line is added, then all prior tests still pass (no frontmatter mutation, no body delegation contract break).
- **AC4** — Given `package.json` and `index.ts`, when this feature ships, then both versions read `3.21.1` (patch bump — docs-only).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| watermark.reminder | `End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark).` | authored-here — mirrors Constitution §1 watermark rule, surfaces it in the shim body so short-reply omissions are caught at dispatch time |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Re-installation of `~/.claude/agents/*.md` is user-managed (per README `cp` snippet); this feature only updates source templates.
- No changes to `content/skill-*.md` (the constitution + skills already encode the watermark rule).
- No changes to README (the rule is documented in constitution §1, which README links to).

## Dependencies / Prerequisites

- None.
