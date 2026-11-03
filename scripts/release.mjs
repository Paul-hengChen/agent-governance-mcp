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

const STAGE_MEMBERS = Object.freeze([...STAGE_PATHS.featureDirs, ...STAGE_PATHS.metadataPaths]);
// `p` is the member itself, or lies under it when the member is a directory.
const under = (p, member) => (member.endsWith("/") ? p.startsWith(member) : p === member);

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
  rule("node", "scripts/verify-release.mjs", false, "--ci-check --strict --sha <sha> | vX.Y.Z | --close-out",
    either(exact("--ci-check", "--strict", "--sha", /^[0-9a-f]{40}([0-9a-f]{24})?$/), exact(TAG), exact("--close-out"))),
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
  const ok = (p) => p === "tasks.md" || p.startsWith(".current/") || STAGE_MEMBERS.some((m) => under(p, m));
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
const releaseSubject = (version) => new RegExp(`^chore\\(release\\): v${version.replace(/\./g, "\\.")} — .+$`);
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
  if (!releaseSubject(opts.version).test(message.split("\n")[0])) throw usage(`--message-file first line must be "chore(release): v${opts.version} — <summary>"`);
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
// `how` is "deferred" when the view observes this phase's own merge; null
// then also means a dry-run, which never ran the view.
function viewPr(ctx, branch, step = "pre-3", how = "read") {
  const res = ctx.runner[how]("gh", ["pr", "view", branch, "--json", "number,state,mergeable,mergeStateStatus,statusCheckRollup,mergeCommit,headRefOid"], { step });
  if (res === null || res.status !== 0) return null;
  try { return JSON.parse(res.stdout); } catch { throw new ReleaseStop("INTERNAL", `gh pr view ${branch} printed non-JSON output`); }
}
// Every path `git status` reports; entries are "XY path\0", and a rename
// or copy adds "origin\0" after it.
function readStatusPaths(r, step) {
  const st = r.read("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { step });
  if (st.status !== 0) throw new ReleaseStop("INTERNAL", `git status exited ${st.status}`);
  const f = st.stdout.split("\0"), paths = [];
  for (let i = 0; i < f.length; i++) if (f[i]) { paths.push(f[i].slice(3)); if (/^[RC]/.test(f[i]) && f[i + 1]) paths.push(f[++i]); }
  return paths;
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
  ctx.statusPaths = readStatusPaths(r, "pre-6");
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

// ---- Step 8a, part 1: stage plan, staging completeness, CHANGELOG citations ----

const nulList = (text) => String(text).split("\0").filter(Boolean);

// The STAGE_PATHS members, in list order, that exist and cover a changed
// path. A missing pathspec would make `git add` stage nothing at all.
export function planStage({ changed, exists }) {
  return STAGE_MEMBERS.filter((m) => exists(m) && changed.some((p) => under(p, m)));
}

// `changed`: status paths before staging; `staged`: the index after it (or,
// under dry-run, the changed paths the plan covers); `unstaged` / `untracked`:
// leftovers outside .current/, which never ships in the release commit.
export function checkStagingCompleteness({ changed, staged, unstaged = [], untracked = [] }) {
  const missing = STAGE_PATHS.featureDirs.filter((d) => changed.some((p) => p.startsWith(d)) && !staged.some((p) => p.startsWith(d)));
  const problems = [];
  if (missing.length > 0) problems.push(`feature dir(s) with changes absent from the index: ${missing.join(" ")}`);
  if (unstaged.length > 0) problems.push(`tracked file(s) left unstaged: ${unstaged.join(" ")}`);
  if (untracked.length > 0) problems.push(`untracked file(s) never staged: ${untracked.join(" ")}`);
  return { pass: problems.length === 0, missing, problems };
}

function step8aStage(ctx) {
  const { root, runner: r, opts } = ctx, step = "8a-1";
  // A dry-run never ran the earlier writes and moves, so their paths stand in for the status.
  const planned = r.dryRun ? r.actions.filter((a) => a.kind === "fs" && a.op !== "mkdir").flatMap((a) => (a.dest ? [a.path, a.dest] : [a.path])) : [];
  const changed = [...new Set([...readStatusPaths(r, step), ...planned])];
  const plan = planStage({ changed, exists: (m) => existsSync(path.join(root, m)) || planned.some((p) => under(p, m)) });
  ctx.stagePlan = plan;
  if (plan.length > 0) {
    const add = r.mutate("git", ["add", "--", ...plan], { step });
    if (add.status !== 0) throw new ReleaseStop("MUTATION_FAILED", `git add exited ${add.status} — ${lastLine(add.stderr)}`);
  } else {
    // Nothing to stage on top of the release commit means a re-run after it; the commit step is then skipped.
    const head = gitOut(r, ["log", "-1", "--format=%s"], step);
    if (head === null || !releaseSubject(opts.version).test(head)) {
      throw new ReleaseStop("STAGING_INCOMPLETE", `nothing to commit — no STAGE_PATHS member has a change and HEAD is not the v${opts.version} release commit`);
    }
    ctx.commitMade = true;
    ctx.out(`release: [${step}] nothing to stage — HEAD is already the v${opts.version} release commit\n`);
  }
  const covered = (p) => plan.some((m) => under(p, m));
  const cached = r.deferred("git", ["diff", "--cached", "--name-only", "-z", "--no-renames"], { step });
  if (cached && cached.status !== 0) throw new ReleaseStop("INTERNAL", `git diff --cached exited ${cached.status}`);
  const staged = cached ? nulList(cached.stdout) : changed.filter(covered);
  // Dry-run reads the untouched index, so what the plan would stage is not a leftover.
  const leftovers = (args) => {
    const res = r.read("git", args, { step });
    if (res.status !== 0) throw new ReleaseStop("INTERNAL", `git ${args[0]} exited ${res.status}`);
    return nulList(res.stdout).filter((p) => !r.dryRun || !covered(p));
  };
  const verdict = checkStagingCompleteness({
    changed, staged,
    unstaged: leftovers(["diff", "--name-only", "-z", "--", ".", ":!.current"]),
    untracked: leftovers(["ls-files", "--others", "--exclude-standard", "-z", "--", ".", ":!.current"]),
  });
  if (!verdict.pass) throw new ReleaseStop("STAGING_INCOMPLETE", `${verdict.problems.join("; ")} — stage them and re-run`);
  ctx.staged = staged;
}

// The `## [X.Y.Z] - ` section of CHANGELOG.md up to the next `## ` heading, or null.
export function extractChangelogEntry(changelogText, version) {
  const lines = String(changelogText ?? "").split("\n"), start = lines.findIndex((l) => l.startsWith(`## [${version}] - `));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

const CITATION_RE = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.*-]+)*\/?(:\d+)?$/;
const CITED_EXT_RE = /\.(md|mjs|js|ts|json|yml|txt)$/;
// File paths cited as code spans; `context` is true when `(context, not
// changed)` follows the span. Spans with a `*` are patterns, not paths.
export function extractCitations(entry) {
  const out = [], seen = new Set();
  for (const m of String(entry ?? "").matchAll(/`([^`\n]+)`(\s*\(context, not changed\))?/g)) {
    const span = m[1].trim();
    if (span.includes("*") || !CITATION_RE.test(span)) continue;
    const cited = span.replace(/:\d+$/, ""), context = m[2] !== undefined, key = `${context}:${cited}`;
    if ((cited.includes("/") || CITED_EXT_RE.test(cited)) && !seen.has(key)) { seen.add(key); out.push({ path: cited, context }); }
  }
  return out;
}

// One problem line per failing citation: a context citation must exist on
// disk; any other must be changed in the union (a trailing `/` matches any
// file under it).
export function checkChangelogCitations({ citations, union, exists }) {
  const files = [...union];
  return citations.flatMap(({ path: cited, context }) => {
    if (context) return exists(cited) ? [] : [`\`${cited}\` (context, not changed) does not exist on disk`];
    const hit = cited.endsWith("/") ? files.some((f) => f.startsWith(cited)) : files.includes(cited);
    return hit ? [] : [`\`${cited}\` is cited but not changed in PREV_TAG..HEAD or the stage plan`];
  });
}

function step8aCitations(ctx) {
  const { root, runner: r, opts, prevTag } = ctx, step = "8a-2", abs = path.join(root, "CHANGELOG.md");
  const entry = extractChangelogEntry(existsSync(abs) ? readFileSync(abs, "utf-8") : "", opts.version);
  if (entry === null) throw new ReleaseStop("CHANGELOG_CITATION", `CHANGELOG.md has no "## [${opts.version}] - " entry`);
  let range = [];
  if (prevTag) {
    const res = r.read("git", ["diff", "--name-only", "-z", "--no-renames", `${prevTag}..HEAD`], { step });
    if (res.status !== 0) throw new ReleaseStop("INTERNAL", `git diff ${prevTag}..HEAD exited ${res.status}`);
    range = nulList(res.stdout);
  }
  const union = new Set([...range, ...ctx.staged]);
  // Existence is checked inside the repository only.
  const exists = (rel) => {
    const a = path.resolve(root, rel), back = path.relative(root, a);
    return !back.startsWith("..") && !path.isAbsolute(back) && existsSync(a);
  };
  const problems = checkChangelogCitations({ citations: extractCitations(entry), union, exists });
  if (problems.length > 0) {
    for (const p of problems) ctx.err(`release: [${step}] ${p}\n`);
    throw new ReleaseStop("CHANGELOG_CITATION", `${problems.length} citation(s) in the v${opts.version} entry fail: ${problems.join("; ")}`);
  }
  Object.assign(ctx, { changelogEntry: entry, unionFiles: [...union].sort() });
}

// ---- Step 8a, part 2: spec classes, then commit, push and pull request ----

// scope_decision_why records a backlog-row-as-spec mini-chain (PM/architect skipped).
export const recordsMiniChain = (why) => typeof why === "string"
  && /mini-chain/i.test(why) && /pm(\s*\/\s*|\s+)?arch(itect)?\s*(skip|skipped)/i.test(why);

// Top-level feature specs in a file list (array, or one path per line);
// wave manifests and architecture companions are left out.
export function deriveRangeSpecs(files) {
  const list = typeof files === "string" ? files.split("\n") : [...files];
  return list.map((l) => l.trim()).filter((l) => /^specs\/[^/]+\.md$/.test(l) && !/^specs\/(fanout-.*|.*-architecture)\.md$/.test(l));
}

const SPEC_UNCLASSIFIABLE_TEXT = "AC4 unclassifiable: no specs/<active_feature>.md in the tree, pending_notes does not record a multi-feature release, and scope_decision_why does not record a backlog-row-as-spec mini-chain — record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run.";
// No commit exists yet when this check stops, so the remedy is to stage, never to amend.
const specRequireText = (spec) => `Release commit incomplete: ${spec} is absent from the release range <prev-tag>..HEAD. Stage the missing files and re-run.`;

// M = a pending note "Multi-feature release: a, b (…)"; R = the range holds a
// feature spec other than the active one. M or R → MULTI-FEATURE (R alone keeps
// the active feature's single-feature outcome); else spec in tree → REQUIRE;
// else mini-chain → SKIP; else UNCLASSIFIABLE. `unionFiles` is PREV_TAG..HEAD
// plus the stage plan: the set the release commit's range will equal.
export function classifySpecCheck({ feature, unionFiles, specExists, scopeWhy = "", pendingNotes = [], prevTag = "<prev-tag>" }) {
  const files = new Set(typeof unionFiles === "string" ? unionFiles.split("\n") : unionFiles);
  const own = `specs/${feature}.md`, rangeDerived = deriveRangeSpecs([...files]), logs = [], range = `${prevTag}..HEAD`;
  const R = rangeDerived.some((p) => p !== own);
  const m = [pendingNotes].flat().join("\n").match(/^Multi-feature release:\s*(.+?)\.?\s*$/m);
  const done = (branch, classId = null, errorMsg = null) => ({ pass: classId === null, branch, classId, errorMsg, rangeDerived, logs });
  const skipLog = `AC4: SKIP branch — no ${own} in tree; scope_decision_why records backlog-row-as-spec mini-chain`;
  if (m || R) {
    logs.push(`AC4: MULTI-FEATURE branch — range-derived: ${rangeDerived.join(", ") || "none"} present in ${range}`);
    if (!m) {
      if (specExists(feature)) { if (!files.has(own)) return done("MULTI-FEATURE", "SPEC_REQUIRE", specRequireText(own)); }
      else if (recordsMiniChain(scopeWhy)) logs.push(skipLog);
      else return done("MULTI-FEATURE", "SPEC_UNCLASSIFIABLE", SPEC_UNCLASSIFIABLE_TEXT);
      return done("MULTI-FEATURE");
    }
    for (const n of m[1].split(",").map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean)) {
      const spec = `specs/${n}.md`;
      if (!specExists(n)) { logs.push(`AC4: MULTI-FEATURE branch — ${n} has no ${spec}; logged and skipped by design (mini-chain convention)`); continue; }
      if (!files.has(spec)) return done("MULTI-FEATURE", "SPEC_REQUIRE", specRequireText(spec));
      logs.push(`AC4: MULTI-FEATURE branch — ${spec} present in ${range}`);
    }
    return done("MULTI-FEATURE");
  }
  if (specExists(feature)) {
    if (!files.has(own)) return done("REQUIRE", "SPEC_REQUIRE", specRequireText(own));
    logs.push(`AC4: REQUIRE branch — ${own} present in ${range}`);
    return done("REQUIRE");
  }
  if (recordsMiniChain(scopeWhy)) { logs.push(skipLog); return done("SKIP"); }
  return done("UNCLASSIFIABLE", "SPEC_UNCLASSIFIABLE", SPEC_UNCLASSIFIABLE_TEXT);
}

// Runs before the commit, so a stop leaves no commit behind.
function step8aSpecs(ctx) {
  const { root, state } = ctx, step = "8a-3";
  const verdict = classifySpecCheck({
    feature: state.active_feature, unionFiles: ctx.unionFiles, prevTag: ctx.prevTag ?? "<prev-tag>",
    scopeWhy: typeof state.scope_decision_why === "string" ? state.scope_decision_why : "",
    pendingNotes: Array.isArray(state.pending_notes) ? state.pending_notes.filter((n) => typeof n === "string") : [],
    specExists: (n) => safeSegment(n) && existsSync(path.join(root, "specs", `${n}.md`)),
  });
  for (const l of verdict.logs) ctx.out(`release: [${step}] ${l}\n`);
  if (!verdict.pass) throw new ReleaseStop(verdict.classId, verdict.errorMsg);
}

// The branch and local sha a Blocked note names, with the call's last stderr line.
function failedAt(ctx, what, res, step) {
  const head = gitOut(ctx.runner, ["rev-parse", "HEAD"], step) ?? "<unknown>";
  return `${what} exited ${res.status} on ${ctx.runner.branch} at ${head} — ${lastLine(res.stderr) || "no output"}`;
}

// Commit, push and pull request; each one is skipped when a re-run finds it already done.
function step8aCommitPushPr(ctx) {
  const { runner: r, opts } = ctx, v = opts.version, rel = `release/v${v}`;
  if (ctx.commitMade) ctx.out(`release: [8a-4] commit skipped — HEAD is already the v${v} release commit\n`);
  else {
    // The message file goes to git as an argument; it is never read by a shell.
    const res = r.mutate("git", ["commit", "-F", path.resolve(opts.messageFile)], { step: "8a-4" });
    if (res.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, "git commit", res, "8a-4"));
  }
  // A commit made by this run cannot be upstream yet; only a resumed one is compared.
  const head = ctx.commitMade ? gitOut(r, ["rev-parse", "HEAD"], "8a-5") : null;
  const upstream = head && gitOut(r, ["rev-parse", "--verify", "--quiet", "@{u}"], "8a-5");
  if (head && head === upstream) ctx.out(`release: [8a-5] push skipped — the upstream of ${rel} is already at ${head}\n`);
  else {
    const res = r.mutate("git", ["push", "-u", "origin", rel], { step: "8a-5" });
    if (res.status !== 0) throw new ReleaseStop("PUSH_REJECTED", failedAt(ctx, `git push -u origin ${rel}`, res, "8a-5"));
  }
  const pr = viewPr(ctx, rel, "8a-6");
  if (pr?.state === "OPEN") {
    ctx.out(`release: [8a-6] pull request #${pr.number} for ${rel} is already open\n`);
    ctx.okSuffix = ` — pull request #${pr.number}`;
    return;
  }
  const title = ctx.message.split("\n")[0];
  const res = r.mutate("gh", ["pr", "create", "--base", "main", "--head", rel, "--title", title, "--body", ctx.changelogEntry], { step: "8a-6" });
  if (res.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, "gh pr create", res, "8a-6"));
  if (r.dryRun) return;
  const number = /\/pull\/(\d+)\s*$/.exec(res.stdout.trim())?.[1] ?? viewPr(ctx, rel, "8a-6")?.number;
  ctx.okSuffix = ` — pull request #${number ?? "?"}`;
}

// ---- Publish (8b-9a): CI gate, merge, tag, GitHub release, self-check ----

const FAILED_CONCLUSIONS = new Set(["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"]);
// Why the pull request cannot merge as it stands, or null.
function cannotMergeReason(pr) {
  if (pr.state === "CLOSED") return `#${pr.number} is CLOSED`;
  if (pr.mergeable === "CONFLICTING") return `#${pr.number} has merge conflicts`;
  if (pr.mergeStateStatus === "BEHIND" || pr.mergeStateStatus === "DIRTY") return `#${pr.number} merge state is ${pr.mergeStateStatus}`;
  const bad = [...new Set((pr.statusCheckRollup ?? []).map((c) => c?.conclusion).filter((c) => FAILED_CONCLUSIONS.has(c)))];
  return bad.length > 0 ? `#${pr.number} has checks concluded ${bad.join(", ")}` : null;
}
export function classifyPr(pr) {
  if (pr?.state === "MERGED") return "MERGED";
  return !pr || cannotMergeReason(pr) !== null ? "CANNOT_MERGE" : "OPEN";
}

// The CHANGELOG entry body, then an Install section holding README's
// first line that pins `#vX.Y.Z`.
export function buildReleaseNotes({ changelogEntry, readmeText, version }) {
  const body = String(changelogEntry ?? "").split("\n").slice(1).join("\n").trim();
  const pinRe = new RegExp(`#${versionToken(version).source}`);
  const pin = String(readmeText ?? "").split("\n").find((l) => pinRe.test(l));
  if (!body) throw new ReleaseStop("INTERNAL", `CHANGELOG.md has no "## [${version}] - " entry body for the release notes`);
  if (!pin) throw new ReleaseStop("INTERNAL", `README.md has no line pinning #v${version} for the release notes`);
  return `${body}\n\n## Install\n\n\`\`\`\n${pin.trim()}\n\`\`\``;
}

// Same rule as verify-release.mjs's CI budget: unset, empty, or not a
// number >= 0 falls back to the default.
function envSeconds(env, name, fallback) {
  const raw = env?.[name], n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
// Lines verify-release.mjs prints for a failed check, else its last line.
function failLines(res) {
  const fails = `${res.stderr}\n${res.stdout}`.split("\n").filter((l) => l.startsWith("FAIL:"));
  return (fails.join("; ") || lastLine(res.stderr) || lastLine(res.stdout) || "no output").slice(0, 1000);
}

// The commit `tag` points at, locally and on origin; null where absent.
function tagCommits(ctx, tag) {
  const r = ctx.runner, step = "8b-1", ref = `refs/tags/${tag}`;
  const local = gitOut(r, ["rev-parse", "-q", "--verify", `${ref}^{commit}`], step) || null;
  const res = r.read("git", ["ls-remote", "--tags", "origin", ref, `${ref}^{}`], { step });
  if (res.status !== 0) throw new ReleaseStop("INTERNAL", `git ls-remote --tags origin exited ${res.status} — cannot tell whether origin has ${tag}`);
  const oids = new Map(res.stdout.split("\n").filter(Boolean).map((l) => l.split("\t").reverse()));
  // An annotated tag lists its object and, under `^{}`, the commit it points at.
  return { local, origin: oids.get(`${ref}^{}`) ?? oids.get(ref) ?? null };
}

// Tag and release title from the release commit subject; notes from the
// checked-out CHANGELOG.md and README.md (the release commit's content).
function releaseText(ctx, commit, step) {
  if (ctx.release) return ctx.release;
  const { root, opts } = ctx, v = opts.version, prefix = `chore(release): v${v} — `;
  const subject = gitOut(ctx.runner, ["log", "-1", "--format=%s", commit], step);
  if (!subject?.startsWith(prefix)) throw new ReleaseStop("INTERNAL", `${commit} is not the v${v} release commit (subject: ${subject ?? "unreadable"})`);
  const read = (rel) => (existsSync(path.join(root, rel)) ? readFileSync(path.join(root, rel), "utf-8") : "");
  const notes = buildReleaseNotes({ changelogEntry: extractChangelogEntry(read("CHANGELOG.md"), v), readmeText: read("README.md"), version: v });
  return (ctx.release = { title: `v${v} — ${subject.slice(prefix.length)}`, notes });
}

// Polls until the pull request is MERGED; a dry-run records one poll and
// carries a placeholder merge commit forward.
async function waitMerged(ctx, rel, pr, step) {
  const env = ctx.deps.env ?? process.env, sleep = ctx.deps.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
  const budget = envSeconds(env, "AGC_RELEASE_MERGE_WAIT_SECONDS", 900), poll = Math.max(1, envSeconds(env, "AGC_RELEASE_POLL_SECONDS", 15));
  const deadline = Date.now() + budget * 1000;
  for (;;) {
    const seen = viewPr(ctx, rel, step, "deferred");
    if (ctx.runner.dryRun) return { ...pr, state: "MERGED", mergeCommit: { oid: "<merge-commit>" } };
    if (seen && classifyPr(seen) === "MERGED") return seen;
    const why = seen && cannotMergeReason(seen);
    if (why) throw new ReleaseStop("PR_CANNOT_MERGE", `${why} while waiting for the merge — never update the branch or merge with --admin`);
    const left = deadline - Date.now();
    if (left <= 0) throw new ReleaseStop("MERGE_WAIT_TIMEOUT", `#${pr.number} not merged within ${budget}s (AGC_RELEASE_MERGE_WAIT_SECONDS)${seen ? "" : "; the last gh pr view failed"} — re-run ${ctx.opts.phase} to keep waiting`);
    ctx.out(`release: [${step}] #${pr.number} not merged yet; polling again in ${Math.round(Math.min(poll * 1000, left) / 1000)}s\n`);
    await sleep(Math.min(poll * 1000, left));
  }
}

// Refuses a pull request that cannot merge, asks for an auto-merge, then
// waits for MERGED. A dry-run of a pull request this run would create has no
// number yet, so its merge is printed as planned instead of recorded.
async function autoMerge(ctx, rel, pr, step, waitStep = step) {
  const why = cannotMergeReason(pr);
  if (why) throw new ReleaseStop("PR_CANNOT_MERGE", `${why} — never update the branch or merge with --admin`);
  if (pr.number === undefined) ctx.out(`release: DRY-RUN [${step}] gh pr merge <new pull request> --auto --merge\n`);
  else {
    const merge = ctx.runner.mutate("gh", ["pr", "merge", String(pr.number), "--auto", "--merge"], { step });
    if (merge.status !== 0) throw new ReleaseStop("PR_CANNOT_MERGE", failedAt(ctx, `gh pr merge ${pr.number} --auto --merge`, merge, step));
  }
  return waitMerged(ctx, rel, pr, waitStep);
}
// `git switch main` unless already there, then a fast-forward-only pull.
function pullMain(ctx, step) {
  const r = ctx.runner;
  if (r.branch !== "main") {
    const sw = r.mutate("git", ["switch", "main"], { step });
    if (sw.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, "git switch main", sw, step));
  }
  const pull = r.mutate("git", ["-c", "pull.rebase=false", "pull", "--ff-only"], { step });
  if (pull.status !== 0) throw new ReleaseStop("MAIN_DIVERGED", failedAt(ctx, "git pull --ff-only", pull, step));
}
// `git branch -d` of a merged branch when it exists locally; `known`: this run created it.
function deleteMergedBranch(ctx, rel, step, known = false) {
  const r = ctx.runner;
  if (!known && gitOut(r, ["rev-parse", "-q", "--verify", `refs/heads/${rel}`], step) === null) return;
  const res = r.mutate("git", ["branch", "-d", rel], { step });
  if (res.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, `git branch -d ${rel}`, res, step));
}

// Each mutation is skipped when a re-run finds it done: the merge (PR MERGED),
// the tag (at the merge commit, locally or on origin), the release (gh release view).
async function stepPublish(ctx) {
  const { runner: r, opts } = ctx, tag = `v${opts.version}`, rel = `release/${tag}`;
  let pr = ctx.pr;
  const tags = tagCommits(ctx, tag);
  const stray = [["locally", tags.local], ["on origin", tags.origin]]
    .filter(([, oid]) => oid !== null && !(pr.state === "MERGED" && oid === pr.mergeCommit?.oid));
  if (stray.length > 0) {
    const want = pr.state === "MERGED" ? `merge commit ${pr.mergeCommit?.oid} of #${pr.number}` : `a merge commit (#${pr.number} is not merged)`;
    throw new ReleaseStop("TAG_EXISTS", `${tag} exists ${stray.map(([where, oid]) => `${where} at ${oid}`).join(" and ")}, not at ${want} — never delete or move a tag`);
  }
  if (pr.state === "OPEN") {
    // Title and notes are checked before anything irreversible happens.
    releaseText(ctx, pr.headRefOid, "8b-2");
    const ci = r.read("node", ["scripts/verify-release.mjs", "--ci-check", "--strict", "--sha", pr.headRefOid], { step: "8b-2" });
    if (ci.status !== 0 || !ci.stdout.includes("CI-CHECK PASSED")) {
      throw new ReleaseStop("CI_GATE_FAILED", `verify-release.mjs --ci-check --strict exited ${ci.status} for ${pr.headRefOid} — ${failLines(ci)}`);
    }
    pr = await autoMerge(ctx, rel, pr, "8c-1", "8c-2");
  }
  const oid = pr.mergeCommit?.oid;
  if (!oid) throw new ReleaseStop("INTERNAL", `#${pr.number} is MERGED but gh reports no merge commit`);
  const [onLocal, onOrigin] = [tags.local === oid, tags.origin === oid];

  pullMain(ctx, "8c-3");
  // A tag already at the merge commit is never re-created, so main may have moved past it.
  const head = onLocal || onOrigin ? null : r.deferred("git", ["rev-parse", "HEAD"], { step: "8c-3" });
  if (head && head.stdout.trim() !== oid) {
    throw new ReleaseStop("MAIN_DIVERGED", `main is at ${head.stdout.trim() || "<unknown>"} after pull --ff-only, not at merge commit ${oid} — never tag another commit`);
  }
  const { title, notes } = releaseText(ctx, pr.headRefOid, "8c-4");

  if (onLocal || onOrigin) ctx.out(`release: [8c-4] tag skipped — ${tag} is already at ${oid}${onLocal ? "" : " on origin"}\n`);
  else {
    const res = r.mutate("git", ["tag", "-a", tag, "-m", title], { step: "8c-4" });
    if (res.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, `git tag -a ${tag}`, res, "8c-4"));
  }
  if (onOrigin) ctx.out(`release: [8c-5] push skipped — origin already has ${tag} at ${oid}\n`);
  else {
    const res = r.mutate("git", ["push", "origin", tag], { step: "8c-5" });
    if (res.status !== 0) throw new ReleaseStop("PUSH_REJECTED", failedAt(ctx, `git push origin ${tag}`, res, "8c-5"));
  }
  deleteMergedBranch(ctx, rel, "8c-6");

  if (r.read("gh", ["release", "view", tag, "--json", "tagName"], { step: "9" }).status === 0) ctx.out(`release: [9] release skipped — ${tag} already has a GitHub release\n`);
  else {
    // --verify-tag: gh must never create the tag itself, at whatever commit it picks.
    const res = r.mutate("gh", ["release", "create", tag, "--verify-tag", "--title", title, "--notes", notes], { step: "9" });
    if (res.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, `gh release create ${tag}`, res, "9"));
  }
  const check = r.deferred("node", ["scripts/verify-release.mjs", tag], { step: "9a" });
  if (check && check.status !== 0) throw new ReleaseStop("SELF_CHECK_FAILED", `verify-release.mjs ${tag} exited ${check.status} — ${failLines(check)}`);
  ctx.okSuffix = ` — tag at ${oid}`;
}

// ---- Close-out (13a-13b): bookkeeping pull request, then verify-release --close-out ----

// The fields the closing write sets: frontmatter scalars (null when absent)
// and the first bullet under `## Pending & Handoff Notes`.
export function readClosingWrite(handoffText) {
  const text = String(handoffText ?? "").replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---(\n|$)/.exec(text)?.[1] ?? "";
  const field = (key) => {
    const raw = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "m").exec(fm)?.[1];
    if (raw === undefined || raw === "") return null;
    if (/^".*"$/.test(raw)) { try { return JSON.parse(raw); } catch { return raw.slice(1, -1); } }
    return raw.replace(/^'(.*)'$/, "$1");
  };
  const lines = text.split("\n"), at = lines.indexOf("## Pending & Handoff Notes");
  let firstNote = null;
  for (let i = at + 1; at >= 0 && i < lines.length && !/^(## |---)/.test(lines[i]); i++) {
    if (lines[i].startsWith("- ")) { firstNote = lines[i].slice(2).trim(); break; }
  }
  return { lastAgent: field("last_agent"), status: field("status"), nextRole: field("next_role"), firstNote };
}

// verify-release.mjs --close-out prints one FAIL line per failed check on stderr;
// its two known FAILs have different remedies, anything else is unverified.
export function classifyCloseOut(stderr) {
  const lines = String(stderr ?? "").split("\n").map((l) => l.trim());
  if (lines.includes("FAIL: no upstream tracking branch configured")) return "CLOSE_OUT_NO_UPSTREAM";
  if (lines.some((l) => /^FAIL: HEAD is \d+ commit\(s\) ahead of upstream /.test(l))) return "CLOSE_OUT_AHEAD";
  return "CLOSE_OUT_UNVERIFIED";
}
const CLOSE_OUT_REMEDY = {
  CLOSE_OUT_NO_UPSTREAM: " — not on main with an upstream; pushing never fixes this",
  CLOSE_OUT_AHEAD: " — wait for the bookkeeping merge, pull --ff-only and re-run close-out; never push main",
  CLOSE_OUT_UNVERIFIED: "",
};

// The lane directory, as the compiled lane resolver names it.
async function laneDir(ctx) {
  const { root, deps } = ctx, load = deps.importLanePaths ?? (() => import(pathToFileURL(path.join(root, "dist/tools/lane-paths.js")).href));
  let lane;
  try { lane = (await load()).resolveCurrentLane(root); } catch (e) {
    throw new ReleaseStop("LANE_UNRESOLVED", `cannot resolve the lane via dist/tools/lane-paths.js resolveCurrentLane — ${e?.message ?? e}`);
  }
  const dir = `.current/${lane}`, abs = path.join(root, dir);
  if (!safeSegment(lane) || !existsSync(abs) || !statSync(abs).isDirectory()) throw new ReleaseStop("LANE_UNRESOLVED", `lane ${JSON.stringify(lane)}: ${dir}/ does not exist`);
  ctx.out(`release: [13a-1] lane ${lane}\n`);
  return dir;
}

// The closing write must be on disk before it is committed.
function requireClosingWrite(ctx, handoff) {
  const abs = path.join(ctx.root, handoff), v = ctx.opts.version;
  const seen = readClosingWrite(existsSync(abs) ? readFileSync(abs, "utf-8") : "");
  const miss = [["last_agent", seen.lastAgent, "release-engineer"], ["status", seen.status, "In_Progress"], ["next_role", seen.nextRole, "pm"]]
    .filter(([, got, want]) => got !== want).map(([k, got, want]) => `${k} is ${got ?? "absent"} (want ${want})`);
  if (!new RegExp(`^Released ${versionToken(v).source}`).test(seen.firstNote ?? "")) miss.push(`first pending note is ${JSON.stringify(seen.firstNote)} (want "Released v${v}")`);
  if (miss.length > 0) throw new ReleaseStop("CLOSING_WRITE_ABSENT", `${handoff} lacks the closing write: ${miss.join("; ")} — make the closing write and its read-back, then re-run`);
}

// From main: branch, stage the lane's handoff and jsonl sidecars, commit,
// push and open the bookkeeping pull request. Returns that pull request.
async function openBookkeepingPr(ctx, bk) {
  const { root, runner: r, opts } = ctx, title = `chore(governance): post-release bookkeeping for v${opts.version}`;
  const dir = await laneDir(ctx), handoff = `${dir}/handoff.md`;
  requireClosingWrite(ctx, handoff);
  // Sidecars are enumerated, never globbed: a missing pattern must not drop the handoff.
  const changed = new Set(readStatusPaths(r, "13a-3"));
  const sidecars = readdirSync(path.join(root, dir), { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".jsonl")).map((d) => `${dir}/${d.name}`).sort();
  const plan = [handoff, ...sidecars].filter((p) => changed.has(p)), inPlan = (p) => plan.includes(p);
  if (plan.length === 0) throw new ReleaseStop("EMPTY_STAGE", `nothing to stage — ${handoff} and ${dir}/*.jsonl have no changes`);
  const local = gitOut(r, ["rev-parse", "-q", "--verify", `refs/heads/${bk}`], "13a-3");
  const remote = r.read("git", ["ls-remote", "--heads", "origin", `refs/heads/${bk}`], { step: "13a-3" });
  if (remote.status !== 0) throw new ReleaseStop("INTERNAL", `git ls-remote --heads origin exited ${remote.status} — cannot tell whether origin has ${bk}`);
  const where = [local && "locally", remote.stdout.trim() && "on origin"].filter(Boolean);
  if (where.length > 0) throw new ReleaseStop("BRANCH_EXISTS", `${bk} exists ${where.join(" and ")} with no pull request — never delete it`);

  const index = r.read("git", ["diff", "--cached", "--name-only", "-z", "--no-renames"], { step: "13a-4" });
  if (index.status !== 0) throw new ReleaseStop("INTERNAL", `git diff --cached exited ${index.status}`);
  const before = nulList(index.stdout).filter((p) => !inPlan(p));
  if (before.length > 0) throw new ReleaseStop("UNRELATED_CHANGES", `the index already holds ${before.join(" ")}, outside the bookkeeping plan — unstage it first`);
  const sw = r.mutate("git", ["switch", "-c", bk], { step: "13a-4" });
  if (sw.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, `git switch -c ${bk}`, sw, "13a-4"));
  const add = r.mutate("git", ["add", "--", ...plan], { step: "13a-4" });
  if (add.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, "git add", add, "13a-4"));
  const cached = r.deferred("git", ["diff", "--cached", "--name-only", "-z", "--no-renames"], { step: "13a-4" });
  if (cached && cached.status !== 0) throw new ReleaseStop("INTERNAL", `git diff --cached exited ${cached.status}`);
  const staged = cached ? nulList(cached.stdout) : plan;
  if (staged.length === 0) throw new ReleaseStop("EMPTY_STAGE", `nothing staged after git add -- ${plan.join(" ")} — not committing`);
  const stray = staged.filter((p) => !inPlan(p));
  if (stray.length > 0) throw new ReleaseStop("UNRELATED_CHANGES", `the index holds ${stray.join(" ")}, outside the bookkeeping plan`);

  const commit = r.mutate("git", ["commit", "-m", title], { step: "13a-5" });
  if (commit.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, "git commit", commit, "13a-5"));
  const push = r.mutate("git", ["push", "-u", "origin", bk], { step: "13a-5" });
  if (push.status !== 0) throw new ReleaseStop("PUSH_REJECTED", failedAt(ctx, `git push -u origin ${bk}`, push, "13a-5"));
  const body = `Post-release governance bookkeeping for v${opts.version}: ${plan.join(", ")}.`;
  const made = r.mutate("gh", ["pr", "create", "--base", "main", "--head", bk, "--title", title, "--body", body], { step: "13a-5" });
  if (made.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, "gh pr create", made, "13a-5"));
  const number = /\/pull\/(\d+)\s*$/.exec(made.stdout.trim())?.[1];
  const pr = viewPr(ctx, bk, "13a-5", "deferred") ?? { number: number === undefined ? undefined : Number(number), state: "OPEN" };
  if (!r.dryRun && pr.number === undefined) throw new ReleaseStop("INTERNAL", `gh pr create for ${bk} reported no pull request number`);
  return pr;
}

// Each part is skipped when a re-run finds it done: an existing bookkeeping
// pull request was opened from the closing write, so only its merge remains.
async function stepCloseOut(ctx) {
  const { runner: r, opts } = ctx, bk = `release/v${opts.version}-bookkeeping`;
  let pr = ctx.pr;
  const created = !pr;
  if (pr) ctx.out(`release: [13a-2] bookkeeping pull request #${pr.number} is ${pr.state} — its commit carries the closing write\n`);
  else pr = await openBookkeepingPr(ctx, bk);
  if (pr.state === "OPEN") pr = await autoMerge(ctx, bk, pr, "13a-6");
  const oid = pr.mergeCommit?.oid;
  if (!oid) throw new ReleaseStop("INTERNAL", `#${pr.number} is MERGED but gh reports no merge commit`);
  pullMain(ctx, "13a-6");
  // Nothing is tagged here, so main may have moved past the merge commit; it must contain it.
  const reach = r.deferred("git", ["rev-list", "--count", `HEAD..${oid}`], { step: "13a-6" });
  if (reach && (reach.status !== 0 || reach.stdout.trim() !== "0")) {
    throw new ReleaseStop("MAIN_DIVERGED", `main does not contain merge commit ${oid} of #${pr.number} after pull --ff-only`);
  }
  deleteMergedBranch(ctx, bk, "13a-6", created && r.dryRun);
  const res = r.deferred("node", ["scripts/verify-release.mjs", "--close-out"], { step: "13b" });
  if (res && (res.status !== 0 || !res.stdout.includes("CLOSE-OUT PASSED"))) {
    const id = classifyCloseOut(res.stderr);
    throw new ReleaseStop(id, `verify-release.mjs --close-out exited ${res.status} — ${failLines(res)}${CLOSE_OUT_REMEDY[id]}`);
  }
  ctx.okSuffix = " — CLOSE-OUT PASSED";
}

const PHASES = {
  prepare: [preInputs, preGh, prePrepare, step7a, step7b, step7c, step7d, step8aStage, step8aCitations, step8aSpecs, step8aCommitPushPr],
  publish: [preGh, prePublish, stepPublish],
  "close-out": [preGh, preCloseOut, stepCloseOut],
};

export async function main(argv, deps = {}) {
  const [out, err] = [deps.out ?? writer(process.stdout), deps.err ?? writer(process.stderr)];
  try {
    const opts = parseArgs(argv);
    if (opts.phase === "help") { out(USAGE_TEXT); return 0; }
    const root = deps.root ?? ROOT, ctx = { opts, root, deps, out, err };
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
