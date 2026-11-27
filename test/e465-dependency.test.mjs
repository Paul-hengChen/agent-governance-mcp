// Coded by @qa-engineer
// Tests (T-E465-02) for docs/tickets/E465.md S2, S3, S4 (specs/e465-launcher-wave-done.md, Build contract and
// Copy / Strings dep.not-merged / dep.no-tip).
// WHY: under `waveDoneAt: "pr-open"` the next wave starts while the previous pull request is still open, so a
// deleted branch plus a finish record no longer proves the depended-on work is in the ref the dependent lane
// starts from. A dependent lane may start only once that work is an ancestor of its start ref — checked on the
// branch, or, once `agc feature finish --shipped` deleted it, on the branch tip the launcher recorded while the
// branch existed. Under `merged` (absent, "merged" or unusable) nothing changes.
// Each story is real: wave 1 runs through the launcher (so the launcher sees and records the lane's branch), the
// finish removes worktree and branch, the merge is a real `git merge` into main. All window, clock and
// feature-start seams are the E443b stand-ins (no iTerm2). Every title starts with its scenario id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loadLaunch, makeEnv, cleanup, makeBranch, historyRecord, laneRecord, laneStatus } from "./fixtures/e443b/harness.mjs";
import { lane, runLaneToFinish, finishShipped, mergeIntoMain, makeDeps, runCore, laneReport, gitOk } from "./fixtures/e465/flow.mjs";

after(cleanup);

// A = t1 (wave 1); C = t3 (wave 2, depends on A); D = t4 (wave 2, depends on nothing).
const LANES = [lane("t1", "T1", 1), lane("t3", "T3", 2, ["t1"]), lane("t4", "T4", 2)];
const PR_OPEN = { waveDoneAt: "pr-open" };
// Copy / Strings (verbatim).
const NOT_MERGED = (l, dep, ref) => `waiting ${l} — depends on ${dep}: ${dep}'s work has not merged into ${ref}`;
const NO_TIP = (l, dep, branch, ref) =>
  `waiting ${l} — depends on ${dep}: branch ${branch} is gone and the launcher recorded no tip for ${dep}, so it cannot tell whether ${dep}'s work has merged into ${ref}`;
// The E443b reasons (merged mode, unchanged).
const NOT_ANCESTOR = (l, dep, branch, ref) => `waiting ${l} — depends on ${dep}: branch ${branch} is not an ancestor of ${ref}`;
const GONE_NO_RECORD = (l, dep, branch) => `waiting ${l} — depends on ${dep}: branch ${branch} is gone and ${dep} has no finish record`;
const NOT_FINISHED_LOCAL = (l, dep) => `waiting ${l} — depends on ${dep}: agc feature finish --shipped has not run for ${dep}`;

/** A wave-2 run in which every lane it opens posts its lane report on the next poll. */
async function runWave(L, env) {
  let h;
  const reported = new Set();
  h = makeDeps(env, {
    onPoll: () => {
      for (const o of h.driver.opens) if (!reported.has(o.lane)) { laneReport(env, o.lane); reported.add(o.lane); }
    },
  });
  const r = await runCore(L, env, h.deps);
  return { r, h };
}

/** S2's situation: A started and finished through the launcher, then shipped (worktree + branch gone), not merged. */
async function shippedNotMerged(L, config) {
  const env = makeEnv({ lanes: LANES, config });
  const tip = await runLaneToFinish(L, env, "t1");
  assert.equal(laneStatus(env, "t1"), "finished", "the launcher recorded A finished while its branch existed");
  finishShipped(env, "t1");
  return { env, tip };
}

// ---------------------------------------------------------------------------------------------------------------
// S2 — in pr-open mode a dependency waits for merged code
// ---------------------------------------------------------------------------------------------------------------

test("S2: pr-open, A shipped but its pull request not merged — D starts, C waits naming A's work as not merged into main", async () => {
  // WHY: the finish record and the deleted branch say A is done, not that A's code is in main; C must not start
  // from a main that lacks A.
  const L = await loadLaunch();
  const { env } = await shippedNotMerged(L, PR_OPEN);
  const { r, h } = await runWave(L, env);
  assert.equal(r.code, 0, h.out.join("\n"));
  assert.ok(h.out.includes(NOT_MERGED("t3", "t1", "main")), h.out.join("\n"));
  assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t4"], "D starts; C does not");
  assert.deepEqual(h.calls.featureStart.map((c) => c.slug), ["t4-fx"]);
  assert.equal(laneRecord(env, "t3"), undefined, "C has no launch record: it was never started");
});

test("S2: pr-open, A's branch still exists but is not merged — C waits with the not-merged reason", async () => {
  // WHY: under pr-open the reason speaks of A's work, whichever way (branch or recorded tip) it was checked.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: LANES, config: PR_OPEN });
  makeBranch(env, "feat/t1-fx");
  laneReport(env, "t1");
  historyRecord(env, "t1");
  const { r, h } = await runWave(L, env);
  assert.equal(r.code, 0);
  assert.ok(h.out.includes(NOT_MERGED("t3", "t1", "main")), h.out.join("\n"));
  assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t4"]);
});

test("S2: pr-open, A's branch is gone and the launcher never recorded a tip — a finish record alone does not meet the dependency", async () => {
  // WHY: a lane started by hand was never seen by the launcher; with its branch gone nothing tells whether its
  // work merged, so its dependents wait (start them by hand) rather than start on a guess.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: LANES, config: PR_OPEN });
  laneReport(env, "t1");
  historyRecord(env, "t1");
  const { r, h } = await runWave(L, env);
  assert.equal(r.code, 0);
  assert.ok(h.out.includes(NO_TIP("t3", "t1", "feat/t1-fx", "main")), h.out.join("\n"));
  assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t4"], "D still starts");
});

test("S2: pr-open with knowledge local — the finish record is still required, and the merged check applies too", async () => {
  // WHY: under knowledge local the dependent lane's knowledge comes from the finish copy-back (today's rule), and
  // under pr-open the code must also be merged; neither alone is enough.
  const L = await loadLaunch();
  const cfg = { artifacts: "local", knowledge: "local", waveDoneAt: "pr-open" };

  const merged = makeEnv({ lanes: LANES, config: cfg });
  makeBranch(merged, "feat/t1-fx", { merge: true });
  laneReport(merged, "t1");
  const a = await runWave(L, merged);
  assert.equal(a.r.code, 0);
  assert.ok(a.h.out.includes(NOT_FINISHED_LOCAL("t3", "t1")), `merged but no finish record:\n${a.h.out.join("\n")}`);
  assert.ok(!a.h.driver.opens.some((o) => o.lane === "t3"));

  const unmerged = makeEnv({ lanes: LANES, config: cfg });
  makeBranch(unmerged, "feat/t1-fx");
  laneReport(unmerged, "t1");
  historyRecord(unmerged, "t1");
  const b = await runWave(L, unmerged);
  assert.equal(b.r.code, 0);
  assert.ok(b.h.out.includes(NOT_MERGED("t3", "t1", "main")), `finish record but not merged:\n${b.h.out.join("\n")}`);
  assert.ok(!b.h.driver.opens.some((o) => o.lane === "t3"));
});

// ---------------------------------------------------------------------------------------------------------------
// S3 — the waiting lane starts once the work has merged
// ---------------------------------------------------------------------------------------------------------------

test("S3: after the pull request carrying A merges into main, a re-run starts C from main and does not start D again", async () => {
  // WHY: the waiting is only until the merge; the re-run must find A's recorded tip in main although A's branch
  // is gone, start C from that ref, and never start an already recorded lane a second time.
  const L = await loadLaunch();
  const { env, tip } = await shippedNotMerged(L, PR_OPEN);
  const first = await runWave(L, env);
  assert.ok(first.h.out.includes(NOT_MERGED("t3", "t1", "main")), first.h.out.join("\n"));
  assert.deepEqual(first.h.driver.opens.map((o) => o.lane), ["t4"]);

  mergeIntoMain(env, tip, "t1");
  const mainSha = gitOk(["rev-parse", "main"], env.primary);
  const { r, h } = await runWave(L, env);
  assert.equal(r.code, 0, h.out.join("\n"));
  assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t3"], "C starts; D is not started a second time");
  assert.equal(h.calls.featureStart.length, 1);
  assert.equal(h.calls.featureStart[0].base, "main", "C starts from the ref wave 2 starts from");
  assert.equal(laneRecord(env, "t3").baseSha, mainSha, "C's prompt base is main after the merge");
  assert.ok(!h.out.some((l) => l.startsWith("waiting t3")), h.out.join("\n"));
  assert.ok(h.out.some((l) => l.startsWith("started t3 — window ")), h.out.join("\n"));
});

// ---------------------------------------------------------------------------------------------------------------
// S4 — merged mode keeps today's dependency rule
// ---------------------------------------------------------------------------------------------------------------

// absent, "merged", and an unusable value (which resolves to merged).
const MERGED_CONFIGS = [{}, { waveDoneAt: "merged" }, { waveDoneAt: "PR-OPEN" }];
const tag = (cfg) => JSON.stringify(cfg);

test("S4: merged mode — a shipped lane with a finish record meets the dependency even though its recorded tip is not in main", async () => {
  // WHY: under merged the next wave runs only after the previous pull request merged, so today's rule (deleted
  // branch + finish record = merged) holds; the recorded tip must not be consulted.
  const L = await loadLaunch();
  for (const cfg of MERGED_CONFIGS) {
    const { env } = await shippedNotMerged(L, cfg);
    const { r, h } = await runWave(L, env);
    assert.equal(r.code, 0, `${tag(cfg)}: ${h.out.join("\n")}`);
    assert.deepEqual(h.driver.opens.map((o) => o.lane).sort(), ["t3", "t4"], `${tag(cfg)}: both wave-2 lanes start\n${h.out.join("\n")}`);
    assert.ok(!h.out.some((l) => l.startsWith("waiting ")), `${tag(cfg)}: nothing waits`);
  }
});

test("S4: merged mode — the E443b dependency reasons are unchanged (not an ancestor; gone without finish record; knowledge local)", async () => {
  // WHY: every case the existing launcher tests cover must give the same result as before this ticket.
  const L = await loadLaunch();
  for (const cfg of MERGED_CONFIGS) {
    const notAncestor = makeEnv({ lanes: LANES, config: cfg });
    makeBranch(notAncestor, "feat/t1-fx");
    laneReport(notAncestor, "t1");
    const a = await runWave(L, notAncestor);
    assert.ok(a.h.out.includes(NOT_ANCESTOR("t3", "t1", "feat/t1-fx", "main")), `${tag(cfg)}:\n${a.h.out.join("\n")}`);
    assert.deepEqual(a.h.driver.opens.map((o) => o.lane), ["t4"]);

    const gone = makeEnv({ lanes: LANES, config: cfg });
    laneReport(gone, "t1");
    const b = await runWave(L, gone);
    assert.ok(b.h.out.includes(GONE_NO_RECORD("t3", "t1", "feat/t1-fx")), `${tag(cfg)}:\n${b.h.out.join("\n")}`);

    const merged = makeEnv({ lanes: LANES, config: cfg });
    makeBranch(merged, "feat/t1-fx", { merge: true });
    laneReport(merged, "t1");
    const c = await runWave(L, merged);
    assert.deepEqual(c.h.driver.opens.map((o) => o.lane).sort(), ["t3", "t4"], `${tag(cfg)}: merged branch meets it`);

    const local = makeEnv({ lanes: LANES, config: { ...cfg, artifacts: "local", knowledge: "local" } });
    makeBranch(local, "feat/t1-fx", { merge: true });
    laneReport(local, "t1");
    const d = await runWave(L, local);
    assert.ok(d.h.out.includes(NOT_FINISHED_LOCAL("t3", "t1")), `${tag(cfg)} knowledge local:\n${d.h.out.join("\n")}`);
    historyRecord(local, "t1");
    const e = await runWave(L, local);
    assert.ok(e.h.driver.opens.some((o) => o.lane === "t3"), `${tag(cfg)} knowledge local + finish record: C starts`);
  }
});
