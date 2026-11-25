// Coded by @qa-engineer
// Scenario tests for specs/e448-judge-evidence-checks.md AC5-AC6 (E451).
// Invariant: the visual report's table-header skip matches only a real header cell — `surface` /
// `Surface ID` in Region Diff, `assertion id` / `Assertion ID` in Structural Assertions. A failed data row
// whose id merely CONTAINS "surface" or "assertion id" (card-surface, Surfaces.list, assertionIdle) is a
// failure, never a header, so a naming accident cannot carry a broken screen to PASS.
// Tests drive the real tw_update_state tool entry on a design-armed file-mode feature at
// code-reviewer:In_Progress; the judge PASS carries qa_review (server PASS verdict) and a review_reports/
// file, so only the visual report decides the outcome.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { writeHandoffState } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

const UPD = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔");
const state = (ws) => new FileHandoffStorage().parse(ws);
const put = (ws, rel, body) => {
  fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
  fs.writeFileSync(path.join(ws, rel), body);
};

async function seed(ws, feature, agent, status, opts = {}) {
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws, activeFeature: feature, status, completedTasks: [], pendingNotes: ["seed"],
    lastAgent: agent, cutApproved: true, ...opts,
  });
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
}
async function upd(ws, args) {
  setActiveStorage(new FileHandoffStorage());
  forceSeedStampIfExists(ws);
  resetSession(ws);
  markStateRead(ws);
  try {
    return await UPD.run({ workspace_path: ws, completed_tasks: [], pending_notes: [], ...args });
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `⛔ ${err.message}` }] };
  }
}

const F = "e451-visual-feat";
const judgePass = () => ({
  active_feature: F, status: "PASS", agent_id: "code-reviewer", completed_tasks: ["T-1"],
  review_task_ids: ["T-1"], review_verdict: "APPROVED", qa_review: "visual verdict recorded; every AC green",
});

// A design-armed design file: `## Mode` figma, one baseline surface, one structural assertion, one audited
// Source row (single surface: no baseline-selection provenance needed).
const DESIGN = `# design/${F}

## Mode

figma

## Source

| medium | pointer | fetched? | status | reason |
|---|---|---|---|---|
| figma | node:1:100 | yes | audited | frozen |

## Visual Baselines

| surface id | source node | baseline path | impl path | viewport | route | canonical state | compare region | notes |
|---|---|---|---|---|---|---|---|---|
| settings.language | node:1:100 | design/baselines/language.png | screenshots/language.png | 1920x1080 | /settings/language | selected: English | 0,0,400,300 | threshold 0.5% |

## Visual Structural Assertions

| assertion id | surface | required element/state | source node/token |
|---|---|---|---|
| focus.bar | settings.language | selected row shows the #3C5AAA bar | node:1:101 |
`;

const surfaceBlock = (id) => `### ${id}\n- baseline: sha256:4be91c02a7d3\n- diff-metric: odiff: 0.1% (threshold 0.5%, within)\n- pixel_gate_complete: true\n`;

// regionRows: [[id, result]], assertionRows: [[id, result]]; header cells overridable.
function visualReport({
  regionHeader = "surface", regionRows = [["settings.language", "pass"]],
  assertionHeader = "assertion id", assertionRows = [["focus.bar", "pass"]],
} = {}) {
  return `# Visual report — T-1

## Widget Shape Verification
- [x] language.list — selectable list rendered (within threshold of the baseline)

## Canonical State Verification
- [x] settings.language — capture check reached {selected: English}

## Structural Assertions
| ${assertionHeader} | surface | required element/state | source node/token | result |
|---|---|---|---|---|
${assertionRows.map(([id, res]) => `| ${id} | settings.language | element present | node:1:101 | ${res} |`).join("\n")}

## Region Diff
| ${regionHeader} | result |
|---|---|
${regionRows.map(([id, res]) => `| ${id} | ${res} |`).join("\n")}

${regionRows.map(([id]) => surfaceBlock(id)).join("\n")}
## Allowed Differences
None.

## Verdict — PASS
`;
}

async function visualWs(prefix, visual) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanup.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  await seed(ws, F, "code-reviewer", "In_Progress");
  put(ws, `design/${F}.md`, DESIGN);
  put(ws, "qa_reports/review_T-1.md", "# QA review — T-1\n\nscenarios exercised\n");
  put(ws, "review_reports/review_T-1.md", "# Code review — T-1\n\nVerdict: APPROVED\n");
  put(ws, "qa_reports/visual_T-1.md", visual);
  return ws;
}

// ---------------------------------------------------------------- AC5

test("AC5: a failed Region Diff row whose id contains 'surface' (card-surface, Surfaces.list) is rejected VISUAL_REPORT_INCOMPLETE naming it; real header cells (surface, Surface ID) are still skipped", async () => {
  for (const [id, result] of [["card-surface", "fail"], ["Surfaces.list", "material"]]) {
    const ws = await visualWs("e451-ac5-", visualReport({ regionRows: [["settings.language", "pass"], [id, result]] }));
    const r = await upd(ws, judgePass());
    assert.ok(rejected(r), `${id} | ${result} must not ride to PASS: ${text(r)}`);
    assert.match(text(r), /^⛔ VISUAL_REPORT_INCOMPLETE: /);
    assert.ok(text(r).includes(`region-diff fail: ${id}`), `names ${id}: ${text(r)}`);
    assert.equal(state(ws).status, "In_Progress", "no state written");
  }
  // Header rows are not data: no failure reported for them, every data row passes -> PASS accepted.
  for (const header of ["surface", "Surface ID"]) {
    const ws = await visualWs("e451-ac5h-", visualReport({ regionHeader: header }));
    const r = await upd(ws, judgePass());
    assert.ok(!rejected(r), `header '${header}' is skipped: ${text(r)}`);
    assert.equal(state(ws).status, "PASS");
  }
});

// ---------------------------------------------------------------- AC6

test("AC6: a failed Structural Assertions row id assertionIdle is rejected VISUAL_REPORT_INCOMPLETE with structural fail: assertionIdle; header cells assertion id / Assertion ID are still skipped", async () => {
  // Red on the base tree: its header test /assertion\s*id/i matches inside "assertionIdle".
  const ws = await visualWs("e451-ac6-", visualReport({ assertionRows: [["focus.bar", "pass"], ["assertionIdle", "fail"]] }));
  const r = await upd(ws, judgePass());
  assert.ok(rejected(r), `assertionIdle | fail must not ride to PASS: ${text(r)}`);
  assert.match(text(r), /^⛔ VISUAL_REPORT_INCOMPLETE: /);
  assert.ok(text(r).includes("structural fail: assertionIdle"), `names assertionIdle: ${text(r)}`);
  assert.equal(state(ws).status, "In_Progress", "no state written");

  for (const header of ["assertion id", "Assertion ID"]) {
    const ok = await visualWs("e451-ac6h-", visualReport({ assertionHeader: header }));
    const r2 = await upd(ok, judgePass());
    assert.ok(!rejected(r2), `header '${header}' is skipped: ${text(r2)}`);
    assert.equal(state(ok).status, "PASS");
  }
});
