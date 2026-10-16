covers: T-E296-01, T-E296-02, T-E296-03, T-E296-04, T-E296-05, T-E296-06

# QA review — E296 manifest tier / cut-approval (lane e296)

Feature `e296-manifest-tier-cut-approval`; spec `specs/e296-manifest-tier-cut-approval.md` AC1-AC15; base `c392cc3`; code review APPROVED (`review_reports/review_T-E296-01.md`, Round 5). Final HEAD for the gates below: `1b3234a` (tests commit; this report is committed after it, docs only).

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared; no design file). Copy audit: the Copy / Strings literals (audit line, `manifest-tier: ...` lines, usage line, `8- or 9-column`, codes) are verified verbatim by the AC Execution Log and by the new test file; no unsourced user-facing string was found.

## AC → test map (T-E296-05)

| AC | test |
|---|---|
| AC1-AC6, AC14 | `test/e296-manifest-tier.test.mjs` content tests (proof greps in-process) |
| AC7 | same file (five inputs, plus "key without manifest still arms the threshold tier"); `test/e5-intake-tiering.test.mjs` defaults deepEqual re-pinned with `manifest: false` (two places) |
| AC8 | same file |
| AC9 | same file: validate sweep (only wave5.1, wave6 exit 2), 9-column dispatchable, `APPROVAL_VALUE_UNKNOWN`, wrong 9th header stays provisional, 8-column exact, short row error, `LANE_PROVISIONAL` text "8- or 9-column" |
| AC10 | same file: both sha256s, plus 9-column render == 8-column render |
| AC11 | same file: in bounds, OUT line, glob byte-identical, `approval: human`, no 人類 row, manifest Decisions error exit 2, every spec-side code, `SPEC_UNREADABLE`, read-only |
| AC12 | same file: usage fourth line, wrapper header, `check <manifest> <lane>` unchanged |
| AC13 | goldens regenerated, four ceilings re-measured (below), full suite on final HEAD |
| AC14 | same file; re-pins in `test/e178a-integrator-role.test.mjs` (frontmatter regex) and `test/e297-main-protected-sop.test.mjs` (:104 `recommended_model`; `MODEL_TIERS` deepEqual untouched) |
| AC15 | same file: every C4, C5, R1 enumerated input, the rounds 1-3 attack inputs, the bare-CR and CRLF cases, the documented behaviour changes, the controls; own spec pinned as "no format error, only the known e297 OUT line" |

Note: the `LANE_PROVISIONAL` text was not asserted with its count anywhere before; the e177a tests only match the code prefix, so the "8- or 9-column" pin is new (in the new file). `.current/e296/tasks.md` lists T-E296-05 with depends_on T-E296-01..04 only; the spec `## Cut` (which adds T-E296-06) is authoritative; tasks.md was not hand-edited.

## Budget ceilings (R1, human-approved, zero headroom)

| ceiling | old | new (measured on HEAD) |
|---|---|---|
| skill-pm | 4401 | 4708 |
| design-arm constitution | 10226 | 10518 |
| coordinator bundle | 21138 | 21623 |
| non-design constitution | 8129 | 8420 |

Assertion messages now name the E296 manifest-tier cut-approval lane re-baseline.

## Goldens

`node scripts/capture-constitution-golden.mjs` after `npm run build`. 7 of 12 fixtures changed (13 insertions, 7 deletions): `build-full-design.txt`, `build-full-design-fd.txt`, `build-full-nondesign.txt`, `build-full-nondesign-fd.txt`, `constitution-monolith.txt`, `hook-full.txt`, `skill-coordinator-monolith.txt`. Every hunk is the const-08 Cut-Approval Auto-Tier bullet edit plus the new Manifest tier sub-bullet (with the origin tag in the `fd` variants), or the coord-03 Auto-tier writer action line. No skill-pm or skill-integrator text lives in a golden. The five lite goldens and `hook-lite.txt` are unchanged. `test/compose-equivalence.test.mjs` and `test/skill-manifest.test.mjs` pass without being edited.

## AC Execution Log

Run on the lane worktree at `1b3234a`, each proof verbatim ($TMPDIR for temp files).

| AC | output | verdict |
|---|---|---|
| AC1 | `1` then `2` | pass |
| AC2 | `1` then `1` | pass |
| AC3 | `1` then `1` | pass |
| AC4 | `1`, `1`, `1` | pass |
| AC5 | `1` | pass |
| AC6 | `1`, `0`, `1` | pass |
| AC7 | `true,false,false,false,false` | pass |
| AC8 | `1` | pass |
| AC9 | `2`; non-zero lines `specs/fanout-wave5.1.md 2`, `specs/fanout-wave6.md 2` | pass |
| AC10 | `045b56ae749b459a808b16e13ac00e273721cd888e9932e9222f2762a780128a`; `485eabe00700945a3060b04149b59694957061983582519584051f2118b2f863` | pass |
| AC11 (own spec) | `exit=1` (spec text says 0) — the one OUT line is `test/e297-main-protected-sop.test.mjs`, the known manifest-version gap (this branch's manifest copy lacks it in the e296 owned set, brief says not to depend on it); removing that token gives exit 0 (pinned in the new test) | pass with the known gap, not a defect |
| AC11 (oob) | `1` then `exit=1` | pass |
| AC12 | `1` | pass |
| AC13 | `node scripts/test-lock.mjs -- npm test` on clean tree at `1b3234a`: tests 3163, pass 3160, fail 0, cancelled 0, skipped 3 | pass |
| AC14 | `recommended_model: opus`, `0` | pass |
| AC15 section | `exit=2`, count `1` | pass |
| AC15 cell | `exit=2`, count `1` | pass |
| AC15 own spec | `1` (the e297 OUT line only) | pass |

## Gates

- `npm run build`: 0 errors, `git status` clean afterwards (dist not drifting).
- `npm audit --audit-level=high`: exit 0 (only a moderate advisory present).
- `npm run -s check:md-tables`: OK, 541 files, 0 malformed.
- Full suite: 3163 / 3160 pass / 0 fail / 3 skipped (the 15 previously red qa-owned tests are now green: 4 ceilings, 6 compose / manifest goldens, e5 defaults x2, e178a, e297, skill-manifest golden).

## Phase 3 notes

Test-file placement: new `test/e296-manifest-tier.test.mjs` (pre-authorized in the dispatch brief), plus the listed existing files only. Coverage measurement was not run with a tool; every changed code path (`parseCutSection`, cell grammar, approval column, config parse, usage routing) is exercised by at least one executed case above. Crash checkpoint write skipped on purpose: `.current/e296/handoff.md` is tracked and the clean-tree rule applies to the suite run; the run was synchronous in one turn.

## Verdict

PASS for T-E296-01, T-E296-02, T-E296-03, T-E296-04, T-E296-05, T-E296-06. No findings filed.
## 2026-10-15T10:05:36.683Z — PASS — by qa-engineer

QA PASS for T-E296-01..06. AC1-AC15 executed (AC Execution Log in qa_reports/review_T-E296-01.md, covers all six ids). Full suite on clean tree at 1b3234a via test-lock: 3163 tests, 3160 pass, 0 fail, 3 skipped; build clean (dist unchanged), npm audit --audit-level=high exit 0, check:md-tables OK. New test/e296-manifest-tier.test.mjs (35 tests) pins AC1-AC12, AC14, AC15 (all C4/C5/R1 inputs, rounds 1-3 attacks, bare-CR/CRLF, behaviour changes). Goldens regenerated (7 of 12, const-08/coord-03 text only). Ceilings re-measured to exact values.

