# Spec: Phase 6 — Remote Transport & Cloud Deployment

<!-- feature_id: phase6-remote-transport | created_at: 2026-05-15 | created_by: @pm -->

## Problem Statement

teamwork-mcp-server currently operates exclusively over stdio, meaning it only works for a single machine. When two people (or two machines) need to share the same handoff state, there is no cross-machine lock or sync mechanism. Phase 6 adds an HTTP transport mode and a SQLite-backed storage adapter, enabling the server to be deployed as a persistent cloud service that any MCP client can connect to remotely.

## User Stories

- As a developer on a remote machine, I want to connect my IDE to a cloud-hosted teamwork-mcp-server, so that I share handoff state with teammates without Git commits.
- As a solo developer using multiple machines, I want the server to run persistently with a URL, so that all my sessions read the same project state.
- As a team lead, I want to deploy the server with Docker in one command, so that onboarding new teammates requires zero local setup.

## Acceptance Criteria

**Transport mode:**
- Given the server is started with `--port 3000`, When an MCP client connects via HTTP, Then the server responds to MCP calls over StreamableHTTP.
- Given the server is started with no flags, When launched by an IDE, Then it operates in stdio mode (backward-compatible, no behaviour change).

**Storage abstraction:**
- Given HTTP mode is active, When `tw_update_state` is called, Then state is persisted to SQLite (not `handoff.md`).
- Given stdio mode is active, When `tw_update_state` is called, Then state is persisted to `handoff.md` (existing behaviour unchanged).

**Deployment:**
- Given a `Dockerfile` exists, When `docker build` + `docker run -p 3000:3000` is executed, Then the HTTP server starts and accepts MCP connections.

## Out of Scope

- PostgreSQL / Supabase (SQLite is sufficient for MVP)
- Authentication / API key (future Phase 6.5)
- Cross-project multi-tenancy (single workspace per server instance for MVP)
- WebSocket transport
- Migration tooling from `handoff.md` → SQLite (manual process for now)

## Dependencies / Prerequisites

- Phase 5a (test suite) ✅ Done
- Phase 5b (GitHub Actions CI) ✅ Done
- `@modelcontextprotocol/sdk` already includes `StreamableHTTPServerTransport` ✅
- `better-sqlite3` package must be added as a dependency
