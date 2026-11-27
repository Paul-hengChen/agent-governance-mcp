// Coded by @qa-engineer
// Shared stand-ins for test/e466-*.test.mjs (specs/e466-conductor.md S3–S6; architecture
// specs/e466-conductor-architecture.md, Seams — ConductorDeps).
// WHY: the conductor script drives real iTerm2 windows, `gh`, `fanout.mjs handoff --check` and the lane
// launcher; every automated scenario must run hermetically. Each ConductorDeps seam gets a stand-in here: a
// scripted window driver (no iTerm2) that records every write and lets a test make a window vanish, a fake clock
// (ready wait / resend sleeps cost no real time), recording `prState` / `handoffCheck` / `closeFinished` seams
// with scripted answers, and recording out/err sinks. Git state is real: every case builds its own primary
// checkout under os.tmpdir(), so the state file's place (`git rev-parse --git-common-dir`) and its untracked
// status are checked against git itself.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { manifestText } from "../e443b/harness.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const FIX = path.join(ROOT, "test", "fixtures", "e466");
export const SCRIPT = path.join(ROOT, "scripts", "conductor.mjs");
export const MANIFEST_REL = "specs/fanout-e466-fixture.md";
export const RECORD_REL = "docs/discussions/2026-11-27-e466-fixture.md";

// Copy / Strings of the cut (verbatim).
export const STATE_FILE = "agc-conductor.json";
export const MAILBOX_DIR = "agc-conductor";
export const INTEGRATOR_SLASH = "/mcp__agent-governance-mcp__integrator";
export const EXIT = "/exit";
export const WAKE = "額度已恢復：先 tw_get_state，照 Crash-Resume 流程核對後從中斷處接續。";
export const READY_LINE = "  ⏵⏵ bypass permissions on (shift+tab to cycle)";
export const fanoutLine = (record) => `fan-out ${record}`;
export const takeoverLine = (manifest, n) => `接手 ${manifest}，開始第 ${n} 波次`;
export const OUT = {
  opened: (n, id) => `opened integrator — wave ${n}, window ${id}`,
  closed: (id) => `closed integrator — window ${id}`,
  woken: (id) => `woken integrator — window ${id}`,
  unmet: (n, fact) => `wave ${n} not done — ${fact}; integrator kept open`,
  factPr: (num, state, value, needs) => `pull request #${num} is ${state}, waveDoneAt ${value} needs ${needs}`,
  allDone: (m) => `all waves done — ${m}`,
  gone: (n, what, id) => `integrator gone — wave ${n} of ${what}, window ${id}; no new window opened`,
  ok: (n, id) => `integrator alive — wave ${n}, window ${id}`,
  stateLine: ({ manifest, record, wave, window, step, mailbox }) =>
    `conductor: manifest ${manifest} record ${record} wave ${wave} window ${window} step ${step} mailbox ${mailbox}`,
  replyUnmet: (n, facts) => `Wave ${n} is not done yet: ${facts.join("; ")}. Fix it and send the wave-done report again.`,
};
export const USAGE = "usage: node scripts/conductor.mjs state | open (--record <record> | --manifest <manifest> --wave <n>) | close | wake | wave-done | check";

/** The module under test, imported lazily so a missing build fails each test on its own. */
export const loadConductor = () => import(path.join(ROOT, "dist", "tools", "conductor.js"));
export const loadLaunch = () => import(path.join(ROOT, "dist", "tools", "lane-launch.js"));

// --- git ----------------------------------------------------------------------------------------------------

export function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error) : "") };
}
export function gitOk(args, cwd) {
  const r = git(args, cwd);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

// --- temp workspace -----------------------------------------------------------------------------------------

const TMP = fs.realpathSync(os.tmpdir());
const made = [];
export function cleanup() {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
}

/**
 * A temp primary checkout on `main` holding a two-wave manifest (lane t1 in 波次 1, lane t2 in 波次 2, t2
 * depending on t1), a discussion-record stub, and `.current/.config.json` (`config` merged in, e.g.
 * `{ waveDoneAt: "pr-open" }`). Everything committed, so any file the conductor leaves in the working tree
 * would show up in `git status`.
 */
export function makeEnv({ config = {}, waves = 2 } = {}) {
  const dir = fs.mkdtempSync(path.join(TMP, "e466-"));
  made.push(dir);
  const primary = path.join(dir, "primary");
  fs.mkdirSync(primary);
  gitOk(["-c", "init.defaultBranch=main", "init", "-q"], primary);
  gitOk(["config", "user.email", "qa@example.invalid"], primary);
  gitOk(["config", "user.name", "qa"], primary);
  gitOk(["config", "commit.gpgsign", "false"], primary);
  fs.mkdirSync(path.join(primary, ".current"), { recursive: true });
  fs.writeFileSync(path.join(primary, ".current", ".config.json"), JSON.stringify({ schema_version: 2, ...config }, null, 2) + "\n");
  fs.mkdirSync(path.join(primary, "src"), { recursive: true });
  fs.writeFileSync(path.join(primary, "src", "keep.ts"), "export {};\n");
  gitOk(["add", "-A"], primary);
  gitOk(["commit", "-q", "-m", "init"], primary);
  const baseSha = gitOk(["rev-parse", "HEAD"], primary);
  const lanes = [{ lane: "t1", tickets: ["T1"], wave: 1 }];
  if (waves >= 2) lanes.push({ lane: "t2", tickets: ["T2"], wave: 2, deps: ["t1"] });
  const manifest = path.join(primary, MANIFEST_REL);
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, manifestText({ base: baseSha, lanes }));
  const record = path.join(primary, RECORD_REL);
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.copyFileSync(path.join(FIX, "discussion-record.md"), record);
  gitOk(["add", "-A"], primary);
  gitOk(["commit", "-q", "-m", "manifest + record"], primary);
  const gitCommonDir = fs.realpathSync(path.resolve(primary, gitOk(["rev-parse", "--git-common-dir"], primary)));
  const mailbox = path.join(gitCommonDir, MAILBOX_DIR);
  return {
    dir,
    primary,
    manifest,
    manifestKey: MANIFEST_REL,
    record,
    recordKey: RECORD_REL,
    gitCommonDir,
    statePath: path.join(gitCommonDir, STATE_FILE),
    mailbox,
    toLane: path.join(mailbox, "to-lane.md"),
    toIntegrator: path.join(mailbox, "to-integrator.md"),
  };
}

export const readState = (env) => JSON.parse(fs.readFileSync(env.statePath, "utf8"));

/**
 * Appends one integrator wave-done report to the conductor mailbox's `to-lane.md`, in the block format
 * `mailbox-watch.mjs --send --from integrator --type report` writes, with the session-report body of
 * docs/lane-protocol.md §5 whose first item is the machine-read `report.first-item` line.
 */
export function sendWaveDone(env, { wave, manifest = env.manifestKey, pr, firstItem }) {
  const text = fs.existsSync(env.toLane) ? fs.readFileSync(env.toLane, "utf8") : "";
  const seq = (text.match(/^--- msg/gm) ?? []).length + 1;
  const item = firstItem ?? `- 做了什麼：wave ${wave} of ${manifest}, pull request #${pr}`;
  const body = fs.readFileSync(path.join(FIX, "wave-done-report.md"), "utf8").replace("{{FIRST_ITEM}}", item).trimEnd();
  const sep = text === "" ? "" : text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  const block = `--- msg\nseq: ${seq}\nfrom: integrator\ntype: report\nre: wave-done ${wave}\ntime: 2026-11-28T10:00:0${seq}Z\nhop: —\n---\n${body}\n`;
  fs.mkdirSync(path.dirname(env.toLane), { recursive: true });
  fs.writeFileSync(env.toLane, text + sep + block);
}

/** `--- msg` blocks of a mailbox file as { headers, body }. */
export function messages(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const chunk of fs.readFileSync(file, "utf8").split(/^--- msg[^\n]*\n/m).slice(1)) {
    const end = chunk.indexOf("\n---\n");
    const headers = {};
    for (const l of chunk.slice(0, end).split("\n")) {
      const m = /^([a-z]+):\s?(.*)$/.exec(l);
      if (m && !(m[1] in headers)) headers[m[1]] = m[2];
    }
    out.push({ headers, body: chunk.slice(end + 5) });
  }
  return out;
}

// --- stand-ins ----------------------------------------------------------------------------------------------

/** Scripted window driver: each window shows the ready marker at once; tests flip `exists`. */
export class FakeDriver {
  constructor(timeline) {
    this.timeline = timeline;
    this.windows = new Map();
    this.opens = [];
    this.nextId = 100;
  }
  async open(command) {
    const id = String(this.nextId++);
    const w = { id, command, text: `$ ${command}\n${READY_LINE}\n`, exists: true, writes: [] };
    this.windows.set(id, w);
    this.opens.push({ id, command });
    this.timeline.push({ kind: "open", id, command });
    return id;
  }
  async contents(id) {
    const w = this.windows.get(id);
    if (!w || !w.exists) throw new Error(`fake driver: window ${id} is gone`);
    return w.text;
  }
  async writeText(id, text, newline) {
    const w = this.windows.get(id);
    if (!w || !w.exists) throw new Error(`fake driver: window ${id} is gone`);
    w.writes.push([text, newline]);
    this.timeline.push({ kind: "write", id, text, newline });
  }
  async exists(id) {
    return this.windows.get(id)?.exists === true;
  }
  win(id) {
    return this.windows.get(id);
  }
}

export class FakeClock {
  constructor() {
    this.t = Date.parse("2026-11-28T09:00:00.000Z");
    this.sleeps = 0;
  }
  now() {
    return this.t;
  }
  async sleep(ms) {
    this.t += ms;
    if (++this.sleeps > 10000) throw new Error("fake clock: runaway sleeps");
  }
}

/**
 * A full stand-in ConductorDeps. `answers` scripts the seams: `pr` = the `gh pr view` state string (or
 * `{ ok: false, why }`), `handoff` = the `handoff --check` exit code, `closeFinished` = its exit code.
 * `driver` reuses a driver across calls (one conductor session, or a fresh one reading the same windows).
 */
export function makeDeps({ driver, answers = {} } = {}) {
  const timeline = [];
  const drv = driver ?? new FakeDriver(timeline);
  if (driver) drv.timeline = timeline;
  const out = [];
  const err = [];
  const calls = { prState: [], handoffCheck: [], closeFinished: [] };
  const a = { pr: "MERGED", handoff: 0, closeFinished: 0, ...answers };
  const deps = {
    driver: drv,
    clock: new FakeClock(),
    git: (args, cwd) => git(args, cwd),
    prState: (pr, cwd) => {
      calls.prState.push({ pr, cwd });
      timeline.push({ kind: "prState", pr });
      return typeof a.pr === "string" ? { ok: true, state: a.pr } : a.pr;
    },
    handoffCheck: (manifestAbs, primary) => {
      calls.handoffCheck.push({ manifestAbs, primary });
      timeline.push({ kind: "handoffCheck", manifestAbs });
      return a.handoff;
    },
    closeFinished: async (manifestAbs) => {
      calls.closeFinished.push({ manifestAbs });
      timeline.push({ kind: "closeFinished", manifestAbs });
      return a.closeFinished;
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    now: () => new Date("2026-11-28T10:30:00.000Z"),
  };
  return { deps, driver: drv, out, err, calls, timeline, answers: a };
}

/** The CLI the real script runs (`runConductorCli(argv, deps, cwd)`), cwd = primary as the conductor session. */
export async function cli(C, env, argv, h) {
  const code = await C.runConductorCli(argv, h.deps, env.primary);
  return code;
}

/** `[text, newline]` pairs `sendText` produces for each line: text without newline, then an empty write with one. */
export const sent = (...lines) => lines.flatMap((l) => [[l, false], ["", true]]);

export const dump = (h) => `out:\n${h.out.join("\n")}\nerr:\n${h.err.join("\n")}`;
