# e431-test-first-server-path — architecture

Spec: `specs/e431-test-first-server-path.md` (cut approved 2026-11-20, D1 = file mode only). Plan row: `specs/fanout-v5-w2.md` (lane e431). This blueprint confirms D2–D7, picks the AC10 code, and fixes every interface sr-engineer needs for T-E431-01..06. Line numbers are at base `0efc203` (the three lane commits after it touch only `specs/` and `.current/`).

Design in one paragraph: the old matrix `ALLOWED_TRANSITIONS` stays byte-identical. A second, exported **test-first overlay** (edges a marked feature gains, edges it loses) is applied inside `validateTransition` only when the request says the feature is marked. The marker is a persisted, feature-scoped handoff field `chain_path: "test-first"` (file mode only); `validateTransition` gets it through three new optional request fields, so every existing caller that omits them gets exactly today's answer. Every judge-identity check reads one helper, `judgeFor(chainPath)`, which returns `"qa-engineer"` for an unmarked feature, so the unmarked branch of each check is today's code unchanged. No new module, no new pipeline step, one new gate code.

## Affected Files

| file | task | change |
|---|---|---|
| `tools/handoff-types.ts` | T-E431-01 | add `ChainPath` type; `HandoffState.chain_path?`, `HandoffState.sr_return_count?` |
| `tools/handoff-parse.ts` | T-E431-01 | parse both fields defensively; heal-write passes `srReturnCount` |
| `tools/handoff-write.ts` | T-E431-01 | `WriteHandoffStateOptions.chainPath?` (feature-scoped carry), `srReturnCount?` (server-computed, emitted only when > 0) |
| `schema/versions.ts` | T-E431-01 | `CURRENT_VERSIONS.handoff` 15 → 16 (`sqlite` stays 2) |
| `schema/migrations-handoff.ts` | T-E431-01 | v15 → v16 stamp-only migration |
| `tools/transitions.ts` | T-E431-03, T-E431-05 | overlay, marker check, sr-return cap, AC9 hint, `computeSrReturnCount`, `review_round` reset on `code-reviewer:PASS`, hop-cap comment fix (T-03); `judgeFor` / `requireJudge` (T-05) |
| `gates/registry.ts` | T-E431-03 | entry 35 `SR_RETURN_CAP_EXCEEDED`, union member, mapping row `(none)`, `TRANSITION_GATE_CODES` +1, count comments 34 → 35 |
| `tools/registry.ts` | T-E431-02 | `chain_path` on `tw_update_state` (zod + inputSchema); PASS refine relaxed to admit `code-reviewer`; four description strings |
| `tools/handoff-orchestrator.ts` | T-E431-04, T-E431-05 | marker resolution, request wiring, build-entry predicate, persistence (T-04); PASS judge guard, verdict / completed-tasks / ledger / RAG judge (T-05); export `readPersistedChainPath` |
| `tools/tasks.ts` | T-E431-05 | `tw_complete_task` uses `requireJudge` |
| `qa_reports/expected-red_e431-test-first-server-path.txt` | T-E431-05 | expected-red manifest (governance artifact, not counted in the file budget) |
| `specs/qa-flow-enforcement-architecture.md` | T-E431-06 | new H2 overlay mirror after the matrix section; counter and build-entry prose |
| `docs/architecture.md` | T-E431-06 | step-1 box cap line, P1 counter lines, "34 entries" → 35 (not lines 18, 20–21: e423) |
| `CONTRIBUTING.md` | T-E431-06 | lines 53, 64 only |
| `CLAUDE.md` | T-E431-06 | line 78 in place, net 0 lines |
| `docs/schema-versions.md` | T-E431-06 | v16 row in the handoff version table |
| `dist/**` | every sr task | `npm run build` output; not counted |
| `test/e431-*.test.mjs` + re-pins | T-E431-07..10 | qa-engineer only |

Not touched (D1, D3, D4, scope): `tools/storage.ts`, `tools/storage-sqlite.ts`, `schema/migrations-sqlite.ts`, `gates/pipeline.ts`, `scripts/check-transitions-sync.mjs`, `index.ts`, `README.md`, every `content/**`, `docs/architecture.md` lines 18–21. No new `tools/*.ts` or `gates/*.ts` file, so no new CLAUDE.md Layout row.

## Data Structures

### `tools/handoff-types.ts` (T-E431-01)

```ts
// Test-first chain marker (handoff schema v16, E431). One value; absence means
// the old chain. Defined here, not in transitions.ts, so the types module stays
// the owner of persisted shapes; transitions.ts takes it with `import type`.
export type ChainPath = "test-first";

export interface HandoffState {
  // ...existing fields unchanged...
  // Which chain the feature entered by. Set by a pm write or by the entry
  // write pm/architect -> qa-engineer:In_Progress; carried across writes that
  // omit it; never cleared; dropped when active_feature changes; NOT re-armed
  // on PM re-entry. File mode only. Read by validateTransition (overlay), the
  // build-entry checks and every judge-identity check.
  chain_path?: ChainPath;
  // sr-engineer -> qa-engineer returns on a test-first feature. Server-computed
  // each write (computeSrReturnCount); reset on pm:In_Progress and on
  // active_feature change; not a review round. Present only when > 0, so an
  // unmarked feature never carries it. File mode only.
  sr_return_count?: number;
}
```

### Persisted YAML (file mode)

```yaml
schema_version: 16
chain_path: "test-first"     # only on a marked feature
sr_return_count: 1           # only when > 0
```

Emit rules (handoff-write.ts): `chain_path` written iff the effective value is `"test-first"`; `sr_return_count` written iff the normalised value is > 0. Parse rules (handoff-parse.ts): `chain_path` kept iff it equals `"test-first"` (`parseEnumField` with `CHAIN_PATH_VALUES = ["test-first"]`), else dropped; `sr_return_count` kept iff it is a finite number ≥ 1 (floored), else dropped. Both enter the `state` object through the existing conditional-spread block, so a parse of an unmarked file yields no key at all (AC12, AC16).

### `WriteHandoffStateOptions` (T-E431-01)

```ts
// Feature-scoped carry, the dispatch_mode rule: given -> set; omitted on the
// same feature -> carry existing; omitted after a feature change -> unset.
// There is no clearing value (the enum has one member). NOT re-armed on PM
// re-entry. File mode only: SqliteHandoffStorage.writeState ignores it.
chainPath?: ChainPath;
// Server-computed like hopCount; NOT carried when omitted (an omitting write
// means 0). Written only when > 0. File mode only.
srReturnCount?: number;
```

`chainPath` joins the existing preserve read exactly like `dispatchMode` (`chainPathNeedsExisting = chainPath === undefined`, add it to the `if (...)` guard, resolve `existing?.active_feature === _activeFeature ? existing?.chain_path : undefined`). The migration heal-write in `readHandoffState` adds `srReturnCount: state.sr_return_count` beside `hopCount` (the v12 forward-safety lesson); `chainPath` needs nothing there because the heal is same-feature and the carry keeps it.

### Schema 15 → 16 (T-E431-01)

```ts
// v15 -> v16: add optional chain_path marker and sr_return_count counter
// (E431). Additive STAMP-ONLY, seeds nothing: absence of chain_path === the old
// chain (every pre-v16 feature entered by it), absence of sr_return_count === 0
// (a historical feature has never made a test-first return). Seeding either
// would fabricate state. Same template as v14 -> v15.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff",
  from: 15,
  to: 16,
  up: (input) => ({ ...input, schema_version: 16 }),
});
```

`CURRENT_VERSIONS = { handoff: 16, tasks: 2, sqlite: 2, config: 2 }`. The heal-write on first `tw_get_state` stamps 16 and writes no new key.

### Test-first overlay (T-E431-03, `tools/transitions.ts`)

```ts
// Edges a test-first feature gains. None of these exists in ALLOWED, so an
// unmarked feature can never take one.
const TEST_FIRST_OPENS: ReadonlyMap<string, AllowedNext> = new Map([
  ["pm:In_Progress",            [{ agent: "qa-engineer",   status: "In_Progress" }]],
  ["architect:In_Progress",     [{ agent: "qa-engineer",   status: "In_Progress" }]],
  ["qa-engineer:In_Progress",   [{ agent: "sr-engineer",   status: "In_Progress" }]],
  ["sr-engineer:In_Progress",   [{ agent: "qa-engineer",   status: "In_Progress" }]],
  ["code-reviewer:In_Progress", [{ agent: "code-reviewer", status: "PASS" }]],
  ["code-reviewer:FAIL",        [{ agent: "qa-engineer",   status: "In_Progress" }]],
  ["code-reviewer:PASS", [
    { agent: "pm", status: "In_Progress" },
    { agent: "researcher", status: "In_Progress" },
    { agent: "release-engineer", status: "In_Progress" },
    { agent: "design-auditor", status: "In_Progress" },
  ]],
]);
// Edges a test-first feature loses. Each exists in ALLOWED.
const TEST_FIRST_CLOSES: ReadonlyMap<string, AllowedNext> = new Map([
  ["pm:In_Progress",            [{ agent: "sr-engineer", status: "In_Progress" }]],
  ["architect:In_Progress",     [{ agent: "sr-engineer", status: "In_Progress" }]],
  ["code-reviewer:In_Progress", [{ agent: "qa-engineer", status: "In_Progress" }]],
  ["qa-engineer:In_Progress",   [
    { agent: "qa-engineer", status: "PASS" },
    { agent: "qa-engineer", status: "FAIL" },
  ]],
]);
export const TEST_FIRST_OVERLAY = { opens: TEST_FIRST_OPENS, closes: TEST_FIRST_CLOSES } as const;
```

`ALLOWED` / `ALLOWED_TRANSITIONS` are not edited, so `scripts/check-transitions-sync.mjs` and its mirror table stay green unchanged.

## Marker-Gated Edge Table

Full effective successor set per key; **bold** = differs between the paths. Keys not listed are identical on both paths. Self-loops, the Amend-Resume edges and the cap collapses apply on both paths as today.

| prev | unmarked (old path, = `ALLOWED_TRANSITIONS`) | marked (`chain_path: test-first`) |
|---|---|---|
| pm:In_Progress | architect, **sr-engineer**, researcher, design-auditor (all In_Progress), pm:Blocked, pm:In_Progress; qa-engineer:In_Progress only with `resume_of: "qa-engineer"` | architect, researcher, design-auditor (In_Progress), pm:Blocked, pm:In_Progress, **qa-engineer:In_Progress (no `resume_of` needed)** |
| architect:In_Progress | **sr-engineer:In_Progress**, architect:Blocked, pm:In_Progress | architect:Blocked, pm:In_Progress, **qa-engineer:In_Progress** |
| qa-engineer:In_Progress | **qa-engineer:PASS**, **qa-engineer:FAIL**, qa-engineer:Blocked | qa-engineer:Blocked, **sr-engineer:In_Progress** |
| sr-engineer:In_Progress | code-reviewer:In_Progress, sr-engineer:Blocked, pm:In_Progress | code-reviewer:In_Progress, sr-engineer:Blocked, pm:In_Progress, **qa-engineer:In_Progress** (the return; capped at 2) |
| code-reviewer:In_Progress | code-reviewer:FAIL, code-reviewer:Blocked, **qa-engineer:In_Progress** | code-reviewer:FAIL, code-reviewer:Blocked, **code-reviewer:PASS** |
| code-reviewer:FAIL | sr-engineer:In_Progress, pm:In_Progress | sr-engineer:In_Progress, pm:In_Progress, **qa-engineer:In_Progress** |
| code-reviewer:PASS | **(no key: every write rejected)** | **pm, researcher, release-engineer, design-auditor (all In_Progress)** |

D6 confirmed as written in the spec, with one precision: the marked feature keeps `pm:In_Progress → code-reviewer:In_Progress` with `resume_of: "code-reviewer"` (the judge's Amend-Resume), and `qa-engineer:Blocked → sr-engineer`, `release-engineer:Blocked → qa-engineer` stay open on both paths (a marked qa-engineer that resumes there can only go on to sr-engineer, so neither bypasses code-reviewer). AC5 holds structurally: `qa-engineer:In_Progress` has no edge to `code-reviewer` on either path.

### Marker set point and immutability (D5 confirmed)

```ts
// The writes that may carry chain_path on a feature not yet marked.
export function isChainPathSetPoint(prev: TransitionTuple, next: TransitionTuple): boolean {
  if (next.agent === "pm") return true;                          // (i) any pm write
  return (
    next.agent === "qa-engineer" && next.status === "In_Progress" &&
    prev.status === "In_Progress" && (prev.agent === "pm" || prev.agent === "architect")
  );                                                             // (ii) the entry write
}
```

- **Marked** for a write = `prev_chain_path === "test-first"` (persisted, same feature) OR (`next_chain_path === "test-first"` AND `isChainPathSetPoint(prev, next)`).
- **Illegal set** = `next_chain_path` present, `prev_chain_path` absent, not a set point → rejected (AC10). Covers sr-engineer, code-reviewer, qa-engineer outside the entry edge, architect (incl. pm → architect), researcher and design-auditor writes, including a feature-opening write by a non-pm role.
- **Immutable**: zod admits only `"test-first"`, there is no clearing value, the write layer carries it, and pm re-entry does not re-arm it. A redundant `chain_path` on an already-marked feature is a no-op, never a rejection.
- **Feature change**: the orchestrator passes `prev_chain_path: undefined` when `feature_changed`, and the write layer drops the old value, so the new feature starts unmarked unless its own opening pm write carries the marker.
- **Switching an in-flight old-path feature**: only through a pm write (set point (i)); from then on the old-path edges of the table are closed for it. No other route exists.
- **SQLite/HTTP**: the orchestrator passes neither field, so marked is always false (AC18).

### AC10 error code

`TRANSITION_REJECTED` (existing, producer `validateTransition`, transition-json envelope). It is the code a writer already reads as "this edge is not open for you", and it keeps the rejection inside step 1 with no new code. Envelope: `allowed` = the unmarked successor list of `prev` (`ALLOWED.get(key)`), hint (architect-authored, Copy below).

## Interface Contracts

### `tools/transitions.ts` (T-E431-03 unless marked T-05)

```ts
import type { ChainPath } from "./handoff-types.js"; // type-only: runtime graph unchanged

export interface TransitionRequest {
  // ...existing fields unchanged...
  // E431 — all optional; omitting all three reproduces the base-commit result.
  prev_chain_path?: ChainPath;   // persisted marker of the SAME feature; caller passes undefined on feature change and in SQLite mode
  next_chain_path?: ChainPath;   // the incoming write's chain_path; caller passes undefined in SQLite mode
  prev_sr_return_count?: number; // persisted sr_return_count; default 0
}

export interface TransitionRejection {
  error: /* existing 16 members */ | "SR_RETURN_CAP_EXCEEDED"; // 17 members (DR-8 re-pin)
  // attempted / allowed / hint shapes unchanged
}

const SR_RETURN_CAP = 2;
export const SR_RETURN_CAP_EXPORTED = SR_RETURN_CAP;

export const PASS_IDENTITY_REFINE_MESSAGE = 'status="PASS" requires agent_id="qa-engineer"';

export const TEST_FIRST_OVERLAY: { opens: ReadonlyMap<string, AllowedNext>; closes: ReadonlyMap<string, AllowedNext> };
export function isChainPathSetPoint(prev: TransitionTuple, next: TransitionTuple): boolean;

// Effective successors of a key. chainPath undefined -> ALLOWED.get(key) ?? []
// (same array contents and order as today). "test-first" -> base entries minus
// closes (base order kept), then opens appended in overlay order.
export function allowedSuccessors(key: string, chainPath?: ChainPath): AllowedNext;

export function validateTransition(req: TransitionRequest): TransitionRejection | null;

// New counter, kept out of computeNewRound so that function's 7-key return
// object (deep-equal pinned in test/qa-flow.test.mjs; also called by the
// e423-owned test/visual-gate-e2e.test.mjs) is unchanged.
export function computeSrReturnCount(
  prev_sr_return_count: number,
  prev: TransitionTuple,
  next: TransitionTuple,
  feature_changed: boolean,
): number;

// T-E431-05
export function judgeFor(chainPath?: ChainPath): "qa-engineer" | "code-reviewer";
export function requireJudge(
  agentId: string | undefined,
  toolName: string,
  chainPath?: ChainPath,
): AgentGateResult; // chainPath !== "test-first" -> return requireQaEngineer(agentId, toolName) (byte-identical)
```

`AllowedNext` stays a module-private type; export it as a type (`export type AllowedNext`) so the signature above is nameable.

### `validateTransition` precedence (new steps in bold)

1. agent_id / status validity — unchanged.
2. **1.5 marker check** — compute `marked`; on an illegal set return `TRANSITION_REJECTED` (AC10). Unreachable when `next_chain_path` is undefined.
3. 2. qa / review / visual round caps — unchanged.
4. 2.5 hop cap — unchanged.
5. **2.6 sr-return cap** — `if (marked && !req.feature_changed && prev = sr-engineer:In_Progress && next = qa-engineer:In_Progress && (req.prev_sr_return_count ?? 0) >= SR_RETURN_CAP)` → `rejection(req, "SR_RETURN_CAP_EXCEEDED", [{ agent: "pm", status: "In_Progress" }], \`sr_return_count=${n}${gate("SR_RETURN_CAP_EXCEEDED").hintStatic}\`)`. Edge-specific: every other write on the feature is evaluated normally (AC6 last sentence). Placed after the round and hop caps, so a feature at review_round 4 or hop 14 reports those codes first.
6. 3. self-loop fast path — unchanged.
7. 3.5 Amend-Resume — unchanged.
8. 4. table lookup — `allowedSuccessors(keyOf(prev), marked ? "test-first" : undefined)` instead of `ALLOWED.get(key)`. Rejection hint: base text; **plus**, when `marked` and the attempted pair is in `TEST_FIRST_OVERLAY.closes` for that key, the suffix `hint.closed_by_marker` (Copy). The Amend-Resume branch (prev pm:In_Progress, next code-reviewer/qa-engineer In_Progress) keeps its shape; **when `role === "qa-engineer"` its hint gains `hint.pm_to_qa`** (AC9). The code-reviewer variant and the `allowed` list (6 static + 2 conditional) are unchanged.

### `computeSrReturnCount` / counter rules (D7 confirmed)

| event | `sr_return_count` | `review_round` | `hop_count` |
|---|---|---|---|
| active_feature change | 0 base | 0 base (today) | 0 base (today) |
| next = pm:In_Progress | → 0 | → 0 (today) | +1 if role change (today) |
| prev sr-engineer:In_Progress → next qa-engineer:In_Progress | +1 | unchanged | +1 |
| next = code-reviewer:FAIL (either later routing) | unchanged | +1 (today) | unchanged (same agent) |
| prev code-reviewer:In_Progress → next qa-engineer:In_Progress (old path only) | unchanged | → 0 (today) | +1 |
| **next = code-reviewer:PASS** | unchanged | **→ 0 (new branch in computeNewRound)** | unchanged |
| anything else | carry | carry | today's rule |

- `computeSrReturnCount`: `base = feature_changed ? 0 : prev`; `pm:In_Progress → 0`; sr→qa `In_Progress` pair → `base + 1`; else `base`. Pure, no marker argument (the edge is only reachable on a marked feature because step 4 rejects it otherwise).
- `computeNewRound`: one added `else if (next.agent === "code-reviewer" && next.status === "PASS") review_round = 0;` in the review chain. Signature and return keys unchanged. No `*_total` mirror for the new counter; `review_rounds_total` already counts every code-reviewer FAIL.
- On a marked feature `review_round` is never reset by a hand-off (the old reset edge is closed), so it counts every rejection to either role until pm or PASS: AC7.
- No cap-cross pending-note sentinel for `sr_return_count` (the cap is edge-specific and the feature continues).

### `gates/registry.ts` (T-E431-03)

```ts
// GateErrorCode union gains | "SR_RETURN_CAP_EXCEEDED"
{
  errorCode: "SR_RETURN_CAP_EXCEEDED",
  producer: "validateTransition",
  envelope: "transition-json",
  triggerEdge:
    "prev_sr_return_count >= 2 on sr-engineer:In_Progress -> qa-engineer:In_Progress, test-first features only (chain_path: test-first, file mode); feature_changed bypasses",
  armCondition: "opt-in (counter present; marked feature only)",
  clearingArtifact: "(pm, In_Progress) reset (sr_return_count -> 0) or active_feature change",
  hintStatic:
    " — sr-engineer has returned this feature to qa-engineer the maximum 2 times. " +
    "Route to pm (pm:In_Progress) for a human ruling on the scenario.",
  documentedInProse: false, // prose citation lands with E433
},
```

- Position: directly after `HOP_CAP_EXCEEDED` in the transition-json group (doc order only); `DISPATCH_PIN_TIER_REJECTED` stays last. Renumber the group comments (transition-json codes 1-7, the following groups +1, tool-boundary code 35); "The 34-gate catalog" → 35.
- Mapping comment row: `//   SR_RETURN_CAP_EXCEEDED          (none)` after the HOP_CAP_EXCEEDED row.
- `TRANSITION_GATE_CODES` gains `"SR_RETURN_CAP_EXCEEDED"` after `"HOP_CAP_EXCEEDED"` (7 codes; fix its comment "The 6 codes" → 7 and "15-member" → 17-member). `test/e35-pipeline-order.test.mjs` imports the constant, so it stays green; the TRANSITION_VALIDATION step's `codes` grows by one while the step count stays 17.
- For qa (T-E431-09): the `triggerEdge` `>= 2` literal is shaped for `CAP_BY_CODE` (`SR_RETURN_CAP_EXCEEDED: SR_RETURN_CAP_EXPORTED`); `armCondition` is free English and goes in `FREE_TEXT_ALLOWLIST`, like HOP_CAP_EXCEEDED's.

### `tools/registry.ts` (T-E431-02)

- zod `UpdateStateArgs`: `chain_path: z.enum(["test-first"]).optional(),` with a comment (file-mode only, set points, permanent).
- inputSchema `chain_path`: `{ type: "string", enum: ["test-first"], description: <Copy desc.chain_path> }`.
- PASS refine: `.refine((d) => d.status !== "PASS" || d.agent_id === "qa-engineer" || d.agent_id === "code-reviewer", { message: PASS_IDENTITY_REFINE_MESSAGE, path: ["agent_id"] })`. Every non-{qa, code-reviewer} PASS keeps today's zod rejection byte for byte. The code-reviewer half moves into the orchestrator (next section). `PASS_IDENTITY_REFINE_MESSAGE` is imported from `./transitions.js`, so sr runs T-E431-03 before T-E431-02 (ledger order unchanged; execution order T-01, T-03, T-02, T-04, T-05, T-06).
- Descriptions (Copy desc.*): `status`, `agent_id`, `completed_tasks` on `tw_update_state`; tool description and `agent_id` on `tw_complete_task`.

### `tools/handoff-orchestrator.ts` (T-E431-04: wiring)

```ts
// Persisted marker of `activeFeature` (file mode only). Read-only, never
// throws: a missing, unparseable or other-feature handoff reads as unmarked,
// which is today's behaviour. Exported for tools/tasks.ts.
export function readPersistedChainPath(workspacePath: string, activeFeature?: string): ChainPath | undefined;
// = storage instanceof FileHandoffStorage, try { s = storage.parse(ws) } catch { return undefined },
//   activeFeature === undefined || s?.active_feature === activeFeature ? s?.chain_path : undefined

// The marker this write runs under (file mode only); same rule as validateTransition's `marked`.
function resolveChainPath(ctx: UpdateStateGateContext): ChainPath | undefined;
// = !(ctx.storage instanceof FileHandoffStorage) ? undefined
//   : (!ctx.feature_changed && ctx.prevState?.chain_path) ||
//     (ctx.parsed.chain_path && isChainPathSetPoint(ctx.prevTuple, ctx.nextTuple) ? ctx.parsed.chain_path : undefined)

// pm:In_Progress -> {architect, sr-engineer}:In_Progress, or -> qa-engineer:In_Progress on a marked feature.
function isBuildEntryEdge(prev: TransitionTuple, next: TransitionTuple, chainPath?: ChainPath): boolean;
```

- `gates/pipeline.ts`'s `UpdateStateGateContext` is NOT extended (not this lane's file); steps call `resolveChainPath(ctx)` (pure, no I/O, cheap).
- TRANSITION_VALIDATION step passes `prev_chain_path: fileMode && !feature_changed ? prevState?.chain_path : undefined`, `next_chain_path: fileMode ? parsed.chain_path : undefined`, `prev_sr_return_count: prevState?.sr_return_count ?? 0`.
- The four build-entry steps (SCOPE_DECISION_REQUIRED, CUT_APPROVAL_REQUIRED, EXTERNAL_REFS_UNRESOLVED, SOURCE_CREDIBILITY_UNVERIFIED) replace their inline edge predicate with `isBuildEntryEdge(prevTuple, nextTuple, resolveChainPath(ctx))`, keeping each step's own storage guard, and build `allowed` from `allowedSuccessors("pm:In_Progress", chainPath)`. Unmarked: identical boolean and identical `allowed`. On a marked feature every pm → qa-engineer write arms them, with or without `resume_of` (Open Question 1).
- Post-pipeline: `new_sr_return_count = computeSrReturnCount(prevState?.sr_return_count ?? 0, prevTuple, nextTuple, feature_changed)`; `writeState({ ..., chainPath: resolvedChainPath, srReturnCount: new_sr_return_count })` (both ignored by SQLite; `resolvedChainPath` is always undefined there).
- next_role lookahead: `effectiveAllowedSuccessors(nextTuple, { ...counters, sr_return_count: new_sr_return_count }, { ..., chainPath: resolvedChainPath })`.

```ts
function effectiveAllowedSuccessors(
  prev: TransitionTuple,
  counters: { qa_round: number; review_round: number; visual_round: number; hop_count: number; sr_return_count?: number },
  options: { assumeResumeOf?: boolean; featureChanged?: boolean; chainPath?: ChainPath } = {},
): Array<{ agent: AgentName; status: StatusName }>;
// inner call adds: prev_chain_path: feature_changed ? undefined : options.chainPath,
//                  prev_sr_return_count: counters.sr_return_count ?? 0
// (next_chain_path is never passed: the lookahead asks what the NEXT write may do on the post-write state)
```

### `tools/handoff-orchestrator.ts` (T-E431-05: judge identity)

1. **PASS guard, code-reviewer half — first statement of `handleUpdateStateCore`, before `enforcePreFlight`:**
   ```ts
   if (parsed.status === "PASS" && parsed.agent_id === "code-reviewer" &&
       readPersistedChainPath(parsed.workspace_path, parsed.active_feature) !== "test-first") {
     throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: ["agent_id"], message: PASS_IDENTITY_REFINE_MESSAGE }]);
   }
   ```
   `index.ts` formats a thrown `ZodError` with the same `formatZodError`, so an unmarked code-reviewer PASS returns exactly today's `❌ Invalid arguments for tw_update_state: agent_id: status="PASS" requires agent_id="qa-engineer"` with `isError: true`, before the pre-flight guard, in both storage modes, with no telemetry line (as today). Import `z` from `"zod"` (same instance as `index.ts`).
2. **PASS guard, general half — replaces lines 1219–1226, moved after `prevState`, `feature_changed` and the tuples are built** (before the pipeline): `const gate = requireJudge(parsed.agent_id, "tw_update_state(status=PASS)", resolvedChainPath); if (!gate.ok) return { content: [{ type: "text", text: gate.message ?? "blocked" }] };` Unmarked: today's defense-in-depth text, no `isError` (unchanged). Marked: msg.pass_judge, same shape (AC4). `resolvedChainPath` here is computed with the same rule as `resolveChainPath` from the locals.
3. **REVIEW_VERDICT_STATUS_MISMATCH step:** APPROVED is consistent with `In_Progress`, or with `PASS` when `resolveChainPath(ctx) === "test-first"`. Text and hint unchanged.
4. **REVIEWER_COMPLETED_TASKS_REJECTED step:** unmarked → both branches exactly as today. Marked → the code-reviewer branch is skipped; any other present `agent_id` (qa-engineer included) with non-empty `completed_tasks` → `NON_QA_COMPLETED_TASKS_REJECTED` with text msg.non_judge_completed (Copy; no `hintStatic`, whose sentence names qa-engineer as the grower).
5. **Ledger removal:** `parsed.agent_id === judgeFor(resolvedChainPath) && status === "FAIL" && review_task_ids non-empty`.
6. **RAG clear:** `parsed.status === "PASS" && parsed.agent_id === judgeFor(resolvedChainPath)` (only SQLite has `deletePrdChunks` and SQLite is never marked; kept for E435).

### `tools/tasks.ts` (T-E431-05)

```ts
export async function handleCompleteTask(parsed: CompleteTaskInput): Promise<ToolResult> {
  enforcePreFlight(parsed.workspace_path, "tw_complete_task");
  const gate = requireJudge(parsed.agent_id, "tw_complete_task", readPersistedChainPath(parsed.workspace_path));
  // ...unchanged...
}
```

`tw_complete_task` has no `active_feature`, so it reads the marker of the workspace's current feature. Unmarked, corrupt handoff or SQLite → `requireQaEngineer` text exactly as today (AC14).

### Copy (architect-authored additions; spec Copy rows are used verbatim)

| id | text |
|---|---|
| hint.illegal_set (AC10) | `chain_path: "test-first" can be set only by a pm write or on the entry write pm:In_Progress / architect:In_Progress → qa-engineer:In_Progress; this feature is on the old path (<prev key> → <next key>). Omit chain_path, or route to pm (pm:In_Progress) to move the feature to the test-first path.` |
| hint.closed_by_marker (suffix) | ` This feature is on the test-first path (chain_path: test-first), which closes this edge.` |
| hint.sr_return_cap | `sr_return_count=<n>` + spec `hint.sr_return_cap` static part (unchanged wording) |
| hint.pm_to_qa | spec Copy row, appended to today's Amend-Resume hint for `qa-engineer` only |
| msg.pass_judge / msg.complete_task_judge | spec Copy rows; produced by `requireJudge` as `` `⛔ BLOCKED: ${toolName} is reserved for code-reviewer on a test-first feature (chain_path: test-first). Called by ${who}. Hand off to code-reviewer and pass agent_id="code-reviewer".` `` (`who` built as in `requireQaEngineer`) |
| msg.non_judge_completed | `⛔ NON_QA_COMPLETED_TASKS_REJECTED: completed_tasks=[<ids>] on an agent_id=<agent> write on a test-first feature (chain_path: test-first). Only agent_id=code-reviewer, this feature's judge, may grow completed_tasks (or complete tasks through tw_complete_task). Omit completed_tasks (or pass []) on this write.` |
| desc.chain_path | `Test-first chain marker (handoff schema v16, file-mode only). Set "test-first" on a pm write or on the entry write pm/architect → qa-engineer:In_Progress to put this feature on the test-first chain (qa-engineer writes the tests, sr-engineer builds, code-reviewer judges and writes PASS). On any other write of an unmarked feature it is rejected (TRANSITION_REJECTED). Feature-scoped and permanent: carried across writes that omit it, never cleared, dropped when active_feature changes, NOT re-armed on PM re-entry. Ignored in SQLite/HTTP mode.` |
| desc.status | `Execution status. status="PASS" requires agent_id="qa-engineer" (agent_id="code-reviewer" on a test-first feature, chain_path: "test-first").` |
| desc.agent_id | `Agent name. Validated against ALLOWED_TRANSITIONS. PASS reserved for "qa-engineer" ("code-reviewer" on a test-first feature).` |
| desc.completed_tasks | today's text with its first sentence replaced by `Task ids the judge has completed for this feature (only agent_id "qa-engineer" may change it; "code-reviewer" on a test-first feature).` and `a qa-engineer FAIL write` → `the judge's FAIL write` |
| desc.complete_task | `Mark task completed [x]. Reserved for qa-engineer — pass agent_id="qa-engineer" (code-reviewer on a test-first feature, chain_path: test-first).`; its `agent_id`: `Must be "qa-engineer" ("code-reviewer" on a test-first feature). Other values rejected.` |

### Hop-cap comment (`tools/transitions.ts:325-332`, AC17)

Replace the comment above `const HOP_CAP = 14;` (keep that literal: `test/e295-hop-cap-and-sop-halves.test.mjs:31` pins `HOP_CAP\s*=\s*14`) with:

```ts
// v9 (d2-server-brake-accounting) — const-01 Limits: `hop` cap — max
// auto-routing role transitions per feature (14 since E295, was 10). An
// independent brake, not a backstop behind the round caps: it counts every
// role hand-off on either chain path (sr-engineer -> qa-engineer returns
// included), so depending on the mix of rejections it can trip before or
// after any round cap or the sr-return cap. Unlike the round caps, hop_count
// is feature-scoped: it resets ONLY on active_feature change, never on PM
// re-entry (DR-6), so after the gate fires autonomous dispatch stays frozen
// at the (pm, In_Progress) landing until a human re-scopes into a new feature.
```

## Sequence Diagram

```mermaid
sequenceDiagram
  participant PM as pm
  participant QA as qa-engineer
  participant SR as sr-engineer
  participant CR as code-reviewer
  participant S as server (tw_update_state / tw_complete_task)
  PM->>S: pm:In_Progress, cut_approved, chain_path=test-first (set point i)
  S-->>PM: persisted chain_path=test-first
  QA->>S: qa-engineer:In_Progress (no resume_of)
  Note over S: step 1 overlay opens pm→qa; build-entry checks arm (cut, scope, refs, credibility)
  QA->>S: sr-engineer:In_Progress (tests written)
  SR->>S: qa-engineer:In_Progress (return 1, test contradicts scenario)
  Note over S: sr_return_count 0→1; a 3rd return → SR_RETURN_CAP_EXCEEDED, allowed=[pm:In_Progress]
  QA->>S: sr-engineer:In_Progress
  SR->>S: code-reviewer:In_Progress
  CR->>S: code-reviewer:FAIL (review_round +1)
  QA->>S: qa-engineer:In_Progress (code-reviewer:FAIL → qa, marked only)
  QA->>S: code-reviewer:In_Progress
  S-->>QA: TRANSITION_REJECTED (must pass through sr-engineer)
  QA->>S: sr-engineer:In_Progress
  SR->>S: code-reviewer:In_Progress
  CR->>S: tw_complete_task(T-n, agent_id=code-reviewer)
  Note over S: requireJudge(chain_path) → code-reviewer allowed
  CR->>S: code-reviewer:PASS, completed_tasks=[]
  Note over S: pre-preflight peek: marked → no zod-shaped reject; requireJudge ok; review_round → 0
  PM->>S: pm / release-engineer / researcher / design-auditor:In_Progress (code-reviewer:PASS exits)
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Where the new edges live | Separate exported overlay applied inside `validateTransition`; `ALLOWED_TRANSITIONS` untouched | Old matrix, its mirror table and `check:transitions-sync` unchanged by construction; the overlay mirror in the spec doc is not covered by the sync script (out of lane scope), so qa's e431 test should assert the doc table equals `TEST_FIRST_OVERLAY` |
| How the marker reaches the check | Three optional `TransitionRequest` fields; `validateTransition` decides `marked` itself | Pure module stays fs-free; omitting the fields reproduces base output; the AC10 illegal-set rejection lives in step 1 with no orchestrator-side duplicate |
| AC10 code | Reuse `TRANSITION_REJECTED` | No new code; the envelope `allowed` is the unmarked successor list, which tells the writer the legal moves |
| Where the PASS identity check goes | Zod refine relaxed to admit code-reviewer; the code-reviewer half runs before pre-flight with a read-only peek and throws the same `ZodError`; a marker-aware guard runs after `prevState` | Every unmarked outcome keeps text, `isError` and ordering vs `BLOCKED`; the only delta is a code-reviewer PASS that also fails another zod refine, whose message no longer lists the PASS issue (still rejected) |
| Alternative: remove the refine entirely | Rejected | Would move every non-qa PASS behind a pre-flight peek and change multi-issue zod texts for all roles, a wider old-path delta for no gain until E435 |
| sr-return counter placement | New pure `computeSrReturnCount`, not a new key in `computeNewRound` | `computeNewRound`'s 7-key return, deep-equal pinned in `test/qa-flow.test.mjs:522-540`, stays unchanged, and the e423-owned callers (`test/visual-gate-e2e.test.mjs`) see no shape change |
| Judge messages' `isError` | Mirror today's `requireQaEngineer` shape (no `isError`) | `handleUpdateState` would otherwise emit a `BLOCKED` telemetry line (`GATE_TEXT_RE` matches `⛔ BLOCKED`); qa asserts on text + unchanged state |
| Marked-path non-judge `completed_tasks` | Reuse `NON_QA_COMPLETED_TASKS_REJECTED` with marker-specific text, no new code | Registry stays at 35 per the cut; the code name reads oddly for qa-engineer until E433/E435 reword |
| Extending `UpdateStateGateContext` | Not extended; steps recompute `resolveChainPath(ctx)` | `gates/pipeline.ts` stays out of the lane; one cheap pure call per step |
| Build-entry checks with `resume_of` on a marked feature | Arm regardless of `resume_of` | Closes an unapproved-build bypass (pm → qa with `resume_of` → sr builds); an Amend-Resume of qa on a marked feature needs `cut_approved: true` on the pm write, as every pm → sr re-entry already does |

## Old-Path-Unchanged Invariants (qa proves under AC12)

An *unmarked write* has no `chain_path` in persisted state and none on the incoming write. For each, qa may diff against the base build: `git archive 0efc203 dist package.json | tar -x -C "$TMPDIR/e431-base"` plus `ln -s <worktree>/node_modules "$TMPDIR/e431-base/node_modules"`, then import both `dist/` trees.

- **I1** `ALLOWED_TRANSITIONS` deep-equal to base (keys, entries, order); `npm run check:transitions-sync` (postbuild) passes with the mirror table untouched.
- **I2** `validateTransition(req)` with none of `prev_chain_path`, `next_chain_path`, `prev_sr_return_count`: deep-equal to base for every prev in the 8×4 grid + `null:null`, every next in the 8×4 grid, `next_resume_of` ∈ {undefined, code-reviewer, qa-engineer}, counters below/at each cap, `feature_changed` ∈ {false, true}. Sole allowed delta: the hint of a `pm:In_Progress → qa-engineer:In_Progress` rejection ends with `hint.pm_to_qa`.
- **I3** `computeNewRound` returns the same 7 keys and values for every input whose `next` is not `code-reviewer:PASS`.
- **I4** `HOP_CAP_EXPORTED` 14, `ROUND_CAP_EXPORTED` 4, `REVIEW_ROUND_CAP_EXPORTED` 4, `VISUAL_ROUND_CAP_EXPORTED` 6.
- **I5** `tw_update_state` replay of the AC12 chains (pm → sr → cr → qa → PASS; pm → architect → sr variant; qa FAIL → sr loop; bugfix run; Amend-Resume hand-back) plus PASS by sr-engineer/code-reviewer (zod text, before pre-flight), the four build-entry envelopes, verdict mismatch, both completed-tasks codes, qa FAIL ledger removal and next_role lookahead warnings: identical text, `isError`, error code and persisted counters.
- **I6** Persisted handoff after each unmarked write: identical keys and values to base except `schema_version: 16`; no `chain_path`, no `sr_return_count`.
- **I7** `tw_complete_task` on an unmarked, missing or unparseable handoff: today's outcome and text.
- **I8** SQLite/HTTP: `chain_path` accepted by zod, never persisted, never passed to `validateTransition`; `CURRENT_VERSIONS.sqlite` 2; `tools/storage-sqlite.ts` and `schema/migrations-sqlite.ts` byte-identical.
- **I9** `UPDATE_STATE_GATE_PIPELINE`: 17 steps, same names and order; only `TRANSITION_VALIDATION.codes` gains `SR_RETURN_CAP_EXCEEDED`.
- **I10** No telemetry line on an unmarked write that base did not emit.

## Task Budget Map

`dist/` regenerated by `npm run build` after each task and not counted. Line counts are estimates of added + changed lines.

| task | files (count) | est. lines | depends (execution order) | notes |
|---|---|---|---|---|
| T-E431-01 | `tools/handoff-types.ts`, `tools/handoff-parse.ts`, `tools/handoff-write.ts`, `schema/versions.ts`, `schema/migrations-handoff.ts` (5) | ~110 | none | `ChainPath` lives here so T-03 can `import type` it |
| T-E431-03 | `tools/transitions.ts`, `gates/registry.ts` (2) | ~200 | T-01 (type import) | runs second |
| T-E431-02 | `tools/registry.ts` (1) | ~35 | T-03 (`PASS_IDENTITY_REFINE_MESSAGE`) | runs third; ledger lists no dependency, execution order covers it |
| T-E431-04 | `tools/handoff-orchestrator.ts` (1) | ~110 | T-01, T-02, T-03 | wiring, build-entry predicate, persistence, lookahead |
| T-E431-05 | `tools/handoff-orchestrator.ts`, `tools/tasks.ts`, `tools/transitions.ts`, `qa_reports/expected-red_e431-test-first-server-path.txt` (3 source + manifest) | ~110 | T-04 | judge identity; manifest written here (last code task) from the Probe table, with the predictions below |
| T-E431-06 | `specs/qa-flow-enforcement-architecture.md`, `docs/architecture.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/schema-versions.md` (5) | ~100 | T-05 | docs; `npm run build`; `CLAUDE.md` stays 250 lines, only line 78 changes |

T-E431-06 specifics: spec doc gets a new H2 `## Test-First Overlay (chain_path, E431)` placed after the `## ALLOWED_TRANSITIONS Matrix` section (never inside it: the sync script parses that section's rows) with the two overlay tables, the set-point rule, the sr-return cap, the judge rule, and an amendment to the sentence "The Scope Decision Gate and Cut-Approval Gate do not fire on these edges..." naming the marked pm → qa arming; `## Round Counter Semantics` gains the `sr_return_count` and `code-reviewer:PASS` rows. `docs/architecture.md`: in the step-1 box add one line for `sr_return_count ≥ 2 (SR_RETURN_CAP)` → only `(pm, In_Progress)` on the sr → qa return, keep every box line the same width as its neighbours; P1 block gains the two counter rules; line 111 "34 entries" → 35. `CONTRIBUTING.md:53` comment → `ALLOWED_TRANSITIONS + test-first overlay + round caps`, `:64` → 35. `CLAUDE.md:78` → `... (ROUND_CAP=4, REVIEW_ROUND_CAP=4, VISUAL_ROUND_CAP=6, SR_RETURN_CAP=2)`. `docs/schema-versions.md`: one v16 row after v15 (adds `chain_path` + `sr_return_count`, stamp-only, absence = old chain / 0, file mode only).

Expected-red predictions for the manifest (qa confirms by running): likely red — `test/e151-resume-of-rejection-hint.test.mjs` (AC11 qa-engineer hint at :64 region), `test/e409-lite-write-tool-facts.test.mjs`, `test/e441-tool-description-contracts.test.mjs` (descriptions), the whole registry-count group (`test/error-code-contract.test.mjs` incl. the AC3 closure test for the new entry, `test/e26-gate-stats.test.mjs`, `test/e308-single-source-tier-enum.test.mjs`, `test/e419-retired-write-mechanisms.test.mjs`), and the whole schema 15 → 16 group incl. `test/skill-evolution-v3.11.test.mjs:80`. Likely green despite the Probe listing — `test/qa-flow.test.mjs:196,1206,1219` (assert only the error code), `:1449` (unmarked `resume_of` hand-back stays exempt), `test/handoff-write-arg-guard.test.mjs:477` (sr-engineer PASS still rejected by the refine with the same text). The manifest lists what the sr run actually shows red.

## Deferred Resources

_None — the spec's Dependencies / Prerequisites records zero external references (`external_refs` omitted by PM's resource audit); nothing was marked ignore or defer._

Deferred by scope (not external resources): code-reviewer `completed_tasks` and PASS evidence on a marked feature are not evidence-checked until E432 (audit amendment (8)); prose citation of `SR_RETURN_CAP_EXCEEDED` (E433); visual judge on the marked path, where `visual_round` cannot tick because qa-engineer cannot FAIL (E434); SQLite persistence of the marker and counter (E435's cut, per D1).

## Open Questions

All items are `architect default`; none needs a human ruling. Each is listed so the integrator's second pre-review can overturn it before sr-engineer starts.

1. **Build-entry checks ignore `resume_of` on a marked feature** — `architect default`. Example: feature X is marked, sits at qa-engineer:In_Progress, pm amends (pm:In_Progress, `cut_approved` re-armed to unset), then qa-engineer resumes with `resume_of: "qa-engineer"`. Under this default the resume is rejected `CUT_APPROVAL_REQUIRED` until pm's write re-passes `cut_approved: true`; under the literal reading of audit (3) ("a resume_of hand-back stays exempt") it would pass, and the next hop (qa → sr) would start building on an unapproved amendment. Unmarked features keep the exemption (AC8).
2. **PASS refine relaxed, not removed** — `architect default`. A pm/sr-engineer/architect PASS on a marked feature still gets the zod text `status="PASS" requires agent_id="qa-engineer"`, which names the wrong judge for that feature; it is still rejected. E433/E435 reword when the old path goes.
3. **Unmarked code-reviewer PASS check runs before pre-flight, by a read-only peek** — `architect default`. Keeps today's order (zod error before `⛔ BLOCKED`) and text; the one delta is a code-reviewer PASS that also fails another refine (e.g. a traversing `prd_path`), whose message then names only the other issue.
4. **Marked non-judge `completed_tasks` reuses `NON_QA_COMPLETED_TASKS_REJECTED`** with marker-specific text — `architect default` (no 36th code; the cut fixes the registry at 35).
5. **Judge-identity messages carry no `isError`**, mirroring today's `requireQaEngineer` results — `architect default` (avoids a `BLOCKED` telemetry line).
6. **Marker setters are exactly pm writes and the pm/architect → qa-engineer entry write** — `architect default`, D5 confirmed. The pm → architect write, researcher/design-auditor feature-opening writes and every later write cannot set it (TRANSITION_REJECTED, AC10).
7. **AC10 code = `TRANSITION_REJECTED`** — `architect default` (the spec delegated the pick).
8. **No cap-cross pending-note sentinel for `sr_return_count`** — `architect default`.
9. **The overlay mirror in `specs/qa-flow-enforcement-architecture.md` is not checked by `scripts/check-transitions-sync.mjs`** (script outside the lane) — `architect default`: qa's e431 test asserts the doc tables equal `TEST_FIRST_OVERLAY`.
