// Coded by @sr-engineer
// Visual sub-gate predicates (A2 split — verbatim relocation from
// tools/evidence-file.ts, no behavior change). Home of all seven visual
// sub-gate checks (baselines arm, evidence existence, widget-shape, schema,
// provenance, baseline-manifest, pixel-gate attestation) plus the design-mode
// arm signal consumed by prompts/build.ts.
//
// Shared low-level plumbing (section slicing, table/checkbox cell parsers)
// stays in tools/evidence-file.ts and is imported below — per the A2 decision
// rule, those helpers are kept generic so this module does not become a util
// dump.
//
// Registry linkage: the visual sub-gate hints are emitted at the orchestrator
// emit sites via gate("VISUAL_*"/"BASELINE_*"/"PIXEL_*").hintStatic (DR-2).
// These predicates return typed check results only, so no registry import is
// added here (the verbatim move keeps behavior byte-identical).

import * as fs from "fs";
import * as path from "path";
import {
  sliceH2Section,
  splitTableCells,
  parseUncheckedLabels,
  parseAssertionFailures,
  parseRegionDiffFailures,
  normalizeStatus,
} from "../tools/evidence-file.js";

// ---------- visual evidence (v3.14.0) ----------
// Constitution §3.1 visual evidence gate: when `design/<active_feature>.md`
// contains a `## Visual Baselines` H2, PASS additionally requires
// `qa_reports/visual_<task-id>.md` for every task id in the round.

function visualEvidencePath(workspacePath: string, taskId: string): string {
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(workspacePath, "qa_reports", `visual_${safe}.md`);
}

// Relocated from tools/evidence-file.ts (single consumer: this module — all its
// callers live here). Per the A2 shared-helper placement rule, a single-consumer
// path helper co-locates with its gate module.
function designFilePath(workspacePath: string, activeFeature: string): string {
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
export function hasVisualBaselinesInDesign(
  workspacePath: string,
  activeFeature: string,
): { present: boolean; designPath: string } {
  const designPath = designFilePath(workspacePath, activeFeature);
  if (!activeFeature || !fs.existsSync(designPath)) {
    return { present: false, designPath };
  }
  try {
    const content = fs.readFileSync(designPath, "utf-8");
    const hasBaselines = /^##\s+Visual\s+Baselines\b/im.test(content);
    return { present: hasBaselines, designPath };
  } catch {
    return { present: false, designPath };
  }
}

// v3.16.0 — Visual gate self-arming signal (visual-fidelity-gate-hardening, AC-1).
// Moves the arm-condition off "## Visual Baselines present" and onto
// "design file exists AND mode != no-design". Returns the parsed mode for
// error-context. Parallels hasVisualBaselinesInDesign: reuses designFilePath,
// reads once, never throws (fs errors → {required:false}).
export function hasDesignModeRequiringVisual(
  workspacePath: string,
  activeFeature: string,
): { required: boolean; mode: string | null; designPath: string } {
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
  } catch {
    return { required: false, mode: null, designPath };
  }
}

// Permissive Mode extractor. Accepts BOTH the H2-section style
// (`## Mode` heading, value on a following line) AND the inline/bullet style
// (`**Mode** — <value>` or `mode: <value>`). Returns the first token that
// matches a known mode enum value, lowercased; null if none found. Tolerant of
// surrounding markdown (backticks, bold, em-dash) per design-auditor template.
const KNOWN_MODES = ["figma", "sketch", "xd", "penpot", "pdf", "image", "paper", "no-design"] as const;

function parseDesignMode(content: string): string | null {
  // 1. Inline form: `mode: no-design` (no-design fast path, design-auditor L14)
  //    or `**Mode** — figma` (bullet form, L20). Scan the whole doc for the
  //    FIRST line carrying a Mode declaration, then pull the first known-mode
  //    token from it (handles backtick-wrapped values like `figma`).
  const lineRe = /^\s*(?:[-*]\s*)?(?:\*\*\s*mode\s*\*\*|mode)\s*(?:[—:-])\s*(.+)$/im;
  // 2. H2 form: `## Mode` then value on next content line.
  const h2Re = /^##\s+Mode\b[^\n]*\n+\s*(?:[-*]\s*)?(.+)$/im;

  const candidates: string[] = [];
  const mInline = lineRe.exec(content);
  if (mInline) candidates.push(mInline[1]);
  const mH2 = h2Re.exec(content);
  if (mH2) candidates.push(mH2[1]);

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
export function hasVisualEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const id of taskIds) {
    if (fs.existsSync(visualEvidencePath(workspacePath, id))) {
      present.push(id);
    } else {
      missing.push(id);
    }
  }
  return { present, missing };
}

// ---------- v3.15.0 — Widget Shape Verification checkbox parsing ----------
// Activates the R6 gate that v3.14.0 architecture §A reserved
// (`VISUAL_WIDGETS_UNVERIFIED` error code). Server reads visual_<id>.md,
// finds the `## Widget Shape Verification` H2, parses each
// `- [<mark>] <widget-id> — <description>` row, and reports unchecked rows
// per task. Missing section → no claim → gate passes (backwards-compat with
// v3.14.0 visual reports that didn't have this section).

export interface VisualWidgetRow {
  widgetId: string;
  checked: boolean;
  rawLine: string;
}

// Pure parser. Locates the `## Widget Shape Verification` section
// (case-insensitive, multiline) in the report content and emits one row per
// `- [<mark>] <widget-id>` line found within it. Permissive on whitespace;
// case-sensitive on bracket content ([x] or [X] = checked; [ ] / [Y] /
// [garbage] = unchecked, catching operator typos rather than silently
// accepting them).
export function parseVisualWidgetsChecklist(
  visualReportContent: string,
): VisualWidgetRow[] {
  if (!visualReportContent) return [];
  // Find the section heading. JS regex has no `\Z` (end-of-string) anchor,
  // so locate the heading then slice manually to the next `## ` heading
  // (or EOF). Mirrors the existing extractSectionContent pattern in
  // tools/handoff.ts.
  const headRe = /^##\s+Widget\s+Shape\s+Verification\b[^\n]*/im;
  const headMatch = headRe.exec(visualReportContent);
  if (!headMatch || headMatch.index === undefined) return [];
  const startIdx = headMatch.index + headMatch[0].length;
  const restAfter = visualReportContent.slice(startIdx);
  const nextHeadingIdx = restAfter.search(/\n##\s/);
  const sectionBody = nextHeadingIdx === -1 ? restAfter : restAfter.slice(0, nextHeadingIdx);

  const lineRe = /^-\s+\[(.)\]\s+(.+)$/gm;
  const rows: VisualWidgetRow[] = [];
  let m: RegExpExecArray | null;
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

export interface UncheckedWidgetsCheck {
  ok: boolean;
  uncheckedByTaskId: Record<string, string[]>;
}

// Composition helper. For each task id, reads visual_<id>.md (if present),
// parses the checklist, and collects unchecked widget ids. Missing files
// are silently skipped — the index.ts handler calls `hasVisualEvidenceInFile`
// FIRST and only routes surviving ids here, so this function is unreachable
// for missing-file cases in production. The skip is a defensive belt for
// callers that don't follow that ordering.
export function hasUncheckedWidgets(
  workspacePath: string,
  taskIds: string[],
): UncheckedWidgetsCheck {
  const uncheckedByTaskId: Record<string, string[]> = {};
  for (const id of taskIds) {
    const filePath = visualEvidencePath(workspacePath, id);
    if (!fs.existsSync(filePath)) continue;
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
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
] as const;

// Verdict gate (HARD): the verdict's value must normalize to exactly PASS.
// Guards against `\bPASS\b`-anywhere false positives like "NOT PASS",
// "PASS blocked", "not ready to PASS". Reads the trailing value of the
// `## Verdict — <value>` heading, else the first non-empty body line.
function verdictIsPass(content: string): boolean {
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
  if (!text) return false;
  // Any explicit negation/failure token anywhere in the verdict value → not pass.
  if (/\b(not|fail|failed|blocked?|changes?\s*requested|incomplete|pending)\b/i.test(text)) {
    return false;
  }
  // First alphabetic token must be exactly PASS.
  const firstToken = (text.match(/[A-Za-z]+/)?.[0] ?? "").toUpperCase();
  return firstToken === "PASS";
}

export interface VisualReportValidation {
  ok: boolean;
  missingSections: string[];
  failedCanonicalStates: string[];
  failedStructuralAssertions: string[];
  failedRegionDiffs: string[];
  verdictPass: boolean;
}

// Pure validator over a single visual report's content.
export function validateVisualReport(content: string): VisualReportValidation {
  const missingSections: string[] = [];
  for (const sec of REQUIRED_VISUAL_SECTIONS) {
    if (sliceH2Section(content, sec) === null) missingSections.push(sec);
  }
  const canonical = sliceH2Section(content, "Canonical State Verification");
  const failedCanonicalStates = canonical ? parseUncheckedLabels(canonical) : [];
  const structural = sliceH2Section(content, "Structural Assertions");
  const failedStructuralAssertions = structural ? parseAssertionFailures(structural) : [];
  const region = sliceH2Section(content, "Region Diff");
  const failedRegionDiffs = region ? parseRegionDiffFailures(region) : [];
  const verdictPass = verdictIsPass(content);
  const ok =
    missingSections.length === 0 &&
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
export function designDeclaresStructuralAssertions(
  workspacePath: string,
  activeFeature: string,
): boolean {
  const designPath = designFilePath(workspacePath, activeFeature);
  if (!activeFeature || !fs.existsSync(designPath)) return false;
  try {
    const content = fs.readFileSync(designPath, "utf-8");
    return /^##\s+Visual\s+Structural\s+Assertions\b/im.test(content);
  } catch {
    return false;
  }
}

export interface VisualReportsCheck {
  ok: boolean;
  byTaskId: Record<string, VisualReportValidation>;
}

// Composition helper. Validates each present visual_<id>.md against the v3.26
// schema. Missing files are skipped (existence is enforced upstream by
// hasVisualEvidenceInFile). Returns the failing task ids with their detail.
export function validateVisualReports(
  workspacePath: string,
  taskIds: string[],
): VisualReportsCheck {
  const byTaskId: Record<string, VisualReportValidation> = {};
  for (const id of taskIds) {
    const filePath = visualEvidencePath(workspacePath, id);
    if (!fs.existsSync(filePath)) continue;
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const v = validateVisualReport(content);
    if (!v.ok) byTaskId[id] = v;
  }
  return { ok: Object.keys(byTaskId).length === 0, byTaskId };
}

// ---------- v3.38.0 — Baseline provenance gate (qa-visual-baseline-provenance) ----------
// Constitution §3.2 last-mile gate. The v3.27 schema gate (validateVisualReports)
// confirms the report's STRUCTURE is complete and every row reads pass/accepted;
// it cannot confirm the agent actually downloaded a real Figma baseline and ran a
// real diff. This parser reads each per-surface PROSE sub-section under
// `## Region Diff` and exposes the two machine-parsed provenance fields:
//   - `baseline:` <fingerprint>  — content-hash of the downloaded export OR the
//     Figma node id passed to mcp__figma__download_figma_images (D1).
//   - `diff-metric:` <value>     — numeric tool output, OR the
//     `B1 tool unavailable — LLM fallback` token (D4).
// The gate (checkVisualProvenance) is presence-gated opt-in (D2): dormant for any
// report with zero `baseline:` lines (legacy/pre-provenance). It applies the
// carry-forward (AC-3) and B1-fallback (AC-4) exemptions. The PARSER stays pure
// (AC-9) and applies no exemptions — it returns every row in source order.

export interface VisualProvenanceRow {
  surfaceId: string;       // surface id from the prose sub-section heading
  fingerprint: string | null;   // value after `baseline:` (backtick-stripped, trimmed); null if absent/empty/placeholder
  diffMetric: string | null;    // value after `diff-metric:` (trimmed); null if absent/empty — RAW value kept
                                 // (placeholder REJECTION is applied at the gate via isPlaceholderDiffMetric,
                                 // NOT here, so the raw value stays visible for AC-9 hints).
  isCarryForward: boolean; // prose contains the literal carry-forward token
  isFallback: boolean;     // prose contains the literal B1-unavailable token
  pixelGateComplete: boolean;   // true iff a `pixel_gate_complete:` line is present and normalizes to "true"
}

export interface VisualProvenanceCheck {
  ok: boolean;
  // task id -> list of surface ids missing required provenance, with the reason
  // (e.g. "checkout-panel: no baseline:"; "hero: no diff-metric:")
  offendingByTaskId: Record<string, string[]>;
}

// Verbatim tokens from spec Copy/Strings — AC-3/AC-4 require exact-substring match.
const CARRY_FORWARD_TOKEN = "pass (carried forward — git diff confirms source untouched)";
const B1_UNAVAILABLE_TOKEN = "B1 tool unavailable — LLM fallback";
// Placeholder values that must NOT satisfy the non-empty fingerprint test (D1).
// Lowercased compare; the empty string is included so a bare `baseline:` fails.
const FINGERPRINT_PLACEHOLDERS = new Set(["<fingerprint>", "todo", "tbd", "n/a", "none", "-", ""]);

// v3.42.0 — qa-visual-pixel-gate-attestation AC-1. Lowercased-trimmed tokens that a
// `diff-metric:` value must NOT equal. A placeholder means the pixel gate did not run
// to completion (skipped / dimension mismatch / not-yet-done), so it counts as absent.
// `"dimensionsmatch=false"` is the normalized form of the comparator's
// `dimensionsMatch=false` emit; `"dimensions mismatch"` covers the human-prose variant.
// The empty string is a member so a bare `diff-metric:` (no value) is rejected by the
// same path. The B1-fallback token (`B1 tool unavailable — LLM fallback`) is deliberately
// NOT a member (AC-5) — it proves the LLM-fallback path ran to completion.
const DIFF_METRIC_PLACEHOLDERS: ReadonlySet<string> = new Set([
  "n/a",
  "skipped",
  "skip",
  "dimensionsmatch=false",
  "dimensions mismatch",
  "todo",
  "tbd",
  "none",
  "-",
  "",
]);

// Permissive label-line regexes (D1 parse contract): optional leading bullet
// (`-`/`*`), optional surrounding markdown bold (`**`), case-insensitive label,
// `:`/`—`/`-` separator, capture the remainder. `m` for per-line, `i` for case.
const BASELINE_LINE_RE = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?baseline(?:[^\S\n]*\*\*)?[^\S\n]*[:—-][^\S\n]*([^\n]+?)[^\S\n]*$/im;
const DIFF_METRIC_LINE_RE = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?diff-metric(?:[^\S\n]*\*\*)?[^\S\n]*[:—-][^\S\n]*([^\n]+?)[^\S\n]*$/im;
// v3.42.0 — AC-3: same permissive label-line shape as the two above; only the label
// literal differs (underscores are literal, no escaping needed in a regex char run).
const PIXEL_GATE_COMPLETE_LINE_RE = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?pixel_gate_complete(?:[^\S\n]*\*\*)?[^\S\n]*[:—-][^\S\n]*([^\n]+?)[^\S\n]*$/im;

// Pure (AC-10). True iff `value` is absent OR normalizes to a member of
// DIFF_METRIC_PLACEHOLDERS. Normalization: trim, lowercase, collapse internal
// whitespace runs to a single space. null → true (absent counts as placeholder).
// Single source of truth for "is this diff-metric a non-execution placeholder" —
// both checkVisualProvenance and checkPixelGateAttestation call it.
export function isPlaceholderDiffMetric(value: string | null): boolean {
  if (value === null) return true;
  const s = value.trim().toLowerCase().replace(/\s+/g, " ");
  return DIFF_METRIC_PLACEHOLDERS.has(s);
}

// Pure (AC-3/AC-10). True iff `body` contains a `pixel_gate_complete:` label-line
// whose value (emphasis-stripped, trimmed, lowercased) is exactly "true". Absent or
// any other value (false, yes, 1, "") → false.
export function parsePixelGateAttestation(body: string): boolean {
  if (!body) return false;
  const m = PIXEL_GATE_COMPLETE_LINE_RE.exec(body);
  if (!m) return false;
  const value = m[1].replace(/^[*_]+|[*_]+$/g, "").trim().toLowerCase();
  return value === "true";
}

// Pure parser (AC-9 — no I/O, never throws). Returns one row per per-surface
// prose sub-section (a `### `..`###### ` heading) under `## Region Diff`. The
// surface id is the sub-heading text (backtick-stripped). The table rows
// `| surface | result |` are NOT used here — they are parsed by
// parseRegionDiffFailures for pass/fail; provenance lives only in the prose.
export function parseVisualProvenanceRows(content: string): VisualProvenanceRow[] {
  if (!content) return [];
  const section = sliceH2Section(content, "Region Diff");
  if (section === null) return [];

  // Split the Region-Diff body into blocks on sub-headings (### .. ######).
  const headRe = /^(#{3,6})\s+(.+?)\s*$/gm;
  const heads: { surfaceId: string; bodyStart: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headRe.exec(section)) !== null) {
    const surfaceId = hm[2].replace(/`/g, "").trim();
    heads.push({ surfaceId, bodyStart: hm.index + hm[0].length });
  }

  const rows: VisualProvenanceRow[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].bodyStart;
    const end = i + 1 < heads.length
      ? section.slice(start).search(/^#{3,6}\s+/m)
      : -1;
    const body = end === -1 ? section.slice(start) : section.slice(start, start + end);

    const isCarryForward = body.includes(CARRY_FORWARD_TOKEN);
    const isFallback = body.includes(B1_UNAVAILABLE_TOKEN);

    let fingerprint: string | null = null;
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

    let diffMetric: string | null = null;
    const dm = DIFF_METRIC_LINE_RE.exec(body);
    if (dm) {
      const raw = dm[1].replace(/^[*_]+|[*_]+$/g, "").trim();
      if (raw) diffMetric = raw;
    }

    const pixelGateComplete = parsePixelGateAttestation(body);

    rows.push({ surfaceId: heads[i].surfaceId, fingerprint, diffMetric, isCarryForward, isFallback, pixelGateComplete });
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
export function checkVisualProvenance(
  workspacePath: string,
  taskIds: string[],
): VisualProvenanceCheck {
  const offendingByTaskId: Record<string, string[]> = {};
  for (const id of taskIds) {
    const filePath = visualEvidencePath(workspacePath, id);
    if (!fs.existsSync(filePath)) continue;
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const rows = parseVisualProvenanceRows(content);
    // D2 opt-in: dormant unless the report declares at least one baseline.
    if (!rows.some((r) => r.fingerprint !== null)) continue;

    const offenses: string[] = [];
    for (const row of rows) {
      if (row.isCarryForward) continue; // AC-3 — exempt
      if (row.fingerprint === null) {
        offenses.push(`${row.surfaceId}: no baseline:`);
        continue;
      }
      // v3.42.0 AC-1/AC-6: a placeholder diff-metric (N/A, skipped, dimensionsMatch=false, …)
      // counts as absent. The B1-fallback path is still accepted via isFallback (AC-5): its
      // token is NOT a placeholder, but isFallback short-circuits regardless.
      if (!row.isFallback && isPlaceholderDiffMetric(row.diffMetric)) {
        offenses.push(`${row.surfaceId}: invalid diff-metric value "${row.diffMetric ?? ""}"`);
      }
    }
    if (offenses.length > 0) offendingByTaskId[id] = offenses;
  }
  return { ok: Object.keys(offendingByTaskId).length === 0, offendingByTaskId };
}

// ---------- v3.42.0 — Pixel-gate attestation (qa-visual-pixel-gate-attestation) ----------
// SEVENTH/LAST visual sub-gate (AC-2/AC-5). The v3.38 provenance gate (now tightened by
// DIFF_METRIC_PLACEHOLDERS, AC-1) confirms each diffed surface carries a REAL baseline +
// non-placeholder diff-metric; this gate confirms qa-visual POSITIVELY attested the pixel
// gate ran to completion (`pixel_gate_complete: true`) per surface. Closes the F2
// false-pass: a skipped diff can no longer ride structural assertions to PASS.

export interface PixelGateAttestationCheck {
  ok: boolean;
  // task id -> per-surface offense strings (currently the single kind
  // "missing-attestation:<surface>"). Tagged so the index.ts handler can render
  // AC-9's "which condition failed" without re-deriving it.
  offendingByTaskId: Record<string, string[]>;
}

// fs composition helper (mirrors checkVisualProvenance, AC-10). For each task id: read
// visual_<id>.md (skip if absent — existence is enforced upstream by
// hasVisualEvidenceInFile), parse rows, apply the gate. Never throws (fs errors → skip).
//
// Opt-in (mirrors provenance D2): dormant for a report with no non-null fingerprint
// anywhere (legacy/pre-provenance) — this is what makes AC-8 hold. Once any surface
// declares a real `baseline:`, EVERY non-carry-forward surface must carry
// `pixel_gate_complete: true`. Carry-forward surfaces are exempt (AC-4). The B1
// LLM-fallback path is NOT exempt — it must STILL attest (AC-5): a valid execution of
// the pixel gate, not a skip.
export function checkPixelGateAttestation(
  workspacePath: string,
  taskIds: string[],
): PixelGateAttestationCheck {
  const offendingByTaskId: Record<string, string[]> = {};
  for (const id of taskIds) {
    const filePath = visualEvidencePath(workspacePath, id);
    if (!fs.existsSync(filePath)) continue;
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const rows = parseVisualProvenanceRows(content);
    // Opt-in: dormant unless the report declares at least one baseline (AC-8).
    if (!rows.some((r) => r.fingerprint !== null)) continue;

    const offenses: string[] = [];
    for (const row of rows) {
      if (row.isCarryForward) continue; // AC-4 — exempt
      // AC-5: isFallback rows are NOT exempt — no early-continue here.
      if (!row.pixelGateComplete) offenses.push(`missing-attestation:${row.surfaceId}`);
    }
    if (offenses.length > 0) offendingByTaskId[id] = offenses;
  }
  return { ok: Object.keys(offendingByTaskId).length === 0, offendingByTaskId };
}

// ---------- v3.40.0 — Baseline manifest gate (figma-baseline-manifest-gate) ----------
// Constitution §3.1 sixth/last visual sub-gate. The v3.38 provenance gate confirmed
// each diffed surface carries a real baseline+diff; this gate confirms the
// design-auditor FROZE the baseline node-id selection in the design file's
// `## Source` manifest (step 2c) rather than eyeball-picking or re-deriving it from a
// Figma URL. Reads design/<feature>.md (NOT a qa report). Opt-in (AC-N3): dormant
// when `## Source` is absent (pre-v3.40 designs). Single-surface (exactly 1 audited
// row) is exempt from the provenance-section requirement (AC-3); multi-surface
// (>=2 audited rows) must record filter-conditions + exclusion-reasons in a
// `## Baseline Selection Provenance` section (AC-2). The two parsers are pure (AC-6);
// only checkBaselineManifest touches the filesystem.

// One parsed data row from the `## Source` manifest table.
export interface BaselineManifestRow {
  medium: string;          // first table cell (e.g. "figma", "image"); "" if absent
  pointer: string;         // node-id / pointer cell; "" if blank
  status: string;          // normalized lowercase: "audited" | "deferred" | "out-of-scope" | "unknown" | <raw>
  isAudited: boolean;      // status === "audited" AND pointer non-empty (frozen-row predicate)
  rawLine: string;         // the source table line, for debugging
}

// Result of the composition helper. `code` selects the index.ts error template.
export interface BaselineManifestCheck {
  ok: boolean;
  code: null | "BASELINE_MANIFEST_MISSING" | "BASELINE_PROVENANCE_INCOMPLETE";
  detail: string;          // human-readable specifics (debug/logging only); "" when ok
  designPath: string;      // resolved design/<feature>.md path, for the error hint
  auditedCount: number;    // number of audited rows found (0 when dormant or genuinely empty)
}

// Pure parser (AC-6/AC-7 — no I/O, never throws). Returns one row per DATA line of
// the markdown table under the `## Source` H2. Header + separator rows are skipped.
// Empty array when content is empty, no `## Source` section, or no table.
export function parseBaselineManifestRows(content: string): BaselineManifestRow[] {
  if (!content) return [];
  const section = sliceH2Section(content, "Source");
  if (section === null) return [];

  // Collect candidate table lines (trimmed lines starting with `|`).
  const tableLines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));
  if (tableLines.length === 0) return [];

  // Header detection (AC-7): the first `|`-line whose cells include a `status`
  // cell. Record column indices; fall back to positional when no header found.
  let statusIdx = -1;
  let pointerIdx = -1;
  let mediumIdx = -1;
  let headerLine: string | null = null;
  for (const line of tableLines) {
    if (/^\|[\s:|-]+\|?$/.test(line)) continue; // separator row never a header
    const cells = splitTableCells(line).map((c) => c.toLowerCase());
    const si = cells.findIndex((c) => /^status$/.test(c));
    if (si !== -1) {
      statusIdx = si;
      pointerIdx = cells.findIndex((c) => /^(pointer|node-?id)$/.test(c));
      mediumIdx = cells.findIndex((c) => /^medium$/.test(c));
      headerLine = line;
      break;
    }
  }
  // AC-7 backwards-compat: no `status` column → treat every data row as audited.
  const noStatusColumn = statusIdx === -1;
  // Positional fallbacks when a header was found but lacked pointer/medium cells.
  if (pointerIdx === -1) pointerIdx = 1;
  if (mediumIdx === -1) mediumIdx = 0;
  const effStatusIdx = noStatusColumn ? 3 : statusIdx;

  const rows: BaselineManifestRow[] = [];
  for (const line of tableLines) {
    if (/^\|[\s:|-]+\|?$/.test(line)) continue; // separator row
    if (headerLine !== null && line === headerLine) continue; // header row
    const cells = splitTableCells(line);
    // Heuristic header skip when no status column was detected: a row whose
    // first cell is literally "medium" is the header of a status-less table.
    if (noStatusColumn && cells.length && /^(medium|pointer|node-?id)$/i.test(cells[0])) {
      continue;
    }
    const medium = mediumIdx >= 0 && mediumIdx < cells.length ? cells[mediumIdx] : "";
    const pointer = pointerIdx >= 0 && pointerIdx < cells.length ? cells[pointerIdx] : "";
    const status = noStatusColumn
      ? "audited"
      : normalizeStatus(effStatusIdx < cells.length ? cells[effStatusIdx] : "");
    const isAudited = status === "audited" && pointer.trim().length > 0;
    rows.push({ medium, pointer, status, isAudited, rawLine: line });
  }
  return rows;
}

// Pure predicate (AC-8 — no I/O, never throws). True iff the document contains a
// `## Baseline Selection Provenance` H2 section whose body carries BOTH a
// `filter-conditions:` line AND an `exclusion-reasons:` line. Section-scoped so a
// stray label elsewhere in the doc cannot falsely satisfy the gate.
export function hasBaselineProvenance(content: string): boolean {
  if (!content) return false;
  const body = sliceH2Section(content, "Baseline Selection Provenance");
  if (body === null) return false;
  const hasFilter = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?filter-conditions(?:[^\S\n]*\*\*)?[^\S\n]*[:—-]/im.test(body);
  const hasExclusion = /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?exclusion-reasons(?:[^\S\n]*\*\*)?[^\S\n]*[:—-]/im.test(body);
  return hasFilter && hasExclusion;
}

// Composition helper (fs). Reads design/<feature>.md once via the existing
// designFilePath() helper, calls the two pure parsers, applies the AC decision
// tree, returns the typed result. Never throws (fs errors → dormant silent pass).
// `mode != no-design` is NOT re-checked here — the index.ts caller only reaches
// this gate inside `if (armCheck.required)` + `if (visualGate.present)`, so the arm
// signal is enforced by gate placement (mirrors the v3.27/v3.38 gates).
export function checkBaselineManifest(
  workspacePath: string,
  activeFeature: string,
): BaselineManifestCheck {
  const designPath = designFilePath(workspacePath, activeFeature);
  const dormant: BaselineManifestCheck = { ok: true, code: null, detail: "", designPath, auditedCount: 0 };

  if (!activeFeature || !fs.existsSync(designPath)) return dormant; // AC-4 (no design file)
  let content: string;
  try {
    content = fs.readFileSync(designPath, "utf-8");
  } catch {
    return dormant;
  }

  // Opt-in arm (AC-N3): dormant when there is NO `## Source` section at all.
  if (sliceH2Section(content, "Source") === null) return dormant;

  const rows = parseBaselineManifestRows(content);
  const auditedCount = rows.filter((r) => r.isAudited).length;

  // AC-1(b) / AC-N4: `## Source` present but zero audited rows → manifest missing.
  if (auditedCount === 0) {
    return {
      ok: false,
      code: "BASELINE_MANIFEST_MISSING",
      detail: `## Source present but 0 audited rows (${rows.length} total row(s))`,
      designPath,
      auditedCount: 0,
    };
  }

  // AC-3 / AC-N2: exactly 1 audited row → single-surface; provenance EXEMPT.
  if (auditedCount === 1) return { ok: true, code: null, detail: "", designPath, auditedCount };

  // auditedCount >= 2 → multi-surface; require complete provenance section (AC-2).
  if (!hasBaselineProvenance(content)) {
    return {
      ok: false,
      code: "BASELINE_PROVENANCE_INCOMPLETE",
      detail: `${auditedCount} audited rows but ## Baseline Selection Provenance absent or missing filter-conditions:/exclusion-reasons:`,
      designPath,
      auditedCount,
    };
  }
  return { ok: true, code: null, detail: "", designPath, auditedCount };
}
