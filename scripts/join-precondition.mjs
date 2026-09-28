#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper for the E115 join precondition check. All logic lives in
// tools/join-precondition.ts (compiled to dist/tools/join-precondition.js) —
// this script only wires argv to it and prints the result, mirroring the
// existing scripts/feature-rollup.mjs pattern (plain Node ESM importing from
// dist/tools/*.js, zero script-level logic of its own).
//
// This is the manual entry point a join ticket's build-entry step runs
// deliberately before starting work (spec: specs/e115-join-precondition-check.md)
// — it fires no gate and is not wired into UPDATE_STATE_GATE_PIPELINE.
//
// Usage: node scripts/join-precondition.mjs <depends_on-branch...> [repo-root]
//        (repo-root defaults to the current working directory; when given,
//        it must be the LAST argument and an absolute path)

import {
  checkLaneAncestry,
  checkDeclaredVsActualLaneIdentity,
  renderJoinPreconditionReport,
} from "../dist/tools/join-precondition.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/join-precondition.mjs <depends_on-branch...> [repo-root]");
  process.exit(1);
}

const lastArg = args[args.length - 1];
const hasRepoRoot = lastArg.startsWith("/");
const branches = hasRepoRoot ? args.slice(0, -1) : args;
const repoRoot = hasRepoRoot ? lastArg : process.cwd();

const ancestry = checkLaneAncestry(branches, repoRoot);
const identity = checkDeclaredVsActualLaneIdentity(repoRoot);
console.log(renderJoinPreconditionReport(ancestry, identity));
