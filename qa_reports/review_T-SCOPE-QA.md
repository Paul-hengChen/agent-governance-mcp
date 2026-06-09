# QA Review — T-SCOPE-QA (server-scope-decision-gate)

**Verdict: PASS**
**Suite: 595 pass / 0 fail (was 572 with 13 failing). Net +23 tests.**
**Reviewer: qa-engineer | Date: 2026-06-09**

Feature implemented by sr-engineer, code-reviewer APPROVED (`review_reports/review_T-SCOPE-IMPL.md`).
QA scope = test coverage of the AC fixtures + spec edge cases, build/suite green, security audit.

---

## Phase 0 — Claim
Advanced state `(sr-engineer/code-reviewer, In_Progress)` → `(qa-engineer, In_Progress)`.

## Phase 1 — Review
Read impl against `specs/server-scope-decision-gate.md` (AC-1..AC-10) and
`specs/qa-flow-enforcement-architecture.md → ## Scope Decision Gate` (5 edge cases).

- **Gate predicate** (`index.ts:741-748`): four ANDed conditions
  (`next.agent ∈ {architect,sr-engineer}`, `next.status=In_Progress`, `prev.agent=pm`,
  `prev.status=In_Progress`) then `arm.required && !hasScopeDecision(...)`. Matches arch Decision 1.
- **`hasScopeDecision`** (`tools/evidence-file.ts:242-249`): existence-of-`.current/feature-split.md`
  OR `handoffState?.scope_decision === "single-feature"`. Never throws (optional chaining).
- **Schema v3→v4** (`schema/migrations-handoff.ts:46-49`, `schema/versions.ts:8`): additive no-op,
  no seeded default. `tools/handoff.ts` parse (`139-158`) + preserve-merge (`408-429`).
- **transitions.ts** stays pure — union member only (`:68`), no `fs` import.

### Copy Audit Gate (3a) — PASS
Spec Copy/Strings has one row (SCOPE_DECISION_REQUIRED hint). The hint emitted by `index.ts:750-754`
matches the spec text (`server-scope-decision-gate.md:51`) **verbatim**, char-for-char including the
`(a)`/`(b)` enumeration and trailing spec reference. Pinned by test `AC-4: ...hint... matches the
spec Copy/Strings verbatim` (asserts both directions: spec→impl and impl→spec). No drift, no coverage gap.

### Visual Audit Gate (3b) — N/A
Spec Visual Tokens = N/A (server-side state-machine feature, no UI surfaces). Nothing to source.

## Phase 1.5 — Visual Compare
**Skipped (no Visual Baselines declared).** Feature design mode is `no-design`; no `design/<feature>.md`
`## Visual Baselines` H2. Non-UI feature pays zero visual overhead.

## Phase 2 — Discussion
No correctness/architecture issues found (code-reviewer already APPROVED). No rounds needed.

One out-of-scope observation, NOT a FAIL: the v3→v4 schema bump (T-SCOPE-SCHEMA) left 13 pre-existing
version-pin assertions stale (hard-coded `schema_version: 3` / "server max 3" / "v3.14.0 levels").
Per `docs/schema-versions.md`, bumping a version requires updating these fixtures. As the test owner I
updated them to the correct v4 expectations (they assert the now-correct production behavior — the impl
was right, the fixtures lagged). This is test-infra maintenance for the same feature, not a code defect.

---

## Phase 3 — Tests

### Test File Discovery
Closest analog = `test/visual-evidence-gate.test.mjs` (tests the `VISUAL_BASELINES_REQUIRED` gate via
the same `tools/evidence-file.js` helpers; `hasScopeDecision` lives in that module). Extended it for
the gate/helper/composition tests. Extended `test/handoff-migration.test.mjs` for schema v3→v4 +
round-trip. No new file created.

### Spec → Test map (all in test/visual-evidence-gate.test.mjs unless noted)

| AC / Edge | Test |
|---|---|
| AC-1 gate fires (pm→sr-engineer, armed, no decision) | `AC-1: gate FIRES — design armed + pm→sr-engineer build entry + no scope decision` |
| AC-1 gate fires (pm→architect) | `AC-1: gate FIRES on the architect build-entry edge too` |
| AC-1 hasScopeDecision=false when neither artifact | `AC-1: hasScopeDecision false when neither artifact present` |
| AC-2 split-file clears | `AC-2: gate CLEARED by .current/feature-split.md existence` + `AC-2: hasScopeDecision true when ...feature-split.md exists` |
| AC-3 attestation clears | `AC-3: gate CLEARED by scope_decision: single-feature` + `AC-3: hasScopeDecision true when ...single-feature` |
| AC-4 envelope shape | `AC-4: rejection envelope shape — error/attempted/allowed/hint keys` |
| AC-4 verbatim hint (Copy Audit) | `AC-4: SCOPE_DECISION_REQUIRED hint in index.ts matches the spec Copy/Strings verbatim` |
| AC-5 no design file silent | `AC-5: gate SILENT when no design file` |
| AC-5 mode=no-design silent | `AC-5: gate SILENT when design mode === no-design` |
| AC-6 non-build target silent | `AC-6: gate SILENT for non-build transition target` |
| AC-6 non-In_Progress build silent | `AC-6: gate SILENT when build target status is not In_Progress` |
| AC-7 v3→v4 migrate-on-read, no-seed | `AC-7 / AC-10(f): v3 handoff migrates to v4 ... scope_decision undefined, other fields preserved` (handoff-migration) |
| AC-7 v4 parse-back | `AC-7: v4 file with scope_decision parses the attestation back` (handoff-migration) |
| AC-7 write→read round-trip | `AC-7: scope_decision round-trips through writeHandoffState → readback` (handoff-migration) |
| AC-8 union member + purity | `AC-8: SCOPE_DECISION_REQUIRED is in the TransitionRejection.error union` |
| AC-10(g) v5 refuse-loud | `AC-10(g): future v5 handoff refuses-loud against a v4 server` (handoff-migration) |
| Edge: re-entry architect→sr-engineer | `Edge: re-entry architect→sr-engineer NOT blocked` |
| Edge: sr-engineer self-loop | `Edge: sr-engineer self-loop NOT blocked` |
| Field preservation (scope_decision + prd_path) | `field preservation: a downstream write omitting scope_decision does NOT drop it (nor prd_path)` (handoff-migration) |

### Security smoke (3d)
- `hasScopeDecision`: null/undefined handoffState, empty string, wrong value (`multi-feature`) — all
  covered (`hasScopeDecision: null / undefined ... never throws`, `... wrong value rejected`).
- Path-traversal on feature name already covered by the pre-existing `hasDesignModeRequiringVisual`
  sanitiser tests (same arm helper) in this file.
- `scope_decision` zod-constrained to `enum(["single-feature"])`; `scope_decision_why` capped 2000
  chars; written via js-yaml dump / parameterized SQLite — no injection surface (per code-reviewer).

### Coverage
New/modified production lines (gate predicate, `hasScopeDecision`, migration step, parse/preserve)
all exercised by ≥1 test. Existence/equality helpers are fully branch-covered. Tooling not run for
line %, but every new branch has a dedicated assertion.

## Phase 4 — Run
- `npm run build` — clean, 0 TS errors. `node scripts/check-version.mjs` — OK (3.29.1).
- `npm test` — **595 pass / 0 fail**, run twice, stable (CI-runnable, headless, no interaction).
- `npm audit --audit-level=high` — **0 high/critical**. 1 moderate (hono, transitive, HTTP-mode only,
  pre-existing, unrelated to this feature). §6 high-level gate passes.

### Stale-fixture fixes (v3→v4 bump fallout, test-owner maintenance)
- `test/handoff-versioning.test.mjs` — 6 assertions 3→4 (stamp, heal, round-trip, 2× refuse-loud, concurrent).
- `test/schema-versions.test.mjs` — CURRENT_VERSIONS, idempotent-overwrite (added v3→v4 step), no-op, refuse-loud.
- `test/drift-skew.test.mjs` — skew message "server max v3"→"v4".
- `test/skill-evolution-v3.11.test.mjs` — `handoff: 3,`→`handoff: 4,`.

## Verdict
**PASS.** All AC-1..AC-10 (a-g) + 5 arch edge cases mapped to ≥1 test; gate fires on exactly the right
edge and over-fires nowhere; v3→v4 is a true no-seed no-op with v5 refuse-loud; scope_decision and
prd_path round-trip and survive omitting writes; transitions.ts stays pure; verbatim hint pinned both
directions. Build + 595-test suite green; no high/critical vulns.
## 2026-06-09T06:59:19.713Z — PASS — by qa-engineer

PASS — 595/595 green (was 572 with 13 stale v3→v4 version-pin failures, fixed as test-owner). +23 net tests. All AC-1..AC-10(a-g) + 5 arch edge cases mapped: gate fires on pm→{architect,sr-engineer}:In_Progress build-entry when design armed + no scope decision; cleared by scope_decision:single-feature or .current/feature-split.md; silent for no-design/non-build/non-In_Progress; re-entry (architect→sr-engineer, sr-engineer self-loop) not blocked; v3→v4 no-seed migrate-on-read, v5 refuse-loud; scope_decision + prd_path round-trip and survive omitting writes; transitions.ts pure; verbatim hint pinned both directions. npm audit: 0 high/critical (1 moderate hono, pre-existing/unrelated). Tests in test/visual-evidence-gate.test.mjs + test/handoff-migration.test.mjs.

