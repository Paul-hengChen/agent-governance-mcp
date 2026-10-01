// Coded by @qa-engineer
// Regression cases for the fan-out manifest's `worktree` column, which may now be written relative to the primary checkout. Pins the resolveWorktree / isAbsoluteWorktree contract, the render-only row errors WORKTREE_EMPTY / WORKTREE_TILDE,
// the non-fatal validate WARN, and that checkLane and lane-status behave exactly as before. (specs/e235b-relative-manifest-worktree.md AC1-AC3, AC6; specs/e235b-relative-manifest-worktree-architecture.md R1-R11; T-E235B-06/07)
// Test names start with R1..R11 (architecture "Regression cases"). The manifest builder mirrors test/e177a-manifest.test.mjs's manifestText(); repo helpers mirror test/e177a-check-cli.test.mjs, and every fixture is a throwaway git repo under os.tmpdir().
// Rationale: specs/e260f-comment-rationale.md (test/e235b-relative-worktree.test.mjs).

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
  checkLane,
  resolveWorktree,
  isAbsoluteWorktree,
} from "../dist/tools/fanout-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const F177A = path.join(ROOT, "test", "fixtures", "e177a");
const E177A_BRANCH = "feat/e177a-fanout-manifest";

// ---------------------------------------------------------------------------
// Manifest builder — mirrors test/e177a-manifest.test.mjs's manifestText().
// ---------------------------------------------------------------------------

function manifestText({
  title = "# Fan-out: Test Plan",
  baseLine = "base: 1234567",
  lanesHeader = "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  lanesRows = ["| e1 | T1 | feat/e1-x | ../lanes/e1 | `src/a.ts` | `other/**` | 做：a　不做：b | 無 |"],
  pinsBullets = ["- e1：`sr-engineer=fable`"],
  decisionsHeader = "| 日期 | 裁決者 | 內容 | 出處 |",
  decisionsRows = [],
} = {}) {
  const parts = [title, baseLine, ""];
  parts.push("## Lanes", lanesHeader, "|---|---|---|---|---|---|---|---|", ...lanesRows, "");
  parts.push("## Dispatch pins", ...pinsBullets, "");
  parts.push("## Decisions", decisionsHeader, "|---|---|---|---|", ...decisionsRows, "");
  return parts.join("\n");
}

function writeTmp(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e235b-worktree-"));
  const file = path.join(dir, "manifest.md");
  fs.writeFileSync(file, text);
  return file;
}

function rowWithWorktree(cell) {
  return `| e1 | T1 | feat/e1-x | ${cell} | \`src/a.ts\` | \`other/**\` | 做：a　不做：b | 無 |`;
}

// ---------------------------------------------------------------------------
// git repo helpers (mirrors test/e177a-check-cli.test.mjs mkRepo/commitTree)
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A fresh, throwaway repo under os.tmpdir() — never inside this repo. Realpath'd so macOS's /tmp -> /private/tmp symlink never causes a path-identity mismatch. */
function mkRepo(prefix = "e235b-worktree-repo-") {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
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

// ---------------------------------------------------------------------------
// A relative worktree cell is resolved against the primary checkout's path
// in the rendered lane prompt. (R1)
// ---------------------------------------------------------------------------

test("R1 relative resolves", () => {
  const m = parseManifest(manifestText({ lanesRows: [rowWithWorktree("../lanes/e1")] }));
  const r = renderPrompt(m, "e1", { summary: "S", reading: ["R"], mailboxRoot: "/m", primary: "/p" });
  assert.equal(r.ok, true);
  assert.match(r.prompt, /worktree: \/lanes\/e1 {4}lane: e1/);
});

// ---------------------------------------------------------------------------
// An absolute worktree cell is rendered exactly as written, trailing slash
// included, so existing manifests keep their output. (R2)
// ---------------------------------------------------------------------------

test("R2 absolute passes through byte-verbatim", () => {
  const m = parseManifest(manifestText({ lanesRows: [rowWithWorktree("/tmp/e1/")] }));
  const r = renderPrompt(m, "e1", { summary: "S", reading: ["R"], mailboxRoot: "/m", primary: "/p" });
  assert.equal(r.ok, true);
  assert.match(r.prompt, /worktree: \/tmp\/e1\/ {4}lane: e1/, "trailing slash must be kept, not normalized");
});

// ---------------------------------------------------------------------------
// An absolute cell renders byte-identically to the golden except the one
// worktree line, which equals the absolute cell verbatim. (R3, AC2)
// ---------------------------------------------------------------------------

test("R3 AC2 golden", () => {
  const golden = fs.readFileSync(path.join(F177A, "render-e177a.golden.txt"), "utf8");
  const relativeText = fs.readFileSync(path.join(F177A, "fanout-wave7.md"), "utf8");
  const absoluteText = relativeText.replace(
    "| e177a | E177a | feat/e177a-fanout-manifest | ../agm-lanes/e177a |",
    "| e177a | E177a | feat/e177a-fanout-manifest | /abs/agm-lanes/e177a |",
  );
  assert.notEqual(absoluteText, relativeText, "the replacement must actually have matched a row");

  const m = parseManifest(absoluteText);
  const r = renderPrompt(m, "e177a", { summary: "S", reading: ["R1", "R2"], mailboxRoot: "/m", primary: "/p" });
  assert.equal(r.ok, true);

  const goldenLines = golden.split("\n");
  const promptLines = r.prompt.split("\n");
  assert.equal(promptLines.length, goldenLines.length);
  for (let i = 0; i < goldenLines.length; i++) {
    if (goldenLines[i].includes("worktree: /agm-lanes/e177a")) {
      assert.equal(
        promptLines[i],
        goldenLines[i].replace("worktree: /agm-lanes/e177a", "worktree: /abs/agm-lanes/e177a"),
        "only the worktree line may differ, and it must equal the absolute cell byte-verbatim",
      );
    } else {
      assert.equal(promptLines[i], goldenLines[i], `line ${i} must be unchanged from the golden`);
    }
  }
});

// ---------------------------------------------------------------------------
// An empty worktree cell is refused with WORKTREE_EMPTY instead of rendering
// a prompt with no worktree. (R4)
// ---------------------------------------------------------------------------

test("R4 empty cell", () => {
  const text = manifestText({ lanesRows: [rowWithWorktree("")] });
  const m = parseManifest(text);
  const r = renderPrompt(m, "e1", { summary: "S", reading: ["R"], mailboxRoot: "/m", primary: "/p" });
  assert.equal(r.ok, false);
  const err = r.errors.find((e) => e.code === "WORKTREE_EMPTY");
  assert.ok(err, "WORKTREE_EMPTY must be reported");
  assert.equal(err.scope, "row");
  assert.deepEqual(err.lanes, ["e1"]);

  // validateManifest never inspects the worktree column.
  const { errors } = validateManifest(text);
  assert.ok(!errors.some((e) => e.code === "WORKTREE_EMPTY"), "validate must not raise a worktree error");

  // check on a real branch is unaffected by an empty worktree cell.
  const root = mkRepo();
  const base = commitTree(root, { "README.md": "x" }, [], "base");
  setBranch(root, "main", base);
  const branch = commitTree(root, { "README.md": "x", "src/a.ts": "code" }, [base], "branch");
  setBranch(root, "feat/e1-x", branch);
  const res = checkLane(m, "e1", { base: "main", repo: root });
  assert.equal(res.ok, true);
  assert.equal(res.report.exitCode, 0);
});

// ---------------------------------------------------------------------------
// A cell starting with `~` is refused with WORKTREE_TILDE, because the tilde
// would not be expanded and would name a different directory per user. (R5)
// ---------------------------------------------------------------------------

test("R5 tilde cell", () => {
  for (const cell of ["~/lanes/e1", "~", "~user/lanes/e1"]) {
    const m = parseManifest(manifestText({ lanesRows: [rowWithWorktree(cell)] }));
    const r = renderPrompt(m, "e1", { summary: "S", reading: ["R"], mailboxRoot: "/m", primary: "/p" });
    assert.equal(r.ok, false, `cell "${cell}" must be refused`);
    const err = r.errors.find((e) => e.code === "WORKTREE_TILDE");
    assert.ok(err, `WORKTREE_TILDE must be reported for "${cell}"`);
    // Never shell-expanded: the message must not contain a real home directory.
    assert.ok(!err.message.includes(os.homedir()), "the tilde must never be expanded to a real home directory");
  }
  // A leading-dot cell that merely contains "~" later is a normal relative path.
  const ok = resolveWorktree("./~x", "/p");
  assert.deepEqual(ok, { ok: true, path: "/p/~x" });
});

// ---------------------------------------------------------------------------
// When the primary checkout cannot be found, only PRIMARY_NOT_FOUND is
// reported, with no extra worktree error piled on top. (R6)
// ---------------------------------------------------------------------------

test("R6 primary absent", () => {
  // manifestDir is not a git repo: only PRIMARY_NOT_FOUND, no worktree error.
  const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), "e235b-notrepo-"));
  const m = parseManifest(manifestText({ lanesRows: [rowWithWorktree("../lanes/e1")] }));
  const r = renderPrompt(m, "e1", { summary: "S", reading: ["R"], mailboxRoot: "/m", manifestDir: notRepo });
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.errors.map((e) => e.code),
    ["PRIMARY_NOT_FOUND"],
    "worktree resolution must be skipped when there is no primary to resolve against",
  );

  // manifestDir IS a git repo: resolves the cell against that repo root
  // (resolvePrimary's `git worktree list --porcelain` finds it).
  const root = mkRepo("e235b-primary-repo-");
  commitTree(root, { "README.md": "x" }, [], "init");
  const r2 = renderPrompt(m, "e1", { summary: "S", reading: ["R"], mailboxRoot: "/m", manifestDir: root });
  assert.equal(r2.ok, true);
  assert.match(r2.prompt, new RegExp(`worktree: ${path.resolve(root, "../lanes/e1").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} {4}lane: e1`));
});

// ---------------------------------------------------------------------------
// checkLane output is byte-identical whether the worktree cell is relative
// or absolute, because checkLane never reads that column. (R7, AC3)
// ---------------------------------------------------------------------------

test("R7 check unaffected (AC3)", () => {
  const relative = parseManifest(manifestText({ lanesRows: [rowWithWorktree("../lanes/e1")] }));
  const absolute = parseManifest(manifestText({ lanesRows: [rowWithWorktree("/abs/lanes/e1")] }));

  const root = mkRepo();
  const base = commitTree(root, { "README.md": "x" }, [], "base");
  setBranch(root, "main", base);
  const branch = commitTree(root, { "README.md": "x", "src/a.ts": "code", "other/x": "y" }, [base], "branch");
  setBranch(root, "feat/e1-x", branch);

  const relRes = checkLane(relative, "e1", { base: "main", repo: root });
  const absRes = checkLane(absolute, "e1", { base: "main", repo: root });
  assert.equal(relRes.ok, true);
  assert.equal(absRes.ok, true);
  assert.equal(relRes.report.output, absRes.report.output);
  assert.equal(relRes.report.exitCode, absRes.report.exitCode);
});

// ---------------------------------------------------------------------------
// Parsing keeps the raw cell, and parse errors do not depend on which form
// it is. (R8)
// ---------------------------------------------------------------------------

test("R8 parse unaffected", () => {
  const relative = parseManifest(manifestText({ lanesRows: [rowWithWorktree("../lanes/e1")] }));
  const absolute = parseManifest(manifestText({ lanesRows: [rowWithWorktree("/abs/lanes/e1")] }));
  assert.equal(relative.dispatchable[0].worktree, "../lanes/e1", "the cell must be kept raw, not resolved");
  assert.deepEqual(relative.errors, absolute.errors);
});

// ---------------------------------------------------------------------------
// tools/lane-status.ts does not depend on the fan-out manifest, and a
// relative-cell manifest under specs/ does not change its listing. (R9, AC3)
// ---------------------------------------------------------------------------

test("R9 lane-status unaffected (AC3)", async () => {
  const src = fs.readFileSync(path.join(ROOT, "tools", "lane-status.ts"), "utf8");
  const codeOnly = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  assert.ok(!/fanout/i.test(codeOnly), "tools/lane-status.ts must not import or read a fanout-manifest / specs/fanout- source outside its explanatory comment");

  const { runLaneStatusCli } = await import("../dist/tools/lane-status.js");

  function mkPrimary(prefix) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    git(["init", "-q", "-b", "main"], root);
    git(["config", "user.email", "a@b.c"], root);
    git(["config", "user.name", "t"], root);
    fs.writeFileSync(path.join(root, "README.md"), "primary\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "init"], root);
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    return root;
  }

  const without = mkPrimary("e235b-lstatus-without-");
  const withManifest = mkPrimary("e235b-lstatus-with-");
  fs.mkdirSync(path.join(withManifest, "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(withManifest, "specs", "fanout-e235b-r9.md"),
    manifestText({ lanesRows: [rowWithWorktree("../lanes/e1")] }),
  );
  git(["add", "-A"], withManifest);
  git(["commit", "-q", "-m", "add manifest"], withManifest);

  const resultWithout = runLaneStatusCli(["--repo", without, "--json"]);
  const resultWith = runLaneStatusCli(["--repo", withManifest, "--json"]);
  assert.equal(resultWithout.exitCode, 0);
  assert.equal(resultWith.exitCode, 0);
  const parsedWithout = JSON.parse(resultWithout.output);
  const parsedWith = JSON.parse(resultWith.output);
  assert.equal(parsedWithout.lanes.length, parsedWith.lanes.length, "adding a relative-cell manifest must not change the lane count");
  assert.deepEqual(
    parsedWith.lanes.map((l) => ({ activeFeature: l.activeFeature, status: l.status, lastAgent: l.lastAgent })),
    parsedWithout.lanes.map((l) => ({ activeFeature: l.activeFeature, status: l.status, lastAgent: l.lastAgent })),
    "the listing's lane-derived fields must be unaffected by the manifest's presence",
  );

  fs.rmSync(without, { recursive: true, force: true });
  fs.rmSync(withManifest, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// The validate CLI still exits 0 on an absolute cell but prints a WARN line
// that never echoes the absolute value; a relative cell prints no WARN. (R10)
// ---------------------------------------------------------------------------

test("R10 validate warning (CLI)", () => {
  const absoluteFile = writeTmp(manifestText({ lanesRows: [rowWithWorktree("/abs/lanes/e1")] }));
  const r = runValidate([absoluteFile]);
  assert.equal(r.exitCode, 0);
  const lines = r.stdout.split("\n");
  assert.equal(lines[0], "fanout: ok — 1 dispatchable lane(s), 0 provisional, 0 decision(s)");
  assert.match(lines[1], /^WARN {2}lane e1 \(line \d+\): worktree cell is an absolute path/);
  assert.ok(!r.stdout.includes("/abs/lanes/e1"), "the absolute value itself must never be echoed");

  const relativeFile = writeTmp(manifestText({ lanesRows: [rowWithWorktree("../lanes/e1")] }));
  const relResult = runValidate([relativeFile]);
  assert.equal(relResult.exitCode, 0);
  assert.equal(relResult.stdout, "fanout: ok — 1 dispatchable lane(s), 0 provisional, 0 decision(s)\n");

  const badFile = writeTmp(manifestText({ lanesHeader: "| 區 | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |" }));
  const badResult = runValidate([badFile]);
  assert.equal(badResult.exitCode, 2);
  assert.equal(badResult.stdout, "", "no warnings are printed when there are errors");
});

// ---------------------------------------------------------------------------
// Every tracked manifest and fixture this lane owns is already in the
// relative form and validates with zero WARN lines. (R11, AC6)
// ---------------------------------------------------------------------------

function mdFiles(dir, filterFn = () => true) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && filterFn(f))
    .map((f) => path.join(dir, f));
}

test("R11 repo sweep", () => {
  const files = [
    ...mdFiles(path.join(ROOT, "specs"), (f) => f.startsWith("fanout-")),
    ...mdFiles(F177A),
    ...mdFiles(path.join(ROOT, "test", "fixtures", "e178b")),
  ];
  assert.ok(files.length >= 13, `expected at least 13 tracked manifests/fixtures, found ${files.length}`);

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const r = runValidate([file]);
    assert.ok(!r.stdout.includes("WARN"), `${file}: unexpected WARN line in validate stdout`);

    const m = parseManifest(text);
    for (const lane of m.dispatchable) {
      assert.ok(
        !isAbsoluteWorktree(lane.worktree),
        `${file}: lane "${lane.lane}" worktree cell is still absolute ("${lane.worktree}")`,
      );
    }
  }
});
