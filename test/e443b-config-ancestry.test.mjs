// Coded by @qa-engineer
// Tests (T-E443B-01) for specs/e443b-lane-launcher.md A2-23 (checkLaneAncestry's required ref parameter) and
// A2-24 (the laneLaunchLimit config key and its docs/config.md section).
// WHY (A2-23): the launcher checks a dependency against the wave's start ref (`base:` or `main`), not HEAD of
// the primary checkout, so the ancestry check takes the ref; a JavaScript caller written before the parameter
// (scripts/join-precondition.mjs, outside this lane) passes two arguments and must keep comparing with HEAD.
// WHY (A2-24): the key is optional and surfaced verbatim only when usable — the launcher applies its own
// default — and adding it is not a config schema change.
// Exercised through the built dist/ modules over temp git repos / temp workspaces. Each title starts with its
// AC id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e443b-cfg-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let seq = 0;

// Copy `config.section` (verbatim).
const CONFIG_SECTION = [
  "### `laneLaunchLimit` — lane launcher parallel limit (optional)",
  "",
  "The lane launcher (`node <agc install>/scripts/lane-launch.mjs <manifest>`) starts the lanes of one wave of a fan-out manifest, each in its own terminal window. This key caps how many of its lanes are open at once; lanes over the limit queue and start as others finish.",
  "",
  "```json",
  "{",
  '  "laneLaunchLimit": 2',
  "}",
  "```",
  "",
  "| Value | Lanes open at once |",
  "|---|---|",
  "| absent (or not usable) | `3` (the default) |",
  "| `2` | `2` |",
  "",
  "Semantics:",
  "",
  "- **Optional.** A positive integer. Any other value (zero, negative, fractional, not a number) is dropped silently and the default applies; it is never an error.",
  "- **What counts as open.** A lane counts from the moment the launcher starts it until its final report reaches the mailbox (its lane report, or the report it sends after a batch stop; a progress report does not count) or its window is gone; a paused lane still counts.",
  "- **Where the default is applied.** `loadConfig` surfaces the value verbatim as `WorkspaceConfig.laneLaunchLimit` only when it is usable; the launcher applies the default of 3 itself.",
  "- **Who reads it.** Only the lane launcher, from the primary checkout's `.current/.config.json`.",
  "- **No schema version change.** The key is additive-optional; config `schema_version` stays 2 and no migration exists.",
].join("\n");

function sh(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** main + branch `side` merged into `integ` only + branch `onmain` merged into main. HEAD = main. */
function ancestryRepo() {
  const root = path.join(TMP, `repo-${seq++}`);
  fs.mkdirSync(root);
  sh(["-c", "init.defaultBranch=main", "init", "-q"], root);
  sh(["config", "user.email", "qa@example.invalid"], root);
  sh(["config", "user.name", "qa"], root);
  sh(["config", "commit.gpgsign", "false"], root);
  fs.writeFileSync(path.join(root, "a.txt"), "a\n");
  sh(["add", "-A"], root);
  sh(["commit", "-q", "-m", "init"], root);
  sh(["branch", "integ"], root);
  for (const [branch, target] of [
    ["side", "integ"],
    ["onmain", "main"],
  ]) {
    sh(["checkout", "-q", "-b", branch, "main"], root);
    fs.writeFileSync(path.join(root, `${branch}.txt`), `${branch}\n`);
    sh(["add", "-A"], root);
    sh(["commit", "-q", "-m", branch], root);
    sh(["checkout", "-q", target], root);
    sh(["merge", "-q", "--no-ff", "-m", `merge ${branch}`, branch], root);
  }
  sh(["checkout", "-q", "main"], root);
  return root;
}

test("A2-23: checkLaneAncestry takes (branches, repoRoot, ref): compares with ref; a two-argument caller still compares with HEAD", async () => {
  const dts = fs.readFileSync(path.join(ROOT, "dist", "tools", "join-precondition.d.ts"), "utf8");
  assert.match(
    dts,
    /export declare function checkLaneAncestry\(branches: string\[\], repoRoot: string, ref: string\): LaneAncestryResult\[\];/,
    "the emitted signature takes a required ref",
  );
  const { checkLaneAncestry } = await import(path.join(ROOT, "dist", "tools", "join-precondition.js"));
  const repo = ancestryRepo();
  assert.deepEqual(checkLaneAncestry(["side"], repo, "integ"), [{ branch: "side", isAncestor: true }], "merged into ref R: an ancestor of R");
  assert.deepEqual(checkLaneAncestry(["side"], repo, "HEAD"), [{ branch: "side", isAncestor: false }], "not merged into HEAD: a clean negative");
  assert.deepEqual(checkLaneAncestry(["side"], repo), checkLaneAncestry(["side"], repo, "HEAD"), "two arguments: compared with HEAD");
  assert.deepEqual(checkLaneAncestry(["onmain"], repo), [{ branch: "onmain", isAncestor: true }], "two arguments: HEAD's ancestors still found");
  const bad = checkLaneAncestry(["side"], repo, "no-such-ref");
  assert.equal(bad[0].isAncestor, false);
  assert.equal(typeof bad[0].error, "string", "an unresolvable ref is an error result, never a throw or a true");
});

test("A2-24: loadConfig surfaces laneLaunchLimit only as a positive integer, no default, schema 2; docs/config.md has its one section", async () => {
  const { loadConfig, getConfigError } = await import(path.join(ROOT, "dist", "tools", "config.js"));
  const { CURRENT_VERSIONS } = await import(path.join(ROOT, "dist", "schema", "versions.js"));
  const ws = (value) => {
    const dir = path.join(TMP, `ws-${seq++}`);
    fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
    const cfg = { schema_version: 2 };
    if (value !== undefined) cfg.laneLaunchLimit = value;
    fs.writeFileSync(path.join(dir, ".current", ".config.json"), JSON.stringify(cfg));
    return dir;
  };
  const two = ws(2);
  assert.equal(loadConfig(two).laneLaunchLimit, 2);
  assert.equal(getConfigError(two), null);
  for (const v of [0, -1, 1.5, "2", undefined]) {
    const dir = ws(v);
    const cfg = loadConfig(dir);
    assert.ok(!Object.hasOwn(cfg, "laneLaunchLimit") || cfg.laneLaunchLimit === undefined, `value ${JSON.stringify(v)}: no laneLaunchLimit`);
    assert.equal(getConfigError(dir), null, `value ${JSON.stringify(v)} is never a config error`);
  }
  assert.equal(CURRENT_VERSIONS.config, 2, "config schema_version stays 2");

  const doc = fs.readFileSync(path.join(ROOT, "docs", "config.md"), "utf8");
  const lines = doc.split("\n");
  const heads = lines.map((l, i) => [l, i]).filter(([l]) => l.startsWith("### `laneLaunchLimit`"));
  assert.equal(heads.length, 1, "exactly one laneLaunchLimit section");
  assert.equal(doc.split(CONFIG_SECTION).length - 1, 1, "Copy config.section verbatim, once");
  const at = heads[0][1];
  const prevHeading = lines.slice(0, at).filter((l) => l.startsWith("### ") || l.startsWith("## ")).at(-1);
  assert.ok(prevHeading?.startsWith("### `knowledge`"), `the section follows the knowledge section (previous heading: ${prevHeading})`);
  assert.ok(!lines.slice(lines.indexOf(prevHeading), at).includes("---"), "no --- between the knowledge section and it");
  assert.equal(lines[at - 1], "", "a blank line before it");
  assert.notEqual(lines[at - 2].trim(), "", "directly after the knowledge section's last line");
  const end = lines.findIndex((l, i) => i > at && l === "---");
  assert.ok(end > at, "the section ends at the next ---");
  const section = lines.slice(at, end);
  assert.ok(!section.slice(1).some((l) => l.startsWith("#")), "no other heading inside the section");
  assert.ok(!section.some((l) => /\bE\d{2,4}[a-z]?\b/.test(l)), "no bare ticket id in the section");
});
