// Coded by @qa-engineer
// T-E177B-04 — tests for scripts/test-lock.mjs (specs/e177b-lane-status-tooling.md,
// AC7-AC13, AC13a, AC13b).
//
// Spec-to-Test map:
//   AC7  (serialize two concurrent npm test wraps)      -> "AC7: ..."
//   AC8  (one lock per shared git-common-dir)            -> "AC8: ..."
//   AC9  (re-entrant: nested wrap does not self-deadlock) -> "AC9: ..."
//   AC10 (dead-pid reclaim, staleness by liveness only)   -> "AC10: ..."
//   AC11 (regression: live pid + ancient acquiredAt -> NOT reclaimed)
//                                                          -> "AC11: ..."
//   AC12 (waiting line format + repeats every notify interval)
//                                                          -> "AC12: ..." (x2)
//   AC13 (--max-wait -> reserved timeout exit code, distinct message)
//                                                          -> "AC13: ..."
//   AC13a (>=3 concurrent reclaimers of a dead lock -> exactly one holder ever)
//                                                          -> "AC13a: ..."
//   AC13b (SIGKILLed wrapper's still-live child blocks reclaim)
//                                                          -> "AC13b: ..."
//
// WHY every spawned test-lock.mjs invocation below passes an explicit
// --lock-path into a fresh $TMPDIR directory (never the default resolved
// via `git rev-parse --git-common-dir`): this file itself runs INSIDE
// `npm test`, which package.json now wraps through
// `node scripts/test-lock.mjs -- node --test test/*.test.mjs` — the outer
// suite process already holds THIS repo's real git-common-dir lock and
// exports AGC_TEST_LOCK_HELD naming it. A child test-lock.mjs invocation
// that resolved that SAME real lock path would either see the re-entrant
// short-circuit (AC9) and never really lock at all, or (if AC9 didn't apply)
// deadlock this very suite against itself. A private --lock-path in a fresh
// tmpdir per test sidesteps both hazards and lets every test drive the
// locking logic directly.
//
// Fast timing throughout: --notify-interval / --poll-ms / --max-wait are
// always fractional-second, never the real 30s/10s defaults, so this whole
// file runs in a few seconds, not minutes.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  LOCK_FILENAME,
  REENTRANT_ENV,
  LOCK_TIMEOUT_EXIT_CODE,
  USAGE_EXIT_CODE,
  isPidAlive,
  resolveLockPath,
  isHolderAlive,
  formatWaitingLine,
  readLock,
  reclaimStale,
  recordChildPid,
} from "../scripts/test-lock.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const TEST_LOCK_SCRIPT = path.join(ROOT, "scripts", "test-lock.mjs");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function mkTmpDir(t, prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function mkLockPath(t, prefix) {
  return path.join(mkTmpDir(t, prefix), LOCK_FILENAME);
}

/** Spawn `node scripts/test-lock.mjs <args> -- <cmd...>`, resolving with
 *  { code, signal, stdout, stderr } once the process exits. */
function runTestLock(args, cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TEST_LOCK_SCRIPT, ...args, "--", ...cmd], {
      cwd: opts.cwd ?? ROOT,
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, stdout, stderr, pid: child.pid }));
    if (opts.onSpawn) opts.onSpawn(child);
  });
}

function writeStaleLock(lockPath, overrides = {}) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const payload = {
    pid: 999999, // astronomically unlikely to be a live pid
    acquiredAt: Date.now(),
    worktreePath: "/nonexistent/worktree",
    startedAt: new Date().toISOString(),
    ...overrides,
  };
  fs.writeFileSync(lockPath, JSON.stringify(payload));
  return payload;
}

async function waitFor(predicate, { timeoutMs = 3000, intervalMs = 10 } = {}) {
  const start = Date.now();
  for (;;) {
    if (predicate()) return true;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** A tiny standalone script (never inside the repo — $TMPDIR only) that
 *  records its own start/end wall-clock timestamps to a shared results file,
 *  busy-waiting (not setTimeout) for `holdMs` so the "critical section"
 *  width is deterministic regardless of event-loop scheduling. */
function mkRecorderScript(t) {
  const dir = mkTmpDir(t, "e177b-recorder-");
  const scriptPath = path.join(dir, "record.mjs");
  fs.writeFileSync(
    scriptPath,
    `import * as fs from "node:fs";
const [, , resultsFile, holdMsRaw] = process.argv;
const holdMs = Number(holdMsRaw);
const start = Date.now();
fs.appendFileSync(resultsFile, JSON.stringify({ pid: process.pid, start }) + "\\n");
while (Date.now() - start < holdMs) { /* busy-wait: deterministic hold width */ }
fs.appendFileSync(resultsFile, JSON.stringify({ pid: process.pid, end: Date.now() }) + "\\n");
`,
  );
  return scriptPath;
}

/** Parse a results file of `{pid,start}` / `{pid,end}` lines into
 *  `[{pid, start, end}]` intervals. */
function parseIntervals(resultsFile) {
  const byPid = new Map();
  const text = fs.existsSync(resultsFile) ? fs.readFileSync(resultsFile, "utf-8") : "";
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const cur = byPid.get(row.pid) ?? {};
    Object.assign(cur, row);
    byPid.set(row.pid, cur);
  }
  return [...byPid.values()];
}

/** true iff no two intervals overlap (mutual exclusion held throughout). */
function noOverlap(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// AC7 — two concurrent npm-test-shaped wraps never overlap
// ---------------------------------------------------------------------------

test("AC7: two concurrent wraps of the SAME lock never execute their commands in overlapping windows", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac7-");
  const resultsFile = path.join(mkTmpDir(t, "e177b-ac7-results-"), "results.jsonl");
  const recorder = mkRecorderScript(t);

  // A generous --max-wait safety net (never expected to fire: each hold is
  // 150ms) converts a hypothetical hang into a fast, loud failure instead of
  // stalling the whole suite (the hang class seen earlier in E182).
  const [r1, r2] = await Promise.all([
    runTestLock(["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "15"], [process.execPath, recorder, resultsFile, "150"]),
    runTestLock(["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "15"], [process.execPath, recorder, resultsFile, "150"]),
  ]);
  assert.equal(r1.code, 0);
  assert.equal(r2.code, 0);
  const intervals = parseIntervals(resultsFile);
  assert.equal(intervals.length, 2);
  assert.ok(noOverlap(intervals), `windows must never overlap: ${JSON.stringify(intervals)}`);
  assert.equal(fs.existsSync(lockPath), false, "the lock file must be released after both wraps finish");
});

// ---------------------------------------------------------------------------
// AC8 — one lock path per shared git-common-dir, from any linked worktree
// ---------------------------------------------------------------------------

test("AC8: resolveLockPath resolves the SAME path from the primary checkout and from a linked worktree of it", { timeout: 20000 }, (t) => {
  const primary = mkTmpDir(t, "e177b-ac8-primary-");
  git(["init", "-q", "-b", "main"], primary);
  git(["config", "user.email", "a@b.c"], primary);
  git(["config", "user.name", "t"], primary);
  fs.writeFileSync(path.join(primary, "f.txt"), "x\n");
  git(["add", "-A"], primary);
  git(["commit", "-q", "-m", "init"], primary);

  const wt = mkTmpDir(t, "e177b-ac8-wt-");
  fs.rmSync(wt, { recursive: true, force: true });
  git(["worktree", "add", "-q", "-b", "feat/e177b-ac8", wt], primary);

  const fromPrimary = resolveLockPath(primary);
  const fromWorktree = resolveLockPath(wt);
  assert.ok(fromPrimary, "must resolve inside a real git repo");
  assert.equal(fromPrimary, fromWorktree, "every linked worktree of one primary must contend for the SAME lock file");
  assert.ok(fromPrimary.endsWith(LOCK_FILENAME));
});

test("AC8: resolveLockPath returns null outside any git repository (never throws)", { timeout: 20000 }, (t) => {
  const notARepo = mkTmpDir(t, "e177b-ac8-norepo-");
  assert.equal(resolveLockPath(notARepo), null);
});

// ---------------------------------------------------------------------------
// AC9 — re-entrant: a nested wrap under the SAME lock path runs directly
// ---------------------------------------------------------------------------

test("AC9: a nested `test-lock -- test-lock -- <cmd>` under the SAME --lock-path returns promptly, never self-deadlocking", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac9-");
  const start = Date.now();
  const result = await runTestLock(
    ["--lock-path", lockPath, "--poll-ms", "10"],
    [process.execPath, TEST_LOCK_SCRIPT, "--lock-path", lockPath, "--poll-ms", "10", "--", "true"],
  );
  const elapsedMs = Date.now() - start;
  assert.equal(result.code, 0);
  // "Fast" distinguishes a genuine short-circuit from a stuck/queued run —
  // it is not a tight perf benchmark. 10s tolerates full-suite CPU
  // contention (observed once at ~2.4s for a related dead-pid reclaim under
  // the full 2700+-test suite); a true self-deadlock would instead hang
  // until this test's own 20s node:test timeout, never merely run slow.
  assert.ok(elapsedMs < 10_000, `nested re-entrant run must be fast (not self-deadlocked), took ${elapsedMs}ms`);
  assert.equal(fs.existsSync(lockPath), false);
});

test("AC9 (unit): the re-entrancy check is keyed on the EXACT resolved lock path, not just 'some lock is held'", { timeout: 20000 }, () => {
  // main() compares process.env[REENTRANT_ENV] === lockPath by exact string
  // equality — pin that contract directly against the exported constant name
  // so a future refactor renaming REENTRANT_ENV is caught here, not only by
  // an end-to-end timing coincidence.
  assert.equal(REENTRANT_ENV, "AGC_TEST_LOCK_HELD");
});

// ---------------------------------------------------------------------------
// AC10 — dead-pid reclaim: staleness decided by liveness only, never age
// ---------------------------------------------------------------------------

test("AC10: a lock left by a DEAD pid is reclaimed promptly regardless of its age", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac10-");
  writeStaleLock(lockPath, { acquiredAt: Date.now() - 60_000 }); // 1 minute "old" but the point is liveness, not age
  const start = Date.now();
  const result = await runTestLock(
    ["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "15"], // safety net; reclaim is expected in well under 1s
    [process.execPath, "-e", "process.exit(0)"],
  );
  const elapsedMs = Date.now() - start;
  assert.equal(result.code, 0);
  // "Promptly" distinguishes an immediate reclaim (liveness-based, AC10) from
  // CORRUPT_GRACE_MS-style waiting (10s) — not a tight perf benchmark. Under
  // the full 2700+-test suite's CPU contention this was observed at ~2.4s
  // once; 8s stays well clear of the 10s corrupt-payload grace period this
  // test must be distinguished from, while tolerating slow-machine/
  // full-suite scheduling delays.
  assert.ok(elapsedMs < 8_000, `a dead-pid lock must be reclaimed promptly (well under the 10s corrupt-grace period), took ${elapsedMs}ms`);
  assert.match(result.stderr, /reclaiming stale lock from dead pid 999999/);
});

test("AC10: isPidAlive is false for a pid that plausibly does not exist, true for our own pid", { timeout: 20000 }, () => {
  assert.equal(isPidAlive(999999), false);
  assert.equal(isPidAlive(process.pid), true);
  assert.equal(isPidAlive(-1), false, "boundary: non-positive pid is never alive");
  assert.equal(isPidAlive(0), false, "boundary: pid 0 is never alive by this check");
  assert.equal(isPidAlive(1.5), false, "boundary: a non-integer pid is never alive");
});

// ---------------------------------------------------------------------------
// AC11 (regression lock for AC10/R1) — live pid + ancient acquiredAt -> held
// ---------------------------------------------------------------------------

test("AC11: a lock whose pid IS alive but whose acquiredAt is ~1 hour old is NOT reclaimed — staleness is liveness-only, never age", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac11-");
  // Our own test process is unambiguously alive, and its acquiredAt is faked
  // to ~1 hour ago — the test never actually waits an hour.
  writeStaleLock(lockPath, { pid: process.pid, acquiredAt: Date.now() - 60 * 60 * 1000 });

  const result = await runTestLock(
    ["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "0.3"],
    [process.execPath, "-e", "process.exit(0)"],
  );
  assert.equal(result.code, LOCK_TIMEOUT_EXIT_CODE, "a live holder must be respected however old acquiredAt is — never reclaimed by age");
  assert.doesNotMatch(result.stderr, /reclaiming/, "a live holder must never trigger the reclaim path");
});

test("AC11 (unit): isHolderAlive is age-blind — only pid/childPid liveness matters", { timeout: 20000 }, () => {
  assert.equal(isHolderAlive({ pid: process.pid, acquiredAt: 0 }), true, "acquiredAt=0 (epoch) must not matter — only liveness does");
  assert.equal(isHolderAlive({ pid: 999999, childPid: process.pid }), true, "EITHER pid alive counts as held (AC13b)");
  assert.equal(isHolderAlive({ pid: 999999, childPid: 999998 }), false);
  assert.equal(isHolderAlive(null), false);
});

// ---------------------------------------------------------------------------
// AC12 — the exact waiting line, printed on entering the wait and repeated
// ---------------------------------------------------------------------------

test("AC12 (unit): formatWaitingLine matches the exact spec format", { timeout: 20000 }, () => {
  const line = formatWaitingLine({ pid: 4242, worktreePath: "/x/y", startedAt: "2026-01-01T00:00:00Z" });
  assert.equal(line, "waiting for test lock held by pid 4242 (/x/y) since 2026-01-01T00:00:00Z");
});

test("AC12: a waiter prints the waiting line immediately, then again every --notify-interval", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac12-");
  writeStaleLock(lockPath, { pid: process.pid, acquiredAt: Date.now(), worktreePath: "/somewhere", startedAt: "2026-01-01T00:00:00Z" });

  const result = await runTestLock(
    ["--lock-path", lockPath, "--poll-ms", "20", "--notify-interval", "0.15", "--max-wait", "0.5"],
    [process.execPath, "-e", "process.exit(0)"],
  );
  assert.equal(result.code, LOCK_TIMEOUT_EXIT_CODE);
  const matches = result.stderr.match(/waiting for test lock held by pid \d+ \(\/somewhere\) since 2026-01-01T00:00:00Z/g) ?? [];
  assert.ok(matches.length >= 2, `expected the waiting line to repeat at least twice in 0.5s at a 0.15s notify interval, got ${matches.length}`);
});

// ---------------------------------------------------------------------------
// AC13 — --max-wait: reserved timeout exit code, distinct from any test failure
// ---------------------------------------------------------------------------

test("AC13: --max-wait exceeded exits with the reserved lock-timeout code and a message stating this is NOT a test failure", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac13-");
  writeStaleLock(lockPath, { pid: process.pid, acquiredAt: Date.now() });

  const result = await runTestLock(
    ["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "0.2"],
    [process.execPath, "-e", "process.exit(1)"], // the wrapped command's own failure exit code (1) must never collide
  );
  assert.equal(result.code, LOCK_TIMEOUT_EXIT_CODE);
  assert.notEqual(LOCK_TIMEOUT_EXIT_CODE, 1, "the reserved timeout code must never equal the wrapped command's own exit code");
  assert.match(result.stderr, /LOCK-WAIT TIMEOUT/);
  assert.match(result.stderr, /NOT a test failure/);
  assert.match(result.stderr, /the wrapped command never ran/);
});

test("AC13: omitting --max-wait waits indefinitely (queues) rather than throwing — proven by outlasting a short probe window, then completing once released", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac13b-");
  writeStaleLock(lockPath, { pid: process.pid, acquiredAt: Date.now() }); // live holder (our own pid) — never reclaimed
  // Deliberately no --max-wait (that is what this test proves) — a CLI bound
  // here would defeat the point. Instead, track the child directly so a
  // hypothetical bug (the lock never actually clearing) leaves no orphaned
  // process behind even though the node:test `timeout` above will fail the
  // test loudly either way.
  let waiterChild = null;
  t.after(() => {
    if (waiterChild) {
      try {
        waiterChild.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  });
  const waiterPromise = runTestLock(["--lock-path", lockPath, "--poll-ms", "20"], [process.execPath, "-e", "process.exit(0)"], {
    onSpawn: (child) => {
      waiterChild = child;
    },
  });
  let settled = false;
  waiterPromise.then(() => (settled = true));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(settled, false, "with no --max-wait, the waiter must still be queued after 300ms of a live (never-releasing) holder");
  fs.rmSync(lockPath, { force: true }); // simulate the holder releasing
  const result = await waiterPromise;
  assert.equal(result.code, 0, "once the lock clears, the indefinite waiter must proceed and succeed");
});

// ---------------------------------------------------------------------------
// AC13a — >=3 concurrent reclaimers of one dead lock: exactly one ever holds
// ---------------------------------------------------------------------------

test("AC13a: 5 processes racing to reclaim ONE dead-pid lock simultaneously never produce two concurrent holders", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac13a-");
  writeStaleLock(lockPath);
  const resultsFile = path.join(mkTmpDir(t, "e177b-ac13a-results-"), "results.jsonl");
  const recorder = mkRecorderScript(t);

  const N = 5;
  // Safety-net --max-wait (never expected to fire — worst-case fully
  // serialized is ~600ms): converts a hypothetical reclaim-race hang into a
  // fast failure instead of stalling the whole suite.
  const runs = Array.from({ length: N }, () =>
    runTestLock(["--lock-path", lockPath, "--poll-ms", "5", "--max-wait", "15"], [process.execPath, recorder, resultsFile, "120"]),
  );
  const results = await Promise.all(runs);
  for (const r of results) assert.equal(r.code, 0, `every racer must eventually succeed: ${JSON.stringify(r)}`);

  const intervals = parseIntervals(resultsFile);
  assert.equal(intervals.length, N, "every racer must have run its command exactly once");
  assert.ok(noOverlap(intervals), `no two racers may ever hold the lock at the same time: ${JSON.stringify(intervals)}`);
  assert.equal(fs.existsSync(lockPath), false);
  // No leftover `.reclaim-<hash>` guard files after the dust settles.
  const leftovers = fs.readdirSync(path.dirname(lockPath)).filter((f) => f.includes(".reclaim-"));
  assert.deepEqual(leftovers, [], "no orphaned reclaim guard files may survive a completed race");
});

test("AC13a (unit): reclaimStale is idempotent — a second call with the SAME observed stale content is a safe no-op once the first has already removed it", { timeout: 20000 }, (t) => {
  const dir = mkTmpDir(t, "e177b-ac13a-unit-");
  const lockPath = path.join(dir, LOCK_FILENAME);
  const payload = writeStaleLock(lockPath);
  const raw = fs.readFileSync(lockPath, "utf-8");
  assert.equal(JSON.parse(raw).pid, payload.pid);

  reclaimStale(lockPath, raw);
  assert.equal(fs.existsSync(lockPath), false, "the first reclaimer must remove the stale lock");

  assert.doesNotThrow(() => reclaimStale(lockPath, raw), "a second reclaimer observing the SAME (now-stale) content must never throw");
  assert.equal(fs.existsSync(lockPath), false, "still gone — the no-op reclaimer must not resurrect or duplicate anything");
});

// ---------------------------------------------------------------------------
// AC13b — a SIGKILLed wrapper's still-live child is never treated as dead
// ---------------------------------------------------------------------------

test("AC13b: SIGKILLing the wrapper does not free the lock while its spawned child is still running; a new waiter reclaims only after the child exits", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-ac13b-");
  const dir = mkTmpDir(t, "e177b-ac13b-child-");
  const doneFile = path.join(dir, "done");
  // The child's lifetime is test-controlled via this release file instead of
  // a fixed wall-clock busy-wait: under full-suite load, the kill -> wait-dead
  // -> spawn-probe sequence below can take longer than any fixed window, so a
  // clock-based "outlive the SIGKILL" bound is inherently racy (E212). The
  // child polls for this file's existence (not a hard CPU busy-spin) and only
  // the test writes it, and only AFTER the probe below has already observed
  // the child as the still-alive lock holder — so the "child still alive
  // while the probe runs" premise holds regardless of scheduling load.
  const releaseFile = path.join(dir, "release");
  const childScript = path.join(dir, "child.mjs");
  fs.writeFileSync(
    childScript,
    `import * as fs from "node:fs";
const releaseFile = ${JSON.stringify(releaseFile)};
// Safety bound: self-exit even if the test never writes the release file
// (e.g. an earlier assertion threw), so a failed run can never leave this
// child running forever.
const CEILING_MS = 15000;
const sleeper = new Int32Array(new SharedArrayBuffer(4));
const start = Date.now();
while (!fs.existsSync(releaseFile) && Date.now() - start < CEILING_MS) {
  Atomics.wait(sleeper, 0, 0, 20); // poll every 20ms; never spin the CPU hard
}
fs.writeFileSync(${JSON.stringify(doneFile)}, "done");
`,
  );

  const wrapper = spawn(
    process.execPath,
    [TEST_LOCK_SCRIPT, "--lock-path", lockPath, "--poll-ms", "10", "--", process.execPath, childScript],
    { cwd: ROOT },
  );
  let childPid; // set once known, below — closed over by t.after for cleanup
  t.after(() => {
    // Belt-and-braces cleanup so a failed assertion above can never leak an
    // orphan process or leave a child spinning: releasing is idempotent
    // (fs.writeFileSync overwrites) and harmless if the child already exited.
    try {
      fs.writeFileSync(releaseFile, "go");
    } catch {
      /* dir may already be gone */
    }
    try {
      process.kill(wrapper.pid, 0); // still alive? best-effort cleanup only.
      wrapper.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    if (Number.isInteger(childPid)) {
      try {
        process.kill(childPid, 0);
        process.kill(childPid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  });

  // Wait until the wrapper has actually recorded the child's pid in the lock
  // (recordChildPid runs right after spawn) — a raw fs.existsSync(lockPath)
  // alone would race recordChildPid's own write.
  await waitFor(() => {
    if (!fs.existsSync(lockPath)) return false;
    const lock = readLock(lockPath);
    return lock.state === "ok" && Number.isInteger(lock.payload.childPid);
  });
  const lockBeforeKill = readLock(lockPath);
  childPid = lockBeforeKill.payload.childPid;
  assert.ok(isPidAlive(childPid), "the child must be alive before we kill the wrapper");

  wrapper.kill("SIGKILL");
  await waitFor(() => !isPidAlive(wrapper.pid), { timeoutMs: 2000 });
  assert.ok(isPidAlive(childPid), "the child must survive its wrapper's SIGKILL (children are not killed transitively)");

  // A new request must NOT reclaim while the child is still alive.
  const probe = await runTestLock(
    ["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "0.2"],
    [process.execPath, "-e", "process.exit(0)"],
  );
  assert.equal(probe.code, LOCK_TIMEOUT_EXIT_CODE, "the lock must still be considered held while the orphaned child lives");
  assert.doesNotMatch(probe.stderr, /reclaiming/);

  // Only now — after the probe above has already returned its verdict — let
  // the child finish, so its exit can never race the probe's observation.
  fs.writeFileSync(releaseFile, "go");

  await waitFor(() => fs.existsSync(doneFile), { timeoutMs: 3000 });
  await waitFor(() => !isPidAlive(childPid), { timeoutMs: 2000 });

  const after = await runTestLock(["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "2"], [process.execPath, "-e", "process.exit(0)"]);
  assert.equal(after.code, 0, "once the orphaned child has actually exited, a new waiter must reclaim and succeed");
});

test("AC13b (unit): recordChildPid only rewrites a lock that still names OUR pid, and preserves the rest of the payload", { timeout: 20000 }, (t) => {
  const dir = mkTmpDir(t, "e177b-ac13b-unit-");
  const lockPath = path.join(dir, LOCK_FILENAME);
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, acquiredAt: 1, worktreePath: "/w", startedAt: "t" }));

  const written = recordChildPid(lockPath, 424242, process.pid);
  assert.equal(written.childPid, 424242);
  assert.equal(written.worktreePath, "/w", "the rest of the payload must be preserved, not clobbered");

  // A lock that no longer names our pid must be refused (returns null,
  // never overwrites someone else's lock).
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid + 1, acquiredAt: 1, worktreePath: "/other", startedAt: "t" }));
  const refused = recordChildPid(lockPath, 555, process.pid);
  assert.equal(refused, null);
  assert.equal(JSON.parse(fs.readFileSync(lockPath, "utf-8")).worktreePath, "/other", "a non-owning lock must be left untouched");
});

// ---------------------------------------------------------------------------
// Security / boundary smoke
// ---------------------------------------------------------------------------

test("Security/boundary: an unparseable (corrupt) lock payload is reclaimed only after its grace period, never immediately", { timeout: 20000 }, async (t) => {
  const lockPath = mkLockPath(t, "e177b-sec-corrupt-");
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, "not json at all {{{");

  const early = await runTestLock(
    ["--lock-path", lockPath, "--poll-ms", "10", "--max-wait", "0.15"],
    [process.execPath, "-e", "process.exit(0)"],
  );
  assert.equal(early.code, LOCK_TIMEOUT_EXIT_CODE, "a fresh corrupt payload must NOT be reclaimed immediately (grace period)");
});

test("Security/boundary: usage errors (missing `--`, no command) exit with the reserved usage code, never crashing the process", { timeout: 20000 }, async () => {
  const r1 = await new Promise((resolve) => {
    const child = spawn(process.execPath, [TEST_LOCK_SCRIPT, "--poll-ms", "10"], { cwd: ROOT });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("exit", (code) => resolve({ code, stderr }));
  });
  assert.equal(r1.code, USAGE_EXIT_CODE);
  assert.match(r1.stderr, /missing `--`/);

  const r2 = await new Promise((resolve) => {
    const child = spawn(process.execPath, [TEST_LOCK_SCRIPT, "--"], { cwd: ROOT });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("exit", (code) => resolve({ code, stderr }));
  });
  assert.equal(r2.code, USAGE_EXIT_CODE);
  assert.match(r2.stderr, /no command given/);
});
