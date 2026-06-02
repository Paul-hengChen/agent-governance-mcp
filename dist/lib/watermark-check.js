// Subagent reply watermark post-validation (v3.22.0).
//
// Pure utility used by the coordinator and coordinator-lite SOPs to detect
// whether a subagent reply (relayed from a `Task` / Agent tool result) ends
// with the canonical `— @<name> (<tier>)` watermark mandated by
// `content/constitution.md` §1 (watermark). If the watermark is absent or
// mismatched, the parent appends the correct one to the relayed text before
// surfacing it to the user.
//
// This file has NO I/O and NO external imports — it is safe to import from
// any layer. See `specs/subagent-watermark-parent-validation.md` for the full
// design rationale (Decisions 1–6).
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
export const WATERMARK_REGEX = /^—\s@[\w-]+\s\([\w-]+\)$/i;
/**
 * Build the canonical watermark suffix for a (name, tier) pair.
 *
 * Uses U+2014 EM DASH followed by a single ASCII space, then `@<name>`,
 * a space, and `(<tier>)`. Quoted verbatim from
 * `specs/subagent-watermark-parent-validation.md` → Copy/Strings table →
 * `watermark.correction.suffix`.
 */
export function buildWatermark(name, tier) {
    return `— @${name} (${tier})`;
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
export function validateWatermark(reply, name, tier) {
    const watermark = buildWatermark(name, tier);
    // Split on any newline style, then find the last non-empty line after
    // trimming. Whitespace-only lines are treated as empty.
    const lines = reply.split(/\r?\n/);
    let lastNonEmpty = null;
    for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (trimmed.length > 0) {
            lastNonEmpty = trimmed;
            break;
        }
    }
    if (lastNonEmpty === null) {
        // Empty or whitespace-only reply — append watermark with no leading newline.
        return { present: false, corrected: watermark };
    }
    if (!WATERMARK_REGEX.test(lastNonEmpty)) {
        return { present: false, corrected: reply + "\n" + watermark };
    }
    // Pattern matched. Extract the captured `<name>` and `<tier>` tokens and
    // verify they match the expected values (case-insensitive). A mismatched
    // name (e.g. reply ends `— @wrong-name (haiku)` while dispatched as
    // `@lite`) is treated as absent — spec Decision 3 final bullet.
    const detailMatch = lastNonEmpty.match(/^—\s@([\w-]+)\s\(([\w-]+)\)$/i);
    if (!detailMatch) {
        // Defensive: should be unreachable because WATERMARK_REGEX matched.
        return { present: false, corrected: reply + "\n" + watermark };
    }
    const [, actualName, actualTier] = detailMatch;
    if (actualName.toLowerCase() !== name.toLowerCase() ||
        actualTier.toLowerCase() !== tier.toLowerCase()) {
        return { present: false, corrected: reply + "\n" + watermark };
    }
    return { present: true, corrected: reply };
}
//# sourceMappingURL=watermark-check.js.map