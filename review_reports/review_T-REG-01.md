# Code Review — registry-pattern T-REG-01..07

Feature: `registry-pattern` (backlog A1) — tool/prompt registry refactor.
Scope reviewed: T-REG-01..07 (registry types + `defineTool`, handler extractions,
`TOOL_REGISTRY`/`PROMPT_REGISTRY`, `index.ts` rewire). T-REG-08 (test retargets)
and T-REG-09 (recommit) are out of scope and correctly not yet done.
Base: uncommitted working tree vs HEAD (`a0f1f14`). Reviewer model: opus
(sr-engineer model unknown; independent clean-context review — read only the diff,
`specs/registry-pattern.md`, and `specs/registry-pattern-architecture.md`).

## Round 1 — APPROVED — by code-reviewer

## Summary

- **What changed**: `index.ts` shrunk 1436→201 lines (compiled `dist/index.js`
  1290→173). Per-tool triplication (JSON Schema literal + zod const + `switch`
  case) and the 11-branch prompt if-chain collapse into two declarative arrays in
  new `tools/registry.ts` (617 lines), iterated by generic list/dispatch loops.
  The ~480-line `tw_update_state` gate body moved verbatim into new
  `tools/handoff-orchestrator.ts` (`handleUpdateState`). The 10 thin handlers moved
  into their owning `tools/*.ts` modules as `handleXxx` exports.
- **Scope**: registration mechanics only — no tool/gate/error-string semantics
  changed. Verified byte-for-byte wire compatibility.
- **Independent verification performed**: mechanical body diff, `as`/`any` greps,
  live boot of BOTH old (HEAD, via detached worktree with symlinked node_modules)
  and new servers with deep-equal comparison of `tools/list` + `prompts/list` +
  error envelopes, dist reproducibility via rebuild, full `npm test`, isolated
  re-runs, boot banner, and YAML round-trip.
- **Headline verdict**: APPROVED. All AC-1..AC-10 for T-REG-01..07 independently
  confirmed. The test suite is red in exactly the predicted string-location set,
  confined to the 10 files T-REG-08 will retarget.
- **Non-blocking**: one stale line in the architecture doc; one reworded comment;
  and a chain-routing/state-position issue (state parked at `pm`, not
  `sr-engineer`) that blocks recording the handoff — see end of Verdict.

## Correctness

- **Verbatim extraction of `handleUpdateState` (AC-5/AC-8, the crux)** — CONFIRMED
  byte-identical. Extracted old `index.ts:722-1197` and new
  `tools/handoff-orchestrator.ts:47-522`, stripped leading whitespace, `diff`:
  identical (476 lines each, zero differences). Only the dropped line is
  `const parsed = UpdateStateArgs.parse(args);` (now done in `defineTool.run`),
  exactly as the blueprint pins. The frozen 14-step gate order — preflight →
  PASS/qa gate → transition validation → SCOPE_DECISION_REQUIRED →
  CUT_APPROVAL_REQUIRED → QA evidence record → MISSING_EVIDENCE → visual sub-gates
  (VISUAL_BASELINES_REQUIRED → VISUAL_EVIDENCE_MISSING → VISUAL_WIDGETS_UNVERIFIED
  → VISUAL_ASSERTIONS_REQUIRED → VISUAL_REPORT_INCOMPLETE → VISUAL_PROVENANCE_MISSING
  → BASELINE_MANIFEST_MISSING/PROVENANCE_INCOMPLETE → PIXEL_GATE_ATTESTATION_MISSING)
  → MISSING_REVIEW_EVIDENCE → round-cap sentinels → `storage.writeState` → PASS RAG
  GC hook → return — is preserved with every error string and gate envelope intact.
- **Zod schemas verbatim** — CONFIRMED. `index.ts:74-221` vs `tools/registry.ts:87-234`
  diff clean (identical modulo indentation): `absoluteWorkspacePath`, `WorkspaceOnly`,
  all `UpdateStateArgs` refines (PASS-requires-qa, prd traversal, `.current` basename,
  `[object Object]` sentinel), `CompleteTaskArgs`, `RollbackTaskArgs`, `AddTaskArgs`,
  `SwitchRoleArgs`, `EMBEDDING_MODEL_RE`, `ALLOWED_EMBEDDING_MODELS`, `IndexPrdArgs`.
- **Thin handlers verbatim** — CONFIRMED. All 10 (`handleGetState`, `handleDetectDrift`,
  `handleSync`, `handleSwitchRole`, `handleGetNextTask`, `handleCompleteTask`,
  `handleRollbackTask`, `handleAddTask`, `handleIndexPrd`, `handleClearPrdChunks`)
  match their old case bodies exactly (guard order, `requireQaEngineer` on
  `tw_complete_task`, `enforcePreFlight` on the four mutators, RAG coalesce
  logic in `handleIndexPrd`).
- **Wire compatibility (AC-1/AC-2/AC-3/AC-4)** — CONFIRMED by live probe. Booted
  HEAD's `dist/index.js` and the new one; `tools/list` + `prompts/list` are
  **deep-equal** (11 tools, 11 prompts, frozen order
  `tw_get_state…tw_clear_prd_chunks` / `sr-engineer…release-engineer`, incl.
  `teamwork`/`teamwork-lite` back-compat ids). Error paths deep-equal: unknown
  tool → `❌ Tool not found: <name>` (isError), bad args →
  `❌ Invalid arguments for tw_get_state: workspace_path: Invalid input…`
  (isError), `prompts/get` unknown → JSON-RPC error `Prompt not found: <name>`.
- **Test suite** — 817 tests, 20 genuine failures, all string/text-location class,
  confined to exactly the 10 T-REG-08 files: baseline-manifest-gate (3),
  pixel-gate-attestation (5), cut-approval-gate (2), handoff-write-arg-guard (2),
  qa-flow (2), visual-evidence-gate (2), skill-evolution-v3.11 (1), context-budget
  (1), visual-gate-e2e (1), writestate-options-object (1). Each reads `index.ts`
  or `dist/index.js` for a string/import that legitimately relocated. **No failure
  outside the 10-file set.** One additional full-suite failure
  (`handoff-write-arg-guard` #263, "feature id with dots/dashes not rejected") was
  a spawn **timeout flake** (`must receive a response for id=21`, 2004 ms) — it
  PASSES on isolated re-run (12/14; only the 2 dist-string asserts fail), and the
  schema is byte-identical so no behavior changed. `error-code-contract.test.mjs`
  is **green (9/9) and unmodified** (AC-7 auto-glob holds). No test files modified.

## Quality

- `tools/registry.ts` and `tools/handoff-orchestrator.ts` carry clear top-of-file
  rationale, the frozen-order and glob-placement constraints are documented inline,
  and dead code was deleted (not commented out) — `index.ts` retains no stale
  references to dropped symbols.
- Minor (non-blocking): in `tools/sync.ts` the relocated `handleSync` comment
  changed "See tools/sync.ts safety note." → "See the safety note above." This is
  a deviation from strict verbatim, but it is *more* correct in the new location
  and touches only a comment — no behavior impact.
- `tools/handoff-orchestrator.ts` retains the pre-existing storage casts
  (`storage as Record<string, unknown>`, `storage as unknown as {…}`) at the RAG
  GC hook — these are verbatim from the original body (the `deletePrdChunks`
  duck-type check), not new cast-smuggling, and are out of this ticket's blast radius.

## Architecture

- Matches `specs/registry-pattern-architecture.md` exactly. `defineTool<TSchema>`
  is copied verbatim from the blueprint: closes over the concrete `TSchema`, calls
  `spec.zodSchema.parse(rawArgs)` **inside** the `run` closure so `.parse` returns
  `z.infer<TSchema>` (not `any`), erasing to `(rawArgs: unknown) => Promise<ToolResult>`
  only at the storage boundary. `ToolResult = CallToolResult` (SDK type). All new
  modules live under `tools/` (AC-7 hard constraint) — no top-level `registry/`.
- Handler placement per blueprint: `tw_update_state` in `handoff-orchestrator.ts`
  (kept separate from `handoff.ts` to isolate gate policy from YAML read/write),
  the rest in their owning modules.
- Dispatch is `Array.find(name)` over the same array that feeds the list (AC-1
  order guarantee), with the not-found branch inside the try and ZodError caught by
  the same outer catch — structurally identical to the blueprint's dispatch loop.

## Security

- No new injection vectors, secrets, or unvalidated boundaries. All boundary
  validation (`absoluteWorkspacePath`, prd_path path-traversal refines, the
  `ALLOWED_EMBEDDING_MODELS` allowlist guarding the protobufjs RCE chain) moved
  verbatim and remains enforced at the `run`-boundary `parse` — confirmed live via
  the `❌ Invalid arguments` path. The `.current`-basename and `[object Object]`
  refines are intact. HTTP-mode auth/origin/shutdown boot block in `index.ts` is
  untouched.

## Performance

- No regression. Dispatch is O(11) `find` per call (negligible; the blueprint
  explicitly rejected a parallel `Map` as premature). List handlers are O(11)
  `map`. No new loops, I/O, listeners, or unbounded caches. The RAG in-flight
  coalesce registry and PASS-GC `awaitAllInflightFor` moved verbatim. Registry
  arrays are built once at module load.

## Verdict

**APPROVED** — T-REG-01..07 is a faithful, byte-for-byte wire-compatible
registration-mechanics refactor: the highest-risk `handleUpdateState` extraction
is mechanically verbatim, `tools/list`/`prompts/list`/error envelopes are
deep-equal against HEAD's server, the registry is `any`/cast-free, dist rebuilds
reproducibly, and the only test failures are the expected 20 string-location
asserts confined to the 10 files T-REG-08 will retarget.

**Handoff blocker (not a code defect) — routing/state position**: the handoff
state is parked at `(last_agent=pm, In_Progress)` because PM re-entered after
sr-engineer to amend the spec's Test Impact table. `ALLOWED_TRANSITIONS` permits
`pm:In_Progress` → {architect, sr-engineer, researcher, design-auditor, pm} only —
**not** code-reviewer. The legal code-reviewer entry is `sr-engineer:In_Progress →
code-reviewer:In_Progress`. Therefore the SOP step-2 claim write and the step-5
`code-reviewer → qa-engineer` handoff cannot be recorded from the current tuple;
the coordinator must re-route `pm → sr-engineer → code-reviewer` (sr-engineer
re-claims, then hands to code-reviewer) before this APPROVED verdict can advance
the state machine to qa-engineer. The review artifact and verdict stand regardless.

**Non-blocking doc nit**: `specs/registry-pattern-architecture.md` (Affected Files
table rows for tests, and Sequencing §T-REG-08) still says "the only four test
files" / lists four — stale relative to the spec's amended 10-file Test Impact
table. Recommend reconciling during T-REG-08 so the architect doc matches the spec.
