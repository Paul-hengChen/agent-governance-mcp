// Coded by @qa-engineer
// Tests (T-E284-01, T-E284-02) for specs/e284-fanout-handoff-command.md AC-E284-1..12: `fanout.mjs handoff` prints a
// wave's `## 接手步驟` section with every repo fact filled in, and `handoff --check` re-collects the same facts and
// names each one that changed. A session taking over a wave acts on these facts, so a stale or wrong fact is the
// failure this command exists to prevent: the generated facts must be exact, a written handoff must check clean
// against an unchanged repo, and every real change must surface as its own DIFF line.
// Fixtures: each case builds its own temp repo under os.tmpdir() (a primary with a bare `origin`, lane worktrees in a
// sibling `lanes/` dir, a mailbox dir and an in-test manifest committed in primary). Nothing reads the committed
// specs/fanout-*.md, nothing is compared with a fixed sha, and no case writes into this repo. Most cases call the
// exported runHandoff in-process; the CLI is spawned where the case is about the wrapper (routing, exit codes,
// stderr format, no stack trace, read-only on disk).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { runHandoff, watchLockPath, formatWatchCommand } from "../dist/tools/fanout-handoff.js";
import { validateManifest } from "../dist/tools/fanout-manifest.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";
import { watchLockPath as scriptWatchLockPath, formatRearmCommand } from "../scripts/mailbox-watch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
// realpath: on some hosts os.tmpdir() sits under a symlink, while git reports resolved worktree paths.
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e284-qa-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const INTRO =
  "（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）";
const PH_CLOSED = "- <待填：本波次結果、lane 紀錄位置、未配號的新發現>";
const PH_DECIDE = "- <待填：下一波要不要開、待裁定的題目、整合者的建議>";
const NO_MAILBOX_NOTE = "note: no mailbox root (no mailbox: header and no --mailbox-root) — mailbox facts not collected.";
const OPEN_STATUS = "**狀態：人類核准 2026-10-13。**";
const CLOSED_STATUS = "**狀態：已結案 2026-10-17。**";
const STACK_LINE = /^\s+at /m;

// --- helpers --------------------------------------------------------------------------------------------------

function git(cwd, ...args) {
  return execFileSync(
    "git",
    ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 },
  ).trim();
}
const sha7 = (cwd, ref) => git(cwd, "rev-parse", ref).slice(0, 7);

/** In-process run of the subcommand (the function the wrapper routes `handoff` to). */
function run(args) {
  const r = runHandoff(args);
  return { status: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}
/** The real CLI, for wrapper-level behaviour. */
function cli(args) {
  const r = spawnSync(process.execPath, [FANOUT, "handoff", ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** `- <key>：<value>` lines of a section, as a Map. */
function facts(text) {
  const m = new Map();
  for (const l of text.split("\n")) {
    const f = /^- ([^：]+)：(.*)$/.exec(l);
    if (f && !f[1].startsWith("<待填")) m.set(f[1], f[2]);
  }
  return m;
}
const diffLines = (r) => r.stdout.split("\n").filter((l) => l.startsWith("DIFF  "));
const movedLines = (r) => r.stdout.split("\n").filter((l) => l.startsWith("MOVED  "));
const keyOf = (line) => /^(?:DIFF|MOVED)  (.+?): handoff「/.exec(line)?.[1];
const summary = (r) => r.stdout.split("\n").find((l) => l.startsWith("fanout handoff --check: "));

function manifestText({ status = OPEN_STATUS, mailbox = "../lanes/_mailbox", lanes = ["a", "b"], extraRows = [] } = {}) {
  return [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    ...(mailbox === null ? [] : [`mailbox: ${mailbox}`]),
    "",
    status,
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    ...lanes.map((l, i) => `| ${l} | E${i + 1} | feat/${l} | ../lanes/${l} | \`tools/${l}.ts\` | \`docs/**\` | 做：x。　不做：y | 無 |`),
    ...extraRows,
    "",
    "## Dispatch pins",
    ...lanes.map((l) => `- ${l}：\`sr-engineer=opus\`。`),
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-10-13 | 人類 | 開波 | s |",
    "",
  ].join("\n");
}

async function writeState(ws, { feature, status = "In_Progress", lastAgent = "sr-engineer", hop = 3 }) {
  resetSession();
  await writeHandoffState({ workspacePath: ws, activeFeature: feature, status, completedTasks: [], pendingNotes: [], lastAgent, hopCount: hop });
}

const msg = (n, from) => `--- msg ${n}\nfrom: ${from}\ntype: report\n---\nbody ${n}\n\n`;

/**
 * A wave fixture. `root/primary` (on main, equal to origin/main, clean; `.current/` ignored) holds the manifest at
 * `specs/fanout-fx.md`; `lanes` get worktrees at `root/lanes/<id>` on `feat/<id>` with one commit each; `mailbox`
 * writes `root/lanes/_mailbox/a/` with 2 messages to the integrator and 1 to the lane.
 */
async function makeWave(name, { lanes = ["a", "b"], mailbox = true, manifest = {} } = {}) {
  const root = path.join(TMP, name);
  const primary = path.join(root, "primary");
  fs.mkdirSync(path.join(primary, "specs"), { recursive: true });
  git(root, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(primary, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(primary, ".gitignore"), ".current/\n");
  const M = path.join(primary, "specs", "fanout-fx.md");
  fs.writeFileSync(M, manifestText(manifest));
  git(primary, "add", "-A");
  git(primary, "commit", "-q", "-m", "base");
  git(primary, "remote", "add", "origin", path.join(root, "origin.git"));
  git(primary, "push", "-q", "origin", "main");
  await writeState(primary, { feature: "wave-fx", status: "PASS", lastAgent: "qa-engineer", hop: 7 });
  const wt = {};
  for (const l of lanes) {
    wt[l] = path.join(root, "lanes", l);
    git(primary, "worktree", "add", "-q", "-b", `feat/${l}`, wt[l]);
    fs.writeFileSync(path.join(wt[l], `${l}.txt`), "x\n");
    git(wt[l], "add", "-A");
    git(wt[l], "commit", "-q", "-m", `lane ${l}`);
    await writeState(wt[l], { feature: `f-${l}`, hop: 3 });
  }
  const mb = path.join(root, "lanes", "_mailbox");
  if (mailbox) {
    fs.mkdirSync(path.join(mb, "a"), { recursive: true });
    fs.writeFileSync(path.join(mb, "a", "to-integrator.md"), "# a → integrator\n\n" + msg(1, "a") + msg(2, "a"));
    fs.writeFileSync(path.join(mb, "a", "to-lane.md"), "# integrator → a\n\n" + msg(1, "integrator"));
  }
  return { root, primary, M, wt, mb };
}

/** Generate and paste the section into the manifest (uncommitted, as an integrator would). */
function paste(w, args = []) {
  const g = run([w.M, ...args]);
  assert.equal(g.status, 0, g.stderr);
  fs.appendFileSync(w.M, "\n" + g.stdout);
  return g;
}

// --- AC-E284-1 --------------------------------------------------------------------------------------------------

test("generate fills facts", async () => {
  const w = await makeWave("gen");
  const r = run([w.M]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "", "a mailbox header is present, so no note");
  const main7 = sha7(w.primary, "main");
  const expected = [
    "## 接手步驟",
    INTRO,
    "### 核對 primary",
    `- 目標分支：main @ ${main7}`,
    "- 目標分支對 origin：一致",
    "- git status：乾淨",
    "- worktree：primary（main）；../lanes/a（feat/a）；../lanes/b（feat/b）",
    "- lane-status：primary（main）wave-fx／PASS／qa-engineer，hop 7，commits 0，clean；" +
      "a（feat/a）f-a／In_Progress／sr-engineer，hop 3，commits 1，clean；" +
      "b（feat/b）f-b／In_Progress／sr-engineer，hop 3，commits 1，clean",
    "### 已結案",
    PH_CLOSED,
    "### 待人類決定",
    PH_DECIDE,
    "### 進行中的背景工作",
    "- 未 push 的 commit：feat/a 1；feat/b 1",
    "- 信箱：a to-integrator 2／to-lane 1",
    "- watch baseline：node scripts/mailbox-watch.mjs ../lanes/_mailbox/a/to-integrator.md --baseline 2",
    "",
  ].join("\n");
  assert.equal(r.stdout, expected);
  // the watch baseline is exactly the watcher's own re-arm command for the same relative file
  const rearm = formatRearmCommand([{ file: "../lanes/_mailbox/a/to-integrator.md", key: "a", lastRead: 2 }]).slice("re-arm with: ".length);
  assert.equal(facts(r.stdout).get("watch baseline"), rearm);
  // no machine-local path: neither the temp root nor its unresolved spelling appears
  assert.ok(!r.stdout.includes(TMP), "stdout must not contain the temp root");
  assert.ok(!r.stdout.includes(os.tmpdir()), "stdout must not contain the temp dir");
  // the wrapper routes `handoff` to the same function
  const c = cli([w.M]);
  assert.equal(c.status, 0, c.stderr);
  assert.equal(c.stdout, r.stdout);
});

// --- AC-E284-2 --------------------------------------------------------------------------------------------------

test("skeleton passes validate", async () => {
  // no background: no lane worktrees or branches, no mailbox dirs, no integration branch, nothing unpushed, no lock
  const w = await makeWave("validate-none", { lanes: [], mailbox: false });
  const g = run([w.M]);
  assert.equal(g.status, 0, g.stderr);
  assert.match(g.stdout, /\n### 進行中的背景工作\n無\n$/, "background reads exactly 無");
  const closed = manifestText({ status: CLOSED_STATUS }) + "\n" + g.stdout;
  assert.deepEqual(validateManifest(closed).errors, [], "closed manifest + generated section validates");
  assert.deepEqual(validateManifest(manifestText() + "\n" + g.stdout).errors, [], "open manifest + section validates");

  // background present: the tool lists it and never writes 無 over it
  const b = await makeWave("validate-bg");
  const gb = run([b.M]);
  assert.equal(gb.status, 0, gb.stderr);
  assert.ok(!/\n### 進行中的背景工作\n無\n/.test(gb.stdout), "no 無 over live facts");
  assert.ok(facts(gb.stdout).has("信箱") && facts(gb.stdout).has("未 push 的 commit"));
  const codes = validateManifest(manifestText({ status: CLOSED_STATUS }) + "\n" + gb.stdout).errors.map((e) => e.code);
  assert.deepEqual(codes, ["HANDOFF_BACKGROUND_NOT_NONE"]);
  assert.deepEqual(validateManifest(manifestText() + "\n" + gb.stdout).errors, [], "open manifest is not handoff-checked");
});

// --- AC-E284-3 --------------------------------------------------------------------------------------------------

test("target relation", async () => {
  const w = await makeWave("relation", { lanes: [], mailbox: false });
  const rel = () => facts(run([w.M]).stdout).get("目標分支對 origin");
  const base = git(w.primary, "rev-parse", "main");
  assert.equal(rel(), "一致");
  // ahead: one local commit not on origin
  fs.writeFileSync(path.join(w.primary, "l1.txt"), "1\n");
  git(w.primary, "add", "l1.txt");
  git(w.primary, "commit", "-q", "-m", "local 1");
  const local1 = git(w.primary, "rev-parse", "HEAD");
  assert.equal(rel(), "本機領先 1");
  // behind: origin/main two commits past local main (a side commit chain made on a scratch branch)
  git(w.primary, "update-ref", "refs/remotes/origin/main", local1);
  git(w.primary, "branch", "-q", "scratch", local1);
  git(w.primary, "checkout", "-q", "scratch");
  fs.writeFileSync(path.join(w.primary, "s1.txt"), "1\n");
  git(w.primary, "add", "s1.txt");
  git(w.primary, "commit", "-q", "-m", "s1");
  fs.writeFileSync(path.join(w.primary, "s2.txt"), "2\n");
  git(w.primary, "add", "s2.txt");
  git(w.primary, "commit", "-q", "-m", "s2");
  const s2 = git(w.primary, "rev-parse", "HEAD");
  git(w.primary, "checkout", "-q", "main");
  git(w.primary, "update-ref", "refs/remotes/origin/main", s2);
  assert.equal(rel(), "本機落後 2");
  // diverged: local main gets its own commit on top of local1
  fs.writeFileSync(path.join(w.primary, "l2.txt"), "2\n");
  git(w.primary, "add", "l2.txt");
  git(w.primary, "commit", "-q", "-m", "local 2");
  assert.equal(rel(), "分岔（本機 +1／origin +2）");
  // no origin/main ref at all
  git(w.primary, "update-ref", "-d", "refs/remotes/origin/main");
  assert.equal(rel(), "origin/main 不存在");
  // --target names another branch: the facts use it
  git(w.primary, "branch", "-q", "integ/x", base);
  const t = facts(run([w.M, "--target", "integ/x"]).stdout);
  assert.equal(t.get("目標分支"), `integ/x @ ${base.slice(0, 7)}`);
  assert.equal(t.get("目標分支對 origin"), "origin/integ/x 不存在");
  // an unresolvable --target is an input error
  for (const bad of ["nope/never", "--upload-pack=x"]) {
    const r = run([w.M, "--target", bad]);
    assert.equal(r.status, 2, bad);
    assert.match(r.stderr, /^fanout: error: REF_NOT_FOUND:/m, bad);
    assert.equal(r.stdout, "");
  }
});

// --- AC-E284-4 --------------------------------------------------------------------------------------------------

test("status, foreign worktrees, watch-lock", async () => {
  const w = await makeWave("status");
  // the manifest's own edit is left out; another change in primary is listed in porcelain form
  fs.appendFileSync(w.M, "\n手寫備註\n");
  assert.equal(facts(run([w.M]).stdout).get("git status"), "乾淨", "the manifest itself never makes primary dirty");
  fs.writeFileSync(path.join(w.primary, "new.txt"), "n\n");
  fs.writeFileSync(path.join(w.primary, ".gitignore"), ".current/\n# x\n");
  const f1 = facts(run([w.M]).stdout);
  assert.equal(f1.get("git status"), "2 項： M .gitignore；?? new.txt");
  assert.match(f1.get("lane-status"), /^primary（main）[^；]*，dirty；/, "primary row follows the git status fact");
  // a worktree on a branch that is not a lane of this manifest: marked, and no lane-status row
  const other = path.join(w.root, "lanes", "zz");
  git(w.primary, "worktree", "add", "-q", "-b", "other/zz", other);
  await writeState(other, { feature: "someone-else" });
  const f2 = facts(run([w.M]).stdout);
  assert.ok(f2.get("worktree").endsWith("；../lanes/zz（other/zz） ［別的清單］"), f2.get("worktree"));
  assert.ok(!f2.get("lane-status").includes("other/zz") && !f2.get("lane-status").includes("someone-else"), f2.get("lane-status"));
  assert.ok(!f2.has("監看"), "no lock yet");
  // a watch-lock beside a lane's to-integrator.md, named the way the watcher names it
  fs.writeFileSync(scriptWatchLockPath(path.join(w.mb, "a", "to-integrator.md")), "pid\n");
  assert.equal(facts(run([w.M]).stdout).get("監看"), "a/to-integrator.md");
  fs.writeFileSync(scriptWatchLockPath(path.join(w.mb, "a", "to-lane.md")), "pid\n");
  assert.equal(facts(run([w.M]).stdout).get("監看"), "a/to-integrator.md、a/to-lane.md");
});

// --- AC-E284-5 --------------------------------------------------------------------------------------------------

test("integration branch and --closing", async () => {
  const w = await makeWave("integ", { mailbox: false });
  git(w.primary, "branch", "-q", "integ/fx", "main");
  git(w.primary, "checkout", "-q", "integ/fx");
  fs.writeFileSync(path.join(w.primary, "i.txt"), "i\n");
  git(w.primary, "add", "i.txt");
  git(w.primary, "commit", "-q", "-m", "integ 1");
  const integ7 = sha7(w.primary, "integ/fx");
  git(w.primary, "checkout", "-q", "main");

  // primary on main: the integration branch is background work, dropped under --closing
  const plain = run([w.M]);
  const fp = facts(plain.stdout);
  assert.equal(fp.get("整合分支"), `integ/fx @ ${integ7}（origin 無）`);
  assert.equal(fp.get("未 push 的 commit"), "integ/fx 1；feat/a 1；feat/b 1");
  const closing = run([w.M, "--closing"]);
  assert.equal(closing.status, 0, closing.stderr);
  const fc = facts(closing.stdout);
  assert.ok(!fc.has("整合分支"));
  assert.equal(fc.get("未 push 的 commit"), "feat/a 1；feat/b 1");
  // with primary on main, --closing changes nothing but those two omissions
  const strip = (s) =>
    s
      .split("\n")
      .filter((l) => !l.startsWith("- 整合分支："))
      .map((l) => (l.startsWith("- 未 push 的 commit：") ? l.replace("integ/fx 1；", "") : l))
      .join("\n");
  assert.equal(closing.stdout, strip(plain.stdout));

  // primary standing on the integration branch
  git(w.primary, "checkout", "-q", "integ/fx");
  const snap = facts(run([w.M]).stdout);
  assert.ok(snap.get("worktree").startsWith("primary（integ/fx）；"), snap.get("worktree"));
  assert.match(snap.get("lane-status"), /^primary（integ\/fx）wave-fx／PASS／qa-engineer，hop 7，commits 1，clean；/);
  const head7 = sha7(w.primary, "HEAD");
  const ann = facts(run([w.M, "--closing"]).stdout);
  assert.ok(ann.get("worktree").startsWith(`primary（main ← integ/fx @ ${head7}）；`), ann.get("worktree"));
  assert.match(ann.get("lane-status"), new RegExp(`^primary（main ← integ/fx @ ${head7}）wave-fx／PASS／qa-engineer，hop 7，commits 0，clean；`));
  assert.ok(!ann.has("整合分支"));

  // --closing with --check is a usage error
  const u = run(["--check", w.M, "--closing"]);
  assert.equal(u.status, 2);
  assert.match(u.stderr, /^fanout: error: USAGE:/m);
  assert.ok(u.stderr.includes("usage: node scripts/fanout.mjs handoff [--check] <manifest>"), u.stderr);
});

// --- AC-E284-6 --------------------------------------------------------------------------------------------------

test("check clean", async () => {
  const w = await makeWave("clean");
  paste(w);
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "fanout handoff --check: 8 fact(s) checked, 0 differ, 0 moved\n", "only the summary line");
  // hand-written judgement text does not count
  const text = fs
    .readFileSync(w.M, "utf8")
    .replace(PH_CLOSED, "- wave fx：兩條 lane 都已合併，紀錄在 lane 目錄。")
    .replace(PH_DECIDE, "- 下一波先等人類決定。\n另一行說明，不是事實欄位。\n- 備註：隨手記下的東西");
  fs.writeFileSync(w.M, text);
  const r2 = run(["--check", w.M]);
  assert.equal(r2.status, 0, r2.stdout);
  assert.equal(r2.stdout, "fanout handoff --check: 8 fact(s) checked, 0 differ, 0 moved\n");
  // the CLI agrees, with exit 0
  const c = cli(["--check", w.M]);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.equal(c.stdout, r2.stdout);
});

// --- AC-E284-7 --------------------------------------------------------------------------------------------------

/** Paste a fresh handoff, apply `change`, check; returns the sorted DIFF keys and the result. */
async function diffAfter(name, change, opts) {
  const w = await makeWave(name, opts);
  paste(w);
  await change(w);
  const r = run(["--check", w.M]);
  return { r, keys: diffLines(r).map(keyOf).sort(), w };
}

test("check names each difference", async () => {
  const cases = [
    // a new message to the lane changes only the mailbox count (the watch baseline tracks to-integrator only)
    ["mailbox", (w) => fs.appendFileSync(path.join(w.mb, "a", "to-lane.md"), msg(2, "integrator")), ["信箱"]],
    // a new message to the integrator also moves the watch baseline
    ["mailbox-in", (w) => fs.appendFileSync(path.join(w.mb, "a", "to-integrator.md"), msg(3, "a")), ["watch baseline", "信箱"]],
    ["hop", (w) => writeState(w.wt.b, { feature: "f-b", hop: 4, lastAgent: "code-reviewer" }), ["lane-status"]],
    // primary's row reads clean / dirty from the same status fact
    ["dirty", (w) => fs.writeFileSync(path.join(w.primary, "new.txt"), "n\n"), ["git status", "lane-status"]],
    ["worktree", (w) => git(w.primary, "worktree", "add", "-q", "-b", "other/zz", path.join(w.root, "lanes", "zz")), ["worktree"]],
    [
      "origin-ahead",
      (w) => {
        git(w.primary, "checkout", "-q", "-b", "scratch");
        fs.writeFileSync(path.join(w.primary, "o.txt"), "o\n");
        git(w.primary, "add", "o.txt");
        git(w.primary, "commit", "-q", "-m", "o");
        git(w.primary, "push", "-q", "origin", "scratch:main");
        git(w.primary, "checkout", "-q", "main");
        git(w.primary, "branch", "-q", "-D", "scratch");
        git(w.primary, "fetch", "-q", "origin");
      },
      ["目標分支對 origin"],
    ],
    [
      "fact-deleted",
      (w) => fs.writeFileSync(w.M, fs.readFileSync(w.M, "utf8").replace(/^- worktree：.*\n/m, "")),
      ["worktree"],
    ],
  ];
  for (const [name, change, keys] of cases) {
    const { r } = await diffAfter(`d-${name}`, change);
    const got = diffLines(r).map(keyOf).sort();
    assert.deepEqual(got, [...keys].sort(), `${name}: ${r.stdout}`);
    assert.equal(r.status, 1, name);
    assert.deepEqual(movedLines(r), [], name);
    for (const l of diffLines(r)) assert.match(l, /^DIFF  .+: handoff「.*」／repo「.*」$/, l);
    assert.match(summary(r), new RegExp(`, ${keys.length} differ, 0 moved$`), name);
    if (name === "fact-deleted") assert.ok(diffLines(r)[0].includes("handoff「（缺）」"), r.stdout);
    if (name === "dirty") assert.ok(r.stdout.includes("repo「1 項：?? new.txt」"), r.stdout);
  }

  // a background fact appears while the handoff says 無: absent on the handoff side
  const none = await makeWave("d-bg", { lanes: [], mailbox: false });
  paste(none);
  assert.equal(run(["--check", none.M]).status, 0, "baseline clean");
  fs.mkdirSync(path.join(none.mb, "a"), { recursive: true });
  fs.writeFileSync(path.join(none.mb, "a", "to-lane.md"), msg(1, "integrator"));
  const bg = run(["--check", none.M]);
  assert.equal(bg.status, 1, bg.stdout);
  assert.deepEqual(diffLines(bg), ["DIFF  信箱: handoff「（缺）」／repo「a to-integrator -／to-lane 1」"]);
  // a background sub-item reading 無 wins over a background fact line written under another sub-item
  const misplaced = fs.readFileSync(none.M, "utf8").replace(PH_CLOSED, "- 信箱：a to-integrator -／to-lane 1");
  fs.writeFileSync(none.M, misplaced);
  const bg2 = run(["--check", none.M]);
  assert.equal(bg2.status, 1, bg2.stdout);
  assert.deepEqual(diffLines(bg2), ["DIFF  信箱: handoff「（缺）」／repo「a to-integrator -／to-lane 1」"]);

  // several changes, several lines
  const { r: many } = await diffAfter("d-many", async (w) => {
    fs.appendFileSync(path.join(w.mb, "a", "to-lane.md"), msg(2, "integrator"));
    await writeState(w.wt.a, { feature: "f-a", hop: 5 });
    git(w.primary, "worktree", "add", "-q", "-b", "other/yy", path.join(w.root, "lanes", "yy"));
  });
  assert.deepEqual(diffLines(many).map(keyOf).sort(), ["lane-status", "worktree", "信箱"].sort(), many.stdout);
  assert.equal(many.status, 1);
});

// --- AC-E284-8 --------------------------------------------------------------------------------------------------

test("target moved forward", async () => {
  const w = await makeWave("moved", { lanes: [], mailbox: false });
  paste(w);
  const old7 = sha7(w.primary, "main");
  // main moves forward by two commits and is pushed, so only the target sha differs
  for (const n of [1, 2]) {
    fs.writeFileSync(path.join(w.primary, `m${n}.txt`), `${n}\n`);
    git(w.primary, "add", `m${n}.txt`);
    git(w.primary, "commit", "-q", "-m", `m${n}`);
  }
  git(w.primary, "push", "-q", "origin", "main");
  const new7 = sha7(w.primary, "main");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(diffLines(r), []);
  assert.deepEqual(movedLines(r), [`MOVED  目標分支: handoff「main @ ${old7}」／repo「main @ ${new7}」（前進 2 個 commit）`]);
  assert.match(summary(r), /, 0 differ, 1 moved$/);

  // a recorded sha that is not an ancestor of the target, or that does not resolve, is a DIFF
  const sideRoot = git(w.primary, "commit-tree", "-m", "side", git(w.primary, "rev-parse", "main^{tree}"));
  for (const bogus of [sideRoot.slice(0, 7), "0000000"]) {
    fs.writeFileSync(w.M, fs.readFileSync(w.M, "utf8").replace(/^- 目標分支：main @ [0-9a-f]+$/m, `- 目標分支：main @ ${bogus}`));
    const d = run(["--check", w.M]);
    assert.equal(d.status, 1, `${bogus}: ${d.stdout}`);
    assert.deepEqual(diffLines(d).map(keyOf), ["目標分支"], d.stdout);
    assert.deepEqual(movedLines(d), []);
  }
});

// --- AC-E284-12 -------------------------------------------------------------------------------------------------

/** Primary on integ/fx, ahead of main and origin/main; the --closing section is pasted into the closed manifest and committed there. */
async function closingWave(name) {
  const w = await makeWave(name, { lanes: [], mailbox: false });
  git(w.primary, "checkout", "-q", "-b", "integ/fx");
  fs.writeFileSync(path.join(w.primary, "work.txt"), "w\n");
  git(w.primary, "add", "work.txt");
  git(w.primary, "commit", "-q", "-m", "wave work");
  const head7 = sha7(w.primary, "HEAD");
  const g = run([w.M, "--closing"]);
  assert.equal(g.status, 0, g.stderr);
  fs.writeFileSync(w.M, manifestText({ lanes: ["a", "b"], status: CLOSED_STATUS }) + "\n" + g.stdout);
  assert.deepEqual(validateManifest(fs.readFileSync(w.M, "utf8")).errors, [], "the closed manifest with the closing section validates");
  git(w.primary, "add", "-A");
  git(w.primary, "commit", "-q", "-m", "close wave");
  return { ...w, head7 };
}

test("closing round trip", async () => {
  const w = await closingWave("round");
  assert.ok(fs.readFileSync(w.M, "utf8").includes(`primary（main ← integ/fx @ ${w.head7}）`));
  // the wave PR merges, origin/main follows, primary returns to main and the integration branch is deleted
  git(w.primary, "checkout", "-q", "main");
  git(w.primary, "merge", "-q", "--no-ff", "-m", "merge wave", "integ/fx");
  git(w.primary, "push", "-q", "origin", "main");
  git(w.primary, "branch", "-q", "-D", "integ/fx");
  const r = run(["--check", w.M]);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(diffLines(r), [], r.stdout);
  assert.deepEqual(movedLines(r).map(keyOf).sort(), ["lane-status", "worktree", "目標分支"].sort(), r.stdout);
  for (const k of ["worktree", "lane-status"]) {
    const l = movedLines(r).find((x) => keyOf(x) === k);
    assert.ok(l.endsWith(`（integ/fx @ ${w.head7} 已合併進 main）`), l);
  }
  assert.ok(movedLines(r).find((x) => keyOf(x) === "目標分支").endsWith("（前進 3 個 commit）"), r.stdout);

  // primary elsewhere than the target: the annotation does not resolve to a move
  git(w.primary, "checkout", "-q", "-b", "later");
  const elsewhere = run(["--check", w.M]);
  assert.equal(elsewhere.status, 1, elsewhere.stdout);
  assert.deepEqual(diffLines(elsewhere).map(keyOf).sort(), ["lane-status", "worktree"].sort(), elsewhere.stdout);
  git(w.primary, "checkout", "-q", "main");
  git(w.primary, "branch", "-q", "-D", "later");

  // after the merge, a primary-row change (a later release) is still a DIFF
  await writeState(w.primary, { feature: "release-next", status: "In_Progress", lastAgent: "release-engineer", hop: 7 });
  const s = run(["--check", w.M]);
  assert.equal(s.status, 1, s.stdout);
  assert.deepEqual(diffLines(s).map(keyOf), ["lane-status"], s.stdout);
  assert.ok(movedLines(s).some((x) => keyOf(x) === "worktree"), s.stdout);
});

test("closing round trip: not merged is a DIFF", async () => {
  const w = await closingWave("unmerged");
  // the same handoff, kept outside the repo: main's copy of the manifest predates the closing commit
  const kept = path.join(w.root, "closed.md");
  fs.copyFileSync(w.M, kept);
  // primary goes back to main but the integration branch was never merged
  git(w.primary, "checkout", "-q", "main");
  const r = run(["--check", kept, "--repo", w.primary]);
  assert.equal(r.status, 1, r.stdout);
  const keys = diffLines(r).map(keyOf);
  assert.ok(keys.includes("worktree") && keys.includes("lane-status"), r.stdout);
  assert.ok(!movedLines(r).some((x) => ["worktree", "lane-status"].includes(keyOf(x))), r.stdout);
});

// --- AC-E284-9 --------------------------------------------------------------------------------------------------

test("errors", async () => {
  const w = await makeWave("errors", { lanes: ["a"], mailbox: false });
  const sec = run([w.M]).stdout;
  const write = (name, text) => {
    const p = path.join(w.root, name);
    fs.writeFileSync(p, text);
    return p;
  };
  const expectErr = (r, code, label) => {
    assert.equal(r.status, 2, `${label}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, new RegExp(`^fanout: error: ${code}:`, "m"), `${label}: ${r.stderr}`);
    assert.ok(!STACK_LINE.test(r.stderr), `${label}: no stack trace: ${r.stderr}`);
    assert.equal(r.stdout, "", label);
  };
  // the manifests below live outside primary, so --repo names it
  const repo = ["--repo", w.primary];
  expectErr(cli(["--check", write("none.md", manifestText()), ...repo]), "HANDOFF_SECTION_ABSENT", "no section");
  expectErr(cli(["--check", write("two.md", manifestText() + "\n" + sec + "\n" + sec), ...repo]), "HANDOFF_SECTION_DUPLICATE", "two sections");
  const dupFact = sec.replace(/^(- git status：.*)$/m, "$1\n$1");
  const df = cli(["--check", write("dupfact.md", manifestText() + "\n" + dupFact), ...repo]);
  expectErr(df, "HANDOFF_FACT_DUPLICATE", "duplicate fact");
  assert.match(df.stderr, /fact "git status" appears on 2 lines \(lines \d+, \d+\)/, df.stderr);

  // errors shared by both modes
  const rowErr = write("rowerr.md", manifestText({ extraRows: ["| c | E3 | feat/c | ../lanes/c | `tools/c.ts` |"] }) + "\n" + sec);
  const notGit = fs.mkdtempSync(path.join(TMP, "not-git-"));
  const okManifest = write("ok.md", manifestText() + "\n" + sec);
  for (const mode of [[], ["--check"]]) {
    const label = mode.length ? "check" : "generate";
    const rr = cli([...mode, rowErr, ...repo]);
    assert.equal(rr.status, 2, `${label} row error: ${rr.stderr}`);
    assert.match(rr.stderr, /^fanout: error: [A-Z_]+:/m);
    assert.ok(!STACK_LINE.test(rr.stderr));
    expectErr(cli([...mode, path.join(w.root, "missing.md"), ...repo]), "MANIFEST_UNREADABLE", `${label} unreadable`);
    expectErr(cli([...mode, okManifest, "--repo", notGit]), "REPO_NOT_GIT", `${label} not git`);
    for (const bad of [["--bogus"], ["--target"], ["extra.md"], ["--repo", w.primary]]) {
      expectErr(cli([...mode, okManifest, ...repo, ...bad]), "USAGE", `${label} ${bad.join(" ")}`);
    }
  }
  // --check is recognised only right after handoff
  expectErr(cli([okManifest, "--check", ...repo]), "USAGE", "--check not first");
  expectErr(cli([]), "USAGE", "no manifest");
});

// --- AC-E284-10 -------------------------------------------------------------------------------------------------

test("read-only and no mailbox", async () => {
  const w = await makeWave("readonly");
  paste(w);
  fs.writeFileSync(watchLockPath(path.join(w.mb, "a", "to-integrator.md")), "pid\n");
  const files = [w.M, path.join(w.mb, "a", "to-integrator.md"), path.join(w.mb, "a", "to-lane.md")];
  const hash = (f) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  const snapshot = () => [
    ...files.map(hash),
    git(w.primary, "rev-parse", "HEAD"),
    git(w.primary, "status", "--porcelain"),
    git(w.primary, "branch", "--list"),
    git(w.primary, "for-each-ref", "refs/remotes"),
    ...Object.values(w.wt).map((p) => git(p, "status", "--porcelain")),
  ];
  const before = snapshot();
  for (const args of [[w.M], ["--check", w.M], [w.M, "--closing"], [w.M, "--target", "feat/a"]]) {
    const r = cli(args);
    assert.ok(r.status === 0 || r.status === 1, `${args.join(" ")}: ${r.stderr}`);
    assert.deepEqual(snapshot(), before, `${args.join(" ")} changed the repo or a mailbox file`);
  }

  // no mailbox header and no --mailbox-root: no mailbox facts, a note on stderr, exit unaffected
  const noMb = path.join(w.primary, "specs", "fanout-nomb.md");
  fs.writeFileSync(noMb, manifestText({ mailbox: null }));
  const g = cli([noMb]);
  assert.equal(g.status, 0, g.stderr);
  assert.equal(g.stderr, NO_MAILBOX_NOTE + "\n");
  const f = facts(g.stdout);
  for (const k of ["信箱", "watch baseline", "監看"]) assert.ok(!f.has(k), `${k} must not be collected`);
  assert.ok(f.has("未 push 的 commit"), "other background facts are still collected");
  fs.appendFileSync(noMb, "\n" + g.stdout);
  const c = cli(["--check", noMb]);
  assert.equal(c.status, 0, c.stdout);
  assert.equal(c.stderr, NO_MAILBOX_NOTE + "\n");
  // --mailbox-root supplies the root when the header is absent
  const withRoot = facts(run([noMb, "--mailbox-root", w.mb]).stdout);
  assert.equal(withRoot.get("信箱"), "a to-integrator 2／to-lane 1");
  assert.equal(withRoot.get("監看"), "a/to-integrator.md");
});

// --- AC-E284-11 -------------------------------------------------------------------------------------------------

test("mailbox-watch parity", () => {
  // WHY: the module re-derives these two because tools/ cannot import the script; a drift would make the
  // generated `watch baseline` / `監看` facts disagree with what the watcher actually does.
  const one = [{ file: "../lanes/_mailbox/a/to-integrator.md", key: "a", lastRead: 2 }];
  const several = [
    { file: "../lanes/_mailbox/a/to-integrator.md", key: "a", lastRead: 2 },
    { file: "../lanes/_mailbox/b/to-integrator.md", key: "b", lastRead: 0 },
    { file: "../lanes/_mailbox/c d/to-integrator.md", key: "c d", lastRead: 11 },
  ];
  for (const entries of [one, several]) {
    assert.equal(formatWatchCommand(entries), formatRearmCommand(entries).slice("re-arm with: ".length));
    assert.ok(formatRearmCommand(entries).startsWith("re-arm with: "));
  }
  for (const f of ["to-integrator.md", path.join(TMP, "x", "to-lane.md"), "../lanes/_mailbox/a/to-integrator.md", "a b/c.md"]) {
    assert.equal(watchLockPath(f), scriptWatchLockPath(f), f);
  }
});
