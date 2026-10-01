// Coded by @sr-engineer
// Low-level, gate-agnostic markdown plumbing shared by the gates/ modules: H2
// section slicing, table-cell splitting, the checkbox / assertion /
// region-diff / status cell parsers, and the `covers:` label-line coverage
// used by gates/qa-review.ts and gates/code-review.ts. The gate predicates
// live in gates/. This module imports nothing from gates/, keeping the
// import graph acyclic.

import * as fs from "fs";
import * as path from "path";

// ---------- `covers:` label-line plumbing ----------
// One review file may declare `covers: <id1>, <id2>, ...` to satisfy the
// evidence gates for a batched round instead of one stub per id. File mode
// only (SQLite records one `reports` row per id). The caller supplies the
// directory to scan, so this module stays free of gate knowledge.

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
export function parseCoversIds(content: string): string[] {
  if (!content) return [];
  const m = COVERS_LINE_RE.exec(content);
  if (!m) return [];
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
export function buildCoverageIndex(dir: string): Map<string, string> {
  const index = new Map<string, string>();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return index;
  }
  for (const name of [...entries].sort()) {
    if (!name.toLowerCase().endsWith(".md")) continue;
    let content: string;
    try {
      content = fs.readFileSync(path.join(dir, name), "utf-8");
    } catch {
      continue;
    }
    for (const id of parseCoversIds(content)) {
      if (!index.has(id)) index.set(id, name);
    }
  }
  return index;
}

// Escape a string for literal use inside a RegExp.
function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Slice a markdown H2 section body (heading exclusive) up to the next `## ` or EOF.
export function sliceH2Section(content: string, heading: string): string | null {
  const headRe = new RegExp(`^##\\s+${escapeRegex(heading)}\\b[^\\n]*`, "im");
  const m = headRe.exec(content);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const rest = content.slice(start);
  const nextIdx = rest.search(/\n##\s/);
  return nextIdx === -1 ? rest : rest.slice(0, nextIdx);
}

// ---------- schema-keyed slicing ----------
// sliceH2Section above is exact-anchored, so a heading with extra leading text
// (`## Phase 3.5 — AC Execution Log`) fails. The siblings below key matching
// off the feature's pinned evidence_schema: 1 keeps the exact anchor; 2 or
// absent matches when normalize(h2Text) includes normalize(target). Absent
// pins get 2 because it only ever accepts more (see gates/evidence-schema.ts).

// D2 normalize: lowercase, collapse every non-alphanumeric run to one space,
// trim. Pure, never throws.
export function normalizeHeadingText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// H2 line matcher for the normalized-contains scan. `[ \t]` (not `\s`) so the
// separator can never consume a newline; `(.+)` captures the heading text.
// Deeper headings (`###`) don't match: their third char is `#`, not space/tab.
const H2_LINE_RE = /^##[ \t]+(.+)$/gm;

// Locate the FIRST H2 heading matching `heading` under the given evidence
// schema. Returns the full heading line plus the index just past it (where
// the section body starts), or null. First-match-wins when several H2s
// contain the target (D2).
function findH2At(
  content: string,
  heading: string,
  evidenceSchema?: number,
): { line: string; bodyStart: number } | null {
  if (evidenceSchema === 1) {
    const headRe = new RegExp(`^##\\s+${escapeRegex(heading)}\\b[^\\n]*`, "im");
    const m = headRe.exec(content);
    if (!m || m.index === undefined) return null;
    return { line: m[0], bodyStart: m.index + m[0].length };
  }
  const target = normalizeHeadingText(heading);
  const re = new RegExp(H2_LINE_RE.source, "gm"); // fresh lastIndex per call
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (normalizeHeadingText(m[1]).includes(target)) {
      return { line: m[0], bodyStart: m.index + m[0].length };
    }
  }
  return null;
}

// Schema-keyed sibling of sliceH2Section (D2). Same body-slicing contract
// (heading exclusive, up to the next `## ` or EOF); only heading LOCATION is
// schema-keyed. Normalization applies to locating headings, never to section
// body content, verdict values, or pass/fail cell parsing.
export function sliceH2SectionAt(
  content: string,
  heading: string,
  evidenceSchema?: number,
): string | null {
  const found = findH2At(content, heading, evidenceSchema);
  if (!found) return null;
  const rest = content.slice(found.bodyStart);
  const nextIdx = rest.search(/\n##\s/);
  return nextIdx === -1 ? rest : rest.slice(0, nextIdx);
}

// Schema-keyed heading-LINE lookup (D2). Consumed by gates/visual.ts
// verdictIsPass, which reads the trailing value off the `## Verdict — <value>`
// heading line itself and therefore needs the line, not the body.
export function findH2LineAt(
  content: string,
  heading: string,
  evidenceSchema?: number,
): string | null {
  const found = findH2At(content, heading, evidenceSchema);
  return found ? found.line : null;
}

// `- [mark] label` rows → labels whose mark is not x/X (unchecked/unverified).
export function parseUncheckedLabels(section: string): string[] {
  const lineRe = /^-\s+\[(.)\]\s+(.+)$/gm;
  const unchecked: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(section)) !== null) {
    if (m[1] === "x" || m[1] === "X") continue;
    const rest = m[2];
    const splitIdx = rest.search(/\s+—\s+|\s+-\s+/);
    unchecked.push((splitIdx === -1 ? rest : rest.slice(0, splitIdx)).trim());
  }
  return unchecked;
}

// Markdown table rows whose LAST cell is the pass/fail result. Returns the
// first-cell ids whose result is not exactly "pass" (case-insensitive): fail,
// blank, or any other token counts as unverified. Header + separator rows skipped.
export function parseAssertionFailures(section: string): string[] {
  const failures: string[] = [];
  for (const line of section.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    if (/^\|[\s:|-]+\|?$/.test(t)) continue; // separator row
    const parts = t.split("|");
    if (parts.length && parts[0].trim() === "") parts.shift();
    if (parts.length && parts[parts.length - 1].trim() === "") parts.pop();
    const cells = parts.map((c) => c.trim());
    if (cells.length < 2) continue;
    const id = cells[0];
    if (id === "" || /assertion\s*id/i.test(id)) continue; // header row
    const result = cells[cells.length - 1].toLowerCase();
    if (result !== "pass") failures.push(id);
  }
  return failures;
}

// Region Diff rows `| surface | result |` where result ∈ {pass, accepted}.
// Anything else (fail, material, unresolved, blank, drift) is a failure.
// "accepted" is allowed because a difference qa-visual deliberately accepts is
// recorded in `## Allowed Differences`; here it signals "diff exists but cleared".
export function parseRegionDiffFailures(section: string): string[] {
  const failures: string[] = [];
  for (const line of section.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    if (/^\|[\s:|-]+\|?$/.test(t)) continue;
    const parts = t.split("|");
    if (parts.length && parts[0].trim() === "") parts.shift();
    if (parts.length && parts[parts.length - 1].trim() === "") parts.pop();
    const cells = parts.map((c) => c.trim());
    if (cells.length < 2) continue;
    const id = cells[0];
    if (id === "" || /surface(\s*id)?/i.test(id)) continue; // header row
    const result = cells[cells.length - 1].toLowerCase();
    if (result !== "pass" && result !== "accepted") failures.push(id);
  }
  return failures;
}

// Split a markdown table line into trimmed cells, dropping the leading/trailing
// empty cells produced by the outer pipes. Mirrors the proven cell-splitting in
// parseAssertionFailures / parseRegionDiffFailures.
export function splitTableCells(line: string): string[] {
  const parts = line.split("|");
  if (parts.length && parts[0].trim() === "") parts.shift();
  if (parts.length && parts[parts.length - 1].trim() === "") parts.pop();
  return parts.map((c) => c.trim());
}

// Normalize a raw status cell to a canonical token (substring-tolerant, so
// `audited ✅` / `audited (frozen)` still count). Empty → "unknown".
export function normalizeStatus(rawCell: string): string {
  const lc = rawCell.toLowerCase().replace(/`/g, "").trim();
  if (lc === "") return "unknown";
  if (lc.includes("audited")) return "audited";
  if (lc.includes("defer")) return "deferred";
  if (lc.includes("out-of-scope") || lc.includes("out of scope")) return "out-of-scope";
  return lc;
}
