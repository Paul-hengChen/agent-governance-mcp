#!/usr/bin/env node
// Release mechanics in three phases (prepare, publish, close-out); `--help`.
// Each failure class has its own exit code and a last stderr line `RELEASE_STOP
// <CLASS_ID>: <detail>`; `--dry-run` runs every read and only records mutations.
// Contract: specs/e394-release-sop-rewrite-architecture.md.

import { existsSync, readFileSync, realpathSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHASE_OF = { p: "prepare", u: "publish", c: "close-out" };

// Codes group by decade: 1-9 any phase, 10s preconditions, 20s prepare
// bookkeeping, 30s prepare commit/push, 40s publish, 50s close-out.
export const EXIT_CLASSES = Object.freeze([
  [1, "INTERNAL", "puc"], [2, "USAGE", "puc"], [10, "WRONG_BRANCH", "puc"], [11, "STALE_BASE", "p"],
  [12, "VERSION_INCOHERENT", "p"], [13, "UNRELATED_CHANGES", "pc"], [14, "GH_UNAVAILABLE", "puc"],
  [20, "EMPTY_BASELINE", "p"], [21, "DRIFT_BASELINE", "p"], [22, "DONE_MARK", "p"],
  [23, "BOOKKEEPING_CHECK", "p"], [24, "ADAPTER_STAMP", "p"], [30, "STAGING_INCOMPLETE", "p"],
  [31, "CHANGELOG_CITATION", "p"], [32, "SPEC_REQUIRE", "p"], [33, "SPEC_UNCLASSIFIABLE", "p"],
  [34, "PUSH_REJECTED", "puc"], [35, "MUTATION_FAILED", "puc"], [40, "TAG_EXISTS", "u"],
  [41, "CI_GATE_FAILED", "u"], [42, "PR_CANNOT_MERGE", "uc"], [43, "MERGE_WAIT_TIMEOUT", "uc"],
  [44, "MAIN_DIVERGED", "uc"], [45, "SELF_CHECK_FAILED", "u"], [50, "CLOSING_WRITE_ABSENT", "c"],
  [51, "LANE_UNRESOLVED", "c"], [52, "EMPTY_STAGE", "c"], [53, "BRANCH_EXISTS", "c"],
  [54, "CLOSE_OUT_NO_UPSTREAM", "c"], [55, "CLOSE_OUT_AHEAD", "c"], [56, "CLOSE_OUT_UNVERIFIED", "c"],
].map(([code, id, ph]) => Object.freeze({ code, id, phases: Object.freeze([...ph].map((k) => PHASE_OF[k])) })));

export class ReleaseStop extends Error {
  constructor(classId, detail) {
    const row = EXIT_CLASSES.find((c) => c.id === classId) ?? EXIT_CLASSES[0];
    const text = String(detail ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim();
    super(`${row.id}: ${text}`);
    Object.assign(this, { classId: row.id, code: row.code, detail: text });
  }
}

// Paths the release commit may stage; the scope rule treats them as expected.
export const STAGE_PATHS = Object.freeze({
  featureDirs: Object.freeze(("lib/ tools/ schema/ guards/ gates/ prompts/ bin/ transport/ scripts/ content/ templates/"
    + " specs/ test/ qa_reports/ review_reports/ docs/ research/ multi-agent-scripts/ .github/").split(" ")),
  metadataPaths: Object.freeze(("tsconfig.json package.json package-lock.json index.ts CHANGELOG.md README.md CONTRIBUTING.md"
    + " dist/ .current/.config.json docs/backlog.md tasks.md .current/_primary/tasks.md CLAUDE.md AGENTS.md .antigravityrules").split(" ")),
});

const SEMVER = /^\d+\.\d+\.\d+$/, TAG = /^v\d+\.\d+\.\d+$/, REL = /^release\/[A-Za-z0-9._-]+$/;
const any = () => true;
// exact(...want)(a): a = [verb, ...rest] and rest matches want slot by slot.
const exact = (...want) => (a) => a.length === want.length + 1
  && want.every((w, i) => (w instanceof RegExp ? w.test(a[i + 1]) : w === a[i + 1]));
const either = (...ms) => (a, ctx) => ms.some((m) => m(a, ctx));
const rule = (cmd, verb, mutates, text, match) => Object.freeze({ cmd, verb, mutates, rule: text, match });
const reads = (cmd, verbs) => verbs.map((v) => rule(cmd, v, false, `${v} (read-only)`, any));

// The only child-process calls this script makes; `match` sees [verb, ...rest] and the
// branch the runner believes is checked out. Node children run with the current node binary.
export const ALLOWED = Object.freeze([
  rule("git", "add", true, "add -- <paths>", (a) => a[1] === "--" && a.length > 2),
  rule("git", "commit", true, "commit -F <file> | -m <msg>, never --amend", either(exact("-F", /./), exact("-m", /./))),
  rule("git", "tag", true, "tag -a vX.Y.Z -m <msg>", exact("-a", TAG, "-m", /./)),
  rule("git", "push", true, "push -u origin release/* | push origin vX.Y.Z", either(exact("-u", "origin", REL), exact("origin", TAG))),
  rule("git", "switch", true, "switch -c release/* | switch main", either(exact("-c", REL), exact("main"))),
  rule("git", "branch", true, "branch -d release/*", exact("-d", REL)),
  rule("git", "pull", true, "-c pull.rebase=false pull --ff-only, on main only", (a, ctx) => ctx.branch === "main" && exact("--ff-only")(a)),
  rule("git", "fetch", true, "fetch origin; recorded, not run, under --dry-run", exact("origin")),
  ...reads("git", ["diff", "log", "status", "show", "ls-tree", "ls-files", "rev-parse", "rev-list", "describe", "ls-remote"]),
  ...reads("gh", ["auth status", "release view", "pr view", "run list", "run view"]),
  rule("gh", "pr create", true, "pr create --base main", (a) => a.includes("--base") && a[a.indexOf("--base") + 1] === "main"),
  rule("gh", "pr merge", true, "pr merge <n> --auto --merge", exact(/^\d+$/, "--auto", "--merge")),
  rule("gh", "release create", true, "release create vX.Y.Z", (a) => TAG.test(a[1] ?? "")),
  ...["scripts/check-version.mjs", "scripts/check-bookkeeping.mjs"].map((s) => rule("node", s, false, "no arguments", exact())),
  rule("node", "scripts/verify-release.mjs", false, "--ci-check --strict | vX.Y.Z | --close-out",
    either(exact("--ci-check", "--strict"), exact(TAG), exact("--close-out"))),
  rule("node", "bin/agc-init.mjs", false, "check", exact("check")),
]);

const REFUSED_VERBS = new Set(["reset", "rebase", "clean", "checkout", "stash", "update-ref", "merge"]);
const REFUSED_FLAGS = new Set(["-f", "-D", "-d", "--delete", "--squash", "--rebase", "--admin", "--amend"]);
const VALUE_FLAGS = new Set(["-m", "-F", "--title", "--body", "--notes"]);
const splitVerb = (cmd, args) => (cmd === "gh" ? [`${args[0]} ${args[1]}`, args.slice(1)]
  : cmd === "git" && args[0] === "-c" ? [args[1] === "pull.rebase=false" ? args[2] : null, args.slice(2)] : [args[0], args]);
const ruleFor = (cmd, args) => ALLOWED.find((r) => r.cmd === cmd && r.verb === splitVerb(cmd, args)[0]);
export function isAllowed(cmd, args, { branch } = {}) {
  if (!Array.isArray(args) || args.length === 0 || !args.every((a) => typeof a === "string")) return false;
  const [verb, rest] = splitVerb(cmd, args);
  if (cmd === "git" && REFUSED_VERBS.has(verb)) return false;
  for (let i = 1; i < rest.length; i++) {
    const a = rest[i];
    if (VALUE_FLAGS.has(rest[i - 1])) continue;
    if (a.startsWith("--force") || (REFUSED_FLAGS.has(a) && !(verb === "branch" && a === "-d"))) return false;
    if (cmd === "git" && verb === "push" && (a === "main" || a.includes(":"))) return false;
  }
  const entry = ruleFor(cmd, args);
  return Boolean(entry && entry.match(rest, { branch }));
}
// A mutating verb sent through read() would escape the dry-run recorder, so
// the call kind must agree with the allow-list entry as well.
function assertAllowed(cmd, args, kind, branch) {
  if (isAllowed(cmd, args, { branch }) && ruleFor(cmd, args).mutates === (kind === "mutate")) return;
  throw new ReleaseStop("INTERNAL", `runner refused ${cmd} ${show(args ?? [])} as ${kind} — not on the allow-list`);
}
const show = (args) => args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ");
const writer = (stream) => (s) => stream.write(s);

// Every process call and file write goes through here: argv arrays only,
// never a shell. Under dry-run mutations are recorded in `actions`, not run.
export function createRunner({ root = ROOT, dryRun = false, spawn = spawnSync, env = process.env, out, err } = {}) {
  const [say, warn] = [out ?? writer(process.stdout), err ?? writer(process.stderr)];
  const inside = (rel) => {
    const abs = path.resolve(root, rel), r = path.relative(root, abs);
    if (path.isAbsolute(rel) || r === "" || r.startsWith("..")) throw new ReleaseStop("INTERNAL", `runner refused a path outside the repository: ${rel}`);
    return abs;
  };
  const exec = (cmd, args, step, kind) => {
    runner.actions.push({ step, kind, cmd, args: [...args], executed: true });
    say(`release: [${step}] $ ${cmd} ${show(args)}\n`);
    const [bin, argv] = cmd === "node" ? [process.execPath, [path.join(root, args[0]), ...args.slice(1)]] : [cmd, args];
    const res = spawn(bin, argv, { cwd: root, env, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
    const result = { status: res.status ?? -1, stdout: res.stdout ?? "", stderr: res.error ? String(res.error.message) : res.stderr ?? "" };
    if (result.stdout) say(result.stdout.replace(/\0/g, "\n").replace(/\n?$/, "\n"));
    if (result.stderr) warn(result.stderr.replace(/\n?$/, "\n"));
    return result;
  };
  const record = (action, text) => (runner.actions.push({ ...action, executed: !dryRun }), say(`release: ${dryRun ? "DRY-RUN " : ""}[${action.step}] ${text}\n`));
  const fsAct = (op, step, rel, dest, run) => (record({ step, kind: "fs", op, path: rel, ...(dest ? { dest } : {}) }, op === "move" ? `mv ${rel} ${dest}` : `${op} ${rel}`), dryRun || run());
  const runner = {
    actions: [], branch: null, dryRun, root,
    read(cmd, args, { step }) { assertAllowed(cmd, args, "read", runner.branch); return exec(cmd, args, step, "read"); },
    mutate(cmd, args, { step }) {
      assertAllowed(cmd, args, "mutate", runner.branch);
      if (dryRun) record({ step, kind: "mutate", cmd, args: [...args] }, `${cmd} ${show(args)}`);
      const res = dryRun ? { status: 0, stdout: "", stderr: "" } : exec(cmd, args, step, "mutate");
      if (cmd === "git" && args[0] === "switch" && res.status === 0) runner.branch = args[args.length - 1];
      return res;
    },
    // A read that observes an earlier mutation of the same phase: dry-run
    // records it and returns null, a real run returns the read's result.
    deferred(cmd, args, { step }) {
      assertAllowed(cmd, args, "read", runner.branch);
      return dryRun ? (record({ step, kind: "deferred", cmd, args: [...args] }, `${cmd} ${show(args)}`), null) : exec(cmd, args, step, "deferred");
    },
    writeFile(rel, content, { step }) { const abs = inside(rel); fsAct("write", step, rel, null, () => writeFileSync(abs, content)); },
    mkdir(rel, { step }) { const abs = inside(rel); fsAct("mkdir", step, rel, null, () => mkdirSync(abs, { recursive: true })); },
    // No-clobber: an existing destination is left alone and reported as false.
    move(from, to, { step }) {
      const [src, dst] = [inside(from), inside(to)];
      return !existsSync(dst) && (fsAct("move", step, from, to, () => renameSync(src, dst)), true);
    },
  };
  return runner;
}

const USAGE_TEXT = `Usage:
  node scripts/release.mjs prepare   --version X.Y.Z --state <file> --tickets <E1[,E2…]|none> --message-file <file> [--dry-run]
  node scripts/release.mjs publish   --version X.Y.Z [--dry-run]
  node scripts/release.mjs close-out --version X.Y.Z [--dry-run]
  node scripts/release.mjs --help
`;
const FLAGS = { prepare: ["--version", "--state", "--tickets", "--message-file"], publish: ["--version"], "close-out": ["--version"] };
const usage = (detail) => new ReleaseStop("USAGE", detail);
export function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { phase: "help" };
  const [phase, ...rest] = argv;
  if (!Object.hasOwn(FLAGS, phase ?? "")) throw usage(`unknown or missing phase ${JSON.stringify(phase ?? null)} — expected prepare, publish or close-out`);
  const seen = {};
  let dryRun = false;
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === "--dry-run" && !dryRun) { dryRun = true; continue; }
    if (!FLAGS[phase].includes(flag) || Object.hasOwn(seen, flag)) throw usage(`unknown or repeated flag ${flag} for ${phase}`);
    const value = rest[++i];
    if (value === undefined || value.startsWith("--")) throw usage(`${flag} requires a value`);
    seen[flag] = value;
  }
  const missing = FLAGS[phase].find((f) => f !== "--tickets" && !Object.hasOwn(seen, f));
  if (missing) throw usage(`${phase} requires ${missing}`);
  if (!SEMVER.test(seen["--version"])) throw usage(`--version must be X.Y.Z without a leading v (got ${seen["--version"]})`);
  if (phase !== "prepare") return { phase, version: seen["--version"], dryRun };
  const raw = seen["--tickets"], tickets = raw === undefined || raw === "none" ? raw : raw.split(",");
  if (Array.isArray(tickets) && !tickets.every((t) => /^[A-Z]+\d+[A-Za-z0-9]*$/.test(t))) throw usage(`--tickets must be backlog ids or none (got ${raw})`);
  return { phase, version: seen["--version"], dryRun, statePath: seen["--state"], tickets, messageFile: seen["--message-file"] };
}

// A status path is expected when the release commit may stage it, or it
// lies under .current/, or it is the root task ledger.
export function checkScope(statusPaths) {
  const ok = (p) => p === "tasks.md" || p.startsWith(".current/") || STAGE_PATHS.featureDirs.some((d) => p.startsWith(d))
    || STAGE_PATHS.metadataPaths.some((m) => (m.endsWith("/") ? p.startsWith(m) : p === m));
  const bad = statusPaths.find((p) => !ok(p));
  return bad === undefined ? null : `Pre-existing uncommitted changes found in ${bad} — this path is unrelated to the active feature. Commit or stash it first.`;
}

// Inputs live outside the repository so they can never be staged or trip
// the root-file completeness check.
function readInput(root, file, label) {
  const abs = path.resolve(file);
  if (!existsSync(abs)) throw usage(`${label} ${file} does not exist`);
  const rel = path.relative(realpathSync(root), realpathSync(abs));
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) throw usage(`${label} ${file} is inside the repository — keep it outside the repository root`);
  try { return readFileSync(abs, "utf-8"); } catch (e) { throw usage(`${label} ${file} is unreadable: ${e.message}`); }
}
const lastLine = (text) => String(text).trim().split("\n").filter(Boolean).pop() ?? "";
const gitOut = (r, args, step) => { const res = r.read("git", args, { step }); return res.status === 0 ? res.stdout.trim() : null; };

function preInputs(ctx) {
  const { opts, root } = ctx;
  let state;
  try { state = JSON.parse(readInput(root, opts.statePath, "--state")); } catch (e) { throw e instanceof ReleaseStop ? e : usage(`--state is not JSON: ${e.message}`); }
  const pass = state?.last_agent === "qa-engineer" && state.status === "PASS" && typeof state.active_feature === "string" && state.active_feature;
  if (!pass) throw usage(`--state must be a (qa-engineer, PASS) snapshot with an active_feature (got ${state?.last_agent}, ${state?.status})`);
  const message = readInput(root, opts.messageFile, "--message-file");
  const subject = new RegExp(`^chore\\(release\\): v${opts.version.replace(/\./g, "\\.")} — .+$`);
  if (!subject.test(message.split("\n")[0])) throw usage(`--message-file first line must be "chore(release): v${opts.version} — <summary>"`);
  if (opts.tickets === undefined && existsSync(path.join(root, "docs/backlog.md"))) throw usage("--tickets is required while docs/backlog.md exists (pass none when the feature has no row)");
  Object.assign(ctx, { state, message });
}
function preGh(ctx) {
  const res = ctx.runner.read("gh", ["auth", "status"], { step: "pre-2" });
  if (res.status !== 0) throw new ReleaseStop("GH_UNAVAILABLE", `gh auth status exited ${res.status} — ${lastLine(res.stderr) || "gh unavailable"}`);
}
// Reads the branch and HEAD once; `allowed` decides, the stop names both.
function requireBranch(ctx, allowed, want) {
  const r = ctx.runner, branch = gitOut(r, ["rev-parse", "--abbrev-ref", "HEAD"], "pre-3"), head = gitOut(r, ["rev-parse", "HEAD"], "pre-3");
  if (branch === null || head === null) throw new ReleaseStop("WRONG_BRANCH", "cannot read the current branch and HEAD");
  r.branch = branch;
  if (!allowed(branch, head)) throw new ReleaseStop("WRONG_BRANCH", `on ${branch} at ${head}, expected ${want}`);
  return { branch, head };
}
function viewPr(ctx, branch) {
  const res = ctx.runner.read("gh", ["pr", "view", branch, "--json", "number,state,mergeable,mergeStateStatus,statusCheckRollup,mergeCommit,headRefOid"], { step: "pre-3" });
  if (res.status !== 0) return null;
  try { return JSON.parse(res.stdout); } catch { throw new ReleaseStop("INTERNAL", `gh pr view ${branch} printed non-JSON output`); }
}
function prePrepare(ctx) {
  const { opts, root, runner: r } = ctx, v = opts.version, rel = `release/v${v}`;
  requireBranch(ctx, (b) => b === rel, rel);
  const fetched = r.mutate("git", ["fetch", "origin"], { step: "pre-4" });
  if (fetched.status !== 0) throw new ReleaseStop("STALE_BASE", `git fetch origin exited ${fetched.status} — the base cannot be verified`);
  const behind = gitOut(r, ["rev-list", "--count", "HEAD..origin/main"], "pre-4");
  if (behind !== "0") throw new ReleaseStop("STALE_BASE", behind === null ? "cannot count HEAD..origin/main" : `origin/main has ${behind} commit(s) HEAD lacks — re-baseline on a new branch`);
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8"));
  if (pkg.version !== v) throw new ReleaseStop("VERSION_INCOHERENT", `--version ${v} ≠ package.json version ${pkg.version}`);
  ctx.prevTag = gitOut(r, ["describe", "--tags", "--abbrev=0"], "pre-5") || null;
  const readme = existsSync(path.join(root, "README.md")) ? readFileSync(path.join(root, "README.md"), "utf-8") : "";
  if (!readme.includes(`#v${v}`)) throw new ReleaseStop("VERSION_INCOHERENT", `README.md has no #v${v} install pin`);
  if (ctx.prevTag && ctx.prevTag !== `v${v}` && readme.includes(`#${ctx.prevTag}`)) throw new ReleaseStop("VERSION_INCOHERENT", `README.md still pins #${ctx.prevTag}`);
  const cv = r.read("node", ["scripts/check-version.mjs"], { step: "pre-5" });
  if (cv.status !== 0) throw new ReleaseStop("VERSION_INCOHERENT", `check-version.mjs exited ${cv.status} — ${lastLine(cv.stderr)}`);
  const st = r.read("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { step: "pre-6" });
  if (st.status !== 0) throw new ReleaseStop("INTERNAL", `git status exited ${st.status}`);
  // Entries are "XY path\0"; a rename or copy adds "origin\0" after it.
  const f = st.stdout.split("\0"), paths = (ctx.statusPaths = []);
  for (let i = 0; i < f.length; i++) if (f[i]) { paths.push(f[i].slice(3)); if (/^[RC]/.test(f[i]) && f[i + 1]) paths.push(f[++i]); }
  const unrelated = checkScope(ctx.statusPaths);
  if (unrelated) throw new ReleaseStop("UNRELATED_CHANGES", unrelated);
}
function prePublish(ctx) {
  const rel = `release/v${ctx.opts.version}`, pr = viewPr(ctx, rel);
  if (!pr || pr.state === "CLOSED") throw new ReleaseStop("PR_CANNOT_MERGE", `no open or merged pull request for ${rel}${pr ? ` (#${pr.number} is CLOSED)` : ""}`);
  if (pr.state === "OPEN") requireBranch(ctx, (b, h) => b === rel && h === pr.headRefOid, `${rel} at ${pr.headRefOid}`);
  else requireBranch(ctx, (b) => b === "main" || b === rel, `main or ${rel}`);
  ctx.pr = pr;
}
function preCloseOut(ctx) {
  const rel = `release/v${ctx.opts.version}-bookkeeping`, pr = viewPr(ctx, rel);
  if (pr?.state === "CLOSED") throw new ReleaseStop("PR_CANNOT_MERGE", `bookkeeping pull request #${pr.number} is CLOSED`);
  requireBranch(ctx, (b) => b === "main" || (pr !== null && b === rel), pr ? `main or ${rel}` : "main");
  ctx.pr = pr;
}

// Steps after the preconditions are not built yet; each phase stops as
// INTERNAL there, so no run reports success for work it did not do.
const notYet = (what) => () => { throw new ReleaseStop("INTERNAL", `${what} not implemented yet`); };
const PHASES = {
  prepare: [preInputs, preGh, prePrepare, notYet("prepare steps 7a-8a")],
  publish: [preGh, prePublish, notYet("publish steps 8b-9a")],
  "close-out": [preGh, preCloseOut, notYet("close-out steps 13a-13b")],
};

export async function main(argv, deps = {}) {
  const [out, err] = [deps.out ?? writer(process.stdout), deps.err ?? writer(process.stderr)];
  try {
    const opts = parseArgs(argv);
    if (opts.phase === "help") { out(USAGE_TEXT); return 0; }
    const root = deps.root ?? ROOT, ctx = { opts, root, deps };
    ctx.runner = createRunner({ root, dryRun: opts.dryRun, spawn: deps.spawn, env: deps.env ?? process.env, out, err });
    for (const step of PHASES[opts.phase]) await step(ctx);
    const v = `v${opts.version}`;
    out(opts.dryRun ? `release: ${opts.phase} DRY-RUN OK (${v}) — nothing changed\n` : `release: ${opts.phase} OK (${v})${ctx.okSuffix ?? ""}\n`);
    return 0;
  } catch (e) {
    const stop = e instanceof ReleaseStop ? e : new ReleaseStop("INTERNAL", e?.stack?.split("\n")[0] ?? String(e));
    if (stop.classId === "USAGE") err(USAGE_TEXT);
    err(`RELEASE_STOP ${stop.classId}: ${stop.detail}\n`);
    return stop.code;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
