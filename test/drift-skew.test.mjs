// Coded by @qa-engineer
// T32: drift.ts extension — version-skew drift reason (AC-6).
// detectDrift runs the skew check BEFORE the storage parsers so a future
// on-disk version is reported as a first-class drift reason, not masked
// behind the parser's refuse-loud throw.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { detectDrift } from "../dist/tools/drift.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twdriftver-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

async function seedHandoffAndTasks(ws) {
  resetSession();
  parseHandoff(ws);
  await writeHandoffState(ws, "feat", "In_Progress", [], [], undefined, "pm", 0);
  fs.writeFileSync(path.join(ws, "tasks.md"), "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n");
}

function writeRawHandoff(ws, body) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body);
}

// ---------- No skew when all artifacts are at CURRENT ----------

test("T32: no version-skew drift when handoff/tasks/config are at CURRENT", async () => {
  const ws = mkWorkspace();
  await seedHandoffAndTasks(ws);
  fs.writeFileSync(
    path.join(ws, ".current", ".config.json"),
    JSON.stringify({ schema_version: 1, taskPaths: ["tasks.md"] }),
  );

  const report = JSON.parse(detectDrift(ws));
  const skewReasons = report.details.filter((d) => /Schema version skew/.test(d));
  assert.deepEqual(skewReasons, [], "no skew at CURRENT");
});

// ---------- Skew reported when handoff on-disk version > CURRENT ----------

test("T32 AC-6: future handoff schema_version surfaces as a drift reason (not a thrown error)", async () => {
  const ws = mkWorkspace();
  await seedHandoffAndTasks(ws);
  writeRawHandoff(
    ws,
    `---
schema_version: 99
active_feature: "from-future"
status: "In_Progress"
last_updated: "2099-01-01T00:00:00.000Z"
qa_round: 0
---
# Handoff
## ✅ 已完成 (Completed)
- 無
## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  assert.ok(
    report.details.some((d) => /Schema version skew: handoff on-disk v99 > server max v13/.test(d)),
    `expected handoff skew reason in ${JSON.stringify(report.details)}`,
  );
});

// ---------- Skew reported when tasks on-disk version > CURRENT ----------

test("T32 AC-6: future tasks sentinel surfaces as drift reason", async () => {
  const ws = mkWorkspace();
  await seedHandoffAndTasks(ws);
  fs.writeFileSync(
    path.join(ws, "tasks.md"),
    "<!-- schema_version: 77 -->\n# Tasks\n\n## Active\n- [ ] T01 future task\n",
  );

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  assert.ok(
    report.details.some((d) => /Schema version skew: tasks on-disk v77 > server max v1/.test(d)),
    `expected tasks skew reason in ${JSON.stringify(report.details)}`,
  );
});

// ---------- Future config surfaces ----------

test("T32 AC-6: future config schema_version surfaces as drift reason", async () => {
  const ws = mkWorkspace();
  await seedHandoffAndTasks(ws);
  fs.writeFileSync(
    path.join(ws, ".current", ".config.json"),
    JSON.stringify({ schema_version: 88, taskPaths: ["tasks.md"] }),
  );

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.driftDetected, true);
  assert.ok(
    report.details.some((d) => /Schema version skew: config on-disk v88 > server max v1/.test(d)),
    `expected config skew reason in ${JSON.stringify(report.details)}`,
  );
});

// ---------- Stale artifacts heal silently — no drift reason ----------

test("T32: stale handoff is healed by lazy-migrate; no version-skew drift reported", async () => {
  const ws = mkWorkspace();
  writeRawHandoff(
    ws,
    `---
active_feature: "legacy"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
qa_round: 0
---
## ✅ 已完成 (Completed)
- 無
## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );
  fs.writeFileSync(path.join(ws, "tasks.md"), "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n");

  const report = JSON.parse(detectDrift(ws));
  const skewReasons = report.details.filter((d) => /Schema version skew/.test(d));
  assert.deepEqual(skewReasons, [], "stale v0 must not be reported as skew");
});

// ---------- Empty workspace: no skew claims fabricated ----------

test("T32: empty workspace yields no version-skew rows", () => {
  const ws = mkWorkspace();
  const report = JSON.parse(detectDrift(ws));
  const skewReasons = report.details.filter((d) => /Schema version skew/.test(d));
  assert.deepEqual(skewReasons, []);
});

// ---------- Early-return: skew shortcuts the rest of drift detection ----------

test("T32: skew detection short-circuits parser-based drift reasons", async () => {
  const ws = mkWorkspace();
  // Seed a future handoff + a tasks.md with a completed task. Without the
  // early-return, parseHandoff would throw before completed-task drift
  // analysis. With early-return, we get only the skew reason — no
  // half-populated drift report.
  writeRawHandoff(
    ws,
    `---
schema_version: 50
active_feature: "from-future"
status: "PASS"
last_updated: "2099-01-01T00:00:00.000Z"
qa_round: 0
---
## ✅ 已完成 (Completed)
- [x] T99
## ⚠️ 待辦與交接 (Pending & Handoff Notes)
- 無
`,
  );
  fs.writeFileSync(
    path.join(ws, "tasks.md"),
    "<!-- schema_version: 1 -->\n# Tasks\n\n## Active\n- [ ] T01 incomplete\n",
  );

  const report = JSON.parse(detectDrift(ws));
  assert.equal(report.details.length, 1, `expected only the skew reason, got ${JSON.stringify(report.details)}`);
  assert.match(report.details[0], /Schema version skew: handoff on-disk v50/);
});
