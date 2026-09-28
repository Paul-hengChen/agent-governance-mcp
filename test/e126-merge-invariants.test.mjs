// Coded by @qa-engineer
// T-E126-05 — tests for tools/merge-invariants.ts (specs/e126-merge-invariants.md,
// AMENDED at commit e405de8, human-approved). The amendment revised condition
// (c) of the Compaction exemption to reconcile over the UNION of distinct
// closed task_ids across BOTH parents (not per-parent, code-review round 1's
// R-1 finding), required ledger-line trimming to match tools/tasks-file.ts
// (R-2), and required the informational COMPACTED breakdown to dedup by
// task_id rather than raw parent x file occurrences (Q-1).
//
// The implementation under test (eed6689) PREDATES this amendment. Per the
// qa dispatch brief, the following cases are EXPECTED TO FAIL against the
// current code — that is the correct, intended outcome of this qa round, not
// a test-authoring mistake:
//   - "AC11: a merge that compacts S while both parents added different
//     closed rows exceeding the manifest count reports every row MISSING,
//     exit 1 (R-1 5-vs-4 fixture)" (the amended (c) union rule)
//   - "R-2: an indented checkbox row that is a genuine, tasks-file.ts-visible
//     row must not be silently invisible to merge-invariants"
//   - "Q-1: the informational COMPACTED breakdown must dedup by task_id,
//     matching the header count, not double-count a row held in both parents"
// Every other case below is already implemented (code-reviewer T-E126-01..04,
// review_reports/review_T-E126-01.md) and is expected to PASS today.
//
// Every fixture is a REAL, throwaway git repo built under os.tmpdir() (never
// inside this repo) via `git commit-tree` against explicitly constructed
// trees — this gives full, deterministic control over what each of
// parent1/parent2/merge-base/merge contains without needing an actual
// conflict-resolution session, while still exercising the tool's real
// `git ls-tree` / `git cat-file` read path (tools/merge-invariants.ts never
// reads the working directory). Merge-base is always the real, single common
// ancestor commit unless a fixture explicitly builds two disconnected
// histories (AC7).
//
// Spec-to-Test map (`## Task -> AC Coverage`, T-E126-05 row):
//   AC1  -> "AC1: row dropped by a bad merge is reported MISSING"
//   AC2  -> "AC2: [x] regressed to [ ] across a merge is reported"
//   AC3  -> "AC3: sidecar record shortfall is reported with counts"
//   AC4  -> "AC4: a row relocated by migration/finish --shipped is not a false MISSING"
//   AC5  -> "AC5: every offending MISSING/LOST_DONE/SIDECAR_SHORTFALL item is printed, exit 1"
//   AC6  -> "AC6: non-merge commit exits NOT_A_MERGE_COMMIT" (0, 1, 3 parents)
//   AC7  -> "AC7: unrelated histories exit NO_MERGE_BASE"
//   AC8  -> "AC8: clean merge exits 0"
//   AC9  -> "AC9: bad ref / non-repo / usage errors exit USAGE_ERROR"
//   AC11 -> four counter-example tests + one clean-compaction test (see below)

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import {
  runMergeInvariants,
  runMergeInvariantsCli,
} from "../dist/tools/merge-invariants.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** A fresh, throwaway repo under os.tmpdir() — never inside this repo. */
function mkRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "e126-merge-invariants-"));
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "a@b.c"], { cwd: root });
  execFileSync("git", ["config", "user.name", "t"], { cwd: root });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root });
  return root;
}

/**
 * Wipe the index+working tree of `root` (if anything is tracked) then write
 * exactly `files` (a { path: content } map), and produce a commit object
 * with the given `parents` (a list of full/short shas) via `commit-tree` —
 * never `git checkout`/`git commit`, so this never depends on which branch
 * (if any) is checked out. Returns the new commit's full sha.
 */
function commitTree(root, files, parents, message) {
  if (parents.length > 0) {
    git(["rm", "-rq", "--ignore-unmatch", "-f", "."], root);
  }
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(root, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  git(["add", "-A"], root);
  const treeSha = git(["write-tree"], root);
  const parentArgs = parents.flatMap((p) => ["-p", p]);
  return git(["commit-tree", treeSha, ...parentArgs, "-m", message], root);
}

/**
 * Standard base -> {parent1, parent2} -> merge shape: parent1 and parent2
 * both descend directly from `base`, so `git merge-base` resolves to `base`
 * itself. Returns { root, base, p1, p2, merge }.
 */
function mkMergeFixture({ baseFiles = {}, p1Files, p2Files, mergeFiles }) {
  const root = mkRepo();
  const base = commitTree(root, baseFiles, [], "base");
  const p1 = commitTree(root, p1Files, [base], "parent1");
  const p2 = commitTree(root, p2Files, [base], "parent2");
  const merge = commitTree(root, mergeFiles, [p1, p2], "merge");
  return { root, base, p1, p2, merge };
}

function jsonlLines(n) {
  return "{}\n".repeat(n);
}

// =============================================================================
// AC1 — row presence: dropped by a bad merge -> MISSING
// =============================================================================

test("AC1: row dropped by a bad merge is reported MISSING", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "README.md": "base\n" },
    p1Files: {
      "README.md": "base\n",
      "tasks.md": "## Active\n- [ ] T-BAD-01 a row that a bad merge will drop\n",
    },
    p2Files: { "README.md": "base\n", "unrelated.txt": "p2 side change\n" },
    mergeFiles: { "README.md": "base\n", "unrelated.txt": "p2 side change\n" }, // T-BAD-01 dropped, no manifest at all
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `expected FAIL; report:\n${result.report}`);
  assert.equal(result.findings.missing.length, 1);
  assert.equal(result.findings.missing[0].taskId, "T-BAD-01");
  assert.match(result.report, /MISSING T-BAD-01 — found at:.*parent1/);
  assert.match(result.report, /RESULT: FAIL — 1 offending item\(s\): 1 MISSING, 0 LOST_DONE, 0 SIDECAR_SHORTFALL/);
});

// =============================================================================
// AC2 — [x] preservation: regressed to [ ] across a merge -> LOST_DONE
// =============================================================================

test("AC2: [x] regressed to [ ] across a merge is reported", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Active\n- [ ] T-Y-01 will be completed then regressed\n" },
    p1Files: { "tasks.md": "## Active\n- [x] T-Y-01 will be completed then regressed\n" },
    p2Files: { "tasks.md": "## Active\n- [ ] T-Y-01 will be completed then regressed\n" },
    mergeFiles: { "tasks.md": "## Active\n- [ ] T-Y-01 will be completed then regressed\n" }, // regressed back to [ ]
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `expected FAIL; report:\n${result.report}`);
  assert.equal(result.findings.lostCompletions.length, 1);
  assert.equal(result.findings.lostCompletions[0].taskId, "T-Y-01");
  assert.equal(result.findings.missing.length, 0, "a present-but-regressed row is LOST_DONE, never MISSING");
  assert.match(result.report, /LOST_DONE T-Y-01 — \[x\] at:.*parent1/);
});

// =============================================================================
// AC3 — sidecar record count: shortfall reported with all three counts
// =============================================================================

test("AC3: sidecar record shortfall is reported with counts", () => {
  const root = mkRepo();
  const base = commitTree(root, { ".current/e999/telemetry.jsonl": jsonlLines(2) }, [], "base");
  const p1 = commitTree(root, { ".current/e999/telemetry.jsonl": jsonlLines(5) }, [base], "parent1");
  const p2 = commitTree(root, { ".current/e999/telemetry.jsonl": jsonlLines(2) }, [base], "parent2");
  // expectedMin = p1(5) + p2(2) - base(2) = 5; merge only has 3 -> shortfall.
  const merge = commitTree(root, { ".current/e999/telemetry.jsonl": jsonlLines(3) }, [p1, p2], "merge");

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `expected FAIL; report:\n${result.report}`);
  assert.equal(result.findings.sidecarShortfalls.length, 1);
  const s = result.findings.sidecarShortfalls[0];
  assert.equal(s.kind, "telemetry");
  assert.equal(s.lane, "e999");
  assert.equal(s.merge, 3);
  assert.equal(s.parent1, 5);
  assert.equal(s.parent2, 2);
  assert.equal(s.base, 2);
  assert.equal(s.expectedMin, 5);
  assert.match(
    result.report,
    /SIDECAR_SHORTFALL kind=telemetry lane=e999 merge=3 < parent1=5 \+ parent2=2 - base=2 = 5/,
  );
});

// =============================================================================
// AC4 — relocation (migration / finish --shipped) is never a false MISSING
// =============================================================================

test("AC4: a row relocated by migration/finish --shipped is not a false MISSING", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: {
      "tasks.md": "## Active\n- [x] T-Z-01 root ledger row, later migrated to _primary\n",
      ".current/e999x/tasks.md": "## Active\n- [x] T-H-01 lane row, later shipped to history\n",
    },
    p1Files: {
      "tasks.md": "## Active\n- [x] T-Z-01 root ledger row, later migrated to _primary\n",
      ".current/e999x/tasks.md": "## Active\n- [x] T-H-01 lane row, later shipped to history\n",
    },
    p2Files: { "unrelated.txt": "p2 side change\n" },
    mergeFiles: {
      // root -> _primary migration (tools/tasks-lane-migrate.ts shape)
      ".current/_primary/tasks.md": "## Active\n- [x] T-Z-01 root ledger row, later migrated to _primary\n",
      // lane -> history bucket (agc feature finish --shipped shape)
      ".current/history/2026-09/e999x/tasks.md": "## Active\n- [x] T-H-01 lane row, later shipped to history\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `relocation must never be a false MISSING; report:\n${result.report}`);
  assert.equal(result.findings.missing.length, 0);
  assert.equal(result.findings.lostCompletions.length, 0);
  assert.doesNotMatch(result.report, /MISSING T-Z-01/);
  assert.doesNotMatch(result.report, /MISSING T-H-01/);
  assert.doesNotMatch(result.report, /LOST_DONE T-Z-01/);
  assert.doesNotMatch(result.report, /LOST_DONE T-H-01/);
});

// =============================================================================
// AC5 — every offending item is printed (never a single FAIL line)
// =============================================================================

test("AC5: every offending MISSING/LOST_DONE/SIDECAR_SHORTFALL item is printed, exit 1", () => {
  const root = mkRepo();
  const base = commitTree(
    root,
    {
      "tasks.md": "## Active\n- [ ] T-M-01 will be dropped\n- [ ] T-L-01 will be completed then regressed\n",
      ".current/e888/telemetry.jsonl": jsonlLines(1),
    },
    [],
    "base",
  );
  const p1 = commitTree(
    root,
    {
      "tasks.md": "## Active\n- [ ] T-M-01 will be dropped\n- [x] T-L-01 will be completed then regressed\n",
      ".current/e888/telemetry.jsonl": jsonlLines(4),
    },
    [base],
    "parent1",
  );
  const p2 = commitTree(
    root,
    {
      "tasks.md": "## Active\n- [ ] T-M-01 will be dropped\n- [ ] T-L-01 will be completed then regressed\n",
      ".current/e888/telemetry.jsonl": jsonlLines(1),
    },
    [base],
    "parent2",
  );
  const merge = commitTree(
    root,
    {
      // T-M-01 dropped entirely; T-L-01 present but regressed to [ ]; sidecar short.
      "tasks.md": "## Active\n- [ ] T-L-01 will be completed then regressed\n",
      ".current/e888/telemetry.jsonl": jsonlLines(2), // expectedMin = 4+1-1 = 4, merge has 2
    },
    [p1, p2],
    "merge",
  );

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `expected FAIL; report:\n${result.report}`);
  assert.equal(result.findings.missing.length, 1);
  assert.equal(result.findings.lostCompletions.length, 1);
  assert.equal(result.findings.sidecarShortfalls.length, 1);
  assert.match(result.report, /MISSING T-M-01/);
  assert.match(result.report, /LOST_DONE T-L-01/);
  assert.match(result.report, /SIDECAR_SHORTFALL kind=telemetry lane=e888/);
  assert.match(result.report, /RESULT: FAIL — 3 offending item\(s\): 1 MISSING, 1 LOST_DONE, 1 SIDECAR_SHORTFALL/);
  assert.doesNotMatch(result.report, /^RESULT: FAIL\s*$/m, "must never collapse to a single bare FAIL line");
});

// =============================================================================
// AC6 — non-merge commit (0, 1, or >=3 parents) -> NOT_A_MERGE_COMMIT
// =============================================================================

test("AC6: non-merge commit exits NOT_A_MERGE_COMMIT", () => {
  const root = mkRepo();
  const root0 = commitTree(root, { "README.md": "root\n" }, [], "root commit (0 parents)");
  const ordinary = commitTree(root, { "README.md": "root\nsecond\n" }, [root0], "ordinary commit (1 parent)");
  const sideA = commitTree(root, { "a.txt": "a\n" }, [root0], "side A");
  const sideB = commitTree(root, { "b.txt": "b\n" }, [root0], "side B");
  const sideC = commitTree(root, { "c.txt": "c\n" }, [root0], "side C");
  const octopus = commitTree(root, { "octopus.txt": "x\n" }, [sideA, sideB, sideC], "octopus merge (3 parents)");

  const r0 = runMergeInvariants(root0, root);
  assert.equal(r0.code, "NOT_A_MERGE_COMMIT");
  assert.match(r0.report, /NOT_A_MERGE_COMMIT.*has 0 parent\(s\)/);

  const r1 = runMergeInvariants(ordinary, root);
  assert.equal(r1.code, "NOT_A_MERGE_COMMIT");
  assert.match(r1.report, /NOT_A_MERGE_COMMIT.*has 1 parent\(s\)/);

  const r3 = runMergeInvariants(octopus, root);
  assert.equal(r3.code, "NOT_A_MERGE_COMMIT");
  assert.match(r3.report, /NOT_A_MERGE_COMMIT.*has 3 parent\(s\)/);
});

// =============================================================================
// AC7 — unrelated histories (no merge-base) -> NO_MERGE_BASE
// =============================================================================

test("AC7: unrelated histories exit NO_MERGE_BASE", () => {
  const root = mkRepo();
  const historyA = commitTree(root, { "a.txt": "history A\n" }, [], "disconnected history A (root)");
  const historyB = commitTree(root, { "b.txt": "history B\n" }, [], "disconnected history B (root)");
  const merge = commitTree(root, { "a.txt": "history A\n", "b.txt": "history B\n" }, [historyA, historyB], "merge of unrelated histories");

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "NO_MERGE_BASE");
  assert.match(result.report, /NO_MERGE_BASE — parents .* share no common ancestor/);
});

// =============================================================================
// AC8 — clean merge -> exit 0, summary confirming all three invariants held
// =============================================================================

test("AC8: clean merge exits 0", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Active\n- [x] T-CLEAN-01 already done\n" },
    p1Files: { "tasks.md": "## Active\n- [x] T-CLEAN-01 already done\n- [ ] T-CLEAN-02 added by parent1\n" },
    p2Files: { "tasks.md": "## Active\n- [x] T-CLEAN-01 already done\n- [ ] T-CLEAN-03 added by parent2\n" },
    mergeFiles: {
      "tasks.md":
        "## Active\n- [x] T-CLEAN-01 already done\n- [ ] T-CLEAN-02 added by parent1\n- [ ] T-CLEAN-03 added by parent2\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `expected PASS; report:\n${result.report}`);
  assert.equal(result.findings.missing.length, 0);
  assert.equal(result.findings.lostCompletions.length, 0);
  assert.equal(result.findings.sidecarShortfalls.length, 0);
  assert.match(result.report, /RESULT: PASS — all three invariants held/);
});

// =============================================================================
// AC9 — bad ref / non-repo / usage errors -> USAGE_ERROR
// =============================================================================

test("AC9: bad ref / non-repo / usage errors exit USAGE_ERROR", () => {
  const root = mkRepo();
  commitTree(root, { "README.md": "x\n" }, [], "init");
  const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), "e126-not-a-repo-"));

  const badRef = runMergeInvariants("bogus-ref-xyz", root);
  assert.equal(badRef.code, "USAGE_ERROR");
  assert.match(badRef.report, /cannot resolve ref "bogus-ref-xyz"/);

  const nonRepo = runMergeInvariants("HEAD", notARepo);
  assert.equal(nonRepo.code, "USAGE_ERROR");
  assert.match(nonRepo.report, /is not a git repository/);

  const emptyRef = runMergeInvariants("", root);
  assert.equal(emptyRef.code, "USAGE_ERROR");

  // CLI argv edge cases (runMergeInvariantsCli, T-E126-03 surface).
  const missingRefValue = runMergeInvariantsCli(["--ref"], root);
  assert.equal(missingRefValue.code, "USAGE_ERROR");

  const unknownOption = runMergeInvariantsCli(["--upload-pack=x"], root);
  assert.equal(unknownOption.code, "USAGE_ERROR");

  const refLooksLikeOption = runMergeInvariantsCli(["--ref", "-x"], root);
  assert.equal(refLooksLikeOption.code, "USAGE_ERROR", "a --ref value that itself looks like an option must be rejected, not passed to git");
});

// =============================================================================
// AC11 — Compaction exemption + four counter-examples
// =============================================================================

// --- clean compaction sanity (the exemption applying correctly) ------------

test("AC11: a real compaction merge exits 0 with an informational COMPACTED count", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Active\n- [x] T-OK-01 a\n- [x] T-OK-02 b\n" },
    p1Files: { "tasks.md": "## Active\n- [x] T-OK-01 a\n- [x] T-OK-02 b\n" },
    p2Files: { "tasks.md": "## Active\n- [x] T-OK-01 a\n- [x] T-OK-02 b\n" },
    mergeFiles: {
      "tasks.md":
        "## Compacted History\n<!-- compacted: clean 2026-09-27 — 1 sections, 2 [x] rows, 0 [-] rows summarized below; ... -->\n- Active: 2 done, 0 voided\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `expected PASS; report:\n${result.report}`);
  assert.equal(result.findings.missing.length, 0);
  assert.match(result.report, /COMPACTED \(informational\): 2 row\(s\) summarized/);
});

// --- counter-example (i): open row under a compaction marker -> MISSING (a) ---

test("AC11: an open row dropped under a compaction marker is MISSING, exit 1", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Active\n" },
    p1Files: { "tasks.md": "## Active\n- [ ] T-OPEN-01 an open row, never compaction-eligible\n" },
    p2Files: { "tasks.md": "## Active\n" },
    mergeFiles: {
      "tasks.md":
        "## Compacted History\n<!-- compacted: i-fixture 2026-09-27 — 1 sections, 0 [x] rows, 0 [-] rows summarized below; ... -->\n- Active: 0 done, 0 voided\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `expected FAIL; report:\n${result.report}`);
  assert.equal(result.findings.missing.length, 1);
  assert.equal(result.findings.missing[0].taskId, "T-OPEN-01");
  assert.match(result.report, /MISSING T-OPEN-01/);
  assert.match(result.report, /not compacted: \(a\) open \[ \] row/);
});

// --- counter-example (ii): count reconciliation fails -> every un-found row listed individually ---

test("AC11: a failed count reconciliation lists every un-found row of that section by task_id, exit 1", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Active\n" },
    p1Files: {
      "tasks.md": "## Active\n- [x] T-RECON-01 a\n- [x] T-RECON-02 b\n- [x] T-RECON-03 c\n",
    },
    p2Files: { "tasks.md": "## Active\n" },
    mergeFiles: {
      // manifest under-counts: 2 done, but parent1's Active section actually has 3.
      "tasks.md":
        "## Compacted History\n<!-- compacted: ii-fixture 2026-09-27 — 1 sections, 2 [x] rows, 0 [-] rows summarized below; ... -->\n- Active: 2 done, 0 voided\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `expected FAIL; report:\n${result.report}`);
  const missingIds = result.findings.missing.map((m) => m.taskId).sort();
  assert.deepEqual(missingIds, ["T-RECON-01", "T-RECON-02", "T-RECON-03"], "every un-found row of the section must be listed individually, never aggregated");
  for (const id of missingIds) {
    assert.match(result.report, new RegExp(`MISSING ${id}[\\s\\S]*?not compacted: \\(c\\) manifest under-reconciles`));
  }
});

// --- counter-example (iii): recycled section name (R1) -> MISSING (d) -----

test("AC11: a row added under an already-compacted section name is MISSING when dropped, exit 1 (R1 counter-example)", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Active\n" },
    p1Files: {
      // parent1's OWN ledger already carries a historical compaction of
      // "Active" (400 rows) — the recycled-label trap — and a brand-new [x]
      // row was added under the still-live "## Active" heading afterward.
      "tasks.md":
        "## Active\n- [x] T-RECYCLE-01 new row added after historical compaction\n\n" +
        "## Compacted History\n<!-- compacted: iii-fixture 2026-09-27 — 1 sections, 400 [x] rows, 0 [-] rows summarized below; ... -->\n- Active: 400 done, 0 voided\n",
    },
    p2Files: { "tasks.md": "## Active\n" },
    mergeFiles: {
      // The merge further compacts, and the count reconciles fine numerically
      // (401 = 400 + 1) — but (d) must still bar the exemption.
      "tasks.md":
        "## Compacted History\n<!-- compacted: iii-fixture-merge 2026-09-27 — 1 sections, 401 [x] rows, 0 [-] rows summarized below; ... -->\n- Active: 401 done, 0 voided\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "FAIL", `expected FAIL; report:\n${result.report}`);
  assert.equal(result.findings.missing.length, 1);
  assert.equal(result.findings.missing[0].taskId, "T-RECYCLE-01");
  assert.match(result.report, /not compacted: \(d\) "Active" was already compacted in tasks\.md at parent1/);
});

// --- counter-example (iv): R-1 cross-parent UNION (the amendment's fix) ---
// EXPECTED TO FAIL against the pre-amendment implementation: (c) is
// evaluated per-parent (compactionIneligibility's `actual` is
// `sectionCounts(parentSnap...)`, tools/merge-invariants.ts:332), so each
// side's own 4-row count independently satisfies a manifest of "4 done" even
// though the union across both parents is 5 distinct ids. The amended spec
// requires this to be a MISSING x5 / exit 1; the current code reports
// COMPACTED x5 / exit 0 (silent loss).

test("AC11: a merge that compacts S while both parents added different closed rows exceeding the manifest count reports every row MISSING, exit 1 (R-1 5-vs-4 fixture)", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: {
      "tasks.md": "## Active\n- [x] T-U-01 a\n- [x] T-U-02 b\n- [x] T-U-03 c\n",
    },
    p1Files: {
      // main: keeps the 3 base rows, adds its own new closed row.
      "tasks.md": "## Active\n- [x] T-U-01 a\n- [x] T-U-02 b\n- [x] T-U-03 c\n- [x] T-U-04 added by parent1\n",
    },
    p2Files: {
      // side lane: keeps the 3 base rows, adds a DIFFERENT new closed row.
      "tasks.md": "## Active\n- [x] T-U-01 a\n- [x] T-U-02 b\n- [x] T-U-03 c\n- [x] T-U-05 added by parent2\n",
    },
    mergeFiles: {
      // The merge itself compacts "Active" — but the manifest says 4 done,
      // when the true distinct union (01,02,03,04,05) is 5.
      "tasks.md":
        "## Compacted History\n<!-- compacted: iv-fixture 2026-09-27 — 1 sections, 4 [x] rows, 0 [-] rows summarized below; ... -->\n- Active: 4 done, 0 voided\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(
    result.code,
    "FAIL",
    `AMENDED SPEC (e405de8): the union of distinct closed ids under Active across both parents is 5 ` +
      `(T-U-01..05), exceeding the manifest's declared 4 -- reconciliation must fail and every one of the 5 ` +
      `must be reported MISSING, exit 1. EXPECTED-RED against the pre-amendment implementation, which checks ` +
      `(c) per-parent (tools/merge-invariants.ts:332 sectionCounts(parentSnap...)) and independently finds each ` +
      `parent's own 4-row count satisfies the manifest's 4, wrongly reporting all 5 as COMPACTED, exit 0 ` +
      `(silent loss — see code-review round 1 R-1, and the amended spec's (c) union paragraph). ` +
      `Actual result: code=${result.code}, compacted=${result.findings.compacted.map((c) => c.taskId).sort().join(",")}, ` +
      `missing=${result.findings.missing.map((m) => m.taskId).sort().join(",")}`,
  );
  const missingIds = result.findings.missing.map((m) => m.taskId).sort();
  assert.deepEqual(
    missingIds,
    ["T-U-01", "T-U-02", "T-U-03", "T-U-04", "T-U-05"],
    "every one of the 5 distinct union ids must be reported MISSING individually, per the amended spec's R2 disposition",
  );
});

// =============================================================================
// R-2 (spec amendment) — ledger-line trimming must match tools/tasks-file.ts
// =============================================================================
// EXPECTED TO FAIL against the current implementation: parseLedger
// (tools/merge-invariants.ts:140-170) tests VOID_PREFIX_RE and the task regex
// against the RAW (untrimmed) line, so an indented checkbox row — which
// tools/tasks-file.ts's own row parser tolerates via `line.trim()`
// (tools/tasks-file.ts:216/703) and therefore treats as a real, counted row
// — never matches at all. The row is invisible in EVERY commit snapshot that
// contains it, so its disappearance across a merge produces zero findings
// instead of a MISSING report: a silent loss, exactly the shape this whole
// feature exists to catch.

test("R-2: an indented checkbox row that is tasks-file.ts-visible must not be silently invisible to merge-invariants when dropped by a merge", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Active\n" },
    p1Files: {
      "tasks.md":
        "## Active\n" +
        "  - [x] T-IND-01 indented row, real per tools/tasks-file.ts's line.trim()\n" +
        "- [x] T-CTRL-01 unindented control row, must still be found\n",
    },
    p2Files: { "tasks.md": "## Active\n" },
    mergeFiles: {
      // Both rows dropped from the merge; T-CTRL-01 is the ordinary AC1 case
      // (must be reported), T-IND-01 is the R-2 case under test.
      "tasks.md": "## Active\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  const missingIds = result.findings.missing.map((m) => m.taskId).sort();
  assert.ok(
    missingIds.includes("T-CTRL-01"),
    `sanity check: the unindented control row must be reported MISSING (fixture is otherwise sound); report:\n${result.report}`,
  );
  assert.ok(
    missingIds.includes("T-IND-01"),
    "R-2 (amended spec): an indented checkbox row is a real row to tools/tasks-file.ts and must not be " +
      "invisible here — EXPECTED-RED against the pre-amendment implementation, which never trims the raw " +
      "line before matching (tools/merge-invariants.ts parseLedger), so its disappearance across this merge " +
      `produces no finding at all. Actual missing ids: ${missingIds.join(",") || "(none)"}`,
  );
});

// =============================================================================
// Q-1 (spec amendment) — COMPACTED breakdown must dedup by task_id
// =============================================================================
// EXPECTED TO FAIL against the current implementation: renderMergeInvariantsReport
// (tools/merge-invariants.ts:447-457) increments the file/section breakdown
// once per PARENT OCCURRENCE, not once per distinct task_id. A task_id held
// identically (unchanged) in both parents' copies of the same file/section
// is counted twice in the breakdown even though the header count (deduped by
// task_id, one `compacted` array entry per id) says otherwise — the
// breakdown must sum to the header, per the amended spec.

test("Q-1: the informational COMPACTED breakdown dedups by task_id, matching the header count", () => {
  const { root, merge } = mkMergeFixture({
    baseFiles: { "tasks.md": "## Legacy\n- [x] T-DUP-01 unchanged in both parents\n" },
    p1Files: { "tasks.md": "## Legacy\n- [x] T-DUP-01 unchanged in both parents\n" },
    p2Files: { "tasks.md": "## Legacy\n- [x] T-DUP-01 unchanged in both parents\n" },
    mergeFiles: {
      "tasks.md":
        "## Compacted History\n<!-- compacted: q1-fixture 2026-09-27 — 1 sections, 1 [x] rows, 0 [-] rows summarized below; ... -->\n- Legacy: 1 done, 0 voided\n",
    },
  });

  const result = runMergeInvariants(merge, root);
  assert.equal(result.code, "PASS", `expected PASS (this is a valid compaction, not a MISSING case); report:\n${result.report}`);
  assert.equal(result.findings.compacted.length, 1, "header count is deduped by task_id: exactly 1 distinct row");
  assert.match(result.report, /COMPACTED \(informational\): 1 row\(s\) summarized/);

  const breakdownMatch = result.report.match(/^ {2}tasks\.md § Legacy: (\d+)$/m);
  assert.ok(breakdownMatch, `expected a "tasks.md § Legacy: N" breakdown line; report:\n${result.report}`);
  assert.equal(
    breakdownMatch[1],
    "1",
    "Q-1 (amended spec): the breakdown must dedup by task_id and sum to the header's row count (1) — " +
      "EXPECTED-RED against the pre-amendment implementation, which increments the breakdown once per parent " +
      "occurrence (tools/merge-invariants.ts:449-452) and therefore reports 2 for a row held unchanged in both " +
      `parents. Actual breakdown value: ${breakdownMatch[1]}`,
  );
});
