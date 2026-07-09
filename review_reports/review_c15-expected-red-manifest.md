# Review — c15-expected-red-manifest

covers: T-C15-01, T-C15-02, T-C15-03, T-C15-04, T-C15-05, T-C15-06

## Summary
- Commit `696a95d` (base `3e4578c`) ships the machine-comparable expected-red manifest + `EXPECTED_RED_DIFF_MISSING` gate: 3 skill-file SOP edits, a new `gates/expected-red.ts`, the 21st registry entry, and the orchestrator PASS-site wiring.
- Scope matches `specs/c15-expected-red-manifest.md` AC-1..AC-5 exactly; T-C15-07/08 (tests) are intentionally deferred to qa-engineer and their absence is not a finding.
- Gate is a faithful third member of the evidence-existence family, mirroring `VISUAL_EVIDENCE_MISSING`'s arming polarity (dormant unless the manifest file exists) and reusing the c3 `covers:`/`sliceH2Section` plumbing rather than inventing a parallel index.
- Dogfood check (SOP 4a) passed: `qa_reports/expected-red_c15-expected-red-manifest.txt` exists and all 3 declared entries grep to real tests.
- Verdict: APPROVED.

## Correctness
No blocking findings.
- SOP 4a sampling (all 3 manifest entries, fewer than 3 threshold N/A): `test/context-budget.test.mjs` line 539 ("AC1/AC2: skill-sr-engineer stripped token count meets ≤ 2138 cap"), `test/error-code-contract.test.mjs` line 151 ("GATE_REGISTRY has exactly 20 entries…"), `test/qa-visual-skill-split.test.mjs` line 109 ("byte counts stay within v3.14.0-relaxed budgets…") — each is a real, locatable test string. The manifest is authentic machine data, not prose.
- `gates/expected-red.ts:hasExpectedRedManifest` — arm iff `activeFeature` non-empty AND file exists (`gates/expected-red.ts:66-72`); empty-feature guard present. Correct arming polarity per AC-4.
- `hasExpectedRedDisposition` (`gates/expected-red.ts:83-110`) returns `present:true` only when a candidate file actually contains a `## Expected-Red Diff` H2 via `sliceH2Section`. No false-PASS path exists — the dangerous direction is sound. `checked` set dedups candidate paths so a shared `covers:` file is read at most once.
- Orchestrator wiring (`tools/handoff-orchestrator.ts:500-518`) sits inside the `status==="PASS" && completed_tasks.length>0` block (line 285), so `completed_tasks.join(", ")` and the disposition lookup always receive a non-empty id list.

## Quality
No blocking findings. One non-blocking observation:
- `hasExpectedRedDisposition` performs a *content* check on the direct `review_<id>.md` but only falls back to the `covers:` index on a direct-file *miss* (`gates/expected-red.ts:91-99`) — matching the documented `hasEvidenceInFile` precedent (`gates/qa-review.ts:59-70`). Consequence: if a PASS'd id's direct review file exists but lacks the H2 while a *covering* file carries it, the gate fails closed. This is the safe direction (never a false-PASS, only a conservative false-reject that pushes QA to record the disposition in the direct file), matches the cited precedent's fallback-on-miss structure, and the standard batched flow (H2 in one real review file for a PASS'd id) always passes. Not blocking; noted for future authors.
- Comments, path sanitiser (`.replace(/\.\.+/g, "_")` collapse, `gates/expected-red.ts:38-46`), and naming all match the surrounding `gates/visual.ts` / `gates/qa-review.ts` conventions.

## Architecture
Conforms to the `VISUAL_EVIDENCE_MISSING` precedent the spec requires it to mirror:
- File-mode guard uses `storage instanceof FileHandoffStorage` (`tools/handoff-orchestrator.ts:500`); `storage` is bound to `getActiveStorage()` at line 62, so it is equivalent to the visual/cut-approval guards. SQLite/HTTP mode is correctly skipped (AC-5).
- Registry entry (`gates/registry.ts:190-203`) carries all `GateDefinition` fields (producer `orchestrator`, envelope `plain-text`, arm/trigger/clearing text, `hintStatic` pointing at Phase 0.5); `documentedInProse: true` is honest — the code is backtick-quoted in `content/skill-qa-engineer.md:36`. The 20→21 count comments were updated in lockstep.
- Frozen check-order header comment (`tools/handoff-orchestrator.ts:9-13`) updated to insert "expected-red diff gate" between visual sub-gates and the code-reviewer evidence gate; the physical if-block order matches (expected-red at 487-518, code-reviewer gate at 521+).
- AC-5 verified: `git show --stat` touches no `schema/versions.ts`, no `schema/migrations-*`, no `tools/storage-sqlite.ts`, no `docs/schema-versions.md`. No `tw_update_state` field added.

## Security
No findings. The feature-name path sanitiser mirrors the `gates/visual.ts` v3.14.1 traversal hardening (non-allowed chars → `_`, then collapse `..` runs → `_`), so a hostile `active_feature` cannot produce a traversal-shaped manifest path. No new input crosses a trust boundary un-sanitised; no secrets; `fs` reads are wrapped so errors skip the file rather than throw.

## Performance
No findings. `hasExpectedRedDisposition` iterates `completed_tasks` once, builds the coverage index lazily at most once, and dedups read candidates — no O(n²) or unbatched-I/O regression. Gate is zero-cost when the manifest is absent (single `existsSync`, then short-circuit). No hot-path change.

## Verdict
APPROVED — implementation matches AC-1..AC-5, conforms to the `VISUAL_EVIDENCE_MISSING` gate precedent, is strictly typed (no `any`), dist is consistent with a fresh build, and the one behavioral edge in the `covers:` fallback is fail-closed and consistent with the cited precedent.
