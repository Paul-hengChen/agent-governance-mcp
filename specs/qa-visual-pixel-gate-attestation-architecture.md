<!-- @architect | feature_id: qa-visual-pixel-gate-attestation | spec: specs/qa-visual-pixel-gate-attestation.md -->

# Architecture: qa-visual-pixel-gate-attestation

Blueprint for the seventh visual sub-gate. Closes the F2 false-pass
(`research/104445-F2-qa-visual-false-pass-postmortem.md` §6 R1/R4): a qa-visual
session that skips the pixel diff currently writes `diff-metric: N/A` (or
`dimensionsMatch=false`) and passes the v3.38.0 provenance gate, which only
checks the line is non-empty. This feature (a) rejects placeholder diff-metric
values, and (b) requires a positive `pixel_gate_complete: true` attestation per
diffed surface when the visual gate is armed.

This is an **enforcement-tightening** change. It is surgical and
backward-compatible: it composes inside the existing armed-visual block in
`index.ts`, reuses the existing pure parser (`parseVisualProvenanceRows`), and is
dormant for any non-armed / no-design / pre-provenance workspace.

## Affected Files

| File | Change | Reason |
|---|---|---|
| `tools/evidence-file.ts` | MODIFY — extend `parseVisualProvenanceRows` (one new field on `VisualProvenanceRow`), add `DIFF_METRIC_PLACEHOLDERS` const + `isPlaceholderDiffMetric()` pure helper, add `parsePixelGateAttestation()` pure helper, add `checkPixelGateAttestation()` fs composition helper, and tighten `checkVisualProvenance` to treat placeholder metrics as absent (AC-1 / AC-6). | New parsers + placeholder rejection. |
| `index.ts` | MODIFY — import the new composition helper; insert the seventh visual sub-gate immediately AFTER the `checkBaselineManifest` block (line 993), inside the same `if (armCheck.required)` arm. Bump `Server()` version literal (line 230). | Wire the gate; version bump. |
| `tools/transitions.ts` | MODIFY — add `"PIXEL_GATE_ATTESTATION_MISSING"` to the `TransitionRejection["error"]` union (handler-side type extension only; NOT produced by `validateTransition`). | Type narrowing + envelope consistency, mirrors `VISUAL_BASELINES_REQUIRED`. |
| `content/skill-qa-visual.md` | MODIFY — Step B1, Step B2, `### Report schema`, Failure modes (AC-11). | Document the attestation requirement. |
| `package.json` | MODIFY — `"version"` bump to match `index.ts` (`scripts/check-version.mjs` asserts equality). | Version parity. |
| `test/pixel-gate-attestation.test.mjs` | CREATE — parser unit tests (pure, no fs mocking — AC-10) + composition-helper fs tests. | Coverage. |
| `test/baseline-manifest-gate.test.mjs` | MODIFY — update AC-9 version assertions to the new version. | Carried-forward note from prior PASS. |

No new data-model change, no handoff schema change, no SQLite migration
(spec *Dependencies / Prerequisites*).

## Version target

Current is `3.40.1` (`package.json` + `index.ts:230`). Bump to **`3.42.0`** (next
minor — new server-enforced gate). `3.41.x` is skipped to match the spec's stated
`3.42.0` example and avoid colliding with any in-flight patch. There is no
`ServerVersion`/`SCHEMA_VERSION` constant in `schema/versions.ts` (those govern
the persisted-artifact `schema_version`, unchanged here); the server version lives
**only** in `package.json` `"version"` and the `index.ts` `Server()` literal — bump
both, `scripts/check-version.mjs` asserts they are equal.

## Data Structures

### `DIFF_METRIC_PLACEHOLDERS` (module-private const, `tools/evidence-file.ts`)

A `Set<string>` of lowercased-trimmed tokens that a `diff-metric:` value must NOT
equal. Members (AC-1, exact set):

```ts
const DIFF_METRIC_PLACEHOLDERS: ReadonlySet<string> = new Set([
  "n/a",
  "skipped",
  "skip",
  "dimensionsmatch=false",
  "dimensions mismatch",
  "todo",
  "tbd",
  "none",
  "-",
  "",
]);
```

Notes:
- The empty string `""` is a member so a bare `diff-metric:` (no value) is rejected
  by the same path. (Today `parseVisualProvenanceRows` already nulls an empty
  `diff-metric`; this keeps the two rejection routes consistent.)
- `"dimensionsmatch=false"` is the **normalized** form: the comparator emits
  `dimensionsMatch=false` (mixed case, no internal spaces); normalization
  (`toLowerCase()` + whitespace handling — see `isPlaceholderDiffMetric`) folds it
  onto this member. `"dimensions mismatch"` covers the human-prose variant.
- The B1-fallback token `B1 tool unavailable — LLM fallback` is deliberately NOT a
  member (AC-5): it normalizes to `"b1 tool unavailable — llm fallback"`, which is
  not in the set, so it passes AC-1. It proves the LLM-fallback path ran to
  completion.

### `VisualProvenanceRow` — extended (`tools/evidence-file.ts`)

Add ONE field to the existing interface (line 568). No field is removed or
renamed (backward-compatible):

```ts
export interface VisualProvenanceRow {
  surfaceId: string;
  fingerprint: string | null;
  diffMetric: string | null;        // UNCHANGED semantics: null if absent/empty.
                                     // Placeholder REJECTION is applied at the
                                     // gate (checkVisualProvenance), not here,
                                     // so the raw value stays visible for hints.
  isCarryForward: boolean;
  isFallback: boolean;
  pixelGateComplete: boolean;        // NEW — true iff a `pixel_gate_complete: true`
                                     // line is present in the prose sub-section
                                     // (value normalizes to exactly "true").
}
```

Rationale for keeping `diffMetric` raw (not null-ing placeholders in the parser):
AC-9 requires the error to name the *invalid metric value* (`invalid diff-metric
value "<value>"`). If the parser nulled placeholders, the gate could no longer
report which value offended. The parser stays a faithful transcription (AC-10
purity); the *gate* applies the placeholder predicate.

### `PixelGateAttestationCheck` (NEW, `tools/evidence-file.ts`)

Result of the new composition helper. Two offense kinds are reported per task so
the error message (AC-9) can name *which condition failed*:

```ts
export interface PixelGateAttestationCheck {
  ok: boolean;
  // task id -> per-surface offense strings, each prefixed with a kind tag so the
  // index.ts handler can render AC-9's "which condition failed".
  //   "placeholder-metric:<surface>: invalid diff-metric value \"<raw>\""
  //   "missing-attestation:<surface>"
  offendingByTaskId: Record<string, string[]>;
}
```

A single combined helper (not two) — both checks share the same parsed rows and
the same exemption logic (carry-forward), so one fs read + one pass is cheaper and
keeps the index.ts wiring to a single guard. The two offense kinds map to two error
codes at render time (see Wiring Point).

## Interface Contracts

All new/changed signatures. Strict TS, no `any`. Pure functions (no fs, no throw)
are explicitly marked (AC-10).

### `isPlaceholderDiffMetric(value: string | null): boolean` — NEW, pure

```ts
// Pure (AC-10). True iff `value` is absent OR normalizes to a member of
// DIFF_METRIC_PLACEHOLDERS. Normalization: lowercase, trim, and collapse internal
// runs of whitespace to a single space (so "dimensions   mismatch" folds onto
// "dimensions mismatch"). null/undefined → true (absent counts as placeholder).
export function isPlaceholderDiffMetric(value: string | null): boolean;
```

Normalization contract (exact, case-insensitive — AC-1):
1. `null` → `true`.
2. `s = value.trim().toLowerCase()`.
3. `s = s.replace(/\s+/g, " ")` — collapse internal whitespace.
4. return `DIFF_METRIC_PLACEHOLDERS.has(s)`.

This is the single source of truth for "is this diff-metric a non-execution
placeholder". Both `checkVisualProvenance` (tightened) and the new
`checkPixelGateAttestation` call it — they do NOT each re-implement the set.

### `parsePixelGateAttestation(body: string): boolean` — NEW, pure

```ts
// Pure (AC-10/AC-3). True iff the prose body contains a `pixel_gate_complete:`
// label-line whose value normalizes (trim+lowercase, markdown-emphasis-stripped)
// to exactly "true". Absent or any other value (false, yes, 1, "") → false.
export function parsePixelGateAttestation(body: string): boolean;
```

Implemented with the SAME permissive label-line regex shape as
`BASELINE_LINE_RE` / `DIFF_METRIC_LINE_RE` (AC-3): optional leading `-`/`*`
bullet, optional surrounding `**` bold, case-insensitive label, `:`/`—`/`-`
separator. The label token is `pixel_gate_complete` (underscores literal). The
captured value is emphasis-stripped (`^[*_]+|[*_]+$`), trimmed, lowercased, and
compared `=== "true"`.

```ts
const PIXEL_GATE_COMPLETE_LINE_RE =
  /^[^\S\n]*(?:[-*][^\S\n]*)?(?:\*\*[^\S\n]*)?pixel_gate_complete(?:[^\S\n]*\*\*)?[^\S\n]*[:—-][^\S\n]*([^\n]+?)[^\S\n]*$/im;
```

(Identical structure to the two existing line regexes at `evidence-file.ts:593-594`;
only the label literal differs. Note the underscores in the label need no escaping
in a regex.)

### `parseVisualProvenanceRows(content: string): VisualProvenanceRow[]` — MODIFIED, pure

Unchanged signature. Inside the per-surface loop (after computing `isCarryForward`
/ `isFallback`, alongside the `fingerprint` / `diffMetric` extraction), add:

```ts
const pixelGateComplete = parsePixelGateAttestation(body);
```

and include `pixelGateComplete` in the pushed row. `diffMetric` extraction is
**unchanged** (raw value preserved per the Data Structures rationale).

### `checkVisualProvenance(...)` — MODIFIED (AC-1 / AC-6), fs

Signature unchanged: `(workspacePath: string, taskIds: string[]) =>
VisualProvenanceCheck`. ONE behavioral change inside the per-row loop: the
diff-metric satisfaction test now treats a placeholder as absent.

Existing (line 686):
```ts
if (row.diffMetric === null && !row.isFallback) {
  offenses.push(`${row.surfaceId}: no diff-metric:`);
}
```
Becomes:
```ts
// AC-1/AC-6 — a placeholder diff-metric (N/A, skipped, dimensionsMatch=false, …)
// counts as absent. The B1-fallback path is still accepted via isFallback (AC-5):
// its token is NOT a placeholder, but isFallback short-circuits regardless.
if (!row.isFallback && isPlaceholderDiffMetric(row.diffMetric)) {
  offenses.push(
    `${row.surfaceId}: invalid diff-metric value "${row.diffMetric ?? ""}"`,
  );
}
```

This makes the placeholder rejection surface under the EXISTING
`VISUAL_PROVENANCE_MISSING` error (AC-1 / AC-9 `VISUAL_PROVENANCE_MISSING.placeholder`
copy string). No new code path in index.ts for AC-1 — it rides the existing
provenance gate. The offense string carries the invalid value for the hint.

> Composition note: `checkVisualProvenance` remains the AC-1 owner; the new
> `checkPixelGateAttestation` owns ONLY AC-2 (the `pixel_gate_complete` line). They
> are two distinct gates with two distinct error codes. This keeps each error
> message single-purpose (AC-9) and avoids re-deriving placeholder state twice.

### `checkPixelGateAttestation(workspacePath: string, taskIds: string[]): PixelGateAttestationCheck` — NEW, fs

```ts
// fs composition helper (mirrors checkVisualProvenance, AC-10). For each task id:
// read qa_reports/visual_<id>.md (skip if absent — existence is enforced upstream
// by hasVisualEvidenceInFile), parse rows, apply the gate. Never throws (fs errors
// → skip that file).
export function checkPixelGateAttestation(
  workspacePath: string,
  taskIds: string[],
): PixelGateAttestationCheck;
```

Per-file algorithm:
1. `rows = parseVisualProvenanceRows(content)`.
2. **Opt-in arm (mirrors `checkVisualProvenance` D2):** if no row has a non-null
   `fingerprint`, the report is legacy / pre-provenance → contribute zero offenses,
   `continue`. (Same dormancy trigger as the provenance gate so the two arm
   identically; this is what makes AC-8 hold — a closed-feature report never on the
   provenance contract is never subjected to the attestation gate either.)
3. For each `row`:
   - `if (row.isCarryForward) continue;` — AC-4 exempt (carry-forward proves source
     untouched; no re-diff, no attestation needed).
   - `if (!row.pixelGateComplete) offenses.push("missing-attestation:" + row.surfaceId);`
   - **AC-5:** `isFallback` rows are NOT exempt — they must STILL carry
     `pixel_gate_complete: true`. So there is no `isFallback` early-continue here.
     (The LLM-fallback path is a valid *execution* of the pixel gate, not a skip.)
4. If `offenses.length > 0`, record under the task id.

`ok = Object.keys(offendingByTaskId).length === 0`.

## Sequence Diagram

The PASS path through the armed-visual block, showing where the seventh sub-gate
composes. (> 2 actors → diagram required.)

```mermaid
sequenceDiagram
    participant QA as qa-engineer
    participant H as tw_update_state handler (index.ts)
    participant EF as evidence-file.ts
    participant FS as qa_reports/visual_<id>.md

    QA->>H: tw_update_state(status=PASS, agent_id=qa-engineer)
    H->>EF: hasDesignModeRequiringVisual(ws, feature)
    EF-->>H: {required, mode}
    alt mode == no-design OR no design file (AC-7)
        H-->>QA: PASS recorded — all visual sub-gates dormant
    else armed (mode != no-design)
        H->>EF: hasVisualBaselinesInDesign / hasVisualEvidenceInFile
        H->>EF: hasUncheckedWidgets / validateVisualReports
        H->>EF: checkVisualProvenance(ws, tasks)
        Note over EF: AC-1/AC-6 — placeholder diff-metric<br/>now treated as absent
        EF-->>H: prov.ok?
        alt !prov.ok
            H-->>QA: ⛔ VISUAL_PROVENANCE_MISSING (placeholder or missing baseline/metric)
        else prov.ok
            H->>EF: checkBaselineManifest(ws, feature)
            EF-->>H: manifest.ok?
            alt !manifest.ok
                H-->>QA: ⛔ BASELINE_MANIFEST_* (sixth gate)
            else manifest.ok
                H->>EF: checkPixelGateAttestation(ws, tasks) [SEVENTH GATE]
                EF->>FS: read each visual_<id>.md
                FS-->>EF: content
                Note over EF: opt-in (>=1 baseline);<br/>carry-forward exempt (AC-4);<br/>B1-fallback STILL requires attestation (AC-5)
                EF-->>H: attestation.ok?
                alt !attestation.ok
                    H-->>QA: ⛔ PIXEL_GATE_ATTESTATION_MISSING (lists surfaces)
                else attestation.ok
                    H-->>QA: PASS recorded
                end
            end
        end
    end
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| AC-1 (placeholder rejection) could be a new gate OR an extension of the v3.38 provenance gate. | Fold AC-1 INTO `checkVisualProvenance` (tighten the existing diff-metric test via `isPlaceholderDiffMetric`); make a SEPARATE seventh gate only for AC-2 (the attestation line). | One error code (`VISUAL_PROVENANCE_MISSING`) covers all diff-metric defects incl. placeholders; `PIXEL_GATE_ATTESTATION_MISSING` is single-purpose. Closes the alternative of two near-identical metric errors. AC-9's two error envelopes are cleanly separated. |
| `diffMetric` could be null-ed in the parser when it is a placeholder. | Keep `diffMetric` RAW in the parser; apply the placeholder predicate only at the gate. | Parser stays a faithful transcription (AC-10 purity, easy to test). The gate can name the offending value in the hint (AC-9). Rejected: null-ing in the parser would lose the value the error must echo. |
| AC-2 + AC-1 could be one combined check or two. | One combined `checkPixelGateAttestation` for AC-2 only; AC-1 stays in `checkVisualProvenance`. The two gates run sequentially in index.ts. | Each fs helper reads the file once for its own concern. Slight double-read (provenance reads, then attestation reads the same files) — acceptable: PASS attempts are infrequent and files are small (same trade-off the existing five gates already accept). Rejected merging into one mega-gate: it would blur the two error codes AC-9 requires. |
| Dormancy trigger for the attestation gate. | Reuse the provenance gate's opt-in arm: dormant unless ≥1 surface declares a real `baseline:` fingerprint. | AC-8 holds for free — a report never on the provenance contract is never attestation-gated, so pre-feature/closed reports stay non-broken. A report WITH baselines but no attestation lines fails immediately (AC-8 "not opt-in for open features"). |
| Grace-mode config flag (AC-8 / Deferred Items — architect's call). | NO grace mode. The gate fires immediately on all armed, provenance-bearing reports. | Matches spec default ("no grace mode"). Migration cost is near-zero: only the single active feature's report needs the line, and qa-visual writes new reports under the updated skill (AC-11). Adding a `.current/.config.json` flag would add a config-read + a silent-warn path for marginal benefit; rejected as over-engineering for a one-line attestation. |
| Where to insert the seventh gate. | Immediately AFTER the `checkBaselineManifest` block (index.ts:993), still INSIDE `if (armCheck.required)` and `if (visualGate.present)`. | Gate placement enforces the arm signal (mirrors how gates 5/6 rely on placement, never re-checking mode). Non-armed / no-design workspaces never reach it → AC-7 holds by construction. Ordering after the cheap structural gates means attestation only runs on an otherwise-clean report. |
| New error code production site. | `PIXEL_GATE_ATTESTATION_MISSING` added to `TransitionRejection["error"]` union but NOT produced by `validateTransition`; emitted only by the index.ts handler. | Mirrors `VISUAL_WIDGETS_UNVERIFIED` / `VISUAL_BASELINES_REQUIRED` / `SCOPE_DECISION_REQUIRED` (all handler-side). No `ALLOWED_TRANSITIONS` / state-machine change (spec Out of Scope). Union extension is for handler-side type narrowing + envelope consistency only. |

## Wiring Point (index.ts) — exact edit

Insert the seventh sub-gate immediately after the `checkBaselineManifest` guard
that ends at **line 993** (`return { content: [{ type: "text" as const, text }],
isError: true };` followed by its closing `}`), and BEFORE the closing `}` of the
`if (armCheck.required)` block at line 994. It must sit inside both
`if (visualGate.present)` and `if (armCheck.required)`.

Add to the import block (`index.ts:57-67`):
```ts
  checkPixelGateAttestation,
```

The inserted block (the AC-2 gate; AC-1 needs NO new block — it rides the modified
`checkVisualProvenance`):

```ts
              // v3.42.0 — Pixel-gate attestation (qa-visual-pixel-gate-attestation,
              // AC-2/AC-5). SEVENTH and LAST visual sub-gate. The v3.38 provenance
              // gate (now tightened by DIFF_METRIC_PLACEHOLDERS, AC-1) confirms each
              // diffed surface carries a REAL baseline + non-placeholder diff-metric;
              // this gate confirms qa-visual POSITIVELY attested the pixel gate ran
              // to completion (`pixel_gate_complete: true`) per surface. Closes the
              // F2 false-pass: a skipped diff can no longer ride structural assertions
              // to PASS. Opt-in (mirrors provenance D2): dormant for reports with no
              // baseline: line anywhere. Carry-forward surfaces are exempt (AC-4);
              // the B1 LLM-fallback path STILL requires the attestation (AC-5).
              const attestation = checkPixelGateAttestation(
                parsed.workspace_path,
                parsed.completed_tasks,
              );
              if (!attestation.ok) {
                const listing = Object.entries(attestation.offendingByTaskId)
                  .map(([taskId, offenses]) => {
                    const surfaces = offenses
                      .map((o) => o.replace(/^missing-attestation:/, ""))
                      .join(", ");
                    return `${taskId} {${surfaces}}`;
                  })
                  .join(" | ");
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `⛔ PIXEL_GATE_ATTESTATION_MISSING: ${listing}. Each non-carry-forward ` +
                      `surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' ` +
                      `in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward ` +
                      `surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md.`,
                  }],
                  isError: true,
                };
              }
```

This matches the `PIXEL_GATE_ATTESTATION_MISSING.error` copy string in the spec's
Copy/Strings table (AC-9). The placeholder-rejection message (AC-1) is the existing
`VISUAL_PROVENANCE_MISSING` error; to satisfy AC-9's "exact line to add" + invalid
value, append the offending value into that error's listing — the modified
`checkVisualProvenance` already puts `invalid diff-metric value "<raw>"` into the
offense string, so the existing `${listing}` interpolation at index.ts:958-960
surfaces it with no further index.ts change.

### Non-visual pass-through proof (AC-7 — surgical / backward-compatible)

The seventh gate lives strictly inside `if (visualGate.present)` →
`if (armCheck.required)`. For a no-design or `## Mode: no-design` workspace,
`hasDesignModeRequiringVisual` returns `{required:false}` and
`hasVisualBaselinesInDesign` returns `{present:false}`, so neither block is entered
and the handler falls straight through to the round-counter computation
(index.ts:1023). No new top-level branch, no change to the non-visual path. A
visual feature whose report predates the provenance contract (no `baseline:` lines)
hits the opt-in `continue` and contributes zero offenses (AC-8).

## skill-qa-visual.md edits (the exact changes sr-engineer makes — AC-11)

(Architect names the edits; sr-engineer authors the prose. These are deliverables
of the implementation tasks, not of this artifact.)

1. **Step B1 (Deterministic Pixel-Diff)** — after recording the numeric
   `diff-metric:`, instruct qa-visual to also write `- pixel_gate_complete: true`
   in the surface's `### <surface id>` prose sub-section.
2. **Step B2 (LLM Region Diff)** — same: after the LLM comparison completes, write
   `- pixel_gate_complete: true`.
3. **B1-tool-unavailable path** — state explicitly that
   `B1 tool unavailable — LLM fallback` exempts the surface from a *numeric*
   diff-metric but does NOT exempt it from `pixel_gate_complete: true` (AC-5).
4. **`### Report schema`** — list `pixel_gate_complete: true` as a REQUIRED
   per-surface prose field under `## Region Diff` (alongside `baseline:` /
   `diff-metric:`); note carry-forward surfaces are exempt.
5. **Failure modes** — add `dimensionsMatch=false` (dimension/scale mismatch) as a
   FAIL trigger (NOT a graceful skip): instruct re-export of the baseline at the
   correct scale, and note the server now rejects `diff-metric: dimensionsMatch=false`
   as a placeholder (AC-6).

## Region Diff prose contract (where the line is parsed — AC-2/AC-3)

The `pixel_gate_complete: true` line is parsed from the **per-surface prose
sub-section** — a `### `..`###### ` heading whose text is the surface id — that
lives under the `## Region Diff` H2, the SAME block from which `parseVisualProvenanceRows`
already extracts `baseline:` and `diff-metric:`. It is NOT parsed from the
`| surface | result |` table rows (those feed `parseRegionDiffFailures`). Canonical
authored shape:

```markdown
## Region Diff

| surface | result |
|---|---|
| checkout-panel | pass |

### checkout-panel
- baseline: a1b2c3d4
- diff-metric: 0.004
- pixel_gate_complete: true
```

The surface-id match between the table and the sub-heading is the qa-visual SOP's
responsibility (not server-enforced); the gate iterates the prose sub-sections that
`parseVisualProvenanceRows` returns.

## Deferred Resources

The PM spec's *Out of Scope* / *Deferred Items* sections record these external
concerns. None require fetching; all are explicitly deferred by PM/user, not
silently dropped.

| Resource | Reason (PM/user-recorded) |
|---|---|
| **R5 — stale-baseline / visual-contract-change gate** (`research/104445-F2-qa-visual-false-pass-postmortem.md` §6 R5) | Explicitly deferred. Distinguishing "visual contract change" vs "new feature" in baseline selection needs a separate mechanism (design-auditor re-route on stale baseline, baseline age tracking). Independent concern from the false-pass gate. Tracked in backlog. |
| **Grace-mode config flag** (`.current/.config.json`) | Architect decision per AC-8 (deferred to this phase). **Resolved: NO grace mode** — see Decision Records. The flag is not built; the gate fires immediately on armed, provenance-bearing reports. |
| **Forcing re-export at @2× / Figma asset re-download** | Out of scope (spec). The server does not download or re-export Figma assets; baseline-scale enforcement is a qa-visual SOP concern. AC-6 covers the server-side consequence (dimension mismatch → placeholder diff-metric → blocked PASS); the re-export step itself is skill-text only (AC-11 item 5). |
| **Cross-session baseline version control** | Out of scope per the R5 deferral. |
| **Changes to `validateTransition` / `ALLOWED_TRANSITIONS`** | Out of scope (spec). The gate composes with the existing arm signal and fires inside the index.ts PASS handler; no state-machine change. Only the `TransitionRejection["error"]` union is extended (handler-side type, not a matrix edge). |

## Open Questions

_None. All AC-8 grace-mode and AC-3 attestation-shape decisions are resolved above._
