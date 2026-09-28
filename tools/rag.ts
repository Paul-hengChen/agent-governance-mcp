// Coded by @sr-engineer
// Pure RAG utilities: markdown chunking, local embedding via @xenova/transformers, cosine similarity.
// @xenova/transformers is an optional dep — all exports silently no-op when absent.

import * as fs from "node:fs";
import { getActiveStorage } from "./storage.js";
import {
  getInflightKey,
  getInflight,
  setInflight,
  deleteInflight,
  awaitAllInflightFor,
} from "./rag-coalesce.js";
import type { ToolResult, WorkspaceOnlyInput, IndexPrdInput } from "./registry.js";

// Minimal local type shape for the optional @xenova/transformers dynamic import.
interface XenovaModule {
  pipeline(
    task: string,
    model: string,
    opts?: Record<string, unknown>,
  ): Promise<EmbedFn>;
}

export const CHUNKER_VERSION = "1.0";
export const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

export interface PrdChunk {
  chunk_id: string;
  section: string;
  text: string;
  embedding: number[];
  prd_path: string;
  prd_mtime: number;
  chunker_version: string;
  embedding_model: string;
}

export interface InvalidationKey {
  prd_mtime: number;
  chunker_version: string;
  embedding_model: string;
}

// ---- Chunking ----

interface RawChunk {
  section: string;
  text: string;
}

const MAX_CHUNK_CHARS = 2048; // ~512 tokens
const OVERLAP_CHARS = 200;

export function chunkMarkdown(text: string): RawChunk[] {
  const results: RawChunk[] = [];
  const headerRe = /^(#{1,3} .+)$/gm;
  const positions: Array<{ index: number; title: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    positions.push({ index: m.index, title: m[1].replace(/^#{1,3}\s+/, "").trim() });
  }

  if (positions.length === 0) {
    emitChunks(results, "document", text.trim());
    return results;
  }

  const pre = text.slice(0, positions[0].index).trim();
  if (pre) emitChunks(results, "preamble", pre);

  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    emitChunks(results, positions[i].title, text.slice(positions[i].index, end).trim());
  }

  return results;
}

function emitChunks(out: RawChunk[], section: string, body: string): void {
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
    } else {
      buffer = buffer ? buffer + "\n\n" + para : para;
    }
  }
  if (buffer.trim()) out.push({ section, text: `### ${section}\n\n${buffer.trim()}` });
}

// ---- Embedding ----

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

type EmbedFn = (text: string, opts: Record<string, unknown>) => Promise<{ data: Float32Array }>;
let _pipe: EmbedFn | null = null;
let _pipeModel: string | null = null;

// Cached module-load promise — resolved exactly once (to module or to null).
// Prevents re-attempting import("@xenova/transformers") on every embedText call
// when the optional dep is absent.
let _modulePromise: Promise<XenovaModule | null> | null = null;

function loadXenova(): Promise<XenovaModule | null> {
  if (_modulePromise) return _modulePromise;
  _modulePromise = (async () => {
    try {
      // Dynamic import keeps @xenova/transformers strictly optional at runtime.
      // If users uninstall it, TS compilation may need a stub — see types/.
      const mod = await import("@xenova/transformers");
      return mod as unknown as XenovaModule;
    } catch {
      return null;
    }
  })();
  return _modulePromise;
}

export async function embedText(text: string, model: string = DEFAULT_EMBEDDING_MODEL): Promise<number[] | null> {
  try {
    if (!_pipe || _pipeModel !== model) {
      const mod = await loadXenova();
      if (!mod) return null;
      const pipe = await mod.pipeline("feature-extraction", model, { quantized: true });
      _pipe = pipe;
      _pipeModel = model;
    }
    const pipe = _pipe as EmbedFn;
    const out = await pipe(text, { pooling: "mean", normalize: true });
    return Array.from(out.data);
  } catch {
    return null;
  }
}

// ---- High-level: build chunks array from a PRD file ----

export async function buildPrdChunks(
  prdPath: string,
  model: string = DEFAULT_EMBEDDING_MODEL,
): Promise<PrdChunk[] | { error: string }> {
  if (!fs.existsSync(prdPath)) return { error: `PRD not found: ${prdPath}` };
  const text = fs.readFileSync(prdPath, "utf-8");
  const mtime = Math.floor(fs.statSync(prdPath).mtimeMs);
  const raws = chunkMarkdown(text);
  const chunks: PrdChunk[] = [];
  for (let i = 0; i < raws.length; i++) {
    const embedding = await embedText(raws[i].text, model);
    if (!embedding) return { error: "@xenova/transformers not available — install it with: npm install @xenova/transformers" };
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

// ==========================================
// MCP tool handlers (registry-pattern) — verbatim relocations of the
// index.ts dispatcher cases for tw_index_prd and tw_clear_prd_chunks.
// args arrive pre-parsed by tools/registry.ts defineTool.run.
// ==========================================

export async function handleIndexPrd(parsed: IndexPrdInput): Promise<ToolResult> {
  const storage = getActiveStorage();
  if (!("upsertPrdChunks" in storage) || typeof (storage as Record<string, unknown>).upsertPrdChunks !== "function") {
    return { content: [{ type: "text" as const, text: "❌ tw_index_prd requires SQLite mode (--port flag). Not available in stdio/file mode." }], isError: true };
  }
  const model = parsed.embedding_model ?? DEFAULT_EMBEDDING_MODEL;
  const ragStorage = storage as unknown as {
    getPrdIndexMeta(wp: string): { prd_mtime: number; chunker_version: string; embedding_model: string } | null;
    upsertPrdChunks(wp: string, chunks: PrdChunk[]): void;
  };

  // Concurrency guard: coalesce duplicate in-flight indexings for the
  // same (workspace, prd_path). Without this, two parallel HTTP calls
  // both run the slow embedding pipeline and race on DELETE+INSERT.
  // The registry is also shared with prompts/build.ts:appendSpecContext
  // so its lazy reindex coalesces with explicit tw_index_prd calls.
  const inflightKey = getInflightKey(parsed.workspace_path, parsed.prd_path);
  const existing = getInflight(inflightKey);
  if (existing) {
    const text = await existing;
    return { content: [{ type: "text" as const, text }] };
  }

  const run = (async (): Promise<string> => {
    const currentMtime = fs.existsSync(parsed.prd_path)
      ? Math.floor(fs.statSync(parsed.prd_path).mtimeMs)
      : -1;
    const existingMeta = ragStorage.getPrdIndexMeta(parsed.workspace_path);
    if (
      existingMeta &&
      existingMeta.prd_mtime === currentMtime &&
      existingMeta.chunker_version === CHUNKER_VERSION &&
      existingMeta.embedding_model === model
    ) {
      return JSON.stringify({ upToDate: true, message: "Index is current — no reindex needed." });
    }
    const result = await buildPrdChunks(parsed.prd_path, model);
    if ("error" in result) {
      return `❌ ${result.error}`;
    }
    ragStorage.upsertPrdChunks(parsed.workspace_path, result);
    return JSON.stringify({ indexed: true, chunks: result.length, model, chunker_version: CHUNKER_VERSION });
  })();

  setInflight(inflightKey, run);
  try {
    const text = await run;
    return {
      content: [{ type: "text" as const, text }],
      ...(text.startsWith("❌") ? { isError: true } : {}),
    };
  } finally {
    deleteInflight(inflightKey);
  }
}

export async function handleClearPrdChunks(args: WorkspaceOnlyInput): Promise<ToolResult> {
  const { workspace_path } = args;
  const storage = getActiveStorage();
  if (
    !("deletePrdChunks" in storage) ||
    typeof (storage as Record<string, unknown>).deletePrdChunks !== "function"
  ) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          supported: false,
          message: "tw_clear_prd_chunks requires SQLite mode (--port flag). No chunks in file mode.",
        }),
      }],
    };
  }
  // Await any in-flight reindex for this workspace so DELETE cannot
  // race with a concurrent INSERT inside upsertPrdChunks.
  await awaitAllInflightFor(workspace_path);
  const ragStorage = storage as unknown as { deletePrdChunks(wp: string): number };
  const deleted = ragStorage.deletePrdChunks(workspace_path);
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ supported: true, cleared: true, deleted_rows: deleted }),
    }],
  };
}
