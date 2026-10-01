# e260e-comment-rationale

Rationale cut from long comments in the owned test files of lane e260e (see `specs/e260e-test-comments-a-d.md`). One H2 section per source file, named after the file, added by the qa-engineer when a trim moves rationale here. A comment keeps at most a one-line pointer to this file.

## test/_e123b9-crash-worker.mjs
The worker calls `readHandoffState(workspacePath)` once against the built `dist/` output, the actual own-workspace read entry point the migration runs inside. The fault-injecting fs shim and its loader make a real `process.exit(137)` happen partway through the rename sequence: a genuine OS-level crash, not a simulated one. If the configured threshold is never reached (a fixture with fewer renames than expected, a test-authoring bug) the migration completes and the worker prints `CRASH-WORKER-DID-NOT-CRASH`, so the parent's exit-code assertion fails loudly with a clear cause instead of a silent false pass.

## test/_e123b9-fault-fs-loader.mjs
Uses Node's stable `module.register()` hook API, registered through `node --import 'data:...register(...)'`. It redirects only the bare `fs` specifier, the exact form every module under `dist/` imports (`import * as fs from "fs"`, tsc NodeNext/ES2022 output). `node:fs` is deliberately not intercepted, which is also how the shim reaches the real implementation without re-resolving to itself. This is standard Node fault-injection plumbing, not a mock of production code: every `dist/` module runs unmodified, and only `renameSync` gets a thin counting wrapper around the real syscall.

## test/_e123b9-fault-fs-shim.mjs
Purpose: a real child-process crash mid-migration, leaving the per-lane lock stale. The loader redirects the bare `fs` specifier (as used by `tools/lane-migrate.ts` and every other `dist/` module) to this file. It re-exports every real fs export except `renameSync`, which counts calls and, at the threshold, exits 137 immediately after the real rename completed: no unwinding, no `finally` blocks, exactly what a killed process does. The env var `CRASH_AFTER_RENAME=<n>` is set by the parent test before it spawns the crash worker; unset means no fault injection.

## test/_e123b9-migration-worker.mjs
Mirrors `test/_lock-worker.mjs` (a tiny argv-driven worker spawned by `node --test`), and promotes the reviewer's scratch verification technique into a durable qa-owned fixture. Workers busy-wait until the same `startAtEpochMs` so real fs and lock work overlaps in wall-clock time. A write is `readHandoffState` plus `writeHandoffState`, mirroring a real `tw_update_state` pre-flight-then-write shape. Output tokens: `R-ok` / `R-missing` (read completed, exists true/false), `W-ok`, or `ERR <mode> <message-prefix>`. It never throws uncaught, so the parent's `spawn(...).on("exit")` always fires cleanly.

## test/_e123b9-round2-migrate.mjs
Exercises the wired trigger exactly as a real `tw_get_state` call would: import the built `dist/tools/handoff-parse.js` and call `readHandoffState(scratchWorkspacePath)`, the own-workspace entry point the migration is wired into. Run as a child process, never imported, so its module graph and `guards/session.ts` in-memory state are fully independent of the calling test process.
