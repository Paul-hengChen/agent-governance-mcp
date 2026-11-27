// Coded by @qa-engineer
// Tests (T-E443A-01) for specs/e443a-manifest-waves.md A1-1..A1-3: the optional `波次` Lanes column (right after
// `相依`) and the restricted `相依` format that `fanout.mjs validate` checks only while `波次` is present.
// WHY: a wave manifest is compared mechanically with the approved wave table, so a typo in a dependency must be
// caught at validate time, before a lane starts too early; and every manifest written before this column existed
// must validate exactly as it did, because integrators and other tests depend on those results.
// Fixtures: test/fixtures/e443a/manifest-waves.md (header shape 3) and manifest-8col.md; shape 4 and the
// 9-column `approval` shape are derived in-test, one-cell mutations are written to os.tmpdir(). A1-3's sweep of the
// real specs/fanout-*.md compares with the exit codes qa recorded at the dispatch base before any build change
// (qa_reports/validate-baseline_e443a-manifest-waves.txt); no test diffs against a fixed sha.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const FIX = path.join(ROOT, "test", "fixtures", "e443a");
const WAVES = fs.readFileSync(path.join(FIX, "manifest-waves.md"), "utf8");
const EIGHT = fs.readFileSync(path.join(FIX, "manifest-8col.md"), "utf8");
const BASELINE_NAME = "validate-baseline_e443a-manifest-waves.txt";

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e443a-cols-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let seq = 0;
const tmpFile = (name, text) => {
  const p = path.join(TMP, `${seq++}-${name}`);
  fs.writeFileSync(p, text);
  return p;
};

function cli(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const errLines = (r) => r.stderr.split("\n").filter((l) => l.startsWith("fanout: error:"));
const loadManifestModule = () => import("../dist/tools/fanout-manifest.js");

// --- manifest text helpers -------------------------------------------------------------------------------------

const rowIndex = (lines, lane) => lines.findIndex((l) => l.startsWith(`| ${lane} |`));
const cellsOf = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
const rowOf = (cells) => `| ${cells.join(" | ")} |`;

/** The manifest with lane `lane`'s cell under header `column` set to `value` (one cell, one line). */
function setCell(text, lane, column, value) {
  const lines = text.split("\n");
  const header = cellsOf(lines.find((l) => l.startsWith("| lane |")));
  const col = header.indexOf(column);
  assert.ok(col >= 0, `fixture header has column ${column}`);
  const i = rowIndex(lines, lane);
  assert.ok(i >= 0, `fixture has lane ${lane}`);
  const cells = cellsOf(lines[i]);
  cells[col] = value;
  lines[i] = rowOf(cells);
  return lines.join("\n");
}

/** 1-based line of lane `lane`'s row. */
const lineOf = (text, lane) => rowIndex(text.split("\n"), lane) + 1;

/** Append an `approval` column to the Lanes table; `values` maps lane → cell (default `—`). */
function withApproval(text, values = {}) {
  const lines = text.split("\n");
  const h = lines.findIndex((l) => l.startsWith("| lane |"));
  lines[h] += " approval |";
  lines[h + 1] += "---|";
  for (let i = h + 2; i < lines.length && lines[i].startsWith("|"); i++) {
    const lane = cellsOf(lines[i])[0];
    lines[i] += ` ${values[lane] ?? "—"} |`;
  }
  return lines.join("\n");
}

/** The row-error line `validate` prints (existing row-error path: lane-attributed, section + line). */
const rowError = (code, lane, text, message) =>
  `fanout: error: ${code}: lane ${lane} (section "## Lanes" line ${lineOf(text, lane)}): ${message}`;

// --- throwaway git repo for `check` ----------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function commitTree(root, files, parents, message) {
  if (parents.length > 0) git(["rm", "-rq", "--ignore-unmatch", "-f", "."], root);
  for (const [p, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
    fs.writeFileSync(path.join(root, p), content);
  }
  git(["add", "-A"], root);
  const tree = git(["write-tree"], root);
  return git(["commit-tree", tree, ...parents.flatMap((p) => ["-p", p]), "-m", message], root);
}
function repoWithLaneBranch(branch, changed) {
  const root = fs.mkdtempSync(path.join(TMP, "repo-"));
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  git(["config", "user.email", "a@b.c"], root);
  git(["config", "user.name", "t"], root);
  git(["config", "commit.gpgsign", "false"], root);
  const files = { "src/a.ts": "a", "src/b.ts": "b", "src/c.ts": "c", "src/d.ts": "d", "src/e.ts": "e" };
  const base = commitTree(root, files, [], "base");
  git(["update-ref", "refs/heads/main", base], root);
  const tip = commitTree(root, { ...files, [changed]: "changed" }, [base], "lane work");
  git(["update-ref", `refs/heads/${branch}`, tip], root);
  return root;
}

// ---------------------------------------------------------------------------------------------------------------
// A1-1 — a valid wave manifest validates, checks, and parses wave + depLanes
// ---------------------------------------------------------------------------------------------------------------

test("A1-1: a Lanes table with 波次 (shapes 3 and 4) validates, checks clean, and parses wave and depLanes", async (t) => {
  // WHY: the 波次 column is only useful if a manifest that carries it is dispatchable like any other — validate,
  // render and check must accept it — and the comparison reads each lane's wave and dependency list from parseManifest.
  const shape4 = withApproval(WAVES, { la: "human", lb: "" });
  const { parseManifest } = await loadManifestModule();

  await t.test("validate exits 0 with the existing ok line (shape 3 and shape 4)", () => {
    for (const [label, text] of [["shape 3", WAVES], ["shape 4", shape4]]) {
      const r = cli(["validate", tmpFile("waves.md", text)]);
      assert.equal(r.status, 0, `${label}: ${r.stderr}`);
      assert.equal(r.stdout, "fanout: ok — 5 dispatchable lane(s), 0 provisional, 1 decision(s)\n", label);
      assert.equal(r.stderr, "", label);
    }
  });

  await t.test("parseManifest gives each lane its wave and depLanes (`, `  `、`  `，` separators, 無 = none)", () => {
    const expected = {
      la: { wave: 1, depLanes: [] },
      lb: { wave: 1, depLanes: [] },
      lc: { wave: 2, depLanes: ["la", "lb"] },
      ld: { wave: 2, depLanes: ["la", "lc"] },
      le: { wave: 3, depLanes: ["lb", "ld"] },
    };
    for (const [label, text] of [["shape 3", WAVES], ["shape 4", shape4]]) {
      const m = parseManifest(text);
      assert.deepEqual(m.errors, [], `${label}: no format error`);
      assert.deepEqual(m.provisional, [], `${label}: no provisional lane`);
      const got = Object.fromEntries(m.dispatchable.map((l) => [l.lane, { wave: l.wave, depLanes: l.depLanes }]));
      assert.deepEqual(got, expected, label);
    }
  });

  await t.test("shape 4 reads the approval cell by header position, after 波次", () => {
    const lanes = parseManifest(shape4).dispatchable;
    assert.equal(lanes.find((l) => l.lane === "la").approval, "human");
    assert.equal(lanes.find((l) => l.lane === "lb").approval, undefined, "empty approval cell");
    assert.equal(lanes.find((l) => l.lane === "lc").approval, undefined, "— approval cell");
    // a shape-4 row whose approval cell holds a wave-like value is still an approval error, not a wave
    const bad = cli(["validate", tmpFile("bad-approval.md", withApproval(WAVES, { la: "1" }))]);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /APPROVAL_VALUE_UNKNOWN: lane la /);
  });

  await t.test("check <manifest> <lane> against a temporary repo reports no format error and passes in bounds", () => {
    for (const [label, text] of [["shape 3", WAVES], ["shape 4", shape4]]) {
      const repo = repoWithLaneBranch("feat/lc-fixture", "src/c.ts");
      const r = cli(["check", tmpFile("waves-check.md", text), "lc", "--base", "main", "--repo", repo]);
      assert.equal(r.status, 0, `${label}: ${r.stdout}${r.stderr}`);
      assert.equal(errLines(r).length, 0, `${label}: no fanout: error line`);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A1-2 — malformed 波次 / 相依 cells are row errors
// ---------------------------------------------------------------------------------------------------------------

test("A1-2: a bad 波次 or 相依 cell exits 2 with exactly one lane-attributed row error naming the cell", async (t) => {
  // WHY: 相依 is the machine-read edge of the dependency graph once 波次 is present; prose, a self-edge, an unknown
  // lane or an edge into a later wave would let a lane start before the work it needs, so validate refuses it.
  // Lane lb (wave 1) is named in lc's and le's 相依, so its bad 波次 also proves the later-wave check is skipped
  // when a wave cell is itself in error, and that a lane with a row error is still a known lane.
  const cases = [
    ["波次 0", "lb", "波次", "0", "WAVE_NOT_INTEGER", '波次 cell is "0" — must be a positive integer'],
    ["波次 1.5", "lb", "波次", "1.5", "WAVE_NOT_INTEGER", '波次 cell is "1.5" — must be a positive integer'],
    ["波次 二", "lb", "波次", "二", "WAVE_NOT_INTEGER", '波次 cell is "二" — must be a positive integer'],
    ["波次 empty", "lb", "波次", "", "WAVE_NOT_INTEGER", '波次 cell is "" — must be a positive integer'],
    ["波次 leading zero", "lb", "波次", "01", "WAVE_NOT_INTEGER", '波次 cell is "01" — must be a positive integer'],
    ["相依 prose", "lc", "相依", "e1 merged", "DEPS_NOT_LANE_LIST", '相依 cell "e1 merged" is not 無 or a comma-separated list of lane names — notes go in 範圍切線'],
    ["相依 em dash", "lc", "相依", "—", "DEPS_NOT_LANE_LIST", '相依 cell "—" is not 無 or a comma-separated list of lane names — notes go in 範圍切線'],
    ["相依 unknown lane", "lc", "相依", "la, zz", "DEPS_LANE_UNKNOWN", '相依 cell names "zz", which is not a lane of a Lanes table with 波次 in this manifest'],
    ["相依 self", "lc", "相依", "lc", "DEPS_SELF", "相依 cell names the lane itself"],
    ["相依 later wave", "la", "相依", "lc", "DEPS_LATER_WAVE", '相依 cell names "lc", which is in a later wave (2 > 1)'],
    // boundary inputs (I1): empty cell, empty entry, 無 combined with names
    ["相依 empty", "lc", "相依", "", "DEPS_NOT_LANE_LIST", '相依 cell "" is not 無 or a comma-separated list of lane names — notes go in 範圍切線'],
    ["相依 empty entry", "lc", "相依", "la,,lb", "DEPS_NOT_LANE_LIST", '相依 cell "la,,lb" is not 無 or a comma-separated list of lane names — notes go in 範圍切線'],
    ["相依 無 plus a name", "lc", "相依", "無、la", "DEPS_NOT_LANE_LIST", '相依 cell "無、la" is not 無 or a comma-separated list of lane names — notes go in 範圍切線'],
  ];
  for (const [label, lane, column, value, code, message] of cases) {
    await t.test(label, () => {
      const text = setCell(WAVES, lane, column, value);
      const r = cli(["validate", tmpFile("bad.md", text)]);
      assert.equal(r.status, 2, `${label}: ${r.stdout}${r.stderr}`);
      assert.deepEqual(errLines(r), [rowError(code, lane, text, message)], label);
      assert.ok(errLines(r)[0].includes(`lane ${lane} `) && errLines(r)[0].includes(column), `${label}: names lane ${lane} and ${column}`);
    });
  }

  await t.test("render of the lane with the row error refuses, as for any row error", () => {
    const text = setCell(WAVES, "lc", "相依", "e1 merged");
    const m = tmpFile("bad-render.md", text);
    const r = cli(["render", m, "lc", "--summary", "S", "--reading", "R", "--primary", TMP, "--mailbox-root", TMP]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /DEPS_NOT_LANE_LIST: lane lc /);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A1-3 — manifests without 波次 behave exactly as before
// ---------------------------------------------------------------------------------------------------------------

/** The baseline qa recorded at the dispatch base: qa_reports/ while the lane is open, qa_reports/archive/<x>/ after. */
function findBaseline() {
  const top = path.join(ROOT, "qa_reports", BASELINE_NAME);
  if (fs.existsSync(top)) return top;
  const archive = path.join(ROOT, "qa_reports", "archive");
  if (!fs.existsSync(archive)) return undefined;
  for (const d of fs.readdirSync(archive)) {
    const p = path.join(archive, d, BASELINE_NAME);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

test("A1-3: manifests without 波次 keep their pre-ticket validate results; 相依 stays free text", async (t) => {
  // WHY: the 波次 / 相依 checks are opt-in per Lanes table; every existing manifest (and every adopter's) must
  // validate exactly as before, prose in 相依 included, or the new format would break plans already approved.
  const { parseManifest } = await loadManifestModule();

  await t.test("every specs/fanout-*.md recorded at the dispatch base keeps its validate exit code", (st) => {
    const baseline = findBaseline();
    if (baseline === undefined) {
      st.skip(`LOUD SKIP: ${BASELINE_NAME} not found under qa_reports/ or qa_reports/archive/*/ — the base sweep cannot run`);
      return;
    }
    const rows = fs.readFileSync(baseline, "utf8").split("\n").filter((l) => l.trim() !== "");
    assert.ok(rows.length >= 50, "baseline covers the manifests that existed at the dispatch base");
    let compared = 0;
    for (const row of rows) {
      const m = /^(specs\/fanout-\S+\.md) (\d+)$/.exec(row);
      assert.ok(m, `baseline row has the "<file> <exit>" shape: ${row}`);
      // a manifest deleted after the base is no longer this ticket's concern
      if (!fs.existsSync(path.join(ROOT, m[1]))) continue;
      assert.equal(String(cli(["validate", m[1]]).status), m[2], `${m[1]}: validate exit code differs from the dispatch base`);
      compared++;
    }
    assert.ok(compared > 0, "at least one recorded manifest was compared");
  });

  await t.test("an 8-column manifest (prose in 相依) validates with the pinned pre-ticket output", () => {
    const r = cli(["validate", tmpFile("eight.md", EIGHT)]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, "fanout: ok — 2 dispatchable lane(s), 0 provisional, 1 decision(s)\n");
    assert.equal(r.stderr, "");
  });

  await t.test("a 9-column manifest with `approval` (prose in 相依) validates with the pinned pre-ticket output", () => {
    const r = cli(["validate", tmpFile("nine.md", withApproval(EIGHT, { la: "human" }))]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, "fanout: ok — 2 dispatchable lane(s), 0 provisional, 1 decision(s)\n");
    assert.equal(r.stderr, "");
  });

  await t.test("rows of a table without 波次 have wave and depLanes undefined and keep 相依 verbatim", () => {
    for (const text of [EIGHT, withApproval(EIGHT, { la: "human" })]) {
      const lanes = parseManifest(text).dispatchable;
      assert.equal(lanes.length, 2);
      for (const l of lanes) {
        assert.equal(l.wave, undefined, `${l.lane}: wave`);
        assert.equal(l.depLanes, undefined, `${l.lane}: depLanes`);
      }
      assert.equal(lanes.find((l) => l.lane === "lb").deps, "la merged first — then rebase");
    }
  });
});
