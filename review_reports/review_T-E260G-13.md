# Review — T-E260G-13

Round 1 — CHANGES_REQUESTED (lane-wide) — by code-reviewer (opus). Commit `6a9f348`; files `test/feature-lease`, `feature-scope-gate`, `feature-split-lifecycle`, `feature-rollup` (`.test.mjs`).

## Summary
- 16 long blocks (254 counted lines) were trimmed. The base bare id at feature-lease L1127 ("(E148)") is gone.
- feature-lease, feature-scope-gate and feature-split-lifecycle point to their own tracked specs. I confirmed each one exists and holds the ACs: `specs/e1-feature-scoped-state-design.md` (with the "Amendment (2026-07-12)" at :401), `specs/e13-terminal-marker-advisory.md`, `specs/e10-lease-override.md`, `specs/feature-scope-gate.md`, `specs/feature-split-lifecycle.md`. The test names carry the P/FM/S/E1A/E13/E10 labels that the dropped maps listed. feature-rollup's rationale moved to the rationale spec.
- Pending note (d) checked: the two headers that cited the removed `skill-coordinator.md` now say "coordinator prompt text" (scope-gate:3) and "coordinator SOP text" (split-lifecycle:6). Both are accurate, since the tests read `content/*.md`.
- This task has no required finding.

## AC Completeness
AC1 — implemented — proof `emit: 0 differ`
AC2 — implemented — proof `tokens`/`directives` ok (feature-lease keeps its one `eslint-disable-next-line`, :32)
AC3 — implemented — proof `scope: ok`
AC4 — implemented — proof `>20: 0`
AC5 — implemented — no 8-20 block remains (table below)
AC6 — implemented — feature-rollup:6 pointer; the other three cite tracked specs that hold the rationale
AC7 — implemented — `bare-id: 0`. The widened scan's one hit here (feature-lease:1077) is an untouched continuation line (optional, below). I sampled 10+ blocks and they read as plain language.
AC8 — implemented — `form: ok`
AC9 — not judged here — lane-level

**Retained blocks** (AC5):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
No required findings. Rewritten sentences I checked against code: the feature-lease header (TTL 30, Blocked holds), the E1A, E13, E10, E9A and E17 rulers, the E13-R1 WHY, the E10-AC3 write N+1 note (forceSeedStamp with freshNonSuspectStamp), the E17-S2 fence note, the feature-rollup header, the round-1 WHY, the AC5 spec-proof WHY, the extension ruler (test names do carry the `AC5 (E132)`, `AC6 (E132)` and `gap-N` labels), and the AC5 deletion-proof WHY. Also the scope-gate test names (AC1-AC6) and the split-lifecycle test names (AC1-AC7) that the "test names carry the labels" claims rely on. All accurate.

## Quality
- recommended — specs/e260g-comment-rationale.md:176 — the feature-rollup test-label map cites `t-seam-marker`, `t-provider-swap-zero-callsite`, `t-sum-against-hop-cap-exported`, `t-round1-regression-no-cross-feature-sum`, `t-unreadable-lane-carried`, `t-banner-zero-matching` and `t-banner-unattributable`. None of these exists in the file, whose tests are titled `AC2: …`, `round-1 regression PIN: …` and so on. The map was stale at base, but it now sits in a tracked spec. Map the labels to the real titles or mark them as historical.
- optional — test/feature-lease.test.mjs:1077 — `// (T-E10-01)` is an id-only line. It continues the sentence above, so it is allowed, and it is unchanged from base (L1151).

## Architecture
No architecture spec; comment-only change.

## Security
No findings.

## Performance
No findings. Comment-only; emit is byte-identical.

## Verdict
CHANGES_REQUESTED (lane-wide) — this task is clean apart from recommended or optional items; the round is blocked by required findings in T-E260G-10, T-E260G-12 and T-E260G-15.

## Round 2 — CHANGES_REQUESTED (lane-wide) — by code-reviewer (opus)

Range `f249f1b..feca935` (fix `6234fe8`).

- Round 1 recommended rationale :176 feature-rollup labels: **fixed**. The title map matches the real test titles (`AC2:` x3, `AC3:`, `round-1 regression PIN`, `AC4:` x2, `AC5:`).
  - optional — specs/e260g-comment-rationale.md:176 — "the `t-*` labels from the spec do not appear in the file". No spec carries those labels either (grep over specs/ finds none; they came from the old test comment). Say "from the old file header".
- Round 1 optional feature-lease:1077: **fixed**. Folded into :1076.
- Nothing in this task's files blocks. The lane verdict follows T-E260G-10.
