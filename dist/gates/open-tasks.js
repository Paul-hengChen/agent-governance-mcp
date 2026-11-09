// Coded by @sr-engineer
// Open-task check for a final QA sign-off: which rows of the active feature's
// own task ledger are still open and not yet signed off.
// Spec: specs/e247-qa-pass-unticked-gate.md (Terms, D1-D3, D8).
import * as path from "path";
import { findTasksFile } from "../tools/config.js";
// Rows of roles that act after the sign-off (release, docs) never count as open:
// their work cannot exist yet. Anchored role prefix after an optional [Pn] tag.
const POST_PASS_ROW_RE = /^(?:\[P\d\]\s+)?(?:release-engineer|doc-writer)(?=[\s:(]|$)/;
const DORMANT = { armed: false, ledgerPath: null };
/**
 * Resolves the feature's own lane ledger. Armed only when it sits directly in
 * `.current/<L>/`, `<L>` is not `_`-prefixed, and the lowercased feature is `<L>`
 * or starts with `<L>-`; any other ledger leaves the check off. Read-only.
 */
export function featureLaneLedger(workspacePath, activeFeature) {
    const ledgerPath = findTasksFile(workspacePath);
    if (!ledgerPath)
        return DORMANT;
    const rel = path.relative(path.resolve(workspacePath, ".current"), path.resolve(ledgerPath));
    const segs = rel.split(path.sep);
    if (path.isAbsolute(rel) || segs.length !== 2 || segs[0] === ".." || segs[0] === "")
        return DORMANT;
    const lane = segs[0];
    if (lane.startsWith("_"))
        return DORMANT;
    const feature = activeFeature.toLowerCase();
    if (feature !== lane && !feature.startsWith(`${lane}-`))
        return DORMANT;
    return { armed: true, ledgerPath };
}
/**
 * Lists the ids of open rows not in `completedIds`, once each, in ledger order,
 * skipping post-sign-off role rows. Pure.
 */
export function listOpenFeatureTasks(tasks, completedIds) {
    const open = [];
    const seen = new Set();
    for (const t of tasks) {
        if (t.completed || completedIds.has(t.id) || seen.has(t.id))
            continue;
        if (POST_PASS_ROW_RE.test(t.description))
            continue;
        seen.add(t.id);
        open.push(t.id);
    }
    return open;
}
//# sourceMappingURL=open-tasks.js.map