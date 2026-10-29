covers: T-E367-01, T-E367-02, T-E367-03

# QA review — e367-evidence-and-feature-path-encoding (round 1)

Implementation commit c2d5abd; code review APPROVED (review_reports/review_T-E367-01.md). Test commit 4f64162.

Phase 0.5: skipped (no expected-red manifest declared)
Phase 1.5: skipped (no Visual Baselines declared)
Copy Audit / Visual Audit: N/A (spec Copy/Strings and Visual Tokens are N/A; no user-facing string or literal introduced)

## Phase 1 — Review

`decodeEvidenceId` in tools/evidence-file.ts matches the spec token table: `[A-Z0-9.-]` literal, `_`+`[A-Z]` lower-case letter, `__`+4 upper-case hex only when the unit is outside `[A-Za-z0-9.-]`, everything else null. Pure, total, no throw. `passEvidenceIdsIn` credits `decodeEvidenceId(m[1]) ?? m[1]`; `covers:` ids are not decoded. No other lane-status change.

## Phase 3 — Spec-to-test map (test/e367-lane-status-decode.test.mjs, temp-dir fixtures only)

| AC | test |
|---|---|
| AC-E367-1 | round-trip over >1000-string corpus (named cases + exhaustive length<=3 over mixed alphabet) |
| AC-E367-2 | ten non-producible stems give null; non-null decode re-encodes to stem; oversized/hostile input never throws |
| AC-E367-3 | non-canonical ids credited at qa_reports/ root and in archive/<feature>/ |
| AC-E367-4 | legacy stem `t-e900-04` falls back to raw stem, still credited |
| AC-E367-5 | canonical id unchanged; FAIL-only encoded file credits nothing |
| AC-E367-6 | source pin: import present, `decodeEvidenceId(m[1]) ?? m[1]`, no bare `ids.add(m[1])` |

Coverage tooling: not measured; the new function is fully branch-exercised by the corpus and stem cases.

## AC Execution Log

| AC | command | result |
|---|---|---|
| AC-E367-1..6 | `node --test --test-name-pattern="AC-E367" test/e367-lane-status-decode.test.mjs` | 6 pass, 0 fail, exit 0 |
| AC-E367-4 (unmodified e177b) | `git diff --stat b2233d5..HEAD -- test/e177b-lane-status.test.mjs` | empty; file green in full suite |
| AC-L1 | `git diff --name-only b2233d5..HEAD -- test/` | only `test/e367-lane-status-decode.test.mjs` |
| AC-L2 | `node scripts/test-lock.mjs -- npm test` on HEAD c30c27d, clean tree | 3757 tests, 3754 pass, 1 fail, 2 skipped (see below) |
| AC-L3 | `npm run build` then `git status --porcelain dist/` | empty |
| AC-L4 | `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w12.md e367 specs/e367-evidence-and-feature-path-encoding.md` | exit 0, 3 tickets, 0 out of bounds |
| AC-L5 | `git diff --stat b2233d5..HEAD -- gates schema tools/storage.ts tools/storage-sqlite.ts tools/handoff-write.ts tools/handoff-orchestrator.ts tools/handoff-parse.ts tools/handoff-types.ts tools/handoff.ts` | empty |
| audit | `npm audit --audit-level=high` | exit 0 (1 low, 6 moderate, none high) |

### The one red in the full suite

`test/verify-release.test.mjs` VR-22 (E80) failed with "wait=0 must not incur any wall-clock poll sleep; took 5220ms". This is a wall-clock budget assertion; other lanes' suites were running concurrently on the same machine (loaded host). The file is unrelated to this lane (no diff touches release verification). Re-run alone: `node --test test/verify-release.test.mjs` gives 63 pass, 0 fail. Classified as a load-induced timing flake, not a regression; nothing re-baselined.

## Verdict

PASS for T-E367-01, T-E367-02, T-E367-03.
## 2026-10-29T08:03:23.474Z — PASS — by qa-engineer

PASS round 1: AC-E367-1..6 covered by test/e367-lane-status-decode.test.mjs (6/6); AC-L1..L5 verified on HEAD c30c27d. Full suite 3754/3757 pass, 2 skipped, 1 red = verify-release VR-22 wall-clock flake under host load (unrelated; passes 63/63 in isolation). See qa_reports/review_T-E367-01.md.

