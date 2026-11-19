// Coded by @qa-engineer
// E436 (specs/e436-stale-paths-tool-contracts): CLAUDE.md names the lane-layout handoff paths and
// the release-engineer template line 9 / line 13 match the cut's exact text.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf-8");
const TPL_RAW = fs.readFileSync(path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"), "utf-8");
const cl = CLAUDE.split("\n");
const tl = TPL_RAW.replace(/\n$/, "").split("\n");

test("AC1: CLAUDE.md has no flat .current/handoff.md path", () => {
  assert.ok(!CLAUDE.includes(".current/handoff.md"), "flat legacy path must not appear");
});

test("AC1: CLAUDE.md lines 13/220 name the primary path, lines 44/64/195 the lane path", () => {
  assert.ok(cl[12].includes("`.current/_primary/handoff.md` and `tasks.md` exist), so the"), cl[12]);
  assert.ok(cl[219].includes("`.current/_primary/handoff.md` and"), cl[219]);
  assert.ok(cl[220].startsWith("`tasks.md` exist, so this is a managed workspace like any other."), cl[220]);
  assert.ok(cl[43].includes("read/write `.current/<lane>/handoff.md`, `tasks.md`"), cl[43]);
  assert.ok(cl[63].includes("read/write .current/<lane>/handoff.md (uses js-yaml)"), cl[63]);
  assert.ok(cl[194].includes("stopped from editing `.current/<lane>/handoff.md` directly."), cl[194]);
});

test("AC1: the agc-version stamp line is still present", () => {
  const stamps = cl.filter((l) => /<!--\s*agc-version:\s*\d+\.\d+\.\d+\s*-->/.test(l));
  assert.ok(stamps.length >= 1, "agc-version stamp present");
});

test("AC2: template is 13 lines with one trailing newline", () => {
  assert.ok(TPL_RAW.endsWith("\n") && !TPL_RAW.endsWith("\n\n"));
  assert.equal(tl.length, 13);
});

test("AC2: line 7 and line 11 are unchanged", () => {
  assert.equal(
    tl[6],
    "CRITICAL: End every reply with `— @release-engineer (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).",
  );
  assert.equal(
    tl[10],
    "Before the version bump, re-baseline per SOP step 5: on `main`, `git fetch origin` then `git -c pull.rebase=false pull --ff-only`, and derive the target version from the version at HEAD, never from the baseline read at PASS time.",
  );
});

test("AC2: line 9 is the reworded load line", () => {
  assert.equal(
    tl[8],
    'This subagent runs the agc release-engineer SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("release-engineer")` and follow the returned SOP exclusively. Its Hard rules and numbered steps are normative there; the two paragraphs below repeat only the step 5 re-baseline and, for a session that cannot load the SOP, the no-MCP relay rule.',
  );
  assert.ok(!tl[8].includes("not restated here"));
});

test("AC2: line 13 uses the lane path and keeps its opening and NEVER", () => {
  assert.ok(tl[12].startsWith("CRITICAL: If this session has no MCP tool-invocation path at all"));
  assert.ok(tl[12].includes("NEVER hand-edit `.current/<lane>/handoff.md` or `tasks.md` to simulate a `tw_update_state` write."));
  assert.ok(!TPL_RAW.includes(".current/handoff.md"));
});
