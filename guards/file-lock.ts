// Cross-process file lock. Uses O_EXCL to atomically create a lockfile, with
// PID-liveness + stale-mtime fallback so a crashed holder doesn't deadlock
// future writers.

import * as fs from "fs";
import * as path from "path";

const LOCK_RETRY_MS = 50;
const LOCK_MAX_WAIT_MS = 10_000;
const LOCK_STALE_MS = 30_000;

interface LockPayload {
  pid: number;
  acquiredAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = process exists but owned by another user
    // ESRCH = no such process
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function looksStale(lockPath: string): boolean {
  try {
    const raw = fs.readFileSync(lockPath, "utf-8");
    const data = JSON.parse(raw) as Partial<LockPayload>;
    if (typeof data.acquiredAt === "number" && Date.now() - data.acquiredAt > LOCK_STALE_MS) {
      return true;
    }
    if (typeof data.pid === "number" && !isAlive(data.pid)) {
      return true;
    }
    return false;
  } catch {
    // Corrupted payload — fall back to mtime
    try {
      const stat = fs.statSync(lockPath);
      return Date.now() - stat.mtimeMs > LOCK_STALE_MS;
    } catch {
      return false;
    }
  }
}

export async function withFileLock<T>(
  lockPath: string,
  fn: () => Promise<T> | T
): Promise<T> {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  const start = Date.now();
  let fd: number | null = null;

  while (true) {
    try {
      fd = fs.openSync(lockPath, "wx");
      const payload: LockPayload = { pid: process.pid, acquiredAt: Date.now() };
      fs.writeSync(fd, JSON.stringify(payload));
      try {
        fs.fsyncSync(fd);
      } catch {
        /* fsync may not be supported on some FS; ignore */
      }
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;

      if (looksStale(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          /* another process beat us to it — retry */
        }
        continue;
      }

      if (Date.now() - start > LOCK_MAX_WAIT_MS) {
        throw new Error(
          `Could not acquire lock at ${lockPath} within ${LOCK_MAX_WAIT_MS}ms — ` +
            `another process is holding it. If that process has crashed, delete the ` +
            `lockfile manually.`
        );
      }
      await sleep(LOCK_RETRY_MS);
    }
  }

  try {
    return await fn();
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
}
