# Tasks: phase6-remote-transport
<!-- feature_id: phase6-remote-transport | created_at: 2026-05-15 | created_by: @pm -->

## Active

- [x] T01 [P0] Add `--port` CLI arg parsing + dual-mode boot in `index.ts` (stdio default, HTTP when --port given) | depends_on: none (note: --port CLI arg parsing + dual-mode boot in index.ts. stdio default, HTTP when --port given.)
- [x] T02 [P0] Create `transport/http.ts` — Node `http.createServer` + `StreamableHTTPServerTransport` wiring | depends_on: T01 (note: transport/http.ts created — Node http.createServer + StreamableHTTPServerTransport + body parsing.)
- [x] T03 [P1] Define `StorageAdapter` interface in `tools/storage.ts` + refactor existing handoff/tasks tools to accept an adapter | depends_on: none (note: HandoffStorage interface + FileHandoffStorage in tools/storage.ts)
- [x] T04 [P1] Implement `SqliteStorageAdapter` in `tools/storage-sqlite.ts` using `better-sqlite3` | depends_on: T03 (note: SqliteHandoffStorage in tools/storage-sqlite.ts using better-sqlite3 (WAL mode))
- [x] T05 [P1] Wire storage selection: HTTP mode → `SqliteStorageAdapter`, stdio mode → `FileStorageAdapter` | depends_on: T02, T04 (note: index.ts wired: HTTP mode → SqliteHandoffStorage (--db path), stdio → FileHandoffStorage)
- [x] T06 [P2] Add `Dockerfile` + `.dockerignore` for single-command cloud deployment | depends_on: T05 (note: Dockerfile (multi-stage, node:22-alpine) + .dockerignore)

## Completed

<!-- tw_complete_task will move items here -->
