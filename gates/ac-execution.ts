// Coded by @sr-engineer
// AC-Execution-Log gate predicates (e3-outcome-shaped-acceptance, AC4/AC5).
// Structural twin of gates/expected-red.ts: arm by parsing a workspace file's
// content (specs/<feature>.md declares >= 1 `proof:`-annotated AC), clear by a
// `## AC Execution Log` H2 disposition in qa_reports/review_<id>.md recording
// qa-engineer's Phase 3.5 per-AC proof runs (command + raw output/exit code +
// pass/fail verdict, skill-qa-engineer).
//
// Trust boundary (spec AC4 / Out of Scope): the server checks EXISTENCE only —
// >= 1 line-leading `proof:` in the spec (arm), disposition H2 present (clear).
// It never executes the logged commands, never parses pass/fail out of stdout,
// and never judges the proofs truthful; that stays with qa-engineer /
// code-reviewer, the same division of labor as EXPECTED_RED_DIFF_MISSING /
// VISUAL_EVIDENCE_MISSING.
//
// Arm detection (architecture Decision b): parse specs/<feature>.md — NO
// handoff schema field, NO v13 bump. Every E-series arm precedent
// (gates/visual.ts mode, gates/expected-red.ts manifest) arms by reading a
// workspace file derived from active_feature; this gate follows it. Pre-E3
// specs carry zero `proof:` lines → { armed: false }, zero-cost dormant (AC5).
//
// Registry linkage: the AC_EXECUTION_LOG_MISSING hint is emitted at the
// orchestrator emit site via gate("AC_EXECUTION_LOG_MISSING").hintStatic
// (DR-2 pattern); these predicates return typed results only, so no registry
// import is added here. FILE-MODE ONLY: the orchestrator guards the call site
// with `storage instanceof FileHandoffStorage` — SQLite/HTTP mode has no
// qa_reports/ file convention to hang the disposition off of.

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
// E23 (D3): checkedPaths records every candidate review file the traversal
// examined — the direct qa_reports/review_<id>.md when it exists, else the
// covers:-resolved file, else the direct EXPECTED path (named so the
// AC_EXECUTION_LOG_MISSING envelope can cite where the server looked even
// when nothing was on disk). Deduplicated, traversal order.
export interface AcDispositionResult {
  present: boolean;
  checkedPaths: string[];
}

// Arm regex (architecture Interface Contracts, verified against the live E3
// spec: 8 matches, 0 false positives): a line whose first non-whitespace
// token is `proof:` (case-insensitive; whitespace allowed around the colon).
// Anchored per line (`m`) with newline-excluding whitespace classes so
// mid-line / backtick "proof:" prose never false-arms.
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
// every pre-E3 spec (AC5), the same absence-is-non-blocking polarity as
// hasExpectedRedManifest. Never throws (fs errors → armed: false). Returns
// the resolved spec path so the emit site can cite it in the error text.
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

// Disposition check (AC4, Decision c — per-feature, at-least-one-across-ids):
// true iff AT LEAST ONE candidate review file for the ids being PASS'd
// contains a `## AC Execution Log` H2. Candidates per id: the direct
// qa_reports/review_<id>.md; else — lazily, on the first direct-file miss
// only (the hasEvidenceInFile precedent) — the file covering the id via the
// c3 `covers:` label-line index. "At least one across all ids" (not per-id):
// the proofs describe the SPEC, so QA runs them once per round and one
// recorded log covers every id in the round — a per-id requirement would
// force QA to duplicate the same log N times. Verbatim clone of
// hasExpectedRedDisposition's traversal. Never throws (fs errors → file
// skipped). E23 (D2): heading match is evidence-schema-keyed — pin 1 replays
// the legacy exact anchor; pin >=2 or absent uses normalized-contains, so
// `## Phase 3.5 — AC Execution Log` (the 104447-F0 incident heading) clears.
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
      // E23 D3: nothing on disk for this id — record the direct EXPECTED
      // path so the rejection envelope can name where the server looked.
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
