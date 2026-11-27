#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic in tools/lane-launch.ts): starts the batch lanes of
// the current wave of a fan-out manifest in iTerm2 windows. Usage / exit codes below.
// Usage: node scripts/lane-launch.mjs <manifest>
// Exit: 0 = no lane of the current wave is running, 1 = refused (stderr) or an
// unexpected error, 2 = usage.
import { runLaneLaunchCli, createHostDeps } from "../dist/tools/lane-launch.js";

try {
  process.exitCode = await runLaneLaunchCli(process.argv.slice(2), createHostDeps());
} catch (e) {
  const line = String(e instanceof Error ? e.message : e).trim().split("\n")[0];
  process.stderr.write(`lane-launch: error — ${line}\n`);
  process.exitCode = 1;
}
