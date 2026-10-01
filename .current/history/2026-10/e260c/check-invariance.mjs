// Coded by @sr-engineer
// AC1 proof for e260c: every changed JS file under bin/ and scripts/ must
// transpile (comments removed) to the same bytes at base and in the work tree.
// Usage: node .current/e260c/check-invariance.mjs [--base <sha>]
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import ts from "typescript";

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const base = bi >= 0 ? args[bi + 1] : "b37178a";
if (!base) {
  console.error("missing value for --base");
  process.exit(2);
}

const git = (a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const paths = git(["diff", "--name-only", base, "--", "bin", "scripts"])
  .split("\n")
  .filter((p) => /\.(m|c)?js$/.test(p));

const strip = (text, fileName) =>
  ts.transpileModule(text, {
    compilerOptions: { removeComments: true, target: "ES2022", module: "ESNext" },
    fileName,
  }).outputText;

const bad = [];
for (const p of paths) {
  if (!fs.existsSync(p)) {
    bad.push(`${p} (deleted)`);
    continue;
  }
  const before = strip(git(["show", `${base}:${p}`]), p);
  const after = strip(fs.readFileSync(p, "utf8"), p);
  if (before !== after) bad.push(p);
}

if (bad.length) {
  for (const p of bad) console.log(`invariance FAIL: ${p}`);
  process.exit(1);
}
console.log(`invariance OK: ${paths.length} files`);
