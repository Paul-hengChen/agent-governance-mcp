<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E246-01 [P0] sr-engineer: mailbox teardown in runFeatureFinish (bin/agc-init.mjs; both --shipped and --abandoned, placed right after removeWorktreeNoForce and before git branch -d; AC1-AC9 of specs/e246-mailbox-teardown.md) + STR_USAGE_FEATURE sync + content/skill-integrator.md stage 3/6 sentences (AC10, add-only) + docs/lane-protocol.md section 5 one line (AC11) | depends_on: none
- [x] T-E246-02 [P1] qa-engineer: trim test/e246-mailbox-teardown.test.mjs header comment to at most 7 lines (WHAT + at most one-line WHY; drop the Spec-to-Test map) per constitution §6 Comment discipline; comment-only, no assertion change (integrator send-back to-lane#3). Then a non-author judge (code-reviewer) records the step-4b kept/sent-back line on that comment. | depends_on: T-E246-01
