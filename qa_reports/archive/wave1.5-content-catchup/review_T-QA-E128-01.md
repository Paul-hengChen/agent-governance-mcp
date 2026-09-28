# QA Review — T-QA-E128-01 (feature `e128-blocked-self-loop`, round 1)

covers: T-E128-01, T-E128-02, T-E128-03, T-QA-E128-01

**Reviewer**: qa-engineer (sonnet).
**Base**: `feat/e92-e86-e128-wave1-state-trans`, lane worktree
`<lanes-root>/e92-e86-e128`.
**Contract**: the E128 row of `docs/backlog.md:250` (no per-feature spec
file — Phase 1.5/3a/3b/3.5 all skip, see below).
**Prior gate**: code-reviewer APPROVED round 1, zero blocking findings
(`review_reports/review_T-E128-02.md`).
**dispatch_mode**: `bugfix` — Phase 0.5 disposition below is load-bearing for
PASS.

## Phase 0 — Drift check

`tw_detect_drift` reported T-E86-01/T-E92-01/T-QA-01 as completed in
`tasks.md` but absent from handoff `completed_tasks`. Confirmed as the
expected benign residue from the preceding, already-PASSed
`e92-e86-handoff-write-boundary` feature on this same branch (feature-scoped
reset on `active_feature` change). Not reconciled, not synced, not rolled
back, per dispatch brief.

## Expected-Red Diff

`qa_reports/expected-red_e128-blocked-self-loop.txt` exists (2 entries,
`dispatch_mode: bugfix` → load-bearing).

1. `test/e128-blocked-self-loop-repro.test.mjs | E128 repro: release-engineer:Blocked -> release-engineer:Blocked is accepted (the incident case, fixed)`
   — genuinely red pre-fix / green post-fix, independently re-confirmed by
   code-reviewer's execution (`review_reports/review_T-E128-02.md` C6:
   pre-fix `# pass 0 / # fail 1`, post-fix `# pass 1 / # fail 0`). Verified
   GREEN in this round's full suite run (see below). File left untouched, as
   instructed — diffed against HEAD, zero changes.
2. `test/qa-flow.test.mjs | T-E53-03(h): exhaustive matrix sweep — accepted edge set is EXACTLY the 69 tuples E53+E58 leave standing (durable form of the reviewer's 1056-tuple differential; extended by T-E39-03 for E58's pm:Blocked -> design-auditor:In_Progress edge)`
   — this was the sole suite failure going into this round (code-reviewer's
   independently-measured `2008 pass / 1 fail of 2009`, `not ok 1308`, same
   string). **My work**: updated the pin from 69 to 76 in
   `test/qa-flow.test.mjs`. 76 was **not** accepted on the reviewer's
   arithmetic alone — verified independently by computation:
   - `E53_BASELINE_69.length` (69, the untouched pre-E128 literal) +
     `E128_NEW_EDGES_7.length` (7) = 76, asserted in-test.
   - A from-scratch exhaustive sweep of the current compiled
     `tools/transitions.js` (`sweepAcceptedEdges()`, same 1056-tuple universe)
     independently returns 76 and matches the reconstructed set exactly
     (`T-E53-03(h)`, now green).
   - A second, independent differential test (`T-QA-E128-01(f)`) computes
     `accepted − E53_BASELINE_69` and asserts it equals exactly the 7 named
     `<role>:Blocked → <role>:Blocked` tuples (architect, code-reviewer,
     design-auditor, qa-engineer, release-engineer, researcher, sr-engineer),
     with the reverse subtraction asserted empty (zero removals). Two
     independently-computed proofs of the same number lower the odds a typo
     in one literal passes unnoticed.

**Disposition: clean.** Both manifest entries are now GREEN. No red test is
present that is absent from the manifest — full suite is 2017/2017 pass (see
Phase 4). Both required conditions for a bugfix-mode PASS are met: (a) every
manifest entry confirmed turned GREEN by the fix, (b) zero stray reds.

## Phase 1 — Review

No per-feature spec file exists for E128; `docs/backlog.md:250` is the
contract (confirmed — `ls specs/ | grep e128` and `ls design/ | grep e128`
both empty). Read `tools/transitions.ts` lines 380–580 and
`specs/qa-flow-enforcement-architecture.md` lines 149–180 directly against the
backlog row and against `review_reports/review_T-E128-02.md`'s claims:

- Step-3 fast path (`tools/transitions.ts:531-537`) is exactly two named
  `(prev, next)` pairs (`In_Progress→In_Progress` OR `Blocked→Blocked`),
  guarded by `req.prev.agent !== null && req.prev.agent === req.next.agent` —
  confirmed NOT a `prev.status === next.status` wildcard (PASS/FAIL are not
  named). Matches the backlog row's requested shape (a).
- Static `ALLOWED` table and mirror spec table (149-171) are untouched;
  `pm:Blocked → pm:Blocked` (line ~208) is retained as instructed by
  T-E128-03/T-E128-02, redundant-but-harmless (double-covered, `validateTransition`
  returns on first match, confirmed by the accepted-edge sweep showing the
  tuple exactly once).
- Spec prose at line 175 and the JSDoc at ~438-441 both accurately describe
  the shipped code (re-verified independently, not taken on the reviewer's
  word) — both name the two explicit pairs, both state the PASS/FAIL
  exclusion, neither overclaims.
- Precedence ladder unchanged: caps (2/2.5) still run ahead of step 3; the
  hop-cap's `next.agent !== prev.agent` guard (DR-9) still makes self-loops
  hop-cap-exempt; Amend-Resume (3.5) and the table (4) are unreachable from
  this edge.

**Phase 1.5 (Visual Compare)**: skipped — no `design/<feature>.md`, no
`## Visual Baselines`.
**Phase 3a/3b (Copy/Visual Audit)**: skipped — no `specs/<feature>.md` Copy or
Visual Tokens sections exist (no spec file at all).
**Phase 3.5 (AC Execution)**: skipped — no spec file, hence no
`proof:`-annotated ACs.

No issues found in Phase 1 → proceeding directly to Phase 3 (no Phase 2
round needed).

## Phase 3 — Tests

**Test-file placement** (per dispatch brief): primary home
`test/qa-flow.test.mjs`, extending its "self-loop fast path" section (~line
265, now shifted by insertions) and updating the `T-E53-03(h)` pin at
(then-)line 2367. Also created a new file,
`test/e128-orchestrator-blocked-repair.test.mjs`, for the orchestrator
end-to-end coverage — pre-authorized, and it reads better separately since it
exercises the real `handleUpdateState` pipeline against a scratch workspace
rather than the pure `validateTransition` unit style the rest of
`qa-flow.test.mjs` uses for this feature.
`test/e128-blocked-self-loop-repro.test.mjs` was read only, never edited —
`git status --porcelain` on it shows `??` (untracked, sr-engineer's own new
file), zero diff from HEAD.

### Spec(backlog-row)-to-test map

| requirement (docs/backlog.md:250 + reviewer's coverage priorities) | test(s) |
|---|---|
| same-agent Blocked→Blocked accepted, not role-specific | `test/qa-flow.test.mjs` `T-QA-E128-01(a)` (all 8 roles) |
| PASS→PASS / FAIL→FAIL stay rejected (terminality structural) | `T-QA-E128-01(b)`, `T-QA-E128-01(c)` (all 8 roles each) |
| exhaustive edge-set literal pin, updated 69→76 | `T-E53-03(h)` (recomputed via `sweepAcceptedEdges()`) |
| differential guard against silent future widening | `T-QA-E128-01(f)` |
| all 3 round caps dominate the new edge, for all 8 roles | `T-QA-E128-01(d)` |
| `computeNewRound` ticks nothing (incl. hop_count) on the new edge | `T-QA-E128-01(e)` |
| the incident repaired end-to-end through the REAL write path, lease not released | `test/e128-orchestrator-blocked-repair.test.mjs` `E128-ORC` |
| the pre-fix negative shape (no static table row) stays true | `test/e128-orchestrator-blocked-repair.test.mjs` `E128-ORC-2` |
| repro genuinely red→green (sr-engineer's carve-out) | `test/e128-blocked-self-loop-repro.test.mjs` (unmodified; Phase 0.5) |

### Coverage gate

New/modified test code only (no production code changed by qa-engineer this
round — `tools/transitions.ts` is sr-engineer's, reviewed not re-authored).
All new assertions exercise `validateTransition`, `computeNewRound`, and the
real `handleUpdateState` pipeline directly; no untested branch was added.

### Security smoke

Boundary inputs (`null` agent/status, all 4 statuses, all 8 roles) are already
exhaustively covered by the 1056-tuple sweep (`T-E53-03(h)`) and the per-role
loops. No new auth/permission surface — the change is two `===` comparisons in
a pure function; the orchestrator test additionally proves the FEATURE_LEASE
gate (a real access-control-adjacent boundary) is not weakened by the fix.

## Highest-priority item: orchestrator end-to-end (dispatch brief priority 1)

`test/e128-orchestrator-blocked-repair.test.mjs` drives
`pm:In_Progress(seeded, cut-approved) → sr-engineer:In_Progress →
sr-engineer:Blocked(malformed) → sr-engineer:Blocked(repair)` through the real
`handleUpdateState`, then proves the lease property **operationally** rather
than by field inspection alone: a second `handleUpdateState` call for a
*different* feature's `pm:In_Progress` entry is driven through the same real
`FEATURE_LEASE` gate immediately after the repair and is asserted rejected
with `FEATURE_LEASE_HELD` (mirroring `test/feature-lease.test.mjs` FM2).
This is stronger than asserting `next_role === undefined` alone: it proves the
lease gate itself — not just the absence of a marker — still treats the
repaired, still-Blocked feature as held. Also asserts: corrected
`blocking_reason`/`pending_notes` persist verbatim, `status` stays `"Blocked"`,
`hop_count` is unmoved across both the malformed halt and the repair (two
same-agent status-only writes, DR-9), and the intruding write does not clobber
`active_feature`.

## Phase 4 — Run

- `npm run build` (which runs `check:version` pre-build and
  `check:transitions-sync` post-build): **clean**.
  `check:transitions-sync — OK (21 keys, exact match between
  dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)`.
- `node --test test/e35-pipeline-order.test.mjs`: 6/6 pass (pipeline step
  order and codes-registry parity unaffected by this feature).
- `npm test` (full suite): **2017 pass / 0 fail of 2017**. (2009 pre-existing
  + 8 new: 6 in `qa-flow.test.mjs` — `(a)`–`(f)` — and 2 in the new
  orchestrator file.) No CI interaction required; headless.

**PASS.**

## Lane boundary — verified clean

`git status --porcelain -- gates/ content/ test/fixtures/compose-golden/
test/context-budget.test.mjs test/e128-blocked-self-loop-repro.test.mjs`
shows nothing from this round (only the pre-existing, closed-feature
`tools/registry.ts` / `tools/handoff-parse.ts` modifications, which are NOT
mine and were not touched this round). My own diff is scoped to
`test/qa-flow.test.mjs` (modified) and
`test/e128-orchestrator-blocked-repair.test.mjs` (new) plus this review file.

## NEW-TICKETS.md

No new advisory filed this round — nothing surfaced beyond code-reviewer's
`NEW-5` (left filed, not actioned, per dispatch brief). Next available id
remains `NEW-6` for a future round.

## Verdict

**PASS** — `docs/backlog.md:250` (E128) is satisfied: a same-agent
`Blocked→Blocked` self-loop is accepted, PASS/FAIL terminality is
structurally unreachable through it (8-role sweep), all three round caps and
the hop-cap posture are unweakened, `computeNewRound` is inert on the new
edge, the accepted-edge delta is pinned both as a literal (76) and as an
independent differential (+7 named tuples, 0 removals), the incident repairs
end-to-end through the real write path without releasing the feature lease,
both expected-red manifest entries are green with zero unexplained reds, and
the full suite (2017/2017) plus build/transitions-sync are clean.
## 2026-09-16T11:08:22.450Z — PASS — by qa-engineer

E128 PASS. Blocked-self-loop fast path (tools/transitions.ts step 3) verified: accepted for all 8 roles, PASS/FAIL terminality structurally intact (8-role sweep), all 3 round caps + hop-cap posture unweakened, computeNewRound inert on the new edge. Edge delta pinned both as literal (76, T-E53-03(h)) and independent differential (+7 named tuples, 0 removals, T-QA-E128-01(f)). Orchestrator end-to-end test drives the real incident repair through handleUpdateState and proves the feature lease is NOT released (a second feature's pm entry is rejected FEATURE_LEASE_HELD). Phase 0.5 expected-red manifest: both entries green, zero unexplained reds. Full suite 2017/2017, build + check:transitions-sync clean. Details: qa_reports/review_T-QA-E128-01.md.

## 2026-09-16T11:08:39.109Z — PASS — by qa-engineer

E128 PASS. Blocked-self-loop fast path (tools/transitions.ts step 3) verified: accepted for all 8 roles, PASS/FAIL terminality structurally intact (8-role sweep), all 3 round caps + hop-cap posture unweakened, computeNewRound inert on the new edge. Edge delta pinned both as literal (76, T-E53-03(h)) and independent differential (+7 named tuples, 0 removals, T-QA-E128-01(f)). Orchestrator end-to-end test drives the real incident repair through handleUpdateState and proves the feature lease is NOT released (a second feature's pm entry is rejected FEATURE_LEASE_HELD). Phase 0.5 expected-red manifest: both entries green, zero unexplained reds. Full suite 2017/2017, build + check:transitions-sync clean. Details: qa_reports/review_T-QA-E128-01.md.

