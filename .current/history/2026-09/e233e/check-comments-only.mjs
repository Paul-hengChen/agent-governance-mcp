#!/usr/bin/env node
// Lane tooling for the test-comment rewrite (not shipped, not run by npm test).
// Usage: node .current/e233e/check-comments-only.mjs <base-ref>
//        node .current/e233e/check-comments-only.mjs --self-test
// Proves the diff against <base-ref> touched only comments in the owned test
// files: every changed path must sit in the owned set (or be a lane evidence
// artifact), and each owned file must transpile to identical output, with
// comments removed, before and after.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const OWNED = [
  /^test\/(r(a|el|ep|es|ev)[^/]*|[stuvw][^/]*)\.test\.mjs$/,
  /^test\/eval\/[^/]+\.mjs$/,
  /^test\/eval\/lib\/(bundle|assertions)\.mjs$/,
];
// Evidence and lane bookkeeping that may legitimately change; never comment-checked.
const LANE_ARTIFACTS = [
  /^\.current\/e233e\//,
  /^specs\/e233e-[^/]*\.md$/,
  /^(qa_reports|review_reports)\/[^/]*E233E[^/]*$/i,
];
const FORBIDDEN = [/^test\/eval\/fixtures\//, /^test\/fixtures\//, /^dist\//, /^docs\//, /^content\//];

const OPTS = {
  compilerOptions: { target: "ESNext", module: "ESNext", allowJs: true, removeComments: true },
};
export function strip(src, fileName = "x.mjs") {
  return ts.transpileModule(src, { ...OPTS, fileName }).outputText;
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), "e233e-probe-"));
  try {
    const a = join(dir, "a.mjs");
    writeFileSync(a, 'import x from "y";\n// AC-3 -> FM1\nconst n = 1; // (T-D4-01)\nassert.equal(n, 1, "msg");\n');
    const base = readFileSync(a, "utf8");
    const commentOnly = base.replace("// AC-3 -> FM1", "// pins the first-match rule (AC-3)").replace("// (T-D4-01)", "");
    const codeChange = base.replace("const n = 1;", "const n = 2;");
    const stringChange = base.replace('"msg"', '"msg2"');
    const okSame = strip(base) === strip(commentOnly);
    const failCode = strip(base) !== strip(codeChange);
    const failStr = strip(base) !== strip(stringChange);
    console.log(`self-test: comment-only edit equal=${okSame} (want true); code edit differs=${failCode} (want true); string edit differs=${failStr} (want true)`);
    process.exit(okSame && failCode && failStr ? 0 : 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const arg = process.argv[2];
if (arg === "--self-test") selfTest();
if (!arg) {
  console.error("usage: check-comments-only.mjs <base-ref> | --self-test");
  process.exit(2);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let statusLines;
try {
  // Working tree (staged + unstaged + committed) vs base, tracked files only.
  statusLines = git("diff", "--name-status", "--no-renames", arg).split("\n").filter(Boolean);
} catch (e) {
  console.error(`cannot diff against ${arg}: ${e.message}`);
  process.exit(2);
}

const problems = [];
let checked = 0;
for (const line of statusLines) {
  const [st, path] = line.split("\t");
  if (LANE_ARTIFACTS.some((r) => r.test(path))) continue;
  const inOwned = OWNED.some((r) => r.test(path));
  if (FORBIDDEN.some((r) => r.test(path)) || !inOwned) {
    problems.push(`path outside owned set: ${path}`);
    continue;
  }
  if (st !== "M") {
    problems.push(`owned file not a plain modification (${st}): ${path}`);
    continue;
  }
  const before = git("show", `${arg}:${path}`);
  const after = readFileSync(path, "utf8");
  if (strip(before, path) !== strip(after, path)) problems.push(`non-comment change: ${path}`);
  else checked++;
}
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  process.exit(1);
}
console.log(`comments-only OK: ${checked} files`);
