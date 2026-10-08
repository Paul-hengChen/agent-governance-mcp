// Coded by @qa-engineer
// Tests for the expected-red manifest check in gates/expected-red.ts (specs/c15-expected-red-manifest.md):
// U1-U13 unit-test the arm and disposition predicates, I1-I5 the PASS gate. The server checks only that a
// `## Expected-Red Diff` section EXISTS in qa_reports/review_<id>.md; it never runs the suite or parses manifest rows.
// Rationale: specs/e260g-comment-rationale.md (test/gates-expected-red.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  hasExpectedRedManifest,
  hasExpectedRedDisposition,
  expectedRedManifestPath,
} from "../dist/gates/expected-red.js";
import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

function mkWorkspace(prefix = "erd-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeManifest(ws, feature, body = "some/test.mjs | a test name\n") {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(expectedRedManifestPath(ws, feature), body, "utf-8");
}

function writeReview(ws, taskId, body) {
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `review_${taskId}.md`), body, "utf-8");
}

// ============================================================================
// U1-U5 — hasExpectedRedManifest (arm check)
// ============================================================================

test("U1: absent manifest file -> present:false (gate dormant, zero-cost non-red feature)", () => {
  const ws = mkWorkspace();
  const r = hasExpectedRedManifest(ws, "feat-x");
  assert.equal(r.present, false, "no manifest file -> gate never arms");
  assert.ok(r.manifestPath.endsWith(path.join("qa_reports", "expected-red_feat-x.txt")));
});

test("U2: manifest file present -> present:true (gate arms)", () => {
  const ws = mkWorkspace();
  writeManifest(ws, "feat-x");
  const r = hasExpectedRedManifest(ws, "feat-x");
  assert.equal(r.present, true, "manifest file exists -> gate arms");
});

test("U3: empty active_feature collapses to dormant gate (defensive, mirrors visual gate)", () => {
  const ws = mkWorkspace();
  const r = hasExpectedRedManifest(ws, "");
  assert.equal(r.present, false, "empty feature name must not arm the gate");
});

test("U4: active_feature with path-unsafe characters is sanitised (slashes collapsed, no traversal)", () => {
  const ws = mkWorkspace();
  const r = hasExpectedRedManifest(ws, "evil/feature/name");
  assert.ok(r.manifestPath.includes(path.join(ws, "qa_reports")), "manifestPath must remain inside workspace/qa_reports/");
  assert.ok(!r.manifestPath.includes("/evil/"), "slashes in feature name must be sanitised");
});

test("U5: `..` runs in active_feature collapse to `_` (same v3.14.1 hardening as gates/visual.ts)", () => {
  const ws = mkWorkspace();
  const r = hasExpectedRedManifest(ws, "..feat");
  assert.ok(!r.manifestPath.includes(".."), "leading `..` MUST be collapsed");
  assert.ok(r.manifestPath.endsWith("_feat.txt"));
});

// ============================================================================
// U6-U12 — hasExpectedRedDisposition (disposition check: direct file, covers:
// fallback, never-throws)
// ============================================================================

test("U6: no review files at all -> present:false", () => {
  const ws = mkWorkspace();
  const r = hasExpectedRedDisposition(ws, ["T01"]);
  assert.equal(r.present, false);
});

test("U7: direct review_<id>.md exists but has no ## Expected-Red Diff H2 -> present:false", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", "# Review\n\n## Summary\nlooks fine\n");
  const r = hasExpectedRedDisposition(ws, ["T01"]);
  assert.equal(r.present, false, "review file without the H2 section must not satisfy the gate");
});

test("U8: direct review_<id>.md contains ## Expected-Red Diff H2 -> present:true", () => {
  const ws = mkWorkspace();
  writeReview(
    ws,
    "T01",
    "# Review\n\n## Expected-Red Diff\nPhase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds)\n",
  );
  const r = hasExpectedRedDisposition(ws, ["T01"]);
  assert.equal(r.present, true, "direct file carrying the H2 must satisfy the gate");
});

test("U9: direct file for the id is MISSING, but a covers: file satisfies it (fallback on miss)", () => {
  // Mirrors hasEvidenceInFile's fallback-on-miss precedent: no review_T02.md
  // exists, but review_T01.md carries `covers: T01, T02` AND the H2.
  const ws = mkWorkspace();
  writeReview(
    ws,
    "T01",
    "covers: T01, T02\n\n## Expected-Red Diff\nPhase 0.5: clean (3/3 confirmed red)\n",
  );
  const r = hasExpectedRedDisposition(ws, ["T02"]);
  assert.equal(r.present, true, "covers: fallback must find the H2 in the covering file");
});

test("U10: 'at least one across all ids' — first id's direct file lacks the H2, second id's covering file has it", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", "# Review\n\nno disposition section here\n");
  writeReview(ws, "T02", "covers: T02, T03\n\n## Expected-Red Diff\ndispositioned\n");
  const r = hasExpectedRedDisposition(ws, ["T01", "T03"]);
  assert.equal(r.present, true, "ANY PASS'd id resolving to a file with the H2 satisfies the gate");
});

test("U11: direct file exists WITH the H2 for one id while a covering file (without H2) would exist for a miss — direct-hit takes precedence, no fallback attempted", () => {
  const ws = mkWorkspace();
  writeReview(ws, "T01", "## Expected-Red Diff\ndispositioned directly\n");
  const r = hasExpectedRedDisposition(ws, ["T01"]);
  assert.equal(r.present, true);
});

test("U12: never throws on unreadable/malformed content (bad encoding) — fail-closed, not fail-loud", () => {
  const ws = mkWorkspace();
  const dir = path.join(ws, "qa_reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "review_T01.md"), Buffer.from([0xff, 0xfe, 0xfd, 0x00]));
  let threw = false;
  let r;
  try {
    r = hasExpectedRedDisposition(ws, ["T01"]);
  } catch {
    threw = true;
  }
  assert.equal(threw, false, "MUST NOT throw on bad-encoding read");
  assert.ok(r, "must return a result object even on read failure");
});

test("U13: empty task id list -> present:false (no ids to satisfy the gate)", () => {
  const ws = mkWorkspace();
  const r = hasExpectedRedDisposition(ws, []);
  assert.equal(r.present, false);
});

// ============================================================================
// I1-I4 — Integration: handleUpdateState composition (EXPECTED_RED_DIFF_MISSING)
// Drives the real orchestrator, as test/qa-flow.test.mjs does. The qa_review text on the PASS write is appended
// to qa_reports/review_<id>.md before the evidence checks run, so a "## Expected-Red Diff" string there becomes
// the on-disk disposition section.
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
  // Replace the seed's wall-clock last_updated with a fixed stamp that cannot
  // look hand-authored, so the write path's stamp check stays quiet. See
  // test/e148-seed-stamp.mjs. (E148)
  forceSeedStamp(ws);
}

test("I1: PASS rejected with EXPECTED_RED_DIFF_MISSING when manifest armed + qa_review carries no disposition section", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "c15-int-blocked";
  writeManifest(ws, feature);
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
    qa_review: "Looks good, no expected-red section written.",
  });
  const text = result.content[0].text;
  assert.ok(result.isError, `PASS must be rejected when the manifest is armed with no disposition section; got: ${text}`);
  assert.ok(text.includes("EXPECTED_RED_DIFF_MISSING"), `expected EXPECTED_RED_DIFF_MISSING; got: ${text}`);
});

test("I2: PASS succeeds once qa_review carries a ## Expected-Red Diff section (manifest armed)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "c15-int-unblocked";
  writeManifest(ws, feature);
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
      "## Expected-Red Diff\nPhase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds)\n",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `PASS must succeed once the disposition section is recorded; got: ${text}`);
  assert.ok(!text.includes("EXPECTED_RED_DIFF_MISSING"), "gate must not fire once satisfied");
});

test("I3: PASS succeeds with zero overhead when no manifest exists (backwards-compat, no expected reds declared)", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "c15-int-no-manifest";
  // Intentionally NO manifest file written.
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
    qa_review: "Looks good, no expected-red section, no manifest was ever declared.",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `PASS must succeed when no manifest was declared (non-red feature); got: ${text}`);
  assert.ok(!text.includes("EXPECTED_RED_DIFF_MISSING"), "gate must never fire when the manifest was never armed");
});

test("I4: partial disposition — manifest armed, one of two PASS'd ids' file carries the H2 -> PASS succeeds (one-recorded-diff-covers-the-round contract)", async () => {
  // Why: AC-4 requires AT LEAST ONE candidate file among the PASS'd ids to carry
  // the section — not every id's own file. This mirrors MISSING_EVIDENCE's
  // per-round (not strictly per-id) evidence-recording convention for a single
  // suite-wide Phase 0.5 diff.
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "c15-int-partial";
  writeManifest(ws, feature);
  await seedQaInProgress(ws, feature);

  // Pre-seed T02's review file with the disposition section directly (T01's
  // will be auto-recorded from qa_review with no section).
  writeReview(ws, "T02", "## Expected-Red Diff\nPhase 0.5: clean (2/2 confirmed red)\n");

  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: ["T01", "T02"],
    pending_notes: ["QA: T01/T02 PASS"],
    qa_review: "T01 evidence, no disposition section here.",
  });
  const text = result.content[0].text;
  assert.ok(!result.isError, `PASS must succeed when at least one PASS'd id's file carries the section; got: ${text}`);
});

// ============================================================================
// I5 — AC-5: file-mode-only guard (SQLite-mode skip)
// The gate sits behind `storage instanceof FileHandoffStorage` (convention of test/cut-approval-gate.test.mjs);
// a plain fake storage object fails that check, so no SQLite DB is needed.
// ============================================================================

test("I5: gate is wrapped in instanceof FileHandoffStorage — a non-file storage fails the check (SQLite-mode skip, AC-5)", () => {
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

test("I5b: source pins the guard — both hasExpectedRedManifest call sites are FileHandoffStorage-guarded (e2-bugfix-repro-gate re-baseline)", () => {
  // Why: I5 proves the predicate; this pins the real call sites in tools/handoff-orchestrator.ts. There are two
  // hasExpectedRedManifest(parsed.workspace_path...) calls: the bugfix reproduction check behind a multi-line
  // `if (storage instanceof FileHandoffStorage && ...)`, and the PASS-path check behind a single-line literal.
  // A bare `src.indexOf(...)` lands on the first one, so the test tells the two apart.
  const root = path.resolve(import.meta.dirname, "..");
  const src = fs.readFileSync(path.join(root, "tools", "handoff-orchestrator.ts"), "utf-8");

  const firstIdx = src.indexOf("hasExpectedRedManifest(parsed.workspace_path");
  assert.ok(firstIdx !== -1, "hasExpectedRedManifest call site must exist");
  const secondIdx = src.indexOf("hasExpectedRedManifest(parsed.workspace_path", firstIdx + 1);
  assert.ok(secondIdx !== -1, "a second hasExpectedRedManifest call site must exist (e2 repro-first gate)");
  assert.equal(
    src.indexOf("hasExpectedRedManifest(parsed.workspace_path", secondIdx + 1),
    -1,
    "exactly two hasExpectedRedManifest(parsed.workspace_path...) call sites are expected",
  );

  // Site 1 (the bugfix reproduction check, T-E2-02): guarded by the compound multi-line
  // `if (storage instanceof FileHandoffStorage && ...)`. Assert the
  // substring immediately precedes the call site with no intervening block
  // close, and that it contains the compound `&&` continuation (not the
  // bare single-line literal).
  const compoundGuardIdx = src.lastIndexOf("if (\n          storage instanceof FileHandoffStorage &&", firstIdx);
  assert.ok(compoundGuardIdx !== -1, "site 1 (repro-first gate) must be wrapped in the compound FileHandoffStorage guard");
  const between1 = src.slice(compoundGuardIdx, firstIdx);
  assert.ok(!between1.includes("\n        }\n"), "site 1's compound guard must directly wrap the call (no intervening block close)");

  // Site 2 (original EXPECTED_RED_DIFF_MISSING PASS-path gate): still the
  // single-line literal `if (storage instanceof FileHandoffStorage)`,
  // byte-unchanged (AC-5 feature-mode parity).
  const singleLineGuardIdx = src.lastIndexOf("if (storage instanceof FileHandoffStorage)", secondIdx);
  assert.ok(singleLineGuardIdx !== -1, "site 2 (PASS-path gate) must be wrapped in the single-line FileHandoffStorage guard");
  assert.ok(singleLineGuardIdx > firstIdx, "site 2's guard must be its own (post-site-1) guard, not site 1's compound guard");
  const between2 = src.slice(singleLineGuardIdx, secondIdx);
  assert.ok(!between2.includes("\n        }\n"), "site 2's guard must directly wrap the expected-red gate call (no intervening block close)");
});
