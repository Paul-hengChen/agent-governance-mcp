// Coded by @qa-engineer
// Tests (T-E466-03) for docs/tickets/E466.md S3 and S4 (specs/e466-conductor.md Build contract S3/S4, Copy /
// Strings integrator.slash, takeover.line, state.line, out.opened, out.closed, usage.line; architecture
// specs/e466-conductor-architecture.md §B/§D/§E).
// WHY (S3): the conductor opens a fresh integrator per wave. It must open exactly one window, start the integrator
// prompt the way the lane launcher starts sessions (ready wait, then the launcher's send method: text without a
// newline, then an empty write with one — a direct write with a newline is not reliably submitted), hand it the
// take-over line naming the manifest and the wave, and remember the window. Closing must send `/exit` to that
// recorded window and nothing else: any other window may be a lane or a human session.
// WHY (S4): the conductor is the only long-lived session; when it is lost, a fresh one must continue from the same
// manifest, wave, window and step. The state lives in the git common dir so every worktree sees the same file and
// it can never be committed; an unreadable state is refused, never overwritten (that would lose the run).
// Driven through runConductorCli (the argv the real script passes) over ConductorDeps stand-ins (scripted window
// driver, fake clock, recording gh / handoff / launcher seams) and a temp git primary. No iTerm2.
// Every title starts with its scenario id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import {
  loadConductor, loadLaunch, makeEnv, makeDeps, cleanup, cli, sent, dump, readState, gitOk, git,
  INTEGRATOR_SLASH, EXIT, OUT, USAGE, STATE_FILE, MAILBOX_DIR, SCRIPT, takeoverLine,
} from "./fixtures/e466/harness.mjs";

after(cleanup);

// ---------------------------------------------------------------------------------------------------------------
// S3 — opening and closing an integrator window
// ---------------------------------------------------------------------------------------------------------------

test("S3: open --manifest <m> --wave 2 opens one window, sends the integrator prompt line then 接手 <manifest>，開始第 2 波次 with the launcher's send method and records the window id; close sends /exit to that window only", async () => {
  const C = await loadConductor();
  const L = await loadLaunch();
  const env = makeEnv();
  const h = makeDeps();
  // Another window already open (a lane, a human session): it must never receive anything.
  const decoy = await h.driver.open("cd '/elsewhere' && claude -n t1");
  const opensBefore = h.driver.opens.length;

  const code = await cli(C, env, ["open", "--manifest", env.manifest, "--wave", "2"], h);
  assert.equal(code, 0, dump(h));

  // Exactly one new window, started the way the launcher starts a session, in primary, named integrator.
  assert.equal(h.driver.opens.length, opensBefore + 1, "exactly one window opened");
  const opened = h.driver.opens.at(-1);
  assert.equal(opened.command, L.launchCommand(env.primary, "integrator"), "the launcher's launch command for primary, named integrator");
  const win = h.driver.win(opened.id);

  // The integrator prompt line, then the take-over line naming the manifest (primary-relative) and wave 2,
  // each with sendText: [text, no newline], then ["", newline].
  assert.deepEqual(win.writes, sent(INTEGRATOR_SLASH, takeoverLine(env.manifestKey, 2)), "slash line then take-over line, each via sendText");
  assert.equal(takeoverLine(env.manifestKey, 2), "接手 specs/fanout-e466-fixture.md，開始第 2 波次", "sanity: takeover.line verbatim");
  assert.ok(h.out.includes(OUT.opened(2, opened.id)), dump(h));

  // The window id is recorded.
  const st = readState(env);
  assert.equal(st.windowId, opened.id, "state records the window id");
  assert.equal(st.wave, 2);
  assert.equal(st.manifest, env.manifestKey);
  assert.equal(st.step, "integrator-open");

  // close: /exit with sendText to the recorded window only.
  const before = win.writes.length;
  const hc = makeDeps({ driver: h.driver });
  const cc = await cli(C, env, ["close"], hc);
  assert.equal(cc, 0, dump(hc));
  assert.deepEqual(win.writes.slice(before), sent(EXIT), "/exit via sendText into the recorded window");
  assert.deepEqual(h.driver.win(decoy).writes, [], "the other window got nothing");
  assert.equal(hc.driver.opens.length, opensBefore + 1, "close opens no window");
  assert.ok(hc.out.includes(OUT.closed(opened.id)), dump(hc));
  assert.equal(hc.calls.closeFinished.length + hc.calls.prState.length + hc.calls.handoffCheck.length, 0, "close touches no other seam");

  // Boundary argv (security smoke): usage, exit 2, nothing opened or sent.
  const bad = [
    [],
    ["bogus"],
    ["open"],
    ["open", "--manifest", env.manifest],
    ["open", "--manifest", env.manifest, "--wave", "0"],
    ["open", "--manifest", env.manifest, "--wave", "two"],
    ["open", "--manifest", env.manifest, "--wave", "2", "--record", env.record],
    ["open", "--record", ""],
    ["close", "--force"],
    ["state", "x".repeat(100_000)],
  ];
  for (const argv of bad) {
    const hb = makeDeps({ driver: h.driver });
    const windowsBefore = h.driver.windows.size;
    const r = await cli(C, env, argv, hb);
    assert.equal(r, 2, `argv ${JSON.stringify(argv).slice(0, 80)} → exit 2\n${dump(hb)}`);
    assert.ok(hb.err.includes(USAGE) || hb.err.some((l) => l.includes(USAGE)), `usage line printed for ${JSON.stringify(argv).slice(0, 80)}`);
    assert.equal(h.driver.windows.size, windowsBefore, "no window opened on bad argv");
  }
  assert.deepEqual(h.driver.win(decoy).writes, [], "the other window still got nothing");
});

// ---------------------------------------------------------------------------------------------------------------
// S4 — state survives a lost conductor
// ---------------------------------------------------------------------------------------------------------------

test("S4: a fresh conductor reads the same manifest, wave, window id and step from agc-conductor.json in the git common dir, which is not tracked; an unparseable state is refused, not overwritten", async () => {
  const C = await loadConductor();
  const env = makeEnv();
  const h = makeDeps();
  assert.equal(await cli(C, env, ["open", "--manifest", env.manifest, "--wave", "2"], h), 0, dump(h));
  const id = h.driver.opens.at(-1).id;

  // The file sits in the directory `git rev-parse --git-common-dir` prints, beside its mailbox folder.
  const common = fs.realpathSync(path.resolve(env.primary, gitOk(["rev-parse", "--git-common-dir"], env.primary)));
  const file = path.join(common, STATE_FILE);
  assert.ok(fs.existsSync(file), `state file at ${file}`);
  assert.ok(fs.statSync(path.join(common, MAILBOX_DIR)).isDirectory(), "mailbox folder beside it");
  for (const f of ["to-lane.md", "to-integrator.md"]) assert.ok(fs.existsSync(path.join(common, MAILBOX_DIR, f)), `open created ${f}`);
  const st = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(st.version, 1, "version field starts at 1");
  assert.deepEqual([st.manifest, st.wave, st.windowId, st.step], [env.manifestKey, 2, id, "integrator-open"]);

  // Not tracked, not even visible to git as an untracked or ignored working-tree file.
  assert.equal(gitOk(["status", "--porcelain", "--ignored", "--untracked-files=all"], env.primary), "", "working tree clean: the state is not in it");
  assert.equal(git(["ls-files", "--error-unmatch", STATE_FILE], env.primary).status === 0, false, "not tracked");

  // A fresh conductor (new deps, nothing carried in memory) reports the same values.
  const expected = OUT.stateLine({ manifest: env.manifestKey, record: "—", wave: 2, window: id, step: "integrator-open", mailbox: path.join(common, MAILBOX_DIR) });
  const fresh = makeDeps();
  assert.equal(await cli(C, env, ["state"], fresh), 0, dump(fresh));
  assert.deepEqual(fresh.out, [expected], "state prints state.line with the recorded values");
  assert.equal(fresh.driver.opens.length, 0, "state opens nothing");

  // And a fresh process through the real script, from primary.
  const r = spawnSync(process.execPath, [SCRIPT, "state"], { cwd: env.primary, encoding: "utf8" });
  assert.equal(r.status, 0, `node scripts/conductor.mjs state: ${r.stderr}`);
  assert.equal(r.stdout.trim(), expected, "a fresh process prints the same state.line");

  // Boundary: an unparseable state file is refused (exit 1, stderr), never overwritten.
  fs.writeFileSync(file, "{ not json");
  const hb = makeDeps();
  assert.equal(await cli(C, env, ["state"], hb), 1, dump(hb));
  assert.ok(hb.err.some((l) => l.includes(file) && l.includes("does not parse")), dump(hb));
  const ho = makeDeps();
  assert.equal(await cli(C, env, ["open", "--manifest", env.manifest, "--wave", "1"], ho), 1, dump(ho));
  assert.equal(ho.driver.opens.length, 0, "no window opened over an unparseable state");
  assert.equal(fs.readFileSync(file, "utf8"), "{ not json", "the unparseable file is left as it was");
});
