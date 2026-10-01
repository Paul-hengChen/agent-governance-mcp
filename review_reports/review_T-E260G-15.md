# Review — T-E260G-15

Round 1 — CHANGES_REQUESTED — by code-reviewer (opus). Commit `f4dab7f`; trimmed `test/hop-count-transitions`, `lane-migrate`; swept only `test/handoff.test.mjs`.

## Summary
- 15 long blocks (179 counted lines) were trimmed in 2 files. handoff.test.mjs is unchanged and covered by `bare-id: 0`.
- hop-count keeps its one `eslint-disable-next-line` (:30). The directive count matches base.
- The rewritten hop-count header assigns the `t-gate-*` tests to "the real orchestrator", but they call `validateTransition` directly.
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC1 — implemented — proof `emit: 0 differ`
AC2 — implemented — proof `tokens`/`directives` ok
AC3 — implemented — proof `scope: ok`; handoff.test.mjs is untouched
AC4 — implemented — proof `>20: 0`
AC5 — implemented — no 8-20 block remains (table below)
AC6 — implemented — pointer lines hop-count:5, lane-migrate:5; one section per file
AC7 — implemented — `bare-id: 0`. The widened scan's one hit (lane-migrate:373) continues a sentence (optional, below). I sampled 10+ blocks and they read as plain language.
AC8 — implemented — `form: ok`
AC9 — not judged here — lane-level

**Retained blocks** (AC5):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
- **required** — test/hop-count-transitions.test.mjs:3 — "enforced through the real orchestrator (t-gate-*, t-e2e-*)". Every `t-gate-*` test (for example `t-gate-dormant-under-cap`, `t-gate-fires-above-cap`) calls `validateTransition({...})` directly. Only `t-e2e-*` goes through the orchestrator. The base text kept these apart: "AC-2 → t-gate-*, t-e2e-cap-fires" and "(b) enforces the cap end-to-end through the real state-write orchestrator". The trim merged them into a claim the code does not support, the same class as the wave-1 rejection. Fix: "enforced by validateTransition (t-gate-*) and end to end through the real orchestrator (t-e2e-*)".
- Other rewritten sentences I checked against code: the `backdateLastUpdated` note (:40-42), the end-to-end ruler (pm/sr-engineer bounce, cut_approved re-arm), `t-crash-*` (both `t-crash-file` and the indented `t-crash-sqlite` exist), and in lane-migrate the header labels, the noFlatCounterpart note, `seedAllFiveFiles`, the AC5 debris ruler, the AC5-DEBRIS4 lock-path WHY (openSync "wx", looksStale mtime fallback, LOCK_MAX_WAIT_MS), the AC11 base-sha ruler, the lock-free-core wiring note, the CALLERS1 call-shape note (`name(`), AC15 count and merge, pendingTickets, and the tasks noFlatCounterpart ruler. All accurate.

## Quality
- optional — test/lane-migrate.test.mjs:373 — `// (AC12).` sits alone on a line, an artifact of the rewrap. It continues the sentence above, so it is allowed, but folding it onto line 372 would avoid an id-only line.

## Architecture
No architecture spec; comment-only change.

## Security
No findings.

## Performance
No findings. Comment-only; emit is byte-identical.

## Verdict
CHANGES_REQUESTED — the hop-count header says the `t-gate-*` predicate tests go through the real orchestrator; they call validateTransition directly.
