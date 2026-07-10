# Review — T-D4-01, T-D4-02

covers: T-D4-01, T-D4-02

## Summary
- Interim review of the D4 behavioral-eval-harness foundation: bundle loader (`test/eval/lib/bundle.mjs`), frozen fixture workspace (`test/eval/fixtures/workspace/.current/handoff.md`), and `package.json` devDependency + `eval` script. Full-feature review (T-D4-08) runs later after T-D4-07.
- The loader is a thin, no-reimplementation wrapper over the compiled `buildPromptForRole` (`dist/prompts/build.js`), with a frozen 15-entry role→skill map and fail-loud unknown-role handling.
- All sr-engineer-claimed gates independently reproduced: `npm run build` clean, `npm test` 1089/1089 green, `npm audit --audit-level=high` exit 0.
- Behavioral verification passed: fixture isolation holds (live d4 feature never leaks into a bundle), bundles are byte-reproducible cross-process (sha256 stable across separate node processes), unknown role throws at resolve time, fixture unmutated. D2 file set untouched.
- Verdict: APPROVED.

## Correctness
No findings.
- `bundle.mjs:90-96` calls `buildPromptForRole(skillFile, description, workspacePath, fullDetail)` — arg order and arity match the source signature (`build.js:236`), and `result.messages[0].content.text` matches the returned shape (`build.js:340-348`). Verified by running.
- Fixture isolation (spec AC-8) confirmed empirically: `loadBundle("sr-engineer")` against the default `FIXTURE_WORKSPACE` contains `eval-fixture-feature` and does NOT contain the live `d4-behavioral-eval-harness` feature. `buildPromptForRole` reads state via `getActiveStorage().parse(workspacePath)`, which the default binds to the fixture, not this repo's live `.current/handoff.md`.
- Reproducibility confirmed: identical sha256 (`c6bc7e3674675492`) across two independent processes, so scenario bundles are deterministic run to run (AC-8 intent).
- Fixture non-mutation (AC-12) holds: the fixture is `schema_version: 8` (current), so no lazy migration arms; two full `loadBundle` runs left the file byte-identical.
- Lite compose mode routes correctly: `lite`/`coordinator-lite`/`teamwork-lite` all map to `skill-coordinator-lite.md`, which `build.js:267` uses to trip `isLite` and exclude chain fragments.
- Fail-loud unknown role (`bundle.mjs:60-68`): `skillFileForRole("nope")` throws with a role-list message before any API call — a typo'd scenario fails at load, not as a mystery reply.
- Expected-Red Sampling (SOP 4a) does not arm: `npm test` is fully green (1089/1089), `bundle.mjs` is a lib loader not matched by the `test/*.test.mjs` glob, and no intentionally-red tests exist — so no `expected-red_<feature>.txt` manifest is required.

## Quality
No blocking findings.
- All 15 role→skill map values resolve to real files under `content/` (verified `ls content/skill-*.md`); no dangling mapping that would throw at bundle time.
- Good hygiene: `Object.freeze` on the map and `KNOWN_ROLES`, JSDoc on public functions, override hooks (`skillFile`/`workspacePath`/`fullDetail`) with sensible defaults, `fullDetail=false` matching every real dispatch.
- Non-blocking observation: the header comment (`bundle.mjs:13-14`) states "parseHandoff is read-only (no migration write-back)" as a general claim; it is load-bearing here only because the fixture is pinned to current schema v8 (no migration path arms). Accurate for this fixture; would warrant re-checking only if a future fixture pins an older schema. No change required.

## Architecture
No findings. No `specs/d4-behavioral-eval-harness-architecture.md` exists (non-visual server-internal tooling; scope recorded `single-feature`). The loader honors the spec's central constraint (AC-8): it imports the compiled `dist/prompts/build.js` rather than re-implementing bundle assembly, so any future compose-pipeline change (fragment manifest, origin/rationale strip) flows into eval bundles on the next build. RAG spec-context injection (`appendSpecContext`) is intentionally not invoked — a file-mode fixture with no PRD would receive none in a real dispatch either, so parity holds.

## Security
No findings. No new trust boundary: the loader reads local content/fixture files only, introduces no secrets, and makes no network call (the API-calling runner is T-D4-07). The `@anthropic-ai/sdk` addition is a devDependency only (`package.json:47`), never loaded by `index.ts`/`dist/index.js`.

## Performance
No findings. `loadBundle` performs synchronous local file reads (constitution + skill + fixture state) per call — the same work any dispatch does; no hot-path or algorithmic regression. `npm test` runtime unchanged (~25s, 1089 tests).

## AC-9 wiring (verified)
`package.json` scripts: `pretest="npm run build"`, `test="node --test test/*.test.mjs"`, `eval="node test/eval/run-eval.mjs"`. The `eval` script is disjoint from `test`/`pretest`; `npm test` never invokes the live model. `test/eval/run-eval.mjs` is confirmed absent (intentional — T-D4-07); its absence does not affect `npm test` (the glob does not match `test/eval/**`).

## Verdict
APPROVED — T-D4-01 + T-D4-02 match the spec (AC-8/AC-9/AC-12 for the in-scope slice) with zero blocking findings; all claimed gates independently reproduced and fixture isolation/reproducibility empirically confirmed.
