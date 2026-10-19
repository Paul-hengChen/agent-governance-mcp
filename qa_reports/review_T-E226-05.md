covers: T-E226-01, T-E226-02, T-E226-03, T-E226-04, T-E226-05, T-E349-01, T-E349-02, T-E350-01, T-E350-02, T-E350-03

# QA review: e226-integrator-sop-portable (E226 + E349 + E350)

Verdict: PASS (see Final gate for the committed-HEAD full-suite numbers).
Scope: text-only wave. Implementation commit aecfd29 (sr-engineer), code-reviewer round 2 APPROVED (review_reports/review_T-E226-01.md, review_T-E226-02.md, review_T-E349-01.md, review_T-E350-01.md).

## Expected-Red Diff

Phase 0.5, manifest `qa_reports/expected-red_e226-integrator-sop-portable.txt` (27 rows, feature mode so advisory). Full suite run BEFORE any re-baseline edit, serially under test-lock, on the lane HEAD after aecfd29 (no content change since): 3557 tests, 3528 pass, 27 fail. The 27 failing test names were collected from the TAP output and compared with the 27 manifest rows.

Phase 0.5: clean (27/27 manifest entries confirmed red, 0 unexplained reds). 0 extra, 0 missing.

Disposition of each manifest row, after the re-baseline:
- e178a AC2, AC9, AC13: re-pinned (T-E226-03 / T-E349-02), green.
- e285 AC-E344-1: re-pinned to the `<agc install>` form (T-E226-03), green.
- e286 AC1: re-pinned to the sop.basefix-5 wording (T-E349-02), green.
- e292 AC-E292-9 x3: re-pinned to the `<agc install>` form (T-E226-03), green.
- e295 AC6, AC7: re-pinned to "the repo's CI check on" (T-E226-03), green. AC8, AC10: re-pinned to sop.verifier-build / sop.5c-3 (T-E349-02), green.
- e296 AC6: re-pinned (SOP assertion only), green.
- e329 AC-E329-1, AC-E329-3, AC-E334-3: STAGE6_CLOSE and COND2 path tokens re-pinned; STAGE6_FINDINGS unchanged, green.
- context-budget x4 (skill-pm cap, constitution floor, teamwork bundle, non-design floor): re-baselined to measured values (T-E350-03), green.
- compose-equivalence x6 and skill-manifest t-golden-byte-identity (not owned by this lane): turned green only by regenerating the goldens with the capture script. Neither test file was edited.

## Copy Audit (Phase 1, 3a)

Every string in the spec's Copy / Strings table was checked against the shipped text, verbatim, by the new tests: sop.tool-calls, sop.ci-call, sop.ci-6-2, sop.stage1-shared, sop.basefix-5, sop.stage6-finish, sop.5a-evidence, sop.5a-findings, sop.verifier-build, sop.5b-4, sop.5b-5, sop.5b-6, sop.5c-3 (test/e226-integrator-sop-portable.test.mjs, test/e349-integrator-repo-facts.test.mjs); add.5-tools, add.5-ci, add.5-bookkeeping (e349 test); pm.manifest-row, const08.cond3, coord03.writer, coord03.rollup (test/e350-fanout-call-form.test.mjs). No drift. No user-facing string outside the table: the diff against the cut base touches only content/skill-integrator.md, content/skill-pm.md, content/const-08-chain-31-mid.md, content/coord-03-core-fallback.md and docs/lane-protocol-addendum.md. Phase 1.5 skipped (no design file, no Visual Baselines declared). 3b skipped (Visual Tokens N/A).

## AC to test map

| AC | test |
|---|---|
| AC-E226-1..5 | test/e226-integrator-sop-portable.test.mjs (5 cases, one per AC) |
| AC-E349-1, AC-E349-2 | test/e349-integrator-repo-facts.test.mjs (2 cases) |
| AC-E349-3 | hard-condition run below (existing files, unchanged) |
| AC-E350-1 | test/e350-fanout-call-form.test.mjs (4 cases) plus e296 AC1-AC3 |
| AC-E350-2 | compose-equivalence, e90-golden-capture-completeness, context-budget (+ skill-manifest) |
| AC-X-1 | Final gate below |

Resident-test hygiene (Phase 3f): the new tests read only content files and the addendum, not any `specs/fanout-*.md`, and diff against no base sha. No local absolute paths in tests or this evidence.

Negative control: a copy of the integrator SOP outside the worktree with one `the repo's CI check on <HEAD>` site changed back to a `verify-release` mention makes the AC-E226-5 case fail (4 pass, 1 fail). Not done with `git stash`.

Test re-pins (owned files only; assertions keep their intent, wording changed to the new text):
- e178a: AC2 list entry `verify-release.mjs --ci-check` to `the repo's CI check`; AC9 `a dist/ or golden regeneration` to `a build-output or golden regeneration` (sop.5b-5, the reviewer's addition); AC13 verifier build bullet to sop.verifier-build and CI bullet to sop.ci-call.
- e285: RESUME sentence path token to `node <agc install>/scripts/lane-status.mjs`.
- e286: base-fix need() list and item(5) to `the repo's build` and `the dependency audit Constitution §6 requires`. Only SOP assertions touched; lane-protocol sentences untouched.
- e292: three path tokens to `<agc install>`.
- e295: AC6 and AC7 to `the repo's CI check on`; AC8 to the sop.verifier-build phrase; AC10 to the sop.5c-3 sentence exactly once in 5c, plus `npm run check:bookkeeping` exactly once in the addendum (add.5-bookkeeping).
- e296: AC6 step 4 `the repo's CI check on <HEAD>` exactly once and merge-invariants before it. AC1-AC3, AC10 untouched.
- e329: STAGE6_CLOSE and COND2 path tokens only; STAGE6_FINDINGS unchanged.

## Golden hunks (T-E350-03)

Regenerated with `node scripts/capture-constitution-golden.mjs` after `npm run build` (no dist diff). Exactly 7 of 12 fixtures changed, 8 lines in total, all the E350 call-form change and nothing else:
- build-full-design.txt, build-full-design-fd.txt, build-full-nondesign.txt, build-full-nondesign-fd.txt, hook-full.txt, constitution-monolith.txt: one hunk each, in const-08 manifest-tier condition 3: `scripts/fanout.mjs` becomes `<agc install>/scripts/fanout.mjs`.
- skill-coordinator-monolith.txt: two hunks in coord-03. (a) the Feature-close roll-up obligation: `scripts/feature-rollup.mjs` becomes `<agc install>/scripts/feature-rollup.mjs` (coord03.rollup). (b) the Manifest-tier writer action: `scripts/fanout.mjs` becomes `<agc install>/scripts/fanout.mjs` (coord03.writer).
- skill-pm text is in no golden. The lite goldens and hook-lite are unchanged.

## Context budget re-baseline (T-E350-03)

Each new cap equals the measured value (zero headroom); each has a bump-history comment in the test.
- skill-pm stripped: 4823 to 4849 (+26): the PM Manifest-Tier row gains the `<agc install>/` path token and the inline `<agc install>` definition.
- rationale-stripped design-arm constitution: 10523 to 10527 (+4): const-08 condition 3 path token.
- teamwork bundle: 21633 to 21644 (+11): const-08 cond 3 plus coord-03 writer action plus coord-03 roll-up, three path tokens.
- non-design constitution: 8426 to 8429 (+3): const-08 cond 3 path token (same edit as the design-arm +4; the one-token difference is chars/4 rounding on a different total).
The comment-only mentions of the old caps in the test header lines were updated to the same numbers. The other thresholds (raw-minus-stripped savings floors) were not touched and still pass.

## AC Execution Log

Phase 3.5, proofs from the spec.
- AC-E226-1..5: `node --test test/e226-integrator-sop-portable.test.mjs`: 5 pass, 0 fail. Spot checks: `grep -c "node scripts/" content/skill-integrator.md` = 0 and `grep -c "verify-release" content/skill-integrator.md` = 0.
- AC-E349-1, AC-E349-2: `node --test test/e349-integrator-repo-facts.test.mjs`: 2 pass, 0 fail. Addendum diff against main touches only three added lines in §5 (the e349 test also pins §7 and the heading list byte for byte).
- AC-E349-3: `node --test test/e290-lane-protocol-generic.test.mjs test/e294-lane-enterworktree.test.mjs test/e177a-manifest.test.mjs test/e246-mailbox-teardown.test.mjs test/e289-render-addendum.test.mjs`: 49 tests, 49 pass, 0 fail. `git diff --name-only main...HEAD` over those five files prints nothing.
- AC-E350-1: `node --test test/e350-fanout-call-form.test.mjs test/e296-manifest-tier.test.mjs`: pass, 0 fail.
- AC-E350-2: `node --test test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/context-budget.test.mjs test/skill-manifest.test.mjs`: pass, 0 fail (together with the e350/e296 run: 138 tests, 138 pass).
- AC-X-1: see Final gate.

## Final gate (AC-X-1)

Filled in below after the committed-HEAD run.
