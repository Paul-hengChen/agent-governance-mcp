// Coded by @qa-engineer
// Tests (T-E332-01) for specs/e284-fanout-handoff-command.md AC-E332-1..2: the closed-manifest handoff check
// reports a machine-local absolute path in more positions (after `**`, an ASCII colon or comma, inside `|…|`) and
// forms (`file:///`, `$HOME/`, `${HOME}/`, UNC), while a `~10/17`-style date, a glob, a URL and relative paths stay
// clean. A handoff is read by a later session on possibly another machine, so a local path in it is a defect, and a
// false hit would block closing a wave. The check runs in-process through validateManifest on in-test manifests;
// nothing reads the committed manifests (AC-E332-3's sweep over them is recorded in the QA report, not here).

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
    "- e332",
    "### 待人類決定",
    "- 無",
    "### 進行中的背景工作",
    "無",
    "",
  ].join("\n");
}

/** 1-based line number of the first line of `text` that equals `line`. */
const lineOf = (text, line) => text.split("\n").indexOf(line) + 1;
const pathErrors = (text) => validateManifest(text).errors.filter((e) => e.code === CODE);

test("fixture sanity: the closed manifest with a plain body validates clean", () => {
  // WHY: every non-hit below is judged against this; a red baseline would fake passes.
  assert.deepEqual(validateManifest(closedManifest("- git status 乾淨")).errors, []);
});

test("new boundaries and forms", () => {
  const probes = [
    "- 見 **/Users/x/y**",
    "- path:/home/u/r",
    "- a,/srv/a/b",
    "- | /opt/a/b |",
    "- |/opt/a/b|",
    "- file:///Users/x/y",
    "- $HOME/lanes/e1",
    "- ${HOME}/lanes/e1",
    "- \\\\server\\share\\x",
  ];
  const text = closedManifest(probes.join("\n"));
  const errs = pathErrors(text);
  assert.equal(errs.length, probes.length, `one error per offending line: ${errs.map((e) => e.message).join(" | ")}`);
  for (const p of probes) {
    const n = lineOf(text, p);
    assert.ok(n > 0);
    assert.equal(errs.filter((e) => e.message.includes(`line ${n} `)).length, 1, `${p} is reported on line ${n}`);
  }
  // the message never echoes the path
  for (const needle of ["/Users/x/y", "/home/u/r", "/srv/a/b", "/opt/a/b", "file:///", "$HOME", "${HOME}", "\\\\server", "server\\share"]) {
    assert.ok(!errs.some((e) => e.message.includes(needle)), `message must not contain ${needle}`);
  }
  // each probe alone is a hit (no probe relies on a neighbour line)
  for (const p of probes) assert.equal(pathErrors(closedManifest(p)).length, 1, p);
});

test("non-hits", () => {
  const clean = [
    "- ~10/17",
    "- （~10/17）",
    "- 約 ~10/17 完成",
    "- tools/**/a/b",
    "- https://github.com/a/b",
    "- |https://x.y/a/b|",
    "- 10:30",
    "- a,b/c/d",
    "- |origin/main|",
    "- ../lanes/e1",
    "- /teamwork",
    "- //cdn.example/a/b",
  ];
  for (const c of clean) {
    assert.deepEqual(pathErrors(closedManifest(c)), [], c);
  }
  // all together: still no error, so line-local context does not create a hit either
  assert.deepEqual(validateManifest(closedManifest(clean.join("\n"))).errors, []);
});

test("the earlier hit and non-hit sets are unchanged", () => {
  // WHY: widening the detector must not drop any form it already caught or start flagging a form it already passed.
  for (const h of ["/Users/x/repo", "/home/user/b", "`/tmp/x/y`", "（/private/var/z）", "C:\\work\\x", "~/lanes/e283", "~user/x"]) {
    assert.equal(pathErrors(closedManifest(`- 在 ${h} 底下`)).length, 1, h);
  }
  for (const ok of ["../lanes/e283", ".current/history/x", "origin/main", "/teamwork", "https://github.com/a/b"]) {
    assert.deepEqual(pathErrors(closedManifest(`- 見 ${ok}`)), [], ok);
  }
});
