// Coded by @qa-engineer
// Tests (T-E351-02) for specs/e351-lane-protocol-gaps.md AC-E352-1, 2 and AC-E351-1..6(d).
// WHY: docs/lane-protocol.md is the generic rulebook every adopter's lanes read. Under `artifacts: local` the
// lane must not commit agc's excluded paths and must know how evidence and findings reach primary; with no
// addendum and no `agc` on PATH it needs a runnable call form. These tests pin the exact copy, its position
// next to the unchanged neighbours, and that every path list it names still matches bin/agc-init.mjs (parsed
// as text, so a reformat of the tool does not turn this red but a real change in the lists does).
// Resident-test hygiene: no fixed sha, no real specs/fanout-*.md content; files read relative to the repo root.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const GENERIC = read("docs/lane-protocol.md");
const LINES = GENERIC.split("\n");
const count = (hay, needle) => hay.split(needle).length - 1;

// Section text (heading line through the line before the next "## " heading), as a line array.
function sec(prefix) {
  const start = LINES.findIndex((l) => l.startsWith(prefix));
  assert.ok(start >= 0, `heading ${prefix} present`);
  let end = LINES.length;
  for (let i = start + 1; i < LINES.length; i++) if (LINES[i].startsWith("## ")) { end = i; break; }
  return LINES.slice(start, end);
}
const nextLine = (lines, exact) => {
  const i = lines.indexOf(exact);
  assert.ok(i >= 0, `line present: ${exact.slice(0, 40)}...`);
  return lines[i + 1];
};

const S1_OLD =
  "   `agc` 不在 PATH 上時的呼叫方式、worktree 建好之後要先跑的建置指令（若有），見補充規則；建置指令在 worktree 裡跑。";
const S1_FALLBACK =
  "   `agc` 不在 PATH 上時，改用 agc 安裝位置下的 `bin/agc-init.mjs`，即 `node <agc 安裝位置>/bin/agc-init.mjs`，後面接同樣的子指令與參數；補充規則可指定本 repo 的呼叫方式。worktree 建好之後要先跑的建置指令（若有）見補充規則；建置指令在 worktree 裡跑。";
const S3_COMMIT_KEPT =
  "- 在自己的 branch 上 commit：`.current/<lane>/` 整個目錄（E125a 之後，task 帳本 `.current/<lane>/tasks.md` 也在裡面）、`qa_reports/`、`review_reports/`、`specs/`，以及補充規則列出的 tracked 建置產物。不 commit `.current/` 頂層的工作檔，補充規則列出的例外除外。";
const S3_LOCAL =
  "- **`artifacts: local` 的 repo**（`.current/.config.json` 的 `artifacts` 是 `local`：agc 的工作檔不進 repo 歷史）：`.current/`、root `tasks.md`、`qa_reports/`、`review_reports/` 被 git exclude，lane **不 commit 這些路徑**（也不要用 `git add -f` 硬加）；`specs/` 照樣 tracked，照上一條 commit。";
const S3_HARVEST =
  "  - 證據不靠 commit 進到 primary，靠整合者跑 `agc feature finish` 時的收割：`--shipped` 把 worktree 裡被 ignore 又沒 tracked 的 `qa_reports/`、`review_reports/`、`specs/` 檔案複製到 primary 的 `<目錄>/archive/<lane>/`，並把 `.current/<lane>/` 整個複製到 primary 的 `.current/history/<YYYY-MM>/<lane>/`；`--abandoned` 把 `qa_reports/`、`review_reports/` 第一層檔名帶 lane 名（不分大小寫）的檔案搬進 `<目錄>/abandoned/<lane>/`（被 ignore 的在 primary 的同一路徑留一份），`.current/<lane>/` 一樣複製進 primary 的 history。";
const S3_GAPS =
  "  - 已知缺口：E196（`.current/<lane>/` 只有一部分 tracked 時，`--shipped` 第一次跑不會把其中被 ignore 的檔案搬進 history）；E217（`--abandoned` 不收割 `specs/`：被 ignore 的 spec 會隨 worktree 一起刪掉）。";
const S4_COMMIT_KEPT =
  "- **`pending-tickets.md` 一定要 commit 進你的 branch**：只存在 worktree、從未 commit 的檔案不會配號 —— finish 警告並列出這些發現，在 primary 的 `.current/history/<YYYY-MM>/<lane>/` 留一份（不 commit），由整合者手動建票。";
const S4_LOCAL =
  "- **`artifacts: local` 的 repo**：`.current/` 被 git exclude，`pending-tickets.md` 進不了 branch，所以 finish 一律走上一條「從未 commit」的路徑 —— 不配號，警告並列出這些發現，在 primary 的 `.current/history/<YYYY-MM>/<lane>/` 留一份，由整合者從那份手動建票。新發現照樣寫進 `.current/<lane>/pending-tickets.md`、照同樣的 block 格式，不要改寫到別處。";

test("AC-E352-1: §1 holds the generic agc fallback line once; the old line is gone", () => {
  const s1 = sec("## 1. ");
  assert.equal(s1.filter((l) => l === S1_FALLBACK).length, 1);
  assert.ok(!GENERIC.includes(S1_OLD), "old addendum-only line removed");
  // still defers the build command to the addendum
  assert.ok(S1_FALLBACK.includes("見補充規則"));
});

test("AC-E352-2: §1 fallback and §5 fan-out sentence use the same node <agc 安裝位置>/<path> form", () => {
  const s1 = sec("## 1. ").join("\n");
  const s5 = sec("## 5. ").join("\n");
  assert.ok(count(s1, "node <agc 安裝位置>/bin/agc-init.mjs") >= 1);
  assert.ok(count(s5, "node <agc 安裝位置>/scripts/fanout.mjs") >= 1);
});

test("AC-E351-1: §3 local-mode bullet sits directly after the unchanged commit bullet", () => {
  const s3 = sec("## 3. ");
  assert.equal(s3.filter((l) => l === S3_COMMIT_KEPT).length, 1, "commit bullet unchanged");
  assert.equal(nextLine(s3, S3_COMMIT_KEPT), S3_LOCAL);
  for (const p of ["`artifacts: local`", "`.current/`", "root `tasks.md`", "`qa_reports/`", "`review_reports/`", "`git add -f`", "`specs/`"]) {
    assert.ok(S3_LOCAL.includes(p), `local bullet names ${p}`);
  }
});

test("AC-E351-2: harvest sub-bullet directly follows the local bullet", () => {
  assert.equal(nextLine(sec("## 3. "), S3_LOCAL), S3_HARVEST);
});

test("AC-E351-3: known-gaps sub-bullet follows harvest; E196 and E217 each appear once, with their clause", () => {
  assert.equal(nextLine(sec("## 3. "), S3_HARVEST), S3_GAPS);
  assert.equal(count(GENERIC, "E196"), 1);
  assert.equal(count(GENERIC, "E217"), 1);
});

test("AC-E351-4: §4 keeps the pinned commit line once; the local-mode line follows it", () => {
  const s4 = sec("## 4. ");
  assert.equal(s4.filter((l) => l === S4_COMMIT_KEPT).length, 1);
  assert.equal(count(s4.join("\n"), S4_COMMIT_KEPT), 1);
  assert.equal(nextLine(s4, S4_COMMIT_KEPT), S4_LOCAL);
});

// Extract the `[...]` array literal assigned to a top-level const and return its string members as a set.
function constArray(src, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src);
  assert.ok(m, `${name} array literal found in bin/agc-init.mjs`);
  return [...m[1].matchAll(/"([^"]*)"|'([^']*)'/g)].map((x) => x[1] ?? x[2]).sort();
}
// Join the adjacent string pieces of a top-level const so line wrapping in the tool does not matter.
function constText(src, name) {
  const start = src.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `${name} found`);
  const end = src.indexOf(";\n", start);
  const pieces = [...src.slice(start, end).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => JSON.parse(`"${x[1]}"`));
  return pieces.join("").replace(/\s+/g, " ");
}

test("AC-E351-5: the path lists the doc names match bin/agc-init.mjs constants", () => {
  const src = read("bin/agc-init.mjs");
  assert.deepEqual(constArray(src, "ARTIFACT_EXCLUDE_RULES"), ["/.current/", "/qa_reports/", "/review_reports/", "/tasks.md"]);
  assert.deepEqual(constArray(src, "SHIPPED_EVIDENCE_DIRS"), ["qa_reports", "review_reports", "specs"]);
  const abandon = constArray(src, "ABANDON_EVIDENCE_DIRS");
  assert.deepEqual(abandon, ["qa_reports", "review_reports"]);
  assert.ok(!abandon.includes("specs"), "specs absent from abandon harvest is the E217 gap");
  const usage = constText(src, "STR_USAGE_FEATURE");
  assert.ok(
    usage.includes("is not numbered — finish warns, lists its findings and keeps a copy under .current/history/<YYYY-MM>/<lane>/"),
    "STR_USAGE_FEATURE still describes the never-committed pending-tickets.md path",
  );
});

test("AC-E351-6(d): no absolute local path in the generic file", () => {
  const bad = LINES.filter((l) => /(^|[\s(（`])\/(Users|home|private|tmp|var)\//.test(l));
  assert.deepEqual(bad, []);
});
