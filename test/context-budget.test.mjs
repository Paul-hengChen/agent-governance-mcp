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
//   DR-3 (3-copy regex parity) -> t-regex-equivalence
//
// WHY: the always-on token reduction works by stripping the chain-only sections
// (constitution §3.1, §4) from LITE contexts only. The risk is twofold — (a) the
// strip silently drops a rule a lite agent still needs, or (b) the three copies
// of the stripper regex drift. These tests pin both: lite loses ONLY chain rules,
// chain roles keep everything, and all three regex copies stay identical.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const CONSTITUTION = fs.readFileSync(path.join(ROOT, "content", "constitution.md"), "utf-8");
const approxTokens = (t) => Math.ceil(t.length / 4);

const { stripChainOnly, stripRationale, stripDesignOnly, buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));

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

test("AC2: stripChainOnly removes the chain-only block and is idempotent", () => {
  const lean = stripChainOnly(CONSTITUTION);
  assert.ok(lean.length < CONSTITUTION.length, "stripped constitution must be shorter than raw");
  assert.equal(stripChainOnly(lean), lean, "stripChainOnly must be idempotent");
  // no-marker passthrough is the safety default (workspace override without fences)
  assert.equal(stripChainOnly("no markers here"), "no markers here", "text without markers is unchanged");
});

test("AC2: lean always-on bundle is below the raw baseline and within target (<= 2700 ~tok)", () => {
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
  const liteSkill = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator-lite.md"), "utf-8");
  const SEP = "\n\n---\n\n";
  const raw = approxTokens(CONSTITUTION + SEP + liteSkill);
  const lean = approxTokens(stripChainOnly(CONSTITUTION) + SEP + liteSkill);
  assert.ok(lean < raw, `lean (${lean}) must be < raw (${raw})`);
  assert.ok(lean <= 3010, `lean always-on (${lean} ~tok) must meet the <= 3010 target`);
});

// --- AC3: enforcement preserved ------------------------------------------

test("AC3: lite (stripped) constitution OMITS chain-only sections", () => {
  const lean = stripChainOnly(CONSTITUTION);
  for (const m of CHAIN_MARKERS) {
    assert.ok(!lean.includes(m), `lite constitution must NOT contain chain-only marker: ${m}`);
  }
  assert.ok(!lean.includes("chain-only:start"), "fence markers themselves must be removed");
});

test("AC3: lite (stripped) constitution RETAINS all universal rules", () => {
  const lean = stripChainOnly(CONSTITUTION);
  for (const m of UNIVERSAL_MARKERS) {
    assert.ok(lean.includes(m), `lite constitution must still contain universal rule: ${m}`);
  }
});

test("AC3/AC4: full (chain-role) constitution RETAINS chain-only sections verbatim", () => {
  // Chain roles receive the raw constitution — the rules that drive the
  // server-enforced transitions must reach them unchanged.
  for (const m of [...CHAIN_MARKERS, ...UNIVERSAL_MARKERS]) {
    assert.ok(CONSTITUTION.includes(m), `full constitution must contain: ${m}`);
  }
});

test("AC3: exactly one balanced chain-only fence wraps §3.1 + §4", () => {
  const starts = (CONSTITUTION.match(/<!-- chain-only:start -->/g) || []).length;
  const ends = (CONSTITUTION.match(/<!-- chain-only:end -->/g) || []).length;
  assert.equal(starts, 1, "exactly one chain-only:start marker");
  assert.equal(ends, 1, "exactly one chain-only:end marker");
  const block = CONSTITUTION.slice(
    CONSTITUTION.indexOf("<!-- chain-only:start -->"),
    CONSTITUTION.indexOf("<!-- chain-only:end -->"),
  );
  for (const m of CHAIN_MARKERS) {
    assert.ok(block.includes(m), `fence must wrap chain section: ${m}`);
  }
});

// --- AC3: SessionStart hook integration ----------------------------------

function runHook(env) {
  const out = execFileSync("node", [path.join(ROOT, "bin", "agent-governance-context.mjs")], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, ...env },
    encoding: "utf-8",
  });
  return JSON.parse(out).hookSpecificOutput.additionalContext;
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

// --- DR-3: 3-copy regex parity -------------------------------------------

test("DR-3: all three stripChainOnly regex copies are identical", () => {
  // build.ts (TS→dist) and the hook (.mjs) intentionally duplicate the stripper
  // across a module boundary; the measure script holds a third copy. They MUST
  // stay byte-identical or lite/full contexts diverge silently.
  const files = [
    path.join(ROOT, "prompts", "build.ts"),
    path.join(ROOT, "bin", "agent-governance-context.mjs"),
    path.join(ROOT, "scripts", "measure-context-cost.mjs"),
  ];
  const re = /\.replace\(\/<!-- chain-only:start -->\[\\s\\S\]\*\?<!-- chain-only:end -->\\n\?\/g, ""\)/;
  const hits = files.map((f) => {
    const src = fs.readFileSync(f, "utf-8");
    const m = src.match(re);
    assert.ok(m, `chain-only strip regex must be present in ${path.basename(f)}`);
    return m[0];
  });
  assert.equal(hits[0], hits[1], "build.ts and hook regex must match");
  assert.equal(hits[1], hits[2], "hook and measure-script regex must match");
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

test("AC1/AC2: skill-pm stripped token count meets ≤ 2850 cap", () => {
  // WHY: the spec's re-grounded AC1 target (measured lossless, current file size
  // including F-A growth) must hold so each pm role dispatch is within budget.
  // pm-cut-approval-gate (qa-owned bump): cap raised from 2322 → 2850 to absorb
  // the step 7a Cut-Approval Gate SOP addition to skill-pm.md (inline cut draft
  // workflow, design-link rule, re-arm description). Actual stripped body measured
  // at 2800 ~tok; 2850 provides ~50-token editing headroom.
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  // Strip frontmatter (--- block) before token-counting the body, matching buildPromptForRole.
  const body = SKILL_PM.startsWith("---")
    ? SKILL_PM.slice(SKILL_PM.indexOf("---", 3) + 3).trimStart()
    : SKILL_PM;
  const stripped = stripRationale(body);
  const toks = approxTokens(stripped);
  assert.ok(toks <= 2850, `skill-pm stripped body (${toks} ~tok) must be ≤ 2850 (AC1)`);
});

test("AC1/AC2: skill-sr-engineer stripped token count meets ≤ 2210 cap", () => {
  // WHY: the spec's re-grounded AC2 target must hold for sr-engineer dispatch budget.
  // v3.28.0 (qa-owned bump): cap raised from 2048 → 2210 to absorb the
  // design-asset-source-rule feature's "Source assets, don't redraw them (v3.28.0)"
  // rule added to skill-sr-engineer's Design-Aware Pre-Flight step 3a. Actual
  // stripped body measured at 2160 ~tok; 2210 provides ~50-token editing headroom.
  const SKILL_SR = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const body = SKILL_SR.startsWith("---")
    ? SKILL_SR.slice(SKILL_SR.indexOf("---", 3) + 3).trimStart()
    : SKILL_SR;
  const stripped = stripRationale(body);
  const toks = approxTokens(stripped);
  assert.ok(toks <= 2210, `skill-sr stripped body (${toks} ~tok) must be ≤ 2210 (AC2)`);
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

test("AC8/AC-P2-7: rationale-stripped (design-arm) constitution is at/below the measured floor (≤ 4304 ~tok)", () => {
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
  const raw = approxTokens(CONSTITUTION);
  const stripped = approxTokens(stripRationale(CONSTITUTION));
  assert.ok(stripped <= 4523, `stripped constitution (${stripped} ~tok) must be ≤ 4523 (AC8 design-arm floor, constitution v3.40.0)`);
  assert.ok(
    raw - stripped >= 49,
    `constitution rationale saving (${raw - stripped} ~tok) must be ≥ 49 (AC8 measured min)`,
  );
});

test("AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 7768 ~tok)", () => {
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
  const skillCoord = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator.md"), "utf-8");
  const body = skillCoord.startsWith("---")
    ? skillCoord.slice(skillCoord.indexOf("---", 3) + 3).trimStart()
    : skillCoord;
  const SEP = "\n\n---\n\n";
  const bundle = approxTokens(stripRationale(CONSTITUTION) + SEP + stripRationale(body));
  assert.ok(bundle <= 8160, `teamwork stripped bundle (${bundle} ~tok) must be ≤ 8160 (AC8 design-arm floor, pm-cut-approval-gate)`);
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

test("AC9/DR-9: stripChainOnly ∘ stripRationale compose order is irrelevant on the constitution", () => {
  // WHY: T-GTL-07 runs both strippers on the constitution. The two fence types occupy
  // disjoint regions (chain-only wraps §3.1+§4; rationale fences sit in §1/§7), so the
  // result must be identical regardless of order — proving no marker pair nests in the
  // other and neither non-greedy regex crosses the other's markers (DR-9).
  assert.equal(
    stripRationale(stripChainOnly(CONSTITUTION)),
    stripChainOnly(stripRationale(CONSTITUTION)),
    "compose order of the two strippers must not change the result",
  );
});

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
const DESIGN_ONLY_SENTINELS = [
  "Visual evidence gate (v3.16.0)",       // §3.1 fence 1, bullet 1
  "Visual report schema gate",            // §3.1 fence 1, bullet 2
  "`visual_round` sub-loop (v3.14.0)",    // §3.1 fence 2, bullet 1
  "Split escalation (Round 3)",           // §3.1 fence 2, bullet 2
  "3.2 Visual Verdict Authority",         // §3.2 header (fence 3)
  "Visual verdict is qa-visual-owned",    // §3.2 body
  "No global-frame metric",               // §3.2 body — the qa-visual-owned PASS-metric rule
];

// Anti-sweep CONTRACT sentinels: NON-visual rules that physically sit inside or
// adjacent to the gated spans and MUST survive on BOTH arms (HC4). These are the
// cross-role contracts the gate must never sweep away.
const ANTI_SWEEP_SENTINELS = [
  "SCOPE_DECISION_REQUIRED",                          // §3.1 scope-decision gate (v3.30.0), sits BETWEEN two gated visual bullets
  "Sequential-context assumption + reconcile (R10)",  // §3.2 R10 (tw_sync/reconcile), ends §3.2 — carved OUT of the fence
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
const P2_S1_DESIGN_SENTINELS = [
  "**Visual Widgets exception (v3.14.0)**: when a widget is listed in the spec",      // L16, fence #1
  "**Design-baseline scope (v3.27.0)**: For design-backed work, the canonical design", // L17, fence #1
  "**Self-converge relaxation (v3.31.0)**: inside sr-engineer",                        // L19, fence #2
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

test("AC1: stripDesignOnly removes the design-only span and is idempotent", () => {
  // WHY: the helper is the unit primitive of the third axis. On the non-design arm
  // buildPromptForRole applies it to the (rationale-stripped) constitution. It must
  // delete every fenced visual span, leave no marker, be idempotent, and pass text
  // without markers through unchanged (the full-constitution safety default = design arm).
  const stripped = stripDesignOnly(CONSTITUTION);
  assert.ok(stripped.length < CONSTITUTION.length, "stripped constitution must be shorter than raw");
  assert.equal(stripDesignOnly(stripped), stripped, "stripDesignOnly must be idempotent");
  assert.equal(stripDesignOnly("no markers here"), "no markers here", "text without markers is unchanged");
  for (const s of DESIGN_ONLY_SENTINELS) {
    assert.ok(!stripped.includes(s), `non-design constitution must NOT contain gated sentinel: ${JSON.stringify(s)}`);
  }
  assert.ok(!stripped.includes("design-only:start"), "design-only fence markers must be removed on the strip arm");
});

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
  const srcSpan = CONSTITUTION.slice(srcStart, CONSTITUTION.indexOf("\n", srcEndAnchor));
  assert.ok(text.includes(srcSpan), "design-arm §3.2 span must be byte-identical to constitution source");
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
  const srcStart = CONSTITUTION.indexOf("- **Sequential-context assumption + reconcile (R10).**");
  const srcEnd = CONSTITUTION.indexOf("## 4. Routing Chain");
  assert.ok(srcStart > -1 && srcEnd > srcStart, "R10 source span anchors must resolve");
  const r10 = CONSTITUTION.slice(srcStart, srcEnd).trimEnd();
  const nonDesign = await buildOnFixture({ mode: null });
  const design = await buildOnFixture({ mode: "figma" });
  assert.ok(nonDesign.includes(r10), "R10 must survive byte-equal on the NON-design arm");
  assert.ok(design.includes(r10), "R10 must survive byte-equal on the DESIGN arm");
});

test("AC4: every surviving (non-gated) rule on the non-design arm is byte-identical to source", async () => {
  // WHY: the gate only DELETES fenced spans (HC2). So the non-design constitution must be
  // EXACTLY stripDesignOnly(stripRationale(source)) — no surviving rule reworded. We pin
  // this by reconstructing the expected arm output from the source and the two strippers,
  // then asserting the emitted constitution prefix matches it byte-for-byte.
  const text = await buildOnFixture({ mode: null });
  const expectedConstitution = stripDesignOnly(stripRationale(CONSTITUTION));
  assert.ok(
    text.startsWith(expectedConstitution),
    "non-design dispatch constitution must be byte-identical to stripDesignOnly∘stripRationale(source)",
  );
});

// --- AC5 / HC5: composition across all three axes -------------------------

test("AC5/HC5: all 6 strip-order permutations are byte-identical (disjoint/nested fences)", () => {
  // WHY: the three axes (chainOnly, rationale, designOnly) must compose order-INDEPENDENTLY.
  // design-only fences are NESTED inside chain-only (§3.1/§3.2 sit between its markers) and
  // DISJOINT from rationale fences (§1/§7). Non-greedy regexes + distinct markers guarantee
  // no marker pair crosses another. Apply all 6 orderings of the three strippers and assert
  // a single canonical result — proves no axis corrupts another's span (the reviewer verified
  // 6 permutations byte-clean; this encodes it).
  const a = stripChainOnly, b = stripRationale, c = stripDesignOnly;
  const orders = [
    (t) => a(b(c(t))), (t) => a(c(b(t))),
    (t) => b(a(c(t))), (t) => b(c(a(t))),
    (t) => c(a(b(t))), (t) => c(b(a(t))),
  ];
  const results = orders.map((f) => f(CONSTITUTION));
  for (let i = 1; i < results.length; i++) {
    assert.equal(results[i], results[0], `permutation ${i} must equal permutation 0 (order-independent)`);
  }
});

test("AC5/HC5: every strip permutation leaves ZERO orphan markers", () => {
  // WHY: a corrupted nest (one regex eating the other's start/end) would leave a dangling
  // marker. Two invariants: (1) applying ALL three strippers (worst case = lite + non-design
  // + non-full-detail) leaves ZERO markers of any axis; (2) each stripper acting ALONE removes
  // EXACTLY its own marker pairs and leaves the other two axes' markers byte-for-byte intact
  // (count-preserving) — proving no regex crosses another axis's markers.
  const countMarkers = (t, name) => (t.match(new RegExp(`${name}:(start|end)`, "g")) || []).length;
  const raw = {
    chain: countMarkers(CONSTITUTION, "chain-only"),       // 2 (1 pair)
    rationale: countMarkers(CONSTITUTION, "rationale"),    // 4 (2 pairs)
    design: countMarkers(CONSTITUTION, "design-only"),     // 12 (6 pairs) — Phase-2: 3 nested-in-chain-only (§3.1×2 fences, §3.2, §4) + 2 in §1 (Span-B) ... see breakdown below
  };
  // Phase-2 fence inventory (MEASURED, not assumed): 6 design-only PAIRS total —
  //   §1 Span-B fence #1 (L16–L17) and #2 (L19): 2 pairs, OUTSIDE chain-only.
  //   §3.1 fence A (visual evidence + report schema) + fence B (visual_round + split): 2 pairs.
  //   §3.2 body fence (header → No-global-frame, minus R10): 1 pair.
  //   §4 visual prose fence (S3–S5 + P-AUDITOR, post-reflow): 1 pair.
  //   → the LAST 4 pairs (§3.1×2, §3.2, §4) are NESTED inside chain-only; the first 2 (§1) are NOT.
  assert.equal(raw.design, 12, "Phase-2: exactly 6 design-only fence pairs (12 markers) — 2 in §1, 4 nested in chain-only");
  // (1) all three applied → zero of anything.
  const fullyStripped = stripDesignOnly(stripRationale(stripChainOnly(CONSTITUTION)));
  for (const marker of ["chain-only:start", "chain-only:end", "rationale:start", "rationale:end", "design-only:start", "design-only:end"]) {
    assert.ok(!fullyStripped.includes(marker), `fully-stripped constitution must contain ZERO orphan markers: ${marker}`);
  }
  // (2) each stripper alone removes its own pairs, leaves the other axes untouched.
  const chainOut = stripChainOnly(CONSTITUTION);
  assert.equal(countMarkers(chainOut, "chain-only"), 0, "stripChainOnly removes its own markers");
  assert.equal(countMarkers(chainOut, "rationale"), raw.rationale, "stripChainOnly must NOT touch rationale markers");
  // chain-only WRAPS the 4 design-only fences in §3.1/§3.2/§4 (nested), so removing it
  // legitimately removes those 4 PAIRS too. But the 2 §1 Span-B fences (L16–L19) sit OUTSIDE
  // chain-only (§1 is before the chain-only:start at §3.1), so they MUST survive: 4 markers
  // (2 pairs) remain. Pre-Phase-2 the §1 fences did not exist, so this was 0; the premise
  // "all design-only nested inside chain-only" is now FALSE and the count is 4 (MEASURED).
  assert.equal(countMarkers(chainOut, "design-only"), 4, "the 2 §1 (Span-B) design-only fences survive stripChainOnly (they are OUTSIDE chain-only); only the 4 nested §3.x/§4 fences are removed with it");

  const ratOut = stripRationale(CONSTITUTION);
  assert.equal(countMarkers(ratOut, "rationale"), 0, "stripRationale removes its own markers");
  assert.equal(countMarkers(ratOut, "chain-only"), raw.chain, "stripRationale must NOT touch chain-only markers");
  assert.equal(countMarkers(ratOut, "design-only"), raw.design, "stripRationale must NOT touch design-only markers (rationale nests INSIDE design-only on §1 fence #1, but its non-greedy regex removes only its own pair)");

  const desOut = stripDesignOnly(CONSTITUTION);
  assert.equal(countMarkers(desOut, "design-only"), 0, "stripDesignOnly removes its own markers");
  assert.equal(countMarkers(desOut, "chain-only"), raw.chain, "stripDesignOnly must NOT touch chain-only markers (it strips a nested subset)");
  // HC-NEST: §1 fence #1 (L16–L17) CONTAINS a rationale fence. stripDesignOnly removes the
  // whole design-only span including that nested rationale pair — so the §7 rationale fence
  // (outside any design-only fence) must remain: 2 markers (1 pair) survive, not all 4.
  assert.equal(countMarkers(desOut, "rationale"), 2, "stripDesignOnly removes the §1-nested rationale pair (inside design-only fence #1) but leaves the §7 rationale fence (outside any design-only span) → 2 markers remain (HC-NEST)");
});

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

test("AC8/AC-P2-7: non-design (design-only + rationale stripped) constitution is at/below the floor (≤ 2409 ~tok)", () => {
  // WHY: this is the BUDGET WIN that justified the feature, and it must be regression-guarded.
  // On a non-design chain dispatch buildPromptForRole emits stripDesignOnly(stripRationale(source)).
  // REBASELINED by constitution-conditional-load PHASE 2: Phase 2 strips two MORE spans on the
  // non-design arm (§4 visual prose S3–S5 + P-AUDITOR, and §1 L16/L17/L19), so the non-design
  // figure drops further vs Phase-1's 3013. MEASURED on THIS working tree (chars/4): 2409 ~tok
  // exactly. That is 1830 ~tok BELOW the rationale-stripped (design-arm) figure of 4239 — the
  // per-dispatch saving on non-design features (vs the original full-load ~4200, the net win is
  // ~1790 tok/dispatch). Pin both the floor AND the saving so a fence-shrink regression (less
  // stripped) or a marker-cost blowout is caught.
  const ratStripped = approxTokens(stripRationale(CONSTITUTION));         // design-arm path: 4239
  const nonDesign = approxTokens(stripDesignOnly(stripRationale(CONSTITUTION))); // non-design path: 2409
  assert.ok(nonDesign <= 2409, `non-design constitution (${nonDesign} ~tok) must be ≤ 2409 (AC8 non-design floor, Phase-2)`);
  assert.ok(
    ratStripped - nonDesign >= 1830,
    `design-only strip saving (${ratStripped - nonDesign} ~tok) must be ≥ 1830 (the Phase-2 budget win)`,
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
  const designBundle = approxTokens(stripRationale(CONSTITUTION) + SEP + skillBody);
  const nonDesignBundle = approxTokens(stripDesignOnly(stripRationale(CONSTITUTION)) + SEP + skillBody);
  assert.ok(
    designBundle - nonDesignBundle >= 1830,
    `non-design bundle must be ≥ 1830 ~tok lighter (design ${designBundle} − non-design ${nonDesignBundle})`,
  );
});

test("AC8/HC3: build.ts arm probe uses the SAME helper as the server PASS gates", () => {
  // WHY: identity-by-construction — the gate and the constitution text agree iff they key
  // off the same arm signal. build.ts and index.ts both import hasDesignModeRequiringVisual
  // from tools/evidence-file. A cheap source grep pins that the import is shared (reviewer
  // proved behavioral identity; this guards against a future divergent re-implementation).
  const buildSrc = fs.readFileSync(path.join(ROOT, "prompts", "build.ts"), "utf-8");
  const indexSrc = fs.readFileSync(path.join(ROOT, "index.ts"), "utf-8");
  assert.match(buildSrc, /import\s*\{\s*hasDesignModeRequiringVisual\s*\}\s*from\s*["']\.\.\/tools\/evidence-file\.js["']/,
    "build.ts must import hasDesignModeRequiringVisual from tools/evidence-file");
  assert.match(buildSrc, /hasDesignModeRequiringVisual\(workspacePath,\s*state\.active_feature\)\.required/,
    "build.ts arm probe must read .required off the shared helper");
  assert.match(indexSrc, /import[\s\S]*hasDesignModeRequiringVisual[\s\S]*from\s*["']\.\/tools\/evidence-file\.js["']/,
    "index.ts must import the same helper the server PASS gates call");
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

test("AC-P2-4/HC-NEST: rationale-inside-design-only nests clean across every strip permutation (zero orphans)", () => {
  // WHY: §1 fence #1 (L16–L17) CONTAINS a rationale fence (the column-scroller example list) —
  // OUTER design-only, INNER rationale (HC-NEST). Both regexes are non-greedy; any strip
  // combination must leave NO orphan marker and NO corrupted bullet. The dispatch brief's
  // reviewer reproduced the full permutation sweep: {design-only, rationale, both, neither}
  // × {chain-only on (lite), chain-only off} × {fullDetail on/off-equivalent}. We encode it by
  // applying every subset of the three strippers and asserting (a) zero orphan markers of any
  // axis, (b) no half-marker fragment (`design-only:` / `rationale:` / `chain-only:` text), and
  // (c) the surviving universal §1 bullets are intact (byte-substring present).
  const a = stripChainOnly, b = stripRationale, c = stripDesignOnly;
  // All 8 subsets of {a,b,c}, applied in a fixed inner order where present.
  const id = (t) => t;
  const subsets = [
    [id, id, id],          // neither
    [c, id, id],           // design-only only
    [id, b, id],           // rationale only
    [id, id, a],           // chain-only only (lite)
    [c, b, id],            // design-only + rationale (both, chain-only off)
    [c, id, a],            // design-only + chain-only (lite, no rationale)
    [id, b, a],            // rationale + chain-only (lite)
    [c, b, a],             // all three (lite + non-design + non-full-detail worst case)
  ];
  for (const [s1, s2, s3] of subsets) {
    const out = s3(s2(s1(CONSTITUTION)));
    // (a)+(b) zero orphan markers of any axis. A marker is orphaned only if it survives
    // without its pair; the invariant is balanced counts (start === end) per axis after
    // every permutation — an unbalanced count means a non-greedy regex crossed the other's
    // markers (HC-NEST corruption). Additionally a fully-applied subset that includes an
    // axis must drop that axis to ZERO (asserted via the count-equality + the all-three case
    // below, which already pins zero in the "ZERO orphan markers" test above).
    for (const axis of ["design-only", "rationale", "chain-only"]) {
      const starts = (out.match(new RegExp(`${axis}:start`, "g")) || []).length;
      const ends = (out.match(new RegExp(`${axis}:end`, "g")) || []).length;
      assert.equal(starts, ends, `permutation [${[s1, s2, s3].map((f) => f.name || "id").join(",")}] left unbalanced ${axis} markers (${starts} start / ${ends} end) — orphan/corruption`);
    }
    // (c) no half-bullet corruption: a surviving universal §1 bullet must keep its full text.
    // L15 (MVP strict) and L18 (Surgical) are universal — present in every permutation because
    // neither axis fences them (chain-only does not cover §1; design-only/rationale fence other spans).
    assert.ok(out.includes("**MVP strict**: Fulfil ONLY what was asked."), "MVP-strict bullet must stay byte-intact in every permutation");
    assert.ok(out.includes("**Surgical changes**: Touch only what the task requires."), "Surgical-changes bullet must stay byte-intact in every permutation");
  }
});

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
    // S6 (non-visual) — universal handoff convention
    "Each role finishes with `tw_update_state` whose `pending_notes` start with `next_role: <name>`",
    // S3 (visual) — visual_round description + self-arming signal
    "A third counter\n`visual_round` (v3.14.0, §3.1) tracks pixel-fidelity iterations",
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
  const visBlockSrc = CONSTITUTION.slice(visStart, visEnd);
  assert.ok(design.includes(visBlockSrc), "design-arm §4 visual block must be byte-identical to post-reflow source (no reword)");
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
