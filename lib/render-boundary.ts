// Coded by @sr-engineer
// Render boundary: the one function that puts reported data (live handoff
// state, PRD RAG chunks) into prompt text, behind a label and inside a fence.
// Every render site calls renderDataBlock; none hand-builds a fence. The fence
// is one backtick longer than the body's longest backtick run (minimum 3), so
// no body line can close it. Deterministic and pure (no I/O, no imports), so
// any layer may import it. Threat model: specs/e137-render-sanitise.md.

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
export const MIN_FENCE_LENGTH = 3;

/** Length of the longest run of consecutive backticks in `text` (0 if none). */
export function longestBacktickRun(text: string): number {
  let longest = 0;
  let run = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 96 /* ` */) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  return longest;
}

/** The fence for `body`: max(3, longest backtick run + 1) backticks. */
export function fenceFor(body: string): string {
  return "`".repeat(Math.max(MIN_FENCE_LENGTH, longestBacktickRun(body) + 1));
}

// A backtick-fence info string must not contain a backtick (CommonMark), and a
// line break would end the opening-fence line early. Callers pass literals, so
// a bad value is a programming error: fail loud rather than emit a broken fence.
const INVALID_LANG_RE = /[`\r\n]/;

/**
 * Render `heading`, the optional `notice`, `label`, then `body` inside an
 * unclosable adaptive fence, one per line: `<heading>`, `<notice>` (only when
 * given), `<label>`, `<fence><lang>`, `<body>`, `<fence>`.
 */
export function renderDataBlock(spec: DataBlockSpec): string {
  if (INVALID_LANG_RE.test(spec.lang)) {
    throw new Error(
      `renderDataBlock: invalid fence info string ${JSON.stringify(spec.lang)} ` +
        `(must not contain a backtick or a line break)`,
    );
  }
  const fence = fenceFor(spec.body);
  const lines = [spec.heading];
  if (spec.notice !== undefined) lines.push(spec.notice);
  lines.push(spec.label, `${fence}${spec.lang}`, spec.body, fence);
  return lines.join("\n");
}
