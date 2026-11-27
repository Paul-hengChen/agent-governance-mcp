// Coded by @qa-engineer
// Tests (T-E443B-01) for specs/e443b-lane-launcher.md A2-1..A2-6, A2-11..A2-14, A2-22, A2-26, A2-27:
// the lane launcher's scheduling, refusals and launch state (tools/lane-launch.ts, scripts/lane-launch.mjs).
// WHY: the launcher starts lanes with nobody at the keyboard, so it may start only what the approved manifest
// allows (a human Decisions row, the manifest tier, a 波次 column, no same-wave dependency, batch lanes only),
// never more lanes than the parallel limit, never a lane twice, never a lane whose depended-on lane is not met,
// and it must never write the manifest or any tracked path. A lane frees its slot only on its final report
// (the lane-protocol §6 lane report, or a report after a §3 batch stop) — a progress report never finishes it.
// Seams (architecture `LaunchDeps`): every run uses the stand-ins of test/fixtures/e443b/harness.mjs — a scripted
// window driver, a fake clock whose poll sleeps post mailbox reports / edit ticket statuses, temp host paths and
// a feature-start runner that only runs `git worktree add` in a temp primary. No real window, session or
// `agc feature start`. Only the A2-11 / A2-12 refusal cases spawn the real `node scripts/lane-launch.mjs`
// (they end before any host seam; HOME points at an empty temp dir). Each title starts with its AC id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadLaunch,
  loadManifestTools,
  makeEnv,
  makeDeps,
  runCore,
  runCli,
  spawnCli,
  cleanup,
  laneStatus,
  laneReport,
  progressReport,
  postMessage,
  setTicketStatus,
  makeBranch,
  historyRecord,
  concurrencyTracker,
  writeConfig,
  sha256,
  gitOk,
  alivePids,
  POLL_MS,
} from "./fixtures/e443b/harness.mjs";

after(cleanup);

const lane = (id, ticket, wave = 1, deps = []) => ({ lane: id, tickets: [ticket], wave, deps });
const WAVE1 = (ids) => ids.map((id) => lane(id, id.toUpperCase()));
const EXIT = (n) => `lane-launch: no lane of wave ${n} is running — exiting`;
const REFUSED = (reason) => `lane-launch: refused — ${reason}`;

/** Each poll posts the final report of the earliest-opened lane whose report is not posted yet. */
function finishOnePerPoll(env, holder) {
  return () => {
    const next = holder.h.driver.opens.map((o) => o.lane).find((l) => !holder.track.reported.has(l));
    if (next) {
      laneReport(env, next);
      holder.track.reported.add(next);
    }
  };
}

/** Number of poll sleeps that happened before the driver opened `laneId`'s first window. */
function pollsBeforeOpen(h, laneId) {
  let polls = 0;
  for (const e of h.timeline) {
    if (e.kind === "sleep" && e.ms === POLL_MS) polls++;
    if (e.kind === "open" && e.command.endsWith(` -n ${laneId}`)) return polls;
  }
  return -1;
}

/** Nothing reached a host seam or the launch-state / lock files. */
function assertNothingStarted(env, h) {
  assert.equal(h.driver.opens.length, 0, "no window opened");
  assert.equal(h.driver.writes.length, 0, "no text sent");
  assert.equal(h.calls.featureStart.length, 0, "no agc feature start");
  assert.ok(!fs.existsSync(env.lockPath), "no lock file left behind");
}

// ---------------------------------------------------------------------------------------------------------------
// A2-1 / A2-2 — parallel limit
// ---------------------------------------------------------------------------------------------------------------

test("A2-1: a wave of four lanes under laneLaunchLimit 2 never has more than two running and starts all four", async () => {
  // WHY: the limit protects the one shared account quota; lanes over it queue and start as others finish.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: WAVE1(["t1", "t2", "t3", "t4"]), config: { laneLaunchLimit: 2 } });
  const holder = {};
  holder.h = makeDeps(env, { onPoll: finishOnePerPoll(env, holder) });
  holder.track = concurrencyTracker(holder.h.driver);
  const { h, track } = holder;
  const r = await runCore(L, env, h.deps);
  assert.equal(r.stopped, false, "the run ends on its own once every lane has reported");
  assert.equal(r.code, 0);
  assert.deepEqual(h.driver.opens.map((o) => o.lane).sort(), ["t1", "t2", "t3", "t4"], "all four started, each once");
  assert.ok(track.atOpen.every((a) => a.live <= 2), `at most two lanes open at once: ${JSON.stringify(track.atOpen)}`);
  assert.equal(pollsBeforeOpen(h, "t1"), 0);
  assert.equal(pollsBeforeOpen(h, "t2"), 0, "the first two start at once");
  assert.ok(pollsBeforeOpen(h, "t3") >= 1 && pollsBeforeOpen(h, "t4") >= 1, "the other two wait for a freed slot");
  assert.ok(h.out.includes("queued t3 — parallel limit 2"), h.out.join("\n"));
  assert.ok(h.out.includes("queued t4 — parallel limit 2"), h.out.join("\n"));
  for (const id of ["t1", "t2", "t3", "t4"]) assert.equal(laneStatus(env, id), "finished", `${id} recorded finished`);
  assert.equal(h.out.at(-1), EXIT(1));
});

test("A2-2: with no laneLaunchLimit key a wave of five lanes runs at most three at once", async () => {
  // WHY: the default (3) applies when the key is absent; the config loader fills no default itself.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: WAVE1(["t1", "t2", "t3", "t4", "t5"]) });
  const holder = {};
  holder.h = makeDeps(env, { onPoll: finishOnePerPoll(env, holder) });
  holder.track = concurrencyTracker(holder.h.driver);
  const { h, track } = holder;
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 0);
  assert.deepEqual(h.driver.opens.map((o) => o.lane).sort(), ["t1", "t2", "t3", "t4", "t5"]);
  assert.ok(track.atOpen.every((a) => a.live <= 3), `at most three lanes open at once: ${JSON.stringify(track.atOpen)}`);
  assert.equal(["t1", "t2", "t3"].filter((id) => pollsBeforeOpen(h, id) === 0).length, 3, "three start at once");
  assert.ok(h.out.includes("queued t4 — parallel limit 3"), h.out.join("\n"));
  assert.ok(h.out.includes("queued t5 — parallel limit 3"), h.out.join("\n"));
});

// ---------------------------------------------------------------------------------------------------------------
// A2-3 / A2-4 / A2-14 — dependencies (Q1 (b))
// ---------------------------------------------------------------------------------------------------------------

test("A2-3: a lane whose depended-on lane is not merged is not started and is listed as waiting on it", async (t) => {
  // WHY: a dependent lane started before its dependency merged would build on code that is not in its base.
  const L = await loadLaunch();
  const lanes = [lane("t1", "T1", 1), lane("t2", "T2", 2, ["t1"])];

  await t.test("the depended-on branch exists but is not an ancestor of main", async () => {
    const env = makeEnv({ lanes });
    makeBranch(env, "feat/t1-fx");
    laneReport(env, "t1"); // wave 1 is finished, so wave 2 is current
    const h = makeDeps(env);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.ok(h.out.includes("waiting t2 — depends on t1: branch feat/t1-fx is not an ancestor of main"), h.out.join("\n"));
    assertNothingStarted(env, h);
    assert.ok(h.calls.ancestry.length > 0 && h.calls.ancestry.every((c) => c.ref === "main"), "a later wave compares with main");
    assert.equal(h.out.at(-1), EXIT(2));
  });

  await t.test("the depended-on branch is gone and there is no finish record", async () => {
    const env = makeEnv({ lanes });
    laneReport(env, "t1");
    const h = makeDeps(env);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.ok(h.out.includes("waiting t2 — depends on t1: branch feat/t1-fx is gone and t1 has no finish record"), h.out.join("\n"));
    assertNothingStarted(env, h);
  });
});

test("A2-4: with knowledge local a merged depended-on lane without a finish record keeps its dependent waiting", async (t) => {
  // WHY: under knowledge local the dependent lane's knowledge files come from the finish copy-back, so a merge
  // alone is not enough — `agc feature finish --shipped` must have run for the depended-on lane.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1", 1), lane("t2", "T2", 2, ["t1"])], config: { artifacts: "local", knowledge: "local" } });
  makeBranch(env, "feat/t1-fx", { merge: true });
  laneReport(env, "t1");

  await t.test("no finish record: waiting, the reason names the missing finish", async () => {
    const h = makeDeps(env);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.ok(h.out.includes("waiting t2 — depends on t1: agc feature finish --shipped has not run for t1"), h.out.join("\n"));
    assertNothingStarted(env, h);
  });

  await t.test("once the finish record exists the dependent lane starts from main", async () => {
    historyRecord(env, "t1");
    let h;
    h = makeDeps(env, { onPoll: () => h.driver.opens.length > 0 && laneReport(env, "t2") });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t2"]);
    assert.equal(h.calls.featureStart.length, 1);
    assert.equal(h.calls.featureStart[0].base, "main");
  });
});

test("A2-14: after wave 1 finished and merged, wave 2 lanes whose depended-on lanes are met start from main; an unmet one waits", async () => {
  // WHY: the launcher is re-run after each 波次's pull request merged; the next wave branches from main, and
  // its prompt carries main's sha as the base.
  const L = await loadLaunch();
  const { parseManifest, renderPrompt } = await loadManifestTools();
  const env = makeEnv({
    lanes: [lane("t1", "T1", 1), lane("t2", "T2", 1), lane("t3", "T3", 2, ["t1"]), lane("t4", "T4", 2, ["t2"])],
  });
  makeBranch(env, "feat/t1-fx", { merge: true });
  makeBranch(env, "feat/t2-fx");
  laneReport(env, "t1");
  laneReport(env, "t2");
  const mainSha = gitOk(["rev-parse", "main"], env.primary);
  let h;
  h = makeDeps(env, { onPoll: () => h.driver.opens.length > 0 && laneReport(env, "t3") });
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 0);
  assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t3"], "only the lane whose dependency is met starts");
  assert.deepEqual(h.calls.featureStart, [{ primary: env.primary, slug: "t3-fx", base: "main", worktree: env.worktree("t3") }]);
  assert.ok(h.out.includes("waiting t4 — depends on t2: branch feat/t2-fx is not an ancestor of main"), h.out.join("\n"));
  assert.ok(h.calls.ancestry.every((c) => c.ref === "main"), "dependency checks of a later wave compare with main");
  const expected = renderPrompt(parseManifest(fs.readFileSync(env.manifest, "utf8")), "t3", { batch: true, base: mainSha, primary: env.primary });
  assert.ok(expected.ok, JSON.stringify(expected.errors));
  const sent = h.driver.of("t3")[0].writes.map((w) => w[0]);
  assert.ok(sent.includes(expected.prompt), "the prompt is render --batch with main's sha as the base");
});

// ---------------------------------------------------------------------------------------------------------------
// A2-5 / A2-6 — launch state and the manifest (CLI level, in-process)
// ---------------------------------------------------------------------------------------------------------------

test("A2-5: a second run starts no running or finished lane again and the launch-state file stays untracked", async () => {
  // WHY: the integrator re-runs the launcher (next wave, after a usage limit); a lane started twice would put two
  // sessions on one worktree. The state lives in the git common dir, so no tracked or untracked path appears.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: WAVE1(["t1", "t2", "t3"]) });
  const before = gitOk(["status", "--porcelain"], env.primary);

  const h1 = makeDeps(env, { maxPolls: 3, onPoll: (n) => n === 1 && laneReport(env, "t1") });
  const r1 = await runCli(L, [env.manifest], h1.deps);
  assert.equal(r1.stopped, true, "run 1 is stopped while t2 and t3 still run");
  assert.deepEqual(h1.driver.opens.map((o) => o.lane), ["t1", "t2", "t3"]);
  assert.ok(fs.existsSync(env.statePath), "launch state written to <git-common-dir>/agc-lane-launch.json");
  assert.equal(path.dirname(env.statePath), env.gitCommonDir);

  const h2 = makeDeps(env, {
    driver: h1.driver,
    onPoll: (n) => {
      if (n === 1) {
        laneReport(env, "t2");
        laneReport(env, "t3");
      }
    },
  });
  const r2 = await runCli(L, [env.manifest], h2.deps);
  assert.equal(r2.code, 0);
  assert.equal(h2.driver.opens.length, 3, "run 2 opened no window: t1 finished, t2 and t3 running");
  assert.equal(h2.calls.featureStart.length, 0, "run 2 ran no agc feature start");
  assert.ok(!h2.out.some((l) => l.startsWith("started ") || l.startsWith("resumed ")), h2.out.join("\n"));
  for (const id of ["t1", "t2", "t3"]) assert.equal(laneStatus(env, id), "finished");
  assert.equal(gitOk(["status", "--porcelain"], env.primary), before, "git status --porcelain shows no new path");
});

test("A2-6: no launcher run, a refusal included, changes the manifest's bytes", async (t) => {
  // WHY: the manifest is the human-approved plan (R4: the launcher only reads it).
  const L = await loadLaunch();
  const check = async (name, setup, expectCode, extra = () => {}) => {
    await t.test(name, async () => {
      const env = makeEnv({ lanes: WAVE1(["t1"]) });
      const sum = sha256(env.manifest);
      const opts = setup(env) ?? {};
      const h = makeDeps(env, { onPoll: () => laneReport(env, "t1"), ...opts });
      const r = await runCli(L, [env.manifest], h.deps);
      assert.equal(r.code, expectCode, [...h.out, ...h.err].join("\n"));
      assert.equal(sha256(env.manifest), sum, "manifest bytes unchanged");
      extra(env, h);
    });
  };
  await check("a run that starts and finishes a lane", () => {}, 0);
  await check("a manifest-phase refusal (tier off)", (env) => writeConfig(env.primary, { cutApprovalAutoTier: { manifest: false } }), 1);
  await check("a host-phase refusal (no iTerm2)", () => ({ iterm: false }), 1);
  await check(
    "a refusal because another run holds the lock",
    (env) => {
      alivePids.add(424242);
      fs.writeFileSync(env.lockPath, JSON.stringify({ pid: 424242, startedAt: "2026-11-27T08:00:00.000Z" }));
    },
    1,
    (env, h) => {
      assert.ok(h.err.includes(REFUSED("another lane-launch run is active (pid 424242); stop it first")), h.err.join("\n"));
      assert.equal(h.driver.opens.length, 0, "nothing started");
      assert.equal(JSON.parse(fs.readFileSync(env.lockPath, "utf8")).pid, 424242, "the live run's lock is left alone");
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// A2-11 / A2-12 / A2-22 — manifest refusals
// ---------------------------------------------------------------------------------------------------------------

test("A2-11: no 人類 Decisions row, or cutApprovalAutoTier.manifest not true, refuses, names the reason, exits non-zero and starts nothing", async (t) => {
  // WHY: batch lanes skip typed approval only under an approved manifest and the manifest tier.
  const L = await loadLaunch();
  await t.test("no 人類 Decisions row", async () => {
    const env = makeEnv({ lanes: WAVE1(["t1"]), human: false });
    const h = makeDeps(env);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 1);
    assert.ok(h.err.includes(REFUSED("the manifest has no 人類 Decisions row")), h.err.join("\n"));
    assertNothingStarted(env, h);
    assert.equal(h.calls.iterm, 0, "manifest refusals come before any host probe");
    assert.ok(!fs.existsSync(env.statePath), "no launch state written");
  });
  for (const [name, cfg] of [
    ["cutApprovalAutoTier.manifest false", { cutApprovalAutoTier: { manifest: false } }],
    ["no cutApprovalAutoTier key", {}],
  ]) {
    await t.test(name, async () => {
      const env = makeEnv({ lanes: WAVE1(["t1"]) });
      writeConfig(env.primary, cfg);
      const h = makeDeps(env);
      const r = await runCore(L, env, h.deps);
      assert.equal(r.code, 1);
      assert.ok(h.err.includes(REFUSED("cutApprovalAutoTier.manifest is not true in .current/.config.json")), h.err.join("\n"));
      assertNothingStarted(env, h);
    });
  }
  await t.test("CLI level (in-process): exit 1, refusal on stderr", async () => {
    const env = makeEnv({ lanes: WAVE1(["t1"]), tier: false });
    const h = makeDeps(env);
    const r = await runCli(L, [env.manifest], h.deps);
    assert.equal(r.code, 1);
    assert.ok(h.err.includes(REFUSED("cutApprovalAutoTier.manifest is not true in .current/.config.json")), h.err.join("\n"));
    assert.equal(h.out.length, 0, "nothing on stdout");
  });
  await t.test("the real script: exit 1, refusal on stderr, nothing started", () => {
    const env = makeEnv({ lanes: WAVE1(["t1"]), human: false });
    const sum = sha256(env.manifest);
    const r = spawnCli(env, [env.manifest]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.ok(r.stderr.split("\n").includes(REFUSED("the manifest has no 人類 Decisions row")), r.stderr);
    assert.ok(!/^started /m.test(r.stdout), r.stdout);
    assert.ok(!fs.existsSync(env.statePath) && !fs.existsSync(env.lockPath));
    assert.equal(sha256(env.manifest), sum);
  });
});

test("A2-12: a manifest with no 波次 column is refused with the reason and a non-zero exit", async (t) => {
  // WHY: without 波次 the launcher cannot tell which lanes may run together; such a wave stays hand-started.
  const L = await loadLaunch();
  const NO_WAVE = REFUSED("the manifest has no 波次 column; add it at Stage 1 or start the lanes by hand");
  await t.test("core", async () => {
    const env = makeEnv({ lanes: WAVE1(["t1", "t2"]), wave: false });
    const h = makeDeps(env);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 1);
    assert.ok(h.err.includes(NO_WAVE), h.err.join("\n"));
    assertNothingStarted(env, h);
  });
  await t.test("the real script", () => {
    const env = makeEnv({ lanes: WAVE1(["t1"]), wave: false });
    const r = spawnCli(env, [env.manifest]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.ok(r.stderr.split("\n").includes(NO_WAVE), r.stderr);
  });
  await t.test("the real script: a usage error (no manifest argument, unreadable manifest) exits 2", () => {
    const env = makeEnv({ lanes: WAVE1(["t1"]) });
    const none = spawnCli(env, []);
    assert.equal(none.status, 2, none.stdout + none.stderr);
    assert.ok(none.stderr.includes("usage: node scripts/lane-launch.mjs <manifest>"), none.stderr);
    const missing = spawnCli(env, [path.join(env.primary, "specs", "no-such-manifest.md")]);
    assert.equal(missing.status, 2, missing.stdout + missing.stderr);
  });
});

test("A2-22: a 相依 cell naming a lane of the same 波次 refuses the run, naming both lanes and the wave", async () => {
  // WHY (G1 (b)): two lanes of one wave run at the same time, so a dependency between them cannot be met; the
  // integrator moves the dependent lane to a later wave at Stage 1.
  const L = await loadLaunch();
  const env = makeEnv({
    lanes: [lane("t1", "T1", 1), lane("t2", "T2", 1, ["t1"]), lane("t3", "T3", 2), lane("t4", "T4", 2, ["t3"])],
  });
  const h = makeDeps(env);
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 1);
  assert.ok(h.err.includes(REFUSED("lane t2 depends on t1 in the same wave 1; move t2 to a later wave")), h.err.join("\n"));
  assert.ok(h.err.includes(REFUSED("lane t4 depends on t3 in the same wave 2; move t4 to a later wave")), "one line per pair, any wave");
  assert.ok(!h.err.some((l) => l.includes("does not validate")), "same-wave dependencies are valid manifest format");
  assertNothingStarted(env, h);
});

// ---------------------------------------------------------------------------------------------------------------
// A2-13 — batch-lane filter
// ---------------------------------------------------------------------------------------------------------------

test("A2-13: a lane with approval human or a ticket without a ticket file is not started and listed; the others start", async () => {
  // WHY: only batch lanes (lane-protocol §3) may run without typed approval.
  const L = await loadLaunch();
  const env = makeEnv({
    approval: true,
    lanes: [
      { ...lane("t1", "T1"), approval: "human" },
      lane("t2", "T9"),
      lane("t3", "T3"),
    ],
  });
  let h;
  h = makeDeps(env, { onPoll: () => h.driver.opens.length > 0 && laneReport(env, "t3") });
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 0);
  assert.ok(h.out.includes("not started t1 — approval is human"), h.out.join("\n"));
  assert.ok(h.out.includes("not started t2 — no ticket file for T9"), h.out.join("\n"));
  assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t3"]);
  assert.deepEqual(h.calls.featureStart.map((c) => c.slug), ["t3-fx"]);
  assert.ok(!fs.existsSync(env.worktree("t1")) && !fs.existsSync(env.worktree("t2")), "no worktree for a lane not started");
});

// ---------------------------------------------------------------------------------------------------------------
// A2-26 / A2-27 — the finished signal (Q2 (a))
// ---------------------------------------------------------------------------------------------------------------

test("A2-26: progress reports never finish a lane: it stays running, keeps its slot and the queued lane waits", async (t) => {
  // WHY: lanes send a type: report at every hop; freeing the slot on one would start a lane over the limit.
  const L = await loadLaunch();
  const lanes = [{ lane: "t1", tickets: ["T1", "T1B"], wave: 1 }, lane("t2", "T2")];

  await t.test("only progress reports, tickets not stopped", async () => {
    const env = makeEnv({ lanes, config: { laneLaunchLimit: 1 } });
    const h = makeDeps(env, { maxPolls: 4, onPoll: (n) => progressReport(env, "t1", n) });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.stopped, true, "the run keeps polling");
    assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t1"], "the queued lane is not started");
    assert.equal(laneStatus(env, "t1"), "running");
    assert.ok(!h.out.some((l) => l.startsWith("finished t1")), h.out.join("\n"));
    assert.ok(h.out.includes("queued t2 — parallel limit 1"), h.out.join("\n"));
  });

  await t.test("a progress report sent before the batch stop does not count as the report after it", async () => {
    const env = makeEnv({ lanes, config: { laneLaunchLimit: 1 } });
    const h = makeDeps(env, {
      maxPolls: 5,
      onPoll: (n) => {
        if (n === 1) progressReport(env, "t1");
        if (n === 2) {
          setTicketStatus(env, "t1", "T1", "stopped — vendor firmware not available yet");
          setTicketStatus(env, "t1", "T1B", "done");
        }
      },
    });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.stopped, true);
    assert.deepEqual(h.driver.opens.map((o) => o.lane), ["t1"]);
    assert.equal(laneStatus(env, "t1"), "running");
  });
});

test("A2-27: a lane report, or a report while every ticket is done or stopped (one stopped), finishes the lane and frees its slot", async (t) => {
  // WHY: the two final reports of lane-protocol §6 and §3 (e); only they hand the slot to the queued lane.
  const L = await loadLaunch();
  const lanes = [{ lane: "t1", tickets: ["T1", "T1B"], wave: 1 }, lane("t2", "T2")];

  await t.test("a type: report whose body starts with ## Lane report:", async () => {
    const env = makeEnv({ lanes, config: { laneLaunchLimit: 1 } });
    let h;
    h = makeDeps(env, {
      onPoll: (n) => {
        if (n === 1) laneReport(env, "t1");
        else if (h.driver.of("t2").length > 0) laneReport(env, "t2");
      },
    });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.equal(laneStatus(env, "t1"), "finished");
    const fin = h.out.indexOf("finished t1 — lane report");
    const start2 = h.out.findIndex((l) => l.startsWith("started t2 — window "));
    assert.ok(fin >= 0 && start2 > fin, h.out.join("\n"));
    assert.equal(pollsBeforeOpen(h, "t2"), 1);
  });

  await t.test("a batch stop: tickets done / stopped, then a report with any body", async () => {
    const env = makeEnv({ lanes, config: { laneLaunchLimit: 1 } });
    let h;
    h = makeDeps(env, {
      onPoll: (n) => {
        if (n === 1) progressReport(env, "t1");
        if (n === 2) {
          setTicketStatus(env, "t1", "T1", "stopped — vendor firmware not available yet");
          setTicketStatus(env, "t1", "T1B", "done");
        }
        if (n === 3) postMessage(env, "t1", { body: "ticket T1 stopped: the vendor firmware question needs a ruling" });
        if (n > 3 && h.driver.of("t2").length > 0) laneReport(env, "t2");
      },
    });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.equal(laneStatus(env, "t1"), "finished");
    assert.ok(h.out.includes("finished t1 — batch stop"), h.out.join("\n"));
    assert.equal(pollsBeforeOpen(h, "t2"), 3, "the queued lane starts only after the report that follows the stop");
  });
});
