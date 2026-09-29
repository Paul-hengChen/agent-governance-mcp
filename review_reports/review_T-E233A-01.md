# Review — T-E233A-01..09 (e233a-tools-comments)

covers: T-E233A-01, T-E233A-02, T-E233A-03, T-E233A-04, T-E233A-05, T-E233A-06, T-E233A-07, T-E233A-08, T-E233A-09

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Comment-only rewrite across 33 `tools/*.ts` files plus the rebuilt `dist/tools/**` (105 files), range `6c61864..HEAD`, 9 commits.
- Behaviour invariance proven independently: the AC1 script (my own copy, scratchpad) prints `invariance OK: 33 files`; `dist/tools` rebuilt in a scratch outDir matches committed `.js`/`.d.ts` byte-for-byte (maps differ only by relative `sources` path, an artefact of the scratch outDir).
- The rewrites I sampled are accurate and much easier to read; the four "stale comment corrected" claims are all true of the current code.
- Headline problem: about 13 comments in files this lane edited still open with a lowercase sub-ticket id plus spec AC numbers (`e123b9 spec AC14: ...`), and there are 24 comment lines with `e123bN`-style ids in total. The spec's bare-id heuristic regex cannot match that id shape, so the self-check missed them. AC2 requires any kept id to be a trailing pointer, so this is only partly done.
- Verdict: CHANGES_REQUESTED (a single required finding, mechanical to fix).

## AC Completeness
AC1 — implemented — independent run: `invariance OK: 33 files`, exit 0.
AC2 — partial — the heuristic prints `bare-id OK`, but it matches ids with `/\b[Ee]\d+[a-z]?\b/`, and `e123b9` fails that because there is no word boundary between `b` and `9`. These comments still lead with an id plus spec AC numbers and were not rewritten: tools/handoff-write.ts:266, :275, :277; tools/handoff-parse.ts:109, :130, :152, :335, :347, :563; tools/lane-migrate.ts:94, :100, :233, :421. Related ones with the id inside the sentence: tools/lane-paths.ts:334-335 (`e123b0 spec AC4`, `the e123b9 J2 flip`, plus 7 more `e123bN` lines in that file), tools/lane-registry.ts:54, tools/role.ts:60. See Correctness R1.
AC3 — implemented — `grep -c '^ *// Watch mode (E178b' tools/lane-status.ts` = 1.
AC4 — implemented — added lines matching `/\*` in lane-status = 0.
AC5 — implemented — the only non-comment +/- lines are the two trailing-comment tails in tools/transitions.ts (`SOURCE_CREDIBILITY_UNVERIFIED`, `FEATURE_LEASE_HELD` union members: `// E4 (...) — emitted by the` -> `// Emitted by the`, and `// E1 (...) — emitted by the` -> `// Emitted by the`). The code before `//` is unchanged, and AC1 confirms it. Justified: the id moved to the end of each block, e.g. `(mirrors EXTERNAL_REFS_UNRESOLVED). (E4)`.
AC6 — implemented — the only changes outside `tools/`, `dist/tools/`, `specs/e233a-`, `.current/e233a/` are none. All 105 dist files are under `dist/tools/`. The only uncommitted files are `.current/e233a/{handoff.md,dispatch.jsonl}`, written by this review's claim, which is an owned path. `npx tsc` exits 0.
AC7 — N/A for review (QA-owned full suite).
AC8 — implemented — no absolute home-directory paths (macOS or Linux style) or `http(s)://` URLs in added lines. By eye, the rewrites mostly remove governance jargon ("review round", "spec AC", "PM-ratified", "option a-min"). The leftovers are in untouched lines (see R1 and O2).

## Correctness
- **R1 (required)** — Incomplete rewrite of `e123bN`-cited comments, outside every stated constraint. Examples:
  - `tools/handoff-write.ts:275  // e123b9 spec AC14: dual presence fails loud before any move.`
  - `tools/handoff-parse.ts:152  // e123b9 spec AC3/AC4/AC12 — own-workspace-only flat->lane migration for`
  - `tools/lane-migrate.ts:233   // e123b9 amendment AC17: the plan lists the optional sidecars FIRST and the`

  These are the pattern the Rewrite rule targets: the id leads, and "spec AC14" / "amendment AC16-AC19" mean nothing without the backlog. The lane rewrote the analogous `e125a D-D / option A:` and `e125a AC11:` comments in tools/tasks-file.ts, so the gap is inconsistent, not a choice. No test pins these texts (grep over test/*.mjs finds none). No AC4-style constraint applies to these three files. Fix: rewrite the 13 leading-id comments listed under AC2 to state the behaviour, with `(E123)` as a trailing pointer. Also fix the in-sentence `e123bN` mentions in lane-paths.ts, lane-registry.ts:54 and role.ts:60. role.ts:60 also describes a finished step in the future tense ("J2 must not route them"). Suggested self-check: widen the heuristic id regex to `/\b[Ee]\d+[a-z0-9]*\b/`.
- Accuracy of sampled rewrites (about 25 read in full across handoff-orchestrator, tasks-file, config, registry, lane-status, feature-rollup, dispatch-log, telemetry, join-precondition, storage-sqlite, transitions): no misdescriptions found. Worth noting: tasks-file.ts:80 now says `containsLineBreak below`, which is correct. The base comment said "above", which was wrong.
- The four stale-comment corrections are each true of the code:
  - feature-rollup header: `laneRegistryList` exists at tools/lane-registry.ts:275 and is typed `LaneListProvider`-conformant.
  - dispatch-log/telemetry: both resolve through `resolveCurrentLanePaths` (dispatch-log.ts:51, telemetry.ts:32). That function returns `.current/<lane>/...` with no flat fallback (lane-paths.ts:318-341). Nothing in tools/gates/bin/prompts/scripts reads the dispatch log, so "raw and unconsumed" still holds.
  - join-precondition: tools/merge-invariants.ts is the git-history post-merge check. `HOOK POINT FOR E126` is kept once.
  - storage-sqlite: `addTask` refuses a tombstoned id (storage-sqlite.ts:745-749, :809-813), so the old "legally reusable in a re-cut" was stale and the new parenthetical is right.
- No expected-red manifest needed: the diff touches no tests and the build is green.

## Quality
- **Judgment call: the 5 single-line JSDoc comments in tools/lane-status.ts (lines 128, 136, 178, 1131; line 93 has the id in the sentence) — accepted, not required.** The sr's reading is right on the mechanics: AC4's proof `git diff ... | grep -E '^\+.*/\*'` counts ANY added line containing `/*`. Editing the text of an existing `/** ... */` line, including its multi-line conversion, adds such a line and fails the proof. Every one of the five also carries a real explanation (e.g. `/** E178b: mailbox root; when set, each row carries cutPrereview. */`), so it is not a bare-id comment, only a leading id. The remaining cost is small and the conflict is in the spec, not the implementation. **recommended**: if the coordinator wants them fixed, amend AC4's proof first (e.g. "the number of `/*` openers is unchanged and no `//` line became `/*`"). Then the sr can move the ids to trailing position. The same lines also carry `spec decision (g)`, `AC10-AC12`, `spec decision (j)`.
- **O1 (optional)** — Review-process jargon left in untouched lines of edited files: tools/storage-sqlite.ts:356 `NEW-4 fix:`, :779 `NEW-4 fix (review round 1):`; tools/feature-rollup.ts:158 `(round 1 fix)`; tools/lane-migrate.ts:307 `(see NEW-TICKETS.md J2-NEW-2)`, which points to a file outside this repo's tracked docs. Not ticket ids, so AC2 is silent, but it is the same readability debt. Cheap to fold into the R1 pass.
- **O2 (optional)** — There are 137 comment lines in tools/ that still cite `ACn` / `spec ACn`. Most are pointers inside real explanations and fine to keep, but a future pass could drop the ones that are pure spec cross-references.

## Architecture
No architecture spec for this feature. No layering change: AC1 invariance proves emitted JS is identical for all 33 files.

## Security
No findings. No code or string-literal changes. No paths, usernames, internal links or secrets added (AC8 grep empty).

## Performance
No findings. Emitted JS is unchanged (AC1), so there is no runtime delta. The dist `.map`/`.d.ts.map` files change only because comment line offsets moved.

## Verdict
CHANGES_REQUESTED — behaviour invariance and accuracy are solid, but AC2 is only partial: about 13 comments that lead with `e123b9 spec/amendment ACn` in handoff-write.ts, handoff-parse.ts and lane-migrate.ts were missed because the heuristic regex cannot match that id shape, and no constraint justifies leaving them.

(Same-model-bias note: reviewer ran on opus, builder on fable — different models, as recommended.)

### sr-engineer reply — Round 1 (commit 00e38fd)
- **R1 — fixed.** All 13 leading-id comments (handoff-write.ts, handoff-parse.ts, lane-migrate.ts) and the in-sentence ids in lane-paths.ts, lane-registry.ts:54 and role.ts:60 now state the behaviour, with `(E123)` as a trailing pointer; the adjacent `spec ACn` / `amendment ACn` / `J2` / `T-E123B9-02` cross-references in those same blocks were dropped. role.ts:60 now reads in the present tense (overrides are read from `.current/<file>` directly, never through the lane-path resolver). Widened scan (`/\b[Ee]\d+[a-z0-9]*\b/`, plus a leading-id and an `e123bN`-shape pass) over all of `tools/`: `bare-id OK`; remaining hits are the 3 accepted lane-status.ts `/**` lines and two lane-paths.ts lines (138, 311) where `e123b0` / `e123b1` are example inputs to the ticket-id regex, not citations — kept on purpose.
- **O1 — fixed**, plus the same jargon found by a wider grep in owned files: storage-sqlite.ts (both NEW-4 blocks), feature-rollup.ts (round 1 fix), lane-migrate.ts (NEW-TICKETS.md pointer, "pre-J2"), tasks-file.ts voided-row block (Q1/C1/NEW-3/R2-C1 history rewritten to current behaviour), tasks-lane-migrate.ts (AC6b/review round 1), hygiene-scan.ts (4x "code review round n"), registry.ts (NEW-2 notes). Example ids in lane-ticket-allocation.ts (`L-STATE-NEW-3`, `X-NEW-1`) are data, left alone.
- lane-status.ts untouched this round. Re-verified: AC1 `invariance OK: 33 files`; AC3 = 1; AC4 = 0; AC5 unchanged (only the two transitions.ts trailing-comment tails); AC6 nothing outside owned paths, `dist/tools/**` rebuilt and committed, `npx tsc --noEmit` clean; AC8 grep empty.

## Round 2 — APPROVED — by code-reviewer

covers: T-E233A-01, T-E233A-02, T-E233A-03, T-E233A-04, T-E233A-05, T-E233A-06, T-E233A-07, T-E233A-08, T-E233A-09

## Summary
- Round-2 fix range `ae31d66..HEAD` (00e38fd, 7a0fde7): 12 `tools/*.ts` files, +117/-127, all comment lines, plus the rebuilt `dist/tools/**` and the sr reply appended to this report.
- R1 is resolved. Every leading or in-sentence `e123bN` citation is rewritten to describe current behaviour, with `(E123)` as a trailing pointer. The only `e123bN` tokens left in `tools/` are example inputs to the ticket-id regex (lane-paths.ts:138, :311). That is correct, because they are data.
- O1 is resolved, and so is the extra review jargon in tasks-file, tasks-lane-migrate, hygiene-scan, registry, storage-sqlite, feature-rollup and lane-migrate.
- I re-ran every rewrite in this round against the code it describes. None of them misdescribes the code.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — my own copy of the spec's script, run against the whole range `6c61864..HEAD`, printed `invariance OK: 33 files` and exited 0.
AC2 — implemented — a widened scan for `e123b[0-9]` in comment lines finds only the two example inputs at lane-paths.ts:138 and :311. The lane-status.ts `/**` single-line comments are unchanged; the round-1 judgment call (accepted, AC4 conflict) still applies. I read all 25 comment blocks this round rewrote, which covers the 20 the spec asks to sample.
AC3 — implemented — `grep -c '^ *// Watch mode (E178b' tools/lane-status.ts` = 1.
AC4 — implemented — `git diff 6c61864 -- tools/lane-status.ts | grep -E '^\+.*/\*' | wc -l` = 0. lane-status.ts is untouched this round.
AC5 — implemented — the whole-range filter still prints only the two transitions.ts trailing-comment tails (`// E4 (...) — emitted by the` -> `// Emitted by the`, `// E1 (...) — emitted by the` -> `// Emitted by the`). Both were justified in Round 1, and the code before `//` is unchanged.
AC6 — implemented — `git diff --name-only 6c61864` with the owned-path filter printed nothing. `git status --porcelain` shows only `.current/e233a/{handoff.md,dispatch.jsonl}`, which this review's claim write touched and which is an owned path. `npx tsc --outDir <scratch>` exits 0, and every emitted `tools/**/*.js` / `*.d.ts` is byte-identical to the committed `dist/tools/` (0 mismatches).
AC7 — N/A for review (QA-owned full suite).
AC8 — implemented — no added line matches the AC8 pattern (absolute home-directory paths or `http(s)://` URLs). By eye, this round removes jargon ("round 1 fix", "NEW-4 fix", "code review round n", "NEW-TICKETS.md J2-NEW-2", "pre-J2", "spec ACn", "amendment ACn", "Decision 2") and adds none.

## Correctness
No findings. Accuracy checks on the new rewrites:
- **tasks-file.ts:588-600 (voided-row block).** The text now describes current behaviour instead of the Q1/C1/NEW-3/R2-C1 fix history, and it is accurate:
  - "Every other scan in this file trims each line before matching": `parseTasks` trims at :212, the `addTaskInFile` duplicate-id re-scan trims at :770, and the rollback scan trims at :671.
  - "below in `addTaskInFile`" is right, because `addTaskInFile` (:696) follows `voidTaskInFile` (:536).
  - "tests the anchored, unindented pattern against each line's own trim() output" matches :604-605.
  - The `(?=\s|$)`-instead-of-`\b` explanation matches the regex at :604.
  - The fix-history narrative was dropped and the current-behaviour reason kept, which is what the spec's Rewrite rule asks for.
- **handoff-write.ts:266-269.** "writers in different lanes never block each other" is true, because `resolveLaneLockPath(absWorkspace, lane)` composes a per-lane lockfile.
- **lane-migrate.ts:233-236.** "hasFlatLaneFiles still fires on the next read or write, which then finishes the move" is accurate. `hasFlatLaneFiles` gates migration on both entry points (handoff-parse.ts:170, handoff-write.ts:285), and handoff.md-last ordering keeps a flat file present after an interruption.
- **lane-migrate.ts:305-308.** "it cannot close it, so a line appended inside that gap can still be lost" states the remaining risk in plain words, replacing the pointer to an untracked file.
- **lane-registry.ts:54.** "for two reasons:" introduces the existing (1)/(2) list that follows, so it reads correctly.
- **role.ts:60-62.** Now in the present tense and accurate: `hasOverride` joins `.current/<f>` directly (:63-64), not through the lane resolver.
- **handoff-parse.ts / lane-paths.ts / storage-sqlite.ts / registry.ts / tasks-lane-migrate.ts / hygiene-scan.ts / feature-rollup.ts.** Each rewrite keeps the original technical content minus the ticket, AC and round references. No meaning was lost or changed.
- No expected-red manifest needed: the diff touches no tests.

## Quality
- **optional**: two awkward reflows. tools/hygiene-scan.ts:186-188 leaves a ragged short line (`// progress guard stops the loop if exec ever fails` / `// to move past the previous start.`). tools/tasks-lane-migrate.ts:85 merged two sentences onto one 126-char JSDoc line instead of re-wrapping. Both are cosmetic, and the file already has lines this long, so neither blocks approval.
- The round-1 lane-status.ts `/**` judgment call is carried forward unchanged (recommended, needs an AC4 spec amendment first).

## Architecture
No architecture spec. No layering change: AC1 invariance holds across all 33 files.

## Security
No findings. The change is comment-only, and AC8's grep is empty.

## Performance
No findings. Emitted JS is identical (AC1 plus the scratch-build byte comparison).

## Verdict
APPROVED — R1 and O1 are fully addressed, the new rewrites are accurate against the current code, and AC1-AC6 and AC8 hold over the whole range `6c61864..HEAD`.

(Same-model-bias note: reviewer on opus, builder on fable.)
