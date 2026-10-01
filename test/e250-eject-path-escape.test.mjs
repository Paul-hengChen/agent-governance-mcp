// Coded by @qa-engineer
// Tests that `agc eject` shows paths containing control characters (LF, CR, ESC) in escaped
// form, so a directory name cannot split its output, and prints a manual-removal note, not a
// shell command with the raw byte (specs/e250-eject-path-escape.md AC1-AC11, AC13, AC14;
// T-E250-06). AC12 is checked by search, AC13 by the full suite. Fixtures: real git repos
// under os.tmpdir() with HOME at a fresh temp dir; skipped on win32 (NTFS forbids 0x00-0x1F).
// Rationale: specs/e260f-comment-rationale.md (test/e250-eject-path-escape.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const AGC_INIT = path.join(PROJECT_ROOT, "bin", "agc-init.mjs");

const LF = "\n";
const CR = "\r";
const ESC = "\x1b";

// ---------------------------------------------------------------------------
// Cleanup registry — mirrors test/e108-eject.test.mjs / test/e239-init-subdir-exclude.test.mjs.
// ---------------------------------------------------------------------------
const TMP_DIRS = [];
function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of TMP_DIRS) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

function mkTmpHome() {
  return mkTmp("e250-eject-home-");
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

function mkGitRepo(prefix) {
  const repo = mkTmp(prefix);
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "qa@example.com"]);
  git(repo, ["config", "user.name", "QA Sentinel"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  return repo;
}

function mkGitRepoWithCommit(prefix) {
  const repo = mkGitRepo(prefix);
  fs.writeFileSync(path.join(repo, "README.md"), "seed\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  return repo;
}

// Same as mkGitRepo, but rooted at an already-created directory whose own
// name may carry a control character (AC1/AC2) — mkdtempSync's prefix
// becomes part of the final directory name verbatim, so embedding the byte
// in `prefix` lands it in the repo's own path.
function mkGitRepoAt(dir) {
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "qa@example.com"]);
  git(dir, ["config", "user.name", "QA Sentinel"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}

function runAgc(cwd, args, { home } = {}) {
  const HOME = home ?? mkTmpHome();
  return spawnSync(process.execPath, [AGC_INIT, ...args], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, HOME },
    timeout: 15000,
  });
}

function initWorkspace(ws, artifactsFlag, opts) {
  const args = artifactsFlag ? ["init", `--artifacts=${artifactsFlag}`] : ["init"];
  const r = runAgc(ws, args, opts);
  assert.equal(r.status, 0, `agc init failed: ${r.stderr}`);
  return r;
}

function addProcessEvidence(ws) {
  fs.mkdirSync(path.join(ws, "qa_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "qa_reports", "review_T-1.md"), "# QA review\npass\n");
  fs.mkdirSync(path.join(ws, "review_reports"), { recursive: true });
  fs.writeFileSync(path.join(ws, "review_reports", "review_T-1.md"), "# Code review\napproved\n");
}

function addDomainKnowledge(ws) {
  fs.mkdirSync(path.join(ws, "design"), { recursive: true });
  fs.writeFileSync(path.join(ws, "design", "feature.md"), "# design notes\n");
  fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
  fs.writeFileSync(path.join(ws, "specs", "feature.md"), "# spec\n");
  fs.mkdirSync(path.join(ws, "docs"), { recursive: true });
  fs.writeFileSync(path.join(ws, "docs", "backlog.md"), "# Backlog\n- E1 something\n");
}

// A byte-for-byte mirror of bin/agc-init.mjs's escapeSegmentForDisplay(),
// re-derived independently (black-box, CLI-level) rather than imported —
// same discipline as test/e239-init-subdir-exclude.test.mjs's prefixedRules().
function escapeForDisplay(segment) {
  return segment.replace(/[\x00-\x1f\x7f]/g, (ch) => {
    if (ch === "\n") return "\\n";
    if (ch === "\r") return "\\r";
    if (ch === "\t") return "\\t";
    return `\\x${ch.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}

const CONTROL_CHAR_MANUAL_REMOVAL_NOTE =
  "note: one or more of the path(s) above contain a control character and cannot be pasted into a command safely — remove it by hand.";

function skipOnWin32(t) {
  if (process.platform === "win32") {
    t.skip(
      "a literal LF/CR/ESC byte can never survive inside a path segment on win32 — see test/e108-eject.test.mjs's AC7 (E243) skip guard and test/e239-init-subdir-exclude.test.mjs's AC15-AC20 for the platform-behavior precedent",
    );
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// AC1 — workspace path containing LF: dry-run plan header, single line
// ---------------------------------------------------------------------------
test("AC1: workspace path containing LF — dry-run plan header is escaped and stays one line", (t) => {
  if (skipOnWin32(t)) return;

  const repo = mkGitRepoAt(mkTmp(`e250-ac1-ws-x${LF}y-`));
  initWorkspace(repo, "local");
  const cwdReal = fs.realpathSync(repo); // process.cwd() inside the child resolves symlinks (macOS: /var -> /private/var)

  const rDry = runAgc(repo, ["eject"]);
  assert.equal(rDry.status, 0, `stderr=${rDry.stderr}`);
  const expectedHeader = `agc eject — plan for ${escapeForDisplay(cwdReal)} (dry-run; re-run with --yes to apply):`;
  const firstLine = rDry.stdout.split("\n")[0];
  assert.equal(firstLine, expectedHeader, `stdout=${JSON.stringify(rDry.stdout)}`);

  // AC14: --yes on the same workspace produces the same disposition an
  // ordinary-path local-mode workspace would (fresh init: .current/, tasks.md,
  // and the three host-trace files all present and block-only/template-identical).
  const rYes = runAgc(repo, ["eject", "--yes"]);
  assert.equal(rYes.status, 0, `stderr=${rYes.stderr}`);
  assert.equal(fs.existsSync(path.join(repo, ".current")), false, ".current/ must be gone");
  assert.equal(fs.existsSync(path.join(repo, "tasks.md")), false, "tasks.md must be gone");
  assert.equal(fs.existsSync(path.join(repo, "CLAUDE.md")), false, "CLAUDE.md (block-only) must be deleted");
  assert.equal(fs.existsSync(path.join(repo, "AGENTS.md")), false, "AGENTS.md must be deleted");
  assert.equal(fs.existsSync(path.join(repo, ".antigravityrules")), false, ".antigravityrules must be deleted");
});

// ---------------------------------------------------------------------------
// AC2 — workspace path containing LF: --yes plan header, same escaping
// ---------------------------------------------------------------------------
test("AC2: workspace path containing LF — --yes plan header is escaped the same way", (t) => {
  if (skipOnWin32(t)) return;

  const repo = mkGitRepoAt(mkTmp(`e250-ac2-ws-a${LF}b-`));
  initWorkspace(repo, "local");
  const cwdReal = fs.realpathSync(repo);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const expectedHeader = `agc eject — applying to ${escapeForDisplay(cwdReal)}:`;
  const firstLine = r.stdout.split("\n")[0];
  assert.equal(firstLine, expectedHeader, `stdout=${JSON.stringify(r.stdout)}`);
});

// ---------------------------------------------------------------------------
// AC3 — subdirectory prefix containing CR: host-trace and class-line labels
// ---------------------------------------------------------------------------
test("AC3: subdirectory prefix containing CR — host-trace and class-line labels show the escaped prefix", (t) => {
  if (skipOnWin32(t)) return;

  const name = `x${CR}y`;
  const repo = mkGitRepoWithCommit("e250-ac3-");
  const sub = path.join(repo, name);
  fs.mkdirSync(sub, { recursive: true });
  // Explicit repo mode: a CR-bearing prefix is unsafe for a gitignore rule
  // (see E243), so local mode would refuse here — repo mode sidesteps that
  // refusal, same as test/e239-init-subdir-exclude.test.mjs's AC18.
  initWorkspace(sub, "repo");
  addProcessEvidence(sub);
  addDomainKnowledge(sub);

  const prefixDisplay = escapeForDisplay(name);
  const rDry = runAgc(sub, ["eject"]);
  assert.equal(rDry.status, 0, `stderr=${rDry.stderr}`);
  const lines = rDry.stdout.split("\n");

  assert.ok(lines.includes(`(i) machine state — ${prefixDisplay}/.current/: DELETE`), `stdout=${rDry.stdout}`);
  assert.ok(lines.includes(`(ii-b) process evidence — ${prefixDisplay}/tasks.md: DELETE`));
  assert.ok(lines.includes(`(ii-b) process evidence — ${prefixDisplay}/qa_reports/: DELETE`));
  assert.ok(lines.includes(`(ii-b) process evidence — ${prefixDisplay}/review_reports/: DELETE`));
  assert.ok(
    lines.includes(
      `(ii-a) domain knowledge — ${prefixDisplay}/docs/backlog.md: KEPT (pass --purge-knowledge to remove; never the default) — may be this project's plan`,
    ),
  );
  assert.ok(
    lines.includes(`(ii-a) domain knowledge — ${prefixDisplay}/design/: KEPT (pass --purge-knowledge to remove; never the default)`),
  );
  assert.ok(
    lines.includes(`(ii-a) domain knowledge — ${prefixDisplay}/specs/: KEPT (pass --purge-knowledge to remove; never the default)`),
  );
  assert.ok(
    lines.includes(`(iii) host traces — ${prefixDisplay}/CLAUDE.md: REMOVE adapter block (file will be deleted, holds only the block)`),
  );
  assert.ok(lines.includes(`(iii) host traces — ${prefixDisplay}/AGENTS.md: DELETE (matches the installed template)`));
  assert.ok(lines.includes(`(iii) host traces — ${prefixDisplay}/.antigravityrules: DELETE (matches the installed template)`));

  assert.ok(!rDry.stdout.includes(CR), "no raw CR byte reaches stdout");
  assert.ok(!rDry.stderr.includes(CR), "no raw CR byte reaches stderr");

  // AC14: --yes on this same workspace deletes/edits exactly what the
  // equivalent ordinary-path local/repo-mode workspace would (dry-run above
  // made zero changes, so this is safe to run next).
  const rYes = runAgc(sub, ["eject", "--yes"]);
  assert.equal(rYes.status, 0, `stderr=${rYes.stderr}`);
  assert.equal(fs.existsSync(path.join(sub, ".current")), false);
  assert.equal(fs.existsSync(path.join(sub, "tasks.md")), false);
  assert.equal(fs.existsSync(path.join(sub, "qa_reports")), false);
  assert.equal(fs.existsSync(path.join(sub, "review_reports")), false);
  assert.equal(fs.existsSync(path.join(sub, "CLAUDE.md")), false);
  assert.equal(fs.existsSync(path.join(sub, "AGENTS.md")), false);
  assert.equal(fs.existsSync(path.join(sub, ".antigravityrules")), false);
  // Domain knowledge kept by default (no --purge-knowledge) — same as ordinary path.
  assert.ok(fs.existsSync(path.join(sub, "design", "feature.md")));
  assert.ok(fs.existsSync(path.join(sub, "specs", "feature.md")));
  assert.ok(fs.existsSync(path.join(sub, "docs", "backlog.md")));
});

// ---------------------------------------------------------------------------
// AC4 — subdirectory prefix containing CR: tracked host-trace changed-file list
// ---------------------------------------------------------------------------
test("AC4: subdirectory prefix containing CR — tracked host-trace changed-file list shows escaped path", (t) => {
  if (skipOnWin32(t)) return;

  const name = `x${CR}y`;
  const repo = mkGitRepoWithCommit("e250-ac4-");
  const sub = path.join(repo, name);
  fs.mkdirSync(sub, { recursive: true });
  initWorkspace(sub, "repo");
  const original = fs.readFileSync(path.join(sub, "CLAUDE.md"), "utf-8");
  const withProse = "# My own notes\nsome prose before\n\n" + original + "\n\nsome prose after\n";
  fs.writeFileSync(path.join(sub, "CLAUDE.md"), withProse);
  git(repo, ["add", `${name}/CLAUDE.md`, `${name}/AGENTS.md`, `${name}/.antigravityrules`]);
  git(repo, ["commit", "-q", "-m", "tracked sub host traces with prose"]);

  const prefixDisplay = escapeForDisplay(name);

  const rDry = runAgc(sub, ["eject"]);
  assert.equal(rDry.status, 0, `stderr=${rDry.stderr}`);
  assert.match(rDry.stdout, /will change tracked file\(s\) — uncommitted until you commit:/);
  const dryLines = rDry.stdout.split("\n");
  assert.ok(dryLines.includes(`  ${prefixDisplay}/CLAUDE.md (edited)`), `stdout=${rDry.stdout}`);
  assert.ok(dryLines.includes(`  ${prefixDisplay}/AGENTS.md (deleted)`));
  assert.ok(dryLines.includes(`  ${prefixDisplay}/.antigravityrules (deleted)`));

  const r = runAgc(sub, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(
    r.stdout,
    /Tracked host-trace file\(s\) were changed in the working tree — this is uncommitted; review and commit it yourself:\n/,
  );
  const yesLines = r.stdout.split("\n");
  assert.ok(yesLines.includes(`  ${prefixDisplay}/CLAUDE.md (edited)`), `stdout=${r.stdout}`);
  assert.ok(yesLines.includes(`  ${prefixDisplay}/AGENTS.md (deleted)`));
  assert.ok(yesLines.includes(`  ${prefixDisplay}/.antigravityrules (deleted)`));

  assert.ok(!r.stdout.includes(CR), "no raw CR byte reaches stdout");
  assert.ok(!r.stderr.includes(CR), "no raw CR byte reaches stderr");

  // AC14: the actual filesystem effect is identical to the ordinary-path
  // "CLAUDE.md with prose" case (test/e108-eject.test.mjs AC8 / "tracked
  // host-trace" Case B) — prose preserved, block removed, AGENTS.md and
  // .antigravityrules deleted.
  assert.ok(fs.existsSync(path.join(sub, "CLAUDE.md")), "CLAUDE.md must be kept, not deleted");
  const after = fs.readFileSync(path.join(sub, "CLAUDE.md"), "utf-8");
  assert.match(after, /^# My own notes\nsome prose before\n/);
  assert.match(after, /some prose after\n?$/);
  assert.doesNotMatch(after, /BEGIN agc-adapter/);
  assert.doesNotMatch(after, /END agc-adapter/);
  assert.equal(fs.existsSync(path.join(sub, "AGENTS.md")), false);
  assert.equal(fs.existsSync(path.join(sub, ".antigravityrules")), false);
});

// ---------------------------------------------------------------------------
// AC5 — tracked artifact path under a CR-bearing prefix: stderr tracked list
// ---------------------------------------------------------------------------
test("AC5: tracked artifact path under a CR-bearing prefix — stderr tracked list shows escaped display", (t) => {
  if (skipOnWin32(t)) return;

  const name = `x${CR}y`;
  const repo = mkGitRepoWithCommit("e250-ac5-");
  const sub = path.join(repo, name);
  fs.mkdirSync(sub, { recursive: true });
  initWorkspace(sub, "repo");
  fs.writeFileSync(path.join(sub, "tasks.md"), "# Tasks\n");
  git(repo, ["add", `${name}/tasks.md`]);
  git(repo, ["commit", "-q", "-m", "tracked sub tasks.md"]);

  const prefixDisplay = escapeForDisplay(name);
  const tasksBefore = fs.readFileSync(path.join(sub, "tasks.md"), "utf-8");

  const r = runAgc(sub, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stderr, /The following are tracked and were left untouched \(agc does not run git rm\):/);
  const stderrLines = r.stderr.split("\n");
  assert.ok(stderrLines.includes(`  ${prefixDisplay}/tasks.md`), `stderr=${r.stderr}`);

  assert.ok(!r.stderr.includes(CR), "no raw CR byte reaches stderr");
  assert.ok(!r.stdout.includes(CR), "no raw CR byte reaches stdout");

  // AC14: the tracked artifact itself is left byte-for-byte untouched, same
  // as the ordinary-path case (test/e108-eject.test.mjs AC6).
  assert.ok(fs.existsSync(path.join(sub, "tasks.md")), "tracked tasks.md must survive");
  assert.equal(fs.readFileSync(path.join(sub, "tasks.md"), "utf-8"), tasksBefore);
});

// ---------------------------------------------------------------------------
// AC6 — control-char-bearing tracked path: git rm -r line replaced by the note
// ---------------------------------------------------------------------------
test("AC6: control-char-bearing tracked path — git rm -r line replaced by the manual-removal note", (t) => {
  if (skipOnWin32(t)) return;

  const name = `x${CR}y`;
  const repo = mkGitRepoWithCommit("e250-ac6-");
  const sub = path.join(repo, name);
  fs.mkdirSync(sub, { recursive: true });
  initWorkspace(sub, "repo");
  fs.writeFileSync(path.join(sub, "tasks.md"), "# Tasks\n");
  git(repo, ["add", `${name}/tasks.md`]);
  git(repo, ["commit", "-q", "-m", "tracked sub tasks.md"]);

  const r = runAgc(sub, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stderr, /git rm -r/, `stderr=${r.stderr}`);
  // Trimmed-line equality, not whole-line/indentation-sensitive equality —
  // the note keeps its slot's own indentation (code-reviewer's note, this
  // lane's dispatch brief, and this file's own "Copy Audit Gate" pass all
  // agree on this reading of AC6's "a single line reading exactly").
  const trimmedLines = r.stderr.split("\n").map((l) => l.trim());
  assert.ok(trimmedLines.includes(CONTROL_CHAR_MANUAL_REMOVAL_NOTE), `stderr=${r.stderr}`);
  assert.match(r.stderr, /Note: history still contains these files after that command\./);
});

// ---------------------------------------------------------------------------
// AC7 — ordinary path (no control character): stderr block byte-for-byte unchanged
// ---------------------------------------------------------------------------
test("AC7: ordinary path (no control character) — tracked-path stderr block is byte-for-byte unchanged", () => {
  const repo = mkGitRepoWithCommit("e250-ac7-");
  fs.mkdirSync(path.join(repo, ".current"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".current", ".config.json"),
    JSON.stringify({ schema_version: 2, host: "claude-code" }, null, 2) + "\n",
  );
  fs.writeFileSync(path.join(repo, "tasks.md"), "# Tasks\n");
  git(repo, ["add", "tasks.md"]);
  git(repo, ["commit", "-q", "-m", "tracked tasks.md at root"]);

  const r = runAgc(repo, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(
    r.stderr,
    /The following are tracked and were left untouched \(agc does not run git rm\):\n  tasks\.md\nRemove them \(from the index and the working tree\) with:\n  git rm -r tasks\.md\nNote: history still contains these files after that command\.\n/,
  );
});

// ---------------------------------------------------------------------------
// AC8 — linked worktree directory name containing ESC: dry-run warning
// ---------------------------------------------------------------------------
test("AC8: linked worktree directory name containing ESC — dry-run warning shows escaped path", (t) => {
  if (skipOnWin32(t)) return;

  const repo = mkGitRepoWithCommit("e250-ac8-");
  initWorkspace(repo, "local");
  const laneParent = mkTmp("e250-ac8-lane-parent-");
  const lane = path.join(laneParent, `wt_x${ESC}y`);
  git(repo, ["worktree", "add", lane, "-b", "feat/e250-ac8"]);
  // git worktree list prints realpath'd paths (macOS: /var -> /private/var).
  const canonicalLane = fs.realpathSync(lane);
  const expectedDisplay = escapeForDisplay(canonicalLane);

  const r = runAgc(repo, ["eject"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  assert.match(r.stderr, /warning: linked worktree\(s\) still exist and would be stranded:/);
  const stderrLines = r.stderr.split("\n");
  assert.ok(stderrLines.includes(`  ${expectedDisplay}`), `stderr=${r.stderr}`);
  assert.ok(!r.stderr.includes(ESC), "no raw ESC byte reaches stderr");
  assert.match(r.stdout, /agc eject — plan for/, "dry-run still prints the plan after the warning");
});

// ---------------------------------------------------------------------------
// AC9 — linked worktree directory name containing ESC: --yes refusal
// ---------------------------------------------------------------------------
test("AC9: linked worktree directory name containing ESC — --yes refusal shows escaped path, before any plan", (t) => {
  if (skipOnWin32(t)) return;

  const repo = mkGitRepoWithCommit("e250-ac9-");
  const laneParent = mkTmp("e250-ac9-lane-parent-");
  const lane = path.join(laneParent, `wt_x${ESC}y`);
  git(repo, ["worktree", "add", lane, "-b", "feat/e250-ac9"]);
  const canonicalLane = fs.realpathSync(lane);
  const expectedDisplay = escapeForDisplay(canonicalLane);

  const rYes = runAgc(repo, ["eject", "--yes"]);
  assert.equal(rYes.status, 1, `stdout=${rYes.stdout} stderr=${rYes.stderr}`);
  assert.match(rYes.stderr, /agc eject: refusing --yes — linked worktree\(s\) still exist and would be stranded:/);
  const stderrLines = rYes.stderr.split("\n");
  assert.ok(stderrLines.includes(`  ${expectedDisplay}`), `stderr=${rYes.stderr}`);
  assert.match(rYes.stderr, /Finish or remove them first \(agc feature finish\)\./);
  assert.doesNotMatch(rYes.stdout, /agc eject — (plan|applying)/, "no plan may be printed before the refusal");
  assert.ok(!rYes.stderr.includes(ESC), "no raw ESC byte reaches stderr");
});

// ---------------------------------------------------------------------------
// AC10 — $HOME path containing LF: cannot-do item 4 listing
// ---------------------------------------------------------------------------
test("AC10: $HOME path containing LF — cannot-do item 4 listing shows the escaped path", (t) => {
  if (skipOnWin32(t)) return;

  const repo = mkGitRepo("e250-ac10-");
  initWorkspace(repo, "local");

  const home = mkTmp(`e250-ac10-home-x${LF}y-`);
  const agentsDir = path.join(home, ".claude", "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  const templatesDir = path.join(PROJECT_ROOT, "templates", "claude-code-agents");
  const templateNames = fs.readdirSync(templatesDir).filter((n) => n.endsWith(".md")).sort();
  assert.ok(templateNames.length > 0, "fixture precondition: shipped templates must exist");
  const first = templateNames[0];
  fs.writeFileSync(path.join(agentsDir, first), "# a real installed subagent template\n");

  const r = runAgc(repo, ["eject"], { home });
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  // os.homedir() reads $HOME literally (no realpath), unlike process.cwd().
  const expectedPath = path.join(agentsDir, first);
  const expectedDisplay = escapeForDisplay(expectedPath);

  const presentMarker = "Present:\n";
  const presentIdx = r.stdout.indexOf(presentMarker);
  assert.ok(presentIdx !== -1, `stdout=${r.stdout}`);
  const nextLine = r.stdout.slice(presentIdx + presentMarker.length).split("\n")[0];
  assert.equal(nextLine.trim(), expectedDisplay, `stdout=${JSON.stringify(r.stdout)}`);
  assert.doesNotMatch(r.stdout, /my-own-agent\.md/);
});

// ---------------------------------------------------------------------------
// AC11 — $HOME path containing LF: cannot-do rm line replaced by the note
// ---------------------------------------------------------------------------
test("AC11: $HOME path containing LF — cannot-do rm line is replaced by the manual-removal note", (t) => {
  if (skipOnWin32(t)) return;

  const repo = mkGitRepo("e250-ac11-");
  initWorkspace(repo, "local");

  const home = mkTmp(`e250-ac11-home-x${LF}y-`);
  const agentsDir = path.join(home, ".claude", "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  const templatesDir = path.join(PROJECT_ROOT, "templates", "claude-code-agents");
  const templateNames = fs.readdirSync(templatesDir).filter((n) => n.endsWith(".md")).sort();
  assert.ok(templateNames.length > 0, "fixture precondition: shipped templates must exist");
  const first = templateNames[0];
  fs.writeFileSync(path.join(agentsDir, first), "# a real installed subagent template\n");

  const r = runAgc(repo, ["eject"], { home });
  assert.equal(r.status, 0, `stderr=${r.stderr}`);

  const removeMarker = "Remove them yourself with:\n";
  const idx = r.stdout.indexOf(removeMarker);
  assert.ok(idx !== -1, `stdout=${r.stdout}`);
  const nextLine = r.stdout.slice(idx + removeMarker.length).split("\n")[0];
  assert.equal(nextLine.trim(), CONTROL_CHAR_MANUAL_REMOVAL_NOTE, `stdout=${JSON.stringify(r.stdout)}`);
  assert.doesNotMatch(r.stdout, new RegExp(`rm .*${first}`));
});

// ---------------------------------------------------------------------------
// boundary — LF, CR and ESC combined in one path segment (SOP Phase 3d)
// ---------------------------------------------------------------------------
test("boundary: a path segment carrying LF, CR and ESC together escapes each byte independently", (t) => {
  if (skipOnWin32(t)) return;

  const name = `m${LF}i${CR}x${ESC}!`;
  const repo = mkGitRepoWithCommit("e250-boundary-multi-");
  const sub = path.join(repo, name);
  fs.mkdirSync(sub, { recursive: true });
  initWorkspace(sub, "repo");
  fs.writeFileSync(path.join(sub, "tasks.md"), "# Tasks\n");
  git(repo, ["add", `${name}/tasks.md`]);
  git(repo, ["commit", "-q", "-m", "tracked mixed-control tasks.md"]);

  const prefixDisplay = escapeForDisplay(name);
  assert.ok(prefixDisplay.includes("\\n"));
  assert.ok(prefixDisplay.includes("\\r"));
  assert.ok(prefixDisplay.includes("\\x1b"));

  const r = runAgc(sub, ["eject", "--yes"]);
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const trimmedLines = r.stderr.split("\n").map((l) => l.trim());
  assert.ok(trimmedLines.includes(`${prefixDisplay}/tasks.md`), `stderr=${r.stderr}`);
  assert.ok(trimmedLines.includes(CONTROL_CHAR_MANUAL_REMOVAL_NOTE), `stderr=${r.stderr}`);
  assert.doesNotMatch(r.stderr, /git rm -r/);

  assert.ok(!r.stdout.includes(CR) && !r.stdout.includes(ESC), "no raw CR/ESC byte reaches stdout");
  assert.ok(!r.stderr.includes(CR) && !r.stderr.includes(ESC), "no raw CR/ESC byte reaches stderr");

  assert.ok(fs.existsSync(path.join(sub, "tasks.md")), "tracked tasks.md must survive (AC14 parity)");
  assert.equal(fs.readFileSync(path.join(sub, "tasks.md"), "utf-8"), "# Tasks\n");
});
