// Coded by @qa-engineer: pin for specs/e262-sop-text-fixes.md AC-E360-1 (T-E360-02).
// WHY: the server rejects a qa FAIL write with no review_task_ids (QA_REVIEW_TARGET_REQUIRED), so a
// Phase 1.5 FAIL call that omits it never moves the failed ids out of the completed_tasks ledger.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = fs.readFileSync(path.join(ROOT, "content/skill-qa-visual.md"), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;

test("AC-E360-1: every Phase 1.5 tw_update_state(status=FAIL call carries review_task_ids right after qa_review", () => {
  assert.equal(count(SKILL, "status=FAIL"), 5);
  assert.equal(count(SKILL, "review_task_ids=[<task-id>]"), 5);
  const calls = SKILL.split("\n").filter((l) => l.includes("status=FAIL"));
  assert.equal(calls.length, 5, "one FAIL call per row");
  for (const l of calls) {
    assert.match(l, /qa_review=(?:"[^"]*"|[^,]+), review_task_ids=\[<task-id>\], next_role=/, `FAIL call order: ${l.slice(0, 80)}`);
  }
});
