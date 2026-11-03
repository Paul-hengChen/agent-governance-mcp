# QA review — T-E394-01..T-E394-16 (E394 release SOP rewrite, dispatch D)

covers: T-E394-01, T-E394-02, T-E394-03, T-E394-04, T-E394-05, T-E394-06, T-E394-07, T-E394-08, T-E394-09, T-E394-10, T-E394-11, T-E394-12, T-E394-13, T-E394-14, T-E394-15, T-E394-16

Verified on HEAD 1935cea (base 89e01c6), clean tree (`git status --porcelain` empty) before the full suite.

Phase 1.5: skipped (no Visual Baselines declared). Phase 3: skipped (no new test file authorised or needed; hard conditions verified by command).

## Expected-Red Diff

Phase 0.5: clean (0/0 manifest entries; manifest `qa_reports/expected-red_e394-release-sop-rewrite.txt` is header-only, window closed at 40a3cac; 0 unexplained reds in the full suite: 0 fail).

## AC Execution Log

| id | command | output | verdict |
|---|---|---|---|
| H1 tests | `git diff --stat 89e01c6 -- test/check-version.test.mjs test/e299-check-bookkeeping.test.mjs test/e320-ci-check-sha.test.mjs test/e326-empty-branch-run-poll.test.mjs test/e158-range-subject.test.mjs` | empty | pass |
| H1 scripts | `git diff --stat 89e01c6..HEAD -- scripts/verify-release.mjs scripts/check-version.mjs scripts/check-bookkeeping.mjs` | empty (byte-unchanged) | pass |
| H1 CLI | `node scripts/verify-release.mjs --help` | `check:release — invalid target version "--help" (expected vX.Y.Z)` (usage path, unchanged); verify-release tests green in suite | pass |
| H2 | `grep -nE "from \"\./|from '\./|import\(\"\./" scripts/verify-release.mjs scripts/check-version.mjs scripts/check-bookkeeping.mjs` | no output, exit 1 | pass |
| H3 | `npm run -s check:version; npm run -s check:bookkeeping` | `check:version — OK (4.17.0)` exit=0; `check:bookkeeping — OK (442 ticket row(s), 230 queue row(s), 366 decision row(s) checked)` exit=0 | pass |
| H4 | `npm run build` then `git status --porcelain dist/` and `git diff --stat 89e01c6 -- dist/` | build OK; both empty | pass |
| H5 | `wc -c < content/skill-release-engineer.md` | 14434 (<= 15000); frontmatter line 2 `recommended_model: opus`; no hunk touches it | pass |
| H6 | `node --test test/e391-prompt-audit-stale-facts.test.mjs`; grep of the SOP | `` `gates/registry.ts` (`GATE_REGISTRY`) `` occurs once; no gate-count phrase; test green (with H8: 33/33 pass, 0 fail) | pass |
| H7 | `git diff --name-only 89e01c6..HEAD`; `node scripts/fanout.mjs check --cut specs/fanout-e392-e394.md e394 specs/e394-release-sop-rewrite.md` | 25 paths, all in the 擁有 cell or lane bookkeeping; `16 ticket(s), 26 token(s), 0 out of bounds`; exit=0 read directly; no path under templates/**, prompts/**, tools/**, gates/**, package.json, CLAUDE.md, test/subagent-templates.test.mjs, test/fixtures/compose-golden/**, test/context-budget.test.mjs | pass |
| H8 | `node --test test/subagent-templates.test.mjs` | pass (see H6 line, 0 fail) | pass |
| T1 | `git diff --name-only 89e01c6..HEAD -- test/` | 13 test files, every one in the Test Re-pin Map / owned set (e130, e164-e167, e166, e18, e297, e336, e394-release-script, e394-release-sop, feature-lease, qa-flow, release-staging, render-structure, verify-release); re-pins by T-E394-12/13/14, reviewed in qa dispatches B and C | pass |
| T2 | `node scripts/test-lock.mjs -- npm test` | tests 3946, pass 3944, fail 0, cancelled 0, skipped 2; exit=0 | pass |
| Constitution §6 | `npm audit --audit-level=high` | exit 0 (moderate-only advisories in @hono/node-server and esbuild; none high) | pass |
| md tables | `npm run check:md-tables` | OK (697 file(s) scanned, 0 malformed tables) | pass |

Other proof:-annotated ACs (S1..S9, P1..P10, H-class, AL-1 meta over 69 ids) are executed by `test/e394-release-script.test.mjs` and `test/e394-release-sop.test.mjs` inside the full suite above (green).

## History

- Round 1 (dispatch A 2932dad): FAIL on T-E394-02 (R3, README pin substring match `#v1.2.1` vs `#v1.2.10`), see `qa_reports/review_T-E394-02.md`.
- sr fix b387c9e + 01b102d; code-reviewer re-review APPROVED (Round 2, 50e7a2b).
- Dispatch B 6204ce0 (T-E394-12 release-staging re-pin); dispatch C 40a3cac + 5c50b30 (T-E394-13, T-E394-14; expected-red window closed); dispatch D (this): hard conditions and final suite.

## Verdict

PASS. All of H1-H8, T1, T2 hold; suite 3944/3946, 0 fail, 2 skipped.
