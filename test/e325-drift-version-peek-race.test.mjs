// Coded by @qa-engineer
// E325 (T-E325-02): tw_detect_drift's schema-skew peek (readArtifactVersion) picks the lane or flat
// handoff path and then reads it. A concurrent flat<->lane migration rename between the pick and the
// read used to drop that call's skew advisory. WHY: a future-schema handoff must never go silently
// unreported; the fix re-reads the OTHER layout once (mirroring E312's readAndMigrate). Each case
// injects the rename deterministically via the node:fs CJS export (e312-read-path-race precedent).
// Spec: specs/e287-finish-findings-and-small-fixes.md (AC-E325-1, AC-E325-2).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import * as nodeModule from "node:module";

import { detectDrift } from "../dist/tools/drift.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";
import { resetSession } from "../dist/guards/session.js";

const cjsFs = createRequire(import.meta.url)("node:fs");
const SKEW = /Schema version skew: handoff on-disk v999/;

const body = (v) =>
  `---\nschema_version: ${v}\nactive_feature: "f"\nstatus: "In_Progress"\nlast_updated: "2026-01-01T00:00:00.000Z"\nlast_agent: "pm"\nqa_round: 0\nreview_round: 0\nvisual_round: 0\n---\n## Completed\n- (none)\n\n## Pending & Handoff Notes\n- (none)\n`;

function mkFixture(layout, text = body(999)) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e325-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  const flat = path.join(ws, ".current", "handoff.md");
  const lane = resolveCurrentLanePaths(ws).handoffPath;
  if (layout !== "none") {
    const target = layout === "flat" ? flat : lane;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return { ws, flat, lane };
}

// Wraps existsSync; after the Nth call on a handoff path returns its (already computed) answer,
// renames src -> dst once. Returns whether the rename fired.
function withRename({ flat, lane }, from, at, fn) {
  const real = cjsFs.existsSync;
  const src = from === "flat" ? flat : lane;
  const dst = from === "flat" ? lane : flat;
  let n = 0;
  let fired = false;
  cjsFs.existsSync = function (p) {
    const result = real.call(cjsFs, p);
    if (p === flat || p === lane) {
      n += 1;
      if (!fired && n === at && real.call(cjsFs, src)) {
        fired = true;
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.renameSync(src, dst);
      }
    }
    return result;
  };
  nodeModule.syncBuiltinESMExports();
  try {
    return { report: JSON.parse(fn()), fired };
  } finally {
    cjsFs.existsSync = real;
    nodeModule.syncBuiltinESMExports();
  }
}

const skewLines = (report) => report.details.filter((d) => /Schema version skew/.test(d));

for (const [from, layout] of [["flat", "flat"], ["lane", "lane"]]) {
  test(`AC-E325-1: ${from}->${from === "flat" ? "lane" : "flat"} rename between pick and read -> the skew advisory is still reported`, () => {
    let firedAny = false;
    for (const at of [1, 2, 3]) {
      const fx = mkFixture(layout);
      resetSession();
      const { report, fired } = withRename(fx, from, at, () => detectDrift(fx.ws));
      firedAny ||= fired;
      assert.ok(skewLines(report).some((d) => SKEW.test(d)), `injection at call ${at} (fired=${fired}) lost the skew advisory`);
    }
    assert.ok(firedAny, "the injected rename must actually fire for the test to mean anything");
  });
}

test("AC-E325-1: no rename (stable flat and stable lane) -> advisory reported as before", () => {
  for (const layout of ["flat", "lane"]) {
    const fx = mkFixture(layout);
    resetSession();
    assert.ok(skewLines(JSON.parse(detectDrift(fx.ws))).some((d) => SKEW.test(d)), layout);
  }
});

test("AC-E325-1: the retry is read-only (no migration, no write): both layouts' file sets are unchanged after the call", () => {
  const fx = mkFixture("flat");
  resetSession();
  detectDrift(fx.ws);
  assert.ok(fs.existsSync(fx.flat), "flat handoff untouched");
  assert.ok(!fs.existsSync(fx.lane), "no lane handoff created by the peek");
});

test("AC-E325-2: neither layout present -> no skew advisory, no throw", () => {
  const fx = mkFixture("none");
  resetSession();
  assert.deepEqual(skewLines(JSON.parse(detectDrift(fx.ws))), []);
});

test("AC-E325-2: a vanishing file with no counterpart (renamed away to elsewhere) -> still null, no throw", () => {
  const fx = mkFixture("flat");
  const real = cjsFs.existsSync;
  let first = true;
  cjsFs.existsSync = function (p) {
    const r = real.call(cjsFs, p);
    if (first && p === fx.lane) {
      first = false;
      fs.unlinkSync(fx.flat);
    }
    return r;
  };
  nodeModule.syncBuiltinESMExports();
  try {
    resetSession();
    assert.deepEqual(skewLines(JSON.parse(detectDrift(fx.ws))), []);
  } finally {
    cjsFs.existsSync = real;
    nodeModule.syncBuiltinESMExports();
  }
});

test("AC-E325-2: present-but-unparseable frontmatter -> no skew advisory (null), unchanged", () => {
  const fx = mkFixture("lane", "---\n: : [unclosed\n---\nbody\n");
  resetSession();
  // The peek's catch yields null (no skew line); the later primary parser then refuses loudly, exactly
  // as at base, so the whole call throws the parser's error and never a fabricated skew reason.
  assert.throws(() => detectDrift(fx.ws), (err) => /Failed to parse handoff\.md frontmatter/.test(String(err?.message)) && !SKEW.test(String(err?.message)));
});

test("AC-E325-2: present file with no frontmatter -> version 0, no skew advisory", () => {
  const fx = mkFixture("flat", "# no frontmatter here\n");
  resetSession();
  assert.deepEqual(skewLines(JSON.parse(detectDrift(fx.ws))), []);
});
