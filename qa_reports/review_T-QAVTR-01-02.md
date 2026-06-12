# QA Review — T-QAVTR-01 / T-QAVTR-02

Feature: qa-visual-token-reduction
Tasks: T-QAVTR-01 (B10 — delta-only re-diff), T-QAVTR-02 (B11 — deterministic pixel-diff first stage)
QA engineer: qa-engineer (claude-sonnet-4-6)
Date: 2026-06-12

## Phase 1 — Copy / Strings Audit

Spec `## Copy / Strings` table: 4 entries.

| string id | spec text | file location | result |
|---|---|---|---|
| step-b-tool-first-header | `#### Step B1 — Deterministic Pixel-Diff (tool-first gate)` | skill-qa-visual.md line 87 | pass |
| step-b-llm-header | `#### Step B2 — LLM Region Diff (escalated surfaces only)` | skill-qa-visual.md line 116 | pass |
| carry-forward-label | `pass (carried forward — git diff confirms source untouched)` | skill-qa-visual.md line 74 | pass |
| whole-frame-ban | `**Whole-frame pixel-percentage is BANNED as a PASS metric**` | skill-qa-visual.md line 49 | pass |

All four strings verified verbatim. No coverage gap (no user-facing strings added outside the spec table).

## Phase 1 — Visual Tokens Audit

Spec `## Visual Tokens` table: `N/A — feature introduces no visual UI tokens`. Verified: no new UI literals in `content/skill-qa-visual.md`. Gate passes trivially.

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared). `design/qa-visual-token-reduction.md` does not exist; mode = no-design. Visual PASS gate not armed.

## AC-to-Test Map (Phase 3)

| AC | Requirement | Verification method | Result |
|---|---|---|---|
| AC-B10-1 | carry-forward gate: round≥2 + prior-pass + git-diff-untouched → no re-read | SOP text confirms `WITHOUT reading its baseline path or impl path` + `git diff` requirement | PASS |
| AC-B10-2 | fallback on ambiguous diff | SOP text: `fall back to a full re-diff` / `round 1` | PASS |
| AC-B10-3 | always re-diff fail/accepted/recaptured | SOP text: `Always re-diff (Step B1/B2)` for `fail` or `accepted` | PASS |
| AC-B10-4 | report completeness: carried-forward surfaces still in table, self-contained | SOP text: `still appear in the … Region Diff table … every round` | PASS |
| AC-B10-5 | no server code change required | `parseRegionDiffFailures` accepts `pass` (any annotation) — confirmed by reviewer; no code changed | PASS |
| AC-B11-1 | tool-first gate before any image load | SOP text: `Before loading ANY image into multimodal context, run a deterministic CLI pixel-diff tool` | PASS |
| AC-B11-2 | at/below threshold → pass without LLM | SOP text: `At or below threshold → record … WITHOUT reading either image` | PASS |
| AC-B11-3 | above threshold → escalate to LLM | SOP text: `Above threshold → escalate the surface to Step B2` | PASS |
| AC-B11-4 | whole-frame-ban preserved + region-scoped | Ban sentence present verbatim at line 49; `compare region` stated; `NOT the full frame` explicit | PASS |
| AC-B11-5 | tool unavailability fallback to B2 LLM | SOP text: `Tool unavailable … fall back to the Step B2 LLM path` | PASS |
| AC-B11-6 | no new CI/wrapper/npm dep at MVP | SOP text: `No wrapper script and no new npm dependency exists at MVP` | PASS |
| AC-INV-1 | whole-frame ban survives both changes | Ban sentence at line 49 untouched after B10 + B11 insertions | PASS |

## Phase 3 — Test Fix

Existing test `test/qa-visual-skill-split.test.mjs` line 128 asserted `skill-qa-visual.md <= 9000 bytes`. The file grew to 14444 bytes after B10 (Step B0) and B11 (Step B1/B2) SOP insertions (~5400 bytes). Cap bumped to `<= 15000` with rationale comment updated to document the v3.36.0 additions and remaining headroom (~556 bytes). No new test files created.

## Phase 4 — Build and Test Run

- `npm run build`: zero TypeScript errors.
- `npm test`: **634/634 pass, 0 fail** (full suite).
- `npm audit --audit-level=high`: zero high or critical vulnerabilities. One moderate in `hono` — below the §6 gate threshold.

## Verdict

PASS. All 11 ACs + AC-INV-1 satisfied. Copy/Strings verbatim match confirmed. No visual gate armed. Test suite green 634/634. Build clean. No high/critical security advisories.
