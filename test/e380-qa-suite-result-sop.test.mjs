// Coded by @qa-engineer
// Tests for specs/e247-qa-pass-unticked-gate.md AC9, AC13, AC14 (E380, E237 (a)).
// Why: qa never filled the structured `qa_suite_result`, and a PASS that lists only qa's own
// tasks now trips PASS_TASKS_INCOMPLETE. The PASS line of the qa SOP is the only place qa is told
// either, so its exact text is pinned, and the SOP stays under the prompt-size cap.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";

const SOP = fs.readFileSync(new URL("../content/skill-qa-engineer.md", import.meta.url), "utf-8");

// Spec Copy/Strings `qa.pass-write`: the file line has three leading spaces and plain backticks.
const PASS_WRITE =
  '   - **PASS** → `tw_update_state(status=PASS, agent_id="qa-engineer", completed_tasks=[<ids>], qa_review="<summary>", pending_notes=["QA: <task-id> PASS"])`. ' +
  "`completed_tasks` lists every feature task, not only yours (else `PASS_TASKS_INCOMPLETE`). " +
  'Fill `qa_suite_result` from the full suite (FAIL too). ' +
  "Server auto-records the review (file: `qa_reports/review_<id>.md`; SQLite: `reports` row) and checks evidence (else `MISSING_EVIDENCE`). " +
  "`covers:` is for pre-PASS manual batch files. " +
  'Then `tw_complete_task(<task-id>, agent_id="qa-engineer")` per completed id.';

test("AC9: skill-qa-engineer.md line 90 equals qa.pass-write byte for byte", () => {
  assert.equal(SOP.split("\n")[89], PASS_WRITE);
});

test("AC9: the PASS line lists every feature task and quotes PASS_TASKS_INCOMPLETE", () => {
  const line = SOP.split("\n")[89];
  assert.ok(line.includes("lists every feature task, not only yours"));
  assert.ok(line.includes("`PASS_TASKS_INCOMPLETE`"));
});

test("AC13: the PASS line tells qa to fill qa_suite_result from the full suite, on FAIL too", () => {
  const line = SOP.split("\n")[89];
  assert.ok(line.includes("Fill `qa_suite_result` from the full suite (FAIL too)."));
});

test("AC14: skill-qa-engineer.md stays within the 18500-byte prompt cap", () => {
  assert.ok(Buffer.byteLength(SOP, "utf-8") <= 18500, `size ${Buffer.byteLength(SOP, "utf-8")}`);
});
