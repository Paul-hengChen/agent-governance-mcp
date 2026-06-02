/**
 * Detection regex for the watermark line.
 *
 * - Leading character MUST be U+2014 (EM DASH, `—`); a hyphen-minus (`-`) or
 *   en-dash (`–`) is treated as absent.
 * - `<name>` and `<tier>` each match `[\w-]+` (alphanumeric, underscore,
 *   hyphen) — covers `lite`, `qa-engineer`, `sr-engineer`, `haiku`, `sonnet`,
 *   `opus`, etc.
 * - Case-insensitive (`/i`) to tolerate haiku capitalisation drift.
 * - Anchored to start/end of the (trimmed) last non-empty line.
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
 * Inspect a subagent reply for the mandatory watermark suffix.
 *
 * Behavior (matches AC3 of the v3.22.0 spec):
 *
 * - Returns `{ present: true, corrected: reply }` when the last non-empty
 *   line of `reply` (after stripping leading/trailing whitespace from that
 *   line) matches `WATERMARK_REGEX` AND the matched `<name>` and `<tier>`
 *   equal the expected `name` / `tier` arguments (case-insensitive).
 * - Returns `{ present: false, corrected: reply + "\n" + buildWatermark(...) }`
 *   otherwise. The U+2014 EM DASH suffix uses the canonical form.
 * - For an empty / whitespace-only reply, `corrected` is just the watermark
 *   string (no leading newline) so the relay is not visually broken.
 *
 * This function is pure and idempotent — calling it twice on a corrected
 * reply yields `present: true` on the second call.
 *
 * Callers (the coordinator / coordinator-lite SOPs) MUST only invoke this
 * when relaying a reply received from a `Task` / Agent tool call. See
 * Decision 4 (out-of-scope guard) in the spec.
 */
export declare function validateWatermark(reply: string, name: string, tier: string): WatermarkCheckResult;
//# sourceMappingURL=watermark-check.d.ts.map