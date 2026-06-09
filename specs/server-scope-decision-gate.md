# Spec: server-scope-decision-gate

**Feature ID:** server-scope-decision-gate
**Version:** v3.30.0 (proposed)
**Status:** PM In_Progress → next_role: architect

---

## Problem Statement

The Feature-Scope Gate (coordinator skill) and design-auditor Volume Gate are skill-advisory only: nothing in `tools/transitions.ts` or `index.ts` blocks a design-backed feature from entering build without a recorded scope decision. The CDE-OOBE retrospective finding A0 identified this gap — the whole 9-screen OOBE was scoped as one feature, driven in-context, and no "ask the human to split" gate ever fired. The state machine currently has no enforceable checkpoint between PM handing off and build roles (architect, sr-engineer) beginning work, allowing an oversized, un-split feature to enter build silently. This feature adds a server-side transition reject at that exact edge, analogous to `VISUAL_BASELINES_REQUIRED`, that fires when a design reference is present but no scope decision has been recorded.

---

## User Stories

- As a coordinator, I want the server to reject a transition into build when a design file is present but no scope decision is recorded, so that an oversized feature cannot slip into build without human acknowledgment.
- As a PM, I want to record a single-feature attestation in handoff state (e.g. `scope_decision: single-feature`) so the gate passes without creating a feature-split file when the feature is genuinely small.
- As a sr-engineer or architect, I want to see an actionable error code and hint when the gate blocks me, so I know exactly which artifact to create or which state field to populate before retrying.

---

## Acceptance Criteria

**AC-1 (gate armed):** Given `design/<active_feature>.md` exists AND the file's `## Mode` line is NOT `no-design`, when a transition targets `architect:In_Progress` or `sr-engineer:In_Progress` from a preceding `pm:In_Progress` state, then the server rejects the write with error code `SCOPE_DECISION_REQUIRED` if neither satisfying artifact is present.

**AC-2 (split-file satisfies):** Given `.current/feature-split.md` exists in the workspace, when the gate would otherwise fire, then the transition is accepted (gate passes through).

**AC-3 (handoff-field satisfies):** Given the current handoff state carries `scope_decision: single-feature` (new schema field, handoff schema v4), when the gate would otherwise fire, then the transition is accepted.

**AC-4 (rejection envelope):** The rejection response MUST be `isError: true` and carry the standard envelope `{ error: "SCOPE_DECISION_REQUIRED", attempted: {...}, allowed: [...], hint: "<actionable text>" }` where `hint` is the verbatim string defined in the Copy / Strings section.

**AC-5 (no false positives — non-design features):** Given `design/<active_feature>.md` does NOT exist, or the file's `## Mode` is `no-design`, when any transition fires, then `SCOPE_DECISION_REQUIRED` MUST NOT be emitted.

**AC-6 (no false positives — non-build transitions):** Given the transition target is NOT `architect:In_Progress` or `sr-engineer:In_Progress`, then `SCOPE_DECISION_REQUIRED` MUST NOT be emitted regardless of design-file presence.

**AC-7 (schema migration):** A handoff v3 → v4 migration registers in `schema/migrations-handoff.ts`; `CURRENT_VERSIONS.handoff` is bumped to 4 in `schema/versions.ts`. Existing v3 files are read and upgraded lazily on first read (no field added if absent → defaults to undefined / not-set).

**AC-8 (transitions.ts union):** `SCOPE_DECISION_REQUIRED` is added to the `TransitionRejection["error"]` union in `tools/transitions.ts` with a comment stating it is handler-side only (like `VISUAL_BASELINES_REQUIRED`), so the type narrowing in the handler remains correct.

**AC-9 (constitution + skill docs):** `content/constitution.md` §3 (or a new §3.x) documents the new gate. `content/skill-pm.md` SOP step 2a (or a new step after the Visual State-Count Split) documents recording `scope_decision: single-feature` vs creating `.current/feature-split.md`.

**AC-10 (QA tests):** At minimum: (a) gate fires when design present + no artifacts, (b) gate passes when `.current/feature-split.md` present, (c) gate passes when `scope_decision: single-feature` in handoff, (d) gate does NOT fire for non-design feature, (e) gate does NOT fire for non-build transition target, (f) schema v3 → v4 migrate-on-read, (g) v5 future-version refuse-loud.

---

## Copy / Strings

| string id | exact text | source |
|-----------|-----------|--------|
| SCOPE_DECISION_REQUIRED hint | `Scope decision missing. Either: (a) create .current/feature-split.md documenting the multi-feature split decision, or (b) set scope_decision: single-feature in this tw_update_state call with a why field explaining why this feature is appropriately scoped. Gate only fires when design/<feature>.md declares mode != no-design. See specs/server-scope-decision-gate.md.` | authored-here — no Figma/PRD; this is a server error message for developers |
| SCOPE_DECISION_REQUIRED error code token | `SCOPE_DECISION_REQUIRED` | authored-here — mirrors naming convention of VISUAL_BASELINES_REQUIRED |

---

## Visual Tokens

N/A — this feature introduces no UI surfaces; it is a server-side state-machine enforcement point.

---

## Visual Widgets

N/A | — | feature has no non-primitive widgets

---

## Visual Structural Assertions

N/A — no visual surfaces. Design mode for this feature is `no-design`.

---

## Out of Scope

- **Does not close all of A0.** This gate fires ONLY at `tw_update_state` transition time. It cannot stop work that bypasses the coordinator entirely or runs fully in-context (lite mode, researcher inline) — those paths emit no transition call, so no server-side hook fires. Do NOT claim this gate closes all of A0; it closes only the "entered build via the routing chain without a recorded scope decision" half.
- **Does not judge size.** The server has no ability to measure "oversized" — that is an LLM judgment over PRD/Figma content. A human or coordinator can attest `scope_decision: single-feature` wrongly. This gate enforces only that a decision was *recorded*, not that it was *correct*.
- **Does not add a `scope_decision: multi-feature` field.** The presence of `.current/feature-split.md` is the multi-feature signal; no additional handoff field is required.
- **Does not change the PASS gate.** The new check fires only on transitions INTO build roles (`architect:In_Progress`, `sr-engineer:In_Progress`) from a `pm:In_Progress` predecessor, not at PASS time.
- **Does not affect lite-mode or researcher-direct paths.** The check is in the `tw_update_state` handler, which is not invoked by in-context work.
- **Does not validate `.current/feature-split.md` content.** The gate checks existence only, analogous to how `VISUAL_BASELINES_REQUIRED` checks for the presence of a `## Visual Baselines` H2, not its content quality.

---

## Dependencies / Prerequisites

### Self-arming trigger condition

The gate arms when BOTH of the following are true at transition time:

1. `design/<active_feature>.md` exists on the filesystem (same file the visual gate reads).
2. The file's `## Mode` line is NOT `no-design` (same `parseDesignMode` helper used by `hasDesignModeRequiringVisual` in `tools/evidence-file.ts`).

This is identical to the visual gate's arm condition — no new file scanning logic is required.

### Satisfying artifacts (either one clears the gate)

**(a) `.current/feature-split.md` exists** — records a multi-feature split decision. The coordinator or PM creates this file when asking the human to split. No content schema enforced by the server (existence only).

**(b) Handoff field `scope_decision: single-feature` present** — a new optional YAML field added to handoff schema v4. The PM records this when attesting the feature is appropriately scoped as-is. Recommended to also supply a `scope_decision_why` field (free text), but not validated by the server. The field defaults to absent on v3 handoffs; migration v3 → v4 is a pure no-op additive step (adds no default; field is optional).

### Schema version impact

- `handoff` schema: v3 → v4. Migration step: additive no-op (new optional field; no default required). Touch exactly two places per `docs/schema-versions.md`: (1) register step in `schema/migrations-handoff.ts`, (2) bump `CURRENT_VERSIONS.handoff` to 4 in `schema/versions.ts`.
- `tasks`, `sqlite`, `config` schemas: unchanged.

### External reference classification (Resource Audit Gate — Constitution §7)

The only external reference in the requirement documents is:

| ref | location | classification |
|-----|----------|---------------|
| `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md` | Requirement prompt (finding A0), retro §2.A | **ignore** — already in-repo; no fetch needed. Content consumed directly in this spec. |

No HTTP/Figma/Azure DevOps/Jira URLs present in the requirement documents.

### Implementation location

- **Transition check hook:** in `index.ts` `tw_update_state` handler, immediately after `validateTransition` returns null (accepted), before the evidence gate. Mirrors how the visual arm-check is in the handler, not in `validateTransition` itself.
- **Arm-check helper:** reuse `hasDesignModeRequiringVisual` from `tools/evidence-file.ts` (already exported).
- **Split-file check helper:** new exported function `hasScopeDecision(workspacePath, activeFeature, handoffState)` in `tools/evidence-file.ts` — checks `fs.existsSync(path.join(workspacePath, '.current/feature-split.md'))` OR `handoffState.scope_decision === 'single-feature'`.
- **Architecture change complexity:** 3 modules touched (`tools/transitions.ts`, `tools/evidence-file.ts`, `index.ts`) + schema migration (`schema/migrations-handoff.ts`, `schema/versions.ts`) + documentation (`content/constitution.md`, `content/skill-pm.md`). Routing: **architect first** (new schema field + cross-module contract), then sr-engineer impl.

---

## Task List

See bootstrapped tasks below in `tasks.md` (section `server-scope-decision-gate`).
