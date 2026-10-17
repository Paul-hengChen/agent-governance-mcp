#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic in tools/fanout-manifest.ts and, for handoff,
// tools/fanout-handoff.ts) over a multi-lane feature split (E177a); see specs/e260c-bin-scripts.md.
// Exit codes: 0 = ok / in bounds, 1 = out of bounds or a failed manifest-side condition (check, check --cut) or an owned path (owners) or a differing fact (handoff --check), 2 = usage or any parse/input error.
// Usage: node scripts/fanout.mjs validate <manifest>
//        node scripts/fanout.mjs render <manifest> <lane> --summary <text> --reading <text>... [--mailbox-root <dir>] [--primary <path>] [--base <sha>]
//        node scripts/fanout.mjs check <manifest> <lane> [--base main] [--repo <dir>]
//        node scripts/fanout.mjs check --cut <manifest> <lane> <spec>
//        node scripts/fanout.mjs owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)
//        node scripts/fanout.mjs handoff [--check] <manifest> [--target <branch>] [--repo <dir>] [--mailbox-root <dir>] [--closing]

import { runValidate, runRender, runCheck, runOwners, usageResult } from "../dist/tools/fanout-manifest.js";

const [sub, ...rest] = process.argv.slice(2);
const routes = { validate: runValidate, render: runRender, check: runCheck, owners: runOwners };

// handoff is loaded only when used, so the other subcommands keep their import graph.
const result =
  sub === "handoff"
    ? (await import("../dist/tools/fanout-handoff.js")).runHandoff(rest)
    : Object.hasOwn(routes, sub)
      ? routes[sub](rest)
      : usageResult();

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
