# Review — T-E444-01 (batched round, e444-claude-local-adapter)

covers: T-E444-01, T-E444-02, T-E444-03, T-E444-04, T-E444-06

## Round 1 — APPROVED — by code-reviewer

Diff judged: `git diff 5f50af1...HEAD -- bin/agc-init.mjs docs/install.md` (commits d48e8f4, 0cf5fad, 4a36767, 632f9bf, a126d3d). Contract: `specs/e444-claude-local-adapter.md` including amendment 2c7d1bf (decision (j), AC2b, `feature.usage` row). No architecture spec (mini-chain). Reviewer model: opus; the builder was also pinned to opus, so same-model bias is possible. The scratch-repo runs below were done to offset it.

## Summary
- `agc init` gets `--adapter=shared|local` (`=value` and space forms, checked before any write). Placement order: explicit flag, then decision (j) (only `CLAUDE.local.md` holds a block → `local`), then the B' first-install rule (git, `CLAUDE.md` tracked, effective mode `local`, no block in `CLAUDE.md`), else `shared`. `local` upserts the prefix-anchored `/CLAUDE.local.md` rule from a new `ADAPTER_LOCAL_EXCLUDE_RULES` constant. A tracked `CLAUDE.md` is never edited when the placement is `local` (ruling 2).
- `agc check`: decision (i) block-holder resolution for the stale check, a duplicate-block advisory, and skip-worktree / assume-unchanged advisories read from `git ls-files -v -z`. The exit code is unchanged by any new line.
- `agc eject`: covers `CLAUDE.local.md` (block removed and notes kept, or the file deleted when it held only the block), removes the adapter exclude line with new wording, and adds cannot-do item 5 only when an index flag is set.
- `agc feature start`: copies an ignored repo-root `CLAUDE.local.md` into the lane with `COPYFILE_EXCL`, guarded by `check-ignore`, and adds no lane-paths call. `docs/install.md` gets the team-file section, the bootstrap bullet, the eject row and item 5.
- Verdict: APPROVED. No `required` findings. Three `recommended` and three `optional` notes follow.

## AC Completeness
AC1 — implemented — bin/agc-init.mjs:448-456 (B' branch), :585-600 (exclude upsert + own notice line); scratch repo: stdout `agc init — added /CLAUDE.local.md to the shared info/exclude`, `CLAUDE.md` byte-identical, `git status --porcelain` empty
AC2 — implemented — bin/agc-init.mjs:453-455 (`claudeHoldsBlock` → shared); in-place update path of `writeClaudeBlock` returns `updated`, so no item-4 line; item-3 notice only under `adapter === "local"`
AC2b — implemented — bin/agc-init.mjs:449-452 (`localHoldsBlock && !claudeHoldsBlock` tested before B'); scratch repo after `--artifacts=repo --adapter=local` with the stamp aged to 0.0.1: re-run updates `CLAUDE.local.md` to 4.22.0, `CLAUDE.md` byte-identical, stderr empty
AC3 — implemented — B' requires `mode === "local"`, so (i) repo, (v) "ask" (`mode === null`) and (ii)/(iii)/(iv) (`claudeTracked` false) fall to `shared`; scratch repo for (v): block appended to `CLAUDE.md`, no `CLAUDE.local.md`, no exclude line
AC4 — implemented — bin/agc-init.mjs:601-607 (removal notice text matches `init.adapter-removal-notice`); the upsert targets `ADAPTER_PLACEMENTS.local` only (:628-630)
AC5 — implemented — bin/agc-init.mjs:637-643 (`shared && appended && claudeTracked`); `isWorkspaceFileTracked` reads only `git ls-files`
AC6 — implemented — bin/agc-init.mjs parseInitArgs (`hasOwnProperty` against `ADAPTER_PLACEMENTS`); scratch: `foo`, empty, `__proto__`, `toString` all exit 2 and write nothing
AC7 — implemented — subdirectory rule `/sub/CLAUDE.local.md` (scratch: a pre-existing root `/CLAUDE.local.md` line is untouched); outside git: `init.adapter-no-git` note, exit 0; unsafe segment `a[b` with `--artifacts=repo --adapter=local`: exit 2 and nothing written
AC8 — implemented — `claudeCheckTargets` (bin/agc-init.mjs ~1046) + the targets flatMap in `runCheck`
AC9 — implemented — `checkAdapterPlacement` duplicate line, stderr only
AC10 — implemented — `adapterIndexFlags`: tag `S`/`s` → skip-worktree, any lowercase → assume-unchanged (`s` gives both lines, verified against real `git ls-files -v` output `S` / `s`); exit code is driven only by the stale list
AC11 — implemented — the new advisory is silent with no flag and no `CLAUDE.local.md`; `execFileSync` failure (outside git, git missing) → `[]`; 351/351 tests in the owned check/init/eject/feature files pass
AC12 — implemented — `planClaudeBlockEntry(ctx, rel)` runs for both files; `planExcludeEntry` wording matches `eject.exclude-with-adapter`; scratch `--yes`: notes kept in `CLAUDE.local.md`, a hand-added `/keepme` line kept
AC13 — implemented — `ejectCannotDoBlock(flags)` appends item 5 only when non-empty; called on both the nothing-to-eject and normal paths
AC14 — implemented — `bootstrapLaneEnv` CLAUDE.local.md block; scratch: copied byte-identical, lane porcelain empty; unignored primary file → `feature.claude-local-not-ignored` warning, nothing copied
AC15 — implemented — docs/install.md new `### When CLAUDE.md is a team file: \`agc init --adapter=shared|local\`` section after the `--artifacts`/check text; bootstrap bullet; eject row; cannot-do item 5 (anchor slug checked against GitHub rules)
AC16 — implemented — `ARTIFACT_EXCLUDE_RULES` and `LANE_EXCLUDE_RULES` unchanged; no new `loadLanePaths` / lane-paths reference in the diff; `check` dispatch untouched; `node bin/agc-init.mjs check` on this worktree exits 0

## Correctness
No required findings. What I verified:
- Placement precedence (bin/agc-init.mjs:442-456): an explicit flag wins over (j) and B'. (j) only fires when `CLAUDE.md` holds no block, so it can never trigger the removal notice or edit `CLAUDE.md`. When both files hold a block → `shared`, as AC2b's second sentence requires.
- Tracked detection uses `--literal-pathspecs ls-files` on the workspace-prefixed path, so a wildcard in the directory name cannot glob. Outside git it returns false before any git call.
- Exclude upsert is idempotent. `upsertSharedExclude` checks line membership, so a re-run prints no notice (scratch: run 2 stdout has no "added" line). Anchoring in a subdirectory workspace uses `artifactExcludeRulesForPrefix(prefix, ADAPTER_LOCAL_EXCLUDE_RULES)`. Eject removes only the line equal to this workspace's rule. Scratch: subdirectory eject removed `/sub/CLAUDE.local.md` and kept the root `/CLAUDE.local.md`.
- Eject never deletes user content. A file is deleted only when `rest.trim() === ""`, otherwise it is rewritten with only the block removed. A file with no well-formed block → "no adapter block found — nothing to do" (integrator-accepted).
- `git ls-files -v -z` parsing: entries are `<tag><space><path>`. `rel` comes back relative to cwd because the pathspecs are cwd-relative, so in a subdirectory workspace the printed `git update-index … CLAUDE.md` is correct for the directory `agc check` / `agc eject` runs in.
- Feature start copy: `statSync().isFile()`, `!lstatOrNull(lane)`, `check-ignore -q` status 0 → `copyFileSync(..., COPYFILE_EXCL)` with EEXIST swallowed. Status 1 → warning. Status 128 → silent, the same as the `.config.json` guard.
- sr point (2), (j) plus an unsafe segment. Scratch: in `a[b/` with only `CLAUDE.local.md` holding a block, `agc init --artifacts=repo` exits 2 with the `--adapter=local` refusal and writes nothing. Not a defect: the spec's AC7 refusal applies to every `local` placement, and refusing is the safe direction. The wording is covered under recommended R2.

## Quality
- **recommended R1 — `init.usage-adapter` no longer tells the whole story (sr point 1).** `STR_USAGE` says "With no flag, local is picked only on a first install into a tracked CLAUDE.md with local artifacts". Since decision (j), a re-run also picks local when only `CLAUDE.local.md` holds the block, so "only" is now inaccurate. The text matches the spec verbatim, and the amendment 2c7d1bf kept this row, so the implementation is correct against its contract. The fix belongs to a pm copy amendment, not to sr. Example wording: "With no flag, local is kept when CLAUDE.local.md already holds the block, and picked on a first install into a tracked CLAUDE.md with local artifacts." It does not block: the line ends with "see docs/install.md", which documents (j).
- **recommended R2 — refusal wording under (j).** In the unsafe-segment case above, the message says "refusing --adapter=local … re-run with --adapter=shared" to a user who passed no flag. Following that advice appends the block to `CLAUDE.md`, so both files then hold it (the duplicate state). The case is rare: a hand-placed `CLAUDE.local.md`, or a directory renamed after a `--adapter=local` install. A follow-up could name the cause, e.g. "CLAUDE.local.md already holds the agc block".
- optional O1 — `holdsClaudeBlock` says "The one definition of 'holds a block' for init, check and eject", but `writeClaudeBlock` (bin/agc-init.mjs:121-123) and `planClaudeBlockEntry` (~4060) still run the same indexOf test inline. The behaviour is identical. Either reuse the helper or soften the comment.
- Comment check (step 4b): `agc check — comments` reports one warning in the diff, `bin/agc-init.mjs:2 long-block 8 lines (limit 7)`. Kept: the file-header usage summary grew by one line only because the `init` synopsis line now carries two flags and was wrapped. It is a WHAT summary, not rationale. Every other added comment is WHAT/WHY and within budget.

## Architecture
No architecture spec (mini-chain). The diff follows decision (a): the separate `ADAPTER_LOCAL_EXCLUDE_RULES` constant keeps `checkArtifactsDrift` and eject's wholesale class (i)/(ii-b) deletion away from `CLAUDE.local.md`. Decision (g): no lane-paths call, `LANE_EXCLUDE_RULES` untouched. Decision (f): the flag advisory covers `CLAUDE.md` / `CLAUDE.local.md` only. Helpers are reused (`artifactExcludeRulesForPrefix`, `upsertSharedExclude`, `isWorkspaceFileTracked`, `gitTry`) rather than duplicated.

- **recommended R3 — eject removes `/CLAUDE.local.md` from `info/exclude` regardless of placement or of whether the file survives.** Example: an adopter on `--adapter=shared` keeps personal notes in `CLAUDE.local.md` and added `/CLAUDE.local.md` to `.git/info/exclude` by hand. `agc eject --yes` reports "no adapter block found — nothing to do" for the file but removes the exclude line, so the notes now show as `?? CLAUDE.local.md` and can be committed by a later `git add -A`. The same happens after a `local` install where the user appended notes: the block is removed, the file is kept, and its rule is gone (scratch run 1). The behaviour matches the spec as written (T-E444-03: `planExcludeEntry` also removes the rule; AC12 asserts the line is gone) and the dry-run plan names the line, so it does not block. A follow-up could keep the line when the file survives eject.

## Security
No findings. Every new git call is `execFileSync` / `gitTry` with an argv array and fixed pathspecs. The `--adapter` value is validated against an own-property whitelist (`__proto__` / `toString` rejected). The lane copy is a kernel byte copy and the contents are never read (§6). Displayed paths in the eject item-5 lines go through `escapeSegmentForDisplay`, and in check `rel` is always one of two fixed names. docs/install.md adds no absolute path and no bare ticket id.

- optional O2 — docs/install.md `shared` bullet: "It runs no git command either way." `agc init` does run read-only git commands (`rev-parse`, `ls-files`) to detect tracking. AC5's wording, "no git command beyond the read-only ones", is the accurate form, e.g. "It never stages, commits or changes the git index."
- optional O3 — docs/install.md "Flag omitted" bullet lists "outside a git repository" among the `shared` cases, then the next sentence says (j) applies "inside or outside a git repository … before the first-install conditions are tested". The text is correct but would read more easily with the (j) sentence first.

## Performance
No findings. `runInit` adds two file reads and one `ls-files` call. `runCheck` adds one `ls-files -v` call and up to four small file reads. Eject adds one `ls-files -v` call and one extra file plan. Feature start adds one `stat` and one `check-ignore`. None of these loops or runs in a hot path.

## Verification run by the reviewer
- `node --check bin/agc-init.mjs` OK.
- `node --test` over e351, agc-adapters, e106, e239, e108, e250, e177a, agc-feature-lifecycle, e429, lane-paths, e234, e258b, e259, p0-onboarding-lite-default, e291: 351/351 pass.
- `node --test` over e394-release-script, release-staging, e196, e298, e385 (the not-owned `check` callers and the source-read pins): 176/176 pass.
- `node bin/agc-init.mjs check` on this worktree: exit 0, "OK (4.22.0) — all adapters current".
- Scratch repos in os.tmpdir() (scripts in the session scratchpad, not committed) cover AC1 + re-run idempotence; skip-worktree / assume-unchanged / both (`S`, `s`) for check and eject; eject `--yes` with user notes; subdirectory B', exclude anchoring and eject keeping the root rule; AC2b; "ask" mode; the unsafe segment explicit / default / (j); (j) outside git; feature start copy and the not-ignored warning; invalid `--adapter` values.
- Expected-red (step 4a): the diff touches no test file and no test went red, so it is not armed.

## Verdict
APPROVED — every AC is implemented with evidence. The placement, exclude, eject and copy guards behave as the spec and rulings require, the cross-lane conditions hold, and the remaining notes are spec-level wording or follow-up items, not defects this diff introduced.
