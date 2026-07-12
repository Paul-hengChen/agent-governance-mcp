# e8-success-telemetry — architecture

Contract: `specs/e8-success-telemetry.md` (cut-approved). Baseline: `main` @ v3.73.1,
handoff schema v11. This blueprint is implemented verbatim by T-E8-01..05; the
file-by-file ticket boundaries are in "Ticket Boundaries" below.

## Affected Files

- `tools/transitions.ts` — modify `computeNewRound`: 3 new prev-total params + 3 new
  return fields (T-E8-01).
- `schema/migrations-handoff.ts` — add v11→v12 seed-0 migration step (T-E8-01).
- `schema/versions.ts` — bump `CURRENT_VERSIONS.handoff` 11 → 12 (T-E8-01).
- `docs/schema-versions.md` — add v12 version-history row (T-E8-01).
- `tools/handoff.ts` — parse/serialize the 3 totals in `HandoffState` +
  `WriteHandoffStateOptions` (mirror `hop_count` exactly, file mode only) (T-E8-02).
- `tools/handoff-orchestrator.ts` — thread prev totals → `computeNewRound` → `writeState`
  (T-E8-02); add the best-effort emit call at the terminal marker (T-E8-03).
- `tools/metrics.ts` — NEW module: `emitFeatureMetrics()` + `deriveTicketCode()` (T-E8-03).
- `scripts/summarize-metrics.mjs` — NEW zero-dep CLI summarizer (T-E8-04).
- `docs/gate-retro-procedure.md` — append a `## Success-metrics summary` pointer (T-E8-04).
- `content/skill-release-engineer.md` — one informational SOP note near step 11/12 (T-E8-05).
- `tools/storage-sqlite.ts` — **NOT touched** (see DR-1: totals are file-mode-only).

## Data Structures

### Handoff v12 — three cumulative counters (`tools/handoff.ts`)

Add to `HandoffState` (always-present, like `hop_count` — never optional):

```ts
qa_rounds_total: number;      // cumulative QA FAILs for the feature; resets ONLY on feature change
review_rounds_total: number;  // cumulative code-reviewer CHANGES_REQUESTED; same reset rule
visual_rounds_total: number;  // cumulative visual FAILs; same reset rule
```

Parse (mirror the `hop_count` block, handoff.ts:398-400): `Number(frontmatter.qa_rounds_total)`,
`Number.isFinite && >= 0 ? Math.floor : 0`; add to the always-emitted state object (handoff.ts:421-424).
Serialize: always emit (even 0) via `frontmatterData.qa_rounds_total = normalised…` (mirror hop_count,
handoff.ts:956-960). Add the 3 to `WriteHandoffStateOptions` (mirror `hopCount?`, handoff.ts:598).

**Reset rule (AC8) = `hop_count`'s rule byte-for-byte:** base is `feature_changed ? 0 : prev_total`;
NOT reset on QA PASS, NOT on `(pm, In_Progress)` re-entry — unlike the per-cycle `qa_round`/
`review_round`/`visual_round`, which reset on both.

### Metrics record (`tools/metrics.ts`) — one JSON line per shipped feature

```ts
export interface FeatureMetricRecord {
  ts: string;               // ISO-8601 emit time == the release-close moment (see DR-4)
  feature: string;
  tickets: number;
  qa_rounds: number;        // from prevState.qa_rounds_total
  review_rounds: number;    // from prevState.review_rounds_total
  visual_rounds: number;    // from prevState.visual_rounds_total
  hops: number;             // from prevState.hop_count (AC5 — no new field)
  one_pass: boolean;        // qa_rounds===0 && review_rounds===0 && visual_rounds===0 (AC3)
  released_version: string | null; // package.json version at emit time, null if unreadable (AC7)
}
```

## Interface Contracts

### `computeNewRound` (extended — `tools/transitions.ts`)

```ts
export function computeNewRound(
  prev_qa_round: number, prev_review_round: number, prev_visual_round: number,
  next: TransitionTuple, prev?: TransitionTuple,
  next_pending_notes?: ReadonlyArray<string>,
  prev_hop_count = 0, feature_changed = false,
  prev_qa_rounds_total = 0, prev_review_rounds_total = 0, prev_visual_rounds_total = 0, // NEW (defaulted)
): { qa_round; review_round; visual_round; hop_count;
     qa_rounds_total; review_rounds_total; visual_rounds_total };  // NEW return fields
```

New params are trailing + defaulted (the exact pattern `prev_hop_count`/`feature_changed` used), so
the existing orchestrator call still compiles between T-E8-01 and T-E8-02. Increment logic — each total
ticks in lock-step with its per-cycle counter's FAIL branch, but never resets except on feature change:

```ts
const qaTotBase = feature_changed ? 0 : prev_qa_rounds_total;
const qa_rounds_total = (next.agent === "qa-engineer" && next.status === "FAIL") ? qaTotBase + 1 : qaTotBase;
const revTotBase = feature_changed ? 0 : prev_review_rounds_total;
const review_rounds_total = (next.agent === "code-reviewer" && next.status === "FAIL") ? revTotBase + 1 : revTotBase;
const visTotBase = feature_changed ? 0 : prev_visual_rounds_total;
const visual_rounds_total = (next.agent === "qa-engineer" && next.status === "FAIL" && hasVisualFailToken)
  ? visTotBase + 1 : visTotBase;
```

Reuse the existing `hasVisualFailToken` local. The FAIL predicates are copied verbatim from the
per-cycle counters (transitions.ts:499/503/521) so total and cycle counters can never diverge on which
event counts.

### Orchestrator threading (`tools/handoff-orchestrator.ts`, T-E8-02)

- Read prev totals after prevState (near line 97-99):
  `const prev_qa_rounds_total = prevState?.qa_rounds_total ?? 0;` (× 3).
- Pass the 3 new args into the `computeNewRound(...)` call (line 741-750).
- Destructure the 3 new return fields; pass them into `storage.writeState({...})` (line 793-831) as
  `qaRoundsTotal` / `reviewRoundsTotal` / `visualRoundsTotal`.

### Emit hook (`tools/handoff-orchestrator.ts`, T-E8-03)

Placed AFTER `storage.writeState` and the PASS RAG-GC block, immediately before the final `return`
(line ~852). Reads the feature's accumulated totals from `prevState` (the closing write is a
release-engineer self-loop → `computeNewRound` carries totals unchanged, so prevState is authoritative):

```ts
if (storage instanceof FileHandoffStorage &&
    parsed.agent_id === "release-engineer" &&
    parsed.status === "In_Progress" &&
    parsed.next_role === "pm") {                       // E1A terminal marker (gates/feature-lease.ts)
  emitFeatureMetrics({
    workspacePath: parsed.workspace_path, feature: parsed.active_feature,
    qaRoundsTotal: prevState?.qa_rounds_total ?? 0,
    reviewRoundsTotal: prevState?.review_rounds_total ?? 0,
    visualRoundsTotal: prevState?.visual_rounds_total ?? 0,
    hops: prevState?.hop_count ?? 0,
  });                                                  // never throws (AC2)
}
```

### `tools/metrics.ts` (new)

```ts
export function deriveTicketCode(feature: string): string;  // feature.split("-")[0].toUpperCase() (AC4)
export function emitFeatureMetrics(args: {
  workspacePath: string; feature: string;
  qaRoundsTotal: number; reviewRoundsTotal: number; visualRoundsTotal: number; hops: number;
}): void;                                                    // best-effort, wraps entire body in try/catch, never throws
```

`emitFeatureMetrics` internally: `code = deriveTicketCode(feature)`; `tickets` = count of lines matching
`^\s*-\s*\[x\]\s*T-<code>-` in `<workspacePath>/tasks.md` (read fresh; matches release-engineer SOP step
7a's shell grep, expressed here as the single code-level definition of the `<CODE>` convention);
`released_version` = `JSON.parse(fs.readFileSync(<workspacePath>/package.json)).version ?? null`;
`one_pass` = all three totals `=== 0`; append `JSON.stringify(record) + "\n"` to
`<workspacePath>/.current/metrics.jsonl`. Entire body in one `try { … } catch { /* swallow */ }` —
the D3 `emitGateTelemetry` discipline verbatim (tools/telemetry.ts:43-68).

### `scripts/summarize-metrics.mjs` (new, zero-dep)

`node scripts/summarize-metrics.mjs [path-to-metrics.jsonl]` (default `.current/metrics.jsonl`). Reads
file, `JSON.parse` per non-blank line (skip malformed lines, never throw), then prints via
`console.table`: (1) per-feature rows `{feature, tickets, qa_rounds, review_rounds, visual_rounds, hops,
one_pass}`; (2) an aggregate line — one-pass rate `= onePassCount / total`, and mean qa/review/visual
rounds + mean hops across all records. Pure Node stdlib (`fs`), ESM. Exit 0 on empty/missing file with a
"no metrics yet" notice.

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| SQLite parity for the 3 totals (PM left open, recommended "yes") | **Override to file-mode-only.** No `storage-sqlite.ts` change; sqlite schema stays v2. | Their sole consumer — the emit — fires only under `FileHandoffStorage` because it keys on `next_role`, which `SqliteHandoffStorage` never persists (gates/feature-lease.ts E1A asymmetry). SQLite columns would be provably-unread dead data. Follows the DR-5 file-mode-only precedent (`cut_approved`/`external_refs`/`dispatch_pins`/`dispatch_mode`), NOT hop_count (which IS read back by a gate in both modes). |
| Where totals increment | In `computeNewRound` (transitions.ts), alongside the per-cycle counters | Single site owns "which event counts"; totals cannot drift from cycle counters. transitions.ts stays pure/fs-free. |
| Migration shape v11→v12 | **Seed 0** (the hop_count v8→v9 precedent), not stamp-only | A 0 count is the true pre-feature value, not a fabricated attestation; satisfies AC8 (stale rows migrate in with all three = 0). |
| Migration-heal write-back preserving totals | Thread the 3 totals through the `readHandoffState` heal write (handoff.ts:477-497) | Same gap the v9 hop_count 12th-arg fix closed: without it a future v12→v13 heal would stamp v12 but drop real accumulated totals. For v11→v12 itself the seed is 0 so it is harmless, but wire it for forward-safety. Recommend converting that one heal call site to the options-object overload rather than adding 3 more positional params. |
| `tickets` / `<CODE>` derivation | `deriveTicketCode()` in metrics.ts is the single code-level definition; release-engineer SOP step 7a prose is its human mirror | AC4 — one convention, cannot drift. Reads default `tasks.md` at workspace root (matches the SOP's grep; config `taskPaths` intentionally not consulted — the SOP grep does not either). |
| `released_at` (brief) vs `ts` (AC1) | Single `ts` field; it IS the release-close timestamp (emit fires at the terminal marker) | Avoids a redundant duplicate field; `ts` mirrors telemetry.ts's field name. |
| Emit read source | `prevState` accumulated totals, not the just-computed return | The closing write is a release-engineer self-loop → computeNewRound carries totals unchanged, so prevState === new totals; prevState is already in scope and unambiguous. |
| metrics.jsonl / metrics.ts vs telemetry | Fully separate file + module (AC6) | Disjoint key sets, writers, lifecycles — the D2 usage.jsonl / D3 telemetry.jsonl stream-separation precedent. |

## Ticket Boundaries (file-by-file; each ≤5 files / ≤300 lines)

- **T-E8-01** (schema/counter layer): `tools/transitions.ts` (computeNewRound), `schema/migrations-handoff.ts`
  (v11→v12), `schema/versions.ts` (bump to 12), `docs/schema-versions.md` (v12 row). 4 files. Builds green:
  the extra return field is ignored by the existing orchestrator destructure; new params are defaulted.
- **T-E8-02** (persist + accumulate): `tools/handoff.ts` (parse/serialize/interface/options + heal-write
  threading), `tools/handoff-orchestrator.ts` (prev-total read → computeNewRound args → writeState args).
  2 files. **Adjustment vs the tasks.md cut:** drops `storage-sqlite.ts` (DR-1), adds the orchestrator
  threading here. After this ticket the counter fully accumulates in file mode.
- **T-E8-03** (emit): `tools/metrics.ts` (new), `tools/handoff-orchestrator.ts` (terminal-marker emit call).
  2 files. Touches the orchestrator again, serially after T-E8-02 (dep chain — no parallel conflict).
- **T-E8-04** (summarize): `scripts/summarize-metrics.mjs` (new), `docs/gate-retro-procedure.md` (pointer). 2 files.
- **T-E8-05** (SOP note): `content/skill-release-engineer.md` only. 1 file.

## Deferred Resources

_None — the spec's Dependencies / Prerequisites shows zero ignored/deferred refs (Resource Audit was a no-op)._

## Open Questions

None.
