// Coded by @sr-engineer
// Scope-decision gate predicate: when the design mode is not no-design, entering
// build from pm:In_Progress needs a recorded scope decision, either
// .current/feature-split.md (a multi-feature split) or scope_decision ===
// "single-feature" on the previous handoff state. Existence and equality only:
// never parses the file, never throws. Spec: specs/server-scope-decision-gate.md.

import * as fs from "fs";
import * as path from "path";

export function hasScopeDecision(
  workspacePath: string,
  handoffState: { scope_decision?: string } | null | undefined,
): boolean {
  const splitPath = path.join(workspacePath, ".current", "feature-split.md");
  if (fs.existsSync(splitPath)) return true;
  return handoffState?.scope_decision === "single-feature";
}
