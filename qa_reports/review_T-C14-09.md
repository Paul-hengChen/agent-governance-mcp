# QA Review — c14-dispatch-pins

covers: T-C14-01, T-C14-02, T-C14-03, T-C14-04, T-C14-05, T-C14-06, T-C14-07, T-C14-08, T-C14-09, T-C14-10, T-C14-11

## Summary

QA phase for c14-dispatch-pins, following code-reviewer's APPROVED verdict
(zero findings, `review_reports/review_c14-dispatch-pins.md`, covering
T-C14-01..08). This round: (1) verified the Phase-0 expected-red manifest
against the actual red set BEFORE any re-baseline edit, (2) authored
T-C14-09 (handoff.ts dispatch_pins tests) and T-C14-10 (registry.ts zod
boundary tests), (3) re-baselined every legitimately-tripped fixture/cap
(T-C14-11), (4) ran the full verification gate (build + audit + test).

**Verdict: PASS.** Full suite green (997/997), build clean, audit clean at
the high-severity gate.

## Phase 0 — Expected-red disposition (C15 protocol)

Before any re-baseline edit, ran the full suite and diffed the ACTUAL red
set against `qa_reports/expected-red_c14-dispatch-pins.txt` (37 entries).

- Actual failures: 37 (test IDs extracted from the `node --test` TAP output).
- Diff against the manifest's 37 `file :: test name` entries (name-sorted):
  **empty** — every actual failure matched a manifest entry and vice versa.
  No extra, no missing.
- Disposition (all 37, by file):
  - `test/compose-equivalence.test.mjs` (11) — the `## 1. Output Directives`
    AC-7 Pin-override line (const-01-core-head.md) and the AC-6 three-passage
    rewrite (skill-coordinator.md) grew the composed bundle past the frozen
    golden fixtures byte-for-byte. **Re-baselined**: reran
    `scripts/capture-constitution-golden.mjs` against the fresh post-c14
    dist to regenerate the 10 build/hook fixtures, and manually mirrored the
    AC-7 line into the frozen `constitution-monolith.txt` fixture (the
    monolith predates the fragment split and has no live source to
    recapture from — confirmed prior features, e.g. c9's `next_role` prose,
    are already mirrored into it the same way).
  - `test/context-budget.test.mjs` (4) — const-01 growth tripped 4 fixed
    ~token caps (lean bundle, design-arm rationale-stripped floor, teamwork
    coordinator bundle, non-design floor). **Re-baselined**: independently
    re-measured every figure via the same `approxTokens`/`composeConstitution`
    pipeline the tests use (not trusted from sr-engineer's/code-reviewer's
    notes), added a dated "c14-dispatch-pins (qa-owned bump, T-C14-11)"
    comment per file citing old→new values (C2-06 convention), and confirmed
    the saving-margin invariants (≥240 design-arm, ≥2080 non-design) still
    hold.
  - `test/schema-versions.test.mjs` (4), `test/skill-evolution-v3.11.test.mjs`
    (1), `test/drift-skew.test.mjs` (1), `test/handoff-versioning.test.mjs`
    (7), `test/handoff-migration.test.mjs` (6), `test/cut-approval-gate.test.mjs`
    (3 of the file's tests: R-schema-1, M1, M2 — X-malformed-parse's failure
    was a downstream side effect of M1/M2 wiping the migration registry, not
    an independent version-literal assertion) — every one is a hardcoded
    `schema_version: 7` / `server max 7` / `CURRENT_VERSIONS.handoff === 7`
    literal now stale against the shipped bump to 8. **Re-baselined**: updated
    every literal to 8, extended manually-registered migration chains in M1/M2
    to include the v7→v8 step (root cause of the M3/M4/X-malformed-parse/
    XR-schema-1 knock-on failures — those four never needed their own edit
    once M1/M2's chain was restored, confirming the failure was inherited
    registry state, not an independent regression).

No extra/missing entry required a disposition note beyond the above — the
manifest and the actual red set were identical.

## Phase 3 — Test authorship (T-C14-09 / T-C14-10)

New file: `test/dispatch-pins.test.mjs` (24 tests, all passing).

### Spec-to-Test map

| AC | Test(s) |
|---|---|
| AC-1 (schema bump v7→v8, stamp-only) | M1, M1b, M2 (future-refuse), M3 (isolated step) |
| AC-2 (closed keys, open values, defensive parse) | P1 (unknown key), P2 (empty value), P3 (oversize value), P4 (non-object: array/scalar), P5 (all-malformed→undefined), Z1–Z5 (zod boundary) |
| AC-3 (REPLACE wholesale incl. `{}` clears) | W1 (round-trip), W2 (replace + `{}` clear) |
| AC-4 (feature-scoped carry-forward, no PM re-arm) | W3 (same-feature carry), W4 (feature-change drop), W5 (PM re-entry NO re-arm, contrast with cut_approved) |
| AC-5 (file-mode only, SQLite ignores) | S1 |
| AC-8 (legacy pending_notes line stays inert) | M4 |
| T-C14-10 (unknown key / empty / oversize / non-object rejected before any gate) | Z1, Z2, Z3, Z4, Z5, plus positive controls Z6 (valid 8-key map), Z7 (`{}` accepted) |

### Coverage notes

- **docs/schema-versions.md 3-fixture minimum** (T-C14-09 requirement): M1
  (migrate-on-read v7→v8), M2 (future-version refuse-loud v9), M1b
  (round-trip write-back via `readHandoffState`'s fire-and-forget heal) —
  all three present. M3 additionally isolates the registered migration step
  itself (mirrors the `cut-approval-gate.test.mjs` M1/M2 convention).
- **Read/write key symmetry**: P1–P5 exercise the defensive parser
  (`parseDispatchPins`, `tools/handoff.ts`) against every malformed shape
  named in the assignment (unknown key, empty value, oversize value,
  non-object/array/scalar shapes, all-malformed collapse). Z1–Z5 exercise
  the equivalent zod `.strict()` boundary (`tools/registry.ts`) with the
  same shape taxonomy, confirming neither layer silently accepts what the
  other rejects.
- **W3/W4/W5** pin the exact `external_refs` algorithm polarity dispatch_pins
  was spec'd to reuse (AC-3/AC-4 Decision Record) and explicitly contrast it
  against `cut_approved`'s inverse (re-arming) polarity — this is the
  scrutinized invariant the spec calls out by name, so it gets its own WHY
  comment rather than a bare assertion.
- **S1** skips gracefully (matching the `visual-round-sqlite.test.mjs`
  convention) when `better-sqlite3` isn't installed locally; it ran in this
  environment and passed.
- Coverage gate: every new/modified production line touched by this ticket
  (`parseDispatchPins`, the write-path REPLACE/carry-forward branch, the
  v7→v8 migration step, the zod `dispatch_pins` schema) is exercised by at
  least one test above; tooling doesn't emit a line-coverage percentage in
  this repo (no coverage instrumentation configured), noted per SOP §Phase
  3c.
- Security smoke: P2/P3/Z2/Z3 cover boundary inputs (empty string, 101-char
  oversized value); P4/Z4/Z5 cover malformed/hostile shapes (array, scalar
  string mimicking the legacy convention). No auth/permission surface on
  this advisory, file-mode-only field (AC-5).

## Phase 4 — Run

- `npm run build`: exit 0, zero errors.
- `npm audit --audit-level=high`: exit 0 (one pre-existing low-severity
  `esbuild` advisory, below the high-severity gate — not introduced by this
  ticket).
- `npm test` (prebuild + `node --test test/*.test.mjs`): **997/997 pass, 0
  fail** (973 pre-existing + 24 new from `test/dispatch-pins.test.mjs`).
- No unexpected reds remain; every one of the 37 manifest-listed reds is now
  green via the re-baselines documented above.

## Task completion

- T-C14-01..08 (sr-engineer's, code-reviewer-approved, now evidence-backed
  by this round's green suite): completed.
- T-C14-09 (handoff.ts tests): completed — see `test/dispatch-pins.test.mjs`.
- T-C14-10 (registry.ts zod boundary tests): completed — same file, Z1–Z7.
- T-C14-11 (full verification + re-baseline): completed — see Phase 0/4
  above.
- T-C14-12 (release task): **NOT completed** — human/coordinator decision
  per protocol; release-engineer routing is out of scope for this PASS.
## 2026-07-09T11:31:24.658Z — PASS — by qa-engineer

PASS. Phase 0: full suite run BEFORE any re-baseline edit; actual red set (37) diffed byte-for-byte (by test name) against qa_reports/expected-red_c14-dispatch-pins.txt — empty diff, zero undispositioned entries. Phase 3: authored test/dispatch-pins.test.mjs (24 tests) covering T-C14-09 (handoff.ts: v7->v8 migrate-on-read, v9 refuse-loud, round-trip write-back via readHandoffState heal, isolated migration-step unit test, REPLACE-wholesale incl {} clears, feature-scoped carry-forward, drop-on-feature-change, no-PM-re-entry-re-arm contrasted with cut_approved, defensive-parser unknown-key/empty/oversize/non-object-shape/all-malformed, AC-8 legacy pending_notes line inertness, SQLite-ignore) and T-C14-10 (registry.ts zod .strict() boundary: unknown key, empty value, oversize value, array shape, scalar-string shape all rejected pre-gate; positive controls for valid 8-key map and {} accepted). Re-baselined (T-C14-11) all 37 legitimately-tripped fixtures/caps: regenerated 10 compose-golden fixtures via scripts/capture-constitution-golden.mjs + manually mirrored the AC-7 line into the frozen constitution-monolith.txt; independently re-measured and bumped 4 context-budget ~token caps with dated old->new comments (C2-06 convention); updated every stale schema_version==7/CURRENT==7 literal to 8 across schema-versions/skill-evolution/drift-skew/handoff-versioning/handoff-migration/cut-approval-gate test files, extending M1/M2's manually-registered migration chains to include v7->v8 (root cause of 4 downstream knock-on failures in the same file). Phase 4: npm run build exit 0 (zero errors); npm audit --audit-level=high exit 0 (1 pre-existing low-severity esbuild advisory, unrelated, below gate); npm test 997/997 pass, 0 fail (973 pre-existing + 24 new). No unexpected reds remain. Evidence: qa_reports/review_T-C14-09.md (covers T-C14-01..11).

