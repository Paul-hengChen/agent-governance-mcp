# Review — T-E44-02 (T-E44-01 + T-E49-01 + T-E4X-03)

covers: T-E44-02, T-E44-01, T-E49-01, T-E4X-03

## Summary

- Feature `e44-e49-release-sop-conditional-checks`, mini-chain (backlog rows
  `docs/backlog.md:161,172` ARE the spec; PM/architect skipped). One file
  changed by sr-engineer: `content/skill-release-engineer.md` (+25/-6,
  content-only). Code-reviewer APPROVED after 3 rounds
  (`review_reports/review_T-E4X-03.md`).
- QA's job per the review's own "Test-coverage note for T-E44-02" (round 1
  items 1-6, round 2's item-5 amendment, round 3's FINAL item-5/5a-5f/7
  restatement): the pre-existing pins were blind — `:167-187` asserted only
  substring presence, and `:302-350`'s fixtures exercised a hardcoded
  `simulatePostCommitCheck` at `:84-90` with zero coupling to file content.
  Fixed that: `simulatePostCommitCheck` now takes
  `(diffNames, activeFeature, specExistsInTree, scopeDecisionWhy)` and returns
  a branch label; a new `deriveCodesFromWorkingTree` models the shipped step-7a
  pipeline byte-for-byte and is exercised against the real release shapes
  (v3.91.0-v3.95.0) the review's three rounds backtested.
- No `specs/<active_feature>.md` exists (mini-chain, confirmed by `ls`) and no
  `design/` directory exists in this repo at all — Phase 0.5, 1.5, 3.5, and the
  3a/3b Copy/Visual Audit Gates all skip cleanly (absent-artifact branches).
- **Verdict: PASS.** Gates green: build 0 errors, `npm test` 1657/1657 (was
  1641/1641 — +16 new tests, all in `test/release-staging.test.mjs`), `npm
  audit --audit-level=high` unchanged at 11 pre-existing findings (0 new).
  `content/skill-release-engineer.md` untouched by this session (verified via
  `git status --short` before and after — only `test/release-staging.test.mjs`
  and state-bookkeeping files changed).

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e44-e49-release-sop-conditional-checks.txt`
manifest declared — confirmed via `ls qa_reports/expected-red_e44*`, no match).

## Phase 1 — Review

Correctness/architecture/security/quality review of the SOP-text diff itself
was already carried out exhaustively by code-reviewer across three rounds
(`review_reports/review_T-E4X-03.md`) and is APPROVED — that is code-reviewer's
scope, not QA's (constitution §3 role split: QA rejects only for failing
tests, missing coverage, or test-infra defects). I independently re-verified
the load-bearing claims that this session's coverage work depends on, rather
than trusting the review doc at face value:

- **Boundary claim**: `git status --short` before any edit showed only
  `content/skill-release-engineer.md` modified (plus the pre-existing staged
  `T-E49-02` rename and unrelated `.current/` bookkeeping). Confirmed
  untouched by anything in this session.
- **REQUIRE STOP string byte-identity (F5)**: extracted the string from the
  live file and compared against the pre-E44 wording quoted in the review —
  identical; used as a shared constant (`AC4_REQUIRE_STOP`) in the new tests.
- **UNCLASSIFIABLE string with F6 remedy clause**: extracted verbatim from
  `content/skill-release-engineer.md:88` and diffed byte-for-byte against a
  hardcoded copy in the test file (`node -e` check, see AC Execution notes
  below) — identical, including the em dash and trailing period.
- **Step 7a shipped pipeline (F1→F7→APPROVED lineage)**: read `:53-76` fresh
  (not from the review doc's quoted excerpts, which are from earlier rounds
  for F1/F2/F3) to confirm what actually shipped: working-tree enumeration
  (`find qa_reports -maxdepth 1 -type f | sort`) piped through a `PREV_TAG`
  membership predicate (`grep -vxFf <(git ls-tree ...)`) — the round-3
  APPROVED text, not round 1's slug-hunting or round 2's `--diff-filter=A`
  committed-history-only text (both confirmed absent as *executable* pipeline
  content — see the "EXECUTABLE derivation fence" test below, which
  distinguishes prose mentions of the discarded rules from the live pipeline).
- **Step order (F2 regression class)**: confirmed 7a's header text
  (`7a. **Archive shipped feature's qa_reports**`) precedes step 8's
  (`8. **Commit + tag + push**`) by string index, and that 7a's own section
  text contains no reference to the release commit's own diff/content
  (`git diff HEAD~1`, `git show HEAD`) — those only appear later, inside step
  8's AC4 bullet, which is correct (AC4 needs the just-made commit; 7a must
  not).

No new correctness findings beyond what code-reviewer already dispositioned.

## Phase 1.5 — Visual Compare

Skipped (no `design/` directory exists in this repo at all).

## Phase 3a / 3b — Copy / Visual Audit Gates

Skipped (no `specs/e44-e49-release-sop-conditional-checks.md` exists — mini-
chain, backlog rows are the spec, consistent with the E35-E38/E45/E46
precedent the handoff's `scope_decision_why` cites).

## Phase 3 — Tests

### Spec-to-Test map (backlog rows as spec, `docs/backlog.md:161,172,191`)

| AC / requirement | Test(s) |
|---|---|
| E44 AC4 REQUIRE branch — spec-in-tree, hard STOP, byte-identical pre-E44 wording | `Fixture C`, `Fixture D`, `Fixture H`, `AC4 (E44): ... three named branches` |
| E44 AC4 SKIP branch — no spec in tree + mini-chain `scope_decision_why` | `Fixture E`, exhaustiveness test |
| E44 AC4 UNCLASSIFIABLE branch — no spec in tree, empty or non-mini-chain `scope_decision_why`, F6 remedy clause | `Fixture F`, `Fixture G`, `AC4 (E44): ...` string pin |
| E44 AC4 branch exhaustiveness (4 combos → exactly 1 branch each, REQUIRE wins over SKIP) | `AC4 branch exhaustiveness`, `Fixture H` |
| E49 step 7a shipped-pipeline literal pin (not round 1/round 2 drafts) | `E49 step 7a: skill text pins ...`, `E49 step 7a: the EXECUTABLE derivation fence ...` |
| E49 step 7a F7 regression (untracked-at-root evidence, the highest-value pin) | `E49 step 7a (F7 regression ...): v3.93.0 shape`, `... v3.94.0 shape` |
| E49 step 7a committed-in-range case (v3.95.0, the motivating release) | `E49 step 7a: committed-in-range case still works ...` |
| E49 step 7a non-retroactivity | `E49 step 7a: non-retroactivity ...` |
| E49 step 7a F4 (bare-code prose mention ≠ evidence file) | `E49 step 7a (F4 negative fixture) ...` |
| E49 step 7a already-archived evidence never re-enters | `E49 step 7a: already-archived evidence never re-enters ...` |
| E49 step 7a N2 (no-`T-<CODE>-`-prefix filenames don't corrupt the set) | `E49 step 7a (N2): ...` |
| E49 step 7a N4 (empty-baseline hazard, recorded not fixed) | `E49 step 7a (N4, non-blocking hazard ...` |
| E49/E44 step order + F2 regression guard | `E49/E44 step-order pin: ...` |
| Pre-existing AC1/AC2/AC3/AC5/C13/D10/E7 pins | unmodified, all still green |

### Coverage gate

New/modified file: `test/release-staging.test.mjs` (+~360 lines: 1 rewritten
helper function pair, 1 rewritten test, 2 retargeted fixtures, 12 new tests).
Every new line is executable test/fixture logic exercised by the run below;
no untested branches introduced (`deriveCodesFromWorkingTree` and
`simulatePostCommitCheck` are both fully branch-covered by the fixtures — see
the coverage table above). Line-coverage tooling (`c8`/`nyc`) is not wired
into this repo's `npm test`; noting explicitly per SOP 6c.

### Security smoke tests

Not applicable — this is SOP-prose content and test-infrastructure only, no
new auth/permission surface or user input handling introduced.

## Phase 3.5 — AC Execution Log

Skipped (no `specs/<active_feature>.md` exists, therefore no `proof:`-
annotated ACs to execute).

## Phase 4 — Run

- `npm run build` → **0 errors** (`tsc`; `check:version — OK (3.95.0)`).
- `npm test` → **1657 pass / 0 fail** (was 1641/0 at PASS-baseline; +16 new
  tests, all in `test/release-staging.test.mjs`, confirmed via
  `node --test test/release-staging.test.mjs` in isolation: 41/41 pass, up
  from 25 pre-existing).
- `npm audit --audit-level=high` → **11 findings, unchanged** (2 low, 4
  moderate, 5 high — `ip-address`, `js-yaml`, `protobufjs`, `sharp`/
  `@xenova/transformers`; all pre-existing, none newly introduced by this
  diff, none touch this diff's dependency surface).
- Adversarial check that the new pins have teeth (not just green-by-
  construction): reproduced the discarded round-2 committed-history-only
  derivation logic in a scratch Node script and confirmed it returns `[]` for
  the v3.93.0 shape where the shipped rule returns `["E36"]` — the F7
  regression pin would have failed against the pre-round-3 text.

## Findings — non-blocking (per dispatch brief, N3/N4/N5/N6 are NOT this
## ticket's to fix; recording my own read below, not just relaying the brief)

- **N3** (step 7a scans only `qa_reports/`, so `review_reports/` evidence,
  including this feature's own `review_T-E4X-03.md`, is never archived):
  pre-existing, not a regression — the old single-`<CODE>` rule didn't archive
  `review_reports/` either. **Not blocking.** Backlog candidate.
- **N4** (`grep -vxFf` with an empty pattern file passes everything through —
  reachable on a first-ever release with no tags, or a repo that adopted agc
  mid-life): confirmed absent as a guard in the shipped text
  (`grep -n "route to human\|membership baseline" content/skill-release-engineer.md`
  finds nothing). I added a test (`E49 step 7a (N4, non-blocking hazard...`)
  that pins the *current permissive behavior* explicitly, per the reviewer's
  own instruction, so the hazard is recorded in the suite rather than only in
  a review doc. Unreachable on this repo's next release (tags are dense,
  `qa_reports/` has existed across many of them). **Not blocking** — non-
  destructive (`mv -n`), reversible, and out of this cut's pinned scope.
- **N5** (`<(...)` process substitution is bash/zsh-only, fails loudly under
  `sh -c`): loud failure is the safe direction. **Not blocking.**
- **N6** (the `<!-- origin -->`/`<!-- rationale -->` strip applies on the
  `prompts/build.ts` render path but not on `tools/role.ts`'s
  `tw_switch_role` path): I can personally corroborate this from THIS
  session — the qa-engineer SOP text delivered to me via `tw_switch_role`
  earlier in this session arrived with raw `<!-- origin:start --> (v3.58.0,
  C15)<!-- origin:end -->`-style comment markers still embedded, exactly the
  symptom the reviewer describes for `code-reviewer`'s SOP. Confirmed
  pre-existing and repo-wide (not introduced by this diff — this diff added
  no new render-path code at all, being content-only). **Not blocking.**
  Backlog candidate alongside N3.

None of N3-N6 meet the bar for a QA FAIL (failing tests / missing required
coverage / test-infra defect) or for escalation as a contract defect — they
are implementation-scope gaps the reviewer already correctly dispositioned as
non-blocking, and my own inspection agrees with that call.

## Verdict

**PASS.**

- All required AC4 (E44) branches (REQUIRE/SKIP/UNCLASSIFIABLE) and all
  required step-7a (E49) derivation shapes (F7 regression, committed-in-range,
  non-retroactivity, F4, already-archived, N2, N4) are now pinned against the
  ACTUALLY SHIPPED file content, replacing the previously blind substring-only
  and hardcoded-fixture coverage.
- Existing `skill-release-engineer` pins (AC1/AC2/AC3/AC5, C13, D10, E7) stay
  green, unmodified where still correct; only the three AC4 sites named in the
  dispatch brief (`:80` doc comment, `:169-183` SOP-text pins, `:320`
  exact-wording case) were retargeted, as instructed.
- Full gate run clean: build 0 errors, tests 1657/1657 (+16), audit unchanged
  at 11 pre-existing findings.
## 2026-08-10T11:06:35.563Z — PASS — by qa-engineer

PASS. Retargeted the three AC4 assertion sites in test/release-staging.test.mjs (doc comment, SOP-text pins, exact-wording fixture) from a hardcoded/substring-blind simulatePostCommitCheck to a 4-arg (diffNames, activeFeature, specExistsInTree, scopeDecisionWhy) simulation covering all three E44 branches (REQUIRE/SKIP/UNCLASSIFIABLE) + exhaustiveness + REQUIRE-wins-over-SKIP. Added deriveCodesFromWorkingTree modeling the shipped E49 step-7a pipeline (find -maxdepth 1 + git ls-tree PREV_TAG membership predicate, NOT round-1 slug-hunting or round-2 --diff-filter=A) with fixtures for the F7 regression (v3.93.0/v3.94.0 untracked-at-root shapes), the v3.95.0 committed-in-range shape, non-retroactivity, F4 bare-code exclusion, already-archived exclusion, N2, and N4 (documented as a known non-blocking hazard, not fixed). Added a step-order pin guarding F2's regression class. 16 new tests. Gates: npm run build 0 errors; npm test 1657/1657 pass (was 1641/1641, +16, all in release-staging.test.mjs); npm audit --audit-level=high unchanged at 11 pre-existing findings. content/skill-release-engineer.md untouched by this session. N3/N4/N5/N6 all independently assessed as non-blocking (N6 self-corroborated via this session's own tw_switch_role SOP delivery still carrying raw origin-tag markers) — backlog candidates, not release blockers.

