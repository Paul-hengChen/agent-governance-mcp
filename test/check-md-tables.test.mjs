// Coded by @qa-engineer: tests for the markdown table integrity checker (T-E74-02).
//
// scripts/check-md-tables.mjs has no prior test/check-md-tables.test.mjs —
// this file is NEW, created under a pre-authorization to add a test file
// for this checker (T-E74-02; dispatch brief: "Test-file placement: creation pre-authorized —
// test/check-md-tables.test.mjs is the suggested home"), following the
// scratch-repo spawn pattern in test/check-version.test.mjs. UNLIKE
// check-version.mjs, the checker calls `git ls-files` internally, so each
// fixture is a REAL (throwaway) git repo: `git init` + write files + `git
// add -A` — `git ls-files` reads the index, no commit is required. The
// real script is copied byte-for-byte into `<fixture>/scripts/` (it
// resolves its own root from `import.meta.url`), never touching this
// repo's own tree.
//
// HARD CONSTRAINT: no fixture here may read this repo's git
// HISTORY (a pinned sha, `git show <rev>:<path>`, `git log`) — that is
// exactly the class test/render-structure.test.mjs's meta-test forbids
// (T-E77-02).
// Every fixture below is synthetic content invented for this file, git-
// initialized fresh inside a tmpdir; nothing here reads a commit of THIS
// repository. The literal real-repo "22 sites / 17 files, single pre-fix
// pass names 21" oracle from the task text (T-E74-01/02) was verified BY HAND
// (spawning the real script against a `git worktree` at the pre-fix
// commit, then again after applying only the blank-line fix, then again
// on the fully fixed tree) and is recorded in
// qa_reports/review_T-E74-02.md's AC Execution note — deliberately NOT
// baked into this permanent suite, both because it would violate the
// no-history-read guard above and because the task itself says to prefer class
// assertions over instance pins (the convention set by E66/E69). The
// MASK-1/2/3 tests below reproduce the SAME masking mechanism at
// fixture scale (a whole-table violation hiding a per-row defect; finding F4),
// so the invariant stays pinned even after docs/backlog.md's content moves on.
//
// Spec-to-test map (rule text of T-E74-01 and numbered items of T-E74-02):
//   AC (rule 1, cell-count)                          -> MASK-*, DELIM-SKIP, GD-*
//   AC (rule 2, delimiter-row / blank-split, masking) -> MASK-1/2/3, MSG-A/B/C
//   pre-fix tree reds, post-fix tree clean (T-E74-02 item 1) -> MASK-1 (reds),
//                                                        MASK-3 (clean),
//                                                        manual proof in
//                                                        qa_reports/review_T-E74-02.md
//   escaped `\|` is not a cell break (T-E74-02 item 2, i)        -> GD-1
//   pipes inside fenced code are ignored (item 2, ii; finding F1) -> GD-2a, GD-2b
//   an indented `|` line is not a table row (item 2, iii)         -> GD-3, EDGE-1
//   delimiter-row handling (item 2, iv)                           -> DELIM-SKIP, MSG-C
//   message correctness, not just detection (finding F6)          -> MSG-A, MSG-B, MSG-C
//     — each asserts the EXACT emitted cause text, then follows the
//       prescribed remedy and re-runs to confirm the violation actually
//       clears (the strongest form the round-3 review ran by hand).
//   tracked-but-deleted file must not crash with ENOENT (F5) -> SMOKE-DELETED
//   boundary/security smoke                            -> SMOKE-EMPTY-REPO,
//                                                          SMOKE-EMPTY-FILE,
//                                                          SMOKE-CRLF

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const REAL_SCRIPT = fs.readFileSync(
  path.join(PROJECT_ROOT, "scripts", "check-md-tables.mjs"),
  "utf-8",
);

// Sanity: fail loudly (not silently pass) if the real script's shape drifts
// out from under this fixture builder's assumptions about its message text.
assert.ok(
  REAL_SCRIPT.includes("EXCLUDED_DIR_PREFIXES"),
  "fixture assumes the real script still excludes qa_reports/ and review_reports/; update if the F2 exclusion is removed",
);

function mkFixtureRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-md-tables-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "check-md-tables.mjs"), REAL_SCRIPT);
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, "scripts", "check-md-tables.mjs")], {
    encoding: "utf-8",
  });
}

// ============================================================================
// Naive reconstruction of the pre-fix / never-fixed checker, one discriminator
// at a time. Each of `escapeAware` / `fenceMode` / `columnZeroOnly` defaults
// to the CORRECT (fixed) behaviour; a test flips exactly ONE to the naive
// value so the fixture isolates that single discriminator's failure (each
// discriminator must be demonstrated to red against a reconstruction of
// the naive version; T-E74-02 item 2). `fenceMode: "none"` models a checker
// that never special-cased fences at all (the basic fenced-code case);
// `fenceMode: "toggle"` models the ACTUAL pre-fix bug this repo shipped and
// round-2 review caught (finding F1) — a parity flip on any `>= 3` backtick/tilde
// run, blind to character and run-length, which is right on a simple
// open/close pair and wrong the moment an odd number of inner fence-marker
// lines appears inside an outer fence of a different length.
// ============================================================================

function naiveSplitRow(raw, { escapeAware }) {
  let s = raw.replace(/\r$/, "").trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !(escapeAware && s.endsWith("\\|"))) s = s.slice(0, -1);
  return escapeAware ? s.split(/(?<!\\)\|/) : s.split("|");
}

function naiveIsDelimiterRow(raw, opts) {
  if (!/^\|/.test(raw)) return false;
  const cells = naiveSplitRow(raw, opts).map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function naiveCheck(raw, opts) {
  const { escapeAware = true, fenceMode = "aware", columnZeroOnly = true } = opts;
  const lines = raw.split("\n");
  let fenceChar = null;
  let fenceLen = 0;
  let run = [];
  const runs = [];

  for (let i = 0; i < lines.length; i++) {
    const lineRaw = lines[i].replace(/\r$/, "");
    const lineNo = i + 1;
    const trimmed = lineRaw.trim();
    const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(trimmed);

    if (fenceMatch && fenceMode !== "none") {
      if (fenceMode === "aware") {
        const fenceRun = fenceMatch[1];
        const char = fenceRun[0];
        const len = fenceRun.length;
        if (fenceChar === null) {
          fenceChar = char;
          fenceLen = len;
        } else if (char === fenceChar && len >= fenceLen && fenceMatch[2].trim() === "") {
          fenceChar = null;
          fenceLen = 0;
        }
      } else {
        // "toggle": any fence-marker line flips state, char/length ignored.
        fenceChar = fenceChar === null ? "x" : null;
      }
      if (run.length) {
        runs.push(run);
        run = [];
      }
      continue;
    }

    const isFenced = fenceMode !== "none" && fenceChar !== null;
    const rowTest = columnZeroOnly ? /^\|/.test(lineRaw) : /^\s*\|/.test(lineRaw);
    if (!isFenced && rowTest) {
      run.push({ lineNo, raw: lineRaw });
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const violations = [];
  for (const block of runs) {
    const header = block[0];
    const headerCellCount = naiveSplitRow(header.raw, { escapeAware }).length;
    const delimiterRowPresent = block.length >= 2 && naiveIsDelimiterRow(block[1].raw, { escapeAware });
    const delimiterCellCount = delimiterRowPresent
      ? naiveSplitRow(block[1].raw, { escapeAware }).length
      : null;
    const hasDelimiter = delimiterRowPresent && delimiterCellCount === headerCellCount;
    if (!hasDelimiter) {
      violations.push({ type: "no-delimiter", line: header.lineNo });
      continue;
    }
    for (let r = 2; r < block.length; r++) {
      const cellCount = naiveSplitRow(block[r].raw, { escapeAware }).length;
      if (cellCount !== headerCellCount) {
        violations.push({
          type: "cell-count",
          line: block[r].lineNo,
          expected: headerCellCount,
          actual: cellCount,
        });
      }
    }
  }
  return violations;
}

// ============================================================================
// GD-1..GD-4 — guard-the-guard: each discriminator, real script correct,
// naive reconstruction red.
// ============================================================================

test("GD-1 (discriminator i): a correctly-escaped `\\|` is a literal, not a cell separator — naive bare-pipe split misreports it, the real script does not", () => {
  const content = "| Col1 | Col2 |\n|---|---|\n| A\\| B | C |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `real script must not flag a correctly-escaped pipe; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK \(1 file/);

  const naiveViolations = naiveCheck(content, { escapeAware: false });
  assert.equal(naiveViolations.length, 1, "a bare-pipe-split naive reconstruction must misreport this row");
  assert.equal(naiveViolations[0].type, "cell-count");
  assert.equal(naiveViolations[0].actual, 3, "naive split sees 3 cells where there are really 2");
});

test("GD-2a (discriminator ii, basic): a pipe-bearing line inside a fenced block is not a table row — a checker with zero fence awareness misreports it, the real script does not", () => {
  const content = "```\n| union | A | B |\n```\n\n| X | Y |\n|---|---|\n| 1 | 2 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `real script must skip fenced content; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK \(1 file/);

  const naiveViolations = naiveCheck(content, { fenceMode: "none" });
  assert.equal(naiveViolations.length, 1, "a fence-blind naive reconstruction must misreport the fenced pipe line as a 1-line headerless table");
  assert.equal(naiveViolations[0].type, "no-delimiter");
});

test("GD-2b (discriminator ii, F1 regression): a 4-backtick block containing a single inner 3-backtick fence-marker line breaks a naive parity-toggle tracker, silently hiding a real defect after the true close — the real (run-length-aware) script still catches it", () => {
  // Marker lines: L1 "````text" (4-tick open), L3 "```" (3-tick, does not
  // close a 4-tick-opened fence per CommonMark), L5 "````" (4-tick, true
  // close) — 3 marker lines, ODD parity. A naive toggle ends up "still in
  // fence" after L5 (verified by hand: MARK/MARK/MARK sequence leaves
  // inFence=true), so the genuine defect below is never scanned — this is
  // the exact "reported OK over a real defect" shape (F1).
  const content = "````text\nintro\n```\nafter\n````\n\n| A | B |\n|---|---|\n| 1 | 2 | 3 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.notEqual(result.status, 0, "the real script must still detect the defect after a fence with an odd inner marker count");
  assert.match(result.stderr, /t\.md:9 — row has 3 cell\(s\), header declares 2/);

  const naiveViolations = naiveCheck(content, { fenceMode: "toggle" });
  assert.equal(
    naiveViolations.length,
    0,
    "a parity-toggle fence tracker must silently miss this defect (F1's false negative) — if this fires, F1 has stopped being load-bearing evidence for the fix",
  );
});

test("GD-3 (discriminator iii): an indented `|` line is a lazy continuation of a `- [ ]` item, not a table row — a column-agnostic naive reconstruction misreports it, the real script does not", () => {
  const content = "- [ ] item text\n  | continuation looks like a table row |\n\n| P | Q |\n|---|---|\n| 1 | 2 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `real script must not treat the indented continuation as a table row; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK \(1 file/);

  const naiveViolations = naiveCheck(content, { columnZeroOnly: false });
  assert.equal(naiveViolations.length, 1, "a column-agnostic naive reconstruction must misreport the indented continuation as a headerless 1-line table");
  assert.equal(naiveViolations[0].type, "no-delimiter");
  assert.equal(naiveViolations[0].line, 2);
});

test("GD-4 (discriminator iv): the delimiter row is skipped by the cell-count check and a block ends at the first non-`|` line — violations attribute to the real data row, never the delimiter or header", () => {
  const content = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| x | y |\n| 4 | 5 | 6 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /1 malformed table site/);
  assert.match(result.stderr, /t\.md:4 — row has 2 cell\(s\), header declares 3/, "the violation must be attributed to the bad data row's own line, not the header (1) or delimiter (2)");
});

// ============================================================================
// MSG-A/B/C — message correctness: the three causes behind "no-delimiter"
// (blank-split / missing-delimiter / mis-sized-delimiter) each emit the
// cause-specific text, AND following the prescribed remedy actually clears
// the violation — not merely detected, but correctly diagnosed and fixable (F6).
// ============================================================================

test("MSG-A (F6 cause a, blank-split): message names the severing blank line and prescribes deleting it — following that remedy clears the violation", () => {
  const preFix = "| A | B |\n|---|---|\n| 1 | 2 |\n\n| C | D |\n| 3 | 4 |\n";
  const root = mkFixtureRepo({ "t.md": preFix });
  const before = run(root);
  assert.notEqual(before.status, 0);
  assert.match(
    before.stderr,
    /t\.md:5-6 — table block split from its header by the blank line at t\.md:4 — fix there/,
  );

  // Remedy: delete the blank line at t.md:4.
  const postFix = "| A | B |\n|---|---|\n| 1 | 2 |\n| C | D |\n| 3 | 4 |\n";
  fs.writeFileSync(path.join(root, "t.md"), postFix);
  const after = run(root);
  assert.equal(after.status, 0, `following the blank-split remedy must clear the violation; stderr: ${after.stderr}`);
});

test("MSG-B (F6 cause b, missing-delimiter): message says to add a delimiter row and does NOT claim a severing blank line — following that remedy clears the violation", () => {
  const preFix = "# Heading\n\n| E | F |\n| 5 | 6 |\n";
  const root = mkFixtureRepo({ "t.md": preFix });
  const before = run(root);
  assert.notEqual(before.status, 0);
  assert.match(
    before.stderr,
    /t\.md:3-4 — table block has no delimiter row \(add one directly after the header\)/,
  );
  assert.doesNotMatch(before.stderr, /split from its header/, "cause (b) must not be confused with cause (a) — the preceding non-blank line here is a heading, not a table row");

  // Remedy: insert a delimiter row after the header.
  const postFix = "# Heading\n\n| E | F |\n|---|---|\n| 5 | 6 |\n";
  fs.writeFileSync(path.join(root, "t.md"), postFix);
  const after = run(root);
  assert.equal(after.status, 0, `following the missing-delimiter remedy must clear the violation; stderr: ${after.stderr}`);
});

test("MSG-C (F6 cause c, mis-sized-delimiter): message reports BOTH cell counts and prescribes fixing the delimiter's column count, never claims 'no delimiter row' — following that remedy clears the violation", () => {
  const preFix = "| a | b |\n|---|\n| 1 | 2 |\n";
  const root = mkFixtureRepo({ "t.md": preFix });
  const before = run(root);
  assert.notEqual(before.status, 0);
  assert.match(
    before.stderr,
    /t\.md:1-3 — table block's delimiter row has 1 cell\(s\), header declares 2 — fix the delimiter row's column count/,
  );
  assert.doesNotMatch(before.stderr, /has no delimiter row/, "cause (c) must not be reported as 'no delimiter row' — a delimiter row IS present, just the wrong width");

  // Remedy: widen the delimiter row to match the header's column count.
  const postFix = "| a | b |\n|---|---|\n| 1 | 2 |\n";
  fs.writeFileSync(path.join(root, "t.md"), postFix);
  const after = run(root);
  assert.equal(after.status, 0, `following the mis-sized-delimiter remedy must clear the violation; stderr: ${after.stderr}`);
});

// ============================================================================
// EDGE-1 — round-3 review's suspect edge case: the nearest non-blank line
// above a defective, blank-preceded block is an INDENTED `|` continuation
// (not a real column-0 table row). Must classify as (b) missing-delimiter,
// never (a) blank-split — an indented line can never be "the header this
// block was severed from".
// ============================================================================

test("EDGE-1: an indented `|` continuation immediately above a blank-preceded defective block does not trigger cause (a) — classified (b), same as if nothing preceded it", () => {
  const content = "- [ ] item text\n  | continuation looks like a table row |\n\n| P | Q |\n| 1 | 2 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /t\.md:4-5 — table block has no delimiter row/, "must classify as (b), not (a) — the indented line above it is not a real table row per discriminator (iii)");
  assert.doesNotMatch(result.stderr, /split from its header/);
});

// ============================================================================
// MASK-1/2/3 — class-level reproduction of the masking mechanism (F4) that
// backs the requirement to "prove it reds against the PRE-fix tree and
// exits 0 after" (T-E74-02 item 1). Oracle: a single pre-fix pass under-names sites because a
// whole-block violation masks a per-row defect inside it, and fixing just
// the blank line surfaces the masked defect while the block violation
// itself disappears — net count unchanged, composition changed). This
// mirrors docs/backlog.md's real shape (a stray blank line splits a table,
// concealing one bad row inside the second half) without pinning to that
// file's line numbers or content.
// ============================================================================

const MASK_PRE_FIX =
  "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| p | q |\n\n| r | s | t |\n| u | v | w | z |\n| m | n | o |\n";
const MASK_PARTIAL_FIX = // only the stray blank line removed
  "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| p | q |\n| r | s | t |\n| u | v | w | z |\n| m | n | o |\n";
const MASK_FULL_FIX = // blank line removed AND both bad rows corrected
  "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| p | q | . |\n| r | s | t |\n| u | v | w |\n| m | n | o |\n";

test("MASK-1 (pre-fix tree reds): a genuine cell-count row PLUS a blank-severed second block are both reported, but the block violation MASKS the cell-count defect hiding inside it — 2 sites reported, not 3", () => {
  const root = mkFixtureRepo({ "t.md": MASK_PRE_FIX });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /2 malformed table site/, "the masked row inside the blank-severed block must NOT be separately reported yet");
  assert.match(result.stderr, /t\.md:4 — row has 2 cell\(s\), header declares 3/);
  assert.match(result.stderr, /t\.md:6-8 — table block split from its header by the blank line at t\.md:5/);
  assert.doesNotMatch(result.stderr, /t\.md:7/, "the masked row (line 7) must not appear on its own while the block above it is still unfixed");
});

test("MASK-2 (partial fix surfaces the masked row): removing ONLY the stray blank line still reports 2 sites, but the composition changes — the block violation disappears and the previously-masked row surfaces in its place", () => {
  const root = mkFixtureRepo({ "t.md": MASK_PARTIAL_FIX });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /2 malformed table site/, "count must stay 2 — one violation dropped out, a different one surfaced");
  assert.match(result.stderr, /t\.md:4 — row has 2 cell\(s\), header declares 3/, "the original cell-count defect is untouched by the blank-line fix");
  assert.match(result.stderr, /t\.md:6 — row has 4 cell\(s\), header declares 3/, "the masking is gone: the previously-hidden row now reports on its own line");
  assert.doesNotMatch(result.stderr, /split from its header/, "the block-level violation must be gone now that the blank line is fixed");
});

test("MASK-3 (full fix exits 0): once the blank line is removed AND both defective rows are corrected, the checker passes clean", () => {
  const root = mkFixtureRepo({ "t.md": MASK_FULL_FIX });
  const result = run(root);
  assert.equal(result.status, 0, `fully-fixed tree must exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK \(1 file/);
});

// ============================================================================
// SMOKE-* — boundary / security smoke tests (Phase 3d).
// ============================================================================

test("SMOKE-EMPTY-REPO: zero tracked .md files -> exits 0, reports 0 scanned, does not crash", () => {
  const root = mkFixtureRepo({ ".gitkeep": "" });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK \(0 file\(s\) scanned, 0 malformed tables\)/);
});

test("SMOKE-EMPTY-FILE: a zero-byte tracked .md file -> no violations, does not crash", () => {
  const root = mkFixtureRepo({ "empty.md": "" });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
});

test("SMOKE-CRLF: CRLF line endings do not defeat the delimiter/row parsing — a real defect is still caught, well-formed rows are not falsely flagged", () => {
  const root = mkFixtureRepo({ "crlf.md": "| A | B |\r\n|---|---|\r\n| 1 | 2 | 3 |\r\n" });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /crlf\.md:3 — row has 3 cell\(s\), header declares 2/);
});

test("SMOKE-DELETED (F5 regression): a git-tracked but on-disk-deleted .md file does not crash the scan — it is skipped, and other files are still checked", () => {
  const root = mkFixtureRepo({
    "deleted.md": "| A | B |\n|---|---|\n| 1 | 2 |\n",
    "kept.md": "| C | D |\n|---|---|\n| 1 | 2 | 3 |\n", // genuine defect, must still be caught
  });
  fs.unlinkSync(path.join(root, "deleted.md")); // stays in the git index, gone from disk
  const result = run(root);
  assert.notEqual(result.status, 0, "kept.md's genuine defect must still be reported");
  assert.doesNotMatch(result.stderr, /ENOENT/, "a tracked-but-deleted file must not surface a raw crash");
  assert.doesNotMatch(result.stderr, /Error/, "must fail loud on the real defect, not on the missing file");
  assert.match(result.stderr, /kept\.md:3 — row has 3 cell\(s\), header declares 2/);
});

// ============================================================================
// Fix for how the checker tells the three no-delimiter causes apart: (a) blank-split,
// (b) missing delimiter, (c) mis-sized delimiter. Adjacent tables whose header cell counts
// differ used to be reported as (a) even when the cause was (b) or (c)
// (E105-* tests; T-E105-01, feature e88-e105-md-table-checker, task T-E88E105-02).
// Two adjacent tables with different header cell counts occur 0 times in this repo — a
// green corpus run proves nothing about it, and neither does reading the
// code (per specs/e88-e105-md-table-checker.md's own "Not a live defect"
// note). Every case below is fixture-based. The strongest pin is behavioural
// (the spec's proof line for the message check): assert the exact cause + message, then apply the
// *prescribed* remedy and re-run to confirm the violation actually clears —
// and, for the missing-delimiter case, also apply the OLD (pre-fix) remedy
// and confirm it does NOT clear cleanly but instead produces 2 cell-count
// violations — the exact corruption class the fix exists to prevent (E105; per the
// spec's Problem Statement: "delete the blank line" on a real (b)/(c) case
// merges two distinct tables and demotes the second header to a data row).
// ============================================================================

test("E105-B (AC2, missing-delimiter): two adjacent tables with DIFFERENT header cell counts, second headerless with no delimiter row at all — cause must be missing-delimiter, never blank-split", () => {
  const content = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n\n| D | E |\n| 4 | 5 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const before = run(root);
  assert.notEqual(before.status, 0);
  assert.match(
    before.stderr,
    /t\.md:5-6 — table block has no delimiter row \(add one directly after the header\)/,
    "must name the delimiter fix, not the blank line",
  );
  assert.doesNotMatch(before.stderr, /split from its header/, "cause must NOT be blank-split — the two tables' header cell counts (3 vs 2) differ, so the prior run is a different, complete table");

  // OLD (pre-fix) remedy: delete the blank line, as a presence-only
  // discriminator would have prescribed. This MERGES the two distinct
  // tables and demotes "D | E" to a data row of the first table — it does
  // NOT clear the defect, it produces 2 fresh cell-count violations. This
  // is the corruption the fix exists to prevent (E105); pinning it here so a future
  // reader can see the old remedy was actively harmful, not just unhelpful.
  const oldRemedy = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| D | E |\n| 4 | 5 |\n";
  fs.writeFileSync(path.join(root, "t.md"), oldRemedy);
  const afterOldRemedy = run(root);
  assert.notEqual(afterOldRemedy.status, 0, "the OLD blank-line-deletion remedy must NOT clear the violation");
  assert.match(afterOldRemedy.stderr, /2 malformed table site/, "the old remedy must produce 2 fresh cell-count violations, not a clean tree");
  assert.match(afterOldRemedy.stderr, /t\.md:4 — row has 2 cell\(s\), header declares 3/);
  assert.match(afterOldRemedy.stderr, /t\.md:5 — row has 2 cell\(s\), header declares 3/);

  // NEW (prescribed) remedy: add a delimiter row to the second table. This
  // actually clears the violation.
  const newRemedy = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n\n| D | E |\n|---|---|\n| 4 | 5 |\n";
  fs.writeFileSync(path.join(root, "t.md"), newRemedy);
  const afterNewRemedy = run(root);
  assert.equal(afterNewRemedy.status, 0, `the prescribed missing-delimiter remedy must clear the violation; stderr: ${afterNewRemedy.stderr}`);
});

test("E105-C (AC2, mis-sized-delimiter): two adjacent tables with DIFFERENT header cell counts, second has a delimiter-shaped row but the wrong width — cause must be mis-sized-delimiter, never blank-split", () => {
  const content = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n\n| D | E |\n|---|\n| 4 | 5 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const before = run(root);
  assert.notEqual(before.status, 0);
  assert.match(
    before.stderr,
    /t\.md:5-7 — table block's delimiter row has 1 cell\(s\), header declares 2 — fix the delimiter row's column count/,
  );
  assert.doesNotMatch(before.stderr, /split from its header/, "cause must NOT be blank-split even though a delimiter-shaped row is present");

  // Prescribed remedy: widen the second table's own delimiter row.
  const fixed = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n\n| D | E |\n|---|---|\n| 4 | 5 |\n";
  fs.writeFileSync(path.join(root, "t.md"), fixed);
  const after = run(root);
  assert.equal(after.status, 0, `the prescribed mis-sized-delimiter remedy must clear the violation; stderr: ${after.stderr}`);
});

test("E105-CONTINUATION (AC3, regression protection): a genuine single-table blank-split — second block's header cell count EQUALS the immediately-preceding run's header cell count — must still classify blank-split", () => {
  const content = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n\n| 4 | 5 | 6 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /t\.md:5-5 — table block split from its header by the blank line at t\.md:4 — fix there/);
});

test("E105-ADJACENT-EQUAL-COUNT (intended, not a bug — pinned per round-2 review residual note): two GENUINELY SEPARATE adjacent tables whose header cell counts happen to be EQUAL still classify blank-split — the tie-break cannot distinguish this from a true continuation, and AC3's own continuation test IS exactly this shape", () => {
  const content = "| A | B |\n|---|---|\n| 1 | 2 |\n\n| C | D |\n| 3 | 4 |\n";
  const root = mkFixtureRepo({ "t.md": content });
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /t\.md:5-6 — table block split from its header by the blank line at t\.md:4 — fix there/,
    "documented as intended behaviour — do NOT 'fix' this later without a PM decision; the tie-break has no way to tell a coincidentally-equal-width second table from a real continuation",
  );
});

// ============================================================================
// ADV-* — advisory for done-marks whose leading token is wrong (T-E88-01, AC4-AC7).
// Class assertions, not instance pins (convention since E66/E69) — none of
// these hardcode a docs/backlog.md line number; the real-corpus check is
// separate (see AC7 below) and asserts only exit 0, never a fixed count,
// because docs/backlog.md is edited by seven concurrent Wave 1 lanes.
// ============================================================================

test("ADV-ORDER-TABLE (AC4): order-table-shaped fixture (`order | ticket | intake | why here`) with a buried DONE marker in why-here produces a non-fatal advisory naming the file/line/column, exit 0", () => {
  const content =
    "| order | ticket | intake | why here |\n" +
    "|---|---|---|---|\n" +
    "| 1a | E90 | x | note text **DONE** (v3.99.0) trailing |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `advisory must not affect exit code; stderr: ${result.stderr}`);
  assert.match(result.stdout, /1 advisory note\(s\) \(non-blocking, done-mark convention\):/);
  assert.match(result.stdout, /docs\/backlog\.md:3 — done-mark \*\*DONE\*\* is buried mid-cell in the why here column \(should lead the cell\) — see docs\/backlog\.md E88/);
  assert.doesNotMatch(result.stderr, /malformed table/, "an advisory must never be counted as a violation");
});

test("ADV-TICKET-TABLE (AC5, positive): ticket-table-shaped fixture (`id | desc | priority | depends_on | est. files | design-link`) with a buried DONE marker in desc produces the advisory, scoped to desc", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | buried text **DONE** (v3.99.0) trailing | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /docs\/backlog\.md:3 — done-mark \*\*DONE\*\* is buried mid-cell in the desc column \(should lead the cell\) — see docs\/backlog\.md E88/);
});

test("ADV-TICKET-TABLE-NEG (AC5, negative): a marker-looking bold span buried in a NON-desc column (design-link) with a clean desc cell must NOT fire — the rule is scoped to desc only, never guesses at other columns", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | clean desc text no marker | P3 | none | 1 | note **DONE** (v3.99.0) |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.doesNotMatch(result.stdout, /advisory note/, "a buried marker-shaped span in design-link/priority/depends_on/est. files must never fire — only desc (ticket table) / why here (order table) are scoped");
});

test("ADV-LEADING (baseline, not a residual): a marker that already LEADS the cell must never advise — 'should lead the cell' only fires on a non-zero index", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | **DONE** (v3.99.0) trailing text | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /advisory note/);
});

test("ADV-NON-BACKLOG (AC6): a file at a path OTHER than docs/backlog.md, containing a table shaped identically to the ticket-table convention with an identical buried marker, produces zero advisories — the rule is hardcoded to docs/backlog.md, never corpus-wide", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | buried text **DONE** (v3.99.0) trailing | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/other.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.doesNotMatch(result.stdout, /advisory note/, "identical shape outside docs/backlog.md must never fire");
});

test("ADV-NONFATAL-BOTH-DIRECTIONS: an advisory-only tree exits 0; the SAME advisory alongside a genuinely malformed table elsewhere exits 1, counting ONLY the malformed table", () => {
  // Direction 1: advisory only.
  const advisoryOnly =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | buried text **DONE** (v3.99.0) trailing | P3 | none | 1 | N/A |\n";
  const root1 = mkFixtureRepo({ "docs/backlog.md": advisoryOnly });
  const result1 = run(root1);
  assert.equal(result1.status, 0, `advisory-only tree must exit 0; stderr: ${result1.stderr}`);
  assert.match(result1.stdout, /1 advisory note/);

  // Direction 2: same advisory PLUS a separate, genuinely malformed table.
  const advisoryPlusMalformed =
    advisoryOnly + "\n| X | Y |\n| 1 | 2 | 3 |\n";
  const root2 = mkFixtureRepo({ "docs/backlog.md": advisoryPlusMalformed });
  const result2 = run(root2);
  assert.notEqual(result2.status, 0, "the malformed table must still fail the build");
  assert.match(result2.stderr, /1 malformed table site/, "count must be 1 — the advisory is never added to allViolations");
  assert.match(result2.stdout, /1 advisory note/, "the advisory must still print even when the build fails for an unrelated reason");
});

test("RULE1-SUPPRESSES-ADVISORY (non-regression invariant, the exact v3.105.0 recurrence shape): an unescaped `|` inside a code span in the desc cell still goes FATAL under rule 1 (cell-count), and the advisory is suppressed for that row — splitRow()/headerCellCount are untouched by the E88 advisory code", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E99 | see `a|b` **DONE** (v1.0.0) | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.notEqual(result.status, 0, "an unescaped pipe inside a code span must still be fatal under rule 1 — column determination is unchanged by this feature");
  assert.match(result.stderr, /docs\/backlog\.md:3 — row has 7 cell\(s\), header declares 6/);
  assert.doesNotMatch(result.stdout, /advisory note/, "a row that fails rule 1's cell-count check must never also be advisory-checked against an unreliable split");
});

test("RESIDUAL-COINCIDENTAL-COLUMN-SHIFT (intended, not a bug — pinned per round-2 review residual note): a row whose cell count coincidentally still equals headerCellCount despite content having shifted (one unescaped pipe adding a split, one missing pipe elsewhere removing one) leaves the advisory SILENT because the mark no longer lands in the desc slice — this is the pre-existing rule-1 blind spot for coincidentally-well-counted rows, not new, and it fails in the safe direction (silence, never a false claim)", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E99 | see `a|b` **DONE** (v1.0.0) | P3 | none 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, "coincidentally-equal cell count must not trip rule 1 either — this pins the shape, not just the advisory silence");
  assert.doesNotMatch(result.stdout, /advisory note/, "the marker exists in the row but not in the desc-indexed slice after the coincidental shift — must stay silent, never guess");
});

// ============================================================================
// CS-* — findCodeSpanRanges() / findGenuineDoneMark() discriminator tests.
// This is a new parser in a file already defeated twice by parser subtlety
// (the fence-toggle bug from review, F1, and the tie-break rule added with the
// E105 fix). Independently re-derived
// against CommonMark's code-span rule (an opening run of N backticks is
// closed by the NEXT run of exactly N backticks; an unmatched run is a
// literal backtick) rather than copied from any prior review's case list.
// ============================================================================

test("CS-UNMATCHED-BACKTICK: a single backtick with no same-length partner anywhere in the cell is a literal, not a code-span opener — the marker after it still fires", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | odd ` backtick then **DONE** (v3.99.0) | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/);
});

test("CS-2RUN-CONTAINING-1RUN (the `` ``a ` b`` `` shape, marker OUTSIDE): a 2-backtick-run span whose interior contains an unpaired single backtick closes correctly at the NEXT 2-run — a marker after the span still fires (a parity-based backtick counter would miscount the interior single backtick and could misplace the span boundary; the shipped equal-length pairing does not)", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | see ``a ` b`` then **DONE** (v3.99.0) trailing | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/);
});

test("CS-2RUN-CONTAINING-1RUN-MARKER-INSIDE (the same `` ``a ` b`` `` shape, marker INSIDE): the same 2-run-containing-a-1-run span, but the marker itself sits inside it — must be suppressed, since the span still closes at the next matching 2-run and correctly encloses the marker", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | prefix ``a **DONE** (v3.99.0) ` b`` suffix | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /advisory note/, "a marker whose bold-open falls inside a code span must never advise, even when the span's interior itself contains an odd backtick");
});

test("CS-PAIRED-3BACKTICK: a paired ``` ... ``` span closes correctly (next matching 3-run) — a marker after it fires", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | ```code``` then **DONE** (v3.99.0) | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/);
});

test("CS-UNPAIRED-3BACKTICK: a 3-backtick run with no matching partner in the cell is a literal, not a span opener — the marker after it still fires", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | ```code no close then **DONE** (v3.99.0) | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/);
});

test("CS-NO-CLOSING-BOLD (E105/E88-adjacent no-closing-`**` case): a bold span that opens with the token but never closes within the cell is not a real span at all — fails toward silence, never a false claim", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | buried **DONE no closing bold marker here | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /advisory note/);
});

test("CS-NON-QUALIFYING-BOLD-BODY: a bold span that opens with the token but whose body is neither empty (self-close) nor carries a version/date stamp is prose, not a done-mark, even though it is buried — fails toward silence", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | prose text **DONE and shipped** more prose | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /advisory note/, "'**DONE and shipped**' has no stamp inside its own span and does not self-close — must not be reported as a done-mark");
});

test("CS-MULTI-CANDIDATE: the first bold-DONE candidate is disqualified (its open falls inside a code span) but scanning continues to a SECOND, later, qualifying candidate in the same cell — matchAll iteration, not a return-on-first-match", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | ``**DONE** inside span`` filler **DONE** (v3.99.0) | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/, "the second, qualifying candidate must still be found even though the first candidate in the cell was disqualified");
});

test("CS-ESCAPED-PIPE-ADJACENT: an escaped `\\|` sitting next to a code span, with a genuine buried marker after it, is parsed as one normal cell (rule 1's escape-awareness) and the marker still fires — the two discriminators (escape-awareness, code-span-awareness) are independent and both apply", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    "| E90 | see `a\\|b` then **DONE** (v3.99.0) trailing | P3 | none | 1 | N/A |\n";
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `an escaped pipe must not be treated as a cell separator; stderr: ${result.stderr}`);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/);
});

// ============================================================================
// CQ-* — findCitationQuoteRanges() / citation-exclusion discriminator tests
// (T-E145-02). The code-reviewer's review_reports/review_T-E145-01.md "Required
// follow-through for qa-engineer" section names these 9 cases; the fix under
// test shipped with ZERO direct coverage before this round. All fixtures use
// the ticket-table shape (desc column) already established by the CS-* block
// above. Per this file's own convention (since E66/E69), these assert class
// behaviour (advisory fires / stays silent), never a fixed offset.
// ============================================================================

test("CQ-CITED-MARK-SUPPRESSED: a done-mark that appears only inside a `*\"…\"*` citation-quote span is not the row's OWN mark — no advisory", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | cites *"E59 **DONE** (v3.99.0)"* tail | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.doesNotMatch(result.stdout, /advisory note/, "a mark that only exists inside a citation-quote span must never be attributed to the citing row");
});

test("CQ-MULTI-CANDIDATE: a citation-excluded candidate does not stop the scan — the SECOND, genuine candidate in the same cell still fires (the matchAll invariant, citation exclusion composes with code-span exclusion the same way)", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | cites *"E59 **DONE** (v3.99.0)"* filler **DONE** (v1.0.0) tail | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/, "the first candidate is disqualified by the citation range, but the scan must continue to the second, genuine one — a citation exclusion that used `return` instead of `continue` would silence this instead");
});

test("CQ-GENUINE-OUTSIDE-QUOTE: a genuine buried mark sitting BETWEEN two citation-quote spans still fires — the exclusion is range-scoped, not 'anything after the first quote'", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | *"a"* then **DONE** (v1.0.0) then *"b"* | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/, "the mark's own open index falls outside both citation ranges and must still advise");
});

test("CQ-UNPAIRED-OPENER (guards the Q1 comment correction): an unpaired `*\"` opener with no matching closing `\"*` later in the cell yields NO citation range — the candidate falls through and still ADVISES, exactly like CS-UNMATCHED-BACKTICK/CS-UNPAIRED-3BACKTICK treat an unmatched delimiter as a literal, not a span", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | quote *"unclosed start and then **DONE** (v1.0.0) ships | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/, "an unpaired opener must not fabricate a range that swallows a real mark — fabricating one here would be the false-claim-avoiding direction taken too far, silencing a genuine mark instead");
});

test("CQ-CELL-START: a citation-quote span opening at cell-content offset 0 is still recognized and excludes its own mark — no advisory", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | *"E59 **DONE** (v3.99.0)"* trailing | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.doesNotMatch(result.stdout, /advisory note/, "a citation span at the very start of the cell must be recognized, not just one preceded by other text");
});

test("CQ-CELL-END: a citation-quote span closing at the very end of the cell is still recognized and excludes its own mark — no advisory", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | trailing text *"E59 **DONE** (v3.99.0)"* | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.doesNotMatch(result.stdout, /advisory note/, "a citation span whose close delimiter is the last thing in the cell must still be recognized");
});

test("CQ-ESCAPED-PIPE-IN-CITATION: an escaped `\\|` inside a citation-quote span is one normal cell (rule 1's escape-awareness, untouched by this feature) and the cited mark stays suppressed — no violation, no advisory", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | cites *"a \\| b **DONE** (v3.99.0)"* then prose | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `an escaped pipe inside a citation must not be treated as a cell separator; stderr: ${result.stderr}`);
  assert.doesNotMatch(result.stderr, /malformed table/, "escape-awareness and citation-quote-awareness are independent discriminators; neither should trip the other");
  assert.doesNotMatch(result.stdout, /advisory note/, "the cited mark stays suppressed even with an escaped pipe inside the same span");
});

test("CQ-BOLD-RUN-NOT-AN-OPENER (pins C4 as intended, not an oversight): a `**\"…\"**` bold-quoted costume is NOT recognized as a `*\"…\"*` citation opener — the delimiter guards correctly refuse a `**` run, so the cited mark still fires. Widening this predicate would silence genuine marks; a future deliberate widening must flip this test, not stumble into it", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | **"E59 **DONE** (v3.99.0)"** tail | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /done-mark \*\*DONE\*\* is buried mid-cell in the desc column/, "a `**\"..\"**` costume must NOT be excluded — the narrow `*\"…\"*`-only predicate is a deliberate, recorded residual (C4), not a bug to quietly fix by widening the regex");
});

test("CQ-RESIDUAL-SPAN-SWALLOW (pins C3 as a RECORDED residual, currently silent — a future hardening must flip this deliberately): an opener living inside a code span, paired with an unrelated later `\"*`, produces an over-broad, non-code-span-aware range that swallows a genuine mark — SILENT today", () => {
  const content =
    "| id | desc | priority | depends_on | est. files | design-link |\n" +
    "|---|---|---|---|---|---|\n" +
    '| E90 | see `a *" b` then **DONE** (v1.0.0) and "* tail | P3 | none | 1 | N/A |\n';
  const root = mkFixtureRepo({ "docs/backlog.md": content });
  const result = run(root);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.doesNotMatch(result.stdout, /advisory note/, "this is the documented C3 residual: the close search is unbound and not code-span-aware, so a `*\" ` opener inside a code span can pair with a distant `\"*` and swallow a genuine mark; it fails toward the safe (silent) direction and is pinned here so a future one-line hardening (skip an opener whose index is insideCodeSpan) flips this test on purpose");
});

// ============================================================================
// AC7 — the real docs/backlog.md in THIS repository, run for real (not a
// fixture) via the actual script. Deliberately asserts ONLY exit 0 — never a
// fixed advisory count or fixed line numbers, since docs/backlog.md is
// edited concurrently by up to seven other Wave 1 lanes and a count pin here
// would red on every unrelated backlog edit (see spec AC7's own proof line:
// "informational, not a pass/fail gate"). The advisory-line count is
// recorded as evidence in qa_reports/review_T-E88E105-02.md instead.
// ============================================================================

test("AC7 (real corpus, informational count NOT pinned here): `node scripts/check-md-tables.mjs` against this actual repository's docs/backlog.md still exits 0 — the E88 advisory must never turn a pre-existing row fatal", () => {
  const result = spawnSync(process.execPath, [path.join(PROJECT_ROOT, "scripts", "check-md-tables.mjs")], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
  assert.equal(result.status, 0, `real corpus run must exit 0; stderr: ${result.stderr}`);
});

test("CQ-9 (real corpus, non-regression, T-E145-02 required case 9): the real docs/backlog.md still exits 0, still advises on the E39/E40/E58/E59 rows, and does NOT advise on the E145 row — identified by TICKET ID via a live line-number lookup, never a hardcoded line number or a fixed advisory count (docs/backlog.md is edited by concurrent lanes)", () => {
  const backlogPath = path.join(PROJECT_ROOT, "docs", "backlog.md");
  const backlogLines = fs.readFileSync(backlogPath, "utf-8").split("\n");
  const lineOfTicket = (id) => {
    const idx = backlogLines.findIndex((l) => new RegExp(`^\\| ${id} \\|`).test(l));
    assert.notEqual(idx, -1, `expected a live docs/backlog.md row for ${id} — this test's premise (the ticket exists) no longer holds`);
    return idx + 1; // 1-indexed, matching the script's own lineNo
  };
  const genuineLines = new Set(["E39", "E40", "E58", "E59"].map(lineOfTicket));
  const falsePositiveLine = lineOfTicket("E145");

  const result = spawnSync(process.execPath, [path.join(PROJECT_ROOT, "scripts", "check-md-tables.mjs")], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
  assert.equal(result.status, 0, `real corpus run must exit 0; stderr: ${result.stderr}`);

  const advisedLines = new Set(
    [...result.stdout.matchAll(/docs\/backlog\.md:(\d+) — done-mark/g)].map((m) => Number(m[1])),
  );
  for (const line of genuineLines) {
    assert.ok(advisedLines.has(line), `expected an advisory on docs/backlog.md:${line} (a genuine buried own-row mark) — got advisories on lines [${[...advisedLines].join(", ")}]`);
  }
  assert.ok(!advisedLines.has(falsePositiveLine), `docs/backlog.md:${falsePositiveLine} (E145's own row, which only cites another row's mark inside a *"…"*  span) must stay silent — got advisories on lines [${[...advisedLines].join(", ")}]`);
});

// ============================================================================
// Wiring sanity: the npm script exists and points at this file.
// ============================================================================

test("WIRING: package.json's check:md-tables script invokes scripts/check-md-tables.mjs", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
  assert.equal(pkg.scripts["check:md-tables"], "node scripts/check-md-tables.mjs");
});
