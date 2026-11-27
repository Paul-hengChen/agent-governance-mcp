// Coded by @qa-engineer
// Tests (T-E465-01) for docs/tickets/E465.md S1 and S7 (specs/e465-launcher-wave-done.md, Build contract and
// Copy / Strings).
// WHY (S1): `waveDoneAt` decides whether the next wave may start before the previous pull request merges. The
// safe value is `merged` (today's rule), so an absent or unusable value must behave as `merged` — and an unusable
// value must be named, never silently swallowed and never a config error. `loadConfig` itself fills no default
// (a separate resolver does), like `laneLaunchLimit`.
// WHY (S7): the two new launcher options and the new key are only usable if a reader can find them: the key in
// docs/config.md, the options in the launcher's usage line and its script header. Malformed argv still exits 2.
// Through the built dist/ modules and the launcher's public entry points; every title starts with its scenario id.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLaunch, makeEnv, makeDeps, runCore, runCli, laneReport, cleanup, spawnCli } from "./fixtures/e443b/harness.mjs";
import { lane } from "./fixtures/e465/flow.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e465-cfg-")));
after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  cleanup();
});
let seq = 0;

const loadConfigMod = () => import(path.join(ROOT, "dist", "tools", "config.js"));

/** A workspace whose .current/.config.json is { schema_version: 2 } plus `waveDoneAt` when `value` is given. */
function ws(value, { omit = false } = {}) {
  const dir = path.join(TMP, `ws-${seq++}`);
  fs.mkdirSync(path.join(dir, ".current"), { recursive: true });
  const cfg = { schema_version: 2 };
  if (!omit) cfg.waveDoneAt = value;
  fs.writeFileSync(path.join(dir, ".current", ".config.json"), JSON.stringify(cfg));
  return dir;
}

// Copy / Strings (verbatim).
const INVALID = (v) => `lane-launch: waveDoneAt ${JSON.stringify(v)} is neither "merged" nor "pr-open"; using "merged"`;
const USAGE = "usage: node scripts/lane-launch.mjs <manifest> [--wake-weekly] [--close-finished]";
const HEADER_USAGE = "// Usage: node scripts/lane-launch.mjs <manifest> [--wake-weekly] [--close-finished]";
const HEADER_OPTIONS =
  "// --wake-weekly wakes paused-weekly lanes, then runs as usual; --close-finished only sends /exit to finished lanes' windows (stopped ones are kept) and starts nothing.";
const WAVEDONE_SECTION = [
  "### `waveDoneAt` — when a wave counts as done (optional)",
  "",
  "Says when a wave of a fan-out manifest counts as done: once its pull request has merged, or as soon as it is open. A repo whose pull requests wait for a human review or a manual merge sets `\"pr-open\"`, so the next wave does not wait for the merge.",
  "",
  "```json",
  "{",
  '  "waveDoneAt": "pr-open"',
  "}",
  "```",
  "",
  "| Value | A wave is done when |",
  "|---|---|",
  "| absent (or not usable) | its pull request has merged (the default, `\"merged\"`) |",
  "| `\"merged\"` | its pull request has merged |",
  "| `\"pr-open\"` | its pull request is open |",
  "",
  "Semantics:",
  "",
  "- **Optional.** `\"merged\"` or `\"pr-open\"`. The lane launcher names any other value in a line on its standard error and uses `\"merged\"`; it is never an error.",
  "- **Dependencies under `\"pr-open\"`.** The next wave can start while the previous wave's pull request is still open, so the lane launcher starts a lane that depends on a lane of an earlier wave only once that lane's work has merged into the ref the dependent lane starts from (the manifest's `base:` for the first wave, `main` for a later one). Until then it lists the lane as waiting and names the work not yet merged; re-run it after the merge to start the lane. A lane that depends on nothing starts at once, and a lane already started is never started again.",
  "- **A deleted branch under `\"pr-open\"`.** Once `agc feature finish --shipped` has deleted the depended-on lane's branch, the launcher checks the branch tip it recorded while the branch existed; a finish record alone does not count. A lane the launcher never saw (started by hand) has no recorded tip, so its dependents keep waiting: start them by hand once the work has merged.",
  "- **Dependencies under `\"merged\"`.** Unchanged: the next wave starts only after the previous wave's pull request has merged, so a deleted branch with a finish record counts as merged.",
  "- **Where the default is applied.** `loadConfig` surfaces the value verbatim as `WorkspaceConfig.waveDoneAt` only when it is `\"merged\"` or `\"pr-open\"`; a separate resolver applies the default.",
  "- **Who reads it.** The lane launcher, from the primary checkout's `.current/.config.json`.",
  "- **No schema version change.** The key is additive-optional; config `schema_version` stays 2 and no migration exists.",
];

// ---------------------------------------------------------------------------------------------------------------
// S1 — wave-done setting defaults to merged
// ---------------------------------------------------------------------------------------------------------------

test("S1: loadConfig surfaces waveDoneAt only as merged or pr-open and fills no default; the resolver defaults to merged", async () => {
  // WHY: the default lives in one resolver, not in loadConfig (config-cache pins `{}` for a missing file), so
  // every reader that wants the effective value gets `merged` for an absent key.
  const { loadConfig, getConfigError, resolveWaveDoneAt } = await loadConfigMod();
  const { CURRENT_VERSIONS } = await import(path.join(ROOT, "dist", "schema", "versions.js"));
  assert.equal(typeof resolveWaveDoneAt, "function", "tools/config.ts exports resolveWaveDoneAt");

  const absent = ws(undefined, { omit: true });
  assert.ok(!Object.hasOwn(loadConfig(absent), "waveDoneAt"), "no waveDoneAt key: loadConfig fills no default");
  assert.equal(getConfigError(absent), null);
  assert.deepEqual(resolveWaveDoneAt(absent), { waveDoneAt: "merged" }, "absent key: merged, nothing rejected");

  const noFile = path.join(TMP, `ws-${seq++}`);
  fs.mkdirSync(noFile);
  assert.deepEqual(loadConfig(noFile), {}, "no config file: still {}");
  assert.deepEqual(resolveWaveDoneAt(noFile), { waveDoneAt: "merged" }, "no config file: merged");

  for (const v of ["merged", "pr-open"]) {
    const dir = ws(v);
    assert.equal(loadConfig(dir).waveDoneAt, v, `${v} is surfaced verbatim`);
    assert.deepEqual(resolveWaveDoneAt(dir), { waveDoneAt: v }, `${v} resolves to itself, nothing rejected`);
    assert.equal(getConfigError(dir), null);
  }
  assert.equal(CURRENT_VERSIONS.config, 2, "config schema_version stays 2 (no migration)");
});

test("S1: any other waveDoneAt value is reported by name and resolves to merged, never a config error", async () => {
  // WHY: a typo such as "PR-OPEN" must not silently pick a mode; the resolver hands the rejected value back so
  // the launcher can name it. Boundary inputs (empty, null, non-string, oversized, special characters) included.
  const { loadConfig, getConfigError, resolveWaveDoneAt } = await loadConfigMod();
  const bad = ["PR-OPEN", "pr_open", "", " merged", null, 0, true, ["pr-open"], { mode: "pr-open" }, "x".repeat(10_000), "pr-open\n\"; rm -rf /"];
  for (const v of bad) {
    const dir = ws(v);
    const label = JSON.stringify(v).slice(0, 40);
    assert.ok(!Object.hasOwn(loadConfig(dir), "waveDoneAt"), `${label}: loadConfig drops it`);
    assert.equal(getConfigError(dir), null, `${label}: never a config error`);
    const r = resolveWaveDoneAt(dir);
    assert.equal(r.waveDoneAt, "merged", `${label}: resolves to merged`);
    assert.ok(Object.hasOwn(r, "rejected"), `${label}: the rejected value is reported`);
    assert.deepEqual(r.rejected, v, `${label}: the rejected value is the configured one`);
  }
});

test("S1: the launcher names an unusable waveDoneAt once on standard error and runs on with merged, exit code unaffected", async () => {
  // WHY: the run must continue (it is never a refusal) and the human must see which value was ignored.
  const L = await loadLaunch();
  for (const v of ["PR-OPEN", 7, null]) {
    const env = makeEnv({ lanes: [lane("t1", "T1")], config: { waveDoneAt: v } });
    laneReport(env, "t1"); // nothing left to start: the run is the observe pass and the exit line
    const h = makeDeps(env);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0, `${JSON.stringify(v)}: exit 0`);
    assert.equal(h.err.filter((l) => l === INVALID(v)).length, 1, `${JSON.stringify(v)}: the wavedone.invalid line once\n${h.err.join("\n")}`);
    assert.ok(!h.err.some((l) => l.startsWith("lane-launch: refused")), "not a refusal");
  }
  for (const cfg of [{}, { waveDoneAt: "merged" }, { waveDoneAt: "pr-open" }]) {
    const env = makeEnv({ lanes: [lane("t1", "T1")], config: cfg });
    laneReport(env, "t1");
    const h = makeDeps(env);
    const r = await runCore(L, env, h.deps);
    assert.equal(r.code, 0);
    assert.ok(!h.err.some((l) => l.includes("waveDoneAt")), `${JSON.stringify(cfg)}: no waveDoneAt line`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// S7 — the options are documented
// ---------------------------------------------------------------------------------------------------------------

test("S7: docs/config.md documents waveDoneAt with both values and the default, right after the laneLaunchLimit section", () => {
  // WHY: the section is the only place a repo owner learns the key; its place keeps the laneLaunchLimit
  // section's own boundary (the --- that ends it) intact.
  const doc = fs.readFileSync(path.join(ROOT, "docs", "config.md"), "utf8");
  const lines = doc.split("\n");
  const block = WAVEDONE_SECTION.join("\n");
  assert.equal(doc.split(block).length - 1, 1, "Copy config.wavedone verbatim, once");
  assert.equal(lines.filter((l) => l.startsWith("### `waveDoneAt`")).length, 1, "exactly one waveDoneAt section");
  const lll = lines.findIndex((l) => l.startsWith("### `laneLaunchLimit`"));
  assert.ok(lll >= 0, "the laneLaunchLimit section exists");
  const end = lines.findIndex((l, i) => i > lll && l === "---");
  assert.equal(lines[end + 1], "", "a blank line after the --- ending the laneLaunchLimit section");
  assert.equal(lines[end + 2], WAVEDONE_SECTION[0], "the waveDoneAt section starts right after it");
  const n = WAVEDONE_SECTION.length;
  assert.deepEqual(lines.slice(end + 2, end + 2 + n), WAVEDONE_SECTION);
  assert.equal(lines[end + 2 + n], "", "a blank line after the section");
  assert.equal(lines[end + 3 + n], "---", "the section has its own closing ---");
  assert.ok(!WAVEDONE_SECTION.some((l) => /\bE\d{2,4}[a-z]?\b/.test(l)), "no bare ticket id in the section");
});

test("S7: the launcher's usage line and script header name --wake-weekly and --close-finished", async () => {
  // WHY: the usage line is what a mistyped run prints; the header is what a reader of the wrapper sees.
  const L = await loadLaunch();
  assert.equal(L.LANE_LAUNCH_USAGE, USAGE);
  const script = fs.readFileSync(path.join(ROOT, "scripts", "lane-launch.mjs"), "utf8").split("\n");
  assert.ok(script.includes(HEADER_USAGE), "script.header usage comment line");
  assert.ok(script.includes(HEADER_OPTIONS), "script.header options comment line");
  assert.ok(!script.includes("// Usage: node scripts/lane-launch.mjs <manifest>"), "the old usage comment is replaced");
});

test("S7: an unknown option, a missing manifest or two manifests still print the usage line and exit 2", async () => {
  // WHY: the new options must not loosen argv parsing — anything else is still a usage error, before any seam.
  const L = await loadLaunch();
  const env = makeEnv({ lanes: [lane("t1", "T1")] });
  const cases = [
    [env.manifest, "--bogus"],
    [env.manifest, "--wake-weekly", "--close-finished", "--bogus"],
    ["--wake-weekly"],
    ["--close-finished"],
    [],
    [env.manifest, env.manifest],
    [env.manifest, "--close-finished", env.manifest],
  ];
  for (const argv of cases) {
    const h = makeDeps(env);
    const r = await runCli(L, argv, h.deps);
    const label = JSON.stringify(argv.map((a) => (a === env.manifest ? "<manifest>" : a)));
    assert.equal(r.code, 2, `${label}: exit 2`);
    assert.ok(h.err.includes(USAGE), `${label}: usage line\n${h.err.join("\n")}`);
    assert.equal(h.driver.opens.length, 0, `${label}: no window`);
    assert.equal(h.calls.featureStart.length, 0, `${label}: no feature start`);
  }
  const real = spawnCli(env, [env.manifest, "--bogus"]);
  assert.equal(real.status, 2, real.stdout + real.stderr);
  assert.ok(real.stderr.split("\n").includes(USAGE), real.stderr);
});
