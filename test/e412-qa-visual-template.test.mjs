// Coded by @qa-engineer
// E412: the visual subagent template must say whose visual sub-dispatch it is and that it is the judge
// context, and coord-05 must say when to pick it over the judge's plain template. Pins the frontmatter shape
// and the delegation so a wording edit cannot break dispatch.
// E434 re-pin (file name kept, D20): the template is now templates/claude-code-agents/reviewer-visual.md,
// code-reviewer's visual sub-dispatch pinned to opus, delegating to tw_switch_role("code-reviewer"); coord-05
// picks it over `code-reviewer` for the judge hop (Copy tpl.rv_* and coord05.dispatch in specs/e434-reviewer-visual.md).
// Resident-hygiene: lines are located by content, never by a fixed base sha.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
// Read lazily so a missing template fails each named test, not the module load.
const TPL = path.join(ROOT, "templates", "claude-code-agents", "reviewer-visual.md");
const tplLines = () => fs.readFileSync(TPL, "utf-8").split("\n");
const coord = read("content", "coord-05-core-visual-drift.md").split("\n");

test("AC1: frontmatter keeps exactly three keys, model opus, name reviewer-visual", () => {
  const tpl = tplLines();
  assert.equal(tpl[0], "---");
  assert.equal(tpl[1], "name: reviewer-visual");
  assert.equal(tpl[2], "model: opus");
  assert.match(tpl[3], /^description: /);
  assert.equal(tpl[4], "---");
});

test("AC1: description names the code-reviewer sub-dispatch, the judge context and Visual Baselines", () => {
  const tpl = tplLines();
  assert.equal(
    tpl[3],
    "description: code-reviewer's visual sub-dispatch — the judge context for the visual verdict on a design-armed feature with Visual Baselines; reads images only over threshold.",
  );
  assert.ok(!tpl[3].includes("Phase 1.5"), "the retired phase name is gone");
});

test("AC2: CRITICAL watermark line stays the first body line", () => {
  const tpl = tplLines();
  assert.match(tpl[6], /^CRITICAL: End every reply with `— @reviewer-visual \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\.$/);
});

test("AC2: body states when to use it and delegates to the code-reviewer SOP", () => {
  const b = tplLines().slice(7).join("\n");
  assert.ok(b.includes("`code-reviewer`"), "names the judge it stands in for");
  assert.ok(b.includes("design-armed"));
  assert.ok(b.includes("`## Visual Baselines`"));
  assert.ok(b.includes('call `tw_get_state` then `tw_switch_role("code-reviewer")`'), "pre-flight, then the code-reviewer SOP");
  assert.ok(!b.includes('tw_switch_role("qa-engineer")'), "no qa-engineer delegation");
  assert.ok(!b.includes("qa-engineer's visual sub-dispatch"), "no longer qa-engineer's sub-dispatch");
});

test("AC3: coord-05 dispatch line carries the when-to-pick clause and the pinned parenthetical", () => {
  const l = coord.find((x) => x.startsWith("- **No accept-policy injection.**"));
  assert.ok(l, "dispatch line present");
  assert.ok(l.includes("When dispatching `reviewer-visual` (subagent-dispatch tool only; `tw_switch_role` has no `reviewer-visual` role, so that fallback switches to `code-reviewer`, whose SOP loads the visual rules)"));
  assert.ok(l.includes("picked over `code-reviewer` for the judge hop"));
  assert.ok(l.includes("design-armed"));
  assert.ok(l.includes("`design/<feature>.md` has `## Visual Baselines`"));
  assert.ok(l.endsWith("the brief MAY"));
});
