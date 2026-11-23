// Coded by @qa-engineer
// Tests for specs/e247-qa-pass-unticked-gate.md AC9, AC13, AC14 (E380, E237 (a)).
// Why: qa never filled the structured `qa_suite_result`, and a PASS that lists only qa's own
// tasks now trips PASS_TASKS_INCOMPLETE. The PASS line of the qa SOP is the only place qa is told
// either, so its exact text is pinned, and the SOP stays under the prompt-size cap.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";

// E433: the PASS write moved from the qa SOP to the code-reviewer SOP (the chain's judge);
// qa-engineer is the test author now and writes no PASS. The pinned line is the PASS row bullet.
const SOP = fs.readFileSync(new URL("../content/skill-code-reviewer.md", import.meta.url), "utf-8");
const QA_SOP = fs.readFileSync(new URL("../content/skill-qa-engineer.md", import.meta.url), "utf-8");

const PASS_WRITE =
  '- **PASS row**: `tw_update_state(status=PASS, agent_id="code-reviewer", review_verdict="APPROVED", completed_tasks=[<ids>], qa_review="<summary>", qa_suite_result={passed, total, command})` from the full suite. ' +
  "`completed_tasks` lists every feature task, qa-engineer's and sr-engineer's (else `PASS_TASKS_INCOMPLETE`). " +
  "The server records `qa_review` into the judge report and checks evidence (else `MISSING_EVIDENCE` / `QA_COMPLETION_EVIDENCE_MISSING`). " +
  'Then `tw_complete_task(<task-id>, agent_id="code-reviewer")` per id.';

function passLine() {
  return SOP.split("\n").find((l) => l.startsWith("- **PASS row**"));
}

test("AC9: skill-code-reviewer.md's PASS row equals the pinned PASS write byte for byte", () => {
  assert.equal(passLine(), PASS_WRITE);
});

test("AC9: the PASS line lists every feature task and quotes PASS_TASKS_INCOMPLETE", () => {
  const line = passLine();
  assert.ok(line.includes("lists every feature task, qa-engineer's and sr-engineer's"));
  assert.ok(line.includes("`PASS_TASKS_INCOMPLETE`"));
});

test("AC13: the PASS line tells the judge to fill qa_suite_result from the full suite, and the rejection row carries it too", () => {
  assert.ok(passLine().includes("qa_suite_result={passed, total, command})` from the full suite."));
  const rejection = SOP.split("\n").find((l) => l.startsWith("- **Rejection rows**"));
  assert.ok(rejection && rejection.includes("qa_suite_result"), "FAIL writes carry qa_suite_result too");
});

test("AC9: qa-engineer's SOP no longer carries a PASS write", () => {
  assert.ok(!QA_SOP.includes('status=PASS, agent_id="qa-engineer"'), "qa-engineer writes no PASS");
});

test("AC14: skill-qa-engineer.md stays within the 18500-byte prompt cap", () => {
  assert.ok(Buffer.byteLength(QA_SOP, "utf-8") <= 18500, `size ${Buffer.byteLength(QA_SOP, "utf-8")}`);
});
