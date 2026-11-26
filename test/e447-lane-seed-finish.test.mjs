// Coded by @qa-engineer
// E447 (T-E447-01): with "knowledge": "local", `agc feature start` seeds a lane with a snapshot of the
// primary checkout's untracked knowledge files (hashes recorded in .current/<lane>/knowledge-seed.json),
// and `agc feature finish` brings back only what the lane created or changed, to the same path
// (--shipped) or under <dir>/abandoned/<lane>/ (--abandoned), and numbers worktree-only findings into
// the primary checkout's untracked docs/backlog.md. Spec: specs/e447-local-knowledge-files.md AC3-AC8
// (Fix 2-4, D5, D6, O3 (a)). Fixtures are scratch git repos under os.tmpdir(); "mode on" is built by
// hand (config keys + the exclude rules init would write) so these tests do not depend on agc init.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
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
const gitCode = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf-8" }).status;
const feature = (cwd, args) => spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const read = (abs) => fs.readFileSync(abs);
const sha = (buf) => "sha256:" + crypto.createHash("sha256").update(buf).digest("hex");
const porcelain = (repo) => git(repo, ["status", "--porcelain", "--untracked-files=all"]);
const bucket = () => {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
};
const outLines = (s) => s.split("\n");

// The rules `agc init --artifacts=local --knowledge=local` writes for a root workspace.
const MODE_ON_EXCLUDE = [
  "/.current/", "/tasks.md", "/qa_reports/", "/review_reports/",
  "/specs/", "/design/", "/research/", "/docs/tickets/", "/docs/backlog.md",
];
const MODE_ON_CONFIG = JSON.stringify({ schema_version: 2, artifacts: "local", knowledge: "local" }, null, 2) + "\n";

const BACKLOG = "# B\n\n| id | desc | priority | status |\n|---|---|---|---|\n| E10 | x | P2 | open |\n";
// The five untracked knowledge files of AC3, one per knowledge path.
const FIVE = {
  "docs/tickets/t1.md": "# t1\n\nscenario one\n",
  "docs/backlog.md": BACKLOG,
  "specs/s1.md": "# s1 spec\n",
  "design/d1.md": "# d1 design\n",
  "research/r1.md": "# r1 research\n",
};
const PENDING =
  "```pending-ticket\nlane_local_id: L1\ntitle: found in lane\npriority: P3\ndepends_on: []\nbody: |\n  b\n```\n";

// Mode-on primary checkout on main. `tracked`: committed files (force-added past the rules);
// `knowledge`: untracked files written after the commit.
function makeModeOnRepo({ tracked = {}, knowledge = FIVE } = {}) {
  const r = mkTmp("e447-lane-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  fs.appendFileSync(path.join(r, ".git", "info", "exclude"), MODE_ON_EXCLUDE.join("\n") + "\n");
  for (const [rel, body] of Object.entries(tracked)) writeFile(path.join(r, rel), body);
  git(r, ["add", "-A"]);
  if (Object.keys(tracked).length > 0) git(r, ["add", "-f", "--", ...Object.keys(tracked)]);
  git(r, ["commit", "-qm", "init"]);
  writeFile(path.join(r, ".current", ".config.json"), MODE_ON_CONFIG);
  for (const [rel, body] of Object.entries(knowledge)) writeFile(path.join(r, rel), body);
  return r;
}

// Lane "e9" on branch feat/e9-x.
function startLane(repo) {
  const lane = path.join(mkTmp("e447-lane-"), "lane");
  const res = feature(repo, ["start", "e9-x", "--path", lane]);
  return { res, lane, seedPath: path.join(lane, ".current", "e9", "knowledge-seed.json") };
}
function startOk(repo) {
  const s = startLane(repo);
  assert.equal(s.res.status, 0, s.res.stdout + s.res.stderr);
  return s;
}
const readSeed = (seedPath) => JSON.parse(fs.readFileSync(seedPath, "utf-8"));

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

const harvestLine = (src, dst) =>
  `agc feature finish — harvested knowledge file ${src} -> primary ${dst} ` +
  `(fs copy, not committed — the lane created or changed it)`;
const unchangedLine = (n) =>
  `agc feature finish — ${n} seeded knowledge file(s) unchanged in the lane — not copied back`;
const numberedLine = (ids) =>
  `agc feature finish — appended ${ids} to docs/backlog.md in the primary checkout ` +
  `(not committed — knowledge files stay out of git)`;
const backlogRows = (repo) =>
  fs.readFileSync(path.join(repo, "docs", "backlog.md"), "utf-8").split("\n").filter((l) => /^\| E\d+[A-Za-z]* /.test(l));

// ============================================================================
// AC3 (acceptance b, Fix 2): the lane sees the primary checkout's knowledge, byte-identical, with a
// hash record of exactly what was seeded, and the lane stays clean (finish refuses a dirty lane).
// ============================================================================

test("AC3: start seeds all five knowledge files byte-identical, records exactly their hashes, lane clean, e447.start-seeded with 5", () => {
  const repo = makeModeOnRepo();
  const { res, lane, seedPath } = startOk(repo);
  for (const rel of Object.keys(FIVE)) {
    const laneAbs = path.join(lane, rel);
    assert.ok(fs.existsSync(laneAbs), `lane has ${rel}`);
    assert.ok(read(laneAbs).equals(read(path.join(repo, rel))), `${rel} byte-identical`);
  }
  const seed = readSeed(seedPath);
  assert.equal(seed.version, 1);
  const expected = {};
  for (const rel of Object.keys(FIVE).sort()) expected[rel] = sha(Buffer.from(FIVE[rel]));
  assert.deepEqual(seed.files, expected, "exactly the five paths, sha256:<hex> each");
  assert.deepEqual(Object.keys(seed.files), Object.keys(seed.files).slice().sort(), "keys sorted (D4)");
  assert.equal(porcelain(lane), "", "seeded copies are ignored in the lane");
  assert.ok(
    outLines(res.stdout).includes(
      "agc feature start — copied 5 knowledge file(s) from the primary checkout " +
        "(a snapshot; content hashes recorded in .current/e9/knowledge-seed.json)"
    ),
    res.stdout
  );
});

// ============================================================================
// AC4 (Fix 2, D5): tracked paths come from the checkout, never from the primary working copy; a
// dangling symlink is skipped with a warning; a resolving one is copied as its target's bytes.
// ============================================================================

test("AC4: a tracked knowledge path is neither overwritten nor recorded; a dangling design/ symlink is skipped with e447.start-dangling", () => {
  const COMMITTED = "# tracked spec (committed)\n";
  const repo = makeModeOnRepo({
    tracked: { "specs/tracked.md": COMMITTED },
    knowledge: { "design/d1.md": "# d1\n" },
  });
  writeFile(path.join(repo, "specs", "tracked.md"), "# tracked spec (primary working-copy edit)\n");
  fs.symlinkSync("missing-target.md", path.join(repo, "design", "dangle.md"));
  fs.symlinkSync("d1.md", path.join(repo, "design", "link.md"));

  const { res, lane, seedPath } = startOk(repo);
  assert.equal(fs.readFileSync(path.join(lane, "specs", "tracked.md"), "utf-8"), COMMITTED, "the checkout's bytes stand");
  const seed = readSeed(seedPath);
  assert.ok(!("specs/tracked.md" in seed.files), "a tracked path is never recorded");
  assert.ok(!("design/dangle.md" in seed.files), "a skipped symlink is never recorded");
  assert.ok(
    res.stderr.includes(
      "agc feature start — warning: design/dangle.md in the primary checkout is a symlink that does not " +
        "resolve — not copied into the lane"
    ),
    res.stderr
  );
  assert.equal(fs.existsSync(path.join(lane, "design", "dangle.md")), false);
  // D5: a resolving symlink is copied as its target's bytes (a regular file in the lane).
  const linkSt = fs.lstatSync(path.join(lane, "design", "link.md"));
  assert.ok(linkSt.isFile() && !linkSt.isSymbolicLink(), "copied as a regular file");
  assert.equal(fs.readFileSync(path.join(lane, "design", "link.md"), "utf-8"), "# d1\n");
  assert.equal(seed.files["design/link.md"], sha(Buffer.from("# d1\n")));
  assert.equal(seed.files["design/d1.md"], sha(Buffer.from("# d1\n")));
  assert.equal(porcelain(lane), "");
});

// ============================================================================
// AC5 (acceptance c, Fix 3, O3 (a)): only created/changed files come back, to the same path; unchanged
// seeded copies are discarded so a primary edit made meanwhile survives; no archive/<lane>/ for
// knowledge dirs.
// ============================================================================

test("AC5: finish --shipped copies the lane's new design/x.md and research/y.md to the same paths, keeps the primary's newer backlog, copies no unchanged seed", () => {
  const repo = makeModeOnRepo();
  const { lane } = startOk(repo);
  const ADDED_ROW = "| E20 | added in primary after the lane started | P2 | open |\n";
  fs.appendFileSync(path.join(repo, "docs", "backlog.md"), ADDED_ROW);
  const backlogAfterAppend = read(path.join(repo, "docs", "backlog.md"));
  writeFile(path.join(lane, "design", "x.md"), "# x from the lane\n");
  writeFile(path.join(lane, "research", "y.md"), "# y from the lane\n");
  const xBytes = read(path.join(lane, "design", "x.md"));
  const yBytes = read(path.join(lane, "research", "y.md"));

  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.ok(read(path.join(repo, "design", "x.md")).equals(xBytes));
  assert.ok(read(path.join(repo, "research", "y.md")).equals(yBytes));
  const out = outLines(res.stdout);
  assert.ok(out.includes(harvestLine("design/x.md", "design/x.md")), res.stdout);
  assert.ok(out.includes(harvestLine("research/y.md", "research/y.md")), res.stdout);
  assert.ok(read(path.join(repo, "docs", "backlog.md")).equals(backlogAfterAppend), "the primary's appended row survives");
  assert.ok(out.includes(unchangedLine(5)), res.stdout);
  for (const dir of ["specs", "design", "research", "docs/tickets", "docs"]) {
    assert.equal(fs.existsSync(path.join(repo, dir, "archive", "e9")), false, `no ${dir}/archive/e9/`);
  }
  for (const [rel, body] of Object.entries(FIVE)) {
    if (rel === "docs/backlog.md") continue;
    assert.equal(fs.readFileSync(path.join(repo, rel), "utf-8"), body, `${rel} untouched in the primary`);
  }
  assert.equal(porcelain(repo), "");
  assert.equal(fs.existsSync(lane), false, "worktree removed");
});

// ============================================================================
// AC6 (Fix 3, O3 (a)): a lane-changed seeded file overwrites the primary copy only when the primary
// copy still has the seeded bytes; when both sides changed, finish refuses before any mutation.
// ============================================================================

test("AC6 overwrite: a lane-appended docs/tickets/t1.md replaces the primary copy that still has the seeded bytes", () => {
  const repo = makeModeOnRepo();
  const { lane } = startOk(repo);
  assert.ok(fs.existsSync(path.join(lane, "docs", "tickets", "t1.md")), "precondition: start seeded the ticket file");
  fs.appendFileSync(path.join(lane, "docs", "tickets", "t1.md"), "\n## Added during build\n\nscenario two\n");
  const laneBytes = read(path.join(lane, "docs", "tickets", "t1.md"));

  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.ok(read(path.join(repo, "docs", "tickets", "t1.md")).equals(laneBytes));
  const out = outLines(res.stdout);
  assert.ok(out.includes(harvestLine("docs/tickets/t1.md", "docs/tickets/t1.md")), res.stdout);
  assert.ok(out.includes(unchangedLine(4)), res.stdout);
  assert.equal(fs.existsSync(path.join(repo, "docs", "tickets", "archive")), false);
});

test("AC6 both changed: the primary copy was edited too -> non-zero exit, e180 refuse line naming it, nothing removed or changed", () => {
  const repo = makeModeOnRepo();
  const { lane } = startOk(repo);
  assert.ok(fs.existsSync(path.join(lane, "docs", "tickets", "t1.md")), "precondition: start seeded the ticket file");
  fs.appendFileSync(path.join(lane, "docs", "tickets", "t1.md"), "\nlane edit\n");
  fs.appendFileSync(path.join(repo, "docs", "tickets", "t1.md"), "\nprimary edit\n");
  writeFile(path.join(lane, "design", "new.md"), "# new in lane\n");
  const primaryBefore = snapshotTree(repo);
  const laneBefore = snapshotTree(lane);
  const headBefore = git(repo, ["rev-parse", "HEAD"]);

  const res = feature(repo, ["finish", "e9", "--shipped"]);
  assert.notEqual(res.status, 0, res.stdout);
  assert.ok(
    res.stderr.includes(
      "agc feature finish --shipped: harvest destination already exists in the primary checkout and differs (nothing moved):\n"
    ),
    res.stderr
  );
  assert.ok(
    outLines(res.stderr).some((l) => l.startsWith("  ") && l.endsWith("docs/tickets/t1.md")),
    `the refusal names the path: ${res.stderr}`
  );
  assert.ok(fs.existsSync(lane), "worktree kept");
  assert.equal(gitCode(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e9-x"]), 0, "branch kept");
  assert.deepEqual(snapshotTree(repo), primaryBefore, "primary files unchanged (nothing copied, no history written)");
  assert.deepEqual(snapshotTree(lane), laneBefore, "lane files unchanged");
  assert.equal(git(repo, ["rev-parse", "HEAD"]), headBefore, "no commit");
});

// ============================================================================
// AC7 (acceptance d, Fix 4): a worktree-only pending-tickets.md is numbered into the primary
// checkout's untracked backlog, with no commit, and a re-run allocates nothing new.
// ============================================================================

test("AC7: finish --shipped numbers the worktree pending block into the untracked backlog (no commit, history under ## Applied, no E287 warning); a re-run allocates nothing new", () => {
  // Plain run.
  {
    const repo = makeModeOnRepo();
    const { lane } = startOk(repo);
    writeFile(path.join(lane, ".current", "e9", "pending-tickets.md"), PENDING);
    const logBefore = git(repo, ["log", "--format=%H", "main"]);
    assert.equal(porcelain(repo), "");

    const res = feature(repo, ["finish", "e9", "--shipped"]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const rows = backlogRows(repo);
    assert.equal(rows.length, 2, rows.join("\n"));
    assert.match(rows[1], /^\| E11 \|/);
    assert.ok(rows[1].includes("(filed by lane `e9` as `L1`)"), rows[1]);
    assert.equal(porcelain(repo), "", "git status unchanged");
    assert.equal(git(repo, ["log", "--format=%H", "main"]), logBefore, "git log unchanged: nothing committed");

    const hist = path.join(repo, ".current", "history", bucket(), "e9", "pending-tickets.md");
    assert.ok(fs.existsSync(hist), "history copy kept");
    const histText = fs.readFileSync(hist, "utf-8");
    assert.ok(histText.includes("## Applied"), histText);
    assert.match(histText.split("## Applied")[1], /lane_local_id: L1/, "the block sits under ## Applied");

    const out = outLines(res.stdout);
    const i = out.indexOf(numberedLine("E11"));
    assert.ok(i >= 0, res.stdout);
    assert.equal(out[i + 1], "agc feature finish — applied 1 pending ticket(s): E11", "followed by the existing applied line");
    assert.doesNotMatch(res.stderr, /were not allocated/, "the E287 warning is not printed");
  }
  // Forced late failure (an untracked, non-ignored file blocks `git worktree remove`), then re-run.
  {
    const repo = makeModeOnRepo();
    const { lane } = startOk(repo);
    writeFile(path.join(lane, ".current", "e9", "pending-tickets.md"), PENDING);
    writeFile(path.join(lane, "blocker.txt"), "x\n");
    const first = feature(repo, ["finish", "e9", "--shipped"]);
    assert.notEqual(first.status, 0, "forced late failure");
    assert.equal(backlogRows(repo).length, 2, "numbered before teardown");
    fs.rmSync(path.join(lane, "blocker.txt"));

    const rerun = feature(repo, ["finish", "e9", "--shipped"]);
    assert.equal(rerun.status, 0, rerun.stdout + rerun.stderr);
    const rows = backlogRows(repo);
    assert.equal(rows.length, 2, `allocated exactly once:\n${rows.join("\n")}`);
    assert.equal(rows.filter((r) => r.includes("(filed by lane `e9` as `L1`)")).length, 1);
    assert.doesNotMatch(first.stderr + rerun.stderr, /were not allocated/);
    assert.equal(fs.existsSync(lane), false);
  }
});

// ============================================================================
// AC8 (D6): --abandoned uses the same seed-record filter; created/changed files go to
// <dir>/abandoned/<lane>/<path>; unchanged seeded specs are not copied; findings are numbered.
// ============================================================================

test("AC8: finish --abandoned harvests design/z.md to design/abandoned/e9/z.md, nothing under specs/abandoned/e9/, and numbers the pending finding", () => {
  const repo = makeModeOnRepo();
  const { lane } = startOk(repo);
  writeFile(path.join(lane, "design", "z.md"), "# z from the abandoned lane\n");
  const zBytes = read(path.join(lane, "design", "z.md"));
  writeFile(path.join(lane, ".current", "e9", "pending-tickets.md"), PENDING);

  const res = feature(repo, ["finish", "e9", "--abandoned"]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.ok(read(path.join(repo, "design", "abandoned", "e9", "z.md")).equals(zBytes));
  assert.equal(fs.existsSync(path.join(repo, "design", "z.md")), false, "never at its own path on --abandoned");
  assert.equal(fs.existsSync(path.join(repo, "specs", "abandoned", "e9")), false, "unchanged seeded specs are not copied out");
  const out = outLines(res.stdout);
  assert.ok(out.includes(harvestLine("design/z.md", "design/abandoned/e9/z.md")), res.stdout);
  assert.ok(out.includes(unchangedLine(5)), res.stdout);

  const rows = backlogRows(repo);
  assert.equal(rows.length, 2, rows.join("\n"));
  assert.match(rows[1], /^\| E11 \|/);
  assert.ok(rows[1].includes("(filed by lane `e9` as `L1`)"));
  assert.ok(out.includes(numberedLine("E11")), res.stdout);
  assert.doesNotMatch(res.stderr, /were not allocated/);
  assert.equal(gitCode(repo, ["show-ref", "--verify", "--quiet", "refs/heads/feat/e9-x"]), 0, "--abandoned keeps the branch");
  assert.equal(porcelain(repo), "");
});
