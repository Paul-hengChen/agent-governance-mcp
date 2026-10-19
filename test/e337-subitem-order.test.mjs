// Coded by @qa-engineer
// Tests (T-E337-01) for specs/e289-render-addendum.md AC-E337-1: the HANDOFF_SUBITEMS doc comment must say what
// `validate` really checks. A comment that promises an order nobody checks invites a later reader to rely on a
// check that is not there, so the comment states "order is not checked" and a reversed-order closed manifest is
// the executable proof that the claim is true (and that no new HANDOFF_* order code crept in).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest } from "../dist/tools/fanout-manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HEAD = [
  "# Fan-out: fixture",
  "base: abc1234    integration branch: integ/fx",
  "mailbox: ../lanes/_mailbox",
  "",
  "**狀態：已結案 2026-10-17。**",
  "",
  "## Lanes",
  "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  "|---|---|---|---|---|---|---|---|",
  "| a | E1 | feat/a | ../lanes/a | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
  "",
  "## Dispatch pins",
  "- a：`sr-engineer=opus`。",
  "",
  "## Decisions",
  "| 日期 | 裁決者 | 內容 | 出處 |",
  "|---|---|---|---|",
  "| 2026-10-13 | 人類 | 開波 | s |",
  "",
  "## 接手步驟",
];
const SUB = {
  "核對 primary": ["### 核對 primary", "- git status 乾淨"],
  已結案: ["### 已結案", "- e337"],
  待人類決定: ["### 待人類決定", "- 無"],
  進行中的背景工作: ["### 進行中的背景工作", "無"],
};
const manifestWith = (order) => [...HEAD, ...order.flatMap((k) => SUB[k]), ""].join("\n");

test("AC-E337-1 the HANDOFF_SUBITEMS comment says the order is not checked", () => {
  const src = fs.readFileSync(path.join(ROOT, "tools", "fanout-manifest.ts"), "utf8");
  const at = src.indexOf("export const HANDOFF_SUBITEMS");
  assert.ok(at > 0);
  const above = src.slice(0, at).trimEnd().split("\n");
  const comment = above[above.length - 1];
  assert.equal(
    comment,
    "/** Sub-items (`### ` headings) every handoff section must hold, each exactly once with a non-empty body; their order is not checked. */",
  );
  assert.ok(!comment.includes("in order"));
});

test("AC-E337-1 fixture sanity: the canonical order validates clean", () => {
  // WHY: the reversed case below is only meaningful against a green baseline.
  assert.deepEqual(validateManifest(manifestWith(["核對 primary", "已結案", "待人類決定", "進行中的背景工作"])).errors, []);
});

test("AC-E337-1 the four sub-items in reverse (and a shuffled) order report zero errors", () => {
  const reversed = ["進行中的背景工作", "待人類決定", "已結案", "核對 primary"];
  assert.deepEqual(validateManifest(manifestWith(reversed)).errors, []);
  const shuffled = ["待人類決定", "核對 primary", "進行中的背景工作", "已結案"];
  assert.deepEqual(validateManifest(manifestWith(shuffled)).errors, []);
});
