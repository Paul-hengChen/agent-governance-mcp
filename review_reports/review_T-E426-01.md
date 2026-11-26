# Review — T-E426-01

covers: T-E426-01, T-E426-02, T-E426-03, T-E426-04, T-E426-05, T-E426-06

## Round 1 — APPROVED — by code-reviewer

Reviewed: `git diff ce36112...HEAD` on `feat/e426-ticket-scenarios-fixed` (HEAD f5e2319), against `specs/e426-ticket-scenarios-fixed.md` AC1–AC11 and the Copy / Strings table. Human rulings at the top of the spec: item (4) → `C-CO7a`, item (5) → `C-TF1` + `C-TF2`. No ticket file exists for E426, so the spec's ACs are the scenarios.

## Summary
- SOP/doc-only change: five `content/**` SOP fragments and `docs/ticket-format.md` gain the eleven ruled Copy rows (C-PM1, C-PM2, C-QA1..3, C-SR1, C-CR1, C-CR2, C-CO7a, C-TF1, C-TF2). Each row is verbatim and in its specified place. No other text added.
- Tests: new `test/e426-ticket-scenarios-fixed.test.mjs` (AC1–AC10), the integrator-assigned re-pin of `test/e422-ticket-format-doc.test.mjs` line 160, and the T-E426-06 re-baselines (three caps in `test/context-budget.test.mjs`, the e118 AC7 byte cap, the coordinator monolith golden).
- Scope: every changed file is in the Lanes row e426 owned set or is one of the two integrator-assigned test files. No `.ts`, `dist/**`, `templates/**` or `tools/ticket-file.ts` change. `GATE_REGISTRY` still has 33 entries and `UPDATE_STATE_GATE_PIPELINE` 17 steps.
- All 11 `proof:` commands exit 0. 7 of 7 negative-control mutations fail the right test. Full suite: 4776/4778 pass, 0 fail, 2 skipped, exit 0 (judge report `qa_reports/review_T-E426-01.md`).
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — content/skill-pm.md:20 (bullet opens with C-PM1 right after `- **Acceptance Criteria** — `)
AC2 — implemented — content/skill-pm.md:20-24 (BDD-through-worked-example text byte-identical to base, now after `**No ticket file**: `; ac-execution AC2 green)
AC3 — implemented — content/skill-pm.md:20 (C-PM2 once, between C-PM1's `does not apply. ` and `**No ticket file**: `; file still 119 lines)
AC4 — implemented — content/skill-qa-engineer.md:33 (C-QA1), :45 (C-QA2 = sub-step h, right after g, before the blank line and `5. **Run**`), :62 (C-QA3); e425 C-QA still the last bullet of step 6
AC5 — implemented — content/skill-sr-engineer.md:33 (C-SR1 right before ` ELSE build to the tests.`); Escalation Routes byte-identical; e433 + e453 green
AC6 — implemented — content/skill-code-reviewer.md:14 (C-CR1), :72 (C-CR2 right after `a rejection reason (test defect).`); 4a then 5 still follow
AC7 — implemented — content/coord-07-core-sop.md:9 (base line + C-CO7a, ruled option (a)); e5, e433 AC6 and e438 green
AC8 — implemented — docs/ticket-format.md:143-149 (C-TF1 after one blank line, wrapped as specified), :262 (C-TF2); the example checks `(4 scenarios)`; e422, e455 and e427 green
AC9 — implemented — every added string is scanned by the AC9 test and by e437/e438/error-code-contract/e462: no repo-only path (the only path is `<agc install>/docs/ticket-format.md`), no bare id or version, no backtick-quoted error code, and no clause gives qa-engineer a judge action
AC10 — implemented — existing server behaviour, driven end to end by the AC10 test (checker counts the appended S3; PASS rejected naming S3, accepted once S3 has a pass line)
AC11 — implemented — full suite green; golden re-captured (one hunk, C-CO7a only); caps set to measured values with one comment line each (skill-pm 5196, skill-sr 3409, teamwork bundle 19559, e118 AC7 14345); gate counts 33 / 17; scope command prints nothing

## Correctness
Tests (step 4):
- Every AC has one test, titled with its AC id, on the public interface. That interface is the shipped SOP text in raw form and served form (`applyTextTransforms(..., {fullDetail:false})`), and for AC10 the ticket checker CLI plus the real `handleUpdateState` PASS path. Assertions are verbatim and position-exact (e.g. AC4 checks `step4[last] === C-QA2`, `step4[last-1]` starts with `g.`, and a blank line before step 5).
- Negative controls, run on a scratch copy outside the worktree. Each mutation turned the expected test red:
  - sr wording "You may append the scenario yourself." → AC5, AC9
  - C-CR1 dropped → AC6, AC9
  - example back to `the implementer` → AC8, AC9
  - sub-step h moved before g → AC4
  - C-PM2 put on its own line → AC1, AC2, AC3, AC9
  - coord-07 given the option (c) text → AC7, AC9
  - no-ticket text drift ("should be testable") → AC2, AC3

  The tests would fail on a wrong build.
- AC10 checks both the rejection, with exact prefix `⛔ AC_EXECUTION_LOG_MISSING: T01. ` and `No entry for scenario(s): S3. `, and the acceptance once S3 has a pass line. So it cannot pass vacuously.
- The two open interface details in the test report (how C-PM1 is split around C-PM2; AC2 pins byte-identity only, with the `**No ticket file**: ` predecessor asserted in AC1/AC3) follow the Copy table's placement rule and contradict no scenario. Accepted.
- Coverage: no line-coverage tooling applies to Markdown SOP text. Coverage here is per-Copy-row verbatim presence plus position, in both forms.

Implementation (SOP/doc text):
- Amendment item 1 (cite, don't copy) → C-PM1. Item 2 (three-way sort; only pm at the cut and qa-engineer while writing tests append; sr returns to qa; code-reviewer rejects) → C-PM2, C-QA2, C-QA3, C-SR1, C-CR2. Item 3 (marks checked) → C-CR2's last sentence plus C-QA2's `Added:` form. The judge-reads-appended gap → C-QA1, C-CR1. Ruled options → C-CO7a, C-TF1, C-TF2. All present.
- Cross-references resolve:
  - C-QA2 "interface detail → step c" points at qa step 4c *Open interface details*.
  - C-PM2 "Question Batch Gate" points at skill-pm step 4 and the gate table.
  - C-TF1 "(see *Batch summary*)" points at the `## Batch summary` section, which ticket-format.md line 69 already uses for stop questions.
  - C-SR1 "return route 1" and *scenario cannot be built* name existing Escalation Routes rows. The table is unchanged.
- Consistency with neighbouring rules:
  - qa step 8 *code-reviewer rejection routed to you* already handles a test defect. C-CR2 routes the extends-decided case there, and C-QA2 lists the code-reviewer rejection as a trigger.
  - code-reviewer step 8 already counts added-during-build scenarios in the AC Execution Log.
  - `docs/lane-protocol.md` §3 *批次 lane* "情境只能追加" agrees with "never edit or remove a scenario". Its stop reason (1), "漏了會改變行為的情況", is the "decides new behaviour" branch. That section names itself the override for batch lanes, so the pm/qa routes in C-PM2/C-QA2 (Question Batch Gate / scenario defect → pm) give way to its 停票 there without contradiction.
- Constitution §3 builder ≠ judge: no added clause gives qa-engineer or sr-engineer a judge action. C-SR1 forbids sr-engineer to append a scenario or write its test, which matches §2 test ownership.
- No findings that block.

## Quality
- recommended — `content/const-12-chain-r10-s4.md:14` describes the sr-engineer → qa-engineer return route with the parenthetical "(a test contradicts a scenario or collides with existing code)". C-SR1 now sends a third kind of reason over the same edge (a case no scenario covers that extends decided behaviour). Edge, cap and Escalation row are unchanged, so nothing contradicts. But the constitution's list of reasons is now incomplete. `content/const-*.md` is forbidden to this lane (spec Out of Scope). Report-only.
- optional — The AC9 test scans the Copy table strings, not the diff's added lines. I checked the diff by hand: the added text is exactly the Copy rows, so coverage at this build is complete, and e437/e438 scan all of `content/**` for repo-only paths anyway.
- Comment check (5d): `agc check` raises one comments warning that touches the diff: `test/context-budget.test.mjs high-ratio 41.7%`. Kept. The ratio was already high at base. The lane added three one-line re-baseline comments, which the spec's AC11 requires and which follow the file's existing per-cap re-baseline convention. The e426 test header is seven lines. The e118 re-baseline is one line inside the test body.
- The e118 AC7 title/message number moved 4466 → 4820 along with the cap (integrator-accepted, per the brief). It is consistent: 9525 + 4820 = 14345.

## Architecture
No architecture spec (no gate, pipeline, schema or `.ts` change; the spec routed no architect). The change is confined to SOP text plus test artifacts. Layering is unchanged: the per-scenario PASS check stays in `gates/ac-execution.ts`, untouched. C-CO7a describes that check's existing arming rule correctly: it reads only a spec's `Ticket:` line inside the ticket directory (`findTicketCitations`).

## Security
No findings. No code path or input boundary changed. The added text carries no secrets, no absolute local path and no URL. AC10 fixtures live under `os.tmpdir()` and are removed in `after()`.

## Performance
No findings. No runtime code changed. The served-context growth is measured and capped at zero headroom: skill-pm +254 ~tok, skill-sr +101 ~tok, teamwork bundle +39 ~tok, skill-code-reviewer +354 bytes. The spec sized and approved these deltas.

Same-model note (SOP *Recommended*): sr-engineer and code-reviewer are both pinned to opus for this lane (human Q4 pin). The usual same-model blind-spot caveat applies. The verbatim Copy pins and negative controls reduce reliance on judgement.

## Verdict
APPROVED — every AC is implemented verbatim and in place, the tests check each AC and fail on wrong builds (7/7 negative controls), every `proof:` command exits 0, the full suite is green, and the lane stayed inside its owned set with no server change.
