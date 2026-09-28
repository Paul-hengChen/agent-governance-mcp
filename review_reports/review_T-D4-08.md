# Review — T-D4-08 (full-feature review, d4-behavioral-eval-harness)

covers: T-D4-08

## Summary
- Full-feature review of the entire D4 diff: `test/eval/lib/bundle.mjs`, `test/eval/lib/assertions.mjs`, `test/eval/scenarios.mjs`, `test/eval/run-eval.mjs`, `test/eval-assertions.test.mjs`, `test/eval/fixtures/workspace/.current/handoff.md`, and `package.json` (SDK devDep + `eval` script). All files new/untracked except `package.json`.
- Verified against the spec's 12 ACs, all canonical sources (const-01 §1, const-05 §3, `dist/lib/watermark-check.js`), and re-checked the interim-APPROVED `bundle.mjs` for regressions — none.
- Build clean (exit 0); full suite 1106/1106 pass, 0 fail; D2 file-set (`tools/handoff-orchestrator.ts`, `content/skill-coordinator.md`, `schema/migrations-handoff.ts`, `tools/handoff.ts`) untouched — disjointness holds by construction.
- `npm run eval` was NOT run live (qa's T-D4-09 smoke owns API spend), per review scope.
- Verdict: APPROVED.

## Correctness
No blocking findings.
- **AC-11 ordering** (`run-eval.mjs:42-47`, `91-96`): `ANTHROPIC_API_KEY` presence is checked before any dynamic import; both `scenarios.mjs` (which eagerly assembles bundles at module load, `scenarios.mjs:175-178`) and `@anthropic-ai/sdk` are imported only inside `main()` after the guard. Missing key → `process.exit(1)` with a one-line message naming the var, zero work done. Correct.
- **AC-10 exit semantics** (`run-eval.mjs:125-138`): per-scenario PASS/FAIL lines, failing-assertion reasons enumerated, summary count, `process.exit(failed > 0 ? 1 : 0)`. Per-scenario API errors are caught (`120-123`) → one synthetic FAIL verdict, loop continues (no retry, per Out-of-Scope). Correct.
- **AC-4 escalation shape** (`assertions.mjs:106-117, 195-214`): paren-depth-balanced extraction (`findEscalationCallBody`) is robust against nested parens inside `pending_notes` string args; requires all four keys via `\b<key>\s*=` and `status ∈ {Blocked,FAIL}` (case-insensitive), order-flexible. Matches const-05 §3 exactly.
- **AC-3 terse cap** (`assertions.mjs:154-179`): four exemptions (markdown table, blocker/escalation, assumption-gap §7, acceptance-criteria) mirror const-01 §1's carve-out list verbatim; the escalation exemption shares `extractEscalationCall` with the AC-4 checker so the two can never drift. Correct.
- **AC-2 watermark** (`assertions.mjs:61-69`): delegates to `validateWatermark(reply ?? "", name, tier)` — signature confirmed at `dist/lib/watermark-check.js:65` — which is itself built on `WATERMARK_REGEX`/`buildWatermark`. This is a stronger reuse than importing the two primitives directly and guarantees no disagreement with the coordinator's live post-validation. Correct.
- **AC-5 banned phrases** (`assertions.mjs:37, 227-234`): list `["好的","讓我為您","現在","我將"]` is byte-identical to const-01 §1:25. Substring match anywhere. Correct.
- No off-by-one, race, or unhandled-edge issues in the four checkers; empty/nullish replies are coerced (`?? ""` / `String(...)`) before matching.

## Quality
No blocking findings.
- Naming, JSDoc, and the Spec-to-Test map header in `eval-assertions.test.mjs` are exemplary; `TERSE_WORD_CAP`/`BANNED_PHRASES`/`ESCALATION_REQUIRED_KEYS` are named constants, never re-typed literals.
- Minor (non-blocking) spec-path looseness: spec AC-1/AC-6 prose names `test/eval/assertions.mjs`, while the implementation places it at `test/eval/lib/assertions.mjs`. The task scope and self-test (`ASSERTIONS_PATH`, `eval-assertions.test.mjs:43`) both use the `lib/` path consistently, and the `lib/` grouping (bundle + assertions) is a reasonable organization. Internally consistent; no action required.
- `t-no-io-imports` (`eval-assertions.test.mjs:59-66`) enforces AC-1 purity structurally — note it asserts `!src.includes("import(")`; `assertions.mjs`'s only import is the static `import { validateWatermark } from ...` (`import ` with a space), so no false trigger. Verified by the green run.

## Architecture
No findings.
- `bundle.mjs` is a thin wrapper over the compiled `buildPromptForRole` (`dist/prompts/build.js`) against the frozen fixture workspace (`test/eval/fixtures/workspace/`, schema v8, static timestamp) — satisfies AC-8 and keeps eval bundles reproducible and decoupled from the repo's live `.current/`. `parseHandoff` is read-only, so the fixture is never mutated (AC-12).
- Layering is clean: pure checkers (`lib/assertions.mjs`) ← scenarios (`scenarios.mjs`) ← runner (`run-eval.mjs`); the zero-cost self-test imports only the checkers, never scenarios/SDK, so `npm test` (glob `test/*.test.mjs`, top-level only) never assembles a bundle or touches the network (AC-6, AC-9). Matches the spec's intended structure.

## Security
No findings.
- No hardcoded secrets; `ANTHROPIC_API_KEY` read from env only. `new Anthropic()` uses the SDK's default env-based auth.
- No untrusted input crosses a trust boundary: scenario tasks are static in-repo strings, replies are only pattern-matched (no eval/exec/shell). `@anthropic-ai/sdk` is a devDependency, never imported by `index.ts`/`dist/index.js` (runtime server surface unaffected).

## Performance
No findings.
- Checkers are O(n) over reply length; scenario set is fixed at 7. Bundles are assembled once eagerly at import; the runner issues one API call per scenario sequentially (retry/backoff explicitly out of scope). No hot-path regression vs base — base had no eval harness.

## Verdict
APPROVED — all 12 ACs satisfied, build clean, 1106/1106 tests green, D2 disjointness intact, and the one low-severity audit advisory (esbuild via tsx) is pre-existing and not introduced by this diff. The lone Quality note (spec-vs-implementation path `lib/`) is cosmetic and internally consistent — no changes required. Routing to qa-engineer for T-D4-09 (full test green + live eval smoke).
