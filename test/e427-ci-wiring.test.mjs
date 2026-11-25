// Coded by @qa-engineer
// Test (T-E427-01) for specs/e427-ci-scenario-tests.md AC14: the CI wiring. The check is only independent of the
// agents if CI itself produces the result file and runs the checker on it. Node reads --test-reporter options only
// when they come before the file arguments (D1), so the Test step's run line is pinned token by token; the job name
// and matrix are pinned because the required checks `test (20)` / `test (22)` are named from them (D2).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CI = yaml.load(fs.readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const norm = (s) => String(s ?? "").trim().split(/\s+/).join(" ");

/** The steps that existed before E427, frozen here: E427 must leave each of them as it was. */
const UNCHANGED_BEFORE_TEST = [
  { uses: "actions/checkout@v4", with: { "fetch-depth": 0 } },
  {
    name: "Use Node.js ${{ matrix.node-version }}",
    uses: "actions/setup-node@v4",
    with: { "node-version": "${{ matrix.node-version }}", cache: "npm" },
  },
  { name: "Install dependencies", run: "npm ci" },
  { name: "Build", run: "npm run build" },
];

test("AC14 ci.yml keeps job test on [20, 22], runs Test with reporters before the package.json glob, then the Check ticket scenario tests step", () => {
  // WHY: job key and matrix name the required checks; the reporter order pairs tap with stdout and the adapter with
  // the results file; the glob must stay the one `npm test` runs, or CI would check a different suite than local.
  const job = CI?.jobs?.test;
  assert.ok(job, "job key `test` is present");
  assert.deepEqual(job.strategy?.matrix?.["node-version"], [20, 22]);

  const steps = job.steps;
  const i = steps.findIndex((s) => s.name === "Test");
  assert.ok(i >= 0, "a step named Test exists");

  const scriptTokens = norm(PKG.scripts.test).split(" ");
  const globs = scriptTokens.filter((t) => t.includes("*"));
  assert.equal(globs.length, 1, `package.json test script has one glob: ${PKG.scripts.test}`);
  const glob = globs[0];

  const expectedRun = [
    "node scripts/test-lock.mjs -- node --test",
    "--test-reporter=tap --test-reporter-destination=stdout",
    '--test-reporter=./scripts/scenario-results-node.mjs --test-reporter-destination="$RUNNER_TEMP/test-results.xml"',
    glob,
  ].join(" ");
  assert.equal(norm(steps[i].run), expectedRun);

  const next = steps[i + 1];
  assert.ok(next, "a step follows Test");
  assert.equal(next.name, "Check ticket scenario tests");
  assert.equal(norm(next.if), "${{ !cancelled() }}");
  assert.equal(norm(next.run), 'node scripts/check-scenario-tests.mjs --results "$RUNNER_TEMP/test-results.xml"');

  // No other step changed: the steps before Test are the frozen pre-E427 ones, and nothing follows the new step.
  assert.deepEqual(steps.slice(0, i), UNCHANGED_BEFORE_TEST);
  assert.equal(steps.length, i + 2, "the new step is the last step");
  assert.deepEqual(Object.keys(steps[i]).sort(), ["name", "run"]);
});
