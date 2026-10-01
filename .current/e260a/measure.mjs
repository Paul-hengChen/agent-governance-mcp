// Coded by @sr-engineer
// Measures comment blocks in tools/[a-h]*.ts with the agc check counter.
// Usage: node .current/e260a/measure.mjs [--rev <rev>] [--check] [--citations]
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeText } from "../../dist/tools/comment-scan.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rationale = "specs/e260a-tools-a-h-rationale.md";
const args = process.argv.slice(2);
const rev = args.includes("--rev") ? args[args.indexOf("--rev") + 1] : null;
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
const inRange = (f) => /^tools\/[a-h][^/]*\.ts$/.test(f) && !f.endsWith(".d.ts");

const listed = rev ? git("ls-tree", "-r", "--name-only", rev, "--", "tools") : git("ls-files", "--", "tools");
const files = listed.split("\n").filter(inRange).sort();
const read = (f) => (rev ? git("show", `${rev}:${f}`) : fs.readFileSync(path.join(root, f), "utf8"));
const analyses = new Map(files.map((f) => [f, analyzeText(read(f))]));

function report() {
  const t = { withLong: 0, mid: 0, big: 0, longest: 0 };
  for (const [f, a] of analyses) {
    const mid = a.blocks.filter((b) => b.counted >= 8 && b.counted <= 20).length;
    const big = a.blocks.filter((b) => b.counted > 20).length;
    const longest = Math.max(0, ...a.blocks.map((b) => b.counted));
    console.log(`${f} | ${mid} | ${big} | ${longest}`);
    if (mid + big > 0) t.withLong++;
    t.mid += mid;
    t.big += big;
    t.longest = Math.max(t.longest, longest);
  }
  console.log(`TOTAL files=${files.length} with-long=${t.withLong} mid=${t.mid} big=${t.big} longest=${t.longest}`);
}

function check() {
  const text = fs.readFileSync(path.join(root, rationale), "utf8");
  const kept = new Set([...text.matchAll(/^\|\s*`(tools\/[^`:]+\.ts):(\d+)`\s*\|/gm)].map((m) => `${m[1]}:${m[2]}`));
  const seen = new Set();
  const bad = [];
  for (const [f, a] of analyses) {
    for (const b of a.blocks) {
      const key = `${f}:${b.start}`;
      if (b.counted > 20) bad.push(`OVER-20 ${key} (${b.counted})`);
      else if (b.counted >= 8 && kept.has(key)) seen.add(key);
      else if (b.counted >= 8) bad.push(`UNLISTED ${key} (${b.counted})`);
    }
  }
  for (const k of kept) if (!seen.has(k)) bad.push(`STALE ${k}`);
  bad.forEach((l) => console.log(l));
  if (bad.length === 0) console.log(`measure check OK: ${kept.size} kept blocks`);
  return bad.length === 0;
}

const idRe = /\b(?:E\d+[A-Za-z]?\d*|T-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/;
function citations() {
  const bad = [];
  for (const [f, a] of analyses) {
    a.lines.forEach((l, i) => {
      if (l.kind !== "comment" || !idRe.test(l.body)) return;
      const rest = l.body
        .replace(new RegExp(idRe.source, "g"), " ")
        .replace(/\(\s*[a-z0-9]+(?:-[a-z0-9]+)+\s*\)/g, " ")
        .replace(/\bAC-?\d+[a-z]?\b/g, " ")
        .replace(/[^\p{L}\p{N}\s]+/gu, " ");
      const words = rest.split(/\s+/).filter((w) => /\p{L}/u.test(w));
      if (words.length < 3) bad.push(`CITATION ${f}:${i + 1}`);
    });
  }
  bad.forEach((l) => console.log(l));
  if (bad.length === 0) console.log("citations OK");
  return bad.length === 0;
}

let ok = true;
if (!args.includes("--check") && !args.includes("--citations")) report();
if (args.includes("--check")) {
  if (rev) throw new Error("--check reads the working tree; drop --rev");
  ok = check() && ok;
}
if (args.includes("--citations")) ok = citations() && ok;
process.exit(ok ? 0 : 1);
