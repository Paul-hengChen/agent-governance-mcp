// Coded by @qa-engineer
// Real child-process worker for T-E123B9-08 (AC21(b) / J2-NEW-12): calls
// readHandoffState(workspacePath) exactly once, against the BUILT dist/
// output (the actual own-workspace read entry point migrateOwnWorkspaceIfFlat
// runs inside), under the fault-injecting "fs" shim
// (_e123b9-fault-fs-loader.mjs / _e123b9-fault-fs-shim.mjs) so a real
// process.exit(137) happens partway through the migration's rename sequence
// — a genuine OS-level crash, not a simulated one.
//
// argv: <workspacePath>
// Config: CRASH_AFTER_RENAME env var (read by the shim, not this file).
//
// If CRASH_AFTER_RENAME's threshold is never reached (e.g. a fixture with
// fewer renames than expected — a test-authoring bug), the migration
// completes normally and this prints a marker so the parent test's exit-code
// assertion fails loudly with a clear cause instead of a silent false pass.
import { readHandoffState } from "../dist/tools/handoff-parse.js";

const [, , workspacePath] = process.argv;
readHandoffState(workspacePath);
console.log("CRASH-WORKER-DID-NOT-CRASH");
