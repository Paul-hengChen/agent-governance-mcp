// Coded by @sr-engineer
// Minimal reproduction tests for the two handoff-write boundary bugs in
// specs/e92-e86-handoff-write-boundary.md: a pending_notes entry ending in leftover
// tool-call markup must be rejected with its own message, and a wholly dropped note must
// leave an omission marker. Written to fail against the unfixed code first.
// Full AC1-AC5 coverage: test/e92-e86-handoff-write-boundary.test.mjs.

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

// Re-pinned by T-E138-04 (e135 lane, spec AC7/AC9): the omission marker is no longer a trailing
// "…[n further note(s) omitted …]" entry. The read view keeps note[0] and the newest whole notes
// and puts ONE "⟦agc read-view⟧ n note(s) omitted here …" marker at the elision point. The E92
// intent survives: a wholly dropped note must never vanish silently.
test("E92 repro (re-pinned by E138): a wholly-dropped pending_notes entry leaves one omission marker at the elision point, not at the end", async () => {
  const ws = mkWorkspace();
  resetSession(ws);
  markStateRead(ws);

  // Four 1000-char notes exceed the 3000-char read-view budget by one whole note. (spec AC3)
  const notes = [0, 1, 2, 3].map((i) => `n${i}-`.padEnd(1000, "x"));
  await writeHandoffState(ws, "e92-e86-handoff-write-boundary", "In_Progress", [], notes, undefined, "sr-engineer");

  const state = JSON.parse(readHandoffState(ws));
  assert.ok(state.pending_notes_truncated, "expected pending_notes_truncated advisory to be set");
  assert.equal(state.pending_notes_truncated.omitted_notes, 1);
  const markers = state.pending_notes.filter((n) => n.startsWith("⟦agc read-view⟧"));
  assert.equal(markers.length, 1, `expected exactly one marker, got: ${JSON.stringify(state.pending_notes.map((n) => n.slice(0, 30)))}`);
  assert.equal(
    markers[0],
    "⟦agc read-view⟧ 1 note(s) omitted here — full text is on disk; see pending_notes_truncated. Do not write this line back.",
  );
  assert.equal(state.pending_notes.indexOf(markers[0]), 1, "the marker stands at the elision point (index 1 after note[0])");
  assert.equal(state.pending_notes[state.pending_notes.length - 1], notes[3], "the newest note is the last entry, not a marker");
});
