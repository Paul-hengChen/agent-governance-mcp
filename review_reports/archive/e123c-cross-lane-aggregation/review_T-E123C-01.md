# Review — T-E123C-01

covers: T-E123C-01, T-E123C-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- **Scope.** Uncommitted diff in worktree `<lanes-root>/e123c`: `tools/lane-paths.ts` (new `isBytePrefix`, `resolveFlatLanePaths`, `enumerateLaneSidecarSources`, and `NON_LANE_DIRS`/`HISTORY_BUCKET_RE` exports), `tools/lane-migrate.ts` (the private `startsWith` is replaced by the shared `isBytePrefix`), `tools/gate-stats.ts` + `tools/usage-accounting.ts` (these now read through the enumerator; AC7 moves the write target to the lane), `tools/drift.ts` + `bin/agent-governance-usage-hook.mjs` (read-only lane-then-flat fallback), `tools/registry.ts` (prose), and the rebuilt `dist/`. No `test/` changes: per tasks.md, tests are owned by T-E123C-04.
- **Dedup rule.** It is content-based and never name-based, as the human's amended rule requires. One predicate is shared with the migrator. Every skip carries a `caveats` entry, and the usage path applies the same skip silently. I did not find a way to lose a record. By construction, a copy is skipped only when its bytes physically lead a copy that is counted, so its records are always counted once somewhere.
- **Independent check.** I ran a scratch smoke (dist, outside the repo) on every AC layout. AC1–AC7 all hold, including AC4(b): `_primary` live plus different-content history gives 5. I also ran a flat-only diff of the full report against HEAD's dist. Every count is byte-identical; only `path`, `sources` and the prose caveats differ.
- **Suite.** `npx tsc --noEmit` is clean. `npm test` gives 2383/2397. The 14 failures are exactly the 14 listed in the expected-red manifest, and I verified the classification (see Correctness).
- **Verdict.** APPROVED, with two `recommended` findings and nothing `required`. Two out-of-scope follow-ups are filed as F2-NEW-4 and F2-NEW-5.

## AC Completeness
AC1 — implemented — tools/gate-stats.ts `readJsonlSidecar` loops sources; flat-only report diffed against HEAD dist: every count byte-identical (only `path`/`sources`/prose caveats differ). Test proof pending in T-E123C-04.
AC2 — implemented — tools/lane-paths.ts `enumerateLaneSidecarSources` live loop; smoke: lane-a(3)+lane-b(2) → 5, both lanes in sources.
AC3 — implemented — history bucket loop (`HISTORY_BUCKET_RE`); smoke: live 1 + history/2026-09/lane-c 4 → 5.
AC4 — implemented — history copy skipped only when `isBytePrefix(history, liveByLane.get(lane).bytes)`. Smoke: (a) prefix → 2 plus one "Skipped … mid-move closed-history copy" caveat; (b) `_primary` live 2 + different-content history 3 → 5, no caveat.
AC5 — implemented — smoke: disjoint flat 2 + lane 3 → 5, both in sources.
AC5b — implemented — flat skipped when `isBytePrefix(flat, X)`; smoke: flat 2 ⊑ lane 5 → 5 plus a "half-merged flat sidecar" caveat. `tools/lane-migrate.ts` `planMoves` now calls the same `isBytePrefix` (argument order swapped correctly: `isBytePrefix(srcBytes, destBytes)` ≡ old `startsWith(destBytes, srcBytes)`). Flat is also skipped when a no-trailing-newline file is a prefix, which is correct.
AC6 — implemented — tools/usage-accounting.ts `sumUsageForFeature` iterates the same `enumerateLaneSidecarSources(ws,"usage").sources`; smoke across flat⊑lane, history⊑live, distinct history, `_primary` → 1111 (expected 1111).
AC7 — implemented — `appendUsageRecord` targets `resolveCurrentLanePaths(ws).usagePath`; smoke on a no-.git ws writes `.current/_primary/usage.jsonl`. `usagePath()` is kept unchanged, as the spec requires.
AC8 — implemented — tools/drift.ts `readArtifactVersion` handoff branch: lane path if it exists, else flat; read-only (existsSync/readFileSync only). The KNOWN GAP test now fails in the expected direction (the gap is closed). QA flips it in T-E123C-04.
AC9 — implemented — bin/agent-governance-usage-hook.mjs: `existsSync(laneHandoff) ? laneHandoff : resolveFlatLanePaths(abs).handoffPath`; read-only.
AC10 — implemented — `grep -n "Aggregate .current/telemetry.jsonl" tools/registry.ts` → no match; refine comment at tools/registry.ts:358-362 reworded.
AC11 — partial (by design, owned by T-E123C-04) — the two new importers exist; the CALLERS2 allow-list edit is in `test/` (qa-owned, §2) and listed as expected-red. This is not a sr-side gap, so it is not a finding.
AC12 — partial (by design, owned by T-E123C-04) — 14 reds, all manifested; 12 close when QA lands T-E123C-04. The 2 pre-existing e123b9 AC8 reds (F2-NEW-1) stay red after that, so AC12's "exits 0" needs F2-NEW-1 resolved or a human waiver at QA time. Flagged for QA, not a finding against this diff.

## Correctness
- **(a) Double count and drop.** No drop path exists. A skipped history copy's authority is a live copy, and live copies are never skipped. A skipped flat file's authority is a live copy or a non-skipped history copy (the search runs over `[...live, ...history]` after history filtering). A prefix relation means the skipped copy's records sit literally inside the authority's bytes, so they are counted once. Transitivity holds: flat ⊑ skipped-history ⊑ live implies flat ⊑ live. Callers parse `source.bytes`, the same buffer the dedup decision used, so there is no TOCTOU re-read. That is a good choice. Residual double-count shapes the spec does not cover (history-vs-history of the same lane, one flat file merged into two live lanes by the migrator) are filed as **F2-NEW-5**. They are spec-compliant as written and cannot be reached until a lane-close writer exists.
- **(b1) Deviation: flat is checked against ANY counted lane copy.** This is not a spec violation. The spec says "the flat file is skipped ONLY when isBytePrefix(flat, lane)" and "flat vs. its lane copy", but never names which lane (the migrator's destination is whatever branch was current at migration time, which the reader cannot know). Widening the authority set cannot drop a record, per the argument above. The only way it can wrongly skip is when an unrelated lane begins with byte-identical records, and that only happens when the flat content really was merged there. It makes AC5b robust to a branch switch or a lane closure. Accepted.
- **(b2) Deviation: `telemetry.path`/`metrics.path` now name the current-lane path, and there is a new `sources`.** No in-repo consumer reads `.path`: I grepped test/, docs/, content/, bin/, and the e26 suite passes unchanged. The addition is additive. It is not a spec violation, since AC1 constrains counts, not `path`. It is a semantic hazard, though: on a flat-only workspace the report now says `exists: true` next to a `path` that does not exist (smoke: `path=.current/_primary/telemetry.jsonl`, `sources=['.current/telemetry.jsonl']`). A consumer that does `if (exists) read(path)` breaks. **`recommended`**: either keep `path` = the first/primary counted source (or null when there are several), or state the "write target, not read source" meaning in the `tw_gate_stats` tool description (tools/registry.ts:932), not only in the TS interface comment (tools/gate-stats.ts:101-106).
- **(c) AC1.** Verified by a full-report JSON diff against HEAD dist on a flat-only fixture, with a malformed line included: `total_fires`, per-code fires, `by_feature`/`by_agent`, `lines_total`/`lines_malformed`, `metrics.features`, `duplicates_skipped` are all identical.
- **(d) usage-accounting.** It uses the identical predicate through the identical enumerator (`enumerateLaneSidecarSources(ws, "usage")`). The skip is silent, as the spec says.
- **(e) drift.ts and the usage hook.** Both fallbacks are pure `existsSync` + read. They take no lock and do no migration or write. `computeGateStats` newly calls `resolveCurrentLanePaths`, which never throws (`resolveCurrentLane` catches everything), so the never-throws posture holds.
- **Expected-red manifest (step 4a).** I checked all 14 entries, not a sample: each is a real, locatable test, and the `npm test` failure list matches the manifest exactly. Classification:
  - The 12 spec-induced reds are honest. The KNOWN GAP test asserts the old throw that AC8 removes. CALLERS2 is the AC11 allow-list. CALLERS3 would go red from AC7's `resolveCurrentLanePaths` call in usage-accounting even without the gate-stats `path` choice. The 9 usage tests read the flat file through `readUsageLines`, test/usage-accounting.test.mjs:57, and AC7 moved the writer.
  - The 2 pre-existing reds are honest too. I reproduced them against a `git archive HEAD` copy, which has HEAD's committed dist and none of this diff: both e123b9 "AC8 Round 1/2" fail there as well. They read the hardcoded `PRIMARY_CURRENT` (test/e123b9-lane-flip.test.mjs:80), which b7a566f migrated.
- **Empty files.** The spec permits skipping empty candidates. The implementation never skips them. Counts are identical either way, and no noise caveat is produced. Fine.

## Quality
- No finding on `noDataCaveat` (tools/gate-stats.ts): it names both the flat and current-lane paths plus the glob shapes. The `path` point under Correctness is the only report-shape concern.
- **`optional`**: `NON_LANE_DIRS`/`HISTORY_BUCKET_RE` are now exported from lane-paths.ts, but `tools/lane-registry.ts` keeps private copies. That file is outside F2's file set, so the duplication is already filed as F2-NEW-2. It is noted here only because the spec says "reused (not reimplemented)". The sr did reuse the helper for the new code and disclosed the leftover copies.
- Comments are accurate and cite the spec. The `laneFile()` "test-only" comment was updated, as Implementation Notes asked. The deleted `startsWith` left a pointer comment, which is fine.

## Architecture
- No `specs/e123c-cross-lane-aggregation-architecture.md` exists. The work matches the spec's Implementation Notes: one shared enumerator in `tools/lane-paths.ts`, and gate-stats and usage-accounting consume it without re-walking directories.
- The import direction is lane-migrate → lane-paths, so there is no cycle. lane-paths still imports only `fs`/`path`.
- Scope is intra-workspace only, with no git subprocess (Design §Scope). Good.

## Security
- There is no new trust boundary. Directory names from `readdirSync` are filtered by `isSafeLaneName`, which excludes dot-dirs and multi-segment names, and by `HISTORY_BUCKET_RE`, so a crafted `.current/..`-style entry cannot redirect a read. `statSync().isFile()` excludes FIFOs and devices, so a FIFO named `telemetry.jsonl` cannot hang the reader. Symlinked lane dirs are not followed: `Dirent.isDirectory()` is false for a symlink, so it is skipped. No secrets are involved and nothing is written.

## Performance
- Each call now reads every lane copy fully into memory and parses it. Before, it read one file. That is linear in total sidecar bytes. The flat-authority search is one `Buffer.equals` per counted copy, bounded by the flat file's length. `sumUsageForFeature` runs on the coordinator's brake path, but only once per check. There is no complexity-class regression. Unbounded sidecar growth was already an accepted caveat (docs/gate-retro-procedure.md "Unbounded growth").

## Verdict
APPROVED. All twelve ACs are implemented or correctly deferred to qa-owned T-E123C-04. The content-based dedup can never drop a record. Both sr deviations are spec-compatible, and the report `path` semantics get a `recommended` finding, not a blocking one.
