// Coded by @sr-engineer
// Tools: tw_switch_role — load a role's skill SOP into the coordinator's context
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
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
    "sr-engineer": "skill-sr-engineer.md",
    "qa-engineer": "skill-qa-engineer.md",
    "architect": "skill-architect.md",
};
export function switchRole(role, workspacePath) {
    const skillFile = ROLE_SKILL_MAP[role];
    // Workspace override > server default
    const override = path.join(workspacePath, ".current", skillFile);
    const filePath = fs.existsSync(override)
        ? override
        : path.join(CONTENT_DIR, skillFile);
    if (!fs.existsSync(filePath)) {
        return JSON.stringify({ error: `Skill file not found for role "${role}": ${filePath}` });
    }
    const skill = fs.readFileSync(filePath, "utf-8");
    return JSON.stringify({
        role,
        instruction: `Context-loading only: the server is returning the "${role}" SOP for you to follow. ` +
            `No server-side role enforcement exists — other tw_* tools remain callable regardless. ` +
            `Follow the SOP below exclusively until the task is complete or you switch roles again.`,
        sop: skill,
    });
}
//# sourceMappingURL=role.js.map