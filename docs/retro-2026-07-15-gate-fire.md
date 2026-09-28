# Gate-Fire Retro — 2026-07-15 (second run)

Per `docs/gate-retro-procedure.md` (E6 cadence: every 5 shipped features).
Window: since the 2026-07-13 retro — 5 shipped features:
`e14-e16-release-hardening` (v3.83.0), `e17-release-record-integrity`
(v3.84.0), `e5-intake-tiering` (v3.85.0), `e18-write-provenance` (v3.86.0),
`e23-evidence-schema-versioning` (v3.87.0). Registry size at run time: 32
codes (`gates/registry.ts`). Analysis-only, coordinator-direct (2026-07-13
precedent); retirements remain human decisions via ordinary tickets.

## Fires in window (7 total)

| count | error_code | features | verdict |
|---|---|---|---|
| 4 | `TRANSITION_REJECTED` | e15*, e17 ×2, e18 | **KEEP** — core state-machine backstop; fires steadily across every batch |
| 2 | `EXPECTED_RED_DIFF_MISSING` | e5, e23 | **KEEP** — repro-first discipline actively catching skipped expected-red steps |
| 1 | `AC_EXECUTION_LOG_MISSING` | e23 | **KEEP** — fired during the very feature that fixed its envelope (named-section variant now live) |

\* e15-test-flake-fix was in flight at window start; counted for completeness.

## Zero-fire codes, categorized (25)

Zero fires ≠ dead. Categories per procedure step 5:

- **Unexercised edge — visual family (12):** `VISUAL_BASELINES_REQUIRED`,
  `VISUAL_EVIDENCE_MISSING`, `VISUAL_WIDGETS_UNVERIFIED`,
  `VISUAL_ASSERTIONS_REQUIRED`, `VISUAL_REPORT_INCOMPLETE`,
  `VISUAL_PROVENANCE_MISSING`, `BASELINE_MANIFEST_MISSING`,
  `BASELINE_PROVENANCE_INCOMPLETE`, `PIXEL_GATE_ATTESTATION_MISSING`,
  `SOURCE_CREDIBILITY_UNVERIFIED`, `VISUAL_ROUND_EXCEEDED`,
  `REPRO_MANIFEST_MISSING` (bugfix-mode; no bugfix-mode ticket ran).
  **No design-armed feature shipped in this window** — these gates were
  never reachable. Not retirement candidates; re-judge at the first
  design-armed feature (which is itself a cadence trigger).
- **Pathological-loop sentinels (3):** `QA_ROUND_EXCEEDED`,
  `REVIEW_ROUND_EXCEEDED`, `HOP_CAP_EXCEEDED`. One-pass rate is 100%
  (9/9 features, `summarize-metrics`), so round caps firing zero is the
  *success* signal, and hop counts (mean 3.78, max 7) show the hop cap is
  measuring real pressure. Raise N per procedure step 4; KEEP.
- **Deterrence-likely, fired in prior window (4):** `FEATURE_LEASE_HELD`
  (4 lifetime fires, all pre-2026-07-13), `MISSING_EVIDENCE`,
  `CUT_APPROVAL_REQUIRED` (every cut this window was presented + approved
  before build — the gate's purpose achieved without firing),
  `SCOPE_DECISION_REQUIRED`. KEEP.
- **Shape/audit validators, young (5):** `LEASE_OVERRIDE_AUDIT_MISSING`,
  `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`, `STAMP_PROVENANCE_SUSPECT`
  (read-side advisory fired via drift detect in e9a era; write-gate zero),
  `QA_COMPLETION_EVIDENCE_MISSING`, `REVIEWER_COMPLETED_TASKS_REJECTED`.
  All shipped ≤ 4 releases ago; too young to adjudicate. KEEP, re-check
  next retro.
- **WATCH continuation (1):** `EXTERNAL_REFS_UNRESOLVED` — **second
  consecutive zero-fire retro** (zero fires *lifetime*). The PM resource-
  audit ledger has never blocked a hop; every window feature was an
  internal backlog row with no external refs, so the edge may simply be
  unexercised in THIS workspace. **Flagged as first formal retirement
  candidate** — human decision required; if retired, that is an ordinary
  ticket removing const §7 external-reference ledger enforcement prose +
  the gate. Counter-argument for one more window: consumer workspaces
  (104447 class) feed on external PRDs where the gate is load-bearing.
- **Misc (2):** `AGENT_ID_REQUIRED` (zod-adjacent argument backstop; cost
  ~0, KEEP), `REVIEW_VERDICT_STATUS_MISMATCH` (verdict⟺status consistency;
  young + cheap, KEEP), `QA_REVIEW_TARGET_REQUIRED` (same class, KEEP).

## Success-metrics summary

9 features on record, one-pass rate 100% (9/9), mean rework rounds 0.00
across qa/review/visual, mean hops 3.78. Note: `e8-success-telemetry`
appears twice with identical rows in `metrics.jsonl` (double-append at the
e8 closing write — cosmetic; skews feature count by +1, no round data
affected). Hop counts trend with chain length (e17: 7 — release + amend
traffic), not with rework.

## Decisions

1. **No retirements this run.** One formal candidate surfaced for human
   decision: `EXTERNAL_REFS_UNRESOLVED` (see WATCH above).
2. **Hand-aggregation pain confirmed again** — this run answered 32 codes
   from raw `jq` + hand-categorization; **E26 (`tw_gate_stats`) remains
   justified** and its category-boundary note (gate-backed vs
   prose-behavioral) matches exactly what this retro needed.
3. Next retro due: 5 shipped features after v3.87.0 (~v3.92) **or** the
   first design-armed feature, whichever first — the visual-family category
   above is unjudgeable until then.
