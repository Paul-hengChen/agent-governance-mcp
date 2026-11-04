// Coded by @qa-engineer
// T-E405-09: runner-path tests for scripts/release.mjs `start` and `record` plus the E401 dry-run CI gate
// (specs/e405-release-cd.md AC-R1..R9, R11, R13, R14, E1; specs/e405-release-cd-architecture.md *Test seams*).
//
// WHY: these two phases run on GitHub Actions with no agent watching. Each stop class, each ordering rule
// (nothing written before the PASS tuple is checked; the opening write lands before the first git mutation;
// close-out only after a read-back match) and the dry-run guarantee (nothing changes, no state write) is a
// contract the workflow depends on, so each is pinned here against the real script.
//
// Harness: real git in a throwaway repo under os.tmpdir() with a local bare `origin`. `spawn` is injected: gh,
// npm, npx and the absorbed node scripts are canned per argv (no network, no real GitHub API, no real npm);
// git runs for real. The orchestrator is a recording fake, except the single O1 test, which drives the real
// compiled dist/tools/handoff-orchestrator.js in a scratch workspace.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO, "scripts", "release.mjs");
const rel = await import(pathToFileURL(SCRIPT).href);
const parseMod = await import(pathToFileURL(path.join(REPO, "dist", "tools", "handoff-parse.js")).href);

const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

const sha = (s) => createHash("sha256").update(s).digest("hex");
const lastLine = (s) => String(s).trim().split("\n").filter(Boolean).pop() ?? "";
const G = (cwd, ...a) => {
  const r = spawnSync("git", a, { cwd, encoding: "utf-8", env: GIT_ENV });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const GIT_ENV = {
  ...process.env, GIT_AUTHOR_NAME: "QA Fixture", GIT_AUTHOR_EMAIL: "qa@example.com", GIT_COMMITTER_NAME: "QA Fixture", GIT_COMMITTER_EMAIL: "qa@example.com",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull, GIT_TERMINAL_PROMPT: "0",
};

// ---------------------------------------------------------------- fixture

const PASS_HANDOFF = '---\nschema_version: 15\nactive_feature: "feat"\nstatus: "PASS"\nlast_updated: "2026-11-04T00:00:07.123Z"\nlast_agent: "qa-engineer"\n---\n# Handoff State\n\n## Pending & Handoff Notes\n- qa-engineer: PASS\n';
const CHANGELOG = "# Changelog\n\n## [Unreleased]\n\n### Added\n- feat (E7)\n\n## [1.2.3] - 2026-10-01\n\n- older\n";
const BACKLOG = "# Backlog\n\n| id | desc |\n|---|---|\n| E7 | **DONE** feature seven, not yet released |\n| E8 | open thing, not yet released |\n| E9 | **DONE** done and shipped v1.0.0 |\n";
const GHSA = "GHSA-aaaa-bbbb-cccc";
const AUDIT_HIGH = JSON.stringify({ vulnerabilities: { foo: { via: [{ name: "foo", severity: "high", url: `github.com/advisories/${GHSA}`, source: 1 }, "bar"] } } });
const AUDIT_NONE = JSON.stringify({ vulnerabilities: {} });
const CI = {
  passed: { status: 0, stdout: "check:release — CI-CHECK PASSED (0123456789ab)\n", stderr: "" },
  warn: { status: 0, stdout: "WARN: CI ground-truth — no completed CI runs found on main; continuing\ncheck:release — CI-CHECK PASSED (0123456789ab)\n", stderr: "" },
  pending: { status: 1, stdout: "", stderr: "FAIL: CI ground-truth — no completed CI run for 0123456789ab found on any branch within the 0s poll budget (gh run list --commit) — cannot verify this commit\n" },
  red: { status: 1, stdout: "", stderr: "FAIL: CI ground-truth — latest completed CI run for 0123456789ab (branch main) concluded \"failure\" — no url\n" },
  unverified: { status: 1, stdout: "", stderr: "FAIL: CI ground-truth — gh run list failed — refusing to proceed under the strict pre-tag gate\n" },
};

const templates = new Map();
function buildTemplate() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e405-rn-tpl-")));
  cleanup.push(base);
  const origin = path.join(base, "origin.git"), root = path.join(base, "repo");
  spawnSync("git", ["init", "-q", "--bare", "-b", "main", origin], { env: GIT_ENV });
  fs.mkdirSync(root);
  const put = (p, t) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), t); };
  put("package.json", JSON.stringify({ name: "fx", version: "1.2.3", dependencies: { x: "^1.0.0" } }, null, 2) + "\n");
  put("package-lock.json", JSON.stringify({ name: "fx", version: "1.2.3", lockfileVersion: 3, packages: { "": { name: "fx", version: "1.2.3" }, "node_modules/x": { version: "1.0.0" } } }, null, 2) + "\n");
  put("index.ts", 'const server = new Server({\n  name: "fx",\n  version: "1.2.3",\n});\n');
  put("README.md", "Install: npx github:o/r#v1.2.3\n");
  put("CHANGELOG.md", CHANGELOG);
  put("docs/backlog.md", BACKLOG);
  put("docs/dependency-advisories.md", `# Advisories\n\n| id | row |\n|---|---|\n| ${GHSA} | foo, accepted, re-review at next major |\n`);
  put("CLAUDE.md", "<!-- agc-version: 1.2.3 -->\n"); put("AGENTS.md", "# agc-version: 1.2.3\n"); put(".antigravityrules", "# agc-version: 1.2.3\n");
  put(".current/_primary/handoff.md", PASS_HANDOFF);
  put(".current/_primary/events.jsonl", "{\"n\":1}\n");
  put("tasks.md", "# Tasks\n- [x] T-E7-01\n");
  put("qa_reports/archive/old/review_T-OLD-01.md", "old\n"); // the membership baseline prepare's step 7a diffs against
  G(root, "init", "-q", "-b", "main"); G(root, "config", "commit.gpgsign", "false"); G(root, "config", "tag.gpgsign", "false");
  G(root, "add", "-A"); G(root, "commit", "-q", "-m", "init"); G(root, "tag", "-a", "v1.2.3", "-m", "v1.2.3");
  // The feature's spec and review land after the previous tag, so they are in prepare's release range.
  put("specs/feat.md", "# feat\n");
  put("qa_reports/review_T-E7-01.md", "review\n");
  G(root, "add", "-A"); G(root, "commit", "-q", "-m", "feat evidence");
  G(root, "remote", "add", "origin", origin); G(root, "push", "-q", "-u", "origin", "main", "v1.2.3");
  return base;
}
function mkFixture() {
  if (!templates.has("t")) templates.set("t", buildTemplate());
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e405-rn-")));
  cleanup.push(base);
  fs.cpSync(templates.get("t"), base, { recursive: true });
  const fx = { base, root: path.join(base, "repo"), origin: path.join(base, "origin.git"), work: path.join(base, "work"), stopFile: path.join(base, "stop-line.txt"),
    ghLog: [], ghPrs: {}, calls: [], events: [], cfg: {}, sleeps: 0 };
  G(fx.root, "remote", "set-url", "origin", fx.origin);
  fx.put = (p, t) => { fs.mkdirSync(path.dirname(path.join(fx.root, p)), { recursive: true }); fs.writeFileSync(path.join(fx.root, p), t); };
  fx.read = (p) => fs.readFileSync(path.join(fx.root, p), "utf-8");
  return fx;
}

// gh, npm, npx and the node scripts are canned; git is real. Every call is recorded with its env.
function mkSpawn(fx) {
  return (bin, argv, opts) => {
    const isNode = bin === process.execPath, name = isNode ? path.basename(argv[0]) : null;
    fx.calls.push({ bin: isNode ? "node" : bin, args: isNode ? [path.relative(fx.root, argv[0]), ...argv.slice(1)] : [...argv], env: opts.env, cwd: opts.cwd });
    fx.events.push({ kind: "spawn", index: fx.calls.length - 1 });
    const cfg = fx.cfg, res = (o) => ({ status: 0, stdout: "", stderr: "", ...o });
    if (bin === "gh") {
      const k = argv.slice(0, 2).join(" ");
      if (k === "auth status") return cfg.authFail ? res({ status: 1, stderr: "not logged in" }) : res({});
      if (k === "pr view") { const pr = fx.ghPrs[argv[2]]; return pr ? res({ stdout: JSON.stringify(pr) }) : res({ status: 1, stderr: "no pull requests found" }); }
      if (k === "release view") return res({ status: 1, stderr: "release not found" });
      fx.ghLog.push(argv.join(" "));
      return res({ stdout: "pr-or-release-url\n" });
    }
    if (bin === "npm" || bin === "npx") {
      const key = `${bin} ${argv.join(" ")}`;
      if (key === "npm audit --audit-level=high --json") { const n = (fx.auditCalls = (fx.auditCalls ?? 0) + 1); const a = typeof cfg.audit === "function" ? cfg.audit(n) : cfg.audit; return res(a ?? { stdout: AUDIT_NONE }); }
      if (key === "npm install --package-lock-only") {
        const pkg = JSON.parse(fs.readFileSync(path.join(opts.cwd, "package.json"), "utf-8"));
        const lock = JSON.parse(fs.readFileSync(path.join(opts.cwd, "package-lock.json"), "utf-8"));
        lock.version = pkg.version; lock.packages[""].version = pkg.version;
        if (cfg.lockDrift) lock.packages["node_modules/x"].version = "9.9.9";
        fs.writeFileSync(path.join(opts.cwd, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
        return res({});
      }
      if (key === "npx tsc") return res(cfg.tsc ?? { stdout: "" });
      if (key === "npm test") return res(cfg.test ?? { stdout: "# pass 9\n# fail 0\n" });
      return res({ status: 99, stderr: `unexpected ${key}` });
    }
    if (isNode) {
      if (name === "verify-release.mjs") {
        if (argv.includes("--strict")) return res(cfg.ciStrict ?? CI.passed);
        if (argv.includes("--ci-check")) return res(cfg.ci ?? CI.passed);
        return res({ stdout: "OK\n" });
      }
      if (name === "check-version.mjs") return res(cfg.checkVersion ?? { stdout: "ok\n" });
      if (name === "check-transitions-sync.mjs") return res(cfg.transitions ?? { stdout: "ok\n" });
      return res({ stdout: "OK\n" });
    }
    return spawnSync(bin, argv, opts);
  };
}

// A recording stand-in for dist/tools/handoff-orchestrator.js. `mode` picks the server's behaviour.
function mkOrch(fx, mode = "accept", initial = { active_feature: "feat", last_agent: "release-engineer", status: "In_Progress" }) {
  const o = { imports: 0, calls: [], last: initial };
  o.load = async () => {
    o.imports++; fx.events.push({ kind: "orch-load" });
    if (mode === "load-fail") throw new Error("Cannot find module");
    return {
      handleGetState: async (a) => { o.calls.push(["get", a]); fx.events.push({ kind: "orch", op: "get" }); return { content: [{ type: "text", text: JSON.stringify(o.last) }] }; },
      handleUpdateState: async (a) => {
        o.calls.push(["update", a]); fx.events.push({ kind: "orch", op: "update" });
        if (mode === "reject") return { isError: true, content: [{ type: "text", text: "FEATURE_LEASE_HELD: another feature holds the lease\nmore detail" }] };
        if (mode === "throw") throw new Error("boom");
        const next = { active_feature: a.active_feature, last_agent: a.agent_id, status: a.status, next_role: a.next_role, pending_notes: a.pending_notes };
        if (mode === "mismatch-status") next.status = "Blocked";
        if (mode === "mismatch-next_role") next.next_role = "architect";
        if (mode === "mismatch-last_agent") next.last_agent = "pm";
        if (mode === "mismatch-pending_notes") next.pending_notes = a.pending_notes.slice(0, 1);
        o.last = next;
        return { content: [{ type: "text", text: "State updated" }] };
      },
    };
  };
  return o;
}

async function run(fx, argv, { orch = mkOrch(fx), env = {}, noStopFile = false } = {}) {
  const out = [], err = [];
  const code = await rel.main(argv, {
    root: fx.root, spawn: mkSpawn(fx), out: (s) => out.push(s), err: (s) => err.push(s), sleep: async () => { fx.sleeps++; },
    env: { ...process.env, ...(noStopFile ? {} : { AGC_RELEASE_STOP_FILE: fx.stopFile }), AGC_VERIFY_CI_WAIT_SECONDS: "900", AGC_RELEASE_MERGE_WAIT_SECONDS: "0", ...env },
    importLanePaths: async () => ({ resolveCurrentLane: () => "_primary" }), importHandoffParse: async () => parseMod,
    importOrchestrator: orch.load, now: () => new Date("2026-11-04T08:00:00Z"),
  });
  return { code, out: out.join(""), err: err.join(""), orch, stop: fs.existsSync(fx.stopFile) ? fs.readFileSync(fx.stopFile, "utf-8") : null,
    cmds: fx.calls.map((c) => `${c.bin} ${c.args.join(" ")}`) };
}
const startArgs = (fx, o = {}) => ["start", "--bump", o.bump ?? "patch", "--tickets", o.tickets ?? "E7", "--work-dir", fx.work, ...(o.dry ? ["--dry-run"] : [])];
const stopOf = (r) => lastLine(r.err);
const code = (id) => rel.EXIT_CLASSES.find((c) => c.id === id).code;

function snapshot(fx) {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === ".git") continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push([path.relative(fx.root, p), sha(fs.readFileSync(p))]); } };
  walk(fx.root);
  return {
    status: G(fx.root, "status", "--porcelain=v1", "-uall"), index: G(fx.root, "ls-files", "-s"), refs: G(fx.root, "for-each-ref"),
    originRefs: G(fx.origin, "for-each-ref"), branch: G(fx.root, "rev-parse", "--abbrev-ref", "HEAD"), head: G(fx.root, "rev-parse", "HEAD"),
    files: JSON.stringify(files.sort()), gh: JSON.stringify(fx.ghLog),
  };
}
const MUTATING_GIT = new Set(["add", "commit", "tag", "push", "switch", "branch", "pull", "fetch"]);
const isMutatingCall = (c) => (c.bin === "git" && MUTATING_GIT.has(c.args[0] === "-c" ? c.args[2] : c.args[0]))
  || (c.bin === "gh" && ["pr create", "pr merge", "release create"].includes(c.args.slice(0, 2).join(" ")))
  || (c.bin === "npm" && c.args[0] === "install");

// ---------------------------------------------------------------- pure helpers

test("AC-R4 deriveVersion: patch, minor and major from main's version; a non x.y.z version stops", () => {
  assert.equal(rel.deriveVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(rel.deriveVersion("1.2.9", "patch"), "1.2.10", "no digit-wise carry");
  assert.equal(rel.deriveVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(rel.deriveVersion("1.9.9", "minor"), "1.10.0");
  assert.equal(rel.deriveVersion("1.2.3", "major"), "2.0.0", "major is the explicit opt-in");
  for (const bad of ["1.2", "v1.2.3", "1.2.3-rc.1", "", undefined]) assert.throws(() => rel.deriveVersion(bad, "patch"), (e) => e.classId === "VERSION_INCOHERENT", String(bad));
});

test("AC-R5 pure bump helpers: CHANGELOG move, version targets found exactly once, lockfile parity", () => {
  const moved = rel.moveUnreleased(CHANGELOG, "1.2.4", "2026-11-04");
  assert.equal(moved, "# Changelog\n\n## [Unreleased]\n\n## [1.2.4] - 2026-11-04\n\n### Added\n- feat (E7)\n\n## [1.2.3] - 2026-10-01\n\n- older\n");
  assert.equal(rel.unreleasedEntry(CHANGELOG), "### Added\n- feat (E7)");
  for (const empty of ["# C\n\n## [Unreleased]\n\n## [1.2.3] - x\n", "# C\n\n## [Unreleased]\n   \n", "# C\n\n## [1.2.3] - x\n"]) {
    assert.equal(rel.unreleasedEntry(empty), null);
    assert.throws(() => rel.moveUnreleased(empty, "1.2.4", "2026-11-04"), (e) => e.classId === "CHANGELOG_ENTRY_MISSING");
  }
  assert.throws(() => rel.moveUnreleased(`${CHANGELOG}\n## [1.2.4] - 2026-01-01\n`, "1.2.4", "2026-11-04"), (e) => e.classId === "VERSION_INCOHERENT", "a heading already present");
  const base = { packageText: '{\n  "name": "fx",\n  "version": "1.2.3"\n}\n', indexText: 'new Server({ name: "fx", version: "1.2.3" }, {})', readmeText: "#v1.2.3 and #v1.2.30 and #v1.2.3.1\n", oldVersion: "1.2.3", newVersion: "1.2.4" };
  const out = rel.bumpVersionFiles(base);
  assert.match(out.packageText, /"version": "1\.2\.4"/);
  assert.match(out.indexText, /version: "1\.2\.4"/);
  assert.equal(out.readmeText, "#v1.2.4 and #v1.2.30 and #v1.2.3.1\n", "only the whole-token pin moves");
  assert.throws(() => rel.bumpVersionFiles({ ...base, indexText: "nothing" }), (e) => e.classId === "VERSION_INCOHERENT");
  assert.throws(() => rel.bumpVersionFiles({ ...base, readmeText: "no pin" }), (e) => e.classId === "VERSION_INCOHERENT");
  const lock = (v, extra = {}) => JSON.stringify({ name: "fx", version: v, packages: { "": { name: "fx", version: v }, "node_modules/x": { version: "1.0.0", ...extra } } });
  assert.equal(rel.checkLockfileParity({ before: lock("1.2.3"), after: lock("1.2.4"), oldVersion: "1.2.3", newVersion: "1.2.4" }), null);
  assert.match(rel.checkLockfileParity({ before: lock("1.2.3"), after: lock("1.2.4", { dev: true }), oldVersion: "1.2.3", newVersion: "1.2.4" }), /"packages"/);
  assert.equal(rel.checkLockfileParity({ before: null, after: lock("1.2.4"), oldVersion: "1.2.3", newVersion: "1.2.4" }), null, "no lockfile at HEAD skips the check");
});

test("AC-R6 pure advisory and AC-R7 pure done-mark helpers", () => {
  const f = rel.auditFindings(AUDIT_HIGH);
  assert.deepEqual(f, [{ pkg: "foo", id: GHSA, severity: "high" }], "string via skipped, one finding per (pkg, id)");
  assert.deepEqual(rel.auditFindings(JSON.stringify({ vulnerabilities: { a: { via: [{ name: "a", severity: "moderate", source: 5 }] } } })), []);
  assert.deepEqual(rel.auditFindings(JSON.stringify({ vulnerabilities: { a: { via: [{ name: "a", severity: "critical", source: 7 }] } } })).map((x) => x.id), ["npm-advisory-7"]);
  for (const bad of ["", "not json", "[]", JSON.stringify({ error: { code: "E" } }), JSON.stringify({ metadata: {} })]) assert.throws(() => rel.auditFindings(bad), (e) => e.classId === "AUDIT_FAILED", bad);
  assert.deepEqual(rel.classifyAdvisories({ findings: f, recordText: `| ${GHSA} | x |` }), { recorded: f, undisposed: [] });
  assert.deepEqual(rel.classifyAdvisories({ findings: f, recordText: `| ${GHSA}-extra | x |` }).undisposed, f, "a longer id is not a match");
  assert.deepEqual(rel.checkPreMarks({ backlogText: BACKLOG, tickets: ["E7"] }), []);
  assert.equal(rel.checkPreMarks({ backlogText: BACKLOG, tickets: ["E8"] }).length, 1, "E8 is not **DONE");
  assert.equal(rel.checkPreMarks({ backlogText: BACKLOG, tickets: ["E9"] }).length, 1, "E9 has no pre-mark");
  assert.equal(rel.checkPreMarks({ backlogText: BACKLOG, tickets: ["E1"] }).length, 1, "E1 has no row");
  assert.deepEqual(rel.checkPreMarks({ backlogText: BACKLOG, tickets: undefined }), []);
  const next = rel.applyDoneMarks({ backlogText: BACKLOG, tickets: ["E7"], version: "1.2.4" });
  assert.equal(next, BACKLOG.replace("| E7 | **DONE** feature seven, not yet released |", "| E7 | **DONE** feature seven, shipped v1.2.4 |"));
});

test("AC-R8 commitMessage: derived summary (OQ2), body lines, no trailer", () => {
  const m = (tickets) => rel.commitMessage({ version: "1.2.4", oldVersion: "1.2.3", bump: "patch", activeFeature: "feat", tickets });
  assert.equal(m(["E7", "E6"]).split("\n")[0], "chore(release): v1.2.4 — feat (E7, E6)");
  assert.equal(m(undefined).split("\n")[0], "chore(release): v1.2.4 — feat");
  assert.equal(m("none").split("\n")[0], "chore(release): v1.2.4 — feat");
  assert.ok(!/Co-Authored-By|Generated with/i.test(m(["E7"])), "no attribution trailer");
  assert.match(m(["E7"]), /Release gate: feat \(qa-engineer PASS committed to main\)\.\nTickets: E7\.\nBump: patch from v1\.2\.3\./);
});

test("AC-E1 classifyCiState and AC-R9 readBackMismatch: the verdict tables", () => {
  assert.equal(rel.classifyCiState(CI.passed), "passed");
  assert.equal(rel.classifyCiState(CI.pending), "pending");
  assert.equal(rel.classifyCiState(CI.red), "red");
  assert.equal(rel.classifyCiState(CI.unverified), "unverified");
  assert.equal(rel.classifyCiState({ status: 0, stdout: "all fine\n", stderr: "" }), "unverified", "a silent exit 0 is not passed");
  assert.equal(rel.classifyCiState({}), "unverified");
  // The two FAIL phrasings classifyCiState keys on must still be what verify-release.mjs prints.
  const src = fs.readFileSync(path.join(REPO, "scripts", "verify-release.mjs"), "utf-8");
  assert.ok(src.includes('concluded "${conclusion}"') && src.includes("no completed CI run for "), "verify-release.mjs still prints the phrasings the dry-run gate classifies");
  const wrote = { agent_id: "release-engineer", status: "In_Progress", next_role: "pm", pending_notes: ["Released v1.2.4", "tag: abc"] };
  const read = { last_agent: "release-engineer", status: "In_Progress", next_role: "pm", pending_notes: ["Released v1.2.4", "tag: abc"], extra: 1 };
  assert.equal(rel.readBackMismatch({ wrote, read }), null);
  for (const [k, v] of [["last_agent", "pm"], ["status", "Blocked"], ["next_role", "architect"], ["pending_notes", ["Released v1.2.4"]]]) {
    assert.match(rel.readBackMismatch({ wrote, read: { ...read, [k]: v } }), new RegExp(`^${k}: wrote .*, read `), k);
  }
});

// ---------------------------------------------------------------- AC-R1

test("AC-R1 the main handoff must be (qa-engineer, PASS) before anything is written", async () => {
  const absent = [
    ["not PASS", '---\nschema_version: 15\nactive_feature: "feat"\nstatus: "In_Progress"\nlast_updated: "2026-11-04T00:00:00.000Z"\nlast_agent: "release-engineer"\n---\n# H\n'],
    ["wrong agent", PASS_HANDOFF.replace('last_agent: "qa-engineer"', 'last_agent: "sr-engineer"')],
    ["no active_feature", PASS_HANDOFF.replace('active_feature: "feat"\n', "")],
    ["unsafe active_feature", PASS_HANDOFF.replace('active_feature: "feat"', 'active_feature: "../x"')],
  ];
  for (const [why, text] of absent) {
    const fx = mkFixture();
    fx.put(".current/_primary/handoff.md", text);
    G(fx.root, "add", "-A"); G(fx.root, "commit", "-q", "-m", "state"); G(fx.root, "push", "-q", "origin", "main");
    const before = snapshot(fx), orch = mkOrch(fx);
    const r = await run(fx, startArgs(fx), { orch });
    assert.equal(r.code, code("PRECONDITION_NOT_PASS"), `${why}: ${stopOf(r)}`);
    assert.match(stopOf(r), /^RELEASE_STOP PRECONDITION_NOT_PASS: .+/);
    assert.deepEqual(snapshot(fx), before, `${why}: no file write, git mutation or ref change`);
    assert.equal(orch.imports, 0, `${why}: no state write`);
    assert.ok(!fs.existsSync(path.join(fx.work, "state.md")) && !fs.existsSync(path.join(fx.work, "message.txt")), `${why}: nothing written to the work dir`);
    assert.ok(!fx.calls.some(isMutatingCall), `${why}: no mutating child call`);
  }
  // A missing handoff file and an unparsable one stop the same way.
  for (const mutate of [(fx) => fs.rmSync(path.join(fx.root, ".current/_primary/handoff.md")), (fx) => fx.put(".current/_primary/handoff.md", "\u0000\u0001 not a handoff")]) {
    const fx = mkFixture();
    mutate(fx);
    const r = await run(fx, startArgs(fx));
    assert.equal(r.code, code("PRECONDITION_NOT_PASS"), stopOf(r));
  }
  // The tuple names itself in the detail.
  const fx = mkFixture();
  fx.put(".current/_primary/handoff.md", PASS_HANDOFF.replace('status: "PASS"', 'status: "Blocked"'));
  assert.match(stopOf(await run(fx, startArgs(fx))), /\(qa-engineer, Blocked\)/);
});

test("AC-R1 given PASS the handoff is copied byte for byte outside the root before the opening write and handed to prepare as --state", async () => {
  const fx = mkFixture();
  const r = await run(fx, startArgs(fx, { dry: true }));
  assert.equal(r.code, 0, r.err);
  const copy = path.join(fx.work, "state.md");
  assert.ok(path.relative(fx.root, copy).startsWith(".."), "outside the repository root");
  assert.deepEqual(fs.readFileSync(copy), fs.readFileSync(path.join(fx.root, ".current/_primary/handoff.md")), "byte for byte");
  const wrote = r.out.indexOf("[s1] wrote"), opening = r.out.indexOf("[s2] tw_get_state");
  assert.ok(wrote >= 0 && opening > wrote, "state.md is written before the opening write");
  // A work dir inside the repository is refused, and is never created.
  const bad = await run(fx, ["start", "--bump", "patch", "--tickets", "E7", "--work-dir", path.join(fx.root, "inside")]);
  assert.equal(bad.code, 2);
});

// ---------------------------------------------------------------- AC-R2

test("AC-R2 opening write through the compiled server, before any git mutation", async () => {
  const fx = mkFixture(), orch = mkOrch(fx);
  const r = await run(fx, startArgs(fx), { orch });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(orch.calls.map(([op]) => op), ["get", "update"], "get first, for the pre-flight guard and freshness snapshot");
  assert.deepEqual(orch.calls[0][1], { workspace_path: fx.root });
  assert.deepEqual(orch.calls[1][1], {
    workspace_path: fx.root, agent_id: "release-engineer", status: "In_Progress", active_feature: "feat", completed_tasks: [],
    pending_notes: ["release-engineer: starting release for feat"],
  }, "active_feature unchanged, the SOP step-2 note, no next_role");
  const update = fx.events.findIndex((e) => e.kind === "orch" && e.op === "update");
  const firstMutation = fx.events.findIndex((e) => e.kind === "spawn" && isMutatingCall(fx.calls[e.index]));
  assert.ok(update >= 0 && firstMutation > update, "the opening write lands before the first git mutation (fetch at s5)");
  assert.equal(fx.calls[fx.events[firstMutation].index].args.join(" "), "fetch origin");
});

test("AC-R2 a rejected or throwing opening write stops STATE_WRITE_REJECTED with the server's code; a dry run makes no update call", async () => {
  for (const [mode, re] of [
    ["reject", /^RELEASE_STOP STATE_WRITE_REJECTED: FEATURE_LEASE_HELD: another feature holds the lease$/],
    ["throw", /^RELEASE_STOP STATE_WRITE_REJECTED: tw_update_state threw — boom$/],
    ["load-fail", /^RELEASE_STOP STATE_WRITE_REJECTED: cannot load dist\/tools\/handoff-orchestrator\.js \(run npm run build\) — Cannot find module$/],
  ]) {
    const fx = mkFixture(), before = snapshot(fx);
    const r = await run(fx, startArgs(fx), { orch: mkOrch(fx, mode) });
    assert.equal(r.code, code("STATE_WRITE_REJECTED"), mode);
    assert.match(stopOf(r), re, mode);
    assert.ok(!fx.calls.some(isMutatingCall), `${mode}: no git mutation after a refused opening write`);
    assert.equal(snapshot(fx).head, before.head);
  }
  const fx = mkFixture(), orch = mkOrch(fx);
  const d = await run(fx, startArgs(fx, { dry: true }), { orch });
  assert.equal(d.code, 0, d.err);
  assert.equal(orch.imports, 0, "the orchestrator is not even loaded under --dry-run");
  assert.deepEqual(orch.calls, []);
  assert.match(d.out, /^release: DRY-RUN \[s2\] tw_update_state agent_id=release-engineer status=In_Progress active_feature=feat pending_notes=\["release-engineer: starting release for feat"\]$/m);
});

test("AC-R2 O1: a real-run start drives the real compiled orchestrator through the opening write", async () => {
  // WHY: the fake orchestrator cannot catch a server-side gate (transition, lease, stamp provenance) rejecting the
  // runner's opening write. This drives the real dist/tools/handoff-orchestrator.js in a scratch workspace.
  const orchMod = await import(pathToFileURL(path.join(REPO, "dist", "tools", "handoff-orchestrator.js")).href);
  const fx = mkFixture();
  fx.put("CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n## [1.2.3] - 2026-10-01\n\n- older\n"); // s3 stops right after s2
  G(fx.root, "add", "-A"); G(fx.root, "commit", "-q", "-m", "empty unreleased"); G(fx.root, "push", "-q", "origin", "main");
  const r = await run(fx, startArgs(fx), { orch: { imports: 0, calls: [], load: async () => orchMod } });
  assert.equal(r.code, code("CHANGELOG_ENTRY_MISSING"), `s3 stop after the opening write: ${stopOf(r)}`);
  assert.match(r.out, /^release: \[s2\] \$ tw_update_state agent_id=release-engineer status=In_Progress active_feature=feat /m);
  const onDisk = fx.read(".current/_primary/handoff.md");
  const state = (await import(pathToFileURL(path.join(REPO, "dist", "tools", "handoff-parse.js")).href)).parseHandoff;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e405-rn-parse-"));
  cleanup.push(tmp);
  fs.mkdirSync(path.join(tmp, ".current")); fs.writeFileSync(path.join(tmp, ".current", "handoff.md"), onDisk);
  const parsed = state(tmp);
  assert.equal(parsed.last_agent, "release-engineer");
  assert.equal(parsed.status, "In_Progress");
  assert.equal(parsed.active_feature, "feat");
  assert.ok(parsed.pending_notes.includes("release-engineer: starting release for feat"), "the opening note landed in handoff.md");
  assert.deepEqual(fs.readFileSync(path.join(fx.work, "state.md"), "utf-8"), PASS_HANDOFF, "state.md is the pre-write PASS copy");
});

// ---------------------------------------------------------------- AC-R3

test("AC-R3 lenient pre-flight CI: red stops, a warning continues", async () => {
  const fx = mkFixture();
  fx.cfg.ci = CI.red;
  const red = await run(fx, startArgs(fx));
  assert.equal(red.code, code("PREFLIGHT_CI_RED"));
  assert.match(stopOf(red), /^RELEASE_STOP PREFLIGHT_CI_RED: .*concluded "failure"/);
  const ci = fx.calls.find((c) => c.args[0] === "scripts/verify-release.mjs");
  assert.deepEqual(ci.args, ["scripts/verify-release.mjs", "--ci-check"], "lenient: no --strict, no --sha");
  assert.ok(!fx.calls.some((c) => c.args[0] === "fetch" || c.args[0] === "switch"), "no git mutation after a red pre-flight");

  const fy = mkFixture();
  fy.cfg.ci = CI.warn;
  const warn = await run(fy, startArgs(fy));
  assert.equal(warn.code, 0, warn.err);
  assert.match(warn.out, /WARN: CI ground-truth/);
  // The real run keeps the runner's wait budget; a dry run never waits (wait budget 0 for that child only).
  assert.equal(fy.calls.find((c) => c.args[0] === "scripts/verify-release.mjs").env.AGC_VERIFY_CI_WAIT_SECONDS, "900");
  const fz = mkFixture();
  await run(fz, startArgs(fz, { dry: true }));
  assert.equal(fz.calls.find((c) => c.args[0] === "scripts/verify-release.mjs").env.AGC_VERIFY_CI_WAIT_SECONDS, "0");
  assert.equal(fz.sleeps, 0);
});

// ---------------------------------------------------------------- AC-R4

test("AC-R4 version derivation per bump kind and an existing release branch stops", async () => {
  for (const [bump, want] of [["patch", "1.2.4"], ["minor", "1.3.0"], ["major", "2.0.0"]]) {
    const fx = mkFixture();
    const r = await run(fx, startArgs(fx, { bump, dry: true }));
    assert.equal(r.code, 0, `${bump}: ${r.err}`);
    assert.equal(lastLine(r.out), `release: start DRY-RUN OK (v${want}) — nothing changed`);
    assert.equal(fs.readFileSync(path.join(fx.work, "version"), "utf-8"), `${want}\n`);
  }
  // A leftover branch, locally or on origin, is never reused or deleted, and no branch is created.
  for (const where of ["local", "origin"]) {
    const fx = mkFixture();
    if (where === "local") G(fx.root, "branch", "release/v1.2.4"); else G(fx.root, "push", "-q", "origin", "HEAD:refs/heads/release/v1.2.4");
    const before = snapshot(fx);
    const r = await run(fx, startArgs(fx));
    assert.equal(r.code, code("RELEASE_BRANCH_EXISTS"), `${where}: ${stopOf(r)}`);
    assert.match(stopOf(r), new RegExp(`RELEASE_BRANCH_EXISTS: release/v1\\.2\\.4 exists ${where === "local" ? "locally" : "on origin"}`));
    assert.ok(!fx.calls.some((c) => c.bin === "git" && c.args[0] === "switch"), `${where}: no branch created`);
    assert.equal(snapshot(fx).branch, "main");
    assert.equal(snapshot(fx).files, before.files, `${where}: no file written before the stop`);
  }
  // A real run switches to the new branch from the up-to-date main head.
  const fx = mkFixture();
  const r = await run(fx, startArgs(fx));
  assert.equal(r.code, 0, r.err);
  assert.ok(r.cmds.includes("git switch -c release/v1.2.4"));
  assert.equal(G(fx.root, "rev-parse", "--abbrev-ref", "HEAD"), "release/v1.2.4");
  // A non x.y.z version on main stops VERSION_INCOHERENT.
  const fv = mkFixture();
  fv.put("package.json", JSON.stringify({ name: "fx", version: "1.2" }));
  G(fv.root, "add", "-A"); G(fv.root, "commit", "-q", "-m", "v"); G(fv.root, "push", "-q", "origin", "main");
  assert.equal((await run(fv, startArgs(fv))).code, code("VERSION_INCOHERENT"));
});

// ---------------------------------------------------------------- AC-R5

test("AC-R5 bumps, CHANGELOG Unreleased becomes the version entry, lockfile parity", async () => {
  const fx = mkFixture();
  const r = await run(fx, startArgs(fx));
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(fx.read("package.json")).version, "1.2.4");
  assert.match(fx.read("index.ts"), /name: "fx",\n  version: "1\.2\.4",/);
  assert.equal(fx.read("README.md"), "Install: npx github:o/r#v1.2.4\n");
  assert.equal(fx.read("CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n## [1.2.4] - 2026-11-04\n\n### Added\n- feat (E7)\n\n## [1.2.3] - 2026-10-01\n\n- older\n", "UTC date from the injected clock");
  const lock = JSON.parse(fx.read("package-lock.json"));
  assert.equal(lock.version, "1.2.4"); assert.equal(lock.packages[""].version, "1.2.4");
  assert.ok(r.cmds.includes("npm install --package-lock-only"));
  assert.ok(r.cmds.indexOf("npm install --package-lock-only") < r.cmds.indexOf("npx tsc"), "lockfile refresh before the build");

  const drift = mkFixture();
  drift.cfg.lockDrift = true;
  const d = await run(drift, startArgs(drift));
  assert.equal(d.code, code("LOCKFILE_DRIFT"));
  assert.match(stopOf(d), /LOCKFILE_DRIFT: .*"packages" beyond the root version/);

  // An empty Unreleased stops before any write or branch.
  const empty = mkFixture();
  empty.put("CHANGELOG.md", "# C\n\n## [Unreleased]\n\n## [1.2.3] - x\n");
  G(empty.root, "add", "-A"); G(empty.root, "commit", "-q", "-m", "e"); G(empty.root, "push", "-q", "origin", "main");
  const before = snapshot(empty);
  const e = await run(empty, startArgs(empty));
  assert.equal(e.code, code("CHANGELOG_ENTRY_MISSING"));
  assert.deepEqual(snapshot(empty), before, "nothing written, no branch");
});

// ---------------------------------------------------------------- AC-R6

test("AC-R6 build, test and advisory stops, each its own class", async () => {
  const cases = [
    ["tsc", { tsc: { status: 2, stdout: "src/a.ts(1,1): error TS2304: Cannot find name x\n" } }, "BUILD_FAILED", /error TS2304/],
    ["check-version", { checkVersion: { status: 1, stderr: "FAIL: version mismatch\n" } }, "VERSION_INCOHERENT", /check-version\.mjs/],
    ["transitions-sync", { transitions: { status: 1, stderr: "out of sync\n" } }, "BUILD_FAILED", /check-transitions-sync/],
    ["npm test", { test: { status: 1, stdout: "not ok 3 - the broken test\n# fail 1\n" } }, "TEST_FAILED", /# fail 1; not ok 3 - the broken test/],
    ["audit unparsable", { audit: { status: 1, stdout: "<html>registry down</html>" } }, "AUDIT_FAILED", /npm audit/],
    ["audit error object", { audit: { status: 1, stdout: JSON.stringify({ error: { code: "ENOAUDIT" } }) } }, "AUDIT_FAILED", /npm audit/],
  ];
  for (const [why, cfg, id, re] of cases) {
    const fx = mkFixture();
    Object.assign(fx.cfg, cfg);
    const r = await run(fx, startArgs(fx));
    assert.equal(r.code, code(id), `${why}: ${stopOf(r)}`);
    assert.match(stopOf(r), new RegExp(`^RELEASE_STOP ${id}: .*`));
    assert.match(stopOf(r), re, why);
  }
  // An unrecorded HIGH advisory stops at s3 naming the package and id, before any branch.
  const fx = mkFixture();
  fx.put("docs/dependency-advisories.md", "# Advisories\n");
  G(fx.root, "add", "-A"); G(fx.root, "commit", "-q", "-m", "a"); G(fx.root, "push", "-q", "origin", "main");
  fx.cfg.audit = { status: 1, stdout: AUDIT_HIGH };
  const u = await run(fx, startArgs(fx));
  assert.equal(u.code, code("ADVISORY_UNDISPOSED"));
  assert.ok(stopOf(u).includes(`npm audit flagged foo (${GHSA}) with no disposition in docs/dependency-advisories.md`), stopOf(u));
  assert.ok(!fx.calls.some((c) => c.bin === "git" && c.args[0] === "switch"), "stopped before any branch");
  // A recorded advisory continues and is named in the log (both audits).
  const fy = mkFixture();
  fy.cfg.audit = { status: 1, stdout: AUDIT_HIGH };
  const ok = await run(fy, startArgs(fy));
  assert.equal(ok.code, 0, ok.err);
  assert.equal(ok.out.split("\n").filter((l) => l.includes(`advisory foo (${GHSA}) recorded in docs/dependency-advisories.md`)).length, 2, "named at s3 and s9");
  // An advisory that first appears at s9 (after the test) still stops.
  const fz = mkFixture();
  fz.put("docs/dependency-advisories.md", "# Advisories\n");
  G(fz.root, "add", "-A"); G(fz.root, "commit", "-q", "-m", "a"); G(fz.root, "push", "-q", "origin", "main");
  fz.cfg.audit = (n) => (n === 1 ? { stdout: AUDIT_NONE } : { status: 1, stdout: AUDIT_HIGH });
  const late = await run(fz, startArgs(fz));
  assert.equal(late.code, code("ADVISORY_UNDISPOSED"));
  assert.ok(late.cmds.includes("npm test"), "the s9 audit runs after npm test");
});

// ---------------------------------------------------------------- AC-R7

test("AC-R7 automatic done-mark amends only the named pre-marked rows", async () => {
  const fx = mkFixture();
  const r = await run(fx, startArgs(fx));
  assert.equal(r.code, 0, r.err);
  const want = BACKLOG.replace("| E7 | **DONE** feature seven, not yet released |", "| E7 | **DONE** feature seven, shipped v1.2.4 |");
  assert.equal(fx.read("docs/backlog.md"), want, "the pre-mark is replaced in place; E8 (also pre-marked, not named) and every other line are byte-identical");
  const diff = G(fx.root, "diff", "-U0", "HEAD", "--", "docs/backlog.md").split("\n").filter((l) => /^[+-][^+-]/.test(l));
  assert.equal(diff.length, 2, "exactly one row changed");
  assert.deepEqual(rel.checkDoneMarks({ backlogText: fx.read("docs/backlog.md"), diffLines: diff, tickets: ["E7"], version: "1.2.4" }), [], "prepare's existing done-mark check passes on the result");

  const none = mkFixture();
  assert.equal((await run(none, startArgs(none, { tickets: "none" }))).code, 0);
  assert.equal(none.read("docs/backlog.md"), BACKLOG, "tickets=none writes nothing to the backlog");
  assert.equal(fs.readFileSync(path.join(none.work, "message.txt"), "utf-8").split("\n")[0], "chore(release): v1.2.4 — feat");

  for (const [why, tickets] of [["a row that is not **DONE", "E8"], ["a row without the pre-mark", "E9"], ["a missing row", "E1"]]) {
    const f = mkFixture(), before = snapshot(f);
    const s = await run(f, startArgs(f, { tickets }));
    assert.equal(s.code, code("DONE_MARK"), `${why}: ${stopOf(s)}`);
    assert.deepEqual(snapshot(f), before, `${why}: stops at s3, before any write`);
  }
});

// ---------------------------------------------------------------- AC-R8

test("AC-R8 commit message file outside the root, derived summary, no trailer", async () => {
  const fx = mkFixture();
  const r = await run(fx, startArgs(fx));
  assert.equal(r.code, 0, r.err);
  const msg = path.join(fx.work, "message.txt");
  assert.ok(path.relative(fx.root, msg).startsWith(".."), "outside the repository root");
  const text = fs.readFileSync(msg, "utf-8");
  assert.equal(text.split("\n")[0], "chore(release): v1.2.4 — feat (E7)", "<active_feature> (<ids>)");
  assert.ok(!/Co-Authored-By|Generated with/i.test(text), "no attribution trailer");
  assert.ok(!text.includes(fx.root) && !/\/(Users|home)\//.test(text), "no repository path in the message");
  assert.match(text, /^Release gate: feat \(qa-engineer PASS committed to main\)\.$/m);
  // `version` is the last write of start; the workflow reads it for $GITHUB_OUTPUT.
  assert.equal(fs.readFileSync(path.join(fx.work, "version"), "utf-8"), "1.2.4\n");
  const wrote = [...r.out.matchAll(/^release: \[s\d+\] wrote .*[/\\](\S+)$/gm)].map((m) => m[1]);
  assert.deepEqual(wrote, ["state.md", "message.txt", "version"], "order of the work-dir writes");
  assert.match(lastLine(r.out), /^release: start OK \(v1\.2\.4\) — release\/v1\.2\.4 bumped, built and tested$/);
  // The message is acceptable to prepare's own subject rule.
  assert.match(text.split("\n")[0], /^chore\(release\): v1\.2\.4 — .+$/);
  // The release-tree prepare would stage: only the files start touched (no work-dir file inside the root).
  const status = spawnSync("git", ["status", "--porcelain=v1"], { cwd: fx.root, encoding: "utf-8", env: GIT_ENV }).stdout.split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
  assert.deepEqual(status, ["CHANGELOG.md", "README.md", "docs/backlog.md", "index.ts", "package-lock.json", "package.json"], "start leaves exactly the bumps and the done-mark in the tree (the fake server writes no handoff)");
});

// ---------------------------------------------------------------- AC-R9

function tagged(fx) { G(fx.root, "tag", "-a", "v1.2.4", "-m", "v1.2.4 — feat"); return G(fx.root, "rev-parse", "v1.2.4^{commit}"); }

test("AC-R9 closing triple, read-back match gates close-out", async () => {
  const fx = mkFixture(), tip = tagged(fx), orch = mkOrch(fx), before = snapshot(fx);
  const r = await run(fx, ["record", "--version", "1.2.4"], { orch });
  assert.equal(r.code, 0, r.err);
  assert.equal(lastLine(r.out), "release: record OK (v1.2.4) — read-back matches the closing write");
  assert.deepEqual(orch.calls.map(([op]) => op), ["get", "update", "get"], "get (guard + active_feature), closing write, read-back");
  assert.deepEqual(orch.calls[1][1], {
    workspace_path: fx.root, agent_id: "release-engineer", status: "In_Progress", active_feature: "feat", completed_tasks: [],
    next_role: "pm", pending_notes: ["Released v1.2.4", `tag: ${tip}`],
  });
  assert.deepEqual(snapshot(fx), before, "record changes no file, ref or remote itself");

  for (const field of ["status", "next_role", "last_agent", "pending_notes"]) {
    const f = mkFixture(); tagged(f);
    const m = await run(f, ["record", "--version", "1.2.4"], { orch: mkOrch(f, `mismatch-${field}`) });
    assert.equal(m.code, code("READBACK_MISMATCH"), field);
    assert.match(stopOf(m), new RegExp(`^RELEASE_STOP READBACK_MISMATCH: ${field}: wrote .*, read .* — the closing write did not land as written; do not run close-out$`), field);
    assert.ok(!/record OK/.test(m.out), `${field}: no OK line, so the workflow never reaches close-out`);
  }
  const rj = mkFixture(); tagged(rj);
  const rejected = await run(rj, ["record", "--version", "1.2.4"], { orch: mkOrch(rj, "reject") });
  assert.equal(rejected.code, code("STATE_WRITE_REJECTED"));
  assert.match(stopOf(rejected), /^RELEASE_STOP STATE_WRITE_REJECTED: FEATURE_LEASE_HELD: another feature holds the lease$/);
  assert.ok(!rejected.out.includes("[r15]"), "no read-back after a rejected write");
  // No tag yet: record runs after publish.
  const nt = mkFixture();
  const none = await run(nt, ["record", "--version", "1.2.4"]);
  assert.equal(none.code, 2);
  assert.match(stopOf(none), /^RELEASE_STOP USAGE: record runs after publish: v1\.2\.4 has no tag$/);
  // record runs on main only.
  const wb = mkFixture(); tagged(wb); G(wb.root, "switch", "-q", "-c", "side");
  assert.equal((await run(wb, ["record", "--version", "1.2.4"])).code, code("WRONG_BRANCH"));
});

test("AC-R14 record --dry-run: no state call, no load, nothing changed, no tag needed", async () => {
  for (const withTag of [true, false]) {
    const fx = mkFixture(); if (withTag) tagged(fx);
    const before = snapshot(fx), orch = mkOrch(fx);
    const d = await run(fx, ["record", "--version", "1.2.4", "--dry-run"], { orch });
    assert.equal(d.code, 0, d.err);
    assert.equal(lastLine(d.out), "release: record DRY-RUN OK (v1.2.4) — nothing changed");
    assert.equal(orch.imports, 0); assert.deepEqual(orch.calls, []);
    for (const step of ["r14", "r15"]) assert.match(d.out, new RegExp(`^release: DRY-RUN \\[${step}\\] tw_`, "m"));
    assert.match(d.out, /tw_update_state agent_id=release-engineer status=In_Progress active_feature=<unchanged> next_role=pm pending_notes=\["Released v1\.2\.4","tag: /);
    assert.deepEqual(snapshot(fx), before);
  }
});

// ---------------------------------------------------------------- AC-R14 and the five phases

test("AC-R14 runner dry run mutates nothing and writes no state", async () => {
  const fx = mkFixture(), before = snapshot(fx), orch = mkOrch(fx);
  const r = await run(fx, startArgs(fx, { dry: true }), { orch });
  assert.equal(r.code, 0, r.err);
  assert.equal(lastLine(r.out), "release: start DRY-RUN OK (v1.2.4) — nothing changed");
  assert.deepEqual(snapshot(fx), before, "working tree, index, refs, remote, gh log and .current/ unchanged");
  assert.equal(orch.imports, 0);
  assert.deepEqual(orch.calls, [], "no get or update call reaches the orchestrator");
  assert.ok(!fx.calls.some(isMutatingCall), "no mutating child call was executed");
  for (const c of fx.calls) assert.ok(!(c.bin === "npm" && c.args[0] === "test") && !(c.bin === "npx"), "build and test are deferred, never run, under a dry run");
  for (const re of [/\[s2\] tw_update_state/, /\[s5\] git fetch origin/, /\[s6\] git switch -c release\/v1\.2\.4/, /\[s7\] npm install --package-lock-only/, /\[s10\] write docs\/backlog\.md/]) {
    assert.match(r.out, new RegExp(`^release: DRY-RUN ${re.source}`, "m"), `planned: ${re}`);
  }
  assert.ok(fs.existsSync(path.join(fx.work, "version")), "only the out-of-repo work dir is written");
});

test("AC-R14 no mutate or state action is executed under --dry-run, for all five phases", async () => {
  // WHY: the dry-run guarantee is per phase. start and record are driven above; prepare, publish and close-out run on
  // a tree a real start produced, so the whole chain is exercised end to end.
  const phases = {};
  const fx = mkFixture();
  const s = await run(fx, startArgs(fx));
  assert.equal(s.code, 0, s.err);
  // The release commit, branch push and pull request are what a real prepare makes; the test stages them by hand.
  G(fx.root, "add", "-A");
  G(fx.root, "commit", "-q", "-F", path.join(fx.work, "message.txt"));
  G(fx.root, "push", "-q", "-u", "origin", "release/v1.2.4");
  const head = G(fx.root, "rev-parse", "HEAD");
  fx.ghPrs["release/v1.2.4"] = { number: 9, state: "OPEN", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", statusCheckRollup: [{ conclusion: "SUCCESS" }], mergeCommit: null, headRefOid: head };
  const dryArgs = {
    start: () => startArgs(fx, { dry: true }), prepare: () => ["prepare", "--version", "1.2.4", "--state", path.join(fx.work, "state.md"), "--tickets", "E7", "--message-file", path.join(fx.work, "message.txt"), "--dry-run"],
    publish: () => ["publish", "--version", "1.2.4", "--dry-run"], record: () => ["record", "--version", "1.2.4", "--dry-run"], "close-out": () => ["close-out", "--version", "1.2.4", "--dry-run"],
  };
  for (const phase of ["prepare", "publish"]) {
    const before = snapshot(fx); fx.calls.length = 0; fx.ghLog.length = 0;
    const orch = mkOrch(fx);
    const r = await run(fx, dryArgs[phase](), { orch });
    phases[phase] = r.code;
    assert.equal(r.code, 0, `${phase}: ${r.err}`);
    assert.equal(lastLine(r.out), `release: ${phase} DRY-RUN OK (v1.2.4) — nothing changed`);
    assert.deepEqual(snapshot(fx), before, `${phase}: nothing changed`);
    assert.ok(!fx.calls.some(isMutatingCall), `${phase}: no mutating child call executed`);
    assert.equal(orch.imports, 0, `${phase}: no state call`);
  }
  // record and close-out need main with the tag / the closing write; the tree after a real publish is simulated on a fresh fixture.
  const fm = mkFixture(); tagged(fm);
  fm.put(".current/_primary/handoff.md", '---\nschema_version: 15\nactive_feature: "feat"\nstatus: "In_Progress"\nlast_updated: "2026-11-04T00:00:00.000Z"\nlast_agent: "release-engineer"\nnext_role: "pm"\n---\n# H\n\n## Pending & Handoff Notes\n- Released v1.2.4\n- tag: abc\n');
  fm.put(".current/_primary/events.jsonl", "{\"n\":1}\n{\"n\":2}\n");
  for (const phase of ["start", "record", "close-out"]) {
    const f = phase === "start" ? mkFixture() : fm;
    const before = snapshot(f); f.calls.length = 0;
    const orch = mkOrch(f);
    const argv = phase === "start" ? startArgs(f, { dry: true }) : dryArgs[phase]();
    const r = await run(f, argv, { orch });
    assert.equal(r.code, 0, `${phase}: ${r.err}`);
    assert.equal(lastLine(r.out), `release: ${phase} DRY-RUN OK (v1.2.4) — nothing changed`);
    assert.deepEqual(snapshot(f), before, `${phase}: nothing changed`);
    assert.ok(!f.calls.some(isMutatingCall), `${phase}: no mutating child call executed`);
    assert.equal(orch.imports, 0, `${phase}: no state call`);
  }
  assert.deepEqual(Object.keys(phases), ["prepare", "publish"]);
});

// ---------------------------------------------------------------- AC-E1

async function openPrFixture() {
  const fx = mkFixture();
  const s = await run(fx, startArgs(fx));
  assert.equal(s.code, 0, s.err);
  G(fx.root, "add", "-A");
  G(fx.root, "commit", "-q", "-F", path.join(fx.work, "message.txt"));
  G(fx.root, "push", "-q", "-u", "origin", "release/v1.2.4");
  fx.head = G(fx.root, "rev-parse", "HEAD");
  fx.ghPrs["release/v1.2.4"] = { number: 9, state: "OPEN", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", statusCheckRollup: [{ conclusion: "SUCCESS" }], mergeCommit: null, headRefOid: fx.head };
  fx.calls.length = 0; fx.sleeps = 0;
  return fx;
}

test("AC-E1 publish --dry-run reports the CI state without waiting", async () => {
  // WHY (E401): a dry run that polls CI for minutes is mistaken for the real gate. It polls once (wait budget 0 for the
  // gate child only), prints one line naming the state, and continues; only a completed red run stops.
  const line = (fx, text) => `release: DRY-RUN [8b-2] CI state of ${fx.head}: ${text} — not waited for under --dry-run`;
  for (const [state, text] of [["passed", "passed"], ["pending", "not completed yet"], ["unverified", "unverified — FAIL: CI ground-truth — gh run list failed"]]) {
    const fx = await openPrFixture();
    fx.cfg.ciStrict = CI[state];
    const before = snapshot(fx);
    const r = await run(fx, ["publish", "--version", "1.2.4", "--dry-run"]);
    assert.equal(r.code, 0, `${state}: ${r.err}`);
    const ci = r.out.split("\n").filter((l) => l.startsWith("release: DRY-RUN [8b-2] CI state of "));
    assert.equal(ci.length, 1, `${state}: exactly one CI-state line`);
    if (state === "unverified") assert.ok(ci[0].startsWith(line(fx, text).split(" — not waited")[0]), ci[0]); else assert.equal(ci[0], line(fx, text));
    assert.match(ci[0], /not waited for under --dry-run$/);
    const gate = fx.calls.filter((c) => c.args[0] === "scripts/verify-release.mjs" && c.args.includes("--strict"));
    assert.equal(gate.length, 1, `${state}: the gate is polled once`);
    assert.deepEqual(gate[0].args, ["scripts/verify-release.mjs", "--ci-check", "--strict", "--sha", fx.head], "argv unchanged");
    assert.equal(gate[0].env.AGC_VERIFY_CI_WAIT_SECONDS, "0", `${state}: no child receives a non-zero wait budget`);
    for (const c of fx.calls.filter((x) => x.args[0] === "scripts/verify-release.mjs")) assert.equal(c.env.AGC_VERIFY_CI_WAIT_SECONDS, "0", "every verify-release child in a dry-run publish has wait 0");
    assert.equal(fx.sleeps, 0, `${state}: the script never sleeps`);
    assert.deepEqual(snapshot(fx), before, `${state}: nothing changed`);
  }
  // A completed red run still stops CI_GATE_FAILED.
  const red = await openPrFixture();
  red.cfg.ciStrict = CI.red;
  const r = await run(red, ["publish", "--version", "1.2.4", "--dry-run"]);
  assert.equal(r.code, code("CI_GATE_FAILED"));
  assert.match(stopOf(r), /^RELEASE_STOP CI_GATE_FAILED: verify-release\.mjs --ci-check --strict exited 1 for [0-9a-f]{40} — FAIL: .*concluded "failure"/);
  assert.ok(!r.out.includes("CI state of"), "a red run prints no CI-state line");
});

test("AC-E1 the real run keeps --ci-check --strict --sha with its wait budget and stops on anything but CI-CHECK PASSED", async () => {
  for (const [state, cfg] of [["pending", CI.pending], ["unverified", CI.unverified], ["red", CI.red], ["silent", { status: 0, stdout: "all fine\n", stderr: "" }]]) {
    const fx = await openPrFixture();
    fx.cfg.ciStrict = cfg;
    const r = await run(fx, ["publish", "--version", "1.2.4"]);
    assert.equal(r.code, code("CI_GATE_FAILED"), state);
    const gate = fx.calls.find((c) => c.args[0] === "scripts/verify-release.mjs" && c.args.includes("--strict"));
    assert.deepEqual(gate.args, ["scripts/verify-release.mjs", "--ci-check", "--strict", "--sha", fx.head]);
    assert.equal(gate.env.AGC_VERIFY_CI_WAIT_SECONDS, "900", `${state}: the real run's wait budget is untouched`);
    assert.ok(!fx.calls.some((c) => c.bin === "gh" && c.args[0] === "pr" && c.args[1] === "merge"), `${state}: no merge after a failed gate`);
  }
  const ok = await openPrFixture();
  ok.cfg.ciStrict = CI.passed;
  const r = await run(ok, ["publish", "--version", "1.2.4"]);
  assert.ok(ok.calls.some((c) => c.bin === "gh" && c.args.slice(0, 2).join(" ") === "pr merge"), `a passed gate proceeds to the merge (exit ${r.code}: ${stopOf(r)})`);
});

// ---------------------------------------------------------------- AC-R11, env scrub

test("AC-R11 only the enumerated npm and npx shapes are admitted", async () => {
  const fx = mkFixture();
  const r = await run(fx, startArgs(fx));
  assert.equal(r.code, 0, r.err);
  const pkg = fx.calls.filter((c) => c.bin === "npm" || c.bin === "npx").map((c) => `${c.bin} ${c.args.join(" ")}`);
  const allowed = new Set(["npm install --package-lock-only", "npx tsc", "npm test", "npm audit --audit-level=high --json"]);
  assert.ok(pkg.length >= 5 && pkg.every((c) => allowed.has(c)), `every npm / npx call is an enumerated shape: ${pkg}`);
  for (const want of allowed) assert.ok(pkg.includes(want), `exercised ${want}`);
  assert.ok(fx.calls.every((c) => Array.isArray(c.args) && c.args.every((a) => typeof a === "string")), "array argv throughout");
  // The runner itself refuses anything else, whichever call kind carries it.
  const runner = rel.createRunner({ root: fx.root, dryRun: false, spawn: () => { throw new Error("must not spawn"); }, env: {}, out: () => {}, err: () => {} });
  for (const [cmd, args] of [["npm", ["ci"]], ["npm", ["install", "left-pad"]], ["npm", ["publish"]], ["npm", ["run", "build"]], ["npx", ["eslint"]], ["npx", ["--yes", "tsc"]]]) {
    for (const kind of ["read", "deferred", "mutate"]) {
      assert.throws(() => runner[kind](cmd, args, { step: "x" }), (e) => e.classId === "INTERNAL", `${kind} ${cmd} ${args.join(" ")}`);
    }
  }
  // Static: still one child-process call site, no shell.
  const src = fs.readFileSync(SCRIPT, "utf-8");
  assert.equal((src.match(/spawn\(bin, argv/g) ?? []).length, 1);
  assert.ok(!/shell\s*:\s*true/.test(src));
});

test("AC-R11 npm and npx children lose GH_TOKEN, GITHUB_TOKEN and every AGC_* key; node children keep what they need", async () => {
  const fx = mkFixture();
  const r = await run(fx, startArgs(fx), { env: { GH_TOKEN: "placeholder-a", GITHUB_TOKEN: "placeholder-b", AGC_SOMETHING: "1" } });
  assert.equal(r.code, 0, r.err);
  const pkg = fx.calls.filter((c) => c.bin === "npm" || c.bin === "npx");
  assert.ok(pkg.length > 0);
  for (const c of pkg) {
    for (const k of Object.keys(c.env)) assert.ok(k !== "GH_TOKEN" && k !== "GITHUB_TOKEN" && !k.startsWith("AGC_"), `${c.bin} ${c.args[0]} sees ${k}`);
    assert.ok("PATH" in c.env, "the rest of the env is kept");
  }
  const ci = fx.calls.find((c) => c.args[0] === "scripts/verify-release.mjs");
  assert.equal(ci.env.GH_TOKEN, "placeholder-a", "verify-release.mjs still gets the token its gh calls need");
  assert.equal(ci.env.AGC_VERIFY_CI_WAIT_SECONDS, "900");
});

// ---------------------------------------------------------------- AC-R13

test("AC-R13 the stop line the workflow reads equals the last stderr line", async () => {
  const fx = mkFixture();
  fx.put(".current/_primary/handoff.md", PASS_HANDOFF.replace('status: "PASS"', 'status: "Blocked"'));
  const r = await run(fx, startArgs(fx));
  assert.equal(r.code, code("PRECONDITION_NOT_PASS"));
  assert.match(stopOf(r), /^RELEASE_STOP PRECONDITION_NOT_PASS: /);
  assert.equal(r.stop, `${stopOf(r)}\n`, "the stop file holds the same bytes as the last stderr line");
  assert.equal(r.err.split("\n").filter((l) => l.startsWith("RELEASE_STOP ")).length, 1);
  // A multi-line detail is flattened to one line in both.
  const fy = mkFixture();
  fy.cfg.test = { status: 1, stdout: "# fail 2\nnot ok 1 - a\nnot ok 2 - b\n" };
  const t = await run(fy, startArgs(fy));
  assert.equal(t.stop, `${stopOf(t)}\n`);
  assert.ok(!t.stop.slice(0, -1).includes("\n"), "a single line");
  // A later stop replaces an earlier one; a success writes no file.
  const fz = mkFixture();
  fs.writeFileSync(fz.stopFile, "stale\n");
  const ok = await run(fz, startArgs(fz, { dry: true }));
  assert.equal(ok.code, 0);
  assert.equal(ok.stop, "stale\n", "a successful run does not touch the stop file");
  // Every phase writes it, the three manual ones included; an unwritable path never masks the stop.
  const fp = mkFixture();
  const p = await run(fp, ["publish", "--version", "1.2.4"]);
  assert.notEqual(p.code, 0);
  assert.equal(p.stop, `${stopOf(p)}\n`);
  const fq = mkFixture();
  const bad = await run(fq, ["record", "--version", "1.2.4"], { env: { AGC_RELEASE_STOP_FILE: path.join(fq.base, "no-such-dir", "stop.txt") }, noStopFile: true });
  assert.equal(bad.code, 2);
  assert.match(stopOf(bad), /^RELEASE_STOP USAGE: /, "the stop line still prints");
  // Through a real child process the last stderr line is the stop line and the file matches it.
  const fc = mkFixture();
  const child = spawnSync(process.execPath, [SCRIPT, "start", "--bump", "nope", "--tickets", "E7", "--work-dir", fc.work], { cwd: fc.root, encoding: "utf-8", env: { ...process.env, AGC_RELEASE_STOP_FILE: fc.stopFile } });
  assert.equal(child.status, 2);
  assert.equal(fs.readFileSync(fc.stopFile, "utf-8"), `${lastLine(child.stderr)}\n`);
});

test("AC-R10 one exit code per runner class (the eleven new rows)", async () => {
  // WHY: the table's manual rows are driven by the E394 release-script test; the eleven runner-only rows are driven here.
  const t = {
    PRECONDITION_NOT_PASS: async () => { const fx = mkFixture(); fx.put(".current/_primary/handoff.md", PASS_HANDOFF.replace('status: "PASS"', 'status: "Blocked"')); return run(fx, startArgs(fx)); },
    STATE_WRITE_REJECTED: async () => { const fx = mkFixture(); return run(fx, startArgs(fx), { orch: mkOrch(fx, "reject") }); },
    READBACK_MISMATCH: async () => { const fx = mkFixture(); tagged(fx); return run(fx, ["record", "--version", "1.2.4"], { orch: mkOrch(fx, "mismatch-status") }); },
    PREFLIGHT_CI_RED: async () => { const fx = mkFixture(); fx.cfg.ci = CI.red; return run(fx, startArgs(fx)); },
    RELEASE_BRANCH_EXISTS: async () => { const fx = mkFixture(); G(fx.root, "branch", "release/v1.2.4"); return run(fx, startArgs(fx)); },
    CHANGELOG_ENTRY_MISSING: async () => { const fx = mkFixture(); fx.put("CHANGELOG.md", "# C\n\n## [Unreleased]\n"); return run(fx, startArgs(fx)); },
    LOCKFILE_DRIFT: async () => { const fx = mkFixture(); fx.cfg.lockDrift = true; return run(fx, startArgs(fx)); },
    BUILD_FAILED: async () => { const fx = mkFixture(); fx.cfg.tsc = { status: 2 }; return run(fx, startArgs(fx)); },
    TEST_FAILED: async () => { const fx = mkFixture(); fx.cfg.test = { status: 1 }; return run(fx, startArgs(fx)); },
    AUDIT_FAILED: async () => { const fx = mkFixture(); fx.cfg.audit = { stdout: "garbage" }; return run(fx, startArgs(fx)); },
    ADVISORY_UNDISPOSED: async () => { const fx = mkFixture(); fx.put("docs/dependency-advisories.md", "# none\n"); fx.cfg.audit = { stdout: AUDIT_HIGH }; return run(fx, startArgs(fx)); },
  };
  const runnerOnly = rel.EXIT_CLASSES.filter((c) => c.phases.every((p) => rel.RUNNER_PHASES.includes(p)));
  assert.deepEqual(Object.keys(t).sort(), runnerOnly.map((c) => c.id).sort(), "every runner-only class has a trigger");
  for (const cls of runnerOnly) {
    const r = await t[cls.id]();
    assert.equal(r.code, cls.code, `${cls.id}: exit code (${stopOf(r)})`);
    assert.match(stopOf(r), new RegExp(`^RELEASE_STOP ${cls.id}: .+`));
    assert.equal(r.err.split("\n").filter((l) => l.startsWith("RELEASE_STOP ")).length, 1, `${cls.id}: exactly one stop record`);
  }
});

test("AC-R1 start usage: every flag is required and checked, USAGE exits 2 with the stop line last", async () => {
  const fx = mkFixture();
  for (const argv of [["start"], ["start", "--bump", "patch"], ["start", "--bump", "huge", "--tickets", "E7", "--work-dir", fx.work], ["start", "--bump", "patch", "--tickets", "e7", "--work-dir", fx.work],
    ["start", "--bump", "patch", "--tickets", "E7", "--work-dir", fx.work, "--bogus"], ["record"], ["record", "--version", "v1.2.4"]]) {
    const r = await run(fx, argv);
    assert.equal(r.code, 2, argv.join(" "));
    assert.match(stopOf(r), /^RELEASE_STOP USAGE: /);
  }
  assert.ok(!fx.calls.some(isMutatingCall));
});
