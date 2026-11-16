// Coded by @qa-engineer
// E417 AC13: condition (c) history check of the merge-invariants tool (specs/e126-merge-invariants.md, steps 1-9).
// WHY: the E203-file repro tests prove the lost-row false negative is closed. This file proves the other half:
// legitimate merges keep their verdict (G), the one stricter family is pinned on purpose (S1, N02, N03), base-row
// deletion behaves (K), and every unreadable-history case keeps the old verdict with one WARN line (F).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { runMergeInvariants, gitVersionAllowsNoLazyFetch, historyErrorDetail } from "../dist/tools/merge-invariants.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const git = (args, cwd, env) =>
  execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], env: env ? { ...process.env, ...env } : process.env }).trim();

// Every temp repo lives under the OS temp dir and is removed when the test process exits.
const tempDirs = [];
process.on("exit", () => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});

function mkRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e417-merge-invariants-"));
  tempDirs.push(root);
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  for (const [k, v] of [["user.email", "a@b.c"], ["user.name", "t"], ["commit.gpgsign", "false"]]) execFileSync("git", ["config", k, v], { cwd: root });
  return root;
}

// Commit object built with commit-tree so no branch checkout is involved (same convention as the E203 fixtures).
function commitTree(root, files, parents, message) {
  if (parents.length > 0) git(["rm", "-rq", "--ignore-unmatch", "-f", "."], root);
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(root, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  git(["add", "-A"], root);
  const tree = git(["write-tree"], root);
  return git(["commit-tree", tree, ...parents.flatMap((p) => ["-p", p]), "-m", message], root);
}

const ROWS3 = "## Wave\n- [x] T-A-01 a\n- [x] T-A-02 b\n- [x] T-A-03 c\n";
const ROWS2 = "## Wave\n- [x] T-A-01 a\n- [x] T-A-02 b\n";
const MANIFEST_DV = (d, v) =>
  `## Compacted History\n<!-- compacted: e417-fixture 2026-11-10 — 1 sections, ${d} [x] rows, ${v} [-] rows summarized below -->\n- Wave: ${d} done, ${v} voided\n`;
const MANIFEST = (n) => MANIFEST_DV(n, 0);
const A04 = "- [x] T-A-04 d\n";
const D01 = "- [x] T-D-01 added by main\n";
const D01_VOID = "- [-] T-D-01 added by main\n";
const ids = (list) => list.map((x) => x.taskId).sort();
const hasCReason = (m) => m.reasons.some((r) => /\(c\) manifest under-reconciles/.test(r));
const warnLines = (report) => report.split("\n").filter((l) => /^WARN \(c\)/.test(l));

// ---------------------------------------------------------------------------------------------------------------
// Fixture builders (shapes exactly as the step-7 rows). merge* arguments are the merge's tasks.md content.
// ---------------------------------------------------------------------------------------------------------------

// R1 shape: parent2 adds T-A-04 then compacts M(4); parent1 adds T-D-01. Returns the commit ids too.
function r1(mergeTasks) {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + D01 }, [base], "parent1");
  const merge = commitTree(root, { "tasks.md": mergeTasks }, [p1, p2], "merge");
  return { root, base, c1, p1, p2, merge };
}

function case2(mergeTasks) {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 + A04 }, [], "base");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [base], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": `${ROWS3}${D01}## Other\n${A04}` }, [base], "parent1: move T-A-04, add T-D-01");
  const merge = commitTree(root, { "tasks.md": mergeTasks }, [p1, p2], "merge");
  return { root, merge };
}

function cherryPick(mergeTasks) {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + A04 + D01 }, [base], "parent1: add T-A-04 and T-D-01");
  const merge = commitTree(root, { "tasks.md": mergeTasks }, [p1, p2], "merge");
  return { root, merge };
}

function twice(mergeTasks) {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS2 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": MANIFEST(2) }, [base], "parent2: compact");
  const c2 = commitTree(root, { "tasks.md": `${MANIFEST(2)}## Wave\n- [x] T-A-03 c\n` }, [c1], "parent2: add T-A-03");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(3) }, [c2], "parent2: re-compact");
  const p1 = commitTree(root, { "tasks.md": ROWS2 + D01 }, [base], "parent1");
  const merge = commitTree(root, { "tasks.md": mergeTasks }, [p1, p2], "merge");
  return { root, merge };
}

function viaMergeCommit(mergeTasks) {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const s1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "side: add T-A-04");
  const s2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [s1], "side: compact");
  const l1 = commitTree(root, { "tasks.md": ROWS3, "unrelated.txt": "x\n" }, [base], "line: unrelated change");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4), "unrelated.txt": "x\n" }, [l1, s2], "parent2: merge side");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + D01 }, [base], "parent1");
  const merge = commitTree(root, { "tasks.md": mergeTasks, "unrelated.txt": "x\n" }, [p1, p2], "merge");
  return { root, merge };
}

function assertPassNoWarn(result, expectedCompacted) {
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(ids(result.findings.missing), []);
  assert.deepEqual(ids(result.findings.compacted), expectedCompacted);
  assert.deepEqual(warnLines(result.report), [], "no history was needed, so no WARN (c) line");
  assert.deepEqual(result.findings.historyFallbacks, []);
}

// ---------------------------------------------------------------------------------------------------------------
// G1-G8: the same shapes as the repro rows, but the merge keeps (or counts) what it must: verdict stays PASS.
// ---------------------------------------------------------------------------------------------------------------

test("E417 G1: R1 with the merge keeping T-D-01 passes; COMPACTED is T-A-01..03", () => {
  const { root, merge } = r1(`${MANIFEST(4)}## Wave\n${D01}`);
  assertPassNoWarn(runMergeInvariants(merge, root), ["T-A-01", "T-A-02", "T-A-03"]);
});

test("E417 G2: the case-2 shape with the merge keeping T-D-01 passes; COMPACTED is T-A-01..03", () => {
  const { root, merge } = case2(`${MANIFEST(4)}## Wave\n${D01}## Other\n${A04}`);
  assertPassNoWarn(runMergeInvariants(merge, root), ["T-A-01", "T-A-02", "T-A-03"]);
});

test("E417 G3: the cherry-pick shape with the merge keeping T-A-04 and T-D-01 passes; COMPACTED is T-A-01..03", () => {
  const { root, merge } = cherryPick(`${MANIFEST(4)}## Wave\n${A04}${D01}`);
  assertPassNoWarn(runMergeInvariants(merge, root), ["T-A-01", "T-A-02", "T-A-03"]);
});

test("E417 G4: R4 (compacted twice) with the merge keeping T-D-01 passes; COMPACTED is T-A-01, T-A-02", () => {
  const { root, merge } = twice(`${MANIFEST(3)}## Wave\n${D01}`);
  assertPassNoWarn(runMergeInvariants(merge, root), ["T-A-01", "T-A-02"]);
});

test("E417 G5: R5 (compaction through a merge commit) with the merge keeping T-D-01 passes; COMPACTED is T-A-01..03", () => {
  const { root, merge } = viaMergeCommit(`${MANIFEST(4)}## Wave\n${D01}`);
  assertPassNoWarn(runMergeInvariants(merge, root), ["T-A-01", "T-A-02", "T-A-03"]);
});

test("E417 G6: R6 (voided rows) with the merge keeping the voided T-D-01 passes", () => {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": `${ROWS3}- [-] T-A-04 d\n` }, [base], "parent2: add voided T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST_DV(3, 1) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + D01_VOID }, [base], "parent1: add voided T-D-01");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST_DV(3, 1)}## Wave\n${D01_VOID}` }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), []);
});

test("E417 G7: R8 (reopened row) with the merge keeping T-D-01 passes", () => {
  const root = mkRepo();
  const reopened = `${ROWS2}- [ ] T-A-03 c\n`;
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": reopened + D01 }, [base], "parent1: reopen T-A-03, add T-D-01");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(3)}## Wave\n- [ ] T-A-03 c\n${D01}` }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), []);
});

test("E417 G8: R7 (completion folded into a voided count) with the merge counting T-A-03 done, M(4,0), passes", () => {
  const root = mkRepo();
  const baseRows = `${ROWS2}- [-] T-A-03 c\n`;
  const base = commitTree(root, { "tasks.md": baseRows }, [], "base");
  const c1 = commitTree(root, { "tasks.md": baseRows + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST_DV(3, 1) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 }, [base], "parent1: complete T-A-03");
  const merge = commitTree(root, { "tasks.md": MANIFEST_DV(4, 0) }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), []);
});

// ---------------------------------------------------------------------------------------------------------------
// S1 family: intended strictness (spec step 7, "Intended strictness" paragraph).
// ---------------------------------------------------------------------------------------------------------------

function assertStrict(result, expectedMissing) {
  assert.equal(result.code, "FAIL", `report:\n${result.report}`);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(ids(result.findings.missing), expectedMissing);
  for (const m of result.findings.missing) {
    assert.ok(hasCReason(m), `${m.taskId} carries the (c) reason: ${m.reasons.join(" | ")}`);
    assert.ok(
      m.reasons.some((r) => /includes 1 row\(s\) read from parent2 history after the merge-base/.test(r)),
      `${m.taskId} reason names the history row: ${m.reasons.join(" | ")}`,
    );
  }
  assert.ok(!ids(result.findings.missing).includes("T-A-04"), "T-A-04 is never MISSING");
}

test("E417 S1: a kept row the compacting side summarized does not free a slot for its post-base summarized row (intended strictness)", () => {
  // Spec step 7, S1 paragraph: the snapshots equal a merge that kept T-A-03 AND its count and erased T-A-04, so
  // FAIL is chosen, for the reason AC-E203-6 already FAILs its twin: a kept summarized row never frees a slot.
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 }, [base], "parent1 = base content");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(3)}## Wave\n- [x] T-A-03 c\n` }, [p1, p2], "merge");
  assertStrict(runMergeInvariants(merge, root), ["T-A-01", "T-A-02"]);
});

test("E417 N03: S1 family, a modify/delete conflict resolved by keeping the edited row and lowering the count, FAILs", () => {
  // Review round 2: parent1 edits T-A-03's text and adds T-D-01; the merge keeps both and writes the lower count M(3) (P2's M(4) minus the kept row).
  // The edited row is still the same task_id, so it holds its slot; T-A-04 (post-base, summarized) then has none.
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": `${ROWS2}- [x] T-A-03 c (edited by main)\n${D01}` }, [base], "parent1: edit T-A-03, add T-D-01");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(3)}## Wave\n- [x] T-A-03 c (edited by main)\n${D01}` }, [p1, p2], "merge");
  assertStrict(runMergeInvariants(merge, root), ["T-A-01", "T-A-02"]);
});

test("E417 N02: N03 without the post-base row FAILs (the pre-E417 rule already rejects it)", () => {
  // N03 minus T-A-04: no history is involved, so this verdict is the snapshot check alone and is identical before E417.
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(3) }, [base], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": `${ROWS2}- [x] T-A-03 c (edited by main)\n${D01}` }, [base], "parent1: edit T-A-03, add T-D-01");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(2)}## Wave\n- [x] T-A-03 c (edited by main)\n${D01}` }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), ["T-A-01", "T-A-02"]);
  for (const m of result.findings.missing) assert.ok(hasCReason(m), `${m.taskId} carries the (c) reason`);
  assert.ok(
    !result.findings.missing.some((m) => m.reasons.some((r) => /read from parent\d history/.test(r))),
    "the snapshot check failed on its own, so the history suffix is absent",
  );
});

// ---------------------------------------------------------------------------------------------------------------
// K1 / K2: the compacting side deleted a base row outright (spec step 4, K_out).
// ---------------------------------------------------------------------------------------------------------------

function compactorDeleted(mergeTasks) {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": `${ROWS2}${A04}` }, [base], "parent2: delete T-A-03, add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(3) }, [c1], "parent2: compact");
  const merge = commitTree(root, { "tasks.md": mergeTasks }, [base, p2], "merge");
  return { root, merge };
}

test("E417 K1: a kept base row the compacting side deleted holds no slot in the history check", () => {
  // WHY: the compacting side's manifest never counted T-A-03 (it deleted it), so keeping it must not double-book with T-A-04.
  const { root, merge } = compactorDeleted(`${MANIFEST(3)}## Wave\n- [x] T-A-03 c\n`);
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), []);
});

test("E417 K2: a base row the compacting side deleted and the merge dropped is MISSING", () => {
  const { root, merge } = compactorDeleted(MANIFEST(3));
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), ["T-A-01", "T-A-02", "T-A-03"]);
  for (const m of result.findings.missing) assert.ok(hasCReason(m), `${m.taskId} carries the (c) reason`);
});

// ---------------------------------------------------------------------------------------------------------------
// F1-F7: fallbacks. Whatever cannot be read yields the OLD verdict, the same exit code and one WARN line per section.
// ---------------------------------------------------------------------------------------------------------------

// Recursive (path -> size) listing of .git, to prove the tool wrote nothing.
function gitDirDigest(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out.push(`${path.relative(root, full)}:${fs.statSync(full).size}`);
    }
  };
  walk(path.join(root, ".git"));
  return out.sort().join("\n");
}

test("E417 F1: a shallow repository falls back to the snapshot-only rule with one WARN line, exit code unchanged", () => {
  const { root, base, merge } = r1(MANIFEST(4));
  fs.writeFileSync(path.join(root, ".git", "shallow"), `${base}\n`);
  const before = gitDirDigest(root);
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `the snapshot-only verdict is the old one (PASS); report:\n${result.report}`);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(ids(result.findings.missing), []);
  const warns = warnLines(result.report);
  assert.equal(warns.length, 1, `exactly one WARN line:\n${result.report}`);
  assert.match(
    result.report,
    /^WARN \(c\) history fallback: parent2 \([0-9a-f]{7}\) tasks\.md § Wave — shallow repository; snapshot-only \(c\) used for this section$/m,
  );
  const lines = result.report.split("\n");
  assert.ok(lines.findIndex((l) => /^WARN \(c\)/.test(l)) < lines.findIndex((l) => l.startsWith("[AC1]")), "WARN precedes the [AC1] line");
  assert.equal(result.findings.historyFallbacks.length, 1);
  assert.equal(result.findings.historyFallbacks[0].reason, "shallow");
  const second = runMergeInvariants(merge, root);
  assert.equal(second.report, result.report, "a second run is byte-identical");
  assert.equal(gitDirDigest(root), before, "the tool wrote nothing into .git");
});

test("E417 F2: an unreadable history object falls back with a WARN line, exit code unchanged", () => {
  const { root, c1, merge } = r1(MANIFEST(4));
  const blob = git(["rev-parse", `${c1}:tasks.md`], root);
  fs.rmSync(path.join(root, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.equal(result.exitCode, 0);
  const warns = warnLines(result.report);
  assert.equal(warns.length, 1, `exactly one WARN line:\n${result.report}`);
  assert.match(warns[0], /^WARN \(c\) history fallback: parent2 \([0-9a-f]{7}\) tasks\.md § Wave — history unreadable: \S.*; snapshot-only \(c\) used for this section$/);
  assert.equal(result.findings.historyFallbacks[0].reason, "unreadable");
  assert.ok(result.findings.historyFallbacks[0].detail.length > 0);
});

test("E417 F3: history over the commit cap falls back with a WARN line", () => {
  const { root, merge } = r1(MANIFEST(4));
  const result = runMergeInvariants(merge, root, { historyCommitCap: 1 });
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.equal(result.exitCode, 0);
  const warns = warnLines(result.report);
  assert.equal(warns.length, 1, `exactly one WARN line:\n${result.report}`);
  assert.match(warns[0], /history over cap: more than 1 commits touch tasks\.md between the merge-base and parent2; snapshot-only/);
  assert.equal(result.findings.historyFallbacks[0].reason, "cap");
  // Control: with cap 2 the walk completes and the loss is reported.
  assert.equal(runMergeInvariants(merge, root, { historyCommitCap: 2 }).code, "FAIL");
});

test("E417 F4: an unreconciled compaction keeps today's verdict and adds a WARN line", () => {
  // AC-E203-4 fixture: parent2 compacts M(3) in one step but the merge writes M(2) and keeps T-D-01 (an under-count).
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + D01 }, [base], "parent1");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(2) }, [base], "parent2: compact with an under-count");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(2)}## Wave\n${D01}` }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `report:\n${result.report}`);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(ids(result.findings.missing), ["T-A-01", "T-A-02", "T-A-03"]);
  const warns = warnLines(result.report);
  assert.equal(warns.length, 1, `exactly one WARN line:\n${result.report}`);
  assert.match(
    warns[0],
    /history unreconciled: count rose by 2 done\/0 voided at [0-9a-f]{7} but 3 \[x\]\/0 \[-\] row\(s\) left the section; snapshot-only/,
  );
  assert.equal(result.findings.historyFallbacks[0].reason, "unreconciled");
});

test("E417 F5: no history is read when no verdict depends on it", () => {
  // With .git/shallow written, any walk would produce a WARN; none appears, so no walk was requested.
  const shallow = (root, base) => fs.writeFileSync(path.join(root, ".git", "shallow"), `${base}\n`);

  // AC11 clean-compaction fixture: the merge compacts S itself (neither parent names it).
  let root = mkRepo();
  let base = commitTree(root, { "tasks.md": "## Active\n- [x] T-OK-01 a\n- [x] T-OK-02 b\n" }, [], "base");
  let p1 = commitTree(root, { "tasks.md": "## Active\n- [x] T-OK-01 a\n- [x] T-OK-02 b\n" }, [base], "parent1");
  let p2 = commitTree(root, { "tasks.md": "## Active\n- [x] T-OK-01 a\n- [x] T-OK-02 b\n" }, [base], "parent2");
  let merge = commitTree(
    root,
    { "tasks.md": "## Compacted History\n<!-- compacted: clean 2026-09-27 — 1 sections, 2 [x] rows, 0 [-] rows summarized below -->\n- Active: 2 done, 0 voided\n" },
    [p1, p2],
    "merge",
  );
  shallow(root, base);
  let result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.deepEqual(warnLines(result.report), []);

  // AC11 (iii) recycled section name: parent1 already names "Active" (condition (d) decides), so (c) needs no history.
  root = mkRepo();
  base = commitTree(root, { "tasks.md": "## Active\n" }, [], "base");
  p1 = commitTree(
    root,
    {
      "tasks.md":
        "## Active\n- [x] T-RECYCLE-01 new row added after historical compaction\n\n" +
        "## Compacted History\n<!-- compacted: iii-fixture 2026-09-27 — 1 sections, 400 [x] rows, 0 [-] rows summarized below -->\n- Active: 400 done, 0 voided\n",
    },
    [base],
    "parent1",
  );
  p2 = commitTree(root, { "tasks.md": "## Active\n" }, [base], "parent2");
  merge = commitTree(
    root,
    { "tasks.md": "## Compacted History\n<!-- compacted: iii-fixture-merge 2026-09-27 — 1 sections, 401 [x] rows, 0 [-] rows summarized below -->\n- Active: 401 done, 0 voided\n" },
    [p1, p2],
    "merge",
  );
  shallow(root, base);
  result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), ["T-RECYCLE-01"]);
  assert.deepEqual(warnLines(result.report), []);
});

function gitMinorAtLeast244() {
  return gitVersionAllowsNoLazyFetch(execFileSync("git", ["version"], { encoding: "utf-8" }).trim());
}

test(
  "E417 F6: a partial clone never fetches during the history read",
  { skip: gitMinorAtLeast244() ? false : "git older than 2.44 has no GIT_NO_LAZY_FETCH; the tool treats a partial clone as unreadable instead" },
  () => {
    const { root: src, c1, merge } = r1(MANIFEST(4));
    git(["update-ref", "refs/heads/main", merge], src);
    git(["config", "uploadpack.allowFilter", "true"], src);
    git(["config", "uploadpack.allowAnySHA1InWant", "true"], src);
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "e417-merge-invariants-clone-"));
    tempDirs.push(parent);
    const clone = path.join(parent, "clone");
    execFileSync("git", ["clone", "-q", "--filter=blob:none", "--no-local", "--no-checkout", `file://${src}`, clone], { stdio: ["ignore", "pipe", "pipe"] });
    const noFetch = { GIT_NO_LAZY_FETCH: "1" };
    const blob = git(["rev-parse", `${c1}:tasks.md`], src);
    const blobPresent = () => {
      try {
        git(["cat-file", "-e", blob], clone, noFetch);
        return true;
      } catch {
        return false;
      }
    };
    assert.equal(blobPresent(), false, "precondition: the history-only blob is absent from the partial clone");
    const result = runMergeInvariants(merge, clone);
    assert.equal(result.code, "PASS", `report:\n${result.report}`);
    assert.equal(result.exitCode, 0);
    const warns = warnLines(result.report);
    assert.equal(warns.length, 1, `exactly one WARN line:\n${result.report}`);
    assert.match(warns[0], /history unreadable: \S/);
    assert.equal(blobPresent(), false, "the history read did not fetch the missing blob");
  },
);

test("E417 F7: the git-version gate and the WARN detail are never empty", () => {
  assert.equal(gitVersionAllowsNoLazyFetch("git version 2.43.0"), false);
  assert.equal(gitVersionAllowsNoLazyFetch("git version 2.43.9"), false);
  assert.equal(gitVersionAllowsNoLazyFetch("not a version line"), false);
  assert.equal(gitVersionAllowsNoLazyFetch(""), false);
  assert.equal(gitVersionAllowsNoLazyFetch("git version 2.44.0"), true);
  assert.equal(gitVersionAllowsNoLazyFetch("git version 2.50.1 (Apple Git-155)"), true);
  assert.equal(gitVersionAllowsNoLazyFetch("git version 3.0.0"), true);

  assert.equal(historyErrorDetail({ stderr: "\n  fatal: bad object\nmore\n", message: "m" }, "log"), "fatal: bad object");
  assert.equal(historyErrorDetail({ stderr: "", message: "\nCommand failed: git log\nrest" }, "log"), "Command failed: git log");
  assert.equal(historyErrorDetail({ stderr: "  ", message: "" }, "log"), "git log failed");
  assert.equal(historyErrorDetail(null, "cat-file"), "git cat-file failed");
  assert.equal(historyErrorDetail(undefined, "rev-parse"), "git rev-parse failed");
  assert.ok(historyErrorDetail({ stderr: "x".repeat(500) }, "log").length <= 200, "detail is trimmed to 200 chars");
  assert.ok(historyErrorDetail(new Error(""), "log").length > 0);
});

// ---------------------------------------------------------------------------------------------------------------
// N1: no regression in the pre-existing merge-invariants suites.
// ---------------------------------------------------------------------------------------------------------------

test("E417 N1: every existing case in the e126 and E203 merge-invariants suites passes unmodified", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(
    process.execPath,
    ["--test", path.join(HERE, "e126-merge-invariants.test.mjs"), path.join(HERE, "e203-merge-invariants-union.test.mjs")],
    { encoding: "utf-8", env },
  );
  assert.equal(res.status, 0, `existing suites must pass:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /# fail 0/);
});
