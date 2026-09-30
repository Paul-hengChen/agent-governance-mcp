#!/usr/bin/env node
// Lane tooling (not shipped): lists comment lines in the owned test files that LEAD with an
// id (optionally after a short lead word), or that are bare "-> label" continuation lines.
// Usage: node .current/e233e/sweep-id-led.mjs [--mid] [file-substring ...]   (no args = all owned files)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const OWNED = [
  /^test\/(r(a|el|ep|es|ev)[^/]*|[stuvw][^/]*)\.test\.mjs$/,
  /^test\/eval\/[^/]+\.mjs$/,
  /^test\/eval\/lib\/(bundle|assertions)\.mjs$/,
];
const ID_SRC = String.raw`(?!(?:utf|sha|md|e2e|v\d|h\d|sqlite|ipv|x\d|es\d|win|node\d)[a-z0-9]*\b)(?:[a-z]{1,4}-)*[a-z]{1,4}-?\d+[a-z0-9]*(?:-(?:new|[a-z]*\d[a-z0-9]*))*`;
const LEAD = new RegExp(String.raw`^(?:(?:per|see|and|re|covers|spec|the)\s+)?[(\[]?${ID_SRC}\b`, "i");
const mid = process.argv.includes("--mid"); // also list lines where an id sits outside any parenthetical
const filters = process.argv.slice(2).filter((a) => a !== "--mid");
const files = execFileSync("git", ["ls-files", "test"], { encoding: "utf8" }).split("\n")
  .filter((p) => OWNED.some((r) => r.test(p)) && (!filters.length || filters.some((f) => p.includes(f))));

function ranges(sf) {
  const seen = new Map();
  const visit = (n) => {
    for (const r of ts.getLeadingCommentRanges(sf.text, n.getFullStart()) ?? []) seen.set(r.pos, r);
    for (const r of ts.getTrailingCommentRanges(sf.text, n.end) ?? []) seen.set(r.pos, r);
    n.getChildren(sf).forEach(visit);
  };
  visit(sf);
  return [...seen.values()];
}
let total = 0;
const per = {};
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  for (const r of ranges(sf)) {
    const start = sf.getLineAndCharacterOfPosition(r.pos).line;
    text.slice(r.pos, r.end).split("\n").forEach((ln, i) => {
      const body = ln.replace(/^\s*(\/\/+|\/\*+|\*\/?|\*)/, "").replace(/\*\/\s*$/, "").replace(/^[\s\-=#*_~]+/, "").trim();
      if (!body) return;
      const outside = body.replace(/\([^()]*\)/g, " ").replace(/\([^()]*$/, " ");
      const midHit = mid && new RegExp(String.raw`\b${ID_SRC}\b`, "i").test(outside);
      if (LEAD.test(body) || /^(->|→)/.test(body) || midHit) {
        total++;
        per[f] = (per[f] ?? 0) + 1;
        console.log(`${f}:${start + i + 1}: ${ln.trim()}`);
      }
    });
  }
}
console.error(Object.entries(per).map(([k, v]) => `${v} ${k}`).join("\n"));
console.error(`id-led comment lines: ${total} in ${files.length} files`);
