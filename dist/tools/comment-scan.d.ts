export declare const commentLimits: Readonly<{
    readonly maxBlockLines: 7;
    readonly maxRatioPercent: 30;
    readonly minRatioLines: 50;
    readonly maxListed: 50;
    readonly maxContentBytes: 1048576;
    readonly binarySniffBytes: 8192;
}>;
export type LineKind = "blank" | "code" | "comment";
export interface LexedLine {
    kind: LineKind;
    body: string;
    delimiterOnly: boolean;
}
export interface CommentBlock {
    start: number;
    end: number;
    counted: number;
}
export interface FileAnalysis {
    lines: LexedLine[];
    nonBlank: number;
    commentLines: number;
    blocks: CommentBlock[];
}
export type AddedLines = ReadonlySet<number> | "all";
export type Finding = {
    kind: "long-block";
    path: string;
    line: number;
    lines: number;
} | {
    kind: "high-ratio";
    path: string;
    pct: string;
    nonBlank: number;
};
export interface CommentScanOptions {
    write?: (line: string) => void;
}
export declare const commentCopy: Readonly<{
    block: (p: string, line: number, n: number) => string;
    ratio: (p: string, pct: string, n: number) => string;
    more: (n: number) => string;
    summary: (n: number, m: number) => string;
    error: (why: string) => string;
    whyLoad: "cannot load dist/tools/comment-scan.js — run `npm run build`";
    whyUnexpected: "unexpected error";
}>;
export declare function lexLines(text: string): LexedLine[];
export declare function analyzeText(text: string): FileAnalysis;
export declare function formatPct(comment: number, nonBlank: number): string;
export declare function findingsForFile(p: string, a: FileAnalysis, added: AddedLines): Finding[];
export declare function unquoteGitPath(s: string): string;
export declare function parseAddedLines(patch: string): Map<string, Set<number>>;
export declare function isScannablePath(rel: string): boolean;
export declare function formatFindings(f: Finding[]): string[];
export declare function resolveBase(cwd: string): string | null;
export declare function collectAdded(cwd: string, base: string): Map<string, AddedLines>;
export declare function readScannable(cwd: string, rel: string): string | null;
export declare function runCommentScan(cwd: string, opts?: CommentScanOptions): Finding[] | null;
//# sourceMappingURL=comment-scan.d.ts.map