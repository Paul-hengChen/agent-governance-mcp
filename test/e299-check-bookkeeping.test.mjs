// Coded by @qa-engineer: tests for the bookkeeping checker scripts/check-bookkeeping.mjs (T-E299-05).
// Spec of record: specs/e299-check-bookkeeping.md — every case below carries the AC it proves in its name.
// Pattern follows test/check-md-tables.test.mjs: each fixture is a real throwaway git repo with the real
// script copied into `<fixture>/scripts/`, spawned for real; assertions are on exit code and message
// CLASS (stable text fragments), never on docs/backlog.md line numbers of this repository.
// Creation of this file was pre-authorized in the T-E299-05 dispatch brief (Test-file placement).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_SRC = fs.readFileSync(path.join(PROJECT_ROOT, "scripts", "check-bookkeeping.mjs"), "utf-8");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.invalid",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.invalid",
};
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------

const TICKET_HEAD =
  "| id | desc | priority | depends_on | est. files | design-link |\n|---|---|---|---|---|---|\n";
const ORDER_HEAD = "| order | ticket | intake | why here |\n|---|---|---|---|\n";
const QUEUE_HEAD = "| # | 票 | P | 一句話 | 發現於 | 為什麼排在這個位置 |\n|---|---|---|---|---|---|\n";
const DEC_HEAD = "| 日期 | 裁決者 | 內容 | 出處 |\n|---|---|---|---|\n";
const trow = (id, desc) => `| ${id} | ${desc} | P3 | none | 1 | N/A |\n`;
const qrow = (n, ticket) => `| ${n} | ${ticket} | P2 | x | y | z |\n`;
const backlog = (...rows) => TICKET_HEAD + rows.join("");
const queue = (...rows) => QUEUE_HEAD + rows.join("");
const manifest = (decisionsBody) => `# wave\n\n## Decisions\n\n${decisionsBody}\n## Next\n\ntext\n`;

// opts.commit: commit the initial files on branch `main` (default true); opts.branch: initial branch name.
function mkFixture(files, opts = {}) {
  const { commit = true, branch = "main" } = opts;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-bookkeeping-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "check-bookkeeping.mjs"), SCRIPT_SRC);
  git(root, "init", "-q", "-b", branch);
  const all = { "docs/backlog.md": backlog(), "docs/v4.0.0-new-tickets.md": queue(), ...files };
  for (const [rel, content] of Object.entries(all)) write(root, rel, content);
  git(root, "add", "-A");
  if (commit) git(root, "commit", "-q", "-m", "base");
  return root;
}

function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function run(root, args = [], cwd = root) {
  return spawnSync(process.execPath, [path.join(root, "scripts", "check-bookkeeping.mjs"), ...args], {
    cwd,
    encoding: "utf-8",
  });
}

const assertClean = (r, why = "") => assert.equal(r.status, 0, `expected exit 0 ${why}; stderr: ${r.stderr}`);
const assertViolation = (r, pattern, why = "") => {
  assert.equal(r.status, 1, `expected exit 1 ${why}; stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.match(r.stderr, pattern);
};

// ============================================================================
// Check (1) — ticket ids unique and monotone (AC1–AC4).
// ============================================================================

test("ID-DUP (AC1): the same id in two ticket-table rows is a violation naming both lines", () => {
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E1", "a"), trow("E2", "b"), trow("E1", "c")) });
  assertViolation(run(root), /docs\/backlog\.md:5 — ticket id E1 appears twice \(first at line 3\)/);
});

test("ID-HEADING-NOT-DUP (AC2): a `## E1 — …` long-form heading beside the E1 table row is not a duplicate — the id-space is table rows only", () => {
  const body = backlog(trow("E1", "a"), trow("E2", "b")) + "\n## E1 — long form\n\ntext\n\n## E2 — long form\n";
  const root = mkFixture({ "docs/backlog.md": body });
  const r = run(root);
  assertClean(r);
  assert.doesNotMatch(r.stderr, /appears twice/);
});

test("ID-MONO-LOWER (AC3): a row added below the base's maximum id is a violation naming the id, the maximum and the base sha", () => {
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E10", "a")) });
  write(root, "docs/backlog.md", backlog(trow("E10", "a"), trow("E9", "late")));
  assertViolation(run(root), /docs\/backlog\.md:4 — new ticket id E9 is not above the previous maximum E10 \(base [0-9a-f]{7}\)/);
});

test("ID-MONO-HIGHER (AC3): a row added above the base's maximum id is accepted", () => {
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E10", "a")) });
  write(root, "docs/backlog.md", backlog(trow("E10", "a"), trow("E11", "new")));
  assertClean(run(root));
});

test("ID-MONO-SPLIT (AC3): a suffixed id whose parent is in the base (E10a beside E10) is a split, not an ordering violation", () => {
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E10", "a"), trow("E12", "b")) });
  write(root, "docs/backlog.md", backlog(trow("E10", "a"), trow("E12", "b"), trow("E10a", "split")));
  assertClean(run(root));
});

test("ID-MONO-NO-BASE-NOTE (AC4): when no base ref resolves the monotone half is skipped with one stdout note and the exit code is unaffected", () => {
  // Branch `trunk` + one commit: neither origin/main nor main resolves.
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E10", "a")) }, { branch: "trunk" });
  write(root, "docs/backlog.md", backlog(trow("E10", "a"), trow("E9", "would be late")));
  const r = run(root);
  assertClean(r, "(ordering is not checked without a base)");
  assert.match(r.stdout, /docs\/backlog\.md — id ordering not checked: no base commit found \(pass --base <ref>\)/);
  assert.equal(r.stdout.match(/id ordering not checked/g).length, 1, "exactly one note");
});

test("ID-MONO-BASE-FLAG (AC4): `--base <ref>` supplies the base that the default lookup cannot find", () => {
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E10", "a")) }, { branch: "trunk" });
  write(root, "docs/backlog.md", backlog(trow("E10", "a"), trow("E9", "late")));
  const r = run(root, ["--base", "trunk"]);
  assertViolation(r, /new ticket id E9 is not above the previous maximum E10 \(base [0-9a-f]{7}\)/);
  assert.doesNotMatch(r.stdout, /id ordering not checked/);
});

// ============================================================================
// Check (2) — evidence citations on closed rows (AC5–AC7).
// ============================================================================

const closed = (cite) => `**DONE** (shipped v1.0.0) — evidence \`${cite}\``;

test("CITE-ROOT-ARCHIVED (AC5): a closed row citing a root file that now lives under archive/ names the one path it should use", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E5", closed("qa_reports/review_T-E5-01.md"))),
    "qa_reports/archive/e5-x/review_T-E5-01.md": "x",
  });
  assertViolation(
    run(root),
    /docs\/backlog\.md:3 — E5 cites qa_reports\/review_T-E5-01\.md, which does not exist; the file is at qa_reports\/archive\/e5-x\/review_T-E5-01\.md/,
  );
});

test("CITE-MISSING (AC5): a closed row citing a file that exists nowhere under its tree is a violation with the `anywhere under` wording", () => {
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E5", closed("review_reports/review_T-E5-01.md"))) });
  assertViolation(
    run(root),
    /docs\/backlog\.md:3 — E5 cites review_reports\/review_T-E5-01\.md, which does not exist anywhere under review_reports\//,
  );
});

test("CITE-AMBIGUOUS (AC5): several archive candidates are all listed after `candidates:` and none is picked", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E5", closed("qa_reports/review_T-E5-01.md"))),
    "qa_reports/archive/one/review_T-E5-01.md": "x",
    "qa_reports/archive/two/review_T-E5-01.md": "x",
  });
  const r = run(root);
  assertViolation(r, /which does not exist anywhere under qa_reports\/; candidates: /);
  assert.match(r.stderr, /qa_reports\/archive\/one\/review_T-E5-01\.md/);
  assert.match(r.stderr, /qa_reports\/archive\/two\/review_T-E5-01\.md/);
  assert.doesNotMatch(r.stderr, /the file is at/);
});

test("CITE-PREDICTED-ARCHIVE-TOLERATED (AC6): a cited archive/<dir>/ path whose file is still at the root is a note, not a failure; a DIFFERENT archive dir holding it is a failure", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E5", closed("qa_reports/archive/predicted/review_T-E5-01.md"))),
    "qa_reports/review_T-E5-01.md": "x",
  });
  const r = run(root);
  assertClean(r, "(file is still at the root)");
  assert.match(r.stdout, /docs\/backlog\.md:3 — E5 cites qa_reports\/archive\/predicted\/review_T-E5-01\.md; the file is still at qa_reports\/review_T-E5-01\.md \(not yet archived\)/);
});

test("CITE-WRONG-ARCHIVE-DIR (AC6): a cited archive/<dir>/ path whose file lives under a different archive dir is a violation naming the right one", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E5", closed("qa_reports/archive/wrong/review_T-E5-01.md"))),
    "qa_reports/archive/right/review_T-E5-01.md": "x",
  });
  assertViolation(run(root), /which does not exist; the file is at qa_reports\/archive\/right\/review_T-E5-01\.md/);
});

test("CITE-ROOT-TOLERATED (AC7): a closed row citing a root file that exists is a note saying it moves at the next release", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E5", closed("qa_reports/review_T-E5-01.md"))),
    "qa_reports/review_T-E5-01.md": "x",
  });
  const r = run(root);
  assertClean(r);
  assert.match(r.stdout, /docs\/backlog\.md:3 — E5 cites qa_reports\/review_T-E5-01\.md at the root; it moves under qa_reports\/archive\/ at the next release/);
});

test("CITE-OPEN-ROW-SKIPPED (AC7): an open row (no genuine leading mark) and a PARTIAL row report nothing even with a dead citation", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(
      trow("E5", "open work, evidence `qa_reports/review_T-GONE.md`"),
      trow("E6", "**PARTIAL** (shipped v1.0.0) — evidence `qa_reports/review_T-GONE2.md`"),
    ),
  });
  const r = run(root);
  assertClean(r);
  assert.doesNotMatch(r.stderr + r.stdout, /cites/);
});

test("CITE-GLOB-SKIPPED (AC7): glob-shaped and extension-less tokens (`review_*.md`, `review_<id>.md`, `qa_reports/`) are not citations", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(
      trow("E5", "**DONE** (shipped v1.0.0) — see `qa_reports/review_*.md`, `qa_reports/review_<id>.md`, `qa_reports/review_T-{a,b}.md` and the qa_reports/ tree"),
    ),
  });
  const r = run(root);
  assertClean(r);
  assert.doesNotMatch(r.stderr + r.stdout, /cites/);
});

test("CITE-NO-CROSS-TREE (AC7): a review_reports/ citation is never resolved to a same-named qa_reports/ file", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E5", closed("review_reports/review_T-E5-01.md"))),
    "qa_reports/review_T-E5-01.md": "x",
    "qa_reports/archive/d/review_T-E5-01.md": "x",
  });
  const r = run(root);
  assertViolation(r, /which does not exist anywhere under review_reports\//);
  assert.doesNotMatch(r.stderr, /qa_reports\//, "the other tree must never be offered as the fix");
});

test("CITE-ORDER-TABLE (AC5): an order-table row whose `why here` cell carries a genuine mark is judged like a closed ticket row", () => {
  const root = mkFixture({
    "docs/backlog.md":
      backlog(trow("E5", "x")) + "\n" + ORDER_HEAD + "| 1a | **E5** | x | **DONE** (shipped v1.0.0) evidence `qa_reports/review_T-E5-01.md` |\n",
  });
  assertViolation(run(root), /E5 cites qa_reports\/review_T-E5-01\.md, which does not exist anywhere under qa_reports\//);
});

// ============================================================================
// Check (3) — queue <-> backlog (AC8, AC9).
// ============================================================================

test("QUEUE-MISSING-ROW (AC8): a queue ticket with no backlog row is a violation; every id in the cell counts, bold or not", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E1", "open")),
    "docs/v4.0.0-new-tickets.md": queue(qrow(1, "**E1**（併 E2）")),
  });
  assertViolation(run(root), /docs\/v4\.0\.0-new-tickets\.md:3 — E2 has no row in docs\/backlog\.md/);
});

test("QUEUE-SUBID-PARENT (AC8): GENERIC rule — a suffixed id with no row of its own passes when its parent has a row, for any parent, and is excluded from alignment", () => {
  // Two unrelated parents prove the rule is not special-cased to one id; the suffixed id's queue row is
  // ticked DONE while the parent is open, which would fail alignment if the suffixed id were compared.
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E7", "open"), trow("E300", "open")),
    "docs/v4.0.0-new-tickets.md": queue(qrow(1, "**E7b** ✅ DONE（merged）"), qrow(2, "**E300q**")),
  });
  const r = run(root);
  assertClean(r);
  assert.doesNotMatch(r.stderr, /E7b|E300q/);
  // ...and without the parent row the same suffixed id is a violation.
  const noParent = mkFixture({
    "docs/backlog.md": backlog(trow("E1", "open")),
    "docs/v4.0.0-new-tickets.md": queue(qrow(1, "**E7b**")),
  });
  assertViolation(run(noParent), /E7b has no row in docs\/backlog\.md/);
});

test("QUEUE-DASH-ROW-SKIPPED (AC8): a queue row whose `#` cell is `—` is an un-ticketed note and is skipped", () => {
  const root = mkFixture({
    "docs/v4.0.0-new-tickets.md": queue(qrow("—", "**E999** note about nothing")),
  });
  const r = run(root);
  assertClean(r);
  assert.doesNotMatch(r.stderr, /E999/);
});

test("QUEUE-TICKED-OPEN (AC9): a queue row ticked ✅ DONE whose backlog row does not lead with DONE/VOID is a violation (PARTIAL counts as open)", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E1", "still open"), trow("E2", "**PARTIAL** (shipped v1.0.0) — half")),
    "docs/v4.0.0-new-tickets.md": queue(qrow(1, "**E1** ✅ DONE（merged）"), qrow(2, "**E2** ✅ DONE（merged）")),
  });
  const r = run(root);
  assertViolation(r, /docs\/v4\.0\.0-new-tickets\.md:3 — E1 is ticked DONE here but docs\/backlog\.md:3 does not lead with a DONE or VOID mark/);
  assert.match(r.stderr, /docs\/v4\.0\.0-new-tickets\.md:4 — E2 is ticked DONE here but docs\/backlog\.md:4 does not lead/);
});

test("QUEUE-UNTICKED-CLOSED (AC9): a queue row not ticked whose backlog row leads with DONE or VOID is a violation naming the mark", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E1", "**DONE** (shipped v1.0.0) — x"), trow("E2", "**VOID** (2026-10-01) — y")),
    "docs/v4.0.0-new-tickets.md": queue(qrow(1, "**E1**"), qrow(2, "**E2**")),
  });
  const r = run(root);
  assertViolation(r, /docs\/v4\.0\.0-new-tickets\.md:3 — E1 is not ticked DONE here but docs\/backlog\.md:3 is marked DONE/);
  assert.match(r.stderr, /docs\/v4\.0\.0-new-tickets\.md:4 — E2 is not ticked DONE here but docs\/backlog\.md:4 is marked VOID/);
});

test("QUEUE-ALIGNED (AC9): aligned rows pass, and only the FIRST id in a merged cell is compared for alignment", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E1", "**DONE** (shipped v1.0.0) — x"), trow("E2", "open"), trow("E3", "open")),
    "docs/v4.0.0-new-tickets.md": queue(
      qrow(1, "**E1** ✅ DONE（merged）"),
      qrow(2, "**E2**"),
      qrow(3, "**E3**（併 E1）"), // merged E1 is closed, but only existence-checked
    ),
  });
  assertClean(run(root));
});

// ============================================================================
// Check (4) — fan-out Decisions rows (AC10).
// ============================================================================

const decision = (date, decider, content, source) => `| ${date} | ${decider} | ${content} | ${source} |\n`;
const runDec = (body) => run(mkFixture({ "specs/fanout-w.md": manifest(body) }));

test("DEC-HEADER (AC10): a Decisions table with the wrong header is a violation quoting the required header", () => {
  const body = "| date | who | what | src |\n|---|---|---|---|\n| 2026-10-14 | 人類 | x | y |\n";
  assertViolation(runDec(body), /specs\/fanout-w\.md:5 — Decisions table header must be "日期 \| 裁決者 \| 內容 \| 出處"/);
});

test("DEC-DATE (AC10): a date cell that is not YYYY-MM-DD is a violation", () => {
  assertViolation(runDec(DEC_HEAD + decision("10/14", "人類", "x", "y")), /decision row: date cell "10\/14" is not YYYY-MM-DD/);
});

test("DEC-DECIDER-EMPTY (AC10): an empty decider cell is a violation", () => {
  assertViolation(runDec(DEC_HEAD + decision("2026-10-14", "", "x", "y")), /decision row: decider cell is empty/);
});

test("DEC-DECIDER-EXECUTOR (AC10): a decider other than 人類 / 整合者 (an executor role) is a violation telling the author to name who decided; both legal values pass", () => {
  assertViolation(
    runDec(DEC_HEAD + decision("2026-10-14", "sr-engineer", "x", "y")),
    /decision row: decider cell "sr-engineer" must name who decided \(人類 or 整合者\); who executed belongs in the content cell/,
  );
  assertClean(runDec(DEC_HEAD + decision("2026-10-14", "人類", "x", "y") + decision("2026-10-15", "整合者", "x", "y")));
});

test("DEC-SOURCE-EMPTY (AC10): an empty or `—` source cell, and an empty content cell, are violations", () => {
  const r = runDec(DEC_HEAD + decision("2026-10-14", "人類", "x", "—") + decision("2026-10-15", "人類", "", "y"));
  assertViolation(r, /decision row: source cell is empty/);
  assert.match(r.stderr, /decision row: content cell is empty/);
});

test("DEC-NO-SECTION-OK (AC10): a manifest without a `## Decisions` heading is skipped silently; so is an untracked manifest", () => {
  const root = mkFixture({ "specs/fanout-old.md": "# old wave\n\n## Plan\n\ntext\n" });
  const r = run(root);
  assertClean(r);
  assert.doesNotMatch(r.stderr + r.stdout, /fanout-old/);
  // untracked manifest with a defective Decisions table: not listed by `git ls-files`, so not checked
  write(root, "specs/fanout-untracked.md", manifest(DEC_HEAD + decision("bad", "x", "", "")));
  assertClean(run(root), "(untracked manifests are silently not checked)");
});

test("DEC-NO-TABLE (AC10): a `## Decisions` heading with no table beneath it is a violation", () => {
  assertViolation(runDec("just prose, no table\n"), /specs\/fanout-w\.md:3 — Decisions section has no table/);
});

// ============================================================================
// Root resolution, exit codes, output (AC13–AC15).
// ============================================================================

test("ROOT-FROM-SCRIPT-LOCATION (AC14): the root is the script's own checkout, not cwd — a `.current/<lane>/` dir present and a foreign cwd change nothing", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E1", "open")),
    ".current/somelane/handoff.md": "not a table\n| a | b |\n| 1 | 2 | 3 |\n",
  });
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "check-bookkeeping-cwd-"));
  const r = run(root, [], elsewhere);
  assertClean(r, "(.current/ is never read; cwd is irrelevant)");
  assert.match(r.stdout, /check:bookkeeping — OK \(1 ticket row\(s\)/);
});

test("EXIT-0-WITH-NOTES (AC15): notes alone exit 0 — notes block on stdout with a count, then the OK line with the three counts", () => {
  const root = mkFixture({
    "docs/backlog.md": backlog(trow("E5", closed("qa_reports/review_T-E5-01.md"))),
    "docs/v4.0.0-new-tickets.md": queue(qrow(1, "**E5** ✅ DONE（merged）")),
    "specs/fanout-w.md": manifest(DEC_HEAD + decision("2026-10-14", "人類", "x", "y")),
    "qa_reports/review_T-E5-01.md": "x",
  });
  const r = run(root);
  assertClean(r);
  assert.match(r.stdout, /check:bookkeeping — \d+ note\(s\) \(non-blocking\):/);
  assert.match(r.stdout, /^ {2}docs\/backlog\.md:3 — /m, "each note line starts with two spaces and <file>:<line> — ");
  assert.match(r.stdout.trimEnd(), /check:bookkeeping — OK \(1 ticket row\(s\), 1 queue row\(s\), 1 decision row\(s\) checked\)$/);
  assert.equal(r.stderr, "");
});

test("EXIT-1 (AC15): violations exit 1 — stderr carries the counted header, two-space `<file>:<line> — ` lines, and a trailing FAILED; stdout has no OK line", () => {
  const root = mkFixture({ "docs/backlog.md": backlog(trow("E1", "a"), trow("E1", "b"), trow("E2", "**DONE** x"), trow("E2", "c")) });
  const r = run(root);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /check:bookkeeping — 2 violation\(s\):/);
  assert.match(r.stderr, /^ {2}docs\/backlog\.md:\d+ — ticket id E[12] appears twice/m);
  assert.match(r.stderr.trimEnd(), /check:bookkeeping — FAILED$/);
  assert.doesNotMatch(r.stdout, /check:bookkeeping — OK/);
});

test("EXIT-2 (AC15): an unreadable required file, or no git, exits 2 with one `cannot run` stderr line", () => {
  const noBacklog = mkFixture({});
  fs.rmSync(path.join(noBacklog, "docs", "backlog.md"));
  let r = run(noBacklog);
  assert.equal(r.status, 2, `stderr: ${r.stderr}`);
  assert.match(r.stderr, /^check:bookkeeping — cannot run: docs\/backlog\.md is unreadable/m);
  assert.equal(r.stderr.trim().split("\n").length, 1, "exactly one stderr line");

  const noQueue = mkFixture({});
  fs.rmSync(path.join(noQueue, "docs", "v4.0.0-new-tickets.md"));
  r = run(noQueue);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /check:bookkeeping — cannot run: docs\/v4\.0\.0-new-tickets\.md is unreadable/);

  // git unavailable for the manifest listing: run with an empty PATH (node is invoked by absolute path)
  const noGit = mkFixture({});
  r = spawnSync(process.execPath, [path.join(noGit, "scripts", "check-bookkeeping.mjs")], {
    cwd: noGit,
    encoding: "utf-8",
    env: { ...process.env, PATH: "" },
  });
  assert.equal(r.status, 2, `stderr: ${r.stderr}`);
  assert.match(r.stderr, /check:bookkeeping — cannot run: git ls-files failed/);
});

test("WIRING (AC13): package.json's check:bookkeeping script invokes scripts/check-bookkeeping.mjs", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
  assert.equal(pkg.scripts["check:bookkeeping"], "node scripts/check-bookkeeping.mjs");
});

test("REAL-CORPUS (AC13/AC16): the real script against this repository exits 0 — no violation; the note count is deliberately not pinned (docs/backlog.md is edited by concurrent lanes)", () => {
  const r = spawnSync(process.execPath, [path.join(PROJECT_ROOT, "scripts", "check-bookkeeping.mjs")], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
  assert.equal(r.status, 0, `real corpus must be bookkeeping-clean; stderr: ${r.stderr}`);
  assert.match(r.stdout, /check:bookkeeping — OK \(/);
});

// ============================================================================
// F4 (optional, reviewer option): predicate parity. check-bookkeeping.mjs reproduces four helpers from
// check-md-tables.mjs so it can be copied into fixture repos; this fails if the copies drift apart.
// Comments and blank lines are stripped before comparing, so only executable text must match.
// ============================================================================

test("PREDICATE-PARITY (F4): splitRow / findCodeSpanRanges / findCitationQuoteRanges / findGenuineDoneMark and their two regex constants are identical in both scripts", () => {
  const other = fs.readFileSync(path.join(PROJECT_ROOT, "scripts", "check-md-tables.mjs"), "utf-8");
  const norm = (s) =>
    s
      .split("\n")
      .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s+\/\/\s.*$/, "").replace(/\s+$/, ""))
      .filter((l) => l.trim() !== "")
      .join("\n");
  const fn = (src, name) => {
    const m = new RegExp(`^function ${name}\\([^]*?\\n\\}\\n`, "m").exec(src);
    assert.ok(m, `function ${name} not found`);
    return norm(m[0]);
  };
  const konst = (src, name) => {
    const m = new RegExp(`^const ${name} = .*;$`, "m").exec(src);
    assert.ok(m, `const ${name} not found`);
    return m[0];
  };
  for (const name of ["splitRow", "findCodeSpanRanges", "findCitationQuoteRanges", "findGenuineDoneMark"]) {
    assert.equal(fn(SCRIPT_SRC, name), fn(other, name), `${name} drifted between check-bookkeeping.mjs and check-md-tables.mjs`);
  }
  for (const name of ["DONE_MARK_OPEN_RE", "MARK_STAMP_RE"]) {
    assert.equal(konst(SCRIPT_SRC, name), konst(other, name), `${name} drifted`);
  }
});
