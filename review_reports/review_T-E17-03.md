# Review — T-E17-03 (review of T-E17-01..02)

covers: T-E17-01, T-E17-02, T-E17-03

## Summary
- Adds one CRITICAL record-integrity Hard rule to `content/skill-release-engineer.md` (+1 line, after the D10 rule) and a matching CRITICAL paragraph to `templates/claude-code-agents/release-engineer.md` (+2 lines, between the RELAY paragraph and the driftBaselineIds paragraph).
- Two implementation files, +3 lines total, content-only, zero code, zero tests (T-E17-04 owns pins).
- Scaffolding also present in the working tree (`docs/backlog.md` E17 row, `tasks.md` `## E17`, `.current/handoff.md` routing) — all within the T-E17 ticket-definition/state scope, not implementation-file changes.
- Rule text covers all four backlog E17 load-bearing elements in both files; incident-reason tail is factually accurate against a484a4d.
- Verdict: APPROVED.

## Correctness
No findings.
- **All four load-bearing elements present, both files.** (1) git-diff-stat-derived file lists — "MUST appear in the `git diff --stat` of the commit being described" (skill:23, template:21); (2) exists-on-disk-at-write-time — "every referenced report/spec path MUST exist on disk at write time" (both); (3) never-from-memory-of-brief — "NEVER from memory of the dispatch brief" (both); (4) no-fabricated-rounds — "NEVER claim a code-review or QA round that has no on-disk report" (both).
- **Incident-reason tail factually accurate against a484a4d.** Verified each clause: (a) v3.83.0 commit message + CHANGELOG described a `tools/handoff-orchestrator.ts` change that did not ship — confirmed by a484a4d removing the `tools/handoff-orchestrator.ts` CHANGELOG "Changed" bullet and its correction note; (b) nonexistent spec/report paths — confirmed by a484a4d retargeting `specs/e14-ci-ground-truth.md`/`specs/e16-judge-dispatch-charter.md` → `specs/e14-e16-release-hardening.md` and `qa_reports/review_T-EB-0{3,4}.md` → `qa_reports/archive/e14-e16-release-hardening/…`; (c) fabricated E15 code-review round — confirmed by a484a4d rewriting the E15 entry from "Code-review APPROVED. QA verified." to "single-role qa-engineer ticket (test-only; no code-review round by design)"; (d) "corrected post-release in commit a484a4d" — a484a4d is exactly `docs: v3.83.0 record corrections`. The postmortem is not propagated wrong.
- The tail also names "release notes" among the fabricated records. Not directly evidenced by a484a4d (which touches only in-repo files, not the GitHub release body), but it is faithful to the ticket's own spec (the `docs/backlog.md` E17 row lists "gh release notes" explicitly) and consistent with the incident pattern. Not a defect.

## Quality
No findings. Both additions mirror the existing E9A / D10 CRITICAL-bullet structure (bold lead-in + "(E17)" tag + Reason tail on the skill side; bare CRITICAL paragraph on the template side, matching the E9A-02 template precedent that omits forensics). Naming and phrasing match the surrounding Hard-rules block.

## Architecture
No architecture spec for this feature. Placement is correct: the skill rule sits inside the `## Hard rules` block immediately after D10 and does NOT touch the `## SOP` section — SOP step 8's HEREDOC/commit-message-format prose (skill:16, skill:60) is byte-unchanged. Template insertion sits between the RELAY-REQUIRED paragraph and the driftBaselineIds paragraph as specified.

## Security
No findings. No trust boundary, input, or secret touched — documentation text only.

## Performance
No findings. No runtime code path affected.

## Verdict
APPROVED — rule text covers the backlog E17 scope exactly in both files, the incident-reason tail is factually accurate against a484a4d, no contradiction with D10 / E9A-relay / no-hand-edit Hard rules, SOP step 8 prose and both template pinned blocks (frontmatter first line + `Example reply suffix` tail) are intact, change is content-only (+3 lines, two md files), and `npm run build` + `npm test` (1420/1420) are green.
