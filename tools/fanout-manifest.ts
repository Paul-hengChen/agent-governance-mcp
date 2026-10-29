// Coded by @sr-engineer
// Fan-out manifest parser (parseManifest / validateManifest), dispatch-prompt
// renderer (renderPrompt), fan-in ownership check (checkLane) and pre-commit
// cut containment check (checkCut); the format contract is the table in
// specs/e177a-fanout-manifest.md. It never guesses:
// a legacy manifest part is reported unreadable by name. Read-only: writes
// nothing of its own and fires no gate (render reads primary's config through
// loadConfig, which shares that loader's heal-on-read); git is read via
// execFileSync argv, never a shell.
// Why: specs/e260a-tools-a-h-rationale.md, "tools/fanout-manifest.ts — never guess".

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfigError, loadConfig } from "./config.js";

// --- constants ---------------------------------------------------------------

/** Exact header of a dispatchable `## Lanes…` table, in order. */
export const LANES_HEADER = ["lane", "票", "branch", "worktree", "擁有", "禁止", "範圍切線", "相依"] as const;

/**
 * Optional 9th header cell of a dispatchable `## Lanes…` table. Absent in
 * every older manifest, so the 8-column shape stays exact and dispatchable.
 */
export const APPROVAL_COLUMN = "approval" as const;

/**
 * Allowed `approval` cell values ("" = empty cell, "—" is U+2014). Anything
 * else is a row error: a misspelt `human` must never read as "not human".
 */
export const APPROVAL_VALUES = ["human", "—", ""] as const;

/** Exact header of a spec's `## Cut` table (= skill-pm's inline cut table header). */
export const CUT_HEADER = ["id", "desc", "depends_on", "est. files", "touches", "design-link"] as const;

/**
 * A line a Markdown renderer shows as a Cut heading: up to three leading
 * spaces, `##`, a space or tab, `cut` in any case, optional closing `#`s.
 */
const CUT_HEADING_RE = /^ {0,3}##[ \t]+cut[ \t#]*$/i;

/** `touches` value for a ticket that writes only governance bookkeeping. */
export const CUT_TOUCHES_NONE = "—";

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
export const BASE_RE = /^base:\s*([0-9a-f]{7,40})\b/;
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
\`feature start\` 建好 worktree 之後，呼叫 \`EnterWorktree\`（path = <worktree>）把這個 session 切進去；這個工具不能用時，每個 Bash 指令照舊自帶 \`cd <worktree> &&\`。
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

/** The template's single lane-rules pointer, used while laneProtocolAddendum is unset. */
export const LANE_PROTOCOL_POINTER = "先完整讀 docs/lane-protocol.md（共同規則，包括信箱與回報格式），";

/**
 * `template` with its one LANE_PROTOCOL_POINTER replaced by `replacement`,
 * or undefined when the pointer occurs zero times or more than once — so a
 * template whose wording drifted can never silently drop the addendum. (E343)
 */
export function replaceLanePointer(template: string, replacement: string): string | undefined {
  const at = template.indexOf(LANE_PROTOCOL_POINTER);
  if (at < 0 || template.indexOf(LANE_PROTOCOL_POINTER, at + 1) >= 0) return undefined;
  return template.slice(0, at) + replacement + template.slice(at + LANE_PROTOCOL_POINTER.length);
}

/**
 * Replacement for LANE_PROTOCOL_POINTER when primary's config sets
 * laneProtocolAddendum: agc's generic lane rules plus the repo's addendum.
 * `<generic>` and `<addendum>` are filled by the same single substitution
 * pass as every other placeholder.
 */
const LANE_PROTOCOL_POINTER_TWO_LAYER = "先完整讀 <generic>（agc 通用規則，包括信箱與回報格式）和 <addendum>（本 repo 的補充規則），";

/** agc's generic lane rules, relative to an agc checkout or install root. */
const GENERIC_LANE_PROTOCOL = "docs/lane-protocol.md";

/**
 * Root of the agc install that holds this module: two directories up from
 * the compiled dist/tools/fanout-manifest.js. The package ships the whole
 * repo, docs/ included, so the generic lane rules live under it.
 */
const DEFAULT_INSTALL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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
  // Render-only row errors: an unusable worktree cell. Not raised by the
  // parser, so validate/check exit codes never change because of them. (E235b)
  worktreeEmpty: "WORKTREE_EMPTY",
  worktreeTilde: "WORKTREE_TILDE",
  // Render-only input error: a `mailbox:` header starting with "~". Not
  // raised by the parser, so validate never fails because of it. (E248)
  mailboxTilde: "MAILBOX_TILDE",
  // Optional `approval` Lanes column holds a value outside APPROVAL_VALUES.
  approvalValueUnknown: "APPROVAL_VALUE_UNKNOWN",
  // check --cut manifest-side failures (exit 1, reported as FAIL lines).
  approvalHuman: "APPROVAL_HUMAN",
  decisionsHumanRowAbsent: "DECISIONS_HUMAN_ROW_ABSENT",
  // check --cut spec-side format errors (exit 2): the `## Cut` table.
  cutSectionAbsent: "CUT_SECTION_ABSENT",
  cutSectionDuplicate: "CUT_SECTION_DUPLICATE",
  cutTableAbsent: "CUT_TABLE_ABSENT",
  cutHeaderDiffers: "CUT_HEADER_DIFFERS",
  cutRowMalformed: "CUT_ROW_MALFORMED",
  cutTouchesUnquotedPath: "CUT_TOUCHES_UNQUOTED_PATH",
  cutTouchesEmpty: "CUT_TOUCHES_EMPTY",
  // A path-shaped touches span that is not a bare, normalised repo path.
  cutTouchesMalformedPath: "CUT_TOUCHES_MALFORMED_PATH",
  specUnreadable: "SPEC_UNREADABLE",
  // owners input errors (exit 2).
  rangeInvalid: "RANGE_INVALID",
  pathsUnreadable: "PATHS_UNREADABLE",
  // render input errors, raised only while primary's config sets
  // laneProtocolAddendum (exit 2): the value is not a relative path inside
  // the repo, it names no file under primary, or the agc install lacks the
  // generic lane rules.
  addendumInvalid: "ADDENDUM_INVALID",
  addendumAbsent: "ADDENDUM_ABSENT",
  laneProtocolAbsent: "LANE_PROTOCOL_ABSENT",
  // render input error while the two-layer pointer applies (exit 2): the
  // template does not hold LANE_PROTOCOL_POINTER exactly once. (E343)
  templatePointerAbsent: "TEMPLATE_POINTER_ABSENT",
  // owners --range / check input error (exit 2): the `git diff <a>...<b>`
  // itself failed, e.g. the two sides share no merge base.
  gitDiffFailed: "GIT_DIFF_FAILED",
  // owners --range / check input error (exit 2): the `git diff <a>...<b>`
  // lists no path, so a pass would inspect nothing. (E158)
  rangeEmpty: "RANGE_EMPTY",
} as const;

/**
 * validate warning for a dispatchable row whose worktree cell is an absolute
 * path. The absolute value is deliberately NOT echoed, so the warning never
 * repeats a local path in its own output. (E235b)
 */
export const WORKTREE_ABSOLUTE_WARN = (lane: string, line: number): string =>
  `WARN  lane ${lane} (line ${line}): worktree cell is an absolute path — write it relative to primary (e.g. ../<lanes-dir>/${lane}); render still accepts it`;

/**
 * validate warning for an absolute `mailbox:` header. Like
 * WORKTREE_ABSOLUTE_WARN, the absolute value is deliberately NOT echoed.
 */
export const MAILBOX_ABSOLUTE_WARN = (line: number): string =>
  `WARN  mailbox header (line ${line}): mailbox: is an absolute path — write it relative to primary (e.g. ../<lanes-dir>/_mailbox); render still accepts it`;

export const PINS_NONE = "無";

/** Usage of the owners subcommand, printed on its own usage errors. */
export const OWNERS_USAGE = "usage: node scripts/fanout.mjs owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)";

/** Usage of the handoff subcommand, printed on its own usage errors. */
export const HANDOFF_USAGE =
  "usage: node scripts/fanout.mjs handoff [--check] <manifest> [--target <branch>] [--repo <dir>] [--mailbox-root <dir>] [--closing]";

/** A subcommand usage line as a continuation line of USAGE (`usage: ` → 7 spaces). */
const usageContinuation = (line: string): string => `       ${line.slice("usage: ".length)}`;

export const USAGE = [
  "usage: node scripts/fanout.mjs validate <manifest>",
  "       node scripts/fanout.mjs render <manifest> <lane> --summary <text> --reading <text>... [--mailbox-root <dir>] [--primary <path>] [--base <sha>]",
  "       node scripts/fanout.mjs check <manifest> <lane> [--base main] [--repo <dir>]",
  "       node scripts/fanout.mjs check --cut <manifest> <lane> <spec>",
  usageContinuation(OWNERS_USAGE),
  usageContinuation(HANDOFF_USAGE),
].join("\n");

export const E158_NOTE = (base: string, branch: string): string =>
  `note: only committed changes were checked (git diff --no-renames --name-only ${base}...${branch}); uncommitted and untracked work in the worktree was NOT checked (E158).`;
export const PROSE_NOTE = "note: prose restrictions inside 擁有 (e.g. （只限 …）) are not machine-checked.";
export const CUT_GLOB_NOTE =
  "note: a glob in touches is in bounds only when byte-identical to an 擁有 token; glob-in-glob containment is never inferred.";

// --- types -------------------------------------------------------------------

/**
 * Which part of the manifest an error belongs to. render/check use it to
 * decide which errors are fatal for the lane they target (a Decisions error
 * never blocks a render; a row error blocks only its own lane).
 * "input" = a CLI/environment input (flag, git ref, file), not the manifest text.
 * "cut" = the `## Cut` table of a lane spec read by check --cut.
 * "handoff" = a closed manifest's `## 接手步驟` section (validate only).
 * "external" = the optional `## 外部依賴` section (validate and handoff --check only).
 */
export type FanoutErrorScope = "title" | "base" | "lanes" | "row" | "pins" | "decisions" | "cut" | "input" | "handoff" | "external";

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
  /**
   * Optional 9th `approval` cell: "human" when the cell is `human`; undefined
   * for `—`, empty, or an 8-column table. Read only by check --cut.
   */
  approval: "human" | undefined;
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
  /** 1-based line of the `mailbox:` header match that won (first match). */
  mailboxLine?: number;
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
  for (const [i, l] of lines.entries()) {
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
      if (mb) {
        m.mailbox = mb[1];
        m.mailboxLine = i + 1;
      }
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
    if (!isDispatchableHeader(header)) {
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
      // Compared to this table's own header, so an 8-column table reports
      // exactly the 8-column message it always did.
      if (r.cells.length !== header.length) {
        rowErr("ROW_CELL_COUNT", `row has ${r.cells.length} cell(s), expected ${header.length} (${header.join(" | ")})`);
        continue;
      }
      const [lane, ticket, branch, worktree, owned, forbidden, scopeCut, deps] = r.cells;
      const approvalCell = header.length > LANES_HEADER.length ? r.cells[LANES_HEADER.length] : "";
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
      // Case-sensitive on purpose: `Human`, ASCII `-`, `yes` are errors, not guesses.
      if (!(APPROVAL_VALUES as readonly string[]).includes(approvalCell)) {
        rowErr(FANOUT_CODES.approvalValueUnknown, `approval cell is "${approvalCell}" — allowed: human, —, or empty`);
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
        approval: approvalCell === "human" ? "human" : undefined,
      });
    }
  }
  return new Set(seen.keys());
}

/**
 * A Lanes table is dispatchable when its header is exactly LANES_HEADER, or
 * exactly LANES_HEADER followed by the optional `approval` column. Any other
 * shape (a different 9th cell, reordered columns) stays provisional.
 */
function isDispatchableHeader(h: string[]): boolean {
  const prefixOk = LANES_HEADER.every((c, i) => h[i] === c);
  if (!prefixOk) return false;
  return h.length === LANES_HEADER.length || (h.length === LANES_HEADER.length + 1 && h[LANES_HEADER.length] === APPROVAL_COLUMN);
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

// --- closed-manifest handoff section (validate only) -------------------------

/** Status-line text (after removing every `**`) marking a closed manifest. */
const STATUS_LINE_RE = /^狀態[：:]/;
const STATUS_CLOSED_RE = /^狀態[：:]\s*已結案/;

/** Name of the handoff section a closed manifest must carry. */
export const HANDOFF_SECTION = "接手步驟";

/** Sub-items (`### ` headings) every handoff section must hold, each exactly once with a non-empty body; their order is not checked. */
export const HANDOFF_SUBITEMS = ["核對 primary", "已結案", "待人類決定", "進行中的背景工作"] as const;

/** The sub-item whose single body line must read 無 once the wave is closed. */
export const HANDOFF_BACKGROUND = "進行中的背景工作";
export const HANDOFF_NONE = "無";

/**
 * Characters after which a path token may start: whitespace, quotes, opening
 * brackets, fullwidth and ASCII colon / comma, `、`, `=` and `|`.
 */
const PATH_BOUNDARY = "[\\s`'\"(\\[（「：，、=:,|]";

/**
 * Where a path token may start: a line start, a boundary character, or a
 * bold opener `**` that itself follows a line start or a boundary character
 * (so `tools/**` + `/a/b` is not a start). A backtick never opens bold:
 * inside a code span `**` is literal, so a glob written in a code span
 * (`**` + `/a/b` after a backtick) is not a path start. Every other boundary
 * before `**` still opens bold — the remedy for a bare glob that reads as an
 * absolute path is to write the glob inside a code span.
 */
const PATH_START = `(?:^|${PATH_BOUNDARY})(?:(?<!\`)\\*\\*)?`;

/**
 * Machine-local absolute path forms:
 * - Windows drive: `C:\` or `C:/`;
 * - home: `~/` or `~<name>/`, the name starting with a letter or `_`, so a
 *   date such as `~10/17` is not one;
 * - POSIX: `/` + two or more segments, the first non-empty;
 * - `file:///`;
 * - `$HOME/` and `${HOME}/`;
 * - UNC: `\\<host>\<share>`.
 * A URL's `//` (after `https:`) and a protocol-relative `//host/a` never
 * match: the POSIX form needs a non-empty first segment.
 */
const PATH_FORMS = [
  "[A-Za-z]:[\\\\/]",
  "~(?:[A-Za-z_][A-Za-z0-9._-]*)?\\/",
  "\\/[^\\s/]+\\/[^\\s/]",
  "file:\\/\\/\\/",
  "\\$(?:HOME|\\{HOME\\})\\/",
  "\\\\\\\\[^\\s\\\\/]+\\\\[^\\s\\\\/]",
];

const HANDOFF_ABSOLUTE_PATH_RE = new RegExp(`${PATH_START}(?:${PATH_FORMS.join("|")})`);

/**
 * Error codes of the closed-manifest handoff check. CLI codes, named outside
 * the gate-suffix vocabulary like FANOUT_CODES.
 */
export const HANDOFF_CODES = {
  sectionAbsent: "HANDOFF_SECTION_ABSENT",
  sectionDuplicate: "HANDOFF_SECTION_DUPLICATE",
  subitemAbsent: "HANDOFF_SUBITEM_ABSENT",
  subitemDuplicate: "HANDOFF_SUBITEM_DUPLICATE",
  subitemEmpty: "HANDOFF_SUBITEM_EMPTY",
  backgroundNotNone: "HANDOFF_BACKGROUND_NOT_NONE",
  absolutePath: "HANDOFF_ABSOLUTE_PATH",
} as const;

/** Heading name `name`, or `name` followed by a `（…）` / `(…)` qualifier. */
export function isNamedHeading(heading: string, name: string): boolean {
  return heading === name || heading.startsWith(`${name}（`) || heading.startsWith(`${name}(`);
}

/**
 * Whether a manifest is closed: its status line — the first line before the
 * first `## ` heading that, with every `**` removed, starts `狀態：` (or
 * `狀態:`) — reads `已結案` right after the colon. Any other wording
 * (`結案 …`, `已合併`, `…；已結案`) is not closed.
 */
export function isManifestClosed(text: string): boolean {
  for (const line of splitLines(text)) {
    if (line.startsWith("## ")) return false;
    const plain = line.replaceAll("**", "");
    if (STATUS_LINE_RE.test(plain)) return STATUS_CLOSED_RE.test(plain);
  }
  return false;
}

function handoffErr(code: string, message: string): FanoutError {
  return { code, scope: "handoff", message };
}

/**
 * Format errors of a closed manifest's `## 接手步驟` section: present once,
 * each mandatory `### ` sub-item present once with a body, the background
 * sub-item reading 無, and no machine-local absolute path on any line.
 * Optional (`裝置`, `工具`) and unknown sub-items are not checked.
 */
export function handoffSectionErrors(text: string): FanoutError[] {
  const sections = findHandoffSections(text);
  if (sections.length === 0) {
    return [handoffErr(HANDOFF_CODES.sectionAbsent, `manifest is closed (status 已結案) but has no "## ${HANDOFF_SECTION}" section`)];
  }
  if (sections.length > 1) {
    return [
      handoffErr(
        HANDOFF_CODES.sectionDuplicate,
        `${sections.length} "## ${HANDOFF_SECTION}" sections found (lines ${sections.map((s) => s.line).join(", ")}); exactly one is allowed`,
      ),
    ];
  }
  const s = sections[0];
  const errors: FanoutError[] = [];

  // Sub-items: each `### ` heading opens a body that runs to the next one.
  const subitems: { name: string; line: number; body: string[] }[] = [];
  for (const l of s.lines) {
    if (l.text.startsWith("### ")) subitems.push({ name: l.text.slice(4).trim(), line: l.line, body: [] });
    else subitems.at(-1)?.body.push(l.text);
  }
  for (const name of HANDOFF_SUBITEMS) {
    const found = subitems.filter((x) => isNamedHeading(x.name, name));
    if (found.length === 0) {
      errors.push(handoffErr(HANDOFF_CODES.subitemAbsent, `"## ${HANDOFF_SECTION}" (line ${s.line}) has no "### ${name}" sub-item`));
      continue;
    }
    if (found.length > 1) {
      errors.push(
        handoffErr(HANDOFF_CODES.subitemDuplicate, `"### ${name}" appears ${found.length} times (lines ${found.map((x) => x.line).join(", ")})`),
      );
      continue;
    }
    const filled = found[0].body.filter((b) => b.trim() !== "");
    if (filled.length === 0) {
      errors.push(handoffErr(HANDOFF_CODES.subitemEmpty, `"### ${name}" (line ${found[0].line}) is empty`));
      continue;
    }
    if (name === HANDOFF_BACKGROUND && (filled.length !== 1 || !readsNone(filled[0]))) {
      errors.push(
        handoffErr(HANDOFF_CODES.backgroundNotNone, `"### ${HANDOFF_BACKGROUND}" (line ${found[0].line}) must read 無 when the manifest is closed`),
      );
    }
  }

  // The path itself is never echoed (WORKTREE_ABSOLUTE_WARN convention).
  for (const l of [{ text: s.heading, line: s.line }, ...s.lines]) {
    if (HANDOFF_ABSOLUTE_PATH_RE.test(l.text)) {
      errors.push(
        handoffErr(
          HANDOFF_CODES.absolutePath,
          `"## ${HANDOFF_SECTION}" line ${l.line} has a machine-local absolute path — write it relative to primary or as a placeholder`,
        ),
      );
    }
  }
  return errors;
}

/** Every `## 接手步驟` section (name optionally qualified), in file order. */
export function findHandoffSections(text: string): { heading: string; line: number; lines: { text: string; line: number }[] }[] {
  return splitSections(splitLines(text))
    .filter((s) => isNamedHeading(s.name, HANDOFF_SECTION))
    .map((s) => ({ heading: s.heading, line: s.line, lines: s.lines }));
}

/** `無`, optionally after one `- ` / `* ` list marker and before one `。`. */
export function readsNone(line: string): boolean {
  let t = line.trim();
  if (t.startsWith("- ") || t.startsWith("* ")) t = t.slice(2).trim();
  if (t.endsWith("。")) t = t.slice(0, -1).trim();
  return t === HANDOFF_NONE;
}

// --- optional external-dependency section (validate + handoff --check) -------

/** Name of the optional section recording work this wave depends on in sister repos. */
export const EXTERNAL_DEPS_SECTION = "外部依賴";

/** Exact header of the `## 外部依賴` table; `repo` is a `sisterRepos` name. */
export const EXTERNAL_DEPS_HEADER = ["repo", "票", "branch", "sha", "協定出處"] as const;

/**
 * Format error codes of the `## 外部依賴` section. CLI codes, named outside
 * the gate-suffix vocabulary like FANOUT_CODES.
 */
export const EXTERNAL_DEPS_CODES = {
  sectionDuplicate: "EXTERNAL_DEPS_SECTION_DUPLICATE",
  tableAbsent: "EXTERNAL_DEPS_TABLE_ABSENT",
  headerDiffers: "EXTERNAL_DEPS_HEADER_DIFFERS",
  rowInvalid: "EXTERNAL_DEPS_ROW_INVALID",
} as const;

/** One well-formed `## 外部依賴` row (repo, branch and sha with one backtick pair stripped). */
export interface ExternalDep {
  repo: string;
  ticket: string;
  branch: string;
  sha: string;
  source: string;
  /** 1-based data-row number within the table. */
  row: number;
  line: number;
}

export interface ExternalDepsRead {
  /** Whether the manifest has at least one `## 外部依賴` heading. */
  present: boolean;
  /** Well-formed rows in table order; empty whenever a section-level error is found. */
  rows: ExternalDep[];
  errors: FanoutError[];
}

function externalErr(code: string, message: string): FanoutError {
  return { code, scope: "external", message };
}

/** The cell with one surrounding backtick pair removed. */
function unBacktick(cell: string): string {
  return cell.length >= 2 && cell.startsWith("`") && cell.endsWith("`") ? cell.slice(1, -1) : cell;
}

/** Why a `## 外部依賴` data row is malformed (the first defect found), or undefined. */
function externalRowDefect(cells: string[]): string | undefined {
  if (cells.length !== EXTERNAL_DEPS_HEADER.length) return `${cells.length} cell(s), expected ${EXTERNAL_DEPS_HEADER.length}`;
  const [rawRepo, ticket, rawBranch, rawSha, source] = cells;
  const repo = unBacktick(rawRepo);
  const branch = unBacktick(rawBranch);
  const sha = unBacktick(rawSha);
  if (!LANE_ID_RE.test(repo) || repo === "." || repo === "..") return `repo "${repo}" is not a name of [A-Za-z0-9_.-]`;
  if (ticket === "") return "票 is empty";
  if (branch === "" || /\s/.test(branch) || branch.startsWith("-")) return `branch "${branch}" is not a single ref name`;
  if (!SHA_RE.test(sha)) return `sha "${sha}" is not 7–40 lowercase hex`;
  if (source === "") return "協定出處 is empty";
  return undefined;
}

/**
 * Read the optional `## 外部依賴` section (heading name optionally qualified).
 * Pure. No section ⇒ no rows and no errors. Otherwise: exactly one section,
 * its first table headed exactly EXTERNAL_DEPS_HEADER with at least one data
 * row, and one EXTERNAL_DEPS_ROW_INVALID per malformed row. Validated whether
 * or not the manifest is closed. parseManifest never calls it, so render,
 * check, owners and handoff generate are unaffected by the section.
 */
export function readExternalDeps(text: string): ExternalDepsRead {
  const sections = splitSections(splitLines(text)).filter((s) => isNamedHeading(s.name, EXTERNAL_DEPS_SECTION));
  if (sections.length === 0) return { present: false, rows: [], errors: [] };
  if (sections.length > 1) {
    return {
      present: true,
      rows: [],
      errors: [
        externalErr(
          EXTERNAL_DEPS_CODES.sectionDuplicate,
          `${sections.length} "## ${EXTERNAL_DEPS_SECTION}" sections found (lines ${sections.map((s) => s.line).join(", ")}); exactly one is allowed`,
        ),
      ],
    };
  }
  const s = sections[0];
  const table = firstTable(s);
  const parsed = table.length > 0 ? tableRows(table) : undefined;
  if (parsed === undefined || parsed.rows.length === 0) {
    return {
      present: true,
      rows: [],
      errors: [externalErr(EXTERNAL_DEPS_CODES.tableAbsent, `section "${s.heading}" (line ${s.line}) has no table with a data row`)],
    };
  }
  const { header, rows } = parsed;
  const headerOk = header.length === EXTERNAL_DEPS_HEADER.length && header.every((c, i) => c === EXTERNAL_DEPS_HEADER[i]);
  if (!headerOk) {
    return {
      present: true,
      rows: [],
      errors: [
        externalErr(
          EXTERNAL_DEPS_CODES.headerDiffers,
          `section "${s.heading}" line ${table[0].line}: header is "${header.join(" | ")}", expected exactly "${EXTERNAL_DEPS_HEADER.join(" | ")}"`,
        ),
      ],
    };
  }
  const out: ExternalDep[] = [];
  const errors: FanoutError[] = [];
  rows.forEach((r, idx) => {
    const n = idx + 1;
    const defect = externalRowDefect(r.cells);
    if (defect !== undefined) {
      errors.push(externalErr(EXTERNAL_DEPS_CODES.rowInvalid, `${EXTERNAL_DEPS_SECTION} row ${n} (line ${r.line}): ${defect}`));
      return;
    }
    const [repo, ticket, branch, sha, source] = r.cells;
    out.push({ repo: unBacktick(repo), ticket, branch: unBacktick(branch), sha: unBacktick(sha), source, row: n, line: r.line });
  });
  return { present: true, rows: out, errors };
}

/**
 * Every format error in the manifest (validate reports all of them). A
 * closed manifest's handoff section and the optional `## 外部依賴` section
 * are checked here only, never by the parser, so render and both check
 * modes never see those errors.
 */
export function validateManifest(text: string): { manifest: Manifest; errors: FanoutError[] } {
  const manifest = parseManifest(text);
  const handoff = isManifestClosed(text) ? handoffSectionErrors(text) : [];
  return { manifest, errors: [...manifest.errors, ...handoff, ...readExternalDeps(text).errors] };
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
      message: `lane ${laneId} is in a provisional table (${prov.heading}) missing column(s): ${cols} — redo the pre-dispatch premise check and promote it to the 8- or 9-column Lanes table`,
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
  /**
   * Test seam: the agc install root whose docs/lane-protocol.md is the
   * generic lane rules. The CLI never sets it; the default is the install
   * that holds this module.
   */
  installRoot?: string;
  /**
   * Test seam: the dispatch-prompt template to fill. The CLI never sets it;
   * the default is PROMPT_TEMPLATE_3B.
   */
  template?: string;
}

/** `warnings`: non-fatal lines for stderr (render still succeeds); present only when non-empty. */
export type RenderResult = { ok: true; prompt: string; warnings?: string[] } | { ok: false; errors: FanoutError[] };

/** render warning: primary's config cannot be used, so the addendum pointer is dropped. */
export const CONFIG_UNREADABLE_WARN = (configError: string): string =>
  `WARN  CONFIG_UNREADABLE: laneProtocolAddendum could not be read (${configError}) — the prompt points only at docs/lane-protocol.md`;

// 64 MiB: `git ls-tree -r` lists every path at base (for the owned-token
// existence check); execFileSync's 1 MiB default would fail on a large repo.
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
 * Resolve a manifest worktree cell to an absolute, `cd`-able path.
 * render substitutes it into the dispatch prompt. Pure: no fs access. Empty →
 * WORKTREE_EMPTY; leading "~" → WORKTREE_TILDE (no home expansion);
 * absolute → the cell, byte-verbatim; relative → path.resolve(primary, cell).
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

export type MailboxResolution = { ok: true; path: string } | { ok: false; code: string; message: string };

/**
 * Resolve a manifest `mailbox:` header to an absolute mailbox root.
 * Same rules as resolveWorktree minus the empty case (MAILBOX_RE requires a
 * value, and render treats a blank source as absent). Pure: no fs access.
 * Leading "~" → MAILBOX_TILDE (value not echoed); absolute → byte-verbatim;
 * relative → path.resolve(primary, header), and `..` above primary is allowed.
 */
export function resolveMailboxHeader(header: string, primary: string): MailboxResolution {
  if (header.startsWith("~")) {
    return {
      ok: false,
      code: FANOUT_CODES.mailboxTilde,
      message: "mailbox: header starts with \"~\" — home-directory expansion is not performed; write it relative to primary (e.g. ../<lanes-dir>/_mailbox)",
    };
  }
  if (path.isAbsolute(header)) return { ok: true, path: header };
  return { ok: true, path: path.resolve(primary, header) };
}

function inputErr(code: string, message: string): FanoutError {
  return { code, scope: "input", message };
}

/** fs.realpathSync, or path.resolve when the path cannot be resolved on disk. */
function realOrResolved(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function isRegularFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Whether a laneProtocolAddendum value is a path relative to the repo root
 * that stays inside it: not absolute (POSIX or Windows form), not starting
 * with "~", and not normalizing to "." or to a path whose first segment is "..".
 */
export function isValidAddendumPath(value: string): boolean {
  if (path.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)) return false;
  if (value.startsWith("~")) return false;
  const norm = path.posix.normalize(value.replaceAll("\\", "/")).replace(/\/+$/, "") || ".";
  return norm !== "." && norm.split("/")[0] !== "..";
}

type LanePointer = { generic: string; addendum: string };

/**
 * Lane-rules pointer for the prompt, read from primary's config. Returns
 * undefined (the unchanged single pointer) when the key is unset or the
 * config is unusable — the latter adds a CONFIG_UNREADABLE warning, since a
 * key-less workspace with a broken config must keep rendering. With the key
 * set, every problem is pushed to `errors`; the value is echoed only by
 * ADDENDUM_ABSENT, after it is known to be relative.
 */
function resolveLanePointer(
  primary: string,
  installRoot: string,
  errors: FanoutError[],
  warnings: string[],
): LanePointer | undefined {
  const configError = getConfigError(primary);
  if (configError !== null) {
    // One stderr line, whatever the load error text holds.
    warnings.push(CONFIG_UNREADABLE_WARN(configError.replace(/\s*[\r\n]+\s*/g, " ")));
    return undefined;
  }
  const addendum = loadConfig(primary).laneProtocolAddendum;
  if (addendum === undefined) return undefined;

  let ok = true;
  if (!isValidAddendumPath(addendum)) {
    errors.push(
      inputErr(
        FANOUT_CODES.addendumInvalid,
        'laneProtocolAddendum in .current/.config.json must be a path relative to the repo root and inside it — absolute, "~" and ".." paths are refused',
      ),
    );
    ok = false;
  } else if (!isRegularFile(path.resolve(primary, addendum))) {
    errors.push(inputErr(FANOUT_CODES.addendumAbsent, `laneProtocolAddendum "${addendum}" (.current/.config.json) is not a file under primary`));
    ok = false;
  }
  if (!isRegularFile(path.join(installRoot, GENERIC_LANE_PROTOCOL))) {
    errors.push(
      inputErr(
        FANOUT_CODES.laneProtocolAbsent,
        "laneProtocolAddendum is set, but the agc generic rules docs/lane-protocol.md were not found in the agc install",
      ),
    );
    ok = false;
  }
  if (!ok) return undefined;
  // Same checkout: the relative pointer also resolves inside a lane worktree
  // of this repo. Otherwise the absolute path inside the agc install, which
  // only ever lands in the rendered prompt, never in a tracked file.
  const generic =
    realOrResolved(installRoot) === realOrResolved(primary) ? GENERIC_LANE_PROTOCOL : path.join(installRoot, GENERIC_LANE_PROTOCOL);
  return { generic, addendum };
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

  // Mailbox root: a non-blank --mailbox-root wins and is used byte-verbatim
  // (never resolved). Otherwise the manifest header, resolved against primary
  // below. A blank flag falls through to the header. (E248)
  const flagRoot = opts.mailboxRoot !== undefined && opts.mailboxRoot.trim() !== "" ? opts.mailboxRoot : undefined;
  const header = flagRoot === undefined && m.mailbox !== undefined && m.mailbox.trim() !== "" ? m.mailbox : undefined;
  let mailboxRoot: string | undefined = flagRoot;
  if (flagRoot === undefined && header === undefined) {
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

  // Worktree: resolved against primary. Skipped when primary is absent —
  // there is no base to resolve against, and PRIMARY_NOT_FOUND already
  // reports that condition. (E235b)
  let worktree: string | undefined;
  if (primary !== undefined) {
    const wt = resolveWorktree(lane.worktree, primary);
    if (wt.ok) worktree = wt.path;
    else errors.push({ code: wt.code, scope: "row", lanes: [lane.lane], message: `lane ${lane.lane}: ${wt.message}` });
  }

  // Mailbox header: resolved against primary, under the same skip as the
  // worktree above — with no primary, PRIMARY_NOT_FOUND is the only report
  // and there is never a cwd fallback. (E248)
  if (header !== undefined && primary !== undefined) {
    const mb = resolveMailboxHeader(header, primary);
    if (mb.ok) mailboxRoot = mb.path;
    else errors.push(inputErr(mb.code, mb.message));
  }

  // Lane-rules pointer: primary's config is read only once primary is known,
  // under the same skip as the worktree and mailbox resolution above.
  const warnings: string[] = [];
  let pointer: LanePointer | undefined;
  if (primary !== undefined) {
    pointer = resolveLanePointer(primary, opts.installRoot ?? DEFAULT_INSTALL_ROOT, errors, warnings);
  }
  let template = opts.template ?? PROMPT_TEMPLATE_3B;
  if (pointer !== undefined) {
    const replaced = replaceLanePointer(template, LANE_PROTOCOL_POINTER_TWO_LAYER);
    if (replaced === undefined) {
      errors.push(
        inputErr(
          FANOUT_CODES.templatePointerAbsent,
          "the dispatch-prompt template does not hold the lane-rules pointer exactly once, so the two-layer pointer cannot replace it — fix PROMPT_TEMPLATE_3B or LANE_PROTOCOL_POINTER in tools/fanout-manifest.ts",
        ),
      );
    } else {
      template = replaced;
    }
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
  if (pointer !== undefined) {
    values["<generic>"] = pointer.generic;
    values["<addendum>"] = pointer.addendum;
  }
  // Single pass so substituted cell text is never re-scanned for placeholders.
  const keys = Object.keys(values).sort((a, b) => b.length - a.length);
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const prompt = template.replace(re, (k) => values[k]);
  return warnings.length > 0 ? { ok: true, prompt, warnings } : { ok: true, prompt };
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
  /** Exact 擁有 tokens matching no path at base and no file added on the branch. Warning only. (E208) */
  unmatchedOwned: string[];
  /** Set when the owned-token existence check could not run (the git ls-tree read failed). (E208) */
  unmatchedCheckError?: string;
  output: string;
  exitCode: 0 | 1;
}

export type CheckResult = { ok: true; report: CheckReport } | { ok: false; errors: FanoutError[] };

/** Warning line for an owned token that matches nothing (spec e178b Copy/Strings fanout.warn). (E208) */
export const UNMATCHED_OWNED_WARN = (token: string, base: string, branch: string): string =>
  `WARN  ${token}  (擁有 token matches no path at ${base} and is not a glob or a file added on ${branch})`;

/**
 * Glob token: contains `*` or `{`, or ends with `/`. Never warned about —
 * the lane may be the one creating the files it names. (E208)
 */
export function isGlobToken(token: string): boolean {
  return token.includes("*") || token.includes("{") || token.endsWith("/");
}

/**
 * Owned exact (non-glob) tokens that match no base or added path.
 * `addedPaths` are files the lane branch added vs base (a declared new file
 * such as `新檔 tools/fanout-manifest.ts`). Pure; each token reported once, in
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

/** First non-blank stderr line of a failed git call, else the first line of its message. */
export function gitErrorLine(err: unknown): string {
  const stderr = (err as { stderr?: unknown }).stderr;
  const fromStderr = typeof stderr === "string" ? stderr.split(/\r?\n/).find((l) => l.trim() !== "") : undefined;
  if (fromStderr !== undefined) return fromStderr.trim();
  return ((err as Error)?.message ?? String(err)).split(/\r?\n/)[0];
}

/**
 * `git diff --no-renames --name-only -z <a>...<b>`, or a GIT_DIFF_FAILED
 * input error when git fails (e.g. no merge base), so a failed diff is never
 * read as an empty or out-of-bounds change set.
 */
function diffNames(a: string, b: string, repo: string): { raw: string } | { error: FanoutError } {
  try {
    return { raw: gitOut(["diff", "--no-renames", "--name-only", "-z", `${a}...${b}`, "--"], repo) };
  } catch (err) {
    return { error: inputErr(FANOUT_CODES.gitDiffFailed, `git diff ${a}...${b} failed in ${repo}: ${gitErrorLine(err)}`) };
  }
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
 * (committed changes only, so uncommitted work never counts) that is
 * outside the owned tokens and the implicit bookkeeping set is listed on its
 * own OUT line; exit 1 if any. An empty range is the RANGE_EMPTY input
 * error, never a vacuous pass. (E158)
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

  const diff = diffNames(base, lane.branch, repo);
  if ("error" in diff) return { ok: false, errors: [diff.error] };
  const changed = [...new Set(diff.raw.split("\0").filter((p) => p.length > 0))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (changed.length === 0) {
    return {
      ok: false,
      errors: [
        inputErr(
          FANOUT_CODES.rangeEmpty,
          `git diff ${base}...${lane.branch} lists no committed change in ${repo} — nothing was checked; commit the lane's work first (uncommitted and untracked work is never checked) (E158)`,
        ),
      ],
    };
  }

  const out: { path: string; forbidden?: string }[] = [];
  for (const p of changed) {
    if (lane.ownedTokens.some((t) => matchesGlob(p, t))) continue;
    if (isImplicitBookkeeping(p, lane.lane)) continue;
    out.push({ path: p, forbidden: lane.forbiddenTokens.find((t) => matchesGlob(p, t)) });
  }

  // Owned-token existence check (warning only; exit code unchanged). Runs
  // after the ref checks above, so both refs resolve here. --full-tree:
  // ls-tree is otherwise relative to cwd, and the CLI's default --repo is the
  // manifest's own directory (specs/), not the repo root. (E208)
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
    ownedLine(lane),
    implicitBookkeepingLine(lane),
    ...out.map((o) => `OUT  ${o.path}${o.forbidden ? `  (禁止: ${o.forbidden})` : ""}`),
    `fanout check: ${lane.lane} — ${changed.length} file(s) changed, ${out.length} out of bounds`,
    E158_NOTE(base, lane.branch),
    PROSE_NOTE,
    // Warning lines go strictly AFTER every earlier line, which stay byte-identical. (E208)
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

// Shared by checkLane and checkCut so both print the same owned/bookkeeping lines.
function ownedLine(lane: DispatchableLane): string {
  return `owned (from 擁有): ${lane.ownedTokens.join(", ")}`;
}

function implicitBookkeepingLine(lane: DispatchableLane): string {
  return `implicit lane bookkeeping: .current/${lane.lane}/**, specs/${lane.lane}-*.md, qa_reports|review_reports/*${lane.lane}* (case-insensitive)`;
}

// --- check --cut -------------------------------------------------------------

export interface CutTicket {
  /** `id` cell, trimmed. */
  id: string;
  /** Path tokens of the `touches` cell (pathTokens order, de-duplicated within the row); [] when the cell is exactly `—`. */
  touches: string[];
  /** 1-based line of the row in the spec. */
  line: number;
}

export type CutSectionResult = { ok: true; tickets: CutTicket[] } | { ok: false; errors: FanoutError[] };

export interface CutOut {
  token: string;
  ticket: string;
  /** The 禁止 token it matches, when any (annotation only, as in checkLane). */
  forbidden?: string;
}

export interface CutCheckReport {
  lane: string;
  tickets: number;
  /** Sum over tickets of their (row-de-duplicated) touches tokens. */
  tokens: number;
  out: CutOut[];
  approval: "human" | undefined;
  humanDecisions: { count: number; latest?: string };
  /** APPROVAL_HUMAN / DECISIONS_HUMAN_ROW_ABSENT, in that order, only when failing. */
  failures: FanoutError[];
  output: string;
  exitCode: 0 | 1;
}

export type CutCheckResult = { ok: true; report: CutCheckReport } | { ok: false; errors: FanoutError[] };

function cutErr(code: string, message: string): FanoutError {
  return { code, scope: "cut", message };
}

/**
 * Parse the `## Cut` table of a lane spec. Pure. Only a section named
 * exactly `Cut` is read, so prose sections such as `## Cut Decisions` are
 * ignored. Every row error is collected before returning.
 *
 * Any line a Markdown renderer shows as a Cut heading (CUT_HEADING_RE: up to
 * three leading spaces, a tab after `##`, any letter case, closing `#`s)
 * counts toward CUT_SECTION_DUPLICATE, so a second table under such a
 * variant can never hide behind the one that is read. A lone variant is
 * still CUT_SECTION_ABSENT, because only a `## Cut` section is read.
 *
 * Known limits: fenced code blocks are not recognised (shared with the
 * manifest parser), so a fenced Cut heading line counts as one; setext
 * headings (`Cut` underlined with `---`) and homoglyph headings (e.g. a
 * Cyrillic `С`) are not recognised as Cut headings.
 *
 * The section and each `touches` cell are whitelists, so anything the
 * grammar does not name is an error rather than skipped (a skipped line or
 * word could name a file outside the lane and still read as in bounds):
 * - section: blank lines plus one table — header, separator row, one or more
 *   ticket rows, each line starting with `|`, no blank line inside;
 * - touches: exactly `—`, or backtick spans joined only by `、`, `,` or
 *   whitespace, each span a usable path token (`malformedCutSpan`).
 * A carriage return not followed by a line feed anywhere in the spec text is
 * an error, because Markdown renders it as a line break the parser would not
 * see.
 */
export function parseCutSection(specText: string): CutSectionResult {
  const lines = splitLines(specText);
  // A CR without an LF is a line break when Markdown renders the spec, but
  // splitLines does not split on it, so one parsed line could render as two
  // rows or hide a second heading. Refuse it anywhere in the text.
  const bareCrLines = lines.flatMap((l, i) => (/\r(?!\n)/.test(l) ? [i + 1] : []));
  if (bareCrLines.length > 0) {
    return {
      ok: false,
      errors: [
        cutErr(
          FANOUT_CODES.cutRowMalformed,
          `line(s) ${bareCrLines.join(", ")}: a carriage return without a line feed (Markdown renders it as a line break) — use LF or CRLF line endings only`,
        ),
      ],
    };
  }
  const cut = splitSections(lines).filter((s) => s.name === "Cut");
  // Variant heading lines plus every section read as `Cut` (trim() also
  // strips Unicode spaces the regex does not name), so no read section is
  // ever left out of the count.
  const headingLines = new Set(lines.flatMap((l, i) => (CUT_HEADING_RE.test(l) ? [i + 1] : [])));
  for (const s of cut) headingLines.add(s.line);
  if (headingLines.size > 1) {
    const at = [...headingLines].sort((a, b) => a - b);
    return {
      ok: false,
      errors: [
        cutErr(FANOUT_CODES.cutSectionDuplicate, `${at.length} "## Cut" sections found (lines ${at.join(", ")}); exactly one is allowed`),
      ],
    };
  }
  if (cut.length === 0) {
    return {
      ok: false,
      errors: [cutErr(FANOUT_CODES.cutSectionAbsent, 'no "## Cut" section found — write the inline cut table under a "## Cut" heading (skill-pm Spec Schema)')],
    };
  }
  const s = cut[0];
  const table = cutTableLines(s);
  const errors: FanoutError[] = cutSectionGrammarErrors(s, table);
  if (table.length === 0) {
    errors.push(cutErr(FANOUT_CODES.cutTableAbsent, `section "${s.heading}" (line ${s.line}) has no table`));
    return { ok: false, errors };
  }
  const header = splitRow(table[0].text);
  const headerOk = header.length === CUT_HEADER.length && header.every((c, i) => c === CUT_HEADER[i]);
  if (!headerOk) {
    errors.push(
      cutErr(
        FANOUT_CODES.cutHeaderDiffers,
        `section "${s.heading}" line ${table[0].line}: header is "${header.join(" | ")}", expected exactly "${CUT_HEADER.join(" | ")}"`,
      ),
    );
    return { ok: false, errors };
  }
  const separator = table.length > 1 ? splitRow(table[1].text) : [];
  if (separator.length !== CUT_HEADER.length || !isSeparatorRow(separator)) {
    const where = table.length > 1 ? `line ${table[1].line}` : `after line ${table[0].line}`;
    errors.push(
      cutErr(
        FANOUT_CODES.cutRowMalformed,
        `section "${s.heading}" ${where}: expected the separator row (${CUT_HEADER.length} cells of ---) right after the header`,
      ),
    );
    return { ok: false, errors };
  }
  const rows = table.slice(2).map((l) => ({ cells: splitRow(l.text), line: l.line }));
  if (rows.length === 0) {
    errors.push(cutErr(FANOUT_CODES.cutTableAbsent, `section "${s.heading}" (line ${s.line}) has a header but no ticket row`));
    return { ok: false, errors };
  }

  const tickets: CutTicket[] = [];
  for (const r of rows) {
    if (isSeparatorRow(r.cells)) {
      errors.push(cutErr(FANOUT_CODES.cutRowMalformed, `Cut row (line ${r.line}): a second separator row — the table has one header, one separator row, then ticket rows`));
      continue;
    }
    if (r.cells.length !== CUT_HEADER.length || r.cells[0] === "") {
      errors.push(
        cutErr(
          FANOUT_CODES.cutRowMalformed,
          `Cut row (line ${r.line}): ${r.cells.length} cell(s) with id "${r.cells[0] ?? ""}" — expected ${CUT_HEADER.length} cells and a non-empty id`,
        ),
      );
      continue;
    }
    const id = r.cells[0];
    const touches = r.cells[4];
    let ok = true;
    const leftover = cutTouchesLeftover(touches);
    if (leftover !== "") {
      errors.push(
        cutErr(
          FANOUT_CODES.cutTouchesUnquotedPath,
          `Cut row ${id} (line ${r.line}): touches has text outside backtick spans ("${leftover}") — write exactly —, or backtick-quoted paths joined only by 、 , or spaces`,
        ),
      );
      ok = false;
    }
    for (const span of backtickSpans(touches)) {
      const why = malformedCutSpan(span);
      if (why === undefined) continue;
      errors.push(cutErr(FANOUT_CODES.cutTouchesMalformedPath, `Cut row ${id} (line ${r.line}): touches span "${span}" ${why}`));
      ok = false;
    }
    const toks = [...new Set(pathTokens(touches))];
    // A prose-only touches cell would otherwise read as "zero tokens, in bounds".
    if (toks.length === 0 && touches !== CUT_TOUCHES_NONE) {
      errors.push(
        cutErr(
          FANOUT_CODES.cutTouchesEmpty,
          `Cut row ${id} (line ${r.line}): touches names no backtick-quoted path — list the paths, or write — for a bookkeeping-only ticket`,
        ),
      );
      ok = false;
    }
    if (ok) tickets.push({ id, touches: toks, line: r.line });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, tickets };
}

/**
 * The `## Cut` table: the first run of section lines that start with `|`, or
 * empty when no line does. Every other non-blank line, before or after the
 * run, is reported by `cutSectionGrammarErrors`.
 */
function cutTableLines(section: Section): { text: string; line: number }[] {
  const lines = section.lines;
  const start = lines.findIndex((l) => l.text.startsWith("|"));
  if (start < 0) return [];
  let end = start;
  while (end < lines.length && lines[end].text.startsWith("|")) end++;
  return lines.slice(start, end);
}

/**
 * One CUT_ROW_MALFORMED per section line that is neither blank nor part of the
 * table run — prose, a sub-heading, a blockquote, an indented or pipe-less
 * row (GitHub would render the last two as rows of the table), or a line of a
 * second table.
 */
function cutSectionGrammarErrors(section: Section, table: { text: string; line: number }[]): FanoutError[] {
  const inTable = new Set(table.map((l) => l.line));
  return section.lines
    .filter((l) => l.text.trim() !== "" && !inTable.has(l.line))
    .map((l) =>
      cutErr(
        FANOUT_CODES.cutRowMalformed,
        `section "${section.heading}" line ${l.line}: only blank lines and one table (header, separator row, ticket rows, each starting with |) are allowed — found "${l.text.trim()}"`,
      ),
    );
}

/**
 * What remains of a `touches` cell once its backtick spans and the allowed
 * separators (`、`, `,`, whitespace) are removed, each removed run shown as
 * one space; "" when the cell is exactly `—` or a well-formed list.
 * Unbalanced backticks remain, so they are refused.
 */
function cutTouchesLeftover(touches: string): string {
  if (touches === CUT_TOUCHES_NONE) return "";
  return touches.replace(/`[^`]+`/g, " ").replace(/[、,\s]+/g, " ").trim();
}

/**
 * Plain repo path for a `touches` span: ASCII letters, digits, `_`, `-`, `.`
 * and `/` only, with no empty segment and no leading or trailing `/`.
 */
const CUT_PLAIN_PATH_RE = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;

/**
 * Why a `touches` backtick span cannot be checked for containment, or
 * undefined when it is a usable token. A usable token is either one
 * plain repo path (CUT_PLAIN_PATH_RE, no `.` / `..` segment) or a glob
 * (`isGlobToken`), which `isCutTokenInBounds` accepts only when byte-identical
 * to an 擁有 token. Every other span is refused rather than guessed at: a
 * span that is not path-shaped (`Dockerfile`, `.`) is not read as prose,
 * `PATH_TOKEN_RE` admits `,` for `{a,b}` alternation, so a comma-joined list
 * outside braces would otherwise be matched as one path, and a `:line`
 * suffix, a dot segment or a leading `/` would match an owned glob lexically
 * while naming a file outside it.
 */
function malformedCutSpan(span: string): string | undefined {
  if (!isPathToken(span)) {
    return "is not a repo path token (a path with a / or a file extension; no :line, #anchor, spaces, backslashes or non-ASCII) — write the file path alone, or move prose to desc";
  }
  if (span.startsWith("/") || span.split("/").some((seg) => seg === "." || seg === "..")) {
    return "has a leading / or a . or .. segment — write the normalised repo-relative path";
  }
  if (isGlobToken(span)) return undefined;
  if (span.includes(",")) return "lists more than one path — give each path its own backtick span";
  if (!CUT_PLAIN_PATH_RE.test(span)) {
    return "is not a plain repo path (letters, digits, _ - . and / only; no empty segment) — write the normalised repo-relative path";
  }
  return undefined;
}

/**
 * Whether one `touches` token is inside the lane's owned set. An exact token
 * may match an 擁有 glob or the implicit bookkeeping set; a glob token is in
 * bounds only when byte-identical to an 擁有 token, because containment of
 * one glob in another is never inferred.
 */
export function isCutTokenInBounds(token: string, lane: DispatchableLane): boolean {
  if (isGlobToken(token)) return lane.ownedTokens.includes(token);
  return lane.ownedTokens.some((t) => matchesGlob(token, t)) || isImplicitBookkeeping(token, lane.lane);
}

/**
 * Pre-commit containment check of a lane spec's `## Cut` against its manifest
 * row, plus the two manifest-side facts the manifest tier needs (`approval`
 * not human, at least one 人類 Decisions row). Pure: no fs, no git.
 */
export function checkCut(m: Manifest, laneId: string, specText: string): CutCheckResult {
  const found = lookupLane(m, laneId);
  if (!found.ok) return { ok: false, errors: found.errors };
  const lane = found.lane;
  // A dropped malformed Decisions row could be the 人類 row or the latest
  // date, so a Decisions format error refuses rather than counting around it.
  const decisionErrors = m.errors.filter((e) => e.scope === "decisions");
  if (decisionErrors.length > 0) return { ok: false, errors: decisionErrors };
  const parsed = parseCutSection(specText);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const out: CutOut[] = [];
  let tokens = 0;
  for (const t of parsed.tickets) {
    tokens += t.touches.length;
    for (const token of t.touches) {
      if (isCutTokenInBounds(token, lane)) continue;
      const forbidden = isGlobToken(token)
        ? lane.forbiddenTokens.find((f) => f === token)
        : lane.forbiddenTokens.find((f) => matchesGlob(token, f));
      out.push({ token, ticket: t.id, ...(forbidden !== undefined && { forbidden }) });
    }
  }

  const human = m.decisions.rows.filter((d) => d.decider === "人類");
  // Dates are validated YYYY-MM-DD, so string order is date order.
  const latest = human.map((d) => d.date).sort().at(-1);
  const failures: FanoutError[] = [];
  if (lane.approval === "human") {
    failures.push({
      code: FANOUT_CODES.approvalHuman,
      scope: "row",
      lanes: [lane.lane],
      message: `lane ${lane.lane}'s approval cell is human — present this cut to the human in the lane session`,
    });
  }
  if (human.length === 0) {
    failures.push({
      code: FANOUT_CODES.decisionsHumanRowAbsent,
      scope: "decisions",
      message: "the ## Decisions table has no 人類 row — the manifest is not human-approved",
    });
  }

  const lines = [
    ownedLine(lane),
    implicitBookkeepingLine(lane),
    ...out.map((o) => `OUT  \`${o.token}\`  (${o.ticket})${o.forbidden ? `  (禁止: ${o.forbidden})` : ""}`),
    `approval: ${lane.approval ?? "—"}`,
    `human-decisions: ${human.length} row(s); latest ${latest ?? "—"}`,
    ...failures.map((f) => `FAIL  ${f.code}: ${f.message}`),
    `fanout check --cut: ${lane.lane} — ${parsed.tickets.length} ticket(s), ${tokens} token(s), ${out.length} out of bounds`,
    CUT_GLOB_NOTE,
    PROSE_NOTE,
  ];
  return {
    ok: true,
    report: {
      lane: lane.lane,
      tickets: parsed.tickets.length,
      tokens,
      out,
      approval: lane.approval,
      humanDecisions: { count: human.length, ...(latest !== undefined && { latest }) },
      failures,
      output: lines.join("\n") + "\n",
      exitCode: out.length === 0 && failures.length === 0 ? 0 : 1,
    },
  };
}

// --- owners ------------------------------------------------------------------

export interface OwnersHit {
  path: string;
  /** Owning lanes in table order; `token` undefined = implicit bookkeeping. */
  owners: { lane: string; token?: string }[];
}

export interface OwnersReport {
  paths: string[];
  hits: OwnersHit[];
  output: string;
  exitCode: 0 | 1;
}

export type OwnersResult = { ok: true; report: OwnersReport } | { ok: false; errors: FanoutError[] };

/** Source note for paths read from a git range (Copy owners.note.range). */
export const OWNERS_RANGE_NOTE = (range: string): string =>
  `note: paths from git diff --no-renames --name-only ${range} (committed changes only).`;

/** Source note for paths read from a list file or stdin (Copy owners.note.paths). */
export const OWNERS_PATHS_NOTE = (file: string): string => `note: paths from the list ${file} (taken verbatim, not normalised).`;

/** Manifest errors that block owners: any Lanes or row error. */
function ownersFatalErrors(m: Manifest): FanoutError[] {
  return m.errors.filter((e) => e.scope === "lanes" || e.scope === "row");
}

/**
 * Every dispatchable lane that owns each path, through an 擁有 token or the
 * implicit bookkeeping set (a base fix that brings in a lane's own state is
 * not a clean merge either). Pure. A Lanes or row error is fatal, since a
 * dropped row could be the lane that owns a path; Pins / Decisions errors
 * are not. Provisional lanes are named as not checked.
 */
export function ownersOf(m: Manifest, paths: string[], sourceNote: string): OwnersResult {
  const fatal = ownersFatalErrors(m);
  if (fatal.length > 0) return { ok: false, errors: fatal };
  const unique = [...new Set(paths)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const hits: OwnersHit[] = [];
  for (const p of unique) {
    const owners: OwnersHit["owners"] = [];
    for (const lane of m.dispatchable) {
      const token = lane.ownedTokens.find((t) => matchesGlob(p, t));
      if (token !== undefined) owners.push({ lane: lane.lane, token });
      else if (isImplicitBookkeeping(p, lane.lane)) owners.push({ lane: lane.lane });
    }
    if (owners.length > 0) hits.push({ path: p, owners });
  }
  const provisional = m.provisional.map((x) => x.lane);
  const lines = [
    ...hits.map((h) => `HIT  ${h.path}  (${h.owners.map((o) => `${o.lane}: ${o.token ?? "implicit bookkeeping"}`).join("; ")})`),
    `fanout owners: ${unique.length} path(s), ${hits.length} hit(s), ${m.dispatchable.length} dispatchable lane(s)`,
    sourceNote,
    PROSE_NOTE,
    ...(provisional.length > 0 ? [`note: ${provisional.length} provisional lane(s) not checked: ${provisional.join(", ")}`] : []),
  ];
  return { ok: true, report: { paths: unique, hits, output: lines.join("\n") + "\n", exitCode: hits.length > 0 ? 1 : 0 } };
}

/**
 * The two sides of an `<a>...<b>` range, or undefined when it is not exactly
 * that: one `...`, both sides non-empty, no whitespace, no side starting
 * with `-`, and no `..` or leading / trailing `.` inside a side (none of
 * which a git ref can hold, so `a....b` is refused rather than resolved).
 */
export function parseOwnersRange(range: string): [string, string] | undefined {
  if (/\s/.test(range)) return undefined;
  const sides = range.split("...");
  if (sides.length !== 2) return undefined;
  const ok = sides.every((s) => s !== "" && !s.startsWith("-") && !s.includes("..") && !s.startsWith(".") && !s.endsWith("."));
  return ok ? [sides[0], sides[1]] : undefined;
}

/** Paths changed on `<b>` since merge-base with `<a>`; none = RANGE_EMPTY. */
export function rangePaths(sides: [string, string], repo: string): { paths: string[] } | { errors: FanoutError[] } {
  try {
    gitOut(["rev-parse", "--git-dir"], repo);
  } catch {
    return { errors: [inputErr("REPO_NOT_GIT", `--repo "${repo}" is not inside a git repository`)] };
  }
  const errors = sides
    .filter((ref) => !refOk(ref, repo))
    .map((ref) => inputErr("REF_NOT_FOUND", `range ref "${ref}" does not resolve (git rev-parse --verify) in ${repo}`));
  if (errors.length > 0) return { errors };
  const diff = diffNames(sides[0], sides[1], repo);
  if ("error" in diff) return { errors: [diff.error] };
  const paths = nulList(diff.raw);
  if (paths.length === 0) {
    return {
      errors: [
        inputErr(
          FANOUT_CODES.rangeEmpty,
          `git diff ${sides[0]}...${sides[1]} lists no committed change in ${repo} — an empty range proves nothing about ownership (E158)`,
        ),
      ],
    };
  }
  return { paths };
}

/** One repo-relative path per line: trailing CR and surrounding space trimmed, blanks skipped. */
export function parsePathList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
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

function readSpec(file: string): { text: string } | { error: FanoutError } {
  try {
    return { text: fs.readFileSync(file, "utf8") };
  } catch (err) {
    return { error: inputErr(FANOUT_CODES.specUnreadable, `cannot read spec "${file}": ${(err as Error).message}`) };
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
  // One non-fatal WARN per dispatchable row whose worktree cell is absolute
  // (exit code stays 0). Provisional rows have no worktree contract. (E235b)
  let warns = manifest.dispatchable
    .filter((l) => isAbsoluteWorktree(l.worktree))
    .map((l) => `${WORKTREE_ABSOLUTE_WARN(l.lane, l.line)}\n`)
    .join("");
  // One non-fatal WARN for an absolute `mailbox:` header. A "~" header is a
  // render-time refusal only (like WORKTREE_TILDE), so no line here. (E248)
  if (manifest.mailbox !== undefined && manifest.mailboxLine !== undefined && path.isAbsolute(manifest.mailbox)) {
    warns += `${MAILBOX_ABSOLUTE_WARN(manifest.mailboxLine)}\n`;
  }
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
  const stderr = (res.warnings ?? []).map((w) => `${w}\n`).join("");
  return { stdout: res.prompt, stderr, exitCode: 0 };
}

export function runCheck(args: string[]): CliResult {
  // Dispatched before parseArgs, which would read `--cut` as a value-taking flag.
  if (args[0] === "--cut") return runCheckCut(args.slice(1));
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

function ownersUsage(message: string): CliResult {
  return { stdout: "", stderr: `${formatError({ code: "USAGE", message })}\n${OWNERS_USAGE}\n`, exitCode: 2 };
}

/**
 * `owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)`:
 * exit 0 = no path is owned, 1 = at least one is, 2 = usage / input /
 * manifest error. Reads only; git is run read-only.
 */
export function runOwners(args: string[]): CliResult {
  const p = parseArgs(args, ["--range", "--paths", "--repo"]);
  if (typeof p === "string") return ownersUsage(p);
  if (p.positional.length !== 1) return ownersUsage("owners takes exactly one <manifest>");
  const range = single(p, "--range");
  if (typeof range === "object") return ownersUsage(range.error);
  const list = single(p, "--paths");
  if (typeof list === "object") return ownersUsage(list.error);
  const repo = single(p, "--repo");
  if (typeof repo === "object") return ownersUsage(repo.error);
  if ((range === undefined) === (list === undefined)) return ownersUsage("owners takes exactly one of --range or --paths");
  if (repo !== undefined && range === undefined) return ownersUsage("--repo is only valid with --range");

  let sides: [string, string] | undefined;
  if (range !== undefined) {
    sides = parseOwnersRange(range);
    if (sides === undefined) {
      return fail([inputErr(FANOUT_CODES.rangeInvalid, `--range "${range}" is not <a>...<b> (one ..., both sides non-empty, no whitespace, no side starting with -)`)]);
    }
  }
  const file = p.positional[0];
  const r = readManifest(file);
  if ("error" in r) return fail([r.error]);
  const m = parseManifest(r.text);
  // Before any git or file read, so a bad manifest is the whole answer.
  const fatal = ownersFatalErrors(m);
  if (fatal.length > 0) return fail(fatal);

  let paths: string[];
  let note: string;
  if (sides !== undefined) {
    // Same default as check: the git repo that holds the manifest, not cwd.
    const got = rangePaths(sides, repo ?? path.dirname(path.resolve(file)));
    if ("errors" in got) return fail(got.errors);
    paths = got.paths;
    note = OWNERS_RANGE_NOTE(`${sides[0]}...${sides[1]}`);
  } else {
    const src = list!;
    try {
      paths = parsePathList(fs.readFileSync(src === "-" ? 0 : src, "utf8"));
    } catch (err) {
      return fail([inputErr(FANOUT_CODES.pathsUnreadable, `cannot read path list "${src}": ${(err as Error).message}`)]);
    }
    note = OWNERS_PATHS_NOTE(src);
  }
  const res = ownersOf(m, paths, note);
  if (!res.ok) return fail(res.errors);
  return { stdout: res.report.output, stderr: "", exitCode: res.report.exitCode };
}

/** `check --cut <manifest> <lane> <spec>`: file reads only — no git, no writes. */
export function runCheckCut(args: string[]): CliResult {
  const p = parseArgs(args, []);
  if (typeof p === "string") return usageResult(p);
  if (p.positional.length !== 3) return usageResult("check --cut takes <manifest> <lane> <spec>");
  const [file, lane, specFile] = p.positional;
  const r = readManifest(file);
  if ("error" in r) return fail([r.error]);
  const spec = readSpec(specFile);
  if ("error" in spec) return fail([spec.error]);
  const res = checkCut(parseManifest(r.text), lane, spec.text);
  if (!res.ok) return fail(res.errors);
  return { stdout: res.report.output, stderr: "", exitCode: res.report.exitCode };
}
