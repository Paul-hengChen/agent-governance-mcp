// Coded by @sr-engineer
// Shared prompt-builder: every role prompt is constitution + skill + state.
// Each prompts/<role>.ts is a thin wrapper around buildPromptForRole().
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getActiveStorage } from "../tools/storage.js";
import { buildPrdChunks, CHUNKER_VERSION, DEFAULT_EMBEDDING_MODEL, } from "../tools/rag.js";
import { getInflightKey, getInflight, setInflight, deleteInflight, } from "../tools/rag-coalesce.js";
import { parseSkillFile } from "../tools/skill-frontmatter.js";
import { hasDesignModeRequiringVisual } from "../tools/evidence-file.js";
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
// Remove every <!-- rationale:start --> … <!-- rationale:end --> block (markers
// inclusive) and collapse blank lines left behind. Idempotent; text with no
// markers is returned unchanged (full-detail safety default). Rationale blocks
// carry only "why" prose (war-story / Reason: paragraphs) that onboards humans
// and forms audit trail — never a rule a role acts on — so stripping them for
// chain-role dispatch trims per-dispatch budget without dropping enforcement.
// Single-copy by design (see governance-text-load-architecture DR-2, v3.31.0):
// only buildPromptForRole calls it; NOT duplicated in the hook or measure script
// as a load-bearing copy, so DR-3's 3-copy parity rule does not apply here.
export function stripRationale(text) {
    return text
        .replace(/<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->\n?/g, "")
        .replace(/[ \t]+\n/g, "\n") // trim trailing spaces left by an inline strip
        .replace(/\n{3,}/g, "\n\n");
}
// Remove every <!-- design-only:start --> … <!-- design-only:end --> block
// (markers inclusive) and collapse the blank lines left behind. Idempotent;
// text with no markers is returned unchanged (full-constitution safety default).
// Design-only spans (constitution §3.2 minus R10, plus the §3.1 visual evidence /
// report-schema / visual_round bullets) are FEATURE-INERT: on a non-design feature
// (no `design/<feature>.md`, or its `## Mode` = no-design) the server-side visual
// gates self-disarm, so this visual governance binds no role — stripping it trims
// the per-dispatch budget without dropping a rule any role could act on. Gated on
// the SAME arm signal the server uses (hasDesignModeRequiringVisual), so the text is
// present exactly when the gate can fire (HC3). DISTINCT marker from chain-only /
// rationale so the non-greedy regexes never cross (HC5); the design-only fences are
// nested inside chain-only (§3.1/§3.2 sit between its markers) — disjoint, nest-safe.
export function stripDesignOnly(text) {
    return text
        .replace(/<!-- design-only:start -->[\s\S]*?<!-- design-only:end -->\n?/g, "")
        .replace(/\n{3,}/g, "\n\n");
}
// Remove every <!-- origin:start --> … <!-- origin:end --> span (markers
// inclusive) and clean up whitespace left behind. Idempotent; text with no
// markers is returned unchanged (safety default). Origin spans carry only
// maintainer provenance — version stamps ("(v3.26.0)"), backlog/finding codes
// ("(R10)", "A1"), retrospective pointers — never a rule any role acts on, so
// stripping them trims per-dispatch budget at EVERY detail level: applied
// unconditionally in buildPromptForRole, FIRST, before the three conditional
// strips (no fullDetail / lite / design-arm gate). Unlike the block-level
// fences above, origin fences are INLINE (mid-sentence / end-of-heading), so
// the regex deliberately does NOT consume a trailing newline — doing so would
// join a fenced heading with the line below it. Origin fences never straddle
// a chain-only / rationale / design-only boundary (they may nest inside one),
// so the four strippers compose order-independently. Single-copy by design
// (governance-text-load-architecture DR-2, same as stripRationale /
// stripDesignOnly): only buildPromptForRole calls it; NOT duplicated into
// bin/agent-governance-context.mjs, so DR-3's parity rule does not apply.
export function stripOriginTags(text) {
    return text
        .replace(/<!-- origin:start -->[\s\S]*?<!-- origin:end -->/g, "")
        .replace(/[ \t]+\n/g, "\n") // trim trailing spaces left by an inline strip
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
export function buildPromptForRole(skillFile, description, workspacePath, fullDetail = false) {
    // Read handoff state BEFORE constitution resolution: the design-only axis is the
    // first state-dependent strip (the chain-only / rationale axes are static-arg-driven),
    // so `active_feature` must be known to probe the design arm below. Reused for the
    // state block at the end of this function. Try/catch preserved — a parse failure
    // degrades to "no state" (and, per AC3, to the non-design strip default).
    let state = null;
    try {
        state = getActiveStorage().parse(workspacePath);
    }
    catch {
        // fall through to "no state" block (and non-design strip default)
    }
    // Design-arm probe (NET-NEW I/O). Strip the design-only span unless the feature is
    // design-armed. AGREES WITH the server-side visual gate by construction: it calls the
    // SAME helper (hasDesignModeRequiringVisual) the PASS-time visual gate uses, so the
    // text is present exactly when those gates can fire (HC3). Safe default (AC3): no
    // state / no active_feature → required=false → strip, which is provably safe because
    // no design ⇒ no visual binding. Never throws (the helper swallows fs errors).
    const isDesignFeature = state?.active_feature
        ? hasDesignModeRequiringVisual(workspacePath, state.active_feature).required
        : false;
    // Origin-tag strip is FIRST and unconditional on both raw inputs (constitution
    // here, skill body below): provenance tags are pure archaeology at every detail
    // level, so no fullDetail / lite / design-arm gate applies (governance-tag-strip
    // AC4). The remaining strips compose order-independently with it.
    const rawConstitution = stripOriginTags(loadContent("constitution.md", workspacePath));
    // Lite contexts (teamwork-lite) get the chain-only sections stripped; chain
    // roles keep the full constitution because those rules become load-bearing.
    const chainResolved = skillFile === LITE_SKILL_FILE ? stripChainOnly(rawConstitution) : rawConstitution;
    // v3.31.0 (T-GTL-07): the §1/§7 rationale fences wrap explanatory example-lists,
    // not rules, so strip them for non-full-detail dispatch — same fullDetail flag as
    // the skill body. Composes after stripChainOnly: order-independent (DR-9), the
    // fences are disjoint regions (chain-only wraps §3.1+§4; rationale fences sit in
    // §1/§7), so neither non-greedy regex crosses the other's markers.
    const rationaleResolved = fullDetail ? chainResolved : stripRationale(chainResolved);
    // Design-only axis (constitution-conditional-load): strip §3.2 (minus R10) + the
    // §3.1 visual bullets on non-design features. Composes order-independently with the
    // other two strips — the design-only fences are DISJOINT from rationale fences and
    // NESTED inside chain-only, so the non-greedy regexes never cross markers (HC5).
    const constitution = isDesignFeature ? rationaleResolved : stripDesignOnly(rationaleResolved);
    const rawSkill = loadContent(skillFile, workspacePath);
    const { frontmatter, body: taggedBody } = parseSkillFile(rawSkill);
    // Same unconditional origin-tag strip as the constitution above (frontmatter
    // is parsed off first — origin fences live in body prose, never in YAML).
    const rawBody = stripOriginTags(taggedBody);
    // Chain-role skill dispatch strips verbose rationale unless fullDetail is set
    // (DR-5, v3.31.0). Default false = strip on every buildPromptForRole dispatch,
    // including the full teamwork coordinator — lossless because the fences hold no
    // rule text (no-marker passthrough on un-fenced files). The constitution is
    // ALSO rationale-stripped above (T-GTL-07), gated on the same fullDetail flag.
    const skill = fullDetail ? rawBody : stripRationale(rawBody);
    const stateBlock = state
        ? `## 📍 Current Project State (Auto-injected)\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``
        : `## 📍 Current Project State\nNo handoff state found. Fresh project — call \`tw_get_state\` to initialize.`;
    const modelHint = frontmatter.recommended_model
        ? `\n\nRecommended model for this role: ${frontmatter.recommended_model}.`
        : "";
    const prompt = `${constitution}\n\n---\n\n${skill}${modelHint}\n\n---\n\n${stateBlock}`;
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