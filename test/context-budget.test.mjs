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
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const CONSTITUTION = fs.readFileSync(path.join(ROOT, "content", "constitution.md"), "utf-8");
const approxTokens = (t) => Math.ceil(t.length / 4);

const { stripChainOnly, stripRationale, buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));

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

test("AC8: rationale-stripped constitution is at/below the measured floor (≤ 4161 ~tok)", () => {
  // WHY: floor pinned by decodename-cleanup (T-DCN-04, AC-FLOOR), superseding the
  // T-GTL-06 floor of 4153. De-codenaming the always-loaded constitution required HC-5
  // provenance redirects on L49 + L60-61 — inline `(see content/constitution-rationale.md …)`
  // pointers replacing the bare "CDE-OOBE" codename. Those pointers sit OUTSIDE the §1/§7
  // rationale fences, so stripRationale() keeps them, and they are longer than the codename
  // they replaced → +8 ~tok. This is the irreducible cost of de-codenaming WITH a provenance
  // redirect: the constitution loads STANDALONE into external client workspaces (without this
  // repo's CLAUDE.md / surrounding docs), so the inline pointer is exactly what preserves
  // provenance discoverability for outside operators — dropping it to claw back 8 ~tok would
  // defeat the cleanup's purpose. Ratified by PM (coordinator-reviewed, human-approved).
  // MEASURED against this working tree with the test's own chars/4 estimator (NOT assumed):
  // raw 4233 → stripped 4161 ~tok (exact), saving 72 (still ≥ 49). package.json stays 3.31.0.
  const raw = approxTokens(CONSTITUTION);
  const stripped = approxTokens(stripRationale(CONSTITUTION));
  assert.ok(stripped <= 4161, `stripped constitution (${stripped} ~tok) must be ≤ 4161 (AC8 floor)`);
  assert.ok(
    raw - stripped >= 49,
    `constitution saving (${raw - stripped} ~tok) must be ≥ 49 (AC8 measured min)`,
  );
});

test("AC8: teamwork coordinator bundle (both strips) is at/below the floor (≤ 7626 ~tok)", () => {
  // WHY: the constitution is injected on every dispatch; the full coordinator bundle is
  // the worst case. Compose the chain-role bundle the way buildPromptForRole does:
  // rationale-stripped constitution + SEP + rationale-stripped skill body. Floor ≤ 7626.
  const skillCoord = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator.md"), "utf-8");
  const body = skillCoord.startsWith("---")
    ? skillCoord.slice(skillCoord.indexOf("---", 3) + 3).trimStart()
    : skillCoord;
  const SEP = "\n\n---\n\n";
  const bundle = approxTokens(stripRationale(CONSTITUTION) + SEP + stripRationale(body));
  assert.ok(bundle <= 7626, `teamwork stripped bundle (${bundle} ~tok) must be ≤ 7626 (AC8 floor)`);
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
