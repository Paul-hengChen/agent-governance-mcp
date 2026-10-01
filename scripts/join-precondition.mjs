#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper for the join precondition check: a join ticket may start
// only once the lane branches it depends on are merged into HEAD (E115); all
// logic is in tools/join-precondition.ts. Run by hand at a join ticket's build
// entry; it fires no gate (spec: specs/e115-join-precondition-check.md).
// Usage: node scripts/join-precondition.mjs <depends_on-branch...> [repo-root]
//        (repo-root defaults to cwd; when given, it must be the LAST argument and absolute)

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
