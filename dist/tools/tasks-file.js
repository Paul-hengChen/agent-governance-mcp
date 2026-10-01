// Coded by @sr-engineer
// File-system implementation of task-list operations.
// Consumed by FileHandoffStorage. Stays format-agnostic via .current/.config.json
// override of taskPattern / taskPaths.
import * as fs from "fs";
import * as path from "path";
import { verifyFreshness, refreshSnapshotFor } from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";
import { findTasksFile, resolveTaskRegex } from "./config.js";
import { LEGACY_LANE, PRIMARY_LANE, hasHistoryLedger, resolveCurrentLanePaths, resolveLaneName } from "./lane-paths.js";
import { SECTION_HEADING_RE, ensureTasksMigrated, ensureTasksMigratedLocked, resolveTasksLedgerPath, tasksLaneAdvisory, } from "./tasks-lane-migrate.js";
import { parseHandoff } from "./handoff-parse.js";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
import "../schema/migrations-tasks.js";
// Leading HTML comment that carries the on-disk schema_version for tasks.md.
// Must be line 1. Re-emitted by atomicWrite on every mutation so the file
// heals on the first write after a server upgrade.
const SENTINEL_RE = /^<!--\s*schema_version:\s*(\d+)\s*-->\s*\r?\n/;
function stripSentinel(content) {
    const match = content.match(SENTINEL_RE);
    if (!match)
        return { body: content };
    const version = Number(match[1]);
    if (!Number.isFinite(version))
        return { body: content };
    return { version: Math.floor(version), body: content.slice(match[0].length) };
}
// A v2+ file at a legacy path means "index", so a legacy-path LEDGER (used
// when the lane path is git-ignored) is kept at v1. Only a lane ledger
// `.current/<lane>/tasks.md` is stamped CURRENT. (E125a)
const LEGACY_LEDGER_VERSION = 1;
function sentinelVersionFor(filePath) {
    const isLaneLedger = path.basename(path.dirname(path.dirname(filePath))) === ".current";
    return isLaneLedger ? CURRENT_VERSIONS.tasks : LEGACY_LEDGER_VERSION;
}
function prependSentinel(body, version) {
    return `<!-- schema_version: ${version} -->\n${body}`;
}
function parseTaskLine(line, section, regex) {
    const match = line.match(regex);
    if (!match || match[1] === undefined || match[2] === undefined)
        return null;
    const description = match.slice(3).filter(Boolean).join(" ").trim();
    return {
        id: match[2],
        completed: match[1] === "x",
        description: description || match[2],
        section,
    };
}
// Parser-side half of the line-terminator defence (containsLineBreak below is
// the input-boundary half, which a hand-edited tasks.md never passes through).
// FORBIDDEN_TERMINATOR_RE finds the JS-only terminators U+2028/U+2029;
// TASK_LINE_SHAPE_RE loosely recognises a checkbox row without reaching `$`.
// Covers the DEFAULT_TASK_REGEX row shape only; a custom taskPattern relies on
// the input-boundary guard. Why: specs/e260b-rationale.md (tools/tasks-file.ts)
const FORBIDDEN_TERMINATOR_RE = /[\u2028\u2029]/;
// The checkbox class deliberately excludes `-` (the void marker). A voided
// row is unparseable BY DESIGN — voidTaskInFile's doc comment says it
// disappears from every default-shaped reader on purpose — so this shape
// check must not mistake a voided row for terminator corruption. Only an
// open `[ ]` or completed `[x]` row triggers the throw below. (E131)
const TASK_LINE_SHAPE_RE = /^- \[[ x]\]\s+\S/;
// The ledger is ONLY the current lane's `.current/<lane>/tasks.md`. A legacy
// root file is never a read fallback — except in a workspace whose lane path
// is git-ignored, where the legacy file stays the ledger
// (resolveTasksLedgerPath). (E125a)
function laneTasksPathOf(workspacePath) {
    return resolveCurrentLanePaths(workspacePath).tasksPath;
}
function ledgerPathOf(workspacePath) {
    return resolveTasksLedgerPath(workspacePath, laneTasksPathOf(workspacePath));
}
// True iff `section` belongs to ANOTHER lane that has its own live ledger —
// the sibling `.current/<thatLane>/<same filename>` of the `_primary` ledger
// at `primaryTasksPath`. Such a section in `_primary`'s ledger is a stale
// copy left from before the split and is excluded from every read. (E125a)
function makeForeignCheck(primaryTasksPath) {
    const seen = new Map();
    const lanesDir = path.dirname(path.dirname(primaryTasksPath));
    return (section) => {
        const lane = resolveLaneName(section);
        if (lane === LEGACY_LANE)
            return false;
        let foreign = seen.get(lane);
        if (foreign === undefined) {
            const filename = path.basename(primaryTasksPath);
            // A lane whose ledger was closed into .current/history/ is foreign too. (E125b)
            foreign =
                fs.existsSync(path.join(lanesDir, lane, filename)) ||
                    hasHistoryLedger(path.dirname(lanesDir), lane, filename);
            seen.set(lane, foreign);
        }
        return foreign;
    };
}
function isPrimaryLedger(laneTasksPath) {
    return path.basename(path.dirname(laneTasksPath)) === PRIMARY_LANE;
}
// Swallows every verifyFreshness error on purpose: it gates ONLY the
// snapshot carry below, never a write.
function isFresh(workspacePath, filePath) {
    try {
        verifyFreshness(workspacePath, filePath, "tasks");
        return true;
    }
    catch {
        return false;
    }
}
// A forward migration THIS call performed (the migrate functions report it)
// is the session's own write. When the session snapshot was fresh against
// the pre-migration file, carry it over to the new lane ledger so the next
// mutation does not trip STATE DRIFT on the path switch. (E125a)
function carrySnapshot(workspacePath, laneTasksPath, migrated, wasFresh) {
    if (migrated && wasFresh)
        refreshSnapshotFor(workspacePath, laneTasksPath, "tasks");
}
// Read-path trigger (architecture "Migration Trigger Site"): self-acquiring
// migration; TasksMigrationBusyError propagates (D14) — never an empty list.
function migrateForRead(workspacePath) {
    const laneTasksPath = laneTasksPathOf(workspacePath);
    if (fs.existsSync(laneTasksPath))
        return;
    const pre = findTasksFile(workspacePath);
    const wasFresh = pre !== null && isFresh(workspacePath, pre);
    carrySnapshot(workspacePath, laneTasksPath, ensureTasksMigrated(workspacePath), wasFresh);
}
// Mutator trigger: the caller holds `${laneTasksPath}.lock`. Freshness is
// verified against the pre-migration path the session snapshotted, THEN the
// locked migration core runs (lock order D4: lane outer, legacy inner).
function migrateForWrite(workspacePath, laneTasksPath, pre) {
    if (pre)
        verifyFreshness(workspacePath, pre, "tasks");
    carrySnapshot(workspacePath, laneTasksPath, ensureTasksMigratedLocked(workspacePath, laneTasksPath), true);
}
function parseTasks(workspacePath) {
    const filePath = ledgerPathOf(workspacePath);
    if (!fs.existsSync(filePath))
        return null;
    const isForeign = isPrimaryLedger(filePath) ? makeForeignCheck(filePath) : () => false;
    const regex = resolveTaskRegex(workspacePath);
    const rawContent = fs.readFileSync(filePath, "utf-8");
    // Strip the leading version sentinel (if any), then run schema migrations
    // on the envelope. Lazy migrate-on-read (Phase 4) — throws refuse-loud when
    // the on-disk version exceeds CURRENT_VERSIONS.tasks.
    const stripped = stripSentinel(rawContent);
    const migration = runMigrations("tasks", {
        schema_version: stripped.version,
        body: stripped.body,
    });
    const migratedBody = migration.payload.body;
    const migrationApplied = (stripped.version ?? 0) < sentinelVersionFor(filePath);
    const lines = migratedBody.split("\n");
    const tasks = [];
    let currentSection = "Unknown";
    let foreignSection = false;
    for (const line of lines) {
        const sectionMatch = line.match(SECTION_HEADING_RE);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            foreignSection = isForeign(currentSection);
            continue;
        }
        if (foreignSection)
            continue; // D12: owned by another lane's live ledger
        const trimmedLine = line.trim();
        const task = parseTaskLine(trimmedLine, currentSection, regex);
        if (task) {
            tasks.push(task);
            continue;
        }
        // Fail loud: a checkbox-shaped row carrying U+2028/U+2029 is on disk but
        // the strict regex cannot match it, so it would vanish from every reader
        // (getNextTask, tw_detect_drift, tw_sync) with no signal. Ordinary
        // strict-parse misses (blank lines, prose) stay silently skipped. (E131)
        if (FORBIDDEN_TERMINATOR_RE.test(trimmedLine) && TASK_LINE_SHAPE_RE.test(trimmedLine)) {
            throw new Error(`tasks.md is corrupted: an open or completed checkbox task row contains a U+2028 ` +
                `(LINE SEPARATOR) or U+2029 (PARAGRAPH SEPARATOR) character. JavaScript treats these ` +
                `as line terminators even though this file's own line-splitting does not, so the row ` +
                `is physically on disk but cannot be parsed as a task — for a live row like this one ` +
                `(unlike a voided row, which is meant to disappear from readers), that would otherwise ` +
                `happen silently, in every reader of this file (tw_get_next_task, tw_detect_drift, ` +
                `tw_sync). Edit the row by hand to remove the character(s) and re-run. Raw line: ` +
                `${JSON.stringify(trimmedLine)}`);
        }
    }
    return { tasks, filePath, migratedBody, migrationApplied };
}
export function parseTasksFromFile(workspacePath) {
    migrateForRead(workspacePath);
    const result = parseTasks(workspacePath);
    return result ? result.tasks : null;
}
export function getNextTaskFromFile(workspacePath) {
    migrateForRead(workspacePath);
    const result = parseTasks(workspacePath);
    if (!result) {
        return JSON.stringify({ error: "No task list file found in workspace." });
    }
    // Heal-on-read for tasks.md: if the schema migration upgraded the in-memory
    // body, persist the upgraded file with sentinel via atomicWrite. Best-effort
    // (synchronous; failures here surface as a thrown error rather than fire-
    // and-forget because we have no file lock here and atomicWrite is sync).
    if (result.migrationApplied) {
        try {
            atomicWrite(result.filePath, result.migratedBody);
        }
        catch {
            /* swallowed — in-memory tasks already at CURRENT for the caller */
        }
    }
    // Option A (AC4b): the one-line ignored-lane advisory, when it applies.
    const note = tasksLaneAdvisory(workspacePath);
    const advisory = note ? { advisory: note } : {};
    const next = result.tasks.find((t) => !t.completed);
    if (!next) {
        return JSON.stringify({ allComplete: true, totalTasks: result.tasks.length, ...advisory });
    }
    const currentIdx = result.tasks.indexOf(next);
    const prevTask = currentIdx > 0 ? result.tasks[currentIdx - 1] : null;
    const isCheckpoint = prevTask && prevTask.section !== next.section;
    return JSON.stringify({
        next,
        isCheckpoint,
        ...advisory,
        progress: {
            completed: result.tasks.filter((t) => t.completed).length,
            total: result.tasks.length,
        },
    });
}
// Always prepends the schema_version sentinel at CURRENT before publishing.
// Callers pass the body without sentinel; atomicWrite owns the stamping.
function atomicWrite(filePath, content) {
    const stripped = stripSentinel(content);
    const stamped = prependSentinel(stripped.body, sentinelVersionFor(filePath));
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, stamped, "utf-8");
    fs.renameSync(tmpPath, filePath);
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// Input-boundary refusal of line breaks in caller-supplied text. tasks.md is
// one task per physical line, and every mutator embeds caller text into a
// line: CR/LF would forge an independently parseable row, and U+2028/U+2029
// (JS regex line terminators that split("\n") ignores) would make a row
// silently vanish from every reader. Refuse loudly before any write.
// Why: specs/e260b-rationale.md (tools/tasks-file.ts) (E121, E131)
function containsLineBreak(s) {
    return /[\r\n\u2028\u2029]/.test(s);
}
export async function completeTaskInFile(workspacePath, taskId, note) {
    // R2-C1 follow-up (round 3): guard `taskId` itself, not just the
    // free-text fields below. This site currently resolves taskId against an
    // existing row before ever building a replacement line, so a
    // newline-bearing taskId merely fails the `find` and returns "not found"
    // — but that safety is derived from lookup order, not a stated invariant,
    // and a future refactor could silently reopen it. Guard explicitly, at
    // the same input-boundary placement as the free-text guards below.
    if (containsLineBreak(taskId)) {
        return JSON.stringify({
            error: `Refusing to complete ${JSON.stringify(taskId)}: task_id must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line task_id could plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    if (note !== undefined && containsLineBreak(note)) {
        return JSON.stringify({
            error: `Refusing to complete ${taskId}: note must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line note would plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    // Lock the LANE ledger (never a legacy path), verify freshness against the
    // pre-migration path, then migrate under the lock. (E125a)
    const filePath = findTasksFile(workspacePath);
    if (!filePath) {
        return JSON.stringify({ error: "No task list file found." });
    }
    const laneTasksPath = laneTasksPathOf(workspacePath);
    return withFileLock(`${resolveTasksLedgerPath(workspacePath, laneTasksPath)}.lock`, () => {
        migrateForWrite(workspacePath, laneTasksPath, filePath);
        const result = parseTasks(workspacePath);
        if (!result) {
            return JSON.stringify({ error: "No task list file found." });
        }
        const task = result.tasks.find((t) => t.id === taskId);
        if (!task) {
            return JSON.stringify({ error: `Task ${taskId} not found.` });
        }
        if (task.completed) {
            return JSON.stringify({ error: `Task ${taskId} is already completed.` });
        }
        let content = fs.readFileSync(result.filePath, "utf-8");
        const suffix = note ? ` (note: ${note})` : "";
        const oldPattern = new RegExp(`- \\[ \\] ${escapeRegExp(taskId)}(\\s.+)$`, "m");
        if (!oldPattern.test(content)) {
            return JSON.stringify({
                error: `Could not find an unchecked checkbox line for ${taskId}. ` +
                    `Task lines must use markdown checkbox syntax: "- [ ] ${taskId} ...".`,
            });
        }
        // Replacer FUNCTION, not a replacement string: `note` is caller-derived
        // and String.replace's replacement-string grammar interprets $&, $`, $',
        // $1, $$ — a note quoting a task row verbatim (ordinary during a re-cut)
        // could splice arbitrary surrounding file content into the write. A
        // function's return value is used literally, so no `$` sequence in
        // `suffix` is ever expanded. (E121)
        content = content.replace(oldPattern, (_match, p1) => `- [x] ${taskId}${p1}${suffix}`);
        atomicWrite(result.filePath, content);
        refreshSnapshotFor(workspacePath, result.filePath, "tasks");
        return JSON.stringify({
            success: true,
            taskId,
            marked: "completed",
            note: note || null,
        });
    });
}
export async function rollbackTaskInFile(workspacePath, taskId, reason) {
    // R2-C1 follow-up (round 3): guard `taskId` itself — see completeTaskInFile
    // above for why this site's current safety (a newline-bearing taskId
    // simply fails the pre-write `find` lookup) is derived, not stated, and
    // worth closing explicitly at the same input-boundary placement.
    if (containsLineBreak(taskId)) {
        return JSON.stringify({
            error: `Refusing to rollback ${JSON.stringify(taskId)}: task_id must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line task_id could plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    if (containsLineBreak(reason)) {
        return JSON.stringify({
            error: `Refusing to rollback ${taskId}: reason must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line reason would plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    // Lock the LANE ledger (never a legacy path), verify freshness against the
    // pre-migration path, then migrate under the lock. (E125a)
    const filePath = findTasksFile(workspacePath);
    if (!filePath) {
        return JSON.stringify({ error: "No task list file found." });
    }
    const laneTasksPath = laneTasksPathOf(workspacePath);
    return withFileLock(`${resolveTasksLedgerPath(workspacePath, laneTasksPath)}.lock`, () => {
        migrateForWrite(workspacePath, laneTasksPath, filePath);
        const result = parseTasks(workspacePath);
        if (!result) {
            return JSON.stringify({ error: "No task list file found." });
        }
        const task = result.tasks.find((t) => t.id === taskId);
        if (!task) {
            return JSON.stringify({ error: `Task ${taskId} not found.` });
        }
        if (!task.completed) {
            return JSON.stringify({ error: `Task ${taskId} is not completed, cannot rollback.` });
        }
        let content = fs.readFileSync(result.filePath, "utf-8");
        const oldPattern = new RegExp(`- \\[x\\] ${escapeRegExp(taskId)}(\\s.+?)(?:\\s+\\((?:note|reverted):[^)]*\\))?$`, "m");
        if (!oldPattern.test(content)) {
            return JSON.stringify({
                error: `Could not find a checked checkbox line for ${taskId}.`,
            });
        }
        // Replacer FUNCTION, not a replacement string — see completeTaskInFile
        // above for why: `reason` is caller-derived and must never pass through
        // String.replace's $&/$`/$'/$1/$$ replacement grammar. (E121)
        content = content.replace(oldPattern, (_match, p1) => `- [ ] ${taskId}${p1} (reverted: ${reason})`);
        atomicWrite(result.filePath, content);
        refreshSnapshotFor(workspacePath, result.filePath, "tasks");
        return JSON.stringify({ success: true, taskId, marked: "reverted", reason });
    });
}
/**
 * Void a task with the `- [-] <id>` marker, which the `[ x]` checkbox class
 * cannot match, so the row vanishes from every parseTasksFromFile consumer
 * (E117). A voided id can never be re-cut: evidence is keyed by id alone
 * (E120). Only an open row may be voided, checked against tasks.md AND
 * `handoff.completed_tasks`; a post-write re-parse under the configured
 * taskPattern refuses a void that would leave the id parseable.
 * Why: specs/e260b-rationale.md (tools/tasks-file.ts)
 */
export async function voidTaskInFile(workspacePath, taskId, reason) {
    // R2-C1 follow-up (round 3): guard `taskId` itself — see completeTaskInFile
    // above for why this site's current safety (a newline-bearing taskId
    // simply fails the pre-write `find` lookup) is derived, not stated, and
    // worth closing explicitly at the same input-boundary placement, ahead of
    // the reason guard below and the post-write invariant further down.
    if (containsLineBreak(taskId)) {
        return JSON.stringify({
            error: `Refusing to void ${JSON.stringify(taskId)}: task_id must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line task_id could plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    // C1 (round 2): refuse a newline-bearing reason at the input boundary,
    // before any read or write. The post-write invariant further below still
    // stands as defense-in-depth for a same-id resurrection (see its own
    // comment), but it cannot see a *different* forged id, which is exactly
    // what a newline-bearing reason plants — this check closes that gap
    // structurally, for every taskPattern, without depending on re-parsing.
    if (containsLineBreak(reason)) {
        return JSON.stringify({
            error: `Refusing to void ${taskId}: reason must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line reason would plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    // Lock the LANE ledger (never a legacy path), verify freshness against the
    // pre-migration path, then migrate under the lock. (E125a)
    const filePath = findTasksFile(workspacePath);
    if (!filePath) {
        return JSON.stringify({ error: "No task list file found." });
    }
    const laneTasksPath = laneTasksPathOf(workspacePath);
    return withFileLock(`${resolveTasksLedgerPath(workspacePath, laneTasksPath)}.lock`, () => {
        migrateForWrite(workspacePath, laneTasksPath, filePath);
        const result = parseTasks(workspacePath);
        if (!result) {
            return JSON.stringify({ error: "No task list file found." });
        }
        const content = fs.readFileSync(result.filePath, "utf-8");
        const task = result.tasks.find((t) => t.id === taskId);
        if (!task) {
            // "Already voided" vs "never existed": the fixed `- [-] ` marker is this
            // tool's own format, so the scan ignores taskPattern. Each line is
            // trim()med first, like every other scan here (so non-ASCII leading
            // whitespace is covered), and `(?=\s|$)` rather than `\b` bounds ids
            // that end in punctuation ("T-1.").
            const voidedPattern = new RegExp(`^- \\[-\\] ${escapeRegExp(taskId)}(?=\\s|$)`);
            const alreadyVoided = content.split("\n").some((line) => voidedPattern.test(line.trim()));
            if (alreadyVoided) {
                return JSON.stringify({
                    error: `Task ${taskId} was already voided and cannot be voided again.`,
                    alreadyVoided: true,
                });
            }
            return JSON.stringify({ error: `Task ${taskId} not found.` });
        }
        // C1: guard on the authoritative ledger, not just the tasks.md mirror.
        // handoff.completed_tasks can be ahead of tasks.md's checkbox (seen in a prior rollout —
        // the state tw_sync exists to repair); in that window task.completed
        // above is false even though the server considers the task done. Match
        // word-boundary against the ledger's free-text entries, mirroring
        // tools/drift.ts and tools/sync.ts exactly.
        const handoff = parseHandoff(workspacePath);
        const ledgerRe = new RegExp(`\\b${escapeRegExp(taskId)}\\b`);
        const ledgerCompleted = !!handoff && handoff.completed_tasks.some((c) => ledgerRe.test(c));
        if (task.completed || ledgerCompleted) {
            return JSON.stringify({
                error: `Task ${taskId} is already completed and cannot be voided — ` +
                    `roll it back first (tw_rollback_task) if it needs to be undone.`,
            });
        }
        const oldPattern = new RegExp(`- \\[ \\] ${escapeRegExp(taskId)}(\\s.+)$`, "m");
        const match = content.match(oldPattern);
        if (!match) {
            return JSON.stringify({
                error: `Could not find an unchecked checkbox line for ${taskId}.`,
            });
        }
        // POST-WRITE invariant: taskId must not parse as a task in the REAL new
        // content, built by the same replace call as the write (so `$` expansion
        // is baked in) and re-parsed per line under the configured taskPattern.
        // Newline and `$` payloads are already refused above; this is the
        // backstop for a custom taskPattern whose checkmark class matches `-`.
        // The replacer is a FUNCTION so `reason` never meets String.replace's
        // replacement grammar. (E121)
        const newContent = content.replace(oldPattern, (_match, p1) => `- [-] ${taskId}${p1} (voided: ${reason})`);
        const readRegex = resolveTaskRegex(workspacePath);
        const stillATask = newContent.split("\n").some((line) => {
            const parsed = parseTaskLine(line.trim(), task.section, readRegex);
            return parsed !== null && parsed.id === taskId;
        });
        if (stillATask) {
            return JSON.stringify({
                error: `Refusing to void ${taskId}: the resulting task list would still contain a ` +
                    `parseable task line for ${taskId} (the configured taskPattern still matches the ` +
                    `voided line, or the reason text planted a new line elsewhere in the file), so it ` +
                    `would remain visible to tw_get_next_task, tw_detect_drift, and tw_sync.`,
            });
        }
        atomicWrite(result.filePath, newContent);
        refreshSnapshotFor(workspacePath, result.filePath, "tasks");
        return JSON.stringify({ success: true, taskId, marked: "voided", reason });
    });
}
/**
 * Append a new task to the current lane's ledger `.current/<lane>/tasks.md`,
 * creating it with a minimal scaffold if absent. Never writes a legacy task
 * file. (E125a)
 */
export async function addTaskInFile(workspacePath, taskId, description, section) {
    // Both `taskId` and `description` build the new row, and unlike the other
    // mutators this one never looks `taskId` up first, so this guard alone stops
    // a newline-bearing id from forging a row (and silently dropping the
    // caller's own). Refused before any read or write, like `description`.
    if (containsLineBreak(taskId)) {
        return JSON.stringify({
            error: `Refusing to add ${JSON.stringify(taskId)}: task_id must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line task_id would plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    // C1 (round 2): addTaskInFile builds its new line by plain string
    // concatenation, so it is immune to $-expansion (no String.replace
    // replacement-string grammar in play) but not to a newline in
    // `description` — that still plants a second, independently parseable
    // line, bypassing the duplicate-id scan below entirely (the scan runs
    // pre-insert and inspects `taskId`, not the planted line's id). Refuse at
    // the input boundary, before any read or write.
    if (containsLineBreak(description)) {
        return JSON.stringify({
            error: `Refusing to add ${taskId}: description must not contain a line break — ` +
                `tasks.md is a line-oriented format and a multi-line description would plant an ` +
                `unrelated, independently parseable line in the file.`,
        });
    }
    const pre = findTasksFile(workspacePath);
    const laneTasksPath = laneTasksPathOf(workspacePath);
    const targetPath = resolveTasksLedgerPath(workspacePath, laneTasksPath);
    return withFileLock(`${targetPath}.lock`, () => {
        migrateForWrite(workspacePath, laneTasksPath, pre);
        const existing = fs.existsSync(targetPath) ? targetPath : null;
        if (!existing) {
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
        }
        const targetSection = section?.trim() || "Active";
        // `_primary` must not grow a row that its own ownership filter would
        // immediately hide. (E125a)
        if (isPrimaryLedger(targetPath) && makeForeignCheck(targetPath)(targetSection)) {
            return JSON.stringify({
                error: `Refusing to add ${taskId} under section "${targetSection}": that section belongs to lane ` +
                    `"${resolveLaneName(targetSection)}", which has its own live task ledger — add it from that lane.`,
            });
        }
        let content = existing ? fs.readFileSync(existing, "utf-8") : `# Tasks\n\n## ${targetSection}\n`;
        if (existing) {
            const regex = resolveTaskRegex(workspacePath);
            const match = content.match(regex);
            if (match && match[2] === taskId) {
                return JSON.stringify({ error: `Task ${taskId} already exists.` });
            }
            // Re-scan for duplicate IDs across all lines (not just first match).
            for (const line of content.split("\n")) {
                const m = line.trim().match(regex);
                if (m && m[2] === taskId) {
                    return JSON.stringify({ error: `Task ${taskId} already exists.` });
                }
            }
            // The `[ x]` scans above never match a voided row, so refuse a re-cut of
            // a voided id here: evidence files are keyed by id alone, and a re-cut
            // would inherit evidence nobody reviewed. Same fixed-marker, trim() and
            // `(?=\s|$)` matching as voidTaskInFile's "already voided" check. (E120)
            const voidedPattern = new RegExp(`^- \\[-\\] ${escapeRegExp(taskId)}(?=\\s|$)`);
            const wasVoided = content.split("\n").some((line) => voidedPattern.test(line.trim()));
            if (wasVoided) {
                return JSON.stringify({
                    error: `Refusing to add ${taskId}: this task id was previously voided and cannot be reused — ` +
                        `a re-cut would inherit the voided incarnation's review/QA evidence, which describes ` +
                        `different work. Choose a new task id.`,
                    voided: true,
                });
            }
        }
        const newLine = `- [ ] ${taskId} ${description}`;
        const sectionHeading = `## ${targetSection}`;
        const headingIdx = content.indexOf(sectionHeading);
        if (headingIdx === -1) {
            // Section missing — append a new section block.
            const trimmed = content.endsWith("\n") ? content : `${content}\n`;
            content = `${trimmed}\n${sectionHeading}\n${newLine}\n`;
        }
        else {
            // Insert directly after the heading line, before the next blank line or next ## heading.
            const afterHeading = content.indexOf("\n", headingIdx) + 1;
            const rest = content.slice(afterHeading);
            const nextSectionIdx = rest.search(/(^|\n)##\s/);
            if (nextSectionIdx === -1) {
                content = `${content.slice(0, afterHeading)}${rest.replace(/\s*$/, "")}\n${newLine}\n`;
            }
            else {
                const sectionBlock = rest.slice(0, nextSectionIdx).replace(/\s*$/, "");
                const tail = rest.slice(nextSectionIdx);
                content = `${content.slice(0, afterHeading)}${sectionBlock}\n${newLine}\n${tail}`;
            }
        }
        atomicWrite(targetPath, content);
        refreshSnapshotFor(workspacePath, targetPath, "tasks");
        return JSON.stringify({
            success: true,
            taskId,
            section: targetSection,
            storage: "file",
            path: targetPath,
        });
    });
}
//# sourceMappingURL=tasks-file.js.map