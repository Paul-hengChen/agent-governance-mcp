#!/usr/bin/env node
// Release mechanics in five phases: the manual prepare, publish and close-out,
// and the runner-only start and record that a workflow adds around them; `--help`.
// Each failure class has its own exit code and a last stderr line `RELEASE_STOP
// <CLASS_ID>: <detail>`; `--dry-run` runs every read and only records mutations.
// Contracts: specs/e394-release-sop-rewrite-architecture.md, specs/e405-release-cd-architecture.md.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, renameSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "node:path";
import * as os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHASE_OF = { s: "start", p: "prepare", u: "publish", r: "record", c: "close-out" };

// Codes group by decade: 1-9 any phase, 10s preconditions, 20s prepare
// bookkeeping, 30s prepare commit/push, 40s publish, 50s close-out, 60s runner
// state and gates, 70s runner bump, build and checks. Phase letters are in run
// order: s start, p prepare, u publish, r record, c close-out.
export const EXIT_CLASSES = Object.freeze([
  [1, "INTERNAL", "spurc"], [2, "USAGE", "spurc"], [10, "WRONG_BRANCH", "spurc"], [11, "STALE_BASE", "p"],
  [12, "VERSION_INCOHERENT", "sp"], [13, "UNRELATED_CHANGES", "pc"], [14, "GH_UNAVAILABLE", "spuc"],
  [20, "EMPTY_BASELINE", "p"], [21, "DRIFT_BASELINE", "p"], [22, "DONE_MARK", "sp"],
  [23, "BOOKKEEPING_CHECK", "p"], [24, "ADAPTER_STAMP", "p"], [30, "STAGING_INCOMPLETE", "p"],
  [31, "CHANGELOG_CITATION", "p"], [32, "SPEC_REQUIRE", "p"], [33, "SPEC_UNCLASSIFIABLE", "p"],
  [34, "PUSH_REJECTED", "puc"], [35, "MUTATION_FAILED", "spuc"], [40, "TAG_EXISTS", "u"],
  [41, "CI_GATE_FAILED", "u"], [42, "PR_CANNOT_MERGE", "uc"], [43, "MERGE_WAIT_TIMEOUT", "uc"],
  [44, "MAIN_DIVERGED", "suc"], [45, "SELF_CHECK_FAILED", "u"], [50, "CLOSING_WRITE_ABSENT", "c"],
  [51, "LANE_UNRESOLVED", "sc"], [52, "EMPTY_STAGE", "c"], [53, "BRANCH_EXISTS", "c"],
  [54, "CLOSE_OUT_NO_UPSTREAM", "c"], [55, "CLOSE_OUT_AHEAD", "c"], [56, "CLOSE_OUT_UNVERIFIED", "c"],
  [60, "PRECONDITION_NOT_PASS", "s"], [61, "STATE_WRITE_REJECTED", "sr"], [62, "READBACK_MISMATCH", "r"],
  [63, "PREFLIGHT_CI_RED", "s"], [64, "RELEASE_BRANCH_EXISTS", "s"], [70, "CHANGELOG_ENTRY_MISSING", "s"],
  [71, "LOCKFILE_DRIFT", "s"], [72, "BUILD_FAILED", "s"], [73, "TEST_FAILED", "s"], [74, "AUDIT_FAILED", "s"],
  [75, "ADVISORY_UNDISPOSED", "s"],
].map(([code, id, ph]) => Object.freeze({ code, id, phases: Object.freeze([...ph].map((k) => PHASE_OF[k])) })));
// Phases only the workflow runs; a class whose phases all lie here has no SOP row.
export const RUNNER_PHASES = Object.freeze(["start", "record"]);

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
// The members that name one file: step 8a-1 stages them even while untracked.
const STAGE_FILES = Object.freeze(STAGE_MEMBERS.filter((m) => !m.endsWith("/")));
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
  rule("git", "add", true, "add -- <paths> | add --update -- <paths>",
    (a) => (a[1] === "--" && a.length > 2) || (a[1] === "--update" && a[2] === "--" && a.length > 3)),
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
  rule("node", "scripts/check-transitions-sync.mjs", false, "no arguments", exact()),
  rule("node", "scripts/verify-release.mjs", false, "--ci-check [--strict --sha <sha>] | vX.Y.Z | --close-out",
    either(exact("--ci-check"), exact("--ci-check", "--strict", "--sha", /^[0-9a-f]{40}([0-9a-f]{24})?$/), exact(TAG), exact("--close-out"))),
  rule("node", "bin/agc-init.mjs", false, "check", exact("check")),
  rule("npm", "install", true, "install --package-lock-only", exact("--package-lock-only")),
  // npm test and npx tsc write only dist/ and are always called deferred, so a dry-run never builds or tests.
  rule("npm", "test", false, "test, no arguments; always deferred", exact()),
  rule("npm", "audit", false, "audit --audit-level=high --json", exact("--audit-level=high", "--json")),
  rule("npx", "tsc", false, "tsc, no arguments; always deferred", exact()),
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

// The env a child sees: the runner's env with the per-call overlay on top.
// npm and npx children also lose the tokens and every AGC_* key, so a test
// suite run here sees CI's env and cannot reach the workflow's stop-line file.
const SCRUBBED = (k) => k === "GH_TOKEN" || k === "GITHUB_TOKEN" || k.startsWith("AGC_");
function childEnv(base, overlay, cmd) {
  const scrub = cmd === "npm" || cmd === "npx";
  if (!overlay && !scrub) return base;
  const env = { ...base, ...overlay };
  if (scrub) for (const k of Object.keys(env)) if (SCRUBBED(k)) delete env[k];
  return env;
}

// Every process call and file write goes through here: argv arrays only,
// never a shell. Under dry-run mutations are recorded in `actions`, not run.
export function createRunner({ root = ROOT, dryRun = false, spawn = spawnSync, env = process.env, out, err } = {}) {
  const [say, warn] = [out ?? writer(process.stdout), err ?? writer(process.stderr)];
  const inside = (rel) => {
    const abs = path.resolve(root, rel), r = path.relative(root, abs);
    if (path.isAbsolute(rel) || r === "" || r.startsWith("..")) throw new ReleaseStop("INTERNAL", `runner refused a path outside the repository: ${rel}`);
    return abs;
  };
  const exec = (cmd, args, step, kind, overlay) => {
    runner.actions.push({ step, kind, cmd, args: [...args], executed: true });
    say(`release: [${step}] $ ${cmd} ${show(args)}\n`);
    const [bin, argv] = cmd === "node" ? [process.execPath, [path.join(root, args[0]), ...args.slice(1)]] : [cmd, args];
    const res = spawn(bin, argv, { cwd: root, env: childEnv(env, overlay, cmd), encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
    const result = { status: res.status ?? -1, stdout: res.stdout ?? "", stderr: res.error ? String(res.error.message) : res.stderr ?? "" };
    if (result.stdout) say(result.stdout.replace(/\0/g, "\n").replace(/\n?$/, "\n"));
    if (result.stderr) warn(result.stderr.replace(/\n?$/, "\n"));
    return result;
  };
  const record = (action, text) => (runner.actions.push({ ...action, executed: !dryRun }), say(`release: ${dryRun ? "DRY-RUN " : ""}[${action.step}] ${text}\n`));
  const fsAct = (op, step, rel, dest, run) => (record({ step, kind: "fs", op, path: rel, ...(dest ? { dest } : {}) }, op === "move" ? `mv ${rel} ${dest}` : `${op} ${rel}`), dryRun || run());
  const runner = {
    actions: [], branch: null, dryRun, root,
    // `env` is a per-call overlay on the runner's env (read and deferred only).
    read(cmd, args, { step, env: overlay }) { assertAllowed(cmd, args, "read", runner.branch); return exec(cmd, args, step, "read", overlay); },
    mutate(cmd, args, { step }) {
      assertAllowed(cmd, args, "mutate", runner.branch);
      if (dryRun) record({ step, kind: "mutate", cmd, args: [...args] }, `${cmd} ${show(args)}`);
      const res = dryRun ? { status: 0, stdout: "", stderr: "" } : exec(cmd, args, step, "mutate");
      if (cmd === "git" && args[0] === "switch" && res.status === 0) runner.branch = args[args.length - 1];
      return res;
    },
    // A read that observes an earlier mutation of the same phase: dry-run
    // records it and returns null, a real run returns the read's result.
    deferred(cmd, args, { step, env: overlay }) {
      assertAllowed(cmd, args, "read", runner.branch);
      return dryRun ? (record({ step, kind: "deferred", cmd, args: [...args] }, `${cmd} ${show(args)}`), null) : exec(cmd, args, step, "deferred", overlay);
    },
    // A governance state call (op "get" or "update"): dry-run records it and
    // returns null without calling `fn`, so nothing is loaded or written.
    async state(op, label, fn, { step }) {
      runner.actions.push({ step, kind: "state", op, executed: !dryRun });
      say(dryRun ? `release: DRY-RUN [${step}] ${label}\n` : `release: [${step}] $ ${label}\n`);
      return dryRun ? null : fn();
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
  node scripts/release.mjs start     --bump <patch|minor|major> --tickets <E1[,E2…]|none> --work-dir <dir> [--dry-run]
  node scripts/release.mjs prepare   --version X.Y.Z --state <file> --tickets <E1[,E2…]|none> --message-file <file> [--dry-run]
  node scripts/release.mjs publish   --version X.Y.Z [--dry-run]
  node scripts/release.mjs record    --version X.Y.Z [--dry-run]
  node scripts/release.mjs close-out --version X.Y.Z [--dry-run]
  node scripts/release.mjs --help
`;
const FLAGS = {
  start: ["--bump", "--tickets", "--work-dir"], prepare: ["--version", "--state", "--tickets", "--message-file"],
  publish: ["--version"], record: ["--version"], "close-out": ["--version"],
};
const BUMPS = ["patch", "minor", "major"];
const usage = (detail) => new ReleaseStop("USAGE", detail);
// Backlog ids joined by commas, or none; undefined stays undefined.
function parseTickets(raw) {
  const tickets = raw === undefined || raw === "none" ? raw : raw.split(",");
  if (Array.isArray(tickets) && !tickets.every((t) => /^[A-Z]+\d+[A-Za-z0-9]*$/.test(t))) throw usage(`--tickets must be backlog ids or none (got ${raw})`);
  return tickets;
}
export function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { phase: "help" };
  const [phase, ...rest] = argv;
  if (!Object.hasOwn(FLAGS, phase ?? "")) throw usage(`unknown or missing phase ${JSON.stringify(phase ?? null)} — expected start, prepare, publish, record or close-out`);
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
  // `start` needs all three flags; `prepare` may omit --tickets.
  const missing = FLAGS[phase].find((f) => (phase === "start" || f !== "--tickets") && !Object.hasOwn(seen, f));
  if (missing) throw usage(`${phase} requires ${missing}`);
  if (phase === "start") {
    if (!BUMPS.includes(seen["--bump"])) throw usage(`--bump must be patch, minor or major (got ${seen["--bump"]})`);
    // The work directory is created and checked by the phase (pre-1), which knows the repository root.
    return { phase, bump: seen["--bump"], tickets: parseTickets(seen["--tickets"]), workDir: seen["--work-dir"], dryRun };
  }
  if (!SEMVER.test(seen["--version"])) throw usage(`--version must be X.Y.Z without a leading v (got ${seen["--version"]})`);
  if (phase !== "prepare") return { phase, version: seen["--version"], dryRun };
  return { phase, version: seen["--version"], dryRun, statePath: seen["--state"], tickets: parseTickets(seen["--tickets"]), messageFile: seen["--message-file"] };
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
// `text` holds the install pin `#<tag>` as a whole token: `#v1.2.1` is not
// found inside `#v1.2.10` (the same tail boundary as versionToken).
const reEscape = (t) => t.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
const pinsTag = (text, tag) => new RegExp(`#${reEscape(tag)}(?!\\w|\\.\\d)`).test(text);
const gitOut = (r, args, step) => { const res = r.read("git", args, { step }); return res.status === 0 ? res.stdout.trim() : null; };

// A state read view that elided entries: it carries a `*_truncated` key or a
// pending note beginning with the read-view marker.
const READ_VIEW_MARKER = "⟦agc read-view⟧";
const readViewTruncated = (state) => "pending_notes_truncated" in state || "completed_tasks_truncated" in state
  || (Array.isArray(state.pending_notes) && state.pending_notes.some((n) => typeof n === "string" && n.startsWith(READ_VIEW_MARKER)));
// A handoff.md copy is parsed by the compiled canonical parser inside a
// throwaway workspace under the OS temp directory (never the repository); the
// parser may write migration results there, and the directory is removed.
async function parseHandoffCopy(ctx, text) {
  const { root, deps } = ctx, load = deps.importHandoffParse ?? (() => import(pathToFileURL(path.join(root, "dist/tools/handoff-parse.js")).href));
  let parseHandoff;
  try { ({ parseHandoff } = await load()); } catch (e) { throw usage(`--state is a handoff copy, but dist/tools/handoff-parse.js cannot be loaded (run npm run build) — ${e?.message ?? e}`); }
  const tmp = mkdtempSync(path.join(os.tmpdir(), "release-state-"));
  try {
    mkdirSync(path.join(tmp, ".current"));
    writeFileSync(path.join(tmp, ".current", "handoff.md"), text);
    let state;
    try { state = parseHandoff(tmp); } catch (e) { throw usage(`--state handoff copy cannot be parsed: ${e?.message ?? e}`); }
    if (state === null || typeof state !== "object") throw usage("--state handoff copy cannot be parsed: the parser returned no state");
    return state;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
// --state is either a verbatim handoff.md copy (it opens with the `---`
// frontmatter fence) or a state JSON object.
async function readState(ctx) {
  const text = readInput(ctx.root, ctx.opts.statePath, "--state");
  if (text.replace(/^\uFEFF/, "").startsWith("---")) return parseHandoffCopy(ctx, text);
  try { return JSON.parse(text); } catch (e) { throw usage(`--state is neither a handoff copy nor JSON: ${e.message}`); }
}
async function preInputs(ctx) {
  const { opts, root } = ctx;
  const state = await readState(ctx);
  const pass = state?.last_agent === "qa-engineer" && state.status === "PASS" && typeof state.active_feature === "string" && state.active_feature;
  if (!pass) throw usage(`--state must be a (qa-engineer, PASS) snapshot with an active_feature (got ${state?.last_agent}, ${state?.status})`);
  if (readViewTruncated(state)) throw usage("--state is a truncated read view (notes or task ids were omitted, so a release-scope note may be hidden) — pass a copy of the lane's handoff.md taken before the opening write");
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
// Every entry `git status` reports, as { path, untracked }; entries are
// "XY path\0", and a rename or copy adds "origin\0" after it. XY `??` is untracked.
function readStatusEntries(r, step) {
  const st = r.read("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { step });
  if (st.status !== 0) throw new ReleaseStop("INTERNAL", `git status exited ${st.status}`);
  const f = st.stdout.split("\0"), entries = [];
  for (let i = 0; i < f.length; i++) {
    if (!f[i]) continue;
    entries.push({ path: f[i].slice(3), untracked: f[i].startsWith("??") });
    if (/^[RC]/.test(f[i]) && f[i + 1]) entries.push({ path: f[++i], untracked: false });
  }
  return entries;
}
const readStatusPaths = (r, step) => readStatusEntries(r, step).map((e) => e.path);
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
  if (!pinsTag(readme, `v${v}`)) throw new ReleaseStop("VERSION_INCOHERENT", `README.md has no #v${v} install pin`);
  if (ctx.prevTag && ctx.prevTag !== `v${v}` && pinsTag(readme, ctx.prevTag)) throw new ReleaseStop("VERSION_INCOHERENT", `README.md still pins #${ctx.prevTag}`);
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

// The ticket code in an evidence basename (`review_T-ABC-01.md` → ABC), or null.
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
  const moved = new Set();
  for (const m of plan) {
    if (r.move(m.from, m.to, { step: "7a" })) moved.add(m.from);
    else ctx.out(`release: [7a] kept ${m.from} — ${m.to} already exists\n`);
  }
  // Root files new to this release that no move took away; step 8a-1 stages them.
  const freshRoots = TREES.filter(([key]) => on[key]).flatMap(([key, tree]) => trees[key].fresh.map((n) => `${tree}/${n}`)).filter((p) => !moved.has(p));
  Object.assign(ctx, { codes, archived: plan, freshRoots });
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

// `changed`: the planned paths (tracked changes plus the plan-named untracked
// paths); `staged`: the index after staging (or, under dry-run, the planned
// paths the stage covers); `unstaged` / `untracked`: leftovers outside
// .current/, which never ships in the release commit — tracked changes, and
// plan-named untracked paths. `unplanned`: untracked paths no plan entry
// names; they are returned as `warnings` and never affect `pass`.
export function checkStagingCompleteness({ changed, staged, unstaged = [], untracked = [], unplanned = [] }) {
  const missing = STAGE_PATHS.featureDirs.filter((d) => changed.some((p) => p.startsWith(d)) && !staged.some((p) => p.startsWith(d)));
  const problems = [];
  if (missing.length > 0) problems.push(`feature dir(s) with changes absent from the index: ${missing.join(" ")}`);
  if (unstaged.length > 0) problems.push(`tracked file(s) left unstaged: ${unstaged.join(" ")}`);
  if (untracked.length > 0) problems.push(`untracked file(s) never staged: ${untracked.join(" ")}`);
  return { pass: problems.length === 0, missing, problems, warnings: [...unplanned] };
}

// The untracked paths the release plan names: the single-file members, the
// specs step 8a-3 can require, the step-7a move destinations, and the root
// files 7a admitted as new and left in place.
function planNamedPaths(ctx) {
  const { state } = ctx, notes = Array.isArray(state.pending_notes) ? state.pending_notes.filter((n) => typeof n === "string") : [];
  const specs = [state.active_feature, ...(multiFeatureNames(notes) ?? [])].filter(safeSegment).map((n) => `specs/${n}.md`);
  return new Set([...STAGE_FILES, ...specs, ...(ctx.archived ?? []).map((m) => m.to), ...(ctx.freshRoots ?? [])]);
}

function step8aStage(ctx) {
  const { root, runner: r, opts } = ctx, step = "8a-1";
  const entries = readStatusEntries(r, step);
  const tracked = new Set(entries.filter((e) => !e.untracked).map((e) => e.path));
  const untracked = new Set(entries.filter((e) => e.untracked).map((e) => e.path));
  // A dry-run never ran the earlier writes and moves, so their paths stand in
  // for the status: a move source leaves (an untracked one is simply gone), its
  // destination arrives untracked, and a write to an absent path is untracked.
  const gone = new Set(), standIns = [];
  if (r.dryRun) {
    for (const a of r.actions) {
      if (a.kind !== "fs" || a.op === "mkdir") continue;
      standIns.push(a.path, ...(a.dest ? [a.dest] : []));
      if (a.op === "move") {
        if (untracked.delete(a.path)) gone.add(a.path); else tracked.add(a.path);
        untracked.add(a.dest);
      } else if (!untracked.has(a.path)) (existsSync(path.join(root, a.path)) ? tracked : untracked).add(a.path);
    }
  }
  const named = planNamedPaths(ctx);
  const plan = planStage({ changed: [...tracked], exists: (m) => existsSync(path.join(root, m)) || standIns.some((p) => under(p, m)) });
  const paths = [...untracked].filter((p) => named.has(p)).sort();
  const changed = [...tracked, ...paths];
  ctx.stagePlan = plan;
  if (plan.length > 0) {
    const add = r.mutate("git", ["add", "--update", "--", ...plan], { step });
    if (add.status !== 0) throw new ReleaseStop("MUTATION_FAILED", `git add --update exited ${add.status} — ${lastLine(add.stderr)}`);
  }
  if (paths.length > 0) {
    const add = r.mutate("git", ["add", "--", ...paths], { step });
    if (add.status !== 0) throw new ReleaseStop("MUTATION_FAILED", `git add exited ${add.status} — ${lastLine(add.stderr)}`);
  }
  if (plan.length === 0 && paths.length === 0) {
    // Nothing to stage on top of the release commit means a re-run after it; the commit step is then skipped.
    const head = gitOut(r, ["log", "-1", "--format=%s"], step);
    if (head === null || !releaseSubject(opts.version).test(head)) {
      throw new ReleaseStop("STAGING_INCOMPLETE", `nothing to commit — no STAGE_PATHS member has a change and HEAD is not the v${opts.version} release commit`);
    }
    ctx.commitMade = true;
    ctx.out(`release: [${step}] nothing to stage — HEAD is already the v${opts.version} release commit\n`);
  }
  const added = new Set(paths), covered = (p) => added.has(p) || (tracked.has(p) && plan.some((m) => under(p, m)));
  const cached = r.deferred("git", ["diff", "--cached", "--name-only", "-z", "--no-renames"], { step });
  if (cached && cached.status !== 0) throw new ReleaseStop("INTERNAL", `git diff --cached exited ${cached.status}`);
  const staged = cached ? nulList(cached.stdout) : changed.filter(covered);
  // Dry-run reads the untouched index, so what the stage would cover, or a move would take away, is not a leftover.
  const leftovers = (args) => {
    const res = r.read("git", args, { step });
    if (res.status !== 0) throw new ReleaseStop("INTERNAL", `git ${args[0]} exited ${res.status}`);
    return nulList(res.stdout).filter((p) => !r.dryRun || !(covered(p) || gone.has(p)));
  };
  const unstaged = leftovers(["diff", "--name-only", "-z", "--", ".", ":!.current"]);
  const others = leftovers(["ls-files", "--others", "--exclude-standard", "-z", "--", ".", ":!.current"]);
  const verdict = checkStagingCompleteness({
    changed, staged, unstaged,
    untracked: others.filter((p) => named.has(p)),
    unplanned: others.filter((p) => !named.has(p)),
  });
  for (const p of verdict.warnings) ctx.err(`release: [${step}] warning: untracked ${p} is named by no release plan entry — left out of the release commit\n`);
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

// The feature names a pending note "Multi-feature release: a, b (…)" lists,
// or null when no note has that shape. Steps 8a-1 and 8a-3 both read it here.
export function multiFeatureNames(pendingNotes) {
  const m = [pendingNotes].flat().join("\n").match(/^Multi-feature release:\s*(.+?)\.?\s*$/m);
  return m ? m[1].split(",").map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean) : null;
}

// M = a pending note "Multi-feature release: a, b (…)"; R = the range holds a
// feature spec other than the active one. M or R → MULTI-FEATURE (R alone keeps
// the active feature's single-feature outcome); else spec in tree → REQUIRE;
// else mini-chain → SKIP; else UNCLASSIFIABLE. `unionFiles` is PREV_TAG..HEAD
// plus the stage plan: the set the release commit's range will equal.
export function classifySpecCheck({ feature, unionFiles, specExists, scopeWhy = "", pendingNotes = [], prevTag = "<prev-tag>" }) {
  const files = new Set(typeof unionFiles === "string" ? unionFiles.split("\n") : unionFiles);
  const own = `specs/${feature}.md`, rangeDerived = deriveRangeSpecs([...files]), logs = [], range = `${prevTag}..HEAD`;
  const R = rangeDerived.some((p) => p !== own);
  const m = multiFeatureNames(pendingNotes);
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
    for (const n of m) {
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
// The verdict of one verify-release.mjs --ci-check call, from its exit and its
// printed lines: a completed red run and a run not completed yet have their own
// FAIL phrasing; any other failure (gh unanswered, unreadable output) is unverified.
export function classifyCiState({ status, stdout, stderr } = {}) {
  const fails = `${stderr ?? ""}\n${stdout ?? ""}`.split("\n").filter((l) => l.startsWith("FAIL:"));
  if (status === 0 && String(stdout ?? "").includes("CI-CHECK PASSED")) return "passed";
  if (fails.some((l) => l.includes(' concluded "'))) return "red";
  if (fails.some((l) => l.includes("no completed CI run for "))) return "pending";
  return "unverified";
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
    // A dry-run polls once with no wait budget and reports the state; only a completed red run stops it.
    const ci = r.read("node", ["scripts/verify-release.mjs", "--ci-check", "--strict", "--sha", pr.headRefOid],
      { step: "8b-2", env: r.dryRun ? { AGC_VERIFY_CI_WAIT_SECONDS: "0" } : undefined });
    const seen = r.dryRun ? classifyCiState(ci) : null;
    if (seen !== null && seen !== "red") {
      const text = seen === "passed" ? "passed" : seen === "pending" ? "not completed yet" : `unverified — ${failLines(ci)}`;
      ctx.out(`release: DRY-RUN [8b-2] CI state of ${pr.headRefOid}: ${text} — not waited for under --dry-run\n`);
    } else if (ci.status !== 0 || !ci.stdout.includes("CI-CHECK PASSED")) {
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

// The lane directory, as the compiled lane resolver names it; `step` labels the log line.
async function laneDir(ctx, step = "13a-1") {
  const { root, deps } = ctx, load = deps.importLanePaths ?? (() => import(pathToFileURL(path.join(root, "dist/tools/lane-paths.js")).href));
  let lane;
  try { lane = (await load()).resolveCurrentLane(root); } catch (e) {
    throw new ReleaseStop("LANE_UNRESOLVED", `cannot resolve the lane via dist/tools/lane-paths.js resolveCurrentLane — ${e?.message ?? e}`);
  }
  const dir = `.current/${lane}`, abs = path.join(root, dir);
  if (!safeSegment(lane) || !existsSync(abs) || !statSync(abs).isDirectory()) throw new ReleaseStop("LANE_UNRESOLVED", `lane ${JSON.stringify(lane)}: ${dir}/ does not exist`);
  ctx.out(`release: [${step}] lane ${lane}\n`);
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

// ---- Start (pre-1..s2): work directory, branch, precondition, opening write ----

// pre-1: the work directory holds the hand-offs to prepare and the workflow.
// Like readInput it must lie outside the repository (realpath compare); the
// nearest existing ancestor is checked first, so a refused path is never created.
function preWorkDir(ctx) {
  const { opts, root } = ctx, abs = path.resolve(opts.workDir), realRoot = realpathSync(root);
  const outside = (real) => { const rel = path.relative(realRoot, real); return rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel); };
  let probe = abs;
  while (!existsSync(probe)) probe = path.dirname(probe);
  if (!outside(path.join(realpathSync(probe), path.relative(probe, abs)))) throw usage(`--work-dir ${opts.workDir} is inside the repository — keep it outside the repository root`);
  try { mkdirSync(abs, { recursive: true }); } catch (e) { throw usage(`--work-dir ${opts.workDir} cannot be created: ${e.message}`); }
  if (!statSync(abs).isDirectory() || !outside(realpathSync(abs))) throw usage(`--work-dir ${opts.workDir} is not a directory outside the repository root`);
  ctx.workDir = abs;
}
// Work-directory files are plain fs writes, since the runner refuses paths
// outside the root; they are made under --dry-run too, as nothing in the repository changes.
function writeWorkFile(ctx, step, name, content) {
  writeFileSync(path.join(ctx.workDir, name), content);
  ctx.out(`release: [${step}] wrote ${path.join(ctx.opts.workDir, name)}\n`);
}
// pre-3: on main, tracking origin/main.
function preStart(ctx) {
  requireBranch(ctx, (b) => b === "main", "main");
  const up = gitOut(ctx.runner, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], "pre-3");
  if (up !== "origin/main") throw new ReleaseStop("WRONG_BRANCH", `main tracks ${up || "no upstream"}, expected origin/main`);
}
// s1: the release gate is the checkout's own lane handoff at (qa-engineer, PASS).
// Nothing is written before that holds; then the handoff is copied byte for
// byte to <work-dir>/state.md, which prepare reads as --state.
async function stepPrecondition(ctx) {
  const handoff = `${await laneDir(ctx, "s1")}/handoff.md`, abs = path.join(ctx.root, handoff);
  const notPass = (why) => new ReleaseStop("PRECONDITION_NOT_PASS", `${handoff} ${why} — commit the release gate's (qa-engineer, PASS) write to main first`);
  if (!existsSync(abs)) throw notPass("does not exist");
  const bytes = readFileSync(abs);
  let state;
  try { state = await parseHandoffCopy(ctx, bytes.toString("utf-8")); } catch (e) {
    if (e instanceof ReleaseStop) throw notPass(`cannot be parsed (${e.detail})`);
    throw e;
  }
  if (state.last_agent !== "qa-engineer" || state.status !== "PASS") throw notPass(`is (${state.last_agent ?? "absent"}, ${state.status ?? "absent"}), expected (qa-engineer, PASS)`);
  if (!safeSegment(state.active_feature)) throw notPass(`active_feature ${JSON.stringify(state.active_feature ?? null)} cannot name an archive directory`);
  writeWorkFile(ctx, "s1", "state.md", bytes);
  ctx.state = state;
}

// The compiled server, loaded once per process and never under --dry-run (a
// real get may lazily migrate an old handoff and write it).
async function loadOrchestrator(ctx) {
  if (ctx.orchestrator) return ctx.orchestrator;
  const { root, deps } = ctx, load = deps.importOrchestrator ?? (() => import(pathToFileURL(path.join(root, "dist/tools/handoff-orchestrator.js")).href));
  const fail = (why) => new ReleaseStop("STATE_WRITE_REJECTED", `cannot load dist/tools/handoff-orchestrator.js (run npm run build) — ${why}`);
  let mod;
  try { mod = await load(); } catch (e) { throw fail(e?.message ?? e); }
  if (typeof mod?.handleGetState !== "function" || typeof mod?.handleUpdateState !== "function") throw fail("handleGetState or handleUpdateState is not exported");
  return (ctx.orchestrator = mod);
}
const stateLabel = (op, a) => (op === "get" ? "tw_get_state"
  : `tw_update_state agent_id=${a.agent_id} status=${a.status} active_feature=${a.active_feature}${a.next_role ? ` next_role=${a.next_role}` : ""} pending_notes=${JSON.stringify(a.pending_notes)}`);
// One state call through the runner. A throw or an isError result stops with
// the server's first text line, which carries the gate code; a get returns the
// parsed state, an update its text, a dry-run null.
async function stateCall(ctx, op, args, step) {
  const label = stateLabel(op, args), tool = label.split(" ")[0];
  return ctx.runner.state(op, label, async () => {
    const orch = await loadOrchestrator(ctx);
    let res;
    try { res = await (op === "get" ? orch.handleGetState(args) : orch.handleUpdateState(args)); } catch (e) {
      throw new ReleaseStop("STATE_WRITE_REJECTED", `${tool} threw — ${e?.message ?? e}`);
    }
    const text = typeof res?.content?.[0]?.text === "string" ? res.content[0].text : "";
    if (!res || res.isError) throw new ReleaseStop("STATE_WRITE_REJECTED", text.split("\n").map((l) => l.trim()).find(Boolean) ?? `${tool} failed with no message`);
    if (op === "update") return text;
    try { return JSON.parse(text); } catch { throw new ReleaseStop("STATE_WRITE_REJECTED", `${tool} returned non-JSON text`); }
  }, { step });
}
// s2: the opening write (SOP step 2), before the first repository mutation; get
// comes first in this process for the pre-flight guard and the freshness snapshot.
async function stepOpeningWrite(ctx) {
  const { root, state } = ctx, feature = state.active_feature;
  await stateCall(ctx, "get", { workspace_path: root }, "s2");
  await stateCall(ctx, "update", {
    workspace_path: root, agent_id: "release-engineer", status: "In_Progress", active_feature: feature,
    completed_tasks: [], pending_notes: [`release-engineer: starting release for ${feature}`],
  }, "s2");
}

// ---- Start (s3-s7): CHANGELOG entry, pre-flight CI, version, release branch, bumps ----

// patch → x.y.(z+1), minor → x.(y+1).0, major → (x+1).0.0.
export function deriveVersion(current, bump) {
  if (!SEMVER.test(String(current))) throw new ReleaseStop("VERSION_INCOHERENT", `package.json version ${JSON.stringify(current)} is not x.y.z`);
  const [x, y, z] = current.split(".").map(Number);
  if (bump === "patch") return `${x}.${y}.${z + 1}`;
  if (bump === "minor") return `${x}.${y + 1}.0`;
  if (bump === "major") return `${x + 1}.0.0`;
  throw usage(`--bump must be patch, minor or major (got ${bump})`);
}

const incoherent = (detail) => new ReleaseStop("VERSION_INCOHERENT", detail);
const jsonObject = (text) => { try { const o = JSON.parse(text); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch { return null; } };
// The three version targets, each found exactly where it must be: the
// package.json top-level version (nothing else in the object changes), the one
// index.ts Server literal (the check-version.mjs pattern), and every README
// `#v<old>` install pin as a whole token.
export function bumpVersionFiles({ packageText, indexText, readmeText, oldVersion, newVersion }) {
  const pkg = jsonObject(packageText), old = reEscape(oldVersion);
  if (!pkg || typeof pkg.name !== "string") throw incoherent("package.json is not a JSON object with a name");
  const nextPackage = String(packageText).replace(new RegExp(`("version"\\s*:\\s*")${old}"`), `$1${newVersion}"`);
  if (!isDeepStrictEqual(jsonObject(nextPackage), { ...pkg, version: newVersion })) throw incoherent(`package.json: the first "version": "${oldVersion}" is not its top-level version`);
  const literal = new RegExp(`(name:\\s*"${reEscape(pkg.name)}",\\s*version:\\s*")${old}"`, "g");
  const hits = (String(indexText).match(literal) ?? []).length;
  if (hits !== 1) throw incoherent(`index.ts has ${hits} Server literal(s) with name "${pkg.name}" and version "${oldVersion}", expected exactly one`);
  const pin = new RegExp(`#v${old}(?!\\w|\\.\\d)`, "g");
  if ((String(readmeText).match(pin) ?? []).length === 0) throw incoherent(`README.md has no #v${oldVersion} install pin`);
  return {
    packageText: nextPackage, indexText: String(indexText).replace(literal, `$1${newVersion}"`),
    readmeText: String(readmeText).replace(pin, `#v${newVersion}`),
  };
}

const UNRELEASED = "## [Unreleased]";
// The lines under the exact `## [Unreleased]` line up to the next `## `
// heading, with blank lines trimmed at both ends; null without the heading.
function unreleasedSection(text) {
  const lines = String(text ?? "").split("\n"), at = lines.indexOf(UNRELEASED);
  if (at < 0) return null;
  const next = lines.findIndex((l, i) => i > at && l.startsWith("## ")), end = next < 0 ? lines.length : next;
  const blank = (l) => l.trim() === "";
  let [a, b] = [at + 1, end];
  while (a < b && blank(lines[a])) a++;
  while (b > a && blank(lines[b - 1])) b--;
  return { lines, at, end, body: lines.slice(a, b) };
}
export function unreleasedEntry(changelogText) {
  const s = unreleasedSection(changelogText);
  return s && s.body.length > 0 ? s.body.join("\n") : null;
}
const entryMissing = () => new ReleaseStop("CHANGELOG_ENTRY_MISSING", `CHANGELOG.md has no entry under "${UNRELEASED}" — commit the release's entry there first`);
// The [Unreleased] entry becomes `## [X.Y.Z] - <date>` directly below an
// emptied `## [Unreleased]`; the rest of the file is unchanged.
export function moveUnreleased(changelogText, version, date) {
  const s = unreleasedSection(changelogText);
  if (!s || s.body.length === 0) throw entryMissing();
  if (s.lines.some((l) => l.startsWith(`## [${version}] - `))) throw incoherent(`CHANGELOG.md already has a "## [${version}] - " heading`);
  return [...s.lines.slice(0, s.at + 1), "", `## [${version}] - ${date}`, "", ...s.body, "", ...s.lines.slice(s.end)].join("\n");
}

// The HEAD lockfile with its root version and packages[""].version set to the
// new version must equal the file npm wrote; else the first differing
// top-level key. No lockfile at HEAD (`before` null) skips the check.
export function checkLockfileParity({ before, after, oldVersion, newVersion }) {
  if (before === null || before === undefined) return null;
  const head = jsonObject(before), disk = jsonObject(after);
  if (!head) return "package-lock.json at HEAD is not a JSON object";
  if (!disk) return "package-lock.json is not a JSON object after npm install --package-lock-only";
  const want = structuredClone(head);
  want.version = newVersion;
  if (want.packages?.[""] && typeof want.packages[""] === "object") want.packages[""].version = newVersion;
  const key = [...new Set([...Object.keys(want), ...Object.keys(disk)])].find((k) => !isDeepStrictEqual(want[k], disk[k]));
  return key === undefined ? null
    : `npm install --package-lock-only (v${oldVersion} → v${newVersion}) changed package-lock.json "${key}" beyond the root version and packages[""].version`;
}

const readRepo = (ctx, rel) => { const abs = path.join(ctx.root, rel); return existsSync(abs) ? readFileSync(abs, "utf-8") : ""; };

const PRE_MARK = "not yet released";
const isTicketRow = (line, id) => line.startsWith(`| ${id} |`);
// s3(b): each named row exists once, its desc cell starts **DONE and carries
// the integrator's `not yet released` pre-mark, which s10 amends. At most one problem per id.
export function checkPreMarks({ backlogText, tickets }) {
  const lines = String(backlogText ?? "").split("\n");
  return (Array.isArray(tickets) ? tickets : []).flatMap((id) => {
    const rows = lines.filter((l) => isTicketRow(l, id));
    if (rows.length !== 1) return [`${id} has ${rows.length} ticket rows in ${BACKLOG_REL}, expected exactly one`];
    const desc = rowCells(rows[0])[1] ?? "";
    if (!desc.startsWith("**DONE")) return [`${id} row desc does not start with **DONE`];
    return desc.includes(PRE_MARK) ? [] : [`${id} row has no "${PRE_MARK}" pre-mark to amend`];
  });
}
// s10: in each named row only, every `not yet released` becomes `shipped
// vX.Y.Z`; the result must pass prepare's done-mark check over exactly those rows.
export function applyDoneMarks({ backlogText, tickets, version }) {
  const ids = Array.isArray(tickets) ? tickets : [], diffLines = [];
  const text = String(backlogText ?? "").split("\n").map((l) => {
    if (!ids.some((id) => isTicketRow(l, id))) return l;
    const amended = l.split(PRE_MARK).join(`shipped v${version}`);
    if (amended !== l) diffLines.push(`-${l}`, `+${amended}`);
    return amended;
  }).join("\n");
  const problems = checkDoneMarks({ backlogText: text, diffLines, tickets, version });
  if (problems.length > 0) throw new ReleaseStop("DONE_MARK", problems.join("; "));
  return text;
}

const ADVISORIES_REL = "docs/dependency-advisories.md";
const GHSA_RE = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i;
// The HIGH/CRITICAL findings of `npm audit --json`, one per (pkg, id). A string
// `via` entry points at another package's finding and is skipped.
export function auditFindings(stdout) {
  const report = jsonObject(stdout), vulns = report?.vulnerabilities;
  if (!report || "error" in report || !vulns || typeof vulns !== "object" || Array.isArray(vulns)) {
    throw new ReleaseStop("AUDIT_FAILED", `npm audit printed no usable report: ${String(stdout ?? "").trim().slice(0, 300) || "no output"}`);
  }
  const found = new Map();
  for (const [name, v] of Object.entries(vulns)) {
    for (const via of Array.isArray(v?.via) ? v.via : []) {
      if (!via || typeof via !== "object" || !["high", "critical"].includes(via.severity)) continue;
      const pkg = via.name ?? name, id = GHSA_RE.exec(String(via.url ?? ""))?.[0] ?? `npm-advisory-${via.source}`;
      if (!found.has(`${pkg}\0${id}`)) found.set(`${pkg}\0${id}`, { pkg, id, severity: via.severity });
    }
  }
  return [...found.values()];
}
// A finding is recorded when its id occurs as a whole token in the advisory record.
export function classifyAdvisories({ findings, recordText }) {
  const text = String(recordText ?? ""), recorded = [], undisposed = [];
  for (const f of findings) (new RegExp(`(?<![\\w-])${reEscape(f.id)}(?![\\w-])`).test(text) ? recorded : undisposed).push(f);
  return { recorded, undisposed };
}
// s3(c), s9: npm exits non-zero when it finds anything, so only the report decides.
function stepAudit(ctx, step) {
  const res = ctx.runner.read("npm", ["audit", "--audit-level=high", "--json"], { step });
  let findings;
  try { findings = auditFindings(res.stdout); } catch (e) {
    const why = lastLine(res.stderr).slice(0, 300);
    throw new ReleaseStop("AUDIT_FAILED", `npm audit --audit-level=high --json exited ${res.status} — ${e?.detail ?? e?.message ?? e}${why ? ` (stderr: ${why})` : ""}`);
  }
  const { recorded, undisposed } = classifyAdvisories({ findings, recordText: readRepo(ctx, ADVISORIES_REL) });
  for (const f of recorded) ctx.out(`release: [${step}] advisory ${f.pkg} (${f.id}) recorded in ${ADVISORIES_REL}\n`);
  if (undisposed.length > 0) throw new ReleaseStop("ADVISORY_UNDISPOSED", undisposed.map((f) => `npm audit flagged ${f.pkg} (${f.id}) with no disposition in ${ADVISORIES_REL}`).join("; "));
}

// s3: the human-owned artifacts are checked before any branch, bump or build
// work, so a missing decision stops in seconds: (a) the CHANGELOG entry, (b)
// the backlog pre-marks, (c) a disposition for every HIGH/CRITICAL advisory.
function stepHumanArtifacts(ctx) {
  if (unreleasedEntry(readRepo(ctx, "CHANGELOG.md")) === null) throw entryMissing();
  const problems = checkPreMarks({ backlogText: readRepo(ctx, BACKLOG_REL), tickets: ctx.opts.tickets });
  if (problems.length > 0) throw new ReleaseStop("DONE_MARK", `${problems.join("; ")} — pre-mark each named row "**DONE … ${PRE_MARK}" on main first`);
  stepAudit(ctx, "s3");
}
// s4: lenient pre-flight CI for the checked-out head. A non-zero exit is a
// definite red; WARN lines (gh unavailable, no completed run) continue. A
// dry-run's child polls once and never waits.
function stepPreflightCi(ctx) {
  const env = ctx.runner.dryRun ? { AGC_VERIFY_CI_WAIT_SECONDS: "0" } : undefined;
  const ci = ctx.runner.read("node", ["scripts/verify-release.mjs", "--ci-check"], { step: "s4", env });
  if (ci.status !== 0) throw new ReleaseStop("PREFLIGHT_CI_RED", `verify-release.mjs --ci-check exited ${ci.status} — ${failLines(ci)}`);
}
// s5: main is brought up to date (recorded, not run, under --dry-run), then
// the release version is derived from package.json and --bump.
function stepVersion(ctx) {
  const { runner: r, opts } = ctx;
  const fetched = r.mutate("git", ["fetch", "origin"], { step: "s5" });
  if (fetched.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, "git fetch origin", fetched, "s5"));
  pullMain(ctx, "s5");
  const pkg = jsonObject(readRepo(ctx, "package.json"));
  if (!pkg) throw incoherent("package.json is not a JSON object");
  opts.version = deriveVersion(pkg.version, opts.bump);
  ctx.oldVersion = pkg.version;
  ctx.out(`release: [s5] ${opts.bump} bump: v${pkg.version} → v${opts.version}\n`);
}
// s6: a release branch of that name, local or on origin, is never reused or deleted.
function stepReleaseBranch(ctx) {
  const r = ctx.runner, rel = `release/v${ctx.opts.version}`, ref = `refs/heads/${rel}`;
  const local = gitOut(r, ["rev-parse", "-q", "--verify", ref], "s6");
  const remote = r.read("git", ["ls-remote", "--heads", "origin", ref], { step: "s6" });
  if (remote.status !== 0) throw new ReleaseStop("INTERNAL", `git ls-remote --heads origin exited ${remote.status} — cannot tell whether origin has ${rel}`);
  const where = [local && "locally", remote.stdout.trim() && "on origin"].filter(Boolean);
  if (where.length > 0) throw new ReleaseStop("RELEASE_BRANCH_EXISTS", `${rel} exists ${where.join(" and ")} — never reuse or delete it`);
  const sw = r.mutate("git", ["switch", "-c", rel], { step: "s6" });
  if (sw.status !== 0) throw new ReleaseStop("MUTATION_FAILED", failedAt(ctx, `git switch -c ${rel}`, sw, "s6"));
}
// s7: every bump is computed before the first write, so a stop leaves no file
// half-bumped; then the lockfile is refreshed and may change only its two
// version fields. A dry-run records the writes and the install and skips parity.
function stepBumps(ctx) {
  const { runner: r, opts, oldVersion } = ctx, v = opts.version, step = "s7";
  const files = bumpVersionFiles({ packageText: readRepo(ctx, "package.json"), indexText: readRepo(ctx, "index.ts"), readmeText: readRepo(ctx, "README.md"), oldVersion, newVersion: v });
  const changelog = moveUnreleased(readRepo(ctx, "CHANGELOG.md"), v, ctx.now().toISOString().slice(0, 10));
  for (const [rel, text] of [["package.json", files.packageText], ["index.ts", files.indexText], ["README.md", files.readmeText], ["CHANGELOG.md", changelog]]) r.writeFile(rel, text, { step });
  const install = r.mutate("npm", ["install", "--package-lock-only"], { step });
  if (install.status !== 0) throw new ReleaseStop("MUTATION_FAILED", `npm install --package-lock-only exited ${install.status} — ${lastLine(install.stderr) || "no output"}`);
  const head = r.deferred("git", ["show", "HEAD:package-lock.json"], { step });
  if (head === null || head.status !== 0) return;
  const drift = checkLockfileParity({ before: head.stdout, after: readRepo(ctx, "package-lock.json"), oldVersion, newVersion: v });
  if (drift) throw new ReleaseStop("LOCKFILE_DRIFT", drift);
}

// ---- Start (s8-s11): build, test, done-mark, commit message ----

// The first output line matching `re`, else the last line of stderr or stdout.
const firstMatch = (res, re) => (`${res.stdout}\n${res.stderr}`.split("\n").map((l) => l.trim()).find((l) => re.test(l))
  ?? (lastLine(res.stderr) || lastLine(res.stdout) || "no output")).slice(0, 500);
// s8: SOP step 8 without npm run build, whose prebuild check needs the dist it
// makes. All three are deferred: they observe the bumps, which a dry-run never made.
function stepBuild(ctx) {
  for (const [cmd, args, id] of [["npx", ["tsc"], "BUILD_FAILED"], ["node", ["scripts/check-version.mjs"], "VERSION_INCOHERENT"],
    ["node", ["scripts/check-transitions-sync.mjs"], "BUILD_FAILED"]]) {
    const res = ctx.runner.deferred(cmd, args, { step: "s8" });
    if (res && res.status !== 0) throw new ReleaseStop(id, `${cmd} ${show(args)} exited ${res.status} — ${firstMatch(res, /error TS\d+/)}`);
  }
}
// s9: the suite (deferred, as it observes the bumps), then the audit again with s3's rule.
function stepTest(ctx) {
  const res = ctx.runner.deferred("npm", ["test"], { step: "s9" });
  if (res && res.status !== 0) {
    const lines = res.stdout.split("\n").map((l) => l.trim());
    const why = [lines.find((l) => /^(#|ℹ) fail \d+$/.test(l)), lines.find((l) => l.startsWith("not ok "))].filter(Boolean).join("; ");
    throw new ReleaseStop("TEST_FAILED", `npm test exited ${res.status} — ${why || lastLine(res.stderr) || lastLine(res.stdout) || "no output"}`);
  }
  stepAudit(ctx, "s9");
}
// s10: the done-mark amends only the named pre-marked rows; --tickets none writes nothing.
function stepDoneMark(ctx) {
  const { opts } = ctx;
  if (!Array.isArray(opts.tickets)) return;
  const text = applyDoneMarks({ backlogText: readRepo(ctx, BACKLOG_REL), tickets: opts.tickets, version: opts.version });
  ctx.runner.writeFile(BACKLOG_REL, text, { step: "s10" });
}
// <summary> is the active feature, followed by the ticket ids when there are
// any; the same text later titles the tag and the GitHub release. No trailer.
export function commitMessage({ version, oldVersion, bump, activeFeature, tickets }) {
  const ids = Array.isArray(tickets) && tickets.length > 0 ? tickets.join(", ") : null;
  return [`chore(release): v${version} — ${activeFeature}${ids ? ` (${ids})` : ""}`, "",
    `Release gate: ${activeFeature} (qa-engineer PASS committed to main).`, `Tickets: ${ids ?? "none"}.`, `Bump: ${bump} from v${oldVersion}.`, ""].join("\n");
}
// s11: the message file prepare reads, then the version file, start's last write.
function stepMessage(ctx) {
  const { opts } = ctx, v = opts.version;
  writeWorkFile(ctx, "s11", "message.txt", commitMessage({ version: v, oldVersion: ctx.oldVersion, bump: opts.bump, activeFeature: ctx.state.active_feature, tickets: opts.tickets }));
  writeWorkFile(ctx, "s11", "version", `${v}\n`);
  ctx.okSuffix = ` — release/v${v} bumped, built and tested`;
}

// ---- Record (pre-3, r14-1..r15): closing write and its read-back ----

// The closing write's fields, compared with a tw_get_state read view field by
// field; null when all four match, else one `<field>: wrote <a>, read <b>` per difference.
export function readBackMismatch({ wrote, read }) {
  const want = { last_agent: wrote?.agent_id, status: wrote?.status, next_role: wrote?.next_role, pending_notes: wrote?.pending_notes };
  const diffs = Object.entries(want).filter(([k, v]) => !isDeepStrictEqual(v ?? null, read?.[k] ?? null))
    .map(([k, v]) => `${k}: wrote ${JSON.stringify(v ?? null)}, read ${JSON.stringify(read?.[k] ?? null)}`);
  return diffs.length > 0 ? diffs.join("; ") : null;
}
// pre-3: on main, where publish left the checkout.
function preRecord(ctx) {
  requireBranch(ctx, (b) => b === "main", "main");
}
// r14-1: the merge sha is the commit publish tagged, so record needs no hand-off.
// A dry-run before publish has no tag yet and carries a placeholder.
function stepMergeSha(ctx) {
  const { runner: r, opts } = ctx, tag = `v${opts.version}`;
  const sha = gitOut(r, ["rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`], "r14-1") || null;
  if (sha === null && !r.dryRun) throw usage(`record runs after publish: ${tag} has no tag`);
  ctx.mergeSha = sha ?? "<merge-commit>";
  ctx.out(`release: [r14-1] ${tag} is at ${ctx.mergeSha}\n`);
}
// r14: the closing write (SOP step 14), the feature-lease terminal marker; get
// comes first in this process, and active_feature is carried over from it.
async function stepClosingWrite(ctx) {
  const { root, opts } = ctx, seen = await stateCall(ctx, "get", { workspace_path: root }, "r14");
  const feature = seen === null ? "<unchanged>" : seen.active_feature;
  if (typeof feature !== "string" || feature === "") throw new ReleaseStop("STATE_WRITE_REJECTED", "tw_get_state returned no active_feature to carry into the closing write");
  ctx.closing = {
    workspace_path: root, agent_id: "release-engineer", status: "In_Progress", active_feature: feature,
    completed_tasks: [], next_role: "pm", pending_notes: [`Released v${opts.version}`, `tag: ${ctx.mergeSha}`],
  };
  await stateCall(ctx, "update", ctx.closing, "r14");
}
// r15: the read-back (SOP step 15); close-out runs only after a match.
async function stepReadBack(ctx) {
  const read = await stateCall(ctx, "get", { workspace_path: ctx.root }, "r15");
  if (read === null) return;
  const why = readBackMismatch({ wrote: ctx.closing, read });
  if (why) throw new ReleaseStop("READBACK_MISMATCH", `${why} — the closing write did not land as written; do not run close-out`);
  ctx.okSuffix = " — read-back matches the closing write";
}

// `prepare` stays the first key: tests read its step list from this literal's source.
const PHASES = {
  prepare: [preInputs, preGh, prePrepare, step7a, step7b, step7c, step7d, step8aStage, step8aCitations, step8aSpecs, step8aCommitPushPr],
  publish: [preGh, prePublish, stepPublish],
  "close-out": [preGh, preCloseOut, stepCloseOut],
  start: [preWorkDir, preGh, preStart, stepPrecondition, stepOpeningWrite, stepHumanArtifacts, stepPreflightCi, stepVersion, stepReleaseBranch,
    stepBumps, stepBuild, stepTest, stepDoneMark, stepMessage],
  record: [preRecord, stepMergeSha, stepClosingWrite, stepReadBack],
};

export async function main(argv, deps = {}) {
  const [out, err] = [deps.out ?? writer(process.stdout), deps.err ?? writer(process.stderr)];
  try {
    const opts = parseArgs(argv);
    if (opts.phase === "help") { out(USAGE_TEXT); return 0; }
    const root = deps.root ?? ROOT, ctx = { opts, root, deps, out, err, now: deps.now ?? (() => new Date()) };
    ctx.runner = createRunner({ root, dryRun: opts.dryRun, spawn: deps.spawn, env: deps.env ?? process.env, out, err });
    for (const step of PHASES[opts.phase]) await step(ctx);
    const v = `v${opts.version}`;
    out(opts.dryRun ? `release: ${opts.phase} DRY-RUN OK (${v}) — nothing changed\n` : `release: ${opts.phase} OK (${v})${ctx.okSuffix ?? ""}\n`);
    return 0;
  } catch (e) {
    const stop = e instanceof ReleaseStop ? e : new ReleaseStop("INTERNAL", e?.stack?.split("\n")[0] ?? String(e));
    if (stop.classId === "USAGE") err(USAGE_TEXT);
    const line = `RELEASE_STOP ${stop.classId}: ${stop.detail}\n`, stopFile = (deps.env ?? process.env).AGC_RELEASE_STOP_FILE;
    // The workflow reads the stop line from this file; a failed write never masks the stop.
    if (stopFile) { try { writeFileSync(stopFile, line); } catch { /* the stderr line below still carries it */ } }
    err(line);
    return stop.code;
  }
}

// Run as a CLI when this file is the entry point, however it was reached: real
// paths are compared, so a symlinked directory in argv[1] still matches.
const realOrNull = (p) => { try { return realpathSync(p); } catch { return null; } };
const isEntry = () => {
  const self = realOrNull(fileURLToPath(import.meta.url));
  return Boolean(process.argv[1]) && self !== null && realOrNull(process.argv[1]) === self;
};
if (isEntry()) process.exit(await main(process.argv.slice(2)));
