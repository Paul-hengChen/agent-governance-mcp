# Contributing

This repo is itself an agent-governance-managed workspace — it dogfoods its own server. `.current/handoff.md` and `tasks.md` exist at the root, and the SessionStart hook fires here the same as in any other managed workspace. Run the constitution against your own changes; the governance regressions you catch are the ones users would have hit.

---

## Dev workflow

```bash
git clone https://github.com/Paul-hengChen/agent-governance-mcp
cd agent-governance-mcp
npm install
npm run build   # tsc → dist/. REQUIRED before commit (dist/ is shipped for npx)
npm test        # 439/439 at last release
```

- All tool args are validated by `zod` in `index.ts`. Adding a tool means: register in `ListToolsRequestSchema`, add zod schema, add case in `CallToolRequestSchema`, implement in `tools/`.
- `dist/` is committed. `scripts/check-version.mjs` verifies `package.json` matches the `Server()` literal in `index.ts`.
- `npm audit --audit-level=high` at the build gate — high/critical advisories block release.

---

## Project layout

```
index.ts                  # MCP server entry: prompts, tools, dispatcher
tools/                    # tw_* tool implementations
  handoff.ts              #   read/write .current/handoff.md (uses js-yaml)
  tasks.ts                #   thin delegator → getActiveStorage()
  tasks-file.ts           #   markdown checkbox backend
  drift.ts                #   tw_detect_drift + drift compression
  role.ts                 #   tw_switch_role
  storage.ts              #   HandoffStorage interface
  storage-sqlite.ts       #   SQLite adapter (HTTP mode)
  config.ts               #   .current/.config.json loader
  transitions.ts          #   ALLOWED_TRANSITIONS state machine
  evidence-file.ts        #   QA evidence write/check
  rag.ts                  #   PRD chunking + embeddings (SQLite mode)
  rag-coalesce.ts         #   shared _indexingInFlight registry
schema/                   # schema_version constants + migration runners
  versions.ts             #   current versions + registries
  migrations-*.ts         #   lazy migrate-on-read
transport/                # HTTP transport (Streamable HTTP + auth/origin guard)
guards/
  session.ts              #   per-(process,workspace) read snapshot (pre-flight)
  file-lock.ts            #   cross-process O_EXCL lock + stale-PID detection
prompts/                  # shared build.ts + role-specific files
  build.ts                #   buildPromptForRole() — all role prompts call this
  coordinator.ts          #   prompt id "teamwork"
  coordinator-lite.ts     #   prompt id "teamwork-lite"
  {pm,architect,researcher,sr-engineer,qa-engineer,...}.ts
content/
  constitution.md         #   the rules — source of truth
  skill-*.md              #   per-role SOPs
bin/agent-governance-context.mjs  # SessionStart hook helper
test/                     # unit + integration tests (node --test)
dist/                     # compiled JS (committed for npx remote usage)
specs/                    # design docs (qa-flow, rag-lifecycle, schema-versioning, …)
docs/                     # user-facing docs
research/                 # research reports
```

---

## Three layers, where each lives

1. **Prompts** — thin wrappers around `prompts/build.ts`, which bundles `content/constitution.md` + `content/skill-<role>.md` + live handoff state.
2. **Tools** — ten `tw_*` tools in `tools/` that read/write `.current/handoff.md`, `tasks.md`, and (HTTP/SQLite mode) PRD-derived RAG chunks.
3. **Guards** — `guards/session.ts` (pre-flight check) and `guards/file-lock.ts` (O_EXCL lock + mtime freshness).

Mutating tools (`writeHandoffState`, `completeTask`, `rollbackTask`) MUST:
1. Acquire `withFileLock` on a sibling `.lock` path.
2. Call `verifyFreshness` against the session snapshot.
3. Write via tmp file + `fs.renameSync` (atomic publish).
4. Call `refreshSnapshotFor` so subsequent same-session writes don't trip.

The pre-flight check (`enforcePreFlight`) is in-memory per-process. The freshness check + file lock are what give cross-process safety.

---

## Schema versions

All four persisted artifacts (`handoff.md`, `tasks.md`, the SQLite DB, `.config.json`) carry a `schema_version`. Older files are lazily migrated on first read.

Shipping a new schema version: see [docs/schema-versions.md](docs/schema-versions.md) for the upgrade-authoring checklist.

---

## Testing

```bash
npm test          # prebuild + node --test test/*.test.mjs
```

Smoke-test patterns:

```bash
# Boot test
node -e "..."  # spawn dist/index.js, send initialize, expect "online" on stderr

# YAML round-trip (catches handoff parsing regressions)
node --input-type=module -e "import { writeHandoffState, parseHandoff } from './dist/tools/handoff.js'; ..."
```

`test/` covers session, file-lock, handoff, tasks, transitions, RAG, schema versioning. New behaviour needs a test; bug fixes need a regression test.

---

## What this server does NOT do

- It does NOT force agents to follow the constitution — only puts it in context. An agent ignoring tool calls cannot be stopped from editing `.current/handoff.md` directly. `tw_detect_drift` surfaces this on the next session.
- It is NOT cross-machine. The file lock is local-fs only.
- It does NOT touch git. Commit/PR workflow is out of scope.

---

## Pre-Flight Protocol (the one rule that matters)

Working in any agent-governance-managed workspace — including this repo — the agent's first action MUST be `tw_get_state`. Without it, `tw_update_state`, `tw_complete_task`, `tw_rollback_task`, and `tw_add_task` are blocked server-side. This is enforced; you cannot bypass it from the client.
