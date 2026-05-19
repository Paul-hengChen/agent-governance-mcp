// Per-workspace config loader for the agent-governance-mcp server.
// All fields optional — absent file means "use the generic markdown-checkbox defaults".
//
// .current/.config.json shape:
//   {
//     "taskPattern": "<JS regex source string>",   // matched against trimmed line; group 1 = " "|"x" checkmark, group 2 = task ID, group 3 = description
//     "taskPaths": ["tasks.md", "TODO.md"]          // workspace-relative candidate paths, tried in order
//   }

import * as fs from "fs";
import * as path from "path";

export interface WorkspaceConfig {
  taskPattern?: string;
  taskPaths?: string[];
}

// Methodology-agnostic defaults. Common task-list filenames in workspace root
// or under .current/. No project-management-tool-specific paths.
const DEFAULT_TASK_PATHS = [
  ".current/tasks.md",
  "tasks.md",
  "TODO.md",
];

// Generic markdown-checkbox regex.
//   Group 1: checkmark (" " or "x")
//   Group 2: task ID (any non-whitespace token immediately after the checkbox)
//   Group 3: description (everything after the ID)
// Matches lines like:
//   - [ ] T01 build login flow
//   - [x] PROJ-42 fix race
//   - [ ] auth-refactor write migration
export const DEFAULT_TASK_REGEX = /^- \[([ x])\] (\S+)\s+(.+)$/;

const configCache = new Map<string, WorkspaceConfig>();

export function loadConfig(workspacePath: string): WorkspaceConfig {
  const cached = configCache.get(workspacePath);
  if (cached !== undefined) return cached;

  const configPath = path.join(workspacePath, ".current", ".config.json");
  if (!fs.existsSync(configPath)) {
    configCache.set(workspacePath, {});
    return {};
  }
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(`Failed to read ${configPath}: ${(err as Error).message}`);
  }
  let result: WorkspaceConfig;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("config must be a JSON object");
    }
    result = parsed as WorkspaceConfig;
  } catch (err) {
    throw new Error(`Failed to parse ${configPath}: ${(err as Error).message}`);
  }
  configCache.set(workspacePath, result);
  return result;
}

export function resolveTaskPaths(workspacePath: string): string[] {
  const config = loadConfig(workspacePath);
  const rels = config.taskPaths?.length ? config.taskPaths : DEFAULT_TASK_PATHS;
  return rels.map((p) => path.join(workspacePath, p));
}

export function findTasksFile(workspacePath: string): string | null {
  return resolveTaskPaths(workspacePath).find((p) => fs.existsSync(p)) ?? null;
}

/**
 * Returns the active task-line regex. Either:
 *   - config.taskPattern (caller-supplied), or
 *   - the generic markdown-checkbox default.
 *
 * Contract for any pattern (custom or default): group 1 is the checkmark,
 * group 2 is the task ID, group 3+ are joined as the description.
 */
export function resolveTaskRegex(workspacePath: string): RegExp {
  const config = loadConfig(workspacePath);
  if (config.taskPattern) {
    try {
      return new RegExp(config.taskPattern);
    } catch (err) {
      throw new Error(
        `Invalid taskPattern in .current/.config.json: ${(err as Error).message}`
      );
    }
  }
  return DEFAULT_TASK_REGEX;
}
