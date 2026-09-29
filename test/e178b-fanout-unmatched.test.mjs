// Coded by @qa-engineer
// Tests (T-E178B-05) for the `fanout check` warning about owned path tokens
// that name no file (E208; tools/fanout-manifest.ts checkLane/unmatchedOwnedTokens,
// scripts/fanout.mjs), per specs/e178b-lane-watch-tooling.md decisions (h)/(i), AC16-AC19.
// AC20 (build + full suite on a clean committed tree) and AC21 (the lane's own
// `fanout check specs/fanout-wave7.2.md e178b --base 121ddc8`) are whole-ticket
// runs recorded in qa_reports/review_T-E178B-05.md after the commit, per
// docs/lane-protocol.md §3 — there is no in-file assertion for them.
//
// WHY: `fanout check` grants ownership to every path-shaped backtick span in a
// lane's 擁有 cell. A prose aside such as wave7 e177a's
// "同 `feature-rollup.mjs` 模式" therefore silently became an owned token
// (E208), widening the lane's bounds without anyone deciding it. The warning
// must fire on exactly those tokens — an exact token that names no file at
// base and no file the branch added — and on nothing a lane legitimately
// declares (a glob, an existing file, a new file it created). And because
// every integrator script already parses `fanout check`'s output and exit
// code, the change must be purely additive: pre-existing lines byte-identical
// and in order, WARN lines strictly after them, exit codes unchanged.
//
// Fixtures are real throwaway git repos built with `git commit-tree` (same
// helpers as test/e177a-check-cli.test.mjs), so checkLane's own `git ls-tree`
// and `git diff --diff-filter=A` reads run for real.
//
// Spec-to-Test map:
//   AC16 (an exact owned token naming no file warns)      -> "AC16 unmatched exact token warns"
//   AC17 (globs, existing and newly added files never warn) -> "AC17 no false warnings"
//   AC18 (exit codes unchanged, WARN lines come last)     -> "AC18 exit codes and line order"
//   AC19 (real wave7 row's prose-aside token warns)       -> "AC19 E208 regression"

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  parseManifest,
  checkLane,
  runCheck,
  unmatchedOwnedTokens,
  isGlobToken,
  UNMATCHED_OWNED_WARN,
  E158_NOTE,
  PROSE_NOTE,
  FANOUT_CODES,
} from "../dist/tools/fanout-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const E177A_FIXTURE = path.join(ROOT, "test", "fixtures", "e178b", "fanout-wave7-e177a.md");
const E177A_BRANCH = "feat/e177a-fanout-manifest";
const BRANCH = "feat/e950-e208-probe";

// ---------------------------------------------------------------------------
// Fixture helpers (mirrors test/e177a-check-cli.test.mjs)
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 }).trim();
}

function mkRepo(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e178b-fanout-")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  git(["config", "user.email", "a@b.c"], root);
  git(["config", "user.name", "t"], root);
  git(["config", "commit.gpgsign", "false"], root);
  return root;
}

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

function setBranch(root, name, sha) {
  git(["update-ref", `refs/heads/${name}`, sha], root);
}

/** A one-row manifest for lane e950 whose 擁有 cell is `owned` (raw cell text). */
function manifestText(owned, forbidden = "`bin/**`") {
  return [
    "# Fan-out: E208 probe",
    "base: 0000000",
    "",
    "## Lanes",
    "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
    "|---|---|---|---|---|---|---|---|",
    `| e950 | E950 | ${BRANCH} | /tmp/e950 | ${owned} | ${forbidden} | 做：probe；不做：其他 | 無 |`,
    "",
  ].join("\n");
}

const warn = (token, base = "main", branch = BRANCH) =>
  `WARN  ${token}  (擁有 token matches no path at ${base} and is not a glob or a file added on ${branch})`;

/** Base = `baseFiles`; branch = base + `branchFiles` (a child commit). */
function repoWith(t, baseFiles, branchFiles) {
  const root = mkRepo(t);
  const base = commitTree(root, baseFiles, [], "base");
  setBranch(root, "main", base);
  const branch = commitTree(root, { ...baseFiles, ...branchFiles }, [base], "branch");
  setBranch(root, BRANCH, branch);
  return root;
}

// ---------------------------------------------------------------------------
// AC16 — an exact owned token that names no file warns
// ---------------------------------------------------------------------------

test("AC16 unmatched exact token warns", (t) => {
  const root = repoWith(t, { "README.md": "x", "tools/real.ts": "r" }, { "tools/real.ts": "r2" });
  const m = parseManifest(manifestText("`tools/real.ts`、`ghost.mjs`、`lib/phantom.ts`；同 `ghost.mjs` 模式"));
  const res = checkLane(m, "e950", { base: "main", repo: root });
  assert.equal(res.ok, true);
  const r = res.report;
  // Once per token (ghost.mjs is named twice in the cell), in 擁有 order.
  assert.deepEqual(r.unmatchedOwned, ["ghost.mjs", "lib/phantom.ts"]);
  const lines = r.output.trimEnd().split("\n");
  assert.deepEqual(lines.slice(-2), [warn("ghost.mjs"), warn("lib/phantom.ts")]);
  assert.equal(lines.filter((l) => l.startsWith("WARN  ")).length, 2);
  assert.equal(UNMATCHED_OWNED_WARN("ghost.mjs", "main", BRANCH), warn("ghost.mjs"), "exported template = spec text");
  assert.equal(r.exitCode, 0);
});

// ---------------------------------------------------------------------------
// AC17 — globs, existing files and newly added files never warn
// ---------------------------------------------------------------------------

test("AC17 no false warnings", (t) => {
  const root = repoWith(
    t,
    { "README.md": "x", "tools/real.ts": "r", "docs/deep/nested/guide.md": "g" },
    { "tools/brand-new.ts": "n", "scripts/also-new.mjs": "n" },
  );
  const owned = [
    "`tools/real.ts`", // exact, exists at base
    "`docs/deep/nested/guide.md`", // exact, nested, exists at base
    "`tools/brand-new.ts`", // exact, added on the branch (declared new file)
    "新檔 `scripts/also-new.mjs`",
    "`dist/**`", // globs: never warned, the lane may create them
    "`test/e950-*.test.mjs`",
    "`specs/{a,b}.md`",
    "`.current/e950/`",
  ].join("、");
  const res = checkLane(parseManifest(manifestText(owned)), "e950", { base: "main", repo: root });
  assert.equal(res.ok, true);
  assert.deepEqual(res.report.unmatchedOwned, []);
  assert.doesNotMatch(res.report.output, /WARN/);

  // The pure classifier directly.
  for (const g of ["a/**", "a/*.ts", "{a,b}.md", "dir/"]) assert.equal(isGlobToken(g), true, g);
  for (const e of ["a.ts", "a/b.md", "a-b"]) assert.equal(isGlobToken(e), false, e);
  assert.deepEqual(unmatchedOwnedTokens(["x.ts", "y/**", "z.md", "x.ts"], ["z.md"], []), ["x.ts"]);
  // A file DELETED or only MODIFIED on the branch is no "added" file: if base
  // lacks it too, the token still warns. (Only --diff-filter=A exempts.)
  assert.deepEqual(unmatchedOwnedTokens(["gone.ts"], [], []), ["gone.ts"]);
});

// ---------------------------------------------------------------------------
// AC18 — exit codes are unchanged and WARN lines come after the existing lines
// ---------------------------------------------------------------------------

test("AC18 exit codes and line order", (t) => {
  const root = repoWith(t, { "README.md": "x" }, { "tools/real.ts": "r", "bin/evil.mjs": "e", "other.txt": "o" });
  const m = parseManifest(manifestText("`tools/real.ts`、`ghost.mjs`"));

  // WARN + OUT: exit 1 (from the OUT lines alone); pre-existing lines are
  // exactly the e177a sequence, and every WARN line comes after all of them.
  const withOut = checkLane(m, "e950", { base: "main", repo: root }).report;
  assert.equal(withOut.exitCode, 1);
  const lines = withOut.output.trimEnd().split("\n");
  const firstWarn = lines.findIndex((l) => l.startsWith("WARN  "));
  assert.ok(firstWarn > 0);
  assert.ok(lines.slice(firstWarn).every((l) => l.startsWith("WARN  ")), "nothing after the WARN block");
  assert.deepEqual(lines.slice(0, firstWarn), [
    "owned (from 擁有): tools/real.ts, ghost.mjs",
    "implicit lane bookkeeping: .current/e950/**, specs/e950-*.md, qa_reports|review_reports/*e950* (case-insensitive)",
    "OUT  bin/evil.mjs  (禁止: bin/**)",
    "OUT  other.txt",
    "fanout check: e950 — 3 file(s) changed, 2 out of bounds",
    E158_NOTE("main", BRANCH),
    PROSE_NOTE,
  ]);
  assert.deepEqual(lines.slice(firstWarn), [warn("ghost.mjs")]);

  // WARN only: exit 0 — an unmatched-file warning never changes the exit code (E208, decision (h)).
  const inBounds = repoWith(t, { "README.md": "x" }, { "tools/real.ts": "r" });
  const warnOnly = checkLane(m, "e950", { base: "main", repo: inBounds }).report;
  assert.equal(warnOnly.exitCode, 0);
  assert.match(warnOnly.output, /^WARN {2}ghost\.mjs {2}/m);

  // Same through the CLI, plus input errors -> 2.
  const mf = path.join(root, "manifest.md");
  fs.writeFileSync(mf, manifestText("`tools/real.ts`、`ghost.mjs`"));
  const cliOut = runCheck([mf, "e950", "--base", "main", "--repo", root]);
  assert.equal(cliOut.exitCode, 1);
  assert.equal(cliOut.stdout, withOut.output);
  const cliWarn = runCheck([mf, "e950", "--base", "main", "--repo", inBounds]);
  assert.equal(cliWarn.exitCode, 0);
  for (const args of [[mf], [mf, "nope-lane", "--base", "main", "--repo", root], [path.join(root, "absent.md"), "e950"], [mf, "e950", "--base", "no-such-ref", "--repo", root], [mf, "e950", "--bogus", "x"]]) {
    const r = runCheck(args);
    assert.equal(r.exitCode, 2, args.join(" "));
    assert.equal(r.stdout, "", `${args.join(" ")}: no report on an input error`);
  }
  // No new error code (decision (i)): the unmatched-file warning adds none (E208).
  assert.equal(Object.values(FANOUT_CODES).some((c) => /UNMATCHED|WARN/.test(String(c))), false);

  // The degrade note (git ls-tree failed) appears only when that read fails.
  assert.doesNotMatch(withOut.output, /existence check skipped/);
});

// ---------------------------------------------------------------------------
// AC19 — the real wave7 row's prose-aside token triggers the warning
// ---------------------------------------------------------------------------

test("AC19 E208 regression", (t) => {
  // wave7's real e177a row (copied, never edited in specs/): its 擁有 cell
  // says "同 `feature-rollup.mjs` 模式" — a prose aside, while the real file
  // lives at scripts/feature-rollup.mjs, not the repo root.
  const text = fs.readFileSync(E177A_FIXTURE, "utf8");
  const m = parseManifest(text);
  assert.ok(m.dispatchable.find((l) => l.lane === "e177a").ownedTokens.includes("feature-rollup.mjs"), "fixture carries the E208 token");

  const root = mkRepo(t);
  const base = commitTree(root, { "README.md": "x", "scripts/feature-rollup.mjs": "old", "dist/tools/feature-rollup.js": "d" }, [], "base");
  setBranch(root, "main", base);
  const branch = commitTree(
    root,
    {
      "README.md": "x",
      "scripts/feature-rollup.mjs": "old",
      "dist/tools/feature-rollup.js": "d",
      "tools/fanout-manifest.ts": "new", // 新檔: added on the branch
      "scripts/fanout.mjs": "new",
      "dist/tools/fanout-manifest.js": "new",
      "test/e177a-manifest.test.mjs": "t",
    },
    [base],
    "branch",
  );
  setBranch(root, E177A_BRANCH, branch);

  const r = checkLane(m, "e177a", { base: "main", repo: root }).report;
  assert.deepEqual(r.unmatchedOwned, ["feature-rollup.mjs"], "warns on the prose aside only");
  assert.ok(r.output.includes(warn("feature-rollup.mjs", "main", E177A_BRANCH)));
  assert.doesNotMatch(r.output, /WARN {2}dist\/tools\/\*\.js/, "a glob is never warned about");
  assert.doesNotMatch(r.output, /WARN {2}tools\/fanout-manifest\.ts/, "a declared new file is not warned about");
  assert.equal(r.exitCode, 0);

  // End to end through the real script with the CLI's DEFAULT --repo (the
  // manifest's own directory, a subdirectory of the repo): git ls-tree must
  // list the whole tree (--full-tree), or every root-level token would warn.
  fs.mkdirSync(path.join(root, "specs"));
  const mf = path.join(root, "specs", "fanout-wave7-e177a.md");
  fs.writeFileSync(mf, text);
  const p = spawnSync(process.execPath, [path.join(ROOT, "scripts", "fanout.mjs"), "check", mf, "e177a", "--base", "main"], {
    encoding: "utf8",
    timeout: 20000,
  });
  assert.equal(p.status, 0, p.stderr);
  const warns = p.stdout.split("\n").filter((l) => l.startsWith("WARN  "));
  assert.deepEqual(warns, [warn("feature-rollup.mjs", "main", E177A_BRANCH)]);

  // Same default --repo, with an exact token that EXISTS at base outside
  // specs/ and was not touched on the branch: a cwd-relative ls-tree would
  // miss it and warn falsely.
  const mf2 = path.join(root, "specs", "fanout-probe.md");
  fs.writeFileSync(mf2, manifestText("`scripts/feature-rollup.mjs`、`README.md`"));
  setBranch(root, BRANCH, branch);
  const p2 = spawnSync(process.execPath, [path.join(ROOT, "scripts", "fanout.mjs"), "check", mf2, "e950", "--base", "main"], {
    encoding: "utf8",
    timeout: 20000,
  });
  assert.equal(p2.status, 1, "the branch's other files are OUT for e950 — exit 1 from OUT, not from WARN");
  assert.doesNotMatch(p2.stdout, /WARN/, p2.stdout);
});
