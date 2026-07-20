import "../schema/migrations-handoff.js";
import type { HandoffState } from "./handoff-types.js";
/**
 * Parse handoff.md YAML frontmatter + section content into structured JSON.
 * Returns null if file doesn't exist. Runs schema migrations in-memory; does
 * NOT write back (callers that need persistence go through readHandoffState).
 */
export declare function parseHandoff(workspacePath: string): HandoffState | null;
/**
 * Read handoff state. Marks session as "state read" for guard enforcement.
 * Triggers a fire-and-forget write-back when schema migrations were applied,
 * so the on-disk file heals to CURRENT on the first read.
 */
export declare function readHandoffState(workspacePath: string): string;
//# sourceMappingURL=handoff-parse.d.ts.map