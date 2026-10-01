#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic in tools/fanout-manifest.ts) that validates and
// renders a multi-lane feature split (E177a); see specs/e260c-bin-scripts.md.
// Exit codes: 0 = ok / in bounds, 1 = out of bounds (check only), 2 = usage or any parse/input error.
// Usage: node scripts/fanout.mjs validate <manifest>
//        node scripts/fanout.mjs render <manifest> <lane> --summary <text> --reading <text>... [--mailbox-root <dir>] [--primary <path>] [--base <sha>]
//        node scripts/fanout.mjs check <manifest> <lane> [--base main] [--repo <dir>]

import { runValidate, runRender, runCheck, usageResult } from "../dist/tools/fanout-manifest.js";

const [sub, ...rest] = process.argv.slice(2);
const routes = { validate: runValidate, render: runRender, check: runCheck };

const result = Object.hasOwn(routes, sub) ? routes[sub](rest) : usageResult();

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
