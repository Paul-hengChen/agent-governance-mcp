// Coded by @qa-engineer
// Tests (T-E338-01) for specs/e289-render-addendum.md AC-E338-1..2: a backtick before `**` never opens bold in the
// handoff absolute-path check. Inside a code span `**` is literal, so a glob such as `**/node_modules/x` is not a
// bold-wrapped absolute path and rejecting it would block closing a wave with a correct manifest. The other half
// matters as much: whitespace, line start and every other boundary before `**/…` still open bold, so a real
// bold-wrapped local path (e332's pinned hit) keeps being caught. AC-E338-3 (e332 / e283 green and unmodified)
// is proven by commands recorded in the QA report.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../dist/tools/fanout-manifest.js";

const CODE = "HANDOFF_ABSOLUTE_PATH";

/** A closed, otherwise valid manifest whose `核對 primary` body is `body` (one probe per line). */
function closedManifest(body) {
  return [
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
    "### 核對 primary",
    body,
    "### 已結案",
    "- e338",
    "### 待人類決定",
    "- 無",
    "### 進行中的背景工作",
    "無",
    "",
  ].join("\n");
}
const pathErrors = (line) => validateManifest(closedManifest(line)).errors.filter((e) => e.code === CODE);

test("fixture sanity: a plain body validates clean", () => {
  assert.deepEqual(validateManifest(closedManifest("- git status 乾淨")).errors, []);
});

test("AC-E338-1 a backtick before ** never opens bold: code-span globs are not absolute paths", () => {
  const probes = ["- `**/node_modules/x`", "- 見 `**/src/a/b`", "- ``**/a/b``", "- `**/Users/x/y**`"];
  for (const line of probes) assert.deepEqual(pathErrors(line), [], line);
});

test("AC-E338-2 every other boundary before ** still opens bold: still exactly one hit, unchanged from base", () => {
  const probes = ["**/a/b", "- see **/src/a/b", "- x=**/a/b", "- 見 **/Users/x/y**", "- `/tmp/x/y`"];
  for (const line of probes) assert.equal(pathErrors(line).length, 1, line);
});
