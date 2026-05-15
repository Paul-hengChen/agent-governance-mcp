# Review: phase6-remote-transport

<!-- @qa-engineer -->

## Round 1 — Findings

### 🔴 Critical (broken functionality)

| # | File | Issue |
|---|---|---|
| C1 | `Dockerfile` | `content/` directory is never copied into runtime image. All prompts will return `[ERROR: ...md not found at ...]` when the container starts. |
| C2 | `tools/drift.ts` | Uses `parseHandoff()` directly → in SQLite mode `handoff.md` may not exist, so drift always reports `tasks.md exists but handoff.md is missing`. |
| C3 | `prompts/*.ts` (5 files) | All five prompt builders call `parseHandoff()` directly → state block in prompt context is empty/null in SQLite mode. |
| C4 | `index.ts` | Invalid `--port` value (e.g. `--port abc`) silently falls through to stdio mode. Should fail fast. |

### 🟡 Important (cleanliness / safety)

| # | File | Issue |
|---|---|---|
| H1 | `index.ts` | HTTP mode has no SIGTERM/SIGINT graceful shutdown — containers will be SIGKILL'd. |
| H2 | `Dockerfile` | Runs `npm ci` twice (builder + runtime) — slow and wasteful. No `NODE_ENV=production`. |
| H3 | `transport/http.ts` | No HTTP body size limit → memory DOS risk. |
| H4 | `tools/storage-sqlite.ts` | Prepared statements created on every call instead of cached. |

### 🟢 Nice-to-have

- `index.ts` uses `import * as path from "path"` while `transport/http.ts` uses `"node:path"` — inconsistent.
- No tests for HTTP transport or SQLite storage (deferred to QA's test phase).

## Fix Plan

Apply C1–C4 + H1–H4 in this session. Defer test writing.
