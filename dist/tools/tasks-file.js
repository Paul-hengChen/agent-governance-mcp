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
// e125a D-D / option A: a v2+ file at a legacy path means "index", so a
// legacy-path LEDGER (git-ignored lane path, AC4b) is kept at v1. Only a lane
// ledger `.current/<lane>/tasks.md` is stamped CURRENT.
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
// E131 parser hardening (second half — see containsLineBreak above for the
// input-boundary half). The input-boundary guard only defends the tw_* RPC
// path; a tasks.md hand-edited directly (the row that filed this defect
// explicitly calls out as the most likely real trigger) never passes
// through any mutator at all, so the parser itself must not let a
// terminator-corrupted row disappear silently. FORBIDDEN_TERMINATOR_RE
// detects the two JS-only line terminators (U+2028/U+2029); TASK_LINE_SHAPE_RE
// is a loose, terminator-tolerant recognizer for "this looks like a
// checkbox task row" (open `[ ]`, done `[x]`, or voided `[-]`) that, unlike
// the configured taskPattern, does not require reaching `$` — it only needs
// to match the checkbox marker and the start of the id token, both of which
// sit before the point a U+2028/U+2029 would appear in a note or reason
// suffix. Scoped to the DEFAULT_TASK_REGEX row shape; a workspace running a
// fully custom taskPattern with a structurally different row shape is not
// covered by this specific heuristic (there is no generic way to detect
// "matches an arbitrary custom pattern except for the terminator" without
// knowing that pattern's structure) — the input-boundary guard remains the
// primary defense for the RPC path in that case.
const FORBIDDEN_TERMINATOR_RE = /[\u2028\u2029]/;
// C2 fix (review round 1): the checkbox class deliberately excludes `-` (the
// void marker). A voided row's unparseability is BY DESIGN \u2014 voidTaskInFile's
// own doc comment states it disappears from every default-shaped reader on
// purpose \u2014 so this shape heuristic must not treat a voided row as the E131
// corruption case. Only an open `[ ]` or completed `[x]` row triggers the
// throw below.
const TASK_LINE_SHAPE_RE = /^- \[[ x]\]\s+\S/;
// e125a (spec D-F / AC9): the ledger is ONLY the current lane's
// `.current/<lane>/tasks.md`. A legacy root file is never a read fallback —
// except in a workspace whose lane path is git-ignored (option A, AC4b),
// where the legacy file stays the ledger (resolveTasksLedgerPath).
function laneTasksPathOf(workspacePath) {
    return resolveCurrentLanePaths(workspacePath).tasksPath;
}
function ledgerPathOf(workspacePath) {
    return resolveTasksLedgerPath(workspacePath, laneTasksPathOf(workspacePath));
}
// e125a D12 / AC14(a): true iff `section` belongs to ANOTHER lane that has
// its own live ledger — the sibling `.current/<thatLane>/<same filename>` of
// the `_primary` ledger at `primaryTasksPath`. Such a section in `_primary`'s
// ledger is a stale pre-extraction copy and is excluded from every read.
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
            // e125b AC8 (X7): a lane whose ledger closed into .current/history/ is foreign too.
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
// e125a AC11: a forward migration THIS call performed (R-1: the migrate
// functions report it) is the session's own write. When the session
// snapshot was fresh against the pre-migration file, carry it over to the
// new lane ledger so the next mutation does not trip STATE DRIFT on the
// path switch.
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
        // E131 — fail loud instead of silently erasing. An ordinary strict-parse
        // miss (blank line, prose, a `## ` heading already handled above) is
        // expected and stays silently skipped, as always. But a line that (a)
        // is shaped like a checkbox task row AND (b) carries a JS-only line
        // terminator (U+2028/U+2029) the strict regex's trailing `(.+)$` cannot
        // cross is exactly the E131 corruption case: the row is genuinely on
        // disk (this loop already reached it — split("\n") never broke on the
        // terminator), but would otherwise vanish from parseTasksFromFile,
        // getNextTask, tw_detect_drift and tw_sync all at once with no signal
        // anywhere. Refuse to let that happen quietly.
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
// C1 (round 2, review_reports/review_T-E121-01.md) — the newline half of
// E121, sibling to the $-expansion half already fixed above. `tasks.md` is a
// line-oriented format: one task is one physical line, and every mutator
// below embeds a caller-supplied string into that line (via a replacer
// function, or — in addTaskInFile — plain concatenation). A caller-supplied
// value containing "\n" or "\r" is therefore not merely awkward, it is
// structurally incompatible: it plants an independently parseable line
// elsewhere in the file, which the E117 post-write invariant (voidTaskInFile
// only) cannot see because that check defends `taskId` only, and which the
// three sibling mutators cannot see at all because they have no such check.
// Refuse loud, at the input boundary, before any write — reusing this file's
// own "a silent no-op is worse than a loud refusal here" precedent
// (voidTaskInFile's post-write refusal below) rather than silently
// flattening text the caller typed.
//
// E131 widening: JavaScript counts U+2028 LINE SEPARATOR and U+2029
// PARAGRAPH SEPARATOR as line terminators for regex purposes (`.` cannot
// consume them and an un-anchored `$` cannot cross them) even though
// String.prototype.split("\n") — used throughout this file — does not
// split on them. A caller-supplied value carrying one of these characters
// therefore lands on disk as what a human reader sees as one physical
// line, yet is invisible to parseTaskLine's regex match: the row survives
// in tasks.md but silently vanishes from parseTasksFromFile, getNextTask,
// tw_detect_drift and tw_sync simultaneously (E131, measured identical at
// base and at the E121 tree — pre-existing, not an E121 regression). Same
// refusal contract as the CR/LF guard above, now covering both directions
// of the line-erasure family (E121 forged rows via CR/LF; E131 erases rows
// via U+2028/U+2029) with a single widened character class.
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
    // e125a: lock the LANE ledger (never a legacy path), verify freshness
    // against the pre-migration path, then migrate under the lock.
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
        // can splice arbitrary surrounding file content into the write. A
        // function's return value is used literally, so no `$` sequence in
        // `suffix` is ever expanded (E121, docs/backlog.md order 0t).
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
    // e125a: lock the LANE ledger (never a legacy path), verify freshness
    // against the pre-migration path, then migrate under the lock.
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
        // String.replace's $&/$`/$'/$1/$$ replacement grammar (E121).
        content = content.replace(oldPattern, (_match, p1) => `- [ ] ${taskId}${p1} (reverted: ${reason})`);
        atomicWrite(result.filePath, content);
        refreshSnapshotFor(workspacePath, result.filePath, "tasks");
        return JSON.stringify({ success: true, taskId, marked: "reverted", reason });
    });
}
/**
 * Void a task: mark it as never-should-have-existed rather than "done, then
 * reverted" (E117). Reuses the existing checkbox-line format with a marker
 * checkmark char, `-`, that DEFAULT_TASK_REGEX's `[ x]` character class (and
 * any custom taskPattern following the same "space or x" convention) cannot
 * match — so a voided line is structurally invisible to parseTaskLine and
 * therefore to every consumer of parseTasksFromFile: getNextTaskFromFile
 * (E112's fix — a voided row is never offered again), tw_detect_drift (never
 * counted as completed or incomplete, never flagged as vibe-coding drift),
 * and tw_sync (never a reconcile or refused-vibe-drift candidate).
 *
 * E120 update: the voided line's invisibility to the DEFAULT_TASK_REGEX-
 * shaped ID-uniqueness scan in addTaskInFile used to make the task ID
 * legally reusable in a re-cut (E117's original intent). That turned out to
 * be a defect, not a feature: review_reports/review_<id>.md and
 * qa_reports/review_<id>.md are existence-based and keyed only by id, so a
 * re-cut of a voided id silently inherited the voided incarnation's
 * review/QA evidence and satisfied both gates for work nobody reviewed.
 * addTaskInFile now scans for the fixed `- [-] <id>` void-marker format
 * directly (see the voidedPattern check there) and refuses the re-cut
 * outright — a re-cut is different work, and refusing removes the state in
 * which the bug is expressible rather than adding a version field every
 * future evidence reader would have to honour. The voided marker line
 * itself is unchanged by this: it stays on disk, still invisible to
 * parseTaskLine, still exactly as this comment originally described.
 *
 * Only a currently-incomplete (`[ ]`) row may be voided; an already-completed
 * (`[x]`) row is refused. Completion is checked against BOTH the tasks.md
 * mirror and the authoritative `handoff.completed_tasks` ledger (round 2,
 * C1) — tasks.md can lag the ledger (the exact state tw_sync exists to
 * repair), and voiding in that window would delete the row a completion
 * check depends on, making the drift permanently unreachable
 * (tools/drift.ts builds its id vocabulary from tasks.md alone). A task id
 * that is already voided is reported distinctly from one that never
 * existed (round 2, Q1) — the voided line, marker included, is still on
 * disk and there is no threat model that benefits from hiding it locally.
 *
 * Before committing the write, the POST-WRITE invariant — "after this
 * write, taskId must not parse as a task" — is asserted against the REAL
 * content about to be written (round 3, C5; supersedes round 2's C2, which
 * checked a hand-rebuilt replacement line instead and missed both a
 * newline and a `$`-expansion escape from that line). The candidate content
 * is produced by the exact same String.replace call used for the actual
 * write, then re-parsed line-by-line — as parseTasks() itself parses the
 * file — against the WORKSPACE'S CONFIGURED taskPattern, not just the
 * default regex the doc paragraph above assumes. The void is refused if
 * taskId still comes back as a task anywhere in the resulting file (live
 * or "completed", on the voided line or on a line planted elsewhere by the
 * reason text). A custom taskPattern using a different completion
 * convention than the default's `[ x]` class could otherwise accept the
 * write and report success while the row keeps being offered — a silent
 * no-op is worse than a loud refusal here.
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
    // e125a: lock the LANE ledger (never a legacy path), verify freshness
    // against the pre-migration path, then migrate under the lock.
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
            // Q1: distinguish "already voided" from "never existed" in file mode —
            // the voided marker line is still literally on disk even though it no
            // longer parses as a task. The void marker ("- [-] ") is this tool's
            // own fixed write format, independent of any configured taskPattern,
            // so this scan is reliable regardless of taskPattern.
            // C1 fix (review round 1): every other scan in this file normalises
            // leading whitespace before matching (the duplicate-id re-scan below
            // trims per-line, and parseTasks trims too), so an indented voided
            // row is a fully supported row everywhere else. `^` alone missed it.
            // NEW-3 fix (same round): `\b` requires a word character on the id's
            // trailing side, which fails for ids ending in punctuation (e.g.
            // "T-1.", "T-1)") even though they legally match the row's `(\S+)` id
            // group — `(?=\s|$)` bounds the id correctly regardless of what
            // character it ends in.
            // R2-C1 fix (round 2): the round-1 fix normalised leading whitespace
            // with `[ \t]*`, a two-character subset of what `String.prototype.trim()`
            // strips (trim() also removes U+00A0, U+000B, U+000C, U+2000-U+200A,
            // U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF, among others). Since
            // `parseTasks` (see the top-level parse loop) and the duplicate-id
            // re-scan directly below in `addTaskInFile` both trim() each line
            // before matching, an indented voided row using one of those other
            // whitespace characters parsed as a live task everywhere else in this
            // file while staying invisible to this scan — reproducing C1 verbatim
            // under a different indent character. Fixed by testing the anchored,
            // unindented pattern against each line's own trim() output, byte-
            // identical normalisation to both of those sites, rather than trying
            // to enumerate whitespace inside the regex itself.
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
        // C5 fix (round 3, replaces the round-2 C2 check): assert the
        // POST-WRITE invariant — "after this write, taskId must not parse as a
        // task" — over the REAL content about to be written, not over a string
        // rebuilt alongside it. Build newContent via the exact same
        // String.replace call used for the actual write (so any `$`-expansion
        // in `reason` — $&, $1, $$, etc. — is already baked in, exactly as it
        // will be on disk), then re-parse it the way parseTasks() does: split
        // into real lines and run parseTaskLine per line against the
        // workspace's configured taskPattern.
        //
        // By this point `reason` cannot contain a newline — the input-boundary
        // guard at the top of this function (C1, round 2) already refused that
        // case before any read or write, closing the vector this check used to
        // be the ONLY thing catching (review_reports/review_T-E121-01.md C1: the
        // guard here defends `parsed.id === taskId` only, so a *different*
        // forged id, e.g. from a newline-bearing reason, sailed straight past
        // it — that gap is now closed structurally at the boundary, not here).
        // Replacer FUNCTION, not a replacement string — see completeTaskInFile
        // above for why: `reason` is caller-derived and must never pass through
        // String.replace's $&/$`/$'/$1/$$ replacement grammar (E121).
        //
        // This check remains load-bearing for what's left: a same-id
        // resurrection that doesn't need a newline at all — e.g. a custom
        // taskPattern whose checkmark class also matches the void marker char
        // `-` (test C2), so the voided line itself still parses as `taskId`
        // under that pattern. Newline-bearing and $-expansion payloads are both
        // now refused upstream of this point; this check is the remaining
        // backstop for the taskPattern-shape case, not a substitute for either
        // upstream fix.
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
 * Append a new task to the current lane's ledger `.current/<lane>/tasks.md`
 * (e125a AC9), creating it with a minimal scaffold if absent. Never writes a
 * legacy task file.
 */
export async function addTaskInFile(workspacePath, taskId, description, section) {
    // R2-C1 (round 3, BLOCKING finding): the new row is built from BOTH
    // caller-supplied strings — `taskId` AND `description` (see `newLine`
    // below). Round 2 guarded `description` only; a newline-bearing `taskId`
    // sailed straight through: the duplicate-id scan below compares
    // `m[2] === taskId` against the newline-bearing id (never matches, no
    // cover), and the caller's own row is silently dropped — the planted LF
    // leaves `- [ ] <taskId-prefix>` descriptionless, which the configured
    // taskPattern's `\s+(.+)$` cannot match. Unlike the other three mutators,
    // this site never resolves `taskId` against an existing row before
    // writing, so there is no incidental lookup-failure safety net here at
    // all — this guard is the only thing standing between a newline-bearing
    // task_id and a forged row. Refuse at the input boundary, before any read
    // or write, same placement and shape as the `description` guard below.
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
        // e125a D12 / AC14(d): `_primary` must not grow a row that its own
        // ownership filter would immediately hide.
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
            // E120: the scans above use `regex` (DEFAULT_TASK_REGEX or a custom
            // taskPattern), whose checkmark class is `[ x]` by convention and so —
            // by design (see voidTaskInFile's doc comment above) — never matches a
            // voided row's `- [-] <id>` marker line. That is exactly what
            // previously let a re-cut of a voided id sail past this uniqueness
            // check and reuse the id: review_reports/review_<id>.md and
            // qa_reports/review_<id>.md are existence-based, keyed only by id, so
            // the voided incarnation's leftover evidence silently satisfied the
            // gates for a never-reviewed re-cut (E120). Settled closure: refuse
            // the re-cut outright rather than stamp evidence with a void
            // generation — a re-cut is different work, and this removes the state
            // in which the bug is expressible instead of adding a version field
            // every future evidence reader would have to honour. Scan for the
            // fixed void-marker format directly (independent of any configured
            // taskPattern, exactly as the "already voided" check in
            // voidTaskInFile does), and refuse loud in the same style as the
            // "already exists" refusals above.
            // C1 fix (review round 1): matches the identical correction in
            // voidTaskInFile's Q1 check above — `^` alone missed an indented void
            // marker (every other scan in this function normalises whitespace
            // first), which let a re-cut of an indented-then-voided id bypass
            // this very refusal. NEW-3 fix (same round): `(?=\s|$)` replaces `\b`
            // so ids ending in a non-word character (e.g. "T-1.", "T-1)") are
            // still bounded correctly.
            // R2-C1 fix (round 2): identical correction to voidTaskInFile's Q1
            // check — `[ \t]*` only absorbed space/tab, a subset of what trim()
            // strips, so an id voided behind one of the other whitespace
            // characters (NBSP, VT, FF, the various Unicode space separators,
            // BOM, ...) still parsed as a live task via the duplicate-id re-scan
            // three lines above (which trims per-line) while staying invisible to
            // this scan, letting the re-cut through. Fixed the same way: test the
            // anchored, unindented pattern against each line's own trim() output —
            // byte-identical normalisation to the re-scan directly above and to
            // parseTasks.
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