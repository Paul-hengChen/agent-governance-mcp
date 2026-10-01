// Coded by @sr-engineer
// QA evidence gate predicates: each QA round appends a timestamped section to
// qa_reports/review_<task_id>.md. A per-id file's existence is enough; when it is
// absent, a lazy `covers:` fallback lets one covering report satisfy other ids
// (parseCoversIds / buildCoverageIndex in tools/evidence-file.ts).
// Spec: specs/c3-covering-evidence.md.

import * as fs from "fs";
import * as path from "path";
import { buildCoverageIndex } from "../tools/evidence-file.js";

function evidenceDir(workspacePath: string): string {
  return path.join(workspacePath, "qa_reports");
}

function evidencePath(workspacePath: string, taskId: string): string {
  // Hard sanitise task id — prevent path traversal in case caller passes
  // a malicious id. Only allow ascii alnum + dash/underscore/dot.
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(evidenceDir(workspacePath), `review_${safe}.md`);
}

// Exported so the QA completion-evidence rejection names the exact expected file,
// the same sanitised path the predicates below check. A wrapper, not a rename:
// test/covering-evidence.test.mjs pins the literal
// `fs.existsSync(evidencePath(...))` text inside hasEvidenceInFile.
export function qaEvidencePath(workspacePath: string, taskId: string): string {
  return evidencePath(workspacePath, taskId);
}

export async function recordReviewInFile(
  workspacePath: string,
  taskIds: string[],
  status: "PASS" | "FAIL",
  reviewer: string,
  notes: string,
): Promise<void> {
  const dir = evidenceDir(workspacePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString();
  for (const id of taskIds) {
    const filePath = evidencePath(workspacePath, id);
    const existed = fs.existsSync(filePath);
    const header = existed ? "" : `# QA review — ${id}\n\n<!-- Auto-appended by tw_update_state(qa_review=...). -->\n\n`;
    const section = `## ${ts} — ${status} — by ${reviewer}\n\n${notes.trim()}\n\n`;
    fs.appendFileSync(filePath, `${header}${section}`, "utf-8");
  }
}

export function hasEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  // Covering evidence (C3): coverage index over qa_reports/ `covers:` lines,
  // built at most once per call and ONLY on the first direct-file miss (AC-6).
  let coverage: Map<string, string> | null = null;
  for (const id of taskIds) {
    if (fs.existsSync(evidencePath(workspacePath, id))) {
      present.push(id);
      continue;
    }
    if (coverage === null) coverage = buildCoverageIndex(evidenceDir(workspacePath));
    if (coverage.has(id)) {
      present.push(id);
    } else {
      missing.push(id);
    }
  }
  return { present, missing };
}
