# e444-claude-local-adapter

Spec source: `docs/backlog.md` row E444 (items (1)–(8), acceptance, test impact, out of scope) and the human rulings 1–3 at the end of `docs/agc-feedback-2026-11-20-tracked-claude-md.md`. Plan row: `specs/fanout-v5-w3.md` (lane e444, mini-chain sr-engineer → code-reviewer → qa-engineer, no architect hop). Base: `5f50af1`.

## Problem Statement

In an adopter repo whose `CLAUDE.md` is a shared, tracked team file, `agc init` always upserts the agc adapter block into it (`bin/agc-init.mjs` `ADAPTERS`: `CLAUDE.md` is `mode: "upsert"`, no other target). `--artifacts=local` does not cover the block, and an exclude rule has no effect on a tracked file. Adopters hide the block with `git update-index --skip-worktree CLAUDE.md`, which later makes `git pull` fail while `git status` and `git diff` are empty; `agc check` does not detect the flag, `agc eject` does not mention it, and the agent cannot clear it (`git update-index` is not on the Constitution §6 list). Claude Code loads `CLAUDE.local.md` beside `CLAUDE.md` (appended after it at the same level, not git-ignored by default — Claude Code memory docs, quoted in the feedback file), so the block works the same there. This ticket lets `agc init` place the block in `CLAUDE.local.md` (kept out of git via the shared `info/exclude`), makes `check`, `eject` and `feature start` aware of that file and of the index flags, and documents the setup.

## User Stories

- As an adopter whose `CLAUDE.md` is a team file, I want `agc init` to put the agc block in `CLAUDE.local.md` on first install, so that my teammates never see agc in their diff and I never need skip-worktree.
- As an existing adopter whose `CLAUDE.md` already holds the block, I want a re-run of `agc init` on upgrade to behave exactly as before, so that nothing moves without my say-so.
- As an adopter who already hid `CLAUDE.md` with skip-worktree or assume-unchanged, I want `agc check` and `agc eject` to name the flag and the command that clears it, so that a blocked `git pull` is diagnosed in one line.
- As a lane user in `local` adapter mode, I want `agc feature start` to bring my `CLAUDE.local.md` into the new lane, so that the lane still loads the governance block.

## Decisions

- **(a) Exclude-rule constant.** The `/CLAUDE.local.md` rule lives in a new constant `ADAPTER_LOCAL_EXCLUDE_RULES = ["/CLAUDE.local.md"]`, separate from `ARTIFACT_EXCLUDE_RULES`, and is anchored to the workspace prefix through the existing `artifactExcludeRulesForPrefix(prefix, baseRules)` parameter. `test/e351-lane-protocol-gaps.test.mjs` AC-E351-5 is therefore not edited and stays green. Why the separate constant is also the correct design, not just the cheap one: (1) `checkArtifactsDrift` keys repo-mode drift on `ARTIFACT_EXCLUDE_RULES`, so a shared constant would report `--artifacts=repo --adapter=local` as drift and would demand the rule in local mode even with a `shared` adapter; (2) `ejectPathClasses` turns every `ARTIFACT_EXCLUDE_RULES` entry into a class (i)/(ii-b) path that eject deletes wholesale, which would delete a `CLAUDE.local.md` that also holds the user's own notes. The adapter's placement is independent of the artifacts mode, so it gets its own rule list.
- **(b) README.** `README.md` lines 33–36 are not changed. With ruling 1 (B') the first-install default already picks `local` for the case the ticket targets, so the Quick Start command needs no flag; the new `docs/install.md` section is the reference, and the README comment there already points to `docs/install.md`. Not touching `README.md` also keeps this lane clear of e432's `README.md` lines 69 and 232.
- **(c) Task split.** Four sr-engineer tasks, each within the `task_size` budget (≤ 5 files / 300 lines): T-E444-01 init, T-E444-02 check, T-E444-03 eject, T-E444-04 feature start + docs; then one qa-engineer task T-E444-05. Execution order is the id order (each later task reuses helpers introduced by an earlier one). Tests are written only by qa-engineer (repo addendum §2).
- **(d) AC trace.** Every AC below names the ticket item and the acceptance sentence it implements; qa's test file carries one test per AC id.
- **(e) When the one-line suggestion prints (item 4).** It prints only when this run newly adds the block to a `CLAUDE.md` that git tracks (`writeClaudeBlock` result `appended`), in any artifacts mode. It does not print when the block is updated in place: ruling 1 says an existing adopter's re-run behaves exactly as today, which includes its output. In artifacts mode `repo` the written files are the same as before this ticket; the only difference is this one stderr line (item 4 is unconditional in the ticket).
- **(f) Which files the index-flag advisory covers (items 5, 6).** `CLAUDE.md` and `CLAUDE.local.md` only. `AGENTS.md` and `.antigravityrules` stay as they are (ruling 3).
- **(g) Lane copy guard (item 7).** `feature start` copies the primary's `CLAUDE.local.md` only when the lane has no file at that path and git ignores `CLAUDE.local.md` in the lane (`git check-ignore -q`, same guard as the `.current/.config.json` copy). An unignored copy would show as untracked in the lane and make `finish` refuse to remove the worktree. When the primary has the file but git does not ignore it, nothing is copied and one warning line says how to add the rule. The copy is from the repo root to the lane root, like `.env`. No lane-paths call is added to `bin/agc-init.mjs`, and `LANE_EXCLUDE_RULES` is not changed (`test/e108-eject.test.mjs` AC14 pins it, and eject would otherwise remove a lane rule).
- **(h) "`git status` shows no change" in the first acceptance sentence.** Read together with ruling 3: `agc init` still creates `AGENTS.md` and `.antigravityrules` untracked when they are absent, as today. The AC is therefore checked as: `git status --porcelain` lists no entry for `CLAUDE.md`, `CLAUDE.local.md`, `.current/`, `tasks.md`, `qa_reports/` or `review_reports/`; the proof fixture commits `AGENTS.md` and `.antigravityrules` beforehand so the whole porcelain output is empty.
- **(i) Stale-check rule (item 5).** "Holds a block" means the file contains `<!-- BEGIN agc-adapter -->` followed later by `<!-- END agc-adapter -->` (the same test `writeClaudeBlock` uses). If `CLAUDE.md` or `CLAUDE.local.md` holds a block, the stale check reads exactly the file(s) that hold one. If neither does, `CLAUDE.md` is checked exactly as today (a stamp anywhere in the file, `(none)` otherwise) and `CLAUDE.local.md` is ignored. This keeps today's results for every workspace without `CLAUDE.local.md`, including the bare-stamp fixtures in `test/e234-hygiene-scan.test.mjs` and `test/e258b-comment-scan.test.mjs`.
- **(j) Default when only `CLAUDE.local.md` holds the block (human ruling 2026-11-20, lane session, after integrator pre-review).** With no `--adapter`, if `CLAUDE.local.md` holds a block and `CLAUDE.md` does not, `local` is chosen in every artifacts mode and git state, before the four first-install conditions are tested. Same principle as ruling 1: a re-run keeps the block where it already is. Example: an adopter installs with `agc init --artifacts=repo --adapter=local`, then re-runs `agc init` with no flag on upgrade; the block in `CLAUDE.local.md` is updated in place and the tracked `CLAUDE.md` is untouched (the literal four-condition rule would have appended the block to `CLAUDE.md`). Implemented as task T-E444-06; proof AC2b.
- **(k) Eject keeps the `/CLAUDE.local.md` exclude line when it keeps the file (human ruling 2026-11-20, lane session, review note R3, integrator-recommended).** When eject removes the block from a `CLAUDE.local.md` that still holds the user's own content, the file stays and so does its prefix-anchored exclude line; the plan prints one extra line saying the line is kept because the file still holds the user's notes, and how to remove it by hand. When the file held only the block it is deleted and the line is removed as before. The same holds when `CLAUDE.local.md` holds no agc block at all (the user's own file, which eject leaves untouched): the line is kept and the plan says so (added during T-E444-07, integrator-accepted as the same reason, more conservative). Reason: the ticket exists to keep private content out of the team repo; dropping the rule while keeping the notes makes the file untracked, so the next `git add -A` would commit them. Example: install with `--adapter=local`, add notes to `CLAUDE.local.md`, run `agc eject --yes` → block removed, notes and exclude line kept, `git status` shows nothing new. Implemented as task T-E444-07; proof AC12 (amended).
- **(l) Refusal wording when `local` was not passed (human ruling 2026-11-20, lane session, review note R2).** When the placement is `local` only because of decision (j) (no `--adapter` given) and the workspace path has an unsafe segment, the refusal does not say `refusing --adapter=local`; it says `local` was picked because `CLAUDE.local.md` already holds the agc block, names the unsafe segment, and suggests renaming the directory or moving the block. Exit code 2 and "writes nothing" are unchanged; the explicit-flag refusal keeps its existing text. Implemented as task T-E444-07; proof AC7b.
- **Human approval (2026-11-20, lane session).** The cut was approved after the integrator's pre-review; decisions (e) and (h) were ruled as written above (the integrator recommended both).
- **SQLite / schema / dist.** Not applicable: `bin/agc-init.mjs` is plain `.mjs` with no `dist/` output; no `content/**`, `templates/**` (block text unchanged), `tools/**`, `gates/**` or `schema/**` change, so no compose golden, budget cap or schema version moves.

## Acceptance Criteria

The proof file name is qa's call; `test/e444-claude-local-adapter.test.mjs` is the proposed name and is used below. Each fixture is a scratch git repo with a local identity, as in `test/e106-init-artifacts-flag.test.mjs`.

### T-E444-01 — `agc init --adapter=shared|local` (items 1–4)

- **AC1 (item 1, item 2; acceptance 1)** — Given a git repo with a tracked `CLAUDE.md` holding no agc block, tracked `AGENTS.md` and `.antigravityrules`, and no `"artifacts"` declared, when `agc init` runs with no `--adapter`, then `CLAUDE.local.md` holds the block stamped with the installed version, `CLAUDE.md` is byte-identical, the shared `info/exclude` holds the line `/CLAUDE.local.md`, stdout holds `agc init — added /CLAUDE.local.md to the shared info/exclude`, and `git status --porcelain` is empty (decision (h)).
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC1`.
- **AC2 (item 2; acceptance 2)** — Given a tracked `CLAUDE.md` that already holds the block (stamped with an older version), when `agc init` runs with no `--adapter`, then the block in `CLAUDE.md` is updated in place to the installed version, no `CLAUDE.local.md` exists, no `/CLAUDE.local.md` line is in `info/exclude`, and stderr carries neither the item-4 suggestion nor the item-3 notice.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC2`.
- **AC2b (decision (j))** — Given a git repo with a tracked block-less `CLAUDE.md`, artifacts mode `repo`, and `CLAUDE.local.md` holding the block stamped with an older version (as left by `agc init --artifacts=repo --adapter=local`), when `agc init` runs with no `--adapter`, then the block in `CLAUDE.local.md` is updated in place to the installed version, `CLAUDE.md` is byte-identical, `/CLAUDE.local.md` is in `info/exclude`, and stderr carries neither the item-4 suggestion nor the item-3 notice. Given both files holding a block, the existing rule applies unchanged (`CLAUDE.md` holds a block → `shared`).
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC2b`.
- **AC3 (item 2; acceptance 3)** — Given each of (i) artifacts mode `repo` with a tracked block-less `CLAUDE.md`, (ii) an untracked `CLAUDE.md`, (iii) no `CLAUDE.md`, (iv) a directory that is not a git repo, (v) a tracked `CLAUDE.md` whose artifact paths are already tracked and undeclared (mode resolves to "ask"), when `agc init` runs with no `--adapter`, then the block is written to `CLAUDE.md` exactly as before this ticket, no `CLAUDE.local.md` is created and no `/CLAUDE.local.md` exclude line is written. (In (i) stderr also carries the item-4 suggestion — decision (e).)
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC3`.
- **AC4 (item 3, ruling 2; acceptance 4)** — Given a tracked `CLAUDE.md` holding the block, when `agc init --adapter=local` runs, then `CLAUDE.local.md` holds the block, `CLAUDE.md` is byte-identical, `/CLAUDE.local.md` is in `info/exclude`, and stderr holds string `init.adapter-removal-notice` verbatim.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC4`.
- **AC5 (item 4; acceptance 5)** — Given the AC1 fixture, when `agc init --adapter=shared` runs, then the block is appended to `CLAUDE.md`, no `CLAUDE.local.md` is created, no git command beyond the read-only ones is run (the index is unchanged: `git diff --cached` is empty), and stderr holds string `init.tracked-suggestion` exactly once. Given the same fixture after that run, a second `agc init` (no flag) updates the block in place and does not print the suggestion again.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC5`.
- **AC6 (item 1)** — Given any directory, when `agc init --adapter=foo` (or `--adapter` with no value) runs, then it exits 2, stderr holds string `init.adapter-invalid` and nothing is written. `--adapter local` (space form) behaves like `--adapter=local`.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC6`.
- **AC7 (item 1, subdirectory + outside git)** — Given a workspace in subdirectory `sub/` of a repo, when `agc init --adapter=local` runs there, then `sub/CLAUDE.local.md` holds the block and the exclude line is `/sub/CLAUDE.local.md`. Given a directory outside git, `--adapter=local` writes `CLAUDE.local.md`, exits 0 and stderr holds string `init.adapter-no-git`. Given a subdirectory whose name holds a character unsafe for an exclude rule, `agc init --artifacts=repo --adapter=local` exits 2 with string `init.adapter-unsafe-segment` and writes nothing.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC7`.
- **AC7b (decision (l))** — Given a git workspace in a subdirectory whose name holds a character unsafe for an exclude rule, a tracked block-less `CLAUDE.md` and a `CLAUDE.local.md` holding the block, when `agc init` runs with no `--adapter`, then it exits 2, writes nothing, and stderr holds string `init.adapter-unsafe-segment-implicit` (it does not contain `refusing --adapter=local`).
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC7b`.

### T-E444-02 — `agc check` (item 5)

- **AC8 (item 5; acceptance 6a)** — Given a tracked `CLAUDE.md` with no block and no stamp, and `CLAUDE.local.md` holding the block at the installed version, when `agc check` runs, then it exits 0 and stdout holds `agc check — OK (<version>) — all adapters current`. Given the same with `CLAUDE.local.md` stamped with an older version, it exits 1 and stderr names `CLAUDE.local.md` as the stale adapter.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC8`.
- **AC9 (item 5; acceptance 6b)** — Given both `CLAUDE.md` and `CLAUDE.local.md` holding a current block, when `agc check` runs, then stderr holds string `check.adapter-duplicate` and the exit code is 0.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC9`.
- **AC10 (item 5; acceptance 7a)** — Given a tracked `CLAUDE.md` holding a current block and flagged `git update-index --skip-worktree`, when `agc check` runs, then stderr holds string `check.flag-skip-worktree` for `CLAUDE.md` and the exit code is 0; given the flag cleared and `--assume-unchanged` set instead, stderr holds `check.flag-assume-unchanged` and the exit code is 0; given a stale block plus a flag, the exit code is 1 (the stale result, unchanged by the advisory).
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC10`.
- **AC11 (item 5, no regression)** — Given a workspace with no `CLAUDE.local.md` (every fixture in the existing check tests), `agc check`'s stdout, stderr and exit code are the same as at base; outside git, or when git fails, the flag advisory prints nothing.
  proof: `node scripts/test-lock.mjs -- npm test` — every existing `agc check` test stays green.

### T-E444-03 — `agc eject` (item 6)

- **AC12 (item 6; acceptance 8)** — Given a workspace initialised with `--adapter=local` where `CLAUDE.local.md` holds only the block, when `agc eject` runs, then the dry-run plan holds `(iii) host traces — CLAUDE.local.md: REMOVE adapter block (file will be deleted, holds only the block)` and the exclude entry names the `/CLAUDE.local.md` line (string `eject.exclude-with-adapter`); under `--yes` the file is gone and `info/exclude` no longer holds `/CLAUDE.local.md`, while every other line keeps its bytes. Given `CLAUDE.local.md` with the user's own notes plus the block, the block is removed, the notes are kept, the `/CLAUDE.local.md` exclude line is kept (decision (k)), the plan names the kept line and how to remove it by hand (string `eject.adapter-rule-kept`), and after `--yes` `git status --porcelain` lists no `CLAUDE.local.md`.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC12`.
- **AC13 (item 6; acceptance 7b)** — Given a tracked `CLAUDE.md` flagged skip-worktree (and, separately, assume-unchanged), when `agc eject` runs (dry-run and `--yes`), then the cannot-do block holds item 5 (string `eject.cannot-do-flags`) with the matching `git update-index --no-skip-worktree CLAUDE.md` / `--no-assume-unchanged CLAUDE.md` line; with no flag set, the cannot-do block is byte-identical to base (four items).
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC13`.

### T-E444-04 — `agc feature start` + docs (items 7, 8)

- **AC14 (item 7; acceptance 9)** — Given a primary checkout initialised with `agc init` (default → `local`, so `/CLAUDE.local.md` is excluded) and holding an untracked `CLAUDE.local.md`, when `agc feature start <slug>` creates a lane, then the lane's `CLAUDE.local.md` is byte-identical to primary's, stdout holds string `feature.copied-claude-local`, and the lane's `git status --porcelain` is empty. Given a primary with no `CLAUDE.local.md`, nothing is copied and no such line is printed. Given a primary `CLAUDE.local.md` that git does not ignore, nothing is copied and stderr holds string `feature.claude-local-not-ignored`.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC14`.
- **AC15 (item 8; acceptance 10)** — Given `docs/install.md`, then it has a section for repos where `CLAUDE.md` is a team file that names `--adapter=shared|local`, says `--artifacts` does not cover the adapter block, states the first-install default (git repo, tracked `CLAUDE.md`, artifacts `local`, no block in `CLAUDE.md`), and gives the reason not to use skip-worktree (`git pull` fails while `git status` / `git diff` are empty). The eject host-traces row, the cannot-do list and the `feature start` env-bootstrap list mention `CLAUDE.local.md`.
  proof: `test/e444-claude-local-adapter.test.mjs` test `AC15`.
- **AC16 (scope guards)** — `bin/agc-init.mjs` has no new lane-paths call (`test/lane-paths.test.mjs` stays green unedited); `ARTIFACT_EXCLUDE_RULES` and `LANE_EXCLUDE_RULES` are unchanged; the `check` subcommand name and arguments are unchanged (`test/e394-release-script.test.mjs`, `test/release-staging.test.mjs` green unedited); `templates/**`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules` and `dist/**` have no diff.
  proof: `git diff --stat 5f50af1 -- templates CLAUDE.md AGENTS.md .antigravityrules dist tools gates schema content` prints nothing, and `node scripts/test-lock.mjs -- npm test` is green.

### T-E444-05 — qa

- **AC17** — The full suite passes with no unexplained red: `node scripts/test-lock.mjs -- npm test` (baseline at base `5f50af1`: 4448/4450 pass, 0 fail, 2 skipped; the new file adds to the total).
  proof: `node scripts/test-lock.mjs -- npm test`.

## Copy / Strings

All strings are `authored-here` unless noted: the ticket fixes behaviour, not wording; each line follows the existing `agc init —` / `agc check —` / `agc feature start —` prefixes so callers can grep them. `${…}` is filled at run time; `<rule>` is the prefix-anchored rule (`/CLAUDE.local.md` or `/sub/CLAUDE.local.md`).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| init.usage-line | `  init [--artifacts=local\|repo] [--adapter=shared\|local]` (replaces the first line of the `init` entry in `STR_USAGE`) | authored-here — names the new flag in the usage text |
| init.usage-adapter | `          --adapter=local puts CLAUDE.md's agc block in CLAUDE.local.md\n          instead, kept out of git via .git/info/exclude. With no flag,\n          local is picked only on a first install into a tracked CLAUDE.md\n          with local artifacts — see docs/install.md.\n` (inserted before the `  check` entry of `STR_USAGE`) | authored-here — one usage paragraph per flag, like `--artifacts` |
| init.adapter-invalid | `agc init: --adapter must be "shared" or "local" (got ${JSON.stringify(value)})` | authored-here — mirrors the existing `--artifacts` usage error |
| init.adapter-unsafe-segment | `agc init: refusing --adapter=local — workspace path segment "${escapeSegmentForDisplay(seg)}" contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character), so the exclude rule agc would write could match unintended files or be split across lines. Rename the directory, or re-run with --adapter=shared.` | authored-here — mirrors the `--artifacts=local` refusal |
| init.adapter-exclude-added | `agc init — added ${added.join(", ")} to the shared info/exclude` (stdout; its own line, printed after the artifacts line) | existing template in `runInit`, reused |
| init.adapter-no-git | `agc init — note: not inside a git repository — skipped .git/info/exclude for CLAUDE.local.md` (stderr) | authored-here — mirrors the artifacts outside-git note |
| init.adapter-removal-notice | `agc init — note: CLAUDE.md still holds an agc adapter block; the block was also written to CLAUDE.local.md. agc init does not edit CLAUDE.md: delete the lines from "<!-- BEGIN agc-adapter -->" to "<!-- END agc-adapter -->" there by hand and commit that change.` (stderr) | ruling 2 (wording authored-here) |
| init.tracked-suggestion | `agc init — note: CLAUDE.md is tracked by git, so the agc adapter block just added to it shows in the team's diff — to keep the block out of git, use agc init --adapter=local (see docs/install.md)` (stderr, one line) | item 4 (wording authored-here) |
| check.adapter-duplicate | `agc check — adapter block found in both CLAUDE.md and CLAUDE.local.md — Claude Code loads both files, so the block is read twice; remove it from one of them` (stderr) | item 5 (wording authored-here) |
| check.flag-skip-worktree | `agc check — ${rel} is flagged skip-worktree in the git index: git status and git diff hide its local changes, and git pull stops with "local changes would be overwritten" once upstream changes it — clear the flag with: git update-index --no-skip-worktree ${rel}` (stderr) | item 5 (wording authored-here) |
| check.flag-assume-unchanged | `agc check — ${rel} is flagged assume-unchanged in the git index: git status and git diff hide its local changes, and git pull can stop with "local changes would be overwritten" once upstream changes it — clear the flag with: git update-index --no-assume-unchanged ${rel}` (stderr) | item 5 (wording authored-here) |
| eject.claude-local-lines | the four existing `planClaudeBlockEntry` line forms with `CLAUDE.local.md` (prefix-anchored display) in place of `CLAUDE.md` | existing strings, reused |
| eject.exclude-with-adapter | dry-run: `(iii) host traces — .git/info/exclude: REMOVE ${a} artifact exclude line(s) and the ${rule} line`, or `… REMOVE the ${rule} line` when `a` is 0; applied: same with `removed` in place of `REMOVE`. When the adapter rule is not present the existing text is unchanged. | authored-here — keeps today's line byte-identical when there is no adapter rule |
| init.adapter-unsafe-segment-implicit | refusal for the decision (j) case: says `local` was picked because `CLAUDE.local.md` already holds the agc block, names the unsafe segment (same display escaping), and suggests renaming the directory or moving the block; never the text `refusing --adapter=local` | authored-here (T-E444-07) |
| eject.adapter-rule-kept | one plan line (dry-run and applied forms) saying the `${rule}` exclude line is kept because `CLAUDE.local.md` still holds the user's notes, and that it can be removed by hand from the shared `info/exclude` | authored-here (T-E444-07) |
| eject.cannot-do-flags | `  5. Clear git index flags: the adapter file(s) below are flagged in the git index, and git pull can fail on them until the flag is cleared. agc never runs git update-index:\n` followed by one `       git update-index --no-skip-worktree ${rel}\n` or `       git update-index --no-assume-unchanged ${rel}\n` line per flag (appended to the cannot-do block only when a flag is set) | item 6 (wording authored-here) |
| feature.copied-claude-local | `agc feature start — copied CLAUDE.local.md from the primary checkout (bytes only; contents never read)` (stdout) | mirrors the `.env` copy line |
| feature.claude-local-not-ignored | `agc feature start — warning: CLAUDE.local.md in the primary checkout is not ignored by git, so it was not copied into the lane (it would show as untracked there) — run agc init --adapter=local in the primary checkout to add the exclude rule` (stderr) | authored-here — decision (g) |
| feature.usage | `STR_USAGE_FEATURE`: the line `.current/.config.json nodeModulesLinks), .env byte-copied.` stays verbatim (pinned by `test/e291-start-link-locations.test.mjs` and `test/e217-abandoned-specs-harvest.test.mjs`); the sentence `An ignored CLAUDE.local.md is byte-copied the same way (agc init --adapter=local).` follows the `.current/.config.json` sentence (amended 2026-11-20 to match the shipped text, integrator-accepted); the sentence `is not numbered — finish warns, lists its findings and keeps a copy under .current/history/<YYYY-MM>/<lane>/` stays verbatim (AC-E351-5) | authored-here |
| docs.install-section | `docs/install.md` heading `### When CLAUDE.md is a team file: \`agc init --adapter=shared\|local\`` (placed after the `--artifacts` section) | item 8 (wording authored-here) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | CLI and docs only; no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Tasks

| id | role | files | what | AC |
|---|---|---|---|---|
| T-E444-01 | sr-engineer | `bin/agc-init.mjs` | `parseInitArgs` gains `--adapter` (`=value` and space forms, validated before any write); `ADAPTER_LOCAL_EXCLUDE_RULES`; placement resolution in `runInit` (explicit flag, else B' default: repo, `CLAUDE.md` tracked via `trackedArtifactPaths`, effective mode `local`, `CLAUDE.md` holds no block); unsafe-segment refusal for `local`; `writeClaudeBlock` takes the target file name; `local` → exclude upsert (own notice line) or outside-git note, block to `CLAUDE.local.md`, removal notice when `CLAUDE.md` holds a block; `shared` + `appended` + tracked → suggestion; `STR_USAGE` lines. ~130 lines | AC1–AC7 |
| T-E444-02 | sr-engineer | `bin/agc-init.mjs` | `runCheck`: block-holder resolution for the `CLAUDE.md` / `CLAUDE.local.md` pair (decision (i)), duplicate advisory; one helper `adapterIndexFlags(cwd)` reading `git ls-files -v -- CLAUDE.md CLAUDE.local.md` (tag `S`/`s` = skip-worktree, any lowercase tag = assume-unchanged; silent outside git or on git failure) and the flag advisories; exit code unchanged by every new line. ~80 lines | AC8–AC11 |
| T-E444-03 | sr-engineer | `bin/agc-init.mjs` | `planClaudeBlockEntry` takes the file name and runs for `CLAUDE.md` then `CLAUDE.local.md`; `planExcludeEntry` also removes the prefix-anchored `ADAPTER_LOCAL_EXCLUDE_RULES` line with the new wording; `ejectCannotDoBlock(flags)` appends item 5 from `adapterIndexFlags` when any flag is set (also on the nothing-to-eject path). ~70 lines | AC12–AC13 |
| T-E444-04 | sr-engineer | `bin/agc-init.mjs`, `docs/install.md` | `bootstrapLaneEnv`: copy `CLAUDE.local.md` (decision (g), `COPYFILE_EXCL`, no lane-paths call); `STR_USAGE_FEATURE` wording; `docs/install.md`: new team-file section (item 8), the `agc check` paragraph names the two new advisories, the `feature start` bootstrap list, the eject host-traces row and the cannot-do list ("four items" plus the conditional fifth). ~40 code + ~45 doc lines | AC14–AC16 |
| T-E444-06 | sr-engineer | `bin/agc-init.mjs`, `docs/install.md` | decision (j): placement resolution picks `local` when `CLAUDE.local.md` holds a block and `CLAUDE.md` does not, before the B' conditions; one sentence in the `docs/install.md` team-file section. Added 2026-11-20 after the human ruling; executes after T-E444-04 | AC2b |
| T-E444-07 | sr-engineer | `bin/agc-init.mjs`, `docs/install.md` | decision (k): eject keeps the adapter exclude line when it keeps `CLAUDE.local.md`, plus the `eject.adapter-rule-kept` line; decision (l): `init.adapter-unsafe-segment-implicit` refusal text for the (j) case; docs eject row and team-file section follow. Added 2026-11-20 after the human ruling (review notes R3, R2) | AC7b, AC12 |
| T-E444-05 | qa-engineer | `test/e444-claude-local-adapter.test.mjs` (name is qa's call), `qa_reports/` | one test per AC1–AC15, AC2b and AC7b using scratch git repos; full suite via `node scripts/test-lock.mjs -- npm test`; confirm the red list below (expected: none) | AC1–AC17 |

`depends_on`: T-E444-02 ← 01; T-E444-03 ← 01, 02 (reuses `adapterIndexFlags` and the exclude constant); T-E444-04 ← 01, 02, 03 (docs describe all three); T-E444-06 ← 01, 04; T-E444-07 ← 03, 06; T-E444-05 ← 01–04, 06, 07.

## Test impact

Probe at base `5f50af1` (full suite, `node scripts/test-lock.mjs -- npm test`, 2026-11-20): 4450 tests, 4448 pass, 0 fail, 2 skipped, exit 0. No base red.

Grep (literal and regex) over `test/` for every pin on what this ticket changes — `ADAPTERS`, `ARTIFACT_EXCLUDE_RULES`, `LANE_EXCLUDE_RULES`, `STR_USAGE*`, the exclude-notice and cannot-do texts, `docs/install.md`, `bin/agc-init.mjs` source reads — gives the files below. Expected red after T-E444-01..04, if the implementation follows this spec: **none**. Every new output line is conditional on a state no existing fixture builds (a `CLAUDE.local.md`, a tracked block-less `CLAUDE.md` passed through `agc init` in local mode, an index flag, an `--adapter` flag).

| test file | what it pins | expected | owned |
|---|---|---|---|
| `test/e351-lane-protocol-gaps.test.mjs` (AC-E351-5) | `ARTIFACT_EXCLUDE_RULES` exactly four rules; `STR_USAGE_FEATURE` sentence | green (decision (a); the sentence is kept) | owned (E444 test surface) |
| `test/agc-adapters.test.mjs` | init buckets, upsert idempotency, stamp form, check OK / stale, usage regex, `RESEARCH_BINARY_RE` source read | green (non-git temp dirs → `shared`) | owned |
| `test/e106-init-artifacts-flag.test.mjs` | artifacts flag, exclude notices, check drift, AC11 lane rules | green (separate constant; no `CLAUDE.md` in fixtures) | owned |
| `test/e239-init-subdir-exclude.test.mjs` | prefix-anchored artifact rules | green | owned |
| `test/e108-eject.test.mjs` | plan lines, cannot-do block, AC14 `LANE_EXCLUDE_RULES` copy, tracked host traces | green (no flags or `CLAUDE.local.md` in fixtures; Case G commits a block-less `CLAUDE.md` after init and runs only eject) | owned |
| `test/e250-eject-path-escape.test.mjs` | subdirectory eject lines | green | owned |
| `test/e177a-check-cli.test.mjs` | check CLI exit codes / output | green | owned |
| `test/agc-feature-lifecycle.test.mjs` | feature start bootstrap, AC7 tracked `CLAUDE.md` sentinel, AC27/AC28 `docs/install.md` regexes, AC29 source comments | green (no primary `CLAUDE.local.md`; doc additions keep the matched words) | owned |
| `test/e429-lane-config-copy.test.mjs` | `.current/.config.json` lane copy | green | owned |
| `test/p0-onboarding-lite-default.test.mjs` | init scaffold bytes | green (non-git temp dirs) | owned |
| `test/e291-start-link-locations.test.mjs` | copies `bin/agc-init.mjs` into a fake install | green (no new import; single file) | owned |
| `test/e234-hygiene-scan.test.mjs`, `test/e258b-comment-scan.test.mjs` | bare-stamp `CLAUDE.md` fixture + `agc check`; `docs/install.md` names scan categories | green (decision (i) keeps the no-block path as today) | owned |
| `test/e259-comment-scan-limits.test.mjs` | the `docs/install.md` paragraph containing "comment-length scan" | green (that paragraph is not edited) | owned |
| `test/e196-ignored-lane-state.test.mjs`, `test/e298-finish-remote-delete.test.mjs`, `test/e385-worktree-evidence.test.mjs` | read `bin/agc-init.mjs` source (call counts / absent strings in finish and check code) | green (those functions are not edited) | owned only if red because of this ticket |
| `test/lane-paths.test.mjs:270-296,333` | lane-paths callers under `bin/` | green (no new call) | **not owned — e432**; any red → needs-integrator |
| `test/e394-release-script.test.mjs:128,543`, `test/release-staging.test.mjs:1748` | run `bin/agc-init.mjs check` on this repo | green (subcommand unchanged; this repo has no `CLAUDE.local.md` and no flag) | **not owned — e432**; any red → needs-integrator |
| `test/e150-completed-tasks-carry-forward.test.mjs`, `test/e431-test-first-server-path.test.mjs` | mention "feature start(s)" in passing | green | **not owned — e432** |
| `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` | `content/**` text | green (no `content/**` change) | **not owned — shared** |

No needs-integrator item is expected. If qa or sr sees any not-owned file turn red, it mails the integrator and does not edit it.

## Out of Scope

- `AGENTS.md` and `.antigravityrules`: no local variant, no flag advisory (ruling 3).
- Removing an existing block from `CLAUDE.md` automatically (ruling 2): only the notice.
- The Constitution §6 wording that allows `pull --ff-only` only "on `main`" (raised in the same report, not ruled).
- Any lane-paths call in `bin/agc-init.mjs`; any change to `LANE_EXCLUDE_RULES` or `ARTIFACT_EXCLUDE_RULES`.
- An `agc check` advisory for a `CLAUDE.local.md` whose exclude rule is missing.
- Copying a subdirectory workspace's `CLAUDE.local.md` into a lane: `feature start` copies the repo-root file only, as it does for `.env`.
- `README.md` (decision (b)), `templates/**` (block text unchanged), release bookkeeping (version, CHANGELOG, backlog done-mark: integrator / release-engineer).

## Dependencies / Prerequisites

- None blocking: backlog `depends_on` is "—". Rulings 1–3 (human, 2026-11-20) are in `docs/agc-feedback-2026-11-20-tracked-claude-md.md`; the fan-out plan's pre-dispatch conditions (AC-E351-5, the `check` subcommand, no lane-paths call) are carried as AC16 and the test-impact table.
- External reference: the Claude Code memory documentation page (`code.claude.com/docs/en/memory.md`) on `CLAUDE.local.md` loading, quoted verbatim in the feedback file (read 2026-11-20). Recorded in `external_refs` as `fetched`.
- No design file; mode = no-design (Visual Structural Assertions omitted).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E444 | `agc init --adapter=shared\|local` with the B' first-install default (ruling 1), `CLAUDE.local.md` target + prefix-anchored `/CLAUDE.local.md` exclude rule in a separate constant, removal notice for an explicit `local` over an existing block (ruling 2), one-line suggestion when the block lands in a tracked `CLAUDE.md`; `agc check` block-in-either-file stale rule, duplicate advisory, skip-worktree / assume-unchanged advisories (exit code unchanged); `agc eject` covers `CLAUDE.local.md` and its exclude line, flagged files in the cannot-do list; `agc feature start` copies an ignored untracked `CLAUDE.local.md` into the lane; `docs/install.md` team-file section. `CLAUDE.md` only (ruling 3) | — | 2 source/docs + 1 new test file | `bin/agc-init.mjs`、`docs/install.md`、`test/e444-*.test.mjs`、`specs/e444-claude-local-adapter.md` | — |
