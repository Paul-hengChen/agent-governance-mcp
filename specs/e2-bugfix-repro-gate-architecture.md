# e2-bugfix-repro-gate — architecture

> Blueprint for backlog **E2** (`docs/backlog.md` §E2). PM spec:
> `specs/e2-bugfix-repro-gate.md`. Ticket cut: `tasks.md` T-E2-01…T-E2-06.
> Non-design feature (no `design/e2-*.md`) — Visual Harness section omitted by
> schema rule. Routing chain: pm → sr-engineer → code-reviewer → qa-engineer
> (architect/design-auditor skipped by default, AC1).

## Summary of pinned decisions

1. **Signal** — a new first-class handoff field `dispatch_mode?: "feature" | "bugfix"`, schema `handoff` **v10 → v11** (stamp-only migration). Absence = `"feature"` (default). Config-flag and `pending_notes` alternatives rejected (see DR-1).
2. **Repro-first gate** — ONE new error code `REPRO_MANIFEST_MISSING`, plain-text orchestrator gate (sibling of `EXPECTED_RED_DIFF_MISSING`), enforced at the `sr-engineer:In_Progress → code-reviewer:In_Progress` edge, armed by `prevState.dispatch_mode === "bugfix"` (file-mode only). **No `tools/transitions.ts` change** — this family of plain-text gates is not in the `TransitionRejection["error"]` union (DR-5).
3. **Manifest** — reuse the C15 file **verbatim**: `qa_reports/expected-red_<feature>.txt`. No new file, no new predicate — the repro-first gate calls the existing `hasExpectedRedManifest()`. `gates/expected-red.ts` is unchanged (DR-2).
4. **Strict PASS (AC3)** — reuse the existing `EXPECTED_RED_DIFF_MISSING` PASS gate (auto-armed by manifest presence) as the machine floor; add a bugfix-mode branch to skill-qa-engineer Phase 0.5 that makes the `## Expected-Red Diff` disposition **load-bearing** (declared repro set → green, zero unexplained reds, else FAIL). Feature-mode advisory behavior is byte-unchanged (AC5, DR-4).
5. `pm:In_Progress → sr-engineer:In_Progress` is already a legal edge (`tools/transitions.ts:189-196`) — no new edge, `dispatch_mode` never gates a transition (DR-7).

## Affected Files

### T-E2-01 — bugfix-mode signal (`dispatch_mode` handoff field). ~4 code files + 1 doc.
- `tools/handoff.ts` — modify: add `dispatch_mode?: "feature" | "bugfix"` to the `HandoffState` interface (near `dispatch_pins`, `:161`); parse `frontmatter.dispatch_mode` in the parser (validate against the two-value enum, else drop; near `:357`) and add it to the assembled state via the conditional-spread pattern (`...(dispatchMode && { dispatch_mode: dispatchMode })`, near `:390`); add `dispatchMode?` to the `writeState` options object (near `:602`); feature-scoped carry-forward in `writeHandoffState` (carry from `existing` iff `existing.active_feature === _activeFeature` and the write omitted it — mirror the `dispatch_pins` branch `:797-824`, but SCALAR not map); emit to frontmatter when set (near `:848`).
- `schema/versions.ts` — modify: bump `CURRENT_VERSIONS.handoff` `10 → 11`.
- `schema/migrations-handoff.ts` — modify: register a **stamp-only** `v10 → v11` step (`up: (input) => ({ ...input, schema_version: 11 })`) — seeds NO default (absence = feature-mode; the exact v9→v10 `dispatched_at` template, DR-1/DR-8).
- `tools/registry.ts` — modify: add `dispatch_mode?` to `UpdateStateInput` (near `:160`); add the zod schema (`z.enum(["feature","bugfix"]).optional()`, model on the `dispatch_pins` zod at `:173`); add the JSON-Schema property + description (model on `:457`).
- `docs/schema-versions.md` — modify: append the v10→v11 handoff row.
- `tools/handoff-orchestrator.ts` — modify (1 line): thread `dispatchMode: parsed.dispatch_mode` into the `storage.writeState({...})` call next to `dispatchPins` (`:779`).

### T-E2-02 — repro-first gate (`REPRO_MANIFEST_MISSING`). ~2 files.
- `gates/registry.ts` — modify: add `"REPRO_MANIFEST_MISSING"` to the `GateErrorCode` union (`:23-48`); add a `GateDefinition` (producer `"orchestrator"`, envelope `"plain-text"`, `documentedInProse: true`) in catalog order alongside `EXPECTED_RED_DIFF_MISSING`; add its `errorCode → doc-file` comment row (`skill-sr-engineer.md`).
- `tools/handoff-orchestrator.ts` — modify: new gate block (see Interface Contracts) inserted **after** the external-refs gate (`:330`) and **before** the review-verdict/status-mismatch gate (`:345`); update the frozen-order header comment (`:9-15`) additively. NO change to `gates/expected-red.ts` (reuses `hasExpectedRedManifest`). NO change to `tools/transitions.ts` (DR-5).

### T-E2-03 — skill text. ~3 files.
- `content/skill-pm.md` — bugfix ticket-cut guidance: set `dispatch_mode: "bugfix"` on the pm build-entry write and route `next_role: "sr-engineer"` (AC1 default: architect/design-auditor skipped); AC4 opt-back-in note (a cross-cutting fix — ≥3 modules / data-model / cross-cutting API, the existing architect-routing threshold — routes to architect and/or sets `dispatch_mode: "feature"`); one Task-Format example.
- `content/skill-sr-engineer.md` — repro-first step for bugfix mode: write the reproduction test, run it, confirm it is RED, record it in `qa_reports/expected-red_<feature>.txt` (`<test file> | <exact test name>`, C15 format) **before** writing the fix; the `sr-engineer:In_Progress → code-reviewer:In_Progress` handoff is BLOCKED (`REPRO_MANIFEST_MISSING`) until the manifest exists; AC6 escape — if repro is infeasible, escalate `status=Blocked` to pm (standard protocol; the Blocked edge is never gated). Must backtick-quote `` `REPRO_MANIFEST_MISSING` `` (satisfies the `documentedInProse` contract test).
- `content/skill-qa-engineer.md` — bugfix-mode Phase 0.5 branch: when `dispatch_mode == "bugfix"`, the `## Expected-Red Diff` disposition is **load-bearing** — every manifest (repro) entry MUST be confirmed turned GREEN and there MUST be ZERO actual reds absent from the manifest; a stray red is a regression → FAIL (not a disposition-away). Feature-mode Phase 0.5 language is unchanged (AC5).

### Tests (T-E2-05, qa-owned deliverables — listed for completeness)
- `test/*.mjs` — repro-first gate unit + orchestrator integration (file mode); `dispatch_mode` parse/write/feature-scope + v10→v11 migration; skill-text pins. (qa-engineer authors; not sr-engineer scope.)

## Data Structures

```ts
// tools/handoff.ts — HandoffState (additive)
dispatch_mode?: "feature" | "bugfix";
// Absence === "feature" (the default). Feature-scoped: carried across
// same-active_feature writes that omit it, dropped on active_feature change,
// NOT re-armed on PM re-entry (a stable ticket classification, unlike
// cut_approved which re-arms). Changeable by an explicit PM write (AC4).
// File-mode only: SqliteHandoffStorage.writeState ignores it (mirrors
// dispatch_pins DR-5) — the gates it arms are file-mode only anyway.

// gates/registry.ts — GateErrorCode (additive)
| "REPRO_MANIFEST_MISSING"
```

No new manifest data structure — the repro manifest **is** `qa_reports/expected-red_<feature>.txt` (C15 shape verbatim: `<relative test file path> | <exact test name>` per line; `#`/blank lines are comments). No new predicate module.

## Interface Contracts

**No new function signatures.** The repro-first gate reuses the existing pure predicate:

```ts
// gates/expected-red.ts (UNCHANGED — reused as-is)
hasExpectedRedManifest(workspacePath: string, activeFeature: string):
  { present: boolean; manifestPath: string }
```

**Orchestrator gate block** (new, in `handleUpdateStateCore`, plain-text envelope — the `EXPECTED_RED_DIFF_MISSING` pattern):

```ts
// E2 — Repro-First Gate (e2-bugfix-repro-gate, AC2/AC6). Bugfix-mode only.
// Fires on the fix-phase handoff sr-engineer:In_Progress → code-reviewer:In_Progress
// when the incumbent feature is dispatch_mode="bugfix" but no repro manifest
// (qa_reports/expected-red_<feature>.txt) exists. Blocks the write — never a
// silent skip, never a throw (AC6). The Blocked escape edge
// (sr-engineer → pm) is NOT keyed here, so escalation is always available.
// FILE-MODE ONLY: the manifest is a qa_reports/ file convention (mirrors the
// cut-approval / external-refs / expected-red guards). NOT in transitions.ts
// (plain-text orchestrator gate; not in the TransitionRejection union — DR-5).
if (
  storage instanceof FileHandoffStorage &&
  prevState?.dispatch_mode === "bugfix" &&
  prevTuple.agent === "sr-engineer" &&
  prevTuple.status === "In_Progress" &&
  nextTuple.agent === "code-reviewer" &&
  nextTuple.status === "In_Progress"
) {
  const manifest = hasExpectedRedManifest(parsed.workspace_path, parsed.active_feature);
  if (!manifest.present) {
    return {
      content: [{ type: "text" as const, text:
        `⛔ REPRO_MANIFEST_MISSING: ${parsed.active_feature}. ` +
        `Expected repro manifest at ${manifest.manifestPath}. ` +
        gate("REPRO_MANIFEST_MISSING").hintStatic }],
      isError: true,
    };
  }
}
```

`hintStatic` (registry): points at skill-sr-engineer repro-first discipline and names the escape — e.g. *"Bugfix-mode fix cannot hand off to code-reviewer until qa_reports/expected-red_<feature>.txt records the failing reproduction test(s) proven red before the fix (skill-sr-engineer). If repro is infeasible, escalate status=Blocked to pm instead. See specs/e2-bugfix-repro-gate.md AC2/AC6."*

**Registry entry** (doc-facing fields, C12 convention):
- `triggerEdge`: `sr-engineer:In_Progress -> code-reviewer:In_Progress (file-mode only)`
- `armCondition`: `prevState.dispatch_mode === "bugfix"; FileHandoffStorage only`
- `clearingArtifact`: `qa_reports/expected-red_<feature>.txt present (hasExpectedRedManifest)`

## Sequence Diagram

```mermaid
sequenceDiagram
    actor PM as pm
    participant O as tw_update_state (orchestrator)
    actor SR as sr-engineer
    actor CR as code-reviewer
    actor QA as qa-engineer
    PM->>O: pm:In_Progress, dispatch_mode="bugfix", next_role=sr-engineer, cut_approved
    O->>O: cut-approval gate clears; dispatch_mode persisted (feature-scoped)
    Note over SR: repro-first — write repro test, confirm RED,<br/>record qa_reports/expected-red_<feature>.txt, THEN fix
    SR->>O: sr-engineer:In_Progress → code-reviewer:In_Progress
    alt manifest absent
        O-->>SR: ⛔ REPRO_MANIFEST_MISSING (blocked; escalate Blocked→pm if infeasible)
    else manifest present
        O->>CR: accepted (code-reviewer samples manifest entries, C15 AC-3)
    end
    CR->>O: code-reviewer:In_Progress → qa-engineer:In_Progress
    Note over QA: Phase 0.5 — diff suite vs manifest; bugfix mode:<br/>every repro entry must be GREEN, zero unexplained reds
    QA->>O: qa-engineer:PASS (+ ## Expected-Red Diff disposition)
    O->>O: EXPECTED_RED_DIFF_MISSING gate: disposition present → PASS
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Signal mechanism (spec dependency Q; AC1/AC4/AC5) | First-class handoff field `dispatch_mode: "feature"\|"bugfix"`, schema v10→v11, absence = feature. **Reject** config-flag and pending_notes. | The signal is NEW PM intent that cannot be *derived* — so E1 a-min's zero-bump trick does not apply; the bump is the honest, precedent-consistent cost (cut_approved v5 … dispatch_pins v8 … dispatched_at v10). Config (`.current/.config.json`) is workspace-GLOBAL and persists across features → a stale `bugfix:true` silently mis-classifies the next ticket (footgun) AND config is a server-side lookup not echoed to agents, but the coordinator must SEE the mode to route (AC1). pending_notes is stringly-typed (the C9/C14 anti-pattern the spec forbids regressing to). A handoff field is feature-scoped, agent-visible, and zod-enum-validated. |
| Repro manifest artifact (AC2; "reuse C15") | Reuse `qa_reports/expected-red_<feature>.txt` **verbatim** — no sibling file, no new predicate; the gate calls the existing `hasExpectedRedManifest()`. | Maximal reuse ("do not reinvent"); `gates/expected-red.ts` untouched; code-reviewer's C15 AC-3 manifest-sampling and QA's Phase 0.5 diff apply unchanged. A repro test is a "declared red" (red before the fix); the Phase 0.5 diff is status-neutral (declared-vs-actual delta + per-entry disposition), so it serves both readings. Constraint: bugfix mode does not mix "must stay red" and "must turn green" entries — a fix needing intentional reds is cross-cutting → AC4 full chain. |
| Strict, load-bearing PASS (AC3 vs AC5) | Machine floor = existing `EXPECTED_RED_DIFF_MISSING` (auto-armed by manifest presence); strictness = a **dispatch_mode branch in skill-qa-engineer Phase 0.5** (declared reds→green, zero unexplained reds, else FAIL). No new PASS gate. | Server keeps its existence-only trust boundary (never runs the suite / parses rows) — identical to MISSING_EVIDENCE and C15. Feature-mode advisory behavior is byte-unchanged (AC5): feature tickets have no `dispatch_mode=bugfix`, so nothing new arms. Load-bearing-ness is agent-enforced in bugfix mode, matching every other content-correctness gate. |
| Repro-first enforcement site (AC2) | Orchestrator, on `sr-engineer:In_Progress → code-reviewer:In_Progress`; armed by `prevState.dispatch_mode==="bugfix"`. | The only forward outbound edge from sr-engineer is → code-reviewer, so this is *the* fix-phase write. Keying on this single edge leaves the Blocked escape (sr→pm) ungated (AC6). Placed after external-refs, before review-verdict-mismatch — a disjoint edge, so it reorders no existing gate; check order stays frozen-additive. |
| `tools/transitions.ts` change | **None.** | `REPRO_MANIFEST_MISSING` is a plain-text orchestrator gate; the `TransitionRejection["error"]` union carries only `rejection()`-envelope codes (EXPECTED_RED_DIFF_MISSING, MISSING_EVIDENCE, etc. are *not* in it). Corrects the T-E2-02 cut line, which assumed a union extension. transitions.ts stays pure/fs-free; `union ⊆ ALL_GATE_CODES` still holds (new code is in the superset only). |
| `dispatch_mode` persistence scope | File-mode only (SQLite ignores it), mirroring `dispatch_pins` DR-5. | The gates it arms (repro-first, expected-red PASS) are file-mode only, so no SQLite value is load-bearing; keeps T-E2-01 out of `tools/storage-sqlite.ts`. |
| `dispatch_mode` feature-scoping | Carried across same-feature writes, dropped on active_feature change, NOT re-armed on PM re-entry; changeable by explicit PM write. | Bug-vs-feature is a stable ticket classification (unlike cut_approved which re-arms per cut). AC4 opt-out = PM explicitly sets `"feature"` (or routes to architect). Mirrors the `dispatch_pins` carry-forward branch, but scalar. |
| Routing (AC1) vs state machine (AC5) | `dispatch_mode` arms the two file-mode gates ONLY; it never gates a transition edge. | `pm:In_Progress → sr-engineer:In_Progress` is already legal; no new edge, transitions.ts untouched. The "lighter chain" is the PM's cut/routing choice (route to sr-engineer, skip architect), not a server-enforced edge — AC1 satisfied within the existing matrix. |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites Resource Audit found zero external references (all in-repo file paths)._

## Open Questions

None.

### Sequencing note (not an open question)
`REPRO_MANIFEST_MISSING` carries `documentedInProse: true`, so `test/error-code-contract.test.mjs` requires it backtick-quoted in ≥1 `content/*.md` (skill-sr-engineer.md, per T-E2-03). Therefore T-E2-02 (registry) and T-E2-03 (skill text) must both land before that contract test passes — the HOP_CAP DR-7 precedent. Build order: T-E2-01 → { T-E2-02, T-E2-03 } → T-E2-04 → T-E2-05 → T-E2-06.
