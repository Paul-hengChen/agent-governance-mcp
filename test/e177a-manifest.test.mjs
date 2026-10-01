// Coded by @qa-engineer
// Tests (T-E177A-06) for the parse/validate/render side of tools/fanout-manifest.ts (specs/e177a-fanout-manifest.md, AC1-AC8, AC13, AC14);
// test/e177a-check-cli.test.mjs covers checkLane, the CLI exit contract and the full-suite run (AC16). Fixtures under test/fixtures/e177a/ are byte copies of the tracked
// fanout specs at base 98052c6 (edit the copies, never specs/fanout-*.md) plus an exact-string render golden for AC6; every other manifest is synthetic and built inline.
// Rationale: specs/e260f-comment-rationale.md (test/e177a-manifest.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  parseManifest,
  validateManifest,
  renderPrompt,
  runValidate,
  runRender,
  resolvePrimary,
} from "../dist/tools/fanout-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const F = path.join(ROOT, "test", "fixtures", "e177a");

function fixture(name) {
  return fs.readFileSync(path.join(F, name), "utf8");
}

// ---------------------------------------------------------------------------
// Synthetic manifest builders — a minimal, always-valid Lanes/pins/Decisions
// skeleton, overridable field by field so each test isolates one violation.
// ---------------------------------------------------------------------------

/** One valid dispatchable row (lane e1) unless overridden. */
const VALID_ROW =
  "| e1 | T1 | feat/e1-x | /tmp/e1 | `src/a.ts` | `other/**` | 做：a　不做：b | 無 |";

function manifestText({
  title = "# Fan-out: Test Plan",
  baseLine = "base: 1234567",
  lanesHeader = "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  lanesRows = [VALID_ROW],
  noLanesSection = false,
  pinsBullets = ["- e1：`sr-engineer=fable`"],
  decisionsHeader = "| 日期 | 裁決者 | 內容 | 出處 |",
  decisionsRows = [],
  extraDecisionsSection = false,
} = {}) {
  const parts = [title, baseLine, ""];
  if (!noLanesSection) {
    parts.push("## Lanes", lanesHeader, "|---|---|---|---|---|---|---|---|", ...lanesRows, "");
  }
  parts.push("## Dispatch pins", ...pinsBullets, "");
  parts.push("## Decisions", decisionsHeader, "|---|---|---|---|", ...decisionsRows, "");
  if (extraDecisionsSection) {
    parts.push("## Decisions", "| 日期 | 裁決者 | 內容 | 出處 |", "|---|---|---|---|", "");
  }
  return parts.join("\n");
}

function codesOf(text) {
  return validateManifest(text).errors.map((e) => e.code);
}

// ---------------------------------------------------------------------------
// AC1 — a real wave manifest parses into its title, base and lane fields
// ---------------------------------------------------------------------------

test("AC1 wave7 parses", () => {
  const m = parseManifest(fixture("fanout-wave7.md"));
  assert.deepEqual(m.errors, []);
  assert.equal(m.title, "v4.0.0 Wave 7（翻開關）");
  assert.equal(m.base, "3f648bd");
  assert.deepEqual(
    m.dispatchable.map((d) => d.lane),
    ["e204", "e180", "e177a", "e177b"],
  );
  assert.deepEqual(
    m.provisional.map((p) => p.lane),
    ["e130", "e178"],
  );
  const e177a = m.dispatchable.find((d) => d.lane === "e177a");
  for (const tok of [
    "tools/fanout-manifest.ts",
    "scripts/fanout.mjs",
    "dist/**",
    "test/e177a-*.test.mjs",
    "test/fixtures/e177a/**",
    ".current/e177a/",
  ]) {
    assert.ok(e177a.ownedTokens.includes(tok), `owned tokens missing ${tok}`);
  }
  const e180 = m.dispatchable.find((d) => d.lane === "e180");
  assert.ok(!e180.ownedTokens.includes("closedLanePointerLine"), "closedLanePointerLine must be excluded as prose");
  assert.ok(!e180.ownedTokens.includes(":1727"), ":1727 must be excluded as prose");
});

// ---------------------------------------------------------------------------
// AC2 — validating a real wave manifest reports no errors
// ---------------------------------------------------------------------------

test("AC2 validate wave7 exit 0", () => {
  const r = runValidate([path.join(F, "fanout-wave7.md")]);
  assert.equal(r.exitCode, 0);
  assert.equal(r.stdout, "fanout: ok — 4 dispatchable lane(s), 2 provisional, 5 decision(s)\n");
  assert.equal(r.stderr, "");
});

// ---------------------------------------------------------------------------
// AC3 — rendering a provisional (not yet dispatchable) lane is refused
// ---------------------------------------------------------------------------

test("AC3 provisional lane refused", () => {
  const file = path.join(F, "fanout-wave7.md");
  const render = runRender([file, "e130", "--summary", "S", "--reading", "R", "--mailbox-root", "/m", "--primary", "/p"]);
  assert.equal(render.exitCode, 2);
  assert.equal(render.stdout, "");
  assert.match(render.stderr, /LANE_PROVISIONAL/);
  assert.match(render.stderr, /## Lanes（7\.2，序列，暫定 —— 派工前重新核對）/);
  for (const col of ["worktree", "擁有", "禁止", "範圍切線"]) {
    assert.ok(render.stderr.includes(col), `missing column name ${col}`);
  }
});

// ---------------------------------------------------------------------------
// AC4 — older manifests lacking the decisions/pins sections fail loudly
// ---------------------------------------------------------------------------

test("AC4 legacy manifests fail loudly", () => {
  const wave6 = validateManifest(fixture("fanout-wave6.md"));
  const wave51 = validateManifest(fixture("fanout-wave5.1.md"));

  const w6err = wave6.errors.find((e) => e.code === "DECISIONS_SECTION_ABSENT");
  assert.ok(w6err, "wave6 must report DECISIONS_SECTION_ABSENT");
  assert.match(w6err.message, /## 人類裁決/, "wave6 hint must name the legacy heading");

  const w51err = wave51.errors.find((e) => e.code === "DECISIONS_SECTION_ABSENT");
  assert.ok(w51err, "wave5.1 must report DECISIONS_SECTION_ABSENT");

  // render on e125a (wave6) / e179 (wave5.1) with every CLI flag supplied
  // exits 2 with PINS_SECTION_ABSENT and prints no prompt.
  const flags = ["--summary", "S", "--reading", "R", "--mailbox-root", "/m", "--primary", "/p", "--base", "98052c6"];
  const r6 = runRender([path.join(F, "fanout-wave6.md"), "e125a", ...flags]);
  assert.equal(r6.exitCode, 2);
  assert.equal(r6.stdout, "");
  assert.match(r6.stderr, /PINS_SECTION_ABSENT/);

  const r51 = runRender([path.join(F, "fanout-wave5.1.md"), "e179", ...flags]);
  assert.equal(r51.exitCode, 2);
  assert.equal(r51.stdout, "");
  assert.match(r51.stderr, /PINS_SECTION_ABSENT/);
});

// ---------------------------------------------------------------------------
// AC5 — malformed manifests report specific error codes
// ---------------------------------------------------------------------------

test("AC5 malformed manifests", () => {
  // LANES_HEADER_UNKNOWN — first header cell is not "lane"
  assert.ok(
    codesOf(manifestText({ lanesHeader: "| 區 | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |" })).includes(
      "LANES_HEADER_UNKNOWN",
    ),
  );

  // LANE_DUPLICATE — same lane id twice
  assert.ok(
    codesOf(
      manifestText({
        lanesRows: [
          VALID_ROW,
          "| e1 | T2 | feat/e1-y | /tmp/e1b | `src/b.ts` | `other/**` | 做：a　不做：b | 無 |",
        ],
      }),
    ).includes("LANE_DUPLICATE"),
  );

  // ROW_CELL_COUNT — 7 cells instead of 8
  assert.ok(
    codesOf(manifestText({ lanesRows: ["| e1 | T1 | feat/e1-x | /tmp/e1 | `src/a.ts` | `other/**` | 做：a　不做：b |"] })).includes(
      "ROW_CELL_COUNT",
    ),
  );

  // OWNED_UNQUOTED_PATH — bare "templates/**", not backtick-quoted
  {
    const errs = validateManifest(
      manifestText({
        lanesRows: ["| e1 | T1 | feat/e1-x | /tmp/e1 | `src/a.ts`、templates/** | `other/**` | 做：a　不做：b | 無 |"],
      }),
    ).errors;
    const e = errs.find((x) => x.code === "OWNED_UNQUOTED_PATH");
    assert.ok(e, "must report OWNED_UNQUOTED_PATH");
    assert.match(e.message, /templates\/\*\*/);
    assert.ok(!errs.some((x) => x.code === "OWNED_EMPTY"), "must not also fire OWNED_EMPTY (one quoted token exists)");
  }

  // OWNED_EMPTY — no backtick-quoted path token at all
  assert.ok(
    codesOf(manifestText({ lanesRows: ["| e1 | T1 | feat/e1-x | /tmp/e1 | 沒有路徑 | `other/**` | 做：a　不做：b | 無 |"] })).includes(
      "OWNED_EMPTY",
    ),
  );

  // LANE_NOT_FOUND — render/check against an unknown lane on an otherwise
  // clean manifest (validateManifest alone never calls lookupLane).
  {
    const clean = manifestText();
    const m = parseManifest(clean);
    assert.deepEqual(m.errors, []);
    const r = renderPrompt(m, "zzz", { summary: "S", reading: ["R"], mailboxRoot: "/m", primary: "/p" });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.code === "LANE_NOT_FOUND"));
  }

  // LANES_SECTION_ABSENT — no "## Lanes" section at all
  assert.ok(codesOf(manifestText({ noLanesSection: true })).includes("LANES_SECTION_ABSENT"));

  // validate reports ALL errors in one run, one line each.
  {
    const bad = manifestText({
      lanesHeader: "| 區 | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
      decisionsRows: ["| not-a-date | 人類 | ok | src |"],
    });
    const r = runValidate([writeTmp(bad)]);
    assert.equal(r.exitCode, 2);
    const lines = r.stderr.trim().split("\n");
    assert.ok(lines.some((l) => l.includes("LANES_HEADER_UNKNOWN")), "LANES_HEADER_UNKNOWN missing from output");
    assert.ok(lines.some((l) => l.includes("DECISION_DATE_INVALID")), "DECISION_DATE_INVALID missing from output");
    for (const l of lines) assert.match(l, /^fanout: error: [A-Z_]+: /, `each line is one "fanout: error: <CODE>: ..." — got "${l}"`);
  }
});

function writeTmp(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e177a-manifest-"));
  const file = path.join(dir, "manifest.md");
  fs.writeFileSync(file, text);
  return file;
}

// ---------------------------------------------------------------------------
// AC6 — rendered prompt matches the frozen exact-string golden
// ---------------------------------------------------------------------------

test("AC6 render e177a", () => {
  const m = parseManifest(fixture("fanout-wave7.md"));
  const r = renderPrompt(m, "e177a", { summary: "S", reading: ["R1", "R2"], mailboxRoot: "/m", primary: "/p" });
  assert.equal(r.ok, true);
  const golden = fixture("render-e177a.golden.txt");
  assert.equal(r.prompt, golden);

  // The AC's own field-by-field spot checks, redundant with the golden but
  // pinned individually so a future golden edit that silently drops a field
  // still fails loudly at the line that matters.
  assert.match(r.prompt, /primary: \/p {4}base: 3f648bd {4}ticket-slug: e177a-fanout-manifest/);
  assert.match(r.prompt, /branch: feat\/e177a-fanout-manifest {4}worktree: \/agm-lanes\/e177a {4}lane: e177a/);
  assert.match(r.prompt, /信箱: \/m\/e177a\//);
  assert.match(r.prompt, /dispatch pins: sr-engineer=fable/);
  assert.match(r.prompt, /再讀 R1 \+ R2/);

  const e204 = renderPrompt(m, "e204", { summary: "S", reading: ["R1"], mailboxRoot: "/m", primary: "/p" });
  assert.equal(e204.ok, true);
  assert.match(e204.prompt, /dispatch pins: 無/);
});

// ---------------------------------------------------------------------------
// AC7 — the prompt points at the lane protocol instead of copying its text
// ---------------------------------------------------------------------------

test("AC7 no lane-protocol text in prompt", () => {
  const m = parseManifest(fixture("fanout-wave7.md"));
  const r = renderPrompt(m, "e177a", { summary: "S", reading: ["R1", "R2"], mailboxRoot: "/m", primary: "/p" });
  assert.equal(r.ok, true);
  assert.ok(r.prompt.includes("docs/lane-protocol.md"));
  const protocol = fs.readFileSync(path.join(ROOT, "docs", "lane-protocol.md"), "utf8");
  const leaks = protocol
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20)
    .filter((l) => r.prompt.includes(l));
  assert.deepEqual(leaks, [], "no non-blank lane-protocol.md line over 20 chars may appear in the rendered prompt");
});

// ---------------------------------------------------------------------------
// AC8 — each rendered field comes from its documented source
// ---------------------------------------------------------------------------

test("AC8 render field sources", () => {
  const wave7 = fixture("fanout-wave7.md");
  const m = parseManifest(wave7);
  const full = { summary: "S", reading: ["R1"], mailboxRoot: "/m", primary: "/p", base: "98052c6" };

  const noSummary = renderPrompt(m, "e177a", { ...full, summary: undefined });
  assert.equal(noSummary.ok, false);
  assert.ok(noSummary.errors.some((e) => e.code === "SUMMARY_ABSENT"));

  const noReading = renderPrompt(m, "e177a", { ...full, reading: [] });
  assert.equal(noReading.ok, false);
  assert.ok(noReading.errors.some((e) => e.code === "READING_ABSENT"));

  const noMailbox = renderPrompt(m, "e177a", { ...full, mailboxRoot: undefined });
  assert.equal(noMailbox.ok, false);
  assert.ok(noMailbox.errors.some((e) => e.code === "MAILBOX_ROOT_ABSENT"));

  const noBaseManifest = parseManifest(wave7.replace(/^base:.*$/m, ""));
  const noBase = renderPrompt(noBaseManifest, "e177a", { ...full, base: undefined });
  assert.equal(noBase.ok, false);
  assert.ok(noBase.errors.some((e) => e.code === "BASE_ABSENT"));

  const wipBranch = manifestText({ lanesRows: ["| e1 | T1 | wip/x | /tmp/e1 | `src/a.ts` | `x` | 做：a　不做：b | 無 |"] });
  const wipManifest = parseManifest(wipBranch);
  const notFeat = renderPrompt(wipManifest, "e1", full);
  assert.equal(notFeat.ok, false);
  assert.ok(notFeat.errors.some((e) => e.code === "BRANCH_NOT_FEAT"));

  // mailbox: header line with no flag; --mailbox-root wins over the header.
  const withHeader = parseManifest(wave7.replace(/^(base:.*)$/m, "$1\nmailbox: /hdr"));
  const hdrOnly = renderPrompt(withHeader, "e177a", { ...full, mailboxRoot: undefined });
  assert.equal(hdrOnly.ok, true);
  assert.match(hdrOnly.prompt, /信箱: \/hdr\/e177a\//);
  const hdrPlusFlag = renderPrompt(withHeader, "e177a", { ...full, mailboxRoot: "/m" });
  assert.equal(hdrPlusFlag.ok, true);
  assert.match(hdrPlusFlag.prompt, /信箱: \/m\/e177a\//);

  // --primary omitted inside a git repo: first `git worktree list --porcelain`
  // entry. Built as an isolated single-worktree repo so the result is
  // deterministic (not dependent on this dev environment's linked worktrees).
  {
    const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e177a-primary-")));
    execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: repo });
    fs.writeFileSync(path.join(repo, "x.txt"), "x");
    execFileSync("git", ["add", "-A"], { cwd: repo });
    execFileSync("git", ["-c", "user.email=a@b.c", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "init"], {
      cwd: repo,
    });
    assert.equal(resolvePrimary(repo), repo);
    const r = renderPrompt(m, "e177a", { ...full, primary: undefined, manifestDir: repo });
    assert.equal(r.ok, true);
    assert.match(r.prompt, new RegExp(`primary: ${repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `));
  }

  // --base wins over the manifest's own base: line; without it the manifest
  // value (3f648bd) is rendered.
  const withBaseFlag = renderPrompt(m, "e177a", full);
  assert.equal(withBaseFlag.ok, true);
  assert.match(withBaseFlag.prompt, /base: 98052c6/);
  const withoutBaseFlag = renderPrompt(m, "e177a", { ...full, base: undefined });
  assert.equal(withoutBaseFlag.ok, true);
  assert.match(withoutBaseFlag.prompt, /base: 3f648bd/);

  // The rendered 擁有 cell for e180 contains the prose parenthetical
  // byte-for-byte (verbatim cell, not the parsed token set).
  const e180 = renderPrompt(m, "e180", full);
  assert.equal(e180.ok, true);
  assert.ok(e180.prompt.includes("（只限 `finish --abandoned` 路徑"));
});

// ---------------------------------------------------------------------------
// AC13 — decisions-table rows are validated
// ---------------------------------------------------------------------------

test("AC13 decisions validation", () => {
  const rows = validateManifest(
    manifestText({
      decisionsRows: [
        "| 2026-02-30 | 人類 | ok | src |",
        "| 27/09/2026 | 人類 | ok | src |",
        "| 2026-09-27 | coordinator | ok | src |",
        "| 2026-09-27 | 人類 |  | src |",
        "| 2026-09-27 | 人類 | ok |  |",
      ],
    }),
  ).errors;
  const byCode = (code) => rows.filter((e) => e.code === code);

  const dateErrs = byCode("DECISION_DATE_INVALID");
  assert.equal(dateErrs.length, 2);
  assert.match(dateErrs[0].message, /row 1/);
  assert.match(dateErrs[1].message, /row 2/);

  const deciderErrs = byCode("DECISION_DECIDER_UNKNOWN");
  assert.equal(deciderErrs.length, 1);
  assert.match(deciderErrs[0].message, /row 3/);

  const emptyErrs = byCode("DECISION_FIELD_EMPTY");
  assert.equal(emptyErrs.length, 2);
  assert.match(emptyErrs[0].message, /row 4/);
  assert.match(emptyErrs[1].message, /row 5/);

  assert.ok(codesOf(manifestText({ decisionsHeader: "| 日期 | 誰 | 內容 | 出處 |" })).includes("DECISIONS_HEADER_DIFFERS"));
  assert.ok(codesOf(manifestText({ extraDecisionsSection: true })).includes("DECISIONS_SECTION_DUPLICATE"));

  // Header-only table (0 data rows) is valid.
  const clean = validateManifest(manifestText({ decisionsRows: [] }));
  assert.deepEqual(clean.errors, []);
  assert.equal(clean.manifest.decisions.rows.length, 0);
});

// ---------------------------------------------------------------------------
// AC14 — dispatch-pin bullets are validated (absent, duplicate, unknown, empty)
// ---------------------------------------------------------------------------

test("AC14 pins validation", () => {
  const rows2 = [
    VALID_ROW,
    "| e2 | T2 | feat/e2-x | /tmp/e2 | `src/b.ts` | `other/**` | 做：a　不做：b | 無 |",
  ];

  assert.ok(
    codesOf(manifestText({ lanesRows: rows2, pinsBullets: ["- e1：`sr-engineer=fable`"] })).includes("PINS_LANE_ABSENT"),
    "e2 named in no bullet",
  );

  assert.ok(
    codesOf(
      manifestText({
        lanesRows: rows2,
        pinsBullets: ["- e1：`sr-engineer=fable`", "- e2：`qa-engineer=sonnet`", "- e1：`sr-engineer=fable`"],
      }),
    ).includes("PINS_LANE_DUPLICATE"),
    "e1 named in two bullets",
  );

  assert.ok(
    codesOf(manifestText({ lanesRows: rows2, pinsBullets: ["- e1：`tester=fable`", "- e2：`sr-engineer=fable`"] })).includes(
      "PINS_ROLE_UNKNOWN",
    ),
    "tester is not one of the 8 dispatch_pins roles",
  );

  assert.ok(
    codesOf(manifestText({ lanesRows: rows2, pinsBullets: ["- e1：沒有寫", "- e2：`sr-engineer=fable`"] })).includes(
      "PINS_EMPTY_UNDECLARED",
    ),
    "bullet with neither a pin nor 無 pin/none",
  );

  assert.ok(
    codesOf(
      manifestText({
        lanesRows: rows2,
        pinsBullets: ["- e1：`sr-engineer=fable`", "- e2：`sr-engineer=fable`", "- zzz：`sr-engineer=fable`"],
      }),
    ).includes("PINS_LANE_UNKNOWN"),
    "zzz is in no Lanes table",
  );
});
