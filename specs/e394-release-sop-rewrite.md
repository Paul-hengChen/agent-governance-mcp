# e394-release-sop-rewrite

Ticket: E394 (P1). Lane `e394`, branch `feat/e394-release-sop-rewrite`, worktree `../agent-governance-mcp-lanes/e394`, base `89e01c6`.
Scope source: `docs/backlog.md` E394 row; fan-out manifest `specs/fanout-e392-e394.md` (E394 content, pre-dispatch check, human rulings 3–5, common scope, Lanes row `e394`).

## Problem Statement

`content/skill-release-engineer.md` is 98,836 bytes (292 lines) and cites 69 distinct backlog ids, 32 version numbers and 10 commit shas. Its step numbering (2a, 3a, 3b, 6a, 7a–d, 8a–c, 9a, 11a, 11b, 13a, 13b) records one patch per incident, step 7a alone carries 26.8KB of inline bash heredocs, and only 5% of the text sits inside rationale markers, so every release-engineer dispatch reads the whole incident history. The root cause (human-confirmed 2026-11-02): a mechanical procedure (archive evidence, drift baseline, backlog done-mark, adapter stamps, staging and commit checks, CI gate, PR merge, tag, gh release, self-check, bookkeeping commit, close-out) is executed from prose by a model; each session re-interprets it, and each incident adds a paragraph instead of changing the mechanism. This feature moves steps 7a–13b into `scripts/release.mjs` (one exit code per failure class, `--dry-run`, the incident lessons as tests), rewrites the skill as a ≤ 15KB procedure, and moves the incident narratives verbatim to `specs/release-sop-history.md`.

## User Stories

- As a release-engineer session, I want one script to run the mechanical release steps and stop with a distinct exit code per failure class, so that I make the human decisions and the MCP writes, and nothing else, from prose.
- As a human approving a release, I want the bump kind, the CHANGELOG content and the dependency-advisory disposition asked up front, so that every later step is mechanical.
- As a maintainer, I want each lesson the old SOP encoded as prose to be a test assertion, so that a regression fails a test instead of depending on a model re-reading a paragraph.
- As the integrator, I want the three existing scripts' CLIs unchanged, so that `verify-release.mjs --ci-check --sha`, `check:version` (prebuild) and `check:bookkeeping` keep working for my CI check and 5c bookkeeping check.

## Acceptance Criteria

Prefixes: **S** = script, **P** = SOP and history, **H** = hard condition, **L** = lessons, **T** = tests. `<base>` in a proof = `git merge-base HEAD main` (never a literal sha in a resident test; fan-out common scope).

### Script (`scripts/release.mjs`)

- **AC-S1 (phases, dry-run)** — Given a fixture repo in the state SOP step 7 leaves, when `node scripts/release.mjs <phase> --dry-run <inputs>` runs for each phase, then it exits 0, prints every action the phase would take in step order, and leaves the working tree, the index, every ref, the fixture remote and the gh stub's mutation log unchanged. Phases split around the MCP writes the script cannot make (step 12 closing write, step 13 read-back): phase names and boundaries are fixed by the architecture doc (expected shape: `prepare` = 7a–8a, `publish` = 8b–9a, `close-out` = 13a–13b).
  proof: `test/e394-release-script.test.mjs` test "AC-S1 dry-run mutates nothing, per phase".
- **AC-S2 (exit-code contract)** — Given the architecture's failure-class table, when each class is triggered on a fixture, then the script exits with that class's code and prints that class's fixed prefix; every class has a distinct non-zero code; the script exports the table and it equals the architecture table row for row.
  proof: `test/e394-release-script.test.mjs` test "AC-S2 one exit code per failure class".
- **AC-S3 (git/gh verb allow-list)** — Given `scripts/release.mjs`, when every child-process call is enumerated, then each is array-argv (no `shell: true`, no string `exec`), and every git/gh verb is in: `git add`, `git commit` (no `--amend`), `git tag -a`, `git push -u origin release/*`, `git push origin <new tag>`, `git switch -c release/*`, `git switch main`, `git branch -d release/*`, `git -c pull.rebase=false pull --ff-only` (on `main` only), read-only git (`fetch`, `diff`, `log`, `status`, `show`, `ls-tree`, `ls-files`, `rev-parse`, `rev-list`, `describe`, `ls-remote`), `gh auth status`, `gh release view`, `gh pr create`, `gh pr merge --auto --merge`, `gh pr view`, `gh run list/view` (read), `gh release create`. Absent: `reset`, `rebase`, `clean`, `checkout --force`, `push --force`/`-f`, `tag -f`, `push` to `main`, `--squash`, `--rebase`, `--admin`, `branch -D`, `stash drop`/`clear`, `update-ref`.
  proof: `test/e394-release-script.test.mjs` test "AC-S3 verb allow-list and array argv".
- **AC-S4 (7a evidence archive)** — Given the fixtures `test/release-staging.test.mjs` already carries for step 7a (v3.93.0 untracked-at-root, v3.94.0 two-file, committed-in-range, non-retroactivity, bare-code prose, already-archived, `expected-red_*` per-feature sweep, 14-row filename-shape matrix, per-tree empty-baseline guard incl. unset `PREV_TAG`, absent `review_reports/`, v3.96.0 basename collision, `covers:` sweep in its own tree, batched-prose `covers:` line), when the script's archive step runs, then it produces exactly the outcomes those tests assert today (same `<CODES>` set, same moves, no-clobber, `<CODES>` logged even when empty, empty-baseline hazard = its own failure class), implemented in Node (no shell globs, no heredoc).
  proof: `test/release-staging.test.mjs` 7a tests retargeted to the script (T-E394-12).
- **AC-S5 (7b–7d)** — Given completed task ids, the version and the adapters, when the bookkeeping step runs, then `.current/.config.json` `driftBaselineIds` gains the ids deduplicated (created if absent); the active feature's backlog row(s) carry the done-mark with `vX.Y.Z` (a pre-marked "not yet released" phrase is amended in place, never a duplicate row) and `scripts/check-bookkeeping.mjs` exits 0; the `agc-version:` stamp is the new version in `CLAUDE.md`, `AGENTS.md`, `.antigravityrules` and `node bin/agc-init.mjs check` exits 0. Who authors the done-mark summary text (script input vs. agent edit verified by the script) is fixed by the architecture doc.
  proof: `test/e394-release-script.test.mjs` test "AC-S5 drift baseline, done-mark, adapter stamps".
- **AC-S6 (8a commit + PR)** — Given a prepared tree, when the commit step runs, then: staging uses the enumerated feature-dir + metadata path list with an existence pre-filter (incl. `.current/.config.json`, `docs/backlog.md`, `tasks.md`, `.current/_primary/tasks.md`, the three adapters); a feature dir with changes absent from the index stops; the root-file completeness check (`git diff --name-only` and `git ls-files --others --exclude-standard`, `.current/` excluded) stops on leftovers; the CHANGELOG citation check uses `PREV_TAG..HEAD` ∪ staged with the `(context, not changed)` exemption (on-disk existence still required); the spec check before the commit, over `PREV_TAG..HEAD` ∪ the stage plan, classifies REQUIRE / MULTI-FEATURE / SKIP / UNCLASSIFIABLE with today's verbatim stop strings except REQUIRE, whose remedy reads `Stage the missing files and re-run.` (no commit exists yet, and `--amend` is forbidden); the commit message reaches git without a shell; the branch `release/vX.Y.Z` is pushed with `-u` and `gh pr create` opens a PR with base `main`. Never merges, never tags.
  proof: `test/release-staging.test.mjs` 8a/AC4 tests retargeted (T-E394-12) + `test/e394-release-script.test.mjs` test "AC-S6 commit, push, PR".
- **AC-S7 (8b–9a)** — Given an open release PR, when the publish phase runs, then: the CI gate is `scripts/verify-release.mjs --ci-check --strict` and only `CI-CHECK PASSED` continues; a target tag existing locally or on origin stops before any merge; the merge is `gh pr merge <n> --auto --merge`; the phase waits for `MERGED`, switches to `main`, pulls `--ff-only` and stops if `HEAD` ≠ `mergeCommit.oid`; then `git tag -a`, `git push origin vX.Y.Z`, `git branch -d release/vX.Y.Z`, `gh release create` with notes = the CHANGELOG entry + an `## Install` block, and `scripts/verify-release.mjs vX.Y.Z` must exit 0. A PR that cannot merge (red, `BEHIND`, `CONFLICTING`) and a push rejection are their own failure classes.
  proof: `test/e394-release-script.test.mjs` test "AC-S7 publish order and stops".
- **AC-S8 (13a–13b)** — Given a confirmed closing write, when the close-out phase runs, then the lane comes from compiled `resolveCurrentLane` (never hardcoded); `release/vX.Y.Z-bookkeeping` is opened from `main`; `.current/<lane>/handoff.md` plus the enumerated `.current/<lane>/*.jsonl` are staged (no raw glob); an empty stage stops before commit; commit, push, PR, `--auto --merge`, wait `MERGED`, switch `main`, pull `--ff-only`, `branch -d`; then `scripts/verify-release.mjs --close-out` must print `CLOSE-OUT PASSED`; its two FAILs (no upstream / ahead of upstream) are two distinct failure classes.
  proof: `test/e394-release-script.test.mjs` test "AC-S8 close-out".
- **AC-S9 (absorption)** — Given the three existing scripts, when `release.mjs` needs version coherence, CI ground truth, release self-check, close-out, or backlog/citation validation, then it calls `check-version.mjs`, `verify-release.mjs` and `check-bookkeeping.mjs` (subprocess by default; import only where the architecture names a function), and re-implements none of their checks.
  proof: code review against the architecture's absorption table + `test/e394-release-script.test.mjs` test "AC-S9 absorbed checks are delegated".

### SOP and history

- **AC-P1 (sections)** — `content/skill-release-engineer.md` has frontmatter `recommended_model: opus` (unchanged), `# Skill: release-engineer`, then `## Persona`, `## Output rule`, `## Hard rules`, `## Artifact`, `## SOP`, `## Escalation Routes`, in that order, every section rewritten.
  proof: `test/e394-release-sop.test.mjs` test "AC-P1 sections in order".
- **AC-P2 (human decisions first)** — The SOP collects the bump kind (default patch, major only on explicit opt-in), the CHANGELOG entry content and the dependency-advisory disposition (`npm audit --audit-level=high` against `docs/dependency-advisories.md`; no inline waiver) before the first script phase runs.
  proof: `test/e394-release-sop.test.mjs` test "AC-P2 decisions precede the first script call".
- **AC-P3 (script steps)** — The SOP names each script phase with its exact command line, runs `--dry-run` first, and keeps the steps before 7a that stay prose (precondition, opening write, pre-flight CI check, re-baseline off `main`, `release/vX.Y.Z` branch, bumps, build path, test, `check-version`).
  proof: `test/e394-release-sop.test.mjs` test "AC-P3 phases and dry-run named".
- **AC-P4 (Escalation Routes)** — One row per script exit code (bijection with the exported table) plus rows for the non-script stops (pre-flight CI red, `npm test` regression, dependency-advisory without disposition, ⛔ rejection, closing-write read-back mismatch, host-killed CI wait at the `fix_try` cap). Every `next_role` value is a member of the `tw_update_state` `next_role` enum; a row that hands back to the human says so in prose and omits `next_role` (today's rows write `human`, which the enum rejects).
  proof: `test/e394-release-sop.test.mjs` test "AC-P4 one row per exit code, valid next_role".
- **AC-P5 (closing write, read-back, handback)** — The closing write is `agent_id="release-engineer"`, `status="In_Progress"`, `next_role="pm"`, `pending_notes[0]` = `Released vX.Y.Z` (the feature-lease terminal marker keys on it); a `tw_get_state` read-back follows before the close-out phase; `Done. Released <tag>.` is emitted only after read-back match and `CLOSE-OUT PASSED`; the handback names pm's backlog intake; success-metrics emit is automatic.
  proof: `test/e394-release-sop.test.mjs` test "AC-P5 closing triple, read-back, intake".
- **AC-P6 (retained hard rules)** — The SOP keeps, in rewritten form: PASS precondition; major-bump opt-in; no force push / tags immutable / `main` moves only by PR merge; check-version before tag; version-literal test failures route to qa-engineer; first-class transition citizen (never stamp another role); STOP on any ⛔; no-MCP-path sessions relay with `RELAY REQUIRED:` and never hand-edit, no brief overrides this; push rejection / collision STOPs Blocked with the local sha (pointer to Constitution §6); record integrity (`(context, not changed)` exemption, on-disk existence required).
  proof: `test/e394-release-sop.test.mjs` test "AC-P6 hard rules present".
- **AC-P7 (Artifact)** — The allowlist keeps today's write scope (version fields, `index.ts` Server literal, new CHANGELOG entry, README pins, `driftBaselineIds`, backlog done-marks, three `agc-version:` stamps, `.current/<lane>/handoff.md` + `*.jsonl` commit-only, `tasks.md` + `.current/_primary/tasks.md` staged by the release commit, `qa_reports/archive/**` + `review_reports/archive/**` move-only, `dist/**` via build) and the MUST-NOT list; it adds that the script performs these writes.
  proof: `test/e394-release-sop.test.mjs` test "AC-P7 artifact allowlist".
- **AC-P8 (procedure, not history)** — The SOP contains no commit sha (7–40 hex token), no concrete version literal (`v<d>.<d>.<d>`; `vX.Y.Z` placeholders allowed), and exactly one pointer line to `specs/release-sop-history.md`.
  proof: `test/e394-release-sop.test.mjs` test "AC-P8 no sha, no version, one history pointer".
- **AC-P9 (render)** — The SOP renders glue-free through `switchRole` and `buildPromptForRole`, marker pairs balance, and every line passes the `tw_update_state` `qa_review` corpus sweep.
  proof: `node scripts/test-lock.mjs -- node --test test/render-structure.test.mjs test/skill-manifest.test.mjs test/e92-e86-handoff-write-boundary.test.mjs` green.
- **AC-P10 (history moved verbatim)** — `specs/release-sop-history.md` opens with a provenance header (source path, base commit, date) and holds, grouped under the base step each came from, every narrative unit the architecture doc enumerates (all rationale blocks, origin spans, `Reason (…)` paragraphs, incident/backtest/round narratives) byte-identical to the base text.
  proof (review time, not a resident test): a one-off comparison of each enumerated unit of `git show <base>:content/skill-release-engineer.md` against the history file, run by code-reviewer and qa; resident anchor checks in `test/e394-release-sop.test.mjs` test "AC-P10 history anchors".

### Hard conditions

- **AC-H1 (old CLIs unchanged)** — `test/check-version.test.mjs`, `test/e299-check-bookkeeping.test.mjs`, `test/e320-ci-check-sha.test.mjs`, `test/e326-empty-branch-run-poll.test.mjs`, `test/e158-range-subject.test.mjs` and every non-SOP-wording test in `test/verify-release.test.mjs` pass with zero edits; the three scripts' flags, output lines and exit codes are unchanged.
  proof: `git diff --stat <base> -- test/check-version.test.mjs test/e299-check-bookkeeping.test.mjs test/e320-ci-check-sha.test.mjs test/e326-empty-branch-run-poll.test.mjs test/e158-range-subject.test.mjs` empty, and those files green in the full suite.
- **AC-H2 (self-contained scripts)** — `scripts/verify-release.mjs`, `check-version.mjs`, `check-bookkeeping.mjs` gain no relative import (tests copy each file alone into temp repos); any export added for absorption sits behind a main guard with no CLI change.
  proof: `grep -nE "from \"\\./|from '\\./|import\\(\"\\./" scripts/verify-release.mjs scripts/check-version.mjs scripts/check-bookkeeping.mjs` prints nothing.
- **AC-H3** — `npm run check:version` and `npm run check:bookkeeping` exit 0 on lane HEAD.
  proof: `npm run -s check:version; echo "exit=$?"; npm run -s check:bookkeeping; echo "exit=$?"` prints `exit=0` twice.
- **AC-H4 (dist)** — `npm run build` leaves `dist/` unchanged and the lane diff has no `dist/` path.
  proof: `npm run build && git status --porcelain dist/ && git diff --stat <base> -- dist/` prints nothing.
- **AC-H5 (size)** — `wc -c < content/skill-release-engineer.md` ≤ 15000 (decimal KB, the convention behind the backlog's "98.8KB" for 98,836 bytes).
  proof: `wc -c < content/skill-release-engineer.md`.
- **AC-H6 (no gate count)** — The SOP names `GATE_REGISTRY` and states no gate count; it contains `` `gates/registry.ts` (`GATE_REGISTRY`) `` exactly once, so `test/e391-prompt-audit-stale-facts.test.mjs` AC-G2-02 passes unedited.
  proof: `node --test test/e391-prompt-audit-stale-facts.test.mjs`.
- **AC-H7 (ownership)** — Every path in `git diff --name-only <base>` is in the lane's 擁有 cell or is lane bookkeeping (`.current/e394/**`, `qa_reports/*E394*`, `review_reports/*E394*`); `templates/**`, `test/subagent-templates.test.mjs`, `package.json`, `CLAUDE.md`, `prompts/**`, `tools/**`, `gates/**` are untouched.
  proof: `git diff --name-only <base>` reviewed against the 擁有 cell at mailbox pre-review and at qa.
- **AC-H8** — `test/subagent-templates.test.mjs` passes unedited (frontmatter `recommended_model: opus` unchanged).
  proof: `node --test test/subagent-templates.test.mjs`.

### Lessons and tests

- **AC-L1 (69 lessons → assertions)** — The architecture doc's lesson table lists all 69 E-ids the base SOP cites (round/finding ids D/C/A/N/F/X fold into their parent ticket), each classed **S** (now a script mechanism → script assertion), **P** (still an SOP rule → SOP content assertion) or **H** (historical example or citation only → history-presence assertion), each with the named test that asserts it. The test files carry the literal 69-id list and a meta-assertion that every id maps to ≥ 1 named test.
  proof: `test/e394-release-sop.test.mjs` test "AC-L1 every cited ticket has an assertion".
- **AC-T1 (re-pins traceable)** — Every edited test hunk names, in its test title, the AC it re-pins; no test file outside the Test Re-pin Map is edited.
  proof: qa review + `git diff --name-only <base> -- test/` ⊆ the map.
- **AC-T2 (suite)** — Full suite green on the final HEAD.
  proof: `node scripts/test-lock.mjs -- npm test`, suite-result recorded in the QA evidence.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sop.output | `Done. Released <tag>.` | base SOP Output rule (kept) |
| sop.relay | `RELAY REQUIRED:` | base SOP Hard rules E9A (kept) |
| sop.closing.note0 | `Released vX.Y.Z` | base SOP step 12; `gates/feature-lease.ts` matches `^Released v` |
| sop.gate-registry | `` `gates/registry.ts` (`GATE_REGISTRY`) `` | `test/e391-prompt-audit-stale-facts.test.mjs` AC-G2-02 |
| sop.history-pointer | one line naming `specs/release-sop-history.md` | authored-here — wording set by sr-engineer in T-E394-10, pinned by qa |
| script.class-prefix.* | one fixed stdout/stderr prefix per failure class | authored-here — fixed in the architecture's exit-code table (T-E394-01) |
| script.ac4.* | the REQUIRE / UNCLASSIFIABLE stop strings | base SOP step 8a (kept byte-identical; pinned by `test/release-staging.test.mjs`) |
| script.ci / close-out | `CI-CHECK PASSED`, `CLOSE-OUT PASSED` | printed by `scripts/verify-release.mjs` (unchanged) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E394 (4): slimming `templates/claude-code-agents/release-engineer.md` (integration-time ticket NEW-1); `templates/**` and `test/subagent-templates.test.mjs` are forbidden to this lane.
- Retiring any of the three absorbed scripts, changing their callers, a `package.json` `release` alias (NEW-2).
- `prompts/release-engineer.ts`, `tools/transitions.ts`, `GATE_REGISTRY`, any `.ts` source, `dist/`.
- G2-22 / G2-17d rationale-marker wrapping (superseded by this ticket).
- Scripting SOP steps 1–7 (they stay prose; the human ruling is 7a–13b).
- Release bookkeeping for this ticket itself (version bump, CHANGELOG, backlog done-mark): release-engineer post-integration.
- The next release: runs on `main`'s current SOP until this lane merges.

## Dependencies / Prerequisites

None blocking. Binding human rulings (2026-11-02 / 2026-11-03, `specs/fanout-e392-e394.md` Decisions): scope (1)(2)(3); (4) deferred; script first, then SOP, one lane, one feature; full chain with architect for the failure-class contract; absorbed CLIs unchanged. No design file (mode: no-design); Visual Structural Assertions omitted. No external references (Resource Audit: zero hits).

Derived constraints (stated for the integrator's pre-review, no option choice involved):
1. **Phases.** A Node script has no MCP client and a hand-edit of `handoff.md` is forbidden, so steps 12–13 (closing write, read-back) stay agent MCP calls between the `publish` and `close-out` phases; "the script performs 7a–13b" means every non-MCP step in that range.
2. **One file.** No helper module beyond `scripts/release.mjs` is planned; tests can copy it alone into a temp repo, as the existing script tests do. If the architect concludes otherwise, the module is named as a new file and sent back to pre-review.
3. **`gh release create`** stays in the script (base step 9, inside 7a–13b); it is a GitHub API call, not a §6 git mutation.
4. **15KB = 15,000 bytes** by `wc -c` (the backlog's own measurement convention).
5. **`next_role` "human".** The base SOP's rows write `next_role="human"`, which the `tw_update_state` enum rejects; the rewrite routes those rows by prose handback (AC-P4). Fixed inside this ticket's own file; no other file is touched for it.

Expected-red window: after T-E394-10 lands and before T-E394-12..14, tests that read the base SOP wording are red by design (the Test Re-pin Map below). sr-engineer lists the red tests in its `pending_notes`; a red test outside the map is a regression. code-reviewer reviews with that known set.

Chain: pm → architect (T-E394-01; second mailbox pre-review of its Open Questions) → sr-engineer (T-E394-02..10, consecutive sessions) → code-reviewer (whole diff) → qa-engineer (T-E394-11..16). Hops: 4 on the clean path; within the cap of 14 with two review and two QA rounds.

## Step Map (base SOP → destination → AC → task)

| base step | destination | AC | task |
|---|---|---|---|
| Persona, Output rule, Hard rules, Artifact | SOP, rewritten | AC-P1, P5, P6, P7 | T-E394-10 |
| 1, 2 (precondition, opening write) | SOP | AC-P3, P5 | T-E394-10 |
| 2a (pre-flight CI, lenient) | SOP (calls `verify-release.mjs --ci-check`) | AC-P3, P4 | T-E394-10 |
| 3 bump kind, 4 CHANGELOG content, 6a advisory disposition | SOP, human decisions up front | AC-P2 | T-E394-10 |
| 3a, 3b, 4 (mechanical bumps), 5, 6, 7 | SOP prose | AC-P3 | T-E394-10 |
| 7a archive | script `prepare` | AC-S4 | T-E394-03 |
| 7b, 7c, 7d | script `prepare` | AC-S5 | T-E394-04 |
| 8a staging, completeness, citation check | script `prepare` | AC-S6 | T-E394-05 |
| 8a post-commit spec check, commit, push, PR | script `prepare` | AC-S6 | T-E394-06 |
| 8b, 8c, 9, 9a | script `publish` | AC-S7 | T-E394-07 |
| 10, 11 (retired pointers) | dropped; narrative to history | AC-P10 | T-E394-09 |
| 11a gate-retro, 11b metrics | SOP one line each | AC-P5 | T-E394-10 |
| 12, 13 + terminal-marker note | SOP (agent MCP) | AC-P5 | T-E394-10 |
| 13a, 13b | script `close-out` | AC-S8 | T-E394-08 |
| 14 intake handback | SOP | AC-P5 | T-E394-10 |
| Escalation Routes + scope rule | SOP rows per exit code; scope rule = script precondition | AC-P4, S2 | T-E394-02, T-E394-10 |
| CLI, exit table, dry-run, runner seam, absorption | script skeleton | AC-S1, S2, S3, S9 | T-E394-02 |
| all narratives | `specs/release-sop-history.md` | AC-P10 | T-E394-09 |

## Lesson → Assertion Approach

The base SOP cites 69 distinct E-ids. Full mapping is delegated to the architect (T-E394-01, a table in `specs/e394-release-sop-rewrite-architecture.md`); qa implements it (T-E394-11, 12, 15). Initial grouping for the architect to confirm:
- **S (script mechanism)** — e.g. E1 (re-baseline, as precondition check), E9/E14/E78/E80/E82 (self-check, CI ground truth, poll budget — delegated to `verify-release.mjs`), E44/E142/E152 (post-commit spec classes, range), E49/E50/E76/E71b/E301 (7a derivation, two trees, single process, NOMATCH, citation convention), E53 (empty-baseline stop class), E60 (lockfile parity), E64/E66/E71a/E94/E95/E83 (staging list, pre-filter, root-file completeness, citation check), E65/E71d (7b–7d before the commit, pre-marked row), E84/E143/E144 (bookkeeping commit, ledger ownership, two close-out FAILs), E141 (bookkeeping commits ahead of tag), E163/E164 (strict CI gate, re-run budget), E297/E336 (release branch, PR, never push `main`, portable pull), E125c (no second archive path).
- **P (SOP rule)** — e.g. E9A/E18 (relay, coordinator-relayed closing write), E17 (record integrity), E13/E1A (closing triple, resilience fallback), E55 (intake handback), E57 (advisory disposition), E8 (metrics automatic), E67b (`npx tsc` bump-build path + transitions sync), E67d (harness trailer), E7/D10 (§6 pointer).
- **H (history only)** — release ids cited as backtest outputs or examples (e.g. E25–E39, E44–E46 lists, E645 batch artifact, E4X) → assertion that the narrative is present in `specs/release-sop-history.md`.
Script-class lessons become fixtures in `test/e394-release-script.test.mjs` or retargeted tests in `test/release-staging.test.mjs`; P-class become content assertions in `test/e394-release-sop.test.mjs`; H-class become history anchors in the same file. Test titles carry the E-id.

## Test Re-pin Map

Edited by qa only (Constitution §2). "Unedited" = must stay green with zero edits.

| test file | what it pins today | disposition | AC | task |
|---|---|---|---|---|
| `test/release-staging.test.mjs` | 7a/8a shell fragments extracted from the SOP and executed; AC4 branches; staging list; Escalation rows; C13/D10/E7-AC2/E53/E55/E65/E71 prose | executed fragments → call the script on the same fixtures; prose → new SOP wording or history anchors; template-shim tests (AC5, C13-AC6/7, D10-AC4), E7-AC1/AC3, E59 unedited | S4, S6, P4, P6, P7, P10 | T-E394-12 |
| `test/feature-lease.test.mjs` | S1–S3 re-baseline step, S7 closing write `agent_id`, S8 metrics step, E13-AC6 resilience note, E9A-S*, E17-S* | re-pin to rewritten rules, E9A-S5 / E17-S4 included. Cross-lane boundary: the two `Example reply suffix: … — @release-engineer (haiku)` assertion blocks (base lines 1533–1540 and 1680–1687) belong to lane e392 (its qa deletes them with template lines 24–25); this lane does not touch them and adds no example-line assertion. | P3, P5, P6 | T-E394-13 |
| `test/e18-write-provenance.test.mjs` | CONTENT-3: coordinator-relayed line naming an incident | rule in SOP, incident in history | P6, P10 | T-E394-13 |
| `test/verify-release.test.mjs` | VR-9 (step 9a + row), VR-10 (read-back); 61 other tests on script behaviour | re-pin VR-9/VR-10 only | P4, P5, H1 | T-E394-13 |
| `test/e130-lane-default.test.mjs` | AC11: `git add` line / `PATHS=` / Artifact bullet stage `.current/_primary/tasks.md` | staging list → script; Artifact bullet → SOP | S6, P7 | T-E394-13 |
| `test/e336-portable-pull.test.mjs` | portable `pull --ff-only` count = 6 in the SOP; every `pull.rebase` is a command site | new count; SOP + script sites | S3, P6 | T-E394-13 |
| `test/e297-main-protected-sop.test.mjs` | release branch, PR, retired early tag, budget sentence, bookkeeping branch, `CLOSE-OUT PASSED` | re-pin to SOP + script | S7, S8, P4 | T-E394-13 |
| `test/render-structure.test.mjs` | T-E69-02 anchors (`mkdir -p` bullet, 7b header), T-E8795-02 E95 bullet render; hermetic baseline fixtures (lines 90–101) | re-pin anchors to the new SOP; hermetic fixtures unedited | P9 | T-E394-14 |
| `test/e166-template-defers-staging.test.mjs` | anchors inside step 8a / 8b | re-pin to the `prepare` phase anchors | S6, P3 | T-E394-14 |
| `test/e164-e167-content.test.mjs` | step 8b/8c/9a extracts, CI-gate row `\| human \|`, unrenumbered step labels | re-pin to SOP rows/rules | P4, P6 | T-E394-14 |
| `test/e295-hop-cap-and-sop-halves.test.mjs` | `check:bookkeeping` named ≥ 1 | expected unedited (SOP names it) | P3 | T-E394-14 |
| `test/skill-evolution-v3.11.test.mjs` | file exists, ROLE_SKILL_MAP, five section headings | expected unedited | P1 | T-E394-14 |
| `test/qa-flow.test.mjs` | two comments citing SOP line numbers; assertions are on transitions | comment refresh only, optional | P4 | T-E394-14 |
| `test/e391-prompt-audit-stale-facts.test.mjs` | AC-G2-02; line 123 (CLAUDE.md text) | unedited by design | H6 | — |
| `test/check-version.test.mjs`, `test/e299-check-bookkeeping.test.mjs`, `test/e320-ci-check-sha.test.mjs`, `test/e326-empty-branch-run-poll.test.mjs` | absorbed scripts' CLI behaviour | unedited | H1, H2 | — |
| `test/e394-release-script.test.mjs` (new) | script contract, dry-run, verb allow-list, phases, S-class lessons | new | S1–S9, L1 | T-E394-11 |
| `test/e394-release-sop.test.mjs` (new) | SOP structure, size, rules, Escalation bijection, history anchors, 69-id meta-assertion | new | P1–P8, P10, H5, H6, L1 | T-E394-15 |

Checked, not in the map, must stay green unedited: `test/e158-range-subject.test.mjs` (copies the three scripts into temp repos — AC-H2), `test/e178a-integrator-role.test.mjs` and `test/eval/lib/bundle.mjs` (file-name map only), `test/subagent-templates.test.mjs` (forbidden; AC-H8), `test/skill-manifest.test.mjs`, `test/e385-worktree-evidence.test.mjs`, `test/e92-e86-handoff-write-boundary.test.mjs` (content sweeps; AC-P9), `test/baseline-manifest-gate.test.mjs`, `test/qa-visual-skill-split.test.mjs`, `test/pixel-gate-attestation.test.mjs` (comments only), `test/e226-integrator-sop-portable.test.mjs`, `test/e349-integrator-repo-facts.test.mjs` (other SOPs / addendum).

## Gate Summary

| gate | outcome |
|---|---|
| Visual State-Count Split | not triggered — no design file |
| Geometric-Density Split | not triggered — non-design |
| Parallel-Lane Cut | already a fan-out lane; inside the lane `serial — shared layer`: the SOP's Escalation rows depend on the script's exit-code table, the history move must precede the rewrite |
| Scope Decision | non-design (not gated); `scope_decision: "single-feature"` set anyway per the human ruling "one lane, one feature" |
| Resource Audit | grep of the E394 row and the manifest for `http(s)://`, figma, sketch, mockup, 設計圖, URL, link, see, Azure DevOps, JIRA: zero external references; `external_refs` omitted |
| Source-Credibility | not applicable — no fetch-based design |
| Question Batch | no-op — zero open questions; derived constraints listed above for pre-review |
| Ambiguity | none load-bearing |
| Cut-Approval | Task-dispatched: cut presented in the final reply; `cut_approved` not set; mailbox pre-review first (lane-protocol §5-2), then human approval in the lane session |
| Manifest-Tier Self-Attestation | `.current/.config.json` `cutApprovalAutoTier` has no `manifest: true` → not eligible |
| needs human ruling | none |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E394-01 | architect: failure-class contract (exit-code table, class prefixes), phase split + inputs, dry-run and runner seam, absorption table, 69-id lesson table, narrative-unit list for the history move, SOP outline within 15,000 bytes (~450 lines) | none | 1 | `specs/e394-release-sop-rewrite-architecture.md` | — |
| T-E394-02 | sr: `release.mjs` skeleton — CLI, phases, `--dry-run` recorder, array-argv runner seam, exported exit table, preconditions (branch, unrelated-changes scope rule, `check-version.mjs` call) (~220 lines) | T-E394-01 | 1 | `scripts/release.mjs` | — |
| T-E394-03 | sr: step 7a evidence archive in Node (~260 lines) | T-E394-02 | 1 | `scripts/release.mjs` | — |
| T-E394-04 | sr: steps 7b–7d drift baseline, backlog done-mark + `check-bookkeeping.mjs`, adapter stamps + `agc check` (~160 lines) | T-E394-03 | 1 | `scripts/release.mjs` | — |
| T-E394-05 | sr: step 8a staging list + pre-filter, feature-dir and root-file completeness, CHANGELOG citation check (~220 lines) | T-E394-04 | 1 | `scripts/release.mjs` | — |
| T-E394-06 | sr: step 8a post-commit spec classes, commit, push, `gh pr create` (~200 lines) | T-E394-05 | 1 | `scripts/release.mjs` | — |
| T-E394-07 | sr: `publish` phase 8b–9a — CI gate, tag-exists stop, merge, ff pull + oid assert, tag, release, self-check (~260 lines; `verify-release.mjs` only if the architecture names an export) | T-E394-06 | 1–2 | `scripts/release.mjs`、`scripts/verify-release.mjs` | — |
| T-E394-08 | sr: `close-out` phase 13a–13b (~180 lines) | T-E394-07 | 1 | `scripts/release.mjs` | — |
| T-E394-09 | sr: move narratives verbatim to the history file with provenance header (~200 lines moved text) | T-E394-08 | 1 | `specs/release-sop-history.md` | — |
| T-E394-10 | sr: rewrite the skill whole, ≤ 15,000 bytes (~130 lines) | T-E394-09 | 1 | `content/skill-release-engineer.md` | — |
| T-E394-11 | qa: new script test — contract, dry-run, verb allow-list, phases, S-class lessons | T-E394-10 | 1 | `test/e394-release-script.test.mjs` | — |
| T-E394-12 | qa: re-pin release-staging (executed fragments → script; prose → SOP/history) | T-E394-10 | 1 | `test/release-staging.test.mjs` | — |
| T-E394-13 | qa: re-pin group A. feature-lease: Cross-lane boundary: the two `Example reply suffix: … — @release-engineer (haiku)` assertion blocks (base lines 1533–1540 and 1680–1687) belong to lane e392 (its qa deletes them with template lines 24–25); this lane does not touch them and adds no example-line assertion. | T-E394-10 | 6 | `test/feature-lease.test.mjs`、`test/e18-write-provenance.test.mjs`、`test/verify-release.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e336-portable-pull.test.mjs`、`test/e297-main-protected-sop.test.mjs` | — |
| T-E394-14 | qa: re-pin group B (e295, skill-evolution expected unedited; qa-flow comment only) | T-E394-10 | 6 | `test/render-structure.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/e164-e167-content.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/skill-evolution-v3.11.test.mjs`、`test/qa-flow.test.mjs` | — |
| T-E394-15 | qa: new SOP test — structure, size, rules, Escalation bijection, history anchors, 69-id meta-assertion | T-E394-10 | 1 | `test/e394-release-sop.test.mjs` | — |
| T-E394-16 | qa: hard conditions H1–H8, full suite under test-lock on final HEAD, evidence | T-E394-11, T-E394-12, T-E394-13, T-E394-14, T-E394-15 | 0 | — | — |
