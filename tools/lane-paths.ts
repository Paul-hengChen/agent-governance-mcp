// Coded by @sr-engineer
// Lane-layout seam. The CANONICAL and ONLY owner of the set of lane-scoped
// `.current/` filenames: every consumer — resolveLanePaths below,
// tools/lane-migrate.ts's two runners, tools/dispatch-log.ts's sidecar name —
// derives its file set by iterating LANE_FILES, never by restating a
// filename. Adding a lane file later is one LANE_FILES entry plus a schema
// migration step (see the `tasks` entry below for an example). (E123)
//
// resolveLanePaths returns lane-scoped `.current/<lane>/<filename>` paths.
// Every production lane-file call site goes through resolveCurrentLanePaths
// (tools/handoff-parse.ts, tools/handoff-write.ts, tools/drift.ts,
// tools/telemetry.ts, tools/metrics.ts, tools/dispatch-log.ts,
// guards/session.ts, prompts/build.ts, both bin/ hooks), so they all get
// lane-scoped paths. The flat `.current/<filename>` layout is legacy —
// reached only through tools/lane-migrate.ts's runners, never written by a
// live writer.
//
// Pure path/string logic everywhere EXCEPT three read-only functions:
// resolveCurrentLane (statSync / readFileSync on `.git` and HEAD),
// enumerateLaneSidecarSources (readdir / readFile over `.current/`), and
// hasHistoryLedger (readdir / stat over `.current/history/`) — never a git
// subprocess, never a write. No imports beyond `fs` and `path`.

import * as fs from "fs";
import * as path from "path";

export interface LaneFileEntry {
  readonly key: string;
  readonly filename: string;
  // true === the lane cannot exist without it (the migration runner throws if
  // absent); false === optional sidecar, skipped silently when absent.
  readonly required: boolean;
  // True iff this entry's legacy (pre-lane) location is NOT flat
  // `.current/<filename>` — its legacy resolution belongs to another module
  // (tools/config.ts's taskPaths, for "tasks"). The flat<->lane runners in
  // tools/lane-migrate.ts skip such an entry when planning moves; its
  // transition belongs to the tasks lane migration instead. (E125a)
  readonly noFlatCounterpart?: true;
}

// The registry. Exactly 8 entries — 1 required, 7 optional.
// `.current/.config.json`, a workspace's exemptions.json, and
// .current/feature-split.md are deliberately NOT lane files. (E123)
//
// pendingTickets: a lane's filed-but-unnumbered findings (the format parsed
// by tools/lane-ticket-allocation.ts), applied to docs/backlog.md by `agc
// feature finish`. `required: false` is load-bearing — a lane that files no
// finding has no such file, and a required entry would make every ordinary
// lane->flat migration refuse. Unlike the four JSONL sidecars it is
// committed markdown, so tools/lane-migrate.ts never concatenate-merges it.
// (E179)
//
// tasks: the lane-local task ledger `.current/<lane>/tasks.md`.
// `required: false` — a lane with no tasks has no ledger.
// `noFlatCounterpart` — its legacy location is the taskPaths-resolved root
// file, not `.current/tasks.md`, so the flat<->lane runners never move it.
// (E125a)
//
// baseSha: `.current/<lane>/base-sha`, the fork-point commit `agc feature
// start` resolved (40/64-hex sha, plain text), read back by `agc feature
// finish --shipped` for the `lane_closed:` pointer line. It MUST be
// registered: a file inside `.current/<lane>/` that is not a LANE_FILES
// entry makes tools/lane-migrate.ts's lane->flat runner refuse the whole
// lane. `required: false` + a non-`.jsonl` name, exactly like pendingTickets
// (never concatenate-merged; identical bytes at both ends drop, different
// bytes refuse). Deliberately NO noFlatCounterpart: no other migration
// module owns its flat<->lane transition, so the flat<->lane runners must
// move it. (E125b)
export const LANE_FILES = [
  { key: "handoff", filename: "handoff.md", required: true },
  { key: "telemetry", filename: "telemetry.jsonl", required: false },
  { key: "metrics", filename: "metrics.jsonl", required: false },
  { key: "usage", filename: "usage.jsonl", required: false },
  { key: "dispatch", filename: "dispatch.jsonl", required: false },
  { key: "pendingTickets", filename: "pending-tickets.md", required: false },
  { key: "tasks", filename: "tasks.md", required: false, noFlatCounterpart: true },
  { key: "baseSha", filename: "base-sha", required: false },
] as const satisfies ReadonlyArray<LaneFileEntry>;

export type LaneFileKey = (typeof LANE_FILES)[number]["key"];

export interface LanePaths {
  handoffPath: string;
  telemetryPath: string;
  metricsPath: string;
  usagePath: string;
  dispatchLogPath: string;
  pendingTicketsPath: string;
  tasksPath: string;
  baseShaPath: string;
}

// Registry key -> LanePaths field name. Keys only, never filenames (AC15 is
// about filenames). Typed as a total Record over LaneFileKey, so adding a
// LANE_FILES entry without a matching field here (and in LanePaths) is a
// compile error rather than a silently missing path.
const LANE_PATH_FIELD: Record<LaneFileKey, keyof LanePaths> = {
  handoff: "handoffPath",
  telemetry: "telemetryPath",
  metrics: "metricsPath",
  usage: "usagePath",
  dispatch: "dispatchLogPath",
  pendingTickets: "pendingTicketsPath",
  tasks: "tasksPath",
  baseSha: "baseShaPath",
};

// Look up one registry entry by key. enumerateLaneSidecarSources below
// derives a sidecar's filename from it; the lane-paths/dispatch-log tests
// use it too. (E123)
export function laneFile(key: LaneFileKey): LaneFileEntry {
  const entry = LANE_FILES.find((f) => f.key === key);
  // Unreachable for a well-typed key; guards a hand-built cast.
  if (!entry) throw new Error(`lane-paths: unknown lane file key "${String(key)}"`);
  return entry;
}

// Basename of the handoff lockfile (e123b8 J1, spec AC3): the ONE owner of
// the literal. tools/handoff-write.ts (writeHandoffState) and
// tools/lane-migrate.ts (both runners) import it; no other copy of this
// literal may exist under tools/. Not a LANE_FILES entry: it is a lock, not
// lane state. e123b9 J2 (spec AC5, Decision 2, human 2026-09-23): the lock is
// PER-LANE at `.current/<lane>/${HANDOFF_LOCK_FILENAME}` — see
// resolveLaneLockPath below, the one place that path is composed.
export const HANDOFF_LOCK_FILENAME = ".handoff.lock";

// Lane name used when a flat handoff's active_feature carries no parseable
// ticket id (absent / empty / no leading id token).
export const LEGACY_LANE = "_legacy";

// Lane name for a workspace whose checked-out branch carries no ticket id
// (main, integ/*, fix/*, detached HEAD, no/unreadable .git). Returned ONLY by
// the live resolver (resolveCurrentLane) — never by resolveLaneName.
export const PRIMARY_LANE = "_primary";

// Leading ticket-id token: letters, then one digit, then optional trailing
// alphanumerics, terminated by "-" or end of string ("e163-ci-gate-ordering"
// -> "e163", "e123a-lane-layout-migration" -> "e123a", "e123b0" -> "e123b0").
// The single owner of the pattern: resolveLaneName and resolveCurrentLane
// both use it. The captured set is [a-z0-9] only, so the result is always a
// safe single path segment.
// Exactly ONE mandatory digit, then [a-z0-9]*: writing `\d+[a-z0-9]*` would
// let two adjacent quantifiers both claim a digit run, so a long digit
// string with no terminator would backtrack quadratically. The accepted
// language is identical (`\d+[a-z0-9]*` == `\d[a-z0-9]*`), and so is the
// capture — both quantifiers are greedy and anchored by (?:-|$). (E123)
const TICKET_ID_RE = /^([a-z]+\d[a-z0-9]*)(?:-|$)/i;

/**
 * Derive a lane name from a handoff's active_feature: the lowercased
 * leading ticket-id token, else LEGACY_LANE.
 *
 * The flat->lane migration does NOT use this — it targets the branch-based
 * live resolver instead. Kept exported for "what lane would this
 * active_feature imply" lookups; no production caller today.
 *
 * MUST NEVER return PRIMARY_LANE ("_primary") — the branch-based resolution
 * (feat/<id>-*) and its PRIMARY_LANE fallback belong to the LIVE resolver
 * (resolveCurrentLane below), not this function. Shares TICKET_ID_RE with
 * it. (E123)
 */
export function resolveLaneName(activeFeature: string | undefined): string {
  if (typeof activeFeature !== "string") return LEGACY_LANE;
  const m = TICKET_ID_RE.exec(activeFeature.trim());
  return m ? m[1].toLowerCase() : LEGACY_LANE;
}

// A lane name must be ONE safe path segment directly under `.current/` — no
// separators, no "." / ".." traversal, not empty. Every lane this module
// produces (resolveLaneName, resolveCurrentLane, LEGACY_LANE, PRIMARY_LANE)
// satisfies it by construction; the check guards caller-supplied names
// (tools/lane-migrate.ts's reverse runner, any future lane argument) so a
// lane can never resolve to a path outside `.current/<lane>/`.
const SAFE_LANE_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** true iff `lane` is a single safe path segment (see SAFE_LANE_RE). */
export function isSafeLaneName(lane: unknown): lane is string {
  return typeof lane === "string" && SAFE_LANE_RE.test(lane);
}

function assertSafeLaneName(lane: unknown, who: string): asserts lane is string {
  if (!isSafeLaneName(lane)) {
    throw new Error(
      `${who}: invalid lane name ${JSON.stringify(lane)} — must be a single path ` +
        `segment matching ${SAFE_LANE_RE}`,
    );
  }
}

/** `<workspacePath>/.current/<lane>` — the directory holding a lane's files. */
export function resolveLaneDir(workspacePath: string, lane: string): string {
  assertSafeLaneName(lane, "lane-paths");
  return path.join(workspacePath, ".current", lane);
}

// ==========================================
// Closed-lane history buckets (E125b)
// ==========================================

/**
 * The `.current/history/<bucket>/` month bucket for a lane closed at `now`:
 * the UTC year-month, `YYYY-MM`. Always satisfies HISTORY_BUCKET_RE. (E125b)
 */
export function resolveHistoryBucket(now: Date = new Date()): string {
  const y = String(now.getUTCFullYear()).padStart(4, "0");
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * `<workspacePath>/.current/history/<bucket>/<lane>` — where a closed lane's
 * `.current/<lane>/` directory lands. Throws on a `bucket` that is not
 * exactly `YYYY-MM` (HISTORY_BUCKET_RE) or an unsafe `lane` (not a single
 * path segment), so it can never return a path outside
 * `.current/history/<bucket>/`. Pure path logic — creates nothing. (E125b)
 */
export function resolveHistoryLaneDir(workspacePath: string, bucket: string, lane: string): string {
  if (typeof bucket !== "string" || !HISTORY_BUCKET_RE.test(bucket)) {
    throw new Error(
      `lane-paths: invalid history bucket ${JSON.stringify(bucket)} — must match ${HISTORY_BUCKET_RE}`,
    );
  }
  assertSafeLaneName(lane, "lane-paths");
  return path.join(workspacePath, ".current", "history", bucket, lane);
}

/**
 * true iff some `.current/history/<bucket>/<lane>/<filename>` exists as a
 * regular file, for any HISTORY_BUCKET_RE bucket — i.e. lane `lane` has
 * closed with that file in its history. Read-only (readdir / stat); never
 * throws — an unlistable dir, an unsafe lane or filename, or an fs error all
 * read as false (like enumerateLaneSidecarSources). (E125b)
 */
export function hasHistoryLedger(workspacePath: string, lane: string, filename: string): boolean {
  if (!isSafeLaneName(lane)) return false;
  if (typeof filename !== "string" || filename === "" || filename !== path.basename(filename)) return false;
  if (filename === "." || filename === "..") return false;
  const historyDir = path.join(workspacePath, ".current", "history");
  for (const bucket of listDirNames(historyDir)) {
    if (!HISTORY_BUCKET_RE.test(bucket)) continue;
    try {
      if (fs.statSync(path.join(historyDir, bucket, lane, filename)).isFile()) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Lane-scoped paths: returns `<workspacePath>/.current/<lane>/<filename>`
 * for every LANE_FILES entry. The shape is derived by iterating LANE_FILES —
 * the filenames are never restated here. Throws on an unsafe `lane` (not a
 * single path segment); every lane the resolvers in this module produce is
 * safe by construction, so production callers (all via
 * resolveCurrentLanePaths) never hit that throw. (E123)
 */
export function resolveLanePaths(workspacePath: string, lane: string): LanePaths {
  const dir = resolveLaneDir(workspacePath, lane);
  const out: Partial<LanePaths> = {};
  for (const entry of LANE_FILES) {
    out[LANE_PATH_FIELD[entry.key]] = path.join(dir, entry.filename);
  }
  return out as LanePaths;
}

/**
 * Per-lane handoff lock path (e123b9 J2, spec AC5, Decision 2):
 * `<workspacePath>/.current/<lane>/${HANDOFF_LOCK_FILENAME}`. The single
 * composer of the lock path: tools/lane-migrate.ts's runners use it for the
 * migration's destination lane, and a live writer (tools/handoff-write.ts,
 * T-E123B9-02) uses it for the current branch's lane, so the migration and a
 * live writer of the SAME lane serialize on the SAME lockfile. Pure path
 * logic — does not create the lane directory; the lock acquirer does that
 * (withFileLock mkdirs the lock's parent before its O_EXCL open).
 */
export function resolveLaneLockPath(workspacePath: string, lane: string): string {
  return path.join(resolveLaneDir(workspacePath, lane), HANDOFF_LOCK_FILENAME);
}

// `ref: refs/heads/<branch>` — the only HEAD shape that names a branch. A
// detached HEAD is a bare sha and does not match.
const HEAD_REF_RE = /^ref:\s*refs\/heads\/(\S+)$/;
const GITDIR_RE = /^gitdir:\s*(.+)$/;
const FEAT_PREFIX = "feat/";

// Locate the HEAD file for `workspacePath` by pure fs: `.git` directory ->
// `.git/HEAD`; `.git` gitfile (`gitdir: <path>`, a linked worktree or
// submodule) -> `<gitdir>/HEAD`, a relative gitdir resolved against the
// workspace. Returns null for a missing `.git` or a malformed gitfile.
// May throw on an fs error; the caller swallows it.
function headFilePath(workspacePath: string): string | null {
  const dotGit = path.join(workspacePath, ".git");
  const st = fs.statSync(dotGit, { throwIfNoEntry: false });
  if (!st) return null;
  if (st.isDirectory()) return path.join(dotGit, "HEAD");
  if (!st.isFile()) return null;
  const m = GITDIR_RE.exec(fs.readFileSync(dotGit, "utf-8").trim());
  if (!m) return null;
  const gitdir = m[1].trim();
  if (gitdir === "") return null;
  return path.join(path.resolve(workspacePath, gitdir), "HEAD");
}

/**
 * LIVE lane resolver (e123b0 spec AC2, D1): name the lane of the branch
 * currently checked out in `workspacePath`, by pure fs (no git subprocess, no
 * network — the tools/drift.ts precedent).
 *
 * `feat/<rest>` where `<rest>` starts with a ticket-id token -> the lowercased
 * id (`feat/e123b1-core-write-path` -> `e123b1`). Anything else — `main`,
 * `integ/*`, `fix/*`, a `feat/` branch with no id token, a detached HEAD, a
 * missing `.git`, an unreadable or malformed `.git`/HEAD — -> PRIMARY_LANE.
 *
 * NEVER throws. Production callers reach it through resolveCurrentLanePaths
 * (see the file header for the list).
 */
export function resolveCurrentLane(workspacePath: string): string {
  try {
    const headPath = headFilePath(workspacePath);
    if (headPath === null) return PRIMARY_LANE;
    const ref = HEAD_REF_RE.exec(fs.readFileSync(headPath, "utf-8").trim());
    if (!ref) return PRIMARY_LANE;
    const branch = ref[1];
    if (!branch.startsWith(FEAT_PREFIX)) return PRIMARY_LANE;
    const id = TICKET_ID_RE.exec(branch.slice(FEAT_PREFIX.length));
    return id ? id[1].toLowerCase() : PRIMARY_LANE;
  } catch {
    return PRIMARY_LANE;
  }
}

/**
 * The current lane's paths (e123b0 spec AC4): resolveLanePaths over
 * resolveCurrentLane. Since the e123b9 J2 flip this returns genuinely
 * lane-scoped `.current/<lane>/<filename>` paths — `.current/_primary/...`
 * on a primary checkout, `.current/<ticket-id>/...` on a `feat/<id>-*` lane.
 */
export function resolveCurrentLanePaths(workspacePath: string): LanePaths {
  return resolveLanePaths(workspacePath, resolveCurrentLane(workspacePath));
}

/**
 * Legacy flat paths: `<workspacePath>/.current/<filename>` for every
 * LANE_FILES entry — the old layout a not-yet-migrated workspace still
 * holds. Read-only fallbacks (tools/drift.ts's skew precheck,
 * bin/agent-governance-usage-hook.mjs, enumerateLaneSidecarSources) resolve
 * the flat copy through this one composer instead of restating a filename.
 * No live writer targets these paths. (E123)
 */
export function resolveFlatLanePaths(workspacePath: string): LanePaths {
  const dir = path.join(workspacePath, ".current");
  const out: Partial<LanePaths> = {};
  for (const entry of LANE_FILES) {
    out[LANE_PATH_FIELD[entry.key]] = path.join(dir, entry.filename);
  }
  return out as LanePaths;
}

// ==========================================
// Cross-lane sidecar aggregation (E123)
// ==========================================

/**
 * true iff `candidate`'s bytes are identical to, or a prefix of,
 * `authority`'s bytes. THE one byte-prefix predicate for "already counted":
 * tools/lane-migrate.ts's flat->lane resume check (a flat sidecar whose bytes
 * already lead the lane file = a merge that published but died before
 * unlinking the flat source) and enumerateLaneSidecarSources's read-side
 * dedup both use it, so the migrator and the aggregating readers agree on
 * what "already counted" means. (E123)
 */
export function isBytePrefix(candidate: Buffer, authority: Buffer): boolean {
  return (
    authority.length >= candidate.length &&
    authority.subarray(0, candidate.length).equals(candidate)
  );
}

// `.current/` subdirectories that are never lanes (e123b9 spec AC7). Files
// (.config.json, feature-split.md, ...) are excluded by the isDirectory()
// check, dot-dirs by isSafeLaneName.
export const NON_LANE_DIRS: ReadonlySet<string> = new Set(["archive", "history"]);

// A `.current/history/<bucket>/` month bucket.
export const HISTORY_BUCKET_RE = /^\d{4}-\d{2}$/;

export type LaneSidecarSourceKind = "live" | "history" | "flat";

export interface LaneSidecarSource {
  path: string;
  kind: LaneSidecarSourceKind;
  // The lane directory name; null for the flat source.
  lane: string | null;
  // The exact bytes the dedup decision was made on — callers parse THESE,
  // never a re-read, so the counted content is the compared content.
  bytes: Buffer;
}

export interface SkippedLaneSidecarSource {
  path: string;
  kind: "history" | "flat";
  lane: string | null;
  // The source whose bytes begin with (or equal) the skipped file's bytes —
  // where its records are counted instead.
  authorityPath: string;
}

export interface LaneSidecarSources {
  // Every source to count, in order: flat, then history (bucket asc, lane
  // asc), then live (lane asc).
  sources: LaneSidecarSource[];
  // Every existing, non-empty source skipped by the content rule.
  skipped: SkippedLaneSidecarSource[];
}

function listDirNames(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// null = absent / not a regular file / unreadable.
function readFileBytes(p: string): Buffer | null {
  try {
    if (!fs.statSync(p).isFile()) return null;
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

/**
 * Every copy of one lane sidecar (`telemetry` / `metrics` / `usage` / ...)
 * a workspace's own `.current/` tree holds, deduplicated by CONTENT. Scope
 * is this workspace only — never a sibling worktree. (E123)
 *
 * Sources:
 *   live    `.current/<lane>/<file>` for each safe lane dir other than
 *           NON_LANE_DIRS;
 *   history `.current/history/<YYYY-MM>/<lane>/<file>` — two buckets holding
 *           the same lane name are distinct closures, both kept;
 *   flat    the legacy `.current/<file>`.
 *
 * Dedup (never by name alone — a long-lived lane such as `_primary` keeps
 * its live dir AND its history dirs):
 *   - a history copy of lane L is skipped iff isBytePrefix(history, live L)
 *     — a copy caught mid-move;
 *   - the flat file is skipped iff isBytePrefix(flat, X) for some counted
 *     lane copy X (live first, then history) — the shape an interrupted
 *     mergeSidecar leaves: `flat ++ lane` published at the lane path, flat
 *     not yet unlinked. Any lane is checked, not only the
 *     current branch's: the branch may have changed since the migration, and
 *     the lane may since have closed into history.
 * Empty files are never skipped (they contribute zero records either way).
 *
 * Strictly read-only; never throws — an unlistable dir or unreadable file is
 * simply not a source.
 */
export function enumerateLaneSidecarSources(
  workspacePath: string,
  key: LaneFileKey,
): LaneSidecarSources {
  const filename = laneFile(key).filename;
  const currentDir = path.join(workspacePath, ".current");
  const historyDir = path.join(currentDir, "history");

  const live: LaneSidecarSource[] = [];
  for (const lane of listDirNames(currentDir)) {
    if (NON_LANE_DIRS.has(lane) || !isSafeLaneName(lane)) continue;
    const p = path.join(currentDir, lane, filename);
    const bytes = readFileBytes(p);
    if (bytes !== null) live.push({ path: p, kind: "live", lane, bytes });
  }
  const liveByLane = new Map(live.map((s) => [s.lane, s]));

  const skipped: SkippedLaneSidecarSource[] = [];
  const history: LaneSidecarSource[] = [];
  for (const bucket of listDirNames(historyDir)) {
    if (!HISTORY_BUCKET_RE.test(bucket)) continue;
    for (const lane of listDirNames(path.join(historyDir, bucket))) {
      if (!isSafeLaneName(lane)) continue;
      const p = path.join(historyDir, bucket, lane, filename);
      const bytes = readFileBytes(p);
      if (bytes === null) continue;
      const liveCopy = liveByLane.get(lane);
      if (bytes.length > 0 && liveCopy && isBytePrefix(bytes, liveCopy.bytes)) {
        skipped.push({ path: p, kind: "history", lane, authorityPath: liveCopy.path });
        continue;
      }
      history.push({ path: p, kind: "history", lane, bytes });
    }
  }

  const flat: LaneSidecarSource[] = [];
  const flatPath = path.join(currentDir, filename);
  const flatBytes = readFileBytes(flatPath);
  if (flatBytes !== null) {
    const authority =
      flatBytes.length > 0
        ? [...live, ...history].find((s) => isBytePrefix(flatBytes, s.bytes))
        : undefined;
    if (authority) {
      skipped.push({ path: flatPath, kind: "flat", lane: null, authorityPath: authority.path });
    } else {
      flat.push({ path: flatPath, kind: "flat", lane: null, bytes: flatBytes });
    }
  }

  return { sources: [...flat, ...history, ...live], skipped };
}
