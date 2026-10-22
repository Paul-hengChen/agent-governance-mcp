// Coded by @qa-engineer
// Tests (T-E209-02) for the E209 fix in scripts/test-lock.mjs (specs/e209-test-infra-fixes.md,
// AC-E209-1, -2, -4): a freshly acquired lock must never be observable empty, so a late
// reclaimer holding the STALE observation "" (from an earlier crashed, zero-byte lock)
// cannot unlink a live lock.
//
// AC-E209-1 reading (agreed by integrator + code-reviewer, spec text unchanged): the
// interposer hands reclaimStale the stale observation "" at the moment the new lock first
// appears. It does NOT hand it the content read after the publish: reclaimStale unlinks
// whatever matches the caller's observation by contract, so the literal post-publish content
// would be red on the fixed script too.
// Interposition: patch the CommonJS node:fs object, then syncBuiltinESMExports() so the
// script's `import * as fs` namespace sees it. No sleeps, no races: deterministic.
// The script under test is the working tree. E209_SCRIPT_UNDER_TEST (a file path) lets qa
// point the same cases at a temp copy of an older script to record the red run; it is not
// used by the suite.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const cjsFs = require("node:fs");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = process.env.E209_SCRIPT_UNDER_TEST || path.join(ROOT, "scripts", "test-lock.mjs");
const mod = await import(pathToFileURL(SCRIPT).href);
const { acquireLock, readLock, reclaimStale, CORRUPT_GRACE_MS } = mod;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "e209-lock-"));
}

/** Patch cjsFs[name] for the duration of fn; always restored. */
async function withPatched(name, wrapperFactory, fn) {
  const original = cjsFs[name];
  cjsFs[name] = wrapperFactory(original);
  syncBuiltinESMExports();
  try {
    return await fn();
  } finally {
    cjsFs[name] = original;
    syncBuiltinESMExports();
  }
}

test("AC-E209-1: a late reclaimer holding the stale empty observation cannot delete a freshly acquired lock", async () => {
  // WHY: the lock must never be observable empty. Base created it with openSync("wx") then wrote
  // later; a reclaimer that had seen an older zero-byte lock saw the new empty one as 'the same
  // stale file' and unlinked it, so two suites ran at once.
  const dir = tmpDir();
  const lockPath = path.join(dir, "test.lock");
  let fired = 0;
  const interpose = (orig) =>
    function (...args) {
      const r = orig.apply(this, args);
      // First time the lock path comes into existence: base = the openSync that creates it,
      // fix = the linkSync that publishes it.
      if (fired === 0 && args.some((a) => a === lockPath) && fs.existsSync(lockPath)) {
        fired++;
        reclaimStale(lockPath, ""); // the reclaimer's STALE observation
      }
      return r;
    };
  const result = await withPatched("openSync", interpose, () =>
    withPatched("linkSync", interpose, () => acquireLock({ lockPath, log: () => {} })),
  );
  assert.equal(fired, 1, "the interposer must have fired exactly once (otherwise the case proves nothing)");
  assert.equal(result.acquired, true);
  assert.equal(fs.existsSync(lockPath), true, "the live lock must survive the late reclaimer");
  const lock = readLock(lockPath);
  assert.equal(lock.state, "ok");
  assert.equal(lock.payload.pid, process.pid, "the surviving lock names the acquirer");
  assert.deepEqual(
    fs.readdirSync(dir).filter((f) => f.includes(".acquire-")),
    [],
    "no acquire temp file may be left",
  );
});

test("AC-E209-2: after a successful acquire the directory holds only the lock (no temp left)", async () => {
  const dir = tmpDir();
  const lockPath = path.join(dir, "test.lock");
  const result = await acquireLock({ lockPath, log: () => {} });
  assert.equal(result.acquired, true);
  assert.deepEqual(fs.readdirSync(dir), ["test.lock"]);
  const payload = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
  assert.deepEqual(Object.keys(payload).sort(), ["acquiredAt", "pid", "startedAt", "worktreePath"], "payload shape unchanged");
  assert.deepEqual(Object.keys(result.payload).sort(), ["acquiredAt", "pid", "startedAt", "worktreePath"]);
});

test("AC-E209-2: contention with a live holder times out leaving only the holder's lock", async () => {
  // WHY: the EEXIST path must unlink the temp every attempt, or each poll leaks a file.
  const dir = tmpDir();
  const lockPath = path.join(dir, "test.lock");
  const holder = { pid: process.pid, acquiredAt: Date.now(), worktreePath: "w", startedAt: new Date().toISOString() };
  fs.writeFileSync(lockPath, JSON.stringify(holder));
  const result = await acquireLock({ lockPath, maxWaitMs: 150, pollMs: 20, log: () => {} });
  assert.equal(result.acquired, false);
  assert.equal(result.reason, "timeout");
  assert.deepEqual(fs.readdirSync(dir), ["test.lock"]);
  assert.equal(JSON.parse(fs.readFileSync(lockPath, "utf-8")).pid, process.pid, "holder's lock untouched");
});

test("AC-E209-2: a non-EEXIST publish error propagates and leaves no temp file", async () => {
  const dir = tmpDir();
  const lockPath = path.join(dir, "test.lock");
  const boom = (orig) =>
    function (...args) {
      if (args.some((a) => a === lockPath)) {
        const e = new Error("injected");
        e.code = "EPERM";
        throw e;
      }
      return orig.apply(this, args);
    };
  // Whichever call publishes the lock (linkSync on the fix) fails with EPERM.
  await withPatched("linkSync", boom, async () => {
    await assert.rejects(() => acquireLock({ lockPath, log: () => {} }), (e) => e.code === "EPERM");
  });
  assert.deepEqual(fs.readdirSync(dir), [], "temp removed and no lock created");
});

test("AC-E209-4: an empty (zero-byte) legacy lock is corrupt and is not reclaimed before CORRUPT_GRACE_MS", async () => {
  const dir = tmpDir();
  const lockPath = path.join(dir, "test.lock");
  fs.writeFileSync(lockPath, "");
  assert.equal(readLock(lockPath).state, "corrupt");
  assert.ok(CORRUPT_GRACE_MS > 1000, "grace period is non-trivial");
  const logs = [];
  const result = await acquireLock({ lockPath, maxWaitMs: 150, pollMs: 20, log: (l) => logs.push(l) });
  assert.equal(result.acquired, false, "a fresh empty lock is not stolen inside the grace period");
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(fs.readFileSync(lockPath, "utf-8"), "");
  assert.ok(!logs.some((l) => /reclaiming lock with unparseable payload/.test(l)));
});
