// Coded by @qa-engineer
// Tests (T-E289-02) for specs/e289-render-addendum.md AC-E289-4, 6..9: `fanout.mjs render` tells the lane to
// move its session into the worktree with EnterWorktree, and, only when primary's config sets
// `laneProtocolAddendum`, points it at agc's generic lane rules plus the repo's addendum. The unset path must stay
// byte-identical to base (plus the one new line) because adopters and goldens depend on it; the set path must fail
// loudly and completely (every missing source in one report, the bad value never echoed) because a prompt that
// silently drops the addendum sends a lane to work without the repo's rules; and a broken config must only warn,
// because base render never read config. Fixtures: the frozen wave7 manifest copy plus temp primaries and temp
// install roots (via the RenderOptions.installRoot seam) under os.tmpdir(); nothing reads this repo's config.
// AC-E289-5 (golden diff) and AC-E289-10 (e178a AC15) are proven by commands recorded in the QA report.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parseManifest, renderPrompt, runRender, PROMPT_TEMPLATE_3B } from "../dist/tools/fanout-manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_TEXT = fs.readFileSync(path.join(ROOT, "test", "fixtures", "e177a", "fanout-wave7.md"), "utf8");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e289-render-")));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ENTER_LINE =
  "`feature start` 建好 worktree 之後，呼叫 `EnterWorktree`（path = <worktree>）把這個 session 切進去；這個工具不能用時，每個 Bash 指令照舊自帶 `cd <worktree> &&`。";
const UNSET_POINTER = "先完整讀 docs/lane-protocol.md（共同規則，包括信箱與回報格式），再讀 R1 + R2。";
const two = (generic, addendum) =>
  `先完整讀 ${generic}（agc 通用規則，包括信箱與回報格式）和 ${addendum}（本 repo 的補充規則），再讀 R1 + R2。`;
const WARN_RE = /^WARN {2}CONFIG_UNREADABLE: laneProtocolAddendum could not be read \(.+\) — the prompt points only at docs\/lane-protocol\.md$/;

let n = 0;
const fresh = (label) => {
  const d = path.join(TMP, `${label}${n++}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
};

/** A primary dir: config body (object => JSON, string => raw, undefined => no config) and optional files. */
function primaryWith(config, files = {}) {
  const dir = fresh("primary");
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".current", ".config.json"), typeof config === "string" ? config : JSON.stringify({ schema_version: 2, ...config }));
  }
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

/** An agc install root; `protocol` false leaves docs/lane-protocol.md out. */
function installRoot(protocol = true) {
  const dir = fresh("install");
  if (protocol) {
    fs.mkdirSync(path.join(dir, "docs"));
    fs.writeFileSync(path.join(dir, "docs", "lane-protocol.md"), "# generic rules\n");
  }
  return dir;
}

const manifest = () => parseManifest(MANIFEST_TEXT);
const opts = (primary, extra = {}) => ({ summary: "S", reading: ["R1", "R2"], mailboxRoot: "/m", primary, ...extra });
const render = (primary, extra) => renderPrompt(manifest(), "e177a", opts(primary, extra));
/**
 * The key-unset render of the same manifest, primary and options: the byte baseline for every set/broken case.
 * Call it AFTER the case's own render — it removes primary's config, because the primary path is part of the prompt.
 */
const unsetPrompt = (primary, extra) => {
  fs.rmSync(path.join(primary, ".current", ".config.json"), { force: true });
  const r = render(primary, extra);
  assert.equal(r.ok, true);
  return r.prompt;
};
const codes = (r) => r.errors.map((e) => e.code);

// --- AC-E289-4 ------------------------------------------------------------------------------------------------

test("AC-E289-4 the template has exactly one EnterWorktree line, right after the 先完整讀 line", () => {
  // WHY: the lane reads the instruction before the fields block; a second or misplaced line would drift the golden.
  const lines = PROMPT_TEMPLATE_3B.split("\n");
  const readAt = lines.findIndex((l) => l.startsWith("先完整讀 "));
  assert.ok(readAt >= 0);
  assert.equal(lines.filter((l) => l.includes("EnterWorktree")).length, 1);
  assert.equal(lines[readAt + 1], ENTER_LINE);
  assert.ok(lines[readAt + 2].startsWith("你只負責這張票走到 qa PASS；"));
});

test("AC-E289-4 render substitutes <worktree> in both places of the new line", () => {
  const r = render(primaryWith(undefined));
  assert.equal(r.ok, true);
  const wt = /worktree: (\S+)/.exec(r.prompt)[1];
  const line = r.prompt.split("\n").find((l) => l.includes("EnterWorktree"));
  assert.equal(line, ENTER_LINE.replaceAll("<worktree>", wt));
});

// --- AC-E289-7 / 8 / 6 ----------------------------------------------------------------------------------------

test("AC-E289-7 key set, install is not primary: absolute generic path + verbatim addendum, other lines unchanged", () => {
  const addendum = "docs/lane-protocol-addendum.md";
  const primary = primaryWith({ laneProtocolAddendum: addendum }, { [addendum]: "# addendum\n" });
  const install = installRoot();
  const r = render(primary, { installRoot: install });
  assert.equal(r.ok, true);
  assert.equal(r.warnings, undefined);
  const got = r.prompt.split("\n");
  const base = unsetPrompt(primary, { installRoot: install }).split("\n");
  assert.equal(got.length, base.length);
  let changed = 0;
  got.forEach((l, i) => {
    if (l !== base[i]) {
      changed++;
      assert.equal(base[i], UNSET_POINTER);
      assert.equal(l, two(path.join(install, "docs", "lane-protocol.md"), addendum));
    }
  });
  assert.equal(changed, 1, "exactly the 先完整讀 line differs from the key-unset render");
});

test("AC-E289-8 key set, install IS primary (same path or a symlink to it): generic stays relative", () => {
  // WHY: a relative pointer stays valid inside the lane worktree of the same repo; an absolute one would not.
  const addendum = "docs/add.md";
  const primary = primaryWith({ laneProtocolAddendum: addendum }, { [addendum]: "x", "docs/lane-protocol.md": "# generic\n" });
  const same = render(primary, { installRoot: primary });
  assert.equal(same.ok, true);
  assert.ok(same.prompt.split("\n").includes(two("docs/lane-protocol.md", addendum)));

  const link = path.join(fresh("link"), "install-link");
  fs.symlinkSync(primary, link, "dir");
  const viaLink = render(primary, { installRoot: link });
  assert.equal(viaLink.ok, true);
  assert.equal(viaLink.prompt, same.prompt, "equal realpath => same relative form");
});

test("AC-E289-6 the rendered prompt (key unset and key set) leaks no lane-protocol.md line", () => {
  // WHY: e177a AC7 — the prompt points at the rules, it never copies them.
  const protocol = fs.readFileSync(path.join(ROOT, "docs", "lane-protocol.md"), "utf8");
  const longLines = protocol
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20);
  const addendum = "docs/add.md";
  const primary = primaryWith({ laneProtocolAddendum: addendum }, { [addendum]: "x" });
  const set = render(primary, { installRoot: installRoot() });
  assert.equal(set.ok, true);
  for (const prompt of [unsetPrompt(primary, {}), set.prompt]) {
    assert.deepEqual(longLines.filter((l) => prompt.includes(l)), []);
  }
});

// --- AC-E289-9 ------------------------------------------------------------------------------------------------

test("AC-E289-9 ADDENDUM_INVALID for absolute, ~, . and .. values; the value is never echoed", () => {
  const secret = "zz-secret-name";
  const values = [
    `/${secret}/x.md`,
    `~/${secret}.md`,
    "~",
    ".",
    "./",
    "docs/..",
    "..",
    `../${secret}.md`,
    `a/../../${secret}.md`,
  ];
  for (const v of values) {
    const r = render(primaryWith({ laneProtocolAddendum: v }), { installRoot: installRoot() });
    assert.equal(r.ok, false, v);
    assert.deepEqual(codes(r), ["ADDENDUM_INVALID"], v);
    assert.ok(!r.errors[0].message.includes(secret), `message must not echo ${v}`);
  }
});

test("AC-E289-9 ADDENDUM_ABSENT for a missing file or a directory; a dotted-inside relative path is accepted", () => {
  const install = installRoot();
  const missing = render(primaryWith({ laneProtocolAddendum: "docs/nope.md" }), { installRoot: install });
  assert.deepEqual(codes(missing), ["ADDENDUM_ABSENT"]);
  assert.ok(missing.errors[0].message.includes("docs/nope.md"), "a relative value is echoed by ADDENDUM_ABSENT");
  const dir = render(primaryWith({ laneProtocolAddendum: "docs" }, { "docs/x.md": "x" }), { installRoot: install });
  assert.deepEqual(codes(dir), ["ADDENDUM_ABSENT"]);
  const inner = render(primaryWith({ laneProtocolAddendum: "a/../docs/x.md" }, { "docs/x.md": "x" }), { installRoot: install });
  assert.equal(inner.ok, true, "normalizes to a path that stays inside the repo");
});

test("AC-E289-9 LANE_PROTOCOL_ABSENT only while the key is set; never when unset", () => {
  const noProtocol = installRoot(false);
  const set = render(primaryWith({ laneProtocolAddendum: "docs/a.md" }, { "docs/a.md": "x" }), { installRoot: noProtocol });
  assert.deepEqual(codes(set), ["LANE_PROTOCOL_ABSENT"]);
  const unset = render(primaryWith(undefined), { installRoot: noProtocol });
  assert.equal(unset.ok, true);
  const emptyString = render(primaryWith({ laneProtocolAddendum: "" }), { installRoot: noProtocol });
  assert.equal(emptyString.ok, true, "an empty string is unset");
});

test("AC-E289-9 the three errors are collected with each other and with other missing sources", () => {
  const r = render(primaryWith({ laneProtocolAddendum: "docs/missing.md" }), { installRoot: installRoot(false), summary: undefined });
  assert.equal(r.ok, false);
  for (const c of ["SUMMARY_ABSENT", "ADDENDUM_ABSENT", "LANE_PROTOCOL_ABSENT"]) assert.ok(codes(r).includes(c), c);
  const bad = render(primaryWith({ laneProtocolAddendum: "/abs.md" }), { installRoot: installRoot(false) });
  assert.deepEqual(codes(bad).sort(), ["ADDENDUM_INVALID", "LANE_PROTOCOL_ABSENT"]);
});

test("AC-E289-9 with no primary, PRIMARY_NOT_FOUND is the only report (config is never read)", () => {
  const nonGit = fresh("nongit");
  const r = renderPrompt(manifest(), "e177a", { summary: "S", reading: ["R1"], mailboxRoot: "/m", manifestDir: nonGit, installRoot: installRoot(false) });
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ["PRIMARY_NOT_FOUND"]);
});

test("AC-E289-9 an unusable primary config warns once and renders the key-unset prompt", () => {
  // WHY: base render never read config; a key-less workspace with a broken config must keep rendering.
  for (const body of ["{ not json", '{"schema_version": 999, "laneProtocolAddendum": "docs/a.md"}']) {
    const primary = primaryWith(body, { "docs/a.md": "x" });
    const install = installRoot();
    const r = render(primary, { installRoot: install });
    assert.equal(r.ok, true, body);
    assert.equal(r.prompt, unsetPrompt(primary, { installRoot: install }), body);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], WARN_RE);
    assert.ok(!r.warnings[0].includes("\n"));
  }
});

test("AC-E289-9 runRender: exit 0 with exactly one stderr WARN line; exit 2 with no stdout on a set-key error", () => {
  const dir = fresh("cli");
  const file = path.join(dir, "fanout-fx.md");
  fs.writeFileSync(file, MANIFEST_TEXT);
  const args = (primary) => [file, "e177a", "--summary", "S", "--reading", "R1", "--reading", "R2", "--mailbox-root", "/m", "--primary", primary];

  const brokenPrimary = primaryWith("{ not json");
  const broken = runRender(args(brokenPrimary));
  assert.equal(broken.exitCode, 0);
  const errLines = broken.stderr.split("\n");
  assert.equal(errLines.length, 2);
  assert.equal(errLines[1], "");
  assert.match(errLines[0], WARN_RE);
  assert.equal(broken.stdout, unsetPrompt(brokenPrimary, {}));

  const clean = runRender(args(primaryWith(undefined)));
  assert.equal(clean.exitCode, 0);
  assert.equal(clean.stderr, "");

  const bad = runRender(args(primaryWith({ laneProtocolAddendum: "/abs/zz-secret.md" })));
  assert.equal(bad.exitCode, 2);
  assert.equal(bad.stdout, "");
  assert.ok(bad.stderr.includes("ADDENDUM_INVALID"));
  assert.ok(!bad.stderr.includes("zz-secret"), "the value is not echoed");
});
