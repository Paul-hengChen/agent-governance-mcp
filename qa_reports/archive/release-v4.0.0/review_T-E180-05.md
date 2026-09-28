# Review — T-E180-05

covers: T-E180-01, T-E180-02, T-E180-03, T-E180-04, T-E180-05

## Round 1 — by qa-engineer

## Summary
- Scope: author `test/e180-abandoned-harvest.test.mjs` covering
  `specs/e180-abandoned-harvest.md` AC1-AC13 (amended AC10 copy-over-never-
  delete; AC12 adopter-project `.gitignore` shape + flat legacy primary
  `.current/`), and issue the QA verdict for T-E180-01..05.
- Code under test: `bin/agc-init.mjs` commits b762a89 (E180), 098be72
  (E194), d3053b9 (E197). Code-reviewer APPROVED
  (`review_reports/review_T-E180-01.md`, covers T-E180-01..04); one
  non-blocking recommendation (cpSync `dereference:true`) filed as
  `E180-NEW-2` in `.current/e180/pending-tickets.md`, out of this cut.
- Phase 0.5 (Expected-Red Diff): skipped (no
  `qa_reports/expected-red_e180-abandoned-harvest.txt` manifest declared).
- Phase 1.5 (Visual Compare): skipped (no `design/e180-abandoned-harvest.md`;
  spec's own Visual Tokens/Widgets tables are both N/A — CLI-only feature).

## Copy Audit Gate
All five `## Copy / Strings` entries checked verbatim against
`bin/agc-init.mjs`:
- `e180.evidence-harvest-line` — bin/agc-init.mjs:1506-1512 — verbatim match
  (checked by eye and asserted char-for-char in the new AC1 test).
- `e180.evidence-harvest-refuse-line` — bin/agc-init.mjs:1463-1468 — verbatim
  match, asserted in the new AC3 test.
- `e194.current-harvest-line` (both `{reason}` branches) — bin/agc-init.mjs:
  1622-1630 — verbatim match; both reason clauses ("git-ignored in this
  workspace" and "never committed ... nothing durable to keep") are each
  exercised by a distinct new test (AC12 and AC7 respectively).
- `e194.current-harvest-refuse-line` — bin/agc-init.mjs:1582-1586 — verbatim
  match, asserted regex-exact (via an escaped-literal RegExp) in the new AC9
  test.
- `e197.pointer-fallback-string` — bin/agc-init.mjs:1891-1896 — verbatim
  match, asserted in the new AC13 test.
No drift, no coverage gap (every user-facing string introduced by this cut is
listed in the spec's Copy/Strings table and is covered above).

## Visual Audit Gate
N/A — spec's Visual Tokens / Visual Widgets tables are both explicitly `N/A`
(CLI stdout/stderr only feature, no design file).

## AC Execution Log
Every AC's `proof:` annotation executed before this PASS:

- AC1-AC12 — `node --test test/e180-abandoned-harvest.test.mjs` — exit 0,
  `# pass 13 / # fail 0 / # tests 13` (all 13 tests in the new file, one per
  AC1-AC12 plus AC13's own test in the same file — see below).
- AC13 — `node --test test/agc-feature-finish-history.test.mjs` (the
  existing pointer-parsing tests, required to keep passing UNCHANGED) — exit
  0, `# pass 19 / # fail 0 / # tests 19`. Plus the new file's own AC13 test
  (`test("AC13: closedLanePointerLine's fallback clause reads
  case-insensitive git log -i --grep", ...)`) — included in the 13/13 above —
  asserts a freshly composed pointer line contains `git log -i --grep`.

All proofs ran clean; no proof's command failed and no observed outcome
contradicted its AC text.

## Spec-to-Test Map
| AC | test |
|---|---|
| AC1 | "AC1: an untracked, git-ignored evidence file is harvested into primary before the move" |
| AC2 | "AC2: an evidence dir symlinked outside the worktree gets no primary copy" |
| AC3 | "AC3: a differing primary destination refuses before any mutation" |
| AC4 | "AC4: an identical primary destination does not refuse" |
| AC5 | "AC5: a plain untracked (non-ignored) evidence file is unaffected — pre-existing behavior" |
| AC6 | "AC6: the evidence harvest is idempotent across a later-step failure and re-run" |
| AC7 | "AC7: an all-untracked .current/<ticket>/ is harvested in full, no exclusions" |
| AC8 | "AC8: a tracked .current/<ticket>/ gets no harvest copy" |
| AC9 | "AC9: a non-directory blocking the history path refuses before any mutation" |
| AC10 | "AC10: a pre-existing history directory is refreshed by copy-over, never delete" |
| AC11 | "AC11: a lane with no .current/<ticket>/ at all harvests nothing and errors on nothing" |
| AC12 | "AC12: the acceptance-project-shaped adopter workspace — both harvests fire end-to-end" |
| AC13 | "AC13: closedLanePointerLine's fallback clause reads case-insensitive git log -i --grep" |

A load-bearing empirical fact underpinning most fixtures: `git worktree
remove` (never `--force`) refuses over modified or untracked-and-NOT-ignored
content, but not over untracked content that IS git-ignored — verified
directly against the system `git` before writing the tests (not assumed from
the spec text alone). This is why AC1/AC4/AC6/AC7/AC10/AC12 reach a full,
clean end-to-end run (worktree removed, exit 0) while AC5's plain (non-
ignored) untracked leftover reproduces today's pre-existing refusal
unchanged, same shape as the already-passing `test/agc-feature-
lifecycle.test.mjs` AC22 test.

## Coverage Gate
New/modified files for this task: `test/e180-abandoned-harvest.test.mjs`
only (a new test file; `bin/agc-init.mjs` is unmodified by T-E180-05). Every
line of the E180/E194/E197 harvest logic the code-reviewer cited
(`planAbandonEvidenceHarvest`/`evidenceAtRisk`/`applyAbandonEvidenceHarvest`/
`planAbandonCurrentHarvest`/`executeAbandonCurrentHarvest`/
`closedLanePointerLine`'s fallback clause) is exercised by at least one new
test, including both branches of `evidenceAtRisk`'s at-risk predicate (ignored
vs. safely-linked-outside), both `sameFileBytes` branches (AC3 vs AC4), both
`planAbandonCurrentHarvest` gates (AC8 tracked vs AC7 untracked), and the
AC9/AC10 non-directory-refuse vs. directory-refresh split.

## Security Smoke
No new input surface is introduced by T-E180-05 (test-only change). The
boundary/injection smoke tests for `agc feature start`/`finish` argument
parsing already exist and are unchanged in
`test/agc-feature-lifecycle.test.mjs` (`boundary:` section) and
`test/agc-feature-finish-history.test.mjs` (the `-->` branch-name test) — both
re-run clean as part of the full-suite gate below, not duplicated here.

## Correctness / Quality
- Confirmed independently (not just re-reading the code-reviewer's repro
  text): both `evidenceAtRisk` short-circuit branches, the `sameFileBytes`
  conflict/no-conflict split, the E194 hoisting order (`planAbandonCurrentHarvest`
  runs before `applyPendingOnAbandoned`/`applyAbandonEvidence`, so a stray-file
  refusal at AC9 leaves an unrelated evidence file untouched — asserted
  directly in the new AC9 test), and the AC10 copy-over-never-delete
  guarantee (a history-only file surviving a re-harvest byte-identical, which
  an `rm`-then-copy implementation would fail) all hold under fresh,
  independently-authored fixtures.
- No required findings. The one recommended item from code review
  (`dereference: true` on the E194 `cpSync`, `bin/agc-init.mjs:1614`) is
  already tracked as `E180-NEW-2`, correctly scoped out of this cut (rare
  shape: agc itself never writes symlinks under `.current/<lane>/`).

## Verdict
PASS. AC1-AC13 are each covered by a dedicated, independently-verified test;
the Copy Audit Gate found no drift and no coverage gap; every `proof:`-
annotated AC's command was executed and logged above; no correctness issue
was found beyond the already-filed, out-of-cut recommendation.
## 2026-09-26T19:29:50.771Z — PASS — by qa-engineer

PASS — T-E180-01..05. Authored test/e180-abandoned-harvest.test.mjs covering specs/e180-abandoned-harvest.md AC1-AC13 (13 new tests, all passing), including the amended AC10 copy-over-never-delete semantics and the AC12 adopter-project .gitignore shape against a flat legacy primary .current/. Copy Audit Gate: all 5 Copy/Strings entries verbatim, no drift, no coverage gap. Visual Audit Gate: N/A (no visual literals). Phase 0.5: skipped (no expected-red manifest). Phase 1.5: skipped (no design file). Phase 3.5 AC Execution Log: node --test test/e180-abandoned-harvest.test.mjs (13/13 pass) and node --test test/agc-feature-finish-history.test.mjs (19/19 pass, existing pointer-parsing tests unchanged) — see qa_reports/review_T-E180-05.md. Full suite post-commit, clean worktree: 2661/2661 pass. No required findings; the one code-review-recommended item (cpSync dereference:true) is already tracked as E180-NEW-2, correctly out of this cut.

