// Coded by @qa-engineer
// Parity test between GATE_REGISTRY (dist/gates/registry.js), the gate error codes emitted by
// source, and the codes named in content/*.md. Registry and source codes must match, doc codes
// must be a subset of the registry, every documentedInProse entry must appear in a doc, and
// each entry must be self-consistent.
// Needs a built tree; npm test's prebuild step guarantees dist/.
// Rationale: specs/e260g-comment-rationale.md (test/error-code-contract.test.mjs).

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

// The three round-cap constants, imported so the
// QA_ROUND_EXCEEDED/REVIEW_ROUND_EXCEEDED/VISUAL_ROUND_EXCEEDED triggerEdge
// cap literals (">= 4", ">= 4", ">= 6") are checked against the live
// transitions.ts values rather than trusted as hand-copied prose.
// HOP_CAP_EXPORTED is imported for the same reason: HOP_CAP_EXCEEDED's
// triggerEdge carries the same ">= N" cap literal. (T-C12-02/03,
// c12-registry-field-consumers, d2-server-brake-accounting)
const { ROUND_CAP_EXPORTED, REVIEW_ROUND_CAP_EXPORTED, VISUAL_ROUND_CAP_EXPORTED, HOP_CAP_EXPORTED } = await import(
  path.join(PROJECT_ROOT, "dist", "tools", "transitions.js")
);

// ---------------------------------------------------------------------------
// Shape rule (spec: "Shape rule (used identically by both extraction sides)")
// ---------------------------------------------------------------------------

const TOKEN_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\b/g;
// The suffix list must cover every gate error code's final word; a code with a missing suffix
// is invisible to both extractors and would hide a registry or doc regression. Add a suffix
// here rather than renaming the code. Siblings such as LEASE_OVERRIDE_AUDIT_MISSING match _MISSING.
const SUFFIX_RE = /_(REQUIRED|MISSING|INCOMPLETE|EXCEEDED|UNVERIFIED|REJECTED|UNRESOLVED|MISMATCH|HELD|CHANGE|SUSPECT)$/;
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

// Doc side: match `TOKEN` directly (backtick, shape-rule token, backtick) instead of capturing
// arbitrary backtick spans. Fenced code blocks in content/*.md contain literal backticks that
// would throw off open/close pairing for the rest of the file.
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

// GATE_REGISTRY is the single source of truth. The entry count (33) is pinned so adding or
// dropping a gate is a deliberate, visible change here. (AC-1, AC-5, E40)

test("AC-1/AC-5: GATE_REGISTRY has exactly 33 entries (32 in, 33 out — e40-nonqa-completed-tasks-write-gate added NON_QA_COMPLETED_TASKS_REJECTED)", () => {
  assert.equal(
    GATE_REGISTRY.length,
    33,
    `expected exactly 33 GateDefinition entries, got ${GATE_REGISTRY.length}: ${GATE_REGISTRY.map((g) => g.errorCode).join(", ")}`,
  );
  assert.equal(
    ALL_GATE_CODES.length,
    33,
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

// TransitionRejection["error"] (tools/transitions.ts) is a hand-written union, not generated from
// the registry: it mixes validateTransition codes with handler-side codes kept for type narrowing.
// Drift is caught by pinning it at 16 members and requiring it to be a subset of ALL_GATE_CODES.
// Plain-text orchestrator codes (for example AC_EXECUTION_LOG_MISSING) stay out of both the union
// and TRANSITION_GATE_CODES. (DR-8, DR-9)

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
// An explicit pin on top of the generic parity checks above:
// REVIEW_VERDICT_STATUS_MISMATCH must be a real registry entry AND
// backtick-quoted in at least one content/*.md file. (T-C9-11, DR-7)
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

// AC-7 (relaxed): this file intentionally depends on a built tree, since it imports the real
// built dist/gates/registry.js (AC-5). The assertion below pins that dependency so reverting to source-text
// scanning would be a deliberate, visible choice.

test("AC-7 (relaxed): this test file intentionally imports dist/gates/registry.js (requires a built tree; npm test's prebuild step guarantees it)", () => {
  const selfText = readSource(path.join("test", "error-code-contract.test.mjs"));
  assert.match(
    selfText,
    /from\s+["'].*dist\/gates\/registry\.js["']|import\(\s*path\.join\([\s\S]*?"dist",\s*"gates",\s*"registry\.js"/,
    "error-code-contract.test.mjs must import the built gates/registry.js — AC-5 requires the generative check to consume the real registry",
  );
});

// ===========================================================================
// triggerEdge/armCondition/clearingArtifact are the three doc-facing
// GateDefinition fields. They get the same parity checks hintStatic has, so
// the prose in the registry cannot drift from the code and docs it
// describes. (T-C12-02/03, specs/c12-registry-field-consumers.md)
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

// AC2 extraction helpers for three checkable literal shapes: a round cap ("prev_x_round >= N"),
// a camelCase predicate name, and a role:Status edge pair. ALLOWED_TRANSITIONS, a single
// SCREAMING_SNAKE constant, is pinned as its own case below instead of a generic extractor.

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
  // HOP_CAP_EXCEEDED's triggerEdge carries the same ">= N" cap-literal shape
  // as the three round caps above ("prev_hop_count >= 10 on a role
  // transition ..."), so it is checked against the live HOP_CAP_EXPORTED
  // constant the same way. (d2-server-brake-accounting)
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

// AC2: each orchestrator-producer armCondition predicate (camelCase identifier) must appear
// literally in tools/handoff-orchestrator.ts, which catches a typo'd or renamed predicate.

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

// AC2: for the three pm->build entry gates (SCOPE_DECISION_REQUIRED, CUT_APPROVAL_REQUIRED,
// EXTERNAL_REFS_UNRESOLVED) the bare "pm:In_Progress" edge literal must appear verbatim in a
// content/*.md file that already quotes the errorCode. The compound
// "{architect,sr-engineer}:In_Progress" half is not extracted: EDGE_RE needs a bare role name.

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

// Doc-file mapping vs actual quote sites: gates/registry.ts carries a prose comment mapping each
// errorCode to the content/*.md files that quote it. Comments do not survive into dist/, so it is
// parsed from source and must list exactly the files extractDocCodes() finds. When a code starts
// being quoted in a new doc, fix the mapping line in gates/registry.ts, not this test. (T-C12-01)

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
    33,
    `expected the mapping comment to list all 33 codes, found ${mapping.size}: ${[...mapping.keys()].join(", ")}`,
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

// AC3: every (errorCode, field) pair with free-form English and no checkable literal is
// allowlisted here with a one-line reason. The closure test below requires each pair to be
// either checked above or listed here, never neither and never both. clearingArtifact is out of
// this classification (AC1's non-empty bar is its only bar).

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
  // Same two reasons and same shape as REVIEWER_COMPLETED_TASKS_REJECTED
  // immediately above. (d9-qa-review-scoped-append)
  { code: "QA_REVIEW_TARGET_REQUIRED", field: "triggerEdge", reason: "free English, no checkable literal" },
  { code: "QA_REVIEW_TARGET_REQUIRED", field: "armCondition", reason: "snake_case field-name shorthand, not a camelCase predicate/function-call literal" },
  // FEATURE_LEASE_HELD fires on ANY write whose active_feature differs from
  // prevState's, not on a fixed role:Status edge pair or a CAP_BY_CODE-style
  // numeric literal, so its triggerEdge is free English. armCondition is NOT
  // allowlisted: it names the real isFeatureLeaseHeld(...) predicate call, so
  // it is mechanically checked (armConditionCheckable) like every other
  // orchestrator-producer entry with a camelCase predicate literal.
  // (e1-feature-scoped-state-design)
  { code: "FEATURE_LEASE_HELD", field: "triggerEdge", reason: "free English describing a cross-feature condition (\"any write whose active_feature differs ... while the incumbent is non-terminal and fresh\"), no single role:Status edge pair or CAP_BY_CODE-style numeric literal" },
  // REPRO_MANIFEST_MISSING: triggerEdge has a real edge pair but is not in triggerEdgeCheckable
  // (no cap literal, "(file-mode only)" qualifier). armCondition is checked mechanically via the
  // prevState identifier, so it is not allowlisted. (e2-bugfix-repro-gate)
  { code: "REPRO_MANIFEST_MISSING", field: "triggerEdge", reason: "role:Status edge pair present but not in triggerEdgeCheckable (no CAP_BY_CODE numeric literal, not one of the three pm->build-entry gates); the \"(file-mode only)\" qualifier is free English" },
  // SOURCE_CREDIBILITY_UNVERIFIED: triggerEdge has a real edge pair but is not in
  // triggerEdgeCheckable (no cap literal, not a pm->build entry gate). armCondition is checked
  // mechanically via checkSourceCredibility(...), so it is not allowlisted. (e4-design-source-credibility-gate)
  { code: "SOURCE_CREDIBILITY_UNVERIFIED", field: "triggerEdge", reason: "role:Status edge pair present but not in triggerEdgeCheckable (not a CAP_BY_CODE numeric literal, not one of the three pm->build-entry gates in EDGE_CHECKED_CODES)" },
  // AC_EXECUTION_LOG_MISSING: triggerEdge is free English (no cap literal, no edge pair).
  // armCondition is checked mechanically via hasProofAnnotatedAC(...), so it is not allowlisted.
  // (e3-outcome-shaped-acceptance)
  { code: "AC_EXECUTION_LOG_MISSING", field: "triggerEdge", reason: "free English precondition list (\"status=PASS with completed_tasks, spec has >=1 proof: AC, ## AC Execution Log absent\"), no CAP_BY_CODE numeric literal or role:Status edge pair" },
  // LEASE_OVERRIDE_AUDIT_MISSING: triggerEdge is free English. armCondition is checked
  // mechanically via classifyLeaseOverride(...), so it is not allowlisted. (e10-lease-override)
  { code: "LEASE_OVERRIDE_AUDIT_MISSING", field: "triggerEdge", reason: "free English precondition (\"any write while FEATURE_LEASE_HELD would fire, carrying lease_override:true (file-mode only)\"), no CAP_BY_CODE numeric literal or role:Status edge pair" },
  // BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE: triggerEdge is free English. armCondition is checked
  // mechanically (the prevState identifier), so it is not allowlisted. (e10-lease-override)
  { code: "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE", field: "triggerEdge", reason: "free English precondition (\"bookkeeping_write:true whose active_feature differs from the incumbent's (file-mode only)\"), no CAP_BY_CODE numeric literal or role:Status edge pair" },
  // STAMP_PROVENANCE_SUSPECT: triggerEdge is free English. armCondition is checked mechanically
  // via isHandAuthoredStamp(...) and hasStampRemediationAudit(...), so it is not allowlisted.
  // (e18-write-provenance)
  { code: "STAMP_PROVENANCE_SUSPECT", field: "triggerEdge", reason: "free English precondition (\"any write while the on-disk handoff last_updated matches the hand-authored stamp shape (file-mode only)\"), no CAP_BY_CODE numeric literal or role:Status edge pair" },
  // QA_COMPLETION_EVIDENCE_MISSING: triggerEdge has a real edge pair but is not in
  // triggerEdgeCheckable (same case as REPRO_MANIFEST_MISSING). armCondition is checked
  // mechanically via hasEvidenceInFile(...), so it is not allowlisted. (e18-write-provenance)
  { code: "QA_COMPLETION_EVIDENCE_MISSING", field: "triggerEdge", reason: "role:Status edge pair present (code-reviewer:In_Progress -> qa-engineer:In_Progress) but not in triggerEdgeCheckable (no CAP_BY_CODE numeric literal, not one of the three pm->build-entry gates); the \"(file-mode only)\" qualifier and set-difference precondition are free English" },
  // Sibling of REVIEWER_COMPLETED_TASKS_REJECTED (one check, two codes), so the same two reasons:
  // triggerEdge is free English, and armCondition is snake_case shorthand, so CAMEL_RE finds
  // nothing to check. (E40)
  { code: "NON_QA_COMPLETED_TASKS_REJECTED", field: "triggerEdge", reason: "free English, no checkable literal — same shape as REVIEWER_COMPLETED_TASKS_REJECTED, its sibling branch" },
  { code: "NON_QA_COMPLETED_TASKS_REJECTED", field: "armCondition", reason: "snake_case field-name shorthand, not a camelCase predicate/function-call literal — same shape as REVIEWER_COMPLETED_TASKS_REJECTED, its sibling branch" },
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
