# e10-lease-override — architecture

Blueprint for the two additive feature-lease mechanisms in `specs/e10-lease-override.md`
(AC1–AC9). Both are **file-mode only**, **transient (write-scoped, never persisted
to frontmatter)**, and **additive to the current `gates/feature-lease.ts` shape** —
they do NOT touch E13's terminal-marker disjunct.

Two orthogonal mechanisms, and they never legitimately co-occur:
- **`lease_override`** operates on a **different-feature** write (bypasses a held
  incumbent lease). Consumed at the orchestrator lease-gate only.
- **`bookkeeping_write`** operates on a **same-feature** write (preserves the
  incumbent's `last_updated`). Consumed as a `writeHandoffState` option only.
  (Different-feature + `bookkeeping_write` is hard-rejected — AC6.)

## Affected Files

- `tools/registry.ts` — modify: add `lease_override` and `bookkeeping_write`
  (both `z.boolean().optional()`) to `UpdateStateArgs` zod object AND to the
  hand-written JSON `inputSchema.properties` for `tw_update_state`. `UpdateStateInput`
  (`z.infer`) picks both up automatically. **This is the real "index.ts zod" location**
  — index.ts only wires `TOOL_REGISTRY`; the schema is here (task rows T-E10-02/05
  say "index.ts zod" — retarget to `tools/registry.ts`).
- `gates/lease-override.ts` — **create**: one pure, fs-free, zero-import predicate
  `classifyLeaseOverride()` + exported `LEASE_OVERRIDE_NOTE_RE`. Mirrors
  `gates/cut-approval.ts`'s runtime-leaf shape. The AC6 bookkeeping same-feature
  check is NOT here — it reuses the orchestrator's existing `feature_changed`
  boolean (see Decision DR-4).
- `gates/registry.ts` — modify: add `LEASE_OVERRIDE_AUDIT_MISSING` and
  `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` to the `GateErrorCode` union, two
  `GateDefinition` entries in `GATE_REGISTRY` (both `producer: "orchestrator"`,
  `envelope: "orchestrator-json"`, `documentedInProse: true`), and two rows in
  the errorCode→doc-file mapping comment (both → `const-08-chain-31-mid.md`).
- `tools/handoff-orchestrator.ts` — modify: (a) lease_override bypass + audit-note
  gate INSIDE the existing `FEATURE_LEASE_HELD` block (~line 196); (b) new
  `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` gate immediately after it;
  (c) thread `bookkeepingWrite: parsed.bookkeeping_write` into the
  `storage.writeState({...})` call (~line 909); (d) update the FROZEN check-order
  header comment (lines 9–15).
- `tools/handoff.ts` — modify: add `bookkeepingWrite?: boolean` to
  `WriteHandoffStateOptions`; destructure it in the options-object branch;
  compute `effectiveLastUpdated` (preserve-existing when set, same-feature only);
  set the migration heal-write call site (~line 518) to `bookkeepingWrite: true`
  unconditionally.
- `content/const-08-chain-31-mid.md` — modify (**sr-engineer writes the prose**,
  T-E10-06): two new §3.1 bullets (shape pinned below).
- `test/feature-lease.test.mjs` — **qa-owned deliverable** (T-E10-08): AC1–AC6, AC9
  cases + AC8 constitution-pinning test. Architect/sr write NO tests here.
- `qa_reports/expected-red_e10-lease-override.txt` — **sr-engineer deliverable**
  (T-E10-01, voluntary repro-first per AC7): names the AC4 heal-write red test id.

**NOT touched (deviates from PM task rows — see Decision DR-1):**
`schema/versions.ts`, `schema/migrations-handoff.ts`, `docs/schema-versions.md`,
the `HandoffState` type, and `parseHandoff` — **no schema bump, no migration step,
no parse addition.** Neither field is ever emitted to or read back from frontmatter.

## Data Structures

Two new optional booleans on the `tw_update_state` input (tool boundary only):

```ts
// tools/registry.ts — UpdateStateArgs z.object({... adds:})
lease_override: z.boolean().optional(),     // AC1–AC3, AC9
bookkeeping_write: z.boolean().optional(),  // AC5, AC6, AC9
// UpdateStateInput = z.infer<typeof UpdateStateArgs> gains both.
```

One new option on the file-mode writer:

```ts
// tools/handoff.ts — WriteHandoffStateOptions adds:
// E10 — bookkeeping-write attestation. When true, PRESERVE the existing on-disk
// last_updated (same-active_feature only) instead of stamping now(). NOT emitted
// to frontmatter — it only selects the timestamp. TRANSIENT: never persisted,
// never carried forward. FILE-MODE only: SqliteHandoffStorage.writeState ignores it.
bookkeepingWrite?: boolean;
```

New gate error codes (`gates/registry.ts` `GateErrorCode` union):

```ts
| "LEASE_OVERRIDE_AUDIT_MISSING"            // orchestrator-json
| "BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE" // orchestrator-json
```

**No new persisted frontmatter field, no new `HandoffState` member, no
`schema_version` change.** (DR-1.)

## Interface Contracts

New predicate module `gates/lease-override.ts` (pure, fs-free, zero runtime imports —
the `gates/cut-approval.ts` / `gates/feature-lease.ts` runtime-leaf convention):

```ts
// The audit-note signature the override write must carry as pending_notes[0].
// Mirrors E13's /^Released v/ closing-write marker convention, reused as a
// load-bearing audit line.
export const LEASE_OVERRIDE_NOTE_RE = /^lease-override:/;

// Classifies an incoming write's lease-override intent. Pure structural read of
// the incoming tool args (NOT the parsed prev-state). The orchestrator decides
// bypass vs reject from the result.
//   "absent"    — lease_override !== true; no override attempted (normal path).
//   "audited"   — lease_override === true AND pending_notes[0] matches the RE.
//   "unaudited" — lease_override === true AND pending_notes[0] absent/mismatched.
export function classifyLeaseOverride(
  input: { lease_override?: boolean; pending_notes?: string[] } | null | undefined,
): "absent" | "audited" | "unaudited";
```

`writeHandoffState` timestamp resolution (replaces the unconditional `now` stamp
for `last_updated`; `dispatched_at` retains its own `now()` — DR-6):

```ts
// after the existing-state read block (~line 955), same-feature guard:
let effectiveLastUpdated = now;                       // default: fresh stamp
if (bookkeepingWrite === true &&
    existing && existing.active_feature === _activeFeature && existing.last_updated) {
  effectiveLastUpdated = existing.last_updated;       // preserve incumbent lease clock
}
frontmatterData.last_updated = effectiveLastUpdated;  // overrides the literal at ~849
```

## Sequence Diagram

```mermaid
sequenceDiagram
    actor Client
    participant Orch as handoff-orchestrator
    participant LO as gates/lease-override
    participant Lease as gates/feature-lease
    participant Write as writeHandoffState (file mode)

    Client->>Orch: tw_update_state(active_feature, lease_override?, bookkeeping_write?, pending_notes)
    Orch->>Orch: prevState = storage.parse(); feature_changed
    Note over Orch: validateTransition (unchanged)
    Orch->>Lease: isFeatureLeaseHeld(leaseFields, incoming, now, TTL)
    alt lease held (different feature, fresh, non-terminal)
        alt file mode
            Orch->>LO: classifyLeaseOverride({lease_override, pending_notes})
            alt "audited"
                Note over Orch: BYPASS — fall through, accept
            else "unaudited"
                Orch-->>Client: ⛔ LEASE_OVERRIDE_AUDIT_MISSING
            else "absent"
                Orch-->>Client: ⛔ FEATURE_LEASE_HELD (existing)
            end
        else SQLite/HTTP mode
            Orch-->>Client: ⛔ FEATURE_LEASE_HELD (lease_override ignored — AC9)
        end
    end
    alt file mode AND bookkeeping_write AND prevState AND feature_changed
        Orch-->>Client: ⛔ BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE (AC6)
    end
    Note over Orch: scope/cut/external-refs/... gates (unchanged)
    Orch->>Write: storage.writeState({..., bookkeepingWrite: bookkeeping_write})
    alt bookkeeping_write AND existing.active_feature === active_feature
        Write->>Write: last_updated = existing.last_updated (preserve — AC5)
    else
        Write->>Write: last_updated = now() (default)
    end
    Write-->>Orch: written
    Orch-->>Client: ok
```

Migration heal-write (AC4) is the same `writeHandoffState` path with
`bookkeepingWrite: true` hard-wired — no Client, no orchestrator, always same-feature.

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| **DR-1** Schema bump (cut decision #4, delegated to architect). PM's read expected v12→v13 per the dispatch_pins/v8, dispatch_mode/v11 precedent. | **NO bump. Stay at `handoff: 12`.** Neither field is ever emitted to frontmatter: `lease_override` is consumed only from the incoming tool args at the orchestrator; `bookkeeping_write` is consumed only as a `writeHandoffState` option selecting `last_updated`. The on-disk frontmatter shape is byte-identical pre/post-E10. | The cited precedent does NOT apply — dispatch_pins/dispatch_mode (and even the "transient" v7 fields next_role/resume_of/review_verdict) ARE emitted to frontmatter when set, which is *why* they bumped. These two never touch disk, so `peekVersion` never diverges and no old/new-server compat gap exists. A stamp-only v13 step would force every existing v12 file through a no-op heal on next read for zero on-disk change — cost without benefit. **Collapses T-E10-02**: no schema/versions.ts, no migrations-handoff.ts, no docs/schema-versions.md, no HandoffState/parse additions. |
| **DR-2** New predicate module vs extending an existing gate. | **New `gates/lease-override.ts`** with a single pure `classifyLeaseOverride()` + `LEASE_OVERRIDE_NOTE_RE`. | Matches the one-concern-per-file `gates/*.ts` convention (cut-approval, scope-decision, feature-lease). Keeps `gates/feature-lease.ts`'s pure boolean predicate untouched — no E13 regression risk. Testable without a workspace. |
| **DR-3** Audit-note gate scope: reject unaudited override always, or only when the lease is actually held? | **Only when the lease is held** (the gate lives INSIDE the `FEATURE_LEASE_HELD` branch). An override with nothing to bypass is an inert no-op regardless of note. | Matches every AC2 proof (which constructs a lease-held state). Alternative (reject `lease_override:true` unconditionally) is stricter but rejects harmless mis-attestations where no bypass was needed; rejected for minimal surface. `LEASE_OVERRIDE_AUDIT_MISSING` therefore fires iff lease-held ∧ file-mode ∧ `lease_override:true` ∧ note mismatched. |
| **DR-4** Where the AC6 same-feature restriction lives. | **Inline in the orchestrator**, reusing the already-computed `feature_changed` boolean (line 117–119), guarded by `prevState &&` so a fresh workspace never trips it. No predicate module. | Zero new abstraction for a one-line comparison the orchestrator already has. Fresh-workspace `bookkeeping_write` is inert (writeHandoffState's same-feature guard falls through to `now()`), not rejected. |
| **DR-5** Defense-in-depth in `writeHandoffState`. | The preserve branch **also** guards `existing.active_feature === _activeFeature`. | Even if a different-feature `bookkeeping_write` bypassed the orchestrator gate (it can't via the normal path, but the heal-write is a direct caller), the writer never suppresses a differing-feature timestamp — the exact pre-aged-clobber footgun AC6 closes, made safe-by-construction at the write layer too. |
| **DR-6** `bookkeeping_write` and `dispatched_at`. | Preserve `last_updated` only; leave `dispatched_at = now` on its existing `if (nextRole)` predicate. | The lease clock is `last_updated`; `dispatched_at` feeds D5 stale-dispatch, a separate concern. A bookkeeping write is non-substantive and should not carry `next_role` (no forward dispatch) — the heal-write drops it (transient), so `dispatched_at` isn't emitted there. If a role-authored bookkeeping write also dispatches, `dispatched_at`≠`last_updated` — acceptable, advisory only, not gated. |
| **DR-7** AC9 SQLite scoping. | `lease_override` bypass/audit gates run **only under `storage instanceof FileHandoffStorage`**; SQLite mode ignores `lease_override` (normal `FEATURE_LEASE_HELD` reject stands). `bookkeepingWrite` is passed to `storage.writeState` unconditionally but `SqliteHandoffStorage.writeState` never reads it (stamps its own `now`, line ~542) — timestamp behavior byte-for-byte unchanged. | Mirrors E13/cut_approved/external_refs file-mode asymmetry. Extending either mechanism to SQLite is a future ticket's explicit decision. |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites shows zero ignored/deferred refs
(zero external URLs/Figma/tickets; `external_refs` correctly omitted upstream)._

## Open Questions

None.

---

## Implementation notes (non-schema; for sr-engineer)

### Orchestrator: lease block (~line 182–226)
Replace the single `if (leaseFields && isFeatureLeaseHeld(...))` reject with:

1. Compute `leaseHeld = isFeatureLeaseHeld(...)` (unchanged inputs).
2. If `leaseHeld`:
   - `const fileMode = storage instanceof FileHandoffStorage;`
   - `const cls = classifyLeaseOverride(parsed);` // {lease_override, pending_notes}
   - `if (fileMode && cls === "audited")` → **do not return** (fall through — bypass).
   - `else if (fileMode && cls === "unaudited")` → return `LEASE_OVERRIDE_AUDIT_MISSING`
     orchestrator-json envelope (`{ error, attempted_feature, incumbent, hint }`,
     `hint = gate("LEASE_OVERRIDE_AUDIT_MISSING").hintStatic`).
   - `else` → return the existing `FEATURE_LEASE_HELD` envelope unchanged.

### Orchestrator: AC6 gate (immediately after the lease block)
```
if (storage instanceof FileHandoffStorage &&
    parsed.bookkeeping_write === true &&
    prevState && feature_changed) {
  return BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE orchestrator-json envelope;
}
```

### Orchestrator: check-order comment (lines 9–15, FROZEN — must update)
Insert after "feature-lease gate (E1)": `→ lease-override bypass/audit (E10) →
bookkeeping-write feature-change gate (E10)`.

### `gates/registry.ts` entries (both `documentedInProse: true`)
- `LEASE_OVERRIDE_AUDIT_MISSING` — triggerEdge: "any write while FEATURE_LEASE_HELD
  would fire, carrying lease_override:true (file-mode only)"; armCondition:
  "classifyLeaseOverride === unaudited; FileHandoffStorage only"; clearingArtifact:
  "pending_notes[0] matching /^lease-override:/"; hintStatic: a sentence directing
  the writer to prepend a `lease-override: <reason>` audit note.
- `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` — triggerEdge: "bookkeeping_write:true
  whose active_feature differs from the incumbent's (file-mode only)"; armCondition:
  "bookkeeping_write===true && prevState && feature_changed; FileHandoffStorage only";
  clearingArtifact: "same-active_feature write, or drop bookkeeping_write";
  hintStatic: a sentence explaining bookkeeping_write is same-feature only (pre-aged
  clobber prevention).
- Add both to the errorCode→doc-file mapping comment (~line 85–112): both →
  `const-08-chain-31-mid.md`.

### `tools/handoff.ts` writeHandoffState
- Hoist the `existing` local out of the `if (...needsExisting)` block (currently a
  const inside) so the timestamp branch can read it, and add `|| bookkeepingWrite === true`
  to that block's trigger condition (we need `existing.last_updated`).
- Destructure `bookkeepingWrite = o.bookkeepingWrite` in the options-object branch;
  positional overload leaves it `undefined` (heal-write uses the options object).
- Migration heal-write (~line 518): add `bookkeepingWrite: true` to the options
  object — server-internal, unconditional, no attestation (AC4). Always same-feature,
  so the same-feature guard always preserves.

### `content/const-08-chain-31-mid.md` — two new §3.1 bullets (sr-engineer prose, T-E10-06)
Placement: insert as new bullets **immediately after the Cut-Approval Gate bullet**
(current bullet 2), before the Amend-Resume Edge bullet.
- **(a) Lease-Override**: structure mirrors the Cut-Approval Gate bullet's
  sanctioned-writer / coordinator-attested trust rule (same-context = acting role;
  Task-subagent = coordinator on the stranded role's tuple; never inferred from a
  summary). State the differences from cut-approval: (i) **any edge** where
  `FEATURE_LEASE_HELD` can fire, not the build-entry pin; (ii) a **stricter audit
  requirement** — `pending_notes[0]` must match `/^lease-override:/` or the write is
  rejected `LEASE_OVERRIDE_AUDIT_MISSING`; (iii) **transient/write-scoped** (not
  persisted, not feature-scoped). File-mode only. Cross-reference
  `gates/feature-lease.ts`'s E1/E1A/E13 header lineage rather than restating it.
- **(b) Bookkeeping-Write**: timestamp-preservation semantics (preserves incumbent
  `last_updated` instead of stamping `now`), the **same-`active_feature` restriction**
  (`BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` on a differing-feature combination),
  and that the `readHandoffState` migration heal-write is its **hard-wired
  unconditional equivalent** (server-internal, no attestation). File-mode only.
- Skill pointers (`skill-pm.md` / `skill-coordinator.md`): **not warranted** —
  follow the `resume_of` precedent (full mechanism stays in the constitution; no SOP
  restatement). Judged unnecessary for this ticket.

### Per-task budget (≤5 files / ≤300 lines)
| task | files | est. lines | budget |
|---|---|---|---|
| T-E10-01 (repro red) | 1–2 (test + expected-red txt) | ~40 | ok |
| T-E10-02 (**revised** — see DR-1) | **0 schema files**; now empty or fold into T-E10-03 | ~0 | **shrinks** — no schema bump |
| T-E10-03 (writeHandoffState preserve + heal opt-in) | 1 (handoff.ts) | ~30 | ok |
| T-E10-04 (gates/lease-override.ts + registry.ts) | 2 | ~75 | ok |
| T-E10-05 (registry.ts zod + orchestrator wiring) | 2 | ~70 | ok |
| T-E10-06 (const-08 two bullets) | 1 | ~6 | ok |
| T-E10-08 (qa tests) | 1 (feature-lease.test.mjs) | ~200 | ok (qa-owned) |

No task busts its budget. T-E10-02 **shrinks to near-empty** under DR-1 — recommend
folding its non-schema remnant (there is none — HandoffState/parse additions are also
dropped) so T-E10-02 becomes a no-op / can be closed as "N/A per architecture DR-1".
