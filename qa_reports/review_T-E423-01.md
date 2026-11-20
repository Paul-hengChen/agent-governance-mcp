# QA review — T-E423-01..07 (e423-spec-workshop)

covers: T-E423-01, T-E423-02, T-E423-03, T-E423-04, T-E423-05, T-E423-06, T-E423-07

Reviewer: qa-engineer (sonnet), dispatched via Task. Code review: round 2 APPROVED for T-E423-01..05 (`review_reports/review_T-E423-01.md`).

## Expected-Red Diff

Method note: Phase 0.5 needs the suite's red set BEFORE any re-baseline edit. My first full run started on the
clean tree, but I began re-pinning while it was still running, so it is not a clean baseline. I therefore rebuilt
the pre-edit state in a copy outside the worktree (committed content, the original expected values restored in the
five re-pinned test files and `context-budget`, no `.git` directory) and ran `npm test` there: 4378 tests, 24 red.

Manifest entries (12) vs actual reds:

- e178a AC3 (registry 13) — confirmed red, re-pinned (13 entries, `integrator` 12th, `spec-workshop` last).
- e178a AC5 (CLAUDE.md counts) — confirmed red, re-pinned per `claude.*` (13 / Thirteen / the other eleven / the other 12 role SOPs).
- skill-frontmatter "every content/skill-*.md carries a valid recommended_model" — confirmed red (12 -> 13), re-pinned together with e178a AC17's regex (12 -> 13).
- e384 AC-E384-1 bullet, AC-E384-1 inline, AC-E384-2 H2, AC-E384-3 "tokens not starting", AC-E384-3 "never scanned past", security smoke — all six confirmed red; re-pinned to return the token, arm, keep `ok: true`, and cut a 100 000-char token to 40 + U+2026. Titles reworded where they said "undeclared".
- visual-evidence-gate E319 AC-E319-5 "naming no known mode" — confirmed red, re-pinned (`freehand`, required true).
- context-budget teamwork bundle ≤ 18465 — confirmed red (measured 18614), re-baselined.
- skill-manifest t-golden-byte-identity — confirmed red, golden re-captured.

12/12 manifest entries confirmed red. Unexplained reds attributable to this ticket: 0. The other 12 reds in the copy are artefacts of
the copy having no `.git` directory (not regressions): research tracked-binary ratchet (E104 ii), check-md-tables real-corpus (AC7, CQ-9),
hygiene and comment isolated-HEAD smokes (AC16, AC14), release-bookkeeping checker (AC12), ci.yml branch pins (AC1, AC2),
real-corpus script (AC13/AC16), release doc literal (AC-D1), e405 release workflow, top-level-directory partition (E66). They are
disproved by the full run in the real worktree (see the suite result in the PASS section).
Test names in the manifest that I reworded: the six e384 titles, E319 AC-E319-5, e178a AC3/AC5/AC17.

## Phase 1 — review

Copy Audit (3a): every Copy / Strings anchor of the spec is pinned verbatim by `test/e423-spec-workshop.test.mjs`
(sop.*, integ.*, coord.*, da.*, prompt.description) and the `claude.*` rows by e178a AC5. No unlisted user-facing string found.
Visual Audit (3b): N/A (spec Visual Tokens = N/A). Phase 1.5: skipped (no Visual Baselines declared; no design file).

## Phase 3 — tests and AC map

Placement: spec "Test placement guidance" + the dispatch brief `Test-file placement` line (new `test/e423-spec-workshop.test.mjs`; re-pin in place).

| AC | test |
|---|---|
| AC1 | e423 AC1; e178a AC3 |
| AC2 | e423 AC2 (stdio prompts/list + prompts/get) |
| AC3 | e423 AC3 (tool boundary rejects `spec-workshop`, JSON Schema enum, source scan) |
| AC4 | e423 AC4 |
| AC5 | skill-frontmatter (13) + e178a AC17 |
| AC6 | e423 AC6 (seven step units in the composed prompt) |
| AC7 | e423 AC7 (every write-tool mention is the prohibition line) |
| AC8, AC9, AC10 | e423 AC8, AC9, AC10 |
| AC11 | e423 AC11 (dispatch view of the SOP + added lines of the other three files) |
| AC12 | e423 AC12; e288, e296 stay green |
| AC13 | e423 AC13 (composed coordinator) |
| AC14 | e423 AC14 (+ D5 step-2b line) |
| AC15, AC16 | e423 AC15, AC16 (+ boundary 40/41, 100 000 chars); e384 re-pinned |
| AC17 | e423 AC17 (real `handleUpdateState`, rejects with `mode=mockup`) |
| AC18 | e423 AC18 guard; e384/vef/e2e/baseline/pixel/credibility suites green |
| AC19-AC23 | AC Execution Log below |

Coverage: the tests exercise every branch of the `gates/visual.ts` parser (truncation, first-unknown, known-wins) and the registry entry; line coverage was not measured (no coverage runner in the repo).
Security smoke: 100 000-char token, special characters after the token, empty value (`mode: —`).

Findings outside QA scope: none. No e431-owned test edited (changed test files are only those in the placement list; `test/skill-evolution-v3.11.test.mjs` untouched).

## Golden re-capture (AC22)

`node scripts/capture-constitution-golden.mjs` rewrote all 12 fixtures; the diff stat shows only
`test/fixtures/compose-golden/skill-coordinator-monolith.txt` changed (+3 lines, 2 hunks, 0 deletions):

1. After the Keywords bullet (line 72): the new `- Local prototype exports: …` bullet (`coord.match-prototype`) in the Design-source detection match list.
2. After the "If ≥ 1 hit" paragraph: the new paragraph carrying the `coord.hint` text, the ticket-file routing and the `coord.ticket-file` definition, plus one blank line.

Both are the coord-01 additions from T-E423-05; nothing else moved. The eight `build-*`, `hook-*` and `constitution-monolith` goldens are byte-identical.

## Budget (AC21)

- NEW cap `skill-spec-workshop stripped token count ≤ 1092` (`stripRationale(stripOriginTags(expandSkill(body)))`, frontmatter stripped, chars/4 ceiling; same method as the pm cap), zero headroom.
- Teamwork bundle cap 18465 -> 18614 (measured; +149 ~tok from the coord-01 addition), zero headroom, history comment added.

## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC1-AC4 | `node --test test/e423-spec-workshop.test.mjs`; e178a | 19/19 pass; e178a pass | pass |
| AC5 | `node --test test/skill-frontmatter.test.mjs` | pass (13 files) | pass |
| AC6-AC11 | same e423 file | pass | pass |
| AC12 | e423 AC12; `node --test test/e288-integrator-stage0.test.mjs test/e296-manifest-tier.test.mjs` | pass | pass |
| AC13 | e423 AC13; `node --test test/design-auditor-volume-guard.test.mjs test/feature-scope-gate.test.mjs test/feature-split-lifecycle.test.mjs` | pass | pass |
| AC14 | e423 AC14; `node --test test/design-auditor-volume-guard.test.mjs test/source-credibility-gate.test.mjs` | pass | pass |
| AC15-AC17 | e423 file; `node --test test/e384-design-mode-declared.test.mjs` | pass | pass |
| AC18 | `node --test test/e384-design-mode-declared.test.mjs test/visual-evidence-gate.test.mjs test/visual-gate-e2e.test.mjs test/baseline-manifest-gate.test.mjs test/pixel-gate-attestation.test.mjs test/source-credibility-gate.test.mjs` (run together with the AC5/12-14 proofs) | 273 pass, 0 fail | pass |
| AC19 | `wc -l < CLAUDE.md`; `node --test test/e436-stale-handoff-paths.test.mjs test/e395-claude-md-tail.test.mjs test/e178a-integrator-role.test.mjs` | 250; 30 pass, 0 fail | pass |
| AC20 | `grep -nE 'All 12 registered\|12 registered prompts\|twelve single-file\|11 prompts registered' README.md docs/install.md docs/architecture.md CONTRIBUTING.md` | no output, exit 1 | pass |
| AC21 | `node --test test/context-budget.test.mjs` | 55 pass, 0 fail | pass |
| AC22 | diff stat of `test/fixtures/compose-golden/` against base 0efc203 lists only `skill-coordinator-monolith.txt`; `node --test test/skill-manifest.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs` | 1 file; 45 pass, 0 fail | pass |
| AC23 | name-only diff of `dist/` against base 0efc203: `dist/gates/visual.*`, `dist/prompts/spec-workshop.*`, `dist/tools/registry.*` only; no e431-owned test changed; full suite `node scripts/test-lock.mjs -- npm test` | see the server-recorded suite-result header of the PASS section | see PASS section |
