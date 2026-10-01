#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic in tools/merge-invariants.ts): checks that a merge
// commit dropped no task rows, done-marks or sidecar lines (E126). Run after a
// `git merge --no-ff` (integrator SOP); it fires no gate. Specs:
// specs/e126-merge-invariants.md; see also specs/e260c-bin-scripts.md.
// Usage: node scripts/merge-invariants.mjs [<merge-ref> | --ref <merge-ref>] [<absolute-repo-root>]
// Exit:  0 PASS, 1 FAIL, 2 NOT_A_MERGE_COMMIT, 3 NO_MERGE_BASE, 4 USAGE_ERROR

import { runMergeInvariantsCli } from "../dist/tools/merge-invariants.js";

const result = runMergeInvariantsCli(process.argv.slice(2), process.cwd());
if (result.code === "PASS" || result.code === "FAIL") console.log(result.report);
else console.error(result.report);
process.exit(result.exitCode);
