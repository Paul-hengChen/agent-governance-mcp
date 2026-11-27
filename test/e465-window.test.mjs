// Coded by @qa-engineer
// Tests (T-E465-03) for docs/tickets/E465.md S5 and S6 (specs/e465-launcher-wave-done.md, Build contract and
// Copy / Strings close.done), including the two S6 cases of the cut amendment (worktree gone; close-only run).
// WHY (S5): a weekly limit lasts days, so the launcher never wakes a `paused-weekly` lane on its own (E443b A2-7);
// once a human knows the limit has reset, `--wake-weekly` wakes it in its own window, exactly like a woken
// `paused-stopped` lane — no new window, no `agc feature start`, nothing under the lane's .current/.
// WHY (S6): when a wave is done its finished lanes' windows are clutter, but a lane stopped for a human
// (`stopped — …` ticket) must keep its window. `--close-finished` sends `/exit` only to finished lanes without a
// stopped ticket (a finished lane whose worktree the finish removed has no ticket left, so it counts as not
// stopped), records the window closed so it is never sent `/exit` twice, and does nothing else: no start, no
// wake, no window, no poll — even when the next wave has a startable lane.
// Through runLaneLaunchCli (the argv the real script passes) over the E443b stand-ins: scripted window driver,
// fake clock, temp git primary. No iTerm2. Every title starts with its scenario id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { loadLaunch, makeEnv, cleanup, laneRecord, laneStatus, setTicketStatus, SIG, WAKE } from "./fixtures/e443b/harness.mjs";
import { lane, makeDeps, runCore, runCli, laneReport, batchStop, pollSleeps, gitOk } from "./fixtures/e465/flow.mjs";

after(cleanup);

const EXIT_LINE = "/exit";
const CLOSED = (l, id) => `closed ${l} — window ${id}`; // Copy close.done
const WAITING_MANUAL = "stopped — awaiting manual verification";
const STOPPED_OTHER = "stopped — blocked on a missing credential";

/** Writes a window got after index `from`. */
const writesSince = (win, from) => win.writes.slice(from);

/** Run 1: `pausedLane` hits the weekly limit on the first poll; every other lane posts its lane report. */
async function runToWeeklyPause(L, env, pausedLane) {
  let h;
  h = makeDeps(env, {
    onPoll: (n) => {
      if (n !== 1) return;
      for (const o of h.driver.opens) {
        if (o.lane === pausedLane) h.driver.show(o.lane, SIG.weekly);
        else laneReport(env, o.lane);
      }
    },
  });
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 0, h.out.join("\n"));
  assert.equal(laneStatus(env, pausedLane), "paused-weekly", h.out.join("\n"));
  return h;
}

// ---------------------------------------------------------------------------------------------------------------
// S5 — a weekly-paused lane is woken only when asked
// ---------------------------------------------------------------------------------------------------------------

test("S5: without --wake-weekly a paused-weekly lane is not woken; with it the wake line goes into the same window and the lane is running", async () => {
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1")] });
  const h1 = await runToWeeklyPause(L, env, "t1");
  const win = h1.driver.of("t1")[0];

  // Without the option: nothing sent, still paused-weekly (the E443b rule).
  const before = win.writes.length;
  const h2 = makeDeps(env, { driver: h1.driver, maxPolls: 3 });
  const r2 = await runCli(L, [env.manifest], h2.deps);
  assert.equal(r2.code, 0, h2.out.join("\n"));
  assert.equal(win.writes.length, before, "no send to a paused-weekly lane without the option");
  assert.ok(!h2.out.some((l) => l.startsWith("woken t1")), h2.out.join("\n"));
  assert.equal(laneStatus(env, "t1"), "paused-weekly");

  // With the option: one wake send into the same window, recorded running, then the run goes on as usual.
  let statusAtFirstPoll;
  const h3 = makeDeps(env, {
    driver: h1.driver,
    onPoll: (n) => {
      if (n === 1) {
        statusAtFirstPoll = laneStatus(env, "t1");
        laneReport(env, "t1");
      }
    },
  });
  const r3 = await runCli(L, [env.manifest, "--wake-weekly"], h3.deps);
  assert.equal(r3.code, 0, h3.out.join("\n") + h3.err.join("\n"));
  assert.deepEqual(writesSince(win, before), [[WAKE, false], ["", true]], "the existing wake send, into the recorded window");
  assert.equal(h3.driver.opens.length, 1, "no new window");
  assert.equal(h3.calls.featureStart.length, 0, "no agc feature start");
  assert.ok(h3.out.includes(`woken t1 — window ${win.id}`), h3.out.join("\n"));
  assert.equal(statusAtFirstPoll, "running", "recorded running after the wake");
  assert.equal(laneStatus(env, "t1"), "finished", "the normal run then sees its lane report");
});

// ---------------------------------------------------------------------------------------------------------------
// S6 — finished lane windows are closed, stopped ones are kept
// ---------------------------------------------------------------------------------------------------------------

/** Run 1 over t1 (finished: tickets done + lane report), t2 (batch stop, awaiting manual verification), t3 (another stopped). */
async function runToFinishedWave(L, env) {
  let h;
  h = makeDeps(env, {
    onPoll: (n) => {
      if (n !== 1) return;
      setTicketStatus(env, "t1", "T1", "done");
      laneReport(env, "t1");
      batchStop(env, "t2", "T2", WAITING_MANUAL);
      batchStop(env, "t3", "T3", STOPPED_OTHER);
    },
  });
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 0, h.out.join("\n"));
  for (const id of ["t1", "t2", "t3"]) assert.equal(laneStatus(env, id), "finished", `${id}: ${h.out.join("\n")}`);
  return h;
}

test("S6: --close-finished sends /exit to the finished lane's window only, keeps stopped lanes' windows, records it closed", async () => {
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1"), lane("t2", "T2"), lane("t3", "T3")] });
  const h1 = await runToFinishedWave(L, env);
  const [a, b, c] = ["t1", "t2", "t3"].map((id) => h1.driver.of(id)[0]);
  const at = { a: a.writes.length, b: b.writes.length, c: c.writes.length };
  assert.equal(laneRecord(env, "t1").windowId, a.id);

  const h2 = makeDeps(env, { driver: h1.driver });
  const r2 = await runCli(L, [env.manifest, "--close-finished"], h2.deps);
  assert.equal(r2.code, 0, h2.out.join("\n") + h2.err.join("\n"));
  assert.deepEqual(writesSince(a, at.a), [[EXIT_LINE, false], ["", true]], "/exit through the existing send method into A's recorded window");
  assert.deepEqual(writesSince(b, at.b), [], "B (awaiting manual verification) gets nothing");
  assert.deepEqual(writesSince(c, at.c), [], "C (another stopped — … status) gets nothing");
  assert.ok(h2.out.includes(CLOSED("t1", a.id)), h2.out.join("\n"));
  assert.ok(!h2.out.some((l) => l.startsWith("closed t2") || l.startsWith("closed t3")), h2.out.join("\n"));
  assert.equal(laneRecord(env, "t1").windowClosed, true, "the launch state records A's window as closed");
  assert.notEqual(laneRecord(env, "t2").windowClosed, true);
  assert.notEqual(laneRecord(env, "t3").windowClosed, true);
  for (const id of ["t1", "t2", "t3"]) assert.equal(laneStatus(env, id), "finished", `${id} stays finished`);
  assert.equal(h2.driver.opens.length, 3, "no window opened");
  assert.equal(h2.calls.featureStart.length, 0);

  // A window recorded closed is never sent /exit again.
  const h3 = makeDeps(env, { driver: h1.driver });
  const r3 = await runCli(L, [env.manifest, "--close-finished"], h3.deps);
  assert.equal(r3.code, 0);
  assert.deepEqual(writesSince(a, at.a), [[EXIT_LINE, false], ["", true]], "no second /exit");
  assert.ok(!h3.out.some((l) => l.startsWith("closed ")), h3.out.join("\n"));
});

test("S6: a finished lane whose worktree is gone (agc feature finish --shipped ran) gets /exit; a stopped lane keeps its window", async () => {
  // WHY: the finish removes the worktree, so there is no ticket left to read; a batch-stopped lane is never
  // finished-and-shipped and keeps its worktree, so a missing worktree means nothing is stopped there.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1"), lane("t2", "T2")] });
  let h1;
  h1 = makeDeps(env, {
    onPoll: (n) => {
      if (n !== 1) return;
      setTicketStatus(env, "t1", "T1", "done");
      laneReport(env, "t1");
      batchStop(env, "t2", "T2", WAITING_MANUAL);
    },
  });
  const r1 = await runCore(L, env, h1.deps);
  assert.equal(r1.code, 0, h1.out.join("\n"));
  gitOk(["worktree", "remove", "--force", env.worktree("t1")], env.primary);
  assert.ok(!fs.existsSync(env.worktree("t1")), "A's worktree is gone");
  const a = h1.driver.of("t1")[0];
  const b = h1.driver.of("t2")[0];
  const at = { a: a.writes.length, b: b.writes.length };

  const h2 = makeDeps(env, { driver: h1.driver });
  const r2 = await runCli(L, [env.manifest, "--close-finished"], h2.deps);
  assert.equal(r2.code, 0, h2.out.join("\n") + h2.err.join("\n"));
  assert.deepEqual(writesSince(a, at.a), [[EXIT_LINE, false], ["", true]], "A (no worktree) gets /exit");
  assert.deepEqual(writesSince(b, at.b), [], "B keeps its window");
  assert.ok(h2.out.includes(CLOSED("t1", a.id)), h2.out.join("\n"));
  assert.equal(laneRecord(env, "t1").windowClosed, true);
});

test("S6: a --close-finished run starts nothing even when a lane of the next wave is startable, and exits 0", async () => {
  // WHY: the close run belongs to the end of a wave; starting the next wave is a separate, deliberate run.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1", 1), lane("t2", "T2", 2)] });
  let h1;
  h1 = makeDeps(env, { onPoll: (n) => n === 1 && laneReport(env, "t1") });
  const r1 = await runCore(L, env, h1.deps);
  assert.equal(r1.code, 0, h1.out.join("\n"));
  assert.equal(laneStatus(env, "t1"), "finished");
  const a = h1.driver.of("t1")[0];
  const at = a.writes.length;

  const h2 = makeDeps(env, { driver: h1.driver });
  const r2 = await runCli(L, [env.manifest, "--close-finished"], h2.deps);
  assert.equal(r2.code, 0, h2.out.join("\n") + h2.err.join("\n"));
  assert.deepEqual(writesSince(a, at), [[EXIT_LINE, false], ["", true]]);
  assert.ok(h2.out.includes(CLOSED("t1", a.id)), h2.out.join("\n"));
  assert.equal(h2.driver.opens.length, 1, "no window opened for the startable wave-2 lane");
  assert.equal(h2.calls.featureStart.length, 0, "no agc feature start");
  assert.equal(laneRecord(env, "t2"), undefined, "t2 not recorded");
  assert.ok(!h2.out.some((l) => l.startsWith("started ") || l.startsWith("queued ")), h2.out.join("\n"));
  assert.equal(pollSleeps(h2), 0, "a close-only run does not poll");
});

test("S6: given --wake-weekly and --close-finished together, the close-only rule wins — nothing is woken or started", async () => {
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1", 1), lane("t2", "T2", 1), lane("t3", "T3", 2)] });
  const h1 = await runToWeeklyPause(L, env, "t2");
  assert.equal(laneStatus(env, "t1"), "finished");
  const a = h1.driver.of("t1")[0];
  const b = h1.driver.of("t2")[0];
  const at = { a: a.writes.length, b: b.writes.length };

  for (const argv of [[env.manifest, "--wake-weekly", "--close-finished"], [env.manifest, "--close-finished", "--wake-weekly"]]) {
    const h2 = makeDeps(env, { driver: h1.driver });
    const r2 = await runCli(L, argv, h2.deps);
    assert.equal(r2.code, 0, h2.out.join("\n") + h2.err.join("\n"));
    assert.deepEqual(writesSince(b, at.b), [], `${argv.slice(1).join(" ")}: the paused-weekly lane is not woken`);
    assert.equal(laneStatus(env, "t2"), "paused-weekly");
    assert.ok(!h2.out.some((l) => l.startsWith("woken ")), h2.out.join("\n"));
    assert.equal(h2.driver.opens.length, 2, "no window opened");
    assert.equal(h2.calls.featureStart.length, 0);
    assert.equal(pollSleeps(h2), 0, "no poll");
  }
  assert.deepEqual(writesSince(a, at.a), [[EXIT_LINE, false], ["", true]], "the finished lane got /exit exactly once over both runs");
});
