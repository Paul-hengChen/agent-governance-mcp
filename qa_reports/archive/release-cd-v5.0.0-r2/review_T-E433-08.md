covers: T-E433-08, T-E433-09

# QA review — E433 T-E433-08 / T-E433-09 (old chain: qa judges and authors the tests)

Scope of this hop: re-pin the served-wording reds (T-E433-08) and add `test/e433-test-first-rules.test.mjs` (T-E433-09). Goldens and `test/context-budget.test.mjs` caps are T-E433-10 and stay red on purpose. No PASS this hop.

Commits: `a2aadc9` (T-E433-08), `81e7c0d` (T-E433-09). Code review: `review_reports/review_T-E433-01.md`, `review_reports/review_T-E433-12.md` (APPROVED).

## Expected-Red Diff

Phase 0.5 run BEFORE any re-baseline edit (full suite, `node scripts/test-lock.mjs -- npm test`, tree at `b40bd44`): 4497 tests, 4436 pass, 59 fail, 2 skipped.
Phase 0.5: clean (59/59 manifest entries confirmed red, 0 unexplained reds). The not-ok set and the manifest's test names are identical (sorted diff empty).

After the re-pin commits (full suite on the clean tree at `81e7c0d`): 4513 tests, 4490 pass, 21 fail, 2 skipped. The 21 reds are exactly the golden / budget entries of the manifest, all owned by T-E433-10:
- `test/compose-equivalence.test.mjs` (11): the eight `buildPromptForRole` goldens, both SessionStart hook goldens, and the 15-fragment monolith concatenation.
- `test/skill-manifest.test.mjs` (1): `t-golden-byte-identity (AC1/AC5)`.
- `test/context-budget.test.mjs` (9): `AC2` lean bundle cap, the three `AC8/AC-P2-7` caps, `AC1/AC2` pm cap and sr cap, `AC9` sr marker survival, `AC-P2-5` §4 reorder-only, `AC-P2-6` §4/§1 survival. The last three (AC9, AC-P2-5, AC-P2-6) are wording pins in the budget file, not caps; they are left to T-E433-10 together with the caps because the file is re-baselined as a unit.

Disposition of every manifest entry not in the 21: re-pinned in a2aadc9 (list below), now green.

## Re-pin summary (T-E433-08)

Each re-pin keeps the test's intent and changes only the broken assertion; each new expectation was checked against the spec text, not just the served sentence.
- `test/ac-execution.test.mjs` AC3 / AC3-AC4 / AC6: AC Execution step and `## AC Execution Log` now asserted in `skill-code-reviewer.md` (spec AC5); no new escalation row (table pinned at 5 rows).
- `test/e20-e21-crash-resilience.test.mjs` QA-E21-3: crash checkpoint precedes the Run step's Build-gate line (R1 = (a), D15).
- `test/e380-qa-suite-result-sop.test.mjs`: PASS-line byte pin moved to the code-reviewer PASS row (spec AC5); AC14 size cap now reads the qa SOP; new test: qa SOP has no PASS write.
- `test/e391-prompt-audit-stale-facts.test.mjs` AC-G2-12: qa SOP carries no `skill-qa-visual` cite (spec AC3); sub-skill cites unchanged.
- `test/e407-restatement-citations.test.mjs` AC6: qa first Hard rule is "Test author, never judge" and cites the ownership bullet by name.
- `test/e438-origin-fenced-labels.test.mjs` sites 35/36/45: labels re-pinned as absent (the Phase 1.5 / checklist / `pre-E3` text left the qa SOP); site 35 row removed from the fenced table.
- `test/e440-current-rule-wording.test.mjs` site 1: neither the Phase 1.5 sentence nor the old "is REMOVED" wording is in the qa SOP.
- `test/pixel-perfect-visual-compare.test.mjs` AC-2, AC-6, step regression: no Phase 1.5 / lazy-load arm in the qa SOP; steps 1..8.
- `test/qa-visual-skill-split.test.mjs` AC-3, AC-4, AC-6: same; sub-skill contract (`VISUAL_EVIDENCE_MISSING`, categories, routes) still asserted.
- `test/repro-first-gate.test.mjs` S3: bugfix branch asserted in `skill-code-reviewer.md` ("load-bearing: PASS requires").
- `test/e5-intake-tiering.test.mjs` T-E5-03: coord-07 hard-floor sentence now names the bug-ticket exception.
- `test/e16-judge-dispatch-charter.test.mjs` E16-01/02/04/06: judge = code-reviewer only (D11).
- `test/e393-builder-judge-core.test.mjs` AC-C: C02/C07/C08 point at the `review_round` / `sr_return` named caps; C09-C11 become absence of `qa_round` cap in the qa SOP; qa table keeps 2 rows.
- `test/e178a-integrator-role.test.mjs` AC3: `desc.qa` and `desc.code_reviewer` verbatim.
- `test/e289-render-addendum.test.mjs` AC-E289-4: `tpl.scope_line`.
- `test/e394-release-sop.test.mjs` AC-P3, AC-P6: `(code-reviewer, PASS)`.
- `test/e295-hop-cap-and-sop-halves.test.mjs` AC11 (ruling 5a part only), `test/e431-test-first-server-path.test.mjs` AC17, `test/e308-single-source-tier-enum.test.mjs` E303-AC11a: no `(none)` row; `SR_RETURN_CAP_EXCEEDED` mapped to `skill-qa-engineer.md, skill-sr-engineer.md`; `documentedInProse` true (D16, D18).
- `test/e432-judge-report-checks.test.mjs` AC11: only the two rewritten hint texts (`EXPECTED_RED_DIFF_MISSING`, `AC_EXECUTION_LOG_MISSING`) are normalised, each side through its own module set.
- `test/fixtures/e177a/render-e177a.golden.txt`: regenerated from `renderPrompt` of `PROMPT_TEMPLATE_3B` (script, not hand-edited); the diff is the single scope line = `tpl.scope_line`.
- `test/e118-reviewer-ac-completeness.test.mjs` AC7: code-reviewer SOP 10646 -> 12691 bytes (+2045); cap 10725 -> 12800 (measured size plus ~100 bytes); reason: the SOP absorbed the judge steps (tests-vs-scenarios review, full suite, Expected-Red Diff, AC Execution, audits, PASS and rejection rows).
- `test/e410-task-alias-content-tail.test.mjs`: untouched (green).

## Copy Audit

Every spec Copy / Strings entry is asserted verbatim in `test/e433-test-first-rules.test.mjs`: chain.main, chain.docs, forbidden.*, msg.no_ticket_tracker, tpl.scope_line, desc.qa, desc.code_reviewer, tpl.qa_desc, tpl.cr_desc, hint.expected_red, hint.ac_log (derived from the base text with exactly the two substitutions), doc.release_gate, readme.qa_row, readme.pin_line. No drift, no unlisted user-facing string observed. Visual Audit: N/A (no visual tokens). Phase 1.5: skipped (no Visual Baselines declared).

## New tests (T-E433-09)

`test/e433-test-first-rules.test.mjs`, 16 tests: `AC1:` x5 (one per role: qa-engineer, sr-engineer, code-reviewer, pm, teamwork), `AC2:`, `AC3:`, `AC4:`, `AC5:`, `AC6:`, `AC7:`, `AC8:`, `AC9:`, `AC10:`, `AC12:`, `AC13:`. Base-relative checks (AC9, AC12, AC13) read the closed range `96708e6..ac5a692` into memory through `git archive` and `git diff --name-only`; never `git show`, no temp dir re-read; they skip loudly when a sha is unreachable. Negative control (content/const-05 ownership bullet temporarily set to "ONLY qa-engineer flips the final"): AC1 x5 and AC2 went red; reverted, tree clean.

`test/eval/scenarios.mjs`: `qa-engineer-pass-reply` replaced by `qa-engineer-test-handoff` (tier opus; watermark, terse cap, banned phrases, and a check that the hand-off routes to sr-engineer with no PASS verdict). Offline load: `node -e "import('./test/eval/scenarios.mjs')..."` prints `[ 'default', 'scenarios' ]`, 7 scenarios. `npm run eval` not run (D6).

Coverage gate: no line-coverage tooling applies to markdown / wording tests; stated here.

## AC Execution Log

Spec proofs are written `node --test test/e433-*.test.mjs --test-name-pattern "<AC id>:"`. With the flag AFTER the file arguments Node 22 does not apply the filter (it runs all 16 tests, all pass). Run with the flag first, the filter works. Commands below use the working order.

- AC1: `node --test --test-name-pattern="AC1:" test/e433-test-first-rules.test.mjs` -> pass 5, fail 0, exit 0. PASS.
- AC2: same with `AC2:` -> pass 1, fail 0. PASS.
- AC3: `AC3:` -> pass 1, fail 0. PASS.
- AC4: `AC4:` -> pass 1, fail 0. PASS.
- AC5: `AC5:` -> pass 1, fail 0. PASS.
- AC6: `AC6:` -> pass 1, fail 0. PASS.
- AC7: `AC7:` -> pass 1, fail 0. PASS.
- AC8: `AC8:` -> pass 1, fail 0. PASS.
- AC9: `AC9:` -> pass 1, fail 0. PASS.
- AC10: `AC10:` -> pass 1, fail 0. PASS.
- AC11: not run this hop (goldens and budget caps are T-E433-10); the 12 golden reds and the budget reds are the open items.
- AC12: test part `AC12:` -> pass 1, fail 0. The full-suite proof (`exit=0`) is T-E433-10 (21 golden / budget reds remain); `npm audit --audit-level=high` is T-E433-10.
- AC13: `AC13:` -> pass 1, fail 0. PASS.

Full suite after the commits (`node scripts/test-lock.mjs -- npm test`, captured under `$TMPDIR`): tests 4513, pass 4490, fail 21, skipped 2, exit 1 (the 21 are the golden / budget reds listed above).

## Findings

No FAIL finding. Served content matches the spec for every pinned assertion. Notes for the human (not blocking): the spec's proof command places `--test-name-pattern` after the file arguments, where Node 22 ignores it; the proofs still pass but run the whole file.
