# QA Review — registry-pattern T-REG-01..09

Feature: `registry-pattern` (backlog A1) — tool/prompt registry refactor.
Scope: T-REG-01..07 (already code-reviewer APPROVED, see
`review_reports/review_T-REG-01.md`) plus QA-owned T-REG-08 (test retargets)
and T-REG-09 (full verification). Reviewer: qa-engineer (sonnet).

## Phase 1 — Independent spot-checks (non-design feature; Copy/Visual/1.5 gates N/A)

- **Copy Audit Gate**: skipped — spec's Copy/Strings section is explicitly
  `N/A` (non-visual, non-copy-introducing refactor, AC-8).
- **Visual Audit Gate**: skipped — spec's Visual Tokens/Widgets/Structural
  Assertions sections are explicitly `N/A` (no UI surface).
- **Phase 1.5 Visual Compare**: skipped (no Visual Baselines declared, no
  `design/registry-pattern.md`).
- **Verbatim orchestrator extraction** — independently re-verified (not
  taking code-reviewer's word alone): extracted `git show HEAD:index.ts`
  lines 722-1197 (476 lines) and `tools/handoff-orchestrator.ts` lines
  47-522 (476 lines), stripped leading whitespace on both, `diff`: **zero
  differences**. Confirms the ~480-line `tw_update_state` gate-orchestration
  body (preflight → PASS/qa gate → transition validation →
  SCOPE_DECISION_REQUIRED → CUT_APPROVAL_REQUIRED → visual/baseline/pixel
  sub-gates → round-cap sentinels → `storage.writeState`) moved character-
  for-character, matching AC-5/AC-8.
- **`test/error-code-contract.test.mjs` passes unmodified** — confirmed by
  isolated run: 9/9 green, file untouched (no diff in `git status`).
  Confirms AC-7 (the test re-globs `tools/*.ts`/`schema/*.ts`/`guards/*.ts`
  at run time, so new modules under `tools/` are covered automatically).
- **No `any`/cast in `tools/registry.ts`** — grepped `: any`, `<any>`,
  ` as any\b` across `tools/registry.ts` and `tools/handoff-orchestrator.ts`:
  zero matches (one unrelated prose comment containing the English word
  "any" in `handoff-orchestrator.ts:259`, not a type annotation). Confirms
  AC-9 (fully-typed `defineTool<TSchema>` generic, no smuggled `any`).

## Phase 3 — T-REG-08: test retargeting

Retargeted exactly the 10 files enumerated in the spec's AMENDED Test Impact
table (`specs/registry-pattern.md` §"Test Impact"). No other test file was
modified (`git status --short test/` shows exactly these 10 as `M`).

| test file | old target | new target | invariant preserved |
|---|---|---|---|
| `test/skill-evolution-v3.11.test.mjs` | `index.ts` source regex (`role: z.enum([...])`, `else if (name === "doc-writer")`) | zod enum retargeted to `tools/registry.ts` source text; prompt-routing assertion rewritten to import `PROMPT_REGISTRY` from `dist/tools/registry.js` and assert `doc-writer`/`release-engineer` entries exist | same facts asserted (both roles are valid `tw_switch_role` targets; both prompts are dispatchable) — routing assertion is now **source-of-truth behavioral** (drives the actual registry) rather than regexing dispatch text, since the if-chain no longer exists post-refactor |
| `test/visual-evidence-gate.test.mjs` | `index.ts` source text (SCOPE_DECISION_REQUIRED hint + envelope shape) | `tools/handoff-orchestrator.ts` source text | verbatim hint-vs-spec comparison and envelope-shape regex unchanged, only file path retargeted |
| `test/context-budget.test.mjs` | `index.ts` source text (`import { hasDesignModeRequiringVisual } from "./tools/evidence-file.js"`) | `tools/handoff-orchestrator.ts` source text (`from "./evidence-file.js"`, correct relative path from `tools/`) | same fact asserted (the PASS-gate handler imports the same helper `build.ts` uses for the arm probe) |
| `test/qa-flow.test.mjs` (2 asserts) | `index.ts` source text (Round 4 sentinels) + `dist/index.js` compiled text (evidence-gate hint) | `tools/handoff-orchestrator.ts` source / `dist/tools/handoff-orchestrator.js` compiled | wording assertions unchanged |
| `test/baseline-manifest-gate.test.mjs` (3 asserts: E2, E3, E6) | `dist/index.js` compiled text | `dist/tools/handoff-orchestrator.js` compiled text | verbatim ERR-BMM-01/ERR-BPI-01 string assertions unchanged |
| `test/cut-approval-gate.test.mjs` (2 asserts, shared `DIST_INDEX` const) | `dist/index.js` | `dist/tools/handoff-orchestrator.js` | verbatim S01/S02 string assertions unchanged |
| `test/handoff-write-arg-guard.test.mjs` (2 asserts) | `dist/index.js` (via shared `DIST_INDEX` path const, which is ALSO used by unrelated spawn tests — left untouched) | new local `DIST_REGISTRY` const pointing at `dist/tools/registry.js`, scoped to just these 2 tests | verbatim ERR_WORKSPACE_CURRENT / ERR_ACTIVE_FEATURE_OBJECT string assertions unchanged; did not touch the shared `DIST_INDEX` const since other tests in the same file still legitimately spawn `dist/index.js` |
| `test/pixel-gate-attestation.test.mjs` (5 asserts, shared local `DIST_INDEX` const scoped to E1-E5 only) | `dist/index.js` | `dist/tools/handoff-orchestrator.js` | verbatim PIXEL_GATE_ATTESTATION_MISSING clause assertions unchanged |
| `test/visual-gate-e2e.test.mjs` (1 assert) | `dist/index.js` | `dist/tools/handoff-orchestrator.js` | verbatim VISUAL_BASELINES_REQUIRED + "## Visual Baselines is absent" substring assertions unchanged |
| `test/writestate-options-object.test.mjs` (1 assert) | `dist/index.js` | `dist/tools/handoff-orchestrator.js` | regex for `storage.writeState({ workspacePath: ... })` call-site shape unchanged |

**Note on source vs. dist targeting**: one test (`skill-evolution-v3.11.test.mjs`)
is now better pointed at *behavior* (importing `PROMPT_REGISTRY` and checking
membership) rather than *text* (regexing a dispatch if-chain that the refactor
deliberately eliminated) — the old regex pattern (`else if (name === "...")`)
has no post-refactor equivalent to point at, so driving the actual registered
behavior is the correct, more robust replacement per the spec's own suggested
approach ("preferably, by driving the actual registered behavior"). All other
9 retargets are pure file-path changes with byte-identical assertion logic.

No coverage gaps or drift found: every relocated string was independently
confirmed present verbatim in its new home before the test edit (via targeted
`grep` against both the compiled and source relocated files), not merely
assumed from the code-reviewer's report.

## Phase 4 — Verification

- **`npm run build`**: zero TypeScript errors. `scripts/check-version.mjs`
  passes (`3.44.0`, Server() literal untouched — version-bump note is
  pre-existing repo state, unrelated to this ticket).
- **Boot smoke test** (spawned `dist/index.js`, JSON-RPC `initialize` →
  `tools/list` → `prompts/list`): stderr banner
  `🛡️ Agent Governance MCP is online. (Tools + Prompts + Guards)`;
  **11 tools** (`tw_get_state, tw_update_state, tw_get_next_task,
  tw_complete_task, tw_add_task, tw_rollback_task, tw_detect_drift, tw_sync,
  tw_switch_role, tw_index_prd, tw_clear_prd_chunks`); **11 prompts**
  (`sr-engineer, researcher, pm, qa-engineer, teamwork, teamwork-lite,
  architect, design-auditor, code-reviewer, doc-writer, release-engineer`).
  Matches pre-refactor order and count (AC-1/AC-4).
- **YAML round-trip smoke test** (per CLAUDE.md pattern): wrote a handoff
  state via `writeHandoffState({ workspacePath, activeFeature, status,
  lastAgent, pendingNotes })` to a scratch workspace, re-parsed via
  `parseHandoff`, confirmed `active_feature`, `status`, `last_agent`,
  `pending_notes` all round-trip correctly. OK.
- **Full `npm test`** (`node --test test/*.test.mjs`): **817/817 passing,
  0 failures, 0 cancelled** — matches AC-6's 817 baseline exactly. CI-runnable
  (headless `node --test`, zero human interaction, deterministic — no flake
  observed on this run; the single flake noted in code-reviewer's T-REG-01..07
  report, `handoff-write-arg-guard` spawn timeout, did not recur here).
- **dist/ recommit-ready**: rebuilt after all test-file edits (test files are
  not compiled, so only a sanity rebuild was needed); `dist/tools/registry.js`
  and `dist/tools/handoff-orchestrator.js` present and match source; `git
  status` shows the expected changed/new set (`index.ts`, seven `tools/*.ts`
  thin-handler owners, two new `tools/{registry,handoff-orchestrator}.ts`
  files, and their `dist/` compiled counterparts) ready for commit alongside
  this ticket.

## Verdict

**PASS.** All AC-1..AC-10 hold (AC-1..AC-5, AC-7, AC-9 independently
re-verified in Phase 1 above and by code-reviewer's T-REG-01..07 approval;
AC-6 re-verified directly — 817/817 green post-retarget; AC-10 build/dist
verified in Phase 4). T-REG-08's ten retargets are file-location-only edits
that preserve every assertion's original invariant; T-REG-09's four
verification gates (build, boot smoke, `npm test`, dist recommit-readiness)
all pass clean.
## 2026-07-07T02:38:39.929Z — PASS — by qa-engineer

Phase 1 spot-checks independently confirmed: orchestrator extraction byte-identical (diff of git-show HEAD:index.ts:722-1197 vs tools/handoff-orchestrator.ts:47-522 is empty), error-code-contract.test.mjs passes unmodified (9/9), zero any/cast in tools/registry.ts. Copy/Visual/1.5 gates N/A (non-design refactor) — skipped per spec. T-REG-08: retargeted exactly the 10 enumerated test files (baseline-manifest-gate, context-budget, cut-approval-gate, handoff-write-arg-guard, pixel-gate-attestation, qa-flow, skill-evolution-v3.11, visual-evidence-gate, visual-gate-e2e, writestate-options-object) to the relocated tools/registry.ts / tools/handoff-orchestrator.ts (source) and dist/tools/registry.js / dist/tools/handoff-orchestrator.js (compiled) locations; every assertion's original invariant preserved, no semantic weakening; one assertion (skill-evolution-v3.11 prompt-routing) upgraded from regexing a now-deleted if-chain to driving the actual PROMPT_REGISTRY behavior. T-REG-09: npm run build clean, boot smoke test confirms 11 tools + 11 prompts + online banner, YAML round-trip OK, full npm test 817/817 passing 0 failures (matches AC-6 baseline exactly), dist/ rebuilt and recommit-ready. PASS.

