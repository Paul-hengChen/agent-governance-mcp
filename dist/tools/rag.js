// Coded by @sr-engineer
// Pure RAG utilities: markdown chunking, local embedding via @xenova/transformers, cosine similarity.
// @xenova/transformers is an optional dep — all exports silently no-op when absent.
import * as fs from "node:fs";
export const CHUNKER_VERSION = "1.0";
export const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const MAX_CHUNK_CHARS = 2048; // ~512 tokens
const OVERLAP_CHARS = 200;
export function chunkMarkdown(text) {
    const results = [];
    const headerRe = /^(#{1,3} .+)$/gm;
    const positions = [];
    let m;
    while ((m = headerRe.exec(text)) !== null) {
        positions.push({ index: m.index, title: m[1].replace(/^#{1,3}\s+/, "").trim() });
    }
    if (positions.length === 0) {
        emitChunks(results, "document", text.trim());
        return results;
    }
    const pre = text.slice(0, positions[0].index).trim();
    if (pre)
        emitChunks(results, "preamble", pre);
    for (let i = 0; i < positions.length; i++) {
        const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
        emitChunks(results, positions[i].title, text.slice(positions[i].index, end).trim());
    }
    return results;
}
function emitChunks(out, section, body) {
    if (body.length <= MAX_CHUNK_CHARS) {
        out.push({ section, text: body });
        return;
    }
    const paragraphs = body.split(/\n{2,}/);
    let buffer = "";
    for (const para of paragraphs) {
        if (buffer.length + para.length + 2 > MAX_CHUNK_CHARS && buffer.length > 0) {
            out.push({ section, text: `### ${section}\n\n${buffer.trim()}` });
            buffer = buffer.slice(-OVERLAP_CHARS) + "\n\n" + para;
        }
        else {
            buffer = buffer ? buffer + "\n\n" + para : para;
        }
    }
    if (buffer.trim())
        out.push({ section, text: `### ${section}\n\n${buffer.trim()}` });
}
// ---- Embedding ----
export function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}
let _pipe = null;
let _pipeModel = null;
// Cached module-load promise — resolved exactly once (to module or to null).
// Prevents re-attempting import("@xenova/transformers") on every embedText call
// when the optional dep is absent.
let _modulePromise = null;
function loadXenova() {
    if (_modulePromise)
        return _modulePromise;
    _modulePromise = (async () => {
        try {
            // Dynamic import keeps @xenova/transformers strictly optional at runtime.
            // If users uninstall it, TS compilation may need a stub — see types/.
            const mod = await import("@xenova/transformers");
            return mod;
        }
        catch {
            return null;
        }
    })();
    return _modulePromise;
}
export async function embedText(text, model = DEFAULT_EMBEDDING_MODEL) {
    try {
        if (!_pipe || _pipeModel !== model) {
            const mod = await loadXenova();
            if (!mod)
                return null;
            const pipe = await mod.pipeline("feature-extraction", model, { quantized: true });
            _pipe = pipe;
            _pipeModel = model;
        }
        const pipe = _pipe;
        const out = await pipe(text, { pooling: "mean", normalize: true });
        return Array.from(out.data);
    }
    catch {
        return null;
    }
}
// ---- High-level: build chunks array from a PRD file ----
export async function buildPrdChunks(prdPath, model = DEFAULT_EMBEDDING_MODEL) {
    if (!fs.existsSync(prdPath))
        return { error: `PRD not found: ${prdPath}` };
    const text = fs.readFileSync(prdPath, "utf-8");
    const mtime = Math.floor(fs.statSync(prdPath).mtimeMs);
    const raws = chunkMarkdown(text);
    const chunks = [];
    for (let i = 0; i < raws.length; i++) {
        const embedding = await embedText(raws[i].text, model);
        if (!embedding)
            return { error: "@xenova/transformers not available — install it with: npm install @xenova/transformers" };
        chunks.push({
            chunk_id: `c${String(i).padStart(3, "0")}`,
            section: raws[i].section,
            text: raws[i].text,
            embedding,
            prd_path: prdPath,
            prd_mtime: mtime,
            chunker_version: CHUNKER_VERSION,
            embedding_model: model,
        });
    }
    return chunks;
}
//# sourceMappingURL=rag.js.map