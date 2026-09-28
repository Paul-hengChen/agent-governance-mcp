// Coded by @qa-engineer
// Tests for spec: specs/d5-server-side-stale-dispatch-detection.md (AC-1..AC-9)
// + specs/d5-server-side-stale-dispatch-detection-architecture.md (DR-1..DR-8).
// T-D5-05 — qa-owned test deliverable per the architecture's Test Plan.
//
// Spec-to-Test map:
//   AC-1 (stamp persisted on dispatch, server-not-memory)      -> T1, T1b
//   AC-2 (staleness surfaced on read, not enforced on write)   -> T4, T4b, T5, T6
//   AC-3 (stamp clears/replaces on the dispatched role's write)-> T3
//   AC-4 (detection works from a completely fresh context)     -> T4 (parseHandoff
//                                                                  in-memory has
//                                                                  no bearing on
//                                                                  the read — the
//                                                                  signal is
//                                                                  derived purely
//                                                                  from the raw
//                                                                  hand-written
//                                                                  fixture + wall
//                                                                  clock, never
//                                                                  from any prior
//                                                                  write this
//                                                                  process made)
//   AC-5 (no false positive within the threshold window)       -> T5, T5b (exact
//                                                                  boundary)
//   AC-6 (feature-scoped: no stale-dispatch bleed)              -> T7
//   AC-8 (existing next_role/hop_count/round-cap/dispatch_pins/
//         cut_approved/external_refs semantics byte-identical) -> T10 (full-suite
//         cross-reference; every sibling *.test.mjs file in this repo continues
//         to assert its own contract unmodified — see the note on T10 below)
//   AC-9 / DR-5 (SQLite scope explicit + tested, file-mode-only) -> T9
//   AC-10 / DR-7 (v9→v10 migration, stamp-only, seeds nothing)   -> T8
//
// WHY: D5's entire mechanism is "coordinator-memory bookkeeping made durable."
// The tests below deliberately never rely on in-process memory of a prior write
// to prove the staleness signal — T4/T4b hand-write the fixture with `fs`
// directly (no writeHandoffState call precedes the read), modeling the "fresh
// coordinator session, post-compaction, no transcript" scenario AC-4 requires.
//
// E97 addendum (T-E97-01, single-owner extraction): gates/feature-lease.ts's
// inlined E1A/E13 terminal-marker condition is now an exported predicate,
// `isReleaseClosingWrite`, with exactly two call sites — isFeatureLeaseHeld
// (pinned end-to-end at the lease layer by test/feature-lease.test.mjs,
// including the opening-write non-regression case at its own E13-AC3) and
// the stale-dispatch advisory guard below at tools/handoff-parse.ts:503,
// which is THIS file's layer. The E97-A* tests pin the exported predicate
// directly (both disjuncts, plus the opening-write and ordinary-dispatch
// negatives) so a future edit to the shared function is caught from BOTH
// consumers, not just one — re-arming exactly the single-owner guarantee
// E97 exists to hold. The E97-B* tests pin the same shapes end-to-end
// through readHandoffState, proving the wiring at handoff-parse.ts's guard
// site, not just the predicate in isolation.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  parseHandoff,
  readHandoffState,
  writeHandoffState,
} from "../dist/tools/handoff.js";
import { resetSession, markStateRead } from "../dist/guards/session.js";
import { CURRENT_VERSIONS } from "../dist/schema/versions.js";
import { isReleaseClosingWrite } from "../dist/gates/feature-lease.js";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

// SQLite storage relies on `better-sqlite3`, an optionalDependency. Skip T9
// gracefully (same guard as test/dispatch-pins.test.mjs S1) if absent.
let SqliteHandoffStorage;
try {
  const mod = await import("../dist/tools/storage-sqlite.js");
  SqliteHandoffStorage = mod.SqliteHandoffStorage;
} catch {
  // eslint-disable-next-line no-console
  console.log("[skip] better-sqlite3 not installed — T9 SQLite-scope test skipped");
}

// ---- helpers ---------------------------------------------------------------

function mkWs() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "agc-sdd-"));
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  return ws;
}

function writeRaw(ws, body) {
  fs.writeFileSync(path.join(ws, ".current", "handoff.md"), body, "utf-8");
}

function readRaw(ws) {
  return fs.readFileSync(resolveCurrentLanePaths(ws).handoffPath, "utf-8");
}

function isoMinutesAgo(n) {
  return new Date(Date.now() - n * 60000).toISOString();
}

// ============================================================================
// AC-1: dispatch stamp is persisted, server-derived, not coordinator memory
// ============================================================================

test("T1: a write that sets next_role stamps dispatched_at === last_updated (AC-1)", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "dispatch-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "code-reviewer",
    nextRole: "qa-engineer",
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.next_role, "qa-engineer", "next_role must be set (test precondition)");
  assert.ok(state.dispatched_at, "dispatched_at must be stamped when next_role is set");
  assert.equal(
    state.dispatched_at,
    state.last_updated,
    "dispatched_at must equal last_updated — both derive from the SAME now() at write time",
  );
});

test("T1b: a write that omits next_role stamps NO dispatched_at (no dispatch in flight)", async () => {
  const ws = mkWs();
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "no-dispatch-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: ["pm: scoping"],
    lastAgent: "pm",
    // nextRole intentionally omitted
  });
  resetSession();
  const state = parseHandoff(ws);
  assert.equal(state.next_role, undefined, "test precondition: no next_role set");
  assert.equal(state.dispatched_at, undefined, "dispatched_at must be absent when no dispatch is in flight");
});

// ============================================================================
// AC-3: stamp clears (or is replaced) when the dispatched role writes back
// ============================================================================

test("T3: the dispatched role's own write clears dispatched_at (omits next_role) or re-stamps it (sets a new next_role)", async () => {
  const ws = mkWs();
  // Step 1: dispatch qa-engineer.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "handoff-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "code-reviewer",
    nextRole: "qa-engineer",
  });
  resetSession();
  const afterDispatch = parseHandoff(ws);
  assert.ok(afterDispatch.dispatched_at, "precondition: stamp present after dispatch");
  const firstStamp = afterDispatch.dispatched_at;

  // Step 2: qa-engineer writes back WITHOUT nominating a next_role (chain ends).
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "handoff-feat",
    status: "PASS",
    completedTasks: ["T-1"],
    pendingNotes: ["QA: PASS"],
    lastAgent: "qa-engineer",
    // nextRole intentionally omitted — release is a human decision
  });
  resetSession();
  const afterOmit = parseHandoff(ws);
  assert.equal(afterOmit.next_role, undefined, "next_role must be gone");
  assert.equal(afterOmit.dispatched_at, undefined, "dispatched_at must be dropped when the write omits next_role (AC-3)");

  // Step 3: a later write re-dispatches — the stamp must refresh, not reuse the old value.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "handoff-feat",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
    nextRole: "sr-engineer",
  });
  resetSession();
  const afterRedispatch = parseHandoff(ws);
  assert.equal(afterRedispatch.next_role, "sr-engineer", "the new dispatch target must be recorded");
  assert.ok(afterRedispatch.dispatched_at, "dispatched_at must be re-stamped on the new dispatch");
  assert.notEqual(
    afterRedispatch.dispatched_at,
    firstStamp,
    "the re-stamp must be a fresh now(), not the stale first dispatch's timestamp",
  );
});

// ============================================================================
// AC-2 / AC-4: staleness surfaced on tw_get_state read, correct from a
// completely fresh context (no writeHandoffState call precedes the read —
// the fixture is hand-written with `fs` directly, modeling a fresh/
// post-compaction session with zero in-process memory of any dispatch).
// ============================================================================

test("T4: a next_role stamped >15 min ago surfaces stale_dispatch with the verbatim message and exact shape (AC-2, AC-4)", () => {
  const ws = mkWs();
  resetSession();
  const staleStamp = isoMinutesAgo(16);
  writeRaw(
    ws,
    `---
schema_version: 10
active_feature: "stale-feat"
status: "In_Progress"
last_updated: "${staleStamp}"
last_agent: "coordinator"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "sr-engineer"
dispatched_at: "${staleStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- coordinator: dispatching sr-engineer now
`,
  );
  const parsed = JSON.parse(readHandoffState(ws));
  assert.ok(parsed.stale_dispatch, "stale_dispatch advisory must be present for a >15min-old stamp");
  assert.equal(parsed.stale_dispatch.role, "sr-engineer", "role must equal the stamped next_role");
  assert.equal(parsed.stale_dispatch.dispatched_at, staleStamp, "dispatched_at must echo the persisted stamp verbatim");
  assert.equal(parsed.stale_dispatch.threshold_minutes, 15, "threshold_minutes must be the fixed constant (15)");
  assert.ok(parsed.stale_dispatch.elapsed_minutes >= 16, "elapsed_minutes must reflect the actual elapsed time (floored)");
  assert.equal(
    parsed.stale_dispatch.message,
    // e29-crash-resume-pointer (qa-owned re-pin, T-E29-01, e-p3-tail-batch): the
    // base Copy/Strings row sentence is now followed by the Crash-Resume
    // pointer sentence (tools/handoff.ts, appended to the SAME message field
    // the E22 watch-file emit shares — no new advisory key).
    "stale in-flight dispatch: sr-engineer, no state write for >15 min. " +
      "Crash-Resume: ground-truth before re-dispatch — compare git status/diff " +
      "against handoff claims, honor dispatch_pins, then resume the incumbent " +
      "role (never blind re-dispatch); full protocol: skill-coordinator " +
      "Crash-Resume Protocol.",
    "message must be verbatim to the spec's Copy/Strings row (stale_dispatch.message) plus the E29 Crash-Resume pointer",
  );
});

test("T4b: the same signal fires identically whether the reading session has any prior memory of this workspace or not (AC-4, correct-by-construction)", () => {
  // WHY: AC-4's actual claim isn't "the code path is X" — it's that TWO
  // independent readers (a continuing session that dispatched moments ago and
  // is now stale, vs. a session that has NEVER called tw_get_state on this
  // workspace before) get byte-identical advisories, because the computation
  // is a pure function of (next_role, dispatched_at, Date.now()) with no
  // process-local cache or memoization. We simulate "no memory" by using a
  // workspace this test process has never touched, and compare its output
  // shape against T4's — same fields, same derivation, no special-cased path.
  const ws = mkWs();
  const staleStamp = isoMinutesAgo(20);
  writeRaw(
    ws,
    `---
schema_version: 10
active_feature: "fresh-context-feat"
status: "In_Progress"
last_updated: "${staleStamp}"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "architect"
dispatched_at: "${staleStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  // No parseHandoff/writeHandoffState/resetSession call precedes this read —
  // markStateRead only happens INSIDE readHandoffState itself, so this is the
  // very first touch of this workspace by this process, modeling a fresh
  // coordinator session with zero transcript/memory.
  const parsed = JSON.parse(readHandoffState(ws));
  assert.ok(parsed.stale_dispatch, "a completely untouched workspace must still surface the advisory");
  assert.equal(parsed.stale_dispatch.role, "architect");
  assert.equal(
    parsed.stale_dispatch.message,
    // e29-crash-resume-pointer (qa-owned re-pin, T-E29-01, e-p3-tail-batch): same
    // verbatim message as T4 above (role name swapped) — proves the Crash-Resume
    // pointer is a pure function of (next_role, dispatched_at, now), not
    // process-local state.
    "stale in-flight dispatch: architect, no state write for >15 min. " +
      "Crash-Resume: ground-truth before re-dispatch — compare git status/diff " +
      "against handoff claims, honor dispatch_pins, then resume the incumbent " +
      "role (never blind re-dispatch); full protocol: skill-coordinator " +
      "Crash-Resume Protocol.",
  );
});

// ============================================================================
// AC-5: no false positive within the threshold window (including the exact
// boundary — the compare is strictly ">", not ">=")
// ============================================================================

test("T5: a next_role stamped 5 min ago (well within the window) surfaces NO stale_dispatch (AC-5)", () => {
  const ws = mkWs();
  resetSession();
  const freshStamp = isoMinutesAgo(5);
  writeRaw(
    ws,
    `---
schema_version: 10
active_feature: "fresh-dispatch-feat"
status: "In_Progress"
last_updated: "${freshStamp}"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "qa-engineer"
dispatched_at: "${freshStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.stale_dispatch, undefined, "a role still legitimately within the window must not be flagged as dead");
});

test("T5b: a next_role stamped EXACTLY 15 min ago surfaces NO stale_dispatch (strict > threshold, not >=)", () => {
  const ws = mkWs();
  resetSession();
  // Slightly under 15.0 min to avoid a flaky sub-millisecond race with the
  // strict `elapsedMin > 15` boundary — this pins the "strictly greater than"
  // semantics without depending on exact-to-the-millisecond timing.
  const boundaryStamp = new Date(Date.now() - (15 * 60000 - 2000)).toISOString();
  writeRaw(
    ws,
    `---
schema_version: 10
active_feature: "boundary-feat"
status: "In_Progress"
last_updated: "${boundaryStamp}"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "pm"
dispatched_at: "${boundaryStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.stale_dispatch, undefined, "a stamp at/just under the 15-minute threshold must not fire (strict >, AC-5)");
});

// ============================================================================
// AC-2 (defensive computation): a malformed stamp is inert — never throws,
// never surfaces a signal
// ============================================================================

test("T6: a malformed dispatched_at value is inert — no throw, no stale_dispatch signal", () => {
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 10
active_feature: "malformed-stamp-feat"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "sr-engineer"
dispatched_at: "not-a-date"
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  let parsed;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(readHandoffState(ws));
  }, "an unparsable dispatched_at must never make tw_get_state throw");
  assert.equal(parsed.stale_dispatch, undefined, "an unparsable stamp must not be treated as stale (Number.isFinite guard)");
  assert.equal(parsed.exists, true, "the rest of the read must proceed normally");
});

// ============================================================================
// AC-6: feature-scoped — no stale-dispatch bleed across an active_feature
// change (a fortiori: dispatched_at is every-write-scoped transient, DR-3 —
// strictly stronger than dispatch_pins/external_refs' feature-scoped carry)
// ============================================================================

test("T7: active_feature change drops dispatched_at even though next_role was just stamped on feature A (AC-6)", async () => {
  const ws = mkWs();
  // Dispatch on feature-a.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feature-a",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "coordinator",
    nextRole: "sr-engineer",
  });
  resetSession();
  const onFeatureA = parseHandoff(ws);
  assert.ok(onFeatureA.dispatched_at, "precondition: stamp present on feature-a");

  // A write on a DIFFERENT feature that omits next_role.
  resetSession();
  markStateRead(ws);
  await writeHandoffState({
    workspacePath: ws,
    activeFeature: "feature-b",
    status: "In_Progress",
    completedTasks: [],
    pendingNotes: [],
    lastAgent: "pm",
  });
  resetSession();
  const onFeatureB = parseHandoff(ws);
  assert.equal(onFeatureB.next_role, undefined, "next_role must not bleed across the feature change");
  assert.equal(onFeatureB.dispatched_at, undefined, "a stale dispatch stamp from feature-a must never leak into feature-b");

  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(parsed.stale_dispatch, undefined, "no stale_dispatch advisory must surface once the feature has changed");
});

// ============================================================================
// AC-10 / DR-7: v9→v10 migration is stamp-only, seeds nothing; forward-compat
// refuse-loud for a hypothetical v11 file
// ============================================================================

test("T8: a v9 handoff (no dispatched_at) migrates to v10 on read — field stays undefined, hop_count/sibling fields preserved (DR-7)", async () => {
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 9
active_feature: "legacy-v9-feat"
status: "In_Progress"
last_updated: "2026-07-01T00:00:00.000Z"
last_agent: "pm"
qa_round: 1
review_round: 0
visual_round: 0
hop_count: 3
next_role: "sr-engineer"
---
## Completed
- (none)

## Pending & Handoff Notes
- next_role: sr-engineer
`,
  );
  const state = parseHandoff(ws);
  assert.equal(state.dispatched_at, undefined, "v9→v10 must NOT seed dispatched_at (absence-is-signal, not hop_count's seed-0, DR-7)");
  assert.equal(state.dispatch_mode, undefined, "v10→v11 must NOT seed dispatch_mode (absence-is-signal, e2-bugfix-repro-gate)");
  // Sibling fields survive the migration untouched (lossless).
  assert.equal(state.active_feature, "legacy-v9-feat");
  assert.equal(state.hop_count, 3, "hop_count preserved across v9→v10→v11→v12");
  assert.equal(state.next_role, "sr-engineer", "sibling v7 field preserved across v9→v10→v11→v12");
  // e8-success-telemetry re-baseline: the file also climbs v11→v12, seeding
  // the three new cumulative totals to 0 (the hop_count counter precedent).
  assert.equal(state.qa_rounds_total, 0, "v11→v12 seeds qa_rounds_total: 0 (e8-success-telemetry)");
  assert.equal(state.review_rounds_total, 0, "v11→v12 seeds review_rounds_total: 0 (e8-success-telemetry)");
  assert.equal(state.visual_rounds_total, 0, "v11→v12 seeds visual_rounds_total: 0 (e8-success-telemetry)");
  // e23-evidence-schema-versioning re-baseline: the file also climbs v12→v13,
  // seeding NO evidence_schema default (D1 — absence-is-signal, migration
  // invents no pin).
  assert.equal(state.evidence_schema, undefined, "v12→v13 must NOT seed evidence_schema (absence-is-signal, e23-evidence-schema-versioning D1)");
  // e114-cut-approval-inheritance re-baseline: the file also climbs v13→v14,
  // seeding NO cut_approved_source default (absence-is-signal, migration
  // invents no claim).
  assert.equal(state.cut_approved_source, undefined, "v13→v14 must NOT seed cut_approved_source (absence-is-signal, e114-cut-approval-inheritance)");
  // e123a-lane-layout-migration re-baseline: the file also climbs v14→v15,
  // seeding NO dispatch_mechanism/dispatch_mechanism_tier default
  // (absence-is-signal, migration invents no attestation).
  assert.equal(state.dispatch_mechanism, undefined, "v14→v15 must NOT seed dispatch_mechanism (absence-is-signal, e123a-lane-layout-migration)");

  // On-disk heal: readHandoffState's fire-and-forget write-back lands at v15.
  resetSession();
  readHandoffState(ws);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const healed = readRaw(ws);
  assert.match(healed, /schema_version:\s*15/, "fire-and-forget heal lands the file at CURRENT (v15)");

  // Re-running the migration on the now-current payload is a no-op — the file
  // stays at CURRENT and no further heal-write fires.
  resetSession();
  parseHandoff(ws);
  assert.match(readRaw(ws), /schema_version:\s*15/, "second read stays at CURRENT, no further migration applied");
});

test("T8b: a future v16 handoff refuses-loud against this v15 server (no silent downgrade)", () => {
  // e123a-lane-layout-migration re-baseline (coupled bump, not a bare
  // constant swap): CURRENT is now 15, so "the future" this test probes must
  // move to 16 or the payload/assertion pair collapses to the incoherent
  // "16 > server max 16" — was v15-vs-v14 under e114-cut-approval-inheritance.
  const ws = mkWs();
  resetSession();
  writeRaw(
    ws,
    `---
schema_version: 16
active_feature: "from-the-future"
status: "In_Progress"
last_updated: "2099-01-01T00:00:00.000Z"
qa_round: 0
---
## Completed
- (none)

## Pending & Handoff Notes
- (none)
`,
  );
  assert.throws(
    () => readHandoffState(ws),
    /handoff on-disk version 16 > server max 15/,
    "a v16 file must refuse-loud rather than silently downgrade",
  );
});

// ============================================================================
// E97 (T-E97-01): isReleaseClosingWrite — the single-owner E1A/E13 predicate,
// pinned directly (A-series) and end-to-end through the stale-dispatch
// advisory guard it now gates (B-series).
// ============================================================================

test('E97-A1: isReleaseClosingWrite — disjunct 1 (next_role === "pm") matches regardless of pending_notes content', () => {
  assert.equal(
    isReleaseClosingWrite({
      last_agent: "release-engineer",
      status: "In_Progress",
      next_role: "pm",
      pending_notes: ["Released v3.105.0", "tag: abc123"],
    }),
    true,
    "the documented E1A closing-write triple must match disjunct 1",
  );
});

test('E97-A2: isReleaseClosingWrite — disjunct 2 (pending_notes[0] matches /^Released v/) matches even with next_role absent (the heal-write incident class E13 names)', () => {
  assert.equal(
    isReleaseClosingWrite({
      last_agent: "release-engineer",
      status: "In_Progress",
      next_role: undefined,
      pending_notes: ["Released v3.105.0", "tag: abc123"],
    }),
    true,
    "a closing write whose next_role was dropped by a migration heal-write must still match via the durable pending_notes signature (E13)",
  );
});

test('E97-A3: isReleaseClosingWrite — disjunct 2 also fires when next_role is present but not "pm" (the second E13 incident class: a stale/incorrect next_role alongside a correct closing pending_notes signature)', () => {
  assert.equal(
    isReleaseClosingWrite({
      last_agent: "release-engineer",
      status: "In_Progress",
      next_role: "sr-engineer",
      pending_notes: ["Released v3.105.0"],
    }),
    true,
    "pending_notes[0] matching /^Released v/ must satisfy the predicate independent of next_role's value — this is what makes disjunct 2 a genuine OR, not a next_role-gated variant of disjunct 1",
  );
});

test("E97-A4 (non-regression): isReleaseClosingWrite returns false for the release OPENING write — matches neither disjunct, per feature-lease's own D9/D10 non-regression clause", () => {
  // Same fixture shape as test/feature-lease.test.mjs's E13-AC3 (pending_notes
  // carries the OPENING signature, "release-engineer: starting release for
  // ...", which never begins with "Released v"; next_role absent, exactly as
  // SOP step 2's opening write leaves it) — exercised here directly against
  // the exported predicate itself, since handoff-parse.ts's advisory guard
  // and gates/feature-lease.ts's isFeatureLeaseHeld now share this one
  // function; a regression here would silently break BOTH consumers at once.
  assert.equal(
    isReleaseClosingWrite({
      last_agent: "release-engineer",
      status: "In_Progress",
      next_role: undefined,
      pending_notes: ["release-engineer: starting release for feat-x"],
    }),
    false,
    "the opening write's pending_notes never matches /^Released v/ and next_role is absent — must NOT be classified as a closing write (in-flight release stays lease-held, and stays eligible for a stale-dispatch advisory if it later stalls)",
  );
});

test("E97-A5: isReleaseClosingWrite returns false for an ordinary stale dispatch merely authored by release-engineer — last_agent alone is not sufficient", () => {
  assert.equal(
    isReleaseClosingWrite({
      last_agent: "release-engineer",
      status: "In_Progress",
      next_role: "qa-engineer",
      pending_notes: ["release-engineer: found hardcoded version literal — qa-engineer must retarget or relax it"],
    }),
    false,
    "last_agent === 'release-engineer' alone must not suppress — only the exact disjuncts (next_role==='pm', or the Released-v pending_notes signature) do",
  );
});

test('E97-B1: a stale E1A-triple closing write (next_role="pm") surfaces NO stale_dispatch key at all, at any elapsed', () => {
  const ws = mkWs();
  resetSession();
  const staleStamp = isoMinutesAgo(999); // absurdly stale — "at any elapsed" per the task row
  writeRaw(
    ws,
    `---
schema_version: 13
active_feature: "release-closing-feat"
status: "In_Progress"
last_updated: "${staleStamp}"
last_agent: "release-engineer"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "pm"
dispatched_at: "${staleStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- Released v3.105.0
- tag: abc123def
`,
  );
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(
    parsed.stale_dispatch,
    undefined,
    "the E1A closing write must never read as a stale dispatch, however much wall-clock time has passed (E97)",
  );
});

test('E97-B2: a genuine stale dispatch authored by release-engineer (next_role="qa-engineer", ordinary notes) still surfaces stale_dispatch normally — the E97 suppression is precise, not last_agent-keyed', () => {
  const ws = mkWs();
  resetSession();
  const staleStamp = isoMinutesAgo(20);
  writeRaw(
    ws,
    `---
schema_version: 13
active_feature: "release-escalation-feat"
status: "In_Progress"
last_updated: "${staleStamp}"
last_agent: "release-engineer"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "qa-engineer"
dispatched_at: "${staleStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- release-engineer: found hardcoded version literal, routing to qa-engineer
`,
  );
  const parsed = JSON.parse(readHandoffState(ws));
  assert.ok(parsed.stale_dispatch, "a real in-flight dispatch to qa-engineer must still surface the advisory even though last_agent is release-engineer");
  assert.equal(parsed.stale_dispatch.role, "qa-engineer");
});

test('E97-B3 (C2, pinned as intended): a release-engineer -> pm write that is an ESCALATION rather than the closing write also suppresses stale_dispatch and the E22 watch-file emit — accepted strict-superset consequence, not a defect', () => {
  // code-reviewer round 1 finding C2 (review_reports/review_T-E94-01.md):
  // isReleaseClosingWrite's disjunct 1 (next_role === "pm") does not inspect
  // pending_notes at all, so ANY release-engineer write that routes to pm
  // with status In_Progress matches it — including a genuine escalation
  // (e.g. an unresolved dependency-advisory STOP routed to pm) that is not
  // actually "shipped". Narrowing the predicate here would recreate the
  // two-owner divergence E97 exists to kill (the lease gate already treats
  // this exact state as lease-released), so this is intentional, not a bug —
  // this test exists to make the widening loud if it is ever narrowed back
  // (which would be its own kind of regression) rather than silent.
  const ws = mkWs();
  resetSession();
  fs.writeFileSync(
    path.join(ws, ".current", ".config.json"),
    JSON.stringify({ staleDispatchNotifyFile: ".current/stale-dispatch.notify" }),
    "utf-8",
  );
  const staleStamp = isoMinutesAgo(20);
  writeRaw(
    ws,
    `---
schema_version: 13
active_feature: "release-escalation-to-pm-feat"
status: "In_Progress"
last_updated: "${staleStamp}"
last_agent: "release-engineer"
qa_round: 0
review_round: 0
visual_round: 0
next_role: "pm"
dispatched_at: "${staleStamp}"
---
## Completed
- (none)

## Pending & Handoff Notes
- release-engineer: npm audit flagged a package with no disposition on record -- routing to pm
`,
  );
  const parsed = JSON.parse(readHandoffState(ws));
  assert.equal(
    parsed.stale_dispatch,
    undefined,
    'C2: next_role==="pm" alone suppresses, independent of pending_notes — pinned as the intended (accepted) widening',
  );
  assert.ok(
    !fs.existsSync(path.join(ws, ".current", "stale-dispatch.notify")),
    "the E22 watch-file emit is nested inside the same suppressed branch and must not fire either",
  );
});

// ============================================================================
// AC-9 / DR-5: SQLite/HTTP-mode scope is explicit — file-mode-only by
// construction, tested (not a silent gap)
// ============================================================================

const sqliteDescribe = (name, fn) =>
  SqliteHandoffStorage ? fn() : test(name + " (skipped — no better-sqlite3)", () => {});

sqliteDescribe("T9: SQLite storage never persists or surfaces dispatched_at/stale_dispatch", () => {
  test("T9: SqliteHandoffStorage.writeState(nextRole=...) does not persist dispatched_at, and readState never carries stale_dispatch (AC-9, DR-5)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-sql-"));
    const dbPath = path.join(dir, "agc.db");
    try {
      const storage = new SqliteHandoffStorage(dbPath);
      // SqliteHandoffStorage.writeState's WriteHandoffStateOptions type has no
      // nextRole field (DR-5: next_role is file-mode-only, so its companion
      // dispatched_at was never given SQLite plumbing either) — the options
      // object below is exactly what a real HTTP-mode caller would pass.
      await storage.writeState({
        workspacePath: dir,
        activeFeature: "sqlite-dispatch-feat",
        status: "In_Progress",
        completedTasks: [],
        pendingNotes: [],
        lastAgent: "coordinator",
      });
      const state = storage.parse(dir);
      assert.ok(state, "state row must exist");
      assert.equal(state.next_role, undefined, "SqliteHandoffStorage has no next_role plumbing (pre-existing DR-5 scope)");
      assert.equal(state.dispatched_at, undefined, "dispatched_at must never surface from SQLite-mode storage (file-mode only, AC-9/DR-5)");

      const parsed = JSON.parse(storage.readState(dir));
      assert.equal(parsed.stale_dispatch, undefined, "the stale_dispatch advisory must never appear in SQLite-mode tw_get_state output");
      assert.equal(parsed.active_feature, "sqlite-dispatch-feat", "other fields persist normally");
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ============================================================================
// AC-8: sanity cross-check — the version this suite targets, so a future
// bump doesn't silently make the tests above assert against the wrong CURRENT
// (the substantive AC-8 regression guard is that every *OTHER* pre-existing
// test file in this repo — dispatch-pins/handoff-versioning/handoff-migration/
// schema-versions/cut-approval-gate/context-budget/drift-skew/skill-evolution
// — continues to pass unmodified in its own semantics, re-baselined only for
// the version-number/token-floor bump, never for a behavior change).
// ============================================================================

test("T10: sanity — CURRENT_VERSIONS.handoff is 15 (e123a-lane-layout-migration)", () => {
  assert.equal(CURRENT_VERSIONS.handoff, 15);
});
