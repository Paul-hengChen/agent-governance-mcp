# Spec: PM Ticket-Cut Approval Gate

> v1.0 — authored 2026-06-26 by @pm

## Problem Statement

After PM splits tickets, the chain currently routes straight into build (architect or sr-engineer) with no human checkpoint on the cut. Research (`research/ticket-splitting-for-ai-agents.md`) identifies human review of the ticket cut as the highest-leverage accuracy checkpoint — the moment where over-stuffed or mis-scoped tickets can be caught before engineer context is consumed. This spec adds a server-enforced gate forcing human approval of the cut before any build role receives the handoff, a `cut_approved` boolean in the handoff schema, a PM SOP update requiring an inline draft-and-halt workflow, and per-ticket design-link requirements when `hasDesignModeRequiringVisual()` is armed.

## User Stories

- As a human reviewer, I want the server to block build-entry until I have explicitly approved the ticket cut, so that mis-scoped or oversized tickets cannot silently enter the engineer pipeline.
- As a PM agent, I want clear SOP instructions for presenting the cut draft inline in chat and halting for approval, so that I know exactly when and how to pause for human input.
- As an architect or sr-engineer, I want to know that every ticket set I receive has passed human review, so that I can trust the cut and focus on implementation rather than re-scoping.
- As a coordinator, I want a documented stop-condition for the cut-approval gate in the Auto-Routing section, so that auto-routing correctly halts at the gate rather than attempting to route through it.

## Acceptance Criteria

**AC-1 — Server gate blocks build entry without cut_approved:**
Given a handoff with `last_agent: pm`, `status: In_Progress`,
When `tw_update_state` is called with `agent_id` in `{architect, sr-engineer}` and `status: In_Progress` (the `pm:In_Progress → {architect,sr-engineer}:In_Progress` edge),
Then the server returns an error with `error: "CUT_APPROVAL_REQUIRED"` and the standard envelope `{error, attempted, allowed, hint}` unless `cut_approved === true` in the current handoff state.

**AC-2 — cut_approved clears the gate:**
Given a handoff with `cut_approved: true`,
When `tw_update_state` is called on the `pm:In_Progress → {architect,sr-engineer}:In_Progress` edge,
Then the gate does NOT fire and the transition proceeds normally.

**AC-3 — Gate also fires on lite / in-context paths (SOP-level only):**
Given that lite mode is server-read-only and emits no `tw_update_state` transition,
When a lite or in-context agent completes PM work,
Then the PM SOP MUST instruct the agent to halt for human approval and set `cut_approved` before nominating a build role — the SOP text is the enforcement mechanism for these paths, because no transition edge exists to gate (see Dependencies / Prerequisites §Lite-mode enforcement).

**AC-4 — PM SOP: inline cut draft with halt:**
Given PM has completed the ticket split decision (2a / 2a-bis / 2b),
When PM is about to route to architect or sr-engineer,
Then PM MUST first present the cut draft inline in chat (one row per ticket: `id | desc | depends_on | est. files | design-link`) and HALT for human approval — do NOT use AskUserQuestion; present inline and wait.

**AC-5 — Per-ticket design link when visual arm is active:**
Given `hasDesignModeRequiringVisual()` returns `required: true` for the active feature,
When PM presents the cut draft inline,
Then tickets that touch a visual surface MUST include a Figma node id + URL (following the baseline-manifest node-id convention) in the `design-link` column; tickets that do not touch a visual surface carry `—` in that column.

**AC-6 — Schema: cut_approved field + migration:**
Given an existing handoff at schema_version 4,
When the server reads it after upgrade,
Then it is lazily migrated to schema_version 5 with `cut_approved` absent (undefined, not defaulted to false — absence means unapproved, mirroring the scope_decision pattern).

**AC-7 — Migration is pure and lossless:**
Given any handoff payload,
When the v4→v5 migration runs,
Then only `schema_version` is bumped; no existing field is modified or removed, and `cut_approved` is NOT seeded (absence is the unapproved sentinel).

**AC-8 — coordinator skill Auto-Routing stop-condition:**
Given Auto-Routing is reading `pending_notes` after a PM handoff,
When `pending_notes` contains `"next_role: architect"` or `"next_role: sr-engineer"` AND `cut_approved` is not yet set,
Then the coordinator stop-condition list includes the cut-approval gate as a documented halt: the coordinator MUST surface the cut draft to the human and wait, not auto-hop through to build.

**AC-9 — Build gate: npm run build + audit + tests pass:**
Given all code changes are in place,
When `npm run build && npm audit --audit-level=high && npm test` are run,
Then all three commands exit 0.

## Copy / Strings

All strings are error envelope values or SOP text authored in-server — no external design source.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S01 | `CUT_APPROVAL_REQUIRED` | authored-here — error code, mirrors SCOPE_DECISION_REQUIRED pattern |
| S02 | `"Cut approval missing. PM must present the ticket cut inline in chat and obtain human approval before routing to build. Set cut_approved: true on the pm:In_Progress write after approval. See content/skill-pm.md §SOP step 7a."` | authored-here — hint string for the gate rejection envelope |
| S03 | (PM SOP inline table header) `"id \| desc \| depends_on \| est. files \| design-link"` | authored-here — inline cut draft table format, specified in requirements |
| S04 | (coordinator stop-condition text) `"cut-approval gate: pending_notes contains next_role: architect or next_role: sr-engineer but cut_approved is not set — surface cut draft to human and wait"` | authored-here — coordinator skill stop-condition entry |

## Visual Tokens

N/A — this feature introduces no visual UI. All output is MCP error envelopes and SOP text.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual tokens | authored-here — server-only feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — `design/<feature>.md` does not exist; no design mode is armed for this feature. This section is explicitly absent because mode = no-design.

## Out of Scope

- Enforcing cut quality (ticket size, INVEST compliance) — the gate only checks that a human approved; it does not validate the content of the cut.
- Per-ticket Figma link validation at the server level — the node-id convention is SOP-enforced only; the server gate checks `cut_approved`, not per-ticket link presence.
- Blocking the coordinator from routing researcher → PM (no cut yet, gate not relevant).
- Any change to the `release-engineer` path or PASS gate logic.
- Enforcement of the lite-mode path at the transition-edge level — this is an acknowledged limitation; see Dependencies / Prerequisites.
- Adding `cut_approved` to the SQLite schema — the field lives in the handoff YAML frontmatter only (same pattern as `scope_decision`).

## Dependencies / Prerequisites

### Lite-mode enforcement (architectural tension — must be resolved by architect)

The requirement "also block lite / in-context paths" CANNOT be fully satisfied by a transition-edge gate alone. Lite mode (`teamwork-lite` / coordinator-lite) is server-read-only by design: it emits no `tw_update_state` transition, so there is no `pm:In_Progress → architect:In_Progress` edge for the server to intercept. The existing scope-decision gate (`SCOPE_DECISION_REQUIRED`) has the same limitation — its own comment in `tools/transitions.ts` notes it does NOT stop in-context / lite-mode work that emits no transition.

**This spec scopes the server-side gate to the transition edge only.** Lite-mode enforcement is SOP-level: `content/skill-pm.md` and `content/skill-coordinator-lite.md` both receive the cut-draft-and-halt instruction. The architect MUST decide whether a complementary server mechanism is feasible (e.g., gating at a different tool surface such as `tw_add_task` or `tw_get_next_task`) or whether SOP-level is the accepted ceiling. This decision must be captured in `specs/pm-cut-approval-gate-architecture.md` before sr-engineer implements.

### Schema version bump

Current `CURRENT_VERSIONS.handoff` is `4` (in `schema/versions.ts`). This feature bumps it to `5`. The architect must confirm no concurrent feature is also bumping this version.

### `hasDesignModeRequiringVisual()` dependency

The per-ticket design-link requirement uses the existing `hasDesignModeRequiringVisual()` arm signal from `tools/evidence-file.ts`. The gate reads the same signal as the visual PASS gates — no new function is needed; the architect should confirm the call site in `index.ts` is appropriate.

### `cut_approved` field type and write path

`cut_approved` is a pure boolean. PM sets it via a new `cut_approved` parameter on `tw_update_state` (analogous to `scope_decision`). The zod schema, JSON tool descriptor, and `writeHandoffState` in `tools/handoff.ts` must all be updated. The architect must specify the exact write-path and whether `cut_approved` persists across features (recommendation: reset to `undefined` on new-feature start, same as `scope_decision`).

### Transition matrix

The `pm:In_Progress` row in `ALLOWED_TRANSITIONS` already permits `architect:In_Progress` and `sr-engineer:In_Progress`. No matrix change is needed — the new gate is handler-side only (same pattern as `SCOPE_DECISION_REQUIRED`), NOT a new edge in `validateTransition`.

### Research reference

`research/ticket-splitting-for-ai-agents.md` — provides rationale for why human cut review is the highest-leverage checkpoint. No external URLs to fetch; the document is already on-disk.
