covers: T-E431-08, T-E431-09, T-E431-10

# QA review — E431 re-pins (qa session 1 of 3)

Commit 68e7f0e. Code review APPROVED upstream (review_reports/review_T-E431-01.md). Test files only; no source, content, golden or budget file touched.

## Expected-Red Diff

Phase 0.5 (before any re-baseline edit): the code-reviewer's round-2 full run recorded 69 reds equal to `qa_reports/expected-red_e431-test-first-server-path.txt` exactly (0 unexpected, 0 missing). Re-confirmed here: the 67 e431-owned manifest entries were red on the pre-edit tree; the 2 cross-lane entries were red and remain so.

Post re-pin run (`node scripts/test-lock.mjs -- npm test`): suite-result 4391 tests / 4387 pass / 2 fail / 2 skipped. The two reds are exactly the cross-lane manifest entries:
- test/e295-hop-cap-and-sop-halves.test.mjs AC11 — e423-owned, pending human re-assignment; stays red.
- test/visual-evidence-gate.test.mjs AC-4 — e423-owned, pending human re-assignment; stays red.
0 unexplained reds.

Test names changed by the re-pin (a count in the title moved with the pinned value): e26 R1/R2/U1/D1 (34 -> 35), error-code-contract AC-1/AC-5 title and DR-8 (16 -> 17, 34 -> 35). All pass under the new titles.

## T-E431-08 — Probe group 1 (transitions / hint / description)
- e151 AC11: `s1()` helper appends the spec's hint.pm_to_qa text when the target role is qa-engineer (AC9). The code-reviewer branch is unchanged (no suffix), so the "names the received value" intent and the AC9 allowed-list assertions are kept.
- e150 AC20: completed_tasks description re-pinned byte-for-byte to the new judge-naming string (desc.completed_tasks); the "Tasks completed now is gone" check is unchanged.

## T-E431-09 — Probe group 2 (registry count / union)
- Registry 34 -> 35 in e26-gate-stats, e308 AC12, e419 AC2, error-code-contract (AC-1/AC-5, mapping size, E308/AC3).
- TransitionRejection union 16 -> 17 members (error-code-contract DR-8), subset-of-registry check kept.
- e308 AC11a: `(none)` count 0 -> 1, now also asserting the single occurrence is the `SR_RETURN_CAP_EXCEEDED          (none)` row (documentedInProse false until E433), so a stray `(none)` still fails.
- error-code-contract AC3 (c12): `SR_RETURN_CAP_EXCEEDED` triggerEdge/armCondition added to the free-text allowlist with reasons (free English over a counter, same shape as HOP_CAP_EXCEEDED). Not a weakening: the closure check still fails any other unclassified pair.

## T-E431-10 — Probe group 3 (handoff schema 15 -> 16)
- 13 files re-pinned to CURRENT_VERSIONS.handoff = 16: stamp assertions, `applied` lists (add 16), toVersion, "server max" messages (16), manually registered migration chains gain the stamp-only 15 -> 16 step, comments updated.
- "Future version" fixtures moved v16 -> v17 (still refuse-loud against the server max); drift-skew skew regexes now `server max v16`.
- e123b9-lane-flip fixtures bumped to schema_version 16 so they stay "current" and no heal write-back reformats them (the test's intent: a plain read performs no schema-heal write).
- schema-versions "no-op when current === target": payload now at v16, from/to 16, applied [].
- skill-evolution-v3.11 lines 74-82 only (ruling 1a): `/handoff:\s*16,/`, comment :75 and message updated; test title left as is.

## Spec-to-test map
The re-pins cover registry/union/mapping/hint/description/schema pins from AC9 and the schema ACs; AC behaviour tests for the new feature (T-E431-07, `test/e431-*.test.mjs`) and final verification (T-E431-11) are later sessions.

## Phase notes
Phase 1.5: skipped (no Visual Baselines declared). Phase 3.5: proof-annotated ACs execute in T-E431-07/-11 (the proof files do not exist yet); not part of this batch. No PASS this session.
