# QA Review — T-E115-03 (final QA gate, E115 join-precondition-check)

covers: T-E115-01, T-E115-02, T-E115-03

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e115-join-precondition-check.txt` manifest declared — `dispatch_mode` is absent/"feature", and code-reviewer's round-2 note already confirms no expected-red manifest is armed for this feature). Zero overhead paid.

## Copy / Visual Audit Gate (Phase 3a/3b)
`specs/e115-join-precondition-check.md`'s Copy/Strings and Visual Tokens H2s are both explicitly `N/A` — internal server/CLI mechanism, no client-visible copy, no visual literals. Grepped the two new source files (`tools/join-precondition.ts`, `scripts/join-precondition.mjs`) for any user-facing string not accounted for by the spec's N/A: only diagnostic/report text exists (`renderJoinPreconditionReport`'s lines, git error passthrough), none of it end-user copy. No drift, no coverage gap.

## Phase 1.5 — Visual Compare
Skipped (no `design/e115-*.md` exists — correctly absent per the no-design backwards-compat rule, confirmed in the spec's Dependencies section).

## Phase 1 — Review
Implementation (`tools/join-precondition.ts`, `scripts/join-precondition.mjs`) already carries an independent code-reviewer verdict: **APPROVED at round 2** (`review_reports/review_T-E115-01.md`, "Round 2 — APPROVED — by code-reviewer"). Round 1 CHANGES_REQUESTED (C1: AC3's original per-row-equality wording fabricated a mismatch on every healthy multi-row Split Table) was resolved by the AC3 amendment (membership semantics) + new AC9 (markdown-decoration stripping), both human-approved per the Amendment History at `specs/e115-join-precondition-check.md:195`. QA re-verified round 2's claims independently by execution below rather than trusting the review doc's word — see AC Execution Log. No additional correctness/architecture findings; per skill-qa-engineer's scope rule, correctness/architecture review is code-reviewer's territory and is not re-litigated here except where Phase 3.5 execution surfaced something (it did not).

## Spec-to-Test Map
Tests authored and EXECUTED (not read-through) in `test/e115-join-precondition.test.mjs`, against a real scratch git repo fixture (`mkGitRepo`, real `git init`/branch/commit/merge) for AC1/AC2, and a real `.current/`-backed scratch workspace (`mkWs` + the real `writeHandoffState`) for AC3/AC4/AC9 — mirroring `test/e116-archive-on-feature-change.test.mjs` (`mkWs`/`writeHandoffState` style) and `test/feature-rollup.test.mjs` (real on-disk fixtures over synthesized objects).

| AC | test case(s) |
|---|---|
| AC1 | "AC1: ancestry check distinguishes merged vs unmerged branches"; "AC1: naming which branch(es) are unmerged — one result per branch, not a single pass/fail bit" |
| AC2 | "AC2: unknown branch degrades to isAncestor:false + populated error, does not throw"; "AC2: bogus repoRoot (not a git repo) also degrades to false+error, does not throw"; "AC2: empty branch list never throws and returns an empty array" |
| AC3 (amended, MEMBERSHIP) | "AC3: actual present in one declared row of a multi-row Split Table -> satisfied, mismatches: []"; "AC3: matching row carrying status:done is still satisfied — no status-column special-casing"; "AC3: actual absent from every declared row -> exactly ONE finding naming the full declared set + actual"; "AC3: five declared rows, none matching, still yields mismatches.length === 1" |
| AC4 | "AC4: missing .current/feature-split.md degrades to compared:false + reason"; "AC4: unrecognizable column (no feature id / active_feature header) degrades honestly"; "AC4: unparseable handoff.md (malformed YAML frontmatter) degrades to compared:false, never throws"; "AC4: parseable handoff with no active_feature recorded degrades honestly" |
| AC5 | "AC5: exported function signatures (emitted .d.ts) take no second workspace-path argument"; "AC5: no read/exec call in tools/join-precondition.ts is parameterized outside repoRoot / repoRoot/.current/**" |
| AC6 | "AC6: exactly one 'HOOK POINT FOR E126' comment exists, and no E126 assertion logic accompanies it" |
| AC7/AC8 | inspection-based (see AC Execution Log below); marker test "AC7/AC8: inspection-only ACs are recorded in qa_reports/review_T-E115-03.md, not asserted here" keeps the AC→test map complete without faking runtime assertions for an inspection proof. |
| AC9 (new) | "AC9: a **feature id** (bold-decorated) header is recognized, not degraded to compared:false"; "AC9: a backtick-quoted declared value normalizes before matching (no false mismatch)"; "AC9: an internal underscore in a feature id round-trips unchanged (only leading/trailing decoration is stripped)"; "AC9: internal underscore mismatch is still correctly reported (strip does not over-normalize into a false match)"; "AC9: a decoration-only cell (e.g. '***') is dropped, never becomes an empty declared member"; "AC9: a Split Table whose ONLY rows are decoration-only cells degrades honestly (compared:false), never an empty-set fabricated verdict" |

## Coverage Gate
`tools/join-precondition.ts`'s two exported checks plus the render function are exercised by all 23 tests; `scripts/join-precondition.mjs` is exercised indirectly via AC7 inspection (no separate CLI-invocation test — the module underneath is what carries the logic, per AC7's own "zero script-level logic" contract). Every branch in `checkLaneAncestry` (clean merge, clean negative, unknown-ref error, ENOENT/bogus-repo error, empty list) and every branch in `checkDeclaredVsActualLaneIdentity` (satisfied-membership, single mismatch, all four degradation paths, all AC9 decoration cases) is covered by an executed test. Tooling to measure a numeric line-coverage % is not wired into this repo's `npm test`; noted explicitly per the Coverage Gate's own escape clause.

## Security Smoke
Boundary inputs covered: empty branch list (AC2 test), nonexistent repoRoot / not-a-git-repo (AC2 test), malformed/empty handoff YAML (AC4 test), decoration-only / effectively-empty declared cells (AC9 tests). No auth/permission surface exists in this module (local build-entry self-check, no access control per spec). `execFileSync`'s argv-array invocation (no shell) was independently confirmed by the code-reviewer (round 1 Q2, round 2 Security section) — not re-probed here since it is inspection-based (AC7/AC8-adjacent, not proof:-annotated) and already executed by the reviewer under model independence.

## AC Execution Log

All ACs in `specs/e115-join-precondition-check.md` carry `proof:` annotations. Each is executed below.

- **AC1** — `node --test test/e115-join-precondition.test.mjs` (full file, see Phase 4 run below), cases "AC1: ancestry check distinguishes merged vs unmerged branches" + "AC1: naming which branch(es) are unmerged...". Both `ok`. Exit code 0. Verdict: **PASS**.
- **AC2** — same run, cases "AC2: unknown branch degrades...", "AC2: bogus repoRoot...", "AC2: empty branch list...". All three `ok`, no thrown exception in any case (`assert.doesNotThrow` wraps each). Verdict: **PASS**.
- **AC3** (amended) — same run, cases "AC3: actual present in one declared row...", "AC3: matching row carrying status:done...", "AC3: actual absent from every declared row -> exactly ONE finding...", "AC3: five declared rows, none matching...". All four `ok`; the "exactly ONE finding" and "mismatches.length === 1" assertions explicitly assert the **count**, not just presence, per the dispatch brief's requirement. Verdict: **PASS**.
- **AC4** — same run, cases "AC4: missing .current/feature-split.md...", "AC4: unrecognizable column...", "AC4: unparseable handoff.md...", "AC4: parseable handoff with no active_feature...". All four `ok`, all assert `compared:false` + non-empty `reason` + empty `mismatches`. Verdict: **PASS**.
- **AC5** — same run, cases "AC5: exported function signatures (emitted .d.ts)..." (regex-matches the three exported declarations off `dist/tools/join-precondition.d.ts` — the authoritative compiled signature surface) and "AC5: no read/exec call... is parameterized outside repoRoot...". Additionally manually re-confirmed by direct read of `dist/tools/join-precondition.d.ts`: `checkLaneAncestry(branches: string[], repoRoot: string)`, `checkDeclaredVsActualLaneIdentity(repoRoot: string)`, `renderJoinPreconditionReport(ancestry, identity)` — no second workspace-path argument on any of the three. Verdict: **PASS**.
- **AC6** — same run, case "AC6: exactly one 'HOOK POINT FOR E126' comment...". Also independently re-ran `grep -c "HOOK POINT FOR E126" tools/join-precondition.ts` = `1`, and `grep -c "HOOK POINT FOR E126" scripts/join-precondition.mjs` = `0`. Verdict: **PASS**.
- **AC7** (inspection) — compared `scripts/join-precondition.mjs` (36 lines: shebang/header comment, one import block, argv parsing, three function calls, one `console.log`) side-by-side against `scripts/feature-rollup.mjs`'s shape: identical pattern (plain Node ESM, argv → function(s) → `console.log`, zero domain logic, imports from `../dist/tools/*.js`). Confirmed executed-and-confirmed (already re-verified by code-reviewer round 2 too). Verdict: **PASS**.
- **AC8** (inspection) — ran `git status --porcelain -- tools/drift.ts tools/lane-registry.ts content scripts/verify-release.mjs docs/backlog.md` in the lane worktree: empty output (see Phase 4 run below for the exact command/output). `git diff --stat <base>..HEAD -- docs/backlog.md` empty — no done-mark moved. Verdict: **PASS**.
- **AC9** (new) — same test run, six cases: bold-decorated header, backtick-quoted declared value, internal-underscore round-trip (positive and negative-match variants), decoration-only cell dropped, all-decoration-only table degrades honestly. All `ok`. Verdict: **PASS**.

## Phase 4 — Run

Full new test file, executed directly:
```
node --test test/e115-join-precondition.test.mjs
# tests 23
# pass 23
# fail 0
```

Forbidden-path check (AC8), executed:
```
git status --porcelain -- tools/drift.ts tools/lane-registry.ts content scripts/verify-release.mjs docs/backlog.md
# (empty)
```

Full regression suite:
```
npm test
# tests 2179
# pass 2179
# fail 0
# cancelled 0
# skipped 0
```

Build:
```
npm run build
# check:version — OK (3.114.0)
# tsc — clean
# check:transitions-sync — OK (21 keys, exact match)
```

CI runnability: `npm test` runs headlessly with zero human interaction (node --test over test/*.test.mjs), confirmed by the run above completing unattended.

## Verdict
**PASS** — code-reviewer APPROVED (round 2) re-confirmed independently by execution; all `proof:`-annotated ACs (AC1–AC9) executed and green; full regression suite (2179/2179) and build both clean; AC8 forbidden-path boundaries clean. Completing T-E115-01, T-E115-02, T-E115-03.
## 2026-09-22T03:52:02.729Z — PASS — by qa-engineer

PASS. test/e115-join-precondition.test.mjs authored + EXECUTED (23/23 pass) against a real scratch git repo fixture (mkGitRepo: real git init/branch/commit/merge --no-ff) for AC1/AC2, and a real .current/-backed scratch workspace (mkWs + real writeHandoffState) for AC3/AC4/AC9, mirroring test/e116-archive-on-feature-change.test.mjs / test/feature-rollup.test.mjs style. AC3 membership semantics verified: matching-row (incl. status:done) -> mismatches:[]; absent-from-all-rows -> mismatches.length===1 asserted by count, naming the full declared set. AC9 verified: bold-decorated header recognized, backtick-decorated value normalizes, internal underscore round-trips unchanged (both matching and non-matching cases), decoration-only cell dropped (not an empty member), all-decoration table degrades honestly. AC5 pinned off dist/tools/join-precondition.d.ts (no second workspace-path arg on any export) plus a source-regex sweep (every read/exec anchored to repoRoot). AC6 grep-c=1 in the module, 0 in the script. AC7/AC8 inspection-confirmed (git status/diff clean on all forbidden paths). Full suite npm test 2179/2179 green; npm run build clean (tsc + check:version + check:transitions-sync). Code-reviewer verdict APPROVED at round 2 (review_reports/review_T-E115-01.md), independently re-confirmed by execution rather than trusted on the handoff's word. Full detail + AC Execution Log in qa_reports/review_T-E115-03.md. Completing T-E115-01/02/03. Known prior-session drift (T-E113-*, T-E116-01/03/04) left unreconciled per dispatch brief.

