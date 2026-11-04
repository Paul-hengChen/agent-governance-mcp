// Coded by @qa-engineer
// T-E405-08: structure tests for .github/workflows/release.yml (specs/e405-release-cd.md AC-W1..W10;
// specs/e405-release-cd-architecture.md *Workflow* and *Test seams*).
//
// WHY: the workflow is the only piece of the release that runs without an agent watching it, and it is
// never run for real in this lane. Its safety properties (dispatch-only, main-only, one token for every
// push, the job token only for the issue, no input interpolated into a shell, dry run mutates nothing,
// waits inside the job timeout) are structural, so a YAML parse is the proof. No test here calls GitHub.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(REPO, ".github", "workflows", "release.yml"), "utf-8");
const WF = yaml.load(RAW);
const JOB = WF.jobs.release;
const STEPS = JOB.steps;
const SCRIPT_RE = /node scripts\/release\.mjs/;
const scriptSteps = () => STEPS.filter((s) => SCRIPT_RE.test(s.run ?? ""));
const byId = (id) => STEPS.find((s) => s.id === id);
const phaseOf = (s) => /release\.mjs (\S+)/.exec(s.run)[1];
const TOKEN = "${{ secrets.RELEASE_TOKEN }}";
const idx = (s) => STEPS.indexOf(s);

test("AC-W1 dispatch-only trigger with exactly bump, tickets, dry_run", () => {
  // WHY: ruling 4 fixes the inputs; no schedule / push / pull_request trigger may start a release. The name must
  // differ from `CI`, the workflow name verify-release.mjs --ci-check queries (AC-W10).
  assert.equal(WF.name, "Release");
  assert.notEqual(WF.name, "CI");
  assert.deepEqual(Object.keys(WF.on), ["workflow_dispatch"], "workflow_dispatch is the only trigger");
  const inputs = WF.on.workflow_dispatch.inputs;
  assert.deepEqual(Object.keys(inputs).sort(), ["bump", "dry_run", "tickets"], "no other input");
  assert.equal(inputs.bump.type, "choice");
  assert.deepEqual(inputs.bump.options, ["patch", "minor", "major"], "option order");
  assert.equal(inputs.bump.default, "patch");
  assert.equal(inputs.bump.required, true);
  assert.equal(inputs.tickets.type, "string");
  assert.equal(inputs.tickets.required, true);
  assert.ok(!("default" in inputs.tickets), "tickets has no default");
  assert.equal(inputs.dry_run.type, "boolean");
  assert.equal(inputs.dry_run.default, true, "a run that ships needs a deliberate untick");
});

test("AC-W2 main-only guard and a single release concurrency group", () => {
  assert.deepEqual(WF.concurrency, { group: "release", "cancel-in-progress": false });
  assert.deepEqual(Object.keys(WF.jobs), ["release"], "one job");
  const guard = STEPS.find((s) => s.name === "Require main");
  assert.ok(guard, "a ref guard step exists");
  assert.match(guard.run, /refs\/heads\/main/);
  assert.match(guard.run, /exit 1/);
  assert.equal(guard.env.REF, "${{ github.ref }}", "the ref reaches the shell through env");
  const first = Math.min(...scriptSteps().map(idx));
  assert.ok(idx(guard) < first, "the guard runs before the first release step");
  assert.ok(idx(guard) < idx(STEPS.find((s) => /^actions\/checkout@/.test(s.uses ?? ""))), "the guard runs before checkout");
});

test("AC-W3 checkout with full history and the release token, Node 22, npm ci then build before the script", () => {
  assert.equal(JOB["runs-on"], "ubuntu-latest");
  const co = STEPS.find((s) => s.uses === "actions/checkout@v4");
  assert.ok(co, "actions/checkout@v4");
  assert.equal(co.with["fetch-depth"], 0, "the previous tag must resolve");
  assert.equal(co.with.token, TOKEN);
  const node = STEPS.find((s) => s.uses === "actions/setup-node@v4");
  assert.ok(node, "actions/setup-node@v4");
  assert.equal(String(node.with["node-version"]), "22");
  const ci = STEPS.find((s) => s.run === "npm ci"), build = STEPS.find((s) => s.run === "npm run build");
  assert.ok(ci && build);
  const first = Math.min(...scriptSteps().map(idx));
  assert.ok(idx(co) < idx(node) && idx(node) < idx(ci) && idx(ci) < idx(build) && idx(build) < first,
    "checkout, Node, npm ci, build, then the first release.mjs step (the script imports dist/tools/*.js)");
});

test("AC-W4 every push, pull request and tag path uses RELEASE_TOKEN; GITHUB_TOKEN only files the issue", () => {
  // WHY (F4): pushes and PRs made with the job token start no workflow, so the required checks never run.
  assert.deepEqual(WF.permissions, { contents: "read", issues: "write" });
  const scripts = scriptSteps();
  assert.equal(scripts.length, 6, "start-dry-run, start, prepare, publish, record, close-out");
  for (const s of scripts) assert.equal(s.env?.GH_TOKEN, TOKEN, `${s.id} carries GH_TOKEN`);
  const withToken = STEPS.filter((s) => s.env && "GH_TOKEN" in s.env);
  assert.deepEqual(withToken.filter((s) => !SCRIPT_RE.test(s.run ?? "")).map((s) => s.name), ["File failure issue"], "GH_TOKEN appears nowhere else");
  assert.deepEqual([...new Set([...RAW.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))], ["RELEASE_TOKEN"], "RELEASE_TOKEN is the only secret");
  assert.ok(!/secrets\.GITHUB_TOKEN/.test(RAW), "secrets.GITHUB_TOKEN appears nowhere");
  const issue = STEPS.find((s) => s.name === "File failure issue");
  assert.equal(issue.env.GH_TOKEN, "${{ github.token }}");
  const others = STEPS.filter((s) => s !== issue);
  assert.ok(!others.some((s) => JSON.stringify(s).includes("github.token")), "github.token only in the issue step");
  assert.ok(!/github\.token/.test(JSON.stringify({ ...WF, jobs: { release: { ...JOB, steps: others } } })), "github.token nowhere else in the file");
});

test("AC-W5 phase order and state continuity across the run", () => {
  assert.deepEqual(scriptSteps().map((s) => s.id), ["start-dry-run", "start", "prepare", "publish", "record", "close-out"]);
  assert.deepEqual(scriptSteps().map(phaseOf), ["start", "start", "prepare", "publish", "record", "close-out"]);
  assert.ok(idx(byId("publish")) < idx(byId("record")) && idx(byId("record")) < idx(byId("close-out")), "the closing write sits between publish and close-out");
  // One job, one checkout: the opening write, the closing write and close-out share .current/_primary/.
  assert.equal(Object.keys(WF.jobs).length, 1);
  assert.equal(STEPS.filter((s) => /^actions\/checkout@/.test(s.uses ?? "")).length, 1, "a single checkout");
  assert.match(byId("prepare").run, /--state "\$RELEASE_DIR\/state\.md"/);
  assert.match(byId("prepare").run, /--message-file "\$RELEASE_DIR\/message\.txt"/);
  assert.match(byId("start").run, /version=\$\(cat "\$RELEASE_DIR\/version"\)" >> "\$GITHUB_OUTPUT"/);
  for (const id of ["prepare", "publish", "record", "close-out"]) assert.equal(byId(id).env.VERSION, "${{ steps.start.outputs.version }}", `${id} reads the version start produced`);
});

test("AC-W6 dry_run puts --dry-run on every script call and nothing else mutates", () => {
  const dry = byId("start-dry-run");
  assert.equal(dry.if, "${{ inputs.dry_run }}");
  assert.match(dry.run.trim(), /--dry-run$/, "the dry-run step's command ends with --dry-run");
  for (const s of scriptSteps().filter((x) => x !== dry)) {
    assert.equal(s.if, "${{ !inputs.dry_run }}", `${s.id} is skipped on a dry run`);
    assert.ok(!/--dry-run/.test(s.run), `${s.id}: no --dry-run on a real-run step`);
  }
  // What runs when dry_run is true: every step without an `if`, plus the dry-run step; none mutates.
  const runsOnDry = STEPS.filter((s) => s.if === undefined || s === dry);
  for (const s of runsOnDry) {
    assert.ok(!/git (push|tag|commit)|gh (pr|release|issue)|tw_/.test(s.run ?? ""), `${s.name ?? s.uses}: no push, tag, PR, release, issue or state write outside the script`);
    if (SCRIPT_RE.test(s.run ?? "")) assert.match(s.run, /--dry-run/);
  }
  const outside = STEPS.filter((s) => !SCRIPT_RE.test(s.run ?? ""));
  assert.ok(!outside.some((s) => /git (push|tag)|gh (pr|release)|tw_/.test(s.run ?? "")), "no step outside the script pushes, tags, opens a PR or writes state");
});

test("AC-W7 inputs reach run blocks only through env", () => {
  for (const s of STEPS) {
    if (s.run === undefined) continue;
    assert.ok(!s.run.includes("${{"), `${s.name ?? s.id}: no expression inside a run block`);
  }
  for (const s of scriptSteps()) {
    for (const key of Object.keys(s.env)) assert.ok(!/inputs\./.test(String(s.env[key])) || ["BUMP", "TICKETS"].includes(key), `${s.id}.${key}`);
    assert.ok(/"\$BUMP"|"\$TICKETS"|"\$VERSION"/.test(s.run), `${s.id} uses a quoted env var`);
  }
  assert.equal(byId("start").env.BUMP, "${{ inputs.bump }}");
  assert.equal(byId("start").env.TICKETS, "${{ inputs.tickets }}");
});

test("AC-W8 one failure-only issue step with the stop line, run link and inputs", () => {
  const issues = STEPS.filter((s) => /gh issue create/.test(s.run ?? ""));
  assert.equal(issues.length, 1, "exactly one step files an issue");
  const s = issues[0];
  assert.equal(s.name, "File failure issue");
  assert.equal(s.if, "${{ failure() && !inputs.dry_run }}", "failure-only, and a dry run files none");
  assert.equal(s.env.GH_TOKEN, "${{ github.token }}");
  assert.ok(!/--label/.test(s.run), "no --label");
  assert.match(s.run, /--title "Release failed: \$class"/);
  assert.equal(s.env.RUN_URL, "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}", "the link is built from context, no literal URL");
  assert.match(s.run, /class=NO_STOP_LINE/);
  assert.match(s.run, /No RELEASE_STOP line was printed; read the run log\./);
  // The body's first three lines, in order, as printf format + args.
  assert.match(s.run, /printf '%s\\nRun: %s\\nInputs: bump=%s tickets=%s dry_run=%s\\nPhase: %s\\n' "\$stop" "\$RUN_URL" "\$BUMP" "\$TICKETS" "\$DRY_RUN" "\$PHASE"/);
  assert.match(s.run, /tail -n 1 "\$AGC_RELEASE_STOP_FILE"/, "the stop line is read from the stop-line file");
  assert.equal(s.env.BUMP, "${{ inputs.bump }}");
  assert.equal(s.env.TICKETS, "${{ inputs.tickets }}");
  assert.equal(s.env.DRY_RUN, "${{ inputs.dry_run }}");
  assert.ok(idx(s) === STEPS.length - 1, "the issue step runs last");
  assert.ok(!STEPS.some((x) => x !== s && /gh issue/.test(x.run ?? "")), "no step files an issue on success");
});

test("AC-W8 the issue step's shell yields the byte-for-byte stop line, its class, or the no-stop-line text", () => {
  // Executes the step's own run block with a fake `gh` that records its argv and body file (no network).
  const issue = STEPS.find((s) => s.name === "File failure issue");
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "e405-wf-"));
  try {
    const bin = path.join(tmp, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nprintf '%s\\n' "$@" > "${tmp}/gh-args.txt"\n`, { mode: 0o755 });
    const run = (stopText) => {
      const stopFile = path.join(tmp, "stop-line.txt");
      fs.rmSync(stopFile, { force: true });
      if (stopText !== null) fs.writeFileSync(stopFile, stopText);
      const r = spawnSync("bash", ["-c", issue.run], {
        encoding: "utf-8", cwd: tmp,
        env: { PATH: `${bin}${path.delimiter}${process.env.PATH}`, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: "o/r", AGC_RELEASE_STOP_FILE: stopFile,
          RUN_URL: "RUNLINK", BUMP: "minor", TICKETS: "E1,E2", DRY_RUN: "false", PHASE: "publish" },
      });
      assert.equal(r.status, 0, r.stderr);
      const args = fs.readFileSync(path.join(tmp, "gh-args.txt"), "utf-8").split("\n");
      return { title: args[args.indexOf("--title") + 1], body: fs.readFileSync(path.join(tmp, "release-issue.md"), "utf-8").split("\n") };
    };
    const line = "RELEASE_STOP TEST_FAILED: npm test exited 1 — # fail 2; not ok 3 - x";
    const a = run(`${line}\n`);
    assert.equal(a.title, "Release failed: TEST_FAILED");
    assert.deepEqual(a.body.slice(0, 4), [line, "Run: RUNLINK", "Inputs: bump=minor tickets=E1,E2 dry_run=false", "Phase: publish"]);
    const none = run(null);
    assert.equal(none.title, "Release failed: NO_STOP_LINE");
    assert.equal(none.body[0], "No RELEASE_STOP line was printed; read the run log.");
    const junk = run("not a stop line\n");
    assert.equal(junk.title, "Release failed: NO_STOP_LINE", "a file that is not a stop line is not trusted");
    const hostile = run("RELEASE_STOP bad id; rm -rf: x\n");
    assert.equal(hostile.title, "Release failed: NO_STOP_LINE", "a class id outside [A-Z_] is not put in the title");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("AC-W9 explicit wait budgets inside the job timeout", () => {
  assert.equal(JOB["timeout-minutes"], 120);
  const env = JOB.env;
  const ci = Number(env.AGC_VERIFY_CI_WAIT_SECONDS), merge = Number(env.AGC_RELEASE_MERGE_WAIT_SECONDS);
  assert.equal(env.AGC_VERIFY_CI_WAIT_SECONDS, "900");
  assert.equal(env.AGC_RELEASE_MERGE_WAIT_SECONDS, "900");
  assert.ok(Number(env.AGC_RELEASE_POLL_SECONDS) > 0);
  // Worst case: pre-flight, strict gate, self-check CI waits (3 x CI) plus two merge waits.
  assert.ok(JOB["timeout-minutes"] * 60 > 3 * ci + 2 * merge, "the job timeout exceeds the waits the job can incur");
  for (const k of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"]) assert.ok(env[k], `${k} is set for git commit / tag`);
  assert.ok(!scriptSteps().some((s) => s.env && ("AGC_VERIFY_CI_WAIT_SECONDS" in s.env)), "the budgets live in the job env, once");
});

test("AC-W10 the CI workflow is not this workflow and is untouched by name", () => {
  // The diff check (git diff --stat <merge-base> -- .github/workflows/ci.yml prints nothing) is a QA proof run, not a unit test:
  // a unit test must not depend on a base sha. Here: ci.yml still parses, is named CI, and release.yml is a different file.
  const ci = yaml.load(fs.readFileSync(path.join(REPO, ".github", "workflows", "ci.yml"), "utf-8"));
  assert.equal(ci.name, "CI");
  assert.notEqual(ci.name, WF.name);
});

test("AC-W3 step names and order are the architecture's", () => {
  assert.deepEqual(STEPS.map((s) => s.name ?? s.uses ?? s.id), [
    "Require main", "Work directory", "actions/checkout@v4", "Use Node.js 22", "Install dependencies", "Build",
    "Start (dry run)", "Start", "Prepare", "Publish", "Record", "Close out", "File failure issue",
  ]);
});

test("AC-R12 every flag the workflow passes exists in release.mjs --help", () => {
  // WHY: a workflow that passes a flag the script does not know fails only on the first real run.
  const help = spawnSync(process.execPath, [path.join(REPO, "scripts", "release.mjs"), "--help"], { encoding: "utf-8" });
  assert.equal(help.status, 0);
  for (const s of scriptSteps()) {
    const phase = phaseOf(s);
    const usageLine = help.stdout.split("\n").find((l) => l.includes(`release.mjs ${phase} `));
    assert.ok(usageLine, `--help documents the ${phase} phase`);
    for (const flag of s.run.match(/--[a-z-]+/g)) {
      if (flag === "--dry-run") assert.ok(usageLine.includes("[--dry-run]"));
      else assert.ok(usageLine.includes(flag), `${s.id}: ${flag} is in the ${phase} usage line`);
    }
  }
});

test("AC-H5 no token value, personal path or literal URL in the workflow", () => {
  assert.ok(!/github_pa[t]_|gh[pousr]_[A-Za-z0-9]{36}|\/User[s]\/|\/hom[e]\/|https?:\/[/]/.test(RAW));
});
