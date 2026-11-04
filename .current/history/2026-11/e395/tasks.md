<!-- schema_version: 2 -->
# Tasks

## e395-claude-md-template-tail

- [x] T-E395-01 [P1] sr: CLAUDE.md literal sites + F1 — apply Copy/Strings c395.what-50, c395.layout-91, c395.layout-126, c395.testing-158, c395.testing-163 verbatim; no other line (AC-E395-1/2/3/6; spec specs/e395-claude-md-template-tail.md) | depends_on: none
- [x] T-E395-02 [P1] sr: CLAUDE.md Layout — insert the 11 c395.layout-rows as one block right after the tools/fanout-*.ts row, in order; add rows, never move one (AC-E395-4/5) | depends_on: T-E395-01
- [x] T-E404-01 [P1] sr: slim templates/claude-code-agents/release-engineer.md to the 15-line target (frontmatter, watermark, c404.load, c404.rebaseline, RELAY byte-identical, c404.suffix); delete old lines 11/15/17/21/23 (AC-E404-1..8) | depends_on: none
- [x] T-E395-03 [P1] qa: write test/e395-claude-md-tail.test.mjs (AC-E395-1/2/4/5/6); confirm test/e391-prompt-audit-stale-facts.test.mjs and test/e178a-integrator-role.test.mjs green unmodified (AC-E395-3/7) | depends_on: T-E395-02
- [x] T-E404-02 [P1] qa: re-pin test/subagent-templates.test.mjs (v3.21.2 AC2 non-haiku suffix), test/e392-subagent-templates.test.mjs AC8, test/e166-template-defers-staging.test.mjs T-E166-01b; write test/e404-release-engineer-template.test.mjs (AC-E404-1/3/4/5/7) | depends_on: T-E404-01
- [x] T-E404-03 [P1] qa: re-pin template assertions only — test/release-staging.test.mjs AC5, C13-AC6/AC7 x2; test/feature-lease.test.mjs S4, E17-S3, E17-S4 template half; conditional on integrator ruling: release-staging D10-AC4 and feature-lease E9A-S5 (AC-E404-5/7) | depends_on: T-E404-01
- [x] T-E395-04 [P0] qa: lane verification on final committed clean HEAD — AC-SCOPE, AC-E395-3, AC-E404-8, AC-DIST, AC-BOOK (npm run check:bookkeeping exit 0), AC-STAMP, AC-GEN (golden/budget red = stop and escalate), AC-SUITE (node scripts/test-lock.mjs -- npm test, qa_suite_result) | depends_on: T-E395-03, T-E404-02, T-E404-03
