// Coded by @sr-engineer
// tools/fanout-manifest.ts — fan-out manifest parser, dispatch-prompt
// renderer and fan-in ownership check (E177a, e177a-fanout-manifest; spec:
// specs/e177a-fanout-manifest.md — the normative format table there is the
// contract this module implements).
//
// The integrator writes each wave's `specs/fanout-<wave>.md` by hand. This
// module is the ONE parser for that format:
//   - parseManifest / validateManifest — line-based markdown parse of the
//     title, `base:` / `mailbox:` header lines, every `## Lanes…` table
//     (8-column dispatchable vs provisional), `## Dispatch pins…` bullets and
//     the `## Decisions…` table; every format error is collected, none is
//     "fixed up".
//   - renderPrompt — the integrator SOP §3b dispatch prompt built from one
//     dispatchable row plus explicitly supplied CLI inputs.
//   - checkLane — `git diff --no-renames --name-only <base>...<branch>` vs
//     the row's owned path tokens; every out-of-bounds path is listed.
//
// Load-bearing property: the tool NEVER guesses. A legacy manifest (Wave 6's
// `## 人類裁決`, Wave 7.2's `擁有（暫定）` columns) is reported by name as
// unreadable in that part; it is never mapped onto the current format. Row
// cells are rendered byte-verbatim, with one exception: the `worktree` cell is
// written relative to the primary checkout (e.g. `../<lanes-dir>/<lane>`) so a
// tracked manifest never carries a local absolute path, and `render` resolves
// it against the primary path it already computes; a cell that is already
// absolute passes through byte-verbatim. This amends the `<worktree>` row of
// the e177a "Render field sources" table (see
// specs/e235b-relative-manifest-worktree-architecture.md). The parsed
// path-token set is used only by `check`.
//
// Reporting surface only: writes nothing, fires no gate, touches no git state
// (git is only read, via execFileSync argv — never a shell).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// --- constants ---------------------------------------------------------------

/** Exact header of a dispatchable `## Lanes…` table, in order. */
export const LANES_HEADER = ["lane", "票", "branch", "worktree", "擁有", "禁止", "範圍切線", "相依"] as const;

/** Exact header of the `## Decisions…` table, in order. */
export const DECISIONS_HEADER = ["日期", "裁決者", "內容", "出處"] as const;

/** Allowed `裁決者` values. */
export const DECIDERS = ["人類", "整合者"] as const;

/** The 8 `dispatch_pins` roles (mirrors tw_update_state's dispatch_pins keys). */
export const PIN_ROLES = [
  "pm",
  "researcher",
  "design-auditor",
  "architect",
  "sr-engineer",
  "code-reviewer",
  "qa-engineer",
  "release-engineer",
] as const;

export const LANE_ID_RE = /^[A-Za-z0-9_.-]+$/;
const PATH_TOKEN_RE = /^[A-Za-z0-9_.\-*/{},]+$/;
const UNQUOTED_PATH_RE = /^[A-Za-z0-9_.\-]*\/[A-Za-z0-9_.\-*/{}]*$/;
const UNQUOTED_SPLIT_RE = /[\s,、，；;（）()]+/;
const TITLE_RE = /^# Fan-out: (.+)$/;
const BASE_RE = /^base:\s*([0-9a-f]{7,40})\b/;
const MAILBOX_RE = /^mailbox:\s*(\S+)/;
const SHA_RE = /^[0-9a-f]{7,40}$/;
const PIN_SPAN_RE = /^([a-z-]+)=(\S+)$/;

/**
 * Integrator dispatch-prompt template — the single canonical copy (E178a).
 * `content/skill-integrator.md` (the `integrator` MCP prompt, stage 3) does
 * not restate it; it references it via `node scripts/fanout.mjs render`.
 * The bytes are pinned by the E177a render golden — do not edit the wording
 * here without re-baselining that golden.
 */
export const PROMPT_TEMPLATE_3B = `開始做 <計劃或 feature>，你只負責 <lane> lane 的 <票>（<一句話>）。

先完整讀 docs/lane-protocol.md（共同規則，包括信箱與回報格式），再讀 <計劃的必讀章節> + <票面 row>。
你只負責這張票走到 qa PASS；波次層級的核取項屬於整合者。

【你的欄位】
- primary: <primary 路徑>    base: <base>    ticket-slug: <ticket-slug>
- branch: <branch>    worktree: <worktree>    lane: <lane>
- 信箱: <lanes-root>/_mailbox/<lane>/（你寫 to-integrator.md，讀 to-lane.md）
- dispatch pins: <例如 sr-engineer=fable>

【你擁有的檔案】<擁有>，加上這張票新建的檔案與它自己的測試檔
【不准碰】<禁止>
【範圍切線（整合者已決定）】做：<…>　不做：<…>

需要跟整合者討論的事一律走信箱，不要請我轉貼。需要我核准的事，等我在這裡親手打字。
`;

/**
 * Error codes of this CLI whose spec names would otherwise read as absence /
 * mismatch conditions. These are CLI codes, not tw_update_state gate codes, so
 * they are named outside the test/error-code-contract.test.mjs gate-suffix
 * vocabulary (precedent: TASKS_LEDGER_ABSENT, tools/tasks-lane-migrate.ts:90).
 */
export const FANOUT_CODES = {
  titleAbsent: "MANIFEST_TITLE_ABSENT",
  baseAbsent: "BASE_ABSENT",
  lanesSectionAbsent: "LANES_SECTION_ABSENT",
  lanesTableAbsent: "LANES_TABLE_ABSENT",
  scopeCutMarkersAbsent: "SCOPE_CUT_MARKERS_ABSENT",
  pinsSectionAbsent: "PINS_SECTION_ABSENT",
  pinsLaneAbsent: "PINS_LANE_ABSENT",
  decisionsSectionAbsent: "DECISIONS_SECTION_ABSENT",
  decisionsTableAbsent: "DECISIONS_TABLE_ABSENT",
  decisionsHeaderDiffers: "DECISIONS_HEADER_DIFFERS",
  summaryAbsent: "SUMMARY_ABSENT",
  readingAbsent: "READING_ABSENT",
  mailboxRootAbsent: "MAILBOX_ROOT_ABSENT",
  primaryNotFound: "PRIMARY_NOT_FOUND",
  // Render-only row errors (E235b): an unusable worktree cell. Not raised by
  // the parser, so validate/check exit codes never change because of them.
  worktreeEmpty: "WORKTREE_EMPTY",
  worktreeTilde: "WORKTREE_TILDE",
} as const;

/**
 * validate warning for a dispatchable row whose worktree cell is an absolute
 * path (E235b). The absolute value is deliberately NOT echoed, so the warning
 * never repeats a local path in its own output.
 */
export const WORKTREE_ABSOLUTE_WARN = (lane: string, line: number): string =>
  `WARN  lane ${lane} (line ${line}): worktree cell is an absolute path — write it relative to primary (e.g. ../<lanes-dir>/${lane}); render still accepts it`;

export const PINS_NONE = "無";

export const USAGE = [
  "usage: node scripts/fanout.mjs validate <manifest>",
  "       node scripts/fanout.mjs render <manifest> <lane> --summary <text> --reading <text>... [--mailbox-root <dir>] [--primary <path>] [--base <sha>]",
  "       node scripts/fanout.mjs check <manifest> <lane> [--base main] [--repo <dir>]",
].join("\n");

export const E158_NOTE = (base: string, branch: string): string =>
  `note: only committed changes were checked (git diff --no-renames --name-only ${base}...${branch}); uncommitted and untracked work in the worktree was NOT checked (E158).`;
export const PROSE_NOTE = "note: prose restrictions inside 擁有 (e.g. （只限 …）) are not machine-checked.";

// --- types -------------------------------------------------------------------

/**
 * Which part of the manifest an error belongs to. render/check use it to
 * decide which errors are fatal for the lane they target (a Decisions error
 * never blocks a render; a row error blocks only its own lane).
 * "input" = a CLI/environment input (flag, git ref, file), not the manifest text.
 */
export type FanoutErrorScope = "title" | "base" | "lanes" | "row" | "pins" | "decisions" | "input";

export interface FanoutError {
  code: string;
  message: string;
  scope: FanoutErrorScope;
  /** Lanes the error is attributed to; undefined = manifest-wide. */
  lanes?: string[];
}

export interface DispatchableLane {
  lane: string;
  ticket: string;
  branch: string;
  worktree: string;
  /** `擁有` cell, trimmed but otherwise byte-verbatim (render source). */
  owned: string;
  /** `禁止` cell, verbatim. */
  forbidden: string;
  /** `範圍切線` cell, verbatim. */
  scopeCut: string;
  deps: string;
  /** Path tokens parsed from `擁有` (check source only). */
  ownedTokens: string[];
  /** Path tokens parsed from `禁止` (OUT-line annotation only). */
  forbiddenTokens: string[];
  /** The full `## Lanes…` heading line of the section holding the row. */
  heading: string;
  /** 1-based line number of the row in the manifest. */
  line: number;
}

export interface ProvisionalLane {
  lane: string;
  heading: string;
  line: number;
  /** Columns of the dispatchable header absent from this table's header (exact cell match). */
  missingColumns: string[];
  header: string[];
}

export interface PinBullet {
  lanes: string[];
  pins: { role: string; tier: string }[];
  explicitNone: boolean;
  line: number;
}

export interface Decision {
  date: string;
  decider: string;
  content: string;
  source: string;
  /** 1-based data-row number within the Decisions table. */
  row: number;
  line: number;
}

export interface Manifest {
  title?: string;
  base?: string;
  mailbox?: string;
  dispatchable: DispatchableLane[];
  provisional: ProvisionalLane[];
  pins: { present: boolean; bullets: PinBullet[] };
  decisions: { present: boolean; rows: Decision[] };
  /** Every format error found, in manifest order within each part. */
  errors: FanoutError[];
}

// --- low-level markdown helpers ----------------------------------------------

interface Section {
  heading: string; // full heading line, e.g. "## Lanes（7.1，並行；假設 D1=A）"
  name: string; // heading text after "## "
  line: number; // 1-based heading line
  lines: { text: string; line: number }[];
}

function splitLines(text: string): string[] {
  return text.replace(/^﻿/, "").split(/\r?\n/);
}

function splitSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  lines.forEach((text, i) => {
    if (text.startsWith("## ")) {
      cur = { heading: text.trimEnd(), name: text.slice(3).trim(), line: i + 1, lines: [] };
      sections.push(cur);
    } else if (text.startsWith("# ")) {
      cur = null;
    } else if (cur) {
      cur.lines.push({ text, line: i + 1 });
    }
  });
  return sections;
}

/** First run of lines starting with `|` inside a section. */
function firstTable(section: Section): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  for (const l of section.lines) {
    if (l.text.startsWith("|")) out.push(l);
    else if (out.length > 0) break;
  }
  return out;
}

/** Split a table row on `|` not escaped as `\|`; trims each cell. */
export function splitRow(row: string): string[] {
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === "\\" && row[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (ch === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  // Leading `|` yields an empty first chunk; a trailing `|` an empty last one.
  if (cells.length > 0 && cells[0].trim() === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === "" && /\|\s*$/.test(row) && !/\\\|\s*$/.test(row)) cells.pop();
  return cells.map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** Header + data rows of a table (the separator row after the header is dropped). */
function tableRows(table: { text: string; line: number }[]): {
  header: string[];
  rows: { cells: string[]; line: number }[];
} {
  const header = splitRow(table[0].text);
  const rows: { cells: string[]; line: number }[] = [];
  table.slice(1).forEach((l, idx) => {
    const cells = splitRow(l.text);
    if (idx === 0 && isSeparatorRow(cells)) return;
    rows.push({ cells, line: l.line });
  });
  return { header, rows };
}

function backtickSpans(cell: string): string[] {
  const out: string[] = [];
  for (const m of cell.matchAll(/`([^`]+)`/g)) out.push(m[1].trim());
  return out;
}

/** Spec "path token": a backtick span that is path-shaped; every other span is prose. */
export function isPathToken(span: string): boolean {
  const t = span.trim();
  if (!PATH_TOKEN_RE.test(t)) return false;
  if (t.startsWith(":") || t.startsWith("-")) return false;
  return t.includes("/") || /\.[A-Za-z0-9]+$/.test(t);
}

export function pathTokens(cell: string): string[] {
  return backtickSpans(cell).filter(isPathToken);
}

/** Spec "unquoted path": bare path-shaped words in `擁有` outside backtick spans. */
export function unquotedPaths(cell: string): string[] {
  const stripped = cell.replace(/`[^`]*`/g, " ");
  return stripped
    .split(UNQUOTED_SPLIT_RE)
    .filter((w) => w.length > 0 && UNQUOTED_PATH_RE.test(w) && /[A-Za-z]/.test(w));
}

function hasScopeCutMarkers(cell: string): boolean {
  return /(^|[^不])做[：:]/.test(cell) && /不做[：:]/.test(cell);
}

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// --- parser ------------------------------------------------------------------

/**
 * Parse a fan-out manifest. Never throws on malformed input: every problem is
 * recorded in `errors` (with a scope and lane attribution) and the offending
 * part is left out of the structured result rather than guessed at.
 */
export function parseManifest(text: string): Manifest {
  const lines = splitLines(text);
  const errors: FanoutError[] = [];
  const m: Manifest = {
    dispatchable: [],
    provisional: [],
    pins: { present: false, bullets: [] },
    decisions: { present: false, rows: [] },
    errors,
  };

  // Header lines — first match anywhere in the file wins.
  for (const l of lines) {
    if (m.title === undefined) {
      const t = TITLE_RE.exec(l);
      if (t) m.title = t[1].trim();
    }
    if (m.base === undefined) {
      const b = BASE_RE.exec(l);
      if (b) m.base = b[1];
    }
    if (m.mailbox === undefined) {
      const mb = MAILBOX_RE.exec(l);
      if (mb) m.mailbox = mb[1];
    }
  }
  if (m.title === undefined) {
    errors.push({ code: FANOUT_CODES.titleAbsent, scope: "title", message: 'no title line matching "# Fan-out: <plan>" found' });
  }
  if (m.base === undefined) {
    errors.push({ code: FANOUT_CODES.baseAbsent, scope: "base", message: 'no "base: <sha>" line (7–40 lowercase hex) found in the manifest' });
  }

  const sections = splitSections(lines);
  const laneIds = parseLanes(sections, m);
  parsePins(sections, m, laneIds);
  parseDecisions(sections, m);
  return m;
}

/** Returns every lane id seen in a readable Lanes table (including rows with row errors). */
function parseLanes(sections: Section[], m: Manifest): Set<string> {
  const errors = m.errors;
  const laneSections = sections.filter((s) => s.name.startsWith("Lanes"));
  if (laneSections.length === 0) {
    errors.push({ code: FANOUT_CODES.lanesSectionAbsent, scope: "lanes", message: 'no "## Lanes…" section found' });
    return new Set();
  }
  const seen = new Map<string, string>(); // lane id → heading of first occurrence
  const noteLane = (id: string, heading: string, line: number): void => {
    const prev = seen.get(id);
    if (prev !== undefined) {
      errors.push({
        code: "LANE_DUPLICATE",
        scope: "lanes",
        lanes: [id],
        message: `lane ${id} appears more than once (first in "${prev}", again in "${heading}" line ${line})`,
      });
    } else {
      seen.set(id, heading);
    }
  };

  for (const s of laneSections) {
    const table = firstTable(s);
    if (table.length === 0) {
      errors.push({ code: FANOUT_CODES.lanesTableAbsent, scope: "lanes", message: `section "${s.heading}" (line ${s.line}) has no table` });
      continue;
    }
    const { header, rows } = tableRows(table);
    if (header[0] !== "lane") {
      errors.push({
        code: "LANES_HEADER_UNKNOWN",
        scope: "lanes",
        message: `section "${s.heading}" (line ${s.line}): table's first header cell is "${header[0] ?? ""}", not "lane" — table not read`,
      });
      continue;
    }
    const dispatchable = header.length === LANES_HEADER.length && header.every((c, i) => c === LANES_HEADER[i]);
    if (!dispatchable) {
      const missing = LANES_HEADER.filter((c) => !header.includes(c));
      for (const r of rows) {
        const id = r.cells[0] ?? "";
        if (!LANE_ID_RE.test(id)) {
          errors.push({
            code: "LANE_ID_INVALID",
            scope: "lanes",
            message: `section "${s.heading}" line ${r.line}: lane id "${id}" is empty or not [A-Za-z0-9_.-]+`,
          });
          continue;
        }
        noteLane(id, s.heading, r.line);
        m.provisional.push({ lane: id, heading: s.heading, line: r.line, missingColumns: missing, header });
      }
      continue;
    }
    for (const r of rows) {
      const where = `section "${s.heading}" line ${r.line}`;
      const id = r.cells[0] ?? "";
      if (!LANE_ID_RE.test(id)) {
        errors.push({
          code: "LANE_ID_INVALID",
          scope: "lanes",
          message: `${where}: lane id "${id}" is empty or not [A-Za-z0-9_.-]+`,
        });
        continue;
      }
      noteLane(id, s.heading, r.line);
      const rowErr = (code: string, message: string): void => {
        errors.push({ code, scope: "row", lanes: [id], message: `lane ${id} (${where}): ${message}` });
      };
      if (r.cells.length !== LANES_HEADER.length) {
        rowErr("ROW_CELL_COUNT", `row has ${r.cells.length} cell(s), expected ${LANES_HEADER.length} (${LANES_HEADER.join(" | ")})`);
        continue;
      }
      const [lane, ticket, branch, worktree, owned, forbidden, scopeCut, deps] = r.cells;
      let ok = true;
      if (branch === "") {
        rowErr("BRANCH_EMPTY", "branch cell is empty");
        ok = false;
      }
      const ownedTokens = pathTokens(owned);
      if (ownedTokens.length === 0) {
        rowErr("OWNED_EMPTY", "擁有 cell has no backtick-quoted path token");
        ok = false;
      }
      for (const w of unquotedPaths(owned)) {
        rowErr("OWNED_UNQUOTED_PATH", `擁有 cell has unquoted path "${w}" — owned paths must be backtick-quoted`);
        ok = false;
      }
      if (!hasScopeCutMarkers(scopeCut)) {
        rowErr(FANOUT_CODES.scopeCutMarkersAbsent, "範圍切線 cell must contain both 做： and 不做：");
        ok = false;
      }
      if (!ok) continue;
      m.dispatchable.push({
        lane,
        ticket,
        branch,
        worktree,
        owned,
        forbidden,
        scopeCut,
        deps,
        ownedTokens,
        forbiddenTokens: pathTokens(forbidden),
        heading: s.heading,
        line: r.line,
      });
    }
  }
  return new Set(seen.keys());
}

function parsePins(sections: Section[], m: Manifest, known: Set<string>): void {
  const errors = m.errors;
  const pinSections = sections.filter((s) => s.name.startsWith("Dispatch pins"));
  if (pinSections.length === 0) {
    errors.push({ code: FANOUT_CODES.pinsSectionAbsent, scope: "pins", message: 'no "## Dispatch pins…" section found' });
    return;
  }
  if (pinSections.length > 1) {
    errors.push({
      code: "PINS_SECTION_DUPLICATE",
      scope: "pins",
      message: `${pinSections.length} "## Dispatch pins…" sections found (lines ${pinSections.map((s) => s.line).join(", ")}); exactly one is allowed`,
    });
    return;
  }
  m.pins.present = true;
  const roles = new Set<string>(PIN_ROLES);
  const bulletOf = new Map<string, number>(); // lane → line of first bullet naming it

  for (const l of pinSections[0].lines) {
    const bm = /^\s*[-*]\s+(.*)$/.exec(l.text);
    if (!bm) continue;
    const body = bm[1];
    const ci = body.search(/[：:]/);
    if (ci < 0) {
      errors.push({
        code: "PINS_BULLET_MALFORMED",
        scope: "pins",
        message: `Dispatch pins line ${l.line}: bullet has no "<lane>[、<lane>…]：<text>" colon`,
      });
      continue;
    }
    const lanes = body
      .slice(0, ci)
      .split(/[、,，]/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    const rest = body.slice(ci + 1);
    if (lanes.length === 0) {
      errors.push({ code: "PINS_BULLET_MALFORMED", scope: "pins", message: `Dispatch pins line ${l.line}: bullet names no lane before the colon` });
      continue;
    }
    const pins: { role: string; tier: string }[] = [];
    for (const span of backtickSpans(rest)) {
      const pm = PIN_SPAN_RE.exec(span);
      if (!pm) continue;
      if (!roles.has(pm[1])) {
        errors.push({
          code: "PINS_ROLE_UNKNOWN",
          scope: "pins",
          lanes,
          message: `Dispatch pins line ${l.line}: role "${pm[1]}" in \`${span}\` is not one of ${PIN_ROLES.join(", ")}`,
        });
        continue;
      }
      pins.push({ role: pm[1], tier: pm[2] });
    }
    const explicitNone = rest.includes("無 pin") || /\bnone\b/i.test(rest);
    const hadRoleSpan = backtickSpans(rest).some((sp) => PIN_SPAN_RE.test(sp));
    if (pins.length === 0 && !explicitNone && !hadRoleSpan) {
      errors.push({
        code: "PINS_EMPTY_UNDECLARED",
        scope: "pins",
        lanes,
        message: `Dispatch pins line ${l.line}: bullet for ${lanes.join(", ")} has no \`role=tier\` pin and does not say 無 pin / none`,
      });
    }
    for (const lane of lanes) {
      if (!known.has(lane)) {
        errors.push({
          code: "PINS_LANE_UNKNOWN",
          scope: "pins",
          lanes: [lane],
          message: `Dispatch pins line ${l.line}: lane "${lane}" is in no ## Lanes table`,
        });
      }
      const prev = bulletOf.get(lane);
      if (prev !== undefined) {
        errors.push({
          code: "PINS_LANE_DUPLICATE",
          scope: "pins",
          lanes: [lane],
          message: `Dispatch pins: lane ${lane} is named in two bullets (lines ${prev} and ${l.line})`,
        });
      } else {
        bulletOf.set(lane, l.line);
      }
    }
    m.pins.bullets.push({ lanes, pins, explicitNone, line: l.line });
  }
  for (const d of m.dispatchable) {
    if (!bulletOf.has(d.lane)) {
      errors.push({
        code: FANOUT_CODES.pinsLaneAbsent,
        scope: "pins",
        lanes: [d.lane],
        message: `Dispatch pins: dispatchable lane ${d.lane} is in no bullet (write \`role=tier\` or 無 pin)`,
      });
    }
  }
}

function parseDecisions(sections: Section[], m: Manifest): void {
  const errors = m.errors;
  const decSections = sections.filter((s) => s.name.startsWith("Decisions"));
  if (decSections.length === 0) {
    const legacy = sections.find((s) => /^(人類裁決|裁決|Decision)/i.test(s.name));
    const hint = legacy ? ` (found "${legacy.heading}" — not the ## Decisions table format)` : "";
    errors.push({ code: FANOUT_CODES.decisionsSectionAbsent, scope: "decisions", message: `no "## Decisions" section found${hint}` });
    return;
  }
  if (decSections.length > 1) {
    errors.push({
      code: "DECISIONS_SECTION_DUPLICATE",
      scope: "decisions",
      message: `${decSections.length} "## Decisions" sections found (lines ${decSections.map((s) => s.line).join(", ")}); exactly one is allowed`,
    });
    return;
  }
  const s = decSections[0];
  m.decisions.present = true;
  const table = firstTable(s);
  if (table.length === 0) {
    errors.push({ code: FANOUT_CODES.decisionsTableAbsent, scope: "decisions", message: `section "${s.heading}" (line ${s.line}) has no table` });
    return;
  }
  const { header, rows } = tableRows(table);
  const headerOk = header.length === DECISIONS_HEADER.length && header.every((c, i) => c === DECISIONS_HEADER[i]);
  if (!headerOk) {
    errors.push({
      code: FANOUT_CODES.decisionsHeaderDiffers,
      scope: "decisions",
      message: `section "${s.heading}" line ${table[0].line}: header is "${header.join(" | ")}", expected exactly "${DECISIONS_HEADER.join(" | ")}"`,
    });
    return;
  }
  rows.forEach((r, idx) => {
    const n = idx + 1;
    const where = `Decisions row ${n} (line ${r.line})`;
    if (r.cells.length !== DECISIONS_HEADER.length) {
      errors.push({
        code: "DECISION_ROW_CELL_COUNT",
        scope: "decisions",
        message: `${where}: ${r.cells.length} cell(s), expected ${DECISIONS_HEADER.length}`,
      });
      return;
    }
    const [date, decider, content, source] = r.cells;
    let ok = true;
    if (!isRealDate(date)) {
      errors.push({ code: "DECISION_DATE_INVALID", scope: "decisions", message: `${where}: 日期 "${date}" is not a real YYYY-MM-DD date` });
      ok = false;
    }
    if (!(DECIDERS as readonly string[]).includes(decider)) {
      errors.push({
        code: "DECISION_DECIDER_UNKNOWN",
        scope: "decisions",
        message: `${where}: 裁決者 "${decider}" is not one of ${DECIDERS.join(", ")}`,
      });
      ok = false;
    }
    if (content === "") {
      errors.push({ code: "DECISION_FIELD_EMPTY", scope: "decisions", message: `${where}: 內容 is empty` });
      ok = false;
    }
    if (source === "") {
      errors.push({ code: "DECISION_FIELD_EMPTY", scope: "decisions", message: `${where}: 出處 is empty` });
      ok = false;
    }
    if (ok) m.decisions.rows.push({ date, decider, content, source, row: n, line: r.line });
  });
}

/** Every format error in the manifest (validate reports all of them). */
export function validateManifest(text: string): { manifest: Manifest; errors: FanoutError[] } {
  const manifest = parseManifest(text);
  return { manifest, errors: manifest.errors };
}

// --- lane lookup -------------------------------------------------------------

type LaneLookup = { ok: true; lane: DispatchableLane } | { ok: false; errors: FanoutError[] };

/**
 * Resolve a dispatchable lane for render/check. Fatal: manifest-wide Lanes
 * errors, errors attributed to this lane, LANE_NOT_FOUND, LANE_PROVISIONAL.
 */
function lookupLane(m: Manifest, laneId: string): LaneLookup {
  const fatal = m.errors.filter(
    (e) => (e.scope === "lanes" && (e.lanes === undefined || e.lanes.includes(laneId))) || (e.scope === "row" && e.lanes?.includes(laneId)),
  );
  const prov = m.provisional.find((p) => p.lane === laneId);
  if (prov) {
    const cols = prov.missingColumns.length > 0 ? prov.missingColumns.join(", ") : `(none; header "${prov.header.join(" | ")}" differs in order or extra columns)`;
    fatal.push({
      code: "LANE_PROVISIONAL",
      scope: "lanes",
      lanes: [laneId],
      message: `lane ${laneId} is in a provisional table (${prov.heading}) missing column(s): ${cols} — redo the pre-dispatch premise check and promote it to the 8-column Lanes table`,
    });
  }
  const lane = m.dispatchable.find((d) => d.lane === laneId);
  if (!lane && !prov && !fatal.some((e) => e.scope === "row")) {
    fatal.push({ code: "LANE_NOT_FOUND", scope: "lanes", lanes: [laneId], message: `lane "${laneId}" is in no ## Lanes table` });
  }
  if (fatal.length > 0 || !lane) return { ok: false, errors: fatal };
  return { ok: true, lane };
}

// --- render ------------------------------------------------------------------

export interface RenderOptions {
  summary?: string;
  reading?: string[];
  mailboxRoot?: string;
  primary?: string;
  base?: string;
  /** Directory used to resolve `primary` via `git worktree list --porcelain` when `primary` is absent. */
  manifestDir?: string;
}

export type RenderResult = { ok: true; prompt: string } | { ok: false; errors: FanoutError[] };

// 64 MiB: `git ls-tree -r` (E208) lists every path at base; execFileSync's
// 1 MiB default would fail on a large repo.
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function gitOut(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: GIT_MAX_BUFFER });
}

/** First `worktree` entry of `git worktree list --porcelain` (git lists the main worktree first). */
export function resolvePrimary(dir: string): string | undefined {
  try {
    const out = gitOut(["worktree", "list", "--porcelain"], dir);
    const first = out.split("\n").find((l) => l.startsWith("worktree "));
    return first ? first.slice("worktree ".length).trim() : undefined;
  } catch {
    return undefined;
  }
}

/** True when a worktree cell is an absolute path (platform `path.isAbsolute`). */
export function isAbsoluteWorktree(cell: string): boolean {
  return path.isAbsolute(cell);
}

export type WorktreeResolution = { ok: true; path: string } | { ok: false; code: string; message: string };

/**
 * Resolve a manifest worktree cell to the absolute, `cd`-able path render
 * substitutes into the dispatch prompt (E235b). Pure: no fs access, no
 * existence check. Rules, in order:
 *   - empty (after trim)   → WORKTREE_EMPTY
 *   - starts with "~"      → WORKTREE_TILDE (never shell-expanded: the tool
 *                            does not guess a home directory)
 *   - absolute             → the cell, byte-verbatim (no normalisation)
 *   - otherwise (relative) → path.resolve(primary, cell)
 */
export function resolveWorktree(cell: string, primary: string): WorktreeResolution {
  if (cell.trim() === "") {
    return { ok: false, code: FANOUT_CODES.worktreeEmpty, message: "worktree cell is empty — write it relative to primary (e.g. ../<lanes-dir>/<lane>)" };
  }
  if (cell.startsWith("~")) {
    return {
      ok: false,
      code: FANOUT_CODES.worktreeTilde,
      message: "worktree cell starts with \"~\" — home-directory expansion is not performed; write it relative to primary (e.g. ../<lanes-dir>/<lane>)",
    };
  }
  if (isAbsoluteWorktree(cell)) return { ok: true, path: cell };
  return { ok: true, path: path.resolve(primary, cell) };
}

function inputErr(code: string, message: string): FanoutError {
  return { code, scope: "input", message };
}

/**
 * Render the §3b dispatch prompt for one dispatchable lane. Every field comes
 * from a stated source (spec "Render field sources"); an absent source is an
 * error, never a default. If the lane itself cannot be read (not found,
 * provisional, row errors) that is the whole answer; otherwise every missing
 * source is collected before returning.
 */
export function renderPrompt(m: Manifest, laneId: string, opts: RenderOptions): RenderResult {
  const found = lookupLane(m, laneId);
  // A lane that cannot be read is the whole answer; input errors would be noise.
  if (!found.ok) return { ok: false, errors: found.errors };
  const lane = found.lane;
  const errors: FanoutError[] = [];

  errors.push(...m.errors.filter((e) => e.scope === "title"));
  let base: string | undefined;
  if (opts.base !== undefined) {
    if (SHA_RE.test(opts.base)) base = opts.base;
    else errors.push(inputErr("BASE_INVALID", `--base "${opts.base}" is not a 7–40 character lowercase hex sha`));
  } else if (m.base !== undefined) {
    base = m.base;
  } else {
    errors.push(...m.errors.filter((e) => e.scope === "base"));
  }

  // Pins: manifest-wide pins errors + errors attributed to this lane.
  errors.push(...m.errors.filter((e) => e.scope === "pins" && (e.lanes === undefined || e.lanes.includes(laneId))));

  const summary = opts.summary?.trim() ? opts.summary : undefined;
  if (summary === undefined) errors.push(inputErr(FANOUT_CODES.summaryAbsent, "--summary \"<text>\" is required (the 3b <一句話>)"));
  const reading = (opts.reading ?? []).filter((r) => r.trim() !== "");
  if (reading.length === 0) errors.push(inputErr(FANOUT_CODES.readingAbsent, "at least one --reading \"<text>\" is required (3b <計劃的必讀章節> + <票面 row>)"));

  let mailboxRoot = opts.mailboxRoot ?? m.mailbox;
  if (mailboxRoot !== undefined && mailboxRoot.trim() === "") mailboxRoot = undefined;
  if (mailboxRoot === undefined) {
    errors.push(inputErr(FANOUT_CODES.mailboxRootAbsent, "no mailbox root: pass --mailbox-root <dir> or add a \"mailbox: <dir>\" line to the manifest"));
  }

  let primary = opts.primary;
  if (primary === undefined || primary.trim() === "") {
    primary = opts.manifestDir ? resolvePrimary(opts.manifestDir) : undefined;
    if (primary === undefined) {
      errors.push(inputErr(FANOUT_CODES.primaryNotFound, "no --primary and the manifest's directory is not inside a git repo (git worktree list --porcelain failed)"));
    }
  }

  let slug: string | undefined;
  if (lane.branch.startsWith("feat/") && lane.branch.length > "feat/".length) slug = lane.branch.slice("feat/".length);
  else {
    errors.push({
      code: "BRANCH_NOT_FEAT",
      scope: "row",
      lanes: [lane.lane],
      message: `lane ${lane.lane}: branch "${lane.branch}" does not start with feat/ — ticket-slug cannot be derived`,
    });
  }

  // Worktree: resolved against primary (E235b). Skipped when primary is
  // absent — there is no base to resolve against, and PRIMARY_NOT_FOUND
  // already reports that condition.
  let worktree: string | undefined;
  if (primary !== undefined) {
    const wt = resolveWorktree(lane.worktree, primary);
    if (wt.ok) worktree = wt.path;
    else errors.push({ code: wt.code, scope: "row", lanes: [lane.lane], message: `lane ${lane.lane}: ${wt.message}` });
  }

  if (errors.length > 0) return { ok: false, errors };

  let pinsText = PINS_NONE;
  const bullet = m.pins.bullets.find((b) => b.lanes.includes(lane.lane));
  if (bullet && bullet.pins.length > 0) pinsText = bullet.pins.map((p) => `${p.role}=${p.tier}`).join(", ");

  const root = mailboxRoot!.length > 1 ? mailboxRoot!.replace(/\/+$/, "") : mailboxRoot!;
  const values: Record<string, string> = {
    "<lanes-root>/_mailbox/<lane>/": `${root}/${lane.lane}/`,
    "<計劃的必讀章節> + <票面 row>": reading.join(" + "),
    "做：<…>　不做：<…>": lane.scopeCut,
    "<計劃或 feature>": m.title!,
    "<例如 sr-engineer=fable>": pinsText,
    "<primary 路徑>": primary!,
    "<ticket-slug>": slug!,
    "<一句話>": summary!,
    "<worktree>": worktree!,
    "<branch>": lane.branch,
    "<base>": base!,
    "<lane>": lane.lane,
    "<擁有>": lane.owned,
    "<禁止>": lane.forbidden,
    "<票>": lane.ticket,
  };
  // Single pass so substituted cell text is never re-scanned for placeholders.
  const keys = Object.keys(values).sort((a, b) => b.length - a.length);
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const prompt = PROMPT_TEMPLATE_3B.replace(re, (k) => values[k]);
  return { ok: true, prompt };
}

// --- glob + check ------------------------------------------------------------

/** Expand `{a,b}` alternation (non-nested groups, any number of them). */
export function expandBraces(glob: string): string[] {
  const m = /\{([^{}]*)\}/.exec(glob);
  if (!m) return [glob];
  const pre = glob.slice(0, m.index);
  const post = glob.slice(m.index + m[0].length);
  return m[1].split(",").flatMap((alt) => expandBraces(pre + alt + post));
}

function segmentToRe(seg: string): string {
  return seg
    .split("*")
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
}

/**
 * Compile one glob (spec "Glob semantics"): repo-relative, `/`-separated;
 * `**` = zero or more whole segments, `*` = within one segment, `{a,b}` =
 * alternation, trailing `/` = `<token>**`, no glob chars = exact path.
 */
export function globToRegExps(token: string): RegExp[] {
  const glob = token.endsWith("/") ? `${token}**` : token;
  return expandBraces(glob).map((g) => {
    const segs = g.split("/");
    let re = "^";
    let needSep = false;
    segs.forEach((seg, i) => {
      const last = i === segs.length - 1;
      if (seg === "**") {
        if (last) re += i === 0 ? ".*" : "(?:/[^/]+)*";
        else {
          re += (needSep ? "/" : "") + "(?:[^/]+/)*";
          needSep = false;
        }
        return;
      }
      re += (needSep ? "/" : "") + segmentToRe(seg);
      needSep = true;
    });
    return new RegExp(re + "$");
  });
}

export function matchesGlob(filePath: string, token: string): boolean {
  return globToRegExps(token).some((r) => r.test(filePath));
}

/** Implicit lane bookkeeping — always in bounds for `check`. */
export function isImplicitBookkeeping(filePath: string, lane: string): boolean {
  if (filePath.startsWith(`.current/${lane}/`)) return true;
  if (matchesGlob(filePath, `specs/${lane}-*.md`)) return true;
  if (filePath.startsWith("qa_reports/") || filePath.startsWith("review_reports/")) {
    return path.posix.basename(filePath).toLowerCase().includes(lane.toLowerCase());
  }
  return false;
}

export interface CheckOptions {
  base?: string;
  /** Directory inside the target repo. Library default: cwd; the CLI defaults to the manifest's directory. */
  repo?: string;
}

export interface CheckReport {
  lane: string;
  branch: string;
  base: string;
  changed: string[];
  out: { path: string; forbidden?: string }[];
  /** E208: exact 擁有 tokens matching no path at base and no file added on the branch. Warning only. */
  unmatchedOwned: string[];
  /** Set when the E208 existence check could not run (the git ls-tree read failed). */
  unmatchedCheckError?: string;
  output: string;
  exitCode: 0 | 1;
}

export type CheckResult = { ok: true; report: CheckReport } | { ok: false; errors: FanoutError[] };

/** E208 warning line (spec e178b Copy/Strings fanout.warn). */
export const UNMATCHED_OWNED_WARN = (token: string, base: string, branch: string): string =>
  `WARN  ${token}  (擁有 token matches no path at ${base} and is not a glob or a file added on ${branch})`;

/**
 * E208 glob token: contains `*` or `{`, or ends with `/`. Never warned about
 * — the lane may be the one creating the files it names.
 */
export function isGlobToken(token: string): boolean {
  return token.includes("*") || token.includes("{") || token.endsWith("/");
}

/**
 * E208 (spec e178b decision (i)) — the exact (non-glob) owned tokens that
 * match no path in `basePaths` and no file in `addedPaths` (files the lane
 * branch added vs base: a declared new file such as e177a's
 * `新檔 tools/fanout-manifest.ts`). Pure; each token reported once, in
 * 擁有 order. A token that matches nothing grants no ownership either, so it
 * is usually a prose aside that happens to be path-shaped.
 */
export function unmatchedOwnedTokens(ownedTokens: string[], basePaths: string[], addedPaths: string[]): string[] {
  const out: string[] = [];
  for (const t of new Set(ownedTokens)) {
    if (isGlobToken(t)) continue;
    if (basePaths.some((p) => matchesGlob(p, t))) continue;
    if (addedPaths.some((p) => matchesGlob(p, t))) continue;
    out.push(t);
  }
  return out;
}

function nulList(raw: string): string[] {
  return raw.split("\0").filter((p) => p.length > 0);
}

function refOk(ref: string, cwd: string): boolean {
  try {
    gitOut(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fan-in ownership check: every file the lane branch changed vs `<base>`
 * (committed changes only — E158) that is outside the owned tokens and the
 * implicit bookkeeping set is listed on its own OUT line; exit 1 if any.
 */
export function checkLane(m: Manifest, laneId: string, opts: CheckOptions = {}): CheckResult {
  const found = lookupLane(m, laneId);
  if (!found.ok) return { ok: false, errors: found.errors };
  const lane = found.lane;
  const base = opts.base ?? "main";
  const repo = opts.repo ?? process.cwd();
  const errors: FanoutError[] = [];

  try {
    gitOut(["rev-parse", "--git-dir"], repo);
  } catch {
    return { ok: false, errors: [inputErr("REPO_NOT_GIT", `--repo "${repo}" is not inside a git repository`)] };
  }
  for (const [what, ref] of [
    ["base", base],
    ["branch", lane.branch],
  ] as const) {
    if (ref.startsWith("-") || /\s/.test(ref)) {
      errors.push(inputErr("REF_INVALID", `${what} ref "${ref}" is not a valid git ref`));
    } else if (!refOk(ref, repo)) {
      errors.push(inputErr("REF_NOT_FOUND", `${what} ref "${ref}" does not resolve (git rev-parse --verify) in ${repo}`));
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const raw = gitOut(["diff", "--no-renames", "--name-only", "-z", `${base}...${lane.branch}`, "--"], repo);
  const changed = [...new Set(raw.split("\0").filter((p) => p.length > 0))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const out: { path: string; forbidden?: string }[] = [];
  for (const p of changed) {
    if (lane.ownedTokens.some((t) => matchesGlob(p, t))) continue;
    if (isImplicitBookkeeping(p, lane.lane)) continue;
    out.push({ path: p, forbidden: lane.forbiddenTokens.find((t) => matchesGlob(p, t)) });
  }

  // E208 — owned-token existence check (warning only; exit code unchanged).
  // Runs after the ref checks above, so both refs resolve here. --full-tree:
  // ls-tree is otherwise relative to cwd, and the CLI's default --repo is the
  // manifest's own directory (specs/), not the repo root.
  let unmatchedOwned: string[] = [];
  let unmatchedCheckError: string | undefined;
  try {
    const basePaths = nulList(gitOut(["ls-tree", "--full-tree", "-r", "--name-only", "-z", base], repo));
    const added = nulList(
      gitOut(["diff", "--no-renames", "--name-only", "--diff-filter=A", "-z", `${base}...${lane.branch}`, "--"], repo),
    );
    unmatchedOwned = unmatchedOwnedTokens(lane.ownedTokens, basePaths, added);
  } catch (err) {
    unmatchedCheckError = ((err as Error).message ?? String(err)).split(/\r?\n/)[0];
  }

  const lines = [
    `owned (from 擁有): ${lane.ownedTokens.join(", ")}`,
    `implicit lane bookkeeping: .current/${lane.lane}/**, specs/${lane.lane}-*.md, qa_reports|review_reports/*${lane.lane}* (case-insensitive)`,
    ...out.map((o) => `OUT  ${o.path}${o.forbidden ? `  (禁止: ${o.forbidden})` : ""}`),
    `fanout check: ${lane.lane} — ${changed.length} file(s) changed, ${out.length} out of bounds`,
    E158_NOTE(base, lane.branch),
    PROSE_NOTE,
    // E208 lines strictly AFTER every pre-existing line, which stay byte-identical.
    ...unmatchedOwned.map((t) => UNMATCHED_OWNED_WARN(t, base, lane.branch)),
    ...(unmatchedCheckError !== undefined
      ? [`note: 擁有 token existence check skipped — git ls-tree ${base} failed: ${unmatchedCheckError}`]
      : []),
  ];
  return {
    ok: true,
    report: {
      lane: lane.lane,
      branch: lane.branch,
      base,
      changed,
      out,
      unmatchedOwned,
      ...(unmatchedCheckError !== undefined && { unmatchedCheckError }),
      output: lines.join("\n") + "\n",
      exitCode: out.length > 0 ? 1 : 0,
    },
  };
}

// --- CLI entry points (scripts/fanout.mjs is a thin shell over these) --------

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: 0 | 1 | 2;
}

export function formatError(e: Pick<FanoutError, "code" | "message">): string {
  return `fanout: error: ${e.code}: ${e.message}`;
}

function fail(errors: Pick<FanoutError, "code" | "message">[]): CliResult {
  return { stdout: "", stderr: errors.map(formatError).join("\n") + "\n", exitCode: 2 };
}

export function usageResult(message?: string): CliResult {
  const lines = message ? [formatError({ code: "USAGE", message }), USAGE] : [USAGE];
  return { stdout: "", stderr: lines.join("\n") + "\n", exitCode: 2 };
}

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string[]>;
}

function parseArgs(args: string[], allowed: readonly string[]): ParsedArgs | string {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      if (!allowed.includes(a)) return `unknown flag ${a}`;
      if (i + 1 >= args.length) return `flag ${a} needs a value`;
      const v = args[++i];
      flags.set(a, [...(flags.get(a) ?? []), v]);
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function single(p: ParsedArgs, flag: string): string | undefined | { error: string } {
  const v = p.flags.get(flag);
  if (!v) return undefined;
  if (v.length > 1) return { error: `flag ${flag} given more than once` };
  return v[0];
}

function readManifest(file: string): { text: string } | { error: FanoutError } {
  try {
    return { text: fs.readFileSync(file, "utf8") };
  } catch (err) {
    return {
      error: { code: "MANIFEST_UNREADABLE", scope: "input", message: `cannot read manifest "${file}": ${(err as Error).message}` },
    };
  }
}

export function runValidate(args: string[]): CliResult {
  const p = parseArgs(args, []);
  if (typeof p === "string") return usageResult(p);
  if (p.positional.length !== 1) return usageResult("validate takes exactly one <manifest>");
  const r = readManifest(p.positional[0]);
  if ("error" in r) return fail([r.error]);
  const { manifest, errors } = validateManifest(r.text);
  if (errors.length > 0) return fail(errors);
  // E235b: one non-fatal WARN per dispatchable row whose worktree cell is
  // absolute (exit code stays 0). Provisional rows have no worktree contract.
  const warns = manifest.dispatchable
    .filter((l) => isAbsoluteWorktree(l.worktree))
    .map((l) => `${WORKTREE_ABSOLUTE_WARN(l.lane, l.line)}\n`)
    .join("");
  return {
    stdout: `fanout: ok — ${manifest.dispatchable.length} dispatchable lane(s), ${manifest.provisional.length} provisional, ${manifest.decisions.rows.length} decision(s)\n${warns}`,
    stderr: "",
    exitCode: 0,
  };
}

export function runRender(args: string[]): CliResult {
  const p = parseArgs(args, ["--summary", "--reading", "--mailbox-root", "--primary", "--base"]);
  if (typeof p === "string") return usageResult(p);
  if (p.positional.length !== 2) return usageResult("render takes <manifest> <lane>");
  const opts: RenderOptions = { reading: p.flags.get("--reading") ?? [] };
  for (const [flag, key] of [
    ["--summary", "summary"],
    ["--mailbox-root", "mailboxRoot"],
    ["--primary", "primary"],
    ["--base", "base"],
  ] as const) {
    const v = single(p, flag);
    if (typeof v === "object") return usageResult(v.error);
    if (v !== undefined) opts[key] = v;
  }
  const [file, lane] = p.positional;
  const r = readManifest(file);
  if ("error" in r) return fail([r.error]);
  opts.manifestDir = path.dirname(path.resolve(file));
  const res = renderPrompt(parseManifest(r.text), lane, opts);
  if (!res.ok) return fail(res.errors);
  return { stdout: res.prompt, stderr: "", exitCode: 0 };
}

export function runCheck(args: string[]): CliResult {
  const p = parseArgs(args, ["--base", "--repo"]);
  if (typeof p === "string") return usageResult(p);
  if (p.positional.length !== 2) return usageResult("check takes <manifest> <lane>");
  const base = single(p, "--base");
  const repo = single(p, "--repo");
  if (typeof base === "object") return usageResult(base.error);
  if (typeof repo === "object") return usageResult(repo.error);
  const [file, lane] = p.positional;
  const r = readManifest(file);
  if ("error" in r) return fail([r.error]);
  // Same default as render: the git repo that holds the manifest, not cwd.
  const res = checkLane(parseManifest(r.text), lane, { base, repo: repo ?? path.dirname(path.resolve(file)) });
  if (!res.ok) return fail(res.errors);
  return { stdout: res.report.output, stderr: "", exitCode: res.report.exitCode };
}
