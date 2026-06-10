# Spec: visual-selfconverge

Feature id: `visual-selfconverge` | Order 0 in `.current/feature-split.md`
Non-design governance feature — no Figma source, no design-auditor ran, visual-evidence gate not armed.

---

## Problem Statement

In the CDE-OOBE "Language" run, 55.6% of all measured tokens were spent on four cross-context sr-engineer ↔ qa-engineer visual rework rounds instead of first-build work (`research/process-retrospective.md`). Three compounding root causes drove this: (a) defect layering — outer geometry displacement masked inner defects so each layer required its own cross-context round to become visible; (b) lossy spec geometry — exact per-element measurements were never pinned into the VSA table, so sr approximated from prose instead of numbers; (c) coordinator framed each sr dispatch too narrowly (one fix per round), trading safety for guaranteed multi-round overhead. The existing governance (§3.2 per-region verdict authority, the §3.1 visual-round circuit breaker, and the QA gate) correctly caught every defect — the waste was upstream: sr handed off before the defects were visible in-context. This feature bundles five tightly-coupled changes: (1) extending sr-engineer's Scoped Render Self-Check to the whole surface with in-context region-diff + structural-assertion looping before handoff; (2) a bounded §1 "surgical" relaxation that permits sr to fix all VSA-detected structural deviations in one loop pass instead of one per round; (3) a shared reusable region-measure harness so sr's self-check and QA's verdict run identical measurements; (4) a design-time geometric-density split gate catching a single surface with layered geometry defects (distinct from state-count); (5) structured observability for subagent token telemetry so future retrospectives have high-confidence cost data.

---

## User Stories

- As an sr-engineer, I want to run QA's region-diff and structural-assertion checks in-context against every VSA row on the full surface before handing off, so that I converge on visual correctness within a single dispatch instead of requiring 4 cross-context QA round-trips.
- As a coordinator, I want a geometric-density split gate to fire at design time when a single surface has layered geometry defects, so that I split it into sub-tasks before build rather than absorbing avoidable visual rounds.
- As a qa-engineer, I want sr to use the same region-measure harness I use, so that my structural numbers and sr's self-check numbers are identical and I spend review time on verdict, not re-measurement.
- As a coordinator/PM, I want structured subagent token telemetry (input / output / cache fields) readable from `agent-*.jsonl`, so that future retrospectives yield high-confidence cost data rather than estimates with unknown denominator.

---

## Acceptance Criteria

### AC-1: Whole-surface self-converge loop in sr-engineer (CORE — skill-sr-engineer.md)

Given `design/<feature>.md` exists with `## Visual Baselines` and `## Visual Structural Assertions`,
When sr-engineer completes implementation of any surface (not just a widget),
Then `content/skill-sr-engineer.md` SOP step 3a item 5 (Scoped Render Self-Check) MUST contain a clause requiring sr to:
  (a) screenshot the full rendered surface (not only the changed widget) to the declared `impl path`,
  (b) read both baseline and impl images into context,
  (c) run region-diff (equivalent to qa-visual Step B) over every declared `compare region`,
  (d) run structural-assertion checks (equivalent to qa-visual Step C) against every VSA row,
  (e) iterate in-context until ALL VSA rows pass,
BEFORE writing `tw_update_state(status=In_Progress, pending_notes=["sr-engineer: ... ready for code review"])`.

Testable: `grep -c "whole-surface\|all VSA rows\|self-converge" content/skill-sr-engineer.md` returns ≥ 1; the clause is under the Scoped Render Self-Check section (H3 or equivalent bullet).

### AC-2: Bounded §1 surgical relaxation (CORE — constitution.md + skill-sr-engineer.md)

Given sr-engineer is executing the whole-surface self-converge loop defined in AC-1,
When that loop detects multiple VSA structural deviations in a single pass,
Then `content/constitution.md` §1 (Output Directives) MUST contain a bounded exception clause stating that, inside the sr self-converge loop ONLY, sr may fix all VSA-detected structural deviations at once (not restricted to one property per round-trip).
The clause MUST explicitly state: (a) scope is the pre-handoff self-converge loop only; (b) the QA gate still independently verifies all VSA rows; (c) §3.2 (no global-frame metric, qa-owned verdict) is unchanged.

Testable: `grep -n "self-converge\|pre-handoff loop" content/constitution.md` returns ≥ 1 hit in §1. The phrase "§3.2 unchanged" or equivalent qualifier MUST appear in the same paragraph or be linked by a cross-reference comment.

### AC-3: Relaxation is scoped — §3.2 not weakened

Given the AC-2 clause is added to constitution.md,
When qa-engineer reads §3.2,
Then §3.2's "No global-frame metric" rule, "Visual verdict is qa-visual-owned" rule, and "Builder ≠ judge" rule MUST remain word-for-word identical to the v3.27.0 text.

Testable: `git diff HEAD content/constitution.md | grep "^-" | grep -E "global-frame|qa-visual-owned|builder.*judge"` returns 0 deleted lines from §3.2.

### AC-4: Shared region-measure harness (architect Visual Harness — skill-architect.md)

Given a feature with `design/<feature>.md` containing `## Visual Baselines`,
When architect writes `specs/<feature>-architecture.md`,
Then `content/skill-architect.md` Visual Harness section MUST require that the harness emits per-region structural numbers (not only a pass/fail boolean or a whole-frame pixel ratio) for every `compare region` declared in `## Visual Baselines`, AND that the same harness output format is consumed by both sr-engineer self-check and qa-engineer verdict.

Testable: `grep -c "per-region\|structural numbers\|shared.*harness\|harness.*shared" content/skill-architect.md` returns ≥ 1 within the Visual Harness section.

### AC-5: Geometric-density split gate (skill-pm.md or skill-design-auditor.md)

Given a design surface where the geometry is layered/dense (multiple stacked container constraints, asymmetric padding, nested components with independent fill rules) even if the canonical state count is low (< 8 states),
When PM or design-auditor evaluates whether to split a feature,
Then a "geometric-density split gate" clause MUST exist in `content/skill-pm.md` (or `content/skill-design-auditor.md`) that:
  (a) defines geometric density as distinct from state-count (density = number of independently-constrained geometric layers on a single surface, not number of canonical states),
  (b) states a density threshold (suggested: ≥ 3 independently-constrained geometry layers on one surface),
  (c) requires PM or design-auditor to recommend a sub-task split when the threshold is met.

Testable: `grep -c "geometric.density\|geometry.*density\|density.*split" content/skill-pm.md content/skill-design-auditor.md` returns ≥ 1. The clause MUST NOT alter the existing state-count split threshold (8–10 states).

### AC-6: Subagent token observability (skill-coordinator.md or coordinator SOP)

Given a coordinator retrospective or post-feature cost review,
When the coordinator reads the observability section of `content/skill-coordinator.md`,
Then a clause MUST exist stating that `agent-*.jsonl` files in the workspace MAY be read to extract `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, and `usage.cache_creation_input_tokens` per dispatch, and that these fields (not `subagent_tokens` alone) are the canonical source for cost attribution.

Testable: `grep -c "agent-.*jsonl\|input_tokens\|cache_read_input_tokens" content/skill-coordinator.md` returns ≥ 2.

### AC-7: No regression to existing tests

Given all changes above,
When `npm test` is run,
Then ALL existing tests pass with zero failures. (The new governance clauses are prompt-document changes; no new test infrastructure is required unless sr-engineer self-check loop changes are mirrored in server-side evidence validation — see Out of Scope.)

---

## Copy / Strings

N/A — This feature modifies governance prompt documents (`constitution.md`, `skill-*.md`) and possibly server logic. It introduces no user-facing UI strings. The governance text is authored-here by design (internal tooling, no external copy source).

---

## Visual Tokens

N/A — This feature changes governance documents and server-side gate logic, not a rendered UI. No hex colors, font sizes, spacing literals, or radii are introduced.

---

## Visual Widgets

N/A — This feature does not render any UI surface. No non-primitive widgets are involved. The `skill-*.md` files are plain Markdown prompt documents loaded into agent context, not rendered HTML/native components.

---

## Visual Structural Assertions

N/A — No design file exists (`mode: no-design`). The visual-evidence gate is not armed. This feature has no Figma source, no `design/visual-selfconverge.md`, and no `## Visual Baselines` section. Visual governance sections are not applicable.

---

## Out of Scope

- Weakening §3.2 (no-global-frame metric, qa-owned verdict, builder ≠ judge) — explicitly excluded; §3.2 must remain unchanged (see AC-3).
- Server-side enforcement of the sr self-converge loop (e.g., blocking handoff until a self-check report is attached) — the loop is prompt-governed only in v1; server enforcement is a future hardening.
- Changes to the `visual_round` circuit breaker thresholds — thresholds remain at 5 rounds with Round-3 split escalation.
- Changes to the QA evidence gate schema (`qa_reports/visual_<task-id>.md` required sections) — QA retains its full independent verification.
- Modifying the state-count split threshold (8–10 states) — the geometric-density gate is additive, not a replacement.
- Token-budget gate or governance-text-load trimming — those are features `token-budget-gate` (order 2) and `governance-text-load` (order 1) in the feature-split plan.
- Automated parsing of `agent-*.jsonl` (a script or MCP tool) — AC-6 requires only a skill-level procedure clause; tooling is deferred.

---

## Dependencies / Prerequisites

- No blocking external dependencies. All source artifacts are local governance documents already read.
- Resource audit: all references in the brief are local files (`research/process-retrospective.md`, `content/constitution.md`, `content/skill-*.md`). No external URLs, no Figma links, no ticket IDs — zero fetch/index actions required.
- Drift status: `tw_detect_drift` at session start reported 35 historical tasks (T471–T-SCOPE-QA) completed in `tasks.md` but not reflected in handoff state — benign prior-release bookkeeping drift, all shipped per `git log`. No reconciliation required before this feature.
- The visual-evidence gate, scope-decision gate, and visual-round counter are all non-armed for this feature (no design file, no `## Mode` ≠ `no-design`).
- Architect must confirm whether the AC-4 harness change requires a new interface in `tools/evidence-file.ts` or `content/skill-architect.md` only; if a server-side interface is added, a version bump (minor) is needed. If prompt-document only, no version bump is required.
- `content/skill-coordinator.md` must be read before AC-6 is implemented to confirm the existing observability / retrospective section (if any) to avoid duplication.

---

## Tasks

```
- [ ] T-VSC-01 [P0] Extend content/skill-sr-engineer.md Scoped Render Self-Check (v3.26.0 R5) from per-widget to whole-surface: add self-converge loop clause requiring sr to (a) screenshot full surface to impl path, (b) read baseline+impl in context, (c) run region-diff over all compare regions, (d) run VSA structural-assertion checks, (e) iterate until all VSA rows pass — BEFORE handoff. | depends_on: none
- [ ] T-VSC-02 [P0] Add bounded §1 surgical relaxation to content/constitution.md: inside the sr self-converge loop only, sr may fix all VSA-detected structural deviations at once; add explicit scope qualifiers (pre-handoff loop only; QA gate independent; §3.2 unchanged). | depends_on: T-VSC-01
- [ ] T-VSC-03 [P1] Extend content/skill-architect.md Visual Harness section: require harness to emit per-region structural numbers (not only pass/fail or whole-frame ratio) for every compare region, consumed by both sr self-check and qa verdict. | depends_on: T-VSC-01
- [ ] T-VSC-04 [P1] Add geometric-density split gate to content/skill-pm.md (step 2a): define density (≥3 independently-constrained geometry layers on one surface), add split recommendation clause, make explicit that density ≠ state-count and does not alter existing 8–10 state threshold. | depends_on: none
- [ ] T-VSC-05 [P1] Add corresponding geometric-density awareness to content/skill-design-auditor.md: when auditing, flag surfaces with ≥3 independently-constrained geometry layers and recommend PM split gate. | depends_on: T-VSC-04
- [ ] T-VSC-06 [P2] Add subagent token observability clause to content/skill-coordinator.md: document that agent-*.jsonl usage.input_tokens / usage.output_tokens / usage.cache_read_input_tokens / usage.cache_creation_input_tokens are the canonical per-dispatch cost fields; cite as the correct telemetry source for retrospectives. | depends_on: none
- [ ] T-VSC-07 [P1] QA: run npm test — confirm all existing tests pass with zero failures after T-VSC-01 through T-VSC-06 prompt-document changes. Grep-verify each AC marker (AC-1 through AC-6) in the modified files. | depends_on: T-VSC-01, T-VSC-02, T-VSC-03, T-VSC-04, T-VSC-05, T-VSC-06
```
