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
// ---------- visual evidence (v3.14.0) ----------
// Constitution §3.1 visual evidence gate: when `design/<active_feature>.md`
// contains a `## Visual Baselines` H2, PASS additionally requires
// `qa_reports/visual_<task-id>.md` for every task id in the round.
function visualEvidencePath(workspacePath, taskId) {
    const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
    return path.join(workspacePath, "qa_reports", `visual_${safe}.md`);
}
function designFilePath(workspacePath, activeFeature) {
    // v3.14.1 — sanitiser hardening: replace non-allowed chars AND collapse any
    // resulting `..` to `_` so a hostile feature name like `..feat` or `pp..pp`
    // never produces a path with `..` segments. The earlier v3.14.0 sanitiser
    // already replaced `/` with `_` (so `../etc/passwd` collapsed to
    // `.._etc_passwd`, blocking traversal), but the literal `..` survived as a
    // filename. This pass closes the cosmetic / surprising-behaviour gap.
    const safe = activeFeature
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .replace(/\.\.+/g, "_");
    return path.join(workspacePath, "design", `${safe}.md`);
}
// Detects whether the workspace's design file declares any Visual Baselines.
// Returns existence + the resolved path so callers can include the path in
// error hints. Reads the file once per call (no caching — design files are
// small and PASS attempts are infrequent enough that fs cost is negligible).
// Match is permissive: any H2 line beginning with `## Visual Baselines`
// (case-insensitive, optional trailing text) triggers the gate.
export function hasVisualBaselinesInDesign(workspacePath, activeFeature) {
    const designPath = designFilePath(workspacePath, activeFeature);
    if (!activeFeature || !fs.existsSync(designPath)) {
        return { present: false, designPath };
    }
    try {
        const content = fs.readFileSync(designPath, "utf-8");
        const hasBaselines = /^##\s+Visual\s+Baselines\b/im.test(content);
        return { present: hasBaselines, designPath };
    }
    catch {
        return { present: false, designPath };
    }
}
// v3.16.0 — Visual gate self-arming signal (visual-fidelity-gate-hardening, AC-1).
// Moves the arm-condition off "## Visual Baselines present" and onto
// "design file exists AND mode != no-design". Returns the parsed mode for
// error-context. Parallels hasVisualBaselinesInDesign: reuses designFilePath,
// reads once, never throws (fs errors → {required:false}).
export function hasDesignModeRequiringVisual(workspacePath, activeFeature) {
    const designPath = designFilePath(workspacePath, activeFeature);
    if (!activeFeature || !fs.existsSync(designPath)) {
        return { required: false, mode: null, designPath };
    }
    try {
        const content = fs.readFileSync(designPath, "utf-8");
        const mode = parseDesignMode(content); // null if no Mode line found
        // Locked Q-OQ1: arm for every mode except no-design. Encoded as an
        // EXCLUSION (not an allow-list) so future modes auto-arm — see D3.
        const required = mode !== null && mode !== "no-design";
        return { required, mode, designPath };
    }
    catch {
        return { required: false, mode: null, designPath };
    }
}
// Permissive Mode extractor. Accepts BOTH the H2-section style
// (`## Mode` heading, value on a following line) AND the inline/bullet style
// (`**Mode** — <value>` or `mode: <value>`). Returns the first token that
// matches a known mode enum value, lowercased; null if none found. Tolerant of
// surrounding markdown (backticks, bold, em-dash) per design-auditor template.
const KNOWN_MODES = ["figma", "sketch", "xd", "penpot", "pdf", "image", "paper", "no-design"];
function parseDesignMode(content) {
    // 1. Inline form: `mode: no-design` (no-design fast path, design-auditor L14)
    //    or `**Mode** — figma` (bullet form, L20). Scan the whole doc for the
    //    FIRST line carrying a Mode declaration, then pull the first known-mode
    //    token from it (handles backtick-wrapped values like `figma`).
    const lineRe = /^\s*(?:[-*]\s*)?(?:\*\*\s*mode\s*\*\*|mode)\s*(?:[—:-])\s*(.+)$/im;
    // 2. H2 form: `## Mode` then value on next content line.
    const h2Re = /^##\s+Mode\b[^\n]*\n+\s*(?:[-*]\s*)?(.+)$/im;
    const candidates = [];
    const mInline = lineRe.exec(content);
    if (mInline)
        candidates.push(mInline[1]);
    const mH2 = h2Re.exec(content);
    if (mH2)
        candidates.push(mH2[1]);
    for (const raw of candidates) {
        const lc = raw.toLowerCase();
        for (const mode of KNOWN_MODES) {
            // word-boundary-ish: `no-design` must win over `design`; check longest first
            // (KNOWN_MODES has no overlap risk except substring `design`, which is not
            // a listed mode, so first-match over the enum is safe).
            if (new RegExp(`\\b${mode.replace(/[-]/g, "\\-")}\\b`).test(lc)) {
                return mode;
            }
        }
    }
    return null;
}
// Per-task existence check for `qa_reports/visual_<task-id>.md`.
// Mirror of hasEvidenceInFile / hasCodeReviewEvidenceInFile — existence is
// sufficient; the qa-engineer + skill-qa-visual SOP enforce the contents
// (widget shape checklist, pixel diff sections). Server does NOT parse.
export function hasVisualEvidenceInFile(workspacePath, taskIds) {
    const present = [];
    const missing = [];
    for (const id of taskIds) {
        if (fs.existsSync(visualEvidencePath(workspacePath, id))) {
            present.push(id);
        }
        else {
            missing.push(id);
        }
    }
    return { present, missing };
}
// ---------- v3.30.0 — Scope Decision Gate (server-scope-decision-gate) ----------
// Constitution §3 scope-decision gate: when design/<feature>.md declares
// mode != no-design, a transition INTO build (architect/sr-engineer:In_Progress)
// from pm:In_Progress requires a recorded scope decision. This helper reports
// whether EITHER satisfying artifact is present:
//   (a) .current/feature-split.md exists (multi-feature split recorded), OR
//   (b) handoff field scope_decision === "single-feature" (attestation recorded).
// Existence/equality only — never parses file content (mirrors hasEvidenceInFile
// and the "existence is sufficient" convention). Never throws. The handoffState
// is the already-parsed PREV state (the attestation must have been recorded by
// the preceding pm:In_Progress write), so this does NOT re-read handoff.md.
export function hasScopeDecision(workspacePath, handoffState) {
    const splitPath = path.join(workspacePath, ".current", "feature-split.md");
    if (fs.existsSync(splitPath))
        return true;
    return handoffState?.scope_decision === "single-feature";
}
// Pure parser. Locates the `## Widget Shape Verification` section
// (case-insensitive, multiline) in the report content and emits one row per
// `- [<mark>] <widget-id>` line found within it. Permissive on whitespace;
// case-sensitive on bracket content ([x] or [X] = checked; [ ] / [Y] /
// [garbage] = unchecked, catching operator typos rather than silently
// accepting them).
export function parseVisualWidgetsChecklist(visualReportContent) {
    if (!visualReportContent)
        return [];
    // Find the section heading. JS regex has no `\Z` (end-of-string) anchor,
    // so locate the heading then slice manually to the next `## ` heading
    // (or EOF). Mirrors the existing extractSectionContent pattern in
    // tools/handoff.ts.
    const headRe = /^##\s+Widget\s+Shape\s+Verification\b[^\n]*/im;
    const headMatch = headRe.exec(visualReportContent);
    if (!headMatch || headMatch.index === undefined)
        return [];
    const startIdx = headMatch.index + headMatch[0].length;
    const restAfter = visualReportContent.slice(startIdx);
    const nextHeadingIdx = restAfter.search(/\n##\s/);
    const sectionBody = nextHeadingIdx === -1 ? restAfter : restAfter.slice(0, nextHeadingIdx);
    const lineRe = /^-\s+\[(.)\]\s+(.+)$/gm;
    const rows = [];
    let m;
    while ((m = lineRe.exec(sectionBody)) !== null) {
        const mark = m[1];
        const rest = m[2];
        const checked = mark === "x" || mark === "X";
        // Split widget-id from optional description at the first em-dash or
        // hyphen separator. Falls back to the full remainder if no separator
        // is found (operator wrote just the widget id with no description).
        const splitIdx = rest.search(/\s+—\s+|\s+-\s+/);
        const widgetId = (splitIdx === -1 ? rest : rest.slice(0, splitIdx)).trim();
        rows.push({ widgetId, checked, rawLine: m[0] });
    }
    return rows;
}
// Composition helper. For each task id, reads visual_<id>.md (if present),
// parses the checklist, and collects unchecked widget ids. Missing files
// are silently skipped — the index.ts handler calls `hasVisualEvidenceInFile`
// FIRST and only routes surviving ids here, so this function is unreachable
// for missing-file cases in production. The skip is a defensive belt for
// callers that don't follow that ordering.
export function hasUncheckedWidgets(workspacePath, taskIds) {
    const uncheckedByTaskId = {};
    for (const id of taskIds) {
        const filePath = visualEvidencePath(workspacePath, id);
        if (!fs.existsSync(filePath))
            continue;
        let content;
        try {
            content = fs.readFileSync(filePath, "utf-8");
        }
        catch {
            continue;
        }
        const rows = parseVisualWidgetsChecklist(content);
        const unchecked = rows.filter((r) => !r.checked).map((r) => r.widgetId);
        if (unchecked.length > 0) {
            uncheckedByTaskId[id] = unchecked;
        }
    }
    return {
        ok: Object.keys(uncheckedByTaskId).length === 0,
        uncheckedByTaskId,
    };
}
// ---------- v3.26.0 — Visual report schema validation ----------
// Constitution §3.2 + skill-qa-visual report schema. The pre-v3.26 gate checked
// only file existence + unchecked widget rows; the CDE-OOBE false-PASS showed
// "evidence exists" != "evidence is meaningful". This validator parses the
// required sections and rejects PASS on: a missing required section, any
// failed/unverified canonical-state row, any failed/unverified structural
// assertion, or a non-PASS verdict.
//
// Authorship note (R1): `## Allowed Differences` is qa-owned BY CONSTRUCTION —
// the visual report is consulted only on a qa-engineer PASS, so its contents are
// already within qa authority. The coordinator override that broke CDE-OOBE
// happened via the dispatch PROMPT (now blocked by Constitution §3.2 +
// skill-coordinator), NOT by writing this file. We therefore do NOT keyword-sniff
// for "coordinator policy" markers (brittle / gameable).
//
// Backwards-compat: strictness is OPT-IN via the design contract. The caller
// applies this validator only when the design file declares
// `## Visual Structural Assertions` (a v3.26 design-auditor always emits it for
// mode != no-design). Pre-v3.26 designs lack that section → old visual reports
// keep passing on the existence + widget-shape gate alone.
const REQUIRED_VISUAL_SECTIONS = [
    "Widget Shape Verification",
    "Canonical State Verification",
    "Structural Assertions",
    "Region Diff",
    "Allowed Differences",
    "Verdict",
];
function escapeRegex(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
// Slice a markdown H2 section body (heading exclusive) up to the next `## ` or EOF.
function sliceH2Section(content, heading) {
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
function parseUncheckedLabels(section) {
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
function parseAssertionFailures(section) {
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
function parseRegionDiffFailures(section) {
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
// Verdict gate (HARD): the verdict's value must normalize to exactly PASS.
// Guards against `\bPASS\b`-anywhere false positives like "NOT PASS",
// "PASS blocked", "not ready to PASS". Reads the trailing value of the
// `## Verdict — <value>` heading, else the first non-empty body line.
function verdictIsPass(content) {
    const head = /^##\s+Verdict\b[^\n]*/im.exec(content);
    const body = sliceH2Section(content, "Verdict");
    let text = "";
    if (head) {
        text = head[0].replace(/^##\s+Verdict\b/i, "").replace(/^[\s—:–-]+/, "").trim();
    }
    if (!text && body !== null) {
        const firstLine = body.split("\n").map((s) => s.trim()).find((s) => s.length > 0) ?? "";
        text = firstLine.replace(/^[-*]\s*/, "").replace(/^[\s—:–-]+/, "").trim();
    }
    if (!text)
        return false;
    // Any explicit negation/failure token anywhere in the verdict value → not pass.
    if (/\b(not|fail|failed|blocked?|changes?\s*requested|incomplete|pending)\b/i.test(text)) {
        return false;
    }
    // First alphabetic token must be exactly PASS.
    const firstToken = (text.match(/[A-Za-z]+/)?.[0] ?? "").toUpperCase();
    return firstToken === "PASS";
}
// Pure validator over a single visual report's content.
export function validateVisualReport(content) {
    const missingSections = [];
    for (const sec of REQUIRED_VISUAL_SECTIONS) {
        if (sliceH2Section(content, sec) === null)
            missingSections.push(sec);
    }
    const canonical = sliceH2Section(content, "Canonical State Verification");
    const failedCanonicalStates = canonical ? parseUncheckedLabels(canonical) : [];
    const structural = sliceH2Section(content, "Structural Assertions");
    const failedStructuralAssertions = structural ? parseAssertionFailures(structural) : [];
    const region = sliceH2Section(content, "Region Diff");
    const failedRegionDiffs = region ? parseRegionDiffFailures(region) : [];
    const verdictPass = verdictIsPass(content);
    const ok = missingSections.length === 0 &&
        failedCanonicalStates.length === 0 &&
        failedStructuralAssertions.length === 0 &&
        failedRegionDiffs.length === 0 &&
        verdictPass;
    return {
        ok,
        missingSections,
        failedCanonicalStates,
        failedStructuralAssertions,
        failedRegionDiffs,
        verdictPass,
    };
}
// True when the design file declares a `## Visual Structural Assertions` section
// (the v3.26 signal that the workspace is on the structured-visual contract).
// Gates strict report validation so pre-v3.26 workspaces stay backwards-compatible.
export function designDeclaresStructuralAssertions(workspacePath, activeFeature) {
    const designPath = designFilePath(workspacePath, activeFeature);
    if (!activeFeature || !fs.existsSync(designPath))
        return false;
    try {
        const content = fs.readFileSync(designPath, "utf-8");
        return /^##\s+Visual\s+Structural\s+Assertions\b/im.test(content);
    }
    catch {
        return false;
    }
}
// Composition helper. Validates each present visual_<id>.md against the v3.26
// schema. Missing files are skipped (existence is enforced upstream by
// hasVisualEvidenceInFile). Returns the failing task ids with their detail.
export function validateVisualReports(workspacePath, taskIds) {
    const byTaskId = {};
    for (const id of taskIds) {
        const filePath = visualEvidencePath(workspacePath, id);
        if (!fs.existsSync(filePath))
            continue;
        let content;
        try {
            content = fs.readFileSync(filePath, "utf-8");
        }
        catch {
            continue;
        }
        const v = validateVisualReport(content);
        if (!v.ok)
            byTaskId[id] = v;
    }
    return { ok: Object.keys(byTaskId).length === 0, byTaskId };
}
// Verbatim tokens from spec Copy/Strings — AC-3/AC-4 require exact-substring match.
const CARRY_FORWARD_TOKEN = "pass (carried forward — git diff confirms source untouched)";
const B1_UNAVAILABLE_TOKEN = "B1 tool unavailable — LLM fallback";
// Placeholder values that must NOT satisfy the non-empty fingerprint test (D1).
// Lowercased compare; the empty string is included so a bare `baseline:` fails.
const FINGERPRINT_PLACEHOLDERS = new Set(["<fingerprint>", "todo", "tbd", "n/a", "none", "-", ""]);
// Permissive label-line regexes (D1 parse contract): optional leading bullet
// (`-`/`*`), optional surrounding markdown bold (`**`), case-insensitive label,
// `:`/`—`/`-` separator, capture the remainder. `m` for per-line, `i` for case.
const BASELINE_LINE_RE = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?baseline(?:[^\S\n]*\*\*)?[^\S\n]*[:—-][^\S\n]*([^\n]+?)[^\S\n]*$/im;
const DIFF_METRIC_LINE_RE = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?diff-metric(?:[^\S\n]*\*\*)?[^\S\n]*[:—-][^\S\n]*([^\n]+?)[^\S\n]*$/im;
// Pure parser (AC-9 — no I/O, never throws). Returns one row per per-surface
// prose sub-section (a `### `..`###### ` heading) under `## Region Diff`. The
// surface id is the sub-heading text (backtick-stripped). The table rows
// `| surface | result |` are NOT used here — they are parsed by
// parseRegionDiffFailures for pass/fail; provenance lives only in the prose.
export function parseVisualProvenanceRows(content) {
    if (!content)
        return [];
    const section = sliceH2Section(content, "Region Diff");
    if (section === null)
        return [];
    // Split the Region-Diff body into blocks on sub-headings (### .. ######).
    const headRe = /^(#{3,6})\s+(.+?)\s*$/gm;
    const heads = [];
    let hm;
    while ((hm = headRe.exec(section)) !== null) {
        const surfaceId = hm[2].replace(/`/g, "").trim();
        heads.push({ surfaceId, bodyStart: hm.index + hm[0].length });
    }
    const rows = [];
    for (let i = 0; i < heads.length; i++) {
        const start = heads[i].bodyStart;
        const end = i + 1 < heads.length
            ? section.slice(start).search(/^#{3,6}\s+/m)
            : -1;
        const body = end === -1 ? section.slice(start) : section.slice(start, start + end);
        const isCarryForward = body.includes(CARRY_FORWARD_TOKEN);
        const isFallback = body.includes(B1_UNAVAILABLE_TOKEN);
        let fingerprint = null;
        const bm = BASELINE_LINE_RE.exec(body);
        if (bm) {
            // Strip backticks + any residual surrounding emphasis (`**`/`*`/`_`) the
            // label-line regex leaves on the value for the `**baseline:**` (closing
            // emphasis after the colon) variant, so the fingerprint is the bare token.
            const raw = bm[1].replace(/`/g, "").replace(/^[*_]+|[*_]+$/g, "").trim();
            if (raw && !FINGERPRINT_PLACEHOLDERS.has(raw.toLowerCase())) {
                fingerprint = raw;
            }
        }
        let diffMetric = null;
        const dm = DIFF_METRIC_LINE_RE.exec(body);
        if (dm) {
            const raw = dm[1].replace(/^[*_]+|[*_]+$/g, "").trim();
            if (raw)
                diffMetric = raw;
        }
        rows.push({ surfaceId: heads[i].surfaceId, fingerprint, diffMetric, isCarryForward, isFallback });
    }
    return rows;
}
// Composition helper (fs). Mirrors validateVisualReports. For each task id, reads
// visual_<id>.md (skips if absent — existence is enforced upstream by
// hasVisualEvidenceInFile), parses the provenance rows, and applies the gate.
//
// Opt-in (D2): a report with NO non-null fingerprint anywhere is legacy /
// pre-provenance — it contributes no offenses (the gate is dormant for it). Once
// any surface declares a real `baseline:`, the whole report opts into strict mode
// and EVERY non-carry-forward surface must carry both a fingerprint (AC-1) and a
// diff metric OR the B1-fallback token (AC-2 + AC-4). Carry-forward surfaces are
// exempt from both (AC-3).
export function checkVisualProvenance(workspacePath, taskIds) {
    const offendingByTaskId = {};
    for (const id of taskIds) {
        const filePath = visualEvidencePath(workspacePath, id);
        if (!fs.existsSync(filePath))
            continue;
        let content;
        try {
            content = fs.readFileSync(filePath, "utf-8");
        }
        catch {
            continue;
        }
        const rows = parseVisualProvenanceRows(content);
        // D2 opt-in: dormant unless the report declares at least one baseline.
        if (!rows.some((r) => r.fingerprint !== null))
            continue;
        const offenses = [];
        for (const row of rows) {
            if (row.isCarryForward)
                continue; // AC-3 — exempt
            if (row.fingerprint === null) {
                offenses.push(`${row.surfaceId}: no baseline:`);
                continue;
            }
            // AC-2 + AC-4: a real diff metric OR the B1-fallback token satisfies it.
            if (row.diffMetric === null && !row.isFallback) {
                offenses.push(`${row.surfaceId}: no diff-metric:`);
            }
        }
        if (offenses.length > 0)
            offendingByTaskId[id] = offenses;
    }
    return { ok: Object.keys(offendingByTaskId).length === 0, offendingByTaskId };
}
//# sourceMappingURL=evidence-file.js.map