// Coded by @qa-engineer
// Fault-injection shim for T-E123B9-08 (AC21(b) / J2-NEW-12): a real
// child-process crash mid-migration, so the per-lane lock is left stale.
//
// Loaded ONLY via _e123b9-fault-fs-loader.mjs's resolve hook, which redirects
// the bare "fs" specifier (the exact form tools/lane-migrate.ts and every
// other module under this compiled ESM tree import it as: `import * as fs
// from "fs"`) to this file. Re-exports every real fs export unchanged except
// renameSync, which is wrapped to count calls and, once the configured
// threshold is hit, `process.exit(137)` immediately after the real rename
// completed — no unwinding, no finally blocks run, exactly mirroring what a
// killed/crashed real process does. This is a real OS-level process death,
// not a simulated one: the calling `node` process actually terminates.
//
// Config via env var (set by the parent test before spawning the crash
// worker child):
//   CRASH_AFTER_RENAME=<n>  — exit(137) right after the n-th call to
//                             fs.renameSync completes (1-indexed). Unset ==
//                             no fault injection (plain passthrough).
//
// Imports the REAL implementation from "node:fs" (a distinct specifier the
// loader does NOT intercept — see the loader's own comment), so this module
// itself is never redirected back to itself.
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
