# CLAUDE.md — agent-governance-mcp

This file is auto-loaded by Claude Code when working **inside this repo**. It
describes the project itself (an MCP server). The *rules of conduct* enforced
by this server live in `content/const-*.md` (15 ordered fragments, composed by dispatch mode per `prompts/constitution-manifest.ts`), the `content/coord-*.md`
fragments (coordinator SOP), and the `content/skill-*.md` files. They are loaded
into a workspace by invoking one of the 11 registered role prompts (`teamwork`,
`teamwork-lite`, `pm`, `architect`, `researcher`, `design-auditor`,
`sr-engineer`, `code-reviewer`, `qa-engineer`, `doc-writer`,
`release-engineer`) or, if you opt in, the SessionStart hook.

This repo is both the server's own source **and** a managed workspace — it
dogfoods itself (`.current/handoff.md` and `tasks.md` exist at the root), so the
Pre-Flight Protocol below applies to work done here.

## What this repo is

A Model Context Protocol (MCP) server that gives multiple AI clients
(Claude Code, Cursor, Continue, Anti-Gravity, Gemini Code, etc.) a shared
view of project state and a single source of truth for governance rules,
so cross-IDE / cross-session work doesn't drift. Methodology-agnostic —
no specific project-management framework assumed.

Three layers of defense. `index.ts` is only ~300 lines of wiring — it iterates
`TOOL_REGISTRY` / `PROMPT_REGISTRY` from `tools/registry.ts`, resolves the
workspace path, and picks a transport. The layers themselves live elsewhere:

1. **Prompts** — thin wrappers around `prompts/build.ts`, which assembles
   the constitution via additive composition (see below) + the role SOP + live
   handoff state. The bundle is context-frugal: `build.ts` composes constitution fragments
   per dispatch mode (lite vs chain, design-armed vs non-design), then applies text-transform passes
   (`stripOriginTags` always, `stripRationale` for non-`fullDetail`) for size efficiency.
   Eleven prompts are registered. `teamwork` serves the full Coordinator
   (`prompts/coordinator.ts` + the `content/coord-01..07-*.md` fragments composed
   per `prompts/skill-manifest.ts`); `teamwork-lite` serves the solo-dev
   lite mode (`prompts/coordinator-lite.ts` +
   `content/skill-coordinator-lite.md`, v3.6.0+) — server-read-only by
   design, no `agent_id` in the routing chain; the other nine
   (`pm`, `architect`, `researcher`, `design-auditor`, `sr-engineer`,
   `code-reviewer`, `qa-engineer`, `doc-writer`, `release-engineer`) use
   matching `content/skill-<role>.md` file names.
2. **Tools** — twelve `tw_*` tools, each one entry in `tools/registry.ts`, that
   read/write `.current/handoff.md`, `tasks.md`, and (in HTTP/SQLite mode)
   PRD-derived RAG chunks in target workspaces. `tw_update_state` / `tw_get_state`
   are implemented in `tools/handoff-orchestrator.ts`.
3. **Guards + gates** (`guards/{session,file-lock}.ts`) — pre-flight check, file
   lock, mtime freshness check; then the 18-step `UPDATE_STATE_GATE_PIPELINE`
   (`tools/handoff-orchestrator.ts`) whose predicates live in `gates/` and whose
   metadata is declared once per gate in `gates/registry.ts` (32 entries).

All four persisted artifacts (`handoff.md`, `tasks.md`, the SQLite DB,
`.config.json`) carry a `schema_version`; older files are lazily migrated
on first read. See `docs/schema-versions.md` for how to ship a new version.

## Layout

```
index.ts                  MCP server entry (~300 lines): iterates the registries,
                          resolves workspace path, picks stdio vs HTTP transport
tools/registry.ts         TOOL_REGISTRY + PROMPT_REGISTRY — ADD NEW TOOLS HERE
tools/handoff-orchestrator.ts  tw_update_state / tw_get_state + the 18-step
                          UPDATE_STATE_GATE_PIPELINE (the write path)
tools/handoff.ts          read/write .current/handoff.md (uses js-yaml)
tools/handoff-parse.ts    handoff YAML/markdown parsing (E36 split)
tools/handoff-write.ts    handoff serialize + atomic publish (E36 split)
tools/handoff-types.ts    HandoffState shape + per-field semantics (E36 split)
tools/tasks.ts            thin delegator — routes task ops through getActiveStorage()
tools/tasks-file.ts       file-based task operations (markdown checkbox parsing)
tools/sync.ts             tw_sync — ledger → tasks.md reconcile (R10)
tools/drift.ts            compare handoff vs tasks for inconsistencies + drift compression
tools/role.ts             tw_switch_role — loads role SOP text
tools/skill-frontmatter.ts  parses recommended_model out of role SOP frontmatter
tools/storage.ts          HandoffStorage interface + getActiveStorage()/setActiveStorage()
tools/storage-sqlite.ts   SQLite implementation of HandoffStorage (HTTP mode)
tools/config.ts           .current/.config.json loader (taskPattern, taskPaths)
tools/transitions.ts      ALLOWED_TRANSITIONS + round caps (ROUND_CAP=4,
                          REVIEW_ROUND_CAP=4, VISUAL_ROUND_CAP=6)
tools/exemptions.ts       per-gate exemption resolution (E24)
tools/evidence-file.ts    file-mode QA evidence write/check (v3.2.0)
tools/stale-notify.ts     stale in-flight dispatch advisory (E22)
tools/telemetry.ts        gate-fire telemetry sidecar writer
tools/metrics.ts          metrics record aggregation
tools/gate-stats.ts       tw_gate_stats — telemetry/metrics sidecar aggregation for the E6 retro (E26)
tools/usage-accounting.ts .current/usage.jsonl token sidecar reader (D2)
tools/rag.ts              PRD chunking + embeddings (SQLite mode, v3.3.0)
tools/rag-coalesce.ts     shared _indexingInFlight registry (v3.3.0)
gates/registry.ts         GATE_REGISTRY — 32 gate definitions (code, owner, exemptions)
gates/pipeline.ts         runUpdateStatePipeline() step runner
gates/*.ts                one module per gate predicate (cut-approval, scope-decision,
                          feature-lease, external-refs, code-review, qa-review,
                          evidence-schema, visual, expected-red, ac-execution,
                          stamp-provenance, lease-override)
schema/versions.ts        schema_version constants + migration registries (v3.4.0)
schema/migrations-*.ts    handoff / tasks / sqlite / config migration runners (v3.4.0)
guards/session.ts         per-(process,workspace) snapshot of "agent read state"
guards/file-lock.ts       cross-process O_EXCL lock with stale-PID detection
transport/http.ts         Streamable HTTP transport + auth / origin guard
lib/                      small shared helpers (watermark check, tsconfig source dirs)
prompts/build.ts          shared buildPromptForRole() — assembles constitution via composeConstitution() then applies stripOriginTags / stripRationale per mode
prompts/constitution-manifest.ts  ordered segment registry (CONSTITUTION_SEGMENTS + includeSegment predicate); replaces subtractive strip model (v3.44.0+)
prompts/skill-manifest.ts ordered coordinator SOP segments (coord-*.md), host-tagged
prompts/partials-manifest.ts  shared prompt partials (content/partial-*.md)
prompts/coordinator.ts       coordinator role (prompt id is "teamwork" for backwards compat)
prompts/coordinator-lite.ts  coordinator-lite role (prompt id "teamwork-lite", v3.6.0)
prompts/{pm,architect,researcher,design-auditor,sr-engineer,code-reviewer,
         qa-engineer,doc-writer,release-engineer}.ts   the other nine role prompts
bin/agc-init.mjs          `agc init` / `agc check` — workspace scaffold + adapter stamps
bin/agent-governance-context.mjs  SessionStart hook helper (emits additionalContext; imports manifest for composition)
bin/agent-governance-usage-hook.mjs  PostToolUse token-usage sidecar hook (opt-in)
content/const-*.md (15 fragments)  the rules agents must follow, composed by dispatch mode; see prompts/constitution-manifest.ts for fragment order/tags
content/constitution-rationale.md  non-normative "why" behind §1/§3.1/§3.2/§5/§7 (one-way refs into constitution; v3.32.0)
content/coord-01..07-*.md  coordinator SOP, 7 fragments (there is NO skill-coordinator.md)
content/skill-coordinator-lite.md  solo-dev lite-mode SOP (v3.6.0)
content/skill-*.md        the other 10 role SOPs, one file per role
templates/agent-adapters/     CLAUDE.md / AGENTS.md / .antigravityrules stubs for `agc init`
templates/claude-code-agents/ 12 model-pinned Claude Code subagent templates
specs/                    design docs (qa-flow, rag-lifecycle, schema-versioning, etc.)
docs/schema-versions.md   how to ship a new schema version (v3.4.0)
docs/backlog.md           the PRD / backlog (prd_path in handoff state)
scripts/check-version.mjs verify package.json version matches index.ts Server() literal
test/                     87 test files (node --test); test/eval/ = behavioural eval harness
dist/                     compiled output (committed for npx remote usage)
```

## Dev workflow when editing this repo

- `npm run build` — `tsc` to `dist/`. Required before commit because `dist/`
  is shipped (used by `bin` entry for `npx github:...` consumers).
- Adding a new tool or prompt is **one entry** in `tools/registry.ts`
  (`TOOL_REGISTRY` / `PROMPT_REGISTRY`) — `index.ts` iterates the registries, so
  there is no separate JSON Schema literal, zod const, and dispatcher case to
  keep in sync any more. Use `defineTool({ name, description, inputSchema,
  zodSchema, handler })`; implement the handler in `tools/`. Keep
  `tools/registry.ts` under `tools/` — `test/error-code-contract.test.mjs`
  globs that directory.
- Adding a gate: declare it in `gates/registry.ts` (`GATE_REGISTRY`), implement
  the predicate in `gates/`, and insert the step into
  `UPDATE_STATE_GATE_PIPELINE` in `tools/handoff-orchestrator.ts`. Step order is
  asserted by `test/e35-pipeline-order.test.mjs`.
- `agc check` must exit 0 before release — it compares the `agc-version` stamps
  in `CLAUDE.md`, `AGENTS.md`, and `.antigravityrules` against the installed
  version. Bump all three in the release commit.
- Mutating tools (`writeHandoffState`, `completeTask`, `rollbackTask`) MUST:
  1. acquire `withFileLock` on a sibling `.lock` path,
  2. call `verifyFreshness` against the session snapshot,
  3. write via tmp file + `fs.renameSync` (atomic publish),
  4. call `refreshSnapshotFor` so subsequent same-session writes don't trip.
- The pre-flight check (`enforcePreFlight`) is in-memory per-process. The
  freshness check + file lock are what give cross-process safety.

## Testing changes

`test/` holds 87 test files covering guards, transitions and round caps, every
gate in `GATE_REGISTRY`, drift and sync, schema migrations, prompt composition
and context budget, the agc adapters, and RAG. Run with:

```bash
npm test          # prebuild + node --test test/*.test.mjs  (1633/1633 at v3.94.0)
npm run eval      # separate behavioural eval harness (test/eval/)
```

Additional smoke-test patterns:

```bash
# Boot test
node -e "..."  # spawn dist/index.js, send initialize, expect "online" on stderr

# YAML round-trip (catches handoff parsing regressions)
node --input-type=module -e "import { writeHandoffState, parseHandoff } from './dist/tools/handoff.js'; ..."
```

## What this server does NOT do

- It does NOT force agents to follow the constitution — it only puts the
  constitution into context. An agent that ignores tool calls cannot be
  stopped from editing `.current/handoff.md` directly. (But `tw_detect_drift`
  will surface the inconsistency on the next session.)
- It is NOT cross-machine. The file lock is local-fs only.
- It does NOT touch git. Commit/PR workflow is out of scope.

## Governance context loading (invocation-scoped since 2026-07-15; SessionStart hook is opt-in)

Governance context is **invocation-scoped**: the `/teamwork` prompt loads the
full coordinator, the `teamwork-lite` prompt loads lite. You pay the context
cost exactly when you opt into a mode, and only one mode declaration ever
exists per session.

The SessionStart hook (`bin/agent-governance-context.mjs`) is **opt-in and no
longer registered by default** (backlog E19, human decision 2026-07-15). It
auto-injects the constitution + coordinator-lite skill (~18.7KB) into every
session in a workspace with `.current/`, `tasks.md`, or `TODO.md` — including
sessions that never touch governed state — and, when a `/teamwork` follows,
leaves two contradictory mode declarations in one context. Users who prefer
auto-arming can still register it per `docs/install.md`; never register it in
more than one settings file (a global + project-local double registration
double-fires, injecting the block twice).

**This repo dogfoods its own server.** `.current/handoff.md` and `tasks.md`
exist at the root, so this is a managed workspace like any other. Agents
working on the server itself follow the constitution and route through tw_*
tools — that's how we catch regressions in our own governance rules before
users hit them.

Override `TEAMWORK_SERVER_ROOT` env var if you move this checkout
(legacy `SDD_SERVER_ROOT` is still honored as a fallback).

## Pre-Flight Protocol (the one rule that matters in managed workspaces)

The agent's first action in any agent-governance-managed workspace — including this
one — must be `tw_get_state`. Without it, `tw_update_state`, `tw_complete_task`,
`tw_rollback_task`, and `tw_add_task` will be blocked by the guard. This is
enforced server-side; you cannot bypass it from the client.

<!-- BEGIN agc-adapter -->
<!-- agc-version: 3.99.0 -->
<!-- Generated by agc init. Re-run agc init to refresh this block; edit outside the markers freely. -->

## Agent Governance (agent-governance-mcp)

This project is managed by agent-governance-mcp. Before acting:
- Follow all rules in the constitution (MCP server: agent-governance-mcp).

## Execution Profile — Claude Code

- Subagent dispatch: available (`Task` tool). Use it for role switching when context budget permits.
- Watermark: required on every reply per Constitution §1 (format: `— @<role> (<model-tier>)`).
- Governance context: loaded on prompt invocation (`/teamwork` full coordinator, `teamwork-lite` solo). The SessionStart hook is opt-in (see docs/install.md) — if registered, it auto-injects constitution context when `.current/` or `tasks.md` is present; register it in at most ONE settings file.
<!-- END agc-adapter -->
