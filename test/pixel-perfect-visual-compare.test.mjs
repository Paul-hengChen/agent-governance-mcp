// Coded by @qa-engineer
// Tests for spec: specs/pixel-perfect-visual-compare.md (Phase 2: Option B).
// Spec-to-Test map: AC-1→t1, AC-2→t2, AC-3→t3, AC-4→t4, AC-5→t5, AC-6→t6, AC-7→t7.
// t8 is a regression guard on the SOP step renumbering (manual markdown
// list renumbering bit us mid-implementation — see review_T49-T51.md).
//
// These are integration-level checks on the I/O boundary: prompts/build.ts
// loads content/skill-*.md verbatim into the rendered prompt, so the markdown
// contract shipped here IS the runtime behaviour. No pure-logic units exist
// for this markdown-only feature.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const AUDITOR_PATH = path.join(PROJECT_ROOT, "content", "skill-design-auditor.md");
const QA_PATH = path.join(PROJECT_ROOT, "content", "skill-qa-engineer.md");
// v3.8.3 split: Phase 1.5 SOP body moved to skill-qa-visual.md. The QA
// engineer file now only holds the lazy-load hook. Tests that assert
// Phase 1.5 *content* must read the sub-skill; tests that assert the
// *hook* still read QA_PATH.
const QA_VISUAL_PATH = path.join(PROJECT_ROOT, "content", "skill-qa-visual.md");

test("AC-1: design-auditor Artifact Schema declares Visual Baselines H2 with 4-col schema (v3.16.0: MANDATORY when mode != no-design)", () => {
  // Why: AC-1 anchors the entire Phase 2 contract on a single schema entry.
  // If the auditor doesn't declare *where* baselines live and *what* columns
  // they carry, QA Phase 1.5 has no place to look — the gate degrades to
  // permanent skip silently, defeating the feature. Surface id must FK to
  // Source manifest so deferred / out-of-scope rows can't masquerade as
  // baseline-capable.
  //
  // v3.16.0 (visual-fidelity-gate-hardening AC-2): the section changed from
  // OPTIONAL to "MANDATORY when mode != no-design". The server now arms the
  // visual gate on mode != no-design rather than on Visual Baselines presence,
  // so absence with a real mode BLOCKS PASS (VISUAL_BASELINES_REQUIRED).
  // The old "Absence MUST cause QA Phase 1.5 to skip silently" sentence is
  // intentionally removed; absence is now only legitimate for mode = no-design.
  const body = fs.readFileSync(AUDITOR_PATH, "utf-8");

  // Section heading present + marked MANDATORY when mode != no-design (v3.16.0)
  assert.match(body, /\*\*Visual Baselines\*\*\s*\*\(MANDATORY when mode/i, "Visual Baselines must be MANDATORY when mode != no-design (v3.16.0)");
  // v3.26.0: extended schema — surface id + source node + baseline/impl paths +
  // viewport + route + canonical state + compare region + notes.
  assert.match(body, /surface id\s*\|\s*source node\s*\|\s*baseline path\s*\|\s*impl path\s*\|\s*viewport\s*\|\s*route\s*\|\s*canonical state\s*\|\s*compare region\s*\|\s*notes/i, "extended (v3.26.0) Visual Baselines header must be present");
  // Surface id foreign-keys to Source manifest
  assert.match(body, /surface id.*MUST match.*Source manifest/is, "surface id must FK to Source manifest");
  // v3.16.0: absence is only legitimate for mode = no-design; other modes block at server
  assert.match(body, /Absence.*legitimate ONLY when.*mode\s*=\s*no-design/is, "absence must be legitimate ONLY for mode=no-design");
  // v3.16.0: absent + non-no-design mode blocks PASS via VISUAL_BASELINES_REQUIRED
  assert.match(body, /VISUAL_BASELINES_REQUIRED/i, "server blocks PASS with VISUAL_BASELINES_REQUIRED when baselines absent and mode != no-design");
});

test("AC-2: QA Phase 1.5 skips silently when Visual Baselines absent (v3.14.0 upgrade)", () => {
  // v3.14.0: the skip-if-absent contract is preserved AND upgraded to
  // "lazy-load + PASS-gated" when baselines ARE present. Absent branch
  // still pays zero overhead.
  const body = fs.readFileSync(QA_PATH, "utf-8");

  // Phase 1.5 step exists
  assert.match(body, /\*\*Phase 1\.5\s*—\s*Visual Compare\*\*/, "Phase 1.5 step must be named");
  // v3.14.0 label includes PASS-gated
  assert.match(body, /lazy-load \+ PASS-gated/i, "v3.14.0 label must declare PASS-gated");
  // Absent branch: explicit log + proceed to Phase 2
  assert.match(body, /Absent.*log.*skipped.*proceed to Phase 2/is, "absent branch must log skip and proceed to Phase 2");
  // Non-UI overhead claim
  assert.match(body, /zero overhead/i, "absent branch must promise zero overhead");
});

test("AC-3: per-row compare contract reads both PNGs and emits 6-category diff (v3.14.0: into visual_<task-id>.md under Pixel Diff)", () => {
  // v3.14.0: output filename changed from review_<task-id>.md to
  // visual_<task-id>.md (Constitution §3.1 PASS gate). Diff heading changed
  // from "## Phase 1.5 — Visual Compare" to "## Pixel Diff" (Step B). The
  // 6 categories and Read-tool contract are preserved.
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Read both files via Read tool
  assert.match(body, /Read both.*baseline path.*impl path.*via the Read tool/is, "both PNGs must be Read via the Read tool");
  // 6 enumerated categories (preserved from v3.8.2)
  for (const category of [
    /\(i\).*layout.*position/i,
    /\(ii\).*spacing.*alignment/i,
    /\(iii\).*element presence/i,
    /\(iv\).*color/i,
    /\(v\).*text content/i,
    /\(vi\).*image content/i,
  ]) {
    assert.match(body, category, `diff must enumerate category ${category}`);
  }
  // v3.14.0 output destination + heading
  assert.match(body, /qa_reports\/visual_<task-id>\.md/, "v3.14.0: output must land in visual_<task-id>.md (PASS gate)");
  assert.match(body, /##\s*Region Diff/, "v3.26.0: diff goes under `## Region Diff` (Step B; renamed from Pixel Diff — whole-frame %% banned)");
  assert.match(body, /sub-section per\s*`?surface id`?/i, "one sub-section per surface id");
});

test("AC-4: v3.14.0 — four distinct failure routes (widget shape + pixel drift + missing baseline + missing impl)", () => {
  // v3.14.0: routes expanded from 3 to 4. Widget shape miss is new; pixel
  // drift retains the prior drift slot. Missing baseline → design-auditor;
  // implementation routes carry visual_fail: token for visual_round bump.
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Widget shape miss (new in v3.14.0) → sr-engineer with visual_fail token
  assert.match(body, /Widget shape miss.*visual_fail:.*next_role:\s*sr-engineer/is, "widget shape route must target sr-engineer with visual_fail token");
  // Pixel drift (renamed from "visual drift") → sr-engineer with visual_fail: pixel
  assert.match(body, /Pixel drift.*visual_fail:\s*pixel.*next_role:\s*sr-engineer/is, "pixel drift must carry visual_fail: pixel token");
  // Missing baseline → design-auditor (no visual_fail; auditor defect, not implementation)
  assert.match(body, /Missing baseline.*next_role:\s*design-auditor/is, "missing baseline must route to design-auditor");
  // Missing impl → sr-engineer with visual_fail: missing_impl
  assert.match(body, /Missing impl.*visual_fail:\s*missing_impl.*next_role:\s*sr-engineer/is, "missing impl must carry visual_fail: missing_impl token");
  // PASS sub-verdict heading exists (v3.14.0 promotes it to its own H3 section)
  assert.match(body, /PASS sub-verdict/is, "PASS sub-verdict must exist");
});

test("AC-5: gating logic is source-agnostic (no Figma-only assumptions) — preserved in v3.14.0", () => {
  // Why: Phase 1's source-agnostic promise (Sketch / XD / Penpot / PDF /
  // mockup / photo) must extend into Phase 2 — otherwise teams that don't
  // use Figma get a half-feature. v3.14.0: source-agnostic claim moved
  // into the Rationale H3 section of skill-qa-visual.md (was a trailing
  // paragraph in v3.8.3).
  const auditor = fs.readFileSync(AUDITOR_PATH, "utf-8");
  const qaVisual = fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Auditor Visual Baselines lists multiple sources (unchanged)
  for (const source of ["Figma", "Sketch", "XD", "Penpot", "PDF", "mockup", "photo"]) {
    assert.ok(auditor.includes(source), `Visual Baselines must mention ${source}`);
  }
  // v3.14.0 qa-visual sub-skill: source-agnostic claim now in Rationale's
  // pixel-diff bullet ("via multimodal vision against a user-supplied
  // baseline"). The literal phrase "Source-agnostic" was retired in favour
  // of the more specific multimodal-vision wording.
  assert.match(qaVisual, /multimodal vision against a user-supplied baseline/i, "qa-visual must declare multimodal vision contract");
});

test("AC-6: backwards-compat — v3.8.1 audits + non-UI workspaces still skip silently in v3.14.0", () => {
  // v3.14.0 preserves the absent-branch contract. The skip-if-absent
  // labelling is replaced by "lazy-load + PASS-gated when Visual Baselines
  // present" — same skip-on-absent semantics, just with a clearer name.
  const qaBody = fs.readFileSync(QA_PATH, "utf-8");

  // v3.14.0 labelling
  assert.match(qaBody, /lazy-load \+ PASS-gated/i, "v3.14.0 label must describe both arms");
  // Absent branch comes BEFORE Present branch (safety default)
  const absentIdx = qaBody.search(/-\s*\*\*Absent\*\*/);
  const presentIdx = qaBody.search(/-\s*\*\*Present\*\*/);
  assert.ok(absentIdx > 0 && presentIdx > absentIdx, "Absent branch must precede Present branch (safety default)");
});

test("AC-7: v3.8.2 release entry is preserved in CHANGELOG (regression guard)", () => {
  // Why: this test was written at the moment of the v3.8.2 release. Once
  // shipped, its real job is to guard the [3.8.2] CHANGELOG entry against
  // accidental deletion in future bumps (history must be append-only). The
  // current-version coherence invariant is owned by the latest release's own
  // test file (e.g. test/qa-visual-skill-split.test.mjs covers 3.8.3), so
  // pinning package.json here would force this test to break every release.
  // Same pattern as the v3.8.1 → v3.8.2 relaxation in
  // test/pixel-perfect-design-coverage.test.mjs.
  const changelog = fs.readFileSync(path.join(PROJECT_ROOT, "CHANGELOG.md"), "utf-8");

  assert.match(changelog, /^##\s*\[3\.8\.2\]/m, "CHANGELOG must retain [3.8.2] release section");
});

test("regression: QA SOP step numbering is sequential 1..7 with no duplicates", () => {
  // Why: inserting Phase 1.5 as new step 4 required renumbering old 4→5/5→6/
  // 6→7. Mid-implementation we caught a stale "6. Phase 4" that should have
  // been "7. Phase 4". This test guards against the next person making the
  // same edit slip. Markdown numbered lists are loose; humans rely on
  // sequence for reading order.
  const body = fs.readFileSync(QA_PATH, "utf-8");
  // Pull every top-level numbered SOP line. Step 1 starts with backticks
  // (`tw_get_state`), step 2..7 start with bold (**Phase X**), so the regex
  // must accept either marker — anchor on `N. ` followed by either `*` or `` ` ``.
  const sopStart = body.indexOf("## SOP");
  assert.ok(sopStart > 0, "## SOP section must exist");
  const sopBody = body.slice(sopStart);
  const sopMatches = [...sopBody.matchAll(/^(\d+)\.\s+[`*]/gm)].map((m) => Number(m[1]));

  // Expect exactly 1..7 in order (Phase 0 + Phase 1 + Phase 1.5 + Phase 2 + Phase 3 + Phase 4, plus the leading pre-flight step = 7 steps)
  assert.deepEqual(sopMatches, [1, 2, 3, 4, 5, 6, 7], `SOP steps must be sequential 1..7 (got ${sopMatches.join(",")})`);
});
