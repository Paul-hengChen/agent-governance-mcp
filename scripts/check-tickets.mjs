#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper, all logic in tools/ticket-file.ts: checks ticket files
// against the format in docs/ticket-format.md.
// Usage: node scripts/check-tickets.mjs [<file-or-directory> ...]
//        (no argument: every ticket file in the configured ticket directory)

import { runCheckTicketsCli } from "../dist/tools/ticket-file.js";

const { output, exitCode, stream } = runCheckTicketsCli(process.argv.slice(2), process.cwd());
if (stream === "stderr") console.error(output);
else console.log(output);
process.exitCode = exitCode;
