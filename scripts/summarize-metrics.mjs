#!/usr/bin/env node
// Coded by @sr-engineer
// Retro summarizer for the e8-success-telemetry sidecar (AC9). Reads
// .current/metrics.jsonl (one JSON line per SHIPPED feature, appended by
// tools/metrics.ts at the release-engineer terminal-marker write) and prints
// a per-feature table plus an aggregate line — one-pass rate and mean
// qa/review/visual rounds + mean hops — usable directly in a retro without
// hand-tallying. Zero-dep, pure Node stdlib, ESM.
//
// Usage: node scripts/summarize-metrics.mjs [path-to-metrics.jsonl]
//        (default: .current/metrics.jsonl relative to the current directory)
//
// Malformed lines are skipped, counted, and reported — never thrown on
// (mirrors the append-only-sidecar caveat in docs/gate-retro-procedure.md:
// a rare interleaved line under concurrent writes is an accepted cost).

import { readFileSync } from "node:fs";
import * as path from "node:path";

const target = process.argv[2] ?? path.join(".current", "metrics.jsonl");

let text;
try {
  text = readFileSync(target, "utf-8");
} catch {
  console.log(`summarize-metrics — no metrics yet (${target} not found or unreadable).`);
  process.exit(0);
}

const records = [];
let malformed = 0;
for (const line of text.split("\n")) {
  if (line.trim() === "") continue; // blank lines are not malformed
  try {
    const parsed = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      malformed++;
      continue;
    }
    records.push(parsed);
  } catch {
    malformed++;
  }
}

if (records.length === 0) {
  console.log(`summarize-metrics — no metrics yet (${target} has no valid records).`);
  if (malformed > 0) {
    console.log(`note: skipped ${malformed} malformed line(s).`);
  }
  process.exit(0);
}

// Field coercion: tolerate hand-edited/partial records — a missing or
// non-numeric counter reads as 0, one_pass as strict boolean true only.
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

console.table(
  records.map((r) => ({
    feature: String(r.feature ?? "(unknown)"),
    tickets: num(r.tickets),
    qa_rounds: num(r.qa_rounds),
    review_rounds: num(r.review_rounds),
    visual_rounds: num(r.visual_rounds),
    hops: num(r.hops),
    one_pass: r.one_pass === true,
    released_version: r.released_version ?? null,
  })),
);

const total = records.length;
const onePassCount = records.filter((r) => r.one_pass === true).length;
const mean = (field) => (records.reduce((sum, r) => sum + num(r[field]), 0) / total).toFixed(2);

console.log(
  `aggregate — features: ${total}, one-pass rate: ${((onePassCount / total) * 100).toFixed(1)}% ` +
    `(${onePassCount}/${total}), mean rounds: qa ${mean("qa_rounds")} / review ${mean("review_rounds")} / ` +
    `visual ${mean("visual_rounds")}, mean hops: ${mean("hops")}`,
);

if (malformed > 0) {
  console.log(`note: skipped ${malformed} malformed line(s).`);
}
