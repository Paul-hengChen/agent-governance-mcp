// Coded by @sr-engineer
// Shared prompt-builder: every role prompt is constitution + skill + state.
// Each prompts/<role>.ts is a thin wrapper around buildPromptForRole().
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getActiveStorage } from "../tools/storage.js";
import { buildPrdChunks, CHUNKER_VERSION, DEFAULT_EMBEDDING_MODEL, } from "../tools/rag.js";
import { getInflightKey, getInflight, setInflight, deleteInflight, } from "../tools/rag-coalesce.js";
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
// Remove every <!-- chain-only:start --> … <!-- chain-only:end --> block
// (markers inclusive) and collapse the blank lines left behind. Idempotent;
// text with no markers is returned unchanged (full-constitution safety default).
// Chain-only sections (constitution §3.1, §4) govern role-to-role transitions
// that lite contexts cannot exercise — stripping them trims the always-on budget
// without dropping any rule a lite agent could use. A duplicate of this function
// lives in bin/agent-governance-context.mjs (different module system — see
// specs/context-budget-reduction-architecture.md DR-3); keep the regex in sync.
export function stripChainOnly(text) {
    return text
        .replace(/<!-- chain-only:start -->[\s\S]*?<!-- chain-only:end -->\n?/g, "")
        .replace(/\n{3,}/g, "\n\n");
}
// The lite coordinator skill marks a server-read-only, no-chain context.
const LITE_SKILL_FILE = "skill-coordinator-lite.md";
function isRagCapable(s) {
    return (typeof s === "object" && s !== null &&
        "queryPrdSpec" in s && typeof s.queryPrdSpec === "function");
}
// Lazy reindex requires the two additional GC/index methods. Test fixtures
// that mock only `queryPrdSpec` skip the reindex path (legacy behaviour).
function canLazyReindex(s) {
    const rec = s;
    return (typeof rec.getPrdIndexMeta === "function" &&
        typeof rec.upsertPrdChunks === "function");
}
// Coordinator does triage; doesn't need PRD chunks. Skip injection there.
// Lite mode is solo-dev direct-execute; also skip.
const RAG_SKIP_ROLES = new Set(["teamwork", "teamwork-lite"]);
// Auto-discover fallback order when state.prd_path is absent.
// Order matters: PRD.md at root is the most common convention; docs/ and
// specs/ are alternates for repos that segregate documentation.
const PRD_AUTO_DISCOVER_PATHS = ["PRD.md", "docs/PRD.md", "specs/PRD.md"];
export function resolvePrdPath(workspacePath, state) {
    // Prefer explicit state.prd_path; validate it still exists on disk.
    if (state?.prd_path && fs.existsSync(state.prd_path)) {
        return state.prd_path;
    }
    for (const rel of PRD_AUTO_DISCOVER_PATHS) {
        const candidate = path.join(workspacePath, rel);
        if (fs.existsSync(candidate))
            return candidate;
    }
    return null;
}
// Lazy reindex helper. Returns true on success (or no-op when index is
// already current), false on failure (caller degrades to no spec injection).
async function ensureIndexFresh(storage, workspacePath, prdPath) {
    let currentMtime;
    try {
        currentMtime = Math.floor(fs.statSync(prdPath).mtimeMs);
    }
    catch {
        return false;
    }
    const meta = storage.getPrdIndexMeta(workspacePath);
    if (meta &&
        meta.prd_mtime === currentMtime &&
        meta.chunker_version === CHUNKER_VERSION &&
        meta.embedding_model === DEFAULT_EMBEDDING_MODEL) {
        return true;
    }
    // Coalesce with any concurrent tw_index_prd / appendSpecContext run for the
    // same (workspace, prd_path) tuple.
    const inflightKey = getInflightKey(workspacePath, prdPath);
    const existing = getInflight(inflightKey);
    if (existing) {
        try {
            await existing;
        }
        catch {
            return false;
        }
        return true;
    }
    const run = (async () => {
        const result = await buildPrdChunks(prdPath, DEFAULT_EMBEDDING_MODEL);
        if ("error" in result)
            throw new Error(result.error);
        storage.upsertPrdChunks(workspacePath, result);
        return "ok";
    })();
    setInflight(inflightKey, run);
    try {
        await run;
        return true;
    }
    catch {
        return false;
    }
    finally {
        deleteInflight(inflightKey);
    }
}
export async function appendSpecContext(result, workspacePath, role) {
    if (role && RAG_SKIP_ROLES.has(role))
        return result;
    const storage = getActiveStorage();
    if (!isRagCapable(storage))
        return result;
    const state = storage.parse(workspacePath);
    if (!state)
        return result;
    // Resolve PRD path. State takes precedence; otherwise auto-discover.
    // Only attempt lazy reindex when the storage has the required GC/index
    // hooks (production SQLite path) — test fixtures with a bare mock skip it.
    if (canLazyReindex(storage)) {
        const prdPath = resolvePrdPath(workspacePath, state);
        if (prdPath) {
            // Lazy reindex when invalidation key is stale or missing. Failures
            // degrade silently — the prompt is still useful without spec context.
            try {
                const ok = await ensureIndexFresh(storage, workspacePath, prdPath);
                if (!ok)
                    return result;
            }
            catch {
                return result;
            }
        }
    }
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
    const rawConstitution = loadContent("constitution.md", workspacePath);
    // Lite contexts (teamwork-lite) get the chain-only sections stripped; chain
    // roles keep the full constitution because those rules become load-bearing.
    const constitution = skillFile === LITE_SKILL_FILE ? stripChainOnly(rawConstitution) : rawConstitution;
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