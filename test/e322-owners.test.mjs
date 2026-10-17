// Coded by @qa-engineer
// Tests (T-E322-01) for specs/e283-fanout-handoff-and-ref-check.md AC-E322-1..9: `fanout.mjs owners` names every
// lane whose 擁有 cell (or implicit bookkeeping set) owns any path of a ref range or a path list, so the integrator's
// mid-wave base-fix condition 2 is mechanical. Fixtures are in-test manifests and a temp git repo under os.tmpdir();
// nothing reads the committed specs/fanout-*.md and nothing is diffed against a fixed sha.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FANOUT = path.join(ROOT, "scripts", "fanout.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e322-qa-"));
let seq = 0;

function cli(args, input) {
  const r = spawnSync(process.execPath, [FANOUT, ...args], { cwd: ROOT, encoding: "utf8", input });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function tmpFile(name, text) {
  const p = path.join(TMP, `${seq++}-${name}`);
  fs.writeFileSync(p, text);
  return p;
}
const hitLines = (r) => r.stdout.split("\n").filter((l) => l.startsWith("HIT  "));
const errCodes = (r) =>
  r.stderr
    .split("\n")
    .filter((l) => l.startsWith("fanout: error:"))
    .map((l) => l.split(":")[2].trim());
const OWNERS_USAGE = "usage: node scripts/fanout.mjs owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)";

const HEAD = [
  "# Fan-out: fixture",
  "base: abc1234    integration branch: integ/fx",
  "mailbox: ../lanes/_mailbox",
  "",
  "## Lanes",
  "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  "|---|---|---|---|---|---|---|---|",
];
const TAIL = [
  "",
  "## Dispatch pins",
  "- a：`sr-engineer=opus`。",
  "",
  "## Decisions",
  "| 日期 | 裁決者 | 內容 | 出處 |",
  "|---|---|---|---|",
  "| 2026-10-13 | 人類 | 開波 | s |",
  "",
];
const row = (lane, owns) => `| ${lane} | E1 | feat/${lane} | ../lanes/${lane} | ${owns} | \`docs/**\` | 做：x。　不做：y | 無 |`;
const mkManifest = (rows, { extra = [], tail = TAIL } = {}) => tmpFile("m.md", [...HEAD, ...rows, ...extra, ...tail].join("\n"));

const M = mkManifest([row("a", "`tools/a.ts`、`test/a-*.test.mjs`"), row("b", "`tools/b.ts`")]);
const paths = (...p) => tmpFile("paths.txt", p.join("\n") + "\n");

test("AC-E322-1 paths with hits", () => {
  const r = cli(["owners", M, "--paths", paths("tools/a.ts", "test/a-x.test.mjs", ".current/b/handoff.md", "README.md")]);
  assert.equal(r.status, 1, r.stderr);
  assert.deepEqual(hitLines(r), [
    "HIT  .current/b/handoff.md  (b: implicit bookkeeping)",
    "HIT  test/a-x.test.mjs  (a: test/a-*.test.mjs)",
    "HIT  tools/a.ts  (a: tools/a.ts)",
  ]);
  assert.ok(!r.stdout.includes("README.md  ("), "no HIT line for README.md");
  assert.ok(r.stdout.includes("fanout owners: 4 path(s), 3 hit(s), 2 dispatchable lane(s)\n"), r.stdout);
});

test("AC-E322-1 output is de-duplicated and sorted by code unit", () => {
  // WHY: deterministic output is the contract the integrator diffs and pipes.
  const r = cli(["owners", M, "--paths", paths("tools/b.ts", "tools/a.ts", "tools/b.ts", "tools/a.ts")]);
  assert.deepEqual(hitLines(r), ["HIT  tools/a.ts  (a: tools/a.ts)", "HIT  tools/b.ts  (b: tools/b.ts)"]);
  assert.ok(r.stdout.includes("2 path(s), 2 hit(s)"), r.stdout);
});

test("AC-E322-2 multi-lane hit", () => {
  const m = mkManifest([row("a", "`tools/a.ts`"), row("b", "`tools/**`")]);
  const r = cli(["owners", m, "--paths", paths("tools/a.ts")]);
  assert.equal(r.status, 1);
  assert.deepEqual(hitLines(r), ["HIT  tools/a.ts  (a: tools/a.ts; b: tools/**)"]);
});

test("AC-E322-3 no hits", () => {
  for (const content of [paths("README.md", "docs/x.md"), tmpFile("empty.txt", "")]) {
    const r = cli(["owners", M, "--paths", content]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(hitLines(r), []);
    assert.match(r.stdout, /0 hit\(s\)/);
  }
});

test("AC-E322-4 stdin equals the file form (HIT lines, summary, exit code)", () => {
  // WHY: `--paths -` differs only in the source note line (ruled by reviewer + integrator).
  const list = "tools/a.ts\r\n  test/a-x.test.mjs  \n\nREADME.md\n";
  const viaFile = cli(["owners", M, "--paths", tmpFile("p.txt", list)]);
  const viaStdin = cli(["owners", M, "--paths", "-"], list);
  assert.equal(viaStdin.status, viaFile.status);
  assert.deepEqual(hitLines(viaStdin), hitLines(viaFile));
  assert.equal(hitLines(viaStdin).length, 2, "CR and surrounding whitespace trimmed, blank lines skipped");
  const summary = (r) => r.stdout.split("\n").find((l) => l.startsWith("fanout owners:"));
  assert.equal(summary(viaStdin), summary(viaFile));
});

// --- range: a temp git repo ---------------------------------------------------------------------------------
function git(repo, ...args) {
  const r = spawnSync("git", ["-c", "user.name=qa", "-c", "user.email=qa@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function makeRepo() {
  const repo = fs.mkdtempSync(path.join(TMP, "repo-"));
  git(repo, "init", "-q", "-b", "main");
  fs.mkdirSync(path.join(repo, "tools"));
  fs.writeFileSync(path.join(repo, "tools", "old.ts"), "export const old = 1;\n".repeat(20));
  fs.writeFileSync(path.join(repo, "README.md"), "x\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  git(repo, "branch", "lane");
  git(repo, "checkout", "-q", "-b", "target", "main");
  fs.writeFileSync(path.join(repo, "tools", "a.ts"), "export const a = 1;\n");
  fs.mkdirSync(path.join(repo, "docs"));
  fs.writeFileSync(path.join(repo, "docs", "x.md"), "x\n");
  git(repo, "mv", "tools/old.ts", "tools/new.ts");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "target change");
  return repo;
}
const RM = mkManifest([row("a", "`tools/a.ts`、`tools/old.ts`、`tools/new.ts`"), row("b", "`tools/b.ts`")]);

test("AC-E322-5 range", () => {
  const repo = makeRepo();
  const r = cli(["owners", RM, "--range", "lane...target", "--repo", repo]);
  assert.equal(r.status, 1, r.stderr);
  // rename reported as both the old and the new path (--no-renames); docs/x.md is not owned
  assert.deepEqual(hitLines(r), [
    "HIT  tools/a.ts  (a: tools/a.ts)",
    "HIT  tools/new.ts  (a: tools/new.ts)",
    "HIT  tools/old.ts  (a: tools/old.ts)",
  ]);
  assert.ok(r.stdout.includes("4 path(s), 3 hit(s)"), r.stdout);
  assert.ok(r.stdout.includes("note: paths from git diff --no-renames --name-only lane...target (committed changes only).\n"), r.stdout);
});

test("AC-E322-5 three-dot semantics: only changes on <b> since the merge-base count", () => {
  // WHY: a change made on the lane branch after the fork must not be attributed to the base fix.
  const repo = makeRepo();
  git(repo, "checkout", "-q", "lane");
  fs.writeFileSync(path.join(repo, "tools", "b.ts"), "export const b = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "lane work");
  const r = cli(["owners", RM, "--range", "lane...target", "--repo", repo]);
  assert.ok(!r.stdout.includes("tools/b.ts"), r.stdout);
});

test("AC-E322-6 input errors", () => {
  const repo = makeRepo();
  for (const bad of ["a..b", "...b", "-x...b", "a...", "a b...c"]) {
    const r = cli(["owners", RM, "--range", bad, "--repo", repo]);
    assert.equal(r.status, 2, bad);
    assert.ok(errCodes(r).includes("RANGE_INVALID"), `${bad}: ${r.stderr}`);
  }
  // QA note: the implementation is STRICTER than the spec — a side containing `..` or starting/ending with `.` is also
  // RANGE_INVALID (git refs cannot hold those). Accepted by reviewer + integrator; pinned so a loosening is noticed.
  for (const strict of ["a....b", ".a...b", "a....b"]) {
    const r = cli(["owners", RM, "--range", strict, "--repo", repo]);
    assert.equal(r.status, 2, strict);
    assert.ok(errCodes(r).includes("RANGE_INVALID"), `${strict}: ${r.stderr}`);
  }
  const nf = cli(["owners", RM, "--range", "lane...nope", "--repo", repo]);
  assert.equal(nf.status, 2);
  assert.ok(errCodes(nf).includes("REF_NOT_FOUND"), nf.stderr);
  const notGit = cli(["owners", RM, "--range", "lane...target", "--repo", fs.mkdtempSync(path.join(TMP, "nogit-"))]);
  assert.equal(notGit.status, 2);
  assert.ok(errCodes(notGit).includes("REPO_NOT_GIT"), notGit.stderr);
  const unreadable = cli(["owners", RM, "--paths", path.join(TMP, "does-not-exist.txt")]);
  assert.equal(unreadable.status, 2);
  assert.ok(errCodes(unreadable).includes("PATHS_UNREADABLE"), unreadable.stderr);
});

test("AC-E322-7 usage", () => {
  const p = paths("tools/a.ts");
  const cases = [
    ["owners", M],
    ["owners", M, "--range", "a...b", "--paths", p],
    ["owners", M, "--paths", p, "--repo", TMP],
    ["owners", "--paths", p],
    ["owners", M, M, "--paths", p],
  ];
  for (const args of cases) {
    const r = cli(args);
    assert.equal(r.status, 2, args.join(" "));
    assert.ok(r.stderr.includes("fanout: error: USAGE:"), `${args.join(" ")}: ${r.stderr}`);
    assert.ok(r.stderr.includes(OWNERS_USAGE), `${args.join(" ")}: owners usage line printed: ${r.stderr}`);
  }
});

test("AC-E322-8 manifest errors and provisional lanes", () => {
  const p = paths("tools/a.ts");
  // Lanes row error is fatal (a dropped row could be the owning lane)
  const rowErr = mkManifest([row("a", "`tools/a.ts`"), row("bad id", "`tools/b.ts`")]);
  const fatal = cli(["owners", rowErr, "--paths", p]);
  assert.equal(fatal.status, 2);
  assert.deepEqual(hitLines(fatal), []);
  assert.ok(fatal.stderr.includes("fanout: error:"), fatal.stderr);
  // Decisions / Dispatch pins format errors do not block
  const decBad = mkManifest([row("a", "`tools/a.ts`")], {
    tail: [...TAIL.slice(0, -2), "| not a date | 人類 | x | s |", ""],
  });
  assert.equal(cli(["owners", decBad, "--paths", p]).status, 1);
  const pinsBad = mkManifest([row("a", "`tools/a.ts`")], { tail: TAIL.map((l) => (l.startsWith("- a：") ? "- a：garbage" : l)) });
  assert.equal(cli(["owners", pinsBad, "--paths", p]).status, 1);
  // provisional table: lanes named as not checked
  const prov = mkManifest([row("a", "`tools/a.ts`")], {
    extra: ["", "## Lanes (later)", "| lane | 票 | branch |", "|---|---|---|", "| z | E9 | feat/z |"],
  });
  const r = cli(["owners", prov, "--paths", p]);
  assert.equal(r.status, 1, r.stderr);
  assert.ok(r.stdout.includes("note: 1 provisional lane(s) not checked: z\n"), r.stdout);
  // and no provisional note when there is none
  assert.ok(!cli(["owners", M, "--paths", p]).stdout.includes("provisional"));
});

const sha = (f) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");

test("AC-E322-9 usage unchanged and read-only", () => {
  // WHY: e296 AC12 pins exactly three generic-usage continuation lines; owners must not leak into the generic usage.
  const g = cli([]);
  assert.equal(g.status, 2);
  assert.equal(g.stderr.split("\n").filter((l) => l.startsWith("       node scripts/fanout.mjs")).length, 3);
  assert.ok(!g.stderr.includes("owners"), "generic usage does not list owners");
  const unk = cli(["nonsense"]);
  assert.equal(unk.stderr, g.stderr);
  // header comment lists the owners form
  const header = fs.readFileSync(FANOUT, "utf8").split("\n").slice(0, 15).join("\n");
  assert.ok(header.includes("node scripts/fanout.mjs owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)"));
  // read-only: manifest, path file, repo HEAD and worktree untouched
  const repo = makeRepo();
  const pf = paths("tools/a.ts", "docs/x.md");
  const before = [sha(RM), sha(pf), git(repo, "rev-parse", "HEAD"), git(repo, "status", "--porcelain"), git(repo, "branch", "--list")];
  cli(["owners", RM, "--range", "lane...target", "--repo", repo]);
  cli(["owners", RM, "--paths", pf]);
  const after = [sha(RM), sha(pf), git(repo, "rev-parse", "HEAD"), git(repo, "status", "--porcelain"), git(repo, "branch", "--list")];
  assert.deepEqual(after, before);
});
