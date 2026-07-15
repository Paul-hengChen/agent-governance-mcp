# CLAUDE.md — agent-governance-mcp

This file is auto-loaded by Claude Code when working **inside this repo**. It
describes the project itself (an MCP server). The *rules of conduct* enforced
by this server live in `content/const-*.md` (15 ordered fragments, composed by dispatch mode per `prompts/constitution-manifest.ts`) and the `content/skill-*.md` files;
those are loaded into other workspaces via role prompts (`teamwork` for the
Coordinator role, plus `sr-engineer`, `pm`, `architect`, `researcher`,
`qa-engineer`) or the SessionStart hook — not into this one. This repo is the
server's own source, not an agent-governance-managed workspace.

## What this repo is

A Model Context Protocol (MCP) server that gives multiple AI clients
(Claude Code, Cursor, Continue, Anti-Gravity, Gemini Code, etc.) a shared
view of project state and a single source of truth for governance rules,
so cross-IDE / cross-session work doesn't drift. Methodology-agnostic —
no specific project-management framework assumed.

Three layers of defense, all in `index.ts`:

1. **Prompts** — thin wrappers around `prompts/build.ts`, which assembles
   the constitution via additive composition (see below) + role-specific `content/skill-*.md` + live
   handoff state. The bundle is context-frugal: `build.ts` composes constitution fragments
   per dispatch mode (lite vs chain, design-armed vs non-design), then applies text-transform passes
   (`stripOriginTags` always, `stripRationale` for non-`fullDetail`) for size efficiency. Seven prompts are registered: `teamwork` serves the
   full Coordinator (`prompts/coordinator.ts` +
   `content/skill-coordinator.md`); `teamwork-lite` serves the solo-dev
   lite mode (`prompts/coordinator-lite.ts` +
   `content/skill-coordinator-lite.md`, v3.6.0+) — server-read-only by
   design, no `agent_id` in the routing chain; the other five
   (`sr-engineer`, `pm`, `architect`, `researcher`, `qa-engineer`) use
   matching file names.
2. **Tools** (`tools/{handoff,tasks,tasks-file,drift,role,storage,storage-sqlite,config,transitions,evidence-file,rag,rag-coalesce}.ts`) — eleven `tw_*` tools that
   read/write `.current/handoff.md`, `tasks.md`, and (in HTTP/SQLite mode)
   PRD-derived RAG chunks in target workspaces.
3. **Guards** (`guards/{session,file-lock}.ts`) — pre-flight check, file
   lock, mtime freshness check.

All four persisted artifacts (`handoff.md`, `tasks.md`, the SQLite DB,
`.config.json`) carry a `schema_version`; older files are lazily migrated
on first read. See `docs/schema-versions.md` for how to ship a new version.

## Layout

```
index.ts                  MCP server entry: registers prompts, tools, dispatcher
tools/handoff.ts          read/write .current/handoff.md (uses js-yaml)
tools/tasks.ts            thin delegator — routes task ops through getActiveStorage()
tools/tasks-file.ts       file-based task operations (markdown checkbox parsing)
tools/drift.ts            compare handoff vs tasks for inconsistencies + drift compression
tools/role.ts             tw_switch_role — loads role SOP text
tools/storage.ts          HandoffStorage interface + getActiveStorage()/setActiveStorage()
tools/storage-sqlite.ts   SQLite implementation of HandoffStorage (HTTP mode)
tools/config.ts           .current/.config.json loader (taskPattern, taskPaths)
tools/transitions.ts      ALLOWED_TRANSITIONS state machine (v3.2.0)
tools/evidence-file.ts    file-mode QA evidence write/check (v3.2.0)
tools/rag.ts              PRD chunking + embeddings (SQLite mode, v3.3.0)
tools/rag-coalesce.ts     shared _indexingInFlight registry (v3.3.0)
schema/versions.ts        schema_version constants + migration registries (v3.4.0)
schema/migrations-*.ts    handoff / tasks / sqlite / config migration runners (v3.4.0)
guards/session.ts         per-(process,workspace) snapshot of "agent read state"
guards/file-lock.ts       cross-process O_EXCL lock with stale-PID detection
prompts/build.ts          shared buildPromptForRole() — assembles constitution via composeConstitution() then applies stripOriginTags / stripRationale per mode
prompts/constitution-manifest.ts  ordered segment registry (CONSTITUTION_SEGMENTS + includeSegment predicate); replaces subtractive strip model (v3.44.0+)
prompts/coordinator.ts       coordinator role (prompt id is "teamwork" for backwards compat)
prompts/coordinator-lite.ts  coordinator-lite role (prompt id "teamwork-lite", v3.6.0)
prompts/sr-engineer.ts    sr-engineer role prompt
prompts/pm.ts             pm role prompt
prompts/architect.ts      architect role prompt
prompts/researcher.ts     researcher role prompt
prompts/qa-engineer.ts    qa-engineer role prompt
bin/agent-governance-context.mjs  SessionStart hook helper (emits additionalContext; imports manifest for composition)
content/const-*.md (15 fragments)  the rules agents must follow, composed by dispatch mode; see prompts/constitution-manifest.ts for fragment order/tags
content/constitution-rationale.md  non-normative "why" behind §1/§3.1/§3.2/§5/§7 (one-way refs into constitution; v3.32.0)
content/skill-coordinator.md  default coordinator SOP (loaded by SessionStart hook)
content/skill-coordinator-lite.md  solo-dev lite-mode SOP (v3.6.0)
content/skill-sr-engineer.md  sr-engineer SOP
content/skill-pm.md           pm SOP
content/skill-architect.md    architect SOP
content/skill-researcher.md   researcher SOP
content/skill-qa-engineer.md  qa-engineer SOP
specs/                    design docs (qa-flow, rag-lifecycle, schema-versioning, etc.)
docs/schema-versions.md   how to ship a new schema version (v3.4.0)
scripts/check-version.mjs verify package.json version matches index.ts Server() literal
test/                     unit & integration tests (session, file-lock, handoff, tasks)
dist/                     compiled output (committed for npx remote usage)
```

## Dev workflow when editing this repo

- `npm run build` — `tsc` to `dist/`. Required before commit because `dist/`
  is shipped (used by `bin` entry for `npx github:...` consumers).
- All tool args are validated by `zod` schemas in `index.ts`. Adding a new
  tool means: register in `ListToolsRequestSchema`, add zod schema, add
  case in `CallToolRequestSchema`, implement in `tools/`.
- Mutating tools (`writeHandoffState`, `completeTask`, `rollbackTask`) MUST:
  1. acquire `withFileLock` on a sibling `.lock` path,
  2. call `verifyFreshness` against the session snapshot,
  3. write via tmp file + `fs.renameSync` (atomic publish),
  4. call `refreshSnapshotFor` so subsequent same-session writes don't trip.
- The pre-flight check (`enforcePreFlight`) is in-memory per-process. The
  freshness check + file lock are what give cross-process safety.

## Testing changes

A test suite lives in `test/` (session, file-lock, handoff, tasks). Run with:

```bash
npm test          # prebuild + node --test test/*.test.mjs
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
<!-- agc-version: 3.42.0 -->
<!-- Generated by agc init. Re-run agc init to refresh this block; edit outside the markers freely. -->

## Agent Governance (agent-governance-mcp)

This project is managed by agent-governance-mcp. Before acting:
- Follow all rules in the constitution (MCP server: agent-governance-mcp).

## Execution Profile — Claude Code

- Subagent dispatch: available (`Task` tool). Use it for role switching when context budget permits.
- Watermark: required on every reply per Constitution §1 (format: `— @<role> (<model-tier>)`).
- Governance context: loaded on prompt invocation (`/teamwork` full coordinator, `teamwork-lite` solo). The SessionStart hook is opt-in (see docs/install.md) — if registered, it auto-injects constitution context when `.current/` or `tasks.md` is present; register it in at most ONE settings file.
<!-- END agc-adapter -->
