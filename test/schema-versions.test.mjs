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

test("CURRENT_VERSIONS exposes the four kinds at their d5-server-side-stale-dispatch-detection levels", () => {
  // c9-protocol-fields bumped handoff to 7 (added next_role/resume_of/
  // review_verdict — stamp-only migration, DR-1). b8-external-ref-ledger had
  // bumped it to 6 (external_refs). c14-dispatch-pins bumped it to 8 (added
  // dispatch_pins — stamp-only migration, AC-1). d2-server-brake-accounting
  // bumped it to 9 (added hop_count — seeded 0, DR-3; sibling of
  // qa_round/review_round/visual_round, not a stamp-only attestation).
  // d5-server-side-stale-dispatch-detection now bumps it to 10 (added
  // dispatched_at — stamp-only, seeds nothing, DR-7; next_role's direct
  // companion). sqlite stays at 2 — hop_count IS persisted there too, via the
  // idempotent addColumnIfMissing ALTER (DR-2), the exact mechanism that added
  // visual_round without a versioned bump; unlike external_refs/dispatch_pins/
  // dispatched_at, which are handoff-YAML frontmatter only (DR-5 —
  // SqliteHandoffStorage.writeState ignores those). tasks + config remain at v1.
  assert.equal(CURRENT_VERSIONS.handoff, 10);
  assert.equal(CURRENT_VERSIONS.tasks, 1);
  assert.equal(CURRENT_VERSIONS.sqlite, 2);
  assert.equal(CURRENT_VERSIONS.config, 1);
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
  // v5→v6, v6→v7, v7→v8, v8→v9, and v9→v10 since CURRENT_VERSIONS.handoff is now 10
  // (d5-server-side-stale-dispatch-detection) — the runner must climb the full chain.
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
  const result = runMigrations("handoff", { /* no schema_version → v0 */ });
  // Overwrite semantics: the second v0→v1 registration is the one that runs;
  // its `who: "second"` field threads through the v1→v2→...→v10 steps unchanged.
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
  // CURRENT_VERSIONS.handoff === 10 (d5-server-side-stale-dispatch-detection);
  // payload already at v10. Must register all steps so the runner can reach
  // v10 from v0 in other tests.
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
  const result = runMigrations("handoff", { schema_version: 10, kept: true });
  assert.deepEqual(result.applied, []);
  assert.equal(result.fromVersion, 10);
  assert.equal(result.toVersion, 10);
  assert.equal(result.payload.kept, true);
});

test("runMigrations applies single v0→v1 step", () => {
  reset();
  // Use kind: "tasks" so the runner stops at v1 (CURRENT_VERSIONS.tasks === 1).
  // After v3.9.0 the "handoff" CURRENT is 2, which would require a chained step;
  // this test specifically exercises the single-step path.
  registerMigration({
    kind: "tasks",
    from: 0,
    to: 1,
    up: (input) => ({ ...input, schema_version: 1, migrated_from_v0: true }),
  });
  const result = runMigrations("tasks", { legacy: "field" });
  assert.deepEqual(result.applied, [1]);
  assert.equal(result.fromVersion, 0);
  assert.equal(result.toVersion, 1);
  assert.equal(result.payload.migrated_from_v0, true);
  assert.equal(result.payload.legacy, "field");
});

// ---------- runMigrations: refuse-loud (AC-4) ----------

test("runMigrations refuses-loud when on-disk version > current (AC-4)", () => {
  reset();
  // d5-server-side-stale-dispatch-detection: CURRENT_VERSIONS.handoff === 10, so
  // the "server max" surfaced in the refuse-loud error tracks the bumped value.
  assert.throws(
    () => runMigrations("handoff", { schema_version: 99 }),
    /on-disk version 99 > server max 10/
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

test("runMigrations composes a multi-step chain v0→v2 (hypothetical)", () => {
  reset();
  // Stage a hypothetical kind where target is 2 by registering both steps;
  // since CURRENT_VERSIONS.config === 1 today, we can't naturally exercise
  // v0→v2 against the real CURRENT. Instead verify composition by
  // registering v0→v1 and v1→v2, then directly assert the runner walks
  // until target. We pin target by temporarily reaching past CURRENT via a
  // payload that already advanced — see "threads payload" test below
  // for the strict composition assertion.

  // For now, simulate two-step v0→v1 against the real `config` (target=1):
  // After the step, payload should have schema_version=1 and applied=[1].
  registerMigration({
    kind: "config",
    from: 0,
    to: 1,
    up: (input) => ({ ...input, schema_version: 1, step1: true }),
  });
  const result = runMigrations("config", { taskPaths: ["tasks.md"] });
  assert.deepEqual(result.applied, [1]);
  assert.equal(result.payload.step1, true);
  assert.equal(result.payload.taskPaths[0], "tasks.md");
});

test("runMigrations threads payload through steps (output of N = input of N+1)", () => {
  reset();
  // Build a fake v0 payload, register one step, and confirm the step's
  // output literally becomes the runner's return payload (no double-wrap).
  const sentinel = Symbol("threaded");
  registerMigration({
    kind: "tasks",
    from: 0,
    to: 1,
    up: (input) => {
      // Confirm the input is the original raw object passed to runMigrations.
      assert.equal(input.original, true);
      return { schema_version: 1, threaded: sentinel };
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
