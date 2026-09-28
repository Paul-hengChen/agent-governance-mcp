# Review — T10 (lane e213, e213-shipped-ignored-shape)

covers: T01, T02, T04, T08, T09, T10

## Phase 0 — Claim

Reviewed sr-engineer's commit `b042743` (approved by code-reviewer round 1,
`review_reports/review_T01.md`, verdict APPROVED, no required findings).
Contract: `specs/e213-shipped-ignored-shape.md`. Dispatch brief's Test-file
placement line authorizes a new `test/e213-shipped-ignored-shape.test.mjs`
(this file) plus edits (if needed) to `test/agc-feature-finish-history.test.mjs`,
`test/agc-feature-lifecycle.test.mjs`, `test/e180-abandoned-harvest.test.mjs`.
No edits were needed to any existing test file — the new file stands alone.

## Phase 0.5 — Expected-Red Diff

`Phase 0.5: skipped (no expected-red manifest declared)` — no
`qa_reports/expected-red_e213-shipped-ignored-shape.txt` exists, and
`dispatch_mode` is unset (feature mode, not bugfix).

## Phase 1 — Review

Read `bin/agc-init.mjs`'s diff (`git show b042743 -- bin/agc-init.mjs`) in full
against the spec, in addition to code-reviewer's own round-1 findings. I did
not re-litigate correctness/architecture (code-reviewer's job, already
APPROVED) — my read was scoped to: (a) confirming every Copy/Strings entry
renders verbatim, (b) confirming the AC-to-code mapping code-reviewer recorded
actually matches runtime behavior (independently re-derived from source, not
copied from their doc), and (c) identifying test-worthy edge cases and the
correct test-file placement.

Independent empirical verification (fixtures under $TMPDIR, ad-hoc probe
scripts in the session scratchpad, never in the repo): I ran the real
`bin/agc-init.mjs` against hand-built adopter-shaped fixtures for every
AC1-AC17 shape before committing to a test design, including the AC10 gotcha
that a `.gitignore` directory-pattern (`/qa_reports/`) cannot be selectively
un-ignored for one file inside it (git's own "cannot re-include inside an
excluded directory" rule) — my first AC10 fixture attempt silently produced
the wrong shape (the file stayed ignored) and was corrected to a
file-pattern-scoped ignore rule (`qa_reports/ignored-*.md`) before it went
into the test file.

### Copy Audit Gate (3a)

Every entry in the spec's Copy / Strings table is asserted verbatim (not
paraphrased) in `test/e213-shipped-ignored-shape.test.mjs`, confirmed by
direct regex match against real command output, not against the source:

| string id | asserted verbatim in |
|---|---|
| `e213.tasks-fsonly-line` | AC1, AC2 |
| `e213.tasks-nocommit-line` | AC3, AC12 |
| `e180.evidence-harvest-line` (reused, `archive/` dst) | AC6, AC10, AC12, AC17a |
| `e180.evidence-harvest-refuse-line` (reused, `--shipped` verb) | AC8 |
| `e216.moved-qualified-line` | AC14 (and its ABSENCE asserted in AC15) |
| `e214.evidence-harvest-symlink-refuse-line` | AC17b |

No coverage gap: every string the diff introduces is listed in the spec's
Copy/Strings table (grepped `bin/agc-init.mjs`'s diff for every
`process.stdout.write`/`stderr.write`/`FeatureError` literal touched by this
commit — all six map to a table row; none is a new, unsourced user-facing
string).

### Visual Audit Gate (3b)

`Visual Tokens: N/A — feature has no visual literals (CLI stdout/stderr
only)` per the spec itself. Vacuously satisfied — no properties to source.

## Phase 1.5 — Visual Compare

`Phase 1.5: skipped (no Visual Baselines declared)` — no `design/e213-shipped-
ignored-shape.md` exists; this is a non-visual CLI feature per the spec's own
Dependencies note (`scope_decision: "single-feature"`, no design mode armed).

## Phase 2 — Discussion

No open questions for sr-engineer. Code-reviewer's two recommended
(non-blocking) findings (R1: unbounded symlink dereference beyond the
evidence dir; R2: a re-run refusing on its own prior harvest with no
remediation hint) and one optional finding (O3: FIFOs/sockets skipped
silently) are pre-existing, spec-compliant behavior per their own analysis —
not QA-scope (QA FAILs only on failing tests, missing AC coverage, or
test-infra defects; correctness/architecture judgment calls belong to
code-reviewer, already exercised). I independently re-verified R1's repro
shape is real (an `up -> ..` directory symlink inside an evidence dir copies
tracked/external content) but it is literal AC17 compliance per the spec text
("every symlink whose target resolves is dereferenced") — not a test failure,
and already filed as a pending-ticket candidate by code-reviewer. No FAIL.

## Phase 3 — Tests

**Test File Discovery**: no existing test file covers `--shipped`'s
git-ignored-tasks.md/evidence-harvest behavior. Per the dispatch brief's
Test-file placement line, I created `test/e213-shipped-ignored-shape.test.mjs`
(this is T10). No edits to `test/agc-feature-finish-history.test.mjs`,
`test/agc-feature-lifecycle.test.mjs`, or `test/e180-abandoned-harvest.test.mjs`
were necessary — all three continue to pass unmodified (see Phase 4).

### Spec-to-Test Map

| AC | test(s) |
|---|---|
| AC1 | `AC1: tasks.md git-ignored — fs-only pointer write, no git add, fsonly-line once` |
| AC2 | `AC2: tasks.md git-ignored + untracked .current/ harvest — both advisories fire in mutation order` |
| AC3 | `AC3: tasks.md git-ignored + zero-write .current/ — nocommit-line replaces the recorded-lane line, no harvest line` |
| AC4 | `AC4: tasks.md NOT git-ignored — neither new E213 line ever prints` (this file) + `test/agc-feature-finish-history.test.mjs` + `test/agc-feature-lifecycle.test.mjs` (existing suites, unchanged) |
| AC5 | `AC5: a later step failing after a successful untracked harvest leaves no stale harvest line in stdout; re-run is safe` |
| AC6 | `AC6: recursive evidence harvest, nested path preserved, across qa_reports/ and review_reports/, no ticket-token filter` |
| AC7 | `AC7: an evidence dir symlinked outside the worktree gets no primary copy` |
| AC8 | `AC8: a differing primary destination refuses before any mutation — worktree, branch and other evidence untouched` |
| AC9 | `AC9: an identical primary destination does not refuse and finishes normally (idempotent re-run)` |
| AC10 | `AC10: an untracked-but-not-ignored file is left to git's own refusal; a sibling ignored file still harvests` |
| AC11 | `AC11: no files under any evidence dir — no harvest attempted, nothing errors` |
| AC12 | `AC12: the acceptance-project-shaped adopter workspace — every harvest fires end-to-end` |
| AC13 | existing suites (`e180-abandoned-harvest`, `agc-feature-finish-history`, `agc-feature-lifecycle`) + full `npm test`, unchanged |
| AC14 | `AC14: --abandoned qualifies the moved line for a file harvested to primary` |
| AC15 | `AC15: --abandoned keeps the plain moved line for a file NOT harvested to primary` + existing `e180-abandoned-harvest` plain-line assertions |
| AC16 | `AC16: specs/ is a full third member of SHIPPED_EVIDENCE_DIRS, harvested under the same rules` |
| AC17 | `AC17a: a symlink whose target resolves is dereferenced …` + `AC17b: a symlink whose target does not resolve refuses …` |

### Coverage Gate

17/17 spec ACs mapped to ≥ 1 test, all passing. Coverage tool is not wired
for this CLI script (no nyc/c8 configured for `bin/agc-init.mjs`); noted
explicitly per SOP §6c. Manual read of the diff (287 lines added) against the
17 tests: every new branch introduced by commit `b042743` is exercised by at
least one test — `tasksIgnored` true/false × `tracked` true/false (AC1-AC4),
the buffered-flush rollback path (AC5), `planShippedEvidenceHarvest`'s every
early-continue (`AC7` absent-safely-linked, `AC11` absent dir), every
conflict/idempotent branch (AC8/AC9/AC16), the token-filter-free recursive
walk (AC6/AC12), both symlink outcomes (AC17a/AC17b), and E216's `m.harvested`
flag both ways (AC14/AC15).

### Security Smoke Tests

- Boundary: AC11 covers a wholly-absent evidence tree (no dirs at all,
  one dir present-but-empty) — no crash, no error.
- Boundary: AC17a/AC17b cover symlink edge cases (resolving vs dangling)
  specifically because they are the security-relevant case here (E207 — a
  primary checkout must never gain a link back into a to-be-deleted
  worktree); AC17a additionally asserts a full recursive walk of the primary
  copy finds **zero** symlinks anywhere, not just at the one asserted path.
- Path traversal: not independently re-tested — code-reviewer's Security
  section already confirmed destination paths are built via
  `path.posix.join(dir, "archive", ticketId, rel)` with `rel` sourced only
  from `readdirSync` names (never user-controlled beyond the lane's own
  filesystem) and `ticketId` already validated bare-id — no new attack
  surface for QA to add boundary tests against.
- No auth/permission surface — this is a local CLI tool with no access
  control model; N/A.

## Phase 3.5 — AC Execution Log

`specs/e213-shipped-ignored-shape.md` declares `proof:` on every AC (1-17,
including the sub-items). Phase 3.5 is ARMED. Per-AC execution below
(`--test-name-pattern` scoped to each AC's own test name, this repo's house
style per `qa_reports/review_T-E23-01.md`); AC4 and AC13 run their own
declared existing-suite / full-suite proofs instead.

- **AC1** — `node --test --test-name-pattern="^AC1:" test/e213-shipped-ignored-shape.test.mjs` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC2** — same pattern, `^AC2:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC3** — `^AC3:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC4** — `node --test test/agc-feature-finish-history.test.mjs` → exit 0, `# tests 19`, `# pass 19`, `# fail 0`; `node --test test/agc-feature-lifecycle.test.mjs` → exit 0, `# tests 53`, `# pass 53`, `# fail 0`. Both existing suites pass unchanged, confirming byte-for-byte-unchanged behavior when tasks.md is not git-ignored. **PASS.**
- **AC5** — `^AC5:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0` (this single test asserts BOTH the failing run's empty stdout and the successful retry's lines — both runs are inside the one test). **PASS.**
- **AC6** — `^AC6:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC7** — `^AC7:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC8** — `^AC8:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC9** — `^AC9:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC10** — `^AC10:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC11** — `^AC11:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC12** — `^AC12:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. This is the end-to-end Run-A-shaped proof from `specs/e73-adopter-acceptance-2026-09-27.md`. **PASS.**
- **AC13** — full `npm test` (below, Phase 4) → exit 0, `# tests 2754`, `# pass 2754`, `# fail 0`. Includes the three named suites (e180-abandoned-harvest, agc-feature-finish-history, agc-feature-lifecycle) unchanged. **PASS.**
- **AC14** — `^AC14:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC15** — `^AC15:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`; plus `test/e180-abandoned-harvest.test.mjs`'s existing plain-`moved`-line assertions (AC1/AC5, part of the AC13 run) keep passing unchanged. **PASS.**
- **AC16** — `^AC16:` → exit 0. `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**
- **AC17 (AC17a/AC17b)** — `^AC17a:` → exit 0, `# tests 1`, `# pass 1`, `# fail 0`; `^AC17b:` → exit 0, `# tests 1`, `# pass 1`, `# fail 0`. **PASS.**

No proof failed to run and no proof's observed outcome contradicted its AC
text — no Phase 4 FAIL triggered by this log.

## Phase 4 — Run

- **Project build**: `npm run build` — zero errors (tsc + check:version +
  check:transitions-sync all green, run before writing any test).
- **CI runnability**: `node --test test/e213-shipped-ignored-shape.test.mjs`
  and `npm test` both run headlessly, zero human interaction, zero prompts.
- **New file, standalone**: `node --test test/e213-shipped-ignored-shape.test.mjs` → 17/17 pass, exit 0.
- **Named regression suites** (spec AC13's own proof list):
  `node --test test/e180-abandoned-harvest.test.mjs test/agc-feature-finish-history.test.mjs test/agc-feature-lifecycle.test.mjs`
  → **85/85 pass**, exit 0 (matches code-reviewer's own independently-run count in `review_reports/review_T01.md`).
- **Full regression** (T09), run three times total:
  1. Pre-commit: `npm test` → **2754/2754 pass**, 0 fail, exit 0.
  2. Immediately post-commit (`git status --porcelain` empty beforehand):
     `npm test` → **2753/2754 pass, 1 fail**, exit 0. The failing test's
     identity was NOT captured — I piped this run through `tail -80` and the
     failure's diagnostic block scrolled out of that window before I
     realized I needed it (a tooling mistake on my part, not a suppression
     of a real result; recorded here rather than silently re-run away).
  3. Immediate re-run, same commit, full untruncated log this time: `npm test`
     → **2754/2754 pass**, 0 fail, exit 0 — clean.
  Given the dispatch brief's explicit warning that the only known flake in
  this suite is the AC13b row in `test/e177b-test-lock.test.mjs` (lane e212's
  own ticket, E212), I additionally ran that file in isolation three times
  back-to-back: 19/19 pass, 0 fail, all three runs. This is consistent with
  (not certain proof of, given the unrecorded identity) run 2's single
  transient fail being that known flake rather than a regression from this
  lane's changes — nothing in the tree changed between runs 2 and 3. The
  authoritative, final state is clean: **2754/2754, 0 fail**, on a clean tree.
- **Worktree cleanliness**: `git status --porcelain` in
  `<lanes-root>/e213` shows only this review's own new files
  (`test/e213-shipped-ignored-shape.test.mjs`, `qa_reports/review_T10.md`,
  `.current/e213/` bookkeeping) — no stray untracked files from any test run
  (every fixture lives under `$TMPDIR`, `mkTmp`-registered and cleaned up in
  each file's `after` hook).

**Verdict: PASS.** T01, T02, T04, T08 (sr-engineer's implementation,
code-reviewer APPROVED round 1) and T09/T10 (this QA pass: regression +
new test authoring) all PASS. No code defect found — nothing routed back to
sr-engineer.
## 2026-09-26T23:07:52.577Z — PASS — by qa-engineer

QA PASS — e213-shipped-ignored-shape (T01,T02,T04,T08,T09,T10). Code-reviewer APPROVED sr's commit b042743 round 1 (review_reports/review_T01.md, no required findings). QA independently re-verified all 17 ACs against the real bin/agc-init.mjs using hand-built adopter fixtures before writing the new test file, then authored test/e213-shipped-ignored-shape.test.mjs (17 tests, AC1-AC17, all pass) — no edits needed to any existing test file. Copy Audit Gate: all 6 Copy/Strings entries asserted verbatim against real command output. Visual Audit/Phase 1.5: both skipped (no visual literals, no design file — feature has none). Phase 3.5 AC Execution Log: every proof:-annotated AC executed individually via --test-name-pattern, all PASS, recorded in qa_reports/review_T10.md. Regression (T09): named suites (e180-abandoned-harvest, agc-feature-finish-history, agc-feature-lifecycle) 85/85 pass; full npm test 2754/2754 pass on a clean tree (one transient single-test fail on an intermediate post-commit run cleared on immediate re-run with zero tree changes — consistent with the flagged e177b AC13b flake; recorded transparently in the review doc). No code defect found; nothing routed back to sr-engineer. Full detail: qa_reports/review_T10.md.

