# Review — T-E258A-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Adds one `- **Comment discipline**:` bullet to constitution section 6 (`content/const-15-core-tail.md:29-34`, 6 lines) and step `4b. **Comment check**` to `content/skill-code-reviewer.md:79`.
- Also adds the lane task ledger, spec, handoff state and the expected-red manifest (`qa_reports/expected-red_e258a-comment-rule.txt`). No code, test or fixture file is touched; goldens, budget ceilings and `test/e258a-comment-rule.test.mjs` stay with qa (T-E258A-02).
- Scope is inside the e258a row of `specs/fanout-e258.md` and `docs/lane-protocol.md` section 2. `content/skill-sr-engineer.md` is not touched, as the spec's Out of Scope requires.
- Verdict: APPROVED. The four ACs in scope (AC1, AC2, AC4, AC5) are met. No required findings.

## AC Completeness
AC1 — implemented — `content/const-15-core-tail.md:29`; the spec's awk proof lists `23: Generic citation` then `29: Comment discipline`, and the `## 7.` heading follows at line 36.
AC2 — implemented — `content/const-15-core-tail.md:29-34` has all five clauses: WHAT/WHY and never HOW (l.29); avoid comments in a function body except a short warning at the head of the function (l.29-30); long rationale goes in a tracked spec/design file or the commit message, with at most a one-line pointer (l.31-32); a one-sentence summary of at most 80 columns, then only params, return, constraints and pitfalls (l.32-33); a `##` heading marks a pasted spec and is sent back (l.34). The bullet runs 6 lines, within the Copy/Strings target of at most 6. The keyword test is qa's (T-E258A-02).
AC3 — out of this task's scope (qa T-E258A-02). const-15 is a core fragment, and the 11 compose-equivalence reds confirm the new text reaches every composed mode.
AC4 — implemented — `grep -nE 'tw_|gate|PASS|E258'` over lines 29-34 matches nothing. There is no bare ticket id, no untracked path and no governance jargon. The tone is plain prose in the spirit of Linux kernel coding style section 8.
AC5 — implemented — `content/skill-code-reviewer.md:79` matches the spec's `reviewer.comments-check` Copy string word for word. `grep -c 'agc check — comments'` prints 1. xxd shows `e2 80 94` (U+2014) with a single space on each side. "every comment the diff adds" covers flagged and unflagged comments.
AC6–AC9 — out of this task's scope (qa T-E258A-02).

## Correctness
- Expected-Red Sampling (step 4a): the manifest exists with 15 entries. After the commit, `npm test` in the lane worktree reports 2958 tests, 2940 pass, 15 fail. The 15 failures match the manifest one for one: 11 in `test/compose-equivalence.test.mjs` and 4 in `test/context-budget.test.mjs`. I sampled 4 entries by grep and each is a real, locatable test. The parameterized stem `is byte-identical to pre-refactor golden` appears 3 times (the template), the `DR-1 Option R invariant` test is at l.149, `AC2: lean always-on bundle…` is at `test/context-budget.test.mjs:226`, and `AC8/AC-P2-7: non-design…` is at l.2025. There are no unexplained reds.
- The new SOP step uses the existing letter-suffix convention (`4a.`, then `4b.`, as in `skill-sr-engineer.md` 3b/4b). No test depends on reviewer step numbering; a grep of `test/` for `4b.` and `Comment discipline` finds nothing.
- No other findings.

## Quality
- Step 4b (the comment check) applied to this diff: it adds no code comments, because both content changes are Markdown prose. The `agc check — comments` scan lives in lane e258b and is not in this worktree, so there are no warnings to judge.
- `recommended`: AC9's owned-path glob `qa_reports/*E258A*` does not literally match `qa_reports/expected-red_e258a-comment-rule.txt`. The manifest name is lowercase because the SOP requires `expected-red_<active_feature>.txt`. The intent is clearly in-lane, but a case-sensitive `fanout check` or AC9 path listing may flag it. qa should record it as an in-lane path under AC9, and the integrator can widen the glob in the fan-out doc if the tool complains. No change is needed in this task.
- `optional`: AC5's prose adds "(the scan is a trigger, not the scope — it may not have run)". Step 4b carries that meaning through "every comment the diff adds" but does not say it outright. A later edit could add "flagged or not" if reviewers are seen checking only the flagged comments. The implemented text is the spec's verbatim Copy string, so this is not a gap.
- The wrap width of the new bullet (at most 94 columns) is consistent with the surrounding bullets in the file.

## Architecture
There is no `specs/e258a-comment-rule-architecture.md`, and the spec rules out an architect hop. No change to prompts, the manifest or composition. Placing the bullet directly after *Generic citation* in section 6 follows the fan-out doc's placement note.

## Security
No findings. Only prose changes, with no executable surface, no inputs and no secrets.

## Performance
No runtime code changes. The only cost is a larger prompt from roughly 140 more tokens of constitution text in every composed mode, plus one line in the reviewer SOP. That growth is expected and bounded by R2; qa re-measures the zero-slack budget ceilings in T-E258A-02 (AC7). There is no regression beyond what the ACs require.

## Verdict
APPROVED — AC1, AC2, AC4 and AC5 are met with byte-exact contract strings, the diff stays within the lane's owned paths, and the only reds are the 15 expected ones in the manifest.
