# e409-lite-wording-const-header

Lane `e409` of fan-out plan `specs/fanout-prompt-audit-w7.md` (tickets E409 and E411). Mini-chain: pm, sr-engineer, code-reviewer, qa-engineer; no architect (wording and test re-pins only, no interface contract). Spec sources: `docs/backlog.md` rows E409 and E411, and the plan's E409/E411 site lists, common scope, Lanes row `e409` and Decisions table. Human rulings (Decisions, 2026-11-05): **E409 option (a)**, **E411 option (b)**, **E414 kept** (no edit, not in this lane).

## Problem Statement

Two pieces of always-on prompt text state facts that are no longer true. (1) E409: `content/skill-coordinator-lite.md` line 16 (Hard rules, "Server-read-only") lists `tw_update_state`, `tw_add_task`, `tw_complete_task` and `tw_rollback_task` as server-rejected. Only two are: `tw_update_state` rejects a write without `agent_id` (`AGENT_ID_REQUIRED`) and `handleCompleteTask` runs `requireQaEngineer` (`tools/tasks.ts` lines 71–72). `handleRollbackTask` (lines 80–84), `handleVoidTask` (lines 88–92) and `handleAddTask` (from line 94) run only `enforcePreFlight`, which a lite session passes after `tw_get_state`, so those writes succeed. (2) E411: `content/const-01-core-head.md` line 1 reads `# Constitution v3.41.0 <!-- versioned independently of package.json -->`. The body's origin tags reach v3.104.0, no release step bumps the number, and four test files pin the `v` shape. Ruling (b): the header becomes `# Constitution` and the CHANGELOG is the only record of constitution changes.

## User Stories

- As a solo developer in lite mode, I want the lite SOP to say which write tools the server actually blocks and which only the SOP forbids, so that I do not rely on a server guard that does not exist.
- As a maintainer, I want the constitution header to carry no version number that nothing bumps, so that the header cannot go stale again.
- As a reviewer, I want the tests that read the header to tell "full constitution present" from "absent" without a version, so that the dedup and fail-safe tests still prove something.

## Acceptance Criteria

- **AC1 (E409)**: Given `content/skill-coordinator-lite.md`, when line 16 is read, then it is exactly the `lite.16` string in Copy / Strings: `tw_update_state` / `tw_complete_task` are server-rejected; `tw_add_task` / `tw_rollback_task` / `tw_void_task` / `tw_switch_role` are SOP-forbidden. The rest of the file is unchanged and the file keeps 52 newline-terminated lines.
  proof: `node --test test/e391-prompt-audit-stale-facts.test.mjs` (AC-G2-11, re-pinned: the new span counts 1, the old span "`tw_rollback_task`: server-rejected; `tw_switch_role`: SOP-forbidden." counts 0, `will be rejected` counts 0, test title no longer says "four write tools server-rejected").
- **AC2 (E409)**: Given the lite SOP's server-rejected claim, when the handler sources are read, then every tool line 16 calls server-rejected has a server gate and every write tool it calls SOP-forbidden has none: `handleCompleteTask` calls `requireQaEngineer`; `handleAddTask`, `handleRollbackTask`, `handleVoidTask` call `enforcePreFlight` and no agent gate; `tw_update_state` rejects a missing `agent_id` with `AGENT_ID_REQUIRED`. The test checks function bodies located by name, not line numbers. If someone later adds an agent gate to one of those handlers, the test fails and points at line 16.
  proof: `node --test test/e409-lite-write-tool-facts.test.mjs` (new, qa-authored).
- **AC3 (E411)**: Given `content/const-01-core-head.md`, when line 1 is read, then it is exactly `# Constitution`: no version, no HTML comment. Lines 2–36 are unchanged, and the string `versioned independently` occurs 0 times under `content/`.
  proof: `node --test test/constitution-deliverable-guard.test.mjs` (A3, re-pinned: first line `=== "# Constitution"`; the stale-v3.14.1 clause is dropped with the version).
- **AC4 (E411)**: Given the four constitution compositions (`composeConstitution` with chain×design ∈ {true,false}²), when each is built, then each starts with `# Constitution\n`.
  proof: `node --test test/constitution-deliverable-guard.test.mjs` (A3 asserts all four compositions; qa may split it into an A3b case in the same file).
- **AC5 (E411)**: Given the tests that pin the header's shape, when they run against the new header, then each uses a version-free anchored form and still tells a full emit from an omitted one:
  - `test/e393-builder-judge-core.test.mjs` line 138: `head.startsWith("# Constitution\n")`, message without "bumped to v3.41.0".
  - `test/prompt-state-footer.test.mjs` lines 421, 429, 433, 463, 483: `/^# Constitution$/m` at all five sites (positive at 421, 433, 483; negative at 429, 463). One regex for all five, so the positive sites prove the negative ones are not vacuous.
  - `test/teamwork-lite.test.mjs` lines 100 and 143: `/^#\s+Constitution\s+v/m` becomes `/^# Constitution$/m`. These two sites are not in the plan's site list; the trial below found them red.

  `# Constitution Rationale` (`content/constitution-rationale.md`) and the S03 sentinel do not match `^# Constitution$`.
  proof: `node --test test/e393-builder-judge-core.test.mjs test/prompt-state-footer.test.mjs test/teamwork-lite.test.mjs`
- **AC6 (E411)**: Given the content edits, when `node scripts/capture-constitution-golden.mjs` runs, then exactly the 11 goldens in the golden change list change, each by the one-line hunk `1c1` (`# Constitution v3.41.0 <!-- … -->` → `# Constitution`), and `test/fixtures/compose-golden/skill-coordinator-monolith.txt` stays byte-identical. If that file changes, stop and mail the integrator.
  proof: `git diff --stat test/fixtures/compose-golden/` lists exactly the 11 files at 1 insertion(+) / 1 deletion(-) each, and `node --test test/compose-equivalence.test.mjs test/skill-manifest.test.mjs test/e90-golden-capture-completeness.test.mjs test/render-structure.test.mjs` is green.
- **AC7 (budgets)**: Given caps lean 5723, stripped constitution 10598, non-design 8501 and teamwork 21715, when the budget test runs on the lane HEAD, then all four pass at or below the trial "after" figures and no cap or floor value changes.
  proof: `node --test test/context-budget.test.mjs` green and `git diff --quiet <lane base> -- test/context-budget.test.mjs` exits 0.
- **AC8 (lane hygiene)**: Given the final lane HEAD, when qa runs the closing checks, then:
  - `node scripts/test-lock.mjs -- npm test` is green;
  - `npm run build` leaves `git status --porcelain dist/` empty;
  - `npm run check:bookkeeping` exits 0;
  - `npm audit --audit-level=high` exits 0;
  - `test/e410-task-alias-content-tail.test.mjs` is green and unedited (its line-count pins of 37 for const-01 and 53 for lite still hold).

  proof: the four commands above, each quoted with its exit code in `qa_reports/review_<id>.md`.

## Site map (line numbers re-checked against the lane base `6e1a9d4`)

| site | file:line | current | after | AC | task |
|---|---|---|---|---|---|
| lite.16 | `content/skill-coordinator-lite.md`:16 | "…; `tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_rollback_task`: server-rejected; `tw_switch_role`: SOP-forbidden. Do NOT call them." | Copy / Strings `lite.16` | AC1 | T-E409-01 |
| c01.1 | `content/const-01-core-head.md`:1 | `# Constitution v3.41.0 <!-- versioned independently of package.json -->` | `# Constitution` | AC3, AC4 | T-E411-01 |
| e391.73–77 | `test/e391-prompt-audit-stale-facts.test.mjs`:73–77 | AC-G2-11 pins the old span | pins `lite.16` span; old span 0; `will be rejected` 0; retitle | AC1 | T-E409-02 |
| e409 facts | `test/e409-lite-write-tool-facts.test.mjs` (new) | — | handler-gate facts behind `lite.16` | AC2 | T-E409-02 |
| guard.A3 | `test/constitution-deliverable-guard.test.mjs`:55–72 | `/^# Constitution v3\.\d+\.\d+/` + not v3.14.1 | first line `=== "# Constitution"`; four compositions start with it; comment block 56–61 rewritten | AC3, AC4 | T-E411-02 |
| e393.138 | `test/e393-builder-judge-core.test.mjs`:138 | `startsWith("# Constitution v3.41.0")` | `startsWith("# Constitution\n")` | AC5 | T-E411-02 |
| footer ×5 | `test/prompt-state-footer.test.mjs`:421, 429, 433, 463, 483 | `/^# Constitution v/m` | `/^# Constitution$/m` | AC5 | T-E411-02 |
| lite-test ×2 | `test/teamwork-lite.test.mjs`:100, 143 | `/^#\s+Constitution\s+v/m` | `/^# Constitution$/m` | AC5 | T-E411-02 |
| goldens ×11 | `test/fixtures/compose-golden/` (list below) | line 1 old header | line 1 `# Constitution` | AC6 | T-E411-02 |

Pin audit at lane base: grep of `test/`, `scripts/`, `bin/`, `lib/`, `prompts/`, `tools/` for `# Constitution`, `Constitution v`, `Constitution\s+v`, `v3.41.0`, `versioned independently`, `server-rejected`, `SOP-forbidden` and `Server-read-only`. Only the sites above read either line; no program reads the header's shape. `test/e410-task-alias-content-tail.test.mjs` pins line counts only (unchanged), and `test/context-budget.test.mjs` pins no header text.

### Trial (PM, scratch copy of the lane base with both content edits applied; worktree untouched)

**Expected-red set before qa re-pins.** 7 tests in 5 files; the other owned suites are green once the goldens are recaptured:
- e391 AC-G2-11
- deliverable-guard A3
- e393 AC-C01 (line 138)
- prompt-state-footer: the "AC-4/AC-7/AC-8/DR-5/e2e" test (sites 421 and 433) and "C11/AC-7 L2 fail-safe" (site 483)
- teamwork-lite AC2 (line 100) and AC3b (line 143)

Sites 429 and 463 stay green because the old negative regex cannot match. They are re-pinned anyway so all five sites use one regex.

### Budget (chars/4, composed exactly as `test/context-budget.test.mjs`)

| budget | cap | before | after (both edits, with `tw_void_task`) | delta |
|---|---|---|---|---|
| lean always-on | 5723 | 5675 | 5665 | −10 (E411 −14, E409 +4) |
| stripped constitution | 10598 | 10466 | 10451 | −15 |
| non-design constitution | 8501 | 8466 | 8452 | −14 |
| teamwork bundle | 21715 | 21398 | 21384 | −14 |

Without `tw_void_task` the lean figure is 5661; the other three figures do not change. Secondary floors in the same file:
- design-only strip saving ≥ 1999: 2000 → **1999**. Still green, but zero margin: both arms shrink by the same 57 chars and `Math.ceil` rounding takes 1. Flagged for the integrator; it is not a cap edit.
- rationale/origin saving ≥ 240: 406 → 406.
- AC-9 dedup saving ≥ 1200: 4124 → 4110.
- sr-engineer design − non-design bundle ≥ 1830: 2139 → 2139.

### Golden change list (trial capture; each file's only hunk is `1c1`)

`build-full-design-fd.txt`, `build-full-design.txt`, `build-full-nondesign-fd.txt`, `build-full-nondesign.txt`, `build-lite-design-fd.txt`, `build-lite-design.txt`, `build-lite-nondesign-fd.txt`, `build-lite-nondesign.txt`, `constitution-monolith.txt`, `hook-full.txt`, `hook-lite.txt`. `skill-coordinator-monolith.txt` is byte-identical. No golden contains lite line 16.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| lite.16 | ``- **Server-read-only.** Lite has no `agent_id` in the routing chain (`tools/transitions.ts`); `tw_update_state` / `tw_complete_task`: server-rejected; `tw_add_task` / `tw_rollback_task` / `tw_void_task` / `tw_switch_role`: SOP-forbidden. Do NOT call them.`` | `specs/fanout-prompt-audit-w7.md` Decisions 2026-11-05 (E409 option (a)) + `docs/backlog.md` E409 row. The `tw_void_task` entry is authored here: same pre-flight-only handler family (`tools/tasks.ts` `handleVoidTask`), already forbidden by lite SOP step 2 "No `tw_*` writes", costs +4 ~tok lean, and leaving it out would invite the next audit to report it again |
| c01.1 | `# Constitution` | `specs/fanout-prompt-audit-w7.md` Decisions 2026-11-05 (E411 option (b)) + `docs/backlog.md` E411 row |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E409 option (b): an agent gate on `handleAddTask` / `handleRollbackTask` / `handleVoidTask` (`tools/`, `dist/`).
- E411 option (a) (`scripts/release.mjs` header check) and option (c) (tie the header to `package.json`).
- E412 (qa-visual template, `content/coord-05-core-visual-drift.md`, `skill-coordinator-monolith.txt`): lane `e412`.
- E414: ruled keep, no edit.
- Renaming the "Server-read-only." label on lite line 16. It names lite's posture, and the ruling covers the tool list only.
- `specs/release-sop-history.md` line 48: a historical document, left as is per the plan.
- Raising or lowering any cap or floor, or editing `test/context-budget.test.mjs` or `test/subagent-templates.test.mjs`.
- Release bookkeeping (CHANGELOG, version bump, backlog done-marks): integrator and release-engineer, after the wave.

## Dependencies / Prerequisites

- Lane base `6e1a9d4`; plan `specs/fanout-prompt-audit-w7.md`, status approved 2026-11-05.
- Rulings are final and are not re-asked: E409 (a), E411 (b), E414 keep. No open questions and no external references (Resource Audit: zero hits).
- Manifest correction for the integrator: the plan lists `test/teamwork-lite.test.mjs` as expected unchanged, but it holds two `/^#\s+Constitution\s+v/m` sites (lines 100 and 143) that the E411 edit turns red. The file is already in this lane's owned set, so the ownership cut does not change.
- §2 ownership: sr-engineer edits `content/` only. Every `test/` change, including the golden recapture (fixtures live under `test/`), is qa-owned. Between T-E409-01/T-E411-01 and T-E409-02/T-E411-02, code-reviewer reviews against the expected-red set listed above.
- `dist/` does not change: content is read at runtime, so sr runs no build commit.
- (Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.)

manifest-tier: not eligible — cutApprovalAutoTier is {} (manifest key absent)

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E409-01 | sr-engineer: lite line 16 becomes string `lite.16` verbatim; no other line in the file changes (AC1) | none | 1 | `content/skill-coordinator-lite.md` | — |
| T-E411-01 | sr-engineer: const-01 line 1 becomes `# Constitution` (string `c01.1`); lines 2–36 unchanged (AC3) | none | 1 | `content/const-01-core-head.md` | — |
| T-E409-02 | qa-engineer: re-pin e391 AC-G2-11 lines 73–77 (new span 1, old span 0, `will be rejected` 0, retitle) (AC1); new handler-facts test (AC2) | T-E409-01 | 2 | `test/e391-prompt-audit-stale-facts.test.mjs` `test/e409-lite-write-tool-facts.test.mjs` | — |
| T-E411-02 | qa-engineer: run `node scripts/capture-constitution-golden.mjs` and commit only the 11 listed goldens (monolith byte-identical, else stop and mail) (AC6); re-pin deliverable-guard A3 lines 55–72 (AC3, AC4); re-pin e393 line 138, prompt-state-footer lines 421/429/433/463/483 and teamwork-lite lines 100/143 to `/^# Constitution$/m` or `startsWith("# Constitution\n")` (AC5) | T-E411-01 | 15 | `test/constitution-deliverable-guard.test.mjs` `test/e393-builder-judge-core.test.mjs` `test/prompt-state-footer.test.mjs` `test/teamwork-lite.test.mjs` `test/fixtures/compose-golden/build-full-design-fd.txt` `test/fixtures/compose-golden/build-full-design.txt` `test/fixtures/compose-golden/build-full-nondesign-fd.txt` `test/fixtures/compose-golden/build-full-nondesign.txt` `test/fixtures/compose-golden/build-lite-design-fd.txt` `test/fixtures/compose-golden/build-lite-design.txt` `test/fixtures/compose-golden/build-lite-nondesign-fd.txt` `test/fixtures/compose-golden/build-lite-nondesign.txt` `test/fixtures/compose-golden/constitution-monolith.txt` `test/fixtures/compose-golden/hook-full.txt` `test/fixtures/compose-golden/hook-lite.txt` | — |
| T-E409-03 | qa-engineer: lane verification covering E409 and E411. Re-measure the four budgets and record before/after against the trial table, no cap edit (AC7). Final `node scripts/test-lock.mjs -- npm test`, `npm run build` with `dist/` clean, `npm run check:bookkeeping`, `npm audit --audit-level=high` on the last HEAD (AC8). Evidence `covers:` all five task ids | T-E409-02, T-E411-02 | 0 | — | — |
