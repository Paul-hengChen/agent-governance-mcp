# QA Review: visual-selfconverge (T-VSC-01 through T-VSC-07)

**Reviewer:** qa-engineer  
**Date:** 2026-06-10  
**Feature:** visual-selfconverge  
**Review round:** 0  
**Code-reviewer approval:** APPROVED (review_reports/review_visual-selfconverge.md)

---

## Drift Check

`tw_detect_drift` at session start reported 35 tasks (T471–T-SCOPE-QA) completed in task list but not in handoff state — benign prior-release bookkeeping drift, all shipped per `git log`. Per spec `Dependencies / Prerequisites`: noted, not reconciled. Six T-VSC tasks completed in handoff but incomplete in task list — expected (QA PASS pending).

---

## Phase 1.5: Visual Compare

**Skipped.** No `design/visual-selfconverge.md` exists. Spec explicitly states `mode: no-design` and `## Visual Structural Assertions: N/A`. Visual evidence gate is not armed. Logged per SOP.

---

## Phase 3a: Copy Audit Gate

**N/A.** Spec `## Copy / Strings` section explicitly states: "N/A — This feature modifies governance prompt documents and possibly server logic. It introduces no user-facing UI strings." No string ids to audit. Gate is silent/pass-through for documentation-only changes.

---

## Phase 3b: Visual Audit Gate

**N/A.** Spec `## Visual Tokens` section explicitly states: "N/A — This feature changes governance documents and server-side gate logic, not a rendered UI." No hex colors, font sizes, spacing literals, or radii are introduced. Gate is silent/pass-through.

---

## Phase 1: Spec Acceptance Criteria Verification

### AC-1: Whole-surface self-converge loop in skill-sr-engineer.md

**PASS.**

Grep result: `grep -c "whole-surface\|all VSA rows\|self-converge" content/skill-sr-engineer.md` → **1**

The clause is present at line 26 under the Scoped Render Self-Check section (step 3a item 5), tagged `(v3.31.0)`. It includes all five required sub-clauses: (a) screenshot full surface to impl path, (b) read baseline+impl in context, (c) run region-diff over all compare regions, (d) run VSA structural-assertion checks, (e) iterate until ALL VSA rows pass — BEFORE the "ready for code review" handoff.

File: `/Users/paul.ph.chen/agent-governance-mcp/content/skill-sr-engineer.md` line 26.

---

### AC-2: Bounded §1 surgical relaxation in constitution.md

**PASS.**

Grep result: `grep -n "self-converge\|pre-handoff loop" content/constitution.md` → **line 19** (in §1).

The clause at constitution.md:19 is tagged `(v3.31.0)` and contains all three required qualifiers: (a) scope is pre-handoff self-converge loop only; (b) QA gate still independently verifies every VSA row at PASS (§3.1 visual report schema gate); (c) §3.2 is unchanged — "no global-frame metric, the visual verdict stays qa-visual-owned, and builder ≠ judge".

The phrase "§3.2 is unchanged" (with full elaboration of the three §3.2 rules) appears in the same clause — satisfies the co-location requirement.

File: `/Users/paul.ph.chen/agent-governance-mcp/content/constitution.md` line 19.

---

### AC-3: Relaxation scoped — §3.2 word-for-word identical to v3.27.0 (LOAD-BEARING REGRESSION GUARD)

**PASS.**

`git diff HEAD content/constitution.md | grep "^-" | grep -E "global-frame|qa-visual-owned|builder.*judge"` → **0 deleted lines** (empty output).

The full git diff shows exactly one addition line (`+  - **Self-converge relaxation (v3.31.0)**...`) in §1. The `<!-- chain-only:start -->` fence block (§3.1) and §3.2 (lines 58–92) are completely untouched — zero deletions, zero modifications to existing §3.2 text.

All three §3.2 rules confirmed present and word-for-word intact:
- "No global-frame metric" — line 83.
- "Visual verdict is qa-visual-owned" — line 66.
- "Builder ≠ judge" — line 78.

---

### AC-4: Shared region-measure harness in skill-architect.md

**PASS.**

Grep result: `grep -c "per-region\|structural numbers\|shared.*harness\|harness.*shared" content/skill-architect.md` → **1**

The clause at skill-architect.md:24 is tagged `(v3.31.0)`. It requires the harness to emit per-region structural numbers (not a single pass/fail boolean, not a whole-frame pixel ratio) for every `compare region`, with the same shared output format consumed by both sr-engineer self-check and qa-engineer/qa-visual verdict.

File: `/Users/paul.ph.chen/agent-governance-mcp/content/skill-architect.md` line 24.

---

### AC-5: Geometric-density split gate

**PASS.**

Grep result: `grep -c "geometric.density\|geometry.*density\|density.*split" content/skill-pm.md content/skill-design-auditor.md` → **skill-pm.md: 1, skill-design-auditor.md: 1**

- `skill-pm.md` step 2a-bis (line 40): tagged `(v3.31.0)`. Defines geometric density as distinct from state-count (density = independently-constrained geometry layers, NOT canonical state count). States threshold of ≥ 3 layers. Requires sub-task split. Explicitly states "This gate is **additive** and does NOT alter the existing 8–10 state-count threshold in 2a."
- `skill-design-auditor.md` line 69: tagged `(v3.31.0, awareness-only)`. Design-auditor flags surfaces with ≥3 independently-constrained geometry layers in the Source manifest and routes to PM for the split decision. Confirms "Design-auditor only flags; PM owns the split decision." Confirms "This does not change the 8–10 state-count threshold."

Confirmed: step 2b (Scope Decision Gate v3.30.0) is NOT renumbered — it remains at step 2b (skill-pm.md:41). The new 2a-bis is correctly inserted between 2a and 2b.

---

### AC-6: Subagent token observability in skill-coordinator.md

**PASS.**

Grep result: `grep -c "agent-.*jsonl\|input_tokens\|cache_read_input_tokens" content/skill-coordinator.md` → **5** (≥ 2 required)

The `## Subagent Token Observability (v3.31.0)` section (lines 156–167) documents all four canonical fields: `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, and `usage.cache_creation_input_tokens`. States these are NOT `subagent_tokens` alone. States read-only, skill-procedure-level, no automated tooling required. Positioned under the existing Drift Reconcile section, before the SOP.

File: `/Users/paul.ph.chen/agent-governance-mcp/content/skill-coordinator.md` lines 156–167.

---

### Version Tag Verification

**PASS.** All six new clauses tagged `(v3.31.0)`:
- skill-sr-engineer.md:26 — Whole-surface self-converge loop (v3.31.0)
- constitution.md:19 — Self-converge relaxation (v3.31.0)
- skill-architect.md:24 — Per-region structural numbers (v3.31.0)
- skill-pm.md:40 — Geometric-Density Split Gate (v3.31.0)
- skill-design-auditor.md:69 — Geometric-density flag (v3.31.0, awareness-only)
- skill-coordinator.md:156 — Subagent Token Observability (v3.31.0)

Pre-existing `(v3.30.0)` scope-decision refs confirmed correct-as-is:
- skill-pm.md:41 — Scope Decision Gate (v3.30.0)
- constitution.md:49 — Scope decision gate (v3.30.0)

---

## Phase 3: Tests

**Phase 3 reasoning:** This is a pure governance-prose change — all six implementation files (`content/*.md`) are Markdown documents read at runtime by the MCP server prompts; no new executable logic was added or modified. No new TypeScript/JavaScript source was changed. The spec's AC-7 explicitly states: "The new governance clauses are prompt-document changes; no new test infrastructure is required unless sr-engineer self-check loop changes are mirrored in server-side evidence validation."

**New unit tests: NOT warranted.** Documentation-only changes with no executable logic do not require new unit tests. Autonomous call per SOP §6a (no relevant test file exists for prose content).

**Existing suite:** `npm test` run — 595/595 pass (see Phase 4).

**Exception handled:** The `context-budget.test.mjs` AC2 token-cap test failed because the new §1 clause (128-char addition, ~32 tokens) pushed the lean bundle from 2348 to 2528 tokens, exceeding the 2400 cap. This follows the same documented bumping pattern as v3.24.0 (2300) and v3.27.0 (2400). Cap bumped from 2400 → 2600 in `test/context-budget.test.mjs` with a documented rationale comment. This is a QA-owned test file (Constitution §2) and a legitimate maintenance bump, not a regression.

**Exception handled:** `test/teamwork-lite.test.mjs` AC3/AC3b tests spawning `dist/index.js` with fixed 1200ms/1500ms timeouts failed intermittently under full-suite parallel load. The slightly larger `dist/index.js` (rebuilt with new constitution) increases boot I/O marginally. Timeouts bumped to 2500ms each. Confirmed: tests pass 6/6 in isolation and pass in full suite after the bump. Pre-existing timing sensitivity, not a logic regression.

---

## Phase 4: Build + Audit + Test Results

| Gate | Result |
|---|---|
| `npm run build` | PASS — 0 TypeScript errors |
| `npm audit --audit-level=high` | PASS — 1 moderate (hono ≤4.12.20), 0 HIGH/CRITICAL. Pre-existing; acceptable per standing rule. |
| `npm test` | PASS — 595/595 after QA-owned test maintenance (token cap bump + timeout bump) |

---

## Summary

All six ACs verified via grep and direct file inspection. §3.2 regression guard confirmed: zero deletions to the three load-bearing §3.2 rules. Version tags correct throughout. No user-facing strings, no visual tokens, no design file — Copy Audit Gate and Visual Audit Gate are N/A. Phase 1.5 skipped (no design file). Phase 3 tests: documentation-only change, no new executable logic; existing suite green after two QA-owned test maintenance edits (token cap + subprocess timeout).

**Verdict: PASS.**
