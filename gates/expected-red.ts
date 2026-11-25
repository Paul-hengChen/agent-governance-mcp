// Coded by @sr-engineer
// Expected-Red Diff gate predicates: sr-engineer lists tests left red on purpose
// in qa_reports/expected-red_<feature>.txt (`<test file> | <test name>` per
// line); QA records its diff against the suite run under a `## Expected-Red
// Diff` H2 in qa_reports/review_<id>.md. Existence only: the manifest arms, the
// H2 clears; rows are never parsed and tests never run. File mode only.
// Spec: specs/c15-expected-red-manifest.md.

import * as fs from "fs";
import * as path from "path";
import { sliceH2SectionAt, buildCoverageIndex, encodeEvidenceId, resolveJudgeReport } from "../tools/evidence-file.js";

// The H2 heading qa-engineer's Phase 0.5 writes (skill-qa-engineer SOP 2a).
const DISPOSITION_HEADING = "Expected-Red Diff";

// Manifest and no-new-test record directory: qa's own artifacts, not the judge
// report, so they keep their own location.
function qaReportsDir(workspacePath: string): string {
  return path.join(workspacePath, "qa_reports");
}

// Same sanitiser as gates/visual.ts designFilePath (v3.14.1 hardening):
// replace non-allowed chars AND collapse any resulting `..` run to `_` so a
// hostile feature name never produces a traversal-shaped filename.
function safeFeatureName(activeFeature: string): string {
  return activeFeature
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.\.+/g, "_");
}

export function expectedRedManifestPath(
  workspacePath: string,
  activeFeature: string,
): string {
  return path.join(qaReportsDir(workspacePath), `expected-red_${safeFeatureName(activeFeature)}.txt`);
}

// Where qa-engineer records that a test-first ticket needs no new test.
export function noNewTestRecordPath(
  workspacePath: string,
  activeFeature: string,
): string {
  return path.join(qaReportsDir(workspacePath), `no-new-test_${safeFeatureName(activeFeature)}.txt`);
}

// Judge-report path: directory from the resolver, stem from encodeEvidenceId.
function reviewPath(workspacePath: string, taskId: string): string {
  return path.join(resolveJudgeReport(workspacePath).dir, `review_${encodeEvidenceId(taskId)}.md`);
}

// Arm check (AC-4 arming polarity, mirrors hasVisualBaselinesInDesign's
// shape): the gate is armed iff the feature's manifest FILE exists. Absence
// means "no expected reds declared" — the gate never fires, zero cost for
// features with no intentional reds (same absence-is-non-blocking polarity as
// the external_refs / dispatch_pins fields; C9/C14). Returns the resolved path
// so the emit site can cite it in the error text.
export function hasExpectedRedManifest(
  workspacePath: string,
  activeFeature: string,
): { present: boolean; manifestPath: string } {
  const manifestPath = expectedRedManifestPath(workspacePath, activeFeature);
  if (!activeFeature) return { present: false, manifestPath };
  return { present: fs.existsSync(manifestPath), manifestPath };
}

// Existence only, same shape and polarity as hasExpectedRedManifest: the file's
// content is never read, an empty feature name is never present. Never throws.
export function hasNoNewTestRecord(
  workspacePath: string,
  activeFeature: string,
): { present: boolean; recordPath: string } {
  const recordPath = noNewTestRecordPath(workspacePath, activeFeature);
  if (!activeFeature) return { present: false, recordPath };
  return { present: fs.existsSync(recordPath), recordPath };
}

// Disposition: true iff a candidate review file for the PASS'd ids has the H2.
// Per id: direct review_<id>.md, then its `covers:` file when the direct one is
// missing or lacks the H2 (index built lazily, once per call). One feature-scoped
// diff covers every id. The heading match follows the evidence-schema pin
// (pin 1 exact anchor; pin >= 2 or absent normalized-contains). Never throws
// (fs errors skip the file).
export function hasExpectedRedDisposition(
  workspacePath: string,
  taskIds: string[],
  evidenceSchema?: number,
): { present: boolean } {
  const dir = resolveJudgeReport(workspacePath).dir;
  let coverage: Map<string, string> | null = null;
  const checked = new Set<string>();
  const hasHeading = (file: string): boolean => {
    if (checked.has(file)) return false;
    checked.add(file);
    try {
      return sliceH2SectionAt(fs.readFileSync(file, "utf-8"), DISPOSITION_HEADING, evidenceSchema) !== null;
    } catch {
      return false;
    }
  };
  for (const id of taskIds) {
    const direct = reviewPath(workspacePath, id);
    if (fs.existsSync(direct) && hasHeading(direct)) return { present: true };
    if (coverage === null) coverage = buildCoverageIndex(dir);
    const covering = coverage.get(id);
    if (covering !== undefined && hasHeading(path.join(dir, covering))) {
      return { present: true };
    }
  }
  return { present: false };
}
