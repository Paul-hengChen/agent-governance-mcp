import "../schema/migrations-handoff.js";
import type { HandoffState } from "./handoff-types.js";
/** The workspace traversal bound. `candidateAbs` MUST already be resolved.
 *  Lexical (no realpath), matching the zod refines' original bound exactly,
 *  so it is neither loosened nor tightened. */
export declare function isInsideWorkspace(workspacePath: string, candidateAbs: string): boolean;
/** Write side (AC1). Resolves `prdPath` against `workspacePath` and returns the
 *  POSIX-separator workspace-relative form, or `undefined` when it falls
 *  outside the bound. Never returns an absolute string, so an absolute path
 *  can never be persisted. */
export declare function relativizePrdPath(workspacePath: string, prdPath: string): string | undefined;
/** Read side (AC2/AC3/AC4). `stored` is the raw non-empty frontmatter value.
 *  - absolute + in-bounds → returned verbatim (legacy encoding, AC3)
 *  - relative + in-bounds → resolved against workspacePath (AC2)
 *  - either, out-of-bounds → undefined (drop to absent, AC4) */
export declare function resolveStoredPrdPath(workspacePath: string, stored: string): string | undefined;
export declare function getFlatHandoffPath(workspacePath: string): string;
/**
 * Throw HANDOFF_LAYOUT_CONFLICT when BOTH the flat and the lane-scoped
 * handoff.md exist (the state an older, flat-layout server produces by
 * writing the flat file after a restarted server migrated). Scoped to
 * handoff.md only — a sidecar on both sides is merged by the migration
 * instead. A plain Error, deliberately NOT a GateErrorCode: it fires on reads
 * too. Touches nothing; callers run it before any move. (E123)
 */
export declare function assertNoHandoffLayoutConflict(workspacePath: string): void;
export declare function parseCutApprovedSource(raw: unknown): string | undefined;
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