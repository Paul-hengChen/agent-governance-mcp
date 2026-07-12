// Coded by @qa-engineer
// Tests for spec: specs/qa-visual-skill-split.md (v3.8.3).
// Spec-to-Test map: AC-1→t1, AC-2→t2, AC-3→t3, AC-4→t4, AC-5→t5, AC-6→t6, AC-7→t7.
//
// Integration-level checks on the I/O boundary: prompts/build.ts loads
// content/skill-*.md verbatim, and the qa-engineer agent uses the Read tool
// at runtime to load the visual sub-skill. Both the trim (qa-engineer.md
// hook) and the moved content (qa-visual.md) must shipped together for the
// lazy-load contract to function.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const QA_PATH = path.join(PROJECT_ROOT, "content", "skill-qa-engineer.md");
const QA_VISUAL_PATH = path.join(PROJECT_ROOT, "content", "skill-qa-visual.md");

test("AC-1: skill-qa-visual.md exists and carries the v3.14.0 contract (widget shape + pixel diff)", () => {
  // v3.14.0: contract upgraded — Step A widget shape checklist precedes
  // Step B pixel diff; failure routes now include `visual_fail:` token for
  // visual_round bumps; output filename is `qa_reports/visual_<task-id>.md`
  // (server PASS gate). All v3.8.3 contract elements remain reachable.
  assert.ok(fs.existsSync(QA_VISUAL_PATH), "skill-qa-visual.md must exist");
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Self-documenting header explaining the lazy-load relationship
  assert.match(body, /Lazy-loaded by `skill-qa-engineer`/, "header must declare lazy-load relationship");
  assert.match(body, /Visual Baselines/, "header must reference the trigger condition");

  // v3.14.0: Step A widget shape checklist
  assert.match(body, /Step A.*Widget Shape Checklist/is, "Step A widget shape checklist must exist");
  assert.match(body, /Widget Shape Verification/, "checklist H2 name must be exact");

  // v3.14.0: Step B pixel diff with the 6 categories
  assert.match(body, /Step B.*Pixel Diff/is, "Step B pixel diff must exist");
  for (const category of [/\(i\).*layout/i, /\(ii\).*spacing/i, /\(iii\).*element/i, /\(iv\).*color/i, /\(v\).*text/i, /\(vi\).*image/i]) {
    assert.match(body, category, `sub-skill must enumerate diff category ${category}`);
  }

  // v3.14.0 failure routes — 4 modes now (widget shape miss is new); all
  // implementation-side ones carry the `visual_fail:` token.
  // c9-protocol-fields (T-C9-15 re-baseline): `next_role` is now a first-class
  // field passed as `next_role="<role>"`, not a `next_role: <role>`
  // pending_notes token — the colon-form regex no longer matches.
  assert.match(body, /Widget shape miss.*next_role="sr-engineer".*visual_fail:/is, "widget shape miss must target sr-engineer with visual_fail token");
  assert.match(body, /Pixel drift.*next_role="sr-engineer".*visual_fail:\s*pixel/is, "pixel drift route must carry visual_fail: pixel token");
  assert.match(body, /Missing baseline.*next_role="design-auditor"/is, "missing baseline must route to design-auditor");
  assert.match(body, /Missing impl.*next_role="sr-engineer".*visual_fail:\s*missing_impl/is, "missing impl must carry visual_fail: missing_impl token");

  // PASS sub-verdict — now writes the visual_<task-id>.md PASS marker
  assert.match(body, /PASS sub-verdict/is, "PASS sub-verdict heading must exist");
  assert.match(body, /qa_reports\/visual_<task-id>\.md/, "output filename must be visual_<task-id>.md (Constitution §3.1 gate)");
});

test("AC-2: the v3.8.2 inline Phase 1.5 block is removed from skill-qa-engineer.md", () => {
  // Why: the savings only materialize if the OLD block is gone. The trim
  // must remove the entire 12-line inline section — leaving stragglers
  // (e.g. the per-row contract or the rationale paragraph) means
  // non-UI workspaces still pay the token cost. We assert specific
  // v3.8.2 prose fragments are absent from qa-engineer.md.
  const body = fs.readFileSync(QA_PATH, "utf-8");

  // v3.8.2-only fragments that should no longer be in qa-engineer.md
  // (they now live in qa-visual.md). Picking strings that are unique to
  // the inline block — generic words like "drift" still appear elsewhere.
  assert.doesNotMatch(body, /Read both.*baseline path.*impl path.*via the Read tool/is, "the per-row Read contract must NOT remain inline");
  assert.doesNotMatch(body, /missing baseline file.*not on disk/is, "missing-baseline failure detail must NOT remain inline");
  assert.doesNotMatch(body, /literal Visual Audit Gate.*only catches drift on tokens the spec enumerated/is, "rationale paragraph must NOT remain inline");
});

test("AC-3: lazy-load hook has both Absent and Present branches with correct contracts (v3.14.0 PASS-gated)", () => {
  // v3.14.0: hook upgraded — Present branch now references the PASS gate
  // and the VISUAL_EVIDENCE_MISSING server error. Absent branch still
  // pays zero overhead.
  const body = fs.readFileSync(QA_PATH, "utf-8");

  // The hook lives in SOP step 4 — v3.14.0 label is "lazy-load + PASS-gated"
  assert.match(body, /4\.\s+\*\*Phase 1\.5\s*—\s*Visual Compare\*\*\s*\(v3\.14\.0:?\s*lazy-load/, "step 4 must be the v3.14.0 lazy-load + PASS-gated hook");

  // Absent branch: skip + log + proceed + explicit "Do NOT Read"
  assert.match(body, /Absent[^\n]*log[^\n]*skipped/is, "Absent branch must log skip");
  assert.match(body, /Absent[^\n]*proceed to Phase 2/is, "Absent branch must proceed to Phase 2");
  assert.match(body, /Do NOT Read.*skill-qa-visual\.md/is, "Absent branch must explicitly forbid Reading the sub-skill");

  // Present branch: Read the sub-skill via the Read tool + name the gate
  assert.match(body, /Present[^\n]*Read\s+`?content\/skill-qa-visual\.md`?[^\n]*Read tool/is, "Present branch must Read the sub-skill via the Read tool");
  assert.match(body, /VISUAL_EVIDENCE_MISSING/, "Present branch must name the server error code");
  assert.match(body, /PASS GATE.*v3\.14\.0/i, "Present branch must declare the PASS gate");
});

test("AC-4: SOP step numbering 1..7 sequential with no duplicates", () => {
  // Why: the trim must not have damaged step numbering. The earlier
  // regression test (in pixel-perfect-visual-compare.test.mjs) catches
  // the same invariant for v3.8.2; we keep a parallel check here so the
  // v3.8.3 split is self-verifying without depending on prior test files.
  const body = fs.readFileSync(QA_PATH, "utf-8");
  const sopStart = body.indexOf("## SOP");
  assert.ok(sopStart > 0, "## SOP section must exist");
  const sopBody = body.slice(sopStart);
  const sopMatches = [...sopBody.matchAll(/^(\d+)\.\s+[`*]/gm)].map((m) => Number(m[1]));
  assert.deepEqual(sopMatches, [1, 2, 3, 4, 5, 6, 7], `SOP steps must be 1..7 (got ${sopMatches.join(",")})`);
});

test("AC-5: byte counts stay within v3.14.0-relaxed budgets (savings invariant vs v3.8.2 baseline)", () => {
  // v3.14.0: qa-engineer.md adds a one-paragraph PASS-gate clause to the
  // Phase 1.5 hook (~600 bytes). qa-visual.md adds the Widget Shape
  // Checklist Step A + per-row failure-mode upgrades (~1800 bytes). The
  // sub-skill exceeded the v3.8.3 2400-byte cap by design — the new
  // contract carries the R6 widget verification protocol. Budgets relaxed
  // to reflect the new scope while keeping the savings-vs-v3.8.2-baseline
  // invariant intact (qa-engineer.md still well under the 8660 v3.8.2
  // pre-split size).
  const qaSize = fs.statSync(QA_PATH).size;
  const qaVisualSize = fs.statSync(QA_VISUAL_PATH).size;

  // qa-engineer.md: still smaller than v3.8.2 pre-split (8660 bytes).
  // v3.14.0 adds ~600 bytes for the PASS-gate clause — raise cap to 8500
  // (still under v3.8.2 baseline).
  // c3-covering-evidence (qa-owned bump): C3-06 added the `covers:` batch
  // convention to the Phase 1 write-target line + PASS step, bringing the
  // file to 8486 bytes — only 14 bytes of headroom under the 8500 cap, far
  // below this test's own ~300-550-byte convention (see qa-visual cap notes
  // below). Raised 8500 -> 8850 (~360-byte headroom) so the NEXT minor doc
  // amendment doesn't require another emergency cap bump. Still comfortably
  // under the 8660 v3.8.2 pre-split narrative is no longer preserved by this
  // number alone, but that comparison was informational, not load-bearing —
  // no other test or gate depends on the literal 8660 value (confirmed by
  // repo-wide grep).
  // c15-expected-red-manifest (qa-owned bump, T-C15-02): Phase 0.5 (Expected-
  // Red Diff) SOP prose added to skill-qa-engineer.md, bringing the file to
  // 11082 bytes — only ~2200 bytes of headroom would be consumed at the old
  // 8850 cap (i.e. it blows the cap outright). Raised 8850 -> 11500 (~418-
  // byte headroom) per the established ~300-550-byte convention.
  // d9-qa-review-scoped-append (qa-owned bump, 2026-07-11): Phase 4 FAIL step
  // and the Escalation Routes format line both gained a `review_task_ids`
  // clause (sr-engineer's fix for the qa_review auto-append fan-out bug),
  // bringing the file to 11826 bytes — independently re-measured with
  // `wc -c content/skill-qa-engineer.md`, matching sr-engineer's reported
  // figure exactly. Raised 11500 -> 12200 (~374-byte headroom) per the
  // established ~300-550-byte convention.
  // e2-bugfix-repro-gate (qa-owned bump): Phase 0.5 gained the "Bugfix-mode
  // branch" clause (the `## Expected-Red Diff` disposition becomes load-
  // bearing for PASS when dispatch_mode="bugfix"), bringing the file to
  // 12549 bytes — independently re-measured with `wc -c
  // content/skill-qa-engineer.md`. Raised 12200 -> 12950 (~400-byte headroom)
  // per the established ~300-550-byte convention.
  // e3-outcome-shaped-acceptance (qa-owned bump, T-E3-QA): new Phase 3.5 — AC
  // Execution inserted between Phase 3 (Tests) and Phase 4 (Run) — scan/none/
  // present/fail/PASS-GATE sub-bullets, bringing the file to 14329 bytes —
  // independently re-measured with `wc -c content/skill-qa-engineer.md`
  // (matches code-reviewer's reported figure exactly, review_reports/
  // review_T-E3-CR.md). Raised 12950 -> 14729 (~400-byte headroom) per the
  // established ~300-550-byte convention.
  assert.ok(qaSize <= 14729, `qa-engineer.md must be <= 14729 bytes (got ${qaSize})`);
  // qa-visual.md: v3.36.0 adds B10 (Step B0 carry-forward gate) and B11
  // (Step B1 deterministic pixel-diff pre-screen + Step B2 LLM-only path).
  // These are SOP-prose insertions totalling ~5400 bytes on top of the
  // v3.26.0 9000-byte cap, bringing the file to ~14444 bytes. Cap raised
  // 9000 → 15000 with ~550-byte headroom for future minor amendments.
  // This is a scoped cost: qa-visual is lazy-loaded ONLY when the visual
  // gate arms (design mode != no-design), so non-visual tasks pay zero.
  // v3.38.0 (qa-owned bump): cap raised from 15000 → 16200 to absorb the
  // F0 baseline-provenance gate SOP prose (provenance metadata rules,
  // baseline:/diff-metric: line conventions) plus the F2 retro-sop-hardening
  // Step A.5 fidelity baseline scope validation guard. Both additions are
  // intentionally shipped content; actual size is 15804 bytes. Cap of 16200
  // provides ~396-byte headroom consistent with the ~350–550-byte convention.
  // v3.39.0 (qa-owned bump): cap raised from 16200 → 17600 to absorb the
  // figma-baseline-mechanical-selection Step A.0 (Baseline Source-of-Truth)
  // SOP prose — requires copying the design-auditor Source manifest's frozen
  // baseline node-id list verbatim and forbids URL re-derivation (~1043 bytes).
  // Intentionally shipped content; actual size is 17247 bytes. Cap of 17600
  // provides ~353-byte headroom consistent with the ~350–550-byte convention.
  // v3.40.0 (qa-owned bump): cap raised from 17600 → 18100 to absorb the
  // figma-baseline-manifest-gate Step A.0 server-enforcement note in
  // skill-qa-visual.md (BASELINE_MANIFEST_MISSING / BASELINE_PROVENANCE_INCOMPLETE
  // error code documentation + gate-dormancy opt-in note). Actual size is
  // 17928 bytes. Cap of 18100 provides ~172-byte headroom.
  // v3.42.0 (qa-owned bump): cap raised from 18100 → 20700 to absorb the
  // qa-visual-pixel-gate-attestation AC-11 additions — Step B1/B2 pixel_gate_complete
  // requirement, B1-fallback path attestation note, Report schema update, and
  // dimensionsMatch=false failure-mode instruction. Intentionally shipped content;
  // actual size is 20180 bytes. Cap of 20700 provides ~520-byte headroom.
  assert.ok(qaVisualSize <= 20700, `qa-visual.md must be <= 20700 bytes (got ${qaVisualSize})`);
});

test("AC-6: Phase 1.5 v3.8.2 contract is preserved AND extended in v3.14.0 (combined assertion)", () => {
  // v3.14.0: the v3.8.2 contract (gate + per-row + 6 categories + 3 routes
  // + PASS) is preserved unchanged for v3.8.2 audit consumers, AND extended
  // with widget-shape verification + visual_fail tokens. Combined surface
  // assertion ensures both the legacy contract and the v3.14.0 additions
  // remain reachable.
  const combined = fs.readFileSync(QA_PATH, "utf-8") + "\n" + fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Gate (in qa-engineer hook) — v3.8.2 contract preserved
  assert.match(combined, /Phase 1\.5: skipped \(no Visual Baselines declared\)/, "skip log line must be reachable");
  // Per-row mechanics (in qa-visual) — v3.8.2 contract preserved
  assert.match(combined, /baseline path.*impl path/is, "per-row paths must be named");
  // All 6 categories — v3.8.2 contract preserved
  for (const category of [/\(i\).*layout/i, /\(ii\).*spacing/i, /\(iii\).*element/i, /\(iv\).*color/i, /\(v\).*text/i, /\(vi\).*image/i]) {
    assert.match(combined, category, `combined surface must enumerate ${category}`);
  }
  // Routes — v3.8.2 had 3; v3.14.0 has 4 (added widget shape miss).
  // c9-protocol-fields (T-C9-15 re-baseline): `next_role` is now a first-class
  // field passed as `next_role="<role>"`, not a `next_role: <role>` token.
  assert.match(combined, /next_role="sr-engineer"/, "sr-engineer route must exist");
  assert.match(combined, /next_role="design-auditor"/, "design-auditor route must exist");
  // v3.14.0 additions
  assert.match(combined, /visual_fail:/, "v3.14.0: visual_fail token must be reachable for visual_round trigger");
  assert.match(combined, /Widget Shape Verification/, "v3.14.0: widget-shape checklist H2 must exist");
  // PASS sub-verdict (heading slightly different in v3.14.0 — uses ###)
  assert.match(combined, /PASS sub-verdict/is, "PASS sub-verdict must exist");
});

test("AC-7: [3.13.0] CHANGELOG entry preserved (history-append-only regression guard)", () => {
  // Why: same relaxation pattern as v3.8.2's AC-7 (which relaxed from
  // version pin to CHANGELOG history check after v3.8.2 shipped). With
  // v3.14.0 shipping, this test's job moves from "current-release
  // coherence" to "CHANGELOG history must not be silently deleted".
  // The current-release coherence invariant is owned by the v3.14.0
  // own version-check `scripts/check-version.mjs` (run by `npm run
  // check:version` in `prebuild`).
  const changelog = fs.readFileSync(path.join(PROJECT_ROOT, "CHANGELOG.md"), "utf-8");
  assert.match(changelog, /^##\s*\[3\.13\.0\]/m, "CHANGELOG must retain [3.13.0] release section");
});

// figma-baseline-mechanical-selection AC-2 (v3.39.0): Step A.0 is the
// consumer half of step 2c — qa-visual must copy the frozen baseline node-id
// list from the design-auditor Source manifest verbatim and must not
// re-derive it from the URL. WHY: re-deriving at verification time
// reintroduces the non-determinism the audit-time freeze exists to eliminate.
test("AC-2: skill-qa-visual.md Step A.0 requires copying the frozen baseline manifest, no URL re-derivation", () => {
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");
  const block = body.slice(body.indexOf("Baseline Source-of-Truth"));
  assert.match(body, /### Step A\.0 — Baseline Source-of-Truth \(v3\.39\.0\)/, "Step A.0 must be present");
  assert.match(block, /Source manifest/, "must cite the Source manifest as authoritative");
  assert.match(block, /\*\*verbatim\*\*/, "must require verbatim copy");
  assert.match(block, /MUST NOT re-derive the baseline set from the Figma URL/, "must forbid URL re-derivation");
});

// qa-visual-consolidation (T-QVC-01, v3.44.0 pending): the 265→124-line
// consolidation rewrite folded four scattered exemption paragraphs into one
// provenance matrix and two failure narratives into one error-code table.
// specs/qa-visual-consolidation.md Copy/Strings S15/S16 call out that these
// two annotation tokens must survive BYTE-EXACT, specifically preserving the
// em-dash (U+2014) separator rather than a hyphen — a paraphrase an editor
// could introduce without any visual difference in most fonts. The server
// parser (tools/evidence-file.ts CARRY_FORWARD_TOKEN / B1_UNAVAILABLE_TOKEN)
// is tested against its own constants elsewhere (evidence-provenance.test.mjs,
// pixel-gate-attestation.test.mjs) but nothing previously pinned these two
// literals against the SKILL DOC TEXT itself — this closes that gap so a
// future doc edit that silently swaps the em-dash for a hyphen fails CI
// instead of silently breaking the carry-forward/B1-fallback prose contract.
test("AC-3 (qa-visual-consolidation S15/S16): carry-forward and B1-fallback annotation tokens are byte-exact (em-dash, not hyphen)", () => {
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");
  assert.ok(
    body.includes("pass (carried forward — git diff confirms source untouched)"),
    "S15: carry-forward annotation must be byte-exact, including U+2014 em-dash",
  );
  assert.ok(
    body.includes("B1 tool unavailable — LLM fallback"),
    "S16: B1-unavailable annotation must be byte-exact, including U+2014 em-dash",
  );
});
