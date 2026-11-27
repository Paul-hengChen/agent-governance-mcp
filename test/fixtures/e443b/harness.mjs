// Coded by @qa-engineer
// Shared stand-ins for test/e443b-*.test.mjs (specs/e443b-lane-launcher.md, T-E443B-01).
// WHY: the lane launcher drives real terminal windows, real sessions and `agc feature start`; every automated
// scenario must run hermetically, so each seam of the architecture's `LaunchDeps` gets a stand-in here: a scripted
// window driver (no iTerm2), a fake clock whose 15 s poll sleeps fire test hooks (mailbox reports, ticket status
// edits, window signals), a feature-start runner that only runs `git worktree add` inside a temp repo, host
// settings paths under the temp dir (never the real home directory), and recording out/err sinks. Git state is
// real: every case builds its own primary checkout under os.tmpdir() with `main`, ticket files and a manifest.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const FIX = path.join(ROOT, "test", "fixtures", "e443b");
export const SCRIPT = path.join(ROOT, "scripts", "lane-launch.mjs");
export const MANIFEST_REL = "specs/fanout-e443b-fixture.md";

// Copy / Strings of the cut (verbatim).
export const STATE_FILE = "agc-lane-launch.json";
export const LOCK_FILE = "agc-lane-launch.lock";
export const SLASH = "/mcp__agent-governance-mcp__teamwork";
export const WAKE = "額度已恢復：先 tw_get_state，照 Crash-Resume 流程核對後從中斷處接續。";
export const POLL_MS = 15_000;
export const READY_LINE = "  ⏵⏵ bypass permissions on (shift+tab to cycle)";
// Host lines as a window shows them (UI glyphs in front, details after the matched prefix).
export const SIG = {
  weekly: "  ⎿ You've hit your weekly limit · resets Dec 1, 9am",
  continuing: "  ⎿ Continuing automatically at Dec 1, 9am",
  stopped: "● Automatic continue stopped after repeated usage-limit hits",
  enter: "  Press enter to continue",
  unknown: "  ⎿ Unknown command: /mcp__agent-governance-mcp__teamwork",
};

/** The module under test, imported lazily so a missing build fails each test on its own. */
export const loadLaunch = () => import(path.join(ROOT, "dist", "tools", "lane-launch.js"));
export const loadManifestTools = () => import(path.join(ROOT, "dist", "tools", "fanout-manifest.js"));

/** Thrown by the fake clock to stop a run whose lanes never end (the launcher must not swallow it). */
export class StopRun extends Error {
  constructor(why = "fake clock: poll budget spent") {
    super(why);
    this.name = "StopRun";
  }
}

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

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(path.join(from, e.name), path.join(to, e.name));
    else fs.copyFileSync(path.join(from, e.name), path.join(to, e.name));
  }
}

export const branchOf = (lane) => `feat/${lane}-fx`;

/**
 * Manifest text. `lanes`: [{ lane, tickets: ["T1"], wave: 1, deps: ["t1"], approval: "human" }].
 * `wave: false` writes the 8-column table (no 波次); `approval: true` adds the approval column;
 * `human: false` leaves only an 整合者 Decisions row.
 */
export function manifestText({ base, lanes, wave = true, approval = false, human = true }) {
  const head = ["lane", "票", "branch", "worktree", "擁有", "禁止", "範圍切線", "相依"];
  if (wave) head.push("波次");
  if (approval) head.push("approval");
  const rows = lanes.map((l) => {
    const cells = [
      l.lane,
      l.tickets.join("、"),
      l.branch ?? branchOf(l.lane),
      `../wt/${l.lane}`,
      `\`src/${l.lane}.ts\``,
      "`src/forbidden.ts`",
      `做：${l.lane}　不做：其他`,
      l.deps && l.deps.length > 0 ? l.deps.join("、") : "無",
    ];
    if (wave) cells.push(String(l.wave ?? 1));
    if (approval) cells.push(l.approval ?? "");
    return `| ${cells.join(" | ")} |`;
  });
  return [
    "# Fan-out: e443b launcher fixture",
    `base: ${base}    integration branch: integ/e443b-fixture`,
    "mailbox: ../mailbox",
    "",
    "Synthetic manifest for test/e443b-*.test.mjs; every lane's worktree and the mailbox sit beside the temp primary.",
    "",
    "## Lanes",
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows,
    "",
    "## Dispatch pins",
    `- ${lanes.map((l) => l.lane).join("、")}：無 pin。`,
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    human ? "| 2026-11-27 | 人類 | fixture approval | test fixture |" : "| 2026-11-27 | 整合者 | fixture plan | test fixture |",
    "",
  ].join("\n");
}

/**
 * A temp primary checkout on `main`: docs/tickets/ from the fixtures, `.current/.config.json`
 * (`cutApprovalAutoTier.manifest` true unless `tier: false`, plus `config`), committed (= the manifest's
 * `base:`), then the manifest committed on top. Host paths are temp files; the trust entry is written for the
 * primary unless `trust: false`.
 */
export function makeEnv({ lanes, config = {}, tier = true, trust = true, ...manifestOpts }) {
  const dir = fs.mkdtempSync(path.join(TMP, "e443b-"));
  made.push(dir);
  const primary = path.join(dir, "primary");
  fs.mkdirSync(primary);
  gitOk(["-c", "init.defaultBranch=main", "init", "-q"], primary);
  gitOk(["config", "user.email", "qa@example.invalid"], primary);
  gitOk(["config", "user.name", "qa"], primary);
  gitOk(["config", "commit.gpgsign", "false"], primary);
  copyDir(path.join(FIX, "tickets"), path.join(primary, "docs", "tickets"));
  fs.mkdirSync(path.join(primary, "src"), { recursive: true });
  fs.writeFileSync(path.join(primary, "src", "keep.ts"), "export {};\n");
  writeConfig(primary, { cutApprovalAutoTier: { manifest: tier }, ...config });
  gitOk(["add", "-A"], primary);
  gitOk(["commit", "-q", "-m", "init"], primary);
  const baseSha = gitOk(["rev-parse", "HEAD"], primary);
  const manifest = path.join(primary, MANIFEST_REL);
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, manifestText({ base: baseSha, lanes, ...manifestOpts }));
  gitOk(["add", "-A"], primary);
  gitOk(["commit", "-q", "-m", "manifest"], primary);

  const hostDir = path.join(dir, "host");
  fs.mkdirSync(path.join(hostDir, "managed"), { recursive: true });
  const host = {
    claudeJson: path.join(hostDir, "claude.json"),
    userSettings: path.join(hostDir, "settings.json"),
    managedSettings: path.join(hostDir, "managed", "managed-settings.json"),
    managedDropInDir: path.join(hostDir, "managed", "managed-settings.d"),
  };
  fs.writeFileSync(host.claudeJson, JSON.stringify({ projects: trust ? { [primary]: { hasTrustDialogAccepted: true } } : {} }));
  const gitCommonDir = fs.realpathSync(path.join(primary, ".git"));
  return {
    dir,
    primary,
    baseSha,
    manifest,
    manifestKey: MANIFEST_REL,
    mailbox: path.join(dir, "mailbox"),
    host,
    gitCommonDir,
    statePath: path.join(gitCommonDir, STATE_FILE),
    lockPath: path.join(gitCommonDir, LOCK_FILE),
    worktree: (lane) => path.join(dir, "wt", lane),
    home: path.join(dir, "home"),
  };
}

export function writeConfig(primary, extra) {
  fs.mkdirSync(path.join(primary, ".current"), { recursive: true });
  fs.writeFileSync(path.join(primary, ".current", ".config.json"), JSON.stringify({ schema_version: 2, ...extra }, null, 2) + "\n");
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

// --- stand-ins ----------------------------------------------------------------------------------------------

/** Scripted session opener: each window starts showing the ready marker; tests edit `text` / `exists`. */
export class FakeDriver {
  constructor(timeline = []) {
    this.timeline = timeline;
    this.windows = new Map();
    this.opens = [];
    this.writes = [];
    this.nextId = 100;
    this.unknownOnSlash = new Map(); // lane -> how many slash sends get "Unknown command" (Infinity = all)
    this.ready = true;
  }
  async open(command) {
    const id = String(this.nextId++);
    const m = / -n (\S+)$/.exec(command);
    const w = { id, command, lane: m ? m[1] : undefined, text: `$ ${command}\n`, exists: true, writes: [], slashes: 0 };
    if (this.ready) w.text += `${READY_LINE}\n`;
    this.windows.set(id, w);
    this.opens.push({ id, command, lane: w.lane });
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
    this.writes.push({ id, text, newline });
    this.timeline.push({ kind: "write", id, text, newline });
    if (text === SLASH) {
      w.slashes++;
      const budget = this.unknownOnSlash.get(w.lane) ?? 0;
      if (w.slashes <= budget) w.text += `${SIG.unknown}\n`;
    }
  }
  async exists(id) {
    return this.windows.get(id)?.exists === true;
  }
  /** Windows opened for `lane`, in open order. */
  of(lane) {
    return [...this.windows.values()].filter((w) => w.lane === lane);
  }
  show(lane, line) {
    const ws = this.of(lane);
    ws[ws.length - 1].text += `${line}\n`;
  }
}

/** Fake time: every 15 s sleep is one poll; `onPoll(n)` runs inside it, before the launcher looks again. */
export class FakeClock {
  constructor({ onPoll = () => {}, maxPolls = 25, timeline = [] } = {}) {
    this.t = Date.parse("2026-11-27T09:00:00.000Z");
    this.onPoll = onPoll;
    this.maxPolls = maxPolls;
    this.polls = 0;
    this.sleeps = [];
    this.timeline = timeline;
  }
  now() {
    return this.t;
  }
  async sleep(ms) {
    this.t += ms;
    this.sleeps.push(ms);
    this.timeline.push({ kind: "sleep", ms });
    if (this.sleeps.length > 20000) throw new StopRun("fake clock: runaway sleeps");
    if (ms === POLL_MS) {
      this.polls++;
      if (this.polls > this.maxPolls) throw new StopRun();
      await this.onPoll(this.polls);
    }
  }
}

export const alivePids = new Set();
let nextPid = 700001;

/** A full stand-in LaunchDeps for `env`; `calls` records every seam use. */
export function makeDeps(env, { onPoll, maxPolls, iterm = true, driver, featureStartFails } = {}) {
  const timeline = [];
  const drv = driver ?? new FakeDriver(timeline);
  if (driver) drv.timeline = timeline;
  const clock = new FakeClock({ onPoll, maxPolls, timeline });
  const out = [];
  const err = [];
  const calls = { iterm: 0, featureStart: [], ancestry: [] };
  const deps = {
    driver: drv,
    itermInstalled: () => {
      calls.iterm++;
      return iterm;
    },
    host: env.host,
    featureStart: (req) => {
      calls.featureStart.push(req);
      if (featureStartFails) return { ok: false, firstLine: featureStartFails };
      const r = git(["worktree", "add", "-q", "-b", `feat/${req.slug}`, req.worktree, req.base], req.primary);
      return r.status === 0 ? { ok: true } : { ok: false, firstLine: r.stderr.split("\n")[0] };
    },
    clock,
    git: (args, cwd) => git(args, cwd),
    ancestry: (branches, repoRoot, ref) => {
      calls.ancestry.push({ branches, repoRoot, ref });
      return branches.map((branch) => {
        const r = git(["merge-base", "--is-ancestor", branch, ref], repoRoot);
        if (r.status === 0) return { branch, isAncestor: true };
        if (r.status === 1) return { branch, isAncestor: false };
        return { branch, isAncestor: false, error: r.stderr.trim() || "git merge-base failed" };
      });
    },
    isPidAlive: (pid) => alivePids.has(pid),
    pid: nextPid++,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return { deps, driver: drv, clock, out, err, calls, timeline };
}

/** runLaneLaunch over resolveLaunchContext; a StopRun from the fake clock is reported, never swallowed. */
export async function runCore(L, env, deps) {
  const ctx = L.resolveLaunchContext(env.manifest, deps.git);
  if ("error" in ctx) throw new Error(`resolveLaunchContext: ${ctx.error}`);
  try {
    return { code: await L.runLaneLaunch(ctx, deps), stopped: false };
  } catch (e) {
    if (e instanceof StopRun) return { code: undefined, stopped: true };
    throw e;
  }
}

/** runLaneLaunchCli in-process with stand-in deps (CLI level), same StopRun handling. */
export async function runCli(L, argv, deps) {
  try {
    return { code: await L.runLaneLaunchCli(argv, deps), stopped: false };
  } catch (e) {
    if (e instanceof StopRun) return { code: undefined, stopped: true };
    throw e;
  }
}

/** The real `node scripts/lane-launch.mjs`, with HOME pointed at an empty temp dir (never the real host). */
export function spawnCli(env, args) {
  fs.mkdirSync(env.home, { recursive: true });
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: env.primary,
    encoding: "utf8",
    env: { ...process.env, HOME: env.home, USERPROFILE: env.home },
    timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// --- reading what the launcher left ------------------------------------------------------------------------

export function readState(env) {
  if (!fs.existsSync(env.statePath)) return undefined;
  return JSON.parse(fs.readFileSync(env.statePath, "utf8"));
}
export function laneRecord(env, lane) {
  return readState(env)?.manifests?.[env.manifestKey]?.lanes?.[lane];
}
export const laneStatus = (env, lane) => laneRecord(env, lane)?.status;

export function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** rel path -> sha256 of every file under `dir` (recursive); {} when absent. */
export function treeSnapshot(dir) {
  const out = {};
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    }
  };
  walk(dir);
  return out;
}

// --- what lanes do between polls ----------------------------------------------------------------------------

const seqs = new Map();
/** Append one `--- msg` block to `<mailbox>/<lane>/to-integrator.md` (lane-protocol §5 format). */
export function postMessage(env, lane, { type = "report", re = "progress", body }) {
  const file = path.join(env.mailbox, lane, "to-integrator.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const key = file;
  const seq = (seqs.get(key) ?? 0) + 1;
  seqs.set(key, seq);
  const block = [
    "--- msg",
    `seq: ${seq}`,
    `from: ${lane}`,
    `type: ${type}`,
    `re: ${re}`,
    "time: 2026-11-27T09:00:00Z",
    "hop: 3/14",
    "---",
    body,
    "",
  ].join("\n");
  fs.appendFileSync(file, block);
}
/** The lane-protocol §6 final report. */
export const laneReport = (env, lane) =>
  postMessage(env, lane, { re: "lane report", body: `## Lane report: ${lane} / T\n\n- outcome: code-reviewer PASS\n` });
/** A per-hop progress report (type: report, body not a lane report). */
export const progressReport = (env, lane, hop = 3) =>
  postMessage(env, lane, { body: `progress: hop ${hop}/14 — sr-engineer handed to code-reviewer` });

/** Rewrite one ticket's `status:` line in the lane worktree's copy of docs/tickets/. */
export function setTicketStatus(env, lane, id, status) {
  const file = path.join(env.worktree(lane), "docs", "tickets", `${id.toLowerCase()}.md`);
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, text.replace(/^status: .*$/m, `status: ${status}`));
}

/** A branch with one commit on top of `main`; merged into `main` (no-ff) when `merge` is true. */
export function makeBranch(env, branch, { merge = false } = {}) {
  gitOk(["checkout", "-q", "-b", branch], env.primary);
  fs.writeFileSync(path.join(env.primary, "src", `${branch.replace(/\W+/g, "-")}.ts`), "export const x = 1;\n");
  gitOk(["add", "-A"], env.primary);
  gitOk(["commit", "-q", "-m", `work on ${branch}`], env.primary);
  gitOk(["checkout", "-q", "main"], env.primary);
  if (merge) gitOk(["merge", "-q", "--no-ff", "-m", `merge ${branch}`, branch], env.primary);
}

/** `agc feature finish` evidence: `<primary>/.current/history/<YYYY-MM>/<lane>/`. */
export function historyRecord(env, lane) {
  const d = path.join(env.primary, ".current", "history", "2026-11", lane);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "tasks.md"), "<!-- schema_version: 2 -->\n# Tasks\n");
}

/** Lanes the driver opened, minus those whose final report the test has posted, at each open. */
export function concurrencyTracker(driver) {
  const reported = new Set();
  const atOpen = [];
  const orig = driver.open.bind(driver);
  driver.open = async (command) => {
    const id = await orig(command);
    const lane = driver.windows.get(id).lane;
    const live = new Set(driver.opens.map((o) => o.lane).filter((l) => !reported.has(l)));
    atOpen.push({ lane, live: live.size });
    return id;
  };
  return { reported, atOpen };
}
