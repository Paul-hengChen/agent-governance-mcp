// Coded by @sr-engineer
// QA-evidence gate predicates (A2 split — verbatim relocation from
// tools/evidence-file.ts, no behavior change). File-mode QA evidence I/O:
// each QA round appends a timestamped section to
// <workspace>/qa_reports/review_<task_id>.md. A per-id file's existence is
// sufficient for hasEvidenceInFile(); when a per-id file is absent, a lazy
// `covers:` label-line fallback (c3-covering-evidence) lets one covering
// report satisfy additional ids — see parseCoversIds / buildCoverageIndex in
// tools/evidence-file.ts (gate-agnostic plumbing).
//
// Registry linkage: the QA-evidence gate (MISSING_EVIDENCE) emits its hint at
// the orchestrator emit site, which sources gate("MISSING_EVIDENCE").hintStatic
// from gates/registry.ts (DR-2). These predicates return present/missing data
// only and do not consume hint text, so no registry import is added here.
import * as fs from "fs";
import * as path from "path";
import { buildCoverageIndex } from "../tools/evidence-file.js";
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
    // c3-covering-evidence: coverage index over qa_reports/ `covers:` lines,
    // built at most once per call and ONLY on the first direct-file miss (AC-6).
    let coverage = null;
    for (const id of taskIds) {
        if (fs.existsSync(evidencePath(workspacePath, id))) {
            present.push(id);
            continue;
        }
        if (coverage === null)
            coverage = buildCoverageIndex(evidenceDir(workspacePath));
        if (coverage.has(id)) {
            present.push(id);
        }
        else {
            missing.push(id);
        }
    }
    return { present, missing };
}
//# sourceMappingURL=qa-review.js.map