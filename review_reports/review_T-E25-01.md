# Review — e-p3-tail-batch (batched)

covers: T-E25-01, T-E27-01, T-E28-01, T-E29-01, T-E30-01, T-RELSOP-01

## Summary
- Six-item P3 tail batch, single review round: E25 (const §6 git vocabulary), E27 (docs/arming.md + config.md cross-link), E28 (tools/handoff-orchestrator.ts shrink warning), E29 (tools/handoff.ts stale_dispatch Crash-Resume pointer), E30 (skill-qa-visual actual-capture convention), T-RELSOP-01 (skill-release-engineer bump-build path). One server-code file (E28), one server-code line (E29); rest is content/docs.
- Suite: 1570/1587 pass; the 17 reds match `qa_reports/expected-red_e-p3-tail-batch.txt` EXACTLY (11 compose-equivalence goldens + 4 context-budget caps + 2 stale-dispatch verbatim-message pins) — zero unexpected reds. `tsc --noEmit` exit 0; `check-version` OK; dist parity confirmed for E28/E29.
- All E27 doc claims verified against code (files, config keys, README hook section, config.md anchors). E25 introduces no contradiction with existing const/skill git-op text.
- Verdict: APPROVED.

## Correctness
- E28 (handoff-orchestrator.ts:1265-1315): `prevState` (line 109, on-disk pre-write parse) and `feature_changed` (line 127) are correctly in scope and represent on-disk prior state; the `if (prevState && !feature_changed)` guard is right — a feature change legitimately drops both feature-scoped fields, and a fresh workspace (`prevState` null) is inert. A write OMITTING the field (`parsed.dispatch_pins`/`parsed.external_refs` undefined) skips the block entirely and stays silent — correct, since omission triggers the server carry-forward. Envelope: `result` is the writeState JSON success string (`{success,path,updated_at}`); the block JSON.parses it, ADDS a `warnings` key (all original keys preserved), re-stringifies; parse failure leaves the original text. Additive key — no strict-consumer breakage (agc-adapters "no stale warnings" pin at line 238 is about `agc check` adapter versions, unrelated).
- E28 non-blocking observation (NOT a defect vs spec): shrink detection is cardinality-based (`nextSize < prevLength`). A SAME-cardinality swap — e.g. dispatch_pins `{sr, release}` → `{sr, qa}`, or external_refs replacing ref B with ref C — silently drops an entry with no warning. This matches the spec's literal "shrink / FEWER entries" framing, so it is in-scope-correct; flagged only so QA/future work is aware the guard does not catch equal-count drops.
- E29 (handoff.ts:680-693): appended text keeps `message` a string; `StaleDispatchAdvisory.message` type unchanged. Verified the E22 watch-file dedup (stale-notify.ts:110-111) keys on `(dispatched_at, role)` ONLY — never message content — so the longer message cannot break dedup or re-fire watchers. Payload key-shape unchanged (only the `message` value lengthened); the sole consumers pinning verbatim message text are the 2 manifested stale-dispatch tests.
- Expected-red manifest (C15 / SOP 4a): verified against an actual `npm test` run — all 17 named tests are real and locatable (sampled monolith-invariant, AC2-lean, T4, T4b by grepping the named files). Zero test files in the diff (§2 clean — QA re-baselines).

## Quality
- E25 const-15 edit preserves the single `- **...**:` bullet structure; inline `(... E25)` and `(D10, generalized)` refs are plain prose, consistent with the existing D10 reference and NOT origin-tag HTML comments — stripOriginTags pass unaffected.
- T-RELSOP-01: step 5 now reads "run `npm run build`" then "npm run build deadlocks … run `npx tsc` instead" — mildly self-contradictory phrasing but intent (post-bump exception) is clear; readability nit only.
- E30: H3 subsection placed sensibly before Step B; prose-only.

## Architecture
- No architecture spec for this batch. E28 sits correctly at the post-writeState advisory seam (after all gates, alongside the E8 metrics hook), warn-only, no new arg, no schema bump — consistent with the file-mode advisory posture. E29 stays inside the existing read-time stale-dispatch computation. No layering violation.

## Security
- No findings. No new trust boundary crossed. E28 reads only server-held prevState + client-supplied fields already validated by zod; warning strings interpolate role/ref names into an advisory, not into any executable context. No secrets, no injection surface.

## Performance
- No findings. E28 is O(keys)+O(refs) set-diff on tiny maps, once per write; E29 is a constant-length string concat on the read path. No hot-path or complexity regression vs base.

## Verdict
APPROVED — all six items match spec; 17 reds fully accounted for against an actual run; zero blocking findings. One non-blocking E28 observation (equal-cardinality swap not warned) recorded for QA awareness.
