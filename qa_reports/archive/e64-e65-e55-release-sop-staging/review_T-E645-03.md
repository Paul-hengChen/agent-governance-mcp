# Review — T-E645-03 (owns test surface for E64/E65/E55; covers T-E645-01, T-E645-02)

covers: T-E645-03, T-E645-02, T-E645-01

## Phase 0 — Claim

Claiming review per `tw_update_state(status=In_Progress, agent_id="qa-engineer")`. Upstream: `content/skill-release-engineer.md` (T-E645-01, sr-engineer) reviewed and **APPROVED at round 2** by code-reviewer (`review_reports/review_T-E645-02.md`, T-E645-02). This ticket (T-E645-03) owns the test-side half the round-2 review deferred to qa: retarget `test/release-staging.test.mjs` for E64's `gates/` omission, E65's step-order/adapter-stamp additions, and E55's terminal step; clear the one recorded red (`AC-B5.5`); keep the six-release backtest pins green unmodified.

## Correction acted on before touching anything

The dispatch brief and the expected-red manifest's prose header both repeat a now-disproven ordering claim ("rescope AC1 before patching FEATURE_DIRS, or AC-B5.5 stays red"). `review_reports/review_T-E645-02.md` round 2 (**R2-2**) traces this to the reviewer's own garbled round-1 parenthetical and disproves it by experiment: `FEATURE_DIRS` patched with `gates/` alone, AC1 left completely unscoped, tsconfig.json as shipped by sr → **60/60 green**. AC-B5.5 (`test/release-staging.test.mjs:542`) is a pure set difference between `tsconfig.json`'s `include` and `FEATURE_DIRS` — it reads no SKILL text and no AC1. I verified this independently (see **AC Execution / Phase 4** below) before writing a single line, and did the two fixes in whichever order was convenient rather than treating either as a precondition of the other. `FEATURE_DIRS` (`test/release-staging.test.mjs:66`, not `:82` — `:82` was the brief's usage-site citation) was patched first only because it is what clears the recorded red.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e64-e65-e55-release-sop-staging.txt` — one entry:

```
test/release-staging.test.mjs | AC-B5.5: every repo source directory appears in FEATURE_DIRS or metadata list
```

Ran `node --test test/release-staging.test.mjs` **before any edit** to the test file: **59/60**, single fail = exactly `AC-B5.5`. Diff against the manifest: **empty** — 1/1 manifest entries confirmed red, 0 unexplained reds.

Disposition of the one manifest entry, recorded here rather than silently re-baselined: `AC-B5.5` is now **GREEN** — this ticket's own point (1) fix (`gates/` added to `FEATURE_DIRS`) is the intended resolution the manifest declared it would need; not a re-baseline of the assertion's logic, which is unchanged (still a pure `tsconfig.json include \ FEATURE_DIRS` set difference).

## Phase 1 — Review

`content/skill-release-engineer.md` (T-E645-01) already carries two full review rounds (`review_reports/review_T-E645-02.md`) — round 1 CHANGES_REQUESTED (F2 gates/ miscount, F3 stale SHIM list), round 2 APPROVED (both fixed and independently re-verified: F2's 12/33/14 counts re-derived from `ls`+`GATE_REGISTRY`; F3's SHIM fix confirmed; the `tsconfig.json` root-cause fix proven emit-neutral via fresh dual compile, 264≡264, `diff -rq` silent). I re-read the shipped file end to end rather than trusting the round-2 verdict at face value; nothing in it contradicts the round-2 findings, and the five new SOP steps (7b/7c/7d, the retired 10/11 pointers, step 14) read as a coherent, internally-ordered unit. No new correctness issue found in the content file itself — my Phase 1 contribution is the test-side artifact below, since that is this ticket's actual scope (§2, qa owns tests; sr/code-reviewer own the content and already closed it).

**No `specs/<active_feature>.md` exists** (mini-chain, backlog rows ARE the spec per `scope_decision_why` — itself confirmed live by the file's own AC4 SKIP-branch text). Phase 3a (Copy Audit Gate) and Phase 3b (Visual Audit Gate) both require a spec's *Copy/Strings* / *Visual Tokens* H2 to audit against — neither exists for this backlog-row-as-spec dispatch, so both gates are **N/A, not silently skipped**: there is no spec document to open. `content/skill-release-engineer.md` is prose SOP text, not user-facing copy or a themed UI, so neither gate's underlying concern (rendered-text drift, styled-literal drift) applies to this artifact class regardless.

## Phase 1.5 — Visual Compare

**Skipped** (no `design/<feature>.md`, no Visual Baselines H2 — content-only prompt-text change, no UI).

## Phase 3 — Tests

**3a. Test File Discovery**: `test/release-staging.test.mjs` (1717 lines pre-edit) already owns this SOP's text-pin surface; extended in place rather than authoring a new file, per the ticket's own instruction ("all in `test/release-staging.test.mjs` unless you judge otherwise"). One line in `test/config-cache.test.mjs` also needed annotation (below) — pre-existing file, `test/**`, header `// Coded by @qa-engineer`.

**3b. Spec-to-Test Map** (backlog rows are the spec; mapping each of E64/E65/E55's sub-obligations to the test(s) that now pin it):

| Obligation | Test(s) |
|---|---|
| E64: `gates/` in the source-dir list the AC2 fixture compares against | `FEATURE_DIRS` patch (`:66`) + "Fixture I (AC2, E64): an unstaged gates/ change is now CAUGHT …" |
| E64: AC1 rescoped off the whole document, onto the git-add line's own capture group | "AC1: skill-release-engineer.md's git-add line enumerates every required staging directory and metadata path IN ITS CAPTURE GROUP (rescoped, E64/T-E645-03 point 2)" |
| E64: the *Expected vs unrelated scope rule* paragraph's own `gates/`-inclusive enumeration | "Expected vs unrelated scope rule (E64, T-E645-03 point 3): the scope-rule paragraph's OWN enumeration …" |
| E64: AC-B5.5 (tsconfig↔FEATURE_DIRS auto-detector) | pre-existing test, now green via the `FEATURE_DIRS` patch — no test-code change to AC-B5.5 itself, matching R2-2's finding that it is cured by that one line alone |
| E65: five metadata paths staged at step 8 | "E65: the five newly-staged metadata paths appear in step 8's git-add line" (+ covered again inside the rescoped AC1 test via `E65_METADATA_PATHS`) |
| E65: adapter-stamp step names all three files + `agc check` exit-0 | "E65: the adapter-stamp step exists, names all three deployed adapter files, and requires agc check to exit 0" |
| E65: step 7b/7c/7d ordered before step 8, in that relative order | "E65: step 7b …, 7c …, and 7d … are ALL ordered before step 8's commit, in that relative order — order is the whole defect" |
| E55: terminal handback step, placed after step 12, describing pm's intake as the expected next action | "E55: the terminal handback step names the post-release PM/backlog-intake dispatch as an explicit terminal step …" |
| Six-release backtest (E44/E50, T-E44-02/T-E50-03) | unmodified — `git diff` confirms zero touch to those blocks; reran, still green (Phase 4) |
| `test/config-cache.test.mjs:15` stale "SOP step 10" reference | additive annotation ("as of this comment's authoring; renumbered to step 7b under E65"), same insertion-not-substitution pattern code-reviewer used at the 5 spec sites (R2-7) |

**3c. Coverage Gate**: N/A in the line-coverage sense — the changed artifact is prompt/SOP text (`content/skill-release-engineer.md`) and test text, not instrumented source; there is no `nyc`/`c8` target here. Every literal obligation in the ticket (points 1-6) maps to at least one new or pre-existing-and-reverified assertion, per the table above — noted explicitly per SOP 6c's "if tooling can't measure" branch.

**3d. Security Smoke Tests**: N/A — no new input surface, no auth/permission path; this is SOP prose plus its regression tests.

**3e.** Tests written: see diff. `test/release-staging.test.mjs`: `FEATURE_DIRS` gains `gates/`; two new constants (`METADATA_PATHS`, `E65_METADATA_PATHS`); AC1 rescoped (whole-document → git-add-line capture group); one new AC2 fixture (Fixture I); one new scope-rule-paragraph test; three new E65 tests; one new E55 test. `test/config-cache.test.mjs`: one-line additive annotation, no assertion changed.

## Phase 3.5 — AC Execution Log

**Skipped**: no `specs/<active_feature>.md` exists (mini-chain), so no `proof:`-annotated ACs to execute. The R2-2 ordering claim was independently re-verified anyway (methodologically the same as a proof execution, recorded here since it gates how the fix was sequenced):

- **Experiment**: reverted `test/release-staging.test.mjs` to its pre-edit state (`git stash` the qa diff), ran `node --test test/release-staging.test.mjs` → 59/60, single fail `AC-B5.5`, matching the manifest exactly (see Phase 0.5).
- **Regression-guard experiment**: with the fix applied, temporarily deleted the shipped `git add lib/ tools/ …` line from `content/skill-release-engineer.md` (via a throwaway `node -e` edit, not committed) and reran `test/release-staging.test.mjs` → **2 reds** (the rescoped AC1 test, and the new E65 five-metadata-paths test) — confirming the round-1 F1 vacuousness finding is closed: this pin now cannot survive deletion of the thing it pins. Restored the file from a pre-edit backup immediately after; `git diff --stat content/skill-release-engineer.md` afterward showed only the sr/code-reviewer-authored round-1+2 diff (17 insertions / 9 deletions → final 26 total across both rounds), confirming a clean restore.

## Phase 4 — Run

- **Build**: `npm run build` → `tsc` zero errors; `check:version` OK (3.100.0); `check:transitions-sync` OK (21 keys, exact match).
- **`npm audit --audit-level=high`**: exit 0. 5 findings, all **moderate/low** (`@hono/node-server`, `body-parser`, `esbuild`, `hono`, `protobufjs`) — none HIGH/CRITICAL, so the SOP step-6a disposition procedure (cross-check against `docs/dependency-advisories.md`) does not engage; nothing to record.
- **Full suite**: `npm test` → **1719/1719 pass**, 0 fail. Includes:
  - `test/release-staging.test.mjs`: **66/66** (was 59/60 pre-fix; +6 net new tests, the one recorded red now green).
  - `test/config-cache.test.mjs`: unaffected by the comment-only annotation — all tests still pass.
  - Six-release backtest pins (T-E44-02/T-E50-03, the E49/E50 step-7a derivation and seven-release-history tests at `:1730` onward): confirmed **untouched** (`git diff test/release-staging.test.mjs` shows zero lines changed in that region) and still green — no regression in E44/E50's shipped behavior.
  - `test/feature-lease.test.mjs`, `test/verify-release.test.mjs`, `test/agc-adapters.test.mjs` (F-OK-1's step-number pin files): green, confirming the E65 step renumbering/reordering didn't disturb the anchored `^11b.`/`^12.`/`9a.` pins code-reviewer verified in round 1.
- **CI Runnability**: `npm test` runs headlessly, zero interaction required.

**PASS.**

## Verdict

PASS — T-E645-01 (content), T-E645-02 (review, APPROVED round 2), and T-E645-03 (this ticket's test surface) are all complete. `AC-B5.5` is green via the load-bearing fix (`gates/` in `FEATURE_DIRS`), AC1 is rescoped off the whole-document form that round-1 F1 proved vacuous, the scope-rule paragraph gets its own bounded check, E65's five paths/adapter-stamp/step-order and E55's terminal step are all pinned, the six-release backtest is unmodified and still green, and the stray stale "step 10" comment is annotated additively. Full build, `npm audit --audit-level=high`, and the full 1719-test suite all pass.
## 2026-08-13T12:41:00.775Z — PASS — by qa-engineer

PASS. T-E645-01 (content/skill-release-engineer.md, E64+E65+E55) APPROVED round 2 by code-reviewer (review_reports/review_T-E645-02.md). T-E645-03 owns the test surface: FEATURE_DIRS gained gates/ (clears the recorded AC-B5.5 red, a pure tsconfig-include\FEATURE_DIRS set difference); AC1 rescoped from a vacuous whole-document SKILL.includes(dir) check onto the git-add line's own capture group (round-1 F1 layer 3 finding closed — verified by experiment: deleting the git-add line now reds AC1, where the old form stayed 60/60 green); new Fixture I proves an unstaged gates/ change is CAUGHT by AC2; new scope-rule-paragraph test bounds the Expected-vs-unrelated enumeration check to that paragraph only; new E65 tests pin the five staged metadata paths, the adapter-stamp step (names all three files + agc check exit 0), and the 7b<7c<7d<8 ORDER; new E55 test pins the terminal-handback step's placement and text. Six-release backtest (T-E44-02/T-E50-03) confirmed byte-unmodified via git diff and still green. test/config-cache.test.mjs:15 stale 'SOP step 10' comment annotated additively (insertion, not substitution). Corrected the manifest's false ordering caveat before starting (verified independently: FEATURE_DIRS patch alone -> 60/60, no AC1 rescope precondition). Full build clean (tsc, check:version, check:transitions-sync). npm audit --audit-level=high: exit 0, 5 findings all moderate/low, none HIGH/CRITICAL. Full suite: 1719/1719 pass. Evidence: qa_reports/review_T-E645-03.md.

## 2026-08-13T12:41:21.561Z — PASS — by qa-engineer

PASS. T-E645-01 (content/skill-release-engineer.md, E64+E65+E55) APPROVED round 2 by code-reviewer (review_reports/review_T-E645-02.md). T-E645-03 owns the test surface: FEATURE_DIRS gained gates/ (clears the recorded AC-B5.5 red, a pure tsconfig-include\FEATURE_DIRS set difference); AC1 rescoped from a vacuous whole-document SKILL.includes(dir) check onto the git-add line's own capture group (round-1 F1 layer 3 finding closed — verified by experiment: deleting the git-add line now reds AC1, where the old form stayed 60/60 green); new Fixture I proves an unstaged gates/ change is CAUGHT by AC2; new scope-rule-paragraph test bounds the Expected-vs-unrelated enumeration check to that paragraph only; new E65 tests pin the five staged metadata paths, the adapter-stamp step (names all three files + agc check exit 0), and the 7b<7c<7d<8 ORDER; new E55 test pins the terminal-handback step's placement and text. Six-release backtest (T-E44-02/T-E50-03) confirmed byte-unmodified via git diff and still green. test/config-cache.test.mjs:15 stale 'SOP step 10' comment annotated additively (insertion, not substitution). Corrected the manifest's false ordering caveat before starting (verified independently: FEATURE_DIRS patch alone -> 60/60, no AC1 rescope precondition). Full build clean (tsc, check:version, check:transitions-sync). npm audit --audit-level=high: exit 0, 5 findings all moderate/low, none HIGH/CRITICAL. Full suite: 1719/1719 pass. Evidence: qa_reports/review_T-E645-03.md.

