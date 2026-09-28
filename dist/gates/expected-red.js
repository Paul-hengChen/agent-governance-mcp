// Coded by @sr-engineer
// Expected-Red Diff gate predicates (c15-expected-red-manifest, AC-4). Third
// member of the evidence-existence gate family (MISSING_EVIDENCE /
// MISSING_REVIEW_EVIDENCE): sr-engineer declares intentionally-red tests in a
// feature-scoped plain-text manifest (qa_reports/expected-red_<feature>.txt,
// `<relative test file path> | <exact test name>` per line, blank/`#` lines
// are comments); qa-engineer diffs it against the actual suite run (Phase 0.5,
// skill-qa-engineer) and records the disposition under a `## Expected-Red
// Diff` H2 in qa_reports/review_<id>.md.
//
// Trust boundary (spec AC-4 "Scope of the machine check"): the server checks
// EXISTENCE only — manifest file present (arm), disposition H2 present
// (clear). It never parses the manifest's rows and never runs the test suite;
// diff-content correctness stays with qa-engineer / code-reviewer (AC-2 /
// AC-3), the same division of labor as MISSING_EVIDENCE trusting the review
// file's contents.
//
// Registry linkage: the EXPECTED_RED_DIFF_MISSING hint is emitted at the
// orchestrator emit site via gate("EXPECTED_RED_DIFF_MISSING").hintStatic
// (DR-2 pattern); these predicates return typed results only, so no registry
// import is added here. FILE-MODE ONLY (AC-5): the orchestrator guards the
// call site with `storage instanceof FileHandoffStorage` — SQLite/HTTP mode
// has no qa_reports/ file convention to hang the manifest off of.
import * as fs from "fs";
import * as path from "path";
import { sliceH2Section, buildCoverageIndex } from "../tools/evidence-file.js";
// The H2 heading qa-engineer's Phase 0.5 writes (skill-qa-engineer SOP 2a).
const DISPOSITION_HEADING = "Expected-Red Diff";
function qaReportsDir(workspacePath) {
    return path.join(workspacePath, "qa_reports");
}
// Same sanitiser as gates/visual.ts designFilePath (v3.14.1 hardening):
// replace non-allowed chars AND collapse any resulting `..` run to `_` so a
// hostile feature name never produces a traversal-shaped filename.
export function expectedRedManifestPath(workspacePath, activeFeature) {
    const safe = activeFeature
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .replace(/\.\.+/g, "_");
    return path.join(qaReportsDir(workspacePath), `expected-red_${safe}.txt`);
}
// Mirrors gates/qa-review.ts evidencePath (same directory, same sanitiser).
function reviewPath(workspacePath, taskId) {
    const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
    return path.join(qaReportsDir(workspacePath), `review_${safe}.md`);
}
// Arm check (AC-4 arming polarity, mirrors hasVisualBaselinesInDesign's
// shape): the gate is armed iff the feature's manifest FILE exists. Absence
// means "no expected reds declared" — the gate never fires, zero cost for
// features with no intentional reds (same absence-is-non-blocking polarity as
// external_refs / dispatch_pins, c9/c14 precedent). Returns the resolved path
// so the emit site can cite it in the error text.
export function hasExpectedRedManifest(workspacePath, activeFeature) {
    const manifestPath = expectedRedManifestPath(workspacePath, activeFeature);
    if (!activeFeature)
        return { present: false, manifestPath };
    return { present: fs.existsSync(manifestPath), manifestPath };
}
// Disposition check (AC-4): true iff AT LEAST ONE candidate review file for
// the ids being PASS'd contains a `## Expected-Red Diff` H2. Candidates per
// id: the direct qa_reports/review_<id>.md; else — lazily, on the first
// direct-file miss only (the hasEvidenceInFile precedent) — the file covering
// the id via the c3 `covers:` label-line index. "At least one across all
// ids" (not per-id): QA runs ONE suite-wide diff per round because the
// manifest is feature-scoped, so one recorded disposition covers every id in
// the round — a per-id requirement would force QA to duplicate the same diff
// N times. Never throws (fs errors → file skipped).
export function hasExpectedRedDisposition(workspacePath, taskIds) {
    let coverage = null;
    const checked = new Set();
    for (const id of taskIds) {
        const direct = reviewPath(workspacePath, id);
        let candidate = null;
        if (fs.existsSync(direct)) {
            candidate = direct;
        }
        else {
            if (coverage === null)
                coverage = buildCoverageIndex(qaReportsDir(workspacePath));
            const covering = coverage.get(id);
            if (covering !== undefined) {
                candidate = path.join(qaReportsDir(workspacePath), covering);
            }
        }
        if (candidate === null || checked.has(candidate))
            continue;
        checked.add(candidate);
        let content;
        try {
            content = fs.readFileSync(candidate, "utf-8");
        }
        catch {
            continue;
        }
        if (sliceH2Section(content, DISPOSITION_HEADING) !== null) {
            return { present: true };
        }
    }
    return { present: false };
}
//# sourceMappingURL=expected-red.js.map