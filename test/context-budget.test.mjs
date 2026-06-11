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

test("AC2: lean always-on bundle is below the raw baseline and within target (<= 2600 ~tok)", () => {
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
  const liteSkill = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator-lite.md"), "utf-8");
  const SEP = "\n\n---\n\n";
  const raw = approxTokens(CONSTITUTION + SEP + liteSkill);
  const lean = approxTokens(stripChainOnly(CONSTITUTION) + SEP + liteSkill);
  assert.ok(lean < raw, `lean (${lean}) must be < raw (${raw})`);
  assert.ok(lean <= 2600, `lean always-on (${lean} ~tok) must meet the <= 2600 target`);
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

test("AC1/AC2: skill-pm stripped token count meets ≤ 2322 cap", () => {
  // WHY: the spec's re-grounded AC1 target (measured lossless, current file size
  // including F-A growth) must hold so each pm role dispatch is within budget.
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  // Strip frontmatter (--- block) before token-counting the body, matching buildPromptForRole.
  const body = SKILL_PM.startsWith("---")
    ? SKILL_PM.slice(SKILL_PM.indexOf("---", 3) + 3).trimStart()
    : SKILL_PM;
  const stripped = stripRationale(body);
  const toks = approxTokens(stripped);
  assert.ok(toks <= 2322, `skill-pm stripped body (${toks} ~tok) must be ≤ 2322 (AC1)`);
});

test("AC1/AC2: skill-sr-engineer stripped token count meets ≤ 2048 cap", () => {
  // WHY: the spec's re-grounded AC2 target must hold for sr-engineer dispatch budget.
  const SKILL_SR = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const body = SKILL_SR.startsWith("---")
    ? SKILL_SR.slice(SKILL_SR.indexOf("---", 3) + 3).trimStart()
    : SKILL_SR;
  const stripped = stripRationale(body);
  const toks = approxTokens(stripped);
  assert.ok(toks <= 2048, `skill-sr stripped body (${toks} ~tok) must be ≤ 2048 (AC2)`);
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

test("AC8: rationale-stripped constitution is at/below the measured floor (≤ 4200 ~tok)", () => {
  // WHY: floor REBASELINED by constitution-conditional-load. The feature adds 6
  // marker-comment lines (3 `<!-- design-only:start -->` / `<!-- design-only:end -->`
  // pairs) wrapping the visual-governance span (§3.1 visual bullets + §3.2 minus R10).
  // Those 6 lines are load-bearing fence DELIMITERS (the design-only strip axis keys
  // off them), not rule text — but on the DESIGN arm (and in the raw/rationale-stripped
  // measurement here) they are NOT stripped, so they cost +39 ~tok: 4161 → 4200 ~tok.
  // This is the irreducible marker cost on the kept path; it is the price of the
  // ~1187 ~tok saving on the NON-DESIGN dispatch path (pinned by the
  // "design-only strip saves ~1187" test below). MEASURED against this working tree
  // with the test's own chars/4 estimator (NOT assumed): raw 4272 → rationale-stripped
  // 4200 ~tok (exact). The prior floor was 4161 (pre-marker). package.json stays 3.32.0.
  const raw = approxTokens(CONSTITUTION);
  const stripped = approxTokens(stripRationale(CONSTITUTION));
  assert.ok(stripped <= 4200, `stripped constitution (${stripped} ~tok) must be ≤ 4200 (AC8 floor, +39 marker cost)`);
  assert.ok(
    raw - stripped >= 49,
    `constitution saving (${raw - stripped} ~tok) must be ≥ 49 (AC8 measured min)`,
  );
});

test("AC8: teamwork coordinator bundle (both strips) is at/below the floor (≤ 7665 ~tok)", () => {
  // WHY: the constitution is injected on every dispatch; the full coordinator bundle is
  // the worst case. Compose the chain-role bundle the way buildPromptForRole does:
  // rationale-stripped constitution + SEP + rationale-stripped skill body. Floor
  // REBASELINED by constitution-conditional-load: the 6 design-only marker lines add
  // +39 ~tok to the constitution on this (design-arm) path, so 7626 → 7664 ~tok.
  // Coordinator is a CHAIN role: on a DESIGN feature it must keep the full §3.2 (the
  // CDE-OOBE incident was a coordinator-authored accept-policy — §3.2 binds the
  // coordinator on design work), so this worst-case bundle is the design-arm size.
  // MEASURED on this working tree (chars/4): 7664 ~tok; 7665 floor = +1 margin.
  const skillCoord = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator.md"), "utf-8");
  const body = skillCoord.startsWith("---")
    ? skillCoord.slice(skillCoord.indexOf("---", 3) + 3).trimStart()
    : skillCoord;
  const SEP = "\n\n---\n\n";
  const bundle = approxTokens(stripRationale(CONSTITUTION) + SEP + stripRationale(body));
  assert.ok(bundle <= 7665, `teamwork stripped bundle (${bundle} ~tok) must be ≤ 7665 (AC8 floor, +39 marker cost)`);
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

test("AC9: fullDetail retains both example lists verbatim (round-trip lossless)", () => {
  // WHY: the fence is opt-out, not deletion — fullDetail dispatch (AC3 path) must carry
  // the constitution verbatim, including both fenced example lists. Source file always
  // retains them (raw); the buildPromptForRole(fullDetail=true) path keeps them too.
  // This pins the round-trip property: stripping is reversible via the fullDetail flag.
  for (const m of CONST_FENCED_INTERIORS) {
    assert.ok(CONSTITUTION.includes(m), `raw constitution must retain example-list interior: ${JSON.stringify(m)}`);
  }
  const full = buildPromptForRole("skill-coordinator.md", "fd", ROOT, true);
  const text = full.messages[0].content.text;
  for (const m of CONST_FENCED_INTERIORS) {
    assert.ok(text.includes(m), `fullDetail bundle must retain example-list interior: ${JSON.stringify(m)}`);
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

// Build a chain-role dispatch on a fresh temp workspace with the given design
// setup. `mode` of `null` => no design file at all; otherwise writes a design
// file with that `## Mode`. Returns the emitted constitution+skill+state text.
async function buildOnFixture({ mode, skillFile = "skill-sr-engineer.md", noState = false } = {}) {
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
  const text = buildPromptForRole(skillFile, "ccl", ws, false).messages[0].content.text;
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
    design: countMarkers(CONSTITUTION, "design-only"),     // 6 (3 pairs)
  };
  // (1) all three applied → zero of anything.
  const fullyStripped = stripDesignOnly(stripRationale(stripChainOnly(CONSTITUTION)));
  for (const marker of ["chain-only:start", "chain-only:end", "rationale:start", "rationale:end", "design-only:start", "design-only:end"]) {
    assert.ok(!fullyStripped.includes(marker), `fully-stripped constitution must contain ZERO orphan markers: ${marker}`);
  }
  // (2) each stripper alone removes its own pairs, leaves the other axes untouched.
  const chainOut = stripChainOnly(CONSTITUTION);
  assert.equal(countMarkers(chainOut, "chain-only"), 0, "stripChainOnly removes its own markers");
  assert.equal(countMarkers(chainOut, "rationale"), raw.rationale, "stripChainOnly must NOT touch rationale markers");
  // chain-only WRAPS the design-only fences (nested), so removing it legitimately removes
  // the nested design markers too — assert that's the ONLY way design markers vanish here.
  assert.equal(countMarkers(chainOut, "design-only"), 0, "design-only fences are nested inside chain-only → removed with it");

  const ratOut = stripRationale(CONSTITUTION);
  assert.equal(countMarkers(ratOut, "rationale"), 0, "stripRationale removes its own markers");
  assert.equal(countMarkers(ratOut, "chain-only"), raw.chain, "stripRationale must NOT touch chain-only markers");
  assert.equal(countMarkers(ratOut, "design-only"), raw.design, "stripRationale must NOT touch design-only markers (disjoint regions)");

  const desOut = stripDesignOnly(CONSTITUTION);
  assert.equal(countMarkers(desOut, "design-only"), 0, "stripDesignOnly removes its own markers");
  assert.equal(countMarkers(desOut, "chain-only"), raw.chain, "stripDesignOnly must NOT touch chain-only markers (it strips a nested subset)");
  assert.equal(countMarkers(desOut, "rationale"), raw.rationale, "stripDesignOnly must NOT touch rationale markers");
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

test("AC8: non-design (design-only + rationale stripped) constitution is at/below the floor (≤ 3013 ~tok)", () => {
  // WHY: this is the BUDGET WIN that justified the feature, and it must be regression-guarded.
  // On a non-design chain dispatch buildPromptForRole emits stripDesignOnly(stripRationale(source)).
  // MEASURED on this working tree (chars/4): 3013 ~tok exactly. That is 1187 ~tok BELOW the
  // rationale-stripped (design-arm) figure of 4200 — the per-dispatch saving on non-design
  // features. Pin both the floor AND the saving so a fence-shrink regression (less stripped)
  // or a marker-cost blowout is caught. The +39 marker cost on the kept path is the price of
  // this 1187 saving on the stripped path.
  const ratStripped = approxTokens(stripRationale(CONSTITUTION));         // design-arm path: 4200
  const nonDesign = approxTokens(stripDesignOnly(stripRationale(CONSTITUTION))); // non-design path: 3013
  assert.ok(nonDesign <= 3013, `non-design constitution (${nonDesign} ~tok) must be ≤ 3013 (AC8 non-design floor)`);
  assert.ok(
    ratStripped - nonDesign >= 1187,
    `design-only strip saving (${ratStripped - nonDesign} ~tok) must be ≥ 1187 (the budget win)`,
  );
});

test("AC8: chain-role non-design bundle is ~1187 ~tok lighter than the design-armed bundle", () => {
  // WHY: end-to-end budget confirmation at the BUNDLE level (constitution + skill body), the
  // thing actually injected per dispatch. The non-design sr-engineer bundle must be materially
  // lighter than the design-armed one by the design-only span size — proving the saving lands
  // in the real dispatch, not just the isolated stripper.
  const skillSr = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const body = skillSr.startsWith("---")
    ? skillSr.slice(skillSr.indexOf("---", 3) + 3).trimStart()
    : skillSr;
  const skillBody = stripRationale(body);
  const designBundle = approxTokens(stripRationale(CONSTITUTION) + SEP + skillBody);
  const nonDesignBundle = approxTokens(stripDesignOnly(stripRationale(CONSTITUTION)) + SEP + skillBody);
  assert.ok(
    designBundle - nonDesignBundle >= 1187,
    `non-design bundle must be ≥ 1187 ~tok lighter (design ${designBundle} − non-design ${nonDesignBundle})`,
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
