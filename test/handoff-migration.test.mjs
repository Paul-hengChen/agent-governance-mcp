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

test("AC-7: scope_decision round-trips through writeHandoffState → readback (v6 stamp)", async () => {
  // Why: the modern options-object write must emit scope_decision into YAML and
  // parse it back identically, stamped at v6 (b8-external-ref-ledger re-baseline;
  // was v5/pm-cut-approval-gate). This is the PM attestation write path.
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
  assert.match(raw, /schema_version:\s*6/, "write stamps current handoff schema v6");
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

test("AC-10(g): future v7 handoff refuses-loud against a v6 server (no silent downgrade)", () => {
  // Why: forward-compat safety. A handoff written by a newer server (v7) must
  // NOT be silently parsed by this v6 server — runMigrations throws because
  // on-disk version > server max. No new code; this pins the behavior for the
  // b8-external-ref-ledger version bump specifically (v5→v6; was v4→v5 under
  // pm-cut-approval-gate). A hypothetical v7 file must still refuse-loud
  // against the current v6 server.
  const ws = mkWorkspace();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 7
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
    /on-disk version 7 > server max 6/,
    "v7 file must refuse-loud against a v6 server",
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

test("AC-8/B8: v5→v6 migration step is pure and idempotent — re-running runMigrations on an already-v6 payload is a no-op", async () => {
  // Why: AC-8 losslessness plus the runner's own no-op contract (schema/versions.ts
  // `current === target` short-circuit) — running the migration pipeline twice
  // against the same payload (e.g. two concurrent reads racing the healing
  // write-back) must never double-apply the v5→v6 step or mutate an already-
  // current payload.
  const { runMigrations } = await import("../dist/schema/versions.js");
  const v6Payload = {
    schema_version: 6,
    active_feature: "already-v6",
    status: "In_Progress",
    last_agent: "pm",
    external_refs: [{ ref: "JIRA-1", state: "unresolved" }],
  };
  const result = runMigrations("handoff", v6Payload);
  assert.deepEqual(result.applied, [], "no migration step should run when on-disk version === CURRENT");
  assert.equal(result.payload, v6Payload, "no-op path returns the input payload untouched (same reference)");
  assert.deepEqual(result.payload.external_refs, [{ ref: "JIRA-1", state: "unresolved" }], "external_refs survives the no-op path verbatim");
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
