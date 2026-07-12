// Coded by @qa-engineer
// Tests for specs/e3-outcome-shaped-acceptance.md (AC1-AC8) +
// specs/e3-outcome-shaped-acceptance-architecture.md Test Specification §1.
// gates/ac-execution.ts is the fourth member of the evidence-existence gate
// family (MISSING_EVIDENCE / VISUAL_EVIDENCE_MISSING / EXPECTED_RED_DIFF_MISSING):
// PM annotates provable ACs with a `proof:` line; qa-engineer executes each
// declared proof at Phase 3.5 and records the run under a `## AC Execution Log`
// H2 in qa_reports/review_<id>.md; the server checks EXISTENCE of that section
// only (never runs the proofs, never parses their output).
//
// PLACEMENT NOTE (deviation from architecture "Affected Files" / Test
// Specification, which name this file `test/gates/ac-execution.test.mjs`):
// `npm test` runs `node --test test/*.test.mjs` (package.json), a
// NON-RECURSIVE shell glob — a file under a `test/gates/` subdirectory is
// silently never collected (verified empirically: a probe file placed at
// test/gates/_probe.test.mjs does not appear in the shell's glob expansion
// and its test never runs). The architecture's own citation of a "mirror
// test/gates/gates-expected-red.test.mjs" precedent is itself inaccurate —
// that file lives flat at test/gates-expected-red.test.mjs, not nested. Every
// existing *-gate test file in this repo is flat under test/ for exactly this
// reason. Filing this suite at the nested path the architecture names would
// ship a test that never executes under CI — a test-infra defect squarely in
// QA's Phase 3 authority to fix (skill-qa-engineer "Scope"). This file is
// placed at the flat, actually-collected path instead; see qa_reports/
// review_T-E3-QA.md for the disposition write-up.
//
// Spec-to-Test map:
//   AC1 (proof: schema, self-check)        -> verified via grep at T-E3-QA (AC Execution Log), not re-tested here
//   AC2 (proof: conditional, "where feasible") -> skill-content assertion below
//   AC3 (Phase 3.5 heading, exact)          -> skill-content assertion below
//   AC4 (arm check: hasProofAnnotatedAC)    -> U1-U6
//   AC4 (disposition check: hasAcExecutionLogDisposition) -> U7-U14
//   AC4 (PASS gate composition: AC_EXECUTION_LOG_MISSING) -> I1-I3b
//   AC4 (`covers:` batch coverage)          -> U10, U11 (unit-level only; see NOTE above the removed integration "I4" attempt)
//   AC5 (unarmed / no-spec-file dormant)    -> U3, U4, I3, I3b
//   AC5 (file-mode only)                    -> I5
//   AC6 (Phase 4 FAIL cross-reference, no new escalation row) -> skill-content assertion below

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  hasProofAnnotatedAC,
  hasAcExecutionLogDisposition,
  specFilePath,
} from "../dist/gates/ac-execution.js";
import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";

function mkWorkspace(prefix = "ace-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeSpec(ws, feature, body) {
  const dir = path.join(ws, "specs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(specFilePath(ws, feature), body, "utf-8");
}

function writeReview(ws, taskId, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${taskId}.md`), body, "utf-8");
}

const ARMED_SPEC = [
  "# feat",
  "",
  "## Acceptance Criteria",
  "- **AC1** — Given the CLI is installed, when `mycli --version` runs, then it prints the version.",
  "  proof: `mycli --version` prints the package.json version.",
  "",
].join("\n");

// ============================================================================
// U1-U6 — hasProofAnnotatedAC (arm check)
// ============================================================================

test("U1: no spec file -> armed:false (gate dormant, zero-cost)", () => {
  const ws = mkWorkspace();
  const r = hasProofAnnotatedAC(ws, "feat-x");
  assert.equal(r.armed, false, "absent spec file -> gate never arms");
  assert.ok(r.specPath.endsWith(path.join("specs", "feat-x.md")));
});

test("U2: spec file present with a line-leading `proof:` AC -> armed:true", () => {
  const ws = mkWorkspace();
  writeSpec(ws, "feat-x", ARMED_SPEC);
  const r = hasProofAnnotatedAC(ws, "feat-x");
  assert.equal(r.armed, true, "spec declares >=1 proof: AC -> gate arms");
});

test("U3: spec file present with ZERO proof: lines -> armed:false (AC5, unarmed dormant)", () => {
  const ws = mkWorkspace();
  writeSpec(
    ws,
    "feat-unarmed",
    "# feat\n\n## Acceptance Criteria\n- **AC1** — Given X, when Y, then Z (subjective, no proof).\n",
  );
  const r = hasProofAnnotatedAC(ws, "feat-unarmed");
  assert.equal(r.armed, false, "spec with zero proof: lines must not arm the gate");
});

test("U4: empty active_feature collapses to dormant gate (defensive, mirrors expected-red/visual gates)", () => {
  const ws = mkWorkspace();
  const r = hasProofAnnotatedAC(ws, "");
  assert.equal(r.armed, false, "empty feature name must not arm the gate");
});

test("U5: active_feature with path-unsafe characters is sanitised (slashes collapsed, no traversal)", () => {
  const ws = mkWorkspace();
  const r = hasProofAnnotatedAC(ws, "evil/feature/name");
  assert.ok(r.specPath.includes(path.join(ws, "specs")), "specPath must remain inside workspace/specs/");
  assert.ok(!r.specPath.includes("/evil/"), "slashes in feature name must be sanitised");
});

test("U6: `..` runs in active_feature collapse to `_` (v3.14.1-style hardening, same as gates/expected-red.ts)", () => {
  const ws = mkWorkspace();
  const r = hasProofAnnotatedAC(ws, "..feat");
  assert.ok(!r.specPath.includes(".."), "leading `..` MUST be collapsed");
  assert.ok(r.specPath.endsWith("_feat.md"));
});

// ---------------------------------------------------------------------------
// Arm-regex precision (architecture Test Specification §1, explicit case):
// mid-line / backtick "proof:" prose must NEVER false-arm; only a line whose
// FIRST non-whitespace token is `proof:` may arm.
// ---------------------------------------------------------------------------

test("arm-regex precision: mid-line prose mentioning 'proof:' does NOT arm", () => {
  const ws = mkWorkspace();
  writeSpec(
    ws,
    "feat-prose",
    "# feat\n\n## Acceptance Criteria\n- **AC1** — the AC line carries a `proof:` annotation naming the exact command.\n",
  );
  const r = hasProofAnnotatedAC(ws, "feat-prose");
  assert.equal(r.armed, false, "mid-line 'proof:' occurring after other text must not arm the gate");
});

test("arm-regex precision: backtick-quoted `proof: pixel-diff <region>` prose does NOT arm", () => {
  const ws = mkWorkspace();
  writeSpec(
    ws,
    "feat-backtick",
    "# feat\n\n## Out of Scope\n- An AC MAY name `proof: pixel-diff <region>` as its proof category.\n",
  );
  const r = hasProofAnnotatedAC(ws, "feat-backtick");
  assert.equal(r.armed, false, "backtick-fenced 'proof:' prose must not arm the gate");
});

test("arm-regex precision: line-leading `  proof:` (indented under an AC bullet) DOES arm", () => {
  const ws = mkWorkspace();
  writeSpec(ws, "feat-indented", ARMED_SPEC);
  const r = hasProofAnnotatedAC(ws, "feat-indented");
  assert.equal(r.armed, true, "an indented line whose first non-whitespace token is 'proof:' must arm");
});

// ============================================================================
// U7-U14 — hasAcExecutionLogDisposition (disposition check: direct file,
// covers: fallback, never-throws) — mirrors gates/expected-red.ts U6-U13.
// ============================================================================

test("U7: no review files at all -> present:false", () => {
  const ws = mkWorkspace();
  const r = hasAcExecutionLogDisposition(ws, ["T01"]);
  assert.equal(r.present, false);
});

test("U8: direct review_<id>.md exists but has no ## AC Execution Log H2 -> present:false", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", "# Review\n\n## Summary\nlooks fine\n");
  const r = hasAcExecutionLogDisposition(ws, ["T01"]);
  assert.equal(r.present, false, "review file without the H2 section must not satisfy the gate");
});

test("U9: direct review_<id>.md contains ## AC Execution Log H2 -> present:true", () => {
  const ws = mkWorkspace();
  writeReview(
    ws,
    "T01",
    "# Review\n\n## AC Execution Log\nAC1: `mycli --version` -> printed 1.2.3, exit=0. PASS.\n",
  );
  const r = hasAcExecutionLogDisposition(ws, ["T01"]);
  assert.equal(r.present, true, "direct file carrying the H2 must satisfy the gate");
});

test("U10: direct file for the id is MISSING, but a covers: file satisfies it (fallback on miss)", () => {
  const ws = mkWorkspace();
  writeReview(
    ws,
    "T01",
    "covers: T01, T02\n\n## AC Execution Log\nAC1 executed, PASS.\n",
  );
  const r = hasAcExecutionLogDisposition(ws, ["T02"]);
  assert.equal(r.present, true, "covers: fallback must find the H2 in the covering file");
});

test("U11: 'at least one across all ids' — first id's direct file lacks the H2, second id's covering file has it", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", "# Review\n\nno disposition section here\n");
  writeReview(ws, "T02", "covers: T02, T03\n\n## AC Execution Log\ndispositioned\n");
  const r = hasAcExecutionLogDisposition(ws, ["T01", "T03"]);
  assert.equal(r.present, true, "ANY PASS'd id resolving to a file with the H2 satisfies the gate");
});

test("U12: direct file exists WITH the H2 — direct-hit takes precedence, no fallback attempted", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", "## AC Execution Log\ndispositioned directly\n");
  const r = hasAcExecutionLogDisposition(ws, ["T01"]);
  assert.equal(r.present, true);
});

test("U13: never throws on unreadable/malformed content (bad encoding) — fail-closed, not fail-loud", () => {
  const ws = mkWorkspace();
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "review_T01.md"), Buffer.from([0xff, 0xfe, 0xfd, 0x00]));
  let threw = false;
  let r;
  try {
    r = hasAcExecutionLogDisposition(ws, ["T01"]);
  } catch {
    threw = true;
  }
  assert.equal(threw, false, "MUST NOT throw on bad-encoding read");
  assert.ok(r, "must return a result object even on read failure");
});

test("U14: empty task id list -> present:false (no ids to satisfy the gate)", () => {
  const ws = mkWorkspace();
  const r = hasAcExecutionLogDisposition(ws, []);
  assert.equal(r.present, false);
});

// ============================================================================
// I1-I4 — Integration: handleUpdateState composition (AC_EXECUTION_LOG_MISSING)
//
// Drives the REAL tw_update_state orchestrator, matching the
// test/gates-expected-red.test.mjs I1-I4 convention. qa_review text is passed
// on the PASS write; the server's recordReview step appends it verbatim into
// qa_reports/review_<id>.md, so a qa_review string containing
// "## AC Execution Log" becomes the on-disk disposition section.
// ============================================================================

async function seedQaInProgress(ws, feature) {
  resetSession(ws);
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: feature,
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["QA: claiming review"],
    lastAgent: "qa-engineer",
  });
}

test("I1: PASS rejected with AC_EXECUTION_LOG_MISSING when spec armed + qa_review carries no AC Execution Log section", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "e3-int-blocked";
  writeSpec(ws, feature, ARMED_SPEC);
  await seedQaInProgress(ws, feature);

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01"],
    pending_notes: ["QA: T01 PASS"],
    qa_review: "Looks good, no AC execution log written.",
  });
  const text = result.content[0].text;
  assert.ok(result.isError, `PASS must be rejected when the spec is armed with no AC Execution Log section; got: ${text}`);
  assert.ok(text.includes("AC_EXECUTION_LOG_MISSING"), `expected AC_EXECUTION_LOG_MISSING; got: ${text}`);
});

test("I2: PASS succeeds once qa_review carries a ## AC Execution Log section (spec armed)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "e3-int-unblocked";
  writeSpec(ws, feature, ARMED_SPEC);
  await seedQaInProgress(ws, feature);

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01"],
    pending_notes: ["QA: T01 PASS"],
    qa_review:
      "## AC Execution Log\nAC1: `mycli --version` -> printed 1.2.3, exit=0. PASS.\n",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `PASS must succeed once the AC Execution Log section is recorded; got: ${text}`);
  assert.ok(!text.includes("AC_EXECUTION_LOG_MISSING"), "gate must not fire once satisfied");
});

test("I3: PASS succeeds with zero overhead when the spec has zero proof: lines (AC5, unarmed)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "e3-int-unarmed";
  writeSpec(
    ws,
    feature,
    "# feat\n\n## Acceptance Criteria\n- **AC1** — subjective judgment call, no proof: line.\n",
  );
  await seedQaInProgress(ws, feature);

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01"],
    pending_notes: ["QA: T01 PASS"],
    qa_review: "Looks good, no AC execution log, spec has no proof: lines.",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `PASS must succeed when the spec declares zero proof: ACs; got: ${text}`);
  assert.ok(!text.includes("AC_EXECUTION_LOG_MISSING"), "gate must never fire when never armed");
});

test("I3b: PASS succeeds with zero overhead when no spec file exists at all (AC5, no-spec-file dormant)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "e3-int-no-spec";
  // Intentionally NO specs/<feature>.md written.
  await seedQaInProgress(ws, feature);

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01"],
    pending_notes: ["QA: T01 PASS"],
    qa_review: "Looks good, no spec file ever existed for this feature.",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `PASS must succeed when no spec file exists; got: ${text}`);
  assert.ok(!text.includes("AC_EXECUTION_LOG_MISSING"), "gate must never fire when the spec is absent");
});

// NOTE: no integration-level "I4" covers: test — recordReviewInFile
// (gates/qa-review.ts) unconditionally creates/appends review_<id>.md for
// EVERY id in completed_tasks on a qa_review-bearing write (the auto-record
// step that runs before the gate check), so a PASS'd id always has a direct
// file by the time hasAcExecutionLogDisposition runs, making the covers:
// fallback path unreachable at this integration layer for the id actually
// being PASS'd — confirmed empirically (an attempted integration test here
// hit AC_EXECUTION_LOG_MISSING because auto-record's direct-but-H2-less file
// for the target id takes precedence over another id's covers: file, exactly
// per the "direct-hit takes precedence" contract U12 already pins). This is
// the same shape as test/gates-expected-red.test.mjs's own I4, which tests
// "at least one of two directly-PASS'd ids has the H2" rather than the
// covers: routing itself. The covers: mechanism is fully exercised at the
// unit level above (U10, U11) against hasAcExecutionLogDisposition directly.

// ============================================================================
// I5 — AC5: file-mode-only guard (SQLite-mode skip)
//
// Mirrors the established convention (test/gates-expected-red.test.mjs I5/I5b):
// the gate is wrapped in `storage instanceof FileHandoffStorage` at the
// orchestrator call site.
// ============================================================================

test("I5: gate is wrapped in instanceof FileHandoffStorage — a non-file storage fails the check (SQLite-mode skip, AC5)", () => {
  const fakeNonFileStorage = { parse() { return null; }, writeState() {} };
  assert.equal(
    fakeNonFileStorage instanceof FileHandoffStorage,
    false,
    "a plain object must not satisfy instanceof FileHandoffStorage (SQLite-skip predicate fails as expected)",
  );
  const fileStorage = new FileHandoffStorage();
  assert.equal(
    fileStorage instanceof FileHandoffStorage,
    true,
    "FileHandoffStorage instance must satisfy instanceof check (gate arms in file mode)",
  );
});

test("I5b: source pins the guard — the hasProofAnnotatedAC call site is FileHandoffStorage-guarded", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const src = fs.readFileSync(path.join(root, "tools", "handoff-orchestrator.ts"), "utf-8");

  const callIdx = src.indexOf("hasProofAnnotatedAC(parsed.workspace_path");
  assert.ok(callIdx !== -1, "hasProofAnnotatedAC call site must exist");
  const guardIdx = src.lastIndexOf("if (storage instanceof FileHandoffStorage)", callIdx);
  assert.ok(guardIdx !== -1, "call site must be wrapped in a FileHandoffStorage guard");
  const between = src.slice(guardIdx, callIdx);
  assert.ok(!between.includes("\n        }\n"), "guard must directly wrap the AC-execution gate call (no intervening block close)");
});

// ============================================================================
// Skill-content assertions (architecture Test Specification §2, spec AC2/AC3/AC6)
// ============================================================================

test("AC3: skill-qa-engineer.md contains the exact new phase heading verbatim", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const body = fs.readFileSync(path.join(root, "content", "skill-qa-engineer.md"), "utf-8");
  assert.ok(
    body.includes("**Phase 3.5 — AC Execution**"),
    "skill-qa-engineer.md must contain the literal heading '**Phase 3.5 — AC Execution**' (AC3, test-asserted verbatim)",
  );
});

test("AC3/AC4: skill-qa-engineer.md contains the ## AC Execution Log H2 token (the disposition heading the gate keys on)", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const body = fs.readFileSync(path.join(root, "content", "skill-qa-engineer.md"), "utf-8");
  assert.ok(
    body.includes("## AC Execution Log"),
    "skill-qa-engineer.md must document the exact '## AC Execution Log' H2 token, matching gates/ac-execution.ts's DISPOSITION_HEADING",
  );
});

test("AC6: new Phase 3.5 references the existing Phase 4 FAIL escalation route and introduces NO new escalation-table row", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const body = fs.readFileSync(path.join(root, "content", "skill-qa-engineer.md"), "utf-8");
  assert.match(
    body,
    /Phase 3\.5[\s\S]*?Phase 4 FAIL/,
    "Phase 3.5 text must cross-reference the existing 'Phase 4 FAIL' escalation route",
  );
  // Escalation Routes table row count unchanged: exactly one row per situation
  // documented today (pipe-delimited markdown table rows under "## Escalation
  // Routes"), no new row added for AC-execution failures.
  const tableStart = body.indexOf("## Escalation Routes");
  assert.ok(tableStart > 0, "## Escalation Routes section must exist");
  const tableBody = body.slice(tableStart);
  const rows = tableBody.split("\n").filter((l) => l.startsWith("|") && !l.includes("---") && !l.includes("situation"));
  assert.equal(
    rows.length,
    6,
    `Escalation Routes table must stay at 6 data rows (AC6: no new row added for AC-execution failures), got ${rows.length}:\n${rows.join("\n")}`,
  );
});

test("AC2: skill-pm.md's proof: annotation guidance states the convention is conditional ('where feasible'), not mandatory", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const body = fs.readFileSync(path.join(root, "content", "skill-pm.md"), "utf-8");
  assert.ok(
    body.includes("where feasible"),
    "skill-pm.md must state the proof: convention is conditional ('where feasible' literal), per AC2 (a genuinely subjective AC MAY omit proof:)",
  );
  assert.ok(
    body.includes("proof:"),
    "skill-pm.md must document the proof: annotation token itself",
  );
});
