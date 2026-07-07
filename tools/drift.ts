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

interface DriftReport {
  driftDetected: boolean;
  details: string[];
  handoffLastTask: string;
  tasksCompleted: string[];
  tasksIncomplete: string[];
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
      const p = path.join(workspacePath, ".current", "handoff.md");
      if (!fs.existsSync(p)) return null;
      const content = fs.readFileSync(p, "utf-8");
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) return 0;
      const parsed = yaml.load(match[1]);
      return peekVersion(parsed);
    }
    if (kind === "tasks") {
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

  // Exclude archived (`## Completed`) tasks from drift comparison so that
  // tasks migrated by tw_complete_task don't misfire as "completed in task
  // list but not in handoff" forever (AC-1). Backward-compat gate: only filter
  // when the file actually uses the Active/Completed convention — i.e. some
  // task carries an `Active` or `Completed` section. Legacy files with neither
  // section name keep full-file behaviour unchanged (AC-3, AC-4). Active `[x]`
  // tasks absent from handoff still surface as drift (AC-2); the returned
  // tasksCompleted/tasksIncomplete reflect active scope only (AC-5).
  const usesActiveCompletedConvention = tasks.some((t) => {
    const s = t.section.trim().toLowerCase();
    return s === "active" || s === "completed";
  });
  const activeScopeTasks = usesActiveCompletedConvention
    ? tasks.filter((t) => !isArchivedSection(t.section))
    : tasks;

  const { completed: completedTasks, incomplete: incompleteTasks } = partitionTasks(activeScopeTasks);

  // Drift-baseline exemption (drift-baseline-exemption): task IDs listed in
  // `.current/.config.json` → `driftBaselineIds` have been explicitly
  // acknowledged as already-shipped-and-reconciled (sanctioned writer:
  // release-engineer, post-PASS). They are excluded from the vibe-coding-drift
  // comparison and from the reported tasksCompleted array ONLY (AC-1) —
  // non-baselined IDs still surface (AC-2), and the handoff-ahead /
  // FAIL-Blocked drift directions are untouched (AC-5). Absent file or absent
  // field yields an empty set: zero behavior change (AC-3); in SQLite/HTTP
  // mode the config file typically doesn't exist, so loadConfig() returns {}
  // and this is a graceful no-op (AC-7). Composes independently with the
  // archived-section filter above (AC-4): the baseline is checked against the
  // already-active-scoped task set.
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

  for (const taskId of completedTasks) {
    if (baselineIds.has(taskId)) continue; // acknowledged baseline — not vibe-coding drift (AC-1)
    if (!handoffTaskIds.includes(taskId)) {
      drifts.push(
        `Task list shows ${taskId} completed, but handoff state doesn't mention it. Possible vibe-coding drift.`,
      );
    }
  }

  if (handoff.status === "FAIL" || handoff.status === "Blocked") {
    if (incompleteTasks.length > 0) {
      drifts.push(
        `Handoff status is ${handoff.status}, but ${incompleteTasks.length} tasks remain incomplete.`,
      );
    }
  }

  const report: DriftReport = {
    driftDetected: drifts.length > 0,
    details: drifts.length > 0 ? compressDriftDetails(drifts) : ["No drift detected. Handoff and tasks are synchronized."],
    handoffLastTask: handoff.active_feature,
    // Baseline-acknowledged IDs are suppressed from the report (AC-1); the
    // unfiltered completedTasks above still feeds the handoff-ahead check so
    // a baselined id recorded in handoff never misreports as incomplete.
    tasksCompleted: completedTasks.filter((id) => !baselineIds.has(id)),
    tasksIncomplete: incompleteTasks,
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
