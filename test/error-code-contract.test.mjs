// Coded by @qa-engineer
// Tests for spec: gate-registry (A10 + A2 folded in), AC-5.
// Generative registry↔code↔doc parity test — supersedes the interim
// regex-scan guard (backlog A5 / T-ECCT-02). Now imports the real
// GATE_REGISTRY/ALL_GATE_CODES from the built gates/registry.ts (the single
// structured source of truth, spec AC-1) and asserts parity BY CONSTRUCTION:
// the registry's code set must equal the code-side shape-rule harvest, the
// doc-side backtick-token harvest must be a subset of the registry, every
// `documentedInProse` entry must appear in >=1 content/*.md, and each entry's
// internal fields (hintStatic non-empty, errorCode literally present in its
// producer file) must be self-consistent. This is the qualitative upgrade
// over A5 the architecture calls for (specs/gate-registry-architecture.md
// "What the parity check guarantees").
//
// DR-8 (architecture): TransitionRejection["error"] in tools/transitions.ts
// is a deliberately-NOT-registry-sourced 12-member union (5 emitted by
// validateTransition + 7 handler-side envelope-consistency codes it must
// carry for narrowing). Non-drift is enforced here, not by re-typing: assert
// the union stays byte-identical at 12 members AND is a subset of
// ALL_GATE_CODES.
//
// AC-7 (relaxed per architecture Test Impact): this file now intentionally
// depends on a built tree (imports dist/gates/registry.js) — the old
// "never import from dist/" invariant no longer holds, by design, because
// AC-5 requires importing the real registry. `npm test`'s prebuild step
// already guarantees dist/ exists before this file runs.
//
// Spec-to-Test map lives in qa_reports/review_A10-10.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const { GATE_REGISTRY, ALL_GATE_CODES } = await import(
  path.join(PROJECT_ROOT, "dist", "gates", "registry.js")
);

// c12-registry-field-consumers (T-C12-02/03): the three round-cap constants,
// imported so the QA_ROUND_EXCEEDED/REVIEW_ROUND_EXCEEDED/VISUAL_ROUND_EXCEEDED
// triggerEdge cap literals (">= 4", ">= 4", ">= 6") can be asserted against the
// LIVE transitions.ts constants rather than trusted as hand-copied prose.
// d2-server-brake-accounting (qa-owned re-baseline): HOP_CAP_EXPORTED joins the
// three round-cap constants above — HOP_CAP_EXCEEDED's triggerEdge carries the
// same ">= N" checkable cap literal, sourced from the live constant rather than
// hand-copied.
const { ROUND_CAP_EXPORTED, REVIEW_ROUND_CAP_EXPORTED, VISUAL_ROUND_CAP_EXPORTED, HOP_CAP_EXPORTED } = await import(
  path.join(PROJECT_ROOT, "dist", "tools", "transitions.js")
);

// ---------------------------------------------------------------------------
// Shape rule (spec: "Shape rule (used identically by both extraction sides)")
// ---------------------------------------------------------------------------

const TOKEN_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\b/g;
// b8-external-ref-ledger (qa-owned re-baseline): added UNRESOLVED. The new
// EXTERNAL_REFS_UNRESOLVED gate code introduces a novel suffix outside the
// prior vocabulary (spec S01 mandates the string verbatim; sr-engineer had no
// latitude to rename it) — code-reviewer flagged this as the QA-side fix,
// not a code rename. Without this, EXTERNAL_REFS_UNRESOLVED is invisible to
// BOTH extractCodeCodes and extractDocCodes (isGateErrorCode filters it out
// of both harvests identically), which would silently mask a missing-registry
// or missing-doc regression for this gate.
// c9-protocol-fields (DR-7, qa-owned re-baseline): added MISMATCH. The new
// REVIEW_VERDICT_STATUS_MISMATCH gate code introduces another novel suffix
// outside the prior vocabulary — exactly the b8 UNRESOLVED precedent. Without
// this, REVIEW_VERDICT_STATUS_MISMATCH is invisible to BOTH extraction sides
// identically, masking a missing-registry or missing-doc regression.
// e1-feature-scoped-state-design (qa-owned re-baseline, T-E1-05): added HELD.
// The new FEATURE_LEASE_HELD gate code introduces yet another novel suffix
// outside the prior vocabulary — the exact same b8/c9 precedent. Per
// code-reviewer's adjudication (review_reports/review_T-E1-04.md), this is
// the QA-side fix (widen the shape-rule vocabulary), NOT a rename of the
// spec-mandated code.
const SUFFIX_RE = /_(REQUIRED|MISSING|INCOMPLETE|EXCEEDED|UNVERIFIED|REJECTED|UNRESOLVED|MISMATCH|HELD)$/;
const PREFIX_RE = /^MISSING_/;

function isGateErrorCode(token) {
  return SUFFIX_RE.test(token) || PREFIX_RE.test(token);
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function listFiles(dir, ext) {
  return fs
    .readdirSync(path.join(PROJECT_ROOT, dir))
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(dir, f));
}

// Code-side source set: index.ts, tools/*.ts, schema/*.ts, guards/*.ts, and
// (architecture Test Impact: "the listFiles('tools','.ts') glob does NOT
// reach gates/, so add ...listFiles('gates','.ts')") gates/*.ts — the new
// registry + gate modules this feature introduced.
const CODE_SOURCE_FILES = [
  "index.ts",
  ...listFiles("tools", ".ts"),
  ...listFiles("schema", ".ts"),
  ...listFiles("guards", ".ts"),
  ...listFiles("gates", ".ts"),
];

// Doc-side source set: every file in content/*.md.
const DOC_SOURCE_FILES = listFiles("content", ".md");

function readSource(rel) {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), "utf-8");
}

function extractCodeCodes() {
  const codes = new Map(); // code -> Set(file)
  for (const rel of CODE_SOURCE_FILES) {
    const text = readSource(rel);
    const matches = text.match(TOKEN_RE) || [];
    for (const token of matches) {
      if (!isGateErrorCode(token)) continue;
      if (!codes.has(token)) codes.set(token, new Set());
      codes.get(token).add(rel);
    }
  }
  return codes;
}

// Doc side: backtick-delimited spans `TOKEN` whose inner text matches the
// shape rule. Matched directly (backtick, shape-rule token, backtick) rather
// than capturing arbitrary `([^`]+)` content and filtering afterwards —
// content/*.md contains fenced code blocks whose embedded literal backticks
// throw off naive open/close backtick pairing across the whole file, which
// would corrupt spans for everything downstream in the same file. Anchoring
// the token pattern between the backticks sidesteps that: it only ever
// matches when a shape-rule token is flanked by exactly one backtick on
// each side, regardless of unrelated backtick parity elsewhere in the file.
const BACKTICK_TOKEN_RE = /`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)`/g;

function extractDocCodes() {
  const codes = new Map(); // code -> Set(file)
  for (const rel of DOC_SOURCE_FILES) {
    const text = readSource(rel);
    let m;
    while ((m = BACKTICK_TOKEN_RE.exec(text))) {
      const inner = m[1];
      if (!isGateErrorCode(inner)) continue;
      if (!codes.has(inner)) codes.set(inner, new Set());
      codes.get(inner).add(rel);
    }
  }
  return codes;
}

function fmt(codeMap, codes) {
  return codes
    .map((c) => `${c} (${[...codeMap.get(c)].join(", ")})`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// AC-1 / AC-5: GATE_REGISTRY is the single source of truth, exactly 27
// entries (e4-design-source-credibility-gate, qa-owned re-baseline: added the
// 27th, SOURCE_CREDIBILITY_UNVERIFIED — the build-entry source-credibility
// attestation gate; 26 in, 27 out — one gate added, none dropped).
// e2-bugfix-repro-gate had added the 26th, REPRO_MANIFEST_MISSING — the
// bugfix-mode repro-first gate. e1-feature-scoped-state-design had added the
// 25th, FEATURE_LEASE_HELD. d9-qa-review-scoped-append had added the 24th,
// QA_REVIEW_TARGET_REQUIRED. d2-server-brake-accounting had added the 23rd,
// HOP_CAP_EXCEEDED. c16-c10-role-boundary had added the 22nd,
// REVIEWER_COMPLETED_TASKS_REJECTED. c15-expected-red-manifest had added the
// 21st, EXPECTED_RED_DIFF_MISSING. c9-protocol-fields had added the 20th,
// REVIEW_VERDICT_STATUS_MISMATCH.
// ---------------------------------------------------------------------------

test("AC-1/AC-5: GATE_REGISTRY has exactly 27 entries (26 in, 27 out — e4-design-source-credibility-gate added SOURCE_CREDIBILITY_UNVERIFIED)", () => {
  assert.equal(
    GATE_REGISTRY.length,
    27,
    `expected exactly 27 GateDefinition entries, got ${GATE_REGISTRY.length}: ${GATE_REGISTRY.map((g) => g.errorCode).join(", ")}`,
  );
  assert.equal(
    ALL_GATE_CODES.length,
    27,
    "ALL_GATE_CODES must be GATE_REGISTRY.map(g => g.errorCode) — same length",
  );
  assert.deepEqual(
    [...ALL_GATE_CODES],
    GATE_REGISTRY.map((g) => g.errorCode),
    "ALL_GATE_CODES must preserve GATE_REGISTRY's catalog order",
  );
});

// ---------------------------------------------------------------------------
// AC-5 (generative core): the registry's code set is BY CONSTRUCTION equal
// to the code-side shape-rule harvest over the real source tree — not a
// hand-maintained allowlist. A gate added to code without a registry entry,
// or vice versa, fails this test.
// ---------------------------------------------------------------------------

test("AC-5: ALL_GATE_CODES === code-side shape-rule harvest (registry <-> code source parity)", () => {
  const codeCodes = extractCodeCodes();
  const registrySet = new Set(ALL_GATE_CODES);
  const codeSet = new Set(codeCodes.keys());

  const registryOnly = [...registrySet].filter((c) => !codeSet.has(c));
  const codeOnly = [...codeSet].filter((c) => !registrySet.has(c));

  assert.deepEqual(
    registryOnly,
    [],
    `registry entries with no code-side token match: ${registryOnly.join(", ")}`,
  );
  assert.deepEqual(
    codeOnly,
    [],
    `code-side gate-shaped tokens with no registry entry: ${fmt(codeCodes, codeOnly)}`,
  );
});

// ---------------------------------------------------------------------------
// AC-3/AC-4 (doc <-> registry, replaces the old doc <-> code regex-scrape):
// doc-mentioned codes must all be real registry entries (no doc naming a
// phantom gate), and every documentedInProse registry entry must be
// backtick-quoted in >=1 content/*.md (no silently-undocumented gate).
// ---------------------------------------------------------------------------

test("doc ⊆ registry: every doc-mentioned gate error code exists in GATE_REGISTRY", () => {
  const docCodes = extractDocCodes();
  const registrySet = new Set(ALL_GATE_CODES);

  const orphaned = [...docCodes.keys()].filter((c) => !registrySet.has(c));

  assert.deepEqual(
    orphaned,
    [],
    `doc-only codes with no registry entry: ${fmt(docCodes, orphaned)}`,
  );
});

test("registry ⊆ doc: every documentedInProse:true entry is backtick-quoted in >=1 content/*.md", () => {
  const docCodes = extractDocCodes();

  const undocumented = GATE_REGISTRY.filter(
    (g) => g.documentedInProse && !docCodes.has(g.errorCode),
  ).map((g) => g.errorCode);

  assert.deepEqual(
    undocumented,
    [],
    `registry entries marked documentedInProse but not found backtick-quoted in content/*.md: ${undocumented.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// Internal consistency: hintStatic is non-empty, and — for the emit-site
// producers this ticket actually touched — the entry's errorCode string
// literally appears in its producer's source file. Anchors the "code side"
// to the typed registry instead of a blind regex scrape (the qualitative
// upgrade over A5 the architecture calls out).
// ---------------------------------------------------------------------------

test("internal consistency: every GATE_REGISTRY entry has a non-empty hintStatic", () => {
  const empty = GATE_REGISTRY.filter((g) => !g.hintStatic || g.hintStatic.length === 0).map(
    (g) => g.errorCode,
  );
  assert.deepEqual(empty, [], `entries with empty hintStatic: ${empty.join(", ")}`);
});

test("internal consistency: validateTransition-producer entries' errorCode literally appears in tools/transitions.ts", () => {
  const transitionsSrc = readSource(path.join("tools", "transitions.ts"));
  const missing = GATE_REGISTRY.filter((g) => g.producer === "validateTransition")
    .filter((g) => !transitionsSrc.includes(g.errorCode))
    .map((g) => g.errorCode);
  assert.deepEqual(
    missing,
    [],
    `validateTransition-producer codes not found literally in tools/transitions.ts: ${missing.join(", ")}`,
  );
});

test("internal consistency: orchestrator-producer entries' errorCode literally appears in tools/handoff-orchestrator.ts", () => {
  const orchestratorSrc = readSource(path.join("tools", "handoff-orchestrator.ts"));
  const missing = GATE_REGISTRY.filter((g) => g.producer === "orchestrator")
    .filter((g) => !orchestratorSrc.includes(g.errorCode))
    .map((g) => g.errorCode);
  assert.deepEqual(
    missing,
    [],
    `orchestrator-producer codes not found literally in tools/handoff-orchestrator.ts: ${missing.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// DR-8 (architecture Interface Contracts / Decision Records): the
// TransitionRejection["error"] union in tools/transitions.ts is deliberately
// NOT re-sourced from the registry (it carries 6 emitted + 8 handler-side
// envelope-consistency codes, not a clean by-producer subset — narrowing it
// would silently delete 8 documented members). Guard against drift the cheap
// way instead: pin the union at exactly 14 members and assert it is a subset
// of ALL_GATE_CODES.
// d2-server-brake-accounting (qa-owned re-baseline): HOP_CAP_EXCEEDED joins
// the union as a 6th validateTransition-EMITTED member (13 -> 14) — unlike
// EXTERNAL_REFS_UNRESOLVED (a handler-side-only addition), HOP_CAP_EXCEEDED
// is actually produced by validateTransition's hop-cap override (tools/
// transitions.ts precedence step 2.5), the same emit-site class as
// QA_ROUND_EXCEEDED/REVIEW_ROUND_EXCEEDED/VISUAL_ROUND_EXCEEDED. It IS added
// to TRANSITION_GATE_CODES (gates/registry.ts) for that reason.
// b8-external-ref-ledger (B8-08, DR-9): EXTERNAL_REFS_UNRESOLVED joins the
// union as an 8th handler-side-only member (12 -> 13), for the same three
// reasons CUT_APPROVAL_REQUIRED/SCOPE_DECISION_REQUIRED carry theirs: envelope
// narrowing at the emit site, the union-subset-of-ALL_GATE_CODES invariant
// below, and catalog completeness.
// e1-feature-scoped-state-design (T-E1-01, qa-owned re-baseline): FEATURE_
// LEASE_HELD joins the union as a 9th handler-side-only member (14 -> 15),
// same three reasons as EXTERNAL_REFS_UNRESOLVED immediately above (it too is
// an orchestrator-producer-only code, never emitted by validateTransition).
// e4-design-source-credibility-gate (DR-3, qa-owned re-baseline): SOURCE_
// CREDIBILITY_UNVERIFIED joins the union as a 10th handler-side-only member
// (15 -> 16), same three reasons as EXTERNAL_REFS_UNRESOLVED/FEATURE_LEASE_HELD
// above — an orchestrator-producer-only code (reads design/<feature>.md via
// fs), never emitted by validateTransition (which stays pure/fs-free).
// ---------------------------------------------------------------------------

test("DR-8: TransitionRejection[\"error\"] union stays byte-identical at 16 members, all ⊆ ALL_GATE_CODES", () => {
  const transitionsSrc = readSource(path.join("tools", "transitions.ts"));
  const unionMatch = transitionsSrc.match(
    /export interface TransitionRejection \{\s*error:\s*([\s\S]*?);\s*\n\s*attempted:/,
  );
  assert.ok(
    unionMatch,
    "could not locate the `error:` union inside `export interface TransitionRejection { ... attempted:` in tools/transitions.ts — DR-8 assertion is stale, update the anchor regex",
  );

  const members = [...unionMatch[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);

  assert.equal(
    members.length,
    16,
    `TransitionRejection["error"] must stay byte-identical at 16 members (DR-8, e4-design-source-credibility-gate re-baseline) — found ${members.length}: ${members.join(", ")}`,
  );
  assert.equal(
    new Set(members).size,
    16,
    "TransitionRejection[\"error\"] union members must be unique",
  );

  const registrySet = new Set(ALL_GATE_CODES);
  const notInRegistry = members.filter((m) => !registrySet.has(m));
  assert.deepEqual(
    notInRegistry,
    [],
    `TransitionRejection["error"] members not present in ALL_GATE_CODES: ${notInRegistry.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// AC-6: shape-rule precision — known noise tokens must NOT classify as codes.
// Unchanged from the interim A5 guard; still load-bearing (the shape rule is
// reused above for both the code-side and doc-side harvests).
// ---------------------------------------------------------------------------

test("AC-6: ALLOWED_TRANSITIONS is not classified as a gate error code (transition-matrix export name)", () => {
  assert.equal(isGateErrorCode("ALLOWED_TRANSITIONS"), false);
});

test("AC-6: REQUIRED_VISUAL_SECTIONS is not classified as a gate error code (constant name referenced in prose, not itself thrown)", () => {
  assert.equal(isGateErrorCode("REQUIRED_VISUAL_SECTIONS"), false);
});

test("AC-6: AGC_AUTO_ROUTE is not classified as a gate error code (routing-convention token never emitted in tools/*.ts or index.ts)", () => {
  assert.equal(isGateErrorCode("AGC_AUTO_ROUTE"), false);
});

test("AC-6: CHANGES_REQUESTED is not classified as a gate error code (code-reviewer verdict label, not a rejection code)", () => {
  assert.equal(isGateErrorCode("CHANGES_REQUESTED"), false);
});

// ---------------------------------------------------------------------------
// T-C9-11 / DR-7: explicit pin for the new gate, on top of the generic
// generative parity checks above — REVIEW_VERDICT_STATUS_MISMATCH must be a
// real registry entry AND backtick-quoted in at least one content/*.md file.
// ---------------------------------------------------------------------------

test("c9-protocol-fields: REVIEW_VERDICT_STATUS_MISMATCH is a GATE_REGISTRY entry, backtick-quoted in >=1 content/*.md", () => {
  assert.ok(
    ALL_GATE_CODES.includes("REVIEW_VERDICT_STATUS_MISMATCH"),
    "REVIEW_VERDICT_STATUS_MISMATCH must be registered in GATE_REGISTRY (AC-5)",
  );
  const docCodes = extractDocCodes();
  assert.ok(
    docCodes.has("REVIEW_VERDICT_STATUS_MISMATCH"),
    "REVIEW_VERDICT_STATUS_MISMATCH must be backtick-quoted in >=1 content/*.md (documentedInProse contract)",
  );
});

// ---------------------------------------------------------------------------
// AC-7 (relaxed, gate-registry era — architecture Test Impact, DR table):
// this test file now INTENTIONALLY depends on a built tree, because AC-5
// requires importing the real gates/registry.ts. The old "never import from
// dist/, stays valid against an unbuilt tree" invariant is superseded by the
// generative rewrite. This assertion pins the intentional dependency (so a
// future edit that reverts to source-text scanning under the same filename
// is a visible, deliberate choice rather than a silent regression) instead
// of forbidding it.
// ---------------------------------------------------------------------------

test("AC-7 (relaxed): this test file intentionally imports dist/gates/registry.js (requires a built tree; npm test's prebuild step guarantees it)", () => {
  const selfText = readSource(path.join("test", "error-code-contract.test.mjs"));
  assert.match(
    selfText,
    /from\s+["'].*dist\/gates\/registry\.js["']|import\(\s*path\.join\([\s\S]*?"dist",\s*"gates",\s*"registry\.js"/,
    "error-code-contract.test.mjs must import the built gates/registry.js — AC-5 requires the generative check to consume the real registry",
  );
});

// ===========================================================================
// c12-registry-field-consumers (T-C12-02/03): triggerEdge/armCondition/
// clearingArtifact — the three doc-facing GateDefinition fields A10 left
// unchecked — now get the same generative-parity treatment hintStatic
// already has (option (b) "assert" per specs/c12-registry-field-consumers.md;
// (a) render and (c) delete were rejected, see spec Rejected Alternatives).
// ===========================================================================

// ---------------------------------------------------------------------------
// AC1: non-empty bar on all three fields, all 22 entries — same shape as the
// existing "every GATE_REGISTRY entry has a non-empty hintStatic" test above.
// ---------------------------------------------------------------------------

test("AC1 (c12): every GATE_REGISTRY entry has non-empty triggerEdge/armCondition/clearingArtifact", () => {
  for (const field of ["triggerEdge", "armCondition", "clearingArtifact"]) {
    const empty = GATE_REGISTRY.filter((g) => !g[field] || g[field].length === 0).map((g) => g.errorCode);
    assert.deepEqual(empty, [], `entries with empty ${field}: ${empty.join(", ")}`);
  }
});

// ---------------------------------------------------------------------------
// AC2 checkable-literal extraction helpers. Three mechanically checkable
// literal shapes, per spec AC2 + the task breakdown: (1) a numeric round-cap
// ("prev_x_round >= N"), (2) a named predicate/function-call identifier
// (camelCase, e.g. hasDesignModeRequiringVisual), (3) an agent:status
// transition-edge pair (e.g. pm:In_Progress). A fourth, SCREAMING_SNAKE
// constant-name literal (ALLOWED_TRANSITIONS), is handled as its own pinned
// case below — it is a single occurrence, not a repeating shape worth a
// generic extractor.
// ---------------------------------------------------------------------------

const CAMEL_RE = /\b[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+\b/g;
function extractPredicateNames(text) {
  return [...new Set(text.match(CAMEL_RE) || [])];
}

const EDGE_RE =
  /\b(pm|architect|sr-engineer|qa-engineer|code-reviewer|release-engineer|doc-writer|researcher):(In_Progress|PASS|FAIL|Blocked)\b/g;
function extractEdgePairs(text) {
  return [...new Set([...text.matchAll(EDGE_RE)].map((m) => `${m[1]}:${m[2]}`))];
}

// ---------------------------------------------------------------------------
// AC2 (cap literals): QA_ROUND_EXCEEDED/REVIEW_ROUND_EXCEEDED/
// VISUAL_ROUND_EXCEEDED triggerEdge encodes the round cap as ">= N" — assert
// N matches the LIVE ROUND_CAP/REVIEW_ROUND_CAP/VISUAL_ROUND_CAP constants in
// tools/transitions.ts (4/4/6), not a hand-copied number that can drift
// silently if the cap is ever re-tuned.
// ---------------------------------------------------------------------------

const CAP_BY_CODE = {
  QA_ROUND_EXCEEDED: ROUND_CAP_EXPORTED,
  REVIEW_ROUND_EXCEEDED: REVIEW_ROUND_CAP_EXPORTED,
  VISUAL_ROUND_EXCEEDED: VISUAL_ROUND_CAP_EXPORTED,
  // d2-server-brake-accounting (qa-owned re-baseline): HOP_CAP_EXCEEDED's
  // triggerEdge carries the identical ">= N" cap-literal shape as the three
  // round caps above ("prev_hop_count >= 10 on a role transition ..."); check
  // it against the live HOP_CAP_EXPORTED constant the same way.
  HOP_CAP_EXCEEDED: HOP_CAP_EXPORTED,
};

test("AC2 (c12): round-cap entries' triggerEdge numeric literal matches the live transitions.ts cap constant", () => {
  for (const [code, cap] of Object.entries(CAP_BY_CODE)) {
    const entry = GATE_REGISTRY.find((g) => g.errorCode === code);
    assert.ok(entry, `${code} missing from GATE_REGISTRY`);
    const m = entry.triggerEdge.match(/>=\s*(\d+)/);
    assert.ok(m, `${code} triggerEdge does not encode a ">= N" cap literal: "${entry.triggerEdge}"`);
    assert.equal(
      Number(m[1]),
      cap,
      `${code} triggerEdge cap literal (${m[1]}) does not match the live transitions.ts cap (${cap})`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC2 (predicate names vs orchestrator emit sites): for every
// producer:"orchestrator" entry whose armCondition contains a camelCase
// predicate/function-call identifier, assert that identifier appears
// literally in tools/handoff-orchestrator.ts — the file that actually calls
// it. Catches a typo'd/renamed predicate in the registry copy that no longer
// matches the real emit-site call.
// ---------------------------------------------------------------------------

test("AC2 (c12): orchestrator-producer armCondition predicate names are literally present in tools/handoff-orchestrator.ts", () => {
  const orchestratorSrc = readSource(path.join("tools", "handoff-orchestrator.ts"));
  let checked = 0;
  for (const g of GATE_REGISTRY) {
    if (g.producer !== "orchestrator") continue;
    for (const predicate of extractPredicateNames(g.armCondition)) {
      checked++;
      assert.ok(
        orchestratorSrc.includes(predicate),
        `${g.errorCode} armCondition references "${predicate}" but it does not appear literally in tools/handoff-orchestrator.ts`,
      );
    }
  }
  assert.ok(
    checked >= 12,
    `expected >=12 predicate-name checks across orchestrator-producer entries, got ${checked}`,
  );
});

// ---------------------------------------------------------------------------
// AC2 (transition-edge pairs vs doc-file mapping): for the three entries
// whose triggerEdge names a bare "pm:In_Progress" edge (SCOPE_DECISION_
// REQUIRED, CUT_APPROVAL_REQUIRED, EXTERNAL_REFS_UNRESOLVED — the pm→build
// entry gates), assert the edge literal appears verbatim in >=1 of the
// content/*.md file(s) that already backtick-quote that entry's errorCode
// (per the documentedInProse doc-file mapping, spec AC2). The compound
// "{architect,sr-engineer}:In_Progress" half of the same triggerEdge is not
// a single role:Status literal (a brace-set precedes the colon) and is
// intentionally not extracted — EDGE_RE only matches a bare role name
// immediately before ":Status".
// ---------------------------------------------------------------------------

test("AC2 (c12): transition-edge-pair literals in triggerEdge appear verbatim in the mapped content/*.md doc file(s)", () => {
  const docCodes = extractDocCodes();
  const EDGE_CHECKED_CODES = ["SCOPE_DECISION_REQUIRED", "CUT_APPROVAL_REQUIRED", "EXTERNAL_REFS_UNRESOLVED"];
  let checked = 0;
  for (const code of EDGE_CHECKED_CODES) {
    const entry = GATE_REGISTRY.find((g) => g.errorCode === code);
    assert.ok(entry, `${code} missing from GATE_REGISTRY`);
    const edges = extractEdgePairs(entry.triggerEdge);
    assert.ok(edges.length > 0, `${code} triggerEdge has no role:Status literal to check: "${entry.triggerEdge}"`);
    const files = docCodes.get(code);
    assert.ok(files && files.size > 0, `${code} is not backtick-quoted in any content/*.md (documentedInProse contract)`);
    for (const edge of edges) {
      const foundIn = [...files].filter((f) => readSource(f).includes(edge));
      assert.ok(
        foundIn.length > 0,
        `${code} triggerEdge literal "${edge}" not found verbatim in any of its mapped doc files: ${[...files].join(", ")}`,
      );
      checked++;
    }
  }
  assert.ok(checked >= 3, `expected >=3 edge-literal doc checks, got ${checked}`);
});

// ---------------------------------------------------------------------------
// AC2 (constant-name literal, pinned case): TRANSITION_REJECTED's triggerEdge
// names the ALLOWED_TRANSITIONS export — assert it really is a live
// tools/transitions.ts export AND appears verbatim in TRANSITION_REJECTED's
// mapped doc file (skill-coordinator.md).
// ---------------------------------------------------------------------------

test("AC2 (c12): TRANSITION_REJECTED's ALLOWED_TRANSITIONS literal is a real transitions.ts export, verbatim in its mapped doc", () => {
  const entry = GATE_REGISTRY.find((g) => g.errorCode === "TRANSITION_REJECTED");
  assert.ok(entry, "TRANSITION_REJECTED missing from GATE_REGISTRY");
  assert.ok(
    entry.triggerEdge.includes("ALLOWED_TRANSITIONS"),
    "TRANSITION_REJECTED triggerEdge must reference ALLOWED_TRANSITIONS verbatim",
  );
  const transitionsSrc = readSource(path.join("tools", "transitions.ts"));
  assert.ok(
    transitionsSrc.includes("export const ALLOWED_TRANSITIONS"),
    "ALLOWED_TRANSITIONS must be a real export in tools/transitions.ts",
  );
  const docCodes = extractDocCodes();
  const files = docCodes.get("TRANSITION_REJECTED");
  assert.ok(files && files.size > 0, "TRANSITION_REJECTED must be backtick-quoted in >=1 content/*.md");
  const foundIn = [...files].filter((f) => readSource(f).includes("ALLOWED_TRANSITIONS"));
  assert.ok(
    foundIn.length > 0,
    `ALLOWED_TRANSITIONS literal not found verbatim in TRANSITION_REJECTED's mapped doc file(s): ${[...files].join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// Doc-file mapping vs actual backtick-quote sites: gates/registry.ts carries
// a hand-authored comment (T-C12-01) mapping each errorCode to the
// content/*.md file(s) that backtick-quote it — the input the checks above
// rely on. Parse that comment (it is prose, not an exported const — TS
// comments do not survive into dist/) and assert it is byte-for-byte the
// same file set extractDocCodes() finds by actually scanning content/*.md.
// A stale mapping comment (a doc file renamed/removed, a code re-documented
// elsewhere) would silently make the AC2 checks above trust the wrong files
// without this.
// ---------------------------------------------------------------------------

function parseDocFileMappingComment() {
  const src = readSource(path.join("gates", "registry.ts"));
  const map = new Map();
  const LINE_RE = /^\/\/\s{2,}([A-Z][A-Z0-9_]*)\s{2,}(.+)$/gm;
  let m;
  while ((m = LINE_RE.exec(src))) {
    map.set(
      m[1],
      new Set(m[2].split(",").map((f) => f.trim()).filter(Boolean)),
    );
  }
  return map;
}

test("doc-file mapping (c12): gates/registry.ts's errorCode→doc-file mapping comment matches the actual backtick-quote sites", () => {
  const mapping = parseDocFileMappingComment();
  assert.equal(
    mapping.size,
    27,
    `expected the mapping comment to list all 27 codes, found ${mapping.size}: ${[...mapping.keys()].join(", ")}`,
  );
  const docCodes = extractDocCodes();
  for (const g of GATE_REGISTRY) {
    const declared = mapping.get(g.errorCode);
    assert.ok(declared, `${g.errorCode} missing from the doc-file mapping comment above GATE_REGISTRY`);
    const actual = new Set([...(docCodes.get(g.errorCode) || [])].map((f) => path.basename(f)));
    assert.deepEqual(
      [...declared].sort(),
      [...actual].sort(),
      `${g.errorCode}: mapping comment declares [${[...declared].join(", ")}] but actual backtick-quote sites are [${[...actual].join(", ")}]`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC3: explicit allowlist for every (errorCode, field) pair whose value is
// free-form English with no mechanically checkable literal — "never silently
// exempted without acknowledgment in the diff." Each entry below carries a
// one-line reason. The closure test that follows asserts every one of the
// 22*2 (triggerEdge, armCondition) pairs is EITHER covered by a checkable-
// literal test above OR listed here — never neither, never both. clearingArtifact
// is intentionally out of this classification (AC1's non-empty bar is its only
// bar per spec AC2's wording, which names only triggerEdge/armCondition as the
// checkable-literal fields).
// ---------------------------------------------------------------------------

const FREE_TEXT_ALLOWLIST = [
  { code: "AGENT_ID_REQUIRED", field: "triggerEdge", reason: "free English description of the null/unknown agent condition; no named predicate or edge-pair literal to check" },
  { code: "AGENT_ID_REQUIRED", field: "armCondition", reason: "\"always (validateTransition step 1)\" — generic pointer to the enclosing function, reused verbatim (differing only by step N) across all 5 validateTransition-producer entries; not independently checkable per-entry" },
  { code: "TRANSITION_REJECTED", field: "armCondition", reason: "same generic validateTransition-step pointer as AGENT_ID_REQUIRED" },
  { code: "QA_ROUND_EXCEEDED", field: "armCondition", reason: "same generic validateTransition-step pointer" },
  { code: "REVIEW_ROUND_EXCEEDED", field: "armCondition", reason: "same generic validateTransition-step pointer" },
  { code: "VISUAL_ROUND_EXCEEDED", field: "armCondition", reason: "\"opt-in (counter present)\" — free English; the visual_round counter is a handoff field, not a named predicate/function call" },
  { code: "HOP_CAP_EXCEEDED", field: "armCondition", reason: "\"opt-in (counter present)\" — free English, identical reasoning to VISUAL_ROUND_EXCEEDED; the hop_count counter is a handoff field, not a named predicate/function call. triggerEdge is NOT allowlisted — it is mechanically checked via CAP_BY_CODE (d2-server-brake-accounting re-baseline)." },
  { code: "CUT_APPROVAL_REQUIRED", field: "armCondition", reason: "\"unconditional; FileHandoffStorage only\" — names a class, not a predicate/function-call literal; this entry's checkable content is its triggerEdge edge-pair, checked separately" },
  { code: "EXTERNAL_REFS_UNRESOLVED", field: "armCondition", reason: "compound free-English condition over the external_refs ledger; no single named predicate/function-call literal" },
  { code: "MISSING_EVIDENCE", field: "triggerEdge", reason: "\"status=PASS with completed_tasks\" — free English, no role:Status edge pair or named constant" },
  { code: "MISSING_REVIEW_EVIDENCE", field: "triggerEdge", reason: "a role:Status-shaped substring exists (code-reviewer:In_Progress -> qa-engineer:In_Progress), but skill-code-reviewer.md (its sole mapped doc) documents this hop only as comma-tuple prose ('(sr-engineer, In_Progress)' -> '(code-reviewer, In_Progress)'), never restating the colon form verbatim — asserting doc-verbatim presence here would be a guaranteed false failure, not a real check" },
  { code: "EXPECTED_RED_DIFF_MISSING", field: "triggerEdge", reason: "free English precondition list, no role:Status edge pair or named constant" },
  { code: "VISUAL_BASELINES_REQUIRED", field: "triggerEdge", reason: "free English (\"PASS, armed, ... absent\"), no checkable literal" },
  { code: "VISUAL_EVIDENCE_MISSING", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "VISUAL_WIDGETS_UNVERIFIED", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "VISUAL_ASSERTIONS_REQUIRED", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "VISUAL_REPORT_INCOMPLETE", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "VISUAL_PROVENANCE_MISSING", field: "triggerEdge", reason: "references baseline:/diff-metric: prose field names, not a role:Status edge or named constant" },
  { code: "BASELINE_MANIFEST_MISSING", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "BASELINE_PROVENANCE_INCOMPLETE", field: "triggerEdge", reason: "free English — the \">=2\" is a hardcoded threshold, not sourced from an exported constant the way the 4/4/6 round caps are" },
  { code: "PIXEL_GATE_ATTESTATION_MISSING", field: "triggerEdge", reason: "references the pixel_gate_complete:true prose field name, not a role:Status edge or named constant" },
  { code: "REVIEW_VERDICT_STATUS_MISMATCH", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "REVIEW_VERDICT_STATUS_MISMATCH", field: "armCondition", reason: "\"agent_id=code-reviewer && review_verdict present\" — snake_case field-name shorthand, not a camelCase predicate/function-call literal" },
  { code: "REVIEWER_COMPLETED_TASKS_REJECTED", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "REVIEWER_COMPLETED_TASKS_REJECTED", field: "armCondition", reason: "snake_case field-name shorthand, not a camelCase predicate/function-call literal" },
  // d9-qa-review-scoped-append (qa-owned, 2026-07-11): follows the
  // REVIEWER_COMPLETED_TASKS_REJECTED precedent immediately above — same two
  // reasons, same shape.
  { code: "QA_REVIEW_TARGET_REQUIRED", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "QA_REVIEW_TARGET_REQUIRED", field: "armCondition", reason: "snake_case field-name shorthand, not a camelCase predicate/function-call literal" },
  // e1-feature-scoped-state-design (qa-owned, 2026-07-12): FEATURE_LEASE_HELD
  // fires on ANY write whose active_feature differs from prevState's, not a
  // single fixed role:Status edge pair or a CAP_BY_CODE-style numeric literal
  // — free English describing a cross-feature condition. armCondition is NOT
  // allowlisted: it names the real isFeatureLeaseHeld(...) predicate call, so
  // it is mechanically checked (armConditionCheckable) like every other
  // orchestrator-producer entry with a camelCase predicate literal.
  { code: "FEATURE_LEASE_HELD", field: "triggerEdge", reason: "free English describing a cross-feature condition (\"any write whose active_feature differs ... while the incumbent is non-terminal and fresh\"), no single role:Status edge pair or CAP_BY_CODE-style numeric literal" },
  // e2-bugfix-repro-gate (qa-owned): REPRO_MANIFEST_MISSING's triggerEdge is
  // "sr-engineer:In_Progress -> code-reviewer:In_Progress (file-mode only)" —
  // a real role:Status edge pair IS present, but it is not in
  // triggerEdgeCheckable (that set is CAP_BY_CODE keys plus the three
  // pm->build-entry gates only); the trailing "(file-mode only)" qualifier and
  // the lack of a CAP_BY_CODE numeric literal keep this pair out of the
  // mechanical check. armCondition is NOT allowlisted: it contains the
  // camelCase identifier "prevState", which literally appears in
  // tools/handoff-orchestrator.ts, so it is mechanically checked like every
  // other orchestrator-producer entry.
  { code: "REPRO_MANIFEST_MISSING", field: "triggerEdge", reason: "role:Status edge pair present but not in triggerEdgeCheckable (no CAP_BY_CODE numeric literal, not one of the three pm->build-entry gates); the \"(file-mode only)\" qualifier is free English" },
  // e4-design-source-credibility-gate (qa-owned, 2026-07-12): SOURCE_
  // CREDIBILITY_UNVERIFIED's triggerEdge is a real "pm:In_Progress ->
  // {architect,sr-engineer}:In_Progress" role:Status edge pair, but it is not
  // in triggerEdgeCheckable (not a CAP_BY_CODE numeric literal, not one of the
  // three pm->build-entry gates named in EDGE_CHECKED_CODES). armCondition is
  // NOT allowlisted: it names the real camelCase checkSourceCredibility(...)
  // predicate call, which appears literally in tools/handoff-orchestrator.ts,
  // so it is mechanically checked (armConditionCheckable) like every other
  // orchestrator-producer entry.
  { code: "SOURCE_CREDIBILITY_UNVERIFIED", field: "triggerEdge", reason: "role:Status edge pair present but not in triggerEdgeCheckable (not a CAP_BY_CODE numeric literal, not one of the three pm->build-entry gates in EDGE_CHECKED_CODES)" },
];

test("AC3 (c12): every (errorCode, field) pair for triggerEdge/armCondition is either mechanically checked above or explicitly allowlisted as free-text — no silent exemptions", () => {
  const triggerEdgeCheckable = new Set([
    ...Object.keys(CAP_BY_CODE),
    "TRANSITION_REJECTED",
    "SCOPE_DECISION_REQUIRED",
    "CUT_APPROVAL_REQUIRED",
    "EXTERNAL_REFS_UNRESOLVED",
  ]);
  const armConditionCheckable = new Set(
    GATE_REGISTRY.filter(
      (g) => g.producer === "orchestrator" && extractPredicateNames(g.armCondition).length > 0,
    ).map((g) => g.errorCode),
  );
  const allowlistKeys = FREE_TEXT_ALLOWLIST.map((e) => `${e.code}:${e.field}`);

  const problems = [];
  for (const g of GATE_REGISTRY) {
    for (const field of ["triggerEdge", "armCondition"]) {
      const key = `${g.errorCode}:${field}`;
      const checkable = field === "triggerEdge" ? triggerEdgeCheckable.has(g.errorCode) : armConditionCheckable.has(g.errorCode);
      const allowlisted = allowlistKeys.includes(key);
      if (checkable && allowlisted) problems.push(`${key}: BOTH mechanically checked and allowlisted (remove from FREE_TEXT_ALLOWLIST)`);
      if (!checkable && !allowlisted) problems.push(`${key}: NEITHER mechanically checked NOR allowlisted — silent exemption`);
    }
  }
  assert.deepEqual(problems, [], problems.join("; "));
  assert.equal(
    new Set(allowlistKeys).size,
    allowlistKeys.length,
    "FREE_TEXT_ALLOWLIST must not contain duplicate (code, field) entries",
  );
});
