covers: T-E287-01, T-E324-01, T-E325-01, T-E326-01, T-E287-02, T-E324-02, T-E325-02, T-E326-02

# QA review — e287-finish-findings-and-small-fixes (lane e287)

Verifies sr tasks T-E287-01, T-E324-01, T-E325-01, T-E326-01 (code-reviewer round 2 APPROVED).

Phase 0.5: skipped (no expected-red manifest declared).
Phase 1.5: skipped (no Visual Baselines declared).
Phase 3.5: the spec's proof lines are covered by the tests below (commands recorded under AC Execution Log).
Phase 3 placement: new tests under the dispatch brief's pre-authorized names; one allowed edit in `test/verify-release.test.mjs`.

## Copy Audit (Phase 3a)

Architecture Copy/Strings fragments confirmed in output by the tests: `agc feature finish —`, `pending-tickets.md`,
`not committed on <rev>`, `<N> unapplied finding(s) were not allocated`, `<id> — <title>`,
`[target_repo: <repo> …]`, `names target_repo <repo>`, `human ruling`, `+ K malformed pending-ticket block(s)`,
usage sentence. Validator text `target_repo must be a non-empty string`, Q5 reason `depends on a target_repo finding`.
E326 reason `no completed CI runs found on <label>` and the lenient WARN are byte-identical to base.
No visual tokens (N/A).

## AC to test map

| AC | test (file: name fragment) |
|---|---|
| AC-E287-1, 3, 9 (shipped) | test/e287-finish-findings.test.mjs: `AC-E287-1/3/9` |
| AC-E287-2, 3, 9 (abandoned) | `AC-E287-2/3/9` |
| AC-E287-3 tracked-dir/ignored-file | `AC-E287-3: tracked .current/<lane>/ ...` (shipped, abandoned), differing-destination refusal |
| AC-E287-4 | `AC-E287-4: no pending file anywhere` + existing suites (all green, no re-pin) |
| AC-E287-5 | unit cases valid/bare/empty/whitespace/number/list/boolean + end-to-end refusal |
| AC-E287-6 | shipped + abandoned one-local-one-external, backlog diff exactly one row, listing line, archived under `## Applied` |
| AC-E287-7 | external-only, no backlog (shipped, abandoned) |
| AC-E287-8 | forced late failure + re-run; `agc check` orphan scan external-only vs local |
| AC-E287-10 | usage test (`agc feature`); the finding block exists in `.current/e287/pending-tickets.md` (E287-NEW-1) |
| Q4 / Q5 | parser archived exemption; allocator never numbers external; dependency reason |
| R1 regression pins | `R1-s8` (committed local, forced failure, re-run silent), `R1-s5` (target_repo-only, no backlog), `R1-s11` (never-committed warns on both runs, copy byte-identical) |
| AC-E324-1, 2 | test/e324-zod-telemetry-under-current.test.mjs (lane dir, deep dir, trailing slash, `my.current-ws`, `<ws>/.current/..`, `.currentx`/`x.current`) |
| AC-E325-1, 2 | test/e325-drift-version-peek-race.test.mjs (forward/reverse injected rename, sweep over call index, read-only, neither present, vanishing file, unparseable, no frontmatter) |
| AC-E326-1, 2, 3, 5 | test/e326-empty-branch-run-poll.test.mjs |
| AC-E326-7 (option A) | VR-15 gets only `AGC_VERIFY_CI_WAIT_SECONDS: "0"`; two new Check 6 cases at the end of test/verify-release.test.mjs |
| AC-E326-4, 6 | e320 suite unmodified and green; VR-22 / VR-23 untouched (diff touches neither) |

## AC Execution Log

- AC-E287-10 proof: `node bin/agc-init.mjs feature` prints the new `target_repo: <repo> belongs to another repo` sentence (matched by test); `.current/e287/pending-tickets.md` holds the `E287-NEW-1` block (and E287-NEW-2 from review).
- AC-E324-3 / AC-E325-4 proof: `npm run build` leaves `git status` clean (dist matches source); `git diff dac6069 --stat` lists `tools/registry.ts`, `tools/drift.ts` and their `dist/tools/*`.
- AC-E325-3 proof: `git diff dac6069 --name-only` does not list `tools/handoff-parse.ts`.
- AC-LANE-3: new tests use in-test fixtures only; none reads a real `specs/fanout-*.md`, none diffs against a fixed sha.

## Negative control

New suites were run against a copy of base `dac6069` (outside the worktree): 34 of the new cases fail there (all behaviour cases for O6, D4, E324, E325 and the E326 polling cases), while the regression pins that must hold at base (R1-s8 and the unchanged-path cases) pass. Confirms the tests detect the defects.

## Re-pins

None. No existing test file was changed except the pre-authorized VR-15 env pin.

## Notes

- `agc check` prints 3 advisory comment-discipline warnings in `tools/lane-ticket-allocation.ts` / one other file (long comment block); advisory, code-reviewer territory, not a QA failure.
- `git diff dac6069 --name-only` also lists `specs/e287-*`, `review_reports/`, `.current/e287/` bookkeeping (lane process files).
## 2026-10-17T09:20:51.662Z — PASS — by qa-engineer

PASS. Full suite via test-lock on a clean tree at lane HEAD 9f9f9ca: 3281 pass / 3284 total, 0 fail, 3 skipped (pre-existing skips). New tests: test/e287-finish-findings.test.mjs (29), e324-zod-telemetry-under-current (6), e325-drift-version-peek-race (8), e326-empty-branch-run-poll (7), plus two Check 6 cases and the VR-15 env pin in test/verify-release.test.mjs (option A). Review round-2 pins covered (R1-s8, R1-s5, R1-s11). Negative control on base dac6069: 34 new behaviour cases red there, regression pins green. VR-22 and VR-23 untouched and green; e320 unmodified and green. Zero re-pins. Full AC map in qa_reports/review_T-E287-02.md.

