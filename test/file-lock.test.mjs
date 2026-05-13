// Tests for guards/file-lock.ts (cross-process O_EXCL lock with stale-PID reap).
// Run via `node --test`. Imports the compiled output in dist/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { withFileLock } from "../dist/guards/file-lock.js";

const WORKER = fileURLToPath(new URL("./_lock-worker.mjs", import.meta.url));

function runWorker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER, ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stderr }));
  });
}

function mkTmp(prefix = "twlock-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("acquires the lock, runs the callback, and removes the lockfile", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, ".handoff.lock");
  let observedLockfile = false;

  const result = await withFileLock(lockPath, () => {
    observedLockfile = fs.existsSync(lockPath);
    return 42;
  });

  assert.equal(result, 42);
  assert.equal(observedLockfile, true, "lockfile must exist while callback runs");
  assert.equal(fs.existsSync(lockPath), false, "lockfile must be removed after callback");
});

test("removes lockfile even when the callback throws", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, ".handoff.lock");

  await assert.rejects(
    () => withFileLock(lockPath, () => { throw new Error("boom"); }),
    /boom/,
  );
  assert.equal(fs.existsSync(lockPath), false);
});

test("serialises concurrent in-process callers", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, ".handoff.lock");
  const events = [];

  const slow = withFileLock(lockPath, async () => {
    events.push("A-start");
    await new Promise((r) => setTimeout(r, 80));
    events.push("A-end");
  });
  // Schedule B after A has already grabbed the lock.
  await new Promise((r) => setTimeout(r, 10));
  const fast = withFileLock(lockPath, () => {
    events.push("B-start");
    events.push("B-end");
  });

  await Promise.all([slow, fast]);
  assert.deepEqual(events, ["A-start", "A-end", "B-start", "B-end"]);
});

test("reaps a lockfile whose acquiredAt is older than the stale threshold", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, ".handoff.lock");

  // Plant a "stale" lockfile from a live PID but old acquiredAt (>30s ago).
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ pid: process.pid, acquiredAt: Date.now() - 60_000 }),
  );

  let ran = false;
  await withFileLock(lockPath, () => { ran = true; });
  assert.equal(ran, true, "callback must run after stale lock is reaped");
  assert.equal(fs.existsSync(lockPath), false);
});

test("reaps a lockfile owned by a non-existent PID", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, ".handoff.lock");

  // PID 0x7fffffff is essentially guaranteed not to exist.
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ pid: 0x7fffffff, acquiredAt: Date.now() }),
  );

  let ran = false;
  await withFileLock(lockPath, () => { ran = true; });
  assert.equal(ran, true);
});

test("reaps a corrupted lockfile whose mtime is older than the stale threshold", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, ".handoff.lock");

  fs.writeFileSync(lockPath, "not-json-at-all");
  // Back-date mtime past the 30s threshold.
  const old = (Date.now() - 60_000) / 1000;
  fs.utimesSync(lockPath, old, old);

  let ran = false;
  await withFileLock(lockPath, () => { ran = true; });
  assert.equal(ran, true);
});

test("serialises concurrent CROSS-PROCESS callers without torn writes", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, ".handoff.lock");
  const outputPath = path.join(dir, "out.log");
  fs.writeFileSync(outputPath, "");

  const [a, b, c] = await Promise.all([
    runWorker([lockPath, outputPath, "A", "60"]),
    runWorker([lockPath, outputPath, "B", "60"]),
    runWorker([lockPath, outputPath, "C", "60"]),
  ]);
  assert.equal(a.code, 0, `worker A failed: ${a.stderr}`);
  assert.equal(b.code, 0, `worker B failed: ${b.stderr}`);
  assert.equal(c.code, 0, `worker C failed: ${c.stderr}`);

  const lines = fs.readFileSync(outputPath, "utf-8").trim().split("\n");
  assert.equal(lines.length, 6, "each worker must contribute start+end");

  // Each worker's start must be immediately followed by its own end. If any
  // other tag appears between them, the lock failed to serialise.
  for (let i = 0; i < lines.length; i += 2) {
    const [startTag, startMarker] = lines[i].split(":");
    const [endTag, endMarker] = lines[i + 1].split(":");
    assert.equal(startMarker, "start");
    assert.equal(endMarker, "end");
    assert.equal(startTag, endTag, `interleaved critical section at line ${i}: ${lines.join(" | ")}`);
  }

  assert.equal(fs.existsSync(lockPath), false, "lockfile must be cleaned up");
});

test("creates the lock directory if missing", async () => {
  const dir = mkTmp();
  const lockPath = path.join(dir, "nested", "subdir", ".handoff.lock");
  assert.equal(fs.existsSync(path.dirname(lockPath)), false);

  await withFileLock(lockPath, () => {});
  assert.equal(fs.existsSync(path.dirname(lockPath)), true);
});
