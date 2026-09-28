# QA Review — T-CNSO-06 (compose-not-strip-overlays, ticket A9)

## Task
sr-engineer: update `scripts/measure-context-cost.mjs` and sweep for any
other non-test caller of `stripChainOnly`/`stripRationale`/`stripDesignOnly`
to the new composition model.

## Verification performed

- Read `scripts/measure-context-cost.mjs`. Confirmed it imports
  `CONSTITUTION_SEGMENTS`/`includeSegment` from the compiled
  `dist/prompts/constitution-manifest.js` and composes each reported figure
  (`raw` = compose-all, `non-design` = `compose(core+chain)` +
  `stripRationale`, lite variants = `compose(core)` + collapse) instead of
  reading `content/constitution.md` + local strip mirrors. The three local
  strip-function copies (`stripChainOnly`/`stripRationale`/`stripDesignOnly`)
  that previously lived in this script are gone.
- Grep swept the full repo (excluding `dist/` and `node_modules/`) for
  `stripChainOnly(` / `stripDesignOnly(` as live call sites (not comment
  prose) — zero hits outside comments. Confirmed via
  `grep -n "stripChainOnly\|stripDesignOnly" <files> | grep -v "^\s*[0-9]*:\s*//"`
  across `prompts/build.ts`, `bin/agent-governance-context.mjs`,
  `scripts/measure-context-cost.mjs`, `scripts/capture-constitution-golden.mjs`,
  and `test/context-budget.test.mjs` — the only match returned was a
  test-string label ("...fires regardless of fullDetail)"), not a function
  call.
- `npm run build && node scripts/measure-context-cost.mjs` runs to
  completion (already exercised as part of the AC12 full-gate run in
  T-CNSO-09's evidence) with no runtime error, confirming the script's
  compose-from-manifest path is live and functioning end-to-end.
- code-reviewer independently approved (`review_reports/review_T-CNSO-06.md`).

## Verdict
PASS. No live caller of the deleted strippers remains anywhere in the repo;
`measure-context-cost.mjs` is fully migrated to the shared manifest.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

