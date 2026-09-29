#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper for the per-lane status table + feature roll-up (E177b,
// T-E177B-05, spec AC1-6) and the `--watch` lane event stream (E178b,
// T-E178B-01, spec AC1-AC9).
// All logic — argv parsing included — lives in tools/lane-status.ts
// (compiled to dist/tools/lane-status.js); this script only routes argv to
// it and prints the result, mirroring scripts/feature-rollup.mjs (zero
// script-level logic of its own). `--watch` goes to the async streaming
// runner, awaited so the process stays alive until it resolves; every other
// invocation goes to the sync one-shot runner.
//
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
