// Coded by @qa-engineer
// Standalone script that calls readHandoffState on the built dist/, the real wired
// migration trigger. Run as a child process so its module graph and session state
// are independent of the test process.
// argv: <workspacePath>; stdout: the readHandoffState JSON, verbatim.

import { readHandoffState } from "../dist/tools/handoff-parse.js";

const [, , workspacePath] = process.argv;
const json = readHandoffState(workspacePath);
process.stdout.write(json);
