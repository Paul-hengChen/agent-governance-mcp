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
import { spawnSync } from "node:child_process";

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
  assert.equal(r.stderr, "", "stderr must be empty");
});

// ---------------------------------------------------------------------------
// AC-8: no verbatim constitution rule line appears in any adapter
// ---------------------------------------------------------------------------

test("AC-8: no verbatim constitution line appears in any adapter template (pointer-only)", () => {
  // Contract: adapter files are entry-pointers to the governance server, NOT copies
  // of the constitution. Any line that appears verbatim in content/constitution.md
  // must not appear in any adapter template. (Programmatic line-intersection —
  // the same check the code-reviewer ran independently.)
  const constitutionPath = path.join(PROJECT_ROOT, "content", "constitution.md");
  const constitutionLines = new Set(
    fs.readFileSync(constitutionPath, "utf-8")
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
