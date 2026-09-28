// Coded by @sr-engineer
// Minimal bugfix-mode repro for specs/e92-e86-handoff-write-boundary.md
// (T-E86-01 / T-E92-01 repro-first carve-out, skill-sr-engineer step 3b).
// NOT full AC1-AC5 coverage — that is qa-engineer's job (T-QA-01). This file
// exists only to prove RED against the un-fixed code before the fix landed,
// per qa_reports/expected-red_e92-e86-handoff-write-boundary.txt.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { readHandoffState, writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e92e86-repro-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

const updateStateTool = TOOL_REGISTRY.find((t) => t.name === "tw_update_state");

test("E86 repro: pending_notes entry ending in leftover tool-call tag markup is rejected with the new message, not a length-cap message", () => {
  const rawArgs = {
    workspace_path: mkWorkspace(),
    active_feature: "e92-e86-handoff-write-boundary",
    status: "In_Progress",
    pending_notes: [
      'legit-looking note whose tail absorbed a sibling argument fragment <parameter name="pending_notes">',
    ],
  };

  assert.throws(
    () => updateStateTool.run(rawArgs),
    (err) => {
      assert.ok(Array.isArray(err.issues), "expected a ZodError with an issues array");
      const msg = err.issues.map((i) => i.message).join(" | ");
      assert.match(msg, /leftover tool-call markup/);
      assert.doesNotMatch(msg, /Too big/);
      return true;
    },
  );
});

test("E92 repro: a wholly-dropped pending_notes entry leaves a synthetic omission marker as the array's last element", async () => {
  const ws = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);

  // Three 1000-char notes exactly fill the 3000-char read-view budget; a
  // fourth 1000-char note is dropped WHOLLY (charBudget <= 0 before it is
  // considered) per specs/e92-e86-handoff-write-boundary.md AC3.
  const notes = [0, 1, 2, 3].map((i) => `n${i}-`.padEnd(1000, "x"));
  await writeHandoffState(ws, "e92-e86-handoff-write-boundary", "In_Progress", [], notes, undefined, "sr-engineer");

  const state = JSON.parse(readHandoffState(ws));
  assert.ok(state.pending_notes_truncated, "expected pending_notes_truncated advisory to be set");
  const last = state.pending_notes[state.pending_notes.length - 1];
  assert.match(
    last,
    /further note\(s\) omitted — see pending_notes_truncated/,
    `expected the last pending_notes entry to be a synthetic omission marker, got: ${JSON.stringify(last)}`,
  );
});
