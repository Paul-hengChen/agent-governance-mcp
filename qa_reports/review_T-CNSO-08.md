# QA Review — T-CNSO-08 (compose-not-strip-overlays, ticket A9)

## Task
qa-engineer: add the empirical old-vs-new equivalence tests (AC2-AC5) — byte-
diff the new composed+stripOriginTags output against the T-CNSO-02 golden
snapshots for all four dispatch modes; plus the `cat==monolith` invariant and
the constitution-rationale.md `§X` reference resolution (both directions).

## Work performed (authored by this qa-engineer session)

Authored `test/compose-equivalence.test.mjs` (new file, 14 tests):

- 8 tests replaying `buildPromptForRole()` for every build-mode fixture in
  the architecture's Golden-Snapshot cross-product table (lite/full ×
  design/non-design × fullDetail on/off), asserting **strict `assert.equal`**
  (no normalization) against the committed golden fixture.
- 2 tests spawning `bin/agent-governance-context.mjs` (default env, and
  `AGC_DEFAULT_SKILL=full`) and asserting strict equality of the sliced
  constitution portion against `hook-lite.txt`/`hook-full.txt`.
- 1 test asserting `cat` of the 15 `CONSTITUTION_SEGMENTS` fragments (read
  directly from `content/`, in manifest order) is byte-identical to the
  committed `constitution-monolith.txt` fixture (AC8's "single source of
  truth" invariant, made mechanically checkable).
- 3 tests on `content/constitution-rationale.md`'s `§X` references: (a) every
  `see Constitution §X` reference resolves to exactly one fragment heading
  (forward direction, dynamically parsed — not a hardcoded list); (b) at
  least one of `const-08`/`const-11` retains the constitution's forward
  mention back into `constitution-rationale.md` (old L57/L74 pointers,
  reverse direction); (c) the doc's declared scope (§1, §3.1, §3.2, §5, §7)
  each has a live heading somewhere in the fragment set.

## Verification

- `node --test test/compose-equivalence.test.mjs`: **14/14 pass, 0 fail**.
- Prior to authoring the automated test, manually replayed all 10 dispatch
  modes via ad-hoc `node --input-type=module` scripts against the current
  `dist/` build and confirmed byte-for-byte match with each fixture — the
  automated test formalizes exactly this manual check, so there is no gap
  between "what was manually verified" and "what the test asserts."
- Confirmed the test uses NO normalization (`assert.equal`, not a
  whitespace-trimmed or regex-based comparison) — matches the architecture's
  explicit requirement ("Option R guarantees literal identity... no
  normalization step").
- Confirmed the workspace-construction helper (`makeWorkspace`) mirrors
  `scripts/capture-constitution-golden.mjs`'s `makeWorkspace` exactly (same
  feature id, same design-file shape) — a mismatch here would make the
  comparison meaningless even if it passed.

## Verdict
PASS. AC2–AC5 equivalence is now empirically pinned by an automated,
committed test — not just verified by hand during this review.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

