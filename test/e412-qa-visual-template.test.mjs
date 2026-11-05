// Coded by @qa-engineer
// E412: the qa-visual subagent template must say it is qa-engineer's visual sub-dispatch and an
// independent judge context, and coord-05 must say when to pick it over qa-engineer. Pins the
// frontmatter shape and the unchanged delegation so the wording edit cannot break dispatch.
// Resident-hygiene: lines are located by content, never by a fixed base sha.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const tpl = read("templates", "claude-code-agents", "qa-visual.md").split("\n");
const coord = read("content", "coord-05-core-visual-drift.md").split("\n");

test("AC1: frontmatter keeps exactly three keys, model sonnet, name qa-visual", () => {
  assert.equal(tpl[0], "---");
  assert.equal(tpl[1], "name: qa-visual");
  assert.equal(tpl[2], "model: sonnet");
  assert.match(tpl[3], /^description: /);
  assert.equal(tpl[4], "---");
});

test("AC1: description names the sub-dispatch, independent judge context and Visual Baselines", () => {
  const d = tpl[3];
  assert.ok(d.includes("qa-engineer's visual sub-dispatch"));
  assert.ok(d.includes("independent judge context"));
  assert.ok(d.includes("Visual Baselines"));
  assert.ok(d.includes("(Phase 1.5)"));
});

test("AC2: CRITICAL watermark line stays the first body line", () => {
  assert.match(tpl[6], /^CRITICAL: End every reply with `— @qa-visual \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\.$/);
});

test("AC2: body states when to use it and keeps the delegation unchanged", () => {
  const b = tpl[8];
  assert.ok(b.includes("qa-engineer's visual sub-dispatch"));
  assert.ok(b.includes("an independent judge context"));
  assert.ok(b.includes("owns the visual verdict (Constitution §3.2)"));
  assert.ok(b.includes("in place of `qa-engineer`"));
  assert.ok(b.includes("design-armed"));
  assert.ok(b.includes("`design/<feature>.md` has a `## Visual Baselines` section"));
  assert.ok(b.includes('On invocation, call `tw_get_state` then `tw_switch_role("qa-engineer")` and follow the returned SOP'));
});

test("AC3: coord-05 dispatch line carries the when-to-pick clause and the pinned parenthetical", () => {
  const l = coord.find((x) => x.startsWith("- **No accept-policy injection.**"));
  assert.ok(l, "dispatch line present");
  assert.ok(l.includes("(subagent-dispatch tool or `tw_switch_role`)"));
  assert.ok(l.includes("picked over `qa-engineer` for the QA hop"));
  assert.ok(l.includes("design-armed"));
  assert.ok(l.includes("`design/<feature>.md` has `## Visual Baselines`"));
  assert.ok(l.endsWith("the brief MAY"));
});
