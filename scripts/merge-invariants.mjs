#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper for the E126 merge-invariants check. All logic — argv
// parsing included — lives in tools/merge-invariants.ts (compiled to
// dist/tools/merge-invariants.js); this script only wires argv to it, prints
// the report, and exits with its code, mirroring scripts/join-precondition.mjs
// (plain Node ESM importing from dist/tools/*.js, zero script-level logic).
//
// Spec: specs/e126-merge-invariants.md. Run after a `git merge --no-ff`
// (integrator SOP) — it fires no gate and is not wired into any pipeline.
//
// Usage: node scripts/merge-invariants.mjs [<merge-ref> | --ref <merge-ref>] [<absolute-repo-root>]
// Exit:  0 PASS, 1 FAIL, 2 NOT_A_MERGE_COMMIT, 3 NO_MERGE_BASE, 4 USAGE_ERROR

import { runMergeInvariantsCli } from "../dist/tools/merge-invariants.js";

const result = runMergeInvariantsCli(process.argv.slice(2), process.cwd());
if (result.code === "PASS" || result.code === "FAIL") console.log(result.report);
else console.error(result.report);
process.exit(result.exitCode);
