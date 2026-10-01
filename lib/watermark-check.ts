// Subagent reply watermark post-validation (v3.22.0).
// The coordinator SOPs call it on a reply relayed from a `Task` / Agent tool
// result to check for the canonical `— @<name> (<tier>)` watermark that
// Constitution §1 requires: append it when absent, replace the trailing line
// when the name or tier is wrong. NO I/O and NO external imports, so any layer
// may import it. Design: specs/subagent-watermark-parent-validation.md;
// replace-on-mismatch: specs/c5-c18-watermark-configcache.md.

/**
 * Detection regex for the watermark line: a leading U+2014 EM DASH (a hyphen
 * or en dash counts as absent), then `@<name>` and `(<tier>)`, each `[\w-]+`.
 * Case-insensitive to tolerate capitalisation drift; anchored to the whole
 * trimmed last non-empty line.
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
export function buildWatermark(name: string, tier: string): string {
  return `— @${name} (${tier})`;
}

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
export function validateWatermark(
  reply: string,
  name: string,
  tier: string,
): WatermarkCheckResult {
  const watermark = buildWatermark(name, tier);

  // Split on any newline style, then find the last non-empty line after
  // trimming. Whitespace-only lines are treated as empty.
  const lines = reply.split(/\r?\n/);
  let lastNonEmpty: string | null = null;
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
  const detailMatch = lastNonEmpty.match(
    /^—\s@([\w-]+)\s\(([\w-]+)\)$/i,
  );
  if (!detailMatch) {
    // Defensive: should be unreachable because WATERMARK_REGEX matched.
    return { present: false, corrected: reply + "\n" + watermark };
  }
  const [, actualName, actualTier] = detailMatch;
  if (
    actualName.toLowerCase() !== name.toLowerCase() ||
    actualTier.toLowerCase() !== tier.toLowerCase()
  ) {
    // Mismatched watermark (present but wrong name/tier): REPLACE, don't
    // double-stamp (v3.58.0, C5b). Strip the wrong trailing watermark line
    // from the reply, then append the canonical one — so `corrected` carries
    // exactly one trailing watermark line.
    const trimmedEnd = reply.replace(/\s+$/, "");
    const lastBreak = Math.max(
      trimmedEnd.lastIndexOf("\n"),
      trimmedEnd.lastIndexOf("\r"),
    );
    const body =
      lastBreak === -1
        ? ""
        : trimmedEnd.slice(0, lastBreak).replace(/\s+$/, "");
    return {
      present: false,
      corrected: body.length > 0 ? body + "\n" + watermark : watermark,
    };
  }

  return { present: true, corrected: reply };
}
