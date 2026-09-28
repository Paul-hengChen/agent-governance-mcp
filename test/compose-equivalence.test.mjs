// Coded by @qa-engineer
// Tests for spec: specs/compose-not-strip-overlays.md (ticket A9, T-CNSO-08).
//
// Spec-to-Test map:
//   AC2 (lite equivalence)              -> t-build-lite-nondesign, t-build-lite-design,
//                                           t-build-lite-nondesign-fd, t-build-lite-design-fd
//   AC3 (full non-design equivalence)   -> t-build-full-nondesign, t-build-full-nondesign-fd
//   AC4 (full design-armed equivalence) -> t-build-full-design, t-build-full-design-fd
//   AC5 (fullDetail equivalence)        -> the four *-fd fixtures above (design + non-design,
//                                           lite + full)
//   AC7 (stripOriginTags keeps working) -> implicit in every fixture (golden captured post
//                                           T-GTS stripOriginTags landing, pre-compose-not-strip)
//   AC8 (single source of truth)        -> t-cat-equals-monolith (concatenating the 15
//                                           manifest fragments reproduces the retired monolith
//                                           byte-for-byte — the DR-1 Option R invariant)
//   AC9 (hook byte-equivalence)         -> t-hook-lite, t-hook-full
//   Dependencies (rationale §X refs)    -> t-rationale-refs-resolve-forward,
//                                           t-rationale-sections-exist-in-fragments
//
// WHY (architecture: Golden-Snapshot / Equivalence Approach): the ticket's entire premise —
// that additive composition is behavior-PRESERVING, not just architecturally cleaner — is an
// empirical claim, not one provable by code inspection. These tests are the proof: they replay
// the CURRENT (post-refactor) code path for every fixture-captured dispatch mode and assert
// STRICT byte equality (no normalization — Option R/DR-1 guarantees literal identity) against
// snapshots captured from the PRE-refactor strip pipeline (scripts/capture-constitution-golden.mjs,
// T-CNSO-02, committed at test/fixtures/compose-golden/). If a future edit to
// prompts/constitution-manifest.ts, prompts/build.ts, or bin/agent-governance-context.mjs ever
// changes what a dispatch mode emits, this file — not just inspection of the diff — catches it.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const GOLDEN_DIR = path.join(ROOT, "test", "fixtures", "compose-golden");

const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
const { CONSTITUTION_SEGMENTS } = await import(path.join(ROOT, "dist", "prompts", "constitution-manifest.js"));

function readGolden(file) {
  return fs.readFileSync(path.join(GOLDEN_DIR, file), "utf-8");
}

// Mirrors scripts/capture-constitution-golden.mjs's makeWorkspace exactly — the fixture and
// the replay MUST construct an identical state shape or the comparison proves nothing.
const FEATURE = "cnso-golden-feat";
async function makeWorkspace({ design }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "cnso-equiv-"));
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

// Constitution portion = everything before the first skill separator — mirrors the capture
// script's slice exactly (buildPromptForRole's constitution text never contains "\n\n---\n\n").
const BUILD_SEP = "\n\n---\n\n";
function constitutionOf(promptText) {
  const i = promptText.indexOf(BUILD_SEP);
  assert.notEqual(i, -1, "no skill separator found in prompt output");
  return promptText.slice(0, i);
}

const LITE_SKILL = "skill-coordinator-lite.md";
const CHAIN_SKILL = "skill-sr-engineer.md";

// The 8 build.ts fixtures — full cross product per the architecture's Golden-Snapshot table.
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
  test(`compose-equivalence: buildPromptForRole(${skillFile}, design=${design}, fullDetail=${fullDetail}) is byte-identical to pre-refactor golden ${file}`, async () => {
    const ws = await makeWorkspace({ design });
    try {
      const text = buildPromptForRole(skillFile, "equiv-check", ws, fullDetail).messages[0].content.text;
      const actual = constitutionOf(text);
      const golden = readGolden(file);
      // Strict equality — no normalization. Option R (architecture DR-1) guarantees the
      // composed+stripOriginTags(+stripRationale) result is LITERALLY identical to what the
      // pre-refactor strip pipeline produced, markers-and-all.
      assert.equal(actual, golden, `current composeConstitution pipeline output must be byte-identical to ${file}`);
    } finally {
      fs.rmSync(ws, { recursive: true, force: true });
    }
  });
}

// --- AC9: hook byte-equivalence -------------------------------------------

async function captureHookNow(env) {
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
    assert.ok(parts.length >= 4, "unexpected hook body shape (expected >= 4 \\n---\\n-delimited parts)");
    return parts[1];
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

test("compose-equivalence: SessionStart hook (lite/default env) is byte-identical to pre-refactor golden hook-lite.txt", async () => {
  const actual = await captureHookNow({});
  assert.equal(actual, readGolden("hook-lite.txt"), "hook lite-mode constitution output must be byte-identical to hook-lite.txt");
});

test("compose-equivalence: SessionStart hook (AGC_DEFAULT_SKILL=full) is byte-identical to pre-refactor golden hook-full.txt", async () => {
  const actual = await captureHookNow({ AGC_DEFAULT_SKILL: "full" });
  assert.equal(actual, readGolden("hook-full.txt"), "hook full-mode constitution output must be byte-identical to hook-full.txt");
});

// --- AC8: single source of truth — cat(15 fragments) === retired monolith -

test("compose-equivalence: cat(15 manifest fragments in order) === the pre-refactor constitution.md monolith (DR-1 Option R invariant)", () => {
  const catted = CONSTITUTION_SEGMENTS
    .map((s) => fs.readFileSync(path.join(ROOT, "content", s.file), "utf-8"))
    .join("");
  const monolith = readGolden("constitution-monolith.txt");
  assert.equal(catted, monolith, "concatenating every fragment in manifest order must reproduce the retired monolith byte-for-byte");
});

// --- Dependencies: constitution-rationale.md §X refs still resolve -------
// (both directions — the rationale doc's forward refs must target a heading that still
// exists, AND the constitution's own forward-refs-into-rationale (at old L57/L74, now living
// inside const-08/const-11) must still point at a doc that has that section.)

test("compose-equivalence: every 'Constitution §X' reference in constitution-rationale.md resolves to a heading present in exactly one fragment", () => {
  const rationale = fs.readFileSync(path.join(ROOT, "content", "constitution-rationale.md"), "utf-8");
  const refs = [...rationale.matchAll(/see Constitution §([0-9]+(?:\.[0-9]+)?)/gi)].map((m) => m[1]);
  assert.ok(refs.length > 0, "rationale doc must contain at least one 'see Constitution §X' reference to check");

  const fragmentFiles = fs.readdirSync(path.join(ROOT, "content")).filter((f) => /^const-\d\d-/.test(f));
  const headingOwners = new Map(); // "1" -> [file, file, ...] (should be exactly 1 owner per section id)
  for (const f of fragmentFiles) {
    const text = fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
    for (const m of text.matchAll(/^#{2,3}\s+(\d+(?:\.\d+)?)[.\s]/gm)) {
      const id = m[1];
      if (!headingOwners.has(id)) headingOwners.set(id, []);
      headingOwners.get(id).push(f);
    }
  }

  for (const ref of refs) {
    const owners = headingOwners.get(ref) || [];
    assert.equal(owners.length, 1, `Constitution §${ref} (referenced from constitution-rationale.md) must resolve to exactly one fragment heading, found in: ${JSON.stringify(owners)}`);
  }
});

test("compose-equivalence: constitution-rationale.md is referenced back FROM the constitution (const-08/const-11 forward-pointer sentences survive the split)", () => {
  const const08 = fs.readFileSync(path.join(ROOT, "content", "const-08-chain-31-mid.md"), "utf-8");
  const const11 = fs.readFileSync(path.join(ROOT, "content", "const-11-design-chain-32.md"), "utf-8");
  assert.ok(
    const08.includes("constitution-rationale.md") || const11.includes("constitution-rationale.md"),
    "at least one of the §3.1/§3.2 fragments must retain its forward-mention of content/constitution-rationale.md",
  );
});

test("compose-equivalence: constitution-rationale.md's declared scope (§1, §3.1, §3.2, §5, §7) all have a live heading in the fragment set", () => {
  const fragmentFiles = fs.readdirSync(path.join(ROOT, "content")).filter((f) => /^const-\d\d-/.test(f));
  const allFragmentText = fragmentFiles
    .map((f) => fs.readFileSync(path.join(ROOT, "content", f), "utf-8"))
    .join("\n");
  // Declared scope line: "Rationale target: v3.32.0. Scope: §1, §3.1, §3.2, §5, §7."
  for (const [needle, label] of [
    ["## 1. Output Directives", "§1"],
    ["### 3.1 Server-enforced chain", "§3.1"],
    ["### 3.2 Visual Verdict Authority", "§3.2"],
    ["## 5. Anti-Loop Circuit Breaker", "§5"],
    ["## 7. Cognitive Discipline", "§7"],
  ]) {
    assert.ok(allFragmentText.includes(needle), `rationale's declared scope ${label} must have a live heading ("${needle}") somewhere in the fragment set`);
  }
});
