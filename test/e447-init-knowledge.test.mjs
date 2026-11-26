// Coded by @qa-engineer
// E447 (T-E447-01): `agc init --knowledge=local|repo` keeps specs/, design/, research/, the ticket
// directory and docs/backlog.md out of git, so an adopter in a team repo leaves no agc file in the
// repository or its history. Spec: specs/e447-local-knowledge-files.md (AC1, AC2, Copy / Strings
// e447.usage-init, e447.init-*, e447.usage-feature, e447.feature-unknown). Every fixture repo is a
// scratch git repo under os.tmpdir(); agc runs as the CLI. Test titles start with the AC id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) fs.rmSync(d, { recursive: true, force: true });
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
const gitStatusCode = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf-8" }).status;
const agc = (cwd, args) => spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const excludePath = (repo) => path.join(repo, ".git", "info", "exclude");
const excludeLines = (repo) =>
  fs.existsSync(excludePath(repo)) ? fs.readFileSync(excludePath(repo), "utf-8").split("\n") : [];
const readConfig = (ws) => JSON.parse(fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8"));
const porcelain = (repo) => git(repo, ["status", "--porcelain", "--untracked-files=all"]);

// The rules the mode adds (spec AC1 / DOC-CFG): root-anchored, one per knowledge path.
const KNOWLEDGE_RULES = ["/specs/", "/design/", "/research/", "/docs/tickets/", "/docs/backlog.md"];

// Scratch repo with one commit on main and no agc files. `tracked`: extra committed files.
function makeRepo({ tracked = {} } = {}) {
  const r = mkTmp("e447-init-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  for (const [rel, body] of Object.entries(tracked)) writeFile(path.join(r, rel), body);
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  return r;
}

// Every file under `root` except .git/, as rel -> bytes (symlinks as "-> target").
function snapshotTree(root) {
  const out = {};
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir)) {
      if (rel === "" && name === ".git") continue;
      const abs = path.join(dir, name);
      const r = rel === "" ? name : `${rel}/${name}`;
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) out[r] = `-> ${fs.readlinkSync(abs)}`;
      else if (st.isDirectory()) walk(abs, r);
      else out[r] = fs.readFileSync(abs).toString("base64");
    }
  };
  walk(root, "");
  return out;
}

const BACKLOG = "# B\n\n| id | desc | priority | status |\n|---|---|---|---|\n| E10 | x | P2 | open |\n";
const PENDING =
  "```pending-ticket\nlane_local_id: L1\ntitle: found in lane\npriority: P3\ndepends_on: []\nbody: |\n  b\n```\n";

// ============================================================================
// AC1 (acceptance a): zero agc footprint in git, from init through a whole lane.
// WHY: the mode exists so teammates who do not use agc never see an agc file in the repo or its
// history; one leaked path (an adapter, a backlog edit, a numbered finding) defeats the purpose.
// ============================================================================

test("AC1: init --knowledge=local -> clean status and all rules; lane start/commit/merge/finish keeps status clean and history free of agc files", () => {
  const repo = makeRepo();
  const init = agc(repo, ["init", "--knowledge=local"]);
  assert.equal(init.status, 0, init.stderr);
  assert.equal(porcelain(repo), "", "after init: nothing for git to see");

  const lines = excludeLines(repo);
  for (const rule of [...KNOWLEDGE_RULES, "/AGENTS.md", "/.antigravityrules", "/CLAUDE.local.md"]) {
    assert.ok(lines.includes(rule), `exclude must hold ${rule}:\n${lines.join("\n")}`);
  }
  // D2: with the mode on and no --adapter, the agc block goes to CLAUDE.local.md, not a new CLAUDE.md.
  assert.ok(!fs.existsSync(path.join(repo, "CLAUDE.md")), "no untracked CLAUDE.md is created");
  assert.ok(fs.existsSync(path.join(repo, "CLAUDE.local.md")));
  const cfg = readConfig(repo);
  assert.equal(cfg.knowledge, "local");
  assert.equal(cfg.artifacts, "local");

  // The primary checkout's untracked backlog receives the lane's numbered finding later.
  writeFile(path.join(repo, "docs", "backlog.md"), BACKLOG);
  writeFile(path.join(repo, "specs", "s1.md"), "spec\n");
  assert.equal(porcelain(repo), "", "knowledge files written after init stay invisible to git");

  const lane = path.join(mkTmp("e447-init-lane-"), "lane");
  const start = agc(repo, ["feature", "start", "e9-x", "--path", lane]);
  assert.equal(start.status, 0, start.stderr);
  assert.equal(porcelain(repo), "", "after start (primary)");
  assert.equal(porcelain(lane), "", "after start (lane)");

  writeFile(path.join(lane, "src.txt"), "lane work\n");
  git(lane, ["add", "src.txt"]);
  git(lane, ["commit", "-qm", "lane work"]);
  writeFile(path.join(lane, ".current", "e9", "pending-tickets.md"), PENDING);
  assert.equal(porcelain(lane), "", "after the lane commit (lane)");
  assert.equal(porcelain(repo), "", "after the lane commit (primary)");

  git(repo, ["merge", "-q", "--no-ff", "-m", "merge lane", "feat/e9-x"]);
  assert.equal(porcelain(repo), "", "after merge");

  const fin = agc(repo, ["feature", "finish", "e9", "--shipped"]);
  assert.equal(fin.status, 0, fin.stdout + fin.stderr);
  assert.equal(porcelain(repo), "", "after finish");
  const rows = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8").split("\n").filter((l) => /^\| E\d+ /.test(l));
  assert.equal(rows.length, 2, "the lane's one finding was numbered into the untracked backlog");
  assert.match(rows[1], /^\| E11 \|/);

  const everPath = git(repo, ["log", "--all", "--name-only", "--format="])
    .split("\n")
    .filter((l) => l.length > 0);
  const leaked = everPath.filter(
    (p) =>
      /^(specs|design|research|docs\/tickets)\//.test(p) ||
      p === "docs/backlog.md" ||
      p === "AGENTS.md" ||
      p === ".antigravityrules" ||
      p === "CLAUDE.local.md"
  );
  assert.deepEqual(leaked, [], "no agc file in any commit");
});

// ============================================================================
// AC2 (Fix 1): init's rules follow the workspace, never touch a team file, and refuse bad input
// before writing anything.
// ============================================================================

test("AC2 (a): a ticketDir of work/tickets yields /work/tickets/ instead of /docs/tickets/", () => {
  const repo = makeRepo();
  writeFile(
    path.join(repo, ".current", ".config.json"),
    JSON.stringify({ schema_version: 2, ticketDir: "work/tickets" }, null, 2) + "\n"
  );
  const r = agc(repo, ["init", "--knowledge=local"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = excludeLines(repo);
  assert.ok(lines.includes("/work/tickets/"), lines.join("\n"));
  assert.ok(!lines.includes("/docs/tickets/"), "the default ticket dir is not excluded when ticketDir names another");
  for (const rule of ["/specs/", "/design/", "/research/", "/docs/backlog.md"]) assert.ok(lines.includes(rule), rule);
});

test("AC2 (b): a tracked AGENTS.md / .antigravityrules gets no exclude rule and is byte-unchanged", () => {
  const AGENTS = "# team agents file\n";
  const ANTI = "team antigravity rules\n";
  const repo = makeRepo({ tracked: { "AGENTS.md": AGENTS, ".antigravityrules": ANTI } });
  const r = agc(repo, ["init", "--knowledge=local"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = excludeLines(repo);
  assert.ok(!lines.includes("/AGENTS.md"), "a team file agc did not create is never excluded");
  assert.ok(!lines.includes("/.antigravityrules"));
  assert.equal(fs.readFileSync(path.join(repo, "AGENTS.md"), "utf-8"), AGENTS);
  assert.equal(fs.readFileSync(path.join(repo, ".antigravityrules"), "utf-8"), ANTI);
  for (const rule of KNOWLEDGE_RULES) assert.ok(lines.includes(rule), rule);
});

test("AC2 (c): a tracked docs/backlog.md is reported with the git rm -r --cached line and stays tracked", () => {
  const repo = makeRepo({ tracked: { "docs/backlog.md": BACKLOG } });
  const r = agc(repo, ["init", "--knowledge=local"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(
    r.stderr.includes(
      "agc init — warning: the following knowledge path(s) are already tracked in this repo — " +
        "the exclude rule just added has no effect on tracked files:\n"
    ),
    r.stderr
  );
  assert.ok(r.stderr.includes("\nUntrack them with:\n"), "root workspace: no '(run from the repository root)'");
  assert.ok(r.stderr.split("\n").includes("  git rm -r --cached docs/backlog.md"), r.stderr);
  assert.ok(r.stderr.includes("Note: history still contains these files after that command."));
  assert.equal(gitStatusCode(repo, ["ls-files", "--error-unmatch", "--", "docs/backlog.md"]), 0, "init never runs git rm");
  assert.ok(excludeLines(repo).includes("/docs/backlog.md"), "the rule is still written");
});

test("AC2 (d): --knowledge=local --artifacts=repo exits 2 with the needs-local message and writes nothing (D1)", () => {
  const repo = makeRepo();
  const before = snapshotTree(repo);
  const exBefore = fs.existsSync(excludePath(repo)) ? fs.readFileSync(excludePath(repo), "utf-8") : null;
  const r = agc(repo, ["init", "--knowledge=local", "--artifacts=repo"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.ok(
    r.stderr.includes(
      "agc init: --knowledge=local needs local artifacts — the lane seed record lives in the git-ignored " +
        ".current/; re-run with --artifacts=local"
    ),
    r.stderr
  );
  assert.deepEqual(snapshotTree(repo), before, "no file written");
  const exAfter = fs.existsSync(excludePath(repo)) ? fs.readFileSync(excludePath(repo), "utf-8") : null;
  assert.equal(exAfter, exBefore, "exclude untouched");
});

test("AC2 (e): --knowledge=foo exits 2 with the bad-value message and writes nothing", () => {
  const repo = makeRepo();
  const before = snapshotTree(repo);
  const exBefore = fs.existsSync(excludePath(repo)) ? fs.readFileSync(excludePath(repo), "utf-8") : null;
  const r = agc(repo, ["init", "--knowledge=foo"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.ok(r.stderr.includes('agc init: --knowledge must be "local" or "repo" (got "foo")'), r.stderr);
  assert.deepEqual(snapshotTree(repo), before);
  const exAfter = fs.existsSync(excludePath(repo)) ? fs.readFileSync(excludePath(repo), "utf-8") : null;
  assert.equal(exAfter, exBefore);
  // Boundary inputs: empty value and the separate-argument form are refused the same way.
  const empty = agc(repo, ["init", "--knowledge="]);
  assert.equal(empty.status, 2, empty.stderr);
  assert.ok(empty.stderr.includes('agc init: --knowledge must be "local" or "repo" (got "")'), empty.stderr);
  assert.deepEqual(snapshotTree(repo), before);
});

test("AC2 (f): a subdirectory workspace sub/ gets /sub/specs/ etc.", () => {
  const repo = makeRepo({ tracked: { "sub/keep.txt": "k\n" } });
  const sub = path.join(repo, "sub");
  const r = agc(sub, ["init", "--knowledge=local"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = excludeLines(repo);
  for (const rule of KNOWLEDGE_RULES) {
    assert.ok(lines.includes(`/sub${rule}`), `expected /sub${rule}:\n${lines.join("\n")}`);
    assert.ok(!lines.includes(rule), `the root-anchored ${rule} must not be written for a sub workspace`);
  }
});

// ============================================================================
// Copy / Strings: usage text and the feature subcommand list (e447.usage-init, e447.usage-feature,
// e447.feature-unknown). WHY: the usage is the only in-tool documentation of the flag and of reseed.
// ============================================================================

test("Copy e447.usage-init / e447.usage-feature: usage names --knowledge, the start snapshot and feature reseed", () => {
  const r = spawnSync(process.execPath, [AGC_INIT], { encoding: "utf-8" });
  const u = r.stderr;
  assert.ok(u.includes("  init [--artifacts=local|repo] [--adapter=shared|local] [--knowledge=local|repo]\n"), u);
  const knowledgeSentences =
    "          --knowledge=local (opt-in, needs local artifacts) also keeps specs/,\n" +
    "          design/, research/, the ticket directory and docs/backlog.md out\n" +
    "          of git; agc feature start then seeds each lane with them.\n";
  assert.ok(u.includes(knowledgeSentences), "the --knowledge sentences");
  assert.ok(u.indexOf(knowledgeSentences) > u.indexOf("--adapter=local puts"), "after the --adapter sentences");

  const startAdd =
    '          With "knowledge": "local", also copies the primary checkout\'s\n' +
    "          untracked specs/, design/, research/, ticket files and\n" +
    "          docs/backlog.md (a snapshot, hashes in .current/<lane>/).\n";
  const iStart = u.indexOf("  feature start <ticket-slug>");
  const iFinish = u.indexOf("  feature finish <ticket-id>");
  assert.ok(iStart >= 0 && iFinish > iStart);
  const iAdd = u.indexOf(startAdd);
  assert.ok(iAdd > iStart && iAdd < iFinish, "the start paragraph gains the snapshot sentences");

  const reseed =
    "  feature reseed <path>...\n" +
    '          Inside a lane worktree, with "knowledge": "local": copy each named\n' +
    "          knowledge file from the primary checkout over the lane's copy and\n" +
    "          record its new hash. Refuses a file the lane has changed.\n";
  assert.ok(u.indexOf(reseed) > iFinish, "the reseed block follows feature finish");
});

test("Copy e447.feature-unknown: the subcommand list names reseed", () => {
  const repo = makeRepo();
  const bad = agc(repo, ["feature", "bogus"]);
  assert.equal(bad.status, 2, bad.stderr);
  assert.ok(bad.stderr.includes('agc feature: unknown subcommand "bogus" (start | finish | reseed)'), bad.stderr);
  const none = agc(repo, ["feature"]);
  assert.equal(none.status, 2, none.stderr);
  assert.ok(none.stderr.includes("agc feature: missing subcommand (start | finish | reseed)"), none.stderr);
});
