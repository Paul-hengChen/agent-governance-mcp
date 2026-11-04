// Coded by @qa-engineer
// Tests for specs/release-engineer-complete-staging.md and the release-SOP
// conditional checks (backlog rows E44, E49). The release-engineer SOP is
// prompt text only (content/skill-release-engineer.md), so these tests pin its
// wording: staging list, pre-commit verify, post-commit spec-file branches and
// step 7a ticket-code derivation, using git output mocked as strings.
// Spec-to-test map and history: specs/e260h-comment-rationale.md (test/release-staging.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import * as os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getTsConfigSourceDirs } from "../dist/lib/tsconfig-source-dirs.js";
import { composeConstitution } from "../dist/prompts/build.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = fs.readFileSync(
  path.join(ROOT, "content", "skill-release-engineer.md"),
  "utf-8",
);
const SHIM = fs.readFileSync(
  path.join(ROOT, "templates", "claude-code-agents", "release-engineer.md"),
  "utf-8",
);
const CONST15 = fs.readFileSync(
  path.join(ROOT, "content", "const-15-core-tail.md"),
  "utf-8",
);

// E394 (T-E394-12): the release mechanics moved out of the SOP into scripts/release.mjs, the narratives
// into specs/release-sop-history.md. Mechanism lessons are asserted on the script's exports and source, rule
// lessons on the rewritten SOP, incident text on the history file (byte-identity of that text is pinned by
// test/e394-release-sop.test.mjs AC-P10).
const REL = await import(pathToFileURL(path.join(ROOT, "scripts", "release.mjs")).href);
const RELEASE_SRC = fs.readFileSync(path.join(ROOT, "scripts", "release.mjs"), "utf-8");
const HISTORY = fs.readFileSync(path.join(ROOT, "specs", "release-sop-history.md"), "utf-8");
// Source text of `function <name>(` up to its closing brace at column 0.
const fnSrc = (name) => {
  const i = RELEASE_SRC.search(new RegExp(`^(export )?(async )?function ${name}\\(`, "m"));
  assert.ok(i >= 0, `scripts/release.mjs defines function ${name}`);
  return RELEASE_SRC.slice(i, RELEASE_SRC.indexOf("\n}\n", i) + 3);
};
// SOP table rows as trimmed cell arrays (the SOP carries no escaped pipe: see the E53 caveat test).
const SOP_ROWS = SKILL.split("\n").filter((l) => l.startsWith("| ")).map((l) => l.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim()));
const exitRow = (code, id) => SOP_ROWS.find((c) => c[0].startsWith(`exit ${code} ${id}`));
const sopRow = (re) => SOP_ROWS.find((c) => re.test(c[0]));

// ---------------------------------------------------------------------------
// Content-assertion helpers (mirror the SOP logic in pure JS so fixtures
// can exercise branching without spawning a real git process).
// ---------------------------------------------------------------------------

// The directories the SOP declares as feature source dirs (AC1-AC3). The
// AC-B5.5 test derives TypeScript roots from tsconfig.json `include`, so gates/
// must be listed here too. docs/, research/, multi-agent-scripts/ and .github/
// are not TypeScript roots, so no derivation finds them; they are hand-listed.
// History: specs/e260h-comment-rationale.md (test/release-staging.test.mjs).
const FEATURE_DIRS = ["lib/", "tools/", "schema/", "guards/", "gates/", "prompts/", "bin/", "scripts/", "content/", "templates/", "specs/", "test/", "qa_reports/", "review_reports/", "docs/", "research/", "multi-agent-scripts/", ".github/", "transport/"];

// Top-level dirs deliberately outside FEATURE_DIRS. Nothing can derive this
// partition, so it is kept by hand and the Partition test below fails loudly
// when a new top-level dir is not classified.
const NON_SOURCE_DIRS = [
  "dist/", // build output; already enumerated in METADATA_PATHS below (staged via `npm run build` only per the release-engineer Artifact allowlist, never hand-edited or staged as feature source)
  "node_modules/", // gitignored dependency tree (repo .gitignore); never tracked, never staged, never appears in a release diff
  ".current/", // only .current/.config.json ships — one of the five E65_METADATA_PATHS below, staged separately as a metadata path, not as this directory; the rest of the tree (handoff.md, telemetry.jsonl, metrics.jsonl, ...) is session bookkeeping committed outside the release commit (skill-release-engineer.md:173, citing commits cc3e0df/53a6392)
  // ".claude/" removed (E178a T-E178A-06, AC16): the interim `.claude/commands/integrator.md`
  // is deleted and nothing else under .claude/ is tracked (`git ls-files .claude` is empty),
  // so the directory no longer exists on disk and this list needs no entry for it. If a new
  // tracked path ever lands under .claude/ again, the Partition test below will red loud
  // (uncovered top-level dir) and it can be re-added then.
];

// The non-directory metadata paths staged by the same git-add line (AC1,
// rescoped). Seven pre-E65 (tsconfig.json joined earlier alongside gates/
// above; package-lock.json joined post-E65, per E60's lockfile-parity cut)
// plus the five E65 paths written by SOP steps 7b-7d ahead of the release
// commit.
const METADATA_PATHS = ["tsconfig.json", "package.json", "package-lock.json", "index.ts", "CHANGELOG.md", "README.md", "dist/"];
const E65_METADATA_PATHS = [".current/.config.json", "docs/backlog.md", "CLAUDE.md", "AGENTS.md", ".antigravityrules"];
// Two more root files joined the git-add line and the existence pre-filter
// after a release missed one: CONTRIBUTING.md was the v3.104.2 escape itself (an earlier
// ticket had edited it, yet it was missing from that release's commit and only
// backfilled afterwards; T-E94-01, T-E6X-01);
// tasks.md is this repo's own live task ledger, same "root file that never
// got staged" risk class. package-lock.json was NOT re-added here — E60
// already staged it (see METADATA_PATHS above).
const E94_METADATA_PATHS = ["CONTRIBUTING.md", "tasks.md"];
// The primary task ledger joins the git-add line (E198(b)): since each lane got
// its own ledger, `tw_complete_task` on primary writes `.current/_primary/tasks.md`,
// which the release commit used to leave out. Kept as its own named array so
// the ticket that added it stays traceable, like the arrays above.
const E198B_METADATA_PATHS = [".current/_primary/tasks.md"];

/**
 * Simulate the AC2 pre-commit verify: given mock `git status --short` and
 * `git diff --cached --stat` output, return { pass, missing }. FAIL when a
 * FEATURE_DIR has changes but is not staged, so metadata-only staging fails
 * while source dirs have pending edits.
 */
function simulatePreCommitVerify(gitStatusShort, gitDiffCachedStat) {
  // Which feature dirs appear changed in git status?
  const changedDirs = FEATURE_DIRS.filter((d) => gitStatusShort.includes(d));
  // Which feature dirs appear in the cached diff?
  const stagedDirs = FEATURE_DIRS.filter((d) => gitDiffCachedStat.includes(d));
  // Missing = changed but not staged
  const missing = changedDirs.filter((d) => !stagedDirs.includes(d));
  return { pass: missing.length === 0, missing };
}

/**
 * Whether `scope_decision_why` records a backlog-row-as-spec mini-chain
 * (PM/architect skipped), the SKIP-branch trigger (E44). The field is optional
 * free text, so this models a reasonable reading for fixtures; it does not
 * claim the real SOP step is mechanically decidable.
 */
function scopeDecisionWhyRecordsMiniChain(scopeDecisionWhy) {
  if (!scopeDecisionWhy) return false;
  return (
    /mini-chain/i.test(scopeDecisionWhy) &&
    /pm(\s*\/\s*|\s+)?arch(itect)?\s*(skip|skipped)/i.test(scopeDecisionWhy)
  );
}

// A realistic mini-chain scope_decision_why, in the shape this repo's own
// handoff actually carries for this feature (tw_get_state, whose active_feature
// was the release-SOP conditional-checks work, e44-e49): "... mini-chain sr-engineer ->
// code-reviewer -> qa-engineer, PM/ARCH skipped ...".
const MINI_CHAIN_SCOPE_WHY =
  "Backlog rows ARE the spec -> mini-chain sr-engineer -> code-reviewer -> qa-engineer, PM/ARCH skipped (E35-E38/E45/E46 pattern).";

// A non-mini-chain scope_decision_why (full PM/architect chain) — must NOT
// trigger the SKIP branch even though a spec file might still be missing from
// the diff for unrelated reasons.
const FULL_CHAIN_SCOPE_WHY =
  "Full PM/architect chain authored specs/some-feature.md; scope decision: single-feature, straightforward addition.";

// Re-baselined (T-E142-05, E142(b)/AC4-AC5): the range moved from a
// single-commit proxy (`git diff HEAD~1 --name-only`) to the release's true
// range (`git diff <prev-tag>..HEAD --name-only`), and a fourth,
// MULTI-FEATURE branch was inserted ahead of REQUIRE/SKIP/UNCLASSIFIABLE. The
// STOP strings below are updated to match content/skill-release-engineer.md's
// current text verbatim (not weakened — same shape, new range wording).
const AC4_REQUIRE_STOP =
  "Release commit incomplete: specs/<active_feature>.md is absent from the release range <prev-tag>..HEAD. Stage the missing files and re-run.";

const AC4_UNCLASSIFIABLE_STOP =
  "AC4 unclassifiable: no specs/<active_feature>.md in the tree, pending_notes does not record a multi-feature release, and scope_decision_why does not record a backlog-row-as-spec mini-chain — record the dispatch shape in scope_decision_why (or author specs/<active_feature>.md) and re-run.";

/**
 * The AC4 spec-class check as scripts/release.mjs evaluates it (before the release commit): delegates to the
 * script's classifySpecCheck so the fixtures below run the shipped decision, not a hand copy. Inputs keep
 * the old fixture shape: S = spec exists in tree, M = pending_notes records "Multi-feature release: ...",
 * R = the range holds a feature spec other than the active one (E152), W = mini-chain.
 */
const deriveRangeSpecs = (gitDiffRange) => REL.deriveRangeSpecs(gitDiffRange);
function simulatePostCommitCheck(
  gitDiffRange,
  activeFeature,
  specExistsInTree,
  scopeDecisionWhy,
  pendingNotes = "",
  multiFeatureSpecsInTree = {},
) {
  const r = REL.classifySpecCheck({
    feature: activeFeature,
    unionFiles: gitDiffRange,
    specExists: (n) => (n in multiFeatureSpecsInTree ? Boolean(multiFeatureSpecsInTree[n]) : n === activeFeature && specExistsInTree),
    scopeWhy: scopeDecisionWhy ?? "",
    pendingNotes,
  });
  return { pass: r.pass, branch: r.branch, rangeDerived: r.rangeDerived, errorMsg: r.errorMsg };
}

// ---------------------------------------------------------------------------
// Phase 1 — Content assertion tests (AC1–AC5)
// ---------------------------------------------------------------------------

test("AC1: the staging list lives in scripts/release.mjs STAGE_PATHS — every required directory and metadata path, set-equal to this file's lists; the SOP carries no hand git-add line (rescoped, E64/T-E645-03 point 2; AC-S6)", () => {
  const sp = REL.STAGE_PATHS;
  assert.deepEqual([...sp.featureDirs].sort(), [...FEATURE_DIRS].sort(), "STAGE_PATHS.featureDirs must equal FEATURE_DIRS");
  assert.deepEqual(
    [...sp.metadataPaths].sort(),
    [...METADATA_PATHS, ...E65_METADATA_PATHS, ...E94_METADATA_PATHS, ...E198B_METADATA_PATHS].sort(),
    "STAGE_PATHS.metadataPaths must equal the four metadata arrays",
  );
  // Every member is actually stageable: a change under it yields it in the plan.
  const everyChange = [...sp.featureDirs.map((d) => `${d}x.txt`), ...sp.metadataPaths];
  assert.deepEqual([...REL.planStage({ changed: everyChange, exists: () => true })].sort(), [...sp.featureDirs, ...sp.metadataPaths].sort());
  // The SOP delegates: no hand-run `git add`, no abstract phrasing, and prepare owns the staging checks.
  assert.ok(!/^\s+git add /m.test(SKILL), "the SOP must not carry an executable git-add line — staging is the script's (AC-S6)");
  assert.ok(!SKILL.includes("git add <touched files"), "the old abstract 'git add <touched files' phrasing must not return (AC1)");
  assert.match(SKILL, /staging and citation checks/, "SOP step 12 must name the staging checks as part of prepare");
  assert.ok(HISTORY.includes("34 paths"), "the old '34 paths' staging narrative lives in the history file (AC-P10)");
});

test("AC2: the pre-commit staging verify is the script's checkStagingCompleteness — metadata-only staging FAILs for every FEATURE_DIR with pending edits (AC-S6)", () => {
  for (const dir of FEATURE_DIRS) {
    const bad = REL.checkStagingCompleteness({ changed: [`${dir}a.txt`, "package.json"], staged: ["package.json"] });
    assert.equal(bad.pass, false, `metadata-only staging with a pending ${dir} edit must FAIL`);
    assert.deepEqual(bad.missing, [dir], `the missing directory must be named: ${dir}`);
    const ok = REL.checkStagingCompleteness({ changed: [`${dir}a.txt`, "package.json"], staged: [`${dir}a.txt`, "package.json"] });
    assert.equal(ok.pass, true, `complete staging must pass for ${dir}`);
  }
  // The stop is its own exit class and an Escalation row; the script says "stage them and re-run".
  assert.ok(exitRow(30, "STAGING_INCOMPLETE"), "SOP Escalation Routes must carry the STAGING_INCOMPLETE row");
  assert.match(RELEASE_SRC, /\$\{verdict\.problems\.join\("; "\)\} — stage them and re-run/);
  assert.ok(HISTORY.includes("git diff --cached --stat"), "the old hand verify step lives in the history file (AC-P10)");
});

test("AC2 (E94): root-file completeness — the script's two leftover commands, EXECUTED, discriminate the v3.104.2 escape from a correct release across four workspace shapes (adopter repo with no .current/, source outside FEATURE_DIRS, .current/ dirty, escape/PASS pair) (AC-S6)", () => {
  // The two argv arrays are lifted from step8aStage's `leftovers([...])` calls, so the commands run here are
  // the shipped ones.
  const calls = [...fnSrc("step8aStage").matchAll(/leftovers\(\[([^\]]*)\]\)/g)].map((m) => JSON.parse(`[${m[1]}]`));
  assert.equal(calls.length, 2, "step8aStage runs exactly two leftover commands (tracked-unstaged, untracked-never-staged)");
  const [diffArgs, lsArgs] = calls;
  assert.deepEqual(diffArgs.slice(0, 2), ["diff", "--name-only"]);
  assert.deepEqual(lsArgs.slice(0, 3), ["ls-files", "--others", "--exclude-standard"], "ls-files must pass --exclude-standard (else node_modules/ would be listed)");
  assert.ok(diffArgs.includes(":!.current") && lsArgs.includes(":!.current"), "both commands exclude .current/ via the documented pathspec");

  const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf-8" });
  const runBoth = (cwd) => ({
    diff: git(cwd, diffArgs).split("\0").filter(Boolean),
    lsFiles: git(cwd, lsArgs).split("\0").filter(Boolean),
  });
  const initRepo = (dir) => {
    git(dir, ["init", "-q"]);
    git(dir, ["config", "user.email", "a@b.c"]);
    git(dir, ["config", "user.name", "t"]);
    git(dir, ["config", "commit.gpgsign", "false"]);
  };
  const verdictOf = (r) => REL.checkStagingCompleteness({ changed: [], staged: [], unstaged: r.diff, untracked: r.lsFiles });

  // Shape 1: adopter repo, NO .current/, source in a dir outside FEATURE_DIRS.
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e94-adopter-"));
    initRepo(tmp);
    fs.mkdirSync(path.join(tmp, "src"));
    fs.writeFileSync(path.join(tmp, "src", "app.ts"), "x");
    fs.writeFileSync(path.join(tmp, "CONTRIBUTING.md"), "x");
    git(tmp, ["add", "--", "src", "CONTRIBUTING.md"]);
    git(tmp, ["commit", "-q", "-m", "init"]);
    fs.writeFileSync(path.join(tmp, "src", "app.ts"), "x2");
    fs.writeFileSync(path.join(tmp, "CONTRIBUTING.md"), "x2");
    const r = runBoth(tmp);
    assert.deepEqual([...r.diff].sort(), ["CONTRIBUTING.md", "src/app.ts"], "surfaces the root file and a source dir outside FEATURE_DIRS (enumeration-free)");
    const v = verdictOf(r);
    assert.equal(v.pass, false);
    assert.ok(v.problems.some((x) => x.includes("CONTRIBUTING.md") && x.includes("src/app.ts")), "the stop names both paths");
  }
  // Shape 2: .current/ dirty is excluded; an untracked stray root file is surfaced.
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e94-current-"));
    initRepo(tmp);
    fs.mkdirSync(path.join(tmp, ".current"));
    fs.writeFileSync(path.join(tmp, ".current", "handoff.md"), "x");
    fs.writeFileSync(path.join(tmp, "NOTES-local.txt"), "x");
    git(tmp, ["add", "--", ".current"]);
    git(tmp, ["commit", "-q", "-m", "init"]);
    fs.writeFileSync(path.join(tmp, ".current", "handoff.md"), "x2");
    const r = runBoth(tmp);
    assert.deepEqual(r.diff, [], ".current/ is excluded from the tracked-unstaged output even while dirty");
    assert.deepEqual(r.lsFiles, ["NOTES-local.txt"], "an untracked stray root file is surfaced");
    assert.equal(verdictOf(r).pass, false);
  }
  // Shape 3: the v3.104.2 escape (a root file left unstaged) STOPs; the fully staged tree is silent.
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e94-escape-"));
    initRepo(tmp);
    fs.mkdirSync(path.join(tmp, "tools"));
    fs.writeFileSync(path.join(tmp, "tools", "a.ts"), "x");
    fs.writeFileSync(path.join(tmp, "CONTRIBUTING.md"), "x");
    git(tmp, ["add", "--", "tools", "CONTRIBUTING.md"]);
    git(tmp, ["commit", "-q", "-m", "init"]);
    fs.writeFileSync(path.join(tmp, "tools", "a.ts"), "x2");
    fs.writeFileSync(path.join(tmp, "CONTRIBUTING.md"), "x2");
    git(tmp, ["add", "--", "tools"]);
    const escape = runBoth(tmp);
    assert.deepEqual(escape.diff, ["CONTRIBUTING.md"]);
    assert.equal(verdictOf(escape).pass, false, "ESCAPE case must STOP");
    git(tmp, ["add", "--", "CONTRIBUTING.md"]);
    const pass = runBoth(tmp);
    assert.deepEqual([pass.diff, pass.lsFiles], [[], []], "PASS case must be silent once everything is staged");
    assert.equal(verdictOf(pass).pass, true);
  }
});

test("AC3: failure-mode wording is inverted — source dirs are EXPECTED, only UNRELATED paths STOP, with the verbatim message (AC-S6, UNRELATED_CHANGES)", () => {
  assert.ok(!SKILL.includes("release-artifact whitelist"), "the old 'release-artifact whitelist' framing must not return");
  for (const dir of FEATURE_DIRS) assert.equal(REL.checkScope([`${dir}some-file`]), null, `a change under ${dir} is EXPECTED, never a STOP`);
  assert.equal(
    REL.checkScope(["stray/file.txt"]),
    "Pre-existing uncommitted changes found in stray/file.txt — this path is unrelated to the active feature. Commit or stash it first.",
    "the verbatim AC3 stop-condition string, with the path filled in",
  );
  const row = exitRow(13, "UNRELATED_CHANGES");
  assert.ok(row, "SOP Escalation Routes carries the UNRELATED_CHANGES row");
  assert.deepEqual(row.slice(1), ["Blocked", "`<stop>` (path verbatim)", "—"]);
  assert.ok(HISTORY.includes("EXPECTED in a release commit"), "the old 'EXPECTED in a release commit' scope-rule wording lives in the history file (AC-P10)");
});

test("AC4 (E44/E142(b)): the spec-class check is conditional on dispatch shape — REQUIRE/MULTI-FEATURE/SKIP/UNCLASSIFIABLE, evaluated by the script BEFORE the commit over PREV_TAG..HEAD plus the stage plan, with the REQUIRE remedy 'Stage the missing files and re-run.' (AC-S4, AC-S6)", () => {
  // REQUIRE: byte-exact stop text; the remedy no longer says "amend" (no commit exists yet when this stops).
  const req = REL.classifySpecCheck({ feature: "f", unionFiles: [], specExists: () => true, prevTag: "v1.0.0" });
  assert.equal(req.branch, "REQUIRE");
  assert.equal(req.classId, "SPEC_REQUIRE");
  assert.equal(req.errorMsg, AC4_REQUIRE_STOP.replace("<active_feature>", "f"));
  assert.ok(AC4_REQUIRE_STOP.endsWith("Stage the missing files and re-run."));
  assert.ok(!/amend/i.test(req.errorMsg), "no commit exists at this check, so the remedy must not say amend");
  // UNCLASSIFIABLE: base string, distinct from REQUIRE.
  const unc = REL.classifySpecCheck({ feature: "f", unionFiles: [], specExists: () => false, scopeWhy: "", prevTag: "v1.0.0" });
  assert.equal(unc.branch, "UNCLASSIFIABLE");
  assert.equal(unc.classId, "SPEC_UNCLASSIFIABLE");
  assert.equal(unc.errorMsg, AC4_UNCLASSIFIABLE_STOP);
  assert.notEqual(AC4_REQUIRE_STOP, AC4_UNCLASSIFIABLE_STOP);
  // SKIP names itself in the log.
  const skip = REL.classifySpecCheck({ feature: "f", unionFiles: [], specExists: () => false, scopeWhy: MINI_CHAIN_SCOPE_WHY, prevTag: "v1.0.0" });
  assert.equal(skip.branch, "SKIP");
  assert.ok(skip.logs.some((l) => l.startsWith("AC4: SKIP branch")), "SKIP logs a line naming itself");
  // MULTI-FEATURE: M alone fires it; a named feature with no spec file is logged and skipped by design.
  const multi = REL.classifySpecCheck({ feature: "f", unionFiles: [], specExists: () => false, pendingNotes: ["Multi-feature release: a, b."], prevTag: "v1.0.0" });
  assert.equal(multi.branch, "MULTI-FEATURE");
  assert.ok(multi.pass);
  assert.ok(multi.logs.some((l) => l.startsWith("AC4: MULTI-FEATURE branch") && l.includes("logged and skipped by design")));
  // M or R: R alone (another feature spec in the range, no pending note) also fires MULTI-FEATURE; the note is optional.
  const r = REL.classifySpecCheck({ feature: "f", unionFiles: ["specs/f.md", "specs/g.md"], specExists: () => true, prevTag: "v1.0.0" });
  assert.equal(r.branch, "MULTI-FEATURE");
  const none = REL.classifySpecCheck({ feature: "f", unionFiles: ["specs/f.md"], specExists: () => true, prevTag: "v1.0.0" });
  assert.equal(none.branch, "REQUIRE", "neither M nor R: the single-feature branches decide");
  // Range-corrected: the true release range, never the single-commit HEAD~1 proxy, and before the commit.
  assert.ok(req.logs.concat(skip.logs, multi.logs).length > 0);
  assert.ok(!RELEASE_SRC.includes("HEAD~1"), "the script never measures a single-commit proxy");
  assert.match(RELEASE_SRC, /`\$\{prevTag\}\.\.HEAD`/, "the range is PREV_TAG..HEAD");
  const stepOrder = RELEASE_SRC.match(/const PHASES = \{\s*prepare: \[([^\]]*)\]/)[1].split(",").map((x) => x.trim());
  assert.ok(stepOrder.indexOf("step8aSpecs") > -1 && stepOrder.indexOf("step8aSpecs") < stepOrder.indexOf("step8aCommitPushPr"), "AC4 classes are evaluated before the commit");
  // SOP: both stop classes are Escalation rows; the old four-branch prose and range command live in the history file.
  assert.ok(exitRow(32, "SPEC_REQUIRE") && exitRow(33, "SPEC_UNCLASSIFIABLE"), "SOP Escalation Routes carries both spec-class rows");
  for (const old of ["Stage missing files and amend or create a fix commit.", "WHEN M OR R holds", "That line is optional extra input, never required", "git diff \"$PREV_TAG\"..HEAD --name-only"]) {
    assert.ok(HISTORY.includes(old), `history keeps the old AC4 text: ${old}`);
  }
});

test("AC5: release-engineer.md shim contains a reinforcement hint (<=2 sentences)", () => {
  // Contract: the shim must remind haiku-tier that staging scope = all upstream work,
  // not just files edited in the current turn. The hint is <=2 sentences and must
  // NOT alter the watermark line or the tw_get_state/tw_switch_role invocation.
  // Watermark line is now tier-agnostic (v3.58.0, C5a re-baseline) — see
  // test/subagent-templates.test.mjs v3.21.1/v3.21.2 for the rationale.
  assert.match(
    SHIM,
    /ALL uncommitted upstream work/,
    "shim must mention 'ALL uncommitted upstream work' in the hint (AC5)",
  );
  assert.match(
    SHIM,
    /not just files you edited this turn/,
    "shim must clarify 'not just files you edited this turn' (AC5)",
  );
  // Watermark line must be preserved verbatim
  assert.match(
    SHIM,
    /CRITICAL: End every reply with `— @release-engineer \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\./,
    "shim watermark line must be preserved verbatim (AC5)",
  );
  // tw_get_state / tw_switch_role invocations must be preserved
  assert.match(SHIM, /tw_get_state/, "shim must preserve tw_get_state instruction (AC5)");
  assert.match(SHIM, /tw_switch_role/, "shim must preserve tw_switch_role instruction (AC5)");
  // Hint length: extract it and count sentences (rough heuristic: periods/! after a word)
  // The reinforcement hint is the third non-frontmatter paragraph.
  // We verify the whole shim body is not bloated — shim should stay compact.
  const bodyLines = SHIM.split("\n").filter((l) => l.trim() && !l.startsWith("---") && !l.startsWith("#"));
  const hintLine = bodyLines.find(
    (l) => l.includes("ALL uncommitted upstream work") || l.includes("Staging scope"),
  );
  assert.ok(hintLine, "shim must have a hint line about staging scope (AC5)");
  // Count sentences in the hint line (split on '. ' or '.' at end-of-string)
  const sentences = hintLine.split(/\.\s+|\.$/).filter(Boolean);
  assert.ok(
    sentences.length <= 2,
    `shim hint must be <=2 sentences; found ${sentences.length}: ${hintLine} (AC5)`,
  );
});

// ---------------------------------------------------------------------------
// Phase 2 — Behavioral-simulation fixtures (AC6 / spec §Design Decisions §5)
// ---------------------------------------------------------------------------

test("Fixture A (AC2, AC6): metadata-only staged output triggers FAIL when source dirs have changes", () => {
  // Simulate: git status shows content/ and specs/ have uncommitted changes,
  // but git diff --cached --stat shows only metadata files staged.
  // Expected: simulatePreCommitVerify returns FAIL with missing dirs listed.

  const gitStatusShort = [
    " M content/skill-release-engineer.md",
    " M specs/release-engineer-complete-staging.md",
    " M templates/claude-code-agents/release-engineer.md",
    " M package.json",
    " M index.ts",
    " M CHANGELOG.md",
    " M dist/index.js",
  ].join("\n");

  const gitDiffCachedStat = [
    // Only metadata files staged — source dirs absent
    " package.json         |  2 +-",
    " index.ts             |  2 +-",
    " CHANGELOG.md         |  8 ++++++++",
    " README.md            |  4 ++--",
    " dist/index.js        | 10 +++++-----",
    " 5 files changed, 14 insertions(+), 6 deletions(-)",
  ].join("\n");

  const result = simulatePreCommitVerify(gitStatusShort, gitDiffCachedStat);
  assert.equal(result.pass, false, "Fixture A: metadata-only staging must produce FAIL");
  assert.ok(result.missing.includes("content/"), "Fixture A: content/ must be in missing list");
  assert.ok(result.missing.includes("specs/"), "Fixture A: specs/ must be in missing list");
  assert.ok(result.missing.includes("templates/"), "Fixture A: templates/ must be in missing list");
  assert.equal(result.missing.length, 3, "Fixture A: exactly 3 source dirs must be flagged as missing");
});

test("Fixture B (AC1, AC3, AC6): complete staging passes pre-commit verify", () => {
  // Simulate: git status shows all feature dirs have changes,
  // and git diff --cached --stat shows them all staged.
  // Expected: simulatePreCommitVerify returns pass=true, no missing dirs.

  const gitStatusShort = [
    " M content/skill-release-engineer.md",
    " M templates/claude-code-agents/release-engineer.md",
    " M specs/release-engineer-complete-staging.md",
    " M test/release-staging.test.mjs",
    " M qa_reports/review_T460-T462.md",
    " M package.json",
    " M index.ts",
    " M CHANGELOG.md",
    " M dist/index.js",
  ].join("\n");

  const gitDiffCachedStat = [
    " content/skill-release-engineer.md    | 18 ++++++++++--------",
    " templates/claude-code-agents/release-engineer.md |  3 +++",
    " specs/release-engineer-complete-staging.md | 117 ++++++++++++++",
    " test/release-staging.test.mjs        | 210 +++++++++++++++++++++++",
    " qa_reports/review_T460-T462.md       |  42 +++++",
    " package.json                         |   2 +-",
    " index.ts                             |   2 +-",
    " CHANGELOG.md                         |   8 +++++++",
    " dist/index.js                        |  10 ++++--",
    " 9 files changed, 399 insertions(+), 15 deletions(-)",
  ].join("\n");

  const result = simulatePreCommitVerify(gitStatusShort, gitDiffCachedStat);
  assert.equal(result.pass, true, "Fixture B: complete staging must produce PASS");
  assert.equal(result.missing.length, 0, "Fixture B: no feature dirs should be flagged as missing");
});

test("Fixture I (AC2, E64): an unstaged gates/ change is now CAUGHT — the exact scenario that nearly shipped during v3.100.0 and was only caught by AC2's manual step", () => {
  // Simulate: git status shows gates/registry.ts changed, but git diff
  // --cached --stat shows only package.json staged (gates/ forgotten).
  // Before E64 (gates/ absent from FEATURE_DIRS), this fixture would have
  // produced a false PASS — the test-side blindness mirroring the SOP-side
  // defect E64 fixes. With gates/ in FEATURE_DIRS, it must FAIL.
  const gitStatusShort = [" M gates/registry.ts", " M package.json"].join("\n");
  const gitDiffCachedStat = [" package.json | 2 +-", " 1 file changed, 1 insertion(+), 1 deletion(-)"].join("\n");

  const result = simulatePreCommitVerify(gitStatusShort, gitDiffCachedStat);
  assert.equal(result.pass, false, "Fixture I: an unstaged gates/ change must produce FAIL");
  assert.ok(result.missing.includes("gates/"), "Fixture I: gates/ must be in the missing list");
  assert.equal(result.missing.length, 1, "Fixture I: exactly one dir (gates/) must be flagged as missing");
});

test("Fixture C (AC4/REQUIRE, AC6): REQUIRE branch fires with verbatim AC4 error when spec exists in tree but is absent from the commit", () => {
  // Simulate a PM/architect-chain release: specs/release-engineer-complete-staging.md
  // exists in the tree, but git diff HEAD~1 --name-only shows metadata bumps only.
  // Expected: simulatePostCommitCheck returns pass=false, branch=REQUIRE, with the
  // exact byte-identical error text from before the conditional check existed (E44, AC4).

  const activeFeature = "release-engineer-complete-staging";
  const gitDiffHeadNameOnly = [
    "CHANGELOG.md",
    "README.md",
    "dist/index.js",
    "index.ts",
    "package.json",
  ].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ true, /* scopeDecisionWhy */ "");
  assert.equal(result.pass, false, "Fixture C: missing spec file must produce FAIL");
  assert.equal(result.branch, "REQUIRE", "Fixture C: spec-in-tree must select the REQUIRE branch");
  assert.equal(
    result.errorMsg,
    "Release commit incomplete: specs/release-engineer-complete-staging.md is absent from the release range <prev-tag>..HEAD. Stage the missing files and re-run.",
    "Fixture C: error message must match verbatim AC4 error string",
  );
});

test("Fixture D (AC4/REQUIRE, AC6): REQUIRE branch passes silently when spec file exists in tree and is present in the commit", () => {
  // Simulate: specs/release-engineer-complete-staging.md exists in the tree and
  // git diff HEAD~1 --name-only includes it.
  // Expected: simulatePostCommitCheck returns pass=true, branch=REQUIRE, no error.

  const activeFeature = "release-engineer-complete-staging";
  const gitDiffHeadNameOnly = [
    "CHANGELOG.md",
    "README.md",
    "content/skill-release-engineer.md",
    "dist/index.js",
    "index.ts",
    "package.json",
    "qa_reports/review_T460-T462.md",
    "specs/release-engineer-complete-staging.md",
    "templates/claude-code-agents/release-engineer.md",
    "test/release-staging.test.mjs",
  ].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ true, /* scopeDecisionWhy */ "");
  assert.equal(result.pass, true, "Fixture D: spec file present must produce PASS");
  assert.equal(result.branch, "REQUIRE", "Fixture D: spec-in-tree must select the REQUIRE branch");
  assert.equal(result.errorMsg, null, "Fixture D: no error message when spec file is present");
});

test("Fixture E (AC4/SKIP, AC6): SKIP branch passes when no spec exists in the tree and scope_decision_why records a mini-chain", () => {
  // Simulate this repo's own dispatch shape: no specs/<active_feature>.md
  // anywhere, scope_decision_why records a backlog-row-as-spec mini-chain.
  const activeFeature = "e44-e49-release-sop-conditional-checks";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "content/skill-release-engineer.md", "index.ts", "package.json"].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ false, MINI_CHAIN_SCOPE_WHY);
  assert.equal(result.pass, true, "Fixture E: no spec in tree + mini-chain scope_decision_why must produce PASS");
  assert.equal(result.branch, "SKIP", "Fixture E: must select the SKIP branch");
  assert.equal(result.errorMsg, null, "Fixture E: SKIP branch never emits a STOP error message");
});

test("Fixture F (AC4/UNCLASSIFIABLE, AC6): UNCLASSIFIABLE branch fires with the verbatim string when scope_decision_why is empty", () => {
  const activeFeature = "some-untracked-feature";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "index.ts", "package.json"].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ false, /* scopeDecisionWhy */ "");
  assert.equal(result.pass, false, "Fixture F: no spec in tree + empty scope_decision_why must produce FAIL");
  assert.equal(result.branch, "UNCLASSIFIABLE", "Fixture F: must select the UNCLASSIFIABLE branch");
  assert.equal(
    result.errorMsg,
    AC4_UNCLASSIFIABLE_STOP,
    "Fixture F: error message must match the verbatim UNCLASSIFIABLE string, including the F6 remedy clause",
  );
});

test("Fixture G (AC4/UNCLASSIFIABLE, AC6): UNCLASSIFIABLE branch also fires when scope_decision_why is non-empty but does not record a mini-chain", () => {
  const activeFeature = "some-untracked-feature";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "index.ts", "package.json"].join("\n");

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ false, FULL_CHAIN_SCOPE_WHY);
  assert.equal(result.pass, false, "Fixture G: no spec in tree + non-mini-chain scope_decision_why must produce FAIL");
  assert.equal(result.branch, "UNCLASSIFIABLE", "Fixture G: must select the UNCLASSIFIABLE branch");
  assert.equal(
    result.errorMsg,
    AC4_UNCLASSIFIABLE_STOP,
    "Fixture G: error message must match the verbatim UNCLASSIFIABLE string even with non-empty, non-mini-chain scope_decision_why text",
  );
});

test("Fixture H (AC4/REQUIRE non-weakening, F6): spec-in-tree wins over SKIP even when scope_decision_why records a mini-chain", () => {
  // This is the pin the round-1/round-2 review explicitly required: a PM-chain
  // release with a missing spec must still hard-STOP even if, by whatever
  // accident, scope_decision_why also happens to read like a mini-chain record.
  // REQUIRE is keyed on the spec's existence in the tree, never on the
  // mini-chain signal — the two are not weighed against each other.
  const activeFeature = "release-engineer-complete-staging";
  const gitDiffHeadNameOnly = ["CHANGELOG.md", "index.ts", "package.json"].join("\n"); // spec absent from commit

  const result = simulatePostCommitCheck(gitDiffHeadNameOnly, activeFeature, /* specExistsInTree */ true, MINI_CHAIN_SCOPE_WHY);
  assert.equal(result.pass, false, "Fixture H: spec-in-tree + missing-from-commit must still FAIL even with mini-chain scope_decision_why");
  assert.equal(result.branch, "REQUIRE", "Fixture H: spec-in-tree must win over SKIP regardless of scope_decision_why");
  assert.equal(
    result.errorMsg,
    "Release commit incomplete: specs/release-engineer-complete-staging.md is absent from the release range <prev-tag>..HEAD. Stage the missing files and re-run.",
    "Fixture H: the STOP string must be byte-identical to the current AC4 wording — unweakened by the mini-chain signal",
  );
});

// ---------------------------------------------------------------------------
// Fixtures I/J/K: multi-feature releases (AC4 MULTI-FEATURE branch, E142(b)),
// modelled on the real v3.113.0 pending note. Only the first named feature has
// a spec under specs/; the other two are mini-chain tickets, the "logged and
// skipped by design" case.
// ---------------------------------------------------------------------------
const V3113_PENDING_NOTES =
  "Multi-feature release: e109-workspace-feature-anchoring (E109+E146), e145-md-tables-cited-donemark, e148-stamp-provenance-test-flake.";
const V3113_SPECS_IN_TREE = { "e109-workspace-feature-anchoring": true }; // the other two named features have no spec file (e145, e148)

test("Fixture I (AC4/MULTI-FEATURE, AC5): named features with no spec file are logged-and-skipped by design (E142(b) Decision) — the real v3.113.0 shape passes", () => {
  const gitDiffRange = ["CHANGELOG.md", "specs/e109-workspace-feature-anchoring.md", "content/coord-03-core-fallback.md"].join("\n");
  const result = simulatePostCommitCheck(
    gitDiffRange,
    "e148-stamp-provenance-test-flake", // active_feature = the wave's LAST feature, per E44's own limitation
    /* specExistsInTree for active_feature alone */ false,
    /* scopeDecisionWhy */ "",
    V3113_PENDING_NOTES,
    V3113_SPECS_IN_TREE,
  );
  assert.equal(result.pass, true, "Fixture I: e109's spec is present in range, e145/e148 have no spec to check — must PASS");
  assert.equal(result.branch, "MULTI-FEATURE", "Fixture I: pending_notes recording a multi-feature release must select MULTI-FEATURE");
  assert.equal(result.errorMsg, null, "Fixture I: no STOP when every existing named spec is present in range");
});

test("Fixture J (AC4/MULTI-FEATURE, AC5): a named feature whose spec DOES exist but is absent from the range STOPs, naming that feature's spec path", () => {
  const gitDiffRange = ["CHANGELOG.md", "content/coord-03-core-fallback.md"].join("\n"); // the anchoring feature's spec file is absent from the diff range (e109)
  const result = simulatePostCommitCheck(
    gitDiffRange,
    "e148-stamp-provenance-test-flake",
    false,
    "",
    V3113_PENDING_NOTES,
    V3113_SPECS_IN_TREE,
  );
  assert.equal(result.pass, false, "Fixture J: e109's spec exists in the tree but is absent from the range — must FAIL");
  assert.equal(result.branch, "MULTI-FEATURE");
  assert.equal(
    result.errorMsg,
    "Release commit incomplete: specs/e109-workspace-feature-anchoring.md is absent from the release range <prev-tag>..HEAD. Stage the missing files and re-run.",
    "Fixture J: STOP must name the offending named feature's spec path, same message shape as REQUIRE",
  );
});

test("Fixture K (AC4/MULTI-FEATURE non-weakening): MULTI-FEATURE fires regardless of the active feature's own specExistsInTree or scope_decision_why", () => {
  // MULTI-FEATURE is a totally separate detection path (code-reviewer round 2,
  // finding F1): it must never fall through to REQUIRE or SKIP/UNCLASSIFIABLE just
  // because the active_feature itself has (or lacks) a spec, or because
  // scope_decision_why happens to read like a mini-chain record.
  const gitDiffRange = ["CHANGELOG.md", "specs/e109-workspace-feature-anchoring.md"].join("\n");
  for (const [specExistsInTree, scopeDecisionWhy] of [
    [true, ""],
    [true, MINI_CHAIN_SCOPE_WHY],
    [false, MINI_CHAIN_SCOPE_WHY],
    [false, ""],
  ]) {
    const result = simulatePostCommitCheck(
      gitDiffRange,
      "some-active-feature",
      specExistsInTree,
      scopeDecisionWhy,
      V3113_PENDING_NOTES,
      V3113_SPECS_IN_TREE,
    );
    assert.equal(
      result.branch,
      "MULTI-FEATURE",
      `MULTI-FEATURE must fire regardless of specExistsInTree=${specExistsInTree}/scope_decision_why=${JSON.stringify(scopeDecisionWhy)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// E152 fixtures: range-derived feature set (option A). R fires without M.
// ---------------------------------------------------------------------------
test("Fixture L (AC-E152-2, the E152 defect): two feature specs in the range and NO pending_notes line -> MULTI-FEATURE, both specs reported, pass", () => {
  const gitDiffRange = ["CHANGELOG.md", "specs/e-active.md", "specs/e-sibling.md"].join("\n");
  const result = simulatePostCommitCheck(gitDiffRange, "e-active", true, "", /* no Multi-feature release line */ "");
  assert.equal(result.branch, "MULTI-FEATURE", "range carrying a second feature spec must select MULTI-FEATURE without the pending_notes line");
  assert.equal(result.pass, true);
  assert.equal(result.errorMsg, null);
  assert.deepEqual(
    [...result.rangeDerived].sort(),
    ["specs/e-active.md", "specs/e-sibling.md"],
    "both spec paths must be reported as verified",
  );
});

test("Fixture M (AC-E152-3, R without M): active spec in tree but absent from the range -> STOP with the byte-identical REQUIRE string", () => {
  const gitDiffRange = ["CHANGELOG.md", "specs/e-sibling.md"].join("\n");
  const result = simulatePostCommitCheck(gitDiffRange, "e-active", true, "");
  assert.equal(result.pass, false);
  assert.equal(
    result.errorMsg,
    AC4_REQUIRE_STOP.replace("specs/<active_feature>.md", "specs/e-active.md"),
    "R-only must not weaken the active feature's REQUIRE check",
  );
});

test("Fixture N (AC-E152-3, R without M): no active spec and no mini-chain record -> STOP with the verbatim UNCLASSIFIABLE string", () => {
  const gitDiffRange = ["CHANGELOG.md", "specs/e-sibling.md"].join("\n");
  const result = simulatePostCommitCheck(gitDiffRange, "e-active", false, "");
  assert.equal(result.pass, false);
  assert.equal(result.errorMsg, AC4_UNCLASSIFIABLE_STOP);
});

test("Fixture O (AC-E152-3, R without M): no active spec and a mini-chain record -> pass", () => {
  const gitDiffRange = ["CHANGELOG.md", "specs/e-sibling.md"].join("\n");
  const result = simulatePostCommitCheck(gitDiffRange, "e-active", false, MINI_CHAIN_SCOPE_WHY);
  assert.equal(result.pass, true);
  assert.equal(result.branch, "MULTI-FEATURE");
  assert.equal(result.errorMsg, null);
});

test("Fixture P (AC-E152-6): fanout-*, *-architecture and nested specs are excluded from the derived set, so R is false and the check stays single-feature", () => {
  const gitDiffRange = [
    "specs/fanout-x.md",
    "specs/e-active-architecture.md",
    "specs/e-active.md",
    "specs/abandoned/lane/e-other.md",
  ].join("\n");
  assert.deepEqual(deriveRangeSpecs(gitDiffRange), ["specs/e-active.md"]);
  const result = simulatePostCommitCheck(gitDiffRange, "e-active", true, "");
  assert.equal(result.branch, "REQUIRE", "R false -> exactly the pre-E152 single-feature REQUIRE branch");
  assert.equal(result.pass, true);
});

test("AC4 branch exhaustiveness: exactly one of REQUIRE/MULTI-FEATURE/SKIP/UNCLASSIFIABLE fires for every (specExistsInTree x recordsMultiFeature x rangeCarriesOtherSpec x recordsMiniChain) combination (16)", () => {
  const activeFeature = "exhaustiveness-check-feature";
  // Re-derivation (E152): MULTI-FEATURE = M or R (any S/W), REQUIRE = S and not M and not R,
  // SKIP = not S, not M, not R, W; UNCLASSIFIABLE = not S, not M, not R, not W. All 16 (S,M,R,W)
  // assignments covered, branches pairwise exclusive.
  const combos = [];
  for (const S of [true, false]) {
    for (const M of [true, false]) {
      for (const R of [true, false]) {
        for (const W of [true, false]) {
          const expectedBranch = M || R ? "MULTI-FEATURE" : S ? "REQUIRE" : W ? "SKIP" : "UNCLASSIFIABLE";
          combos.push({ S, M, R, W, expectedBranch });
        }
      }
    }
  }
  assert.equal(combos.length, 16);
  const seenBranches = new Set();
  for (const { S, M, R, W, expectedBranch } of combos) {
    const pendingNotes = M ? V3113_PENDING_NOTES : "";
    // The range carries every spec the combination needs so the pin isolates
    // branch SELECTION, not the MULTI-FEATURE STOP/PASS sub-outcome (Fixtures
    // I/J/L-O cover that): the active spec when S, the line-named spec when M,
    // another feature's spec when R.
    const range = [];
    if (S) range.push(`specs/${activeFeature}.md`);
    if (M) range.push("specs/e109-workspace-feature-anchoring.md");
    if (R) range.push("specs/some-other-feature.md");
    const result = simulatePostCommitCheck(
      range.join("\n"),
      activeFeature,
      S,
      W ? MINI_CHAIN_SCOPE_WHY : "",
      pendingNotes,
      V3113_SPECS_IN_TREE,
    );
    assert.equal(
      result.branch,
      expectedBranch,
      `S=${S}, M=${M}, R=${R}, W=${W} must yield branch=${expectedBranch}, got ${result.branch}`,
    );
    seenBranches.add(result.branch);
  }
  assert.deepEqual(
    [...seenBranches].sort(),
    ["MULTI-FEATURE", "REQUIRE", "SKIP", "UNCLASSIFIABLE"],
    "all four branches must be reachable, and exactly one must fire per combination (total + mutually exclusive)",
  );
});

// ---------------------------------------------------------------------------
// Phase 3 — Repo-scan guard: no source dir silently falls out of releases
// ---------------------------------------------------------------------------

test("AC-B5.5: every repo source directory appears in FEATURE_DIRS or metadata list", () => {
  // The expected source dirs come from tsconfig.json `include`, so a new
  // source directory fails this guard with no test-side list to update. The
  // hand-kept list it replaced is how transport/ slipped out of v3.24.0 staging.
  const tsconfigPath = path.join(ROOT, "tsconfig.json");
  const tsconfigDirs = getTsConfigSourceDirs(tsconfigPath);

  // The helper returns dir names without trailing slashes; FEATURE_DIRS uses
  // trailing slashes — normalise before comparing.
  const tsconfigDirsWithSlash = tsconfigDirs.map((d) => `${d}/`);

  const missing = tsconfigDirsWithSlash.filter((d) => !FEATURE_DIRS.includes(d));
  assert.deepEqual(
    missing,
    [],
    `Source directories from tsconfig.json missing from FEATURE_DIRS: ${missing.join(", ")}. ` +
    `Add them to FEATURE_DIRS in this test and to the git add enumeration in content/skill-release-engineer.md.`,
  );

  // Sanity: the helper must return at least the six dirs known to be in tsconfig
  // at the time this test was written — guards against a broken import or a
  // tsconfig that was accidentally emptied.
  const knownDirs = ["tools/", "guards/", "prompts/", "schema/", "transport/", "lib/"];
  for (const d of knownDirs) {
    assert.ok(
      tsconfigDirsWithSlash.includes(d),
      `getTsConfigSourceDirs must return '${d}' (present in tsconfig.json include at B6 authoring time)`,
    );
  }
});

test("Partition (E66, T-E66-02): every top-level repo directory is classified in exactly one of FEATURE_DIRS / NON_SOURCE_DIRS", () => {
  // FEATURE_DIRS and NON_SOURCE_DIRS are kept by hand, and a hand-kept list
  // goes stale silently. This enumerates the real top-level dirs and asserts
  // each is classified, so a new directory fails here instead of going unstaged.
  // It uses `git ls-files`: `ls -d */` hides dot-dirs, and a raw readdir would
  // pick up untracked local scratch dirs and vary by machine.
  const trackedTopDirs = execSync("git ls-files", { cwd: ROOT, encoding: "utf-8" })
    .split("\n")
    .filter(Boolean)
    .filter((p) => p.includes("/"))
    .map((p) => `${p.split("/")[0]}/`);
  const diskDirs = new Set(trackedTopDirs);

  // node_modules/ is real, load-bearing infrastructure — this very test run
  // depends on it — but is deliberately untracked (repo .gitignore), so
  // `git ls-files` alone can never surface it. Add it explicitly, gated on
  // its actually existing on disk rather than assumed unconditionally.
  if (fs.existsSync(path.join(ROOT, "node_modules"))) {
    diskDirs.add("node_modules/");
  }

  // Disjointness: a directory hand-classified into BOTH lists is a defect in
  // the lists themselves, independent of what's on disk right now.
  const overlap = FEATURE_DIRS.filter((d) => NON_SOURCE_DIRS.includes(d));
  assert.deepEqual(
    overlap,
    [],
    `FEATURE_DIRS and NON_SOURCE_DIRS must be disjoint; found in both: ${JSON.stringify(overlap)}`,
  );

  // Full coverage: every on-disk top-level directory lands in exactly one of
  // the two lists (disjointness above + this membership check together give
  // "exactly one").
  const partition = new Set([...FEATURE_DIRS, ...NON_SOURCE_DIRS]);
  const uncovered = [...diskDirs].filter((d) => !partition.has(d));
  assert.deepEqual(
    uncovered,
    [],
    `every top-level tracked repo directory must be classified in FEATURE_DIRS or NON_SOURCE_DIRS; ` +
    `uncovered: ${JSON.stringify(uncovered)} — classify it in test/release-staging.test.mjs and, if it is ` +
    `feature source, add it to the three SOP enumeration sites in content/skill-release-engineer.md`,
  );
});

// ---------------------------------------------------------------------------
// Phase 4 — release-engineer handoff write path (specs/c13-release-engineer-write-path.md)
// ---------------------------------------------------------------------------
// The SOP must STOP on any tw_* rejection instead of hand-editing handoff.md
// or tasks.md, and the shim must repeat it with a driftBaselineIds reminder.
// We pin load-bearing substrings, not paragraphs, so rewording passes but
// removal fails.

test("C13-AC5: the SOP's STOP-on-⛔ rule survives (hand-edit ban included); the verbatim original lives in the history file (AC-P4, AC-P10)", () => {
  assert.match(SKILL, /\*\*STOP on ⛔\*\*: any ⛔ rejection from a `tw_\*` call STOPs \(Constitution §3\)/, "the rule opens with the STOP");
  assert.match(SKILL, /never hand-edit `\.current\/<lane>\/handoff\.md` or `tasks\.md` to work around one/, "the hand-edit ban names both files");
  assert.ok(HISTORY.includes("On any ⛔ rejection from any tw_* tool call (including but not limited to TRANSITION_REJECTED), STOP immediately and hand back to the coordinator/human."));
  assert.ok(HISTORY.includes("NEVER hand-edit .current/<lane>/handoff.md or tasks.md directly to work around a rejection"));
  assert.ok(sopRow(/^⛔ rejection from any `tw_\*` call/), "SOP Escalation Routes carries the ⛔ row");
});

test("C13-AC5: skill-release-engineer.md no longer contains the old stamp-as-upstream-caller workaround language", () => {
  // Contract: AC5 requires the "Side-channel constraint" bullet to be
  // REPLACED — release-engineer now stamps agent_id="release-engineer"
  // directly, not "the upstream caller's identifier".
  assert.ok(
    !SKILL.includes("the upstream caller's identifier"),
    "skill-release-engineer.md must NOT retain the old stamp-as-upstream-caller workaround phrasing (C13-AC5)",
  );
});

test("C13-AC6/AC7: release-engineer.md shim contains the verbatim STOP-on-⛔ reinforcement hint", () => {
  // Contract: AC6.1 — a STOP-on-⛔-rejection reminder mirroring AC5's Hard
  // rule, ≤2 sentences, present in the template shim (not just the skill
  // file) so haiku-tier context-budget pressure can't drop it.
  assert.match(
    SHIM,
    /CRITICAL: On any ⛔ rejection from any tw_\* tool call, STOP immediately and hand back to the coordinator\/human\./,
    "release-engineer.md shim must contain the verbatim STOP-on-⛔ reinforcement hint (C13-AC6/AC7)",
  );
  assert.match(
    SHIM,
    /NEVER hand-edit `\.current\/handoff\.md` or `tasks\.md` to work around a rejection\./,
    "release-engineer.md shim must forbid hand-editing both handoff.md and tasks.md verbatim (C13-AC6/AC7)",
  );
});

test("C13-AC6/AC7: release-engineer.md shim contains the verbatim driftBaselineIds reinforcement hint", () => {
  // Contract: AC6.2 — a driftBaselineIds append reminder mirroring SOP step
  // 10/9's text, addressing the incident's third defect (the step existed
  // but was skipped under haiku-tier load with no shim-level anchor).
  assert.match(
    SHIM,
    /append this release's shipped task IDs to `driftBaselineIds`/,
    "release-engineer.md shim must remind to append shipped task IDs to driftBaselineIds (C13-AC6/AC7)",
  );
  assert.match(
    SHIM,
    /Skipping it makes every shipped task resurface as drift noise next session\./,
    "release-engineer.md shim must state the consequence of skipping the driftBaselineIds append verbatim (C13-AC6/AC7)",
  );
});

test("C13-AC6: shim watermark and tw_get_state/tw_switch_role invocation lines are unaltered by the new hints", () => {
  // Contract: AC6 explicitly forbids altering the watermark line or the
  // tw_get_state / tw_switch_role instruction while adding the two hints.
  // Watermark line is now tier-agnostic (v3.58.0, C5a re-baseline).
  assert.match(
    SHIM,
    /CRITICAL: End every reply with `— @release-engineer \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\./,
    "shim watermark line must be preserved verbatim (C13-AC6)",
  );
  assert.match(
    SHIM,
    /call `tw_get_state` then `tw_switch_role\("release-engineer"\)`/,
    "shim tw_get_state/tw_switch_role invocation line must be preserved verbatim (C13-AC6)",
  );
});

// ---------------------------------------------------------------------------
// Phase 5 — release-engineer git-stop rule (specs/d10-release-engineer-git-stop-rule.md)
// ---------------------------------------------------------------------------
// After a non-fast-forward push, the SOP forbids destructive git recovery and
// routes to Blocked with the local release-commit SHA; the shim mirrors it.
// Substrings are pinned, as above, so rewording passes but removal fails.

test("D10-AC1: a push rejection or collision STOPs and the allow-list refuses destructive git recovery (reset, rebase, checkout --force, clean) (AC-P4, AC-S3)", () => {
  assert.match(SKILL, /Never force-push; tags are immutable/);
  assert.match(SKILL, /A push rejection, collision or any `RELEASE_STOP` is a Blocked write carrying the branch and local sha, never a recovery command\./);
  for (const args of [["reset", "--hard", "HEAD~1"], ["rebase", "main"], ["checkout", "--force", "main"], ["clean", "-fd"]]) {
    assert.equal(REL.isAllowed("git", args, { branch: "release/v1.0.0" }), false, `git ${args.join(" ")} must be refused by the script's allow-list`);
  }
  assert.ok(HISTORY.includes("STOP immediately — NEVER run `git reset`, `git rebase`, `git checkout --force`, or `git clean` to work around it."));
});

test("D10-AC2: a rejected push is a Blocked write with the branch and local sha, handing back (never self-recovery); the script names both in its stop (AC-P4, AC-P6)", () => {
  const row = exitRow(34, "PUSH_REJECTED");
  assert.ok(row, "SOP Escalation Routes carries the PUSH_REJECTED row");
  assert.deepEqual(row.slice(1), ["Blocked", "`<stop>` + branch, local sha", "—"]);
  assert.match(SKILL, /`—` in `next_role` = omit the field: the status hands back to the human/);
  assert.match(fnSrc("failedAt"), /on \$\{ctx\.runner\.branch\} at \$\{head\}/, "the script's stop names the branch and the local head sha");
  assert.ok(HISTORY.includes("write `status=Blocked` with the local release-commit SHA in `pending_notes`"));
  assert.ok(HISTORY.includes("and hand back for coordinator recovery."));
});

test("D10-AC1/AC2: the worked pending_notes example and the incident-reason clause moved to the history file; the SOP keeps a compact pending-note per exit class (AC-P10)", () => {
  assert.ok(HISTORY.includes('pending_notes=["release-engineer: push rejected (non-fast-forward) — local release commit <sha> not on remote, needs coordinator recovery"]'));
  assert.ok(HISTORY.includes("Reason (D10): a haiku-tier release-engineer hit exactly this collision, aborted a rebase, and ran `git reset HEAD~1`, discarding its own committed release — only the reflog made recovery possible."));
  assert.ok(!SKILL.includes("haiku-tier"), "the incident narrative is not inline in the SOP");
  assert.match(SKILL, /`<stop>` = `release-engineer: <CLASS_ID> \(exit <code>\) — <detail>`/, "the SOP defines the pending-note shape once");
});

test("D10-AC3: the Escalation Routes table has the push-rejection / collision row (Blocked, branch + local sha note, hand back to the human) (AC-P6)", () => {
  const push = exitRow(34, "PUSH_REJECTED");
  assert.ok(push);
  assert.equal(push[1], "Blocked");
  assert.match(push[2], /branch, local sha/);
  assert.equal(push[3], "—", "next_role omitted = the status hands back to the human");
  const mut = exitRow(35, "MUTATION_FAILED");
  assert.ok(mut && mut[1] === "Blocked" && /branch, local sha/.test(mut[2]), "a failed mutation carries the same note");
  assert.ok(HISTORY.includes("non-fast-forward push rejection / concurrent-release collision (D10) | Blocked |"), "the old D10 row lives in the history file");
});

test("D10-AC4: release-engineer.md shim contains the verbatim D10 reinforcement hint (<=2 sentences)", () => {
  // Contract: the shim must mirror the Hard rule's STOP instruction and
  // forbidden-command list as a compact reinforcement hint in the same style as the earlier write-path hints (C13) —
  // the anchor that survives even under haiku-tier context pressure.
  const hint =
    "CRITICAL: On any non-fast-forward push rejection or concurrent-release collision, STOP — NEVER `git reset`, `git rebase`, `git checkout --force`, or `git clean`. Write `status=Blocked` with the local release commit SHA in `pending_notes` and hand back to the coordinator/human for recovery.";
  assert.ok(
    SHIM.includes(hint),
    "release-engineer.md shim must contain the verbatim D10 reinforcement hint (D10-AC4)",
  );
  const sentences = hint.split(/\.\s+|\.$/).filter(Boolean);
  assert.ok(
    sentences.length <= 2,
    `D10 shim hint must be <=2 sentences; found ${sentences.length} (D10-AC4)`,
  );
});

test("D10-AC4: shim watermark and tw_get_state/tw_switch_role invocation lines are unaltered by the D10 hint", () => {
  // Contract: AC4 explicitly forbids altering the watermark line or the
  // tw_get_state/tw_switch_role instruction while adding the D10 hint —
  // same non-regression guard as the C13 hints above, re-asserted here so a
  // future edit specifically to the D10 hint region can't silently clobber
  // either anchor line.
  assert.match(
    SHIM,
    /CRITICAL: End every reply with `— @release-engineer \(<the model tier you were actually invoked with>\)` per Constitution §1 \(watermark\)\./,
    "shim watermark line must be preserved verbatim (D10-AC4)",
  );
  assert.match(
    SHIM,
    /call `tw_get_state` then `tw_switch_role\("release-engineer"\)`/,
    "shim tw_get_state/tw_switch_role invocation line must be preserved verbatim (D10-AC4)",
  );
});

// ---------------------------------------------------------------------------
// Phase 5.5 — release-engineer:Blocked must be reachable (E53)
// ---------------------------------------------------------------------------
// The SOP told release-engineer to halt with `status=Blocked`, but the server
// had no edge into that state. E53 opened the edge (pinned in test/qa-flow.test.mjs)
// and removed the SOP's "unreachable" claims. These tests cover the content side.
// Background: specs/e260h-comment-rationale.md (test/release-staging.test.mjs).

test("E53: zero remaining claims that release-engineer:Blocked is unreachable", () => {
  // Contract: both pre-E53 falsehoods must be gone. Pinned as exact substrings
  // (not a generic /unreachable/i sweep) so a legitimate FUTURE use of the
  // word "unreachable" elsewhere in the file (e.g. describing an unrelated
  // dead code path) can't make this test an accidental trip-wire.
  assert.ok(
    !SKILL.includes("is not a reachable transition into this role on any edge"),
    "skill-release-engineer.md must NOT retain the :84-area claim that release-engineer:Blocked is unreachable (E53)",
  );
  assert.ok(
    !SKILL.includes("Step 7a's empty-baseline hazard is NOT a row in this table"),
    "skill-release-engineer.md must NOT retain the former :159 claim that the guard cannot be a table row (E53)",
  );
  assert.ok(
    !/release-engineer:Blocked.{0,40}unreachable|unreachable.{0,40}release-engineer:Blocked/is.test(SKILL),
    "skill-release-engineer.md must not pair 'release-engineer:Blocked' with 'unreachable' anywhere, even under reworded phrasing (E53)",
  );
});

test("E53: step 7a's empty-baseline STOP is a genuine Escalation Routes row (exit 20, Blocked) and the script stops before any write (AC-S6, L:E53)", () => {
  const row = exitRow(20, "EMPTY_BASELINE");
  assert.ok(row, "SOP Escalation Routes carries the EMPTY_BASELINE row");
  assert.deepEqual(row.slice(1), ["Blocked", "`<stop>`", "—"]);
  assert.equal(REL.EXIT_CLASSES.find((c) => c.id === "EMPTY_BASELINE").code, 20);
  assert.equal(REL.classifyArchiveTree({ prevTag: "", treeExists: true, baselineHasFiles: true, rootHasFiles: true }), "STOP", "an unset PREV_TAG is a STOP for every tree");
  assert.equal(REL.classifyArchiveTree({ prevTag: "v1", treeExists: true, baselineHasFiles: false, rootHasFiles: true }), "STOP", "no baseline and root files present: STOP");
  assert.ok(RELEASE_SRC.includes("step 7a has no membership baseline for <qa_reports|review_reports> (PREV_TAG='${prevTag ?? \"\"}') — that tree has root-level evidence files and no baseline to diff them against; refusing to derive <CODES> for it rather than risk an unbounded sweep."), "the stop text is the base message");
  const s7a = fnSrc("step7a");
  assert.ok(s7a.indexOf("EMPTY_BASELINE") > -1 && s7a.indexOf("EMPTY_BASELINE") < s7a.indexOf("r.mkdir") && s7a.indexOf("EMPTY_BASELINE") < s7a.indexOf("r.move"), "the stop precedes every write");
  assert.ok(HISTORY.includes("empty-baseline hazard (step 7a:"), "the old row text lives in the history file");
});

test("E53: pending-note escaping caveat — no SOP table cell carries an unescaped pipe, and the history file keeps both the escaped and unescaped forms of the old message", () => {
  // A markdown table cell must escape `|` as `\|`. The rewritten rows carry `<stop>` instead of the message, so
  // no row needs an escape; the check below catches the next row that forgets one (a stray pipe adds a cell).
  for (const cells of SOP_ROWS) assert.equal(cells.length, 4, `table row has exactly 4 cells: ${cells.join(" | ")}`);
  assert.ok(!SKILL.includes("\\|"), "the SOP carries no escaped pipe: the messages moved out of the table");
  assert.ok(HISTORY.includes("<qa_reports|review_reports>") && HISTORY.includes("<qa_reports\\|review_reports>"), "history keeps both forms, which differ byte for byte");
});

test("E53: the unrelated-changes, test-regression, tag-exists and gh-unavailable rows are present with their routing (AC-P6)", () => {
  assert.deepEqual(exitRow(13, "UNRELATED_CHANGES").slice(1), ["Blocked", "`<stop>` (path verbatim)", "—"]);
  assert.deepEqual(sopRow(/^test regression or hardcoded version literal/).slice(1), ["Blocked", "`release-engineer: npm test regression — <test file>: <test name>`", "qa-engineer"]);
  assert.equal(exitRow(40, "TAG_EXISTS")[0], "exit 40 TAG_EXISTS — never delete a tag");
  assert.equal(exitRow(40, "TAG_EXISTS")[1], "Blocked");
  assert.equal(exitRow(14, "GH_UNAVAILABLE")[0], "exit 14 GH_UNAVAILABLE — authenticate, never work around");
  assert.equal(exitRow(14, "GH_UNAVAILABLE")[1], "Blocked");
  assert.ok(HISTORY.includes("| unrelated uncommitted changes (scope rule below) | Blocked |"), "the old rows live in the history file");
});

test("E53/E163: the Escalation Routes table is one row per exit class, in exit-code order, then the situation rows (pre-flight CI step 4, CI gate exit 41, empty baseline exit 20) (AC-P6)", () => {
  const exitRows = SOP_ROWS.filter((c) => /^exit \d+ /.test(c[0]));
  assert.deepEqual(
    exitRows.map((c) => c[0].match(/^exit (\d+) ([A-Z_]+)/).slice(1, 3).join(" ")),
    REL.EXIT_CLASSES.filter((c) => c.phases.some((p) => ["prepare", "publish", "close-out"].includes(p))).map((c) => `${c.code} ${c.id}`),
    "one row per manual-phase exit class (runner-only classes live in docs/release-cd.md, AC-R10 / AC-D3), ascending by code — a dropped, duplicated or reordered row fails",
  );
  const firstSituation = SOP_ROWS.findIndex((c) => !/^exit \d+ /.test(c[0]) && c[0] !== "situation" && !/^-+$/.test(c[0]));
  assert.ok(firstSituation > exitRows.length - 1, "situation rows follow the exit rows");
  assert.ok(sopRow(/^pre-flight CI red \(step 4\)/), "E163's pre-flight CI row is present");
  assert.ok(exitRow(41, "CI_GATE_FAILED"), "E163's CI gate row is present");
  assert.ok(exitRow(42, "PR_CANNOT_MERGE"), "E297's pull-request-cannot-merge row is present");
});

test("Expected vs unrelated scope rule (E64, T-E645-03 point 3): the script's checkScope accepts every FEATURE_DIR including gates/ and stops on a stray top-level path (AC-S6)", () => {
  for (const dir of FEATURE_DIRS) assert.equal(REL.checkScope([`${dir}a/b.txt`]), null, `${dir} is in the scope rule's own enumeration (E64)`);
  assert.equal(REL.checkScope(["gates/x.ts"]), null, "gates/ is named (E64)");
  assert.notEqual(REL.checkScope(["src/app.ts"]), null, "a directory outside the enumeration is unrelated");
  assert.notEqual(REL.checkScope(["notes.txt"]), null, "a stray root file is unrelated");
});

// ---------------------------------------------------------------------------
// Phase 6 — governed git surface for all roles (specs/e7-governed-git-surface.md)
// ---------------------------------------------------------------------------
// The D10 release-only STOP rule became one constitution bullet for every role,
// and the D10 bullet now points to it. AC1 pins both halves in the same bullet
// so they cannot drift apart; AC2 pins the D10 cross-reference sentence.

test("E7-AC1: content/const-15-core-tail.md §6 carries the sanctioned-git-ops whitelist bullet — sanctioned verbs, forbidden verbs, and the STOP/Blocked/hand-back phrase, all in the same bullet (spec AC1)", () => {
  const bulletMatch = CONST15.match(/- \*\*Sanctioned git operations \(ALL roles\)\*\*:.*$/m);
  assert.ok(bulletMatch, "must carry the 'Sanctioned git operations (ALL roles)' bullet in const-15-core-tail.md §6");
  const bullet = bulletMatch[0];

  // Sanctioned verbs: the bullet must whitelist each one (load-bearing, AC1)
  for (const verb of ["`git add`", "`git commit`", "`git tag`", "fast-forward `git push`"]) {
    assert.ok(bullet.includes(verb), `sanctioned-git-ops bullet must whitelist ${verb} (E7-AC1)`);
  }

  // Forbidden verbs: the bullet must name each one as off-limits (load-bearing, AC1)
  for (const verb of ["`git reset`", "`git rebase`", "`git clean`", "force-push (`git push --force`)", "`git checkout --force`"]) {
    assert.ok(bullet.includes(verb), `sanctioned-git-ops bullet must forbid ${verb} (E7-AC1)`);
  }
  assert.ok(bullet.includes("FORBIDDEN"), "forbidden verbs must be flagged FORBIDDEN (E7-AC1)");

  // STOP -> Blocked -> hand-back phrase, same bullet (load-bearing — AC1)
  assert.ok(bullet.includes("STOP immediately"), "must instruct immediate STOP on a wall (E7-AC1)");
  assert.ok(bullet.includes("`status: Blocked`"), "must instruct writing status: Blocked (E7-AC1)");
  assert.ok(
    bullet.includes("git state (branch, local commit SHA, what triggered the STOP)") && bullet.includes("`pending_notes`"),
    "must instruct capturing branch/local SHA/trigger in pending_notes (E7-AC1)",
  );
  assert.ok(bullet.includes("hand back to the coordinator/human"), "must instruct handing back to the coordinator/human (E7-AC1)");
  assert.ok(bullet.includes("never run a destructive fix unsupervised"), "must forbid unsupervised destructive fixes (E7-AC1)");

  // Read-only git stays permitted, generalizing D10 (not itself a forbidden op)
  assert.ok(
    bullet.includes("Read-only git (`diff`, `log`, `status`, `show`) is always permitted"),
    "must explicitly permit read-only git ops (E7-AC1)",
  );
});

test("E7-AC3: content/const-15-core-tail.md is tagged 'core' in prompts/constitution-manifest.ts, so the new bullet ships on every dispatch arm (spec AC3)", () => {
  const manifestSrc = fs.readFileSync(path.join(ROOT, "prompts", "constitution-manifest.ts"), "utf-8");
  const fragmentEntry = manifestSrc.match(/\{[^{}]*file:\s*"const-15-core-tail\.md"[^{}]*\}/s);
  assert.ok(fragmentEntry, "const-15-core-tail.md must have a fragment entry in prompts/constitution-manifest.ts (E7-AC3)");
  assert.match(
    fragmentEntry[0],
    /tag:\s*"core"/,
    "const-15-core-tail.md's manifest entry must be tag: \"core\" so includeSegment(\"core\", ...) ships it on every dispatch arm (E7-AC3)",
  );
});

test("E7-AC1/AC3: the sanctioned-git-ops bullet reaches the COMPOSED (not raw) constitution text on both the tightest (lite, non-design) and broadest (full-chain, design-armed) dispatch arms (spec AC1's composed-text requirement, AC3)", () => {
  // The proof text for the composed-text requirement (AC3) calls out "the new AC1 pinning test itself running
  // against the composed (not raw) constitution text" — the raw-fragment
  // assertions above (E7-AC1) pin the bullet's content; this test pins its
  // REACHABILITY through composeConstitution() on the narrowest arm (lite,
  // no chain, no design — the arm most likely to accidentally drop a
  // core-tagged fragment) and the broadest arm, closing the gap between
  // "the fragment file has the bullet" and "every dispatch arm ships it".
  const lite = composeConstitution({ chain: false, design: false });
  const full = composeConstitution({ chain: true, design: true });
  assert.ok(
    lite.includes("**Sanctioned git operations (ALL roles)**"),
    "composeConstitution({chain:false, design:false}) (lite, tightest arm) must carry the sanctioned-git-ops bullet (E7-AC1/AC3)",
  );
  assert.ok(
    full.includes("**Sanctioned git operations (ALL roles)**"),
    "composeConstitution({chain:true, design:true}) (full-chain, design-armed, broadest arm) must carry the sanctioned-git-ops bullet (E7-AC1/AC3)",
  );
});

test("E7-AC2: the SOP's Git rule points at Constitution §6 Sanctioned git operations by name, pointer-only; the old cross-reference sentence lives in the history file (AC-P4)", () => {
  assert.match(SKILL, /\*\*Git\*\*: Constitution §6 \*Sanctioned git operations\*/, "the Git rule cites the general §6 whitelist by section and name");
  assert.ok(!/\bgit (reset|rebase|clean)\b/.test(SKILL.split("## Escalation Routes")[0].replace(/never run[^.]*\./gi, "")), "the SOP does not restate the whitelist's verbs");
  assert.ok(HISTORY.includes("one source of truth is the general git-ops whitelist in Constitution §6 (Security & Privacy), binding ALL roles"));
  assert.ok(HISTORY.includes("this bullet retains only the release-engineer recovery mechanics"));
});

// ---------------------------------------------------------------------------
// Phase 6.5 — dependency-audit waiver escape stays closed (E59, re-baselined by E48)
// ---------------------------------------------------------------------------
// The "unless waived in the PR description" escape let HIGH advisories ride
// release to release, and every single-pattern sweep missed a live site. So the
// pin is structural: "waived" appears nowhere in content/ (a), and each of the 4
// known sites keeps its replacement text (b). History: specs/e260h-comment-rationale.md (test/release-staging.test.mjs).

function listMarkdownFilesRecursive(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((entry) => typeof entry === "string" && entry.endsWith(".md"))
    .map((entry) => path.join(dir, entry));
}

test("E59: the abolished 'waived' dependency-audit escape does not reappear anywhere in content/ (structural, tree-wide sweep)", () => {
  const trees = [path.join(ROOT, "content")];
  const offenders = [];
  for (const tree of trees) {
    for (const file of listMarkdownFilesRecursive(tree)) {
      const body = fs.readFileSync(file, "utf-8");
      if (/\bwaived\b/i.test(body)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `no file under content/ may contain the word "waived" — that exact verb was the only form the abolished §6 escape ever took ("waived in the PR description[, with rationale]", "unwaived", "no / waived"); the retained "waive the rule" sentence and the new "NOT a waiver" clause both use different words (E59). Found it reintroduced in: ${offenders.join(", ")}`,
  );
});

test("E59: all 4 live §6 dependency-audit normative sites carry the disposition-channel replacement text (structural, per-site enumeration, re-baselined 2026-08-17 per review_T-E48-02.md round 1/2 C2)", () => {
  const sites = [
    {
      body: CONST15,
      anchor: /- \*\*Dependency audit at build gate\*\*:.*$/m,
      label: "content/const-15-core-tail.md:11 (source bullet)",
    },
    {
      body: SKILL,
      anchor: /\*\*Dependency-audit disposition\*\*.*$/m,
      label: "content/skill-release-engineer.md:56 (§6a disposition heading)",
    },
    {
      body: SKILL,
      // Widened to include the :56 heading: the bullet's own text names
      // neither "disposition" nor "dependency-advisory record" verbatim
      // (verified directly — a single-line anchor at the bullet lead alone
      // would false-fail the presence assertion below), but the bullet is
      // meaningless detached from the "6a. Dependency-audit disposition"
      // heading that introduces it, so the excerpt legitimately includes it.
      anchor: /\*\*Dependency-audit disposition\*\*[\s\S]*?- \*\*Already recorded\*\*.*$/m,
      label: "content/skill-release-engineer.md:57 (Already-recorded disposition bullet)",
    },
    {
      body: SKILL,
      // Same widening as :57, for the same reason.
      anchor: /\*\*Dependency-audit disposition\*\*[\s\S]*?- \*\*Not recorded, or recorded but its re-review trigger has since fired\*\*.*$/m,
      label: "content/skill-release-engineer.md:58 (Not-recorded disposition bullet)",
    },
  ];

  // 4 sites: E48 deleted docs/skills/ (8 of the original 9 sites), and a
  // re-derivation from the tree found 3 unpinned live sites in
  // content/skill-release-engineer.md (history: see the Phase 6.5 header).
  assert.equal(sites.length, 4, "this enumeration must itself stay at 4 sites (re-baselined 2026-08-17, E48 + review_T-E48-02.md round 1/2 C2: -8 docs/skills/ mirror sites deleted by E48, +3 previously-unpinned live content/skill-release-engineer.md:56-58 sites added) — update it deliberately, not by accident, if the site set changes");

  for (const { body, anchor, label } of sites) {
    const match = body.match(anchor);
    assert.ok(match, `could not locate the §6 dependency-audit site for ${label} — the site moved or was deleted (E59)`);
    const excerpt = match[0];
    assert.ok(
      /dependency-advisory record/.test(excerpt) || /disposition/.test(excerpt),
      `${label} must still name the dependency-advisory-record disposition channel that replaced the waiver escape (E59): ${excerpt}`,
    );
    assert.ok(
      !/\bwaived\b/i.test(excerpt),
      `${label} must not reintroduce the abolished "waived" escape (E59): ${excerpt}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Phase 7 — step 7a ticket-code set derivation (E49, E50): working-tree
// enumeration with a PREV_TAG membership test, over qa_reports/ and review_reports/
// ---------------------------------------------------------------------------
// The derivation changed four times across two tickets, and two earlier forms
// were wrong on real releases. These tests pin the shipped text and behaviour
// (E50 round 2). Round history: specs/e260h-comment-rationale.md (test/release-staging.test.mjs).

// Model of the shipped filename -> code extraction (step 7a):
//   sed -E 's#.*<slash>##' | grep -oE '^[a-z_]*T-[A-Za-z0-9]+-' \
//     | sed -E 's/^[a-z_]*T-//; s/-$//' | tr 'a-z' 'A-Z'
// Takes a basename (callers strip the directory, as the pipeline does) and
// returns the uppercased code, or null when no `T-<CODE>-` segment follows an
// anchored `[a-z_]*` prefix.
function codeFromFilename(basename) {
  const m = basename.match(/^[a-z_]*T-([A-Za-z0-9]+)-/);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Model of the shipped step-7a derivation for a SINGLE tree (qa_reports/):
 *   find qa_reports -maxdepth 1 -type f | sort \
 *     | grep -vxFf <(git ls-tree -r --name-only "$PREV_TAG" -- qa_reports/)
 * followed by codeFromFilename per resulting basename (N2: a filename with no
 * `T-<CODE>-` segment is still admitted as a candidate FILE, contributing no
 * code).
 *
 * @param {string[]} workingTreeFiles - every qa_reports/-rooted path that
 *   exists in the working tree right now, at any depth (models what a naive
 *   recursive listing would include, so the -maxdepth 1 behavior below is
 *   itself under test rather than assumed).
 * @param {string[]} prevTagTreeFiles - `git ls-tree -r --name-only "$PREV_TAG"
 *   -- qa_reports/` output: paths that existed in the previous release's tree.
 */
function deriveCodesFromWorkingTree(workingTreeFiles, prevTagTreeFiles) {
  // `find qa_reports -maxdepth 1 -type f`: only DIRECT children of qa_reports/;
  // archive/ subdirectory entries are structurally invisible to -maxdepth 1,
  // never candidates at all (subsumes the old explicit archive/ exclusion).
  const rootFiles = workingTreeFiles.filter((f) => path.posix.dirname(f) === "qa_reports");
  const prevTagSet = new Set(prevTagTreeFiles);
  // `grep -vxFf <(git ls-tree ...)`: drop any line that is an EXACT full-line
  // match against a path that already existed in PREV_TAG's tree. A file
  // counts as new to this release when absent from that tree — whether it got
  // there by being committed within the range, or by never having been
  // committed at all (untracked).
  const admitted = rootFiles.filter((f) => !prevTagSet.has(f)).sort();
  const codes = new Set();
  for (const f of admitted) {
    const code = codeFromFilename(path.posix.basename(f));
    if (code) codes.add(code);
  }
  return { admitted, codes: [...codes].sort() };
}

/**
 * Model of the shipped per-tree empty-baseline guard (E50 round 2 — F9),
 * content/skill-release-engineer.md step 7a "Empty-baseline guard" bullet.
 * STOP is reserved for "no baseline for this tree AND something at its root
 * an unbounded sweep would take"; EXCLUDE covers "tree absent" or "baseline
 * empty AND nothing at root to protect" — the self-healing, non-recurring
 * case round 1 conflated with STOP.
 */
function deriveGuardFlags({
  prevTag,
  qaDirExists = true,
  qaBaselineNonEmpty = false,
  qaRootFilesPresent = false,
  rrDirExists = true,
  rrBaselineNonEmpty = false,
  rrRootFilesPresent = false,
} = {}) {
  const flags = { STOP_QA: false, STOP_RR: false, EXCLUDE_QA: false, EXCLUDE_RR: false };
  if (!prevTag) {
    // Genuinely global: an unset PREV_TAG means there is no baseline for ANY
    // tree, a property of the repository, not of a tree.
    flags.STOP_QA = true;
    flags.STOP_RR = true;
    return flags;
  }
  if (!qaDirExists) flags.EXCLUDE_QA = true;
  else if (qaBaselineNonEmpty) {
    /* baseline present -- qa_reports/ included in the derivation below */
  } else if (qaRootFilesPresent) flags.STOP_QA = true;
  else flags.EXCLUDE_QA = true;

  if (!rrDirExists) flags.EXCLUDE_RR = true;
  else if (rrBaselineNonEmpty) {
    /* baseline present -- review_reports/ included in the derivation below */
  } else if (rrRootFilesPresent) flags.STOP_RR = true;
  else flags.EXCLUDE_RR = true;

  return flags;
}

/**
 * Model of the shipped union derivation across BOTH trees (E50): each
 * non-excluded tree contributes its own admitted set, and `<CODES>` is the
 * union of codes derived from either. An excluded tree contributes nothing
 * (models the shell's `[ -z "$EXCLUDE_QA" ] && find ... | ...` short-circuit
 * — the excluded tree's pipeline never runs at all).
 */
function deriveCodesUnion({
  qaWorkingTree = [],
  qaPrevTagTree = [],
  rrWorkingTree = [],
  rrPrevTagTree = [],
  excludeQa = false,
  excludeRr = false,
} = {}) {
  const admitted = [];
  if (!excludeQa) {
    const { admitted: qaAdmitted } = deriveCodesFromWorkingTree(qaWorkingTree, qaPrevTagTree);
    admitted.push(...qaAdmitted);
  }
  if (!excludeRr) {
    const rootFiles = rrWorkingTree.filter((f) => path.posix.dirname(f) === "review_reports");
    const prevSet = new Set(rrPrevTagTree);
    admitted.push(...rootFiles.filter((f) => !prevSet.has(f)));
  }
  const codes = new Set();
  for (const f of admitted) {
    const code = codeFromFilename(path.posix.basename(f));
    if (code) codes.add(code);
  }
  return { admitted: [...admitted].sort(), codes: [...codes].sort() };
}

/**
 * Model of the shipped PARALLEL destination resolution (E50, item (c)): each
 * source tree gets its OWN archive dir, never folded together — the pin that
 * matters against a real basename collision (review_T-E4X-03.md existed
 * simultaneously at qa_reports/archive/.../ and review_reports/ root within
 * the same v3.96.0 commit).
 */
function resolveDestination(sourceTree, activeFeature) {
  return `${sourceTree}/archive/${activeFeature}/`;
}

/** Resolve the per-file moves a set of admitted candidates would produce. */
function resolveMoves({ qaAdmitted = [], rrAdmitted = [], activeFeature }) {
  const moves = [];
  for (const f of qaAdmitted) {
    moves.push({ from: f, to: `${resolveDestination("qa_reports", activeFeature)}${path.posix.basename(f)}` });
  }
  for (const f of rrAdmitted) {
    moves.push({ from: f, to: `${resolveDestination("review_reports", activeFeature)}${path.posix.basename(f)}` });
  }
  return moves;
}

test("E49 step 7a: the script derives PREV_TAG via `git describe --tags --abbrev=0` and enumerates ONLY root-level files, with PREV_TAG's tree as the membership predicate (AC-S6, L:E49)", () => {
  assert.ok(RELEASE_SRC.includes('["describe", "--tags", "--abbrev=0"]'), "PREV_TAG comes from `git describe --tags --abbrev=0`");
  assert.ok(RELEASE_SRC.includes('["ls-tree", "-r", "-z", "--name-only", prevTag, "--", `${tree}/`]'), "membership is `git ls-tree -r --name-only <PREV_TAG> -- <tree>/`");
  const root = fnSrc("step7a");
  assert.ok(root.includes("rootFileNames(abs)"), "step 7a lists the tree's root files");
  assert.match(RELEASE_SRC, /const rootFileNames = \(abs\) => readdirSync\(abs, \{ withFileTypes: true \}\)\.filter\(\(d\) => d\.isFile\(\)\)/, "direct children only (the old `-maxdepth 1 -type f`): archive/ is structurally invisible");
  assert.ok(HISTORY.includes("find qa_reports -maxdepth 1 -type f | sort"), "the old shell derivation lives in the history file");
});

test("E50 step 7a (N14 CLOSED): the derivation does not resurrect the round-2 committed-history-only rule — no `git log`, no --diff-filter — and uses ls-tree for BOTH trees (AC-S6, L:E50)", () => {
  const s7a = fnSrc("step7a");
  assert.ok(!/"log"/.test(s7a) && !/git log/.test(s7a), "step 7a must not read `git log` (F7 regression class)");
  assert.ok(!/diff-filter/.test(RELEASE_SRC), "no --diff-filter=A anywhere: that rule returned EMPTY on 2 of the last 6 releases (F7)");
  assert.ok(s7a.includes('"ls-tree"'), "step 7a uses git ls-tree as the membership predicate");
  const trees = RELEASE_SRC.match(/const TREES = \[(.*)\];/)[1];
  assert.ok(trees.includes('"qa_reports"') && trees.includes('"review_reports"'), "both trees run through the same predicate (E50)");
  assert.ok(HISTORY.includes("diff-filter"), "the round-2 rule is recorded in the history file");
});

test("E50 step 7a (N14 follow-up): the duplicate-fence hazard is gone — ONE membership predicate in the script serves both trees, and the SOP carries no fenced shell (AC-S6)", () => {
  // The old SOP held two copies of the find/grep pair that could drift. The script has a single call site
  // inside a loop over TREES, so there is no second copy to diverge.
  assert.equal([...fnSrc("step7a").matchAll(/"ls-tree"/g)].length, 1, "exactly one ls-tree call in step 7a");
  assert.match(fnSrc("step7a"), /for \(const \[key, tree\] of TREES\)/, "both trees go through that one call");
  assert.ok(!/```[a-z]*\n[\s\S]*ls-tree/.test(SKILL), "the SOP has no fenced derivation");
});

test("E49 step 7a (F7 regression — the single most important assertion in this suite): v3.93.0 shape — evidence untracked at root, absent from PREV_TAG's tree, still yields a non-empty code", () => {
  // v3.93.0's own evidence file (review_T-E36-01.md) was NEVER committed at
  // qa_reports/ root in any commit — untracked at step-7a time, the norm, not
  // the exception. The round-2 committed-history rule returned EMPTY here
  // (`git log --diff-filter=A` sees no add event for an untracked file). An
  // empty result here silently orphans evidence without failing the release
  // (combined with "zero matches = silent no-op") — this is the exact defect
  // class that silently dropped evidence codes and that the guard exists to close (F7).
  const workingTree = ["qa_reports/review_T-E36-01.md"];
  const prevTagTree = []; // v3.92.1's qa_reports/ tree does not contain this file
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E36"], "v3.93.0 shape (untracked-at-root) must yield {E36}, NOT the empty set (F7)");
});

test("E49 step 7a (F7 regression): v3.94.0 shape — two untracked-at-root files yield {E37,E38}, not empty", () => {
  const workingTree = ["qa_reports/review_T-E37-01.md", "qa_reports/review_T-E38-01.md"];
  const prevTagTree = []; // v3.93.0's qa_reports/ tree does not contain either file
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E37", "E38"], "v3.94.0 shape (untracked-at-root, two files) must yield {E37,E38}, NOT the empty set (F7)");
});

test("E49 step 7a: committed-in-range case still works — the exact v3.94.0..7b49d81^ shape yields {E45,E46}", () => {
  // The release that motivated E49: v3.95.0 shipped E45 and E46 together under
  // active_feature "e46-...", and both evidence files WERE committed at root
  // within the range (this is the shape round 1's slug-hunting rule got wrong,
  // and round 2's fix got right).
  const workingTree = ["qa_reports/review_T-E45-01.md", "qa_reports/review_T-E46-01.md"];
  const prevTagTree = []; // v3.94.0's qa_reports/ tree does not contain either file
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E45", "E46"], "the committed-in-range case must still yield {E45,E46} — the working-tree rule subsumes it, doesn't regress it");
});

test("E49 step 7a: non-retroactivity — a file already recorded in PREV_TAG's tree is excluded, even though it is still sitting orphaned at root", () => {
  // At the NEXT release after v3.95.0, `git ls-tree -r --name-only v3.95.0 --
  // qa_reports/` DOES contain qa_reports/review_T-E45-01.md (round 3,
  // "Non-retroactivity — CONFIRMED"), so it must NOT re-enter <CODES> — the
  // orphan stays T-E49-02's manual one-off sweep, not a job for this rule.
  const workingTree = ["qa_reports/review_T-E45-01.md"];
  const prevTagTree = ["qa_reports/review_T-E45-01.md"];
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, [], "a file already present in PREV_TAG's tree must be excluded — non-retroactive by construction");
});

test("E49 step 7a (F4 negative fixture): a bare-code prose mention with no evidence file produces no code", () => {
  // 5a9a824, inside the v3.95.0 range, filed E39-E44 as OPEN and named them as
  // bare codes in the commit body — but added no qa_reports/ file for any of
  // them. <CODES> is evidence-file-backed, not ship-backed: a prose mention
  // alone must not enter the set.
  const workingTree = ["qa_reports/review_T-E45-01.md", "qa_reports/review_T-E46-01.md"];
  const prevTagTree = [];
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  for (const bareCode of ["E39", "E40", "E41", "E42", "E43", "E44"]) {
    assert.ok(!codes.includes(bareCode), `bare-code prose mention ${bareCode} (no evidence file) must not enter <CODES> (F4)`);
  }
  assert.deepEqual(codes, ["E45", "E46"], "only the codes with an actual evidence file must be admitted");
});

test("E49 step 7a: already-archived evidence never re-enters, in both the rename and untracked-add shapes", () => {
  // An archive move records as a rename (git diff --cached --name-status:
  // a 100%-similarity rename entry, qa_reports/review_*.md -> qa_reports/archive/.../review_*.md), which
  // -maxdepth 1 already excludes by not descending into archive/ at all; when
  // rename detection doesn't fire (untracked source), it lands as an A under
  // archive/ instead of at root, same exclusion applies.
  const workingTree = [
    "qa_reports/archive/e46-qa-spec-defect-status-rule/review_T-E45-01.md", // rename form
    "qa_reports/archive/e37-design-auditor-post-pass-edge/review_T-E37-01.md", // untracked-add form
    "qa_reports/review_T-E46-01.md", // the one genuinely new root file
  ];
  const prevTagTree = [];
  const { codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E46"], "archive/-rooted paths must never surface as candidates — -maxdepth 1 excludes them structurally, in both the rename and untracked-add shapes");
});

test("E49 step 7a (N2): filenames with no T-<CODE>- substring (expected-red_*) are admitted as files but contribute no code", () => {
  const workingTree = [
    "qa_reports/review_T-E45-01.md",
    "qa_reports/expected-red_e44-e49-release-sop-conditional-checks.txt",
  ];
  const prevTagTree = [];
  const { admitted, codes } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(codes, ["E45"], "expected-red_* must not contribute a spurious code (N2)");
  assert.ok(
    admitted.includes("qa_reports/expected-red_e44-e49-release-sop-conditional-checks.txt"),
    "expected-red_* is still admitted as a candidate FILE (moved by its own SOP bullet) even though it contributes no code to <CODES>",
  );
});

test("E50 step 7a (Item 0 — F9 CLOSED, N4 hazard closed): an empty PREV_TAG baseline WITH root files present now STOPs instead of admitting every root-level file", () => {
  // Replaces, in place, a pin that asserted the unguarded mass-sweep
  // (["E45","OLD"]) as current behaviour; keeping both would pin opposite
  // behaviours. That set is now what must NOT be produced.
  const workingTree = ["qa_reports/review_T-E45-01.md", "qa_reports/review_T-OLD-01.md"];
  const prevTagTree = []; // empty baseline: no tags yet, or PREV_TAG predates qa_reports/

  const flags = deriveGuardFlags({
    prevTag: "v1.0.0",
    qaDirExists: true,
    qaBaselineNonEmpty: prevTagTree.length > 0,
    qaRootFilesPresent: workingTree.some((f) => path.posix.dirname(f) === "qa_reports"),
  });
  assert.equal(
    flags.STOP_QA,
    true,
    "an empty qa_reports/ baseline WHILE qa_reports/ root holds files an unbounded sweep would take must STOP (F9) — the exact shape the pre-E50 pin called permissive-by-design",
  );
  assert.equal(flags.EXCLUDE_QA, false, "STOP and EXCLUDE are mutually exclusive outcomes for the same tree in the same run");

  // Sanity: the underlying per-file derivation logic is UNCHANGED by E50 (it
  // is the guard that gates whether it may run, not the derivation itself)
  // — so this remains the exact dangerous set F9's guard exists to keep the
  // SOP from ever deriving on this input.
  const { codes: wouldHaveBeenDerived } = deriveCodesFromWorkingTree(workingTree, prevTagTree);
  assert.deepEqual(
    wouldHaveBeenDerived,
    ["E45", "OLD"],
    "carried-forward fixture: this is the mass-sweep set that must never be produced when the guard is honored (per-tree STOP fires before this derivation is reached)",
  );
});

test("E49/E44 step-order pin: in `prepare`, 7a precedes the commit and 7a's derivation does not read the release commit's own content (guards F2's class from returning) (AC-S6, L:E65)", () => {
  const order = RELEASE_SRC.match(/const PHASES = \{\s*prepare: \[([^\]]*)\]/)[1].split(",").map((x) => x.trim());
  assert.ok(order.indexOf("step7a") > -1 && order.indexOf("step8aCommitPushPr") > -1);
  assert.ok(order.indexOf("step7a") < order.indexOf("step8aCommitPushPr"), "7a's moves must land IN the release commit");
  const s7a = fnSrc("step7a");
  assert.ok(!/HEAD~1/.test(s7a), "step 7a must not reference the release commit's own diff (HEAD~1) — F2 regression class");
  assert.ok(!/"show"/.test(s7a), "step 7a must not read the release commit via `git show` (F2 regression class)");
  assert.ok(!/HEAD/.test(s7a.replace(/\/\/.*$/gm, "")), "step 7a reads no HEAD content: only PREV_TAG's tree and the working tree");
});

// ---------------------------------------------------------------------------
// Phase 8 — step 7a per-tree empty-baseline guard, the review_reports/
// extension and the filename-shape matrix (E50; the guard flip and the
// fence repoint are covered above).
// ---------------------------------------------------------------------------

test("E50 step 7a (Item 3 — 14-row filename-shape matrix, attack 1): the shipped extraction chain produces exactly these codes, or none", () => {
  const cases = [
    ["review_T-RELSOP-01.md", "RELSOP"], // v3.91.0 depends on this shape
    ["review_T-E4X-03.md", "E4X"], // alphanumeric code preserved
    ["visual_T-E36-01.md", "E36"], // visual_ prefix handled
    ["review_T-E11E12-02.md", "E11E12"], // matches a real multi-ticket task id
    ["review_T-C7-CR.md", "C7"], // trailing non-numeric segment
    ["T-E51-01.md", "E51"], // no review_/visual_ prefix at all -- [a-z_]* matches empty
    ["expected-red_e50-release-sop-step7a-hardening.txt", null], // moved by its own bullet, never enters <CODES>
    ["expected-red_T-E51-01.txt", null], // adversarial: a real code embedded in an expected-red_ name still must not enter <CODES>
    ["review_C1-02.md", null], // legacy pre-convention name (no T-<CODE>- token)
    ["review_b8.md", null], // legacy pre-convention name
    ["README.md", null], // no prefix, no T-<CODE>- token
    ["REVIEW_T-E51-01.md", null], // uppercase prefix breaks the lowercase [a-z_]* class
    ["review_t-e51-01.md", null], // lowercase "t-" breaks the literal uppercase "T-" match
    ["review_T-PGAT.md", null], // no trailing "-<segment>" after the code, so it is invisible end-to-end (N16)
  ];
  for (const [filename, expected] of cases) {
    assert.equal(
      codeFromFilename(filename),
      expected,
      `${filename} must derive ${expected === null ? "no code" : `"${expected}"`}`,
    );
  }
});

test("E50 step 7a (N15, recorded not fixed): the [a-z_]* prefix class is wider than review_/visual_ and over-accepts a stray non-convention filename", () => {
  // Non-blocking per review_T-E50-02.md — not fixed in this ticket, pinned so
  // the over-accept is visible in the suite rather than rediscovered.
  assert.equal(codeFromFilename("notes_about_T-E99-01_backup.md"), "E99");
  assert.equal(codeFromFilename("archive_T-E51-01.md"), "E51");
});

test("E50 step 7a (F9 — per-tree guard, all shapes): tree absent, baseline empty with/without root files, and the globally-unset PREV_TAG case", () => {
  // Tree absent -> EXCLUDE; the other tree is unaffected.
  assert.deepEqual(
    deriveGuardFlags({ prevTag: "v1.0.0", rrDirExists: false, qaBaselineNonEmpty: true }),
    { STOP_QA: false, STOP_RR: false, EXCLUDE_QA: false, EXCLUDE_RR: true },
  );

  // Baseline empty + zero root files -> EXCLUDE (nothing to protect, nothing to sweep).
  let flags = deriveGuardFlags({ prevTag: "v1.0.0", qaBaselineNonEmpty: false, qaRootFilesPresent: false });
  assert.equal(flags.EXCLUDE_QA, true, "empty baseline with nothing at root must EXCLUDE, not STOP");
  assert.equal(flags.STOP_QA, false);

  // Baseline empty + root files present -> STOP (the real N4 hazard).
  flags = deriveGuardFlags({ prevTag: "v1.0.0", qaBaselineNonEmpty: false, qaRootFilesPresent: true });
  assert.equal(flags.STOP_QA, true, "empty baseline with root files present must STOP");
  assert.equal(flags.EXCLUDE_QA, false);

  // PREV_TAG unset -> both trees STOP, unconditionally (genuinely global: no
  // baseline exists for ANY tree, a property of the repo, not of a tree).
  assert.deepEqual(
    deriveGuardFlags({ prevTag: "", qaBaselineNonEmpty: true, rrDirExists: false }),
    { STOP_QA: true, STOP_RR: true, EXCLUDE_QA: false, EXCLUDE_RR: false },
  );

  // Baseline non-empty -> neither STOP nor EXCLUDE; the tree participates normally.
  assert.deepEqual(
    deriveGuardFlags({ prevTag: "v1.0.0", qaBaselineNonEmpty: true, rrBaselineNonEmpty: true }),
    { STOP_QA: false, STOP_RR: false, EXCLUDE_QA: false, EXCLUDE_RR: false },
  );
});

test("E50 step 7a (Item 4 — F9 CLOSED, the permanent-wedge shape from round 1): a workspace whose review_reports/ tree never exists proceeds across THREE CONSECUTIVE releases, not just once", () => {
  // A global guard STOPped this shape at release 2 and at every release after,
  // since nothing creates review_reports/. Three consecutive tags catch a fix
  // that only defers the STOP. qa_reports/ has a prior baseline, so the
  // absence of review_reports/ is the only variable.
  const releases = [
    {
      prevTag: "v1.0.0",
      qaWorkingTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md"],
      qaPrevTagTree: ["qa_reports/review_T-PRIOR-01.md"],
    },
    {
      prevTag: "v1.1.0",
      qaWorkingTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md", "qa_reports/review_T-NEXT-01.md"],
      qaPrevTagTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md"],
    },
    {
      prevTag: "v1.2.0",
      qaWorkingTree: [
        "qa_reports/review_T-PRIOR-01.md",
        "qa_reports/review_T-NEW-01.md",
        "qa_reports/review_T-NEXT-01.md",
        "qa_reports/review_T-FOUR-01.md",
      ],
      qaPrevTagTree: ["qa_reports/review_T-PRIOR-01.md", "qa_reports/review_T-NEW-01.md", "qa_reports/review_T-NEXT-01.md"],
    },
  ];
  const expectedNewCode = ["NEW", "NEXT", "FOUR"];
  releases.forEach((release, i) => {
    const flags = deriveGuardFlags({
      prevTag: release.prevTag,
      qaDirExists: true,
      qaBaselineNonEmpty: release.qaPrevTagTree.length > 0,
      qaRootFilesPresent: true,
      rrDirExists: false, // review_reports/ has NEVER been created in this workspace
    });
    assert.equal(flags.EXCLUDE_RR, true, `release ${i + 1}: an absent review_reports/ tree must EXCLUDE, not STOP`);
    assert.equal(flags.STOP_QA, false, `release ${i + 1}: the qa_reports/ half must be unaffected by review_reports/'s permanent absence`);
    const { codes } = deriveCodesUnion({
      qaWorkingTree: release.qaWorkingTree,
      qaPrevTagTree: release.qaPrevTagTree,
      excludeRr: true,
    });
    assert.ok(
      codes.includes(expectedNewCode[i]),
      `release ${i + 1} must still derive its own new code (${expectedNewCode[i]}) -- the wedge from round 1 must not recur or merely defer`,
    );
  });
});

test("E50 step 7a (Item 5/7 — seven-release backtest, union adds zero extra codes on real history): union(qa_reports, review_reports) equals the qa_reports column on all seven releases", () => {
  // Ported from review_reports/review_T-E50-02.md's round-2 seven-release
  // table (re-run against the shipped guard + CODES= blocks in seven detached
  // worktrees). review_reports/'s <CODES> is always a SUBSET of the same
  // release's qa_reports/ set in this repo's actual history -- the union
  // therefore adds nothing extra, on every row.
  const releases = [
    { tag: "v3.91.0", qa: ["E25", "E27", "E28", "E29", "E30", "E32", "E33", "RELSOP"], rr: ["E25", "E32"] },
    { tag: "v3.92.0", qa: ["E34"], rr: ["E34"] },
    { tag: "v3.92.1", qa: ["E35"], rr: ["E35"] },
    { tag: "v3.93.0", qa: ["E36"], rr: ["E36"] },
    { tag: "v3.94.0", qa: ["E37", "E38"], rr: ["E37", "E38"] },
    { tag: "v3.95.0", qa: ["E45", "E46"], rr: ["E45", "E46"] },
    { tag: "v3.96.0", qa: ["E44", "E49", "E4X"], rr: ["E4X"] }, // the highest-value row: review_reports/ contributes at all
  ];
  for (const { tag, qa, rr } of releases) {
    const qaWorkingTree = qa.map((c) => `qa_reports/review_T-${c}-01.md`);
    const rrWorkingTree = rr.map((c) => `review_reports/review_T-${c}-01.md`);
    const { codes } = deriveCodesUnion({ qaWorkingTree, qaPrevTagTree: [], rrWorkingTree, rrPrevTagTree: [] });
    assert.deepEqual(
      codes,
      [...qa].sort(),
      `${tag}: union must equal the qa_reports column exactly -- review_reports/ contributes nothing beyond it in this repo's real history`,
    );
  }
});

test("E50 step 7a (Item 6 — the real v3.96.0 collision): identical basenames in both trees resolve to distinct, non-clobbering destinations", () => {
  const activeFeature = "e44-e49-release-sop-conditional-checks";
  const moves = resolveMoves({
    qaAdmitted: ["qa_reports/review_T-E4X-03.md"],
    rrAdmitted: ["review_reports/review_T-E4X-03.md"],
    activeFeature,
  });
  assert.equal(moves.length, 2, "both files must be scheduled to move -- neither may be dropped because of the shared basename");
  const destinations = moves.map((m) => m.to);
  assert.equal(
    new Set(destinations).size,
    2,
    "the two destinations must differ -- a single shared destination would make `mv -n` silently skip whichever file arrives second (the real v3.96.0 collision)",
  );
  assert.ok(destinations.includes("qa_reports/archive/e44-e49-release-sop-conditional-checks/review_T-E4X-03.md"));
  assert.ok(destinations.includes("review_reports/archive/e44-e49-release-sop-conditional-checks/review_T-E4X-03.md"));
});

test("E50 step 7a (Item 7 — real v3.96.0 shape): E44/E49 enter <CODES> from qa_reports/ alone; the review_reports/ move matches nothing for them and no-ops", () => {
  const qaWorkingTree = ["qa_reports/review_T-E44-01.md", "qa_reports/review_T-E49-01.md", "qa_reports/review_T-E4X-03.md"];
  const rrWorkingTree = ["review_reports/review_T-E4X-03.md"];
  const { codes } = deriveCodesUnion({ qaWorkingTree, qaPrevTagTree: [], rrWorkingTree, rrPrevTagTree: [] });
  assert.deepEqual(codes, ["E44", "E49", "E4X"], "union must include E44/E49 from qa_reports/ alone plus E4X from both trees");

  // The review_reports/ move bullet matches root files whose id is in
  // <CODES> -- with no E44/E49 file present in review_reports/, it moves
  // nothing for those two codes; only E4X's file (genuinely present in both
  // trees) moves, from each tree to its OWN archive dir (Item 6).
  const rrMoved = rrWorkingTree.filter((f) => codes.some((c) => path.posix.basename(f).includes(`T-${c}-`)));
  assert.deepEqual(
    rrMoved,
    ["review_reports/review_T-E4X-03.md"],
    "review_reports/ must not fabricate moves for codes that exist only in qa_reports/, and a retried mv -n over the same match stays idempotent",
  );
});

test("E50 step 7a (Item 8 — covers: sweep stays in its own tree): a review_reports/*.md file whose covers: line matches <CODES> resolves to review_reports/archive/, never qa_reports/archive/", () => {
  const activeFeature = "e44-e49-release-sop-conditional-checks";
  const coversLine = "covers: T-E4X-03, T-E44-01, T-E49-01";
  const codes = ["E44", "E49", "E4X"];
  const coveredIds = coversLine.replace(/^covers:\s*/, "").split(",").map((s) => s.trim());
  const intersects = coveredIds.some((id) => codes.some((c) => id === `T-${c}` || id.startsWith(`T-${c}-`)));
  assert.ok(intersects, "sanity: this covers: line does intersect <CODES>");

  // Destination is resolved per SOURCE TREE, never by which codes matched --
  // a review_reports/*.md file's covers: sweep can never land in
  // qa_reports/archive/, and symmetrically.
  assert.equal(resolveDestination("review_reports", activeFeature), `review_reports/archive/${activeFeature}/`);
  assert.notEqual(resolveDestination("review_reports", activeFeature), resolveDestination("qa_reports", activeFeature));
});

test("E50 step 7a (Item 9 — non-retroactivity, highest-consequence regression pin): a baseline containing a review_reports/ root file excludes that id, even across the 103 legacy files", () => {
  // Real v3.96.0 shape (review_T-E50-02.md round 2): E45 sits in v3.95.0's
  // review_reports/ baseline because the coordinator's manual R100 cleanup
  // committed it there. The NEXT release must not re-derive E45 from
  // review_reports/ even though the rule correctly does NOT know or care WHY
  // it is already in the baseline -- a bug here mass-relocates the project's
  // entire code-review history.
  const rrWorkingTree = ["review_reports/review_T-E45-01.md", "review_reports/review_T-E51-01.md"];
  const rrPrevTagTree = ["review_reports/review_T-E45-01.md"]; // already recorded in the previous release's tree
  const { codes } = deriveCodesUnion({ rrWorkingTree, rrPrevTagTree });
  assert.deepEqual(codes, ["E51"], "E45 must be excluded -- it is already in PREV_TAG's review_reports/ tree, non-retroactive by construction");

  // Scaled check: a legacy review_reports/ root file already in every recent
  // baseline (the 103 pre-E50 files at that root are all in this shape) must
  // never be swept into a new feature's <CODES>, no matter how old.
  const legacyFile = "review_reports/review_T-RELSOP-01.md"; // v3.91.0-era, in every baseline since
  const { codes: legacyCodes } = deriveCodesUnion({
    rrWorkingTree: [legacyFile, ...rrWorkingTree],
    rrPrevTagTree: [legacyFile, ...rrPrevTagTree],
  });
  assert.ok(
    !legacyCodes.includes("RELSOP"),
    "a legacy review_reports/ file already in every recent baseline must never be swept into a new feature's <CODES>",
  );
});

test("E50 step 7a (Item 4 continued — directory absence on disk): review_reports/ not present at all is EXCLUDE, not an error, and contributes nothing", () => {
  // `find review_reports -maxdepth 1` exits 1 with "No such file or
  // directory" when the tree is absent -- a real path a teamwork-lite
  // consumer workspace takes (code-reviewer never dispatched, so
  // review_reports/ never comes into existence). The guard must route this
  // to EXCLUDE before any find/grep runs against the missing directory.
  const flags = deriveGuardFlags({ prevTag: "v3.96.0", rrDirExists: false });
  assert.equal(flags.EXCLUDE_RR, true);
  assert.equal(flags.STOP_RR, false);
  const { codes, admitted } = deriveCodesUnion({
    qaWorkingTree: ["qa_reports/review_T-E50-01.md"],
    qaPrevTagTree: [],
    rrWorkingTree: ["review_reports/review_T-SHOULD-NOT-APPEAR-01.md"], // must never be consulted when excluded
    rrPrevTagTree: [],
    excludeRr: true,
  });
  assert.deepEqual(codes, ["E50"], "an excluded review_reports/ tree must contribute nothing, even if a caller mistakenly passes it working-tree data");
  assert.ok(!admitted.some((f) => f.startsWith("review_reports/")), "no review_reports/ path may enter the admitted set when EXCLUDE_RR is set");
});

test("E50 step 7a: the guard (classification of both trees) precedes every write, and the classifier itself performs none (AC-S6, L:E53)", () => {
  const s7a = fnSrc("step7a");
  const stop = s7a.indexOf("EMPTY_BASELINE"), mk = s7a.indexOf("r.mkdir"), mv = s7a.indexOf("r.move"), codes = s7a.indexOf("deriveCodes(");
  assert.ok(stop > -1 && mk > -1 && mv > -1 && codes > -1, "locate the guard, the derivation and the writes");
  assert.ok(stop < codes, "the guard precedes the derivation — a guard evaluated after the sweep is worthless");
  assert.ok(codes < mk && mk < mv, "the derivation precedes mkdir, which precedes the moves");
  const classifier = fnSrc("classifyArchiveTree");
  assert.ok(!/mkdir|\.move\(|writeFile|mutate\(/.test(classifier), "the classifier is pure: it cannot itself sweep");
});

// ---------------------------------------------------------------------------
// Phase 9 — E65 (step 8/10/11 ordering, adapter-stamp bump) and E55 (terminal
// handback naming). These pin the order itself, since the wrong order was the
// whole defect and a review of the moved steps can miss it.
// ---------------------------------------------------------------------------

test("E65: the five newly-staged metadata paths are STAGE_PATHS members (AC-S6, L:E65)", () => {
  for (const p of E65_METADATA_PATHS) assert.ok(REL.STAGE_PATHS.metadataPaths.includes(p), `STAGE_PATHS stages '${p}' (E65)`);
});

test("E65: the adapter-stamp step names all three deployed adapter files and requires `agc check` to exit 0 (AC-S5, L:E65)", () => {
  assert.deepEqual(REL.ADAPTER_STAMPS.map((x) => x.path).sort(), [".antigravityrules", "AGENTS.md", "CLAUDE.md"]);
  const s7d = fnSrc("step7d");
  assert.ok(s7d.includes('["bin/agc-init.mjs", "check"]'), "step 7d runs `agc check`");
  assert.match(s7d, /res\.status !== 0\) \{\s*throw new ReleaseStop\("ADAPTER_STAMP"/, "a non-zero agc check is an ADAPTER_STAMP stop");
  assert.ok(exitRow(24, "ADAPTER_STAMP"), "SOP Escalation Routes carries the ADAPTER_STAMP row");
  assert.match(SKILL, /adapter stamps and `agc check`/, "SOP step 12 names the stamps and agc check as part of prepare");
});

test("E65: step 7b (driftBaselineIds), 7c (backlog done-marking) and 7d (adapter-stamp bump) all run before the release commit, in that relative order — order is the whole defect (AC-S5, L:E65)", () => {
  const order = RELEASE_SRC.match(/const PHASES = \{\s*prepare: \[([^\]]*)\]/)[1].split(",").map((x) => x.trim());
  const at = (n) => order.indexOf(n);
  for (const n of ["step7a", "step7b", "step7c", "step7d", "step8aStage", "step8aCommitPushPr"]) assert.ok(at(n) > -1, `prepare runs ${n}`);
  assert.ok(at("step7a") < at("step7b") && at("step7b") < at("step7c") && at("step7c") < at("step7d"), "7a, 7b, 7c, 7d in their numbering order");
  assert.ok(at("step7d") < at("step8aStage") && at("step8aStage") < at("step8aCommitPushPr"), "all bookkeeping lands before the stage and the commit");
});

test("E55: the terminal handback names pm's post-release backlog intake as the expected next action, described AFTER the closing write whose next_role hands off to it (AC-P4)", () => {
  const closing = SKILL.indexOf("Closing write: `tw_update_state(");
  const handback = SKILL.indexOf("The `next_role=\"pm\"` handback is pm's backlog intake");
  assert.ok(closing > -1 && handback > -1, "locate the closing write and the handback sentence");
  assert.ok(closing < handback, "the handback is described after the closing write");
  assert.match(SKILL.slice(closing, SKILL.indexOf("\n", closing)), /next_role="pm"/, "the closing write names next_role=\"pm\"");
  assert.match(SKILL.slice(handback), /the expected next action, not optional/, "intake is expected, not optional");
  assert.ok(HISTORY.includes("Terminal handback: backlog intake") && HISTORY.includes("pm's normal intake"), "the old step 14 lives in the history file");
});

// ---------------------------------------------------------------------------
// Phase 10 — E71: four release-SOP defects found only by executing the SOP.
// (a) and (b) extract the SOP's own shell snippets and run them, with a
// negative control reproducing the pre-fix defect; (c) and (d) are wording
// fixes, pinned as content assertions.
// ---------------------------------------------------------------------------

const which = (bin) => {
  try {
    return execSync(`command -v ${bin}`, { encoding: "utf-8", shell: "/bin/sh" }).trim() || null;
  } catch {
    return null;
  }
};

test("E71(a): STAGE_PATHS holds exactly 34 paths (19 directories + 15 metadata), set-equal to FEATURE_DIRS/METADATA_PATHS/E65_METADATA_PATHS/E94_METADATA_PATHS/E198B_METADATA_PATHS (AC-S6)", () => {
  const sp = REL.STAGE_PATHS;
  const expected = [...FEATURE_DIRS, ...METADATA_PATHS, ...E65_METADATA_PATHS, ...E94_METADATA_PATHS, ...E198B_METADATA_PATHS];
  assert.equal(expected.length, 34, "sanity: the five lists total 34");
  assert.equal(sp.featureDirs.length, 19, "19 directories");
  assert.equal(sp.metadataPaths.length, 15, "15 metadata paths");
  assert.deepEqual([...sp.featureDirs, ...sp.metadataPaths].sort(), [...expected].sort());
  assert.ok(HISTORY.includes("19 directories + 15 metadata paths"), "the old prose decomposition lives in the history file (AC-P10)");
});

test("E71(a): the existence pre-filter stages exactly the existing paths, and the script's `git add` is an argv array, so no shell can swallow a missing pathspec (AC-S3, AC-S6, L:E71a)", () => {
  // The old SOP needed `bash -c` because zsh aborts on an unmatched pathspec. The script has no shell: planStage
  // is the existence pre-filter and `git add -- <plan>` is one argv array.
  const present = new Set(["lib/", "tools/", "docs/", "package.json", "index.ts"]);
  const changed = ["lib/a.ts", "tools/b.ts", "docs/c.md", "package.json", "index.ts"];
  assert.deepEqual(REL.planStage({ changed, exists: (m) => present.has(m) }), ["lib/", "tools/", "docs/", "index.ts", "package.json"].sort((x, y) => {
    const order = [...REL.STAGE_PATHS.featureDirs, ...REL.STAGE_PATHS.metadataPaths];
    return order.indexOf(x) - order.indexOf(y);
  }), "exactly the 5 existing paths, in STAGE_PATHS order, none of the 29 missing ones");
  // Negative control: without the existence filter a missing member would be planned and `git add` would abort.
  assert.deepEqual(REL.planStage({ changed: ["schema/x.ts"], exists: () => false }), [], "a changed path whose member is absent is not planned");
  assert.ok(RELEASE_SRC.includes('["add", "--", ...plan]'), "git add takes the plan as one argv array");
  assert.ok(!/shell\s*:\s*true/.test(RELEASE_SRC) && !/["'](bash|zsh|sh)["']/.test(RELEASE_SRC.replace(/\/\/.*$/gm, "")), "the script never spawns a shell");
  assert.ok(!REL.ALLOWED.some((r) => ["bash", "zsh", "sh"].includes(r.cmd)), "no shell is on the allow-list");
  assert.ok(HISTORY.includes("Existence pre-filter, mandatory (E71a)"), "the old bash -c wrapper narrative lives in the history file");
});

test("E71(b): the covers: sweep is NOMATCH-safe by construction — no shell, no glob: names with `*`, `[`, spaces and quotes are matched as data (AC-S3, AC-S6, L:E71b)", () => {
  const odd = ["note [draft] *.md", "it's here.md", "review_T-X-01.md"];
  const moves = REL.planArchiveMoves({
    feature: "f", codes: ["X"], qaRoot: odd, rrRoot: [], participating: { qa: true, rr: false },
    coversLine: (rel) => (rel === "qa_reports/note [draft] *.md" ? "covers: T-X-02" : null),
  });
  assert.deepEqual(moves.map((m) => m.from).sort(), ["qa_reports/note [draft] *.md", "qa_reports/review_T-X-01.md"], "the glob-looking name is swept by its covers: line, as plain data");
  assert.ok(!/["'](bash|zsh|sh)["']/.test(RELEASE_SRC.replace(/\/\/.*$/gm, "")), "no shell child anywhere: zsh NOMATCH cannot occur");
  assert.ok(!/-name '\*\.md'/.test(SKILL), "the historical single-quoted glob does not reappear in the SOP");
  assert.ok(HISTORY.includes('-name "*.md"') || HISTORY.includes("no matches found"), "the old zsh narrative lives in the history file");
});

test("E71(c): the scope rule treats .current/** (incl. .config.json, which IS staged) and tasks.md as non-STOP exclusions (AC-S6, L:E71c)", () => {
  assert.equal(REL.checkScope([".current/handoff.md", ".current/telemetry.jsonl", "tasks.md"]), null, ".current/** and tasks.md never STOP");
  assert.equal(REL.checkScope([".current/.config.json"]), null);
  assert.ok(REL.STAGE_PATHS.metadataPaths.includes(".current/.config.json"), ".config.json is carved out of the exclusion: it IS staged");
  assert.notEqual(REL.checkScope([".currentish/x"]), null, "only the .current/ directory is excluded");
  assert.ok(HISTORY.includes("minus `.config.json`, which IS staged"), "the old scope-rule wording lives in the history file");
});

test("E71(d): a DONE-but-unreleased pre-marked row must be amended in place — the SOP says so and the script's done-mark check enforces it (AC-S5, AC-P4, L:E71d)", () => {
  assert.match(SKILL, /amend a pre-mark in place/, "SOP step 10 tells the agent to amend a pre-mark");
  assert.match(SKILL, /no longer says "not yet released"/);
  assert.match(SKILL, /Touch no other row/, "no duplicate row for the same feature");
  const row = "| E7 | **DONE (not yet released)** — thing | x |";
  const probs = REL.checkDoneMarks({ backlogText: row, diffLines: [], tickets: ["E7"], version: "1.2.3" });
  assert.ok(probs.some((p) => /not yet released/.test(p)), "a pre-marked row is a DONE_MARK problem until it names the version");
  assert.ok(HISTORY.includes("DONE-but-unreleased") && HISTORY.includes("version stamp is still owed"), "the old step 7c wording lives in the history file");
});

// Known asymmetry, pinned as a ratchet: step 7a's review_reports move loop is
// guarded by an enclosing `if [ -z "$EXCLUDE_RR" ]`, while the qa_reports loop
// has no EXCLUDE_QA guard. Running it with EXCLUDE_QA set only prints one
// stderr line, so it was passed as cosmetic. The test fails if either guard's
// presence changes or the RR guard reverts to an inline `&&`, so a fix must
// update this pin. History: specs/e260h-comment-rationale.md (test/release-staging.test.mjs).
test("residual (review round 2, Minor 2; E76): the qa_reports/review_reports asymmetry is closed — each tree's moves are guarded by that tree's own participation flag (AC-S6, L:E50)", () => {
  const base = { feature: "f", codes: ["X"], qaRoot: ["review_T-X-01.md", "expected-red_f.txt"], rrRoot: ["review_T-X-01.md"], newExpectedRed: ["expected-red_f.txt"], coversLine: () => null };
  const none = REL.planArchiveMoves({ ...base, participating: { qa: false, rr: false } });
  assert.deepEqual(none, [], "an excluded tree contributes no moves, in either tree");
  const qaOnly = REL.planArchiveMoves({ ...base, participating: { qa: true, rr: false } });
  assert.ok(qaOnly.length > 0 && qaOnly.every((m) => m.from.startsWith("qa_reports/")), "EXCLUDE_RR: review_reports/ untouched");
  const rrOnly = REL.planArchiveMoves({ ...base, participating: { qa: false, rr: true } });
  assert.ok(rrOnly.length > 0 && rrOnly.every((m) => m.from.startsWith("review_reports/")), "EXCLUDE_QA: qa_reports/ untouched — the old unguarded qa loop is gone");
});

// ---------------------------------------------------------------------------
// Class-assertion pins (E76): instead of pinning one instance, these extract
// step 7a's five fragments and assemble them as the SOP instructs, so the
// assertions run against the shipped script text, not a hand copy of it.
// ---------------------------------------------------------------------------

// Class-assertion pins (E76). The five shell fragments the SOP once assembled are one JS function now, so the
// "variable referenced but never assigned" and "two invocations" hazards cannot occur; the pins below assert
// that class-level property of the script instead.

test("T-E76-02 (class assertion, closes F1): step 7a is ONE function in ONE process — no fragment can reach for an outer-shell variable, and no child shell exists (AC-S3, L:E76)", () => {
  const s7a = fnSrc("step7a");
  assert.ok(s7a.length > 200, "sanity: step 7a is a real function body");
  assert.ok(!/\bprocess\.env\b/.test(s7a), "step 7a reads no ambient environment variable (the old F1 shape: a var left in the outer shell)");
  assert.ok(!REL.ALLOWED.some((r) => ["bash", "zsh", "sh"].includes(r.cmd)), "no shell command is on the allow-list");
  assert.ok(!/shell\s*:\s*true/.test(RELEASE_SRC), "spawn never uses a shell");
  assert.ok(!SKILL.includes("STEP7A"), "the SOP no longer assembles a heredoc script");
  assert.ok(HISTORY.includes("STEP7A"), "the F1/F2 heredoc narrative lives in the history file (AC-P10)");
});

test("T-E76-02 (class assertion, pins fragment 3's identity): the code set is derived in exactly ONE place in step 7a and logged even when empty (AC-S6, L:E76)", () => {
  const s7a = fnSrc("step7a");
  assert.equal([...s7a.matchAll(/deriveCodes\(/g)].length, 1, "exactly one derivation call — two would reopen the empty-derivation hazard");
  assert.match(s7a, /step 7a: <CODES> = \{\$\{codes\.join\(","\) \|\| "∅"\}\}/, "<CODES> is logged also when empty, so a silent no-op is visible");
  assert.deepEqual(REL.deriveCodes({ qaAdmitted: [], rrAdmitted: [] }), [], "an empty derivation is an explicit empty set");
});

test("T-E76-02 (single-invocation property, F2 regression guard): every process call is an argv array through one runner — no `bash -c`, no heredoc, nothing a quote can break (AC-S3, L:E76)", () => {
  const code = RELEASE_SRC.replace(/\/\/.*$/gm, "");
  assert.ok(!/bash -c|<<'?[A-Z]+'?/.test(code), "no `bash -c` and no heredoc in the script");
  assert.match(code, /spawn\(bin, argv, \{ cwd: root/, "the runner spawns with an argv array");
  const r = REL.createRunner({ dryRun: true, out: () => {}, err: () => {} });
  assert.throws(() => r.read("bash", ["-c", "echo hi"], { step: "t" }), /not on the allow-list/, "a shell call is refused by the runner");
  assert.ok(HISTORY.includes("bash <<'STEP7A'"), "the retired heredoc shape is recorded in the history file");
});
