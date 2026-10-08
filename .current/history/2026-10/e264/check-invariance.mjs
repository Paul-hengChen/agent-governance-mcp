#!/usr/bin/env node
// Proves the e264 edits are comment-only: each changed tools/*.ts must be one
// of the four owned files and must transpile (removeComments) to the same JS
// at base and in the working tree (spec AC6); the grep-pinned tokens that
// test/lane-paths.test.mjs and test/lane-migrate.test.mjs allow-list keep
// their per-file counts across tools/* (spec AC5).
// Adapted from .current/e260b/check-invariance.mjs at 82cf48a.
// Usage: node .current/e264/check-invariance.mjs [base] | --self-test
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

// Run from the repo root so every path below is repo-relative.
process.chdir(git(["rev-parse", "--show-toplevel"]).trim());

const OWNED = new Set([
  "tools/lane-paths.ts",
  "tools/lane-migrate.ts",
  "tools/merge-invariants.ts",
  "tools/telemetry.ts",
]);

function resolveBase() {
  const arg = process.argv[2];
  if (arg) return arg;
  const f = path.join(".current", "e264", "base-sha");
  if (fs.existsSync(f)) {
    const line = fs.readFileSync(f, "utf8").split("\n")[0].trim();
    if (line) return line;
  }
  return "f1e6eb1";
}

const base = resolveBase();
try {
  git(["rev-parse", "--verify", `${base}^{commit}`]);
} catch {
  console.error(`cannot resolve base ${base}`);
  process.exit(2);
}

const lines = (s) => s.split("\n").filter(Boolean);
const changed = [
  ...new Set([
    ...lines(git(["diff", "--name-only", base, "--", "tools"])),
    ...lines(git(["ls-files", "--others", "--exclude-standard", "--", "tools"])),
  ]),
].sort();
if (changed.length === 0) {
  console.error("no changed tools/ files (vacuous pass refused)");
  process.exit(2);
}

let failed = false;
let checked = 0;
for (const p of changed) {
  if (!OWNED.has(p)) {
    console.log(`SCOPE ${p}`);
    failed = true;
    continue;
  }
  if (!fs.existsSync(p)) {
    console.log(`DELETED ${p}`);
    failed = true;
    continue;
  }
  const before = strip(git(["show", `${base}:${p}`]), p);
  const after = strip(fs.readFileSync(p, "utf8"), p);
  if (before !== after) {
    console.log(`DIFF ${p}`);
    failed = true;
  }
  checked++;
}

// Grep-pinned tokens (AC5): per-file occurrence count across tools/* must
// match base, since tests allow-list the files that contain each token.
const count = (s, needle) => s.split(needle).length - 1;
const TOKENS = ["lane-paths", "resolveLanePaths", "resolveCurrentLane", "migrateFlatToLaneLocked", "migrateFlatToLane(", "migrateLaneToFlat("];
const baseFiles = lines(git(["ls-tree", "-r", "--name-only", base, "--", "tools"]));
const nowFiles = lines(git(["ls-files", "--cached", "--others", "--exclude-standard", "--", "tools"])).filter((p) =>
  fs.existsSync(p),
);
const baseText = new Map(baseFiles.map((p) => [p, git(["show", `${base}:${p}`])]));
const nowText = new Map(nowFiles.map((p) => [p, fs.readFileSync(p, "utf8")]));
for (const p of [...new Set([...baseFiles, ...nowFiles])].sort()) {
  for (const t of TOKENS) {
    if (count(baseText.get(p) ?? "", t) !== count(nowText.get(p) ?? "", t)) {
      console.log(`PIN ${p} ${t}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`invariance OK: ${checked} files`);
