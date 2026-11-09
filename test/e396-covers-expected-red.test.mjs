// Coded by @qa-engineer
// E396 reproduction record (spec AC11): gates/expected-red.ts consulted a batched `covers:` review file only when
// an id's own review_<id>.md was missing, so once QA_REVIEW_RECORD or an earlier FAIL created a per-id file
// without the `## Expected-Red Diff` H2, PASS was rejected. Red before 0f67342, green after.
// U1: no per-id files (control). U2: per-id files without the H2 for every id.
// I: integration through handleUpdateState with per-id files created by the qa_review record.
// Each case asserts the correct behaviour.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { hasExpectedRedDisposition, expectedRedManifestPath } from "../dist/gates/expected-red.js";
import { FileHandoffStorage, setActiveStorage } from "../dist/tools/storage.js";
import { handleUpdateState } from "../dist/tools/handoff-orchestrator.js";
import { writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { forceSeedStamp } from "./e148-seed-stamp.mjs";

const IDS = [
  "T-E391-01", "T-E391-02", "T-E391-04", "T-E391-05", "T-E391-06", "T-E391-07", "T-E391-08",
];

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e396-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  return ws;
}

function writeCoveringFile(ws) {
  const body = [
    "# review E391",
    "",
    `covers: ${IDS.join(", ")}`,
    "",
    "## Expected-Red Diff",
    "Phase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds)",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(ws, "qa_reports", "review_E391.md"), body, "utf-8");
}

function writePerIdFilesWithoutH2(ws) {
  for (const id of IDS) {
    fs.writeFileSync(path.join(ws, "qa_reports", `review_${id}.md`), `# ${id}\n\nnotes only\n`, "utf-8");
  }
}

test("E396 U1: no per-id files, covering file holds the H2 -> present:true (control)", () => {
  const ws = mkWorkspace();
  writeCoveringFile(ws);
  assert.equal(hasExpectedRedDisposition(ws, IDS).present, true);
});

test("E396 U2: per-id file without the H2 exists for every id, covering file has it -> present:true", () => {
  const ws = mkWorkspace();
  writeCoveringFile(ws);
  writePerIdFilesWithoutH2(ws);
  assert.equal(
    hasExpectedRedDisposition(ws, IDS).present,
    true,
    "the covers: file must still be consulted when the direct file lacks the H2",
  );
});

test("E396 I: PASS over seven ids, manifest armed, qa_review without the H2, covering file has it -> not EXPECTED_RED_DIFF_MISSING", async () => {
  setActiveStorage(new FileHandoffStorage());
  const ws = mkWorkspace();
  const feature = "e396-int";
  fs.writeFileSync(expectedRedManifestPath(ws, feature), "some/test.mjs | a test name\n", "utf-8");
  writeCoveringFile(ws);
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
  forceSeedStamp(ws);
  resetSession(ws);
  markStateRead(ws);
  const result = await handleUpdateState({
    workspace_path: ws,
    active_feature: feature,
    status: "PASS",
    agent_id: "qa-engineer",
    completed_tasks: IDS,
    pending_notes: ["QA: PASS"],
    qa_review: "Looks good; the Expected-Red Diff lives in the covers: file.",
  });
  const text = result.content[0].text;
  assert.ok(
    !text.includes("EXPECTED_RED_DIFF_MISSING"),
    `covers: file must satisfy the gate after QA_REVIEW_RECORD creates per-id files; got: ${text}`,
  );
});
