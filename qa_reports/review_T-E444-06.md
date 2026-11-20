# QA review — T-E444-06

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-20T11:20:49.554Z — PASS — by qa-engineer

suite-result: 4465/4467 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test (Node 22.22.3))

covers: T-E444-01, T-E444-02, T-E444-03, T-E444-04, T-E444-05, T-E444-06, T-E444-07

Phase 0.5: skipped (no expected-red manifest declared). Phase 3.5: AC Execution Log recorded in qa_reports/review_T-E444-01.md (covers file); every proof ran and passed.

AC coverage: test/e444-claude-local-adapter.test.mjs (17 tests, 17/17 green on Node 22 and Node 20) maps AC1-AC15 + AC2b one test per id; AC7b and the amended AC12 notes case were red by design last round and are green after sr T-E444-07 (2c54ded). AC16 and AC17 via the git diff proof and the full suites below. New this round (reviewer R2): in AC12's no-block sub-case the fixture sets /CLAUDE.local.md in .git/info/exclude; the test asserts the dry-run plan prints the kept-rule line, and after eject --yes the rule is still present, the kept line is printed, and git status --porcelain lists no CLAUDE.local.md (Decision (k), last sentence).

Suite: Node 22.22.3 `node scripts/test-lock.mjs -- npm test`: 4465/4467 pass, 0 fail, 2 skipped (documented skips). Node 20.20.2 (fnm): 4397/4467 pass, 68 fail, 2 skipped; all 68 reds carry the better-sqlite3 'compiled against a different Node.js version' (NODE_MODULE_VERSION) error, i.e. local environment (shared node_modules built for Node 22); none are e444 tests; CI Node 20 is authoritative.

Checks: npm run build OK, dist unchanged, tree clean. npm audit --audit-level=high: no high/critical (7 vulns: 1 low, 6 moderate). ARTIFACT_EXCLUDE_RULES still four rules (/.current/, /tasks.md, /qa_reports/, /review_reports/). No static lane-paths import in bin/agc-init.mjs (only the pre-existing dynamic dist import in feature start; no added lines). git diff --stat 5f50af1...HEAD touches only bin/agc-init.mjs, docs/install.md, test/e444-*.test.mjs, specs/e444-*.md, .current/e444/**, review_reports/. No other lane's tests or shared generated files touched. node bin/agc-init.mjs check exits 0 (OK 4.22.0); advisories: 37 placeholder home-path hits skipped; 2 comment long-block warnings at bin/agc-init.mjs:2 (8 lines) and :4158 (11 lines), limit 7, advisory only.

