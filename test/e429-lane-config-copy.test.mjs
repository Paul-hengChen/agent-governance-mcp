// Coded by @qa-engineer
// E429 (T-E429-03): `agc feature start` copies the primary checkout's .current/.config.json into a
// new lane when git ignores that path there (local artifacts), so opt-in settings such as
// cutApprovalAutoTier do not silently fall back to defaults in the lane. Spec: the E429 row of
// docs/backlog.md (no specs/ file). Every fixture repo is built in os.tmpdir() at runtime.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../dist/tools/config.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");
const COPY_LINE =
  "agc feature start — copied .current/.config.json from the primary checkout " +
  "(a snapshot; later changes there do not reach this lane)";

const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
after(() => {
  for (const d of TMP_DIRS) fs.rmSync(d, { recursive: true, force: true });
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
const writeFile = (abs, content) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const lstatOrNull = (p) => {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
};

// Non-default values on purpose: a lane that fell back to defaults could not match them.
const TIER = { maxFiles: 7, maxPriority: "P1" };
const CONFIG_BYTES = JSON.stringify({ schema_version: 2, cutApprovalAutoTier: TIER }, null, 2) + "\n";

// Primary repo on main. `tracked`: files committed. `exclude`: lines for .git/info/exclude.
// `config`: raw text written to .current/.config.json after the commit (undefined = no file).
function makeRepo({ tracked = {}, exclude = [], config } = {}) {
  const r = mkTmp("e429-primary-");
  git(r, ["init", "-q", "-b", "main"]);
  git(r, ["config", "user.email", "qa@example.com"]);
  git(r, ["config", "user.name", "QA Sentinel"]);
  git(r, ["config", "commit.gpgsign", "false"]);
  writeFile(path.join(r, "README.md"), "x\n");
  for (const [rel, body] of Object.entries(tracked)) writeFile(path.join(r, rel), body);
  git(r, ["add", "-A"]);
  git(r, ["commit", "-qm", "init"]);
  if (exclude.length > 0) {
    fs.appendFileSync(path.join(r, ".git", "info", "exclude"), exclude.join("\n") + "\n");
  }
  if (config !== undefined) writeFile(path.join(r, ".current", ".config.json"), config);
  return r;
}

function start(repo) {
  const lane = path.join(mkTmp("e429-lane-"), "lane");
  const res = spawnSync(process.execPath, [AGC_INIT, "feature", "start", "e9-x", "--path", lane], {
    cwd: repo,
    encoding: "utf-8",
  });
  return { res, lane, laneConfig: path.join(lane, ".current", ".config.json") };
}

const laneStatus = (lane) => git(lane, ["status", "--porcelain"]);

// AC1 — the ticket's target case: local artifacts hide .current/ from git, so without the copy the
// lane has no config at all. The lane must get an identical file, say so, and stay clean.
test("AC1: local artifacts -> lane config byte-identical, copy line printed, lane status clean", () => {
  const repo = makeRepo({ exclude: ["/.current/"], config: CONFIG_BYTES });
  const { res, laneConfig, lane } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(
    fs.readFileSync(laneConfig).equals(fs.readFileSync(path.join(repo, ".current", ".config.json"))),
    "lane config must be byte-identical to primary's"
  );
  assert.ok(res.stdout.split("\n").includes(COPY_LINE), res.stdout);
  assert.equal(laneStatus(lane), "", "an ignored copy must not dirty the lane (finish refuses a dirty one)");
});

// AC2 — tracked artifacts: the checkout already carries the config; primary's uncommitted edit is
// not a snapshot the lane should take, and the checked-out file must never be overwritten.
test("AC2: tracked config -> lane keeps the committed bytes, no copy line", () => {
  const committed = JSON.stringify({ schema_version: 2, cutApprovalAutoTier: { maxFiles: 3 } }) + "\n";
  const repo = makeRepo({ tracked: { ".current/.config.json": committed } });
  writeFile(path.join(repo, ".current", ".config.json"), CONFIG_BYTES); // working copy edited
  const { res, laneConfig, lane } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(laneConfig, "utf-8"), committed);
  assert.ok(!res.stdout.includes("copied .current/.config.json"), res.stdout);
  assert.equal(laneStatus(lane), "");
});

// AC3 — nothing to copy is not an error and must not fabricate a file.
test("AC3: no primary config -> exit 0, no lane config file", () => {
  const repo = makeRepo({ exclude: ["/.current/"] });
  const { res, laneConfig } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(lstatOrNull(laneConfig), null);
  assert.ok(!res.stdout.includes("copied .current/.config.json"), res.stdout);
});

// AC4 — the point of the copy: the server, reading the lane workspace, sees primary's setting.
test("AC4: loadConfig(lane).cutApprovalAutoTier deep-equals primary's after start", () => {
  const repo = makeRepo({ exclude: ["/.current/"], config: CONFIG_BYTES });
  const { res, lane } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  const primaryTier = loadConfig(repo).cutApprovalAutoTier;
  assert.equal(primaryTier?.maxFiles, TIER.maxFiles, "fixture sanity: primary arms the tier with the non-default values");
  assert.equal(primaryTier?.maxPriority, TIER.maxPriority);
  assert.deepEqual(loadConfig(lane).cutApprovalAutoTier, primaryTier);
});

// Reviewer-observed layouts (review_reports/review_T-E429-01.md, Correctness table).

// Layout B: ignoring through a tracked .gitignore is also "git ignores the path" -> copy.
test("layout B: ignored through a tracked .gitignore -> copied, lane clean", () => {
  const repo = makeRepo({ tracked: { ".gitignore": ".current/\n" }, config: CONFIG_BYTES });
  const { res, laneConfig, lane } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(laneConfig, "utf-8"), CONFIG_BYTES);
  assert.ok(res.stdout.split("\n").includes(COPY_LINE), res.stdout);
  assert.equal(laneStatus(lane), "");
});

// Layout C: untracked and not ignored -> a copy would dirty the lane and block `finish`, so skip.
test("layout C: config untracked and not ignored -> not copied, lane stays clean", () => {
  const repo = makeRepo({ config: CONFIG_BYTES });
  const { res, laneConfig, lane } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(lstatOrNull(laneConfig), null);
  assert.ok(!res.stdout.includes("copied .current/.config.json"), res.stdout);
  assert.equal(laneStatus(lane), "");
});

// Layout G: a dangling symlink committed at the lane path is something the checkout produced; it
// is kept as a link, never followed (a followed write would land outside the lane) or replaced.
test("layout G: committed dangling symlink at the lane path -> kept, not followed", () => {
  const repo = makeRepo({ exclude: ["/.current/"] });
  // Commit the symlink on main, then add primary's real (ignored) config in the working tree.
  fs.mkdirSync(path.join(repo, ".current"), { recursive: true });
  fs.symlinkSync("does-not-exist-target.json", path.join(repo, ".current", ".config.json"));
  git(repo, ["add", "-f", ".current/.config.json"]);
  git(repo, ["commit", "-qm", "track dangling link"]);
  const { res, laneConfig, lane } = start(repo);
  assert.equal(res.status, 0, res.stderr);
  const st = lstatOrNull(laneConfig);
  assert.ok(st && st.isSymbolicLink(), "the committed symlink must remain a symlink");
  assert.equal(fs.readlinkSync(laneConfig), "does-not-exist-target.json");
  assert.ok(!res.stdout.includes("copied .current/.config.json"), res.stdout);
  assert.equal(
    lstatOrNull(path.join(lane, ".current", "does-not-exist-target.json")),
    null,
    "nothing may be written through the link"
  );
  assert.equal(laneStatus(lane), "");
});
