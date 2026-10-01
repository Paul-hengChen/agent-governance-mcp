/**
 * Detection regex for the watermark line: a leading U+2014 EM DASH (a hyphen
 * or en dash counts as absent), then `@<name>` and `(<tier>)`, each `[\w-]+`.
 * Case-insensitive to tolerate capitalisation drift; anchored to the whole
 * trimmed last non-empty line.
 */
export declare const WATERMARK_REGEX: RegExp;
/**
 * Build the canonical watermark suffix for a (name, tier) pair.
 *
 * Uses U+2014 EM DASH followed by a single ASCII space, then `@<name>`,
 * a space, and `(<tier>)`. Quoted verbatim from
 * `specs/subagent-watermark-parent-validation.md` → Copy/Strings table →
 * `watermark.correction.suffix`.
 */
export declare function buildWatermark(name: string, tier: string): string;
export interface WatermarkCheckResult {
    /** True iff the reply already ends with a watermark whose name+tier match. */
    present: boolean;
    /**
     * The reply text to relay to the user. Identical to the input when
     * `present` is true; otherwise the input with the canonical watermark
     * appended on a new line (or, for an empty input, just the watermark).
     */
    corrected: string;
}
/**
 * Check that `reply` ends with the watermark for `name` / `tier`: its last
 * non-empty trimmed line matches `WATERMARK_REGEX` with the expected name and
 * tier (case-insensitive). If so, `corrected` is `reply`; otherwise it ends
 * with exactly one canonical line (appended, replacing a mismatched line, or
 * alone for an empty reply). Pure and idempotent. Call it only when relaying a
 * `Task` / Agent tool reply (the out-of-scope guard, Decision 4 of the spec).
 */
export declare function validateWatermark(reply: string, name: string, tier: string): WatermarkCheckResult;
//# sourceMappingURL=watermark-check.d.ts.map