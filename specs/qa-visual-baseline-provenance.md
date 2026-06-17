<!-- @pm | feature_id: qa-visual-baseline-provenance | created_at: 2026-06-16 -->

# Spec: qa-visual-baseline-provenance

## Problem Statement

The visual PASS gate is two-layer. The server enforces existence of `qa_reports/visual_<task-id>.md` and validates its required H2 sections (`Widget Shape Verification`, `Canonical State Verification`, `Structural Assertions`, `Region Diff`, `Allowed Differences`, `Verdict`) with all result rows marked pass. However, the server does NOT verify (a) that the baseline image was a real Figma export, nor (b) that a real pixel-diff execution actually ran. The mandate to download a real Figma image (Step B1/B2 in `content/skill-qa-visual.md`) lives only as SOP prose — machine-unverifiable. A qa-visual run can therefore write `pass` rows using token/DOM reasoning without ever diffing a real image, and the server will accept PASS. This is the empty-PASS failure pattern documented in the retrospective (`research/mode-feature-process-retrospective.md` §四 item #1, P4 / AD-MPVF-4). This feature closes the last-mile gap by making baseline provenance and diff execution machine-verifiable at the server PASS gate.

## User Stories

- As a coordinator, I want the PASS gate to reject visual evidence that lacks a baseline source fingerprint, so that a qa-visual session cannot claim PASS without a traceable real Figma export.
- As a coordinator, I want the PASS gate to reject visual evidence that lacks a diff metric value for each diffed surface, so that a qa-visual session cannot claim PASS without proof that a pixel-diff tool or LLM actually compared images.
- As an sr-engineer, I want the report schema to be clearly specified so that I can populate the provenance fields without ambiguity.
- As a qa-engineer, I want carry-forward surfaces and B1-unavailable fallback surfaces to have an explicitly defined treatment, so that legitimate fallback paths are never accidentally blocked by the provenance gate.

## Acceptance Criteria

### AC-1 — Baseline fingerprint required per diffed surface

Given a visual report with `## Region Diff` and the design file declaring `## Mode` != `no-design`,  
When `tw_update_state(status=PASS)` is called,  
Then the server MUST reject with `⛔ VISUAL_PROVENANCE_MISSING` if any surface row that was actively diffed (not carry-forward) lacks a non-empty baseline fingerprint field in its prose sub-section.

### AC-2 — Diff metric required per diffed surface

Given a visual report with at least one surface not marked carry-forward in `## Region Diff`,  
When `tw_update_state(status=PASS)` is called,  
Then the server MUST reject with `⛔ VISUAL_PROVENANCE_MISSING` if any non-carry-forward surface lacks a non-empty diff metric value (numeric pixel count or percentage, or a B1-tool-unavailable note plus an LLM-fallback declaration) in its prose sub-section.

### AC-3 — Carry-forward surfaces exempt from provenance

Given a surface row in `## Region Diff` annotated with the literal text `pass (carried forward — git diff confirms source untouched)` in its prose sub-section (per `skill-qa-visual` Step B0),  
When `tw_update_state(status=PASS)` is called,  
Then the server MUST NOT require a baseline fingerprint or diff metric for that surface.

### AC-4 — B1-tool-unavailable fallback accepted

Given a surface row whose prose sub-section contains the literal text `B1 tool unavailable — LLM fallback` (per `skill-qa-visual` Step B1),  
When `tw_update_state(status=PASS)` is called,  
Then the server MUST accept that surface's provenance record as satisfying AC-2 (the LLM path is a valid executable path, not an evidence gap).

### AC-5 — Backwards compatibility: gate dormant for no-design features

Given `design/<feature>.md` is absent or declares `## Mode: no-design`,  
When `tw_update_state(status=PASS)` is called,  
Then the provenance gate MUST NOT fire (gate dormant, same arm signal as the existing visual-gate stack).

### AC-6 — Backwards compatibility: pre-provenance reports

Given `design/<feature>.md` arms the visual gate (mode != no-design) but the `## Region Diff` section contains NO per-surface prose sub-sections at all (a legacy report written before this feature),  
When `tw_update_state(status=PASS)` is called,  
Then the server behavior for backwards compatibility is: **DEFERRED — pending architect's decision** on the opt-in gate trigger (see Deferred/Decisions below).

### AC-7 — Report schema extended: fingerprint + metric fields in prose sub-sections

Given `skill-qa-visual.md` Step B1/B2 are updated with the new required prose fields,  
Then each non-carry-forward surface's prose sub-section in `## Region Diff` MUST include:
- A `baseline:` line (fingerprint value — see Deferred/Decisions for form).
- A `diff-metric:` line (numeric tool output, or `B1 tool unavailable — LLM fallback` for the fallback path).

### AC-8 — Error code naming consistency

Given the server rejects PASS due to missing provenance,  
Then the error code MUST be exactly `VISUAL_PROVENANCE_MISSING`, consistent with the existing error-code naming convention (`VISUAL_EVIDENCE_MISSING`, `VISUAL_WIDGETS_UNVERIFIED`, `VISUAL_REPORT_INCOMPLETE`, `VISUAL_BASELINES_REQUIRED`, `VISUAL_ASSERTIONS_REQUIRED`).

### AC-9 — Parser is a pure function

Given any string content of a visual report,  
When `parseVisualProvenanceRows(content)` is called (new function in `tools/evidence-file.ts`),  
Then it returns a structured list of `{ surfaceId, fingerprint, diffMetric, isCarryForward, isFallback }` with no I/O side effects, following the existing parser pattern (`parseVisualWidgetsChecklist`, `parseAssertionFailures`).

### AC-10 — schema_version bump

Given a handoff file at schema_version 4,  
When the provenance gate is active (a no-op migration),  
Then handoff files are parsed correctly at schema_version 5 (or the architect decides no handoff schema change is needed — see Deferred/Decisions).

## Copy / Strings

| string id | exact text | source |
|---|---|---|
| `err.provenance_missing` | `⛔ VISUAL_PROVENANCE_MISSING: <listing>. Each diffed surface in qa_reports/visual_<id>.md must carry a baseline: fingerprint and a diff-metric: value in its prose sub-section under ## Region Diff. Carry-forward surfaces (annotated "pass (carried forward — git diff confirms source untouched)") are exempt. See specs/qa-visual-baseline-provenance.md.` | authored-here — follows VISUAL_EVIDENCE_MISSING / VISUAL_REPORT_INCOMPLETE error-string pattern |
| `sop.baseline_field` | `baseline: <fingerprint>` | authored-here — report prose-field label for machine parsing |
| `sop.diff_metric_field` | `diff-metric: <value>` | authored-here — report prose-field label for machine parsing |
| `sop.b1_unavailable_token` | `B1 tool unavailable — LLM fallback` | authored-here — existing SOP token from skill-qa-visual Step B1 (verbatim match required for AC-4) |
| `sop.carry_forward_token` | `pass (carried forward — git diff confirms source untouched)` | authored-here — existing SOP token from skill-qa-visual Step B0 (verbatim match required for AC-3) |

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual token changes | authored-here — server-side TS feature, no UI |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets | authored-here — server-side TS feature, no UI |

## Visual Structural Assertions

_Not applicable: this feature's `design/<feature>.md` declares `mode: no-design`. No visual structural assertions required._

## Out of Scope

- Does NOT verify that the baseline content hash actually matches any specific Figma node's true pixel output (the server cannot reach Figma; it validates proof-of-execution, not proof-of-correctness).
- Does NOT retroactively invalidate visual reports written before this feature (backwards-compat gate per AC-5/AC-6 plus architect's opt-in decision).
- Does NOT change the `visual_round` counter semantics or the round-cap.
- Does NOT alter the B1/B2/B0 SOP execution order; it only adds two required provenance fields to the output report.
- Does NOT add any new npm dependencies; parser uses only regex over strings.
- Does NOT validate that a content-hash actually corresponds to a real file on disk (the server is not the agent's filesystem arbiter).

## Deferred / Decisions

The following decisions are flagged for the **architect** and MUST be resolved before coding begins. Do NOT resolve these unilaterally.

### D1 — Fingerprint form: content-hash vs Figma node-id vs both

The problem statement describes two candidate fingerprint forms:

- **(a) File content hash**: SHA-256 (or shorter) of the downloaded baseline image file. Machine-verifiable in the sense that the agent must have a real file to hash. Does not require Figma API access at PASS time. Downside: a qa-engineer could hash any file (even a blank PNG) and satisfy the gate structurally.
- **(b) Figma node id**: the literal node id used in `mcp__figma__download_figma_images`. Proves the agent invoked the Figma MCP with a specific node, not just described a diff. Does not require hashing. Downside: node ids appear in design docs and could be copied without actually running the download.
- **(c) Both**: strongest proof-of-execution claim; requires the agent to supply both. Highest operator burden.

The architect must pick one form (or "both") and specify the exact regex/parse contract the server uses to validate non-emptiness. The parse must be permissive (any non-empty, non-whitespace string) to avoid locking in a specific hash algorithm, while being strict enough to block a blank value.

### D2 — Backwards-compatibility gate opt-in signal (AC-6)

Two options for handling legacy reports (pre-provenance visual reports from before this feature):

- **(a) Version-gated opt-in**: new gate fires only when `design/<feature>.md` contains a new marker line (e.g. `provenance: required` in the frontmatter). Existing designs without the marker pass through. Adds a new design-auditor emit step.
- **(b) Schema-version-gated**: gate fires only for reports in workspaces where the server version is >= 3.38 AND the visual report was written after the feature ships (detect by presence/absence of `baseline:` field in any prose sub-section). A report with zero prose sub-sections never fires. Presence of at least one `baseline:` line in any surface sub-section opts the whole report into strict mode.
- **(c) Unconditional (no opt-in)**: gate fires for all armed workspaces. Legacy reports that have `## Region Diff` rows but no prose sub-sections with `baseline:` / `diff-metric:` lines would fail. This is the simplest but requires all active workspaces to have provenance-compliant reports immediately on rollout.

The architect must choose the opt-in strategy. Note: option (c) risks breaking in-flight QA rounds in managed workspaces that already have partial visual reports. Option (b) is the low-disruption default, consistent with the existing `designDeclaresStructuralAssertions` opt-in pattern at v3.26.

### D3 — schema_version bump decision

The provenance parser reads only the visual report file (`qa_reports/visual_<task-id>.md`) — it does NOT add any new fields to `handoff.md`. If the architect confirms the handoff schema is unchanged, the `handoff` schema_version stays at 4 and no migration is needed. If any new handoff field is introduced (e.g. `provenance_mode: strict`), a v4 → v5 migration is required per `docs/schema-versions.md`. The architect must confirm whether a bump is needed.

### D4 — B1-unavailable + carry-forward interaction with a hard gate

The spec requires AC-3 (carry-forward exempt) and AC-4 (B1-unavailable fallback accepted). However if the architect chooses a hard gate with NO carry-forward exemption (for example, because they prefer every surface to carry a fingerprint even when carried forward from a prior round), the SOP must be updated accordingly. The default recommendation is to exempt carry-forward surfaces (they were already proven in a prior round) but the architect should confirm.

## Dependencies / Prerequisites

- **Prior active feature**: `qa-visual-token-reduction` — PASS. No open tasks.
- **No design file**: this is a `no-design` feature (server-side TS, no Figma source).
- **scope_decision**: `single-feature` — the change is surgical: `tools/evidence-file.ts` (parser), `content/skill-qa-visual.md` (SOP + report schema text), `test/` (new parser tests), optionally `schema/` (migration if D3 requires a bump). Well within 5-file/300-line bound per task.
- **Blocked on D1/D2/D3/D4**: architect must resolve the four deferred decisions before sr-engineer coding begins.
- **Existing error-code set**: `VISUAL_EVIDENCE_MISSING`, `VISUAL_WIDGETS_UNVERIFIED`, `VISUAL_REPORT_INCOMPLETE`, `VISUAL_BASELINES_REQUIRED`, `VISUAL_ASSERTIONS_REQUIRED` — new code `VISUAL_PROVENANCE_MISSING` must be consistent with this set.
- **Arming signal reuse**: the provenance gate uses the same `hasDesignModeRequiringVisual()` arm signal already imported in `index.ts` — no new design-file scanner needed.
- **Deferred-surface gate**: no design-auditor source manifest involved (no-design feature); gate not applicable.
