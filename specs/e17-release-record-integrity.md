# E17: Release Record Integrity

## Incident Summary

v3.83.0 release commit message, CHANGELOG entry, and release notes described a `tools/handoff-orchestrator.ts` change and referenced nonexistent spec/report paths. The narrative was written from memory of the dispatch brief instead of the actual `git diff --stat` output, violating basic release-engineering discipline. Corrected post-release in commit a484a4d.

## Hard Rule

Every file path named in commit messages, CHANGELOG entries, or release-notes bodies **MUST** appear in the `git diff --stat` of the commit being described. Every referenced report or spec path **MUST** exist on disk at write time.

**Verification**: derive file lists from `git diff --stat` run immediately before writing records — never from memory of the dispatch brief. Never claim code-review or QA rounds that have no on-disk report (`review_reports/` / `qa_reports/`, including `qa_reports/archive/**`).

## Acceptance Criteria

1. Hard rule codified in release-engineer SOP (step 6, Hard rule sequence).
2. Hard rule mirrored in dispatch template for release-engineer role.
3. Test pinning suite (E17-S1..S4 in `test/feature-lease.test.mjs`) covering:
   - git-diff-stat-derived file lists are load-bearing (not dispatch-brief memory)
   - all report/spec references must exist on disk at write time
   - no fabricated review/QA rounds
   - incident reason-tail factual pins (v3.83.0 narrative fabrication, a484a4d correction)
4. Full test suite green (1424/1424, net +4 from E17 pins, zero regressions).
5. npm build clean, npm audit OK, check-version OK.

## Reference

- **Backlog row**: docs/backlog.md E17 row (incident-grounded)
- **Implementation**: content/skill-release-engineer.md Hard rule #6, templates/claude-code-agents/release-engineer.md CRITICAL paragraph
- **Test pins**: test/feature-lease.test.mjs E17-S1..S4
- **Post-release correction**: commit a484a4d (v3.83.0 narrative correction)
- **Related**: E9A (no-MCP-path relay), E1A (terminal-marker resilience), D10 (push rejection recovery)

## Status

Released in v3.84.0 (2026-07-13). All criteria met.
