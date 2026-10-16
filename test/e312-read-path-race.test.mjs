// Coded by @qa-engineer
// Deterministic regression tests for the read-path flat<->lane migration race
// (specs/e312-read-path-migration-race.md, AC5). The read path's layout checks run
// without the lane lock, so a sibling's atomic rename can land between two of its
// existsSync calls. Each case injects exactly such a rename at a chosen existsSync call
// (the node:fs CJS export is wrapped; ESM bindings are re-synced and restored in finally)
// and asserts the reader still sees the moved state instead of a false conflict or a
// spurious "no state". Stable dual presence must keep failing loud (AC4).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import * as nodeModule from "node:module";

import { parseHandoff, readHandoffState } from "../dist/tools/handoff.js";
import { resolveCurrentLanePaths, resolveCurrentLane, resolveLaneLockPath } from "../dist/tools/lane-paths.js";
import { resetSession } from "../dist/guards/session.js";
import { setActiveStorage, FileHandoffStorage } from "../dist/tools/storage.js";

const cjsFs = createRequire(import.meta.url)("node:fs");
const FEATURE = "e312-race-fixture";

function body(feature) {
  return `---\nschema_version: 15\nactive_feature: "${feature}"\nstatus: "In_Progress"\nlast_updated: "2026-01-01T00:00:00.000Z"\nlast_agent: "pm"\nqa_round: 0\nreview_round: 0\nvisual_round: 0\n---\n## Completed\n- (none)\n\n## Pending & Handoff Notes\n- (none)\n`;
}

// layout: "flat" (only .current/handoff.md) or "lane" (only the lane handoff.md).
function mkFixture(layout) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e312-race-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  const flat = path.join(ws, ".current", "handoff.md");
  const lane = resolveCurrentLanePaths(ws).handoffPath;
  const target = layout === "flat" ? flat : lane;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body(FEATURE));
  return { ws, flat, lane };
}

// Runs fn with existsSync wrapped. Calls on the lane/flat handoff paths are counted
// (1-based); `trigger(n, p, result)` decides whether the injected rename runs right
// after that call returns its (already computed) answer. The rename fires at most once.
function withInjection({ flat, lane }, from, to, trigger, fn) {
  const real = cjsFs.existsSync;
  const src = from === "flat" ? flat : lane;
  const dst = from === "flat" ? lane : flat;
  let n = 0;
  let fired = false;
  cjsFs.existsSync = function (p) {
    const result = real.call(cjsFs, p);
    if (p === flat || p === lane) {
      n += 1;
      // A real sibling renames only while holding the lane lock, so an unlocked reader
      // can never overlap the in-process migration; skip injections while it is held.
      const lockHeld = real.call(cjsFs, resolveLaneLockPath(path.dirname(path.dirname(flat)), resolveCurrentLane(path.dirname(path.dirname(flat)))));
      if (!fired && !lockHeld && real.call(cjsFs, src) && trigger(n, p, result)) {
        fired = true;
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.renameSync(src, dst);
      }
    }
    return result;
  };
  nodeModule.syncBuiltinESMExports();
  try {
    const out = fn();
    return { out, fired };
  } finally {
    cjsFs.existsSync = real;
    nodeModule.syncBuiltinESMExports();
  }
}

function freshSession(ws) {
  setActiveStorage(new FileHandoffStorage());
  resetSession();
  return ws;
}

const readers = {
  parseHandoff: (ws) => parseHandoff(ws),
  readHandoffState: (ws) => {
    const parsed = JSON.parse(readHandoffState(ws));
    assert.equal(parsed.exists, true, "readHandoffState must not report 'no state' for a moved handoff");
    return parsed.state ?? parsed;
  },
};

function assertFixtureState(state, why) {
  assert.ok(state, `${why}: reader returned no state`);
  assert.equal(state.active_feature, FEATURE, `${why}: wrong state`);
}

// Sweep every injection point so the test does not depend on how many existsSync calls
// the implementation happens to make before the window it protects.
const POINTS = [1, 2, 3, 4, 5, 6];

for (const [name, read] of Object.entries(readers)) {
  test(`(i) R1 forward: flat->lane rename after the first existsSync(flat) that sees it -> ${name} succeeds, no false HANDOFF_LAYOUT_CONFLICT`, () => {
    const fx = mkFixture("flat");
    freshSession(fx.ws);
    const { out } = withInjection(fx, "flat", "lane", (_n, p, r) => p === fx.flat && r === true, () => read(fx.ws));
    assertFixtureState(out, "named R1 window");
  });

  test(`(i) R1/R2 forward sweep: flat->lane rename after existsSync call N=1..6 -> ${name} always returns the fixture state`, () => {
    let firedAny = false;
    for (const at of POINTS) {
      const fx = mkFixture("flat");
      freshSession(fx.ws);
      const { out, fired } = withInjection(fx, "flat", "lane", (n) => n === at, () => read(fx.ws));
      firedAny ||= fired;
      assertFixtureState(out, `forward N=${at}`);
    }
    assert.ok(firedAny, "harness sanity: at least one injection point must actually fire");
  });

  test(`(ii) reverse: lane->flat rename after the first lane check -> ${name} does not throw`, () => {
    const fx = mkFixture("lane");
    freshSession(fx.ws);
    const { out } = withInjection(fx, "lane", "flat", (_n, p, r) => p === fx.lane && r === true, () => read(fx.ws));
    assertFixtureState(out, "named reverse window");
  });

  test(`(iii) R2 both directions: rename lands after existsSync call N=1..6 (pick-then-read window) -> ${name} returns state, never null`, () => {
    let firedAny = false;
    for (const dir of [["lane", "flat"], ["flat", "lane"]]) {
      for (const at of POINTS) {
        const fx = mkFixture(dir[0]);
        freshSession(fx.ws);
        const { out, fired } = withInjection(fx, dir[0], dir[1], (n) => n === at, () => read(fx.ws));
        firedAny ||= fired;
        assertFixtureState(out, `${dir[0]}->${dir[1]} N=${at}`);
      }
    }
    assert.ok(firedAny, "harness sanity: at least one injection point must actually fire");
  });
}

test("(iv) stable dual presence still throws HANDOFF_LAYOUT_CONFLICT on own-workspace read and cross-workspace parse", () => {
  const fx = mkFixture("flat");
  freshSession(fx.ws);
  fs.mkdirSync(path.dirname(fx.lane), { recursive: true });
  fs.writeFileSync(fx.lane, body("e312-lane-side"));
  assert.throws(() => readHandoffState(fx.ws), /HANDOFF_LAYOUT_CONFLICT/);
  assert.throws(() => parseHandoff(fx.ws), /HANDOFF_LAYOUT_CONFLICT/);
  assert.ok(fs.existsSync(fx.flat) && fs.existsSync(fx.lane), "neither file may be moved or removed by the failing read");
});
