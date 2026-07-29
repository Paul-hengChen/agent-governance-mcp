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

## Reading the constitution

There is **no single `content/constitution.md`** — see [why](#why-there-is-no-single-constitution-file) below. Pick by what you're doing:

**Read the whole thing.** A composed full-text copy is committed:

```
test/fixtures/compose-golden/constitution-monolith.txt      # all 15 fragments
test/fixtures/compose-golden/skill-coordinator-monolith.txt # all 7 coord-*.md
```

These are **golden test fixtures, not the source of truth**. `test/compose-equivalence.test.mjs` (AC8) and `test/skill-manifest.test.mjs` (AC5) assert they stay byte-identical to the live composition, so they cannot silently go stale — but that also means **editing any fragment turns those tests red until you re-baseline the golden**. That is expected, and it is a deliberate step: it forces every constitution wording change to be an explicit, reviewable diff.

Re-baseline by regenerating (never hand-edit the fixture). `scripts/capture-constitution-golden.mjs` does **not** do this — its monolith branch needs the retired `content/constitution.md` and no-ops with a note; it still owns the 10 dispatch/hook fixtures:

```bash
npm run build
node --input-type=module -e '
import fs from "node:fs";
import { CONSTITUTION_SEGMENTS } from "./dist/prompts/constitution-manifest.js";
import { composeSkill, hostCapabilitiesFor } from "./dist/prompts/skill-manifest.js";
const read = (f) => fs.readFileSync("content/" + f, "utf8");
fs.writeFileSync("test/fixtures/compose-golden/constitution-monolith.txt",
  CONSTITUTION_SEGMENTS.map((s) => read(s.file)).join(""));
fs.writeFileSync("test/fixtures/compose-golden/skill-coordinator-monolith.txt",
  composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), read));
'
git diff --stat test/fixtures/compose-golden/   # review the wording diff before committing
```

Both writes mirror exactly what the two tests compute, so running this with no fragment edits pending is a no-op. Expect to re-baseline context-budget caps too (`test/context-budget.test.mjs`) when a fragment grows.

**Edit it.** The 15 `content/const-*.md` fragments are the source. Document order = the order in `CONSTITUTION_SEGMENTS` (`prompts/constitution-manifest.ts`), which the filename number prefixes mirror, so `cat content/const-*.md` reads correctly. Each fragment carries one tag:

| tag | fragments | ships when |
|---|---|---|
| `core` | 01, 03, 05, 15 | always |
| `design` | 02, 04 | design-armed feature |
| `chain` | 06, 08, 10, 12, 14 | non-lite dispatch |
| `chain-design` | 07, 09, 11, 13 | both |

**See what one role actually receives.** Composition varies per dispatch — this is the point of the split:

| mode | fragments | bytes |
|---|---|---|
| chain + design (full, design-armed) | 15/15 | 36,189 |
| chain, no design | 9/15 | 27,050 |
| lite + design | 6/15 | 14,220 |
| lite, no design (leanest) | 4/15 | 12,206 |

```bash
npm run build
node --input-type=module -e '
import { composeConstitution } from "./dist/prompts/build.js";
process.stdout.write(composeConstitution({ chain: false, design: false }));
' | less
```

That prints the composed text **before** the transform passes. What an agent really gets has also been through `stripOriginTags` (always) and `stripRationale` (unless `fullDetail`) — to see the true final bundle, invoke the role prompt itself.

`content/constitution-rationale.md` holds the non-normative "why" behind §1/§3.1/§3.2/§5/§7. Read it when a rule's intent isn't obvious from its text.

### Why there is no single constitution file

Backlog ticket **A9** (v3.44.0–v3.45.0); design in [specs/compose-not-strip-overlays.md](specs/compose-not-strip-overlays.md).

Assembly used to be **subtractive**: one 1,951-line `content/constitution.md` with `<!-- chain-only -->`, `<!-- design-only -->`, and `<!-- rationale -->` fenced spans, which `build.ts` stripped by regex per dispatch mode. One malformed or unbalanced marker silently changed the governance text an agent received — no build error, no test bound to marker validity, no signal to the human that the bundle was corrupt. The fences also nested three deep (`design-only` inside `chain-only` in §3.1/§3.2/§4; `rationale` inside `design-only` at §1; `origin` inside both), so hand-editing them was error-prone in exactly the way that matters: a rule could vanish from one dispatch mode and nothing would look wrong.

Composition is now **additive** — a fragment ships iff its tag's predicate holds, and excluded fragments simply never load. With nothing left to strip, the unbalanced-fence failure class is gone *structurally* rather than guarded against, which is why ticket A3 (a build-time fence validator) was superseded instead of implemented. It also makes "what does role X receive?" answerable as "which files got concatenated" instead of "which regex matched a fence in a 1,951-line document."

The refactor was required to change assembly only, never wording: golden fixtures were captured **before** any edit landed, and equivalence is enforced as byte-identical output per dispatch mode — not asserted by inspection.

The cost is this section's existence: no file is "the constitution" any more, so reading it end-to-end needs the pointers above.

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
