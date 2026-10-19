// Coded by @qa-engineer
// Tests (T-E292-02) for specs/e292-sister-repos.md AC-E292-4..6: the optional `## 外部依賴` manifest section is
// checked by `validate` only. A well-formed section must not move one byte of validate's output (a manifest that
// records a dependency is still a valid manifest); each defect must surface as exactly its own code (an integrator
// fixes what the code names); and a malformed section must be invisible to render, check, check --cut, owners and
// handoff generate, because the section is read by `validate` and `handoff --check` only. Fixtures are in-test
// manifests under os.tmpdir(); nothing reads the committed specs/fanout-*.md.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { readExternalDeps, validateManifest, EXTERNAL_DEPS_CODES } from "../dist/tools/fanout-manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e292-ext-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const OPEN_STATUS = "**狀態：人類核准 2026-10-13。**";
const CLOSED_STATUS = "**狀態：已結案 2026-10-17。**";
const HEADER = "| repo | 票 | branch | sha | 協定出處 |";
const SEP = "|---|---|---|---|---|";
const ROW = "| receiver | E1 | feat/x | abc1234 | README.md §3 |";
const SECTION = ["## 外部依賴", HEADER, SEP, ROW, ""].join("\n");

/** An in-test manifest (lanes a, b). Closed ones carry a valid, filled `## 接手步驟`. */
function manifest({ closed = false, tail = "" } = {}) {
  const lines = [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    "mailbox: ../lanes/_mailbox",
    "",
    closed ? CLOSED_STATUS : OPEN_STATUS,
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    ...["a", "b"].map((l, i) => `| ${l} | E${i + 1} | feat/${l} | ../lanes/${l} | \`tools/${l}.ts\` | \`docs/**\` | 做：x。　不做：y | 無 |`),
    "",
    "## Dispatch pins",
    ...["a", "b"].map((l) => `- ${l}：\`sr-engineer=opus\`。`),
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    "| 2026-10-13 | 人類 | 開波 | s |",
    "",
  ];
  if (closed) {
    lines.push(
      "## 接手步驟",
      "（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）",
      "### 核對 primary",
      "- 目標分支：main @ abc1234",
      "- 目標分支對 origin：一致",
      "- git status：乾淨",
      "- worktree：primary（main）",
      "- lane-status：primary（main）wave-fx／PASS／qa-engineer，hop 7，commits 0，clean",
      "### 已結案",
      "- 本波次已結案。",
      "### 待人類決定",
      "- 無",
      "### 進行中的背景工作",
      "無",
      "",
    );
  }
  return lines.join("\n") + tail;
}

let n = 0;
const write = (text, name = "m") => {
  const dir = path.join(TMP, `d${n++}`);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${name}.md`);
  fs.writeFileSync(f, text);
  return f;
};
function cli(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const validate = (text) => cli(["validate", write(text)]);
const errCodes = (r) => [...r.stderr.matchAll(/fanout: error: ([A-Z_]+):/g)].map((m) => m[1]);

// --- AC-E292-4 ------------------------------------------------------------------------------------------------

for (const closed of [false, true]) {
  test(`AC-E292-4 a well-formed section leaves validate output byte-identical (${closed ? "closed" : "open"} manifest)`, () => {
    // WHY: recording a dependency must not change how a valid manifest validates.
    const without = validate(manifest({ closed }));
    assert.equal(without.status, 0, without.stderr);
    for (const section of [
      SECTION,
      ["## 外部依賴（本波）", HEADER, SEP, ROW, "| `receiver` | E2 | `feat/y` | `" + "a".repeat(40) + "` | docs |", ""].join("\n"),
      // prose before the table and after it
      ["## 外部依賴", "對方的契約：", "", HEADER, SEP, ROW, "", "備註。", ""].join("\n"),
    ]) {
      const withSection = validate(manifest({ closed, tail: "\n" + section }));
      assert.equal(withSection.status, 0, withSection.stderr);
      assert.equal(withSection.stdout, without.stdout);
      assert.equal(withSection.stderr, without.stderr);
    }
  });
}

test("AC-E292-4 the section may precede other sections", () => {
  const text = manifest().replace("## Dispatch pins", SECTION + "\n## Dispatch pins");
  const r = validate(text);
  assert.equal(r.status, 0, r.stderr);
});

// --- AC-E292-5 ------------------------------------------------------------------------------------------------

const withSection = (section, opts) => manifest({ ...opts, tail: "\n" + section });
const row = (...cells) => `| ${cells.join(" | ")} |`;
const table = (...rows) => ["## 外部依賴", HEADER, SEP, ...rows, ""].join("\n");

const DEFECTS = [
  ["two sections", [SECTION, SECTION].join("\n"), ["EXTERNAL_DEPS_SECTION_DUPLICATE"]],
  ["two sections, qualified heading", [SECTION, SECTION.replace("## 外部依賴", "## 外部依賴(b)")].join("\n"), ["EXTERNAL_DEPS_SECTION_DUPLICATE"]],
  ["no table", "## 外部依賴\n只有文字。\n", ["EXTERNAL_DEPS_TABLE_ABSENT"]],
  ["header and no data row", ["## 外部依賴", HEADER, SEP, ""].join("\n"), ["EXTERNAL_DEPS_TABLE_ABSENT"]],
  ["header order", ["## 外部依賴", "| 票 | repo | branch | sha | 協定出處 |", SEP, ROW, ""].join("\n"), ["EXTERNAL_DEPS_HEADER_DIFFERS"]],
  ["header spelling", ["## 外部依賴", "| repo | 票 | branch | SHA | 協定出處 |", SEP, ROW, ""].join("\n"), ["EXTERNAL_DEPS_HEADER_DIFFERS"]],
  ["header column count", ["## 外部依賴", "| repo | 票 | branch | sha |", "|---|---|---|---|", "| a | b | c | abc1234 |", ""].join("\n"), ["EXTERNAL_DEPS_HEADER_DIFFERS"]],
  ["row with 4 cells", table(row("receiver", "E1", "feat/x", "abc1234")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["row with 6 cells", table(row("receiver", "E1", "feat/x", "abc1234", "R", "extra")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["invalid repo (slash)", table(row("a/b", "E1", "feat/x", "abc1234", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["invalid repo (..)", table(row("..", "E1", "feat/x", "abc1234", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["invalid repo (empty)", table(row("", "E1", "feat/x", "abc1234", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["empty 票", table(row("receiver", "", "feat/x", "abc1234", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["empty branch", table(row("receiver", "E1", "", "abc1234", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["branch with space", table(row("receiver", "E1", "feat x", "abc1234", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["branch starting with -", table(row("receiver", "E1", "-x", "abc1234", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["sha too short", table(row("receiver", "E1", "feat/x", "abc123", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["sha too long", table(row("receiver", "E1", "feat/x", "a".repeat(41), "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["sha uppercase", table(row("receiver", "E1", "feat/x", "ABCDEF1", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["sha not hex", table(row("receiver", "E1", "feat/x", "abcdefg", "R")), ["EXTERNAL_DEPS_ROW_INVALID"]],
  ["empty 協定出處", table(row("receiver", "E1", "feat/x", "abc1234", "")), ["EXTERNAL_DEPS_ROW_INVALID"]],
];
for (const closed of [false, true]) {
  for (const [name, section, expected] of DEFECTS) {
    test(`AC-E292-5 ${name} -> ${expected[0]} (${closed ? "closed" : "open"})`, () => {
      const r = validate(withSection(section, { closed }));
      assert.equal(r.status, 2, r.stderr);
      assert.deepEqual([...new Set(errCodes(r))], expected, "exactly the listed code, nothing else");
    });
  }
}

test("AC-E292-5 one EXTERNAL_DEPS_ROW_INVALID per bad row, good rows stay silent", () => {
  const r = validate(
    withSection(table(row("receiver", "E1", "feat/x", "abc1234", "R"), row("a/b", "E1", "f", "abc1234", "R"), row("receiver", "", "f", "abc1234", "R"), row("r", "E", "f", "zz", "R")), {}),
  );
  assert.equal(r.status, 2);
  assert.deepEqual(errCodes(r), ["EXTERNAL_DEPS_ROW_INVALID", "EXTERNAL_DEPS_ROW_INVALID", "EXTERNAL_DEPS_ROW_INVALID"]);
  assert.match(r.stderr, /row 2 \(line \d+\): repo "a\/b" is not a name of \[A-Za-z0-9_\.-\]/);
  assert.match(r.stderr, /row 3 \(line \d+\): 票 is empty/);
  assert.match(r.stderr, /row 4 \(line \d+\): sha "zz" is not 7–40 lowercase hex/);
  assert.ok(!/row 1 /.test(r.stderr));
});

test("AC-E292-5 error messages follow the spec copy", () => {
  const dup = validate(withSection([SECTION, SECTION].join("\n"), {})).stderr;
  assert.match(dup, /EXTERNAL_DEPS_SECTION_DUPLICATE: 2 "## 外部依賴" sections found \(lines \d+, \d+\); exactly one is allowed/);
  assert.match(validate(withSection("## 外部依賴\ntext\n", {})).stderr, /EXTERNAL_DEPS_TABLE_ABSENT: section "## 外部依賴" \(line \d+\) has no table with a data row/);
  assert.match(
    validate(withSection(["## 外部依賴", "| a | b |", "|---|---|", "| 1 | 2 |", ""].join("\n"), {})).stderr,
    /EXTERNAL_DEPS_HEADER_DIFFERS: section "## 外部依賴" line \d+: header is "a \| b", expected exactly "repo \| 票 \| branch \| sha \| 協定出處"/,
  );
  assert.match(validate(withSection(table(row("r", "E", "f x", "abc1234", "R")), {})).stderr, /branch "f x" is not a single ref name/);
  assert.match(validate(withSection(table(row("r", "E", "f", "abc1234", "")), {})).stderr, /協定出處 is empty/);
  assert.match(validate(withSection(table("| r | E | f |"), {})).stderr, /外部依賴 row 1 \(line \d+\): 3 cell\(s\), expected 5/);
});

test("AC-E292-5 no 外部依賴 heading, never any of the four codes, whatever the prose says", () => {
  const prose = [
    "## 備註",
    "外部依賴 在這一波沒有。 ## 外部依賴 only inside text, 外部依賴 | repo | 票 | branch | sha | 協定出處 |",
    "### 外部依賴（子標題）",
    "",
  ].join("\n");
  const r = validate(manifest({ tail: "\n" + prose }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(errCodes(r), []);
  assert.deepEqual(Object.values(EXTERNAL_DEPS_CODES).filter((c) => r.stderr.includes(c)), []);
  assert.equal(readExternalDeps(manifest({ tail: "\n" + prose })).present, false);
});

test("AC-E292-5 reader contract: no section => no rows, no errors; rows strip one backtick pair", () => {
  assert.deepEqual(readExternalDeps(manifest()), { present: false, rows: [], errors: [] });
  const r = readExternalDeps(manifest({ tail: "\n" + table(row("`receiver`", "E1", "`feat/x`", "`abc1234`", "README.md §3")) }));
  assert.equal(r.present, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.rows.map(({ repo, ticket, branch, sha, source, row: i }) => ({ repo, ticket, branch, sha, source, i })),
    [{ repo: "receiver", ticket: "E1", branch: "feat/x", sha: "abc1234", source: "README.md §3", i: 1 }],
  );
  // validateManifest appends the section errors after the base ones
  const bad = validateManifest(manifest({ tail: "\n" + table(row("a/b", "E", "f", "abc1234", "R")) }));
  assert.deepEqual(bad.errors.map((e) => e.code), ["EXTERNAL_DEPS_ROW_INVALID"]);
});

// --- AC-E292-6 ------------------------------------------------------------------------------------------------

function git(cwd, ...args) {
  return execFileSync("git", ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** A primary repo with lane `a` worktree so render / check / owners / handoff have real input. */
function wave(name) {
  const root = path.join(TMP, name);
  const primary = path.join(root, "primary");
  fs.mkdirSync(path.join(primary, "specs"), { recursive: true });
  git(root, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(primary, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(primary, ".gitignore"), ".current/\n");
  fs.writeFileSync(path.join(primary, "specs", "fx.md"), "x\n");
  git(primary, "add", "-A");
  git(primary, "commit", "-q", "-m", "base");
  git(primary, "remote", "add", "origin", path.join(root, "origin.git"));
  git(primary, "push", "-q", "origin", "main");
  const base = git(primary, "rev-parse", "HEAD");
  const wt = path.join(root, "lanes", "a");
  git(primary, "worktree", "add", "-q", "-b", "feat/a", wt);
  fs.mkdirSync(path.join(wt, "tools"), { recursive: true });
  fs.writeFileSync(path.join(wt, "tools", "a.ts"), "a\n");
  git(wt, "add", "-A");
  git(wt, "commit", "-q", "-m", "lane a");
  return { root, primary, base };
}
const CUT_SPEC = [
  "# spec",
  "## Cut",
  "| id | desc | depends_on | est. files | touches | design-link |",
  "|---|---|---|---|---|---|",
  "| T-1 | do it | none | 1 | `tools/a.ts` | — |",
  "",
].join("\n");

test("AC-E292-6 a malformed section is invisible to render, check, check --cut, owners and handoff generate", () => {
  // WHY: parseManifest / Manifest.errors are unchanged by the section; only validate and handoff --check read it.
  const w = wave("inv");
  const mkManifest = (extra) => manifest({ tail: extra }).replace("base: abc1234", `base: ${w.base}`);
  const clean = mkManifest("");
  const malformedSections = [
    "\n" + [SECTION, SECTION].join("\n"),
    "\n## 外部依賴\n沒有表。\n",
    "\n" + table(row("a/b", "", "bad branch", "zz", "")),
    "\n" + ["## 外部依賴", "| x | y |", "|---|---|", "| 1 | 2 |", ""].join("\n"),
  ];
  const specFile = write(CUT_SPEC, "spec");
  const pathsFile = write("tools/a.ts\ntools/b.ts\n", "paths");
  const commands = (m) => [
    ["render", m, "a", "--summary", "S", "--reading", "R1", "--primary", w.primary, "--mailbox-root", "/m"],
    ["check", m, "a", "--base", "main", "--repo", w.primary],
    ["check", "--cut", m, "a", specFile],
    ["owners", m, "--paths", pathsFile],
    ["handoff", m, "--repo", w.primary, "--mailbox-root", path.join(w.root, "_mb")],
  ];
  const cleanFile = write(clean, "clean");
  const expected = commands(cleanFile).map((a) => cli(a, w.primary));
  // the baseline must exercise real behaviour: a hard failure everywhere would make equality vacuous
  assert.equal(expected[2].status, 0, `check --cut baseline: ${expected[2].stderr}`);
  assert.ok(expected[3].status === 1 && expected[3].stdout.includes("HIT  tools/a.ts"), "owners baseline: hits exit 1, by design");
  assert.equal(expected[4].status, 0, `handoff baseline: ${expected[4].stderr}`);
  assert.equal(expected[0].status, 0, `render baseline: ${expected[0].stderr}`);
  for (const section of malformedSections) {
    const f = write(mkManifest(section), "bad");
    const got = commands(f).map((a) => cli(a, w.primary));
    got.forEach((g, i) => {
      assert.equal(g.status, expected[i].status, `exit of ${commands(f)[i][0]}`);
      // handoff / render output names no manifest path, so stdout/stderr compare directly
      assert.equal(g.stdout, expected[i].stdout, `stdout of ${commands(f)[i].slice(0, 2).join(" ")}`);
      assert.equal(g.stderr, expected[i].stderr, `stderr of ${commands(f)[i].slice(0, 2).join(" ")}`);
    });
  }
});

test("AC-E292-6 check --cut with a malformed section names no EXTERNAL_DEPS code", () => {
  // WHY: reviewer asked for explicit coverage — the cut-check input is the manifest's lane row, not this section.
  const w = wave("cut");
  const bad = manifest({ tail: "\n## 外部依賴\n沒有表。\n" }).replace("base: abc1234", `base: ${w.base}`);
  const r = cli(["check", "--cut", write(bad), "a", write(CUT_SPEC, "spec")], w.primary);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes("EXTERNAL_DEPS") && !r.stderr.includes("EXTERNAL_DEPS"));
});
