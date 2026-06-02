# Watermark Hide Model Tier (v3.23.0)

## Problem Statement

The current watermark format `— @<role> (<tier>)` appears on every reply — including those from the main-loop coordinator, `@teamwork`, and `@lite` when acting as the top-level session agent. Users interpret the visible `(<tier>)` as meaning "the whole conversation ran on this model tier," when in fact the tier token is only semantically meaningful for Task-dispatched subagents whose model is pinned by their agent frontmatter. The fix is a two-format regime: roles running as fresh Task-dispatched subagents (model frontmatter pinned at dispatch time) continue to show `— @<role> (<tier>)`; roles running in the same context (coordinator, coordinator-lite, or any `tw_switch_role` same-context switch) emit only `— @<role>`, hiding the model tier to avoid the false impression.

## User Stories

- As an agc operator, I want coordinator and coordinator-lite main-loop replies to end with `— @<role>` (no model tier), so that users do not mistake the coordinator's model for the model running all work.
- As an agc operator, I want Task-dispatched subagent replies to continue ending with `— @<role> (<tier>)`, so that the per-role model tier remains observable at the layer where it is actually meaningful.
- As a coordinator, I want `tw_switch_role`-based same-context role switches to use the no-tier format, so that in-context role changes are not confused with separately dispatched subagents.
- As a template maintainer, I want the criterion for "I am a subagent context" to be self-detectable from the agent's own execution context, so that no additional runtime signal is required.

## Acceptance Criteria

- **AC1 — Constitution §1 watermark rule updated**
  - Given `content/constitution.md`, when the file is read, then §1 Watermark MUST state:
    - **Subagent context** (agent is running as a fresh Task-dispatched subagent — see self-detection rule below): end reply with `— @<role> (<tier>)`.
    - **Non-subagent context** (coordinator main loop, coordinator-lite, or same-context `tw_switch_role` switch): end reply with `— @<role>` (no model token).
    - Self-detection rule (verbatim, load-bearing): "An agent is in subagent context if and only if its `model:` frontmatter was set by the dispatching parent at Task creation time — i.e., the agent file `~/.claude/agents/<role>.md` exists and was used as the execution template for this turn. In practice: if you are running because a `Task(subagent_type=…)` call spawned you, you are a subagent; if you are running as the initial session agent or switched in-context via `tw_switch_role`, you are not."

- **AC2 — skill-coordinator.md updated**
  - Given `content/skill-coordinator.md`, when the file is read, then:
    - The watermark example in the §Watermark Validation sub-section MUST show the no-tier form: `— @coordinator` (coordinator main loop) and distinguish it from the with-tier form shown for dispatched subagents.
    - The `## Subagent Reply Watermark Validation` section MUST clarify that `validateWatermark` is called only for Task-dispatched subagents (where `(<tier>)` is expected), not for coordinator's own output.
    - The detection regex `/^—\s@[\w-]+\s\([\w-]+\)$/i` remains unchanged for subagent validation (subagents still emit tier).

- **AC3 — skill-coordinator-lite.md updated**
  - Given `content/skill-coordinator-lite.md`, when the file is read, then the watermark example MUST show `— @lite` (no tier), consistent with coordinator-lite running in non-subagent context.
  - The `## Subagent Reply Watermark Validation` cross-reference remains unchanged; validation still applies when coordinator-lite dispatches a Task (the dispatched subagent still emits tier).

- **AC4 — Role skill files updated (same-context tw_switch_role)**
  - Given any role skill file in `content/skill-{pm,architect,sr-engineer,researcher,qa-engineer,code-reviewer,design-auditor,doc-writer,release-engineer,qa-visual}.md` that contains a watermark example or instruction, when the file is read, then the example MUST reflect the two-context rule:
    - When the role is running as a `tw_switch_role` same-context switch (no model pin): `— @<role>` (no tier).
    - When the role is running as a Task-dispatched subagent (model pinned by template): `— @<role> (<tier>)`.
  - If a skill file currently contains no watermark example or instruction, no change is required.

- **AC5 — templates/claude-code-agents/*.md unchanged**
  - Given every file in `templates/claude-code-agents/`, when the files are read, then NO change is made to the `CRITICAL:` reminder lines or the `Example reply suffix:` lines. Rationale: these templates represent the subagent-dispatch execution context where `(<tier>)` is correct and required; the existing `CRITICAL: End every reply with \`— @<name> (<tier>)\`` instruction stays verbatim.
  - The `test/subagent-templates.test.mjs` suite MUST continue to pass without modification to the test file.

- **AC6 — validateWatermark and lib/watermark-check.ts — no behavioral change**
  - Given `lib/watermark-check.ts`, when the file is read, then its function signatures, regex, and logic are UNCHANGED. The library validates subagent replies (which still emit tier). No new overload or variant is added.
  - The `test/watermark-check.test.mjs` suite MUST continue to pass without modification.
  - Rationale: `validateWatermark` is only ever called by the coordinator when relaying a Task-dispatched subagent reply. Those subagents still emit `— @<role> (<tier>)`, so the validator's expected format does not change.

- **AC7 — Out-of-scope guard in coordinator explicitly covers no-tier coordinator output**
  - Given `content/skill-coordinator.md` §Subagent Reply Watermark Validation, when the out-of-scope guard is read, then it MUST include an explicit statement that the coordinator's own replies (main-loop turns, not relay turns) end with `— @coordinator` (no tier) and are excluded from `validateWatermark` processing.

- **AC8 — Version bump**
  - Given `package.json` and `index.ts`, when this feature ships, then both versions read `3.23.0` (MINOR bump — new observable output format, no breaking API changes).
  - `scripts/check-version.mjs` MUST pass after the bump.

- **AC9 — No schema_version bump**
  - Given `schema/versions.ts`, when the file is read, then `CURRENT_VERSIONS` values are UNCHANGED. This is a content/SOP-only change; no persisted-state schema is touched.

- **AC10 — CHANGELOG entry**
  - Given `CHANGELOG` (or the changelog section in `README.md` if no separate file exists), when the feature ships, then a `v3.23.0` entry MUST be present describing the two-format watermark regime.

## Design Decisions

### Decision 1: Self-detection criterion for "subagent context"

**Criterion (load-bearing):** An agent is in subagent context if and only if it was spawned by a `Task(subagent_type=…)` call — i.e., the agent file `~/.claude/agents/<role>.md` was the execution template for the current turn, and the `model:` frontmatter in that file was set by the dispatching parent (pinned tier). In Claude Code, this corresponds to the agent having been started as a sub-process for a specific Task invocation.

**Practical heuristic for agents:** If you are running because a human or parent agent invoked `@<role>` via a Task dispatch and your `model:` is pinned in your agent file, you are a subagent → use `— @<role> (<tier>)`. If you are running as the initial session agent (the first agent in the conversation window) or were loaded in-context via `tw_switch_role`, you are NOT a subagent → use `— @<role>`.

**tw_switch_role edge case:** A `tw_switch_role` call loads a new SOP into the current context but does NOT spawn a new agent process and does NOT pin a model tier. The model running the turn remains whatever the current session model is — it was not chosen for this specific role. Therefore, same-context `tw_switch_role` switches are classified as non-subagent context → `— @<role>` (no tier). This is the conservative, user-confusion-avoiding choice: displaying a tier that was not deliberately assigned to the role would be misleading.

**Rationale for not requiring a runtime signal:** Adding a `tw_*` tool flag or env var to signal "I am a subagent" would require infrastructure changes. The self-detection rule via `~/.claude/agents/<role>.md` template presence is already implicit in how Claude Code agents work. Agents know whether they were dispatched via a Task because their system prompt was constructed from the agent file, not from the coordinator prompt chain.

### Decision 2: validateWatermark contract unchanged

`validateWatermark(reply, name, tier)` is called exclusively by coordinator/coordinator-lite when relaying Task-dispatched subagent replies. Those subagents still emit `— @<role> (<tier>)`. No change to the function, regex, or tests is warranted. The coordinator's own output (main loop) is not processed by `validateWatermark` — it is written directly by the agent following the §1 rule. This is consistent with the existing out-of-scope guard in `skill-coordinator.md` which already states the validator must not be applied to coordinator's own turns.

### Decision 3: Affected skill files

Grep for `— @` in each skill file to find watermark examples. Files without any watermark example require no edit. The load-bearing changes are:
- `content/constitution.md` §1 — the source-of-truth definition of the two-format rule.
- `content/skill-coordinator.md` — watermark example for coordinator main-loop + clarity on `validateWatermark` scope.
- `content/skill-coordinator-lite.md` — watermark example updated to no-tier form.
- Any role skill file (`skill-pm.md`, etc.) that explicitly shows a watermark example — update to show both forms (subagent vs same-context). Files with no watermark example are untouched.

### Decision 4: Backwards compatibility

- Subagent templates (`templates/claude-code-agents/*.md`) are UNCHANGED — they represent the subagent-dispatch path where tier is correct.
- `lib/watermark-check.ts` and tests are UNCHANGED.
- `tools/transitions.ts` is UNCHANGED.
- `ALLOWED_TRANSITIONS` matrix is UNCHANGED.
- No `tw_*` tool surface change.
- The only change visible to end-users: coordinator/coordinator-lite/same-context-role replies drop `(<tier>)`. Subagent replies retain it.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| wm.nomodel.format | `— @<role>` | authored-here — new non-subagent watermark format; `<role>` substituted at runtime from current role name |
| wm.subagent.format | `— @<role> (<tier>)` | authored-here — unchanged subagent watermark format carried forward from v3.22.1 |
| wm.selfdetect.rule | `An agent is in subagent context if and only if its model: frontmatter was set by the dispatching parent at Task creation time — i.e., the agent file ~/.claude/agents/<role>.md exists and was used as the execution template for this turn.` | authored-here — canonical self-detection rule to be inserted verbatim into constitution §1 |
| wm.constitution.rule.updated | `End every reply with — @<role> (<tier>) if running as a Task-dispatched subagent (model pinned by agent frontmatter), or — @<role> if running as coordinator main loop, coordinator-lite, or a same-context tw_switch_role switch.` | authored-here — updated §1 Watermark directive |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any change to `templates/claude-code-agents/*.md` — subagent templates stay as-is.
- Any change to `lib/watermark-check.ts` or `test/watermark-check.test.mjs`.
- Any change to `tools/transitions.ts` or `ALLOWED_TRANSITIONS`.
- Any change to `schema/versions.ts` (no persisted-state schema touched).
- Adding a runtime MCP signal or env var to indicate subagent context — self-detection rule is sufficient.
- Retroactively correcting coordinator replies already seen by users (no replay/correction mechanism exists).
- Any sonnet/opus tier compliance investigation — not relevant to this change.
- Modifying `test/subagent-templates.test.mjs` — that suite must pass unchanged.

## Dependencies / Prerequisites

- v3.22.1 is the released baseline (confirmed: `package.json` + `index.ts` at `3.22.1`).
- No external references found in requirements. Resource Audit Gate: zero `http(s)://`, `figma`, `sketch`, `mockup`, `設計圖`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, or `JIRA` references in the user brief or this spec.
- `scripts/check-version.mjs` must pass after the `3.22.1 → 3.23.0` bump.
- Pre-existing 154-task drift (T01–T462) is confirmed surfaced to the human and is NOT modified by this feature.

## Tasks

- [ ] T463 [P0] Update `content/constitution.md` §1 Watermark: replace single-format rule with two-format rule (subagent → with tier; non-subagent → no tier) + self-detection criterion (verbatim wm.selfdetect.rule string) | depends_on: none
- [ ] T464 [P0] Update `content/skill-coordinator.md`: change coordinator main-loop watermark example to no-tier form; update §Subagent Reply Watermark Validation out-of-scope guard to explicitly state coordinator own output ends with `— @coordinator` (no tier) | depends_on: T463
- [ ] T465 [P0] Update `content/skill-coordinator-lite.md`: change watermark example to `— @lite` (no tier); confirm §Subagent Reply Watermark Validation cross-reference is unchanged | depends_on: T463
- [ ] T466 [P1] Grep each `content/skill-{pm,architect,sr-engineer,researcher,qa-engineer,code-reviewer,design-auditor,doc-writer,release-engineer,qa-visual}.md` for `— @` watermark examples; update any found to show both forms (subagent with tier, same-context without tier); skip files with no watermark example | depends_on: T463
- [ ] T467 [P0] Bump `package.json` and `index.ts` Server() literal from `3.22.1` → `3.23.0`; run `node scripts/check-version.mjs` to confirm | depends_on: T463
- [ ] T468 [P1] Add `v3.23.0` CHANGELOG entry describing the two-format watermark regime | depends_on: T467
- [ ] T469 [P1] QA: run `npm test` and confirm full suite passes (especially `test/subagent-templates.test.mjs` and `test/watermark-check.test.mjs` with zero modifications to those test files) | depends_on: T464, T465, T466, T467
