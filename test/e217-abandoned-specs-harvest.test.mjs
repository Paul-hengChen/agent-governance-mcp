// Coded by @qa-engineer
// E217 (T-E217-03): `agc feature finish <ticket> --abandoned` copies a lane's git-ignored, unlinked
// `specs/` files into the primary checkout before `git worktree remove`, the way E180 does for
// qa_reports/ and review_reports/. Spec: specs/e217-lane-lifecycle-gaps.md (AC-E217-1..9, 12;
// AC-E217-10/11 are the unmodified e213 / e180 suites). Every fixture repository is built in
// os.tmpdir() at runtime; nothing here reads the real repo's specs/ or diffs against a fixed sha.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;

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
const gitStatus = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf-8" }).status;
const feature = (cwd, args) =>
  spawnSync(process.execPath, [AGC_INIT, "feature", ...args], { cwd, encoding: "utf-8" });
const branchExists = (repo, branch) =>
  gitStatus(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]) === 0;
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const exists = (p) => {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
};
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Primary repo. `gitignore` defaults to ignoring specs/ and the evidence dirs (the "all-ignored" shape).
function makePrimary({ gitignore = "/specs/\nqa_reports/\nreview_reports/\n", backlog = false } = {}) {
  const r = mkTmp("e217-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, ".gitignore"), gitignore);
  writeFile(path.join(r, "README.md"), "# scratch fixture\n");
  if (backlog) {
    writeFile(
      path.join(r, "docs", "backlog.md"),
      "# Backlog\n\n| id | desc | priority | depends_on | est. files | design-link |\n" +
        "|----|------|----------|------------|------------|-------------|\n| E1 | seed ticket | P2 | none | — | — |\n",
    );
  }
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  return r;
}

// Starts lane `<ticket>-x`; returns the lane path and branch.
function startLane(repo, ticket) {
  const lane = path.join(mkTmp(`e217-lane-${ticket}-`), "lane");
  const res = feature(repo, ["start", `${ticket}-x`, "--path", lane]);
  assert.equal(res.status, 0, res.stderr);
  return { lane, branch: `feat/${ticket}-x` };
}

const harvestLine = (src, dst) =>
  `agc feature finish — harvested git-ignored evidence ${src} -> primary ${dst} (fs copy, not committed — ` +
  `specs/ is git-ignored here and not linked outside the worktree, so \`git worktree remove\` would otherwise delete it silently)`;
const harvestLines = (s) =>
  s.split("\n").filter((l) => l.startsWith("agc feature finish — harvested git-ignored evidence specs/"));

function snapshot(repo, lane, branch) {
  const hist = path.join(repo, ".current", "history");
  const backlog = path.join(repo, "docs", "backlog.md");
  return {
    head: git(repo, ["rev-parse", `refs/heads/${branch}`]).trim(),
    backlog: exists(backlog) ? fs.readFileSync(backlog, "utf-8") : null,
    history: exists(hist) ? fs.readdirSync(hist) : null,
    laneExists: exists(lane),
  };
}

// ============================================================================
// AC-E217-1 — recursive, no token filter
// ============================================================================
test("AC-E217-1: git-ignored specs are copied recursively with no token filter, one harvest line each", () => {
  const t = "e217a";
  const repo = makePrimary();
  const { lane, branch } = startLane(repo, t);
  const files = {
    [`specs/${t}-feature.md`]: "feature spec\n",
    "specs/plan-without-id.md": "no ticket id in the name\n",
    [`specs/${t}-feature/notes/deep.md`]: "nested\n",
  };
  for (const [rel, body] of Object.entries(files)) writeFile(path.join(lane, rel), body);

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  for (const [rel, body] of Object.entries(files)) {
    const sub = rel.slice("specs/".length);
    const dst = path.join(repo, "specs", "abandoned", t, sub);
    assert.equal(fs.readFileSync(dst, "utf-8"), body, `${rel} must be byte-identical in primary`);
    assert.ok(r.stdout.includes(harvestLine(rel, `specs/abandoned/${t}/${sub}`)), `harvest line for ${rel}`);
  }
  assert.equal(harvestLines(r.stdout).length, 3, "exactly one line per file");
  assert.ok(!exists(lane), "worktree removed");
  assert.ok(branchExists(repo, branch), "branch kept");
});

// ============================================================================
// AC-E217-2 — tracked specs stay put (E73 D2)
// ============================================================================
test("AC-E217-2: a spec committed on the lane branch stays on the branch and gets no primary copy", () => {
  const t = "e217b";
  const repo = makePrimary();
  const { lane, branch } = startLane(repo, t);
  const rel = `specs/${t}-tracked.md`;
  writeFile(path.join(lane, rel), "tracked bytes\n");
  git(lane, ["add", "-f", "--", rel]);
  git(lane, ["commit", "-qm", "track spec"]);
  const head = git(repo, ["rev-parse", `refs/heads/${branch}`]).trim();

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(git(repo, ["show", `${branch}:${rel}`]), "tracked bytes\n");
  assert.equal(git(repo, ["rev-parse", `refs/heads/${branch}`]).trim(), head, "no new commit on the branch");
  const touching = git(repo, ["log", "--format=%H", `main..${branch}`, "--", "specs"]).trim().split("\n").filter(Boolean);
  assert.equal(touching.length, 1, "only the lane's own spec commit touched specs/");
  assert.ok(!exists(path.join(repo, "specs", "abandoned", t, `${t}-tracked.md`)), "no primary copy");
  assert.equal(harvestLines(r.stdout).length, 0);
});

// ============================================================================
// AC-E217-3 — specs linked outside the worktree: no copy
// ============================================================================
test("AC-E217-3: a specs symlink resolving outside the worktree is never copied", () => {
  const t = "e217c";
  const repo = makePrimary({ gitignore: "/specs\nqa_reports/\n" }); // no trailing slash: ignores a symlink too
  const { lane } = startLane(repo, t);
  const outside = mkTmp("e217-outside-specs-");
  writeFile(path.join(outside, `${t}-shared.md`), "shared outside\n");
  fs.symlinkSync(outside, path.join(lane, "specs"));

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!exists(path.join(repo, "specs", "abandoned")), "no specs/abandoned/ copy");
  assert.equal(harvestLines(r.stdout).length, 0);
  assert.ok(!/harvested git-ignored evidence specs\//.test(r.stdout), "no specs harvest output");
  assert.ok(exists(path.join(outside, `${t}-shared.md`)), "the linked target is untouched");
});

// ============================================================================
// AC-E217-4 / AC-E217-6 — refusals happen before any mutation
// ============================================================================
// A lane with a matching ignored qa file and a committed pending-tickets block, so a refusal that
// fired late would visibly move the qa file / append to the backlog / commit.
function mutationBaitLane(t) {
  const repo = makePrimary({ backlog: true });
  const { lane, branch } = startLane(repo, t);
  writeFile(path.join(lane, "qa_reports", `review_T-${t.toUpperCase()}-01.md`), "qa evidence\n");
  writeFile(
    path.join(lane, ".current", t, "pending-tickets.md"),
    "```pending-ticket\nlane_local_id: L-NEW-1\ntitle: A finding\npriority: P2\n```\n",
  );
  git(lane, ["add", `.current/${t}/pending-tickets.md`]);
  git(lane, ["commit", "-qm", "file a finding"]);
  return { repo, lane, branch };
}
function assertNothingMoved(repo, lane, branch, before, t) {
  assert.deepEqual(snapshot(repo, lane, branch), before, "head, backlog, history and worktree unchanged");
  assert.ok(exists(path.join(lane, "qa_reports", `review_T-${t.toUpperCase()}-01.md`)), "the lane's qa file stays in place");
  assert.ok(!exists(path.join(repo, "qa_reports", "abandoned")), "qa file not moved to primary");
  assert.ok(branchExists(repo, branch));
}

test("AC-E217-4: a differing primary destination refuses before any mutation, naming that path", () => {
  const t = "e217d";
  const { repo, lane, branch } = mutationBaitLane(t);
  writeFile(path.join(lane, "specs", "x.md"), "lane bytes\n");
  const dst = path.join(repo, "specs", "abandoned", t, "x.md");
  writeFile(dst, "DIFFERENT primary bytes\n");
  const before = snapshot(repo, lane, branch);

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.notEqual(r.status, 0);
  assert.ok(
    r.stderr.includes("agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs (nothing moved):"),
    r.stderr,
  );
  assert.match(r.stderr, new RegExp(`^  .*${escRe(path.join("specs", "abandoned", t, "x.md"))}$`, "m"));
  assert.equal(fs.readFileSync(dst, "utf-8"), "DIFFERENT primary bytes\n", "primary file untouched");
  assertNothingMoved(repo, lane, branch, before, t);
});

test("AC-E217-6: an at-risk dangling symlink refuses before any mutation, listing the path", () => {
  const t = "e217f";
  const { repo, lane, branch } = mutationBaitLane(t);
  fs.mkdirSync(path.join(lane, "specs"), { recursive: true });
  fs.symlinkSync("does-not-exist.md", path.join(lane, "specs", "broken.md"));
  const before = snapshot(repo, lane, branch);

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.notEqual(r.status, 0);
  assert.ok(
    r.stderr.includes("agc feature finish --abandoned: harvest of specs/ found unresolvable symlink(s) — refusing before any mutation (nothing moved):"),
    r.stderr,
  );
  assert.match(r.stderr, /^ {2}specs\/broken\.md$/m);
  assertNothingMoved(repo, lane, branch, before, t);
});

// ============================================================================
// AC-E217-5 — identical destination is idempotent; failed run + fixed re-run converges
// ============================================================================
test("AC-E217-5: an identical primary copy neither refuses nor copies again", () => {
  const t = "e217e";
  const repo = makePrimary();
  const { lane } = startLane(repo, t);
  writeFile(path.join(lane, "specs", "same.md"), "same bytes\n");
  writeFile(path.join(repo, "specs", "abandoned", t, "same.md"), "same bytes\n");

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /harvest destination already exists/);
  assert.equal(harvestLines(r.stdout).length, 0, "no copy, no harvest line");
  assert.equal(fs.readFileSync(path.join(repo, "specs", "abandoned", t, "same.md"), "utf-8"), "same bytes\n");
  assert.ok(!exists(lane));
});

test(
  "AC-E217-5: a run failing after the specs copy, then a fixed re-run, leaves exactly one primary copy per file",
  { skip: IS_ROOT && "chmod 000 does not block root" },
  () => {
    const t = "e217g";
    const repo = makePrimary({ gitignore: "/specs/\n.current/\n" });
    const { lane } = startLane(repo, t);
    writeFile(path.join(lane, "specs", "one.md"), "one\n");
    writeFile(path.join(lane, "specs", "sub", "two.md"), "two\n");
    // The .current/<ticket>/ harvest runs AFTER the specs copy; an unreadable file there fails it.
    const unreadable = path.join(lane, ".current", t, "unreadable.jsonl");
    writeFile(unreadable, "cannot read\n");
    fs.chmodSync(unreadable, 0o000);
    try {
      const first = feature(repo, ["finish", t, "--abandoned"]);
      assert.notEqual(first.status, 0, "the later .current harvest must fail");
      assert.equal(harvestLines(first.stdout).length, 2, "both specs files were copied before the failure");
      assert.ok(exists(lane), "worktree left in place");

      fs.chmodSync(unreadable, 0o644);
      const second = feature(repo, ["finish", t, "--abandoned"]);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(harvestLines(second.stdout).length, 0, "no second copy");
      assert.doesNotMatch(second.stderr, /harvest destination already exists/);
      const base = path.join(repo, "specs", "abandoned", t);
      assert.equal(fs.readFileSync(path.join(base, "one.md"), "utf-8"), "one\n");
      assert.equal(fs.readFileSync(path.join(base, "sub", "two.md"), "utf-8"), "two\n");
      assert.deepEqual(fs.readdirSync(base).sort(), ["one.md", "sub"], "exactly one copy per file, no stray output");
      assert.ok(!exists(lane));
    } finally {
      try {
        fs.chmodSync(unreadable, 0o644);
      } catch {
        // worktree already removed
      }
    }
  },
);

// ============================================================================
// AC-E217-7 — resolvable symlinks are dereferenced
// ============================================================================
test("AC-E217-7: resolvable symlinks in specs/ are copied as regular files with the target bytes", () => {
  const t = "e217h";
  const repo = makePrimary();
  const { lane } = startLane(repo, t);
  writeFile(path.join(lane, "specs", "real", "target.md"), "file target\n");
  writeFile(path.join(lane, "specs", "realdir", "a.md"), "dir target a\n");
  fs.symlinkSync(path.join("real", "target.md"), path.join(lane, "specs", "link-file.md"));
  fs.symlinkSync("realdir", path.join(lane, "specs", "link-dir"));

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  const base = path.join(repo, "specs", "abandoned", t);
  for (const [rel, body] of [
    ["link-file.md", "file target\n"],
    [path.join("link-dir", "a.md"), "dir target a\n"],
  ]) {
    const st = fs.lstatSync(path.join(base, rel));
    assert.ok(st.isFile() && !st.isSymbolicLink(), `${rel} is a regular file`);
    assert.equal(fs.readFileSync(path.join(base, rel), "utf-8"), body);
  }
  assert.ok(!fs.lstatSync(path.join(base, "link-dir")).isSymbolicLink(), "link-dir is a real directory");
});

// ============================================================================
// AC-E217-8 — untracked, NOT ignored: the existing precondition refusal is unchanged
// ============================================================================
test("AC-E217-8: an untracked spec that is not git-ignored hits the existing refusal, nothing moved", () => {
  const t = "e217i";
  const repo = makePrimary({ gitignore: "qa_reports/\n" }); // specs/ NOT ignored
  const { lane, branch } = startLane(repo, t);
  writeFile(path.join(lane, "specs", "visible.md"), "untracked and visible\n");
  const before = snapshot(repo, lane, branch);

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /specs\/visible\.md/, "the path is listed as an uncommitted change");
  assert.doesNotMatch(r.stderr + r.stdout, /harvested git-ignored evidence/);
  assert.deepEqual(snapshot(repo, lane, branch), before);
  assert.ok(!exists(path.join(repo, "specs")), "nothing copied into primary");
  assert.ok(exists(path.join(lane, "specs", "visible.md")));
});

// ============================================================================
// AC-E217-9 — control characters are escaped in every path echo
// ============================================================================
const CTL_NAME = "ctl\nname\x1bx.md";
const CTL_ESC = "ctl\\nname\\x1bx.md";
const noRawCtl = (s) =>
  assert.ok(!/[\x00-\x09\x0b-\x1f\x7f]/.test(s), "no raw control byte (other than the line feed ending a line)");

test("AC-E217-9: the harvest line escapes LF and ESC while the primary copy keeps the raw name", () => {
  const t = "e217j";
  const repo = makePrimary();
  const { lane } = startLane(repo, t);
  writeFile(path.join(lane, "specs", CTL_NAME), "ctl bytes\n");

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(harvestLine(`specs/${CTL_ESC}`, `specs/abandoned/${t}/${CTL_ESC}`)), r.stdout);
  noRawCtl(r.stdout);
  assert.equal(
    fs.readFileSync(path.join(repo, "specs", "abandoned", t, CTL_NAME), "utf-8"),
    "ctl bytes\n",
    "copy is at the raw path",
  );
});

test("AC-E217-9: the differing-destination refusal escapes the primary path", () => {
  const t = "e217k";
  const repo = makePrimary();
  const { lane } = startLane(repo, t);
  writeFile(path.join(lane, "specs", CTL_NAME), "lane\n");
  writeFile(path.join(repo, "specs", "abandoned", t, CTL_NAME), "different\n");

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.includes(path.join("specs", "abandoned", t, CTL_ESC)), r.stderr);
  noRawCtl(r.stderr);
});

test("AC-E217-9: the dangling-symlink refusal escapes the path", () => {
  const t = "e217l";
  const repo = makePrimary();
  const { lane } = startLane(repo, t);
  fs.mkdirSync(path.join(lane, "specs"), { recursive: true });
  fs.symlinkSync("nowhere", path.join(lane, "specs", CTL_NAME));

  const r = feature(repo, ["finish", t, "--abandoned"]);
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.includes(`  specs/${CTL_ESC}`), r.stderr);
  noRawCtl(r.stderr);
});

test(
  "AC-E217-9: the copy-failure line escapes the path and the reason text",
  { skip: IS_ROOT && "chmod 000 does not block root" },
  () => {
    const t = "e217m";
    const repo = makePrimary();
    const { lane } = startLane(repo, t);
    const f = path.join(lane, "specs", CTL_NAME);
    writeFile(f, "cannot read\n");
    fs.chmodSync(f, 0o000);
    try {
      const r = feature(repo, ["finish", t, "--abandoned"]);
      assert.notEqual(r.status, 0);
      assert.ok(
        r.stderr.includes(`agc feature finish --abandoned: harvest of specs/${CTL_ESC} into the primary checkout failed (`),
        r.stderr,
      );
      assert.ok(r.stderr.includes("worktree and branch left in place (re-running finish is safe)"));
      assert.ok(r.stderr.includes("\\x1b"), "reason text escaped too");
      noRawCtl(r.stderr);
      assert.ok(exists(lane));
    } finally {
      fs.chmodSync(f, 0o644);
    }
  },
);

test(
  "AC-E217-9: the read-failure line escapes the path",
  { skip: IS_ROOT && "chmod 000 does not block root" },
  () => {
    const t = "e217n";
    const repo = makePrimary();
    const { lane } = startLane(repo, t);
    writeFile(path.join(lane, "specs", "ok.md"), "fine\n");
    const dir = path.join(lane, "specs", "d\x1bir");
    writeFile(path.join(dir, "inner.md"), "x\n");
    fs.chmodSync(dir, 0o000);
    try {
      const r = feature(repo, ["finish", t, "--abandoned"]);
      assert.notEqual(r.status, 0);
      assert.ok(r.stderr.includes("agc feature finish --abandoned: could not read "), r.stderr);
      assert.ok(r.stderr.includes("d\\x1bir"), r.stderr);
      assert.ok(r.stderr.includes("— nothing removed"));
      noRawCtl(r.stderr);
      assert.ok(exists(lane));
    } finally {
      fs.chmodSync(dir, 0o755);
    }
  },
);

// ============================================================================
// AC-E217-12 — usage text
// ============================================================================
test("AC-E217-12: feature usage carries the e217.usage-abandoned lines in place of the old ones", () => {
  const r = feature(PROJECT_ROOT, []);
  const usage = r.stdout + r.stderr;
  const block =
    "          moves the lane's qa_reports/ + review_reports/ evidence into\n" +
    "          abandoned/<ticket-id>/, commits it, copies git-ignored specs/\n" +
    "          files into primary's specs/abandoned/<ticket-id>/, removes the\n" +
    "          worktree, and keeps the branch. Either way, the lane's committed\n";
  assert.ok(usage.includes(block), "the four new usage lines, contiguous");
  assert.ok(!usage.includes("abandoned/<ticket-id>/, commits it, removes the worktree, and\n"), "old wording gone");
  assert.ok(!usage.includes("          keeps the branch. Either way, the lane's committed"), "old third line gone");
  // The e291.usage-start lines stay (pinned in full by test/e291-start-link-locations.test.mjs).
  assert.ok(usage.includes("symlinked to primary's (root, or the directories listed in\n"));
  assert.ok(usage.includes(".current/.config.json nodeModulesLinks), .env byte-copied.\n"));
});
