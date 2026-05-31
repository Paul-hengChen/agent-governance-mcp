#!/usr/bin/env node
// T320 — Always-on context budget measurement spike (spec: context-budget-reduction).
//
// Quantifies the token weight of the always-on context bundle so the reduction
// in T321/T322 has a measured baseline (AC1). Dependency-free: token count is a
// deterministic chars/4 approximation (the same heuristic Anthropic/OpenAI docs
// cite for English-heavy prose), so the report is diff-able across runs.
//
// Two injection paths are measured:
//   1. SessionStart hook (bin/agent-governance-context.mjs) — constitution +
//      default skill, injected every managed-workspace session. Both the `lite`
//      (default) and `full` skill variants are reported.
//   2. buildPromptForRole (prompts/build.ts) — constitution + role skill,
//      re-bundled into each of the 7 registered prompts. The volatile state
//      block is excluded so the figure is the stable, always-injected cost.
//
// Usage: node scripts/measure-context-cost.mjs

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

// chars/4 token approximation. Deterministic; no tokenizer dependency.
function approxTokens(text) {
  return Math.ceil(text.length / 4);
}

// Mirror of stripChainOnly() in prompts/build.ts — lets this script report the
// post-strip lite budget so AC2 (context-budget-reduction) is verifiable here.
function stripChainOnly(text) {
  return text
    .replace(/<!-- chain-only:start -->[\s\S]*?<!-- chain-only:end -->\n?/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function read(rel) {
  return fs.readFileSync(path.join(CONTENT, rel), "utf-8");
}

// The 7 registered prompts → their skill file (mirrors index.ts / prompts/*.ts).
const ROLE_PROMPTS = [
  ["teamwork", "skill-coordinator.md"],
  ["teamwork-lite", "skill-coordinator-lite.md"],
  ["sr-engineer", "skill-sr-engineer.md"],
  ["pm", "skill-pm.md"],
  ["architect", "skill-architect.md"],
  ["researcher", "skill-researcher.md"],
  ["qa-engineer", "skill-qa-engineer.md"],
];

const SEP = "\n\n---\n\n"; // matches buildPromptForRole's joiner

const constitution = read("constitution.md");
const constitutionTok = approxTokens(constitution);

// Every skill file on disk (raw weight).
const skillFiles = fs
  .readdirSync(CONTENT)
  .filter((f) => f.startsWith("skill-") && f.endsWith(".md"))
  .sort();

function row(label, text) {
  const t = text.length;
  const tok = approxTokens(text);
  return { label, chars: t, tokens: tok };
}

function printTable(title, rows) {
  const labelW = Math.max(title.length, ...rows.map((r) => r.label.length));
  console.log(`\n${title}`);
  console.log("-".repeat(labelW + 22));
  console.log(`${"artifact".padEnd(labelW)}  ${"chars".padStart(8)}  ${"~tokens".padStart(8)}`);
  for (const r of rows) {
    console.log(`${r.label.padEnd(labelW)}  ${String(r.chars).padStart(8)}  ${String(r.tokens).padStart(8)}`);
  }
}

// --- Report ---
console.log("Always-on context budget");
console.log("(chars/4 token approximation — deterministic baseline for spec context-budget-reduction)");

// 1. Raw artifacts
printTable(
  "Raw artifacts",
  [row("constitution.md", constitution), ...skillFiles.map((f) => row(f, read(f)))],
);

// 2. SessionStart hook output (constitution + default skill). Header/state are
//    small/volatile; the constitution + skill pair is the dominant fixed cost.
const liteSkill = read("skill-coordinator-lite.md");
const fullSkill = read("skill-coordinator.md");
printTable("SessionStart hook (constitution + skill)", [
  row("hook lite  (default)", constitution + SEP + liteSkill),
  row("hook full  (AGC_DEFAULT_SKILL=full)", constitution + SEP + fullSkill),
]);

// 3. Role-prompt bundles (constitution + role skill; volatile state excluded).
printTable("Role-prompt bundles (constitution + skill, state excluded)", [
  ...ROLE_PROMPTS.map(([id, file]) => row(`${id}  [${file}]`, constitution + SEP + read(file))),
]);

// 4. Always-on total (hook default path = constitution + lite skill).
//    Lite contexts strip the chain-only sections (§3.1, §4) — report both the
//    raw and the post-strip figure so the AC2 reduction is visible here.
const leanConstitution = stripChainOnly(constitution);
const alwaysOnRaw = constitution + SEP + liteSkill;
const alwaysOnLean = leanConstitution + SEP + liteSkill;
const rawTok = approxTokens(alwaysOnRaw);
const leanTok = approxTokens(alwaysOnLean);
console.log("\n" + "=".repeat(50));
console.log(`TOTAL always-on (constitution + default skill)`);
console.log(`  constitution.md (raw)      : ${constitutionTok.toString().padStart(6)} ~tokens`);
console.log(`  constitution.md (lite-lean): ${approxTokens(leanConstitution).toString().padStart(6)} ~tokens`);
console.log(`  skill-coordinator-lite.md  : ${approxTokens(liteSkill).toString().padStart(6)} ~tokens`);
console.log(`  bundle raw  (pre-strip)    : ${rawTok.toString().padStart(6)} ~tokens`);
console.log(`  bundle lean (post-strip)   : ${leanTok.toString().padStart(6)} ~tokens`);
console.log(`  saved per session          : ${(rawTok - leanTok).toString().padStart(6)} ~tokens (${Math.round((1 - leanTok / rawTok) * 100)}%)`);
console.log("=".repeat(50));
