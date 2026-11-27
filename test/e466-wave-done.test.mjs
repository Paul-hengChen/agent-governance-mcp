// Coded by @qa-engineer
// Tests (T-E466-04) for docs/tickets/E466.md S5 and S6 (specs/e466-conductor.md Build contract S5/S6, Copy /
// Strings out.unmet, fact.pr, fact.handoff, reply.unmet, out.closed, out.opened, out.all-done, out.gone, out.ok,
// report.first-item; architecture specs/e466-conductor-architecture.md §C/§D wave-done decision table and check).
// WHY (S5): closing an integrator ends the only session that holds the wave; closing it before the wave's pull
// request is where `waveDoneAt` needs it, or before the manifest's handoff check passes, abandons a half-finished
// wave. So every unmet fact keeps the integrator open and is named back to it in its mailbox; only when every fact
// holds does the conductor close it, clear the finished lane windows with the launcher's close-finished run, and
// open the next wave's integrator — or, after the last wave, open nothing and report all waves done.
// WHY (S6): a vanished integrator (closed by a person, a crashed host, a restart) must reach the human, who
// decides the recovery; silently reopening one could double-run a wave.
// Driven through runConductorCli over ConductorDeps stand-ins: scripted window driver, recording `gh pr view`
// (prState), `fanout.mjs handoff --check` (handoffCheck) and launcher close-finished seams with scripted answers,
// and a temp git primary whose `.current/.config.json` sets `waveDoneAt`. No iTerm2, gh or real launcher.
// Every title starts with its scenario id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadConductor, makeEnv, makeDeps, cleanup, cli, sent, dump, readState, sendWaveDone, messages, ROOT,
  INTEGRATOR_SLASH, EXIT, OUT, takeoverLine,
} from "./fixtures/e466/harness.mjs";

after(cleanup);

const real = (p) => fs.realpathSync(p);
const isHandoffUnmet = (line, n, key, code) =>
  line.startsWith(`wave ${n} not done — fanout.mjs handoff --check `) && line.endsWith(` exited ${code}; integrator kept open`) && line.includes(key);

/** Opens the wave-`wave` integrator through the CLI and returns its window id. */
async function openWave(C, env, driverFrom, wave) {
  const h = makeDeps(driverFrom ? { driver: driverFrom } : {});
  assert.equal(await cli(C, env, ["open", "--manifest", env.manifest, "--wave", String(wave)], h), 0, dump(h));
  return { h, id: h.driver.opens.at(-1).id };
}

// ---------------------------------------------------------------------------------------------------------------
// S5 — a wave-done report is checked before the integrator is closed
// ---------------------------------------------------------------------------------------------------------------

test("S5: a wave-done report with an unmet fact keeps the integrator and replies naming it; with every fact met (merged, or open under pr-open) the integrator is closed, finished lane windows closed, the next wave's integrator opened; after the last wave nothing opens", async () => {
  const C = await loadConductor();

  // --- waveDoneAt merged (the default) -------------------------------------------------------------------------
  const env = makeEnv();
  const { h: h0, id: id1 } = await openWave(C, env, undefined, 1);
  const driver = h0.driver;
  const win1 = driver.win(id1);
  const openWrites = win1.writes.length;
  sendWaveDone(env, { wave: 1, pr: 42 });

  // (a) the pull request has not merged → kept open, reply naming the fact, nothing else happens.
  const ha = makeDeps({ driver, answers: { pr: "OPEN", handoff: 0 } });
  assert.equal(await cli(C, env, ["wave-done"], ha), 1, dump(ha));
  const factPr = OUT.factPr(42, "OPEN", "merged", "MERGED");
  assert.ok(ha.err.includes(OUT.unmet(1, factPr)), dump(ha));
  assert.deepEqual(ha.calls.prState.map((c) => c.pr), [42], "gh pr view asked about the report's pull request");
  assert.equal(win1.writes.length, openWrites, "no /exit to the integrator");
  assert.equal(ha.calls.closeFinished.length, 0, "no launcher close-finished run");
  assert.equal(driver.opens.length, 1, "no window opened");
  let replies = messages(env.toIntegrator);
  assert.equal(replies.length, 1, "one reply in to-integrator.md");
  assert.equal(replies[0].headers.from, "conductor");
  assert.equal(replies[0].headers.type, "reply");
  assert.equal(replies[0].headers.hop, "—");
  assert.equal(replies[0].body.trim(), OUT.replyUnmet(1, [factPr]), "reply.unmet names the unmet fact");
  assert.equal(readState(env).step, "integrator-open", "state untouched");

  // (b) the pull request merged but handoff --check does not exit 0 → kept open, reply naming that fact.
  const hb = makeDeps({ driver, answers: { pr: "MERGED", handoff: 3 } });
  assert.equal(await cli(C, env, ["wave-done"], hb), 1, dump(hb));
  assert.ok(hb.err.some((l) => isHandoffUnmet(l, 1, env.manifestKey, 3)), dump(hb));
  assert.ok(!hb.err.some((l) => l.includes("pull request #42 is")), "the met pull-request fact is not reported");
  assert.equal(hb.calls.handoffCheck.length, 1, "handoff --check run once");
  assert.equal(real(hb.calls.handoffCheck[0].manifestAbs), real(env.manifest), "handoff --check runs on the manifest");
  assert.equal(win1.writes.length, openWrites, "still no /exit");
  assert.equal(hb.calls.closeFinished.length, 0);
  assert.equal(driver.opens.length, 1);
  replies = messages(env.toIntegrator);
  assert.equal(replies.length, 2, "a second reply");
  assert.match(replies[1].body.trim(), /^Wave 1 is not done yet: fanout\.mjs handoff --check .+ exited 3\. Fix it and send the wave-done report again\.$/);

  // (c) every fact met → /exit to the integrator, then close-finished, then the next wave's integrator, in order.
  const hc = makeDeps({ driver, answers: { pr: "MERGED", handoff: 0 } });
  assert.equal(await cli(C, env, ["wave-done"], hc), 0, dump(hc));
  assert.deepEqual(win1.writes.slice(openWrites), sent(EXIT), "/exit via sendText to the integrator's window");
  assert.equal(hc.calls.closeFinished.length, 1, "one launcher close-finished run");
  assert.equal(real(hc.calls.closeFinished[0].manifestAbs), real(env.manifest), "close-finished for this manifest");
  assert.equal(driver.opens.length, 2, "the next wave's integrator opened");
  const id2 = driver.opens.at(-1).id;
  assert.deepEqual(driver.win(id2).writes, sent(INTEGRATOR_SLASH, takeoverLine(env.manifestKey, 2)), "wave 2 integrator gets the take-over line");
  const kinds = hc.timeline.map((e) => (e.kind === "write" && e.text === EXIT ? "exit" : e.kind));
  assert.ok(kinds.indexOf("exit") < kinds.indexOf("closeFinished") && kinds.indexOf("closeFinished") < kinds.indexOf("open"), `order /exit → close-finished → open: ${kinds.join(",")}`);
  assert.ok(hc.out.includes(OUT.closed(id1)), dump(hc));
  assert.ok(hc.out.includes(OUT.opened(2, id2)), dump(hc));
  let st = readState(env);
  assert.deepEqual([st.wave, st.windowId, st.step, st.manifest], [2, id2, "integrator-open", env.manifestKey]);
  assert.equal(messages(env.toIntegrator).length, 2, "no reply when every fact holds");

  // (d) the last wave → integrator closed, close-finished run, no window opened, all waves done.
  sendWaveDone(env, { wave: 2, pr: 43 });
  const win2 = driver.win(id2);
  const at2 = win2.writes.length;
  const hd = makeDeps({ driver, answers: { pr: "MERGED", handoff: 0 } });
  assert.equal(await cli(C, env, ["wave-done"], hd), 0, dump(hd));
  assert.deepEqual(hd.calls.prState.map((c) => c.pr), [43], "the wave-2 report's pull request");
  assert.deepEqual(win2.writes.slice(at2), sent(EXIT));
  assert.equal(hd.calls.closeFinished.length, 1);
  assert.equal(driver.opens.length, 2, "no window after the last wave");
  assert.ok(hd.out.includes(OUT.allDone(env.manifestKey)), dump(hd));
  st = readState(env);
  assert.equal(st.step, "done");

  // --- waveDoneAt pr-open ----------------------------------------------------------------------------------------
  const envP = makeEnv({ config: { waveDoneAt: "pr-open" } });
  const { h: p0, id: p1 } = await openWave(C, envP, undefined, 1);
  const pwin = p0.driver.win(p1);
  const pAt = pwin.writes.length;
  sendWaveDone(envP, { wave: 1, pr: 7 });

  // A closed (not merged) pull request is unmet under pr-open too.
  const pe = makeDeps({ driver: p0.driver, answers: { pr: "CLOSED", handoff: 0 } });
  assert.equal(await cli(C, envP, ["wave-done"], pe), 1, dump(pe));
  assert.ok(pe.err.includes(OUT.unmet(1, OUT.factPr(7, "CLOSED", "pr-open", "OPEN/MERGED"))), dump(pe));
  assert.equal(pwin.writes.length, pAt);
  assert.equal(pe.calls.closeFinished.length, 0);

  // An open pull request is enough under pr-open.
  const pf = makeDeps({ driver: p0.driver, answers: { pr: "OPEN", handoff: 0 } });
  assert.equal(await cli(C, envP, ["wave-done"], pf), 0, dump(pf));
  assert.deepEqual(pwin.writes.slice(pAt), sent(EXIT), "integrator closed with the pull request open");
  assert.equal(pf.calls.closeFinished.length, 1);
  assert.equal(p0.driver.opens.length, 2, "wave 2 integrator opened");
  assert.deepEqual(p0.driver.win(p0.driver.opens.at(-1).id).writes, sent(INTEGRATOR_SLASH, takeoverLine(envP.manifestKey, 2)));

  // Boundary (security smoke): a report whose first item does not parse is an unmet fact, never a guess.
  const envX = makeEnv();
  const { h: x0, id: x1 } = await openWave(C, envX, undefined, 1);
  const xAt = x0.driver.win(x1).writes.length;
  sendWaveDone(envX, { wave: 1, pr: 1, firstItem: "- 做了什麼：wave one of ../../etc/passwd, pull request #$(rm -rf ~)" });
  const hx = makeDeps({ driver: x0.driver });
  assert.equal(await cli(C, envX, ["wave-done"], hx), 1, dump(hx));
  assert.ok(hx.err.some((l) => l.startsWith("wave 1 not done — the wave-done report does not read \"wave ") && l.endsWith("; integrator kept open")), dump(hx));
  assert.equal(hx.calls.prState.length + hx.calls.handoffCheck.length + hx.calls.closeFinished.length, 0, "no seam runs on an unparseable report");
  assert.equal(x0.driver.win(x1).writes.length, xAt, "no /exit");
  assert.equal(messages(envX.toIntegrator).length, 1, "the integrator is told");
});

// ---------------------------------------------------------------------------------------------------------------
// S6 — a vanished integrator is reported, not reopened
// ---------------------------------------------------------------------------------------------------------------

test("S6: when the integrator window no longer exists and no wave-done report arrived, check reports integrator gone with its wave and opens no window", async () => {
  const C = await loadConductor();
  const env = makeEnv();
  const { h: h0, id } = await openWave(C, env, undefined, 1);
  const driver = h0.driver;

  // Control: the window exists → alive, exit 0.
  const ha = makeDeps({ driver });
  assert.equal(await cli(C, env, ["check"], ha), 0, dump(ha));
  assert.deepEqual(ha.out, [OUT.ok(1, id)]);

  // The window vanishes, no report → integrator gone, naming the wave and the manifest; nothing opened.
  driver.win(id).exists = false;
  const hg = makeDeps({ driver });
  assert.equal(await cli(C, env, ["check"], hg), 1, dump(hg));
  assert.ok(hg.err.includes(OUT.gone(1, env.manifestKey, id)), dump(hg));
  assert.equal(driver.opens.length, 1, "no new integrator window");
  assert.equal(hg.calls.prState.length + hg.calls.handoffCheck.length + hg.calls.closeFinished.length, 0, "check runs no fact seam and no launcher");
  assert.equal(readState(env).step, "integrator-gone");
  // Asked again, it still opens nothing.
  const hg2 = makeDeps({ driver });
  await cli(C, env, ["check"], hg2);
  assert.equal(driver.opens.length, 1, "a repeated check opens nothing either");

  // The condition is "no wave-done report": a vanished window whose report already arrived is not reported gone.
  const envR = makeEnv();
  const { h: r0, id: rid } = await openWave(C, envR, undefined, 1);
  sendWaveDone(envR, { wave: 1, pr: 5 });
  r0.driver.win(rid).exists = false;
  const hr = makeDeps({ driver: r0.driver });
  assert.equal(await cli(C, envR, ["check"], hr), 0, dump(hr));
  assert.ok(!hr.err.some((l) => l.startsWith("integrator gone")), dump(hr));
  assert.equal(r0.driver.opens.length, 1);

  // The SOP tells the conductor session to notify the human and open no new window.
  const sop = fs.readFileSync(path.join(ROOT, "content", "skill-conductor.md"), "utf8");
  assert.ok(sop.includes("Notify the human that the integrator is gone and which wave it held, and open no new integrator window."), "SOP: notify the human, no new window");
});
