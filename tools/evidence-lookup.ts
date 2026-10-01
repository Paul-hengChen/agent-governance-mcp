// Coded by @sr-engineer
// Archive-aware QA-evidence lookup, used only by tools/drift.ts. Not used by
// gates/qa-review.ts's hasEvidenceInFile, which is a live gate and scans the
// qa_reports/ root only. Looks for review_<id>.md in the root and in
// qa_reports/archive/<feature>/, plus `covers:` lines in both. A file counts
// when its last verdict section is PASS or it has no verdict section at all.
// Why: specs/e260a-tools-a-h-rationale.md, "tools/evidence-lookup.ts — verdict rule".

import * as fs from "fs";
import * as path from "path";
import { buildCoverageIndex } from "./evidence-file.js";

// Path hygiene precedent: gates/qa-review.ts:26-28 (evidencePath) uses the
// identical sanitisation. Applied independently here so this module carries
// no import-time coupling to that gate's internals (it is a live gate
// predicate this feature must not touch).
function sanitizeTaskId(taskId: string): string {
  return taskId.replace(/[^A-Za-z0-9._-]/g, "_");
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// lstatSync, NOT statSync: a symlink under qa_reports/archive/ must NOT be
// followed outside the workspace (this detector is anchored to
// workspacePath). lstatSync reports on the link itself, so a symlinked entry
// — even one pointing at a real directory — is never treated as a directory
// here and is excluded from the archive scan, confining evidence to paths
// actually inside the workspace tree. (E109)
function safeIsDirectory(p: string): boolean {
  try {
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Every per-feature subdirectory under qa_reports/archive/ (release-engineer
// SOP step 7a names each one after `active_feature` at release time). Absent
// or unreadable archive root yields [] — never throws.
function archivedFeatureDirs(workspacePath: string): string[] {
  const archiveRoot = path.join(workspacePath, "qa_reports", "archive");
  return safeReaddir(archiveRoot)
    .map((name) => path.join(archiveRoot, name))
    .filter(safeIsDirectory);
}

// The verdict-heading shape gates/qa-review.ts's recordReviewInFile and
// gates/code-review.ts's recorder both write:
// `## <ISO timestamp> — PASS|FAIL — by <reviewer>`. Matched line-anchored so
// prose elsewhere in a hand-authored report (which may say "PASS" or "FAIL"
// in running text) is never mistaken for a recorded verdict.
const VERDICT_HEADING_RE = /^##\s+\S+\s+—\s+(PASS|FAIL)\s+—\s+by\s+.+$/gm;

// Returns the LAST recorded verdict in `content`, or null when the file
// carries no verdict section at all (see module header, branch 2). Pure, no
// I/O, never throws — a regex scan over a string.
function lastVerdict(content: string): "PASS" | "FAIL" | null {
  let last: "PASS" | "FAIL" | null = null;
  const re = new RegExp(VERDICT_HEADING_RE.source, "gm"); // fresh lastIndex per call
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    last = m[1] as "PASS" | "FAIL";
  }
  return last;
}

// The content test (module header): no verdict section at all → qualifies
// (branch 2, hand-authored trust class); a verdict section exists → only
// qualifies when the LAST one is PASS (branch 1). A FAIL-only file — exactly
// what recordReviewInFile writes on a rejected round — never qualifies.
function evidenceQualifies(content: string): boolean {
  return lastVerdict(content) !== "FAIL";
}

function fileQualifiesAsEvidence(filePath: string): boolean {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return false; // absent, a directory, or otherwise unreadable
  }
  return evidenceQualifies(content);
}

// Public: for each id in `taskIds`, true when a qualifying QA record (per
// evidenceQualifies above) exists in qa_reports/, qa_reports/archive/*/, or
// a `covers:` line in either. Never throws: an unreadable or absent tree
// yields an empty result, and ids are sanitised before any path is built.
// Batch signature, like hasEvidenceInFile: the archive listing and each
// covers: index are built at most once per call.
export function hasEvidenceAnywhere(workspacePath: string, taskIds: string[]): Set<string> {
  const result = new Set<string>();
  if (taskIds.length === 0) return result;

  const qaReportsDir = path.join(workspacePath, "qa_reports");
  const archiveDirs = archivedFeatureDirs(workspacePath); // built once, not per id

  // Direct per-id file check first (cheap, common case): root, then every
  // archived feature subdir.
  const remaining: string[] = [];
  for (const taskId of taskIds) {
    const filename = `review_${sanitizeTaskId(taskId)}.md`;
    let found = fileQualifiesAsEvidence(path.join(qaReportsDir, filename));
    if (!found) {
      for (const dir of archiveDirs) {
        if (fileQualifiesAsEvidence(path.join(dir, filename))) {
          found = true;
          break;
        }
      }
    }
    if (found) {
      result.add(taskId);
    } else {
      remaining.push(taskId);
    }
  }
  if (remaining.length === 0) return result;

  // `covers:` label-line fallback (c3-covering-evidence) for whatever didn't
  // resolve directly. Each directory's coverage index (a full scan of its
  // *.md files) is built AT MOST ONCE for this whole call and reused across
  // every remaining id — the memoisation the cited precedent performs and
  // round 1 was missing.
  const coverageDirs = [qaReportsDir, ...archiveDirs];
  const coverageIndexes = coverageDirs.map((dir) => ({ dir, index: buildCoverageIndex(dir) }));
  for (const taskId of remaining) {
    for (const { dir, index } of coverageIndexes) {
      const filename = index.get(taskId);
      if (filename && fileQualifiesAsEvidence(path.join(dir, filename))) {
        result.add(taskId);
        break;
      }
    }
  }
  return result;
}
