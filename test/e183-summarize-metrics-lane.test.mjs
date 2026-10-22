// Coded by @qa-engineer
// Tests (T-E183-02) for scripts/summarize-metrics.mjs default-path resolution and loud failure
// (specs/e209-test-infra-fixes.md, AC-E183-1..6). Fixtures are temp workspaces whose HEAD the
// lane resolver reads by pure fs (no git subprocess); the script is spawned with cwd = the
// fixture. The re-pin of E8-S4 (explicit missing path) lives in test/success-metrics.test.mjs.
// WHY loud: after the E123 lane flip live writers append to .current/<lane>/metrics.jsonl, so a
// bare run used to print "no metrics yet" and exit 0, a silent zero in the E6 retro.
// E183_SCRIPT_UNDER_TEST (a file path) lets qa run these cases against a temp copy of the base
// script to record the red run; it is not used by the suite.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = process.env.E183_SCRIPT_UNDER_TEST || path.join(ROOT, "scripts", "summarize-metrics.mjs");

const RECORD = JSON.stringify({ feature: "feat-x", tickets: 2, qa_rounds: 1, review_rounds: 1, visual_rounds: 0, hops: 5, one_pass: true });

function mkWs(headContent) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e183-ws-"));
  fs.mkdirSync(path.join(ws, ".git"));
  fs.writeFileSync(path.join(ws, ".git", "HEAD"), headContent);
  return ws;
}

function put(ws, rel, content = RECORD + "\n") {
  const file = path.join(ws, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function run(cwd, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf-8" });
}

test("AC-E183-1: a lane branch with records in .current/<lane>/metrics.jsonl is summarized with no argument", () => {
  const ws = mkWs("ref: refs/heads/feat/e999-x\n");
  put(ws, ".current/e999/metrics.jsonl");
  const r = run(ws);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /features: 1/);
});

test("AC-E183-1: the same holds in a linked worktree whose .git is a gitfile (gitdir: ...)", () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e183-wt-"));
  const gitdir = path.join(ws, "..", `${path.basename(ws)}-gitdir`);
  fs.mkdirSync(gitdir, { recursive: true });
  fs.writeFileSync(path.join(gitdir, "HEAD"), "ref: refs/heads/feat/e999-x\n");
  fs.writeFileSync(path.join(ws, ".git"), `gitdir: ../${path.basename(gitdir)}\n`);
  put(ws, ".current/e999/metrics.jsonl");
  const r = run(ws);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /features: 1/);
});

for (const [label, head] of [
  ["main", "ref: refs/heads/main\n"],
  ["integ/<x>", "ref: refs/heads/integ/w10\n"],
  ["detached HEAD", "0123456789abcdef0123456789abcdef01234567\n"],
]) {
  test(`AC-E183-2: ${label} resolves to .current/_primary/metrics.jsonl`, () => {
    const ws = mkWs(head);
    put(ws, ".current/_primary/metrics.jsonl");
    const r = run(ws);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /features: 1/);
  });
}

test("AC-E183-3: lane file absent + legacy flat file present -> summarizes the flat file with a stderr note naming both paths", () => {
  const ws = mkWs("ref: refs/heads/feat/e999-x\n");
  put(ws, ".current/metrics.jsonl");
  const r = run(ws);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /features: 1/);
  assert.match(r.stderr, /legacy flat/);
  assert.ok(r.stderr.includes(path.join(".current", "e999", "metrics.jsonl")), `lane path tried: ${r.stderr}`);
  assert.ok(r.stderr.includes(path.join(".current", "metrics.jsonl")), `flat path read: ${r.stderr}`);
});

test("AC-E183-4: neither lane nor flat file -> exit 1, stderr names both paths and the escape hatches, stdout has no summary", () => {
  const ws = mkWs("ref: refs/heads/feat/e999-x\n");
  const r = run(ws);
  assert.equal(r.status, 1, `must fail loudly; stdout: ${r.stdout}`);
  assert.match(r.stderr, /^summarize-metrics:/);
  assert.match(r.stderr, /no metrics file/);
  assert.ok(r.stderr.includes(path.join(".current", "e999", "metrics.jsonl")));
  assert.ok(r.stderr.includes(path.join(".current", "metrics.jsonl")));
  assert.match(r.stderr, /tw_gate_stats/);
  assert.doesNotMatch(r.stdout, /no metrics yet|aggregate/);
});

test("AC-E183-5: an explicit missing path -> exit 1, stderr names it, no lane resolution even when a lane file exists", () => {
  const ws = mkWs("ref: refs/heads/feat/e999-x\n");
  put(ws, ".current/e999/metrics.jsonl");
  const r = run(ws, "nope.jsonl");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no metrics file/);
  assert.ok(r.stderr.includes("nope.jsonl"));
  assert.doesNotMatch(r.stdout, /aggregate|features:/, "the lane file must not be read when a path is given");
});

test("AC-E183-5: an explicit unreadable path (a directory) -> exit 1, stderr has 'cannot read', the path and the error code", () => {
  const ws = mkWs("ref: refs/heads/main\n");
  const dir = path.join(ws, "adir");
  fs.mkdirSync(dir);
  const r = run(ws, dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /cannot read/);
  assert.ok(r.stderr.includes(dir));
  assert.match(r.stderr, /EISDIR/);
});

test("AC-E183-5: an unreadable lane path exits 1 even when a legacy flat file exists (no silent fallback)", () => {
  // WHY: falling back to an older flat file would reintroduce the silent wrong answer.
  const ws = mkWs("ref: refs/heads/feat/e999-x\n");
  fs.mkdirSync(path.join(ws, ".current", "e999", "metrics.jsonl"), { recursive: true });
  put(ws, ".current/metrics.jsonl");
  const r = run(ws);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /cannot read/);
  assert.ok(r.stderr.includes(path.join(".current", "e999", "metrics.jsonl")));
  assert.doesNotMatch(r.stdout, /aggregate|features:/);
});

test("AC-E183-6: an existing empty lane file still exits 0 with 'no metrics yet'", () => {
  const ws = mkWs("ref: refs/heads/feat/e999-x\n");
  put(ws, ".current/e999/metrics.jsonl", "");
  const r = run(ws);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no metrics yet/);
});
