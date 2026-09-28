# QA Review — T-CNSO-09 (compose-not-strip-overlays, ticket A9) — final gate

## Task
qa-engineer: full verification pass — `npm run build && npm test` green;
confirm `stripOriginTags` (A4) still runs correctly over the composed bundle
in all four modes; confirm zero changes to `tools/transitions.ts` /
`tools/evidence-file.ts` (AC10). Also performs AC8's final step: delete
`content/constitution.md` only after every caller is migrated.

## DR-6 migrations performed (this session, prerequisite to AC8 delete)

Migrated the 4 test files that read `content/constitution.md` directly
(sr-engineer's sweep, confirmed via a fresh independent grep first — same 4
files, same line numbers as the architecture doc's inventory):

- `test/agc-adapters.test.mjs` (L267ish, `AC-8` verbatim-line-check test) —
  swapped `fs.readFileSync(content/constitution.md)` for
  `composeConstitution({chain:true,design:true})`.
- `test/constitution-deliverable-guard.test.mjs` (L30-33, top-level
  `CONSTITUTION` const) — same swap.
- `test/skill-evolution-v3.11.test.mjs` (L96, `AC-10` test) — same swap.
- `test/widget-shape-spec.test.mjs` (L19 path const + L128/L138 reads) —
  `CONSTITUTION` is now the composed TEXT (was a path); both
  `fs.readFileSync(CONSTITUTION, "utf-8")` call sites simplified to use the
  text directly.

All four migrations are mechanical (read → `composeConstitution(all)`, which
Option R guarantees is byte-identical to the retired monolith) — no
behavior-assertion changed. Ran the 4 files directly after migrating:
`node --test test/agc-adapters.test.mjs test/constitution-deliverable-guard.test.mjs test/skill-evolution-v3.11.test.mjs test/widget-shape-spec.test.mjs`
→ **48/48 pass, 0 fail**.

## AC8 — delete content/constitution.md

Pre-delete sweep confirmed every live reader (non-comment, non-`dist/`) had
migrated: `prompts/build.ts`, `prompts/constitution-manifest.ts`,
`bin/agent-governance-context.mjs`, `scripts/measure-context-cost.mjs`,
`scripts/capture-constitution-golden.mjs` (guarded — gracefully skips its
monolith-recapture step post-delete, per its own comment), and the 4 test
files above. `lib/watermark-check.ts` L6 retains a comment-only mention
(architecture: "the comment may stay as-is (no code dependency)").

Ran `git rm content/constitution.md`.

## Full gate re-run (post-delete)

- `npm run build`: **exit 0**, zero `tsc` errors.
- `npm test`: **824/824 pass, 0 fail, 0 skipped**.
- `npm audit --audit-level=high`: **exit 0** (1 pre-existing low-severity
  `esbuild` advisory only; zero high/critical).
- `git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md`:
  **empty** (AC10 — no server-checked token/error-code touched across the
  cumulative ticket diff).
- `git diff main -- content/constitution-rationale.md`: **empty** (Out-of-Scope
  — rationale doc content untouched).
- `git status --short`: confirms no fence-marker validator file was added
  anywhere in the diff (AC11 — A3 stays superseded, not implemented).

## A4 (stripOriginTags) still correct

`test/compose-equivalence.test.mjs` and the retained T-GTS-07 tests in
`test/context-budget.test.mjs` both exercise `stripOriginTags` over the
newly composed bundle across all four dispatch modes (lite/full ×
design/non-design) and `fullDetail` on/off — all pass, confirming AC7 holds:
origin spans are stripped identically to before, regardless of which
fragment(s) they now live inside.

## Verdict
PASS. Full gate is green (build 0 errors, 824/824 tests, audit clean at
high threshold), AC8's single-source-of-truth is achieved (monolith deleted,
zero dual-maintenance), and AC10/AC11/Out-of-Scope constraints all hold with
zero diff on the protected files.

— @qa-engineer (sonnet)
## 2026-07-07T00:57:24.642Z — PASS — by qa-engineer

Independently re-verified the cut-off prior session's T-CNSO-07 claim (43/43 tests pass in test/context-budget.test.mjs, diff matches architect's spec: deleted stripChainOnly/stripDesignOnly unit+permutation tests, re-pointed CONSTITUTION fixture to composeConstitution(), kept stripRationale/stripOriginTags tests, added DR-4 manifest-not-duplicated assertion). Authored test/compose-equivalence.test.mjs (T-CNSO-08, 14 tests): byte-identity vs all 8 build-mode + 2 hook golden fixtures (strict assert.equal, no normalization), cat(15 fragments)===monolith invariant, constitution-rationale.md §X ref resolution both directions. Migrated DR-6's 4 test files (agc-adapters, constitution-deliverable-guard, skill-evolution-v3.11, widget-shape-spec) off content/constitution.md onto composeConstitution({chain:true,design:true}) — mechanical, no assertion change, 48/48 pass. Deleted content/constitution.md (AC8) after confirming zero live readers remained. Final gate: npm run build exit 0; npm test 824/824 pass, 0 fail; npm audit --audit-level=high exit 0 (1 pre-existing low esbuild advisory only). git diff main -- tools/transitions.ts tools/evidence-file.ts content/skill-*.md and content/constitution-rationale.md both empty (AC10, Out-of-Scope). No fence-marker validator added (AC11). AC1-AC12 all hold. T-CNSO-10 (doc-writer: CLAUDE.md + research/automation-and-rag.md prose) intentionally left open — not in qa-engineer scope.

