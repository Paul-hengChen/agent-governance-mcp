// Coded by @qa-engineer
// E447 (T-E447-01) AC10 (acceptance f): with "knowledge" absent or "repo", nothing changes — init
// writes no knowledge rule, start copies no knowledge file and writes no seed record, finish prints
// none of the new lines and keeps today's specs/archive/<lane>/ evidence rule, and check --cut stays
// a pure file check. The byte-for-byte "finish as before" half rests on the existing finish suites
// (e180, e213, e217, e287, e335, agc-feature-finish-history, agc-feature-lifecycle), which pin their
// exact stdout/stderr and must stay green unedited; this file adds the targeted mode-off checks.
// Spec: specs/e447-local-knowledge-files.md AC10. Scratch git repos under os.tmpdir().

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const FANOUT = path.join(PROJECT_ROOT, "scripts", "fanout.mjs");

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
const agc = (cwd, args, env) =>
  spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8", ...(env ? { env } : {}) });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const excludeLines = (repo) => {
  const p = path.join(repo, ".git", "info", "exclude");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8").split("\n") : [];
};
const readConfig = (ws) => JSON.parse(fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8"));

const KNOWLEDGE_RULES = ["/specs/", "/design/", "/research/", "/docs/tickets/", "/docs/backlog.md"];
// Every new e447 output fragment (Copy / Strings); none may appear with the mode off.
const NEW_FRAGMENTS = [
  "knowledge file",
  "knowledge-seed.json",
  "seeded knowledge",
  "knowledge files stay out of git",
  "MANIFEST_CHANGED",
];

function makeRepo() {
  const r = mkTmp("e447-off-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  return r;
}

// Mode-off primary with the knowledge paths ignored all the same (so only the config key differs
// from a mode-on fixture). `knowledge`: undefined = key absent, else its value.
function makeOffRepo(knowledge) {
  const r = makeRepo();
  fs.appendFileSync(
    path.join(r, ".git", "info", "exclude"),
    ["/.current/", "/tasks.md", "/qa_reports/", "/review_reports/", ...KNOWLEDGE_RULES].join("\n") + "\n"
  );
  const cfg = { schema_version: 2, artifacts: "local", ...(knowledge === undefined ? {} : { knowledge }) };
  writeFile(path.join(r, ".current", ".config.json"), JSON.stringify(cfg, null, 2) + "\n");
  writeFile(path.join(r, "specs", "s1.md"), "# s1\n");
  writeFile(path.join(r, "design", "d1.md"), "# d1\n");
  writeFile(path.join(r, "docs", "backlog.md"), "# B\n\n| id | desc | priority | status |\n|---|---|---|---|\n| E10 | x | P2 | open |\n");
  return r;
}

test("AC10: mode off -> init writes no knowledge rule; --knowledge=repo records \"repo\" and no rule; a flag-less re-run keeps it", () => {
  const plain = makeRepo();
  const r0 = agc(plain, ["init"]);
  assert.equal(r0.status, 0, r0.stderr);
  for (const rule of [...KNOWLEDGE_RULES, "/AGENTS.md", "/.antigravityrules"]) {
    assert.ok(!excludeLines(plain).includes(rule), `no ${rule} without the mode`);
  }
  assert.equal("knowledge" in readConfig(plain), false, "no key written without the flag");

  const repoMode = makeRepo();
  const r1 = agc(repoMode, ["init", "--knowledge=repo"]);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(readConfig(repoMode).knowledge, "repo");
  for (const rule of KNOWLEDGE_RULES) assert.ok(!excludeLines(repoMode).includes(rule), rule);
  const r2 = agc(repoMode, ["init"]);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(readConfig(repoMode).knowledge, "repo", "a re-run keeps the declared value");

  // local -> repo: the key flips, the rules stay (as --artifacts=repo leaves its rules).
  const flip = makeRepo();
  assert.equal(agc(flip, ["init", "--knowledge=local"]).status, 0);
  const r3 = agc(flip, ["init", "--knowledge=repo"]);
  assert.equal(r3.status, 0, r3.stderr);
  assert.equal(readConfig(flip).knowledge, "repo");
});

test("AC10: mode off (key absent, and \"repo\") -> start copies no knowledge file, writes no seed record; finish prints no new line and keeps today's specs/archive rule", () => {
  for (const knowledge of [undefined, "repo"]) {
    const label = `knowledge=${JSON.stringify(knowledge)}`;
    const repo = makeOffRepo(knowledge);
    const lane = path.join(mkTmp("e447-off-lane-"), "lane");
    const s = agc(repo, ["feature", "start", "e9-x", "--path", lane]);
    assert.equal(s.status, 0, `${label}: ${s.stderr}`);
    for (const rel of ["specs/s1.md", "design/d1.md", "docs/backlog.md"]) {
      assert.equal(fs.existsSync(path.join(lane, rel)), false, `${label}: ${rel} not seeded`);
    }
    assert.equal(fs.existsSync(path.join(lane, ".current", "e9", "knowledge-seed.json")), false, `${label}: no seed record`);
    for (const f of NEW_FRAGMENTS) assert.ok(!(s.stdout + s.stderr).includes(f), `${label}: start prints no "${f}"`);

    // Today's --shipped rule: an ignored, untracked spec goes to specs/archive/<lane>/; design/ is not harvested.
    writeFile(path.join(lane, "specs", "lane-spec.md"), "# lane spec\n");
    writeFile(path.join(lane, "design", "x.md"), "# x\n");
    writeFile(
      path.join(lane, ".current", "e9", "pending-tickets.md"),
      "```pending-ticket\nlane_local_id: L1\ntitle: t\npriority: P3\ndepends_on: []\nbody: |\n  b\n```\n"
    );
    const f = agc(repo, ["feature", "finish", "e9", "--shipped"]);
    assert.equal(f.status, 0, `${label}: ${f.stdout}${f.stderr}`);
    for (const frag of NEW_FRAGMENTS) assert.ok(!(f.stdout + f.stderr).includes(frag), `${label}: finish prints no "${frag}"`);
    assert.ok(fs.existsSync(path.join(repo, "specs", "archive", "e9", "lane-spec.md")), `${label}: specs/archive rule unchanged`);
    assert.equal(fs.existsSync(path.join(repo, "design", "x.md")), false, `${label}: no same-path copy-back`);
    assert.match(f.stderr, /were not allocated/, `${label}: worktree-only findings keep the E287 warning, not numbered`);
    const rows = fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8").split("\n").filter((l) => /^\| E\d+ /.test(l));
    assert.equal(rows.length, 1, `${label}: backlog not numbered into`);
  }
});

test("AC10: mode off -> check --cut in a lane never reports MANIFEST_CHANGED; outside a worktree it runs no git command", () => {
  const MANIFEST = [
    "# Fan-out: off wave",
    "base: abc1234    integration branch: integ/off",
    "mailbox: ../lanes/_mailbox",
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    "| e9 | E9 | feat/e9-x | ../lanes/e9 | `src/**` | 共同禁止的全部項目 | 做：E9。　不做：其他。 | 無 |",
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-11-20 | 人類 | 核准 | 整合者 session |",
    "",
  ].join("\n");
  const SPEC = "# s\n\n## Cut\n\n| id | desc | depends_on | est. files | touches | design-link |\n|---|---|---|---|---|---|\n| T-E9-01 | x | none | 1 | `src/a.ts` | — |\n";

  // In a lane of a mode-off repo where the manifest is tracked and the primary copy then differs.
  const repo = makeRepo();
  writeFile(path.join(repo, ".current", ".config.json"), JSON.stringify({ schema_version: 2, artifacts: "local" }) + "\n");
  fs.appendFileSync(path.join(repo, ".git", "info", "exclude"), "/.current/\n");
  writeFile(path.join(repo, "specs", "fanout-x.md"), MANIFEST);
  writeFile(path.join(repo, "specs", "e9-spec.md"), SPEC);
  git(repo, ["add", "specs"]);
  git(repo, ["commit", "-qm", "manifest"]);
  const lane = path.join(mkTmp("e447-off-cut-lane-"), "lane");
  assert.equal(agc(repo, ["feature", "start", "e9-x", "--path", lane]).status, 0);
  fs.appendFileSync(path.join(repo, "specs", "fanout-x.md"), "| 2026-11-25 | 人類 | 追加 | 整合者 session |\n");
  const inLane = spawnSync(process.execPath, [FANOUT, "check", "--cut", "specs/fanout-x.md", "e9", "specs/e9-spec.md"], {
    cwd: lane,
    encoding: "utf-8",
  });
  assert.equal(inLane.status, 0, inLane.stdout + inLane.stderr);
  assert.ok(!(inLane.stdout + inLane.stderr).includes("MANIFEST_CHANGED"));

  // Outside any git repo: a git shim first on PATH logs every invocation; check --cut must make none.
  const dir = mkTmp("e447-off-nogit-");
  writeFile(path.join(dir, "m.md"), MANIFEST);
  writeFile(path.join(dir, "s.md"), SPEC);
  const shimDir = mkTmp("e447-off-shim-");
  const log = path.join(shimDir, "git-calls.log");
  const realGit = execFileSync("git", ["--exec-path"], { encoding: "utf-8" }).trim();
  writeFile(path.join(shimDir, "git"), `#!/bin/sh\necho "$@" >> '${log}'\nexec '${path.join(realGit, "git")}' "$@"\n`);
  fs.chmodSync(path.join(shimDir, "git"), 0o755);
  const env = { ...process.env, PATH: `${shimDir}${path.delimiter}${process.env.PATH}` };
  // Shim sanity: a git call through this PATH is logged and still works.
  const probe = spawnSync("git", ["--version"], { cwd: dir, encoding: "utf-8", env });
  assert.equal(probe.status, 0, probe.stderr);
  assert.match(fs.readFileSync(log, "utf-8"), /--version/, "fixture sanity: the shim logs git calls");
  fs.rmSync(log);
  const out = spawnSync(process.execPath, [FANOUT, "check", "--cut", "m.md", "e9", "s.md"], { cwd: dir, encoding: "utf-8", env });
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.ok(!(out.stdout + out.stderr).includes("MANIFEST_CHANGED"));
  assert.equal(fs.existsSync(log) ? fs.readFileSync(log, "utf-8") : "", "", "no git command outside a worktree");
});
