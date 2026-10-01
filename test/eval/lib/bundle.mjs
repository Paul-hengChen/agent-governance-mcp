// Coded by @sr-engineer
// Bundle loader for the behavioral-eval harness (specs/d4-behavioral-eval-harness.md):
// a thin wrapper over the compiled buildPromptForRole(), so scenarios get the
// exact bundle a real dispatch would and compose changes flow in on build. It
// reads the frozen fixture workspace, never this repo's live handoff, so bundles
// are reproducible; parseHandoff never writes back, so the fixture is not mutated.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPromptForRole } from "../../../dist/prompts/build.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the frozen fixture workspace (AC-8). */
export const FIXTURE_WORKSPACE = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "workspace",
);

// Scenario role -> content/skill-*.md file. Mirrors the prompt registrations
// in index.ts ("teamwork" -> skill-coordinator.md, "teamwork-lite" ->
// skill-coordinator-lite.md, role prompts -> matching file names) plus the
// tw_switch_role-only roles (code-reviewer, design-auditor, doc-writer,
// release-engineer, qa-visual), whose SOP text ships from the same files.
const ROLE_SKILL_FILES = Object.freeze({
  coordinator: "skill-coordinator.md",
  teamwork: "skill-coordinator.md",
  lite: "skill-coordinator-lite.md",
  "coordinator-lite": "skill-coordinator-lite.md",
  "teamwork-lite": "skill-coordinator-lite.md",
  pm: "skill-pm.md",
  researcher: "skill-researcher.md",
  "design-auditor": "skill-design-auditor.md",
  architect: "skill-architect.md",
  "sr-engineer": "skill-sr-engineer.md",
  "code-reviewer": "skill-code-reviewer.md",
  "qa-engineer": "skill-qa-engineer.md",
  "qa-visual": "skill-qa-visual.md",
  "doc-writer": "skill-doc-writer.md",
  "release-engineer": "skill-release-engineer.md",
});

/** Roles the loader knows how to bundle (for scenario validation/messages). */
export const KNOWN_ROLES = Object.freeze(Object.keys(ROLE_SKILL_FILES));

/**
 * Resolve a scenario role name to its skill file. Throws on unknown roles so
 * a typo'd scenario fails loudly at load time, not as a mystery API reply.
 */
export function skillFileForRole(role) {
  const skillFile = ROLE_SKILL_FILES[role];
  if (!skillFile) {
    throw new Error(
      `bundle.mjs: unknown role "${role}" — known roles: ${KNOWN_ROLES.join(", ")}`,
    );
  }
  return skillFile;
}

/**
 * Assemble the role bundle (system-prompt text) for a scenario.
 *
 * @param {string} role - scenario role name (see KNOWN_ROLES)
 * @param {object} [opts]
 * @param {string} [opts.skillFile] - override the role->skill mapping
 * @param {string} [opts.workspacePath] - override the fixture workspace
 * @param {boolean} [opts.fullDetail] - keep rationale blocks (default false,
 *   matching every real dispatch)
 * @returns {string} the assembled bundle text
 */
export function loadBundle(role, opts = {}) {
  const {
    skillFile = skillFileForRole(role),
    workspacePath = FIXTURE_WORKSPACE,
    fullDetail = false,
  } = opts;
  // Same call shape as the prompts/<role>.ts wrappers (e.g. sr-engineer.ts):
  // defaults for resolutionSource / omitConstitution, description is metadata
  // only and never enters the bundle text.
  const result = buildPromptForRole(
    skillFile,
    "Load constitution, skill, state. Run first.",
    workspacePath,
    fullDetail,
  );
  return result.messages[0].content.text;
}
