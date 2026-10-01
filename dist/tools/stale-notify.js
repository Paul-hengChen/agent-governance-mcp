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
/**
 * Emit the stale-dispatch advisory to the workspace's opt-in watch-file.
 * Returns null when the workspace has not armed `staleDispatchNotifyFile`
 * (the default — caller surfaces nothing). NEVER throws — see module header.
 */
export function notifyStaleDispatch(workspacePath, advisory) {
    // Corrupt/unreadable config: loadConfig falls back to defaults instead of
    // throwing, with the failure exposed via getConfigError(). This emit still
    // treats a broken config as a loud per-emit error (never disarmed-null
    // silence, never a throw), on top of the envelope-level `config_error`
    // the read path shows. (E31)
    const configError = getConfigError(workspacePath);
    if (configError) {
        return {
            emitted: false,
            error: `stale-notify: cannot read .current/.config.json — ` +
                `${configError} — notify emit skipped.`,
        };
    }
    const notifyRel = loadConfig(workspacePath).staleDispatchNotifyFile;
    if (!notifyRel)
        return null; // key absent = disarmed, no signal
    // path.resolve (not join) so an absolute configured path is honored as-is
    // while the documented workspace-relative form resolves under the
    // workspace. Config is workspace-owned (same trust boundary as taskPaths).
    const notifyPath = path.resolve(workspacePath, notifyRel);
    // Dedupe: one emit per distinct stale dispatch. Any read-back failure
    // (absent file, corrupt JSON, non-object) falls through to a fresh emit —
    // failing toward notification, never toward silence.
    try {
        const prior = JSON.parse(fs.readFileSync(notifyPath, "utf-8"));
        if (prior !== null &&
            typeof prior === "object" &&
            !Array.isArray(prior) &&
            prior.dispatched_at === advisory.dispatched_at &&
            prior.role === advisory.role) {
            return { emitted: false, path: notifyPath, skipped_duplicate: true };
        }
    }
    catch {
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
    }
    catch (err) {
        return {
            emitted: false,
            path: notifyPath,
            error: `stale-notify: failed to write ${notifyPath} — ` +
                `${err.message} — notify emit skipped.`,
        };
    }
}
//# sourceMappingURL=stale-notify.js.map