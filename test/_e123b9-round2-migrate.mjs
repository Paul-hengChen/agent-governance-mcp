// Coded by @qa-engineer
// Standalone node script for AC8 Round 2 (T-E123B9-05 (c)) — spec's own
// wording: "from a standalone node script, import the built
// dist/tools/handoff-parse.js and call readHandoffState(scratchWorkspacePath)
// (the actual own-workspace entry point AC3 wires the migration into)".
// Run as a child process (never imported) so its module graph and
// guards/session.ts in-memory state are fully independent of the calling
// test process — this is the WIRED trigger, exercised exactly as a real
// tw_get_state call would exercise it.
//
// argv: <workspacePath>
// stdout: the readHandoffState(workspacePath) JSON string, verbatim.

import { readHandoffState } from "../dist/tools/handoff-parse.js";

const [, , workspacePath] = process.argv;
const json = readHandoffState(workspacePath);
process.stdout.write(json);
