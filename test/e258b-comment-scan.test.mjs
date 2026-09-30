// Coded by @qa-engineer
// Tests for specs/e258b-comment-scan.md AC1-AC16: the advisory comment-length
// scan run by `agc check` (tools/comment-scan.ts, wired in bin/agc-init.mjs).
// Every input is built at runtime in a temp repo under os.tmpdir(); long
// samples live in test/fixtures/e258b/*.fixture.txt, which the scan never
// reads. This file is in its own lane diff, so it keeps to the same limits.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  analyzeText,
  findingsForFile,
  formatFindings,
  formatPct,
  isScannablePath,
  parseAddedLines,
  unquoteGitPath,
} from "../dist/tools/comment-scan.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(ROOT, "bin", "agc-init.mjs");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")).version;
const PREFIX = "agc check — comments";
const FIX = path.join(ROOT, "test", "fixtures", "e258b");

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

function mkTmp(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  tmpDirs.push(d);
  return d;
}

const emptyCfg = path.join(mkTmp("e258b-cfg-"), "empty.gitconfig");
fs.writeFileSync(emptyCfg, "");

function baseEnv() {
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: emptyCfg,
    GIT_CEILING_DIRECTORIES: fs.realpathSync(os.tmpdir()),
  };
}

function git(cwd, args) {
  const id = ["-c", "user.email=qa@example.invalid", "-c", "user.name=qa"];
  return execFileSync("git", [...id, ...args], { cwd, env: baseEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function commitAll(repo, msg = "c") {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "--allow-empty", "-m", msg]);
}

function mkRepo(prefix, branch = "main") {
  const repo = mkTmp(prefix);
  git(repo, ["init", "-q", "-b", branch]);
  write(repo, "seed.txt", "seed\n");
  commitAll(repo, "seed");
  return repo;
}

function runCheck(cwd, script = AGC_INIT) {
  const r = spawnSync(process.execPath, [script, "check"], { cwd, env: baseEnv(), encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const scanLines = (stderr) => stderr.split("\n").filter((l) => l.startsWith(PREFIX));
const blockHits = (stderr) => scanLines(stderr).filter((l) => / long-block /.test(l));
const ratioHits = (stderr) => scanLines(stderr).filter((l) => / high-ratio /.test(l));

function stamp(ws, version) {
  fs.writeFileSync(path.join(ws, "CLAUDE.md"), `<!-- agc-version: ${version} -->\n# adapter\n`);
}

const slash = (n, tag = "note") => Array.from({ length: n }, (_, i) => `// ${tag} ${i + 1}`);
const code = (n, from = 0) => Array.from({ length: n }, (_, i) => `const v${from + i} = ${from + i};`);
const join = (lines) => lines.join("\n") + "\n";

// `comments` comment lines in runs of at most 7, padded with code to `total` non-blank lines.
function mkRatioFile(comments, total, firstRun = 7) {
  const out = [];
  let left = comments;
  let used = 0;
  let run = firstRun;
  while (left > 0) {
    const n = Math.min(run, left);
    out.push(...slash(n), ...code(1, used++));
    left -= n;
    run = 7;
  }
  out.push(...code(total - comments - used, used));
  return join(out);
}

function findUnique(lines, re, what) {
  const m = lines.filter((l) => re.test(l));
  assert.equal(m.length, 1, `${what}: expected one match for ${re}, got ${m.length} in ${lines.join(" | ")}`);
  return m[0];
}

test("AC1: exit code is identical with and without warnings — 0 with current adapters, 1 with stale ones", () => {
  // Contract: the scan is advisory; only the adapter-stamp check decides exit.
  for (const [version, expected] of [[VERSION, 0], ["0.0.1", 1]]) {
    const dirty = mkRepo("e258b-ac1-dirty-");
    const clean = mkRepo("e258b-ac1-clean-");
    write(dirty, "blk.ts", join([...slash(8), ...code(1)]));
    write(dirty, "ratio.ts", mkRatioFile(60, 100));
    write(clean, "ok.ts", join(code(3)));
    stamp(dirty, version);
    stamp(clean, version);
    const rd = runCheck(dirty);
    const rc = runCheck(clean);
    assert.equal(rc.status, expected, rc.stderr);
    assert.equal(rd.status, expected, rd.stderr);
    assert.ok(blockHits(rd.stderr).length >= 1 && ratioHits(rd.stderr).length >= 1, "both kinds fire");
    assert.deepEqual(scanLines(rc.stderr), []);
  }
});

test("AC2: a 7-line block is silent, an 8-line block reports path, first line and length", () => {
  const repo = mkRepo("e258b-ac2-");
  write(repo, "a.ts", join([...slash(7, "seven"), ...code(1), ...slash(8, "eight"), ...code(1, 1)]));
  const hits = blockHits(runCheck(repo).stderr);
  assert.deepEqual(hits, [`${PREFIX}: a.ts:9 long-block 8 lines (limit 7)`]);
});

test("AC3: a committed long block is reported only when the diff adds or edits a line of it", () => {
  const repo = mkRepo("e258b-ac3-");
  const body = [...code(2), ...slash(10), ...code(2, 2)];
  write(repo, "f.ts", join(body));
  commitAll(repo);
  const edit = (fn) => {
    git(repo, ["checkout", "-q", "--", "f.ts"]);
    write(repo, "f.ts", join(fn([...body])));
    return blockHits(runCheck(repo).stderr);
  };
  assert.deepEqual(edit((b) => ((b[b.length - 1] = "const last = 1;"), b)), [], "unrelated line");
  const added = edit((b) => (b.splice(5, 0, "// extra"), b));
  assert.equal(added.length, 1, "line added inside the block");
  assert.match(added[0], /f\.ts:3 long-block 11 lines/);
  const edited = edit((b) => ((b[4] = "// edited"), b));
  assert.equal(edited.length, 1, "line edited inside the block");
  assert.match(edited[0], /f\.ts:3 long-block 10 lines/);
});

test("AC4: ratio fires above 30% when a comment line is added, is silent at exactly 30% and on code-only additions", () => {
  const repo = mkRepo("e258b-ac4-");
  write(repo, "over.ts", mkRatioFile(31, 100));
  write(repo, "exact.ts", mkRatioFile(30, 100));
  const r = runCheck(repo);
  assert.deepEqual(blockHits(r.stderr), []);
  assert.deepEqual(ratioHits(r.stderr), [`${PREFIX}: over.ts high-ratio 31% of 100 non-blank lines are comments (limit 30%)`]);

  const old = mkRepo("e258b-ac4-old-");
  write(old, "debt.ts", mkRatioFile(31, 100));
  commitAll(old);
  fs.appendFileSync(path.join(old, "debt.ts"), "const more = 1;\n");
  assert.deepEqual(scanLines(runCheck(old).stderr), [], "code-only diff on an over-ratio file");
});

test("AC4: formatPct rounds up to one decimal and drops a trailing .0", () => {
  assert.equal(formatPct(31, 100), "31");
  assert.equal(formatPct(22, 70), "31.5");
  assert.notEqual(formatPct(3001, 10000), "30");
});

test("AC5: 49 non-blank lines at 61% comments skip the ratio; one 8-line block still reports", () => {
  const repo = mkRepo("e258b-ac5-");
  write(repo, "small.ts", mkRatioFile(30, 49));
  assert.deepEqual(scanLines(runCheck(repo).stderr), []);
  write(repo, "small.ts", mkRatioFile(30, 49, 8));
  const r = runCheck(repo);
  assert.deepEqual(ratioHits(r.stderr), []);
  assert.equal(blockHits(r.stderr).length, 1);
  assert.match(blockHits(r.stderr)[0], /small\.ts:1 long-block 8 lines/);
});

test("AC6: JSDoc tag bodies are excluded from the block count, prose and @see are not, delimiters never count", () => {
  const repo = mkRepo("e258b-ac6-");
  const doc = (lines) => join(["/**", ...lines.map((l) => ` * ${l}`), " */", "export const v = 1;"]);
  const prose = (n) => Array.from({ length: n }, (_, i) => `prose ${i + 1}`);
  write(repo, "tags.ts", fs.readFileSync(path.join(FIX, "jsdoc-tags.fixture.txt"), "utf-8"));
  write(repo, "seven.ts", doc(prose(7)));
  write(repo, "eight.ts", doc(prose(8)));
  write(repo, "see.ts", doc([...prose(5), "@param x one", "@see a", "@see b", "@see c"]));
  const hits = blockHits(runCheck(repo).stderr);
  assert.equal(hits.length, 2, hits.join(" | "));
  assert.match(hits[0], /eight\.ts:1 long-block 8 lines/);
  assert.match(hits[1], /see\.ts:1 long-block 8 lines/);
});

test("AC7: literals are not comments, trailing comments are code, a blank splits a run, a span is one block", () => {
  const text = fs.readFileSync(path.join(FIX, "lexer-mix.fixture.txt"), "utf-8");
  const a = analyzeText(text);
  const kinds = a.lines.slice(0, 13).map((l) => l.kind);
  assert.deepEqual(kinds, [
    "code", "code", "code", "code", "code", "code",
    "comment", "comment", "blank", "comment", "comment", "comment", "code",
  ]);
  assert.deepEqual(a.blocks.map((b) => [b.start, b.end, b.counted]), [[7, 8, 2], [10, 12, 3]]);

  const repo = mkRepo("e258b-ac7-");
  const inTpl = ["const t = `", ...slash(10), "`;"];
  const trailing = Array.from({ length: 10 }, (_, i) => `run(${i}); // t`);
  write(repo, "quiet.ts", join([...inTpl, ...trailing, ...slash(4), "", ...slash(4)]));
  write(repo, "span.ts", join(["/*", ...Array.from({ length: 8 }, (_, i) => ` span ${i}`), " */"]));
  const hits = blockHits(runCheck(repo).stderr);
  assert.equal(hits.length, 1, hits.join(" | "));
  assert.match(hits[0], /span\.ts:1 long-block 8 lines/);
});

test("AC8: only .ts/.tsx/.js/.jsx/.mjs outside dist and node_modules are reported; symlink, >1 MiB and NUL files are skipped", () => {
  const repo = mkRepo("e258b-ac8-");
  const blk = join([...slash(8), ...code(1)]);
  const names = ["a.ts", "b.tsx", "c.js", "d.jsx", "e.mjs", "x.d.ts", "dist/y.js", "node_modules/z/i.js", "w.py"];
  for (const n of names) write(repo, n, blk);
  const outside = write(mkTmp("e258b-ac8-out-"), "target.ts", blk);
  fs.symlinkSync(outside, path.join(repo, "link.ts"));
  write(repo, "big.ts", blk + join(code(120000)));
  assert.ok(fs.statSync(path.join(repo, "big.ts")).size > 1048576);
  write(repo, "nul.ts", "\0" + blk);
  const paths = blockHits(runCheck(repo).stderr).map((l) => /^agc check — comments: (\S+):/.exec(l)[1]);
  assert.deepEqual(paths, ["a.ts", "b.tsx", "c.js", "d.jsx", "e.mjs"]);
});

test("AC8: isScannablePath applies the D3 name rules case-sensitively", () => {
  for (const ok of ["a.ts", "src/b.tsx", "c.js", "d.jsx", "e.mjs"]) assert.equal(isScannablePath(ok), true, ok);
  for (const no of ["x.d.ts", "dist/y.js", "a/node_modules/z.js", "w.py", "a.cjs", "a.mts", "A.TS"]) {
    assert.equal(isScannablePath(no), false, no);
  }
});

test("AC9: a branch's own commit, staged, unstaged and untracked additions are reported; deleted files are not", () => {
  const blk = (tag) => join([...slash(8, tag), ...code(1)]);
  const repo = mkRepo("e258b-ac9-");
  write(repo, "tracked.ts", join(code(2)));
  write(repo, "del.ts", blk("gone"));
  commitAll(repo);
  git(repo, ["checkout", "-q", "-b", "feat"]);
  write(repo, "onbranch.ts", blk("branch"));
  commitAll(repo, "branch work");
  write(repo, "tracked.ts", join([...code(2), ...slash(8)]));
  write(repo, "staged.ts", blk("staged"));
  git(repo, ["add", "staged.ts"]);
  write(repo, "untracked.ts", blk("loose"));
  fs.rmSync(path.join(repo, "del.ts"));
  const paths = blockHits(runCheck(repo).stderr).map((l) => /^agc check — comments: (\S+):/.exec(l)[1]);
  assert.deepEqual(paths, ["onbranch.ts", "staged.ts", "tracked.ts", "untracked.ts"]);
});

test("AC9: a configured upstream moves the base to the merge-base with it", () => {
  const blk = join([...slash(8), ...code(1)]);
  const repo = mkRepo("e258b-ac9-up-");
  git(repo, ["checkout", "-q", "-b", "feat"]);
  write(repo, "pushed.ts", blk);
  commitAll(repo, "pushed work");
  assert.equal(blockHits(runCheck(repo).stderr).length, 1, "without upstream the base is main");
  git(repo, ["branch", "up"]);
  git(repo, ["branch", "-q", "--set-upstream-to=up"]);
  write(repo, "fresh.ts", blk);
  const hits = blockHits(runCheck(repo).stderr);
  assert.equal(hits.length, 1, hits.join(" | "));
  assert.match(hits[0], /fresh\.ts:1 /);
});

test("AC9: with no main, master, upstream or remote ref only uncommitted and untracked work is reported", () => {
  const blk = join([...slash(8), ...code(1)]);
  const repo = mkRepo("e258b-ac9-trunk-", "trunk");
  write(repo, "old.ts", blk);
  commitAll(repo);
  write(repo, "new.ts", blk);
  const hits = blockHits(runCheck(repo).stderr);
  assert.equal(hits.length, 1, hits.join(" | "));
  assert.match(hits[0], /new\.ts:1 /);
});

test("AC9: parseAddedLines reads new-side hunk ranges, quoted and tab-suffixed paths, and ignores content lines shaped like headers", () => {
  const patch = [
    "diff --git a/x.ts b/x.ts",
    "--- a/x.ts",
    "+++ b/x.ts",
    "@@ -1,0 +2,3 @@ fn()",
    "+a",
    "+++ looks like a header",
    "+c",
    "@@ -9 +12 @@",
    "+d",
    "@@ -20,2 +0,0 @@",
    "diff --git a/my file.ts b/my file.ts",
    "--- a/my file.ts\t",
    "+++ b/my file.ts\t",
    "@@ -1 +1 @@",
    "+z",
    'diff --git "a/\\303\\251.ts" "b/\\303\\251.ts"',
    '--- "a/\\303\\251.ts"',
    '+++ "b/\\303\\251.ts"',
    "@@ -0,0 +1,2 @@",
    "+e",
    "diff --git a/gone.ts b/gone.ts",
    "--- a/gone.ts",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-x",
  ].join("\n");
  const m = parseAddedLines(patch);
  assert.deepEqual([...m.get("x.ts")].sort((p, q) => p - q), [2, 3, 4, 12]);
  assert.deepEqual([...m.get("my file.ts")], [1]);
  assert.deepEqual([...m.get("é.ts")], [1, 2]);
  assert.equal(m.has("gone.ts"), false);
  assert.equal(unquoteGitPath('"a\\tb\\\\c\\"d"'), 'a\tb\\c"d');
  assert.equal(unquoteGitPath("plain.ts"), "plain.ts");
});

test("AC10: outside git, and in a repo with no commit yet, nothing is printed and the exit code is unchanged", () => {
  const blk = join([...slash(9), ...code(1)]);
  const plain = mkTmp("e258b-ac10-plain-");
  const fresh = mkTmp("e258b-ac10-fresh-");
  git(fresh, ["init", "-q", "-b", "main"]);
  for (const ws of [plain, fresh]) {
    write(ws, "long.ts", blk);
    stamp(ws, VERSION);
    const r = runCheck(ws);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(scanLines(r.stderr), []);
    stamp(ws, "0.0.1");
    assert.equal(runCheck(ws).status, 1);
  }
});

test("AC11: 60 blocks list 50 hits, one more line naming 10 and one summary, all on stderr; a clean diff prints nothing", () => {
  const repo = mkRepo("e258b-ac11-");
  for (let i = 0; i < 60; i++) write(repo, `f${String(i).padStart(2, "0")}.ts`, join([...slash(8), ...code(1)]));
  const r = runCheck(repo);
  const lines = scanLines(r.stderr);
  assert.equal(lines.length, 52, lines.slice(-3).join(" | "));
  assert.equal(blockHits(r.stderr).length, 50);
  assert.equal(lines[50], `${PREFIX}: … 10 more warning(s) not listed`);
  assert.match(lines[51], /^agc check — comments: 60 warning\(s\) in 60 file\(s\) \(only \.ts\/\.tsx\/\.js\/\.jsx\/\.mjs are scanned\) — advisory; /);
  assert.ok(lines[0].includes("f00.ts:1") && lines[49].includes("f49.ts:1"), "sorted by path");
  assert.equal(r.stdout.includes(PREFIX), false);
  const clean = mkRepo("e258b-ac11-clean-");
  write(clean, "ok.ts", join(code(5)));
  assert.deepEqual(scanLines(runCheck(clean).stderr), []);
});

test("AC11: formatFindings escapes control characters in paths and returns [] for no findings", () => {
  assert.deepEqual(formatFindings([]), []);
  const out = formatFindings([{ kind: "long-block", path: "a\nb\x07.ts", line: 3, lines: 9 }]);
  assert.match(out[0], /^agc check — comments: a\\x0ab\\x07\.ts:3 long-block 9 lines/);
  assert.equal(out[0].includes("\n"), false);
});

test("AC11: findingsForFile puts the file-level ratio hit first and treats 'all' as every line added", () => {
  const a = analyzeText(mkRatioFile(40, 100, 8));
  const f = findingsForFile("p.ts", a, "all");
  assert.equal(f[0].kind, "high-ratio");
  assert.equal(f.filter((x) => x.kind === "long-block").length, 1);
  assert.deepEqual(findingsForFile("p.ts", a, new Set([100])).map((x) => x.kind), [], "code line only");
});

function mkPkgCopy(prefix, stub) {
  const pkg = mkTmp(prefix);
  fs.mkdirSync(path.join(pkg, "bin"));
  fs.copyFileSync(AGC_INIT, path.join(pkg, "bin", "agc-init.mjs"));
  fs.copyFileSync(path.join(ROOT, "package.json"), path.join(pkg, "package.json"));
  if (stub !== undefined) write(pkg, "dist/tools/comment-scan.js", stub);
  return { script: path.join(pkg, "bin", "agc-init.mjs"), dir: pkg };
}

test("AC12: an absent or throwing scan module prints one fixed comments.error line with no absolute path and keeps the exit code", () => {
  const ws = mkRepo("e258b-ac12-");
  write(ws, "long.ts", join([...slash(9), ...code(1)]));
  stamp(ws, VERSION);
  const baseline = runCheck(ws).status;
  const throwing = 'export function runCommentScan() { throw new Error("boom " + process.cwd()); }\n';
  const cases = [
    ["absent", mkPkgCopy("e258b-ac12-none-"), "cannot load dist/tools/comment-scan.js — run `npm run build`"],
    ["throwing", mkPkgCopy("e258b-ac12-throw-", throwing), "unexpected error"],
  ];
  for (const [label, pkg, why] of cases) {
    const r = runCheck(ws, pkg.script);
    assert.equal(r.status, baseline, label);
    const lines = scanLines(r.stderr);
    assert.deepEqual(lines, [`${PREFIX}: scan skipped (${why})`], label);
    assert.equal(lines[0].includes(pkg.dir) || lines[0].includes(ws), false, `${label}: no absolute path`);
  }
});

test("AC13: a plain adapter workspace prints no comments line, like the pinned-output cases in the existing suites", () => {
  const ws = mkTmp("e258b-ac13-");
  stamp(ws, VERSION);
  const r = runCheck(ws);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(scanLines(r.stderr), []);
});

test("AC14: an isolated copy of committed HEAD prints no comments line (smoke: base is HEAD, diff is empty)", () => {
  const copy = mkTmp("e258b-ac14-");
  const tar = path.join(mkTmp("e258b-ac14-tar-"), "head.tar");
  execFileSync("git", ["archive", "--format=tar", "-o", tar, "HEAD"], { cwd: ROOT, env: baseEnv() });
  execFileSync("tar", ["-xf", tar, "-C", copy]);
  git(copy, ["init", "-q", "-b", "main"]);
  commitAll(copy);
  const r = runCheck(copy);
  assert.deepEqual(scanLines(r.stderr), []);
});

test("AC14b: the scan module's own source has no block over 7 counted lines and a ratio of 30% or less", () => {
  // Contract: independent of git history, the module obeys the limits it enforces.
  const a = analyzeText(fs.readFileSync(path.join(ROOT, "tools", "comment-scan.ts"), "utf-8"));
  assert.ok(a.nonBlank > 50, "precondition: real content");
  assert.ok(Math.max(0, ...a.blocks.map((b) => b.counted)) <= 7, "longest block");
  assert.ok(a.commentLines * 100 <= 30 * a.nonBlank, `ratio ${a.commentLines}/${a.nonBlank}`);
});

test("AC14b: this test file obeys the same limits", () => {
  const a = analyzeText(fs.readFileSync(fileURLToPath(import.meta.url), "utf-8"));
  assert.ok(Math.max(0, ...a.blocks.map((b) => b.counted)) <= 7, "longest block");
  assert.ok(a.commentLines * 100 <= 30 * a.nonBlank, `ratio ${a.commentLines}/${a.nonBlank}`);
});

test("AC15: docs/install.md and docs/config.md describe the comment scan", () => {
  for (const f of ["docs/install.md", "docs/config.md"]) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf-8");
    const i = text.indexOf(PREFIX);
    assert.ok(i >= 0, `${f} has the prefix`);
    const para = text.slice(Math.max(0, i - 1500), i + 1500);
    for (const needle of ["advisory", "30%", "7", "50", "@param", ".mjs"]) assert.ok(para.includes(needle), `${f}: ${needle}`);
  }
});
