// Coded by @sr-engineer
// Join-ticket build-entry precondition check: `depends_on` lane branches are
// ancestors of HEAD, and this workspace's own handoff matches its own
// feature-split.md plan. Invariant: ZERO cross-workspace reads; every read or
// exec is pinned to the single `repoRoot` (or `repoRoot/.current/**`). A
// callable self-check, not a pipeline gate. (E115, E109)
// Why: specs/e260b-rationale.md (tools/join-precondition.ts)

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseHandoff } from "./handoff-parse.js";

/** One `depends_on` branch's ancestry result. */
export interface LaneAncestryResult {
  branch: string;
  isAncestor: boolean;
  /** Populated only when `isAncestor` is false AND the branch could not be
   * cleanly evaluated (unknown/deleted branch, git failure) — never set for
   * a clean "exists but not yet merged" negative result. */
  error?: string;
}

/**
 * For each branch, runs `git merge-base --is-ancestor <branch> HEAD` with
 * `cwd` pinned to `repoRoot`. Never throws: a clean "not merged yet" (git
 * exit 1) is `{ isAncestor: false }`; any other failure (unknown branch, git
 * unavailable, corrupt repo) is `{ isAncestor: false, error }`, never `true`.
 */
export function checkLaneAncestry(branches: string[], repoRoot: string): LaneAncestryResult[] {
  return branches.map((branch): LaneAncestryResult => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", branch, "HEAD"], {
        cwd: repoRoot,
        stdio: ["ignore", "ignore", "pipe"],
      });
      return { branch, isAncestor: true };
    } catch (err) {
      const status = (err as NodeJS.ErrnoException & { status?: number }).status;
      if (status === 1) {
        // git merge-base --is-ancestor's documented negative result: both
        // refs resolved fine, `branch` is simply not an ancestor of HEAD
        // yet. A real, clean "not merged" answer — not a failure.
        return { branch, isAncestor: false };
      }
      // Anything else (128 for an unknown/invalid ref, ENOENT if git itself
      // is unavailable, a corrupt repo, etc.) is a degraded-but-honest
      // unknown, never a thrown exception and never a false `true`.
      const stderrBuf = (err as { stderr?: Buffer | string }).stderr;
      const stderrText = stderrBuf ? stderrBuf.toString().trim() : "";
      const message =
        stderrText || (err instanceof Error ? err.message : String(err)) ||
        "git merge-base --is-ancestor failed";
      return { branch, isAncestor: false, error: message };
    }
  });
}

/** The only membership finding possible: this workspace's own actual
 * `active_feature` is absent from EVERY row declared in
 * `.current/feature-split.md`. Names the full declared set alongside the
 * actual value — never one entry per non-matching row (a Split Table has one
 * row per planned lane, so sibling rows declaring a different lane are
 * expected, not mismatches; see Amendment History,
 * specs/e115-join-precondition-check.md). */
export interface LaneIdentityMismatch {
  /** Every populated feature-identity value found in feature-split.md,
   * order as parsed. */
  declaredFeatureIds: string[];
  actual: string;
}

export interface LaneIdentityCheckResult {
  /** false when there was nothing honest to compare (see `reason`). */
  compared: boolean;
  reason?: string;
  mismatches: LaneIdentityMismatch[];
}

const FEATURE_SPLIT_RELATIVE_PATH = path.join(".current", "feature-split.md");

/** Header cell names accepted as the declared per-row feature identity
 * column — "feature id" is the coordinator's own Split Table header
 * (content/coord-01-core-head.md); the aliases are accepted defensively. */
const DECLARED_FEATURE_COLUMN_ALIASES = new Set(["feature id", "feature_id", "active_feature"]);

function splitMarkdownTableRow(line: string): string[] {
  const stripped = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return stripped.split("|").map((cell) => cell.trim());
}

/** Strips leading/trailing markdown emphasis/code decoration (`*`, `` ` ``,
 * `_`) from a table cell (AC9). Applied BOTH before the header-alias lookup
 * (so a `**feature id**` header is still recognized) and before collecting
 * declared values (so a `` `some-feature` `` declared value compares as
 * `some-feature`, not a false membership mismatch). A legal markdown table
 * cell can carry this decoration without it being part of the identity
 * text itself. */
function stripMarkdownDecoration(cell: string): string {
  return cell.trim().replace(/^[*`_]+|[*`_]+$/g, "").trim();
}

/** Extracts every populated declared feature-identity value from a
 * feature-split.md's markdown table(s). Ignores the header row itself, the
 * `---` separator row, blank cells, and unfilled `<template>` placeholders.
 * Cells are normalized via `stripMarkdownDecoration` before both the header
 * match and the collected value (AC9). */
function parseDeclaredFeatureIds(markdown: string): string[] {
  const declared: string[] = [];
  let featureColIndex = -1;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith("|")) {
      featureColIndex = -1; // left any table block; a new one needs its own header
      continue;
    }

    const cells = splitMarkdownTableRow(trimmed);

    if (featureColIndex === -1) {
      const idx = cells.findIndex((cell) =>
        DECLARED_FEATURE_COLUMN_ALIASES.has(stripMarkdownDecoration(cell).toLowerCase()),
      );
      if (idx !== -1) featureColIndex = idx;
      continue; // this row was the header (or an unrelated table); never a data row
    }

    // The markdown separator row, e.g. |---|---|...|
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;

    const value = stripMarkdownDecoration(cells[featureColIndex] ?? "");
    if (value === "" || (value.startsWith("<") && value.endsWith(">"))) continue; // blank or unfilled placeholder
    declared.push(value);
  }

  return declared;
}

/**
 * Checks that THIS workspace's own handoff `active_feature` is a member of the
 * feature ids declared in its own `.current/feature-split.md` (one row per
 * planned lane, so non-matching sibling rows are healthy). Absent from every
 * row -> exactly one finding naming the full declared set. No split file, no
 * identity column, or no readable active_feature -> `{ compared: false, reason }`.
 * Why: specs/e260b-rationale.md (tools/join-precondition.ts)
 */
export function checkDeclaredVsActualLaneIdentity(repoRoot: string): LaneIdentityCheckResult {
  const splitPath = path.join(repoRoot, FEATURE_SPLIT_RELATIVE_PATH);

  let raw: string;
  try {
    raw = fs.readFileSync(splitPath, "utf-8");
  } catch {
    return {
      compared: false,
      reason: `no .current/feature-split.md found in this workspace (${splitPath}) — nothing to compare`,
      mismatches: [],
    };
  }

  const declaredFeatureIds = parseDeclaredFeatureIds(raw);
  if (declaredFeatureIds.length === 0) {
    return {
      compared: false,
      reason:
        "found .current/feature-split.md but no populated feature id / active_feature column could be located",
      mismatches: [],
    };
  }

  let actual: string | null;
  try {
    const state = parseHandoff(repoRoot);
    actual = state?.active_feature || null;
  } catch (err) {
    return {
      compared: false,
      reason: `this workspace's own .current/handoff.md could not be parsed: ${
        err instanceof Error ? err.message : String(err)
      }`,
      mismatches: [],
    };
  }

  if (actual === null) {
    return {
      compared: false,
      reason:
        "this workspace has no readable .current/handoff.md (or no active_feature recorded) to compare against",
      mismatches: [],
    };
  }

  // Membership, not per-row equality (AC3, amended round 1): `actual`
  // matching ANY declared row is satisfied outright; only its absence from
  // the ENTIRE declared set produces a finding, and that finding names the
  // full set rather than one entry per non-matching row.
  const mismatches: LaneIdentityMismatch[] = declaredFeatureIds.includes(actual)
    ? []
    : [{ declaredFeatureIds, actual }];

  return { compared: true, mismatches };
}

/**
 * Renders the combined ancestry + declared-vs-actual identity results as a
 * human-readable report, suitable for pasting into chat ahead of a join.
 * Takes both check results directly (no hidden re-read of any path) so the
 * CLI wrapper (scripts/join-precondition.mjs) can call checkLaneAncestry /
 * checkDeclaredVsActualLaneIdentity itself and pass their results straight
 * through.
 */
export function renderJoinPreconditionReport(
  ancestry: LaneAncestryResult[],
  identity: LaneIdentityCheckResult,
): string {
  const lines: string[] = [];
  lines.push("Join precondition check");
  lines.push("");
  lines.push("Lane ancestry (depends_on branches):");
  if (ancestry.length === 0) {
    lines.push("  (no branches given)");
  } else {
    for (const r of ancestry) {
      const mark = r.isAncestor ? "OK — merged into HEAD" : "NOT MERGED";
      lines.push(`  - ${r.branch}: ${mark}${r.error ? ` (${r.error})` : ""}`);
    }
  }
  lines.push("");
  lines.push("Declared vs actual lane identity:");
  if (!identity.compared) {
    lines.push(`  not compared — ${identity.reason}`);
  } else if (identity.mismatches.length === 0) {
    lines.push("  OK — actual active_feature found among declared lanes");
  } else {
    for (const m of identity.mismatches) {
      lines.push(
        `  MISMATCH — actual "${m.actual}" not found among declared: ${m.declaredFeatureIds.join(", ")}`,
      );
    }
  }
  lines.push("");

  const allAncestorsSatisfied = ancestry.length > 0 && ancestry.every((r) => r.isAncestor);
  const noIdentityMismatch = !identity.compared || identity.mismatches.length === 0;

  if (allAncestorsSatisfied && noIdentityMismatch) {
    // HOOK POINT FOR E126: the join moment. Every depends_on branch is an
    // ancestor of HEAD and lane identity is clear or honestly unverifiable, so
    // a ledger-preservation check would snapshot pre-merge completed-task
    // counts here. Nothing is implemented; tools/merge-invariants.ts checks a
    // finished merge commit instead.
    lines.push("VERDICT: join precondition satisfied — clear to proceed.");
  } else {
    lines.push(
      "VERDICT: join precondition NOT satisfied — resolve the issue(s) above before proceeding.",
    );
  }

  return lines.join("\n");
}
