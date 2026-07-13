// Coded by @qa-engineer
// Tests for backlog E16 / T-EB-02 (option B, content-only): broadening the
// Amend-Resume Edge charter in content/const-08-chain-31-mid.md §3.1 so the
// resume_of-gated pm->{code-reviewer,qa-engineer} edge is ALSO the sanctioned
// door for a PM-sanctioned FRESH single-role judge dispatch on a test-only /
// evidence-only ticket — not only a mid-chain resume of a previously
// stranded role (the shape T-E15-01 actually used, disclosed honestly in
// qa_reports/review_T-E15-01.md as a narrower-than-literal fit). Plus the
// pointer-only note added to content/coord-03-core-fallback.md's Amend-Resume
// relay escalation row.
//
// Mirrors the T-E1-02/T-E1-03 skill-text pinning convention (see
// test/feature-lease.test.mjs S1-S6): these are pure grep/string-containment
// assertions against the shipped content files — no server code changed
// (T-EB-03 review independently confirmed tools/transitions.ts, gates/,
// index.ts are byte-identical via `git status`; that is a one-time fact
// about this diff, recorded in qa_reports/review_T-EB-04.md's AC Execution
// Log rather than re-encoded as a unit test here — a `git status --porcelain`
// assertion would trivially pass forever once this feature is committed,
// giving false confidence rather than a real regression guard. The actual
// lasting regression guard for "the edge still requires resume_of and only
// opens to the two judge roles" is the pre-existing C1-07 Amend-Resume Edge
// suite in test/qa-flow.test.mjs, confirmed green and unmodified below).
//
// Spec-to-test map (backlog E16 row + T-EB-02 ticket text):
//   charter broadens without narrowing (resume_of still required)   -> E16-01
//   "fresh dispatch, not only mid-chain resume" load-bearing phrase -> E16-02
//   same field / same trust mechanics as the pre-existing edge      -> E16-03
//   judge-roles-only (no edge opened to any build role)             -> E16-04
//   no-build-role-edge sentence (code-bearing flow can't skip judge) -> E16-05
//   coord-03 Amend-Resume relay row carries a pointer to §3.1        -> E16-06

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function readContentFile(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}

const CONST08 = readContentFile("const-08-chain-31-mid.md");
const COORD03 = readContentFile("coord-03-core-fallback.md");

// ---------------------------------------------------------------------------
// E16-01: the new charter clause is scoped inside the existing Amend-Resume
// Edge bullet (not a standalone rule) and does not remove/weaken the
// pre-existing "resume_of field required" mechanism it broadens.
// ---------------------------------------------------------------------------
test("E16-01: const-08 §3.1 Single-role judge dispatch charter is appended to the Amend-Resume Edge bullet, resume_of is still required", () => {
  assert.match(
    CONST08,
    /\*\*Amend-Resume Edge[\s\S]*?\*\*Single-role judge dispatch/,
    "the new charter clause must live inside the Amend-Resume Edge bullet, not a new top-level rule",
  );
  assert.match(
    CONST08,
    /\*\*Single-role judge dispatch[\s\S]*?Same field \(`resume_of` names the dispatched role\)/,
    "charter must pin that resume_of is the SAME field, still required, naming the dispatched role",
  );
  // The pre-existing mechanism paragraph (unchanged obligation) must still be
  // present verbatim — broadening must not have replaced it.
  assert.match(
    CONST08,
    /the write that crosses the edge must set the first-class `resume_of` handoff field to `code-reviewer` or `qa-engineer`/,
    "the original resume_of mechanism sentence must survive unweakened",
  );
});

// ---------------------------------------------------------------------------
// E16-02: the load-bearing "fresh dispatch, not only resume" phrase — this is
// the actual scope expansion; T-E15-01 needed a FRESH single-role dispatch,
// not a resume of a role stranded earlier in the SAME chain.
// ---------------------------------------------------------------------------
test("E16-02: const-08 §3.1 charter names a FRESH judge dispatch as sanctioned, not only a mid-chain resume", () => {
  assert.match(
    CONST08,
    /a PM-sanctioned FRESH dispatch of exactly one judge role \(`code-reviewer` or `qa-engineer`\) on a test-only \/ evidence-only ticket/,
    "charter must explicitly sanction a FRESH single-role judge dispatch on a test-only/evidence-only ticket",
  );
  assert.match(
    CONST08,
    /not only a mid-chain resume of a previously stranded role/,
    "charter must explicitly contrast the new door against the narrower pre-existing 'stranded role resume' shape",
  );
});

// ---------------------------------------------------------------------------
// E16-03: same trust mechanics as the pre-existing edge — attestation-based,
// server checks field<->target consistency only, not truthfulness.
// ---------------------------------------------------------------------------
test("E16-03: const-08 §3.1 charter carries the same attestation-only trust mechanics as the pre-existing edge", () => {
  assert.match(
    CONST08,
    /same trust mechanics \(whether the ticket is genuinely judge-only is the PM's honest attestation; the server still checks only field⟺target consistency\)/,
    "charter must state the trust boundary is unchanged: PM attestation, server checks field<->target shape only",
  );
});

// ---------------------------------------------------------------------------
// E16-04/E16-05: judge-roles-only — the field opens no edge to any build
// role, so a code-bearing forward flow can never use it to skip the judges.
// This is the "does not weaken" half of the review's "broadens without
// weakening" verdict — pin it explicitly so a future edit cannot silently
// widen the door to sr-engineer/architect.
// ---------------------------------------------------------------------------
test("E16-04: const-08 §3.1 charter states judge roles only — no edge opened to any build role", () => {
  assert.match(
    CONST08,
    /judge roles only: the field opens no edge to any build role/,
    "charter must explicitly restrict the broadened door to judge roles (code-reviewer/qa-engineer) only",
  );
});

test("E16-05: const-08 §3.1 charter's no-build-role-edge sentence forecloses a code-bearing flow from skipping code-reviewer/qa-engineer", () => {
  assert.match(
    CONST08,
    /so a code-bearing forward flow can never use it to skip code-reviewer or qa-engineer/,
    "charter must explicitly state a normal code-bearing flow can never use this door to bypass the judges",
  );
});

// ---------------------------------------------------------------------------
// E16-06: content/coord-03-core-fallback.md's Amend-Resume relay row gets a
// pointer-only addition to the new charter — no mechanism duplicated here
// (mechanism stays single-sourced in the constitution per the file's own
// stated convention).
// ---------------------------------------------------------------------------
test("E16-06: coord-03 Amend-Resume relay escalation row points to the Constitution §3.1 charter (pointer-only, no duplicated mechanism)", () => {
  assert.match(
    COORD03,
    /\*\*Amend-Resume relay\*\*/,
    "the Amend-Resume relay escalation row must still exist",
  );
  assert.match(
    COORD03,
    /The same edge also carries a PM-sanctioned fresh single-role judge dispatch on a test-only\/evidence-only ticket — charter: Constitution §3\.1/,
    "the relay row must carry the exact pointer sentence naming Constitution §3.1 as the charter's home",
  );
  // Pointer-only: the row must not re-derive the trust-mechanics prose that
  // lives in const-08 — that would duplicate (and risk drifting from) the
  // single source of truth.
  assert.ok(
    !COORD03.includes("field⟺target consistency"),
    "coord-03 must NOT duplicate the const-08 trust-mechanics sentence — pointer only, single-sourced in the constitution",
  );
});
