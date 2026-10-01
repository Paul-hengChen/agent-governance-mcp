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
