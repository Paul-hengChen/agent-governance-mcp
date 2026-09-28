# QA Review: T-E229-03

Spec: `specs/e229-history-independent-scope-tests.md` — AC7.
Task: verify AC7 — full suite green in the lane AND in a `git archive HEAD`
single-commit snapshot (nested `git init` + symlinked `node_modules`);
confirm the 3 historical-only checks report skipped-with-notice there, not
failed.

Depends on: T-E229-01, T-E229-02 (both PASS — see their evidence files).

## Phase 4 — Run (lane)

Confirmed green in the lane FIRST, per AC7's own ordering requirement, with a
clean tree (no untracked files) after commit `7d84201`:

```
$ cd <lanes-root>/e229 && git status --porcelain   # (empty)
$ npm test
...
# tests 2818
# suites 1
# pass 2818
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## AC Execution Log

**AC7** — proof:
```
cd "${TMPDIR:-/tmp}" && rm -rf e229-snapshot-check && mkdir e229-snapshot-check && \
(cd <lanes-root>/e229 && git archive HEAD) | tar -x -C e229-snapshot-check && \
cd e229-snapshot-check && git init -q && git add -A && git commit -q -m snapshot && \
ln -s <lanes-root>/e229/node_modules node_modules && \
npm test
```

Executed exactly as above (`"${TMPDIR:-/tmp}"`, never the repo root; the
snapshot's `node_modules` symlinked to the lane's). Snapshot created at
`$TMPDIR/e229-snapshot-check`
(macOS `$TMPDIR`), single commit `188f156` ("snapshot"), no `121ddc8` /
`5896bdd` / `3c72a83` reachable in its history (single-commit repo, as the
E104 option (iii) recreation will produce).

Result:
```
1..2805
# tests 2818
# suites 1
# pass 2815
# fail 0
# cancelled 0
# skipped 3
# todo 0
# duration_ms 137262.049791
```

`0` failures, `3` skipped — exactly the 3 historical-only checks
(e130 AC4, e130 AC14, e178a AC6-historical), confirmed by name:

```
$ grep -n "^not ok" /tmp/e229-snapshot-test.out    # -> 0 matches
$ grep -n "^# fail" /tmp/e229-snapshot-test.out    # -> "# fail 0"
```

```
ok 777 - AC4: zero code changes accompany this ticket outside content/** — git diff --stat over bin/ tools/ scripts/ from the fan-out base is empty # SKIP HISTORY-DEPENDENT AC SKIPPED: commit 121ddc8 is not resolvable in this repo's history — skipping check of: zero code-diff over bin/ tools/ scripts/ across e130's own commit range 121ddc8..5896bdd
ok 787 - AC14: every path changed since 121ddc8 matches this lane's owned-files list, with zero forbidden paths # SKIP HISTORY-DEPENDENT AC SKIPPED: commit 121ddc8 is not resolvable in this repo's history — skipping check of: scope containment — every path changed across e130's own commit range 121ddc8..5896bdd matches its owned-files list
ok 935 - AC6 (historical): const-15 §6 addition stays terse vs base # SKIP HISTORY-DEPENDENT AC SKIPPED: commit 3c72a83 is not resolvable in this repo's history — skipping check of: const-15 §6 addition added-lines-count (<= 6) vs base 3c72a83
```

**Skip-notice grep** (T-E229-03's own additional verification, per dispatch
instructions — "confirm the 3 skip notices actually appear in output"):

```
$ grep -c "HISTORY-DEPENDENT AC SKIPPED" /tmp/e229-snapshot-test.out
6
```
6 occurrences = 2 per skipped test (one `console.warn` line printed to
stdout/stderr at skip time, one echoed back in the TAP `# SKIP <reason>`
trailer on the `ok` line) × 3 skipped tests. All 3 distinct invariants named
(the two e130 SHAs' checks and the e178a const-15 terseness check) appear
with their respective missing sha (`121ddc8` ×2, `3c72a83` ×1) named in the
notice text, per AC1/AC2/AC5's contract.

Post-run snapshot worktree status: `git status --porcelain` in the snapshot
directory was empty (no re-baseline artifacts left behind by the run).

Verdict: PASS. AC7 fully satisfied — 0 failures, exactly the 3 expected
historical-only skips, each with its loud notice confirmed present.

## Phase 4 — Run (lane, re-confirmed)

Lane test run above (2818/2818, 0 fail, 0 skipped) satisfies the "both must
pass" requirement AC7 states before the snapshot run.

## Verdict

**PASS.**
## 2026-09-27T15:06:44.925Z — PASS — by qa-engineer

All 4 tasks PASS. T-E229-01/02: test/e130-lane-default.test.mjs AC4/AC14 and test/e178a-integrator-role.test.mjs AC3/AC4/AC6(split)/AC15 made history-independent per spec AC1-AC6, guarded via git rev-parse --verify + t.skip + loud HISTORY-DEPENDENT AC SKIPPED notice; verified both the pass path (SHAs present, 121ddc8/5896bdd/3c72a83 all resolve here) and the skip path (temporary fake-sha substitution, reverted before commit). T-E229-03: AC7 — lane npm test 2818/2818 pass/0 fail/0 skipped; git-archive HEAD single-commit snapshot in $TMPDIR (never repo root, node_modules symlinked) reports 2815 pass/0 fail/3 skipped, exactly the 3 historical-only checks (e130 AC4, e130 AC14, e178a AC6-historical), each carrying the HISTORY-DEPENDENT AC SKIPPED notice (grepped, 6 occurrences = 2 per skip x 3). T-E229-04: AC8 guard sentence added to docs/lane-protocol.md §3. Commit 7d84201. Per-id evidence in qa_reports/review_T-E229-0{1,2,3,4}.md.

