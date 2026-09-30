// Coded by @qa-engineer
// Tests for specs/e234-hygiene-scan.md AC1-AC18: the advisory
// information-hygiene scan run by `agc check` (tools/hygiene-scan.ts, wired in
// bin/agc-init.mjs runCheck()).
//
// Test rules this file follows (spec Acceptance Criteria preamble):
// - Every hit-bearing input is built at runtime inside a temp repo or dir under
//   os.tmpdir(); nothing is written into this checkout.
// - Keywords are synthetic nonsense words only.
// - Every hit-shaped literal is assembled by concatenation (see `shape` below),
//   so this file itself never trips the scan it tests. AC16 proves that on a
//   copy of committed HEAD, which contains this file.
// - Hermetic env: every child run starts from `baseEnv()`, which deletes
//   AGC_HYGIENE_KEYWORDS and isolates git from system/global config. A case
//   that needs a keyword source sets one on purpose. A case that must have no
//   default keyword file uses its own temp git dir (every temp repo here has
//   one), never the common dir of the checkout running the suite.
//
// The AC-by-AC map to these tests lives in the QA review of this feature
// (qa_reports/archive/release-v4.2.0/review_T-E234-05.md).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  findShapeMatches,
  compileKeywordMatcher,
  maskText,
  runHygieneScan,
} from "../dist/tools/hygiene-scan.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const AGC_VERSION = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8")).version;

const PREFIX = "agc check — hygiene: ";

// ---------------------------------------------------------------------------
// Temp dirs + hermetic env
// ---------------------------------------------------------------------------

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

function mkTmp(prefix) {
  // realpath: on macOS os.tmpdir() is itself a symlinked path.
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  tmpDirs.push(d);
  return d;
}

const emptyGitConfig = path.join(mkTmp("e234-gitcfg-"), "empty.gitconfig");
fs.writeFileSync(emptyGitConfig, "");

function baseEnv(extra = {}) {
  const env = { ...process.env };
  delete env.AGC_HYGIENE_KEYWORDS;
  // Keep the ambient system/global git config (global excludes, hooks) out.
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = emptyGitConfig;
  // A non-git temp dir must never be resolved into some enclosing repo.
  env.GIT_CEILING_DIRECTORIES = fs.realpathSync(os.tmpdir());
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return env;
}

function git(cwd, args) {
  return execFileSync("git", ["-c", "user.email=qa@example.invalid", "-c", "user.name=qa", ...args], {
    cwd,
    env: baseEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function mkGitRepo(prefix) {
  const repo = mkTmp(prefix);
  git(repo, ["init", "-q"]);
  return repo;
}

function commitAll(repo) {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "--allow-empty", "-m", "fixture"]);
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function runCheck(cwd, envExtra = {}, script = AGC_INIT) {
  const r = spawnSync(process.execPath, [script, "check"], { cwd, env: baseEnv(envExtra), encoding: "utf-8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

function hygieneLines(stderr) {
  return stderr.split("\n").filter((l) => l.startsWith(PREFIX));
}

// Parses hyg.hit / hyg.hit.name lines; other hygiene lines return null.
function parseHit(line) {
  const body = line.slice(PREFIX.length);
  let m = /^(.+) \(file name\) ([a-z-]+)$/.exec(body);
  if (m) return { path: m[1], line: null, category: m[2] };
  m = /^(.+):(\d+) ([a-z-]+)$/.exec(body);
  if (m) return { path: m[1], line: Number(m[2]), category: m[3] };
  return null;
}

function hits(stderr) {
  return hygieneLines(stderr).map(parseHit).filter((h) => h !== null);
}

function hitKeys(stderr) {
  return hits(stderr).map((h) => `${h.path}:${h.line === null ? "name" : h.line} ${h.category}`);
}

// ---------------------------------------------------------------------------
// Hit-shaped inputs, assembled by concatenation so no contiguous literal in
// this file matches a pattern. Keywords are synthetic nonsense.
// ---------------------------------------------------------------------------

const SEG = "zqvuserx"; // a non-placeholder username segment
const KW_A = "zorblax";
const KW_B = "quuxfrob";
const FILE_KEY = "Qm7Rt2Wx9Lp4Kz";
const CRED_BODY = "Zq9Wm3Rt7Yp2".repeat(3); // 36 alphanumerics

const shape = {
  "home-path": (seg = SEG) => "/" + "Us" + "ers" + "/" + seg + "/proj",
  "encoded-home-path": (seg = SEG) => "-" + "Us" + "ers" + "-" + seg + "-proj",
  "temp-path": () => "/pri" + "vate" + "/va" + "r/fol" + "ders" + "/ab/cd",
  "design-file-key": () => "https://www." + "fig" + "ma" + ".com" + "/fi" + "le/" + FILE_KEY,
  credential: () => "g" + "hp" + "_" + CRED_BODY,
  "work-item-link": () => "https:" + "//" + "dev.az" + "ure" + ".com/org/proj/_workitems/edit/1",
  "internal-host": () => "https:" + "//" + "wiki.zqv" + ".co" + "rp/page",
};
const SHAPE_CATEGORIES = Object.keys(shape);

function adapterStamp(ws, version) {
  fs.writeFileSync(path.join(ws, "CLAUDE.md"), `<!-- agc-version: ${version} -->\n# adapter\n`);
}

// A repo holding one hit per category (every shape category + a keyword from
// the repo's own default keyword file), optionally with the hits removed.
function mkEveryCategoryRepo(prefix, { withHits }) {
  const repo = mkGitRepo(prefix);
  fs.writeFileSync(path.join(repo, ".git", "agc-hygiene-keywords"), KW_A + "\n");
  const lines = withHits ? [...SHAPE_CATEGORIES.map((c) => shape[c]()), `the ${KW_A} project`] : ["clean text"];
  write(repo, "notes.txt", lines.join("\n") + "\n");
  commitAll(repo);
  return repo;
}

// ---------------------------------------------------------------------------
// AC1 — exit-code invariance
// ---------------------------------------------------------------------------

test("AC1: agc check exit code is the same with and without hits — 0 with current adapters, 1 with stale ones", () => {
  // Contract: the scan is advisory. Whatever it finds, agc check's exit code
  // is decided by the adapter-stamp check alone ("never changes the exit
  // code in any branch"), so CI can never fail over a hygiene finding. (spec D5)
  for (const [version, expected] of [
    [AGC_VERSION, 0],
    ["0.0.1", 1],
  ]) {
    const dirty = mkEveryCategoryRepo("e234-ac1-dirty-", { withHits: true });
    const clean = mkEveryCategoryRepo("e234-ac1-clean-", { withHits: false });
    adapterStamp(dirty, version);
    adapterStamp(clean, version);
    const rd = runCheck(dirty);
    const rc = runCheck(clean);
    assert.equal(rc.status, expected, `clean baseline exit (stderr=${rc.stderr})`);
    assert.equal(rd.status, rc.status, `hits must not change the exit code (stderr=${rd.stderr})`);
    const cats = new Set(hits(rd.stderr).map((h) => h.category));
    for (const c of [...SHAPE_CATEGORIES, "keyword"]) assert.ok(cats.has(c), `precondition: ${c} hit present`);
    assert.deepEqual(hits(rc.stderr), [], "clean baseline has no hits");
  }
});

// ---------------------------------------------------------------------------
// AC2 — shape coverage with 1-based line numbers
// ---------------------------------------------------------------------------

test("AC2: each of the seven shape categories reports a hit line with the correct 1-based line number", () => {
  // Contract: every shape in the spec's shape table is detected, and the line
  // number points at the offending line (grep/IDE-clickable), counted from 1.
  // (spec D2)
  const repo = mkGitRepo("e234-ac2-");
  SHAPE_CATEGORIES.forEach((c, i) => {
    const pad = Array.from({ length: i + 1 }, () => "clean line");
    write(repo, `shape-${i}.txt`, [...pad, `see ${shape[c]()} here`, "tail"].join("\n") + "\n");
  });
  commitAll(repo);
  const r = runCheck(repo);
  assert.equal(r.status, 0);
  const keys = hitKeys(r.stderr);
  SHAPE_CATEGORIES.forEach((c, i) => {
    assert.ok(keys.includes(`shape-${i}.txt:${i + 2} ${c}`), `${c} expected at shape-${i}.txt:${i + 2}; got ${keys}`);
  });
  assert.equal(keys.length, SHAPE_CATEGORIES.length, `exactly one hit per category file; got ${keys}`);
});

// ---------------------------------------------------------------------------
// AC3 — no echo
// ---------------------------------------------------------------------------

test("AC3: neither stdout nor stderr ever contains a matched substring", () => {
  // Contract: the scan exists to stop leaks, so its own output must never
  // become one — no keyword, username segment, file key or credential body,
  // in content hits or in printed paths.
  const repo = mkEveryCategoryRepo("e234-ac3-", { withHits: true });
  // A printed path that itself carries the keyword (masked in the report).
  write(repo, `dir/${KW_A}-note.txt`, shape["home-path"]() + "\n");
  const r = runCheck(repo);
  assert.equal(r.status, 0);
  assert.ok(hits(r.stderr).length >= SHAPE_CATEGORIES.length + 1, "precondition: hits were found");
  const out = r.stdout + r.stderr;
  for (const secret of [KW_A, SEG, FILE_KEY, CRED_BODY]) {
    assert.ok(!out.toLowerCase().includes(secret.toLowerCase()), `output must not contain ${secret.length}-char matched text`);
  }
});

// ---------------------------------------------------------------------------
// AC4 — file-name hits, masked
// ---------------------------------------------------------------------------

test("AC4: an untracked file whose name holds a keyword gets a masked (file name) keyword line", () => {
  // Contract: file names are scanned too (human ruling 1), and a printed name
  // is masked so the report cannot reveal the keyword it found.
  const repo = mkGitRepo("e234-ac4-");
  fs.writeFileSync(path.join(repo, ".git", "agc-hygiene-keywords"), KW_A + "\n");
  write(repo, "README.md", "clean\n");
  commitAll(repo);
  write(repo, `notes-${KW_A}.md`, "clean body\n"); // untracked, not ignored
  const r = runCheck(repo);
  assert.equal(r.status, 0);
  assert.deepEqual(hitKeys(r.stderr), ["notes-***.md:name keyword"]);
  assert.ok(!(r.stdout + r.stderr).toLowerCase().includes(KW_A), "keyword must appear nowhere");
});

// ---------------------------------------------------------------------------
// AC5 — scan set
// ---------------------------------------------------------------------------

test("AC5: tracked and untracked-non-ignored files are scanned; a gitignored file is not", () => {
  // Contract: the scan set is `git ls-files --cached --others --exclude-standard`,
  // so new drafts are caught before commit and ignored files never are. (spec D4)
  const repo = mkGitRepo("e234-ac5-");
  write(repo, ".gitignore", "ignored.txt\n");
  write(repo, "tracked.txt", shape["home-path"]() + "\n");
  commitAll(repo);
  write(repo, "untracked.txt", shape["home-path"]() + "\n");
  write(repo, "ignored.txt", shape["home-path"]() + "\n");
  const r = runCheck(repo);
  assert.equal(r.status, 0);
  assert.deepEqual(hitKeys(r.stderr).sort(), ["tracked.txt:1 home-path", "untracked.txt:1 home-path"]);
});

// ---------------------------------------------------------------------------
// AC6 — keyword source precedence
// ---------------------------------------------------------------------------

test("AC6: a non-empty AGC_HYGIENE_KEYWORDS wins; unset or empty falls back to the git-common-dir default, shared by linked worktrees", () => {
  // Contract: keyword-source precedence. The default file sits in the git
  // common dir so every worktree of one repo shares one untracked list. (spec D1)
  const repo = mkGitRepo("e234-ac6-");
  fs.writeFileSync(path.join(repo, ".git", "agc-hygiene-keywords"), KW_A + "\n");
  write(repo, "a.txt", `${KW_A}\n${KW_B}\n`);
  commitAll(repo);
  const envFile = write(mkTmp("e234-ac6-env-"), "kw.txt", KW_B + "\n");

  const kwKeys = (r) => hitKeys(r.stderr).filter((k) => k.endsWith(" keyword"));
  assert.deepEqual(kwKeys(runCheck(repo, { AGC_HYGIENE_KEYWORDS: envFile })), ["a.txt:2 keyword"], "env var wins");
  assert.deepEqual(kwKeys(runCheck(repo)), ["a.txt:1 keyword"], "unset → default file");
  assert.deepEqual(kwKeys(runCheck(repo, { AGC_HYGIENE_KEYWORDS: "" })), ["a.txt:1 keyword"], "empty → default file");

  const wt = path.join(mkTmp("e234-ac6-wt-"), "wt");
  git(repo, ["worktree", "add", "-q", "-b", "wtb", wt]);
  assert.deepEqual(kwKeys(runCheck(wt)), ["a.txt:1 keyword"], "linked worktree uses the shared common dir default");
});

// ---------------------------------------------------------------------------
// AC7 — no keyword source / unreadable source
// ---------------------------------------------------------------------------

test("AC7: with no keyword source shape hits still report plus exactly one hyg.kw.none; a missing env path prints one hyg.kw.unreadable without the path", () => {
  // Contract: the keyword layer degrades to a one-line explanation, never to
  // silence or an error, and the explanation never echoes a path.
  const repo = mkGitRepo("e234-ac7-");
  write(repo, "a.txt", shape["home-path"]() + "\n");
  commitAll(repo);

  const none = runCheck(repo);
  assert.equal(none.status, 0);
  assert.deepEqual(hitKeys(none.stderr), ["a.txt:1 home-path"]);
  const kwNone =
    PREFIX +
    "no keyword list found — only built-in shape patterns ran " +
    "(set AGC_HYGIENE_KEYWORDS or create agc-hygiene-keywords in the git common dir)";
  assert.equal(hygieneLines(none.stderr).filter((l) => l === kwNone).length, 1);

  const missing = path.join(mkTmp("e234-ac7-miss-"), "qqzmissingdir", "kwlist");
  const un = runCheck(repo, { AGC_HYGIENE_KEYWORDS: missing });
  assert.equal(un.status, 0);
  const kwUnreadable = PREFIX + "keyword list named by AGC_HYGIENE_KEYWORDS cannot be read — only built-in shape patterns ran";
  assert.equal(hygieneLines(un.stderr).filter((l) => l === kwUnreadable).length, 1);
  assert.ok(!hygieneLines(un.stderr).includes(kwNone), "unreadable replaces none");
  assert.ok(!(un.stdout + un.stderr).includes("qqzmissingdir"), "the path must not be echoed");
  assert.deepEqual(hitKeys(un.stderr), ["a.txt:1 home-path"], "shape layer still runs");
});

// ---------------------------------------------------------------------------
// AC8 — never under .current/
// ---------------------------------------------------------------------------

test("AC8: a keyword list under the workspace's .current/ is refused and no keyword hit is reported", () => {
  // Contract: .current/ is tracked in repo mode, so a keyword list there would
  // itself be the leak; it is refused by construction (human ruling 2).
  const repo = mkGitRepo("e234-ac8-");
  const kwFile = write(repo, ".current/kw.txt", KW_A + "\n");
  write(repo, "a.txt", `${KW_A}\n`);
  commitAll(repo);
  for (const value of [kwFile, ".current/kw.txt"]) {
    const r = runCheck(repo, { AGC_HYGIENE_KEYWORDS: value });
    assert.equal(r.status, 0);
    const refused = PREFIX + "keyword list under .current/ refused (it may be tracked) — move it outside the repo; only built-in shape patterns ran";
    assert.equal(hygieneLines(r.stderr).filter((l) => l === refused).length, 1, `refused once for ${value === kwFile ? "absolute" : "relative"} path`);
    assert.deepEqual(hits(r.stderr).filter((h) => h.category === "keyword"), []);
  }
});

// ---------------------------------------------------------------------------
// AC9 — keyword file format + word boundaries
// ---------------------------------------------------------------------------

test("AC9: comments, blanks, whitespace and 1-char entries are ignored; matching is case-insensitive, ASCII-word-bounded and literal", () => {
  // Contract: keyword-file format and matching. A word boundary keeps a
  // keyword from firing inside a longer identifier; literal matching means a
  // keyword with regex metacharacters can never widen into a pattern. (spec D1)
  const repo = mkGitRepo("e234-ac9-");
  write(repo, "main.txt", ["Zorblax-app", "zorblaxing", "zorblax_x", "a lone q here", "qwyxxc appears"].join("\n") + "\n");
  write(repo, "meta.txt", ["vq.zk", "vqazk", "(rr)+", "rrrr", "p|w", "p w"].join("\n") + "\n");
  commitAll(repo);
  const kwFile = write(
    mkTmp("e234-ac9-kw-"),
    "kw.txt",
    ["# qwyxxc", "", `   ${KW_A}   `, "q", "vq.zk", "(rr)+", "p|w"].join("\n") + "\n"
  );
  const r = runCheck(repo, { AGC_HYGIENE_KEYWORDS: kwFile });
  assert.equal(r.status, 0);
  const kw = hitKeys(r.stderr).filter((k) => k.endsWith(" keyword"));
  assert.deepEqual(
    kw.filter((k) => k.startsWith("main.txt")),
    ["main.txt:1 keyword"],
    "only Zorblax-app matches; -ing/_x suffixes, the 1-char entry and the comment do not"
  );
  assert.deepEqual(
    kw.filter((k) => k.startsWith("meta.txt")),
    ["meta.txt:1 keyword", "meta.txt:3 keyword", "meta.txt:5 keyword"],
    "metacharacter keywords match only their literal text"
  );
});

// ---------------------------------------------------------------------------
// AC10 — placeholder usernames
// ---------------------------------------------------------------------------

test("AC10: placeholder username segments are skipped and counted, only the real one is listed (home-path and encoded-home-path)", () => {
  // Contract: docs use placeholder home paths; those are counted in one
  // skipped line instead of flooding the report. (spec D3, human ruling 3)
  for (const cat of ["home-path", "encoded-home-path"]) {
    const repo = mkGitRepo("e234-ac10-");
    const segs = ["me", "<name>", "$USER", "…", SEG];
    write(repo, "a.txt", segs.map((s) => shape[cat](s)).join("\n") + "\n");
    commitAll(repo);
    const r = runCheck(repo);
    assert.equal(r.status, 0);
    assert.deepEqual(hitKeys(r.stderr), [`a.txt:5 ${cat}`], `${cat}: only the non-placeholder line`);
    const skipped = hygieneLines(r.stderr).filter((l) => l.includes("with a placeholder username"));
    assert.deepEqual(skipped, [PREFIX + "skipped 4 home-path hit(s) with a placeholder username"], cat);
  }
});

// ---------------------------------------------------------------------------
// AC11 — keyword file self-exclusion + tracked warning
// ---------------------------------------------------------------------------

test("AC11: an in-workspace keyword list is never content-scanned; a tracked one prints hyg.kw.tracked once", () => {
  // Contract: the list necessarily contains every keyword, so scanning it
  // would always hit; and a tracked list is itself a leak worth one warning.
  const tracked = PREFIX + "warning: the keyword list is a tracked file — move it outside the repo and untrack it";

  const repo = mkGitRepo("e234-ac11-");
  write(repo, "README.md", "clean\n");
  commitAll(repo);
  write(repo, "kwlist.txt", `${KW_A}\n${shape["home-path"]()}\n`); // untracked, not ignored
  const r1 = runCheck(repo, { AGC_HYGIENE_KEYWORDS: "kwlist.txt" });
  assert.equal(r1.status, 0);
  assert.deepEqual(hits(r1.stderr).filter((h) => h.path === "kwlist.txt" && h.line !== null), []);
  assert.ok(!hygieneLines(r1.stderr).includes(tracked), "untracked list: no tracked warning");

  commitAll(repo);
  const r2 = runCheck(repo, { AGC_HYGIENE_KEYWORDS: path.join(repo, "kwlist.txt") });
  assert.equal(r2.status, 0);
  assert.equal(hygieneLines(r2.stderr).filter((l) => l === tracked).length, 1);
  assert.deepEqual(hits(r2.stderr).filter((h) => h.path === "kwlist.txt" && h.line !== null), []);
});

// ---------------------------------------------------------------------------
// AC12 — output cap + summary
// ---------------------------------------------------------------------------

test("AC12: 60 hits list exactly 50 lines, then a more line naming 10 and a summary naming 60", () => {
  // Contract: a cap on printed hits keeps the output readable; the summary
// still counts all. (spec D5)
  const repo = mkGitRepo("e234-ac12-");
  write(repo, "many.txt", Array.from({ length: 60 }, (_, i) => shape["home-path"](SEG + i)).join("\n") + "\n");
  commitAll(repo);
  const r = runCheck(repo);
  assert.equal(r.status, 0);
  const lines = hygieneLines(r.stderr);
  const hitIdx = lines.map((l, i) => (parseHit(l) ? i : -1)).filter((i) => i >= 0);
  assert.equal(hitIdx.length, 50);
  const more = PREFIX + "… 10 more hit(s) not listed";
  const summary =
    PREFIX +
    "60 hit(s) in 1 file(s) — advisory; describe each by class, never the literal text (constitution §6 Information hygiene)";
  assert.equal(lines[hitIdx[49] + 1], more, "more line follows the list");
  assert.equal(lines[hitIdx[49] + 2], summary, "summary follows the more line");
});

// ---------------------------------------------------------------------------
// AC13 — binary / large / symlink skip
// ---------------------------------------------------------------------------

test("AC13: a NUL-bearing file, a >1 MiB file and a tracked symlink give no content hit; a hit in a name still reports", () => {
  // Contract: binaries, huge files and symlink targets are not read; file
  // names are still checked. (spec D4)
  const repo = mkGitRepo("e234-ac13-");
  const hit = shape["home-path"]() + "\n";
  write(repo, "blob.dat", Buffer.concat([Buffer.from("x\0y\n"), Buffer.from(hit)]));
  write(repo, "big.txt", hit + "a".repeat(1024 * 1024 + 16) + "\n");
  const outside = write(mkTmp("e234-ac13-out-"), "target.txt", hit);
  fs.symlinkSync(outside, path.join(repo, `link-${KW_A}`));
  commitAll(repo);
  const kwFile = write(mkTmp("e234-ac13-kw-"), "kw.txt", KW_A + "\n");
  const r = runCheck(repo, { AGC_HYGIENE_KEYWORDS: kwFile });
  assert.equal(r.status, 0);
  assert.equal(git(repo, ["ls-files", "-s", `link-${KW_A}`]).slice(0, 6), "120000", "precondition: tracked symlink");
  assert.deepEqual(hitKeys(r.stderr), ["link-***:name keyword"]);
});

// ---------------------------------------------------------------------------
// AC14 — no-git workspace
// ---------------------------------------------------------------------------

test("AC14: outside git the walk reports shape and keyword hits, skips node_modules/, and keeps the exit code", () => {
  // Contract: outside a git repo the scan walks the directory. The env keyword
  // source is still honoured, and vendored dependencies are skipped because
  // they are not the maintainer's text. (spec D4)
  const ws = mkTmp("e234-ac14-");
  write(ws, "hit.txt", `${shape["home-path"]()}\n${KW_A}\n`);
  write(ws, "node_modules/pkg/hit.txt", `${shape["home-path"]()}\n${KW_A}\n`);
  const kwFile = write(mkTmp("e234-ac14-kw-"), "kw.txt", KW_A + "\n");
  const r = runCheck(ws, { AGC_HYGIENE_KEYWORDS: kwFile });
  const clean = mkTmp("e234-ac14-clean-");
  assert.equal(r.status, runCheck(clean, { AGC_HYGIENE_KEYWORDS: kwFile }).status);
  assert.equal(r.status, 0);
  assert.deepEqual(hitKeys(r.stderr), ["hit.txt:1 home-path", "hit.txt:2 keyword"]);
});

// ---------------------------------------------------------------------------
// AC15 — silence + resilience
// ---------------------------------------------------------------------------

function mkPkgCopy(prefix, stubModule) {
  const pkg = mkTmp(prefix);
  fs.mkdirSync(path.join(pkg, "bin"));
  fs.copyFileSync(AGC_INIT, path.join(pkg, "bin", "agc-init.mjs"));
  fs.copyFileSync(path.join(PROJECT_ROOT, "package.json"), path.join(pkg, "package.json"));
  if (stubModule !== undefined) write(pkg, "dist/tools/hygiene-scan.js", stubModule);
  return path.join(pkg, "bin", "agc-init.mjs");
}

test("AC15: a clean workspace with a keyword list prints no hygiene line; a module that fails to load or throws prints one hyg.error line and keeps the exit code", () => {
  // Contract: silence (no noise when nothing is wrong) and resilience (the
  // advisory can never break agc check). (spec D5)
  const clean = mkGitRepo("e234-ac15-clean-");
  fs.writeFileSync(path.join(clean, ".git", "agc-hygiene-keywords"), KW_A + "\n");
  write(clean, "README.md", "nothing to see\n");
  commitAll(clean);
  const rc = runCheck(clean);
  assert.equal(rc.status, 0);
  assert.deepEqual(hygieneLines(rc.stderr), []);

  const dirty = mkEveryCategoryRepo("e234-ac15-dirty-", { withHits: true });
  const baseline = runCheck(dirty).status;
  const errLine = /^agc check — hygiene: scan skipped \(.+\)$/;
  for (const [label, script] of [
    ["load failure", mkPkgCopy("e234-ac15-noload-")],
    ["throwing module", mkPkgCopy("e234-ac15-throw-", 'export function runHygieneScan() { throw new Error("boom"); }\n')],
  ]) {
    const r = runCheck(dirty, {}, script);
    assert.equal(r.status, baseline, `${label}: exit code unchanged (stderr=${r.stderr})`);
    const lines = hygieneLines(r.stderr);
    assert.equal(lines.length, 1, `${label}: exactly one hygiene line; got ${lines}`);
    assert.match(lines[0], errLine, label);
  }

  // In-module throw: runHygieneScan catches, prints one hyg.error, never throws.
  const out = [];
  const env = new Proxy({}, { get() { throw new Error("env boom"); } });
  assert.equal(runHygieneScan(clean, { env, write: (l) => out.push(l) }), null);
  assert.equal(out.length, 1);
  assert.match(out[0], errLine);
});

// ---------------------------------------------------------------------------
// AC16 — this repo stays readable, hermetic
// ---------------------------------------------------------------------------

test("AC16: an isolated copy of committed HEAD lists zero hits — only hyg.kw.none and at most one hyg.skipped line", () => {
  // Contract: the lane's own spec, tests, evidence and module source must not
  // match themselves. Run on `git archive HEAD` extracted into a fresh repo
  // with its own git dir, never in the live checkout: untracked drafts there,
  // or the integrator's real keyword file in the shared common dir, would
  // change the result.
  const copy = mkTmp("e234-ac16-");
  const tar = path.join(mkTmp("e234-ac16-tar-"), "head.tar");
  execFileSync("git", ["archive", "--format=tar", "-o", tar, "HEAD"], { cwd: PROJECT_ROOT, env: baseEnv() });
  execFileSync("tar", ["-xf", tar, "-C", copy]);
  git(copy, ["init", "-q"]);
  commitAll(copy);
  const r = spawnSync(process.execPath, [path.join("bin", "agc-init.mjs"), "check"], {
    cwd: copy,
    env: baseEnv(),
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const lines = hygieneLines(r.stderr);
  assert.deepEqual(hits(r.stderr), [], `zero listed hits; got ${lines.join(" | ")}`);
  const kwNone =
    PREFIX +
    "no keyword list found — only built-in shape patterns ran " +
    "(set AGC_HYGIENE_KEYWORDS or create agc-hygiene-keywords in the git common dir)";
  const others = lines.filter((l) => l !== kwNone);
  assert.equal(lines.length - others.length, 1, "exactly one hyg.kw.none");
  assert.ok(others.length <= 1, `at most one other line; got ${others}`);
  if (others.length === 1) assert.match(others[0], /^agc check — hygiene: skipped \d+ home-path hit\(s\) with a placeholder username$/);
});

// ---------------------------------------------------------------------------
// AC17 — docs sync (content half; the diff-scope half is the spec's git diff
// proof, logged in the review doc)
// ---------------------------------------------------------------------------

test("AC17: docs/install.md and docs/config.md describe the hygiene scan (advisory, env var, default file, categories, never echoed)", () => {
  // Contract: users learn about the keyword source from the docs, not the code.
  for (const rel of ["docs/install.md", "docs/config.md"]) {
    const text = fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
    assert.match(text, /AGC_HYGIENE_KEYWORDS/, `${rel}: env var named`);
    assert.match(text, /agc-hygiene-keywords/, `${rel}: default file named`);
    assert.match(text, /advisory/i, `${rel}: advisory`);
    assert.match(text, /echo/i, `${rel}: never echoed`);
  }
  const install = fs.readFileSync(path.join(PROJECT_ROOT, "docs/install.md"), "utf-8");
  for (const c of [...SHAPE_CATEGORIES, "keyword"]) assert.ok(install.includes(c), `docs/install.md names category ${c}`);
});

// ---------------------------------------------------------------------------
// AC18 — masking ignores word boundaries
// ---------------------------------------------------------------------------

test("AC18: a keyword glued to an underscore in a file name is masked in a content-hit path, and is not a keyword hit", () => {
  // Contract: detection keeps the keyword word boundaries, masking does not,
  // so a printed path can never leak a keyword the detector skipped.
  // (spec D5 amendment, D1)
  const repo = mkGitRepo("e234-ac18-");
  fs.writeFileSync(path.join(repo, ".git", "agc-hygiene-keywords"), KW_A + "\n");
  write(repo, `${KW_A}_notes.md`, shape["home-path"]() + "\n");
  commitAll(repo);
  const r = runCheck(repo);
  assert.equal(r.status, 0);
  assert.deepEqual(hitKeys(r.stderr), ["***_notes.md:1 home-path"]);
  assert.ok(!(r.stdout + r.stderr).toLowerCase().includes(KW_A), "keyword must appear nowhere");
});

// ---------------------------------------------------------------------------
// Cases an earlier code review found by running the scan (T-E234-01)
// ---------------------------------------------------------------------------

test("regression (review round 1): design-file-key stays linear on a long dotted line", () => {
  // Contract: one file must not be able to stall agc check (a release gate).
  // Before the fix a 40k-char dotted run took ~1.4 s and grew quadratically;
  // 200k chars would take tens of seconds. Linear time is a few ms.
  const line = "a.".repeat(100_000);
  const t0 = process.hrtime.bigint();
  const found = findShapeMatches(line);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.deepEqual(found, []);
  assert.ok(ms < 1000, `findShapeMatches took ${ms.toFixed(1)} ms on a 200k-char dotted line`);
  // The positive shape still matches after the lookbehind change.
  assert.deepEqual(findShapeMatches(shape["design-file-key"]()).map((s) => s.category), ["design-file-key"]);
});

test("regression (review round 2): maskText terminates and masks a keyword that starts with a non-BMP code point", { timeout: 10_000 }, () => {
  // Contract: under the u flag a lastIndex inside a surrogate pair snaps back,
  // so a hand-rolled exec loop that advanced one code unit never ended and
  // agc check died out of memory (exit 134). Keywords may be non-ASCII. (spec D1)
  const emojiKw = String.fromCodePoint(0x1f9ea, 0x1f9f2);
  const extBKw = String.fromCodePoint(0x20bb7) + "q";
  const m = compileKeywordMatcher([emojiKw, extBKw]);
  assert.ok(m !== null);
  assert.equal(maskText(`dir/${emojiKw}_notes.md`, m), "dir/***_notes.md");
  assert.equal(maskText(`${emojiKw}${emojiKw}.md`, m), "***.md");
  assert.equal(maskText(`x_${extBKw}_${extBKw.toUpperCase()}.md`, m), "x_***_***.md");
  // A lone leading non-BMP char that is not a keyword is left alone.
  assert.equal(maskText(String.fromCodePoint(0x1f9ea) + "_plain.md", m), String.fromCodePoint(0x1f9ea) + "_plain.md");
});
