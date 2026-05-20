# Spec: Lite Mode Coordinator (`/teamwork-lite`)

## Problem Statement

The post-fusion architecture audit ([research/value-assessment.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/value-assessment.md)) identified the multi-role chain (~15K tokens/task) as net overhead for solo-dev daily work where most tasks are 1-file edits, doc tweaks, or single-fix bugs. The proposed remedy is a parallel entry point that loads a lighter coordinator skill, skips drift checks, and direct-executes without routing — targeting ~3K tokens/task. This MVP introduces only the new entry point (`/teamwork-lite` prompt + skill). The existing 6 prompts and server-enforced chain remain unchanged; users opt into lite mode by choosing the new prompt.

## User Stories

- As a solo developer doing daily small edits, I want a `/teamwork-lite` prompt so that I get state-sync persistence without paying the multi-role chain's token cost.
- As a current user, I want my existing `/teamwork` and other role prompts to keep working unchanged so that switching is opt-in, not forced.
- As a maintainer, I want lite mode to share the existing constitution and storage layer so that I don't fork a second source of truth.

## Acceptance Criteria

### AC1: New skill file `content/skill-coordinator-lite.md` exists
- **Given** the repo
- **When** inspected
- **Then** `content/skill-coordinator-lite.md` exists with sections: Persona, Output rule, SOP — and the SOP explicitly states: (a) skip `tw_detect_drift` unless user asks; (b) do NOT call `tw_switch_role`; (c) execute directly regardless of trigger phrases; (d) `tw_get_state` still required before any state-modifying tool (server-enforced).

### AC2: New prompt wrapper `prompts/coordinator-lite.ts`
- **Given** the repo
- **When** inspected
- **Then** `prompts/coordinator-lite.ts` exists and exports `buildCoordinatorLitePrompt(workspacePath: string): PromptResult`, calling `buildPromptForRole("skill-coordinator-lite.md", <description>, workspacePath)`.

### AC3: `index.ts` registers `teamwork-lite` prompt
- **Given** an MCP client lists prompts
- **When** the server responds to `ListPromptsRequestSchema`
- **Then** the response includes `name: "teamwork-lite"` with the same `workspace_path` argument schema as the other prompts; and `GetPromptRequestSchema` dispatches `"teamwork-lite"` → `buildCoordinatorLitePrompt`.

### AC4: Lite mode skips RAG spec injection
- **Given** `RAG_SKIP_ROLES` in `prompts/build.ts`
- **When** inspected
- **Then** `"teamwork-lite"` is added to the set alongside `"teamwork"` — lite triage doesn't need PRD chunks.

### AC5: Build + tests pass
- **Given** the change
- **When** `npm run build` and `npm test` run
- **Then** zero TypeScript errors and all existing tests still pass; no test must be skipped.

### AC6: README documents the new entry point
- **Given** `README.md`
- **When** inspected
- **Then** a brief section (≤ 10 lines) introduces `/teamwork-lite` with: when to use, what it skips, install command unchanged. Place it adjacent to or under the existing prompts documentation.

## Out of Scope

- Stripping or forking the constitution into a "lite" variant — the full constitution still loads (single source of truth preserved).
- Making the multi-role chain or QA enforcement opt-in — separate v3.6+ effort; lite mode just sidesteps them.
- Auto-detection / coordinator-decides-lite-vs-full — user explicitly selected the "new prompt" form factor over auto-detect (open question #1 resolved).
- Schema versioning simplification.
- Token-usage measurement / budget tooling.
- Release/version bump in this task (handled separately as v3.6.0 once the lite-mode work is verified).

## Dependencies / Prerequisites

- Existing prompt infrastructure: [prompts/build.ts](file:///Users/paul.ph.chen/agent-governance-mcp/prompts/build.ts) (`buildPromptForRole`, `RAG_SKIP_ROLES`, `appendSpecContext`).
- Existing constitution: [content/constitution.md](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md) at v3.5.2 — loaded as-is.
- Audit source: [research/value-assessment.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/value-assessment.md).
