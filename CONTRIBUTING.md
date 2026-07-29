# Contributing

This repo is itself an agent-governance-managed workspace — it dogfoods its own server. `.current/handoff.md` and `tasks.md` exist at the root, so governance applies here the same as in any other managed workspace. Run the constitution against your own changes; the governance regressions you catch are the ones users would have hit.

Governance context is **invocation-scoped**: invoke the `teamwork` prompt (full coordinator) or `teamwork-lite` (solo mode) and it loads the constitution + role SOP + live state. The SessionStart hook is opt-in and **not registered by default** (human decision 2026-07-15) — see [docs/install.md](docs/install.md) before wiring it.

---

## Dev workflow

```bash
git clone https://github.com/Paul-hengChen/agent-governance-mcp
cd agent-governance-mcp
npm install
npm run build   # tsc → dist/. REQUIRED before commit (dist/ is shipped for npx)
npm test        # 1633/1633 at v3.94.0
```

- **Adding a tool or prompt is ONE entry** in `tools/registry.ts` (`TOOL_REGISTRY` / `PROMPT_REGISTRY`). `index.ts` iterates those registries, so there is no longer a per-tool JSON Schema literal, zod const, and dispatcher case to keep in sync. Use the `defineTool()` helper — it takes `{ name, description, inputSchema, zodSchema, handler }` and wires arg validation for you; implement the handler in `tools/`.
  - `tools/registry.ts` must stay under `tools/` — `test/error-code-contract.test.mjs` globs that directory.
- **Adding a gate**: declare it in `gates/registry.ts` (`GATE_REGISTRY`, 32 entries — error code, owning role, exemptions), implement the predicate under `gates/`, and add the step to `UPDATE_STATE_GATE_PIPELINE` in `tools/handoff-orchestrator.ts`. Step order is asserted by `test/e35-pipeline-order.test.mjs`.
- `dist/` is committed. `scripts/check-version.mjs` verifies `package.json` matches the `Server()` literal in `index.ts`.
- `agc check` must exit 0 — it compares the `agc-version` stamps in `CLAUDE.md`, `AGENTS.md`, and `.antigravityrules` against the installed version. Bump the stamps in the same commit as a release.
- `npm audit --audit-level=high` at the build gate — high/critical advisories block release.

---

## Project layout

```
index.ts                  # MCP server entry (~300 lines): wiring only —
                          #   iterates TOOL_REGISTRY / PROMPT_REGISTRY,
                          #   resolves the workspace path, picks a transport
tools/
  registry.ts             #   TOOL_REGISTRY + PROMPT_REGISTRY — add tools HERE
  handoff-orchestrator.ts #   tw_update_state / tw_get_state + the 18-step
                          #     UPDATE_STATE_GATE_PIPELINE
  handoff.ts              #   read/write .current/handoff.md (uses js-yaml)
  handoff-parse.ts        #   YAML/markdown parsing
  handoff-write.ts        #   serialize + atomic publish
  handoff-types.ts        #   HandoffState shape + field semantics
  tasks.ts                #   thin delegator → getActiveStorage()
  tasks-file.ts           #   markdown checkbox backend
  sync.ts                 #   tw_sync — ledger → tasks.md reconcile (R10)
  drift.ts                #   tw_detect_drift + drift compression
  role.ts                 #   tw_switch_role
  skill-frontmatter.ts    #   parses recommended_model out of role SOPs
  storage.ts              #   HandoffStorage interface
  storage-sqlite.ts       #   SQLite adapter (HTTP mode)
  config.ts               #   .current/.config.json loader
  transitions.ts          #   ALLOWED_TRANSITIONS + round caps
  exemptions.ts           #   per-gate exemption resolution
  evidence-file.ts        #   QA evidence write/check
  stale-notify.ts         #   stale in-flight dispatch advisory
  telemetry.ts            #   gate-fire sidecar writer
  metrics.ts              #   metrics record aggregation
  gate-stats.ts           #   tw_gate_stats
  usage-accounting.ts     #   .current/usage.jsonl token sidecar reader
  rag.ts                  #   PRD chunking + embeddings (SQLite mode)
  rag-coalesce.ts         #   shared _indexingInFlight registry
gates/                    # one module per gate predicate (14 files)
  registry.ts             #   GATE_REGISTRY — 32 gate definitions
  pipeline.ts             #   runUpdateStatePipeline() step runner
  {cut-approval,scope-decision,feature-lease,external-refs,
   code-review,qa-review,evidence-schema,visual,expected-red,
   ac-execution,stamp-provenance,lease-override}.ts
schema/                   # schema_version constants + migration runners
  versions.ts             #   current versions + registries
  migrations-*.ts         #   lazy migrate-on-read
transport/http.ts         # Streamable HTTP + auth/origin guard
guards/
  session.ts              #   per-(process,workspace) read snapshot (pre-flight)
  file-lock.ts            #   cross-process O_EXCL lock + stale-PID detection
lib/                      # small shared helpers (watermark check, tsconfig dirs)
prompts/                  # shared build.ts + role-specific files
  build.ts                #   buildPromptForRole() — all role prompts call this
  constitution-manifest.ts#   ordered const-*.md segments + includeSegment()
  skill-manifest.ts       #   coordinator coord-*.md segments (host-tagged)
  partials-manifest.ts    #   shared prompt partials
  coordinator.ts          #   prompt id "teamwork"
  coordinator-lite.ts     #   prompt id "teamwork-lite"
  {pm,architect,researcher,design-auditor,sr-engineer,
   code-reviewer,qa-engineer,doc-writer,release-engineer}.ts
content/
  const-01..15-*.md       #   the constitution — 15 ordered fragments,
                          #     composed per dispatch mode (no single
                          #     constitution.md exists)
  constitution-rationale.md #  non-normative "why" companion
  coord-01..07-*.md       #   coordinator SOP fragments
  skill-*.md              #   per-role SOPs (11 single-file roles)
bin/                      # agc-init.mjs (agc init/check), SessionStart hook
                          #   helper, PostToolUse usage hook
templates/
  agent-adapters/         #   CLAUDE.md / AGENTS.md / .antigravityrules stubs
  claude-code-agents/     #   12 model-pinned Claude Code subagent templates
test/                     # 87 test files (node --test) + eval/ harness
dist/                     # compiled JS (committed for npx remote usage)
specs/                    # design docs (qa-flow, rag-lifecycle, schema-versioning, …)
docs/                     # user-facing docs + backlog
research/                 # research reports
```

---

## Three layers, where each lives

1. **Prompts** — thin wrappers around `prompts/build.ts`, which composes the constitution from `content/const-*.md` (15 fragments, selected per dispatch mode by `prompts/constitution-manifest.ts`) + the role SOP + live handoff state, then applies text-transform passes for size. 11 prompts registered.
2. **Tools** — twelve `tw_*` tools declared in `tools/registry.ts` that read/write `.current/handoff.md`, `tasks.md`, and (HTTP/SQLite mode) PRD-derived RAG chunks.
3. **Guards + gates** — `guards/session.ts` (pre-flight check) and `guards/file-lock.ts` (O_EXCL lock + mtime freshness), then the 18-step `UPDATE_STATE_GATE_PIPELINE` in `tools/handoff-orchestrator.ts` with predicates under `gates/`.

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

`test/` holds 87 test files covering guards, transitions and round caps, every gate in `GATE_REGISTRY`, drift and sync, schema migrations, prompt composition and context budget, the agc adapters, and RAG. `test/eval/` is a separate behavioural eval harness (`npm run eval`). New behaviour needs a test; bug fixes need a regression test.

---

## What this server does NOT do

- It does NOT force agents to follow the constitution — only puts it in context. An agent ignoring tool calls cannot be stopped from editing `.current/handoff.md` directly. `tw_detect_drift` surfaces this on the next session.
- It is NOT cross-machine. The file lock is local-fs only.
- It does NOT touch git. Commit/PR workflow is out of scope.

---

## Pre-Flight Protocol (the one rule that matters)

Working in any agent-governance-managed workspace — including this repo — the agent's first action MUST be `tw_get_state`. Without it, `tw_update_state`, `tw_complete_task`, `tw_rollback_task`, and `tw_add_task` are blocked server-side. This is enforced; you cannot bypass it from the client.
