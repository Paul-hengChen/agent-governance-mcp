// Coded by @qa-engineer
// Tests for spec: specs/dependency-security-protobufjs.md.
// Spec-to-Test map: AC1/AC4 -> these tests (the override pins that clear the
//   advisories must stay in place and meet the patched-version floor).
//   AC2 (embedding runtime) + AC3 (suite green) are verified by the audit +
//   manual embedding smoke + the full suite itself, not re-run here (a real
//   embedding test needs network/model download — unfit for the headless CI suite).
//
// WHY: the protobufjs/qs advisories reach the tree only transitively, so the
// fix is a package.json `overrides` pin. Nothing else encodes that pin — if a
// future dependency edit drops it, the vulnerabilities silently return and the
// audit gate would only catch it at the next manual run. This test fails loudly
// the moment the pin floor regresses.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));

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
