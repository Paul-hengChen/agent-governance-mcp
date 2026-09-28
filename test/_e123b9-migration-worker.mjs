// Coded by @qa-engineer
// Test helper: real child-process worker for AC-MIG-3's cross-process
// concurrency proof (T-E123B9-05 (e)). Mirrors test/_lock-worker.mjs's
// existing convention (a tiny, argv-driven worker imported by node --test
// via child_process.spawn) and the sr-engineer review's own scratch
// verification technique (review_reports/review_T-E123B9-01.md's
// scratchpad/cr/{child,stress}.mjs) — promoted here into a durable,
// qa-owned fixture instead of a one-off scratch script.
//
// argv: <workspacePath> <mode: "r" | "w"> <startAtEpochMs>
//
// Busy-waits until startAtEpochMs (all siblings spawned with the SAME target
// instant) so every worker's real fs/lock work actually overlaps in
// wall-clock time, then performs exactly one read (readHandoffState) or one
// write (readHandoffState + writeHandoffState, mirroring a real tw_update_state
// dispatch's own pre-flight-then-write shape) against the shared workspace.
// Prints exactly one result line to stdout: "R-ok" / "R-missing" (a read
// completed, exists true/false), "W-ok" (a write completed), or
// "ERR <mode> <message-prefix>" (a caught error) — never throws uncaught,
// so the parent's `spawn(...).on("exit")` always fires cleanly.

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
