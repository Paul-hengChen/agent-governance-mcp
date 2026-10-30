// Coded by @qa-engineer
// Tests for specs/e385 slice of specs/e383-lane-ledger-and-worktree-evidence.md
// (AC-E385-1..6 and AC-E385-8). E385: evidence dirs stay real directories in a lane
// worktree (never symlinked back to primary) and `agc feature finish` harvests them;
// `agc check` flips to match: real dir / inside link silent, outside link or dangling
// link warn, exit code never affected. Linked-worktree fixtures are real `git init` +
// `git worktree add` repos in os.tmpdir(). Wording tests read shipped prose and assert
// load-bearing tokens only, never the growing real specs/fanout-*.md.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(ROOT, "bin", "agc-init.mjs");

const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
const { stripOriginTags } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));

const TMP_DIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(d);
  return d;
}
after(() => {
  for (const d of TMP_DIRS) fs.rmSync(d, { recursive: true, force: true });
});

function runAgc(cwd, args) {
  return spawnSync(process.execPath, [AGC_INIT, ...args], { cwd, encoding: "utf-8" });
}

function mkWorktreeFixture(prefix) {
  const primary = mkTmp(`${prefix}primary-`);
  execSync("git init -q", { cwd: primary });
  execSync("git config user.email a@b.c && git config user.name t", { cwd: primary });
  fs.writeFileSync(path.join(primary, "README.md"), "primary checkout\n");
  execSync("git add -A && git commit -q -m init", { cwd: primary });
  const worktree = path.join(mkTmp(`${prefix}wt-`), "lane");
  execSync(`git worktree add -q -b ${prefix.replace(/[^a-zA-Z0-9-]/g, "")}branch ${JSON.stringify(worktree)}`, { cwd: primary });
  return { primary, worktree };
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

const DIRS = ["qa_reports", "review_reports", "specs"];
const OUTSIDE = (rel) => `agc check — warning: ${rel}/ is a symlink that resolves outside this linked git worktree`;
const DANGLING = (rel) => `agc check — warning: ${rel}/ is a symlink that does not resolve to anything (dangling) in a linked git worktree`;

// ---------------------------------------------------------------------------
// AC-E385-1: coord.bootstrap-obligation
// ---------------------------------------------------------------------------

test("AC-E385-1: coord-03 carries the new bootstrap obligation between Lane-start default and Escalation Routes; old wording gone from content/; composed prompt carries it tag-stripped", () => {
  const coord03 = fs.readFileSync(path.join(ROOT, "content", "coord-03-core-fallback.md"), "utf-8");
  const iLane = coord03.indexOf("**Lane-start default**");
  const iOb = coord03.indexOf("**Worktree bootstrap obligation**");
  const iEsc = coord03.indexOf("\n\n## Escalation Routes", iOb) + 2;
  assert.ok(iLane >= 0 && iLane < iOb && iOb < iEsc, "order: Lane-start default < obligation < Escalation Routes");
  assert.equal(count(coord03, "**Worktree bootstrap obligation**"), 1);

  const para = coord03.slice(iOb, iEsc).trimEnd();
  assert.equal(para.split("\n").length, 1, "one paragraph line");
  assert.ok(para.startsWith("**Worktree bootstrap obligation**<!-- origin:start --> (E111, E385)<!-- origin:end -->: when the separate-worktree route is taken, do NOT symlink `qa_reports/`, `review_reports/` or `specs/` back to primary"));
  assert.ok(para.includes("cannot write through such a link, so code-review and QA evidence could not land"));
  assert.ok(para.includes("(`mkdir -p` it there when absent)"));
  assert.ok(para.includes("a lane worktree is torn down only by `agc feature finish`, never by a hand-run `git worktree remove`"));
  assert.ok(para.includes("A tracked-evidence repo carries evidence to the lane via the lane branch's own commits instead, no symlink needed."));
  assert.ok(para.endsWith("`agc check` warns (advisory only) when an evidence dir in a linked worktree is a symlink that resolves outside the worktree or does not resolve."));

  // Old wording must appear nowhere under content/.
  for (const f of fs.readdirSync(path.join(ROOT, "content"))) {
    const txt = fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
    assert.ok(!txt.includes("symlink back to primary each of"), `${f}: old symlink-step wording`);
    assert.ok(!txt.includes("needed ONLY when untracked"), `${f}: old precondition wording`);
  }

  const composed = composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), (g) =>
    fs.readFileSync(path.join(ROOT, "content", g), "utf-8"),
  );
  const stripped = stripOriginTags(composed);
  assert.ok(stripped.includes("**Worktree bootstrap obligation**: when the separate-worktree route is taken, do NOT symlink `qa_reports/`"), "tag-stripped paragraph in the composed prompt");
  assert.ok(!stripped.includes("origin:start"), "origin tags stripped");
});

// ---------------------------------------------------------------------------
// AC-E385-2: real evidence dirs are silent
// ---------------------------------------------------------------------------

test("AC-E385-2: empty real dir, ignored untracked content and the W3 shape are silent for each evidence dir; exit code equals the dir-absent baseline", () => {
  const baseline = runAgc(mkWorktreeFixture("e385-ac2-base-").worktree, ["check"]);
  for (const rel of DIRS) {
    // shape A: empty real dir
    {
      const { worktree } = mkWorktreeFixture("e385-ac2a-");
      fs.mkdirSync(path.join(worktree, rel));
      const r = runAgc(worktree, ["check"]);
      assert.doesNotMatch(r.stderr, new RegExp(`${rel}\\/`), `${rel}: empty real dir silent`);
      assert.equal(r.status, baseline.status, `${rel}: empty dir exit code == absent baseline`);
    }
    // shape B: real dir of ignored untracked files
    {
      const { worktree } = mkWorktreeFixture("e385-ac2b-");
      fs.writeFileSync(path.join(worktree, ".gitignore"), `${rel}/\n`);
      execSync("git add .gitignore && git commit -q -m ignore", { cwd: worktree });
      fs.mkdirSync(path.join(worktree, rel));
      fs.writeFileSync(path.join(worktree, rel, "e.md"), "evidence\n");
      const r = runAgc(worktree, ["check"]);
      assert.doesNotMatch(r.stderr, new RegExp(`${rel}\\/`), `${rel}: ignored untracked content silent`);
      assert.equal(r.status, baseline.status);
    }
    // shape C (W3): force-added tracked .gitkeep beside ignored untracked evidence
    {
      const { worktree } = mkWorktreeFixture("e385-ac2c-");
      fs.writeFileSync(path.join(worktree, ".gitignore"), `${rel}/\n`);
      fs.mkdirSync(path.join(worktree, rel));
      fs.writeFileSync(path.join(worktree, rel, ".gitkeep"), "");
      execSync(`git add -f .gitignore ${rel}/.gitkeep && git commit -q -m w3`, { cwd: worktree });
      fs.writeFileSync(path.join(worktree, rel, "e.md"), "evidence\n");
      const r = runAgc(worktree, ["check"]);
      assert.doesNotMatch(r.stderr, new RegExp(`${rel}\\/`), `${rel}: W3 shape silent`);
      assert.equal(r.status, baseline.status);
    }
  }
});

// ---------------------------------------------------------------------------
// AC-E385-3 / 4 / 5: link shapes
// ---------------------------------------------------------------------------

test("AC-E385-3: a symlink resolving into the primary checkout warns worktree-evidence.outside-link exactly once, exit 0", () => {
  const { primary, worktree } = mkWorktreeFixture("e385-ac3-");
  const target = path.join(primary, "qa_reports");
  fs.mkdirSync(target);
  fs.symlinkSync(target, path.join(worktree, "qa_reports"), "dir");
  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(count(r.stderr, OUTSIDE("qa_reports")), 1, r.stderr);
  assert.ok(r.stderr.includes("replace it with a real directory in the worktree: `agc feature finish` harvests git-ignored evidence into the primary checkout before it removes the worktree"));
  assert.equal(count(r.stderr, "agc check — warning: review_reports/"), 0, "no line for untouched dirs");
});

test("AC-E385-4: a dangling review_reports symlink warns worktree-evidence.dangling-link exactly once, exit 0", () => {
  const { worktree } = mkWorktreeFixture("e385-ac4-");
  fs.symlinkSync(path.join(os.tmpdir(), "e385-no-such-target-" + process.pid), path.join(worktree, "review_reports"), "dir");
  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(count(r.stderr, DANGLING("review_reports")), 1, r.stderr);
  assert.ok(r.stderr.includes("evidence writes into it fail; replace it with a real directory in the worktree: `agc feature finish` harvests git-ignored evidence"));
  assert.equal(count(r.stderr, OUTSIDE("review_reports")), 0, "dangling is not also reported as outside");
});

test("AC-E385-5: qa_reports -> ./local-evidence (resolves inside the worktree) is silent", () => {
  const { worktree } = mkWorktreeFixture("e385-ac5-");
  fs.mkdirSync(path.join(worktree, "local-evidence"));
  fs.symlinkSync("./local-evidence", path.join(worktree, "qa_reports"), "dir");
  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /qa_reports\//);
});

// ---------------------------------------------------------------------------
// AC-E385-6: unchanged shapes
// ---------------------------------------------------------------------------

test("AC-E385-6: tracked W5/W6/W7 silent, primary checkout produces zero worktree-evidence lines, removed warning strings gone from bin/agc-init.mjs", () => {
  const { worktree } = mkWorktreeFixture("e385-ac6-");
  fs.mkdirSync(path.join(worktree, "qa_reports"));
  fs.writeFileSync(path.join(worktree, "qa_reports", "r.md"), "tracked\n");
  fs.mkdirSync(path.join(worktree, "review_reports"));
  fs.writeFileSync(path.join(worktree, "review_reports", "r.md"), "tracked\n");
  fs.mkdirSync(path.join(worktree, "specs"));
  fs.writeFileSync(path.join(worktree, "specs", "f.md"), "v1\n");
  execSync("git add qa_reports review_reports specs && git commit -q -m tracked", { cwd: worktree });
  fs.writeFileSync(path.join(worktree, "review_reports", "wip.md"), "untracked straggler\n");
  fs.writeFileSync(path.join(worktree, "specs", "f.md"), "v2\n");
  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, r.stderr);
  for (const rel of DIRS) assert.doesNotMatch(r.stderr, new RegExp(`${rel}\\/`), `${rel} tracked shape silent`);

  const primary = mkTmp("e385-ac6-primary-");
  execSync("git init -q", { cwd: primary });
  execSync("git config user.email a@b.c && git config user.name t", { cwd: primary });
  fs.writeFileSync(path.join(primary, "README.md"), "p\n");
  execSync("git add -A && git commit -q -m init", { cwd: primary });
  fs.mkdirSync(path.join(primary, "qa_reports"));
  fs.writeFileSync(path.join(primary, "qa_reports", "x.md"), "real untracked in primary\n");
  const pr = runAgc(primary, ["check"]);
  assert.equal(pr.status, 0, pr.stderr);
  assert.doesNotMatch(pr.stderr, /symlink|worktree/, "primary checkout: zero worktree-evidence lines");

  const src = fs.readFileSync(AGC_INIT, "utf-8");
  assert.ok(!src.includes("is a real, untracked directory in a linked git worktree"));
  assert.ok(!src.includes("resolves INSIDE this worktree"));
});

// ---------------------------------------------------------------------------
// AC-E385-8: lane-protocol wording
// ---------------------------------------------------------------------------

test("AC-E385-8: lane-protocol §1 git bullet is doc.s1-git (PATH= refusal), §3 holds doc.s3-evidence exactly once directly after doc.s3-ledger", () => {
  const doc = fs.readFileSync(path.join(ROOT, "docs", "lane-protocol.md"), "utf-8");
  const lines = doc.split("\n");

  const s1 = "   - **git 一條一條下**：切進 worktree 的 session 有 git 防護，會拒絕 `git -C <primary> …`，也會拒絕任何含 git 的複合指令（例如 `a && git b`、`git a; b`）；前面帶環境變數指派的 git 指令（例如 `PATH=<dir>:$PATH git commit …`）屬於同一類，一樣會被拒絕。所以 git 指令一條一條下，每次 Bash 呼叫只放一條單純的 git 指令，前面不加任何 `NAME=value` 指派；git hook 因此找不到工具時，停下來寫信箱回報，不要繞過防護。";
  assert.equal(lines.filter((l) => l === s1).length, 1, "doc.s1-git exactly once, verbatim");
  assert.equal(lines.filter((l) => l.includes("**git 一條一條下**")).length, 1, "old bullet replaced, not duplicated");

  const evHead = "  - 證據目錄不 symlink（E385）：沒有 tracked 的 `qa_reports/`、`review_reports/`、`specs/` 在 worktree 裡一律是真目錄，**不要** symlink 回 primary";
  const ev = lines.flatMap((l, i) => (l.startsWith(evHead) ? [i] : []));
  assert.equal(ev.length, 1, "doc.s3-evidence exactly once");
  assert.ok(lines[ev[0] - 1].startsWith("  - task 帳本（E383）："), "directly after doc.s3-ledger");
  assert.ok(lines[ev[0]].endsWith("`agc check` 看到連到 worktree 外、或解析不到的證據目錄 symlink 會警告。"));
  assert.ok(lines[ev[0]].includes("所以 lane 的 worktree 只能由 `agc feature finish` 拆掉，不要手動 `git worktree remove`"));
});
