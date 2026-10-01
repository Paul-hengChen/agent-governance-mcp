#!/usr/bin/env node
// Coded by @sr-engineer
// Regenerates the 12 golden fixtures in test/fixtures/compose-golden/ from the
// current content/ sources, so a const-*/coord-* edit is re-baselined by tool.
// Fail loud: every capture writes its fixture or exits non-zero.
// Fixture list, ownership and history: see specs/e260c-bin-scripts.md.
// Usage: npm run build && node scripts/capture-constitution-golden.mjs
//        then: git diff test/fixtures/compose-golden/   (expect only intended moves)

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
// The two monolith fixtures are derived from the same manifests the
// assertions use, so the tool cannot drift from the oracle (E90).
const { CONSTITUTION_SEGMENTS } = await import(
  path.join(ROOT, "dist", "prompts", "constitution-manifest.js")
);
const { composeSkill, hostCapabilitiesFor } = await import(
  path.join(ROOT, "dist", "prompts", "skill-manifest.js")
);

const CONTENT_DIR = path.join(ROOT, "content");
// Reads content/ DIRECTLY, with no .current/ override probe — deliberately the
// same read the two assertions perform (compose-equivalence.test.mjs AC8 and
// skill-manifest.test.mjs readContent). A fixture captured through an override
// would encode this checkout's local state into a committed baseline.
const readContent = (file) => fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8");

// Every capture goes through here: a fixture that derives to empty is a broken
// derivation, not a legitimate baseline, and must stop the run (fail-loud, E90).
function writeFixture(file, text, what) {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(`refusing to write empty fixture ${file} (${what}) — derivation produced no bytes`);
  }
  fs.writeFileSync(path.join(OUT_DIR, file), text);
  // byteLength, not String#length: these fixtures carry em dashes and CJK, so
  // UTF-16 code units under-report the on-disk size by ~300 bytes on the
  // monolith and reading the log as bytes suggests a spurious diff.
  written.push([file, Buffer.byteLength(text, "utf-8")]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const written = [];

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

for (const [file, skillFile, design, fullDetail] of BUILD_MODES) {
  const ws = await makeWorkspace({ design });
  try {
    const text = buildPromptForRole(skillFile, "golden-capture", ws, fullDetail)
      .messages[0].content.text;
    const constitution = constitutionOf(text);
    writeFixture(file, constitution, `build.ts ${skillFile} design=${design} fullDetail=${fullDetail}`);
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
    writeFixture(file, constitution, "SessionStart hook");
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

await captureHook("hook-lite.txt", {}); // default env => lite skill variant
await captureHook("hook-full.txt", { AGC_DEFAULT_SKILL: "full" });

// --- constitution monolith (cat == original invariant, T-CNSO-08) ---------
// Derived from CONSTITUTION_SEGMENTS (content/constitution.md is gone): this
// concatenation is byte for byte what compose-equivalence's AC8 assertion does.
// Why the old existsSync branch was removed: see specs/e260c-bin-scripts.md.
writeFixture(
  "constitution-monolith.txt",
  CONSTITUTION_SEGMENTS.map((s) => readContent(s.file)).join(""),
  `cat(${CONSTITUTION_SEGMENTS.length} constitution fragments in manifest order)`,
);

// --- coordinator skill monolith (T-D6-04 AC5 golden) ----------------------
// Pinned by test/skill-manifest.test.mjs's t-golden-byte-identity, but outside
// this script's scope until the fail-loud rework (E90). Same shape as above:
// the capture IS the assertion's own composition, under the full (claude-code)
// capability profile, which is the profile the frozen golden was taken under.
writeFixture(
  "skill-coordinator-monolith.txt",
  composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent),
  'composeSkill("skill-coordinator.md", claude-code caps)',
);

// Completeness guard (E90): every fixture the suite asserts against must have
// been (re)written by this run. A fixture sitting in the directory that this
// tool does not produce is exactly the defect that rework fixed — silently
// un-regenerable — so surface it here, at the one moment someone is looking,
// rather than in a red suite later.
const onDisk = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".txt")).sort();
const captured = new Set(written.map(([file]) => file));
const uncovered = onDisk.filter((f) => !captured.has(f));

console.log(`Captured ${written.length} golden fixtures into ${path.relative(ROOT, OUT_DIR)}/`);
for (const [file, bytes] of written) {
  console.log(`  ${file.padEnd(32)} ${String(bytes).padStart(7)} bytes`);
}

if (uncovered.length > 0) {
  console.error(
    `\nERROR: ${uncovered.length} fixture(s) in ${path.relative(ROOT, OUT_DIR)}/ have no capture in this script ` +
      `and were NOT regenerated: ${uncovered.join(", ")}. Add a capture (E90) or delete the stale fixture.`,
  );
  process.exit(1);
}
