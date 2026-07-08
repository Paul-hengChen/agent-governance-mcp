# QA Review: c6-c11-prompt-state-injection

covers: C6-01, C6-02, C6-03, C11-01, C6C11-ARCH, C6C11-QA

Reviewer: qa-engineer (opus). Base: uncommitted working tree vs HEAD, on top
of code-reviewer's APPROVED verdict (`review_reports/review_C6C11-REV.md`).
Inputs: `specs/c6-c11-prompt-state-injection.md`,
`specs/c6-c11-prompt-state-injection-architecture.md`, the same 5 production
files code-reviewer verified, plus the full test suite.

## Summary

- **Phase 0** — claimed the review (`tw_update_state agent_id=qa-engineer`).
- **Phase 1 (re-review)** — read `prompts/build.ts`, `index.ts`,
  `tools/registry.ts`, `bin/agent-governance-context.mjs` against the
  architecture's Interface Contracts / Copy-Strings / File-by-file diff plan.
  No discrepancies found; implementation matches the blueprint exactly
  (independent confirmation of code-reviewer's APPROVED verdict — QA does not
  re-litigate correctness/architecture per SOP scope, this was a
  spec/test-mapping pass only).
- **Copy Audit Gate (3a)** — S01a/S01b/S02/S03 strings in `prompts/build.ts`
  compared verbatim against the architecture's "Copy / Strings (resolved
  variants)" table: match. No drift, no coverage gap (every user-facing
  string introduced by this feature is documented in the spec/architecture).
- **Visual Audit Gate (3b) / Phase 1.5** — N/A. Spec Visual Tokens/Widgets are
  both `N/A` ("feature has no visual surface"); no `design/c6-c11-prompt-state-injection.md`
  exists. Skipped per SOP, logged here as required.
- **Phase 2** — no issues found in Phase 1; proceeded directly to Phase 3.
- **Phase 3 (tests)** — see AC→Test map below. New file
  `test/prompt-state-footer.test.mjs` (16 tests); extended
  `test/context-budget.test.mjs` with 1 new AC-9 test; fixed the confirmed
  test-isolation defect in `test/context-budget.test.mjs`'s `runHook()`
  helper (§2 QA-owned fix, code-reviewer N2 — see "Test-isolation fix" below).
- **Phase 4 (run)** — `npm run build` zero errors; `npm audit --audit-level=high`
  zero high/critical (one pre-existing low-severity `esbuild` dev-dependency
  advisory, unrelated to this feature, out of scope); `npm test` — **923/923
  passing**, including the previously-flaky `teamwork-lite.test.mjs` AC3b run
  twice back-to-back with `test/context-budget.test.mjs` to confirm the
  isolation fix holds under repetition.
- **AC-10** — `test/fixtures/compose-golden/*` confirmed byte-identical
  (`git status`/`git diff --stat` on the fixture directory: no changes) —
  matches the architecture's prediction that C6/C11 never touch the captured
  slice (footer lives after the skill separator; the omit branch is
  handler-driven, never exercised by the golden-capture script's default
  `omitConstitution=false` calls).
- **Verdict: PASS.**

## Test-isolation fix (§2, code-reviewer N2)

`test/context-budget.test.mjs`'s `runHook()` ran the SessionStart hook with
`CLAUDE_PROJECT_DIR: ROOT` (this repo's own root), so the hook's C11-01 L2
marker write landed in this repo's real `.current/.agc-hook-marker.json`. That
marker is deliberately cross-process (`hookMarkerFresh` reads it from disk by
design, DR-4), so a *later, separate test-process* —
`test/teamwork-lite.test.mjs` AC3b — spawning the real server against
`PROJECT_ROOT` (== the same `ROOT`) within the 120s window correctly (per the
fail-safe design) substituted S03 for the constitution, failing AC3b's
`# Constitution v` assertion. Confirmed by code-reviewer as test-infra, not
product: **fixed by isolating `runHook()`'s workspace** — every call now gets
a fresh temp dir with its own `.current/` marker (satisfies `isManagedWorkspace`)
so the L2 marker it writes never touches the real repo, and the temp dir is
deleted immediately after. No assertion was loosened; AC3b keeps its
unqualified S03-must-be-absent check. Also removed a stray
`.current/.agc-hook-marker.json` left over from a pre-fix `npm test` run
(gitignored, ephemeral — cosmetic cleanup only, not a functional fix).
Reconciled per AC-10/AC-11: re-ran `test/context-budget.test.mjs` +
`test/teamwork-lite.test.mjs` + `test/prompt-state-footer.test.mjs` +
`test/compose-equivalence.test.mjs` together, twice, to confirm no flakiness.

## Spec-to-Test map

| AC | Description | Test(s) |
|----|---|---|
| AC-1 | Genuinely fresh project still says so, unambiguously (S01b) | `test/prompt-state-footer.test.mjs`: "AC-1/S01b: genuinely fresh managed workspace…", "AC-1: S01b threads all three resolution-source values verbatim" |
| AC-2 | Wrong-path resolution visible, never masked as fresh (S01a) | "AC-2/S01a: unmanaged path renders 'resolution suspect'…" (asserts path+source shown, literal unqualified "Fresh project" absent) |
| AC-3 | Read/parse errors surface loudly, never as "no state" (S02) | "AC-3/S02: malformed YAML frontmatter…", "AC-3/S02: a future schema_version (refuse-loud migration throw)…" |
| AC-4 | Workspace resolution consistent within a session (env threading) | "AC-4/AC-7/AC-8/DR-5/e2e: env threading, arg-priority-over-env, L1 same-process dedup…", "AC-4/e2e: … cwd fallback" — both exercise the REAL `index.ts` handler end-to-end (spawned server + JSON-RPC), since `resolveWorkspacePath` isn't independently importable |
| AC-5 | Regression test for C6 | `test/prompt-state-footer.test.mjs` itself (new file) |
| AC-6 | Stale `prd_path` guard regression-locked (C6-03/DR-7) | "C6-03/AC-6: a stale (nonexistent) state.prd_path degrades to null…", "…degrades to the auto-discovered PRD.md…", "…null state degrades gracefully…", "…a LIVE (existing) state.prd_path is still trusted verbatim" |
| AC-7 | Single constitution delivery per session (hook→prompt, L2) | "C11/AC-7 L2: a fresh hook marker (<120s) causes the FIRST fetch…", "C11/AC-7 L2 fail-safe: stale/malformed/absent markers…", plus the L1 half of the AC-4 e2e test |
| AC-8 | Two `/teamwork*` fetches don't double the constitution (L1) | The AC-4 e2e test's 2nd request (`teamwork` → `teamwork-lite`, same workspace) |
| AC-9 | Token saving is measurable | `test/context-budget.test.mjs`: "AC-9: omitConstitution=true bundle is measurably smaller… by a concrete floor" (measured 2575→1070 ~tok, floor pinned at ≥1200 ~tok saved) |
| AC-10 | No silent golden-fixture drift | Confirmed via `git status`/`git diff --stat` on `test/fixtures/compose-golden/` — zero changes; documented above |
| AC-11 | Full suite green | `npm test` — 923/923 passing |
| DR-5 | S03 recovery clause makes false-omission self-healable | AC-4 e2e test asserts the verbatim recovery clause string; "DR-6: omitConstitution=true changes ONLY the constitution slice…" asserts it too |
| DR-6 | `buildPromptForRole` purity | "DR-6: buildPromptForRole is pure — repeated omit=false calls…", "DR-6: omitConstitution=true changes ONLY the constitution slice…" |
| task item 2 | Normal handoff → state JSON unchanged | "normal handoff: state parses -> JSON state block renders exactly as before C6…" |

## Security smoke

- Boundary inputs exercised: empty/unmanaged workspace (S01a), malformed YAML
  (S02), a `schema_version` far above `CURRENT_VERSIONS.handoff` (S02, refuse-loud
  throw path), a malformed (non-JSON) L2 marker file, a stale absolute
  `prd_path` pointing at a nonexistent file. All degrade fail-safe (emit /
  auto-discover / null) — none throw uncaught, none inject a nonexistent path
  as live content.
- No new auth/permission surface (feature is server-internal prompt
  composition; no tool-call access-control change).

## Coverage

New/modified test-owned files: `test/prompt-state-footer.test.mjs` (new, 16
tests, 100% of its own assertions exercise the feature's new code paths) and
`test/context-budget.test.mjs` (+1 test, +1 isolation fix, 0 assertions
removed/weakened). Production files touched by this feature
(`prompts/build.ts`, `index.ts`, `tools/registry.ts`,
`bin/agent-governance-context.mjs`) are each exercised by at least one new
test above and by the pre-existing suite (`compose-equivalence.test.mjs`,
`teamwork-lite.test.mjs`, `context-budget.test.mjs`'s existing AC1-AC9
suites) — no tooling gap; coverage is asserted by direct AC mapping above
rather than a line-coverage percentage (consistent with this repo's existing
convention across `test/*.test.mjs`).

## Verdict

**PASS.** All ACs (1–11) plus DR-5/DR-6 map to at least one passing test; the
Copy Audit Gate found zero drift/gaps; Visual Audit Gate is N/A; the
test-isolation defect flagged by code-reviewer is fixed without loosening any
assertion; `npm run build` / `npm audit --audit-level=high` / `npm test` all
green (923/923); golden fixtures untouched (AC-10).

Remaining for this feature (not qa-engineer's job, per C10 role boundary):
**C6C11-REL** (release-engineer: version bump, CHANGELOG, build, tag) and
**C6C11-DONE** (pm/coordinator: mark backlog C6/C11 done post-release).
## 2026-07-08T04:18:24.421Z — PASS — by qa-engineer

PASS. Fixed the confirmed test-isolation defect (context-budget.test.mjs runHook wrote a real L2 marker into this repo's own .current/, colliding with teamwork-lite.test.mjs AC3b) by isolating runHook to a throwaway temp workspace per call — no assertion loosened. Added test/prompt-state-footer.test.mjs (16 tests: AC-1/S01b, AC-2/S01a, AC-3/S02 incl. malformed YAML + future schema_version, normal-handoff-unchanged, DR-6 purity x2, C6-03/AC-6 resolvePrdPath guard x4, AC-4/AC-7/AC-8/DR-5 e2e via spawned server incl. cwd-fallback, C11 L2 fresh-marker-omit and stale/malformed/absent-fail-safe). Added AC-9 measurable-token-reduction test to context-budget.test.mjs (measured 2575->1070 ~tok, floor >=1200 saved). Copy Audit Gate: S01a/S01b/S02/S03 match architecture verbatim, zero drift/gap. Visual Audit Gate: N/A (no visual surface). test/fixtures/compose-golden/* byte-identical (AC-10, git diff --stat empty). npm run build zero errors; npm audit --audit-level=high clean (1 unrelated low-severity esbuild dev advisory); npm test 923/923 green, re-ran isolation-sensitive files twice for flake-check. Full report: qa_reports/review_C6C11-QA.md.

