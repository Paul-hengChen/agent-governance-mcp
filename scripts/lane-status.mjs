#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic, argv parsing included, in tools/lane-status.ts) for the
// per-lane status table and roll-up (E177b) and the awaited `--watch` stream (E178b).
// Usage: node scripts/lane-status.mjs [--rollup <feature-id> | --lanes a,b,... | --all]
//                                     [--base <ref>] [--repo <path>] [--json] [--mailbox-root <dir>]
//        node scripts/lane-status.mjs --watch [--lanes a,b,...] [--interval <s>] [--deadline <min>]
//                                     [--baseline <lane>=<fp>,...] [--mailbox-root <dir>] [--repo <path>]

import { runLaneStatusCli, runLaneWatch } from "../dist/tools/lane-status.js";

const argv = process.argv.slice(2);
if (argv.includes("--watch")) {
  process.exitCode = await runLaneWatch(argv);
} else {
  const { output, exitCode, stream } = runLaneStatusCli(argv);
  if (stream === "stderr") console.error(output);
  else console.log(output);
  process.exitCode = exitCode;
}
