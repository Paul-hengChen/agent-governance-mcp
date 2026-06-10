# Review: visual-selfconverge (T-VSC-01 … T-VSC-06)

> Reviewer: code-reviewer (opus). Clean-context review of `git diff HEAD content/` against `specs/visual-selfconverge.md` + `specs/visual-selfconverge-architecture.md`. sr-engineer pending_notes NOT read (independence).

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Prompt-document-only feature: 6 `content/*.md` files, **18 insertions, 0 deletions** (`git diff --stat HEAD content/`). No `.ts`/`index.ts`/`schema`/`package.json`/`dist` change, matching architecture Decision Record D1.
- Substance is correct: the sr whole-surface self-converge loop, the bounded §1 relaxation, the shared per-region harness, the geometric-density gate, and the token-observability clause all match their ACs and cross-reference each other accurately.
- **AC-3 regression guard PASSES cleanly** — §3.2 is byte-untouched (0 deletions anywhere in the constitution diff).
- **One verdict-driving defect: version-tag provenance.** All five new clauses are tagged `(v3.30.0)`, but v3.30.0 is already released (tag `v3.30.0` → commit `c8c8c4c`) and shipped ONLY the scope-decision gate. None of these five clauses exist in the `v3.30.0` tag. Tagging un-shipped behavior with an already-released version mislabels provenance in a governance doc whose version tags are load-bearing for audit/grep.
- Net: substance APPROVED-grade; blocked solely on the version tag, which is a one-token-per-clause fix.

## Correctness

- **§1 self-converge relaxation (AC-2/AC-3) — CORRECT.** `content/constitution.md:19` is a sub-bullet *under* the §1 **Surgical changes** bullet (§1 spans lines 7–19; §3.2 is lines 57–91 — untouched). The relaxation is properly bounded by all three required qualifiers: (a) "scope is the pre-handoff self-converge loop only — this is NOT a license to refactor adjacent code"; (b) "the QA gate still independently verifies every VSA row at PASS"; (c) "§3.2 is unchanged — no global-frame metric, the visual verdict stays qa-visual-owned, and builder ≠ judge (sr fixes, qa judges)". A future sr cannot read this as a general adjacent-code license or a §3.2 weakening — both are explicitly negated in-clause. AC-2 markers (`self-converge`, `pre-handoff loop`) present in §1; the "§3.2 unchanged" qualifier is in the same paragraph. PASS.
- **AC-3 regression guard — PASS (load-bearing).** `git diff HEAD content/constitution.md | grep "^-" | grep -E "global-frame|qa-visual-owned|builder.*judge"` returns 0 (exit 1, no match). Constitution diff has 0 `^-` deletions total; the only insertion is line 19 in §1. §3.2 is byte-identical to HEAD/v3.27.0 by construction. PASS.
- **sr R5 whole-surface clause (AC-1) — CORRECT and actionable, NOT vague.** `content/skill-sr-engineer.md` adds a concrete 5-step loop: (a) screenshot the *full rendered surface* (not only the changed widget) to `impl path`; (b) Read baseline+impl into context; (c) region-diff over *every declared `compare region`* (≡ qa-visual Step B); (d) structural-assertion checks against *every VSA row* (≡ qa-visual Step C); (e) **iterate in-context until ALL VSA rows pass** — explicitly "Before the 'ready for code review' handoff you MUST run this loop until ALL VSA rows pass." It also re-states the §3.2 boundary ("QA still independently verifies … NOT a self-issued visual verdict (§3.2 builder ≠ judge)"). An sr following this would genuinely run the in-context checks and loop before handoff — it collapses the cross-context rework rounds as intended (research/process-retrospective.md root cause C1). PASS on dimension 3.
- **AC-4 / AC-5 / AC-6 markers all present** at required counts (AC-1 sr =1; AC-4 architect =1; AC-5 pm=1 + design-auditor=1; AC-6 coordinator =5 ≥2). 8–10 state-count threshold untouched; density gate explicitly additive.

## Quality

- pm step **2b is NOT renumbered** — `2a` / `2a-bis` / `2b` confirmed at `skill-pm.md:39/40/41`. The new gate sits at `2a-bis`, preserving every existing `2b` / `SCOPE_DECISION_REQUIRED` cross-reference, exactly as Decision Record AC-5 directed. No convention drift.
- design-auditor clause is correctly scoped to **flag-only** ("Design-auditor only **flags**; PM owns the split decision and writes `.current/feature-split.md`"), matching pm's "you MUST recommend a sub-task split". Ownership is single-sourced (PM). No duplication.
- Coordinator observability clause is additive (new H2), no overlap with existing watermark/observability text. Clean.

## Architecture

- Matches `specs/visual-selfconverge-architecture.md` Affected-Files table and Decision Records D1 exactly: prompt-doc-only, no server change, no version bump, no `dist/` rebuild. Correct per the no-design / `mode: no-design` scope note.
- **Shared-harness cross-references resolve and are accurate**: architect clause names "consumed by both the sr-engineer whole-surface self-converge self-check (skill-sr-engineer R5) and the qa-engineer/qa-visual verdict (skill-qa-visual Steps B/C)". Verified: `skill-qa-visual.md:47` = "Step B — Region Diff Per Baseline", `:58` = "Step C — Structural Assertions" — sr's "region-diff ≡ Step B" and "structural-assertion ≡ Step C" mappings are correct. Architect's claim that the shape "already matches the server's `## Region Diff` / `## Structural Assertions` report tables" is accurate: `tools/evidence-file.ts:365-366` lists exactly those H2 names and `validateVisualReport` slices on them (`:487-490`). The "per-region structural numbers, NOT a whole-frame pixel ratio" requirement correctly grounds in §3.2 no-global-frame. Internal consistency: PASS (dimension 5).

## Security

- N/A — Markdown prompt-document edits only. No injection surface, no secrets, no boundary changes. Second-pair-of-eyes confirms no executable/config path touched.

## Performance

- N/A — no code, no hot paths, no I/O. No algorithmic regression possible. PASS.

## Verdict

**CHANGES_REQUESTED** — substance is correct on all five behavioral dimensions and the load-bearing AC-3 guard passes byte-clean, but the five new clauses are tagged `(v3.30.0)`, an already-released version (tag `v3.30.0` = commit `c8c8c4c`) that shipped none of them; this mislabels un-shipped behavior as already-shipped in a governance doc whose version tags are load-bearing for audit and grep, and must be corrected before handoff to QA.

### Required change (single, mechanical)

Re-tag the five new clauses from `(v3.30.0)` to the correct next-release version (e.g. `(v3.31.0)`, or whatever the next package version will be — confirm with PM/release-engineer if uncertain). Affected lines:

- `content/constitution.md:19` — "Self-converge relaxation (v3.30.0)"
- `content/skill-sr-engineer.md` — "Whole-surface self-converge loop (v3.30.0)"
- `content/skill-architect.md` — "Per-region structural numbers (v3.30.0)"
- `content/skill-pm.md:40` — "Geometric-Density Split Gate (v3.30.0)"
- `content/skill-design-auditor.md` — "Geometric-density flag (v3.30.0, awareness-only)"
- `content/skill-coordinator.md` — "Subagent Token Observability (v3.30.0)"

Rationale (why this is a defect, not a nit): the constitution header's own policy comment states version tags "track the highest behavior the document describes," and the existing `2b. Scope Decision Gate (v3.30.0)` legitimately carries v3.30.0 because it actually shipped in commit `c8c8c4c`. Mixing un-shipped clauses under the same `v3.30.0` tag means `git grep v3.30.0` returns a set that conflates two unrelated change-sets, and a future reader/agent will wrongly conclude these clauses were released in v3.30.0. The fix is one token per clause and does not affect any AC grep marker (none of the AC patterns depend on the version literal).

### Explicitly NOT blocking (for the writer's benefit)

- AC-3 §3.2 byte-integrity — verified PASS, no action.
- §1 relaxation bounding — verified correct, no action.
- sr whole-surface loop concreteness — verified actionable, no action.
- All cross-references (sr↔qa-visual Step B/C, pm 2a-bis vs design-auditor flag ownership, architect shared-harness consumed by both roles) — verified consistent, no action.
- The 35-task historical drift is benign prior-release bookkeeping — noted, not reconciled (per brief).

### sr-engineer reply — Round 1 (addressed)

- **Version-tag finding: FIXED.** Re-tagged all six new clauses (the one verdict-driving finding) from `(v3.30.0)` → `(v3.31.0)`, the next-minor that introduces this behavior (package.json bumps to 3.31.0 at release time per the standard flow). Edits, one token each except sr-engineer which carries two references:
  - `content/constitution.md:19` — §1 Self-converge relaxation (the §1 clause only).
  - `content/skill-sr-engineer.md:26` — Whole-surface self-converge loop heading + its inline "self-converge relaxation v3.31.0" cross-ref to §1.
  - `content/skill-architect.md:24` — Per-region structural numbers.
  - `content/skill-pm.md:40` — Geometric-Density Split Gate (step 2a-bis).
  - `content/skill-design-auditor.md:69` — Geometric-density flag (awareness-only).
  - `content/skill-coordinator.md:156` — Subagent Token Observability heading.
- **Did NOT touch the two already-shipped scope-decision-gate references** (`content/skill-pm.md:41` step 2b, `content/constitution.md:49` §3) — they legitimately carry `(v3.30.0)` because they shipped in commit `c8c8c4c`. `git grep v3.30.0` over the six files now returns only those two shipped references; the new feature's six clauses are uniformly `v3.31.0`.
- **AC-3 §3.2 still byte-untouched:** `git diff HEAD content/constitution.md | grep -c '^-[^-]'` = 0 deletions; the load-bearing-token deletion check (`global-frame|qa-visual-owned|builder.*judge`) returns nothing. §3.2 unchanged.
- **`git diff HEAD content/` numstat:** all changes are pure insertions (the feature's clauses are net-new vs HEAD), 0 deletions; every changed/added line is either a new feature clause or its body. No adjacent content moved.
- **Build:** `npm run build` → ZERO tsc errors (`check:version` emits an informational note only; package.json stays 3.30.0 until release-time bump). **Audit:** `npm audit --audit-level=high` → only the pre-existing moderate hono advisory; no HIGH/CRITICAL.

Handing back to code-reviewer for Round 2.

## Round 2 — APPROVED — by code-reviewer

> Verify-the-fix-only pass (the other 4 dimensions PASSED in Round 1; re-confirmed AC-3 §3.2 byte-integrity since the diff changed). Clean-context: `git diff HEAD content/` + specs.

## Summary

- The single Round 1 finding (version-tag provenance) is **FIXED**. All six new feature clauses are now uniformly `(v3.31.0)`; the two legitimately-shipped scope-decision-gate references remain `(v3.30.0)` as required.
- Diff is still **purely additive**: `git diff --numstat HEAD content/` = 18 insertions / 0 deletions (constitution 1, architect 1, coordinator 12, design-auditor 2, pm 1, sr-engineer 1).
- **AC-3 §3.2 still byte-untouched** — re-confirmed since the diff changed: 0 real deletion lines anywhere (`grep -c '^-[^-]'` = 0); load-bearing-token deletion check (`global-frame|qa-visual-owned|builder.*judge`) returns nothing (exit 1).
- No regression introduced by the retag: AC grep markers all present at expected counts; no added line carries `v3.30.0`.
- Net: all five dimensions PASS. **APPROVED.**

## Correctness

- **CHECK 1 — `git grep "v3.30.0"` over the six changed files returns ONLY the two shipped references.** `content/constitution.md:49` (§3 Scope decision gate) and `content/skill-pm.md:41` (step 2b Scope Decision Gate) — both shipped in commit `c8c8c4c`, both correctly untouched. No third hit. PASS.
- **CHECK 1b — all six new clauses are now `v3.31.0`:** `constitution.md:19` (§1 Self-converge relaxation), `skill-sr-engineer.md:26` (Whole-surface self-converge loop heading + the inline `self-converge relaxation v3.31.0` §1 cross-ref), `skill-architect.md:24` (Per-region structural numbers), `skill-pm.md:40` (2a-bis Geometric-Density Split Gate), `skill-design-auditor.md:69` (Geometric-density flag), `skill-coordinator.md:156` (Subagent Token Observability heading). The sr-engineer file's two references were both retagged. PASS.
- **CHECK 2 — no new `(v3.30.0)` token on any feature clause:** `git diff HEAD content/ | grep '^+' | grep "v3.30.0"` returns nothing (exit 1). No added line carries the stale version. PASS.

## Quality

- Retag is one token per clause (two in sr-engineer); no adjacent content moved, no renumbering, no marker drift. Clean.

## Architecture

- Unchanged from Round 1 (prompt-doc-only, no server/version/dist change). The retag does not alter any cross-reference or scope. Still matches `specs/visual-selfconverge-architecture.md` D1. PASS.

## Security

- N/A — Markdown prompt-document edits only. PASS.

## Performance

- N/A — no code. PASS.

## Verdict

**APPROVED** — the sole Round 1 finding is fixed (six clauses retagged to `v3.31.0`, two shipped refs correctly left at `v3.30.0`), AC-3 §3.2 re-confirmed byte-untouched, diff remains additive (0 deletions), and the retag introduced no regression; handing to qa-engineer.
