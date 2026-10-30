// Coded by @qa-engineer
// Tests for specs/e383-lane-ledger-and-worktree-evidence.md AC-E383-1..5 and AC-E383-7
// (E383: in a linked lane worktree of a repo that git-ignores agc files, the lane ledger
// .current/<lane>/tasks.md is the ledger when no legacy task file exists, so
// `agc feature finish` harvests it). AC-E383-6 is the unedited existing suites.
// Fixtures are real `git init` + `git worktree add` repos in os.tmpdir(); this repo's own
// artifacts:"repo" state never reproduces the ticket.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { addTaskInFile, getNextTaskFromFile } from "../dist/tools/tasks-file.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

setActiveStorage(new FileHandoffStorage());

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

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

// A primary checkout on `main` whose agc paths are git-ignored (artifacts:"local" shape).
function makeIgnoredPrimary(prefix = "e383-primary-") {
  const repo = mkTmp(prefix);
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  fs.writeFileSync(path.join(repo, ".gitignore"), "/.current/\n/tasks.md\n");
  fs.writeFileSync(path.join(repo, "README.md"), "# fixture\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "init"]);
  return repo;
}

// A linked worktree on `branch`; `git worktree add` needs a path that does not exist yet.
function addWorktree(repo, branch) {
  const wt = path.join(mkTmp("e383-wt-"), "lane");
  git(repo, ["worktree", "add", "-q", "-b", branch, wt]);
  return wt;
}

async function addRow(ws, id = "T-E999-01") {
  return JSON.parse(await addTaskInFile(ws, id, "lane row"));
}
function nextId(next) {
  return next.next?.id;
}

// ---------------------------------------------------------------------------

test("AC-E383-1: ignored repo, linked lane worktree, no legacy file -> lane ledger is the ledger, no advisory", async () => {
  const repo = makeIgnoredPrimary();
  const wt = addWorktree(repo, "feat/e999-x");
  const laneLedger = path.join(wt, ".current", "e999", "tasks.md");

  const added = await addRow(wt);
  assert.equal(fs.realpathSync(added.path), fs.realpathSync(laneLedger), JSON.stringify(added));
  assert.ok(fs.existsSync(laneLedger));
  assert.match(fs.readFileSync(laneLedger, "utf-8"), /T-E999-01/);
  assert.ok(!fs.existsSync(path.join(wt, ".current", "tasks.md")), "no legacy .current/tasks.md");
  assert.ok(!fs.existsSync(path.join(wt, "tasks.md")), "no root tasks.md");

  const next = JSON.parse(getNextTaskFromFile(wt));
  assert.equal(nextId(next), "T-E999-01", JSON.stringify(next));
  assert.ok(!("advisory" in next), "no ignored-lane advisory once the lane ledger is the ledger");
});

// AC-E383-2: the ledger the lane wrote is carried into primary's history by finish.
function bucket(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
function runFinish(repo, args) {
  return spawnSync(process.execPath, [AGC_INIT, "feature", "finish", ...args], { cwd: repo, encoding: "utf-8" });
}
function startLane(repo, ticket, slug) {
  const lane = path.join(mkTmp("e383-finish-lane-"), "lane");
  const r = spawnSync(process.execPath, [AGC_INIT, "feature", "start", `${ticket}-${slug}`, "--path", lane], {
    cwd: repo,
    encoding: "utf-8",
  });
  assert.equal(r.status, 0, `start failed: ${r.stderr}`);
  return lane;
}

test("AC-E383-2-shipped: finish --shipped carries the lane ledger into primary .current/history/<YYYY-MM>/<lane>/", async () => {
  const repo = makeIgnoredPrimary();
  const lane = startLane(repo, "e999", "ship");
  const added = await addRow(lane);
  const laneLedger = path.join(lane, ".current", "e999", "tasks.md");
  assert.equal(fs.realpathSync(added.path), fs.realpathSync(laneLedger));
  const body = fs.readFileSync(laneLedger, "utf-8");

  git(repo, ["merge", "--no-ff", "-m", "merge", "feat/e999-ship"]);
  const r = runFinish(repo, ["e999", "--shipped"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const kept = path.join(repo, ".current", "history", bucket(), "e999", "tasks.md");
  assert.ok(fs.existsSync(kept), `ledger missing from history; stdout=${r.stdout}`);
  assert.equal(fs.readFileSync(kept, "utf-8"), body, "byte-identical to the lane ledger");
  assert.ok(!fs.existsSync(lane), "worktree removed");
});

test("AC-E383-2-abandoned: finish --abandoned carries the lane ledger into primary history", async () => {
  const repo = makeIgnoredPrimary();
  const lane = startLane(repo, "e998", "abandon");
  await addRow(lane, "T-E998-01");
  const laneLedger = path.join(lane, ".current", "e998", "tasks.md");
  assert.ok(fs.existsSync(laneLedger));
  const body = fs.readFileSync(laneLedger, "utf-8");

  const r = runFinish(repo, ["e998", "--abandoned"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const kept = path.join(repo, ".current", "history", bucket(), "e998", "tasks.md");
  assert.ok(fs.existsSync(kept), `ledger missing from history; stdout=${r.stdout}`);
  assert.equal(fs.readFileSync(kept, "utf-8"), body);
});

test("AC-E383-3: legacy primary fallback unchanged — primary checkout on main and on a feat branch writes .current/tasks.md, advisory present", async () => {
  for (const branch of ["main", "feat/e998-y"]) {
    const repo = makeIgnoredPrimary("e383-ac3-");
    if (branch !== "main") git(repo, ["checkout", "-q", "-b", branch]);
    assert.ok(fs.statSync(path.join(repo, ".git")).isDirectory(), ".git is a directory in primary");

    const added = await addRow(repo);
    assert.equal(
      fs.realpathSync(added.path),
      fs.realpathSync(path.join(repo, ".current", "tasks.md")),
      `${branch}: ${JSON.stringify(added)}`,
    );
    assert.ok(!fs.existsSync(path.join(repo, ".current", "e998")), `${branch}: no lane dir created`);
    assert.ok(!fs.existsSync(path.join(repo, ".current", "_primary", "tasks.md")), `${branch}: no _primary ledger`);

    const next = JSON.parse(getNextTaskFromFile(repo));
    assert.ok(next.advisory, `${branch}: ignored-lane advisory must be present`);
    assert.match(next.advisory, /is git-ignored in this workspace/);
  }
});

test("AC-E383-4: linked lane worktree WITH a legacy file keeps the legacy ledger (read + write), advisory present", async () => {
  const repo = makeIgnoredPrimary();
  const wt = addWorktree(repo, "feat/e997-z");
  fs.mkdirSync(path.join(wt, ".current"), { recursive: true });
  const legacy = path.join(wt, ".current", "tasks.md");
  fs.writeFileSync(legacy, "## Active\n\n- [ ] T-E997-01 legacy row\n");

  const next = JSON.parse(getNextTaskFromFile(wt));
  assert.equal(nextId(next), "T-E997-01", JSON.stringify(next));
  assert.ok(next.advisory, "advisory present");

  const added = await addRow(wt, "T-E997-02");
  assert.equal(fs.realpathSync(added.path), fs.realpathSync(legacy));
  assert.match(fs.readFileSync(legacy, "utf-8"), /T-E997-02/);
  assert.ok(!fs.existsSync(path.join(wt, ".current", "e997", "tasks.md")), "no lane ledger created");
});

test("AC-E383-5: linked worktree on a non-feat branch (_primary lane) is unchanged — writes .current/tasks.md", async () => {
  const repo = makeIgnoredPrimary();
  const wt = addWorktree(repo, "scratch-branch");
  const added = await addRow(wt);
  assert.equal(fs.realpathSync(added.path), fs.realpathSync(path.join(wt, ".current", "tasks.md")), JSON.stringify(added));
  assert.ok(!fs.existsSync(path.join(wt, ".current", "_primary", "tasks.md")));
});

test("AC-E383-7: lane-protocol §3 holds doc.s3-ledger exactly once, directly after the E196 known-gaps line", () => {
  const lines = fs.readFileSync(path.join(PROJECT_ROOT, "docs", "lane-protocol.md"), "utf-8").split("\n");
  const head = "  - task 帳本（E383）：`.current/<lane>/` 被 ignore 時，linked worktree 裡的 lane 只要";
  const idx = lines.flatMap((l, i) => (l.startsWith(head) ? [i] : []));
  assert.equal(idx.length, 1, "doc.s3-ledger appears exactly once");
  assert.match(lines[idx[0] - 1], /^ {2}- 已知缺口：E196/, "directly after the E196 line");
  assert.ok(lines[idx[0]].includes("它若被 ignore，lane 在收工回報前把它移到 `.current/<lane>/tasks.md`。"), "full line tail present");
  assert.ok(lines[idx[0]].includes("`tw_get_next_task` 的 advisory 會點名它"));
});
