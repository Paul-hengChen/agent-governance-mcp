#!/usr/bin/env node
// Proves the e260b trim is comment-only: each changed tools/*.ts transpiles
// (removeComments) to the same JS at base and in the working tree; also
// asserts the comment-text pins three tests depend on (spec AC1, AC14).
// Usage: node .current/e260b/check-invariance.mjs [base] | --self-test
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const opts = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true };
const strip = (src, fileName) => ts.transpileModule(src, { fileName, compilerOptions: opts }).outputText;
const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

if (process.argv.includes("--self-test")) {
  const sample = "// a\nexport function f(x: number): number {\n  return x + 1; // b\n}\n";
  const commentEdit = "// a, reworded\n// extra line\nexport function f(x: number): number {\n  return x + 1;\n}\n";
  const codeEdit = sample + "export const g = 2;\n";
  const base = strip(sample, "s.ts");
  const ok = base !== strip(codeEdit, "s.ts") && base === strip(commentEdit, "s.ts");
  console.log(ok ? "self-test OK" : "self-test FAILED");
  process.exit(ok ? 0 : 1);
}

function resolveBase() {
  const arg = process.argv[2];
  if (arg) return arg;
  const f = path.join(".current", "e260b", "base-sha");
  if (fs.existsSync(f)) {
    const line = fs.readFileSync(f, "utf8").split("\n")[0].trim();
    if (line) return line;
  }
  return "b37178a";
}

const base = resolveBase();
try {
  git(["rev-parse", "--verify", `${base}^{commit}`]);
} catch {
  console.error(`cannot resolve base ${base}`);
  process.exit(2);
}

const files = git(["diff", "--name-only", base, "--", "tools"])
  .split("\n")
  .filter((p) => p.endsWith(".ts") && fs.existsSync(p));
if (files.length === 0) {
  console.error("no changed tools/*.ts files (vacuous pass refused)");
  process.exit(2);
}

let failed = false;
for (const p of files) {
  if (!/^[i-z]/.test(path.basename(p))) {
    console.log(`SCOPE ${p}`);
    failed = true;
    continue;
  }
  const before = strip(git(["show", `${base}:${p}`]), p);
  const after = strip(fs.readFileSync(p, "utf8"), p);
  if (before !== after) {
    console.log(`DIFF ${p}`);
    failed = true;
  }
}

const count = (s, needle) => s.split(needle).length - 1;
const pin = (file, name) => {
  console.log(`PIN ${file} ${name}`);
  failed = true;
};
const read = (p) => fs.readFileSync(p, "utf8");

if (!/^\s*\/\/ Watch mode \(E178b/m.test(read("tools/lane-status.ts"))) pin("tools/lane-status.ts", "// Watch mode (E178b");
if (count(read("tools/join-precondition.ts"), "HOOK POINT FOR E126") !== 1) pin("tools/join-precondition.ts", "HOOK POINT FOR E126");
const dep = "@deprecated v3.15.0:";
if (count(read("tools/storage.ts"), dep) !== count(git(["show", `${base}:tools/storage.ts`]), dep)) pin("tools/storage.ts", dep);

// Grep-pinned tokens (AC14): per-file occurrence count across tools/* must
// match base, since tests allow-list the files that contain each token.
const TOKENS = ["lane-paths", "resolveLanePaths", "resolveCurrentLane", "migrateFlatToLaneLocked", "migrateFlatToLane(", "migrateLaneToFlat("];
const baseFiles = git(["ls-tree", "-r", "--name-only", base, "--", "tools"]).split("\n").filter(Boolean);
const nowFiles = git(["ls-files", "--cached", "--others", "--exclude-standard", "--", "tools"])
  .split("\n")
  .filter((p) => p && fs.existsSync(p));
const baseText = new Map(baseFiles.map((p) => [p, git(["show", `${base}:${p}`])]));
const nowText = new Map(nowFiles.map((p) => [p, read(p)]));
for (const p of [...new Set([...baseFiles, ...nowFiles])].sort()) {
  for (const t of TOKENS) {
    if (count(baseText.get(p) ?? "", t) !== count(nowText.get(p) ?? "", t)) pin(p, t);
  }
}

if (failed) process.exit(1);
console.log(`invariance OK: ${files.length} files`);
