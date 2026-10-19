// Coded by @qa-engineer
// Tests for specs/e285-integrator-session-handoff.md, E294 half (AC-E294-1 ... AC-E294-3, AC-E294-5
// structural half). WHY: a lane that stays on the primary checkout after the harness resets cwd runs
// one missed `cd` away from touching primary, so section 1 of docs/lane-protocol.md tells the lane to
// switch the session into its worktree with `EnterWorktree`, confirm the position, and fall back to the
// per-command `cd` when the tool is unavailable. Section 1 is descriptive prose only: the dispatch
// prompt template (`PROMPT_TEMPLATE_3B`) and lane e289's candidate template line own the imperative
// sentence, and test/e177a-manifest.test.mjs AC7 forbids any lane-protocol line from being a substring
// of the rendered prompt. AC-E294-4 (only section 1 changed vs the dispatch base) is a review-time diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROTOCOL = fs.readFileSync(path.join(ROOT, "docs", "lane-protocol.md"), "utf-8");
const { PROMPT_TEMPLATE_3B } = await import(path.join(ROOT, "dist", "tools", "fanout-manifest.js"));

// In-test frozen copy of the e289 candidate template line (verbatim from AC-E294-5, 2026-10-19).
const E289_CANDIDATE =
  "`feature start` 建好 worktree 之後，呼叫 `EnterWorktree`（path = <worktree>）把這個 session 切進去；這個工具不能用時，每個 Bash 指令照舊自帶 `cd <worktree> &&`。";

// `## 1.` heading line up to the next heading of any level.
function sec1() {
  const out = [];
  let on = false;
  for (const l of PROTOCOL.split("\n")) {
    if (!on && l.startsWith("## 1.")) { on = true; out.push(l); continue; }
    if (on && /^##/.test(l)) break;
    if (on) out.push(l);
  }
  assert.ok(out.length > 0, "## 1. heading not found in docs/lane-protocol.md");
  return out;
}
const S1 = sec1().join("\n");

test("AC-E294-1: section 1 switches in with EnterWorktree after feature start and confirms pwd and branch", () => {
  for (const p of ["EnterWorktree", "path", "feature start", "pwd", "git branch --show-current"]) {
    assert.ok(S1.includes(p), `§1 must mention: ${p}`);
  }
  assert.ok(S1.indexOf("feature start") < S1.indexOf("EnterWorktree"), "the switch comes after feature start");
});

test("AC-E294-2: section 1 ties the cd fallback to EnterWorktree being unavailable; temp-file rule stands", () => {
  for (const p of ["cd <worktree> &&", "$TMPDIR"]) {
    assert.ok(S1.includes(p), `§1 must mention: ${p}`);
  }
  const tied = sec1().filter((l) => l.includes("EnterWorktree") && l.includes("cd <worktree>"));
  assert.ok(tied.length >= 1, "a §1 line must name both EnterWorktree and the cd <worktree> fallback");
});

test("AC-E294-3: section 1 records the git-guard finding (no git -C <primary>, no compound git, one plain call each)", () => {
  for (const p of ["git -C <primary>", "一條一條"]) {
    assert.ok(S1.includes(p), `§1 must mention: ${p}`);
  }
});

test("AC-E294-5: no §1 line (trimmed, over 20 chars) is a substring of PROMPT_TEMPLATE_3B or E289_CANDIDATE", () => {
  for (const raw of sec1()) {
    const line = raw.trim();
    if (line.length <= 20) continue;
    assert.ok(!PROMPT_TEMPLATE_3B.includes(line), `§1 line is a substring of PROMPT_TEMPLATE_3B: ${line}`);
    assert.ok(!E289_CANDIDATE.includes(line), `§1 line is a substring of E289_CANDIDATE: ${line}`);
  }
});

test("AC-E294-5: every §1 line naming EnterWorktree is at least 60 chars (descriptive prose, not a template clause)", () => {
  for (const raw of sec1()) {
    const line = raw.trim();
    if (!line.includes("EnterWorktree")) continue;
    assert.ok(line.length >= 60, `§1 EnterWorktree line is under 60 chars: ${line}`);
  }
});

test("AC-E294-5: the template-clause fragments never form a whole §1 line", () => {
  const lines = new Set(sec1().map((l) => l.trim()));
  for (const frag of ["把這個 session 切進去", "每個 Bash 指令照舊自帶"]) {
    assert.ok(!lines.has(frag), `fragment must not be a whole §1 line: ${frag}`);
  }
});
