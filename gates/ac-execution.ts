// Coded by @sr-engineer
// AC-Execution-Log gate predicates: a spec that declares `proof:` commands cannot
// PASS until QA logs running them under a `## AC Execution Log` H2 in
// qa_reports/review_<id>.md. Arms on the spec file, not a handoff field. Checks
// existence only: never runs the commands or judges their output. File mode only.
// Design: specs/e3-outcome-shaped-acceptance-architecture.md.

import * as fs from "fs";
import * as path from "path";
import { sliceH2SectionAt, buildCoverageIndex } from "../tools/evidence-file.js";

// The H2 heading qa-engineer's Phase 3.5 writes (skill-qa-engineer SOP 6a).
const DISPOSITION_HEADING = "AC Execution Log";

// Arm signal: the active feature's spec declares >= 1 proof:-annotated AC.
export interface AcArmResult {
  armed: boolean;
  specPath: string;
}

// Disposition: >= 1 PASS'd review file carries the `## AC Execution Log` H2.
// checkedPaths records every candidate review file the traversal examined —
// the direct qa_reports/review_<id>.md when it exists, else the
// covers:-resolved file, else the direct EXPECTED path (named so the
// AC_EXECUTION_LOG_MISSING envelope can cite where the server looked even when
// nothing was on disk). Deduplicated, traversal order. (E23 D3)
export interface AcDispositionResult {
  present: boolean;
  checkedPaths: string[];
}

// Arm regex (architecture Interface Contracts, verified against the live spec
// that introduced this gate: 8 matches, 0 false positives): a line whose first
// non-whitespace token is `proof:` (case-insensitive; whitespace allowed
// around the colon). Anchored per line (`m`) with newline-excluding whitespace
// classes so mid-line / backtick "proof:" prose never false-arms.
const PROOF_LINE_RE = /^[^\S\n]*proof[^\S\n]*:/im;

function qaReportsDir(workspacePath: string): string {
  return path.join(workspacePath, "qa_reports");
}

// Same sanitiser as expectedRedManifestPath / designFilePath (v3.14.1
// hardening): replace non-allowed chars AND collapse any resulting `..` run
// to `_` so a hostile feature name never produces a traversal-shaped filename.
export function specFilePath(workspacePath: string, activeFeature: string): string {
  const safe = activeFeature
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.\.+/g, "_");
  return path.join(workspacePath, "specs", `${safe}.md`);
}

// Mirrors gates/expected-red.ts reviewPath (same directory, same sanitiser).
function reviewPath(workspacePath: string, taskId: string): string {
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(qaReportsDir(workspacePath), `review_${safe}.md`);
}

// Arm check (AC4/AC5, Decision b): armed iff specs/<feature>.md exists AND
// contains >= 1 line whose first non-whitespace token is `proof:`. Absence of
// the file OR of any proof: line ⇒ { armed: false } — zero-cost dormant for
// every spec written before this gate existed (AC5), the same
// absence-is-non-blocking polarity as hasExpectedRedManifest. Never throws (fs
// errors → armed: false). Returns the resolved spec path so the emit site can
// cite it in the error text.
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

// Disposition check: true iff at least one candidate review file for the ids
// being PASS'd has a `## AC Execution Log` H2. Candidate per id: the direct
// qa_reports/review_<id>.md, else (lazily, on first miss) the file that lists the
// id in a `covers:` line. One log per round covers every id, because the proofs
// describe the spec. The heading match follows the evidence-schema pin. Never
// throws (fs errors skip the file). Same traversal as hasExpectedRedDisposition.
export function hasAcExecutionLogDisposition(
  workspacePath: string,
  taskIds: string[],
  evidenceSchema?: number,
): AcDispositionResult {
  let coverage: Map<string, string> | null = null;
  const checked = new Set<string>();
  const checkedPaths: string[] = [];
  for (const id of taskIds) {
    const direct = reviewPath(workspacePath, id);
    let candidate: string | null = null;
    if (fs.existsSync(direct)) {
      candidate = direct;
    } else {
      if (coverage === null) coverage = buildCoverageIndex(qaReportsDir(workspacePath));
      const covering = coverage.get(id);
      if (covering !== undefined) {
        candidate = path.join(qaReportsDir(workspacePath), covering);
      }
    }
    if (candidate === null) {
      // Nothing on disk for this id: record the direct EXPECTED path so
      // the rejection envelope can name where the server looked (E23 D3).
      if (!checked.has(direct)) {
        checked.add(direct);
        checkedPaths.push(direct);
      }
      continue;
    }
    if (checked.has(candidate)) continue;
    checked.add(candidate);
    checkedPaths.push(candidate);
    let content: string;
    try {
      content = fs.readFileSync(candidate, "utf-8");
    } catch {
      continue;
    }
    if (sliceH2SectionAt(content, DISPOSITION_HEADING, evidenceSchema) !== null) {
      return { present: true, checkedPaths };
    }
  }
  return { present: false, checkedPaths };
}
