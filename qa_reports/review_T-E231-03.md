# Review — T-E231-03

covers: T-E231-03, T-E231-04

## Round 1 — PASS — by qa-engineer

Reviewed against `specs/e231-info-hygiene-rule.md`, on top of code-reviewer's APPROVED verdict for T-E231-01/T-E231-02 (`review_reports/review_T-E231-01.md`, commit `5855501`). This round covers only the two qa-owned tasks: T-E231-03 (golden regen + ~tok ceiling bumps) and T-E231-04 (new pinning test). Commit under review: `1c16b6a`.

## Expected-Red Diff

(Phase 0.5 of the qa-engineer SOP.)

`qa_reports/expected-red_e231-info-hygiene-rule.txt` exists (15 entries: 11 golden-fixture tests in `test/compose-equivalence.test.mjs`, 4 ceiling tests in `test/context-budget.test.mjs`).

Ran the full suite BEFORE any re-baseline edit (`npm test` on commit `b96287e`, i.e. before this round's golden/ceiling changes): 2800 pass / 15 fail. The sorted list of the 15 failing test names is byte-identical to the sorted manifest — every manifest entry was red, and no red was outside the manifest.

**Phase 0.5: clean (15/15 manifest entries confirmed red, 0 unexplained reds).**

## Phase 1 — Review

Read `content/const-15-core-tail.md`'s two new bullets, `CONTRIBUTING.md`'s pointer sentence, and `content/constitution-rationale.md`'s new entry (already reviewed and APPROVED by code-reviewer in the prior round; not re-litigated here). No correctness, edge-case, or security issues in the qa-owned surface (test files + regenerated fixtures) — the changes are mechanical re-derivations, not hand-authored logic.

### Copy Audit Gate
Spec's Copy/Strings table: "N/A — feature has no new user-facing strings." No implementation string to check against. Gate passes vacuously.

### Visual Audit Gate
Spec's Visual Tokens table: "N/A — feature has no visual literals." Gate passes vacuously.

## Phase 1.5 — Visual Compare

`design/e231-info-hygiene-rule.md` does not exist. **Phase 1.5: skipped (no Visual Baselines declared).**

## Phase 3 — Tests

**Test File Discovery**: per the qa dispatch brief's Test-file placement line — `test/context-budget.test.mjs` (ceiling bumps), `test/fixtures/compose-golden/**` (regenerate via script, never hand-edit), and a new `test/e231-info-hygiene-rule.test.mjs` (AC1 pinning + AC2 four-arm composition), creation pre-authorized. Acted on exactly this branch: bumped `test/context-budget.test.mjs`'s four ceilings, regenerated the golden fixtures via `scripts/capture-constitution-golden.mjs`, and created `test/e231-info-hygiene-rule.test.mjs`. No other test file touched (confirmed by the full-lane diff below).

**Spec-to-Test Map**:
| AC | Test |
|---|---|
| AC1 (both bullets' key phrases present verbatim in the fragment, all five leak classes, full durable-output list, no author exemption, protocol carve-out) | `test/e231-info-hygiene-rule.test.mjs`: "AC1: … Information hygiene bullet …", "AC1: … Generic citation bullet …", "AC1: the two bullets sit in §6 …" (placement) |
| AC2 (both bullets ship on all four dispatch arms) | `test/e231-info-hygiene-rule.test.mjs`: "AC2: both new bullets ship on all four dispatch arms …" |
| AC3 (CONTRIBUTING.md pointer, additive-only) | not a standing test — `git diff` read directly (see AC Execution Log) |
| AC4 (ceiling bumps recomputed; bump comment plain-language, id trailing) | `npm test` full-suite pass + golden regen + direct read of the bump comments (see AC Execution Log) |
| AC5 (const-15 unchanged except the additive block) | `git diff` read directly (see AC Execution Log) |
| AC6 (touched-file scope) | `git diff --stat` read directly (see AC Execution Log) |

**Coverage Gate**: the two new test files/edits are pure assertion code over existing fixtures/composition helpers; no new production code was written this round, so line-coverage tooling does not apply. Noted explicitly per SOP.

**Security Smoke Tests**: not applicable — no new input-handling code this round (content + test-only change).

## AC Execution Log

Every AC in `specs/e231-info-hygiene-rule.md` carries a `proof:` line; all six executed before PASS.

- **AC1** — proof: grep-based pinning test. Ran `node --test test/e231-info-hygiene-rule.test.mjs`. Result: `# tests 4 / # pass 4 / # fail 0`. The three AC1-labeled tests (Information hygiene phrases, Generic citation phrases, placement between Tool-internal ops and §7) all passed.
- **AC2** — proof: `composeConstitution` on all four dispatch arms. Same run as above; the "AC2: both new bullets ship on all four dispatch arms …" test iterates `{chain:false/true} x {design:false/true}` and passed. Confirmed no other test file besides `test/context-budget.test.mjs` was edited: `git diff --stat 93eab3f HEAD -- test/` shows only `test/context-budget.test.mjs` (edited) and `test/e231-info-hygiene-rule.test.mjs` (new); the `test/fixtures/compose-golden/*.txt` changes are regenerated data files, not test source.
- **AC3** — proof: `git diff` on `CONTRIBUTING.md`. Ran `git diff af59a42 5855501 -- CONTRIBUTING.md`: exactly one hunk, 3 added lines, 0 removed lines — the one pointer sentence, rest of the section unchanged. (This is T-E231-02's own AC, already covered by code-reviewer's APPROVED verdict; re-confirmed here directly rather than trusted.)
- **AC4** — proof: `npm test` post-bump, golden regen via the documented script, bump-comment read. Ran `npm run build && node scripts/capture-constitution-golden.mjs`: 12 fixtures captured, `git diff --stat test/fixtures/compose-golden/` shows exactly the 11 fixtures the manifest predicted (8 build.ts modes + 2 hook modes + the constitution monolith), 13 lines added / 0 removed in each — `skill-coordinator-monolith.txt` (the 12th fixture) is untouched, as expected (this ticket never touches a `coord-*.md` fragment). Ran `node --test test/context-budget.test.mjs`: `# tests 54 / # pass 54 / # fail 0`. Then ran the full suite: `# tests 2822 / # pass 2819 / # fail 0 / # skipped 3` (the 3 skips are the pre-existing E229 history-dependent guards, unrelated to this ticket — confirmed present before this round too). Read each of the four new bump comments in `test/context-budget.test.mjs` directly: each opens with a plain-language sentence naming what changed and why ("the new information-hygiene/generic-citation rule sits in the same core-tagged fragment…"), states the measured before/after ~tok figures, and ends with the ticket id in parentheses — `(E231)` — as a trailing pointer, never a bare id standing alone. This is itself an application of the very rule the ticket ships (the SOP's own instruction: "the comment is new prose written after the rule ships, so it must follow the rule it introduces").
- **AC5** — proof: `git diff` on the fragment. Ran `git diff af59a42 5855501 -- content/const-15-core-tail.md`: one hunk, 13 added lines, 0 removed lines — §5, §7, and the rest of §6 are byte-unchanged. (T-E231-01's own AC, re-confirmed directly.)
- **AC6** — proof: `git diff --stat`. Ran `git diff --stat 93eab3f HEAD -- . ':!.current' ':!qa_reports' ':!review_reports'` (`93eab3f` is the lane's pre-cut base, per the spec's own "Filed at human direction…" framing and this lane's git log). Touched: `CONTRIBUTING.md`, `content/const-15-core-tail.md`, `content/constitution-rationale.md`, `docs/backlog.md`, `specs/e231-info-hygiene-rule.md` (the spec itself, PM-authored, expected and out of the AC6 allow-list's concern), `test/context-budget.test.mjs`, `test/e231-info-hygiene-rule.test.mjs`, and the 11 regenerated `test/fixtures/compose-golden/*` files. Zero changes under `gates/`, `bin/agc-init.mjs`, or `tools/handoff-orchestrator.ts`.

No proof failed and no proof was un-runnable.

## Phase 4 — Run

- Project build: `npm run build` — zero errors (`tsc` clean, `check:version` OK, `check:transitions-sync` OK).
- CI runnability: `npm test` runs headlessly to completion with zero human interaction (confirmed twice this round: once pre-baseline to capture the 15 reds, once post-commit for the PASS run below).
- Full suite (post-commit `1c16b6a`, working tree clean, zero untracked files): **2819 pass / 2822 total / 0 fail / 3 skipped** (skips are the pre-existing E229 history-dependent guards, unrelated to this ticket).
- `git status --porcelain` after the run: empty — no stray artifacts written by the test run.

## Verdict

**PASS** — T-E231-03 (golden regen + ceiling bumps, AC4) and T-E231-04 (new pinning test, AC1/AC2) both verified against their proofs; the Expected-Red Diff was clean before any re-baseline edit; the full suite is green post-commit with a clean tree; AC3/AC5/AC6 (owned by the already-APPROVED sr-engineer round) were independently re-confirmed rather than trusted. No blocking findings.
## 2026-09-27T17:08:38.146Z — PASS — by qa-engineer

PASS — T-E231-03/T-E231-04 (covers: qa_reports/review_T-E231-03.md). Expected-Red Diff clean (15/15 manifest entries confirmed red pre-baseline, 0 unexplained). Golden fixtures regenerated (11 of 12, matching the 11 golden reds; skill-coordinator-monolith.txt correctly untouched — this ticket never touches a coord-*.md fragment). Four ~tok ceilings bumped to exact re-measured values (lean 5157->5415, design-arm 9666->9924, teamwork bundle 20044->20310, non-design 7569->7826); each bump comment is plain language with the ticket id trailing only as a pointer (E231), per AC4. New test/e231-info-hygiene-rule.test.mjs pins AC1 (both bullets' key phrases, all five leak classes, full durable-output list, placement) and AC2 (both bullets survive composition on all four dispatch arms) on whitespace-normalized text per the dispatch brief's line-wrap note. AC3/AC5/AC6 independently re-confirmed via direct git diff/diff --stat reads, not trusted from the prior round. Full suite post-commit (1c16b6a, clean tree): 2819 pass / 2822 total / 0 fail / 3 pre-existing skips. See qa_reports/review_T-E231-03.md for the full AC Execution Log.

## 2026-09-27T17:09:46.082Z — PASS — by qa-engineer

PASS — T-E231-03/T-E231-04 (full report: qa_reports/review_T-E231-03.md, covers: T-E231-03, T-E231-04). Expected-Red Diff clean (15/15 manifest entries confirmed red pre-baseline, 0 unexplained). Golden fixtures regenerated (11 of 12, matching the 11 golden reds; skill-coordinator-monolith.txt correctly untouched, since this ticket never touches a coord-*.md fragment). Four ~tok ceilings bumped to exact re-measured values (lean 5157->5415, design-arm 9666->9924, teamwork bundle 20044->20310, non-design 7569->7826); each bump comment explains in plain language why the ceiling moved, with the ticket id trailing only as a pointer (E231), per AC4. New test/e231-info-hygiene-rule.test.mjs pins AC1 (both bullets' key phrases, all five leak classes, full durable-output list, placement) and AC2 (both bullets survive composition on all four dispatch arms) on whitespace-normalized text per the dispatch brief's line-wrap note. AC3/AC5/AC6 independently re-confirmed via direct git diff/diff --stat reads, not trusted from the prior round. Full suite post-commit (1c16b6a, clean tree): 2819 pass / 2822 total / 0 fail / 3 pre-existing skips.

