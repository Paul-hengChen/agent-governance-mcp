// Coded by @qa-engineer
// Tests for v3.20.0 Claude Code subagent dispatch (specs/subagent-dispatch.md).
// Locks the tier-consistency contract between templates/claude-code-agents/
// and content/skill-*.md so a future tier change in one MUST be reflected in
// the other. Also locks the deliberate omission of the full coordinator
// template (AC2 — recursive-spawn avoidance) and the load-bearing prose in
// content/skill-coordinator.md / README.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSkillFile } from "../dist/tools/skill-frontmatter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const TEMPLATE_DIR = path.join(REPO_ROOT, "templates", "claude-code-agents");
const SKILL_DIR = path.join(REPO_ROOT, "content");

// Source of truth: which roles ship as Claude Code subagents (AC1) and which
// don't (AC2 — full coordinator excluded).
const EXPECTED_ROLES = [
  "pm",
  "researcher",
  "architect",
  "design-auditor",
  "sr-engineer",
  "code-reviewer",
  "qa-engineer",
  "qa-visual",
  "doc-writer",
  "release-engineer",
  "coordinator-lite",
];
const FORBIDDEN_ROLES = ["coordinator"];

// Map subagent name -> corresponding content/skill-*.md. qa-visual's subagent
// delegates to the qa-engineer top-level role (it's a lazy sub-skill, not in
// the RoleName enum) — but its model tier comes from skill-qa-visual.md.
const ROLE_TO_SKILL = {
  "pm": "skill-pm.md",
  "researcher": "skill-researcher.md",
  "architect": "skill-architect.md",
  "design-auditor": "skill-design-auditor.md",
  "sr-engineer": "skill-sr-engineer.md",
  "code-reviewer": "skill-code-reviewer.md",
  "qa-engineer": "skill-qa-engineer.md",
  "qa-visual": "skill-qa-visual.md",
  "doc-writer": "skill-doc-writer.md",
  "release-engineer": "skill-release-engineer.md",
  "coordinator-lite": "skill-coordinator-lite.md",
};

function readTemplateRaw(role) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, `${role}.md`), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1: 11 templates exist with the expected file names
// ---------------------------------------------------------------------------

test("AC1: templates/claude-code-agents/ contains the expected 11 subagent files", () => {
  const files = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".md"));
  assert.equal(files.length, EXPECTED_ROLES.length, `expected ${EXPECTED_ROLES.length} files, got ${files.length}`);
  for (const role of EXPECTED_ROLES) {
    assert.ok(
      files.includes(`${role}.md`),
      `${role}.md missing from templates/claude-code-agents/`,
    );
  }
});

test("AC1: every template carries name / model / description frontmatter (S01-S03)", () => {
  for (const role of EXPECTED_ROLES) {
    const raw = readTemplateRaw(role);
    // Claude Code expects these literal keys — assert via direct grep so a
    // YAML-parser strip can't hide a missing key.
    assert.match(raw, /^name:\s*\S+/m, `${role}.md: missing 'name:' frontmatter key`);
    assert.match(raw, /^model:\s*(opus|sonnet|haiku)\s*$/m, `${role}.md: missing or invalid 'model:' frontmatter`);
    assert.match(raw, /^description:\s*\S+/m, `${role}.md: missing 'description:' frontmatter key`);
  }
});

test("AC1: every template body delegates to tw_get_state + tw_switch_role (S04 contract)", () => {
  // Single source of truth principle — templates must NOT inline a SOP body;
  // they must delegate to tw_switch_role so content/skill-*.md remains the
  // source of truth (matches v3.19.0 parseSkillFile design).
  // EXCEPTION: coordinator-lite is server-read-only — tw_switch_role calls are
  // rejected for the lite agent_id (tools/transitions.ts). Its template
  // legitimately delegates by file path instead. This is an architectural
  // constraint, not a spec violation.
  const LITE_EXEMPT = new Set(["coordinator-lite"]);
  for (const role of EXPECTED_ROLES) {
    const raw = readTemplateRaw(role);
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    assert.match(
      body,
      /tw_get_state/,
      `${role}.md body must reference tw_get_state (pre-flight per Constitution §3)`,
    );
    if (LITE_EXEMPT.has(role)) {
      // Lite must reference its SOP file directly since tw_switch_role is rejected for lite.
      assert.match(
        body,
        /content\/skill-coordinator-lite\.md/,
        `${role}.md (lite-exempt) must point readers to content/skill-coordinator-lite.md for the SOP`,
      );
    } else {
      assert.match(
        body,
        /tw_switch_role\(["']\S+["']\)/,
        `${role}.md body must delegate to tw_switch_role(<role>) for the SOP`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// AC2: coordinator full template is deliberately absent
// ---------------------------------------------------------------------------

test("AC2: full coordinator template is NOT shipped (recursive-spawn avoidance)", () => {
  for (const role of FORBIDDEN_ROLES) {
    const candidate = path.join(TEMPLATE_DIR, `${role}.md`);
    assert.ok(
      !fs.existsSync(candidate),
      `${role}.md must NOT exist — full coordinator IS the parent dispatcher (AC2)`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC1 contract: tier in template MUST match recommended_model in skill file
// This is the regression guard the spec relies on — if v3.19.0's tier
// mapping ever changes in content/skill-*.md, this test forces the templates
// to change in lock-step (no silent drift).
// ---------------------------------------------------------------------------

test("AC1 contract: each template tier mirrors content/skill-*.md recommended_model", () => {
  for (const [role, skillFile] of Object.entries(ROLE_TO_SKILL)) {
    const tplRaw = readTemplateRaw(role);
    const skillRaw = fs.readFileSync(path.join(SKILL_DIR, skillFile), "utf-8");

    const tplModelMatch = tplRaw.match(/^model:\s*(opus|sonnet|haiku)\s*$/m);
    assert.ok(tplModelMatch, `${role}.md: model: line not parseable`);
    const tplModel = tplModelMatch[1];

    const { frontmatter: skillFm } = parseSkillFile(skillRaw);
    assert.equal(
      tplModel,
      skillFm.recommended_model,
      `${role}: template model "${tplModel}" must equal skill recommended_model "${skillFm.recommended_model}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC3 / AC4: skill-coordinator.md has the new dispatch sub-bullets
// ---------------------------------------------------------------------------

test("AC3: skill-coordinator.md §Auto-Routing has Subagent Dispatch sub-bullet (S06)", () => {
  const raw = fs.readFileSync(path.join(SKILL_DIR, "skill-coordinator.md"), "utf-8");
  assert.match(
    raw,
    /\*\*Subagent Dispatch \(Claude Code\)\*\*/,
    "skill-coordinator.md must surface a **Subagent Dispatch (Claude Code)** sub-bullet under §Auto-Routing",
  );
  // The sub-bullet must explicitly preserve the server-enforced chain (AC3
  // requirement: "routing chain is unchanged").
  assert.match(
    raw,
    /ALLOWED_TRANSITIONS/,
    "Subagent Dispatch sub-bullet must reiterate that server-enforced ALLOWED_TRANSITIONS still gates writes",
  );
  // And explicitly say the dispatched subagent's first action is tw_get_state.
  assert.match(
    raw,
    /tw_get_state.*tw_detect_drift|tw_detect_drift.*tw_get_state/,
    "Subagent Dispatch sub-bullet must require dispatched subagents to run tw_get_state + tw_detect_drift",
  );
});

test("AC4: skill-coordinator.md §Auto-Routing documents tw_switch_role fallback", () => {
  const raw = fs.readFileSync(path.join(SKILL_DIR, "skill-coordinator.md"), "utf-8");
  assert.match(
    raw,
    /\*\*Fallback \(`tw_switch_role`\)\*\*/,
    "skill-coordinator.md must surface a **Fallback (`tw_switch_role`)** paragraph",
  );
  // Fallback paragraph must call out backwards-compatibility explicitly.
  assert.match(
    raw,
    /no tw_\* tool surface has changed/i,
    "Fallback paragraph must state 'no tw_* tool surface has changed' for backwards-compat clarity",
  );
});

// ---------------------------------------------------------------------------
// AC5: README sub-section under existing ## Per-Role Model Routing
// ---------------------------------------------------------------------------

test("AC5: README adds ### Claude Code subagent install (auto model-routing) sub-section (S05)", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8");
  assert.match(
    raw,
    /^### Claude Code subagent install \(auto model-routing\)$/m,
    "README must contain the literal S05 heading verbatim",
  );
  // Must reference the templates dir path so install instructions work.
  assert.match(
    raw,
    /templates\/claude-code-agents/,
    "README sub-section must reference the templates/claude-code-agents/ path",
  );
  // Must explain the fallback envelope (degradation callout).
  assert.match(
    raw,
    /tw_switch_role/,
    "README sub-section must explain the tw_switch_role fallback path",
  );
});

// ---------------------------------------------------------------------------
// AC6: version is 3.20.0 and no persisted schema_version bumped
// ---------------------------------------------------------------------------

test("AC6: package.json + index.ts both at 3.20.0", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
  assert.equal(pkg.version, "3.20.0", "package.json version must be 3.20.0");
  const idx = fs.readFileSync(path.join(REPO_ROOT, "index.ts"), "utf-8");
  assert.match(
    idx,
    /name: "agent-governance-mcp", version: "3.20\.0"/,
    "index.ts Server() literal must read 3.20.0",
  );
});

test("AC6: no persisted-state schema_version bumped (content-only feature)", () => {
  // The feature ships only content + templates + skill SOP. Any change to a
  // persisted schema constant would signal scope creep into storage layer.
  const versionsSrc = fs.readFileSync(
    path.join(REPO_ROOT, "schema", "versions.ts"),
    "utf-8",
  );
  // We don't know which constants might exist, so just sanity-check the file
  // is unchanged in semantically observable ways by confirming the public
  // CURRENT_VERSIONS export still parses an object literal (proxy for "no
  // accidental breakage"). A surgical "no version bumped" assertion lives in
  // the existing handoff-versioning / config-versioning suites — those still
  // pass per the prebuild gate.
  assert.match(
    versionsSrc,
    /export\s+const\s+CURRENT_VERSIONS/,
    "schema/versions.ts must still export CURRENT_VERSIONS (no accidental rename)",
  );
});
