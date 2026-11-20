// Coded by @qa-engineer
// Proofs for specs/e444-claude-local-adapter.md: `agc init --adapter=shared|local`, the
// matching `agc check` / `agc eject` / `agc feature start` behaviour and docs/install.md.
// One test per AC id (AC1..AC15, AC2b). Every fixture is a real scratch git repo under
// os.tmpdir() with a local identity (pattern: test/e106-init-artifacts-flag.test.mjs); the
// CLI always runs as a child process. Contract: a team's tracked CLAUDE.md must stay
// untouched while the agc block lands in an excluded CLAUDE.local.md.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const VERSION = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8")).version;
const OLD_VERSION = "0.0.1";
const BEGIN = "<!-- BEGIN agc-adapter -->";
const END = "<!-- END agc-adapter -->";
const TEMPLATE = fs.readFileSync(
  path.join(PROJECT_ROOT, "templates", "agent-adapters", "claude.md"),
  "utf-8"
);
const blockFor = (ver) => TEMPLATE.replace("{{AGC_VERSION}}", ver);

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
const write = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const read = (abs) => fs.readFileSync(abs, "utf-8");
const exists = (abs) => fs.existsSync(abs);
const runAgc = (cwd, args) => spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8" });
const excludeOf = (repo) => {
  const p = path.join(repo, ".git", "info", "exclude");
  return exists(p) ? read(p) : "";
};
const excludeLines = (repo) => excludeOf(repo).split("\n");
const lines = (s) => s.split("\n");

function mkRepo(prefix, files = {}, { commit = true } = {}) {
  const repo = mkTmp(prefix);
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  write(path.join(repo, "README.md"), "x\n");
  for (const [rel, body] of Object.entries(files)) write(path.join(repo, rel), body);
  if (commit) {
    git(repo, ["add", "-A"]);
    git(repo, ["commit", "-qm", "init"]);
  }
  return repo;
}

const tplFor = (name) =>
  fs
    .readFileSync(path.join(PROJECT_ROOT, "templates", "agent-adapters", name), "utf-8")
    .replace("{{AGC_VERSION}}", VERSION);
const TEAM_CLAUDE = "# Team rules\n\nBe kind.\n";
// Item 1/2 fixture of decision (h): everything but CLAUDE.md-related is tracked up front so
// `git status --porcelain` can be empty after init.
const teamRepo = (extra = {}) =>
  mkRepo("e444-team-", {
    "CLAUDE.md": TEAM_CLAUDE,
    "AGENTS.md": tplFor("codex.md"),
    ".antigravityrules": tplFor("antigravity.md"),
    ...extra,
  });

// Strings quoted verbatim from the spec's Copy / Strings table.
const S_ADDED = "agc init — added /CLAUDE.local.md to the shared info/exclude";
const S_REMOVAL_NOTICE =
  'agc init — note: CLAUDE.md still holds an agc adapter block; the block was also written to CLAUDE.local.md. agc init does not edit CLAUDE.md: delete the lines from "<!-- BEGIN agc-adapter -->" to "<!-- END agc-adapter -->" there by hand and commit that change.';
const S_SUGGESTION =
  "agc init — note: CLAUDE.md is tracked by git, so the agc adapter block just added to it shows in the team's diff — to keep the block out of git, use agc init --adapter=local (see docs/install.md)";
const S_NO_GIT =
  "agc init — note: not inside a git repository — skipped .git/info/exclude for CLAUDE.local.md";
const S_DUP =
  "agc check — adapter block found in both CLAUDE.md and CLAUDE.local.md — Claude Code loads both files, so the block is read twice; remove it from one of them";
const flagMsg = (kind, rel) =>
  kind === "skip-worktree"
    ? `agc check — ${rel} is flagged skip-worktree in the git index: git status and git diff hide its local changes, and git pull stops with "local changes would be overwritten" once upstream changes it — clear the flag with: git update-index --no-skip-worktree ${rel}`
    : `agc check — ${rel} is flagged assume-unchanged in the git index: git status and git diff hide its local changes, and git pull can stop with "local changes would be overwritten" once upstream changes it — clear the flag with: git update-index --no-assume-unchanged ${rel}`;
const S_COPIED = "agc feature start — copied CLAUDE.local.md from the primary checkout (bytes only; contents never read)";
const S_NOT_IGNORED =
  "agc feature start — warning: CLAUDE.local.md in the primary checkout is not ignored by git, so it was not copied into the lane (it would show as untracked there) — run agc init --adapter=local in the primary checkout to add the exclude rule";

const holdsBlockAt = (abs, ver) => {
  const t = read(abs);
  return t.includes(BEGIN) && t.includes(END) && t.includes(`agc-version: ${ver}`);
};

// AC1 — a team file stays untouched by default: the whole point is that teammates never see agc.
test("AC1: tracked block-less CLAUDE.md, default -> block in CLAUDE.local.md, CLAUDE.md untouched, porcelain empty", () => {
  const repo = teamRepo();
  const res = runAgc(repo, ["init"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(holdsBlockAt(path.join(repo, "CLAUDE.local.md"), VERSION));
  assert.equal(read(path.join(repo, "CLAUDE.md")), TEAM_CLAUDE);
  assert.ok(excludeLines(repo).includes("/CLAUDE.local.md"));
  assert.ok(lines(res.stdout).includes(S_ADDED), res.stdout);
  assert.equal(git(repo, ["status", "--porcelain"]), "");
});

// AC2 — existing adopters must not be moved by an upgrade re-run (ruling 1).
test("AC2: tracked CLAUDE.md already holding an older block -> updated in place, nothing local", () => {
  const repo = teamRepo({ "CLAUDE.md": `${TEAM_CLAUDE}\n${blockFor(OLD_VERSION)}` });
  const res = runAgc(repo, ["init"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(holdsBlockAt(path.join(repo, "CLAUDE.md"), VERSION));
  assert.ok(!read(path.join(repo, "CLAUDE.md")).includes(OLD_VERSION));
  assert.ok(!exists(path.join(repo, "CLAUDE.local.md")));
  assert.ok(!excludeLines(repo).includes("/CLAUDE.local.md"));
  assert.ok(!res.stderr.includes("agc init — note: CLAUDE.md"), res.stderr);
});

// AC2b — decision (j): a re-run keeps the block where it already lives.
test("AC2b: only CLAUDE.local.md holds the block (artifacts repo) -> updated there, CLAUDE.md untouched; both -> shared", () => {
  const repo = teamRepo({ ".current/.config.json": '{"schema_version":2,"artifacts":"repo"}\n' });
  write(path.join(repo, "CLAUDE.local.md"), blockFor(OLD_VERSION));
  const res = runAgc(repo, ["init"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(holdsBlockAt(path.join(repo, "CLAUDE.local.md"), VERSION));
  assert.ok(!read(path.join(repo, "CLAUDE.local.md")).includes(OLD_VERSION));
  assert.equal(read(path.join(repo, "CLAUDE.md")), TEAM_CLAUDE);
  assert.ok(excludeLines(repo).includes("/CLAUDE.local.md"));
  assert.ok(!res.stderr.includes("agc init — note: CLAUDE.md"), res.stderr);

  // Both files holding a block: the existing rule applies, CLAUDE.md holds a block -> shared.
  const both = teamRepo({ "CLAUDE.md": `${TEAM_CLAUDE}\n${blockFor(OLD_VERSION)}` });
  write(path.join(both, "CLAUDE.local.md"), blockFor(OLD_VERSION));
  const r2 = runAgc(both, ["init"]);
  assert.equal(r2.status, 0, r2.stderr);
  assert.ok(holdsBlockAt(path.join(both, "CLAUDE.md"), VERSION));
  assert.ok(read(path.join(both, "CLAUDE.local.md")).includes(OLD_VERSION), "local copy not touched under shared");
});

// AC3 — every case outside the narrow first-install condition behaves exactly as before.
test("AC3: repo-mode / untracked / absent / non-git / ask -> block in CLAUDE.md as before, no local file or rule", () => {
  const noLocal = (dir, repo = dir) => {
    assert.ok(!exists(path.join(dir, "CLAUDE.local.md")), `${dir} must not get CLAUDE.local.md`);
    if (exists(path.join(repo, ".git"))) assert.ok(!excludeLines(repo).includes("/CLAUDE.local.md"));
  };

  // (i) artifacts repo, tracked block-less CLAUDE.md; item-4 suggestion on stderr (decision (e)).
  const i = teamRepo({ ".current/.config.json": '{"schema_version":2,"artifacts":"repo"}\n' });
  const ri = runAgc(i, ["init"]);
  assert.equal(ri.status, 0, ri.stderr);
  assert.ok(holdsBlockAt(path.join(i, "CLAUDE.md"), VERSION));
  assert.ok(lines(ri.stderr).includes(S_SUGGESTION), ri.stderr);
  noLocal(i);

  // (ii) untracked CLAUDE.md
  const ii = mkRepo("e444-untracked-");
  write(path.join(ii, "CLAUDE.md"), TEAM_CLAUDE);
  const rii = runAgc(ii, ["init"]);
  assert.equal(rii.status, 0, rii.stderr);
  assert.ok(holdsBlockAt(path.join(ii, "CLAUDE.md"), VERSION));
  noLocal(ii);

  // (iii) no CLAUDE.md
  const iii = mkRepo("e444-absent-");
  const riii = runAgc(iii, ["init"]);
  assert.equal(riii.status, 0, riii.stderr);
  assert.ok(holdsBlockAt(path.join(iii, "CLAUDE.md"), VERSION));
  noLocal(iii);

  // (iv) not a git repo
  const iv = mkTmp("e444-nogit-");
  write(path.join(iv, "CLAUDE.md"), TEAM_CLAUDE);
  const riv = runAgc(iv, ["init"]);
  assert.equal(riv.status, 0, riv.stderr);
  assert.ok(holdsBlockAt(path.join(iv, "CLAUDE.md"), VERSION));
  noLocal(iv);

  // (v) tracked CLAUDE.md, an artifact path already tracked, nothing declared -> mode "ask"
  const v = teamRepo({ "tasks.md": "- [ ] x\n" });
  const rv = runAgc(v, ["init"]);
  assert.ok(holdsBlockAt(path.join(v, "CLAUDE.md"), VERSION), `${rv.status} ${rv.stderr}`);
  noLocal(v);
});

// AC4 — moving to local never edits the shared file; the user is told to remove the old block.
test("AC4: --adapter=local over a CLAUDE.md that holds the block -> local block, CLAUDE.md byte-identical, notice", () => {
  const original = `${TEAM_CLAUDE}\n${blockFor(OLD_VERSION)}`;
  const repo = teamRepo({ "CLAUDE.md": original });
  const res = runAgc(repo, ["init", "--adapter=local"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(holdsBlockAt(path.join(repo, "CLAUDE.local.md"), VERSION));
  assert.equal(read(path.join(repo, "CLAUDE.md")), original);
  assert.ok(excludeLines(repo).includes("/CLAUDE.local.md"));
  assert.ok(lines(res.stderr).includes(S_REMOVAL_NOTICE), res.stderr);
});

// AC5 — the suggestion is one line, on a fresh append only, and runs no index-changing git command.
test("AC5: --adapter=shared appends + suggests once; a re-run updates in place without the suggestion", () => {
  const repo = teamRepo();
  const res = runAgc(repo, ["init", "--adapter=shared"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(holdsBlockAt(path.join(repo, "CLAUDE.md"), VERSION));
  assert.ok(!exists(path.join(repo, "CLAUDE.local.md")));
  assert.equal(git(repo, ["diff", "--cached"]), "", "index must be unchanged");
  assert.equal(lines(res.stderr).filter((l) => l === S_SUGGESTION).length, 1, res.stderr);

  const again = runAgc(repo, ["init"]);
  assert.equal(again.status, 0, again.stderr);
  assert.ok(!again.stderr.includes("the agc adapter block just added"), again.stderr);
  assert.equal(read(path.join(repo, "CLAUDE.md")).split(BEGIN).length - 1, 1, "block updated in place, not duplicated");
});

// AC6 — a bad flag value fails before any write.
test("AC6: --adapter=foo / bare --adapter exit 2 with the usage error and write nothing; space form works", () => {
  for (const args of [["init", "--adapter=foo"], ["init", "--adapter"]]) {
    const dir = mkTmp("e444-bad-");
    const res = runAgc(dir, args);
    assert.equal(res.status, 2, res.stderr);
    const got = args[1] === "--adapter" ? '""' : '"foo"';
    assert.ok(
      res.stderr.includes(`agc init: --adapter must be "shared" or "local" (got ${got})`),
      res.stderr
    );
    assert.deepEqual(fs.readdirSync(dir), [], "nothing written");
  }
  const repo = teamRepo();
  const res = runAgc(repo, ["init", "--adapter", "local"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(holdsBlockAt(path.join(repo, "CLAUDE.local.md"), VERSION));
});

// AC7 — rule anchoring in a subdirectory, the outside-git note, and the unsafe-segment refusal.
test("AC7: subdir prefixed rule; outside git note; unsafe segment refused", () => {
  const repo = mkRepo("e444-sub-");
  const sub = path.join(repo, "sub");
  fs.mkdirSync(sub);
  const res = runAgc(sub, ["init", "--adapter=local"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(holdsBlockAt(path.join(sub, "CLAUDE.local.md"), VERSION));
  assert.ok(excludeLines(repo).includes("/sub/CLAUDE.local.md"), excludeOf(repo));

  const nogit = mkTmp("e444-nogit2-");
  const r2 = runAgc(nogit, ["init", "--adapter=local"]);
  assert.equal(r2.status, 0, r2.stderr);
  assert.ok(exists(path.join(nogit, "CLAUDE.local.md")));
  assert.ok(lines(r2.stderr).includes(S_NO_GIT), r2.stderr);

  const repo3 = mkRepo("e444-unsafe-");
  const bad = path.join(repo3, "a*b");
  fs.mkdirSync(bad);
  const before = excludeOf(repo3);
  const r3 = runAgc(bad, ["init", "--artifacts=repo", "--adapter=local"]);
  assert.equal(r3.status, 2, r3.stderr);
  assert.ok(r3.stderr.includes("agc init: refusing --adapter=local — workspace path segment"), r3.stderr);
  assert.deepEqual(fs.readdirSync(bad), [], "nothing written");
  assert.equal(excludeOf(repo3), before);
});

// AC7b — decision (l): the implicit-local refusal must not blame a flag the user never passed.
test("AC7b: implicit local (block only in CLAUDE.local.md), unsafe-segment dir -> exit 2, nothing written, no flag-blaming text", () => {
  const repo = mkRepo("e444-implicit-");
  const bad = path.join(repo, "a*b");
  write(path.join(bad, "CLAUDE.md"), TEAM_CLAUDE);
  write(path.join(bad, ".current", ".config.json"), '{"schema_version":2,"artifacts":"repo"}\n');
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-qm", "sub"]);
  write(path.join(bad, "CLAUDE.local.md"), blockFor(OLD_VERSION));
  const snapshot = () =>
    fs
      .readdirSync(bad, { recursive: true })
      .sort()
      .map((f) => `${f}:${fs.statSync(path.join(bad, f)).isFile() ? read(path.join(bad, f)) : "dir"}`);
  const before = snapshot();
  const excl = excludeOf(repo);
  const res = runAgc(bad, ["init"]);
  assert.equal(res.status, 2, res.stderr);
  assert.ok(!res.stderr.includes("refusing --adapter=local"), res.stderr);
  assert.ok(res.stderr.includes("a*b"), "names the unsafe segment");
  assert.deepEqual(snapshot(), before, "nothing written");
  assert.equal(excludeOf(repo), excl);
});

// AC8 — check reads whichever file holds the block.
test("AC8: block in CLAUDE.local.md -> check OK when current, exit 1 naming it when stale", () => {
  const repo = teamRepo();
  write(path.join(repo, "CLAUDE.local.md"), blockFor(VERSION));
  const ok = runAgc(repo, ["check"]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(lines(ok.stdout).includes(`agc check — OK (${VERSION}) — all adapters current`), ok.stdout);

  write(path.join(repo, "CLAUDE.local.md"), blockFor(OLD_VERSION));
  const stale = runAgc(repo, ["check"]);
  assert.equal(stale.status, 1);
  assert.ok(stale.stderr.includes("stale adapter: CLAUDE.local.md"), stale.stderr);
});

// AC9 — duplicate is advisory (Claude Code would read the block twice).
test("AC9: block in both files -> duplicate advisory, exit 0", () => {
  const repo = teamRepo({ "CLAUDE.md": `${TEAM_CLAUDE}\n${blockFor(VERSION)}` });
  write(path.join(repo, "CLAUDE.local.md"), blockFor(VERSION));
  const res = runAgc(repo, ["check"]);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(lines(res.stderr).includes(S_DUP), res.stderr);
});

// AC10 — index flags hide edits from git and later break `git pull`; advisory, never the exit code.
test("AC10: skip-worktree / assume-unchanged advisories exit 0; stale + flag still exit 1", () => {
  const repo = teamRepo({ "CLAUDE.md": `${TEAM_CLAUDE}\n${blockFor(VERSION)}` });
  git(repo, ["update-index", "--skip-worktree", "CLAUDE.md"]);
  const a = runAgc(repo, ["check"]);
  assert.equal(a.status, 0, a.stderr);
  assert.ok(lines(a.stderr).includes(flagMsg("skip-worktree", "CLAUDE.md")), a.stderr);

  git(repo, ["update-index", "--no-skip-worktree", "CLAUDE.md"]);
  git(repo, ["update-index", "--assume-unchanged", "CLAUDE.md"]);
  const b = runAgc(repo, ["check"]);
  assert.equal(b.status, 0, b.stderr);
  assert.ok(lines(b.stderr).includes(flagMsg("assume-unchanged", "CLAUDE.md")), b.stderr);
  assert.ok(!b.stderr.includes("flagged skip-worktree"));

  write(path.join(repo, "CLAUDE.md"), `${TEAM_CLAUDE}\n${blockFor(OLD_VERSION)}`);
  const c = runAgc(repo, ["check"]);
  assert.equal(c.status, 1, "stale result is unchanged by the advisory");
  assert.ok(lines(c.stderr).includes(flagMsg("assume-unchanged", "CLAUDE.md")), c.stderr);

  // Outside git the advisory prints nothing.
  const nogit = mkTmp("e444-flag-nogit-");
  write(path.join(nogit, "CLAUDE.md"), blockFor(VERSION));
  const d = runAgc(nogit, ["check"]);
  assert.equal(d.status, 0, d.stderr);
  assert.ok(!d.stderr.includes("flagged"), d.stderr);
});

// AC11 — no CLAUDE.local.md and no flag: check output is what it was before this ticket.
test("AC11: workspace without CLAUDE.local.md or flags -> bare-stamp check output unchanged", () => {
  const repo = teamRepo({ "CLAUDE.md": `<!-- agc-version: ${VERSION} -->\n${TEAM_CLAUDE}` });
  const res = runAgc(repo, ["check"]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, `agc check — OK (${VERSION}) — all adapters current\n`);
  assert.ok(!res.stderr.includes("adapter block found in both"), res.stderr);
  assert.ok(!res.stderr.includes("flagged"), res.stderr);
});

// AC12 — eject takes the local block and its own exclude line, nothing else of the user's.
test("AC12: eject removes the local block + exclude line; keeps notes; no-block file left untouched", () => {
  const repo = teamRepo();
  assert.equal(runAgc(repo, ["init", "--adapter=local"]).status, 0);
  fs.appendFileSync(path.join(repo, ".git", "info", "exclude"), "my-own-rule\n");

  const dry = runAgc(repo, ["eject"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.ok(
    lines(dry.stdout).includes(
      "(iii) host traces — CLAUDE.local.md: REMOVE adapter block (file will be deleted, holds only the block)"
    ),
    dry.stdout
  );
  assert.ok(
    lines(dry.stdout).includes(
      "(iii) host traces — .git/info/exclude: REMOVE 4 artifact exclude line(s) and the /CLAUDE.local.md line"
    ),
    dry.stdout
  );
  assert.ok(exists(path.join(repo, "CLAUDE.local.md")), "dry-run changes nothing");

  const yes = runAgc(repo, ["eject", "--yes"]);
  assert.equal(yes.status, 0, yes.stderr);
  assert.ok(!exists(path.join(repo, "CLAUDE.local.md")));
  assert.ok(!excludeLines(repo).includes("/CLAUDE.local.md"));
  assert.ok(excludeLines(repo).includes("my-own-rule"), "other lines keep their bytes");

  // User notes + block (decision (k)): block removed, notes AND the exclude line kept, so the
  // private notes never become an untracked file the next `git add -A` would commit.
  const notes = teamRepo();
  assert.equal(runAgc(notes, ["init", "--adapter=local"]).status, 0);
  fs.appendFileSync(path.join(notes, "CLAUDE.local.md"), "\nmy notes\n");
  const keptLine = /\/CLAUDE\.local\.md.*kept|kept.*\/CLAUDE\.local\.md/i;
  const nd = runAgc(notes, ["eject"]);
  assert.equal(nd.status, 0, nd.stderr);
  assert.ok(lines(nd.stdout).some((l) => keptLine.test(l)), `plan names the kept rule:\n${nd.stdout}`);
  const r2 = runAgc(notes, ["eject", "--yes"]);
  assert.equal(r2.status, 0, r2.stderr);
  const kept = read(path.join(notes, "CLAUDE.local.md"));
  assert.ok(kept.includes("my notes"));
  assert.ok(!kept.includes(BEGIN) && !kept.includes(END));
  assert.ok(excludeLines(notes).includes("/CLAUDE.local.md"), "exclude line kept while the file is kept");
  assert.ok(lines(r2.stdout).some((l) => keptLine.test(l)), r2.stdout);
  assert.ok(!git(notes, ["status", "--porcelain"]).includes("CLAUDE.local.md"), "notes stay out of git status");

  // Integrator-accepted extra: a CLAUDE.local.md without an agc block is reported and untouched.
  const nb = teamRepo();
  write(path.join(nb, "CLAUDE.local.md"), "only my notes\n");
  // Decision (k), last sentence: the user's own /CLAUDE.local.md rule survives a block-less
  // eject, so the private file never turns into an untracked, committable file.
  fs.appendFileSync(path.join(nb, ".git", "info", "exclude"), "/CLAUDE.local.md\n");
  const nbDry = runAgc(nb, ["eject"]);
  assert.equal(nbDry.status, 0, nbDry.stderr);
  assert.ok(lines(nbDry.stdout).some((l) => keptLine.test(l)), `plan names the kept rule:\n${nbDry.stdout}`);
  const r3 = runAgc(nb, ["eject", "--yes"]);
  assert.equal(r3.status, 0, r3.stderr);
  assert.ok(lines(r3.stdout).some((l) => keptLine.test(l)), `kept line printed:\n${r3.stdout}`);
  assert.ok(excludeLines(nb).includes("/CLAUDE.local.md"), "rule kept for a block-less file");
  assert.ok(!git(nb, ["status", "--porcelain"]).includes("CLAUDE.local.md"), "block-less notes stay out of git status");
  assert.ok(
    lines(r3.stdout).includes("(iii) host traces — CLAUDE.local.md: no adapter block found — nothing to do"),
    r3.stdout
  );
  assert.equal(read(path.join(nb, "CLAUDE.local.md")), "only my notes\n");
});

// AC13 — eject cannot clear index flags (agc never runs update-index) but must say so.
test("AC13: flagged CLAUDE.md -> eject cannot-do item 5 with the matching command; unflagged -> four items", () => {
  const item5 =
    "  5. Clear git index flags: the adapter file(s) below are flagged in the git index, and git pull can fail on them until the flag is cleared. agc never runs git update-index:";
  for (const [flag, cmd] of [
    ["--skip-worktree", "git update-index --no-skip-worktree CLAUDE.md"],
    ["--assume-unchanged", "git update-index --no-assume-unchanged CLAUDE.md"],
  ]) {
    const repo = teamRepo({ "CLAUDE.md": `${TEAM_CLAUDE}\n${blockFor(VERSION)}` });
    git(repo, ["update-index", flag, "CLAUDE.md"]);
    for (const argv of [["eject"], ["eject", "--yes"]]) {
      const res = runAgc(repo, argv);
      assert.equal(res.status, 0, res.stderr);
      assert.ok(lines(res.stdout).includes(item5), res.stdout);
      assert.ok(lines(res.stdout).includes(`       ${cmd}`), res.stdout);
    }
  }
  const clean = teamRepo({ "CLAUDE.md": `${TEAM_CLAUDE}\n${blockFor(VERSION)}` });
  const res = runAgc(clean, ["eject"]);
  assert.ok(res.stdout.includes("  4. Remove the machine-wide subagent templates"), res.stdout);
  assert.ok(!res.stdout.includes("5. Clear git index flags"), res.stdout);
});

// AC14 — a lane must load the governance block, yet stay clean so `finish` can remove it.
test("AC14: feature start copies an ignored CLAUDE.local.md; absent -> none; unignored -> warning", () => {
  const start = (repo) => {
    const lane = path.join(mkTmp("e444-lane-"), "lane");
    const res = runAgc(repo, ["feature", "start", "e9-x", "--path", lane]);
    return { res, lane };
  };

  const repo = teamRepo();
  assert.equal(runAgc(repo, ["init"]).status, 0); // default -> local, exclude rule written
  assert.ok(exists(path.join(repo, "CLAUDE.local.md")));
  const { res, lane } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(read(path.join(lane, "CLAUDE.local.md")) === read(path.join(repo, "CLAUDE.local.md")));
  assert.ok(lines(res.stdout).includes(S_COPIED), res.stdout);
  assert.equal(git(lane, ["status", "--porcelain"]), "");

  const none = teamRepo();
  const n = start(none);
  assert.equal(n.res.status, 0, n.res.stderr);
  assert.ok(!exists(path.join(n.lane, "CLAUDE.local.md")));
  assert.ok(!n.res.stdout.includes("copied CLAUDE.local.md"), n.res.stdout);

  const open = teamRepo();
  write(path.join(open, "CLAUDE.local.md"), "private\n"); // untracked, no exclude rule
  const o = start(open);
  assert.equal(o.res.status, 0, o.res.stderr);
  assert.ok(!exists(path.join(o.lane, "CLAUDE.local.md")));
  assert.ok(lines(o.res.stderr).includes(S_NOT_IGNORED), o.res.stderr);
});

// AC15 — docs: the team-file section and the lists that mention CLAUDE.local.md.
test("AC15: docs/install.md documents the adapter flag, default, skip-worktree reason and the lists", () => {
  const doc = read(path.join(PROJECT_ROOT, "docs", "install.md"));
  const start = doc.indexOf("### When CLAUDE.md is a team file: `agc init --adapter=shared|local`");
  assert.ok(start >= 0, "section heading");
  const art = doc.indexOf("### Keeping governance artifacts out of git");
  assert.ok(art >= 0 && art < start, "placed after the --artifacts section");
  const end = doc.indexOf("\n---", start);
  const section = doc.slice(start, end);
  assert.match(section, /--adapter=shared/);
  assert.match(section, /--adapter=local/);
  assert.match(section, /`--artifacts` does not cover that block/);
  assert.match(section, /first-install default/i);
  assert.match(section, /inside a git repository, `CLAUDE\.md` tracked, artifacts mode `local`, and no agc block in `CLAUDE\.md`/);
  assert.match(section, /skip-worktree/);
  assert.match(section, /`git pull` stops[^.]*while `git status` and `git diff` still show no change/);

  const feature = doc.slice(doc.indexOf("### `agc feature start"), doc.indexOf("### `agc feature finish"));
  assert.match(feature, /CLAUDE\.local\.md/);
  const eject = doc.slice(doc.indexOf("## Leaving agc"));
  assert.match(eject, /\| \(iii\) host traces \|[^\n]*CLAUDE\.local\.md/);
  assert.match(eject, /5\. \*\*Clear git index flags\.\*\*/);
});
