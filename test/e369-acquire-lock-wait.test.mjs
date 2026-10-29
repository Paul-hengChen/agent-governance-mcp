// Coded by @qa-engineer
// Tests (T-E369-02) for specs/e158-range-subject-audit.md AC-E369-1..5: `acquireLock` must wait (sleep, honour
// --max-wait) while a reclaim guard blocks it, instead of re-running its loop with no sleep and burning a core.
// Why a call-count bound: `now` is injected and is read a fixed small number of times per loop pass, so a bounded
// number of `now` calls over a bounded wait proves the loop slept between passes. A busy spin would call it
// millions of times in the same window (and, before the fix, never returned at all). Each case also runs under a
// node:test timeout, so a regression to the spin fails fast instead of hanging the suite.
// Fixtures live under os.tmpdir() and are removed afterwards. Creation pre-authorized in the dispatch brief.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { acquireLock, CORRUPT_GRACE_MS, LOCK_TIMEOUT_EXIT_CODE } from "../scripts/test-lock.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "test-lock.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e369-qa-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const MAX_WAIT_MS = 300;
const POLL_MS = 50;
// Spec bound: 8 + 3 * ceil(maxWait / poll) reads of `now` (setup + three reads per pass).
const NOW_CALL_BOUND = 8 + 3 * Math.ceil(MAX_WAIT_MS / POLL_MS);

/** A pid that is certainly dead: a child that has already exited and been reaped. */
function deadPid() {
  const r = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  return Number(r.stdout);
}

function guardFor(lockPath, raw) {
  return `${lockPath}.reclaim-${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

/** A lock held by a dead pid plus (via `makeGuard`) the reclaim guard that blocks its reclaimer. */
function mkBlocked(name, makeGuard) {
  const dir = fs.mkdtempSync(path.join(TMP, `${name}-`));
  const lockPath = path.join(dir, "agc-test.lock");
  const raw = JSON.stringify({ pid: deadPid(), acquiredAt: 1, worktreePath: "w", startedAt: "t" });
  fs.writeFileSync(lockPath, raw);
  const guardPath = guardFor(lockPath, raw);
  makeGuard(guardPath);
  return { dir, lockPath, guardPath, raw };
}

function counting() {
  const calls = { now: 0, logs: [] };
  return {
    calls,
    now: () => {
      calls.now += 1;
      return Date.now();
    },
    log: (line) => calls.logs.push(line),
  };
}

async function assertBoundedTimeout(blocked) {
  const c = counting();
  const t0 = Date.now();
  const res = await acquireLock({
    lockPath: blocked.lockPath,
    maxWaitMs: MAX_WAIT_MS,
    pollMs: POLL_MS,
    now: c.now,
    log: c.log,
  });
  const elapsed = Date.now() - t0;
  assert.equal(res.acquired, false);
  assert.equal(res.reason, "timeout");
  assert.ok(c.calls.now <= NOW_CALL_BOUND, `now() was called ${c.calls.now} times, bound ${NOW_CALL_BOUND}: the loop spun`);
  assert.ok(elapsed >= MAX_WAIT_MS - 20, `returned after ${elapsed} ms, before --max-wait elapsed`);
  assert.equal(fs.readFileSync(blocked.lockPath, "utf8"), blocked.raw, "a blocked reclaim must leave the dead lock untouched");
  return c;
}

test("AC-E369-1: a dead lock whose reclaim guard names a LIVE pid times out boundedly (no busy spin)", { timeout: 15000 }, async () => {
  const blocked = mkBlocked("live-guard", (g) => fs.writeFileSync(g, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })));
  const c = await assertBoundedTimeout(blocked);
  const reclaiming = c.calls.logs.filter((l) => l.startsWith("test-lock: reclaiming stale lock from dead pid"));
  assert.equal(reclaiming.length, 1, `the reclaim line is logged once per observed content, got ${reclaiming.length}`);
});

test("AC-E369-2: a corrupt guard still inside CORRUPT_GRACE_MS times out boundedly", { timeout: 15000 }, async () => {
  assert.ok(CORRUPT_GRACE_MS > MAX_WAIT_MS * 4, "fixture assumes the guard stays inside the grace window for the whole wait");
  const blocked = mkBlocked("corrupt-guard", (g) => fs.writeFileSync(g, "not json {"));
  await assertBoundedTimeout(blocked);
});

test("AC-E369-3: an unreadable guard (a directory) times out boundedly", { timeout: 15000 }, async () => {
  const blocked = mkBlocked("dir-guard", (g) => fs.mkdirSync(g));
  await assertBoundedTimeout(blocked);
});

test("AC-E369-4: removing the blocking guard mid-wait lets the acquirer reclaim the dead lock, logging the reclaim once", { timeout: 15000 }, async () => {
  const blocked = mkBlocked("released", (g) => fs.writeFileSync(g, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })));
  const c = counting();
  const releaseAt = Date.now() + 250;
  setTimeout(() => fs.rmSync(blocked.guardPath, { force: true }), 250);
  const res = await acquireLock({ lockPath: blocked.lockPath, pollMs: POLL_MS, now: c.now, log: c.log });
  const finishedAt = Date.now();
  assert.equal(res.acquired, true);
  assert.equal(res.payload.pid, process.pid);
  assert.equal(JSON.parse(fs.readFileSync(blocked.lockPath, "utf8")).pid, process.pid, "the lock now names the acquirer");
  assert.ok(!fs.existsSync(blocked.guardPath), "no guard left behind");
  assert.ok(finishedAt >= releaseAt - 20, "it must not acquire while the guard still blocked it");
  assert.ok(finishedAt - releaseAt < 1500, `acquired ${finishedAt - releaseAt} ms after the guard went away: more than a few polls`);
  const reclaiming = c.calls.logs.filter((l) => l.startsWith("test-lock: reclaiming stale lock from dead pid"));
  assert.equal(reclaiming.length, 1, `reclaim line logged ${reclaiming.length} times for one observed content`);
  // ~250 ms / 50 ms polls plus the final pass, three reads each: far below a spin, with headroom for a slow host.
  assert.ok(c.calls.now <= 8 + 3 * (Math.ceil((finishedAt - (releaseAt - 250)) / POLL_MS) + 2), `now() called ${c.calls.now} times`);
});

test("AC-E369-5: the CLI exits 75 (LOCK_TIMEOUT_EXIT_CODE) at --max-wait while a guard blocks it, and never runs the wrapped command", { timeout: 20000 }, () => {
  const blocked = mkBlocked("cli", (g) => fs.writeFileSync(g, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })));
  const marker = path.join(blocked.dir, "ran.marker");
  const r = spawnSync(
    process.execPath,
    [SCRIPT, "--max-wait", "1", "--lock-path", blocked.lockPath, "--poll-ms", "50", "--", process.execPath, "-e", `require("fs").writeFileSync(${JSON.stringify(marker)}, "ran")`],
    { encoding: "utf8", timeout: 15000 },
  );
  assert.equal(r.status, LOCK_TIMEOUT_EXIT_CODE, `stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.equal(LOCK_TIMEOUT_EXIT_CODE, 75);
  assert.ok(!fs.existsSync(marker), "the wrapped command must not run when the lock was not acquired");
});
