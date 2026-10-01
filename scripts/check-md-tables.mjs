#!/usr/bin/env node
// Fail the build if a git-tracked Markdown file carries a malformed GFM table.
// Rule 1: every data row has as many cells as its header row.
// Rule 2: every table block starts with [header, delimiter row]; this also
//   catches one table split in two by a blank line.
// Discriminators (E74): (i) an escaped `\|` is a literal pipe; (ii) fenced
// code is never a table; (iii) a row starts with `|` at column 0; (iv) rule 1
// skips the delimiter row. Why each is needed: see specs/e260c-bin-scripts.md.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// qa_reports/ and review_reports/ hold recorded evidence, where the fix this
// lint would demand (escaping `|` in a recorded shell command) changes what
// the command means. Do not remove this exclusion; reasoning and measured
// blast radius: see specs/e260c-bin-scripts.md.
const EXCLUDED_DIR_PREFIXES = ["qa_reports/", "review_reports/"];

// Done-mark position advisory (E88), advisory-only (never affects the exit
// code or allViolations): a `**DONE**` / `**PARTIAL**` / `**VOID**` mark
// buried mid-cell is easy to miss. Scoped to docs/backlog.md's two known
// table shapes by exact header match. Why advisory: see specs/e260c-bin-scripts.md.
const BACKLOG_REL_PATH = "docs/backlog.md";
// Matches the opening of a bold marker (`**DONE`, word boundary so
// `**PARTIALLY**` does not match). The closing `**` is not anchored: the
// corpus mostly bolds the "— shipped vX.Y.Z" stamp inside the same span.
// findGenuineDoneMark then skips code-span matches and requires the span to
// self-close or carry a version/date stamp. Fails toward silence.
// Measurements behind both rules: see specs/e260c-bin-scripts.md.
const DONE_MARK_OPEN_RE = /\*\*(DONE|PARTIAL|VOID)\b/g;
const MARK_STAMP_RE = /v\d+(?:\.\d+){1,2}|\d{4}-\d{2}-\d{2}/;

// CommonMark code-span rule, applied to a single table cell (cells are
// always single-line here, so no need to handle span content that spans
// multiple lines): an opening run of N backtick characters is closed by
// the NEXT run of exactly N backticks; a backtick run with no same-length
// partner later in the string is a literal backtick, not a span boundary.
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

// Round 3 (E145): a `*"…"*` span, this repo's style for quoting another
// row's text, is excluded exactly like a code span, since a quoted mark
// with a stamp would otherwise qualify. An unpaired `*"` opener yields no
// range, so the candidate still advises. Deliberately narrow: other quote
// styles still advise, because widening would silence genuine marks.
// Measurement, the true positive it keeps and known residuals: see specs/e260c-bin-scripts.md.
function findCitationQuoteRanges(text) {
  const ranges = [];
  const openRe = /(?<!\*)\*"(?!\*)/g;
  let om;
  while ((om = openRe.exec(text))) {
    const closeRe = /"\*(?!\*)/g;
    closeRe.lastIndex = om.index + om[0].length;
    const cm = closeRe.exec(text);
    if (cm === null) continue; // no closing "* later in the cell -> not a real citation span
    ranges.push([om.index, cm.index + cm[0].length]);
    openRe.lastIndex = cm.index + cm[0].length;
  }
  return ranges;
}

// Returns { index, token } for the first bold DONE/PARTIAL/VOID span in
// `cellTrimmed` that opens outside any code span and citation quote and
// either self-closes or carries a version/date stamp; else null. `matchAll`
// clones the module-scope `/g` regex per call, so no `lastIndex` state
// leaks between rows.
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
    if (closeIdx === -1) continue; // no closing "**" in this cell -> not a real span
    const spanBody = cellTrimmed.slice(bodyStart, closeIdx);
    const selfCloses = spanBody === "";
    const hasStamp = MARK_STAMP_RE.test(spanBody);
    if (!selfCloses && !hasStamp) continue;
    return { index: idx, token: m[1] };
  }
  return null;
}
const TICKET_TABLE_HEADER = ["id", "desc", "priority", "depends_on", "est. files", "design-link"];
const ORDER_TABLE_HEADER = ["order", "ticket", "intake", "why here"];

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Returns { index, label } for the done-mark-bearing column when `headerCells`
// (trimmed) matches one of the two known docs/backlog.md table shapes
// exactly, else null. Header-shape-based, not heading-text-based, so this
// naturally excludes docs/backlog.md's older 3-column order tables (`order |
// ticket | why here`, no `intake`) without any special-casing.
function backlogDoneMarkColumn(headerCells) {
  const norm = headerCells.map((c) => c.trim());
  if (arraysEqual(norm, TICKET_TABLE_HEADER)) {
    return { index: norm.indexOf("desc"), label: "desc" };
  }
  if (arraysEqual(norm, ORDER_TABLE_HEADER)) {
    return { index: norm.indexOf("why here"), label: "why here" };
  }
  return null;
}

// Split a table row into cells: strip one optional leading/trailing pipe,
// then split on unescaped `|` only (discriminator i).
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

function findTrackedMarkdownFiles() {
  const out = execFileSync("git", ["ls-files", "--", "*.md"], {
    cwd: root,
    encoding: "utf-8",
  });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((relPath) => !EXCLUDED_DIR_PREFIXES.some((prefix) => relPath.startsWith(prefix)));
}

function checkFile(relPath) {
  let raw;
  try {
    raw = readFileSync(path.join(root, relPath), "utf-8");
  } catch (err) {
    // `git ls-files` lists tracked-but-deleted files too; treat a missing
    // file as nothing to check rather than crashing with a raw stack trace.
    if (err && err.code === "ENOENT") return { violations: [], advisories: [] };
    throw err;
  }
  const lines = raw.split("\n");

  // Group lines into maximal runs of column-0 `|` lines, skipping fenced-code
  // interiors (discriminator ii) and never joining an indented `|` line (iii).
  // Fence state keeps the opening char and run length: CommonMark closes a
  // fence only on the same char, a run >= the opening's, and no info string.
  // Do not regress to a parity toggle; it mis-closes the 4-backtick fences
  // this repo has. Failure modes: see specs/e260c-bin-scripts.md.
  let fenceChar = null; // null when not inside a fence
  let fenceLen = 0;
  let run = [];
  const runs = [];

  for (let i = 0; i < lines.length; i++) {
    const lineRaw = lines[i].replace(/\r$/, "");
    const lineNo = i + 1;
    const trimmed = lineRaw.trim();

    const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(trimmed);
    if (fenceMatch) {
      const fenceRun = fenceMatch[1];
      const fenceInfo = fenceMatch[2];
      const char = fenceRun[0];
      const len = fenceRun.length;
      if (fenceChar === null) {
        // opens a new fence, regardless of any info string
        fenceChar = char;
        fenceLen = len;
      } else if (char === fenceChar && len >= fenceLen && fenceInfo.trim() === "") {
        // closes the current fence only on a matching char, run length >=
        // the opening's, and no trailing info string
        fenceChar = null;
        fenceLen = 0;
      }
      // else: fence-shaped line that doesn't close the current fence (wrong
      // char, shorter run, or carries an info string) — stays inside it.
      if (run.length) {
        runs.push(run);
        run = [];
      }
      continue;
    }

    if (fenceChar === null && /^\|/.test(lineRaw)) {
      run.push({ lineNo, raw: lineRaw });
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const violations = [];
  const advisories = [];
  const isBacklogFile = relPath === BACKLOG_REL_PATH;

  for (const block of runs) {
    const header = block[0];
    const headerCellCount = splitRow(header.raw).length;

    // GFM requires the delimiter row's cell count to equal the header's; a
    // mismatch means the block isn't a table at all (renders as a
    // paragraph) — the same symptom rule 2 exists to catch, so it must not
    // be waved through as "has a delimiter".
    const delimiterRowPresent = block.length >= 2 && isDelimiterRow(block[1].raw);
    const delimiterCellCount = delimiterRowPresent ? splitRow(block[1].raw).length : null;
    const hasDelimiter = delimiterRowPresent && delimiterCellCount === headerCellCount;

    if (!hasDelimiter) {
      // Three causes land here and need different fixes (E74 F6):
      //   (a) blank-split: a blank line split one table; fix the blank line.
      //   (b) missing-delimiter: no delimiter row; add one.
      //   (c) mis-sized-delimiter: delimiter cell count differs from the header.
      // (a) also needs the nearest earlier run's HEADER cell count to equal this
      // block's (E105), so two separate adjacent tables are never merged.
      // Reasoning and the backlog rows it was verified on: see specs/e260c-bin-scripts.md.
      const prevLineNo = header.lineNo - 1;
      const precededByBlankLine = prevLineNo >= 1 && lines[prevLineNo - 1].trim() === "";
      let priorNonBlankIsTableRow = false;
      let priorRunHeaderCellCount = null;
      if (precededByBlankLine) {
        let ln = prevLineNo - 1;
        while (ln >= 1 && lines[ln - 1].trim() === "") ln--;
        priorNonBlankIsTableRow = ln >= 1 && /^\|/.test(lines[ln - 1]);
        if (priorNonBlankIsTableRow) {
          const priorRun = runs.find((r) => r[r.length - 1].lineNo === ln);
          if (priorRun) priorRunHeaderCellCount = splitRow(priorRun[0].raw).length;
        }
      }
      const isGenuineContinuation =
        priorNonBlankIsTableRow &&
        priorRunHeaderCellCount !== null &&
        priorRunHeaderCellCount === headerCellCount;

      let cause;
      if (precededByBlankLine && isGenuineContinuation) {
        cause = "blank-split"; // (a)
      } else if (delimiterRowPresent) {
        cause = "mis-sized-delimiter"; // (c)
      } else {
        cause = "missing-delimiter"; // (b)
      }

      violations.push({
        type: "no-delimiter",
        cause,
        file: relPath,
        line: header.lineNo,
        endLine: block[block.length - 1].lineNo,
        blankLineNo: cause === "blank-split" ? prevLineNo : null,
        headerCellCount,
        delimiterCellCount,
      });
      continue;
    }
    // Done-mark advisory scope (E88): the designated column of a known
    // docs/backlog.md table shape, computed once per block; null otherwise.
    // Headerless blocks already `continue`d above, so the escape-aware
    // splitRow is always the column splitter.
    const doneMarkCol = isBacklogFile ? backlogDoneMarkColumn(splitRow(header.raw)) : null;

    // rows 0=header, 1=delimiter (skipped per discriminator iv); data starts at 2.
    for (let r = 2; r < block.length; r++) {
      const row = block[r];
      const cells = splitRow(row.raw);
      const cellCount = cells.length;
      if (cellCount !== headerCellCount) {
        violations.push({
          type: "cell-count",
          file: relPath,
          line: row.lineNo,
          expected: headerCellCount,
          actual: cellCount,
        });
        // A mis-sized row's cells don't line up with the header at all —
        // rule 1 above already flags it; don't also guess at a column for
        // the done-mark check against an unreliable split.
        continue;
      }
      if (doneMarkCol && doneMarkCol.index >= 0) {
        const cellTrimmed = (cells[doneMarkCol.index] ?? "").trim();
        const marker = findGenuineDoneMark(cellTrimmed);
        if (marker && marker.index !== 0) {
          advisories.push({
            file: relPath,
            line: row.lineNo,
            token: marker.token,
            column: doneMarkCol.label,
          });
        }
      }
    }
  }

  return { violations, advisories };
}

const files = findTrackedMarkdownFiles();
const allViolations = [];
const allAdvisories = [];
for (const relPath of files) {
  const { violations, advisories } = checkFile(relPath);
  allViolations.push(...violations);
  allAdvisories.push(...advisories);
}

if (allViolations.length > 0) {
  console.error(`check:md-tables — ${allViolations.length} malformed table site(s) found:\n`);
  for (const v of allViolations) {
    if (v.type === "cell-count") {
      console.error(
        `  ${v.file}:${v.line} — row has ${v.actual} cell(s), header declares ${v.expected}`
      );
    } else {
      const trailer =
        "(rows inside this block are not cell-count-checked until it parses as a table — re-run after fixing)";
      if (v.cause === "blank-split") {
        console.error(
          `  ${v.file}:${v.line}-${v.endLine} — table block split from its header by the blank ` +
            `line at ${v.file}:${v.blankLineNo} — fix there ${trailer}`
        );
      } else if (v.cause === "mis-sized-delimiter") {
        console.error(
          `  ${v.file}:${v.line}-${v.endLine} — table block's delimiter row has ` +
            `${v.delimiterCellCount} cell(s), header declares ${v.headerCellCount} — fix the ` +
            `delimiter row's column count ${trailer}`
        );
      } else {
        console.error(
          `  ${v.file}:${v.line}-${v.endLine} — table block has no delimiter row (add one ` +
            `directly after the header) ${trailer}`
        );
      }
    }
  }
  console.error("\ncheck:md-tables — FAILED");
}

// Done-mark advisories (E88) are advisory-only: printed regardless of the
// fatal outcome above, but NEVER contributes to allViolations and NEVER
// changes the exit code below.
if (allAdvisories.length > 0) {
  console.log(
    `check:md-tables — ${allAdvisories.length} advisory note(s) (non-blocking, done-mark convention):\n`
  );
  for (const a of allAdvisories) {
    console.log(
      `  ${a.file}:${a.line} — done-mark **${a.token}** is buried mid-cell in the ${a.column} ` +
        `column (should lead the cell) — see docs/backlog.md E88`
    );
  }
}

if (allViolations.length > 0) {
  process.exit(1);
}

console.log(`check:md-tables — OK (${files.length} file(s) scanned, 0 malformed tables)`);
