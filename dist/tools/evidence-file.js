// Coded by @sr-engineer
// Shared markdown/table read plumbing for the gates/ modules (A2 split).
// This file used to be gate-central (15 has*/check*/validate* predicates); as
// of the gate-registry refactor (A10 + A2) those predicates live in per-gate
// modules under gates/ (gates/qa-review.ts, gates/code-review.ts,
// gates/visual.ts, gates/scope-decision.ts, gates/cut-approval.ts). What
// remains here is ONLY the low-level, gate-agnostic parsing plumbing shared by
// the visual sub-gate parsers: H2 section slicing, table-cell splitting, and
// the checkbox / assertion / region-diff / status cell parsers.
//
// This module imports NOTHING from gates/ (the dependency points the other
// way: gates/*.ts import these helpers), keeping the import DAG acyclic.
// Escape a string for literal use inside a RegExp.
function escapeRegex(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
// Slice a markdown H2 section body (heading exclusive) up to the next `## ` or EOF.
export function sliceH2Section(content, heading) {
    const headRe = new RegExp(`^##\\s+${escapeRegex(heading)}\\b[^\\n]*`, "im");
    const m = headRe.exec(content);
    if (!m || m.index === undefined)
        return null;
    const start = m.index + m[0].length;
    const rest = content.slice(start);
    const nextIdx = rest.search(/\n##\s/);
    return nextIdx === -1 ? rest : rest.slice(0, nextIdx);
}
// `- [mark] label` rows → labels whose mark is not x/X (unchecked/unverified).
export function parseUncheckedLabels(section) {
    const lineRe = /^-\s+\[(.)\]\s+(.+)$/gm;
    const unchecked = [];
    let m;
    while ((m = lineRe.exec(section)) !== null) {
        if (m[1] === "x" || m[1] === "X")
            continue;
        const rest = m[2];
        const splitIdx = rest.search(/\s+—\s+|\s+-\s+/);
        unchecked.push((splitIdx === -1 ? rest : rest.slice(0, splitIdx)).trim());
    }
    return unchecked;
}
// Markdown table rows whose LAST cell is the pass/fail result. Returns the
// first-cell ids whose result is not exactly "pass" (case-insensitive): fail,
// blank, or any other token counts as unverified. Header + separator rows skipped.
export function parseAssertionFailures(section) {
    const failures = [];
    for (const line of section.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("|"))
            continue;
        if (/^\|[\s:|-]+\|?$/.test(t))
            continue; // separator row
        const parts = t.split("|");
        if (parts.length && parts[0].trim() === "")
            parts.shift();
        if (parts.length && parts[parts.length - 1].trim() === "")
            parts.pop();
        const cells = parts.map((c) => c.trim());
        if (cells.length < 2)
            continue;
        const id = cells[0];
        if (id === "" || /assertion\s*id/i.test(id))
            continue; // header row
        const result = cells[cells.length - 1].toLowerCase();
        if (result !== "pass")
            failures.push(id);
    }
    return failures;
}
// Region Diff rows `| surface | result |` where result ∈ {pass, accepted}.
// Anything else (fail, material, unresolved, blank, drift) is a failure.
// "accepted" is allowed because a difference qa-visual deliberately accepts is
// recorded in `## Allowed Differences`; here it signals "diff exists but cleared".
export function parseRegionDiffFailures(section) {
    const failures = [];
    for (const line of section.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("|"))
            continue;
        if (/^\|[\s:|-]+\|?$/.test(t))
            continue;
        const parts = t.split("|");
        if (parts.length && parts[0].trim() === "")
            parts.shift();
        if (parts.length && parts[parts.length - 1].trim() === "")
            parts.pop();
        const cells = parts.map((c) => c.trim());
        if (cells.length < 2)
            continue;
        const id = cells[0];
        if (id === "" || /surface(\s*id)?/i.test(id))
            continue; // header row
        const result = cells[cells.length - 1].toLowerCase();
        if (result !== "pass" && result !== "accepted")
            failures.push(id);
    }
    return failures;
}
// Split a markdown table line into trimmed cells, dropping the leading/trailing
// empty cells produced by the outer pipes. Mirrors the proven cell-splitting in
// parseAssertionFailures / parseRegionDiffFailures.
export function splitTableCells(line) {
    const parts = line.split("|");
    if (parts.length && parts[0].trim() === "")
        parts.shift();
    if (parts.length && parts[parts.length - 1].trim() === "")
        parts.pop();
    return parts.map((c) => c.trim());
}
// Normalize a raw status cell to a canonical token (substring-tolerant, so
// `audited ✅` / `audited (frozen)` still count). Empty → "unknown".
export function normalizeStatus(rawCell) {
    const lc = rawCell.toLowerCase().replace(/`/g, "").trim();
    if (lc === "")
        return "unknown";
    if (lc.includes("audited"))
        return "audited";
    if (lc.includes("defer"))
        return "deferred";
    if (lc.includes("out-of-scope") || lc.includes("out of scope"))
        return "out-of-scope";
    return lc;
}
//# sourceMappingURL=evidence-file.js.map