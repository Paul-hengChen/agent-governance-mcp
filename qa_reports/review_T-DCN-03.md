# QA Review — decodename-cleanup (T-DCN-01 / T-DCN-02 / T-DCN-03 / T-DCN-04)

Feature: `specs/decodename-cleanup.md`
Role: qa-engineer (test-owner)
Date: 2026-06-11
Verdict: **PASS**

## Scope

Provenance-genericization of the internal product codename "CDE-OOBE" across the 5
always-loaded governance files (constitution + 4 skill files), 18 reference sites,
ALL classified PURE PROVENANCE. No normative rule semantics change. Implementation by
sr-engineer (T-DCN-01) was code-reviewer-APPROVED (`review_reports/review_T-DCN-01.md`).
QA owns final verification + the sanctioned AC8 floor-raise (T-DCN-04) + the [x] flip.
The implementation diff was NOT re-edited (it is final and correct per §2).

## Phase 1 — Acceptance Criteria Verification

| AC | Result | Evidence |
|----|--------|----------|
| AC-GREP | PASS | `grep -rinE "cde[-_ ]?oobe"` over the 5 always-loaded files (constitution.md, skill-pm.md, skill-sr-engineer.md, skill-qa-visual.md, skill-design-auditor.md) → ZERO matches (exit 1, no output). |
| AC-CONST-1 | PASS | constitution L49: `SCOPE_DECISION_REQUIRED` rule sentence + clear-conditions byte-identical; only trailing "Closes the routing-chain half of the scope-creep finding (see `content/constitution-rationale.md`)" citational clause changed. |
| AC-CONST-2 (HC-2) | PASS | §3.2 (L58–93): ONLY the L60–61 attribution noun phrase changed ("CDE-OOBE false-PASS retrospective …" → "a visual false-PASS retrospective (see `content/constitution-rationale.md` / `research/`)"). L62–64 justification sentence + all L66–92 bullets byte-identical. Error-code tokens verbatim: `VISUAL_EVIDENCE_MISSING` (L47), `VISUAL_REPORT_INCOMPLETE` (L48, L112), `SCOPE_DECISION_REQUIRED` (L49). |
| AC-PM / AC-SR / AC-QAVIS / AC-AUDITOR | PASS | git diff of the 4 skill files confirms changes confined to parenthetical/rationale war-story labels; no rule heading, gate threshold, STOP protocol, or numbered SOP step altered. |
| AC-SEMANTICS (HC-1) | PASS | constitution diff added-lines grep for normative tokens shows only citational/example prose changed; trusts code-reviewer's token-level word-diff VERDICT (HC-1 PASS). |
| HC-3 (out-of-scope untouched) | PASS | decodename content edits isolated to the 5 always-loaded files. (Other working-tree "M" files — build.ts, measure-context-cost.mjs, governance-text-load-architecture.md, the prior test edits — are the sibling committed/staged governance-text-load feature, NOT this feature.) |
| HC-5 (pointers resolve) | PASS | `content/constitution-rationale.md` exists (13703 bytes); both constitution pointers (L49, L61) resolve to it; `research/` referenced for named war-story. |

## Phase 3/4 — Test-owner floor-raise (T-DCN-04) + measurement

**Independent measurement (NOT assumed from spec).** Computed against the freshly-built
`dist/prompts/build.js` `stripRationale()` with the test's own `Math.ceil(len/4)` estimator:

```
raw      : 4233 ~tok  (16931 chars)
stripped : 4161 ~tok  (16641 chars)   <- TRUE measured value
saving   :   72 ~tok  (>= 49 floor)
```

The measured stripped figure is **4161 ~tok exactly** — matching the spec's predicted
+8. Floor pinned to the measured value (4161), not blindly to a guess. This is the
irreducible cost of de-codenaming WITH HC-5 provenance redirects: the inline
`(see content/constitution-rationale.md …)` pointers replace the bare codename, sit
OUTSIDE the §1/§7 rationale fences (so `stripRationale()` keeps them), and are longer
than the codename strings. The constitution loads STANDALONE into external workspaces,
so the inline pointer is what preserves provenance discoverability — dropping it to
reclaim 8 ~tok would defeat the cleanup. Ratified by PM (coordinator-reviewed,
human-approved).

**Edit applied** (`test/context-budget.test.mjs:328`, qa-owned per §2 — sr-engineer must
NOT touch the assertion gating their own work):
- Assertion upper bound `4153 → 4161`.
- Test name + WHY comment updated to record the decision, the measured figures, that the
  floor supersedes T-GTL-06, and that the measurement was done independently (not assumed).

**AC4 lite cap (`t-lean-under-target`)**: UNCHANGED and PASSES. The lite/hook path calls
`stripChainOnly` (not `stripRationale`), so de-codenaming the constitution body does not
move it. Assertion `<= 2600` passes (measured lean bundle ~2528). (Note: the test *name*
still reads "<= 2400" — a pre-existing label-vs-assertion mismatch inherited from the
governance-text-load feature; out of decodename scope, assertion itself unchanged.)

## Gate

| Gate | Result |
|------|--------|
| `npm run build` | PASS — zero tsc errors; check:version OK (3.31.0). |
| `npm audit --audit-level=high` | PASS — exit 0; only pre-existing MODERATE `hono` advisory (does NOT gate at high). |
| `npm test` | PASS — **608 / 608** (was 607 pass / 1 fail on the old 4153 floor; the raised floor closes it). |

## Spec-to-Test Map (delta)

- AC-FLOOR / AC8 → `test/context-budget.test.mjs:328` "AC8: rationale-stripped constitution is at/below the measured floor (≤ 4161 ~tok)".
- AC-TEST → full `npm test` green post floor-raise.
- AC-GREP → manual grep gate (no automated test asserts on the codename in always-loaded prose; confirmed none exists).

## Disposition

All ACs PASS. No semantic problem revealed by the measured floor. T-DCN-01/02/04/03
complete. `next_role: human` (release is human-owned; package.json stays 3.31.0).
## 2026-06-11T03:41:32.335Z — PASS — by qa-engineer

PASS. AC-GREP=0 over the 5 always-loaded files. AC-CONST-1/2 (HC-2) confirmed: only L49 + L60-61 citational clauses changed; §3.2 L62-64 justification + L66-92 bullets byte-identical; error codes (SCOPE_DECISION_REQUIRED / VISUAL_REPORT_INCOMPLETE / VISUAL_EVIDENCE_MISSING) verbatim. AC-PM/SR/QAVIS/AUDITOR: only war-story labels changed. HC-5 pointers resolve to existing content/constitution-rationale.md. T-DCN-04 floor-raise applied (test-owner, §2): INDEPENDENTLY MEASURED stripped constitution = 4161 ~tok exactly (raw 4233, saving 72 >= 49) using the test's chars/4 estimator — pinned to measured 4161, not assumed; WHY comment records decision. AC4 lite cap <= 2600 unchanged & passing (lite path strips chain-only, not rationale). GATE: build zero tsc; audit clean at high (pre-existing MODERATE hono does not gate); npm test 608/608 (was 607/1). Evidence: qa_reports/review_T-DCN-03.md.

