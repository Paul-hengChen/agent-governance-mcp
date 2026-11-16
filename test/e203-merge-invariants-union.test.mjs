// Coded by @qa-engineer
// E203: merge-invariants (c) drops a kept row from the union only when the manifest cannot have counted it
// (specs/e126-merge-invariants.md (c); specs/e406-release-and-merge-scripts.md AC-E203-1..7).
// WHY: a compaction on one side plus a NEW closed row kept by the merge must not fail as a loss, yet a merge
// that really drops a row must still fail. The R-1 5-vs-4 case in test/e126-merge-invariants.test.mjs stays
// the unchanged AC-E203-2 guard; the cherry-pick-shaped false negative is an accepted spec-stated limit.

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

// E417 repro (specs/e126-merge-invariants.md AC12): the compacting side's multi-commit path is built with
// commitTree so its pre-compaction rows exist only in history between the merge-base and that parent.
const A04 = "- [x] T-A-04 d\n";
const assertE417Fail = (result, expectedMissing) => {
  assert.equal(result.code, "FAIL", `a dropped row must not pass; report:\n${result.report}`);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(ids(result.findings.missing), expectedMissing);
  for (const m of result.findings.missing) assert.ok(hasCReason(m), `${m.taskId} carries the (c) reason: ${m.reasons.join(" | ")}`);
  assert.ok(!ids(result.findings.missing).includes("T-A-04"), "T-A-04 is never MISSING");
  assert.ok(!ids(result.findings.compacted).includes("T-A-04"), "T-A-04 is never COMPACTED");
};

// Accepted-limit pins (spec step 9): ambiguous by construction, so they keep the snapshot-only PASS.
const assertE417Pass = (result) => {
  assert.equal(result.code, "PASS", `report:\n${result.report}`);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(ids(result.findings.missing), []);
};

test("E417 R1: a row the compacting side added after the merge-base and summarized does not free a slot for a dropped row (case 1)", () => {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + NEW_ROW }, [base], "parent1");
  const merge = commitTree(root, { "tasks.md": MANIFEST(4) }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Fail(result, ["T-A-01", "T-A-02", "T-A-03", "T-D-01"]);
  for (const m of result.findings.missing) {
    assert.ok(
      m.reasons.some((r) => /includes 1 row\(s\) read from parent2 history after the merge-base/.test(r)),
      `${m.taskId} reason names the history row: ${m.reasons.join(" | ")}`,
    );
  }
});

test("E417 R2: case 2 (the non-compacting side moved a base row out of the section) stays an accepted limit and passes", () => {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 + A04 }, [], "base");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [base], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": `${ROWS3}${NEW_ROW}## Other\n${A04}` }, [base], "parent1: move T-A-04, add T-D-01");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(4)}## Other\n${A04}` }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Pass(result);
});

test("E417 R3: the cherry-pick shape (the summarized row is also in the other side's tip) stays an accepted limit and passes", () => {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + A04 + NEW_ROW }, [base], "parent1: add T-A-04 and T-D-01");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(4)}## Wave\n${A04}` }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Pass(result);
});

test("E417 R4: a section compacted twice on the compacting side's path does not free a slot for a dropped row", () => {
  const root = mkRepo();
  const rows2 = "## Wave\n- [x] T-A-01 a\n- [x] T-A-02 b\n";
  const base = commitTree(root, { "tasks.md": rows2 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": MANIFEST(2) }, [base], "parent2: compact");
  const c2 = commitTree(root, { "tasks.md": `${MANIFEST(2)}## Wave\n- [x] T-A-03 c\n` }, [c1], "parent2: add T-A-03");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(3) }, [c2], "parent2: re-compact");
  const p1 = commitTree(root, { "tasks.md": rows2 + NEW_ROW }, [base], "parent1");
  const merge = commitTree(root, { "tasks.md": MANIFEST(3) }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Fail(result, ["T-A-01", "T-A-02", "T-D-01"]);
});

test("E417 R5: a compaction reached through a merge commit on the compacting side's path still counts against a dropped row", () => {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const s1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "side: add T-A-04");
  const s2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [s1], "side: compact");
  const l1 = commitTree(root, { "tasks.md": ROWS3, "unrelated.txt": "x\n" }, [base], "line: unrelated change");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4), "unrelated.txt": "x\n" }, [l1, s2], "parent2: merge side");
  const p1 = commitTree(root, { "tasks.md": ROWS3 + NEW_ROW }, [base], "parent1");
  const merge = commitTree(root, { "tasks.md": MANIFEST(4), "unrelated.txt": "x\n" }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Fail(result, ["T-A-01", "T-A-02", "T-A-03", "T-D-01"]);
});

const MANIFEST_DV = (d, v) =>
  `## Compacted History\n<!-- compacted: e203-fixture 2026-11-10 — 1 sections, ${d} [x] rows, ${v} [-] rows summarized below -->\n- Wave: ${d} done, ${v} voided\n`;

test("E417 R6: a voided row the compacting side added after the merge-base and summarized does not free a voided slot for a dropped voided row", () => {
  const root = mkRepo();
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": `${ROWS3}- [-] T-A-04 d\n` }, [base], "parent2: add voided T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST_DV(3, 1) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": `${ROWS3}- [-] T-D-01 added by main\n` }, [base], "parent1: add voided T-D-01");
  const merge = commitTree(root, { "tasks.md": MANIFEST_DV(3, 1) }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Fail(result, ["T-A-01", "T-A-02", "T-A-03", "T-D-01"]);
});

test("E417 R7: a completion on the other side is not hidden in the voided count when the compacting side also summarized a post-base row", () => {
  const root = mkRepo();
  const baseRows = "## Wave\n- [x] T-A-01 a\n- [x] T-A-02 b\n- [-] T-A-03 c\n";
  const base = commitTree(root, { "tasks.md": baseRows }, [], "base");
  const c1 = commitTree(root, { "tasks.md": baseRows + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST_DV(3, 1) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": ROWS3 }, [base], "parent1: complete T-A-03");
  const merge = commitTree(root, { "tasks.md": MANIFEST_DV(3, 1) }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Fail(result, ["T-A-01", "T-A-02", "T-A-03"]);
});

test("E417 R8: a merge that lowers the count for a reopened row still fails when a post-base summarized row and a dropped row both need slots", () => {
  const root = mkRepo();
  const reopened = "## Wave\n- [x] T-A-01 a\n- [x] T-A-02 b\n- [ ] T-A-03 c\n";
  const base = commitTree(root, { "tasks.md": ROWS3 }, [], "base");
  const c1 = commitTree(root, { "tasks.md": ROWS3 + A04 }, [base], "parent2: add T-A-04");
  const p2 = commitTree(root, { "tasks.md": MANIFEST(4) }, [c1], "parent2: compact");
  const p1 = commitTree(root, { "tasks.md": reopened + NEW_ROW }, [base], "parent1: reopen T-A-03, add T-D-01");
  const merge = commitTree(root, { "tasks.md": `${MANIFEST(3)}## Wave\n- [ ] T-A-03 c\n` }, [p1, p2], "merge");
  const result = runMergeInvariants(merge, root);
  assertE417Fail(result, ["T-A-01", "T-A-02", "T-D-01"]);
});
