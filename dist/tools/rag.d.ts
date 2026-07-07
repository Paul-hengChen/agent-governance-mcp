import type { ToolResult, WorkspaceOnlyInput, IndexPrdInput } from "./registry.js";
export declare const CHUNKER_VERSION = "1.0";
export declare const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
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
interface RawChunk {
    section: string;
    text: string;
}
export declare function chunkMarkdown(text: string): RawChunk[];
export declare function cosineSim(a: number[], b: number[]): number;
export declare function embedText(text: string, model?: string): Promise<number[] | null>;
export declare function buildPrdChunks(prdPath: string, model?: string): Promise<PrdChunk[] | {
    error: string;
}>;
export declare function handleIndexPrd(parsed: IndexPrdInput): Promise<ToolResult>;
export declare function handleClearPrdChunks(args: WorkspaceOnlyInput): Promise<ToolResult>;
export {};
//# sourceMappingURL=rag.d.ts.map