// Coded by @sr-engineer
// Tool: drift detection — compare handoff state vs task list.
// Reads both sides through the active storage adapter so SQLite/HTTP mode works
// without any filesystem access to the workspace.
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { getActiveStorage } from "./storage.js";
import { findTasksFile } from "./config.js";
import { CURRENT_VERSIONS, peekVersion } from "../schema/versions.js";
function partitionTasks(tasks) {
    const completed = [];
    const incomplete = [];
    for (const t of tasks) {
        if (t.completed)
            completed.push(t.id);
        else
            incomplete.push(t.id);
    }
    return { completed, incomplete };
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Long task-history projects produce dozens of identical-shape drift lines
// ("Task list shows TNN completed, but handoff state doesn't mention it").
// Collapse those into a single summary so the report stays readable; other
// reasons are passed through verbatim.
function compressDriftDetails(details) {
    const VIBE_RE = /^Task list shows (\S+) completed, but handoff state doesn't mention it\. Possible vibe-coding drift\.$/;
    const HANDOFF_AHEAD_RE = /^Handoff says (\S+) completed, but task list shows it as incomplete\.$/;
    const vibeIds = [];
    const handoffAheadIds = [];
    const passthrough = [];
    for (const d of details) {
        const v = d.match(VIBE_RE);
        if (v) {
            vibeIds.push(v[1]);
            continue;
        }
        const h = d.match(HANDOFF_AHEAD_RE);
        if (h) {
            handoffAheadIds.push(h[1]);
            continue;
        }
        passthrough.push(d);
    }
    const out = [];
    if (vibeIds.length === 1) {
        out.push(`Task list shows ${vibeIds[0]} completed, but handoff state doesn't mention it. Possible vibe-coding drift.`);
    }
    else if (vibeIds.length > 1) {
        out.push(`Task list shows ${vibeIds.length} task(s) completed (${vibeIds.join(", ")}) that handoff state doesn't mention. Possible vibe-coding drift.`);
    }
    if (handoffAheadIds.length === 1) {
        out.push(`Handoff says ${handoffAheadIds[0]} completed, but task list shows it as incomplete.`);
    }
    else if (handoffAheadIds.length > 1) {
        out.push(`Handoff says ${handoffAheadIds.length} task(s) completed (${handoffAheadIds.join(", ")}) that task list shows as incomplete.`);
    }
    out.push(...passthrough);
    return out;
}
// Read the raw on-disk schema_version for a file-backed artifact, bypassing
// the lazy-migrate readers (which always return CURRENT in memory). Returns
// null when the artifact is absent — typical in SQLite mode, where these
// files don't exist and version skew is enforced refuse-loud at DB boot
// inside runSqliteMigrations() instead.
function readArtifactVersion(workspacePath, kind) {
    try {
        if (kind === "handoff") {
            const p = path.join(workspacePath, ".current", "handoff.md");
            if (!fs.existsSync(p))
                return null;
            const content = fs.readFileSync(p, "utf-8");
            const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (!match)
                return 0;
            const parsed = yaml.load(match[1]);
            return peekVersion(parsed);
        }
        if (kind === "tasks") {
            const tasksPath = findTasksFile(workspacePath);
            if (!tasksPath)
                return null;
            const raw = fs.readFileSync(tasksPath, "utf-8");
            const sentinel = raw.match(/^<!--\s*schema_version:\s*(\d+)\s*-->/);
            if (!sentinel)
                return 0;
            const v = Number(sentinel[1]);
            return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
        }
        if (kind === "config") {
            const p = path.join(workspacePath, ".current", ".config.json");
            if (!fs.existsSync(p))
                return null;
            const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
            return peekVersion(parsed);
        }
        return null;
    }
    catch {
        // Unreadable / unparsable artifact: don't fabricate a drift reason here;
        // the primary reader will surface a clearer error on the next call.
        return null;
    }
}
// Report any artifact whose on-disk schema_version is GREATER than the
// server's current. Stale (< CURRENT) artifacts are NOT reported: lazy
// migrate-on-read heals them before they ever reach drift detection
// (per specs/schema-versioning-architecture.md, AC-6).
function checkVersionSkew(workspacePath) {
    const drifts = [];
    for (const kind of ["handoff", "tasks", "config"]) {
        const onDisk = readArtifactVersion(workspacePath, kind);
        if (onDisk === null)
            continue;
        const target = CURRENT_VERSIONS[kind];
        if (onDisk > target) {
            drifts.push(`Schema version skew: ${kind} on-disk v${onDisk} > server max v${target}. ` +
                `Workspace was written by a newer server. Upgrade or migrate manually.`);
        }
    }
    return drifts;
}
export function detectDrift(workspacePath) {
    // First-class version-skew check (Phase 4 AC-6). Runs BEFORE storage.parse
    // and storage.listTasks because those would themselves refuse-loud on a
    // future on-disk version, masking the underlying cause. Returning early
    // here turns "the parser threw" into "the drift report explains why".
    const skewDrifts = checkVersionSkew(workspacePath);
    if (skewDrifts.length > 0) {
        return JSON.stringify({
            driftDetected: true,
            details: skewDrifts,
            handoffLastTask: "",
            tasksCompleted: [],
            tasksIncomplete: [],
        });
    }
    const storage = getActiveStorage();
    const handoff = storage.parse(workspacePath);
    const tasks = storage.listTasks(workspacePath);
    if (!handoff && !tasks) {
        return JSON.stringify({
            driftDetected: false,
            details: ["No handoff state or task list found. Fresh project."],
            handoffLastTask: "",
            tasksCompleted: [],
            tasksIncomplete: [],
        });
    }
    if (!handoff) {
        return JSON.stringify({
            driftDetected: true,
            details: ["Task list exists but handoff state is missing. State was never initialized."],
            handoffLastTask: "",
            tasksCompleted: [],
            tasksIncomplete: [],
        });
    }
    if (!tasks) {
        return JSON.stringify({
            driftDetected: false,
            details: ["Handoff state exists but no task list found. Likely vibe-coding only mode."],
            handoffLastTask: handoff.active_feature,
            tasksCompleted: handoff.completed_tasks,
            tasksIncomplete: [],
        });
    }
    const { completed: completedTasks, incomplete: incompleteTasks } = partitionTasks(tasks);
    const drifts = [];
    // Pre-compile one regex per known task ID so handoff-string scanning stays O(handoff × matches)
    // instead of recompiling on every iteration.
    const idVocab = new Set([...completedTasks, ...incompleteTasks]);
    const idPatterns = new Map();
    for (const id of idVocab) {
        idPatterns.set(id, new RegExp(`\\b${escapeRegExp(id)}\\b`));
    }
    const handoffTaskIds = handoff.completed_tasks.flatMap((c) => [...idPatterns].filter(([, re]) => re.test(c)).map(([id]) => id));
    for (const taskId of handoffTaskIds) {
        if (!completedTasks.includes(taskId)) {
            drifts.push(`Handoff says ${taskId} completed, but task list shows it as incomplete.`);
        }
    }
    for (const taskId of completedTasks) {
        if (!handoffTaskIds.includes(taskId)) {
            drifts.push(`Task list shows ${taskId} completed, but handoff state doesn't mention it. Possible vibe-coding drift.`);
        }
    }
    if (handoff.status === "FAIL" || handoff.status === "Blocked") {
        if (incompleteTasks.length > 0) {
            drifts.push(`Handoff status is ${handoff.status}, but ${incompleteTasks.length} tasks remain incomplete.`);
        }
    }
    const report = {
        driftDetected: drifts.length > 0,
        details: drifts.length > 0 ? compressDriftDetails(drifts) : ["No drift detected. Handoff and tasks are synchronized."],
        handoffLastTask: handoff.active_feature,
        tasksCompleted: completedTasks,
        tasksIncomplete: incompleteTasks,
    };
    return JSON.stringify(report);
}
//# sourceMappingURL=drift.js.map