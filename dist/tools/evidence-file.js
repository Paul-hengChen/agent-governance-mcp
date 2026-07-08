// Coded by @sr-engineer
// Shared markdown/table read plumbing for the gates/ modules (A2 split).
// This file used to be gate-central (15 has*/check*/validate* predicates); as
// of the gate-registry refactor (A10 + A2) those predicates live in per-gate
// modules under gates/ (gates/qa-review.ts, gates/code-review.ts,
// gates/visual.ts, gates/scope-decision.ts, gates/cut-approval.ts). What
// remains here is ONLY the low-level, gate-agnostic parsing plumbing shared by
// the visual sub-gate parsers: H2 section slicing, table-cell splitting, and
// the checkbox / assertion / region-diff / status cell parsers — plus the
// `covers:` label-line coverage plumbing (c3-covering-evidence) consumed by
// gates/qa-review.ts and gates/code-review.ts.
//
// This module imports NOTHING from gates/ (the dependency points the other
// way: gates/*.ts import these helpers), keeping the import DAG acyclic.
import * as fs from "fs";
import * as path from "path";
// ---------- c3-covering-evidence — `covers:` label-line plumbing ----------
// One real review file may declare `covers: <id1>, <id2>, ...` to satisfy the
// evidence gates (MISSING_EVIDENCE / MISSING_REVIEW_EVIDENCE) for a batched
// round, instead of N-1 one-line pointer stubs. File-mode only; the SQLite
// hasEvidence / hasCodeReviewEvidence paths are untouched (they already record
// one `reports` row per id). Gate-agnostic: the directory to scan is supplied
// by the caller (gates/qa-review.ts → qa_reports/, gates/code-review.ts →
// review_reports/); this module stays free of any gate knowledge.
// Permissive label-line regex, mirroring the visual gate's BASELINE_LINE_RE /
// DIFF_METRIC_LINE_RE style: optional leading bullet (`-`/`*`), optional
// surrounding markdown bold (`**`), case-insensitive `covers` label, `:`/`—`/`-`
// separator, capture the remainder of the line. A bare `covers:` with no value
// does not match (capture requires >= 1 char), so an empty label yields no ids
// (AC-5).
export const COVERS_LINE_RE = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?covers(?:[^\S\n]*\*\*)?[^\S\n]*[:—-][^\S\n]*([^\n]+?)[^\S\n]*$/im;
// Pure parser (no I/O, never throws). Extracts the id list from the FIRST
// `covers:` line in `content`. Splits on comma/whitespace, strips surrounding
// backticks/brackets and residual emphasis per token, drops empties. Returns
// [] when the label is absent or its value is empty/whitespace (AC-5).
export function parseCoversIds(content) {
    if (!content)
        return [];
    const m = COVERS_LINE_RE.exec(content);
    if (!m)
        return [];
    return m[1]
        .split(/[,\s]+/)
        .map((t) => t.replace(/^[`[\]()<>*_]+|[`[\]()<>*_]+$/g, "").trim())
        .filter((t) => t.length > 0);
}
// Scans every `*.md` file in `dir` for a `covers:` line and returns a
// first-seen-wins `coveredId -> filename` map. Directory listing is sorted so
// "first seen" is deterministic across platforms. Never throws: an unreadable
// directory returns an empty map; unreadable files are skipped. Callers invoke
// this LAZILY — only when a requested id's direct per-id file is missing — so
// the common single-task path (every id has its own file) never pays the scan.
export function buildCoverageIndex(dir) {
    const index = new Map();
    let entries;
    try {
        entries = fs.readdirSync(dir);
    }
    catch {
        return index;
    }
    for (const name of [...entries].sort()) {
        if (!name.toLowerCase().endsWith(".md"))
            continue;
        let content;
        try {
            content = fs.readFileSync(path.join(dir, name), "utf-8");
        }
        catch {
            continue;
        }
        for (const id of parseCoversIds(content)) {
            if (!index.has(id))
                index.set(id, name);
        }
    }
    return index;
}
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