covers: T-E262-01, T-E355-01, T-E360-01, T-E340-01, T-E262-02, T-E355-02, T-E360-02, T-E340-02, T-E262-03

# QA review — e262-sop-text-fixes (lane e262)

Build commit 0928b7f; code review APPROVED @ 6f3417f (0 required findings). QA commits: 39b55eb (pins, goldens, budgets, new tests), then a `.current` checkpoint commit.

## Expected-Red Diff

Phase 0.5 ran the FULL suite (`node --test test/*.test.mjs`, 4120 tests, 4095 pass, 23 fail, 2 skipped) BEFORE any re-baseline edit.

- Manifest entries confirmed red: 20/20 (9 spec pins: e178a AC10 and AC13, e226 AC-E226-4, e295 AC9, e349 AC-E349-1 and AC-E349-2, e130 AC9, context-budget AC2 lean and AC8 non-design; plus 11 `test/compose-equivalence.test.mjs` golden tests).
- Extra reds not on the manifest (dispositioned, one line each):
  - `test/e108-eject.test.mjs` AC7 (docs/backlog.md kept by default) — pre-existing load-sensitive flake; the file is not touched by this lane (`git diff origin/main...HEAD -- test/e108-eject.test.mjs` is empty), AC7 is on the repo's load-sensitive list (E355 W9), and the run overlapped other lanes' suites.
  - `test/e108-eject.test.mjs` AC19 (cannot-do block) — same file, same cause; a different test of that file went red in each load-affected run (an isolated re-run under load went red on AC1 instead), so the red set is nondeterministic, not a regression. It was green in the final clean-tree suite.
  - `test/e108-eject.test.mjs` AC20 (eject never prompts) — same cause and disposition.
- Phase 0.5 disposition: no unexplained reds; no genuine regression. Feature mode (no `dispatch_mode: bugfix`), so the disposition is advisory.

## Pin moves (each keeps its original intent)

| test | move |
|---|---|
| e178a AC10 | asserts the W1 order sentence and `refused until that approval is recorded`; removed sentence now asserted absent |
| e178a AC13 | verifier item now `retired-findings-file check` |
| e226 AC-E226-4 | `FINDINGS_CMD` pins the W4 cell |
| e295 AC9 | SOP flake rule asserts W6 wording, no E238/E254/E278 in the SOP, the addendum carries one load-sensitive list naming the two files |
| e349 AC-E349-1 | W8 wording |
| e349 AC-E349-2 | nine §5 bullets in order, §7 byte-identical |
| e130 AC9 | asserts the rule with its W11 exception; both bootstrapping-clause negatives kept |
| context-budget | lean 5723 -> 5731, non-design 8501 -> 8518 (re-measured: 5731 and 8518, equal to the spec; zero headroom checked by a one-token-lower negative control on a scratch copy, removed); E340 re-baseline comments; stripped 10598 and teamwork 21715 untouched |

## Goldens

`npm run build` then `node scripts/capture-constitution-golden.mjs`: `git diff --numstat -- test/fixtures/compose-golden/` lists exactly the 11 spec files, each `1 1`; `skill-coordinator-monolith.txt` byte-identical.

## AC to test map

| AC | test |
|---|---|
| AC-E262-1, -2, -3 | `test/e262-architect-hop-order.test.mjs` |
| AC-E262-4 | `test/e178a-integrator-role.test.mjs` AC10 (AC11 green unchanged) |
| AC-E355-1, -2, -3, -4 | `test/e355-integrator-generic-wording.test.mjs`; AC-E355-3 also e349 AC-E349-2 |
| AC-E355-5 | `test/e410-task-alias-content-tail.test.mjs` (green, not edited) |
| AC-E355-6 | e178a AC13, e226 AC-E226-4, e295 AC9, e349 AC-E349-1/-2 |
| AC-E360-1 | `test/e360-qa-visual-review-task-ids.test.mjs` |
| AC-E360-2 | `test/qa-visual-skill-split.test.mjs`, `test/pixel-perfect-visual-compare.test.mjs`, `test/visual-widgets-unverified-gate.test.mjs` (in the full suite, green) |
| AC-E340-1 | `test/e340-task-list-exception.test.mjs` |
| AC-E340-2 | `test/e130-lane-default.test.mjs` AC9 |
| AC-E340-3 | golden numstat above |
| AC-E340-4 | `test/context-budget.test.mjs` (messages name 5731 and 8518) |
| AC-L-1 | final suite below; `fanout check --cut` exit 0 |

Resident-test hygiene: new tests read only shipped md files; no real `specs/fanout-*.md` content, no fixed base sha, no platform dependence.

## AC Execution Log

Run on the committed tree (39b55eb plus the checkpoint commit), after the final suite.

| AC | command | output / exit | verdict |
|---|---|---|---|
| AC-E262-1 | `grep -c "Both must converge before the lane presents to the human" content/skill-integrator.md`; `node --test test/e262-architect-hop-order.test.mjs` | `0`; exit 0 (asserts W1-new occurs once at the bold-label line) | pass |
| AC-E262-2 | `node --test test/e262-architect-hop-order.test.mjs`; `git diff --numstat origin/main...HEAD -- docs/lane-protocol.md` | exit 0; `1 1 docs/lane-protocol.md` (one changed line, at the §5 rule 2 bullet) | pass |
| AC-E262-3 | `node --test test/e262-architect-hop-order.test.mjs` | exit 0 | pass |
| AC-E262-4 | `node --test test/e178a-integrator-role.test.mjs` | exit 0 | pass |
| AC-E355-1, -2, -4 | `node --test test/e355-integrator-generic-wording.test.mjs`; `git diff --stat origin/main...HEAD -- test/e108-eject.test.mjs test/verify-release.test.mjs` | exit 0; empty diff (0 lines) | pass |
| AC-E355-3 | `node --test test/e349-integrator-repo-facts.test.mjs` | exit 0 | pass |
| AC-E355-5 | `node --test test/e410-task-alias-content-tail.test.mjs` | exit 0 | pass |
| AC-E355-6 | `node --test test/e178a-integrator-role.test.mjs test/e226-integrator-sop-portable.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e349-integrator-repo-facts.test.mjs` | exit 0 | pass |
| AC-E360-1 | `node --test test/e360-qa-visual-review-task-ids.test.mjs` | exit 0 | pass |
| AC-E360-2 | `node --test test/qa-visual-skill-split.test.mjs test/pixel-perfect-visual-compare.test.mjs test/visual-widgets-unverified-gate.test.mjs`; `wc -c content/skill-qa-visual.md` | exit 0; 17169 bytes (cap 20700) | pass |
| AC-E340-1 | `node --test test/e340-task-list-exception.test.mjs` | exit 0 | pass |
| AC-E340-2 | `node --test test/e130-lane-default.test.mjs` | exit 0 | pass |
| AC-E340-3 | `git diff --numstat -- test/fixtures/compose-golden/` after capture | 11 files, each `1 1`; monolith skill golden unchanged | pass |
| AC-E340-4 | `node --test test/context-budget.test.mjs` | exit 0 (messages name 5731 and 8518) | pass |
| AC-L-1 | `node scripts/test-lock.mjs -- npm test`; `node scripts/fanout.mjs check --cut <primary manifest> e262 specs/e262-sop-text-fixes.md` | exit 0, 4127/4129 pass, 2 skipped; exit 0, 0 out of bounds | pass |

## Out-of-lane and unchanged-file checks

`git diff --stat origin/main...HEAD` lists no edit to `test/e351-lane-protocol-gaps.test.mjs`, `test/e383-lane-ledger-worktree.test.mjs`, `test/e410-task-alias-content-tail.test.mjs`, `test/e108-eject.test.mjs`, `test/verify-release.test.mjs`, nor to `docs/lane-protocol.md` outside §5 (one line changed). Every changed file is in the lane row's 擁有 cell: `node scripts/fanout.mjs check --cut <primary manifest> e262 specs/e262-sop-text-fixes.md` exits 0 (4 tickets, 18 tokens, 0 out of bounds).

## Final run (committed clean tree, no untracked files)

- `node scripts/test-lock.mjs -- npm test`: exit 0; 4129 tests, 4127 pass, 0 fail, 2 skipped (pre-existing skips). Zero unexplained reds (the three e108 flakes were green).
- `npm audit --audit-level=high`: exit 0 (moderate advisories only: @hono/node-server, esbuild, fast-uri; no high).
- `npm run check:bookkeeping`: OK.

## Notes

- Optional: e108 AC1/AC7/AC19/AC20 flake under parallel multi-lane load even though only AC7 is on the load-sensitive list; consider widening the list or the E238-family decoupling to the whole file (out of scope here, no ticket filed).
- Phase 1 audits: Copy Audit (W1-W11 verbatim) is covered by the byte-exact tests above; Visual Tokens and Widgets N/A (no design); Phase 1.5 skipped (no Visual Baselines declared).

Verdict: PASS.
## 2026-11-10T04:39:12.122Z — PASS — by qa-engineer

suite-result: 4127/4129 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS e262-sop-text-fixes. Pins moved (9), 11 goldens recaptured (numstat 1/1 each, monolith byte-identical), lean 5731 and non-design 8518 re-set at zero headroom (measured equal to spec), new e262/e355/e360/e340 tests added. Phase 0.5: 20/20 manifest reds confirmed, 3 extra e108 load-flake reds dispositioned (not touched by lane, green in final run). Final suite on committed clean tree green; audit high-level exit 0; check:bookkeeping OK; fanout check --cut exit 0. AC Execution Log and Expected-Red Diff in qa_reports/review_T-E262-02.md.

