#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic in tools/conductor.ts): opens, closes and wakes the integrator session of each wave of a fan-out manifest for the conductor prompt.
// Usage: node scripts/conductor.mjs state | open (--record <record> | --manifest <manifest> --wave <n>) | close | wake | wave-done | check
// Exit: 0 = done, 1 = a fact unmet / integrator gone / refused (stderr), 2 = usage.
import { runConductorCli, createConductorHostDeps } from "../dist/tools/conductor.js";
process.exitCode = await runConductorCli(process.argv.slice(2), createConductorHostDeps(), process.cwd());
