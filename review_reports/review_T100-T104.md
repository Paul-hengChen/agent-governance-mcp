# Code review — T100-T104 (Batch A: constitution + skill SOPs)

## Round 1 — APPROVED — by code-reviewer

## Summary

- Five files modified — `content/constitution.md` (T100), `content/skill-pm.md` (T101), `content/skill-design-auditor.md` (T102), `content/skill-architect.md` (T103), `content/skill-sr-engineer.md` (T104).
- All changes are additive markdown clauses; no code, no schema, no test impact.
- Scope conforms to `specs/pixel-perfect-fixes-v3.14.md` AC-1, AC-2, AC-3, AC-4, AC-7, AC-8, AC-9.
- Backwards-compat clauses present everywhere a new gate is introduced (non-UI workspaces unaffected).
- Verdict: APPROVED for Batch A.

## Correctness

- `content/constitution.md:18`: §1 Visual Widgets exception is correctly nested under **MVP strict** as a sub-bullet, scoped only to widgets listed in spec `## Visual Widgets`. Widgets absent from the section still follow default MVP — explicit and surgical. ✓
- `content/constitution.md:44`: §3.1 visual evidence gate cites the exact filesystem contract (`qa_reports/visual_<task-id>.md`) and names a server error code (`VISUAL_EVIDENCE_MISSING`) that the architecture spec reserves. ✓
- `content/constitution.md:47`: `visual_round` clause states cap 5 / Round 6 lock; the architecture sets `VISUAL_ROUND_CAP = 6` per the same off-by-one pattern as `ROUND_CAP = 4` (3 FAILs → Round 4 lock). Consistent with existing convention. ✓
- `content/constitution.md:48`: split escalation specifies `visual_round >= 3` and `pending_notes` token `visual_split_requested:`. Both are server-readable strings that map cleanly to the existing pending_notes-based circuit-breaker pattern. ✓
- `content/constitution.md:57-66`: §4 chain diagram updates the feedback-loop arrow to span both qa_round (1-3) and visual_round (1-5). The textual paragraph clarifies that `visual_round` only ticks on `pending_notes: visual_fail:` and only when design baselines exist — preventing accidental bumps on test-logic FAILs. ✓
- `content/skill-pm.md:20`: Visual Widgets schema row mandates `N/A | — | …` for no-widget features rather than omitting the section. This makes absence explicit (and verifiable by T109 lint test). ✓
- `content/skill-design-auditor.md:21`: design-auditor instructed to produce the table FIRST (`design/<feature>.md`), PM copies verbatim — correct source-of-truth ordering. ✓
- `content/skill-design-auditor.md:48-55`: widget-shape heuristics table covers 8 known cases plus an explicit out-of-scope clause (restyled primitives = Visual Token, not Widget). Heuristic list is non-exhaustive but practical. ✓
- `content/skill-architect.md:17-23`: Visual Harness section MANDATORY-when-design-exists and OMIT-otherwise — matches backwards-compat AC-13. The 6 sub-fields (runner / viewport / diff lib / CI / font / task ordering) are concrete enough for sr-engineer to implement without ambiguity. ✓
- `content/skill-architect.md:32`: Gate 4a checks task-list (not just architecture text), preventing the gap where harness was specced but no task existed. ✓
- `content/skill-sr-engineer.md:11-15`: Phase 0.5 (numbered `3a`) sits AFTER Task-Size Check — fail-fast on size before reading design files. Skip-on-no-design is explicit (non-UI work unaffected). ✓
- `content/skill-sr-engineer.md:15`: split escalation reference cites `visual_round >= 3` and the exact `pending_notes` token. Matches Constitution §3.1. ✓

## Quality

- All five files cite the version literal `v3.14.0` exactly — no version drift.
- New sub-bullets nest consistently (constitution §1 uses sub-bullet under MVP strict; skill-architect uses sub-list under Visual Harness). Convention matches existing nested rules.
- `content/skill-sr-engineer.md` uses `3a.` and `content/skill-architect.md` uses `4a.` — non-standard mid-sequence numbering, but symmetric to each other and intentional (preserves existing `5/6/7` numbering for backwards-compat). Acceptable convention.
- No dead text. No paraphrasing of existing rules. No restated constitution clauses inside skills (Constitution §1 banned "skills MUST NOT restate" — verified compliant).
- `content/skill-design-auditor.md:48` heuristics table includes "verify with PM" tag for uncertain matches — defensive design, won't silently swallow ambiguity.

## Architecture

- All changes conform to `specs/pixel-perfect-fixes-v3.14-architecture.md` §Affected Files Skills section.
- §Decision Records row "widget-shape verification parsing strategy" notes R6 server enforcement is intentionally downgraded to SOP-level — Batch A correctly reflects this by NOT adding any server check for widget contents; only file existence is gated (deferred to T107).
- Cross-references between files are consistent: §1 exception ↔ skill-pm Visual Widgets cross-ref ↔ skill-sr-engineer Phase 0.5 ↔ skill-design-auditor heuristics. The "PM-declared widget shape is the contract" loop closes cleanly.
- No premature implementation: T106/T107 server code is correctly NOT in this batch; the skill clauses describe behaviour that will be enforced by code added later.

## Security

- No code changes → no new injection / auth / secret-handling surface.
- New filesystem paths referenced (`design/<active_feature>.md`, `qa_reports/visual_<task-id>.md`) are workspace-relative and follow existing path-sanitisation conventions used by `tools/evidence-file.ts`.

## Performance

- No code paths added in this batch. Skill SOPs add Read steps to sr-engineer (Phase 0.5) and design-auditor (Widget heuristics) — these are LLM context costs, not server CPU.
- Phase 0.5 Read of `design/<active_feature>.md` is gated on file existence — non-UI workspaces pay zero overhead, matching the lazy-load principle behind v3.8.3 skill-qa-visual split.
- No O(n²), no unbatched I/O, no memory leaks (no code).

## Verdict

**APPROVED.** Batch A is well-scoped, surgical, backwards-compatible, and faithfully implements the corresponding ACs from `specs/pixel-perfect-fixes-v3.14.md` (AC-1, AC-2, AC-3, AC-4, AC-7, AC-8, AC-9 — skill/constitution portions). Server-side enforcement (AC-5, AC-6, AC-10, AC-11) is correctly deferred to T106-T107. Hand off to qa-engineer per chain — but note: this batch carries no code paths; qa should defer test work to the T109 task once T106-T107 ship the implementation that those tests will exercise.

**Recommendation to coordinator**: rather than hop qa-engineer for a no-op pass on a markdown-only batch, route directly back to sr-engineer for Batch B (T105 + T106) to conserve the 10-hop budget. QA's actual work lives at T109.

— @code-reviewer
