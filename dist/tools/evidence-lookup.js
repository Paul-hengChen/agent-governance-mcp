// Coded by @sr-engineer
// Archive-aware QA-evidence lookup for tools/drift.ts. Read-only, consumed
// ONLY by drift.ts's evidence-aware split of the "Possible vibe-coding drift"
// bucket — NOT by gates/qa-review.ts's hasEvidenceInFile, which deliberately
// scans qa_reports/ root only (MISSING_EVIDENCE is a live gate predicate;
// widening its scan would change gate behaviour). (E112)
//
// This module extends the SAME id-file convention
// (qa_reports/review_<id>.md) that gates/qa-review.ts checks at root into the
// release-engineer archive tree the Evidence-Citation Convention documents
// (qa_reports/archive/<feature>/review_<id>.md — content/skill-release-engineer.md
// SOP step 7a; CHANGELOG.md's "Evidence-Citation Convention" entry), plus the
// `covers:` label-line fallback (parseCoversIds / buildCoverageIndex,
// tools/evidence-file.ts) in both locations — so a released, archived PASS is
// still recognized as "evidence exists on disk" here, exactly as it would be
// pre-archive.
//
// --- Existence is the wrong test; verdict content is the right one -------
// A bare "does `qa_reports/review_<id>.md` exist?" test is not enough:
// gates/qa-review.ts's `recordReviewInFile` writes BOTH PASS and FAIL rounds
// into that exact path, and CREATES the file on a FAIL round — so the very
// server write that records a rejected QA round would manufacture the file
// that silences this detector. A FAIL-only file therefore does not count as
// evidence.
//
// The rule, applied identically to a direct per-id file AND to a file reached
// via a `covers:` line:
//   1. The file contains >= 1 verdict section (the
//      `## <ts> — PASS|FAIL — by <reviewer>` shape recordReviewInFile
//      writes) — the LAST one (recordReviewInFile appends chronologically,
//      so last-wins is "what the QA record currently says") must be PASS.
//   2. The file contains NO verdict section at all — it still counts as
//      evidence. A verdict-less file is, by construction, NOT something the
//      FAIL-record back door can produce (the FAIL path is exactly what
//      writes a verdict section) — it is a hand-authored covering report,
//      the same covering-evidence trust class the MISSING_EVIDENCE gate
//      (gates/qa-review.ts's hasEvidenceInFile) already accepts on existence
//      alone. Requiring more here than that gate requires at completion time
//      would make this detector stricter than the gate it is meant to
//      corroborate, and would resurface false "vibe-coding drift" alarms on
//      already-shipped work carrying exactly the hand-authored reports this
//      codebase sanctions (docs/backlog.md's covering-evidence rows).
//
// Residual trade-off (stated, not hidden): this rule still admits (a) a
// hand-created, zero-byte or prose-only file with no verdict section, and
// (b) a `covers:` line naming an id inside a report that never actually
// judged that id — the content test only inspects the VERDICT shape, not
// whether the covering report's own body is about the id it names. Both are
// the same hand-authored trust class gates/qa-review.ts already extends
// credit to via bare existence; this module does not attempt to close that
// wider gap, only the FAIL-record back door described above (a file the
// SERVER ITSELF wrote as a rejection).
import * as fs from "fs";
import * as path from "path";
import { buildCoverageIndex } from "./evidence-file.js";
// Path hygiene precedent: gates/qa-review.ts:26-28 (evidencePath) uses the
// identical sanitisation. Applied independently here so this module carries
// no import-time coupling to that gate's internals (it is a live gate
// predicate this feature must not touch).
function sanitizeTaskId(taskId) {
    return taskId.replace(/[^A-Za-z0-9._-]/g, "_");
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
function lastVerdict(content) {
    let last = null;
    const re = new RegExp(VERDICT_HEADING_RE.source, "gm"); // fresh lastIndex per call
    let m;
    while ((m = re.exec(content)) !== null) {
        last = m[1];
    }
    return last;
}
// The content test (module header): no verdict section at all → qualifies
// (branch 2, hand-authored trust class); a verdict section exists → only
// qualifies when the LAST one is PASS (branch 1). A FAIL-only file — exactly
// what recordReviewInFile writes on a rejected round — never qualifies.
function evidenceQualifies(content) {
    return lastVerdict(content) !== "FAIL";
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
// Public: for each id in `taskIds`, true when a QUALIFYING QA record (per
// evidenceQualifies above) exists anywhere this module knows to look —
// qa_reports/ root, qa_reports/archive/*/, and the `covers:` fallback in
// both. Never throws: an unreadable or absent qa_reports/ tree yields an
// empty result for every id, never an exception (an id is sanitised before
// any path is built, mirroring gates/qa-review.ts's precedent).
//
// Q1/P1 (round-2 fix): batch signature, mirroring the gates/qa-review.ts:71-78
// hasEvidenceInFile precedent this module's header already named as its
// model — round 1 inverted that shape (per-id, no memoisation), rebuilding
// every archive directory listing and covers: coverage index from scratch on
// EVERY drifted id. This entry point now builds the archive directory list
// once and each covers: coverage index at most once per call, regardless of
// how many ids are checked.
export function hasEvidenceAnywhere(workspacePath, taskIds) {
    const result = new Set();
    if (taskIds.length === 0)
        return result;
    const qaReportsDir = path.join(workspacePath, "qa_reports");
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