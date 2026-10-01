covers: T-REL440-01, T-REL440-02, T-REL440-03

# QA review: release-v4.4.0 (AC1-AC7), HEAD 80073bf + uncommitted PM spec/state files

Phase 0.5: skipped (no expected-red manifest declared). Phase 1/3a/3b/1.5: N/A (evidence-only gate; spec Copy/Visual tables are N/A, no design file). Phase 3: skipped (verification-only gate, no test file created or edited, per dispatch brief).

## AC1 (T-REL440-01) PASS
- `git diff --name-only v4.3.0..HEAD -- package.json 'tsconfig*' .github content` prints only `content/skill-integrator.md`.
- Non-bookkeeping paths (excluding .current, qa_reports, review_reports) are exactly: bin/agc-init.mjs, content/skill-integrator.md, docs/{backlog,config,install,lane-protocol,v4.0.0-new-tickets}.md, specs/{e246,e259 x2,fanout-e246-e259}, tasks.md, test/e246-*, test/e259-* (+lib, 15 fixtures), test/e258b-comment-scan.test.mjs, tools/comment-*.ts (10), dist/tools/comment-* (40 files). No package.json/tsconfig/.github.
- 36 commits since v4.3.0, all attributable to E246, E259, fan-out plan, or bookkeeping.

## AC2 (T-REL440-01) PASS
- review_reports/review_T-E246-01, -E246-02, -E259-01: "Verdict: APPROVED".
- qa_reports/review_T-E246-01..02 and T-E259-01..09 exist and record PASS.
- `.current/history/2026-09/e246|e259/handoff.md`: status "PASS", last_agent "qa-engineer".
- Noted, not failed: e246 lane `completed_tasks` empty though T-E246-01/02 have PASS evidence (E150 class). e246 send-back (24-line test header; 24e332f, dd6c119) noted.

## AC3 (T-REL440-02) PASS
`node scripts/test-lock.mjs -- npm test` exit 0: tests 3043, pass 3040, fail 0, skipped 3 (matches expected tally).

## AC4 (T-REL440-02) PASS
`npm run build` exit 0; `git status --porcelain dist/` empty; `node scripts/check-version.mjs` exit 0 (4.3.0 parity OK, past-tag note expected).

## AC5 (T-REL440-03) PASS
Temp files in repo root, removed afterwards. Clean tree: no `agc check — comments` line, exit 0. With 8-line `#` .py and 8-line `//` .rs: one line each (`qa_tmp_a.py:1 long-block 8 lines (limit 7)`, `qa_tmp_a.rs:1 ...`), exit 0 (unchanged). 7-line .rs block: no warn. 9-line `#` block in .yml and .json: skipped. Summary line names scanned extensions (.bash...zsh, 26). Afterwards `git status --porcelain` shows only pre-existing .current/_primary state files (telemetry.jsonl touched by tool use) and specs/release-v4.4.0.md; no temp files remain. Tests: e259 brace/hash/limits + e258b: pass, 0 fail.

## AC6 (T-REL440-03) PASS
`node --test test/e246-mailbox-teardown.test.mjs test/e178a-integrator-role.test.mjs` and the AC5/AC7 set: combined 157 tests, 156 pass, 0 fail, 1 skipped (pre-existing). docs/install.md:198 and content/skill-integrator.md:161 describe removal, keep+warning, no-mailbox silence, exit code unchanged.

## AC7 (T-REL440-03) PASS
Compose goldens contain `Comment discipline` (1 each; skill-coordinator-monolith 0, which is not a constitution golden). context-budget and e258a-comment-rule pass. e234-hygiene-scan, e250-eject-path-escape and e251 tests: 32/32 pass. `git tag -l v4.3.0` = v4.3.0; `v4.3.0^{commit}` = 71afb53; CHANGELOG.md line 19 `## [4.3.0] - 2026-09-30`.

## AC Execution Log
No `proof:`-annotated AC in the sense of a command-only gate was skipped: every AC proof listed in specs/release-v4.4.0.md was executed; commands and outputs are recorded in the sections above (AC1 diff/log, AC2 greps, AC3 suite, AC4 build/check-version, AC5 scratch run, AC6/AC7 targeted tests and greps).

## Verdict: PASS (AC1-AC7 all hold). Release bookkeeping (bump, CHANGELOG, stamps, tag) left to release-engineer.
## 2026-10-01T02:51:40.341Z — PASS — by qa-engineer

PASS AC1-AC7. Diff scope = E246+E259+bookkeeping only (no package.json/tsconfig/.github; only content/skill-integrator.md under content/). Lane evidence APPROVED/PASS, lane handoffs PASS (e246 empty completed_tasks quirk noted). npm test 3043 total / 3040 pass / 0 fail / 3 skipped. dist rebuild clean, check-version OK. Scan spot-check: 8-line py/rs warn, 7-line/yml/json do not, exit unchanged, temp files removed. E246 mailbox teardown tests + docs OK. v4.3.0 non-regression OK (tag 71afb53, CHANGELOG [4.3.0], Comment discipline goldens, E234/E250/E251). Evidence: qa_reports/review_T-REL440-01.md.

