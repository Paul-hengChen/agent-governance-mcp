# Review — T-E226-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff judged: `git diff fac8990 aecfd29 -- content docs` (lane `e226`, feature `e226-integrator-sop-portable`). Spec: `specs/e226-integrator-sop-portable.md`. No architecture spec exists for this feature. Reviewer tier opus, same tier as sr-engineer (pin `sr-engineer: opus`). Same-model bias is possible, so every Copy/Strings id below was checked by an exact substring script, not by reading.

## Summary
- T-E226-01 adds the **Tool calls** paragraph to `content/skill-integrator.md`, moves every agc tool call to `node <agc install>/scripts/<tool>.mjs`, makes every CI verdict "the repo's CI check", and sets the Stage 6 step 1 `agc` fallback.
- All four strings this task owns (`sop.tool-calls`, `sop.ci-call`, `sop.ci-6-2`, `sop.stage6-finish`) occur exactly once and verbatim. Nothing in the diff goes beyond scope.
- One lane-wide `required` finding: the expected-red manifest is missing while about 28 intentional reds exist (SOP step 4a). This is a procedural gap, not a text defect.
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC-E226-1 — implemented — `grep -c "node scripts/" content/skill-integrator.md` = 0. Counts in `<agc install>` form: fanout ×12, mailbox-watch ×2, lane-status ×6, merge-invariants ×3, test-lock ×2. No bare `scripts/<x>.mjs` is left.
AC-E226-2 — implemented — content/skill-integrator.md:68 has exactly one `**Tool calls**` paragraph. It sits after the `Invocation:` paragraph (:66) and before `## Governance state (D11)` (:70), and it equals `sop.tool-calls` verbatim.
AC-E226-3 — implemented — 0 matches for `this repo` (case-insensitive). The only `bin/agc-init.mjs` is the `<agc install>/bin/agc-init.mjs` form at :68. Stage 6 step 1 (:196) carries `sop.stage6-finish`.
AC-E226-4 — implemented by T-E226-02 (see review_T-E226-02.md).
AC-E226-5 — implemented — `verify-release` count = 0. "the repo's CI check" appears 7 times: the definition at :68, plus the six sites (5a test claim :150, verifier bullet :163, 5b-6 :180, Stage 6-2 :200, Stage 6-4 :202, *Your own commits* :207). In step 4, `merge-invariants.mjs` comes before the single `the repo's CI check on `<HEAD>``. The test-claim mismatch cell keeps `record the run id`.
AC-E349-1..3 — see review_T-E349-01.md.
AC-E350-1..2 — see review_T-E350-01.md.
AC-X-1 — out of sr scope (qa final gate T-E226-05). The diff contains no `dist/` file.

## Correctness
- **required** — `qa_reports/expected-red_e226-integrator-sop-portable.txt` does not exist, yet intentional reds clearly do. A run of the 46 content-related test files on `aecfd29` shows 28 red tests. Code-reviewer SOP step 4a makes a missing manifest a CHANGES_REQUESTED finding. The path is inside the lane's bounds: `isImplicitBookkeeping` accepts any `qa_reports/` basename that contains the lane name. Write it as `file | test name` lines. Besides the sr's catalogue it must also list:
  - `test/e178a-integrator-role.test.mjs | AC9: SOP merge stage …` (:285, `a `dist/` or golden regeneration is not substantive` → `sop.5b-5`);
  - `test/skill-manifest.test.mjs | t-golden-byte-identity (AC1/AC5): composeSkill("skill-coordinator.md", {taskTool:true}) === frozen golden monolith, byte-for-byte`. This test is red because coord-03 text changed. It clears when T-E350-03 regenerates `skill-coordinator-monolith.txt`. The spec's re-pin table names the fixture but not this test, and the AC-E350-2 proof command does not run this test file.
- Every red maps to an intended text change; I checked the assertion site of each one. Task-owned reds: e178a AC2 (:103 mechanism list) and AC13 (:349), e285 AC-E344-1 (:113), e292 AC-E292-9 ×3 (:46/:73/:81), e295 AC6/AC7, e296 AC6 (:174/:178), e329 AC-E329-1 (STAGE6_CLOSE), AC-E329-3 (COND2) and AC-E334-3 (red only because `indexOf(STAGE6_CLOSE)` is -1; `count(STAGE6, STAGE6_FINDINGS) === 1` at :121 passes).
- Six other test files that mention the changed tokens are green: e115, e132, e178b, e320, e326, e92 (213/213).
- Hard-condition set e290 / e294 / e177a / e246 / e289: 49/49 pass. None of those files is in the diff.

## Quality
- **optional** — content/skill-integrator.md:202. The existing phrase "This wait is the wave's CI check" now sits close to the defined term "the repo's CI check". The two terms mean different things (PR required checks versus the per-sha verdict), and the spec does not ask for a change. Leaving it is fine.
- I sampled the path-token changes. Arguments and the surrounding sentence are byte-identical, and the word-diff shows only the path token changing at every `<agc install>` site.

## Architecture
No architecture spec. The change matches the cut decisions: one definition site (`sop.tool-calls`) with use everywhere else, verify-release never in `<agc install>` form, and repo facts sent to the addendum. The SOP gains no "this repo's rules never appear here" sentence (grep for `never appear` / `rules never`: 0).

## Security
No findings. The diff adds no absolute local path (grep for `/Users/` = 0) and no internal link. The new text cites Constitution §6 generically. No secrets.

## Performance
No findings. The change is text only, with no runtime code path. The integrator SOP is in no golden and no context budget.

## Verdict
CHANGES_REQUESTED — all text for T-E226-01 is correct and verbatim. The lane must still commit the expected-red manifest (SOP step 4a) before qa disposes of the 28 intentional reds; the fix is that one file.

## Round 2 — APPROVED — by code-reviewer

Diff judged: `aecfd29..dccf3f7` (sr reply to round 1). `git diff aecfd29 dccf3f7 --stat` touches no `content/**`, `docs/**`, `test/**` or source file. The only non-state changes are `qa_reports/expected-red_e226-integrator-sop-portable.txt` (new, 49 lines) and one new `pending-ticket` block, E226-NEW-3, in `.current/e226/pending-tickets.md`. The round-1 text verdicts therefore still apply unchanged. Reviewer tier opus.

## Summary
- Round 1's single `required` finding (missing expected-red manifest, SOP step 4a) is fixed. The manifest exists, parses, and matches the actual red set exactly.
- Full serial suite on the lane HEAD (`node --test --test-concurrency=1 test/*.test.mjs`): 3557 tests, 3528 pass, 27 fail. The 27 failing test names are exactly the 27 manifest rows: 0 unlisted reds, 0 listed-but-green rows.
- Count reconciliation: round 1's "about 28" double-counted one test. `test/e178a-integrator-role.test.mjs` AC13 is owned by both T-E226-01 (`:349`) and T-E349-01 (`:348`, `sop.verifier-build`), and the per-task tallies were 12 + 5 + 11 = 28. There are 27 unique tests. The sr's 27 is correct.
- Recommended follow-up from round 1 is filed as E226-NEW-3 (P3, `depends_on: [E349]`). Its body matches the finding.
- Verdict: APPROVED.

## AC Completeness
Unchanged from round 1. No content changed after `aecfd29`, so every AC verdict recorded in round 1 stands.

## Correctness
- Round-1 `required` finding: **resolved**. `qa_reports/expected-red_e226-integrator-sop-portable.txt` has 27 data rows in `<relative test file path> | <exact test name>` form. Blank and `#` lines are comments, per sr SOP 7a and qa SOP 2a. A parse script checked every row: each has exactly one ` | ` separator, the file exists, there are no duplicates, and the test name is locatable in that file. SOP 4a sampling covered all 27 rows, not only 3.
- Per-file red counts, each file run on its own: e178a 3, e285 1, e286 1, e292-integrator-sop 3, e295 4, e296 1, e329 3, context-budget 4, compose-equivalence 6, skill-manifest 1 (total 27). The three other e292-* files are green (8/8, 51/51, 15/15).
- Both round-1 additions are present: e178a AC9 and skill-manifest `t-golden-byte-identity (AC1/AC5)`.
- The NOT-OWNED header comment is correct. compose-equivalence ×6 and skill-manifest ×1 clear only when qa regenerates the goldens in T-E350-03. The comment says those test files are never edited, and it tells qa to add `test/skill-manifest.test.mjs` to the T-E350-03 run, since the AC-E350-2 proof command does not run it.
- The suite run left the worktree clean: `git status --porcelain` shows only the lane's own handoff/dispatch state.
- This task's reds are all listed: e178a AC2 and AC13, e285 AC-E344-1, e292 AC-E292-9 ×3, e295 AC6 and AC7, e296 AC6, and e329 AC-E329-1, AC-E329-3 and AC-E334-3. They sit under the integrator-SOP header (re-pin T-E226-03).

## Quality
No findings. The comment headers name the owning qa re-pin task for each group (T-E226-03 / T-E349-02 / T-E226-05, T-E350-03), which is the grouping style sr SOP 7a asks for.

## Architecture
No architecture spec exists for this feature. Both new files are inside the lane's bookkeeping bounds (`qa_reports/` basename carries the lane name; `.current/e226/`).

## Security
No findings. Plain-text manifest and a ticket note. No paths outside the repo, no secrets, nothing sensitive in the comments.

## Performance
No findings. No runtime code changed.

## Verdict
APPROVED — the only blocking finding from round 1 is resolved, the manifest is parseable and matches the actual 27-test red set exactly, and no content changed after round 1.
