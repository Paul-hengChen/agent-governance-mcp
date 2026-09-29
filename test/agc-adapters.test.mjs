// Coded by @qa-engineer
// Tests for spec: agc-cross-agent-adapter-scaffolding.
// Covers bin/agc-init.mjs adapter scaffolding (T-TEMPLATES, T-INIT-EXTEND,
// T-AGC-CHECK) and sub-command routing (AC-9).
// All workspace I/O uses fs.mkdtempSync temp dirs — never the repo root —
// because the repo root already has pre-staged AGENTS.md and .antigravityrules
// that would poison init/check assertions (code-reviewer flag).
// Spec-to-Test map lives in qa_reports/review_T-TESTS.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

// Read the installed agc version from the real package.json (not the target ws).
const AGC_VERSION = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"),
).version;

// Adapter filenames the CLI is expected to write.
const ADAPTERS = [
  { rel: "CLAUDE.md", mode: "upsert" },
  { rel: "AGENTS.md", mode: "skip" },
  { rel: ".antigravityrules", mode: "skip" },
];

// --- helpers ----------------------------------------------------------------

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runAgc(cwd, args) {
  return spawnSync(process.execPath, [AGC_INIT, ...args], {
    cwd,
    encoding: "utf-8",
  });
}

// ---------------------------------------------------------------------------
// AC-2: agc init writes all three adapters, stamped with AGC_VERSION
// ---------------------------------------------------------------------------

test("AC-2: agc init creates all three adapter files stamped with the installed agc version", () => {
  // Contract: in a fresh temp dir (none of CLAUDE.md/AGENTS.md/.antigravityrules
  // exist), `agc init` must create all three adapter files. The {{AGC_VERSION}}
  // placeholder must be replaced with the version from the agc package's own
  // package.json, and stdout must report each file as created.
  const ws = mkTmp("agc-adapters-ac2-");
  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  for (const { rel } of ADAPTERS) {
    const abs = path.join(ws, rel);
    assert.ok(fs.existsSync(abs), `${rel} must be created`);

    const content = fs.readFileSync(abs, "utf-8");
    assert.ok(
      content.includes(`agc-version: ${AGC_VERSION}`),
      `${rel} must contain agc-version: ${AGC_VERSION} (got: ${content.slice(0, 200)})`,
    );
    // The raw placeholder must NOT survive in the written file.
    assert.ok(
      !content.includes("{{AGC_VERSION}}"),
      `${rel} must not contain raw {{AGC_VERSION}} placeholder`,
    );
  }

  // stdout must report the adapters as created.
  assert.match(r.stdout, /CLAUDE\.md/, "stdout must mention CLAUDE.md");
  assert.match(r.stdout, /AGENTS\.md/, "stdout must mention AGENTS.md");
  assert.match(r.stdout, /\.antigravityrules/, "stdout must mention .antigravityrules");
});

// ---------------------------------------------------------------------------
// AC-3: idempotency — skip-mode adapters not overwritten; CLAUDE.md upserted
// ---------------------------------------------------------------------------

test("AC-3a: agc init skips AGENTS.md and .antigravityrules when they already exist", () => {
  // Contract: mode=skip files (AGENTS.md, .antigravityrules) are left byte-for-byte
  // unchanged when they already exist, and stdout reports them as skipped.
  const ws = mkTmp("agc-adapters-ac3a-");
  const sentinel = "# custom user content — must not be clobbered\n";
  fs.writeFileSync(path.join(ws, "AGENTS.md"), sentinel);
  fs.writeFileSync(path.join(ws, ".antigravityrules"), sentinel);

  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  assert.equal(
    fs.readFileSync(path.join(ws, "AGENTS.md"), "utf-8"),
    sentinel,
    "AGENTS.md must be byte-for-byte unchanged",
  );
  assert.equal(
    fs.readFileSync(path.join(ws, ".antigravityrules"), "utf-8"),
    sentinel,
    ".antigravityrules must be byte-for-byte unchanged",
  );
  assert.match(r.stdout, /Skipped.*AGENTS\.md/, "stdout must report AGENTS.md skipped");
  assert.match(r.stdout, /Skipped.*\.antigravityrules/, "stdout must report .antigravityrules skipped");
});

test("AC-3b: agc init upserts CLAUDE.md idempotently — BEGIN marker count stays 1, user prose preserved", () => {
  // Contract: CLAUDE.md uses mode=upsert. A second init must:
  //   1. Replace the marker block in place (BEGIN count stays 1, not 2).
  //   2. Leave user prose outside the markers untouched.
  // This is the key difference between CLAUDE.md and the two skip-mode files.
  const ws = mkTmp("agc-adapters-ac3b-");

  // First init to create the file.
  const r1 = runAgc(ws, ["init"]);
  assert.equal(r1.status, 0, `first init failed: ${r1.stderr}`);

  // Inject user prose after the marker block.
  const claudePath = path.join(ws, "CLAUDE.md");
  const afterFirstInit = fs.readFileSync(claudePath, "utf-8");
  const USER_PROSE = "\n## My custom section\n\nUser content preserved across re-inits.\n";
  fs.appendFileSync(claudePath, USER_PROSE);

  // Second init — must upsert, not append a second block.
  const r2 = runAgc(ws, ["init"]);
  assert.equal(r2.status, 0, `second init failed: ${r2.stderr}`);

  const after = fs.readFileSync(claudePath, "utf-8");

  // BEGIN marker must appear exactly once.
  const beginCount = (after.match(/<!-- BEGIN agc-adapter -->/g) || []).length;
  assert.equal(beginCount, 1, `CLAUDE.md must have exactly 1 BEGIN marker after 2 inits, got ${beginCount}`);

  // User prose must be preserved.
  assert.ok(
    after.includes("User content preserved across re-inits."),
    "User prose outside markers must survive a second init",
  );

  // After re-init the stamp must be the current version.
  assert.ok(
    after.includes(`agc-version: ${AGC_VERSION}`),
    `CLAUDE.md must contain agc-version: ${AGC_VERSION} after re-init`,
  );
});

// ---------------------------------------------------------------------------
// AC-4: version stamp present and readable
// ---------------------------------------------------------------------------

test("AC-4: version stamp in AGENTS.md and .antigravityrules uses # comment form", () => {
  // Contract: AGENTS.md and .antigravityrules use Markdown headings / line-comments.
  // The stamp line must be present, near the top, and exactly `# agc-version: <ver>`.
  const ws = mkTmp("agc-adapters-ac4-");
  assert.equal(runAgc(ws, ["init"]).status, 0);

  for (const rel of ["AGENTS.md", ".antigravityrules"]) {
    const lines = fs.readFileSync(path.join(ws, rel), "utf-8").split("\n");
    // Find the stamp line — it may be the 1st line.
    const stampLine = lines.find((l) => l.startsWith("# agc-version:"));
    assert.ok(stampLine, `${rel} must contain a "# agc-version:" line`);
    assert.equal(stampLine, `# agc-version: ${AGC_VERSION}`, `${rel} stamp must match installed version`);
  }
});

test("AC-4: CLAUDE.md version stamp uses HTML comment form inside the marker block", () => {
  // Contract: CLAUDE.md uses <!-- agc-version: <ver> --> (HTML comment form)
  // inside the BEGIN/END marker block, per the claude.md template design.
  const ws = mkTmp("agc-adapters-ac4b-");
  assert.equal(runAgc(ws, ["init"]).status, 0);

  const content = fs.readFileSync(path.join(ws, "CLAUDE.md"), "utf-8");
  assert.match(
    content,
    new RegExp(`<!-- agc-version: ${AGC_VERSION.replace(/\./g, "\\.")} -->`),
    `CLAUDE.md must contain <!-- agc-version: ${AGC_VERSION} --> inside the marker block`,
  );
});

// ---------------------------------------------------------------------------
// AC-5: agc check detects stale adapters → exit 1, stale message on stderr
// ---------------------------------------------------------------------------

test("AC-5: agc check exits 1 and prints stale message to stderr when adapter stamp is old", () => {
  // Contract: if an adapter file contains an agc-version stamp that does not match
  // the installed version, `agc check` must write a warning to stderr for each
  // stale file and exit with code 1.
  const ws = mkTmp("agc-adapters-ac5-");

  // Write adapters with a fake stale version.
  const OLD_VERSION = "0.0.1";
  fs.writeFileSync(path.join(ws, "AGENTS.md"), `# agc-version: ${OLD_VERSION}\n# stale file\n`);
  fs.writeFileSync(path.join(ws, ".antigravityrules"), `# agc-version: ${OLD_VERSION}\n# stale file\n`);

  const r = runAgc(ws, ["check"]);
  assert.equal(r.status, 1, `exit code must be 1 when stale adapters found (stderr=${r.stderr})`);

  // Each stale file must appear in stderr with the version gap.
  assert.match(
    r.stderr,
    /agc check.*stale adapter.*AGENTS\.md/,
    "stderr must identify AGENTS.md as stale",
  );
  assert.match(
    r.stderr,
    new RegExp(`stamped ${OLD_VERSION}`),
    "stderr must report the stamped version",
  );
  assert.match(
    r.stderr,
    new RegExp(`installed ${AGC_VERSION.replace(/\./g, "\\.")}`),
    "stderr must report the installed version",
  );
});

// ---------------------------------------------------------------------------
// AC-6: agc check exits 0 when all adapters are current
// ---------------------------------------------------------------------------

// agc check now always runs the advisory hygiene scan, which may add its own
// `agc check — hygiene` lines (e.g. hyg.kw.none). These assertions are about
// the other checks, so they drop those lines first (E234).
function withoutHygieneLines(stderr) {
  return stderr
    .split("\n")
    .filter((l) => !l.startsWith("agc check — hygiene"))
    .join("\n");
}

test("AC-6: agc check exits 0 with OK message when all adapters match installed version", () => {
  // Contract: after a successful `agc init`, every adapter file is stamped with
  // the current AGC_VERSION; `agc check` must exit 0 and print the OK message.
  const ws = mkTmp("agc-adapters-ac6-");
  assert.equal(runAgc(ws, ["init"]).status, 0, "init must succeed before check");

  const r = runAgc(ws, ["check"]);
  assert.equal(r.status, 0, `exit code must be 0 when all adapters current (stderr=${r.stderr})`);
  assert.match(r.stdout, /agc check.*OK/, "stdout must contain OK message");
  assert.match(
    r.stdout,
    new RegExp(AGC_VERSION.replace(/\./g, "\\.")),
    "OK message must include the installed version",
  );
  // No stale warnings expected.
  r.stderr = withoutHygieneLines(r.stderr);
  assert.equal(r.stderr, "", "stderr must be empty when all adapters are current");
});

// ---------------------------------------------------------------------------
// AC-7: agc check exits 0 silently when no adapter files are present
// ---------------------------------------------------------------------------

test("AC-7: agc check exits 0 and produces no output when no adapters are present", () => {
  // Contract: absent adapters (pre-init workspace) must not trigger a false alarm.
  // This preserves the behaviour for unmanaged projects that happen to have agc installed.
  const ws = mkTmp("agc-adapters-ac7-");
  // Fresh temp dir — no CLAUDE.md, AGENTS.md, .antigravityrules.

  const r = runAgc(ws, ["check"]);
  assert.equal(r.status, 0, `exit code must be 0 when no adapters present (stderr=${r.stderr})`);
  assert.equal(r.stdout, "", "stdout must be empty (no false alarms)");
  r.stderr = withoutHygieneLines(r.stderr);
  assert.equal(r.stderr, "", "stderr must be empty");
});

// ---------------------------------------------------------------------------
// AC-8: no verbatim constitution rule line appears in any adapter
// ---------------------------------------------------------------------------

test("AC-8: no verbatim constitution line appears in any adapter template (pointer-only)", async () => {
  // Contract: adapter files are entry-pointers to the governance server, NOT copies
  // of the constitution. Any line that appears verbatim in the composed constitution
  // must not appear in any adapter template. (Programmatic line-intersection —
  // the same check the code-reviewer ran independently.)
  // compose-not-strip: content/constitution.md is retired, and
  // composeConstitution({chain:true,design:true}) reproduces it byte-for-byte,
  // so this mechanical swap changes no assertion (ticket A9).
  const { composeConstitution } = await import(path.join(PROJECT_ROOT, "dist", "prompts", "build.js"));
  const constitutionLines = new Set(
    composeConstitution({ chain: true, design: true })
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0),
  );

  const tplDir = path.join(PROJECT_ROOT, "templates", "agent-adapters");
  const tplFiles = ["claude.md", "codex.md", "antigravity.md"];

  for (const tplFile of tplFiles) {
    const tplLines = fs.readFileSync(path.join(tplDir, tplFile), "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const violations = tplLines.filter((l) => constitutionLines.has(l));
    assert.equal(
      violations.length,
      0,
      `templates/agent-adapters/${tplFile} must contain 0 verbatim constitution lines.\n` +
        `Found ${violations.length}:\n${violations.slice(0, 5).join("\n")}`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC-9: sub-command routing — no sub → exit 1 + usage; bogus → exit 2 + usage
// ---------------------------------------------------------------------------

test("AC-9a: no subcommand exits 1 and prints usage listing both init and check to stderr", () => {
  // Contract: STR-USAGE must list both `init` and `check`. Exit code 1 for
  // the "missing command" case. No files should be written.
  // NOTE: this test owns the assertion at p0-onboarding-lite-default.test.mjs:136
  //       per the code-reviewer §2 ruling — that pre-existing test was updated to
  //       /Usage: agc <command>/ + \binit\b + \bcheck\b (forced by STR_USAGE change).
  const ws = mkTmp("agc-adapters-ac9a-");
  const r = runAgc(ws, []);
  assert.equal(r.status, 1, "no subcommand must exit 1");
  assert.match(r.stderr, /Usage: agc <command>/, "stderr must include Usage: agc <command>");
  assert.match(r.stderr, /\binit\b/, "usage must list 'init' subcommand");
  assert.match(r.stderr, /\bcheck\b/, "usage must list 'check' subcommand");
  // Nothing must be written to the workspace.
  assert.equal(fs.existsSync(path.join(ws, ".current")), false, "no .current dir on no-subcommand");
  assert.equal(fs.existsSync(path.join(ws, "tasks.md")), false, "no tasks.md on no-subcommand");
});

test("AC-9b: bogus subcommand exits 2 and prints usage to stderr", () => {
  // Contract: an unrecognised subcommand must exit 2 (distinct from missing command
  // which exits 1), to allow callers to distinguish "no args" from "typo".
  const ws = mkTmp("agc-adapters-ac9b-");
  const r = runAgc(ws, ["notacommand"]);
  assert.equal(r.status, 2, "bogus subcommand must exit 2");
  assert.match(r.stderr, /Usage: agc <command>/, "stderr must include usage even for bogus subcommand");
});

// ---------------------------------------------------------------------------
// AC22 (specs/e108-agc-eject.md) — top-level usage text lists eject
// (qa-owned additive extension of this file, per that spec's lane
// ownership carve-out — see test/e108-eject.test.mjs for the rest of the
// agc eject coverage (E108); this is the one AC that spec assigns here instead.)
// ---------------------------------------------------------------------------
test("AC22: top-level usage text lists eject", () => {
  const ws = mkTmp("agc-adapters-ac22-");
  const r = runAgc(ws, []);
  assert.equal(r.status, 1, "no subcommand must still exit 1 (unchanged by adding eject)");
  assert.match(r.stderr, /Usage: agc <command>/);
  assert.match(r.stderr, /\binit\b/, "usage must still list 'init'");
  assert.match(r.stderr, /\bcheck\b/, "usage must still list 'check'");
  assert.match(r.stderr, /\bfeature\b/, "usage must still list 'feature'");
  assert.match(r.stderr, /\beject\b/, "usage must list the new 'eject' subcommand");
  // One-line description matching specs/e108-agc-eject.md's Copy/Strings
  // eject.usage.summary verbatim.
  assert.match(
    r.stderr,
    /eject \[--yes\] \[--purge-knowledge\]\n\s+Print \(default\) or execute \(--yes\) the removal plan for agc's own\n\s+runtime artifacts, process evidence, and host traces\. --purge-knowledge\n\s+additionally offers to remove design\/ and specs\/ \(never by default\)\.\n\s+Never interactive\. See docs\/install\.md for the full disposition table\./,
  );

  // A bogus subcommand's usage output must list it too (same block, shared code path).
  const r2 = runAgc(ws, ["notacommand"]);
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /\beject\b/, "bogus-subcommand usage must also list 'eject'");
});

// ---------------------------------------------------------------------------
// T-LABEL-FIX regression: existing CLAUDE.md (no agc block) → Updated, not Created
// ---------------------------------------------------------------------------

test("T-LABEL-FIX: agc init reports CLAUDE.md under Updated when file exists without an agc block", () => {
  // Contract: when CLAUDE.md already exists in the workspace but contains NO
  // <!-- BEGIN agc-adapter --> block, `agc init` must:
  //   1. Report CLAUDE.md under "Updated:" in stdout, NOT under "Created:".
  //   2. Preserve the pre-existing prose (it must still be present after init).
  //   3. Append exactly one BEGIN agc-adapter block (count === 1).
  // This is the direct regression test for the bug that let "appended" fall into
  // the "Created" list instead of "Updated".
  const ws = mkTmp("agc-label-fix-update-");

  const PRIOR_PROSE = "# My Project\n\nPre-existing user content — must survive agc init.\n";
  fs.writeFileSync(path.join(ws, "CLAUDE.md"), PRIOR_PROSE);

  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  // 1. stdout must list CLAUDE.md under Updated, NOT Created.
  assert.match(r.stdout, /Updated:.*CLAUDE\.md/, "stdout must report CLAUDE.md under Updated:");
  assert.doesNotMatch(
    r.stdout,
    /Created:.*CLAUDE\.md/,
    "stdout must NOT report CLAUDE.md under Created: when file pre-existed",
  );

  const after = fs.readFileSync(path.join(ws, "CLAUDE.md"), "utf-8");

  // 2. Prior prose must be preserved.
  assert.ok(
    after.includes("Pre-existing user content — must survive agc init."),
    "pre-existing user prose must be preserved after init",
  );

  // 3. Exactly one BEGIN agc-adapter block must be present.
  const beginCount = (after.match(/<!-- BEGIN agc-adapter -->/g) || []).length;
  assert.equal(beginCount, 1, `CLAUDE.md must have exactly 1 BEGIN agc-adapter block, got ${beginCount}`);
});

test("T-LABEL-FIX complement: agc init reports CLAUDE.md under Created in a truly-fresh dir (over-correction guard)", () => {
  // Contract: when NO CLAUDE.md exists at all, `agc init` must still report it
  // under "Created:" — not "Updated:". Guards against any over-correction that
  // would move every CLAUDE.md outcome into the Updated bucket.
  const ws = mkTmp("agc-label-fix-create-");

  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  assert.match(r.stdout, /Created:.*CLAUDE\.md/, "stdout must report CLAUDE.md under Created: for a fresh dir");
  assert.doesNotMatch(
    r.stdout,
    /Updated:.*CLAUDE\.md/,
    "stdout must NOT report CLAUDE.md under Updated: for a fresh dir",
  );
});

// ---------------------------------------------------------------------------
// Version resolution is cwd-poison-immune
// ---------------------------------------------------------------------------

test("version-poison: stamp and check use the agc package version, not the target workspace's package.json", () => {
  // Contract: `agc init` and `agc check` resolve the version from the agc package
  // itself (via import.meta.url → pkgRoot), NOT from process.cwd(). If a target
  // workspace has its own package.json with a different version, it must be
  // completely ignored. This prevents cross-contamination in monorepos.
  const ws = mkTmp("agc-adapters-version-poison-");

  // Seed a fake package.json in the target workspace that would return v9.9.9
  // if the CLI accidentally read it.
  fs.writeFileSync(
    path.join(ws, "package.json"),
    JSON.stringify({ name: "fake-project", version: "9.9.9" }),
  );

  // init must stamp with the real agc version, not 9.9.9.
  assert.equal(runAgc(ws, ["init"]).status, 0, "init must succeed");

  for (const { rel } of ADAPTERS) {
    const content = fs.readFileSync(path.join(ws, rel), "utf-8");
    assert.ok(
      content.includes(`agc-version: ${AGC_VERSION}`),
      `${rel} must be stamped with agc version ${AGC_VERSION}, not the workspace's 9.9.9`,
    );
    assert.ok(
      !content.includes("agc-version: 9.9.9"),
      `${rel} must NOT be stamped with the workspace's fake version 9.9.9`,
    );
  }

  // check must also compare against the real agc version.
  const r = runAgc(ws, ["check"]);
  assert.equal(r.status, 0, `check must exit 0 (all adapters at agc version ${AGC_VERSION})`);
  assert.match(r.stdout, /agc check.*OK/, "check must print OK, not a stale warning");
});

// =============================================================================
// E100/E101 (T-E100-02) — .current/.config.json "host" upsert + adapter content
// =============================================================================
// Spec-to-Test map (docs/backlog.md E100/E101, tasks.md T-E100-01/T-E100-02):
//   T-E100-01 (a) configTemplate carries "host": "claude-code"
//     -> covered by test/p0-onboarding-lite-default.test.mjs AC1 (re-pinned)
//   T-E100-01 (b) existing-file upsert path, preserving every other key +
//     the file's own formatting -> "config class (2)" below
//   T-E100-01 (c) an existing declared host is NEVER overwritten; malformed
//     JSON is never clobbered -> "config class (3)"/"config class (4)" below
//   T-E101-01 claude.md carries the judge-dispatch obligation; codex.md /
//     antigravity.md do not -> "adapter-content class" below
//   Dogfood payoff: a host written by agc init reaches the task-tool capability
//     check through the real config loader (review round 1 gap #9 / round 2 gap #6) -> "dogfood
//     payoff" below
// Re-derivation note (2026-08-31, qa-engineer): round 2/3 of
// review_reports/review_T-E100-01.md both assert the reparse guard at
// bin/agc-init.mjs:228-236 is EXACTLY sufficient against a wrong-occurrence
// splice (a nested "host" key sorting earlier in the file than the real
// top-level one). That claim was re-derived from source here — not accepted
// on the strength of two review rounds agreeing — and is pinned as its own
// class ("reparse-guard proof" below) rather than left to stand on prose.

function readConfig(ws) {
  return fs.readFileSync(path.join(ws, ".current", ".config.json"), "utf-8");
}

function seedConfig(ws, content) {
  fs.mkdirSync(path.join(ws, ".current"), { recursive: true });
  fs.writeFileSync(path.join(ws, ".current", ".config.json"), content);
}

function findTmpFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"));
}

// --- config class (1)/(2)/(3)/(4) — the brief's four named cases ----------

test("E100 config class (1): fresh agc init writes host:\"claude-code\" into a brand-new .current/.config.json", () => {
  const ws = mkTmp("e100-cfg-fresh-");
  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  const cfg = JSON.parse(readConfig(ws));
  // schema_version is now 2, and a fresh workspace outside git (this fixture
  // uses a plain mkdtemp, not a git repo) defaults to "artifacts": "local"
  // (init --artifacts flag, e106 AC14).
  assert.deepEqual(cfg, { schema_version: 2, host: "claude-code", artifacts: "local" });
  assert.match(r.stdout, /Created:.*\.current\/\.config\.json/, "fresh config must be reported under Created:");
});

test("E100 config class (2): an EXISTING host-less .config.json gains \"host\" on re-run, with schema_version and every other key preserved, and stays valid JSON", () => {
  const ws = mkTmp("e100-cfg-existing-nohost-");
  seedConfig(
    ws,
    JSON.stringify({ schema_version: 1, cutApprovalAutoTier: { "T1": "auto" }, driftBaselineIds: ["a", "b", "c"] }, null, 2) + "\n",
  );
  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  assert.match(r.stdout, /Updated:.*\.current\/\.config\.json/, "must be reported under Updated:, not Skipped");

  const raw = readConfig(ws);
  const cfg = JSON.parse(raw); // must still be valid JSON
  // This fixture's schema_version (1) is NOT rewritten by the CLI (only the
  // server's lazy migration bumps it); the fixture runs outside git, so
  // "artifacts" is independently upserted to "local" alongside "host"
  // (init --artifacts flag, e106 AC5/AC14).
  assert.deepEqual(cfg, {
    schema_version: 1,
    cutApprovalAutoTier: { "T1": "auto" },
    driftBaselineIds: ["a", "b", "c"],
    host: "claude-code",
    artifacts: "local",
  });
});

test("E100 config class (3): an existing \"host\": \"cursor\" is preserved (over-correction guard); artifacts is independently upserted since none was declared", () => {
  // e106-init-artifacts-flag: this fixture (outside git, no "artifacts" key
  // declared) now ALSO gains "artifacts": "local" on the same run — the file
  // is no longer byte-identical and the bucket is "Updated", not "Skipped".
  // The host-specific guarantee (never overwritten) is unaffected and is
  // asserted directly below.
  const ws = mkTmp("e100-cfg-cursor-");
  const before = JSON.stringify({ schema_version: 1, host: "cursor" }, null, 2) + "\n";
  seedConfig(ws, before);
  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  const cfg = JSON.parse(readConfig(ws));
  assert.equal(cfg.host, "cursor", "a deliberate non-Claude-Code host declaration must never be overwritten");
  assert.deepEqual(cfg, { schema_version: 1, host: "cursor", artifacts: "local" });
  assert.match(
    r.stdout,
    /Updated:.*\.current\/\.config\.json/,
    "artifacts was newly added (host itself untouched), so the whole-file report is Updated, not Skipped",
  );
});

test("E100 config class (4): malformed/unparseable .config.json is never clobbered — exit 0, byte-identical, reported under 'Not updated'", () => {
  const ws = mkTmp("e100-cfg-malformed-");
  const before = "{schema_version: 1,}"; // unquoted key + trailing comma: invalid JSON
  seedConfig(ws, before);
  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, "a pre-existing broken config must not hard-fail agc init");
  assert.equal(readConfig(ws), before, "malformed config must be left byte-identical");
  assert.match(
    r.stdout,
    /Not updated \(rejected, see warnings\):.*\.current\/\.config\.json/,
    "malformed config must be reported in its own bucket, not lumped into Skipped",
  );
  assert.match(r.stderr, /could not add "host"/, "the specific reason must be on stderr");
});

// --- falsy-host repair class ------------------------------------------------

test("E100: falsy host values (\"\", null, false, 0) are all treated as absent and repaired to \"claude-code\", not silently left declared", () => {
  for (const falsy of ["", null, false, 0]) {
    const ws = mkTmp("e100-falsy-");
    const before = { schema_version: 1, host: falsy, driftBaselineIds: ["x"] };
    seedConfig(ws, JSON.stringify(before));
    const r = runAgc(ws, ["init"]);
    assert.equal(r.status, 0, `exit code for host=${JSON.stringify(falsy)} (stderr=${r.stderr})`);
    assert.match(
      r.stdout,
      /Updated:.*\.current\/\.config\.json/,
      `host=${JSON.stringify(falsy)} must be repaired (reported Updated), not treated as a deliberate declaration`,
    );
    const cfg = JSON.parse(readConfig(ws));
    // e106-init-artifacts-flag: this fixture runs outside git with no
    // "artifacts" key declared, so it also gains "artifacts": "local".
    assert.deepEqual(
      cfg,
      { schema_version: 1, host: "claude-code", driftBaselineIds: ["x"], artifacts: "local" },
      `host=${JSON.stringify(falsy)} must repair to "claude-code" with every other key preserved`,
    );
  }
});

// --- reparse-guard proof (re-derived, not ratified from the review) --------

test("E100 reparse-guard proof: truthy-but-unusable host shapes a plain !host check would miss are still repaired or safely rejected", () => {
  // A number is truthy but not the consumer's accepted shape (tools/config.ts
  // requires typeof === "string" && length > 0) — must repair like any other
  // unusable value.
  const wsNum = mkTmp("e100-guard-number-");
  seedConfig(wsNum, JSON.stringify({ schema_version: 1, host: 42 }));
  const rNum = runAgc(wsNum, ["init"]);
  assert.equal(rNum.status, 0);
  // e106-init-artifacts-flag: outside git, no "artifacts" declared -> also
  // gains "artifacts": "local".
  assert.deepEqual(JSON.parse(readConfig(wsNum)), { schema_version: 1, host: "claude-code", artifacts: "local" });
  assert.match(rNum.stdout, /Updated:.*\.current\/\.config\.json/);
});

test("E100 reparse-guard proof: a wrong-occurrence splice never proceeds — nested \"host\" sorting before a falsy top-level \"host\" leaves the file byte-identical", () => {
  // This is THE case that proves bin/agc-init.mjs's reparse guard
  // (:228-236) is load-bearing, and not merely the `!m` (no-match) branch:
  // KEY_VALUE_RE is unanchored and matches the FIRST "host": <scalar> in the
  // file textually, which here is the NESTED key, not the real top-level
  // one. If the guard were absent (or written as a plain `!reparsed.host`
  // falsy check instead of the actual "not a non-empty string" test), this
  // input would splice the wrong occurrence and either corrupt the file or
  // falsely report success. Independently re-derived and run against the
  // real CLI (not just read from the source) per the QA brief's explicit
  // instruction not to ratify the review's proof unread.
  // e106-init-artifacts-flag: "artifacts" has no shadow-key ambiguity in this
  // fixture (the key appears nowhere), so it independently upserts to
  // "local" on the same run — the whole-file bucket becomes "Updated", not
  // "Not updated". The host-specific reparse-guard property (never
  // splice-corrupted, even though the wrong "host" occurrence is textually
  // first) is asserted directly below and is unaffected.
  const ws = mkTmp("e100-guard-shadowed-");
  const before = JSON.stringify({ host: { a: 1 }, n: { host: "x" } });
  seedConfig(ws, before);
  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);
  const cfg = JSON.parse(readConfig(ws));
  assert.deepEqual(cfg.host, { a: 1 }, "host must never be splice-corrupted by the wrong-occurrence match");
  assert.deepEqual(cfg.n, { host: "x" }, "the nested shadow key must be untouched");
  assert.equal(cfg.artifacts, "local", "artifacts is independently upserted (no shadow-key ambiguity for this key)");
  assert.match(
    r.stderr,
    /could not add "host"/,
    "the shadowed-key class must still be rejected for host specifically, never falsely reported as fixed",
  );
});

// --- formatting-preservation class ------------------------------------------

test("E100 formatting preservation: CRLF line endings, tab indentation, single-line, and {} are each preserved except for the one spliced line", () => {
  const cases = [
    { name: "CRLF", content: '{\r\n  "schema_version": 1,\r\n  "driftBaselineIds": ["a","b"]\r\n}\r\n' },
    { name: "tab-indent", content: '{\n\t"schema_version": 1\n}\n' },
    { name: "single-line", content: '{"schema_version":1,"driftBaselineIds":["a","b","c"]}' },
    { name: "empty-object", content: "{}" },
  ];
  for (const { name, content } of cases) {
    const ws = mkTmp(`e100-fmt-${name}-`);
    seedConfig(ws, content);
    const r = runAgc(ws, ["init"]);
    assert.equal(r.status, 0, `${name}: exit code (stderr=${r.stderr})`);
    const after = readConfig(ws);
    // Must still parse and carry the correct logical content.
    const parsed = JSON.parse(after);
    assert.equal(parsed.host, "claude-code", `${name}: host must be present`);
    if (content.includes("\r\n")) {
      assert.ok(after.includes("\r\n"), `${name}: CRLF line endings must be preserved`);
    }
    if (content.includes("\t")) {
      assert.ok(after.includes("\t"), `${name}: tab indentation must be preserved`);
    }
    if (!content.includes("\n") && name === "single-line") {
      assert.equal(after.split("\n").length, 1, `${name}: must stay single-line`);
    }
  }
});

test("E100 formatting preservation: a large real-shaped driftBaselineIds array is left byte-identical apart from the inserted host + artifacts lines", () => {
  const bigArray = Array.from({ length: 200 }, (_, i) => `T${i}`);
  const ws = mkTmp("e100-fmt-large-array-");
  const before = JSON.stringify({ schema_version: 1, driftBaselineIds: bigArray }, null, 2) + "\n";
  seedConfig(ws, before);
  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0);
  const after = readConfig(ws);
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  // e106-init-artifacts-flag: this fixture (outside git, no "artifacts" key)
  // now gets TWO keys spliced in — "artifacts" then "host" — each inserted
  // right after the opening brace, so exactly two lines are added, not one.
  assert.equal(afterLines.length, beforeLines.length + 2, "exactly two lines must be added (artifacts + host)");
  // Every array-entry line must be byte-identical between before and after
  // (both keys are inserted right after the opening brace, so array lines
  // are shifted by a fixed offset but otherwise untouched).
  const beforeArrayLines = beforeLines.filter((l) => l.trim().startsWith('"T'));
  const afterArrayLines = afterLines.filter((l) => l.trim().startsWith('"T'));
  assert.deepEqual(afterArrayLines, beforeArrayLines, "driftBaselineIds array lines must be byte-identical");
});

// --- no .tmp residue ---------------------------------------------------------

test("E100: no *.tmp residue is left in .current/ after any config mutation (updated, falsy-repair, or rejected malformed)", () => {
  const scenarios = [
    { name: "updated", content: JSON.stringify({ schema_version: 1 }) },
    { name: "falsy-repair", content: JSON.stringify({ schema_version: 1, host: "" }) },
    { name: "cursor-skip", content: JSON.stringify({ schema_version: 1, host: "cursor" }) },
    { name: "malformed", content: "{not json" },
  ];
  for (const { name, content } of scenarios) {
    const ws = mkTmp(`e100-tmp-residue-${name}-`);
    seedConfig(ws, content);
    const r = runAgc(ws, ["init"]);
    assert.equal(r.status, 0, `${name}: exit code (stderr=${r.stderr})`);
    const residue = findTmpFiles(path.join(ws, ".current"));
    assert.deepEqual(residue, [], `${name}: no .tmp file may remain in .current/, found: ${residue.join(", ")}`);
  }
});

// --- CLAUDE.md atomic-write prose survival (T-E100-03) ---------------------

test("T-E100-03: CLAUDE.md adopter prose survives the atomic write on BOTH mutating branches (\"updated\" and \"appended\"), and no CLAUDE.md.*.tmp remains", () => {
  // "appended" branch: file exists, no agc block yet.
  const wsAppended = mkTmp("e100-claude-appended-");
  const proseAppended = "# Adopter project\n\nSome custom prose above.\n\nMore custom prose below.\n";
  fs.writeFileSync(path.join(wsAppended, "CLAUDE.md"), proseAppended);
  const rA = runAgc(wsAppended, ["init"]);
  assert.equal(rA.status, 0);
  const afterAppended = fs.readFileSync(path.join(wsAppended, "CLAUDE.md"), "utf-8");
  assert.ok(afterAppended.includes("Some custom prose above."), "appended: prose above must survive");
  assert.ok(afterAppended.includes("More custom prose below."), "appended: prose below must survive");
  assert.equal(findTmpFiles(wsAppended).length, 0, "appended: no CLAUDE.md.*.tmp residue in workspace root");

  // "updated" branch: file exists WITH an agc block already, plus prose both
  // above and below the markers.
  const wsUpdated = mkTmp("e100-claude-updated-");
  const first = runAgc(wsUpdated, ["init"]);
  assert.equal(first.status, 0);
  const claudePath = path.join(wsUpdated, "CLAUDE.md");
  const seeded = fs.readFileSync(claudePath, "utf-8");
  fs.writeFileSync(
    claudePath,
    "# Adopter project\n\nProse above the block.\n\n" + seeded + "\n\nProse below the block.\n",
  );
  const rU = runAgc(wsUpdated, ["init"]);
  assert.equal(rU.status, 0);
  const afterUpdated = fs.readFileSync(claudePath, "utf-8");
  assert.ok(afterUpdated.includes("Prose above the block."), "updated: prose above must survive");
  assert.ok(afterUpdated.includes("Prose below the block."), "updated: prose below must survive");
  const beginCount = (afterUpdated.match(/<!-- BEGIN agc-adapter -->/g) || []).length;
  assert.equal(beginCount, 1, "updated: exactly one BEGIN marker must remain");
  assert.equal(findTmpFiles(wsUpdated).length, 0, "updated: no CLAUDE.md.*.tmp residue in workspace root");
});

// --- symlinked CLAUDE.md is now written THROUGH, not replaced (E102 R3-A) ---

test("E102/R3-A: a symlinked CLAUDE.md is written through the link (fs.realpathSync resolves target before deriving tmpPath) — link, prose, and mode all survive", () => {
  // Inverts the prior "KNOWN BEHAVIOUR (R3-A)" pin, which documented the
  // pre-fix defect (fs.renameSync replacing the link itself with a detached
  // regular file, leaving the canonical target stale forever). Decided by
  // the human 2026-09-16 (docs/backlog.md E102 row / plan section 8
  // decision E): symlinks ARE a supported layout, so this is no longer a
  // documented limitation to leave undisturbed — it is a regression to
  // catch. atomicWriteFile now resolves `target` via fs.realpathSync before
  // deriving tmpPath, so renameSync lands on the CANONICAL path and the
  // link is never touched. Verified end-to-end by code-reviewer round 1/2
  // (review_reports/review_T-E102-01.md) against the real binary; this test
  // makes that verification a standing, re-run-on-every-CI-build gate
  // rather than a one-time manual observation, and it inverts cleanly: the
  // old assertions (linkIsSymlink === false, canonicalStillHasOldBlock ===
  // true) are now false by design, which is exactly what "pinned so a
  // change here is deliberate, not silent" was for.
  const ws = mkTmp("e102-symlink-through-");
  fs.mkdirSync(path.join(ws, "dotfiles"), { recursive: true });
  const canonical = path.join(ws, "dotfiles", "CLAUDE.md");
  fs.writeFileSync(
    canonical,
    "# Canonical\nprose above\n\n<!-- BEGIN agc-adapter -->\nold block\n<!-- END agc-adapter -->\n\nprose below\n",
  );
  fs.chmodSync(canonical, 0o600); // R3-C: mode preservation must survive the write-through too
  const link = path.join(ws, "CLAUDE.md");
  fs.symlinkSync(path.join("dotfiles", "CLAUDE.md"), link);

  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  const linkIsSymlink = fs.lstatSync(link).isSymbolicLink();
  assert.equal(linkIsSymlink, true, "the CLAUDE.md symlink must survive as a symlink, not be replaced by a regular file");

  const canonicalContent = fs.readFileSync(canonical, "utf-8");
  assert.ok(!canonicalContent.includes("old block"), "the canonical symlink target must receive the NEW agc block, not keep the stale one");
  assert.ok(canonicalContent.includes("prose above"), "adopter prose above the markers must survive the write-through");
  assert.ok(canonicalContent.includes("prose below"), "adopter prose below the markers must survive the write-through");
  const beginCount = (canonicalContent.match(/<!-- BEGIN agc-adapter -->/g) || []).length;
  assert.equal(beginCount, 1, "exactly one BEGIN marker must remain in the canonical file");

  const mode = fs.statSync(canonical).mode & 0o777;
  assert.equal(mode, 0o600, "R3-C: a deliberately-restricted 0600 canonical file must not silently widen to 0644 on write-through");

  assert.equal(findTmpFiles(path.join(ws, "dotfiles")).length, 0, "no CLAUDE.md.*.tmp residue beside the resolved (canonical) target");
  assert.equal(findTmpFiles(ws).length, 0, "no CLAUDE.md.*.tmp residue in the workspace root either");

  // agc check must now report OK against the REAL file, not a detached
  // copy — this is the observable end of the silent-failure chain of a
  // symlinked CLAUDE.md being replaced by a detached copy (E102).
  const check = spawnSync(process.execPath, [AGC_INIT, "check"], { cwd: ws, encoding: "utf-8" });
  assert.equal(check.status, 0, `agc check (stderr=${check.stderr})`);
});

// --- dangling CLAUDE.md symlink is repaired, not left silently broken (E102, backlog 0f) ---

test("E102/backlog-0f: agc init against a DANGLING CLAUDE.md symlink repairs it — exit 0, link preserved, canonical target created with the block (bin/agc-init.mjs:88-89)", () => {
  // The dangling-symlink obligation (backlog row 0f), pinned against the shape
  // code-reviewer verified end-to-end and named explicitly as pinnable
  // (review_reports/review_T-E102-01.md round 2, "Note for qa"):
  // fs.realpathSync(target) throws ENOENT on a dangling symlink, but no
  // call site ever reaches atomicWriteFile with one — fs.existsSync(target)
  // is false for a dangling symlink exactly as for a plain missing path, so
  // writeClaudeBlock's `!existsSync` branch (bin/agc-init.mjs:88-89) fires
  // first: fs.writeFileSync follows the dangling link and creates the
  // canonical file, leaving the link itself intact. This discharges decision E's
  // "fail-closed on a dangling symlink" point, end-to-end as a
  // write-through REPAIR rather than a refusal — ratified by code-reviewer
  // as "better but different, not a regression" (round 2 Architecture
  // section) and relayed to the human as a divergence record, not an
  // escalation. The realpathSync ENOENT catch inside atomicWriteFile itself
  // is NOT exercised by this test — it is unreachable from every current
  // call site and atomicWriteFile is not exported, so its "(dangling)"
  // diagnostic string cannot be pinned through the public CLI surface.
  const ws = mkTmp("e102-dangling-");
  fs.mkdirSync(path.join(ws, "dotfiles"), { recursive: true }); // parent dir exists; the file inside it does NOT -> the link is dangling, not doubly-broken
  const link = path.join(ws, "CLAUDE.md");
  fs.symlinkSync(path.join("dotfiles", "CLAUDE.md"), link);

  const r = runAgc(ws, ["init"]);
  assert.equal(r.status, 0, `exit code (stderr=${r.stderr})`);

  const linkStat = fs.lstatSync(link);
  assert.ok(linkStat.isSymbolicLink(), "the dangling CLAUDE.md path must still be a symlink after agc init, not replaced");

  const canonicalPath = path.join(ws, "dotfiles", "CLAUDE.md");
  assert.ok(fs.existsSync(canonicalPath), "the symlink's target must now exist — agc init repairs the dangling link rather than refusing");
  const canonicalContent = fs.readFileSync(canonicalPath, "utf-8");
  assert.match(canonicalContent, /<!-- BEGIN agc-adapter -->/, "the newly-created canonical file must contain the agc adapter block");
  assert.match(canonicalContent, /<!-- END agc-adapter -->/, "the newly-created canonical file must contain the agc adapter block");
});

// --- a failed write strands no .tmp and leaves target + link intact (E102 R3-C) ---

test("E102/R3-C: a failed write (read-only canonical directory) propagates the error and strands no .tmp, leaving the canonical file and the symlink untouched", () => {
  // code-reviewer round 1 verified this fixture manually ("Read-only
  // canonical dir (tmp never created) -> EACCES propagates, canonical
  // unchanged, link intact, no stray file") as one of two failure
  // branches of that guarantee; this pins it as an automated regression test. The other
  // branch reviewer verified ("rename-fails-after-tmp-exists -> EISDIR
  // propagates, tmp cleaned up") requires resolvedTarget to already be a
  // directory at rename time while surviving an earlier
  // fs.readFileSync(target, "utf-8") as text -- a contradiction at every
  // current call site (writeClaudeBlock and upsertHostKey both read the
  // target as text before atomicWriteFile is ever called), and
  // atomicWriteFile is not exported for a direct unit-level test. That
  // variant is therefore not reachable through the public CLI surface,
  // same class of limitation as the unreachable "(dangling)" diagnostic
  // noted in the dangling-symlink test above.
  const ws = mkTmp("e102-failed-write-");
  fs.mkdirSync(path.join(ws, "dotfiles"), { recursive: true });
  const canonical = path.join(ws, "dotfiles", "CLAUDE.md");
  const before = "# Canonical\nprose above\n\n<!-- BEGIN agc-adapter -->\nold block\n<!-- END agc-adapter -->\n\nprose below\n";
  fs.writeFileSync(canonical, before);
  const link = path.join(ws, "CLAUDE.md");
  fs.symlinkSync(path.join("dotfiles", "CLAUDE.md"), link);

  const dotfilesDir = path.join(ws, "dotfiles");
  fs.chmodSync(dotfilesDir, 0o500); // r-x: readable/traversable, but no write -> tmp file can never be created
  try {
    const r = runAgc(ws, ["init"]);
    assert.notEqual(r.status, 0, "a write that cannot even create its tmp file must propagate as a failure, not report success");
    assert.match(r.stderr, /EACCES|permission denied/i, `stderr (${r.stderr}) should surface the permission failure`);

    assert.equal(findTmpFiles(dotfilesDir).length, 0, "no CLAUDE.md.*.tmp may be stranded when the write never got the chance to create one");
    const canonicalContent = fs.readFileSync(canonical, "utf-8");
    assert.equal(canonicalContent, before, "the canonical file must be byte-identical to before the failed write");
    assert.ok(fs.lstatSync(link).isSymbolicLink(), "the symlink must remain intact after a failed write");
  } finally {
    fs.chmodSync(dotfilesDir, 0o755); // restore for cleanup (may be bypassed by root)
  }
});

// --- adapter-content class: claude.md carries the judge-dispatch obligation, others do not (T-E101-01) ---

test("E101: templates/agent-adapters/claude.md states the judge-dispatch obligation naming code-reviewer and qa-engineer; codex.md and antigravity.md do NOT", () => {
  const tplDir = path.join(PROJECT_ROOT, "templates", "agent-adapters");
  const claudeTpl = fs.readFileSync(path.join(tplDir, "claude.md"), "utf-8");
  const codexTpl = fs.readFileSync(path.join(tplDir, "codex.md"), "utf-8");
  const antigravityTpl = fs.readFileSync(path.join(tplDir, "antigravity.md"), "utf-8");

  // claim class: /teamwork (or any agc role prompt) is the standing request
  // for subagent dispatch, and code-reviewer/qa-engineer MUST use Task.
  assert.match(claudeTpl, /standing request/i, "claude.md must state the standing-request claim");
  assert.match(
    claudeTpl,
    /code-reviewer.{0,40}qa-engineer.{0,40}(MUST|must).{0,20}Task|qa-engineer.{0,40}code-reviewer.{0,40}(MUST|must).{0,20}Task/,
    "claude.md must name code-reviewer and qa-engineer as required to use Task",
  );

  for (const [name, tpl] of [["codex.md", codexTpl], ["antigravity.md", antigravityTpl]]) {
    assert.doesNotMatch(
      tpl,
      /standing request/i,
      `${name} must NOT carry the judge-dispatch obligation — asserting a Task-tool capability neither host reliably has would be a false promise`,
    );
  }
});

// --- dogfood payoff (the mechanism must actually pay off) -------------------

test("E100 dogfood payoff: agc-init-written host:\"claude-code\" flows through to hostCapabilitiesFor().taskTool === true via the real loadConfig() pipeline", async () => {
  // The QA gaps from all three review rounds converge on the same point:
  // presence of the "host" key is the MECHANISM, not the acceptance — the
  // acceptance is that the coordinator's host-tagged fragments actually
  // render. prompts/skill-manifest.ts's own test suite (test/skill-manifest
  // .test.mjs) thoroughly covers composeSkill given a synthetic
  // hostCapabilitiesFor() result; what is untested anywhere else is the
  // END of the pipeline that begins at `agc init` writing the real file on
  // disk. This test closes that gap: real CLI write -> real loadConfig()
  // read -> real hostCapabilitiesFor().
  const { loadConfig } = await import(path.join(PROJECT_ROOT, "dist", "tools", "config.js"));
  const { hostCapabilitiesFor, composeSkill } = await import(
    path.join(PROJECT_ROOT, "dist", "prompts", "skill-manifest.js")
  );

  // Fresh workspace via the real CLI.
  const wsFresh = mkTmp("e100-payoff-fresh-");
  assert.equal(runAgc(wsFresh, ["init"]).status, 0);
  const capsFresh = hostCapabilitiesFor(loadConfig(wsFresh).host);
  assert.equal(capsFresh.taskTool, true, "a fresh agc-init workspace must resolve taskTool: true");

  // Pre-existing host-less workspace, re-run through the real CLI (the
  // dogfood migration shape).
  const wsMigrated = mkTmp("e100-payoff-migrated-");
  seedConfig(wsMigrated, JSON.stringify({ schema_version: 1 }));
  const capsBefore = hostCapabilitiesFor(loadConfig(wsMigrated).host);
  assert.equal(capsBefore.taskTool, false, "sanity: pre-migration workspace must resolve taskTool: false");
  assert.equal(runAgc(wsMigrated, ["init"]).status, 0);
  const capsAfter = hostCapabilitiesFor(loadConfig(wsMigrated).host);
  assert.equal(capsAfter.taskTool, true, "post-migration (re-run agc init) workspace must resolve taskTool: true");

  // Confirm the capability actually changes composed output content, not
  // just the boolean flag — this is the "renders" half of the payoff claim.
  const readContent = (f) => fs.readFileSync(path.join(PROJECT_ROOT, "content", f), "utf-8");
  const composedWithHost = composeSkill("skill-coordinator.md", capsAfter, readContent);
  const composedWithoutHost = composeSkill("skill-coordinator.md", capsBefore, readContent);
  assert.ok(
    composedWithHost.length > composedWithoutHost.length,
    "composed coordinator skill must be strictly larger once agc-init-written host resolves to taskTool: true",
  );
  assert.notEqual(composedWithHost, composedWithoutHost, "host-tagged fragment content must actually differ, not just be present/absent as a flag");
});

// --- research/ tracked-binary advisory (E104 prevention (c)) ----------------
//
// Two halves, per review_reports/review_T-E104-03.md (carried forward from
// code-reviewer Round 1 and Round 2, unaddressed by sr-engineer/code-reviewer
// by design — test authorship is qa-engineer's under Constitution §2):
//
//   (i)  a behavioural assertion on a fixture repo, including a non-ASCII
//        filename — the exact case Round 1 found silently missed because
//        `git ls-files` (no `-z`) C-quotes any non-ASCII path under git's
//        default core.quotePath=true, so the $-anchored allowlist regex
//        never matches the quoted line. A regression back to that shape
//        would be silent without this case.
//   (ii) a standing assertion that THIS repo has zero tracked binaries under
//        research/ — the ratchet docs/backlog.md promises ("a clean ratchet
//        that goes green on day one"). This must NOT be implemented via a
//        naive `git ls-files` + `split("\n")` re-implementation, or it
//        reintroduces the exact core.quotePath blind spot (i) closes while
//        looking green — so it uses `-z` + NUL split here too, and reads
//        the allowlist regex's literal text out of bin/agc-init.mjs (never
//        retyped) so the two can never silently drift apart.

test("E104(i): agc check warns on tracked binaries under research/, INCLUDING a non-ASCII (CJK) filename, and stays silent on a text decoy and on a nested out-of-pathspec binary", () => {
  // Contract: checkResearchBinaries() must catch the exact class of file
  // this control exists for (a third-party client asset with a localized
  // name), not just the ASCII-safe fixture — that was the whole Round 1
  // defect. Zero exit throughout: the check is advisory, never a hard fail.
  const ws = mkTmp("e104-research-binaries-");
  execSync("git init -q", { cwd: ws });
  execSync("git config user.email a@b.c && git config user.name t", { cwd: ws });

  fs.mkdirSync(path.join(ws, "research", "assets"), { recursive: true });
  fs.mkdirSync(path.join(ws, "sub", "research"), { recursive: true });

  const asciiBinary = path.join(ws, "research", "assets", "leak.png");
  const cjkBinary = path.join(ws, "research", "assets", "螢幕截圖.png");
  const textDecoy = path.join(ws, "research", "notes.md");
  const nestedBinary = path.join(ws, "sub", "research", "deep.png");

  fs.writeFileSync(asciiBinary, "not-really-a-png-but-extension-is-what-matters");
  fs.writeFileSync(cjkBinary, "not-really-a-png-but-extension-is-what-matters");
  fs.writeFileSync(textDecoy, "# just prose, not a tracked binary");
  fs.writeFileSync(nestedBinary, "outside the research/ pathspec anchored at cwd");

  execSync("git add -A", { cwd: ws });
  execSync('git commit -q -m "fixture"', { cwd: ws });

  const r = runAgc(ws, ["check"]);
  assert.equal(r.status, 0, `exit code must stay 0 — advisory only (stderr=${r.stderr})`);

  assert.match(
    r.stderr,
    /tracked binary under research\/: research\/assets\/leak\.png/,
    "must warn on the ASCII-named tracked binary",
  );
  assert.match(
    r.stderr,
    /tracked binary under research\/: research\/assets\/螢幕截圖\.png/,
    "must warn on the CJK-named tracked binary — this is the exact case Round 1's non--z git ls-files silently missed under core.quotePath=true",
  );
  assert.doesNotMatch(
    r.stderr,
    /research\/notes\.md/,
    "must stay silent on a tracked text file — extension allowlist, not content-sniff",
  );
  assert.doesNotMatch(
    r.stderr,
    /sub\/research\/deep\.png/,
    "must stay silent on a binary nested under sub/research/ — the pathspec is cwd-anchored to top-level research/ only",
  );
});

test("E104(ii): this repo has zero tracked binaries under research/ (the day-one-green ratchet), verified via -z + NUL split so the assertion itself cannot inherit the core.quotePath blind spot", () => {
  // Contract: the ratchet docs/backlog.md promises is that THIS repo's own
  // research/ tree carries zero files matching the binary allowlist, not
  // merely that the CLI's warning logic works on a synthetic fixture (that
  // is the fixture-based test's job). Implemented independently of checkResearchBinaries()
  // itself so a future regression in the shipped check does not silently
  // blind this assertion too — but still via `-z` + NUL split, matching the
  // production implementation, per the explicit code-reviewer warning that
  // a naive `git ls-files` + `split("\n")` re-implementation would
  // reintroduce the exact non-ASCII blind spot the fixture-based test above exists to catch.
  const src = fs.readFileSync(AGC_INIT, "utf-8");
  const reLiteralMatch = src.match(/const RESEARCH_BINARY_RE = (\/.*\/i);/);
  assert.ok(
    reLiteralMatch,
    "must find the RESEARCH_BINARY_RE literal in bin/agc-init.mjs — if this fails, the constant was renamed or reshaped and this test needs updating alongside it",
  );
  // Reconstructed from the source literal (never retyped) so the allowlist
  // used here can never silently drift from the one the shipped CLI uses.
  const RESEARCH_BINARY_RE = new Function(`return ${reLiteralMatch[1]};`)();

  const r = spawnSync("git", ["ls-files", "-z", "--", "research"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  });
  assert.equal(r.status, 0, `git ls-files must succeed against the project repo (stderr=${r.stderr})`);

  const trackedResearchFiles = r.stdout.split("\0").filter((line) => line.length > 0);
  assert.ok(trackedResearchFiles.length > 0, "sanity: research/ must actually have tracked files, or this assertion is vacuous");

  const trackedBinaries = trackedResearchFiles.filter((f) => RESEARCH_BINARY_RE.test(f));
  assert.deepEqual(
    trackedBinaries,
    [],
    `research/ must carry zero tracked binaries (measured baseline 2026-09-14: 0) — found: ${JSON.stringify(trackedBinaries)}`,
  );
});

// --- Linked-worktree evidence advisory (bin/agc-init.mjs
// checkWorktreeEvidence(), :497-706) (E111) -------------------------------
//
// This repo cannot reproduce the defect the advisory exists to catch — all
// three evidence dirs (qa_reports/, review_reports/, specs/) are tracked
// here with real content — so a FIXTURE is mandatory, exactly as the research/
// tracked-binary advisory tests above did in this same file.
//
// The contract is the 23-row behaviour matrix in
// review_reports/review_T-E111-01.md (round 3 is binding: it governs wherever
// round 2's text conflicts). Per that round's explicit ruling: assert ONLY on
// observable warn/silent stderr text + exit code, NEVER on which git
// plumbing command fires — the ignore mechanism changed twice under
// measurement during review (round 2's own suggested `git check-ignore -q
// <dir>` was itself found broken against the linked-worktree fixture), so a test
// grepping for `check-ignore` or `ls-files --others --ignored` would freeze
// a mechanism this ticket exists to keep correctable.
//
// A "linked worktree" only exists once `.git` is a FILE (git's gitfile),
// which requires a real primary repo plus `git worktree add` — a plain
// `git init` temp dir (as the research/ advisory tests above use) has `.git` as a directory and is
// silent by construction (isLinkedWorktree() returns false). That absence
// of gitfile-ness is itself row P1 below.

function mkWorktreeFixture(prefix) {
  const primary = mkTmp(`${prefix}primary-`);
  execSync("git init -q", { cwd: primary });
  execSync("git config user.email a@b.c && git config user.name t", { cwd: primary });
  fs.writeFileSync(path.join(primary, "README.md"), "primary checkout\n");
  execSync("git add -A && git commit -q -m init", { cwd: primary });

  // `git worktree add` creates its target path itself — it must not exist
  // yet. mkdtempSync gives us a guaranteed-unique path cheaply; remove the
  // directory it created and hand that same unique path to `worktree add`.
  const worktree = mkTmp(`${prefix}wt-`);
  fs.rmdirSync(worktree);
  execSync(`git worktree add -q -b ${prefix.replace(/[^a-zA-Z0-9-]/g, "")}branch ${JSON.stringify(worktree)}`, {
    cwd: primary,
  });
  return { primary, worktree };
}

test("E111(i): agc check warns on a plain untracked real evidence dir inside a linked worktree (W1), and does NOT go silent when a force-added tracked .gitkeep sits beside real untracked evidence in a gitignored dir (W3) — the C1 hole a directory-level ignore test would reopen", () => {
  const { worktree } = mkWorktreeFixture("e111-w1w3-");

  // W1: plain untracked real dir — nothing tracked, not gitignored.
  fs.mkdirSync(path.join(worktree, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "qa_reports", "review_T1.md"), "evidence\n");

  // W3: gitignored dir + force-added tracked .gitkeep + untracked real
  // evidence sitting right next to it. Round 1's C1 hole: a directory-level
  // membership test (`git ls-files -- rel`) sees the tracked .gitkeep and
  // calls the whole directory "tracked", staying silent while real evidence
  // sits untracked beside it. Round 2's own proposed fix (`git check-ignore
  // -q` on the DIRECTORY) was itself measured broken on this exact shape in
  // round 3 review — reopening C1 while claiming to close R2 — which is
  // exactly why this test must never pin the plumbing, only the outcome.
  fs.writeFileSync(path.join(worktree, ".gitignore"), "review_reports/\n");
  fs.mkdirSync(path.join(worktree, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "review_reports", ".gitkeep"), "");
  execSync("git add -f .gitignore review_reports/.gitkeep", { cwd: worktree });
  execSync('git commit -q -m "gitignore + forced .gitkeep"', { cwd: worktree });
  fs.writeFileSync(path.join(worktree, "review_reports", "review_T2.md"), "evidence\n");

  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, `advisory must never affect the exit code (stderr=${r.stderr})`);
  assert.match(
    r.stderr,
    /qa_reports\/ is a real, untracked directory in a linked git worktree/,
    "W1: plain untracked real dir must warn",
  );
  assert.match(
    r.stderr,
    /review_reports\/ is a real, untracked directory in a linked git worktree/,
    "W3: gitignored dir with a tracked .gitkeep + untracked evidence must still warn — this is C1; closed by a per-untracked-file ignore test, not a per-directory one",
  );
});

test("E111(ii): agc check stays silent when an evidence dir is a symlink resolving OUTSIDE the worktree (S1) — this is the exact state the E111 bootstrap rule (content/coord-03-core-fallback.md) produces, and a false positive here would train readers to ignore the check", () => {
  const { primary, worktree } = mkWorktreeFixture("e111-s1-");
  const target = path.join(primary, "qa_reports"); // "linked back to primary" per the bootstrap obligation
  fs.mkdirSync(target, { recursive: true });
  fs.symlinkSync(target, path.join(worktree, "qa_reports"), "dir");

  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, `advisory must never affect the exit code (stderr=${r.stderr})`);
  assert.doesNotMatch(r.stderr, /qa_reports\//, "a symlink resolving outside the worktree must be silent");
});

test("E111(iii): agc check stays silent on every tracked-evidence shape — fully tracked and clean (W6), tracked content plus an untracked straggler which is THIS REPO's own shape (W5), and tracked content with a locally modified tracked file (W7)", () => {
  const { worktree } = mkWorktreeFixture("e111-w5w6w7-");

  // W6: qa_reports fully tracked, clean.
  fs.mkdirSync(path.join(worktree, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "qa_reports", "review_T1.md"), "tracked\n");

  // W5: review_reports tracked content + an untracked straggler (e.g. an
  // uncommitted report mid-review) — a regression here would fire on every
  // `agc check` this repo itself runs.
  fs.mkdirSync(path.join(worktree, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "review_reports", "review_T2.md"), "tracked\n");

  // W7: specs tracked content, later locally modified without committing.
  fs.mkdirSync(path.join(worktree, "specs"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "specs", "feature.md"), "tracked v1\n");

  execSync("git add qa_reports review_reports specs", { cwd: worktree });
  execSync('git commit -q -m "tracked evidence baseline"', { cwd: worktree });

  fs.writeFileSync(path.join(worktree, "review_reports", "review_T3_wip.md"), "uncommitted\n");
  fs.writeFileSync(path.join(worktree, "specs", "feature.md"), "tracked v2 — modified, uncommitted\n");

  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, `advisory must never affect the exit code (stderr=${r.stderr})`);
  assert.doesNotMatch(r.stderr, /qa_reports\//, "W6: fully tracked and clean must be silent");
  assert.doesNotMatch(
    r.stderr,
    /review_reports\//,
    "W5: tracked dir + untracked straggler must be silent — the remedy is 'commit it', not symlinking the whole directory away",
  );
  assert.doesNotMatch(r.stderr, /specs\//, "W7: tracked content with a locally modified tracked file must be silent");
});

test("E111(iv): agc check stays silent from a PRIMARY checkout regardless of evidence-dir state (P1) — .git is a directory there, not a worktree gitfile, so the whole advisory is a no-op by construction", () => {
  const primary = mkTmp("e111-p1-primary-");
  execSync("git init -q", { cwd: primary });
  execSync("git config user.email a@b.c && git config user.name t", { cwd: primary });
  fs.writeFileSync(path.join(primary, "README.md"), "primary\n");
  execSync("git add -A && git commit -q -m init", { cwd: primary });

  fs.mkdirSync(path.join(primary, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(primary, "qa_reports", "review_T1.md"), "real, untracked, in a primary checkout\n");

  const r = runAgc(primary, ["check"]);
  assert.equal(r.status, 0, `advisory must never affect the exit code (stderr=${r.stderr})`);
  r.stderr = withoutHygieneLines(r.stderr);
  assert.equal(r.stderr, "", "a primary checkout must produce zero worktree-evidence warnings regardless of directory state");
});

test("E111 R1 regression guard: a freshly bootstrapped, completely empty evidence dir in a linked worktree still warns (W4) — the only moment remediation is free, per review_reports/review_T-E111-01.md Round 1 and Round 3", () => {
  const { worktree } = mkWorktreeFixture("e111-w4-");
  // The state right after `mkdir -p qa_reports review_reports specs` and
  // nothing else — no tracked files (git can't track an empty directory)
  // and no untracked ones either.
  fs.mkdirSync(path.join(worktree, "qa_reports"));
  fs.mkdirSync(path.join(worktree, "review_reports"));
  fs.mkdirSync(path.join(worktree, "specs"));

  const r = runAgc(worktree, ["check"]);
  assert.equal(r.status, 0, `advisory must never affect the exit code (stderr=${r.stderr})`);
  for (const rel of ["qa_reports", "review_reports", "specs"]) {
    assert.match(
      r.stderr,
      new RegExp(`${rel}\\/ is a real, untracked directory in a linked git worktree`),
      `${rel}/ empty (zero tracked, zero untracked) must still warn — R1's fix; the empty bootstrap moment is the only one remediation is free`,
    );
  }
});

test("E111: the advisory never changes the exit code — agc check exits 0 with warnings present, and the pre-existing stale-adapter exit-1 path fires independently when both conditions hold at once", () => {
  const { worktree } = mkWorktreeFixture("e111-exit-");
  fs.mkdirSync(path.join(worktree, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(worktree, "qa_reports", "review_T1.md"), "evidence\n");

  const OLD_VERSION = "0.0.1";
  fs.writeFileSync(path.join(worktree, "AGENTS.md"), `# agc-version: ${OLD_VERSION}\n# stale file\n`);

  const r = runAgc(worktree, ["check"]);
  assert.equal(
    r.status,
    1,
    "the stale-adapter gate must still exit 1 even when a worktree-evidence warning also fires — the advisory never suppresses the real gate",
  );
  assert.match(
    r.stderr,
    /qa_reports\/ is a real, untracked directory in a linked git worktree/,
    "the advisory warning must still be present alongside the stale-adapter message",
  );
  assert.match(r.stderr, /stale adapter.*AGENTS\.md/, "the pre-existing stale-adapter path must be untouched");
});
