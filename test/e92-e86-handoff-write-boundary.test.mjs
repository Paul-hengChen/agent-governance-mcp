// Coded by @qa-engineer
// Tests the write-boundary check that rejects a state-write text field ending in leftover
// tool-call markup, and the marker written when whole pending notes are dropped for size.
// Spec: specs/e92-e86-handoff-write-boundary.md, AC1-AC5 (the separate repro file covers
// only the reproduction). The corpus sweep near the bottom is the main method here.
// Rationale: specs/e260g-comment-rationale.md (test/e92-e86-handoff-write-boundary.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { readHandoffState, writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const updateStateTool = TOOL_REGISTRY.find((t) => t.name === "tw_update_state");
const addTaskTool = TOOL_REGISTRY.find((t) => t.name === "tw_add_task");
assert.ok(updateStateTool, "tw_update_state must be registered");
assert.ok(addTaskTool, "tw_add_task must be registered");

const FEATURE = "e92-e86-handoff-write-boundary";

// No fs touch — see the file-header workspace note above.
const PROBE_WORKSPACE = "/nonexistent/e92-e86-qa-probe-workspace";

// ==========================================================================
// Copy/Strings oracle (specs/e92-e86-handoff-write-boundary.md) — hardcoded
// verbatim (transcribed by hand from the spec's Copy/Strings table), plus a
// sanity test below that the spec still says exactly this, so a spec edit
// that silently changes the mandated text fails loudly here instead of
// letting the two constants drift out from under the spec they encode.
// ==========================================================================
const E86_REJECTION_TEMPLATE =
  'Field "<field>" appears to end with leftover tool-call markup (a trailing tag fragment) — this usually means a malformed multi-argument call bled into this field. Re-issue the call with each argument in its own tag.';
const E92_OMISSION_TEMPLATE = "…[{n} further note(s) omitted — see pending_notes_truncated]";

function e86Message(field) {
  return E86_REJECTION_TEMPLATE.replace("<field>", field);
}
function e92Marker(n) {
  return E92_OMISSION_TEMPLATE.replace("{n}", String(n));
}

test("Copy/Strings oracle: spec still mandates the e86/e92 strings this file hardcodes", () => {
  const spec = fs.readFileSync(
    path.join(PROJECT_ROOT, "specs", "e92-e86-handoff-write-boundary.md"),
    "utf-8",
  );
  assert.ok(
    spec.includes(E86_REJECTION_TEMPLATE),
    "e86.rejection_message template drifted from the spec's Copy/Strings table",
  );
  assert.ok(
    spec.includes(E92_OMISSION_TEMPLATE),
    "e92.omission_marker template drifted from the spec's Copy/Strings table",
  );
});

// ==========================================================================
// Field/tool wiring for the 5 guarded free-text fields
// ==========================================================================
function baseUpdateStateArgs() {
  return { workspace_path: PROBE_WORKSPACE, active_feature: FEATURE, status: "In_Progress" };
}

const GUARDED_FIELDS = [
  {
    name: "scope_decision_why",
    tool: updateStateTool,
    build: (v) => ({ ...baseUpdateStateArgs(), scope_decision_why: v }),
  },
  {
    name: "qa_review",
    tool: updateStateTool,
    build: (v) => ({ ...baseUpdateStateArgs(), qa_review: v }),
  },
  {
    name: "blocking_reason",
    tool: updateStateTool,
    build: (v) => ({ ...baseUpdateStateArgs(), blocking_reason: v }),
  },
  {
    name: "pending_notes[0]",
    tool: updateStateTool,
    build: (v) => ({ ...baseUpdateStateArgs(), pending_notes: [v] }),
  },
  {
    name: "description",
    tool: addTaskTool,
    build: (v) => ({
      workspace_path: PROBE_WORKSPACE,
      task_id: "T-QA-PROBE",
      description: v,
    }),
  },
];

// Synchronous zod validation only. If `.run()` throws, the ZodError's issues
// are handed to `matcher`. If it does NOT throw, the async handler still
// runs in the background (e.g. PREFLIGHT_REQUIRED against a workspace that
// never called tw_get_state) — that rejection is deliberately swallowed
// because it is orthogonal to schema-level acceptance/rejection.
function runTool(tool, rawArgs) {
  const result = tool.run(rawArgs);
  if (result && typeof result.catch === "function") {
    result.catch(() => {});
  }
  return result;
}

function assertRejectedWithMarkupMessage(tool, rawArgs, expectedMessage) {
  assert.throws(
    () => tool.run(rawArgs),
    (err) => {
      assert.ok(Array.isArray(err.issues), "expected a ZodError with an issues array");
      const messages = err.issues.map((i) => i.message);
      assert.ok(
        messages.includes(expectedMessage),
        `expected the exact e86.rejection_message, got: ${JSON.stringify(messages)}`,
      );
      assert.ok(
        !messages.some((m) => /too big/i.test(m)),
        `a length-cap "Too big" message stood in alongside/instead of the markup rejection: ${JSON.stringify(messages)}`,
      );
      return true;
    },
  );
}

function assertAccepted(tool, rawArgs) {
  assert.doesNotThrow(() => runTool(tool, rawArgs));
}

// ==========================================================================
// AC1 — true-positive direction: reject, with the verbatim spec message,
// not a length-cap message. The shapes are the real leftover-markup tails
// the code review confirmed.
// ==========================================================================
const TRUE_POSITIVE_TAILS = [
  ["complete open tag with an attribute", '<parameter name="pending_notes">'],
  ["close tag", "</invoke>"],
  ["two-tag bleed", "</scope_decision_why></invoke>"],
  ["mid-attribute truncation, nothing after it", '<parameter name="pending_no'],
  ["bare truncated close tag", "</invoke"],
  ["balanced complete tag pair", '<invoke name="x"></invoke>'],
];

for (const field of GUARDED_FIELDS) {
  for (const [label, tail] of TRUE_POSITIVE_TAILS) {
    test(`AC1: ${field.name} rejects a true-positive trailing tag fragment (${label})`, () => {
      const value = `a malformed multi-argument call bled a sibling argument's markup in: ${tail}`;
      assertRejectedWithMarkupMessage(field.tool, field.build(value), e86Message(field.name));
    });
  }
}

// ===========================================================================
// AC2: valid text that must be accepted; both defects in drafts of the check were here:
// (a) bare agc placeholders and TS generics at the tail, e.g. the content/coord-01-core-head.md
// "verdict" line (F1); (b) a tag fragment with an UNTERMINATED quote followed by prose (F4),
// asserted across ALL FIVE guarded fields.
// ===========================================================================
const ROUND1_FALSE_POSITIVES = [
  ["bare <role> placeholder", "next hop is <role>"],
  ["bare specs/<feature> placeholder", "the spec is specs/<feature>"],
  ["bare review_<task-id> placeholder", "report path review_reports/review_<task-id>"],
  ["bare <field> placeholder", "rejection message names the offending <field>"],
  ["TS Promise<void> generic", "the handler now returns Promise<void>"],
  ["TS Array<string> generic", "the field is typed Array<string>"],
  ["TS bounded generic", "generic bound <T extends Foo>"],
];

for (const field of GUARDED_FIELDS) {
  for (const [label, value] of ROUND1_FALSE_POSITIVES) {
    test(`AC2: ${field.name} accepts a truthful bare-placeholder/generic tail (${label})`, () => {
      assertAccepted(field.tool, field.build(value));
    });
  }
}

test("AC2: the byte-verbatim content/coord-01-core-head.md 'verdict' line is accepted (round-1 F1 exemplar)", () => {
  const coordHead = fs.readFileSync(
    path.join(PROJECT_ROOT, "content", "coord-01-core-head.md"),
    "utf-8",
  );
  const verdictLine = coordHead.split("\n").find((l) => l.includes("verdict: multi-feature"));
  assert.ok(
    verdictLine,
    "expected to find the 'verdict: multi-feature (<N> units) — signals: <which fired>' line in content/coord-01-core-head.md — if this line moved/changed, re-anchor this test, don't delete it",
  );
  for (const field of GUARDED_FIELDS) {
    assertAccepted(field.tool, field.build(verdictLine));
  }
});

const UNTERMINATED_QUOTE_PLUS_PROSE =
  'the bleed looked like <parameter name="pending_notes and then I wrote three more sentences describing what actually happened next.';

for (const field of GUARDED_FIELDS) {
  test(`AC2: ${field.name} accepts a tag fragment with an unterminated quote followed by further prose (round-2 F4 shape)`, () => {
    assertAccepted(field.tool, field.build(UNTERMINATED_QUOTE_PLUS_PROSE));
  });
}

test("AC2: a fragment quoted mid-string then closed, with prose both before and after, is accepted (this spec's own worked example)", () => {
  // The spec's own paragraph about this check quotes such fragments as prose
  // followed by more sentences; AC2 names it as the worked example the check
  // must not flag. (specs/e92-e86-handoff-write-boundary.md AC2)
  const value =
    'E86 targets tails like <parameter name="pending_notes"> or </invoke>-style fragments bleeding in, but this sentence just quotes them as prose and keeps going.';
  for (const field of GUARDED_FIELDS) {
    assertAccepted(field.tool, field.build(value));
  }
});

// ===========================================================================
// Deliberately accepted misses, pinned as ACCEPTED: a design with no tag-name list cannot
// tell a bare <parameter>/<invoke> from <role>/<div>. Tightening must update this test
// consciously (NEW-3, NEW-4, F3).
// ===========================================================================
const ACCEPTED_BY_DESIGN_SHAPES = [
  ["NEW-3: bare open tag <parameter> (no attribute, no slash)", "the bleed tail was <parameter>"],
  ["NEW-3: bare open tag <invoke>", "the bleed tail was <invoke>"],
  ["NEW-3: self-closing tag, no attribute <br/>", "line break rendered as <br/>"],
  ["F3/NEW-3: single-quoted attribute", "<parameter name='pending_notes'>"],
  ["F3/NEW-3: truncated exactly at '='", "<parameter name="],
  [
    "NEW-4: unterminated attribute value containing a space",
    '<parameter name="pending notes',
  ],
  ["NEW-4: unterminated attribute value containing a tab", '<parameter name="pending\tnotes'],
  [
    "NEW-4: unterminated attribute value containing a newline",
    '<parameter name="pending\nnotes',
  ],
];

for (const field of GUARDED_FIELDS) {
  for (const [label, value] of ACCEPTED_BY_DESIGN_SHAPES) {
    test(`AC2 (documented accepted miss, NOT a defect): ${field.name} accepts ${label}`, () => {
      assertAccepted(field.tool, field.build(value));
    });
  }
}

// ===========================================================================
// Whitespace / Unicode boundary (NEW-2): a trailing space, tab, newline, CRLF, NBSP, U+2028,
// U+2029 or U+200B after a true-positive tail must NOT defeat the check. U+200B is fragile:
// it rests on one escape in one character class in tools/registry.ts that an autofix could delete.
// ===========================================================================
const TRAILING_WHITESPACE_VARIANTS = [
  ["trailing space", " "],
  ["trailing tab", "\t"],
  ["trailing newline", "\n"],
  ["trailing CRLF", "\r\n"],
  ["trailing NBSP (U+00A0)", " "],
  ["trailing U+2028 (line separator)", " "],
  ["trailing U+2029 (paragraph separator)", " "],
  ["trailing U+200B (zero-width space) — NEW-2", "​"],
];

for (const field of ["qa_review", "pending_notes[0]"]) {
  const descriptor = GUARDED_FIELDS.find((f) => f.name === field);
  for (const [label, trailer] of TRAILING_WHITESPACE_VARIANTS) {
    test(`Whitespace boundary: ${field} rejection survives a ${label} after the tag`, () => {
      const value = `the bleed tail was </invoke>${trailer}`;
      assertRejectedWithMarkupMessage(
        descriptor.tool,
        descriptor.build(value),
        e86Message(field),
      );
    });
  }
}

test("Whitespace boundary (static): tools/registry.ts and its dist mirror contain the U+200B escape, not a raw invisible byte", () => {
  // Static check: the source holds the six ASCII characters of the escape, not a raw
  // invisible U+200B byte (which a lint autofix or copy-paste could delete unnoticed).
  // Guards the failure mode the behavioral test above cannot see.
  for (const rel of ["tools/registry.ts", "dist/tools/registry.js"]) {
    const text = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
    const rawZwsCount = (text.match(/​/gu) || []).length;
    assert.equal(rawZwsCount, 0, `${rel} contains a literal U+200B codepoint, expected the escaped form`);
  }
});

// ==========================================================================
// AC5 — boundary tests just under each affected cap, no markup, accepted.
// ==========================================================================
function safeFiller(len) {
  return "safe prose with no markup at all ".repeat(Math.ceil(len / 34)).slice(0, len);
}

const CAP_BOUNDARIES = [
  { field: "pending_notes[0]", cap: 1000 },
  { field: "scope_decision_why", cap: 2000 },
  { field: "qa_review", cap: 10000 },
  { field: "blocking_reason", cap: 2000 },
  { field: "description", cap: 2000 },
];

for (const { field, cap } of CAP_BOUNDARIES) {
  test(`AC5: ${field} at exactly its ${cap}-char cap with no markup is accepted`, () => {
    const descriptor = GUARDED_FIELDS.find((f) => f.name === field);
    assertAccepted(descriptor.tool, descriptor.build(safeFiller(cap)));
  });
}

// ===========================================================================
// Corpus sweep (AC2/AC5), the method that caught both blockers: every non-blank line of
// content/*.md and docs/backlog.md (3 over the qa_review 10000-char cap are skipped) goes
// through the shipped tw_update_state schema as a qa_review value; zero should reject.
// content/ is read-only input here.
// ===========================================================================
test("Corpus sweep: every non-blank line of content/*.md and docs/backlog.md is accepted as a qa_review value", () => {
  const files = [
    ...fs
      .readdirSync(path.join(PROJECT_ROOT, "content"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join("content", f)),
    path.join("docs", "backlog.md"),
  ];

  const lines = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
    text.split("\n").forEach((line, i) => {
      if (line.trim().length > 0 && line.length <= 10000) {
        lines.push({ file: rel, lineNo: i + 1, text: line });
      }
    });
  }

  // Sanity floor: fail loudly if the corpus collapsed to near-nothing (e.g.
  // a bad path), rather than silently passing a vacuous sweep.
  assert.ok(
    lines.length > 1000,
    `expected a substantial corpus (>1000 non-blank lines), got ${lines.length} — check the file list`,
  );

  const rejections = [];
  for (const { file, lineNo, text } of lines) {
    try {
      runTool(updateStateTool, { ...baseUpdateStateArgs(), qa_review: text });
    } catch (err) {
      rejections.push({ file, lineNo, text, err: err.issues?.map((i) => i.message) });
    }
  }

  assert.equal(
    rejections.length,
    0,
    `expected 0 false-positive rejections across ${lines.length} real corpus lines, got ${rejections.length}:\n${JSON.stringify(rejections.slice(0, 5), null, 2)}`,
  );
});

// ==========================================================================
// AC3: when whole pending notes are dropped for size, a marker line says how many were
// omitted. Re-runs the five fixtures the code reviewer ran, against the compiled dist.
// ==========================================================================
function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e92e86-qa-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function mkNote(len, tag) {
  return `${tag}-`.padEnd(len, "x");
}

async function writeNotesAndRead(ws, notes) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState(ws, FEATURE, "In_Progress", [], notes, undefined, "sr-engineer");
  return JSON.parse(readHandoffState(ws));
}

test("AC3: 4x1000-char notes (3 fill the 3000-char budget exactly, 4th dropped wholly) -> omitted=1, marker is the last entry", async () => {
  const notes = [0, 1, 2, 3].map((i) => mkNote(1000, `n${i}`));
  const state = await writeNotesAndRead(mkWorkspace(), notes);
  assert.ok(state.pending_notes_truncated, "expected pending_notes_truncated advisory");
  assert.equal(state.pending_notes[state.pending_notes.length - 1], e92Marker(1));
});

test("AC3: 5x900-char notes (note 4 partially kept, note 5 dropped wholly) -> omitted=1", async () => {
  const notes = [0, 1, 2, 3, 4].map((i) => mkNote(900, `n${i}`));
  const state = await writeNotesAndRead(mkWorkspace(), notes);
  assert.equal(state.pending_notes[state.pending_notes.length - 1], e92Marker(1));
  // The partially-kept 4th note still carries the pre-existing per-note
  // marker (unchanged convention) — not replaced by the whole-drop marker.
  assert.match(state.pending_notes[3], /…\[truncated\]$/);
});

test("AC3: 1x4000-char note (partial only, nothing dropped) -> no whole-drop marker emitted", async () => {
  const notes = [mkNote(4000, "n0")];
  const state = await writeNotesAndRead(mkWorkspace(), notes);
  assert.equal(state.pending_notes.length, 1, "no synthetic marker entry should be appended");
  assert.doesNotMatch(
    state.pending_notes[0],
    /further note\(s\) omitted/,
    "the single partially-kept note must not be mistaken for a whole-drop marker",
  );
});

test("AC3: 2500 + 1000 + 1000 chars (partial then a wholly-dropped note) -> omitted=1", async () => {
  const notes = [mkNote(2500, "n0"), mkNote(1000, "n1"), mkNote(1000, "n2")];
  const state = await writeNotesAndRead(mkWorkspace(), notes);
  assert.equal(state.pending_notes[state.pending_notes.length - 1], e92Marker(1));
});

test("AC3: 3000 + 50x10-char notes -> omitted=50, marker byte-exact", async () => {
  const notes = [mkNote(3000, "n0"), ...Array.from({ length: 50 }, (_, i) => mkNote(10, `m${i}`))];
  const state = await writeNotesAndRead(mkWorkspace(), notes);
  assert.equal(state.pending_notes[state.pending_notes.length - 1], e92Marker(50));
});

// ==========================================================================
// AC4 (negative requirement, E92) — reading a pre-existing over-cap
// scope_decision_why (simulating data written before the write-time zod
// ceiling existed) must not throw. This cut introduces NO read-path length
// re-validation (spec Out of Scope) — asserting "does not throw" is the
// correct shape of test for a negative requirement.
// ==========================================================================
test("AC4: reading a crafted over-cap scope_decision_why from a handoff fixture does not throw", () => {
  const ws = mkWorkspace();
  const overCapWhy = "w".repeat(2500); // write-time zod ceiling is 2000
  fs.writeFileSync(
    path.join(ws, ".current", "handoff.md"),
    `---
schema_version: 13
active_feature: "${FEATURE}"
status: "In_Progress"
last_updated: "2026-01-01T00:00:00.000Z"
last_agent: "pm"
scope_decision: "single-feature"
scope_decision_why: "${overCapWhy}"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 0
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
---
## Completed
- (none)

## Pending & Handoff Notes
- next_role: sr-engineer
`,
    "utf-8",
  );

  let state;
  assert.doesNotThrow(() => {
    state = JSON.parse(readHandoffState(ws));
  }, "AC4 is a negative requirement — the read path must not re-validate write-time caps");
  assert.equal(
    state.scope_decision_why.length,
    2500,
    "the over-cap value must be preserved intact, not silently truncated or rejected",
  );
});
