# QA Review — T-CNSO-02 (compose-not-strip-overlays, ticket A9)

## Task
sr-engineer: capture golden-snapshot fixtures of the pre-refactor
`buildPromptForRole()` output (and the SessionStart hook's output) for the
four dispatch modes (lite, full non-design, full design-armed, `fullDetail`)
— captured BEFORE any content/build.ts edit landed, per spec Dependencies
sequencing requirement.

## Verification performed (independent, not a re-statement of sr-engineer's claim)

- Confirmed `test/fixtures/compose-golden/` contains all 11 files the
  architecture's Golden-Snapshot table requires: 8 build-mode fixtures
  (`build-{lite,full}-{nondesign,design}{,-fd}.txt`), 2 hook fixtures
  (`hook-lite.txt`, `hook-full.txt`), plus `constitution-monolith.txt` (the
  `cat == original` baseline for T-CNSO-08/AC8).
- Confirmed these fixtures are committed at `0d59bc5` (predates the
  uncommitted working-tree diff that introduces `composeConstitution()`),
  i.e. they were captured from the pre-refactor strip pipeline as required.
- Independently replayed the CURRENT (post-refactor) code path for every one
  of the 10 dispatch fixtures (8 build modes + 2 hook modes) via manual
  `node --input-type=module` scripts mirroring `scripts/capture-constitution-golden.mjs`'s
  workspace setup, and confirmed strict byte equality (`===`) against each
  committed fixture — see `test/compose-equivalence.test.mjs` (T-CNSO-08),
  which encodes this exact check as 10 automated tests, all passing.
- Confirmed `cat` of the 15 manifest fragments (in `CONSTITUTION_SEGMENTS`
  order) is byte-identical to `constitution-monolith.txt` via `diff`.

## Verdict
PASS. The golden fixtures are present, correctly sequenced (pre-refactor),
and empirically proven to match the current composed output byte-for-byte.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

