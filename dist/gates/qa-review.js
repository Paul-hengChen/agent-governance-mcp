// Coded by @sr-engineer
// QA evidence gate predicates: each QA round appends a timestamped section to
// qa_reports/review_<task_id>.md. A per-id file's existence is enough; when it is
// absent, a lazy `covers:` fallback lets one covering report satisfy other ids
// (parseCoversIds / buildCoverageIndex in tools/evidence-file.ts).
// Spec: specs/c3-covering-evidence.md.
import * as fs from "fs";
import * as path from "path";
import { buildCoverageIndex, encodeEvidenceId } from "../tools/evidence-file.js";
function evidenceDir(workspacePath) {
    return path.join(workspacePath, "qa_reports");
}
function evidencePath(workspacePath, taskId) {
    // The injective encoder keeps distinct ids on distinct files and blocks
    // path traversal (its output has no separator characters).
    return path.join(evidenceDir(workspacePath), `review_${encodeEvidenceId(taskId)}.md`);
}
// Exported so the QA completion-evidence rejection names the exact expected file,
// the same sanitised path the predicates below check. A wrapper, not a rename:
// test/covering-evidence.test.mjs pins the literal
// `fs.existsSync(evidencePath(...))` text inside hasEvidenceInFile.
export function qaEvidencePath(workspacePath, taskId) {
    return evidencePath(workspacePath, taskId);
}
export async function recordReviewInFile(workspacePath, taskIds, status, reviewer, notes) {
    await recordReviewInFileUndoable(workspacePath, taskIds, status, reviewer, notes);
}
// Byte size of a regular file, or null when it does not exist / cannot be
// stat'd.
function sizeOrNull(filePath) {
    try {
        return fs.statSync(filePath).size;
    }
    catch {
        return null;
    }
}
// Reverts the appends in `records` (reverse order) and removes the evidence
// directory when this write created it and left it empty. Never throws. A file
// is touched only when it still matches this write's post-append shape, so a
// concurrent writer's later append is never destroyed (the file is left as is).
function undoRecordedAppends(records, dir, dirExistedBefore) {
    for (let i = records.length - 1; i >= 0; i--) {
        const r = records[i];
        try {
            if (r.appended.length === 0)
                continue;
            if (sizeOrNull(r.filePath) !== r.postSize)
                continue;
            if (!r.existedBefore) {
                fs.unlinkSync(r.filePath);
                continue;
            }
            const tail = fs.readFileSync(r.filePath).subarray(r.preSize);
            if (!tail.equals(r.appended))
                continue;
            fs.truncateSync(r.filePath, r.preSize);
        }
        catch {
            // Best effort: an undo failure leaves the file as it is.
        }
    }
    if (!dirExistedBefore) {
        try {
            if (fs.readdirSync(dir).length === 0)
                fs.rmdirSync(dir);
        }
        catch {
            // Best effort, as above.
        }
    }
}
// The append recordReviewInFile performs, returning an undo that restores
// every touched evidence file (and the qa_reports/ directory) to its pre-write
// state. Used by tw_update_state so a write the server then rejects, or whose
// state write throws, leaves no PASS/FAIL section behind. The appended bytes
// are exactly those recordReviewInFile has always written. If an append throws
// part-way, what was already appended is undone and the error is rethrown.
export async function recordReviewInFileUndoable(workspacePath, taskIds, status, reviewer, notes) {
    const dir = evidenceDir(workspacePath);
    const dirExistedBefore = fs.existsSync(dir);
    // Snapshot every distinct target path before any append: a repeated id
    // appends twice to one file, and the undo must restore the pre-write size.
    const records = [];
    const byPath = new Map();
    for (const id of taskIds) {
        const filePath = evidencePath(workspacePath, id);
        if (byPath.has(filePath))
            continue;
        const preSize = sizeOrNull(filePath);
        const record = {
            filePath,
            existedBefore: preSize !== null,
            preSize: preSize ?? 0,
            appended: Buffer.alloc(0),
            postSize: preSize ?? 0,
        };
        byPath.set(filePath, record);
        records.push(record);
    }
    const undo = () => undoRecordedAppends(records, dir, dirExistedBefore);
    try {
        if (!dirExistedBefore)
            fs.mkdirSync(dir, { recursive: true });
        const ts = new Date().toISOString();
        for (const id of taskIds) {
            const filePath = evidencePath(workspacePath, id);
            const existed = fs.existsSync(filePath);
            const header = existed ? "" : `# QA review — ${id}\n\n<!-- Auto-appended by tw_update_state(qa_review=...). -->\n\n`;
            const section = `## ${ts} — ${status} — by ${reviewer}\n\n${notes.trim()}\n\n`;
            const text = `${header}${section}`;
            fs.appendFileSync(filePath, text, "utf-8");
            const record = byPath.get(filePath);
            record.appended = Buffer.concat([record.appended, Buffer.from(text, "utf-8")]);
            record.postSize = record.preSize + record.appended.length;
        }
    }
    catch (err) {
        undo();
        throw err;
    }
    return undo;
}
export function hasEvidenceInFile(workspacePath, taskIds) {
    const present = [];
    const missing = [];
    // Covering evidence (C3): coverage index over qa_reports/ `covers:` lines,
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