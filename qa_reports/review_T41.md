# QA Review: T41 — Lite Mode Coordinator (`/teamwork-lite` entry point)

> @qa-engineer · 2026-05-20

## Spec-to-Test Map

| AC | Test(s) | Status |
|---|---|---|
| AC1: `content/skill-coordinator-lite.md` exists with required sections + hard rules | `teamwork-lite.test.mjs` t1 | ✅ PASS |
| AC2: `prompts/coordinator-lite.ts` exports `buildCoordinatorLitePrompt` | `teamwork-lite.test.mjs` t2 | ✅ PASS |
| AC3: `index.ts` registers `teamwork-lite` in ListPrompts | `teamwork-lite.test.mjs` t3 (boot subprocess + prompts/list) | ✅ PASS |
| AC3b: `index.ts` dispatches `teamwork-lite` in GetPrompt | `teamwork-lite.test.mjs` t5 (boot subprocess + prompts/get) | ✅ PASS |
| AC4: `RAG_SKIP_ROLES` contains `'teamwork-lite'` | `teamwork-lite.test.mjs` t4 (grep compiled build.js) | ✅ PASS |
| AC5: Build + tests pass, zero skips | full `npm test` run | ✅ PASS — 235/235 pass, 0 skipped |
| AC6: README documents `/teamwork-lite` | — | ⏸ DEFERRED to T42 (per spec) |

## Phase 1 — Correctness Review

- **Skill file** (`content/skill-coordinator-lite.md`): correctly establishes lite mode as server-read-only. Hard rules explicitly enumerate the four state-writing tools that must NOT be called (`tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`) and cite the underlying constraint (`tools/transitions.ts` AgentName union). This prevents agents from attempting writes and getting `AGENT_ID_REQUIRED` rejections.
- **Prompt wrapper** (`prompts/coordinator-lite.ts`): mirrors the existing pattern from `prompts/coordinator.ts` exactly — thin delegator to `buildPromptForRole`. Description string is informative ("Direct execution, no chain, no state writes."). No new exports beyond the documented function.
- **`index.ts` integration**: import added at line 31 (alphabetical-ish co-location with `buildCoordinatorPrompt`); ListPrompts entry placed between `teamwork` and `architect` (logical grouping); GetPrompt dispatch added in parallel. No existing prompt handling touched.
- **`prompts/build.ts` RAG_SKIP_ROLES**: correctly adds `'teamwork-lite'` alongside `'teamwork'` with rationale in the inline comment. Lite triage doesn't need PRD chunks — consistent with original `'teamwork'` rationale.
- **Constitution single-source-of-truth preserved**: lite prompt loads full constitution as-is (verified in t5). No constitution forking — matches spec's explicit Out-of-Scope.
- **No security surface added**: no new input boundaries, no new exec paths, no new auth surface. Pure additive prompt registration.

## Phase 3 — Tests

- 6 new tests in `test/teamwork-lite.test.mjs` covering AC1, AC2, AC3, AC3b, AC4, plus a boundary case (unknown workspace_path).
- Test strategy:
  - Unit-style file-existence + content greps for skill/source (AC1, AC2, AC4).
  - Integration-style: spawn `dist/index.js` as MCP server subprocess, exercise `prompts/list` and `prompts/get` JSON-RPC (AC3, AC3b). Runs headlessly, no human interaction.
  - Boundary: unknown workspace_path graceful path.
- Coverage: 100% of the new public surface (one exported function + one prompt registration + one Set entry). Constitution + storage layers untouched, no coverage delta needed.

## Phase 4 — Run

- `npm run build`: ZERO TypeScript errors.
- `npm test`: **235/235 pass, 0 skipped, 0 failed, 0 cancelled.** CI-runnable (no human interaction).
- Smoke verification: live MCP boot returns `teamwork-lite` in prompts/list and serves the 7883-char lite prompt on prompts/get.

## Verdict

**PASS** — all 5 in-scope ACs met (AC6 deferred to T42 per spec). T41 implementation is minimal, additive, and preserves the single-source-of-truth constitution invariant. Lite mode's server-read-only contract is correctly enforced through documentation (skill hard rules) rather than code changes, which matches the user-chosen MVP path.
## 2026-05-20T07:27:05.263Z — PASS — by qa-engineer

T41 PASS — all 5 in-scope ACs met (AC6 deferred to T42 per spec). 6 new tests pass (235/235 total, 0 skipped). Lite mode entry point is minimal + additive: new skill file, new prompt wrapper, 2 index.ts hooks, 1 RAG_SKIP_ROLES entry. Constitution single-source-of-truth preserved. See qa_reports/review_T41.md.

