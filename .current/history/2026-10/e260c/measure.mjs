// Coded by @sr-engineer
// AC2 proof for e260c: lists comment blocks of 8+ counted lines in bin/ and
// scripts/ JS files, using the same analyzeText as `agc check`. `--ref <sha>`
// measures that commit's tree instead of the work tree (before counts).
// Usage: node .current/e260c/measure.mjs [--fail-over N] [--ref <sha>]
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
const ri = args.indexOf("--ref");
const ref = ri >= 0 ? args[ri + 1] : null;
if (ri >= 0 && !ref) {
  console.error("--ref needs a commit");
  process.exit(2);
}

const git = (a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const listing = ref ? ["ls-tree", "-r", "--name-only", ref, "--", "bin", "scripts"] : ["ls-files", "bin", "scripts"];
const files = git(listing)
  .split("\n")
  .filter((p) => /\.(m|c)?js$/.test(p));
const read = (p) => (ref ? git(["show", `${ref}:${p}`]) : fs.readFileSync(p, "utf8"));

let mid = 0;
let large = 0;
let longest = 0;
let commentLines = 0;
for (const p of files) {
  const a = analyzeText(read(p));
  commentLines += a.commentLines;
  for (const b of a.blocks) longest = Math.max(longest, b.counted);
  const long = a.blocks.filter((b) => b.counted >= 8);
  for (const b of long) {
    if (b.counted > 20) large++;
    else mid++;
  }
  if (long.length) console.log(`${p}: ${long.map((b) => `${b.start}:${b.counted}`).join(" ")}`);
}
console.log(`total: mid ${mid}, large ${large}, longest ${longest}`);
console.log(`files ${files.length}, comment lines ${commentLines}`);
if (failOver !== null && longest > failOver) {
  console.log(`FAIL: a block exceeds ${failOver} counted lines`);
  process.exit(1);
}
