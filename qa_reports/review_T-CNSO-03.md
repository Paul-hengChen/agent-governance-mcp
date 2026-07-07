# QA Review — T-CNSO-03 (compose-not-strip-overlays, ticket A9)

## Task
sr-engineer: split `content/constitution.md` into the 15 fragment files per
T-CNSO-01's module boundary — verbatim text relocation, no rewording, no
dropped rules.

## Verification performed

- Confirmed all 15 `content/const-*.md` files exist and match the architecture
  doc's exact table (file name, tag, monolith line range).
- Ran `cat content/const-01-core-head.md ... content/const-15-core-tail.md`
  and diffed the result against `test/fixtures/compose-golden/constitution-monolith.txt`
  (the pre-refactor monolith byte capture) — **IDENTICAL**, confirming zero
  gaps, zero overlaps, zero reordering, zero rewording across the 15-way split
  (DR-1 Option R invariant, also pinned as an automated test in
  `test/compose-equivalence.test.mjs`).
- code-reviewer independently reviewed this task (`review_reports/review_T-CNSO-03.md`)
  and approved; this QA pass re-derives the same conclusion from the raw
  files rather than trusting the prior report.
- Confirmed no out-of-scope file was touched by this task (`tools/transitions.ts`,
  `tools/evidence-file.ts`, `content/skill-*.md`, `content/constitution-rationale.md`
  all show zero diff vs `main`).

## Verdict
PASS. The 15-fragment split is a verbatim, lossless partition of the retired
monolith — verified by byte-for-byte reconstruction, not by inspection alone.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

