// Coded by @qa-engineer
// Tests (T-E292-03) for specs/e292-sister-repos.md AC-E292-7..8: `handoff --check` compares each sha recorded in the
// manifest's `## 外部依賴` table with that branch in the sister repo now. A take-over acts on the other repo's
// contract, so a moved or vanished branch must stop it (DIFF, exit 1, also when the branch only moved forward) while
// an unmoved branch is silent; a row that cannot be resolved (undeclared name, unusable config, not a git repo,
// malformed section) is a setup error (exit 2) reported together with every other one of the run, never an echo of
// a local path; and `handoff` (generate) ignores the section entirely. Fixtures: each case builds temp git repos
// under os.tmpdir() (a primary with a bare origin and a committed v2 config declaring the sister repo, a sister
// repo with branch feat/x). Primary's committed config carries schema_version 2 so loadConfig never heal-writes
// into the temp primary (a dirty `git status` fact would add a stray DIFF). Nothing reads this repo's own config.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { runHandoff } from "../dist/tools/fanout-handoff.js";

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e292-sister-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  }).trim();
}
const run = (args) => {
  const r = runHandoff(args);
  return { status: r.exitCode, stdout: r.stdout, stderr: r.stderr };
};

const HEADER = "| repo | 票 | branch | sha | 協定出處 |\n|---|---|---|---|---|";
const ext = (...rows) => ["", "## 外部依賴", HEADER, ...rows, ""].join("\n");
const row = (repo, branch, sha, ticket = "E1") => `| ${repo} | ${ticket} | ${branch} | ${sha} | README.md §3 |`;

function manifestText() {
  return [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    "",
    "**狀態：人類核准 2026-10-13。**",
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    "",
    "## Dispatch pins",
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-10-13 | 人類 | 開波 | s |",
    "",
  ].join("\n");
}

let n = 0;
/**
 * root/primary (main = origin/main, clean, committed v2 config) holds the manifest at specs/fanout-fx.md with the
 * generated `## 接手步驟` section already pasted (uncommitted, as an integrator would); root/sister is a git repo
 * with main and feat/x. `sisterRepos` is the config key's value (default: one entry `s` at ../sister).
 */
function makeWave({ sisterRepos = [{ name: "s", path: "../sister", owns: "the protocol" }], config } = {}) {
  const root = path.join(TMP, `w${n++}`);
  const primary = path.join(root, "primary");
  const sister = path.join(root, "sister");
  fs.mkdirSync(path.join(primary, "specs"), { recursive: true });
  fs.mkdirSync(path.join(primary, ".current"), { recursive: true });
  fs.mkdirSync(sister, { recursive: true });
  git(root, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(sister, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(sister, "README.md"), "v1\n");
  git(sister, "add", "-A");
  git(sister, "commit", "-q", "-m", "s1");
  git(sister, "checkout", "-q", "-b", "feat/x");
  fs.writeFileSync(path.join(sister, "README.md"), "v2\n");
  git(sister, "commit", "-q", "-am", "s2");
  git(sister, "checkout", "-q", "main");
  git(primary, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(primary, ".gitignore"), ".current/*\n!.current/.config.json\n");
  fs.writeFileSync(
    path.join(primary, ".current", ".config.json"),
    config ?? JSON.stringify({ schema_version: 2, sisterRepos }, null, 2) + "\n",
  );
  const M = path.join(primary, "specs", "fanout-fx.md");
  fs.writeFileSync(M, manifestText());
  git(primary, "add", "-A");
  git(primary, "commit", "-q", "-m", "base");
  git(primary, "remote", "add", "origin", path.join(root, "origin.git"));
  git(primary, "push", "-q", "origin", "main");
  const g = run([M]);
  assert.equal(g.status, 0, g.stderr);
  fs.appendFileSync(M, "\n" + g.stdout);
  return { root, primary, sister, M, plain: manifestText(), generated: g.stdout };
}
const xSha = (w) => git(w.sister, "rev-parse", "feat/x");
const summary = (r) => /^fanout handoff --check: (\d+) fact\(s\) checked, (\d+) differ, (\d+) moved$/m.exec(r.stdout)?.slice(1).map(Number);
const lines = (r) => r.stdout.split("\n").filter((l) => l !== "");
const diffLine = (repo, branch, rec, now) => `DIFF  外部依賴 ${repo} ${branch}: 清單「${rec}」／repo「${now}」`;
const addSection = (w, ...rows) => fs.appendFileSync(w.M, ext(...rows));
const commitOnX = (w) => {
  git(w.sister, "checkout", "-q", "feat/x");
  fs.writeFileSync(path.join(w.sister, "README.md"), "v3\n");
  git(w.sister, "commit", "-q", "-am", "s3");
  git(w.sister, "checkout", "-q", "main");
};

// --- AC-E292-7 ------------------------------------------------------------------------------------------------

test("AC-E292-7 unchanged branch: silent, checked count +1, exit 0 (7- and 40-char shas alike)", () => {
  const w = makeWave();
  const base = run(["--check", w.M]);
  assert.equal(base.status, 0, base.stderr);
  const [baseChecked] = summary(base);
  const sha = xSha(w);
  for (const rec of [sha.slice(0, 7), sha]) {
    const text = fs.readFileSync(w.M, "utf8");
    addSection(w, row("s", "feat/x", rec));
    const r = run(["--check", w.M]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!r.stdout.includes("外部依賴"), "no line names the row");
    assert.deepEqual(summary(r), [baseChecked + 1, 0, 0]);
    fs.writeFileSync(w.M, text);
  }
});

test("AC-E292-7 the section-free run is unchanged from before (no config read, no extra count)", () => {
  const w = makeWave({ config: "{ not json" });
  // WHY: the sister path runs only when the section exists; a broken config must not matter otherwise.
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(!r.stderr.includes("SISTER_REPO"));
});

test("AC-E292-7 a new commit on feat/x -> DIFF line, counted under differ, exit 1 (descendant included)", () => {
  const w = makeWave();
  const rec = xSha(w).slice(0, 7);
  addSection(w, row("s", "feat/x", rec));
  const [baseChecked] = summary(run(["--check", w.M]));
  commitOnX(w);
  const now = xSha(w);
  assert.notEqual(now.slice(0, 7), rec);
  assert.equal(git(w.sister, "merge-base", "--is-ancestor", rec, now) ?? "", "", "the new commit descends from the recorded one");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const l = lines(r);
  assert.equal(l.filter((x) => x.includes("外部依賴")).length, 1);
  assert.ok(l.includes(diffLine("s", "feat/x", rec, now.slice(0, 7))), r.stdout);
  assert.deepEqual(summary(r), [baseChecked, 1, 0]);
  assert.ok(!r.stdout.includes("MOVED  外部依賴"), "never MOVED");
  // a 40-char record shows the full current sha
  const full = makeWave();
  const rec40 = xSha(full);
  addSection(full, row("s", "feat/x", rec40));
  commitOnX(full);
  assert.ok(run(["--check", full.M]).stdout.includes(diffLine("s", "feat/x", rec40, xSha(full))));
});

test("AC-E292-7 a non-descendant (rewound) branch is a DIFF as well", () => {
  const w = makeWave();
  const rec = xSha(w).slice(0, 7);
  addSection(w, row("s", "feat/x", rec));
  git(w.sister, "branch", "-f", "feat/x", "main");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes(diffLine("s", "feat/x", rec, git(w.sister, "rev-parse", "main").slice(0, 7))));
});

test("AC-E292-7 deleted branch -> repo「（缺）」, exit 1", () => {
  const w = makeWave();
  const rec = xSha(w).slice(0, 7);
  addSection(w, row("s", "feat/x", rec));
  git(w.sister, "branch", "-D", "feat/x");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 1, r.stderr);
  assert.ok(r.stdout.includes(diffLine("s", "feat/x", rec, "（缺）")), r.stdout);
  assert.ok(r.stdout.includes("repo「（缺）」"));
});

test("AC-E292-7 comparison lines follow every fact line, precede the summary, in table order", () => {
  const w = makeWave();
  const rec = xSha(w).slice(0, 7);
  addSection(w, row("s", "feat/y-missing", rec, "E2"), row("s", "feat/x", rec, "E1"));
  commitOnX(w);
  // a primary fact change too (an untracked file shows in the `git status` fact)
  fs.writeFileSync(path.join(w.primary, "stray.txt"), "x\n");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 1);
  const l = lines(r);
  const factDiff = l.findIndex((x) => x.startsWith("DIFF  git status"));
  const first = l.findIndex((x) => x.startsWith("DIFF  外部依賴 s feat/y-missing"));
  const second = l.findIndex((x) => x.startsWith("DIFF  外部依賴 s feat/x"));
  assert.ok(factDiff >= 0 && factDiff < first && first < second && second < l.length - 1, l.join("\n"));
  assert.match(l[l.length - 1], /^fanout handoff --check: \d+ fact\(s\) checked, 3 differ, 0 moved$/);
  assert.equal(l.slice(factDiff + 1, l.length - 1).filter((x) => !x.includes("外部依賴")).length, 0);
});

test("AC-E292-7 a branch name with a slash and a backticked row resolve", () => {
  const w = makeWave();
  addSection(w, row("`s`", "`feat/x`", "`" + xSha(w).slice(0, 7) + "`"));
  assert.equal(run(["--check", w.M]).status, 0);
});

// --- AC-E292-8 ------------------------------------------------------------------------------------------------

const errCodes = (r) => [...r.stderr.matchAll(/fanout: error: ([A-Z_]+):/g)].map((m) => m[1]);

test("AC-E292-8 undeclared repo -> exit 2 SISTER_REPO_UNKNOWN with the spec copy", () => {
  const w = makeWave();
  addSection(w, row("s", "feat/x", xSha(w).slice(0, 7)), row("nope", "feat/x", "abc1234", "E2"));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2, r.stdout);
  assert.equal(r.stdout, "");
  assert.ok(
    r.stderr.includes('fanout: error: SISTER_REPO_UNKNOWN: 外部依賴 row 2: repo "nope" is not declared in sisterRepos of .current/.config.json'),
    r.stderr,
  );
});

test("AC-E292-8 no sisterRepos key at all counts as undeclared", () => {
  const w = makeWave({ config: JSON.stringify({ schema_version: 2 }) });
  addSection(w, row("s", "feat/x", xSha(w).slice(0, 7)));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2);
  assert.deepEqual(errCodes(r), ["SISTER_REPO_UNKNOWN"]);
});

test("AC-E292-8 unusable primary config -> exit 2 with the config-error copy, newlines collapsed", () => {
  const w = makeWave({ config: '{ "schema_version": 2,\n "sisterRepos": [ ' });
  addSection(w, row("s", "feat/x", "abc1234"));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^fanout: error: SISTER_REPO_UNKNOWN: 外部依賴 names sister repos, but \.current\/\.config\.json could not be read \([^\n]+\)$/m);
  assert.equal(r.stderr.trimEnd().split("\n").filter((x) => x.startsWith("fanout: error:")).length, 1);
});

test("AC-E292-8 declared path missing or a plain directory -> SISTER_REPO_NOT_GIT, no path echoed", () => {
  const w = makeWave({
    sisterRepos: [
      { name: "gone", path: "../does-not-exist-dir", owns: "x" },
      { name: "plain", path: "../plain-dir", owns: "y" },
      { name: "s", path: "../sister", owns: "z" },
    ],
  });
  fs.mkdirSync(path.join(w.root, "plain-dir"));
  addSection(w, row("gone", "feat/x", "abc1234"), row("plain", "feat/x", "abc1234", "E2"), row("s", "feat/x", xSha(w).slice(0, 7), "E3"));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2);
  assert.deepEqual(errCodes(r), ["SISTER_REPO_NOT_GIT", "SISTER_REPO_NOT_GIT"]);
  assert.ok(r.stderr.includes('fanout: error: SISTER_REPO_NOT_GIT: sister repo "gone" (sisterRepos in .current/.config.json) is not a git repository at its declared path'));
  assert.ok(r.stderr.includes('sister repo "plain"'));
  for (const leak of ["does-not-exist-dir", "plain-dir", "../", TMP, os.tmpdir(), w.root]) {
    assert.ok(!r.stderr.includes(leak), `stderr must not hold ${leak}`);
  }
});

test("AC-E292-8 one run reports every error together (unknown + not-git)", () => {
  const w = makeWave({ sisterRepos: [{ name: "gone", path: "../missing", owns: "x" }] });
  addSection(w, row("gone", "feat/x", "abc1234"), row("nope", "feat/x", "abc1234", "E2"));
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2);
  assert.deepEqual(errCodes(r).sort(), ["SISTER_REPO_NOT_GIT", "SISTER_REPO_UNKNOWN"]);
});

test("AC-E292-8 malformed section -> exit 2 with the AC-E292-5 code, nothing resolved", () => {
  const w = makeWave();
  fs.appendFileSync(w.M, "\n## 外部依賴\n沒有表。\n");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 2);
  assert.deepEqual(errCodes(r), ["EXTERNAL_DEPS_TABLE_ABSENT"]);
  const w2 = makeWave();
  addSection(w2, row("s", "feat/x", "zz"));
  const r2 = run(["--check", w2.M]);
  assert.equal(r2.status, 2);
  assert.deepEqual(errCodes(r2), ["EXTERNAL_DEPS_ROW_INVALID"]);
});

test("AC-E292-8 handoff (generate) output is identical with and without the section, even a malformed or unknown one", () => {
  const w = makeWave();
  const without = run([w.M]);
  assert.equal(without.status, 0, without.stderr);
  for (const rows of [[row("s", "feat/x", xSha(w).slice(0, 7))], [row("nope", "x", "abc1234")], [row("a/b", "x", "zz", "")]]) {
    const text = fs.readFileSync(w.M, "utf8");
    addSection(w, ...rows);
    const r = run([w.M]);
    assert.equal(r.status, without.status);
    assert.equal(r.stdout, without.stdout);
    assert.equal(r.stderr, without.stderr);
    fs.writeFileSync(w.M, text);
  }
  // and no mention of the sister repo or its sha leaks into the generated facts
  assert.ok(!without.stdout.includes("sister"));
});

test("AC-E292-8 the sister repo is only read: its refs and worktree are untouched", () => {
  const w = makeWave();
  addSection(w, row("s", "feat/x", xSha(w).slice(0, 7)));
  const snap = () => [git(w.sister, "for-each-ref"), git(w.sister, "status", "--porcelain"), git(w.sister, "rev-parse", "HEAD")].join("\n--\n");
  const before = snap();
  run(["--check", w.M]);
  assert.equal(snap(), before);
});
