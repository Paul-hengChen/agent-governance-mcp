// Coded by @qa-engineer
// Tests for spec: specs/subagent-watermark-parent-validation.md
//
// Spec-to-Test map:
//   AC3 (validateWatermark contract)   -> t-present-correct, t-absent-appends,
//                                         t-hyphen-treated-absent,
//                                         t-wrong-name-treated-absent,
//                                         t-wrong-tier-treated-absent,
//                                         t-whitespace-tolerant,
//                                         t-empty-reply,
//                                         t-idempotent
//   AC5 (required fixture coverage)    -> same tests (fixture set is a subset)
//   AC6 (no regressions, pure fn)      -> t-no-io-imports, t-buildWatermark-format
//
// WHY: validateWatermark is the single point of truth for watermark compliance
// in the parent coordinator. These fixtures encode the behavioral contract
// (Decision 2 + Decision 3 in the spec) so that any future refactor of the
// regex, the correction strategy, or the name/tier matching logic cannot
// silently regress. The "idempotency" fixture is particularly load-bearing:
// it proves the parent cannot double-append by calling the util twice.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const { validateWatermark, buildWatermark, WATERMARK_REGEX } = await import(
  path.join(ROOT, "dist", "lib", "watermark-check.js")
);

// ---------------------------------------------------------------------------
// AC5 fixture 1 — watermark present, correct name + tier → present:true,
//                 corrected unchanged.
// WHY: the happy path — subagent already emitted the watermark correctly;
//      the parent must relay the reply verbatim without appending anything.
// ---------------------------------------------------------------------------

test("t-present-correct: correct watermark → present:true, corrected unchanged", () => {
  const reply = "Here is the answer.\n\n— @lite (haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, true, "present must be true");
  assert.equal(result.corrected, reply, "corrected must equal original reply");
});

// ---------------------------------------------------------------------------
// AC5 fixture 2 — watermark absent entirely → present:false, corrected appends suffix.
// WHY: the primary correction case; parent appends the canonical suffix so the
//      user always sees a compliant watermark regardless of haiku attention drift.
// ---------------------------------------------------------------------------

test("t-absent-appends: missing watermark → present:false, corrected ends with suffix", () => {
  const reply = "Sure, I can help with that.";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false, "present must be false");
  assert.equal(
    result.corrected,
    reply + "\n— @lite (haiku)",
    "corrected must be reply + newline + watermark",
  );
  assert.ok(
    result.corrected.endsWith("\n— @lite (haiku)"),
    "corrected must end with the canonical watermark suffix",
  );
});

// ---------------------------------------------------------------------------
// AC5 / Decision 3 — hyphen-minus instead of EM DASH treated as absent.
// WHY: the spec mandates U+2014 (EM DASH) as the required leading character;
//      a hyphen-minus impersonator must not pass the gate — it would silently
//      accept a malformed watermark and prevent correct suffix injection.
// ---------------------------------------------------------------------------

test("t-hyphen-treated-absent: hyphen-minus instead of em-dash → present:false", () => {
  const reply = "My reply.\n- @lite (haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false, "hyphen-minus watermark must be treated as absent");
  assert.ok(
    result.corrected.endsWith("\n— @lite (haiku)"),
    "corrected must append the correct em-dash watermark",
  );
});

// ---------------------------------------------------------------------------
// AC5 fixture 3 — watermark present but wrong name → present:false.
// WHY: Decision 3 final bullet: a reply ending `— @wrong-name (haiku)` while
//      dispatched as `@lite` must be treated as absent — the coordinator must
//      not relay a watermark attributing the reply to a different subagent.
// ---------------------------------------------------------------------------

test("t-wrong-name-treated-absent: wrong name in watermark → present:false", () => {
  const reply = "Done.\n— @sr-engineer (haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false, "mismatched name must be treated as absent");
  assert.ok(
    result.corrected.endsWith("\n— @lite (haiku)"),
    "corrected must append the watermark with the dispatched name",
  );
});

// ---------------------------------------------------------------------------
// Wrong tier — mirror of wrong-name, for tier token.
// WHY: the spec requires both <name> AND <tier> to match; testing only one
//      leaves the other unchecked. A haiku reply claiming to be sonnet-tier
//      would survive an incomplete check.
// ---------------------------------------------------------------------------

test("t-wrong-tier-treated-absent: wrong tier in watermark → present:false", () => {
  const reply = "Done.\n— @lite (sonnet)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false, "mismatched tier must be treated as absent");
  assert.ok(
    result.corrected.endsWith("\n— @lite (haiku)"),
    "corrected must append the watermark with the dispatched tier",
  );
});

// ---------------------------------------------------------------------------
// AC5 fixture 4 — whitespace on last line → treated as present.
// WHY: haiku sometimes emits trailing spaces or a trailing newline after the
//      watermark. Failing on whitespace noise would cause double-appending
//      on every reply even when the watermark is structurally correct.
// ---------------------------------------------------------------------------

test("t-whitespace-tolerant: trailing/leading whitespace on last line → present:true", () => {
  const reply = "Done.\n  — @lite (haiku)  ";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, true, "whitespace around watermark line must be tolerated");
  assert.equal(result.corrected, reply, "corrected must equal original reply");
});

test("t-whitespace-trailing-newline: trailing blank lines after watermark → present:true", () => {
  const reply = "Done.\n— @lite (haiku)\n\n";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, true, "trailing blank lines must not break detection");
  assert.equal(result.corrected, reply, "corrected must equal original reply");
});

// ---------------------------------------------------------------------------
// AC5 fixture 5 — empty reply → corrected is just the watermark (no leading newline).
// WHY: an empty subagent reply must still produce a compliant relay; prepending
//      a newline to an empty string would create a visually broken output like
//      "\n— @lite (haiku)" with a spurious leading blank line.
// ---------------------------------------------------------------------------

test("t-empty-reply: empty string reply → present:false, corrected is just the watermark", () => {
  const result = validateWatermark("", "lite", "haiku");
  assert.equal(result.present, false, "empty reply must have present:false");
  assert.equal(
    result.corrected,
    "— @lite (haiku)",
    "corrected must be the watermark with no leading newline",
  );
});

test("t-whitespace-only-reply: whitespace-only reply → present:false, corrected is just the watermark", () => {
  const result = validateWatermark("   \n  \n  ", "lite", "haiku");
  assert.equal(result.present, false, "whitespace-only reply must have present:false");
  assert.equal(
    result.corrected,
    "— @lite (haiku)",
    "corrected must be the watermark with no leading newline",
  );
});

// ---------------------------------------------------------------------------
// T-C5C18-06 (AC-2, v3.58.0 C5b) — mismatched watermark is REPLACED, not
// double-stamped. Prior to C5b, the mismatched branch fell through to the
// same append-only path as "absent", producing TWO trailing watermark lines
// (the wrong one left in place + the correct one appended). These are the
// regression-guard tests: any reversion to append-only-on-mismatch fails here.
// ---------------------------------------------------------------------------

test("t-mismatch-no-double-stamp: wrong-name watermark is replaced, not appended alongside", () => {
  const reply = "Body text.\n— @wrong-name (haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false, "mismatched watermark must be reported as absent");
  assert.equal(
    result.corrected,
    "Body text.\n— @lite (haiku)",
    "the wrong trailing watermark line must be replaced by the canonical one, not left in place",
  );
  const occurrences = (result.corrected.match(/—\s@[\w-]+\s\([\w-]+\)/g) || []).length;
  assert.equal(occurrences, 1, "corrected must contain exactly one watermark line, never two");
});

test("t-mismatch-wrong-tier-no-double-stamp: wrong-tier watermark is replaced, not appended alongside", () => {
  const reply = "Body text.\n— @lite (sonnet)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false);
  assert.equal(result.corrected, "Body text.\n— @lite (haiku)");
  const occurrences = (result.corrected.match(/—\s@[\w-]+\s\([\w-]+\)/g) || []).length;
  assert.equal(occurrences, 1, "corrected must contain exactly one watermark line, never two");
});

test("t-mismatch-watermark-only-body: reply that IS only a wrong watermark line replaces cleanly", () => {
  // lastBreak === -1 edge case: no preceding body — the entire reply is the
  // (wrong) watermark line itself.
  const reply = "— @wrong-name (haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false);
  assert.equal(
    result.corrected,
    "— @lite (haiku)",
    "corrected must be just the canonical watermark — no leading newline, no leftover body",
  );
});

test("t-mismatch-crlf: CRLF body before a wrong watermark is preserved and normalized, no stray \\r", () => {
  const reply = "Body text.\r\n— @wrong-name (haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, false);
  assert.equal(
    result.corrected,
    "Body text.\n— @lite (haiku)",
    "CRLF body must be preserved (normalized to a trailing \\n) and the wrong watermark replaced",
  );
  assert.ok(!result.corrected.includes("\r"), "corrected must not retain a stray carriage return");
});

// ---------------------------------------------------------------------------
// T-C5C18-06 (AC-2) — idempotency of the mismatched (replace) branch
// specifically, as distinct from the existing t-idempotent test (which only
// exercises the absent branch). A correct→re-validate cycle on a
// mismatch-corrected reply must converge to present:true with exactly one
// watermark line, proving the parent cannot accumulate watermarks across
// retries when the subagent's own reply already carried a wrong one.
// ---------------------------------------------------------------------------

test("t-mismatch-idempotent: correcting a mismatched watermark twice converges, no double-append", () => {
  const original = "Body text.\n— @wrong-name (opus)";
  const pass1 = validateWatermark(original, "lite", "haiku");
  assert.equal(pass1.present, false, "first call: mismatched watermark reported as absent");
  assert.equal(pass1.corrected, "Body text.\n— @lite (haiku)");

  const pass2 = validateWatermark(pass1.corrected, "lite", "haiku");
  assert.equal(
    pass2.present,
    true,
    "second call on the corrected reply must see the canonical watermark as present",
  );
  assert.equal(
    pass2.corrected,
    pass1.corrected,
    "second pass must not further mutate the already-corrected reply",
  );
  const occurrences = (pass2.corrected.match(/—\s@[\w-]+\s\([\w-]+\)/g) || []).length;
  assert.equal(
    occurrences,
    1,
    "watermark must appear exactly once — never accumulate across repeated corrections",
  );
});

// ---------------------------------------------------------------------------
// Idempotency — validate → correct → validate again → present:true.
// WHY: the parent may call validateWatermark on a reply it has already
//      corrected (e.g. in a retry or logging path). A non-idempotent util
//      would double-append, producing `— @lite (haiku)\n— @lite (haiku)`.
//      This is one of the most critical invariants for production correctness.
// ---------------------------------------------------------------------------

test("t-idempotent: correct once then validate again → present:true, no double-append", () => {
  const original = "My answer.";
  const pass1 = validateWatermark(original, "lite", "haiku");
  assert.equal(pass1.present, false, "first call: present must be false (no watermark)");

  const pass2 = validateWatermark(pass1.corrected, "lite", "haiku");
  assert.equal(pass2.present, true, "second call: present must be true (watermark now present)");
  assert.equal(
    pass2.corrected,
    pass1.corrected,
    "second corrected must equal first corrected (no double-append)",
  );
  // Extra safety: exactly one occurrence of the watermark suffix.
  const occurrences = (pass2.corrected.match(/— @lite \(haiku\)/g) || []).length;
  assert.equal(occurrences, 1, "watermark must appear exactly once after idempotent correction");
});

// ---------------------------------------------------------------------------
// Case-insensitivity — spec mandates /i flag.
// WHY: haiku may capitalise "Haiku" or "LITE". A case-sensitive check would
//      wrongly treat a correctly formed but capitalised watermark as absent.
// ---------------------------------------------------------------------------

test("t-case-insensitive: uppercase tier in reply → present:true", () => {
  const reply = "Done.\n— @lite (Haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, true, "case-insensitive match must accept capitalised tier");
});

test("t-case-insensitive-name: uppercase name in reply → present:true", () => {
  const reply = "Done.\n— @LITE (haiku)";
  const result = validateWatermark(reply, "lite", "haiku");
  assert.equal(result.present, true, "case-insensitive match must accept capitalised name");
});

// ---------------------------------------------------------------------------
// buildWatermark format — ensures the suffix string uses EM DASH + space.
// WHY: the Copy/Strings table in the spec mandates the exact character sequence
//      U+2014 SPACE @<name> SPACE (<tier>). If buildWatermark drifts to a
//      hyphen-minus, the injected watermark itself would fail the regex on a
//      subsequent check — breaking idempotency.
// ---------------------------------------------------------------------------

test("t-buildWatermark-format: buildWatermark uses em-dash and correct format", () => {
  const w = buildWatermark("lite", "haiku");
  assert.equal(w, "— @lite (haiku)", "buildWatermark must use U+2014 em-dash");
  assert.ok(w.startsWith("—"), "first character must be U+2014 (EM DASH)");
  assert.ok(w.includes("@lite"), "must include @<name>");
  assert.ok(w.includes("(haiku)"), "must include (<tier>)");
});

// ---------------------------------------------------------------------------
// WATERMARK_REGEX — spot-check the exported regex constant matches the spec.
// WHY: the regex is documented verbatim in the spec Copy/Strings table.
//      If it is accidentally mutated (e.g. a hyphen-minus replaces the em-dash),
//      the entire detection chain silently breaks. Pinning the regex source
//      string makes that visible without having to read the compiled JS.
// ---------------------------------------------------------------------------

test("t-regex-spec: WATERMARK_REGEX matches spec-documented detection regex", () => {
  // Positive cases.
  assert.ok(WATERMARK_REGEX.test("— @lite (haiku)"), "must match standard watermark");
  assert.ok(WATERMARK_REGEX.test("— @qa-engineer (sonnet)"), "must match hyphenated name");
  assert.ok(WATERMARK_REGEX.test("— @sr-engineer (opus)"), "must match opus tier");
  // Negative cases.
  assert.ok(!WATERMARK_REGEX.test("- @lite (haiku)"), "hyphen-minus must not match");
  assert.ok(!WATERMARK_REGEX.test("– @lite (haiku)"), "en-dash must not match");
  assert.ok(!WATERMARK_REGEX.test("— @lite haiku"), "missing parens must not match");
  assert.ok(!WATERMARK_REGEX.test("— lite (haiku)"), "missing @ must not match");
  assert.ok(!WATERMARK_REGEX.test(""), "empty string must not match");
});

// ---------------------------------------------------------------------------
// AC6 — no I/O or external imports in the util (pure function guarantee).
// WHY: watermark-check.ts is declared NO I/O in its file header.
//      Confirming the compiled JS has no require('fs') or dynamic import
//      of I/O modules prevents accidental injection of side effects.
// ---------------------------------------------------------------------------

test("t-no-io-imports: dist/lib/watermark-check.js has no I/O module imports", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(path.join(ROOT, "dist", "lib", "watermark-check.js"), "utf-8");
  assert.ok(!src.includes('require("fs")'), 'must not require("fs")');
  assert.ok(!src.includes("require('fs')"), "must not require('fs')");
  assert.ok(!src.includes('require("node:fs")'), 'must not require("node:fs")');
  assert.ok(!src.includes("import("), "compiled output must not use dynamic import()");
});
