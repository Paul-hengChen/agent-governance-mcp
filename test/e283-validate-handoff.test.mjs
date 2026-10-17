// Coded by @qa-engineer
// Tests (T-E283-01) for specs/e283-fanout-handoff-and-ref-check.md AC-E283-1..10 and the structural form of the
// hard condition AC-E283-11: `fanout.mjs validate` requires a `## 接手步驟` section once a manifest is closed
// (status text after `狀態：` starts with `已結案`), and only then; the handoff checks are validate-only.
// All fixtures are in-test manifests under os.tmpdir(). The committed specs/fanout-*.md are read only for an
// invariant that stays stable as manifests are added (no non-closed manifest gets a handoff-scope error).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e283-qa-"));
let seq = 0;

function cli(args) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function tmpFile(name, text) {
  const p = path.join(TMP, `${seq++}-${name}`);
  fs.writeFileSync(p, text);
  return p;
}
const errCodes = (r) =>
  r.stderr
    .split("\n")
    .filter((l) => l.startsWith("fanout: error:"))
    .map((l) => l.split(":")[2].trim());
const errLines = (r, code) => r.stderr.split("\n").filter((l) => l.startsWith(`fanout: error: ${code}:`));

const CLOSED = "**狀態：已結案 2026-10-17。**";
const DECISIONS_OK = ["| 2026-10-13 | 人類 | 開波 | s |"];

/** A valid manifest; `status` is the status line (or null), `tail` is appended after Decisions. */
function manifest({ status = CLOSED, tail = "", decisions = DECISIONS_OK } = {}) {
  return [
    "# Fan-out: fixture",
    "base: abc1234    integration branch: integ/fx",
    "mailbox: ../lanes/_mailbox",
    "",
    ...(status === null ? [] : [status, ""]),
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    "| a | E1 | feat/a | ../lanes/a | `tools/a.ts` | `docs/**` | 做：x。　不做：y | 無 |",
    "",
    "## Dispatch pins",
    "- a：`sr-engineer=opus`。",
    "",
    "## Decisions",
    "| 日期 | 裁決者 | 內容 | 出處 |",
    "|---|---|---|---|",
    ...decisions,
    "",
    tail,
    "",
  ].join("\n");
}

const MANDATORY = ["核對 primary", "已結案", "待人類決定", "進行中的背景工作"];
/** Build a `## 接手步驟` section. `bodies` maps sub-item name -> body text (undefined omits the item). */
function section({ heading = "## 接手步驟", bodies = {}, extra = "" } = {}) {
  const b = { "核對 primary": "git status 乾淨", 已結案: "e283", 待人類決定: "無", 進行中的背景工作: "無", ...bodies };
  const parts = [heading, ""];
  for (const name of MANDATORY) {
    if (b[name] === undefined) continue;
    parts.push(`### ${name}`, b[name], "");
  }
  if (extra) parts.push(extra, "");
  return parts.join("\n");
}
const validate = (text) => cli(["validate", tmpFile("m.md", text)]);
const closedWith = (sec, opts = {}) => validate(manifest({ tail: sec, ...opts }));

test("fixture sanity: a not-closed manifest validates", () => {
  // WHY: every case below is judged against this; a red baseline would fake passes.
  const r = validate(manifest({ status: "**狀態：人類核准 2026-10-13。**" }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^fanout: ok — /);
});

test("AC-E283-1 closed without section", () => {
  const r = validate(manifest());
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes("fanout: error: HANDOFF_SECTION_ABSENT:"), r.stderr);
});

test("AC-E283-2 closed with complete section", () => {
  const plain = closedWith(section());
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /^fanout: ok — 1 dispatchable lane\(s\), 0 provisional, 1 decision\(s\)/);
  // heading suffix and sub-item suffix accepted
  const suffixed = closedWith(
    section({ heading: "## 接手步驟（換 session 用）" }).replace("### 已結案", "### 已結案（本波）"),
  );
  assert.equal(suffixed.status, 0, suffixed.stderr);
  const ascii = closedWith(section({ heading: "## 接手步驟(換 session 用)" }));
  assert.equal(ascii.status, 0, ascii.stderr);
  // alternative closed spellings
  for (const st of ["**狀態**：已結案 2026-10-17。", "**狀態:已結案 2026-10-17**", "狀態： 已結案"]) {
    const r = validate(manifest({ status: st, tail: section() }));
    assert.equal(r.status, 0, `${st}: ${r.stderr}`);
    const missing = validate(manifest({ status: st }));
    assert.ok(errCodes(missing).includes("HANDOFF_SECTION_ABSENT"), `${st} must count as closed`);
  }
});

test("AC-E283-3 sub-item absent / duplicate / empty", () => {
  for (const name of MANDATORY) {
    const absent = closedWith(section({ bodies: { [name]: undefined } }));
    assert.equal(absent.status, 2, name);
    const l = errLines(absent, "HANDOFF_SUBITEM_ABSENT");
    assert.ok(l.length >= 1 && l.some((x) => x.includes(name)), `absent ${name}: ${absent.stderr}`);

    const dup = closedWith(section({ extra: `### ${name}\n再一次` }));
    assert.equal(dup.status, 2, name);
    assert.ok(errLines(dup, "HANDOFF_SUBITEM_DUPLICATE").some((x) => x.includes(name)), `dup ${name}: ${dup.stderr}`);

    const empty = closedWith(section({ bodies: { [name]: "\n   \n" } }));
    assert.equal(empty.status, 2, name);
    assert.ok(errLines(empty, "HANDOFF_SUBITEM_EMPTY").some((x) => x.includes(name)), `empty ${name}: ${empty.stderr}`);
  }
});

test("AC-E283-4 background must be 無", () => {
  for (const ok of ["無", "- 無", "* 無", "無。"]) {
    const r = closedWith(section({ bodies: { 進行中的背景工作: ok } }));
    assert.equal(r.status, 0, `${JSON.stringify(ok)}: ${r.stderr}`);
  }
  for (const bad of ["監看 e283 信箱", "無\n- 整合分支未刪", "none"]) {
    const r = closedWith(section({ bodies: { 進行中的背景工作: bad } }));
    assert.equal(r.status, 2, JSON.stringify(bad));
    assert.ok(errCodes(r).includes("HANDOFF_BACKGROUND_NOT_NONE"), `${JSON.stringify(bad)}: ${r.stderr}`);
  }
});

test("AC-E283-5 absolute path", () => {
  const hits = ["/Users/x/repo", "/home/user/b", "`/tmp/x/y`", "（/private/var/z）", "C:\\work\\x", "~/lanes/e283"];
  for (const h of hits) {
    const r = closedWith(section({ bodies: { "核對 primary": `在 ${h} 底下` } }));
    assert.equal(r.status, 2, h);
    const l = errLines(r, "HANDOFF_ABSOLUTE_PATH");
    assert.equal(l.length, 1, `${h}: exactly one per offending line: ${r.stderr}`);
    assert.match(l[0], /line \d+/, "names the line number");
    const needle = h.replace(/[`（）]/g, "");
    assert.ok(!r.stderr.includes(needle), `stderr must not echo the path ${needle}`);
  }
  // one error per offending line, not per path occurrence
  const two = closedWith(section({ bodies: { "核對 primary": "`/a/b` 與 `/c/d`\n另一行 /x/y/z" } }));
  assert.equal(errLines(two, "HANDOFF_ABSOLUTE_PATH").length, 2);
  // heading lines are scanned too
  const head = closedWith(section({ extra: "### 備註 /Users/x/y" }));
  assert.ok(errCodes(head).includes("HANDOFF_ABSOLUTE_PATH"));
  // relative / non-path forms are not hits
  for (const ok of ["../lanes/e283", ".current/history/x", "origin/main", "/teamwork", "https://github.com/a/b"]) {
    const r = closedWith(section({ bodies: { "核對 primary": `見 ${ok}` } }));
    assert.ok(!errCodes(r).includes("HANDOFF_ABSOLUTE_PATH"), `${ok}: ${r.stderr}`);
    assert.equal(r.status, 0, `${ok}: ${r.stderr}`);
  }
});

test("AC-E283-6 optional and unknown sub-items", () => {
  const extra = "### 裝置\n本機\n\n### 工具\ngit\n\n### 備註\n隨便";
  assert.equal(closedWith(section({ extra })).status, 0);
  assert.equal(closedWith(section({ extra: "### 備註\n隨便" })).status, 0);
  assert.equal(closedWith(section()).status, 0);
});

test("AC-E283-7 duplicate section", () => {
  const r = closedWith(section() + "\n" + section({ heading: "## 接手步驟（第二份）" }));
  assert.equal(r.status, 2);
  assert.ok(errCodes(r).includes("HANDOFF_SECTION_DUPLICATE"), r.stderr);
});

test("AC-E283-8 not closed is not checked", () => {
  // WHY: the exemption is by construction (no allowlist): only `已結案` at the start of the status text arms the check.
  const statuses = [
    "**狀態：結案 2026-10-15。**",
    "**狀態：已合併（PR #1）。**",
    "**狀態：人類核准 2026-10-07；已結案 2026-10-08**",
    "**狀態：人類核准 2026-10-07**",
    null,
  ];
  const badSections = ["", section({ bodies: { 進行中的背景工作: "還有" } }), section({ bodies: { "核對 primary": "/Users/x/y" } }), section({ bodies: { 已結案: undefined } })];
  for (const st of statuses) {
    const baseline = validate(manifest({ status: st }));
    assert.equal(baseline.status, 0, `${st}: ${baseline.stderr}`);
    for (const sec of badSections) {
      const r = validate(manifest({ status: st, tail: sec }));
      assert.equal(r.status, baseline.status, `${st}`);
      assert.deepEqual(errCodes(r), errCodes(baseline));
      assert.ok(!r.stderr.includes("HANDOFF_"), `${st}: ${r.stderr}`);
    }
  }
});

test("AC-E283-8 status line is only read before the first ## heading", () => {
  // WHY: a `狀態：已結案` line inside a later section must not arm the check.
  const text = manifest({ status: null, tail: "## 備註\n**狀態：已結案 2026-10-17。**\n" });
  const r = validate(text);
  assert.equal(r.status, 0, r.stderr);
});

test("AC-E283-9 validate-only", () => {
  const bad = section({ bodies: { 進行中的背景工作: "還有", "核對 primary": "/Users/x/y" } });
  const closedBad = manifest({ tail: bad });
  const open = manifest({ status: "**狀態：人類核准 2026-10-13。**", tail: bad });
  const specFile = tmpFile(
    "spec.md",
    "# x\n\n## Cut\n\n| id | desc | depends_on | est. files | touches | design-link |\n|---|---|---|---|---|---|\n| T-X-01 | x | none | 1 | `tools/a.ts` | — |\n",
  );
  const pathsFile = tmpFile("paths.txt", "tools/a.ts\nREADME.md\n");
  const mk = (t) => tmpFile("m.md", t);
  const c = mk(closedBad);
  const o = mk(open);
  const runs = (m) => [
    cli(["render", m, "a", "--summary", "s", "--reading", "r"]),
    cli(["check", m, "a", "--repo", ROOT]),
    cli(["check", "--cut", m, "a", specFile]),
    cli(["owners", m, "--paths", pathsFile]),
  ];
  const rc = runs(c);
  const ro = runs(o);
  for (let i = 0; i < rc.length; i++) {
    assert.equal(rc[i].status, ro[i].status, `cmd ${i}`);
    assert.ok(!rc[i].stderr.includes("HANDOFF_"), `cmd ${i}: ${rc[i].stderr}`);
    assert.ok(!rc[i].stdout.includes("HANDOFF_"));
  }
  // and validate does fire on the closed one
  assert.equal(cli(["validate", c]).status, 2);
  assert.equal(cli(["validate", o]).status, 0);
});

test("AC-E283-10 reported with other errors", () => {
  const r = validate(manifest({ decisions: ["| 13 Oct | 人類 | 開波 | s |"] }));
  assert.equal(r.status, 2);
  const codes = errCodes(r);
  assert.ok(codes.includes("HANDOFF_SECTION_ABSENT"), r.stderr);
  assert.ok(codes.some((c) => c !== "HANDOFF_SECTION_ABSENT"), `a decisions error is also reported: ${r.stderr}`);
});

test("AC-E283-11 (invariant) no committed manifest that is not closed gets a handoff error", () => {
  // WHY: the exemption-by-construction guarantee. Stated as an invariant over whatever manifests exist (not a pinned
  // list or base sha): any manifest whose status text does not start with 已結案 must never see a HANDOFF_* code.
  const dir = path.join(ROOT, "specs");
  const files = fs.readdirSync(dir).filter((f) => /^fanout-.*\.md$/.test(f));
  assert.ok(files.length > 0);
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const head = text.split(/^## /m)[0].split("\n");
    const status = head.map((l) => l.replace(/\*\*/g, "")).find((l) => /^狀態[：:]/.test(l));
    const closed = status !== undefined && /^狀態[：:]\s*已結案/.test(status);
    const r = cli(["validate", path.join(dir, f)]);
    if (!closed) assert.ok(!r.stderr.includes("HANDOFF_"), `${f}: ${r.stderr}`);
  }
});
