// Coded by @qa-engineer
// Tests for specs/e9-release-self-check.md AC1-AC10 (E9 — release self-check
// script + SOP wiring), authored per T-E9-04 (QA build scope, pre-authorized
// new-file creation per the human-approved cut — skill-qa-engineer Phase 3a
// normally requires asking before creating a parallel test file).
//
// scripts/verify-release.mjs resolves its own `root` from `import.meta.url`
// (dirname of the script file, one level up) and every git check runs with
// `cwd: root` — so, exactly like test/check-version.test.mjs, each test
// copies the REAL script byte-for-byte into a temp fixture root's scripts/
// dir and drives it against a REAL, fully-controlled git repo (a local temp
// "origin" bare repo stands in for the remote — no network access, no mocked
// git output). This exercises the actual shipped git logic (tag resolution,
// upstream tracking, fetch failure, dist parity) rather than a
// reimplementation. VR-9/VR-10 (AC9/AC10) are grep-based SOP-text assertions
// against content/skill-release-engineer.md, following the
// test/release-staging.test.mjs precedent for prompt-text-is-the-contract
// features.
//
// Spec-to-Test map:
//   AC1 (tag missing)                                -> VR-1
//   AC2 (tag exists, not at HEAD)                     -> VR-2
//   AC3 (no upstream / not pushed / fetch failure)     -> VR-3
//   AC4 (check-version.mjs fails, stderr propagated)   -> VR-4
//   AC5 (CHANGELOG missing entry)                      -> VR-5
//   AC6 (dist uncommitted changes)                     -> VR-6
//   AC7 (committed dist parity mismatch)                -> VR-7
//   AC8 (all 6 checks report OK -> OK lines + ALL PASSED) -> VR-8
//   AC9 (SOP step 9a + Escalation Routes row)            -> VR-9
//   AC10 (post-closing-write tw_get_state read-back)     -> VR-10
//   Security smoke (boundary inputs)                     -> VR-SEC-1..4
//
// T-EB-04 (E14, backlog row + T-EB-01) additions — Check 6 "CI ground-truth":
//   Check 6 red at the release commit (FAIL)              -> VR-11
//   Check 6 green at the release commit (OK, no WARN)      -> VR-12
//   Check 6 degradation: gh binary missing (ENOENT)       -> VR-13
//   Check 6 degradation: gh exits non-zero (auth/API err)  -> VR-14
//   Check 6 degradation: zero completed runs               -> VR-15
//   Check 6 degradation: unparseable gh output (bonus)    -> VR-16
//
// T-E78-01/T-E78-02 (E78) additions — sha-matched ground truth, closing the
// v3.102.2 stale-green regression (a green run from an EARLIER commit was
// accepted as ground truth for a release whose own CI was still in flight):
//   green run at a DIFFERENT commit -> WARN (stale-green, the core fix)  -> VR-17
//   red run at a DIFFERENT commit -> WARN, does not block                -> VR-18
//   matching red buried at position 8/10 in the run window -> still FAIL -> VR-19
// VR-11/VR-12 above are retargeted (not new) for this same change: both
// previously shimmed a dummy headSha that could never match a real fixture
// HEAD, which degrades to WARN under sha-matched code.
//
// T-E80-02 (E80) additions — the sha-not-found branch now bounded-polls
// `gh run list` instead of giving up on the first miss (a healthy release's
// own CI run is almost always still in flight the moment step 9a runs):
//   sha absent, then present+success on a later gh call -> OK, no WARN -> VR-20
//   poll budget expires, sha still absent -> byte-identical pre-E80 WARN -> VR-21
//   AGC_VERIFY_CI_WAIT_SECONDS=0 -> exactly one gh call, no wall-clock wait -> VR-22
// VR-17/VR-18 above are amended (not retargeted) for this same change: both
// drive the sha-not-found branch, so each now pins AGC_VERIFY_CI_WAIT_SECONDS=0
// explicitly — otherwise, with runVerifyWithPath's child inheriting an unset
// process.env var, each would silently block for the full 600s default
// (~20 minutes of suite slowdown, not a red; heads-up from code-reviewer's
// T-E80-01 review). VR-9 is retargeted to assert step 9a's new wording, which
// distinguishes "the poll is running, let it finish" from "genuinely
// degraded environment" instead of one catch-all WARN sentence.
// These use a `gh` shim on PATH (a tiny executable script placed in a temp
// dir prepended to PATH) rather than the real `gh` binary — the fixture-repo
// convention above still drives every git-facing check exactly as before;
// only Check 6's external `gh` dependency is substituted.
//
// T-E8284-02 (E82/E84) additions — scripts/verify-release.mjs's CI-wait
// default (Check 6) and the new --close-out mode (E84's "nothing local is
// ahead of upstream" assertion, runnable after the governance bookkeeping
// commit lands and HEAD sits past the release tag):
//   AC1 (E82): CI-wait budget defaults to 480s when unset, pinned
//     BEHAVIORALLY off the script's own first "...left in budget" poll-
//     progress line, never by grepping the source for the literal 480    -> VR-23
//   AC3 (E84): --close-out FAILs when HEAD is ahead of its @{u} upstream,
//     names the ahead count, and never runs Check 1 (tag-at-HEAD) — proven
//     against a fixture shape a reversed `HEAD..@{u}` range would silently
//     PASS, so the pin actually discriminates direction, not just exit code -> VR-24
//   AC4 (E84): --close-out exits 0 with a distinct `CLOSE-OUT PASSED` line
//     when HEAD == upstream and demonstrably never runs Checks 1/3/4/5/6
//     (absence of their `OK:` lines asserted, not merely exit 0); a second
//     fixture with a deliberately-corrupt package.json proves no version is
//     ever resolved in this mode (a crash, not CLOSE-OUT PASSED, would
//     result if it were)                                              -> VR-25, VR-26
//   AC2/AC5 (regression): VR-1..VR-22/VR-SEC-1..4 above are unmodified by
//     this addition — see qa_reports/review_T-E8284-02.md for the full-suite
//     run this claim rests on.
//
// E141 additions (T-E141-01/T-E141-02) — specs/e141-tag-at-head-bookkeeping-
// tolerance.md AC1-AC6: Check 1 (tag-at-HEAD) now tolerates a tag followed
// ONLY by governance-bookkeeping commit(s) (.current/handoff.md,
// .current/*.jsonl, tasks.md):
//   AC1 (tag == HEAD, byte-identical, no tolerance note)      -> VR-28
//   AC2 (bookkeeping-only range tolerated, NOTE printed;       -> VR-27
//        non-bookkeeping range still FAILs, named sha+path)    -> VR-2 (amended)
//   AC3 (offending sha(s)/path(s) named in the FAIL)            -> VR-2 (amended), VR-27/32
//   AC4 (non-ancestor tag keeps the ORIGINAL FAIL, no range     -> VR-29
//        enumeration — ancestry is a precondition, not a
//        substitute, for the tolerance)
//   AC5 (Check 2 untouched — an unpushed bookkeeping commit      -> VR-30
//        still FAILs pushed-to-origin even though Check 1
//        tolerates it)
//   AC6 (merge handling / empty-range unreachability verified    -> T-E141-01
//        by the code-reviewer via scratchpad fixtures, not          review
//        re-derived into this file — see review_reports/            (see spec
//        review_T-E141-01.md)                                       out-of-scope
//                                                                    note)
// T-E141-01 review, non-blocking observations pinned as documented current
// behaviour (qa-engineer judgement call, T-E141-02):
//   observation 4 (deleting an allowlisted path is tolerated)   -> VR-31
//   observation 5 (a non-ASCII allowlisted filename fails       -> VR-32
//        closed)
// VR-2 was re-pointed (not left as-is): its "behind-head" fixture now
// commits to src/real-change.js instead of AFTER-TAG.md so it stays an
// unambiguous non-bookkeeping commit under the new tolerance, and its
// assertions were strengthened to pin AC3's sha+path detail and the absence
// of a tolerance note — see mkFixtureRepo's tag block and VR-2 itself.
//
// T-E142-01 additions (E147) — specs/e142-release-tooling-wave25.md AC1/AC2:
// Check 6's `releaseSha` now resolves from the release tag first (same
// two-call pattern Check 1 uses), falling back to `git rev-parse HEAD` only
// when no such tag exists yet. This closes the defect a wave release exposes:
// pre-fix, Check 6 unconditionally used HEAD, so a governance-bookkeeping
// commit landed on top of the actual release commit (the E141
// "behind-head-bookkeeping" shape) made Check 6 poll/match CI runs against
// the WRONG commit.
//   AC1 (tag at A, bookkeeping commit B on top -> resolves/matches A, never
//        B, even when a red run is shimmed against B)              -> VR-33
//   AC2 (no tag yet -> unchanged fallback to HEAD, still matches a run
//        recorded against HEAD's own sha; VR-1/VR-8's tag-missing fixtures
//        also stay green unmodified, regression-confirmed)          -> VR-34

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync, execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const REAL_VERIFY_SCRIPT = fs.readFileSync(
  path.join(ROOT, "scripts", "verify-release.mjs"),
  "utf-8",
);
const REAL_CHECK_VERSION_SCRIPT = fs.readFileSync(
  path.join(ROOT, "scripts", "check-version.mjs"),
  "utf-8",
);
const SKILL = fs.readFileSync(
  path.join(ROOT, "content", "skill-release-engineer.md"),
  "utf-8",
);

// Sanity: fail loudly (not silently skip) if the real script's shape drifts
// out from under this fixture builder.
assert.ok(
  REAL_VERIFY_SCRIPT.includes('name:\\s*"agent-governance-mcp",\\s*version:\\s*"([^"]+)"'),
  "fixture assumes verify-release.mjs's committed-dist Server() literal regex; update fixtures if this changes",
);

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "QA Fixture",
  GIT_AUTHOR_EMAIL: "qa-fixture@example.com",
  GIT_COMMITTER_NAME: "QA Fixture",
  GIT_COMMITTER_EMAIL: "qa-fixture@example.com",
  GIT_CONFIG_NOSYSTEM: "1",
};

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", env: GIT_ENV }).trim();
}

function writeFixtureFiles(root, { version, indexVersion, distVersion, distContent, changelog }) {
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "verify-release.mjs"), REAL_VERIFY_SCRIPT);
  fs.writeFileSync(path.join(root, "scripts", "check-version.mjs"), REAL_CHECK_VERSION_SCRIPT);
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "agent-governance-mcp", version }, null, 2),
  );
  fs.writeFileSync(
    path.join(root, "index.ts"),
    `new Server({ name: "agent-governance-mcp", version: "${indexVersion}" });\n`,
  );
  if (changelog !== null) {
    fs.writeFileSync(path.join(root, "CHANGELOG.md"), changelog);
  }
  if (distContent !== null) {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "dist", "index.js"),
      distContent ??
        `new Server({ name: "agent-governance-mcp", version: "${distVersion ?? version}" });\n`,
    );
  }
}

function defaultChangelog(version) {
  return `# Changelog\n\n## [${version}] - 2026-01-01\n### Added\n- fixture entry\n`;
}

/**
 * Build a fully-controlled real git repo (with a local bare "origin") to
 * drive scripts/verify-release.mjs's actual git logic. Returns { root, run }.
 *
 * Options:
 *   version           target/package.json version (default "1.0.0")
 *   indexVersion      index.ts Server() version (default = version)
 *   distVersion       committed dist/index.js Server() version (default = version)
 *   distContent       raw override for dist/index.js content (null = omit file)
 *   changelog         raw CHANGELOG.md content (null = omit file)
 *   tag               "at-head" | "behind-head" | "behind-head-bookkeeping" |
 *                     "behind-head-bookkeeping-delete" |
 *                     "behind-head-bookkeeping-lane" |
 *                     "behind-head-bookkeeping-archived-lane" |
 *                     "behind-head-bookkeeping-tasks-primary" |
 *                     "behind-head-bookkeeping-tasks-lane" |
 *                     "behind-head-bookkeeping-archive-dir" |
 *                     "behind-head-bookkeeping-history-dir" |
 *                     "behind-head-a1-nested-lane" | "behind-head-a1-dot-lane" |
 *                     "behind-head-a1-config" | "behind-head-a1-feature-split" |
 *                     "behind-head-nonascii" |
 *                     "diverged" | "none" (default "at-head") — see the tag
 *                     block below for what each E141 mode reproduces (E174a
 *                     added the four lane-path tolerance shapes plus the
 *                     four A1 negative-case shapes).
 *   origin            "pushed" | "no-upstream" | "not-pushed" | "unreachable" | "none"
 *   distUncommitted   if true, dirty the working-tree dist/index.js after commit
 */
function mkFixtureRepo({
  version = "1.0.0",
  indexVersion = version,
  distVersion = version,
  distContent = undefined,
  changelog = defaultChangelog(version),
  tag = "at-head",
  origin = "pushed",
  distUncommitted = false,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "verify-release-"));
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), "verify-release-remote-"));

  git(["init", "-q"], root);
  git(["checkout", "-q", "-b", "main"], root);
  git(["config", "commit.gpgsign", "false"], root);

  writeFixtureFiles(root, { version, indexVersion, distVersion, distContent, changelog });
  git(["add", "-A"], root);
  git(["commit", "-q", "-m", "init"], root);

  const firstCommitSha = git(["rev-parse", "HEAD"], root);

  if (origin !== "none") {
    git(["init", "-q", "--bare"], remote);
    const originUrl = origin === "unreachable" ? path.join(remote, "does-not-exist") : remote;
    git(["remote", "add", "origin", originUrl], root);
  }

  if (origin === "pushed") {
    git(["push", "-q", "-u", "origin", "main"], root);
  } else if (origin === "not-pushed") {
    // Push the first commit, then add a second local-only commit so HEAD
    // diverges from the upstream tracking branch.
    git(["push", "-q", "-u", "origin", "main"], root);
    fs.writeFileSync(path.join(root, "NOTES.md"), "local-only change\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "local only"], root);
  }
  // "no-upstream": origin remote exists but no push / no upstream tracking ref.
  // "unreachable": origin remote points at a nonexistent path (fetch fails).
  // "none": no origin remote configured at all (fetch fails "not found").

  if (tag === "behind-head") {
    // AC2/AC3 (E141): a REAL, non-bookkeeping change after the tag — never
    // tolerated. Deliberately pathed under src/ (not on the E141 allowlist)
    // so this fixture cannot be mistaken for a bookkeeping-only commit (VR-2
    // was re-pointed here per T-E141-02 — the fixture must stay unambiguous
    // even though the pre-E141 name "AFTER-TAG.md" was already technically
    // off the allowlist).
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "real-change.js"), "// real change after tag\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "after tag: real change"], root);
  } else if (tag === "behind-head-bookkeeping") {
    // AC2 (E141): the v3.111.0 shape — exactly ONE commit after the tag
    // touching ONLY SOP step 13a's bookkeeping paths. Must be tolerated:
    // Check 1 OK with an explicit NOTE naming the tolerated count, never a
    // silent pass.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "handoff.md"), "status: PASS\n");
    fs.writeFileSync(path.join(root, ".current", "metrics.jsonl"), "{}\n");
    fs.writeFileSync(path.join(root, "tasks.md"), "- [x] done\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping"], root);
  } else if (tag === "behind-head-bookkeeping-delete") {
    // T-E141-01 review observation 4 (non-blocking, pinned here): deleting
    // an allowlisted bookkeeping path is tolerated — the path is bookkeeping
    // either way. The file must exist BEFORE the tag so the post-tag commit
    // can delete it.
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "telemetry.jsonl"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "add telemetry sidecar"], root);
    git(["tag", `v${version}`], root);
    git(["rm", "-q", ".current/telemetry.jsonl"], root);
    git(["commit", "-q", "-m", "chore(governance): drop stale telemetry sidecar"], root);
  } else if (tag === "behind-head-bookkeeping-lane") {
    // E174a: since the E123 lane flip, 13a stages `.current/<lane>/...`
    // paths, not the flat `.current/...` forms VR-27 above already pins.
    // One post-tag commit touching ONLY lane-scoped bookkeeping paths across
    // two lanes (_primary's handoff.md + telemetry.jsonl, a ticket lane's
    // dispatch.jsonl + usage.jsonl) must still be tolerated as a whole.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "_primary"), { recursive: true });
    fs.mkdirSync(path.join(root, ".current", "e174a"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "_primary", "handoff.md"), "status: PASS\n");
    fs.writeFileSync(path.join(root, ".current", "_primary", "telemetry.jsonl"), "{}\n");
    fs.writeFileSync(path.join(root, ".current", "e174a", "dispatch.jsonl"), "{}\n");
    fs.writeFileSync(path.join(root, ".current", "e174a", "usage.jsonl"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (lane-scoped)"], root);
  } else if (tag === "behind-head-bookkeeping-archived-lane") {
    // E174a: a lane literally NAMED "archived" is a distinct, safe lane
    // segment — NOT the excluded "archive" directory (NON_LANE_DIRS).
    // Must be tolerated like any other lane.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "archived"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "archived", "handoff.md"), "status: PASS\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (archived lane)"], root);
  } else if (tag === "behind-head-bookkeeping-tasks-primary") {
    // E126 T-E126-04/T-E126-06 (X5/E198(a), spec AC10): a lane's tw_add_task
    // / tw_complete_task write touches `.current/_primary/tasks.md` exactly
    // as it already touches that lane's handoff.md/*.jsonl (E174a) — one
    // post-tag commit touching ONLY that literal path must still be
    // tolerated, mirroring VR-39's shape one-for-one but for tasks.md.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "_primary"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "_primary", "tasks.md"), "- [x] done\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (_primary tasks.md)"], root);
  } else if (tag === "behind-head-bookkeeping-tasks-lane") {
    // E126 T-E126-04/T-E126-06 (X5/E198(a), spec AC10): the lane-scoped
    // regex addition — `.current/<lane>/tasks.md` — mirroring VR-39's
    // lane-scoped handoff.md/*.jsonl shape for tasks.md.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "e126x"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "e126x", "tasks.md"), "- [x] done\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (lane tasks.md)"], root);
  } else if (tag === "behind-head-bookkeeping-archive-dir") {
    // E174a: `.current/archive/...` is the excluded aggregation directory
    // (NON_LANE_DIRS), never a lane — a commit touching it must NOT be
    // tolerated even though the shape otherwise mimics a lane-scoped
    // bookkeeping path.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "archive", "2026-01", "e001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".current", "archive", "2026-01", "e001", "handoff.md"),
      "status: PASS\n",
    );
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (archive dir)"], root);
  } else if (tag === "behind-head-bookkeeping-history-dir") {
    // E174a: `.current/history/...` is the other excluded directory
    // (NON_LANE_DIRS) — same non-tolerance as the archive-dir case above.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "history", "2026-01", "e001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".current", "history", "2026-01", "e001", "handoff.md"),
      "status: PASS\n",
    );
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (history dir)"], root);
  } else if (tag === "behind-head-a1-nested-lane") {
    // A1 (human-mandated negative case): a two-segment path under .current/
    // is never a lane — LANE_SEGMENT_RE_SRC/isSafeLaneName only ever match a
    // single path segment. Must NOT be tolerated.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "a", "b"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "a", "b", "handoff.md"), "status: PASS\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (nested path)"], root);
  } else if (tag === "behind-head-a1-dot-lane") {
    // A1: a dot-prefixed lane name is not a safe path segment
    // (isSafeLaneName's first-char class excludes "."). Must NOT be
    // tolerated.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", ".x"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", ".x", "handoff.md"), "status: PASS\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (dot lane)"], root);
  } else if (tag === "behind-head-a1-config") {
    // A1: .current/.config.json is explicitly NOT a lane file (backlog
    // E174a scope note) and must stay top-level / out of the allowlist.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", ".config.json"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (config)"], root);
  } else if (tag === "behind-head-a1-feature-split") {
    // A1: .current/<lane>/feature-split.md is not a LANE_FILES entry (only
    // handoff.md + the *.jsonl sidecars are) — must NOT be tolerated even
    // though it sits directly under a valid lane dir.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current", "_primary"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "_primary", "feature-split.md"), "# split\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): post-release bookkeeping (feature-split)"], root);
  } else if (tag === "behind-head-nonascii") {
    // T-E141-01 review observation 5 (non-blocking, pinned here): a
    // non-ASCII allowlisted filename fails closed under default
    // core.quotePath — git emits it quoted/octal-escaped, which matches no
    // allowlist regex, so the commit is (correctly) treated as a
    // non-bookkeeping offender rather than silently tolerated.
    git(["tag", `v${version}`], root);
    fs.mkdirSync(path.join(root, ".current"), { recursive: true });
    fs.writeFileSync(path.join(root, ".current", "métrics.jsonl"), "{}\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "chore(governance): add metrics sidecar (non-ascii name)"], root);
  } else if (tag === "diverged") {
    // AC4 (E141): tag exists but is NOT an ancestor of HEAD (wrong branch /
    // rewritten history). Ancestry is a precondition of the tolerance, never
    // a substitute for it — the ORIGINAL "does not point at HEAD" FAIL must
    // stay byte-identical, with no range enumeration appended.
    git(["checkout", "-q", "-b", "release-branch"], root);
    fs.writeFileSync(path.join(root, "RELEASE-ONLY.md"), "tagged on a side branch\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "release commit on side branch"], root);
    git(["tag", `v${version}`], root);
    git(["checkout", "-q", "main"], root);
    fs.writeFileSync(path.join(root, "MAIN-ONLY.md"), "main moved on without the tag\n");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "main diverges"], root);
  } else if (tag === "at-head") {
    git(["tag", `v${version}`], root);
  }
  // "none": no tag created.

  if (distUncommitted) {
    fs.writeFileSync(
      path.join(root, "dist", "index.js"),
      `new Server({ name: "agent-governance-mcp", version: "${distVersion}" });\n// dirty working-tree edit\n`,
    );
  }

  return { root, remote, firstCommitSha };
}

function runVerify(root, args = []) {
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts", "verify-release.mjs"), ...args],
    { cwd: root, encoding: "utf-8" },
  );
}

/**
 * Check 6 (E14) shims `gh` via a real executable on PATH rather than mocking
 * spawnSync — this exercises the actual `spawnSync("gh", ...)` resolution
 * path in scripts/verify-release.mjs, mirroring the "drive the real script
 * against a real environment" convention the rest of this file uses for git.
 *
 * `runVerifyWithPath` overrides the CHILD PROCESS's PATH so verify-release.mjs
 * finds the shim (or, for the gh-missing case, finds no `gh` at all) while
 * `git` still resolves from a real system path — isolating Check 6 without
 * disturbing Checks 1-5.
 */
function mkGhShim(scriptBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-"));
  const ghPath = path.join(dir, "gh");
  fs.writeFileSync(ghPath, scriptBody);
  fs.chmodSync(ghPath, 0o755);
  return dir;
}

/**
 * Resolve an executable via a manual PATH walk (no shelling out to
 * `which`/`where`, which would itself be a PATH-resolution dependency).
 */
function resolveOnPath(bin) {
  const exts = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  const dirs = (process.env.PATH || "").split(path.delimiter);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, bin + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // not here — keep walking
      }
    }
  }
  throw new Error(`resolveOnPath: could not find '${bin}' on PATH=${process.env.PATH}`);
}

// A PATH containing ONLY the external binaries this test file legitimately
// needs and NOTHING ELSE (crucially, never `gh`): `git` (Checks 1/2/5's
// `execFileSync("git", ...)` and check-version.mjs's git calls — `node`
// itself is invoked via the absolute `process.execPath`, and
// check-version.mjs's `execSync` shells out to the literal `/bin/sh`, not a
// PATH-resolved `sh`) plus `cat` (the `ghJsonShim` fixtures' `#!/bin/sh`
// bodies pipe their canned JSON through `cat <<'EOF' ... EOF`, an external
// command the shell resolves via PATH — `echo`-only shim bodies need
// nothing extra, since `echo` is a shell builtin).
//
// A fixed "/usr/bin:/bin" (the prior approach) is NOT a safe "no gh" PATH on
// every host: GitHub's ubuntu-latest hosted runner image installs the `gh`
// CLI via apt at /usr/bin/gh, so that static path silently stops being
// gh-less in CI (VR-13 root cause — it degraded to the real `gh`, which then
// hit the gh-run-list-failed branch instead of ENOENT, and only the ENOENT
// wording was pinned). Building the shim from whatever this test runner's
// OWN environment actually resolves makes the "no gh anywhere on PATH"
// guarantee hold on any machine, not just ones shaped like a macOS/Homebrew
// checkout.
let _noGhSystemPathDir;
function noGhSystemPath() {
  if (_noGhSystemPathDir) return _noGhSystemPathDir;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "no-gh-path-"));
  for (const bin of ["git", "cat"]) {
    fs.symlinkSync(resolveOnPath(bin), path.join(dir, bin));
  }
  _noGhSystemPathDir = dir;
  return dir;
}

// `extraEnv` merges OVER `process.env` (after `PATH`) — every E80 poll test
// uses this to pin AGC_VERIFY_CI_WAIT_SECONDS explicitly rather than relying
// on this test process's own (unset) shell inheritance, so a developer's
// exported value can never silently change test behavior (T-E80-01 review
// heads-up).
function runVerifyWithPath(root, pathValue, args = [], extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts", "verify-release.mjs"), ...args],
    { cwd: root, encoding: "utf-8", env: { ...process.env, PATH: pathValue, ...extraEnv } },
  );
}

function ghJsonShim(json) {
  return `#!/bin/sh\ncat <<'EOF'\n${json}\nEOF\n`;
}

// A `gh` shim that returns a DIFFERENT canned response on each successive
// invocation (last response repeats for any calls beyond the list) — used to
// prove the E80 poll loop actually re-queries `gh` rather than caching its
// first answer. Each response is written to its own file so a multi-line
// JSON payload never has to survive re-quoting inside the shell script body.
function mkGhSequenceShim(jsons) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-seq-"));
  const counterPath = path.join(dir, "counter");
  fs.writeFileSync(counterPath, "0");
  jsons.forEach((json, i) => {
    fs.writeFileSync(path.join(dir, `resp-${i}`), json);
  });
  const lastIndex = jsons.length - 1;
  fs.writeFileSync(
    path.join(dir, "gh"),
    `#!/bin/sh\nN=$(cat "${counterPath}")\ncat "${dir}/resp-$N"\nif [ "$N" -lt ${lastIndex} ]; then\n  echo $((N + 1)) > "${counterPath}"\nfi\n`,
  );
  fs.chmodSync(path.join(dir, "gh"), 0o755);
  return dir;
}

// A `gh` shim that always returns the same canned response but records how
// many times it was invoked, via a counter file the test reads back
// afterward — used to prove `AGC_VERIFY_CI_WAIT_SECONDS=0` calls `gh` exactly
// once rather than merely completing quickly (a slow-but-single call and a
// fast-multi-call loop could otherwise both look "instant" to a wall-clock
// assertion alone).
function mkGhCallCounterShim(json) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-count-"));
  const counterPath = path.join(dir, "calls");
  fs.writeFileSync(counterPath, "0");
  fs.writeFileSync(
    path.join(dir, "gh"),
    `#!/bin/sh\nN=$(cat "${counterPath}")\necho $((N + 1)) > "${counterPath}"\ncat <<'EOF'\n${json}\nEOF\n`,
  );
  fs.chmodSync(path.join(dir, "gh"), 0o755);
  return { dir, counterPath };
}

// ---------------------------------------------------------------------------
// VR-1 (AC1): tag missing
// ---------------------------------------------------------------------------
test("VR-1 (AC1): tag does not exist -> exit non-zero, failure line names the tag and says it does not exist", () => {
  const { root } = mkFixtureRepo({ version: "1.2.3", tag: "none" });
  const result = runVerify(root, ["v1.2.3"]);
  assert.notEqual(result.status, 0, "missing tag must fail the run");
  assert.match(
    result.stderr,
    /FAIL: tag v1\.2\.3 does not exist/,
    "failure line must name the tag and state it does not exist",
  );
});

// ---------------------------------------------------------------------------
// VR-2 (AC2/AC3, amended by T-E141-02): tag exists but points at a commit
// other than HEAD, due to a REAL (non-bookkeeping) commit. Since E141, "tag
// != HEAD" is no longer categorically a FAIL — it FAILs only when the range
// contains a non-bookkeeping path (AC2's second half / AC3). Re-pointed at
// src/real-change.js (tag: "behind-head", see mkFixtureRepo) so this pin
// cannot be satisfied by the new tolerance and does not silently re-break
// AC2 by asserting a blanket rule the spec no longer makes true. Also pins
// AC3's offender detail: the FAIL names the offending sha and path.
// ---------------------------------------------------------------------------
test("VR-2 (AC2/AC3): tag exists but HEAD moved on with a REAL (non-bookkeeping) commit -> exit non-zero, failure line names both commits, sha, and offending path; no tolerance note fires", () => {
  const { root, firstCommitSha } = mkFixtureRepo({ version: "2.0.0", tag: "behind-head" });
  const headSha = git(["rev-parse", "HEAD"], root);
  assert.notEqual(firstCommitSha, headSha, "sanity: HEAD must have moved past the tagged commit");

  const result = runVerify(root, ["v2.0.0"]);
  assert.notEqual(result.status, 0, "a non-bookkeeping commit after the tag must still fail the run");
  assert.match(
    result.stderr,
    /FAIL: tag v2\.0\.0 \([0-9a-f]+\) does not point at HEAD \([0-9a-f]+\)/,
    "failure line must name both the tag's commit and HEAD's commit",
  );
  assert.ok(result.stderr.includes(firstCommitSha.slice(0, 7)) || result.stderr.includes(firstCommitSha));
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*src\/real-change\.js/,
    "AC3: the FAIL must name the offending path, not just say 'does not point at HEAD'",
  );
  assert.doesNotMatch(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated/,
    "a real source change must never fire the E141 tolerance note",
  );
});

// ---------------------------------------------------------------------------
// VR-3 (AC3): push-status checks — no upstream / not pushed / fetch failure
// ---------------------------------------------------------------------------
test("VR-3 (AC3): no upstream tracking branch configured -> exit non-zero, reports 'no upstream tracking branch configured'", () => {
  const { root } = mkFixtureRepo({ version: "3.0.0", tag: "at-head", origin: "no-upstream" });
  const result = runVerify(root, ["v3.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: no upstream tracking branch configured/);
});

test("VR-3 (AC3): local commits not pushed -> exit non-zero, reports both SHAs and 'local commits not pushed'", () => {
  const { root } = mkFixtureRepo({ version: "3.0.1", tag: "at-head", origin: "not-pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "@{u}"], root);
  assert.notEqual(headSha, upstreamSha, "sanity: HEAD must have diverged from upstream");

  const result = runVerify(root, ["v3.0.1"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local commits not pushed/);
  assert.ok(result.stderr.includes(headSha), "failure line must name HEAD's SHA");
  assert.ok(result.stderr.includes(upstreamSha), "failure line must name upstream's SHA");
});

test("VR-3 (AC3): git fetch origin failure (unreachable remote) is itself a FAIL, not silently skipped", () => {
  const { root } = mkFixtureRepo({ version: "3.0.2", tag: "at-head", origin: "unreachable" });
  const result = runVerify(root, ["v3.0.2"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: could not verify against origin:/,
    "an unreachable origin (fetch failure) must be reported as a FAIL, mirroring never silently skipping the push check",
  );
});

test("VR-3 (AC3): no origin remote configured at all -> exit non-zero (fetch fails, no push check silently skipped)", () => {
  const { root } = mkFixtureRepo({ version: "3.0.3", tag: "at-head", origin: "none" });
  const result = runVerify(root, ["v3.0.3"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: could not verify against origin:/);
});

// ---------------------------------------------------------------------------
// VR-4 (AC4): check-version.mjs itself fails -> stderr propagated verbatim
// ---------------------------------------------------------------------------
test("VR-4 (AC4): check-version.mjs failing (package.json/index.ts mismatch) -> non-zero exit, its stderr surfaced verbatim, not re-implemented", () => {
  const { root } = mkFixtureRepo({
    version: "4.0.0",
    indexVersion: "4.0.1", // mismatch trips check-version.mjs's own guard
    tag: "at-head",
    origin: "pushed",
  });
  const result = runVerify(root, ["v4.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: check-version\.mjs failed: check:version — version mismatch: package\.json=4\.0\.0 index\.ts=4\.0\.1/,
    "verify-release.mjs must surface check-version.mjs's own stderr verbatim, not a re-derived message",
  );
});

// ---------------------------------------------------------------------------
// VR-5 (AC5): CHANGELOG has no entry for the target version
// ---------------------------------------------------------------------------
test("VR-5 (AC5): CHANGELOG.md missing entirely -> exit non-zero, failure line names the missing version", () => {
  const { root } = mkFixtureRepo({ version: "5.0.0", changelog: null, tag: "at-head" });
  const result = runVerify(root, ["v5.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: CHANGELOG\.md has no entry for v5\.0\.0/);
});

test("VR-5 (AC5): CHANGELOG.md present but has no heading for the target version -> exit non-zero, names the missing version", () => {
  const { root } = mkFixtureRepo({
    version: "5.0.1",
    changelog: "# Changelog\n\n## [4.9.0] - 2025-12-01\n### Added\n- older entry\n",
    tag: "at-head",
  });
  const result = runVerify(root, ["v5.0.1"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: CHANGELOG\.md has no entry for v5\.0\.1/);
});

// ---------------------------------------------------------------------------
// VR-6 (AC6): dist/ has uncommitted working-tree changes
// ---------------------------------------------------------------------------
test("VR-6 (AC6): dist/ has uncommitted changes -> exit non-zero, says dist must be rebuilt and committed; AC7 sub-check still runs independently and reports OK", () => {
  const { root } = mkFixtureRepo({
    version: "6.0.0",
    distVersion: "6.0.0", // committed dist matches target; only working tree is dirty
    tag: "at-head",
    distUncommitted: true,
  });
  const porcelain = git(["status", "--porcelain", "--", "dist/"], root);
  assert.notEqual(porcelain, "", "sanity: dist/ must show as dirty in git status");

  const result = runVerify(root, ["v6.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: dist\/ has uncommitted changes — rebuild and commit before releasing/,
  );
  assert.ok(
    !result.stderr.includes("committed dist/index.js version"),
    "AC6 failing must not also emit an AC7 mismatch line when the committed artifact itself matches — the two sub-checks are independent",
  );
});

// ---------------------------------------------------------------------------
// VR-7 (AC7): committed dist/index.js at HEAD carries the wrong version
// ---------------------------------------------------------------------------
test("VR-7 (AC7): committed dist/index.js at HEAD has a stale version -> exit non-zero, failure line names both versions", () => {
  const { root } = mkFixtureRepo({
    version: "7.0.0",
    distVersion: "6.9.9", // committed artifact is stale
    tag: "at-head",
  });
  const porcelain = git(["status", "--porcelain", "--", "dist/"], root);
  assert.equal(porcelain, "", "sanity: working tree must be clean (isolating this to the AC7 sub-check)");

  const result = runVerify(root, ["v7.0.0"]);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /FAIL: committed dist\/index\.js version \(6\.9\.9\) != target v7\.0\.0/,
  );
  assert.ok(
    !result.stderr.includes("dist/ has uncommitted changes"),
    "a clean working tree must not also trip the AC6 uncommitted-changes line — independent sub-checks",
  );
});

test("VR-7 (AC7): dist/index.js absent at HEAD (never committed) -> exit non-zero, distinct message", () => {
  const { root } = mkFixtureRepo({ version: "7.0.1", distContent: null, tag: "at-head" });
  const result = runVerify(root, ["v7.0.1"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: dist\/index\.js not found at HEAD — was it committed\?/);
});

// ---------------------------------------------------------------------------
// VR-8 (AC8): all six checks report OK (title corrected T-EB-04 — Check 6/E14
// landed after this test was first authored against 5 checks; the loop
// below was asserting OK lines by name, never a count, so it stayed green
// through E14 by accident rather than by design — see review_T-EB-03.md).
// Check 6 is included in the OK-line loop below: the fixture's origin is a
// local bare repo, not a real GitHub remote, so `gh run list` cannot resolve
// a host and Check 6 degrades via WARN — but a WARN is not a fail, so it
// still reports OK and the run still exits 0 with empty stderr. This is
// intentionally NOT gh-shimmed (unlike VR-11..VR-16 below): it pins the
// real, unmodified environment behavior a bare `npm test` run hits.
// ---------------------------------------------------------------------------
test("VR-8 (AC8): all 6 checks report OK -> one OK line per check, final ALL CHECKS PASSED line, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "8.0.0", tag: "at-head", origin: "pushed" });
  const result = runVerify(root, ["v8.0.0"]);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  for (const name of [
    "tag-at-HEAD",
    "pushed-to-origin",
    "check-version",
    "CHANGELOG entry",
    "dist committed+parity",
    "CI ground-truth",
  ]) {
    assert.match(result.stdout, new RegExp(`OK: ${name.replace(/[+]/g, "\\+")}`), `expected an OK line for '${name}'`);
  }
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v8\.0\.0\)/);
  assert.equal(
    result.stderr,
    "",
    "a fully passing run must not print anything to stderr — Check 6's graceful degradation warns on stdout only (VR-8 pin)",
  );
  // Check 6 cannot resolve a GitHub host from the fixture's local-bare-repo
  // origin, so it degrades — document that this test's "all OK" run still
  // legitimately includes a WARN (not a masked failure).
  assert.match(
    result.stdout,
    /WARN: CI ground-truth —/,
    "sanity: this fixture has no real GitHub remote, so Check 6 is expected to WARN-degrade even on an all-OK run",
  );
});

test("VR-8 (AC8): multi-cause failure surfaces every FAIL in one run (no short-circuit)", () => {
  // Note: dist VERSION mismatch is deliberately avoided here — check-version.mjs
  // independently reads the same working-tree dist/index.js, so a version
  // mismatch would also trip its own gate and mask the "check-version still
  // OK" assertion below. distUncommitted (AC6) with a matching version keeps
  // check-version.mjs green while still failing verify-release's own
  // dist-committed+parity check, isolating the four intended failures.
  const { root } = mkFixtureRepo({
    version: "8.1.0",
    tag: "none", // the release tag is missing, so the tag check fails (AC1)
    changelog: null, // no CHANGELOG entry, so the changelog check fails (AC5)
    distUncommitted: true, // dirty dist/ fails the dist-clean check (AC6); the version itself still matches
    origin: "no-upstream", // no upstream branch, so the pushed check fails (AC3)
  });
  const result = runVerify(root, ["v8.1.0"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FAIL: tag v8\.1\.0 does not exist/);
  assert.match(result.stderr, /FAIL: no upstream tracking branch configured/);
  assert.match(result.stderr, /FAIL: CHANGELOG\.md has no entry for v8\.1\.0/);
  assert.match(result.stderr, /FAIL: dist\/ has uncommitted changes — rebuild and commit before releasing/);
  assert.match(result.stdout, /OK: check-version/, "an unrelated passing check must still report OK in the same run");
  assert.match(result.stderr, /check:release — FAILED \(4 check\(s\) failed\)/);
});

// ---------------------------------------------------------------------------
// VR-11 (E14, T-EB-01; retargeted E78/T-E78-02): Check 6 — a definitively red
// completed CI run AT THE RELEASE COMMIT STOPs the release; every other check
// still runs and reports OK (no short-circuit), matching the
// Checks-run-independently invariant already pinned for VR-8's
// multi-cause-failure test.
//
// RETARGET NOTE (T-E78-02): this test previously shimmed a dummy
// `headSha: "2222...2"` that could never equal a real fixture repo's actual
// HEAD. Under pre-E78 code (ground truth = runs[0], sha unchecked) that
// dummy sha was irrelevant and the test passed for the wrong reason; under
// E78's sha-matched code it now WARNs ("this commit's CI has not completed
// yet") instead of FAILing, because the shimmed run's headSha never matches
// this fixture's real HEAD. Retargeted, not retired — the FAIL path is the
// single most consequential assertion in this cut, so it is resolved via the
// same `git(["rev-parse", "HEAD"], root)` the real script itself uses, not a
// placeholder. Independently confirmed (outside this file, via a standalone
// probe fixture) that setting the shimmed headSha to the fixture's real HEAD
// makes the red-run FAIL path arm correctly before this retarget was written.
// ---------------------------------------------------------------------------
test("VR-11 (E14): shimmed gh reports a red completed run AT the release commit -> exit non-zero, FAIL names conclusion+headSha+url, other 5 checks still OK", () => {
  const { root } = mkFixtureRepo({ version: "10.0.0", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "failure",
          headSha: releaseSha,
          url: "https://example.com/actions/runs/2",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.0"]);
  assert.notEqual(result.status, 0, "a red completed CI run at the release commit must FAIL the release self-check");
  const escapedHeadPrefix = releaseSha.slice(0, 12);
  assert.match(
    result.stderr,
    new RegExp(`FAIL: latest completed CI run on main concluded "failure" \\(head ${escapedHeadPrefix}\\) — https://example\\.com/actions/runs/2`),
    "FAIL line must name the conclusion, the (truncated) head SHA of the release commit, and the run URL",
  );
  for (const name of ["tag-at-HEAD", "pushed-to-origin", "check-version", "CHANGELOG entry", "dist committed+parity"]) {
    assert.match(
      result.stdout,
      new RegExp(`OK: ${name.replace(/[+]/g, "\\+")}`),
      `Check 6 failing must not prevent '${name}' from running and reporting OK`,
    );
  }
  assert.match(result.stderr, /check:release — FAILED \(1 check\(s\) failed\)/);
});

// ---------------------------------------------------------------------------
// VR-12 (E14; retargeted E78/T-E78-02): Check 6 — a green completed CI run AT
// THE RELEASE COMMIT reports OK with no WARN. Same retarget rationale as
// VR-11 above: the dummy `headSha: "1111...1"` never matched a real fixture
// HEAD, so under E78's sha-matched code this degraded to WARN instead of OK.
// ---------------------------------------------------------------------------
test("VR-12 (E14): shimmed gh reports a successful completed run AT the release commit -> OK line, exit 0, no WARN emitted, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.0.1", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: releaseSha,
          url: "https://example.com/actions/runs/1",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.1"]);
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.ok(
    !result.stdout.includes("WARN: CI ground-truth"),
    "a genuinely green completed run at the release commit must not also degrade — WARN is reserved for cannot-obtain-ground-truth paths",
  );
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v10\.0\.1\)/);
  assert.equal(result.stderr, "", "a fully passing run (including a real green Check 6) must not print to stderr");
});

// ---------------------------------------------------------------------------
// VR-17 (E78, T-E78-02 behavior 1 — THE regression this ticket fixes): a
// completed GREEN run whose headSha is a DIFFERENT commit than the one being
// released must NOT satisfy the check — it must WARN, exactly like the
// v3.102.2 incident (a stale green run from an earlier commit was accepted
// as ground truth for a release whose own CI was still in flight). This is
// the core "stale-green" case T-E78-01 exists to close; VR-12 above only
// proves the matching-sha green path, which is necessary but not sufficient.
// ---------------------------------------------------------------------------
test("VR-17 (E78): shimmed gh reports a green completed run at a DIFFERENT commit -> WARN (stale-green, v3.102.2 regression), never OK, exit 0, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.0.6", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const otherSha = "3333333333333333333333333333333333333333";
  assert.notEqual(otherSha, releaseSha, "sanity: the shimmed run's headSha must differ from the release commit");
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: otherSha,
          url: "https://example.com/actions/runs/3",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  // wait=0 (T-E80-02): this test drives the sha-not-found branch, which now
  // bounded-polls by default — pin the budget explicitly rather than let this
  // process's own (unset) env silently give the child a 600s budget.
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.6"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `a stale green run from a different commit must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    new RegExp(`WARN: CI ground-truth — this commit's CI has not completed yet \\(head ${releaseSha.slice(0, 12)} not found among the last 1 completed run\\(s\\) on main\\); continuing without CI verification \\(graceful degradation, E14\\)`),
    "a green run at an unrelated commit must degrade via WARN, naming THIS commit's head, not be accepted as ground truth",
  );
  assert.match(result.stdout, /OK: CI ground-truth/, "the check itself still reports OK — WARN is a degradation, not a failure");
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
});

// ---------------------------------------------------------------------------
// VR-18 (E78, T-E78-02 behavior — non-blocking on an unrelated red): a
// completed RED run at a DIFFERENT commit must not block the release either
// — it is just as much "the wrong answer" as a stale green, not a fatal
// mismatch. Only a red run AT the release commit (VR-11) is a FAIL.
// ---------------------------------------------------------------------------
test("VR-18 (E78): shimmed gh reports a red completed run at a DIFFERENT commit -> WARN, does not block, exit 0, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.0.7", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const otherSha = "4444444444444444444444444444444444444444";
  assert.notEqual(otherSha, releaseSha, "sanity: the shimmed run's headSha must differ from the release commit");
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "failure",
          headSha: otherSha,
          url: "https://example.com/actions/runs/4",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  // wait=0 (T-E80-02): same reasoning as VR-17 above — this drives the
  // sha-not-found branch, so pin the budget rather than inherit it.
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.7"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `a red run belonging to an unrelated commit must never fail THIS release; stderr: ${result.stderr}`);
  assert.match(result.stdout, /WARN: CI ground-truth — this commit's CI has not completed yet/, "an unrelated commit's red run degrades exactly like any other cannot-obtain-ground-truth path");
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// VR-19 (E78, window coverage): the release commit's run is not runs[0] — it
// is buried at position 8 of a 10-run `--limit 10` window, behind several
// unrelated completed runs. Proves the window is genuinely searched with
// `.find`, not just `runs[0]` (which pre-E78 code effectively assumed).
// ---------------------------------------------------------------------------
test("VR-19 (E78): a matching red run found deep in the 10-run window (position 8 of 10) still FAILs", () => {
  const { root } = mkFixtureRepo({ version: "10.0.8", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const decoys = Array.from({ length: 7 }, (_, i) => ({
    conclusion: "success",
    headSha: `${i}`.repeat(40),
    url: `https://example.com/actions/runs/decoy-${i}`,
    updatedAt: "2026-01-01T00:00:00Z",
  }));
  const runs = [
    ...decoys,
    {
      conclusion: "failure",
      headSha: releaseSha,
      url: "https://example.com/actions/runs/deep",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    { conclusion: "success", headSha: "8".repeat(40), url: "https://example.com/actions/runs/decoy-8", updatedAt: "2026-01-01T00:00:00Z" },
    { conclusion: "success", headSha: "9".repeat(40), url: "https://example.com/actions/runs/decoy-9", updatedAt: "2026-01-01T00:00:00Z" },
  ];
  assert.equal(runs.length, 10, "sanity: exactly 10 runs, matching --limit 10");
  assert.equal(runs.indexOf(runs.find((r) => r.headSha === releaseSha)), 7, "sanity: the matching run sits at index 7 (position 8 of 10), not runs[0]");
  const shimDir = mkGhShim(ghJsonShim(JSON.stringify(runs)));
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.8"]);
  assert.notEqual(result.status, 0, "a matching red run buried in the window must still FAIL, proving runs[0] alone is not what's checked");
  assert.match(result.stderr, /FAIL: latest completed CI run on main concluded "failure"/);
  assert.match(result.stderr, /check:release — FAILED \(1 check\(s\) failed\)/);
});

// ---------------------------------------------------------------------------
// VR-20 (E80, T-E80-02(a)): the sha-not-found branch now bounded-polls
// instead of giving up on the first miss — a completed run for THIS commit
// that shows up mid-poll (not on the first `gh` call) must resolve to a
// genuine OK, never a WARN, exactly as if it had matched on the first call.
// Proves the poll loop actually re-queries `gh` rather than caching its
// first (miss) answer.
// ---------------------------------------------------------------------------
test("VR-20 (E80): sha absent on the first gh call, present+success on a later call -> OK, no WARN, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.9", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const notFoundJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: "5".repeat(40),
      url: "https://example.com/actions/runs/decoy-first-call",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]);
  const foundJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: releaseSha,
      url: "https://example.com/actions/runs/found-second-call",
      updatedAt: "2026-01-01T00:00:05Z",
    },
  ]);
  const shimDir = mkGhSequenceShim([notFoundJson, foundJson]);
  const start = Date.now();
  // budget=5s: POLL_INTERVAL_SECONDS is 20s, so a 5s budget forces exactly
  // one sleep of min(20s, remaining) = 5s between the miss and the match,
  // keeping this test fast while still genuinely exercising the poll-then-
  // resolve path (not just wait=0's single-call shortcut, covered by VR-22).
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.9"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "5",
  });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.ok(
    !result.stdout.includes("WARN: CI ground-truth"),
    "a sha that resolves before the budget expires must report a genuine OK, never a WARN",
  );
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v10\.0\.9\)/);
  assert.equal(result.stderr, "", "a run that resolves mid-poll must not print to stderr");
  assert.ok(elapsedMs < 15000, `poll-then-resolve must complete well within the 5s budget + overhead; took ${elapsedMs}ms`);
});

// ---------------------------------------------------------------------------
// VR-21 (E80, T-E80-02(b)): the poll's own budget can expire with the sha
// STILL absent — E78's contract must stay intact on this path: the SAME
// WARN text as the pre-E80 immediate-miss branch (VR-17/VR-18), the check
// still green, exit 0. No new FAIL mode is introduced by adding the poll.
// ---------------------------------------------------------------------------
test("VR-21 (E80): poll budget expires with the sha still absent -> byte-identical pre-E80 WARN text, check green, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.10", tag: "at-head", origin: "pushed" });
  const releaseSha = git(["rev-parse", "HEAD"], root);
  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: "6".repeat(40),
          url: "https://example.com/actions/runs/decoy-never-matches",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  const start = Date.now();
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.10"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "2",
  });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0, `budget expiry must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    new RegExp(`WARN: CI ground-truth — this commit's CI has not completed yet \\(head ${releaseSha.slice(0, 12)} not found among the last 1 completed run\\(s\\) on main\\); continuing without CI verification \\(graceful degradation, E14\\)`),
    "budget expiry must emit the SAME WARN text as the pre-E80 immediate-miss branch — E78's contract preserved, not inverted, and no new FAIL mode",
  );
  assert.match(result.stdout, /OK: CI ground-truth/, "the check itself still reports OK — budget expiry is a degradation, not a failure");
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
  assert.ok(elapsedMs >= 2000, "the poll must actually have waited out the 2s budget, not returned on the first miss");
  assert.ok(elapsedMs < 15000, `budget expiry must not run long past the configured 2s budget; took ${elapsedMs}ms`);
});

// ---------------------------------------------------------------------------
// VR-22 (E80, T-E80-02(c)): AGC_VERIFY_CI_WAIT_SECONDS=0 is the documented
// opt-out — it must perform EXACTLY one `gh` call (not "return fast", which
// a slow single call could also satisfy) and incur no wall-clock wait at
// all, preserving the pre-E80 single-call behavior byte-for-byte.
// ---------------------------------------------------------------------------
test("VR-22 (E80): AGC_VERIFY_CI_WAIT_SECONDS=0 performs exactly one gh call and no wall-clock wait", () => {
  const { root } = mkFixtureRepo({ version: "10.0.11", tag: "at-head", origin: "pushed" });
  const notFoundJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: "7".repeat(40),
      url: "https://example.com/actions/runs/decoy-wait-zero",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]);
  const { dir: shimDir, counterPath } = mkGhCallCounterShim(notFoundJson);
  const start = Date.now();
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.11"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  const elapsedMs = Date.now() - start;
  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /WARN: CI ground-truth — this commit's CI has not completed yet/);
  assert.equal(
    fs.readFileSync(counterPath, "utf-8").trim(),
    "1",
    "wait=0 must call gh exactly once, never enter the poll loop",
  );
  assert.ok(elapsedMs < 5000, `wait=0 must not incur any wall-clock poll sleep; took ${elapsedMs}ms`);
});

// ---------------------------------------------------------------------------
// VR-13 (E14): Check 6 degradation — gh binary missing (ENOENT) -> WARN on
// stdout, check still reports OK, release still exits 0. The ONLY failure
// mode is a definitively red completed run (VR-11); every "cannot obtain
// ground truth" path must degrade gracefully, never block a release on
// missing/unconfigured tooling.
//
// CI-flake fix (post-v3.83.0, VR-13 CI Fix): this test previously ran with a
// hardcoded `PATH="/usr/bin:/bin"`, reasoning "git lives there but gh
// doesn't" — true on a macOS/Homebrew checkout, false on GitHub's
// ubuntu-latest hosted runner, which installs the `gh` CLI via apt at
// /usr/bin/gh. There, this PATH resolved the REAL gh, which (unauthenticated,
// no GH_TOKEN) exited non-zero with an auth error — the WARN text for that
// path is pinned by VR-14, not this test's ENOENT wording — turning this test
// red on every CI run since v3.83.0. `noGhSystemPath()` builds the "no gh
// anywhere" PATH from whatever `git` THIS test process's own PATH resolves
// to, so the guarantee holds on any host, not just ones shaped like this
// author's machine.
// ---------------------------------------------------------------------------
test("VR-13 (E14 degradation): gh binary not on PATH -> WARN on stdout naming gh unavailability, check still OK, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.2", tag: "at-head", origin: "pushed" });
  const result = runVerifyWithPath(root, noGhSystemPath(), ["v10.0.2"]);
  assert.equal(result.status, 0, `a missing gh binary must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — gh CLI unavailable \(ENOENT\); continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
});

// ---------------------------------------------------------------------------
// VR-14 (E14 degradation): Check 6 — gh exits non-zero (auth/network/API
// error) -> WARN on stdout carrying gh's own error detail, never a FAIL.
// ---------------------------------------------------------------------------
test("VR-14 (E14 degradation): gh exits non-zero (API/auth error) -> WARN on stdout with gh's error surfaced, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.3", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim(
    "#!/bin/sh\necho 'gh: authentication required, run `gh auth login`' 1>&2\nexit 1\n",
  );
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.3"]);
  assert.equal(result.status, 0, `a gh API/auth error must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — gh run list failed: gh: authentication required, run `gh auth login`; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// VR-15 (E14 degradation): Check 6 — zero completed CI runs found (e.g. a
// brand-new repo, or CI renamed/disabled) -> WARN on stdout, never a FAIL.
// ---------------------------------------------------------------------------
test("VR-15 (E14 degradation): zero completed CI runs on main -> WARN on stdout, never a FAIL, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.4", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim(ghJsonShim("[]"));
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.4"]);
  assert.equal(result.status, 0, `zero completed CI runs must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — no completed CI runs found on origin\/main; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// VR-16 (E14 degradation, bonus coverage): unparseable gh stdout (malformed
// JSON) -> WARN on stdout, never a FAIL. Beyond the task's named three
// degradation paths (gh missing / API error / zero runs), but exercises the
// JSON.parse try/catch branch the code-reviewer called out by name in
// review_T-EB-03.md as verified-but-not-yet-test-pinned.
// ---------------------------------------------------------------------------
test("VR-16 (E14 degradation, bonus): unparseable gh output -> WARN on stdout, never a FAIL, exit 0", () => {
  const { root } = mkFixtureRepo({ version: "10.0.5", tag: "at-head", origin: "pushed" });
  const shimDir = mkGhShim("#!/bin/sh\necho 'not json at all'\n");
  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.0.5"]);
  assert.equal(result.status, 0, `unparseable gh output must never fail the release; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — could not parse gh run list output; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.match(result.stdout, /OK: CI ground-truth/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// VR-9 (AC9): content/skill-release-engineer.md SOP step + Escalation Routes row
// ---------------------------------------------------------------------------
test("VR-9 (AC9): skill-release-engineer.md requires verify-release.mjs after push/gh-release and before the closing write, plus a matching Escalation Routes row", () => {
  assert.match(
    SKILL,
    /9a\.\s*\*\*Release self-check\*\*[\s\S]*?node scripts\/verify-release\.mjs/,
    "SOP step 9a must instruct running node scripts/verify-release.mjs",
  );
  // Step 9a must sit after step 9 (push/gh-release) and before step 12 (closing write).
  const idxStep9 = SKILL.indexOf("**GitHub release**");
  const idxStep9a = SKILL.indexOf("9a. **Release self-check**");
  const idxStep12 = SKILL.indexOf("**Closing write**");
  assert.ok(idxStep9 > -1 && idxStep9a > -1 && idxStep12 > -1, "all three anchor steps must be present");
  assert.ok(idxStep9 < idxStep9a, "step 9a must come after step 9 (push + gh release)");
  assert.ok(idxStep9a < idxStep12, "step 9a must come before the closing write (step 12)");

  assert.match(
    SKILL,
    /\| release self-check reports any FAIL \(`node scripts\/verify-release\.mjs` exits non-zero, SOP step 9a\) \| Blocked \|/,
    "Escalation Routes must have a matching row with status=Blocked",
  );
  assert.ok(
    SKILL.includes(
      "`release-engineer: release self-check failed — <failed check name(s)> — see script output`",
    ),
    "Escalation Routes row must carry the verbatim pending-note text from the spec's Copy/Strings vr.escalation-note entry",
  );
  assert.match(
    SKILL,
    /release self-check reports any FAIL \(`node scripts\/verify-release\.mjs` exits non-zero, SOP step 9a\) \| Blocked \| `release-engineer: release self-check failed — <failed check name\(s\)> — see script output` \| human \|/,
    "Escalation Routes row must route to next_role=human",
  );
  assert.match(
    SKILL,
    /do NOT proceed to the closing write and do NOT emit `Done\. Released <tag>\.` on a FAIL/,
    "SOP step 9a must explicitly forbid the closing write and the done-report on FAIL",
  );

  // E80 retarget (T-E80-02): step 9a used to describe ONE catch-all WARN
  // sentence for "gh missing/unauthenticated or zero completed runs". It now
  // must distinguish "the script itself is bounded-polling — let it run"
  // from "WARN-and-continue is reserved for a genuinely degraded
  // environment" — the wait-vs-degraded split this cut introduced.
  //
  // E82(ii) retarget (T-W15-02, stale pin): this used to assert a hardcoded
  // "~10 minutes" figure. That figure went stale the moment
  // DEFAULT_WAIT_SECONDS changed to 480s (E82), which is the exact defect
  // E82(ii) exists to fix — step 9a now cites the constant by NAME instead
  // of restating a number. See VR-9b below for the behavioral pin that
  // keeps this from going stale the same way a second time.
  assert.match(
    SKILL,
    /the script itself bounded-polls `gh run list` for it \(E80\/E82; default is `DEFAULT_WAIT_SECONDS` in `scripts\/verify-release\.mjs`, overridable via `AGC_VERIFY_CI_WAIT_SECONDS`, `0` to opt out\) before giving up/,
    "step 9a must describe the E80 bounded poll and cite DEFAULT_WAIT_SECONDS in scripts/verify-release.mjs by name, not a restated duration figure (E82(ii))",
  );
  assert.match(
    SKILL,
    /just let this step run to completion, do not treat a poll-in-progress as a WARN to manually re-run around/,
    "step 9a must instruct the operator not to treat an in-progress poll as a WARN needing manual intervention",
  );
  assert.match(
    SKILL,
    /WARN-and-continue \(the check stays green either way, never a release blocker\) is what you get in two cases: the poll's own budget runs out with this sha still not found, or the environment is genuinely degraded/,
    "step 9a must scope WARN-and-continue to exactly two cases — poll-budget expiry or a genuinely degraded environment — not a single undifferentiated catch-all",
  );
});

// ---------------------------------------------------------------------------
// VR-9b (E82(ii) BEHAVIORAL PIN, T-W15-02 QA SCOPE 4/5): a pin that merely
// matches the current prose string recreates the exact staleness E82 exists
// to prevent — the prior VR-9 wording hardcoded "~10 minutes" and silently
// went stale when DEFAULT_WAIT_SECONDS changed to 480s. This test instead
// pins the PROPERTY: step 9a's CI-poll-budget sentence must carry no
// hardcoded duration literal, and the constant it cites by name must
// actually exist in scripts/verify-release.mjs — so a future rename or
// removal of DEFAULT_WAIT_SECONDS (without updating this prose) fails this
// assertion directly, instead of drifting a second time unnoticed.
// ---------------------------------------------------------------------------
test("VR-9b (E82(ii) behavioral pin): step 9a's CI-poll-budget sentence carries no hardcoded duration literal and sources it from DEFAULT_WAIT_SECONDS", () => {
  const idxStep9a = SKILL.indexOf("9a. **Release self-check**");
  const idxRationaleStart = SKILL.indexOf("<!-- rationale:start -->", idxStep9a);
  const idxStep10 = SKILL.indexOf("10. *(retired", idxStep9a);
  assert.ok(idxStep9a > -1, "step 9a must be present");
  assert.ok(idxRationaleStart > idxStep9a, "step 9a's rationale fence must be present");
  assert.ok(idxStep10 > idxRationaleStart, "step 10's retirement pointer must follow step 9a's rationale fence");
  // (a) is scoped to the OPERATIONAL sentence only — up to the rationale
  // fence — because that fence is stripped by prompts/build.ts's
  // stripRationale on every dispatch (fullDetail=false) and never reaches
  // the executing release-engineer. The fence is explicitly ALLOWED to
  // mention the historical "~10 minutes" figure and "480s" as a maintenance
  // note explaining WHY citation replaced a literal — that is a note to a
  // future editor, not an operating instruction, and re-litigating it here
  // would just be N10's fence-visibility question again, not E82(ii)'s.
  const step9aOperational = SKILL.slice(idxStep9a, idxRationaleStart);

  // (a) No hardcoded duration literal for the CI poll budget in the
  // OPERATIONAL text a release-engineer actually executes. This is the
  // precise staleness class E82 was filed against.
  assert.doesNotMatch(
    step9aOperational,
    /~?\d+\s*(seconds?|secs?|minutes?|mins?)\b/i,
    "step 9a's operational text must not carry a hardcoded duration literal for the CI poll budget — cite DEFAULT_WAIT_SECONDS by name instead (E82(ii))",
  );

  // (b) Names the constant, by identifier, as the source of the default.
  assert.match(
    step9aOperational,
    /`DEFAULT_WAIT_SECONDS`\s+in\s+`scripts\/verify-release\.mjs`/,
    "step 9a must cite DEFAULT_WAIT_SECONDS in scripts/verify-release.mjs by name as the source of the poll budget",
  );

  // (c) The citation is not just self-consistent prose: the named constant
  // must actually be defined, as a real numeric constant, in the script it
  // points at. Deliberately NOT pinning the literal 480 here — that would
  // reintroduce the exact staleness-on-value-change hazard E82 exists to
  // avoid, on the test side instead of the prose side. VR-23 elsewhere pins
  // the live 480s behavior; this pin only guards that the identifier step
  // 9a cites still resolves to something.
  assert.match(
    REAL_VERIFY_SCRIPT,
    /const\s+DEFAULT_WAIT_SECONDS\s*=\s*\d+\s*;/,
    "scripts/verify-release.mjs must still define DEFAULT_WAIT_SECONDS as a numeric constant — if this fails, step 9a's citation now points at nothing",
  );
});

// ---------------------------------------------------------------------------
// VR-9c (N11 pin, T-W15-02 QA SCOPE 5/5, non-blocking per code-reviewer round
// 3): step 13a's non-empty-stage assertion tests that SOMETHING staged, not
// that EVERYTHING did. Pin exactly what it guarantees — no more — so the
// bounded property is not silently overclaimed later as "closes all
// partial-staging failure". Known gap, recorded rather than fixed here: if
// `find` under-reports (e.g. `.current/` reached via a symlink, which BSD
// `find` will not descend into without `-L`), `handoff.md` still stages, the
// cached diff is non-empty, this assertion passes, and the `.jsonl` sidecars
// are silently omitted from the bookkeeping commit. Swept up by the next
// release's own 13a run; not this ticket's to close.
//
// Re-baselined (T-E142-05, E143/AC7): `tasks.md` is no longer one of the
// paths 13a's own `git add` names — step 8's release commit owns staging and
// committing `tasks.md` now (see content/skill-release-engineer.md's
// Artifact-ownership list), never 13a. This assertion is updated to match
// that ratified decision, not weakened: the guaranteed property below
// (non-empty-stage catches only a TOTAL staging failure) is unaffected by
// which paths are named in the `git add` line.
// ---------------------------------------------------------------------------
test("VR-9c (N11): step 13a's non-empty-stage assertion is scoped to catching a fully-empty stage, not partial under-staging", () => {
  const idxStep13a = SKILL.indexOf("13a. **Bookkeeping commit + push**");
  const idxStep13b = SKILL.indexOf("13b. **Bookkeeping close-out check**");
  assert.ok(idxStep13a > -1 && idxStep13b > -1, "steps 13a and 13b must both be present");
  assert.ok(idxStep13a < idxStep13b, "step 13a must precede step 13b");
  const step13aBlock = SKILL.slice(idxStep13a, idxStep13b);

  // The enumerate-then-stage pattern (N9 fix) — never a raw shell glob.
  // E174a: the enumeration + stage targets the derived lane dir, not a flat
  // .current/ glob.
  assert.match(
    step13aBlock,
    /JSONL=\$\(find "\.current\/\$LANE" -maxdepth 1 -name "\*\.jsonl"\)/,
    "13a must enumerate .jsonl sidecars via find under the derived lane dir, never a raw shell glob (E174a)",
  );
  assert.match(
    step13aBlock,
    /git add -- "\.current\/\$LANE\/handoff\.md" \$JSONL/,
    "13a must stage the lane-scoped handoff.md explicitly alongside the enumerated jsonl files (E143: tasks.md is staged by step 8, never by 13a; E174a: lane-scoped path)",
  );
  assert.doesNotMatch(
    step13aBlock,
    /git add -- "\.current\/\$LANE\/handoff\.md" tasks\.md/,
    "E143: 13a's git add must NOT name tasks.md — step 8 owns staging it",
  );
  // E174a: the lane is derived via the compiled resolver, never hardcoded to
  // _primary and never re-parsed from the branch name in shell.
  assert.match(
    step13aBlock,
    /LANE=\$\(node --input-type=module -e "import \{resolveCurrentLane\} from \\"\.\/dist\/tools\/lane-paths\.js\\"; console\.log\(resolveCurrentLane\(process\.cwd\(\)\)\)"\)/,
    "13a must derive $LANE by importing the compiled resolveCurrentLane, never hardcode _primary (E174a cut decision i)",
  );
  assert.match(
    step13aBlock,
    /lane dir \.current\/\$LANE missing — STOP/,
    "13a must STOP if the derived lane's .current/$LANE directory does not exist (E174a)",
  );

  // The guaranteed property: the stage is checked for non-emptiness — this
  // catches a TOTAL staging failure (nothing staged at all). It does NOT
  // verify that every one of the named paths individually landed (N11) —
  // that stronger guarantee is not what this assertion buys, and this test
  // must not be strengthened to claim it does without also changing the SOP
  // text to actually check per-path membership.
  assert.match(
    step13aBlock,
    /if \[ -z "\$\(git diff --cached --name-only\)" \]; then/,
    "13a must assert the cached diff is non-empty before allowing the commit — the total-staging-failure guard",
  );
  assert.match(
    step13aBlock,
    /nothing staged for bookkeeping commit — STOP/,
    "the non-empty-stage assertion's STOP message must be present",
  );

  // Do not proceed to commit on failure — this is the half that actually
  // closes the vacuous-13b-PASS class (code-reviewer round 3, Q2).
  assert.match(
    step13aBlock,
    /If that script exits non-zero, STOP here — do not proceed to `git commit`/,
    "13a must forbid proceeding to git commit when the staging script exits non-zero",
  );
});

// ---------------------------------------------------------------------------
// VR-10 (AC10): post-closing-write tw_get_state read-back
// ---------------------------------------------------------------------------
test("VR-10 (AC10): skill-release-engineer.md requires a tw_get_state read-back immediately after the closing write, before the final reply", () => {
  const idxStep12 = SKILL.indexOf("**Closing write**");
  const idxStep13 = SKILL.indexOf("**Closing-write read-back**");
  assert.ok(idxStep12 > -1 && idxStep13 > -1, "both the closing write and read-back steps must be present");
  assert.ok(idxStep12 < idxStep13, "the read-back step must come after the closing write step");

  assert.match(
    SKILL,
    /13\.\s*\*\*Closing-write read-back\*\*[\s\S]*?call `tw_get_state` again/,
    "step 13 must instruct calling tw_get_state again after the closing write",
  );
  for (const field of ["last_agent", "status", "next_role", "pending_notes"]) {
    assert.ok(
      SKILL.includes(field),
      `step 13 must name the '${field}' field to confirm against the closing write`,
    );
  }
  assert.match(
    SKILL,
    /do NOT claim "Released"; STOP and surface the mismatch verbatim instead/,
    "a read-back mismatch must STOP the agent rather than let it claim success",
  );
});

// ---------------------------------------------------------------------------
// Security smoke tests — boundary inputs (skill-qa-engineer Phase 3d)
// ---------------------------------------------------------------------------
test("VR-SEC-1: no version argument -> defaults to package.json's version, still runs all checks", () => {
  const { root } = mkFixtureRepo({ version: "9.0.0", tag: "at-head" });
  const result = runVerify(root, []); // no arg at all ("null" boundary — omitted CLI input)
  assert.equal(result.status, 0, `expected default-version resolution to succeed; stderr: ${result.stderr}`);
  assert.match(result.stdout, /target version v9\.0\.0/);
});

test("VR-SEC-2: empty-string version argument -> falsy CLI arg falls back to package.json's version (same branch as omitted), not a crash or an injection surface", () => {
  // `""` is falsy in JS, so `rawArg ? ... : packageJsonVersion` takes the
  // same fallback branch as no argument at all (VR-SEC-1) — documented here
  // as observed behavior, not a bug: an empty string never reaches the
  // regex-validation branch, and it never reaches git/fs unvalidated.
  const { root } = mkFixtureRepo({ version: "9.0.1", tag: "at-head" });
  const result = runVerify(root, [""]);
  assert.equal(result.status, 0, `expected fallback-to-default to succeed; stderr: ${result.stderr}`);
  assert.match(result.stdout, /target version v9\.0\.1/);
});

test("VR-SEC-3: version argument with shell metacharacters -> rejected by regex validation, never reaches a shell (execFileSync/spawnSync array-argv, no injection)", () => {
  const { root } = mkFixtureRepo({ version: "9.0.2", tag: "at-head" });
  const marker = path.join(root, "INJECTED");
  const result = runVerify(root, [`1.0.0; touch ${marker}`]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid target version/);
  assert.ok(!fs.existsSync(marker), "a shell-metacharacter payload must never execute as a shell command");
});

test("VR-SEC-4: oversized version argument -> rejected by regex validation, exits cleanly without crashing", () => {
  const { root } = mkFixtureRepo({ version: "9.0.3", tag: "at-head" });
  const oversized = "9".repeat(100_000);
  const result = runVerify(root, [oversized]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid target version/);
});

// ---------------------------------------------------------------------------
// T-E8284-02 (E82/E84): the 480s default poll budget and the --close-out
// mode, per specs/e82-e84-release-verify-tooling.md AC1/AC3/AC4.
// ---------------------------------------------------------------------------

// VR-23 (AC1, E82): the Check 6 poll budget must default to 480s when
// AGC_VERIFY_CI_WAIT_SECONDS is unset — pinned BEHAVIORALLY by reading the
// script's own first poll-progress line ("...left in budget"), never by
// grepping the source for the literal 480. A grep pin (the spec's own AC1
// `proof:` line, already executed in the AC Execution Log) passes against a
// file that says 480 in a comment and a DIFFERENT number in the constant —
// exactly the E82 defect shape this test exists to catch instead.
//
// The script's own deadline runs up to 480 real seconds if left alone, so
// this drives the child asynchronously (spawn, not spawnSync) and kills it
// the instant the first poll line lands — the test window is a few hundred
// milliseconds, not eight minutes.
test("VR-23 (AC1, E82): AGC_VERIFY_CI_WAIT_SECONDS unset -> first poll line reports ~480s left in budget, never ~600s", async () => {
  const { root } = mkFixtureRepo({ version: "10.0.12", tag: "at-head", origin: "pushed" });
  const decoyJson = JSON.stringify([
    {
      conclusion: "success",
      headSha: "9".repeat(40),
      url: "https://example.com/actions/runs/decoy-default-budget",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ]);
  const shimDir = mkGhShim(ghJsonShim(decoyJson));
  const env = { ...process.env, PATH: `${shimDir}:${noGhSystemPath()}` };
  delete env.AGC_VERIFY_CI_WAIT_SECONDS; // must be genuinely unset, not inherited from this test's own shell

  const child = spawn(
    process.execPath,
    [path.join(root, "scripts", "verify-release.mjs"), "v10.0.12"],
    { cwd: root, env },
  );

  let stdout = "";
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  let remainingSeconds;
  try {
    remainingSeconds = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `timed out waiting for the first poll-progress line; stdout so far: ${stdout}; stderr: ${stderr}`,
          ),
        );
      }, 15_000);
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        const m = stdout.match(/polling again in \d+s \(~(\d+)s left in budget\)/);
        if (m) {
          clearTimeout(timer);
          resolve(Number(m[1]));
        }
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  } finally {
    child.kill("SIGKILL");
  }

  assert.ok(
    remainingSeconds >= 470 && remainingSeconds <= 480,
    `expected the default poll budget to be ~480s (the E82 fix), never ~600s (the pre-fix default); observed ~${remainingSeconds}s left after the first gh call`,
  );
});

// ---------------------------------------------------------------------------
// VR-24 (AC3, E84): --close-out FAILs when HEAD is ahead of its @{u}
// upstream, names the ahead count, and never runs Check 1 (tag-at-HEAD).
//
// This is the load-bearing pin for the whole ticket: scripts/verify-release.mjs
// computes the ahead count via the range `@{u}..HEAD`. The fixture below
// (`origin: "not-pushed"`) pushes a commit then adds ONE local-only commit
// on top, so HEAD is a strict descendant of its upstream — @{u} is an
// ANCESTOR of HEAD. A reversed `HEAD..@{u}` range (commits reachable from
// @{u} but not from HEAD) is therefore EMPTY on this exact fixture, since
// every commit @{u} can reach is also reachable from HEAD — the
// reversed-range bug would silently report 0 and exit 0. Only the correct
// direction fails here, so this assertion actually discriminates: it would
// go red the instant someone flipped the range, not merely "pass either way".
// ---------------------------------------------------------------------------
test("VR-24 (AC3, E84): --close-out FAILs when HEAD is ahead of upstream, names the ahead count, never runs tag-at-HEAD", () => {
  const { root } = mkFixtureRepo({ version: "10.0.13", tag: "at-head", origin: "not-pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "@{u}"], root);
  assert.notEqual(headSha, upstreamSha, "sanity: HEAD must have moved past the pushed upstream");
  const aheadCount = Number(git(["rev-list", "--count", "@{u}..HEAD"], root));
  assert.equal(aheadCount, 1, "sanity: fixture must carry exactly one unpushed local commit");

  const result = runVerify(root, ["--close-out"]);

  assert.notEqual(
    result.status,
    0,
    `expected --close-out to FAIL when HEAD is ahead of upstream; stdout: ${result.stdout}`,
  );
  assert.match(
    result.stderr,
    /FAIL: HEAD is 1 commit\(s\) ahead of upstream origin\/main — not pushed/,
    "failure line must name the ahead commit count",
  );
  assert.match(
    result.stderr,
    /check:release — FAILED \(1 check\(s\) failed\)/,
    "close-out's own failure summary must report exactly one failed check",
  );
  assert.equal(
    result.stdout,
    "",
    "the ahead-of-upstream check is single-shot (no progress lines) and must not run any other check quietly",
  );
  assert.ok(
    !result.stdout.includes("OK: tag-at-HEAD"),
    "--close-out must never run Check 1 (tag-at-HEAD), pass or fail",
  );
  assert.ok(
    !result.stdout.includes("target version"),
    "--close-out must never resolve a version, even on the FAIL path",
  );
  assert.ok(
    !result.stderr.includes("CLOSE-OUT PASSED") && !result.stdout.includes("ALL CHECKS PASSED"),
    "a FAILing close-out run must not print either PASSED summary line",
  );
});

// ---------------------------------------------------------------------------
// VR-25 (AC4, E84): --close-out exits 0 with a distinct CLOSE-OUT PASSED
// line when HEAD == upstream, and demonstrably never runs Checks 1/3/4/5/6
// — asserted on the ABSENCE of their `OK:`/check-name output, not merely on
// exit 0 (an exit-0-only pin would equally pass a build that silently
// skipped every check for the wrong reason).
// ---------------------------------------------------------------------------
test("VR-25 (AC4, E84): --close-out exits 0, prints CLOSE-OUT PASSED, and skips Checks 1/3/4/5/6 (absence asserted, not just exit 0)", () => {
  const { root } = mkFixtureRepo({ version: "10.0.14", tag: "at-head", origin: "pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "@{u}"], root);
  assert.equal(headSha, upstreamSha, "sanity: HEAD must equal its pushed upstream");

  const result = runVerify(root, ["--close-out"]);

  assert.equal(result.status, 0, `expected exit 0; stderr: ${result.stderr}`);
  assert.match(result.stdout, /check:release — CLOSE-OUT PASSED/);
  assert.equal(result.stderr, "", "a passing close-out run must not print to stderr");
  assert.ok(
    !result.stdout.includes("ALL CHECKS PASSED"),
    "must print the distinct close-out summary line, not the normal-mode one",
  );

  for (const [checkLabel, okLine] of [
    ["Check 1 (tag-at-HEAD)", "OK: tag-at-HEAD"],
    ["Check 3 (check-version)", "OK: check-version"],
    ["Check 4 (CHANGELOG entry)", "OK: CHANGELOG entry"],
    ["Check 5 (dist committed+parity)", "OK: dist committed+parity"],
    ["Check 6 (CI ground-truth)", "OK: CI ground-truth"],
  ]) {
    assert.ok(!result.stdout.includes(okLine), `${checkLabel} must not run in --close-out mode`);
  }
  assert.ok(
    !result.stdout.includes("target version"),
    "--close-out must not resolve or require a version argument",
  );
  assert.ok(
    result.stdout.includes("OK: ahead-of-upstream"),
    "close-out's own single check must still report OK when HEAD == upstream",
  );
});

// ---------------------------------------------------------------------------
// VR-26 (AC4, E84): strengthens VR-25 — --close-out must not even ATTEMPT to
// resolve a version. A deliberately-corrupt package.json (invalid JSON)
// would throw if the version-resolution code path executed at all; since
// that code sits OUTSIDE the runCheck wrapper, an uncaught throw there would
// crash the process (a stack trace + non-zero exit), never CLOSE-OUT PASSED.
// ---------------------------------------------------------------------------
test("VR-26 (AC4, E84): --close-out still passes against a fixture whose package.json is invalid JSON — version is never read", () => {
  const { root } = mkFixtureRepo({ version: "10.0.15", tag: "at-head", origin: "pushed" });
  fs.writeFileSync(path.join(root, "package.json"), "{ this is not valid JSON");

  const result = runVerify(root, ["--close-out"]);

  assert.equal(
    result.status,
    0,
    `a corrupt package.json must not matter in --close-out mode; stderr: ${result.stderr}`,
  );
  assert.match(result.stdout, /check:release — CLOSE-OUT PASSED/);
  assert.equal(result.stderr, "");
});

// ---------------------------------------------------------------------------
// E141 additions (T-E141-02) — Check 1's bookkeeping-commit tolerance.
// specs/e141-tag-at-head-bookkeeping-tolerance.md AC1-AC6. VR-2 above was
// amended (not retargeted) to keep pinning the non-bookkeeping FAIL path;
// the tests below pin the new tolerance itself plus its two guard rails
// (AC4 ancestry precondition, AC5 Check 2 independence) and two of the
// T-E141-01 code-reviewer's non-blocking observations worth a cheap pin.
// ---------------------------------------------------------------------------

// VR-27 (AC2, E141): the human's stated bar, half 1 — a single post-tag
// commit touching ONLY the SOP step 13a bookkeeping paths (the v3.111.0
// shape: .current/handoff.md + .current/metrics.jsonl + tasks.md in one
// commit) must be TOLERATED — Check 1 OK, with an explicit NOTE naming the
// tolerated commit count so the audit trail shows a tolerance fired rather
// than a silent pass.
test("VR-27 (AC2, E141): one post-tag commit touching only .current/handoff.md + .current/*.jsonl + tasks.md -> Check 1 OK with tolerance NOTE, exit 0 (v3.111.0 shape)", () => {
  const { root } = mkFixtureRepo({ version: "3.111.0", tag: "behind-head-bookkeeping" });
  const tagSha = git(["rev-list", "-n", "1", "v3.111.0"], root);
  const headSha = git(["rev-parse", "HEAD"], root);
  assert.notEqual(tagSha, headSha, "sanity: the bookkeeping commit must move HEAD past the tag");
  // Push the bookkeeping commit too, so this test isolates Check 1's
  // tolerance in a fully-clean run (Check 2's own unpushed scenario is
  // pinned separately by VR-30) — mkFixtureRepo pushes origin BEFORE the
  // tag block runs, so any post-tag commit is unpushed by construction
  // unless re-pushed here.
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v3.111.0"]);
  assert.equal(result.status, 0, `bookkeeping-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v3\.111\.0/,
    "a tolerated pass must say so explicitly and name the tolerated count",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});

// VR-28 (AC1, E141): tag == HEAD stays byte-identical to the pre-E141
// behaviour — the equality path returns before any new code runs, so no
// tolerance note is ever printed even though the tolerance machinery now
// exists in the same check.
test("VR-28 (AC1, E141): tag == HEAD -> plain 'OK: tag-at-HEAD', no tolerance note, byte-identical to pre-E141 behaviour", () => {
  const { root } = mkFixtureRepo({ version: "4.0.0", tag: "at-head" });

  const result = runVerify(root, ["v4.0.0"]);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /^OK: tag-at-HEAD$/m);
  assert.doesNotMatch(
    result.stdout,
    /NOTE: tag-at-HEAD/,
    "the equality path is not the tolerance path — it must never emit the NOTE",
  );
});

// VR-29 (AC4, E141): ancestry is a precondition of the tolerance, never a
// substitute for it. A tag on a divergent branch (not an ancestor of HEAD)
// keeps the ORIGINAL "does not point at HEAD" FAIL, with no range
// enumeration appended — the tolerance code path is never reached because
// the ancestry check short-circuits first.
test("VR-29 (AC4, E141): tag is NOT an ancestor of HEAD (diverged branch) -> original FAIL preserved, no range enumeration, no tolerance note", () => {
  const { root } = mkFixtureRepo({ version: "5.0.0", tag: "diverged" });
  const tagSha = git(["rev-list", "-n", "1", "v5.0.0"], root);
  const headSha = git(["rev-parse", "HEAD"], root);

  const isAncestor = spawnSync("git", ["merge-base", "--is-ancestor", tagSha, headSha], {
    cwd: root,
  });
  assert.notEqual(isAncestor.status, 0, "sanity: the fixture's tag must NOT be an ancestor of HEAD");

  const result = runVerify(root, ["v5.0.0"]);
  assert.notEqual(result.status, 0, "a non-ancestor tag must still fail the run");
  assert.match(
    result.stderr,
    new RegExp(`FAIL: tag v5\\.0\\.0 \\(${tagSha}\\) does not point at HEAD \\(${headSha}\\)`),
  );
  assert.doesNotMatch(
    result.stderr,
    /commit\(s\) in range/,
    "AC4: ancestry precondition failing must never fall through to range enumeration",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// VR-30 (AC5, E141): the human's stated bar, half 2 — a tolerated Check 1
// must never make an unpushed release look clean. Check 2 (pushed-to-origin)
// is untouched and compares HEAD to @{u} directly, so it fires independently
// of whatever Check 1 decided. Fixture: push the release commit, then add
// the bookkeeping commit LOCALLY ONLY (mkFixtureRepo pushes origin before
// the tag block runs, so "behind-head-bookkeeping" + origin "pushed" lands
// the bookkeeping commit unpushed by construction — the real T-E141-01
// review shape, reproduced here rather than re-derived).
test("VR-30 (AC5, E141): genuinely unpushed bookkeeping commit -> Check 1 tolerates it (OK+NOTE) but Check 2 still FAILs 'local commits not pushed'", () => {
  const { root } = mkFixtureRepo({
    version: "6.0.0",
    tag: "behind-head-bookkeeping",
    origin: "pushed",
  });
  const headSha = git(["rev-parse", "HEAD"], root);
  const upstreamSha = git(["rev-parse", "origin/main"], root);
  assert.notEqual(headSha, upstreamSha, "sanity: the bookkeeping commit must be unpushed");

  const result = runVerify(root, ["v6.0.0"]);
  assert.notEqual(result.status, 0, "an unpushed bookkeeping commit must still fail the overall run");
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\)/,
    "Check 1 must tolerate the bookkeeping commit and say so",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.match(
    result.stderr,
    /FAIL:.*local commits not pushed/,
    "Check 2 must independently FAIL — the tolerance must never mask an unpushed release",
  );
});

// VR-31 (E141, T-E141-01 review observation 4 — non-blocking, pinned as
// documented current behaviour): a post-tag commit that DELETES an
// allowlisted bookkeeping path is tolerated. The path is bookkeeping either
// way, whether it is written or removed.
test("VR-31 (E141, observation 4 pin): a post-tag commit deleting an allowlisted bookkeeping file is tolerated -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "7.0.0", tag: "behind-head-bookkeeping-delete" });
  // Push the tolerated commit too, isolating Check 1 (see VR-27's comment).
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v7.0.0"]);
  assert.equal(result.status, 0, `deleting a bookkeeping path must be tolerated; stderr: ${result.stderr}`);
  assert.match(result.stdout, /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\)/);
});

// VR-32 (E141, T-E141-01 review observation 5 — non-blocking, pinned as
// documented current behaviour): a non-ASCII allowlisted filename fails
// CLOSED. Under default core.quotePath, git reports the path
// quoted/octal-escaped, which matches none of the allowlist regexes, so the
// commit is (correctly) treated as touching a non-bookkeeping path rather
// than silently tolerated.
test("VR-32 (E141, observation 5 pin): a non-ASCII allowlisted filename fails CLOSED -> Check 1 FAIL naming the offending (quoted) path, no tolerance note", () => {
  const { root } = mkFixtureRepo({ version: "8.0.0", tag: "behind-head-nonascii" });

  const result = runVerify(root, ["v8.0.0"]);
  assert.notEqual(result.status, 0, "a non-ASCII bookkeeping-shaped filename must fail closed, not pass");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*current/,
    "the FAIL must name the offending (quoted) path rather than silently passing",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// ---------------------------------------------------------------------------
// VR-39..VR-42 (E174a): lane-path additions to Check 1's bookkeeping
// tolerance (BOOKKEEPING_PATH_RES / LANE_SEGMENT_RE_SRC). VR-27/VR-31 above
// already pin the flat `.current/handoff.md` + `.current/*.jsonl` shape
// stays tolerated post-flip; these pin the lane-scoped shapes the E123 flip
// introduced, plus the two directories that must NEVER be mistaken for a
// lane (archive/history are aggregation dirs, not lane dirs).
// ---------------------------------------------------------------------------

test("VR-39 (E174a): a post-tag commit touching only .current/_primary/{handoff.md,telemetry.jsonl} + .current/e174a/{dispatch.jsonl,usage.jsonl} -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "11.0.0", tag: "behind-head-bookkeeping-lane" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v11.0.0"]);
  assert.equal(result.status, 0, `lane-scoped bookkeeping-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v11\.0\.0/,
    "a tolerated pass must say so explicitly, same as the flat-path shape",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});

test("VR-40 (E174a): a lane literally named 'archived' is tolerated (distinct from the excluded 'archive' directory)", () => {
  const { root } = mkFixtureRepo({ version: "11.1.0", tag: "behind-head-bookkeeping-archived-lane" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v11.1.0"]);
  assert.equal(result.status, 0, `the 'archived' lane must be tolerated; stderr: ${result.stderr}`);
  assert.match(result.stdout, /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\)/);
  assert.match(result.stdout, /OK: tag-at-HEAD/);
});

test("VR-41 (E174a): a post-tag commit touching .current/archive/... is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "11.2.0", tag: "behind-head-bookkeeping-archive-dir" });

  const result = runVerify(root, ["v11.2.0"]);
  assert.notEqual(result.status, 0, "a commit touching .current/archive/... must fail, not be tolerated");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*archive/,
    "the FAIL must name the offending .current/archive/... path",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-42 (E174a): a post-tag commit touching .current/history/... is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "11.3.0", tag: "behind-head-bookkeeping-history-dir" });

  const result = runVerify(root, ["v11.3.0"]);
  assert.notEqual(result.status, 0, "a commit touching .current/history/... must fail, not be tolerated");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*history/,
    "the FAIL must name the offending .current/history/... path",
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// ---------------------------------------------------------------------------
// VR-43..VR-46 (A1, human-mandated negative cases, E174a): each of these
// paths superficially resembles an allowlisted lane-scoped bookkeeping path
// but must NOT be tolerated. Each fixture's post-tag commit touches exactly
// one such path; Check 1 must FAIL, not silently pass.
// ---------------------------------------------------------------------------

test("VR-43 (A1): .current/a/b/handoff.md (two-segment path, never a lane) is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "12.0.0", tag: "behind-head-a1-nested-lane" });

  const result = runVerify(root, ["v12.0.0"]);
  assert.notEqual(result.status, 0, ".current/a/b/handoff.md must fail, not be tolerated");
  assert.match(result.stderr, /commit\(s\) in range touch non-bookkeeping paths:.*current\/a\/b/);
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-44 (A1): .current/.x/handoff.md (dot-prefixed lane name, not a safe path segment) is NOT tolerated -> Check 1 FAIL", () => {
  const { root } = mkFixtureRepo({ version: "12.1.0", tag: "behind-head-a1-dot-lane" });

  const result = runVerify(root, ["v12.1.0"]);
  assert.notEqual(result.status, 0, ".current/.x/handoff.md must fail, not be tolerated");
  assert.match(result.stderr, /commit\(s\) in range touch non-bookkeeping paths:.*current\/\.x/);
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-45 (A1): .current/.config.json is NOT tolerated -> Check 1 FAIL (it is explicitly not a lane file)", () => {
  const { root } = mkFixtureRepo({ version: "12.2.0", tag: "behind-head-a1-config" });

  const result = runVerify(root, ["v12.2.0"]);
  assert.notEqual(result.status, 0, ".current/.config.json must fail, not be tolerated");
  assert.match(result.stderr, /commit\(s\) in range touch non-bookkeeping paths:.*config\.json/);
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

test("VR-46 (A1): .current/_primary/feature-split.md is NOT tolerated -> Check 1 FAIL (not a LANE_FILES entry)", () => {
  const { root } = mkFixtureRepo({ version: "12.3.0", tag: "behind-head-a1-feature-split" });

  const result = runVerify(root, ["v12.3.0"]);
  assert.notEqual(result.status, 0, ".current/_primary/feature-split.md must fail, not be tolerated");
  assert.match(
    result.stderr,
    /commit\(s\) in range touch non-bookkeeping paths:.*feature-split\.md/,
  );
  assert.doesNotMatch(result.stdout, /NOTE: tag-at-HEAD/);
});

// ---------------------------------------------------------------------------
// VR-47 (A2, human-mandated drift-guard test, code-reviewer R1 on
// scripts/verify-release.mjs:249-250): the comment there claims "a
// drift-guard test pins the mirror" between LANE_SEGMENT_RE_SRC (plus its
// archive/history exclusion) and the real dist/tools/lane-paths.js
// isSafeLaneName / NON_LANE_DIRS — this is that test. It reads
// LANE_SEGMENT_RE_SRC's *actual source text* out of the real committed
// script (never a re-typed copy, so it cannot silently drift from what
// ships) via the real JS engine (`new Function`, not a hand-rolled
// unescaper, so JS string-escaping is interpreted exactly as node would),
// extracts the archive/history exclusion list the same way, and checks both
// against the real compiled dist/tools/lane-paths.js exports over a probe
// set. Changing either side alone — widening/narrowing SAFE_LANE_RE,
// changing NON_LANE_DIRS, or editing LANE_SEGMENT_RE_SRC without mirroring
// the change — turns this test red.
// ---------------------------------------------------------------------------

test("VR-47 (A2): verify-release.mjs's LANE_SEGMENT_RE_SRC + archive/history exclusion stay mirrored to dist/tools/lane-paths.js isSafeLaneName / NON_LANE_DIRS", async () => {
  const { isSafeLaneName, NON_LANE_DIRS } = await import("../dist/tools/lane-paths.js");

  // Extract LANE_SEGMENT_RE_SRC's runtime value from the REAL committed
  // script text via the real JS engine, not a hand-rolled string unescaper.
  const declMatch = REAL_VERIFY_SCRIPT.match(/const LANE_SEGMENT_RE_SRC = "[^\n]*";/);
  assert.ok(
    declMatch,
    "scripts/verify-release.mjs must define LANE_SEGMENT_RE_SRC as a single-line string const — update this test's extraction if the declaration shape changes",
  );
  // eslint-disable-next-line no-new-func -- literal is the script's own committed source text, not external input.
  const laneSegSrc = new Function(`${declMatch[0]}\nreturn LANE_SEGMENT_RE_SRC;`)();

  // The archive/history exclusion, parsed out of the extracted source
  // itself (never hand-typed), then compared against NON_LANE_DIRS by set
  // equality — the A2 requirement, not just a spot-check.
  const lookaheadMatch = laneSegSrc.match(/^\(\?!\(\?:([A-Za-z|]+)\)\\\/\)/);
  assert.ok(
    lookaheadMatch,
    "LANE_SEGMENT_RE_SRC must open with a (?!(?:<names>)\\/) exclusion lookahead — update this test's extraction if the shape changes",
  );
  const excludedInScript = new Set(lookaheadMatch[1].split("|"));
  assert.deepStrictEqual(
    [...excludedInScript].sort(),
    [...NON_LANE_DIRS].sort(),
    "verify-release.mjs's excluded-directory names must set-equal dist/tools/lane-paths.js's NON_LANE_DIRS — either side changing alone must turn this red",
  );

  // Full-segment acceptance, derived from the dist exports over a probe
  // set — not a re-derivation of SAFE_LANE_RE's char class (not exported),
  // exactly per the A2 instruction. LANE_SEGMENT_RE_SRC's exclusion
  // lookahead is context-dependent (it peeks for a following "/"), so it
  // must be exercised the SAME way BOOKKEEPING_PATH_RES actually embeds it
  // — inside a full `.current/<lane>/handoff.md` path, not as a bare,
  // unanchored-by-slash segment string.
  const scriptRe = new RegExp(`^\\.current\\/${laneSegSrc}\\/handoff\\.md$`);
  const scriptAccepts = (candidate) => scriptRe.test(`.current/${candidate}/handoff.md`);
  const distAccepts = (candidate) => isSafeLaneName(candidate) && !NON_LANE_DIRS.has(candidate);

  const probes = [
    "_primary",
    "e174a",
    "archive",
    "history",
    "archived",
    "historyx",
    "Archive",
    "HISTORY",
    "archiv",
    "-x",
    ".x",
    "a.b",
    "a b",
    "",
    "a/b",
    "_",
    "9",
    "e1-2",
    "x\n",
    "a_b-2",
    "9-abc",
    "___",
    "e123b9",
  ];
  for (const candidate of probes) {
    assert.equal(
      scriptAccepts(candidate),
      distAccepts(candidate),
      `LANE_SEGMENT_RE_SRC and isSafeLaneName()+NON_LANE_DIRS disagree on ${JSON.stringify(candidate)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// VR-33 (AC1, E147/T-E142-01): Check 6 sha resolution — the original defect's
// exact reproduction shape. A release tag sits at commit A; a
// governance-bookkeeping-only commit B lands on top of it (HEAD), the same
// "behind-head-bookkeeping" shape E141 already tolerates for Check 1. A
// completed CI run is recorded against A's sha ONLY. Pre-fix, Check 6
// resolved `releaseSha` unconditionally from `git rev-parse HEAD` (= B), so
// it would poll/match against B, never see the real run recorded for A, and
// (per this fixture's second, deliberately-red entry) could even FAIL a
// release off a fabricated bookkeeping-commit CI status that has nothing to
// do with the code actually being released. Post-fix, `releaseSha` resolves
// from the tag itself (A) before ever considering HEAD.
// ---------------------------------------------------------------------------
test("VR-33 (AC1, E147): tag at commit A, bookkeeping-only commit B on top (HEAD) -> Check 6 resolves/matches against A, never polls or matches B", () => {
  const { root, firstCommitSha } = mkFixtureRepo({
    version: "10.1.0",
    tag: "behind-head-bookkeeping",
    origin: "pushed",
  });
  const releaseTagSha = git(["rev-list", "-n", "1", "v10.1.0"], root);
  const headSha = git(["rev-parse", "HEAD"], root);
  assert.equal(releaseTagSha, firstCommitSha, "sanity: the tag names commit A");
  assert.notEqual(headSha, firstCommitSha, "sanity: HEAD (B, the bookkeeping commit) must have moved past A");
  // Push B too, so this test isolates Check 6 in an otherwise fully-clean run
  // (mkFixtureRepo pushes origin BEFORE the tag block runs, so the post-tag
  // bookkeeping commit is unpushed by construction unless re-pushed here —
  // same reasoning as VR-27).
  git(["push", "-q", "origin", "main"], root);

  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha: firstCommitSha, // A — the commit the release tag actually names
          url: "https://example.com/actions/runs/100",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          // B — the bookkeeping commit at HEAD. If Check 6 regressed to
          // resolving releaseSha from HEAD instead of the tag, it would match
          // THIS entry instead and FAIL the release off a bookkeeping
          // commit's (fabricated, deliberately red) CI status.
          conclusion: "failure",
          headSha,
          url: "https://example.com/actions/runs/101",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ]),
    ),
  );

  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.1.0"]);
  assert.equal(
    result.status,
    0,
    `Check 6 must resolve/match against tag commit A, not HEAD (B); stderr: ${result.stderr}`,
  );
  assert.match(
    result.stdout,
    /OK: CI ground-truth/,
    "a green run recorded against the release tag's own commit must report OK",
  );
  assert.ok(
    !result.stdout.includes("WARN: CI ground-truth"),
    "the matching run for A exists in the shimmed list — this must not degrade to WARN",
  );
  assert.doesNotMatch(
    result.stderr,
    /FAIL: latest completed CI run/,
    "Check 6 must never surface B's fabricated red run — B is not the commit being released",
  );
  assert.match(result.stdout, /check:release — ALL CHECKS PASSED \(v10\.1\.0\)/);
});

// ---------------------------------------------------------------------------
// VR-34 (AC2, E147/T-E142-01): no tag exists yet -> Check 6's `releaseSha`
// falls back to `git rev-parse HEAD`, unchanged from pre-fix behavior. Pins
// the fallback's actual sha-resolution outcome (a real gh shim recording a
// green run against HEAD's own sha must still be matched) rather than only
// "does not crash without a tag" (already covered by VR-1/VR-8, which use
// this same tag:"none" fixture with no gh shim at all).
// ---------------------------------------------------------------------------
test("VR-34 (AC2, E147): no tag exists yet -> Check 6's releaseSha falls back to HEAD (unchanged), matches a green run recorded against HEAD's own sha", () => {
  const { root } = mkFixtureRepo({ version: "10.2.0", tag: "none", origin: "pushed" });
  const headSha = git(["rev-parse", "HEAD"], root);

  const shimDir = mkGhShim(
    ghJsonShim(
      JSON.stringify([
        {
          conclusion: "success",
          headSha,
          url: "https://example.com/actions/runs/200",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ),
  );

  const result = runVerifyWithPath(root, `${shimDir}:${noGhSystemPath()}`, ["v10.2.0"]);
  // Check 1 (tag-at-HEAD) still FAILs (no tag exists) — Check 6 runs
  // independently (no short-circuit, per VR-8's pin) and must still
  // resolve/match against HEAD, unchanged.
  assert.match(result.stderr, /FAIL: tag v10\.2\.0 does not exist/);
  assert.match(
    result.stdout,
    /OK: CI ground-truth/,
    "the pre-tag fallback (HEAD) must still match a run recorded against HEAD's own sha",
  );
  assert.ok(!result.stdout.includes("WARN: CI ground-truth"));
});

// ---------------------------------------------------------------------------
// T-E165-01 (docs/backlog.md E165, Wave 4.5 L-RELTOOL) — Check 6's CI branch
// is now DERIVED from the checkout (deriveCIBranch), never hardcoded to
// "main": a release cut from a maintenance/hotfix branch must interrogate
// THAT branch's CI runs, not main's. No specs/<feature>.md exists for this
// mini-chain ticket (PM/architect skipped) — the spec is docs/backlog.md's
// E165 row plus the handoff's scope_decision_why, per the dispatch brief.
//
// Test map (scope_decision_why's two non-negotiable ACs for E165):
//   non-main branch -> gh receives --branch <branch> AND --workflow CI -> VR-35
//   detached HEAD, lenient -> zero gh calls, WARN stdout, exit 0        -> VR-36
//   detached HEAD, --ci-check --strict -> zero gh calls, FAIL, exit 1  -> VR-37
//   no upstream configured -> falls back to the current local branch   -> VR-38
// VR-11..VR-34 above are unmodified by this addition: every existing fixture
// pushes branch "main" with `-u origin main` (mkFixtureRepo's default), so
// deriveCIBranch resolves the identical "main" it always did — confirmed by
// the full-suite run this test's own review (review_reports/review_T-E166-01.md)
// rests on, and re-confirmed by this file's own regression run below.
//
// A tiny `gh` shim that records its OWN invocation argv (rather than just
// returning canned JSON, like every VR-1x/2x shim above) — this is the only
// way to assert "gh received exactly these two flags" or "gh was never
// invoked at all", neither of which a canned-response shim can prove on its
// own.
function mkGhArgvCaptureShim() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-shim-argv-"));
  const argvPath = path.join(dir, "argv");
  fs.writeFileSync(
    path.join(dir, "gh"),
    `#!/bin/sh\necho "$@" > "${argvPath}"\necho '[]'\n`,
  );
  fs.chmodSync(path.join(dir, "gh"), 0o755);
  return { dir, argvPath };
}

test("VR-35 (E165): non-main fixture branch -> gh run list receives --branch <that branch> AND --workflow CI", () => {
  const { root } = mkFixtureRepo({ version: "10.3.0", tag: "none", origin: "pushed" });
  // A release cut from a maintenance/hotfix branch, not main — the shape
  // E165's own top-of-file comment names as the motivating regression.
  git(["checkout", "-q", "-b", "release/10.3.x"], root);
  git(["push", "-q", "-u", "origin", "release/10.3.x"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const argv = fs.readFileSync(argvPath, "utf-8").trim();
  assert.match(argv, /(^|\s)--branch release\/10\.3\.x(\s|$)/, `gh must be queried for the checkout's own branch; argv: ${argv}`);
  assert.match(argv, /(^|\s)--workflow CI(\s|$)/, `gh must still be scoped to the CI workflow (E165 non-negotiable AC); argv: ${argv}`);
});

test("VR-36 (E165): detached HEAD, lenient -> gh is NEVER invoked, WARN on stdout, exit 0, empty stderr", () => {
  const { root } = mkFixtureRepo({ version: "10.3.1", tag: "none", origin: "pushed" });
  git(["checkout", "-q", "--detach"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `a detached HEAD must never fail the lenient CI check; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /WARN: CI ground-truth — detached HEAD — no branch to query CI runs for; continuing without CI verification \(graceful degradation, E14\)/,
  );
  assert.equal(result.stderr, "", "a WARN-only degradation must not print to stderr");
  assert.equal(
    fs.existsSync(argvPath),
    false,
    "gh must not be invoked at all when no branch can be derived (detached HEAD)",
  );
});

test("VR-37 (E165): detached HEAD, --ci-check --strict -> gh is NEVER invoked, FAIL on stderr, exit 1", () => {
  const { root } = mkFixtureRepo({ version: "10.3.2", tag: "none", origin: "pushed" });
  git(["checkout", "-q", "--detach"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check", "--strict"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 1, "detached HEAD must FAIL the strict pre-tag gate, not degrade");
  assert.match(
    result.stderr,
    /FAIL: CI ground-truth — detached HEAD — no branch to query CI runs for — refusing to proceed under the strict pre-tag gate/,
  );
  assert.equal(
    fs.existsSync(argvPath),
    false,
    "gh must not be invoked at all when no branch can be derived (detached HEAD), even under --strict",
  );
});

test("VR-38 (E165): no upstream tracking configured -> falls back to the current local branch name for the CI query", () => {
  const { root } = mkFixtureRepo({ version: "10.3.3", tag: "none", origin: "no-upstream" });
  // "no-upstream" (mkFixtureRepo): origin remote exists but main was never
  // pushed/tracked. Move to a second local-only branch so a pass here can
  // only be explained by the current-branch fallback, never by an upstream
  // this fixture deliberately never configured.
  git(["checkout", "-q", "-b", "hotfix/local-only"], root);

  const { dir, argvPath } = mkGhArgvCaptureShim();
  const result = runVerifyWithPath(root, `${dir}:${noGhSystemPath()}`, ["--ci-check"], {
    AGC_VERIFY_CI_WAIT_SECONDS: "0",
  });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const argv = fs.readFileSync(argvPath, "utf-8").trim();
  assert.match(
    argv,
    /(^|\s)--branch hotfix\/local-only(\s|$)/,
    `gh must be queried for the current local branch when no upstream is configured; argv: ${argv}`,
  );
  assert.match(argv, /(^|\s)--workflow CI(\s|$)/, `argv: ${argv}`);
});

// ---------------------------------------------------------------------------
// VR-48/VR-49 (E126 T-E126-04/T-E126-06, X5/E198(a), spec AC10): the two new
// BOOKKEEPING_PATH_RES entries added for `.current/_primary/tasks.md` (a
// literal, mirroring the `_primary` handoff.md tolerance) and lane-scoped
// `.current/<lane>/tasks.md` (a LANE_SEGMENT_RE_SRC-reusing regex, mirroring
// the existing lane-scoped handoff.md/*.jsonl entries). Both mirror
// VR-39/VR-40 one-for-one, substituting tasks.md for handoff.md/telemetry.jsonl.
//
// VR-47 (the LANE_SEGMENT_RE_SRC <-> isSafeLaneName/NON_LANE_DIRS drift
// guard) is NOT extended here: T-E126-04's lane-scoped tasks.md regex reuses
// the SAME `LANE_SEGMENT_RE_SRC` constant VR-47 already pins (spec
// Dependencies: "reuse by import only, never restate") rather than
// restating a second copy of the lane-segment pattern, so there is nothing
// new for that drift guard to mirror.
// ---------------------------------------------------------------------------

test("VR-48 (E126 AC10): a post-tag commit touching only .current/_primary/tasks.md -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "13.0.0", tag: "behind-head-bookkeeping-tasks-primary" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v13.0.0"]);
  assert.equal(result.status, 0, `_primary/tasks.md-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v13\.0\.0/,
    "a tolerated pass must say so explicitly, same as the handoff.md/*.jsonl shapes",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});

test("VR-49 (E126 AC10): a post-tag commit touching only .current/<lane>/tasks.md -> Check 1 OK with tolerance NOTE", () => {
  const { root } = mkFixtureRepo({ version: "13.1.0", tag: "behind-head-bookkeeping-tasks-lane" });
  git(["push", "-q", "origin", "main"], root);

  const result = runVerify(root, ["v13.1.0"]);
  assert.equal(result.status, 0, `lane-scoped tasks.md-only range must pass; stderr: ${result.stderr}`);
  assert.match(
    result.stdout,
    /NOTE: tag-at-HEAD — tolerated 1 governance-bookkeeping commit\(s\) ahead of tag v13\.1\.0/,
    "a tolerated pass must say so explicitly, same as the lane-scoped handoff.md/*.jsonl shape",
  );
  assert.match(result.stdout, /OK: tag-at-HEAD/);
  assert.equal(result.stderr, "", "a tolerated pass must not print anything to stderr");
});
