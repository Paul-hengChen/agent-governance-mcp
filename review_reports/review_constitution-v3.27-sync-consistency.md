# Review — constitution-v3.27-sync-consistency

> Reviewer: code-reviewer (opus) · Round 2 (post prior-FALSE-PASS correction)
> Method: **file-grounded only** — verdict derived from `git diff` + Read of source-of-truth files, NOT from spec/blueprint/sr-engineer report.
> Date: 2026-06-08

## Summary

- Scope this round is **markdown-only**. Working-tree (unstaged) changes are exactly: `content/constitution.md` (review target), plus state bookkeeping (`.current/handoff.md`, `tasks.md`). Skill changes (`skill-sr-engineer.md`, `skill-design-auditor.md`) are staged. Verified via `git diff --stat`.
- All 7 spec ACs (A1–A4, B1–B3) + AC-SKILLS verified against the **actual diff hunks** and the upstream code literals they document.
- **A2 (highest risk) PASSES char-for-char**: the 6 section names in `content/constitution.md:47` equal `tools/evidence-file.ts:342-349` `REQUIRED_VISUAL_SECTIONS` exactly (order + spelling). Error codes match `index.ts:850` / `index.ts:824` and appear in BOTH §3.1 and §4.
- §1 integrity intact: B1 and B2 edited §1 without corrupting each other; original Terse rule + Visual Widgets exception preserved verbatim.
- Surgical: `tools/transitions.ts`, `index.ts`, and test files have **zero working-tree change** this round (staged prior-A5 artifacts only). No test files authored by this round's sr-engineer.
- Verdict: **APPROVED**.

## Correctness

Each AC verified against the literal diff hunk / file Read:

- **A1** `content/constitution.md:31` — pre-flight parenthetical now `(tw_update_state, tw_complete_task, tw_rollback_task, tw_add_task, tw_sync)`; `:34` appends `tw_sync is the only sanctioned ledger→tasks.md reconcile operation (mirrors handoff.completed_tasks onto tasks.md; never promotes a tasks.md-only [x]).` Both halves of AC-A1 satisfied. PASS.
- **A2** `content/constitution.md:47` (§3.1 new bullet) — documents `VISUAL_REPORT_INCOMPLETE` (v3.26.0) and `VISUAL_ASSERTIONS_REQUIRED` (v3.27.0). Required sections listed verbatim: `Widget Shape Verification, Canonical State Verification, Structural Assertions, Region Diff, Allowed Differences, Verdict`.
  - Compared char-for-char to `tools/evidence-file.ts:342-349`: identical strings, identical order. PASS.
  - `VISUAL_REPORT_INCOMPLETE` matches `index.ts:850`; `VISUAL_ASSERTIONS_REQUIRED` matches `index.ts:824`. PASS.
  - Both codes also appear in §4 at `content/constitution.md:109-110` (cross-ref sentence). AC-A2 "both sections" requirement satisfied. PASS.
- **A3** `content/constitution.md:1` — `# Constitution v3.27.0 <!-- versioned independently of package.json; tracks the highest behavior the document describes; check-version.mjs does NOT read this header -->`. Version + independent-semver note present. PASS.
- **A4** `content/constitution.md:71` (§3.2) — old phrase "authored under the qa chain" is GONE; exact replacement string "accepted and owned by the qa chain at PASS time (server validates report schema, not file authorship)" present verbatim. PASS.
- **B1** `content/constitution.md:13` — carve-out appended in-place to the Terse bullet: "The word cap does NOT apply when surfacing a blocker, flagging an assumption gap (§7), or stating acceptance criteria." Original "Default chat replies ≤ 15 words. Skills MAY override (e.g. PM = 1 sentence)." intact. PASS.
- **B2** `content/constitution.md:17` — new sub-bullet under MVP strict, immediately after the (intact) Visual Widgets exception at `:16`: "Design-baseline scope (v3.27.0): For design-backed work, the canonical design (Figma node or equivalent) is the scope baseline — not the lossy prose transcription in the spec. Omitting a design-present element is a fidelity defect, not MVP compliance; flag the gap per §7, never drop silently." Matches spec CONST-B2-BASELINE. PASS.
- **B3** `## Document Priority` — inter-document line `content/constitution.md:145-146` ("Workspace `.antigravityrules` / `CLAUDE.md` > Constitution > Skill > Templates. Higher-priority document wins on conflict.") UNCHANGED. Added `:148` intra-constitution tie-breaker ("safety/correctness rules (§2, §3, §6, §7) override efficiency/style rules (§1)") and `:150` circuit-breaker escape ("When §5 anti-loop trips … hand back Blocked/FAIL … Never issue an error-laden PASS; never extend the loop."). Both AC-B3 clauses satisfied. PASS.
- **AC-SKILLS** — `content/skill-sr-engineer.md:26` carries "See Constitution §1 Design-baseline scope (v3.27.0): the canonical design is the scope baseline — a gap vs design is a fidelity defect, not MVP compliance." `content/skill-design-auditor.md:17` carries "Design = scope baseline (Constitution §1, v3.27.0): … (Forward-ref only; see the constitution rule.)" Both are forward-references (point at §1), NOT restatements of the full rule — consistent with constitution line 4 prohibition. B2 (the referenced rule) now exists, so the forward-refs are valid. Neither coordinator nor qa-engineer skill files modified. PASS.

## Quality

- Minor (non-blocking): at `content/constitution.md:71` the A4 replacement introduces "(server validates report schema, not file authorship)" immediately followed by "… not the coordinator. The server validates that the report SCHEMA is complete …" — the phrase "server validates … schema" now appears in two adjacent clauses. Reads slightly redundant but is grammatically correct, factually accurate, and matches the spec's exact mandated replacement string. No change required; flagged for awareness only.
- No reformatting of untouched bullets; indentation of the new B2 sub-bullet matches the sibling Visual Widgets exception.

## Architecture

- Matches architecture spec intent: doc-only / reasoning-rule changes, no server-code re-implementation. A2 documents already-shipped behavior; the literals were copied from `evidence-file.ts` / `index.ts`, not re-defined. B2/B3 are correctly placed as prompt-advisory reasoning rules (§1 and `## Document Priority`), consistent with the PM's "DECIDED: prompt-advisory" resolution. PASS.
- Skill forward-ref placement respects the constitution-line-4 "skills MUST NOT restate" boundary. PASS.

## Security

- No code paths touched. No injection vectors, secrets, or boundary changes. N/A for a markdown governance edit.

## Performance

- No code changed; no algorithmic surface. No regression possible.

## Scope / Surgical (§1) audit

- This round's working-tree diff (`git diff --stat`): `content/constitution.md`, `.current/handoff.md`, `tasks.md` only.
- `tools/transitions.ts`, `index.ts`, `test/qa-flow.test.mjs`, `test/skill-evolution-v3.11.test.mjs` show as `M ` (staged) but have **empty `git diff` (working tree)** — they are prior-round A5 artifacts in the index, NOT re-touched by this round's sr-engineer. Confirmed via `git diff --stat <those paths>` returning empty.
- No test files authored or modified by this round's sr-engineer (§2 satisfied for this round). PASS.

## Verdict

**APPROVED** — all 7 ACs + skill propagation verified char-for-char against the real `git diff` and the upstream code literals (`evidence-file.ts:342-349`, `index.ts:824`/`:850`); A2 verbatim match confirmed; §1 dual-edit non-corruption confirmed; surgical scope holds. Verified via git diff and file Reads, NOT via spec/blueprint/sr-engineer report.
