// Coded by @qa-engineer
// Child-process worker for the real-crash migration test: reads handoff state once
// from the built dist/ under the fault-injecting fs shim, so the process really exits
// (code 137) partway through the migration's renames.
// argv: <workspacePath>; CRASH_AFTER_RENAME is read by the shim.
// If the crash threshold is never reached it prints a marker so the parent test fails loudly.
// More: specs/e260e-comment-rationale.md (_e123b9-crash-worker.mjs).
import { readHandoffState } from "../dist/tools/handoff-parse.js";

const [, , workspacePath] = process.argv;
readHandoffState(workspacePath);
console.log("CRASH-WORKER-DID-NOT-CRASH");
