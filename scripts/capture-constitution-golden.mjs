#!/usr/bin/env node
// Coded by @sr-engineer
// T-CNSO-02 (ticket A9, compose-not-strip) — one-shot golden-fixture capture.
//
// Captures the CONSTITUTION PORTION of every dispatch mode's output from the
// *pre-refactor* strip pipeline (dist/ built from the monolith +
// stripChainOnly/stripDesignOnly code), so the compose-not-strip refactor can
// be proven byte-equivalent (spec ACs 2–5, 9; asserted by the qa-authored
// test/compose-equivalence.test.mjs, T-CNSO-08).
//
// SEQUENCING IS THE POINT: this script MUST run against a dist/ compiled from
// the pre-refactor source, BEFORE any content/ or prompts/build.ts edit lands
// (spec Dependencies). It is a script, not a test file, so constitution §2
// test-ownership does not apply (architecture DR-5).
//
// Captures (into test/fixtures/compose-golden/):
//   8 build.ts fixtures — lite/full × design/non-design × fullDetail on/off
//   2 hook fixtures     — bin/agent-governance-context.mjs lite + full
//   1 monolith fixture  — raw content/constitution.md bytes (the cat==original
//                         invariant baseline for T-CNSO-08)
//
// Usage: npm run build && node scripts/capture-constitution-golden.mjs

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "test", "fixtures", "compose-golden");

const { buildPromptForRole } = await import(
  path.join(ROOT, "dist", "prompts", "build.js")
);
const { setActiveStorage, FileHandoffStorage } = await import(
  path.join(ROOT, "dist", "tools", "storage.js")
);

fs.mkdirSync(OUT_DIR, { recursive: true });

// --- fixture workspaces (mirrors test/context-budget.test.mjs buildOnFixture) ---
// non-design: handoff state with an active_feature but NO design/<feature>.md
//   => hasDesignModeRequiringVisual().required === false.
// design-armed: same, plus design/<feature>.md with `## Mode` != no-design
//   (format per tools/evidence-file.ts parseDesignMode).
const FEATURE = "cnso-golden-feat";

async function makeWorkspace({ design }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "cnso-golden-"));
  setActiveStorage(new FileHandoffStorage());
  const s = new FileHandoffStorage();
  await s.writeState(ws, FEATURE, "In_Progress", [], []);
  if (design) {
    fs.mkdirSync(path.join(ws, "design"), { recursive: true });
    fs.writeFileSync(
      path.join(ws, "design", `${FEATURE}.md`),
      `# Design\n\n## Mode\n\nfigma\n`,
    );
  }
  return ws;
}

// Constitution portion = everything before the first skill separator.
// buildPromptForRole joins `${constitution}\n\n---\n\n${skill}...` — the
// constitution itself contains no "\n\n---\n\n", so the slice is exact.
const BUILD_SEP = "\n\n---\n\n";
function constitutionOf(promptText) {
  const i = promptText.indexOf(BUILD_SEP);
  if (i === -1) throw new Error("no skill separator found in prompt output");
  return promptText.slice(0, i);
}

const LITE_SKILL = "skill-coordinator-lite.md";
const CHAIN_SKILL = "skill-sr-engineer.md"; // any non-lite chain role

// 8 build.ts modes — full cross product (architecture Golden-Snapshot table).
const BUILD_MODES = [
  ["build-lite-nondesign.txt",    LITE_SKILL,  false, false],
  ["build-lite-design.txt",       LITE_SKILL,  true,  false],
  ["build-lite-nondesign-fd.txt", LITE_SKILL,  false, true],
  ["build-lite-design-fd.txt",    LITE_SKILL,  true,  true],
  ["build-full-nondesign.txt",    CHAIN_SKILL, false, false],
  ["build-full-design.txt",       CHAIN_SKILL, true,  false],
  ["build-full-nondesign-fd.txt", CHAIN_SKILL, false, true],
  ["build-full-design-fd.txt",    CHAIN_SKILL, true,  true],
];

const written = [];

for (const [file, skillFile, design, fullDetail] of BUILD_MODES) {
  const ws = await makeWorkspace({ design });
  try {
    const text = buildPromptForRole(skillFile, "golden-capture", ws, fullDetail)
      .messages[0].content.text;
    const constitution = constitutionOf(text);
    fs.writeFileSync(path.join(OUT_DIR, file), constitution);
    written.push([file, constitution.length]);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

// --- hook fixtures (bin/agent-governance-context.mjs, lite + full) ---------
// Managed tmp workspace (has .current/handoff.md marker); AGC_SERVER_ROOT
// pinned to this checkout. The hook body is
//   [header, constitution, skill, stateBlock].join("\n---\n")-shaped
// (bin joins header lines, "---", constitution, "---", skill, "---", state
// with "\n"), and neither the header nor the constitution contains a bare
// "\n---\n" line, so parts[1] of split("\n---\n") is the constitution slice.
async function captureHook(file, env) {
  const ws = await makeWorkspace({ design: false });
  try {
    const out = execFileSync(
      "node",
      [path.join(ROOT, "bin", "agent-governance-context.mjs")],
      {
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: ws,
          AGC_SERVER_ROOT: ROOT,
          ...env,
        },
        encoding: "utf-8",
      },
    );
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    const parts = ctx.split("\n---\n");
    if (parts.length < 4) throw new Error(`unexpected hook body shape for ${file}`);
    const constitution = parts[1];
    fs.writeFileSync(path.join(OUT_DIR, file), constitution);
    written.push([file, constitution.length]);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

await captureHook("hook-lite.txt", {}); // default env => lite skill variant
await captureHook("hook-full.txt", { AGC_DEFAULT_SKILL: "full" });

// --- monolith baseline (cat == original invariant, T-CNSO-08) --------------
// Only capturable while the pre-refactor monolith still exists (it is deleted
// by T-CNSO-09/AC8). Post-delete re-runs of this script still regression-check
// the 10 dispatch fixtures; the committed constitution-monolith.txt stays the
// frozen baseline.
const monolithPath = path.join(ROOT, "content", "constitution.md");
if (fs.existsSync(monolithPath)) {
  const monolith = fs.readFileSync(monolithPath, "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "constitution-monolith.txt"), monolith);
  written.push(["constitution-monolith.txt", monolith.length]);
} else {
  console.log("note: content/constitution.md absent (post-AC8 delete) — monolith baseline not re-captured; committed fixture remains authoritative");
}

console.log(`Captured ${written.length} golden fixtures into ${path.relative(ROOT, OUT_DIR)}/`);
for (const [file, bytes] of written) {
  console.log(`  ${file.padEnd(30)} ${String(bytes).padStart(7)} bytes`);
}
