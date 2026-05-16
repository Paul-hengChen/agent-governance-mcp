// Coded by @sr-engineer
// Tools: handoff state read/write with format enforcement

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  markStateRead,
  verifyFreshness,
  refreshSnapshotFor,
} from "../guards/session.js";
import { withFileLock } from "../guards/file-lock.js";

export interface HandoffState {
  active_feature: string;
  status: string;
  last_updated: string;
  blocking_reason?: string;
  last_agent?: string;
  completed_tasks: string[];
  pending_notes: string[];
}

// Cap the completed_tasks array returned by readState() so long projects
// don't bloat the LLM context. The full list is still in handoff.md.
const COMPLETED_TASKS_RETURN_LIMIT = 50;

function getHandoffPath(workspacePath: string): string {
  return path.join(workspacePath, ".current", "handoff.md");
}

function ensureDir(workspacePath: string): void {
  const dir = path.join(workspacePath, ".current");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractSectionContent(body: string, headingPattern: RegExp): string {
  const match = body.match(headingPattern);
  if (!match || match.index === undefined) return "";
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const nextSection = rest.search(/\n##\s/);
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

/**
 * Parse handoff.md YAML frontmatter + section content into structured JSON.
 * Returns null if file doesn't exist.
 */
export function parseHandoff(workspacePath: string): HandoffState | null {
  const handoffPath = getHandoffPath(workspacePath);
  if (!fs.existsSync(handoffPath)) return null;

  const content = fs.readFileSync(handoffPath, "utf-8");

  // Parse YAML frontmatter with js-yaml (handles quotes, colons in values, etc.)
  const frontmatter: Record<string, unknown> = {};
  const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (yamlMatch) {
    try {
      const parsed = yaml.load(yamlMatch[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.assign(frontmatter, parsed as Record<string, unknown>);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse handoff.md frontmatter: ${message}`);
    }
  }

  const asString = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

  // Section-scoped parsing: strip frontmatter, then extract by heading keyword.
  // Match either the Chinese or English keyword so mixed-locale handoff.md
  // files (or workspaces that have customised the heading text) still parse.
  const body = content.replace(/^---[\s\S]*?---\s*/, "");
  const completedSection = extractSectionContent(body, /^##[^\n]*(?:完成|Completed)[^\n]*\n/im);
  const pendingSection = extractSectionContent(body, /^##[^\n]*(?:待辦|Pending)[^\n]*\n/im);

  const completed_tasks = [...completedSection.matchAll(/- \[x\] (.+)/g)].map((m) => m[1].trim());
  // Pending notes are plain list items (not checkboxes). "無" is the empty-section sentinel.
  const pending_notes = [...pendingSection.matchAll(/^- (?!\[)(.+)/gm)]
    .map((m) => m[1].trim())
    .filter((s) => s !== "無" && s !== "");

  const blockingReason = asString(frontmatter.blocking_reason) || undefined;
  const lastAgent = asString(frontmatter.last_agent) || undefined;

  return {
    active_feature: asString(frontmatter.active_feature),
    status: asString(frontmatter.status),
    last_updated: asString(frontmatter.last_updated),
    ...(blockingReason && { blocking_reason: blockingReason }),
    ...(lastAgent && { last_agent: lastAgent }),
    completed_tasks,
    pending_notes,
  };
}

/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 */
export function readHandoffState(workspacePath: string): string {
  markStateRead(workspacePath);

  const state = parseHandoff(workspacePath);
  if (!state) {
    return JSON.stringify({
      exists: false,
      message: "No handoff state found. This is a fresh project — initialize by calling tw_update_state.",
    });
  }
  const truncated = state.completed_tasks.length > COMPLETED_TASKS_RETURN_LIMIT;
  const view = {
    ...state,
    completed_tasks: truncated
      ? state.completed_tasks.slice(-COMPLETED_TASKS_RETURN_LIMIT)
      : state.completed_tasks,
    ...(truncated && {
      completed_tasks_truncated: {
        showing: COMPLETED_TASKS_RETURN_LIMIT,
        total: state.completed_tasks.length,
      },
    }),
  };
  return JSON.stringify({ exists: true, ...view });
}

/**
 * Write handoff state with enforced formatting.
 * Pending notes are written as plain list items (not checkboxes) to avoid
 * ambiguity with tracked task IDs in the completed section.
 */
export async function writeHandoffState(
  workspacePath: string,
  activeFeature: string,
  status: string,
  completedTasks: string[],
  pendingNotes: string[],
  blockingReason?: string,
  lastAgent?: string,
): Promise<string> {
  ensureDir(workspacePath);
  const handoffPath = getHandoffPath(workspacePath);
  const lockPath = path.join(workspacePath, ".current", ".handoff.lock");

  return withFileLock(lockPath, () => {
    // Reject if another process / hand-edit touched the file since we read it.
    verifyFreshness(workspacePath, handoffPath, "handoff");

    const now = new Date().toISOString();

    const completedList = completedTasks.length
      ? completedTasks.map((t) => `- [x] ${t}`).join("\n")
      : "- 無";
    // Plain list items (no checkbox) so they are visually distinct from task IDs.
    const pendingList = pendingNotes.length
      ? pendingNotes.map((t) => `- ${t}`).join("\n")
      : "- 無";

    const frontmatterData: Record<string, string> = {
      active_feature: activeFeature,
      status,
      last_updated: now,
    };
    if (blockingReason) frontmatterData.blocking_reason = blockingReason;
    if (lastAgent) frontmatterData.last_agent = lastAgent;

    const frontmatter = yaml
      .dump(frontmatterData, { lineWidth: -1, forceQuotes: true, quotingType: '"' })
      .trimEnd();

    const content = `---
${frontmatter}
---
# 📍 任務交接狀態 (Handoff State)

## ✅ 已完成 (Completed)
${completedList}

## ⚠️ 待辦與交接 (Pending & Handoff Notes)
${pendingList}

---
> 🤖 **System Note**: Auto-generated by teamwork-mcp-server. Do NOT edit manually.
`;

    // Atomic publish: write to temp, then rename. Readers see old or new, never partial.
    const tmpPath = `${handoffPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, content, "utf-8");
    fs.renameSync(tmpPath, handoffPath);

    refreshSnapshotFor(workspacePath, handoffPath, "handoff");
    return JSON.stringify({ success: true, path: handoffPath, updated_at: now });
  });
}
