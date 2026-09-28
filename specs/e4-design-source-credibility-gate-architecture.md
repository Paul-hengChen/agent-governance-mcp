# e4-design-source-credibility-gate — architecture

> Architect blueprint for `specs/e4-design-source-credibility-gate.md` (10 ACs).
> Authored 2026-07-12 by @architect. Mechanism: a new build-entry gate
> `SOURCE_CREDIBILITY_UNVERIFIED` on the `pm:In_Progress → {architect,sr-engineer}:In_Progress`
> edge, arming only on fetch-based design-armed features, blocking when the
> `## Source` manifest's audited rows lack a `credibility: full-page-composite`
> attestation. B8 external-refs pattern, but the attestation lives in
> `design/<feature>.md` (a workspace file, read via `fs`), NOT handoff YAML —
> so no schema bump and the gate is storage-mode-agnostic.

---

## Affected Files

Grouped by the PM task that owns each (tasks pre-cut in `tasks.md`; the file
list below is the authoritative build contract — where a task's original text
under-listed a file, the note calls it out).

**T-E4-01 (sr-engineer) — attestation writer SOP**
- `content/skill-design-auditor.md` — modify: (1) `## Source manifest` Artifact-Schema
  row now specifies a header-bearing table with a `credibility` column; (2) step 2b
  gains a closing instruction to record `credibility: full-page-composite` on the
  audited row for classification (a); (3) reaffirm AC-2 regression guard — (b)/(c)/(d)
  still STOP before any row is written, so `full-page-composite` is the ONLY value an
  `audited` row can legally carry.

**T-E4-02 (sr-engineer) — parser + gate code + registry**
- `gates/visual.ts` — modify: extend `BaselineManifestRow` with a `credibility` field;
  extend `parseBaselineManifestRows` to read a `credibility` column by header; add a
  `FETCH_BASED_MODES` constant and a new `checkSourceCredibility(...)` composition helper
  (mirrors `checkBaselineManifest`'s dormant/fail shape). Reuses the module's existing
  `designFilePath`, `parseDesignMode`, and `sliceH2Section`.
- `gates/registry.ts` — modify: add `SOURCE_CREDIBILITY_UNVERIFIED` to the `GateErrorCode`
  union; add one `GateDefinition` entry; add one line to the `errorCode → doc-file` mapping
  comment.
- `tools/transitions.ts` — modify (NOT in the task's original file list; add it): add
  `SOURCE_CREDIBILITY_UNVERIFIED` as a handler-side-only member of the
  `TransitionRejection["error"]` union with a doc-comment (mirrors `EXTERNAL_REFS_UNRESOLVED`
  / `FEATURE_LEASE_HELD`). Needed for the `union ⊆ ALL_GATE_CODES` invariant + envelope
  narrowing. Decision Record DR-3.

**T-E4-03 (sr-engineer) — orchestrator wiring + coordinator + pm**
- `tools/handoff-orchestrator.ts` — modify: add the gate check + update the frozen
  check-order comment block.
- `content/coord-03-core-fallback.md` — modify: add one Auto-Routing / Escalation-Routes
  stop-condition row (this is the file that composes into `skill-coordinator.md`; there is
  no monolithic `content/skill-coordinator.md` on disk — see DR-6).
- `content/skill-pm.md` — modify: one-line Gate Summary cross-reference for PM awareness.
- `content/skill-coordinator-lite.md` — NOT modified (see DR-7).

**T-E4-05 (qa-engineer) — tests**
- `test/error-code-contract.test.mjs` — modify: gate-count re-baseline 26 → 27, union
  count 15 → 16, doc-file-mapping size 27, new `FREE_TEXT_ALLOWLIST` entry.
- `test/source-credibility-gate.test.mjs` — create: the gate's own coverage (fire/dormancy/
  resume-safety/storage-agnostic/hint), plus predicate + parser unit tests.

**T-E4-04 (code-reviewer)** and **T-E4-REL / T-E4-DONE** touch no source files beyond review
and release bookkeeping.

No changes to: `tools/handoff.ts`, `tools/registry.ts` (zod), `schema/*` (schema_version
stays **11**), `tools/telemetry.ts` (E8-owned — see DR-8), `content/skill-release-engineer.md`.

---

## Data Structures

### Extended `BaselineManifestRow` (`gates/visual.ts`)

```ts
export interface BaselineManifestRow {
  medium: string;
  pointer: string;
  status: string;
  isAudited: boolean;
  credibility: string;   // NEW: the `credibility` cell, normalized lowercase-trimmed;
                         //      "" when the column is absent/blank. Only the literal
                         //      "full-page-composite" clears the gate on an audited row.
  rawLine: string;
}
```

Additive field. Existing `checkBaselineManifest` logic is untouched (`isAudited` and
`auditedCount` unchanged). Existing `test/baseline-manifest-gate.test.mjs` assertions read
individual fields (`.isAudited`) or compare two calls' outputs to each other (`deepEqual(r1, r2)`);
they do NOT deep-equal a full literal row object, so the added field is non-breaking (verified).

### New constant + result type (`gates/visual.ts`)

```ts
// Explicit INCLUSION list (spec Dependencies point 4) — deliberately NARROWER than
// hasDesignModeRequiringVisual's "any mode != no-design" EXCLUSION. Matches step 2b's
// own scope so the gate never false-fires on image/pdf/paper.
const FETCH_BASED_MODES = ["figma", "sketch", "xd", "penpot"] as const;

export interface SourceCredibilityCheck {
  ok: boolean;
  offendingRows: string[];   // "medium/pointer" pairs for audited rows missing/wrong credibility
  designPath: string;        // resolved design/<feature>.md, for the hint
  mode: string | null;       // parsed mode, for error context / debugging
}
```

### Gate registry entry (`gates/registry.ts`)

```ts
{
  errorCode: "SOURCE_CREDIBILITY_UNVERIFIED",
  producer: "orchestrator",
  envelope: "orchestrator-json",
  triggerEdge: "pm:In_Progress -> {architect,sr-engineer}:In_Progress",
  armCondition: "checkSourceCredibility (fetch-based modes figma/sketch/xd/penpot only)",
  clearingArtifact:
    "every audited ## Source row carries credibility: full-page-composite, or design is non-fetch-mode / has no ## Source section / no design file",
  hintStatic:
    " Every audited row in a fetch-based design (figma/sketch/xd/penpot) must carry " +
    "credibility: full-page-composite in the ## Source manifest before routing to build. " +
    "See content/skill-design-auditor.md step 2b and specs/e4-design-source-credibility-gate.md.",
  documentedInProse: true,
},
```

Note the leading space on `hintStatic` — the emit site concatenates a dynamic prefix
ending in `.` then this string, reproducing spec S02 byte-for-byte (AC-8). Place the entry
in `GATE_REGISTRY` immediately after `EXTERNAL_REFS_UNRESOLVED` so the pm→build build-entry
attestation gates stay grouped (array order is DOC order only; not evaluation order).

### `## Source` manifest shape the SOP now emits (`content/skill-design-auditor.md`)

Header-bearing table so the parser can locate the `credibility` column by name:

```
| medium | pointer | fetched | status   | credibility          | reason |
|--------|---------|---------|----------|----------------------|--------|
| figma  | 12:345  | yes     | audited  | full-page-composite  | …      |
| figma  | 12:900  | yes     | deferred |                      | over pass_budget |
```

`credibility` is required non-empty ONLY on `audited` rows; `deferred` / `out-of-scope`
rows leave it blank (they never reach the gate — `isAudited` is false for them).

---

## Interface Contracts

### `gates/visual.ts`

```ts
// Extend the existing parser: detect a `credibility` column by header name
// (findIndex(/^credibility$/)); positional fallback = "" when no such header.
// Value normalized: trim().toLowerCase(). Pure, never throws.
export function parseBaselineManifestRows(content: string): BaselineManifestRow[];

// NEW composition helper (fs). Reads design/<feature>.md once via designFilePath().
// Never throws (fs errors → dormant ok:true). Decision tree:
//   1. no activeFeature OR file absent            → { ok:true }  (AC-4)
//   2. parseDesignMode(content) not in FETCH_BASED_MODES → { ok:true }  (AC-4)
//   3. sliceH2Section(content,"Source") === null  → { ok:true }  (AC-4)
//   4. audited rows whose normalized credibility !== "full-page-composite"
//      → { ok:false, offendingRows:["<medium>/<pointer>", …] }  (AC-1, AC-3)
//   5. zero audited rows, or all audited rows compliant → { ok:true }
// `mode != no-design` is NOT re-checked broadly — the fetch-based INCLUSION list
// in step 2 is the whole arm (spec Dependencies point 4).
export function checkSourceCredibility(
  workspacePath: string,
  activeFeature: string,
): SourceCredibilityCheck;
```

### `tools/handoff-orchestrator.ts` — emit site

Inserted as a new block **immediately after the External-Refs gate (current line ~334)
and before the E2 Repro-First gate (~336)** — same `pm:In_Progress → {architect,sr-engineer}:In_Progress`
edge, so all build-entry attestation gates run back-to-back; frozen check-order stays
additive (no reorder, no merge).

```ts
// E4 — Source-Credibility Gate (e4-design-source-credibility-gate). FOURTH
// build-entry attestation gate on the pm:In_Progress -> {architect,sr-engineer}
// :In_Progress edge, after scope-decision / cut-approval / external-refs.
// UNLIKE those three (file-mode only, read handoff YAML), this gate reads
// design/<feature>.md directly via fs, so it is STORAGE-MODE-AGNOSTIC (AC-7) —
// NO `getActiveStorage() instanceof FileHandoffStorage` guard. Arm is the
// fetch-based-mode INCLUSION list inside checkSourceCredibility, NOT the broad
// hasDesignModeRequiringVisual exclusion. Pinned to prev=pm keeps resume/re-entry
// safe (AC-6): architect->sr-engineer and the sr self-loop have a non-pm
// predecessor and are never gated. NOT in transitions.ts (that stays pure /
// fs-free; mirrors SCOPE_DECISION_REQUIRED). Independent of the PASS-time
// baseline-manifest gates (AC-5): different edge, different check.
if (
  (nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer") &&
  nextTuple.status === "In_Progress" &&
  prevTuple.agent === "pm" &&
  prevTuple.status === "In_Progress"
) {
  const cred = checkSourceCredibility(parsed.workspace_path, parsed.active_feature);
  if (!cred.ok) {
    const rows = cred.offendingRows.join(", ");
    const hint =
      `Source-credibility attestation missing or unverified for: ${rows}.` +
      gate("SOURCE_CREDIBILITY_UNVERIFIED").hintStatic;
    const envelope = {
      error: "SOURCE_CREDIBILITY_UNVERIFIED",
      attempted: {
        prev_agent: prevTuple.agent,
        prev_status: prevTuple.status,
        new_agent: nextTuple.agent,
        new_status: nextTuple.status,
      },
      allowed: (ALLOWED_TRANSITIONS.get("pm:In_Progress") ?? []).map((c) => ({
        new_agent: c.agent,
        new_status: c.status,
      })),
      hint,
    };
    return {
      content: [{
        type: "text" as const,
        text: `⛔ SOURCE_CREDIBILITY_UNVERIFIED\n${JSON.stringify(envelope, null, 2)}`,
      }],
      isError: true,
    };
  }
}
```

Add `checkSourceCredibility` to the existing `from "../gates/visual.js"` import block.
Update the frozen check-order comment (lines ~9-15): `… external-refs gate → source-credibility
gate (E4) → repro-first gate (E2, bugfix-mode) → …`.

**Telemetry (E8 boundary):** the `⛔ SOURCE_CREDIBILITY_UNVERIFIED` text prefix is picked up
by the existing generic `extractGateCodeFromText` in the D3 telemetry wrapper (`handleUpdateState`).
No change to `tools/telemetry.ts` is required or permitted — E8 owns it (DR-8).

---

## Sequence Diagram

```mermaid
sequenceDiagram
    actor DA as design-auditor
    participant DF as design/&lt;feature&gt;.md
    actor PM as pm
    participant ORC as orchestrator<br/>(tw_update_state)
    participant VIS as checkSourceCredibility<br/>(gates/visual.ts)
    actor BLD as architect / sr-engineer

    DA->>DA: step 2b classify node
    alt classification (a) full-page composite
        DA->>DF: write ## Source audited row<br/>credibility: full-page-composite
    else classification (b)/(c)/(d)
        DA->>PM: STOP status=Blocked, next_role=pm (AC-2, unchanged)
    end
    PM->>ORC: tw_update_state(agent_id=pm→build, next=architect/sr-engineer)
    ORC->>VIS: checkSourceCredibility(ws, feature)
    VIS->>DF: read design file (fs)
    alt non-fetch mode / no design file / no ## Source
        VIS-->>ORC: { ok:true } (dormant, AC-4)
        ORC-->>BLD: build-entry accepted
    else audited row missing/wrong credibility
        VIS-->>ORC: { ok:false, offendingRows }
        ORC-->>PM: ⛔ SOURCE_CREDIBILITY_UNVERIFIED (AC-3)
    else all audited rows = full-page-composite
        VIS-->>ORC: { ok:true }
        ORC-->>BLD: build-entry accepted
    end
```

---

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| DR-1: parser placement — extend `parseBaselineManifestRows` vs a sibling parser | Extend the existing parser + `BaselineManifestRow` with a `credibility` field (PM's recommendation) | One read of the identical `## Source` table for both the PASS-time manifest gate and the build-entry credibility gate; DRY. Cost: one additive field. Closes off a duplicate parser that would re-implement `designFilePath`/`sliceH2Section`/header detection. |
| DR-2: arm condition — reuse `hasDesignModeRequiringVisual` vs explicit inclusion list | New `FETCH_BASED_MODES = {figma,sketch,xd,penpot}` inclusion list inside `checkSourceCredibility` | Gate scope matches step 2b exactly and never false-fires on `image`/`pdf`/`paper` (which `hasDesignModeRequiringVisual.required` would arm). Cost: the two arm conditions are intentionally NOT shared — a future mode added to `KNOWN_MODES` does NOT auto-arm this gate (correct: only fetch modes have a machine node to mis-source). |
| DR-3: `transitions.ts` union member | Add `SOURCE_CREDIBILITY_UNVERIFIED` as a handler-side-only member of `TransitionRejection["error"]` with a doc-comment | Keeps the `union ⊆ ALL_GATE_CODES` invariant satisfiable and gives the orchestrator envelope a narrowed error type. Bumps the DR-8 union count 15 → 16 (qa re-baselines the assertion). It is NOT produced by `validateTransition` (fs-reading gate), matching `EXTERNAL_REFS_UNRESOLVED`/`FEATURE_LEASE_HELD`. |
| DR-4: storage mode | Storage-mode-agnostic — NO `instanceof FileHandoffStorage` guard | Attestation lives in `design/<feature>.md`, a workspace file `gates/visual.ts` already reads via `fs` independent of handoff storage kind (AC-7). Deliberate DIFFERENCE from `cut_approved`/`external_refs` (file-mode-only, read handoff YAML) and SIMILARITY to `checkBaselineManifest`. |
| DR-5: backwards-compat of a `## Source` present but credibility-less | Such a fetch-mode design with audited rows but no `credibility` column FIRES the gate (not dormant) | Only the three dormancy conditions in AC-4 exempt (non-fetch mode / no design file / no `## Source` section at all). A pre-E4 fetch-mode manifest with audited rows is forced to be re-audited with the attestation before it can re-enter build. Consistent with spec Out-of-Scope "no backfill" — the design is re-audited, not auto-populated. This feature (E4) has no `design/e4-*.md`, so its own pm→build hops are dormant. |
| DR-6: coordinator stop-condition location | Edit `content/coord-03-core-fallback.md`, not a monolithic `content/skill-coordinator.md` | `skill-coordinator.md` is composed from `coord-*.md` fragments (`composeSkill`); the Escalation-Routes / stop-conditions table lives in `coord-03-core-fallback.md`. The qa stop-condition test composes the skill and asserts the token appears, so editing the fragment satisfies it. |
| DR-7: lite-mode | Do NOT touch `content/skill-coordinator-lite.md` | Lite is server-read-only and emits no `tw_update_state` transition, so this transition-gated check can never fire there (spec Out-of-Scope). Lite's Auto-Routing does not independently enumerate `EXTERNAL_REFS`-style backtick stop-conditions, so there is nothing to mirror. Keeps the file surface minimal. |
| DR-8: telemetry / E8 boundary | Rely on the existing generic `extractGateCodeFromText`; change no telemetry file | The D3 wrapper extracts any `⛔ <CODE>` prefix generically, so the new code emits telemetry with zero telemetry-code change — respecting the E8-in-another-session boundary. |
| DR-9: hint split | Dynamic prefix at emit site (`…for: {rows}.`) + static suffix in `gate(...).hintStatic` | Follows the `EXTERNAL_REFS_UNRESOLVED` split convention (AC-8); the static suffix names step 2b and this spec, and is what the generative parity test compares. |

---

## Deferred Resources

_None — the spec's Dependencies / Prerequisites shows zero ignored/deferred external
references (all cited artifacts are in-repo; the handoff's `external_refs` ledger is empty)._

---

## Test Specification (for qa-engineer — T-E4-05)

qa-engineer authors these per §2; sr-engineer must not pre-write them. Extend existing files
where a functional analog exists; create ONE new file for the gate's own coverage.

### A. `test/error-code-contract.test.mjs` — re-baseline (mirror the inline b8/c9/e1/e2 precedent comments)
1. **Gate count 26 → 27**: the three assertions in the `AC-1/AC-5: GATE_REGISTRY has exactly 26 entries`
   test (`GATE_REGISTRY.length`, `ALL_GATE_CODES.length`, catalog-order deepEqual) → 27. Add a
   bump-comment naming E4.
2. **Doc-file mapping size**: `mapping.size` assertion 26 → 27, and the mapping comment in
   `gates/registry.ts` must declare `SOURCE_CREDIBILITY_UNVERIFIED  coord-03-core-fallback.md,
   skill-design-auditor.md, skill-pm.md` — matching the EXACT set of `content/*.md` files that
   backtick-quote the code. **Hard constraint:** backtick-quote `` `SOURCE_CREDIBILITY_UNVERIFIED` ``
   in EXACTLY those three files and nowhere else in `content/`, or this test fails.
3. **DR-8 union count 15 → 16**: the `TransitionRejection["error"] union stays byte-identical at
   15 members` test → 16 (and the unique-set size). Update the anchor comment.
4. **`FREE_TEXT_ALLOWLIST`**: add one entry `{ code: "SOURCE_CREDIBILITY_UNVERIFIED", field:
   "triggerEdge", reason: "role:Status edge pair present but not in triggerEdgeCheckable (not a
   CAP_BY_CODE numeric literal, not one of the three pm->build-entry gates in EDGE_CHECKED_CODES)" }`.
   Do **not** allowlist `armCondition` — it names the camelCase predicate `checkSourceCredibility`,
   which appears literally in `handoff-orchestrator.ts`, so it is mechanically checked by the
   `armConditionCheckable` path. (No `SUFFIX_RE` change needed — `_UNVERIFIED` is already in the
   shape-rule vocabulary.)

### B. `test/source-credibility-gate.test.mjs` — new (model on `baseline-manifest-gate.test.mjs` + `cut-approval-gate.test.mjs`)
Parser + predicate unit tests (pure, no server spawn — composition-test convention):
1. **AC-1 fire — missing cell**: fetch-mode design, one audited row, `credibility` column
   absent → `checkSourceCredibility.ok === false`, offendingRows names `medium/pointer`.
2. **AC-1 fire — empty cell**: header present, credibility cell blank on an audited row → fires.
3. **AC-3 fire — wrong value**: credibility = `component-variant` (or any non-`full-page-composite`)
   on an audited row → fires; hint names the row.
4. **AC-1 clear**: audited row with `full-page-composite` → `ok === true`.
5. **AC-3 multi-row**: two audited rows, one compliant + one wrong → fires, offendingRows lists
   ONLY the offender.
6. **Deferred/out-of-scope rows ignored**: a blank-credibility `deferred` row alongside a
   compliant audited row → `ok === true` (only `isAudited` rows are checked).
7. **Zero audited rows**: `## Source` present, all rows deferred → `ok === true` (BASELINE_MANIFEST_MISSING
   owns that case at PASS; AC-5 independence).
8. **AC-4 dormancy — non-fetch mode**: mode `image`/`pdf`/`paper`/`no-design`, even with a
   non-compliant audited row → `ok === true`.
9. **AC-4 dormancy — no design file** and **no `## Source` section** → `ok === true`.
10. **AC-6 resume safety (arm condition)**: assert the orchestrator arm requires
    `prevTuple.agent === "pm"` — a non-pm predecessor (architect/sr self-loop) is never gated,
    regardless of manifest contents (assert the arm condition, as `cut-approval`/`external-refs`
    tests do for their pm-pinning).
11. **AC-7 storage-agnostic**: assert the gate block has NO `instanceof FileHandoffStorage` guard
    (composition assertion against `dist/tools/handoff-orchestrator.js`) — contrast with the
    cut-approval/external-refs blocks which do. Optionally exercise the predicate directly (it
    reads a file, not storage).
12. **Parser — `credibility` column added to `BaselineManifestRow`**: parseBaselineManifestRows
    populates `credibility` (normalized) from a header-bearing table; `""` when the column is absent.
13. **AC-8 hint verbatim (S02)**: assert `dist/gates/registry.js` contains the S02 static suffix
    verbatim and `dist/tools/handoff-orchestrator.js` contains the `SOURCE_CREDIBILITY_UNVERIFIED`
    code + the dynamic prefix `Source-credibility attestation missing or unverified for:`.
14. **AC-9 coordinator stop-condition**: compose `skill-coordinator.md` via `composeSkill`
    (as `cut-approval-gate.test.mjs` C4 does) and assert it references the gate + `credibility`
    + `SOURCE_CREDIBILITY_UNVERIFIED`.

### C. Test-impact awareness (no action expected, but verify green)
- `test/baseline-manifest-gate.test.mjs`: adding `credibility` to `BaselineManifestRow` is
  non-breaking (its assertions read individual fields / compare two parser calls, not a full-row
  literal). Confirm it still passes.

### D. AC-10 build gate (T-E4-05 closing)
`npm run build && npm audit --audit-level=high && npm test` all exit 0.

---

## Open Questions

None. PM's four Dependencies decision points are all resolved above
(DR-1 parser placement, DR-4 insertion point + storage mode, DR-3 transitions.ts union member,
DR-2 fetch-based inclusion list). No unresolved design question blocks hand-off to sr-engineer.
