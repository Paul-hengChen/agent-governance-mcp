// Coded by @sr-engineer
// Code-review-evidence gate predicates (A2 split — verbatim relocation from
// tools/evidence-file.ts, no behavior change). Parallel to gates/qa-review.ts
// but over <workspace>/review_reports/review_<task_id>.md. A per-id file's
// existence is sufficient for hasCodeReviewEvidenceInFile(); when a per-id
// file is absent, a lazy `covers:` label-line fallback (c3-covering-evidence)
// lets one covering report satisfy additional ids — see parseCoversIds /
// buildCoverageIndex in tools/evidence-file.ts (gate-agnostic plumbing).
//
// Registry linkage: the code-review-evidence gate (MISSING_REVIEW_EVIDENCE)
// emits its hint at the orchestrator emit site via
// gate("MISSING_REVIEW_EVIDENCE").hintStatic (DR-2). These predicates return
// present/missing data only, so no registry import is added here.
import * as fs from "fs";
import * as path from "path";
import { buildCoverageIndex } from "../tools/evidence-file.js";
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
    // c3-covering-evidence: identical lazy `covers:` fallback over
    // review_reports/ — built at most once per call, only on first miss (AC-6).
    let coverage = null;
    for (const id of taskIds) {
        if (fs.existsSync(codeReviewPath(workspacePath, id))) {
            present.push(id);
            continue;
        }
        if (coverage === null)
            coverage = buildCoverageIndex(codeReviewDir(workspacePath));
        if (coverage.has(id)) {
            present.push(id);
        }
        else {
            missing.push(id);
        }
    }
    return { present, missing };
}
//# sourceMappingURL=code-review.js.map