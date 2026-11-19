covers: T-E422-01, T-E422-02, T-E422-03

# QA review: e422-ticket-file-format (T-E422-01..03)

Phase 0.5: skipped (no expected-red manifest declared).
Phase 1.5: skipped (no Visual Baselines declared).
Phase 3: placement per dispatch brief (creation pre-authorized; `test/e422-*.test.mjs`; inline temp fixtures; no existing test edited).

## AC Execution Log

Raw results (this round, worktree HEAD 24b1dc2 plus the three new test files):

| AC | command | raw result | verdict |
|---|---|---|---|
| AC1, AC2, AC4, AC5, AC6, AC7, AC10 | `node --test test/e422-ticket-file.test.mjs` | tests 53, pass 53, fail 0 | pass |
| AC9 | `node --test test/e422-ticket-dir-config.test.mjs` | tests 10, pass 10, fail 0 | pass |
| AC3 doc list, AC8 | `node --test test/e422-ticket-format-doc.test.mjs` | tests 16, pass 16, fail 0 | pass |
| AC3 (checker) | AC3 tests in `test/e422-ticket-file.test.mjs` (next_role, Review Round, lane, dispatch mechanism, Review-Round, agent id, handoff) | part of the 53 above | pass |
| AC11 | `node --test` on the 13 config test files listed in the spec | `# tests 213`, `# pass 213`, `# fail 0` | pass |
| AC12 | `git diff --stat c29f100 -- dist/ content/ tools/registry.ts docs/backlog.md package.json` | only `dist/tools/config.*` (4 files), `dist/tools/ticket-file.*` (4 files), `package.json` 1 insertion (`check:tickets`); nothing under content/, tools/registry.ts, docs/backlog.md | pass |
| build | `npm run build` | clean; no dist diff afterwards | pass |
| audit | `npm audit --audit-level=high` | exit 0 | pass |
| full suite | `node scripts/test-lock.mjs -- npm test` (after commit, empty `git status --porcelain`) | `# tests 4409`, `# pass 4407`, `# fail 0`, `# skipped 2`, exit 0 | pass |

## AC to test map

- AC1: `test/e422-ticket-file.test.mjs` titles starting "AC1".
- AC2, AC4, AC5, AC6, AC7, AC10: same file, titles starting with the AC number.
- AC9: `test/e422-ticket-dir-config.test.mjs`.
- AC3 doc list and AC8: `test/e422-ticket-format-doc.test.mjs`.
- Spec wording slip: AC8 says "four status forms"; the format defines three (reviewer and integrator ruling); three are tested.

## Copy Audit

Every Copy / Strings line is asserted verbatim by the checker tests; no unlisted user-facing string observed.

## Security smoke

Empty and whitespace-only files, CRLF and BOM, heading inside a fenced block, 500-scenario file, special characters in values, checker leaves the directory byte-identical.
## 2026-11-19T11:31:16.423Z — PASS — by qa-engineer

suite-result: 4407/4409 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS for T-E422-01, T-E422-02, T-E422-03 (details and AC Execution Log in qa_reports/review_T-E422-03.md). 79 new tests green (53 parser/checker, 10 ticketDir config, 16 doc/template). AC11 213/213; AC12 dist limited to ticket-file.* and config.*, package.json one script line; build clean, no dist diff; npm audit high exit 0; full suite 4407 pass, 0 fail, 2 skipped of 4409. Copy audit clean. Reviewer non-blocking notes carried forward.

