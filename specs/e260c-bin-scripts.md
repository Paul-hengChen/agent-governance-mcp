# e260c-bin-scripts

Lane e260c of the E260 fan-out (backlog row E260; lane table in `specs/fanout-e260.md`). Base commit b37178a, branch `feat/e260c-bin-scripts`.

## Problem Statement
The JS files under `bin/` and `scripts/` (19 files, all `.mjs`, not compiled) carry long comment blocks that predate the Comment discipline rule (constitution section 6, enforced as an `agc check` advisory by E258/E259). Re-measured at base with `analyzeText` from `dist/tools/comment-scan.js` (same counting as `agc check`): 58 blocks of 8-20 counted lines and 17 blocks over 20, longest 81 lines, in 17 of the 19 files. This lane trims them. Comments only; program behaviour must not change.

Per-file baseline (`mid` = 8-20 lines, `large` = over 20, `max` = longest block):

| file | mid | large | max |
|---|---|---|---|
| bin/agc-init.mjs | 30 | 7 | 61 |
| bin/agent-governance-context.mjs | 5 | 0 | 16 |
| bin/agent-governance-usage-hook.mjs | 0 | 1 | 24 |
| scripts/capture-constitution-golden.mjs | 1 | 1 | 43 |
| scripts/check-md-tables.mjs | 6 | 3 | 61 |
| scripts/check-transitions-sync.mjs | 0 | 1 | 37 |
| scripts/check-version.mjs | 2 | 0 | 9 |
| scripts/fanout.mjs | 1 | 0 | 13 |
| scripts/feature-rollup.mjs | 1 | 0 | 16 |
| scripts/join-precondition.mjs | 1 | 0 | 16 |
| scripts/lane-status.mjs | 1 | 0 | 15 |
| scripts/mailbox-watch.mjs | 0 | 1 | 46 |
| scripts/measure-context-cost.mjs | 2 | 0 | 16 |
| scripts/merge-invariants.mjs | 1 | 0 | 13 |
| scripts/summarize-metrics.mjs | 1 | 0 | 14 |
| scripts/test-lock.mjs | 1 | 1 | 48 |
| scripts/verify-release.mjs | 5 | 2 | 81 |
| total | 58 | 17 | 81 |

(`scripts/smoke-qa-flow.mjs` and `scripts/smoke-rag.mjs` already have no block of 8 or more lines.) Sums match the fan-out measurement: 58 mid, 17 large, longest 81.

## User Stories
- As a contributor reading `bin/` or `scripts/`, I want comments that state what and why in a few lines, so that I can read the code instead of paragraphs of history.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large trim without reading every hunk for logic.

## Acceptance Criteria
- **AC1 (behaviour invariance)** — Given every JS file under `bin/` and `scripts/` changed by this lane, when each is transpiled with TypeScript `transpileModule` and `removeComments: true` at base b37178a and at HEAD, then the two outputs are byte-identical per file.
  proof: `node .current/e260c/check-invariance.mjs` prints `invariance OK: <n> files` and exits 0.
- **AC2 (threshold met)** — Given the common threshold, when `analyzeText` re-measures every in-scope file, then no block has more than 20 counted lines, and every block of 8-20 counted lines is either trimmed to 7 or fewer, or has a one-line keep reason in `review_reports/` for that block.
  proof: `node .current/e260c/measure.mjs` lists blocks of 8 or more counted lines; `node .current/e260c/measure.mjs --fail-over 20` exits 0; the review report enumerates each remaining 8-20 block with its reason.
- **AC3 (rationale preserved)** — Given a comment holds reasoning still worth keeping, when it is trimmed, then the reasoning is moved into the "Kept rationale" section of this spec first and the comment keeps at most a one-line pointer (`see specs/e260c-bin-scripts.md`).
  proof: `grep -c 'e260c-bin-scripts' <file>` is at least 1 for each file that has a "Kept rationale" entry (reviewer cross-checks entries against the diff).
- **AC4 (no non-comment text touched)** — Given strings, usage text, CLI output, error messages and identifiers are behaviour, when the diff is inspected, then every added or removed line is a comment line or a blank line adjacent to one.
  proof: AC1 passes, and `git diff -U0 b37178a -- bin scripts | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*)'` prints nothing except trailing-comment tails, each listed and justified in the review.
- **AC5 (markers and styles kept)** — Given the `// Coded by @<role>` line, shebang lines, `/*!` blocks and comment styles are conventions, when the files are edited, then each is preserved and no `//` comment becomes `/* */` (or the reverse).
  proof: `git diff b37178a -- bin scripts | grep -E '^-(#!|// Coded by|/\*!)'` prints nothing; `git diff b37178a -- bin scripts | grep -E '^\+\s*/\*' | wc -l` is no greater than the count of removed `/*` lines.
- **AC6 (generic citations)** — Given a comment in scope whose only text is a ticket id, when this pass finishes, then it states the behaviour in words with the id as a trailing pointer.
  proof: reviewer samples 20 retained or rewritten comments; none is a bare id.
- **AC7 (hygiene)** — Given tracked files must not carry local paths, when the diff is added, then no added line contains an absolute home path or a worktree path.
  proof: `git diff b37178a | grep -E '^\+' | grep -E '/U[s]ers/|/h[o]me/'` prints nothing.
- **AC8 (scope containment)** — Given the owned-file list, when the branch diff is listed, then every changed path is under `bin/`, `scripts/`, `specs/e260c-`, `qa_reports/*E260C*`, `review_reports/*E260C*` or `.current/e260c/`.
  proof: `git diff --name-only b37178a | grep -vE '^(bin/|scripts/|specs/e260c-|qa_reports/.*E260C|review_reports/.*E260C|\.current/e260c/)'` prints nothing.
- **AC9 (suite green)** — Given the change is comment-only, when the full suite runs after the final commit with a clean tree, then it passes.
  proof: `node scripts/test-lock.mjs -- npm test` reports 0 failures (run by qa).

## Verification approach
Scripts live under `.current/e260c/` (tracked with the lane) and are written in T-E260C-01:
- `check-invariance.mjs [--base b37178a]`: lists `git diff --name-only <base> -- bin scripts` filtered to JS; for each, reads the base text with `git show <base>:<path>` and the working text, runs `ts.transpileModule(text, { compilerOptions: { removeComments: true, target: "ES2022", module: "ESNext" }, fileName: <path> })` (TypeScript from `node_modules`), and compares `outputText` byte for byte. Prints `invariance OK: <n> files` or each differing path, exit 1.
- `measure.mjs [--fail-over N]`: imports `analyzeText` from `dist/tools/comment-scan.js`; prints, per in-scope file, the `start:counted` of each block of 8 or more and totals (mid, large, longest). With `--fail-over N` exits 1 if any block exceeds N.
Some tests pin comment text in a few in-scope files; those pins are listed in the sr-engineer brief and the review report, not here. The full suite is the judge.
A trailing note: `check-invariance.mjs` is scoped to the changed files, so unchanged files pass trivially.

## Slicing
Tasks are cut so one sr-engineer session handles at most about 15 blocks and at most 5 files (task_size budget), never splitting a block across tasks. The eight small `scripts/` files are two tasks of four files each: T-E260C-10 (`fanout`, `feature-rollup`, `join-precondition`, `lane-status`) and T-E260C-09 (`mailbox-watch`, `measure-context-cost`, `merge-invariants`, `summarize-metrics`). `bin/agc-init.mjs` (3735 lines, 37 blocks) is split by line range at base: A = lines 1-900 (14 blocks), B = lines 901-2200 (15 blocks), C = lines 2201-end (8 blocks).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature adds no user-facing strings (string literals, CLI output and usage text are out of scope and must not change) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- CLI output and usage text (strings), any logic change, non-JS files (E259), `tools/`, `dist/`, `test/` and every other directory listed as forbidden in the lane table.
- `docs/backlog.md`, release bookkeeping (release-engineer).

## Dependencies / Prerequisites
E258 (done). No design file (mode = no-design), so Visual Structural Assertions are omitted. No external references found in the supplied requirement documents beyond in-repo paths. Pinned comment strings: none found in `test/` for `bin/` or `scripts/` at the fan-out check; the full suite is the final judge.

## Kept rationale
Appended by sr-engineer as blocks are trimmed: one entry per moved rationale, headed with file and a short topic, written in plain words. Empty at cut time.

### bin/agc-init.mjs — file header (usage summary)
- `agc init` is idempotent: most existing files are skipped as they are, but the CLAUDE.md adapter block and the `host` key of `.current/.config.json` (E100) are upserted in place.
- `--artifacts=local` keeps governance runtime artifacts out of git by adding rules to the shared `.git/info/exclude`, never to `.gitignore`. `--artifacts=repo` only records the config key. Without the flag the default is `local`, unless an artifact path is already tracked: then nothing is declared and the user is asked to choose. Tracked paths are reported together with the untrack command; the CLI never untracks them itself.
- `agc check` exits 1 only when a deployed adapter carries an older agc version stamp than the installed one. Its other checks only warn: a tracked binary under `research/` (E104), and, inside a linked worktree only, an evidence directory (`qa_reports/`, `review_reports/`, `specs/`) that is a real untracked directory instead of a symlink back to primary (E111), and a declared `artifacts` choice that is missing or disagrees with the repo's actual exclude and tracked state.
- `agc feature start` cuts a `feat/<ticket-slug>` branch plus a linked worktree from the primary checkout, with `node_modules` symlinked and `.env` copied byte for byte. `agc feature finish` tears it down with a merge guard (`--shipped`) or moves the evidence to `abandoned/` (`--abandoned`), and also removes the lane's default-location mailbox.
- `agc eject` prints the removal plan by default and applies it with `--yes`. Tracked paths are never removed; they are only named in a printed `git rm -r` line.

### bin/agc-init.mjs — atomicWriteFile: symlinks, dangling links, hardlinks
- Why atomic: a truncating in-place write interrupted by ^C, ENOSPC or a crash leaves the target empty or cut short. On a real `.config.json` that can silently drop hundreds of `driftBaselineIds`. CLAUDE.md requires tmp file plus rename for any governed artifact.
- Why resolve symlinks first (E102; the human decided on 2026-09-16 that symlinks are a supported layout and hardlinks are not): `renameSync` onto a symlink replaces the link itself with a detached regular file, because POSIX rename swaps a symlink destination instead of following it. The real file the link pointed at keeps its old content forever, and `agc check` then reports OK against the detached copy, so the failure looks like success. `checkWorktreeEvidence`'s `isSafelyLinkedOutside` is the earlier precedent for resolving and guarding a symlink.
- The ENOENT catch is defensive only. Every current caller checks `fs.existsSync` first, and `existsSync` is false for a dangling symlink just as for a missing path, so `realpathSync` never sees a dangling link today. The dangling case is handled earlier in `writeClaudeBlock`'s `!existsSync` branch, where `writeFileSync` follows the dangling link and creates the real file, leaving the link in place. The catch exists so a future caller that skips the guard fails loudly. Because a plain missing file gives the same ENOENT, `lstatSync` tells the two apart before the message is chosen, so the error never blames a symlink that is not there.
- Why hardlinks are out of scope: a hardlink is a second directory entry for the same inode, so there is no target to resolve and `renameSync` still breaks the second name silently. The only fix that would cover hardlinks is going back to a truncating in-place write, which brings back the interrupted-write risk on the far more common unlinked case. That risk is likelier and worse, so hardlinked adapter files are declared unsupported instead.

### bin/agc-init.mjs — upsertHostKey and spliceTopLevelKey
- At the time of writing this repo's own `.config.json` held 558 `driftBaselineIds` entries; a `JSON.stringify` round-trip would reformat all of them to add one key. The splice reuses the file's own indentation so key order, array formatting and unrelated whitespace stay byte-identical.
- `has-host` is never overwritten because a Cursor, Continue or Anti-Gravity workspace may legitimately declare a different host.
- `malformed` also covers the larger class where a `host`-shaped match exists but the reparse guard rejects the result, for example a nested `host` key that comes earlier in the text than the real top-level one, or a top-level array or object value with no other host-shaped scalar in the file.
- The reparse guard argument in full: before the splice the top-level value is known not to be a non-empty string. It may be absent, `""`, `null`, `false`, or a truthy non-string such as `42`, `{}` or `["x"]`, so it is not always falsy. After the splice it can only be a non-empty string if the splice hit the top-level occurrence, so any wrong-occurrence splice is rejected. Example of a wrong-occurrence shape that does match the regex: `{"host": [], "nested": {"host": "x"}}`.

### bin/agc-init.mjs — research/ binary advisory (E104)
- Origin: 33 third-party confidential screenshots sat under `research/assets/` in a public repo for about three months. `.gitignore` now excludes `research/assets/` and CONTRIBUTING.md documents the rule; this check is the mechanical backstop.
- The extension allowlist is the same one used to measure this repo's zero-tracked-binary baseline. Trade-off: an extensionless or exotic binary can slip through, but a large text or JSON fixture is never misread as binary. For an advisory, a missed catch is the acceptable side.
- Why only a warning: `agc check` runs in arbitrary adopter workspaces, and failing an unrelated release over a directory-name collision is worse than this repo missing a regression that review and dogfooding would also catch.
- `-z` also avoids a plain newline split breaking on a path with an embedded newline. With core.quotePath the C-quoted line ends in `"`, so the `$`-anchored regex silently misses exactly the localized-name client assets the check exists for. `ls-files` itself fails closed when git is missing, the directory is not a repo, or the repo has no commits, so no separate repo probe is needed.

### bin/agc-init.mjs — linked-worktree evidence advisory (E111)
- Origin: a lane worktree bootstrapped without the symlink-back-to-primary step (the Feature-Scope Gate bootstrap obligation in `content/coord-03-core-fallback.md`) ends up with real, gitignored copies of the evidence directories, and `git worktree remove` deletes the lane's whole code-review and QA trail. Measured 2026-09-08 (`docs/agc-feedback-2026-09-08.md` H2 (a) and H2-b B1): 4 of 7 tickets had no evidence copy left in primary, all four PASS and so teardown-eligible. The bootstrap symlink is the real mechanism; this check is the backup detector.
- Worktree detection uses git's own on-disk signal (a `.git` gitfile instead of a directory), not a path-name heuristic, so it is a silent no-op in a primary checkout.
- Trigger in full: (a) a real directory that is either completely empty (the one moment the fix, `rmdir && ln -s`, loses nothing; git cannot track an empty directory, so this has no false-positive cost), or holds at least one file the index does not know about that is itself ignored, or sits in a directory with zero tracked files; or (b) a symlink that does not resolve outside the worktree (a link into the lane itself, or a dangling link, protects nothing).
- Why the tracked-directory exemption: this repo tracks all three directories, so an uncommitted report mid-review must stay silent. The remedy there is to commit it; symlinking a tracked directory away would stage a mass deletion.
- Advisory only, with no enforcement teeth by design: a qa-owned fixture test proves the detection against a synthetic linked worktree, and this is a nudge, not a gate. Do not make it fail closed.
- Known, accepted false positives (re-derive before assuming they still hold): a git submodule working tree with untracked evidence directories still warns, because telling a submodule gitfile from a worktree one is not worth the complexity for a harmless warning. A directory tracked under a different case on a case-insensitive filesystem is currently silent, as a side effect of the tracked-directory exemption rather than by design.
- `hasUntrackedContent` was verified against both shapes: a gitignored directory with a tracked `.gitkeep` plus an untracked real file, and a tracked, clean directory with one new not-yet-added file. `--others` without `--exclude-standard` reports non-empty for both and empty for a fully tracked, clean directory.
- Why `hasIgnoredUntrackedContent` does not run `git check-ignore` on the directory: that candidate fails on a gitignored directory holding a force-added tracked `.gitkeep`. Once a directory holds even one tracked file, git has to walk into it, so `check-ignore` on the directory reports "not ignored" even though the rule still applies to every untracked file inside. Measured on that shape: `git check-ignore -q -- review_reports` exits 1 while `git check-ignore -q -- review_reports/report.md` exits 0. Asking file by file (`ls-files --others --ignored --exclude-standard`) avoids the quirk.
- `hasTrackedContent` covers the adopter who gitignored nothing but also never committed anything under `qa_reports/`: zero tracked files looks the same as a fresh gitignored evidence directory, so it must still warn.

### bin/agc-init.mjs — orphan-lane advisory (E179 AC5)
- Not gated on `isLinkedWorktree`: every read (branch refs, their trees, the worktree list) is repo-global, so the output is byte-identical from the primary checkout and from any lane.
- Candidates are all local branches (DR-6: an orphan by definition has no worktree entry). `git worktree list` only supplies the live set, and an entry whose directory is gone (removed without finish, not yet pruned) is not live (DR-9).
- Own-lane only (spec AC5, E179-NEW-2 option (a), human ruling 2026-09-25): a branch is judged only by `.current/<its own lane>/pending-tickets.md`, its lane being what `resolveCurrentLane` would name it (`feat/<id>-*` gives `<id>`). Another lane's file that the branch happens to carry, because it forked from base between that lane's merge and its finish, is never read.
- Why the scan never reads `.current/history/` (a settled question, S1, decided with the lane-close writeback, E125b spec AC4): `agc feature finish --shipped` is the only writer into `.current/history/`, and it also deletes the lane's branch, so a closed lane is never a candidate (candidates come from `refs/heads/` only). This is a structural non-applicability, not a relaxation of what "orphan" means. A test pins that the function body never mentions that directory, comments included.

### bin/agc-init.mjs — artifacts declared-vs-actual advisory
- Purpose: catch a mismatch between the recorded `artifacts` choice and the repo's real state before it reaches a shared branch. It is a workspace-local drift signal, not a stale install, so it never affects the exit code.
- Per mode: undeclared gives one line unconditionally, with no git state consulted. `"local"` gives a line if any of the workspace's artifact exclude rules is missing from the shared exclude, plus one per tracked artifact path. `"repo"` gives a line if any of those rules is present; the test is on the exact strings, so `LANE_EXCLUDE_RULES` entries written by `agc feature start` never trip it.
- "The workspace's rules" are `artifactExcludeRulesForPrefix()` for the repo-relative prefix of `cwd`, the same set `agc init` would write from there, so a root workspace and a subdirectory workspace in one repo never count each other's rules.
- A `"local"` workspace whose path has a gitignore-wildcard segment gets one "cannot verify" line instead: `agc init` refuses to write rules there, and testing a pattern that may not mean what it spells would be wrong either way.
- Silent when there is no parseable `.current/.config.json` (not an agc workspace, or a broken config the server already reports), and silent on the git-dependent branches outside a repo or on any git failure.

### bin/agc-init.mjs — feature subcommand section (E73)
- The mechanism spec is `specs/e73-agc-feature-lifecycle.md`. Applying and numbering pending-ticket files at finish time, and `agc check`'s orphan-lane advisory, live further down (E179, E124b; see "finish-time pending-ticket apply" in the file).
- Lane naming has one source of truth: `TICKET_ID_RE` in `tools/lane-paths.ts`, reached only through its exported functions (`resolveLaneName` validates a slug before any git mutation; `resolveCurrentLane` names the lane of a checked-out branch). No second copy of the pattern lives in `bin/`.

### bin/agc-init.mjs — LANE_EXCLUDE_RULES and the base-sha rule (e125b AC11)
- `finish --shipped` reads the fork-point `base-sha` file from the lane worktree before removing it and records it in the `tasks.md` pointer line.
- Ignoring it keeps a fresh lane's `git status` clean (AC8), lets `git worktree remove` (never `--force`) succeed on a lane that never committed its `.current/<lane>/` (AC13), and keeps a harvested copy of it from dirtying the primary checkout. The `**` also covers the `.current/history/<bucket>/<lane>/` copy and a reverse-migrated flat copy.

### bin/agc-init.mjs — abandoned-evidence harvest planning (E180)
- `planAbandonEvidenceHarvest` follows spec AC1-AC6. It takes the primary checkout from the first entry of `listWorktrees`, so neither caller's signature had to change.

### bin/agc-init.mjs — finish-time pending-ticket apply (E179)
- The pending file and `docs/backlog.md` are read fresh from git's object database, never from a long-lived in-memory copy (AC4).
- Everything happens before the worktree is removed, and every check runs before the first mutation, so any refusal leaves the lane exactly as the other precondition failures do.

### bin/agc-init.mjs — finish-time lane close writeback (E125b)
- The two shapes are told apart by `hasTrackedContent` on primary. Tracked: `.current/<lane>/` was merged in on `--base`, so it is moved with `git mv` and the pointer is added, in one path-limited commit on `--base` (AC1/AC2). Untracked: the adopter git-ignores `.current/`, so the lane's only copy is in its own worktree; it is fs-copied (never committed) into the history bucket before the worktree is removed, and the pointer is still committed (AC9/AC10).
- When root `tasks.md` is itself git-ignored (the same adopter shape, E213), the pointer is written to it fs-only and never `git add`ed, because git refuses an ignored path. The close commit then carries only the `.current/` paths, or is skipped when nothing else needs one.
- `executeLaneClose` restores every file it touched when the commit fails.
- The `alreadyClosed` re-run's re-harvest (R1) overwrites a differing history copy safely: agc's only writer of that history directory is the harvest of this same live lane directory, so a differing copy is an older snapshot the lane has since superseded, and the result equals a first close run now.

### bin/agc-init.mjs — finish --shipped evidence harvest (E214)
- The three differences from the `--abandoned` harvest (E180) are deliberate: every file is taken, with no ticket-token filter, because the worktree belongs to one dedicated lane and goes away for good; the walk is recursive and each file keeps its path relative to the directory root; and the destination follows the release-engineer 7a convention `<dir>/archive/<ticket>/<relpath>`.
- `planShippedEvidenceHarvest` runs together with `planLaneClose` before any mutation; `applyShippedEvidenceHarvest` copies just before the worktree is removed.
- Why "at risk" is decided per file and not per directory: the directory-level check is the same quirk described for `hasIgnoredUntrackedContent`. A `git check-ignore` exit other than 0 or 1 (128, for a path beyond a symlink) cannot prove the file survives removal, so it fails toward harvesting, as `evidenceAtRisk` does. Exit 1 is a plain untracked file, which git's own `worktree remove` refuses over (AC10).
- `walkEvidenceTree` stops a symlink cycle because the content the cycle points at is already walked by the ancestor that closed it.

### bin/agc-init.mjs — eject subcommand
- Domain knowledge (`design/`, `specs/`, `docs/backlog.md`) is kept unless `--purge-knowledge`, because it is the project's own rationale and plan, not agc bookkeeping. Host traces are CLAUDE.md's adapter block, `AGENTS.md`, `.antigravityrules`, and this workspace's artifact lines in `.git/info/exclude`.
- Each path's disposition is decided from the actual index, never from the declared `artifacts` value. A tracked path is only named in a printed `git rm -r` line, because removing it changes what every clone sees and cannot remove it from history. eject never runs a git command that changes the repository, and never reads stdin.
- Plan entries: "Nothing to eject" means no entry has an `apply` and nothing is tracked. A `trackedChange` stays uncommitted until the adopter commits it, so those entries are listed after the plan lines, by `display`. An `advisory` line covers, for example, a file left for the adopter to review.

### bin/agent-governance-context.mjs — composition and state rendering
- Compose-not-strip (A9) replaced a duplicated `stripChainOnly` regex and a read of the old monolithic `content/constitution.md`. The DR-3 "keep the regex in sync" contract became structural, one imported manifest (`specs/compose-not-strip-overlays-architecture.md` DR-4). The hook never stripped design-only text, which is why design-tagged fragments are always included; the lite blank-run collapse is the one the old `stripChainOnly` did.
- Fail-loud on a missing `dist/` (a partial install): the composers return `""` and the state loader returns `null`, so the "hook misconfigured" hint fires instead of a partial bundle or a raw read.
- The read-only parser (`parseHandoff`) tries the lane path first with a legacy flat fallback, never migrates, locks or creates a lane directory, and throws `HANDOFF_LAYOUT_CONFLICT` when both exist. Rendering goes through `dist/prompts/build.js` `renderHandoffStateBlock`, which calls `renderDataBlock` in `lib/render-boundary.ts`, so the hook and the prompt builder emit byte-identical, bounded, labelled blocks.
- The dedup marker write can fail in a `tasks.md`- or `TODO.md`-only workspace with no `.current/`; a failed marker write must never break the hook.

### bin/agent-governance-usage-hook.mjs — opt-in and environment
- Payload fields read: `tool_name`, `tool_input`, `tool_response`, `cwd`. The `dist/` import follows the SessionStart hook's pattern.
- Opt-in rules in full: a record is written only when `tool_name` is `"Task"`, `<workspace>/.current/` exists, and `.current/.config.json` sets `tokenBudgetPerFeature` to a positive finite number. An absent file, absent key or invalid value is a silent no-op: no file, no accounting.
- Best-effort follows D3's `emitGateTelemetry` discipline: the hook never blocks or alters the Task result.
- Env overrides: `AGC_SERVER_ROOT` (aliases `TEAMWORK_SERVER_ROOT`, `SDD_SERVER_ROOT`) points at a different agent-governance-mcp checkout; `CLAUDE_PROJECT_DIR` is the workspace fallback when the payload has no `cwd`.

### scripts/capture-constitution-golden.mjs — fixture set and history (A9, E90)
- First written as a one-shot pre-refactor capture for compose-not-strip (A9 / T-CNSO-02): it snapshotted the constitution portion of every dispatch mode from the old strip pipeline so the refactor could be proven byte-equivalent (asserted by `test/compose-equivalence.test.mjs`). The monolith and the strip code are both gone; what remains is the standing regeneration tool every `const-*` / `coord-*` content ticket needs. Two of the twelve fixtures once had no tool at all and were rebuilt by hand during a content edit (E90, E43).
- It is a script, not a test file, so constitution section 2 test ownership does not apply (architecture DR-5), but the fixtures it writes are a qa-owned surface: re-baselining them is a qa task, and running this tool is how qa does it.
- The 12 fixtures: 8 `build.ts` fixtures (lite/full x design/non-design x fullDetail on/off); 2 hook fixtures (`bin/agent-governance-context.mjs` lite and full); the constitution monolith, the concatenation of `CONSTITUTION_SEGMENTS` over `content/`, which is the operation compose-equivalence's AC8 invariant asserts (derived from the manifest because `content/constitution.md` was deleted at A9/AC8); and the coordinator skill monolith, `composeSkill` under the claude-code capability profile, pinned by `test/skill-manifest.test.mjs` t-golden-byte-identity and added by the fail-loud rework (E90).
- Fail loud: the earlier monolith branch printed a benign-looking "not re-captured" note and exited 0 while a fixture the green suite depends on went unwritten. Because the monolith file was deleted at T-CNSO-09/AC8, its `existsSync` branch always took the else arm and wrote nothing, leaving the AC8 assertion red after any `const-*` edit while the tool reported success. A tool that reports success while leaving two tests red is worse than a tool that is absent.

### scripts/check-md-tables.mjs — rules, discriminators and evidence exclusion (E74)
- Rule 2 flags a block whose first two lines are not [header, delimiter] as a whole. That one test catches both a block with no delimiter row and a single logical table that a blank line broke in two, because the second half never has its own delimiter row either.
- The four discriminators are each load-bearing (the originating ticket's own words): omit any one and the checker gives false positives worse than having no checker. (iii) exists because an indented `|` line is a lazy-continuation line of a `- [ ]` list item, not a row; (iv) also means a table block ends at the first line that is not a column-0 `|` row.
- Why `qa_reports/` and `review_reports/` are excluded (E74/E17): `qa_reports/` and `review_reports/archive/` are write-once forensic artifacts; live `review_reports/` is not write-once but holds the same kind of recorded evidence. The fix the lint would demand there, escaping `|` inside a recorded shell command, changes what the command means: POSIX BRE `\|` is alternation, not an escaped literal (verified with this platform's grep: `^\| N/A` then matches every line). A misrendered table cell in an evidence file is cheaper than a falsified command. Measured blast radius at the time: the exclusion skipped 565 of 806 tracked `.md` files but hid exactly 2 rule-1 sites and 0 rule-2 sites, so narrowing it would not shrink coverage in practice. Removing the exclusion re-opens the corruption.
- Fence tracking: a bare parity toggle mis-closes a 4-backtick block on an inner 3-backtick fence and un-fences the rest of the file. That was reproduced both as a false positive (a fully fenced file flagged) and as a silent false negative (a real cell-count defect after such a block reported as 0 malformed tables, exit 0). The repo carries 4-backtick fences (for example in `content/coord-01-core-head.md` and `content/coord-02-host-dispatch.md`).

### scripts/check-md-tables.mjs — no-delimiter cause and the continuation tie-break (E74 F6, E105)
- Only cause (a) is fixed by touching a blank line; conflating the three causes gives a confidently wrong remedy. Cause (c) is created by rule 1's own fix (F3), and calling it "no delimiter row" would be factually false.
- Telling (a) from (b)/(c): walk up past this block's preceding blank lines to the nearest non-blank line. A column-0 `|` row there shows that some table lives earlier, but not that it is this block's own header being continued (E105): two separate adjacent tables have the same shape. Following the (a) remedy then would merge two tables and demote the second header to a data row, which is the corruption the checker exists to catch.
- Tie-break: find the run that the nearest non-blank line belongs to and compare that run's header cell count (not the nearest row's own count, which may be a delimiter or data row) with this block's header count. Equal means a real continuation; a mismatch means the earlier run is a different complete table, and this block falls through to (b)/(c). Verified on `docs/backlog.md` at the time: a true 6-cell continuation, and an unrelated 9-cell adjacent row that a naive adjacent-line check would misclassify.

### scripts/check-md-tables.mjs — done-mark advisory (E88, E145)
- The done-mark convention (`**DONE**` / `**PARTIAL**` / `**VOID**`, optionally followed by "— shipped vX.Y.Z") is free text with no fixed cell position. A mark buried mid-cell was missed by a truncated read (2026-08-21) and landed in the wrong column through a mis-parsed row (2026-08-28, v3.105.0, the E96/E74 unescaped-`\|` recurrence). Pipe escaping is already covered corpus-wide by rule 1; this adds the position half, scoped by exact header-cell match (not a filename heuristic, not corpus-wide). See `specs/e88-e105-md-table-checker.md` Decisions 1-2.
- Why advisory, not fatal: the ticket table already held 5 shipped rows (E39/E40/E58/E59/E71) that predate the check, and making it fatal would have forced an off-topic `docs/backlog.md` normalization pass (NEW-TICKETS.md L-MDTOOL-N1).
- Why the closing `**` is not anchored: measured 92 DONE / 7 PARTIAL / 3 VOID bold-marker instances, of which only 30 of the 92 DONE ones self-close right after the token (`**DONE — shipped v3.109.0**`, `**DONE (v3.105.1)**` are the dominant shapes). "Should lead the cell" is a question about where the marker opens.
- Round 2 (code-reviewer C1): "opens with the token" is not the same as "is a done-mark". 2 of 6 round-1 advisories fired on non-marks: a different row's mark quoted inside a code span, and prose on E88's own row ("**DONE and shipped**"). Over all 65 marker-bearing cells, excluding code-span matches and requiring self-close or an in-span `vX.Y[.Z]` / ISO-date stamp gave exactly the 4 genuine buried marks (E39/E40/E58/E59) with zero loss elsewhere. Both axes are orthogonal to the column-split axis where earlier done-mark checks were defeated (E88/E96), and `splitRow()` / `headerCellCount` are untouched.
- Round 3 (E145; coordinator forensics corrected the ticket's own premise): the code-span exclusion closed the door for a quoted code excerpt but not a quoted prose excerpt, which this repo writes as `*"…"*`. E145's own row quotes E59's mark that way, and that bold span self-closes with a version stamp, so round 2's qualifying test accepted it like a genuine mark. E59's own row is not a citation of E57: its mark names the same version and commit as E59's own last-cell mark, so it is a true positive, and silencing it would have been the real loss.
- The citation fix is exclusion-only, the same shape as `findCodeSpanRanges()`: an opening `*"` not part of a `**` run, closed by the next `"*` not opening a new `**` run. An unpaired opener yields no range, matching how an unpaired backtick run is treated (CS-UNMATCHED-BACKTICK, CS-UNPAIRED-3BACKTICK): fabricating a range risks swallowing a real, unquoted mark. Measured over 68 marker-bearing cells (75 candidate opens): the exclusion flips exactly one cell (E145's row, the candidate inside the quote) and leaves the same 4 advisories with the same token and offset.
- Known residuals (code-reviewer round 1, review_T-E145-01; neither occurs in the live corpus and both fail toward the safe direction): the close search takes the next `"*` anywhere later in the cell and is not code-span-aware, so a `*"` opener inside a code span can open a range that silences a genuine mark (one-line hardening for a follow-up: skip an opener that is `insideCodeSpan`). The predicate is deliberately `*"…"*` only; typographic quotes, plain `"…"`, `**"…"**` or bare `*…*` still advise. Widening would exclude ordinary emphasis and silence genuine marks. Revisit only if a second style appears in the corpus.
- `matchAll` in `findGenuineDoneMark` avoids the silent-skip risk code-reviewer C2 flagged for a module-scope `/g` regex reused with `.exec`.

### scripts/check-transitions-sync.mjs — purpose, fail-loud and postbuild wiring
- Same pattern as `scripts/check-version.mjs`: resolve root from `import.meta.url`, read the compiled `dist/` artifact (what ships), fail loud and exit non-zero with an actionable message.
- Why it exists: the mirror table had drifted from `ALLOWED_TRANSITIONS` before (a review round once found 9 divergent sites across 16 mirrored rows) with nothing to catch it (E39/E58; the finding was E37 round 1). Both sides are structured data (a Map in compiled JS, a fixed three-column markdown table), so set equality is mechanizable. A hand-written prose expansion of a prose source has nothing structured to diff; the `docs/skills/*` mirror tree was that case and was deleted rather than checked (E48).
- Hard requirement (ticket condition, same defect class as an earlier `grep -vxFf` empty-baseline bug, E50): failing to find or parse the table, or to load `ALLOWED_TRANSITIONS`, must fail. An empty parse agreeing with an empty source would defeat the check.
- Why `postbuild`, unlike check-version's `prebuild`: this check imports from `dist/`, which changes on every edit to `tools/transitions.ts`. At `prebuild` it would run before `tsc` and validate the previous build, the stale-output failure the ticket exists to prevent. check-version tolerates prebuild timing because the version literal does not change mid-edit. `postbuild` still runs on every `npm run build` and every `npm test` (via `pretest`, `build`, `postbuild`).
