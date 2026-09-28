#!/usr/bin/env node
// Fail the build if a git-tracked Markdown file carries a malformed GFM table.
//
// Two rules, both measured against this repo (see docs/backlog.md E74):
//   (1) every data row's cell count must equal its header row's cell count.
//   (2) every table block must carry a delimiter row (the `|---|---|` line)
//       immediately after its header, and must not be split across a blank
//       line — a block whose first two lines aren't [header, delimiter] is
//       flagged whole, which is what catches both "no delimiter row" blocks
//       and "blank line broke a single logical table into two" blocks (the
//       second half never has its own delimiter row either).
//
// Four discriminators, each load-bearing (E74's own words — omit any and the
// checker produces false positives worse than having no checker at all):
//   (i)   an escaped `\|` is a literal pipe, not a cell separator.
//   (ii)  lines inside fenced code blocks (``` or ~~~) are never table rows.
//   (iii) a table row must start with `|` at column 0 — an indented `|` line
//         is a lazy-continuation line of a `- [ ]` list item, not a row.
//   (iv)  the delimiter row itself is skipped by rule (1)'s cell-count check;
//         a table block ends at the first line that isn't a column-0 `|` row.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// qa_reports/ is a write-once forensic artifact and review_reports/archive/
// likewise; live review_reports/ is not write-once (it was written twice
// during this feature) but is excluded anyway because it holds the same
// kind of recorded evidence (backlog E74/E17): the fix this checker would
// otherwise demand — escaping `|` inside a recorded shell command — changes
// what that command means (POSIX BRE `\|` is alternation, not an escaped
// literal; verified on this platform's grep, `^\| N/A` then matches every
// line, not just the intended prefix). A misrendered table cell in an
// evidence file is cheaper than a falsified command, so these directories
// are out of scope for this lint. Measured blast radius: this excludes 565
// of 806 tracked .md files but conceals exactly 2 rule-1 (cell-count)
// sites and 0 rule-2 (no-delimiter) sites — narrowing the exclusion further
// would not shrink coverage in practice. Do not "tidy this away" by
// removing the exclusion — that re-opens the corruption.
const EXCLUDED_DIR_PREFIXES = ["qa_reports/", "review_reports/"];

// E88 — advisory-only (never affects exit code or allViolations): the
// docs/backlog.md done-mark convention (`**DONE**` / `**PARTIAL**` /
// `**VOID**`, optionally followed by `— shipped vX.Y.Z`) is free text with
// no fixed cell position, and can be buried mid-cell where a truncated read
// misses it (2026-08-21) or a mis-parsed row lands it in the wrong column
// entirely (2026-08-28 v3.105.0, the E96/E74 unescaped-`\|` recurrence).
// Pipe-escaping is already covered corpus-wide by rule 1's cell-count check
// (verified 0 violations); this adds the position half, scoped to
// docs/backlog.md's two known table shapes by exact header-cell match (not
// filename heuristic alone, not corpus-wide) — see
// specs/e88-e105-md-table-checker.md Decisions §1-2. Shipped advisory, not
// fatal, because the ticket table already carries 5 pre-existing
// already-shipped rows (E39/E40/E58/E59/E71) that predate this check; making
// it fatal today would force an off-topic docs/backlog.md normalization pass
// into this ticket (see NEW-TICKETS.md L-MDTOOL-N1).
const BACKLOG_REL_PATH = "docs/backlog.md";
// Matches the OPENING of the bold marker only (`**DONE`, with a word
// boundary so `**PARTIALLY**` — real prose in this file, not a marker —
// doesn't false-positive). Deliberately does NOT anchor the closing `**`:
// the live corpus's dominant convention bolds the trailing "— shipped
// vX.Y.Z" (or "(vX.Y.Z)") INSIDE the same span as the token
// (`**DONE — shipped v3.109.0**`, `**DONE (v3.105.1)**`), not as plain text
// after a self-closed `**DONE**` — measured 92 DONE / 7 PARTIAL / 3 VOID
// bold-marker instances, only 30 of the 92 DONE ones self-close immediately
// after the token. "Should lead the cell" is a question about where the
// marker OPENS, not what it closes around.
//
// Round-2 (code-reviewer C1): "opens with the token" is not the same
// predicate as "is a done-mark" — 2 of the 6 round-1 advisories fired on
// bold text that was not a marker at all: docs/backlog.md:193 quoted a
// DIFFERENT row's mark (E48's) inside a code span, and :210 was prose on
// E88's own still-open row ("the order table records them **DONE and
// shipped**"). Measured over all 65 marker-bearing cells in the two scoped
// tables: excluding any match whose opening falls inside a code span, AND
// requiring the bold span to either self-close immediately after the token
// (`**DONE**`) or carry a `vX.Y[.Z]` / ISO-date stamp INSIDE the span itself
// (`**DONE — shipped v3.109.0**`, `**PARTIAL 2026-08-21 — …**`) gives
// exactly the 4 genuine buried marks (E39/E40/E58/E59) with ZERO loss
// across the other 63 cells — every compound-form mark still resolves, and
// every leading mark still suppresses. Both axes are orthogonal to the
// column-split axis where E88/E96 were historically defeated (an unescaped
// `|` meeting a naive splitter) — `splitRow()` and `headerCellCount` are
// untouched here. Fails toward SILENCE: no closing `**` found, or no
// qualifying match at all, means no advisory — never a false claim.
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

// Round-3 (E145, coordinator forensics corrected the ticket's own premise —
// see docs/backlog.md E145 and the handoff pending_notes for this feature):
// round 2's code-span exclusion (above) closed the citation door for a
// QUOTED CODE excerpt (docs/backlog.md:193's `` `**DONE**` `` inside
// backticks) but not for a quoted PROSE excerpt — this repo's citation
// convention for quoting another row's text verbatim is an italic-wrapped,
// double-quoted span, `*"…"*` (not a code span at all). docs/backlog.md's
// own E145 row demonstrates the recurrence: it quotes E59's row inline as
// `*"… E57's deliverable **DONE** (shipped v3.99.0, commit 25d231e)"*`, and
// that bold span self-closes with a version stamp, so round 2's test
// (self-closes OR carries a stamp) qualifies it exactly like a genuine mark
// would — the citation door is the QUALIFYING test, not the code-span gate.
//
// Verified this is NOT the same false positive the ticket's own close-out
// note named: docs/backlog.md:181 (E59's row) is NOT a citation of E57 — E57
// shipped v3.98.0 (E57's own last-cell mark), while :181's desc-cell mark
// reads "**DONE** (shipped v3.99.0, commit 25d231e)", the same version AND
// commit as E59's OWN last-cell mark. :181 is structurally identical to
// :165/:166/:180 (original desc prose, then an appended own-row close-out
// mark) — a true positive. Silencing it would have been the real loss.
//
// Fix is exclusion-only, same shape as findCodeSpanRanges(): find every
// `*"…"*` span (an opening `*"` not itself part of a `**` run, closed by
// the NEXT `"*` not itself opening a new `**` run) and treat it exactly
// like a code span for this predicate. An unpaired opening delimiter (no
// matching `"*` anywhere later in the cell) yields NO citation range —
// it is not a real citation span, so the candidate falls through to the
// normal code-span/stamp tests, and a qualifying one still ADVISES. This
// is the same direction CS-UNMATCHED-BACKTICK and CS-UNPAIRED-3BACKTICK
// already take for an unpaired backtick run: an unmatched opener is a
// literal, not a span boundary, so it never suppresses a candidate — the
// alternative (fabricating a range anyway) risks swallowing a real,
// un-quoted mark, which is the direction this file forbids.
//
// Measured (E88-style) over all 68 marker-bearing cells (75 candidate bold
// DONE/PARTIAL/VOID opens) in the two scoped docs/backlog.md tables: adding
// this exclusion flips exactly ONE cell's outcome — docs/backlog.md's E145
// row (the candidate at desc-offset 483, inside the `*"…"*` quote of E59's
// mark; the row's other two candidates at offsets 356/373 were already
// suppressed by the round-2 code-span exclusion) — from a genuine
// (non-leading) buried mark to correctly excluded. The other 67
// marker-bearing cells are byte-identical in outcome: the same 4 rows
// (E39 :165, E40 :166, E58 :180, E59 :181) still fire as advisories with
// the same token/offset, and ZERO other cells lose a genuine mark.
//
// Residuals (measured by code-reviewer round 1, review_T-E145-01, recorded
// here — neither changes behaviour, both fail toward this file's documented
// safe direction, and neither occurs in the live corpus):
//   - The close search below takes the NEXT `"*` anywhere later in the
//     cell, unbounded and not code-span-aware: a `*"` opener that itself
//     sits inside a code span (e.g. `` `a *" b` ``) can still open a range
//     that extends past it, silencing a genuine mark it should not reach.
//     One-line hardening for a follow-up ticket: skip an opener whose
//     index is `insideCodeSpan`.
//   - The predicate is deliberately narrow: `*"…"*` only. Other citation
//     costumes — `*"…"*` with typographic quotes, plain `"…"`, `**"…"**`,
//     or bare `*…*` — still advise on a cited mark. This is intentional,
//     not an oversight: widening to plain quotes or bare italics would
//     start excluding ordinary prose emphasis, i.e. silencing genuine
//     marks — the direction this ticket forbids. Revisit only if a second
//     costume actually appears in the corpus.
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
// `cellTrimmed` that (a) does not open inside a code span, (b) does not open
// inside a `*"…"*` citation-quote span (round 3, E145), and (c) either
// self-closes immediately after the token or carries a version/date stamp
// inside the span — else null. `matchAll` (not a shared/global `.exec`
// loop) is deliberate: it clones the regex and its `lastIndex` per call, so
// a module-scope `/g` regex reused across many rows/files never leaks
// state between calls (the exact silent-skip risk C2 flagged for a `/g`
// regex reused at module scope).
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

  // Group lines into maximal contiguous runs of column-0 `|` lines, skipping
  // fenced-code interiors entirely (discriminator ii) and never letting an
  // indented `|` line join a run (discriminator iii, via the raw ^\| test).
  //
  // Fence state tracks the opening character and run length, not just a
  // parity toggle: CommonMark only closes a fence with the same character,
  // a run length >= the opening's, and no info string on the closing line.
  // A bare toggle mis-closes a 4-backtick block on an inner 3-backtick
  // fence, un-fencing the rest of the file for the remainder of the toggle
  // parity — reproduced as both a false positive (100%-fenced file flagged)
  // and a silent false negative (a real cell-count defect after such a
  // block reported as 0 malformed tables, exit 0). This repo already
  // carries 4-backtick fences (content/coord-01-core-head.md:50,
  // content/coord-02-host-dispatch.md:5) — do not regress to toggle
  // semantics.
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
      // Three distinct causes land here (E74 F6) and only one of them is
      // fixed by touching a blank line — conflating them produces a
      // confidently wrong remedy:
      //   (a) a blank line split one logical table into two headerless
      //       halves; this block is the second half. Fix: the blank line.
      //   (b) the block genuinely has no delimiter row. Fix: add one.
      //   (c) a delimiter row is present but its cell count doesn't match
      //       the header (created by rule 1's own fix, F3) — "no delimiter
      //       row" would be factually false here. Fix: the delimiter row.
      //
      // Discriminator for (a) vs (b)/(c): walk up past this block's own
      // preceding blank line(s) to the nearest non-blank line. A column-0
      // `|` row there means SOME table's content lives earlier in the file
      // — but a leading pipe alone doesn't tell us it's THIS block's own
      // header/delimiter being continued (E105): two genuinely separate,
      // adjacent tables produce the exact same shape (blank line, then a
      // column-0 `|` line above it) even though the earlier run belongs to
      // a different, already-complete table. Following the (a) remedy
      // (delete the blank line) in that case merges two distinct tables and
      // demotes the second header to a data row — the corruption this
      // checker exists to catch.
      //
      // Tie-break (E105, verified against docs/backlog.md:78 vs :170 (a
      // true continuation, both 6-cell headers) and :168 (an unrelated
      // 9-cell adjacent row that a naive adjacent-line check would
      // misclassify as a continuation)): find the RUN that nearest
      // non-blank line belongs to, and compare ITS HEADER's cell count —
      // not the nearest row's own cell count, which may be a delimiter or
      // data row — against this block's header cell count. Equal counts
      // mean this block really is the second half of that same table (a).
      // A mismatch means the prior run is a different, complete table; this
      // block gets no credit for the blank line and falls through to
      // missing-delimiter/mis-sized-delimiter (b/c) like any other
      // standalone headerless block.
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
    // E88: only a table shaped exactly like one of the two known
    // docs/backlog.md headers is in scope, and only its designated column.
    // Computed once per block (not per row) since the header doesn't change
    // row to row; null when this block isn't one of the two known shapes,
    // isn't in docs/backlog.md, or isn't a well-formed table at all (a
    // headerless block above already `continue`d before reaching here, so
    // rule 1's escape-aware `splitRow` is always the one doing the column
    // split — never a second, naive parser beside it).
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

// E88 — advisory-only: printed regardless of the fatal outcome above, but
// NEVER contributes to allViolations and NEVER changes the exit code below.
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
