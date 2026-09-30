#!/usr/bin/env node
// Lane tooling, advisory only (never gates; always exits 0). Lists comment
// lines in the owned test files that mention an id but keep fewer than 3
// words once every id is removed, so a reviewer can triage them.
// Usage: node .current/e233e/check-id-only.mjs [--all] [--min=N]
//   --all also lists lines with no id; --min=N changes the word threshold (default 3)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const OWNED = [
  /^test\/(r(a|el|ep|es|ev)[^/]*|[stuvw][^/]*)\.test\.mjs$/,
  /^test\/eval\/[^/]+\.mjs$/,
  /^test\/eval\/lib\/(bundle|assertions)\.mjs$/,
];
// Case-insensitive ticket / AC / task id: optional letter-dash prefixes (T-, AC-),
// letter prefix + digits + trailing letter/digit run (E178a, e123b9, FM1, C16),
// then digit-bearing or NEW segments (-05, -NEW-1, -14).
const ID = /\b(?!(?:utf|sha|md|e2e|v\d|h\d|sqlite|ipv|x\d|es\d|win|node\d)[a-z0-9]*\b)(?:[a-z]{1,4}-)*[a-z]{1,4}-?\d+[a-z0-9]*(?:-(?:new|[a-z]*\d[a-z0-9]*))*\b/gi;
const showAll = process.argv.includes("--all");
const minArg = process.argv.find((a) => a.startsWith("--min="));
const MIN = minArg ? Number(minArg.slice(6)) : 3; // words required after ids are stripped

const files = execFileSync("git", ["ls-files", "test"], { encoding: "utf8" })
  .split("\n").filter((p) => OWNED.some((r) => r.test(p)));

function commentRanges(sf) {
  const seen = new Map();
  const visit = (node) => {
    for (const pos of [node.getFullStart()]) {
      for (const r of ts.getLeadingCommentRanges(sf.text, pos) ?? []) seen.set(r.pos, r);
    }
    for (const r of ts.getTrailingCommentRanges(sf.text, node.end) ?? []) seen.set(r.pos, r);
    node.getChildren(sf).forEach(visit);
  };
  visit(sf);
  return [...seen.values()];
}

let listed = 0, withId = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  for (const r of commentRanges(sf)) {
    const raw = text.slice(r.pos, r.end);
    const startLine = sf.getLineAndCharacterOfPosition(r.pos).line;
    raw.split("\n").forEach((ln, i) => {
      const body = ln.replace(/^\s*(\/\/+|\/\*+|\*+\/?|\*)/, "").replace(/\*\/\s*$/, "").trim();
      if (!body) return;
      const hasId = (body.match(ID) ?? []).length > 0;
      if (hasId) withId++;
      if (!hasId && !showAll) return;
      const words = body.replace(ID, " ").split(/[^A-Za-z']+/).filter((w) => w.length >= 2);
      if (words.length < MIN) {
        listed++;
        console.log(`${f}:${startLine + i + 1}: ${body}`);
      }
    });
  }
}
console.log(`check-id-only (advisory): ${listed} line(s) listed; ${withId} comment line(s) mention an id; ${files.length} files scanned`);
