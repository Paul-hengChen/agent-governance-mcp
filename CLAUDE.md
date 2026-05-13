# CLAUDE.md — teamwork-mcp-server

This file is auto-loaded by Claude Code when working **inside this repo**. It
describes the project itself (an MCP server). The *rules of conduct* enforced
by this server live in `content/constitution.md` and the `content/skill-*.md` files;
those are loaded into other workspaces via role prompts (`teamwork`, `sr-engineer`,
`pm`, `researcher`, `qa-engineer`) or the SessionStart hook — not into this one. This repo is the server's own source,
not a teamwork-managed workspace.

## What this repo is

A Model Context Protocol (MCP) server that gives multiple AI clients
(Claude Code, Cursor, Continue, Anti-Gravity, Gemini Code, etc.) a shared
view of project state and a single source of truth for governance rules,
so cross-IDE / cross-session work doesn't drift. Methodology-agnostic —
no specific project-management framework assumed.

Three layers of defense, all in `index.ts`:

1. **Prompts** (`prompts/{teamwork,sr-engineer,pm,researcher,qa-engineer}.ts`) — bundle
   `content/constitution.md` + role-specific `content/skill-*.md` + live handoff state.
2. **Tools** (`tools/{handoff,tasks,drift}.ts`) — seven `tw_*` tools that
   read/write `.current/handoff.md` and `tasks.md` in target workspaces.
3. **Guards** (`guards/{session,file-lock}.ts`) — pre-flight check, file
   lock, mtime freshness check.

## Layout

```
index.ts                  MCP server entry: registers prompts, tools, dispatcher
tools/handoff.ts          read/write .current/handoff.md (uses js-yaml)
tools/tasks.ts            complete/rollback tasks in tasks.md
tools/drift.ts            compare handoff vs tasks for inconsistencies
guards/session.ts         per-(process,workspace) snapshot of "agent read state"
guards/file-lock.ts       cross-process O_EXCL lock with stale-PID detection
prompts/teamwork.ts       coordinator prompt (default role on SessionStart)
prompts/sr-engineer.ts    sr-engineer role prompt
prompts/pm.ts             pm role prompt
prompts/researcher.ts     researcher role prompt
prompts/qa-engineer.ts    qa-engineer role prompt
bin/teamwork-context.mjs  SessionStart hook helper (emits additionalContext)
content/constitution.md   the rules agents must follow (source of truth)
content/skill-coordinator.md  default coordinator SOP (loaded by SessionStart hook)
content/skill-sr-engineer.md  sr-engineer SOP
content/skill-pm.md           pm SOP
content/skill-researcher.md   researcher SOP
content/skill-qa-engineer.md  qa-engineer SOP
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

## Auto-injection: SessionStart hook

Configured in `~/.claude/settings.json` to run `bin/teamwork-context.mjs`
on every session start. The script self-gates: it injects the full
constitution/skill/state block only if the workspace has any of `.current/`,
`tasks.md`, or `TODO.md`. In this repo (the server's own source) none of
those exist, so the hook is a silent no-op here — correct behavior.

Override `TEAMWORK_SERVER_ROOT` env var if you move this checkout
(legacy `SDD_SERVER_ROOT` is still honored as a fallback).

## Pre-Flight Protocol (the one rule that matters in managed workspaces)

When working **inside a teamwork-managed workspace** (not this repo), the agent's
first action must always be `tw_get_state`. Without it, `tw_update_state`,
`tw_complete_task`, and `tw_rollback_task` will be blocked by the guard.
This is enforced server-side; you cannot bypass it from the client.
