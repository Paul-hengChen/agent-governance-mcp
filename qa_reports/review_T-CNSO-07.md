# QA Review — T-CNSO-07 (compose-not-strip-overlays, ticket A9)

## Task
qa-engineer: rework `test/context-budget.test.mjs` — replace strip-behavior/
permutation/DR-3-regex-parity assertions (no longer applicable once
stripping is gone) with composition-behavior assertions.

## Continuation note
This task was authored by a prior qa-engineer session that was cut off
mid-task by a real API session-limit error (before it could run
`tw_complete_task`). This review independently re-verifies the rework from
scratch rather than trusting the prior session's self-report.

## Verification performed (independent)

- Read the full diff (`git diff test/context-budget.test.mjs`, 131
  insertions / 217 deletions) line by line. Confirmed:
  - Removed tests that unit-tested the deleted strippers directly: "AC2:
    stripChainOnly removes the chain-only block and is idempotent", "AC3:
    exactly one balanced chain-only fence wraps §3.1 + §4", "AC1:
    stripDesignOnly removes the design-only span and is idempotent", "AC9/DR-9:
    stripChainOnly ∘ stripRationale compose order", the 6-permutation
    "AC5/HC5" pair, and "AC-P2-4/HC-NEST" (8-subset permutation sweep).
  - `import { stripChainOnly, stripRationale, stripDesignOnly, stripOriginTags, buildPromptForRole }`
    is now `import { stripRationale, stripOriginTags, buildPromptForRole, composeConstitution }`
    — the two deleted strippers are gone from the import list. Grepped the
    whole file for `stripChainOnly(`/`stripDesignOnly(` as live calls (not
    comment prose) — zero hits.
  - The top-level `CONSTITUTION` fixture constant changed from
    `fs.readFileSync(content/constitution.md)` to
    `composeConstitution({chain:true,design:true})`.
  - The former "DR-3: all three stripChainOnly regex copies are identical"
    test is replaced with "DR-4: hook and measure script import the shared
    constitution-manifest (no duplicated chain-only regex)" — asserts both
    the import AND the absence of the old duplicated regex literal.
  - `stripRationale`/`stripOriginTags` unit tests and their order-independence
    test are KEPT (narrowed from 3-axis to the 2 surviving axes, correctly —
    there is no chain/design axis left for them to interact with since
    fragment selection now happens before either stripper runs).
  - Outcome-level tests (what a dispatch mode contains/omits) are re-pointed
    to `composeConstitution({chain, design: false/true})` in place of
    `stripDesignOnly(...)`, preserving the same assertions on the same
    outcome.
- Ran `node --test test/context-budget.test.mjs` directly: **43/43 pass, 0
  fail** (confirms the prior session's "43 tests... down from 57" headline
  claim is TRUE for the pass/fail outcome — independently reproduced, not
  copied from the prior report).
- Ran the full suite (`npm test`): **824/824 pass, 0 fail** (post
  T-CNSO-08/DR-6/T-CNSO-09 work as well — see review_T-CNSO-09.md for the
  final gate run).

## Verdict
PASS. The rework matches the architect's spec: deleted-stripper assertions
removed, composed-source re-pointing done, `stripRationale`/`stripOriginTags`
coverage kept verbatim, DR-4 manifest-not-duplicated assertion added. All
tests in the file pass.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

