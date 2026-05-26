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

test("AC-1: skill-qa-visual.md exists and carries the full Phase 1.5 contract", () => {
  // Why: the whole point of the split is that the visual sub-skill is
  // self-contained. If a downstream role Reads it without first running
  // qa-engineer's hook, the file must still be intelligible: explain its
  // purpose, list the 6 diff categories, name the 3 failure routes, and
  // declare the PASS sub-verdict. Anything less makes the sub-skill
  // unusable in isolation.
  assert.ok(fs.existsSync(QA_VISUAL_PATH), "skill-qa-visual.md must exist");
  const body = fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Self-documenting header explaining the lazy-load contract
  assert.match(body, /Lazy-loaded by `skill-qa-engineer`/, "header must declare lazy-load relationship");
  assert.match(body, /Visual Baselines/, "header must reference the trigger condition");

  // Six diff categories (the load-bearing list)
  for (const category of [/\(i\).*layout/i, /\(ii\).*spacing/i, /\(iii\).*element/i, /\(iv\).*color/i, /\(v\).*text/i, /\(vi\).*image/i]) {
    assert.match(body, category, `sub-skill must enumerate diff category ${category}`);
  }

  // Three failure routes with correct next_role targets
  assert.match(body, /Drift.*visual drift.*next_role:\s*sr-engineer/is, "drift route must target sr-engineer");
  assert.match(body, /Missing baseline.*next_role:\s*design-auditor/is, "missing baseline must route to design-auditor");
  assert.match(body, /Missing impl.*next_role:\s*sr-engineer/is, "missing impl must route to sr-engineer");

  // PASS sub-verdict
  assert.match(body, /PASS sub-verdict.*proceed to Phase 2/is, "PASS sub-verdict must proceed to Phase 2");
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

test("AC-3: lazy-load hook has both Absent and Present branches with correct contracts", () => {
  // Why: the gate has to make the right call before the file is Read,
  // otherwise the savings vanish (non-UI features still Read the sub-skill)
  // OR UI features fail to load it. Both branches must exist and target
  // the right outcome — Absent must explicitly forbid Reading the file;
  // Present must Read it via the Read tool (not any other mechanism).
  const body = fs.readFileSync(QA_PATH, "utf-8");

  // The hook lives in SOP step 4
  assert.match(body, /4\.\s+\*\*Phase 1\.5\s*—\s*Visual Compare\*\*\s*\(lazy-load/, "step 4 must be the lazy-load hook");

  // Absent branch: skip + log + proceed + explicit "Do NOT Read"
  assert.match(body, /Absent[^\n]*log[^\n]*skipped/is, "Absent branch must log skip");
  assert.match(body, /Absent[^\n]*proceed to Phase 2/is, "Absent branch must proceed to Phase 2");
  assert.match(body, /Do NOT Read.*skill-qa-visual\.md/is, "Absent branch must explicitly forbid Reading the sub-skill");

  // Present branch: Read the sub-skill via the Read tool
  assert.match(body, /Present[^\n]*Read\s+`?content\/skill-qa-visual\.md`?[^\n]*Read tool/is, "Present branch must Read the sub-skill via the Read tool");
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

test("AC-5: byte counts satisfy savings thresholds", () => {
  // Why: AC-5 is the entire economic justification for the split. If
  // qa-engineer.md didn't actually shrink, we incurred the maintenance
  // cost of a 2-file split for nothing. The 1200-byte / 2400-byte
  // thresholds were picked to ensure (a) non-UI workspaces see real
  // savings, (b) the sub-skill doesn't bloat into a parallel SOP.
  const qaSize = fs.statSync(QA_PATH).size;
  const qaVisualSize = fs.statSync(QA_VISUAL_PATH).size;

  // v3.8.2 qa-engineer.md was 8660 bytes (recorded in the v3.8.2 review
  // doc, qa_reports/review_T49-T51.md, and verified by `wc -c` at that
  // time). AC-5 requires >= 1200 byte reduction, i.e. <= 7460 bytes.
  assert.ok(qaSize <= 7460, `qa-engineer.md must be <= 7460 bytes (got ${qaSize})`);
  // AC-5 caps the sub-skill at 2400 bytes so it doesn't grow into a
  // parallel large SOP.
  assert.ok(qaVisualSize <= 2400, `qa-visual.md must be <= 2400 bytes (got ${qaVisualSize})`);
});

test("AC-6: Phase 1.5 contract is preserved between v3.8.2 and v3.8.3 (combined assertion)", () => {
  // Why: AC-6 promises that a v3.8.2 audit with Visual Baselines keeps
  // working under v3.8.3 with no migration. That requires the *complete*
  // contract — gate + per-row mechanics + 6 categories + 3 routes +
  // PASS — to be reachable across the two files when the agent follows
  // the hook. This test checks the combined surface (qa-engineer hook
  // + qa-visual sub-skill) carries every element AC-6 names.
  const combined = fs.readFileSync(QA_PATH, "utf-8") + "\n" + fs.readFileSync(QA_VISUAL_PATH, "utf-8");

  // Gate (in qa-engineer hook)
  assert.match(combined, /Phase 1\.5: skipped \(no Visual Baselines declared\)/, "skip log line must be reachable");
  // Per-row mechanics (in qa-visual)
  assert.match(combined, /baseline path.*impl path/is, "per-row paths must be named");
  // All 6 categories
  for (const category of [/\(i\).*layout/i, /\(ii\).*spacing/i, /\(iii\).*element/i, /\(iv\).*color/i, /\(v\).*text/i, /\(vi\).*image/i]) {
    assert.match(combined, category, `combined surface must enumerate ${category}`);
  }
  // All 3 routes
  assert.match(combined, /next_role:\s*sr-engineer/, "sr-engineer route must exist");
  assert.match(combined, /next_role:\s*design-auditor/, "design-auditor route must exist");
  // PASS sub-verdict
  assert.match(combined, /PASS sub-verdict.*proceed to Phase 2/is, "PASS sub-verdict must exist");
});

test("AC-7: version literals stay coherent across package.json, index.ts, dist/index.js, CHANGELOG at 3.8.3", () => {
  // Why: same invariant as every prior release's t-version-coherence —
  // package.json, the Server() literal, the build output, and the
  // CHANGELOG entry must all agree. Without this, `npx ...#v3.8.3`
  // consumers pin one artifact and run a different one.
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
  const indexTs = fs.readFileSync(path.join(PROJECT_ROOT, "index.ts"), "utf-8");
  const distJs = fs.readFileSync(path.join(PROJECT_ROOT, "dist", "index.js"), "utf-8");
  const changelog = fs.readFileSync(path.join(PROJECT_ROOT, "CHANGELOG.md"), "utf-8");

  assert.equal(pkg.version, "3.8.3", "package.json must be 3.8.3");
  assert.match(indexTs, /name:\s*"agent-governance-mcp",\s*version:\s*"3\.8\.3"/, "index.ts Server literal must be 3.8.3");
  assert.match(distJs, /name:\s*"agent-governance-mcp",\s*version:\s*"3\.8\.3"/, "dist/index.js must be 3.8.3");
  assert.match(changelog, /^##\s*\[3\.8\.3\]/m, "CHANGELOG must carry [3.8.3] release section");
});
