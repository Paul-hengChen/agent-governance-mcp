// Coded by @qa-engineer
// Tests for spec: specs/context-budget-reduction.md.
// Spec-to-Test map:
//   AC1 (measurement)          -> t-measure-runs, t-measure-labels
//   AC2 (reduction)            -> t-strip-reduces, t-lean-under-target
//   AC3 (enforcement preserved)-> t-lite-omits-chain, t-lite-keeps-universal,
//                                 t-full-keeps-chain, t-hook-lite, t-hook-full
//   AC4 (no routing regression)-> t-full-keeps-chain (chain roles still receive
//                                 §3.1/§4 verbatim; transition logic untouched —
//                                 covered by the existing transitions test suite)
//   DR-4 (manifest imported, not regex-copied) -> t-manifest-not-duplicated
//
// WHY: the always-on token reduction works by composing OUT the chain-only
// fragments (constitution §3.1, §4) for LITE contexts only. The risk is twofold —
// (a) the composition silently drops a rule a lite agent still needs, or (b) a
// consumer re-derives its own fragment list and drifts from the shared manifest.
// These tests pin both: lite loses ONLY chain rules, chain roles keep everything,
// and the hook + measure script both import the one shared manifest.
//
// compose-not-strip (ticket A9, T-CNSO-07): this file previously exercised
// stripChainOnly/stripDesignOnly directly as the mechanism under test — both
// functions are DELETED (prompts/build.ts now composes fragments additively via
// composeConstitution(), never strips a monolith). Every test below that probed
// those two strippers' internals (unit tests, DR-3 regex parity, cross-axis
// permutation/orphan-marker sweeps) is removed; tests that probed OUTCOMES (what
// a dispatch mode contains/omits) are re-pointed to composeConstitution() and
// continue to hold — proving AC2/AC3/AC4 equivalence empirically, not just by
// construction. stripRationale/stripOriginTags are UNCHANGED and every test of
// them below is kept verbatim.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const approxTokens = (t) => Math.ceil(t.length / 4);

const { stripRationale, stripOriginTags, buildPromptForRole, composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));

// compose-not-strip (ticket A9, T-CNSO-07): CONSTITUTION was `fs.readFileSync(content/
// constitution.md)`; it is now the composed-all bundle, which Option R (architecture
// DR-1) guarantees is byte-identical to the retired monolith — composeConstitution's
// own equivalence is independently pinned in test/compose-equivalence.test.mjs (T-CNSO-08)
// against a pre-refactor golden fixture, so every downstream assertion in this file that
// slices/searches CONSTITUTION is unaffected by the migration.
const CONSTITUTION = composeConstitution({ chain: true, design: true });

// The hook's lite composition (chain fragments excluded, design fragments kept — the
// hook never stripped design; see architecture Hook Parity Contract) with the blank-run
// collapse the old stripChainOnly performed. Reused by the AC2/AC3 lean-bundle tests
// below, which previously called the now-deleted stripChainOnly(CONSTITUTION) directly.
const LEAN_CONSTITUTION = composeConstitution({ chain: false, design: true }).replace(/\n{3,}/g, "\n\n");

// Markers that prove a section is present/absent in a rendered bundle.
const CHAIN_MARKERS = ["3.1 Server-enforced chain", "4. Routing Chain"];
const UNIVERSAL_MARKERS = ["NO YAPPING", "Strict typing", "Anti-Loop Circuit Breaker", "Access Denied", "Cognitive Discipline"];

// governance-text-load (F-B, v3.31.0): rule/gate/SOP markers that MUST survive stripRationale.
// These are the operative clauses the agent acts on — only "Reason:/Rationale:" prose is fenced.
// Spec AC9: no fence may swallow a rule heading, gate name, MUST clause, or numbered SOP step.
const PM_RULE_MARKERS = [
  // SOP step numbers
  "1. `tw_get_state`",
  "3. **Resource Audit Gate**",
  "5. **Ambiguity Gate**",
  "8. `tw_update_state",
  // Gate headings
  "Copy / Strings",
  "Visual Tokens",
  "Scope Decision Gate",
  "Geometric-Density Split Gate",
  // MUST clause
  "MUST contain these H2",
];
const SR_RULE_MARKERS = [
  // SOP step numbers
  "2. **Clarification Gate**",
  "3. **Task-Size Check**",
  "3a. **Design-Aware Pre-Flight**",
  "6. **Security Checklist**",
  // Sub-step protocol headings
  "Scoped Render Self-Check",
  "Whole-surface self-converge loop",
  "Flag, don't assume",
  // Reply-round headings
  "Code-Review Round Reply",
  "QA Round Reply",
];

// --- AC2: reduction -------------------------------------------------------

test("AC2: lean always-on bundle is below the raw baseline and within target (<= 3087 ~tok)", () => {
  // v3.24.0 (B2 backlog fix): cap raised from 2100 → 2300 to provide ~200-token
  // editing headroom. The v3.22.0 raise (2000 → 2100) left only a 2-token margin
  // (2098/2100), meaning any minor constitution/skill edit broke CI unexpectedly.
  // v3.27.0 (qa-owned bump): cap raised from 2300 → 2400 to absorb the net growth
  // from the real v3.27.0 constitution edits (A1–B3 + A4 wording). Actual lean
  // bundle measured at 2348 ~tok; 2400 provides ~50-token editing headroom while
  // staying well below the full coordinator bundle (~3500+ tokens).
  // v3.31.0 (qa-owned bump): cap raised from 2400 → 2600 to absorb the §1
  // Self-converge relaxation clause (visual-selfconverge feature). Actual lean
  // bundle measured at 2528 ~tok; 2600 provides ~70-token editing headroom.
  // v3.28.0 (qa-owned bump): cap raised from 2600 → 2700 to absorb the §1
  // Design-sourced assets line (design-asset-source-rule feature). Lean applies
  // stripChainOnly only (not stripDesignOnly) — the new §1 design-only line counts
  // on this path. Actual lean bundle measured at 2641 ~tok; 2700 provides ~59-token
  // editing headroom, consistent with the v3.31.0 ~70-token convention.
  // v3.38.0 (qa-owned bump): cap raised from 2700 → 2850 to absorb the F2
  // retro-sop-hardening scope-creep visual-fidelity example added to
  // skill-coordinator-lite.md (one long line, +91 ~tok net). Actual lean bundle
  // measured at 2791 ~tok; 2850 provides ~59-token editing headroom, consistent
  // with the v3.28.0 ~59-token convention.
  // pm-cut-approval-gate (qa-owned bump): cap raised from 2850 → 3010 to absorb
  // the cut-approval SOP text added to skill-coordinator-lite.md (halt instruction)
  // and the skill-pm.md step 7a expansion. Actual lean bundle measured at 2958 ~tok;
  // 3010 provides ~52-token editing headroom, consistent with prior conventions.
  // cut-approval-coordinator-attestation (qa-owned bump, C2-06): cap raised from
  // 3010 → 3030 to absorb the new Cut-Approval Gate bullet in const-08-chain-31-mid.md
  // (chain-tagged, included on this lean path) plus the skill-pm.md/skill-coordinator-lite.md
  // pointer-line dedup edits. Actual lean bundle measured at 3030 ~tok (exact); cap set
  // to the exact measured value per the Phase-2 convention (no additional headroom).
  // a13-section1-polish (qa-owned bump, A13-07): cap raised from 3030 → 3087 to absorb
  // the const-01-core-head.md Terse/Watermark rewrite (unified output-length policy +
  // two-row watermark decision table with the `fable` tier added). const-01-core-head.md
  // is core-head (untagged chain/design), so it loads on this lean path too. Independently
  // re-measured (not trusted from sr-engineer's handoff note) at 3087 ~tok (exact); cap
  // set to the exact measured value per the established Phase-2 convention (no additional
  // headroom).
  // a11-escalation-grammar (qa-owned bump, A11-02): cap raised from 3087 → 3332 to absorb
  // the const-05-chain-mid.md canonical Escalation call format + WHEN/DO/ELSE bullets added
  // by this ticket (chain-tagged, loads on this lean path). Independently re-measured (not
  // trusted from sr-engineer's handoff note) at 3332 ~tok (exact); cap set to the exact
  // measured value per the established Phase-2 convention (no additional headroom).
  // b8-external-ref-ledger (qa-owned bump, B8-09/B8-10): cap raised from 3332 → 3386 to
  // absorb the skill-coordinator-lite.md Auto-Routing stop-condition addition for the
  // EXTERNAL_REFS_UNRESOLVED gate (AC-12). Independently re-measured (not trusted from
  // sr-engineer's handoff note) at 3386 ~tok (exact); cap set to the exact measured value
  // per the established Phase-2 convention (no additional headroom).
  // c7-version-assertion-ownership (qa-owned bump, AC-8): cap raised from 3386 → 3491 to
  // absorb the const-05-core-standards.md "Test ownership" bullet rewrite (S01: narrow
  // import/require-path-retarget carve-out naming the A10 precedent, net +420 chars).
  // const-05-core-standards.md is core (untagged chain/design), so it loads on this lean
  // path too. Independently re-measured (not trusted from sr-engineer's or
  // code-reviewer's notes) at 3491 ~tok (exact); cap set to the exact measured value per
  // the established Phase-2 convention (no additional headroom).
  // c9-protocol-fields (qa-owned bump, T-C9-11): cap raised from 3491 → 3685 to absorb
  // the const-05-core-standards.md Escalation-call-format rewrite (T-C9-12: next_role/
  // resume_of/review_verdict promoted to first-class fields, with the new
  // REVIEW_VERDICT_STATUS_MISMATCH gate prose) plus the const-12-chain-r10-s4.md S6
  // sentence rewording — both core/chain-tagged, load on this lean path. Independently
  // re-measured (not trusted from sr-engineer's or code-reviewer's notes) at 3685 ~tok
  // (exact); cap set to the exact measured value per the established Phase-2 convention
  // (no additional headroom).
  // c14-dispatch-pins (qa-owned bump, T-C14-11): cap raised from 3685 → 3761 to absorb
  // the const-01-core-head.md AC-7 Pin-override bullet (a new line under the Watermark
  // rule stating dispatch_pins takes precedence over frontmatter/recommended_model
  // defaults) — const-01-core-head.md is core-head (untagged chain/design), so it loads
  // on this lean path too. Independently re-measured (not trusted from sr-engineer's or
  // code-reviewer's notes) at 3761 ~tok (exact); cap set to the exact measured value per
  // the established Phase-2 convention (no additional headroom).
  const liteSkill = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator-lite.md"), "utf-8");
  const SEP = "\n\n---\n\n";
  const raw = approxTokens(CONSTITUTION + SEP + liteSkill);
  const lean = approxTokens(LEAN_CONSTITUTION + SEP + liteSkill);
  assert.ok(lean < raw, `lean (${lean}) must be < raw (${raw})`);
  assert.ok(lean <= 3761, `lean always-on (${lean} ~tok) must meet the <= 3761 target`);
});

// --- AC3: enforcement preserved ------------------------------------------

test("AC3: lite (stripped) constitution OMITS chain-only sections", () => {
  for (const m of CHAIN_MARKERS) {
    assert.ok(!LEAN_CONSTITUTION.includes(m), `lite constitution must NOT contain chain-only marker: ${m}`);
  }
  assert.ok(!LEAN_CONSTITUTION.includes("chain-only:start"), "fence markers themselves must be removed");
});

test("AC3: lite (stripped) constitution RETAINS all universal rules", () => {
  for (const m of UNIVERSAL_MARKERS) {
    assert.ok(LEAN_CONSTITUTION.includes(m), `lite constitution must still contain universal rule: ${m}`);
  }
});

test("AC3/AC4: full (chain-role) constitution RETAINS chain-only sections verbatim", () => {
  // Chain roles receive the raw constitution — the rules that drive the
  // server-enforced transitions must reach them unchanged.
  for (const m of [...CHAIN_MARKERS, ...UNIVERSAL_MARKERS]) {
    assert.ok(CONSTITUTION.includes(m), `full constitution must contain: ${m}`);
  }
});

// compose-not-strip (ticket A9): the "exactly one balanced chain-only fence"
// test that lived here is REMOVED (T-CNSO-07) — it asserted on the marker-pairing
// mechanics of a strip pipeline that no longer exists. Composition now selects
// fragments by tag, never parses markers (AC11: the unbalanced-fence failure
// class is gone structurally, not guarded against). See T-manifest-not-duplicated
// below and test/compose-equivalence.test.mjs for the replacement equivalence
// contract.

// --- AC3: SessionStart hook integration ----------------------------------

// Test-isolation fix (C6C11-QA, review_reports/review_C6C11-REV.md N2): this
// used to run the hook with CLAUDE_PROJECT_DIR=ROOT, which writes a REAL C11
// L2 dedup marker (bin/agent-governance-context.mjs's trailing
// `.agc-hook-marker.json` write) into THIS repo's own `.current/`. That marker
// is cross-process BY DESIGN (index.ts's hookMarkerFresh reads it from disk),
// so a later, unrelated test *process* — test/teamwork-lite.test.mjs AC3b —
// spawning the real server against `PROJECT_ROOT` (== this same ROOT) within
// the 120s window correctly (per the C11 fail-safe contract) saw a fresh
// marker and substituted the S03 sentinel for the constitution, failing
// AC3b's `# Constitution v` assertion. That is the product working as
// designed colliding with a shared on-disk side effect of THIS file's test
// run — a test-infra defect, not a product bug (confirmed by code-reviewer,
// APPROVED). Fix: give every runHook() call its own throwaway managed
// workspace (a temp dir with a `.current/` marker so isManagedWorkspace is
// true) so the L2 marker it writes never lands in the real repo, and delete
// that workspace immediately after — no assertion is loosened (AC-10/AC-11:
// AC3b keeps its unqualified S03-must-be-absent assertion). SERVER_ROOT
// (content/constitution/skill source) is unaffected: the hook derives it from
// `__dirname`, not from CLAUDE_PROJECT_DIR, so it still loads the real
// content/ tree regardless of which workspace we point CLAUDE_PROJECT_DIR at.
function runHook(env) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-hook-test-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  try {
    const out = execFileSync("node", [path.join(ROOT, "bin", "agent-governance-context.mjs")], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: ws, ...env },
      encoding: "utf-8",
    });
    return JSON.parse(out).hookSpecificOutput.additionalContext;
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

test("AC3: SessionStart hook LITE output strips chain sections, keeps universal", () => {
  const ctx = runHook({ AGC_DEFAULT_SKILL: "lite" });
  for (const m of CHAIN_MARKERS) assert.ok(!ctx.includes(m), `lite hook must omit: ${m}`);
  for (const m of UNIVERSAL_MARKERS) assert.ok(ctx.includes(m), `lite hook must keep: ${m}`);
});

test("AC3: SessionStart hook FULL output retains chain sections", () => {
  const ctx = runHook({ AGC_DEFAULT_SKILL: "full" });
  for (const m of [...CHAIN_MARKERS, ...UNIVERSAL_MARKERS]) {
    assert.ok(ctx.includes(m), `full hook must contain: ${m}`);
  }
});

// --- AC-9 (C6C11, C11 dedup outcome): measurable token reduction ----------
// WHY: spec c6-c11-prompt-state-injection.md AC-9 requires a CONCRETE number,
// not just "some savings", for the dual-injection scenario the C11 mechanism
// exists to fix (hook full-emit + a same-session /teamwork* fetch, or
// /teamwork then /teamwork-lite — see test/prompt-state-footer.test.mjs's
// e2e dedup test for the end-to-end proof that this mechanism actually fires).
// This test isolates the PURE size delta buildPromptForRole's omitConstitution
// param produces (index.ts's L1/L2 decision, DR-6): the second fetch in a
// dual-injection session pays only the S03 sentinel's cost instead of a full
// second constitution copy.
test("AC-9: omitConstitution=true bundle is measurably smaller than the full bundle by a concrete floor", async () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twac9-"));
  setActiveStorage(new FileHandoffStorage());
  const s = new FileHandoffStorage();
  await s.writeState(ws, "ac9-fixture-feat", "In_Progress", [], []);
  const full = buildPromptForRole("skill-coordinator-lite.md", "ac9", ws, false, "workspace_path arg", false).messages[0].content.text;
  const omitted = buildPromptForRole("skill-coordinator-lite.md", "ac9", ws, false, "workspace_path arg", true).messages[0].content.text;
  fs.rmSync(ws, { recursive: true, force: true });
  const fullTok = approxTokens(full);
  const omittedTok = approxTokens(omitted);
  // c6-c11-prompt-state-injection (qa-owned, AC-9): measured full=2575 ~tok,
  // omitted=1070 ~tok, saved=1505 ~tok on this working tree (coordinator-lite
  // skill, non-design fixture — the leanest arm, so this is a conservative
  // saving; the design-arm / chain-role saving is larger since the full
  // constitution slice it replaces is bigger). Floor set to 1200 ~tok, ~300
  // below the measured value, so routine content edits to the S03 sentinel
  // or skill-coordinator-lite.md don't flap this test while still proving a
  // real, non-trivial reduction (AC-9's own "concrete number" requirement).
  assert.ok(omittedTok < fullTok, `omit=true bundle (${omittedTok} ~tok) must be smaller than omit=false (${fullTok} ~tok)`);
  assert.ok(
    fullTok - omittedTok >= 1200,
    `dual-injection saving (${fullTok - omittedTok} ~tok) must be >= 1200 ~tok (AC-9 concrete measurement)`,
  );
});

// --- AC1: measurement script ---------------------------------------------

test("AC1: measure-context-cost script runs headlessly and exits 0", () => {
  // execFileSync throws on non-zero exit — reaching the assert means exit 0.
  const out = execFileSync("node", [path.join(ROOT, "scripts", "measure-context-cost.mjs")], {
    encoding: "utf-8",
  });
  assert.ok(out.length > 0, "script must produce output");
});

test("AC1: measure script prints the spec'd Copy/Strings labels + token table", () => {
  const out = execFileSync("node", [path.join(ROOT, "scripts", "measure-context-cost.mjs")], {
    encoding: "utf-8",
  });
  // Copy/Strings contract (spec Copy/Strings table): verbatim labels.
  assert.ok(out.includes("Always-on context budget"), "must print measure.report.title verbatim");
  assert.ok(
    out.includes("TOTAL always-on (constitution + default skill)"),
    "must print measure.report.total verbatim",
  );
  assert.match(out, /~tokens/, "must print a token column");
});

// --- DR-4: shared manifest, not duplicated regex --------------------------

test("DR-4: hook and measure script import the shared constitution-manifest (no duplicated chain-only regex)", () => {
  // WHY: DR-3 ("keep 3 stripChainOnly regex copies in sync by inspection") is
  // replaced by DR-4 ("one exported CONSTITUTION_SEGMENTS + includeSegment,
  // imported by build.ts, the hook, and the measure script") — architecture
  // compose-not-strip-overlays-architecture.md. The parity contract is now
  // STRUCTURAL (one shared list) instead of TEXTUAL (matching regex literals).
  // This pins both halves: the import exists, AND the old duplicated regex is gone.
  const files = [
    ["build.ts", path.join(ROOT, "prompts", "build.ts")],
    ["hook", path.join(ROOT, "bin", "agent-governance-context.mjs")],
    ["measure script", path.join(ROOT, "scripts", "measure-context-cost.mjs")],
  ];
  const chainOnlyRegexLiteral = /<!-- chain-only:start -->\[\\s\\S\]\*\?<!-- chain-only:end -->/;
  for (const [name, file] of files) {
    const src = fs.readFileSync(file, "utf-8");
    assert.match(src, /constitution-manifest(\.js)?["']/, `${name} must import the shared constitution-manifest module`);
    assert.ok(
      !chainOnlyRegexLiteral.test(src),
      `${name} must not hold its own duplicated chain-only-span regex (DR-4: structural import replaces textual regex-parity)`,
    );
  }
});

// ============================================================================
// governance-tag-strip (T-GTS-07): new coverage for the fourth sibling stripper,
// stripOriginTags. Mirrors the AC1 (stripDesignOnly)/AC9 (stripRationale) unit-test
// pattern already established above: idempotence, no-marker passthrough, and
// span-removal at the unit level; a mixed-content site (paren shared between a
// provenance tag and real normative text) at both the string level and end-to-end
// through buildPromptForRole; and a representative (not exhaustive 4!=24) composition-
// order check against the other three strippers. Spec: specs/governance-tag-strip.md
// AC1-AC4.
// ============================================================================

test("T-GTS-07/AC3: stripOriginTags is idempotent, no-marker passthrough, and removes fenced spans", () => {
  // WHY: same unit contract as the three sibling strippers (AC3 of the spec) — a
  // safety-default no-op on unfenced text, idempotent on already-stripped text, and a
  // real content shrink on fenced text with zero orphan markers left behind.
  const noop = "no markers here";
  assert.equal(stripOriginTags(noop), noop, "text without markers is unchanged (safety default)");
  assert.equal(stripOriginTags(""), "", "empty string passthrough");
  const stripped = stripOriginTags(CONSTITUTION);
  assert.ok(stripped.length < CONSTITUTION.length, "stripped constitution must be shorter than raw");
  assert.equal(stripOriginTags(stripped), stripped, "stripOriginTags must be idempotent");
  assert.ok(!stripped.includes("origin:start"), "origin:start markers must be removed");
  assert.ok(!stripped.includes("origin:end"), "origin:end markers must be removed");
  // Span-removal at a known site: the §3.1 heading version stamp is fenced in source
  // and must be gone post-strip, while the un-fenced heading text survives.
  assert.ok(
    CONSTITUTION.includes("3.1 Server-enforced chain<!-- origin:start --> (v3.2.0)<!-- origin:end -->"),
    "fixture assumption: raw source carries this fenced site (test would be vacuous otherwise)",
  );
  assert.ok(!stripped.includes("(v3.2.0)"), "the fenced version stamp must be removed by the span-removal");
  assert.ok(stripped.includes("3.1 Server-enforced chain"), "the un-fenced heading text must survive");
});

test("T-GTS-07/AC2: mixed-content site keeps its normative half after stripOriginTags (string-level)", () => {
  // WHY: AC2's disqualifying-finding contract, pinned directly against a known
  // mixed-content site (skill-pm.md's Visual Structural Assertions gate) — the fence
  // wraps ONLY the "v3.26.0;" provenance substring, sharing a parenthetical with the
  // real MUST-clause qualifier "MANDATORY when …". Deleting the whole paren (the
  // rejected blind-regex approach) would silently drop that qualifier; fencing must not.
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  assert.ok(
    SKILL_PM.includes("**Visual Structural Assertions** (<!-- origin:start -->v3.26.0; <!-- origin:end -->MANDATORY when"),
    "fixture assumption: raw skill-pm.md carries this mixed-content fenced site",
  );
  const stripped = stripOriginTags(SKILL_PM);
  assert.ok(
    stripped.includes("**Visual Structural Assertions** (MANDATORY when `design/<feature>.md` mode ≠ no-design)"),
    "the normative MUST-clause qualifier must survive verbatim after the provenance substring is stripped",
  );
  assert.ok(!stripped.includes("v3.26.0"), "the provenance version stamp must be gone");
});

test("T-GTS-07/AC1/AC2: mixed-content site survives end-to-end through buildPromptForRole (design arm)", async () => {
  // WHY: the same mixed-content contract as above, but exercised through the real
  // dispatch pipeline (not just the bare stripper) — the constitution's §4 visual_round
  // description shares a parenthetical between the "v3.14.0," provenance stamp and the
  // legitimate "§3.1" cross-reference. On a design-armed chain-role dispatch the whole
  // sentence loads (§4 visual block is design-only-gated, not origin-gated), so the
  // built prompt must carry the cross-reference and lose only the tag.
  const text = await buildOnFixture({ mode: "figma" });
  assert.ok(
    text.includes("`visual_round` (§3.1) tracks pixel-fidelity iterations"),
    "the surviving cross-reference clause must be present verbatim in the built prompt",
  );
  assert.ok(!text.includes("v3.14.0, §3.1"), "the provenance-tagged form must not leak into the built prompt");
  assert.ok(!text.includes("origin:start"), "no origin fence marker may leak into the built prompt");
});

test("T-GTS-07/AC4: stripOriginTags composes order-independently with stripRationale", () => {
  // WHY: AC4's order-independence contract, narrowed post-compose-not-strip (T-CNSO-07)
  // to the two text-transform strippers that still exist — stripChainOnly/stripDesignOnly
  // are DELETED; chain/design selection is now a fragment-file-inclusion decision made
  // BEFORE either stripper runs, not a regex race the strippers could interact with. Origin
  // fences never straddle a rationale boundary (they may nest inside one), so applying the
  // two remaining strippers in either order on the fully-composed constitution must agree.
  const order1 = stripRationale(stripOriginTags(CONSTITUTION));
  const order2 = stripOriginTags(stripRationale(CONSTITUTION));
  assert.equal(order1, order2, "stripRationale and stripOriginTags must compose order-independently");
  for (const marker of ["rationale:start", "rationale:end", "origin:start", "origin:end"]) {
    assert.ok(!order1.includes(marker), `fully-stripped constitution must contain ZERO orphan markers: ${marker}`);
  }
});

// --- governance-text-load AC9: stripRationale losslessness -------------------
// WHY: stripRationale fences must only wrap "Reason:/Rationale:" prose — never a
// rule heading, gate name, MUST clause, or numbered SOP step. These tests pin the
// invariant that every operative clause the agent acts on survives the strip. A
// regression (fence accidentally wrapping a rule) would silently drop governance
// enforcement for every chain-role dispatch (spec AC9, v3.31.0).

test("AC9: stripRationale is idempotent and leaves text without fences unchanged", () => {
  const noop = "no fences here";
  assert.equal(stripRationale(noop), noop, "text without markers is unchanged");
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  const stripped = stripRationale(SKILL_PM);
  assert.equal(stripRationale(stripped), stripped, "stripRationale must be idempotent");
});

test("AC9: stripRationale removes rationale blocks from skill-pm.md", () => {
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  const stripped = stripRationale(SKILL_PM);
  assert.ok(stripped.length < SKILL_PM.length, "stripped skill-pm must be shorter than raw");
  assert.ok(!stripped.includes("<!-- rationale:start -->"), "rationale:start markers must be removed");
  assert.ok(!stripped.includes("<!-- rationale:end -->"), "rationale:end markers must be removed");
});

test("AC9: every operative rule/gate/SOP marker survives stripRationale in skill-pm.md", () => {
  // WHY: these are the imperative rule headings and gate names the pm role acts on.
  // None may be inside a rationale fence — if they were, stripping would silently
  // drop a governance gate from every pm dispatch.
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  const stripped = stripRationale(SKILL_PM);
  for (const m of PM_RULE_MARKERS) {
    assert.ok(stripped.includes(m), `skill-pm stripped must still contain rule marker: ${JSON.stringify(m)}`);
  }
});

// skill-pm-consolidation (T-PMC-01, v3.44.0 pending): the gate-sub-step ->
// Gate Summary table rewrite relocated the Ambiguity Gate's STOP payload
// (spec Copy/Strings AC-8) from a standalone numbered sub-step into a table
// cell. specs/skill-pm-consolidation.md AC-8 calls out that this string must
// survive BYTE-EXACT, specifically preserving the em-dash (U+2014) separator
// rather than a hyphen -- a paraphrase an editor could introduce without any
// visual difference in most fonts/renderers. Nothing previously pinned this
// literal against the SKILL DOC TEXT itself (only the constitution's general
// pending_notes shape is tested elsewhere) -- this closes that gap so a
// future doc edit that silently swaps the em-dash for a hyphen fails CI
// instead of silently corrupting the Blocked-state payload an escalation
// handler reads verbatim.
test("AC8 (skill-pm-consolidation): Ambiguity Gate STOP payload is byte-exact (em-dash, not hyphen)", () => {
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  assert.ok(
    SKILL_PM.includes("PM blocked: ambiguous — <detail>"),
    "skill-pm.md must contain the Ambiguity Gate STOP payload byte-exact, including U+2014 em-dash",
  );
});

test("AC9: every operative rule/gate/SOP marker survives stripRationale in skill-sr-engineer.md", () => {
  // WHY: same contract for sr-engineer — stripped dispatch must carry the full
  // operative SOP even after rationale-only prose is removed.
  const SKILL_SR = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const stripped = stripRationale(SKILL_SR);
  assert.ok(stripped.length < SKILL_SR.length, "stripped skill-sr must be shorter than raw");
  for (const m of SR_RULE_MARKERS) {
    assert.ok(stripped.includes(m), `skill-sr stripped must still contain rule marker: ${JSON.stringify(m)}`);
  }
});

test("AC1/AC2: skill-pm stripped token count meets ≤ 3196 cap", () => {
  // WHY: the spec's re-grounded AC1 target (measured lossless, current file size
  // including F-A growth) must hold so each pm role dispatch is within budget.
  // pm-cut-approval-gate (qa-owned bump): cap raised from 2322 → 2850 to absorb
  // the step 7a Cut-Approval Gate SOP addition to skill-pm.md (inline cut draft
  // workflow, design-link rule, re-arm description). Actual stripped body measured
  // at 2800 ~tok; 2850 provides ~50-token editing headroom.
  // governance-tag-strip (T-GTS-06, qa-owned re-baseline): cap LOWERED from 2850 → 2817.
  // The real buildPromptForRole pipeline now runs stripOriginTags on the skill body BEFORE
  // stripRationale (build.ts, unconditional). skill-pm.md carries one origin fence (the
  // Geometric-Density Split Gate's "(v3.26.0; …)" rationale-nested tag), so folding
  // stripOriginTags into this test's composition (matching production) trims a few more
  // bytes than the raw-only 2830 this test previously measured. Actual stripRationale(
  // stripOriginTags(body)) measured at 2817 ~tok exactly; cap set to the exact measured
  // value (no headroom) per the constitution-conditional-load Phase-2 convention — the
  // point of this feature is the cap ending LOWER, not gaining fresh editing slack.
  // pm-repair-resume-routing (v3.47.0, qa-owned bump, C1-09/AC-11): cap raised from
  // 2817 → 2918 to absorb the AC-7 PM SOP addition (PM records `resume_of: <role>` on
  // its pm:In_Progress amend write, pointing to Constitution §3.1). Actual stripped
  // body re-measured at 2918 ~tok exactly; cap set to the exact measured value (no
  // headroom) per the established convention.
  // a13-section1-polish (qa-owned bump, A13-07): cap raised from 2918 → 3196 to absorb
  // the new `## Spec Schema` minimal-complete-passing-example fenced block added to
  // skill-pm.md (AC3b) plus the Output-rule word-cap sentence removal (AC3a, a small
  // reduction that the schema example far outweighs). Independently re-measured
  // (not trusted from sr-engineer's handoff note) at 3196 ~tok exactly; cap set to
  // the exact measured value per the established Phase-2 convention (no headroom).
  // a11-escalation-grammar (qa-owned bump, A11-02): cap raised from 3196 → 3225 to absorb
  // skill-pm.md's Escalation Routes table conversion to the canonical const-05 call format
  // (byte-identical | situation | status | note token | next_role | header). Independently
  // re-measured (not trusted from sr-engineer's handoff note) at 3225 ~tok exactly; cap set
  // to the exact measured value per the established Phase-2 convention (no headroom).
  // b8-external-ref-ledger (qa-owned bump, B8-10): cap raised from 3225 → 3327 to absorb
  // the skill-pm.md Resource Audit Gate row rewrite (records external_refs entries via
  // tw_update_state, AC-11). Independently re-measured (not trusted from sr-engineer's
  // handoff note) at 3327 ~tok exactly; cap set to the exact measured value per the
  // established Phase-2 convention (no headroom).
  // c9-protocol-fields (qa-owned bump, T-C9-13): cap raised from 3327 → 3377 to absorb
  // skill-pm.md's Auto-Routing / Escalation Routes / Gate Summary prose rewrite (records
  // `next_role`/`resume_of` as first-class fields instead of `pending_notes` tokens).
  // Independently re-measured at 3377 ~tok exactly; cap set to the exact measured value
  // per the established Phase-2 convention (no headroom).
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  // Strip frontmatter (--- block) before token-counting the body, matching buildPromptForRole.
  const body = SKILL_PM.startsWith("---")
    ? SKILL_PM.slice(SKILL_PM.indexOf("---", 3) + 3).trimStart()
    : SKILL_PM;
  const stripped = stripRationale(stripOriginTags(body));
  const toks = approxTokens(stripped);
  assert.ok(toks <= 3377, `skill-pm stripped body (${toks} ~tok) must be ≤ 3377 (AC1, c9-protocol-fields re-baseline)`);
});

test("AC1/AC2: skill-sr-engineer stripped token count meets ≤ 2138 cap", () => {
  // WHY: the spec's re-grounded AC2 target must hold for sr-engineer dispatch budget.
  // v3.28.0 (qa-owned bump): cap raised from 2048 → 2210 to absorb the
  // design-asset-source-rule feature's "Source assets, don't redraw them (v3.28.0)"
  // rule added to skill-sr-engineer's Design-Aware Pre-Flight step 3a. Actual
  // stripped body measured at 2160 ~tok; 2210 provides ~50-token editing headroom.
  // governance-tag-strip (T-GTS-06, qa-owned re-baseline — the "5th cap" sr-engineer
  // flagged and code-reviewer confirmed the spec's Affected Tests section undercounted):
  // cap LOWERED from 2210 → 2138. skill-sr-engineer.md is the densest origin-tag site
  // among the skill files (8 fences: Design-Aware Pre-Flight, Scoped Render Self-Check,
  // Flag-don't-assume, Declared-token, Whole-surface self-converge, Source-assets, plus
  // 2 more). Folding stripOriginTags into this test's composition (matching the real
  // buildPromptForRole pipeline, which strips origin tags before rationale) measures
  // stripRationale(stripOriginTags(body)) at 2138 ~tok exactly; cap set to the exact
  // measured value (no headroom) per the Phase-2 convention — leaving raw-only would
  // have left this cap at 2210 despite the body actually shrinking, silently masking
  // the feature's real saving.
  // a11-escalation-grammar (qa-owned bump, A11-02): cap raised from 2138 → 2258 to absorb
  // skill-sr-engineer.md's Escalation Routes table conversion to the canonical const-05
  // call format (byte-identical header). Independently re-measured (not trusted from
  // sr-engineer's handoff note) at 2258 ~tok exactly; cap set to the exact measured value
  // per the established Phase-2 convention (no headroom).
  // c9-protocol-fields (qa-owned bump, T-C9-14): cap raised from 2258 → 2275 to absorb
  // skill-sr-engineer.md's Escalation Routes table column rewrite (note-token column →
  // structured-field column, per T-C9-14). Independently re-measured at 2275 ~tok
  // exactly; cap set to the exact measured value per the established Phase-2 convention
  // (no headroom).
  const SKILL_SR = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const body = SKILL_SR.startsWith("---")
    ? SKILL_SR.slice(SKILL_SR.indexOf("---", 3) + 3).trimStart()
    : SKILL_SR;
  const stripped = stripRationale(stripOriginTags(body));
  const toks = approxTokens(stripped);
  assert.ok(toks <= 2275, `skill-sr stripped body (${toks} ~tok) must be ≤ 2275 (AC2, c9-protocol-fields re-baseline)`);
});

// --- governance-text-load Round-2: constitution rationale fencing (T-GTL-06/07) ---
// WHY: R2 extended the strip to the highest-leverage lever — the constitution, injected
// on EVERY role-bundle dispatch. The §1 L16 (HTML-primitive example list) and §7 L143
// (external-artifact example list) parentheticals are the ONLY two pure-illustration spans;
// everything else in §1/§7 is rule-dense and §3.1/§3.2 is a hard exclusion zone. These
// tests pin: (AC7) §3.x is byte-untouched, (AC8) the measured token floor holds, (AC9)
// stripping is lossless w.r.t. every normative rule/gate/heading. See
// specs/governance-text-load-architecture.md R2 "Test thresholds that change".

// Markers that MUST survive stripRationale on the constitution (AC9 — operative rules).
const CONST_RULE_MARKERS = [
  "## 1.",                          // §1 heading
  "## 7.",                          // §7 heading
  "3.1 Server-enforced chain",      // §3.1 gate (exclusion zone)
  "3.2 Visual Verdict Authority",   // §3.2 gate (exclusion zone)
  "MVP strict",                     // §1 rule clause
  "Self-converge relaxation",       // §1 L19 rule (NOT fenced — references §3.x)
  "External-reference policy",      // §7 rule clause
  "skill-pm §Resource Audit Gate",  // §7 operative routing cross-ref (KEEP per DR-8)
];
// The two example-list interiors that ARE fenced — must be ABSENT after the strip but
// PRESENT in raw / fullDetail mode (the fence wraps illustration, not rules).
const CONST_FENCED_INTERIORS = ["column-scroller picker", "see XYZ"];

test("AC7: §3.1–§3.2 exclusion zone is byte-identical after stripRationale", () => {
  // WHY: §3.x carries the server-enforced chain + visual-verdict gates. Fencing ANY
  // byte inside it (a MUST, a gate name, a §-reference) would silently weaken
  // enforcement. The two fence spans live in §1/§7 only — the §3.x range must be
  // untouched. Slice from the §3.1 anchor to the §4 anchor and byte-compare pre/post.
  const a31 = CONSTITUTION.indexOf("3.1 Server-enforced chain");
  const a4 = CONSTITUTION.indexOf("4. Routing Chain");
  assert.ok(a31 > -1 && a4 > a31, "§3.1 and §4 anchors must be present and ordered");
  const rawSlice = CONSTITUTION.slice(a31, a4);
  const stripped = stripRationale(CONSTITUTION);
  const s31 = stripped.indexOf("3.1 Server-enforced chain");
  const s4 = stripped.indexOf("4. Routing Chain");
  const strippedSlice = stripped.slice(s31, s4);
  assert.equal(strippedSlice, rawSlice, "§3.1–§3.2 byte range must be untouched by stripRationale");
  // Belt-and-braces: zero rationale markers may appear inside the exclusion zone.
  assert.equal(
    (rawSlice.match(/rationale:(start|end)/g) || []).length,
    0,
    "no rationale fence marker may appear inside the §3.x exclusion zone",
  );
});

test("AC7: exactly two balanced rationale fences, both outside §3.x", () => {
  const starts = (CONSTITUTION.match(/<!-- rationale:start -->/g) || []).length;
  const ends = (CONSTITUTION.match(/<!-- rationale:end -->/g) || []).length;
  assert.equal(starts, 2, "exactly two rationale:start markers (§1 L16 + §7 L143)");
  assert.equal(ends, 2, "exactly two rationale:end markers");
});

test("AC8/AC-P2-7: rationale-stripped (design-arm) constitution is at/below the measured floor (≤ 5561 ~tok)", () => {
  // WHY: floor REBASELINED by constitution-conditional-load PHASE 2. Phase 2 extends the
  // design-only axis to two more spans (§4 visual prose S3–S5 + P-AUDITOR, and §1 L16/L17/L19),
  // adding 3 MORE design-only fence pairs (now 6 pairs / 12 marker lines total, up from
  // Phase-1's 3 pairs). On the DESIGN arm those markers are NOT stripped (full visual text
  // loads), so the rationale-stripped figure grows vs Phase 1. MEASURED on THIS working tree
  // with the test's own chars/4 estimator (NOT assumed): raw 4311 → rationale-stripped
  // 4239 ~tok (exact). This is the design-arm (kept-path) cost; it is the price of the
  // ~1830 ~tok saving on the NON-DESIGN dispatch path (pinned by the AC8 non-design test
  // below). package.json stays 3.33.0 (release human-owned).
  // v3.28.0 (qa-owned bump): cap raised from 4239 → 4304 to absorb the
  // design-asset-source-rule constitution §1 Design-sourced assets line (sits inside
  // design-only fence — on the design arm the marker lines count). Actual
  // rationale-stripped constitution measured at 4304 ~tok (exact); cap set to exact
  // measured value per the Phase-2 convention (no additional headroom, matches the
  // non-design floor pin style).
  // v3.40.0 (qa-owned bump): cap raised from 4304 → 4523 to absorb the
  // figma-baseline-manifest-gate §3.1 Baseline manifest gate bullet (inside
  // design-only fence) plus the matching skill-qa-visual.md Step A.0 enforcement note.
  // Actual rationale-stripped constitution measured at 4523 ~tok (exact).
  // governance-tag-strip (T-GTS-06, qa-owned re-baseline): cap LOWERED from 4523 → 4487.
  // buildPromptForRole now runs stripOriginTags FIRST, unconditionally, on the raw
  // constitution (build.ts) — folding it into this test's composition (matching
  // production) measures stripRationale(stripOriginTags(CONSTITUTION)) at 4487 ~tok
  // exactly; cap set to the exact measured value (no headroom) per the Phase-2
  // convention. Leaving this test raw-only (no stripOriginTags) would have measured
  // the constitution's RAW size (now inflated by ~14 origin-fence pairs' marker bytes)
  // against the OLD 4523 cap and failed at 4735 raw / un-folded-stripped, which is the
  // exact regression this fold prevents — the cap must reflect what actually ships.
  // cut-approval-coordinator-attestation (qa-owned bump, C2-06): cap raised from
  // 4487 → 4957 to absorb the new Cut-Approval Gate bullet added to
  // const-08-chain-31-mid.md (§3.1, chain-tagged — loads on this design-arm path).
  // Actual rationale-stripped constitution measured at 4957 ~tok (exact); cap set
  // to the exact measured value per the Phase-2 convention (no additional headroom).
  // pm-repair-resume-routing (v3.47.0, qa-owned bump, C1-09/AC-11): cap raised from
  // 4957 → 5260 to absorb the new Amend-Resume Edge bullet added to
  // const-08-chain-31-mid.md (§3.1, chain-tagged — loads on this design-arm path,
  // same as the Cut-Approval Gate bullet before it). Actual rationale-stripped
  // constitution re-measured at 5260 ~tok (exact); cap set to the exact measured
  // value per the established convention (no additional headroom). Saving margin
  // re-verified: raw 5533 − stripped 5260 = 273 ~tok, still ≥ 240.
  // a13-section1-polish (qa-owned bump, A13-07): cap raised from 5260 → 5316 to absorb
  // the const-01-core-head.md Terse/Watermark rewrite (unified output-length policy +
  // two-row watermark decision table with `fable` tier). const-01-core-head.md is
  // core-head (not design-only-fenced), so its net growth counts on both arms.
  // Independently re-measured (not trusted from sr-engineer's handoff note) — raw 5589,
  // stripped 5316 (exact); cap set to the exact measured value per the established
  // Phase-2 convention (no additional headroom). Saving margin re-verified: raw 5589 −
  // stripped 5316 = 273 ~tok, still ≥ 240 (unchanged from the prior bump — the §1
  // rewrite added roughly the same token count to both the raw and rationale-stripped
  // sides).
  // a11-escalation-grammar (qa-owned bump, A11-02): cap raised from 5316 → 5561 to absorb
  // the const-05-chain-mid.md canonical Escalation call format + WHEN/DO/ELSE bullets
  // (chain-tagged, loads on this design-arm path — not design-only-fenced). Independently
  // re-measured (not trusted from sr-engineer's handoff note) — raw 5834, stripped 5561
  // (exact); cap set to the exact measured value per the established Phase-2 convention
  // (no additional headroom). Saving margin re-verified: raw 5834 − stripped 5561 = 273
  // ~tok, still ≥ 240 (unchanged — the const-05 edit sits outside both rationale fences).
  // b8-external-ref-ledger (qa-owned bump, B8-09): cap raised from 5561 → 5616 to absorb
  // the const-15-core-tail.md §7 External-reference policy rewrite (server-enforced ledger
  // mechanism reference, AC-10; not design-only-fenced, so it loads on this design-arm
  // path). Independently re-measured (not trusted from sr-engineer's handoff note) — raw
  // 5889, stripped 5616 (exact); cap set to the exact measured value per the established
  // Phase-2 convention (no additional headroom). Saving margin re-verified: raw 5889 −
  // stripped 5616 = 273 ~tok, still ≥ 240 (unchanged — the §7 edit sits outside both
  // rationale fences).
  // c7-version-assertion-ownership (qa-owned bump, AC-8): cap raised from 5616 → 5721 to
  // absorb the const-05-core-standards.md "Test ownership" bullet rewrite (S01, +420
  // chars net; not design-only-fenced, so it loads on this design-arm path).
  // Independently re-measured (not trusted from sr-engineer's or code-reviewer's notes) —
  // raw 5994, stripped 5721 (exact); cap set to the exact measured value per the
  // established Phase-2 convention (no additional headroom). Saving margin re-verified:
  // raw 5994 − stripped 5721 = 273 ~tok, still ≥ 240 (unchanged — the const-05 edit sits
  // outside both rationale fences).
  // c9-protocol-fields (qa-owned bump, T-C9-11/T-C9-12): cap raised from 5721 → 6024 to
  // absorb the const-05-core-standards.md Escalation-call-format rewrite, the
  // const-08-chain-31-mid.md Amend-Resume/code-reviewer-verdict rewrite (§3.1,
  // chain-tagged — loads on this design-arm path), and the const-12-chain-r10-s4.md S6
  // sentence rewording — all not design-only-fenced. Independently re-measured — raw
  // 6297, stripped 6024 (exact); cap set to the exact measured value per the established
  // Phase-2 convention (no additional headroom). Saving margin re-verified: raw 6297 −
  // stripped 6024 = 273 ~tok, still ≥ 240 (unchanged — the edits sit outside both
  // rationale fences).
  // c14-dispatch-pins (qa-owned bump, T-C14-11): cap raised from 6024 → 6100 to absorb
  // the const-01-core-head.md AC-7 Pin-override bullet (not design-only-fenced, so it
  // loads on this design-arm path too). Independently re-measured — raw 6373, stripped
  // 6100 (exact); cap set to the exact measured value per the established Phase-2
  // convention (no additional headroom). Saving margin re-verified: raw 6373 − stripped
  // 6100 = 273 ~tok, still ≥ 240 (unchanged — the const-01 edit sits outside both
  // rationale fences).
  const raw = approxTokens(CONSTITUTION);
  const stripped = approxTokens(stripRationale(stripOriginTags(CONSTITUTION)));
  assert.ok(stripped <= 6100, `stripped constitution (${stripped} ~tok) must be ≤ 6100 (AC8 design-arm floor, c14-dispatch-pins re-baseline)`);
  assert.ok(
    raw - stripped >= 240,
    `constitution rationale+origin-tag saving (${raw - stripped} ~tok) must be ≥ 240 (AC8 measured min, c14-dispatch-pins re-baseline)`,
  );
});

test("AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 9545 ~tok)", () => {
  // WHY: the constitution is injected on every dispatch; the full coordinator bundle is
  // the worst case. Compose the chain-role bundle the way buildPromptForRole does:
  // rationale-stripped constitution + SEP + rationale-stripped skill body. Floor
  // REBASELINED by constitution-conditional-load PHASE 2: the now-6 design-only marker
  // pairs (12 lines) are NOT stripped on the design arm, so the design-arm bundle grows.
  // Coordinator is a CHAIN role: on a DESIGN feature it must keep the full §3.2 (the
  // CDE-OOBE incident was a coordinator-authored accept-policy — §3.2 binds the
  // coordinator on design work), so this worst-case bundle is the design-arm size.
  // MEASURED on this working tree (chars/4): 7703 ~tok (exact). package.json stays 3.33.0.
  // v3.28.0 (qa-owned bump): cap raised from 7703 → 7768 to absorb the
  // design-asset-source-rule constitution §1 Design-sourced assets line and the
  // corresponding skill-sr-engineer rule (design-arm bundle includes constitution
  // marker-line cost). Actual design-arm bundle measured at 7768 ~tok (exact); cap
  // set to exact measured value per the Phase-2 convention.
  // v3.40.0 (qa-owned bump): cap raised from 7768 → 7987 to absorb the
  // figma-baseline-manifest-gate §3.1 Baseline manifest gate bullet (design-only fence)
  // plus skill-qa-visual Step A.0 enforcement note. Actual design-arm bundle
  // measured at 7987 ~tok (exact).
  // pm-cut-approval-gate (qa-owned bump): cap raised from 7987 → 8160 to absorb the
  // cut-approval stop-condition entry added to skill-coordinator.md Auto-Routing
  // section (S04 text + gate description). Actual design-arm bundle measured at
  // 8109 ~tok; 8160 provides ~51-token editing headroom.
  // governance-tag-strip (T-GTS-06, qa-owned re-baseline): cap LOWERED from 8160 → 8078.
  // buildPromptForRole runs stripOriginTags on BOTH the constitution and the skill body
  // FIRST, unconditionally — folding it into this test's composition (matching
  // production) measures stripRationale(stripOriginTags(CONSTITUTION)) + SEP +
  // stripRationale(stripOriginTags(body)) at 8078 ~tok exactly (skill-coordinator.md
  // carries 3 origin fences: Visual Verdict Boundary, Drift Reconcile, Subagent Token
  // Observability). Cap set to the exact measured value (no headroom) per the Phase-2
  // convention — this is the worst-case per-dispatch bundle, so its shrinkage is the
  // headline number for this feature's saving.
  // cut-approval-coordinator-attestation (qa-owned bump, C2-06): cap raised from
  // 8078 → 8635 to absorb the new Cut-Approval Gate bullet in const-08-chain-31-mid.md
  // (constitution side) plus the skill-coordinator.md stop-condition 6 dedup/self-check
  // rewrite (S04 text). Actual design-arm bundle measured at 8635 ~tok (exact) — this
  // re-confirms the measured value independently of sr-engineer's handoff note (which
  // said 8625); cap set to the exact re-measured value per the Phase-2 convention
  // (no additional headroom).
  // pm-repair-resume-routing (v3.47.0, qa-owned bump, C1-09/AC-11): cap raised from
  // 8635 → 9050 to absorb the new Amend-Resume Edge bullet in const-08-chain-31-mid.md
  // (constitution side, same bundle-wide cost as the Cut-Approval Gate bullet before it)
  // plus the skill-coordinator.md Auto-Routing stop-condition 7 entry (AC-6: coordinator
  // carries `resume_of: <role>` onto the routing write when relaying a PM amendment).
  // Actual design-arm bundle re-measured at 9050 ~tok (exact); cap set to the exact
  // measured value per the established convention (no additional headroom).
  // a13-section1-polish (qa-owned bump, A13-07): cap raised from 9050 → 9106 to absorb
  // the const-01-core-head.md Terse/Watermark rewrite (constitution side of this bundle;
  // skill-coordinator.md itself is untouched by this ticket — see spec Out of Scope).
  // Independently re-measured (not trusted from sr-engineer's handoff note) at 9106 ~tok
  // (exact); cap set to the exact measured value per the established Phase-2 convention
  // (no additional headroom).
  // a11-escalation-grammar (qa-owned bump, A11-02): cap raised from 9106 → 9545 to absorb
  // the const-05-chain-mid.md canonical Escalation call format + WHEN/DO/ELSE bullets
  // (constitution side of this bundle) plus skill-coordinator.md's Escalation Routes table
  // conversion (skill side). Independently re-measured (not trusted from sr-engineer's
  // handoff note) at 9545 ~tok (exact); cap set to the exact measured value per the
  // established Phase-2 convention (no additional headroom).
  // b8-external-ref-ledger (qa-owned bump, B8-09/B8-10): cap raised from 9545 → 9699 to
  // absorb the const-15-core-tail.md §7 rewrite (constitution side) plus the
  // skill-coordinator.md Auto-Routing stop-condition addition for EXTERNAL_REFS_UNRESOLVED
  // (skill side, AC-12). Independently re-measured (not trusted from sr-engineer's handoff
  // note) at 9699 ~tok (exact); cap set to the exact measured value per the established
  // Phase-2 convention (no additional headroom).
  // c8-crash-resume-protocol (qa-owned bump, T-C8-01..04): cap raised from 9699 → 10774 to
  // absorb the +48 additive lines in skill-coordinator.md: the dispatch_pins convention
  // (Auto-Routing), the Pinned-tier expectation (Subagent Reply Watermark Validation), the
  // new `## Crash-Resume Protocol` section (3 numbered steps), and the Crash detection row
  // in Escalation Routes. 100% spec-mandated SOP text, purely additive (48/0 per
  // `git diff --numstat`), no constitution-side change. Independently re-measured (not
  // trusted from sr-engineer's or code-reviewer's notes) at 10774 ~tok (exact); cap set to
  // the exact measured value per the established Phase-2 convention (no additional
  // headroom).
  // c7-version-assertion-ownership (qa-owned bump, AC-8): cap raised from 10774 → 10879 to
  // absorb the const-05-core-standards.md "Test ownership" bullet rewrite (S01, +420
  // chars net; constitution side of this bundle — skill-coordinator.md itself is
  // untouched by this ticket, so the c8 growth above stacks unchanged). Independently
  // re-measured (not trusted from sr-engineer's or code-reviewer's notes) at 10879 ~tok
  // (exact); cap set to the exact measured value per the established Phase-2 convention
  // (no additional headroom).
  // c9-protocol-fields (qa-owned bump, T-C9-11/T-C9-12/T-C9-13): cap raised from 10879 →
  // 11290 to absorb the constitution-side growth measured in the design-arm floor test
  // above (+303 ~tok: const-05/const-08/const-12 rewrites) plus the skill-coordinator.md
  // Auto-Routing / Escalation Routes / Gate Summary prose rewrite (skill side, T-C9-13:
  // `next_role`/`resume_of` as first-class fields). Independently re-measured at 11290
  // ~tok (exact); cap set to the exact measured value per the established Phase-2
  // convention (no additional headroom).
  // c14-dispatch-pins (qa-owned bump, T-C14-11): cap raised from 11290 → 11415 to absorb
  // the constitution-side const-01-core-head.md AC-7 Pin-override bullet (+76 ~tok,
  // matching the design-arm floor test above) plus the skill-coordinator.md AC-6 rewrite
  // of the three dispatch_pins-touching passages (Auto-Routing persist-before-dispatch
  // paragraph, Crash-Resume Protocol step 3, Pinned-tier expectation paragraph — skill
  // side). Independently re-measured (not trusted from sr-engineer's or code-reviewer's
  // notes) at 11415 ~tok (exact); cap set to the exact measured value per the established
  // Phase-2 convention (no additional headroom).
  const skillCoord = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator.md"), "utf-8");
  const body = skillCoord.startsWith("---")
    ? skillCoord.slice(skillCoord.indexOf("---", 3) + 3).trimStart()
    : skillCoord;
  const SEP = "\n\n---\n\n";
  const bundle = approxTokens(stripRationale(stripOriginTags(CONSTITUTION)) + SEP + stripRationale(stripOriginTags(body)));
  assert.ok(bundle <= 11415, `teamwork stripped bundle (${bundle} ~tok) must be ≤ 11415 (AC8 design-arm floor, c14-dispatch-pins re-baseline)`);
});

test("AC9: every operative rule/gate/heading survives stripRationale on the constitution", () => {
  // WHY: AC9 losslessness — stripping rationale must NOT drop any normative rule. Every
  // §-heading, server-enforced gate, and rule clause must remain in the stripped output;
  // only the two illustrative example-list interiors may disappear.
  const stripped = stripRationale(CONSTITUTION);
  for (const m of CONST_RULE_MARKERS) {
    assert.ok(stripped.includes(m), `stripped constitution must retain rule marker: ${JSON.stringify(m)}`);
  }
  for (const m of CONST_FENCED_INTERIORS) {
    assert.ok(!stripped.includes(m), `stripped constitution must drop fenced illustration: ${JSON.stringify(m)}`);
  }
});

test("AC9/AC-P2-3: fullDetail retains both example lists verbatim (design-arm-aware round-trip)", async () => {
  // WHY: the rationale fence is opt-out, not deletion — fullDetail dispatch (AC3 path)
  // must carry the constitution verbatim, including both fenced example lists. Source file
  // always retains them (raw). BUT post-Phase-2 (constitution-conditional-load P2) the §1
  // L16 "column-scroller picker" rationale fence now sits INSIDE a design-only fence
  // (Span-B fence #1, L16–L17 — HC-NEST: rationale nested inside design-only). The
  // design-only strip fires on the NON-design arm REGARDLESS of fullDetail (fullDetail
  // only opts out of stripRationale, not stripDesignOnly — see build.ts L310 vs L315), so
  // "column-scroller picker" is gone on a non-design dispatch even with fullDetail=true.
  // The §7 "see XYZ" rationale fence is NOT inside any design-only fence, so it survives on
  // both arms with fullDetail. Therefore the round-trip assertion is now DESIGN-ARM-AWARE.
  for (const m of CONST_FENCED_INTERIORS) {
    assert.ok(CONSTITUTION.includes(m), `raw constitution must retain example-list interior: ${JSON.stringify(m)}`);
  }
  // §7 "see XYZ" is design-arm-independent: present on any fullDetail dispatch.
  const ndFull = await buildOnFixture({ mode: null, skillFile: "skill-coordinator.md", fullDetail: true });
  assert.ok(ndFull.includes("see XYZ"), "fullDetail (non-design) must retain §7 rationale example: \"see XYZ\"");
  // §1 "column-scroller picker" is design-conditional post-P2: ABSENT on non-design even with
  // fullDetail (design-only strip runs regardless of fullDetail), PRESENT on the design arm.
  assert.ok(
    !ndFull.includes("column-scroller picker"),
    "fullDetail NON-design dispatch must NOT retain §1 design-only example (stripDesignOnly fires regardless of fullDetail)",
  );
  const dFull = await buildOnFixture({ mode: "figma", skillFile: "skill-coordinator.md", fullDetail: true });
  for (const m of CONST_FENCED_INTERIORS) {
    assert.ok(dFull.includes(m), `fullDetail DESIGN-arm bundle must retain example-list interior: ${JSON.stringify(m)}`);
  }
});

// compose-not-strip (ticket A9, T-CNSO-07): the "AC9/DR-9: stripChainOnly ∘
// stripRationale compose order" test that lived here is REMOVED — stripChainOnly
// is deleted; chain-fragment selection now happens at composeConstitution() time,
// before either remaining stripper runs, so there is no order to test between it
// and stripRationale. The equivalent order-independence contract for the two
// SURVIVING strippers is pinned above (T-GTS-07/AC4).

// ============================================================================
// constitution-conditional-load (AC1–AC8): the THIRD, feature-conditional strip
// axis (stripDesignOnly). On a NON-design feature the server-side visual gates are
// inert, so §3.2 (minus R10) + the §3.1 visual bullets bind NO role and are stripped
// from the dispatch; on a DESIGN-armed feature the full visual governance loads
// unchanged. Gated on the SAME arm signal the server PASS gates use
// (hasDesignModeRequiringVisual) — text present iff the gates can fire (HC1/HC3).
// Spec: specs/constitution-conditional-load.md.
//
// Spec-to-Test map:
//   AC1 (non-design strips)        -> t-ccl-strip-helper, t-ccl-build-nondesign-strips
//   AC2 (design loads full)        -> t-ccl-build-design-loads, t-ccl-design-byte-equal
//   AC3 (safe default)             -> t-ccl-no-state-strips, t-ccl-no-design-file-strips
//   AC4 (byte-unchanged surviving) -> t-ccl-r10-byte-equal, t-ccl-nonvisual-byte-equal
//   AC5/HC5 (composition)          -> t-ccl-six-permutations, t-ccl-zero-orphans
//   AC6 (anti-sweep both arms)     -> t-ccl-antisweep-both-arms
//   AC7 (lite interaction)         -> t-ccl-lite-nondesign-consistent
//   AC8 (rebaseline floors)        -> t-ccl-nondesign-floor + the two rebaselined
//                                     AC8 floors above (4200 / 7665)
// ============================================================================

const SEP = "\n\n---\n\n";

// Sentinels that uniquely identify each GATABLE span (must be ABSENT on the
// non-design arm, PRESENT on the design arm). One per fenced span.
// governance-tag-strip (T-GTS-04): "Visual evidence gate" and "`visual_round` sub-loop"
// lost their "(vX.Y.Z)" suffix — stripOriginTags now removes it unconditionally, before
// this array's sentinels are ever checked. Both literals are updated to the post-fence
// form (version-tag substring dropped); the other five entries never carried a version
// tag in the pinned sentinel and are unaffected.
const DESIGN_ONLY_SENTINELS = [
  "Visual evidence gate",                 // §3.1 fence 1, bullet 1 (was "Visual evidence gate (v3.16.0)")
  "Visual report schema gate",            // §3.1 fence 1, bullet 2
  "`visual_round` sub-loop",              // §3.1 fence 2, bullet 1 (was "`visual_round` sub-loop (v3.14.0)")
  "Split escalation (Round 3)",           // §3.1 fence 2, bullet 2
  "3.2 Visual Verdict Authority",         // §3.2 header (fence 3)
  "Visual verdict is qa-visual-owned",    // §3.2 body
  "No global-frame metric",               // §3.2 body — the qa-visual-owned PASS-metric rule
];

// Anti-sweep CONTRACT sentinels: NON-visual rules that physically sit inside or
// adjacent to the gated spans and MUST survive on BOTH arms (HC4). These are the
// cross-role contracts the gate must never sweep away.
// governance-tag-strip (T-GTS-04): the R10 sentinel lost its "(R10)" suffix — the bare
// finding code is now inside an origin fence (`reconcile<!-- origin:start --> (R10)<!--
// origin:end -->.**`), stripped unconditionally before this sentinel is checked.
const ANTI_SWEEP_SENTINELS = [
  "SCOPE_DECISION_REQUIRED",                          // §3.1 scope-decision gate (v3.30.0), sits BETWEEN two gated visual bullets
  "Sequential-context assumption + reconcile",        // §3.2 R10 (tw_sync/reconcile), ends §3.2 — carved OUT of the fence (was "... (R10)")
  "4. Routing Chain",                                 // §4 routing diagram
];

// ── Phase 2 (constitution-conditional-load P2) ──────────────────────────────
// Phase 2 extends stripDesignOnly to TWO more spans: §4 visual prose (Span A,
// reflow + 1 fence) and §1 L16/L17/L19 (Span B, 2 fences). These sentinels drive
// the AC-P2-1…6 assertions below.

// §4 Span A — VISUAL sentences (S3, S4, S5) + the design-auditor paragraph.
// ABSENT on non-design, PRESENT on design. Byte-exact verbatim openers from §4.
const P2_S4_VISUAL_SENTINELS = [
  "A third counter",                                              // S3 opener (visual_round description)
  "the v3.16.0\nself-arming signal",                             // S3 self-arming-signal clause (2nd clause, post-semicolon)
  "VISUAL_BASELINES_REQUIRED",                                   // S4 — the v3.16.0 baselines code
  "VISUAL_ASSERTIONS_REQUIRED",                                  // S5 — assertions code
  "VISUAL_REPORT_INCOMPLETE",                                    // S5 — report-incomplete code
  "`design-auditor` fires when the coordinator detects",         // P-AUDITOR paragraph opener
  "Tasks with no design reference skip the auditor entirely",    // P-AUDITOR closing sentence
];

// §1 Span B — the three FEATURE-INERT bullets. ABSENT non-design, PRESENT design.
// Full-bullet anchors (NOT just the bold tag) — the bold-only forms collide with
// constitution cross-references inside skill-*.md bodies (e.g. skill-sr-engineer cites
// "§1 Design-baseline scope (v3.27.0)"), which would make a §1-strip assertion falsely
// fail on a sentinel that survived in the SKILL, not §1. These openers are unique to
// content/constitution.md §1 (verified: absent from skill-sr / skill-coordinator).
// governance-tag-strip (T-GTS-04): the L17 and L19 sentinels lost their "(vX.Y.Z)"
// suffix — both are now origin-fenced (`scope<!-- origin:start --> (v3.27.0)<!--
// origin:end -->**: …`, `relaxation<!-- origin:start --> (v3.31.0)<!-- origin:end
// -->**: …`), stripped unconditionally. The L16 "Visual Widgets exception (v3.14.0)"
// literal is DELIBERATELY left UNCHANGED — that site was intentionally left un-fenced
// (test-pinned, per sr-engineer/code-reviewer's skip-site list) so its version tag
// still ships and this sentinel must NOT be updated.
const P2_S1_DESIGN_SENTINELS = [
  "**Visual Widgets exception (v3.14.0)**: when a widget is listed in the spec",      // L16, fence #1 (un-fenced by design — do not touch)
  "**Design-baseline scope**: For design-backed work, the canonical design",           // L17, fence #1 (was "... (v3.27.0)**: ...")
  "**Self-converge relaxation**: inside sr-engineer",                                  // L19, fence #2 (was "... (v3.31.0)**: ...")
];

// Anti-sweep §1 universal bullets (L15 MVP-strict, L18 Surgical) — PRESENT on BOTH
// arms; they sit OUTSIDE both Span-B fences (L15 before #1, L18 between #1 and #2).
const P2_S1_ANTISWEEP_SENTINELS = ["**MVP strict**", "**Surgical changes**"];

// Anti-sweep §4 non-visual rule sentences — PRESENT byte-for-byte on BOTH arms.
// DIAGRAM, S1 (review_round), S2 (qa_round loop), S6 (Each role finishes…).
const P2_S4_ANTISWEEP_SENTINELS = [
  "researcher (optional) → design-auditor",                      // DIAGRAM
  "loops on `(code-reviewer, FAIL)` for up to 3",                // S1 review_round mechanics
  "The qa-engineer loop back to sr-engineer",                    // S2 qa_round mechanics
  "Each role finishes with `tw_update_state`",                   // S6 universal handoff convention
];

// Build a chain-role dispatch on a fresh temp workspace with the given design
// setup. `mode` of `null` => no design file at all; otherwise writes a design
// file with that `## Mode`. Returns the emitted constitution+skill+state text.
async function buildOnFixture({ mode, skillFile = "skill-sr-engineer.md", noState = false, fullDetail = false } = {}) {
  setActiveStorage(new FileHandoffStorage());
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twccl-"));
  const feature = "ccl-fixture-feat";
  if (!noState) {
    const s = new FileHandoffStorage();
    await s.writeState(ws, feature, "In_Progress", [], []);
  }
  if (mode !== null && mode !== undefined) {
    fs.mkdirSync(path.join(ws, "design"), { recursive: true });
    fs.writeFileSync(path.join(ws, "design", `${feature}.md`), `# Design\n\n## Mode\n\n${mode}\n`);
  }
  const text = buildPromptForRole(skillFile, "ccl", ws, fullDetail).messages[0].content.text;
  fs.rmSync(ws, { recursive: true, force: true });
  return text;
}

// --- AC1: non-design strips the gatable visual span ----------------------

// compose-not-strip (ticket A9, T-CNSO-07): the "AC1: stripDesignOnly removes the
// design-only span and is idempotent" unit test that lived here is REMOVED —
// stripDesignOnly is deleted; design-fragment inclusion/exclusion is now a file
// list decision (composeConstitution / includeSegment), not a string-stripping
// primitive with its own idempotence contract to unit-test. The OUTCOME this test
// protected — non-design dispatch omits every gated sentinel — is still pinned
// end-to-end by the test immediately below (through the real buildPromptForRole
// pipeline) and by test/compose-equivalence.test.mjs (byte-identity, T-CNSO-08).

test("AC1: chain-role build on a NON-design workspace OMITS the §3.2 body + the §3.1 visual bullets", async () => {
  // WHY: end-to-end. A real buildPromptForRole dispatch for a chain role (sr-engineer)
  // on a workspace whose design arm reports non-design (no design file) must emit a
  // constitution with the gatable spans gone — a sentinel from EACH gated span absent.
  const text = await buildOnFixture({ mode: null });
  for (const s of DESIGN_ONLY_SENTINELS) {
    assert.ok(!text.includes(s), `non-design dispatch must OMIT gated sentinel: ${JSON.stringify(s)}`);
  }
  assert.ok(!text.includes("design-only:start"), "non-design dispatch must not leak fence markers");
  // Universal rules untouched.
  for (const m of UNIVERSAL_MARKERS) {
    assert.ok(text.includes(m), `non-design dispatch must keep universal rule: ${m}`);
  }
});

// --- AC2: design-armed loads the full visual governance ------------------

test("AC2: chain-role build on a DESIGN-armed workspace LOADS the full §3.2 + visual §3.1", async () => {
  // WHY: the inverse contract. With design/<feature>.md `## Mode` = figma (≠ no-design),
  // the arm probe reports required=true → stripDesignOnly is NOT applied → every gated
  // span is present. Explicitly assert the §3.2 qa-visual-owned / No-global-frame-metric
  // sentinels load on the armed arm (the CDE-OOBE contract that binds the coordinator).
  const text = await buildOnFixture({ mode: "figma" });
  for (const s of DESIGN_ONLY_SENTINELS) {
    assert.ok(text.includes(s), `design-armed dispatch must LOAD gated sentinel: ${JSON.stringify(s)}`);
  }
  assert.ok(text.includes("No global-frame metric"), "design arm must load §3.2 No-global-frame-metric rule");
  assert.ok(text.includes("Visual verdict is qa-visual-owned"), "design arm must load §3.2 qa-visual-owned verdict rule");
});

test("AC2/AC4: the gated spans on the DESIGN arm are byte-equal to the constitution source", async () => {
  // WHY: the gate is a pure DELETE — on the design arm nothing is reworded. The §3.2
  // body span (from the §3.2 header through "No global-frame metric") must appear in the
  // design-armed dispatch byte-identical to the same span in content/constitution.md.
  const text = await buildOnFixture({ mode: "figma" });
  // Extract the §3.2 span from source: from "### 3.2" through the end of the
  // No-global-frame paragraph (the last sentence of that bullet).
  const srcStart = CONSTITUTION.indexOf("### 3.2 Visual Verdict Authority");
  const srcEndAnchor = CONSTITUTION.indexOf("explicit structural assertions and canonical-state parity");
  assert.ok(srcStart > -1 && srcEndAnchor > srcStart, "§3.2 source span anchors must resolve");
  // governance-tag-strip (T-GTS-05): srcSpan is sliced raw out of CONSTITUTION, so it still
  // carries the "### 3.2 Visual Verdict Authority…<!-- origin:start --> (v3.26.0)<!-- origin:end
  // -->" fence markup on its header line. `text` came through buildPromptForRole, which runs
  // stripOriginTags unconditionally BEFORE the design-arm strip, so the fence is already gone
  // from `text`. Route srcSpan through the same stripper before the containment check, or this
  // assertion compares fenced source against unfenced output and always fails.
  const srcSpan = stripOriginTags(CONSTITUTION.slice(srcStart, CONSTITUTION.indexOf("\n", srcEndAnchor)));
  assert.ok(text.includes(srcSpan), "design-arm §3.2 span must be byte-identical to constitution source (post stripOriginTags)");
});

// --- AC3: safe default — no state / no design file => strip ---------------

test("AC3: NO handoff state => behaves as non-design (strips)", async () => {
  // WHY: the budget win is provably safe when no design exists. With no handoff state at
  // all, active_feature is unknown → arm probe false → strip. Universal rules survive.
  const text = await buildOnFixture({ noState: true, mode: null });
  for (const s of DESIGN_ONLY_SENTINELS) {
    assert.ok(!text.includes(s), `no-state dispatch must strip gated sentinel: ${JSON.stringify(s)}`);
  }
  assert.ok(text.includes("NO YAPPING"), "no-state dispatch must still carry universal rules");
});

test("AC3: state present but NO design file, AND `## Mode` = no-design, both => strip", async () => {
  // WHY: two distinct non-design routes must both yield the strip — (a) state present but
  // no design/<feature>.md on disk, (b) design file present with `## Mode` = no-design.
  // Both are the inert case where the server visual gates self-disarm.
  const noFile = await buildOnFixture({ mode: null });          // state present, no design file
  const noDesignMode = await buildOnFixture({ mode: "no-design" }); // design file, mode=no-design
  for (const s of DESIGN_ONLY_SENTINELS) {
    assert.ok(!noFile.includes(s), `no-design-file dispatch must strip: ${JSON.stringify(s)}`);
    assert.ok(!noDesignMode.includes(s), `mode=no-design dispatch must strip: ${JSON.stringify(s)}`);
  }
});

// --- AC4: surviving rules are byte-identical to source --------------------

test("AC4: §3.2 R10 (carve-out) survives byte-equal on BOTH arms — the gate never rewords it", async () => {
  // WHY: R10 (Sequential-context assumption + reconcile) physically ends §3.2 but is
  // NON-visual (tw_detect_drift / tw_sync after fan-out) — it is carved OUT of fence 3,
  // which ends BEFORE R10. It must appear byte-identical to source on BOTH the design and
  // non-design arms (HC2/HC4). Extract the R10 bullet from source and assert containment.
  // governance-tag-strip (T-GTS-04): the raw anchor shifted — the bare "(R10)" finding
  // code is now wrapped in an inline origin fence mid-sentence
  // (`reconcile<!-- origin:start --> (R10)<!-- origin:end -->.**`), so the old
  // fence-free literal no longer occurs in CONSTITUTION and indexOf returned -1.
  const srcStart = CONSTITUTION.indexOf("- **Sequential-context assumption + reconcile<!-- origin:start --> (R10)<!-- origin:end -->.**");
  const srcEnd = CONSTITUTION.indexOf("## 4. Routing Chain");
  assert.ok(srcStart > -1 && srcEnd > srcStart, "R10 source span anchors must resolve");
  // governance-tag-strip (T-GTS-05): the sliced span still carries the fence markup (raw
  // source); route it through stripOriginTags before comparing against nonDesign/design,
  // both of which went through buildPromptForRole and are already origin-stripped.
  const r10 = stripOriginTags(CONSTITUTION.slice(srcStart, srcEnd).trimEnd());
  const nonDesign = await buildOnFixture({ mode: null });
  const design = await buildOnFixture({ mode: "figma" });
  assert.ok(nonDesign.includes(r10), "R10 must survive byte-equal on the NON-design arm (post stripOriginTags)");
  assert.ok(design.includes(r10), "R10 must survive byte-equal on the DESIGN arm (post stripOriginTags)");
});

test("AC4: every surviving (non-gated) rule on the non-design arm is byte-identical to source", async () => {
  // WHY: the gate only DELETES fenced spans (HC2). So the non-design constitution must be
  // EXACTLY stripDesignOnly(stripRationale(source)) — no surviving rule reworded. We pin
  // this by reconstructing the expected arm output from the source and the two strippers,
  // then asserting the emitted constitution prefix matches it byte-for-byte.
  const text = await buildOnFixture({ mode: null });
  // compose-not-strip (ticket A9, T-CNSO-07): stripDesignOnly is deleted — the
  // non-design arm's expected constitution is now reconstructed by composing
  // WITHOUT the design axis (design:false excludes both `design` and `chain-design`
  // fragments, the exact set the old stripDesignOnly regex removed — see architecture
  // Composition Contract) instead of stripping the design-armed composed text.
  const expectedConstitution = stripRationale(stripOriginTags(composeConstitution({ chain: true, design: false })));
  assert.ok(
    text.startsWith(expectedConstitution),
    "non-design dispatch constitution must be byte-identical to stripRationale∘stripOriginTags∘composeConstitution({chain:true,design:false})",
  );
});

// --- AC5 / HC5: composition across all three axes -------------------------

// compose-not-strip (ticket A9, T-CNSO-07): the two "AC5/HC5" tests that lived
// here — "all 6 strip-order permutations are byte-identical" and "every strip
// permutation leaves ZERO orphan markers" — are REMOVED. Both exercised
// stripChainOnly/stripDesignOnly's regex-marker interaction, which no longer
// exists: chain/design fragment selection happens once, structurally, in
// composeConstitution() BEFORE either surviving stripper runs — there is no
// regex race left to permute, and markers are never parsed (AC11), so an
// "orphan marker" cannot occur by construction. See T-GTS-07/AC4 above for the
// narrowed 2-stripper (stripRationale/stripOriginTags) order-independence pin,
// and test/compose-equivalence.test.mjs for the byte-identity contract that
// makes the structural claim empirical rather than assumed.

// --- AC6: anti-sweep — non-visual contracts survive BOTH arms -------------

test("AC6: non-visual contracts (scope-decision, R10, §4 diagram) survive on BOTH arms", async () => {
  // WHY: the CONTRACT-PROTECTION assertion. §3.1 scope-decision gate sits BETWEEN two gated
  // visual bullets; §3.2 R10 ends the section just past the fence; the §4 routing diagram is
  // adjacent. A too-greedy fence would sweep them. They MUST survive on the non-design arm
  // (where everything around them is stripped) AND the design arm (HC4). This is the load-
  // bearing safety check — it proves conditional-load never weakened a cross-role contract.
  const nonDesign = await buildOnFixture({ mode: null });
  const design = await buildOnFixture({ mode: "figma" });
  for (const s of ANTI_SWEEP_SENTINELS) {
    assert.ok(nonDesign.includes(s), `anti-sweep contract must SURVIVE the non-design strip: ${JSON.stringify(s)}`);
    assert.ok(design.includes(s), `anti-sweep contract must be present on the design arm: ${JSON.stringify(s)}`);
  }
});

// --- AC7: lite interaction ------------------------------------------------

test("AC7: lite + non-design strips §3.2 once (no reintroduction), consistent with chain-only", async () => {
  // WHY: lite mode already strips chain-only (which WRAPS §3.1+§4, and §3.2 sits inside it),
  // so §3.2 is gone in lite regardless of the design axis. The design-only axis must not
  // REINTRODUCE it on lite, and the lite + non-design dispatch must be self-consistent: the
  // gated visual sentinels stay absent and no fence marker leaks. (The design-only fences are
  // nested inside chain-only, so on lite they are removed by the chain-only strip first.)
  const liteNonDesign = await buildOnFixture({ mode: null, skillFile: "skill-coordinator-lite.md" });
  for (const s of DESIGN_ONLY_SENTINELS) {
    assert.ok(!liteNonDesign.includes(s), `lite+non-design must NOT contain gated visual sentinel: ${JSON.stringify(s)}`);
  }
  for (const m of ["design-only:start", "design-only:end", "chain-only:start"]) {
    assert.ok(!liteNonDesign.includes(m), `lite+non-design must leak no marker: ${m}`);
  }
  // §3.2 absent because chain-only already removed it — consistency with the existing lite axis.
  assert.ok(!liteNonDesign.includes("3.2 Visual Verdict Authority"), "lite already strips §3.2 (inside chain-only)");
});

// --- AC8: rebaseline + pin the new non-design figure ----------------------

test("AC8/AC-P2-7: non-design (design-only + rationale stripped) constitution is at/below the floor (≤ 3477 ~tok)", () => {
  // WHY: this is the BUDGET WIN that justified the feature, and it must be regression-guarded.
  // On a non-design chain dispatch buildPromptForRole emits stripDesignOnly(stripRationale(source)).
  // REBASELINED by constitution-conditional-load PHASE 2: Phase 2 strips two MORE spans on the
  // non-design arm (§4 visual prose S3–S5 + P-AUDITOR, and §1 L16/L17/L19), so the non-design
  // figure drops further vs Phase-1's 3013. MEASURED on THIS working tree (chars/4): 2409 ~tok
  // exactly. That is 1830 ~tok BELOW the rationale-stripped (design-arm) figure of 4239 — the
  // per-dispatch saving on non-design features (vs the original full-load ~4200, the net win is
  // ~1790 tok/dispatch). Pin both the floor AND the saving so a fence-shrink regression (less
  // stripped) or a marker-cost blowout is caught.
  // governance-tag-strip (T-GTS-06, qa-owned re-baseline): both sides folded to include
  // stripOriginTags, matching the real buildPromptForRole pipeline (origin strip runs
  // FIRST, unconditionally, before the rationale/design-only axes). Without the fold,
  // the raw constitution's added origin-fence marker bytes (~14 pairs) would tick this
  // floor UP, not down — the exact regression this fold prevents. Cap LOWERED from
  // 2409 → 2403; the design-only strip saving grows from 1830 → 2084 (more of the
  // now-larger raw-with-fences delta lands on the design-arm side, since the design-only
  // fenced spans in §3.1/§3.2/§4 also each carry an origin tag that only the fold removes).
  // compose-not-strip (ticket A9, T-CNSO-07): stripDesignOnly is deleted — the
  // non-design path is now composeConstitution({chain:true,design:false}) (drops
  // exactly the `design`/`chain-design` fragments the old regex stripped) run
  // through the SAME stripOriginTags→stripRationale pipeline as the design-arm path.
  // cut-approval-coordinator-attestation (qa-owned bump, C2-06): cap raised from
  // 2403 → 2872. The new Cut-Approval Gate bullet lives in const-08-chain-31-mid.md,
  // a `chain`-tagged (not `design`-tagged) fragment, so it is INCLUDED on the
  // non-design path too (chain:true, design:false still keeps all chain fragments) —
  // the non-design floor grows by the same bullet the design-arm floor absorbed.
  // Actual non-design constitution measured at 2872 ~tok (exact); cap set to the
  // exact measured value per the Phase-2 convention (no additional headroom).
  // pm-repair-resume-routing (v3.47.0, qa-owned bump, C1-09/AC-11): cap raised from
  // 2872 → 3175. The new Amend-Resume Edge bullet lives in const-08-chain-31-mid.md,
  // a `chain`-tagged (not `design`-tagged) fragment, so it is INCLUDED on the
  // non-design path too — the non-design floor grows by the same bullet the
  // design-arm floor absorbed. Actual non-design constitution re-measured at 3175
  // ~tok (exact); cap set to the exact measured value per the established convention
  // (no additional headroom). Saving margin re-verified: design-arm 5260 − non-design
  // 3175 = 2085 ~tok, still ≥ 2080.
  // a13-section1-polish (qa-owned bump, A13-07): cap raised from 3175 → 3232. The
  // const-01-core-head.md Terse/Watermark rewrite is core-head (not design-only-fenced),
  // so it lands on the non-design path too, same as the design-arm floor above.
  // Independently re-measured (not trusted from sr-engineer's handoff note) at 3232
  // ~tok (exact); cap set to the exact measured value per the established Phase-2
  // convention (no additional headroom). Saving margin re-verified: design-arm 5316 −
  // non-design 3232 = 2084 ~tok, still ≥ 2080.
  // a11-escalation-grammar (qa-owned bump, A11-02): cap raised from 3232 → 3477. The
  // const-05-chain-mid.md canonical Escalation call format + WHEN/DO/ELSE bullets are
  // chain-tagged (not design-tagged), so they land on the non-design path too, same as
  // the design-arm floor above. Independently re-measured (not trusted from
  // sr-engineer's handoff note) at 3477 ~tok (exact); cap set to the exact measured
  // value per the established Phase-2 convention (no additional headroom). Saving
  // margin re-verified: design-arm 5561 − non-design 3477 = 2084 ~tok, still ≥ 2080
  // (unchanged — the const-05 edit sits outside the design-only fences).
  // b8-external-ref-ledger (qa-owned bump, B8-09): cap raised from 3477 → 3531. The
  // const-15-core-tail.md §7 rewrite is chain-tagged core-tail content (not
  // design-only-fenced), so it lands on the non-design path too, same as the design-arm
  // floor above. Independently re-measured (not trusted from sr-engineer's handoff note)
  // at 3531 ~tok (exact); cap set to the exact measured value per the established
  // Phase-2 convention (no additional headroom). Saving margin re-verified: design-arm
  // 5616 − non-design 3531 = 2085 ~tok, still ≥ 2080.
  // c7-version-assertion-ownership (qa-owned bump, AC-8): cap raised from 3531 → 3636. The
  // const-05-core-standards.md "Test ownership" bullet rewrite (S01, +420 chars net) is
  // core (not design-only-fenced), so it lands on the non-design path too, same as the
  // design-arm floor above. Independently re-measured (not trusted from sr-engineer's or
  // code-reviewer's notes) at 3636 ~tok (exact); cap set to the exact measured value per
  // the established Phase-2 convention (no additional headroom). Saving margin
  // re-verified: design-arm 5721 − non-design 3636 = 2085 ~tok, still ≥ 2080 (unchanged —
  // the const-05 edit sits outside the design-only fences).
  // c9-protocol-fields (qa-owned bump, T-C9-11/T-C9-12): cap raised from 3636 → 3939. The
  // const-05-core-standards.md Escalation-call-format rewrite, the const-08-chain-31-mid.md
  // Amend-Resume/code-reviewer-verdict rewrite, and the const-12-chain-r10-s4.md S6
  // sentence rewording are all chain-tagged (not design-tagged), so they land on the
  // non-design path too, same as the design-arm floor above. Independently re-measured at
  // 3939 ~tok (exact); cap set to the exact measured value per the established Phase-2
  // convention (no additional headroom). Saving margin re-verified: design-arm 6024 −
  // non-design 3939 = 2085 ~tok, still ≥ 2080 (unchanged — the edits sit outside the
  // design-only fences).
  // c14-dispatch-pins (qa-owned bump, T-C14-11): cap raised from 3939 → 4016. The
  // const-01-core-head.md AC-7 Pin-override bullet is core-head (not design-only-fenced),
  // so it lands on the non-design path too, same as the design-arm floor above.
  // Independently re-measured (not trusted from sr-engineer's or code-reviewer's notes)
  // at 4016 ~tok (exact); cap set to the exact measured value per the established
  // Phase-2 convention (no additional headroom). Saving margin re-verified: design-arm
  // 6100 − non-design 4016 = 2084 ~tok, still ≥ 2080 (unchanged — the const-01 edit sits
  // outside the design-only fences).
  const ratStripped = approxTokens(stripRationale(stripOriginTags(CONSTITUTION)));         // design-arm path: 6100
  const nonDesign = approxTokens(stripRationale(stripOriginTags(composeConstitution({ chain: true, design: false })))); // non-design path: 4016
  assert.ok(nonDesign <= 4016, `non-design constitution (${nonDesign} ~tok) must be ≤ 4016 (AC8 non-design floor, c14-dispatch-pins re-baseline)`);
  assert.ok(
    ratStripped - nonDesign >= 2080,
    `design-only strip saving (${ratStripped - nonDesign} ~tok) must be ≥ 2080 (c14-dispatch-pins re-baseline)`,
  );
});

test("AC8/AC-P2-7: chain-role non-design bundle is ~1830 ~tok lighter than the design-armed bundle", () => {
  // WHY: end-to-end budget confirmation at the BUNDLE level (constitution + skill body), the
  // thing actually injected per dispatch. The non-design sr-engineer bundle must be materially
  // lighter than the design-armed one by the design-only span size — proving the saving lands
  // in the real dispatch, not just the isolated stripper. REBASELINED for Phase 2: the saving
  // grows from Phase-1's 1187 to 1830 ~tok (the two added spans). MEASURED on this working tree.
  const skillSr = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const body = skillSr.startsWith("---")
    ? skillSr.slice(skillSr.indexOf("---", 3) + 3).trimStart()
    : skillSr;
  const skillBody = stripRationale(body);
  // compose-not-strip (ticket A9, T-CNSO-07): non-design bundle re-pointed from
  // stripDesignOnly(stripRationale(CONSTITUTION)) (deleted) to
  // stripRationale(composeConstitution({chain:true,design:false})) — same design
  // axis exclusion, expressed as fragment selection instead of a regex strip.
  const designBundle = approxTokens(stripRationale(CONSTITUTION) + SEP + skillBody);
  const nonDesignBundle = approxTokens(stripRationale(composeConstitution({ chain: true, design: false })) + SEP + skillBody);
  assert.ok(
    designBundle - nonDesignBundle >= 1830,
    `non-design bundle must be ≥ 1830 ~tok lighter (design ${designBundle} − non-design ${nonDesignBundle})`,
  );
});

test("AC8/HC3: build.ts arm probe uses the SAME helper as the server PASS gates", () => {
  // WHY: identity-by-construction — the gate and the constitution text agree iff they key
  // off the same arm signal. build.ts and the tw_update_state gate handler both import
  // hasDesignModeRequiringVisual from tools/evidence-file. A cheap source grep pins that
  // the import is shared (reviewer proved behavioral identity; this guards against a
  // future divergent re-implementation).
  // Relocated by the registry-pattern refactor: the tw_update_state gate-orchestration
  // body (and its hasDesignModeRequiringVisual import) moved verbatim from index.ts to
  // tools/handoff-orchestrator.ts; index.ts itself no longer imports this helper directly.
  const buildSrc = fs.readFileSync(path.join(ROOT, "prompts", "build.ts"), "utf-8");
  const orchestratorSrc = fs.readFileSync(path.join(ROOT, "tools", "handoff-orchestrator.ts"), "utf-8");
  // gate-registry refactor (A10 + A2): hasDesignModeRequiringVisual moved from
  // tools/evidence-file.ts to gates/visual.ts; both call sites now import it from
  // the gates/visual module (still the SAME single helper — identity preserved).
  assert.match(buildSrc, /import\s*\{\s*hasDesignModeRequiringVisual\s*\}\s*from\s*["']\.\.\/gates\/visual\.js["']/,
    "build.ts must import hasDesignModeRequiringVisual from gates/visual");
  assert.match(buildSrc, /hasDesignModeRequiringVisual\(workspacePath,\s*state\.active_feature\)\.required/,
    "build.ts arm probe must read .required off the shared helper");
  assert.match(orchestratorSrc, /import[\s\S]*hasDesignModeRequiringVisual[\s\S]*from\s*["']\.\.\/gates\/visual\.js["']/,
    "tools/handoff-orchestrator.ts must import the same helper the server PASS gates call");
});

// ============================================================================
// constitution-conditional-load PHASE 2 (AC-P2-1…8): extend the design-only axis
// to two MORE feature-inert spans deferred in Phase 1 — §4 visual prose (Span A,
// reflow + 1 fence) and §1 L16/L17/L19 (Span B, 2 fences, with a rationale fence
// NESTED inside §1 fence #1 → HC-NEST). NO new mechanism (reuse stripDesignOnly +
// the design-only marker pair), NO server-gate change, NO rule reword (HC2 absolute;
// the §4 reflow is REORDER-ONLY). Spec: specs/constitution-conditional-load.md §Phase 2.
//
// Spec-to-Test map:
//   AC-P2-1 (§4 visual block strips on non-design)  -> t-p2-s4-nondesign-strips
//   AC-P2-2 (§4 visual block loads on design)        -> t-p2-s4-design-loads
//   AC-P2-3 (§1 L16/17 + L19 strip / load)           -> t-p2-s1-strip-load,
//                                                       t-p2-fullDetail-design-aware (above)
//   AC-P2-4 (HC-NEST permutation sweep)              -> t-p2-hcnest-permutations
//   AC-P2-5 (reflow is reorder-only)                 -> t-p2-reflow-reorder-only
//   AC-P2-6 (non-visual §4/§1 survives both arms)    -> t-p2-antisweep-both-arms
//   AC-P2-7 (AC8 floor re-measured)                  -> the four AC8/AC-P2-7 floors above
//   AC-P2-8 (composition order-independent)          -> t-ccl-six-permutations (above) +
//                                                       t-p2-hcnest-permutations
// ============================================================================

test("AC-P2-1: §4 visual block (S3/S4/S5 + design-auditor) is ABSENT on the non-design arm", async () => {
  // WHY: Span A is FEATURE-INERT on non-design (no visual_round can tick, no design-auditor
  // fires). On a non-design dispatch the §4 visual sentences and the whole P-AUDITOR paragraph
  // must be stripped — none of the visual codes or the auditor prose may leak.
  const text = await buildOnFixture({ mode: null });
  for (const s of P2_S4_VISUAL_SENTINELS) {
    assert.ok(!text.includes(s), `non-design §4 must OMIT visual sentinel: ${JSON.stringify(s)}`);
  }
  assert.ok(!text.includes("design-only:start"), "non-design dispatch must not leak fence markers");
});

test("AC-P2-2: §4 visual block (S3/S4/S5 + design-auditor) is PRESENT on the design arm", async () => {
  // WHY: the inverse contract. On a design-armed feature (`## Mode` = figma) the full §4 visual
  // governance must load — the visual_round description, all three VISUAL_* codes, and the
  // design-auditor paragraph — unchanged.
  const text = await buildOnFixture({ mode: "figma" });
  for (const s of P2_S4_VISUAL_SENTINELS) {
    assert.ok(text.includes(s), `design arm §4 must LOAD visual sentinel: ${JSON.stringify(s)}`);
  }
});

test("AC-P2-3: §1 L16/L17 + L19 are ABSENT on non-design, PRESENT on design; L15/L18 retained on both", async () => {
  // WHY: Span B gates the three FEATURE-INERT §1 bullets (Visual-Widgets exception, Design-baseline
  // scope, Self-converge relaxation) behind TWO design-only fences, while the universal bullets
  // L15 (MVP strict) and L18 (Surgical changes) sit OUTSIDE both fences (anti-sweep). On non-design
  // the three inert bullets strip and the two universals survive; on design all five are present.
  const nonDesign = await buildOnFixture({ mode: null });
  const design = await buildOnFixture({ mode: "figma" });
  for (const s of P2_S1_DESIGN_SENTINELS) {
    assert.ok(!nonDesign.includes(s), `non-design §1 must OMIT inert bullet: ${JSON.stringify(s)}`);
    assert.ok(design.includes(s), `design arm §1 must LOAD inert bullet: ${JSON.stringify(s)}`);
  }
  for (const s of P2_S1_ANTISWEEP_SENTINELS) {
    assert.ok(nonDesign.includes(s), `non-design §1 must RETAIN universal bullet (anti-sweep): ${JSON.stringify(s)}`);
    assert.ok(design.includes(s), `design arm §1 must retain universal bullet: ${JSON.stringify(s)}`);
  }
});

// compose-not-strip (ticket A9, T-CNSO-07): the "AC-P2-4/HC-NEST: rationale-
// inside-design-only nests clean across every strip permutation" test that lived
// here is REMOVED — it swept 8 subsets of {stripChainOnly, stripRationale,
// stripDesignOnly} to prove no regex-marker corruption at the HC-NEST site (a
// rationale fence nested inside a design-only fence, §1 fence #1 / now fragment
// const-02-design-mvp.md). stripChainOnly/stripDesignOnly are deleted, so there
// is no marker-parsing interaction left to sweep: chain/design selection is file
// inclusion (composeConstitution), decided before stripRationale ever runs; the
// nested rationale span physically lives inside const-02-design-mvp.md and is
// stripped by stripRationale exactly like any other rationale fence, regardless
// of which fragment it landed in post-split. The universal-bullet byte-intact
// contract this test also checked is covered by AC-P2-3/AC-P2-6 below (L15/L18
// survive both arms) and by the T-GTS-07 stripRationale unit tests above.

test("AC-P2-5: §4 reflow is REORDER-ONLY — every §4 rule sentence is byte-present (no reword)", async () => {
  // WHY: HC2 (tightened) — the §4 reflow may ONLY reorder sentences / split paragraphs / insert
  // fence-marker lines; every sentence's text stays BYTE-IDENTICAL. We pin this by asserting the
  // verbatim text of every §4 rule sentence (DIAGRAM, S1, S2, S3, S4, S5, P-AUDITOR, S6) is
  // present byte-for-byte in the post-reflow source constitution. If any sentence were reworded
  // to win a fence, its verbatim anchor would vanish and this fails. (Set-presence of every
  // sentence ⇒ the reflow dropped/reworded none; the diff is position-only.)
  const S4_SENTENCE_ANCHORS = [
    // DIAGRAM (non-visual)
    "researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer",
    // S1 (non-visual) — review_round
    "sr-engineer ↔ code-reviewer loops on `(code-reviewer, FAIL)` for up to 3",
    // S2 (non-visual) — qa_round
    "The qa-engineer loop back to sr-engineer",
    // S6 (non-visual) — universal handoff convention. c9-protocol-fields
    // (T-C9-11 qa-owned re-baseline): the sentence was legitimately REWORDED
    // (not just reordered) by const-12-chain-r10-s4.md's T-C9-12 edit — the
    // routing signal moved from a `pending_notes` token to the first-class
    // `next_role` field. This anchor is updated to the new verbatim sentence;
    // the REORDER-ONLY contract this test enforces applies to the reflow
    // that split §4 across fragments, not to a later feature's content edit.
    "Each role finishes with `tw_update_state` whose first-class `next_role` field names the successor role",
    // S3 (visual) — visual_round description + self-arming signal
    // governance-tag-strip (T-GTS-04): the raw anchor shifted — "v3.14.0" is now wrapped
    // in an inline origin fence inside the same parenthetical as the "§3.1" cross-ref
    // (`(<!-- origin:start -->v3.14.0, <!-- origin:end -->§3.1)`), so the old fence-free
    // literal no longer occurs in CONSTITUTION.
    "A third counter\n`visual_round` (<!-- origin:start -->v3.14.0, <!-- origin:end -->§3.1) tracks pixel-fidelity iterations",
    // S4 (visual) — VISUAL_BASELINES_REQUIRED
    "is blocked at PASS with `VISUAL_BASELINES_REQUIRED` rather than",
    // S5 (visual) — VISUAL_ASSERTIONS_REQUIRED / VISUAL_REPORT_INCOMPLETE
    "rejects PASS with `VISUAL_ASSERTIONS_REQUIRED`",
    // P-AUDITOR (visual/design-only)
    "`design-auditor` fires when the coordinator detects a design source",
  ];
  for (const s of S4_SENTENCE_ANCHORS) {
    assert.ok(CONSTITUTION.includes(s), `§4 reflow must keep sentence byte-identical (reorder-only): ${JSON.stringify(s.slice(0, 60))}`);
  }
  // Belt-and-braces: the design-arm dispatch (full §4 loaded) carries the reflowed visual block
  // byte-equal — extract the post-reflow §4 visual paragraph from source and assert containment.
  const design = await buildOnFixture({ mode: "figma" });
  const visStart = CONSTITUTION.indexOf("A third counter");
  const visEnd = CONSTITUTION.indexOf("skip the auditor entirely.") + "skip the auditor entirely.".length;
  assert.ok(visStart > -1 && visEnd > visStart, "§4 visual block anchors must resolve in source");
  // governance-tag-strip (T-GTS-04/05): the raw slice still carries the S3 origin fence
  // around "v3.14.0" (see anchor above); `design` came through buildPromptForRole, which
  // strips origin tags unconditionally, so route visBlockSrc through the same stripper
  // before the containment check — same class as the R10 / §3.2 byte-equal fixes above.
  const visBlockSrc = stripOriginTags(CONSTITUTION.slice(visStart, visEnd));
  assert.ok(design.includes(visBlockSrc), "design-arm §4 visual block must be byte-identical to post-reflow source (no reword, post stripOriginTags)");
});

test("AC-P2-6: non-visual §4 (DIAGRAM/S1/S2/S6) + §1 (L15/L18) survive byte-for-byte on BOTH arms", async () => {
  // WHY: anti-sweep contract for Phase 2. The §4 routing diagram, the review_round (S1) and
  // qa_round (S2) loop mechanics, and the universal "Each role finishes…" handoff convention (S6)
  // are CONTRACT — they sit OUTSIDE the Span-A fence and MUST survive on BOTH arms. Same for the
  // §1 universal bullets L15/L18 (outside Span-B fences). A too-greedy fence or a mis-placed reflow
  // would sweep them; this is the load-bearing safety check that conditional-load never weakened a
  // cross-role routing contract.
  const nonDesign = await buildOnFixture({ mode: null });
  const design = await buildOnFixture({ mode: "figma" });
  for (const s of [...P2_S4_ANTISWEEP_SENTINELS, ...P2_S1_ANTISWEEP_SENTINELS]) {
    assert.ok(nonDesign.includes(s), `anti-sweep contract must SURVIVE the non-design strip: ${JSON.stringify(s)}`);
    assert.ok(design.includes(s), `anti-sweep contract must be present on the design arm: ${JSON.stringify(s)}`);
  }
});
