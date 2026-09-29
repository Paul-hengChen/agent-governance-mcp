// Coded by @qa-engineer
// Shared deterministic-stamp helpers for seed-then-write tests (backlog
// docs/backlog.md row E148 / order row 0t6, T-E148-01).
//
// THE HAZARD: gates/stamp-provenance.ts arms STAMP_PROVENANCE_SUSPECT when
// the ON-DISK handoff `last_updated` (from a PRIOR accepted write) matches
// HAND_AUTHORED_STAMP_RE = /T\d{2}:\d{2}:00\.000Z$/ — seconds "00" AND
// milliseconds ".000". Only the milliseconds term is load-bearing for
// escaping the match: if ms !== "000" the regex can never match, regardless
// of the seconds value. A test that seeds a workspace via writeHandoffState()
// (or backdates last_updated via a raw fs edit) lets the real wall clock
// decide that stamp's shape; ~1/60000 of the time (1/60 seconds land on "00"
// AND 1/1000 milliseconds land on ".000") it lands on the suspect shape and
// the following gated write (handleUpdateState /
// TOOL_REGISTRY "tw_update_state".run) is rejected with the refusal
// envelope instead of producing the outcome the test expects. Measured live:
// v3.112.0 release CI run 35308236600, 2097/2100, green on re-run with no
// code change (test/e28-shrink-warning.test.mjs:232, J1).
//
// gates/stamp-provenance.ts is CORRECT and is NOT modified by this ticket
// (E148 hard constraint #1: the gate stays unmodified) — the regex's premise ("overwhelmingly unlikely")
// is true, just not zero, and a test suite that seeds its own fixtures from
// the wall clock should not rely on "unlikely". This module removes the
// wall-clock dependency at the TEST layer only: after seeding, force the
// on-disk last_updated to a value the test controls, exactly the way
// test/hop-count-transitions.test.mjs's pre-existing backdateLastUpdated()
// helper already forces last_updated for lease-TTL purposes (same technique,
// generalized and centralized so 20+ local reimplementations don't diverge).
//
// Also NOT a production-code change (E148 hard constraint #2: production
// code stays untouched): no argument is
// added to tools/handoff-write.ts's writeHandoffState — that function still
// only ever stamps new Date().toISOString() (or preserves verbatim under
// bookkeeping_write). This module edits the on-disk fixture file directly,
// exactly like a human/process hand-editing handoff.md between two tool
// calls — which is precisely the scenario STAMP_PROVENANCE_SUSPECT exists to
// catch, so callers MUST re-snapshot freshness (markStateRead) AFTER calling
// forceSeedStamp, never before, or the next gated write's freshness check
// (guards/session.ts verifyFreshness, mtime-based, independent of this gate)
// will reject the write as stale.

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveCurrentLanePaths } from "../dist/tools/lane-paths.js";

const LAST_UPDATED_LINE_RE = /^last_updated:\s*"[^"]*"$/m;

/**
 * A fixed ISO-8601 stamp that can NEVER match HAND_AUTHORED_STAMP_RE
 * (milliseconds ".123", never ".000"). Use for seeds whose absolute time
 * doesn't matter to the test (the overwhelming majority of seed-then-write
 * fixtures — they only need SOME valid millisecond-entropy-shaped stamp on
 * disk before the write under test runs).
 */
export const SAFE_SEED_STAMP = "2026-01-01T00:00:00.123Z";

/**
 * A fixed stamp that DOES match HAND_AUTHORED_STAMP_RE. Exported so tests
 * whose subject IS the gate/advisory (test/drift-stamp-advisory.test.mjs,
 * test/e18-write-provenance.test.mjs, test/e148-stamp-provenance-seed.test.mjs)
 * share one literal instead of each hand-rolling it — those tests seed this
 * ON PURPOSE and must NOT be "fixed" by forceSeedStamp.
 */
export const SUSPECT_SEED_STAMP = "2026-01-01T00:00:00.000Z";

// e123b9 J2 (spec AC1/AC9): route through the lane-aware resolver instead of
// restating the flat `.current/handoff.md` path — these fixture workspaces
// carry no `.git`, so resolveCurrentLane resolves them to PRIMARY_LANE
// (`_primary`), matching exactly what the production write path under test
// now resolves to.
function handoffPath(workspacePath) {
  return resolveCurrentLanePaths(workspacePath).handoffPath;
}

/**
 * Rewrite the on-disk handoff.md's `last_updated` frontmatter field in place
 * to `stamp` (default SAFE_SEED_STAMP). Call AFTER the seed write (whichever
 * write leaves the workspace in the state the write-under-test will read as
 * `prevState`) and BEFORE the next markStateRead(ws) call that re-snapshots
 * freshness for that write — mirroring test/hop-count-transitions.test.mjs's
 * pre-existing backdateLastUpdated() convention.
 *
 * Throws loudly if no `last_updated` frontmatter line is found (a workspace
 * this helper is pointed at with no seeded handoff.md yet is a test-author
 * mistake, not a case to silently no-op through).
 */
export function forceSeedStamp(workspacePath, stamp = SAFE_SEED_STAMP) {
  const p = handoffPath(workspacePath);
  const raw = fs.readFileSync(p, "utf8");
  if (!LAST_UPDATED_LINE_RE.test(raw)) {
    throw new Error(`forceSeedStamp: no last_updated frontmatter line found in ${p}`);
  }
  const next = raw.replace(LAST_UPDATED_LINE_RE, `last_updated: "${stamp}"`);
  fs.writeFileSync(p, next, "utf8");
}

/**
 * Same as forceSeedStamp, but a silent no-op when handoff.md doesn't exist
 * yet (a brand-new workspace's first-ever write has no prevState and is
 * never gated — STAMP_PROVENANCE_SUSPECT is inert there by construction, so
 * there is nothing to force). Intended for use INSIDE a shared
 * dispatch()-style wrapper that re-snapshots freshness (resetSession +
 * markStateRead) on every call and is used BOTH to seed a workspace AND to
 * drive the write(s) under test — this closes the hazard not just at the
 * initial seed but at every intermediate step of a multi-call chain in one
 * place, since each call's own accepted write becomes the next call's
 * prevState.
 */
export function forceSeedStampIfExists(workspacePath, stamp = SAFE_SEED_STAMP) {
  if (!fs.existsSync(handoffPath(workspacePath))) return;
  forceSeedStamp(workspacePath, stamp);
}

/**
 * A "now, but never suspect" stamp: the real wall-clock time with
 * milliseconds forced away from 0 whenever they land there. Use where a
 * test's semantics depend on the seed being FRESH relative to Date.now()
 * (e.g. feature-lease TTL math, staleness/dispatch-age checks) so an
 * absolute fixed stamp like SAFE_SEED_STAMP (dated 2026-01-01) would break
 * the test, but the specific millisecond doesn't matter. Deterministically
 * escapes HAND_AUTHORED_STAMP_RE (ms is forced !== 0, and the regex requires
 * ms === "000"), not just probabilistically — the seconds component is left
 * as real wall-clock time since it's not part of what makes the shape
 * "suspect" once ms doesn't match.
 */
export function freshNonSuspectStamp() {
  return nonSuspectStampAt(0);
}

/**
 * Generalizes freshNonSuspectStamp to an arbitrary offset from now (in
 * milliseconds; negative = in the past). Use this to replace a hand-rolled
 * `new Date(Date.now() - minutesAgo * 60_000).toISOString()` backdate
 * (test/hop-count-transitions.test.mjs's and test/feature-lease.test.mjs's
 * pre-existing backdateLastUpdated() convention) — that computation carries
 * the SAME real millisecond entropy as any other now()-derived stamp (only
 * the minute/hour component shifts; seconds/ms pass through unchanged), so
 * it is independently susceptible to the hand-authored-stamp hazard
 * described at the top of this file (E148), not just the plain
 * seed-then-write shape. Deterministically escapes HAND_AUTHORED_STAMP_RE
 * (ms forced !== 0) while leaving the requested age intact to the second.
 */
export function nonSuspectStampAt(offsetMs) {
  const d = new Date(Date.now() + offsetMs);
  if (d.getUTCMilliseconds() === 0) {
    d.setUTCMilliseconds(1);
  }
  return d.toISOString();
}
