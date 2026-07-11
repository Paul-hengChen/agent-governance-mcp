// Coded by @sr-engineer
// Tools: tw_switch_role — load a role's skill SOP into the coordinator's context
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseSkillFile } from "./skill-frontmatter.js";
import { expandPartials } from "../prompts/partials-manifest.js";
import { composeSkill, hostCapabilitiesFor, SKILL_SEGMENTS, } from "../prompts/skill-manifest.js";
import { loadConfig } from "./config.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = fs.existsSync(path.join(PROJECT_ROOT, "content"))
    ? path.join(PROJECT_ROOT, "content")
    : path.join(PROJECT_ROOT, "..", "content");
// `as const` preserves the literal keys so `keyof typeof` yields the proper
// "pm" | "researcher" | "sr-engineer" | "qa-engineer" | "architect" union instead of `string`.
const ROLE_SKILL_MAP = {
    "pm": "skill-pm.md",
    "researcher": "skill-researcher.md",
    "design-auditor": "skill-design-auditor.md",
    "sr-engineer": "skill-sr-engineer.md",
    "code-reviewer": "skill-code-reviewer.md",
    "qa-engineer": "skill-qa-engineer.md",
    "architect": "skill-architect.md",
    // Side-channel roles (v3.11.0): present in the prompt + skill loader, but
    // intentionally absent from tools/transitions.ts AgentName + ALLOWED_TRANSITIONS.
    // Callers must set agent_id to the upstream chain role when invoking
    // tw_update_state on behalf of these skills (see skill-doc-writer.md /
    // skill-release-engineer.md "Side-channel constraint" clause).
    "doc-writer": "skill-doc-writer.md",
    "release-engineer": "skill-release-engineer.md",
};
export function switchRole(role, workspacePath) {
    const skillFile = ROLE_SKILL_MAP[role];
    // Workspace-override-aware loader (workspace .current/ override > server
    // content/ default) — shared by skill/fragment composition below AND the
    // partial expansion further down.
    const hasOverride = (f) => fs.existsSync(path.join(workspacePath, ".current", f));
    const loadFile = (f) => {
        const overridePath = path.join(workspacePath, ".current", f);
        return fs.readFileSync(fs.existsSync(overridePath) ? overridePath : path.join(CONTENT_DIR, f), "utf-8");
    };
    // Existence pre-check preserved for UNSPLIT skills (split skills load their
    // fragments through composeSkill; a missing fragment throws below).
    const isSplit = Object.prototype.hasOwnProperty.call(SKILL_SEGMENTS, skillFile);
    if (!isSplit && !hasOverride(skillFile) && !fs.existsSync(path.join(CONTENT_DIR, skillFile))) {
        return JSON.stringify({ error: `Skill file not found for role "${role}": ${path.join(CONTENT_DIR, skillFile)}` });
    }
    // Host-capability axis (ticket D6): compose the skill from its fragment
    // registry filtered by the workspace's declared host capabilities. The
    // tw_switch_role path IS the non-Task fallback, so its no-config default
    // profile { taskTool: false } is semantically correct — role SOPs delivered
    // here omit Task-dispatch prose unless .current/.config.json declares
    // host: "claude-code" (architecture Q2). A whole-file .current/ override
    // is returned verbatim (no host filtering); unsplit skills pass through.
    const raw = composeSkill(skillFile, hostCapabilitiesFor(loadConfig(workspacePath).host), loadFile, hasOverride);
    // Partial expansion (ticket A12, DR-4): switchRole is the SECOND skill
    // render path — it does NOT flow through buildPromptForRole, so without
    // this call tw_switch_role would leak raw {{PARTIAL:…}} tokens for every
    // partial-adopting role. The loader mirrors the skill override resolution
    // above (workspace .current/ override > server content/ default).
    const { frontmatter, body } = parseSkillFile(expandPartials(raw, loadFile));
    let instruction = `Context-loading only: the server is returning the "${role}" SOP for you to follow. ` +
        `No server-side role enforcement exists — other tw_* tools remain callable regardless. ` +
        `Follow the SOP below exclusively until the task is complete or you switch roles again.`;
    if (frontmatter.recommended_model) {
        instruction +=
            ` Recommended model for this role: ${frontmatter.recommended_model}. ` +
                `Honor via client subagent config or /model switch.`;
    }
    const response = {
        role,
        instruction,
        sop: body,
    };
    if (frontmatter.recommended_model) {
        response.recommended_model = frontmatter.recommended_model;
    }
    return JSON.stringify(response);
}
// ==========================================
// MCP tool handler (registry-pattern) — verbatim relocation of the
// index.ts `tw_switch_role` dispatcher case.
// ==========================================
// --- No guard: role switching is read-only ---
export async function handleSwitchRole(args) {
    const { workspace_path, role } = args;
    const result = switchRole(role, workspace_path);
    return { content: [{ type: "text", text: result }] };
}
//# sourceMappingURL=role.js.map