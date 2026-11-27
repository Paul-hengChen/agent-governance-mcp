// Coded by @qa-engineer
// Tests (T-E443B-01) for specs/e443b-lane-launcher.md A2-7..A2-10, A2-15..A2-18: how the lane launcher drives a
// lane's window (tools/lane-launch.ts) — starting a session, the two sends, usage-limit pauses, the wake line,
// Enter, window-gone resume, the Unknown command retry and the host pre-checks.
// WHY: a lane cut off by a usage limit or a closed window must not be lost and must not be restarted from
// scratch (no second `agc feature start`, nothing written under its .current/, its dispatch_pins untouched);
// a weekly limit must never be woken automatically; the prompt a lane receives must be exactly
// `fanout.mjs render --batch`'s output; and a host that would switch a lane's model or turn automatic continue
// off is refused before anything starts.
// Seams: test/fixtures/e443b/harness.mjs — a scripted window driver (its windows show the ready marker; tests
// append host lines between polls), a fake clock, temp host settings paths, a feature-start runner that only
// runs `git worktree add` in a temp primary. No real iTerm2, session or `agc feature start`. Each title starts
// with its AC id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ROOT,
  loadLaunch,
  loadManifestTools,
  makeEnv,
  makeDeps,
  runCore,
  cleanup,
  laneStatus,
  laneRecord,
  laneReport,
  writeJson,
  treeSnapshot,
  gitOk,
  SLASH,
  WAKE,
  SIG,
} from "./fixtures/e443b/harness.mjs";

after(cleanup);

const lane = (id, ticket, wave = 1) => ({ lane: id, tickets: [ticket], wave, deps: [] });
const REFUSED = (reason) => `lane-launch: refused — ${reason}`;
const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const launchCmd = (wt, id) => `cd ${quote(wt)} && claude --permission-mode bypassPermissions -n ${id}`;

/** The lane's `render --batch` prompt for base `base`, as the launcher must send it. */
async function batchPrompt(env, id, base) {
  const { parseManifest, renderPrompt } = await loadManifestTools();
  const r = renderPrompt(parseManifest(fs.readFileSync(env.manifest, "utf8")), id, { batch: true, base, primary: env.primary });
  assert.ok(r.ok, JSON.stringify(r.errors));
  return r.prompt;
}

/** A lane-local handoff with dispatch_pins under the worktree's .current/, to prove nothing there is written. */
function seedLaneCurrent(env, id) {
  const file = path.join(env.worktree(id), ".current", id, "handoff.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\nactive_feature: "${id}-fx"\nstatus: "In_Progress"\ndispatch_pins:\n  sr-engineer: "opus"\n---\n# Handoff State\n`);
}

const START_SENDS = (prompt) => [
  [SLASH, false],
  ["", true],
  [prompt, false],
  ["", true],
];

// ---------------------------------------------------------------------------------------------------------------
// A2-7 — weekly limit
// ---------------------------------------------------------------------------------------------------------------

test("A2-7: a weekly-limit line with no Continuing automatically at after it pauses the lane as paused-weekly, never woken; others continue", async () => {
  // WHY: a weekly limit lasts days; waking it would only hit the limit again. Automatic continue (a
  // `Continuing automatically at` line after it) means the host itself resumes, so that lane keeps running.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1"), lane("t2", "T2")] });
  const h1 = makeDeps(env, {
    onPoll: (n) => {
      if (n === 1) {
        h1.driver.show("t1", SIG.weekly);
        h1.driver.show("t2", SIG.weekly);
        h1.driver.show("t2", SIG.continuing);
      }
      if (n === 3) laneReport(env, "t2");
    },
  });
  const r1 = await runCore(L, env, h1.deps);
  assert.equal(r1.code, 0, "no lane left running: t1 paused, t2 finished");
  assert.ok(h1.out.includes("paused t1 — weekly limit, no automatic wake"), h1.out.join("\n"));
  assert.ok(!h1.out.some((l) => l.startsWith("paused t2")), "weekly + Continuing automatically at: not paused");
  assert.equal(laneStatus(env, "t1"), "paused-weekly");
  assert.equal(laneStatus(env, "t2"), "finished");
  const t1win = h1.driver.of("t1")[0];
  assert.equal(t1win.writes.length, 4, "only the two start sends reached t1 (no Enter, no wake)");

  const h2 = makeDeps(env, { driver: h1.driver, maxPolls: 3 });
  const r2 = await runCore(L, env, h2.deps);
  assert.equal(r2.code, 0);
  assert.equal(t1win.writes.length, 4, "a later run sends nothing to a paused-weekly lane");
  assert.equal(h2.driver.opens.length, 2, "and opens no window");
  assert.ok(!h2.out.some((l) => l.startsWith("woken t1")), h2.out.join("\n"));
  assert.equal(laneStatus(env, "t1"), "paused-weekly");
});

// ---------------------------------------------------------------------------------------------------------------
// A2-8 — automatic continue stopped, then the wake line
// ---------------------------------------------------------------------------------------------------------------

test("A2-8: Automatic continue stopped marks paused-stopped; the next run sends the wake line into the same window only", async () => {
  // WHY: after the limit resets the lane resumes in its own session (Crash-Resume), with its pins and state
  // untouched: no new window, no agc feature start, no write under its .current/.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1")] });
  const h1 = makeDeps(env, { onPoll: (n) => n === 1 && h1.driver.show("t1", SIG.stopped) });
  const r1 = await runCore(L, env, h1.deps);
  assert.equal(r1.code, 0);
  assert.ok(h1.out.includes("paused t1 — automatic continue stopped; re-run the launcher after the limit resets"), h1.out.join("\n"));
  assert.equal(laneStatus(env, "t1"), "paused-stopped");

  seedLaneCurrent(env, "t1");
  const snap = treeSnapshot(path.join(env.worktree("t1"), ".current"));
  const win = h1.driver.of("t1")[0];
  const before = win.writes.length;
  const h2 = makeDeps(env, { driver: h1.driver, onPoll: (n) => n === 2 && laneReport(env, "t1") });
  const r2 = await runCore(L, env, h2.deps);
  assert.equal(r2.code, 0);
  assert.deepEqual(win.writes.slice(before), [[WAKE, false], ["", true]], "one wake send into the same window");
  assert.equal(h2.driver.opens.length, 1, "no new window");
  assert.equal(h2.calls.featureStart.length, 0, "no agc feature start");
  assert.ok(h2.out.includes(`woken t1 — window ${win.id}`), h2.out.join("\n"));
  assert.ok(!h2.out.some((l) => l.startsWith("paused t1")), "the old stopped line does not pause it again after the wake");
  assert.equal(laneStatus(env, "t1"), "finished");
  assert.deepEqual(treeSnapshot(path.join(env.worktree("t1"), ".current")), snap, "nothing under the worktree's .current/ changed");
});

// ---------------------------------------------------------------------------------------------------------------
// A2-9 — Press enter to continue
// ---------------------------------------------------------------------------------------------------------------

test("A2-9: Press enter to continue gets one empty write text from the launcher and the lane stays running", async () => {
  // WHY: the host waits for a key after some limit notices; nobody is at the keyboard of a batch lane.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1")] });
  const h = makeDeps(env, {
    onPoll: (n) => {
      if (n === 1) h.driver.show("t1", SIG.enter);
      if (n === 3) laneReport(env, "t1");
    },
  });
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 0);
  const win = h.driver.of("t1")[0];
  assert.deepEqual(win.writes.slice(4), [["", true]], "exactly one empty write text, sent once");
  assert.ok(h.out.includes("entered t1 — Press enter to continue"), h.out.join("\n"));
  assert.ok(!h.out.some((l) => l.startsWith("paused t1") || l.startsWith("window gone t1")), h.out.join("\n"));
  assert.ok(h.out.includes("finished t1 — lane report"), "it stayed running until its report");
});

// ---------------------------------------------------------------------------------------------------------------
// A2-10 — window gone, then resume
// ---------------------------------------------------------------------------------------------------------------

test("A2-10: a lane whose window closed is not finished and is resumed in a new window in the same worktree", async () => {
  // WHY: a stray click must not lose a lane, and must not count as its final report.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1")] });
  const h1 = makeDeps(env, {
    onPoll: (n) => {
      if (n === 1) h1.driver.of("t1")[0].exists = false;
    },
  });
  const r1 = await runCore(L, env, h1.deps);
  assert.equal(r1.code, 0);
  assert.ok(h1.out.includes("window gone t1 — not finished; the next run resumes it"), h1.out.join("\n"));
  assert.ok(!h1.out.some((l) => l.startsWith("finished t1")), "not reported as finished");
  assert.equal(laneStatus(env, "t1"), "window-gone");
  const first = h1.driver.of("t1")[0];

  seedLaneCurrent(env, "t1");
  const snap = treeSnapshot(path.join(env.worktree("t1"), ".current"));
  const h2 = makeDeps(env, { driver: h1.driver, onPoll: (n) => n === 1 && laneReport(env, "t1") });
  const r2 = await runCore(L, env, h2.deps);
  assert.equal(r2.code, 0);
  const wins = h2.driver.of("t1");
  assert.equal(wins.length, 2, "a new window");
  assert.equal(wins[1].command, first.command, "same worktree, same launch command");
  assert.equal(h2.calls.featureStart.length, 0, "no agc feature start");
  assert.deepEqual(wins[1].writes, first.writes, "the same slash-command line and the same render --batch output");
  assert.deepEqual(wins[1].writes, START_SENDS(await batchPrompt(env, "t1", env.baseSha)));
  assert.ok(h2.out.includes(`resumed t1 — window ${wins[1].id} (its window was gone)`), h2.out.join("\n"));
  assert.deepEqual(treeSnapshot(path.join(env.worktree("t1"), ".current")), snap, "nothing under the worktree's .current/ changed");
});

// ---------------------------------------------------------------------------------------------------------------
// A2-15 / A2-16 — starting a lane
// ---------------------------------------------------------------------------------------------------------------

test("A2-15: a new lane gets one agc feature start and its session opens in the new worktree; an existing worktree is reused", async (t) => {
  // WHY: the launcher replaces the human's lane-protocol §1 step 1; it must never create a worktree twice.
  const L = await loadLaunch();

  await t.test("new lane", async () => {
    const env = makeEnv({ lanes: [lane("t1", "T1")] });
    const h = makeDeps(env, { onPoll: () => laneReport(env, "t1") });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.deepEqual(h.calls.featureStart, [{ primary: env.primary, slug: "t1-fx", base: env.baseSha, worktree: env.worktree("t1") }]);
    assert.equal(h.driver.opens.length, 1);
    assert.equal(h.driver.opens[0].command, launchCmd(env.worktree("t1"), "t1"), "the session opens in the new worktree");
    assert.ok(h.out.includes(`started t1 — window ${h.driver.opens[0].id}`), h.out.join("\n"));
  });

  await t.test("existing worktree: creation skipped", async () => {
    const env = makeEnv({ lanes: [lane("t1", "T1")] });
    gitOk(["worktree", "add", "-q", "-b", "feat/t1-fx", env.worktree("t1"), env.baseSha], env.primary);
    const h = makeDeps(env, { onPoll: () => laneReport(env, "t1") });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.equal(h.calls.featureStart.length, 0, "no agc feature start for an existing worktree");
    assert.equal(h.driver.opens[0].command, launchCmd(env.worktree("t1"), "t1"));
  });

  await t.test("agc feature start failing leaves the lane not started", async () => {
    const env = makeEnv({ lanes: [lane("t1", "T1")] });
    const h = makeDeps(env, { featureStartFails: "fatal: invalid reference: nope" });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.ok(h.out.includes("not started t1 — agc feature start failed: fatal: invalid reference: nope"), h.out.join("\n"));
    assert.equal(h.driver.opens.length, 0);
  });

  await t.test("the real runner's argv and the launch command's quoting", async () => {
    const req = { primary: "/p", slug: "t1-fx", base: "main", worktree: "/w/t1" };
    assert.deepEqual(L.featureStartArgv("/agc", req), [
      path.join("/agc", "bin", "agc-init.mjs"),
      "feature",
      "start",
      "t1-fx",
      "--base",
      "main",
      "--path",
      "/w/t1",
    ]);
    // A worktree path with a quote, a space and shell metacharacters stays one literal word.
    const odd = "/tmp/it's a $(lane) `x` dir";
    assert.equal(L.launchCommand(odd, "t1"), launchCmd(odd, "t1"));
    assert.equal(L.shellQuote(""), "''");
  });
});

test("A2-16: the CLI starts with no prompt; the slash line, then the render --batch output in one write text, each followed by an empty write text", async () => {
  // WHY: Phase 0 verified this exact send method; the prompt must equal the integrator's own render output so
  // a launcher-started lane gets the same instructions as a hand-started one.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1")] });
  const h = makeDeps(env, { onPoll: () => laneReport(env, "t1") });
  const r = await runCore(L, env, h.deps);
  assert.equal(r.code, 0);
  const win = h.driver.of("t1")[0];
  assert.equal(win.command, launchCmd(env.worktree("t1"), "t1"), "the typed command is exactly the launch command");

  const prompt = await batchPrompt(env, "t1", env.baseSha);
  const cli = spawnSync(process.execPath, [path.join(ROOT, "scripts", "fanout.mjs"), "render", env.manifest, "t1", "--batch", "--base", env.baseSha], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(prompt, cli.stdout, "renderPrompt batch output == fanout.mjs render --batch --base <sha> stdout");
  assert.deepEqual(win.writes, START_SENDS(cli.stdout), "slash line first, then the whole prompt in one write text");

  // Timing (Decision 9): a 6 s settle after the ready marker, 0.5 s between the text and the empty write text.
  const ev = h.timeline;
  const at = (pred, from = 0) => ev.findIndex((e, i) => i >= from && pred(e));
  const open = at((e) => e.kind === "open");
  const slash = at((e) => e.kind === "write" && e.text === SLASH);
  const settle = at((e) => e.kind === "sleep" && e.ms === 6000, open);
  assert.ok(open >= 0 && settle > open && settle < slash, "6 s settle after the window opens, before the first send");
  for (const text of [SLASH, cli.stdout]) {
    const w = at((e) => e.kind === "write" && e.text === text);
    const empty = at((e) => e.kind === "write" && e.text === "", w);
    const sleeps = ev.slice(w + 1, empty).filter((e) => e.kind === "sleep").map((e) => e.ms);
    assert.deepEqual(sleeps, [500], "0.5 s between a send's text and its empty write text");
  }
});

// ---------------------------------------------------------------------------------------------------------------
// A2-17 — Unknown command
// ---------------------------------------------------------------------------------------------------------------

test("A2-17: Unknown command after the slash line is resent at most 3 times, then the lane is start-failed and frees its slot", async (t) => {
  // WHY: right after start the MCP server may not be connected yet; a bounded retry covers that without
  // holding a slot forever.
  const L = await loadLaunch();
  const lanes = [lane("t1", "T1"), lane("t2", "T2")];

  await t.test("always Unknown command: start-failed after the third resend; the queued lane starts", async () => {
    const env = makeEnv({ lanes, config: { laneLaunchLimit: 1 } });
    const h = makeDeps(env, { onPoll: () => h.driver.of("t2").length > 0 && laneReport(env, "t2") });
    h.driver.unknownOnSlash.set("t1", Infinity);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    const win = h.driver.of("t1")[0];
    const slashes = win.writes.filter((w) => w[0] === SLASH).length;
    assert.equal(slashes, 4, "the slash line plus 3 resends");
    assert.ok(!win.writes.some((w) => w[0].startsWith("開始做")), "the prompt is never sent");
    assert.equal(laneStatus(env, "t1"), "start-failed");
    assert.equal(laneRecord(env, "t1").reason, "Unknown command after 3 resends");
    assert.ok(h.out.includes("start failed t1 — Unknown command after 3 resends"), h.out.join("\n"));
    assert.equal(h.driver.of("t2").length, 1, "the freed slot starts the queued lane");
    // resends 10 s apart
    const idx = h.timeline.map((e, i) => (e.kind === "write" && e.text === SLASH && e.id === win.id ? i : -1)).filter((i) => i >= 0);
    for (let k = 1; k < idx.length; k++) {
      const gap = h.timeline.slice(idx[k - 1], idx[k]).filter((e) => e.kind === "sleep").reduce((s, e) => s + e.ms, 0);
      assert.ok(gap >= 10_000, `resend ${k} came ${gap} ms after the previous send`);
    }
  });

  await t.test("one Unknown command, then accepted: one resend, then the prompt", async () => {
    const env = makeEnv({ lanes: [lane("t1", "T1")] });
    const h = makeDeps(env, { onPoll: () => laneReport(env, "t1") });
    h.driver.unknownOnSlash.set("t1", 1);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    const prompt = await batchPrompt(env, "t1", env.baseSha);
    assert.deepEqual(h.driver.of("t1")[0].writes, [[SLASH, false], ["", true], ...START_SENDS(prompt)]);
    assert.equal(laneStatus(env, "t1"), "finished");
  });

  await t.test("no ready marker within 120 s: start-failed", async () => {
    const env = makeEnv({ lanes: [lane("t1", "T1")] });
    const h = makeDeps(env);
    h.driver.ready = false;
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.ok(h.out.includes("start failed t1 — not ready after 120 s"), h.out.join("\n"));
    assert.equal(h.driver.of("t1")[0].writes.length, 0, "nothing sent to a session that never became ready");
    assert.equal(laneStatus(env, "t1"), "start-failed");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A2-18 — host pre-checks
// ---------------------------------------------------------------------------------------------------------------

test("A2-18: no trust entry, no iTerm2, autoContinueAtUsageLimit in project/local settings, or fallbackModel anywhere refuses, naming the cause", async (t) => {
  // WHY: an untrusted folder stalls the session on a dialog nobody answers; autoContinueAtUsageLimit in a
  // project or local file turns automatic continue off; fallbackModel would switch a lane's model.
  const L = await loadLaunch();
  const AUTO = (f) => REFUSED(`${f} sets autoContinueAtUsageLimit; remove it (a project or local settings file that sets it turns automatic continue off)`);
  const FALLBACK = (f) => REFUSED(`${f} sets fallbackModel; remove it (a lane never switches its role's model)`);
  const TRUST = REFUSED(
    'the primary checkout has no trust entry of its own in ~/.claude.json; run claude once in the primary checkout and choose "Yes, I trust this folder"',
  );

  const refuses = async (name, { trust = true, iterm = true, setup = () => {} }, expected) => {
    await t.test(name, async () => {
      const env = makeEnv({ lanes: [lane("t1", "T1")], trust });
      const line = setup(env) ?? expected;
      const h = makeDeps(env, { iterm });
      const r = await runCore(L, env, h.deps);
      assert.equal(r.code, 1, [...h.out, ...h.err].join("\n"));
      assert.ok(h.err.includes(typeof line === "string" ? line : expected), h.err.join("\n"));
      assert.equal(h.driver.opens.length, 0, "no window");
      assert.equal(h.calls.featureStart.length, 0, "no agc feature start");
      assert.ok(!fs.existsSync(env.statePath) && !fs.existsSync(env.lockPath), "nothing recorded");
    });
  };

  await refuses("no trust entry at all", { trust: false }, TRUST);
  await refuses(
    "a trust entry only for a parent directory",
    { trust: false, setup: (env) => writeJson(env.host.claudeJson, { projects: { [env.dir]: { hasTrustDialogAccepted: true } } }) },
    TRUST,
  );
  await refuses("no iTerm2", { iterm: false }, REFUSED("iTerm2 is not installed; only iTerm2 is supported"));
  await refuses("autoContinueAtUsageLimit in the primary's project settings", {
    setup: (env) => {
      const f = path.join(env.primary, ".claude", "settings.json");
      writeJson(f, { autoContinueAtUsageLimit: false });
      return AUTO(f);
    },
  });
  await refuses("autoContinueAtUsageLimit in the primary's local settings", {
    setup: (env) => {
      const f = path.join(env.primary, ".claude", "settings.local.json");
      writeJson(f, { autoContinueAtUsageLimit: true });
      return AUTO(f);
    },
  });
  await refuses("fallbackModel in user settings", {
    setup: (env) => {
      writeJson(env.host.userSettings, { fallbackModel: "sonnet" });
      return FALLBACK(env.host.userSettings);
    },
  });
  await refuses("fallbackModel in a managed-settings drop-in", {
    setup: (env) => {
      const f = path.join(env.host.managedDropInDir, "10-models.json");
      writeJson(f, { fallbackModel: "haiku" });
      return FALLBACK(f);
    },
  });
  await refuses("fallbackModel in an existing lane worktree's local settings", {
    setup: (env) => {
      gitOk(["worktree", "add", "-q", "-b", "feat/t1-fx", env.worktree("t1"), env.baseSha], env.primary);
      const f = path.join(env.worktree("t1"), ".claude", "settings.local.json");
      writeJson(f, { fallbackModel: "sonnet" });
      return FALLBACK(f);
    },
  });

  await t.test("autoContinueAtUsageLimit in user settings is not a refusal (only project and local files turn it off)", async () => {
    const env = makeEnv({ lanes: [lane("t1", "T1")] });
    writeJson(env.host.userSettings, { autoContinueAtUsageLimit: true });
    const h = makeDeps(env, { onPoll: () => laneReport(env, "t1") });
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0, h.err.join("\n"));
    assert.equal(h.driver.opens.length, 1);
  });
});
