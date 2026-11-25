# QA review — E433 final hop (T-E433-10) and feature PASS

covers: T-E433-01, T-E433-02, T-E433-03, T-E433-04, T-E433-05, T-E433-06, T-E433-07, T-E433-08, T-E433-09, T-E433-10, T-E433-11, T-E433-12, T-E433-13

Code review APPROVED every build task (`review_reports/review_T-E433-01.md`, `-12.md`, `-13.md`). T-E433-08 / -09 evidence: `qa_reports/review_T-E433-08.md`.

## Expected-Red Diff

Full suite run at commit 1d18104 plus the new AC2(f)(g) assertions, BEFORE any golden or budget re-baseline: 4513 tests / 4490 pass / 21 fail / 2 skipped.

Phase 0.5: clean (21/21 manifest entries confirmed red, 0 unexplained reds). The 21 actual reds equal the manifest's 21 entries by test name:
- `test/compose-equivalence.test.mjs` x11 (8 buildPromptForRole goldens, 2 hook goldens, 15-fragment monolith) — confirmed red; disposition: legitimate content move, re-captured via `npm run build && node scripts/capture-constitution-golden.mjs`.
- `test/skill-manifest.test.mjs` t-golden-byte-identity — confirmed red; same re-capture (`skill-coordinator-monolith.txt`).
- `test/context-budget.test.mjs` x9 — confirmed red; re-baselined / re-pinned below.
0 extra reds, 0 missing.

## Phase 3: tests and re-baseline

- `test/e433-test-first-rules.test.mjs` AC2: added (f) D21 — the Build gate allowance covers sr-engineer's stop to pm (`sr_return` cap reached, or a scenario cannot be built), and sr-engineer → code-reviewer is named at zero after the allowance; (g) D21 — *State update* carries "When the server accepts no write from the acting role, that role stops and reports instead, and a role that can write takes over." verbatim and keeps the crash/failure sentence.
- 12 goldens re-captured with `npm run build && node scripts/capture-constitution-golden.mjs` (never hand-edited).
- Caps re-baselined to the re-measured value (chars/4), one-line E433 note each:

| test | old | new |
|---|---|---|
| AC2 lean always-on | 5761 | 6029 |
| skill-pm stripped | 4791 | 4998 |
| skill-sr-engineer stripped | 2805 | 3335 |
| design-arm constitution | 8840 | 9265 |
| teamwork bundle | 18614 | 19155 |
| non-design constitution | 6937 | 7363 |
| design-only strip saving floor (same test as non-design) | 1903 | 1902 (+425 design arm vs +426 non-design, rounding) |

- Wording pins re-pinned to the served text (verified against `content/const-12-chain-r10-s4.md` and `content/skill-sr-engineer.md`): AC9 sr marker `QA Round Reply` -> `4c. **Return routes**` (the QA Round Reply section is gone per spec AC4); AC-P2-5 and AC-P2-6 anchors -> the test-first DIAGRAM line (`... → qa-engineer → sr-engineer → code-reviewer`), `Each code-reviewer rejection (`(code-reviewer, FAIL)`) counts once in `review_round``, `Each sr-engineer return to qa-engineer counts toward the `sr_return` cap`.

## AC11 report

E418 delta (this ticket's growth against the E418 saving, ~tok):

| site | E418 saving | E433 delta | net of E433 vs E418 |
|---|---|---|---|
| design-arm constitution | -1065 | +425 | 40% of the E418 saving given back |
| teamwork bundle | -2490 | +541 | 22% given back |
| non-design constitution | -985 | +426 | 43% given back |

Per-role growth (stripped, ~tok, measured at base 96708e6 vs HEAD, same method as the budget tests):
- code-reviewer SOP bytes 10646 -> 12691 (+2045): absorbed the judge steps (PASS, `tw_complete_task`, evidence) formerly in the qa SOP; the qa SOP shrinks correspondingly and is served opus-pinned.
- pm stripped 4791 -> 4998 (+207): test-first chain routing (`chain_path`, qa as build entry).
- sr stripped 2805 -> 3335 (+530, higher than the ~+418 the integrator was told): T-E433-12/-13 added return routes 4c, the `sr_return` Escalation rows and the manifest-listed compile-error carry-back after that estimate; the QA Round Reply section was removed in the same file.

One chain per bundle: grep over the 12 goldens for `forbidden.old_chain` (`sr-engineer ↔ code-reviewer → qa-engineer`): 0 hits in every golden; the new main chain (`qa-engineer → sr-engineer → code-reviewer`) appears in 7 of them (the 4 full builds, constitution monolith, hook-full, coordinator monolith); the lite goldens carry neither.

## AC Execution Log

| AC | command | result |
|---|---|---|
| AC1 | `node --test --test-name-pattern "AC1:" test/e433-*.test.mjs` | 5 tests, 5 pass, 0 fail — PASS |
| AC2 | `node --test --test-name-pattern "AC2:" test/e433-*.test.mjs` | 1/1 pass — PASS |
| AC3 | `... "AC3:" ...` | 1/1 pass — PASS |
| AC4 | `... "AC4:" ...` | 1/1 pass — PASS |
| AC5 | `... "AC5:" ...` | 1/1 pass — PASS |
| AC6 | `... "AC6:" ...` | 1/1 pass — PASS |
| AC7 | `... "AC7:" ...` | 1/1 pass — PASS |
| AC8 | `... "AC8:" ...` | 1/1 pass — PASS |
| AC9 | `... "AC9:" ...` | 1/1 pass — PASS |
| AC10 | `... "AC10:" ...` | 1/1 pass — PASS |
| AC11 | `node --test test/compose-equivalence.test.mjs test/context-budget.test.mjs` | 69 tests, 69 pass, 0 fail — PASS |
| AC12 | `node scripts/test-lock.mjs -- npm test` on the committed clean tree (cd54396) | exit=0; 4513 tests, 4511 pass, 0 fail, 2 skipped — PASS |
| AC13 | `... "AC13:" ...` | 1/1 pass — PASS |

AC12 final checks (done-definition): `GATE_REGISTRY` 35 entries; `UPDATE_STATE_GATE_PIPELINE` 17 steps; `git diff --stat 96708e6..HEAD -- tools/transitions.ts tools/handoff-orchestrator.ts tools/tasks.ts schema prompts CLAUDE.md` empty (byte-identical); `CLAUDE.md` 250 lines; after `npm run build`, `git diff --name-only 96708e6..HEAD -- dist/` lists only `dist/gates/registry.*`, `dist/tools/fanout-manifest.*`, `dist/tools/registry.*`; `npm audit --audit-level=high` exit 0; `node bin/agc-init.mjs check` exit 0.

## Copy / Visual / Phase 1.5

Copy Audit: the two T-E433-13 const-05 sentences are pinned verbatim by AC2(f)(g); no new user-facing string outside the spec Copy. Phase 1.5: skipped (no Visual Baselines declared).

## Verdict

PASS. No code defects found; every red was an expected content-driven re-baseline.
## 2026-11-23T07:40:56.635Z — PASS — by qa-engineer

suite-result: 4511/4513 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

Full suite green on committed clean tree cd54396 (exit 0). Expected-red diff clean 21/21 before re-baseline; 12 goldens re-captured via scripts/capture-constitution-golden.mjs; 6 budget caps + design-only floor re-baselined with E433 notes; 3 wording pins re-pinned; AC2(f)(g) D21 assertions added. AC1-AC13 proofs pass. GATE_REGISTRY 35, pipeline 17, protected paths byte-identical to 96708e6, CLAUDE.md 250 lines, dist diff limited to registry/fanout-manifest, audit 0, agc check 0. Details: qa_reports/review_T-E433-10.md (covers all 13 task ids).

