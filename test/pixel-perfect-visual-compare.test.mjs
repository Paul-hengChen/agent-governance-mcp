// Coded by @qa-engineer
// Tests for specs/pixel-perfect-visual-compare.md (AC-1..AC-7 map to t1..t7; t8
// guards the SOP step numbering, which broke once during manual renumbering).
// prompts/build.ts loads content/skill-*.md verbatim, so the markdown contract
// is the runtime behaviour; there is no pure logic to unit-test.

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
// E434: the sub-skill is now code-reviewer's skill-reviewer-visual.md (the judge's visual verdict); the
// per-row image read applies to over-threshold surfaces only and rejections are code-reviewer rejections.
const QA_VISUAL_PATH = path.join(PROJECT_ROOT, "content", "skill-reviewer-visual.md");
const OLD_QA_VISUAL_PATH = path.join(PROJECT_ROOT, "content", "skill-qa-visual.md");

test("AC-1: design-auditor Artifact Schema declares Visual Baselines H2 with 4-col schema (v3.16.0: MANDATORY when mode != no-design)", () => {
  // Without a declared home and columns for baselines, QA Phase 1.5 has nothing
  // to read and the gate skips forever. Surface id must reference the Source
  // manifest so deferred rows cannot pose as baselines. Since v3.16.0 the
  // section is mandatory unless mode is no-design: the gate arms on mode, and
  // a missing section blocks PASS (VISUAL_BASELINES_REQUIRED).
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

test("AC-2: QA SOP carries no Phase 1.5 visual step, so non-UI and UI workspaces alike pay no overhead in it (E433 re-pin)", () => {
  // E433: qa-engineer became the test author; the visual compare (formerly Phase 1.5, lazy-loaded when
  // Visual Baselines are present) left its SOP and the visual judge is E434's. What stays true is the
  // intent of the old assertion: the qa SOP never pulls the visual sub-skill into a non-UI run.
  const body = fs.readFileSync(QA_PATH, "utf-8");
  assert.doesNotMatch(body, /Phase 1\.5/, "no Phase 1.5 step in the qa SOP");
  assert.doesNotMatch(body, /skill-qa-visual/, "the qa SOP does not lazy-load the visual sub-skill");
});

test("AC-3: per-row compare contract reads both PNGs and emits 6-category diff (v3.14.0: into visual_<task-id>.md under Pixel Diff)", () => {
  // v3.14.0: output filename changed from review_<task-id>.md to
  // visual_<task-id>.md (Constitution §3.1 PASS gate). Diff heading changed
  // from "## Phase 1.5 — Visual Compare" to "## Pixel Diff" (Step B). The
  // 6 categories and Read-tool contract are preserved.
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Read both files via Read tool (E434: only for a surface over its threshold)
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

// E434 re-pin: the visual rejections are code-reviewer `CHANGES_REQUESTED` writes counted in `review_round`
// (no `visual_fail:` token, no visual counter); implementation defects route to sr-engineer, check defects to
// qa-engineer, design defects (missing baseline included) go Blocked to pm, which routes to design-auditor
// (code-reviewer:FAIL has no design-auditor edge, D13).
test("AC-4: visual failure routes are code-reviewer rejections — implementation → sr-engineer, check defect → qa-engineer, design defect → Blocked pm (E434)", () => {
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");
  assert.ok(!body.includes("visual_fail:"), "no visual_fail: token (the visual counter left the served rules)");
  assert.match(body, /CHANGES_REQUESTED/, "rejections are CHANGES_REQUESTED");
  assert.match(body, /`review_round`/, "counted in review_round");
  assert.match(body, /widget shape[\s\S]*sr-engineer|sr-engineer[\s\S]*widget shape/i, "widget shape miss routes to sr-engineer");
  assert.match(body, /check defect/i, "check defects named (route to qa-engineer)");
  assert.match(body, /design defect/i, "design defects named (Blocked, pm)");
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
  // v3.14.0 visual sub-skill (skill-reviewer-visual since E434): source-agnostic claim now in Rationale's
  // pixel-diff bullet ("via multimodal vision against a user-supplied
  // baseline"). The literal phrase "Source-agnostic" was retired in favour
  // of the more specific multimodal-vision wording.
  assert.match(qaVisual, /multimodal vision against a user-supplied baseline/i, "reviewer-visual must declare multimodal vision contract");
});

test("AC-6: backwards-compat — the qa SOP has no visual arm at all, so v3.8.1 audits + non-UI workspaces still skip silently (E433 re-pin)", () => {
  // Was: Absent branch precedes Present branch inside Phase 1.5. Phase 1.5 is gone from the qa SOP (E433),
  // so neither branch exists there; the visual sub-skill file itself is untouched.
  const qaBody = fs.readFileSync(QA_PATH, "utf-8");
  assert.doesNotMatch(qaBody, /lazy-load \+ PASS-gated/i, "no lazy-load arm in the qa SOP");
  assert.doesNotMatch(qaBody, /-\s*\*\*(Absent|Present)\*\*/, "no Absent/Present visual branches in the qa SOP");
  // E434: the sub-skill was renamed; code-reviewer loads it (step 6a), the qa SOP never does.
  assert.ok(fs.existsSync(QA_VISUAL_PATH), "the visual sub-skill ships as skill-reviewer-visual.md");
  assert.ok(!fs.existsSync(OLD_QA_VISUAL_PATH), "skill-qa-visual.md is gone");
});

test("AC-7: v3.8.2 release entry is preserved in CHANGELOG (regression guard)", () => {
  // Guards the [3.8.2] CHANGELOG entry against deletion (history is
  // append-only). The current version is pinned by the latest release's own
  // test, so pinning package.json here would break every release.
  const changelog = fs.readFileSync(path.join(PROJECT_ROOT, "CHANGELOG.md"), "utf-8");

  assert.match(changelog, /^##\s*\[3\.8\.2\]/m, "CHANGELOG must retain [3.8.2] release section");
});

test("regression: QA SOP step numbering is sequential 1..8 with no duplicates", () => {
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

  // Expect exactly 1..8 in order (E433 test-author SOP: pre-flight, claim, read, write, run, record, hand off, return loops)
  assert.deepEqual(sopMatches, [1, 2, 3, 4, 5, 6, 7, 8], `SOP steps must be sequential 1..8 (got ${sopMatches.join(",")})`);
});
