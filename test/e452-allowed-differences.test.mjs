// Coded by @qa-engineer
// Scenario tests for specs/e448-judge-evidence-checks.md AC7-AC10 (E452, human ruling: option (a),
// server-enforced under a new evidence_schema value).
// Invariant: from evidence schema v3 an `accepted` Region Diff surface is a recorded, reasoned exception —
// its id must appear in the report's `## Allowed Differences` section (anywhere in the text: list item,
// table cell or prose), or the judge PASS is refused VISUAL_REPORT_INCOMPLETE. A feature's evidence_schema
// pin is stamped on its first accepted write and kept for the feature's life, so a feature or report judged
// under pin 1 / 2 (or no pin) is never re-judged by the v3 rule.
// Tests drive the real tw_update_state tool entry against temp workspaces; the pin is seeded through the
// real handoff writer.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { EVIDENCE_SCHEMA_CURRENT } from "../dist/gates/evidence-schema.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { markStateRead, resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";
import { TOOL_REGISTRY } from "../dist/tools/registry.js";
import { forceSeedStamp, forceSeedStampIfExists } from "./e148-seed-stamp.mjs";

const UPD = TOOL_REGISTRY.find((e) => e.name === "tw_update_state");
const cleanup = [];
after(() => { for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true }); });

// hint.visual_report_incomplete (Copy / Strings, verbatim).
const HINT_VISUAL_REPORT_INCOMPLETE =
  "qa_reports/visual_<id>.md must contain Canonical State Verification, Structural Assertions, Region Diff (per-surface pass/accepted), Allowed Differences, and a Verdict that normalizes to exactly PASS — every row cleared (skill-reviewer-visual §Report schema; headings may carry prefixes/suffixes but must contain the canonical names, evidence schema v2). From evidence schema v3, every surface whose Region Diff result is accepted must also be named in the Allowed Differences section. Resolve the failed/unverified rows — do NOT pre-accept them (visual verdict is reviewer-visual-owned, Constitution §3.2).";
// msg.allowed_differences_unlisted: one reasons entry inside the per-task {…} listing.
const UNLISTED = (ids) => `accepted but not in ## Allowed Differences: ${ids.join("/")}`;

const text = (r) => r?.content?.[0]?.text ?? "";
const rejected = (r) => Boolean(r?.isError) || text(r).startsWith("⛔");
const state = (ws) => new FileHandoffStorage().parse(ws);
const put = (ws, rel, body) => {
  fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
  fs.writeFileSync(path.join(ws, rel), body);
};
function mkWs(prefix) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanup.push(ws);
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

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

const F = "e452-visual-feat";
const judgePass = () => ({
  active_feature: F, status: "PASS", agent_id: "code-reviewer", completed_tasks: ["T-1"],
  review_task_ids: ["T-1"], review_verdict: "APPROVED", qa_review: "visual verdict recorded; every AC green",
});

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

const surfaceBlock = (id, metric) => `### ${id}\n- baseline: sha256:4be91c02a7d3\n- diff-metric: ${metric}\n- pixel_gate_complete: true\n`;
const OVER = "odiff: 0.9% (threshold 0.5%, over; judged by image read)";

// rows: [[surface id, result]]; allowed: the ## Allowed Differences body (may be "").
function visualReport({ rows = [["settings.language", "accepted"]], allowed }) {
  return `# Visual report — T-1

## Widget Shape Verification
- [x] language.list — selectable list rendered (within threshold of the baseline)

## Canonical State Verification
- [x] settings.language — capture check reached {selected: English}

## Structural Assertions
| assertion id | surface | required element/state | source node/token | result |
|---|---|---|---|---|
| focus.bar | settings.language | selected row shows the #3C5AAA bar | node:1:101 | pass |

## Region Diff
| surface | result |
|---|---|
${rows.map(([id, res]) => `| ${id} | ${res} |`).join("\n")}

${rows.map(([id]) => surfaceBlock(id, OVER)).join("\n")}
## Allowed Differences
${allowed}

## Verdict — PASS
`;
}

// A design-armed feature at code-reviewer:In_Progress; pin === undefined seeds no evidence_schema at all.
async function visualWs(prefix, { pin, visual }) {
  const ws = mkWs(prefix);
  await seed(ws, F, "code-reviewer", "In_Progress", pin === undefined ? {} : { evidenceSchema: pin });
  put(ws, `design/${F}.md`, DESIGN);
  put(ws, "qa_reports/review_T-1.md", "# QA review — T-1\n\nscenarios exercised\n");
  put(ws, "review_reports/review_T-1.md", "# Code review — T-1\n\nVerdict: APPROVED\n");
  put(ws, "qa_reports/visual_T-1.md", visual);
  return ws;
}

const SPEC_WITH_PROOF = (f) => `# ${f}\n\n## Acceptance Criteria\n\n- **AC1** thing\n  proof: \`node --test x\`\n`;

// ---------------------------------------------------------------- AC7

test("AC7: EVIDENCE_SCHEMA_CURRENT is 3; a new feature's first accepted write stamps evidence_schema: 3 and its envelopes cite Evidence schema: v3", async () => {
  assert.equal(EVIDENCE_SCHEMA_CURRENT, 3, "v3 = v2 plus the accepted-surface listing rule");
  const ws = mkWs("e452-ac7a-");
  setActiveStorage(new FileHandoffStorage());
  resetSession(ws);
  markStateRead(ws);
  const first = await upd(ws, { active_feature: "e452-fresh", status: "In_Progress", agent_id: "pm" });
  assert.ok(!rejected(first), `first write accepted: ${text(first)}`);
  assert.equal(parseHandoff(ws).evidence_schema, 3, "first accepted write stamps the current schema");

  // An envelope on a pin-3 feature names the version it ran under.
  const ws2 = mkWs("e452-ac7b-");
  await seed(ws2, F, "code-reviewer", "In_Progress", { evidenceSchema: 3 });
  put(ws2, `specs/${F}.md`, SPEC_WITH_PROOF(F));
  put(ws2, "qa_reports/review_T-1.md", "# QA review — T-1\n\nno AC log here\n");
  put(ws2, "review_reports/review_T-1.md", "x\n");
  const r = await upd(ws2, judgePass());
  assert.ok(rejected(r));
  assert.match(text(r), /AC_EXECUTION_LOG_MISSING/);
  assert.ok(text(r).includes("Evidence schema: v3"), `cites v3: ${text(r)}`);
});

test("AC7: pin 2 and an absent pin keep the v2 normalized-contains heading rule; pin 1 keeps the exact anchor", async () => {
  // Why: a pin records the rules a feature's evidence was written under; v3 adds a rule, it moves none.
  const run = async (pin) => {
    const ws = mkWs("e452-ac7c-");
    await seed(ws, F, "code-reviewer", "In_Progress", pin === undefined ? {} : { evidenceSchema: pin });
    put(ws, `specs/${F}.md`, SPEC_WITH_PROOF(F));
    put(ws, "qa_reports/review_T-1.md", "# QA review — T-1\n\n## Step 9 — AC Execution Log\n\nAC1: `node --test x` exit 0 pass\n");
    put(ws, "review_reports/review_T-1.md", "x\n");
    return upd(ws, judgePass());
  };
  for (const pin of [2, undefined, 3]) {
    const r = await run(pin);
    assert.ok(!rejected(r), `pin ${pin}: a prefixed AC Execution Log heading clears (normalized-contains): ${text(r)}`);
  }
  const r1 = await run(1);
  assert.ok(rejected(r1), "pin 1: the prefixed heading does not clear (exact anchor)");
  assert.match(text(r1), /AC_EXECUTION_LOG_MISSING/);
  assert.ok(text(r1).includes("Evidence schema: v1"), text(r1));
});

// ---------------------------------------------------------------- AC8

test("AC8: pin 3, an accepted surface with ## Allowed Differences reading None. (or empty) -> VISUAL_REPORT_INCOMPLETE naming settings.language with msg.allowed_differences_unlisted and hint.visual_report_incomplete", async () => {
  for (const allowed of ["None.", ""]) {
    const ws = await visualWs("e452-ac8-", { pin: 3, visual: visualReport({ allowed }) });
    const r = await upd(ws, judgePass());
    assert.ok(rejected(r), `allowed='${allowed}': an unlisted accepted surface must be refused: ${text(r)}`);
    assert.match(text(r), /^⛔ VISUAL_REPORT_INCOMPLETE: T-1 \(at /);
    assert.ok(text(r).includes(`{${UNLISTED(["settings.language"])}}`), `the T-1 listing carries the unlisted reason: ${text(r)}`);
    assert.ok(text(r).includes("Evidence schema: v3"), text(r));
    assert.ok(text(r).endsWith(HINT_VISUAL_REPORT_INCOMPLETE), `hint.visual_report_incomplete: ${text(r)}`);
    assert.equal(state(ws).status, "In_Progress", "no state written");
  }
});

// ---------------------------------------------------------------- AC9

test("AC9: pin 3, the accepted surface id anywhere in ## Allowed Differences (list item, table cell, prose) -> PASS accepted; two accepted surfaces, one listed -> rejected naming only the unlisted one", async () => {
  const listings = {
    "list item": "- settings.language — odiff 0.9% (threshold 0.5%) — sub-pixel anti-aliasing on row labels",
    "table cell": "| surface | metric | reason |\n|---|---|---|\n| settings.language | odiff 0.9% | anti-aliasing |",
    prose: "The Settings.Language surface differs only by sub-pixel anti-aliasing; accepted.",
  };
  for (const [shape, allowed] of Object.entries(listings)) {
    const ws = await visualWs("e452-ac9-", { pin: 3, visual: visualReport({ allowed }) });
    const r = await upd(ws, judgePass());
    assert.ok(!rejected(r), `${shape}: listed accepted surface clears (lenient substring): ${text(r)}`);
    assert.equal(state(ws).status, "PASS");
  }

  const ws = await visualWs("e452-ac9b-", {
    pin: 3,
    visual: visualReport({
      rows: [["settings.language", "accepted"], ["settings.region", "accepted"]],
      allowed: "- settings.language — anti-aliasing only",
    }),
  });
  const r = await upd(ws, judgePass());
  assert.ok(rejected(r), `settings.region is accepted but unlisted: ${text(r)}`);
  assert.match(text(r), /VISUAL_REPORT_INCOMPLETE/);
  assert.ok(text(r).includes(`{${UNLISTED(["settings.region"])}}`), `names only settings.region: ${text(r)}`);
  assert.ok(!text(r).includes(UNLISTED(["settings.language"])), "the listed surface is not named");
});

// ---------------------------------------------------------------- AC10

test("AC10: the AC8 report on a feature pinned 2, or with no pin, is accepted (older pins are not re-judged)", async () => {
  for (const pin of [2, undefined]) {
    const ws = await visualWs("e452-ac10-", { pin, visual: visualReport({ allowed: "None." }) });
    const r = await upd(ws, judgePass());
    assert.ok(!rejected(r), `pin ${pin}: the v3 listing rule does not apply: ${text(r)}`);
    assert.equal(state(ws).status, "PASS");
    assert.equal(parseHandoff(ws).evidence_schema, pin, "the pin is kept, not re-stamped");
  }
});
