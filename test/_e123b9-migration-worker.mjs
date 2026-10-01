// Coded by @qa-engineer
// Child-process worker for the cross-process migration concurrency test.
// argv: <workspacePath> <mode: "r" | "w"> <startAtEpochMs>
// Busy-waits until the shared start instant so sibling workers' fs and lock work
// overlaps, then does one read or one read-then-write against the workspace.
// Prints one result line (R-ok, R-missing, W-ok, or ERR <mode> <prefix>); never throws.
// More: specs/e260e-comment-rationale.md (_e123b9-migration-worker.mjs).

import { readHandoffState } from "../dist/tools/handoff-parse.js";
import { writeHandoffState } from "../dist/tools/handoff-write.js";

const [, , workspacePath, mode, startAtRaw] = process.argv;
const startAt = Number(startAtRaw);

while (Date.now() < startAt) {
  /* busy-wait to synchronize all sibling workers' real fs work */
}

try {
  if (mode === "r") {
    const state = JSON.parse(readHandoffState(workspacePath));
    console.log(state.exists ? "R-ok" : "R-missing");
  } else {
    readHandoffState(workspacePath);
    await writeHandoffState({
      workspacePath,
      activeFeature: "e123b9-mig3-fixture",
      status: "In_Progress",
      completedTasks: [],
      pendingNotes: [`worker-pid-${process.pid}`],
      lastAgent: "sr-engineer",
    });
    console.log("W-ok");
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`ERR ${mode} ${message.slice(0, 160)}`);
}
