// Coded by @sr-engineer
// AC2 proof for e260c: lists comment blocks of 8+ counted lines in bin/ and
// scripts/ JS files, using the same analyzeText as `agc check`.
// Usage: node .current/e260c/measure.mjs [--fail-over N]
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { analyzeText } from "../../dist/tools/comment-scan.js";

const args = process.argv.slice(2);
const fi = args.indexOf("--fail-over");
const failOver = fi >= 0 ? Number(args[fi + 1]) : null;
if (fi >= 0 && !Number.isInteger(failOver)) {
  console.error("--fail-over needs an integer");
  process.exit(2);
}

const files = execFileSync("git", ["ls-files", "bin", "scripts"], { encoding: "utf8" })
  .split("\n")
  .filter((p) => /\.(m|c)?js$/.test(p));

let mid = 0;
let large = 0;
let longest = 0;
for (const p of files) {
  const { blocks } = analyzeText(fs.readFileSync(p, "utf8"));
  const long = blocks.filter((b) => b.counted >= 8);
  for (const b of long) {
    if (b.counted > 20) large++;
    else mid++;
    longest = Math.max(longest, b.counted);
  }
  if (long.length) console.log(`${p}: ${long.map((b) => `${b.start}:${b.counted}`).join(" ")}`);
}
console.log(`total: mid ${mid}, large ${large}, longest ${longest}`);
if (failOver !== null && longest > failOver) {
  console.log(`FAIL: a block exceeds ${failOver} counted lines`);
  process.exit(1);
}
