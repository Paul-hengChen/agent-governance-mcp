// Coded by @qa-engineer
// E135 (lane e135, feature e135-handoff-notes-ledger): tw_get_state's read view may contain
// synthetic display text (the elision marker, plus two legacy shapes older callers may still hold
// in context). Role SOPs say "carry pending_notes forward", so a caller that writes its view back
// verbatim would persist display text as authored state. The boundary refuses such text wherever
// it sits in a note, and the prefix literal lives in exactly one place that both the emitter and
// the refuser import.
// Spec: specs/e135-handoff-notes-ledger.md AC10-AC12; architecture "E135: read-view refusal", DR-10.
// Repro discipline: the legacy-shape and write-back cases are red against a copy of base 2ad039d
// (the base accepts them); green at HEAD.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEATURE = "e135-read-view-probe";
const PREFIX = "⟦agc read-view⟧"; // spec Copy/Strings marker.prefix, verbatim (U+27E6 / U+27E7)
const getStateTool = TOOL_REGISTRY.find((t) => t.name === "tw_get_state");
const updateStateTool = TOOL_REGISTRY.find((t) => t.name === "tw_update_state");

const readViewMessage = (i) =>
  `pending_notes[${i}] contains tw_get_state read-view display text (the "⟦agc read-view⟧" marker or a legacy "…[truncated]" / "further note(s) omitted" marker), not an author's note. Drop it before writing; the omitted notes are still on disk.`;

async function freshWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e135-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  await getStateTool.run({ workspace_path: ws });
  return ws;
}

function updateArgs(ws, extra) {
  return { workspace_path: ws, active_feature: FEATURE, status: "In_Progress", agent_id: "pm", ...extra };
}

async function issuesOf(ws, notes) {
  try {
    await updateStateTool.run(updateArgs(ws, { pending_notes: notes }));
  } catch (err) {
    assert.ok(Array.isArray(err.issues), `expected a ZodError, got: ${err && err.message}`);
    return err.issues.map((i) => ({ message: i.message, path: i.path.join(".") }));
  }
  return null;
}

// ---------------------------------------------------------------------------
// AC10 — one constant, used by the emitter and the refuser; no second copy of the literal.
// ---------------------------------------------------------------------------
test("AC10: handoff-types exports READ_VIEW_MARKER_PREFIX equal to the spec's marker.prefix", async () => {
  const types = await import("../dist/tools/handoff-types.js");
  assert.equal(types.READ_VIEW_MARKER_PREFIX, PREFIX);
});

test("AC10: the emitter builds its marker from that constant", async () => {
  const types = await import("../dist/tools/handoff-types.js");
  const parse = await import("../dist/tools/handoff-parse.js");
  assert.equal(typeof parse.formatElidedMarker, "function");
  assert.ok(parse.formatElidedMarker(3).startsWith(types.READ_VIEW_MARKER_PREFIX + " 3 note(s) omitted"));
});

test("AC10: the literal occurs exactly once across tools/*.ts source (the constant's definition)", () => {
  const dir = path.join(PROJECT_ROOT, "tools");
  const hits = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const count = text.split("agc read-view").length - 1;
    if (count) hits.push(`${f}:${count}`);
  }
  assert.deepEqual(hits, ["handoff-types.ts:1"], "no second copy of the marker literal may exist in tools/ source");
});

// ---------------------------------------------------------------------------
// AC11 — writing the view back verbatim is rejected; on-disk notes unchanged.
// ---------------------------------------------------------------------------
test("AC11: a real tw_get_state view containing the elision marker is rejected when written back verbatim", async () => {
  const ws = await freshWorkspace();
  const notes = Array.from({ length: 5 }, (_, i) => `n${i}-`.padEnd(900, "x")); // 4500 chars > 3000 -> elision
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState(ws, FEATURE, "In_Progress", [], notes, undefined, "pm");
  const viewed = JSON.parse(await getStateTool.run({ workspace_path: ws }).then((r) => r.content[0].text));
  assert.ok(viewed.pending_notes_truncated, "precondition: the view must have elided notes");
  const issues = await issuesOf(ws, viewed.pending_notes);
  assert.ok(issues, "the view's synthetic entry must be refused on write-back");
  const idx = viewed.pending_notes.findIndex((n) => n.startsWith(PREFIX));
  assert.ok(idx >= 0, "precondition: the view carries the marker");
  assert.ok(
    issues.some((i) => i.message === readViewMessage(idx) && i.path === `pending_notes.${idx}`),
    `expected note.read-view naming index ${idx}, got ${JSON.stringify(issues)}`,
  );
  assert.deepEqual(parseHandoff(ws).pending_notes, notes, "on-disk notes must be unchanged by the rejected write");
});

test("AC11: the marker entry alone is rejected with note.read-view", async () => {
  const ws = await freshWorkspace();
  const issues = await issuesOf(ws, [
    "real note",
    `${PREFIX} 2 note(s) omitted here — full text is on disk; see pending_notes_truncated. Do not write this line back.`,
  ]);
  assert.ok(issues?.some((i) => i.message === readViewMessage(1) && i.path === "pending_notes.1"), JSON.stringify(issues));
  assert.equal(parseHandoff(ws), null, "nothing may be written");
});

test("AC11 (legacy shape): a note ending in the retired '…[truncated]' suffix is rejected", async () => {
  const ws = await freshWorkspace();
  const issues = await issuesOf(ws, ["a partially kept note from the old reader…[truncated]"]);
  assert.ok(issues?.some((i) => i.message === readViewMessage(0)), JSON.stringify(issues));
});

test("AC11 (legacy shape): '…[truncated]' followed by trailing whitespace is still the suffix", async () => {
  const ws = await freshWorkspace();
  const issues = await issuesOf(ws, ["old reader output…[truncated]   "]);
  assert.ok(issues?.some((i) => i.message === readViewMessage(0)), JSON.stringify(issues));
});

test("AC11 (legacy shape): E92's whole-note '…[n further note(s) omitted — see pending_notes_truncated]' is rejected", async () => {
  const ws = await freshWorkspace();
  for (const n of [1, 3, 50]) {
    const issues = await issuesOf(ws, ["fine", `…[${n} further note(s) omitted — see pending_notes_truncated]`]);
    assert.ok(issues?.some((i) => i.message === readViewMessage(1) && i.path === "pending_notes.1"), `n=${n}: ${JSON.stringify(issues)}`);
  }
  assert.equal(parseHandoff(ws), null);
});

test("AC11 (legacy shape): E92's marker with surrounding whitespace is still the whole note", async () => {
  const ws = await freshWorkspace();
  const issues = await issuesOf(ws, ["  …[2 further note(s) omitted — see pending_notes_truncated]  "]);
  assert.ok(issues?.some((i) => i.message === readViewMessage(0)), JSON.stringify(issues));
});

// DR-10: only the shapes the old reader really emitted are refused; prose that merely quotes them is fine.
test("DR-10: prose that quotes a legacy marker mid-note (not as the shape the reader emitted) is accepted and round-trips", async () => {
  const ws = await freshWorkspace();
  const notes = [
    "E138 retired the …[truncated] suffix in the middle of a sentence like this",
    "the old marker read …[2 further note(s) omitted — see pending_notes_truncated] and then prose continued",
  ];
  const issues = await issuesOf(ws, notes);
  assert.equal(issues, null, JSON.stringify(issues));
  assert.deepEqual(parseHandoff(ws).pending_notes, notes);
});

// ---------------------------------------------------------------------------
// AC12 — containment, not prefix match: no cleaning convention needed.
// ---------------------------------------------------------------------------
for (const [label, note] of [
  ["mid-note prose", `the reader prints ${PREFIX} when it elides, so never copy it`],
  ["at the very end", `trailing mention ${PREFIX}`],
  ["at the very start", `${PREFIX}`],
  ["bare prefix only", PREFIX],
]) {
  test(`AC12: prefix ${label} is rejected with note.read-view (containment)`, async () => {
    const ws = await freshWorkspace();
    const issues = await issuesOf(ws, ["ok", note]);
    assert.ok(issues?.some((i) => i.message === readViewMessage(1) && i.path === "pending_notes.1"), JSON.stringify(issues));
    assert.equal(parseHandoff(ws), null);
  });
}

test("AC12: near-misses of the prefix (ASCII brackets / missing closer) are not read-view text", async () => {
  const ws = await freshWorkspace();
  const notes = ["⟦agc read-view without the closer", "agc read-view in plain words", "⟧agc read-view⟦ reversed"];
  const issues = await issuesOf(ws, notes);
  assert.equal(issues, null, JSON.stringify(issues));
  assert.deepEqual(parseHandoff(ws).pending_notes, notes);
});

// Precedence (architecture DR-8): multiline -> read-view -> bracket-led -> sentinel; one issue per note.
test("precedence: a multi-line note carrying the marker yields only note.multiline", async () => {
  const ws = await freshWorkspace();
  const issues = await issuesOf(ws, [`${PREFIX} 1 note(s)\nsecond line`]);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].message, /contains a line break/);
});

test("precedence: a '['-led note carrying the marker yields note.read-view, not note.bracket-led", async () => {
  const ws = await freshWorkspace();
  const issues = await issuesOf(ws, [`[x] ${PREFIX} 1 note(s) omitted`]);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].message, readViewMessage(0));
});
