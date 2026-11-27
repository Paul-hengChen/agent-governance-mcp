#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic in tools/lane-launch.ts): starts the batch lanes of
// the current wave of a fan-out manifest in iTerm2 windows. Usage / exit codes below.
// Usage: node scripts/lane-launch.mjs <manifest>
// Exit: 0 = no lane of the current wave is running, 1 = refused (stderr), 2 = usage.
import { runLaneLaunchCli, createHostDeps } from "../dist/tools/lane-launch.js";
process.exitCode = await runLaneLaunchCli(process.argv.slice(2), createHostDeps());
