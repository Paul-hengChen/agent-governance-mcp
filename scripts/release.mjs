#!/usr/bin/env node
// Release mechanics in three phases (prepare, publish, close-out); `--help`.
// Each failure class has its own exit code and a last stderr line `RELEASE_STOP
// <CLASS_ID>: <detail>`; `--dry-run` runs every read and only records mutations.
// Contract: specs/e394-release-sop-rewrite-architecture.md.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
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
  if (!safeSegment(state.active_feature)) throw usage(`--state active_feature ${JSON.stringify(state.active_feature)} cannot name an archive directory`);
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

// ---- Step 7a: archive the shipped feature's evidence (qa_reports/, review_reports/) ----

// A `covers:` label line, optionally bulleted and bolded; separator `:`, `—` or `-`.
export const COVERS_RE = /^\s*([-*]\s*)?(\*\*\s*)?covers(\s*\*\*)?\s*[:—-]/i;
const CODE_RE = /^[a-z_]*T-([A-Za-z0-9]+)-/;
const ER_PREFIX = "expected-red_";
const TREES = [["qa", "qa_reports", ["review_T-", "visual_T-"]], ["rr", "review_reports", ["review_T-"]]];
// One path segment that cannot climb out of the archive directory.
const safeSegment = (s) => typeof s === "string" && s !== "" && s !== "." && s !== ".." && !/[\\/\0]/.test(s);
// `name` matches the glob `<prefix>*<suffix>`.
const globbed = (name, prefix, suffix) => name.length >= prefix.length + suffix.length && name.startsWith(prefix) && name.endsWith(suffix);

// The ticket code in an evidence basename (`review_T-E37-01.md` → E37), or null.
export function codeFromBasename(basename) {
  const m = CODE_RE.exec(basename);
  return m ? m[1].toUpperCase() : null;
}
// Sorted unique codes of the files new to this release, over both trees.
export function deriveCodes({ qaAdmitted = [], rrAdmitted = [] }) {
  const codes = [...qaAdmitted, ...rrAdmitted].map((f) => codeFromBasename(path.posix.basename(f)));
  return [...new Set(codes.filter(Boolean))].sort();
}
// STOP when a tree has root files and no previous-release listing to diff
// them against: an empty baseline would admit every root file.
export function classifyArchiveTree({ prevTag, treeExists, baselineHasFiles, rootHasFiles }) {
  if (!prevTag) return "STOP";
  if (!treeExists) return "EXCLUDE";
  if (baselineHasFiles) return "INCLUDE";
  return rootHasFiles ? "STOP" : "EXCLUDE";
}
// Moves in this order: per code the review/visual files of each tree, then new
// expected-red files into their own feature's dir, then the remaining `.md`
// files whose first `covers:` line names a code. Each tree archives into itself.
export function planArchiveMoves({ feature, codes, qaRoot = [], rrRoot = [], coversLine, newExpectedRed = [], participating }) {
  const moves = [], taken = new Set();
  const add = (tree, name, dir) => {
    const from = `${tree}/${name}`;
    if (!taken.has(from)) { taken.add(from); moves.push({ from, to: `${tree}/archive/${dir}/${name}` }); }
  };
  const trees = TREES.map(([key, tree, kinds]) => ({ tree, kinds, on: Boolean(participating?.[key]), names: key === "qa" ? qaRoot : rrRoot }));
  for (const c of codes) {
    for (const t of trees) if (t.on) for (const n of t.names) if (t.kinds.some((k) => globbed(n, `${k}${c}-`, ".md"))) add(t.tree, n, feature);
  }
  if (participating?.qa) {
    for (const n of newExpectedRed) {
      const f = n.slice(ER_PREFIX.length, -".txt".length);
      if (globbed(n, ER_PREFIX, ".txt") && safeSegment(f)) add("qa_reports", n, f);
    }
  }
  for (const t of trees) {
    if (!t.on) continue;
    for (const n of t.names) {
      if (!n.endsWith(".md") || taken.has(`${t.tree}/${n}`)) continue;
      const line = coversLine(`${t.tree}/${n}`);
      if (line && codes.some((c) => line.includes(`T-${c}-`))) add(t.tree, n, feature);
    }
  }
  return moves;
}

const rootFileNames = (abs) => readdirSync(abs, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name).sort();
function firstCoversLine(abs) {
  try { return readFileSync(abs, "utf-8").split("\n").find((l) => COVERS_RE.test(l)) ?? null; } catch { return null; }
}

// Classifies both trees before any write, logs the code set (also when
// empty), then makes the directories and the no-clobber moves.
function step7a(ctx) {
  const { root, runner: r, prevTag = null } = ctx, feature = ctx.state.active_feature;
  const trees = {};
  for (const [key, tree] of TREES) {
    const abs = path.join(root, tree), treeExists = existsSync(abs) && statSync(abs).isDirectory();
    const names = treeExists ? rootFileNames(abs) : [];
    let baseline = new Set();
    if (prevTag && treeExists) {
      const res = r.read("git", ["ls-tree", "-r", "-z", "--name-only", prevTag, "--", `${tree}/`], { step: "7a" });
      if (res.status === 0) baseline = new Set(res.stdout.split("\0").filter(Boolean));
    }
    const verdict = classifyArchiveTree({ prevTag, treeExists, baselineHasFiles: baseline.size > 0, rootHasFiles: names.length > 0 });
    trees[key] = { tree, names, verdict, fresh: names.filter((n) => !baseline.has(`${tree}/${n}`)) };
  }
  if (trees.qa.verdict === "STOP" || trees.rr.verdict === "STOP") {
    throw new ReleaseStop("EMPTY_BASELINE", `step 7a has no membership baseline for <qa_reports|review_reports> (PREV_TAG='${prevTag ?? ""}') — that tree has root-level evidence files and no baseline to diff them against; refusing to derive <CODES> for it rather than risk an unbounded sweep.`);
  }
  const on = { qa: trees.qa.verdict === "INCLUDE", rr: trees.rr.verdict === "INCLUDE" };
  const codes = deriveCodes({ qaAdmitted: on.qa ? trees.qa.fresh : [], rrAdmitted: on.rr ? trees.rr.fresh : [] });
  ctx.out(`step 7a: <CODES> = {${codes.join(",") || "∅"}}\n`);
  const plan = planArchiveMoves({
    feature, codes, qaRoot: trees.qa.names, rrRoot: trees.rr.names, participating: on,
    coversLine: (rel) => firstCoversLine(path.join(root, rel)),
    newExpectedRed: on.qa ? trees.qa.fresh.filter((n) => globbed(n, ER_PREFIX, ".txt")) : [],
  });
  const dirs = new Set(TREES.filter(([key]) => on[key]).map(([, tree]) => `${tree}/archive/${feature}`));
  for (const m of plan) dirs.add(path.posix.dirname(m.to));
  for (const d of dirs) r.mkdir(d, { step: "7a" });
  for (const m of plan) if (!r.move(m.from, m.to, { step: "7a" })) ctx.out(`release: [7a] kept ${m.from} — ${m.to} already exists\n`);
  Object.assign(ctx, { codes, archived: plan });
}

// ---- Step 7b: drift-baseline acknowledgment (.current/.config.json) ----

const CONFIG_REL = ".current/.config.json";
// Appends the ids not yet present to `driftBaselineIds` (created if absent),
// keeping the existing order; `added` empty means nothing needs writing.
export function appendDriftBaseline(configText, ids) {
  let obj = {};
  if (configText !== null) {
    try { obj = JSON.parse(configText); } catch (e) { throw new ReleaseStop("DRIFT_BASELINE", `${CONFIG_REL} is not JSON: ${e.message}`); }
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) throw new ReleaseStop("DRIFT_BASELINE", `${CONFIG_REL} is not a JSON object`);
  const have = obj.driftBaselineIds ?? [];
  if (!Array.isArray(have)) throw new ReleaseStop("DRIFT_BASELINE", `${CONFIG_REL} driftBaselineIds is not an array`);
  const seen = new Set(have), added = [];
  for (const id of ids) if (!seen.has(id)) { seen.add(id); added.push(id); }
  obj.driftBaselineIds = [...have, ...added];
  return { text: `${JSON.stringify(obj, null, 2)}\n`, added };
}

function step7b(ctx) {
  const { root, runner: r } = ctx, ids = ctx.state.completed_tasks ?? [];
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && id !== "")) throw usage("--state completed_tasks must be an array of task ids");
  const abs = path.join(root, CONFIG_REL);
  const { text, added } = appendDriftBaseline(existsSync(abs) ? readFileSync(abs, "utf-8") : null, ids);
  if (added.length === 0) { ctx.out(`release: [7b] driftBaselineIds already holds all ${ids.length} completed task id(s)\n`); return; }
  if (!existsSync(path.dirname(abs))) r.mkdir(path.posix.dirname(CONFIG_REL), { step: "7b" });
  r.writeFile(CONFIG_REL, text, { step: "7b" });
  ctx.out(`release: [7b] driftBaselineIds gains ${added.join(",")}\n`);
}

// ---- Step 7c: backlog done-mark verification, then check-bookkeeping.mjs ----

const BACKLOG_REL = "docs/backlog.md";
// The cells of a markdown table row; an escaped `\|` stays inside its cell.
const rowCells = (line) => {
  const cells = line.split(/(?<!\\)\|/).map((c) => c.trim());
  return cells.slice(1, cells.at(-1) === "" ? -1 : undefined);
};
// `vX.Y.Z` as a whole token: not part of a longer version or word.
const versionToken = (version) => new RegExp(`(?<![\\w.])v${version.replace(/\./g, "\\.")}(?!\\w|\\.\\d)`);

// The agent writes the done-mark text; this checks it. `tickets` is the id
// list (or "none": no row, so any backlog edit is a stray one); `diffLines`
// are the +/- content lines of the backlog's diff against HEAD.
export function checkDoneMarks({ backlogText, diffLines, tickets, version }) {
  const ids = Array.isArray(tickets) ? tickets : [], problems = [], lines = String(backlogText ?? "").split("\n");
  const token = versionToken(version);
  for (const id of ids) {
    const rows = lines.filter((l) => l.startsWith(`| ${id} |`));
    if (rows.length !== 1) { problems.push(`${id} has ${rows.length} ticket rows in ${BACKLOG_REL}, expected exactly one`); continue; }
    const desc = rowCells(rows[0])[1] ?? "";
    if (!desc.startsWith("**DONE")) problems.push(`${id} row desc does not start with **DONE`);
    if (!token.test(desc)) problems.push(`${id} row does not name v${version}`);
    if (/not yet released/i.test(desc)) problems.push(`${id} row still says "not yet released" — amend that phrase in place`);
  }
  for (const d of diffLines) {
    const body = d.slice(1), cells = body.startsWith("|") ? rowCells(body) : [];
    if (!cells.slice(0, 2).some((c) => ids.includes(c))) problems.push(`${BACKLOG_REL} changes a line that is not a done-marked ticket row: ${d.slice(0, 80)}`);
  }
  return problems;
}

// Content lines (+/-) of a unified diff; header lines before each hunk are dropped.
function diffContentLines(diffText) {
  const out = [];
  let inHunk = false;
  for (const l of diffText.split("\n")) {
    if (l.startsWith("diff --git ")) inHunk = false;
    else if (l.startsWith("@@")) inHunk = true;
    else if (inHunk && (l.startsWith("+") || l.startsWith("-"))) out.push(l);
  }
  return out;
}

function step7c(ctx) {
  const { root, runner: r, opts } = ctx, abs = path.join(root, BACKLOG_REL);
  if (opts.tickets !== undefined) {
    const diff = r.read("git", ["diff", "-U0", "HEAD", "--", BACKLOG_REL], { step: "7c" });
    if (diff.status !== 0) throw new ReleaseStop("INTERNAL", `git diff HEAD -- ${BACKLOG_REL} exited ${diff.status}`);
    const problems = checkDoneMarks({
      backlogText: existsSync(abs) ? readFileSync(abs, "utf-8") : "", diffLines: diffContentLines(diff.stdout),
      tickets: opts.tickets, version: opts.version,
    });
    if (problems.length > 0) throw new ReleaseStop("DONE_MARK", problems.join("; "));
  }
  const res = r.read("node", ["scripts/check-bookkeeping.mjs"], { step: "7c" });
  if (res.status !== 0) {
    const why = (res.stderr.trim() || lastLine(res.stdout)).slice(0, 1000);
    throw new ReleaseStop("BOOKKEEPING_CHECK", `check-bookkeeping.mjs exited ${res.status} — ${why}`);
  }
}

// ---- Step 7d: adapter agc-version stamps, then agc check ----

export const ADAPTER_STAMPS = Object.freeze([
  { path: "CLAUDE.md", line: /^<!--\s*agc-version:\s*\S+\s*-->\s*$/, render: (v) => `<!-- agc-version: ${v} -->` },
  { path: "AGENTS.md", line: /^#\s*agc-version:\s*\S+\s*$/, render: (v) => `# agc-version: ${v}` },
  { path: ".antigravityrules", line: /^#\s*agc-version:\s*\S+\s*$/, render: (v) => `# agc-version: ${v}` },
].map((s) => Object.freeze(s)));

// The adapter text with its one stamp line set to `version`; any other
// count of stamp lines stops. Line endings (LF or CRLF) are kept.
export function bumpAdapterStamp(file, text, version) {
  const spec = ADAPTER_STAMPS.find((s) => s.path === file);
  if (!spec) throw new ReleaseStop("INTERNAL", `${file} is not an adapter with an agc-version stamp`);
  const lines = String(text).split("\n"), at = [];
  lines.forEach((l, i) => { if (spec.line.test(l.replace(/\r$/, ""))) at.push(i); });
  if (at.length !== 1) throw new ReleaseStop("ADAPTER_STAMP", `${file} has ${at.length} agc-version stamp lines, expected exactly one`);
  const [i] = at;
  lines[i] = spec.render(version) + (lines[i].endsWith("\r") ? "\r" : "");
  return lines.join("\n");
}

function step7d(ctx) {
  const { root, runner: r, opts } = ctx;
  // All three are checked before the first write, so a bad adapter leaves none half-bumped.
  const writes = ADAPTER_STAMPS.flatMap(({ path: rel }) => {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) throw new ReleaseStop("ADAPTER_STAMP", `${rel} does not exist`);
    const text = readFileSync(abs, "utf-8"), next = bumpAdapterStamp(rel, text, opts.version);
    return next === text ? [] : [[rel, next]];
  });
  for (const [rel, next] of writes) r.writeFile(rel, next, { step: "7d" });
  const wrote = writes.length > 0;
  // agc check reads the stamps 7d may just have written, so a dry-run that
  // planned a write records the check instead of running it.
  const args = ["bin/agc-init.mjs", "check"];
  const res = wrote ? r.deferred("node", args, { step: "7d" }) : r.read("node", args, { step: "7d" });
  if (res && res.status !== 0) {
    throw new ReleaseStop("ADAPTER_STAMP", `agc-init.mjs check exited ${res.status} — ${lastLine(res.stderr) || lastLine(res.stdout)}`);
  }
}

// Steps after the preconditions are not built yet; each phase stops as
// INTERNAL there, so no run reports success for work it did not do.
const notYet = (what) => () => { throw new ReleaseStop("INTERNAL", `${what} not implemented yet`); };
const PHASES = {
  prepare: [preInputs, preGh, prePrepare, step7a, step7b, step7c, step7d, notYet("prepare step 8a")],
  publish: [preGh, prePublish, notYet("publish steps 8b-9a")],
  "close-out": [preGh, preCloseOut, notYet("close-out steps 13a-13b")],
};

export async function main(argv, deps = {}) {
  const [out, err] = [deps.out ?? writer(process.stdout), deps.err ?? writer(process.stderr)];
  try {
    const opts = parseArgs(argv);
    if (opts.phase === "help") { out(USAGE_TEXT); return 0; }
    const root = deps.root ?? ROOT, ctx = { opts, root, deps, out };
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
