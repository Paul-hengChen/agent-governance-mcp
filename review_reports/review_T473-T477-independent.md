# Independent Re-Review — backlog-batch-v3.24.0 (T473–T477)

> Ad-hoc independent review requested by the human AFTER the chain reached
> `(qa-engineer, PASS)`. **Caveat (same-context bias):** this reviewer ran in
> the same session/context that orchestrated the implementation — NOT the
> clean-context isolation the role mandates. Findings below are argued from the
> diff + repo facts to mitigate that bias, but a truly independent pass is
> recommended.

## Summary
- Scope: B5 (release staging list), B2 (budget cap 2100→2300), B3 (dynamic version test), B1 (spec wording). Diff is SOP/test/spec text only — no compiled source.
- B2, B1, B3 are essentially correct (one low-severity regex nit on B3).
- **B5 is broken in a way that defeats its own purpose** (Finding 1) — and the guard test written to prevent exactly this was neutered to make it pass.
- Version bump to 3.24.0 is claimed (backlog + spec) but **nothing in the diff sets it** (Finding 3).
- **Verdict: CHANGES_REQUESTED.**

## Correctness
- **[HIGH] `transport/` omitted from B5 staging fix AND excluded from the guard — `transport/http.ts` can silently fall out of releases.** (`content/skill-release-engineer.md` SOP step 7; `test/release-staging.test.mjs:51` EXCLUDED_DIRS; `templates/claude-code-agents/release-engineer.md`)
  `transport/http.ts` is a first-class source dir: imported by `index.ts:13` (`import { createHttpTransport } from "./transport/http.js"`), listed in `tsconfig.json` `include` (`transport/**/*.ts`) right beside tools/guards/prompts/schema/lib, and compiled to the git-tracked `dist/transport/http.js`. The B5 staging enumeration adds `lib/ tools/ schema/ guards/ prompts/ bin/ scripts/` but **omits `transport/`**. Worse, the new AC-B5.5 guard test — whose entire job is "no source dir silently falls out of releases" — lists `transport` in `EXCLUDED_DIRS`, so it does **not** flag it. Net: the exact bug B5 exists to fix (a `tools/drift.ts`-style source/dist divergence) remains live for `transport/`, while the suite shows 499/499 green. Failure scenario: a future feature edits `transport/http.ts` → release-engineer follows the SOP list → commit ships `dist/transport/http.js` but not the `.ts` source → tag has source lagging dist, identical to the v3.23.1 post-mortem. **Fix:** add `transport/` to the staging enumeration (SOP + template), to `FEATURE_DIRS`, and remove it from `EXCLUDED_DIRS`.
- **[LOW] B3 version regex escapes only `.`, not all semver metacharacters.** (`test/subagent-templates.test.mjs`) `escapedVersion = expectedVersion.replace(/\./g, "\\.")` handles dots but not `+` (build metadata) — a version like `3.24.0+build1` would inject an unescaped regex `+`. Not triggered by the repo's plain `X.Y.Z` scheme, so latent only. Fix: escape all regex metachars (or compare the captured literal with `===`).

## Quality
- **[LOW] `scripts/` added beyond spec.** AC-B5.1 enumerates `tools/ schema/ guards/ prompts/ bin/`; the implementation also stages `scripts/` (and lists it in FEATURE_DIRS). Defensible (it holds `.mjs` and the B5.5 scan would otherwise flag it), but it is scope beyond the written AC and undocumented as a decision. Harmless; note only.
- EXCLUDED_DIRS in the test diverges from the spec AC-B5.5 list (spec named qa_reports/review_reports/specs; test drops those but adds `transport`). The dropped ones are harmless (no `.ts/.mjs`), but the **added `transport`** is the substantive divergence flagged in Finding 1.

## Architecture
- **[MEDIUM / altitude] The guard reinvents source-dir detection with a hand-maintained exclusion list instead of deriving from `tsconfig.json` `include` — the single source of truth.** (`test/release-staging.test.mjs` AC-B5.5) `tsconfig.include` already enumerates exactly the TS source roots (`tools, guards, prompts, schema, transport, lib`). The guard instead scans for `.ts/.mjs` files and subtracts a hardcoded `EXCLUDED_DIRS` set — which is precisely how `transport/` slipped through (someone added it to the exclusion list rather than the staging list). A guard that parsed `tsconfig.include` and asserted each entry's top dir is in FEATURE_DIRS would have caught `transport/` automatically and cannot drift. This is the deeper fix; the current approach is a bandaid that already failed once in this very diff.

## Security
- No new injection vectors, secrets, or boundary changes. SOP/test/spec text only.

## Performance
- No hot-path or complexity-class impact. The B5.5 test does one `readdirSync` per top-level dir at test time — negligible.

## Verdict
**CHANGES_REQUESTED** — Finding 1 (transport/ omitted from staging and hidden from its own guard) reintroduces the exact source/dist divergence B5 was created to prevent; the green suite is false confidence. Recommend: (a) add `transport/` to staging enumeration + FEATURE_DIRS, remove from EXCLUDED_DIRS; (b) prefer deriving the guard from `tsconfig.include` (Finding 2); (c) add the missing 3.24.0 version-bump + CHANGELOG task before release (see process note below).

## Process note (not a code defect)
- Backlog rows B1/B2/B3/B5 are marked **done (v3.24.0)**, and the spec says "ships all four as a single MINOR bump," but `package.json`/`index.ts` are still `3.23.1`, no `CHANGELOG [3.24.0]` entry exists, and the T473–T477 task list contains **no version-bump task**. Either the bump is deferred to release-engineer (then the backlog "done (v3.24.0)" labels are premature) or a task is missing. Resolve before tagging so `check-version`/CHANGELOG stay coherent.
