# Review — D1-03

covers: D1-01, D1-02, D1-03

## Summary
- Feature: `d1-prompt-arg-workspace-fallback`. Implementation (D1-01, `index.ts` `looksLikePath()` + gated
  `resolveWorkspacePath()`) already code-reviewer APPROVED — `review_reports/review_D1-02.md`, AC-1/2/3/5
  confirmed matching spec Mechanism byte-for-byte, `prompts/build.ts` untouched.
- QA scope (D1-03): extend test coverage for AC-1, AC-3, AC-4, AC-5, AC-6, then run build + audit + full
  suite green (AC-7).
- Phase 0.5 (Expected-Red Diff): no `qa_reports/expected-red_d1-prompt-arg-workspace-fallback.txt` manifest
  present — **skipped (no expected-red manifest declared)**. Any red in the full run below is a real failure.
- Phase 1 (Review): re-read `index.ts` `looksLikePath`/`resolveWorkspacePath` against
  `specs/d1-prompt-arg-workspace-fallback.md` Mechanism/AC list independently of the code-reviewer pass — no
  new findings; concur with `review_D1-02.md`'s verdict. Confirmed via direct read that `index.ts`'s
  top-level IIFE (`(async () => { ... })()`, lines 213+) has no import-guard, so `resolveWorkspacePath`/
  `looksLikePath`, though exported, cannot be safely imported in-process by tests (would hijack the test
  runner's own stdin/stdout) — consistent with the existing suite's own header comment. All new tests
  therefore spawn the real compiled server via the existing `sendPromptRequests` e2e harness, matching the
  pattern already used for AC-4/AC-7/AC-8.
- Copy/Visual/Widgets Audit Gates (3a/3b): spec's Copy/Strings, Visual Tokens, Visual Widgets tables are all
  `N/A` (server-internal, no user-facing copy or design literals) — no drift, no coverage gap.
- Phase 1.5 (Visual Compare): no `design/d1-prompt-arg-workspace-fallback.md` file exists — **skipped (no
  Visual Baselines declared)**.
- Phase 3 (Tests): extended `test/prompt-state-footer.test.mjs` (existing, relevant file — no sibling file
  needed) with 4 new tests in a new "D1 — prompt-arg-workspace-fallback" section, appended after the last
  pre-existing test. Zero pre-existing assertions modified, weakened, or deleted.

## AC → Test Map

| AC | Covered by | Notes |
|---|---|---|
| AC-1 (non-path-shaped arg falls back to env/cwd chain) | `D1/AC-1: non-path-shaped (free-text) arg falls through to the CLAUDE_PROJECT_DIR env chain, never treated as a path` | Free text uses non-Latin script + no `/`,`\`,`.`,`~`; asserts `source` = env, never `"workspace_path arg"`, and the rejected string never appears in output. |
| AC-2 (existing-directory arg unchanged) | pre-existing `AC-4/AC-7/AC-8/DR-5/e2e` test's 3rd fetch (`wsArg`, a real existing dir, via `workspace_path` arg) | Already exercised before D1; unmodified; still green — confirms no regression. Not modified by this task (assignment explicitly scoped D1-03 to AC-1/3/4/5/6, not AC-2). |
| AC-3 (path-shaped-but-missing arg: regression-locked) | `D1/AC-3: path-shaped-but-nonexistent arg stays literal and still renders S01a — regression-locked, byte-identical to pre-D1` | Nonexistent absolute tmp path; asserts S01a "resolution suspect" fires, `resolved` stays the literal bogus path, `source` stays `"workspace_path arg"`. |
| AC-4 (end-to-end repro fixed) | `D1/AC-4: end-to-end repro — a real /teamwork* free-text arg in a real managed workspace renders live state, not S01a` | Reproduces the 2026-07-10 live-repro conditions verbatim (free-text arg, `.current/handoff.md` state written): asserts the normal `## 📍 Current Project State (Auto-injected)` JSON block renders with the real `active_feature`, and S01a never fires. |
| AC-5 (absent-arg behavior unchanged) | `D1/AC-5: absent workspace_path arg is byte-identical to pre-D1 — still resolves via CLAUDE_PROJECT_DIR env untouched` (dedicated) + every pre-existing `arguments: {}` case in the file (unmodified, still green) | Dedicated regression test added for direct D1 traceability per SOP's spec-to-test map requirement, on top of pre-existing implicit coverage. |
| AC-6 (existing C6 footer tests still pass) | Entire `test/prompt-state-footer.test.mjs`, all pre-existing tests above the new section, byte-for-byte unmodified | Verified green in the full run below. |
| AC-7 (full suite green) | `npm run build` + `npm audit --audit-level=high` + `npm test` | See Phase 4 below. |

## Phase 4 — Run

- `npm run build`: clean, zero `tsc` errors.
- `npm audit --audit-level=high`: exit code 0. One pre-existing **low**-severity advisory (`esbuild` 0.27.3–0.28.0,
  GHSA-g7r4-m6w7-qqqr, Windows dev-server arbitrary file read) — below the `high` gate, unrelated to this
  feature (dev dependency, not touched by D1), not a new regression.
- `npm test`: **1071/1071 passing, 0 failing, 0 skipped.** No expected-red manifest existed, so this is a
  clean full-green run per SOP Phase 0.5's absent branch.
- `git diff --stat` confirms the only files touched across D1-01→D1-03: `index.ts` (+19, sr-engineer),
  `dist/index.{js,d.ts}` (+ maps, build artifact of the same), and `test/prompt-state-footer.test.mjs` (+121,
  this task). `prompts/build.ts` remains untouched, matching the spec's Out-of-Scope clause.

## Verdict

**PASS.** AC-1/3/4/5/6/7 satisfied with new/confirmed test coverage; AC-2 confirmed unchanged via
pre-existing coverage. Build, audit, and full suite all green. No release bookkeeping performed here
(version bump / CHANGELOG / backlog marking are release-engineer's, per C10) — handing off to
release-engineer for D1-REL.
## 2026-07-10T10:45:19.700Z — PASS — by qa-engineer

D1-01/D1-02/D1-03 PASS. Phase 0.5: skipped (no expected-red manifest). Phase 1: concur with code-reviewer's APPROVED (review_reports/review_D1-02.md) — looksLikePath()+gated resolveWorkspacePath() matches spec Mechanism byte-for-byte, prompts/build.ts untouched. Copy/Visual/Widgets gates: N/A per spec (server-internal feature). Phase 1.5: skipped (no Visual Baselines). Phase 3: extended test/prompt-state-footer.test.mjs with 4 new e2e tests (spawned real server, since index.ts's unguarded top-level IIFE prevents in-process import) covering AC-1 (free-text arg falls to env/cwd chain, string never surfaced), AC-3 (path-shaped-missing arg stays literal, S01a fires, regression-locked), AC-4 (end-to-end repro: real managed workspace + free-text arg renders live state, not S01a), AC-5 (absent arg unchanged, dedicated regression test). AC-2 confirmed unchanged via pre-existing e2e test (unmodified). AC-6: zero pre-existing assertions modified/weakened. Phase 4: npm run build clean; npm audit --audit-level=high exit 0 (1 pre-existing low-severity esbuild advisory, unrelated dev dep); npm test 1071/1071 passing, 0 fail. AC-7 satisfied. Evidence: qa_reports/review_D1-03.md (covers: D1-01, D1-02, D1-03). No release bookkeeping performed (release-engineer owns D1-REL per C10).

