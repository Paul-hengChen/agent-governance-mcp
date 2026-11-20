# Review — T-E444-07 (e444-claude-local-adapter)

covers: T-E444-07

## Round 2 — APPROVED — by code-reviewer

Diff judged: `git diff 1dcb3c4 2c54ded -- bin/agc-init.mjs docs/install.md` (commit 2c54ded). Contract: `specs/e444-claude-local-adapter.md` Decision (k) (including the coordinator's working-tree amendment recording the no-block case), Decision (l), AC7b, amended AC12, Copy / Strings rows `init.adapter-unsafe-segment-implicit`, `eject.adapter-rule-kept` and `eject.exclude-with-adapter`, task row T-E444-07. Round 1 (T-E444-01..04, 06) is in `review_reports/review_T-E444-01.md`; this round judges only the delta and checks it for regressions in those tasks. No architecture spec (mini-chain). Reviewer model: opus; the builder was also pinned to opus, so same-model bias is possible. The old-vs-new scratch runs below were done to offset it.

## Summary
- Decision (k): `planExcludeEntry` becomes `planExcludeEntries` (returns an array). The `/CLAUDE.local.md` rule is removed only when eject deletes `CLAUDE.local.md` (it held only the block) or the file is already absent. While the file stays on disk (notes beside the block, or no agc block at all) the rule stays, and one report-only advisory line names it in dry-run, applied and nothing-to-eject output.
- New helpers: `claudeBlockRemoval(abs)` is shared by `planClaudeBlockEntry` and the new `localAdapterFileSurvivesEject(ctx)`, so "file deleted" and "rule removed" come from the same computation and cannot disagree.
- Decision (l): `keepsLocalBlock` names the decision-(j) case. With an unsafe segment it gets its own refusal text. The explicit `--adapter=local` refusal is unchanged byte for byte.
- `docs/install.md`: the eject host-traces row, the team-file eject sentence and the re-run bullet follow the new behaviour.
- Verdict: APPROVED. No required findings; two recommended and four optional notes below.

## AC Completeness
AC7b — implemented — bin/agc-init.mjs:452 (`keepsLocalBlock`), :467-476 (implicit refusal, exit 2 via `usageError`, thrown before the first write); scratch case 1 below.
AC12 — implemented — bin/agc-init.mjs:4059-4077 (helpers), :4169-4229 (`planExcludeEntries`); deleted-file case keeps the `eject.exclude-with-adapter` wording; notes case keeps the line and prints `eject.adapter-rule-kept`; `git status --porcelain` lists no `CLAUDE.local.md` after `--yes` (scratch C).
AC1, AC2, AC2b, AC3–AC7, AC8–AC11, AC13–AC17 — implemented — unchanged by this delta (no hunk touches their code); no regression: the e444, e108, e250, agc-adapters, e106 and e239 suites pass, and the old-vs-new eject output is byte-identical wherever neither a surviving `CLAUDE.local.md` nor an adapter rule is involved (scenarios A, B, F, H, I, J).

## Correctness
No required findings.

- Rule removed exactly when the file is deleted: `localAdapterFileSurvivesEject` is true iff `claudeBlockRemoval` returns `{ rest: null }` (no well-formed block, so eject leaves the file alone) or `rest.trim() !== ""` (the file is kept). This is the negation of `planClaudeBlockEntry`'s delete branch (`rest.trim() === ""`), and both read the same function. The decision is taken at plan time, before any apply, so the apply order (the block entry runs before the exclude entry) cannot change it. An absent file gives `null`, so the stale rule is removed as before (scenario H, identical to base).
- The sr's extra call (no-block `CLAUDE.local.md` → rule kept) is consistent with (k)'s reason and correct. The file is on disk and eject does not touch it. Removing the rule would make it `?? CLAUDE.local.md`, one `git add -A` away from the team history: the exact leak (k) exists to stop. It also closes Round 1 note R3's first example (a `shared` adopter who hand-added `/CLAUDE.local.md` to `info/exclude` for personal notes). It is the more conservative direction: at worst a line stays that the user removes by hand, as the plan line says.
- Coordinator's question: the plan explains the kept line in the no-block case too. Scenario D, dry-run: `(iii) host traces — .git/info/exclude: the /CLAUDE.local.md line will be kept — CLAUDE.local.md stays on disk because it still holds your own notes, and the line keeps it out of git; remove the line by hand from the shared info/exclude once you no longer need it`. Applied form: `kept the /CLAUDE.local.md line — …`. Scenario G (a second eject, nothing left but the no-block file and its rule) prints `agc eject — nothing to eject.` and then the same advisory in the matching dry-run or applied form, because the entry carries `advisory: true` and `apply: null`.
- Wording paths: when the rule is removed the entry keeps the `eject.exclude-with-adapter` text. When it is kept and artifact lines exist, the entry falls back to the artifacts-only text (`REMOVE 4 artifact exclude line(s)`), byte-identical to the pre-E444 line. When it is kept and no artifact line exists, the entry reads `nothing to remove`. In every kept case the advisory follows on its own line. Subdirectory workspace (scenario E): the rule (`/sub/CLAUDE.local.md`) and the file (`sub/CLAUDE.local.md`) are named correctly.
- (l) fires only for the (j) case: `keepsLocalBlock` requires `requestedAdapter === undefined`, so any explicit flag takes the old branch (scratch case 2: text identical to base). The other implicit-`local` branch (first install, `mode === "local"`) cannot reach this refusal with an unsafe segment, because the `--artifacts=local` refusal at :434 fires first. Exit 2 and "nothing written" hold: the throw sits before any write, and the AC7b proof snapshots the tree.

### Reviewer runs
- `node --test test/e444-claude-local-adapter.test.mjs test/e108-eject.test.mjs test/e250-eject-path-escape.test.mjs`: 64/64 pass. `node --test test/agc-adapters.test.mjs test/e106-init-artifacts-flag.test.mjs test/e239-init-subdir-exclude.test.mjs`: 77/77 pass.
- Old (1dcb3c4) vs new (2c54ded) `agc eject` then `agc eject --yes`, plus the final exclude file, `git status --porcelain` and `CLAUDE.local.md`, in 12 scratch repos under `$TMPDIR`. Identical: A plain init, B `--adapter=local` with the block only, F outside git, H file removed before eject, I `--adapter=shared` plus a foreign exclude line, J subdirectory with the block only. Differ only by the kept rule and the advisory line, with `?? CLAUDE.local.md` gone from the status: C notes beside the block, D no-block file, E subdirectory with notes, G nothing-to-eject re-run, K empty file, L artifacts already gone.
- `agc init` refusals in a workspace segment `a*b`: case 1, (j) with `artifacts: repo` declared, gives the new text, rc 2. Case 2, explicit `--adapter=local`, gives the old text unchanged, rc 2. Case 3, (j) with the mode undeclared, gives the `--artifacts=local` refusal first. Case 4, (j) with `--artifacts=repo`, gives the new text.
- Expected-red (step 4a): the diff touches no test file, and the suites show no unexplained reds, so it is not armed.

## Quality
- The refactor is clean. Extracting `claudeBlockRemoval` removes the risk of the "survives" test and the "deletes" test drifting apart. `planHostTraceEntries` now spreads the array, and the outside-git path returns a single-element array whose text is unchanged.
- Comment check (4b): `agc check — comments: bin/agc-init.mjs:4158 long-block 11 lines (limit 7)` is new in this diff (the block was 7 lines at base). Kept: the four added lines carry the non-obvious reason the rule must stay (private notes one `git add -A` from team history), which guards against a future "simplify by always removing" change. See optional O2. The other new comments are within the limit, and none cites a ticket id or a local path. The `bin/agc-init.mjs:2` warning predates this diff.
- optional O1: the advisory says the file "still holds your own notes". That is slightly off for an empty `CLAUDE.local.md` (scenario K), and in a workspace that never used agc it suggests removing a line agc may not have written. Harmless; a neutral wording such as "stays on disk" would fit every case.
- optional O2: the last added comment line (`A kept rule adds a report-only advisory line naming it.`) restates the code and could go, bringing the block to 10 lines.

## Architecture
No architecture spec. The change stays inside the eject host-traces planner and the init placement block. The entry shape (`line` / `apply` / `untrackedDelete` / `advisory`) is reused as documented at :4020-4026. Cross-lane conditions hold: `ARTIFACT_EXCLUDE_RULES` is still the four rules (:1225); no hunk adds a lane-paths import or call (the only one, :1358, predates this diff); no hunk touches the `check` subcommand.

## Security
No findings. Constitution §6 hygiene: the `docs/install.md` hunks name no absolute path, ticket id, codename or person, and they describe behaviour in terms an adopter sees. Both new messages escape the unsafe segment and the display path with `escapeSegmentForDisplay`. The fix narrows a privacy leak (notes becoming untracked) rather than widening one.

## Performance
No findings. `localAdapterFileSurvivesEject` adds one `existsSync` plus one `readFileSync` of a small file per eject run, re-reading what `planClaudeBlockEntry` just read (optional O4: the result could be passed through, but it is not worth the coupling). No loops or hot paths changed.

## Notes (non-blocking)
Recommended:
- R1 (docs accuracy, `docs/install.md` eject row and the team-file sentence): "removed only when `CLAUDE.local.md` is deleted" leaves out that the rule is also removed when the file is already gone before eject (scenario H, same as base). Suggested wording: "removed when `CLAUDE.local.md` is deleted (it held only the block) or already absent".
- R2 (proof coverage, qa scope): AC12's no-block sub-case (`nb`) has no `/CLAUDE.local.md` rule in `info/exclude`, so the integrator-accepted no-block → rule-kept behaviour and its advisory line are not pinned by any test. Adding the rule to that fixture and asserting the kept line plus an empty `git status --porcelain` for `CLAUDE.local.md` would pin it.

Optional:
- O1, O2: see Quality. O4: see Performance.
- O3: in a workspace whose artifacts mode is undeclared (it defaults to `local`), the (j) case with an unsafe segment shows the earlier `refusing --artifacts=local` text, which also names a flag the user never passed. That text predates this ticket and is outside (l), which covers only the adapter refusal; with `--artifacts=repo` the user then sees the (l) text.

## Verdict
APPROVED — Decisions (k) and (l) are implemented as specified, including the integrator-accepted no-block case; the rule is removed exactly when the file is gone; every path without a surviving `CLAUDE.local.md` is byte-identical to base; no required finding.
