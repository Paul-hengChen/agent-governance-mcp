# Review — T-D5-05

covers: T-D5-ARCH, T-D5-01, T-D5-02, T-D5-03, T-D5-04, T-D5-05

## Summary
- Final QA gate for the full `d5-server-side-stale-dispatch-detection` diff (T-D5-ARCH, T-D5-01, T-D5-02, T-D5-03), already code-reviewer APPROVED with zero findings in `review_reports/review_T-D5-04.md`.
- Scope per constitution §3: QA owns test coverage/authorship and the PASS/FAIL gate; correctness/architecture review is code-reviewer's job and is not re-litigated here except where it bears on test adequacy. Independently re-read `tools/handoff.ts` (the `dispatched_at` field, `STALE_DISPATCH_THRESHOLD_MIN`, the write-path stamp, and the read-path advisory block), `schema/migrations-handoff.ts` (v9→v10 step), `schema/versions.ts` (`CURRENT_VERSIONS.handoff: 10`), `docs/schema-versions.md`, and `content/skill-coordinator.md` against the spec (AC-1..AC-10) and architecture (DR-1..DR-8) — implementation matches the blueprint verbatim; confirms code-reviewer's findings.
- Authored `test/stale-dispatch-detection.test.mjs` (13 tests, new — T-D5-05 qa-owned deliverable) covering every item in the architecture's Test Plan.
- Re-baselined 8 existing test files for the v9→v10 schema bump and the design-arm token-floor ratchet, per the 33-entry expected-red manifest (4 class blocks): `test/dispatch-pins.test.mjs`, `test/handoff-versioning.test.mjs`, `test/handoff-migration.test.mjs`, `test/schema-versions.test.mjs`, `test/cut-approval-gate.test.mjs`, `test/skill-evolution-v3.11.test.mjs`, `test/drift-skew.test.mjs`, `test/context-budget.test.mjs`.
- Fixed the manifest's cosmetic stale header ("32 reds/three classes" → "33 reds/four classes", flagged by code-reviewer at T-D5-04).

## Expected-Red Diff (Phase 0.5)
Manifest present: `qa_reports/expected-red_d5-server-side-stale-dispatch-detection.txt` (33 entries across 8 files, 4 class blocks, sr-engineer-authored, sampled 4/4 class blocks and confirmed real/locatable by code-reviewer at T-D5-04).

Ran the full suite BEFORE making any test edits: `node --test test/*.test.mjs` → 1153 pass / 33 fail / 1186 tests. Extracted the exact set of 33 failing test names and diffed against the manifest's 33 `file | test name` entries (`comm -23`/`comm -13` on sorted name lists, ignoring file-path grouping since names are unique across the suite).

**Result: 0 unexplained reds, 0 manifest entries not currently red — exact 1:1 match, both directions empty.**

`Phase 0.5: clean (33/33 manifest entries confirmed red, 0 unexplained reds)`.

## Copy / Visual Audit Gates (3a/3b)
- **Copy Audit (3a):** spec's Copy/Strings table declares one string, `stale_dispatch.message` = `` stale in-flight dispatch: {role}, no state write for >{n} min ``. Grepped `tools/handoff.ts:537-539`: the literal template ``` `stale in-flight dispatch: ${state.next_role}, no state write for >${STALE_DISPATCH_THRESHOLD_MIN} min` ``` — verbatim match (interpolation shape substitutes `{role}`→`next_role`, `{n}`→the fixed constant, as the spec's own row permits). Independently confirmed the exact rendered string via `test/stale-dispatch-detection.test.mjs` T4/T4b (`"stale in-flight dispatch: sr-engineer, no state write for >15 min"` / `"...architect..."`). No drift, no coverage gap.
- **Visual Audit (3b):** spec's Visual Tokens/Widgets tables are both explicit `N/A` (server-internal, non-design feature). Nothing to grep/verify. Gate passes trivially.

## Phase 1.5 — Visual Compare
No `design/d5-server-side-stale-dispatch-detection.md` exists (no `design/` directory in the repo at all). `Phase 1.5: skipped (no Visual Baselines declared)`.

## Phase 3 — Tests

### Spec-to-Test map
| AC | Test(s) |
|---|---|
| AC-1 (stamp persisted, server-not-memory) | `stale-dispatch-detection.test.mjs` T1, T1b |
| AC-2 (staleness surfaced on read, not enforced on write) | T4, T4b, T5, T5b, T6 (never blocks/throws) |
| AC-3 (stamp clears/replaces on the dispatched role's write) | T3 |
| AC-4 (detection works from a completely fresh context) | T4, T4b (fixtures hand-written via `fs`, no prior in-process write — models zero transcript/memory) |
| AC-5 (no false positive within the threshold window) | T5 (5min), T5b (exact 15min boundary, strict `>`) |
| AC-6 (feature-scoped: no stale-dispatch bleed) | T7 |
| AC-7 (Crash-Resume Protocol references the signal) | Reviewed directly against `content/skill-coordinator.md` diff (prose-only AC; code-reviewer T-D5-04 confirmed verbatim match to the blueprint's Interface Contracts (a)/(b)/(c) — re-confirmed here by re-reading the diff myself, see Summary) |
| AC-8 (existing next_role/hop_count/round-cap/dispatch_pins/cut_approved/external_refs semantics byte-identical) | The 8 re-baselined pre-existing suites (`dispatch-pins`, `handoff-versioning`, `handoff-migration`, `schema-versions`, `cut-approval-gate`, `skill-evolution-v3.11`, `drift-skew`, `context-budget`) continue to assert their own pre-D5 contracts unmodified — re-baselined ONLY for the version-number/token-floor bump, never a behavior change; verified by reading every diff hunk before applying it |
| AC-9 / DR-5 (SQLite scope explicit + tested) | T9 |
| AC-10 / DR-7 (v9→v10 migration, stamp-only, seeds nothing; forward refuse-loud) | T8, T8b |

### Security smoke tests
Malformed/boundary input: T6 (unparsable `dispatched_at` string, never throws). No auth/permission surface in this feature (server-internal read-time advisory, no new access-control boundary) — none needed. `dispatched_at` is server-derived from `now()`, never client-supplied (confirmed: no new `tw_update_state` arg, no zod-schema change) — no injection vector to test.

### Coverage gate
`tools/handoff.ts`'s new surface (the `dispatched_at` field's parse/write/emit sites, the `STALE_DISPATCH_THRESHOLD_MIN` constant, and the `stale_dispatch` compute block in `readHandoffState`) is covered end-to-end: write-path (T1, T1b, T3, T7), read-path fresh-context (T4, T4b, T5, T5b, T6), migration (T8, T8b), and the SQLite-scope negative-space (T9). No untested branch identified — every `if` in the read-path advisory block (`state.next_role && state.dispatched_at`, `Number.isFinite(stampedMs)`, `elapsedMin > STALE_DISPATCH_THRESHOLD_MIN`) has both a taken and a not-taken test. Estimate ≥80% line coverage on the modified surface.

## Re-baseline detail (33 expected reds, 4 class blocks)
1. **Hardcoded v9 assertions (11 entries)** — `CURRENT_VERSIONS.handoff` literal-9 assertions and `schema_version: 9` regex matches across `dispatch-pins`, `handoff-versioning` (×5), `handoff-migration`, `schema-versions`, `skill-evolution-v3.11`, `cut-approval-gate`, `drift-skew` — all bumped 9→10, comments updated to name `d5-server-side-stale-dispatch-detection`.
2. **"Future v10" fixtures (4 entries)** — `dispatch-pins.test.mjs` M2 and `handoff-migration.test.mjs` AC-10(g) moved their "from-the-future" fixture from `schema_version: 10` to `11` (v10 is now CURRENT, no longer refuses-loud); `handoff-versioning.test.mjs`'s two `> server max 9` regexes (v99/v42 fixtures, values already far above both 9 and 10) updated to `> server max 10` — message-only, no fixture-version change needed since 99/42 exceed either bound.
3. **`_clearRegistryForTests` fixtures (17 entries)** — root cause: `dispatch-pins.test.mjs` M3 and `cut-approval-gate.test.mjs` M1/M2 each call `_clearRegistryForTests()` then manually re-register a migration chain for isolation; before the fix those chains stopped at v8→v9, so every subsequent test in the same file that reads a non-CURRENT raw fixture (and thus actually exercises `runMigrations`) hit `missing migration step handoff v9→v10` — this explains why `M3`/`M4`/`X-malformed-parse`/`P1`-`P5`/`M4-AC-8` show up as collateral reds despite asserting nothing about v9 themselves. Fix: extended each manually-registered chain with the `v9→v10` stamp-only step (`up: (i) => ({ ...i, schema_version: 10 })`, mirroring the real migration); `schema-versions.test.mjs`'s three standalone-registry tests got the same extension. Verified by re-reading every downstream test in each file after the fix — none needed their own edits, confirming the corrupted-shared-registry theory.
4. **Context-budget floor (1 entry)** — re-measured the design-arm `teamwork` bundle myself (not trusted from any handoff note): wrote a one-off script importing the same `composeConstitution`/`stripRationale`/`stripOriginTags` the test uses, got **13298** exactly matching the manifest's prediction (+252 over the prior 13046 floor, 100% skill-coordinator.md-side — the Stale-dispatch detection Escalation Routes row, the Crash-detection pointer clause, the intro rewrite, and the Crash-Resume step 0). Updated the assertion and comment; no other floor in the file references 13046 (grepped project-wide).

## Phase 4 — Run
- `npm run build`: clean, zero errors (`tsc` exit 0), both before and after all edits.
- `npm test` (`node --test test/*.test.mjs`): **1179/1179 pass, 0 fail** (net +13 tests vs. the pre-edit 1166-test baseline — exactly the 13 new `stale-dispatch-detection.test.mjs` tests; the pre-edit 33 fails are now 0).
- `test/stale-dispatch-detection.test.mjs` run in isolation: 13/13 pass, including confirming T9 exercised the real `SqliteHandoffStorage` path (no "(skipped — no better-sqlite3)" suffix — the optional dependency is present in this environment).
- Known pre-existing flake per T-D2-05's disposition (`test/handoff-write-arg-guard.test.mjs` AC-1, IPC-timeout under full-suite load): did not reproduce in the full-suite run above; re-ran in isolation anyway as a belt-and-suspenders check — 14/14 pass.
- CI runnability: `npm test` runs headlessly, zero human interaction, `node --test test/*.test.mjs`.

## Verdict
**PASS.** Implementation matches the spec (AC-1..AC-10) and architecture (DR-1..DR-8) verbatim, confirmed independently of code-reviewer's T-D5-04 approval. All required AC coverage is present in the new `stale-dispatch-detection.test.mjs` (13 tests) plus the 8 correctly re-baselined pre-existing suites. The 33-entry expected-red manifest is fully accounted for with zero unexplained reds. Manifest header cosmetic note fixed. Build is clean; full suite is green (1179/1179).
## 2026-07-11T09:18:18.429Z — PASS — by qa-engineer

PASS — T-D5-05. Authored test/stale-dispatch-detection.test.mjs (13 tests) covering the architecture Test Plan (AC-1..AC-10, DR-1..DR-8): stamp-on-dispatch === last_updated (T1), no-stamp-without-dispatch (T1b), stamp drop/re-stamp on next write (T3), fresh-context staleness with verbatim message+exact shape (T4/T4b), no false positive at 5min and at the exact 15min boundary (T5/T5b), malformed stamp inert/never-throws (T6), feature-change no-bleed (T7), v9->v10 migration seeds nothing + future-v11 refuse-loud (T8/T8b), SQLite scope explicit (T9, real better-sqlite3 path exercised), sanity (T10). Re-baselined 33 expected reds across 8 files/4 class blocks in qa_reports/expected-red_d5-server-side-stale-dispatch-detection.txt (hardcoded v9->10, future-v10->v11 fixtures, _clearRegistryForTests chains extended with the v9->v10 step, context-budget design-arm floor re-measured myself at 13298 exact). Fixed manifest's stale header (32/three -> 33/four). Phase 0.5 Expected-Red Diff: exact 33/33 match both directions, 0 unexplained. Copy Audit: stale_dispatch.message verbatim to spec. Build clean; npm test 1179/1179 green (net +13 vs pre-edit baseline, the prior 33 fails now 0). Evidence: qa_reports/review_T-D5-05.md (covers T-D5-ARCH..T-D5-05).

