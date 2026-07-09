# QA Review — c15-expected-red-manifest

covers: T-C15-01, T-C15-02, T-C15-03, T-C15-04, T-C15-05, T-C15-06, T-C15-07, T-C15-08

## Summary

Dogfooding the very SOP this feature adds: Phase 0.5 (Expected-Red Diff) was
run against `qa_reports/expected-red_c15-expected-red-manifest.txt` (3
declared entries) BEFORE any re-baseline edit. All 3 declared entries were
confirmed genuinely red; 1 additional, unrelated red was found and
dispositioned as a pre-existing flake (see below). The 3 manifest-declared
tests were then re-baselined to their new exact-measured caps, T-C15-07/08
were authored as new test files (pre-approved by the cut), and the full
suite + build + audit were re-verified green. Verdict: **PASS**.

## Expected-Red Diff

Phase 0.5 ran the full suite (`npm test`) BEFORE touching any baseline. Actual
red set (4 entries) vs the 3-entry manifest — diff is non-empty (1 extra
entry), dispositioned below per SOP 2a:

- `test/context-budget.test.mjs | AC1/AC2: skill-sr-engineer stripped token count meets ≤ 2138 cap`
  — **on manifest.** Confirmed genuinely red: actual stripped-body measurement
  is 2469 ~tok against the pre-existing 2275 cap (T-C15-01 added SOP step 7a
  to skill-sr-engineer.md). Re-baselined cap 2275 → 2469 (exact-measured, no
  headroom, per this test's established convention).
- `test/error-code-contract.test.mjs | AC-1/AC-5: GATE_REGISTRY has exactly 20 entries (19 in, 20 out — c9-protocol-fields added REVIEW_VERDICT_STATUS_MISMATCH)`
  — **on manifest.** Confirmed genuinely red: `GATE_REGISTRY.length` is
  actually 21 (T-C15-05 registered `EXPECTED_RED_DIFF_MISSING` as the 21st
  entry), confirmed by direct `node -e` inspection of the built registry.
  Re-baselined the hard-coded count 20 → 21 (title + assertion + comment); the
  companion generative parity test (`AC-5: ALL_GATE_CODES === code-side
  shape-rule harvest`) needed no change since it derives its expectation from
  the source tree, not a literal.
- `test/qa-visual-skill-split.test.mjs | AC-5: byte counts stay within v3.14.0-relaxed budgets (savings invariant vs v3.8.2 baseline)`
  — **on manifest.** Confirmed genuinely red: `content/skill-qa-engineer.md`
  is actually 11082 bytes (T-C15-02 added Phase 0.5 SOP prose) against the
  pre-existing 8850-byte cap. Re-baselined cap 8850 → 11500 (~418-byte
  headroom, per this test's established ~300–550-byte convention).
  `qa-visual.md` was unaffected (15694 bytes, well under its 20700 cap) — no
  change needed there.
- `test/handoff-write-arg-guard.test.mjs | AC-1 (t-ac1-valid-root-path-accepted): valid absolute workspace root + plain feature id is not rejected by Zod`
  — **NOT on manifest.** Investigated as a potential genuine regression per
  SOP: (1) `git log` shows this test file was last touched by
  `dd78789`/`71b7ade`, neither of which is the c15 implementation commit
  (`696a95d`) — no code this feature touches is exercised by this test file.
  (2) Re-ran `node --test test/handoff-write-arg-guard.test.mjs` in isolation:
  all 14 tests pass, including this one — it only fails inside the full
  984-test run. (3) The failure itself (`must receive a response for id=11`,
  duration 2006.7ms) is a JSON-RPC response-timeout assertion in a
  spawned-subprocess test whose sibling tests in the same file all clock
  2002–2027ms — this one simply missed a ~2000ms deadline by a few
  milliseconds under full-suite process contention. Disposition:
  **pre-existing, unrelated timing flake** under full-suite load, not a
  regression introduced by this feature. Safe to disregard; no code or
  baseline change made for it.

Phase 0.5 outcome: 3/3 manifest entries confirmed red; 1 unexplained entry
investigated and dispositioned as an unrelated flake (not a genuine
regression) — no silent re-baseline occurred for any entry without this
recorded disposition.

## Copy Audit Gate

Spec's Copy/Strings table is `N/A` — feature has no user-facing strings
(test-process/gate change only). Gate not applicable.

## Visual Audit Gate

Spec's Visual Tokens table is `N/A` — feature has no visual literals. Gate
not applicable.

## Phase 1.5 — Visual Compare

Skipped (no Visual Baselines declared; no `design/c15-expected-red-manifest.md`
exists — mode=no-design per the spec's Dependencies section).

## Spec-to-Test Map

| AC | Test(s) |
|---|---|
| AC-1 (manifest artifact/format) | Manually verified: `qa_reports/expected-red_c15-expected-red-manifest.txt` exists, feature-scoped, `file \| test name` format, comments present (dogfooded by this very review). Not machine-parsed per spec Out of Scope — no dedicated unit test warranted. |
| AC-2 (QA Phase 0.5 SOP) | Dogfooded above (`## Expected-Red Diff` section, this file). `content/skill-qa-engineer.md` SOP step 2a content verified present (T-C15-02, reviewed by code-reviewer). |
| AC-3 (code-reviewer manifest sampling) | Verified by code-reviewer in `review_reports/review_c15-expected-red-manifest.md` (APPROVED; SOP 4a sampling, 3/3 entries resolved to real tests). |
| AC-4 (`EXPECTED_RED_DIFF_MISSING` gate: arm, disposition, PASS-gate composition) | `test/gates-expected-red.test.mjs` U1–U13 (unit: `hasExpectedRedManifest`, `hasExpectedRedDisposition`), I1–I4 (integration: real `handleUpdateState` PASS composition — blocked/unblocked/backwards-compat/partial-disposition) |
| AC-5 (file-mode only, no schema bump) | `test/gates-expected-red.test.mjs` I5/I5b (storage-guard predicate + source-pinned call-site check). Schema-bump absence independently confirmed: `git show --stat 696a95d` touches no `schema/versions.ts`, no `schema/migrations-*`, no `tools/storage-sqlite.ts`, no `docs/schema-versions.md`. |

## Coverage

New file `gates/expected-red.ts` (85 executable lines): both exported
functions (`hasExpectedRedManifest`, `hasExpectedRedDisposition`) are
exercised across arm/disarm, sanitiser, direct-hit, covers:-fallback,
multi-id "at least one", and never-throws paths — 13 unit tests. The
orchestrator's PASS-gate composition (real code path, not reimplemented) is
covered by 4 integration tests exercising all 4 spec-listed scenarios
(blocked / unblocked / backwards-compat / partial-disposition), plus the
file-mode-only guard. Estimated line coverage on the new module: 100% (both
functions, every branch: manifest present/absent, empty-feature guard,
direct-file hit, covers-fallback hit, no-candidate-found, read-error catch).
No tooling instrumented (`c8`/`nyc` not wired into `npm test`); coverage
assessed by manual branch enumeration against the module's control flow,
noted per SOP.

Security smoke: sanitiser boundary inputs (empty string, path-traversal
`../`, repeated `..`, slashes) covered in U3–U5; malformed/bad-encoding
content covered in U12 (fail-closed, never throws). No auth/permission
surface in this feature (server-side gate logic only).

## Build / Audit

- `npm run build` — clean (`tsc`, zero errors).
- `npm test` — 1016/1016 pass (0 fail) after re-baseline + new test file.
  (One transient flake — `test/handoff-write-arg-guard.test.mjs` AC-1
  root-path-accepted — was observed on the FIRST full-suite run before any
  edits; dispositioned above under Expected-Red Diff; confirmed passing on
  re-run both in isolation and in the final full-suite pass.)
- `npm audit --audit-level=high` — clean (0 high/critical; 1 low-severity
  `esbuild` dev-server advisory, below threshold, pre-existing and unrelated).

## Verdict

**PASS** — T-C15-01..08 all satisfied. AC-1..AC-5 conformant. No blocking
findings; the one non-blocking observation from code-review
(`hasExpectedRedDisposition`'s direct-hit-then-fallback-on-miss ordering,
fail-closed) required no action per the reviewer's own note and is
unaffected by QA's test additions.
