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
  // Code-reviewer round counter — incremented on (code-reviewer, FAIL),
  // reset on handoff to qa-engineer or PM re-entry. Symmetric to qa_round
  // with its own REVIEW_ROUND_CAP. Backward-compat: parser defaults to 0.
  review_round: number;
  // Optional absolute path to the workspace's PRD file. Consumed by the RAG
  // lazy-reindex hook in prompts/build.ts:appendSpecContext. When absent, the
  // hook falls back to discovering PRD.md/docs/PRD.md/specs/PRD.md.
  prd_path?: string;
}

// Cap the completed_tasks array returned by readState() so long projects
// don't bloat the LLM context. The full list is still in handoff.md.
const COMPLETED_TASKS_RETURN_LIMIT = 50;

// Cap the total character length of pending_notes returned by readState().
// Long deliverable descriptions (common in sr-engineer handoffs) can bloat
// the LLM context on every tw_get_state call. Full notes remain on disk.
const PENDING_NOTES_CHAR_LIMIT = 3000;

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
  // Pending notes are plain list items (not checkboxes). "(none)" / legacy "無" are empty-section sentinels.
  const pending_notes = [...pendingSection.matchAll(/^- (?!\[)(.+)/gm)]
    .map((m) => m[1].trim())
    .filter((s) => s !== "(none)" && s !== "無" && s !== "");

  const blockingReason = asString(frontmatter.blocking_reason) || undefined;
  const lastAgent = asString(frontmatter.last_agent) || undefined;
  const prdPath = asString(frontmatter.prd_path) || undefined;
  const qaRoundRaw = Number(frontmatter.qa_round);
  const qa_round = Number.isFinite(qaRoundRaw) && qaRoundRaw >= 0 ? Math.floor(qaRoundRaw) : 0;
  const reviewRoundRaw = Number(frontmatter.review_round);
  const review_round =
    Number.isFinite(reviewRoundRaw) && reviewRoundRaw >= 0 ? Math.floor(reviewRoundRaw) : 0;

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
    review_round,
  };

  // One-shot stderr warning on v1→v2 migration when an in-flight ticket sits at
  // sr-engineer:In_Progress. After v2, that tuple can no longer transition
  // directly to qa-engineer; operator must manually re-route to code-reviewer.
  if (
    migration.applied.includes(2) &&
    state.last_agent === "sr-engineer" &&
    state.status === "In_Progress"
  ) {
    process.stderr.write(
      "[code-reviewer migration] In-flight ticket detected at sr-engineer:In_Progress — " +
        "next transition to qa-engineer will be rejected. " +
        "Manually re-route to code-reviewer or roll back to pm.\n",
    );
  }

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
      state.review_round,
    ).catch(() => {
      /* swallowed — read still returns migrated state */
    });
  }

  const truncated = state.completed_tasks.length > COMPLETED_TASKS_RETURN_LIMIT;

  // Truncate pending_notes by total character count. Keep notes from the
  // front (routing directives like "next_role: ..." appear first and are
  // most important). Drop trailing notes that push past the limit.
  let pendingNotes = state.pending_notes;
  let pendingTruncated = false;
  const totalChars = pendingNotes.reduce((sum, n) => sum + n.length, 0);
  if (totalChars > PENDING_NOTES_CHAR_LIMIT) {
    const kept: string[] = [];
    let charBudget = PENDING_NOTES_CHAR_LIMIT;
    for (const note of pendingNotes) {
      if (charBudget <= 0) break;
      if (note.length <= charBudget) {
        kept.push(note);
        charBudget -= note.length;
      } else {
        kept.push(note.slice(0, charBudget) + "…[truncated]");
        charBudget = 0;
      }
    }
    pendingNotes = kept;
    pendingTruncated = true;
  }

  const view = {
    ...state,
    completed_tasks: truncated
      ? state.completed_tasks.slice(-COMPLETED_TASKS_RETURN_LIMIT)
      : state.completed_tasks,
    pending_notes: pendingNotes,
    ...(truncated && {
      completed_tasks_truncated: {
        showing: COMPLETED_TASKS_RETURN_LIMIT,
        total: state.completed_tasks.length,
      },
    }),
    ...(pendingTruncated && {
      pending_notes_truncated: {
        total_chars: totalChars,
        limit: PENDING_NOTES_CHAR_LIMIT,
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
  reviewRound?: number,
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
      : "- (none)";
    // Plain list items (no checkbox) so they are visually distinct from task IDs.
    const pendingList = pendingNotes.length
      ? pendingNotes.map((t) => `- ${t}`).join("\n")
      : "- (none)";

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
    const normalisedReviewRound =
      Number.isFinite(reviewRound) && (reviewRound as number) >= 0
        ? Math.floor(reviewRound as number)
        : 0;
    frontmatterData.review_round = normalisedReviewRound;

    const frontmatter = yaml
      .dump(frontmatterData, { lineWidth: -1, forceQuotes: true, quotingType: '"' })
      .trimEnd();

    const content = `---
${frontmatter}
---
# Handoff State

## Completed
${completedList}

## Pending & Handoff Notes
${pendingList}

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
`;

    // Atomic publish: write to temp, then rename. Readers see old or new, never partial.
    const tmpPath = `${handoffPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, content, "utf-8");
    fs.renameSync(tmpPath, handoffPath);

    refreshSnapshotFor(workspacePath, handoffPath, "handoff");
    return JSON.stringify({ success: true, path: handoffPath, updated_at: now });
  });
}
