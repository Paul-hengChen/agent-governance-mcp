# QA Review — T-E239-01, T-E239-02

covers: T-E239-01, T-E239-02

## Summary
- Feature: `e239-init-subdir-exclude` (lane e108). T-E239-01 (sr-engineer's implementation,
  commit fb93a88) is code-reviewer APPROVED (`review_reports/review_T-E239-01.md`, 14/14 ACs).
  This review is QA's Phase 1-4 pass plus T-E239-02 (test authoring).
- New file: `test/e239-init-subdir-exclude.test.mjs` (14 tests, AC1/AC2/AC4-AC13 + 2 boundary
  smoke cases). Extended `test/e106-init-artifacts-flag.test.mjs` with one additive regression
  case (AC3) — no existing assertion in that file was touched.
- Verdict: PASS both T-E239-01 and T-E239-02.

## Phase 0.5 — Expected-Red Diff
Skipped (no expected-red manifest declared) — no `qa_reports/expected-red_e239-init-subdir-exclude.txt`
exists, consistent with the code-reviewer's finding that sr-engineer wrote no repro/expected-red
file (feature mode, not bugfix mode; the spec's Cut amendments moved the red-against-base run to
qa-engineer instead — see the repro note below).

## Repro-first (qa-owned, per spec "Cut amendments" / Dependencies "Repro (feature mode, qa-owned)")
Per the spec, before authoring the suite I ran the AC1/AC2 subdir scenario against the lane base's
`bin/agc-init.mjs` (extracted via `git show d0c66f0:bin/agc-init.mjs` into a throwaway package
root under `$TMPDIR`, so `installedVersion()`/adapter templates resolved) in a scratch git repo
with a `sub/` subdirectory, cwd = `sub/`:

```
=== AC1/AC2 repro against lane base (d0c66f0) ===
agc init (cwd=sub) exit: 0
stdout: Created: .current/.config.json, tasks.md, CLAUDE.md, AGENTS.md, .antigravityrules
agc init — added /.current/, /tasks.md, /qa_reports/, /review_reports/ to the shared info/exclude

--- .git/info/exclude ---
/.current/
/tasks.md
/qa_reports/
/review_reports/

AC1 (subdir-prefixed rules written): FAIL (RED, as expected pre-fix)
check-ignore sub/.current/anything -> 1 (no match)
check-ignore sub/tasks.md -> 1 (no match)
AC2 (scaffold actually ignored): FAIL (RED, as expected pre-fix)
```
Confirmed: the base writes the un-prefixed, root-anchored rules regardless of `cwd=sub`, and
neither `sub/.current/anything` nor `sub/tasks.md` is actually ignored by them — the exact defect
this ticket fixes. Re-ran the same scenario (`test/e239-init-subdir-exclude.test.mjs`'s AC1/AC2
cases) against the fixed `bin/agc-init.mjs` afterward — both green (see Phase 4 below). This
one-off driver script is not committed (not a standing regression check, just the required
red-before-fix evidence for this cut).

## Phase 1 — Review (implementation)
Deferred to code-reviewer's `review_reports/review_T-E239-01.md` (APPROVED, 14/14 ACs, root-cwd
byte-identical to base verified). QA's own read of `bin/agc-init.mjs` (repoRelativeWorkspacePrefix,
artifactExcludeRulesForPrefix, artifactPathsForPrefix, trackedArtifactPaths, the AC8 refusal branch
in `runInit`, and the mirrored branches in `checkArtifactsDrift`) turned up no additional
correctness defect beyond code-reviewer's F1 follow-up (backslash/control chars — see below).

### Copy Audit Gate (3a)
All three spec Copy/Strings entries verified verbatim by exact-regex test assertions against real
CLI stdout/stderr, not by reading the diff:
- `init.local.already-tracked-warning.subdir-qualifier` — `test/e239-init-subdir-exclude.test.mjs`
  AC4 case asserts the full qualified message (`Untrack them with (run from the repository root):`
  + `git rm -r --cached sub/.current sub/tasks.md` + the history-note line), and the new
  `test/e106-init-artifacts-flag.test.mjs` AC3-regression case asserts the root-cwd form has NO
  qualifier and the un-qualified `Untrack them with:` prefix.
- `init.subdir.unsafe-refusal` — AC8 case asserts the full message verbatim (including the
  "(one of * ? [ ])" charset and the `--artifacts=repo` escape-hatch sentence).
- `check.subdir.unsafe-advisory` — AC13 case asserts the full message verbatim.
No drift, no coverage gap.

### Visual Audit Gate (3b)
N/A — spec's Visual Tokens / Visual Widgets tables are both explicitly "N/A — feature has no
visual literals (CLI-only)". No stylistic literals to source-check.

## Phase 1.5 — Visual Compare
Skipped (no Visual Baselines declared) — no `design/e239-init-subdir-exclude.md` file exists (CLI
mechanism, no design source, per spec).

## Phase 3 — Tests
Test-file placement (dispatch brief): create `test/e239-init-subdir-exclude.test.mjs` — done.
`test/e106-init-artifacts-flag.test.mjs` extended with one additive regression case (AC3) — done,
per the wave-2 fanout manifest's ownership carve-out; its existing 17 assertions are byte-unchanged
(confirmed by diff — only new text appended after the last existing test).

### Spec-to-Test Map
| AC | Test case | File |
|---|---|---|
| AC1 | "AC1: subdir default-local writes subdir-prefixed exclude rules" | test/e239-init-subdir-exclude.test.mjs |
| AC2 | "AC2: scaffold created under subdir is actually ignored by the written rules" | test/e239-init-subdir-exclude.test.mjs |
| AC3 | test/e106-init-artifacts-flag.test.mjs's existing 55/55 suite passes unmodified + "AC3 regression (E239): root cwd emits no subdir-qualifier text and no prefixed rule strings" | test/e106-init-artifacts-flag.test.mjs |
| AC4 | "AC4: subdir already-tracked warning is subdir-prefixed and repo-root-qualified" | test/e239-init-subdir-exclude.test.mjs |
| AC5 | "AC5: subdir omitted-flag tracked detection uses subdir-prefixed paths" | test/e239-init-subdir-exclude.test.mjs |
| AC6 | "AC6: subdir re-run is idempotent, no duplicate exclude lines" | test/e239-init-subdir-exclude.test.mjs |
| AC7 | "AC7: subdir repo mode still writes no exclude rules" | test/e239-init-subdir-exclude.test.mjs |
| AC8 | "AC8: gitignore-metacharacter subdir name refuses local mode cleanly" (2 subcases: omitted flag, explicit --artifacts=local) | test/e239-init-subdir-exclude.test.mjs |
| AC9 | "AC9: gitignore-metacharacter subdir name is fine under explicit repo mode" | test/e239-init-subdir-exclude.test.mjs |
| AC10 | "AC10: agc check subdir declared-and-matching is silent" | test/e239-init-subdir-exclude.test.mjs |
| AC11 | "AC11: agc check subdir drift detection mirrors the root case" (2 subcases: missing rules, tracked path) | test/e239-init-subdir-exclude.test.mjs |
| AC12 | "AC12: agc check does not cross-contaminate root and subdir artifact rule sets" | test/e239-init-subdir-exclude.test.mjs |
| AC13 | "AC13: agc check advises rather than mis-tests on a gitignore-unsafe subdir path" | test/e239-init-subdir-exclude.test.mjs |
| AC14 | `grep -n 'wildcard' docs/install.md` (see AC Execution Log below) | docs/install.md |

Plus 2 boundary/security smoke cases (SOP Phase 3d, always included): a wildcard segment nested
two levels deep (`pkgs/wei[rd]`) is still refused naming the correct inner segment, and a plain
root-cwd sanity spot-check that the subdir fix leaves root behavior alone.

### Coverage Gate
All new/modified surface in `bin/agc-init.mjs` for this ticket (the six new/changed functions
listed in the spec's Dependencies section) is exercised by at least one AC test above; tooling
(`c8`/`nyc`) is not wired into this repo's `npm test`, so line-coverage % is not machine-measured —
noted explicitly per SOP 6c.

## Phase 3.5 — AC Execution Log
The spec declares a `proof:` line for every one of AC1-AC14. Executed each; command + outcome:

| AC | proof | command | result |
|---|---|---|---|
| AC1 | test/e239-init-subdir-exclude.test.mjs "AC1: ..." | `node --test test/e239-init-subdir-exclude.test.mjs` | green |
| AC2 | same file, "AC2: ..." | (same run) | green |
| AC3 | test/e106-init-artifacts-flag.test.mjs's existing suite passes unmodified | `node --test test/e106-init-artifacts-flag.test.mjs test/agc-adapters.test.mjs` | 55/55 green (17 pre-existing e106 + 1 new AC3-regression = 18, + 37 agc-adapters = 55) |
| AC4 | "AC4: ..." | `node --test test/e239-init-subdir-exclude.test.mjs` | green |
| AC5 | "AC5: ..." | (same run) | green |
| AC6 | "AC6: ..." | (same run) | green |
| AC7 | "AC7: ..." | (same run) | green |
| AC8 | "AC8: ..." | (same run) | green |
| AC9 | "AC9: ..." | (same run) | green |
| AC10 | "AC10: ..." | (same run) | green |
| AC11 | "AC11: ..." | (same run) | green |
| AC12 | "AC12: ..." | (same run) | green |
| AC13 | "AC13: ..." | (same run) | green |
| AC14 | `grep -n 'wildcard' docs/install.md` | (run directly) | 1 hit, line 150, inside the `--artifacts` bullet list, no ticket id — matches AC14 verbatim: `- When the workspace path contains a gitignore wildcard character (`, `?`, `[`, `]`) in a directory name below the repo root, `local` refuses to run (exit 2, nothing written) because the exclude rule could match unintended files, while `--artifacts=repo` works there as usual.` |

No proof failed to run and no observed outcome contradicted its AC text — no Phase 4 FAIL from
this gate.

## Phase 4 — Run
- Build: `npm run build` — clean, zero errors (tsc + check:version + check:transitions-sync all OK).
- `test/e239-init-subdir-exclude.test.mjs` standalone: 14/14 green.
- `test/e106-init-artifacts-flag.test.mjs` + `test/agc-adapters.test.mjs` standalone: 55/55 green
  (18 + 37).
- Full `npm test` on a clean tree (after commit, zero untracked files, per
  `docs/lane-protocol.md` §3): see the lane report / final message for the exact pass/total and
  any red disposition.
- CI runnability: `node --test <files>` / `npm test` run headlessly, zero human interaction.

## Known out-of-scope finding
The backslash/control-character gap code-reviewer flagged (F1 in
`review_reports/review_T-E239-01.md`) is filed as lane finding **E239-NEW-2** in
`.current/e108/pending-tickets.md` (already committed, 94b6460) — confirmed present, not
re-filed here. Out of this cut's contracted `* ? [ ]` charset by the spec's own Key decision and
Copy/Strings entries.

## Security / Boundary
- Boundary inputs covered: empty subdir prefix (root cwd — pre-existing e106 suite +
  new AC3-regression case), a single-level wildcard segment (AC8/AC9/AC13), a two-level-nested
  wildcard segment (boundary case). No auth/permission surface in this CLI-only feature.
- `execFileSync` with argv arrays throughout (verified via code-reviewer's review + spot read) —
  no shell injection surface introduced.

## Verdict
PASS — T-E239-01 (implementation, already code-reviewer APPROVED) and T-E239-02 (this test
authoring + AC execution + full-suite run) both PASS.
## 2026-09-27T19:55:42.730Z — PASS — by qa-engineer

PASS T-E239-01 + T-E239-02. New test/e239-init-subdir-exclude.test.mjs (14 cases) covers AC1-AC13; AC14 verified by grep proof (docs/install.md:150). Additive AC3-regression case appended to test/e106-init-artifacts-flag.test.mjs (existing 17 assertions unmodified, 55/55 green with agc-adapters). Red-against-base repro run against lane base d0c66f0 confirmed AC1/AC2 fail pre-fix (root-anchored rules written regardless of cwd=sub; neither sub/.current/anything nor sub/tasks.md ignored); both green against the fix. Copy Audit Gate: all 3 spec Copy/Strings entries verified verbatim by exact-regex assertions. Full npm test on a clean, committed tree: 2853/2856 pass, 3 skipped, 0 fail (stable across 2 consecutive clean-tree runs; one earlier run showed a single transient failure that did not reproduce — consistent with this repo's known pre-existing flake class, not caused by this change). Backslash/control-char gap (code-reviewer F1) filed as lane finding E239-NEW-2, out of scope. Evidence: qa_reports/review_T-E239-02.md.

