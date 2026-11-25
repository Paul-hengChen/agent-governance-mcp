// Coded by @qa-engineer
// Test (T-E427-01) for specs/e427-ci-scenario-tests.md AC10: scripts/scenario-results-node.mjs is the runner adapter.
// Node's own JUnit reporter records no test file, so a ticket's `test <file> — <title>` could not be matched; the
// adapter's reporter fills in the file, and its readResults() turns the XML back into { file, title, status } entries
// with full ` > `-joined titles. This runs the real `node --test` with the CI reporter options (D1) on a fixture file,
// so it exercises whichever Node version CI's matrix provides (20 and 22).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADAPTER_PATH = path.join(ROOT, "scripts", "scenario-results-node.mjs");
const FIXTURE = "test/fixtures/e427/adapter-e2e.mjs";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "e427-adapter-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test("AC10 the adapter reporter writes JUnit with the repo-relative file, and readResults returns full nested titles and D5 statuses", async () => {
  // WHY: this is the one place the runner's own result is turned into what the checker matches; a wrong file,
  // a leaf-only title or a skipped test read as passed would let a done ticket pass on a test that did not pass.
  const xml = path.join(TMP, "r.xml");
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const node = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-reporter=tap",
      "--test-reporter-destination=stdout",
      "--test-reporter=./scripts/scenario-results-node.mjs",
      `--test-reporter-destination=${xml}`,
      FIXTURE,
    ],
    { cwd: ROOT, encoding: "utf8", env },
  );
  // The human-readable CI log keeps its TAP format (D1).
  assert.match(node.stdout, /^TAP version 13\n/, node.stdout + node.stderr);
  assert.ok(fs.existsSync(xml), `the adapter reporter wrote ${xml}\n${node.stderr}`);

  const { readResults } = await import(pathToFileURL(ADAPTER_PATH).href);
  assert.equal(typeof readResults, "function", "readResults is a named export");
  const entries = (await readResults(xml)).map((e) => ({ file: e.file, title: e.title, status: e.status }));
  const key = (e) => `${e.title}\u0000${e.file}\u0000${e.status}`;
  const expected = [
    { file: FIXTURE, title: "outer", status: "passed" },
    { file: FIXTURE, title: "outer > inner", status: "passed" },
    { file: FIXTURE, title: "outer > inner > leaf", status: "passed" },
    { file: FIXTURE, title: "skipped one", status: "skipped" },
    { file: FIXTURE, title: "todo one", status: "skipped" },
    { file: FIXTURE, title: "failing one", status: "failed" },
    { file: FIXTURE, title: "parent", status: "passed" },
    { file: FIXTURE, title: "parent > child", status: "passed" },
  ];
  assert.deepEqual(entries.map(key).sort(), expected.map(key).sort());
});
