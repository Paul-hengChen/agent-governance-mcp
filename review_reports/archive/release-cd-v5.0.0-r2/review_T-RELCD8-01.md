# Review — T-RELCD8-01 (release-cd-v5.0.0)

covers: T-RELCD8-01, T-RELCD8-02, T-RELCD8-03

## Round 1 — APPROVED — by code-reviewer

## Summary
- Evidence-only MAJOR release gate 4.23.0 → 5.0.0 for E422, E423, E419, E431, E432, E433, E434, E445, E435. The diff vs `main` @ `fe3a604` is governance bookkeeping only: `specs/release-cd-v5.0.0.md`, `qa_reports/tests_release-cd-v5.0.0.md`, `qa_reports/no-new-test_release-cd-v5.0.0.txt`, `.current/_primary/*`, and the coordinator-written v5.0.0 entry under `## [Unreleased]` in `CHANGELOG.md`. No code, test, content or template change.
- Every AC1–AC10 `proof:` was executed by the judge (log in `qa_reports/review_T-RELCD8-01.md`); full suite 4576/4579 passed, 0 fail, 3 skipped, exit 0.
- The CHANGELOG entry is the approved draft verbatim; its citations check `[]`; its counts and context sizes equal AC5's measurements at HEAD.
- Verdict: APPROVED (two recommended findings on proof text, neither blocking).

## AC Completeness
AC1 — implemented — range classification exact: 319/289 commits, 516 paths, union 462 less the one net-unchanged `.d.ts`, nine deletions, no `lib guards transport .github` change.
AC2 — implemented — ten lane handoffs, nine evidence files last=PASS, three review reports APPROVED, backlog pre-marks, 30 ancestors all as specified.
AC3 — implemented — 38 CI runs success attempt 1 with both Node jobs green (read through `gh api`; see Correctness R1); local suite 4576/4579, `# fail 0`, exit 0.
AC4 — implemented — check-version OK (4.23.0), bookkeeping / md-tables / tickets / agc check / transitions-sync green, lockfile identical to v4.23.0, package.json delta one line, audit exit 0 at high (1 low, 6 moderate).
AC5 — implemented — registries `33 17 13 13 22`, schema `{"handoff":17,…}`, error-code and tool-input deltas exact, `REMOVED_OLD_PATH_STEPS` five with guide hints, file counts, rebuild + golden re-capture byte-identical, budgets measured equal to bounds.
AC6 — implemented — guide covers every breaking change except the three recorded gaps (carried by the CHANGELOG); `resume_of` enum `["code-reviewer"]`; refine message correct (see Correctness R2).
AC7 — implemented — v4.23.0 off-main, describe `v4.22.0`, 4.23.0 on main, `5.0.0 4.24.0`, E444 files identical, four differing files carry no adapter hunk.
AC8 — implemented — the registered 16 → 17 step removes exactly `qa_round`, `qa_rounds_total` and nothing else; working-tree handoff at 17 without the keys.
AC9 — implemented — `start --dry-run` on a `main` worktree stops exit 60 `PRECONDITION_NOT_PASS` with nothing changed; pre-marks, summary, spec check, codes, `entry null`, no release branch, all as specified.
AC10 — implemented — entry verbatim, `11 0 []`, fourteen keys present, guide headings covered, Notes equal AC5, leak scan clean.
AC11 — implemented after PASS — read-back and post-PASS dry run reported in the judge's final reply.

## Correctness
- **R1 — recommended (proof text, not this diff's code)** — `specs/release-cd-v5.0.0.md` AC3 proof uses `gh run view --json …,attempt,…`; the installed gh 2.29.0 has no `attempt` JSON field, so the proof errors for all 38 runs. The same facts were read through `gh api …/actions/runs/<id>` (`run_attempt`) and `…/jobs`; all 38 lines match the expectation. Next release-gate spec should use the `gh api` form, which the spec's own Dependencies already prescribes for sha lookups.
- **R2 — recommended (proof text)** — AC6 expects `tr.QA_PASS_REFINE_MESSAGE.slice(0,60)` to print `status="PASS" requires agent_id="code-reviewer": code-reviewer is t`, a 71-character string that a 60-character slice cannot produce. The actual output is that text's first 60 characters, and the full message starts with the expected text (`startsWith` = true). No code defect.
- Tests: every scenario is a `command` scenario (no test written, by design and per the qa-engineer SOP step 4b); the test report lists all eleven proofs verbatim and the no-new-test record has one line per AC. No test defect. Coverage measurement N/A (no new or modified source file).
- Data notes (not findings): bookkeeping 493/278 rows vs cut-time 492/277 (E449 filing; allowed); `main` is `fe3a604`, so the AC9 worktree ran on it.

## Quality
No findings. The CHANGELOG entry follows the house structure (lead paragraph, Upgrade notes, Added, Changed, Removed, Notes) and sits directly under `## [Unreleased]`. Comment check (5d): the diff adds no code comments.

## Architecture
No architecture spec exists for this feature (no build). Layering unchanged; the spec correctly leaves the release to the runner.

## Security
No findings. No new input crosses a trust boundary; no secrets. Leak scan of the CHANGELOG entry (local paths, usernames, tokens, URLs) is clean. `npm audit` has no HIGH/CRITICAL (1 low, 6 moderate; human ruling 4).

## Performance
No findings. No executable code changed; suite duration ~110 s, in line with the cut-time run.

## Verdict
APPROVED — AC1–AC10 hold on the committed tree and the CHANGELOG entry is verbatim and consistent with the measured inventory; the two findings are recommended corrections to proof text only.
