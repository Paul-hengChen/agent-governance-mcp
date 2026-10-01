// Coded by @qa-engineer
// Tests for specs/dependency-security-protobufjs.md and the sharp row in docs/backlog.md:
// the package.json `overrides` pins that clear the advisories must stay and meet their version floors.
// Also guards against a duplicate top-level "overrides" key, which JSON.parse hides.
// Runtime embedding and suite-green checks are out of scope here (they need network or run elsewhere).
// More: specs/e260e-comment-rationale.md (dependency-overrides.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_PATH = path.join(ROOT, "package.json");
const PKG_RAW = fs.readFileSync(PKG_PATH, "utf-8");
const pkg = JSON.parse(PKG_RAW);

// Lowest version of a semver range like "^7.5.8" / ">=6.15.2" / "7.6.0".
function minVersion(range) {
  const m = String(range).match(/(\d+)\.(\d+)\.(\d+)/);
  assert.ok(m, `override range "${range}" must contain a concrete version`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// a >= b for [major,minor,patch] tuples.
function gte(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

test("AC4: package.json declares an overrides block", () => {
  assert.ok(pkg.overrides && typeof pkg.overrides === "object", "overrides block must exist");
});

test("AC1: protobufjs override floor is >= 7.5.8 (clears GHSA-xq3m-2v4x-88gg et al.)", () => {
  // protobufjs <=7.5.7 carries a critical RCE + several high advisories, reachable
  // transitively via @xenova/transformers -> onnxruntime-web -> onnx-proto.
  assert.ok(pkg.overrides?.protobufjs, "overrides.protobufjs pin must be present");
  assert.ok(
    gte(minVersion(pkg.overrides.protobufjs), [7, 5, 8]),
    `protobufjs override (${pkg.overrides.protobufjs}) must floor at >= 7.5.8`,
  );
});

test("AC1: qs override floor is >= 6.15.2 (clears GHSA-q8mj-m7cp-5q26)", () => {
  // qs 6.11.1-6.15.1 has a remotely-triggerable DoS, reachable via the MCP SDK's
  // express -> qs chain.
  assert.ok(pkg.overrides?.qs, "overrides.qs pin must be present");
  assert.ok(
    gte(minVersion(pkg.overrides.qs), [6, 15, 2]),
    `qs override (${pkg.overrides.qs}) must floor at >= 6.15.2`,
  );
});

test("E57 AC1: sharp override floor is >= 0.35.3 (clears GHSA-f88m-g3jw-g9cj libvips CVEs)", () => {
  // sharp <0.35.0 inherits libvips CVE-2026-33327/33328/35590/35591, reachable
  // transitively via @xenova/transformers' own `sharp: ^0.32.0` declaration
  // (docs/dependency-advisories.md #4/#5). This is the one re-review trigger
  // in that record with no other mechanical anchor (attention-dependent per
  // the record's own note) — this pin is the anchor.
  assert.ok(pkg.overrides?.sharp, "overrides.sharp pin must be present");
  assert.ok(
    gte(minVersion(pkg.overrides.sharp), [0, 35, 3]),
    `sharp override (${pkg.overrides.sharp}) must floor at >= 0.35.3`,
  );
});

test("E57: package.json declares exactly ONE top-level `overrides` key with all three pins effective", () => {
  // A second, later `"overrides": {...}` key in the raw JSON text is not a
  // parse error -- JSON.parse silently keeps the last duplicate and drops
  // the first, so `pkg.overrides` can look complete while the file itself
  // is malformed (exactly the near-miss this ticket produced and caught only
  // via an installed-version mismatch, not via any static check). Assert
  // both the raw-text shape AND the effective parsed content, since either
  // alone would have missed a different half of that failure mode.
  const rawOverridesKeyCount = (PKG_RAW.match(/"overrides"\s*:/g) ?? []).length;
  assert.equal(
    rawOverridesKeyCount,
    1,
    `package.json must declare exactly one "overrides" key (found ${rawOverridesKeyCount}) -- a duplicate key is silently collapsed by JSON.parse and would make an earlier override block inert`,
  );
  assert.deepEqual(
    Object.keys(pkg.overrides).sort(),
    ["protobufjs", "qs", "sharp"],
    "the single effective overrides block must carry exactly protobufjs, qs, and sharp -- no pin silently dropped or orphaned",
  );
});
