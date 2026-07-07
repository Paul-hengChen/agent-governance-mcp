# QA Review — cut-approval-coordinator-attestation (C2-01..C2-07) — PASS

Covering report for all seven tasks in the "Cut-Approval Coordinator
Attestation (C2)" section of `tasks.md`. `qa_reports/review_C2-02.md` …
`review_C2-07.md` are pointer stubs to this file (per-id evidence-check
precedent; see backlog C3).

## Scope

QA round for `specs/cut-approval-coordinator-attestation.md` (backlog C2,
absorbs cut-approval portion of A8). Code review already **APPROVED**
(`review_reports/review_C2-01.md`, covering C2-01..C2-05,C2-07). My ticket
was C2-06 (budget-cap re-baseline, §2 test-ownership) plus final PASS
verification of spec ACs 1-10 across all seven task ids.

## C2-06 — budget re-baseline (mine)

Re-measured all four caps myself against the current working tree
(`composeConstitution` via `dist/prompts/build.js`, chars/4 estimator) before
touching anything:

| line | assertion | old cap | measured | new cap |
|---|---|---|---|---|
| L99 | AC2 lean always-on bundle | 3010 | 3030 | 3030 |
| L487 | AC8 design-arm rationale-stripped floor | 4487 | 4957 | 4957 |
| L525 | AC8 teamwork coordinator bundle floor | 8078 | 8635 | 8635 |
| L914 | AC8 non-design floor | 2403 | 2872 | 2872 |

L525 note: sr-engineer's handoff note said 8625; I independently re-measured
and got 8635 (matching the code-reviewer's independently measured figure in
`review_reports/review_C2-01.md`) — used the measured value per instruction,
not the sr-engineer note.

Each cap change is documented in `test/context-budget.test.mjs` with a
`cut-approval-coordinator-attestation (qa-owned bump, C2-06)` comment block
following the `test/context-budget.test.mjs` L497-498 "qa-owned bump"
precedent (old → new figure, reason, exact-measured-value-no-headroom
convention). Companion "saving ≥ N" assertions on L487/L914 (raw−stripped ≥
240, design-only-saving ≥ 2080) were re-checked against the new measured
values (260 and 2085 respectively) — both still hold, so left unchanged.
Test titles for the three AC8 tests were updated to the new cap number
(matching the historical convention of keeping title text in sync for those
three tests); the AC2 lean-bundle test title text was already stale before
this change (says "≤ 2700" while the cap was 3010) and is out of scope here
(no test asserts on the title string).

No new test file created (§2 test-ownership on an existing file only, per
instruction).

## Spec AC verification (all 10)

- **AC-1/AC-2** — `content/const-08-chain-31-mid.md` Cut-Approval Gate bullet
  present with trigger edge, `CUT_APPROVAL_REQUIRED`, file-mode-only scope,
  clearing condition, feature-scoped re-arm, and the S02 sanctioned-writer
  trust-rule sentence verbatim (`grep` confirmed exact string match). ✓
- **AC-3** — `content/skill-pm.md` step 8 / Gate Summary row trimmed to a
  pointer ("Full mechanism and trust rule: Constitution §3.1") + PM-specific
  content (inline-present-and-halt, design-link rule, table header) + S03
  dispatch branch present verbatim. ✓
- **AC-4** — `content/skill-coordinator.md` stop-condition 6 trimmed to a
  pointer + coordinator writer obligation + S04 self-check present verbatim. ✓
- **AC-5** — `content/skill-coordinator-lite.md` bullet trimmed to a pointer,
  lite-specific ceiling content (server-read-only, single-context-by-
  construction, halt-and-present, escalation signal) retained. ✓
- **AC-6** — `git diff --stat -- tools/ index.ts prompts/ lib/ schema/
  guards/` returns empty — zero server-code changes. ✓
- **AC-7** — 6 compose-golden fixtures regenerated (verified via `git diff
  --stat`: each +1 line, the new bullet); `node --test
  test/compose-equivalence.test.mjs` → 14/14 pass. ✓
- **AC-8** — see C2-06 above; all 4 caps re-baselined with documented
  comments. ✓
- **AC-9** — ran the full gate chain: `npm run build && npm audit
  --audit-level=high && npm test` → build clean, audit 0 (1 pre-existing low
  esbuild advisory, below `--audit-level=high` threshold), full suite 824/824
  pass, chain exit 0. Re-ran `npm test` independently 5 additional times to
  probe the flake noted below; 4/5 clean, one run reproduced an unrelated
  pre-existing flake (see Flake investigation). ✓
- **AC-10** — `docs/backlog.md`: C2 entry marked "DONE 2026-07-07" citing the
  feature/spec and mechanism (const-08 bullet + 3 skill pointer edits); A8's
  cut-approval bullet annotated "resolved via C2, 2026-07-07" with the
  "told 4×" claim corrected to the actual pre-fix count of 3; A8's
  self-converge-relaxation item explicitly left open. ✓

## Flake investigation (per handoff note)

The review handoff flagged a single unreproduced 5th test failure seen once
during the review round. I ran the full `npm test` suite 5 additional times
after the C2-06 fix (beyond the clean AC-9 run) specifically to probe this:

- Run 1-3, 5: 824/824 pass, exit 0.
- Run 4: 823/824 pass, exit 1 — failure was
  `test/handoff-write-arg-guard.test.mjs:241` ("AC-2
  (t-ac2-current-basename-rejected): workspace_path ending in .current is
  rejected"), error `must receive a response for id=30`, duration_ms ≈ 2003
  (consistent with a ~2000ms stdio/IPC timeout on a spawned
  `dist/index.js` subprocess under load).

This is **not** the C2 feature or the context-budget caps — it is a
timing-sensitive spawn/IPC test in a completely unrelated spec
(`handoff-write-arg-guard`), and `git diff --stat` confirms zero changes to
that test file or to any code it exercises (`index.ts`, `tools/`) in this
feature's diff. Confirmed pre-existing test-infrastructure flakiness (~1-in-6
observed rate across my runs plus the reviewer's one prior sighting), not a
regression introduced by C2-01..C2-07. Not blocking PASS; worth a follow-up
backlog ticket for the spawn-timeout margin in that test file (separate from
C2/C4).

## Other verification

- `test/context-budget.test.mjs` alone: 43/43 pass post-fix (0 fail, was 4
  fail pre-fix).
- Verbatim string checks for S01-S04 via `grep -n` against the spec's
  Copy/Strings table — all four present, each exactly once in their target
  file.
- Task ids C2-01..C2-07 in `tasks.md` were unchecked `[ ]` at the start of
  this round (handoff's premature `completed_tasks` list did not match
  `tasks.md`, caught by pre-flight `tw_detect_drift`); resolved by claiming
  In_Progress before verification and now closed one-by-one via
  `tw_complete_task`, per SOP (task-completion authority is qa-engineer's).
- Pre-existing 127-row tasks-ahead drift (T470...T-REG-09) is acknowledged
  baseline noise per backlog C4 — left untouched, not reconciled.

## Verdict

**PASS** — all 10 spec ACs verified, all 7 C2 task ids complete, build/audit/
test gate green, backlog updated, no server-code drift. The one intermittent
test failure observed is confirmed unrelated pre-existing infra flakiness,
not a C2 regression.
## 2026-07-07T05:58:01.739Z — PASS — by qa-engineer

PASS — all 10 spec ACs verified (specs/cut-approval-coordinator-attestation.md). C2-06 (mine): re-baselined 4 failing test/context-budget.test.mjs caps with documented qa-owned-bump comments (L99 3010->3030, L487 4487->4957, L525 8078->8635 [re-measured, confirms 8635 not sr's 8625], L914 2403->2872); no new test files. AC-1..AC-5 verbatim strings S01-S04 confirmed present exactly once each. AC-6 confirmed zero diff under tools/,index.ts,prompts/,lib/,schema/,guards/. AC-7 compose-equivalence 14/14 pass. AC-9 gate chain (npm run build && npm audit --audit-level=high && npm test) exits 0, 824/824 pass. AC-10 backlog C2 marked done + A8 annotated resolved-via-C2 with 4x->3 correction. Investigated the review's flagged intermittent 5th failure: reproduced once in 5 extra npm test runs, isolated to test/handoff-write-arg-guard.test.mjs (unrelated spec, unrelated file, stdio/IPC timeout flake, ~2000ms), confirmed pre-existing infra flakiness unrelated to C2 diff — not blocking. Evidence: qa_reports/review_C2-01.md (covering; C2-02..07 pointer stubs).

