# Gate-Fire Retro — 2026-07-13 (first execution of the D3/E6 procedure)

Per `docs/gate-retro-procedure.md`. Window: telemetry sidecar start
(2026-07-10T13:36Z, v3.66.0) → 2026-07-13, spanning ~15 shipped features
(v3.66.0–v3.81.0). Coordinator-executed direct (analysis only, no chain).

## Fired gates (10 rejections total) — all load-bearing, KEEP

| error_code | fires | context |
|---|---|---|
| TRANSITION_REJECTED | 4 | illegal edges attempted by sr/qa/release-engineer/pm across 3 features — the base state machine earns its cost continuously |
| FEATURE_LEASE_HELD | 4 | all 2026-07-11 during E1/E8/E4 parallel intake; the false-positive class it exposed was fixed forward by E10 (lease_override) rather than by weakening the gate |
| EXPECTED_RED_DIFF_MISSING | 1 | C15 machinery caught a missing repro manifest in the E1 run |
| MISSING_EVIDENCE | 1 | evidence gate caught a QA write without report in the E1 run |

## Zero-fire codes (26) — bucketed per procedure §4/§5

**Never armed in window (no design-armed feature since telemetry began) — no
data, NOT candidates:** VISUAL_ASSERTIONS_REQUIRED, VISUAL_BASELINES_REQUIRED,
VISUAL_EVIDENCE_MISSING, VISUAL_PROVENANCE_MISSING, VISUAL_REPORT_INCOMPLETE,
VISUAL_WIDGETS_UNVERIFIED, VISUAL_ROUND_EXCEEDED, BASELINE_MANIFEST_MISSING,
BASELINE_PROVENANCE_INCOMPLETE, PIXEL_GATE_ATTESTATION_MISSING,
SOURCE_CREDIBILITY_UNVERIFIED. Re-assess after the first design-armed feature.

**Too new for the N=5 window:** AC_EXECUTION_LOG_MISSING (v3.77.0, armed once
— E7 complied), LEASE_OVERRIDE_AUDIT_MISSING + BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE
(v3.80.0), REPRO_MANIFEST_MISSING (bugfix dispatch_mode never exercised yet).

**Pathological-loop sentinels (procedure says raise N):** QA_ROUND_EXCEEDED,
REVIEW_ROUND_EXCEEDED, HOP_CAP_EXCEEDED — metrics show mean qa/review rounds
0.00, so these guard a tail that hasn't occurred; prose cost is one Limits
table row each. KEEP.

**Genuine scrutiny list (armed every chain, ~15 features, zero fires):**

| code | verdict | reasoning |
|---|---|---|
| CUT_APPROVAL_REQUIRED | KEEP | zero fires = perfect compliance with a human-control point; deterrence is the design intent, not dead weight |
| SCOPE_DECISION_REQUIRED | KEEP | same class as above |
| QA_REVIEW_TARGET_REQUIRED | KEEP | guards the D9 evidence-fan-out regression, which DID occur pre-gate |
| REVIEWER_COMPLETED_TASKS_REJECTED | KEEP | guards the C16 incident class (occurred pre-gate) |
| REVIEW_VERDICT_STATUS_MISMATCH | KEEP | consistency check, near-zero prose cost |
| MISSING_REVIEW_EVIDENCE | KEEP | sibling of MISSING_EVIDENCE (which fired) |
| AGENT_ID_REQUIRED | KEEP | input validation, no prose cost |
| EXTERNAL_REFS_UNRESOLVED | **WATCH** | weakest cost/value: its arming condition (an `unresolved` ledger entry) has never occurred; if still zero after 5 more features including ≥1 spec with real external refs, cut a prose-trim ticket (keep the code, shrink the constitution/skill text) |

## Success-side metrics (E8)

3 recorded features, one-pass rate 100%, mean hops 1.33 (E7: 7 tickets,
0 qa rounds, 0 review rounds, 4 hops, one-pass). The duplicate
e8-success-telemetry rows (v3.74.0 ×2) are the known E12 incident — fixed
forward in v3.76.0; leave the append-only sidecar as-is.

## Verdict

**No retirement PR this cycle.** The window is one class of work (non-design
governance tickets); half the registry never armed. Re-run this retro after
5 more shipped features OR the first design-armed feature, whichever first.
Only standing action: the EXTERNAL_REFS_UNRESOLVED watch above.
