// Coded by @qa-engineer: pin for specs/e262-sop-text-fixes.md AC-E360-1 (T-E360-02).
// WHY: the server rejects a judge FAIL write with no review_task_ids (QA_REVIEW_TARGET_REQUIRED), so a
// visual FAIL call that omits it never moves the failed ids out of the completed_tasks ledger.
// E434 re-pin (file name kept, D20): the visual sub-skill is content/skill-reviewer-visual.md and its
// rejections are code-reviewer CHANGES_REQUESTED writes, so every FAIL call it spells out carries
// review_task_ids and the code-reviewer identity; no qa-engineer FAIL call remains.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("AC-E360-1: every visual tw_update_state(status=FAIL call carries review_task_ids and the code-reviewer identity", () => {
  // Read inside the test so a missing file fails this named test, not the module load.
  const SKILL = fs.readFileSync(path.join(ROOT, "content/skill-reviewer-visual.md"), "utf-8");
  const calls = SKILL.split("\n").filter((l) => l.includes("tw_update_state(status=FAIL"));
  for (const l of calls) {
    assert.match(l, /review_task_ids=\[/, `FAIL call names review_task_ids: ${l.slice(0, 120)}`);
    assert.match(l, /agent_id="code-reviewer"/, `FAIL call is a code-reviewer write: ${l.slice(0, 120)}`);
  }
  assert.ok(!SKILL.includes('agent_id="qa-engineer"'), "no qa-engineer visual FAIL call remains");
});
