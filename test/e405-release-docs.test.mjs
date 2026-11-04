// Coded by @qa-engineer
// T-E405-11: docs tests for docs/release-cd.md and the CONTRIBUTING pointer
// (specs/e405-release-cd.md AC-D1, AC-D2, AC-D4 and the doc literals).
//
// WHY: the operator guide is the only place a human learns the trigger line, the secret and what a runner-only
// stop means (those classes have no SOP row by design, C2). If the guide drifts from the script's exit table
// or from the workflow's inputs, a failed release is read wrongly at the worst moment.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC = fs.readFileSync(path.join(REPO, "docs", "release-cd.md"), "utf-8");
const CONTRIB = fs.readFileSync(path.join(REPO, "CONTRIBUTING.md"), "utf-8");
const rel = await import(pathToFileURL(path.join(REPO, "scripts", "release.mjs")).href);

const section = (name) => {
  const start = DOC.indexOf(`\n## ${name}\n`);
  assert.ok(start >= 0, `## ${name} exists`);
  const next = DOC.indexOf("\n## ", start + 4);
  return DOC.slice(start, next < 0 ? undefined : next);
};
const tableRows = (text) => text.split("\n").filter((l) => /^\|.*\|$/.test(l) && !/^\|[-| ]+\|$/.test(l)).map((l) => l.slice(1, -1).split("|").map((c) => c.trim()));

test("AC-D1 release-cd sections, inputs, secret and checklist", () => {
  assert.ok(DOC.startsWith("# Release CD\n"));
  assert.deepEqual(DOC.split("\n").filter((l) => l.startsWith("## ")),
    ["## Trigger", "## Inputs", "## Secret", "## Before you trigger", "## When a run fails", "## Manual fallback"], "six sections, in order");

  const trigger = section("Trigger");
  assert.ok(trigger.includes("gh workflow run release.yml -f bump=<kind> -f tickets=<ids|none> -f dry_run=<true|false>"), "docs.trigger line");
  assert.ok(trigger.includes("Actions → Release → Run workflow"), "the Actions UI path");

  const inputs = section("Inputs");
  for (const name of ["bump", "tickets", "dry_run"]) assert.ok(inputs.includes(`\`${name}\``), `input ${name}`);
  assert.ok(inputs.includes("`patch`, `minor`, `major`") && inputs.includes("`major`"), "bump kinds, major by deliberate choice");
  assert.match(inputs, /`dry_run` \| boolean \| `true`/, "dry_run defaults to true");
  // OQ3: what a dry run covers, and that the first prepare/publish/close-out on a runner is the release itself.
  assert.ok(inputs.includes("`dry_run: true` runs `start --dry-run` and skips every later release step"), "OQ3 dry-run scope");
  for (const phase of ["`prepare`", "`publish`", "`record`", "`close-out`"]) assert.ok(inputs.includes(phase));
  assert.ok(inputs.includes("The first real `prepare`, `publish`, `record` and `close-out` on a runner is therefore the release that ships this workflow"), "OQ3 first-real-run sentence");
  // OQ2: the commit summary rule.
  assert.ok(inputs.includes("`active_feature` when `tickets` is `none`, else `<active_feature> (<E1>, <E2>)`"), "OQ2 summary rule");
  assert.ok(inputs.includes("`github-actions[bot]`"), "commit and tag identity");

  const secret = section("Secret");
  assert.ok(secret.includes("`RELEASE_TOKEN`"));
  for (const perm of ["Contents: read and write", "Pull requests: read and write", "Actions: read", "Metadata: read"]) assert.ok(secret.includes(perm), perm);
  assert.match(secret, /fine-grained personal access token/);
  assert.match(secret, /never written to any file/);
  assert.match(secret, /`GITHUB_TOKEN`/, "why the job token cannot do the pushes");

  const before = section("Before you trigger");
  const items = before.split("\n").filter((l) => l.startsWith("- [ ] "));
  assert.equal(items.length, 5, "five checklist items");
  assert.match(items[0], /`\(qa-engineer, PASS\)`/);
  assert.match(items[0], /`## \[Unreleased\]`/);
  assert.match(items[0], /`docs\/\*` pull request/);
  assert.match(items[1], /`docs\/dependency-advisories\.md`/);
  assert.match(items[1], /re-review trigger/);
  assert.match(items[2], /`not yet released`/);
  assert.match(items[3], /release\/vX\.Y\.Z/);
  assert.match(items[4], /dry run/);

  const fails = section("When a run fails");
  assert.ok(fails.includes("`Release failed: <CLASS_ID>`"), "issue title shape");
  assert.ok(fails.includes("`NO_STOP_LINE`"));
  assert.ok(fails.includes("*Escalation Routes*") && fails.includes("content/skill-release-engineer.md"), "pointer to the SOP's Escalation Routes");
  assert.ok(section("Manual fallback").includes("`content/skill-release-engineer.md`"));
});

test("AC-D2 runner-only classes map one to one onto the docs table", () => {
  // WHY: the 11 runner-only classes have no SOP row (C2); this table is where an operator reads them, so it must
  // equal the script's own table: same ids, same codes, code order, no extra row.
  const want = rel.EXIT_CLASSES.filter((c) => c.phases.every((p) => rel.RUNNER_PHASES.includes(p)));
  assert.equal(want.length, 11);
  assert.deepEqual(want.map((c) => c.code), [60, 61, 62, 63, 64, 70, 71, 72, 73, 74, 75]);
  const all = tableRows(section("When a run fails"));
  const rows = all.filter((r) => /^\d+$/.test(r[0]));
  assert.deepEqual(rows.map((r) => [Number(r[0]), r[1], r[2]]), want.map((c) => [c.code, c.id, c.phases.join(", ")]), "code, class and phase columns equal EXIT_CLASSES");
  assert.ok(rows.every((r) => r.length === 5 && r.every((c) => c !== "")), "five non-empty cells per row");
  assert.deepEqual(all.find((r) => r[0] === "code"), ["code", "class", "phase", "meaning", "what to do"]);
});

test("AC-D4 CONTRIBUTING names the release workflow once", () => {
  const pointer = "- Releases run from GitHub Actions: see `docs/release-cd.md` (the release-engineer SOP is the manual fallback).";
  const lines = CONTRIB.split("\n");
  assert.equal(lines.filter((l) => l === pointer).length, 1, "the pointer line appears exactly once");
  assert.equal(CONTRIB.split("docs/release-cd.md").length - 1, 1, "docs/release-cd.md is named once in the file");
  const at = lines.indexOf(pointer), dev = lines.findIndex((l) => /^#+ .*Dev workflow/i.test(l));
  assert.ok(dev >= 0 && dev < at, "the line is after the Dev workflow heading");
  const nextH = lines.findIndex((l, i) => i > dev && /^#+ /.test(l));
  assert.ok(nextH < 0 || at < nextH, "inside the Dev workflow list");
  assert.ok(lines[at - 1].startsWith("- "), "it sits in the list, after another bullet");
});

test("AC-D1 the doc agrees with the workflow file on its literals and carries no secret, path or URL", () => {
  const wf = fs.readFileSync(path.join(REPO, ".github", "workflows", "release.yml"), "utf-8");
  assert.ok(wf.includes("secrets.RELEASE_TOKEN") && DOC.includes("RELEASE_TOKEN"));
  assert.ok(wf.includes("name: Release") && DOC.includes("`Release` workflow"));
  assert.ok(wf.includes('"Release failed: $class"') && DOC.includes("Release failed: <CLASS_ID>"), "issue title shape agrees with the workflow");
  assert.ok(wf.includes("timeout-minutes: 120") && DOC.includes("120 minutes"));
  assert.ok(wf.includes('AGC_VERIFY_CI_WAIT_SECONDS: "900"') && DOC.includes("900 seconds"));
  assert.ok(!/github_pa[t]_|gh[pousr]_[A-Za-z0-9]{36}|\/User[s]\/|\/hom[e]\/|https?:\/[/]/.test(DOC), "AC-H5: no token value, personal path or literal URL");
});
