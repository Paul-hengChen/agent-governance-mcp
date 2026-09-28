# QA review — T-REL4-05 (release-v4.0.0 AC5 re-verification)

covers: T-REL4-03, T-REL4-04, T-REL4-05

## Phase 0 — Claim
Single-role judge dispatch (Task-spawned, Constitution §3.1/§3.2). Re-verifying
AC5 (`specs/release-v4.0.0.md` lines 100-114) after code-reviewer APPROVED
T-REL4-03's diff (`review_reports/review_T-REL4-03.md`). Working tree at
`main` = `origin/main` = `3a3429d` (fix commit `0252e02` + review commit
`3a3429d`), confirmed clean and pushed.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_release-v4.0.0.txt` manifest declared;
`dispatch_mode` unset — feature mode).

## Phase 1 — Review

### Diff scope check (T-REL4-03, re-confirmed independently of code-reviewer)
`git show 0252e02` against `.github/workflows/ci.yml`: exactly a 2-line
addition —
```
       - uses: actions/checkout@v4
+        with:
+          fetch-depth: 0
```
— under the existing `actions/checkout@v4` step, nothing else in `ci.yml`
touched, no `test/` file in the commit's file list. The commit's other two
files (`.current/_primary/handoff.md`, `.current/_primary/dispatch.jsonl`)
are governance bookkeeping, expected per SOP, not in scope for AC5. Matches
code-reviewer's APPROVED finding (`review_reports/review_T-REL4-03.md`)
independently re-derived, not merely re-read.

### Copy Audit Gate
N/A — spec's Copy/Strings table declares zero user-facing strings.

### Visual Audit Gate
N/A — spec's Visual Tokens table declares zero visual literals.

## Phase 1.5 — Visual Compare
Skipped (no `design/release-v4.0.0.md`).

## Phase 3 — Tests
Skipped per dispatch brief: "Test-file placement: none — T-REL4-05 is
verification-only; do not create or edit any test file." No test file
created or modified. No gap to report — AC5's own `proof:` line requires
running the existing suite and the live CI run, not new tests, and route A
(spec-sanctioned) is explicitly "no test file... changes."

## Phase 3.5 — AC Execution Log

**AC5** (`specs/release-v4.0.0.md:100-114`) declares:
> proof: `npm test` (exit 0, full tally) plus `gh run list --workflow
> ci.yml --branch main -L 1` then `gh run view <run-id>` showing
> `conclusion: success` for both `test (20)` and `test (22)` on the fix
> commit's SHA.

**(i) Full local suite**, run on the committed tree (`3a3429d`) via the
project's lock wrapper:
```
node scripts/test-lock.mjs -- npm test
```
Output (tail):
```
# tests 2817
# suites 1
# pass 2817
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
Verdict: **PASS** — exit 0, 2817/2817, zero unexplained reds (the 6 tests
that were failing pre-fix — `test/e130-lane-default.test.mjs` #777/#787 and
`test/e178a-integrator-role.test.mjs` #931/#932/#934/#943 — are confirmed
passing in this run).

**(ii) Live GitHub Actions run for the fix commit.**
```
gh run list --workflow ci.yml --branch main --limit 5
```
Top row: `completed success "docs(review): release-v4.0.0 T-REL4-03 —
APPROVED (T-REL4-04)" CI main push 36322938039`. That commit message is
`3a3429d` (HEAD, the review commit layered on `0252e02`) — same tree as the
fix commit for CI purposes since the review commit touched only
`.md`/handoff files.

```
gh run view 36322938039 --json headSha,conclusion,status,jobs
```
Result: `headSha: 3a3429d10a247a6bc73c5bf1ca2cc6b3dc8b9dc2`, `conclusion:
success`, `status: completed`; both matrix jobs —
`test (20)`: conclusion `success` (all steps incl. checkout, install,
build, Test all `success`);
`test (22)`: conclusion `success` (all steps incl. checkout, install,
build, Test all `success`).

This was independently re-checked, not taken on the coordinator's word —
the coordinator's cited run id (36322938039) and both job conclusions
(`test (20)`, `test (22)` = success) are confirmed to match the live `gh`
query above, against the exact head SHA `3a3429d` = current `main` =
`origin/main`.

**AC5 verdict: PASS.** Both proof clauses satisfied on the fix commit lineage
at HEAD `3a3429d`.

## Phase 4 — Run
- Project build: `node scripts/test-lock.mjs -- npm test` includes the
  `npm run build` prebuild step (via `pretest`/`prebuild` wiring) — zero
  errors, confirmed by the 2817/2817 green tally above.
- CI runnability: confirmed headlessly green on GitHub Actions (run
  36322938039, both matrix jobs, zero human interaction).

## Verdict
**PASS** — T-REL4-03 (CI fix) and T-REL4-05 (this re-verification) both
satisfy AC5. T-REL4-04 (code-reviewer's adversarial review) is supported by
`review_reports/review_T-REL4-03.md` (APPROVED, diff-scope-checked) and is
being completed alongside per SOP ("review task: complete it too if the
review evidence supports it").

T-REL4-02 remains open (doc-writer's completion note landed at `61a89dd`
without a task-completion capability) — left as-is per dispatch brief,
`next_role` left unset for the coordinator to re-dispatch release-engineer.
## 2026-09-27T13:43:38.593Z — PASS — by qa-engineer

AC5 re-verified PASS on main=origin/main=3a3429d (fix 0252e02 + review 3a3429d). (i) node scripts/test-lock.mjs -- npm test: 2817/2817 pass, 0 fail. (ii) gh run 36322938039 for headSha 3a3429d: conclusion success, test(20) success, test(22) success — independently re-checked, not taken on the coordinator's claim. Diff of 0252e02 confirmed scoped to .github/workflows/ci.yml (+2 lines: with: fetch-depth: 0) plus .current/_primary/ bookkeeping only — no test/ file touched. code-reviewer APPROVED T-REL4-03 (review_reports/review_T-REL4-03.md); evidence supports completing T-REL4-04 alongside. Full detail: qa_reports/review_T-REL4-05.md.

## 2026-09-27T13:43:59.120Z — PASS — by qa-engineer

AC5 re-verified PASS on main=origin/main=3a3429d (fix 0252e02 + review 3a3429d). (i) node scripts/test-lock.mjs -- npm test: 2817/2817 pass, 0 fail. (ii) gh run 36322938039 for headSha 3a3429d: conclusion success, test(20) success, test(22) success — independently re-checked, not taken on the coordinator's claim. Diff of 0252e02 confirmed scoped to .github/workflows/ci.yml (+2 lines: with: fetch-depth: 0) plus .current/_primary/ bookkeeping only — no test/ file touched. code-reviewer APPROVED T-REL4-03 (review_reports/review_T-REL4-03.md); evidence supports completing T-REL4-04 alongside. Full detail: qa_reports/review_T-REL4-05.md.

