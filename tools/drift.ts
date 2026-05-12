// Coded by @sr-engineer
// Tool: drift detection — compare handoff.md state vs tasks.md checkboxes

import * as fs from "fs";
import { parseHandoff } from "./handoff.js";
import { findTasksFile, resolveTaskRegex } from "./config.js";

interface DriftReport {
  driftDetected: boolean;
  details: string[];
  handoffLastTask: string;
  tasksCompleted: string[];
  tasksIncomplete: string[];
}

/**
 * Detect drift between handoff.md and tasks.md.
 * Returns structured JSON report.
 */
export function detectDrift(workspacePath: string): string {
  const handoff = parseHandoff(workspacePath);
  const tasksPath = findTasksFile(workspacePath);

  // Edge cases
  if (!handoff && !tasksPath) {
    return JSON.stringify({
      driftDetected: false,
      details: ["No handoff.md or tasks.md found. Fresh project."],
      handoffLastTask: "",
      tasksCompleted: [],
      tasksIncomplete: [],
    });
  }

  if (!handoff) {
    return JSON.stringify({
      driftDetected: true,
      details: ["tasks.md exists but handoff.md is missing. State was never initialized."],
      handoffLastTask: "",
      tasksCompleted: [],
      tasksIncomplete: [],
    });
  }

  if (!tasksPath) {
    return JSON.stringify({
      driftDetected: false,
      details: ["handoff.md exists but no tasks.md found. Likely vibe-coding only mode."],
      handoffLastTask: handoff.active_feature,
      tasksCompleted: handoff.completed,
      tasksIncomplete: [],
    });
  }

  // Parse task-list checkboxes using the configured task pattern so custom
  // formats (e.g. JIRA-123) are detected the same way the task tools see them.
  const regex = resolveTaskRegex(workspacePath);
  const tasksContent = fs.readFileSync(tasksPath, "utf-8");
  const completedTasks: string[] = [];
  const incompleteTasks: string[] = [];

  for (const rawLine of tasksContent.split("\n")) {
    const line = rawLine.trim();
    const match = line.match(regex);
    if (!match || match[1] === undefined || match[2] === undefined) continue;
    if (match[1] === "x") completedTasks.push(match[2]);
    else if (match[1] === " ") incompleteTasks.push(match[2]);
  }

  // Detect drifts
  const drifts: string[] = [];

  // Pull any token that looks like an ID out of handoff completed entries.
  // We compare *all* IDs found in the configured regex's ID space.
  const idVocab = new Set<string>([...completedTasks, ...incompleteTasks]);
  const handoffTaskIds = handoff.completed
    .flatMap((c) => Array.from(idVocab).filter((id) => c.includes(id)));

  for (const taskId of handoffTaskIds) {
    if (!completedTasks.includes(taskId)) {
      drifts.push(`Handoff says ${taskId} completed, but tasks.md shows it as incomplete.`);
    }
  }

  // Check 2: tasks.md has completed tasks not in handoff
  for (const taskId of completedTasks) {
    if (!handoffTaskIds.includes(taskId)) {
      drifts.push(`tasks.md shows ${taskId} completed, but handoff.md doesn't mention it. Possible vibe-coding drift.`);
    }
  }

  // Check 3: handoff status is FAIL/Blocked but tasks still show in-progress
  if (handoff.status === "FAIL" || handoff.status === "Blocked") {
    if (incompleteTasks.length > 0) {
      drifts.push(`Handoff status is ${handoff.status}, but ${incompleteTasks.length} tasks remain incomplete.`);
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
