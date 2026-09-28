# QA Review: T-E229-01

Spec: `specs/e229-history-independent-scope-tests.md` — AC1, AC2.
Task: make `test/e130-lane-default.test.mjs`'s AC4 zero-code-diff test and
AC14 scope-containment test history-independent (guard `121ddc8`/`5896bdd`
via `git rev-parse --verify`; `t.skip` + loud `HISTORY-DEPENDENT AC SKIPPED`
notice when either is absent; unchanged behavior when both are present).

Single-role judge dispatch (Constitution §3.1): qa-engineer is both author
and judge for this ticket (test-authorship + one docs line, no
sr-engineer/code-reviewer/architect in this chain, per integrator's fixed
scope cut and the PM cut approved at `1d465e3`).

## Phase 0.5 — Expected-Red Diff

Phase 0.5: skipped (no expected-red manifest declared — `dispatch_mode` is
absent/"feature", and no `qa_reports/expected-red_e229-history-independent-scope-tests.txt`
exists).

## Phase 1 — Review / Spec-to-Test Map

| AC | test file | test name | behavior |
|---|---|---|---|
| AC1 | `test/e130-lane-default.test.mjs` | `AC4: zero code changes accompany this ticket outside content/** — git diff --stat over bin/ tools/ scripts/ from the fan-out base is empty` | guards `121ddc8`/`5896bdd` via `git rev-parse --verify <sha>^{commit}`; `t.skip(reason)` + `console.warn` containing `HISTORY-DEPENDENT AC SKIPPED` + the unresolved sha + the unchecked invariant when either is absent; unchanged `git diff --stat` assertion when both resolve |
| AC2 | `test/e130-lane-default.test.mjs` | `AC14: every path changed since 121ddc8 matches this lane's owned-files list, with zero forbidden paths` | identical guard-and-skip-loudly treatment, same two SHAs, same notice contract |

Both tests are inherently about a historical diff (a specific past lane's own
commit range, `121ddc8..5896bdd`) — no current-tree reframing exists, per the
spec's own carve-out. The shared helper `skipIfHistoryAbsent(t, invariant,
...shas)` (defined once per test file, duplicated across
`test/e130-lane-default.test.mjs` and `test/e178a-integrator-role.test.mjs`
since no shared test-support module exists) wraps `git rev-parse --verify
<sha>^{commit}`, and on the first unresolvable sha calls `console.warn(...)`
with the literal substring `HISTORY-DEPENDENT AC SKIPPED` plus the missing
sha and the invariant text, then `t.skip(...)`, then returns `true` so the
caller bails out before attempting the now-impossible `git diff`.

Copy Audit Gate: spec's *Copy / Strings* table has one entry, `skip.notice` =
`HISTORY-DEPENDENT AC SKIPPED`. Verified verbatim in
`skipIfHistoryAbsent`'s `notice` string (both test files) — grepped and
confirmed present in the loud-skip output (see AC Execution Log and the
snapshot-run grep under T-E229-03's evidence file).

Visual Audit Gate: N/A — spec's Visual Tokens / Visual Widgets tables are
both empty (feature has no visual literals).

Phase 1.5: skipped (no `design/e229-history-independent-scope-tests.md`,
no Visual Baselines declared).

## AC Execution Log

**AC1** — proof: `node --test --test-name-pattern="AC4: zero code changes" test/e130-lane-default.test.mjs`

```
# Subtest: AC4: zero code changes accompany this ticket outside content/** — git diff --stat over bin/ tools/ scripts/ from the fan-out base is empty
ok 1 - AC4: zero code changes accompany this ticket outside content/** — git diff --stat over bin/ tools/ scripts/ from the fan-out base is empty
# tests 1
# pass 1
# fail 0
# skipped 0
```
Verdict: PASS. Both SHAs resolve in this repo, so the un-guarded assertion
ran and passed (as the AC requires when both SHAs are resolvable). The
guard-and-skip branch itself was separately exercised (temporary substitution
of an unresolvable fake sha, then reverted before commit — see below) and
confirmed to report `skipped` with the `HISTORY-DEPENDENT AC SKIPPED` notice,
not a failure. The single-commit snapshot run (T-E229-03's evidence) is the
canonical proof of the skip path on a real history-absent tree.

**AC2** — proof: `node --test --test-name-pattern="AC14: every path changed" test/e130-lane-default.test.mjs`

```
# Subtest: AC14: every path changed since 121ddc8 matches this lane's owned-files list, with zero forbidden paths
ok 1 - AC14: every path changed since 121ddc8 matches this lane's owned-files list, with zero forbidden paths
# tests 1
# pass 1
# fail 0
# skipped 0
```
Verdict: PASS, same reasoning as AC1.

**Guard-path sanity check** (pre-commit, reverted — not part of the shipped
diff): temporarily substituted `"121ddc8"` with a nonexistent
`"deadbeef0000"` in the AC1 test's `skipIfHistoryAbsent` call and re-ran:

```
# HISTORY-DEPENDENT AC SKIPPED: commit deadbeef0000 is not resolvable in this repo's history — skipping check of: zero code-diff over bin/ tools/ scripts/ across e130's own commit range 121ddc8..5896bdd
ok 1 - AC4: zero code changes accompany this ticket outside content/** — git diff --stat over bin/ tools/ scripts/ from the fan-out base is empty # SKIP HISTORY-DEPENDENT AC SKIPPED: ...
# pass 0
# skipped 1
```
Confirmed: reported as `skipped`, never `failed`, notice printed. Reverted
the substitution immediately after (working tree diffed clean against the
committed version before the T-E229-01/02/04 commit).

## Phase 3 — Test File Discovery

Per dispatch brief's Test-file placement line: edit `test/e130-lane-default.test.mjs`
and `test/e178a-integrator-role.test.mjs` in place — no new test files
needed or created.

## Phase 4 — Run

Full lane suite (post-commit `7d84201`, clean tree): `2818/2818` pass, 0
fail, 0 skipped (see T-E229-03's evidence file for the full-suite command and
the single-commit-snapshot run).

## Verdict

**PASS.**
## 2026-09-27T15:06:44.925Z — PASS — by qa-engineer

All 4 tasks PASS. T-E229-01/02: test/e130-lane-default.test.mjs AC4/AC14 and test/e178a-integrator-role.test.mjs AC3/AC4/AC6(split)/AC15 made history-independent per spec AC1-AC6, guarded via git rev-parse --verify + t.skip + loud HISTORY-DEPENDENT AC SKIPPED notice; verified both the pass path (SHAs present, 121ddc8/5896bdd/3c72a83 all resolve here) and the skip path (temporary fake-sha substitution, reverted before commit). T-E229-03: AC7 — lane npm test 2818/2818 pass/0 fail/0 skipped; git-archive HEAD single-commit snapshot in $TMPDIR (never repo root, node_modules symlinked) reports 2815 pass/0 fail/3 skipped, exactly the 3 historical-only checks (e130 AC4, e130 AC14, e178a AC6-historical), each carrying the HISTORY-DEPENDENT AC SKIPPED notice (grepped, 6 occurrences = 2 per skip x 3). T-E229-04: AC8 guard sentence added to docs/lane-protocol.md §3. Commit 7d84201. Per-id evidence in qa_reports/review_T-E229-0{1,2,3,4}.md.

