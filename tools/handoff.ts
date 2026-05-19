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
import { CURRENT_VERSIONS, runMigrations } from "../schema/versions.js";
// Side-effect import: registers the handoff v0→v1 migration on module load.
import "../schema/migrations-handoff.js";

export interface HandoffState {
  active_feature: string;
  status: string;
  last_updated: string;
  blocking_reason?: string;
  last_agent?: string;
  completed_tasks: string[];
  pending_notes: string[];
  // QA round counter — incremented on (qa-engineer, FAIL), reset on PASS or
  // PM re-entry. Round-cap override (>= 4) blocks all transitions except
  // (pm, In_Progress). Backward-compat: parser defaults missing field to 0.
  qa_round: number;
  // Optional absolute path to the workspace's PRD file. Consumed by the RAG
  // lazy-reindex hook in prompts/build.ts:appendSpecContext. When absent, the
  // hook falls back to discovering PRD.md/docs/PRD.md/specs/PRD.md.
  prd_path?: string;
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

interface HandoffReadResult {
  state: HandoffState;
  migrationApplied: boolean;
}

// Internal helper. Reads + parses + runs schema migrations. Returns the
// migrated state plus a flag that lets readHandoffState fire a write-back
// to heal the on-disk file. Callers that don't need the flag use parseHandoff.
function readAndMigrate(workspacePath: string): HandoffReadResult | null {
  const handoffPath = getHandoffPath(workspacePath);
  if (!fs.existsSync(handoffPath)) return null;

  const content = fs.readFileSync(handoffPath, "utf-8");

  // Parse YAML frontmatter with js-yaml (handles quotes, colons in values, etc.)
  let rawFrontmatter: Record<string, unknown> = {};
  const yamlMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (yamlMatch) {
    try {
      const parsed = yaml.load(yamlMatch[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        rawFrontmatter = parsed as Record<string, unknown>;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse handoff.md frontmatter: ${message}`);
    }
  }

  // Schema-versioning lazy migrate-on-read (Phase 4). Bumps an absent or
  // older schema_version up to CURRENT_VERSIONS.handoff. Throws refuse-loud
  // on future versions — propagates to the caller intentionally.
  const migration = runMigrations<Record<string, unknown>>("handoff", rawFrontmatter);
  const frontmatter = migration.payload;
  const migrationApplied = migration.applied.length > 0;

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
  const prdPath = asString(frontmatter.prd_path) || undefined;
  const qaRoundRaw = Number(frontmatter.qa_round);
  const qa_round = Number.isFinite(qaRoundRaw) && qaRoundRaw >= 0 ? Math.floor(qaRoundRaw) : 0;

  const state: HandoffState = {
    active_feature: asString(frontmatter.active_feature),
    status: asString(frontmatter.status),
    last_updated: asString(frontmatter.last_updated),
    ...(blockingReason && { blocking_reason: blockingReason }),
    ...(lastAgent && { last_agent: lastAgent }),
    ...(prdPath && { prd_path: prdPath }),
    completed_tasks,
    pending_notes,
    qa_round,
  };

  return { state, migrationApplied };
}

/**
 * Parse handoff.md YAML frontmatter + section content into structured JSON.
 * Returns null if file doesn't exist. Runs schema migrations in-memory; does
 * NOT write back (callers that need persistence go through readHandoffState).
 */
export function parseHandoff(workspacePath: string): HandoffState | null {
  const result = readAndMigrate(workspacePath);
  return result ? result.state : null;
}

/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 * Triggers a fire-and-forget write-back when schema migrations were applied,
 * so the on-disk file heals to CURRENT on the first read.
 */
export function readHandoffState(workspacePath: string): string {
  markStateRead(workspacePath);

  const result = readAndMigrate(workspacePath);
  if (!result) {
    return JSON.stringify({
      exists: false,
      message: "No handoff state found. This is a fresh project — initialize by calling tw_update_state.",
    });
  }
  const { state, migrationApplied } = result;

  if (migrationApplied) {
    // Defense-in-depth heal of stale on-disk files. Best-effort: a freshness
    // error here just means another writer already healed the file (AC-5), so
    // swallow it. Any other failure also non-fatal — the in-memory state we
    // return is already at CURRENT.
    void writeHandoffState(
      workspacePath,
      state.active_feature,
      state.status,
      state.completed_tasks,
      state.pending_notes,
      state.blocking_reason,
      state.last_agent,
      state.qa_round,
      state.prd_path,
    ).catch(() => {
      /* swallowed — read still returns migrated state */
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
  qaRound?: number,
  prdPath?: string,
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

    const frontmatterData: Record<string, string | number> = {
      schema_version: CURRENT_VERSIONS.handoff,
      active_feature: activeFeature,
      status,
      last_updated: now,
    };
    if (blockingReason) frontmatterData.blocking_reason = blockingReason;
    if (lastAgent) frontmatterData.last_agent = lastAgent;
    // Preserve prd_path across writes that don't set it (PM sets once;
    // downstream roles call writeState without re-passing the field).
    let effectivePrdPath: string | undefined = prdPath;
    if (effectivePrdPath === undefined) {
      const existing = parseHandoff(workspacePath);
      effectivePrdPath = existing?.prd_path;
    }
    if (effectivePrdPath) frontmatterData.prd_path = effectivePrdPath;
    // Always emit qa_round (even 0) so the field is discoverable; falsy
    // input (undefined/NaN) normalises to 0.
    const normalisedRound = Number.isFinite(qaRound) && (qaRound as number) >= 0 ? Math.floor(qaRound as number) : 0;
    frontmatterData.qa_round = normalisedRound;

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
> 🤖 **System Note**: Auto-generated by agent-governance-mcp. Do NOT edit manually.
`;

    // Atomic publish: write to temp, then rename. Readers see old or new, never partial.
    const tmpPath = `${handoffPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, content, "utf-8");
    fs.renameSync(tmpPath, handoffPath);

    refreshSnapshotFor(workspacePath, handoffPath, "handoff");
    return JSON.stringify({ success: true, path: handoffPath, updated_at: now });
  });
}
