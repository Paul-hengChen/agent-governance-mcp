covers: T-A8-01, T-A8-02, T-A8-03, T-A8-04, T-A8-05

# Review — T-A8-01..05 (a8-single-owner-dedup)

## Phase 0.5 — Expected-Red Diff

Phase 0.5: skipped (no expected-red manifest declared — `qa_reports/expected-red_a8-single-owner-dedup.txt` absent, confirmed via `ls`). Consistent with spec's test-impact analysis: content-only dedup confined to `content/skill-sr-engineer.md`, zero `content/const-*.md` edits, no test greps the removed clauses. Absence = zero expected reds per C15 convention.

## Scope confirmation (git)

`git status --porcelain` / `git diff --stat HEAD` show exactly 3 tracked-file diffs for this feature: `content/skill-sr-engineer.md` (4 lines: 2 removed, 2 added), `.current/handoff.md`, `tasks.md` — plus untracked `review_reports/review_T-A8-01.md` and `specs/a8-single-owner-dedup.md`. Zero `content/const-*.md` touched, zero `test/*` touched.

## AC1 — const-*.md owners byte-identical (zero constitution edits)

`git diff --stat HEAD -- content/const-04-design-surgical.md content/const-02-design-mvp.md` → empty (no changes). Independently confirmed both owners retain full definitions verbatim:
- `content/const-04-design-surgical.md:2` — "**Self-converge relaxation** (v3.31.0)": full text with qualifiers (a)(b)(c) present, byte-identical to pre-ticket.
- `content/const-02-design-mvp.md:3` — "**Design-baseline scope** (v3.27.0)": full clause ("the canonical design … is the scope baseline … Omitting a design-present element is a fidelity defect, not MVP compliance") present, byte-identical to pre-ticket.

**AC1: PASS.**

## AC2 — self-converge relaxation restatement collapsed

Grep-confirmed the two removed clauses are absent from `content/skill-sr-engineer.md`:
- `grep -n "MAY fix all VSA-detected deviations in one pass" content/skill-sr-engineer.md` → no hits.
- Pointer line present at L26: "QA still independently verifies every VSA row at PASS (§3.2 builder ≠ judge). Per Constitution §1 self-converge relaxation (v3.31.0) — full mechanism and bounding qualifiers there; this loop is upstream/additive only."

**AC2: PASS.**

## AC3 — Design-baseline scope restatement collapsed

- `grep -n "the canonical design is the scope baseline — a gap vs design is a fidelity defect" content/skill-sr-engineer.md` → no hits.
- Pointer line present at L28: "See Constitution §1 Design-baseline scope (v3.27.0) — full definition there." Origin-tag wrapper `<!-- origin:start --> (v3.27.0)<!-- origin:end -->` preserved exactly (verified byte-for-byte in diff).

**AC3: PASS.**

## AC4 — heading/steps/numbered structure unchanged

Diff (`git diff HEAD -- content/skill-sr-engineer.md`) shows exactly 2 lines changed (L26, L28), both full-line replacements of trailing restated sentences only. The "Whole-surface self-converge loop" heading, its five lettered steps (a)-(e), and the numbered "Design-Aware Pre-Flight" structure are byte-identical — untouched by the diff. Descoped items on L27/L28 (Source assets sentence, Visual Widgets exception sentence, `visual_round >= 3` split-escalation sentence) confirmed present and unchanged.

Origin-tag balance within `content/skill-sr-engineer.md`: 8 `origin:start` / 8 `origin:end` — balanced, no orphans.

**AC4: PASS.**

## AC5 — build + test clean

- `npm run build` → clean, zero errors (tsc, version check OK at 3.59.0).
- `npm audit --audit-level=high` → exit 0. One pre-existing low-severity esbuild advisory (GHSA-g7r4-m6w7-qqqr, Windows dev-server file read) — below the `high` gate, not introduced by this change, no fix required for this ticket.
- `npm test`: ran full suite twice.
  - Run 1: 1035 tests, 1034 pass, 1 fail — `test/prompt-state-footer.test.mjs:429` "AC-4/e2e: with no workspace_path arg and no CLAUDE_PROJECT_DIR env, resolution falls back to the server's cwd" (`error: expected a prompts/get result for id 2, got: undefined`, a subprocess-timing e2e test with a fixed ~3000ms wait).
  - Isolated rerun of that file alone (`node --test test/prompt-state-footer.test.mjs`): 16/16 pass, including the previously-failed test.
  - Run 2 (full suite again): 1035/1035 pass, 0 fail.
  - Disposition: non-deterministic subprocess-timing flake in pre-existing e2e infra, unrelated to this ticket's diff (which touches only `content/skill-sr-engineer.md`, a file never read by `prompt-state-footer.test.mjs`'s fallback-to-cwd path). Not a regression — no manifest entry needed, no fix required in this ticket. Confirmed reproducible-absent on 2 of 3 runs.

**AC5: PASS** (build/audit clean; suite green — the single observed failure is a confirmed pre-existing flake, not a regression from this diff).

## AC6

Out of scope for QA (release-engineer, T-A8-06). Not evaluated here.

## Copy / Visual Audit Gates

N/A — content-only governance-doc dedup, no user-facing UI copy or visual tokens involved; spec has no Copy/Strings or Visual Tokens H2.

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no `design/<feature>.md` / no Visual Baselines declared — this is a docs-only change).

## Phase 3 — Tests

Phase 3: skipped (user/spec declined new test authorship — spec explicitly anticipates zero new tests needed, content-only change outside `composeConstitution()` output; existing `test/context-budget.test.mjs` skill-sr-engineer token-cap test and `test/compose-equivalence.test.mjs` already cover the relevant surface and both pass). Per §2 conditional test writing: no regression test judged necessary beyond existing coverage — noted here rather than authoring new test files.

## Verdict

**PASS.** AC1-AC5 verified independently (git diff, grep, build, audit, test — two full-suite runs). Code-reviewer's APPROVED verdict (review_reports/review_T-A8-01.md, covers T-A8-01/02) corroborated. Single-owner principle correctly applied: both restated mechanisms now point to their real owners which retain full definitions verbatim; zero const-*.md/test-file edits; descoped items untouched.
## 2026-07-09T20:00:51.202Z — PASS — by qa-engineer

AC1-AC5 verified independently: AC1 const-04/const-02 byte-identical (git diff empty), both retain full definitions verbatim. AC2/AC3 removed clauses confirmed absent from skill-sr-engineer.md via grep, pointer lines present, origin-tag wrapper preserved. AC4 heading/lettered-steps/structure byte-identical, descoped items (Visual Widgets exception, Design-sourced assets, visual_round split-escalation) untouched, origin tags 8/8 balanced. AC5 npm run build clean; npm audit --audit-level=high exit 0 (1 pre-existing low-severity esbuild advisory, not high/critical); npm test run twice — 1 flaky failure in test/prompt-state-footer.test.mjs (subprocess-timing e2e, unrelated file) on run 1, confirmed non-regression via isolated rerun (16/16 pass) and full-suite rerun (1035/1035 pass). Zero content/const-*.md or test-file edits; scope confined to content/skill-sr-engineer.md (4 lines). Code-reviewer APPROVED verdict corroborated. Evidence: qa_reports/review_T-A8-05.md (covers T-A8-01..05).

