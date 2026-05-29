// Coded by @sr-engineer
// File-mode QA evidence I/O. Mirrors the SQLite reports table at filesystem
// granularity. Each QA round appends a timestamped section to
// <workspace>/qa_reports/review_<task_id>.md. Existence (any review file)
// is sufficient for hasEvidence() — content is not parsed.

import * as fs from "fs";
import * as path from "path";

function evidenceDir(workspacePath: string): string {
  return path.join(workspacePath, "qa_reports");
}

function evidencePath(workspacePath: string, taskId: string): string {
  // Hard sanitise task id — prevent path traversal in case caller passes
  // a malicious id. Only allow ascii alnum + dash/underscore/dot.
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(evidenceDir(workspacePath), `review_${safe}.md`);
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
  for (const id of taskIds) {
    if (fs.existsSync(evidencePath(workspacePath, id))) {
      present.push(id);
    } else {
      missing.push(id);
    }
  }
  return { present, missing };
}

// ---------- code-reviewer evidence (parallel to qa above) ----------

function codeReviewDir(workspacePath: string): string {
  return path.join(workspacePath, "review_reports");
}

function codeReviewPath(workspacePath: string, taskId: string): string {
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(codeReviewDir(workspacePath), `review_${safe}.md`);
}

export async function recordCodeReviewInFile(
  workspacePath: string,
  taskIds: string[],
  verdict: "APPROVED" | "CHANGES_REQUESTED",
  reviewer: string,
  notes: string,
): Promise<void> {
  const dir = codeReviewDir(workspacePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString();
  for (const id of taskIds) {
    const filePath = codeReviewPath(workspacePath, id);
    const existed = fs.existsSync(filePath);
    const header = existed
      ? ""
      : `# Code review — ${id}\n\n<!-- Auto-appended by tw_update_state. -->\n\n`;
    const section = `## ${ts} — ${verdict} — by ${reviewer}\n\n${notes.trim()}\n\n`;
    fs.appendFileSync(filePath, `${header}${section}`, "utf-8");
  }
}

export function hasCodeReviewEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const id of taskIds) {
    if (fs.existsSync(codeReviewPath(workspacePath, id))) {
      present.push(id);
    } else {
      missing.push(id);
    }
  }
  return { present, missing };
}

// ---------- visual evidence (v3.14.0) ----------
// Constitution §3.1 visual evidence gate: when `design/<active_feature>.md`
// contains a `## Visual Baselines` H2, PASS additionally requires
// `qa_reports/visual_<task-id>.md` for every task id in the round.

function visualEvidencePath(workspacePath: string, taskId: string): string {
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(workspacePath, "qa_reports", `visual_${safe}.md`);
}

function designFilePath(workspacePath: string, activeFeature: string): string {
  // v3.14.1 — sanitiser hardening: replace non-allowed chars AND collapse any
  // resulting `..` to `_` so a hostile feature name like `..feat` or `pp..pp`
  // never produces a path with `..` segments. The earlier v3.14.0 sanitiser
  // already replaced `/` with `_` (so `../etc/passwd` collapsed to
  // `.._etc_passwd`, blocking traversal), but the literal `..` survived as a
  // filename. This pass closes the cosmetic / surprising-behaviour gap.
  const safe = activeFeature
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.\.+/g, "_");
  return path.join(workspacePath, "design", `${safe}.md`);
}

// Detects whether the workspace's design file declares any Visual Baselines.
// Returns existence + the resolved path so callers can include the path in
// error hints. Reads the file once per call (no caching — design files are
// small and PASS attempts are infrequent enough that fs cost is negligible).
// Match is permissive: any H2 line beginning with `## Visual Baselines`
// (case-insensitive, optional trailing text) triggers the gate.
export function hasVisualBaselinesInDesign(
  workspacePath: string,
  activeFeature: string,
): { present: boolean; designPath: string } {
  const designPath = designFilePath(workspacePath, activeFeature);
  if (!activeFeature || !fs.existsSync(designPath)) {
    return { present: false, designPath };
  }
  try {
    const content = fs.readFileSync(designPath, "utf-8");
    const hasBaselines = /^##\s+Visual\s+Baselines\b/im.test(content);
    return { present: hasBaselines, designPath };
  } catch {
    return { present: false, designPath };
  }
}

// Per-task existence check for `qa_reports/visual_<task-id>.md`.
// Mirror of hasEvidenceInFile / hasCodeReviewEvidenceInFile — existence is
// sufficient; the qa-engineer + skill-qa-visual SOP enforce the contents
// (widget shape checklist, pixel diff sections). Server does NOT parse.
export function hasVisualEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const id of taskIds) {
    if (fs.existsSync(visualEvidencePath(workspacePath, id))) {
      present.push(id);
    } else {
      missing.push(id);
    }
  }
  return { present, missing };
}
