# Review — T-CNSO-02..06 (Compose-not-strip: overlay modules replace fence stripping)

> Reviewed by @code-reviewer (opus) — clean-context adversarial pass against
> `specs/compose-not-strip-overlays.md` (12 ACs) + `-architecture.md` (DR-1..DR-6).
> Diff reviewed: working-tree change set (build.ts, manifest, hook, measure
> script, 15 fragments) + committed golden capture `0d59bc5`.
> This report covers the batch T-CNSO-02, -03, -04, -05, -06 (one atomic
> refactor); identical copies filed per task id for the handoff guard.

## Summary
- Inverts constitution assembly from subtractive (`stripChainOnly`/`stripDesignOnly`) to additive composition from 15 verbatim monolith slices + a shared `constitution-manifest.ts` (CONSTITUTION_SEGMENTS + includeSegment). Verdict: **APPROVED**.
- **Byte-identity is real, independently reproduced** (not asserted): `cat`(15 fragments in manifest order) === `content/constitution.md` byte-for-byte (19099 B); `composeConstitution({chain:true,design:true})` === monolith; re-running the capture script against the POST-refactor `dist/` rewrote all 11 golden fixtures byte-identically (git clean) — the new pipeline reproduces the pre-refactor golden output for all 8 build modes + 2 hook modes.
- **Sequencing proof holds**: commit `0d59bc5` contains only the capture script + 11 fixtures and is the branch tip; every content/build.ts edit is uncommitted working tree, so the golden baseline provably predates the refactor.
- **No scope creep / no §2 violation**: `tools/transitions.ts`, `tools/evidence-file.ts`, all `content/skill-*.md`, `content/constitution-rationale.md`, and `content/constitution.md` are untouched; **no `*.test.mjs` edited** by sr (working tree or commit `0d59bc5`).
- **14 test failures are exactly as claimed**: 14/14 isolated to `test/context-budget.test.mjs`, every one a `TypeError: stripChainOnly/stripDesignOnly is not a function` (or the DR-3 3-copy assertion) — qa's T-CNSO-07 rework; the other 767 tests pass.

## Correctness
- `prompts/build.ts:291-327` — pipeline order matches architecture §Composition Contract exactly: `composeConstitution({chain:!isLite, design:isDesignFeature})` → `stripOriginTags` (always, AC7) → `fullDetail ? originClean : stripRationale(originClean)` (AC5/AC6). Verified against fixtures.
- Safe default (AC3) correct: `const isDesignFeature = state?.active_feature ? hasDesignModeRequiringVisual(...).required : false` — no state / no active_feature → `design:false` → design fragments excluded. Confirmed byte-identical to golden `build-full-nondesign.txt`.
- `prompts/constitution-manifest.ts:59-73` — `includeSegment` exhaustive over the closed 4-member `SegmentTag` union; every case returns; compiles clean with no missing-return. Predicates match the architecture table (`core`→true, `design`→design, `chain`→chain, `chain-design`→chain&&design).
- `composeConstitution` uses `.join("")` (no separator) — fragments carry their own newlines; the perfect byte-identity result confirms the boundary-blank-line assignment (arch note: blanks belong to the preceding fragment) was executed correctly. 168-line partition, zero gaps/overlaps.
- Hook `bin/agent-governance-context.mjs:70-83` — `composeConstitution(wantChain)` always passes `design:true` (hook never stripped design; matches AC9), applies `\n{3,}→\n\n` collapse only when `!wantChain` (lite). Byte-identical to golden `hook-lite.txt` / `hook-full.txt`.
- No behavior-regression on the missing-file path: old `loadContent("constitution.md")` threw on absence; new `composeConstitution` (build.ts, un-try/caught) throws the same way if a fragment is missing — same failure class, not a new silent-degradation surface.

## Quality
- Markers retained per DR-1 Option R, spot-checked: `chain-only:start` in `const-06`, `chain-only:end` in `const-14`, `design-only` pairs in `const-02`/`const-07`; balance is 1 chain-only pair + 6 design-only pairs across all fragments; the 4 `core` fragments (01/03/05/15) carry zero structural markers. Markers are genuinely inert (composition selects by tag, never parses them).
- Comment blocks on `composeConstitution`, `stripOriginTags`, and the manifest are updated accurately to the new model; stale DR-3 "keep the regex in sync" language is correctly replaced by the structural single-manifest contract (DR-4). The only remaining `stripChainOnly`/`stripDesignOnly` mentions in non-test source are comments — no dead functional references.
- `scripts/capture-constitution-golden.mjs` post-commit change is a benign `fs.existsSync(monolithPath)` guard so the script survives the eventual T-CNSO-09 monolith delete; it does not alter the committed fixtures and is the sr's own script (not test logic). In-scope, sound.

## Architecture
- Fully conforms to the blueprint: 15 fragments with the exact tags/order of the CONSTITUTION_SEGMENTS table; single-source-of-truth manifest imported by build.ts (static), hook (dynamic from `dist/`), and measure script (dynamic from `dist/`) — DR-4 satisfied structurally. DR-1 (markers retained, zero normalization), DR-2 (interleaving preserved, no restructure), DR-3 (two design tags at 6 positions) all honored.
- AC6: `constitution-rationale.md` is never loaded by any of the three consumers (compose reads only const-01..15); inline rationale spans stripped for non-fullDetail, kept for fullDetail — confirmed via `*-fd.txt` vs non-fd fixtures.
- AC8/AC11 respected: monolith deletion correctly deferred to T-CNSO-09 (after qa migrates the 4 fixture-reading test files); no fence-marker validator added.

## Security
- No new external input, injection vector, secret, or unvalidated boundary. `pathToFileURL` used for both dynamic imports (hook L74, measure script) — correct, avoids Windows path-as-URL issues. Fragment reads go through the existing `loadContent` (fixed content/ or `.current/` override, no user-controlled path). No security regression.

## Performance
- No regression. Composition does N file reads (N≤15) where the old path did 1 read of the monolith — marginally more `fs.readFileSync` calls, all at build/prompt-assembly time (not a hot loop), reading the same total bytes. No new O(n²), no unbatched I/O in a hot path, no unbounded cache/listener. Acceptable and consistent with the architecture's stated cost ("more files, each independently lintable").

## Verdict
**APPROVED** — byte-identity independently reproduced across all 10 dispatch modes + the `cat==monolith` invariant; pipeline order, marker retention, and scope boundaries all conform to spec/architecture; the 14 failures are exactly the qa-owned T-CNSO-07 rework, no silent regression. Route to qa-engineer for T-CNSO-07/08 (test rework + empirical equivalence test) and the AC12 full-green gate.
