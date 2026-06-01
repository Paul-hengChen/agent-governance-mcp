// Coded by @qa-engineer
// Tests for tools/skill-frontmatter.ts and the tools/role.ts integration.
// Covers AC7 of specs/model-routing.md (parser positive / missing / malformed)
// + a regression guard that every shipped content/skill-*.md still ships a
// valid recommended_model frontmatter — the silent-disable failure mode
// flagged in specs/model-routing-architecture.md DR-3.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseSkillFile,
  MODEL_TIERS,
} from "../dist/tools/skill-frontmatter.js";
import { switchRole } from "../dist/tools/role.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(REPO_ROOT, "content");

function mkWorkspace() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twfm-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

// ---------------------------------------------------------------------------
// Parser unit tests
// ---------------------------------------------------------------------------

test("parseSkillFile: valid frontmatter returns recommended_model and stripped body", () => {
  const input = `---\nrecommended_model: opus\n---\n# Skill: foo\n\n## Persona\n…`;
  const { frontmatter, body } = parseSkillFile(input);
  assert.equal(frontmatter.recommended_model, "opus");
  assert.ok(body.startsWith("# Skill: foo"), "body must start at the H1 (frontmatter stripped)");
  assert.ok(!body.includes("---"), "stripped body must not retain frontmatter fences");
});

test("parseSkillFile: missing frontmatter returns empty frontmatter and untouched body", () => {
  const input = `# Skill: bare\n\nNo frontmatter here.`;
  const { frontmatter, body } = parseSkillFile(input);
  assert.deepEqual(frontmatter, {}, "no recommended_model when block absent");
  assert.equal(body, input, "body must be byte-identical when no frontmatter");
});

test("parseSkillFile: malformed YAML returns empty frontmatter without throwing", () => {
  // Intentionally invalid YAML — unmatched bracket. Parser must soft-degrade.
  const input = `---\nrecommended_model: [unterminated\n---\n# Skill: bad\n`;
  const { frontmatter, body } = parseSkillFile(input);
  assert.deepEqual(frontmatter, {}, "malformed YAML drops the frontmatter entirely");
  assert.ok(body.startsWith("# Skill: bad"), "body still stripped even when YAML rejected");
});

test("parseSkillFile: invalid recommended_model value drops the field but strips body", () => {
  const input = `---\nrecommended_model: claude-7\n---\n# Skill: x\n`;
  const { frontmatter, body } = parseSkillFile(input);
  assert.equal(
    frontmatter.recommended_model,
    undefined,
    "out-of-enum value dropped to honor MODEL_TIERS contract"
  );
  assert.ok(body.startsWith("# Skill: x"));
});

test("parseSkillFile: unknown extra keys are tolerated (forward-compat reserve)", () => {
  const input = `---\nrecommended_model: sonnet\nfuture_key: somevalue\n---\n# Skill: y\n`;
  const { frontmatter, body } = parseSkillFile(input);
  assert.equal(frontmatter.recommended_model, "sonnet");
  assert.ok(body.startsWith("# Skill: y"));
  // Unknown keys must NOT crash parsing (forward-compat reserve per
  // architect Decision Record on parser growth).
});

test("parseSkillFile: CRLF line endings handled", () => {
  const input = `---\r\nrecommended_model: haiku\r\n---\r\n# Skill: z\r\n`;
  const { frontmatter, body } = parseSkillFile(input);
  assert.equal(frontmatter.recommended_model, "haiku");
  assert.ok(body.startsWith("# Skill: z"));
});

test("MODEL_TIERS contract matches spec table", () => {
  // Regression guard: spec specs/model-routing.md table only references these three.
  assert.deepEqual([...MODEL_TIERS], ["opus", "sonnet", "haiku"]);
});

// ---------------------------------------------------------------------------
// Regression guard: every shipped skill file MUST carry a valid recommended_model.
// Without this, a missing-frontmatter regression silently disables routing for
// that role (the field would just go absent on the wire). PRD AC1.
// ---------------------------------------------------------------------------

test("every content/skill-*.md carries a valid recommended_model frontmatter", () => {
  const files = fs.readdirSync(CONTENT_DIR).filter(
    (f) => f.startsWith("skill-") && f.endsWith(".md"),
  );
  // We ship 12 skill files (see specs/model-routing.md AC1). Guard the count
  // so a deleted file is caught here too.
  assert.equal(files.length, 12, "expected 12 skill files in content/");

  const tiers = new Set(MODEL_TIERS);
  for (const f of files) {
    const text = fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
    const { frontmatter, body } = parseSkillFile(text);
    assert.ok(
      frontmatter.recommended_model,
      `${f} missing recommended_model (PRD AC1 regression)`,
    );
    assert.ok(
      tiers.has(frontmatter.recommended_model),
      `${f} declares unknown tier ${frontmatter.recommended_model}`,
    );
    assert.ok(
      body.startsWith("# Skill:"),
      `${f} body must start at "# Skill:" after stripping (got: ${body.slice(0, 40)})`,
    );
  }
});

// ---------------------------------------------------------------------------
// tools/role.ts integration: tw_switch_role response shape (PRD AC2).
// ---------------------------------------------------------------------------

test("switchRole surfaces recommended_model and strips frontmatter from sop", () => {
  const ws = mkWorkspace();
  const out = JSON.parse(switchRole("sr-engineer", ws));
  assert.equal(out.role, "sr-engineer");
  assert.equal(out.recommended_model, "opus", "sr-engineer tier per Tier Mapping");
  assert.ok(
    out.sop.startsWith("# Skill: sr-engineer"),
    "sop must be the frontmatter-stripped body",
  );
  assert.ok(
    out.instruction.includes("Recommended model for this role: opus"),
    "S02 must be appended to instruction when frontmatter present",
  );
});

test("switchRole on a workspace-override skill without frontmatter omits recommended_model", () => {
  // Backwards-compat AC2: legacy / partial-install skills with no frontmatter
  // must not break and must not surface a `recommended_model: null`.
  const ws = mkWorkspace();
  const overridePath = path.join(ws, ".current", "skill-pm.md");
  fs.writeFileSync(overridePath, `# Skill: pm\n\nLegacy body, no frontmatter.\n`);

  const out = JSON.parse(switchRole("pm", ws));
  assert.equal(out.role, "pm");
  assert.ok(
    !("recommended_model" in out),
    "recommended_model must be OMITTED (not null) when frontmatter absent",
  );
  assert.ok(
    !out.instruction.includes("Recommended model for this role"),
    "S02 must NOT be appended when frontmatter absent",
  );
  assert.ok(out.sop.startsWith("# Skill: pm"));
});
