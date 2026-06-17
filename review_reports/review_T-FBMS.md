# Code Review: figma-baseline-mechanical-selection (T-FBMS-01/02/03)

**Reviewer:** code-reviewer (inline — subagent dispatch rate-limited)
**Verdict:** APPROVED
**Date:** 2026-06-17

## Scope reviewed
Diff vs HEAD, feature files only:
- `content/skill-design-auditor.md` (+5) — step 2c
- `content/skill-qa-visual.md` (+16) — Step A.0
- `package.json`, `index.ts` — version 3.38.0 → 3.39.0
- `CHANGELOG.md` (+5) — `## [3.39.0]` entry
- `test/qa-visual-skill-split.test.mjs` (+8/-1) — qa-owned byte-cap bump 16200 → 17600

(Unrelated pre-existing untracked files — `multi-agent-scripts/`, `research/*`, `qa_reports/review_T-ORM*/RSH*` — are NOT part of this feature diff and were present at session start.)

## Findings

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | — | Step 2c correctly placed between 2b and step 3; forbids eyeball-pick; mandates deterministic filter (frame-type + name-glob + semantic anchor preferring `componentId`); groups by spatial proximity / `componentId` and explicitly rejects id-prefix with rationale; freezes node-id list + filter conditions + exclusion reasons into Source manifest; states downstream copies verbatim, no URL re-derivation. Matches AC-1 exactly. | PASS |
| 2 | — | Step A.0 mirrors 2c on the consumer side: copy frozen manifest node-ids verbatim, forbid URL re-derivation, FAIL-route to design-auditor if manifest absent. Matches AC-2. | PASS |
| 3 | — | Version literals consistent across package.json + index.ts (3.39.0); `check-version.mjs` OK. CHANGELOG entry names the feature + both SOP additions + deferred scope. Matches AC-3/AC-4. | PASS |
| 4 | NOTE | AC-5 literal wording ("zero `.ts`/`.mjs` modified") is over-strict: `index.ts` change is the version-literal required by AC-3, and the `.mjs` change is a qa-owned byte-budget cap bump (test-infra coupling, not server/build logic). AC-5 **intent** (no server/schema/build-logic change) is satisfied. Surfaced for PM awareness; not a blocker. | NOTE only |
| 5 | NOTE | `npm audit`: 3 high / 5 moderate, all pre-existing (feature touches no deps, no package-lock per AC-5). Waive at release with this rationale. | NOTE only |

## Quality checks
- No `any` / no type regressions (no logic code changed; `tsc` clean).
- Content additions match surrounding SOP voice and version-tagging convention.
- Surgical: no adjacent-code churn.
- Byte-cap bump follows the established comment convention (precedent v3.38.0 commit 0bc9bd7).

## Conclusion
APPROVED → qa-engineer for AC verification + PASS.
