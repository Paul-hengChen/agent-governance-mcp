# HTTP / Remote Mode

Stdio mode (the default) is recommended for solo / single-machine use. **Pick HTTP mode when** multiple machines need shared state — e.g. a team server, CI, or a remote agent farm.

## Quick start (local)

```bash
npx -y github:Paul-hengChen/agent-governance-mcp#v3.18.0 --port 3000 --db ./agc.db

# liveness probe
curl http://localhost:3000/healthz
```

Endpoint: Streamable HTTP at `POST /mcp`. Liveness: `GET /healthz`.

## Required env vars (whenever port is reachable beyond localhost)

| Var | Purpose |
|---|---|
| `TW_AUTH_TOKEN` | Bearer token clients must send. **A loud warning is logged if unset.** Set this whenever the port is exposed beyond `127.0.0.1`. |
| `TW_ALLOWED_ORIGINS` | Comma-separated `Origin` allowlist (DNS-rebinding defense). Empty = allow any. |

```bash
TW_AUTH_TOKEN=hunter2 TW_ALLOWED_ORIGINS=https://app.example.com \
  npx -y github:Paul-hengChen/agent-governance-mcp#v3.18.0 --port 3000 --db ./agc.db
```

Clients connect with `Authorization: Bearer hunter2` and an allowlisted `Origin` header.

## Docker

```bash
docker build -t agent-governance-mcp .
docker run --rm -p 3000:3000 \
  -e TW_AUTH_TOKEN=hunter2 \
  -e TW_ALLOWED_ORIGINS=https://app.example.com \
  -v $(pwd)/data:/app/data \
  agent-governance-mcp --db /app/data/agc.db
```

Mount `data/` so the SQLite DB survives container restarts.

## Notes

- HTTP mode requires **`better-sqlite3`** — a native module needing Python + a C++ toolchain on first install. It's an `optionalDependency`, so stdio users without build tools are unaffected.
- In HTTP/SQLite mode, task storage moves into the SQLite adapter — no workspace filesystem required on the server side. `tw_add_task` works without a mounted workspace.
- RAG / PRD chunking (`tw_index_prd`, `tw_clear_prd_chunks`) is **SQLite-mode only**. See [docs/architecture.md](architecture.md) §RAG Lifecycle.
- File locks are local-fs only — HTTP mode does NOT extend the O_EXCL lock across machines. Concurrent writers on the same SQLite DB are serialized by SQLite itself; concurrent writers on different DBs are not coordinated.

## When NOT to use HTTP mode

- Solo dev, single machine → stdio is simpler and has zero native deps.
- "I want my team to share state" + everyone has Git → just commit `.current/handoff.md` to Git. Async sync via PR is often enough.
- HTTP mode shines when you need real-time shared state (e.g. an agent fleet hitting the same workspace concurrently).
