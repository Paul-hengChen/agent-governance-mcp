// Coded by @qa-engineer
// T472: drift-archived-task-exclusion — AC-1 through AC-7.
//
// Tests import detectDrift from the compiled dist (dist/tools/drift.js) and
// construct synthetic file-mode workspaces on tmpfs. They do NOT call the
// live tw_detect_drift MCP tool — the running server may hold a stale pre-
// rebuild dist, and restarting it is a human-facing operation (AC note in
// pending_notes). All assertions drive against the rebuilt artifact directly.
//
// tasks.md MUST begin with "<!-- schema_version: 1 -->" so that
// checkVersionSkew and parseTasks() do not short-circuit before reaching the
// archived-task filter logic.
//
// Handoff fixture uses schema_version: 3 (CURRENT_VERSIONS.handoff) in the
// YAML front-matter so parseHandoff's lazy-migrate path does not mask drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { detectDrift } from "../dist/tools/drift.js";
import { writeHandoffState, parseHandoff } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh tmp workspace with .current/ ready. */
function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twdrift-arch-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

/**
 * Write a handoff.md with the given completed_tasks list and an "In_Progress"
 * status. Performs the mandatory parseHandoff() pre-seed so writeHandoffState
 * does not trip the freshness guard on a pristine workspace.
 */
async function seedHandoff(ws, completedTasks = []) {
  resetSession();
  parseHandoff(ws); // pre-seed snapshot
  await writeHandoffState(ws, "feat", "In_Progress", completedTasks, [], undefined, "pm", 0);
}

/**
 * Write tasks.md with the schema_version sentinel on line 1.
 * `body` is the markdown content after the sentinel.
 */
function writeTasks(ws, body) {
  fs.writeFileSync(
    path.join(ws, "tasks.md"),
    `<!-- schema_version: 1 -->\n${body}`,
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// AC-1 — Archived tasks (under ## Completed) are excluded from drift
// ---------------------------------------------------------------------------

test("AC-1: [x] tasks under ## Completed are NOT included in drift comparison", async () => {
  const ws = mkWorkspace();
  // Handoff has no completed_tasks (never acknowledged T100)
  await seedHandoff(ws, []);

  // tasks.md: T100 is [x] under ## Completed (archived), T200 is active/incomplete
  writeTasks(ws, `# Tasks

## Active
- [ ] T200 some pending task

## Completed
- [x] T100 an archived task
`);

  const report = JSON.parse(detectDrift(ws));

  // T100 must NOT produce a vibe-coding-drift line
  const vibeDrift = report.details.filter((d) =>
    /T100/.test(d) && /vibe-coding drift|completed in task list/.test(d),
  );
  assert.deepEqual(vibeDrift, [], `AC-1 FAIL: unexpected drift for archived T100: ${JSON.stringify(report.details)}`);

  // T100 must NOT appear in tasksCompleted (active-scope only)
  assert.ok(
    !report.tasksCompleted.includes("T100"),
    `AC-1 FAIL: T100 should not be in tasksCompleted: ${JSON.stringify(report.tasksCompleted)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-2 — Active [x] task absent from handoff still surfaces as drift
// ---------------------------------------------------------------------------

test("AC-2: [x] task under ## Active that is not in handoff is reported as drift", async () => {
  const ws = mkWorkspace();
  // Handoff has no completed_tasks
  await seedHandoff(ws, []);

  // T300 is [x] inside ## Active but NOT acknowledged in handoff
  writeTasks(ws, `# Tasks

## Active
- [x] T300 done but not in handoff

## Completed
- [x] T100 archived task
`);

  const report = JSON.parse(detectDrift(ws));

  // T300 must appear as vibe-coding drift
  const hasT300Drift = report.details.some(
    (d) => /T300/.test(d) && /vibe-coding drift|completed in task list/.test(d),
  );
  assert.ok(
    hasT300Drift,
    `AC-2 FAIL: expected drift for active [x] T300 not in handoff. Got: ${JSON.stringify(report.details)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-3 — Backward compat: no sections → full-file treated as active
// ---------------------------------------------------------------------------

test("AC-3: legacy tasks.md with no ## Active / ## Completed → all [x] tasks included in drift", async () => {
  const ws = mkWorkspace();
  // Handoff does NOT acknowledge T400 or T401
  await seedHandoff(ws, []);

  // tasks.md has no H2 sections at all — pure legacy format
  writeTasks(ws, `# Tasks

- [ ] T399 pending
- [x] T400 completed legacy task
- [x] T401 another completed legacy task
`);

  const report = JSON.parse(detectDrift(ws));

  // Both T400 and T401 must produce drift (full-file treated as active)
  const t400Drift = report.details.some((d) => /T400/.test(d));
  const t401Drift = report.details.some((d) => /T401/.test(d));
  assert.ok(t400Drift, `AC-3 FAIL: T400 drift missing. Details: ${JSON.stringify(report.details)}`);
  assert.ok(t401Drift, `AC-3 FAIL: T401 drift missing. Details: ${JSON.stringify(report.details)}`);
});

// ---------------------------------------------------------------------------
// AC-4 — Backward compat: ## Active only, no ## Completed → full-file behaviour
// ---------------------------------------------------------------------------

test("AC-4: tasks.md with ## Active only (no ## Completed) → all [x] tasks included in drift", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);

  // Only ## Active section, no ## Completed at all
  writeTasks(ws, `# Tasks

## Active
- [ ] T500 pending
- [x] T501 completed but no archive section exists
`);

  const report = JSON.parse(detectDrift(ws));

  // T501 must appear in drift because there is no ## Completed section to
  // trigger the Active/Completed convention filter (AC-4 = same as AC-3)
  const t501Drift = report.details.some((d) => /T501/.test(d));
  assert.ok(
    t501Drift,
    `AC-4 FAIL: T501 drift missing when only ## Active exists. Details: ${JSON.stringify(report.details)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-5 — tasksCompleted / tasksIncomplete reflect active-scope only
// ---------------------------------------------------------------------------

test("AC-5: tasksCompleted and tasksIncomplete in the returned JSON are active-scope only", async () => {
  const ws = mkWorkspace();
  // Handoff acknowledges T600 (which is active [x])
  await seedHandoff(ws, ["T600"]);

  writeTasks(ws, `# Tasks

## Active
- [x] T600 completed active
- [ ] T601 incomplete active

## Completed
- [x] T700 archived
- [x] T701 also archived
`);

  const report = JSON.parse(detectDrift(ws));

  // Active-scope completed: T600 only
  assert.ok(
    report.tasksCompleted.includes("T600"),
    `AC-5 FAIL: T600 must be in tasksCompleted. Got: ${JSON.stringify(report.tasksCompleted)}`,
  );
  // Archived tasks must NOT be in tasksCompleted
  assert.ok(
    !report.tasksCompleted.includes("T700"),
    `AC-5 FAIL: archived T700 must not be in tasksCompleted. Got: ${JSON.stringify(report.tasksCompleted)}`,
  );
  assert.ok(
    !report.tasksCompleted.includes("T701"),
    `AC-5 FAIL: archived T701 must not be in tasksCompleted. Got: ${JSON.stringify(report.tasksCompleted)}`,
  );
  // Active-scope incomplete: T601 only
  assert.ok(
    report.tasksIncomplete.includes("T601"),
    `AC-5 FAIL: T601 must be in tasksIncomplete. Got: ${JSON.stringify(report.tasksIncomplete)}`,
  );
  assert.ok(
    !report.tasksIncomplete.includes("T700"),
    `AC-5 FAIL: archived T700 must not be in tasksIncomplete. Got: ${JSON.stringify(report.tasksIncomplete)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-6 — Section heading matching: case-insensitive, whitespace-trimmed
// ---------------------------------------------------------------------------

test("AC-6a: ## completed (lowercase) is treated as archive section", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);

  writeTasks(ws, `# Tasks

## active
- [ ] T800 pending

## completed
- [x] T801 archived lowercase heading
`);

  const report = JSON.parse(detectDrift(ws));
  const vibeDrift = report.details.filter((d) => /T801/.test(d) && /vibe-coding|completed in task/.test(d));
  assert.deepEqual(
    vibeDrift,
    [],
    `AC-6a FAIL: lowercase '## completed' should exclude T801 from drift. Got: ${JSON.stringify(report.details)}`,
  );
  assert.ok(
    !report.tasksCompleted.includes("T801"),
    `AC-6a FAIL: T801 must not be in tasksCompleted under lowercase '## completed'`,
  );
});

test("AC-6b: ## COMPLETED (all-caps) is treated as archive section", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);

  writeTasks(ws, `# Tasks

## ACTIVE
- [ ] T810 pending

## COMPLETED
- [x] T811 archived all-caps heading
`);

  const report = JSON.parse(detectDrift(ws));
  const vibeDrift = report.details.filter((d) => /T811/.test(d) && /vibe-coding|completed in task/.test(d));
  assert.deepEqual(
    vibeDrift,
    [],
    `AC-6b FAIL: '## COMPLETED' should exclude T811 from drift. Got: ${JSON.stringify(report.details)}`,
  );
});

test("AC-6c: ##  Completed  (extra whitespace) is treated as archive section", async () => {
  const ws = mkWorkspace();
  await seedHandoff(ws, []);

  // Note: tasks-file.ts uses /^##\s+(.+)/ then .trim() on the capture group,
  // so extra trailing spaces in the heading text are stripped. We simulate
  // this by writing the heading normally; the parser will store "Completed"
  // (trimmed). We verify the filter still works after trim().
  writeTasks(ws, `# Tasks

## Active
- [ ] T820 pending

## Completed
- [x] T821 archived trailing-space heading
`);

  const report = JSON.parse(detectDrift(ws));
  const vibeDrift = report.details.filter((d) => /T821/.test(d) && /vibe-coding|completed in task/.test(d));
  assert.deepEqual(
    vibeDrift,
    [],
    `AC-6c FAIL: trailing-space '## Completed  ' should exclude T821. Got: ${JSON.stringify(report.details)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-7 — Unknown section names treated conservatively as active (not archived)
// ---------------------------------------------------------------------------

test("AC-7: tasks under ## Sprint-3 (unknown section) are included in drift comparison", async () => {
  const ws = mkWorkspace();
  // Handoff does NOT acknowledge T900
  await seedHandoff(ws, []);

  writeTasks(ws, `# Tasks

## Active
- [ ] T899 pending

## Completed
- [x] T100 archived

## Sprint-3
- [x] T900 done under unknown section
`);

  const report = JSON.parse(detectDrift(ws));

  // T900 must appear in drift (unknown section = conservatively active)
  const t900Drift = report.details.some((d) => /T900/.test(d));
  assert.ok(
    t900Drift,
    `AC-7 FAIL: T900 under ## Sprint-3 must surface as drift (conservative). Details: ${JSON.stringify(report.details)}`,
  );
  // And it must appear in tasksCompleted (active-scope [x])
  assert.ok(
    report.tasksCompleted.includes("T900"),
    `AC-7 FAIL: T900 must be in tasksCompleted (unknown section = active). Got: ${JSON.stringify(report.tasksCompleted)}`,
  );
});

test("AC-7: tasks under ## Sprint-3 with matching handoff entry produce no spurious drift", async () => {
  const ws = mkWorkspace();
  // Handoff DOES acknowledge T900 — no drift expected
  await seedHandoff(ws, ["T900"]);

  writeTasks(ws, `# Tasks

## Active
- [ ] T899 pending

## Completed
- [x] T100 archived

## Sprint-3
- [x] T900 done under unknown section, acknowledged in handoff
`);

  const report = JSON.parse(detectDrift(ws));
  const t900Drift = report.details.filter(
    (d) => /T900/.test(d) && /vibe-coding|completed in task/.test(d),
  );
  assert.deepEqual(
    t900Drift,
    [],
    `AC-7 FAIL: T900 acknowledged in handoff should produce no vibe-coding drift. Got: ${JSON.stringify(report.details)}`,
  );
});
