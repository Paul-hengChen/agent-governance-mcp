# Review — T-PGAT-02 / T-PGAT-03 / T-PGAT-04 (qa-visual-pixel-gate-attestation, v3.42.0)

## Round 1 — APPROVED — by code-reviewer

## Summary

- Tightens the visual PASS gate so a visual-feature PASS requires (a) a real numeric diff-metric (placeholders rejected) AND (b) an explicit `pixel_gate_complete: true` attestation per non-carry-forward surface.
- AC-1 folds into the existing `checkVisualProvenance` gate (`VISUAL_PROVENANCE_MISSING`); AC-2 is a new, single-purpose SEVENTH sub-gate (`checkPixelGateAttestation` → `PIXEL_GATE_ATTESTATION_MISSING`) wired inside `if(armCheck.required)` after `checkBaselineManifest`.
- Implementation matches the architecture blueprint edge-for-edge: pure parsers (`isPlaceholderDiffMetric`, `parsePixelGateAttestation`), raw-`diffMetric` preservation for AC-9 hints, opt-in dormancy via the ≥1-fingerprint trigger, carry-forward exempt (AC-4), B1-LLM-fallback NOT exempt (AC-5).
- Verified empirically: 31/31 canonical parser cases pass; both gates fire correctly on a synthetic report; AC-4/AC-5/AC-7/AC-8 paths behave as specified; `npm run build` clean (strict tsc); no `any`; version parity 3.42.0.
- Headline verdict: **APPROVED**. The false-PASS vectors from the F2 post-mortem are closed; no regression on non-visual/no-design workspaces.

## Correctness

All adversarial concerns from the review brief were empirically discharged.

- **Placeholder set completeness (AC-1)** — `tools/evidence-file.ts:599-611` matches the architecture set exactly: `{n/a, skipped, skip, dimensionsmatch=false, dimensions mismatch, todo, tbd, none, -, ""}`. Verified `N/A`, `skipped`, `SKIP`, `dimensionsMatch=false`, `dimensions   mismatch` (collapsed), `""`, `-`, `TODO`, whitespace-only all → placeholder; `0.004` and the B1-fallback token → NOT placeholder (AC-5 ✓).
- **Normalization gap (case/whitespace)** — `isPlaceholderDiffMetric` (`evidence-file.ts:629-633`) does `trim().toLowerCase().replace(/\s+/g," ")` before set lookup. Case and internal-whitespace variants fold correctly. `parsePixelGateAttestation` (`evidence-file.ts:638-643`) emphasis-strips + trims + lowercases the captured value and compares `=== "true"` — `true`, `TRUE`, `True`, `**true**`, trailing-ws all accepted; `false`, `yes`, `1`, bare `pixel_gate_complete:`, `true (done)` all rejected.
- **Regex matches prose, not table rows** — `parseVisualProvenanceRows` (`evidence-file.ts:650-699`) slices the `## Region Diff` H2, then slices each per-surface body between `###`..`######` sub-headings. `parsePixelGateAttestation(body)` runs on the per-surface body slice only. The `| surface | result |` table sits above the first sub-heading, so it is never in scope. No cross-surface bleed (body ends at the next sub-heading). Confirmed via integration test (panel-c missing-attestation isolated correctly).
- **Carry-forward over-broad? No (AC-4)** — `checkPixelGateAttestation` (`evidence-file.ts:783`) `continue`s only on `row.isCarryForward`, which is set iff the body contains the exact literal `CARRY_FORWARD_TOKEN`. Scoped per-surface; cannot leak to sibling surfaces. Verified: cf-surface exempt, fb-surface in the same report still gated.
- **B1-LLM-fallback wrongly exempted? No — the load-bearing AC-5 case** — `checkPixelGateAttestation` has NO `isFallback` early-continue (`evidence-file.ts:784` comment is explicit). Empirically: a fb-surface with `diff-metric: B1 tool unavailable — LLM fallback` but no `pixel_gate_complete: true` → `att.ok=false {missing-attestation:fb-surface}`. With the attestation line added → passes. Exactly AC-5.
- **AC-7 dormancy (non-visual/no-design)** — the gate (`index.ts:1006`) lives strictly inside `if(armCheck.required)` (index.ts:904) nested in the PASS arm. For no-design / `## Mode: no-design`, `armCheck.required` is false and the block is never entered. No new top-level branch; falls through to the round-counter. AC-7 holds by construction. No path reaches the gate with the arm signal false.
- **AC-8 opt-in** — `evidence-file.ts:781` `if (!rows.some(r => r.fingerprint !== null)) continue;` mirrors the provenance gate's D2 arm. Verified: legacy report (no `baseline:` lines) → both gates contribute zero offenses.
- **Regex `lastIndex` state leak? No** — `PIXEL_GATE_COMPLETE_LINE_RE` is `/im` (no `g`); `.exec()` on a non-global regex always starts at index 0. No carried state across surfaces/calls.
- **AC-9 raw diffMetric** — `parseVisualProvenanceRows` keeps `diffMetric` raw (`evidence-file.ts:687-692`, no placeholder null-ing); `checkVisualProvenance` (`evidence-file.ts:740`) emits `invalid diff-metric value "${row.diffMetric ?? ""}"`. Verified the raw `"N/A"` is echoed into the offense string. AC-9 satisfied.

## Quality

- Naming, comments, and gate-numbering ("SEVENTH/LAST") are consistent with the five existing visual sub-gates. Error envelope `{content:[{type:"text",text}], isError:true}` matches the sibling gates verbatim.
- Error/hint copy in `index.ts:1019-1029` matches the spec's `PIXEL_GATE_ATTESTATION_MISSING.error` Copy/Strings row, including the exact remediation line `'- pixel_gate_complete: true'` and the spec reference (AC-9 "exact line to add" ✓).
- The `offendingByTaskId` value strings are tagged `missing-attestation:<surface>` per the architecture's offense-kind contract; the index.ts handler strips the tag for rendering. Minor: `PixelGateAttestationCheck` currently carries only one offense kind (the architecture's two-kind enum collapsed to one since AC-1 rides the provenance gate) — the code comment at `evidence-file.ts:756-758` correctly documents this. Not a defect.
- Skill-qa-visual.md AC-11 edits are accurate and cover all four required spots (Step B1, Step B2, B1-fallback path with explicit AC-5 callout, Report schema = three fields, Failure modes = dimensionsMatch=false hard-FAIL). Consistent with gate behavior.

## Architecture

- Conforms to `specs/qa-visual-pixel-gate-attestation-architecture.md` exactly: AC-1 folded into `checkVisualProvenance` (not a new code path in index.ts), AC-2 a separate combined fs helper, single source of truth for placeholder predicate (`isPlaceholderDiffMetric` called by both gates — no re-implementation), gate inserted after `checkBaselineManifest` (index.ts:996) inside the same arm. Insertion point and arm-nesting match the blueprint's "Wiring Point" and "Non-visual pass-through proof".
- `tools/transitions.ts:75` adds `PIXEL_GATE_ATTESTATION_MISSING` to the `TransitionRejection["error"]` union as a handler-side type extension only; `validateTransition` does not produce it. No `ALLOWED_TRANSITIONS` / state-machine change — matches spec Out of Scope. Mirrors `VISUAL_BASELINES_REQUIRED`.

## Security

- No injection vectors: parsers operate on local report files already gated upstream; no shell/SQL/eval. `checkPixelGateAttestation` is read-only fs with `existsSync` guard and a `try/catch` that skips on read error (never throws — AC-10). No new external input boundary, no secrets.

## Performance

- One extra fs read per task id per PASS attempt (the seventh gate re-reads the same `visual_<id>.md` the provenance gate read). The architecture's Decision Records explicitly accept this double-read (PASS attempts are infrequent, files small) — same trade-off as the existing five gates. No O(n²), no unbatched hot-path loop, no leak. No regression vs base.

## Verdict

**APPROVED** — implementation faithfully realizes the spec and architecture; the false-PASS vectors (placeholder metric, missing attestation, B1-fallback skip) are all empirically closed, and the gate is provably dormant for non-armed/no-design/legacy workspaces.

### Note (non-blocking, for backlog)

`isPlaceholderDiffMetric` does not fold `dimensionsMatch = false` (spaces around `=`) onto the `dimensionsmatch=false` member, so a hand-typed spaced variant would read as a real metric. This is NOT a defect against any AC: the comparator emits the no-space form `dimensionsMatch=false` (covered), and the human-prose variant is covered by the separate `dimensions mismatch` member. Additionally, any such surface would still be blocked by the AC-2 attestation gate unless the agent also fabricates `pixel_gate_complete: true`. Recording only for hardening completeness; no change required for this PASS.
