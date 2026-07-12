# Review — T-E8-06 (batched full E8 working-tree diff)

covers: T-E8-06

Base: `main` @ 8baf136 (v3.73.1, handoff schema v11), reviewed against
`specs/e8-success-telemetry-architecture.md` (blueprint, authoritative) refining
`specs/e8-success-telemetry.md` (contract).

## Summary
- Batched review of the uncommitted E8 working tree: schema v11→v12 counter layer
  (transitions/migrations/versions/docs), file-mode persist + accumulate
  (handoff.ts, handoff-orchestrator.ts), release-close emit (NEW tools/metrics.ts +
  orchestrator hook), NEW scripts/summarize-metrics.mjs, docs + release-engineer
  SOP step 11b, and the 47-entry expected-red manifest. dist rebuilt.
- Runtime-verified against compiled dist: totals tick in lock-step with the
  per-cycle FAIL predicates, survive PASS and pm re-entry, reset only on feature
  change; v11→v12 seeds three 0s (`applied [12]`); v13 refuses-loud; legacy v0
  chain lands at v12; legacy 4-arg computeNewRound callers default totals to 0.
- Three recorded deviations all RATIFIED (see Architecture): optional field types
  (forced by DR-1), metrics.ts defensive supersets, summarizer 8th column.
- No test files modified (§2); zero new deps; dist byte-identical to a fresh
  `npm run build`; build green.
- Verdict: **APPROVED**.

## Correctness
No findings.
- **FAIL predicates verbatim (transitions.ts:557-575 vs 517/521/539)** — the three
  `*_total` increment guards are character-for-character copies of the per-cycle
  branches, so totals and cycle counters can never diverge on which event counts.
  Reset base is `feature_changed ? 0 : prev_total` (hop_count's rule), never reset
  on PASS or pm re-entry. Smoke-confirmed: QA FAIL → qa_total 2→3; PASS/pm-reentry
  hold total at 3 while cycle qa_round resets to 0; feature_changed → 0/0/0; visual
  only ticks with the `visual_fail:` token (5 stays 5 without, 5→6 with).
- **Migration v11→v12 (schema/migrations-handoff.ts:144-161)** — seeds all three to
  0 (DR / AC8), additive and lossless. `runMigrations("handoff", {schema_version:11})`
  → `applied [12]`, three 0s materialized; v0 legacy chain lands at v12; a v13 file
  refuses-loud (`on-disk version 13 > server max 12`). CURRENT_VERSIONS.handoff
  bumped 11→12; sqlite stays v2.
- **Parse/serialize (handoff.ts:416-431, 453-455, 1028-1046)** — each total parsed
  with the exact hop_count defensive posture (`Number.isFinite && >=0 ? Math.floor : 0`),
  always materialized into the state object, always serialized (even 0).
- **Heal-write threading (handoff.ts:511-542)** — the fire-and-forget heal write
  converted positional→options-object, faithfully field-for-field (all 11 pre-v12
  args mapped) plus the three totals threaded through. Closes the same
  forward-safety gap the v9 hop_count 12th-arg fix closed; harmless for the v11→v12
  seed (0) but correct for any future v12→v13 heal.
- **Orchestrator threading (handoff-orchestrator.ts:108-116, 750-766, 829-833)** —
  prev totals read `prevState?.x ?? 0`, passed as the three trailing computeNewRound
  args, destructured, and forwarded to `storage.writeState` as `qaRoundsTotal`/etc.

## Quality
No findings. Naming mirrors the hop_count precedent per field
(`qa_rounds_total`/`qaRoundsTotal`/`prev_qa_rounds_total`); comments cite the
governing AC/DR at every site. summarize-metrics.mjs is clean zero-dep ESM:
malformed lines skipped+counted+reported, blank lines not counted as malformed,
`num()` coercion tolerates hand-edited records, exit 0 with a "no metrics yet"
notice on empty/missing/all-malformed input.

## Architecture
No findings; three recorded deviations RATIFIED.
- **(a) Optional field types (`qa_rounds_total?: number`) vs blueprint "always-present,
  never optional" (arch line 28)** — RATIFIED. The blueprint self-contradicts: DR-1
  mandates file-mode-only with `storage-sqlite.ts` untouched, but
  `SqliteHandoffStorage.parse()` (storage-sqlite.ts:395-410) returns a `HandoffState`
  literal that omits all three totals. Required (non-optional) fields would fail that
  object literal's compilation, forcing an edit to storage-sqlite.ts — a direct DR-1
  violation. The engineer correctly resolved the contradiction in favor of DR-1 (an
  explicit Decision Record outranks the Data-Structures prose) by making the *type*
  optional while keeping file-mode *runtime* always-present (parser always
  materializes, serializer always emits). Well-documented at handoff.ts:76-90. hop_count
  can stay required precisely because it IS in the sqlite parse(); the totals cannot.
- **(b) metrics.ts inner try/catch + defensive supersets** — RATIFIED. Inner try/catch
  on package.json degrades `released_version` to null (AC7) rather than losing the
  record; regex-escaped ticket code, `typeof pkg.version === "string"` guard, and
  `mkdirSync(recursive)` are all harmless hardening consistent with the best-effort
  (AC2) discipline. Entire body wrapped in one `try {…} catch {}` — the D3 emit
  precedent verbatim.
- **(c) summarizer 8th column `released_version` vs blueprint's 7-column table
  (arch line 145)** — RATIFIED. Read-only display, additive, aids the retro, and
  consistent with the record schema (AC1 includes `released_version`). No behavioral
  impact.
- Increment site correctly single-sourced in computeNewRound (transitions.ts stays
  pure/fs-free); emit isolated in tools/metrics.ts as a separate module + separate
  `.current/metrics.jsonl` stream (AC6). Fits the blueprint's layering exactly.

## Security
No findings. metrics.ts reads only workspace-local `tasks.md` / `package.json` and
appends to a workspace-local sidecar; the ticket-code regex is escaped before
`RegExp` construction (no injection from `active_feature`). No secrets, no new trust
boundary, no external input. summarizer reads a caller-supplied path with a plain
`readFileSync` (CLI-local, no shell interpolation).

## Performance
No findings. computeNewRound stays O(1) (three added scalar comparisons). The emit
runs once per shipped feature, AFTER `storage.writeState`, and does two small
synchronous reads + one append — off the hot path and gated to the exact
release-close signature. summarizer is one linear pass over the sidecar. No
algorithmic regression vs base.

## Emit-hook safety (AC2) — explicit confirmation
The hook (handoff-orchestrator.ts:880-903) is placed after the state write and the
PASS RAG-GC block, immediately before the final `return`. It fires only when
`storage instanceof FileHandoffStorage && agent_id==="release-engineer" &&
status==="In_Progress" && next_role==="pm"` — the exact E1A terminal marker; no
emit on SQLite, opening writes, or non-closing writes. Argument construction uses
only optional-chaining/`?? 0` reads (cannot throw); `emitFeatureMetrics` wraps its
entire body in try/catch and returns void. No code path can throw past it or block
the already-computed `result`, so the ToolResult is byte-identical with or without
the hook. Totals are read from `prevState` (authoritative — the closing self-loop
carries them unchanged through computeNewRound).

## Expected-red manifest integrity
47 pipe-delimited entries; all 5 sampled (across categories a/b/c) locate to real,
named tests. Every entry is a legitimate schema-bump conflict, none a masked
regression:
- (a) registry-fixture tests pinned to v11 → "missing migration step v11→v12";
- (b) version-literal assertions (CURRENT_VERSIONS===11, "future v12 refuses-loud",
  stamps 11, heal-to-v11) — now stale because v12 is current;
- (c) `computeNewRound` deepEqual return-shape (e.g. visual-round-transitions.test.mjs:172
  asserts a 4-field object; the return now carries 3 additional fields — the call
  still compiles, defaults new params to 0, and the pre-existing return values are
  unchanged, directly confirming legacy callers are behaviorally unaffected).
All await the qa re-baseline (T-E8-07). The reported intermittent flake in
`test/handoff-write-arg-guard.test.mjs` is a subprocess-spawning integration test
NOT in the diff or manifest; the E8 emit hook cannot fire in its scenarios (no
release-engineer terminal-marker signature) and the heal-write conversion is
behaviorally identical fire-and-forget — the flake is NOT attributable to this diff
and is correctly excluded from the deterministic manifest.

## Verdict
APPROVED — the E8 diff implements the blueprint faithfully; all three recorded
deviations are correct and well-justified (deviation (a) is forced by DR-1 and the
blueprint's own internal contradiction); counter, migration, and emit-safety
semantics are runtime-verified; no test files touched, zero new deps, dist matches a
fresh rebuild.
