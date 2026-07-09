covers: T-A8-01, T-A8-02

# Review — T-A8-01, T-A8-02 (review task T-A8-04)

## Round 1 — APPROVED — by code-reviewer

## Summary
- Single-owner dedup applied to `content/skill-sr-engineer.md` only (1 file, 2 lines net): self-converge relaxation restatement and Design-baseline scope restatement each collapsed to a pointer.
- Fix 1: the QA-independent-verification qualifier and the MAY-fix-in-one-pass permission are no longer restated as full clauses; replaced by a pointer to Constitution §1 self-converge relaxation (v3.31.0). Render-harness sentence kept verbatim.
- Fix 2: Design-baseline scope clause trimmed to "See Constitution §1 Design-baseline scope (v3.27.0) — full definition there."; origin tags around the version number preserved.
- Zero `content/const-*.md` edits, zero test-file edits (git working tree touches only skill-sr-engineer.md + governance state files handoff.md/tasks.md).
- Suite verified green directly: `npm run build` clean, `npm test` 1035/1035 pass, 0 fail. No expected-red manifest filed — consistent with C15 (absence = zero expected reds).

## Correctness
No findings.
- Both pointers resolve to real owners carrying the named full definitions:
  - Fix 1 → `content/const-04-design-surgical.md:2` "Self-converge relaxation (v3.31.0)" — contains the removed MAY-fix permission verbatim-equivalent ("sr MAY fix all VSA-detected structural deviations in a single pass, not restricted to one property per round-trip"), the QA-independent-verification qualifier ("(b) the QA gate still independently verifies every VSA row at PASS"), and builder ≠ judge ("(c) … builder ≠ judge"). No semantic loss.
  - Fix 2 → `content/const-02-design-mvp.md:3` "Design-baseline scope (v3.27.0)" — contains the removed clause equivalent ("the canonical design (Figma node or equivalent) is the scope baseline … Omitting a design-present element is a fidelity defect, not MVP compliance"). No semantic loss.
- Residual-clause grep on the skill file returns zero hits for "MAY fix all VSA-detected deviations in one pass" and "the canonical design is the scope baseline" — the restated qualifiers are fully removed from the non-owner.

## Quality
No findings.
- Origin-tag balance intact: 9 `origin:start` / 9 `origin:end`, 3 `rationale:start` / 3 `rationale:end`. No orphaned tags. Fix 2's `<!-- origin:start --> (v3.27.0)<!-- origin:end -->` wrapper preserved exactly.
- Descoped items untouched: Visual Widgets exception sentence, `visual_round >= 3` split-escalation sentence, and the Design-sourced assets line (L27, not in diff) all unchanged.
- The "Whole-surface self-converge loop" heading and its five lettered steps (a)-(e) are byte-identical across the diff — only trailing restated sentences touched (AC4 satisfied).

## Architecture
No findings. No `specs/a8-single-owner-dedup-architecture.md` present. The change is confined outside `composeConstitution()` output (skill file only), so it cannot affect the compose-equivalence golden fixture or full-bundle token caps; it correctly honors the single-owner principle (full definition in one const doc, pointer elsewhere).

## Security
No findings. Documentation-only change; no trust boundary, input handling, or secret involved.

## Performance
No findings. Text shrinks only; the skill-sr-engineer token ceiling gains margin, never regresses. No runtime code path touched.

## Verdict
APPROVED — both dedup fixes point to real owners that retain every removed qualifier verbatim-or-equivalent; zero const/test edits; descoped items untouched; suite green 1035/1035. Matches AC1–AC5.
