<!-- @pm | feature_id: qa-visual-pixel-gate-attestation | created_at: 2026-06-25 -->

# Spec: qa-visual-pixel-gate-attestation

## Problem Statement

The F2 set-date-panel post-mortem (`research/104445-F2-qa-visual-false-pass-postmortem.md`) surfaced a
structural false-pass: when `comparePngRegion` detected `dimensionsMatch=false` (baseline exported @1×,
impl captured @2×), qa-visual issued a "graceful skip" — no pixel diff ran at all — then fell back to 40
DOM structural assertions and still returned `status=PASS`. The structural assertions were orthogonal to
the layout-geometry overflow defect ("selection box clipped"), so the defect slipped through. This is a
false green light: a visual-feature PASS must be impossible without a real, completed pixel gate
execution.

The server already enforces baseline presence (`VISUAL_BASELINES_REQUIRED`), widget shape verification
(`VISUAL_WIDGETS_UNVERIFIED`), structural assertion schema (`VISUAL_ASSERTIONS_REQUIRED` /
`VISUAL_REPORT_INCOMPLETE`), and baseline provenance (`VISUAL_PROVENANCE_MISSING`). The provenance gate
(v3.38.0, `checkVisualProvenance` in `tools/evidence-file.ts`) requires a non-empty `diff-metric:` line
per diffed surface — but it currently accepts ANY non-empty string, including `"N/A"`, `"skipped"`, and
`"dimensionsMatch=false"`. A qa-visual session that skips the pixel diff can write `diff-metric: N/A`
and bypass the gate entirely.

This feature closes that gap by (1) adding a `DIFF_METRIC_PLACEHOLDERS` rejection set so that invalid
metric values are treated as absent, and (2) requiring a positive attestation field
(`pixel_gate_complete: true`) in each non-carry-forward surface's prose sub-section when the visual gate
is armed. The attestation approach is preferred over keyword-blacklisting review text (R4), because
keyword matching ("future sprint", "skip") is brittle and gameable; a positive declaration that the
pixel gate ran to completion is unambiguous and machine-verifiable.

## User Stories

- As a coordinator, I want the PASS gate to reject a visual report where the pixel diff was skipped (any
  reason: dimension mismatch, tool error, graceful skip), so that structural assertions alone can never
  produce a visual PASS on a visual-mode feature.
- As a qa-engineer, I want a clear, positive field to declare "pixel gate fully executed" so that the
  path to a valid PASS is unambiguous, not a double-negative avoidance of forbidden strings.
- As a coordinator, I want dimension/scale mismatches to be treated as hard-FAIL evidence (not Allowed
  Difference), so that a mismatched baseline is caught before QA invests in structural assertions.
- As an sr-engineer, I want the extended report schema to be clearly documented so I can write a
  compliant visual report without ambiguity.
- As a system designer, I want the new gate to compose with the existing arm signal
  (`hasDesignModeRequiringVisual`) and fire only on armed (mode != no-design) features, so that
  non-visual workspaces are never affected.

## Acceptance Criteria

### AC-1 — Placeholder diff-metric values rejected (diff-metric placeholder gate)

Given a visual report where a non-carry-forward surface's `### <surface id>` prose sub-section under
`## Region Diff` contains a `diff-metric:` line whose value (lowercased, trimmed) is any member of the
placeholder set `{"n/a", "skipped", "skip", "dimensionsmatch=false", "dimensions mismatch", "todo",
"tbd", "none", "-", ""}`,  
When `tw_update_state(status=PASS, agent_id="qa-engineer")` is called on an armed feature (design mode
!= no-design),  
Then the server MUST reject with `⛔ VISUAL_PROVENANCE_MISSING` citing the offending surface(s) and the
invalid metric value.

### AC-2 — Positive attestation required per diffed surface (pixel-gate-complete gate)

Given a visual report where a non-carry-forward surface's `### <surface id>` prose sub-section under
`## Region Diff` is missing the line `pixel_gate_complete: true`,  
When `tw_update_state(status=PASS, agent_id="qa-engineer")` is called on an armed feature (design mode
!= no-design),  
Then the server MUST reject with `⛔ PIXEL_GATE_ATTESTATION_MISSING` listing the surface(s) that lack
the attestation line.

### AC-3 — Attestation shape: exact literal

The attestation line MUST be parsed with the same permissive label-line regex pattern used for
`baseline:` / `diff-metric:` (optional leading `- ` or `* ` bullet, optional surrounding markdown bold
`**`, case-insensitive label, `:` / `—` / `-` separator). The canonical form is:

```
- pixel_gate_complete: true
```

Any value other than `true` (case-insensitive, trimmed) MUST NOT satisfy AC-2. Absent or `false` blocks
PASS.

### AC-4 — Carry-forward surfaces exempt from attestation

Given a surface row annotated with the literal text `pass (carried forward — git diff confirms source
untouched)` in its prose sub-section (per `skill-qa-visual` Step B0),  
When `tw_update_state(status=PASS)` is called,  
Then the server MUST NOT require `pixel_gate_complete: true` for that surface (carry-forward is proof
the implementation was not retouched; no re-diff needed).

### AC-5 — B1-tool-unavailable fallback: attestation STILL required; diff-metric exempted from numeric

Given a surface row whose prose sub-section contains the literal text `B1 tool unavailable — LLM
fallback` (per `skill-qa-visual` Step B1),  
When `tw_update_state(status=PASS)` is called,  
Then:
- The `diff-metric: B1 tool unavailable — LLM fallback` token MUST satisfy AC-1 (it is an explicit
  non-placeholder value and proves LLM fallback ran to completion — it is NOT in the placeholder set).
- The surface MUST STILL carry `pixel_gate_complete: true` (the LLM-fallback path is a valid execution
  path for the pixel gate, not a skip; the attestation confirms the LLM comparison was completed).

### AC-6 — Dimension/scale mismatch = evidence absent (not Allowed Difference)

Given `comparePngRegion` (or equivalent tool) reports `dimensionsMatch=false` for a surface,  
When qa-visual authors the visual report,  
Then:
- The surface MUST NOT appear with result `pass` or `accepted` in the `## Region Diff` table.
- The report MUST either (a) record result `fail` with a blocking note citing the dimension mismatch, or
  (b) emit the missing-baseline failure mode (`tw_update_state(status=FAIL, pending_notes=["QA: missing
  baseline — dimension mismatch @Nx vs @Nx ..."])`).
- The server enforces this via AC-1: `diff-metric: dimensionsMatch=false` is in the placeholder set and
  will be rejected if the surface nonetheless claims `pass`/`accepted`.

(This AC is a consequence of the merged R1+R4 gate — R2 and R3 from the postmortem are subsumed here:
the placeholder set makes it impossible to accept a skipped comparison as a passing Allowed Difference.)

### AC-7 — Gate is dormant for no-design / non-armed workspaces

Given `design/<feature>.md` is absent or declares `## Mode: no-design`,  
When `tw_update_state(status=PASS)` is called,  
Then the `PIXEL_GATE_ATTESTATION_MISSING` gate and the placeholder-metric gate (AC-1 extension) MUST
NOT fire.

### AC-8 — Opt-in: pre-attestation reports stay non-broken (backwards compatibility)

Given an armed feature whose existing `qa_reports/visual_<id>.md` was written before this feature
shipped (no `pixel_gate_complete:` lines anywhere),  
When `tw_update_state(status=PASS)` is called on a DIFFERENT (newly started) feature (i.e. the old
report belongs to an already-closed feature),  
Then the gate has no effect on closed features (it fires only on the active feature's reports).

For features whose PASS has NOT yet been recorded (still open), the gate is NOT opt-in — it fires
immediately on the next PASS attempt. The architect MAY choose a transition-period grace mode
(flag in `.current/.config.json`) if migration cost is high; that decision is deferred to the
architecture phase.

### AC-9 — Error messages are actionable

Given the server rejects with `⛔ PIXEL_GATE_ATTESTATION_MISSING` or rejects via `⛔ VISUAL_PROVENANCE_MISSING` due to placeholder metric,  
Then the error message MUST name:
- The offending task id(s).
- The offending surface id(s).
- Which condition failed (placeholder metric vs missing attestation).
- The exact line the agent must add to fix it.

### AC-10 — Pure parser (no I/O, no side effects)

The new parser function(s) (e.g. `parsePixelGateAttestation`, `isPlaceholderDiffMetric`) MUST be pure
(no filesystem reads, no throws). The composition helper (`checkPixelGateAttestation`) mirrors
`checkVisualProvenance`: it accepts `workspacePath` + `taskIds`, reads files, and returns a typed result
object. Tests MUST NOT require filesystem mocking at the parser level.

### AC-11 — skill-qa-visual.md updated with attestation requirement

Given the new gate is shipped,  
Then `content/skill-qa-visual.md` MUST be updated so that:
- Step B1 (Deterministic Pixel-Diff) and Step B2 (LLM Region Diff) both require qa-visual to write
  `- pixel_gate_complete: true` in each non-carry-forward surface's `### <surface id>` prose
  sub-section after completing the comparison.
- The Report schema section (`### Report schema`) lists `pixel_gate_complete: true` as a required
  per-surface prose field under `## Region Diff`.
- The B1-tool-unavailable path explicitly states that `B1 tool unavailable — LLM fallback` does NOT
  exempt the surface from `pixel_gate_complete: true`; it only exempts the surface from a numeric
  metric.
- Dimension mismatch (`dimensionsMatch=false`) is listed as a failure mode that triggers FAIL (not
  graceful skip) with an instruction to re-export the baseline at the correct scale.

## Copy / Strings

| string id | exact text | source |
|---|---|---|
| PIXEL_GATE_ATTESTATION_MISSING.error | `⛔ PIXEL_GATE_ATTESTATION_MISSING: <task-id> {<surface-id>, ...}. Each non-carry-forward surface in qa_reports/visual_<id>.md must carry '- pixel_gate_complete: true' in its ### <surface id> prose sub-section under ## Region Diff. Carry-forward surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md.` | authored-here — machine-emitted error; follows envelope pattern of existing visual gate errors |
| VISUAL_PROVENANCE_MISSING.placeholder | `⛔ VISUAL_PROVENANCE_MISSING: <task-id> {<surface-id>: invalid diff-metric value "<value>" — placeholder values (N/A, skipped, dimensionsMatch=false, etc.) are not accepted; the pixel gate must have run to completion. Carry-forward surfaces are exempt. See specs/qa-visual-pixel-gate-attestation.md.` | authored-here — extends existing VISUAL_PROVENANCE_MISSING error with placeholder reason |
| pixel_gate_complete.attestation_line | `- pixel_gate_complete: true` | authored-here — canonical form per AC-3 |
| pixel_gate_complete.b1_fallback_note | `B1 tool unavailable — LLM fallback` | `/Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-visual.md` Step B1 (existing token, reused) |

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual UI surface | authored-here — server-side enforcement only |

## Visual Widgets

| widget id | description | source-node |
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

| assertion id | surface | required element/state | source node/token |
|---|---|---|---|
| N/A | — | feature has no visual design surfaces | authored-here — server-behavior-only feature |

## Out of Scope

- **R5 (stale-baseline / visual-contract-change detection)**: the post-mortem §6 R5 recommendation
  (distinguishing "visual contract change" vs "new feature" in baseline selection) is deferred. It
  requires a separate mechanism (design-auditor re-route on stale baseline, baseline age tracking) and is
  an independent concern from the false-pass gate. Track in backlog.
- **Forcing re-export at @2×**: the server does not download or re-export Figma assets. Enforcing
  baseline scale is a qa-visual SOP concern, not a server gate. AC-6 covers the server-side consequence
  (dimension mismatch → invalid diff-metric → blocked PASS), but the re-export step itself is
  skill-text only.
- **Cross-session baseline version control**: out of scope per R5 deferral.
- **Changes to `validateTransition` / `ALLOWED_TRANSITIONS`**: the new gate composes with the existing
  arm signal and fires inside the index.ts PASS handler — no state-machine changes needed.

## Dependencies / Prerequisites

- `tools/evidence-file.ts` — `parseVisualProvenanceRows` and `checkVisualProvenance` are the hook
  points. New parser functions slot in as siblings; `checkVisualProvenance` either calls them or the
  composition helper is a separate exported function called in the same index.ts sub-gate sequence.
- `index.ts` — the new `checkPixelGateAttestation` composition helper is called as the seventh
  visual sub-gate, after the existing sixth sub-gate (`checkBaselineManifest`, v3.40.0). Same guard
  pattern: `if (!attestation.ok) return { content: [...], isError: true }`.
- `content/skill-qa-visual.md` — Step B1, Step B2, Report schema, and Failure modes sections all
  require text updates (AC-11). No schema migration: attestation is a new prose field, not a handoff
  schema field.
- `schema/versions.ts` — bump server version to next minor (e.g. `3.42.0`) in the `ServerVersion`
  constant and `index.ts` `Server()` literal. The `PIXEL_GATE_ATTESTATION_MISSING` error code must be
  added to the `TransitionRejection["error"]` union in `tools/transitions.ts` (handler-side type
  extension only, not produced by `validateTransition`).
- Existing tests: `test/baseline-manifest-gate.test.mjs` AC-9 version assertions will need updating to
  the new version (same note carried from the previous handoff-write-arg-guard PASS).
- No new data-model change, no handoff schema change, no SQLite migration needed.

## Deferred Items

- **R5 — stale-baseline / visual-contract-change gate**: see Out of Scope above.
- **Grace-mode config flag** (AC-8): whether to add a `.current/.config.json` flag for a transition
  period during which pre-attestation reports are warned but not blocked is an architect decision.
  Default for this spec: no grace mode (the gate fires immediately on all open features).
