// Coded by @qa-engineer
// Tests for spec: specs/context-budget-reduction.md (lean always-on bundle, enforcement kept).
// WHY: the lean bundle drops chain-only fragments for LITE contexts only. Pinned here: lite loses
// ONLY chain rules, chain roles keep everything, and the hook and measure script import the one
// shared manifest instead of re-deriving a fragment list. Constitution assembly is additive
// (composeConstitution), so the old stripper-internals tests are gone.
// Spec-to-test map: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).

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
// d6-host-capability-compose-axis (T-D6-04): content/skill-coordinator.md is
// retired — reads of it below go through the real composer (taskTool:true
// reproduces the monolith byte-for-byte; AC5) instead of a raw fs.readFileSync
// against a file that no longer exists on disk.
const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
function readSkillFile(f) {
  return composeSkill(f, hostCapabilitiesFor("claude-code"), (g) => fs.readFileSync(path.join(ROOT, "content", g), "utf-8"));
}
// Five skill files (architect, pm, design-auditor, researcher, sr-engineer) take their step-1 line
// from content/partial-step1-preflight.md through a {{PARTIAL:...}} token that the real pipeline
// expands. A raw fs.readFileSync would see the bare token, so tests use the same expander.
const { expandPartials } = await import(path.join(ROOT, "dist", "prompts", "partials-manifest.js"));
function loadPartial(f) {
  return fs.readFileSync(path.join(ROOT, "content", f), "utf-8");
}
function expandSkill(rawBody) {
  return expandPartials(rawBody, loadPartial);
}

// compose-not-strip (ticket A9, T-CNSO-07): CONSTITUTION was `fs.readFileSync(content/
// constitution.md)`; it is now the composed-all bundle, which Option R (architecture
// DR-1) guarantees is byte-identical to the retired monolith — composeConstitution's
// own equivalence is independently pinned in test/compose-equivalence.test.mjs (T-CNSO-08)
// against a pre-refactor golden fixture, so every downstream assertion in this file that
// slices/searches CONSTITUTION is unaffected by the migration.
const CONSTITUTION = composeConstitution({ chain: true, design: true });

// The hook's lite composition (chain fragments excluded, design fragments kept — the
// hook never stripped design; see architecture Hook Parity Contract) with the blank-run
// collapse the old stripChainOnly performed. Reused by the reduction/enforcement (AC2/AC3) lean-bundle tests
// below, which previously called the now-deleted stripChainOnly(CONSTITUTION) directly.
const LEAN_CONSTITUTION = composeConstitution({ chain: false, design: true }).replace(/\n{3,}/g, "\n\n");

// Markers that prove a section is present/absent in a rendered bundle.
const CHAIN_MARKERS = ["3.1 Server-enforced chain", "4. Routing Chain"];
const UNIVERSAL_MARKERS = ["NO YAPPING", "Strict typing", "Anti-Loop Circuit Breaker", "Access Denied", "Cognitive Discipline"];

// governance-text-load (F-B, v3.31.0): rule/gate/SOP markers that MUST survive stripRationale.
// These are the operative clauses the agent acts on — only "Reason:/Rationale:" prose is fenced.
// Losslessness rule (spec AC9): no fence may swallow a rule heading, gate name, MUST clause, or numbered SOP step.
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
  // e110-pm-parallel-lane-template (T-E110-03, AC1/AC2/AC3): the Parallel-Lane Cut
  // gate row's operative clauses must survive stripRationale — the audit step and
  // the serial-escape guardrail are imperative rules, not rationale prose.
  "Parallel-Lane Cut",
  "Per-AC `proof:` audit",
  "serial — shared layer",
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

// --- Partial-substitution byte-identity ---
// WHY: for the 5 partial-adopting roles the composed skill portion must equal the old hand-written
// step-1 line. The direct expandPartials test is the primary assertion; the per-role
// buildPromptForRole and switchRole tests prove both render paths wire it in, since a miss would
// leak a raw {{PARTIAL:...}} token or drop the line.
// Spec: specs/a12-partials-limits-registry-architecture.md.
const STEP1_LINE = "1. `tw_get_state` → `tw_detect_drift`.";
const PARTIAL_ADOPTING_SKILLS = [
  "skill-architect.md",
  "skill-pm.md",
  "skill-design-auditor.md",
  "skill-researcher.md",
  "skill-sr-engineer.md",
];

test("AC2: expandPartials(step1-preflight token) equals the exact pre-refactor step-1 line (byte-identical)", () => {
  // WHY: this is the whole byte-identity contract distilled to one call — the loaded
  // partial file, minus its one conventional trailing newline (architecture decision DR-3), must equal the
  // literal bytes every one of the 5 skills used to hand-author on their own step-1 line.
  const actual = expandPartials("{{PARTIAL:step1-preflight}}", loadPartial);
  assert.equal(actual, STEP1_LINE, "expandPartials must reproduce the exact pre-refactor step-1 line, byte-for-byte");
});

test("AC2: unknown partial token fails loud (DR-6) instead of silently passing through", () => {
  const actual = expandPartials("{{PARTIAL:no-such-token}}", loadPartial);
  assert.equal(actual, "[ERROR: unknown partial token 'no-such-token']", "unknown token must substitute the visible fail-loud marker");
});

test("AC2: text with zero {{PARTIAL:...}} matches passes through expandPartials unchanged", () => {
  const text = "no partial tokens in this constitution fragment";
  assert.equal(expandPartials(text, loadPartial), text, "no-token text must be returned unchanged");
});

for (const skillFile of PARTIAL_ADOPTING_SKILLS) {
  test(`AC2: buildPromptForRole(${skillFile}) composed output carries the expanded step-1 line, no leaked token`, async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twa12-"));
    setActiveStorage(new FileHandoffStorage());
    const s = new FileHandoffStorage();
    await s.writeState(ws, "a12-fixture-feat", "In_Progress", [], []);
    const text = buildPromptForRole(skillFile, "a12-check", ws, false).messages[0].content.text;
    fs.rmSync(ws, { recursive: true, force: true });
    assert.ok(text.includes(STEP1_LINE), `${skillFile} composed dispatch must contain the expanded step-1 line verbatim`);
    assert.ok(!text.includes("{{PARTIAL:"), `${skillFile} composed dispatch must not leak a raw {{PARTIAL:...}} token`);
  });
}

test("AC2/DR-4: tools/role.ts switchRole (the second render path) also expands the step-1 partial for all 5 roles", async () => {
  // WHY: switchRole does NOT flow through buildPromptForRole (the wiring decision, architecture DR-4) — a
  // separate wiring site that, if missed, would leak the raw token specifically on the
  // tw_switch_role tool path while buildPromptForRole looked fine. Exercise both to close
  // the full wiring contract (DR-4).
  const { switchRole } = await import(path.join(ROOT, "dist", "tools", "role.js"));
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "twa12-role-"));
  try {
    const roleFor = {
      "skill-architect.md": "architect",
      "skill-pm.md": "pm",
      "skill-design-auditor.md": "design-auditor",
      "skill-researcher.md": "researcher",
      "skill-sr-engineer.md": "sr-engineer",
    };
    for (const [skillFile, role] of Object.entries(roleFor)) {
      const response = JSON.parse(switchRole(role, ws));
      assert.ok(response.sop.includes(STEP1_LINE), `switchRole("${role}") sop must contain the expanded step-1 line verbatim`);
      assert.ok(!response.sop.includes("{{PARTIAL:"), `switchRole("${role}") sop must not leak a raw {{PARTIAL:...}} token`);
    }
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test("DR-5 guard (T-A12-09): no literal {{PARTIAL:...}} token may appear in any const-*.md, skill-coordinator.md, or skill-coordinator-lite.md source file", () => {
  // WHY: the SessionStart hook renders only the coordinator skills, and neither they nor the
  // const-*.md fragments go through expandPartials. A {{PARTIAL:...}} token in any of them would
  // reach the agent unexpanded; this source grep catches it earlier than a composed-output test.
  const CONTENT_DIR = path.join(ROOT, "content");
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => /^const-\d\d-/.test(f));
  // d6-host-capability-compose-axis (T-D6-04): content/skill-coordinator.md is
  // retired — its source is now the coord-NN-*.md fragment set (composeSkill
  // concatenates them; neither the fragments nor the composed result flow
  // through expandPartials at the fragment-file level), so scan those instead
  // of a monolith file that no longer exists on disk.
  files.push(...fs.readdirSync(CONTENT_DIR).filter((f) => /^coord-\d\d-/.test(f)), "skill-coordinator-lite.md");
  for (const f of files) {
    const body = fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
    assert.ok(!/\{\{PARTIAL:/.test(body), `${f} must not contain a literal {{PARTIAL:...}} token (DR-5: rendered outside expandPartials)`);
  }
});

// --- reduction (AC2) -------------------------------------------------------

test("AC2: lean always-on bundle is below the raw baseline and within target (<= 5548 ~tok)", () => {
  // Cap rule: each raise is a re-measure (qa-owned unless noted sr-owned), and the cap is the
  // exact measured size (zero headroom).
  // Bump history: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).
  const liteSkill = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator-lite.md"), "utf-8");
  const SEP = "\n\n---\n\n";
  const raw = approxTokens(CONSTITUTION + SEP + liteSkill);
  const lean = approxTokens(LEAN_CONSTITUTION + SEP + liteSkill);
  assert.ok(lean < raw, `lean (${lean}) must be < raw (${raw})`);
  assert.ok(lean <= 5548, `lean always-on (${lean} ~tok) must meet the <= 5548 target (E258 re-baseline)`);
});

// --- enforcement preserved (AC3) ------------------------------------------

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
// fragments by tag, never parses markers (the unbalanced-fence failure (AC11)
// class is gone structurally, not guarded against). See T-manifest-not-duplicated
// below and test/compose-equivalence.test.mjs for the replacement equivalence
// contract.

// --- SessionStart hook integration (AC3) ----------------------------------

// Isolation: runHook() gives every call its own throwaway managed workspace (a temp dir with a
// `.current/` marker). Running the hook against the real repo wrote a cross-process dedup marker
// into its `.current/`, which made a later test process (teamwork-lite AC3b) see a fresh marker
// and lose the constitution. No assertion is loosened; the hook finds content/ by its own path.
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

// --- omitConstitution size delta (prompt-state dedup) ---
// WHY: the dedup needs a concrete saving, not just "some". This isolates the size delta that
// buildPromptForRole's omitConstitution param produces: a second fetch in a dual-injection session
// pays only the sentinel instead of a second constitution copy. End-to-end proof is in
// test/prompt-state-footer.test.mjs; spec: specs/c6-c11-prompt-state-injection.md.
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
  // Measured: full 2575, omitted 1070, saved 1505 ~tok (coordinator-lite, non-design fixture: the
  // leanest arm, so a conservative saving). The 1200 floor sits ~300 below that, so routine edits
  // to the sentinel or the skill do not flap the test while a real reduction is still proven.
  assert.ok(omittedTok < fullTok, `omit=true bundle (${omittedTok} ~tok) must be smaller than omit=false (${fullTok} ~tok)`);
  assert.ok(
    fullTok - omittedTok >= 1200,
    `dual-injection saving (${fullTok - omittedTok} ~tok) must be >= 1200 ~tok (AC-9 concrete measurement)`,
  );
});

// --- measurement script (AC1) ---------------------------------------------

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

// --- shared manifest, not duplicated regex (DR-4) --------------------------

test("DR-4: hook and measure script import the shared constitution-manifest (no duplicated chain-only regex)", () => {
  // WHY: the old approach (DR-3, "keep 3 stripChainOnly regex copies in sync by inspection") is
  // replaced by the new approach (DR-4, "one exported CONSTITUTION_SEGMENTS + includeSegment,
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

// --- stripOriginTags coverage ---
// Unit contract (idempotent, no-marker passthrough, span removal), a mixed-content site (a paren
// shared by a provenance tag and normative text) at string level and through buildPromptForRole,
// and composition order against stripRationale. Spec: specs/governance-tag-strip.md.

test("T-GTS-07/AC3: stripOriginTags is idempotent, no-marker passthrough, and removes fenced spans", () => {
  // WHY: same unit contract as the three sibling strippers (spec AC3) — a
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
  // WHY: the disqualifying-finding contract (AC2), pinned directly against a known
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
  // WHY: the order-independence contract (AC4), narrowed post-compose-not-strip (T-CNSO-07)
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
// enforcement for every chain-role dispatch (losslessness, spec AC9, v3.31.0).

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
  // WHY: these are the rule headings and gate names the pm role acts on; none may sit inside a
  // rationale fence, or stripping would drop a gate from every pm dispatch. The step-1 line is
  // the bare {{PARTIAL:...}} token on disk, so expandSkill() applies the expansion a dispatch runs.
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  const stripped = stripRationale(expandSkill(SKILL_PM));
  for (const m of PM_RULE_MARKERS) {
    assert.ok(stripped.includes(m), `skill-pm stripped must still contain rule marker: ${JSON.stringify(m)}`);
  }
});

// The Ambiguity Gate STOP payload moved from a numbered sub-step into a Gate Summary table cell.
// It must stay byte-exact, including the em-dash (U+2014) rather than a hyphen, because an
// escalation handler reads the Blocked-state payload verbatim and nothing else pins this literal
// against the skill text. Spec: specs/skill-pm-consolidation.md.
test("AC8 (skill-pm-consolidation): Ambiguity Gate STOP payload is byte-exact (em-dash, not hyphen)", () => {
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  assert.ok(
    SKILL_PM.includes("PM blocked: ambiguous — <detail>"),
    "skill-pm.md must contain the Ambiguity Gate STOP payload byte-exact, including U+2014 em-dash",
  );
});

test("AC9: every operative rule/gate/SOP marker survives stripRationale in skill-sr-engineer.md", () => {
  // WHY: the stripped sr-engineer dispatch must keep the full operative SOP once rationale-only
  // prose is removed. This skill also takes its step-1 line from a partial, so expandSkill() makes
  // the test measure the composed text (no marker below names that line; consistency only).
  const SKILL_SR = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const expanded = expandSkill(SKILL_SR);
  const stripped = stripRationale(expanded);
  assert.ok(stripped.length < expanded.length, "stripped skill-sr must be shorter than the partial-expanded body");
  for (const m of SR_RULE_MARKERS) {
    assert.ok(stripped.includes(m), `skill-sr stripped must still contain rule marker: ${JSON.stringify(m)}`);
  }
});

test("AC1/AC2: skill-pm stripped token count meets ≤ 4376 cap", () => {
  // WHY: the stripped pm skill must stay within its reduction budget, bounding each pm dispatch.
  // Cap rule: a qa-owned re-measure sets the cap to the exact measured size (zero headroom). The
  // body is measured as production composes it: stripRationale(stripOriginTags(expandSkill(body))).
  // Bump history: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  // Strip frontmatter (--- block) before token-counting the body, matching buildPromptForRole.
  const body = SKILL_PM.startsWith("---")
    ? SKILL_PM.slice(SKILL_PM.indexOf("---", 3) + 3).trimStart()
    : SKILL_PM;
  const stripped = stripRationale(stripOriginTags(expandSkill(body)));
  const toks = approxTokens(stripped);
  assert.ok(toks <= 4401, `skill-pm stripped body (${toks} ~tok) must be ≤ 4401 (AC9, e164-e167-content-wave45 re-baseline)`);
});

test("AC1/AC2: skill-sr-engineer stripped token count meets ≤ 2642 cap", () => {
  // WHY: the same budget for the sr-engineer dispatch, with the same composition and zero-headroom
  // cap rule as the pm cap test above. History: specs/e260i-comment-rationale.md
  // (test/context-budget.test.mjs).
  const SKILL_SR = fs.readFileSync(path.join(ROOT, "content", "skill-sr-engineer.md"), "utf-8");
  const body = SKILL_SR.startsWith("---")
    ? SKILL_SR.slice(SKILL_SR.indexOf("---", 3) + 3).trimStart()
    : SKILL_SR;
  const stripped = stripRationale(stripOriginTags(expandSkill(body)));
  const toks = approxTokens(stripped);
  assert.ok(toks <= 2852, `skill-sr stripped body (${toks} ~tok) must be ≤ 2852 (AC2, e20-e21-crash-resilience-sop re-baseline)`);
});

// --- Constitution rationale fencing (second-round strip) ---
// WHY: the constitution is injected on every role-bundle dispatch, so it is the highest-leverage
// strip. Only two spans are pure illustration (the HTML-primitive example list in section 1 and the
// external-artifact example list in section 7); the rest of sections 1 and 7 is rule-dense and
// sections 3.1 and 3.2 are a hard exclusion zone. Pinned: byte-untouched 3.x, the measured token
// floor, and lossless stripping. Spec: specs/governance-text-load-architecture.md.

// Markers that MUST survive stripRationale on the constitution (operative rules; AC9).
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

test("AC8/AC-P2-7: rationale-stripped (design-arm) constitution is at/below the measured floor (≤ 10057 ~tok)", () => {
  // WHY: the design arm keeps design-only fenced text, so this floor sits above the non-design one.
  // Each cap is the exact re-measured value (chars/4 estimator), zero headroom; bumps are
  // qa-owned unless noted sr-owned.
  // Bump history and saving margins: specs/e260i-comment-rationale.md, design-arm floor history.
  const raw = approxTokens(CONSTITUTION);
  const stripped = approxTokens(stripRationale(stripOriginTags(CONSTITUTION)));
  // The later bumps (down to the Comment-discipline rule) are in the same history section.
  assert.ok(stripped <= 10057, `stripped constitution (${stripped} ~tok) must be ≤ 10057 (AC8 design-arm floor, E258 re-baseline)`);
  assert.ok(
    raw - stripped >= 240,
    `constitution rationale+origin-tag saving (${raw - stripped} ~tok) must be ≥ 240 (AC8 measured min, c14-dispatch-pins re-baseline)`,
  );
});

test("AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 20434 ~tok)", () => {
  // WHY: constitution injected on every dispatch; the full coordinator bundle is the worst case.
  // Composed like buildPromptForRole: stripped constitution + SEP + stripped skill body.
  // The coordinator is a chain role, so on a design feature it must keep the full §3.2.
  // Caps are exact re-measured values (chars/4), zero headroom unless the history says so:
  // specs/e260i-comment-rationale.md, teamwork coordinator bundle cap history.
  const skillCoord = readSkillFile("skill-coordinator.md");
  const body = skillCoord.startsWith("---")
    ? skillCoord.slice(skillCoord.indexOf("---", 3) + 3).trimStart()
    : skillCoord;
  const SEP = "\n\n---\n\n";
  const bundle = approxTokens(stripRationale(stripOriginTags(CONSTITUTION)) + SEP + stripRationale(stripOriginTags(body)));
  // Later bumps (the Test-file placement line through the Comment-discipline rule) are in the same
  // history: specs/e260i-comment-rationale.md, teamwork coordinator bundle cap history.
  // coord-*.md fragments land in this bundle only; the constitution-only floors are untouched.
  // A rationale fence on a normative sentence would delete it from this bundle; keep it unfenced.
  assert.ok(bundle <= 20434, `teamwork stripped bundle (${bundle} ~tok) must be ≤ 20434 (AC8 design-arm floor, E258 re-baseline)`);
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
  // WHY: fullDetail only opts out of stripRationale, not of the design-only exclusion. The §1
  // "column-scroller picker" example sits in a design-only fence, so it is absent on a non-design
  // fullDetail dispatch and kept on the design arm. The §7 "see XYZ" example is in no such fence
  // and survives on both arms.
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
// constitution-conditional-load: on a non-design feature the visual governance (§3.2, minus the
// reconcile rule, and the §3.1 visual bullets) is left out; a design-armed feature loads it whole.
// The arm signal is the one the server PASS gates use (hasDesignModeRequiringVisual).
// Spec: specs/constitution-conditional-load.md.
// Rationale: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).
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
// governance-tag-strip (T-GTS-04): the reconcile-rule sentinel (R10) lost its "(R10)" suffix — the bare
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

// §1 Span B: the three feature-inert bullets, absent on non-design, present on design.
// Full-bullet anchors, not bare bold tags: the bold-only forms also occur in skill bodies that
// cite the constitution, so a sentinel could survive there and fail the §1 strip check falsely.
// The "Visual Widgets exception (v3.14.0)" literal keeps its version tag on purpose: that site
// is not origin-fenced, so the tag ships. The other two lost theirs to the origin-tag strip.
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

// --- non-design strips the gatable visual span (AC1) ----------------------

// Removed in the move to composition: the stripDesignOnly unit and idempotence test. Design
// fragments are now chosen by file list in composeConstitution(), so the end-to-end test below
// and test/compose-equivalence.test.mjs carry the contract.

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

// --- design-armed loads the full visual governance (AC2) ------------------

test("AC2: chain-role build on a DESIGN-armed workspace LOADS the full §3.2 + visual §3.1", async () => {
  // WHY: the inverse contract. With design/<feature>.md `## Mode` = figma (≠ no-design),
  // the arm probe reports required=true → stripDesignOnly is NOT applied → every gated
  // span is present. Explicitly assert the §3.2 qa-visual-owned / No-global-frame-metric
  // sentinels load on the armed arm (the false-PASS contract that binds the coordinator).
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

// --- safe default — no state / no design file => strip (AC3) ---------------

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

// --- surviving rules are byte-identical to source (AC4) --------------------

test("AC4: §3.2 R10 (carve-out) survives byte-equal on BOTH arms — the gate never rewords it", async () => {
  // WHY: the reconcile rule ends §3.2 but is non-visual (drift check and sync after fan-out), so it
  // sits outside the design-only fence and must match source byte for byte on both arms.
  // The source anchor includes the inline origin fence around the finding code, because the raw
  // constitution still carries it.
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

// --- composition across all three axes (AC5 / HC5) -------------------------

// Removed in the move to composition: the six strip-order permutation test and the orphan-marker
// test. Fragment selection now happens once, in composeConstitution(), before the two remaining
// strippers run, and markers are never parsed, so neither failure can occur. Order independence
// of those two strippers is pinned earlier in this file; the byte-identity contract is in
// test/compose-equivalence.test.mjs.

// --- anti-sweep — non-visual contracts survive BOTH arms (AC6) -------------

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

// --- lite interaction (AC7) ------------------------------------------------

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

// --- rebaseline + pin the new non-design figure (AC8) ----------------------

test("AC8/AC-P2-7: non-design (design-only + rationale stripped) constitution is at/below the floor (≤ 7959 ~tok)", () => {
  // WHY: the budget win that justified the feature, regression-guarded. Both sides are measured
  // like production (origin tags, then rationale, stripped); the non-design side composes without
  // the design fragments. The cap is the exact measured size (zero headroom) and the design-only
  // saving must stay at least 2080 ~tok, since core and chain edits land on both arms.
  // Rationale: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).
  const ratStripped = approxTokens(stripRationale(stripOriginTags(CONSTITUTION)));         // design-arm path: 10057 (E258 re-baseline)
  const nonDesign = approxTokens(stripRationale(stripOriginTags(composeConstitution({ chain: true, design: false })))); // non-design path: 7959 (E258 re-baseline)
  // Floor bumps from e43 (test-file ask at dispatch) through E258 (comment-discipline bullet)
  // continue the same cap history, pointed to above.
  assert.ok(nonDesign <= 7959, `non-design constitution (${nonDesign} ~tok) must be ≤ 7959 (AC8 non-design floor, E258 re-baseline)`);
  assert.ok(
    ratStripped - nonDesign >= 2080,
    `design-only strip saving (${ratStripped - nonDesign} ~tok) must be ≥ 2080 (a12-followup-qa-round-name re-baseline)`,
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
  // WHY: the gate and the constitution text agree only if they key off the same arm signal.
  // build.ts and the tw_update_state gate handler both import hasDesignModeRequiringVisual; a
  // source grep pins the shared import against a future divergent re-implementation.
  // The gate body lives in tools/handoff-orchestrator.ts, not index.ts.
  const buildSrc = fs.readFileSync(path.join(ROOT, "prompts", "build.ts"), "utf-8");
  const orchestratorSrc = fs.readFileSync(path.join(ROOT, "tools", "handoff-orchestrator.ts"), "utf-8");
  // gate-registry refactor (A10, A2): hasDesignModeRequiringVisual moved from
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
// constitution-conditional-load phase 2: extend the design-only axis to two more feature-inert
// spans, the §4 visual prose and three §1 bullets (one rationale fence nested inside a
// design-only fence). No new mechanism, no server-gate change, no reworded rule; the §4 reflow
// only reorders. Spec: specs/constitution-conditional-load.md (Phase 2 section).
// Rationale: specs/e260i-comment-rationale.md (test/context-budget.test.mjs).
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

// Removed in the move to composition: the nested-rationale permutation sweep over the three
// strippers. Fragment selection is file inclusion before stripRationale runs, and the nested
// rationale span is stripped like any other. The universal-bullet byte-intact contract is
// covered by the anchoring tests below and the stripRationale unit tests above.

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
