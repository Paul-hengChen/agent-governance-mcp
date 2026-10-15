#!/usr/bin/env node
// Fail the build when the repository's bookkeeping files disagree with each
// other or with the evidence on disk (E299). Four checks:
//   (1) docs/backlog.md ticket ids are unique, and every id added since the
//       base commit is numerically above the base's maximum;
//   (2) every DONE / VOID row in docs/backlog.md cites evidence files that
//       exist, and a dead citation is reported with the path it should use;
//   (3) docs/v4.0.0-new-tickets.md queue rows name tickets that have a
//       backlog row, and their "✅ DONE" tick agrees with the backlog row;
//   (4) the Decisions table of every tracked specs/fanout-*.md is complete.
// Exit 0 = clean (notes allowed), 1 = at least one violation, 2 = cannot run.
//
// Id space for (1) is the `id` cell of ticket-table rows only. `## E1 — …`
// headings are long-form bodies of the same tickets and are never counted.
// A trailing letter on an id (`E10a`) is a split suffix: the id passes the
// ordering check when its parent `E10` already exists at the base.
//
// Suffixed ids in the queue, generic rule: a `票` cell id `E<n><letter>` with
// no backlog row of its own passes the existence check when its parent `E<n>`
// has a row, and is skipped by the tick/mark alignment check (there is no row
// to compare against). No particular id is special-cased anywhere below.
//
// Check (2) resolves a dead path by basename, within the cited tree only
// (qa_reports/ is never searched for a review_reports/ citation). A row cites
// the path as it existed when the row was written (E301), so:
//   (a) a root citation whose file is still at the root emits nothing;
//   (b) a root citation whose file has left the root resolves by basename
//       within the cited tree: exactly one archive/<dir>/ holds it -> ok,
//       silently; more than one -> a note naming the candidates; none in that
//       tree -> a violation.
// An archive/<dir>/ citation keeps its rules: exists -> ok; file still at the
// root -> a note (the row predicted the archive folder before release named
// it); otherwise a violation naming the candidate.
//
// The table and done-mark helpers below are reproduced from
// scripts/check-md-tables.mjs so this script stays self-contained (it is
// copied into fixture repositories by its tests). Keep the two in step.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const BACKLOG_REL_PATH = "docs/backlog.md";
const QUEUE_REL_PATH = "docs/v4.0.0-new-tickets.md";
const TICKET_TABLE_HEADER = ["id", "desc", "priority", "depends_on", "est. files", "design-link"];
const ORDER_TABLE_HEADER = ["order", "ticket", "intake", "why here"];
const DECISIONS_HEADER = ["日期", "裁決者", "內容", "出處"];
const DECIDERS = new Set(["人類", "整合者"]);
const EVIDENCE_TREES = ["qa_reports", "review_reports"];
const BASE_REF_FALLBACKS = ["origin/main", "main"];

// ---------------------------------------------------------------------------
// Helpers reproduced from scripts/check-md-tables.mjs (same semantics).
// ---------------------------------------------------------------------------

// Matches the opening of a bold marker (`**DONE`, word boundary so
// `**PARTIALLY**` does not match). The closing `**` is not anchored: the
// corpus mostly bolds the "— shipped vX.Y.Z" stamp inside the same span.
const DONE_MARK_OPEN_RE = /\*\*(DONE|PARTIAL|VOID)\b/g;
const MARK_STAMP_RE = /v\d+(?:\.\d+){1,2}|\d{4}-\d{2}-\d{2}/;

// CommonMark code-span rule applied to a single-line cell: an opening run of
// N backticks is closed by the next run of exactly N; an unpaired run is a
// literal backtick.
function findCodeSpanRanges(text) {
  const runs = [];
  const backtickRe = /`+/g;
  let rm;
  while ((rm = backtickRe.exec(text))) {
    runs.push({ start: rm.index, end: rm.index + rm[0].length, len: rm[0].length });
  }
  const ranges = [];
  let i = 0;
  while (i < runs.length) {
    const open = runs[i];
    let closeIdx = -1;
    for (let j = i + 1; j < runs.length; j++) {
      if (runs[j].len === open.len) {
        closeIdx = j;
        break;
      }
    }
    if (closeIdx === -1) {
      i++;
      continue;
    }
    ranges.push([open.start, runs[closeIdx].end]);
    i = closeIdx + 1;
  }
  return ranges;
}

// A `*"…"*` span (this repo's style for quoting another row's text) is
// excluded exactly like a code span; an unpaired `*"` opener yields no range.
function findCitationQuoteRanges(text) {
  const ranges = [];
  const openRe = /(?<!\*)\*"(?!\*)/g;
  let om;
  while ((om = openRe.exec(text))) {
    const closeRe = /"\*(?!\*)/g;
    closeRe.lastIndex = om.index + om[0].length;
    const cm = closeRe.exec(text);
    if (cm === null) continue;
    ranges.push([om.index, cm.index + cm[0].length]);
    openRe.lastIndex = cm.index + cm[0].length;
  }
  return ranges;
}

// Returns { index, token } for the first bold DONE/PARTIAL/VOID span in
// `cellTrimmed` that opens outside any code span and citation quote and
// either self-closes or carries a version/date stamp; else null.
function findGenuineDoneMark(cellTrimmed) {
  const codeSpans = findCodeSpanRanges(cellTrimmed);
  const citationQuotes = findCitationQuoteRanges(cellTrimmed);
  const insideCodeSpan = (idx) => codeSpans.some(([s, e]) => idx >= s && idx < e);
  const insideCitationQuote = (idx) => citationQuotes.some(([s, e]) => idx >= s && idx < e);

  for (const m of cellTrimmed.matchAll(DONE_MARK_OPEN_RE)) {
    const idx = m.index;
    if (insideCodeSpan(idx)) continue;
    if (insideCitationQuote(idx)) continue;
    const bodyStart = idx + m[0].length;
    const closeIdx = cellTrimmed.indexOf("**", bodyStart);
    if (closeIdx === -1) continue;
    const spanBody = cellTrimmed.slice(bodyStart, closeIdx);
    const selfCloses = spanBody === "";
    const hasStamp = MARK_STAMP_RE.test(spanBody);
    if (!selfCloses && !hasStamp) continue;
    return { index: idx, token: m[1] };
  }
  return null;
}

// Split a table row into cells: strip one optional leading/trailing pipe,
// then split on unescaped `|` only.
function splitRow(raw) {
  let s = raw.replace(/\r$/, "").trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/);
}

function isDelimiterRow(raw) {
  if (!/^\|/.test(raw)) return false;
  const cells = splitRow(raw).map((c) => c.trim());
  return cells.every((c) => /^:?-+:?$/.test(c));
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Group a file's lines into table blocks: maximal runs of column-0 `|` lines
// outside fenced code. Fence state keeps the opening char and run length, as
// CommonMark closes a fence only on the same char, a run >= the opening's,
// and no info string. Each block is [{ lineNo, raw }, …]; only blocks whose
// second row is a delimiter row of the header's width are returned as tables.
function parseTables(lines) {
  let fenceChar = null;
  let fenceLen = 0;
  let run = [];
  const runs = [];

  for (let i = 0; i < lines.length; i++) {
    const lineRaw = lines[i].replace(/\r$/, "");
    const trimmed = lineRaw.trim();
    const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(trimmed);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (fenceChar === null) {
        fenceChar = char;
        fenceLen = len;
      } else if (char === fenceChar && len >= fenceLen && fenceMatch[2].trim() === "") {
        fenceChar = null;
        fenceLen = 0;
      }
      if (run.length) {
        runs.push(run);
        run = [];
      }
      continue;
    }
    if (fenceChar === null && /^\|/.test(lineRaw)) {
      run.push({ lineNo: i + 1, raw: lineRaw });
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const tables = [];
  for (const block of runs) {
    const headerCells = splitRow(block[0].raw).map((c) => c.trim());
    const hasDelimiter =
      block.length >= 2 &&
      isDelimiterRow(block[1].raw) &&
      splitRow(block[1].raw).length === headerCells.length;
    if (!hasDelimiter) continue;
    const rows = block.slice(2).map((r) => ({
      lineNo: r.lineNo,
      raw: r.raw,
      cells: splitRow(r.raw).map((c) => c.trim()),
    }));
    tables.push({ headerLineNo: block[0].lineNo, headerCells, rows });
  }
  return tables;
}

// ---------------------------------------------------------------------------
// Shared state and reporting.
// ---------------------------------------------------------------------------

const violations = [];
const notes = [];
const violation = (file, line, text) => violations.push(`${file}:${line} — ${text}`);
const note = (file, line, text) => notes.push(`${file}:${line} — ${text}`);

function cannotRun(reason) {
  console.error(`check:bookkeeping — cannot run: ${reason}`);
  process.exit(2);
}

function readRequired(relPath) {
  try {
    return readFileSync(path.join(root, relPath), "utf-8").split("\n");
  } catch (err) {
    return cannotRun(`${relPath} is unreadable (${err && err.code ? err.code : err})`);
  }
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
}

function parseArgs(argv) {
  let baseRef = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base" && i + 1 < argv.length) baseRef = argv[++i];
    else if (a.startsWith("--base=")) baseRef = a.slice("--base=".length);
  }
  return { baseRef };
}

// ---------------------------------------------------------------------------
// docs/backlog.md model: ticket-table rows (id space, closed state) and
// four-column order-table rows (evidence citations only).
// ---------------------------------------------------------------------------

const TICKET_ID_RE = /^E(\d+)([A-Za-z]?)$/;

function isClosedMark(mark) {
  return mark !== null && mark.index === 0 && (mark.token === "DONE" || mark.token === "VOID");
}

function backlogModel(lines) {
  const ticketRows = [];
  const orderRows = [];
  for (const t of parseTables(lines)) {
    if (arraysEqual(t.headerCells, TICKET_TABLE_HEADER)) {
      for (const r of t.rows) {
        if (r.cells.length !== t.headerCells.length) continue;
        const mark = findGenuineDoneMark(r.cells[1]);
        ticketRows.push({ lineNo: r.lineNo, raw: r.raw, id: r.cells[0], mark, closed: isClosedMark(mark) });
      }
    } else if (arraysEqual(t.headerCells, ORDER_TABLE_HEADER)) {
      for (const r of t.rows) {
        if (r.cells.length !== t.headerCells.length) continue;
        const mark = findGenuineDoneMark(r.cells[3]);
        const ticketIds = r.cells[1].match(/E\d+[A-Za-z]?/g);
        orderRows.push({
          lineNo: r.lineNo,
          raw: r.raw,
          id: ticketIds ? ticketIds[0] : r.cells[0],
          closed: mark !== null && (mark.token === "DONE" || mark.token === "VOID"),
        });
      }
    }
  }
  return { ticketRows, orderRows };
}

// ---------------------------------------------------------------------------
// Check (1): ids unique and monotone.
// ---------------------------------------------------------------------------

function resolveBase(baseRef) {
  const candidates = baseRef ? [baseRef, ...BASE_REF_FALLBACKS] : BASE_REF_FALLBACKS;
  for (const ref of candidates) {
    try {
      git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      return git(["merge-base", "HEAD", ref]).trim();
    } catch {
      continue;
    }
  }
  return null;
}

function checkIds(ticketRows, baseRef) {
  const firstLineById = new Map();
  for (const r of ticketRows) {
    const first = firstLineById.get(r.id);
    if (first !== undefined) {
      violation(BACKLOG_REL_PATH, r.lineNo, `ticket id ${r.id} appears twice (first at line ${first})`);
    } else {
      firstLineById.set(r.id, r.lineNo);
    }
  }

  const base = resolveBase(baseRef);
  let baseLines = null;
  if (base !== null) {
    try {
      baseLines = git(["show", `${base}:${BACKLOG_REL_PATH}`]).split("\n");
    } catch {
      baseLines = null;
    }
  }
  if (baseLines === null) {
    notes.push(`${BACKLOG_REL_PATH} — id ordering not checked: no base commit found (pass --base <ref>)`);
    return;
  }

  const baseIds = new Set(backlogModel(baseLines).ticketRows.map((r) => r.id));
  let baseMax = 0;
  for (const id of baseIds) {
    const m = TICKET_ID_RE.exec(id);
    if (m) baseMax = Math.max(baseMax, Number(m[1]));
  }
  const sha7 = base.slice(0, 7);
  for (const r of ticketRows) {
    if (baseIds.has(r.id)) continue;
    const m = TICKET_ID_RE.exec(r.id);
    if (!m) continue;
    const n = Number(m[1]);
    if (m[2] !== "" && baseIds.has(`E${m[1]}`)) continue;
    if (n <= baseMax) {
      violation(
        BACKLOG_REL_PATH,
        r.lineNo,
        `new ticket id ${r.id} is not above the previous maximum E${baseMax} (base ${sha7})`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check (2): evidence citations on closed rows.
// ---------------------------------------------------------------------------

const CITATION_TOKEN_RE = /(?:qa_reports|review_reports)\/[^\s`"'()[\]<>{}*|,;:]*/g;
const CITATION_SHAPE_RE = /^(qa_reports|review_reports)\/(?:archive\/([^/]+)\/)?([^/]+\.(?:md|txt|json|jsonl|png))$/;

// Index every <tree>/archive/<dir>/<file> once: basename -> [dir, …].
function buildArchiveIndex() {
  const index = {};
  for (const tree of EVIDENCE_TREES) {
    const byName = new Map();
    const archiveDir = path.join(root, tree, "archive");
    let dirs = [];
    try {
      dirs = readdirSync(archiveDir).filter((d) => statSync(path.join(archiveDir, d)).isDirectory());
    } catch {
      dirs = [];
    }
    for (const d of dirs) {
      let files = [];
      try {
        files = readdirSync(path.join(archiveDir, d)).filter((f) =>
          statSync(path.join(archiveDir, d, f)).isFile()
        );
      } catch {
        files = [];
      }
      for (const f of files) {
        if (!byName.has(f)) byName.set(f, []);
        byName.get(f).push(d);
      }
    }
    index[tree] = byName;
  }
  return index;
}

function extractCitations(rawRow) {
  const text = rawRow.replace(/\\\|/g, "|");
  const out = [];
  for (const m of text.matchAll(CITATION_TOKEN_RE)) {
    const token = m[0].replace(/\.+$/, "");
    const shape = CITATION_SHAPE_RE.exec(token);
    if (!shape) continue;
    out.push({ path: token, tree: shape[1], dir: shape[2] ?? null, file: shape[3] });
  }
  return out;
}

function checkCitations(rows, archiveIndex) {
  for (const r of rows) {
    if (!r.closed) continue;
    for (const c of extractCitations(r.raw)) {
      // (a) the path exists as cited: a root citation of a root file, or an
      // archive citation of an archived file — nothing to say either way.
      const existsAsCited = existsSync(path.join(root, c.path));
      if (existsAsCited) continue;
      const rootPath = `${c.tree}/${c.file}`;
      if (c.dir !== null && existsSync(path.join(root, rootPath))) {
        note(BACKLOG_REL_PATH, r.lineNo, `${r.id} cites ${c.path}; the file is still at ${rootPath} (not yet archived)`);
        continue;
      }
      const dirs = archiveIndex[c.tree].get(c.file) ?? [];
      if (c.dir === null) {
        // (b) a root citation whose file has left the root: resolve by basename
        // within the cited tree.
        if (dirs.length === 1) continue;
        if (dirs.length > 1) {
          note(BACKLOG_REL_PATH, r.lineNo, `${r.id} cites ${c.path}, which has been archived; candidates: ${dirs.map((d) => `${c.tree}/archive/${d}/${c.file}`).join(", ")}`);
          continue;
        }
        violation(BACKLOG_REL_PATH, r.lineNo, `${r.id} cites ${c.path}, which does not exist anywhere under ${c.tree}/`);
        continue;
      }
      if (dirs.length === 1) {
        violation(BACKLOG_REL_PATH, r.lineNo, `${r.id} cites ${c.path}, which does not exist; the file is at ${c.tree}/archive/${dirs[0]}/${c.file}`);
      } else {
        const candidates = dirs.length > 1
          ? `; candidates: ${dirs.map((d) => `${c.tree}/archive/${d}/${c.file}`).join(", ")}`
          : "";
        violation(BACKLOG_REL_PATH, r.lineNo, `${r.id} cites ${c.path}, which does not exist anywhere under ${c.tree}/${candidates}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check (3): queue <-> backlog.
// ---------------------------------------------------------------------------

const QUEUE_ID_RE = /(?<![A-Za-z0-9])E(\d+)([A-Za-z]?)(?![A-Za-z0-9])/g;

function checkQueue(queueLines, ticketRows) {
  const rowById = new Map(ticketRows.map((r) => [r.id, r]));
  let checked = 0;
  for (const t of parseTables(queueLines)) {
    if (t.headerCells.length < 2 || t.headerCells[0] !== "#" || t.headerCells[1] !== "票") continue;
    for (const r of t.rows) {
      if (r.cells.length < 2) continue;
      if (r.cells[0] === "—") continue;
      const ids = [...r.cells[1].matchAll(QUEUE_ID_RE)].map((m) => ({ id: m[0], parent: `E${m[1]}`, suffixed: m[2] !== "" }));
      if (ids.length === 0) continue;
      checked++;
      for (const { id, parent, suffixed } of ids) {
        if (rowById.has(id)) continue;
        if (suffixed && rowById.has(parent)) continue;
        violation(QUEUE_REL_PATH, r.lineNo, `${id} has no row in ${BACKLOG_REL_PATH}`);
      }
      const first = ids[0];
      const backlogRow = rowById.get(first.id);
      if (!backlogRow) continue;
      const ticked = r.cells[1].includes("✅ DONE");
      if (ticked && !backlogRow.closed) {
        violation(QUEUE_REL_PATH, r.lineNo, `${first.id} is ticked DONE here but ${BACKLOG_REL_PATH}:${backlogRow.lineNo} does not lead with a DONE or VOID mark`);
      } else if (!ticked && backlogRow.closed) {
        violation(QUEUE_REL_PATH, r.lineNo, `${first.id} is not ticked DONE here but ${BACKLOG_REL_PATH}:${backlogRow.lineNo} is marked ${backlogRow.mark.token}`);
      }
    }
  }
  return checked;
}

// ---------------------------------------------------------------------------
// Check (4): fan-out Decisions rows.
// ---------------------------------------------------------------------------

function listFanoutManifests() {
  try {
    return git(["ls-files", "--", "specs/fanout-*.md"]).split("\n").filter(Boolean);
  } catch (err) {
    return cannotRun(`git ls-files failed (${err && err.message ? err.message.split("\n")[0] : err})`);
  }
}

function checkDecisions(relPath) {
  let lines;
  try {
    lines = readFileSync(path.join(root, relPath), "utf-8").split("\n");
  } catch (err) {
    if (err && err.code === "ENOENT") return 0;
    throw err;
  }
  const headingIdx = lines.findIndex((l) => /^## Decisions\s*$/.test(l.replace(/\r$/, "")));
  if (headingIdx === -1) return 0;
  let sectionEnd = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }
  const table = parseTables(lines).find((t) => t.headerLineNo > headingIdx + 1 && t.headerLineNo <= sectionEnd);
  if (!table) {
    violation(relPath, headingIdx + 1, "Decisions section has no table");
    return 0;
  }
  if (!arraysEqual(table.headerCells, DECISIONS_HEADER)) {
    violation(relPath, table.headerLineNo, `Decisions table header must be "${DECISIONS_HEADER.join(" | ")}"`);
    return 0;
  }
  for (const r of table.rows) {
    const [date = "", decider = "", content = "", source = ""] = r.cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      violation(relPath, r.lineNo, `decision row: date cell "${date}" is not YYYY-MM-DD`);
    }
    if (decider === "") {
      violation(relPath, r.lineNo, "decision row: decider cell is empty");
    } else if (!DECIDERS.has(decider)) {
      violation(relPath, r.lineNo, `decision row: decider cell "${decider}" must name who decided (人類 or 整合者); who executed belongs in the content cell`);
    }
    if (content === "" || content === "—") violation(relPath, r.lineNo, "decision row: content cell is empty");
    if (source === "" || source === "—") violation(relPath, r.lineNo, "decision row: source cell is empty");
  }
  return table.rows.length;
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

const { baseRef } = parseArgs(process.argv.slice(2));
const backlogLines = readRequired(BACKLOG_REL_PATH);
const queueLines = readRequired(QUEUE_REL_PATH);
const manifests = listFanoutManifests();

const { ticketRows, orderRows } = backlogModel(backlogLines);
checkIds(ticketRows, baseRef);
const archiveIndex = buildArchiveIndex();
checkCitations(ticketRows, archiveIndex);
checkCitations(orderRows, archiveIndex);
const queueChecked = checkQueue(queueLines, ticketRows);
let decisionRows = 0;
for (const m of manifests) decisionRows += checkDecisions(m);

if (violations.length > 0) {
  console.error(`check:bookkeeping — ${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error("\ncheck:bookkeeping — FAILED");
}
if (notes.length > 0) {
  console.log(`check:bookkeeping — ${notes.length} note(s) (non-blocking):\n`);
  for (const n of notes) console.log(`  ${n}`);
  console.log("");
}
if (violations.length > 0) process.exit(1);

console.log(
  `check:bookkeeping — OK (${ticketRows.length} ticket row(s), ${queueChecked} queue row(s), ${decisionRows} decision row(s) checked)`
);
