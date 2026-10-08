# e269-rule-text-budget

Lane e269 of the E260 follow-ups fan-out (tickets E269, E256, E265, E274). Scope is the lane row in `specs/fanout-e260-followups.md`; it is not widened here.

## Problem Statement

Constitution section 6 allows `git stash` / `git stash pop` but never names `git stash drop` or `git stash clear`, and the code-reviewer and qa-engineer SOPs never say how to run a negative control. In lane e260f a reviewer ran a stash plus drop that also discarded its own uncommitted `tw_update_state` write. Separately, `content/skill-release-engineer.md` cites same-file line numbers (`:143`, `:196`), a script line range (`verify-release.mjs:113-125`) and a ticket (E104) that no longer point at what they claim, and two titles in `test/context-budget.test.mjs` state caps (4376, 2642) that lag the asserted caps (4401, 2852).

## User Stories

- As an agent holding a role in any managed workspace, I want the sanctioned-git list to forbid the stash commands that destroy set-aside state, so that a judge cannot lose a governance write by dropping a stash.
- As a code-reviewer or qa-engineer, I want my SOP to say where a negative control runs and why not via stash, so that I do not repeat the e260f incident.
- As a release-engineer reading my SOP, I want cross-references that name a step, heading or flag instead of a line number or a recycled ticket id, so that the pointers survive edits.
- As a maintainer, I want budget-test titles that equal the caps they assert, and a check that keeps them equal, so that the same drift is not fixed a third time by hand.

## Acceptance Criteria

- **AC1 (E269a)** — Given `content/const-15-core-tail.md` section 6 *Sanctioned git operations*, when it is read, then its FORBIDDEN list also names `git stash drop` and `git stash clear` with the reason that they irreversibly discard stashed content, `git stash` / `git stash pop` remain allowed, the first sentence pinned by `test/e178a-integrator-role.test.mjs` is byte-identical, and no other section 6 sentence is rewritten.
  proof: `git diff --stat main...HEAD -- content/const-15-core-tail.md` shows one changed line, and `node --test test/e178a-integrator-role.test.mjs` passes with that test file unmodified (`git diff --quiet main...HEAD -- test/e178a-integrator-role.test.mjs`).
- **AC2 (E269b)** — Given `content/skill-code-reviewer.md` and `content/skill-qa-engineer.md`, when each is read, then each states that a negative control (deliberately breaking code to confirm a test catches it) runs on a copy outside the worktree, never via `git stash`, because `tw_update_state` writes stay uncommitted until the role commits them, so a stash would sweep them up too.
  proof: `grep -c "git stash" content/skill-code-reviewer.md content/skill-qa-engineer.md` prints a count of at least 1 for each file, and each hit sits in a sentence containing both "outside the worktree" and "tw_update_state".
- **AC3 (E256)** — Given `content/skill-release-engineer.md` step 13a, when it is read, then its two same-file line references (`:143`, `:196`) are replaced by the step or heading name each one meant, and the Reason note near line 26 that names E104 as its only pointer says in plain words what it meant (a path cited as context inside a note about a different ticket) with no ticket id as the sole pointer.
  proof: `grep -nE "at :143|at :196|\(E104\)" content/skill-release-engineer.md` prints nothing.
- **AC4 (E265)** — Given the step 13a Reason paragraph, when it is read, then it cites the `--close-out` flag or the function name in `scripts/verify-release.mjs` instead of the line range.
  proof: `grep -n "verify-release.mjs:[0-9]" content/skill-release-engineer.md` prints nothing.
- **AC5 (E274)** — Given `test/context-budget.test.mjs`, when the skill-pm and skill-sr-engineer cap tests are read, then their titles say 4401 and 2852, equal to the numbers asserted in their bodies.
  proof: `grep -nE "meets ≤ (4376|2642) cap" test/context-budget.test.mjs` prints nothing.
- **AC6 (E274 check)** — Given every test in `test/context-budget.test.mjs` whose title carries `≤ N` or `<= N`, when `node --test test/e269-budget-title-sync.test.mjs` runs, then it passes only if N equals a `<=` number asserted in that test's body, and it fails on a title/assert mismatch.
  proof: `node --test test/e269-budget-title-sync.test.mjs` passes at HEAD, and the same test run against a copy of `test/context-budget.test.mjs` (outside the worktree) with one title number changed fails.
- **AC7 (goldens)** — Given the section 6 change composes into all constitution-bearing goldens, when `test/fixtures/compose-golden/**` is regenerated, then every changed hunk is explained in the qa report as the section 6 addition and nothing else, and goldens that do not contain `const-15` are unchanged.
  proof: `git diff --stat main...HEAD -- test/fixtures/compose-golden` lists only constitution-bearing files, and each hunk's added text is the AC1 wording.
- **AC8 (caps)** — Given the section 6 addition raises the stripped constitution size, when the budget tests run, then every cap that contains the constitution is set to the exact re-measured value (zero headroom, the existing cap rule), and only with the human's approval of the numbers recorded in the cut.
  proof: `node scripts/test-lock.mjs -- npm test` passes at the final HEAD.
- **AC9 (independence)** — Given qa authors the test and golden edits, when the lane closes, then a code-reviewer has reviewed those edits and a separately dispatched qa verifier wrote PASS.
  proof: `review_reports/` holds a review for the qa-authored task and the PASS write's `agent_id` task was a different dispatch from the author's `qa-engineer:Blocked` write (handoff dispatch log).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| const15.forbidden-stash | `git stash drop` and `git stash clear` named in the FORBIDDEN list, reason "irreversibly discard stashed content" (final wording is sr-engineer's, within the AC1 constraints) | authored-here: wording of a rule the ticket E269 specifies in substance |
| skill.negative-control | negative control runs on a copy outside the worktree, never via `git stash`, because `tw_update_state` writes stay uncommitted until the role commits them (final wording is sr-engineer's, same sentence meaning in both SOPs) | authored-here: wording of a rule the ticket E269 specifies in substance |
| skill-re.step-refs | step or heading names replacing `:143` / `:196`, a plain-words replacement for the E104 pointer, and the `--close-out` flag name | authored-here: sr-engineer reads the intended targets in the file (E256 says they are about lines 145 and 207) |
| budget.titles | skill-pm title `meets ≤ 4401 cap`; skill-sr-engineer title `meets ≤ 2852 cap` | docs/backlog.md row E274 (asserted caps in the same test bodies) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any other section 6 sentence, any other role SOP, E263's rule question.
- Editing `test/e178a-integrator-role.test.mjs` unless AC1's wording unavoidably breaks an assertion there (qa only, then recorded in the qa report).
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks): release-engineer, post-PASS.
- Any file outside the lane's owned list (see the fan-out spec ownership row).

## Dependencies / Prerequisites

Prerequisites E258 and E260 are shipped. No external references (Resource Audit Gate: the only hits are ticket ids and in-repo paths; `external_refs` stays empty). No design file; visual arm inactive. Section 6 is a shared generated input owned by this lane only.

### Cap measurement (human decides with the cut approval)

Measured at the lane base with the harness estimator (`ceil(chars / 4)`) over `composeConstitution` then `stripOriginTags` then `stripRationale`:

| measure | current (= asserted cap) | test line |
|---|---|---|
| stripped constitution, chain + design-armed | 10057 ~tok (40227 chars) | context-budget AC8, `<= 10057` |
| stripped constitution, chain + non-design | 7959 ~tok | context-budget `<= 7959` |
| stripped constitution, lite + design-armed | 4438 ~tok | no dedicated cap found; qa re-measures |
| stripped constitution, lite + non-design | 4020 ~tok | no dedicated cap found; qa re-measures |
| teamwork coordinator bundle, design-armed | cap 20434 ~tok | context-budget `<= 20434` |
| lean always-on bundle | cap 5548 ~tok | context-budget `<= 5548` |

Every cap has zero headroom by the repo's own cap rule, so any added character raises it. The AC1 addition is about 76 characters (for example `, \`git stash drop\`, and \`git stash clear\` (irreversibly discard stashed content)` replacing the word "and" before the last FORBIDDEN entry), which is about +19 ~tok. Estimated new values if sr-engineer keeps to that size: design-armed constitution about 10076, non-design about 7978, coordinator bundle about 20453, lean bundle about 5567 only if it contains const-15 (qa confirms by measuring). The exact numbers are re-measured by qa after sr-engineer's final wording; the estimate is the budget sr-engineer should stay within: no more than 100 characters added to const-15. The skill-code-reviewer, skill-qa-engineer and skill-release-engineer edits sit in no constitution cap and in no compose golden.

Raising these caps by about 19 ~tok each is therefore likely needed; the human approves that together with the cut.

### E274 check decision

Decision: add the check, as `test/e269-budget-title-sync.test.mjs` (an owned file; qa authors it).

Why: the same title/assert drift has now been fixed three times by hand (the lean bundle title, an older pm title, now pm and sr-engineer). Zero-headroom caps get re-measured and bumped on nearly every content wave, and the title is a second place to forget. The check is cheap: read `test/context-budget.test.mjs`, split into `test(` blocks, take the number after `≤` or `<=` in each title, and require it to equal one of the `<=` numbers asserted in that block. It lives in its own file, not inside `context-budget.test.mjs`, so the cap file stays focused and a mismatch names the offending title. Limit: it only matches titles that carry a literal number after the comparison sign; prose such as "~1830 lighter" is not checked.

### Judge independence for qa-authored test edits

Only qa-engineer edits `test/`, so the author of the title fixes, the new check, the cap edits and the golden regeneration is a qa-engineer session. That session cannot judge its own edits. Chain: sr-engineer edits content, a code-reviewer reviews those content edits, a qa author session makes the test and golden edits and writes `qa-engineer:Blocked` (authoring done, not a failure), pm routes with `resume_of: code-reviewer`, a code-reviewer (clean context) reviews the qa-authored test edits and goldens, and a fresh Task-dispatched qa verifier that authored none of it runs the full suite and writes PASS. Negative controls (for example, changing one title number to prove AC6 fails) run on a copy outside the worktree, never via `git stash`.

## Task breakdown

| task | role | files | AC |
|---|---|---|---|
| T-E269-01 | sr-engineer | `content/const-15-core-tail.md` | AC1 |
| T-E269-02 | sr-engineer | `content/skill-code-reviewer.md`, `content/skill-qa-engineer.md` | AC2 |
| T-E269-03 | sr-engineer | `content/skill-release-engineer.md` | AC3, AC4 |
| T-E269-04 | code-reviewer | review of T-E269-01..03 (`review_reports/*E269*`) | AC1-AC4 |
| T-E269-05 | qa-engineer (author) | `test/context-budget.test.mjs`, `test/e269-budget-title-sync.test.mjs`, `test/fixtures/compose-golden/**` (conditionally `test/e178a-integrator-role.test.mjs`) | AC5-AC8 |
| T-E269-06 | code-reviewer | review of the T-E269-05 test and golden edits | AC5-AC9 |
| T-E269-07 | qa-engineer (fresh verifier) | full suite on the final HEAD, verdict | AC1-AC9 |
