#!/usr/bin/env node
// Always-on context budget measurement (T320, spec: context-budget-reduction):
// the token weight of the always-on bundle as a deterministic chars/4
// approximation, so the report diffs cleanly across runs. Measures the
// SessionStart hook (constitution + default skill, lite and full variants) and
// buildPromptForRole per registered prompt (constitution + role skill, state
// block excluded). Background: see specs/e260c-bin-scripts.md.
// Usage: node scripts/measure-context-cost.mjs

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

// chars/4 token approximation. Deterministic; no tokenizer dependency.
function approxTokens(text) {
  return Math.ceil(text.length / 4);
}

// Compose-not-strip (A9): every constitution figure is composed from the
// shared fragment manifest, the same source prompts/build.ts and the hook use,
// and stripRationale comes from the compiled build.js, so no local mirror of
// the strip logic can drift (architecture DR-4).
const { CONSTITUTION_SEGMENTS, includeSegment } = await import(
  pathToFileURL(path.join(ROOT, "dist", "prompts", "constitution-manifest.js")).href
);
const { stripRationale } = await import(
  pathToFileURL(path.join(ROOT, "dist", "prompts", "build.js")).href
);
// d6-host-capability-compose-axis (T-D6-04): content/skill-coordinator.md is
// retired — it is split into content/coord-NN-*.md fragments composed via
// composeSkill (same treatment as CONSTITUTION_SEGMENTS above, instead of a
// monolith read). readSkill() reproduces today's full-capability figure
// (byte-identical to the retired monolith, AC5) so this script's reported
// numbers are unchanged for the "full" variant; composeSkill passes every
// other (unsplit) skill file through as-is.
const { composeSkill, hostCapabilitiesFor } = await import(
  pathToFileURL(path.join(ROOT, "dist", "prompts", "skill-manifest.js")).href
);

function read(rel) {
  return fs.readFileSync(path.join(CONTENT, rel), "utf-8");
}

function readSkill(rel) {
  return composeSkill(rel, hostCapabilitiesFor("claude-code"), read);
}

// Compose the constitution for a given dispatch mode. `collapse` mirrors the
// \n{3,} blank-run normalization the lite paths apply post-composition
// (stripOriginTags in build.ts / the inline collapse in the hook).
function composeConstitution({ chain, design }, collapse = false) {
  const text = CONSTITUTION_SEGMENTS
    .filter((s) => includeSegment(s.tag, { chain, design }))
    .map((s) => read(s.file))
    .join("");
  return collapse ? text.replace(/\n{3,}/g, "\n\n") : text;
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

// Full document (all fragments) — byte-identical to the retired monolith.
const constitution = composeConstitution({ chain: true, design: true });
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
  [
    row("constitution (composed, all fragments)", constitution),
    row("skill-coordinator.md (composed, full capability)", readSkill("skill-coordinator.md")),
    ...skillFiles.map((f) => row(f, read(f))),
  ],
);

// 2. SessionStart hook output (constitution + default skill). Header/state are
//    small/volatile; the constitution + skill pair is the dominant fixed cost.
const liteSkill = read("skill-coordinator-lite.md");
const fullSkill = readSkill("skill-coordinator.md");
printTable("SessionStart hook (constitution + skill)", [
  row("hook lite  (default)", constitution + SEP + liteSkill),
  row("hook full  (AGC_DEFAULT_SKILL=full)", constitution + SEP + fullSkill),
]);

// 3. Role-prompt bundles (constitution + role skill; volatile state excluded).
printTable("Role-prompt bundles (constitution + skill, state excluded)", [
  ...ROLE_PROMPTS.map(([id, file]) => row(`${id}  [${file}]`, constitution + SEP + readSkill(file))),
]);

// 3b. Role-prompt bundles AFTER stripRationale() on BOTH the constitution AND the
//     skill body (F-B Round-2, v3.31.0 — T-GTL-07). This mirrors buildPromptForRole's
//     default (fullDetail=false) chain-role dispatch: the constitution now also has
//     its §1/§7 rationale example-lists removed (−72 ~tok), in addition to the skill
//     body strip. Un-fenced skills pass through byte-identical (no-marker passthrough),
//     so the constitution delta applies to EVERY bundle while pm/sr also drop their
//     skill rationale — the AC1/AC2/AC8 reduction targets. Reporting-only (DR-2/DR-6).
const constitutionStripped = stripRationale(constitution);
const constitutionSaved = constitutionTok - approxTokens(constitutionStripped);
// Non-design chain-role dispatch: rationale-stripped AND design-only-stripped. This is
// the budget a chain role gets on a feature with no (or no-design) design file.
const constitutionNonDesign = stripRationale(composeConstitution({ chain: true, design: false }));
const designOnlySaved = approxTokens(constitutionStripped) - approxTokens(constitutionNonDesign);
printTable("Role-prompt bundles (rationale-stripped: constitution + skill)", [
  ...ROLE_PROMPTS.map(([id, file]) => {
    const skill = readSkill(file);
    const stripped = stripRationale(skill);
    const bundle = constitutionStripped + SEP + stripped;
    const skillSaved = approxTokens(skill) - approxTokens(stripped);
    const parts = [];
    if (constitutionSaved > 0) parts.push(`const −${constitutionSaved}`);
    if (skillSaved > 0) parts.push(`skill −${skillSaved}`);
    const tag = parts.length ? `  (${parts.join(", ")} ~tok)` : "";
    return row(`${id}  [${file}]${tag}`, bundle);
  }),
]);

// 4. Always-on total (hook default path = constitution + lite skill).
//    Lite contexts strip the chain-only sections (§3.1, §4) — report both the
//    raw and the post-strip figure so the AC2 reduction is visible here.
// Lite-lean = the hook's default composition: chain fragments excluded, design
// kept (the hook never stripped design), blank-run collapse applied.
const leanConstitution = composeConstitution({ chain: false, design: true }, true);
const alwaysOnRaw = constitution + SEP + liteSkill;
const alwaysOnLean = leanConstitution + SEP + liteSkill;
const rawTok = approxTokens(alwaysOnRaw);
const leanTok = approxTokens(alwaysOnLean);
console.log("\n" + "=".repeat(50));
console.log(`TOTAL always-on (constitution + default skill)`);
console.log(`  constitution (raw, composed): ${constitutionTok.toString().padStart(6)} ~tokens`);
console.log(`  constitution (rat-strip)    : ${approxTokens(constitutionStripped).toString().padStart(6)} ~tokens  (chain-role AC8 floor; −${constitutionSaved})`);
console.log(`  constitution (non-design)   : ${approxTokens(constitutionNonDesign).toString().padStart(5)} ~tokens  (rat-strip + design-only strip; −${designOnlySaved} vs rat-strip)`);
console.log(`  constitution (lite-lean)    : ${approxTokens(leanConstitution).toString().padStart(6)} ~tokens`);
console.log(`  skill-coordinator-lite.md  : ${approxTokens(liteSkill).toString().padStart(6)} ~tokens`);
console.log(`  bundle raw  (pre-strip)    : ${rawTok.toString().padStart(6)} ~tokens`);
console.log(`  bundle lean (post-strip)   : ${leanTok.toString().padStart(6)} ~tokens`);
console.log(`  saved per session          : ${(rawTok - leanTok).toString().padStart(6)} ~tokens (${Math.round((1 - leanTok / rawTok) * 100)}%)`);
console.log("=".repeat(50));
