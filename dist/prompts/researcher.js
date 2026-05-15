// Coded by @researcher
// MCP Prompt: researcher — auto-injects constitution + skill + project state
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getActiveStorage } from "../tools/storage.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = fs.existsSync(path.join(PROJECT_ROOT, "content"))
    ? path.join(PROJECT_ROOT, "content")
    : path.join(PROJECT_ROOT, "..", "content");
function loadContent(filename, workspacePath) {
    if (workspacePath) {
        const override = path.join(workspacePath, ".current", filename);
        if (fs.existsSync(override)) {
            return fs.readFileSync(override, "utf-8");
        }
    }
    const filePath = path.join(CONTENT_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return `[ERROR: ${filename} not found at ${filePath}]`;
    }
    return fs.readFileSync(filePath, "utf-8");
}
export function buildResearcherPrompt(workspacePath) {
    const constitution = loadContent("constitution.md", workspacePath);
    const skill = loadContent("skill-researcher.md", workspacePath);
    let state = null;
    try {
        state = getActiveStorage().parse(workspacePath);
    }
    catch {
        // fall through to "no state" block
    }
    const stateBlock = state
        ? `## 📍 Current Project State (Auto-injected)\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``
        : `## 📍 Current Project State\nNo handoff state found. Fresh project — call \`tw_get_state\` to initialize.`;
    const prompt = `${constitution}\n\n---\n\n${skill}\n\n---\n\n${stateBlock}`;
    return {
        description: "Deep research. Load constitution, skill, state.",
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: prompt,
                },
            },
        ],
    };
}
//# sourceMappingURL=researcher.js.map