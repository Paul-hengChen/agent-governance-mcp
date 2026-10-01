// Coded by @qa-engineer
// Fault-injection fs shim for the real-crash migration test: re-exports real fs,
// but counts renameSync calls and calls process.exit(137) right after the n-th one,
// a genuine process death with no unwinding. Loaded only via the fault-fs loader.
// Config: CRASH_AFTER_RENAME=<n> (1-indexed); unset means plain passthrough.
// Imports the real fs from "node:fs", which the loader does not intercept.
// More: specs/e260e-comment-rationale.md (_e123b9-fault-fs-shim.mjs).
import * as real from "node:fs";
export * from "node:fs";

const crashAfterRename = process.env.CRASH_AFTER_RENAME
  ? Number(process.env.CRASH_AFTER_RENAME)
  : undefined;
let renameCount = 0;

export function renameSync(...args) {
  const result = real.renameSync(...args);
  renameCount++;
  if (crashAfterRename !== undefined && renameCount === crashAfterRename) {
    // Deliberately no cleanup: a finally block guarding the lock's
    // close/unlink (guards/file-lock.ts's withFileLock, or
    // tools/handoff-parse.ts's migrateOwnWorkspaceIfFlat raw lock) never
    // gets to run — process.exit() tears the process down immediately. This
    // is the exact shape a real `kill -9` / OOM-kill / crash leaves behind:
    // a lockfile on disk naming a PID that is now dead.
    process.exit(137);
  }
  return result;
}

export default real;
