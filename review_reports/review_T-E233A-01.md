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
AC8 — implemented — no `/Users/`, `/home/` or `http(s)://` in added lines. By eye, the rewrites mostly remove governance jargon ("review round", "spec AC", "PM-ratified", "option a-min"). The leftovers are in untouched lines (see R1 and O2).

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
