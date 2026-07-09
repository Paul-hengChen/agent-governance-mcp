# b8-external-ref-ledger — architecture

> Blueprint for `specs/b8-external-ref-ledger.md` (v1.0). Authored by @architect.
> Zero implementation bodies below — types, signatures, and placement contracts only.
> Feature: per-spec external-reference ledger (`external_refs`) + `EXTERNAL_REFS_UNRESOLVED`
> build-entry gate. Mirrors the proven `scope_decision` / `cut_approved` precedent throughout.

## Affected Files

| file | action | task | what changes |
|---|---|---|---|
| `gates/registry.ts` | modify | B8-02 | add `EXTERNAL_REFS_UNRESOLVED` to `GateErrorCode` union + a 19th `GATE_REGISTRY` entry; bump "18-gate" prose to "19-gate". |
| `gates/external-refs.ts` | **create** | B8-03 | pure predicates `hasUnresolvedRefs()` / `listUnresolvedRefs()` over prev handoff state. |
| `schema/versions.ts` | modify | B8-04 | `CURRENT_VERSIONS.handoff` 5 → 6. |
| `schema/migrations-handoff.ts` | modify | B8-04 | register pure v5→v6 stamp-only migration. |
| `tools/handoff.ts` | modify | B8-05 | `ExternalRef` type + `HandoffState.external_refs`; parse/serialize; `WriteHandoffStateOptions.externalRefs`; preserve/reset block; widen `frontmatterData` value type. |
| `tools/registry.ts` | modify | B8-06 | `external_refs` zod schema on `UpdateStateArgs` + tool JSON descriptor text. |
| `tools/handoff-orchestrator.ts` | modify | B8-07 | wire the gate check + pass `externalRefs` through to `storage.writeState`. |
| `tools/storage.ts` | modify | B8-07 (implied) | add `externalRefs?` to `WriteHandoffStateOptions` consumers — see DR-7. |
| `tools/transitions.ts` | modify | B8-08 | add `EXTERNAL_REFS_UNRESOLVED` to `TransitionRejection["error"]` union + doc-comment. |
| `content/const-15-core-tail.md` | modify | B8-09 | §7 wording (AC-10) — content, no architect sign-off on prose. |
| `content/skill-pm.md` | modify | B8-10 | Resource Audit Gate row (AC-11) — content. |
| `content/skill-coordinator.md` | modify | B8-10 | Auto-Routing stop-condition (AC-12) — content. |
| `test/*.test.mjs` (4 files) | modify | B8-QA | extend existing analog suites — no parallel test surface. |

## Data Structures

### `ExternalRefState` — closed enum (AC-9)

```ts
// tools/handoff.ts
export type ExternalRefState =
  | "fetched"
  | "indexed"
  | "user-confirmed-ignorable"
  | "unresolved";
```

The four values are verbatim from spec S03. `unresolved` is the ONLY blocking state.

### `ExternalRef` — one ledger entry

```ts
// tools/handoff.ts
export interface ExternalRef {
  ref: string;            // free-text identifier (URL / design-file / ticket id). NOT validated for reachability (spec Out of Scope).
  state: ExternalRefState;
}
```

### `HandoffState.external_refs` — the ledger field

```ts
// tools/handoff.ts — added to interface HandoffState
  // External-reference ledger (handoff schema v6, b8-external-ref-ledger).
  // Populated by the PM during the Resource Audit Gate: one entry per external
  // artifact the spec references, each classified fetched/indexed/
  // user-confirmed-ignorable/unresolved. Backs the EXTERNAL_REFS_UNRESOLVED
  // build-entry gate. ABSENT by default — undefined === "PM found zero external
  // references" === gate CLEARS (inverse polarity to cut_approved, where absence
  // BLOCKS; see DR-3). FEATURE-SCOPED preserve: carried forward across same-
  // feature writes that omit it, dropped on any active_feature change. NOT
  // re-armed on PM re-entry (DR-4). FILE-MODE ONLY: never round-trips in SQLite.
  external_refs?: ExternalRef[];
```

### YAML frontmatter shape (AC-6)

js-yaml `dump` with the existing `{ lineWidth: -1, forceQuotes: true, quotingType: '"' }` options serializes an array-of-object as a block sequence; `load` round-trips it losslessly. Verified shape:

```yaml
external_refs:
  - ref: "https://figma.com/file/abc"
    state: "unresolved"
  - ref: "JIRA-4021"
    state: "indexed"
```

This is the FIRST array-of-object handoff field (`completed_tasks` / `pending_notes` are array-of-string, and those are rendered in the markdown body, not the frontmatter — `external_refs` lives in frontmatter). See DR-1 for the round-trip decision and DR-5 for the `frontmatterData` type widening it forces.

## Interface Contracts

### `gates/external-refs.ts` (B8-03) — pure, fs-free, never throws

Mirrors `gates/cut-approval.ts`: takes the already-parsed PREV state, returns booleans/derived data only, imports nothing at runtime.

```ts
// Returns true iff the prev state carries >=1 entry with state === "unresolved".
export function hasUnresolvedRefs(
  handoffState: { external_refs?: { ref: string; state: string }[] } | null | undefined,
): boolean;

// Returns the ordered list of `ref` values whose state === "unresolved"
// (for hint interpolation). Empty array when none / field absent.
export function listUnresolvedRefs(
  handoffState: { external_refs?: { ref: string; state: string }[] } | null | undefined,
): string[];
```

Contract details:
- Absence / empty array / all-resolved → `hasUnresolvedRefs === false`, `listUnresolvedRefs === []` (AC-2).
- Loose param type (`state: string`, not `ExternalRefState`) — matches `hasCutApproval`'s defensive `{ cut_approved?: boolean }` shape so the predicate never couples to the enum and never throws on a hand-edited handoff.
- `listUnresolvedRefs` preserves input order so the hint enumerates refs deterministically.
- No registry import (returns data only; the hint is composed at the orchestrator emit site — mirrors both existing predicates).

### `gates/registry.ts` (B8-02) — 19th catalog entry

Add `"EXTERNAL_REFS_UNRESOLVED"` to the `GateErrorCode` union (after `CUT_APPROVAL_REQUIRED`, keeping doc order = evaluation order for the orchestrator-json block). New `GATE_REGISTRY` entry:

```ts
{
  errorCode: "EXTERNAL_REFS_UNRESOLVED",
  producer: "orchestrator",
  envelope: "orchestrator-json",
  triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress (file-mode only)",
  armCondition: "unconditional; FileHandoffStorage only; fires iff >=1 external_refs entry state==unresolved",
  clearingArtifact: "every external_refs entry fetched/indexed/user-confirmed-ignorable, or field absent/empty",
  hintStatic:
    " Each entry in external_refs must be fetched, indexed, or user-confirmed-ignorable " +
    "before routing to build. See content/skill-pm.md §Resource Audit Gate and " +
    "specs/b8-external-ref-ledger.md.",
  documentedInProse: true,
},
```

**`hintStatic` split contract (byte-parity, DR-6):** the emitted hint (spec S02) is
`"External reference(s) unresolved: {refs}." + hintStatic`, where `{refs}` = comma-joined
`listUnresolvedRefs(prevState)`. The dynamic prefix (`External reference(s) unresolved: <refs>.`)
is built at the emit site; `hintStatic` holds the fixed suffix beginning with a single leading
space (same concatenation style as `QA_ROUND_EXCEEDED` / `TRANSITION_REJECTED`, which prepend a
leading space to `hintStatic`). sr-engineer MUST assemble S02 exactly:
`` `External reference(s) unresolved: ${refs}.` + gate("EXTERNAL_REFS_UNRESOLVED").hintStatic ``.
Update the two "18-gate" / "All 18 are true today" comments to 19. `ALL_GATE_CODES` and
`TRANSITION_GATE_CODES` need no manual edit — the former derives from `GATE_REGISTRY`, the
latter lists only the 5 `validateTransition` codes (this gate is orchestrator-produced).

### `tools/transitions.ts` (B8-08) — union doc-comment only

Add to `TransitionRejection["error"]` (place after `CUT_APPROVAL_REQUIRED`, before `AGENT_ID_REQUIRED`):

```ts
    | "EXTERNAL_REFS_UNRESOLVED"    // v6 — emitted by the handoff-orchestrator gate at the
                                    // pm → {architect,sr-engineer}:In_Progress edge when the prev
                                    // handoff state carries >=1 external_refs entry with
                                    // state === "unresolved". Unconditional (not arm-gated);
                                    // file-storage mode only. NOT produced by validateTransition
                                    // (it reads handoff state + storage kind); union extension is
                                    // for handler-side narrowing + envelope consistency (mirrors
                                    // CUT_APPROVAL_REQUIRED).
```

**Decision (spec Dependency #2 → resolved YES):** the union member IS required even though the
code is handler-side-only, for the same three reasons `CUT_APPROVAL_REQUIRED` and
`SCOPE_DECISION_REQUIRED` carry theirs: (a) envelope-consistency narrowing at the emit site;
(b) the `union ⊆ ALL_GATE_CODES` test invariant (gate-registry DR-8) — adding the registry entry
without the union member would break that assertion; (c) keeping the human-readable catalog in
`transitions.ts` complete. It is NOT added to `TRANSITION_GATE_CODES` (that set is the 5
`validateTransition`-emitted codes only).

### `tools/registry.ts` (B8-06) — zod schema + descriptor

Add to `UpdateStateArgs.object({...})`, after `cut_approved`:

```ts
    // v6 — external-reference ledger (b8-external-ref-ledger). PM records one
    // entry per external artifact its spec references during the Resource Audit
    // Gate. Passing the field REPLACES the whole array (wholesale, like
    // completed_tasks — never merged). Closed state enum (AC-9): an out-of-enum
    // state is rejected by zod before the gate runs, no server error code.
    external_refs: z
      .array(
        z.object({
          ref: z.string().min(1).max(1000),
          state: z.enum(["fetched", "indexed", "user-confirmed-ignorable", "unresolved"]),
        }),
      )
      .max(200)
      .optional(),
```

Tool JSON descriptor (added to the `inputSchema.properties` object alongside `cut_approved`):

> `external_refs`: "External-reference ledger (file-mode only). Array of `{ref, state}` entries; `state` ∈ {fetched, indexed, user-confirmed-ignorable, unresolved}. PM populates this during the Resource Audit Gate — one entry per external artifact the spec references. Passing it REPLACES the array wholesale (not merged). Any entry left `unresolved` blocks the pm:In_Progress → {architect,sr-engineer}:In_Progress build-entry hop (EXTERNAL_REFS_UNRESOLVED). Absence/empty = zero external refs found = non-blocking. Feature-scoped: preserved across same-feature writes, dropped on active_feature change."

No new top-level `.refine` is needed (the closed enum + shape are enforced by the object schema; AC-9's "rejected before the gate" is satisfied by zod object validation, matching how `scope_decision`'s enum works).

### `tools/handoff.ts` (B8-05) — type widening, parse, serialize, options

1. **`WriteHandoffStateOptions`** — add:
   ```ts
     // v6 — external-reference ledger (b8-external-ref-ledger). REPLACE semantics
     // when provided; feature-scoped preserve-if-omitted (see writeHandoffState).
     externalRefs?: ExternalRef[];
   ```
2. **Options-overload destructure** (~line 397) — add `externalRefs = o.externalRefs;` and a
   `let externalRefs: ExternalRef[] | undefined;` local. Positional overload leaves it undefined
   (positional callers — including the migration-heal write — never pass it; preserve logic
   below carries it forward, DR-8).
3. **Parse** (in `readAndMigrate`, alongside `scopeDecision` / `cutApproved`):
   ```ts
   const externalRefs = parseExternalRefs(frontmatter.external_refs); // undefined when absent/malformed
   ```
   with a small pure helper (no throw — a malformed entry is dropped, matching the parser's
   defensive `asString` posture):
   ```ts
   function parseExternalRefs(raw: unknown): ExternalRef[] | undefined {
     // returns undefined when raw is not a non-empty array of {ref:string, state:<known enum>}
     // objects; filters out malformed entries; never throws.
   }
   ```
   Add to the `state` spread: `...(externalRefs && { external_refs: externalRefs })` (absent when undefined — so `undefined` flows to the gate, keeping absence = non-blocking).
4. **Serialize / preserve** — see the algorithm below.

### `tools/storage.ts` (DR-7)

`FileHandoffStorage.writeState` and `SqliteHandoffStorage.writeState` both forward the
options object to `writeHandoffState`. Because they spread/forward the whole opts object,
adding `externalRefs?` to `WriteHandoffStateOptions` is sufficient — no positional-overload
signature change. In SQLite mode the field is accepted and silently ignored (no column;
AC-5). Confirm the forward path passes the full opts object (it does today for
`scopeDecision`/`cutApproved`).

## Preserve / Reset Semantics (AC-6, AC-3) — the load-bearing decision

`external_refs` uses **feature-scoped preserve** but **NOT** cut_approved's PM-re-entry re-arm.
This is the single most error-prone part of the feature (spec AC-2 explicitly warns against
copying `cut_approved` by analogy with the wrong polarity). The algorithm slots into the
EXISTING consolidated preserve block in `writeHandoffState` (~lines 439-492), extending —
never reordering — it:

```
effectiveExternalRefs resolution (evaluated in this order):
  1. option externalRefs !== undefined            → use it verbatim (REPLACE, incl. empty [])
  2. omitted AND existing.active_feature === this  → carry existing.external_refs forward
  3. omitted AND active_feature changed            → undefined (drop stale ledger)
```

Emit guard (mirrors `cut_approved`'s "only emit when meaningful"):
`if (effectiveExternalRefs && effectiveExternalRefs.length > 0) frontmatterData.external_refs = effectiveExternalRefs;`
— an empty array is NOT serialized (empty === absence === non-blocking; keeps the file clean
and the two states behaviorally identical per AC-2).

**Why NO PM-re-entry re-arm (contrast with cut_approved):** `cut_approved` re-arms to
`undefined` on every `pm:In_Progress` re-entry *because absence BLOCKS it* — re-arming forces
re-approval after a QA-FAIL bounce. `external_refs` has **inverse polarity**: absence CLEARS.
Re-arming it on PM re-entry would silently DISCARD a valid ledger and *un-block* the gate — the
opposite of safe. So the reset clause keys on `active_feature` change ONLY. This also satisfies
AC-3 at the field level: a resume/re-entry within the same feature preserves the ledger the
earlier PM write populated, and the gate's prev=pm pinning (below) ensures it is never
*re-evaluated* on a non-pm predecessor edge anyway.

Reuse the SINGLE existing-state read already performed for prd_path/scope_decision/cut_approved
(the `if (... needsExisting) { const existing = parseHandoff(...) }` block) — add
`externalRefsNeedsExisting = externalRefs === undefined` to its condition so no second read is
introduced (DR-8).

## Gate Insertion Order (spec Dependency #1 → resolved)

The three build-entry attestation gates run **back-to-back**, in this frozen order, all on the
identical `pm:In_Progress → {architect,sr-engineer}:In_Progress` edge:

```
validateTransition (accepts edge)
  → [1] SCOPE_DECISION_REQUIRED   (arm-gated; hasDesignModeRequiringVisual)
  → [2] CUT_APPROVAL_REQUIRED     (unconditional; FileHandoffStorage only)
  → [3] EXTERNAL_REFS_UNRESOLVED  (NEW — unconditional*; FileHandoffStorage only)   ← insert HERE
  → QA-evidence record → PASS evidence gate → visual sub-gates → code-review gate → round caps → writeState
```

Insertion point: `tools/handoff-orchestrator.ts` immediately **after** the Cut-Approval Gate
`if` block (ends line 176) and **before** the QA-evidence record block (begins line 181). This
keeps all transition-shaped rejects reading first (matching the existing rationale comment at
lines 88-97) and preserves the FROZEN check-order comment block at lines 9-13 — sr-engineer MUST
append `→ external-refs gate` to that comment between `cut-approval gate` and `QA evidence
record`.

\* "unconditional" = not arm-gated on design mode; the gate still only *fires* when
`hasUnresolvedRefs(prevState)` is true. Absence/empty/all-resolved falls straight through (AC-2).

### Gate block shape (envelope consistency — matches CUT_APPROVAL_REQUIRED exactly)

```ts
if (
  getActiveStorage() instanceof FileHandoffStorage &&           // AC-5 — file mode only
  (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&  // AC-4 — both edges
  nextTuple.status === "In_Progress" &&
  prevTuple.agent === "pm" &&                                   // AC-3 — pinned to pm predecessor
  prevTuple.status === "In_Progress"
) {
  if (hasUnresolvedRefs(prevState)) {
    const refs = listUnresolvedRefs(prevState).join(", ");
    const hint = `External reference(s) unresolved: ${refs}.` + gate("EXTERNAL_REFS_UNRESOLVED").hintStatic;
    const envelope = {
      error: "EXTERNAL_REFS_UNRESOLVED",
      attempted: { prev_agent: prevTuple.agent, prev_status: prevTuple.status,
                   new_agent: nextTuple.agent, new_status: nextTuple.status },
      allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
        new_agent: c.agent, new_status: c.status })),
      hint,
    };
    return {
      content: [{ type: "text" as const, text: `⛔ EXTERNAL_REFS_UNRESOLVED\n${JSON.stringify(envelope, null, 2)}` }],
      isError: true,
    };
  }
}
```

The envelope is byte-shape-identical to the Cut-Approval envelope (same `{error, attempted,
allowed, hint}` keys, same `allowed` derivation, same `⛔ <code>\n<json>` text framing) —
satisfies AC-1's "standard orchestrator-json envelope `{error, attempted, allowed, hint}`".
`prevState` is the already-read `storage.parse(parsed.workspace_path)` from line 60 — no
additional read. The `FileHandoffStorage instanceof` check reuses the imported symbol already
in scope (line 20).

**Pass `externalRefs` to writeState:** in the `storage.writeState({...})` call (~line 463), add
`externalRefs: parsed.external_refs,` alongside `cutApproved`.

## Schema Migration Contract (AC-7, AC-8) — handoff v5 → v6

`schema/versions.ts`: `CURRENT_VERSIONS.handoff: 5 → 6`.

`schema/migrations-handoff.ts`: register a stamp-only step, byte-parallel to the v4→v5
`cut_approved` migration:

```ts
// v5 → v6: add optional external_refs ledger (b8-external-ref-ledger).
// Additive STAMP-ONLY: bumps the version, seeds NO default for external_refs.
// Absence is the "zero refs found" non-blocking sentinel (AC-2/AC-7) — seeding
// [] would be a redundant materialization of absence, so we add nothing.
// Mirrors the v3→v4 scope_decision and v4→v5 cut_approved stamp-only pattern.
registerMigration<Record<string, unknown>, Record<string, unknown>>({
  kind: "handoff", from: 5, to: 6,
  up: (input) => ({ ...input, schema_version: 6 }),
});
```

Contract: pure (AC-8 — only `schema_version` changes, no field added/removed/seeded); lossless;
adjacent-step (the runner enforces `to === from + 1`). The `void CURRENT_VERSIONS.handoff;`
grep-anchor at the file tail stays as-is. Lazy migrate-on-read + best-effort write-back heal is
already wired in `readAndMigrate` / `readHandoffState`; no new call-site work. The migration-heal
write uses the positional overload (omits `external_refs`) — safe because a freshly-migrated v5
file has no ledger, and the preserve-if-same-feature clause carries any existing one forward
(DR-8). `docs/schema-versions.md` documents the process; no new doc section required beyond the
changelog stamp release-engineer adds.

**Concurrency check (spec Dependency §Schema version bump):** confirmed `CURRENT_VERSIONS.handoff`
is `5` today (last bumped by pm-cut-approval-gate). No other in-flight feature bumps it. B8 owns
5 → 6. If another 5→6 lands first at merge, this feature rebases to 6→7 (mechanical).

## Surfacing to architect / tw_get_state (User Story 3)

No extra work: `readHandoffState` builds its JSON view via `{ ...state }` (line 277-278), so once
`HandoffState.external_refs` is populated it appears automatically in the `tw_get_state` output an
architect reads — the ledger surfaces without a dedicated projection. Document this in the parse
comment so it is not "optimized away" as unused.

## Sequence Diagram

```mermaid
sequenceDiagram
    actor PM as PM (pm:In_Progress)
    participant TW as tw_update_state
    participant ORC as handoff-orchestrator
    participant GATE as gates/external-refs
    participant ST as FileHandoffStorage
    Note over PM,ST: build-entry hop, ledger has an unresolved ref
    PM->>TW: agent_id=architect, status=In_Progress
    TW->>ORC: handleUpdateState(parsed)
    ORC->>ST: parse(workspace) → prevState (last_agent=pm, external_refs=[…unresolved])
    ORC->>ORC: validateTransition → OK
    ORC->>ORC: SCOPE_DECISION_REQUIRED → clear
    ORC->>ORC: CUT_APPROVAL_REQUIRED → clear (cut_approved=true)
    ORC->>GATE: hasUnresolvedRefs(prevState)?
    GATE-->>ORC: true; listUnresolvedRefs → ["https://figma…"]
    ORC-->>PM: ⛔ EXTERNAL_REFS_UNRESOLVED {error,attempted,allowed,hint(refs)}
    Note over PM,ST: PM resolves refs → state:"indexed", re-writes as pm:In_Progress
    PM->>TW: external_refs=[{ref,state:"indexed"}] (REPLACE)
    ORC->>ST: writeState (external_refs persisted)
    Note over PM,ST: retry build-entry hop
    PM->>TW: agent_id=architect, status=In_Progress
    ORC->>GATE: hasUnresolvedRefs(prevState)? → false
    ORC->>ST: writeState → transition proceeds
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| DR-1: array-of-object handoff field (first of its kind) | Persist `external_refs` as a YAML block sequence in frontmatter via the existing js-yaml `dump`/`load`; `forceQuotes` quotes nested string values, round-trips losslessly | No new serializer; must widen `frontmatterData`'s value type (DR-5). `completed_tasks`/`pending_notes` stay in the markdown body — `external_refs` is the only frontmatter list. |
| DR-2: gate placement | Insert as the 3rd back-to-back build-entry gate, after CUT_APPROVAL_REQUIRED, before QA-evidence record | All three attestation gates read consecutively; frozen check-order comment extended, not reordered; independent error code + envelope (tests assert each in isolation). |
| DR-3: absence polarity | Absence / empty ⇒ gate CLEARS (inverse of cut_approved) | Migration seeds nothing; empty array never serialized; predicate returns false on absent field. Explicitly called out to prevent wrong-polarity copy of cut_approved (spec AC-2). |
| DR-4: no PM-re-entry re-arm | `external_refs` resets ONLY on active_feature change, NOT on pm:In_Progress re-entry | Diverges from cut_approved on purpose — re-arming an absence-clears field would discard a valid ledger and un-block the gate. Preserves ledger across QA-FAIL→PM bounces within a feature. |
| DR-5: `frontmatterData` type | Widen from `Record<string, string \| number \| boolean>` to also admit `ExternalRef[]` | One type change in `writeHandoffState`; keeps the single `yaml.dump` call. No structural refactor. |
| DR-6: hint byte-parity | Split S02 into dynamic prefix (`External reference(s) unresolved: <refs>.`) + static suffix in `hintStatic` (leading space) | Matches the registry's `hintStatic`-concatenation contract (gate-registry DR-2); the qa error-code-contract parity test compares the static portion. sr must assemble the two halves exactly. |
| DR-7: storage forwarding | Add `externalRefs?` to `WriteHandoffStateOptions` only; no positional-overload signature change | Both storage impls forward the opts object wholesale; SQLite accepts-and-ignores (AC-5). Zero change to the deprecated positional path. |
| DR-8: single existing-state read | Fold `externalRefsNeedsExisting = externalRefs === undefined` into the existing consolidated preserve read | No second `parseHandoff` call; migration-heal (positional, omits field) carries the ledger forward via the same-feature preserve clause. |
| DR-9: transitions union membership | Add the code to `TransitionRejection["error"]` despite being handler-side-only | Required for the `union ⊆ ALL_GATE_CODES` test invariant + envelope narrowing; mirrors CUT_APPROVAL_REQUIRED / SCOPE_DECISION_REQUIRED exactly. Not added to `TRANSITION_GATE_CODES`. |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites lists only internal source files and precedent
specs (no URLs, design files, or ticket ids), and §Copy/Strings confirms every string is
authored in-server. Zero external references to defer. (Fittingly, the feature that adds the
external-reference ledger has no external references of its own.)_

## Open Questions

None.
