# Spec: d3-gate-fire-telemetry

## Problem Statement

The server enforces 22 cataloged gates (`gates/registry.ts` `GATE_REGISTRY`:
`AGENT_ID_REQUIRED`, `TRANSITION_REJECTED`, `CUT_APPROVAL_REQUIRED`,
`EXTERNAL_REFS_UNRESOLVED`, `REVIEW_VERDICT_STATUS_MISMATCH`, the seven
visual sub-gates, etc.) plus round-cap sentinels. Every one of these
rejections is produced, once, inside `tools/handoff-orchestrator.ts`'s
`handleUpdateState` — but nothing records that a rejection happened. There
is no data on which of the 22 gates ever actually fires in a live session.
Every C-series ticket to date originated from a human noticing friction by
hand; a prose rule or gate that never fires is pure token cost on every
dispatch with no corresponding safety value, and nothing today can
distinguish "load-bearing gate" from "dead weight" except manual memory.
This is the review's highest-leverage ticket (`docs/backlog.md` D3): it is
the only mechanism that applies counter-pressure to what is otherwise
superlinear rule-corpus growth (every friction event adds a rule or gate;
nothing today ever removes one).

## Mechanism

**One emit point**, added as a thin wrapper around the existing
`handleUpdateState` export — zero changes to the frozen gate check-order
body (`tools/handoff-orchestrator.ts`'s own header comment: "Check order is
FROZEN ... No reorder, no merge, no early-return removal").

Verified by inspection (Dependencies section below): all 22
`GateErrorCode` values are produced exclusively inside this one function.
`tools/transitions.ts`'s own `gate(...)` calls only source the *hint text*
for the rejection envelope that `handleUpdateState` then returns — they are
not an independent emit site. No other tool (`tw_complete_task`,
`tw_add_task`, `tw_rollback_task`, `tw_get_state`, `tw_detect_drift`, ...)
currently produces a `GateErrorCode`. One wrapper therefore gives full
coverage.

### 1. New module `tools/telemetry.ts`

```ts
// Append-only gate-fire telemetry sidecar (D3). Observability, not
// authoritative state — deliberately NOT governed by the handoff.ts 4-step
// mutating-tool contract (lock → freshness → atomic write → refresh
// snapshot). Mirrors the existing best-effort, lock-free append precedent
// in gates/qa-review.ts's recordReviewInFile.

import * as fs from "fs";
import * as path from "path";
import { gate, type GateErrorCode } from "../gates/registry.js";

export interface TelemetryEvent {
  ts: string;
  gate: string;        // gate(errorCode).producer: "validateTransition" | "orchestrator" | "unknown"
  error_code: string;
  agent_id: string | null;
  feature: string | null;
}

function telemetryPath(workspacePath: string): string {
  return path.join(workspacePath, ".current", "telemetry.jsonl");
}

// Extracts the gate code from the `⛔ <CODE>` prefix every rejection site in
// tools/handoff-orchestrator.ts emits (verified format, see Dependencies).
// Returns null for non-rejection text.
const GATE_TEXT_RE = /^⛔\s+([A-Z_]+)/;
export function extractGateCodeFromText(text: string): string | null {
  const m = GATE_TEXT_RE.exec(text.trim());
  return m ? m[1] : null;
}

// Best-effort, lock-free append. NEVER throws — a telemetry failure must
// never alter or mask the real tool response.
export function emitGateTelemetry(
  workspacePath: string,
  errorCode: string,
  agentId: string | null | undefined,
  feature: string | null | undefined,
): void {
  try {
    const dir = path.join(workspacePath, ".current");
    fs.mkdirSync(dir, { recursive: true });
    let producer = "unknown";
    try {
      producer = gate(errorCode as GateErrorCode).producer;
    } catch {
      // error_code not in GATE_REGISTRY — keep "unknown", never throw.
    }
    const event: TelemetryEvent = {
      ts: new Date().toISOString(),
      gate: producer,
      error_code: errorCode,
      agent_id: agentId ?? null,
      feature: feature ?? null,
    };
    fs.appendFileSync(telemetryPath(workspacePath), JSON.stringify(event) + "\n", "utf-8");
  } catch {
    // Best-effort observability sidecar — swallow, never propagate.
  }
}
```

### 2. Wrapper in `tools/handoff-orchestrator.ts`

Rename the existing exported function to an internal one
(`handleUpdateStateCore`), body **byte-identical**, and add a new thin
exported `handleUpdateState` that calls it, checks `isError`, and emits
exactly once:

```ts
import { emitGateTelemetry, extractGateCodeFromText } from "./telemetry.js";

export async function handleUpdateState(parsed: UpdateStateInput): Promise<ToolResult> {
  const result = await handleUpdateStateCore(parsed);
  if (result.isError) {
    const first = result.content[0];
    const text = first && first.type === "text" ? first.text : "";
    const errorCode = extractGateCodeFromText(text);
    if (errorCode) {
      emitGateTelemetry(parsed.workspace_path, errorCode, parsed.agent_id, parsed.active_feature);
    }
  }
  return result;
}

async function handleUpdateStateCore(parsed: UpdateStateInput): Promise<ToolResult> {
  // ... existing body, UNCHANGED byte-for-byte ...
}
```

`enforcePreFlight`'s own thrown exceptions (not a `GateErrorCode`, a
separate session guard) propagate through the wrapper unmodified and are
out of scope — they are not part of `GATE_REGISTRY`.

### 3. Retro procedure note — `docs/gate-retro-procedure.md` (new file)

A short SOP note (not a skill/constitution rewrite): tail/parse
`.current/telemetry.jsonl`, group by `error_code`, count fires per feature
or across a window of features, and flag any `error_code` with zero fires
across the last N shipped features (default N=5, documented as an
adjustable default) as a retirement candidate — i.e. a prompt for a human
to review whether that gate's corresponding constitution/skill prose still
earns its token cost. sr-engineer may add a single pointer line to this
doc from `content/skill-pm.md` or `content/skill-release-engineer.md`
(exact placement is sr's call) — no restatement of the mechanism itself
(const-01's "skills MUST NOT restate" mandate).

## User Stories

- As a maintainer of this server's constitution/skill prose, I want to know
  which of the 22 gates have actually fired across recent features, so that
  I can retire zero-fire rules instead of only ever adding more.
- As the coordinator (D2's future consumer), I want the gate-fire emit
  point's shape to accommodate additional fields later without a breaking
  rewrite, so that D2 can share this same sidecar instead of building a
  second one.

## Acceptance Criteria

**AC-1 — Rejection emits one line**
Given any `tw_update_state` call whose result is one of the 22
`GATE_REGISTRY`-cataloged rejections (`isError: true`, text starting with
`⛔ <CODE>`), when `handleUpdateState` returns, then exactly one JSON line
`{ts, gate, error_code, agent_id, feature}` is appended to
`<workspace_path>/.current/telemetry.jsonl`.

**AC-2 — Pass-through emits nothing**
Given a `tw_update_state` call that succeeds (`isError` absent/false), when
`handleUpdateState` returns, then no line is appended. MVP scope is
rejection-only (see Out of Scope for the pass-through tradeoff).

**AC-3 — Directory auto-created**
Given `.current/` does not yet exist in the target workspace, when the
first rejection fires, then the directory is created (`mkdir` recursive)
and the file created with exactly one line — no crash, no error surfaced
to the caller.

**AC-4 — Telemetry never masks the real gate response**
Given `emitGateTelemetry` throws for any reason (disk full, permission
denied, non-writable path), when `handleUpdateState` processes a
rejection, then the returned `ToolResult` (`content` + `isError`) is
byte-identical to what it would have been without telemetry — the throw is
swallowed inside `emitGateTelemetry` itself, never inside the wrapper.

**AC-5 — `gate` field sources from the registry, not re-derived**
Given `error_code` is a value present in `GATE_REGISTRY`, when the line is
emitted, then `gate` equals `gate(error_code).producer`
(`"validateTransition" | "orchestrator"`) — the existing registry is the
single source of truth for this classification; no parallel gate-family
enum is introduced.

**AC-6 — Fixed 5-key shape; nulls not omitted**
Given `agent_id` or `active_feature` is absent/empty on the input, when the
line is emitted, then the corresponding field is JSON `null` (never
omitted, never the string `"undefined"`) — every line has exactly the 5
keys `ts`, `gate`, `error_code`, `agent_id`, `feature`.

**AC-7 — Best-effort append, no file lock**
Given two `tw_update_state` calls reject concurrently (different
processes), when both call `emitGateTelemetry`, then both append via
`fs.appendFileSync` with no `withFileLock` acquisition — a rare
interleaved/lost line under heavy concurrency is an accepted cost (mirrors
the existing `recordReviewInFile` precedent in `gates/qa-review.ts`).
`telemetry.jsonl` is an observability sidecar, not the authoritative state
governed by the 4-step mutating-tool contract
(`guards/file-lock.ts` + `guards/session.ts`).

**AC-8 — Retro procedure documented**
Given `docs/gate-retro-procedure.md` exists, when a human or agent runs it,
then it describes: tail/parse `.current/telemetry.jsonl`, group lines by
`error_code`, count fires, and flag any `error_code` with zero fires across
the last N shipped features (default N=5, documented as adjustable) as a
retirement candidate.

**AC-9 — D2 non-preclusion (MVP-strict)**
Given D2 (server-side hop/token accounting, deferred, `docs/backlog.md`
D2) will later share this emit point, when D3 ships, then the
`TelemetryEvent` shape and the `tools/telemetry.ts` module boundary must
not require a breaking rewrite to add D2's future fields — achieved by
isolating the helper in its own module with an exported named type. D3
itself implements ONLY the 5 fields above; no hop-counter or
token-accounting logic is added by this feature.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature introduces no new user-facing copy — `telemetry.jsonl` is a machine-readable sidecar file, not rendered to any agent/human |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (server-internal, non-design) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Emitting on pass-through (successful) writes — deferred (AC-2 is
  deliberate). Revisit only if retro data shows raw fire-count needs a
  denominator (total attempts per gate) to compute a firing *rate* rather
  than a raw count.
- D2's server-side hop-counter / token-brake accounting
  (`docs/backlog.md` D2) — explicitly deferred. This spec only guarantees
  the emit point's shape doesn't preclude D2 sharing it later (AC-9); no
  D2 logic is built here.
- Retention/rotation/archival of `telemetry.jsonl` — unbounded growth is
  out of scope for this MVP (parallels D7's `qa_reports/` retention gap,
  not blocking here).
- Any reporting/dashboard tool to consume the jsonl — the retro procedure
  (AC-8) is a manual/scripted grep + group-by, not a built analysis tool.
- Applying the `handoff.ts` 4-step mutating-tool contract (lock →
  freshness → atomic write → refresh snapshot) to this append — deliberately
  NOT used (AC-7); this is observability, not authoritative state.
- Emitting from any tool surface other than `tw_update_state` — verified
  (Dependencies below) that this is the only production site for any
  `GateErrorCode`.
- Any other open backlog ticket (C-series, D1, D2, D4–D8).

## Dependencies / Prerequisites

- No external references (Resource Audit Gate: zero hits — grepped
  `docs/backlog.md` D3 entry and this spec's own sources for
  `http(s)://`/figma/ticket references; none found — pure internal code +
  docs change).
- Depends on the existing `gates/registry.ts` `GATE_REGISTRY` (22 entries)
  and its `gate(code).producer` field — reused, not modified.
  `gates/registry.ts` is documented as a runtime leaf (imports nothing);
  `tools/telemetry.ts` may import `gate`/`GateErrorCode` from it (one
  additional one-directional edge, same shape as `tools/transitions.ts`'s
  existing import) without violating that leaf contract.
- Verified by grep (`gate(gate\("` call sites): the only production sites
  for `GateErrorCode` values are inside `tools/handoff-orchestrator.ts`'s
  `handleUpdateState`. This is why one wrapper suffices for full coverage
  — no architect needed (single new module + one thin wrapper edit, no
  new data model, no cross-cutting API).
- D2 (`docs/backlog.md` D2) is a future, deferred consumer of this same
  emit point; do not implement D2 here (AC-9 / Out of Scope).

## Tasks

- [ ] T-D3-01 [P0] sr-engineer: add `tools/telemetry.ts` (`TelemetryEvent`,
  `emitGateTelemetry`, `extractGateCodeFromText`) per the Mechanism section
  (AC-1, AC-3, AC-4, AC-5, AC-6, AC-7). | depends_on: none
- [ ] T-D3-02 [P0] sr-engineer: wrap `handleUpdateState` in
  `tools/handoff-orchestrator.ts` (rename existing impl to
  `handleUpdateStateCore`, byte-identical body; add the thin exported
  wrapper) per the Mechanism section (AC-1, AC-2, AC-4). Zero changes to
  the frozen gate check-order body. | depends_on: T-D3-01
- [ ] T-D3-03 [P1] sr-engineer: add `docs/gate-retro-procedure.md` (AC-8)
  and, if a natural one-line pointer exists, add it to
  `content/skill-pm.md` or `content/skill-release-engineer.md` — no
  restatement of the mechanism itself. | depends_on: T-D3-02
- [ ] T-D3-04 [P0] code-reviewer: review the diff — confirm this is
  genuinely ONE emit point (no scattered calls inside the frozen gate
  block), confirm the best-effort/no-lock append is intentional (AC-7),
  confirm telemetry failure can never mask/alter the real gate response
  (AC-4), confirm zero behavior change to the 22-gate check order or hint
  text (byte-parity with pre-change `handleUpdateState`).
  | depends_on: T-D3-03
- [ ] T-D3-05 [P0][qa-engineer] Add `test/telemetry.test.mjs`: append
  shape (exactly 5 keys, `gate` = `GATE_REGISTRY` producer lookup),
  null-safety for missing `agent_id`/`active_feature`, no-emit on success,
  swallow-on-throw (mkdir/append failure doesn't alter the returned
  `ToolResult`), and one integration assertion firing a real rejection
  (e.g. `TRANSITION_REJECTED` via `handleUpdateState` with an illegal
  transition) confirming the exact line lands in
  `.current/telemetry.jsonl`. Run full suite green. | depends_on: T-D3-04
- [ ] T-D3-REL [P1] release-engineer (post-PASS): version bump, CHANGELOG
  entry, build, tag, release per skill-release-engineer. | depends_on: T-D3-05
- [ ] T-D3-DONE [P2] pm/coordinator (post-release): mark backlog D3 done
  in `docs/backlog.md` with mechanism summary and commit reference.
  | depends_on: T-D3-REL
