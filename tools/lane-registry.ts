// Coded by @sr-engineer
// tools/lane-registry.ts — read-only lane registry. Moves
// tools/feature-rollup.ts's `localFallbackLaneList` behind a dedicated
// module for two consumers with very different cost profiles: (1) the
// feature roll-up (`laneRegistryList`, below), which wants feature-history
// attribution and can afford a lane-history scan per lane because it is
// occasional and human-invoked; (2) `tw_get_state` (`getLaneRegistrySummary`,
// below), the hottest read in the server, which must never pay for a
// ticket-list read or a lane-history scan just to answer "who else is
// working, and on what." (E132)
//
// Deliberately NOT a registry file that lanes write into. A written registry
// brings back a shared write target — exactly what per-lane state
// directories exist to avoid — and goes stale the moment a lane dies without
// cleaning up. A derived list cannot be wrong because it has no stored copy
// to drift. This module is READ-ONLY: it performs no writes, creates no
// lockfile, sends no heartbeat, and authors no lane-side state.
//
// Neither exported function reimplements worktree enumeration or handoff
// parsing: both delegate to `localFallbackLaneList` (tools/feature-rollup.ts)
// for the actual derivation, so there remains exactly one place in the
// codebase that shells out to `git worktree list`.
//
// Degrade-honestly (same posture as tools/feature-rollup.ts's own header):
// an unreadable or unattributable lane is always CARRIED, never dropped and
// never zero-filled; every degradation states a human-readable reason; a
// partial figure is never presented as a verified total.
//
// NOTE — deliberate three-module circular import, documented not avoided:
// tools/handoff-parse.ts -> tools/lane-registry.ts (this module, via
// getLaneRegistrySummary) -> tools/feature-rollup.ts (via localFallbackLaneList)
// -> tools/handoff-parse.ts (via parseHandoff). This is the same shape,
// generalized to three nodes, as the existing documented
// tools/handoff-parse.ts <-> tools/handoff-write.ts cycle (see the NOTE at
// the top of tools/handoff-parse.ts). It is safe for the identical reason:
// every cross-edge is an ordinary function call made at RUNTIME (inside a
// function body — parseHandoff is called inside localFallbackLaneList's
// loop, localFallbackLaneList is called inside this module's two exported
// functions, and getLaneRegistrySummary is called inside
// readHandoffState), never read at module-init time, so Node's ESM
// live-binding semantics resolve it without error regardless of which
// module is imported first.

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { localFallbackLaneList } from "./feature-rollup.js";
import { isSafeLaneName, laneFile } from "./lane-paths.js";
import type { LaneInfo, LaneListResult, LaneListProvider } from "./feature-rollup.js";

// Same frontmatter-block shape as tools/skill-frontmatter.ts's FRONTMATTER_RE
// and tools/handoff-parse.ts's own frontmatter handling — a leading
// `---\n...\n---` block. Deliberately a LOCAL regex + yaml.load, not
// `parseHandoff` (decision re-confirmed at the e123b9 J2 re-point, AC7):
// (1) a closed lane under .current/history/ is a historical snapshot that may
// predate the live schema_version, and parseHandoff refuses loud (by design)
// on an unparseable/future-schema handoff — one old snapshot must not take
// out this whole best-effort read; (2) parseHandoff only ever resolves the
// workspace's CURRENT lane (plus its flat fallback), so it cannot address an
// arbitrary sibling lane dir at all. Only `active_feature` and
// `last_updated` are extracted; nothing is migrated, locked, or written.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// `.current/` subdirectories that are never lanes (spec AC7). Workspace-wide
// FILES (.config.json, feature-split.md, the lockfile, ...) are excluded by
// the isDirectory() check; dot-dirs by isSafeLaneName.
const NON_LANE_DIRS = new Set(["archive", "history"]);
const HISTORY_BUCKET_RE = /^\d{4}-\d{2}$/;

/** Per-workspace feature history, best-effort, derived from the per-lane
 *  layout: every live `.current/<lane>/handoff.md` plus every closed
 *  `.current/history/<YYYY-MM>/<lane>/handoff.md`, AND every `{feature, ts}`
 *  row of the `metrics.jsonl` sitting in each of those same lane dirs — a
 *  long-lived lane such as `_primary` changes `active_feature` IN PLACE and
 *  never closes into history, so its handoff.md only ever names the current
 *  feature; each release-engineer shipped close (emitFeatureMetrics) leaves a
 *  durable metrics row that recovers the superseded predecessors.
 *  (E123, E125b)
 *  null = neither a live lane dir holding a handoff.md or metrics.jsonl nor a
 *  `.current/history/` directory exists (no lane history to report);
 *  [] = at least one source exists but yielded no parseable entry.
 *  Entries are the exact (unsanitized) active_feature / metrics `feature`
 *  strings, one combined list oldest to newest by each source's OWN
 *  timestamp (handoff `last_updated`, metrics row `ts`) — never filesystem
 *  mtime (a checkout gives every file the same mtime). Within ONE lane dir a
 *  feature appears at most once: the handoff entry wins over that dir's
 *  metrics rows for the same feature, and repeated metrics rows (e.g. two
 *  released_version values) collapse to the earliest. Separate lane dirs
 *  (a live lane and its history closures) are never merged with each other.
 *  A missing or unparseable timestamp sorts last; ties break by lane name
 *  ascending (then by path, for full determinism). The flat-era
 *  `.current/archive/` is no longer read at all.
 *
 *  KNOWN LIMITATION: a feature that was ABANDONED — never reached a
 *  release-engineer shipped close, so it has no metrics row — and was then
 *  overwritten in place by a later `active_feature` cannot be recovered.
 *  metrics.jsonl records shipped closes only; this module never claims data
 *  that was not durably recorded (degrade honestly). (E125b) */
export interface LaneFeatureHistory {
  featureHistory: string[] | null;
}

function listDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

// js-yaml's default schema turns an unquoted ISO timestamp into a Date;
// handoff-write quotes it (string). Accept both; anything else is NaN.
function toEpochMs(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && v.length > 0) return Date.parse(v);
  return NaN;
}

// One handoff's {feature, ts}, or null when unreadable / no frontmatter /
// no non-empty string active_feature. Never throws.
function readHandoffEntry(file: string): { feature: string; ts: number } | null {
  try {
    const match = fs.readFileSync(file, "utf-8").match(FRONTMATTER_RE);
    if (!match) return null;
    const raw = yaml.load(match[1]);
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (typeof rec.active_feature !== "string" || rec.active_feature.length === 0) return null;
    return { feature: rec.active_feature, ts: toEpochMs(rec.last_updated) };
  } catch {
    return null;
  }
}

// Every parseable `{feature, ts}` row of one metrics.jsonl (tools/metrics.ts's
// FeatureMetricRecord — only these two fields are read), one entry per
// distinct feature, keeping the EARLIEST ts (a missing / unparseable ts only
// when no row for that feature has a finite one). A blank or malformed line,
// or a row without a non-empty string `feature`, is skipped. Never throws.
function readMetricsEntries(file: string): { feature: string; ts: number }[] {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const byFeature = new Map<string, number>();
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let rec: unknown;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (rec === null || typeof rec !== "object" || Array.isArray(rec)) continue;
    const { feature, ts } = rec as { feature?: unknown; ts?: unknown };
    if (typeof feature !== "string" || feature.length === 0) continue;
    const t = toEpochMs(ts);
    const prev = byFeature.get(feature);
    if (prev === undefined || (Number.isFinite(t) && (!Number.isFinite(prev) || t < prev))) {
      byFeature.set(feature, t);
    }
  }
  return [...byFeature].map(([feature, ts]) => ({ feature, ts }));
}

/**
 * Enumerates live and closed lane handoffs under `workspacePath/.current/`
 * (plus each lane dir's metrics.jsonl shipped-close rows) and returns their
 * feature names ordered by timestamp.
 * Strictly read-only (readdir/stat/readFile only — no lock, no migration, no
 * file or dir creation). Never throws: an unlistable dir, a malformed file,
 * missing frontmatter, or a non-string `active_feature` are skipped
 * silently. (E125b)
 */
export function getLaneFeatureHistory(workspacePath: string): LaneFeatureHistory {
  try {
    const currentDir = path.join(workspacePath, ".current");
    const historyDir = path.join(currentDir, "history");

    const handoffName = laneFile("handoff").filename;
    const metricsName = laneFile("metrics").filename;
    // One entry per lane DIR (live or history closure), carrying whichever
    // of its two sources exist.
    const candidates: { lane: string; dir: string; handoff: string | null; metrics: string | null }[] = [];
    const addCandidate = (lane: string, dir: string): void => {
      const handoff = path.join(dir, handoffName);
      const metrics = path.join(dir, metricsName);
      const h = isFile(handoff) ? handoff : null;
      const m = isFile(metrics) ? metrics : null;
      if (h !== null || m !== null) candidates.push({ lane, dir, handoff: h, metrics: m });
    };
    for (const lane of listDirs(currentDir)) {
      if (NON_LANE_DIRS.has(lane) || !isSafeLaneName(lane)) continue;
      addCandidate(lane, path.join(currentDir, lane));
    }

    let historyExists = false;
    try {
      historyExists = fs.statSync(historyDir).isDirectory();
    } catch {
      historyExists = false;
    }
    if (historyExists) {
      for (const bucket of listDirs(historyDir)) {
        if (!HISTORY_BUCKET_RE.test(bucket)) continue;
        for (const lane of listDirs(path.join(historyDir, bucket))) {
          if (!isSafeLaneName(lane)) continue;
          addCandidate(lane, path.join(historyDir, bucket, lane));
        }
      }
    }

    if (candidates.length === 0 && !historyExists) {
      return { featureHistory: null };
    }

    const parsed: { lane: string; file: string; feature: string; ts: number }[] = [];
    for (const { lane, handoff, metrics } of candidates) {
      let handoffFeature: string | null = null;
      if (handoff !== null) {
        const entry = readHandoffEntry(handoff);
        if (entry !== null) {
          handoffFeature = entry.feature;
          parsed.push({ lane, file: handoff, ...entry });
        }
      }
      if (metrics !== null) {
        for (const entry of readMetricsEntries(metrics)) {
          if (entry.feature === handoffFeature) continue; // the handoff entry wins
          parsed.push({ lane, file: metrics, ...entry });
        }
      }
    }

    parsed.sort((a, b) => {
      const aOk = Number.isFinite(a.ts);
      const bOk = Number.isFinite(b.ts);
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (aOk && a.ts !== b.ts) return a.ts - b.ts;
      if (a.lane !== b.lane) return a.lane < b.lane ? -1 : 1;
      return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
    });

    return { featureHistory: parsed.map((p) => p.feature) };
  } catch {
    // Defense-in-depth only (every step above already guards itself):
    // "could not tell" must never read as "definitely none" (null) — [].
    return { featureHistory: [] };
  }
}

/**
 * LaneListProvider-conformant (same signature as `localFallbackLaneList`) —
 * the provider the feature roll-up wires in (scripts/feature-rollup.mjs).
 * Delegates worktree enumeration + handoff parsing entirely to
 * `localFallbackLaneList` (no duplicated git-shelling) and additionally
 * attaches `featureHistory` per lane via `getLaneFeatureHistory`. `source`
 * reads `"lane-registry"` — the union member `tools/feature-rollup.ts`
 * reserved for this module — whenever this function, not
 * `localFallbackLaneList`, is used as the provider. (E113)
 */
export function laneRegistryList(repoRoot: string): LaneListResult {
  const result = localFallbackLaneList(repoRoot);
  const lanes: LaneInfo[] = result.lanes.map((lane) => ({
    ...lane,
    featureHistory: getLaneFeatureHistory(lane.workspacePath).featureHistory,
  }));
  return {
    ...result,
    source: "lane-registry",
    lanes,
  };
}

// Enforce (at compile time, zero runtime cost) that laneRegistryList really
// does conform to the LaneListProvider contract computeFeatureRollup expects
// — documents the "LaneListProvider-conformant" claim above as a type-check
// rather than only a comment.
const _laneRegistryListIsLaneListProvider: LaneListProvider = laneRegistryList;
void _laneRegistryListIsLaneListProvider;

/** One sibling lane as surfaced in the `tw_get_state` advisory — a minimal
 *  projection, not the full `LaneInfo` shape (no hopCount/lastUpdated/error:
 *  tw_get_state's advisory is "who else, doing what", not a full report). */
export interface LaneRegistryAdvisoryLane {
  workspace_path: string;
  active_feature: string | null;
  status: string | null;
  last_agent: string | null;
}

export interface LaneRegistryAdvisory {
  lanes: LaneRegistryAdvisoryLane[];
  degraded: boolean;
  degraded_reason?: string;
}

/**
 * Fast, cost-ceilinged summary for `tw_get_state` (DoD 3). Calls
 * `localFallbackLaneList(repoRoot, { timeoutMs })` directly — NOT
 * `laneRegistryList` — deliberately skipping the lane-history scan: `tw_get_state`
 * does not need feature history, and every lane on this path pays for every
 * sibling's extra I/O on every single read.
 *
 * Returns `null` (no advisory to report) when there are 0 or 1 worktrees
 * total (nothing to show — most workspaces are not part of a fan-out) or
 * when git is unavailable/times out with zero lanes recovered. When 2+
 * worktrees are found and at least one sibling's handoff can't be read,
 * returns the advisory with `degraded: true` and a stated reason (that lane
 * is still carried in `lanes`, never dropped).
 *
 * `opts.timeoutMs` defaults to 200 — a fixed constant for production
 * callers (same posture as `STALE_DISPATCH_THRESHOLD_MIN`/`HOP_CAP`; never
 * config-driven), exposed only so a test can shorten it. This bounds only
 * the `git worktree list` subprocess `localFallbackLaneList` shells out to
 * — the N synchronous `parseHandoff` reads (one per sibling worktree) that
 * follow are additive on top of it, not covered by the 200ms figure.
 * Wrapped in try/catch as defense-in-depth: `localFallbackLaneList` already
 * never throws, but this function must never be the reason `tw_get_state`'s
 * mandatory first-action read fails.
 */
export function getLaneRegistrySummary(
  repoRoot: string,
  opts?: { timeoutMs?: number },
): LaneRegistryAdvisory | null {
  try {
    const timeoutMs = opts?.timeoutMs ?? 200;
    const result = localFallbackLaneList(repoRoot, { timeoutMs });

    // 0 lanes (git unavailable/timed out/no worktrees) or exactly 1 lane
    // (this tree is not fanned out — no siblings) both mean "nothing to
    // report" for this advisory's purposes. localFallbackLaneList already
    // degrades internally in both cases; we don't need its degradedReason
    // here because we're reporting nothing at all.
    if (result.lanes.length <= 1) {
      return null;
    }

    const lanes: LaneRegistryAdvisoryLane[] = result.lanes.map((lane) => ({
      workspace_path: lane.workspacePath,
      active_feature: lane.activeFeature,
      status: lane.status,
      last_agent: lane.lastAgent,
    }));

    const anyUnreadable = result.lanes.some((lane) => !lane.readable);
    const degraded = result.degraded || anyUnreadable;

    return {
      lanes,
      degraded,
      ...(degraded && {
        degraded_reason:
          result.degradedReason ??
          "one or more sibling lane handoffs could not be read/parsed (see per-lane readable status)",
      }),
    };
  } catch (err) {
    // Defense-in-depth only — localFallbackLaneList is documented to never
    // throw. If it (or a future change to it) ever does, tw_get_state's
    // mandatory first-action read must still succeed.
    void err;
    return null;
  }
}
