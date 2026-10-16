covers: T-E316-01, T-E283-01, T-E322-01

# QA review — e283-fanout-handoff-and-ref-check (lane e283)

Verdict: PASS for T-E316-01, T-E283-01, T-E322-01.
Tested HEAD: tests commit 43d1338; full suite run on clean HEAD 155ee22 (this evidence commit adds only qa_reports/).
Code review: review_reports/review_T-E283-01.md round 1 APPROVED (covers all three); spec amended in 1cffc6b.

Phase 0.5: skipped (no expected-red manifest declared).
Phase 1 (review of implementation): done by code-reviewer; QA reviewed spec-to-test coverage below.
Phase 1.5: skipped (no Visual Baselines declared); Copy audit: error/note strings asserted by code in tests (see map); Visual Tokens: N/A.
Phase 3a placement: dispatch brief pre-authorized creating the three new test files; no other test file edited.

## Rulings recorded (not re-litigated)
- `--paths -` output differs from the file form only in the source note line; compared HIT lines, summary, exit code (AC-E322-4).
- RANGE_INVALID is STRICTER THAN SPEC: also refuses a side containing `..` or starting/ending with `.` (e.g. `a....b`, `.a...b`). Accepted by reviewer + integrator; pinned in AC-E322-6 test.
- Cut duplicate count = union of regex-matching lines and sections splitSections names `Cut`. Accepted.

## Spec-to-Test Map
| AC | test file :: case |
|---|---|
| AC-E316-1 | test/e316-cut-heading-variants.test.mjs :: "variants are duplicates" (+ variant-before-Cut) |
| AC-E316-2 | same :: "non-variants unchanged" |
| AC-E316-3 | same :: "lone variant is CUT_SECTION_ABSENT" |
| AC-E316-4 | same :: "doc comment names the setext and homoglyph limit" + e296 suite |
| AC-E283-1..10 | test/e283-validate-handoff.test.mjs cases named "AC-E283-N ..." |
| AC-E283-11 | structural invariant test (no non-closed committed manifest gets HANDOFF_*) + ad hoc sweep below + e296/e235b suites |
| AC-E283-12 | ad hoc render comparison below (not resident) |
| AC-E322-1..9 | test/e322-owners.test.mjs cases named "AC-E322-N ..." |

Fixtures are in-test manifests / a temp git repo under os.tmpdir(); no assertion reads growing content of real specs/fanout-*.md; no fixed-sha diff.

Results: e316 6/6, e283 13/13, e322 11/11 pass. Coverage tooling: not measured (node --test without c8); every new branch of the AC list is exercised by name.
Security smoke: absolute-path error never echoes the path (AC-E283-5); RANGE_INVALID on whitespace / leading dash / empty sides; unreadable / non-git inputs exit 2; owners is read-only (hashes + git status unchanged, AC-E322-9).

## AC Execution Log
Phase 3.5 proofs, executed:

- AC-E283-1..10, AC-E322-1..9, AC-E316-1..3: `node --test test/e316-cut-heading-variants.test.mjs test/e283-validate-handoff.test.mjs test/e322-owners.test.mjs` -> 30 tests, all pass (exit 0).
- AC-E316-4 grep: `grep -n -i 'setext' tools/fanout-manifest.ts` hits inside the parseCutSection doc comment (asserted by test); `node --test test/e296-manifest-tier.test.mjs` passes unmodified (inside full suite).
- AC-E283-11: `for f in specs/fanout-*.md; do node scripts/fanout.mjs validate "$f"; ...; done` at HEAD: 22 manifests; exit 0 for all except fanout-wave5.1.md and fanout-wave6.md (exit 2, codes exactly {DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}). Matches the spec table. `node --test test/e296-manifest-tier.test.mjs test/e235b-relative-worktree.test.mjs` pass unmodified (full suite).
- AC-E283-12: base tools/fanout-manifest.ts + scripts/fanout.mjs from dac6069 compiled under $TMPDIR with tsc (only node builtin imports); `render` run on base and HEAD for every dispatchable lane of every specs/fanout-*.md with identical args (`--summary S --reading R1 --reading R2 --primary <p> --base abc1234 --mailbox-root <m>`): 62 comparisons, 0 differences in exit code, stdout, stderr. PASS.
- The only non-test/non-bookkeeping source files changed since dac6069 are tools/fanout-manifest.ts, its dist, and scripts/fanout.mjs (git diff --stat).

## Full suite
`node scripts/test-lock.mjs -- npm test` on clean HEAD 155ee22: tests 3262, pass 3259, fail 0, skipped 3 (all three are pre-existing HISTORY-DEPENDENT skips: commits 121ddc8 x2 and 3c72a83 not resolvable in this worktree history; unrelated to this lane).

## Observations (non-blocking, not QA-FAIL grounds)
- Reviewer follow-ups stand: owners/check exit 1 when git diff fails (no merge base); absolute-path detector boundary blind spots.
- test/e283-validate-handoff.test.mjs is slow (~2 min: many CLI spawns, mostly the 22-manifest invariant and the sub-item matrix); consider trimming in a follow-up.
## 2026-10-16T21:49:15.344Z — PASS — by qa-engineer

PASS. New tests e316 6/6, e283 13/13, e322 11/11. Hard conditions: validate sweep of 22 manifests matches spec table; render byte-identical vs dac6069 build (62/62). Full suite on clean HEAD 155ee22: 3262 tests, 3259 pass, 0 fail, 3 pre-existing history-dependent skips. RANGE_INVALID is stricter than spec (accepted). See qa_reports/review_T-E283-01.md.

