// E409 - the handler facts behind content/skill-coordinator-lite.md "Server-read-only".
// Why: the lite SOP claims tw_update_state / tw_complete_task are server-rejected and
// tw_add_task / tw_rollback_task / tw_void_task are only SOP-forbidden. That claim is a
// statement about handler source; if a handler gains or loses an agent gate the SOP
// line goes stale silently. Bodies are located by function name (no line numbers).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const FIX = "update the 'Server-read-only' line of content/skill-coordinator-lite.md (E409) to match";

function body(src, name) {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} must exist in tools/tasks.ts`);
  const next = src.indexOf("\nexport ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

const tasks = read("tools/tasks.ts");
const lite = read("content/skill-coordinator-lite.md");

test("AC2: handleCompleteTask is agent-gated (requireQaEngineer), so lite's server-rejected claim holds", () => {
  assert.match(body(tasks, "handleCompleteTask"), /requireQaEngineer\(/, FIX);
});

for (const [fn, tool] of [
  ["handleAddTask", "tw_add_task"],
  ["handleRollbackTask", "tw_rollback_task"],
  ["handleVoidTask", "tw_void_task"],
]) {
  test(`AC2: ${fn} runs enforcePreFlight and no agent gate, so ${tool} is SOP-forbidden only`, () => {
    const b = body(tasks, fn);
    assert.match(b, new RegExp(`enforcePreFlight\\([^)]*"${tool}"`), `${fn} keeps pre-flight`);
    assert.doesNotMatch(b, /requireQaEngineer\(|requireAgent|\.agent_id/, `${fn} gained an agent gate; ${FIX}`);
  });
}

test("AC2: tw_update_state rejects a write with no agent_id (AGENT_ID_REQUIRED) as precedence step 1", () => {
  const src = read("tools/transitions.ts");
  const start = src.indexOf("export function validateTransition(");
  assert.ok(start >= 0, "validateTransition must exist");
  const b = src.slice(start, start + 800);
  const nullCheck = b.indexOf("req.next.agent === null");
  const code = b.indexOf('"AGENT_ID_REQUIRED"');
  assert.ok(nullCheck >= 0 && code > nullCheck, `missing agent_id must map to AGENT_ID_REQUIRED; ${FIX}`);
});

test("AC2: the lite line states exactly the gated vs SOP-forbidden split these handlers have", () => {
  assert.ok(
    lite.includes(
      "`tw_update_state` / `tw_complete_task`: server-rejected; `tw_add_task` / `tw_rollback_task` / `tw_void_task` / `tw_switch_role`: SOP-forbidden.",
    ),
    "lite line must match the verified handler facts",
  );
});
