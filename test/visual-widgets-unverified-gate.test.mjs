// Coded by @qa-engineer
// Tests for specs/v3.15.0.md — AC-1..AC-5.
// Asserts the R6 server-enforced Widget Shape Verification gate:
//   parseVisualWidgetsChecklist parses the markdown checkbox section,
//   hasUncheckedWidgets aggregates unchecked rows per task-id,
//   and the index.ts handler composition (unit-tested via the primitives
//   the handler calls — same pattern as visual-gate-e2e.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseVisualWidgetsChecklist,
  hasUncheckedWidgets,
} from "../dist/gates/visual.js";

function mkWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "vwug-"));
}

function seedVisualReport(ws, taskId, body) {
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", `visual_${taskId}.md`), body);
}

// ---------- AC-1 — unchecked → reject ----------

test("AC-1: parseVisualWidgetsChecklist returns unchecked rows when `- [ ]` present", () => {
  // Why: the load-bearing case. A qa-engineer who left a widget unchecked
  // must produce a non-empty unchecked list so the handler can reject PASS.
  const body = `# Visual report T01

## Widget Shape Verification
- [x] datetime.picker — column-scroller verified
- [ ] keyboard.virtual — MISSING on screen
- [x] segmented.tabs — rendered correctly

## Pixel Diff
(skipped)
`;
  const rows = parseVisualWidgetsChecklist(body);
  assert.equal(rows.length, 3, "must parse all three rows");
  assert.deepEqual(
    rows.map((r) => ({ widgetId: r.widgetId, checked: r.checked })),
    [
      { widgetId: "datetime.picker", checked: true },
      { widgetId: "keyboard.virtual", checked: false },
      { widgetId: "segmented.tabs", checked: true },
    ],
  );
});

test("AC-1: hasUncheckedWidgets composes to per-task missing widget list", () => {
  // Why: handler-facing helper. Must surface the EXACT unchecked widget ids
  // per task so the operator's one-round-trip error message lists them all.
  const ws = mkWorkspace();
  seedVisualReport(ws, "T01",
    "# T01\n\n## Widget Shape Verification\n- [x] picker\n- [ ] keyboard\n- [ ] toggle\n",
  );
  seedVisualReport(ws, "T02",
    "# T02\n\n## Widget Shape Verification\n- [x] scrollbar\n",
  );
  const result = hasUncheckedWidgets(ws, ["T01", "T02"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.uncheckedByTaskId, {
    T01: ["keyboard", "toggle"],
  });
});

// ---------- AC-2 — all checked → accept (gate passes through) ----------

test("AC-2: hasUncheckedWidgets returns ok:true when every row is checked", () => {
  const ws = mkWorkspace();
  seedVisualReport(ws, "T01",
    "# T01\n\n## Widget Shape Verification\n- [x] picker\n- [x] keyboard\n- [x] toggle\n",
  );
  const result = hasUncheckedWidgets(ws, ["T01"]);
  assert.equal(result.ok, true, "all [x] → gate accepts");
  assert.deepEqual(result.uncheckedByTaskId, {});
});

// ---------- AC-3 — missing section → accept (backwards-compat) ----------

test("AC-3: missing `## Widget Shape Verification` section → empty parse → accept", () => {
  // Why: pre-v3.15.0 visual reports didn't have this section. Backwards-
  // compat MUST allow them through; the gate verifies CLAIMED checks, not
  // mandates the claim shape (defense in depth: skill-qa-visual SOP still
  // requires writing the section).
  const body = "# Visual report T01\n\n## Pixel Diff\n(only pixel diff, no widget section)\n";
  const rows = parseVisualWidgetsChecklist(body);
  assert.deepEqual(rows, [], "no section → empty rows → no unchecked → ok");

  const ws = mkWorkspace();
  seedVisualReport(ws, "T01", body);
  const result = hasUncheckedWidgets(ws, ["T01"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.uncheckedByTaskId, {});
});

test("AC-3: empty input string → empty rows (defensive)", () => {
  assert.deepEqual(parseVisualWidgetsChecklist(""), []);
});

// ---------- AC-4 — error envelope lists every offending task + widget ----------

test("AC-4: hasUncheckedWidgets aggregates unchecked widgets across multiple tasks", () => {
  // Why: one PASS attempt may include multiple task ids; the gate MUST
  // report ALL of them in one envelope so the operator fixes everything
  // in one round-trip (not N rounds of retry-and-discover).
  const ws = mkWorkspace();
  seedVisualReport(ws, "T01",
    "# T01\n\n## Widget Shape Verification\n- [ ] picker\n- [ ] keyboard\n",
  );
  seedVisualReport(ws, "T02",
    "# T02\n\n## Widget Shape Verification\n- [x] scrollbar\n",
  );
  seedVisualReport(ws, "T03",
    "# T03\n\n## Widget Shape Verification\n- [ ] toggle\n",
  );
  const result = hasUncheckedWidgets(ws, ["T01", "T02", "T03"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.uncheckedByTaskId, {
    T01: ["picker", "keyboard"],
    T03: ["toggle"],
  });
  // T02 is absent from the dict because all its rows are checked.
});

// ---------- AC-5 — permissive whitespace, strict bracket content ----------

test("AC-5: `[x]` and `[X]` both count as checked (case-insensitive on x)", () => {
  const rows = parseVisualWidgetsChecklist(
    "## Widget Shape Verification\n- [x] lower\n- [X] upper\n",
  );
  assert.equal(rows[0].checked, true);
  assert.equal(rows[1].checked, true);
});

test("AC-5: `[Y]`, `[a]`, `[1]` all → unchecked (operator typos NOT silently accepted)", () => {
  // Why: the strictness is intentional. If we accepted any-non-blank as
  // checked, a typo would silently pass the gate. The strict reading
  // forces operators to use the documented `[x]` mark.
  const rows = parseVisualWidgetsChecklist(
    "## Widget Shape Verification\n- [Y] typo1\n- [a] typo2\n- [1] typo3\n",
  );
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.equal(r.checked, false, `bracket "[${r.rawLine.match(/\[(.)\]/)?.[1]}]" must NOT count as checked`);
  }
});

test("AC-5: `[ ]` (empty/whitespace) → unchecked", () => {
  const rows = parseVisualWidgetsChecklist(
    "## Widget Shape Verification\n- [ ] empty\n",
  );
  assert.equal(rows[0].checked, false);
});

test("AC-5: leading whitespace and extra spaces around the dash are tolerated", () => {
  // Why: markdown editors often add whitespace; the parser MUST be forgiving
  // on layout to avoid blocking PASS over cosmetic differences.
  const rows = parseVisualWidgetsChecklist(
    "## Widget Shape Verification\n-   [x]   widget1\n-\t[ ] widget2\n",
  );
  // The second line uses tab — our regex expects `\s+` which matches tabs.
  assert.equal(rows.length, 2);
  assert.equal(rows[0].checked, true);
  assert.equal(rows[0].widgetId, "widget1");
  assert.equal(rows[1].checked, false);
  assert.equal(rows[1].widgetId, "widget2");
});

test("AC-5: section heading is case-insensitive (`## widget shape verification` lowercased)", () => {
  const rows = parseVisualWidgetsChecklist(
    "## widget shape verification\n- [x] picker\n",
  );
  assert.equal(rows.length, 1);
});

// ---------- Edge cases & defensive ----------

test("edge: widget id with no description still parses", () => {
  // Why: operator wrote just the id, no separator. The full remainder
  // becomes the widget id.
  const rows = parseVisualWidgetsChecklist(
    "## Widget Shape Verification\n- [x] standalone-widget\n",
  );
  assert.equal(rows[0].widgetId, "standalone-widget");
});

test("edge: hasUncheckedWidgets silently skips missing visual report files (defensive belt)", () => {
  // Why: handler calls hasVisualEvidenceInFile FIRST; this function is
  // unreachable for missing files in production. The skip is defensive.
  const ws = mkWorkspace();
  const result = hasUncheckedWidgets(ws, ["T_does_not_exist"]);
  assert.deepEqual(result, { ok: true, uncheckedByTaskId: {} });
});

test("edge: section bounded by next `## ` heading — rows after that aren't parsed", () => {
  // Why: if a later section happens to contain checkbox-shaped lines, they
  // must NOT be misinterpreted as widget rows.
  const body = `## Widget Shape Verification
- [x] real-widget

## Pixel Diff
- [ ] not-a-widget — this is a pixel diff bullet
`;
  const rows = parseVisualWidgetsChecklist(body);
  assert.equal(rows.length, 1, "must stop at next ## heading");
  assert.equal(rows[0].widgetId, "real-widget");
});
