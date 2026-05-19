// Coded by @sr-engineer
// Shared prompt-builder: every role prompt is constitution + skill + state.
// Each prompts/<role>.ts is a thin wrapper around buildPromptForRole().
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
function isRagCapable(s) {
    return (typeof s === "object" && s !== null &&
        "queryPrdSpec" in s && typeof s.queryPrdSpec === "function");
}
// Coordinator does triage; doesn't need PRD chunks. Skip injection there.
const RAG_SKIP_ROLES = new Set(["teamwork"]);
export async function appendSpecContext(result, workspacePath, role) {
    if (role && RAG_SKIP_ROLES.has(role))
        return result;
    const storage = getActiveStorage();
    if (!isRagCapable(storage))
        return result;
    const state = storage.parse(workspacePath);
    if (!state)
        return result;
    // Query from semantic content only: active_feature + next uncompleted task description.
    // pending_notes contain routing metadata ("next_role: qa-engineer") — low-signal noise
    // that pollutes the embedding query, so we exclude them.
    const tasks = storage.listTasks(workspacePath);
    const nextTask = tasks?.find((t) => !t.completed);
    const queryParts = [state.active_feature];
    if (nextTask)
        queryParts.push(nextTask.description);
    const query = queryParts.join(" — ").slice(0, 500);
    let spec = "";
    try {
        spec = await storage.queryPrdSpec(workspacePath, query, 5);
    }
    catch {
        // Embedding pipeline / DB error — degrade silently to no injection rather
        // than crash the entire prompt fetch.
        return result;
    }
    if (!spec)
        return result;
    const last = result.messages[result.messages.length - 1];
    const injected = last.content.text + `\n\n---\n\n## 📄 Spec Context (RAG — top-5 chunks)\n\n${spec}`;
    return {
        ...result,
        messages: [
            ...result.messages.slice(0, -1),
            { ...last, content: { type: "text", text: injected } },
        ],
    };
}
export function buildPromptForRole(skillFile, description, workspacePath) {
    const constitution = loadContent("constitution.md", workspacePath);
    const skill = loadContent(skillFile, workspacePath);
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
        description,
        messages: [
            {
                role: "user",
                content: { type: "text", text: prompt },
            },
        ],
    };
}
//# sourceMappingURL=build.js.map