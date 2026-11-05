// Coded by @qa-engineer
// E413: the PM Question Batch Gate told PM to use the AskUserQuestion tool, which a subagent-dispatched
// PM does not have and which /teamwork operators do not use. WHY: clarifications are presented inline,
// numbered, with a recommended answer, and the turn ends; a subagent PM routes them via the coordinator.
// The Cut-Approval prohibition on AskUserQuestion (line 111) must stay.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8").split("\n");
const row = lines[108];
const cells = row.split(" | ");
const action = cells[cells.length - 1];
const nonRationale = action.split("<!-- rationale:start -->")[0].trimEnd();

test("AC2/AC6: Question Batch Gate action text is exactly the specified string", () => {
  assert.ok(row.startsWith("| **Question Batch Gate** |"));
  assert.equal(
    nonRationale,
    "Batch them upfront, inline, numbered, ≤ 4 (2 batches if more), each with a recommended answer; end the turn (as a subagent: via the coordinator). Answers go in **Dependencies / Prerequisites**.",
  );
});

test("AC6: line 109 has no AskUserQuestion and carries the inline-batch contract", () => {
  assert.ok(!row.includes("AskUserQuestion"));
  for (const s of ["inline", "numbered", "≤ 4", "2 batches if more", "recommended answer", "end the turn", "coordinator", "**Dependencies / Prerequisites**"]) {
    assert.ok(nonRationale.includes(s), `missing: ${s}`);
  }
  assert.ok(nonRationale.length <= 194 - 0 + 0 && nonRationale.length === 193, "length 193 (<= original 194)");
});

test("AC6: trigger cell and rationale block are unchanged", () => {
  assert.ok(row.includes("| Any clarification you would have asked mid-flow: Resource Audit fetch/index/ignore decisions from step 3, plus any ambiguity that would trigger step 5. If zero clarifications accumulate → no-op (skip silently). |"));
  assert.ok(row.endsWith("<!-- rationale:start -->Reason: each mid-flow `Blocked` round-trip costs a human context-switch; batching upfront converts N round-trips into 1 and lets auto-routing run uninterrupted from PM onward.<!-- rationale:end --> |"));
});

test("AC6: pm line 111 keeps the cut-approval prohibition on AskUserQuestion", () => {
  assert.ok(lines[110].includes("do NOT use `AskUserQuestion`"));
  assert.ok(lines[110].includes("Subagent dispatch: if your turn ends"));
});
