// Coded by @sr-engineer
// Integrator token-presence proof for e260c: for every path changed since base
// that also exists at base, each token below must appear in the same set of
// files at base and in the work tree. Paths added on the branch have no base
// text and are skipped (and counted). Usage: node .current/e260c/check-tokens.mjs [--base <sha>]
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";

const TOKENS = [
  "resolveLanePaths",
  "lane-paths",
  "resolveCurrentLane",
  "migrateFlatToLane(",
  "migrateLaneToFlat(",
  "migrateFlatToLaneLocked",
];

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const base = bi >= 0 ? args[bi + 1] : "b37178a";
if (!base) {
  console.error("missing value for --base");
  process.exit(2);
}

const git = (a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const changed = git(["diff", "--name-only", base]).split("\n").filter(Boolean);
const atBase = new Set(git(["ls-tree", "-r", "--name-only", base]).split("\n").filter(Boolean));

const checked = [];
let added = 0;
const bad = [];
for (const p of changed) {
  if (!atBase.has(p)) {
    added++;
    continue;
  }
  const before = git(["show", `${base}:${p}`]);
  const after = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  checked.push(p);
  for (const t of TOKENS) {
    const was = before.includes(t);
    const is = after.includes(t);
    if (was !== is) bad.push(`${p}: "${t}" ${was ? "present at base, missing now" : "absent at base, present now"}`);
  }
}

if (bad.length) {
  for (const line of bad) console.log(`tokens FAIL: ${line}`);
  process.exit(1);
}
console.log(`tokens OK: ${checked.length} files (${added} added on branch, skipped)`);
