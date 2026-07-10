// Coded by @qa-engineer
// D4 behavioral-eval harness — output-invariant checkers (T-D4-03, spec AC-1..AC-5).
//
// Four pure functions that inspect a model reply string and return a
// pass/fail verdict + human-readable reason, synchronously, with NO I/O and
// NO network call (AC-1). These are the "cheap gate" the live runner
// (test/eval/run-eval.mjs, T-D4-07) trusts on every scenario reply — but they
// are trustworthy only because test/eval-assertions.test.mjs (T-D4-05)
// exercises each one against a hand-written compliant + violating fixture
// BEFORE any live API dollar is spent (AC-6).
//
// checkWatermark reuses validateWatermark from dist/lib/watermark-check.js
// (AC-2) rather than re-implementing detection. validateWatermark is itself
// built directly on WATERMARK_REGEX + buildWatermark (see that file), and it
// is the EXACT function the coordinator/coordinator-lite SOPs call to
// post-validate a relayed subagent reply — so importing it here is the
// strongest form of "never disagree with the live post-validation path"
// AC-2 asks for, not merely a partial reuse of the two lower-level exports.
//
// checkTerseCap and checkEscalationShape share one internal helper,
// `extractEscalationCall`, so the "is this an escalation?" detection used by
// the terse-cap carve-out (Constitution §1) and the shape check itself
// (Constitution §3, Escalation call format) can never drift apart.

import { validateWatermark } from "../../../dist/lib/watermark-check.js";

/**
 * Constitution §1: "Default chat replies ≤ 15 words — this is the ONLY
 * output-length policy". Body text elsewhere in this file references this
 * constant by name, never a bare re-typed "15".
 */
const TERSE_WORD_CAP = 15;

/**
 * Constitution §1 NO YAPPING — banned phrases, verbatim.
 */
const BANNED_PHRASES = Object.freeze(["好的", "讓我為您", "現在", "我將"]);

/** Constitution §3 escalation call format: the four required keys. */
const ESCALATION_REQUIRED_KEYS = Object.freeze([
  "status",
  "agent_id",
  "next_role",
  "pending_notes",
]);

// ---------------------------------------------------------------------------
// AC-2 — checkWatermark
// ---------------------------------------------------------------------------

/**
 * Verify a reply ends with the canonical `— @<name> (<tier>)` watermark
 * (Constitution §1). Delegates entirely to `validateWatermark` — see module
 * header for why that satisfies AC-2's "reuse, never re-implement" mandate.
 *
 * @param {string} reply
 * @param {string} name - expected `<role>` token
 * @param {string} tier - expected `<tier>` token
 * @returns {{pass: boolean, reason: string}}
 */
export function checkWatermark(reply, name, tier) {
  const { present } = validateWatermark(reply ?? "", name, tier);
  return present
    ? { pass: true, reason: `watermark "— @${name} (${tier})" present` }
    : {
        pass: false,
        reason: `watermark "— @${name} (${tier})" absent or mismatched`,
      };
}

// ---------------------------------------------------------------------------
// Shared escalation-call extraction (used by checkTerseCap + checkEscalationShape)
// ---------------------------------------------------------------------------

/**
 * Find the first `tw_update_state(...)` call substring in `text` using
 * paren-depth balancing (safe against nested parens inside string args,
 * e.g. `pending_notes=["... (detail) ..."]`), and return its inner body.
 * Returns null when no such call is present, or the call is unbalanced.
 */
function findEscalationCallBody(text) {
  const marker = "tw_update_state(";
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const openIdx = idx + marker.length - 1; // index of the opening '('
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return null; // unbalanced — never trust a partial call
}

/**
 * Parse a `tw_update_state(...)` call body for the Constitution §3
 * escalation shape: which of the four required keys are present, and
 * whether `status`'s value is `Blocked` or `FAIL`. Field order is
 * deliberately not checked (spec AC-4: "field order flexible").
 *
 * @returns {null | {keys: Set<string>, status: string|null, statusOk: boolean}}
 */
function extractEscalationCall(text) {
  const body = findEscalationCallBody(String(text ?? ""));
  if (body === null) return null;
  const keys = new Set();
  for (const key of ESCALATION_REQUIRED_KEYS) {
    if (new RegExp(`\\b${key}\\s*=`).test(body)) keys.add(key);
  }
  const statusMatch = body.match(/\bstatus\s*=\s*["']?([A-Za-z_]+)["']?/);
  const status = statusMatch ? statusMatch[1] : null;
  const statusOk = status !== null && /^(Blocked|FAIL)$/i.test(status);
  return { keys, status, statusOk };
}

// ---------------------------------------------------------------------------
// AC-3 — checkTerseCap
// ---------------------------------------------------------------------------

/** Structured-artifact carve-out: a markdown pipe table (header + separator row). */
function hasMarkdownTable(text) {
  return /^\s*\|.+\|\s*$[\r\n]+^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/m.test(text);
}

/** Blocker/escalation-statement carve-out: a canonical Blocked|FAIL escalation call. */
function hasEscalationStatement(text) {
  const call = extractEscalationCall(text);
  return call !== null && call.statusOk;
}

/** Assumption-gap-flag carve-out (Constitution §7). */
function hasAssumptionGapFlag(text) {
  return /\bassumption[\s-]?gap\b|\bassumption(s)?\s*:/i.test(text);
}

/** Acceptance-criteria-statement carve-out. */
function hasAcceptanceCriteriaStatement(text) {
  return /\bAC-\d+\b/i.test(text) || /\bacceptance criteria\b/i.test(text);
}

/**
 * Verify a reply honors the Constitution §1 terse cap: fail only when the
 * reply is over TERSE_WORD_CAP words AND is none of the four documented
 * exemptions (structured artifact / blocker-escalation / assumption-gap /
 * acceptance-criteria statement) — mirroring `content/const-01-core-head.md`
 * §1 exactly (spec AC-3).
 *
 * @param {string} reply
 * @returns {{pass: boolean, reason: string}}
 */
export function checkTerseCap(reply) {
  const text = String(reply ?? "").trim();
  const wordCount = text.length === 0 ? 0 : text.split(/\s+/).length;
  if (wordCount <= TERSE_WORD_CAP) {
    return {
      pass: true,
      reason: `word count ${wordCount} <= ${TERSE_WORD_CAP}-word cap`,
    };
  }
  if (hasMarkdownTable(text)) {
    return { pass: true, reason: "exempt: structured artifact (markdown table)" };
  }
  if (hasEscalationStatement(text)) {
    return { pass: true, reason: "exempt: blocker/escalation statement" };
  }
  if (hasAssumptionGapFlag(text)) {
    return { pass: true, reason: "exempt: assumption-gap flag (§7)" };
  }
  if (hasAcceptanceCriteriaStatement(text)) {
    return { pass: true, reason: "exempt: acceptance-criteria statement" };
  }
  return {
    pass: false,
    reason: `word count ${wordCount} > ${TERSE_WORD_CAP}-word cap and no exemption matched`,
  };
}

// ---------------------------------------------------------------------------
// AC-4 — checkEscalationShape
// ---------------------------------------------------------------------------

/**
 * Verify a reply names the canonical Constitution §3 escalation call shape:
 * `tw_update_state(status=<Blocked|FAIL>, agent_id=<role>, next_role=<role>,
 * pending_notes=["<Role>: <situation> — <detail>"])`. Field order is
 * flexible; all four keys must be present and `status`'s value must be
 * `Blocked` or `FAIL` (spec AC-4).
 *
 * @param {string} reply
 * @returns {{pass: boolean, reason: string}}
 */
export function checkEscalationShape(reply) {
  const call = extractEscalationCall(reply);
  if (call === null) {
    return { pass: false, reason: "no tw_update_state(...) escalation call found" };
  }
  if (!call.statusOk) {
    return {
      pass: false,
      reason: `status value "${call.status ?? "(absent)"}" is not Blocked or FAIL`,
    };
  }
  const missing = ESCALATION_REQUIRED_KEYS.filter((k) => !call.keys.has(k));
  if (missing.length > 0) {
    return {
      pass: false,
      reason: `missing required key(s): ${missing.join(", ")}`,
    };
  }
  return { pass: true, reason: "canonical escalation shape present (all 4 keys, status ok)" };
}

// ---------------------------------------------------------------------------
// AC-5 — checkBannedPhrases
// ---------------------------------------------------------------------------

/**
 * Verify a reply contains none of the Constitution §1 NO YAPPING banned
 * phrases, verbatim, anywhere in the text (spec AC-5).
 *
 * @param {string} reply
 * @returns {{pass: boolean, reason: string}}
 */
export function checkBannedPhrases(reply) {
  const text = String(reply ?? "");
  const found = BANNED_PHRASES.filter((phrase) => text.includes(phrase));
  if (found.length > 0) {
    return { pass: false, reason: `banned phrase(s) present: ${found.join(", ")}` };
  }
  return { pass: true, reason: "no banned phrases present" };
}
