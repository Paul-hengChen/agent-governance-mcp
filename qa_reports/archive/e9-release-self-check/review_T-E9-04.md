covers: T-E9-01, T-E9-02, T-E9-03, T-E9-04

# Review — T-E9-01, T-E9-02, T-E9-03, T-E9-04 (QA round)

## Round 1 — QA — PASS

## Summary
- code-reviewer already APPROVED T-E9-01 (`scripts/verify-release.mjs`) and T-E9-02
  (`content/skill-release-engineer.md` SOP step 9a + read-back step 13 + Escalation
  Routes row) with zero findings — see `review_reports/review_T-E9-01.md`.
- QA build scope (T-E9-04, this round): authored `test/verify-release.test.mjs` — 20
  tests covering VR-1..VR-8 (script fixtures, run against a real, fully-controlled
  git repo — not mocked git output), VR-9/VR-10 (grep-based SOP-text assertions,
  `test/release-staging.test.mjs` precedent), plus 4 security-smoke boundary tests.
- Full regression: `npm test` — 1370/1370 pass, 0 fail (1350 baseline + 20 new).
- T-E9-03 has no code artifact of its own found under this ticket's scope — it is
  the "author tests" backlog task, satisfied by this same test file; folded into
  this PASS alongside T-E9-01/02/04 per the batched `covers:` convention.

## Phase 0.5 — Expected-Red Diff
Phase 0.5: skipped (no `qa_reports/expected-red_e9-release-self-check.txt` manifest declared).

## Phase 1 — Review
Implementation already reviewed in full by code-reviewer (`review_reports/review_T-E9-01.md`,
APPROVED, zero findings across Correctness/Quality/Architecture/Security/Performance).
QA's own read of `scripts/verify-release.mjs` and the SOP diff in
`content/skill-release-engineer.md` concurs — no additional findings. Independently
re-verified during test authoring:
- All 5 checks (`tag-at-HEAD`, `pushed-to-origin`, `check-version`, `CHANGELOG entry`,
  `dist committed+parity`) run unconditionally via the `runCheck` wrapper — no
  short-circuit, confirmed empirically (VR-8 multi-cause test, 4 independent FAILs
  in one run, unrelated `check-version` check still reports OK).
- AC6/AC7 sub-check independence within check 5 confirmed both directions: an
  uncommitted-only dirty tree does NOT also emit the committed-parity mismatch line
  (VR-6), and a clean tree with a stale committed artifact does NOT also emit the
  uncommitted-changes line (VR-7) — the two sub-checks genuinely evaluate independently.
- AC4's stderr propagation is verbatim, not re-derived: `check-version.mjs`'s own
  `check:version — version mismatch: package.json=X index.ts=Y` string appears
  unmodified inside verify-release's `FAIL: check-version.mjs failed: ...` line (VR-4).
- AC3's "never silently skip" claim holds for all three sub-cases: no upstream
  configured, local commits ahead of a configured upstream, and an unreachable
  origin (fetch failure) — all three are FAILs, not skips (VR-3, 4 fixtures).
- Security smoke: version-argument regex validation (`^\d+\.\d+\.\d+$`) runs before
  any interpolation into `execFileSync`/`spawnSync` (array-argv, no shell) — a
  shell-metacharacter payload and a 100,000-char oversized payload both hit the
  same "invalid target version" rejection branch and never execute or crash
  (VR-SEC-3, VR-SEC-4). An empty-string arg is falsy in JS and silently takes the
  same fallback-to-package.json-version branch as an omitted arg (VR-SEC-2) — this
  is documented, verified behavior, not a defect (no AC governs empty-string
  handling specifically; it never reaches an unvalidated code path either way).

### 3a. Copy Audit Gate
All 16 `Copy / Strings` entries in `specs/e9-release-self-check.md` verified
verbatim via direct grep against the implementation (independent re-check of
code-reviewer's finding):
```
$ grep -n 'target version\|FAIL: tag\|FAIL: no upstream\|FAIL: HEAD\|FAIL: could not verify\|FAIL: check-version\|FAIL: CHANGELOG\|FAIL: dist\|OK: ${name}\|ALL CHECKS PASSED\|FAILED (' scripts/verify-release.mjs
```
All 14 script-side strings (vr.target-line, vr.fail.tag-missing, vr.fail.tag-not-head,
vr.fail.no-upstream, vr.fail.not-pushed, vr.fail.fetch-error, vr.fail.check-version,
vr.fail.changelog-missing, vr.fail.dist-uncommitted, vr.fail.dist-absent-at-head,
vr.fail.dist-unparseable, vr.fail.dist-mismatch, vr.ok-line, vr.all-pass, vr.some-fail)
present verbatim (interpolation placeholders match spec's `{version}` /
`{tagSha}` / `{headSha}` / etc. style). The remaining SOP-side string
(vr.escalation-note) confirmed verbatim in `content/skill-release-engineer.md`'s
Escalation Routes row via `grep -n "release self-check failed" content/skill-release-engineer.md`.
No drift, no coverage gap.

### 3b. Visual Audit Gate
N/A — spec's Visual Tokens and Visual Widgets tables are both explicitly empty
("feature has no visual literals" / "no non-primitive widgets"). CLI script + SOP
prose only.

## Phase 1.5 — Visual Compare
Phase 1.5: skipped (no `design/e9-release-self-check.md`, no Visual Baselines declared).

## Phase 3 — Tests

### Spec-to-Test map
| AC | Test(s) | Result |
|---|---|---|
| AC1 (tag missing) | VR-1 | PASS |
| AC2 (tag exists, not at HEAD) | VR-2 | PASS |
| AC3 (no upstream / not pushed / fetch failure) | VR-3 (x4 fixtures) | PASS |
| AC4 (check-version.mjs propagation, verbatim stderr) | VR-4 | PASS |
| AC5 (CHANGELOG missing entry) | VR-5 (x2 fixtures) | PASS |
| AC6 (dist uncommitted changes) | VR-6 | PASS |
| AC7 (committed dist parity mismatch / absent) | VR-7 (x2 fixtures) | PASS |
| AC8 (all pass; multi-cause no-short-circuit) | VR-8 (x2 fixtures) | PASS |
| AC9 (SOP step 9a + Escalation Routes row) | VR-9 | PASS |
| AC10 (post-closing-write tw_get_state read-back) | VR-10 | PASS |
| (security smoke, Phase 3d) | VR-SEC-1..4 | PASS |

### Coverage Gate
`test/verify-release.test.mjs` is new — 20 tests, one dedicated test (or fixture
group) per AC plus 4 security-smoke boundary tests. `scripts/verify-release.mjs`
(178 lines) has every branch exercised: all 5 `runCheck` bodies, both success and
failure paths of each, the version-arg validation branch (explicit/omitted/empty/
malformed/oversized), and the final pass/fail summary branch. Line-coverage
tooling (`c8`/`nyc`) is not wired into this repo's `npm test`; noting explicitly
per SOP 6c — coverage is asserted by branch enumeration above, not a tool-measured
percentage.

### Security Smoke Tests
- Boundary inputs: omitted arg (VR-SEC-1), empty string (VR-SEC-2), shell-
  metacharacter payload (VR-SEC-3), oversized 100,000-char payload (VR-SEC-4) —
  all four confirmed to never execute unintended commands or crash, per the
  Correctness notes above.
- No auth/permission surface in this feature (local CLI script + SOP prose only)
  — N/A.

## AC Execution Log

Executed the 10 `proof:`-annotated ACs in `specs/e9-release-self-check.md`, in order.
AC1-AC8 map to named tests in `test/verify-release.test.mjs`, run via
`--test-name-pattern`; AC9/AC10 are grep commands run directly.

**AC1** — proof: test VR-1 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-1 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 1
# pass 1
# fail 0
```
Verdict: **PASS**.

**AC2** — proof: test VR-2 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-2 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 1
# pass 1
# fail 0
```
Verdict: **PASS**.

**AC3** — proof: test VR-3 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-3 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 4
# pass 4
# fail 0
```
(4 fixtures: no-upstream, not-pushed, unreachable-origin, no-origin-remote — all
independently FAIL, none silently skipped.)
Verdict: **PASS**.

**AC4** — proof: test VR-4 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-4 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 1
# pass 1
# fail 0
```
Verdict: **PASS**.

**AC5** — proof: test VR-5 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-5 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 2
# pass 2
# fail 0
```
Verdict: **PASS**.

**AC6** — proof: test VR-6 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-6 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 1
# pass 1
# fail 0
```
Verdict: **PASS**.

**AC7** — proof: test VR-7 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-7 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 2
# pass 2
# fail 0
```
Verdict: **PASS**.

**AC8** — proof: test VR-8 in `test/verify-release.test.mjs`.
```
$ node --test --test-name-pattern="VR-8 " test/verify-release.test.mjs 2>&1 | tail -8
# tests 2
# pass 2
# fail 0
```
Verdict: **PASS**.

**AC9** — proof: `grep -n "verify-release.mjs" content/skill-release-engineer.md`
finds both the new numbered SOP step and the new Escalation Routes row (test
VR-9 in `test/verify-release.test.mjs`, grep-based).
```
$ grep -n "verify-release.mjs" content/skill-release-engineer.md
70:9a. **Release self-check** (E9, mandatory — post-push/gh-release, pre-closing-write): run `node scripts/verify-release.mjs vX.Y.Z`. ...
89:| release self-check reports any FAIL (`node scripts/verify-release.mjs` exits non-zero, SOP step 9a) | Blocked | ... | human |
exit=0
```
Both hits confirmed: line 70 is the numbered SOP step (sits after step 9
"GitHub release" and before step 12 "Closing write"), line 89 is the
Escalation Routes row (Blocked, `human`). Also automated via
`node --test --test-name-pattern="VR-9 " test/verify-release.test.mjs` (1/1 pass).
Verdict: **PASS**.

**AC10** — proof: `grep -n "tw_get_state" content/skill-release-engineer.md`
finds the post-closing-write read-back instruction (test VR-10 in
`test/verify-release.test.mjs`, grep-based).
```
$ grep -n "tw_get_state" content/skill-release-engineer.md
13:...Verify in SOP step 1 by inspecting the JSON returned from `tw_get_state`...
38:1. `tw_get_state` → `tw_detect_drift`. ...
76:13. **Closing-write read-back** (E9, AC10 — mandatory, BEFORE the final reply): immediately after the step-12 write returns, call `tw_get_state` again and confirm the returned `last_agent`, `status`, `next_role`, and `pending_notes` match exactly what step 12 just wrote ...
exit=0
```
Line 76 confirms the step-13 read-back instruction, positioned after step 12
(Closing write) and requiring an exact match on all 4 named fields before the
final "Done. Released <tag>." reply, with an explicit STOP-on-mismatch clause.
Also automated via `node --test --test-name-pattern="VR-10" test/verify-release.test.mjs`
(1/1 pass).
Verdict: **PASS**.

10/10 proof-annotated ACs: PASS.

## Phase 4 — Run
- Build: no compile step required for this feature (script + prompt-text only;
  no `.ts` source touched). `npm run build` re-verified clean regardless (see
  full regression below — no new compile errors).
- CI Runnability: `node --test test/verify-release.test.mjs` and `npm test` both
  run headlessly, zero human interaction, zero network access required (the
  "origin" remote in every fixture is a local temp bare repo, not a real network
  endpoint).
- Full regression:
```
$ npm test 2>&1 | tail -8
# tests 1370
# pass 1370
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
1350 pre-existing + 20 new (`test/verify-release.test.mjs`) = 1370, reconciles
exactly. Zero regressions, zero skipped/todo.

**PASS** — T-E9-01, T-E9-02, T-E9-03, T-E9-04 all verified: implementation
matches every AC and Copy/Strings entry with zero findings (code-reviewer
APPROVED + QA independent re-check), 20 new tests give AC1-AC10 dedicated
coverage plus 4 security-smoke boundary tests, full regression green at
1370/1370.
## 2026-07-12T12:58:59.851Z — PASS — by qa-engineer

PASS — T-E9-01 (scripts/verify-release.mjs, 5 independent release checks), T-E9-02 (skill-release-engineer.md SOP step 9a + Escalation Routes row + step 13 read-back), T-E9-03 (code-reviewer's own review, APPROVED zero findings, review_reports/review_T-E9-01.md), T-E9-04 (this round — authored test/verify-release.test.mjs, 20 tests: VR-1..VR-8 run against a real, fully-controlled temp git repo with a local bare origin remote per AC1-AC8, VR-9/VR-10 grep-based SOP-text assertions per AC9/AC10, plus 4 security-smoke boundary tests). Independent Copy Audit re-check: all 16 spec Copy/Strings entries verbatim in source. No Visual Tokens/Widgets (N/A, CLI+SOP only). Full regression: npm test 1370/1370 pass, 0 fail (1350 baseline + 20 new). Phase 3.5 AC Execution Log: 10/10 proof-annotated ACs executed and PASS — see qa_reports/review_T-E9-04.md. Phase 0.5: skipped, no expected-red manifest. next_role intentionally omitted — release (T-E9-REL) is a human decision, PASS is terminal for auto-routing.

## 2026-07-12T12:59:22.584Z — PASS — by qa-engineer

PASS — T-E9-01 (scripts/verify-release.mjs, 5 independent release checks), T-E9-02 (skill-release-engineer.md SOP step 9a + Escalation Routes row + step 13 read-back), T-E9-03 (code-reviewer's own review, APPROVED zero findings, review_reports/review_T-E9-01.md), T-E9-04 (this round — authored test/verify-release.test.mjs, 20 tests: VR-1..VR-8 run against a real, fully-controlled temp git repo with a local bare origin remote per AC1-AC8, VR-9/VR-10 grep-based SOP-text assertions per AC9/AC10, plus 4 security-smoke boundary tests). Independent Copy Audit re-check: all 16 spec Copy/Strings entries verbatim in source. No Visual Tokens/Widgets (N/A, CLI+SOP only). Full regression: npm test 1370/1370 pass, 0 fail (1350 baseline + 20 new). Phase 3.5 AC Execution Log: 10/10 proof-annotated ACs executed and PASS — see qa_reports/review_T-E9-04.md ## AC Execution Log. Phase 0.5: skipped, no expected-red manifest. next_role intentionally omitted — release (T-E9-REL) is a human decision, PASS is terminal for auto-routing.

