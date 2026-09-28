// Coded by @sr-engineer
// Stale-dispatch notify emit (E22, D5 follow-on / 104447-F0 A3).
//
// The v10 stale_dispatch advisory (tools/handoff.ts) is pull-only: computed at
// tw_get_state time, so nobody sees it until the next session reads state —
// the retro's 1h55m idle window went entirely unnoticed. This module adds the
// cheapest push channel: when the advisory fires AND the workspace has opted
// in via `.current/.config.json`:
//
//   { "staleDispatchNotifyFile": ".current/stale-dispatch.notify" }
//
// the server writes the advisory payload to that watch-file. An EXTERNAL
// watcher (fswatch / inotifywait / launchd → desktop notification, webhook,
// anything) turns the mtime bump into a human-visible alert — the server
// itself spawns no daemon, no timer thread, and owns no delivery mechanism
// (E22 cut: watch-file emit ONLY).
//
// Semantics:
//   - Key absent (the default) → fully disarmed, null return, zero behavior
//     change. Opt-in per workspace, the E24 exemptions / E5 auto-tier posture.
//   - One emit per distinct stale dispatch: before writing, the prior file
//     content is read back and the emit is SKIPPED when its
//     (dispatched_at, role) pair matches the current advisory — a watcher
//     fires once per threshold crossing, not on every subsequent
//     tw_get_state of the same stale window. The watch-file itself carries
//     this dedupe cursor; no new handoff state (E22 cut constraint).
//     A new dispatch (fresh dispatched_at stamp) re-arms naturally.
//   - Payload: the advisory fields + workspace + emitted_at, pretty-printed
//     JSON. Published atomically (tmp + rename, the atomicWriteConfig
//     convention) so a watcher never reads a torn file. NOT schema-versioned:
//     this is a transient signal file, not persisted governance state.
//
// Never throws (the tools/exemptions.ts posture): this sits on the
// tw_get_state read path — the mandatory first action of every role in every
// session. Every failure mode (unreadable config, unwritable path, corrupt
// prior file) collapses to a loud `error` string in the returned outcome,
// which the caller surfaces inside the stale_dispatch payload itself — never
// a throw, never a blocked read. File-mode read path only, matching the
// sibling E10/E18/E24 file-mode posture.
import * as fs from "fs";
import * as path from "path";
import { getConfigError, loadConfig } from "./config.js";
/**
 * Emit the stale-dispatch advisory to the workspace's opt-in watch-file.
 * Returns null when the workspace has not armed `staleDispatchNotifyFile`
 * (the default — caller surfaces nothing). NEVER throws — see module header.
 */
export function notifyStaleDispatch(workspacePath, advisory) {
    // Corrupt/unreadable config: since E31 loadConfig degrades to defaults
    // instead of throwing, with the failure exposed via getConfigError(). Keep
    // the E22 contract here — a broken config collapses to a loud per-emit
    // error (never disarmed-null silence, never a throw), on top of the
    // envelope-level `config_error` the read path now surfaces.
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