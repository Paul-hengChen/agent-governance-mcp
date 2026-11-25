# Review — T-E419-01

Feature: e419-retire-bookkeeping-stamp. Diff judged: `c29f100..HEAD` (commit 27e1f21 for this task). Spec: `specs/e419-retire-bookkeeping-stamp.md` (no architecture spec; D5).

## Round 1 — APPROVED — by code-reviewer

## Summary
- Retires Stamp-Provenance in source: `gates/stamp-provenance.ts` deleted, its four `dist/gates/stamp-provenance.*` files removed, the `STAMP_PROVENANCE_SUSPECT` union member / doc-map row / `GateDefinition` entry / pipeline step and import removed.
- `tools/drift.ts`: import, `computeStampAdvisory`, the `stampAdvisory` interface field + comment and every report-literal line removed; the `fanoutAdvisory` comment no longer refers to it (D1).
- `tools/registry.ts`: `tw_detect_drift` description drops `stampAdvisory` (with one disclosed wording deviation, judged below).
- Scope matches the spec's removal sites; nothing else behaviour-relevant changed. Verdict: APPROVED.

## AC Completeness
AC6 — implemented — `gates/stamp-provenance.ts` and `dist/gates/stamp-provenance.{js,d.ts,js.map,d.ts.map}` absent; `git grep "stamp-provenance" -- tools gates lib prompts bin scripts index.ts` empty.
AC7 — implemented — pipeline step removed (`tools/handoff-orchestrator.ts`, former lines 241-280). Reviewer probe: seed F, force `2026-01-01T00:00:00.000Z`, same-feature write with `pending_notes[0] = "stamp-remediation: ..."` accepted and the note kept verbatim as `pending_notes[0]`.
AC8 — implemented — `tools/drift.ts` report literals carry no `stampAdvisory`; probe: `"stampAdvisory" in JSON.parse(detectDrift(ws))` is `false` on a hand-written-stamp handoff. Description updated at `tools/registry.ts:989-990`. (Test pins are qa's, T-E419-05.)
AC11 — implemented (this task's share) — the AC11 live-tree grep prints nothing.

## Correctness
No findings.
- Pipeline (from `dist/`): 17 steps, `TRANSITION_VALIDATION > FEATURE_LEASE > SCOPE_DECISION_REQUIRED > ... > MISSING_REVIEW_EVIDENCE`, identical to the base 19-step order with steps 2 and 4 removed; every pipeline code is in `GATE_REGISTRY` (34).
- The removed step was the only reader of `isHandAuthoredStamp` / `hasStampRemediationAudit` in the orchestrator; `FileHandoffStorage` is still used by the remaining steps, so its import stays.
- `detectDrift`'s four early-return report literals and the main literal each lost exactly the one `stampAdvisory` line; `DriftReport` type-checks (build clean).
- Disclosed deviation (a): the description now reads `... tasksIncomplete, fanoutAdvisory, evidenceBackedIds }; details has one line per finding, and fanoutAdvisory is null or a note that never sets driftDetected.` instead of only deleting `stampAdvisory, `. Kept: with one advisory left, the plural "the advisories are" would describe a set that no longer exists; the rewording changes no claim. `test/e441-tool-description-contracts.test.mjs` is red either way and is re-pinned by qa (T-E419-05) to this exact text.

## Quality
No findings. The trimmed `fanoutAdvisory` interface comment (`tools/drift.ts:22-26`) still states WHAT and WHY without the removed cross-reference.

## Architecture
No architecture spec (D5: removal only). Layering unchanged; the gate's shared predicate module and its read-only advisory consumer are removed together, so no orphaned half remains.

## Security
No findings. Removal only; no new input crosses a trust boundary. The relay rule's ban on hand-editing state still stands in content (T-E419-03).

## Performance
No findings. One regex test per write and per drift call removed; no new work.

## Verdict
APPROVED — every Stamp-Provenance removal site in the spec is gone, the pipeline order is otherwise untouched, and deviation (a) is a faithful, minimal wording fix.

Reviewer note: the code-reviewer and sr-engineer are both pinned to opus this round (same-model bias possible); mitigated by running behaviour probes and the full suite independently.
