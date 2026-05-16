// Coded by @sr-engineer
// Tool: drift detection — compare handoff state vs task list.
// Reads both sides through the active storage adapter so SQLite/HTTP mode works
// without any filesystem access to the workspace.

import { getActiveStorage, type TaskRecord } from "./storage.js";

interface DriftReport {
  driftDetected: boolean;
  details: string[];
  handoffLastTask: string;
  tasksCompleted: string[];
  tasksIncomplete: string[];
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

export function detectDrift(workspacePath: string): string {
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

  const { completed: completedTasks, incomplete: incompleteTasks } = partitionTasks(tasks);

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
    details: drifts.length > 0 ? drifts : ["No drift detected. Handoff and tasks are synchronized."],
    handoffLastTask: handoff.active_feature,
    tasksCompleted: completedTasks,
    tasksIncomplete: incompleteTasks,
  };

  return JSON.stringify(report);
}
