# Tests — e426-ticket-scenarios-fixed (T-E426-01)

Author: qa-engineer. Spec: `specs/e426-ticket-scenarios-fixed.md` (no ticket file for E426, so its Acceptance Criteria are the scenarios). Human rulings applied with no option-branching: item (4) → (a) `C-CO7a`; item (5) → (a) `C-TF1` + `C-TF2`.

Placement (SOP step 4a): the dispatch brief's `Test-file placement` line pre-authorized the new file `test/e426-ticket-scenarios-fixed.test.mjs` and the one-regex re-pin at `test/e422-ticket-format-doc.test.mjs` line 160. That is the branch I followed. No other existing file was edited.

## Scenario → Test Map

| scenario | test file | exact test name | state at base |
|---|---|---|---|
| AC1 | test/e426-ticket-scenarios-fixed.test.mjs | AC1: skill-pm's Acceptance Criteria bullet starts with C-PM1 directly after the bullet label (ticket file cited, scenarios not copied, where feasible not applicable) | red |
| AC2 | test/e426-ticket-scenarios-fixed.test.mjs | AC2: a spec with no ticket file keeps today's rules — the BDD-through-proof-example text is byte-identical to base and `where feasible` remains | green (already) |
| AC3 | test/e426-ticket-scenarios-fixed.test.mjs | AC3: skill-pm carries C-PM2 once, between C-PM1's `does not apply.` and `**No ticket file**: `, on the same line; the file keeps 119 lines | red |
| AC4 | test/e426-ticket-scenarios-fixed.test.mjs | AC4: skill-qa-engineer reads the Added during build section (C-QA1), ends step 4 with sub-step h (C-QA2) before `5. **Run**`, and step 8's sr-engineer return carries C-QA3; e425's C-QA stays last in step 6 | red |
| AC5 | test/e426-ticket-scenarios-fixed.test.mjs | AC5: skill-sr-engineer step 4c carries C-SR1 directly before ` ELSE build to the tests.`; its Escalation Routes are unchanged | red |
| AC6 | test/e426-ticket-scenarios-fixed.test.mjs | AC6: skill-code-reviewer Clean context reads the Added during build section (C-CR1); step 4 carries C-CR2 directly after `a rejection reason (test defect).`; step 4a then step 5 follow | red |
| AC7 | test/e426-ticket-scenarios-fixed.test.mjs | AC7: coord-07's (ii) mini-chain bullet is the base line plus C-CO7a at its end, nothing else changed (ruled option (a)) | red |
| AC8 | test/e426-ticket-scenarios-fixed.test.mjs | AC8: the ticket-format section Scenarios added during the work ends with the C-TF1 paragraph and the example's Added: line is C-TF2; the example still checks with 4 scenarios (ruled option (a)) | red |
| AC8 (re-pin) | test/e422-ticket-format-doc.test.mjs | AC8 the example is generic: no tracker link, no local path, and it shows an added-during-build scenario | red (line 160 re-pinned to `the test author`) |
| AC9 | test/e426-ticket-scenarios-fixed.test.mjs | AC9: every string the lane adds is present and names no repo-only path, no bare ticket id or version label, no backtick-quoted error code, and gives qa-engineer no judge action | red |
| AC10 | test/e426-ticket-scenarios-fixed.test.mjs | AC10: a C-PM1-form spec citing a ticket with a test-author-appended scenario — the checker counts it, and PASS is rejected naming it until the judge logs a pass line for it | green (already: existing server behaviour) |
| AC11 | — (`command` scenario) | full suite + goldens + caps: T-E426-06 on the planned return after the build. The judge runs its `proof:` command | not run now |

Every text assertion in AC1 and AC3–AC7 runs twice: once on the raw source and once on the served text (`applyTextTransforms(t, { fullDetail: false })`). AC2 and AC5 compare frozen base literals in both forms. AC8 covers `docs/ticket-format.md`, which is not served, so it checks the raw text only. AC9 checks that each string is present in the raw file, and also in the served text for `content/**`.

## Open Interface Details

- **C-PM1 and C-PM2 interleave (AC1 and AC3).** The Copy table puts `C-PM2` inside `C-PM1`: after `C-PM1`'s `does not apply. ` and before its `**No ticket file**: ` tail. So `C-PM1` never appears in one piece in the built file. AC1 pins `C-PM1` minus that tail right after `- **Acceptance Criteria** — `, plus the tail leading into `BDD:`. AC3 pins the full order on one line: label + C-PM1 head + C-PM2 + `**No ticket file**: ` + `BDD: …`. AC9 checks C-PM1's presence as head plus tail.
- **AC2 is green at base.** AC2 says the no-ticket text "now follows `**No ticket file**: `". If AC2 asserted that, it would be red at base, but the brief says AC2 is expected green. So AC2 pins only the byte-identity of the frozen base text (from `BDD:` through the closing fence of the worked example) and the `where feasible` rule. The `**No ticket file**: ` predecessor is asserted in AC1 and AC3.
- **AC7 uses the frozen base line.** The base `(ii) mini-chain` line is an in-test literal (resident-test hygiene: never read through git). The built line must equal it plus `C-CO7a` exactly. The text of the unruled options (b) and (c) must be absent.
- **AC8 C-TF1 wrapping.** `C-TF1` is pinned as the spec's seven lines joined by `\n`. The section must end with the base stop sentence, one blank line, C-TF1, and then the blank line before `## Where ticket files are listed`.
- **AC9 scan rules.** Repo-only path = a `docs|specs|test|tools|gates|scripts|prompts|content|dist|templates|research|review_reports|qa_reports` + `/` path not preceded by `<agc install>/`. `.current/.config.json` is not in this set because it exists in every adopter workspace. Bare id = `E\d{2,4}`. Version = `v\d+.\d+`. Error code = a backtick-quoted `UPPER_SNAKE`. Judge pairing = the e433 clause rule, extended so `the test author` also counts as the qa actor and `tw_rollback_task` as a judge term. Strings in the qa SOP are scanned in qa voice, meaning every clause is treated as addressed to qa-engineer.
- **AC10 fixture.** The `Ticket:` line is bare (`Ticket: docs/tickets/E901.md`), the literal C-PM1 form. The gate also accepts the backticked form. The spec lists the ids on one `Scenarios: S1, S2, S3` line. The appended S3 is `Verification: automated test` with `Added: the test author, 2026-01-15, …`. The checker must print `(3 scenarios)`. PASS with log lines for S1 and S2 only is rejected with `No entry for scenario(s): S3. `. With log lines for S1–S3 it is accepted.
- **Security smoke cases (step 4d).** These are not applicable. The feature adds SOP and doc text only and takes no new input. AC10 uses the existing ticket checker and PASS write as black boxes.

## Red Reasons

- AC1: `C-PM1` is not yet at the head of skill-pm's Acceptance Criteria bullet (T-E426-02).
- AC3: `C-PM2` is not yet on that line (T-E426-02).
- AC4: `C-QA1`, `C-QA2` and `C-QA3` are not yet in skill-qa-engineer (T-E426-03).
- AC5: `C-SR1` is not yet in sr step 4c (T-E426-04).
- AC6: `C-CR1` and `C-CR2` are not yet in skill-code-reviewer (T-E426-04).
- AC7: `C-CO7a` is not yet appended to coord-07 (ii) (T-E426-05).
- AC8: `C-TF1` and `C-TF2` are not yet in docs/ticket-format.md (T-E426-05).
- AC9: no Copy string is present yet, so the presence half of the scan fails (T-E426-02..05).
- e422 AC8 "the example is generic": re-pinned to `the test author`. The example still says `the implementer` until `C-TF2` lands (T-E426-05).

## Verification run

- Worktree at base: `node --test test/e426-ticket-scenarios-fixed.test.mjs test/e422-ticket-format-doc.test.mjs` gives 26 tests, 17 pass, 9 fail. The 9 reds are exactly the manifest entries. AC2, AC10 and the other 15 e422 tests are green.
- Sanity check of the tests themselves: I applied every Copy row with the ruled options to a scratch copy of `content/` and `docs/` (outside the repo; nothing tracked was touched). There all 10 e426 tests and the re-pinned e422 test are green, and skill-pm stays at 119 lines. So each red is red only because the build has not happened, not because of a test defect. In that copy, the e425, e5-intake-tiering, ac-execution, e455, e427, e410 and e413 pins also stayed green.
- The full suite was not run (per the brief, it runs on the T-E426-06 planned return).
- CI runnability: headless `node --test`. It needs no human, network or git, and fixtures live under `os.tmpdir()`.
