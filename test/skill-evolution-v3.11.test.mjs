// Coded by @qa-engineer
// Tests for spec: specs/skill-evolution-v3.11.md.
// Spec-to-Test map: AC-10/AC-11 -> t1..t7.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

test("AC-10: ROLE_SKILL_MAP contains doc-writer and release-engineer, and their files exist", () => {
  const roleTs = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "role.ts"), "utf-8");
  assert.match(roleTs, /"doc-writer":\s*"skill-doc-writer\.md"/, "doc-writer must be in ROLE_SKILL_MAP");
  assert.match(roleTs, /"release-engineer":\s*"skill-release-engineer\.md"/, "release-engineer must be in ROLE_SKILL_MAP");
  
  const docWriterPath = path.join(PROJECT_ROOT, "content", "skill-doc-writer.md");
  const releaseEngineerPath = path.join(PROJECT_ROOT, "content", "skill-release-engineer.md");
  
  assert.ok(fs.existsSync(docWriterPath), "skill-doc-writer.md must exist");
  assert.ok(fs.existsSync(releaseEngineerPath), "skill-release-engineer.md must exist");
});

test("AC-10/11: tw_switch_role logic and index.ts registration", async () => {
  // Use dynamic import to avoid ESM static resolution issues with dist/
  const { switchRole } = await import(path.join(PROJECT_ROOT, "dist", "tools", "role.js"));
  
  // AC-11: `switchRole` returns the SOP body correctly
  const docWriterRes = JSON.parse(switchRole("doc-writer", PROJECT_ROOT));
  assert.match(docWriterRes.sop, /# Skill: doc-writer/, "doc-writer skill file must contain its header");
  
  const releaseEngineerRes = JSON.parse(switchRole("release-engineer", PROJECT_ROOT));
  assert.match(releaseEngineerRes.sop, /# Skill: release-engineer/, "release-engineer skill file must contain its header");

  // Verify the zod enum strings in index.ts
  const indexTs = fs.readFileSync(path.join(PROJECT_ROOT, "index.ts"), "utf-8");
  assert.match(indexTs, /role: z\.enum\(\[[^\]]*"doc-writer"[^\]]*\]\)/, "index.ts zod enum must contain doc-writer");
  assert.match(indexTs, /role: z\.enum\(\[[^\]]*"release-engineer"[^\]]*\]\)/, "index.ts zod enum must contain release-engineer");

  // Verify the dispatcher routing in index.ts
  assert.match(indexTs, /else if \(name === "doc-writer"\)/, "index.ts must route doc-writer prompt");
  assert.match(indexTs, /else if \(name === "release-engineer"\)/, "index.ts must route release-engineer prompt");
});

test("AC-10: transitions.ts AgentName union is UNCHANGED (side-channel constraint)", () => {
  const transitionsTs = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "transitions.ts"), "utf-8");
  assert.doesNotMatch(transitionsTs, /doc-writer/, "doc-writer must NOT be in transitions.ts");
  assert.doesNotMatch(transitionsTs, /release-engineer/, "release-engineer must NOT be in transitions.ts");
});

test("AC-10: schema/versions.ts schema versions are unchanged", () => {
  const versionsTs = fs.readFileSync(path.join(PROJECT_ROOT, "schema", "versions.ts"), "utf-8");
  assert.match(versionsTs, /handoff:\s*2,/, "CURRENT_VERSIONS.handoff must be 2");
  assert.match(versionsTs, /sqlite:\s*2,/, "CURRENT_VERSIONS.sqlite must be 2");
});

test("AC-10: skill-file schema sanity checks (grep assertions)", () => {
  const docWriterContent = fs.readFileSync(path.join(PROJECT_ROOT, "content", "skill-doc-writer.md"), "utf-8");
  assert.match(docWriterContent, /## Persona/, "doc-writer requires Persona");
  assert.match(docWriterContent, /## Output rule/, "doc-writer requires Output rule");
  assert.match(docWriterContent, /## Hard rules/, "doc-writer requires Hard rules");
  assert.match(docWriterContent, /## Artifact/, "doc-writer requires Artifact");
  assert.match(docWriterContent, /## SOP/, "doc-writer requires SOP");

  const releaseEngineerContent = fs.readFileSync(path.join(PROJECT_ROOT, "content", "skill-release-engineer.md"), "utf-8");
  assert.match(releaseEngineerContent, /## Persona/, "release-engineer requires Persona");
  assert.match(releaseEngineerContent, /## Output rule/, "release-engineer requires Output rule");
  assert.match(releaseEngineerContent, /## Hard rules/, "release-engineer requires Hard rules");
  assert.match(releaseEngineerContent, /## Artifact/, "release-engineer requires Artifact");
  assert.match(releaseEngineerContent, /## SOP/, "release-engineer requires SOP");

  const researcherContent = fs.readFileSync(path.join(PROJECT_ROOT, "content", "skill-researcher.md"), "utf-8");
  assert.match(researcherContent, /Depth/, "researcher requires Depth clause");
  assert.match(researcherContent, /Source Credibility Tier/, "researcher requires Source Credibility Tier clause");
  assert.match(researcherContent, /Recency Gate/, "researcher requires Recency Gate clause");

  const coordinatorLiteContent = fs.readFileSync(path.join(PROJECT_ROOT, "content", "skill-coordinator-lite.md"), "utf-8");
  assert.match(coordinatorLiteContent, /## Scope-creep examples/, "coordinator-lite requires Scope-creep examples");

  const codeReviewerContent = fs.readFileSync(path.join(PROJECT_ROOT, "content", "skill-code-reviewer.md"), "utf-8");
  assert.match(codeReviewerContent, /\*\*Performance\*\*/, "code-reviewer requires Performance section");
});

test("AC-10: Constitution §6 contains the dependency-audit bullet", () => {
  const constitutionContent = fs.readFileSync(path.join(PROJECT_ROOT, "content", "constitution.md"), "utf-8");
  assert.match(constitutionContent, /Dependency audit at build gate/, "constitution §6 must contain dependency-audit bullet");
});
