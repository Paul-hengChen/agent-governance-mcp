covers: T-E417-01, T-E417-02, T-E417-03

# QA review — E417 merge-invariants condition (c) lost row

Mode: bugfix (`dispatch_mode: bugfix`). Independent judge: qa-engineer did not build the rule. Code review round 2 is APPROVED (`review_reports/review_T-E417-02.md`).

## Phase 0.5 / Expected-Red Diff
## Expected-Red Diff

Manifest `qa_reports/expected-red_e417-merge-invariants-lost-row.txt`: R1, R4, R5, R6, R7, R8 (6 entries).

- Actual red set against the PRE-fix tool (main's `dist/tools/merge-invariants.js`, copied outside the lane tree, run with the lane's final E203 file): exactly R1, R4, R5, R6, R7, R8, each `expected 'FAIL', actual 'PASS'` ("a dropped row must not pass"), i.e. the dropped row was reported COMPACTED with exit 0. Nothing else is red. Phase 0.5 baseline: 6/6 manifest entries red for the right reason, 0 unexplained reds.
- Actual red set against the lane build (fixed): empty. `npm test` Node 22: 4226 pass / 0 fail / 2 skipped of 4228.
- R1 green on fix: confirmed. R4 green: confirmed. R5 green: confirmed. R6 green: confirmed. R7 green: confirmed. R8 green: confirmed.
- Zero actual reds absent from the manifest. Phase 0.5: clean (6/6 manifest entries confirmed turned green by the fix, 0 unexplained reds).
- R2 and R3 (renamed accepted-limit pins, not in the manifest): PASS on the pre-fix tool and on the lane build.

## Phase 1 — review notes
- Copy audit (merge.c.history-warn, merge.c.history-suffix): WARN line and the suffix are asserted verbatim by F1-F4 and R1. No unsourced strings.
- Visual: not applicable (no design file).
- Correctness, architecture, security, performance: owned by the code-reviewer (APPROVED round 2). QA found no contradiction: no scenario in the spec failed to implement as written; every verdict the tool gave matched the spec's step-7 table.

## Phase 3 — tests added by QA
- `test/e203-merge-invariants-union.test.mjs`: 7 tests added (AC12 guards FP1, FP2, FP3, FP3b, FP4, FP5 PASS; FN3c FAIL with T-A-01..03 MISSING). Disclosure: the spec and architecture file assign these to sr-engineer; the coordinator reassigned them to QA because regression tests are QA-owned. Header comment refreshed (it described the cherry-pick false negative as an accepted limit in the pre-amendment terms). No pre-existing test body was modified (`git diff main` shows only additions plus the header comment lines).
- `test/e417-merge-invariants-history.test.mjs`: 21 tests (AC13 G1-G8, S1, reviewer S1-family pins N03 and N02, K1, K2, F1-F7, N1).

### AC to test map
| AC | tests |
|---|---|
| AC12 repro | E203 file R1, R4-R8 (sr-owned) |
| AC12 accepted-limit pins | R2, R3 |
| AC12 guards | FP1, FP2, FP3, FP3b, FP4, FP5, FN3c (QA) |
| AC13 | G1-G8, S1, K1, K2, F1-F7, N1, plus N02 and N03 (review round 2 S1 family) |

### Negative control (pre-fix tool, copy outside the worktree)
| test | pre-fix (main dist) | lane build |
|---|---|---|
| R1, R4, R5, R6, R7, R8 | RED (FAIL expected, PASS actual) | GREEN |
| R2, R3 | green | green |
| FP1, FP2, FP3, FP3b, FP4, FP5, FN3c | green | green (no verdict changes) |
| G6, G7, G8, K1, F5, N02 | green | green (verdict identical) |
| G1-G5 | red only on the new `historyFallbacks` field (absent in old tool) | green |
| S1, N03, K2 | red (old tool PASSes, rule now FAILs: intended strictness / provable loss) | green |
| F1-F4, F6, F7 | red (no WARN, no helpers in old tool) | green |

N02 passes before and after, confirming the S1 family strictness extends a premise the pre-E417 rule already applies. N03 is PASS before and FAIL after, pinned deliberately.

### Fallback properties (E)
F1 (shallow): one WARN line per affected section, snapshot verdict PASS, exit 0, byte-identical second run, `.git` file/size digest unchanged (nothing written). F2 (missing blob): one WARN with non-empty detail. F3 (cap=1): one WARN; cap=2 control FAILs. F4: old FAIL verdict plus one unreconciled WARN. F5: no WARN when no verdict depends on history. F6: real `--filter=blob:none` clone on git 2.50; history-only blob absent before and after (checked with `GIT_NO_LAZY_FETCH=1`), PASS plus one `history unreadable:` WARN.

## AC Execution Log
## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC12 R1, R4-R8 repro | `node --test test/e203-merge-invariants-union.test.mjs` (lane build) | 20 pass / 0 fail (5 AC-E203 + R1-R8 + 7 guards) | pass |
| AC12 R1, R4-R8 red before | same file against main's `dist/` copy | R1, R4, R5, R6, R7, R8 not ok (`expected 'FAIL', actual 'PASS'`); R2, R3, guards ok | pass (red for the right reason) |
| AC12 R2, R3 pins | same, both builds | ok on both | pass |
| AC12 FP1-FP5, FP3b, FN3c | same, both builds | FP/FN3c ok on both, same verdicts | pass |
| AC13 G1-G8, S1, N02, N03, K1, K2, F1-F7, N1 | `node --test test/e417-merge-invariants-history.test.mjs` (Node 22) | 21 pass / 0 fail / 0 skipped | pass |
| AC13 N1 | `node --test test/e126-merge-invariants.test.mjs test/e203-merge-invariants-union.test.mjs test/e417-merge-invariants-history.test.mjs` | Node 22: 57 pass / 0 fail. Node 20.20.2: 57 pass / 0 fail | pass |
| Gate: build | `npm run build`, then `git status --short` | tree unchanged (dist in sync) | pass |
| Gate: `npm test` Node 22 | `npm test` | 4228 tests, 4226 pass, 0 fail, 2 skipped | pass |
| Gate: `npm test` Node 20 | `fnm exec --using=20 npm test` | 4228 tests, 4157 pass, 69 fail, 2 skipped. All 69 are better-sqlite3 NODE_MODULE_VERSION load failures (shared node_modules built for Node 22, known lane environment issue). No failure in a merge-invariants test; no non-SQLite failure | environment only |
| Gate: agc check | `node bin/agc-init.mjs check` | OK (4.20.0), no comment-length warning after the header trim | pass |
| Gate: audit | `npm audit --audit-level=high` | 7 vulnerabilities (1 low, 6 moderate), none high or above | pass |

## Observations (out of scope, not fixed)
- Pre-existing E203 and e126 fixtures (and sr's R1-R8) never delete their temp repos; my new file removes its repos at process exit. Left as is: the shared `mkRepo` body in the E203 file is pre-existing.
- Code-reviewer recommendations Q-1 (describe S1 as a family), Q-2 (align Affected Files and AC12 owner for the guards with the reassignment), Q-3 remain open spec text edits for the architect/PM.

## Verdict
PASS.
