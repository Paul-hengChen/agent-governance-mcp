covers: T-E444-01, T-E444-02, T-E444-03, T-E444-04, T-E444-05, T-E444-06, T-E444-07

# QA review: e444-claude-local-adapter (final round)

Phase 0.5: skipped (no expected-red manifest declared).

## AC Execution Log

Command for the AC1-AC10 and AC12-AC15 proofs (each names its test in test/e444-claude-local-adapter.test.mjs):
`node --test test/e444-claude-local-adapter.test.mjs` -> exit 0, 17 tests, 17 pass, 0 fail (Node 22.22.3; also green inside the Node 20.20.2 full run, no e444 entry among its reds).

| AC | proof | verdict |
|---|---|---|
| AC1 | test AC1 (ok 1) | pass |
| AC2 | test AC2 (ok 2) | pass |
| AC2b | test AC2b (ok 3) | pass |
| AC3 | test AC3 (ok 4) | pass |
| AC4 | test AC4 (ok 5) | pass |
| AC5 | test AC5 (ok 6) | pass |
| AC6 | test AC6 (ok 7) | pass |
| AC7 | test AC7 (ok 8) | pass |
| AC7b | test AC7b (ok 9), green after T-E444-07 | pass |
| AC8 | test AC8 (ok 10) | pass |
| AC9 | test AC9 (ok 11) | pass |
| AC10 | test AC10 (ok 12) | pass |
| AC11 | `node scripts/test-lock.mjs -- npm test` Node 22: 4465/4467, 0 fail, 2 skipped; AC11 test ok 13 | pass |
| AC12 | test AC12 (ok 14), now also pins the block-less rule-kept case (R2) | pass |
| AC13 | test AC13 (ok 15) | pass |
| AC14 | test AC14 (ok 16) | pass |
| AC15 | test AC15 (ok 17) | pass |
| AC16 | `git diff --stat 5f50af1 -- templates CLAUDE.md AGENTS.md .antigravityrules dist tools gates schema content` printed nothing (exit 0); ARTIFACT_EXCLUDE_RULES / LANE_EXCLUDE_RULES definition lines absent from the bin diff; full suite green | pass |
| AC17 | `node scripts/test-lock.mjs -- npm test` Node 22: 4465/4467 pass, 0 fail, 2 skipped (baseline 4448/4450 plus 17 new) | pass |

Node 20.20.2 full run: 4397/4467, 68 fail; all 68 carry the better-sqlite3 "compiled against a different Node.js version" error (local environment, node_modules built for Node 22); none is an e444 test. CI Node 20 is authoritative.
## 2026-11-20T11:20:49.554Z — PASS — by qa-engineer

suite-result: 4465/4467 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test (Node 22.22.3))

covers: T-E444-01, T-E444-02, T-E444-03, T-E444-04, T-E444-05, T-E444-06, T-E444-07

Phase 0.5: skipped (no expected-red manifest declared). Phase 3.5: AC Execution Log recorded in qa_reports/review_T-E444-01.md (covers file); every proof ran and passed.

AC coverage: test/e444-claude-local-adapter.test.mjs (17 tests, 17/17 green on Node 22 and Node 20) maps AC1-AC15 + AC2b one test per id; AC7b and the amended AC12 notes case were red by design last round and are green after sr T-E444-07 (2c54ded). AC16 and AC17 via the git diff proof and the full suites below. New this round (reviewer R2): in AC12's no-block sub-case the fixture sets /CLAUDE.local.md in .git/info/exclude; the test asserts the dry-run plan prints the kept-rule line, and after eject --yes the rule is still present, the kept line is printed, and git status --porcelain lists no CLAUDE.local.md (Decision (k), last sentence).

Suite: Node 22.22.3 `node scripts/test-lock.mjs -- npm test`: 4465/4467 pass, 0 fail, 2 skipped (documented skips). Node 20.20.2 (fnm): 4397/4467 pass, 68 fail, 2 skipped; all 68 reds carry the better-sqlite3 'compiled against a different Node.js version' (NODE_MODULE_VERSION) error, i.e. local environment (shared node_modules built for Node 22); none are e444 tests; CI Node 20 is authoritative.

Checks: npm run build OK, dist unchanged, tree clean. npm audit --audit-level=high: no high/critical (7 vulns: 1 low, 6 moderate). ARTIFACT_EXCLUDE_RULES still four rules (/.current/, /tasks.md, /qa_reports/, /review_reports/). No static lane-paths import in bin/agc-init.mjs (only the pre-existing dynamic dist import in feature start; no added lines). git diff --stat 5f50af1...HEAD touches only bin/agc-init.mjs, docs/install.md, test/e444-*.test.mjs, specs/e444-*.md, .current/e444/**, review_reports/. No other lane's tests or shared generated files touched. node bin/agc-init.mjs check exits 0 (OK 4.22.0); advisories: 37 placeholder home-path hits skipped; 2 comment long-block warnings at bin/agc-init.mjs:2 (8 lines) and :4158 (11 lines), limit 7, advisory only.

