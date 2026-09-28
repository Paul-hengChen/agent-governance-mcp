# registry-pattern — Tool/prompt registry pattern (backlog A1)

## Problem Statement

`index.ts` (1436 lines) registers each of the eleven `tw_*` tools at three
independent sites — a hand-written JSON Schema entry in the
`ListToolsRequestSchema` handler, a `zod` parse schema declared near the top
of the file, and a `case` arm in the `CallToolRequestSchema` dispatcher
switch — plus prompt registration is an 11-branch `if`/`else if` chain
spanning both `ListPromptsRequestSchema` (metadata array) and
`GetPromptRequestSchema` (dispatch) for the 11 registered prompt ids
(`sr-engineer`, `researcher`, `pm`, `qa-engineer`, `teamwork`,
`teamwork-lite`, `architect`, `design-auditor`, `code-reviewer`,
`doc-writer`, `release-engineer`). Nothing ties these sites together
structurally: a tool can be listed without a dispatcher case (silently
"disappears" at call time with the generic `❌ Tool not found` message) or
given a dispatcher case without a list entry (unreachable from clients that
enumerate tools first). The same drift risk applies to prompts. This ticket
replaces ad hoc per-site registration with a single declarative registry
per surface (tools, prompts) that `index.ts` iterates, so adding a
tool/prompt is one addition to one array instead of edits scattered across
the file.

## User Stories

- As a maintainer adding a new `tw_*` tool, I want to add one registry entry
  (name + JSON Schema + zod schema + handler), so that I cannot ship a tool
  that lists but doesn't dispatch (or vice versa).
- As a maintainer adding a new role prompt, I want to add one registry entry
  (name + description + build function), so that list metadata and dispatch
  routing cannot drift apart.
- As a reviewer, I want `index.ts` to shrink to generic iteration logic, so
  that reviewing a new tool/prompt addition is a one-file, one-array diff
  instead of a three-site cross-check.

## Acceptance Criteria

- **AC-1 (wire-compatible tool surface)**: Given the refactored server,
  When a client calls `tools/list`, Then the returned tool array is
  byte-identical (name, description, inputSchema) to the pre-refactor
  output, for all 11 `tw_*` tools, in the same order.
- **AC-2 (wire-compatible dispatch)**: Given any valid args payload for any
  of the 11 tools, When the client calls `tools/call`, Then the result
  content/`isError` shape is identical to pre-refactor behavior, including
  every gate rejection envelope (`SCOPE_DECISION_REQUIRED`,
  `CUT_APPROVAL_REQUIRED`, round-cap sentinel text, etc.) verbatim.
- **AC-3 (unknown tool / bad args unchanged)**: Given an unrecognized tool
  name, When `tools/call` is invoked, Then the response is
  `❌ Tool not found: <name>` with `isError: true`, exactly as today (now
  produced by the registry's not-found branch instead of the `switch`
  default case). Given args that fail zod validation, When `tools/call` is
  invoked, Then the response is `❌ Invalid arguments for <name>: <formatZodError output>`
  with `isError: true`, exactly as today.
- **AC-4 (wire-compatible prompts)**: Given a client calls `prompts/list`,
  Then the returned prompt array (name, description, arguments) is
  byte-identical to pre-refactor output for all 11 prompt ids, including
  the `teamwork` backwards-compat id. Given `prompts/get` for any registered
  id, Then the returned prompt body is identical to pre-refactor output
  (post `appendSpecContext`). Given an unregistered prompt id, Then the
  server throws `Error("Prompt not found: <name>")`, exactly as today.
- **AC-5 (mutating-tool contract preserved)**: Given `tw_update_state`,
  `tw_complete_task`, or `tw_rollback_task` is invoked, Then the relocated
  handler still (1) calls `enforcePreFlight` before any state read, (2) the
  eventual `storage.writeState`/equivalent call still goes through
  `withFileLock` → `verifyFreshness` → tmp-file-and-rename →
  `refreshSnapshotFor` (unchanged — this contract already lives inside
  `tools/handoff.ts`'s `writeState`, not in `index.ts`, and is NOT touched by
  this ticket), and (3) all gate checks (`validateTransition`, scope-decision,
  cut-approval, visual-round sentinels) fire in the exact same order as
  today.
- **AC-6 (test suite green, minimal test churn)**: Given the refactor is
  complete, When `npm test` runs, Then all currently-passing tests still
  pass (817 baseline), and the ONLY test files modified are the ten
  enumerated in "Test Impact" below — each modified because it asserts a
  string/pattern's presence specifically in `index.ts` source OR compiled
  `dist/index.js` text, and that string/pattern legitimately relocates to a
  new module under this refactor. No test's asserted behavior/semantics
  changes — only the file path each test reads from.
  (Amendment, post sr-engineer T-REG-01..07: the original grep pass covered
  only source-text (`index.ts`) reads; a second class of tests reads
  *compiled* `dist/index.js` text for the same category of verbatim
  gate-error strings. sr-engineer flagged 6 additional files during
  implementation — see "Test Impact" for the full, now-10-file list. Every
  asserted string was confirmed by sr-engineer to still exist verbatim, just
  relocated to `dist/tools/handoff-orchestrator.js` / `dist/tools/registry.js`
  — no behavioral regression, purely a text-location fix.)
- **AC-7 (error-code contract test survives unmodified)**:
  `test/error-code-contract.test.mjs` globs `tools/*.ts`, `schema/*.ts`,
  `guards/*.ts`, plus `index.ts` by name — it does NOT need modification
  because it re-globs directories at test-run time. This is a hard
  constraint on the architecture (see "Decisions" below): any new module
  emitting a gate error code MUST live under `tools/`, `schema/`, or
  `guards/`, or MUST be re-exported/imported into `index.ts` such that the
  literal token still appears in one of the scanned files.
- **AC-8 (no semantic/gate changes)**: No tool's business logic, no gate's
  trigger condition, no error string, and no evidence-file/transitions
  behavior changes. This ticket is registration mechanics only.
- **AC-9 (type safety)**: The registry's handler signature is fully typed
  (per-tool arg type flows from each tool's own zod schema via
  `z.infer<typeof Schema>`) — no `any` in the registry module or the
  `index.ts` iteration loop (constitution §2).
- **AC-10 (build artifact)**: `npm run build` succeeds; `dist/` is
  recommitted reflecting the refactor; `scripts/check-version.mjs` still
  passes (Server() version literal untouched by this ticket).

## Copy / Strings

N/A — this is a non-visual, non-copy-introducing refactor. No new
user-facing strings are introduced; every existing error/gate string is
relocated verbatim (see AC-2, AC-3, AC-4). Table intentionally omitted per
`authored-here` rule: there is nothing to source since no string content
changes.

## Visual Tokens

N/A — feature has no visual surface (server-internal registration
mechanics only).

## Visual Widgets

N/A | — | feature has no non-primitive widgets

## Visual Structural Assertions

N/A — no `design/registry-pattern.md` exists; feature is non-design
(server entry-point refactor, no UI).

## Out of Scope

- Tool/gate **semantic** changes of any kind (no new tools, no new gates,
  no changed validation rules).
- A2 (splitting `tools/evidence-file.ts` into per-gate `gates/` modules) —
  separate backlog ticket; this ticket does not touch the internal shape of
  `evidence-file.ts`, only how its exports are wired into the tool registry.
- A9/A10 (compose-not-strip content overlays, gate-registry-as-data) —
  those target `prompts/build.ts` content composition and gate *definitions*;
  this ticket targets tool/prompt *registration* in `index.ts` only. They
  are complementary future work, not prerequisites.
- Deriving the hand-written `ListToolsRequestSchema` JSON Schema objects
  from the zod schemas automatically (e.g. `zod-to-json-schema`) — that
  would be a genuine behavior-risk change (JSON Schema shape could drift
  from today's hand-authored output) and a new dependency; out of scope.
  The registry pairs the two schemas side by side per tool but does not
  unify them.
- Changing the SQLite/file storage adapter interface (`tools/storage.ts`).
- CI/release pipeline changes beyond the standard `dist/` recommit.

## Dependencies / Prerequisites

- **Resource Audit (constitution §7)**: the ticket source (`docs/backlog.md`
  §A1) and the CLAUDE.md excerpts it cites are both in-repo; no external
  URLs, Figma links, or ticket-system references were found. No
  fetch/index/ignore decisions needed.
- **Question Batch Gate**: zero clarifications accumulated — the ticket
  explicitly delegates registry-location, type-safety-mechanism, and
  routing decisions to the PM/architect ("Decide and record"). Resolved
  below in "Decisions"; no human input required before drafting.
- Depends on: none (backlog lists `depends_on: —` for A1).
- **Investigation findings this spec relies on** (see "Decisions" for
  what they imply):
  1. **Eleven `tw_*` tools**, confirmed by reading `index.ts`'s
     `ListToolsRequestSchema`/`CallToolRequestSchema`/zod-schema blocks:
     `tw_get_state`, `tw_update_state`, `tw_get_next_task`,
     `tw_complete_task`, `tw_add_task`, `tw_rollback_task`,
     `tw_detect_drift`, `tw_sync`, `tw_switch_role`, `tw_index_prd`,
     `tw_clear_prd_chunks`.
  2. **Eleven prompts**, confirmed by reading `ListPromptsRequestSchema`
     (`index.ts:244-370`) and the `if`/`else if` chain in
     `GetPromptRequestSchema` (`index.ts:382-406`) — matches the ticket's
     "11-branch if-chain" description exactly (the CLAUDE.md line "Seven
     prompts are registered" is stale doc-debt from before `design-auditor`
     / `code-reviewer` / `doc-writer` / `release-engineer` were added; not
     fixed by this ticket, flagged for a future doc pass).
  3. **Three-site triplication confirmed** for tools: (a) hand-authored
     JSON Schema literal in `ListToolsRequestSchema` (NOT derived from the
     zod schema — a genuinely separate, parallel definition today), (b) a
     `zod` object/refine chain near the top of `index.ts`, (c) a `case`
     arm in the `CallToolRequestSchema` `switch`.
  4. **`tw_update_state`'s dispatcher case is NOT a thin wrapper** — unlike
     the other 10 tools (each a short call into an existing `tools/*.ts`
     function), the `tw_update_state` case body is ~480 lines
     (`index.ts:720-1199`) containing the transition-validation call, the
     Scope-Decision-Gate check, the Cut-Approval-Gate check, the
     round-cap-sentinel injection (qa_round/review_round/visual_round), and
     only THEN a call to `storage.writeState(...)`. This is the highest-risk
     extraction in the ticket — see Decisions.
  5. **The 4-step mutating-tool contract (CLAUDE.md: lock → freshness →
     atomic write → refresh snapshot) already lives inside
     `tools/handoff.ts`'s `writeState`**, not in `index.ts`. `index.ts` only
     calls `enforcePreFlight` before its gate checks and then calls
     `storage.writeState(...)` at the end. This means relocating the
     ~480-line gate-orchestration body does NOT touch the lock/freshness/
     atomic-write/snapshot-refresh invariant — that invariant is
     structurally isolated already and out of this ticket's blast radius.
  6. **`test/error-code-contract.test.mjs` re-globs `tools/*.ts`,
     `schema/*.ts`, `guards/*.ts` at run time** (not a fixed file list) —
     confirmed by reading its `CODE_SOURCE_FILES` construction. This means
     any error-code-emitting logic relocated INTO those three directories
     stays covered automatically; relocating it OUTSIDE them (e.g. a
     hypothetical top-level `registry/` directory) would silently escape
     the contract test. This is a hard constraint on module placement (see
     Decisions: everything new goes under `tools/`).

### Test Impact — the ten tests that assert `index.ts`/`dist/index.js`-specific internals

Grepped `test/*.mjs` for `readFileSync`/pattern-matches anchored to the
literal path `index.ts` (as opposed to `dist/tools/*.js` imports, which are
unaffected since exported function names/behavior don't change). Found 51
test files total; of those, several read `index.ts` text only to check the
`Server()` version literal (`baseline-manifest-gate`, `subagent-templates`,
`pixel-gate-attestation`, `release-staging`) — **unaffected**, since the
`Server()` constructor call is untouched by this refactor. The original pass
identified four tests that read `index.ts` **source** text to assert
registration-mechanics content this ticket deliberately relocates (rows 1-4
below).

**Amendment (post sr-engineer T-REG-01..07, no test files touched in that
work)**: the original grep pass covered only source-text (`index.ts`) reads
and missed a second class — tests that read **compiled** `dist/index.js`
text for verbatim gate-error strings, as an end-to-end "the string really
shipped" check (constitution §7-style provenance check). sr-engineer flagged
6 such files during implementation; every asserted string was confirmed
still present verbatim, just relocated to `dist/tools/handoff-orchestrator.js`
/ `dist/tools/registry.js` once the `tw_update_state` gate-orchestration body
and the tool/prompt registries moved out of `index.ts` per Decisions #1/#3.
No behavioral regression — pure text-location fix, same category of change
as rows 1-4. Rows 5-10 are the amendment; the table is now the full,
authoritative 10-file list.

| test file | assertion today | why it must change | how it should change |
|---|---|---|---|
| `test/skill-evolution-v3.11.test.mjs` (AC-10/11, lines 26-45) | regex-matches `role: z.enum([...])` and `else if (name === "doc-writer")` / `"release-engineer")` directly in `index.ts` source text | the zod enum moves to the tool-registry module and the prompt if-chain is replaced by a `Map`/array lookup — neither pattern exists in `index.ts` post-refactor | assert the same facts (doc-writer/release-engineer are valid `tw_switch_role` roles; doc-writer/release-engineer prompts are dispatchable) against the new registry module's source text or, preferably, by driving the actual registered behavior (call the exported `TOOL_REGISTRY`/`PROMPT_REGISTRY` and assert entries exist) instead of regexing `index.ts` |
| `test/visual-evidence-gate.test.mjs` (AC-4, lines 581-600) | reads `index.ts` text and asserts it contains the verbatim `SCOPE_DECISION_REQUIRED` hint string, to catch spec/impl paraphrase drift | the hint string lives inside the ~480-line `tw_update_state` handler body, which this ticket relocates out of `index.ts` into a `tools/*.ts` handler module | change the `readFileSync` target from `index.ts` to the new handler module's file path; assertion logic (verbatim-substring match against the spec) is otherwise identical |
| `test/context-budget.test.mjs` (AC8/HC3, lines 1024-1038) | asserts `index.ts` source text contains `import { hasDesignModeRequiringVisual } from "./tools/evidence-file.js"` | once the Scope-Decision-Gate check moves into the relocated `tw_update_state` handler module, `index.ts` itself may no longer import `hasDesignModeRequiringVisual` directly (the new handler module does) | change the assertion to check the import exists in whichever file now calls `hasDesignModeRequiringVisual` (the relocated handler module) instead of hardcoding `index.ts` |
| `test/qa-flow.test.mjs` (v3.15.0 AC-13, lines 429-436) | reads `index.ts` text and asserts the exact `⛔ Round 4…` / `⛔ Review Round 4…` sentinel wording is present | these literal strings live inside the relocated `tw_update_state` handler body | change the `readFileSync` target to the new handler module's file path; wording assertion unchanged |
| `test/baseline-manifest-gate.test.mjs` (E2/E3, 3 asserts, lines 516-548) | reads compiled `dist/index.js` and asserts verbatim `BASELINE_MANIFEST_MISSING` / `BASELINE_PROVENANCE_INCOMPLETE` error prefixes + `ERR-BMM-01` body text | those strings live in the relocated `tw_update_state` gate body, now compiled into `dist/tools/handoff-orchestrator.js` | retarget `readFileSync` from `dist/index.js` to `dist/tools/handoff-orchestrator.js`; string assertions unchanged |
| `test/cut-approval-gate.test.mjs` (C1/C2, 2 asserts, lines 504-527) | reads compiled `dist/index.js` and asserts verbatim `CUT_APPROVAL_REQUIRED` error code + S01/S02 hint prefixes | same relocation as above (cut-approval gate lives in the `tw_update_state` body) | retarget `readFileSync` to `dist/tools/handoff-orchestrator.js`; string assertions unchanged |
| `test/handoff-write-arg-guard.test.mjs` (2 asserts, lines 148-167) | reads compiled `dist/index.js` and asserts verbatim `ERR_WORKSPACE_CURRENT` / `ERR_ACTIVE_FEATURE_OBJECT` strings | these are zod `.refine()` messages on `UpdateStateArgs`, which moves into `tools/registry.ts` per Decisions #1/#7 | retarget `readFileSync` to `dist/tools/registry.js` (compiled output of `tools/registry.ts`); string assertions unchanged |
| `test/pixel-gate-attestation.test.mjs` (E1-E5, 5 asserts, lines 637-698) | reads compiled `dist/index.js` and asserts verbatim `PIXEL_GATE_ATTESTATION_MISSING` / `VISUAL_PROVENANCE_MISSING` copy strings | same relocation as baseline-manifest-gate (visual/pixel gates live in the `tw_update_state` body) | retarget `readFileSync` to `dist/tools/handoff-orchestrator.js`; string assertions unchanged |
| `test/visual-gate-e2e.test.mjs` (v3.16.0 AC-1 STEP1, 1 assert, lines 296-303) | reads compiled `dist/index.js` and asserts verbatim `VISUAL_BASELINES_REQUIRED` + `## Visual Baselines is absent` substrings | same relocation (visual-baselines gate lives in the `tw_update_state` body) | retarget `readFileSync` to `dist/tools/handoff-orchestrator.js`; substring assertions unchanged |
| `test/writestate-options-object.test.mjs` (AC-8, 1 assert, lines 107-116) | reads compiled `dist/index.js` and asserts the `storage.writeState({ workspacePath: … })` options-object call site regex-matches | the `storage.writeState(...)` call sits at the tail of the relocated `tw_update_state` handler body | retarget `readFileSync` to `dist/tools/handoff-orchestrator.js`; regex assertion unchanged |

No other test file requires modification. (`test/error-code-contract.test.mjs`
is explicitly verified NOT to need changes per finding #6 above, as long as
the architecture decision below — new modules live under `tools/` — holds.)

## Decisions

1. **Registry module location: `tools/registry.ts`** (new file), holding
   two exported arrays/maps:
   - `TOOL_REGISTRY: ToolRegistryEntry<any_specific_per_entry>[]` — but see
     AC-9: each entry is defined via a small generic helper
     (`defineTool<TSchema extends z.ZodTypeAny>(name, jsonSchema, zodSchema, handler: (args: z.infer<TSchema>) => Promise<CallToolResultShape>)`)
     so the array itself is `ToolRegistryEntry[]` (existentially typed) with
     zero `any` at the definition call sites — each `defineTool(...)` call is
     fully typed against its own schema. This mirrors the pattern already
     used for the hand-authored JSON Schema (kept as-is, moved verbatim) and
     the existing zod consts (kept as-is, moved verbatim) — reasons: (a)
     `tools/registry.ts` is scanned by `error-code-contract.test.mjs`'s
     `CODE_SOURCE_FILES` glob automatically (finding #6), so no test needs
     updating for the *existence* of the registry file itself; (b) it keeps
     `index.ts` reduced to generic iteration + server bootstrap, matching the
     ticket's target shape.
   - `PROMPT_REGISTRY: PromptRegistryEntry[]` — `{ name, description,
     arguments, buildFn: (workspacePath: string) => PromptResult }`, one
     entry per prompt id including `teamwork` (back-compat id preserved
     verbatim). Placed in `tools/registry.ts` alongside `TOOL_REGISTRY`
     rather than a separate `prompts/registry.ts`, so both registries share
     one file and one glob-coverage guarantee; `prompts/*.ts` build
     functions are imported into it exactly as `index.ts` imports them
     today (no change to `prompts/*.ts` internals).
2. **Handler placement for the 10 "thin" tools**: extract each dispatcher
   case body verbatim into a newly-exported named function in the
   `tools/*.ts` module that already owns the underlying logic (e.g.
   `tw_get_state`/`tw_detect_drift` → new exports in `tools/handoff.ts` /
   `tools/drift.ts`; `tw_complete_task`/`tw_rollback_task`/`tw_add_task`/
   `tw_get_next_task` → `tools/tasks.ts`; `tw_switch_role` → `tools/role.ts`;
   `tw_sync` → `tools/sync.ts`; `tw_index_prd`/`tw_clear_prd_chunks` →
   `tools/rag.ts`). No new files needed for these — they already have a
   natural home.
3. **Handler placement for `tw_update_state`**: given finding #4 (480-line
   non-thin case) and finding #5 (mutating-tool 4-step contract already
   isolated inside `tools/handoff.ts`), extract the full gate-orchestration
   body verbatim into a new function `handleUpdateState` in a new file
   `tools/handoff-orchestrator.ts` (kept separate from `tools/handoff.ts`
   to avoid conflating "read/write handoff state" with "gate policy
   orchestration" — the latter imports from `tools/transitions.ts` and
   `tools/evidence-file.ts`, the former does not; this separation also
   scopes A2's future `gates/` extraction cleanly against this one). This
   is a **verbatim relocation** — same order of checks, same early returns,
   same imports — not a rewrite. Architect should pin the exact boundary
   (what constitutes "the handler" vs. what stays as a thin
   `index.ts`-side call) in the architecture doc.
4. **Type safety (AC-9, constitution §2 no-`any`)**: each `defineTool` call
   is generic over its own zod schema, so `handler`'s argument type is
   inferred per tool — no shared `any`-typed args object. The dispatcher
   loop in `index.ts` looks up the entry by `name`, and since JS/TS can't
   express "call this heterogeneous array's handler with its own inferred
   type" without an existential wrapper, the registry entry type itself
   erases to `ToolRegistryEntry` (handler typed as
   `(args: unknown) => Promise<...>` at the *storage* type, but each
   `defineTool(...)` call site is fully typed against its own schema before
   erasure) — this is the standard "define narrow, store wide" pattern and
   does not introduce `any` (uses a generic function + return-type erasure,
   not `any`-typed parameters).
5. **Prompt registry replaces both the `ListPromptsRequestSchema` array AND
   the `GetPromptRequestSchema` if-chain** — single source of truth per
   prompt (name + description + arguments + build function), directly
   fixing the ticket's stated prompt-registration drift risk, not just the
   tool-registration one.
6. **Dispatcher error handling stays identical**: `index.ts`'s
   `CallToolRequestSchema` handler keeps its outer `try { switch-turned-lookup } catch`
   structure. Unknown-tool-name now returns the not-found branch INSIDE the
   loop-based lookup (registry `.find(name)` returns `undefined` →
   identical `❌ Tool not found: <name>` response) instead of the `switch`
   default; `z.ZodError` is still caught by the same outer `catch` block
   with the same `formatZodError` call, since each entry's `zodSchema.parse(args)`
   still throws a `z.ZodError` the same way a top-level `Schema.parse(args)`
   call did.
7. **`ListToolsRequestSchema` JSON Schema objects move verbatim** (not
   regenerated from zod) from `index.ts` into each `defineTool(...)` call
   in `tools/registry.ts` — zero risk of AC-1 (byte-identical `tools/list`)
   regressing, since the literal object is copy-pasted, not derived.

## Tasks

- [ ] T-REG-01 [P0] Define `ToolRegistryEntry`/`PromptRegistryEntry` types + `defineTool` helper in new `tools/registry.ts` (types only, no entries yet). | depends_on: none
- [ ] T-REG-02 [P0] Extract the 5 read-only/no-guard tool handlers (`tw_get_state`, `tw_detect_drift`, `tw_sync`, `tw_switch_role`, `tw_get_next_task`) verbatim into named exported functions in their owning `tools/*.ts` files. | depends_on: T-REG-01
- [ ] T-REG-03 [P0] Extract the remaining thin tool handlers (`tw_complete_task`, `tw_rollback_task`, `tw_add_task`, `tw_index_prd`, `tw_clear_prd_chunks`) verbatim into named exported functions in `tools/tasks.ts` / `tools/rag.ts`. | depends_on: T-REG-01
- [ ] T-REG-04 [P0] Extract the `tw_update_state` gate-orchestration body (index.ts:720-1199, ~480 lines) verbatim into new `tools/handoff-orchestrator.ts` as `handleUpdateState`, preserving exact check order (preflight → PASS/qa-engineer gate → transition validation → scope-decision gate → cut-approval gate → visual/round-cap sentinels → storage.writeState). Flag to architect: this single extraction legitimately exceeds the normal ≤300-line task guidance because it is a pure verbatim move with no logic change — do not split mid-handler. | depends_on: T-REG-01
- [ ] T-REG-05 [P0] Populate `tools/registry.ts`'s `TOOL_REGISTRY` array: one `defineTool(...)` call per tool, pairing each tool's existing zod schema + verbatim-moved JSON Schema object + the handler exported in T-REG-02/03/04. | depends_on: T-REG-02, T-REG-03, T-REG-04
- [ ] T-REG-06 [P0] Rewrite `index.ts`'s `ListToolsRequestSchema` and `CallToolRequestSchema` handlers to iterate `TOOL_REGISTRY` (list mapping + lookup-dispatch), preserving identical not-found and ZodError error paths. Remove the now-dead per-tool JSON Schema literals, zod consts, and case arms from `index.ts`. | depends_on: T-REG-05
- [ ] T-REG-07 [P1] Populate `tools/registry.ts`'s `PROMPT_REGISTRY` array (11 entries incl. `teamwork` back-compat id) and rewire `index.ts`'s `ListPromptsRequestSchema`/`GetPromptRequestSchema` to iterate/look up the registry, removing the 11-branch if-chain and the manual prompts array. | depends_on: T-REG-01
- [ ] T-REG-08 [P0] Update the ten tests enumerated in "Test Impact" (`skill-evolution-v3.11.test.mjs`, `visual-evidence-gate.test.mjs`, `context-budget.test.mjs`, `qa-flow.test.mjs`, `baseline-manifest-gate.test.mjs`, `cut-approval-gate.test.mjs`, `handoff-write-arg-guard.test.mjs`, `pixel-gate-attestation.test.mjs`, `visual-gate-e2e.test.mjs`, `writestate-options-object.test.mjs`) to assert against the new module locations (source-text reads retarget from `index.ts` to the relocated `tools/*.ts` module; compiled-text reads retarget from `dist/index.js` to `dist/tools/handoff-orchestrator.js` / `dist/tools/registry.js`), preserving each test's semantic intent. No other test file may be modified. | depends_on: T-REG-06, T-REG-07
- [ ] T-REG-09 [P0] Full verification: `npm run build`, `npm test` (817 green), stdio boot smoke test (spawn `dist/index.js`, initialize handshake), YAML round-trip smoke test per CLAUDE.md; recommit `dist/`. | depends_on: T-REG-08
