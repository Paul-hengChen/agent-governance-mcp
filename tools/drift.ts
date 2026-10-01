// Coded by @sr-engineer
// Tool: drift detection — compare handoff state vs task list.
// Reads both sides through the active storage adapter so SQLite/HTTP mode works
// without any filesystem access to the workspace.

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { getActiveStorage, type TaskRecord } from "./storage.js";
import type { ToolResult, WorkspaceOnlyInput } from "./registry.js";
import { findTasksFile, loadConfig } from "./config.js";
import { CURRENT_VERSIONS, peekVersion, type SchemaKind } from "../schema/versions.js";
import { isHandAuthoredStamp } from "../gates/stamp-provenance.js";
import { hasEvidenceAnywhere } from "./evidence-lookup.js";
import { resolveCurrentLanePaths, resolveFlatLanePaths } from "./lane-paths.js";

interface DriftReport {
  driftDetected: boolean;
  details: string[];
  handoffLastTask: string;
  tasksCompleted: string[];
  tasksIncomplete: string[];
  // Advisory-only stamp-shape check. Non-null (a plain informational string)
  // when handoff.last_updated matches the hand-authored round-second
  // zero-millisecond shape; null otherwise. Independent of
  // driftDetected/details — never merged into details, never flips
  // driftDetected, consumed by no gate (no GateErrorCode). (E9A)
  stampAdvisory: string | null;
  // Fan-out scope advisory: non-null when this workspace has active-scope
  // incomplete tasks, per computeFanoutAdvisory's header comment.
  // Advisory-only, like stampAdvisory above: never merged into `details`,
  // never flips `driftDetected`, consumed by no gate. Threaded into every
  // return path below (null until tasks are known). (E112)
  fanoutAdvisory: string | null;
  // Ids that WOULD have produced a "Possible vibe-coding drift" detail line
  // (task list shows completed, handoff doesn't mention it, not on the drift
  // baseline) but for which QA evidence exists on disk
  // (tools/evidence-lookup.ts). These ids are excluded from
  // `drifts`/`driftDetected` and instead surface via their own detail line
  // (buildEvidenceBackedLine) — see that function's header for why tw_sync
  // is the wrong remedy for them. Always present (possibly empty). (E112)
  evidenceBackedIds: string[];
}

// The hand-authored-stamp predicate lives in gates/stamp-provenance.ts,
// shared with the write-path STAMP_PROVENANCE_SUSPECT gate so the two never
// drift apart. This stays advisory-only: the lease gate already fails open on
// an untrustworthy stamp, and rejection is that gate's job.
function computeStampAdvisory(lastUpdated: string): string | null {
  if (!isHandAuthoredStamp(lastUpdated)) return null;
  return (
    `Handoff last_updated "${lastUpdated}" has a round-second, zero-millisecond shape ` +
    `(seconds 00, ms .000) — consistent with a hand-authored, out-of-band edit rather than ` +
    `the server's millisecond-entropy tw_update_state write path (new Date().toISOString()). ` +
    `Advisory only: verify how this stamp was produced.`
  );
}

// Detail line for ids that would read as "Possible vibe-coding drift" but have
// a qualifying QA record on disk (see tools/evidence-lookup.ts). It names the
// structural cause instead of blaming the agent and warns that tw_sync is the
// wrong remedy: it would carry the previous feature's marks into the new
// ledger. One aggregate line; never flips driftDetected. The wording says the
// record reads PASS, not that the work was re-verified.
// Why: specs/e260a-tools-a-h-rationale.md, "tools/drift.ts — buildEvidenceBackedLine".
function buildEvidenceBackedLine(ids: string[]): string {
  const idList = formatIdRange(ids);
  return (
    `${ids.length} task(s) (${idList}) show as completed in the task list with no matching entry in handoff ` +
    `state. A QA record exists on disk for them (qa_reports/ or qa_reports/archive/<feature>/) whose most ` +
    `recently recorded verdict is PASS, or which records no verdict at all (a hand-authored covering report) — ` +
    `that is what this check establishes, not an independent re-verification that the work is correct. ` +
    `completed_tasks is feature-scoped and legitimately empties on an active_feature change, and a merged ` +
    `parallel lane's ledger can be discarded on conflict (root cause: E150 — not fixed by this detector). ` +
    `Do NOT run tw_sync to "fix" this: tw_sync would carry the previous feature's completion marks into the new ` +
    `feature's ledger. Verify via the cited qa_reports evidence instead.`
  );
}

// Fan-out scope advisory. Detects a LINKED git worktree the same way
// bin/agc-init.mjs (isLinkedWorktree) does — a linked worktree's `.git` is
// a FILE (git's "gitdir: <path>" gitfile) rather than a directory. Pure
// fs.statSync, never shells out to git (the server does not touch git — see
// CLAUDE.md "What this server does NOT do"). (E112)
function isLinkedWorktree(workspacePath: string): boolean {
  try {
    return fs.statSync(path.join(workspacePath, ".git")).isFile();
  } catch {
    return false;
  }
}

// The coordinator's own multi-unit split artifact (content/coord-*.md Feature
// Scope Gate) — its presence is a positive signal that this feature was
// deliberately fanned out across lanes.
function hasFeatureSplit(workspacePath: string): boolean {
  try {
    return fs.statSync(path.join(workspacePath, ".current", "feature-split.md")).isFile();
  } catch {
    return false;
  }
}

// Advisory-only scope caveat: fires whenever this workspace has active-scope
// incomplete tasks, because this ledger cannot see completions recorded in a
// sibling lane. Never flips driftDetected and never joins `details`. Reads
// only `workspacePath`: the server is deliberately workspace-scoped.
function computeFanoutAdvisory(workspacePath: string, incompleteTasks: string[]): string | null {
  if (incompleteTasks.length === 0) return null;
  const signals: string[] = [];
  if (hasFeatureSplit(workspacePath)) {
    signals.push("a `.current/feature-split.md` multi-unit split artifact exists in this workspace");
  }
  if (isLinkedWorktree(workspacePath)) {
    signals.push("this workspace is a linked git worktree, not the primary checkout");
  }
  const signalText =
    signals.length > 0
      ? ` Positive lane signal(s) found: ${signals.join("; ")} — consistent with this feature being fanned out across lanes.`
      : "";
  return (
    `${incompleteTasks.length} active-scope task(s) (${incompleteTasks.join(", ")}) are not recorded as complete in ` +
    `this workspace's ledger. This comparison is anchored to workspace_path and scoped to this lane alone (E109: the ` +
    `server is deliberately workspace-scoped, not cross-machine) — when a feature fans out across multiple ` +
    `lanes/worktrees, the other lanes' completions live in their own ledgers and are structurally invisible from ` +
    `here. This is a scope caveat, not a cross-workspace read and not a drift signal: it does not mean these tasks ` +
    `are undone, only that this workspace cannot see whether they were done elsewhere.${signalText}`
  );
}

// A task is "archived" when it lives under a `## Completed` H2 section. The
// match mirrors tasks-file.ts (sectionMatch[1].trim()) plus a lower-case fold,
// so `## completed`, `##  Completed  `, and `## COMPLETED` all qualify (AC-6).
// Any other section name — including unknown ones like `## Sprint-3` — is
// treated as active (conservative; AC-7), so genuine drift is never silently
// dropped.
function isArchivedSection(section: string): boolean {
  return section.trim().toLowerCase() === "completed";
}

function partitionTasks(tasks: TaskRecord[]): { completed: string[]; incomplete: string[] } {
  const completed: string[] = [];
  const incomplete: string[] = [];
  for (const t of tasks) {
    if (t.completed) completed.push(t.id);
    else incomplete.push(t.id);
  }
  return { completed, incomplete };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Token-saving: when many drift items share the same pattern (only differing
// by task ID), collapse them into a single summary line with a compact ID
// range. Keeps small drifts individually visible (≤ 5 items) while preventing
// 20+ identical lines from bloating the LLM context (~500 tokens saved per
// call in typical long projects).
const DRIFT_COMPRESS_THRESHOLD = 5;

function formatIdRange(ids: string[]): string {
  if (ids.length <= 3) return ids.join(", ");
  return `${ids[0]}–${ids[ids.length - 1]}`;
}

function compressDriftDetails(details: string[]): string[] {
  const VIBE_RE = /^Task list shows (\S+) completed, but handoff state doesn't mention it\. Possible vibe-coding drift\.$/;
  const HANDOFF_AHEAD_RE = /^Handoff says (\S+) completed, but task list shows it as incomplete\.$/;

  const vibeIds: string[] = [];
  const handoffAheadIds: string[] = [];
  const passthrough: string[] = [];

  for (const d of details) {
    const v = d.match(VIBE_RE);
    if (v) { vibeIds.push(v[1]); continue; }
    const h = d.match(HANDOFF_AHEAD_RE);
    if (h) { handoffAheadIds.push(h[1]); continue; }
    passthrough.push(d);
  }

  const out: string[] = [];
  if (vibeIds.length === 1) {
    out.push(
      `Task list shows ${vibeIds[0]} completed, but handoff state doesn't mention it. Possible vibe-coding drift.`,
    );
  } else if (vibeIds.length > 1 && vibeIds.length <= DRIFT_COMPRESS_THRESHOLD) {
    out.push(
      `Task list shows ${vibeIds.length} task(s) completed (${vibeIds.join(", ")}) that handoff state doesn't mention. Possible vibe-coding drift.`,
    );
  } else if (vibeIds.length > DRIFT_COMPRESS_THRESHOLD) {
    out.push(
      `${vibeIds.length} tasks (${formatIdRange(vibeIds)}) completed in task list but not in handoff state. Likely accumulated prior-session drift.`,
    );
  }
  if (handoffAheadIds.length === 1) {
    out.push(
      `Handoff says ${handoffAheadIds[0]} completed, but task list shows it as incomplete.`,
    );
  } else if (handoffAheadIds.length > 1 && handoffAheadIds.length <= DRIFT_COMPRESS_THRESHOLD) {
    out.push(
      `Handoff says ${handoffAheadIds.length} task(s) completed (${handoffAheadIds.join(", ")}) that task list shows as incomplete.`,
    );
  } else if (handoffAheadIds.length > DRIFT_COMPRESS_THRESHOLD) {
    out.push(
      `${handoffAheadIds.length} tasks (${formatIdRange(handoffAheadIds)}) marked completed in handoff but incomplete in task list.`,
    );
  }
  out.push(...passthrough);
  return out;
}

// Read the raw on-disk schema_version for a file-backed artifact, bypassing
// the lazy-migrate readers (which always return CURRENT in memory). Returns
// null when the artifact is absent — typical in SQLite mode, where these
// files don't exist and version skew is enforced refuse-loud at DB boot
// inside runSqliteMigrations() instead.
function readArtifactVersion(workspacePath: string, kind: SchemaKind): number | null {
  try {
    if (kind === "handoff") {
      // Handoff path via the lane seam, with the read-only lane-then-flat
      // fallback readAndMigrate uses, so an unmigrated flat workspace's
      // future-schema handoff still shows up as graceful skew drift, not as
      // the parser's raw refusal. No lock, no migration, no write.
      const abs = path.resolve(workspacePath);
      const lanePath = resolveCurrentLanePaths(abs).handoffPath;
      const p = fs.existsSync(lanePath) ? lanePath : resolveFlatLanePaths(abs).handoffPath;
      if (!fs.existsSync(p)) return null;
      const content = fs.readFileSync(p, "utf-8");
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) return 0;
      const parsed = yaml.load(match[1]);
      return peekVersion(parsed);
    }
    if (kind === "tasks") {
      // findTasksFile is lane-aware — the lane ledger, else the legacy file —
      // so a future-schema root index still reports skew. (E125a)
      const tasksPath = findTasksFile(workspacePath);
      if (!tasksPath) return null;
      const raw = fs.readFileSync(tasksPath, "utf-8");
      const sentinel = raw.match(/^<!--\s*schema_version:\s*(\d+)\s*-->/);
      if (!sentinel) return 0;
      const v = Number(sentinel[1]);
      return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
    }
    if (kind === "config") {
      const p = path.join(workspacePath, ".current", ".config.json");
      if (!fs.existsSync(p)) return null;
      const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
      return peekVersion(parsed);
    }
    return null;
  } catch {
    // Unreadable / unparsable artifact: don't fabricate a drift reason here;
    // the primary reader will surface a clearer error on the next call.
    return null;
  }
}

// Report any artifact whose on-disk schema_version is GREATER than the
// server's current. Stale (< CURRENT) artifacts are NOT reported: lazy
// migrate-on-read heals them before they ever reach drift detection
// (per specs/schema-versioning-architecture.md, AC-6).
function checkVersionSkew(workspacePath: string): string[] {
  const drifts: string[] = [];
  for (const kind of ["handoff", "tasks", "config"] as const) {
    const onDisk = readArtifactVersion(workspacePath, kind);
    if (onDisk === null) continue;
    const target = CURRENT_VERSIONS[kind];
    if (onDisk > target) {
      drifts.push(
        `Schema version skew: ${kind} on-disk v${onDisk} > server max v${target}. ` +
          `Workspace was written by a newer server. Upgrade or migrate manually.`,
      );
    }
  }
  return drifts;
}


export function detectDrift(workspacePath: string): string {
  // First-class version-skew check (Phase 4 AC-6). Runs BEFORE storage.parse
  // and storage.listTasks because those would themselves refuse-loud on a
  // future on-disk version, masking the underlying cause. Returning early
  // here turns "the parser threw" into "the drift report explains why".
  const skewDrifts = checkVersionSkew(workspacePath);
  if (skewDrifts.length > 0) {
    const report: DriftReport = {
      driftDetected: true,
      details: skewDrifts,
      handoffLastTask: "",
      tasksCompleted: [],
      tasksIncomplete: [],
      stampAdvisory: null,
      fanoutAdvisory: null,
      evidenceBackedIds: [],
    };
    return JSON.stringify(report);
  }

  const storage = getActiveStorage();
  const handoff = storage.parse(workspacePath);
  const tasks = storage.listTasks(workspacePath);

  if (!handoff && !tasks) {
    const report: DriftReport = {
      driftDetected: false,
      details: ["No handoff state or task list found. Fresh project."],
      handoffLastTask: "",
      tasksCompleted: [],
      tasksIncomplete: [],
      stampAdvisory: null,
      fanoutAdvisory: null,
      evidenceBackedIds: [],
    };
    return JSON.stringify(report);
  }

  if (!handoff) {
    const report: DriftReport = {
      driftDetected: true,
      details: ["Task list exists but handoff state is missing. State was never initialized."],
      handoffLastTask: "",
      tasksCompleted: [],
      tasksIncomplete: [],
      stampAdvisory: null,
      fanoutAdvisory: null,
      evidenceBackedIds: [],
    };
    return JSON.stringify(report);
  }

  // Stamp advisory: computed once, right after handoff is confirmed non-null,
  // then threaded into every return path from this point forward. No
  // storage-mode scoping: both HandoffStorage implementations stamp
  // last_updated through the same new Date().toISOString() path.
  const stampAdvisory = computeStampAdvisory(handoff.last_updated);

  if (!tasks) {
    const report: DriftReport = {
      driftDetected: false,
      details: ["Handoff state exists but no task list found. Likely vibe-coding only mode."],
      handoffLastTask: handoff.active_feature,
      tasksCompleted: handoff.completed_tasks,
      tasksIncomplete: [],
      stampAdvisory,
      fanoutAdvisory: null,
      evidenceBackedIds: [],
    };
    return JSON.stringify(report);
  }

  // Exclude archived (`## Completed`) tasks so tasks moved there by
  // tw_complete_task do not misfire as drift forever. Only when the file uses
  // the Active/Completed convention; legacy files keep full-file behaviour.
  // Active `[x]` tasks absent from handoff still surface, and tasksCompleted /
  // tasksIncomplete reflect active scope only.
  const usesActiveCompletedConvention = tasks.some((t) => {
    const s = t.section.trim().toLowerCase();
    return s === "active" || s === "completed";
  });
  const activeScopeTasks = usesActiveCompletedConvention
    ? tasks.filter((t) => !isArchivedSection(t.section))
    : tasks;

  const { completed: completedTasks, incomplete: incompleteTasks } = partitionTasks(activeScopeTasks);

  // Drift-baseline exemption: ids in `.current/.config.json` driftBaselineIds
  // (written by release-engineer after PASS) are excluded from the
  // vibe-coding-drift check and from tasksCompleted only; other drift
  // directions are untouched. A missing file or field (the usual SQLite/HTTP
  // case) yields an empty set. Checked against the active-scope task set.
  const baselineIds = new Set<string>(loadConfig(workspacePath).driftBaselineIds ?? []);

  const drifts: string[] = [];

  // Pre-compile one regex per known task ID so handoff-string scanning stays O(handoff × matches)
  // instead of recompiling on every iteration.
  const idVocab = new Set<string>([...completedTasks, ...incompleteTasks]);
  const idPatterns = new Map<string, RegExp>();
  for (const id of idVocab) {
    idPatterns.set(id, new RegExp(`\\b${escapeRegExp(id)}\\b`));
  }
  const handoffTaskIds = handoff.completed_tasks.flatMap((c) =>
    [...idPatterns].filter(([, re]) => re.test(c)).map(([id]) => id),
  );

  for (const taskId of handoffTaskIds) {
    if (!completedTasks.includes(taskId)) {
      drifts.push(`Handoff says ${taskId} completed, but task list shows it as incomplete.`);
    }
  }

  // An id that would otherwise read as "Possible vibe-coding drift" moves to
  // evidenceBackedIds when a qualifying QA record exists anywhere
  // tools/evidence-lookup.ts looks. The driftBaselineIds exemption still runs
  // first; this case is not handled by growing that baseline, which advances
  // once per release while active_feature changes far more often. Candidates
  // are looked up in one batch so each archive listing and covers: index is
  // built at most once per call.
  const evidenceCandidateIds = completedTasks.filter(
    (taskId) => !baselineIds.has(taskId) && !handoffTaskIds.includes(taskId),
  );
  const evidenceQualifiedIds = hasEvidenceAnywhere(workspacePath, evidenceCandidateIds);

  const evidenceBackedIds: string[] = [];
  for (const taskId of completedTasks) {
    if (baselineIds.has(taskId)) continue; // acknowledged baseline — not vibe-coding drift (AC-1)
    if (handoffTaskIds.includes(taskId)) continue;
    if (evidenceQualifiedIds.has(taskId)) {
      evidenceBackedIds.push(taskId);
      continue;
    }
    drifts.push(
      `Task list shows ${taskId} completed, but handoff state doesn't mention it. Possible vibe-coding drift.`,
    );
  }

  if (handoff.status === "FAIL" || handoff.status === "Blocked") {
    if (incompleteTasks.length > 0) {
      drifts.push(
        `Handoff status is ${handoff.status}, but ${incompleteTasks.length} tasks remain incomplete.`,
      );
    }
  }

  // Fan-out advisory, computed now that incompleteTasks is known. Never
  // merged into `details`, never flips driftDetected (see
  // computeFanoutAdvisory's header comment). (E112)
  const fanoutAdvisory = computeFanoutAdvisory(workspacePath, incompleteTasks);

  let details: string[];
  if (drifts.length > 0) {
    details = compressDriftDetails(drifts);
  } else if (fanoutAdvisory) {
    // Case (a): stop the clean headline over-claiming synchronization beyond
    // this workspace's own scope — scope-qualify it and state the open count.
    // Only reached when drifts.length === 0, so driftDetected is still false.
    details = [
      `No drift detected within this workspace. ${incompleteTasks.length} active-scope task(s) are not yet ` +
        `recorded as complete here — see fanoutAdvisory.`,
    ];
  } else {
    details = ["No drift detected. Handoff and tasks are synchronized."];
  }
  if (evidenceBackedIds.length > 0) {
    details.push(buildEvidenceBackedLine(evidenceBackedIds));
  }

  const report: DriftReport = {
    driftDetected: drifts.length > 0,
    details,
    handoffLastTask: handoff.active_feature,
    // Baseline-acknowledged IDs are suppressed from the report (AC-1); the
    // unfiltered completedTasks above still feeds the handoff-ahead check so
    // a baselined id recorded in handoff never misreports as incomplete.
    tasksCompleted: completedTasks.filter((id) => !baselineIds.has(id)),
    tasksIncomplete: incompleteTasks,
    stampAdvisory,
    fanoutAdvisory,
    evidenceBackedIds,
  };

  return JSON.stringify(report);
}

// ==========================================
// MCP tool handler (registry-pattern) — verbatim relocation of the
// index.ts `tw_detect_drift` dispatcher case.
// ==========================================

// --- No guard: drift detection is read-only ---
export async function handleDetectDrift(args: WorkspaceOnlyInput): Promise<ToolResult> {
  const { workspace_path } = args;
  const result = detectDrift(workspace_path);
  return { content: [{ type: "text" as const, text: result }] };
}
