// Coded by @qa-engineer
// Tests for v3.20.0+ Claude Code subagent dispatch (specs/subagent-dispatch.md),
// v3.21.0 short-name + teamwork-template additions (specs/subagent-short-names.md),
// v3.21.1 watermark reminder (specs/subagent-watermark-reminder.md),
// and v3.21.2 haiku watermark compliance (specs/subagent-watermark-haiku-compliance.md).
// Locks the tier-consistency contract between templates/claude-code-agents/
// and content/skill-*.md so a future tier change in one MUST be reflected in
// the other. v3.21.0 reverses v3.20.0 AC2 (coordinator template now SHIPS as
// `teamwork.md`); the FORBIDDEN_ROLES "coordinator absent" test is removed
// accordingly. The load-bearing prose in content/skill-coordinator.md and
// README.md is still verified.

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

// Source of truth: which roles ship as Claude Code subagents (AC1).
// v3.21.0: 12 templates — `coordinator-lite` renamed to `lite`, NEW `teamwork`.
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
  "lite",
  "teamwork",
];

// Map subagent name -> corresponding content/skill-*.md. qa-visual's subagent
// delegates to the qa-engineer top-level role (it's a lazy sub-skill, not in
// the RoleName enum) — but its model tier comes from skill-qa-visual.md.
// v3.21.0: `lite` maps to the unchanged skill-coordinator-lite.md;
// `teamwork` maps to skill-coordinator.md (full coordinator subagent).
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
  "lite": "skill-coordinator-lite.md",
  "teamwork": "skill-coordinator.md",
};

// Templates whose body legitimately delegates by file path instead of
// tw_switch_role:
//   - `lite`: lite mode is server-read-only (tools/transitions.ts rejects
//     lite agent_id for any tw_* write). It references
//     content/skill-coordinator-lite.md directly.
//   - `teamwork`: the full coordinator role is NOT in the RoleName enum
//     exposed by tw_switch_role (tools/role.ts ROLE_SKILL_MAP) — it's the
//     dispatcher, not a destination. It references content/skill-coordinator.md
//     directly.
const FILE_PATH_DELEGATES = {
  "lite": /content\/skill-coordinator-lite\.md/,
  "teamwork": /content\/skill-coordinator\.md/,
};

function readTemplateRaw(role) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, `${role}.md`), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1 (v3.20.0) + AC1/AC2 (v3.21.0): templates exist with expected file names
// ---------------------------------------------------------------------------

test("AC1: templates/claude-code-agents/ contains the expected 12 subagent files", () => {
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
  // they must delegate so content/skill-*.md remains the source of truth.
  // EXEMPTIONS (v3.21.0): two templates legitimately delegate by file path
  // instead of tw_switch_role — see FILE_PATH_DELEGATES above for the
  // per-template reason.
  for (const role of EXPECTED_ROLES) {
    const raw = readTemplateRaw(role);
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    assert.match(
      body,
      /tw_get_state/,
      `${role}.md body must reference tw_get_state (pre-flight per Constitution §3)`,
    );
    if (role in FILE_PATH_DELEGATES) {
      assert.match(
        body,
        FILE_PATH_DELEGATES[role],
        `${role}.md (file-path delegate) must point readers to the documented skill file path`,
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

// v3.21.0: the v3.20.0 "full coordinator template is NOT shipped" assertion is
// REMOVED. v3.20.0 AC2 (recursive-spawn avoidance) was reversed once Claude
// Code Dynamic Workflows (May 2026) confirmed nested subagent spawn is
// supported. The `teamwork.md` template now ships — covered by the
// EXPECTED_ROLES membership tests above. See specs/subagent-short-names.md §AC3.

// ---------------------------------------------------------------------------
// Tier-consistency regression guard
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
// AC3 / AC4 (v3.20.0): skill-coordinator.md dispatch sub-bullets — unchanged
// ---------------------------------------------------------------------------

test("AC3: skill-coordinator.md §Auto-Routing has Subagent Dispatch sub-bullet (S06)", () => {
  const raw = fs.readFileSync(path.join(SKILL_DIR, "skill-coordinator.md"), "utf-8");
  assert.match(
    raw,
    /\*\*Subagent Dispatch \(Claude Code\)\*\*/,
    "skill-coordinator.md must surface a **Subagent Dispatch (Claude Code)** sub-bullet under §Auto-Routing",
  );
  assert.match(
    raw,
    /ALLOWED_TRANSITIONS/,
    "Subagent Dispatch sub-bullet must reiterate that server-enforced ALLOWED_TRANSITIONS still gates writes",
  );
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
  assert.match(
    raw,
    /no tw_\* tool surface has changed/i,
    "Fallback paragraph must state 'no tw_* tool surface has changed' for backwards-compat clarity",
  );
});

// ---------------------------------------------------------------------------
// AC5 (v3.20.0): README sub-section heading
// ---------------------------------------------------------------------------

test("AC5: README adds ### Claude Code subagent install (auto model-routing) sub-section (S05)", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8");
  assert.match(
    raw,
    /^### Claude Code subagent install \(auto model-routing\)$/m,
    "README must contain the literal S05 heading verbatim",
  );
  assert.match(
    raw,
    /templates\/claude-code-agents/,
    "README sub-section must reference the templates/claude-code-agents/ path",
  );
  assert.match(
    raw,
    /tw_switch_role/,
    "README sub-section must explain the tw_switch_role fallback path",
  );
});

// v3.21.0: README must surface @teamwork + @lite as primary entry points + S06 migration note.
test("v3.21.0 AC4: README surfaces @teamwork and @lite primaries + migration note (S06)", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8");
  assert.match(
    raw,
    /@teamwork/,
    "README must surface @teamwork as a primary entry point",
  );
  assert.match(
    raw,
    /@lite/,
    "README must surface @lite as a primary entry point",
  );
  assert.match(
    raw,
    /rm\s+~\/\.claude\/agents\/coordinator-lite\.md/,
    "README must include the v3.20.0 -> v3.21.0 migration command (rm coordinator-lite.md)",
  );
});

// ---------------------------------------------------------------------------
// v3.21.1 AC1 / AC2: watermark reminder in every template
// ---------------------------------------------------------------------------

test("v3.21.1 AC1: every template body contains the watermark reminder with correct name+tier", () => {
  for (const role of EXPECTED_ROLES) {
    const raw = readTemplateRaw(role);
    const nameMatch = raw.match(/^name:\s*(\S+)/m);
    const modelMatch = raw.match(/^model:\s*(\S+)/m);
    assert.ok(nameMatch, `${role}.md: name: not found`);
    assert.ok(modelMatch, `${role}.md: model: not found`);
    const name = nameMatch[1];
    const tier = modelMatch[1];
    const expected = `End every reply with \`— @${name} (${tier})\` per Constitution §1 (watermark).`;
    assert.ok(
      raw.includes(expected),
      `${role}.md: missing watermark reminder line. Expected: ${expected}`,
    );
  }
});

test("v3.21.1 AC3: adding watermark line did not mutate any template frontmatter", () => {
  // Frontmatter keys must still be parseable and unchanged from AC1 tests above.
  // This is a structural guard — if the watermark edit accidentally touched
  // the --- fences or frontmatter keys, this will catch it.
  for (const role of EXPECTED_ROLES) {
    const raw = readTemplateRaw(role);
    assert.match(raw, /^---\r?\n/, `${role}.md: must start with --- fence`);
    assert.match(raw, /\n---\r?\n/, `${role}.md: must have closing --- fence`);
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    // Body must have at least two non-empty lines (delegation + watermark)
    const nonEmpty = body.split(/\r?\n/).filter((l) => l.trim().length > 0);
    assert.ok(
      nonEmpty.length >= 2,
      `${role}.md: body must have delegation line + watermark line (got ${nonEmpty.length} non-empty lines)`,
    );
  }
});

// ---------------------------------------------------------------------------
// v3.21.2 AC1: CRITICAL: must be the FIRST non-blank body line in every template
// ---------------------------------------------------------------------------

test("v3.21.2 AC1: every template body's FIRST non-blank line is the CRITICAL: watermark reminder", () => {
  // Contract: haiku models attend strongly to top-of-context content.
  // The watermark instruction MUST be the first thing a subagent reads after
  // the frontmatter fence — not buried after SOP prose — so it cannot be
  // deferred or skipped regardless of reply length.
  for (const role of EXPECTED_ROLES) {
    const raw = readTemplateRaw(role);
    const nameMatch = raw.match(/^name:\s*(\S+)/m);
    const modelMatch = raw.match(/^model:\s*(\S+)/m);
    assert.ok(nameMatch, `${role}.md: name: not found`);
    assert.ok(modelMatch, `${role}.md: model: not found`);
    const name = nameMatch[1];
    const tier = modelMatch[1];
    // Strip frontmatter (everything up to and including the closing --- fence).
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    // First non-blank line of the body must be the CRITICAL: reminder verbatim.
    const firstNonBlank = body.split(/\r?\n/).find((l) => l.trim().length > 0);
    const expected = `CRITICAL: End every reply with \`— @${name} (${tier})\` per Constitution §1 (watermark).`;
    assert.equal(
      firstNonBlank,
      expected,
      `${role}.md: first non-blank body line must be the CRITICAL: reminder. Got: "${firstNonBlank}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// v3.21.2 AC2: haiku templates must contain an example reply suffix block
// ---------------------------------------------------------------------------

const HAIKU_ROLES = ["lite", "doc-writer", "release-engineer"];

test("v3.21.2 AC2: haiku templates each contain an example reply suffix line preceded by a blank line", () => {
  // Contract: a one-shot output-shape example is required for haiku-tier templates
  // because haiku models show compliance gaps on short replies without it.
  // The example must appear AFTER the main SOP body (at file end) and must be
  // preceded by a blank line so it reads as a distinct block, not inline prose.
  for (const role of HAIKU_ROLES) {
    const raw = readTemplateRaw(role);
    const nameMatch = raw.match(/^name:\s*(\S+)/m);
    assert.ok(nameMatch, `${role}.md: name: not found`);
    const name = nameMatch[1];
    const exampleLine = `Example reply suffix: … — @${name} (haiku)`;
    // The exact example line must be present.
    assert.ok(
      raw.includes(exampleLine),
      `${role}.md: missing example reply suffix line. Expected: "${exampleLine}"`,
    );
    // The line preceding the example must be blank (empty or whitespace-only)
    // so it forms a visually distinct block — this is load-bearing for the
    // output-shape grounding contract.
    const lines = raw.split(/\r?\n/);
    const exampleIdx = lines.findIndex((l) => l === exampleLine);
    assert.ok(exampleIdx > 0, `${role}.md: example line must not be the first line`);
    const prevLine = lines[exampleIdx - 1];
    assert.equal(
      prevLine.trim(),
      "",
      `${role}.md: line before "${exampleLine}" must be blank. Got: "${prevLine}"`,
    );
  }
});

test("v3.21.2 AC2: non-haiku templates do NOT contain an example reply suffix line", () => {
  // Contract: the example-reply addition is haiku-only (spec §Out of Scope).
  // Non-haiku templates must not drift toward adding the example block.
  const nonHaikuRoles = EXPECTED_ROLES.filter((r) => !HAIKU_ROLES.includes(r));
  for (const role of nonHaikuRoles) {
    const raw = readTemplateRaw(role);
    assert.ok(
      !raw.includes("Example reply suffix:"),
      `${role}.md: non-haiku template must NOT contain an "Example reply suffix:" line`,
    );
  }
});

// ---------------------------------------------------------------------------
// Version checks
// ---------------------------------------------------------------------------

test("v3.23.0 AC8: package.json + index.ts both at 3.23.0", () => {
  // v3.23.0 ships the watermark-hide-model-tier feature
  // (specs/watermark-hide-model-tier.md): two-format watermark regime —
  // subagent context (Task-dispatched, model pinned) → — @<role> (<tier>);
  // non-subagent context (coordinator, coordinator-lite, tw_switch_role) → — @<role> (no tier).
  // constitution §1, skill-coordinator.md, skill-coordinator-lite.md updated accordingly.
  // MINOR bump from 3.22.1 — new observable output format, no breaking API changes.
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
  assert.equal(pkg.version, "3.23.0", "package.json version must be 3.23.0");
  const idx = fs.readFileSync(path.join(REPO_ROOT, "index.ts"), "utf-8");
  assert.match(
    idx,
    /name: "agent-governance-mcp", version: "3\.23\.0"/,
    "index.ts Server() literal must read 3.23.0",
  );
});

test("AC6: no persisted-state schema_version bumped (content-only feature)", () => {
  const versionsSrc = fs.readFileSync(
    path.join(REPO_ROOT, "schema", "versions.ts"),
    "utf-8",
  );
  assert.match(
    versionsSrc,
    /export\s+const\s+CURRENT_VERSIONS/,
    "schema/versions.ts must still export CURRENT_VERSIONS (no accidental rename)",
  );
});
