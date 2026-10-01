// Coded by @qa-engineer
// Shared deterministic-stamp helpers for seed-then-write tests (docs/backlog.md row E148).
// gates/stamp-provenance.ts arms STAMP_PROVENANCE_SUSPECT when the on-disk `last_updated`
// matches HAND_AUTHORED_STAMP_RE; a wall-clock seed hits that shape in ~1/60000 of runs.
// These helpers force the stamp at the test layer only (the gate is untouched). Callers MUST
// markStateRead AFTER forceSeedStamp, or verifyFreshness rejects the write as stale.
// Rationale: specs/e260f-comment-rationale.md (test/e148-seed-stamp.mjs).

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

// Route through the lane-aware resolver instead of
// restating the flat `.current/handoff.md` path — these fixture workspaces
// carry no `.git`, so resolveCurrentLane resolves them to PRIMARY_LANE
// (`_primary`), matching exactly what the production write path under test
// now resolves to (e123b9 J2, spec AC1/AC9).
function handoffPath(workspacePath) {
  return resolveCurrentLanePaths(workspacePath).handoffPath;
}

/**
 * Rewrite the on-disk handoff.md `last_updated` frontmatter field in place to `stamp`
 * (default SAFE_SEED_STAMP). Call AFTER the seed write and BEFORE the next
 * markStateRead(ws) that re-snapshots freshness (the hop-count-transitions
 * backdateLastUpdated() convention). Throws if no `last_updated` line is found: a workspace
 * with no seeded handoff.md is a test-author mistake, not a case to no-op through.
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
 * Same as forceSeedStamp, but a silent no-op when handoff.md does not exist yet (a
 * first-ever write has no prevState and is never gated). For use inside a shared
 * dispatch()-style wrapper that re-snapshots freshness (resetSession + markStateRead) on
 * every call and both seeds and drives the write(s) under test, so the hazard is closed at
 * every step of a multi-call chain.
 */
export function forceSeedStampIfExists(workspacePath, stamp = SAFE_SEED_STAMP) {
  if (!fs.existsSync(handoffPath(workspacePath))) return;
  forceSeedStamp(workspacePath, stamp);
}

/**
 * A "now, but never suspect" stamp: wall-clock time with milliseconds forced away from 0.
 * Use where the seed must be fresh relative to Date.now() (feature-lease TTL math,
 * staleness checks) so a fixed stamp like SAFE_SEED_STAMP would break the test.
 * Deterministically escapes HAND_AUTHORED_STAMP_RE, which requires ms === "000".
 */
export function freshNonSuspectStamp() {
  return nonSuspectStampAt(0);
}

/**
 * freshNonSuspectStamp at an arbitrary offset from now (milliseconds; negative = past).
 * Replaces a hand-rolled `new Date(Date.now() - minutesAgo * 60_000).toISOString()`
 * backdate, which keeps real ms entropy and so is itself exposed to the E148 hazard.
 * Deterministically escapes HAND_AUTHORED_STAMP_RE (ms forced !== 0) and keeps the
 * requested age intact to the second.
 */
export function nonSuspectStampAt(offsetMs) {
  const d = new Date(Date.now() + offsetMs);
  if (d.getUTCMilliseconds() === 0) {
    d.setUTCMilliseconds(1);
  }
  return d.toISOString();
}
