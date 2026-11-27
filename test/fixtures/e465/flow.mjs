// Coded by @qa-engineer
// Shared steps for test/e465-*.test.mjs (specs/e465-launcher-wave-done.md, ticket E465 S1–S7).
// WHY: the E465 scenarios are multi-run stories (a wave runs, its lanes finish, `agc feature finish --shipped`
// removes worktree and branch, a pull request merges or not, the launcher runs again). Every step runs over the
// E443b stand-ins (test/fixtures/e443b/harness.mjs: scripted window driver, fake clock, temp git primary,
// feature-start runner that only runs `git worktree add`) — no iTerm2, no real window, no real session.

import * as fs from "node:fs";
import * as path from "node:path";
import {
  makeDeps,
  runCore,
  runCli,
  laneReport,
  postMessage,
  setTicketStatus,
  historyRecord,
  gitOk,
  git,
  branchOf,
  POLL_MS,
} from "../e443b/harness.mjs";

export const lane = (id, ticket, wave = 1, deps = []) => ({ lane: id, tickets: [ticket], wave, deps });

/** One commit on the lane's own branch, made inside its worktree (the lane's work). Returns the new tip sha. */
export function commitInWorktree(env, laneId) {
  const wt = env.worktree(laneId);
  fs.mkdirSync(path.join(wt, "src"), { recursive: true });
  fs.writeFileSync(path.join(wt, "src", `${laneId}.ts`), `export const ${laneId} = 1;\n`);
  gitOk(["add", "-A"], wt);
  gitOk(["commit", "-q", "-m", `${laneId}: lane work`], wt);
  return gitOk(["rev-parse", "HEAD"], wt);
}

/**
 * Wave 1 through the launcher itself: `laneId` is started, does one commit on its branch, and posts its lane
 * report on the first poll, so the launcher records it `finished` while its branch still exists.
 * Returns the branch tip at finish time.
 */
export async function runLaneToFinish(L, env, laneId) {
  let tip;
  let h;
  h = makeDeps(env, {
    onPoll: () => {
      if (tip === undefined && h.driver.opens.some((o) => o.lane === laneId)) {
        tip = commitInWorktree(env, laneId);
        laneReport(env, laneId);
      }
    },
  });
  const r = await runCore(L, env, h.deps);
  if (r.code !== 0) throw new Error(`wave-1 run ended with ${r.code}: ${h.out.join("\n")} ${h.err.join("\n")}`);
  if (tip === undefined) throw new Error(`wave-1 run never opened ${laneId}: ${h.out.join("\n")}`);
  return tip;
}

/** What `agc feature finish --shipped` leaves: worktree removed, branch deleted, a finish record in history. */
export function finishShipped(env, laneId) {
  gitOk(["worktree", "remove", "--force", env.worktree(laneId)], env.primary);
  gitOk(["branch", "-D", branchOf(laneId)], env.primary);
  historyRecord(env, laneId);
}

/** The pull request carrying `sha` merges into main (no-ff, as a merge button does). */
export function mergeIntoMain(env, sha, laneId) {
  gitOk(["merge", "-q", "--no-ff", "-m", `merge ${laneId}'s pull request`, sha], env.primary);
}

/** A batch stop: the lane's tickets settle with a `stopped — …` status and it sends its report after the stop. */
export function batchStop(env, laneId, ticketId, status) {
  setTicketStatus(env, laneId, ticketId, status);
  postMessage(env, laneId, { re: "batch stop", body: `batch stop: ${ticketId} ${status}` });
}

/** Poll sleeps the run made (a close-only run makes none). */
export const pollSleeps = (h) => h.clock.sleeps.filter((ms) => ms === POLL_MS).length;

export { makeDeps, runCore, runCli, laneReport, git, gitOk, branchOf };
