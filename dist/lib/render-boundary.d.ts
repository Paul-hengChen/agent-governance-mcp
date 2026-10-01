export interface DataBlockSpec {
    /** Heading line rendered first (authored text, not data). */
    heading: string;
    /** Optional framing sentence between the heading and the label. */
    notice?: string;
    /** The data-boundary label rendered directly ahead of the fence. */
    label: string;
    /** The reported data rendered inside the fence, byte-for-byte. */
    body: string;
    /** The fence info string (e.g. "json", "markdown", "text"). */
    lang: string;
}
/** CommonMark's minimum fence length. */
export declare const MIN_FENCE_LENGTH = 3;
/** Length of the longest run of consecutive backticks in `text` (0 if none). */
export declare function longestBacktickRun(text: string): number;
/** The fence for `body`: max(3, longest backtick run + 1) backticks. */
export declare function fenceFor(body: string): string;
/**
 * Render `heading`, the optional `notice`, `label`, then `body` inside an
 * unclosable adaptive fence, one per line: `<heading>`, `<notice>` (only when
 * given), `<label>`, `<fence><lang>`, `<body>`, `<fence>`.
 */
export declare function renderDataBlock(spec: DataBlockSpec): string;
//# sourceMappingURL=render-boundary.d.ts.map