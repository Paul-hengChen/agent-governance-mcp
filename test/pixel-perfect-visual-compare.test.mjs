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

test("AC-1: design-auditor Artifact Schema declares OPTIONAL Visual Baselines H2 with 4-col schema", () => {
  // Why: AC-1 anchors the entire Phase 2 contract on a single schema entry.
  // If the auditor doesn't declare *where* baselines live and *what* columns
  // they carry, QA Phase 1.5 has no place to look — the gate degrades to
  // permanent skip silently, defeating the feature. Surface id must FK to
  // Source manifest so deferred / out-of-scope rows can't masquerade as
  // baseline-capable.
  const body = fs.readFileSync(AUDITOR_PATH, "utf-8");

  // Section heading present + marked OPTIONAL
  assert.match(body, /\*\*Visual Baselines\*\*\s*\*\(OPTIONAL/i, "Visual Baselines H2 must exist and be marked OPTIONAL");
  // 4-column schema with all required columns
  assert.match(body, /surface id\s*\|\s*baseline path\s*\|\s*impl path\s*\|\s*notes/i, "4-column header must be present");
  // Surface id foreign-keys to Source manifest
  assert.match(body, /surface id.*MUST match.*Source manifest/is, "surface id must FK to Source manifest");
  // Absence = skip Phase 1.5 (gating signal lives in the auditor schema, not just in QA)
  assert.match(body, /Absence.*MUST cause QA Phase 1\.5 to skip silently/is, "absence must mandate Phase 1.5 skip");
});

test("AC-2: QA Phase 1.5 skips silently when Visual Baselines absent", () => {
  // Why: the no-overhead promise for non-UI features. Without an explicit
  // absent-branch, QA either FAILs every server-logic feature for not having
  // a baseline OR silently passes baselines that should have existed. Both
  // outcomes break trust. The absent branch must log + proceed.
  const body = fs.readFileSync(QA_PATH, "utf-8");

  // Phase 1.5 step exists
  assert.match(body, /\*\*Phase 1\.5\s*—\s*Visual Compare\*\*/, "Phase 1.5 step must be named");
  // skip-if-absent labeling
  assert.match(body, /skip-if-absent/i, "skip-if-absent must be the gating label");
  // Absent branch: explicit log + proceed to Phase 2
  assert.match(body, /Absent.*log.*skipped.*proceed to Phase 2/is, "absent branch must log skip and proceed to Phase 2");
  // Non-UI overhead claim
  assert.match(body, /zero overhead/i, "absent branch must promise zero overhead");
});

test("AC-3: per-row compare contract reads both PNGs and emits 6-category diff into review doc", () => {
  // Why: the actual mechanism. If the SOP doesn't enforce (a) reading BOTH
  // images via the Read tool and (b) emitting a diff structured by category,
  // QA agents will paraphrase impressions instead of comparing pixels.
  // The 6 categories are load-bearing: omitting "text content" loses the
  // copy-drift catch; omitting "spacing/alignment" loses the original Phase
  // 2 motivation.
  const body = fs.readFileSync(QA_PATH, "utf-8");

  // Read both files via Read tool
  assert.match(body, /Read both.*baseline path.*impl path.*via the Read tool/is, "both PNGs must be Read via the Read tool");
  // 6 enumerated categories
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
  // Output destination + heading + per-surface sub-sectioning
  assert.match(body, /qa_reports\/review_<task-id>\.md/, "output must land in the review doc");
  assert.match(body, /##\s*Phase 1\.5\s*—\s*Visual Compare/, "diff goes under a `## Phase 1.5 — Visual Compare` heading");
  assert.match(body, /sub-section per\s*`?surface id`?/i, "one sub-section per surface id");
});

test("AC-4: three distinct failure routes (drift → sr-engineer; missing baseline → design-auditor; missing impl → sr-engineer)", () => {
  // Why: routing accuracy. A missing baseline is the auditor's responsibility
  // (they declared the path), a missing impl is the sr-engineer's (they
  // claimed ready-for-QA), and drift is the sr-engineer's (the code drifted).
  // Confusing these routes makes the wrong role get paged and slows resolution.
  const body = fs.readFileSync(QA_PATH, "utf-8");

  // Drift → sr-engineer
  assert.match(body, /Drift.*visual drift.*next_role:\s*sr-engineer/is, "drift route must target sr-engineer");
  // Missing baseline → design-auditor
  assert.match(body, /Missing baseline.*next_role:\s*design-auditor/is, "missing baseline must route to design-auditor");
  // Missing impl → sr-engineer
  assert.match(body, /Missing impl.*next_role:\s*sr-engineer/is, "missing impl must route to sr-engineer");
  // PASS sub-verdict
  assert.match(body, /PASS sub-verdict.*proceed to Phase 2/is, "PASS sub-verdict must proceed to Phase 2");
});

test("AC-5: gating logic is source-agnostic (no Figma-only assumptions)", () => {
  // Why: Phase 1's source-agnostic promise (Sketch / XD / Penpot / PDF /
  // mockup / photo) must extend into Phase 2 — otherwise teams that don't
  // use Figma get a half-feature. Both files must avoid Figma-only narration
  // in the gating logic.
  const auditor = fs.readFileSync(AUDITOR_PATH, "utf-8");
  const qa = fs.readFileSync(QA_PATH, "utf-8");

  // Auditor Visual Baselines lists multiple sources
  for (const source of ["Figma", "Sketch", "XD", "Penpot", "PDF", "mockup", "photo"]) {
    assert.ok(auditor.includes(source), `Visual Baselines must mention ${source}`);
  }
  // QA Phase 1.5 explicitly claims source-agnosticism
  assert.match(qa, /Source-agnostic.*any image format/is, "QA Phase 1.5 must claim source-agnosticism");
});

test("AC-6: backwards-compat with v3.8.1 audits (no Visual Baselines = silent skip)", () => {
  // Why: a v3.8.1 audit has Source manifest but no Visual Baselines H2.
  // QA Phase 1.5 must treat this as the absent case and skip — not error,
  // not block. The skip-if-absent contract IS the backwards-compat guarantee;
  // any other behaviour breaks migrations.
  const qaBody = fs.readFileSync(QA_PATH, "utf-8");

  // Skip-if-absent literally + absent branch ordering (Absent then Present)
  assert.match(qaBody, /skip-if-absent/i, "skip-if-absent labeling required");
  const absentIdx = qaBody.search(/-\s*\*\*Absent\*\*/);
  const presentIdx = qaBody.search(/-\s*\*\*Present\*\*/);
  assert.ok(absentIdx > 0 && presentIdx > absentIdx, "Absent branch must precede Present branch (safety default)");
});

test("AC-7: version literals stay coherent across package.json, index.ts, dist/index.js, CHANGELOG at 3.8.2", () => {
  // Why: same invariant as v3.8.1 t6 — the server is consumed via tagged npx;
  // if package.json says one version but the running server reports another,
  // upstream clients pin one artifact and run a different one. This test
  // extends the t6 invariant to 3.8.2 so future bumps keep all four sources
  // synced.
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
  const indexTs = fs.readFileSync(path.join(PROJECT_ROOT, "index.ts"), "utf-8");
  const distJs = fs.readFileSync(path.join(PROJECT_ROOT, "dist", "index.js"), "utf-8");
  const changelog = fs.readFileSync(path.join(PROJECT_ROOT, "CHANGELOG.md"), "utf-8");

  assert.equal(pkg.version, "3.8.2", "package.json must be 3.8.2");
  assert.match(indexTs, /name:\s*"agent-governance-mcp",\s*version:\s*"3\.8\.2"/, "index.ts Server literal must be 3.8.2");
  assert.match(distJs, /name:\s*"agent-governance-mcp",\s*version:\s*"3\.8\.2"/, "dist/index.js (build output) must be 3.8.2");
  assert.match(changelog, /^##\s*\[3\.8\.2\]/m, "CHANGELOG must carry [3.8.2] release section");
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
