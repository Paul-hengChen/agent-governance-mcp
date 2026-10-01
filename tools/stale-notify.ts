// Coded by @sr-engineer
// Push channel for the pull-only stale_dispatch advisory (E22): when it fires
// and `.current/.config.json` sets `staleDispatchNotifyFile`, the payload is
// written atomically to that watch-file for an external watcher to alert on.
// Key absent = disarmed; one emit per distinct (dispatched_at, role). Never
// throws, since it sits on the tw_get_state read path; failures become `error`.
// Why: specs/e260b-rationale.md (tools/stale-notify.ts)

import * as fs from "fs";
import * as path from "path";
import { getConfigError, loadConfig } from "./config.js";

// The v10 stale_dispatch advisory shape (tools/handoff.ts read-time
// computation). Declared here so both the emit and the handoff wiring share
// one typed contract instead of a Record<string, unknown> handshake.
export interface StaleDispatchAdvisory {
  role: string;
  dispatched_at: string;
  elapsed_minutes: number;
  threshold_minutes: number;
  message: string;
}

// Outcome of an ARMED emit attempt, surfaced verbatim under
// stale_dispatch.notify in the tw_get_state payload. Exactly one of the three
// shapes occurs: emitted, skipped duplicate, or loud error.
export interface StaleNotifyOutcome {
  emitted: boolean;
  // Absolute watch-file path (absent only when config itself was unreadable).
  path?: string;
  // true === a prior emit for this same (dispatched_at, role) already exists;
  // the watch-file was left untouched so watchers don't re-fire.
  skipped_duplicate?: boolean;
  // Non-empty === the emit failed loudly. The advisory itself still surfaces.
  error?: string;
}

/**
 * Emit the stale-dispatch advisory to the workspace's opt-in watch-file.
 * Returns null when the workspace has not armed `staleDispatchNotifyFile`
 * (the default — caller surfaces nothing). NEVER throws — see module header.
 */
export function notifyStaleDispatch(
  workspacePath: string,
  advisory: StaleDispatchAdvisory,
): StaleNotifyOutcome | null {
  // Corrupt/unreadable config: loadConfig falls back to defaults instead of
  // throwing, with the failure exposed via getConfigError(). This emit still
  // treats a broken config as a loud per-emit error (never disarmed-null
  // silence, never a throw), on top of the envelope-level `config_error`
  // the read path shows. (E31)
  const configError = getConfigError(workspacePath);
  if (configError) {
    return {
      emitted: false,
      error:
        `stale-notify: cannot read .current/.config.json — ` +
        `${configError} — notify emit skipped.`,
    };
  }
  const notifyRel = loadConfig(workspacePath).staleDispatchNotifyFile;
  if (!notifyRel) return null; // key absent = disarmed, no signal

  // path.resolve (not join) so an absolute configured path is honored as-is
  // while the documented workspace-relative form resolves under the
  // workspace. Config is workspace-owned (same trust boundary as taskPaths).
  const notifyPath = path.resolve(workspacePath, notifyRel);

  // Dedupe: one emit per distinct stale dispatch. Any read-back failure
  // (absent file, corrupt JSON, non-object) falls through to a fresh emit —
  // failing toward notification, never toward silence.
  try {
    const prior = JSON.parse(fs.readFileSync(notifyPath, "utf-8")) as unknown;
    if (
      prior !== null &&
      typeof prior === "object" &&
      !Array.isArray(prior) &&
      (prior as Record<string, unknown>).dispatched_at === advisory.dispatched_at &&
      (prior as Record<string, unknown>).role === advisory.role
    ) {
      return { emitted: false, path: notifyPath, skipped_duplicate: true };
    }
  } catch {
    /* absent or unreadable prior file — proceed to emit */
  }

  try {
    fs.mkdirSync(path.dirname(notifyPath), { recursive: true });
    const payload = {
      ...advisory,
      workspace: workspacePath,
      emitted_at: new Date().toISOString(),
    };
    // Atomic publish (tmp + rename): a watcher triggered by the rename never
    // observes a torn write.
    const tmpPath = `${notifyPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    fs.renameSync(tmpPath, notifyPath);
    return { emitted: true, path: notifyPath };
  } catch (err) {
    return {
      emitted: false,
      path: notifyPath,
      error:
        `stale-notify: failed to write ${notifyPath} — ` +
        `${(err as Error).message} — notify emit skipped.`,
    };
  }
}
