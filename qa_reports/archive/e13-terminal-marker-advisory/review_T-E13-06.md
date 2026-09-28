# Review — T-E13-06, T-E13-07 (e13-terminal-marker-advisory)

covers: T-E13-06, T-E13-07

## Round 1 — PASS — by qa-engineer

## Summary
- T-E13-06: extended `test/feature-lease.test.mjs` with 6 new tests closing the remaining AC coverage — `E13-AC1` (first-occurrence class, no heal involved), `E13-AC3` (opening-write explicit regression at the pending_notes level), `E13-AC5` (Blocked status + closing-signature pending_notes — proves the disjunct cannot bypass the status conjunct), `E13-AC6` (skill-text pin for the resilience note), `E13-AC4a`/`E13-AC4b` (SQLite-mode orchestrator-path non-regression, fresh-held and stale-released). All pass; suite grew 1371 → 1377 (net +6).
- T-E13-07: full verification — `npm run build` (0 errors), `npm audit --audit-level=high` (exit 0, one pre-existing low-severity `esbuild` dev-dependency finding, unrelated to E13 and below the high-severity gate), `npm test` (1377/1377 green, 0 fail).
- Phase 0.5 (bugfix mode, load-bearing per spec AC7): manifest `qa_reports/expected-red_e13-terminal-marker-advisory.txt` names one entry (`E13-R1`); confirmed GREEN in the post-fix full suite run, zero unexplained reds elsewhere. Disposition below.
- Phase 3.5: spec `specs/e13-terminal-marker-advisory.md` has `proof:`-annotated ACs (AC1–AC7); AC Execution Log below.
- Verdict: **PASS**.

## Phase 0 — Claim
Claimed via `tw_update_state(agent_id="qa-engineer", ...)` per SOP before this work (resumed after crashed-then-recovered chain hop; review_verdict=APPROVED already on the handoff, independently verified by the coordinator).

## Expected-Red Diff

(Phase 0.5, bugfix mode — load-bearing for PASS)

Manifest: `qa_reports/expected-red_e13-terminal-marker-advisory.txt`, one entry:
```
test/feature-lease.test.mjs | E13-R1: heal-drop class — closing write carried the full terminal triple, then a heal-style re-persist preserved pending_notes verbatim but dropped the transient next_role; the lease must be RELEASED (spec AC2, second occurrence)
```

- Manifest entry confirmed **GREEN** post-fix: `node --test test/feature-lease.test.mjs` → test #38 `E13-R1: ...` → `ok`. Also present and green inside the full `npm test` run (1377/1377).
- Actual red set from the full post-fix suite run: **empty** (0 fail / 1377 pass).
- Disposition: **clean (1/1 manifest entries confirmed red→green, 0 unexplained reds)**. Both PASS-gate conditions met: (a) the manifest's repro entry is confirmed GREEN, and (b) zero actual reds absent from the manifest (there are zero reds at all). No regression to disposition.

## Phase 1 — Review

Read the full diff (`gates/feature-lease.ts`, `tools/handoff-orchestrator.ts`, `content/skill-release-engineer.md`) plus `review_reports/review_T-E13-01.md` (code-reviewer's APPROVED verdict covering T-E13-01..04, correctness/architecture/security already adjudicated there — QA scope per Hard rules is coverage/test-infra, not re-litigating correctness). No new correctness concerns found; the implementation matches the spec Decision section exactly (strict-superset broadening, file-mode-only call-site scoping, documentation belt).

### Copy Audit Gate
Spec's Copy/Strings table: `N/A — feature has no new user-facing strings (internal governance-tooling fix only)`. No strings to verify. Gate satisfied trivially (nothing to drift or gap on).

### Visual Audit Gate
Spec's Visual Tokens table: `N/A — feature has no visual literals`. Gate satisfied trivially.

## Phase 1.5 — Visual Compare
`Phase 1.5: skipped (no Visual Baselines declared)` — no `design/e13-terminal-marker-advisory.md` file exists, and the spec's Visual Tokens/Widgets tables are both `N/A`. Non-UI, internal-governance-tooling feature; zero overhead per SOP.

## Phase 2 — Discussion
No issues found in Phase 1 — proceeds straight to Phase 3.

## Phase 3 — Tests

### Spec-to-Test map

| AC | test(s) | status |
|---|---|---|
| AC1 (first occurrence: next_role never set at write time) | `E13-AC1` (new) | pass |
| AC2 (second occurrence: heal drops next_role, pending_notes preserved) | `E13-R1` (sr-engineer repro, T-E13-01) | pass (confirmed red→green) |
| AC3 (opening write must still hold — D9/D10 race) | `E1A-2` (existing) + `E13-AC3` (new explicit regression assertion) | pass |
| AC4 (SQLite/HTTP mode unaffected) | `E13-AC4a` (fresh, held), `E13-AC4b` (stale, TTL-released) (new) | pass |
| AC5 (escalation writes still hold) | `E1A-3a`/`E1A-3b`/`E1A-3c`/`E1A-3d` (existing) + `E13-AC5` (new — Blocked status with closing-signature pending_notes, proves the status conjunct isn't bypassed) | pass |
| AC6 (skill-text clarifying note) | `E13-AC6` (new, grep-based pin) | pass |
| AC7 (repro-first discipline) | manifest + Phase 0.5 disposition above | pass |

### Coverage Gate
New/modified production code for this slice is `gates/feature-lease.ts`'s broadened third conjunct (2 lines) and `tools/handoff-orchestrator.ts`'s call-site `leaseFields` object (already covered pre-T-E13-06 per code-reviewer's Architecture section). All branches of the new disjunct (`next_role==="pm"` true, `pending_notes` match true, both false) are now exercised: `E1A-1`/`E1A-3a` (first branch true), `E13-R1`/`E13-AC1` (second branch true), `E13-AC3`/`E13-AC5` (both false). 100% branch coverage on the changed conjunct; tooling (`c8`/`nyc`) is not wired into this project's `npm test`, noted explicitly per SOP 6c.

### Security Smoke Tests
Boundary inputs already covered pre-existing (`P5a`/`P5b` NaN/empty-string `last_updated`, `P6` null/undefined `prevState`). The E13 addition's only new input surface is `pending_notes` (a string array read at index 0 against a fixed anchored regex) — `E13-AC1`/`E13-AC3`/`E13-AC5` exercise present/absent/non-matching shapes; `gates/feature-lease.ts:127`'s `pending_notes?.[0] ?? ""` null-safety was independently verified by code-reviewer (no throw on undefined/empty array). No auth/permission surface (pure predicate + file-mode `instanceof` scoping, not a trust boundary).

## AC Execution Log

(Phase 3.5)

| AC | proof | command | result |
|---|---|---|---|
| AC1 | new predicate case, closing-signature pending_notes, next_role undefined | `node --test test/feature-lease.test.mjs` (test #39, `E13-AC1`) | pass — `isFeatureLeaseHeld` returns `false` |
| AC2 | new case simulating post-heal shape | `node --test test/feature-lease.test.mjs` (test #38, `E13-R1`) | pass — `isFeatureLeaseHeld` returns `false` |
| AC3 | existing opening-write case + new explicit regression assertion | `node --test test/feature-lease.test.mjs` (test #12 `E1A-2`, test #40 `E13-AC3`) | pass — both return `true` |
| AC4 | new SQLite-mode orchestrator-path test | `node --test test/feature-lease.test.mjs` (test #43 `E13-AC4a`, test #44 `E13-AC4b`) | pass — fresh held (`FEATURE_LEASE_HELD` error), stale released, byte-for-byte unchanged from pre-E13 |
| AC5 | existing escalation-case regressions + one new explicit case | `node --test test/feature-lease.test.mjs` (tests #28–31 `E1A-3a..d`, test #41 `E13-AC5`) | pass — all return `true` |
| AC6 | grep-based skill-text pinning test | `node --test test/feature-lease.test.mjs` (test #42 `E13-AC6`) | pass — resilience note located, both (a)/(b) clauses present verbatim |
| AC7 | manifest names exact new test id; QA confirms red→green turnover | Phase 0.5 section above | pass — `E13-R1` confirmed red (pre-fix, per manifest + sr-engineer's repro record) → green (post-fix, this session) |

Full command outputs:
- `npm run build` → exit 0, `tsc` zero errors (prebuild `check:version` also OK at 3.78.0).
- `npm test` → `# tests 1377 / # pass 1377 / # fail 0 / # cancelled 0`.
- `npm audit --audit-level=high` → exit 0; `1 low severity vulnerability` (esbuild dev-dependency, GHSA-g7r4-m6w7-qqqr, Windows-only dev-server file-read advisory) — below the `high` gate threshold, unrelated to any E13 file.

No proof failed to run; no fixture was missing.

## Phase 4 — Run
- Project build: ZERO errors (`npm run build`).
- CI Runnability: `npm test` runs headlessly, zero human interaction, deterministic (no flaky timers observed across the run — TTL-boundary tests use fixed offsets from `Date.now()` captured once per test, matching the pre-existing `P4a/P4b/P4c` convention).
- **PASS.**

## Verdict
**PASS** — T-E13-06's test extension closes every remaining spec AC (AC1/AC3/AC4/AC5/AC6) with new, purpose-documented tests, the bugfix-mode repro (AC2/AC7) is confirmed red→green with zero unexplained regressions, and T-E13-07's full verification (build/audit/test) is clean. Per QA's SOP scope, no correctness/architecture findings are raised here — those were code-reviewer's APPROVED verdict in `review_reports/review_T-E13-01.md`, unchanged by this test-only extension. Release bookkeeping (version bump, CHANGELOG, backlog done-marking) is explicitly out of scope for qa-engineer and deferred to release-engineer per T-E13-REL/T-E13-DONE.
## 2026-07-12T15:56:40.898Z — PASS — by qa-engineer

T-E13-06/07 PASS. Extended test/feature-lease.test.mjs with 6 new tests (E13-AC1/AC3/AC4a/AC4b/AC5/AC6) closing all remaining spec ACs; suite 1371->1377, 0 fail. Phase 0.5 (bugfix mode, load-bearing): manifest's E13-R1 confirmed red(pre-fix)->green(post-fix), zero unexplained reds. Full verification: npm run build 0 errors, npm audit --audit-level=high exit 0 (1 pre-existing low-severity esbuild dev-dep finding, unrelated), npm test 1377/1377. See qa_reports/review_T-E13-06.md for AC-to-test map and AC Execution Log.

## 2026-07-12T15:57:49.504Z — PASS — by qa-engineer

T-E13-06/07 PASS. Extended test/feature-lease.test.mjs with 6 new tests (E13-AC1/AC3/AC4a/AC4b/AC5/AC6) closing all remaining spec ACs; suite 1371->1377, 0 fail. Phase 0.5 (bugfix mode, load-bearing): manifest's E13-R1 confirmed red(pre-fix)->green(post-fix), zero unexplained reds. Full verification: npm run build 0 errors, npm audit --audit-level=high exit 0 (1 pre-existing low-severity esbuild dev-dep finding, unrelated), npm test 1377/1377. See qa_reports/review_T-E13-06.md for AC-to-test map and AC Execution Log.

## 2026-07-12T15:58:16.362Z — PASS — by qa-engineer

T-E13-06/07 PASS. Extended test/feature-lease.test.mjs with 6 new tests (E13-AC1/AC3/AC4a/AC4b/AC5/AC6) closing all remaining spec ACs; suite 1371->1377, 0 fail. Phase 0.5 (bugfix mode, load-bearing): manifest's E13-R1 confirmed red(pre-fix)->green(post-fix), zero unexplained reds. Full verification: npm run build 0 errors, npm audit --audit-level=high exit 0 (1 pre-existing low-severity esbuild dev-dep finding, unrelated), npm test 1377/1377. See qa_reports/review_T-E13-06.md for AC-to-test map and AC Execution Log.

