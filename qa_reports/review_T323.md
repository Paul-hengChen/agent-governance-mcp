# QA Review — context-budget-reduction (T322 impl + T323 tests)

## Round 1 — PASS — by qa-engineer

## Phase 1 — Review

- **Correctness**: `stripChainOnly` regex traced against the fenced `constitution.md`; removes the single §3.1+§4 block, idempotent, no-marker passthrough preserved. Lite routing confirmed (`prompts/coordinator-lite.ts` → `skill-coordinator-lite.md` → stripped; full coordinator + worker roles → raw).
- **Edge cases**: workspace `.current/constitution.md` override without fences → unchanged (no rule loss); double-strip stable; fence-marker text itself removed.
- **Security**: regex over first-party trusted content; non-greedy literal-anchored (no ReDoS); no boundaries/secrets. Concurs with code-reviewer.

### 3a. Copy Audit Gate
Spec *Copy / Strings* has 2 entries; both verified verbatim in `scripts/measure-context-cost.mjs`:
- `measure.report.title` = `Always-on context budget` — rendered verbatim (asserted by test).
- `measure.report.total` = `TOTAL always-on (constitution + default skill)` — rendered verbatim (asserted by test).
No drift, no coverage gap.

### 3b. Visual Audit Gate
Spec *Visual Tokens* = `N/A` (internal infra, no literals). Gate pass-through.

## Phase 1.5 — Visual Compare
Skipped (no `design/context-budget-reduction.md`; no `## Visual Baselines`). Non-UI feature.

## Phase 2 — Discussion
No issues found in Phase 1 → no rounds needed. Code-reviewer's non-blocking follow-up (regex-equivalence test) is implemented as `DR-3: all three stripChainOnly regex copies are identical`.

## Phase 3 — Tests

New file `test/context-budget.test.mjs`. Spec-to-Test map:

| AC | Test(s) |
|---|---|
| AC1 (measurement) | `AC1: measure-context-cost script runs headlessly and exits 0`; `AC1: measure script prints the spec'd Copy/Strings labels + token table` |
| AC2 (reduction) | `AC2: stripChainOnly removes the chain-only block and is idempotent`; `AC2: lean always-on bundle is below the raw baseline and within target (<= 2000 ~tok)` |
| AC3 (enforcement preserved) | `AC3: lite ... OMITS chain-only`; `AC3: lite ... RETAINS all universal rules`; `AC3/AC4: full ... RETAINS chain-only verbatim`; `AC3: exactly one balanced fence`; `AC3: hook LITE strips`; `AC3: hook FULL retains` |
| AC4 (no routing regression) | `AC3/AC4: full (chain-role) constitution RETAINS chain-only sections verbatim` (chain agents still receive §3.1/§4); transition logic untouched — covered by existing `test/transitions`/state suite, still green |
| DR-3 (3-copy parity) | `DR-3: all three stripChainOnly regex copies are identical` |

Also updated `test/researcher-deep-research.test.mjs` (AC-1/2/4/5) to the v3.16.1 shallow-default contract — these had been left asserting the superseded `deep` default when v3.16.1 shipped (test-ownership cleanup, constitution §2).

Coverage: the changed logic (`stripChainOnly`, both injection paths, the measure script) is exercised directly by unit + integration (spawned hook + spawned script) tests.

### Security smoke
Boundary inputs covered: empty/no-marker text (passthrough), idempotent re-application.

## Phase 4 — Run
- `npm test`: **414 pass / 0 fail** (was 403; +11 context-budget, 4 researcher tests corrected, all green).
- Headless, zero human interaction. Build (prebuild tsc + check:version 3.16.1) clean.
- Dependency audit: pre-existing protobufjs HIGH/CRITICAL (transitive via `@xenova/transformers` RAG chain) — **user-WAIVED** for this feature (unrelated, breaking fix); tracked separately, to be noted in release PR.

## Verdict
**PASS** — always-on bundle 2837→1961 ~tok (−31%, ≤2000 target); no normative rule lost (lite omits only chain-only §3.1/§4, chain roles keep full); 3-copy regex parity pinned.
## 2026-05-31T10:14:48.071Z — PASS — by qa-engineer

PASS. Always-on bundle 2837→1961 ~tok (−31%, ≤2000 target). Lite contexts strip chain-only §3.1/§4 only; chain roles keep full constitution (no rule lost). 414 tests pass/0 fail (+11 context-budget, 4 stale researcher tests corrected to v3.16.1 shallow default). DR-3 3-copy regex parity pinned. Audit: pre-existing protobufjs HIGH/CRIT user-waived. Evidence: qa_reports/review_T323.md.

