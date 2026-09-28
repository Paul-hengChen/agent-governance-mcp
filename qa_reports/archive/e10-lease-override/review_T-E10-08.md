# QA Review — e10-lease-override

covers: T-E10-ARCH, T-E10-01, T-E10-02, T-E10-03, T-E10-04, T-E10-05, T-E10-06, T-E10-07, T-E10-08

Reviewer: @qa-engineer
Code-reviewer verdict: APPROVED (`review_reports/review_T-E10-07.md`)

## Phase 0 — Drift note

`tw_detect_drift` (both at claim-time and again at PASS-time) surfaces 30
historical `[x]`-completed rows in `tasks.md` not reflected in handoff state
(`T-C5C18-09` .. `T-E4-DONE`), plus unchecked `T-E2-REL/DONE`,
`T-E9-REL/DONE`, `T-E13-REL/DONE` rows. This is pre-existing accumulated
drift from prior sessions/features, unrelated to e10-lease-override. Noted,
not reconciled, per assignment.

## Phase 1 — Review

Implementation read in full: `gates/lease-override.ts` (new), `gates/registry.ts`
(two new `GateDefinition` entries + doc-mapping rows), `tools/handoff-orchestrator.ts`
(lease-override bypass/audit branch inside the existing `FEATURE_LEASE_HELD`
block + the new `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` gate immediately
after), `tools/handoff.ts` (`bookkeepingWrite` option threaded through
`writeHandoffState`'s timestamp resolution + the migration heal-write call
site hard-wired to it), `tools/registry.ts` (zod + JSON schema for the two
new `tw_update_state` args), `content/const-08-chain-31-mid.md` (two new
§3.1 bullets).

Findings: none. Implementation matches architecture DR-1..DR-7 exactly —
no schema bump (confirmed: `schema/versions.ts`, `schema/migrations-handoff.ts`,
`HandoffState`, `parseHandoff` all untouched; neither field is ever emitted
to or read back from frontmatter), no `any`, no edits to files outside the
architecture's Affected Files list, no test-file edits by sr-engineer (§2
compliance — verified via `git log`/diff authorship boundary already
attested by code-reviewer).

### Copy Audit Gate / Visual Audit Gate

Spec Copy/Strings and Visual Tokens tables are both `N/A` (feature has no
new user-facing strings or visual literals — internal governance-tooling
fix, mirrors E13). No gate applicable.

### Phase 1.5 — Visual Compare

`design/e10-lease-override.md` does not exist (no `## Visual Baselines`
declared). Phase 1.5: skipped (no Visual Baselines declared).

## Expected-Red Diff

`qa_reports/expected-red_e10-lease-override.txt` is present (sr-engineer
manifest, feature-mode — disposition is advisory per skill-qa-engineer, not
load-bearing bugfix-mode semantics). Full suite run BEFORE any re-baseline
edit: **1363 pass / 14 fail / 0 skipped**, matching the manifest's stated
handoff state exactly.

Diff: **clean (14/14 manifest entries confirmed red, 0 unexplained reds)**.
All 14 actual failures matched 1:1 against the manifest's three groups:

- Group 1 (`test/error-code-contract.test.mjs`, 5 entries): `GATE_REGISTRY`
  28→30 count assertions, `ALL_GATE_CODES` parity, `registry ⊆ doc`,
  doc-file mapping comment size, `AC3 (c12)` allowlist closure — all caused
  by the two new gate entries (`LEASE_OVERRIDE_AUDIT_MISSING`,
  `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`) not yet reflected in the
  test's hardcoded counts/vocabulary. Disposition: re-baselined (see below).
- Group 2 (`test/compose-equivalence.test.mjs`, 6 entries): the two new
  const-08 §3.1 bullets shifted every golden fixture containing the
  chain-tagged constitution. Disposition: regenerated via
  `scripts/capture-constitution-golden.mjs` (8 build/hook fixtures) +
  hand-concatenated `constitution-monolith.txt` (the script cannot
  re-capture this one — `content/constitution.md` was deleted post-AC8;
  the committed golden was regenerated directly from
  `CONSTITUTION_SEGMENTS`, mirroring the test's own concatenation logic).
- Group 3 (`test/context-budget.test.mjs`, 3 entries): the two new bullets
  add measured raw/stripped token growth to every chain-tagged constitution
  path. Disposition: re-baselined to independently re-measured values (NOT
  trusted from sr-engineer's `~340 ~tok` estimate — actual measured delta
  was ~665 ~tok raw/stripped per arm, since the two bullets are large,
  paragraph-length prose blocks). See `test/context-budget.test.mjs` inline
  comments for exact before/after figures.

Zero actual reds absent from the manifest; zero extra manifest entries not
actually red. No genuine regression found.

## AC Execution Log

`specs/e10-lease-override.md` declares a `proof:` line on every one of AC1–AC9.
Each executed below (proof = the named test in `test/feature-lease.test.mjs`,
run via `node --test test/feature-lease.test.mjs` post-build):

| AC | proof (named test) | command | result |
|---|---|---|---|
| AC1 | `E10-AC1: an audited lease_override ... bypasses FEATURE_LEASE_HELD for THIS write only` | `node --test test/feature-lease.test.mjs` | PASS — audited override accepted, `active_feature` updated to the new feature |
| AC2 | `E10-AC2a` (empty pending_notes) + `E10-AC2b` (mismatched pending_notes[0]) | same run | PASS both — rejected `LEASE_OVERRIDE_AUDIT_MISSING`, distinct from `FEATURE_LEASE_HELD`, incumbent untouched |
| AC3 | `E10-AC3: lease_override is transient — write N's bypass does NOT leak forward to write N+1` | same run | PASS — write N+1 (omitting the field) rejected `FEATURE_LEASE_HELD` normally against the freshly-stamped new incumbent |
| AC4 | `AC4 (e10): migration heal-write preserves pre-heal last_updated verbatim` | same run, plus manual red→green proof (below) | PASS (green); independently verified RED against pre-E10 behavior |
| AC5 | `E10-AC5a` (bookkeeping_write preserves) + `E10-AC5b` (unflagged sibling still refreshes) | same run | PASS both |
| AC6 | `E10-AC6a` (different-feature hard-reject) + `E10-AC6b` (fresh-workspace inert) | same run | PASS both — `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` on the former, accepted on the latter |
| AC7 | red→green turnover of the AC4 test (T-E10-01 repro, reassigned to qa per §2) | see "AC7 red→green proof" below | PASS — red confirmed, then green confirmed |
| AC8 | `E10-AC8a` (Lease-Override bullet pinning) + `E10-AC8b` (Bookkeeping-Write bullet pinning) | same run | PASS both — `content/const-08-chain-31-mid.md` carries both bullets with all load-bearing substrings (gate codes, field names, sanctioned-writer rule, cross-reference to `gates/feature-lease.ts`) |
| AC9 | `E10-AC9a` (SQLite: lease_override inert) + `E10-AC9b` (SQLite: bookkeeping_write inert) | same run | PASS both — SQLite-mode behavior byte-for-byte unchanged |

### AC7 red→green proof (T-E10-01 repro test, authored by qa per §2 reassignment)

1. **RED**: temporarily removed `bookkeepingWrite: true` from the migration
   heal-write call site in `tools/handoff.ts` (`readHandoffState`, ~line 550),
   rebuilt (`npm run build`), ran
   `node --test --test-name-pattern="AC4 \(e10\)" test/feature-lease.test.mjs`.
   Result: **FAIL** — `AssertionError: expected '2026-05-01T00:00:00.000Z',
   got '2026-07-13T01:28:18.923Z'` (the heal-write stamped `now()`, exactly
   the pre-fix bug AC4/AC7 describe).
2. Restored `tools/handoff.ts` verbatim (confirmed byte-identical to the
   sr-engineer-landed diff — `bookkeepingWrite: true` back in place, no
   stray red-proof edit left behind), rebuilt.
3. **GREEN**: re-ran the same command. Result: **PASS** —
   `last_updated` preserved verbatim through the heal, and the subsequent
   different-feature write was correctly accepted against the ORIGINAL
   stale age (TTL auto-expiry), not a heal-refreshed fresh one.

Turnover confirmed: red on pre-E10 behavior, green on the landed fix. Zero
unexplained new reds elsewhere in the suite after restoring (full `npm test`
re-run below).

## Phase 3 — Tests (file: `test/feature-lease.test.mjs`, extended — no new
file created, per §2 "extend existing files where they exist")

AC→test map (also recorded inline in the file's own header comment):

- AC1 → `E10-AC1`
- AC2 → `E10-AC2a`, `E10-AC2b`
- AC3 → `E10-AC3`
- AC4/AC7 → `AC4 (e10): migration heal-write preserves pre-heal last_updated verbatim` (exact name per the sr-engineer manifest)
- AC5 → `E10-AC5a`, `E10-AC5b`
- AC6 → `E10-AC6a`, `E10-AC6b`
- AC8 → `E10-AC8a`, `E10-AC8b`
- AC9 → `E10-AC9a`, `E10-AC9b`

13 new tests added to `test/feature-lease.test.mjs` (extended, not a new
file — the manifest's named target `test/feature-lease.test.mjs` counts as
existing-file guidance per §2). Security/boundary coverage: empty
`pending_notes` (AC2a), mismatched note (AC2b), fresh-workspace/no-prevState
edge case (AC6b), SQLite-mode no-op boundary (AC9a/b).

Re-baselines (14 catalogued, all confirmed E10-caused, zero out-of-catalogue):

- `test/error-code-contract.test.mjs`: `SUFFIX_RE` widened with `|CHANGE`;
  `GATE_REGISTRY`/`ALL_GATE_CODES` counts 28→30; doc-file mapping comment
  size 28→30; two new `FREE_TEXT_ALLOWLIST` entries (`LEASE_OVERRIDE_AUDIT_MISSING`
  and `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`, `triggerEdge` field only —
  `armCondition` needed no allowlisting for either, confirmed mechanically
  checked via `classifyLeaseOverride`/`prevState` camelCase literals already
  present in `tools/handoff-orchestrator.ts`).
- `test/context-budget.test.mjs`: three floor caps bumped to independently
  re-measured values (design-arm 6399→7064, teamwork bundle 13669→14333,
  non-design 4302→4966), each with a re-baseline comment block matching the
  file's established convention (exact measured value, no headroom). Saving
  margins re-verified (still ≥ 240 / ≥ 2080 respectively).
- `test/fixtures/compose-golden/*`: 6 fixtures regenerated (4 build-full-*,
  hook-full.txt via `scripts/capture-constitution-golden.mjs`;
  constitution-monolith.txt hand-regenerated by concatenating
  `CONSTITUTION_SEGMENTS` in manifest order, mirroring the test's own logic,
  since the script's sanctioned capture path can no longer recapture the
  retired monolith file).

## Phase 4 — Run

- `npm run build`: **clean**, zero errors.
- `npm audit --audit-level=high`: **1 low-severity finding** (esbuild dev-server
  Windows-only arbitrary-file-read advisory, transitive devDependency) — zero
  HIGH/CRITICAL. Gate passes.
- `npm test`: **1390 pass / 0 fail / 0 skipped** (0 todo, 0 cancelled).
  CI-runnable headlessly, zero human interaction.

## Verdict: PASS

All AC1–AC9 traceable to passing tests. AC7 red→green turnover independently
verified (not merely trusted from the manifest). All 14 catalogued
re-baselines confirmed E10-caused and correctly applied; zero out-of-catalogue
failures encountered at any point. Full gates green.

Task disposition:
- T-E10-ARCH: architecture reviewed, sound (DR-1..DR-7).
- T-E10-01 (AC7 repro): satisfied via this session's authored
  `AC4 (e10): ...` test in `test/feature-lease.test.mjs`, per §2 reassignment
  (sr-engineer may not author test files — the manifest specified the exact
  recipe for qa to author instead).
- T-E10-02: **closed N/A** per architect DR-1 (no schema bump — the cited
  dispatch_pins/dispatch_mode/cumulative-totals precedent does not apply
  since neither `lease_override` nor `bookkeeping_write` is ever emitted to
  frontmatter; `schema/versions.ts`, `schema/migrations-handoff.ts`,
  `docs/schema-versions.md`, `HandoffState`, `parseHandoff` all
  intentionally untouched).
- T-E10-03..06: implementation reviewed and tested (writeHandoffState
  preserve branch, gates/lease-override.ts + registry.ts, registry.ts zod +
  orchestrator wiring, const-08 two bullets).
- T-E10-07: code-review APPROVED (`review_reports/review_T-E10-07.md`).
- T-E10-08: this QA pass — tests authored, re-baselines applied, full gates
  green.

T-E10-REL / T-E10-DONE left unchecked (release-engineer scope, not QA's).
## 2026-07-13T01:30:43.809Z — PASS — by qa-engineer

PASS. AC1-AC9 traceable to passing tests in test/feature-lease.test.mjs (13 new tests, extended not new file per §2). AC7 red->green turnover independently verified: removed bookkeepingWrite:true from the heal call site, confirmed RED (last_updated stamped now() instead of preserved), restored, confirmed GREEN. Phase 0.5 Expected-Red Diff: clean, 14/14 manifest entries confirmed red, 0 unexplained reds, all re-baselined (error-code-contract.test.mjs counts/SUFFIX_RE/allowlist 28->30; context-budget.test.mjs 3 floor caps independently re-measured, not trusted from sr-engineer's ~340~tok estimate - actual delta ~665~tok/arm; 6 compose-golden fixtures regenerated + constitution-monolith.txt hand-regenerated from CONSTITUTION_SEGMENTS since content/constitution.md no longer exists for the script's normal path). AC Execution Log: all 9 proof:-annotated ACs executed and recorded. Full gates: npm run build clean; npm audit --audit-level=high = 1 low-severity (esbuild dev-server, transitive) zero HIGH/CRITICAL; npm test = 1390 pass / 0 fail / 0 skipped. T-E10-02 closed N/A per architect DR-1 (no schema bump). Evidence: qa_reports/review_T-E10-08.md.

## 2026-07-13T01:31:16.547Z — PASS — by qa-engineer

PASS. AC1-AC9 traceable to passing tests in test/feature-lease.test.mjs (13 new tests, extended not new file per §2). AC7 red->green turnover independently verified: removed bookkeepingWrite:true from the heal call site, confirmed RED (last_updated stamped now() instead of preserved), restored, confirmed GREEN. Phase 0.5 Expected-Red Diff: clean, 14/14 manifest entries confirmed red, 0 unexplained reds, all re-baselined (error-code-contract.test.mjs counts/SUFFIX_RE/allowlist 28->30; context-budget.test.mjs 3 floor caps independently re-measured, not trusted from sr-engineer's ~340~tok estimate - actual delta ~665~tok/arm; 6 compose-golden fixtures regenerated + constitution-monolith.txt hand-regenerated from CONSTITUTION_SEGMENTS since content/constitution.md no longer exists for the script's normal path). AC Execution Log: all 9 proof:-annotated ACs executed and recorded. Full gates: npm run build clean; npm audit --audit-level=high = 1 low-severity (esbuild dev-server, transitive) zero HIGH/CRITICAL; npm test = 1390 pass / 0 fail / 0 skipped. T-E10-02 closed N/A per architect DR-1 (no schema bump). Evidence: qa_reports/review_T-E10-08.md.

