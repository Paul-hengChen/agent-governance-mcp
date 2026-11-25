# Review — T-E433-01 (feature e433-test-first-rules)

covers: T-E433-01, T-E433-02, T-E433-03, T-E433-04, T-E433-05, T-E433-06, T-E433-11, T-E433-07

## Round 1 — APPROVED — by code-reviewer

Diff: `96708e6..e12c42e` (39 files). Inputs: the diff, `specs/e433-test-first-rules.md` (no architecture spec, Architect hop: none), `qa_reports/expected-red_e433-test-first-rules.txt` (carve-out), the server source the new text describes (`tools/transitions.ts`, `tools/handoff-orchestrator.ts`, `tools/tasks.ts`, read-only).

## Summary
- The served text moves to the test-first chain: constitution (const-01/05/06/08/12, rationale), coordinator (coord-01/03/07), qa / sr / code-reviewer / pm / architect SOPs, release-engineer / doc-writer / integrator SOPs, two templates, two prompt descriptions, `PROMPT_TEMPLATE_3B`, two `hintStatic` texts plus the mapping and field comments, README / architecture / release-cd, and the two lane-protocol lines.
- Old-chain text is removed in the same change. None of the `forbidden.*` strings occurs in `content/`. The *Builder ≠ judge* bullet is byte-identical to base.
- Every write the new SOPs tell a role to make is accepted by the E431/E432 server on a marked feature: the transitions, the verdict/status pair, completed_tasks identity, the repro / no-new-test check, `tw_complete_task` through `requireJudge`, and the `sr_return` and `review_round` counters.
- Out-of-scope files are untouched. `dist/` changes only the three owned outputs. `gates/registry.ts` changes only the two hints, the mapping comment, the field comment and the `SR_RETURN_CAP_EXCEEDED` `documentedInProse` flag (D16).
- Verdict: APPROVED. No `required` finding; four `recommended` and five `optional` notes.

## AC Completeness
AC1 — implemented — `chain.main` at const-12:9. No `forbidden.*` string in content/. The sentences that grant PASS, `tw_complete_task` or `completed_tasks` name code-reviewer: const-05:18, const-06:7, const-08:6-9, skill-code-reviewer.md:103. The composed-prompt proof is qa's (T-E433-09).
AC2 — implemented — (a) const-06:7; (b) const-05:5; (c) const-05:21 unchanged; (d) const-01:13-14 (no `qa_round` row; `sr_return` cap 2); (e) const-05:18 and const-05:9 (disclosure goes to the qa test report, not `qa_review`); (f) const-05:6, R1 = (a).
AC3 — implemented — skill-qa-engineer.md: frontmatter opus :2; public interface :14; read first and Interface Contracts :33; open interface details :38; red reasons :52; manifest / no-new-test :53-54; no implementation read :15; no verdict and no completed_tasks :13; a rejection goes back to sr, never to code-reviewer :56,:60; bug ticket :42. No `Phase 1.5`, no `skill-qa-visual`, no `recommended_model: sonnet`.
AC4 — implemented — skill-sr-engineer.md: :30 (build to the pre-written tests, never edit them, import-path carve-out); :33 (route 1 with the cap and `SR_RETURN_CAP_EXCEEDED`; route 2 to pm); :29 (bug-ticket reproduction); Escalation rows :53-55; re-check after a rejection :63-66. The *QA Round Reply* section is gone.
AC5 — implemented — skill-code-reviewer.md: tests reviewed against scenarios :73; full suite :82; Expected-Red Diff :83-87 (bugfix branch :86); AC Execution :88; copy / visual-token audits :78-80; bug-ticket cause check :74; PASS row :103; rejection rows :98-100,:104; Clean-context carve-outs :14. No APPROVED → qa row.
AC6 — implemented — skill-pm.md:91 (step 8 routes to architect or qa-engineer, sets the marker, names both counters), :93 (bugfix chain), :95 (amend path), Gate Summary :106,:111; skill-architect.md:77-78; coord-01:22-23,:31,:78; coord-03:34-38; coord-07:9,:11.
AC7 — implemented — release-engineer :7,:13,:35,:99; doc-writer :7,:14,:15,:28; integrator :50,:62; `tpl.scope_line` (tools/fanout-manifest.ts:86); `desc.qa` / `desc.code_reviewer` (tools/registry.ts:1161,:1191) match Copy byte for byte.
AC8 — implemented — qa template `model: opus` with `tpl.qa_desc`; code-reviewer template `model: opus` with `tpl.cr_desc`; the qa SOP frontmatter is opus.
AC9 — implemented — `hint.expected_red` gates/registry.ts:366; `hint.ac_log` :613,:620; `MISSING_EVIDENCE` unchanged; `SR_RETURN_CAP_EXCEEDED` `documentedInProse: true` (D16). I re-derived each mapping row with grep over content/*.md and every row matches.
AC10 — implemented — README:71,:99,:106,:125 (`readme.qa_row` byte-exact); architecture:127-128,:132,:185; release-cd:63,:69,:95 carry `doc.release_gate`.
AC11 — not blocked by the diff (qa's T-E433-10). The goldens and caps are on the manifest.
AC12 — not blocked by the diff. Server files, `prompts/**`, `schema/**` and `CLAUDE.md` are untouched; `dist/` holds the three owned outputs only. The suite reds are the 59 manifest entries qa re-pins.
AC13 — implemented — docs/lane-protocol.md:37 and docs/lane-protocol-addendum.md:15 now state the §2 bug-ticket exception and drop 無例外. No other line changed, and no repo path was added.

## Correctness
No `required` findings. Server cross-check, write by write on a marked feature:
- pm → qa and architect → qa are opened by `TEST_FIRST_OPENS` and closed to sr by `TEST_FIRST_CLOSES`. qa → sr passes the repro check when the manifest or the no-new-test record exists (handoff-orchestrator.ts:627-632).
- sr → qa adds to `sr_return_count`; the third return is rejected (transitions.ts:609-624).
- `(code-reviewer, In_Progress) → (code-reviewer, PASS)` is open. `APPROVED` with `PASS` is accepted on a marked feature (handoff-orchestrator.ts:681-685).
- `code-reviewer:FAIL` can go to qa-engineer, sr-engineer or pm. `review_round` counts each FAIL once and resets on code-reviewer PASS or pm.
- On a marked feature `completed_tasks` is code-reviewer-only (`NON_QA_COMPLETED_TASKS_REJECTED` for anyone else, handoff-orchestrator.ts:753-772), which matches const-08:7. `tw_complete_task` goes through `requireJudge` (tasks.ts:76-79).
- Blocked → pm exists for qa-engineer, sr-engineer and code-reviewer.

Expected-red check (SOP 4a, full set, not a sample):
- `node scripts/test-lock.mjs -- npm test` on the clean tree at e12c42e gave 4497 tests: 4436 pass, 59 fail, 2 skipped, exit 1.
- The 59 `not ok` names equal the 59 manifest names exactly (none extra either way).
- Each entry sits in its named file; 3 titles are built from template strings (e438:72, e432:560).
- Every listed test is in the spec's Probe table or re-assigned by D16–D18. Each red is caused by an intended wording, hint or mapping change, not a defect. I read e393 AC-C to confirm: the new const-06/08/12 text has no bare round number; only the removed C02/C08/C09–C11 strings fail.
- `recommended` — sr_return cap detection, skill-sr-engineer.md:33,:54 and skill-qa-engineer.md:59. sr's return write is a self-loop that sets `next_role="qa-engineer"`; qa's claim is the write that crosses `sr-engineer:In_Progress → qa-engineer:In_Progress`. So `SR_RETURN_CAP_EXCEEDED` lands on qa's claim, not on sr's write. The sr SOP does not tell sr to read `sr_return_count` (shown by `tw_get_state` once it is above 0) before choosing route 1 or the cap row. The qa SOP does not say that a rejected claim means stop and report so pm can take the feature. The coordinator can still route it, so nothing deadlocks, but the rule could name the check.
- `recommended` — the build gate on sr → qa returns, const-05:6 and skill-sr-engineer.md:33. Under R1 = (a), sr's hand-offs stay at zero errors. A return of a test that does not compile because it collides with existing code cannot reach zero, since sr may not edit the test. This follows the ruled text literally; a short clause would remove the ambiguity: a return keeps qa's manifest-listed compile errors.

## Quality
- `recommended` — skill-integrator.md:166 still says "(5) **not code-reviewer / qa-engineer** — those are judges that write verdicts and state". That is an old-judge fact. It sits outside the cut's lines (:50, :62), and the integrator is not one of AC1's five roles, so it is not an AC gap. Reword it in E434/E435 or a follow-up.
- `recommended` — skill-doc-writer.md:15,:36 now tell doc-writer to write `agent_id="code-reviewer"`, `status=In_Progress` after `(code-reviewer, PASS)`. The server rejects that edge, because code-reviewer:PASS can only go to pm, researcher, release-engineer or design-auditor. The defect already existed: base `qa-engineer:PASS → qa-engineer:In_Progress` is also not allowed. The diff re-pointed it; it did not introduce it.
- `optional` — skill-code-reviewer.md:74 still explains how `MISSING_REVIEW_EVIDENCE` accepts `covers:` lines. That gate arms only on the code-reviewer → qa-engineer edge, which is closed on a marked feature. Harmless but dead on the new path.
- `optional` — the README.md:99 code-reviewer row is longer than the table's column padding. Cosmetic only.
- `optional` — skill-release-engineer.md:104 routes a post-release test regression to qa-engineer, who now only writes tests. It still works through qa → sr → code-reviewer.
- Comment check (5d / 4b): the diff adds comment text only in gates/registry.ts (the field comment and one `documentedInProse` comment). Both are factual and short; no trim needed.

## Architecture
No architecture spec. Layering is unchanged; no server behaviour, gate predicate, transition, schema or pipeline change. The changes to `tools/registry.ts` and `tools/fanout-manifest.ts` are string-only. `optional` — in SQLite/HTTP mode the marker cannot be set (E431 D1), so the served chain ends at "stop and report" there. This is acceptable because E422–E434 stay unreleased until E435 (§16.1 ruling 18), and E435 must close the gap. qa-visual and `content/skill-qa-visual.md` mentions (e.g. skill-sr-engineer.md:23,:26) are E434's.

## Security
No findings. The changes are text only. Hygiene check on the added `content/**` lines: no absolute or user paths, no repo-only `specs/` or `test/` paths, no internal URLs. The lane-protocol line adds no repo-only string.

## Performance
No findings. No executable logic changed. The SOPs grew (code-reviewer 12691 B, qa 10385 B, sr 14569 B); the context-budget re-baseline is qa's T-E433-10 (AC11).

## Verdict
APPROVED — every AC owned by these tasks is implemented, every instructed write is one the E431/E432 server accepts, and the 59 reds are exactly the manifest with intended causes. Same-model note: sr-engineer and code-reviewer both ran on opus this hop, so a different-model check was not possible.
