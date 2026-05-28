// Coded by @sr-engineer
// File-mode QA evidence I/O. Mirrors the SQLite reports table at filesystem
// granularity. Each QA round appends a timestamped section to
// <workspace>/qa_reports/review_<task_id>.md. Existence (any review file)
// is sufficient for hasEvidence() — content is not parsed.
import * as fs from "fs";
import * as path from "path";
function evidenceDir(workspacePath) {
    return path.join(workspacePath, "qa_reports");
}
function evidencePath(workspacePath, taskId) {
    // Hard sanitise task id — prevent path traversal in case caller passes
    // a malicious id. Only allow ascii alnum + dash/underscore/dot.
    const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
    return path.join(evidenceDir(workspacePath), `review_${safe}.md`);
}
export async function recordReviewInFile(workspacePath, taskIds, status, reviewer, notes) {
    const dir = evidenceDir(workspacePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString();
    for (const id of taskIds) {
        const filePath = evidencePath(workspacePath, id);
        const existed = fs.existsSync(filePath);
        const header = existed ? "" : `# QA review — ${id}\n\n<!-- Auto-appended by tw_update_state(qa_review=...). -->\n\n`;
        const section = `## ${ts} — ${status} — by ${reviewer}\n\n${notes.trim()}\n\n`;
        fs.appendFileSync(filePath, `${header}${section}`, "utf-8");
    }
}
export function hasEvidenceInFile(workspacePath, taskIds) {
    const present = [];
    const missing = [];
    for (const id of taskIds) {
        if (fs.existsSync(evidencePath(workspacePath, id))) {
            present.push(id);
        }
        else {
            missing.push(id);
        }
    }
    return { present, missing };
}
// ---------- code-reviewer evidence (parallel to qa above) ----------
function codeReviewDir(workspacePath) {
    return path.join(workspacePath, "review_reports");
}
function codeReviewPath(workspacePath, taskId) {
    const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
    return path.join(codeReviewDir(workspacePath), `review_${safe}.md`);
}
export async function recordCodeReviewInFile(workspacePath, taskIds, verdict, reviewer, notes) {
    const dir = codeReviewDir(workspacePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
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
export function hasCodeReviewEvidenceInFile(workspacePath, taskIds) {
    const present = [];
    const missing = [];
    for (const id of taskIds) {
        if (fs.existsSync(codeReviewPath(workspacePath, id))) {
            present.push(id);
        }
        else {
            missing.push(id);
        }
    }
    return { present, missing };
}
//# sourceMappingURL=evidence-file.js.map