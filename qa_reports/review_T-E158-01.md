covers: T-E158-01, T-E158-02, T-E369-01, T-E158-03, T-E369-02, T-E370-01

# QA review — e158-range-subject-audit (E158, E369, E370)

Verdict: PASS. Spec: `specs/e158-range-subject-audit.md`. Code review: `review_reports/review_T-E158-01.md` (APPROVED, round 1, zero required findings).

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared).

## Copy Audit (Phase 1, 3a)

Every Copy row was grepped in source and pinned by an exact-text assertion.

| string id | pinned by |
|---|---|
| vr.offender.no-paths | `AC-E158-1` (two cases) in `test/e158-range-subject.test.mjs` |
| vr.range.empty | not reachable from a real repo (AC-E158-2); read in `scripts/verify-release.mjs`, text matches the Copy table |
| cb.base.unresolved | `AC-E158-4`, exact stderr line |
| cb.base.unrelated | `AC-E158-4 (extension)`, exact stderr line (the integrator-required fixture case, an orphan-history ref) |
| cb.base.none | `AC-E158-4b`, and re-pinned `ID-MONO-NO-BASE-NOTE` in e299 |
| fanout.range-empty.check | `AC-E158-5`, full-line regex incl. the trailing `(E158)` |
| fanout.range-empty.owners | `AC-E158-6`, full-line regex |

No user-facing string exists in the diff outside the Copy table. Visual Tokens / Widgets: N/A.

## AC to test map

| AC | test |
|---|---|
| AC-E158-1 | `test/e158-range-subject.test.mjs`: empty commit FAIL names the 12-char sha, no tolerance NOTE, exit 1; mixed range names only the empty commit; bookkeeping-only control keeps NOTE and exit 0 |
| AC-E158-2 | read-only per spec; judged by reading `scripts/verify-release.mjs` (`commits.length === 0` push of the Copy-table text, then `return`, so the NOTE cannot print) |
| AC-E158-3 | `test/verify-release.test.mjs`, `test/e320-ci-check-sha.test.mjs`, `test/e326-empty-branch-run-poll.test.mjs` unmodified, 85/85 |
| AC-E158-4 | e158: unresolvable `--base nope` exit 2, one stderr line, empty stdout; no-merge-base extension exit 2, one line; resolvable `--base` control |
| AC-E158-4b | e158: no base exit 2, one line; base without `docs/backlog.md` keeps the note, exit 0 (audit row 8); e299 `ID-MONO-NO-BASE-NOTE` re-pinned (name records E158) |
| AC-E158-5 | e158: branch equal to base, commits netting to zero paths, uncommitted work in the checkout: each exit 2, empty stdout, one `RANGE_EMPTY` line; non-empty control unchanged |
| AC-E158-6 | e158: `main...feat/same` and `main...main` exit 2; non-empty HIT control exit 1; `owners --paths <empty file>` still exit 0; e331 `main...main` assertion re-pinned to status 2 + `RANGE_EMPTY` |
| AC-E158-7 | `test/error-code-contract.test.mjs` unmodified, 25/25 |
| AC-E158-8 | e177a-check-cli, e177a-manifest, e178b, e235b, e322 unmodified, 41/41. `dist` rebuild is a no-op (`npm run build` leaves `git status` clean) |
| AC-E158-9 | `grep -c` prints 1 |
| AC-E369-1..3 | `test/e369-acquire-lock-wait.test.mjs`: live guard, corrupt guard in grace, directory guard: each `{acquired:false, reason:"timeout"}`, `now()` calls <= 26, returns after >= max-wait, dead lock left untouched |
| AC-E369-4 | e369: guard removed at 250 ms, acquirer takes the lock within 1.5 s, reclaim line logged exactly once, no leftover guard, `now()` calls bounded |
| AC-E369-5 | e369: CLI `--max-wait 1` exits 75, marker file proves the wrapped command never ran |
| AC-E369-6 | `test/e177b-test-lock.test.mjs`, `test/e209-test-lock-publish.test.mjs`, `test/e362-reclaim-guard-publish.test.mjs`: 30/30 (e209 and e362 unmodified) |
| AC-E369-7 | comment discipline, read in `scripts/test-lock.mjs`: in-body comment moved into the `reclaimStale` doc comment, `publishLock` doc is one line (code review also checked) |
| AC-E370-1..4 | `test/e177b-test-lock.test.mjs`, see `## E370 decision` |
| AC-LANE-1 | full suite below |
| AC-LANE-2 | `git diff --quiet <base> -- scripts/mailbox-watch.mjs` prints `exit=0` |
| AC-LANE-3 | `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e158 --base main` run from the lane checkout: `19 file(s) changed, 0 out of bounds`, exit 0 (the check now refuses an empty range itself) |
| AC-LANE-4 | new tests build in-test fixtures under `os.tmpdir()`, remove them afterwards, never read a real `specs/fanout-*.md` and never diff against a fixed sha |

Negative control (E369): the pre-change `scripts/test-lock.mjs` (base sha, copied outside the worktree) run against `test/e369-acquire-lock-wait.test.mjs` never returned and was killed by an outer timeout, which is the spin the spec describes. The E158 re-pins were the two reds the sr hop observed (201/203 in the affected suites) and now pass.

Security / boundary smoke: empty range, orphan history, directory in place of a guard file, non-JSON guard, unresolvable ref, empty path list: all covered above.

Coverage: line coverage cannot be measured by the repo tooling (`node --test`, no c8). Every changed branch in the four source files has a named case above: the two new `verify-release` branches (one by test, the unreachable one by reading), all three `resolveBase` exits, both `RANGE_EMPTY` returns, and the `reclaimStale` true/false returns plus the once-per-content log.

## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC-E158-1, 4, 5 | `node --test test/e158-range-subject.test.mjs` | `# tests 15 # pass 15 # fail 0` | pass |
| AC-E158-4b | `node --test test/e158-range-subject.test.mjs test/e299-check-bookkeeping.test.mjs` | `# tests 53 # pass 53 # fail 0` | pass |
| AC-E158-6 | `node --test test/e158-range-subject.test.mjs test/e331-git-diff-failure.test.mjs test/e322-owners.test.mjs` | `# tests 29 # pass 29 # fail 0` | pass |
| AC-E158-7 | `node --test test/error-code-contract.test.mjs` | `# tests 25 # pass 25 # fail 0` | pass |
| AC-E369-1..5 | `node --test test/e369-acquire-lock-wait.test.mjs` | `# tests 5 # pass 5 # fail 0` | pass |
| AC-E369-6 | `node --test test/e177b-test-lock.test.mjs test/e209-test-lock-publish.test.mjs test/e362-reclaim-guard-publish.test.mjs` | `# tests 30 # pass 30 # fail 0` | pass |
| AC-E158-3 | `node --test test/verify-release.test.mjs test/e320-ci-check-sha.test.mjs test/e326-empty-branch-run-poll.test.mjs` | `# tests 85 # pass 85 # fail 0` | pass |
| AC-E158-8 | `node --test test/e177a-check-cli.test.mjs test/e177a-manifest.test.mjs test/e178b-fanout-unmatched.test.mjs test/e235b-relative-worktree.test.mjs test/e322-owners.test.mjs` | `# tests 41 # pass 41 # fail 0` | pass |
| AC-E158-9 | `grep -c '^lane_local_id: E158-NEW-1$' .current/e158/pending-tickets.md` | `1` | pass |
| AC-LANE-2 | `git diff --quiet <base> -- scripts/mailbox-watch.mjs; echo "exit=$?"` | `exit=0` | pass |
| AC-LANE-3 | `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e158 --base main` | `fanout check: e158 — 19 file(s) changed, 0 out of bounds`, exit 0 | pass |
| AC-E370-4 | `git diff <base> -- test/e177b-test-lock.test.mjs` | 17 insertions, 15 deletions, confined to the AC9 and AC13a bodies/options plus two additive constants | pass |

Test files that must stay unmodified were checked against the base: `verify-release`, `check-version`, `e177a-check-cli`, `e209`, `e362`, `e322`, `error-code-contract` have no diff.

## E370 decision

Method chosen for AC9: judge the nested short-circuit by the nested wrapper's own behaviour, with no outer wall-clock bound at all. The nested wrapper gets a finite `--max-wait`, so if it ever queued on its own lock it would print the AC12 `waiting for test lock held by pid` line immediately and exit 75. The test asserts exit 0, that line absent from stderr, and no leftover lock. Rationale: the old `elapsedMs < 10_000` bound measured two node spawns, so it went red under load while the product was fine; "did it wait on its own lock" is the actual property and is load-independent. A real self-deadlock or self-queue still fails (exit 75 or the node:test timeout).

AC13a: the node:test timeout and the safety-net `--max-wait` are derived from the existing `AGC_E177B_WAIT_MS` knob (`LOAD_SAFE_MAX_WAIT_S` = knob seconds + 25, test timeout = that + 20 s), finite, and the no-overlap, exactly-once and no-leftover-guard assertions are untouched. AC10 and AC13b are not re-tuned.

Load evidence (host load average already 40 to 60 from sibling lanes during these rounds): 3 rounds of 8 concurrent copies of `test/e177b-test-lock.test.mjs`.

| round | load avg (1/5/15 min) before | load avg after | result |
|---|---|---|---|
| 1 | 49.81 / 64.15 / 49.35 | 44.02 / 56.67 / 47.76 | 8 of 8 files green, 19/19 tests each |
| 2 | 44.02 / 56.67 / 47.76 | 42.60 / 54.85 / 47.80 | 8 of 8 files green, 19/19 tests each |
| 3 | 42.60 / 54.85 / 47.80 | 23.67 / 47.84 / 45.61 | 8 of 8 files green, 19/19 tests each |

## Full suite (AC-LANE-1)

`node scripts/test-lock.mjs -- npm test` on HEAD `a2842ccd5391f6b455e0adf705bf5172a643e1c6` (worktree clean, `git status --porcelain` empty; the run queued behind sibling lanes on the test lock): `# tests 3771`, `# pass 3769`, `# fail 0`, `# cancelled 0`, `# skipped 2`, exit 0. The two skips are existing skips, unrelated to this lane. Build: `npm run build` zero errors, `dist/` unchanged. This report and the PASS-hop `.current/e158/` bookkeeping are committed after that run and change no source or test file.
## 2026-10-29T08:32:35.472Z — PASS — by qa-engineer

PASS. Full suite via test-lock on a2842cc: 3769/3771 pass, 0 fail, 2 skipped. New tests: test/e158-range-subject.test.mjs (15), test/e369-acquire-lock-wait.test.mjs (5); re-pinned e331 main...main and e299 ID-MONO-NO-BASE-NOTE; E370 AC9 judged by nested wrapper behaviour, AC13a budget tied to AGC_E177B_WAIT_MS; 3 rounds x 8 concurrent copies of e177b all green at host load 40-60. Evidence: qa_reports/review_T-E158-01.md (covers manifest, AC Execution Log, E370 decision).

