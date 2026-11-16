// Coded by @sr-engineer
// Post-merge ledger/sidecar preservation check (E126), the git-native
// complement to tw_detect_drift: for merge commit M (parents P1, P2, base B),
// task ids and [x] marks at P1/P2 survive at M (or COMPACTED), and every
// sidecar (kind, lane) has count(M) >= P1 + P2 - B. Reads trees through git,
// never the working directory; fires no gate and writes nothing.
// Why: specs/e260b-rationale.md (tools/merge-invariants.ts)

import { execFileSync } from "node:child_process";
import { resolveTaskRegex } from "./config.js";
import { HISTORY_BUCKET_RE, isBytePrefix, isSafeLaneName, NON_LANE_DIRS } from "./lane-paths.js";
import { SECTION_HEADING_RE } from "./tasks-lane-migrate.js";

// --- exit-code table ---------------------------------------------------------
export const MERGE_INVARIANTS_EXIT = {
  PASS: 0,
  FAIL: 1,
  NOT_A_MERGE_COMMIT: 2,
  NO_MERGE_BASE: 3,
  USAGE_ERROR: 4,
} as const;
export type MergeInvariantsCode = keyof typeof MERGE_INVARIANTS_EXIT;

export const MERGE_INVARIANTS_USAGE =
  "Usage: node scripts/merge-invariants.mjs [<merge-ref> | --ref <merge-ref>] [<absolute-repo-root>]\n" +
  "  merge-ref defaults to HEAD; repo-root defaults to the current directory.\n" +
  "  exit: 0 PASS, 1 FAIL, 2 NOT_A_MERGE_COMMIT, 3 NO_MERGE_BASE, 4 USAGE_ERROR";

// =============================================================================
// git-tree read layer
// =============================================================================

export type RowState = " " | "x" | "-";
export const SIDECAR_KINDS = ["dispatch", "telemetry", "metrics", "usage"] as const;
export type SidecarKind = (typeof SIDECAR_KINDS)[number];

export interface TaskRow {
  taskId: string;
  state: RowState;
  file: string;
  /** Enclosing `## ` heading text (trimmed), null before any H2 / after an H1. */
  section: string | null;
}
export interface ManifestEntry {
  done: number;
  voided: number;
}
export interface LedgerSnapshot {
  file: string;
  rows: TaskRow[];
  /** `## Compacted History` bullets keyed by section heading text; null = no manifest. */
  manifest: Map<string, ManifestEntry> | null;
}
export interface SidecarCount {
  kind: SidecarKind;
  lane: string | null;
  records: number;
  paths: string[];
}
export interface CommitSnapshot {
  label: string;
  sha: string;
  ledgers: Map<string, LedgerSnapshot>;
  rowsById: Map<string, TaskRow[]>;
  /** keyed by sidecarKey(kind, lane) */
  sidecars: Map<string, SidecarCount>;
}

/** Thrown for anything that must surface as USAGE_ERROR rather than a stack trace. */
export class MergeInvariantsUsageError extends Error {}

const GIT_MAX_BUFFER = 512 * 1024 * 1024;

function git(repoRoot: string, args: string[]): Buffer {
  return execFileSync("git", args, {
    cwd: repoRoot,
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** History-walk reads: a partial clone's missing object fails instead of triggering a network fetch. */
function gitWalk(repoRoot: string, args: string[]): Buffer {
  return execFileSync("git", args, {
    cwd: repoRoot,
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
  });
}

/** Ledger path shape per spec Definitions → Row identity; null = not a ledger. */
export function isLedgerPath(p: string): boolean {
  if (p === "tasks.md") return true;
  const s = p.split("/");
  if (s[0] !== ".current" || s[s.length - 1] !== "tasks.md") return false;
  if (s.length === 3) return isSafeLaneName(s[1]) && !NON_LANE_DIRS.has(s[1]);
  return s.length === 5 && s[1] === "history" && HISTORY_BUCKET_RE.test(s[2]) && isSafeLaneName(s[3]);
}

export interface SidecarPathInfo {
  kind: SidecarKind;
  lane: string | null;
  source: "flat" | "live" | "history";
}

/** Sidecar path shape (flat / live lane / history lane); null = not a sidecar. */
export function classifySidecarPath(p: string): SidecarPathInfo | null {
  const s = p.split("/");
  if (s[0] !== ".current") return null;
  const kind = SIDECAR_KINDS.find((k) => s[s.length - 1] === `${k}.jsonl`);
  if (!kind) return null;
  if (s.length === 2) return { kind, lane: null, source: "flat" };
  if (s.length === 3 && isSafeLaneName(s[1]) && !NON_LANE_DIRS.has(s[1])) {
    return { kind, lane: s[1], source: "live" };
  }
  if (s.length === 5 && s[1] === "history" && HISTORY_BUCKET_RE.test(s[2]) && isSafeLaneName(s[3])) {
    return { kind, lane: s[3], source: "history" };
  }
  return null;
}

export function sidecarKey(kind: SidecarKind, lane: string | null): string {
  return `${kind}/${lane ?? ""}`; // lane names are never empty (isSafeLaneName)
}

const VOID_PREFIX_RE = /^- \[-\] /;
const COMPACTED_SECTION = "Compacted History";
const COMPACTED_MARKER_RE = /^<!--\s*compacted:/;
const MANIFEST_BULLET_RE = /^- (.+): (\d+) done, (\d+) voided\s*$/;

/**
 * Parse one ledger's text: checkbox rows (via the workspace's configured task
 * regex; the `[-]` void marker is normalized to `[ ]` for id extraction only)
 * and the `## Compacted History` manifest, which counts ONLY when its first
 * non-blank line is the `<!-- compacted: ... -->` marker.
 */
export function parseLedger(file: string, content: string, taskRegex: RegExp): LedgerSnapshot {
  const rows: TaskRow[] = [];
  let manifest: Map<string, ManifestEntry> | null = null;
  let section: string | null = null;
  let manifestState: "none" | "await-marker" | "active" = "none";
  for (const raw of content.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const h2 = SECTION_HEADING_RE.exec(line);
    if (h2 || /^#\s/.test(line)) {
      section = h2 ? h2[1].trim() : null;
      manifestState = section === COMPACTED_SECTION ? "await-marker" : "none";
      continue;
    }
    if (manifestState === "await-marker") {
      if (line.trim() === "") continue;
      if (COMPACTED_MARKER_RE.test(line)) {
        manifestState = "active";
        manifest ??= new Map();
        continue;
      }
      manifestState = "none";
    }
    if (manifestState === "active" && manifest) {
      const b = MANIFEST_BULLET_RE.exec(line);
      if (b) {
        const prev = manifest.get(b[1]) ?? { done: 0, voided: 0 };
        manifest.set(b[1], { done: prev.done + Number(b[2]), voided: prev.voided + Number(b[3]) });
        continue;
      }
    }
    // R-2: the identical per-line rule tools/tasks-file.ts's row parsers apply
    // (`line.trim()` before the row regex, in parseTasks and addTaskInFile), so
    // an indented row they count is never invisible here.
    const rowLine = line.trim();
    const isVoid = VOID_PREFIX_RE.test(rowLine);
    const m = taskRegex.exec(isVoid ? rowLine.replace(VOID_PREFIX_RE, "- [ ] ") : rowLine);
    if (!m || m[2] === undefined) continue;
    const state: RowState = isVoid ? "-" : m[1] === "x" ? "x" : " ";
    rows.push({ taskId: m[2], state, file, section });
  }
  return { file, rows, manifest };
}

function countNewlines(buf: Buffer): number {
  let n = 0;
  for (const byte of buf) if (byte === 0x0a) n++;
  return n;
}

interface TreeBlob {
  path: string;
  blob: string;
}

/**
 * Read one commit's ledgers + sidecars from git objects. `blobCache` is shared
 * across the four commits of one run so an unchanged file is read once.
 */
export function readCommitSnapshot(
  repoRoot: string,
  sha: string,
  label: string,
  taskRegex: RegExp,
  blobCache: Map<string, Buffer> = new Map(),
): CommitSnapshot {
  const entries: TreeBlob[] = [];
  for (const rec of git(repoRoot, ["ls-tree", "-r", "-z", sha]).toString("utf8").split("\0")) {
    const tab = rec.indexOf("\t");
    if (tab < 0) continue;
    const [mode, type, blob] = rec.slice(0, tab).split(" ");
    if (type !== "blob" || !mode.startsWith("100")) continue; // regular files only
    entries.push({ path: rec.slice(tab + 1), blob });
  }
  const read = (b: string): Buffer => {
    let buf = blobCache.get(b);
    if (!buf) {
      buf = git(repoRoot, ["cat-file", "blob", b]);
      blobCache.set(b, buf);
    }
    return buf;
  };

  const ledgers = new Map<string, LedgerSnapshot>();
  const rowsById = new Map<string, TaskRow[]>();
  const sidecarFiles: Array<SidecarPathInfo & { path: string; bytes: Buffer }> = [];
  for (const e of entries) {
    if (isLedgerPath(e.path)) {
      const ledger = parseLedger(e.path, read(e.blob).toString("utf8"), taskRegex);
      ledgers.set(e.path, ledger);
      for (const r of ledger.rows) {
        const list = rowsById.get(r.taskId);
        if (list) list.push(r);
        else rowsById.set(r.taskId, [r]);
      }
      continue;
    }
    const info = classifySidecarPath(e.path);
    if (info) sidecarFiles.push({ ...info, path: e.path, bytes: read(e.blob) });
  }
  return { label, sha, ledgers, rowsById, sidecars: dedupSidecars(sidecarFiles) };
}

/**
 * Same content-dedup rule as tools/lane-paths.ts enumerateLaneSidecarSources
 * (which reads the live filesystem, so it cannot be reused against a commit):
 * a history copy of lane L is skipped iff it is a byte-prefix of live L; the
 * flat copy is skipped iff it is a byte-prefix of any counted lane copy.
 */
function dedupSidecars(
  files: Array<SidecarPathInfo & { path: string; bytes: Buffer }>,
): Map<string, SidecarCount> {
  const out = new Map<string, SidecarCount>();
  const add = (kind: SidecarKind, lane: string | null, path: string, bytes: Buffer): void => {
    const key = sidecarKey(kind, lane);
    const cur = out.get(key) ?? { kind, lane, records: 0, paths: [] };
    cur.records += countNewlines(bytes);
    cur.paths.push(path);
    out.set(key, cur);
  };
  for (const kind of SIDECAR_KINDS) {
    const ofKind = files.filter((f) => f.kind === kind);
    const live = ofKind.filter((f) => f.source === "live");
    const liveByLane = new Map(live.map((f) => [f.lane, f]));
    const counted = [...live];
    for (const h of ofKind.filter((f) => f.source === "history")) {
      const lc = liveByLane.get(h.lane);
      if (h.bytes.length > 0 && lc && isBytePrefix(h.bytes, lc.bytes)) continue;
      counted.push(h);
    }
    for (const fl of ofKind.filter((f) => f.source === "flat")) {
      if (fl.bytes.length > 0 && counted.some((c) => isBytePrefix(fl.bytes, c.bytes))) continue;
      counted.push(fl);
    }
    for (const c of counted) add(kind, c.lane, c.path, c.bytes);
  }
  return out;
}

// =============================================================================
// condition (c) history: rows a one-sided compaction summarized after the base
// =============================================================================

export const HISTORY_COMMIT_CAP = 256;
export type HistoryFallbackReason = "shallow" | "unreadable" | "cap" | "unreconciled";

/** One walk: compacting parent P_c, ledger file F, the sections whose verdict depends on it, sorted. */
export interface HistoryRequest {
  parent: CommitSnapshot;
  file: string;
  sections: string[];
}

/** Walk outcome for one F/S. `summarized` = recovered task_id -> counted state; null = snapshot-only rule. */
export interface SectionHistory {
  parent: string; // "parent1" | "parent2"
  parentSha: string;
  file: string;
  section: string;
  summarized: Map<string, RowState> | null;
  /** Non-null => one WARN line; the section keeps the snapshot-only rule. */
  fallback: { reason: HistoryFallbackReason; detail: string } | null;
}

export interface HistoryFallback {
  parent: string;
  parentSha: string;
  file: string;
  section: string;
  reason: HistoryFallbackReason;
  /** The text after the class keyword in the WARN line ("" for shallow). */
  detail: string;
}

const ZERO_ENTRY: ManifestEntry = { done: 0, voided: 0 };
const entryOf = (ledger: LedgerSnapshot | undefined, section: string): ManifestEntry =>
  ledger?.manifest?.get(section) ?? ZERO_ENTRY;
const isKeptAt = (snap: CommitSnapshot, taskId: string): boolean => (snap.rowsById.get(taskId)?.length ?? 0) > 0;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function splitOf(states: Map<string, RowState>): ManifestEntry {
  let done = 0;
  let voided = 0;
  for (const s of states.values()) {
    if (s === "x") done++;
    else voided++;
  }
  return { done, voided };
}

/**
 * Sections whose (c) verdict depends on history: the merge's F names S (t1),
 * exactly one parent's F names S (t2, that parent is P_c), and the other
 * parent has a closed row under F/S that is nowhere at the merge (t3).
 * Grouped per (P_c, F); empty means no extra git call at all.
 */
export function compactionHistoryRequests(
  p1: CommitSnapshot,
  p2: CommitSnapshot,
  _base: CommitSnapshot,
  merge: CommitSnapshot,
): HistoryRequest[] {
  const byParentFile = new Map<string, HistoryRequest>();
  for (const [file, mergeLedger] of merge.ledgers) {
    if (!mergeLedger.manifest) continue;
    for (const section of mergeLedger.manifest.keys()) {
      const namers = [p1, p2].filter((p) => p.ledgers.get(file)?.manifest?.has(section) === true);
      if (namers.length !== 1) continue;
      const compactor = namers[0];
      const other = compactor === p1 ? p2 : p1;
      const droppable = (other.ledgers.get(file)?.rows ?? []).some(
        (r) => r.section === section && r.state !== " " && !isKeptAt(merge, r.taskId),
      );
      if (!droppable) continue;
      const key = `${compactor.label}\0${file}`;
      const req = byParentFile.get(key) ?? { parent: compactor, file, sections: [] };
      req.sections.push(section);
      byParentFile.set(key, req);
    }
  }
  return [...byParentFile]
    .sort(([a], [b]) => cmp(a, b))
    .map(([, r]) => ({ ...r, sections: [...r.sections].sort(cmp) }));
}

/** Every requested section of one walk falls back with the same reason. */
export function historyFallbackAll(req: HistoryRequest, reason: HistoryFallbackReason, detail: string): SectionHistory[] {
  return req.sections.map((section) => ({
    parent: req.parent.label,
    parentSha: req.parent.sha,
    file: req.file,
    section,
    summarized: null,
    fallback: { reason, detail },
  }));
}

function firstStderrLine(err: unknown): string {
  return (gitErr(err).split("\n")[0] ?? "").trim().slice(0, 200);
}

/** F's ledger at one commit (absent path = empty ledger); throws on any unreadable object. */
function readLedgerAt(
  repoRoot: string,
  sha: string,
  file: string,
  blobCache: Map<string, Buffer>,
  taskRegex: RegExp,
): LedgerSnapshot {
  for (const rec of gitWalk(repoRoot, ["ls-tree", "--full-tree", "-z", sha, "--", file]).toString("utf8").split("\0")) {
    const tab = rec.indexOf("\t");
    if (tab < 0 || rec.slice(tab + 1) !== file) continue;
    const [mode, type, blob] = rec.slice(0, tab).split(" ");
    if (type !== "blob" || !mode.startsWith("100")) break; // same regular-file rule as readCommitSnapshot
    let buf = blobCache.get(blob);
    if (!buf) {
      buf = gitWalk(repoRoot, ["cat-file", "blob", blob]);
      blobCache.set(blob, buf);
    }
    return parseLedger(file, buf.toString("utf8"), taskRegex);
  }
  return parseLedger(file, "", taskRegex);
}

interface ListedCommit {
  sha: string;
  parents: string[];
}

/**
 * Recover H for one section: at each commit whose count for S rises over the
 * max of its real parents, the closed rows that left F/S (not kept in F at
 * that commit, not anywhere at P_c's tip, not already in H) must match the
 * rise exactly, and H must stay within P_c's own count; else unreconciled.
 */
function sectionHistory(
  req: HistoryRequest,
  section: string,
  commits: ListedCommit[],
  ledgers: Map<string, LedgerSnapshot>,
): SectionHistory {
  const result = (summarized: Map<string, RowState> | null, unreconciled: string | null): SectionHistory => ({
    parent: req.parent.label,
    parentSha: req.parent.sha,
    file: req.file,
    section,
    summarized,
    fallback: unreconciled === null ? null : { reason: "unreconciled", detail: unreconciled },
  });
  const recovered = new Map<string, RowState>();
  let transitions = 0;
  for (const c of commits) {
    const parentLedgers = c.parents.map((p) => ledgers.get(p)).filter((l): l is LedgerSnapshot => l !== undefined);
    const max = parentLedgers.reduce<ManifestEntry>((m, l) => {
      const e = entryOf(l, section);
      return { done: Math.max(m.done, e.done), voided: Math.max(m.voided, e.voided) };
    }, ZERO_ENTRY);
    const atC = ledgers.get(c.sha);
    const cur = entryOf(atC, section);
    const inc = { done: cur.done - max.done, voided: cur.voided - max.voided };
    if (inc.done < 0 || inc.voided < 0) return result(null, `count fell at ${short(c.sha)}`);
    if (inc.done === 0 && inc.voided === 0) continue;
    transitions++;
    const inFileAtC = new Set((atC?.rows ?? []).map((r) => r.taskId));
    const removed = new Map<string, RowState>();
    for (const l of parentLedgers) {
      for (const r of l.rows) {
        if (r.section !== section || r.state === " ") continue;
        if (inFileAtC.has(r.taskId) || isKeptAt(req.parent, r.taskId) || recovered.has(r.taskId)) continue;
        if (removed.get(r.taskId) !== "x") removed.set(r.taskId, r.state);
      }
    }
    const left = splitOf(removed);
    if (left.done !== inc.done || left.voided !== inc.voided) {
      return result(
        null,
        `count rose by ${inc.done} done/${inc.voided} voided at ${short(c.sha)} but ` +
          `${left.done} [x]/${left.voided} [-] row(s) left the section`,
      );
    }
    for (const [id, s] of removed) recovered.set(id, s);
  }
  if (transitions === 0) return result(null, null); // compacted at or before the merge-base: silent
  const own = entryOf(req.parent.ledgers.get(req.file), section);
  const h = splitOf(recovered);
  if (h.done > own.done || h.voided > own.voided) {
    return result(
      null,
      `${h.done} [x]/${h.voided} [-] recovered row(s) exceed the parent's manifest ${own.done} done/${own.voided} voided`,
    );
  }
  return result(recovered, null);
}

/**
 * One walk over P_c's history between the merge-base and P_c for ledger F,
 * one entry per requested section. Never throws: shallow, unreadable and
 * over-cap history map to a fallback (snapshot-only rule + WARN line).
 */
export function readCompactionHistory(
  repoRoot: string,
  baseSha: string,
  req: HistoryRequest,
  blobCache: Map<string, Buffer>,
  opts: { cap: number; shallow: boolean; taskRegex: RegExp },
): SectionHistory[] {
  if (opts.shallow) return historyFallbackAll(req, "shallow", "");
  try {
    let listing: string;
    try {
      listing = gitWalk(repoRoot, [
        "log", "--full-history", "--topo-order", "--reverse", `--max-count=${opts.cap + 1}`,
        "--format=%H %P", `${baseSha}..${req.parent.sha}`, "--", `:(top,literal)${req.file}`,
      ]).toString("utf8");
    } catch (err) {
      return historyFallbackAll(req, "unreadable", firstStderrLine(err));
    }
    const commits: ListedCommit[] = listing
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "")
      .map((l) => {
        const [sha, ...parents] = l.split(/\s+/);
        return { sha, parents };
      });
    if (commits.length > opts.cap) {
      return historyFallbackAll(
        req,
        "cap",
        `more than ${opts.cap} commits touch ${req.file} between the merge-base and ${req.parent.label}`,
      );
    }
    const ledgers = new Map<string, LedgerSnapshot>();
    for (const c of commits) {
      for (const sha of [c.sha, ...c.parents]) {
        if (!ledgers.has(sha)) ledgers.set(sha, readLedgerAt(repoRoot, sha, req.file, blobCache, opts.taskRegex));
      }
    }
    return req.sections.map((section) => sectionHistory(req, section, commits, ledgers));
  } catch (err) {
    return historyFallbackAll(req, "unreadable", firstStderrLine(err));
  }
}

// =============================================================================
// the three invariants + compaction exemption + report
// =============================================================================

export interface ParentRowRef extends TaskRow {
  parent: string; // "parent1" | "parent2"
  parentSha: string;
}
export interface MissingRow {
  taskId: string;
  foundAt: ParentRowRef[];
  checkedAtMerge: string[];
  /** Why the compaction exemption did not apply (one per ineligible occurrence); empty when no occurrence came near it. */
  reasons: string[];
}
export interface LostCompletion {
  taskId: string;
  doneAt: ParentRowRef[];
  atMerge: TaskRow[];
}
export interface CompactedRow {
  taskId: string;
  occurrences: ParentRowRef[];
}
export interface SidecarShortfall {
  kind: SidecarKind;
  lane: string | null;
  merge: number;
  parent1: number;
  parent2: number;
  base: number;
  expectedMin: number;
}
export interface MergeInvariantsFindings {
  rowsChecked: number;
  missing: MissingRow[];
  lostCompletions: LostCompletion[];
  compacted: CompactedRow[];
  sidecarsChecked: number;
  sidecarShortfalls: SidecarShortfall[];
  /** One per F/S whose history walk fell back; [] when none. */
  historyFallbacks: HistoryFallback[];
}

const fileSectionKey = (file: string, section: string): string => `${file}\0${section}`;

/** Compaction exemption (a), (b), (d) for one parent occurrence (all per-parent); null = passes them. */
function perParentIneligibility(occ: ParentRowRef, parentSnap: CommitSnapshot, merge: CommitSnapshot): string | null {
  const where = `${occ.file} § ${occ.section ?? "(no section)"} at ${occ.parent}`;
  if (occ.state === " ") return `(a) open [ ] row in ${where} is never compaction-eligible`;
  if (occ.section === null) return `(b) row in ${occ.file} at ${occ.parent} has no ## section`;
  if (!merge.ledgers.get(occ.file)?.manifest?.has(occ.section)) {
    return `(b) no Compacted History manifest naming "${occ.section}" in ${occ.file} at merge`;
  }
  if (parentSnap.ledgers.get(occ.file)?.manifest?.has(occ.section)) {
    return `(d) "${occ.section}" was already compacted in ${occ.file} at ${occ.parent} (recycled section name)`;
  }
  return null;
}

/**
 * Condition (c) over the UNION across parents (R-1): U per file F / section S =
 * distinct closed task_ids from parent occurrences passing (a)/(b)/(d). A
 * task_id not found at the merge always counts; a kept one counts only when
 * (i) the merge-base has it under F/S and (ii) no parent whose F names S in
 * its manifest holds it (specs/e126-merge-invariants.md (c)). With a
 * recovered history set H for F/S, kept ids enter U only through H and H ids
 * take H's state. Else `[x]` in any contributing occurrence counts as done.
 */
function unionReconciliationFailures(
  occsById: Map<string, Array<{ ref: ParentRowRef; snap: CommitSnapshot }>>,
  parents: CommitSnapshot[],
  base: CommitSnapshot,
  merge: CommitSnapshot,
  historyByKey: Map<string, SectionHistory>,
): Map<string, string> {
  const union = new Map<string, Map<string, RowState>>(); // F/S key -> task_id -> state
  for (const [taskId, occs] of occsById) {
    const kept = (merge.rowsById.get(taskId)?.length ?? 0) > 0;
    for (const { ref, snap } of occs) {
      if (ref.section === null || perParentIneligibility(ref, snap, merge) !== null) continue;
      if (kept) {
        if (historyByKey.has(fileSectionKey(ref.file, ref.section))) continue;
        const section = ref.section;
        const atBase = (base.rowsById.get(taskId) ?? []).some((r) => r.file === ref.file && r.section === section);
        const heldByCompactor = parents.some(
          (p) => p.ledgers.get(ref.file)?.manifest?.has(section) === true && (p.rowsById.get(taskId)?.length ?? 0) > 0,
        );
        if (!atBase || heldByCompactor) continue;
      }
      const key = fileSectionKey(ref.file, ref.section);
      const ids = union.get(key) ?? new Map<string, RowState>();
      if (ids.get(taskId) !== "x") ids.set(taskId, ref.state);
      union.set(key, ids);
    }
  }
  const viaHistory = new Map<string, number>(); // F/S key -> ids in U only through H
  for (const [key, sh] of historyByKey) {
    if (!sh.summarized) continue;
    const ids = union.get(key) ?? new Map<string, RowState>();
    let onlyThroughH = 0;
    for (const [id, state] of sh.summarized) {
      if (!ids.has(id)) onlyThroughH++;
      ids.set(id, state);
    }
    union.set(key, ids);
    viaHistory.set(key, onlyThroughH);
  }
  const failures = new Map<string, string>();
  for (const [key, ids] of union) {
    const [file, section] = key.split("\0");
    const entry = merge.ledgers.get(file)?.manifest?.get(section);
    if (!entry) continue; // unreachable: (b) held for every contributor
    const { done, voided } = splitOf(ids);
    if (entry.done < done || entry.voided < voided) {
      const h = viaHistory.get(key) ?? 0;
      const hist = historyByKey.get(key);
      failures.set(
        key,
        `(c) manifest under-reconciles ${file} § ${section}: manifest ${entry.done} done/` +
          `${entry.voided} voided < closed rows it must cover, union across parents ${done} [x]/${voided} [-] ` +
          `(${ids.size} distinct task_id(s))` +
          (h > 0 && hist ? ` — includes ${h} row(s) read from ${hist.parent} history after the merge-base` : ""),
      );
    }
  }
  return failures;
}

/** Compaction exemption (a)–(d) for one parent occurrence; null = eligible, else the reason it is not. */
function compactionIneligibility(
  occ: ParentRowRef,
  parentSnap: CommitSnapshot,
  merge: CommitSnapshot,
  unionFailures: Map<string, string>,
): string | null {
  const perParent = perParentIneligibility(occ, parentSnap, merge);
  if (perParent !== null || occ.section === null) return perParent;
  return unionFailures.get(fileSectionKey(occ.file, occ.section)) ?? null;
}

/** Pure. `history` = walk outcomes; [] (or only null-`summarized` entries) is the snapshot-only rule. */
export function evaluateMergeInvariants(
  p1: CommitSnapshot,
  p2: CommitSnapshot,
  base: CommitSnapshot,
  merge: CommitSnapshot,
  history: SectionHistory[] = [],
): MergeInvariantsFindings {
  const byId = new Map<string, Array<{ ref: ParentRowRef; snap: CommitSnapshot }>>();
  for (const snap of [p1, p2]) {
    for (const [id, rows] of snap.rowsById) {
      const list = byId.get(id) ?? [];
      for (const r of rows) list.push({ ref: { ...r, parent: snap.label, parentSha: snap.sha }, snap });
      byId.set(id, list);
    }
  }
  const historyByKey = new Map<string, SectionHistory>();
  const historyFallbacks: HistoryFallback[] = [];
  for (const h of history) {
    if (h.summarized) historyByKey.set(fileSectionKey(h.file, h.section), h);
    if (h.fallback) {
      const { parent, parentSha, file, section } = h;
      historyFallbacks.push({ parent, parentSha, file, section, reason: h.fallback.reason, detail: h.fallback.detail });
    }
  }
  historyFallbacks.sort((a, b) => cmp(a.parent, b.parent) || cmp(a.file, b.file) || cmp(a.section, b.section));
  const unionFailures = unionReconciliationFailures(byId, [p1, p2], base, merge, historyByKey);
  const checkedAtMerge = [...merge.ledgers.keys()].sort();
  const missing: MissingRow[] = [];
  const lostCompletions: LostCompletion[] = [];
  const compacted: CompactedRow[] = [];
  for (const [taskId, occs] of [...byId].sort(([a], [b]) => a.localeCompare(b))) {
    const atMerge = merge.rowsById.get(taskId) ?? [];
    const refs = occs.map((o) => o.ref);
    let isCompacted = false;
    if (atMerge.length === 0) {
      // Strict: EVERY parent occurrence must qualify, so a row dropped from a
      // non-compacted ledger is never hidden by another file's manifest.
      const reasons = occs
        .map((o) => compactionIneligibility(o.ref, o.snap, merge, unionFailures))
        .filter((r): r is string => r !== null);
      if (reasons.length === 0) {
        isCompacted = true;
        compacted.push({ taskId, occurrences: refs });
      } else {
        missing.push({ taskId, foundAt: refs, checkedAtMerge, reasons });
      }
    }
    const doneAt = refs.filter((r) => r.state === "x");
    if (doneAt.length > 0 && !isCompacted && !atMerge.some((r) => r.state === "x")) {
      lostCompletions.push({ taskId, doneAt, atMerge });
    }
  }

  const sidecarKeys = new Set([...p1.sidecars.keys(), ...p2.sidecars.keys(), ...base.sidecars.keys()]);
  const sidecarShortfalls: SidecarShortfall[] = [];
  for (const key of [...sidecarKeys].sort()) {
    const sample = p1.sidecars.get(key) ?? p2.sidecars.get(key) ?? base.sidecars.get(key);
    if (!sample) continue;
    const n = (s: CommitSnapshot): number => s.sidecars.get(key)?.records ?? 0;
    const expectedMin = n(p1) + n(p2) - n(base);
    if (n(merge) < expectedMin) {
      sidecarShortfalls.push({
        kind: sample.kind,
        lane: sample.lane,
        merge: n(merge),
        parent1: n(p1),
        parent2: n(p2),
        base: n(base),
        expectedMin,
      });
    }
  }
  return {
    rowsChecked: byId.size,
    missing,
    lostCompletions,
    compacted,
    sidecarsChecked: sidecarKeys.size,
    sidecarShortfalls,
    historyFallbacks,
  };
}

const short = (sha: string): string => sha.slice(0, 7);
const fmtRef = (r: ParentRowRef): string =>
  `${r.parent} (${short(r.parentSha)}) ${r.file} § ${r.section ?? "(no section)"} [${r.state}]`;
const FALLBACK_CLASS: Record<HistoryFallbackReason, string> = {
  shallow: "shallow repository",
  unreadable: "history unreadable: ",
  cap: "history over cap: ",
  unreconciled: "history unreconciled: ",
};
const fmtFallback = (w: HistoryFallback): string =>
  `WARN (c) history fallback: ${w.parent} (${short(w.parentSha)}) ${w.file} § ${w.section} — ` +
  `${FALLBACK_CLASS[w.reason]}${w.detail}; snapshot-only (c) used for this section`;

export function renderMergeInvariantsReport(
  shas: { merge: string; parent1: string; parent2: string; base: string },
  f: MergeInvariantsFindings,
): string {
  const out: string[] = [
    `merge-invariants: merge ${short(shas.merge)} (parent1 ${short(shas.parent1)}, parent2 ${short(shas.parent2)}, merge-base ${short(shas.base)})`,
  ];
  for (const w of f.historyFallbacks) out.push(fmtFallback(w));
  out.push(
    `[AC1] row presence: ${f.rowsChecked} task_id(s) at parents — ` +
      `${f.rowsChecked - f.missing.length - f.compacted.length} present, ${f.compacted.length} COMPACTED, ${f.missing.length} MISSING`,
  );
  for (const m of f.missing) {
    out.push(`  MISSING ${m.taskId} — found at: ${m.foundAt.map(fmtRef).join("; ")}`);
    out.push(`    checked at merge: ${m.checkedAtMerge.join(", ") || "(no ledger files)"}`);
    for (const r of m.reasons) out.push(`    not compacted: ${r}`);
  }
  out.push(`[AC2] [x] preservation: ${f.lostCompletions.length} lost completion(s)`);
  for (const l of f.lostCompletions) {
    const at = l.atMerge.length ? l.atMerge.map((r) => `${r.file} [${r.state}]`).join("; ") : "absent";
    out.push(`  LOST_DONE ${l.taskId} — [x] at: ${l.doneAt.map(fmtRef).join("; ")}; at merge: ${at}`);
  }
  out.push(`[AC3] sidecar records: ${f.sidecarsChecked} (kind, lane) identities, ${f.sidecarShortfalls.length} shortfall(s)`);
  for (const s of f.sidecarShortfalls) {
    out.push(
      `  SIDECAR_SHORTFALL kind=${s.kind} lane=${s.lane ?? "(flat)"} merge=${s.merge} < ` +
        `parent1=${s.parent1} + parent2=${s.parent2} - base=${s.base} = ${s.expectedMin}`,
    );
  }
  if (f.compacted.length > 0) {
    const breakdown = new Map<string, number>();
    for (const c of f.compacted) {
      // Q-1: one increment per distinct task_id per file § section, never per parent occurrence.
      for (const k of new Set(c.occurrences.map((o) => `${o.file} § ${o.section ?? ""}`))) {
        breakdown.set(k, (breakdown.get(k) ?? 0) + 1);
      }
    }
    out.push(`COMPACTED (informational): ${f.compacted.length} row(s) summarized by a Compacted History manifest — file § section breakdown:`);
    for (const [k, n] of [...breakdown].sort(([a], [b]) => a.localeCompare(b))) out.push(`  ${k}: ${n}`);
  }
  const offending = f.missing.length + f.lostCompletions.length + f.sidecarShortfalls.length;
  out.push(
    offending === 0
      ? "RESULT: PASS — all three invariants held (row presence, [x] preservation, sidecar records)"
      : `RESULT: FAIL — ${offending} offending item(s): ${f.missing.length} MISSING, ` +
          `${f.lostCompletions.length} LOST_DONE, ${f.sidecarShortfalls.length} SIDECAR_SHORTFALL`,
  );
  return out.join("\n");
}

export interface MergeInvariantsResult {
  code: MergeInvariantsCode;
  exitCode: (typeof MERGE_INVARIANTS_EXIT)[MergeInvariantsCode];
  report: string;
  findings?: MergeInvariantsFindings;
}

function result(code: MergeInvariantsCode, report: string, findings?: MergeInvariantsFindings): MergeInvariantsResult {
  return { code, exitCode: MERGE_INVARIANTS_EXIT[code], report, findings };
}

function gitErr(err: unknown): string {
  const e = err as { stderr?: Buffer | string; message?: string };
  const s = e.stderr ? e.stderr.toString().trim() : "";
  return s || e.message || String(err);
}

/**
 * Exported entrypoint: never throws; every outcome maps to an exit code.
 * `opts.historyCommitCap` is a test knob only; the CLI never passes it.
 */
export function runMergeInvariants(
  ref = "HEAD",
  repoRoot: string = process.cwd(),
  opts: { historyCommitCap?: number } = {},
): MergeInvariantsResult {
  if (ref.startsWith("-") || ref.length === 0) {
    return result("USAGE_ERROR", `merge-invariants: invalid ref ${JSON.stringify(ref)}\n${MERGE_INVARIANTS_USAGE}`);
  }
  try {
    git(repoRoot, ["rev-parse", "--git-dir"]);
  } catch (err) {
    return result("USAGE_ERROR", `merge-invariants: ${repoRoot} is not a git repository (${gitErr(err)})\n${MERGE_INVARIANTS_USAGE}`);
  }
  let mergeSha: string;
  try {
    mergeSha = git(repoRoot, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).toString().trim();
  } catch {
    return result("USAGE_ERROR", `merge-invariants: cannot resolve ref ${JSON.stringify(ref)} to a commit\n${MERGE_INVARIANTS_USAGE}`);
  }
  let parents: string[];
  try {
    parents = git(repoRoot, ["rev-list", "--parents", "-n", "1", mergeSha]).toString().trim().split(/\s+/).slice(1);
  } catch (err) {
    return result("USAGE_ERROR", `merge-invariants: cannot list parents of ${short(mergeSha)} (${gitErr(err)})`);
  }
  if (parents.length !== 2) {
    return result(
      "NOT_A_MERGE_COMMIT",
      `merge-invariants: NOT_A_MERGE_COMMIT — ${ref} (${short(mergeSha)}) has ${parents.length} parent(s); ` +
        "exactly 2 required (octopus merges are unsupported)",
    );
  }
  const [parent1, parent2] = parents;
  let base: string;
  try {
    base = git(repoRoot, ["merge-base", parent1, parent2]).toString().trim();
  } catch {
    return result(
      "NO_MERGE_BASE",
      `merge-invariants: NO_MERGE_BASE — parents ${short(parent1)} and ${short(parent2)} of ${short(mergeSha)} share no common ancestor`,
    );
  }
  try {
    const taskRegex = resolveTaskRegex(repoRoot);
    const cache = new Map<string, Buffer>();
    const snap = (sha: string, label: string): CommitSnapshot => readCommitSnapshot(repoRoot, sha, label, taskRegex, cache);
    const p1Snap = snap(parent1, "parent1");
    const p2Snap = snap(parent2, "parent2");
    const baseSnap = snap(base, "merge-base");
    const mergeSnap = snap(mergeSha, "merge");
    const requests = compactionHistoryRequests(p1Snap, p2Snap, baseSnap, mergeSnap);
    const history: SectionHistory[] = [];
    if (requests.length > 0) {
      const knob = opts.historyCommitCap;
      const cap = knob !== undefined && Number.isInteger(knob) && knob >= 0 ? knob : HISTORY_COMMIT_CAP;
      let shallow = false;
      let shallowError: string | null = null;
      try {
        shallow = gitWalk(repoRoot, ["rev-parse", "--is-shallow-repository"]).toString().trim() === "true";
      } catch (err) {
        shallowError = firstStderrLine(err);
      }
      for (const req of requests) {
        history.push(
          ...(shallowError !== null
            ? historyFallbackAll(req, "unreadable", shallowError)
            : readCompactionHistory(repoRoot, base, req, cache, { cap, shallow, taskRegex })),
        );
      }
    }
    const findings = evaluateMergeInvariants(p1Snap, p2Snap, baseSnap, mergeSnap, history);
    const report = renderMergeInvariantsReport({ merge: mergeSha, parent1, parent2, base }, findings);
    const failed = findings.missing.length + findings.lostCompletions.length + findings.sidecarShortfalls.length > 0;
    return result(failed ? "FAIL" : "PASS", report, findings);
  } catch (err) {
    return result("USAGE_ERROR", `merge-invariants: could not read commit trees (${gitErr(err)})`);
  }
}

// =============================================================================
// argv surface (kept here so scripts/merge-invariants.mjs has zero logic)
// =============================================================================

/** Parse argv (`[ref] [--ref <ref>] [abs-repo-root]`) and run; never throws. */
export function runMergeInvariantsCli(argv: string[], cwd: string): MergeInvariantsResult {
  let ref: string | undefined;
  let repoRoot: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") return result("USAGE_ERROR", MERGE_INVARIANTS_USAGE);
    let value: string | undefined;
    if (a === "--ref") value = argv[++i];
    else if (a.startsWith("--ref=")) value = a.slice("--ref=".length);
    if (a === "--ref" || a.startsWith("--ref=")) {
      if (!value || ref !== undefined) return result("USAGE_ERROR", `merge-invariants: bad --ref\n${MERGE_INVARIANTS_USAGE}`);
      ref = value;
    } else if (a.startsWith("-")) {
      return result("USAGE_ERROR", `merge-invariants: unknown option ${a}\n${MERGE_INVARIANTS_USAGE}`);
    } else if (a.startsWith("/") && repoRoot === undefined) {
      repoRoot = a;
    } else if (ref === undefined) {
      ref = a;
    } else {
      return result("USAGE_ERROR", `merge-invariants: unexpected argument ${a}\n${MERGE_INVARIANTS_USAGE}`);
    }
  }
  return runMergeInvariants(ref ?? "HEAD", repoRoot ?? cwd);
}
