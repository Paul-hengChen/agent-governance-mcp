# Review — T-E164-02

covers: T-E164-01, T-E164-02

## Summary
- QA verification of feature `e164-e167-content-wave45` (docs/backlog.md rows E164/E167 + NEW-TICKETS.md L-CONTENT-NEW-1/NEW-3; L-CONTENT-NEW-5 resolved in-cut). T-E164-01 (sr-engineer, fable) is code-reviewer round-2 APPROVED (`review_reports/review_T-E164-01.md`). T-E164-02 is this QA task: content-assertion tests for AC1-AC7, golden regen, skill-pm floor re-baseline, full suite, `check:md-tables`.
- Wrote `test/e164-e167-content.test.mjs` (new, pre-authorized): 14 content-assertion tests covering AC1-AC7, independent of the sr-engineer/code-reviewer prose claims — these read the shipped wording in `content/skill-release-engineer.md`, `content/skill-coordinator-lite.md`, `content/skill-pm.md` directly. All 14 pass.
- Independently re-measured the skill-pm stripped body via the same `stripRationale(stripOriginTags(expandSkill(body)))` / `approxTokens` pipeline `test/context-budget.test.mjs` uses (against the built `dist/prompts/build.js` + `dist/prompts/partials-manifest.js`): **4401 ~tok exactly**, matching sr's reported figure (not merely trusted from the handoff note). Re-baselined the ONLY floor this feature may move — `test/context-budget.test.mjs`'s skill-pm cap, 4376 → 4401 — with a comment following the file's established re-baseline convention. Independently re-measured the lean always-on floor at **4865 ~tok**, confirming it stays `<= 4868` unchanged — no other floor touched.
- Ran `node scripts/capture-constitution-golden.mjs` (script untouched): "Captured 12 golden fixtures into test/fixtures/compose-golden/"; `git status --porcelain=v1 test/fixtures/compose-golden/` and `git diff --stat test/fixtures/compose-golden/` both empty afterward — **zero diff**, as expected (none of the 3 edited content files are baked into any of the 12 fixtures).
- Full `npm test`: **2332/2332 pass, 0 fail** (2318 prior total + 14 new tests). `node scripts/check-md-tables.mjs`: exit 0, "OK (260 file(s) scanned, 0 malformed tables)" — the 4 printed lines are pre-existing, non-blocking advisory notes on `docs/backlog.md` rows this feature never touches.
- `git diff --name-only` + untracked files stay within the AC11 allow-list: `content/skill-release-engineer.md`, `content/skill-coordinator-lite.md`, `content/skill-pm.md`, `NEW-TICKETS.md`, `tasks.md`, `.current/**`, `qa_reports/**`, `review_reports/**`, `test/e164-e167-content.test.mjs`, `test/context-budget.test.mjs`. `test/fixtures/compose-golden/**` untouched (AC8 produced zero diff, so no write was needed). Nothing in `tools/`, `gates/`, `guards/`, `prompts/`, `bin/`, `schema/`, `index.ts`, `templates/`, `scripts/`, `docs/`.
- Verdict: **PASS** on both T-E164-01 and T-E164-02.

## Expected-Red Diff
Phase 0.5: clean (1/1 manifest entries confirmed red pre-re-baseline, 0 unexplained reds). `qa_reports/expected-red_e164-e167-content-wave45.txt` manifests exactly one entry: `test/context-budget.test.mjs | AC1/AC2: skill-pm stripped token count meets ≤ 4376 cap`. Before my AC9 re-baseline edit, the cap was 4376 and the independently-measured actual stripped body was 4401 ~tok — that assertion (`toks <= 4376`) fails exactly as manifested; the code-reviewer's round-2 report independently observed the same single failure in a 2317/2318 run. After the re-baseline edit (cap raised to the exact measured value, 4401), the full suite is 2332/2332 green with no reds. No entry is unexplained; no genuine regression.

## AC Execution Log
Phase 3.5: skipped (no `specs/<active_feature>.md` exists — mini-chain, backlog-row-as-spec per `scope_decision_why` — so there are no `proof:`-annotated ACs to scan).

## Correctness (QA scope: tests / test-infra only — correctness/architecture is code-reviewer's domain per Hard rules)
Verified AC1-AC7 and AC11 directly against the shipped diff, independent of the review report's claims — see `test/e164-e167-content.test.mjs` (14 tests, all green):
- **AC1**: 8b sequences the first CI-gate attempt at the normal budget, forbids pre-emptively lowering it, and only lowers `AGC_VERIFY_CI_WAIT_SECONDS` below the host timeout after the first observed host-level silent kill; a run that then hangs ends in the script's own printed strict FAIL. Confirmed present and in the required order.
- **AC2**: the `fix_try` cap (named, never restated as a bare number) bounds consecutive silent-kill re-runs and routes to Blocked/human on exhaustion; the Escalation Routes step-8b row matches the sequenced wording and also names `fix_try`; every 8b STOP path (printed non-PASS result AND the cap-exhaustion path) deletes any unpushed local tag with `git tag -d` before the Blocked write, scoped to never touch a published tag.
- **AC3**: 9a cross-references 8b's sequenced budget advice and names `DEFAULT_WAIT_SECONDS`; the 9a step body contains no bare "480" literal (the sole remaining "480" in the file is the pre-existing, historical E82 rationale block, outside the 9a step body).
- **AC4**: 8c's `git tag -a` bullet is explicitly local/reversible and permitted any time after step 8a completes, including before 8b; the `git push origin vX.Y.Z` bullet is the one act gated strictly on `CI-CHECK PASSED` and is the one named irreversible. Step labels 8a/8b/8c/9/9a are all present, unrenumbered.
- **AC5**: E164+E167 land in a single edit pass of `content/skill-release-engineer.md` — confirmed via `git diff HEAD -- content/skill-release-engineer.md`: every hunk (8a push-bullet parenthetical, 8b host-kill paragraph, 8b tag-deletion clause, 8c tag/push split, 9a cross-reference) is in that one file, one diff. Not test-assertable per the dispatch brief; recorded here as evidence.
- **AC6**: `content/skill-coordinator-lite.md` no longer contains an inline `id | desc |` cut-header column list anywhere in the file, and its cut-approval halt bullet now reads "header per skill-pm *Cut-Approval Gate*".
- **AC7**: `content/skill-pm.md`'s `touches` definition line now reads "...the ticket writes, excluding governance bookkeeping (`tasks.md`, `.current/**`, `qa_reports/**`, `review_reports/**`); lane tickets' sets must be disjoint." — all four excluded globs present verbatim.
- **AC11**: see Summary — diff/untracked scope holds.

**AC9** (independent re-measurement): measured skill-pm stripped body at exactly 4401 ~tok using the production pipeline (matches sr's reported figure, not trusted from the handoff note). Raised the cap 4376 → 4401 with a re-baseline comment following the file's established convention. Independently re-measured the lean always-on bundle (the other floor in the file) at 4865 ~tok — still `<= 4868` — confirming no other floor needed to move.

**AC8**: `node scripts/capture-constitution-golden.mjs` produced zero diff under `test/fixtures/compose-golden/` (12 fixtures re-captured; git status clean afterward), as expected.

**AC10**: `npm test` → 2332/2332 pass, 0 fail. `node scripts/check-md-tables.mjs` → exit 0, 0 malformed tables.

## Quality
No findings beyond code-reviewer's non-blocking nits (`review_reports/review_T-E164-01.md` Round 2 Quality section), which are outside QA's FAIL scope per Hard rules.

## Architecture
Out of QA scope (code-reviewer's domain); code-reviewer's round-2 Architecture section holds (step labels unrenumbered, E167 seam inside 8c, single-file edit).

## Security
No findings. Prose-only edits to governance-documentation content files; no executable code path or untrusted input is introduced. Security Smoke Tests (boundary inputs / auth-permission tests) are N/A for this feature — there is no code path handling external input to test boundary conditions against.

## Performance
No findings. Context-budget impact is exactly and only the skill-pm floor move (4376 → 4401), independently re-measured. The lean always-on floor is confirmed unaffected (4865 <= 4868).

## Verdict
**PASS**: T-E164-01 (sr-engineer's content edit, code-reviewer round-2 APPROVED) and T-E164-02 (this QA verification task). AC1-AC11 hold, independently verified. Full suite green (2332/2332), `check:md-tables` clean, golden capture zero-diff, diff/untracked scope within the AC11 allow-list.
## 2026-09-23T09:58:38.289Z — PASS — by qa-engineer

PASS: AC1-AC11 independently verified (test/e164-e167-content.test.mjs, 14 tests). AC9 skill-pm floor re-measured at 4401 ~tok exactly, cap raised 4376->4401 (only floor moved); lean always-on floor re-measured 4865 (<=4868, unaffected). AC8 golden capture: zero diff. AC10: npm test 2332/2332, check-md-tables OK. AC11 diff/untracked scope holds. See qa_reports/review_T-E164-02.md.

