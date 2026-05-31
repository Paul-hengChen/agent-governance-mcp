// Coded by @qa-engineer
// Tests for spec: specs/design-auditor-volume-guard.md.
// Spec-to-Test map:
//   AC1 (pre-fetch Volume Gate)   -> t-gate-present, t-gate-ordering
//   AC2 (node-scoped fetch)       -> t-node-scoped
//   AC3 (frame-scoped link)       -> t-frame-scoped, t-coord-footprint
//   AC4 (fail-loud, never silent) -> t-fail-loud
//   AC5 (fetch-modes only; cap kept) -> t-scope-modes, t-output-cap-intact
//
// WHY: the Feature-Scope Gate splits a PRD at the feature level, but a single
// feature pointed at a whole-file Figma can still blow context on the FETCH. The
// guard adds an input-side Volume Gate + node-scoped fetch (design-auditor) and a
// frame-scoped-link instruction (coordinator). These live purely in prompt text, so
// the contract IS the SOP wording — pin it so a future edit can't drop the gate,
// silently truncate instead of stopping, or re-inflate the always-on coordinator skill.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDITOR = fs.readFileSync(path.join(ROOT, "content", "skill-design-auditor.md"), "utf-8");
const COORD = fs.readFileSync(path.join(ROOT, "content", "skill-coordinator.md"), "utf-8");

test("AC1: Volume Gate (pre-fetch) is present in the design-auditor SOP", () => {
  assert.match(AUDITOR, /Volume Gate \(pre-fetch\)/, "auditor must declare a pre-fetch Volume Gate");
});

test("AC1: Volume Gate runs between mode-detection and Extract", () => {
  const mode = AUDITOR.indexOf("**Mode detection**");
  const gate = AUDITOR.indexOf("Volume Gate");
  const extract = AUDITOR.indexOf("**Extract**");
  assert.ok(mode > 0 && gate > mode && extract > gate, "gate must sit after mode-detection and before Extract");
});

test("AC4: Volume Gate fails loud — STOP/Blocked + frame count + split recommendation", () => {
  // Must STOP and route back, never ingest-then-defer.
  assert.match(AUDITOR, /status=Blocked[\s\S]*?next_role.*pm/, "oversized source must Blocked → pm");
  assert.match(AUDITOR, /design-auditor: design source oversized — recommend splitting feature further/, "must carry the verbatim block reason");
  assert.match(AUDITOR, /<N> frames/, "block note must surface the frame count (fail-loud, not silent)");
  assert.match(AUDITOR, /do not ingest-then-defer/i, "must prefer splitting over ingest-then-defer");
});

test("AC2: node-scoped fetch rule present", () => {
  assert.match(AUDITOR, /Node-scoped fetch/i, "extract step must require node-scoped fetch");
  assert.match(AUDITOR, /never pull the whole document/i, "must forbid whole-document fetch when a frame-scoped id exists");
});

test("AC5: gate is fetch-modes only — image/pdf/paper/no-design skip", () => {
  assert.match(AUDITOR, /`image`\/`pdf`\/`paper`\/`no-design` skip this gate/, "non-fetch modes must skip the Volume Gate");
});

test("AC5: existing 250-line / 5-pass output cap is unchanged (gate is additive)", () => {
  assert.match(AUDITOR, /250-line cap/, "output cap must remain");
  assert.match(AUDITOR, /deferred/, "Source-manifest deferral must remain");
});

test("AC3: coordinator split schema instructs a frame-scoped Figma link", () => {
  assert.match(COORD, /frame-scoped.*Figma link|frame-scoped.*link/i, "schema must ask for a frame-scoped link");
  assert.match(COORD, /not the whole-file link/i, "schema must warn against whole-file links");
});

test("AC3: coordinator gate section stays within the always-on footprint budget", () => {
  // Reuses the feature-scope-gate footprint invariant — this addition must not
  // re-inflate the always-on coordinator skill.
  const a = COORD.indexOf("## Feature-Scope Gate");
  const b = COORD.indexOf("## Design-source detection", a);
  assert.ok(a >= 0 && b > a, "gate section must exist");
  const approxTokens = Math.ceil(COORD.slice(a, b).length / 4);
  assert.ok(approxTokens <= 425, `gate section ~${approxTokens} tok must stay <= ~425`);
});
