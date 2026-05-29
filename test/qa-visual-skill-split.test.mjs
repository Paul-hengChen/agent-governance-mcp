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
  assert.match(body, /Widget shape miss.*visual_fail:.*next_role:\s*sr-engineer/is, "widget shape miss must target sr-engineer with visual_fail token");
  assert.match(body, /Pixel drift.*visual_fail:\s*pixel.*next_role:\s*sr-engineer/is, "pixel drift route must carry visual_fail: pixel token");
  assert.match(body, /Missing baseline.*next_role:\s*design-auditor/is, "missing baseline must route to design-auditor");
  assert.match(body, /Missing impl.*visual_fail:\s*missing_impl.*next_role:\s*sr-engineer/is, "missing impl must carry visual_fail: missing_impl token");

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
  assert.ok(qaSize <= 8500, `qa-engineer.md must be <= 8500 bytes (got ${qaSize})`);
  // qa-visual.md: v3.14.0 carries shape checklist + widget routes; cap
  // raised from 2400 to 4700 to accommodate the new contract.
  assert.ok(qaVisualSize <= 4700, `qa-visual.md must be <= 4700 bytes (got ${qaVisualSize})`);
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
  assert.match(combined, /next_role:\s*sr-engineer/, "sr-engineer route must exist");
  assert.match(combined, /next_role:\s*design-auditor/, "design-auditor route must exist");
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
