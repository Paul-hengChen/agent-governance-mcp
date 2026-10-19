// Coded by @qa-engineer
// Tests for specs/e297-main-protected-sop.md (ticket E297). Pins the AC1-AC10 grep proofs as
// content assertions: a protected default branch moves only by pull request merge, so the
// integrator Stage 6, release-engineer 8a-8c/13a-13b and Constitution section 6 must say so,
// and the integrator must run on the fable tier. AC6 (verify-release.mjs unchanged) and AC11
// (full suite green) are git/suite checks run by QA, not content tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const INTEGRATOR = read("content", "skill-integrator.md");
const RELEASE = read("content", "skill-release-engineer.md");
const CONST15 = read("content", "const-15-core-tail.md");
const COORD03 = read("content", "coord-03-core-fallback.md");

// Slice from a `## ` heading to the next `## ` heading (or EOF).
function section(text, headingPrefix) {
  const start = text.indexOf(headingPrefix);
  assert.ok(start > -1, `heading not found: ${headingPrefix}`);
  const rest = text.slice(start + headingPrefix.length);
  const next = rest.search(/\n## /);
  return headingPrefix + (next === -1 ? rest : rest.slice(0, next));
}

test("AC1: integrator Stage 6 lands the wave by pull request — all six patterns sit inside ## Stage 6", () => {
  const stage6 = section(INTEGRATOR, "## Stage 6");
  for (const pattern of [
    "finish <lane> --shipped --base integ/<feature>",
    "git push -u origin integ/<feature>",
    "gh pr merge --auto --merge",
    "gh pr view <n> --json state,mergeCommit",
    "git -c pull.rebase=false pull --ff-only",
    "git branch -d integ/<feature>",
  ]) {
    assert.ok(stage6.includes(pattern), `Stage 6 must contain: ${pattern}`);
  }
});

test("AC2: no sentence in the integrator SOP still says main is fast-forwarded or pushed", () => {
  for (const stale of ["fast-forward `main`", "`main` fast-forwarded", "merge --ff-only", "`git push` (fast-forward only)"]) {
    assert.ok(!INTEGRATOR.includes(stale), `retired fast-forward-main wording must be gone: ${stale}`);
  }
  assert.equal(INTEGRATOR.split("6. Bookkeeping, main, teardown").length - 1, 1, "the stage-table row is renamed exactly once");
});

test("AC3: release-engineer 8a-8c opens, merges and syncs through a release/vX.Y.Z pull request", () => {
  for (const pattern of [
    "git switch -c release/vX.Y.Z",
    "git push -u origin release/vX.Y.Z",
    "gh pr merge <n> --auto --merge",
    "gh pr view <n> --json state,mergeCommit",
  ]) {
    assert.ok(RELEASE.includes(pattern), `release SOP must contain: ${pattern}`);
  }
  assert.ok(!RELEASE.includes("any time after step 8a completes"), "the early-tag allowance is retired");
});

test("AC4: the 8b budget advice survives and the pre-gate tag cleanup is gone", () => {
  assert.ok(!RELEASE.includes("delete any local tag created ahead of this gate"));
  assert.ok(RELEASE.includes("make the FIRST attempt with the normal budget"));
});

test("AC5: 13a-13b close-out lands bookkeeping by pull request (D10 row kept)", () => {
  assert.ok(RELEASE.includes("release/vX.Y.Z-bookkeeping"));
  assert.ok(RELEASE.includes("CLOSE-OUT PASSED"));
});

test("AC7: Constitution section 6 — grant names gh pr create/merge, namespaces, pinned sentence and FORBIDDEN list unchanged", () => {
  assert.ok(CONST15.includes("gh pr create"));
  assert.ok(CONST15.includes("gh pr merge --auto --merge"));
  assert.ok(CONST15.includes("`git -c pull.rebase=false pull --ff-only` on `main` is on the base list as read-plus-ff"));
  assert.ok(CONST15.includes("`release-engineer` limited to `release/*`"), "release-engineer namespace");
  assert.ok(CONST15.includes("the coordinator limited to `docs/*`"), "coordinator namespace");
  // Pinned first sentence — byte-identical, so the base list cannot widen by accident.
  assert.ok(
    CONST15.includes(
      "the only sanctioned git mutations are `git add`, `git commit`, `git tag`, fast-forward `git push`, and `git stash` / `git stash pop`",
    ),
  );
  assert.ok(
    CONST15.includes(
      "`git reset`, `git rebase`, `git clean`, force-push (`git push --force`), `git checkout --force`, `git checkout -- <file>` (irreversibly discards uncommitted edits — `git stash` achieves the same working-tree effect reversibly), `git stash drop`, and `git stash clear` (irreversibly discard stashed content) are FORBIDDEN",
    ),
    "FORBIDDEN list unchanged",
  );
  assert.ok(CONST15.includes("`git commit --amend` is FORBIDDEN for all roles"));
});

test("AC8: coord-03 states bookkeeping never lands on local main, inside ## Backlog Intake Loop", () => {
  const loop = section(COORD03, "## Backlog Intake Loop");
  assert.ok(loop.includes("**Bookkeeping never lands on local `main`**"));
  assert.ok(loop.includes("docs/<date>-<slug>"));
  assert.equal(COORD03.split("\n").filter((l) => l.includes("docs/<date>-<slug>")).length, 1, "exactly one line carries it (AC proof prints one hit), inside the loop");
});

test("AC9: fable is a valid tier and the integrator SOP recommends it", async () => {
  const mod = await import(path.join(ROOT, "dist", "tools", "skill-frontmatter.js"));
  assert.deepEqual([...mod.MODEL_TIERS], ["opus", "sonnet", "haiku", "fable"]);
  assert.equal(mod.parseSkillFile(INTEGRATOR).frontmatter.recommended_model, "opus");
});

test("AC10: Stage 6 tells the integrator it cannot reach main, inside ## Stage 6", () => {
  assert.ok(section(INTEGRATOR, "## Stage 6").includes("cannot reach `main`"));
});
