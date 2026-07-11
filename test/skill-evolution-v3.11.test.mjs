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

// d6-host-capability-compose-axis (T-D6-04): content/skill-coordinator.md is
// retired — it is no longer a compose source. readContentFile composes the
// full-capability (taskTool:true) reconstruction for that one filename
// (byte-identical to the retired monolith, AC5) and falls through to a plain
// read for every other (unsplit) content file.
const { composeSkill, hostCapabilitiesFor } = await import(path.join(PROJECT_ROOT, "dist", "prompts", "skill-manifest.js"));
function readContentFile(f) {
  return composeSkill(f, hostCapabilitiesFor("claude-code"), (g) => fs.readFileSync(path.join(PROJECT_ROOT, "content", g), "utf-8"));
}

test("AC-10: ROLE_SKILL_MAP contains doc-writer and release-engineer, and their files exist", () => {
  const roleTs = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "role.ts"), "utf-8");
  assert.match(roleTs, /"doc-writer":\s*"skill-doc-writer\.md"/, "doc-writer must be in ROLE_SKILL_MAP");
  assert.match(roleTs, /"release-engineer":\s*"skill-release-engineer\.md"/, "release-engineer must be in ROLE_SKILL_MAP");
  
  const docWriterPath = path.join(PROJECT_ROOT, "content", "skill-doc-writer.md");
  const releaseEngineerPath = path.join(PROJECT_ROOT, "content", "skill-release-engineer.md");
  
  assert.ok(fs.existsSync(docWriterPath), "skill-doc-writer.md must exist");
  assert.ok(fs.existsSync(releaseEngineerPath), "skill-release-engineer.md must exist");
});

test("AC-10/11: tw_switch_role logic and registry registration", async () => {
  // Use dynamic import to avoid ESM static resolution issues with dist/
  const { switchRole } = await import(path.join(PROJECT_ROOT, "dist", "tools", "role.js"));

  // AC-11: `switchRole` returns the SOP body correctly
  const docWriterRes = JSON.parse(switchRole("doc-writer", PROJECT_ROOT));
  assert.match(docWriterRes.sop, /# Skill: doc-writer/, "doc-writer skill file must contain its header");

  const releaseEngineerRes = JSON.parse(switchRole("release-engineer", PROJECT_ROOT));
  assert.match(releaseEngineerRes.sop, /# Skill: release-engineer/, "release-engineer skill file must contain its header");

  // Verify the zod enum strings — relocated from index.ts to tools/registry.ts by
  // the registry-pattern refactor (registration mechanics only, same enum literal).
  const registryTs = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "registry.ts"), "utf-8");
  assert.match(registryTs, /role: z\.enum\(\[[^\]]*"doc-writer"[^\]]*\]\)/, "tools/registry.ts zod enum must contain doc-writer");
  assert.match(registryTs, /role: z\.enum\(\[[^\]]*"release-engineer"[^\]]*\]\)/, "tools/registry.ts zod enum must contain release-engineer");

  // Verify the dispatcher routing — the 11-branch if-chain was replaced by
  // PROMPT_REGISTRY, a declarative array iterated/looked-up by name. Drive the
  // actual registered behavior instead of regexing dispatch source text.
  const { PROMPT_REGISTRY } = await import(path.join(PROJECT_ROOT, "dist", "tools", "registry.js"));
  assert.ok(PROMPT_REGISTRY.some((p) => p.name === "doc-writer"), "PROMPT_REGISTRY must route doc-writer prompt");
  assert.ok(PROMPT_REGISTRY.some((p) => p.name === "release-engineer"), "PROMPT_REGISTRY must route release-engineer prompt");
});

test("AC-10: transitions.ts AgentName union constraint (side-channel)", () => {
  // v3.11 constraint: doc-writer is a content-only role and must NOT appear in the
  // ALLOWED_TRANSITIONS state machine — it has no qa-flow routing.
  // v3.28.0 (A5 matrix fix): release-engineer WAS deliberately added to transitions.ts
  // as a terminal PASS role so the state machine can route qa-engineer:PASS →
  // release-engineer:In_Progress without a human-break. This is an intentional
  // promotion of release-engineer from "human decision" to a first-class chain role.
  const transitionsTs = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "transitions.ts"), "utf-8");
  assert.doesNotMatch(transitionsTs, /doc-writer/, "doc-writer must NOT be in transitions.ts (content-only role, no qa-flow routing)");
  assert.match(transitionsTs, /release-engineer/, "release-engineer MUST be in transitions.ts (v3.28.0 A5 matrix promotion — terminal PASS role)");
});

test("AC-10: schema/versions.ts schema versions track e2-bugfix-repro-gate bump", () => {
  // c9-protocol-fields bumped handoff to 7 (next_role/resume_of/review_verdict,
  // stamp-only migration, DR-1). b8-external-ref-ledger had bumped it to 6
  // (external_refs for EXTERNAL_REFS_UNRESOLVED). c14-dispatch-pins bumped it to
  // 8 (dispatch_pins, stamp-only migration, AC-1). d2-server-brake-accounting
  // bumped it to 9 (hop_count, seeded 0, DR-3). d5-server-side-stale-dispatch-
  // detection bumped it to 10 (dispatched_at, stamp-only, seeds nothing,
  // DR-7 — next_role's direct companion). e2-bugfix-repro-gate now bumps it to
  // 11 (dispatch_mode, stamp-only, seeds nothing — the dispatch_pins/
  // external_refs feature-scoped carry-forward algorithm, but scalar). sqlite
  // stays at 2 — hop_count IS added there too, but via an idempotent
  // addColumnIfMissing ALTER (DR-2), no schema_meta bump, the exact mechanism
  // visual_round used; unlike dispatch_pins/external_refs/dispatched_at/
  // dispatch_mode, which are handoff-YAML frontmatter only, no SQLite column
  // at all (DR-5).
  const versionsTs = fs.readFileSync(path.join(PROJECT_ROOT, "schema", "versions.ts"), "utf-8");
  assert.match(versionsTs, /handoff:\s*11,/, "CURRENT_VERSIONS.handoff must be 11 (e2-bugfix-repro-gate)");
  assert.match(versionsTs, /sqlite:\s*2,/, "CURRENT_VERSIONS.sqlite must remain 2");
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

test("c9-protocol-fields (T-C9-12..16, AC-7): all 13 in-scope content files have retired the next_role:/resume_of:/review: pending_notes token convention", () => {
  // Why: AC-7 requires that every content file previously instructing roles to
  // embed `next_role: <role>`, `resume_of: <role>`, or `review: APPROVED|
  // CHANGES_REQUESTED` INSIDE pending_notes be updated to reference the
  // corresponding first-class handoff field instead. This is a repo-wide
  // regression sweep across the exact 13-file list the spec enumerates
  // (Dependencies / Resource Audit Gate) — most individual files already have
  // narrower assertions elsewhere (compose-equivalence goldens, context-budget
  // token caps, phase-0-5-sop, qa-visual-skill-split, pixel-perfect-visual-
  // compare); this test is the belt-and-braces sweep proving NONE of the 13
  // still carries the retired pending_notes token shape, including the 5
  // files (skill-code-reviewer, skill-release-engineer, skill-design-auditor,
  // skill-doc-writer, skill-researcher) with no other test touching this
  // specific convention.
  const AC7_FILES = [
    "const-05-core-standards.md",
    "const-08-chain-31-mid.md",
    "const-12-chain-r10-s4.md",
    "skill-coordinator.md",
    "skill-pm.md",
    "skill-sr-engineer.md",
    "skill-architect.md",
    "skill-code-reviewer.md",
    "skill-qa-visual.md",
    "skill-release-engineer.md",
    "skill-design-auditor.md",
    "skill-doc-writer.md",
    "skill-researcher.md",
  ];
  // Retired shapes: a colon-form pending_notes token, e.g. `next_role: pm` or
  // `"next_role: sr-engineer"` inside a note string. The new convention uses
  // `next_role="<role>"` / `next_role=<role>` (a tw_update_state kwarg) or a
  // bare table cell — neither of which this pattern matches.
  const RETIRED_NEXT_ROLE = /next_role:\s*[a-z-]/;
  const RETIRED_RESUME_OF = /resume_of:\s*[a-z-]/;
  const RETIRED_REVIEW_VERDICT = /review:\s*(APPROVED|CHANGES_REQUESTED)/;
  for (const file of AC7_FILES) {
    const body = readContentFile(file);
    assert.doesNotMatch(body, RETIRED_NEXT_ROLE, `${file} must not retain the retired 'next_role: <role>' pending_notes token`);
    assert.doesNotMatch(body, RETIRED_RESUME_OF, `${file} must not retain the retired 'resume_of: <role>' pending_notes token`);
    assert.doesNotMatch(body, RETIRED_REVIEW_VERDICT, `${file} must not retain the retired 'review: APPROVED|CHANGES_REQUESTED' pending_notes token`);
  }
});

test("AC-10: Constitution §6 contains the dependency-audit bullet", async () => {
  // compose-not-strip (ticket A9, DR-6): content/constitution.md is retired (AC8);
  // composeConstitution({chain:true,design:true}) reproduces it byte-for-byte
  // (Option R, architecture DR-1), so this mechanical swap changes no assertion.
  const { composeConstitution } = await import(path.join(PROJECT_ROOT, "dist", "prompts", "build.js"));
  const constitutionContent = composeConstitution({ chain: true, design: true });
  assert.match(constitutionContent, /Dependency audit at build gate/, "constitution §6 must contain dependency-audit bullet");
});
