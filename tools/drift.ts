// Coded by @sr-engineer
// Tool: drift detection — compare handoff.md state vs tasks.md checkboxes

import * as fs from "fs";
import * as path from "path";
import { parseHandoff } from "./handoff.js";

interface DriftReport {
  driftDetected: boolean;
  details: string[];
  handoffLastTask: string;
  tasksCompleted: string[];
  tasksIncomplete: string[];
}

function findTasksFile(workspacePath: string): string | null {
  const candidates = [
    path.join(workspacePath, ".current", "tasks.md"),
    path.join(workspacePath, ".specify", "tasks.md"),
    path.join(workspacePath, "specs", "tasks.md"),
    path.join(workspacePath, "tasks.md"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
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

  // Parse tasks.md checkboxes
  const tasksContent = fs.readFileSync(tasksPath, "utf-8");
  const completedTasks: string[] = [];
  const incompleteTasks: string[] = [];

  for (const line of tasksContent.split("\n")) {
    const completedMatch = line.match(/- \[x\] (T\d+)/);
    const incompleteMatch = line.match(/- \[ \] (T\d+)/);
    if (completedMatch) completedTasks.push(completedMatch[1]);
    if (incompleteMatch) incompleteTasks.push(incompleteMatch[1]);
  }

  // Detect drifts
  const drifts: string[] = [];

  // Check 1: handoff completed tasks vs tasks.md completed
  const handoffTaskIds = handoff.completed
    .map((c) => c.match(/T\d+/)?.[0])
    .filter(Boolean) as string[];

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
