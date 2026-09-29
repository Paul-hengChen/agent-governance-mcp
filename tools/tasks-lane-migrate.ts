// Coded by @sr-engineer
// Legacy tasks.md -> lane-local `.current/<lane>/tasks.md` migration. (E125a)
//
//   _primary : COPY the legacy body into the lane ledger, then re-stamp the
//              legacy file as a v2 index (sentinel + notice + body) and write
//              the reverse-run receipt `.current/tasks-index-receipt.json`.
//   feat lane: MOVE every `## ` section whose heading's ticket id is the lane
//              into the lane ledger; each contiguous run becomes one marker
//              line in the legacy file, whose sentinel is left untouched.
//
// A legacy file at v2+ is an index, never a forward source — but a MISSING
// ledger it proves must exist is reported loudly, never treated as empty
// (TasksLedgerAbsentError). A git-ignored lane path skips the migration and
// keeps the legacy file as the ledger. Lock order: the lane's tasks lock
// OUTER, the legacy file's lock INNER. Both are taken with a small
// synchronous bounded-wait lock whose timeout throws
// TasksMigrationBusyError — never a silent skip.
//
// Reverse (runner-only, no CLI): migratePrimaryReverse and
// migrateFeatReverse restore the legacy file from the lane ledger's CURRENT
// body and delete the ledger. Every precondition is checked before the
// first write, so a refused run touches nothing.

import { execFileSync } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { isLockPayloadStale } from "../guards/file-lock.js";
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
import { findLegacyTasksFile, resolveTaskPaths } from "./config.js";
import { PRIMARY_LANE, laneFile, resolveCurrentLanePaths, resolveLaneDir, resolveLaneName } from "./lane-paths.js";

// D-D: a legacy-path file at this version or above is an index.
const INDEX_MIN_VERSION = 2;
const SYNC_LOCK_MAX_WAIT_MS = 3_000;
const SYNC_LOCK_RETRY_MS = 50;

// Exact copy strings (spec Copy / Strings).
const TASKS_INDEX_NOTICE =
  "<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->";
function featMarker(lane: string, run: number, of: number, sections: number): string {
  return `<!-- tasks_moved: lane=${lane} run=${run} of=${of} sections=${sections} -> .current/${lane}/tasks.md (E125a) -->`;
}
function ignoredLaneAdvisory(lanePath: string, legacyPath: string): string {
  return `tasks ledger: ${lanePath} is git-ignored in this workspace — lane-local migration skipped; ${legacyPath} remains the tw_* ledger (E125a option A)`;
}

// O-1: the ONE `## ` section-heading predicate, shared with tools/tasks-file.ts's
// parser so the extractor and the reader agree on what a section is.
export const SECTION_HEADING_RE = /^##\s+(.+)/;
function headingLane(line: string): string | null {
  const m = SECTION_HEADING_RE.exec(line);
  return m ? resolveLaneName(m[1].trim()) : null;
}

// Top-level `.current/` file, deliberately NOT a LANE_FILES entry (D7).
const RECEIPT_FILENAME = "tasks-index-receipt.json";
function receiptPath(workspacePath: string): string {
  return path.join(workspacePath, ".current", RECEIPT_FILENAME);
}

// Same sentinel shape tools/tasks-file.ts parses, but consumes exactly ONE
// line so the body is preserved byte-for-byte (AC4/AC7).
const SENTINEL_LINE_RE = /^<!--\s*schema_version:\s*(\d+)\s*-->[ \t]*\r?\n/;

function currentSentinel(): string {
  return `<!-- schema_version: ${CURRENT_VERSIONS.tasks} -->\n`;
}

interface SplitFile {
  version: number; // 0 when no sentinel line
  header: string; // the raw sentinel line ("" when absent)
  body: string;
}

function splitSentinel(raw: string): SplitFile {
  const m = SENTINEL_LINE_RE.exec(raw);
  if (!m) return { version: 0, header: "", body: raw };
  return { version: Number(m[1]), header: m[0], body: raw.slice(m[0].length) };
}

/**
 * AC6b (review round 1, C1): the lane ledger is absent but the legacy file
 * proves one must exist — a `_primary` v2+ index, `tasks_moved` markers for
 * this feat lane, or a newer-server schema. Thrown instead of reporting an
 * empty task list. `.code` stays outside the error-code-contract harvest.
 */
export class TasksLedgerAbsentError extends Error {
  readonly code = "TASKS_LEDGER_ABSENT";
  constructor(lane: string, lanePath: string, legacyPath: string, reason: string) {
    super(
      `TASKS_LEDGER_ABSENT: lane ${lane} has no task ledger at ${lanePath}, but ${legacyPath} shows one ` +
        `must exist (${reason}) — restore ${lanePath} (e.g. from git) or run the tasks reverse migration; ` +
        `refusing to report an empty task list`,
    );
    this.name = "TasksLedgerAbsentError";
  }
}

export class TasksMigrationBusyError extends Error {
  readonly code = "TASKS_MIGRATION_BUSY";
  constructor(lockPath: string) {
    super(
      `tasks lane migration busy: could not acquire ${lockPath} within ${SYNC_LOCK_MAX_WAIT_MS}ms ` +
        `(a concurrent first access is migrating) — retry the call`,
    );
    this.name = "TasksMigrationBusyError";
  }
}

const sleepCell = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms: number): void {
  Atomics.wait(sleepCell, 0, 0, ms);
}

// Synchronous twin of guards/file-lock.ts's withFileLock: same O_EXCL
// lockfile, same {pid, acquiredAt} payload, same stale predicate, so the two
// flavours exclude each other on one lock path.
function withSyncLock<T>(lockPath: string, fn: () => T): T {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const start = Date.now();
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }));
      } finally {
        fs.closeSync(fd);
      }
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      // R-3: a holder in THIS process (an async withFileLock parked on the
      // event loop Atomics.wait blocks) can never release — fail fast.
      if (lockHolderPid(lockPath) === process.pid) throw new TasksMigrationBusyError(lockPath);
      // R-2: the deadline bounds EVERY retry, including an undeletable stale lock.
      if (Date.now() - start > SYNC_LOCK_MAX_WAIT_MS) throw new TasksMigrationBusyError(lockPath);
      if (isLockPayloadStale(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
          continue;
        } catch {
          /* raced, or undeletable — wait, then re-check the deadline */
        }
      }
      sleepSync(SYNC_LOCK_RETRY_MS);
    }
  }
  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
}

function lockHolderPid(lockPath: string): number | null {
  try {
    const pid = (JSON.parse(fs.readFileSync(lockPath, "utf-8")) as { pid?: unknown }).pid;
    return typeof pid === "number" ? pid : null;
  } catch {
    return null;
  }
}

function atomicWriteRaw(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

// ---------- index normalization for the reverse-run receipt (E125c, E195) ----------

// Re-declared from bin/agc-init.mjs (applyClosedLanePointer) — bin/ is not
// importable from tools/: the Closed Lanes heading, and the line that ends
// its section (the next `#`/`##` heading).
const CLOSED_LANES_HEADING_RE = /^##\s+Closed Lanes\s*$/;
const SECTION_OR_TITLE_RE = /^#{1,2}\s/;

function isBlank(line: string): boolean {
  return line.trim() === "";
}

// Lines split on "\n" with the final newline reported separately, so
// `lines.join("\n") + (trailingNewline ? "\n" : "")` is byte-exact ("" -> []).
function splitLines(body: string): { lines: string[]; trailingNewline: boolean } {
  if (body === "") return { lines: [], trailingNewline: false };
  const trailingNewline = body.endsWith("\n");
  return { lines: (trailingNewline ? body.slice(0, -1) : body).split("\n"), trailingNewline };
}

function joinLines(lines: string[], trailingNewline: boolean): string {
  return lines.length === 0 ? "" : lines.join("\n") + (trailingNewline ? "\n" : "");
}

// Exactly one final "\n" (empty stays empty).
function joinCanonical(lines: string[]): string {
  return joinLines(lines, true);
}

function trimTrailingBlank(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && isBlank(lines[end - 1])) end--;
  return lines.slice(0, end);
}

/**
 * Splits out every CL section: a `## Closed Lanes` heading through the line
 * before the next `#`/`##` heading (or EOF), plus the run of blank lines
 * immediately before the heading. `closedLanes` holds the sections' lines
 * in document order; `rest` everything else, order preserved. Pure.
 */
function peelClosedLanes(lines: string[]): { rest: string[]; closedLanes: string[] } {
  const rest: string[] = [];
  const closedLanes: string[] = [];
  for (let i = 0; i < lines.length; ) {
    if (!CLOSED_LANES_HEADING_RE.test(lines[i])) {
      rest.push(lines[i++]);
      continue;
    }
    let blankRun = 0;
    while (blankRun < rest.length && isBlank(rest[rest.length - 1 - blankRun])) blankRun++;
    closedLanes.push(...rest.splice(rest.length - blankRun, blankRun), lines[i++]);
    while (i < lines.length && !SECTION_OR_TITLE_RE.test(lines[i])) closedLanes.push(lines[i++]);
  }
  return { rest, closedLanes };
}

/**
 * normalizeIndexBody (spec Definitions): drop every `tasks_moved` marker
 * line, drop every CL section, drop trailing blank lines, end with exactly
 * one "\n" (empty stays empty). The identity on a canonical body. Pure.
 */
function normalizeIndexBody(body: string): string {
  const lines = splitLines(body).lines.filter((line) => !MARKER_LANE_RE.test(line));
  return joinCanonical(trimTrailingBlank(peelClosedLanes(lines).rest));
}

/**
 * The `_primary` reverse-run receipt sha: sha256(normalizeIndexBody(body)).
 * Shared by the forward stamp, the reverse check and the one-off index
 * compaction, so the allowed root edits after a forward run (`agc feature
 * finish --shipped` removing a lane's markers and appending a Closed Lanes
 * pointer) never break the reverse. Pure. (E125c, E195)
 */
export function primaryIndexReceiptSha(body: string): string {
  return sha256(normalizeIndexBody(body));
}

interface Block {
  lines: string[]; // heading line + every line up to the next `## ` heading
  lane: string | null; // null for the preamble before the first heading
}

// Split a body into its preamble + `## ` blocks. A trailing newline is
// reported separately so re-joining with "\n" is byte-exact.
function splitBlocks(body: string): { blocks: Block[]; trailingNewline: boolean } {
  const trailingNewline = body.endsWith("\n");
  const lines = (trailingNewline ? body.slice(0, -1) : body).split("\n");
  const blocks: Block[] = [{ lines: [], lane: null }];
  for (const line of lines) {
    const lane = headingLane(line);
    if (lane !== null) {
      blocks.push({ lines: [line], lane });
    } else {
      blocks[blocks.length - 1].lines.push(line);
    }
  }
  if (blocks[0].lines.length === 0) blocks.shift();
  return { blocks, trailingNewline };
}

// `_primary` forward: lane ledger first (the commit point), then the
// receipt, then the legacy index — an interruption never hides the ledger.
// A root `## Closed Lanes` section stays in the index only — the ledger copy
// is the body without it (canonical trailing newline), so both round trips
// are byte-exact. A body with no Closed Lanes section is copied verbatim.
// (E125c)
function migratePrimaryForward(workspacePath: string, legacyPath: string, laneTasksPath: string, body: string): void {
  const split = splitLines(body);
  const { rest, closedLanes } = peelClosedLanes(split.lines);
  const ledgerBody = closedLanes.length === 0 ? body : joinCanonical(trimTrailingBlank(rest));
  atomicWriteRaw(laneTasksPath, currentSentinel() + ledgerBody);
  atomicWriteRaw(receiptPath(workspacePath), `${JSON.stringify({ bodySha256: primaryIndexReceiptSha(body) })}\n`);
  atomicWriteRaw(legacyPath, `${currentSentinel()}${TASKS_INDEX_NOTICE}\n${body}`);
}

// D-C feat lane. Zero matching sections: no-op (false; the first
// tw_add_task creates the lane ledger). Every marker carries the run total
// `of=<N>` so the reverse can detect ANY missing marker (C2). Lane ledger
// first, then the marked legacy file.
function migrateFeatForward(legacyPath: string, laneTasksPath: string, lane: string, legacy: SplitFile): boolean {
  const { blocks, trailingNewline } = splitBlocks(legacy.body);
  const total = blocks.filter((b, i) => b.lane === lane && (i === 0 || blocks[i - 1].lane !== lane)).length;
  if (total === 0) return false;
  const kept: string[] = [];
  const moved: string[] = [];
  let run = 0;
  for (let i = 0; i < blocks.length; ) {
    if (blocks[i].lane !== lane) {
      kept.push(...blocks[i].lines);
      i++;
      continue;
    }
    let count = 0;
    for (; i < blocks.length && blocks[i].lane === lane; i++, count++) moved.push(...blocks[i].lines);
    kept.push(featMarker(lane, ++run, total, count));
  }
  atomicWriteRaw(laneTasksPath, `${currentSentinel()}${moved.join("\n")}\n`);
  atomicWriteRaw(legacyPath, legacy.header + kept.join("\n") + (trailingNewline ? "\n" : ""));
  return true;
}

// ---------- option A (AC4b): git-ignored lane path ----------

// Cached per (workspace, lane path) per process: the check spawns git, and
// readers hit it on every call while the lane ledger is absent. A
// .gitignore change is picked up on the next server start.
const ignoredCache = new Map<string, boolean>();

/**
 * true iff `git check-ignore -q <lanePath>` exits 0 in `workspacePath`
 * (read-only; stderr suppressed, the tools/feature-rollup.ts precedent).
 * Exit 1, no `.git`, no git binary, exit 128 or any error: NOT ignored.
 */
export function isLanePathIgnored(workspacePath: string, lanePath: string): boolean {
  const key = `${workspacePath}\0${lanePath}`;
  let ignored = ignoredCache.get(key);
  if (ignored === undefined) {
    try {
      execFileSync("git", ["check-ignore", "-q", "--", path.relative(workspacePath, lanePath)], {
        cwd: workspacePath,
        stdio: "ignore",
        timeout: 5_000,
      });
      ignored = true;
    } catch {
      ignored = false;
    }
    ignoredCache.set(key, ignored);
  }
  return ignored;
}

/**
 * The file tw_* reads and writes as the task ledger: the lane ledger, except
 * in a workspace whose absent lane path is git-ignored — there the legacy
 * file stays the ledger (or, with none yet, the first taskPaths candidate).
 * (E125a)
 */
export function resolveTasksLedgerPath(workspacePath: string, laneTasksPath: string): string {
  if (fs.existsSync(laneTasksPath) || !isLanePathIgnored(workspacePath, laneTasksPath)) return laneTasksPath;
  return findLegacyTasksFile(workspacePath) ?? resolveTaskPaths(workspacePath)[0] ?? laneTasksPath;
}

/** The one-line option-A advisory (Copy `tasks.ignored-lane-advisory`), or null. */
export function tasksLaneAdvisory(workspacePath: string): string | null {
  const laneTasksPath = resolveCurrentLanePaths(workspacePath).tasksPath;
  const ledger = resolveTasksLedgerPath(workspacePath, laneTasksPath);
  return ledger === laneTasksPath ? null : ignoredLaneAdvisory(laneTasksPath, ledger);
}

// ---------- forward-migration decision (D13, AC6b) ----------

function newerServerMessage(version: number): string {
  try {
    runMigrations("tasks", { schema_version: version, body: "" });
  } catch (err) {
    return (err as Error).message;
  }
  return `tasks on-disk version ${version}`;
}

/**
 * With NO lane ledger: true iff a forward migration must run. Throws
 * TasksLedgerAbsentError when the legacy file proves the ledger must exist
 * (AC6b): (c) a newer-server schema, (a) a `_primary` v2+ index, (b) a
 * `tasks_moved` marker for this feat lane. A feat lane on a v2+ root with
 * no own marker starts empty (D13 / AC14(b)). `body` is read lazily: the
 * `_primary` decision needs only the sentinel.
 */
function mustMigrate(lane: string, laneTasksPath: string, legacyPath: string, version: number, body: () => string): boolean {
  const absent = (reason: string) => new TasksLedgerAbsentError(lane, laneTasksPath, legacyPath, reason);
  if (version > CURRENT_VERSIONS.tasks) throw absent(newerServerMessage(version));
  if (lane === PRIMARY_LANE) {
    if (version >= INDEX_MIN_VERSION) throw absent(`_primary index v${version}`);
    return true;
  }
  let ownSection = false;
  for (const line of body().split("\n")) {
    const m = MARKER_LANE_RE.exec(line);
    if (m && m[1] === lane) throw absent(`tasks_moved markers for lane ${lane}`);
    if (!ownSection && headingLane(line) === lane) ownSection = true;
  }
  return ownSection && version < INDEX_MIN_VERSION;
}

// Sentinel version from the first bytes only (R-4); null if the file vanished.
function readLegacyVersion(legacyPath: string): number | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(legacyPath, "r");
    const buf = Buffer.alloc(256);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return splitSentinel(buf.subarray(0, n).toString("utf-8")).version;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// Unlocked pre-scan (R-4): the steady-state no-op (a feat lane with zero own
// sections) takes no lock and writes nothing. The locked core re-decides.
function preScanMustMigrate(lane: string, laneTasksPath: string, legacyPath: string): boolean {
  const version = readLegacyVersion(legacyPath);
  if (version === null) return false;
  return mustMigrate(lane, laneTasksPath, legacyPath, version, () => {
    try {
      return fs.readFileSync(legacyPath, "utf-8");
    } catch {
      return "";
    }
  });
}

/**
 * CORE (architecture Interface Contracts): the caller MUST already hold
 * `${laneTasksPath}.lock`, where `laneTasksPath` is
 * `resolveCurrentLanePaths(ws).tasksPath` resolved ONCE by the caller (the
 * four tools/tasks-file.ts mutators, via withFileLock) — so the lock held
 * and the ledger written can never diverge. The lane is that path's parent
 * directory name. (Deviation from the blueprint's `(ws, lane)` signature:
 * spec AC1 routes every tools/ caller through resolveCurrentLanePaths.)
 * Takes only the inner legacy-file lock. Returns true iff THIS call wrote a
 * migration (R-1). No-op (false) when the lane ledger exists, no legacy file
 * exists, the lane path is git-ignored (AC4b), or there is nothing to move
 * (D13). Throws TasksLedgerAbsentError (AC6b) and TasksMigrationBusyError.
 */
export function ensureTasksMigratedLocked(workspacePath: string, laneTasksPath: string): boolean {
  const lane = path.basename(path.dirname(laneTasksPath));
  if (fs.existsSync(laneTasksPath)) return false;
  const legacyPath = findLegacyTasksFile(workspacePath);
  if (legacyPath === null || isLanePathIgnored(workspacePath, laneTasksPath)) return false;
  if (!preScanMustMigrate(lane, laneTasksPath, legacyPath)) return false;
  return withSyncLock(`${legacyPath}.lock`, () => {
    if (fs.existsSync(laneTasksPath) || !fs.existsSync(legacyPath)) return false;
    const legacy = splitSentinel(fs.readFileSync(legacyPath, "utf-8"));
    if (!mustMigrate(lane, laneTasksPath, legacyPath, legacy.version, () => legacy.body)) return false;
    if (lane !== PRIMARY_LANE) return migrateFeatForward(legacyPath, laneTasksPath, lane, legacy);
    migratePrimaryForward(workspacePath, legacyPath, laneTasksPath, legacy.body);
    return true;
  });
}

/**
 * Self-acquiring wrapper for callers holding NO lock (parseTasksFromFile,
 * getNextTaskFromFile). Steady state (lane ledger present, nothing to
 * migrate, or an ignored lane path) touches no lock. Otherwise takes the
 * lane's tasks lock, then delegates to ensureTasksMigratedLocked. Returns
 * true iff this call migrated. Throws TasksLedgerAbsentError (AC6b) and
 * TasksMigrationBusyError (D14) — callers let both propagate.
 */
export function ensureTasksMigrated(workspacePath: string): boolean {
  const laneTasksPath = resolveCurrentLanePaths(workspacePath).tasksPath;
  if (fs.existsSync(laneTasksPath)) return false;
  const legacyPath = findLegacyTasksFile(workspacePath);
  if (legacyPath === null || isLanePathIgnored(workspacePath, laneTasksPath)) return false;
  const lane = path.basename(path.dirname(laneTasksPath));
  if (!preScanMustMigrate(lane, laneTasksPath, legacyPath)) return false;
  return withSyncLock(`${laneTasksPath}.lock`, () => ensureTasksMigratedLocked(workspacePath, laneTasksPath));
}

// ==========================================
// Reverse runners (T-E125A-03, spec D-E / D11, AC7-AC8)
// ==========================================

const V1_SENTINEL = "<!-- schema_version: 1 -->\n";
// Any tasks_moved marker naming a lane (AC6b(b) detection, reverse
// malformed-marker detection), and the full current shape (C2).
const MARKER_LANE_RE = /^<!-- tasks_moved: lane=([A-Za-z0-9_-]+) /;
const MARKER_RE = /^<!-- tasks_moved: lane=([A-Za-z0-9_-]+) run=(\d+) of=(\d+) sections=(\d+) -> /;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

// A reverse runner names its lane explicitly (it may run from any checkout),
// so it cannot go through resolveCurrentLanePaths; the filename still comes
// from the LANE_FILES registry and resolveLaneDir validates the lane name.
function laneTasksPathFor(workspacePath: string, lane: string): string {
  return path.join(resolveLaneDir(workspacePath, lane), laneFile("tasks").filename);
}

function refuse(direction: string, why: string): never {
  throw new Error(`tasks-lane-migrate (${direction}): ${why} — nothing touched`);
}

// Resolve the lane ledger + legacy file, then run `fn` under both locks in
// the fixed order (D4): lane tasks lock outer, legacy lock inner.
function withReverseLocks(
  workspacePath: string,
  lane: string,
  direction: string,
  fn: (laneTasksPath: string, legacyPath: string) => void,
): void {
  const laneTasksPath = laneTasksPathFor(workspacePath, lane);
  if (!fs.existsSync(laneTasksPath)) refuse(direction, `lane ledger ${laneTasksPath} not found`);
  const legacyPath = findLegacyTasksFile(workspacePath);
  if (legacyPath === null) refuse(direction, "no legacy tasks file found");
  withSyncLock(`${laneTasksPath}.lock`, () =>
    withSyncLock(`${legacyPath}.lock`, () => {
      if (!fs.existsSync(laneTasksPath)) refuse(direction, `lane ledger ${laneTasksPath} not found`);
      fn(laneTasksPath, legacyPath);
    }),
  );
}

function readReceiptSha(workspacePath: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(receiptPath(workspacePath), "utf-8")) as { bodySha256?: unknown };
    return typeof parsed.bodySha256 === "string" && SHA256_HEX_RE.test(parsed.bodySha256) ? parsed.bodySha256 : null;
  } catch {
    return null;
  }
}

/**
 * `_primary` reverse. Refuses, touching nothing, unless the legacy file is a
 * v2+ index carrying TASKS_INDEX_NOTICE AND the receipt's bodySha256 equals
 * primaryIndexReceiptSha(its trailing body) — or, for a receipt stamped
 * before index normalization existed, sha256 of that raw body. A missing or
 * unreadable receipt refuses too. Normalization allows exactly two root
 * edits after the forward run: removed `tasks_moved` markers and a `##
 * Closed Lanes` section; any other change refuses. (E125c, E195)
 * Then: legacy := v1 sentinel + the lane ledger's CURRENT body, minus the
 * ledger marker lines no longer in the root, with the root's Closed Lanes
 * section(s) carried to the end in place of the ledger's own, and
 * `.current/_primary/tasks.md` + the receipt are deleted. With no Closed
 * Lanes section on either side the ledger body is kept verbatim.
 * The restored root always carries a v1 sentinel, so a v0 (sentinel-less)
 * original, e.g. the `agc init` scaffold, round-trips to its body under a
 * v1 sentinel, not byte-identically.
 */
export function migratePrimaryReverse(workspacePath: string): void {
  const dir = "primary reverse";
  withReverseLocks(workspacePath, PRIMARY_LANE, dir, (laneTasksPath, legacyPath) => {
    const root = splitSentinel(fs.readFileSync(legacyPath, "utf-8"));
    const noticeLine = `${TASKS_INDEX_NOTICE}\n`;
    if (root.version < INDEX_MIN_VERSION || !root.body.startsWith(noticeLine)) {
      refuse(dir, `${legacyPath} is not a v2 tasks index carrying the E125a notice`);
    }
    const receiptSha = readReceiptSha(workspacePath);
    if (receiptSha === null) refuse(dir, `receipt ${receiptPath(workspacePath)} missing or unreadable`);
    const indexBody = root.body.slice(noticeLine.length);
    if (receiptSha !== primaryIndexReceiptSha(indexBody) && receiptSha !== sha256(indexBody)) {
      refuse(dir, `${legacyPath} body changed since the forward migration`);
    }
    const ledger = splitSentinel(fs.readFileSync(laneTasksPath, "utf-8"));
    atomicWriteRaw(legacyPath, V1_SENTINEL + restoredPrimaryBody(ledger.body, indexBody));
    fs.rmSync(laneTasksPath, { force: true });
    fs.rmSync(receiptPath(workspacePath), { force: true });
  });
}

// AC2/AC3: the v1 body the `_primary` reverse writes. Pure.
function restoredPrimaryBody(ledgerBody: string, indexBody: string): string {
  const indexLines = splitLines(indexBody).lines;
  const indexMarkers = new Set(indexLines.filter((line) => MARKER_LANE_RE.test(line)));
  const ledger = splitLines(ledgerBody);
  const lines = ledger.lines.filter((line) => !MARKER_LANE_RE.test(line) || indexMarkers.has(line));
  const own = peelClosedLanes(lines);
  const carried = peelClosedLanes(indexLines).closedLanes;
  if (own.closedLanes.length === 0 && carried.length === 0) return joinLines(lines, ledger.trailingNewline);
  return joinCanonical([...trimTrailingBlank(own.rest), ...carried]);
}

/**
 * D-E feat reverse for `lane`. The lane's markers in the legacy file must be
 * runs 1..N in document order, every one carrying the same `of=<N>`, with
 * exactly N markers (C2: a missing LAST marker refuses too; missing /
 * duplicated / out-of-order / malformed refuses). The ledger's `## ` blocks are handed back in order:
 * each marker takes the next `sections=<n>` blocks; any leftover content
 * (sections added lane-locally) goes right after the last marker's run, or
 * at the end of the file when N = 0. The legacy sentinel line is kept
 * verbatim; the ledger is deleted.
 */
export function migrateFeatReverse(workspacePath: string, lane: string): void {
  const dir = "feat reverse";
  if (lane === PRIMARY_LANE) refuse(dir, `lane ${PRIMARY_LANE} uses migratePrimaryReverse`);
  withReverseLocks(workspacePath, lane, dir, (laneTasksPath, legacyPath) => {
    const root = splitSentinel(fs.readFileSync(legacyPath, "utf-8"));
    const rootTrailingNewline = root.body.endsWith("\n");
    const rootLines = (rootTrailingNewline ? root.body.slice(0, -1) : root.body).split("\n");

    const markers: { index: number; of: number; sections: number }[] = [];
    rootLines.forEach((line, index) => {
      const named = MARKER_LANE_RE.exec(line);
      if (!named || named[1] !== lane) return;
      const m = MARKER_RE.exec(line);
      const [run, of, sections] = m ? [Number(m[2]), Number(m[3]), Number(m[4])] : [0, 0, 0];
      if (!m || line !== featMarker(lane, run, of, sections) || sections < 1) {
        refuse(dir, `malformed ${lane} marker at line ${index + 1} of ${legacyPath}`);
      }
      if (run !== markers.length + 1) {
        refuse(dir, `${lane} marker run=${run} at line ${index + 1} is missing, duplicated or out of order`);
      }
      markers.push({ index, of, sections });
    });
    if (markers.length > 0 && markers.some((mk) => mk.of !== markers.length)) {
      refuse(dir, `${markers.length} ${lane} marker(s) found but they declare of=${markers[0].of} — a marker is missing or extra`);
    }

    const { blocks } = splitBlocks(splitSentinel(fs.readFileSync(laneTasksPath, "utf-8")).body);
    const preamble = blocks.length > 0 && blocks[0].lane === null ? blocks.shift()!.lines : [];
    const needed = markers.reduce((n, mk) => n + mk.sections, 0);
    if (blocks.length < needed) {
      refuse(dir, `${laneTasksPath} holds ${blocks.length} sections but the markers expect ${needed}`);
    }
    // Leftovers = a non-blank preamble + every block past the markers' runs.
    const extras = [
      ...(preamble.every((l) => l.trim() === "") ? [] : preamble),
      ...blocks.slice(needed).flatMap((b) => b.lines),
    ];
    const runAt = new Map(markers.map((mk, i) => [mk.index, i]));
    let next = 0;
    const out: string[] = [];
    rootLines.forEach((line, index) => {
      const i = runAt.get(index);
      if (i === undefined) {
        out.push(line);
        return;
      }
      out.push(...blocks.slice(next, next + markers[i].sections).flatMap((b) => b.lines));
      next += markers[i].sections;
      if (i === markers.length - 1) out.push(...extras);
    });
    let trailingNewline = rootTrailingNewline;
    if (markers.length === 0 && extras.length > 0) {
      if (out.length === 1 && out[0] === "") out.length = 0; // empty legacy body
      out.push(...extras);
      trailingNewline = true;
    }
    atomicWriteRaw(legacyPath, root.header + out.join("\n") + (trailingNewline ? "\n" : ""));
    fs.rmSync(laneTasksPath, { force: true });
  });
}
