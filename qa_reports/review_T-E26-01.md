# QA review — T-E26-01 / T-E26-02 / T-E26-03

covers: T-E26-01, T-E26-02, T-E26-03

Feature: `e26-gate-stats` (backlog E26, 104447-F0 §4-D). No `specs/e26-*.md` or
`design/e26-*.md` file exists — this is a content-scoped mini-chain
(sr-engineer → code-reviewer → qa-engineer) with the backlog row itself as
spec, per E10/E17/E18/E20/E23/E24 precedent. Implementation commit: `de180f1`.
Code review: APPROVED (`review_reports/review_T-E26-01.md`, covers all three
ids) — zero blocking findings across correctness/quality/architecture/
security/performance.

Shipped diff: `tools/gate-stats.ts` (new, 413 lines — never-throws
`computeGateStats()` aggregator over `.current/telemetry.jsonl` +
`.current/metrics.jsonl` + the `handleGateStats` MCP handler),
`tools/registry.ts` (one `defineTool` entry, A1 pattern, `WorkspaceOnly`
schema, `index.ts` untouched — registry now 12 tools),
`docs/gate-retro-procedure.md` + `CLAUDE.md` (doc alignment, content-only).

## Expected-Red Diff

Phase 0.5: skipped (no `qa_reports/expected-red_e26-gate-stats.txt` manifest
declared — this feature introduces a new never-throws reader, not a
re-baseline of existing assertions).

## Phase 1 — Review

Read `tools/gate-stats.ts` in full and the `tools/registry.ts` diff,
cross-checked against code-reviewer's APPROVED findings (independently
re-derived, not merely copied):

- **Full 32/32 GATE_REGISTRY coverage holds**: `GATE_REGISTRY.length === 32`
  confirmed directly (`node -e "import('./dist/gates/registry.js')..."`);
  every registry code lands in exactly one of `fired`/`zero_fire`
  (`gate-stats.ts:284-304`), verified with a live fixture asserting
  `fired.length + zero_fire.length === 32` and disjointness of the two code
  sets (test R2).
- **Structural category boundary is real, not prose**: `ProseBehavioralRule.fires`
  is typed as the literal `null` while `GateFireStat.fires` is `number` —
  TypeScript-enforced. Confirmed at runtime that `prose_behavioral` output is
  byte-identical regardless of telemetry content (test P2) and every entry's
  `fires` is strictly `null`, never `0` (test P1).
- **Never-throws holds** across every adversarial input exercised: bad JSON,
  non-object roots (array/string/number/null), blank lines (not malformed),
  well-formed objects missing `error_code` (not malformed, not a fire), and a
  chmod'd unreadable sidecar (sandbox-agnostic assertion, root may bypass) —
  all degrade to honest zero-counts + loud `lines_malformed`/`caveats`
  entries, never a throw (tests M1-M4, D1-D2).
- **Dedupe key collision-safety confirmed directly**: constructed the exact
  adversarial pair the reviewer's note called out —
  `feature="a|b", version=null` vs `feature="a", version="b|null"` — and
  verified `JSON.stringify([feature, version])` keeps them as 2 distinct
  features (test DE3), where a raw `${feature}|${version}` string join would
  have collided them into 1. Also verified `released_version: null` is a
  stable, non-wildcard key (a second null-version emit for the same feature
  still dedupes — test DE2) and an exact duplicate pair collapses with
  `duplicates_skipped` incrementing (test DE1).
- **`one_pass` strict-boolean holds**: `one_pass: "true"` (string) reads as
  `false`, not truthy-coerced (test DE4).
- **Sort order verified**: `fired` is strictly descending by fire count (test
  F2); ties resolve to GATE_REGISTRY catalog order via the sort's stability,
  confirmed by writing the tied codes' telemetry lines in the REVERSE of
  catalog order so an unstable/insertion-order sort would have failed (test
  F3); `zero_fire` is enumerated in catalog order (test R3).
- **`unregistered` bucket isolated correctly**: a made-up error code lands
  only in `unregistered`, never perturbing the 32/32 fired/zero_fire coverage
  invariant (test U1).
- **Registry registration (T-E26-02)**: `TOOL_REGISTRY` has exactly 12
  entries including `tw_gate_stats`, all 11 pre-existing tools still present
  (no accidental drop), `index.ts` untouched — confirmed by direct
  introspection of `dist/tools/registry.js` (`TOOL_REGISTRY.length === 12`).
  `defineTool()` erases the handler reference behind a `run` closure, so
  identity can't be asserted directly against `handleGateStats` — verified
  behavioral equivalence instead (`entry.run()` output deep-equals
  `handleGateStats()` output for the same workspace, test T1/T3).

No new findings beyond code-reviewer's APPROVED verdict; QA's job here is
tests, not a second correctness pass.

## Phase 3 — Tests

Test File Discovery: no pre-existing test file covered this feature; authored
`test/e26-gate-stats.test.mjs` (26 tests) per the per-feature test file
convention (test/e20-e21-crash-resilience.test.mjs,
test/e23-evidence-schema.test.mjs, test/e24-exemptions.test.mjs precedent).

Spec(backlog row)-to-test map:
- Full GATE_REGISTRY coverage (32/32, disjoint, catalog-order zero_fire) →
  R1, R2, R3
- Fired bucketing, sort order (desc + stable-tie), producer sourcing,
  by_feature/by_agent/first_ts/last_ts accumulation → F1, F2, F3, F4, F5
- Unregistered-code bucket, isolated from 32/32 coverage → U1
- Structural prose-behavioral `fires: null` invariant (never 0, content-
  independent) → P1, P2
- Malformed-line / non-object-root / missing-error_code / unreadable-sidecar
  never-throws matrix → M1, M2, M3, M4
- Missing-sidecar degradation (both absent, metrics-only) → D1, D2
- Metrics dedupe on (feature, released_version): exact duplicate, null-version
  stability, raw-string-join collision resistance → DE1, DE2, DE3
- `one_pass` strict-boolean coercion → DE4
- Null-on-zero-features means/rate, populated-otherwise → DE5
- `tw_gate_stats` registry registration + 12-tool count + no dropped prior
  tool + MCP handler shape (incl. bare-workspace never-throws) → T1, T2, T3,
  T3b

Coverage: `tools/gate-stats.ts` is fully covered — every branch of
`readJsonlSidecar` (ENOENT, read-error, parse-error, non-object-root,
blank-line skip), the full-coverage fired/zero_fire/unregistered
partitioning, the prose-behavioral catalog, the metrics dedupe + coercion +
mean/rate computation, and the `handleGateStats` MCP wrapper. The
`tools/registry.ts` `tw_gate_stats` entry is covered by T1/T2/T3.

Security smoke: M1/M3/M4 exercise adversarial/malformed input at the JSONL
trust boundary (bad JSON, wrong types, non-object roots, permission-denied
read) and confirm none throw or corrupt the report; boundary inputs
(empty/absent sidecars, zero-feature aggregates) are covered by D1/D2/DE5.
No auth/permission surface — this is a read-only reporting tool over local
sidecars with no new trust boundary (per code-reviewer's Security finding).

## Phase 4 — Run

- Crash checkpoint written via `tw_update_state(bookkeeping_write=true)`
  before the final regression run (E21).
- Build: `npm run build` (`tsc`) — zero errors.
- `npm test` / `node --test test/*.test.mjs`: **1547/1547 pass** (1521
  pre-existing baseline + 26 new `test/e26-gate-stats.test.mjs` tests), 0
  fail, 0 cancelled, headless, zero human interaction.
- `npm audit --audit-level=high`: exit 0, zero high/critical findings (one
  pre-existing low-severity `esbuild` dev-server advisory, unrelated to this
  feature and below the audit-level threshold).

## Verdict

PASS. Full 32/32 GATE_REGISTRY coverage and the structural gate-backed vs
prose-behavioral category boundary (`fires: null`, never `0`) hold under
direct test exercise; never-throws confirmed across malformed lines,
non-object roots, missing sidecars, and an unreadable file; metrics dedupe on
`(feature, released_version)` is confirmed collision-safe against the exact
adversarial pair the reviewer flagged; `tw_gate_stats` is registered in
`TOOL_REGISTRY` (12 tools, `index.ts` untouched) and dispatches identically to
`handleGateStats`. Full suite 1547/1547 green, `tsc` zero errors, `npm audit
--audit-level=high` clean.
## 2026-07-16T06:10:23.390Z — PASS — by qa-engineer

PASS. Authored test/e26-gate-stats.test.mjs (26 tests): full 32/32 GATE_REGISTRY coverage (disjoint fired/zero_fire, catalog-order), fired sort order + stable ties, by_feature/by_agent/ts accumulation, unregistered-code isolation, structural prose_behavioral fires:null invariant (content-independent), never-throws matrix (malformed JSON, non-object roots, missing error_code, unreadable sidecar), missing-sidecar degradation, metrics dedupe incl. the raw-string-join collision case flagged by code-reviewer, one_pass strict-boolean coercion, null-on-zero-features means/rate, and tw_gate_stats TOOL_REGISTRY registration (12 tools, index.ts untouched, behavioral-equivalence to handleGateStats). Full suite 1547/1547 green (1521 baseline + 26 new), npm run build zero errors, npm audit --audit-level=high clean (exit 0, only a pre-existing low-severity esbuild advisory). Commit pending. Evidence: qa_reports/review_T-E26-01.md (covers all 3 ids).

