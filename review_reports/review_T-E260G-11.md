# Review — T-E260G-11

Round 1 — CHANGES_REQUESTED (lane-wide) — by code-reviewer (opus). Commit `d8c90c9`; files `test/e5-intake-tiering`, `e90-golden-capture-completeness`, `e92-e86-handoff-write-boundary-repro`, `e92-e86-handoff-write-boundary`, `e96-dispatch-preference` (`.test.mjs`).

## Summary
- 10 long blocks (201 counted lines) were trimmed. Rationale moved to the spec for 4 of the 5 files. The repro file keeps its pointer to the full suite and needs no section.
- The bare id at e92-e86 base L423 is gone. Emit and tokens are identical to base.
- Pending note (c) checked: the base comment at L301 held a raw U+200B byte inside a comment. The new comment (:253-255) is ASCII, and the two code-side U+200B literals (:265, :288) are unchanged, so emit is identical.
- This task has no required finding. The lane verdict is CHANGES_REQUESTED because of other tasks.

## AC Completeness
AC1 — implemented — proof `emit: 0 differ`
AC2 — implemented — proof `tokens`/`directives` ok
AC3 — implemented — proof `scope: ok`
AC4 — implemented — proof `>20: 0`
AC5 — implemented — no 8-20 block remains (table below)
AC6 — implemented — pointer lines e5:7, e90:6, e92-e86:6, e96:6; the repro header cites `test/e92-e86-handoff-write-boundary.test.mjs`
AC7 — implemented — `bare-id: 0`; the widened id-only scan has no hit in these files; I sampled 10+ blocks and they read as plain language
AC8 — implemented — `form: ok`
AC9 — not judged here — lane-level

**Retained blocks** (AC5):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
No required findings. Rewritten sentences I checked against code: the e5 header (the three content files and the config key), the e90 header (the static source read, not running the script), the e92 header and the AC2, accepted-misses, whitespace, static-check, corpus-sweep and AC3 rulers, and the e96 header. All accurate.
- optional — test/e92-e86-handoff-write-boundary.test.mjs:365 — "Re-runs the five fixtures the code reviewer ran against the compiled dist." Without the comma the base had ("…ran, against the compiled dist"), this reads as though the reviewer ran against dist. Restore the comma.

## Quality
- recommended — specs/e260g-comment-rationale.md:94-109 (e5) and :113 (e90) — the moved spec-to-test maps cite labels that no test in these files carries (`t-absent-key`, `t-empty-object-defaults`, `t-captured-equals-on-disk`, …). The tests are titled `T-E5-02 config …` and `E90 class guard …`. The labels were already stale at base, but they now live in a tracked spec. Map them to the real titles or mark them as historical labels.
- optional — test/e92-e86-handoff-write-boundary.test.mjs:363-366 — the AC3 ruler's top line keeps 74 `=` and its bottom line has 75. The other rewritten rulers use 75 on both lines.

## Architecture
No architecture spec; comment-only change.

## Security
No findings.

## Performance
No findings. Comment-only; emit is byte-identical.

## Verdict
CHANGES_REQUESTED (lane-wide) — this task is clean apart from recommended or optional items; the round is blocked by required findings in T-E260G-10, T-E260G-12 and T-E260G-15.
