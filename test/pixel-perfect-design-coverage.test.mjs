// Coded by @qa-engineer
// Tests for spec: specs/pixel-perfect-design-coverage.md (Phase 1: A1 + A2).
// Spec-to-Test map: AC-1→t1, AC-2→t2, AC-3→t3, AC-4→t4, AC-5→t5, AC-6→t6.
//
// These are integration-level checks on the I/O boundary: prompts/build.ts loads
// content/skill-*.md verbatim into rendered prompts, so the markdown contract
// shipped here IS the runtime behaviour. No pure-logic units exist for this
// markdown-only feature.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

const AUDITOR_PATH = path.join(PROJECT_ROOT, "content", "skill-design-auditor.md");
const PM_PATH = path.join(PROJECT_ROOT, "content", "skill-pm.md");

test("AC-1: design-auditor Source manifest schema is exhaustive + source-agnostic + status-tagged", () => {
  // Why: Phase 1's whole purpose. If the manifest schema regresses to "list each
  // surface" without the status column, downstream PM can no longer distinguish
  // deferred vs out-of-scope, and frames silently drop again (the failure mode
  // research/pixel-perfect-and-design-coverage.md was filed to close).
  const body = fs.readFileSync(AUDITOR_PATH, "utf-8");

  // Heading still present
  assert.match(body, /\*\*Source manifest\*\*/, "Source manifest heading must exist");
  // Exhaustiveness language
  assert.match(body, /exhaustive list of every surface/i, "manifest must require exhaustive listing");
  // Status column with all three values
  assert.match(body, /status:\s*audited\s*\\\|\s*deferred\s*\\\|\s*out-of-scope/i, "status column must enumerate all three states");
  // Source-agnostic: at least Figma / Sketch / XD / Penpot / PDF / image referenced
  for (const surface of ["Figma", "Sketch", "XD", "Penpot", "PDF", "image"]) {
    assert.ok(body.includes(surface), `manifest must mention ${surface} surface`);
  }
});

test("AC-2: multi-pass Hard rule has line cap, pass ceiling, and forced manifest progress", () => {
  // Why: A1's anti-abuse properties. Without the per-pass line cap (≤ 250)
  // a single audit can token-explode; without the 5-pass ceiling we lose the
  // constitution §5 anti-loop guarantee; without "MUST flip ≥ 1 deferred→audited"
  // an agent could loop forever producing no-op passes. All three are load-bearing.
  const body = fs.readFileSync(AUDITOR_PATH, "utf-8");

  assert.match(body, /Token-frugal multi-pass/, "Hard rule must be renamed to multi-pass");
  assert.match(body, /≤\s*250\s*lines\s*per\s*pass/i, "per-pass line cap must be present");
  assert.match(body, /5\s*passes\s*per\s*feature/i, "5-pass ceiling must be present");
  assert.match(body, /flip.*≥\s*1.*manifest.*row.*from.*deferred.*→.*audited/is, "follow-up pass must require manifest progress");
  assert.match(body, /constitution\s*§5/i, "anti-loop cite must point at constitution §5");
});

test("AC-3: no-design mode skips multi-pass + manifest entirely", () => {
  // Why: backwards-compatible safety valve. When the coordinator hands a task
  // with zero design source, the auditor must still be a fast no-op — otherwise
  // every PM hop pays manifest-construction tax. The empty-manifest / single-pass
  // exemption preserves the zero-cost guarantee.
  const body = fs.readFileSync(AUDITOR_PATH, "utf-8");

  // Original no-design Hard rule still present
  assert.match(body, /No design = explicit no-op/, "no-design Hard rule must remain");
  // Explicit exemption from multi-pass + manifest
  assert.match(body, /no-design.*mode skips multi-pass and manifest/i, "no-design must explicitly skip new gates");
});

test("AC-4: PM SOP step 2 carries the Deferred-surface gate", () => {
  // Why: A2's downstream half. Without this gate the auditor's `deferred`
  // tagging is invisible to architect / sr-engineer / qa-engineer, and the
  // team ships without knowing which surfaces are uncovered. PM is the only
  // role positioned to surface this in the spec.
  const body = fs.readFileSync(PM_PATH, "utf-8");

  assert.match(body, /Deferred-surface gate/, "gate must be named in SOP");
  assert.match(body, /Source manifest.*contains rows with.*status:\s*deferred/is, "gate must trigger on manifest deferred rows");
  assert.match(body, /Dependencies\s*\/\s*Prerequisites/, "gate must route enumeration to Dependencies section");
  assert.match(body, /pointer\s*\+\s*reason/i, "gate must require pointer + reason per deferred row");
});

test("AC-5: backwards-compat clauses exist in both auditor and PM skills", () => {
  // Why: AC-5 promises pre-Phase-1 audits keep working. If either skill loses
  // the explicit "no retroactive migration" clause, downstream roles may
  // mis-classify older artifacts and either block PM (false drift) or
  // silently drop unknown surfaces. Both halves of the contract must be
  // declared verbatim.
  const auditor = fs.readFileSync(AUDITOR_PATH, "utf-8");
  const pm = fs.readFileSync(PM_PATH, "utf-8");

  assert.match(auditor, /Backwards-compat[^\n]*pre-Phase-1[^\n]*no retroactive migration/is, "auditor must declare backwards-compat + no-migration");
  assert.match(auditor, /unknown.*for the rest/i, "auditor must specify fallback for unlisted surfaces");
  assert.match(pm, /Backwards-compat[^\n]*older.*design[^\n]*requires no action/is, "PM must declare no-action fallback");
});

test("AC-6: v3.8.1 release entry is preserved in CHANGELOG (regression guard)", async () => {
  // Why: this test was written at the moment of the 3.8.1 release. Once
  // shipped, its real job is to guard the [3.8.1] CHANGELOG entry against
  // accidental deletion in future bumps (history must be append-only). The
  // current-version coherence invariant is owned by the latest release's own
  // test file (e.g. test/pixel-perfect-visual-compare.test.mjs covers 3.8.2),
  // so pinning package.json here would force this test to break every release.
  const changelog = fs.readFileSync(path.join(PROJECT_ROOT, "CHANGELOG.md"), "utf-8");

  assert.match(changelog, /^##\s*\[3\.8\.1\]/m, "CHANGELOG must retain [3.8.1] release section");
});
