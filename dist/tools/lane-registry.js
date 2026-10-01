// Coded by @sr-engineer
// Read-only lane registry, derived on every call, never a written registry
// file. Consumers: the feature roll-up (`laneRegistryList`, with history) and
// `tw_get_state` (`getLaneRegistrySummary`, cheap). Both delegate to
// localFallbackLaneList, the one `git worktree list` caller. (E132)
// The three-module import cycle through handoff-parse is deliberate and safe
// (runtime-only edges): specs/e260b-rationale.md (tools/lane-registry.ts)
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { localFallbackLaneList } from "./feature-rollup.js";
import { isSafeLaneName, laneFile } from "./lane-paths.js";
// A leading `---\n...\n---` frontmatter block. Deliberately a local regex +
// yaml.load, not parseHandoff: a closed-lane snapshot may predate the live
// schema (parseHandoff refuses loud), and parseHandoff can only address the
// current lane. Only `active_feature` and `last_updated` are extracted.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
// `.current/` subdirectories that are never lanes. Workspace-wide
// FILES (.config.json, feature-split.md, the lockfile, ...) are excluded by
// the isDirectory() check; dot-dirs by isSafeLaneName.
const NON_LANE_DIRS = new Set(["archive", "history"]);
const HISTORY_BUCKET_RE = /^\d{4}-\d{2}$/;
function listDirs(dir) {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
    }
    catch {
        return [];
    }
}
function isFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
// js-yaml's default schema turns an unquoted ISO timestamp into a Date;
// handoff-write quotes it (string). Accept both; anything else is NaN.
function toEpochMs(v) {
    if (v instanceof Date)
        return v.getTime();
    if (typeof v === "string" && v.length > 0)
        return Date.parse(v);
    return NaN;
}
// One handoff's {feature, ts}, or null when unreadable / no frontmatter /
// no non-empty string active_feature. Never throws.
function readHandoffEntry(file) {
    try {
        const match = fs.readFileSync(file, "utf-8").match(FRONTMATTER_RE);
        if (!match)
            return null;
        const raw = yaml.load(match[1]);
        if (raw === null || typeof raw !== "object" || Array.isArray(raw))
            return null;
        const rec = raw;
        if (typeof rec.active_feature !== "string" || rec.active_feature.length === 0)
            return null;
        return { feature: rec.active_feature, ts: toEpochMs(rec.last_updated) };
    }
    catch {
        return null;
    }
}
// Every parseable `{feature, ts}` row of one metrics.jsonl (tools/metrics.ts's
// FeatureMetricRecord — only these two fields are read), one entry per
// distinct feature, keeping the EARLIEST ts (a missing / unparseable ts only
// when no row for that feature has a finite one). A blank or malformed line,
// or a row without a non-empty string `feature`, is skipped. Never throws.
function readMetricsEntries(file) {
    let text;
    try {
        text = fs.readFileSync(file, "utf-8");
    }
    catch {
        return [];
    }
    const byFeature = new Map();
    for (const line of text.split("\n")) {
        if (line.trim() === "")
            continue;
        let rec;
        try {
            rec = JSON.parse(line);
        }
        catch {
            continue;
        }
        if (rec === null || typeof rec !== "object" || Array.isArray(rec))
            continue;
        const { feature, ts } = rec;
        if (typeof feature !== "string" || feature.length === 0)
            continue;
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
export function getLaneFeatureHistory(workspacePath) {
    try {
        const currentDir = path.join(workspacePath, ".current");
        const historyDir = path.join(currentDir, "history");
        const handoffName = laneFile("handoff").filename;
        const metricsName = laneFile("metrics").filename;
        // One entry per lane DIR (live or history closure), carrying whichever
        // of its two sources exist.
        const candidates = [];
        const addCandidate = (lane, dir) => {
            const handoff = path.join(dir, handoffName);
            const metrics = path.join(dir, metricsName);
            const h = isFile(handoff) ? handoff : null;
            const m = isFile(metrics) ? metrics : null;
            if (h !== null || m !== null)
                candidates.push({ lane, dir, handoff: h, metrics: m });
        };
        for (const lane of listDirs(currentDir)) {
            if (NON_LANE_DIRS.has(lane) || !isSafeLaneName(lane))
                continue;
            addCandidate(lane, path.join(currentDir, lane));
        }
        let historyExists = false;
        try {
            historyExists = fs.statSync(historyDir).isDirectory();
        }
        catch {
            historyExists = false;
        }
        if (historyExists) {
            for (const bucket of listDirs(historyDir)) {
                if (!HISTORY_BUCKET_RE.test(bucket))
                    continue;
                for (const lane of listDirs(path.join(historyDir, bucket))) {
                    if (!isSafeLaneName(lane))
                        continue;
                    addCandidate(lane, path.join(historyDir, bucket, lane));
                }
            }
        }
        if (candidates.length === 0 && !historyExists) {
            return { featureHistory: null };
        }
        const parsed = [];
        for (const { lane, handoff, metrics } of candidates) {
            let handoffFeature = null;
            if (handoff !== null) {
                const entry = readHandoffEntry(handoff);
                if (entry !== null) {
                    handoffFeature = entry.feature;
                    parsed.push({ lane, file: handoff, ...entry });
                }
            }
            if (metrics !== null) {
                for (const entry of readMetricsEntries(metrics)) {
                    if (entry.feature === handoffFeature)
                        continue; // the handoff entry wins
                    parsed.push({ lane, file: metrics, ...entry });
                }
            }
        }
        parsed.sort((a, b) => {
            const aOk = Number.isFinite(a.ts);
            const bOk = Number.isFinite(b.ts);
            if (aOk !== bOk)
                return aOk ? -1 : 1;
            if (aOk && a.ts !== b.ts)
                return a.ts - b.ts;
            if (a.lane !== b.lane)
                return a.lane < b.lane ? -1 : 1;
            return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
        });
        return { featureHistory: parsed.map((p) => p.feature) };
    }
    catch {
        // Defense-in-depth only (every step above already guards itself):
        // "could not tell" must never read as "definitely none" (null) — [].
        return { featureHistory: [] };
    }
}
/**
 * LaneListProvider for the feature roll-up (scripts/feature-rollup.mjs):
 * `localFallbackLaneList` plus `featureHistory` per lane via
 * `getLaneFeatureHistory`, with `source` reading `"lane-registry"`. (E113)
 */
export function laneRegistryList(repoRoot) {
    const result = localFallbackLaneList(repoRoot);
    const lanes = result.lanes.map((lane) => ({
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
const _laneRegistryListIsLaneListProvider = laneRegistryList;
void _laneRegistryListIsLaneListProvider;
/**
 * Fast summary for `tw_get_state`: calls `localFallbackLaneList` directly,
 * skipping the lane-history scan every read would pay for. Returns null for
 * 0-1 worktrees, or git unavailable with no lanes; an unreadable sibling is
 * carried with `degraded: true` and a reason. `opts.timeoutMs` (default 200,
 * a test-only knob) bounds only the `git worktree list` call. Never throws.
 */
export function getLaneRegistrySummary(repoRoot, opts) {
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
        const lanes = result.lanes.map((lane) => ({
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
                degraded_reason: result.degradedReason ??
                    "one or more sibling lane handoffs could not be read/parsed (see per-lane readable status)",
            }),
        };
    }
    catch (err) {
        // Defense-in-depth only — localFallbackLaneList is documented to never
        // throw. If it (or a future change to it) ever does, tw_get_state's
        // mandatory first-action read must still succeed.
        void err;
        return null;
    }
}
//# sourceMappingURL=lane-registry.js.map