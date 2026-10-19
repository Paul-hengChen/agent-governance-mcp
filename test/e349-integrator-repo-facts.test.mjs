// Coded by @qa-engineer: pins for specs/e226-integrator-sop-portable.md AC-E349-1..2 (T-E349-02).
// WHY: the integrator SOP is generic, so this repo's own facts (shared-artifact list, build, dependency
// audit, bookkeeping check, CI check, repo-relative tool calls) belong in docs/lane-protocol-addendum.md
// or Constitution §6, not in the SOP text. AC-E349-3 (hard-condition tests e290/e294/e177a/e246/e289) is
// run by qa as its own command; those files are not edited by this lane.
// Reads only content files and the addendum (no real specs/fanout-*.md, no fixed base sha).
// Creation of this file was pre-authorized in the E226 qa dispatch brief (Test-file placement).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const SOP = rd("content/skill-integrator.md");
const ADD = rd("docs/lane-protocol-addendum.md");
const count = (text, needle) => text.split(needle).length - 1;
const sopLines = SOP.split("\n");
const addLines = ADD.split("\n");

test("AC-E349-1: the SOP states none of this repo's facts, and carries the generic replacements verbatim", () => {
  for (const banned of [
    "content/**", "test/fixtures/compose-golden/**", "test/context-budget.test.mjs",
    "npm run build", "npm audit", "npm run check:bookkeeping", "dist/",
  ]) {
    assert.equal(count(SOP, banned), 0, `SOP must not contain ${banned}`);
  }
  const mustHave = [
    // sop.stage1-shared (Stage 1 step 3)
    "a shared generated artifact (the repo addendum lists them) belongs to exactly one lane per wave",
    // sop.basefix-5
    "5. Then `git -C <worktree> merge --no-ff origin/<target>`; `node <agc install>/scripts/merge-invariants.mjs HEAD <worktree>` (absolute path); the repo's build (the addendum names it) and the dependency audit Constitution §6 requires, in the worktree; a resume notice to the lane (`type: close` on the pause topic, carrying the merge sha and naming any rebuilt tracked build output the lane must commit); one Decisions row.",
    // sop.verifier-build
    "- the worktree's `status --porcelain` taken **after** a local run of the repo's build command (the addendum names it) — non-empty is itself a finding (tracked build output not rebuilt at commit);",
    // sop.5b-4
    "Tracked build output is never hand-resolved: rebuild it after merging.",
    "After merging, run the repo's build and restart the primary MCP server",
    // sop.5b-5
    "(a build-output or golden regeneration is not substantive)",
    // sop.5b-6
    "6. All merged: the repo's build (commit the rebuilt tracked output) → `git push -u origin integ/<feature>` → the repo's CI check on `<HEAD>`.",
    // sop.5c-3
    "Before the bookkeeping commit, run the repo's bookkeeping check when the addendum names one, and require exit 0.",
  ];
  for (const s of mustHave) assert.equal(count(SOP, s), 1, `exactly once: ${s.slice(0, 60)}`);
  // placement: the strings sit in the step the spec names, not merely somewhere in the file
  const at = (prefix) => sopLines.filter((l) => l.startsWith(prefix));
  assert.ok(at("3. **Hard constraints**").every((l) => l.includes(mustHave[0])) && at("3. **Hard constraints**").length === 1);
  assert.ok(at("5. Then `git -C <worktree> merge --no-ff origin/<target>`").length === 1);
  const i5b = SOP.indexOf("### 5b."), i5c = SOP.indexOf("### 5c.");
  const s5b = SOP.slice(i5b, i5c);
  for (const s of mustHave.slice(3, 7)) assert.ok(s5b.includes(s), `inside 5b: ${s.slice(0, 40)}`);
  assert.ok(SOP.slice(i5c, SOP.indexOf("## Stage 6", i5c)).includes(mustHave[7]), "sop.5c-3 inside 5c");
});

test("AC-E349-2: addendum heading list unchanged; the three §5 bullets follow the fanout line in order; §7 unchanged; every called tool has its repo-relative call", () => {
  const headings = addLines.filter((l) => l.startsWith("## "));
  assert.deepEqual(headings, ["## §1 開工", "## §2 檔案邊界", "## §3 執行與驗證", "## §4 新發現", "## §5 信箱", "## §7 中途修 base"]);

  const FANOUT = "- `fanout.mjs` 在本 repo 用 `node scripts/fanout.mjs …` 呼叫，例如 cut 預審之後跑 `node scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md`。";
  const TOOLS = "- 整合者 SOP 與 coordinator 呼叫的其他 agc 工具，在本 repo 一樣用 repo 相對路徑：`node scripts/mailbox-watch.mjs`、`node scripts/lane-status.mjs`、`node scripts/merge-invariants.mjs`、`node scripts/test-lock.mjs`（全套一律 `node scripts/test-lock.mjs -- npm test`）、`node scripts/feature-rollup.mjs`。";
  const CI = "- 整合者 SOP 的「repo 的 CI 檢查」在本 repo 是 `node scripts/verify-release.mjs --ci-check --sha <sha>`（只在本 repo 能用：它從自己的位置找 repo）。";
  const BOOK = "- 整合者 5c 的記帳檢查是 `npm run check:bookkeeping`：記帳 commit 前跑、要 exit 0；它也透過測試檔在 `npm test` 裡，PR 的 CI 會再跑一次。";
  const f = addLines.indexOf(FANOUT);
  assert.ok(f >= 0, "existing §5 fanout line byte-identical");
  assert.deepEqual(addLines.slice(f + 1, f + 4), [TOOLS, CI, BOOK], "add.5-tools, add.5-ci, add.5-bookkeeping directly after, in order");
  assert.equal(addLines[f + 4], "", "§5 ends after the three bullets");
  assert.equal(addLines[f + 5], "## §7 中途修 base");

  const sec7 = ADD.slice(ADD.indexOf("## §7 中途修 base"));
  assert.equal(
    sec7,
    [
      "## §7 中途修 base",
      "",
      "- 恢復通知點名要重建的建置產物就是 `dist/`：確認 HEAD 之後把它 commit 掉。",
      "- merge-base 規則也適用註解 proof 腳本：它一樣對 merge-base 算，另外斷言每一行改動都是註解（只比對去掉註解後的編譯產物，連只改型別註記的改動也會過）。",
      "",
    ].join("\n"),
    "§7 byte-identical (gains no line)",
  );

  // every tool the SOP calls through the install path has a repo-relative call in the addendum
  const called = new Set([...SOP.matchAll(/node <agc install>\/scripts\/([a-z-]+)\.mjs/g)].map((m) => m[1]));
  for (const t of ["fanout", "mailbox-watch", "lane-status", "merge-invariants", "test-lock"]) assert.ok(called.has(t), `SOP calls ${t}`);
  for (const t of [...called, "feature-rollup"]) assert.ok(ADD.includes(`node scripts/${t}.mjs`), `addendum names node scripts/${t}.mjs`);
  assert.ok(ADD.includes("node scripts/verify-release.mjs --ci-check --sha <sha>"));
  assert.equal(count(ADD, "npm run check:bookkeeping"), 1);
});
