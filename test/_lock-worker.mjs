// Coded by @sr-engineer
// Test helper: child-process worker that grabs withFileLock, appends a uniquely
// tagged line under the lock, and exits. Used by the cross-process lock test.
//
// argv: <lockPath> <outputPath> <tag> [holdMs]

import * as fs from "node:fs";
import { withFileLock } from "../dist/guards/file-lock.js";

const [, , lockPath, outputPath, tag, holdMsRaw] = process.argv;
const holdMs = Number(holdMsRaw ?? "50");

try {
  await withFileLock(lockPath, async () => {
    fs.appendFileSync(outputPath, `${tag}:start\n`);
    await new Promise((r) => setTimeout(r, holdMs));
    fs.appendFileSync(outputPath, `${tag}:end\n`);
  });
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
