// Coded by @sr-engineer
// tools/feature-rollup.ts — feature-level roll-up (E113,
// e113-feature-level-rollup). Every feature-scoped cost brake (hop_count,
// review_round/qa_round, telemetry, token budget) is computed and capped per
// WORKSPACE (E109 Anchoring rule — declared-as-designed, not re-litigated
// here). That per-lane scoping is correct for a single lane, but it means a
// feature fanned out across N git worktrees never has its true total shown by
// any single lane's tw_get_state read. This module is a REPORTING surface
// only — it fires no gate and makes no cap span workspaces. It exists so a
// PM/coordinator can derive the lane list, sum each lane's ticket/status/hop,
// and put the total in front of a human before declaring a multi-lane
// feature closed (content/coord-03-core-fallback.md, Feature-Scope Gate
// paragraph, "Feature-close roll-up obligation").
//
// Degrade-honestly is the load-bearing property of this module (AC4/AC5):
// this ticket exists because a per-lane brake was silently read as if it were
// the feature-wide figure. Reproducing that mistake here — dropping an
// unreadable lane, or presenting a partial/single-lane sum as a verified
// feature total — would ship the exact bug this module was written to fix.
// An unreadable lane is always CARRIED (readable: false), never dropped and
// never zero-filled; any degradation is stated explicitly in
// degradedReason, and renderRollupReport leads with a "ROLL-UP INCOMPLETE"
// banner whenever the result is degraded.
//
// E132 (tools/lane-registry.ts, queued behind E116) is the eventual real
// lane-list data source — a maintained registry instead of a git-worktree
// guess. It is NOT built yet and this module does not block on it:
// localFallbackLaneList below is a fully functional standalone provider, and
// the LaneListProvider seam (see computeFeatureRollup's `laneListProvider`
// option, marked below) means landing E132 requires zero call-site changes —
// only swapping which provider function is passed in.
//
// Feature attribution (round 2 fix): every lane is CARRIED into the report
// and shown in the table for context, but only lanes whose `activeFeature`
// equals the requested featureId are summed into `totals`/`capComparison` —
// featureId is not just a display label. `active_feature` is a heuristic
// (a lane may have since rolled on to a later feature; exact attribution is
// E132's job), so a lane that cannot be attributed — zero lanes match, or a
// readable lane has no active_feature recorded at all — degrades the report
// via the same degrade-honestly path rather than silently entering totals.

import { execFileSync } from "node:child_process";
import { parseHandoff } from "./handoff-parse.js";
import { HOP_CAP_EXPORTED } from "./transitions.js";

/** One lane's raw, lightweight state as seen by a LaneListProvider. */
export interface LaneInfo {
  workspacePath: string;
  /** Always known once `git worktree list` succeeds; null only for a
   * detached-HEAD worktree or a block this parser could not read a branch
   * line from. Not optional — every provider that derives from git
   * porcelain output has this information available. */
  branch: string | null;
  activeFeature: string | null;
  status: string | null;
  hopCount: number | null;
  lastAgent: string | null;
  lastUpdated: string | null;
  /** false when this lane's handoff could not be found/parsed. */
  readable: boolean;
  error?: string;
  /** E132 hand-forward 1/2: this lane's completed_tasks, when the provider
   * already read the handoff and can populate it for free (both
   * localFallbackLaneList and lane-registry.ts's laneRegistryList do).
   * undefined = provider left it unpopulated (computeFeatureRollup falls
   * back to its own parseHandoff read for this lane, preserving prior
   * behavior for third-party providers). null is not currently produced by
   * either built-in provider but is a legal "known absent" value. */
  completedTasks?: string[] | null;
  /** E132 hand-forward 3: this lane's past active_feature values, oldest to
   * newest, best-effort. Only laneRegistryList populates this (see
   * tools/lane-registry.ts) — localFallbackLaneList leaves it undefined,
   * deliberately, to avoid every existing caller paying for an archive scan
   * it never asked for. */
  featureHistory?: string[] | null;
}

/** The result of deriving the lane list for a repo. */
export interface LaneListResult {
  source: "lane-registry" | "local-fallback";
  lanes: LaneInfo[];
  /** true if derivation was partial or unavailable. */
  degraded: boolean;
  degradedReason?: string;
}

/** A pluggable lane-list data source. localFallbackLaneList is the default;
 * E132's tools/lane-registry.ts is a drop-in replacement, same signature. */
export type LaneListProvider = (repoRoot: string) => LaneListResult;

// SEAM FOR E132: this is the default provider passed to computeFeatureRollup
// below. Once tools/lane-registry.ts ships, pass its exported list function
// as the `laneListProvider` option — computeFeatureRollup's internals do not
// change; only which provider is passed changes. Never throws: git failures,
// a non-worktree tree, a lone worktree with no siblings, or an unreadable
// lane handoff all degrade the result — they never crash the caller.
export function localFallbackLaneList(
  repoRoot: string,
  opts?: { timeoutMs?: number },
): LaneListResult {
  let output: string;
  try {
    output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: repoRoot,
      encoding: "utf-8",
      // Capture stderr instead of inheriting it (code-reviewer C1, round 1):
      // execFileSync's default inherits stderr to the parent, and this
      // function is now called from readHandoffState — the mandatory
      // first-action read, inside the long-lived MCP server whose stderr IS
      // the stdio-transport log channel. A non-git workspace's `git` failure
      // must not print `fatal: ...` to that channel on every call. The
      // detail is still available on err.stderr / err.message below for
      // degradedReason.
      stdio: ["ignore", "pipe", "pipe"],
      // undefined (the default, every existing call site incl.
      // scripts/feature-rollup.mjs) preserves today's no-timeout behavior
      // exactly. Only getLaneRegistrySummary (tools/lane-registry.ts) passes
      // an explicit timeoutMs — the hottest-read cost ceiling (E132).
      ...(opts?.timeoutMs !== undefined && { timeout: opts.timeoutMs }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      source: "local-fallback",
      lanes: [],
      degraded: true,
      degradedReason: `git worktree list failed (not a git repo, or git is unavailable): ${message}`,
    };
  }

  // Porcelain output is one blank-line-separated block per worktree, e.g.:
  //   worktree /path
  //   HEAD <sha>
  //   branch refs/heads/<name>
  // or, for a detached worktree:
  //   worktree /path
  //   HEAD <sha>
  //   detached
  // Parsed per-block (not per-line in isolation) so each worktree's branch
  // line is attributed to the right worktree path.
  const branchByPath = new Map<string, string | null>();
  const worktreePaths: string[] = [];
  // CRLF-tolerant split (code-reviewer C2, round 1): /\n\n+/ does not match
  // \r\n\r\n, which would collapse the entire porcelain output into one
  // block. Matches the \r?\n convention this file already uses at
  // FRONTMATTER_RE-adjacent line splits elsewhere (tools/lane-registry.ts:59,
  // tools/handoff-parse.ts:197, tools/drift.ts:141).
  for (const block of output.split(/(?:\r?\n){2,}/)) {
    let blockPath: string | null = null;
    let blockBranch: string | null = null;
    const flush = () => {
      if (blockPath !== null) {
        worktreePaths.push(blockPath);
        branchByPath.set(blockPath, blockBranch);
      }
    };
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) {
        // Defensive flush (round 1 fix): a second "worktree " line inside
        // what should have been one block (e.g. a block-detection edge case)
        // starts a new lane instead of silently overwriting blockPath/
        // blockBranch — converts a future parse failure into a correct
        // parse rather than a silent drop.
        if (blockPath !== null) flush();
        const wp = line.slice("worktree ".length).trim();
        blockPath = wp !== "" ? wp : null;
        blockBranch = null;
      } else if (line.startsWith("branch ")) {
        const raw = line.slice("branch ".length).trim();
        blockBranch = raw.startsWith("refs/heads/") ? raw.slice("refs/heads/".length) : raw || null;
      }
      // "detached" lines and anything else leave blockBranch null.
    }
    flush();
  }

  if (worktreePaths.length === 0) {
    return {
      source: "local-fallback",
      lanes: [],
      degraded: true,
      degradedReason: "git worktree list --porcelain returned no worktrees",
    };
  }

  const lanes: LaneInfo[] = [];
  let anyUnreadable = false;
  for (const workspacePath of worktreePaths) {
    const branch = branchByPath.get(workspacePath) ?? null;
    try {
      const state = parseHandoff(workspacePath);
      if (!state) {
        lanes.push({
          workspacePath,
          branch,
          activeFeature: null,
          status: null,
          hopCount: null,
          lastAgent: null,
          lastUpdated: null,
          readable: false,
          error: "no .current/handoff.md found for this worktree",
        });
        anyUnreadable = true;
        continue;
      }
      lanes.push({
        workspacePath,
        branch,
        activeFeature: state.active_feature || null,
        status: state.status || null,
        hopCount: typeof state.hop_count === "number" ? state.hop_count : null,
        lastAgent: state.last_agent ?? null,
        lastUpdated: state.last_updated || null,
        readable: true,
        // Hand-forward 1/2 (E132): populate for free since this branch
        // already parsed the handoff — lets computeFeatureRollup skip its
        // own re-read (2N -> N). featureHistory stays undefined: that's
        // laneRegistryList's job (tools/lane-registry.ts), not this
        // provider's — an archive scan per lane is a cost this default
        // provider's existing callers never asked to pay.
        completedTasks: state.completed_tasks,
      });
    } catch (err) {
      // parseHandoff throws refuse-loud on an unparseable/future-schema
      // handoff (schema/versions.ts). That is a legitimate per-lane failure
      // for THIS surface's purposes — carry it as unreadable, never crash the
      // whole roll-up over one bad lane.
      const message = err instanceof Error ? err.message : String(err);
      lanes.push({
        workspacePath,
        branch,
        activeFeature: null,
        status: null,
        hopCount: null,
        lastAgent: null,
        lastUpdated: null,
        readable: false,
        error: message,
      });
      anyUnreadable = true;
    }
  }

  // A single worktree with no siblings is one of the Design section's named
  // outright-failure cases ("the only worktree found is the current one with
  // no siblings") — there is nothing to roll up, so this degrades exactly
  // like a git failure rather than silently reporting a one-lane "total".
  if (lanes.length === 1 && !anyUnreadable) {
    return {
      source: "local-fallback",
      lanes,
      degraded: true,
      degradedReason:
        "only one worktree found (no sibling lanes) — this tree is not fanned out across lanes",
    };
  }

  return {
    source: "local-fallback",
    lanes,
    degraded: anyUnreadable,
    ...(anyUnreadable && {
      degradedReason: "one or more lane handoffs could not be read/parsed (see per-lane `error`)",
    }),
  };
}

/** One lane's contribution to a computed roll-up. */
export interface RollupReportLane {
  workspacePath: string;
  /** From the lane's own handoff (`active_feature`); null if unreadable or
   * never set. Used to attribute the lane to `featureId` — see
   * computeFeatureRollup. */
  activeFeature: string | null;
  ticketsCompleted: string[];
  status: string | null;
  hopCount: number | null;
  readable: boolean;
  /** Passthrough of LaneInfo.featureHistory (E132 hand-forward 3) — only
   * populated when the caller supplied a provider that computes it
   * (laneRegistryList); undefined for localFallbackLaneList lanes. */
  featureHistory?: string[] | null;
}

export interface RollupReport {
  featureId: string;
  lanes: RollupReportLane[];
  totals: { hopCount: number; ticketCount: number };
  capComparison: {
    hopCap: number;
    totalHop: number;
    overCapBy: number;
    anySingleLaneReportsOverCap: boolean;
  };
  degraded: boolean;
  /** set whenever `degraded` is true; always human-readable. */
  degradedReason?: string;
}

/**
 * Derive the lane list (via `laneListProvider`, default localFallbackLaneList)
 * and sum each lane's ticket count / hop_count against HOP_CAP_EXPORTED
 * (imported from tools/transitions.ts — never hardcoded here). Never throws:
 * a provider failure, or any individual lane's handoff being unreadable,
 * degrades the report instead of crashing the caller — see the module-level
 * comment on degrade-honestly.
 */
export function computeFeatureRollup(
  featureId: string,
  opts?: { repoRoot?: string; laneListProvider?: LaneListProvider },
): RollupReport {
  const repoRoot = opts?.repoRoot ?? process.cwd();
  const laneListProvider = opts?.laneListProvider ?? localFallbackLaneList;

  let laneListResult: LaneListResult;
  try {
    laneListResult = laneListProvider(repoRoot);
  } catch (err) {
    // Defense-in-depth: even a future/custom provider (e.g. E132's eventual
    // lane-registry provider) that throws must not crash the roll-up —
    // degrade instead, same posture as localFallbackLaneList itself.
    const message = err instanceof Error ? err.message : String(err);
    laneListResult = {
      source: "local-fallback",
      lanes: [],
      degraded: true,
      degradedReason: `lane list provider threw: ${message}`,
    };
  }

  let anyLaneUnreadableHere = false;
  const lanes: RollupReportLane[] = laneListResult.lanes.map((lane): RollupReportLane => {
    if (!lane.readable) {
      anyLaneUnreadableHere = true;
      return {
        workspacePath: lane.workspacePath,
        activeFeature: lane.activeFeature,
        ticketsCompleted: [],
        status: lane.status,
        hopCount: lane.hopCount,
        readable: false,
        featureHistory: lane.featureHistory,
      };
    }
    // Hand-forward 1/2 (E132): prefer the provider's own completedTasks when
    // it populated one (an array — checked via Array.isArray, since
    // LaneInfo.completedTasks may legally be null/undefined too). Both
    // built-in providers (localFallbackLaneList, laneRegistryList) already
    // read each lane's handoff to build LaneInfo, so re-reading it here
    // would cost a second parseHandoff call per lane (2N reads total) for
    // information the provider already has. Only fall back to a direct read
    // when the provider left the field unpopulated — preserves prior
    // behavior for any third-party LaneListProvider that predates this
    // field.
    if (Array.isArray(lane.completedTasks)) {
      return {
        workspacePath: lane.workspacePath,
        activeFeature: lane.activeFeature,
        ticketsCompleted: lane.completedTasks,
        status: lane.status,
        hopCount: lane.hopCount,
        readable: true,
        featureHistory: lane.featureHistory,
      };
    }
    try {
      const state = parseHandoff(lane.workspacePath);
      if (!state) {
        anyLaneUnreadableHere = true;
        return {
          workspacePath: lane.workspacePath,
          activeFeature: lane.activeFeature,
          ticketsCompleted: [],
          status: lane.status,
          hopCount: lane.hopCount,
          readable: false,
          featureHistory: lane.featureHistory,
        };
      }
      return {
        workspacePath: lane.workspacePath,
        activeFeature: lane.activeFeature,
        ticketsCompleted: state.completed_tasks,
        status: lane.status,
        hopCount: lane.hopCount,
        readable: true,
        featureHistory: lane.featureHistory,
      };
    } catch {
      anyLaneUnreadableHere = true;
      return {
        workspacePath: lane.workspacePath,
        activeFeature: lane.activeFeature,
        ticketsCompleted: [],
        status: lane.status,
        hopCount: lane.hopCount,
        readable: false,
        featureHistory: lane.featureHistory,
      };
    }
  });

  // Attribute to featureId: active_feature is a heuristic snapshot from each
  // lane's own handoff, not ground truth (E132's eventual registry owns
  // exactness) — but only matching lanes may enter totals/capComparison.
  // Every lane (matching or not) still appears in the rendered table below.
  const matchingLanes = lanes.filter((lane) => lane.activeFeature === featureId);
  const zeroMatchingLanes = matchingLanes.length === 0;
  const anyUnattributableLane = lanes.some(
    (lane) => lane.readable && lane.activeFeature == null,
  );
  // Hand-forward 3 (E132): a lane that has since moved on to a different
  // active_feature but whose featureHistory (laneRegistryList only) shows it
  // previously worked featureId. Deliberately excluded from
  // matchingLanes/totals/capComparison — see the Design section's scope
  // decision (retro-summing would risk double-counting against E109's
  // current-feature-anchored caps) — but it must not silently vanish either,
  // so it degrades the report with a stated reason and a renderRollupReport
  // note line (visibility, not arithmetic).
  const historicalOnlyMatchLanes = lanes.filter(
    (lane) =>
      lane.readable &&
      lane.activeFeature !== featureId &&
      Array.isArray(lane.featureHistory) &&
      lane.featureHistory.includes(featureId),
  );
  const anyHistoricalOnlyMatch = historicalOnlyMatchLanes.length > 0;

  const totalHop = matchingLanes.reduce((sum, lane) => sum + (lane.hopCount ?? 0), 0);
  const ticketCount = matchingLanes.reduce((sum, lane) => sum + lane.ticketsCompleted.length, 0);
  const overCapBy = Math.max(0, totalHop - HOP_CAP_EXPORTED);
  const anySingleLaneReportsOverCap = matchingLanes.some(
    (lane) => lane.hopCount !== null && lane.hopCount >= HOP_CAP_EXPORTED,
  );

  // Precedence when multiple degrade conditions hold simultaneously (most
  // actionable first, per the spec): lane-list derivation failure -> per-lane
  // read failure -> historical-only match -> zero current matches ->
  // unattributable lane.
  const degraded =
    laneListResult.degraded ||
    anyLaneUnreadableHere ||
    anyHistoricalOnlyMatch ||
    zeroMatchingLanes ||
    anyUnattributableLane;
  const degradedReason = laneListResult.degraded
    ? laneListResult.degradedReason
    : anyLaneUnreadableHere
      ? "one or more lane handoffs could not be read/parsed while computing ticket counts"
      : anyHistoricalOnlyMatch
        ? `${historicalOnlyMatchLanes.length} lane(s) previously worked "${featureId}" (per featureHistory) but have since moved to a different active_feature — excluded from totals/capComparison to avoid double-counting against E109's current-feature-anchored caps`
        : zeroMatchingLanes
          ? `no lane reports active_feature === "${featureId}" — nothing to roll up for this feature`
          : anyUnattributableLane
            ? "one or more readable lanes have no active_feature recorded and cannot be attributed to this feature — totals may be incomplete"
            : undefined;

  return {
    featureId,
    lanes,
    totals: { hopCount: totalHop, ticketCount },
    capComparison: {
      hopCap: HOP_CAP_EXPORTED,
      totalHop,
      overCapBy,
      anySingleLaneReportsOverCap,
    },
    degraded,
    ...(degraded && { degradedReason: degradedReason ?? "roll-up degraded (unspecified reason)" }),
  };
}

/**
 * Render a RollupReport as a human-readable table + verdict line, suitable
 * for pasting directly into chat in front of a human (the coord-03 obligation
 * this surface backs: "quote its output"). Degrade-honestly (AC5): whenever
 * `report.degraded` is true, the FIRST line is an explicit "ROLL-UP
 * INCOMPLETE" banner — a single-lane or partial total is never presented as
 * if it were a verified feature total.
 */
export function renderRollupReport(report: RollupReport): string {
  const lines: string[] = [];
  const totalLanes = report.lanes.length;
  const readableLanes = report.lanes.filter((lane) => lane.readable).length;

  if (report.degraded) {
    lines.push(
      `ROLL-UP INCOMPLETE — ${readableLanes} of ${totalLanes} lane(s) readable; totals below are NOT a verified feature total.`,
    );
    if (report.degradedReason) {
      lines.push(`Reason: ${report.degradedReason}`);
    }
    lines.push("");
  }

  lines.push(`Feature roll-up: ${report.featureId}`);
  lines.push("");

  if (totalLanes === 0) {
    lines.push("(no lanes found)");
  } else {
    lines.push("workspace | active_feature | status | hop_count | tickets | readable | matches");
    lines.push("--- | --- | --- | --- | --- | --- | ---");
    for (const lane of report.lanes) {
      const matches = lane.activeFeature === report.featureId;
      lines.push(
        `${lane.workspacePath} | ${lane.activeFeature ?? "(none)"} | ${lane.status ?? "(unknown)"} | ${
          lane.hopCount ?? "(unknown)"
        } | ${lane.ticketsCompleted.length} | ${lane.readable} | ${matches}`,
      );
    }
  }

  const matchingLaneCount = report.lanes.filter((lane) => lane.activeFeature === report.featureId).length;
  lines.push("");
  lines.push(
    `Rolled up ${matchingLaneCount} of ${totalLanes} lane(s) with active_feature === "${report.featureId}"; totals below reflect only the matching lane(s).`,
  );
  lines.push(
    `Totals — hop: ${report.totals.hopCount} (cap ${report.capComparison.hopCap}${
      report.capComparison.overCapBy > 0 ? `, OVER BY ${report.capComparison.overCapBy}` : ""
    }), tickets: ${report.totals.ticketCount}`,
  );

  if (report.capComparison.anySingleLaneReportsOverCap) {
    lines.push("note: at least one individual lane already reports hop_count >= cap on its own.");
  }

  const historicalOnlyMatchLanes = report.lanes.filter(
    (lane) =>
      lane.readable &&
      lane.activeFeature !== report.featureId &&
      Array.isArray(lane.featureHistory) &&
      lane.featureHistory.includes(report.featureId),
  );
  if (historicalOnlyMatchLanes.length > 0) {
    lines.push(
      `note: ${historicalOnlyMatchLanes.length} lane(s) previously worked "${report.featureId}" per featureHistory but have since moved to a different active_feature — excluded from totals/capComparison above (not retro-summed; see degradedReason).`,
    );
  }

  if (report.degraded) {
    lines.push(
      "VERDICT: undetermined — resolve the issue above (see Reason) and re-run before declaring this feature closed.",
    );
  } else if (report.capComparison.overCapBy > 0) {
    lines.push(
      `VERDICT: feature total hop_count exceeds the cap by ${report.capComparison.overCapBy}, even though no single lane's own tw_get_state read ever showed it — surface this to the human before declaring the feature closed. This is a reporting obligation only; per-lane caps remain correct for each lane (E109) and this never makes the cap itself span workspaces.`,
    );
  } else {
    lines.push("VERDICT: feature total is within cap across all lanes.");
  }

  return lines.join("\n");
}
