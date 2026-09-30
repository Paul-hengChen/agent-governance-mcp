// Coded by @qa-engineer
// Tests for schema/versions.ts — pure runner; no I/O. Imports compiled output
// in dist/. Each test resets the registry via _clearRegistryForTests so
// fixtures don't bleed.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_VERSIONS,
  VERSION_WHEN_ABSENT,
  registerMigration,
  peekVersion,
  runMigrations,
  _clearRegistryForTests,
} from "../dist/schema/versions.js";

function reset() {
  _clearRegistryForTests();
}

// ---------- CURRENT_VERSIONS / VERSION_WHEN_ABSENT ----------

test("CURRENT_VERSIONS exposes the four kinds at their e123a-lane-layout-migration levels", () => {
  // Handoff version history, one step per schema change:
  // v6 added external_refs (b8-external-ref-ledger).
  // v7 added next_role/resume_of/review_verdict — stamp-only migration, DR-1 (c9-protocol-fields).
  // v8 added dispatch_pins — stamp-only migration, AC-1 (c14-dispatch-pins).
  // v9 added hop_count — seeded 0, DR-3; sibling of qa_round/review_round/
  // visual_round, not a stamp-only attestation (d2-server-brake-accounting).
  // v10 added dispatched_at — stamp-only, seeds nothing, DR-7; next_role's
  // direct companion (d5-server-side-stale-dispatch-detection).
  // v11 added dispatch_mode — stamp-only, seeds nothing; follows the
  // dispatch_pins/external_refs feature-scoped carry-forward algorithm, but
  // scalar (e2-bugfix-repro-gate).
  // v12 added qa_rounds_total/review_rounds_total/visual_rounds_total —
  // seeded 0, like the hop_count counter, NOT stamp-only (e8-success-telemetry).
  // v13 added the evidence_schema pin — stamp-only, seeds nothing; the
  // dispatch_mode scalar algorithm (e23-evidence-schema-versioning).
  // v14 added cut_approved_source — stamp-only, seeds nothing; the
  // dispatch_mode scalar algorithm again (e114-cut-approval-inheritance).
  // v15 added dispatch_mechanism/dispatch_mechanism_tier — stamp-only, seeds
  // nothing; the dispatch_mode scalar algorithm again (e123a-lane-layout-migration).
  // sqlite stays at 2 — hop_count IS persisted there too, via the idempotent
  // addColumnIfMissing ALTER (DR-2), the exact mechanism that added
  // visual_round without a versioned bump; unlike external_refs/
  // dispatch_pins/dispatched_at/dispatch_mode/the three cumulative round totals/evidence_schema/
  // cut_approved_source/dispatch_mechanism/dispatch_mechanism_tier, which are
  // handoff-YAML frontmatter only (DR-5/DR-1 — SqliteHandoffStorage ignores
  // those). The tasks schema moves to 2 (stamp-only — the MEANING of v2 is
  // carried by WHICH PATH the file lives at, D-D; the step itself leaves the
  // body untouched; e125a-lane-local-ledgers). The config schema moves to v2
  // (added the optional "artifacts" key — stamp-only, seeds nothing; the
  // dispatch_mode/cut_approved_source scalar-stamp algorithm again; see e106-init-artifacts-flag).
  assert.equal(CURRENT_VERSIONS.handoff, 15);
  assert.equal(CURRENT_VERSIONS.tasks, 2);
  assert.equal(CURRENT_VERSIONS.sqlite, 2);
  assert.equal(CURRENT_VERSIONS.config, 2);
});

test("VERSION_WHEN_ABSENT is 0", () => {
  assert.equal(VERSION_WHEN_ABSENT, 0);
});

// ---------- registerMigration ----------

test("registerMigration accepts adjacent integer step", () => {
  reset();
  assert.doesNotThrow(() =>
    registerMigration({ kind: "handoff", from: 0, to: 1, up: (x) => x })
  );
});

test("registerMigration rejects non-adjacent step (to !== from+1)", () => {
  reset();
  assert.throws(
    () => registerMigration({ kind: "handoff", from: 0, to: 2, up: (x) => x }),
    /only adjacent integer steps allowed/
  );
});

test("registerMigration rejects backwards step (to < from)", () => {
  reset();
  assert.throws(
    () => registerMigration({ kind: "handoff", from: 2, to: 1, up: (x) => x }),
    /only adjacent integer steps allowed/
  );
});

test("registerMigration rejects non-integer from", () => {
  reset();
  assert.throws(
    () => registerMigration({ kind: "handoff", from: 0.5, to: 1.5, up: (x) => x }),
    /from\/to must be integers/
  );
});

test("registerMigration rejects non-integer to", () => {
  reset();
  assert.throws(
    () => registerMigration({ kind: "handoff", from: 1, to: 2.5, up: (x) => x }),
    /from\/to must be integers/
  );
});

test("registerMigration rejects NaN from/to", () => {
  reset();
  assert.throws(
    () => registerMigration({ kind: "handoff", from: NaN, to: 1, up: (x) => x }),
    /from\/to must be integers/
  );
});

test("registerMigration rejects negative from/to", () => {
  reset();
  assert.throws(
    () => registerMigration({ kind: "handoff", from: -1, to: 0, up: (x) => x }),
    /from\/to must be non-negative/
  );
});

test("registerMigration idempotent overwrite — last write wins", () => {
  reset();
  // Register v0→v1 twice (overwrite test); also register v1→v2, v2→v3, v3→v4, v4→v5,
  // v5→v6, v6→v7, v7→v8, v8→v9, v9→v10, v10→v11, v11→v12, v12→v13, v13→v14, and
  // v14→v15 since CURRENT_VERSIONS.handoff is now 15 (the lane-layout
  // migration level, e123a-lane-layout-migration) — the runner must climb the full chain.
  registerMigration({ kind: "handoff", from: 0, to: 1, up: () => ({ schema_version: 1, who: "first" }) });
  registerMigration({ kind: "handoff", from: 0, to: 1, up: () => ({ schema_version: 1, who: "second" }) });
  registerMigration({ kind: "handoff", from: 1, to: 2, up: (input) => ({ ...input, schema_version: 2 }) });
  registerMigration({ kind: "handoff", from: 2, to: 3, up: (input) => ({ ...input, schema_version: 3 }) });
  registerMigration({ kind: "handoff", from: 3, to: 4, up: (input) => ({ ...input, schema_version: 4 }) });
  registerMigration({ kind: "handoff", from: 4, to: 5, up: (input) => ({ ...input, schema_version: 5 }) });
  registerMigration({ kind: "handoff", from: 5, to: 6, up: (input) => ({ ...input, schema_version: 6 }) });
  registerMigration({ kind: "handoff", from: 6, to: 7, up: (input) => ({ ...input, schema_version: 7 }) });
  registerMigration({ kind: "handoff", from: 7, to: 8, up: (input) => ({ ...input, schema_version: 8 }) });
  registerMigration({ kind: "handoff", from: 8, to: 9, up: (input) => ({ ...input, schema_version: 9, hop_count: 0 }) });
  registerMigration({ kind: "handoff", from: 9, to: 10, up: (input) => ({ ...input, schema_version: 10 }) });
  registerMigration({ kind: "handoff", from: 10, to: 11, up: (input) => ({ ...input, schema_version: 11 }) });
  registerMigration({ kind: "handoff", from: 11, to: 12, up: (input) => ({ ...input, schema_version: 12, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 }) });
  registerMigration({ kind: "handoff", from: 12, to: 13, up: (input) => ({ ...input, schema_version: 13 }) });
  registerMigration({ kind: "handoff", from: 13, to: 14, up: (input) => ({ ...input, schema_version: 14 }) });
  registerMigration({ kind: "handoff", from: 14, to: 15, up: (input) => ({ ...input, schema_version: 15 }) });
  const result = runMigrations("handoff", { /* no schema_version → v0 */ });
  // Overwrite semantics: the second v0→v1 registration is the one that runs;
  // its `who: "second"` field threads through the v1→v2→...→v15 steps unchanged.
  assert.equal(result.payload.who, "second");
});

// ---------- peekVersion ----------

test("peekVersion reads numeric schema_version from object", () => {
  assert.equal(peekVersion({ schema_version: 3 }), 3);
});

test("peekVersion collapses null to 0", () => {
  assert.equal(peekVersion(null), 0);
});

test("peekVersion collapses undefined to 0", () => {
  assert.equal(peekVersion(undefined), 0);
});

test("peekVersion collapses non-object (number) to 0", () => {
  assert.equal(peekVersion(42), 0);
});

test("peekVersion collapses non-object (string) to 0", () => {
  assert.equal(peekVersion("1"), 0);
});

test("peekVersion collapses object with string schema_version to 0", () => {
  assert.equal(peekVersion({ schema_version: "1" }), 0);
});

test("peekVersion collapses NaN schema_version to 0", () => {
  assert.equal(peekVersion({ schema_version: NaN }), 0);
});

test("peekVersion collapses Infinity schema_version to 0", () => {
  assert.equal(peekVersion({ schema_version: Infinity }), 0);
});

test("peekVersion collapses negative schema_version to 0", () => {
  assert.equal(peekVersion({ schema_version: -1 }), 0);
});

test("peekVersion floors fractional schema_version", () => {
  assert.equal(peekVersion({ schema_version: 1.9 }), 1);
});

test("peekVersion returns 0 when schema_version field missing", () => {
  assert.equal(peekVersion({ other: "data" }), 0);
});

test("peekVersion handles array as non-object payload", () => {
  // Arrays are typeof 'object' so they pass the first guard, but lack
  // schema_version → fall through to default 0.
  assert.equal(peekVersion([1, 2, 3]), 0);
});

// ---------- runMigrations: no-op + composition ----------

test("runMigrations no-op when current === target", () => {
  reset();
  // CURRENT_VERSIONS.handoff === 15 (e123a-lane-layout-migration); payload
  // already at v15. Must register all steps so the runner can reach v15 from
  // v0 in other tests.
  registerMigration({ kind: "handoff", from: 0, to: 1, up: (input) => ({ ...input, schema_version: 1 }) });
  registerMigration({ kind: "handoff", from: 1, to: 2, up: (input) => ({ ...input, schema_version: 2 }) });
  registerMigration({ kind: "handoff", from: 2, to: 3, up: (input) => ({ ...input, schema_version: 3 }) });
  registerMigration({ kind: "handoff", from: 3, to: 4, up: (input) => ({ ...input, schema_version: 4 }) });
  registerMigration({ kind: "handoff", from: 4, to: 5, up: (input) => ({ ...input, schema_version: 5 }) });
  registerMigration({ kind: "handoff", from: 5, to: 6, up: (input) => ({ ...input, schema_version: 6 }) });
  registerMigration({ kind: "handoff", from: 6, to: 7, up: (input) => ({ ...input, schema_version: 7 }) });
  registerMigration({ kind: "handoff", from: 7, to: 8, up: (input) => ({ ...input, schema_version: 8 }) });
  registerMigration({ kind: "handoff", from: 8, to: 9, up: (input) => ({ ...input, schema_version: 9, hop_count: 0 }) });
  registerMigration({ kind: "handoff", from: 9, to: 10, up: (input) => ({ ...input, schema_version: 10 }) });
  registerMigration({ kind: "handoff", from: 10, to: 11, up: (input) => ({ ...input, schema_version: 11 }) });
  registerMigration({ kind: "handoff", from: 11, to: 12, up: (input) => ({ ...input, schema_version: 12, qa_rounds_total: 0, review_rounds_total: 0, visual_rounds_total: 0 }) });
  registerMigration({ kind: "handoff", from: 12, to: 13, up: (input) => ({ ...input, schema_version: 13 }) });
  registerMigration({ kind: "handoff", from: 13, to: 14, up: (input) => ({ ...input, schema_version: 14 }) });
  registerMigration({ kind: "handoff", from: 14, to: 15, up: (input) => ({ ...input, schema_version: 15 }) });
  const result = runMigrations("handoff", { schema_version: 15, kept: true });
  assert.deepEqual(result.applied, []);
  assert.equal(result.fromVersion, 15);
  assert.equal(result.toVersion, 15);
  assert.equal(result.payload.kept, true);
});

test("runMigrations applies single v1→v2 step", () => {
  reset();
  // The config schema is now at version 2 (e106-init-artifacts-flag), so every
  // kind's target is now >= 2 — no kind stops at v1 any more. Isolate the
  // single-step path by starting the input AT v1 (current=1) with only the
  // 1->2 step registered, the same shift the real config migration itself
  // underwent (was 0->1 stopping at target=1; now 1->2 stopping at target=2).
  registerMigration({
    kind: "config",
    from: 1,
    to: 2,
    up: (input) => ({ ...input, schema_version: 2, migrated_from_v1: true }),
  });
  const result = runMigrations("config", { schema_version: 1, legacy: "field" });
  assert.deepEqual(result.applied, [2]);
  assert.equal(result.fromVersion, 1);
  assert.equal(result.toVersion, 2);
  assert.equal(result.payload.migrated_from_v1, true);
  assert.equal(result.payload.legacy, "field");
});

// ---------- runMigrations: refuse-loud (AC-4) ----------

test("runMigrations refuses-loud when on-disk version > current (AC-4)", () => {
  reset();
  // CURRENT_VERSIONS.handoff === 15 (lane-layout migration level, e123a-lane-layout-migration), so the
  // "server max" surfaced in the refuse-loud error tracks the bumped value.
  assert.throws(
    () => runMigrations("handoff", { schema_version: 99 }),
    /on-disk version 99 > server max 15/
  );
});

test("runMigrations refuse-loud message names the kind", () => {
  reset();
  assert.throws(
    () => runMigrations("sqlite", { schema_version: 7 }),
    /sqlite on-disk version 7/
  );
});

test("runMigrations refuses-loud on missing step", () => {
  reset();
  // No migration registered, but current(0) < target(1) → missing-step error.
  assert.throws(
    () => runMigrations("handoff", { /* v0 */ }),
    /missing migration step handoff v0→v1/
  );
});

// ---------- runMigrations: multi-step composition ----------

test("runMigrations composes a multi-step chain v0→v2 (now the real config target)", () => {
  reset();
  // The config schema is now at version 2 (e106-init-artifacts-flag), so this is
  // no longer hypothetical: a fresh config genuinely walks two real steps
  // (0->1, 1->2) to reach CURRENT. Register both and assert full composition.
  registerMigration({
    kind: "config",
    from: 0,
    to: 1,
    up: (input) => ({ ...input, schema_version: 1, step1: true }),
  });
  registerMigration({
    kind: "config",
    from: 1,
    to: 2,
    up: (input) => ({ ...input, schema_version: 2, step2: true }),
  });
  const result = runMigrations("config", { taskPaths: ["tasks.md"] });
  assert.deepEqual(result.applied, [1, 2]);
  assert.equal(result.payload.step1, true);
  assert.equal(result.payload.step2, true);
  assert.equal(result.payload.taskPaths[0], "tasks.md");
});

test("runMigrations threads payload through steps (output of N = input of N+1)", () => {
  reset();
  // Build a fake v0 payload and register BOTH real "tasks" steps
  // (CURRENT_VERSIONS.tasks is now 2, e125a-lane-local-ledgers), so this
  // exercises the actual v0->v1->v2 chain: v1->v2's `up` asserts its input is
  // literally v0->v1's output object (no double-wrap), which is a strictly
  // stronger version of the original single-step assertion.
  const sentinel = Symbol("threaded");
  registerMigration({
    kind: "tasks",
    from: 0,
    to: 1,
    up: (input) => {
      // Confirm the input is the original raw object passed to runMigrations.
      assert.equal(input.original, true);
      return { schema_version: 1, midpoint: true };
    },
  });
  registerMigration({
    kind: "tasks",
    from: 1,
    to: 2,
    up: (input) => {
      // Confirm v0->v1's OUTPUT is literally this step's INPUT — no
      // double-wrap, no field loss threading through the chain.
      assert.equal(input.midpoint, true);
      return { schema_version: 2, threaded: sentinel };
    },
  });
  const result = runMigrations("tasks", { original: true });
  assert.equal(result.payload.threaded, sentinel);
});

// ---------- _clearRegistryForTests ----------

test("_clearRegistryForTests empties the registry", () => {
  registerMigration({ kind: "handoff", from: 0, to: 1, up: (x) => x });
  _clearRegistryForTests();
  // After clearing, runMigrations against a v0 payload should fail with
  // missing-step (proving the registry is empty).
  assert.throws(
    () => runMigrations("handoff", {}),
    /missing migration step/
  );
});
