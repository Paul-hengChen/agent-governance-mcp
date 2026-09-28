#!/usr/bin/env node
// Coded by @sr-engineer
// scripts/test-lock.mjs — serialize full-suite `npm test` runs across every
// worktree of one repo (E177b T-E177B-04, spec AC7-AC13; backlog E182).
//
// Wave 5: concurrent lanes' full-suite runs starved each other and flaked.
// macOS has no `flock`, so this wraps a command in a repo-scoped lock:
//
//   node scripts/test-lock.mjs [--max-wait <s>] [--lock-path <p>] [--poll-ms <ms>]
//                              [--notify-interval <s>] -- <cmd> [args...]
//
// Lock scope (AC8): ONE lock file under `git rev-parse --git-common-dir`, so
// every linked worktree of the same primary contends for the same file —
// never a per-worktree lock. Not a machine-global lock (spec Out of Scope).
//
// Acquire loop (AC10/AC11, R1): its OWN O_EXCL loop (`fs.openSync(p, "wx")`),
// deliberately NOT guards/file-lock.ts — that module treats a lock older than
// 30s as stale even with a live holder and throws after 10s, both wrong for
// a multi-minute suite. Here staleness is decided ONLY by holder-PID
// liveness (`process.kill(pid, 0)`), never by the lock's age. The single
// exception is an UNPARSEABLE payload (a holder that died between create and
// write): it is reclaimed once its mtime is older than CORRUPT_GRACE_MS,
// because a live holder writes its payload immediately after creating.
//
// Holder liveness (AC13b): once the wrapped command is spawned, the payload
// is rewritten to carry its `childPid` too, and the lock is held while EITHER
// pid is alive — a SIGKILLed wrapper (no cleanup runs) whose child is still
// running is never treated as a dead holder.
//
// Reclaim (AC13a): removing a stale lock is serialized per stale incarnation
// behind an O_EXCL guard file `<lock>.reclaim-<hash of the stale content>`.
// Only the guard's winner may unlink the lock, and only after re-reading it
// and finding that exact stale content — so with any number of waiters there
// is no window in which two of them both believe they hold the lock (see
// reclaimStale).
//
// Waiting (AC12): prints `waiting for test lock held by pid <p> (<worktree>)
// since <t>` on entering the wait and every --notify-interval seconds
// (default 30) while queued. No --max-wait = wait forever (queue, never
// throw). With --max-wait, a timeout exits LOCK_TIMEOUT_EXIT_CODE (AC13).
//
// Re-entrancy (AC9): the holder exports AGC_TEST_LOCK_HELD=<lock path> to the
// wrapped command. A nested invocation that resolves the SAME lock path runs
// its command directly without acquiring — no self-deadlock. A nested
// invocation that resolves a DIFFERENT lock path (e.g. a test using
// --lock-path in a temp dir, or a fixture repo) locks normally, so tests that
// exercise this script from inside `npm test` still see real locking.
//
// Pure node, no shell: the wrapped command is spawned with an argv array.

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
 * `observedRaw`, safely against any number of concurrent reclaimers.
 *
 * Reclaimers of one stale incarnation contend on an O_EXCL guard file named
 * after a hash of that content. Invariant: a given lock content can leave the
 * lock path only by (a) its own holder releasing it (that holder is dead
 * here), or (b) the current winner of its guard. So the winner re-reads the
 * lock and, if it still holds exactly `observedRaw`, unlinks it — no other
 * process can have replaced it between that read and the unlink (a new lock
 * can only be CREATED once the path is absent). A loser simply returns and
 * the caller's acquire loop retries. The winner removes its guard afterwards;
 * a late reclaimer of the same incarnation that wins the guard then finds
 * different (or no) content and unlinks nothing.
 *
 * A guard whose own creator died mid-reclaim (SIGKILL in a microsecond
 * window) would wedge that incarnation forever, so a dead-pid guard (or an
 * unparseable one past CORRUPT_GRACE_MS) is reclaimed with this same
 * function, one level down. Never throws.
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
