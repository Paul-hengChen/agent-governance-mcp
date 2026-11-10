# Review — T-E255-01..06 (e255-product-prefix-cleanup)

covers: T-E255-01, T-E255-02, T-E255-03, T-E255-04, T-E255-05, T-E255-06

## Round 1 — APPROVED — by code-reviewer

Range judged: `git diff 2425e04..7816da1` (base = lane dispatch base), against
`specs/e255-product-prefix-cleanup.md` (no architecture spec; none required). The spec
commit and the `.current/e255/` state commits are PM/sr bookkeeping and were not judged
as implementation. This report never spells the token; it is called "the product-style
prefix" throughout, and the token was derived at runtime from
`.current/history/2026-09/e232/tasks.md:6` for every grep below.

## Summary
- 6 build commits, one per task, each touching exactly the files listed in its Cut row
  `touches` column (97cbf1e T-01, e5a6105 T-02, 2bde51c T-03, de6f951 T-04, e5b3f57 T-05,
  d169c27 T-06); 28 implementation files, all text, plus one pure rename.
- Every hunk is a single-line token swap matching its Reference Inventory row (C1–C6, R1–R5,
  D1–D2, S1–S22, X0–X3, E1–E11); no rule clause changes around any token.
- Ownership: `node scripts/fanout.mjs check --cut specs/fanout-backlog-wave-a.md e255
  specs/e255-product-prefix-cleanup.md` → 8 tickets, 30 tokens, 0 out of bounds; line-level
  ownership in the shared files holds (see AC1/AC8 below).
- Remainder on the reviewed tree is exactly the five expected lines (three integrator
  bookkeeping, two qa-owned fixtures for T-E255-07); 0 file names, 0 commit messages.
- Verdict: APPROVED.

## AC Completeness
Scope note: T-E255-01..06 own AC1, AC2, AC4, AC5, AC7, AC8, AC9 (and contribute to AC3).
AC6 belongs to T-E255-07 and AC10–AC12 plus the full-suite part of AC11 are judged by
T-E255-08 (qa) on the final HEAD; they are reported here as the state at 7816da1.

AC1 — implemented — `git diff -U0` hunks only at `content/skill-pm.md:30`, `content/skill-qa-engineer.md:52`, `content/skill-design-auditor.md:55`, `content/constitution-rationale.md:12,90,237`; numstat `1 1`/`1 1`/`1 1`/`3 3`; tree grep over `content/` empty. Word-diff of `content/skill-qa-engineer.md` (integrator's request): exactly one changed line, line 52, one backticked identifier swapped to `ThemeTokensTest`, rest of the line byte-identical.
AC2 — implemented — `content/skill-pm.md:30` is 232 chars at 7816da1 (236 at base).
AC3 — implemented (partial evidence, sufficient for review) — `node --test test/context-budget.test.mjs test/compose-equivalence.test.mjs test/e391-prompt-audit-stale-facts.test.mjs` all green (part of a 152/152 run); `test/context-budget.test.mjs` not in the diff. Golden regeneration not re-run by the reviewer (it requires `npm run build`); left to T-E255-08.
AC4 — implemented — `git diff -M --name-status 2425e04..7816da1 -- research/` shows one `R100` line to `research/visual-fidelity-retrospective-2026-06-05.md` (commit e5a6105); 0 tracked file names contain the token.
AC5 — implemented — the spec's AC5 citation grep, run against 7816da1, prints nothing. Historical lines in `specs/e232-leak-cleanup.md:104,107,114,222` use the `<product-style-prefix>` placeholder as sanctioned; `:107` carries the spec's "(renamed again by E255 to …)" note; `:114`'s `test -f` operand names the new path.
AC6 — not in this round (T-E255-07, qa) — the two fixture lines are the expected remainder.
AC7 — implemented — tree grep over `research/ specs/ docs/ ':!docs/backlog.md'` at 7816da1 is empty (only remainder lines are listed below).
AC8 — implemented — `CHANGELOG.md` numstat `4 4`; `-U0` hunks only at 4460, 4511, 5933, 5982. X0 keeps its substance (a visual-fidelity improvement plan, Antigravity/Gemini 3.1 Pro); X1 is a path swap; X2 a code-identifier swap; X3 a class swap.
AC9 — implemented — numstat `5 5`, `2 2`, `2 2`, `1 1`, `1 1` on the five E232 files; word-diff shows only inventory token swaps (E1–E11); no verdict, `covers:`, PASS/FAIL, APPROVED, count, sha or suite-result text moves; `npm run check:bookkeeping` exits 0.
AC10 — state at 7816da1 as expected for this round — `.current/history/2026-09/e232/tasks.md:6`, `docs/backlog.md:226`, `docs/backlog.md:1345`, plus the T-E255-07 fixtures `test/visual-evidence-gate.test.mjs:29`, `test/visual-gate-e2e.test.mjs:38`.
AC11 — partial by design (T-E255-08) — `npm run check:md-tables` OK (0 malformed), `npm run check:transitions-sync` OK (21 keys), `dist/` not in the diff; full suite is QA's.
AC12 — implemented for this range — commit messages 2425e04..7816da1: 0 hits; spec: 0 hits; `.current/e255/*`: 0 hits; this report: 0 hits.

## Correctness
No required findings. Every changed line was compared with its inventory row:
- Shipped text (C1–C6): identifier swaps (C1, C2) and class swaps (C3 "setup-wizard flow board", C5 "setup wizard", C6 "setup-wizard run") leave each rule sentence otherwise byte-identical; C4 is a live citation now resolving to the renamed file.
- Rename: `research/visual-fidelity-retrospective-2026-06-05.md` exists, similarity 100%; no live citation of the old name remains outside the excluded bookkeeping files.
- Table rows S8 (`specs/qa-flow-enforcement-architecture.md:861`), S9 (`specs/server-scope-decision-gate.md:113`), S10 (`specs/decodename-cleanup.md:41`), E4 (`qa_reports/review_T-E232-01.md:98`): pipe counts unchanged (`check:md-tables` OK); S8 sits outside the transitions table (`check:transitions-sync` OK).
- No test pins any of the replaced strings: the token grep over `test/` hits only the two T-E255-07 fixture lines; the visual-gate suites stay green before their own edit.

- optional: `review_reports/review_T-E232-01.md:6`, `review_reports/review_T-E232-05.md:14`, `review_reports/review_T-E232-08.md:13` and `qa_reports/review_T-E232-01.md:52,98` now read as if E232 produced the new file name, while `specs/e232-leak-cleanup.md:107` records the two-step history via the placeholder plus the E255 note. This is exactly what ruling 2 = a sanctions (old file name → new name, facts otherwise unchanged), and `review_reports/review_T-E232-05.md:14`'s "backlog cites … in both places" becomes true again once the integrator rewrites `docs/backlog.md:226` with the new name as the spec's Out of Scope requires. Not blocking; noted so the integrator does not skip that bookkeeping line.

## Quality
No findings. Class vocabulary is applied consistently with the spec's list ("setup wizard" / "setup-wizard" as noun vs adjective, 「設定精靈」 in the Chinese prose at `research/process-retrospective.md:1,106` and `research/mode-feature-process-retrospective.md:1`, identifier minus prefix, `<product-style-prefix>` placeholder for historical names). Commit titles carry ticket ids; one commit per task. Comment check (SOP 4b): the diff adds no code comments.

## Architecture
No architecture spec for this feature (text-only, no module). Layering unchanged; no file outside the e255 owned set is touched, and the shared files (`content/skill-qa-engineer.md`, `content/skill-pm.md`, `content/skill-design-auditor.md`, `content/constitution-rationale.md`, `CHANGELOG.md`) are touched only on their owned lines.

## Security
No findings. Information-hygiene is the point of the feature and holds: the token is absent from every changed line, every file name, every commit message in range, the spec, and the lane state files. No local path, username, or internal link is added by the diff.

## Performance
No findings. Prose-only change; `test/context-budget.test.mjs` passes with no cap edit, so no prompt-size regression.

## Verdict
APPROVED — every hunk is the spec-inventoried single-token swap on an owned line, the rename is a pure R100 with all live citations updated, the E232 evidence changes only the prefix and the old file name, and the remainder is exactly the expected bookkeeping plus T-E255-07 lines.

Reviewer note (same-model bias): sr-engineer and code-reviewer are both pinned to opus for this lane; the review leaned on mechanical proofs (word-diff, numstat, hunk positions, runtime-derived grep) rather than judgment to offset that.
