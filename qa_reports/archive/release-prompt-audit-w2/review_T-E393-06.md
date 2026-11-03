covers: T-E393-01, T-E393-02, T-E393-03, T-E393-04, T-E393-05, T-E393-06

# QA review — E393 builder-judge-core (T-E393-01..06)

Verdict: PASS. Reviewer: qa-engineer (sonnet), Task-dispatched. Code review: APPROVED (review_reports/review_T-E393-01.md).

## Expected-Red Diff

Phase 0.5: clean (22/22 manifest entries confirmed red, 0 unexplained reds). Run before any re-baseline edit: `npm run build` then `node scripts/test-lock.mjs -- npm test` gave 3853 tests, 3829 pass, 22 fail; the 22 failing test names equal the manifest names exactly (sorted diff empty). Classes: 12 golden fixtures (11 compose-equivalence + 1 skill-manifest), 4 context-budget pins, 6 per-file pins.

## Golden hunk notes (12 fixtures re-captured with scripts/capture-constitution-golden.mjs)

Every hunk maps to an E393 site; none unattributable.

| fixture(s) | hunk | site |
|---|---|---|
| all 10 constitution-bearing goldens (build-lite-*, build-full-*, hook-lite, hook-full, constitution-monolith) | header `v3.40.0` + long comment -> `v3.41.0 <!-- versioned independently of package.json -->` | AC-D1 bump + trim w3 |
| same 10 | new Limits row `visual_split` threshold 3 | AC-C01 (+ trim t2 meaning cell) |
| same 10 | const-05 §3 end gains the `Builder ≠ judge (role-collapse guard)` bullet | AC-A1 (t3 applied) |
| same 10 | Test ownership bullet loses the `(precedent: A10 ...)` parenthetical | trim w1 |
| same 10 | const-15 Sanctioned git ops loses the `Reason (D10, generalized)` sentence | trim w2' |
| design arms (lite-design x2, full-design x2, hook-lite, hook-full, monolith) | const-04 (c) clause `§3 builder ≠ judge and §3.2 still hold (sr fixes, qa judges)` | AC-B01 + trim t1 |
| chain arms (full-* x4, hook-full, monolith) | const-06 `cap of QA FAILs is exhausted` | AC-C02 |
| chain arms | const-08 `cap of code-reviewer FAILs is exhausted` | AC-C03 |
| design chain arms (full-design x2, hook-full, monolith) | const-09 `any round past it locks`, `Split escalation (`visual_split`)`, `remaining rounds`, `from the visual_split threshold ... past the cap` | AC-C04, AC-C05 a-c |
| design chain arms | const-11 five-line builder ≠ judge bullet removed | AC-A2 |
| chain arms | const-12 diagram parenthetical deleted; `up to the review_round cap`; `(up to the qa_round cap)` | AC-C06 (then t4 delete), AC-C07, AC-C08 |
| skill-coordinator-monolith | coord-02 `§3 builder ≠ judge downgrade` | AC-B02 |
| skill-coordinator-monolith | coord-03 row `(builder ≠ judge, §3)` | AC-B03 |
| skill-coordinator-monolith | coord-05 `Per Constitution §3 builder ≠ judge and, when design-armed, §3.2` | AC-B04 |
| skill-coordinator-monolith | coord-07 `§3 builder ≠ judge` | AC-B05 |

Note: the spec's F table says skill-sr-engineer.md changes hit build-full-*. Measured: no hunk from skill-sr-engineer in any golden (the fixtures capture the constitution block only). Spec text was over-inclusive; harmless, disclosed.

## Re-pin list (assertions changed only to the as-shipped text; no test deleted or weakened)

- test/context-budget.test.mjs: sentinel `Split escalation (`visual_split`)` (was Round 3); two §4 anchors now `loops on `(code-reviewer, FAIL)` up to the` (were `for up to 3`; the P2-5 and P2-6 reds); saving floor 2080 -> 1999 with message naming E393 (see below). Ceilings :200, :566, :912, :502, :591 untouched.
- test/e178a-integrator-role.test.mjs: SOP includes `§3 builder ≠ judge`.
- test/e391-prompt-audit-stale-facts.test.mjs: `(Round 4 of `review_round`)` count 0 plus `cap of code-reviewer FAILs is exhausted` count 1; case retitled.
- test/e5-intake-tiering.test.mjs: regex `§3 builder ≠ judge`; case title updated.
- test/e96-dispatch-preference.test.mjs: shared WHEN_DO_MARKER regex `§3 builder ≠ judge downgrade` — all three tests re-pinned together. The lean-absent case passes vacuously (it asserts the marker is absent), so it is not a positive check on the new text; it is kept aligned so it stays meaningful. Case titles still say §3.2 (kept to match the manifest names).
- test/phase-0-5-sop.test.mjs: regex `` `visual_round` ≥ `visual_split` ``.
- test/compose-equivalence.test.mjs, test/skill-manifest.test.mjs, test/agc-adapters.test.mjs: no edit; green after golden re-capture.
- New: test/e393-builder-judge-core.test.mjs (6 cases): AC-A1 (rule once in all four compositions, fullDetail and stripped, as-shipped bullet), AC-A2, AC-B (citations, composition resolution), AC-B11 (adapter line byte-equal, §3 ASCII anchor), AC-C (named-cap phrasing per row C02-C15, 7 qa route rows), AC-C01 (visual_split row value 3, header v3.41.0, row present in all compositions). No base sha, no fanout spec read.

## Budget AC-E1 (human ruling: option (i-b)+w2'; no ceiling raised)

Measured with the same formulas the tests use (approxTokens = ceil(chars/4), stripRationale(stripOriginTags(...))).

| figure | before (source) | after (measured) | ceiling / floor | headroom |
|---|---|---|---|---|
| lean always-on (:200) | 5722 (spec §E, base f664ec9) | 5711 | <= 5723 | +12 |
| non-design stripped (:912) | 8495 (spec §E) | 8476 | <= 8501 | +25 |
| design-arm stripped (:566) | 10593 (spec §E) | 10475 | <= 10598 | +123 |
| teamwork stripped bundle (:591) | 21588 (spec §E) | 21479 | <= 21715 | +236 |
| skill-sr-engineer stripped (:502) | 2850 (spec §E) | 2851 | <= 2852 | +1 |
| skill-qa-engineer bytes (e391 :88) | 18371 (spec §E) | 18398 | <= 18500 | +102 |
| design-only saving (:914, floor) | >= 2080 (old pin, a12 re-baseline) | 1999 | >= 1999 (ruled) | 0 |

All six ceilings hold at their old values. The after-values equal the spec's (i-a)+(i-b) column.

## Saving-floor re-baseline (not a ceiling raise)

The design-only strip saving (design-arm stripped minus non-design stripped) is a floor on the gap between arms. Moving the builder ≠ judge bullet out of design-only const-11 into core const-05 shrinks the design-only span, so the gap drops from >= 2080 to 1999; no equal-bytes trim can restore it. Human ruling (lane session, 2026-11-02, citing spec commit 15be5f3 §E amendment): floor lowered to `>= 1999`; assertion message reads "... must be ≥ 1999 (E393 re-baseline: ...)" in the same shape as the a12 message it replaces. No other floor or ceiling moved.

## dist / adapters

- `npm run build`, then `git status --short dist`: empty (no diff).
- `node bin/agc-init.mjs check`: exit 0 ("all adapters current"; stamps untouched). Advisory only: comment-ratio warning on test/context-budget.test.mjs (38.9% > 30%), pre-existing style of this file's cap-history comments; E393 added 2 comment lines.
- `npm run check:md-tables`: OK (688 files, 0 malformed).

## Suite result

Command: `node scripts/test-lock.mjs -- npm test` on commit 2560457 (clean tree, no untracked files): 3859 tests, 3857 pass, 0 fail, 2 skipped (pre-existing skips). Exit 0.

## Disclosed decisions

- Retitled two cases (e391 AC-G2-18, e5 T-E5-03) so titles no longer claim the retired wording; the expected-red manifest names for those two are therefore historical.
- e96 titles left at "§3.2" to keep the manifest names stable (assertions are the contract).
- Coverage (>= 80% on modified files): test-only and prose change, no executable source modified; not applicable.
- Phase 1.5 skipped (no Visual Baselines); Phase 3.5: spec's proofs are the named tests and `node --test` commands, all executed within the green full suite.

## Follow-ups

- Spec F row overstates skill-sr-engineer's golden impact (constitution-only fixtures).
- context-budget.test.mjs comment ratio is over the advisory limit; a comment-hygiene pass could move cap-history prose to a spec.

## AC Execution Log

| AC | command | output / exit | verdict |
|---|---|---|---|
| AC-A1, A2, B, B11-eq, C, C01 (AC-F2) | `node --test test/e393-builder-judge-core.test.mjs` | 6 pass, 0 fail, exit 0 | pass |
| AC-F1, AC-B-rat | `node --test test/compose-equivalence.test.mjs test/skill-manifest.test.mjs test/e90-golden-capture-completeness.test.mjs` | 45 pass, 0 fail, exit 0 | pass |
| AC-C-x | `node --test test/ac-execution.test.mjs` | 27 pass, 0 fail, exit 0 | pass |
| AC-E1 | `node scripts/test-lock.mjs -- node --test test/context-budget.test.mjs test/e391-prompt-audit-stale-facts.test.mjs` | 69 pass, 0 fail, exit 0 | pass |
| AC-D1 | `head -1 content/const-01-core-head.md` | `# Constitution v3.41.0 <!-- versioned independently of package.json -->` | pass |
| AC-F3 | `node scripts/test-lock.mjs -- npm test` | 3859 tests, 3857 pass, 0 fail, 2 skipped, exit 0 | pass |
| AC-F4 | `npm run build`; `git status --short dist`; `node bin/agc-init.mjs check`; `npm run check:md-tables` | dist empty; agc exit 0; md-tables OK (688 files) | pass |
## 2026-11-02T10:39:39.629Z — PASS — by qa-engineer

suite-result: 3857/3859 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS. Phase 0.5 clean: 22/22 expected reds confirmed, 0 unexplained. 12 goldens re-captured, every hunk attributed to an E393 site. Pins re-baselined (context-budget, e178a, e391, e5, e96 x3, phase-0-5); new test/e393-builder-judge-core.test.mjs (6 cases). Budget (no ceiling raised): lean 5711/5723, non-design 8476/8501, design-arm 10475/10598, teamwork 21479/21715, skill-sr stripped 2851/2852, skill-qa bytes 18398/18500; design-only saving floor 2080 -> 1999 per human ruling (spec 15be5f3), measured 1999. dist no diff, agc check exit 0, md-tables OK. Full report: qa_reports/review_T-E393-06.md.

