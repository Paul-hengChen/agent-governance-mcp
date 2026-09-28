// Coded by @qa-engineer
// Tests for specs/e125b-lane-close-writeback.md AC6 (T-E125B-01's new
// closed-lane history resolvers in tools/lane-paths.ts), plus the AC8/X7
// hasHistoryLedger predicate the same task registers.
//
// Spec-to-Test map:
//   AC6 (resolveHistoryBucket: UTC YYYY-MM; resolveHistoryLaneDir: throws on
//        a malformed bucket or an unsafe lane, never returns a path outside
//        .current/history/<bucket>/)                    -> BUCKET1..BUCKET3,
//                                                            HISTDIR1..HISTDIR6
//   AC8 (hasHistoryLedger: pure fs, scans every HISTORY_BUCKET_RE bucket,
//        never throws)                                   -> HASHIST1..HASHIST7
//
// This file is scoped to the pure/read-only resolvers themselves — the
// fixture-driven proof that `agc feature finish --shipped` actually WRITES
// into `.current/history/<bucket>/<lane>/` lives in
// test/agc-feature-finish-history.test.mjs (AC1/AC9), and X7's read/refuse
// integration through tools/tasks-file.ts's makeForeignCheck lives in
// test/e125a-lane-local-ledgers.test.mjs (the nearest e125a D12 fixture
// test, per this ticket's Test-file placement).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  resolveHistoryBucket,
  resolveHistoryLaneDir,
  hasHistoryLedger,
  HISTORY_BUCKET_RE,
} from "../dist/tools/lane-paths.js";

function mkWorkspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e125b-lane-paths-history-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// ============================================================================
// AC6 — resolveHistoryBucket: the UTC year-month, always HISTORY_BUCKET_RE.
// ============================================================================

test("BUCKET1: resolveHistoryBucket(now) returns the UTC YYYY-MM of `now`, zero-padded", () => {
  assert.equal(resolveHistoryBucket(new Date("2026-09-25T15:54:04.044Z")), "2026-09");
  assert.equal(resolveHistoryBucket(new Date("2026-01-05T00:00:00.000Z")), "2026-01", "single-digit month must be zero-padded");
});

test("BUCKET2: resolveHistoryBucket uses UTC, not local time — a date whose local rendering would cross a month/year boundary still reports the UTC month", () => {
  // 2025-12-31T23:30:00Z is still December in UTC regardless of the host's
  // local timezone offset (every offset stays within the same UTC instant).
  assert.equal(resolveHistoryBucket(new Date("2025-12-31T23:30:00.000Z")), "2025-12");
  // 2026-01-01T00:30:00Z is already January in UTC.
  assert.equal(resolveHistoryBucket(new Date("2026-01-01T00:30:00.000Z")), "2026-01");
});

test("BUCKET3: resolveHistoryBucket defaults to `new Date()` when called with no argument, and the result always matches HISTORY_BUCKET_RE", () => {
  const bucket = resolveHistoryBucket();
  assert.match(bucket, HISTORY_BUCKET_RE);
});

// ============================================================================
// AC6 — resolveHistoryLaneDir: <workspacePath>/.current/history/<bucket>/<lane>,
// throws on a malformed bucket or an unsafe lane — never silently returns a
// path outside .current/history/<bucket>/.
// ============================================================================

test("HISTDIR1: resolveHistoryLaneDir(ws, bucket, lane) composes .current/history/<bucket>/<lane> exactly", () => {
  const result = resolveHistoryLaneDir("/some/workspace", "2026-09", "e125b");
  assert.equal(result, path.join("/some/workspace", ".current", "history", "2026-09", "e125b"));
});

const MALFORMED_BUCKETS = [
  ["2026", "day-less/month-less: no YYYY-MM match at all"],
  ["2026-9", "single-digit month, not zero-padded"],
  ["26-09", "two-digit year"],
  ["2026-09-25", "a full date, not a month bucket"],
  ["", "empty string"],
  ["../2026-09", "path traversal prefix, even though the trailing chars would match"],
  [undefined, "non-string (undefined)"],
  [42, "non-string (number)"],
];

for (const [bucket, why] of MALFORMED_BUCKETS) {
  test(`HISTDIR2: resolveHistoryLaneDir throws on a malformed bucket ${JSON.stringify(bucket)} (${why}) — never returns a path outside .current/history/<bucket>/`, () => {
    assert.throws(() => resolveHistoryLaneDir("/ws", bucket, "e125b"), /invalid history bucket/);
  });
}

const UNSAFE_LANES = [
  ["../x", "parent-directory traversal"],
  ["..", "bare parent-directory segment"],
  ["a/b", "embedded path separator"],
  ["", "empty string"],
  [".hidden", "dot-prefixed (not alnum/underscore-leading)"],
  [undefined, "non-string (undefined)"],
  [null, "non-string (null)"],
];

for (const [lane, why] of UNSAFE_LANES) {
  test(`HISTDIR3: resolveHistoryLaneDir throws on an unsafe lane ${JSON.stringify(lane)} (${why}) — never returns a path outside .current/history/<bucket>/`, () => {
    assert.throws(() => resolveHistoryLaneDir("/ws", "2026-09", lane), /invalid lane name/);
  });
}

test("HISTDIR4: a malformed bucket is checked BEFORE the lane — an invalid bucket throws even when lane is also unsafe, and the error names the bucket problem", () => {
  assert.throws(() => resolveHistoryLaneDir("/ws", "not-a-bucket", "../also-unsafe"), /invalid history bucket/);
});

test("HISTDIR5: resolveHistoryLaneDir is pure — it creates nothing on disk (no mkdir side effect), even for a workspace path that doesn't exist", (t) => {
  const ws = mkWorkspace(t);
  const nonexistentWs = path.join(ws, "does-not-exist-yet");
  const result = resolveHistoryLaneDir(nonexistentWs, "2026-09", "e125b");
  assert.equal(result, path.join(nonexistentWs, ".current", "history", "2026-09", "e125b"));
  assert.ok(!fs.existsSync(nonexistentWs), "resolveHistoryLaneDir must not create the workspace directory or anything under it");
});

test("HISTDIR6: distinct buckets for the same lane resolve to distinct, sibling directories (two separate closures of the same lane name are never conflated)", () => {
  const a = resolveHistoryLaneDir("/ws", "2026-09", "e125b");
  const b = resolveHistoryLaneDir("/ws", "2026-10", "e125b");
  assert.notEqual(a, b);
  assert.equal(path.dirname(a), path.join("/ws", ".current", "history", "2026-09"));
  assert.equal(path.dirname(b), path.join("/ws", ".current", "history", "2026-10"));
});

// ============================================================================
// AC8 (X7) — hasHistoryLedger: pure fs, scans every HISTORY_BUCKET_RE bucket
// under .current/history/ for <bucket>/<lane>/<filename>, never throws.
// ============================================================================

function writeHistoryFile(ws, bucket, lane, filename, content = "content") {
  const dir = path.join(ws, ".current", "history", bucket, lane);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content);
}

test("HASHIST1: hasHistoryLedger returns true when the named file exists under a valid history bucket for that lane", (t) => {
  const ws = mkWorkspace(t);
  writeHistoryFile(ws, "2026-09", "e125b", "tasks.md");
  assert.equal(hasHistoryLedger(ws, "e125b", "tasks.md"), true);
});

test("HASHIST2: hasHistoryLedger returns false when no history/ directory exists at all", (t) => {
  const ws = mkWorkspace(t);
  assert.equal(hasHistoryLedger(ws, "e125b", "tasks.md"), false);
});

test("HASHIST3: hasHistoryLedger returns false when the bucket exists but the lane subdirectory does not", (t) => {
  const ws = mkWorkspace(t);
  writeHistoryFile(ws, "2026-09", "some-other-lane", "tasks.md");
  assert.equal(hasHistoryLedger(ws, "e125b", "tasks.md"), false);
});

test("HASHIST4: hasHistoryLedger returns false when the lane closed but under a DIFFERENT filename than the one asked about", (t) => {
  const ws = mkWorkspace(t);
  writeHistoryFile(ws, "2026-09", "e125b", "handoff.md");
  assert.equal(hasHistoryLedger(ws, "e125b", "tasks.md"), false, "must check the exact filename, never any file in the lane's history dir");
});

test("HASHIST5: hasHistoryLedger ignores a bucket-shaped-looking directory that does NOT match HISTORY_BUCKET_RE", (t) => {
  const ws = mkWorkspace(t);
  // "2026-9" is one digit short of YYYY-MM — must never be scanned as a bucket.
  writeHistoryFile(ws, "2026-9", "e125b", "tasks.md");
  assert.equal(hasHistoryLedger(ws, "e125b", "tasks.md"), false);
});

test("HASHIST6: hasHistoryLedger scans EVERY valid bucket, not just the lexicographically-first one — a lane closed under a later bucket is still found", (t) => {
  const ws = mkWorkspace(t);
  writeHistoryFile(ws, "2026-01", "some-other-lane", "tasks.md");
  writeHistoryFile(ws, "2026-09", "e125b", "tasks.md");
  assert.equal(hasHistoryLedger(ws, "e125b", "tasks.md"), true);
});

test("HASHIST7: hasHistoryLedger never throws — an unsafe lane, an unsafe filename, or an unreadable history dir all read as false", (t) => {
  const ws = mkWorkspace(t);
  for (const lane of ["../escape", "", undefined, null]) {
    assert.doesNotThrow(() => hasHistoryLedger(ws, lane, "tasks.md"));
    assert.equal(hasHistoryLedger(ws, lane, "tasks.md"), false);
  }
  for (const filename of ["../escape", "", ".", "..", undefined, null]) {
    assert.doesNotThrow(() => hasHistoryLedger(ws, "e125b", filename));
    assert.equal(hasHistoryLedger(ws, "e125b", filename), false);
  }
  // A workspace path that does not exist at all.
  assert.doesNotThrow(() => hasHistoryLedger(path.join(ws, "does-not-exist"), "e125b", "tasks.md"));
  assert.equal(hasHistoryLedger(path.join(ws, "does-not-exist"), "e125b", "tasks.md"), false);
});

test("HASHIST8: hasHistoryLedger returns false for a regular file masquerading as the lane dir (a file named `e125b` sitting where the lane directory would be)", (t) => {
  const ws = mkWorkspace(t);
  const bucketDir = path.join(ws, ".current", "history", "2026-09");
  fs.mkdirSync(bucketDir, { recursive: true });
  fs.writeFileSync(path.join(bucketDir, "e125b"), "not a directory");
  assert.doesNotThrow(() => hasHistoryLedger(ws, "e125b", "tasks.md"));
  assert.equal(hasHistoryLedger(ws, "e125b", "tasks.md"), false);
});
