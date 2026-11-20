# QA review — T-E431-11 (final verification, qa round 1 of 3)

covers: T-E431-01, T-E431-02, T-E431-03, T-E431-04, T-E431-05, T-E431-06, T-E431-11

T-E431-07..10 were completed earlier. Code review: `review_reports/review_T-E431-01.md` (T-01..06) and `review_reports/review_T-E431-04.md` (docs fix 23f8a0e, APPROVED).

## Test changes this round (commit 17a8f0a)
- `test/e295-hop-cap-and-sop-halves.test.mjs` AC11 (`(none)` assertion): now exactly one `(none)` row, and it is `SR_RETURN_CAP_EXCEEDED`. Made under human ruling 5a (2026-11-20).
- `test/visual-evidence-gate.test.mjs` AC-4: `allowed:` pin matches `allowedSuccessors("pm:In_Progress"`. Made under human ruling 6a (2026-11-20).
- `test/skill-evolution-v3.11.test.mjs` :75/:80 was re-pinned earlier under human ruling 1a.
- `test/e431-test-first-server-path.test.mjs`: new `AC11:` test. A feature-change write out of marked `code-reviewer:PASS` that carries `chain_path` ignores the old marker: pm opens the new feature and marks it by its own write; researcher, release-engineer and design-auditor are rejected `TRANSITION_REJECTED` with no state written.

## Expected-Red Diff
Phase 0.5: clean. The full suite has 0 reds, so every manifest entry in `qa_reports/expected-red_e431-test-first-server-path.txt` is confirmed green (re-pinned) and there are 0 unexplained reds.

## AC Execution Log
| AC | command | observed | verdict |
|---|---|---|---|
| AC1 | `node --test test/e431-*.test.mjs --test-name-pattern "AC1:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC2 | `node --test test/e431-*.test.mjs --test-name-pattern "AC2:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC3 | `node --test test/e431-*.test.mjs --test-name-pattern "AC3:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC4 | `node --test test/e431-*.test.mjs --test-name-pattern "AC4:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC5 | `node --test test/e431-*.test.mjs --test-name-pattern "AC5:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC6 | `node --test test/e431-*.test.mjs --test-name-pattern "AC6:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC7 | `node --test test/e431-*.test.mjs --test-name-pattern "AC7:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC8 | `node --test test/e431-*.test.mjs --test-name-pattern "AC8:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC9 | `node --test test/e431-*.test.mjs --test-name-pattern "AC9:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC10 | `node --test test/e431-*.test.mjs --test-name-pattern "AC10:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC11 | `node --test test/e431-*.test.mjs --test-name-pattern "AC11:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC12 | `node --test test/e431-*.test.mjs --test-name-pattern "AC12:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC13 | `node --test test/e431-*.test.mjs --test-name-pattern "AC13:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC14 | `node --test test/e431-*.test.mjs --test-name-pattern "AC14:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC15 | `node --test test/e431-*.test.mjs --test-name-pattern "AC15:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC16 | `node --test test/e431-*.test.mjs --test-name-pattern "AC16:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC17 | `node --test test/e431-*.test.mjs --test-name-pattern "AC17:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC18 | `node --test test/e431-*.test.mjs --test-name-pattern "AC18:"` | exit 0, 39 pass / 0 fail (file-level tally) | pass |
| AC19 | `node --test test/e436-stale-handoff-paths.test.mjs test/e395-claude-md-tail.test.mjs test/error-code-contract.test.mjs` | 37 pass / 0 fail | pass |
| AC20 | `node scripts/test-lock.mjs -- npm test; npm audit --audit-level=high; echo "exit=$?"` | suite exit 0, `# tests 4430 / pass 4428 / fail 0 / skipped 2`; audit exit 0 | pass |

## Suite and checks
- suite-result: 4428/4430 passed, 2 skipped (the 2 known skips), 0 fail. Command: `node scripts/test-lock.mjs -- npm test`.
- `npm run build`: OK, `check:transitions-sync` OK (21 keys); `git status --porcelain` empty afterwards (no `dist/` diff).
- `dist/` diff vs 0efc203: only `dist/tools/{transitions,handoff-orchestrator,tasks,handoff-types,handoff-parse,handoff-write,registry}.*`, `dist/gates/registry.*`, `dist/schema/{migrations-handoff,versions}.*`.
- `npm audit --audit-level=high`: exit 0.
- `wc -l CLAUDE.md`: 250.
- `npm run check:bookkeeping`: exit 0.
- Scope vs 0efc203: spec Cut touches, the re-pinned tests, `.current/e431/`, `qa_reports/`, `review_reports/`, `specs/e431-*`. Also `docs/schema-versions.md` (the v16 row the schema-version procedure requires; added in T-E431-06 docs commit 993b77f, not listed in the Cut `files`; harmless doc, noted).

## Verdict
PASS. No source defect found.
## 2026-11-20T07:51:45.483Z — PASS — by qa-engineer

suite-result: 4428/4430 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

T-E431-11 final verification PASS. Suite 4428/4430 (2 known skips), AC1-AC20 proofs green, dist/audit/scope/CLAUDE.md/bookkeeping clean. e295 AC11 and visual-evidence-gate AC-4 re-pinned under human rulings 5a/6a (skill-evolution :75/:80 under 1a); new AC11 chain_path guard test added. See qa_reports/review_T-E431-11.md.

