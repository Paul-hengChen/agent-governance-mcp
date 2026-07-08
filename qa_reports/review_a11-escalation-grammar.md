# QA Review — a11-escalation-grammar

covers: A11-01, A11-02, A11-03, A11-04, A11-05, A11-06, A11-07, A11-08, A11-09, A11-10, A11-11

## Summary
Content-only ticket (const-05 canonical Escalation call format + WHEN/DO/ELSE grammar, `## Escalation Routes` tables added to 7 skill files, 2 light-touch cross-reference edits to skill-pm.md/skill-qa-visual.md). code-reviewer APPROVED (`review_reports/review_a11-escalation-grammar.md`). QA independently re-verified the diff against the spec ACs, re-measured (not trusted) every context-budget cap sr-engineer/code-reviewer reported, and ran the full suite twice for stability.

**Verdict: PASS.**

## Pre-flight / drift
- `tw_get_state` → active_feature `a11-escalation-grammar`, status `In_Progress`, `completed_tasks` already listed A11-01..A11-11 (sr-engineer/code-reviewer handoff writes), `cut_approved: true`, `scope_decision: single-feature`.
- `tw_detect_drift` → drift detected: (a) `C6C11-REL, C6C11-DONE, C13-08, A13-01..A13-07` completed in tasks.md but not in handoff (pre-existing, acknowledged residue per coordinator brief — left alone); (b) `A11-01..A11-11` marked completed in handoff but `[ ]` in tasks.md (expected — `tw_complete_task` is qa-exclusive and had not run yet at drift-check time). No new/unexpected drift.

## AC verification (independent, against the live diff — not trusted from the review report)
- **AC1** (`content/const-05-core-standards.md`): exactly one canonical **Escalation call format** bullet, spec-mandated shape `tw_update_state(status=<Blocked|FAIL>, agent_id=<role>, pending_notes=["<Role>: <situation> — <detail>", "next_role: <role>"])`, cross-references `visual_fail:` / `review: APPROVED|CHANGES_REQUESTED` / `resume_of:` / `scope_decision_why` / `covers:` without redefining them. Plus one **Rule grammar (WHEN/DO/ELSE)** bullet. Confirmed via `git diff` — only these 2 bullets added, nothing else touched in the file.
- **AC2**: grepped all 7 target files (`skill-architect.md`, `skill-sr-engineer.md`, `skill-qa-engineer.md`, `skill-design-auditor.md`, `skill-code-reviewer.md`, `skill-coordinator.md`, `skill-release-engineer.md`) — each carries exactly one `## Escalation Routes` heading and one `| situation | status | note token | next_role |` table with a byte-identical header (verified via `awk`/`grep`, header string diffed across all 7 — identical). Row counts: architect 7, sr-engineer 6, qa-engineer 7, design-auditor 5, code-reviewer 4, coordinator 10, release-engineer 6 (includes header+separator rows; 31 data rows total, matching the code-reviewer manifest). Grepped for leftover inline `tw_update_state(status=Blocked...)` / `status=FAIL...)` incantations in the 7 files — zero found; remaining `tw_update_state(status=In_Progress...)`/`status=PASS...)` lines are terminal non-escalation handoffs, correctly out of AC2's scope.
- **AC3**: `git diff content/skill-pm.md` and `git diff content/skill-qa-visual.md` — each shows exactly one added cross-reference sentence; the Gate Summary table (`| gate | trigger | clearing action |`) and the error-code/STOP-route table (`| trigger | error code | STOP action |`) are byte-unchanged (no row/column edits).
- **AC4**: `npm run build` clean (tsc, zero errors). `npm test` green 938/938, run twice for stability (see below).
- **AC5**: grepped `content/*.md` for all 7 listed error-code tokens (`VISUAL_EVIDENCE_MISSING`, `MISSING_REVIEW_EVIDENCE`, `AGENT_ID_REQUIRED`, `QA_ROUND_EXCEEDED`, `REVIEW_ROUND_EXCEEDED`, `BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`) — all present verbatim across the expected files; `test/error-code-contract.test.mjs` run standalone, 13/13 pass.
- **AC6**: spot-checked the enumerated escalation sites (architect steps 2/3/4/4a/6, sr-engineer Clarification Gate/Task-Size Check/R7/split-escalation, qa-engineer Phase 2/Round-3/Copy-Audit/Visual-Audit/Phase-4, design-auditor 2a/2b, coordinator stop-conditions, release-engineer failure modes) — each now reads as a table row (situation/status/note token/next_role), the collapsed WHEN/DO/ELSE shape per the new const-05 grammar bullet.
- **AC7**: A11-12 (backlog done-mark) intentionally left for post-PASS coordinator bookkeeping, per task brief — not part of this PASS's manifest.

## Fixture / regression checks
- 11 `test/fixtures/compose-golden/*.txt` fixtures each diff by exactly +2 lines — the two new const-05 bullets, replicated per composed variant, with zero other drift (confirmed via `git diff --stat` on all 11 files and full-text diff on `constitution-monolith.txt`).
- No test source file (`.test.mjs`/`.ts`) touched by sr-engineer/code-reviewer other than `test/context-budget.test.mjs`, which is qa-owned per AC4/C2-06 — confirmed via `git status`.
- Ran the four other pinned suites standalone: `test/compose-equivalence.test.mjs`, `test/constitution-deliverable-guard.test.mjs`, `test/skill-evolution-v3.11.test.mjs`, `test/widget-shape-spec.test.mjs` — 48/48 pass together.

## A11-02: qa-owned context-budget cap re-baseline
Re-measured every cap myself against the built `dist/` (not trusted from sr-engineer's or code-reviewer's handoff notes) using `composeConstitution`/`stripRationale`/`stripOriginTags` directly — all six independently-measured values matched the reported figures exactly:

| bundle | old cap | new cap (measured) |
|---|---|---|
| lean always-on (coordinator-lite) | 3087 | **3332** |
| skill-pm stripped body | 3196 | **3225** |
| skill-sr-engineer stripped body | 2138 | **2258** |
| design-arm constitution (rationale-stripped) | 5316 | **5561** |
| teamwork coordinator bundle (design-arm) | 9106 | **9545** |
| non-design constitution | 3232 | **3477** |

Updated `test/context-budget.test.mjs` at all 6 sites with the new cap, updated test-title literals where the cap appears in the string, and added a dated `a11-escalation-grammar (qa-owned bump, A11-02)` comment block at each site naming the old→new value and the reason, per the A13-07 precedent convention.

Saving-margin assertions re-verified and still hold:
- constitution rationale+origin-tag saving: raw 5834 − stripped 5561 = 273 ~tok (≥ 240 required) — unchanged from the prior bump, since the const-05 addition sits outside both rationale fences.
- design-only strip saving: design-arm 5561 − non-design 3477 = 2084 ~tok (≥ 2080 required) — unchanged, since the const-05 addition is chain-tagged (not design-tagged) and lands on both arms equally.
- bundle-level design-vs-non-design diff (sr-engineer skill): 8113 − 5889 = 2224 ~tok (≥ 1830 required) — holds with wide margin.

## Test run
```
npm run build   → clean, zero errors
npm test        → 938/938 pass (run twice for stability; a single transient
                   failure seen mid-session on an unrelated timing-sensitive
                   hook test did not reproduce on rerun and is not attributable
                   to this diff — context-budget assertions are pure
                   deterministic file reads)
```

## Verdict
**PASS.** All A11-01..A11-11 acceptance criteria verified against the live diff (not just the code-reviewer's report). Context-budget caps independently re-measured and match reported values exactly. Build and full suite green. A11-12 (backlog done-mark) correctly deferred to post-PASS coordinator bookkeeping.
