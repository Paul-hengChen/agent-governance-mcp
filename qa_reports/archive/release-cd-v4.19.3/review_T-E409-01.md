covers: T-E409-01, T-E411-01, T-E409-02, T-E411-02, T-E409-03

# QA review: e409-lite-wording-const-header (E409 + E411)

Reviewer: qa-engineer (sonnet). Code-review APPROVED round 2 (`review_reports/review_T-E409-01.md`).

## Expected-Red Diff

Phase 0.5 run BEFORE any re-baseline edit, on HEAD 6c6da9d: `node scripts/test-lock.mjs -- npm test` gave 4042 tests, 4022 pass, 18 fail, 2 skipped. Failing names (19 `not ok` lines) compared with `qa_reports/expected-red_e409-lite-wording-const-header.txt`:

- 18 leaf failures = the 18 manifest entries exactly (11 compose-equivalence, deliverable-guard A3, e393 AC-C01, 2 prompt-state-footer, 2 teamwork-lite, e391 AC-G2-11).
- 1 extra line: `constitution-deliverable-guard (v3.27.0)`, the parent roll-up of A3; node does not count it under `fail`. Disposition: roll-up of a manifest entry, not an independent red.
- Missing from actual: none. Unexplained reds: none.

Phase 0.5: clean (18/18 manifest entries confirmed red, 0 unexplained reds).

## Copy Audit (Phase 1, 3a)

- lite.16: `content/skill-coordinator-lite.md` line 16 contains the Copy / Strings `lite.16` text verbatim (checked by e391 AC-G2-11, count 1, plus the handler-facts test).
- c01.1: `content/const-01-core-head.md` first line is exactly `# Constitution` (deliverable-guard A3).
- Visual Tokens / Widgets: N/A. Phase 1.5: skipped (no Visual Baselines declared).

## Phase 3

Placement: dispatch brief `Test-file placement` line pre-authorized `test/e409-lite-write-tool-facts.test.mjs` and the re-pinned files; no ask needed.

AC to test map:
- AC1: `test/e391-prompt-audit-stale-facts.test.mjs` AC-G2-11 (new span 1, old span 0, `will be rejected` 0, retitled).
- AC2: `test/e409-lite-write-tool-facts.test.mjs` (5 handler-gate tests + lite-line match; bodies located by function name).
- AC3, AC4: `test/constitution-deliverable-guard.test.mjs` A3 (exact first line; four compositions start with `# Constitution\n`; no version or HTML comment).
- AC5: `test/e393-builder-judge-core.test.mjs` AC-C01 (`startsWith("# Constitution\n")`), `test/prompt-state-footer.test.mjs` (5 sites, `/^# Constitution$/m`), `test/teamwork-lite.test.mjs` (2 sites).
- AC6: goldens.
- AC7: context-budget (below).
- AC8: closing checks (below).

## AC Execution Log

- AC1/AC2/AC3/AC4/AC5: `node --test` over the six re-pinned/new files: 71 tests, 71 pass, 0 fail (exit 0).
- AC6: `node scripts/capture-constitution-golden.mjs`; `git diff --stat test/fixtures/compose-golden/` listed exactly the 11 goldens, 1 insertion / 1 deletion each; every hunk is `@@ -1 +1 @@`, `-# Constitution v3.41.0 <!-- versioned independently of package.json -->` to `+# Constitution`. `skill-coordinator-monolith.txt` not in the diff (byte-identical). compose-equivalence, skill-manifest, e90 capture-completeness and render-structure suites green inside the full run.
- AC7: `node --test test/context-budget.test.mjs`: 54 tests, 54 pass. `git diff --stat 6e1a9d4 HEAD -- test/context-budget.test.mjs test/e410-task-alias-content-tail.test.mjs` is empty (both unedited).
- AC8: see Closing checks.

### Budgets (chars/4, measured with an instrumented scratch copy of the budget test, outside the repo)

| budget | cap | before (trial) | measured after | trial after |
|---|---|---|---|---|
| lean always-on | 5723 | 5675 | 5665 | 5665 |
| stripped constitution | 10598 | 10466 | 10451 | 10451 |
| non-design constitution | 8501 | 8466 | 8452 | 8452 |
| teamwork bundle | 21715 | 21398 | 21384 | 21384 |

Design-only strip saving: 1999 against floor >= 1999 (zero margin, as the spec predicted; not a cap edit). No cap or floor value changed.

## Closing checks (HEAD 9b91e3f, clean tree, no untracked files)

- `node scripts/test-lock.mjs -- npm test`: run 1 gave 4048 tests, 4045 pass, 1 fail, 2 skipped. The one red was `test/e132-lane-registry.test.mjs` gap-6 (an elapsed-time scaling test under load), unrelated to this diff (reads no content/). Isolated rerun: 22/22 pass. Full rerun on the same HEAD: 4048 tests, 4046 pass, 0 fail, 2 skipped, exit 0.
- `npm run build`: exit 0; `git status --porcelain` empty afterwards (no dist/ diff).
- `npm run check:bookkeeping`: exit 0.
- `npm audit --audit-level=high`: exit 0.
- `test/e410-task-alias-content-tail.test.mjs`: unedited, green inside the full run.
- Crash checkpoint write skipped on purpose: it would dirty `.current/` and break the clean-tree requirement for the final run.

## Verdict

PASS for T-E409-01, T-E411-01, T-E409-02, T-E411-02, T-E409-03.
## 2026-11-05T10:39:26.027Z — PASS — by qa-engineer

suite-result: 4046/4048 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS: all ACs AC1-AC8 verified. Expected-red diff clean 18/18. 71 re-pinned tests green, 11 goldens single line-1 hunk, monolith byte-identical. Budgets lean 5665, stripped 10451, non-design 8452, teamwork 21384, no cap edit. Build/dist clean, bookkeeping 0, audit 0. Full detail in qa_reports/review_T-E409-01.md.

