// Coded by @qa-engineer
// E203: merge-invariants condition (c) drops a kept row from the union only when the manifest cannot have
// counted it (specs/e126-merge-invariants.md (c) paragraph; specs/e406-release-and-merge-scripts.md AC-E203-1..7).
//
// WHY: a compaction on one side plus a NEW closed row kept by the merge on the other side must not fail as a
// loss (false positive), yet a merge that really drops a row must still fail (never a silent pass). The R-1
// 5-vs-4 case in test/e126-merge-invariants.test.mjs stays the unchanged guard for the pure-union direction
// (AC-E203-2); the cherry-pick-shaped false negative is an accepted spec-stated limit and is not asserted.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { runMergeInvariants } from "../dist/tools/merge-invariants.js";

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function mkRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e203-merge-invariants-"));
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  for (const [k, v] of [["user.email", "a@b.c"], ["user.name", "t"], ["commit.gpgsign", "false"]]) execFileSync("git", ["config", k, v], { cwd: root });
  return root;
}

// Commit object built with commit-tree so no branch checkout is involved.
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

function mkMergeFixture({ baseFiles, p1Files, p2Files, mergeFiles }) {
  const root = mkRepo();
  const base = commitTree(root, baseFiles, [], "base");
  const p1 = commitTree(root, p1Files, [base], "parent1");
  const p2 = commitTree(root, p2Files, [base], "parent2");
  return { root, merge: commitTree(root, mergeFiles, [p1, p2], "merge") };
}

const ROWS3 = "## Wave\n- [x] T-A-01 a\n- [x] T-A-02 b\n- [x] T-A-03 c\n";
const MANIFEST = (n) =>
  `## Compacted History\n<!-- compacted: e203-fixture 2026-11-10 — 1 sections, ${n} [x] rows, 0 [-] rows summarized below -->\n- Wave: ${n} done, 0 voided\n`;
const NEW_ROW = "- [x] T-D-01 added by main\n";

// Repro shape: base and parent2 (the lane) hold Wave T-A-01..03; the lane compacts; main keeps them and adds T-D-01.
function repro(mergeTasks, manifestCount = 3) {
  return mkMergeFixture({
    baseFiles: { "tasks.md": ROWS3 },
    p1Files: { "tasks.md": ROWS3 + NEW_ROW },
    p2Files: { "tasks.md": MANIFEST(manifestCount) },
    mergeFiles: { "tasks.md": mergeTasks },
  });
}
const ids = (list) => list.map((x) => x.taskId).sort();
const hasCReason = (m) => m.reasons.some((r) => /\(c\) manifest under-reconciles/.test(r));

test("E203 AC-E203-1: compaction on one side plus a new row the merge keeps passes; only T-A-01..03 are COMPACTED", () => {
  const { root, merge } = repro(`${MANIFEST(3)}## Wave\n${NEW_ROW}`);
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `a kept new row is not a loss; report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), []);
  assert.deepEqual(ids(result.findings.lostCompletions), []);
  assert.deepEqual(ids(result.findings.compacted), ["T-A-01", "T-A-02", "T-A-03"]);
});

test("E203 AC-E203-3: the merge dropping the new row still FAILs, all four ids MISSING with the (c) reason", () => {
  const { root, merge } = repro(MANIFEST(3));
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `a real loss must not pass; report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), ["T-A-01", "T-A-02", "T-A-03", "T-D-01"]);
  for (const m of result.findings.missing) assert.ok(hasCReason(m), `${m.taskId} carries the (c) reason: ${m.reasons.join(" | ")}`);
});

test("E203 AC-E203-4: an under-counting manifest with the new row kept FAILs with exactly T-A-01..03 MISSING", () => {
  // WHY: only genuinely compacted rows are exempted; the kept new row neither counts toward the union nor absorbs the shortfall.
  const { root, merge } = repro(`${MANIFEST(2)}## Wave\n${NEW_ROW}`, 2);
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), ["T-A-01", "T-A-02", "T-A-03"]);
  assert.ok(!ids(result.findings.compacted).includes("T-D-01"), "T-D-01 is never COMPACTED");
});

test("E203 AC-E203-6: a kept compacted row never frees a manifest slot for a dropped new row", () => {
  const { root, merge } = repro(`${MANIFEST(3)}## Wave\n- [x] T-A-03 c\n`);
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `dropping T-D-01 must not pass; report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), ["T-A-01", "T-A-02", "T-D-01"]);
  for (const m of result.findings.missing) assert.ok(hasCReason(m), `${m.taskId} carries the (c) reason`);
  assert.ok(!ids(result.findings.compacted).includes("T-A-03"), "T-A-03 is kept, not COMPACTED");
});

test("E203 AC-E203-7: a base row moved to another section by the compacting side leaves the union; PASS with COMPACTED T-A-01..03", () => {
  // WHY: rule (ii) — the manifest-carrying parent still holds T-A-04 (elsewhere), so the manifest cannot have counted it.
  const rows4 = `${ROWS3}- [x] T-A-04 d\n`;
  const p2Tasks = `${MANIFEST(3)}## Other\n- [x] T-A-04 d\n`;
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": rows4 },
    p1Files: { "tasks.md": rows4 },
    p2Files: { "tasks.md": p2Tasks },
    mergeFiles: { "tasks.md": p2Tasks },
  });
  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.deepEqual(ids(result.findings.missing), []);
  assert.deepEqual(ids(result.findings.compacted), ["T-A-01", "T-A-02", "T-A-03"]);
});
