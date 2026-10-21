// Coded by @qa-engineer
// E138 (lane e135, feature e135-handoff-notes-ledger): when pending_notes exceed the 3000-char
// read-view budget, tw_get_state keeps note[0] (the server's own advisories live there) and the
// NEWEST whole notes, elides the middle with exactly one marker, and never slices a note.
// Before: the view kept notes from the head and dropped the tail, so the handover (the last
// notes) was systematically what a reader lost.
// Spec: specs/e135-handoff-notes-ledger.md AC7-AC9; architecture "E138: read view" + DR-9.
// Repro discipline: red against a copy of base 2ad039d, green at HEAD.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { readHandoffState, writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";

const FEATURE = "e138-read-view-probe";
const LIMIT = 3000;

// Spec Copy/Strings marker.elided, transcribed verbatim ({n} substituted).
const marker = (n) =>
  `⟦agc read-view⟧ ${n} note(s) omitted here — full text is on disk; see pending_notes_truncated. Do not write this line back.`;

function mkNote(len, tag) {
  return `${tag}-`.padEnd(len, "x");
}

// Seed on-disk notes directly (the per-note tool cap of 1000 chars does not apply to data
// written before it existed, and the read view must cope with it), then read like tw_get_state.
async function view(notes) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e138-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState(ws, FEATURE, "In_Progress", [], notes, undefined, "sr-engineer");
  return { ws, state: JSON.parse(readHandoffState(ws)) };
}

const markerCount = (arr) => arr.filter((n) => n.startsWith("⟦agc read-view⟧")).length;

// ---------------------------------------------------------------------------
// AC7 — keep note[0], then the newest notes backwards; one marker at the elision point.
// ---------------------------------------------------------------------------
test("AC7: 2x2000 chars -> note[0] kept whole, the newest note elided, marker at index 1, nothing sliced", async () => {
  const notes = [mkNote(2000, "a"), mkNote(2000, "b")];
  const { state } = await view(notes);
  assert.deepEqual(state.pending_notes, [notes[0], marker(1)]);
});

test("AC7: the newest notes survive; the middle is elided with the marker at index 1 when note[0] fits", async () => {
  const notes = [mkNote(100, "head"), mkNote(1000, "m1"), mkNote(1000, "m2"), mkNote(1000, "m3"), mkNote(100, "new1"), mkNote(100, "new2")];
  const { state } = await view(notes); // total 3300 > 3000; head 100 -> 2900 left; tail 100,100,1000,1000 -> 700 left; next 1000 stops
  assert.deepEqual(state.pending_notes, [notes[0], marker(1), notes[2], notes[3], notes[4], notes[5]]);
  assert.equal(state.pending_notes[state.pending_notes.length - 1], notes[5], "the newest note is the last entry, not a marker");
});

test("AC7: when note[0] itself does not fit the budget the marker stands at index 0", async () => {
  const notes = [mkNote(3500, "huge"), mkNote(10, "x1"), mkNote(10, "x2")];
  const { state } = await view(notes);
  assert.deepEqual(state.pending_notes, [marker(1), notes[1], notes[2]]);
  assert.equal(state.pending_notes_truncated.omitted_notes, 1);
});

test("AC7: the kept tail is contiguous — it stops at the first note from the end that does not fit", async () => {
  // note[1] (100) would fit the leftover budget, but the 2900 note before the tail does not,
  // so the walk stops there: one gap, one marker, never a marker per gap.
  const notes = [mkNote(10, "h"), mkNote(100, "small-but-skipped"), mkNote(2900, "big"), mkNote(100, "tail")];
  const { state } = await view(notes);
  assert.deepEqual(state.pending_notes, [notes[0], marker(2), notes[3]]);
  assert.equal(markerCount(state.pending_notes), 1);
});

test("AC7: a long middle note ahead of short newer notes is kept when it still fits (whole, unsliced)", async () => {
  const notes = [mkNote(10, "h"), mkNote(900, "dropped"), mkNote(2000, "kept"), mkNote(100, "n1"), mkNote(100, "n2")];
  const { state } = await view(notes); // total 3110
  assert.deepEqual(state.pending_notes, [notes[0], marker(1), notes[2], notes[3], notes[4]]);
});

test("AC7: no note is ever sliced and the retired '…[truncated]' suffix never appears", async () => {
  const notes = Array.from({ length: 9 }, (_, i) => mkNote(700, `n${i}`));
  const { state } = await view(notes);
  const real = state.pending_notes.filter((n) => !n.startsWith("⟦agc read-view⟧"));
  for (const n of real) {
    assert.ok(notes.includes(n), `a view entry is not a verbatim on-disk note: ${n.slice(0, 20)}…`);
    assert.doesNotMatch(n, /…\[truncated\]$/);
  }
  assert.ok(!state.pending_notes.some((n) => /further note\(s\) omitted/.test(n)), "the E92 trailing marker shape is retired");
  assert.equal(markerCount(state.pending_notes), 1);
});

test("AC7: a single on-disk note larger than the whole budget is elided whole, never sliced", async () => {
  const { state } = await view([mkNote(4000, "only")]);
  assert.deepEqual(state.pending_notes, [marker(1)]);
  assert.equal(state.pending_notes_truncated.total_chars, 4000);
});

test("AC7: reading never alters what is on disk (the elision is view-only)", async () => {
  const notes = [mkNote(2000, "a"), mkNote(2000, "b"), mkNote(500, "c")];
  const { ws } = await view(notes);
  assert.deepEqual(parseHandoff(ws).pending_notes, notes);
});

// ---------------------------------------------------------------------------
// AC8 — the field measurement: 13 notes / 5113 chars, the last five carry the handover.
// ---------------------------------------------------------------------------
test("AC8: 13-note handover (5113 chars) — the last notes come back and the marker counts the middle ones", async () => {
  const lens = [120, 400, 400, 400, 400, 400, 400, 400, 440, 440, 440, 440, 433];
  assert.equal(lens.reduce((a, b) => a + b, 0), 5113);
  const notes = lens.map((l, i) => mkNote(l, i === 0 ? "advisory" : i >= 8 ? `handover${i}` : `mid${i}`));
  const { state } = await view(notes);
  // budget 3000: note[0] 120 -> 2880; tail from the end: 433,440,440,440,440 (-> 687) then 400 (-> 287), next 400 > 287 stops.
  assert.deepEqual(state.pending_notes, [notes[0], marker(6), notes[7], notes[8], notes[9], notes[10], notes[11], notes[12]]);
  for (const handover of notes.slice(8)) assert.ok(state.pending_notes.includes(handover), "every handover note must be readable");
});

// ---------------------------------------------------------------------------
// AC9 — pending_notes_truncated keeps total_chars + limit and gains omitted_notes; unchanged when not firing.
// ---------------------------------------------------------------------------
test("AC9: pending_notes_truncated carries total_chars, limit and omitted_notes (in that order)", async () => {
  const notes = [mkNote(2000, "a"), mkNote(2000, "b")];
  const { state } = await view(notes);
  assert.deepEqual(state.pending_notes_truncated, { total_chars: 4000, limit: LIMIT, omitted_notes: 1 });
  assert.deepEqual(Object.keys(state.pending_notes_truncated), ["total_chars", "limit", "omitted_notes"]);
});

test("AC9: exactly at the limit nothing fires — no key, no marker, notes byte-identical", async () => {
  const notes = [mkNote(1500, "a"), mkNote(1500, "b")];
  const { state } = await view(notes);
  assert.deepEqual(state.pending_notes, notes);
  assert.equal("pending_notes_truncated" in state, false);
});

test("AC9: one char over the limit fires the elision", async () => {
  const notes = [mkNote(1500, "a"), mkNote(1501, "b")];
  const { state } = await view(notes);
  assert.deepEqual(state.pending_notes, [notes[0], marker(1)]);
  assert.equal(state.pending_notes_truncated.total_chars, 3001);
});

test("AC9: short notes are returned untouched with no truncation metadata", async () => {
  const notes = ["next_role: qa-engineer", "all green"];
  const { state } = await view(notes);
  assert.deepEqual(state.pending_notes, notes);
  assert.equal(state.pending_notes_truncated, undefined);
});

// ---------------------------------------------------------------------------
// Pure helpers (architecture: exported from tools/handoff-parse.ts).
// ---------------------------------------------------------------------------
test("pure: formatElidedMarker is the verbatim spec string and selectPendingNotesView is the same function the view uses", async () => {
  const mod = await import("../dist/tools/handoff-parse.js");
  assert.equal(typeof mod.formatElidedMarker, "function", "formatElidedMarker must be exported");
  assert.equal(typeof mod.selectPendingNotesView, "function", "selectPendingNotesView must be exported");
  assert.equal(mod.formatElidedMarker(7), marker(7));
  const notes = [mkNote(2000, "a"), mkNote(2000, "b")];
  const r = mod.selectPendingNotesView(notes, LIMIT);
  assert.deepEqual(r.notes, [notes[0], marker(1)]);
  assert.deepEqual(r.truncated, { total_chars: 4000, limit: LIMIT, omitted_notes: 1 });
});

test("pure: empty and under-limit input is returned unchanged with truncated null", async () => {
  const mod = await import("../dist/tools/handoff-parse.js");
  assert.deepEqual(mod.selectPendingNotesView([], LIMIT), { notes: [], truncated: null });
  assert.deepEqual(mod.selectPendingNotesView(["a", "b"], LIMIT), { notes: ["a", "b"], truncated: null });
});
