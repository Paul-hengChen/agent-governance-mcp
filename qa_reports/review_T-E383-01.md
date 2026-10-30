covers: T-E383-01, T-E385-01, T-E385-02, T-E385-03, T-E383-02, T-E385-04, T-E385-05

# QA review — e383-lane-ledger-and-worktree-evidence (E383 + E385)

Reviewer: qa-engineer (sonnet). Code review APPROVED T-E383-01, T-E385-01..03 (`review_reports/review_T-E383-01.md`). QA scope: T-E383-02, T-E385-04, T-E385-05 plus independent verification of the four build tasks through the proofs below.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e383-lane-ledger-and-worktree-evidence.txt` (6 entries). Diff taken BEFORE re-baseline in the sense that the pre-edit test files were re-run from `HEAD` copies (placed temporarily as `test/zz-old-*.test.mjs`, removed afterwards): `agc-adapters` + `e130-lane-default` old files gave exactly 5 red (`E111(i)`, `E111(ii)`, `E111 R1 guard`, `E111 exit-code`, `AC6`); the 6th manifest entry, `skill-manifest` `t-golden-byte-identity`, was confirmed red by recomputing the composed coordinator against the old golden (golden differs from composition by the -498 byte bootstrap paragraph; the re-capture moved only `skill-coordinator-monolith.txt`, the other 11 fixtures byte-unchanged per `git status`).

- Phase 0.5: clean (6/6 manifest entries confirmed red, 0 unexplained reds).
- Re-pin renames: the four `agc-adapters` cases were renamed to state the flipped contract (`E111(i) re-pinned by E385 ...` etc.); the pre-rename names are the manifest entries. `AC6` kept its id, changed its title. All now green.

## Phase 1 / Copy audit

- Copy `worktree-evidence.outside-link` / `.dangling-link` asserted verbatim prefix + remedy tail in `test/e385-worktree-evidence.test.mjs` (AC-E385-3/4); source strings at `bin/agc-init.mjs` match the spec.
- Copy `coord.bootstrap-obligation`: asserted opening, forbid clause, mkdir/finish/tracked-alt clauses and the closing sentence on the single fragment line; tag-stripped in the composed prompt.
- Copy `doc.s1-git`, `doc.s3-ledger`, `doc.s3-evidence`: `doc.s1-git` asserted byte-exact; the two §3 lines asserted by distinctive head and tail, once, adjacent order.
- Visual Tokens / Widgets: N/A (no design file; Phase 1.5 skipped: no Visual Baselines declared).
- R1 ruling (WARN on outside links): honoured and pinned (AC-E385-3, E111(ii) re-pin, exit-code case).

## AC -> test map

| AC | test |
|---|---|
| AC-E383-1 | `test/e383-lane-ledger-worktree.test.mjs` AC-E383-1 |
| AC-E383-2 | same file, AC-E383-2-shipped, AC-E383-2-abandoned (real `agc feature start`/`finish`, history ledger byte-identical) |
| AC-E383-3 | same file, AC-E383-3 (main + feat branch, primary `.git` dir); `e125a` unedited green |
| AC-E383-4 | same file, AC-E383-4 |
| AC-E383-5 | same file, AC-E383-5 |
| AC-E383-6 | five existing suites run unedited, green |
| AC-E383-7 | same file, AC-E383-7 |
| AC-E385-1 | `test/e385-worktree-evidence.test.mjs` AC-E385-1; `e130` AC6 re-pin; golden re-capture |
| AC-E385-2 | e385 AC-E385-2 (empty, ignored-untracked, W3, x3 dirs; exit == absent baseline); agc-adapters E111(i)/R1 re-pins |
| AC-E385-3/4/5 | e385 AC-E385-3/4/5 |
| AC-E385-6 | e385 AC-E385-6; agc-adapters E111(iii)/(iv) unchanged, exit-code case re-pinned to outside link (exit 1 + warning co-fire) |
| AC-E385-7 | e213 / e180 suites unedited green; `bin/agc-init.mjs` diff reviewed by code-reviewer |
| AC-E385-8 | e385 AC-E385-8; e294, e351, e177a unedited green |
| AC-L1..L4 | error-code-contract green unedited; `git diff 35f20e2 --stat -- tools/fanout-manifest.ts tools/tasks-file.ts schema/versions.ts` empty |
| AC-L5 | full suite on final HEAD, recorded in the server-recorded `suite-result:` line |

Security/boundary smoke: fixtures cover primary vs linked `.git`, non-feat branch (`_primary`), legacy-file-present, dangling and inside symlinks. Coverage tooling: none configured; new branch in `resolveTasksLedgerPath` exercised by AC-E383-1/3/4/5 (all four outcomes), `checkWorktreeEvidence` by 5 shapes x 3 dirs.

## AC Execution Log

| AC | command | result |
|---|---|---|
| AC-E383-1..5, 7 | `node --test test/e383-lane-ledger-worktree.test.mjs` | 7 pass / 0 fail |
| AC-E383-3/6 | `node --test test/e125a-lane-local-ledgers.test.mjs test/agc-feature-finish-history.test.mjs test/agc-feature-lifecycle.test.mjs test/e213-shipped-ignored-shape.test.mjs test/e180-abandoned-harvest.test.mjs test/e294-lane-enterworktree.test.mjs test/e351-lane-protocol-gaps.test.mjs test/e177a-manifest.test.mjs test/error-code-contract.test.mjs test/e289-render-addendum.test.mjs test/e235b-relative-worktree.test.mjs` | 210 pass / 0 fail, no edits to these files (diff vs 35f20e2 empty for e125a, error-code-contract) |
| AC-E385-1 | `grep -rn "symlink back to primary each of\|needed ONLY when untracked" content/` | no output, exit 1 (PASS) |
| AC-E385-1 | `node --test test/e385-worktree-evidence.test.mjs test/e130-lane-default.test.mjs test/skill-manifest.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/context-budget.test.mjs` | 121 pass / 0 fail / 2 skipped (pre-existing skips); context-budget pin not moved |
| AC-E385-2..5 | `node --test test/e385-worktree-evidence.test.mjs` | 7 pass / 0 fail |
| AC-E385-6 | `node --test test/agc-adapters.test.mjs`; `grep -n "is a real, untracked directory in a linked git worktree\|resolves INSIDE this worktree" bin/agc-init.mjs` | 39 pass / 0 fail; grep no output (PASS) |
| AC-E385-7 | e213 + e180 suites (in the 210 above) | PASS |
| AC-E385-8 | e385 + e294 + e351 + e177a | PASS |
| AC-L4 | `git diff 35f20e2 --stat -- tools/fanout-manifest.ts tools/tasks-file.ts schema/versions.ts` | empty (PASS) |
| build | `npm run build` | 0 errors; `git status` shows no dist change (dist matches source) |
| audit | `npm audit --audit-level=high` | 7 vulnerabilities (1 low, 6 moderate), none high/critical (PASS) |
| AC-L5 | `node scripts/test-lock.mjs -- npm test` on committed HEAD, clean tree | see the server-recorded `suite-result:` line on the PASS write |

Negative control: not run (AC-E383-1 against the pre-fix build would require checking out base `dist` outside the worktree; the old-behaviour red result of the 5 pre-edit pins above is the control for E385; for E383 the pre-fix expectation is fixed by AC-E383-3 passing in a primary checkout while AC-E383-1 passes only in the linked worktree, i.e. the new branch is the sole discriminator).

## Findings

None blocking. Observations: (1) sr's submodule residual (`.git` file) is documented in the spec Implementation notes; not tested. (2) Filed already: E383-NEW-1..3.
