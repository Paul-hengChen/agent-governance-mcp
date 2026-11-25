// Coded by @sr-engineer
// Archive-aware lookup of the judge report (resolveJudgeReport,
// tools/evidence-file.ts), used only by tools/drift.ts. Not used by
// gates/qa-review.ts's hasEvidenceInFile, which is a live gate and scans the
// qa_reports/ root only. Looks for review_<id>.md in the root and in
// qa_reports/archive/<feature>/, plus `covers:` lines in both. A file counts
// when its last server-recorded verdict section (tools/evidence-file.ts
// judgeReportStanding) is PASS, or it has none at all.
// Why: specs/e260a-tools-a-h-rationale.md, "tools/evidence-lookup.ts — verdict rule".
import * as fs from "fs";
import * as path from "path";
import { buildCoverageIndex, encodeEvidenceId, judgeReportStanding, resolveJudgeReport } from "./evidence-file.js";
// Same filename stem as gates/qa-review.ts evidencePath: both derive it via
// the shared injective encodeEvidenceId, so this lookup and the live gate
// always agree on which file belongs to which task id.
function sanitizeTaskId(taskId) {
    return encodeEvidenceId(taskId);
}
function safeReaddir(dir) {
    try {
        return fs.readdirSync(dir);
    }
    catch {
        return [];
    }
}
// lstatSync, NOT statSync: a symlink under qa_reports/archive/ must NOT be
// followed outside the workspace (this detector is anchored to
// workspacePath). lstatSync reports on the link itself, so a symlinked entry
// — even one pointing at a real directory — is never treated as a directory
// here and is excluded from the archive scan, confining evidence to paths
// actually inside the workspace tree. (E109)
function safeIsDirectory(p) {
    try {
        return fs.lstatSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
// Every per-feature subdirectory under qa_reports/archive/ (release-engineer
// SOP step 7a names each one after `active_feature` at release time). Absent
// or unreadable archive root yields [] — never throws.
function archivedFeatureDirs(workspacePath) {
    const archiveRoot = path.join(resolveJudgeReport(workspacePath).dir, "archive");
    return safeReaddir(archiveRoot)
        .map((name) => path.join(archiveRoot, name))
        .filter(safeIsDirectory);
}
// The content test (module header): no server-recorded verdict section at
// all -> qualifies (hand-authored trust class); otherwise it qualifies only
// when the LAST one is PASS. A FAIL-only file never qualifies.
function evidenceQualifies(content) {
    return judgeReportStanding(content).verdict !== "FAIL";
}
function fileQualifiesAsEvidence(filePath) {
    let content;
    try {
        content = fs.readFileSync(filePath, "utf-8");
    }
    catch {
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
export function hasEvidenceAnywhere(workspacePath, taskIds) {
    const result = new Set();
    if (taskIds.length === 0)
        return result;
    const qaReportsDir = resolveJudgeReport(workspacePath).dir;
    const archiveDirs = archivedFeatureDirs(workspacePath); // built once, not per id
    // Direct per-id file check first (cheap, common case): root, then every
    // archived feature subdir.
    const remaining = [];
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
        }
        else {
            remaining.push(taskId);
        }
    }
    if (remaining.length === 0)
        return result;
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
//# sourceMappingURL=evidence-lookup.js.map