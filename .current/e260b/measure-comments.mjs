#!/usr/bin/env node
// Counts comment blocks in tools/{i..z}*.ts with the same analyzeText that
// agc check uses, and cross-checks every 8-20 line block against the
// "Kept 8-20 line blocks" table in specs/e260b-rationale.md (spec AC2, AC3).
// Run from the lane root after `npm run build`.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const scanPath = path.resolve("dist/tools/comment-scan.js");
if (!fs.existsSync(scanPath)) {
  console.error("dist/tools/comment-scan.js missing — run npm run build");
  process.exit(2);
}
const { analyzeText } = await import(pathToFileURL(scanPath).href);

const files = execFileSync("git", ["ls-files", "--", "tools"], { encoding: "utf8" })
  .split("\n")
  .filter((p) => /^tools\/[i-z][^/]*\.ts$/.test(p));
if (files.length !== 23) {
  console.error(`expected 23 files, found ${files.length}`);
  process.exit(2);
}

function keptKeys() {
  const f = "specs/e260b-rationale.md";
  if (!fs.existsSync(f)) return new Set();
  const lines = fs.readFileSync(f, "utf8").split("\n");
  const at = lines.findIndex((l) => /^## Kept 8-20 line blocks/.test(l));
  if (at < 0) return new Set();
  const keys = new Set();
  for (const l of lines.slice(at + 1)) {
    if (/^## /.test(l)) break;
    const m = /^\|\s*`?([^|`\s]+:\d+-\d+)`?\s*\|/.exec(l);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const kept = keptKeys();
let over20 = 0;
let mid = 0;
let unjustified = 0;
for (const p of files) {
  const { blocks } = analyzeText(fs.readFileSync(p, "utf8"));
  const long = blocks.filter((b) => b.counted >= 8);
  if (long.length === 0) continue;
  for (const b of long) {
    if (b.counted > 20) over20++;
    else {
      mid++;
      if (!kept.has(`${p}:${b.start}-${b.end}`)) unjustified++;
    }
  }
  console.log(`${p}: ${long.map((b) => `${b.start}-${b.end}:${b.counted}`).join(" ")}`);
}
console.log(`over20: ${over20}`);
console.log(`mid: ${mid}`);
console.log(`mid-unjustified: ${unjustified}`);
process.exit(over20 === 0 && unjustified === 0 ? 0 : 1);
