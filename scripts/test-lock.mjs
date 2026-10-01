#!/usr/bin/env node
// Coded by @sr-engineer
// Serializes full-suite runs across every worktree of one repo with one lock
// under `git rev-parse --git-common-dir` (macOS has no flock; E177b, E182).
//   node scripts/test-lock.mjs [--max-wait <s>] [--lock-path <p>] [--poll-ms <ms>]
//                              [--notify-interval <s>] -- <cmd> [args...]
// Staleness is holder-pid liveness only, never lock age; a nested run on the
// same lock skips acquiring. Details: see specs/e260c-bin-scripts.md.

import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export const LOCK_FILENAME = "agc-test.lock";
export const REENTRANT_ENV = "AGC_TEST_LOCK_HELD";
/** Reserved exit code for "lock-wait timeout" (EX_TEMPFAIL) — never a test failure. */
export const LOCK_TIMEOUT_EXIT_CODE = 75;
export const USAGE_EXIT_CODE = 64;
export const DEFAULT_NOTIFY_INTERVAL_MS = 30_000;
export const DEFAULT_POLL_MS = 250;
export const CORRUPT_GRACE_MS = 10_000;

const USAGE =
  "Usage: node scripts/test-lock.mjs [--max-wait <seconds>] [--lock-path <path>] [--poll-ms <ms>] [--notify-interval <seconds>] -- <cmd> [args...]";

/** true iff a process with this pid exists (EPERM = exists, other owner). */
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

/**
 * AC8 — the lock path for `cwd`: `<git-common-dir>/agc-test.lock`. Every
 * linked worktree of one primary resolves the same common dir, hence the
 * same lock. Returns null when `cwd` is not inside a git repo.
 */
export function resolveLockPath(cwd = process.cwd()) {
  let out;
  try {
    out = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    }).trim();
  } catch {
    return null;
  }
  if (!out) return null;
  const commonDir = path.resolve(cwd, out);
  let real = commonDir;
  try {
    real = fs.realpathSync(commonDir);
  } catch {
    /* keep the resolved path */
  }
  return path.join(real, LOCK_FILENAME);
}

/** AC13b — a holder is live while its wrapper pid OR its recorded child pid is alive. */
export function isHolderAlive(payload) {
  if (!payload || typeof payload !== "object") return false;
  return isPidAlive(payload.pid) || isPidAlive(payload.childPid);
}

/** The exact AC12 waiting line for a lock payload. */
export function formatWaitingLine(payload) {
  const pid = payload && Number.isInteger(payload.pid) ? payload.pid : "?";
  const worktree = payload && typeof payload.worktreePath === "string" ? payload.worktreePath : "unknown worktree";
  const since = payload && typeof payload.startedAt === "string" ? payload.startedAt : "unknown time";
  return `waiting for test lock held by pid ${pid} (${worktree}) since ${since}`;
}

/** Read + parse a lock file. { state: "absent" } | { state: "corrupt", raw, mtimeMs } | { state: "ok", raw, payload } */
export function readLock(lockPath) {
  let raw;
  try {
    raw = fs.readFileSync(lockPath, "utf-8");
  } catch (err) {
    if (err && err.code === "ENOENT") return { state: "absent" };
    throw err;
  }
  try {
    const payload = JSON.parse(raw);
    if (payload && typeof payload === "object" && Number.isInteger(payload.pid)) {
      return { state: "ok", raw, payload };
    }
  } catch {
    /* fall through */
  }
  let mtimeMs = Date.now();
  try {
    mtimeMs = fs.statSync(lockPath).mtimeMs;
  } catch {
    /* vanished — treat as fresh */
  }
  return { state: "corrupt", raw, mtimeMs };
}

/**
 * AC13a — remove the stale file at `targetPath` whose content we observed as
 * `observedRaw`, safe against any number of concurrent reclaimers: only the
 * winner of an O_EXCL guard named after that content's hash may unlink it, and
 * only while it still holds exactly that content. A dead or corrupt guard is
 * reclaimed the same way, one level down. Never throws. See specs/e260c-bin-scripts.md.
 */
export function reclaimStale(targetPath, observedRaw, depth = 0) {
  const digest = createHash("sha256").update(observedRaw).digest("hex").slice(0, 16);
  const guardPath = `${targetPath}.reclaim-${digest}`;
  let fd;
  try {
    fd = fs.openSync(guardPath, "wx");
  } catch (err) {
    if (err && err.code === "EEXIST" && depth < 2) {
      let guard = null;
      try {
        guard = readLock(guardPath);
      } catch {
        /* unreadable guard — leave it, retry later */
      }
      if (guard && guard.state === "ok" && !isPidAlive(guard.payload.pid)) {
        reclaimStale(guardPath, guard.raw, depth + 1);
      } else if (guard && guard.state === "corrupt" && Date.now() - guard.mtimeMs > CORRUPT_GRACE_MS) {
        reclaimStale(guardPath, guard.raw, depth + 1);
      }
    }
    return;
  }
  try {
    try {
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    } finally {
      fs.closeSync(fd);
    }
    let current = null;
    try {
      current = fs.readFileSync(targetPath, "utf-8");
    } catch {
      /* already gone */
    }
    if (current === observedRaw) fs.unlinkSync(targetPath);
  } catch {
    /* best effort — the acquire loop retries */
  } finally {
    try {
      fs.unlinkSync(guardPath);
    } catch {
      /* ignore */
    }
  }
}

/**
 * AC13b — record the wrapped command's pid in the lock we hold (atomic
 * tmp + rename over our own lock file; only when the lock still names us).
 * Returns the payload written, or null if the lock is no longer ours.
 */
export function recordChildPid(lockPath, childPid, pid = process.pid) {
  if (!Number.isInteger(childPid) || childPid <= 0) return null;
  try {
    const lock = readLock(lockPath);
    if (lock.state !== "ok" || lock.payload.pid !== pid) return null;
    const payload = { ...lock.payload, childPid };
    const tmp = `${lockPath}.tmp-${pid}`;
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, lockPath);
    return payload;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Acquire the lock (AC7, AC10-AC13). Resolves `{ acquired: true, payload }`
 * or `{ acquired: false, reason: "timeout", holder }` when `maxWaitMs`
 * elapses. Never gives up without `maxWaitMs`.
 */
export async function acquireLock({
  lockPath,
  worktreePath = process.cwd(),
  maxWaitMs = null,
  pollMs = DEFAULT_POLL_MS,
  notifyIntervalMs = DEFAULT_NOTIFY_INTERVAL_MS,
  log = (line) => process.stderr.write(`${line}\n`),
  now = () => Date.now(),
}) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const start = now();
  let lastNotifyAt = null;
  let lastNotifiedPid = null;
  let holder = null;
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      const t = now();
      const payload = {
        pid: process.pid,
        acquiredAt: t,
        worktreePath,
        startedAt: new Date(t).toISOString(),
      };
      try {
        fs.writeSync(fd, JSON.stringify(payload));
        try {
          fs.fsyncSync(fd);
        } catch {
          /* fsync unsupported on some FS */
        }
      } finally {
        fs.closeSync(fd);
      }
      return { acquired: true, payload };
    } catch (err) {
      if (!err || err.code !== "EEXIST") throw err;
    }

    const lock = readLock(lockPath);
    if (lock.state === "absent") continue; // released between open and read
    if (lock.state === "ok") {
      holder = lock.payload;
      if (!isHolderAlive(lock.payload)) {
        // AC10 — dead holder (wrapper AND recorded child, AC13b): reclaim
        // regardless of age. Serialized per incarnation (AC13a).
        log(`test-lock: reclaiming stale lock from dead pid ${lock.payload.pid}`);
        reclaimStale(lockPath, lock.raw);
        continue;
      }
      // AC11 — live holder: held, however old acquiredAt is.
    } else if (now() - lock.mtimeMs > CORRUPT_GRACE_MS) {
      log("test-lock: reclaiming lock with unparseable payload");
      reclaimStale(lockPath, lock.raw);
      continue;
    }

    const t = now();
    const holderPid = holder ? holder.pid : null;
    if (lastNotifyAt === null || holderPid !== lastNotifiedPid || t - lastNotifyAt >= notifyIntervalMs) {
      log(formatWaitingLine(holder));
      lastNotifyAt = t;
      lastNotifiedPid = holderPid;
    }
    if (maxWaitMs !== null && t - start >= maxWaitMs) {
      return { acquired: false, reason: "timeout", holder };
    }
    const remaining = maxWaitMs === null ? pollMs : Math.max(1, Math.min(pollMs, maxWaitMs - (t - start)));
    await sleep(remaining);
  }
}

/** Release iff the lock file still names `pid` as holder. */
export function releaseLock(lockPath, pid = process.pid) {
  try {
    const lock = readLock(lockPath);
    if (lock.state === "ok" && lock.payload.pid === pid) fs.unlinkSync(lockPath);
  } catch {
    /* best effort */
  }
}

/** Parse argv (without node + script). Throws Error on misuse. */
export function parseTestLockArgs(argv) {
  const sep = argv.indexOf("--");
  if (sep === -1) throw new Error("missing `--` before the command to run");
  const opts = argv.slice(0, sep);
  const command = argv.slice(sep + 1);
  if (command.length === 0) throw new Error("no command given after `--`");
  const out = {
    maxWaitMs: null,
    lockPath: null,
    pollMs: DEFAULT_POLL_MS,
    notifyIntervalMs: DEFAULT_NOTIFY_INTERVAL_MS,
    command,
  };
  const num = (flag, v) => {
    const n = Number(v);
    if (v === undefined || !Number.isFinite(n) || n < 0) throw new Error(`${flag} requires a non-negative number`);
    return n;
  };
  for (let i = 0; i < opts.length; i++) {
    const a = opts[i];
    const v = opts[i + 1];
    if (a === "--max-wait") out.maxWaitMs = num(a, v) * 1000;
    else if (a === "--poll-ms") out.pollMs = Math.max(10, num(a, v));
    else if (a === "--notify-interval") out.notifyIntervalMs = num(a, v) * 1000;
    else if (a === "--lock-path") {
      if (!v) throw new Error("--lock-path requires a value");
      out.lockPath = path.resolve(v);
    } else throw new Error(`unknown option: ${a}`);
    i++;
  }
  return out;
}

function runCommand(command, env, onSpawn = null) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { stdio: "inherit", env });
    if (onSpawn && Number.isInteger(child.pid)) onSpawn(child.pid);
    const forward = (sig) => {
      try {
        child.kill(sig);
      } catch {
        /* ignore */
      }
    };
    const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
    for (const s of signals) process.on(s, forward);
    const done = (code) => {
      for (const s of signals) process.off(s, forward);
      resolve(code);
    };
    child.on("error", (err) => {
      process.stderr.write(`test-lock: failed to start ${command[0]}: ${err.message}\n`);
      done(127);
    });
    child.on("exit", (code, signal) => {
      if (code !== null) done(code);
      else done(128 + (signal === "SIGINT" ? 2 : signal === "SIGHUP" ? 1 : signal === "SIGKILL" ? 9 : 15));
    });
  });
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseTestLockArgs(argv);
  } catch (err) {
    process.stderr.write(`test-lock: ${err.message}\n${USAGE}\n`);
    return USAGE_EXIT_CODE;
  }
  const lockPath = args.lockPath ?? resolveLockPath(process.cwd());
  if (lockPath === null) {
    process.stderr.write("test-lock: not inside a git repository — running without the test lock\n");
    return runCommand(args.command, process.env);
  }
  // AC9 — re-entrant: our own ancestor holds this exact lock.
  if (process.env[REENTRANT_ENV] === lockPath) {
    return runCommand(args.command, process.env);
  }

  const result = await acquireLock({
    lockPath,
    worktreePath: process.cwd(),
    maxWaitMs: args.maxWaitMs,
    pollMs: args.pollMs,
    notifyIntervalMs: args.notifyIntervalMs,
  });
  if (!result.acquired) {
    const holder = result.holder;
    process.stderr.write(
      `test-lock: LOCK-WAIT TIMEOUT after ${args.maxWaitMs / 1000}s — the test lock is still held by pid ${
        holder ? holder.pid : "?"
      } (${holder && holder.worktreePath ? holder.worktreePath : "unknown worktree"}). This is a lock-wait timeout, NOT a test failure; the wrapped command never ran. Exit ${LOCK_TIMEOUT_EXIT_CODE}.\n`,
    );
    return LOCK_TIMEOUT_EXIT_CODE;
  }

  const release = () => releaseLock(lockPath);
  process.on("exit", release);
  try {
    return await runCommand(args.command, { ...process.env, [REENTRANT_ENV]: lockPath }, (childPid) =>
      recordChildPid(lockPath, childPid),
    );
  } finally {
    release();
    process.off("exit", release);
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`test-lock: ${err && err.stack ? err.stack : err}\n`);
      process.exitCode = 1;
    },
  );
}
