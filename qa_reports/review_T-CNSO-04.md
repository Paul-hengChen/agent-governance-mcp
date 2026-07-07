# QA Review — T-CNSO-04 (compose-not-strip-overlays, ticket A9)

## Task
sr-engineer: rewrite `buildPromptForRole()` to concatenate fragments via
`composeConstitution()` per the architecture's algorithm, replacing the
`stripChainOnly`/`stripDesignOnly` call sites; keep `stripRationale`
(fullDetail-gated) and `stripOriginTags` running over the assembled result;
remove now-unused exports.

## Verification performed

- Read `prompts/build.ts` end-to-end. Confirmed:
  - `stripChainOnly` and `stripDesignOnly` are NOT exported (grep for
    `export function strip` returns only `stripRationale` and
    `stripOriginTags` — the two functions the spec requires to survive).
  - `composeConstitution({chain, design}, workspacePath)` matches the
    architecture's `Data Structures`/`Interface Contracts` code block
    verbatim (filters `CONSTITUTION_SEGMENTS` by `includeSegment`, maps to
    `loadContent`, joins with `""`).
  - The pipeline order in `buildPromptForRole` is exactly
    `compose → stripOriginTags (always) → stripRationale (unless fullDetail)`
    — matches the architecture's *Composition Contract & Pipeline Order*
    section verbatim.
  - `isLite`/`isDesignFeature` signals are unchanged from pre-refactor
    (`skillFile === LITE_SKILL_FILE`, `hasDesignModeRequiringVisual(...).required`).
- Ran the empirical equivalence suite (`test/compose-equivalence.test.mjs`,
  T-CNSO-08) — all 8 build-mode dispatch fixtures byte-match the pre-refactor
  golden capture, proving AC2/AC3/AC4/AC5 hold for the actual rewritten
  `buildPromptForRole`, not just that the code "looks right."
- code-reviewer independently approved (`review_reports/review_T-CNSO-04.md`);
  this QA pass re-verified the pipeline order and export surface directly
  against source rather than trusting that report alone.

## Verdict
PASS. `buildPromptForRole` composes additively per spec; the old strippers
are gone; empirical byte-identity holds on all 8 build-mode fixtures.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

