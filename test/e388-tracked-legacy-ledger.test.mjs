// Coded by @qa-engineer
// Tests (T-E381-06) for specs/e381-fanout-and-ledger-fixes.md AC-E388-1..5 (D-E388): in a repo that git-ignores
// `.current/` but COMMITS a team `TODO.md` / root `tasks.md`, a linked lane worktree must not adopt that tracked team
// file as its `tw_*` ledger (the lane's rows would be written into, and committed with, a team file). The lane ledger
// .current/<lane>/tasks.md is used instead. Only tracked candidates are skipped; primary checkouts and the `_primary`
// lane keep today's resolution. AC-E388-6 is the unedited e125a / e383 suites. Fixtures are real `git init` +
// `git worktree add` repos in os.tmpdir() (the test/e383-lane-ledger-worktree.test.mjs pattern).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { addTaskInFile, getNextTaskFromFile } from "../dist/tools/tasks-file.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

setActiveStorage(new FileHandoffStorage());

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) fs.rmSync(d, { recursive: true, force: true });
});

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

const TODO_BODY = "# Team TODO\n\n- [ ] ship the thing\n";
const TASKS_BODY = "# Team tasks\n\n- [ ] team row\n";

/** A primary on `main` that ignores `.current/` and commits the named team files (plus `extraIgnore` lines). */
function makeRepo({ files, extraIgnore = "" }) {
  const repo = mkTmp("e388-primary-");
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  fs.writeFileSync(path.join(repo, ".gitignore"), `/.current/\n${extraIgnore}`);
  fs.writeFileSync(path.join(repo, "README.md"), "# fixture\n");
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(repo, name), body);
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "init"]);
  return repo;
}

function addWorktree(repo, branch) {
  const wt = path.join(mkTmp("e388-wt-"), "lane");
  git(repo, ["worktree", "add", "-q", "-b", branch, wt]);
  return wt;
}

const addRow = async (ws, id, desc = "lane row") => JSON.parse(await addTaskInFile(ws, id, desc));
const real = (p) => fs.realpathSync(p);

async function assertLaneLedgerUsed(wt, lane, id, teamFiles) {
  const laneLedger = path.join(wt, ".current", lane, "tasks.md");
  const added = await addRow(wt, id);
  assert.equal(real(added.path), real(laneLedger), JSON.stringify(added));
  assert.match(fs.readFileSync(laneLedger, "utf-8"), new RegExp(id));
  for (const [name, body] of Object.entries(teamFiles)) {
    assert.equal(fs.readFileSync(path.join(wt, name), "utf-8"), body, `${name} must stay byte-identical`);
  }
  assert.equal(git(wt, ["status", "--porcelain"]).trim(), "", "the worktree stays clean: no team file touched, lane ledger is ignored");
  const next = JSON.parse(getNextTaskFromFile(wt));
  assert.equal(next.next?.id, id, JSON.stringify(next));
  assert.ok(!("advisory" in next), "no ignored-lane advisory once the lane ledger is the ledger");
}

test("AC-E388-1 tracked TODO.md is skipped: the row lands in .current/e996/tasks.md, TODO.md untouched, worktree clean", async () => {
  // WHY: the lane's agc rows must never be written into, or committed with, the team's own TODO.md.
  const repo = makeRepo({ files: { "TODO.md": TODO_BODY } });
  const wt = addWorktree(repo, "feat/e996-q");
  await assertLaneLedgerUsed(wt, "e996", "T-E996-01", { "TODO.md": TODO_BODY });
});

test("AC-E388-2 tracked root tasks.md is skipped, alone and together with a tracked TODO.md", async () => {
  const onlyTasks = makeRepo({ files: { "tasks.md": TASKS_BODY } });
  await assertLaneLedgerUsed(addWorktree(onlyTasks, "feat/e996-q"), "e996", "T-E996-01", { "tasks.md": TASKS_BODY });

  const both = makeRepo({ files: { "tasks.md": TASKS_BODY, "TODO.md": TODO_BODY } });
  await assertLaneLedgerUsed(addWorktree(both, "feat/e996-q"), "e996", "T-E996-02", {
    "tasks.md": TASKS_BODY,
    "TODO.md": TODO_BODY,
  });
});

test("AC-E388-3 only tracked candidates are skipped: an ignored, untracked TODO.md is still the ledger and the advisory names it", async () => {
  // WHY: E383 AC-E383-4 contract — an ignored legacy file is the lane's own scratch ledger, not a team file.
  const repo = makeRepo({ files: { "tasks.md": TASKS_BODY }, extraIgnore: "/TODO.md\n" });
  const wt = addWorktree(repo, "feat/e996-q");
  const todo = path.join(wt, "TODO.md");
  fs.writeFileSync(todo, "# Local\n\n- [ ] T-E996-09 local row\n");

  const next = JSON.parse(getNextTaskFromFile(wt));
  assert.equal(next.next?.id, "T-E996-09", JSON.stringify(next));
  assert.ok(next.advisory, "advisory present");
  assert.match(next.advisory, /TODO\.md/);

  const added = await addRow(wt, "T-E996-10");
  assert.equal(real(added.path), real(todo), JSON.stringify(added));
  assert.match(fs.readFileSync(todo, "utf-8"), /T-E996-10/);
  assert.equal(fs.readFileSync(path.join(wt, "tasks.md"), "utf-8"), TASKS_BODY, "tracked tasks.md untouched");
  assert.ok(!fs.existsSync(path.join(wt, ".current", "e996", "tasks.md")), "no lane ledger created");
});

test("AC-E388-4 primary checkout is unchanged, on main and on a feat branch: writes TODO.md, ignored-lane advisory names it", async () => {
  // WHY: the skip is scoped to linked lane worktrees; a primary checkout keeps the E125a option-A behaviour.
  for (const branch of ["main", "feat/e995-p"]) {
    const repo = makeRepo({ files: { "TODO.md": TODO_BODY } });
    if (branch !== "main") git(repo, ["checkout", "-q", "-b", branch]);
    const added = await addRow(repo, "T-E995-01");
    assert.equal(real(added.path), real(path.join(repo, "TODO.md")), `${branch}: ${JSON.stringify(added)}`);
    assert.match(fs.readFileSync(path.join(repo, "TODO.md"), "utf-8"), /T-E995-01/);
    const next = JSON.parse(getNextTaskFromFile(repo));
    assert.ok(next.advisory, `${branch}: advisory present`);
    assert.match(next.advisory, /is git-ignored in this workspace/);
    assert.match(next.advisory, /TODO\.md/);
  }
});

test("AC-E388-5 the _primary lane in a linked worktree (non-feat branch) is unchanged: writes TODO.md", async () => {
  const repo = makeRepo({ files: { "TODO.md": TODO_BODY } });
  const wt = addWorktree(repo, "scratch-branch");
  const added = await addRow(wt, "T-E994-01");
  assert.equal(real(added.path), real(path.join(wt, "TODO.md")), JSON.stringify(added));
  assert.match(fs.readFileSync(path.join(wt, "TODO.md"), "utf-8"), /T-E994-01/);
  assert.ok(!fs.existsSync(path.join(wt, ".current", "_primary", "tasks.md")));
});
