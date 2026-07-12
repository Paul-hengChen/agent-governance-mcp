// Coded by @qa-engineer
// T67 / AC-12(e) — handoff schema v1→v2 migration for the code-reviewer chain.
// Covers (1) review_round default of 0 on legacy fixtures, (2) the AC-9
// stderr warning emission when an in-flight ticket sits at
// sr-engineer:In_Progress at migration time. Imports compiled dist/.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parseHandoff, writeHandoffState } from "../dist/tools/handoff.js";
import { resetSession } from "../dist/guards/session.js";

function mkWorkspace(prefix = "twmig-") {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeRaw(ws, content) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), content, "utf-8");
}

// ---------- AC-12(e) part 1: review_round default ----------

test("AC-12(e): v1 handoff (no review_round) migrates to v2 with review_round=0", () => {
  // Why: AC-9 mandates the v1→v2 migration default the new field to 0 for
  // legacy fixtures. parseHandoff is the gateway — it composes the runner
  // and the in-memory state assembly. Without the default, downstream
  // transition logic (cap checks, computeNewRound) would NaN-out.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 1
active_feature: "legacy-feat"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 2
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.active_feature, "legacy-feat");
  assert.equal(state.qa_round, 2, "qa_round survives migration unchanged");
  assert.equal(state.review_round, 0, "review_round defaults to 0 on v1→v2 migration");
});

test("AC-12(e): pre-versioning handoff (no schema_version at all) migrates v0→v3 with review_round=0 and visual_round=0", () => {
  // Why: the runner walks the full chain. A truly-legacy file with no
  // schema_version key starts at v0, climbs v0→v1→v2→v3 (v3.14.0). All
  // intermediate defaults (qa_round=0 from v0→v1; review_round=0 from
  // v1→v2; visual_round=0 from v2→v3) must hold.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
active_feature: "pre-version"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "pm"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.qa_round, 0);
  assert.equal(state.review_round, 0);
  assert.equal(state.visual_round, 0, "v3.14.0: visual_round defaults to 0 on v2→v3 migration");
});

test("AC-12(e): v2 handoff with explicit review_round=3 migrates to v3 (review_round preserved, visual_round=0)", () => {
  // Why: v3.14.0 migration regression — a v2 file climbs to v3, preserving
  // existing fields (review_round=3) and adding the new visual_round=0.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 2
active_feature: "current"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "code-reviewer"
qa_round: 0
review_round: 3
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.review_round, 3);
  assert.equal(state.visual_round, 0, "v3.14.0: visual_round stamped to 0 on v2→v3 migration");
});

// ---------- AC-12(e) part 2: AC-9 stderr migration warning ----------

test("AC-12(e) / AC-9: v1→v2 migration emits stderr warning for in-flight sr-engineer:In_Progress ticket", () => {
  // Why: AC-9 mandates a one-shot operator-visible warning when migrating a
  // ticket that is stranded at sr-engineer:In_Progress — the v3.9.0 matrix
  // makes its next move (direct to qa-engineer) impossible, so the operator
  // must manually re-route to code-reviewer.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 1
active_feature: "in-flight"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "sr-engineer"
qa_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );

  // Capture stderr by patching process.stderr.write for the duration of the parse.
  const captured = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
    return true;
  };
  try {
    parseHandoff(ws);
  } finally {
    process.stderr.write = orig;
  }

  const joined = captured.join("");
  assert.match(
    joined,
    /\[code-reviewer migration\] In-flight ticket detected at sr-engineer:In_Progress/,
    `expected AC-9 verbatim warning prefix in stderr; got: ${joined}`,
  );
  assert.match(
    joined,
    /Manually re-route to code-reviewer or roll back to pm\./,
    `expected AC-9 instruction tail in stderr; got: ${joined}`,
  );
});

test("AC-12(e) / AC-9: v1→v2 migration is silent when in-flight state is NOT sr-engineer:In_Progress", () => {
  // Why: the warning is targeted — false-positives on (pm, In_Progress),
  // (sr-engineer, Blocked), or any FAIL/PASS row would create alert fatigue.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 1
active_feature: "not-in-flight"
status: "Blocked"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "sr-engineer"
qa_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );

  const captured = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
    return true;
  };
  try {
    parseHandoff(ws);
  } finally {
    process.stderr.write = orig;
  }

  const joined = captured.join("");
  assert.doesNotMatch(
    joined,
    /\[code-reviewer migration\]/,
    `warning must NOT fire for sr-engineer:Blocked; got: ${joined}`,
  );
});

test("AC-12(e) / AC-9: v2 file (no migration applied) does NOT emit the warning", () => {
  // Why: the warning is gated on migration.applied.includes(2). A file
  // already at v2 runs no migration steps, so even an sr-engineer:In_Progress
  // tuple must not re-fire the warning.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 2
active_feature: "already-v2"
status: "In_Progress"
last_updated: "2026-05-01T00:00:00.000Z"
last_agent: "sr-engineer"
qa_round: 0
review_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );

  const captured = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
    return true;
  };
  try {
    parseHandoff(ws);
  } finally {
    process.stderr.write = orig;
  }

  const joined = captured.join("");
  assert.doesNotMatch(
    joined,
    /\[code-reviewer migration\]/,
    `warning must NOT fire on already-v2 files; got: ${joined}`,
  );
});

// ============================================================================
// v3.30.0 — handoff schema v3 → v4 migration + scope_decision round-trip
// Tests for specs/server-scope-decision-gate.md AC-7, AC-10(f), AC-10(g) and
// the field-preservation invariant (downstream omitting write must NOT drop
// scope_decision NOR prd_path). The v3→v4 step is an additive NO-OP: it stamps
// the version but seeds NO default for scope_decision, because absence is
// meaningful (undefined === "no attestation recorded" === gate may fire). A
// defaulted value would be a false attestation.
// ============================================================================

function readRaw(ws) {
  return fs.readFileSync(path.join(ws, ".current", "handoff.md"), "utf-8");
}

test("AC-7 / AC-10(f): v3 handoff migrates to v4 on read — scope_decision undefined, other fields preserved", () => {
  // Why: the no-seed contract. A legacy v3 file (no scope_decision key) must
  // climb to v4 WITHOUT gaining a synthetic attestation — scope_decision stays
  // undefined so the gate is free to fire. All pre-existing fields (prd_path,
  // active_feature, last_agent, round counters) must survive untouched.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 3
active_feature: "legacy-v3-feat"
status: "In_Progress"
last_updated: "2026-06-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 1
review_round: 2
visual_round: 0
prd_path: "/abs/specs/legacy-v3-feat.md"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  // No-seed: the migration adds NO scope_decision default.
  assert.equal(state.scope_decision, undefined, "v3→v4 must NOT seed a scope_decision (absence is meaningful)");
  assert.equal(state.scope_decision_why, undefined, "v3→v4 must NOT seed scope_decision_why either");
  // Pre-existing fields preserved.
  assert.equal(state.active_feature, "legacy-v3-feat");
  assert.equal(state.last_agent, "pm");
  assert.equal(state.qa_round, 1, "qa_round preserved across v3→v4");
  assert.equal(state.review_round, 2, "review_round preserved across v3→v4");
  assert.equal(state.prd_path, "/abs/specs/legacy-v3-feat.md", "prd_path preserved across v3→v4");
});

test("AC-7: v4 file with scope_decision parses the attestation back", () => {
  // Why: round-trip read of an already-v4 file carrying the attestation. The
  // field must surface on the parsed state so hasScopeDecision(prevState) sees it.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 4
active_feature: "scoped-feat"
status: "In_Progress"
last_updated: "2026-06-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
scope_decision: "single-feature"
scope_decision_why: "one screen, no sub-flows"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.scope_decision, "single-feature");
  assert.equal(state.scope_decision_why, "one screen, no sub-flows");
});

test("AC-7: scope_decision round-trips through writeHandoffState → readback (v10 stamp)", async () => {
  // Why: the modern options-object write must emit scope_decision into YAML and
  // parse it back identically, stamped at v12 (e8-success-telemetry re-baseline;
  // was v11/e2-bugfix-repro-gate, v10/d5-server-side-stale-dispatch-detection,
  // v9/d2-server-brake-accounting, v8/c14-dispatch-pins, v7/c9-protocol-fields,
  // v6/b8-external-ref-ledger). This is the PM attestation write path.
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "rt-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["next_role: sr-engineer"],
    lastAgent: "pm",
    scopeDecision: "single-feature",
    scopeDecisionWhy: "small, self-contained",
  });

  const raw = readRaw(ws);
  assert.match(raw, /schema_version:\s*12/, "write stamps current handoff schema v12");
  assert.match(raw, /scope_decision:\s*["']?single-feature["']?/, "scope_decision emitted into YAML");

  const state = parseHandoff(ws);
  assert.equal(state.scope_decision, "single-feature", "scope_decision survives write→read");
  assert.equal(state.scope_decision_why, "small, self-contained", "scope_decision_why survives write→read");
});

test("field preservation: a downstream write omitting scope_decision does NOT drop it (nor prd_path)", async () => {
  // Why (the scrutinized invariant): after PM records scope_decision +
  // prd_path, a later build-role write that omits BOTH must preserve them off
  // the on-disk read — otherwise the gate would re-fire on a FAIL→pm→build
  // re-route and prd_path (RAG hook input) would be lost. This pins the
  // preserve-merge in tools/handoff.ts:writeHandoffState.
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  // PM write: records attestation + prd_path.
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "preserve-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["next_role: sr-engineer"],
    lastAgent: "pm",
    prdPath: "/abs/specs/preserve-feat.md",
    scopeDecision: "single-feature",
    scopeDecisionWhy: "tiny feature",
  });

  // Downstream sr-engineer write: omits scope_decision, scope_decision_why, prd_path.
  resetSession();
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "preserve-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["building"],
    lastAgent: "sr-engineer",
  });

  const state = parseHandoff(ws);
  assert.equal(state.scope_decision, "single-feature", "omitting write MUST preserve scope_decision");
  assert.equal(state.scope_decision_why, "tiny feature", "omitting write MUST preserve scope_decision_why");
  assert.equal(state.prd_path, "/abs/specs/preserve-feat.md", "omitting write MUST preserve prd_path");
  assert.equal(state.last_agent, "sr-engineer", "the new write's own fields still apply");
});

test("AC-3/c9: a downstream write omitting next_role/resume_of/review_verdict DOES drop them — transient, write-scoped, NOT blindly preserved (contrast with scope_decision/prd_path above)", async () => {
  // Why: c9-protocol-fields AC-3 is the deliberate INVERSE of the test above.
  // next_role/resume_of/review_verdict are single-hop directives to the
  // IMMEDIATE next reader — identical lifetime to the pending_notes lines
  // they replace (wholesale-replaced every write, never carried forward).
  // Blindly preserving them (like scope_decision/prd_path) would be a
  // behavioral regression: a stale next_role="architect" from three writes
  // ago would linger silently. This pins the round-trip: present
  // immediately after the write that sets them, ABSENT on the very next
  // write that omits them — even though that write is otherwise a plain
  // same-feature continuation, not an active_feature change (which is what
  // drops external_refs/cut_approved's feature-scoped preservation).
  const ws = mkWorkspace();
  resetSession();
  parseHandoff(ws);
  // First write: sets all three new fields.
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "transient-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["code-reviewer: approved"],
    lastAgent: "code-reviewer",
    nextRole: "qa-engineer",
    resumeOf: "qa-engineer",
    reviewVerdict: "APPROVED",
  });
  let state = parseHandoff(ws);
  assert.equal(state.next_role, "qa-engineer", "next_role must be present immediately after the write that sets it");
  assert.equal(state.resume_of, "qa-engineer", "resume_of must be present immediately after the write that sets it");
  assert.equal(state.review_verdict, "APPROVED", "review_verdict must be present immediately after the write that sets it");

  // Second write: same feature, no active_feature change, omits all three.
  resetSession();
  parseHandoff(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "transient-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["qa-engineer: reviewing"],
    lastAgent: "qa-engineer",
  });
  state = parseHandoff(ws);
  assert.equal(state.next_role, undefined, "next_role must NOT survive an omitting write — transient, not blindly preserved");
  assert.equal(state.resume_of, undefined, "resume_of must NOT survive an omitting write — transient, not blindly preserved");
  assert.equal(state.review_verdict, undefined, "review_verdict must NOT survive an omitting write — transient, not blindly preserved");
  assert.equal(state.last_agent, "qa-engineer", "the new write's own fields still apply");
});

test("AC-10(g): future v13 handoff refuses-loud against a v12 server (no silent downgrade)", () => {
  // Why: forward-compat safety. A handoff written by a newer server (v13) must
  // NOT be silently parsed by this v12 server — runMigrations throws because
  // on-disk version > server max. No new code; this pins the behavior for the
  // e8-success-telemetry version bump specifically (v11→v12; was v10→v11 under
  // e2-bugfix-repro-gate). A hypothetical v13 file must still refuse-loud
  // against the current v12 server.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 13
active_feature: "from-the-future"
status: "In_Progress"
last_updated: "2099-01-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- 無
`,
  );

  assert.throws(
    () => parseHandoff(ws),
    /on-disk version 13 > server max 12/,
    "v13 file must refuse-loud against a v12 server",
  );
});

// ============================================================================
// v3.51.0 (B8-QA) — handoff schema v5 → v6 migration + external_refs ledger
// Tests for specs/b8-external-ref-ledger.md AC-7, AC-8 and the idempotent
// stamp-only step contract (schema/migrations-handoff.ts v5→v6). Mirrors the
// v4→v5 cut_approved section above exactly, same stamp-only shape.
// ============================================================================

test("AC-7/B8: v5 handoff (no external_refs) migrates to v6 on read — field stays undefined, other fields preserved", () => {
  // Why: the no-seed contract (DR-3/AC-7). A legacy v5 file (pre-dates the ledger)
  // must climb to v6 WITHOUT gaining a synthetic external_refs value — absence
  // stays absence so the gate is free to clear (inverse polarity vs cut_approved,
  // where a no-seed migration still leaves the gate ARMED).
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 5
active_feature: "legacy-v5-feat"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 1
review_round: 2
visual_round: 0
cut_approved: true
prd_path: "/abs/specs/legacy-v5-feat.md"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: architect
`,
  );

  const state = parseHandoff(ws);
  // No-seed: the v5→v6 migration adds NO external_refs default.
  assert.equal(state.external_refs, undefined, "v5→v6 must NOT seed external_refs (absence is meaningful, AC-2/AC-7)");
  // Pre-existing fields — including the OTHER attestation field, cut_approved —
  // must survive untouched (lossless, AC-8).
  assert.equal(state.active_feature, "legacy-v5-feat");
  assert.equal(state.last_agent, "pm");
  assert.equal(state.qa_round, 1, "qa_round preserved across v5→v6");
  assert.equal(state.review_round, 2, "review_round preserved across v5→v6");
  assert.equal(state.cut_approved, true, "cut_approved (a sibling v5 attestation field) preserved across v5→v6");
  assert.equal(state.prd_path, "/abs/specs/legacy-v5-feat.md", "prd_path preserved across v5→v6");
});

test("AC-1/C9: v6→v10 migration chain stamps version only — external_refs survives, new protocol fields (incl. dispatch_pins, dispatched_at) stay absent, hop_count seeds 0", async () => {
  // Why: AC-8/B8's old no-op assertion pinned CURRENT === 6; c9-protocol-fields
  // bumped CURRENT to 7 (this test originally isolated the v6→v7 step),
  // c14-dispatch-pins bumped CURRENT to 8, d2-server-brake-accounting bumped
  // CURRENT to 9, d5-server-side-stale-dispatch-detection bumped CURRENT to
  // 10, e2-bugfix-repro-gate bumped CURRENT to 11, and e8-success-telemetry
  // now bumps CURRENT to 12 — a v6 payload is six steps BEHIND current, so
  // runMigrations climbs the full v6→v7→v8→v9→v10→v11→v12 chain in one call
  // (the runner walks current→target stepwise; there is no way to isolate a
  // single intermediate step from the public API). This re-baseline exercises
  // that chain: losslessness of the sibling v6 attestation field
  // (external_refs) plus DR-1's no-seed contract for the three c9 fields, the
  // c14 dispatch_pins field, the d5 dispatched_at field (DR-7), the e2
  // dispatch_mode field, DR-3's hop_count: 0 seed (the counter precedent, not
  // a stamp-only no-seed field), AND the e8 qa_rounds_total/
  // review_rounds_total/visual_rounds_total: 0 seed (same counter precedent).
  const { runMigrations } = await import("../dist/schema/versions.js");
  const v6Payload = {
    schema_version: 6,
    active_feature: "already-v6",
    status: "In_Progress",
    last_agent: "pm",
    external_refs: [{ ref: "JIRA-1", state: "unresolved" }],
  };
  const result = runMigrations("handoff", v6Payload);
  assert.deepEqual(result.applied, [7, 8, 9, 10, 11, 12], "the v6→v7→v8→v9→v10→v11→v12 stamp-only/seed-only chain must run when on-disk version is six behind CURRENT");
  assert.equal(result.payload.schema_version, 12, "schema_version bumped to CURRENT (12)");
  assert.deepEqual(result.payload.external_refs, [{ ref: "JIRA-1", state: "unresolved" }], "external_refs survives the v6→v7→v8→v9→v10→v11→v12 chain verbatim");
  assert.equal(result.payload.next_role, undefined, "v6→v7 seeds no next_role default (DR-1)");
  assert.equal(result.payload.resume_of, undefined, "v6→v7 seeds no resume_of default (DR-1)");
  assert.equal(result.payload.review_verdict, undefined, "v6→v7 seeds no review_verdict default (DR-1)");
  assert.equal(result.payload.dispatch_pins, undefined, "v7→v8 seeds no dispatch_pins default (c14-dispatch-pins AC-1)");
  assert.equal(result.payload.hop_count, 0, "v8→v9 seeds hop_count: 0 (d2-server-brake-accounting DR-3)");
  assert.equal(result.payload.dispatched_at, undefined, "v9→v10 seeds no dispatched_at default (d5-server-side-stale-dispatch-detection DR-7)");
  assert.equal(result.payload.dispatch_mode, undefined, "v10→v11 seeds no dispatch_mode default (e2-bugfix-repro-gate — absence-is-signal)");
  assert.equal(result.payload.qa_rounds_total, 0, "v11→v12 seeds qa_rounds_total: 0 (e8-success-telemetry — the counter precedent)");
  assert.equal(result.payload.review_rounds_total, 0, "v11→v12 seeds review_rounds_total: 0 (e8-success-telemetry)");
  assert.equal(result.payload.visual_rounds_total, 0, "v11→v12 seeds visual_rounds_total: 0 (e8-success-telemetry)");
});

test("AC-1/C9: round-trip — re-running runMigrations on the now-v10 payload is a no-op (applied === [])", async () => {
  // Why: T-C9-07 fixture #3 — the runner's own no-op contract (schema/versions.ts
  // `current === target` short-circuit). A stale v6 handoff healed once must not
  // be re-migrated on a second pass (e.g. two concurrent reads racing the healing
  // write-back, or a plain re-read of an already-current file).
  // e8-success-telemetry re-baseline: CURRENT is now 12, so the first pass
  // climbs v6→v7→v8→v9→v10→v11→v12.
  const { runMigrations } = await import("../dist/schema/versions.js");
  const v6Payload = {
    schema_version: 6,
    active_feature: "round-trip-v6",
    status: "In_Progress",
    last_agent: "pm",
  };
  const healed = runMigrations("handoff", v6Payload);
  assert.deepEqual(healed.applied, [7, 8, 9, 10, 11, 12], "first pass heals v6 to CURRENT (v12)");
  const reread = runMigrations("handoff", healed.payload);
  assert.deepEqual(reread.applied, [], "second pass against the now-current payload applies nothing");
  assert.equal(reread.payload, healed.payload, "no-op path returns the same reference");
});

test("AC-9/C9: v6 handoff (legacy next_role/resume_of/review tokens in pending_notes) migrates to v7 on read — fields stay undefined, pending_notes byte-verbatim, other fields preserved", () => {
  // Why: T-C9-07 fixture #1 — DR-2's "inert" contract. A pre-ship v6 file whose
  // pending_notes still carries the OLD string-convention tokens must climb to
  // v7 WITHOUT any semantic extraction into the new structured fields — absence
  // stays absence, and pending_notes is left byte-verbatim (AC-9).
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 6
active_feature: "legacy-v6-feat"
status: "In_Progress"
last_updated: "2026-07-05T00:00:00.000Z"
last_agent: "pm"
qa_round: 1
review_round: 2
visual_round: 0
external_refs:
  - ref: "JIRA-9"
    state: "user-confirmed-ignorable"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: sr-engineer
- resume_of: qa-engineer
- review: APPROVED
`,
  );

  const state = parseHandoff(ws);
  // No-seed / inert (AC-9, DR-2): the v6→v7 migration adds NO structured field
  // defaults, even though pending_notes contains the OLD string tokens it replaces.
  assert.equal(state.next_role, undefined, "v6→v7 must NOT extract next_role out of legacy pending_notes prose");
  assert.equal(state.resume_of, undefined, "v6→v7 must NOT extract resume_of out of legacy pending_notes prose");
  assert.equal(state.review_verdict, undefined, "v6→v7 must NOT extract review_verdict out of legacy pending_notes prose");
  // pending_notes left byte-verbatim — no semantic extraction (AC-9).
  assert.deepEqual(
    state.pending_notes,
    ["next_role: sr-engineer", "resume_of: qa-engineer", "review: APPROVED"],
    "legacy pending_notes tokens survive the migration verbatim",
  );
  // Pre-existing fields (including the sibling v6 external_refs ledger) preserved.
  assert.equal(state.active_feature, "legacy-v6-feat");
  assert.equal(state.qa_round, 1, "qa_round preserved across v6→v7");
  assert.equal(state.review_round, 2, "review_round preserved across v6→v7");
  assert.deepEqual(
    state.external_refs,
    [{ ref: "JIRA-9", state: "user-confirmed-ignorable" }],
    "external_refs (sibling v6 field) preserved across v6→v7",
  );
});

test("AC-7/B8: v4 file (pre-dates BOTH cut_approved and external_refs) climbs v4→v5→v6 with neither attestation seeded", () => {
  // Why: the full-chain regression — a v4 file (server-scope-decision-gate era)
  // must climb two additive stamp-only steps and land with BOTH newer attestation
  // fields absent, not just the most recent one. Guards against a future step
  // accidentally seeding a default for either field.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 4
active_feature: "double-legacy"
status: "In_Progress"
last_updated: "2026-06-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 0
review_round: 0
visual_round: 0
scope_decision: "single-feature"
---
## ✅ Completed
- 無

## ⚠️ Pending & Handoff Notes
- next_role: architect
`,
  );

  const state = parseHandoff(ws);
  assert.equal(state.scope_decision, "single-feature", "v4-era scope_decision survives the double climb");
  assert.equal(state.cut_approved, undefined, "v4→v5 step still seeds nothing for cut_approved");
  assert.equal(state.external_refs, undefined, "v5→v6 step still seeds nothing for external_refs");
});
