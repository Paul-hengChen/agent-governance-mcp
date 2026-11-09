// Coded by @sr-engineer
// AC-Execution-Log gate predicates: a spec that declares `proof:` commands cannot
// PASS until QA logs running them under a `## AC Execution Log` H2 in
// qa_reports/review_<id>.md. Arms on the spec file, not a handoff field. Checks
// existence only: never runs the commands or judges their output. File mode only.
// Design: specs/e3-outcome-shaped-acceptance-architecture.md.

import * as fs from "fs";
import * as path from "path";
import { sliceH2SectionAt, buildCoverageIndex, encodeEvidenceId } from "../tools/evidence-file.js";

// The H2 heading qa-engineer's Phase 3.5 writes (skill-qa-engineer SOP 6a).
const DISPOSITION_HEADING = "AC Execution Log";

// Arm signal: the active feature's spec declares >= 1 proof:-annotated AC.
export interface AcArmResult {
  armed: boolean;
  specPath: string;
}

// Disposition: >= 1 PASS'd review file carries the H2. checkedPaths lists each
// review file examined (direct, then covers:), or the direct expected path when
// nothing is on disk, so the rejection can cite it. Deduplicated, in order.
export interface AcDispositionResult {
  present: boolean;
  checkedPaths: string[];
}

// Arm regex: a line whose first non-whitespace token is `proof:` (case-insensitive,
// whitespace allowed around the colon). Per-line anchor with newline-free
// whitespace classes, so mid-line "proof:" prose never arms.
const PROOF_LINE_RE = /^[^\S\n]*proof[^\S\n]*:/im;

function qaReportsDir(workspacePath: string): string {
  return path.join(workspacePath, "qa_reports");
}

// Same sanitiser as expectedRedManifestPath: replace disallowed chars and collapse
// `..` runs to `_`, so a hostile feature name cannot form a traversal path.
export function specFilePath(workspacePath: string, activeFeature: string): string {
  const safe = activeFeature
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.\.+/g, "_");
  return path.join(workspacePath, "specs", `${safe}.md`);
}

// Mirrors gates/qa-review.ts evidencePath (same dir, same encodeEvidenceId stem).
function reviewPath(workspacePath: string, taskId: string): string {
  return path.join(qaReportsDir(workspacePath), `review_${encodeEvidenceId(taskId)}.md`);
}

// Arm check: armed iff specs/<feature>.md exists and has >= 1 proof: line; a
// missing file or no proof: line leaves it dormant (absence is non-blocking).
// Never throws (fs errors give armed: false). Returns the spec path for errors.
export function hasProofAnnotatedAC(
  workspacePath: string,
  activeFeature: string,
): AcArmResult {
  const specPath = specFilePath(workspacePath, activeFeature);
  if (!activeFeature) return { armed: false, specPath };
  let content: string;
  try {
    content = fs.readFileSync(specPath, "utf-8");
  } catch {
    return { armed: false, specPath };
  }
  return { armed: PROOF_LINE_RE.test(content), specPath };
}

// Disposition: true iff a candidate review file for the PASS'd ids has the H2
// (match per the evidence-schema pin). Per id: direct review_<id>.md, then its
// `covers:` file when the direct one is missing or lacks the H2 (index built
// lazily, once per call). Never throws. Same traversal as expected-red.
export function hasAcExecutionLogDisposition(
  workspacePath: string,
  taskIds: string[],
  evidenceSchema?: number,
): AcDispositionResult {
  const dir = qaReportsDir(workspacePath);
  let coverage: Map<string, string> | null = null;
  const checked = new Set<string>();
  const checkedPaths: string[] = [];
  const hasHeading = (file: string): boolean => {
    if (checked.has(file)) return false;
    checked.add(file);
    checkedPaths.push(file);
    try {
      return sliceH2SectionAt(fs.readFileSync(file, "utf-8"), DISPOSITION_HEADING, evidenceSchema) !== null;
    } catch {
      return false;
    }
  };
  for (const id of taskIds) {
    const direct = reviewPath(workspacePath, id);
    const directExists = fs.existsSync(direct);
    if (directExists && hasHeading(direct)) return { present: true, checkedPaths };
    if (coverage === null) coverage = buildCoverageIndex(dir);
    const covering = coverage.get(id);
    if (covering !== undefined) {
      if (hasHeading(path.join(dir, covering))) return { present: true, checkedPaths };
    } else if (!directExists && !checked.has(direct)) {
      // Nothing on disk for this id: record where the server looked.
      checked.add(direct);
      checkedPaths.push(direct);
    }
  }
  return { present: false, checkedPaths };
}
