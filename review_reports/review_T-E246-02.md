# Review — T-E246-02

## Summary
- Scope: Comment discipline (constitution §6, code-reviewer SOP step 4b) on every comment in `test/e246-mailbox-teardown.test.mjs` introduced by ac27769..24e332f. The file was added in ac27769 and changed only by 24e332f in that range.
- 24e332f touches comments only: 5 lines added, 23 removed, every one a `//` line. `git diff -w --ignore-blank-lines 24e332f^..24e332f` has no changed lines that aren't comments, so no test code or assertion changed.
- `node bin/agc-init.mjs check` in the worktree exits 0 and gives no comment advisory for the test file. The only two advisories are for `bin/agc-init.mjs` (high-ratio, long-block), which were already judged in review_reports/review_T-E246-01.md and are out of scope here.
- `node --test test/e246-mailbox-teardown.test.mjs`: 15/15 pass after the trim.
- Verdict: APPROVED.

## AC Completeness
Out of scope. This is a comment-only relay on a test file, and specs/e246-mailbox-teardown.md AC1–AC11 were judged under T-E246-01. The integrator send-back for this relay asks for three checks:
- Relay check 1 — met — 24e332f is comment-only (see Summary).
- Relay check 2 — met — the step-4b verdicts for each comment are listed under Quality.
- Relay check 3 — met — `agc check` gives no comment advisory for test/e246-mailbox-teardown.test.mjs.

## Correctness
No findings. The diff has no executable change. Step 4a (expected-red sampling) does not arm: the diff changes only comments and adds no red tests, and the run is all green.

## Quality
Step-4b verdicts, one per comment in the file:

- L1 `// Coded by @qa-engineer` — kept: this is the repo's provenance stamp convention, not prose.
- L2–L6 file header — kept. It says WHAT (L2–L4) and WHY (L5), and ends with a one-line spec pointer (L6) in place of the old 11-line AC map. It is 5 lines, under the 7-line long-block limit. There is no `##` heading and no HOW. The 80-column summary clause applies to doc comments (`/** */` on declarations). This is a `//` module header, so I did not apply that clause.
  - optional: L2 (83 cols) and L5 (91 cols) could be wrapped to 80 to match the summary-width spirit.
- L30 `// best effort` — kept: a two-word note that says why the `catch` is empty, which is the standard idiom.
- L57–L58, the `setupLane` head comment — kept: it states the WHAT (the return shape) and the WHY (a private `_mailbox` per test) at the function head, as the rule asks.
  - recommended: L57 lists a `lane` key that `setupLane` does not return. The actual keys are `repo, ticket, branch, lanePath, mailboxRoot, mailbox` (L69). Drop `lane` so the WHAT is accurate.
- L63 `// Canonical path: …realpath (macOS /var -> /private/var)` — kept: a one-line warning about a non-obvious platform pitfall. It is in the function body.
  - optional: this could move to the function head with L57–L58.
- L84 `// A pid that is certainly not alive…` — kept: a WHAT comment at the head of `deadPid`.
- L107 `// AC8: success line…` — kept: a one-line spec pointer that ties the assertion to its AC.
- L219 `// A stale ref lock makes the real git branch -d fail…` — kept: it explains why the fixture below produces the refusal under test. Without it the `.lock` write looks arbitrary. One line, WHY-only.
- L234 `// Untracked junk in the lane: git worktree remove (no --force) refuses.` — kept: the same reasoning as L219.

No comment is sent back.

## Architecture
No findings. The change is comment-only in one test file, so layering is unchanged.

## Security
No findings. No new input, no secrets, and no path handling changed.

## Performance
No findings. The change is comment-only.

## Verdict
APPROVED — 24e332f is comment-only, every comment in the test file passes Comment discipline (one non-blocking accuracy nit at L57), and `agc check` gives no comment advisory for the file.
