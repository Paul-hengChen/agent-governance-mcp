// Coded by @qa-engineer
// E225 / E353 (T-E196-05): `agc check` reports malformed `pending-ticket` blocks while the lane
// is still open, and the orphan-lane advisory never goes silent on a branch whose findings are
// all malformed. Spec: specs/e196-agc-init-lane-checks.md (AC-E225-1..4). Why: finish refuses a
// malformed block only after the lane has merged, costing a second lane commit and merge; and a
// malformed-only file used to read as "no unapplied findings", dropping them without a warning.
// Every fixture is a temp repo; expected error text comes from the parser, not a literal.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parsePendingTickets } from "../dist/tools/lane-ticket-allocation.js";

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
const agc = (cwd, args) => spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};

const LANE = "e25";
const BRANCH = "feat/e25-x";
const PEND = `.current/${LANE}/pending-tickets.md`;

function makeRepo({ adapters = false } = {}) {
  const r = mkTmp("e225-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  if (adapters) {
    const i = agc(r, ["init"]);
    assert.equal(i.status, 0, i.stderr);
  }
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  return r;
}
function startLane(repo) {
  const lane = path.join(mkTmp("e225-lane-"), "lane");
  const s = agc(repo, ["feature", "start", "e25-x", "--path", lane]);
  assert.equal(s.status, 0, s.stderr);
  return lane;
}

const GOOD = "```pending-ticket\nlane_local_id: L1\ntitle: good one\npriority: P3\ndepends_on: []\nbody: |\n  b\n```\n";
// One YAML-invalid block and one block missing `title`: two distinct parser errors.
const BAD_YAML = "```pending-ticket\nlane_local_id: B1\ntitle: [unclosed\npriority: P3\n```\n";
const NO_TITLE = "```pending-ticket\nlane_local_id: B2\npriority: P3\ndepends_on: []\nbody: |\n  b\n```\n";
const MALFORMED = BAD_YAML + "\n" + NO_TITLE;

const parserErrors = (text) => parsePendingTickets(text, LANE, { appliedLaneLocalIds: new Set() }).errors;
const countOf = (hay, needle) => hay.split(needle).length - 1;
const LANE_HEAD = "agc check — warning: .current/e25/pending-tickets.md has";
const ORPHAN_ERR_HEAD = "malformed pending-ticket block(s) — agc feature finish will refuse it until they are fixed:";

test("fixture sanity: the malformed file yields exactly two parser errors", () => {
  assert.equal(parserErrors(MALFORMED).length, 2);
  assert.equal(parserErrors(GOOD).length, 0);
});

test("AC-E225-1: in a linked lane worktree, one head line then one item per parser error, verbatim and in order", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  writeFile(path.join(lane, PEND), MALFORMED);
  const r = agc(lane, ["check"]);
  const errs = parserErrors(MALFORMED);
  assert.equal(countOf(r.stderr, LANE_HEAD), 1, r.stderr);
  assert.ok(
    r.stderr.includes(
      `${LANE_HEAD} ${errs.length} problem(s) that agc feature finish will refuse — fix them on this branch before the lane report:\n`,
    ),
    r.stderr,
  );
  const items = errs.map((e) => `  ${e}\n`).join("");
  assert.ok(r.stderr.includes(items), `items verbatim and in parser order: ${r.stderr}`);
  assert.ok(r.stderr.indexOf(LANE_HEAD) < r.stderr.indexOf(items), "head precedes items");
});

test("AC-E225-2: silent when the file is absent, clean, in the primary checkout, or in a lane-less worktree", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  // absent
  assert.equal(countOf(agc(lane, ["check"]).stderr, "pending-tickets.md has"), 0);
  // clean
  writeFile(path.join(lane, PEND), GOOD);
  assert.equal(countOf(agc(lane, ["check"]).stderr, "pending-tickets.md has"), 0);
  // primary checkout (not a linked worktree), even with a malformed file at the lane path
  writeFile(path.join(repo, PEND), MALFORMED);
  const p = agc(repo, ["check"]);
  assert.equal(countOf(p.stderr, "pending-tickets.md has"), 0, p.stderr);
  // linked worktree whose branch names no lane
  const wt = path.join(mkTmp("e225-nolane-"), "wt");
  git(repo, ["worktree", "add", "-q", "-b", "scratch", wt]);
  writeFile(path.join(wt, ".current", "scratch", "pending-tickets.md"), MALFORMED);
  writeFile(path.join(wt, ".current", "pending-tickets.md"), MALFORMED);
  const w = agc(wt, ["check"]);
  assert.equal(countOf(w.stderr, "pending-tickets.md has"), 0, w.stderr);
});

test("AC-E225-3: advisory never changes the exit code (malformed file + current adapters -> exit 0)", () => {
  const repo = makeRepo({ adapters: true });
  const lane = startLane(repo);
  const clean = agc(lane, ["check"]);
  assert.equal(clean.status, 0, `baseline must be 0: ${clean.stderr}`);
  writeFile(path.join(lane, PEND), MALFORMED);
  const r = agc(lane, ["check"]);
  assert.equal(countOf(r.stderr, LANE_HEAD), 1, r.stderr);
  assert.equal(r.status, 0, r.stderr);
});

test("AC-E225-4: orphan branch with a malformed-only file: unchanged orphan line, then error head + items", () => {
  const repo = makeRepo();
  const lane = startLane(repo);
  writeFile(path.join(lane, PEND), MALFORMED);
  git(lane, ["add", "-f", PEND]);
  git(lane, ["commit", "-qm", "pending"]);
  git(repo, ["worktree", "remove", "--force", lane]);
  const r = agc(repo, ["check"]);
  const orphan =
    `agc check — warning: branch ${BRANCH} carries an unapplied pending-tickets file ` +
    `with no live worktree — findings may be stranded; re-attach it ` +
    `(\`git worktree add <dir> ${BRANCH}\`) and run \`agc feature finish --abandoned ` +
    `${LANE}\` to apply and retire it, or investigate why the worktree is gone\n`;
  const errs = parserErrors(MALFORMED);
  const errBlock =
    `agc check — warning: branch ${BRANCH}'s ${PEND} has ${errs.length} ${ORPHAN_ERR_HEAD}\n` +
    errs.map((e) => `  ${e}\n`).join("");
  assert.ok(r.stderr.includes(orphan + errBlock), `orphan line immediately followed by the errors: ${r.stderr}`);
});

test("AC-E225-4: valid unapplied entries print no error block; a branch with a live worktree is never reported", () => {
  const valid = makeRepo();
  const vLane = startLane(valid);
  writeFile(path.join(vLane, PEND), GOOD);
  git(vLane, ["add", "-f", PEND]);
  git(vLane, ["commit", "-qm", "pending"]);
  const live = agc(valid, ["check"]);
  assert.equal(countOf(live.stderr, "unapplied pending-tickets file"), 0, "live worktree: never reported");
  git(valid, ["worktree", "remove", "--force", vLane]);
  const gone = agc(valid, ["check"]);
  assert.equal(countOf(gone.stderr, "unapplied pending-tickets file"), 1, gone.stderr);
  assert.equal(countOf(gone.stderr, ORPHAN_ERR_HEAD), 0, gone.stderr);
});
