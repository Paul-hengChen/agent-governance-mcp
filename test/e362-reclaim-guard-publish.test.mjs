// Coded by @qa-engineer
// Tests (T-E362-02) for the E362 fix in scripts/test-lock.mjs (specs/e362-test-lock-guard.md,
// AC-E362-1, -2, -3): the reclaim guard `<target>.reclaim-<digest>` must never be observable
// empty, so a reclaimer stalled for >= CORRUPT_GRACE_MS cannot have its guard taken by a second
// reclaimer and later unlink a live lock that an acquirer published in the meantime.
//
// Interposition: patch the CommonJS node:fs object, then syncBuiltinESMExports() so the script's
// `import * as fs` namespace sees it (same technique as test/e209-test-lock-publish.test.mjs).
// Deterministic: no sleeps, no races, and acquireLock is never called while a live guard blocks a
// dead-pid target (acquireLock would busy-spin there: finding E362-NEW-1, out of scope).
// The script under test is the working tree. E362_SCRIPT_UNDER_TEST (a file path) lets qa point
// the same cases at a temp copy of the pre-fix script to record the red run; the suite itself
// never sets it and pins no historical sha.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const cjsFs = require("node:fs");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = process.env.E362_SCRIPT_UNDER_TEST || path.join(ROOT, "scripts", "test-lock.mjs");
const mod = await import(pathToFileURL(SCRIPT).href);
const { reclaimStale, readLock, CORRUPT_GRACE_MS } = mod;

const DEAD_PID = 999999;

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e362-guard-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function deadContent(pid = DEAD_PID) {
  return JSON.stringify({ pid, acquiredAt: 0, worktreePath: "w", startedAt: "x" });
}
function guardFor(lockPath, observed) {
  const digest = createHash("sha256").update(observed).digest("hex").slice(0, 16);
  return `${lockPath}.reclaim-${digest}`;
}
function backdate(p) {
  const old = new Date(Date.now() - CORRUPT_GRACE_MS - 5000);
  fs.utimesSync(p, old, old);
}

/** Patch cjsFs[name] for the duration of fn; always restored. Returns fn's result. */
function withPatched(name, wrapperFactory, fn) {
  const original = cjsFs[name];
  cjsFs[name] = wrapperFactory(original);
  syncBuiltinESMExports();
  try {
    return fn();
  } finally {
    cjsFs[name] = original;
    syncBuiltinESMExports();
  }
}

test("AC-E362-1: a reclaimer stalled past the corrupt grace cannot unlink a live lock published after a second reclaimer took S", (t) => {
  // WHY: base created the guard empty (openSync "wx") and wrote its payload later. A second
  // reclaimer read that empty guard as corrupt, and once it was older than the grace period
  // reclaimed it one level down, so both reclaimers acted on the same stale content S. The
  // stalled one then unlinked the live lock L. Invariant: whoever was told it holds a lock
  // still has it after the first reclaimer returns.
  const dir = tmpDir(t);
  const lockPath = path.join(dir, "test.lock");
  const S = deadContent();
  fs.writeFileSync(lockPath, S);
  const guardPath = guardFor(lockPath, S);
  const L = JSON.stringify({ pid: process.pid, acquiredAt: 1, worktreePath: "L", startedAt: "y" });

  let guardSeen = false;
  let guardEmptyWhenSeen = false;
  let readHooked = false;
  let acquirerPublished = false;

  // Fires once, the first moment R1's guard exists: base = right after openSync "wx",
  // fix = right after linkSync publishes it. Simulates a >= grace stall, then runs R2.
  const onGuard = (p) => {
    if (guardSeen || p !== guardPath || !fs.existsSync(p)) return;
    guardSeen = true;
    guardEmptyWhenSeen = fs.readFileSync(p, "utf-8") === "";
    backdate(p);
    reclaimStale(lockPath, S); // R2
  };
  // Fires once, when R1 has read the target and found S: run R2 again, and if S is gone an
  // acquirer publishes the live lock L (written directly: acquireLock would spin here).
  const onTargetRead = (p) => {
    if (readHooked || !guardSeen || p !== lockPath) return;
    readHooked = true;
    reclaimStale(lockPath, S); // R2 again
    if (!fs.existsSync(lockPath)) {
      fs.writeFileSync(lockPath, L);
      acquirerPublished = true;
    }
  };

  const un = [];
  const patch = (name, f) => {
    const original = cjsFs[name];
    cjsFs[name] = f(original);
    syncBuiltinESMExports();
    un.push(() => {
      cjsFs[name] = original;
      syncBuiltinESMExports();
    });
  };
  try {
    patch("openSync", (o) => function (...a) {
      const r = o.apply(this, a);
      onGuard(a[0]);
      return r;
    });
    patch("linkSync", (o) => function (...a) {
      const r = o.apply(this, a);
      onGuard(a[1]);
      return r;
    });
    patch("readFileSync", (o) => function (...a) {
      const r = o.apply(this, a);
      onTargetRead(a[0]);
      return r;
    });
    reclaimStale(lockPath, S); // R1
  } finally {
    while (un.length) un.pop()();
  }

  assert.equal(guardSeen, true, "the guard interposer must have fired (otherwise the case proves nothing)");
  if (acquirerPublished) {
    assert.equal(fs.existsSync(lockPath), true, "the live lock must survive the stalled reclaimer");
    const lock = readLock(lockPath);
    assert.equal(lock.state, "ok");
    assert.equal(lock.payload.worktreePath, "L", "the surviving lock is the acquirer's");
  }
  assert.equal(guardEmptyWhenSeen, false, "R1's guard must hold its payload the first moment it exists");
  assert.deepEqual(
    fs.readdirSync(dir).filter((f) => f !== "test.lock"),
    [],
    "no guard or temp file may be left behind",
  );
});

test("AC-E362-2: after a reclaim the directory holds no .reclaim- file, and the stale target is gone", (t) => {
  // WHY: the guard temp file starts with `<guardPath>.`, so a leftover would show as .reclaim-*.
  const dir = tmpDir(t);
  const lockPath = path.join(dir, "test.lock");
  const S = deadContent();
  fs.writeFileSync(lockPath, S);
  reclaimStale(lockPath, S);
  assert.equal(fs.existsSync(lockPath), false);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test("AC-E362-2: a reclaim that loses to a live guard (EEXIST) leaves only that guard and the target", (t) => {
  const dir = tmpDir(t);
  const lockPath = path.join(dir, "test.lock");
  const S = deadContent();
  fs.writeFileSync(lockPath, S);
  const guardPath = guardFor(lockPath, S);
  fs.writeFileSync(guardPath, JSON.stringify({ pid: process.pid, at: "z" }));
  reclaimStale(lockPath, S);
  assert.deepEqual(fs.readdirSync(dir).sort(), [path.basename(guardPath), "test.lock"].sort());
  assert.equal(fs.readFileSync(lockPath, "utf-8"), S, "the target must be untouched while a live guard holds it");
});

test("AC-E362-2: a non-EEXIST link error does not throw and leaves no temp file", (t) => {
  const dir = tmpDir(t);
  const lockPath = path.join(dir, "test.lock");
  const S = deadContent();
  fs.writeFileSync(lockPath, S);
  let threw = false;
  withPatched(
    "linkSync",
    () => () => {
      const e = new Error("EPERM");
      e.code = "EPERM";
      throw e;
    },
    () => {
      try {
        reclaimStale(lockPath, S);
      } catch {
        threw = true;
      }
    },
  );
  assert.equal(threw, false, "reclaimStale never throws");
  assert.deepEqual(fs.readdirSync(dir), ["test.lock"], "only the target remains: no guard, no temp");
});

test("AC-E362-2: every guard observed at the moment of publication is non-empty, including nested guards", (t) => {
  // WHY: nested (depth 1) guards are published the same way. A dead guard is reclaimed one level
  // down on the first call; the second call then reclaims the target.
  const dir = tmpDir(t);
  const lockPath = path.join(dir, "test.lock");
  const S = deadContent();
  fs.writeFileSync(lockPath, S);
  const guardPath = guardFor(lockPath, S);
  fs.writeFileSync(guardPath, JSON.stringify({ pid: DEAD_PID - 1, at: "z" }));
  const published = [];
  withPatched(
    "linkSync",
    (o) =>
      function (...a) {
        const r = o.apply(this, a);
        published.push({ dest: path.basename(a[1]), tmpPrefixOk: a[0].startsWith(`${a[1]}.`), len: fs.readFileSync(a[1], "utf-8").length });
        return r;
      },
    () => {
      reclaimStale(lockPath, S);
      assert.equal(fs.existsSync(guardPath), false, "the dead guard is reclaimed one level down");
      reclaimStale(lockPath, S);
    },
  );
  assert.equal(fs.existsSync(lockPath), false, "the second call reclaims the target");
  assert.deepEqual(fs.readdirSync(dir), []);
  assert.ok(published.length >= 2, `expected nested + outer guard publishes, saw ${published.length}`);
  for (const p of published) {
    assert.ok(p.len > 0, `guard ${p.dest} was empty at publication`);
    assert.ok(p.tmpPrefixOk, `guard ${p.dest} temp name must start with <guardPath>.`);
  }
});

test("AC-E362-3: a legacy empty guard is reclaimed only after the corrupt grace, never before", (t) => {
  // WHY: a pre-fix crash can leave a zero-byte guard; it must still be treated as corrupt.
  const dir = tmpDir(t);
  const lockPath = path.join(dir, "test.lock");
  const S = deadContent();
  fs.writeFileSync(lockPath, S);
  const guardPath = guardFor(lockPath, S);
  fs.writeFileSync(guardPath, "");

  reclaimStale(lockPath, S);
  assert.equal(fs.existsSync(guardPath), true, "a fresh empty guard is left alone");
  assert.equal(fs.readFileSync(lockPath, "utf-8"), S, "the target is untouched before the grace");

  backdate(guardPath);
  reclaimStale(lockPath, S);
  assert.equal(fs.existsSync(guardPath), false, "a backdated empty guard is reclaimed");
  assert.equal(fs.existsSync(lockPath), true, "the target is still there on the reclaiming call");

  reclaimStale(lockPath, S);
  assert.equal(fs.existsSync(lockPath), false, "a following call reclaims the target");
  assert.deepEqual(fs.readdirSync(dir), []);
});
