# QA Review — T-CNSO-05 (compose-not-strip-overlays, ticket A9)

## Task
sr-engineer: update `bin/agent-governance-context.mjs` (SessionStart hook)
to source from the new fragment module set instead of `content/constitution.md`
+ its own `stripChainOnly` duplicate, preserving lite/full output
byte-for-byte (AC9); update the DR-3 parity comment to the new DR-4 contract.

## Verification performed

- Read `bin/agent-governance-context.mjs` end-to-end. Confirmed:
  - `composeConstitution(wantChain)` dynamic-imports
    `dist/prompts/constitution-manifest.js` and filters
    `CONSTITUTION_SEGMENTS` by `includeSegment(s.tag, {chain: wantChain, design: true})`
    — the hook always includes design fragments (matches architecture's Hook
    Parity Contract: "hook ALWAYS includes the design-tagged fragments — it
    never stripped design-only text").
  - Lite path applies the `\n{3,}` → `\n\n` collapse (mirrors the old
    `stripChainOnly` behavior); full path does not.
  - Fail-loud fallback: import failure returns `""`, which triggers the
    existing "hook misconfigured" hint rather than silently shipping a
    partial bundle — matches the architecture's *Fallback* clause.
  - The old duplicated `stripChainOnly` regex is gone from this file (grep
    confirms no `chain-only:start.*chain-only:end` regex literal remains).
  - The DR-3 comment is replaced with a DR-4-referencing comment describing
    "one manifest, imported" instead of "keep 3 regex copies in sync."
- Ran the empirical equivalence suite (`test/compose-equivalence.test.mjs`):
  both hook fixtures (`hook-lite.txt`, `hook-full.txt`) byte-match the
  current hook's live output (spawned via `execFileSync`), proving AC9 holds
  for the actual rewritten hook.
- code-reviewer independently approved (`review_reports/review_T-CNSO-05.md`).

## Verdict
PASS. The hook is byte-identical to its pre-refactor output in both lite and
full mode, sourced from the shared manifest with no duplicated regex.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

