export type HygieneCategory = "home-path" | "encoded-home-path" | "temp-path" | "design-file-key" | "credential" | "work-item-link" | "internal-host" | "keyword";
export declare const hygieneCategories: readonly HygieneCategory[];
export declare const limits: Readonly<{
    readonly maxListed: 50;
    readonly maxWalkFiles: 10000;
    readonly maxContentBytes: 1048576;
    readonly binarySniffBytes: 8192;
}>;
export declare const placeholderUsernames: ReadonlySet<string>;
export interface MatchSpan {
    category: HygieneCategory;
    start: number;
    end: number;
    placeholder: boolean;
}
export interface KeywordMatcher {
    readonly size: number;
    spans(text: string): Array<{
        start: number;
        end: number;
    }>;
    maskSpans(text: string): Array<{
        start: number;
        end: number;
    }>;
}
export interface LineVerdict {
    listed: HygieneCategory[];
    skipped: HygieneCategory[];
}
export interface Hit {
    path: string;
    line: number | null;
    category: HygieneCategory;
}
export type KeywordSource = {
    kind: "none";
} | {
    kind: "unreadable";
} | {
    kind: "refused";
} | {
    kind: "loaded";
    keywords: string[];
    dev: number;
    ino: number;
    tracked: boolean;
};
export interface ScanSet {
    paths: string[];
    mode: "git" | "walk";
    capped: boolean;
}
export interface ScanOutcome {
    source: KeywordSource["kind"];
    keywordFileTracked: boolean;
    walkCapped: boolean;
    hits: Hit[];
    skipped: number;
}
export interface HygieneScanOptions {
    env?: Record<string, string | undefined>;
    write?: (line: string) => void;
}
export declare function isPlaceholderSegment(seg: string): boolean;
export declare function findShapeMatches(text: string): MatchSpan[];
export declare function parseKeywordList(text: string): string[];
export declare function compileKeywordMatcher(keywords: readonly string[]): KeywordMatcher | null;
export declare function classifyLine(text: string, kw: KeywordMatcher | null): LineVerdict;
export declare function maskText(text: string, kw: KeywordMatcher | null): string;
export declare function escapeForDisplay(text: string): string;
export declare const hygieneCopy: Readonly<{
    hit: (p: string, line: number, category: HygieneCategory) => string;
    hitName: (p: string, category: HygieneCategory) => string;
    more: (n: number) => string;
    summary: (n: number, m: number) => string;
    skipped: (n: number) => string;
    kwNone: string;
    kwUnreadable: "agc check — hygiene: keyword list named by AGC_HYGIENE_KEYWORDS cannot be read — only built-in shape patterns ran";
    kwRefused: "agc check — hygiene: keyword list under .current/ refused (it may be tracked) — move it outside the repo; only built-in shape patterns ran";
    kwTracked: "agc check — hygiene: warning: the keyword list is a tracked file — move it outside the repo and untrack it";
    walkCapped: "agc check — hygiene: stopped after 10000 files (no git repo to list files) — results are partial";
    error: (message: string) => string;
}>;
export declare function formatReport(o: ScanOutcome, kw: KeywordMatcher | null): string[];
export declare function listScanSet(cwd: string): ScanSet;
export declare function resolveKeywordSource(cwd: string, env: Record<string, string | undefined>, inGit: boolean): KeywordSource;
export declare function scanWorkspace(cwd: string, set: ScanSet, source: KeywordSource, kw: KeywordMatcher | null): ScanOutcome;
export declare function runHygieneScan(cwd: string, opts?: HygieneScanOptions): ScanOutcome | null;
//# sourceMappingURL=hygiene-scan.d.ts.map