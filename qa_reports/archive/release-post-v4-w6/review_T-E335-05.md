# QA review — T-E335-05 (lane e291, e291-start-link-locations, amendment 2)

covers: T-E335-04, T-E335-05

## Context — the earlier PASS was re-opened by CI

The feature was qa PASS at `cc4ae03` (T-E291-01, T-E291-02, T-E335-01, T-E335-03, T-E291-03, T-E335-02; evidence in `qa_reports/review_T-E291-03.md` and the per-id files). CI then failed job `test (20)` on AC-E335-6 (a)/(b): on Node 20, `fs.cpSync` refuses to copy a lane symlink over an identical history symlink a refused first `finish --abandoned` left behind (EINVAL), while `test (22)` stayed green. That disproved the PASS on Node 20. Amendment 2 (spec `0709431`: D8, AC-E335-7, the AC-LANE-1 Node 20/22 note) added T-E335-04 (sr fix) and T-E335-05 (this qa round). This round verifies T-E335-04 and closes T-E335-05; the six earlier ids are re-confirmed by the full-suite runs below.

- T-E335-04: commit `316f25d` (`bin/agc-init.mjs` only, +34/-12). code-reviewer APPROVED in `review_reports/review_T-E335-04.md` (commit `5470550`), with one recommendation (R1) assigned to this task.
- T-E335-05: commit `22e968d` (test only, +63 lines in `test/e335-symlinked-pending-harvest.test.mjs`).

## Phase 0.5 — Expected-Red Diff

Phase 0.5: skipped (no expected-red manifest declared — no `qa_reports/expected-red_e291-start-link-locations.txt`; `dispatch_mode` is not bugfix).

## Phase 1 — Review (T-E335-04)

- `setAsideCollidingHistoryLinks` walks the lane-side `.current/<lane>/` with `readdirSync({ withFileTypes: true })`. It recurses only where both sides are real directories (a lane symlink to a directory is never descended; the history side is `lstat`ed). Each history symlink with a same-named lane symlink is renamed to `<dst>.<pid>.<ms>.aside.tmp` and pushed onto the shared `asides` list. This matches D8.
- `executeAbandonCurrentHarvest`: the T-E335-03 `pending-tickets.md` set-aside runs first and is pushed onto the same list. The D8 walk runs next and skips that name because its history path no longer exists, so it is never set aside twice. On failure, every aside is restored in reverse order (a failed restore leaves the entry at its aside path, which is lossless), and the harvest-failed error text is unchanged. On success, every aside is removed. Only `renameSync` and `rmSync` touch history links.
- No correctness, security, or architecture findings beyond those the code-reviewer already recorded (O1–O3, all optional and non-blocking).

### Copy Audit Gate (3a)

T-E335-04 adds no user-facing string. The only stderr path it touches is the existing `harvest of .current/<lane>/ into .current/history/… failed (…) — worktree and branch left in place (re-running finish is safe)`, which the diff leaves byte-identical. The new test asserts both the `harvest … failed` prefix and the `worktree and branch left in place` clause. No drift and no coverage gap.

### Visual Audit Gate (3b)

Not applicable: this is a CLI and filesystem change with no visual tokens.

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared).

## Phase 3 — Tests

Test-file placement (dispatch brief): extend `test/e335-symlinked-pending-harvest.test.mjs`; no other test file may change. I took the existing-file branch. `git diff --name-only origin/main...HEAD -- test/` lists only `test/e291-start-link-locations.test.mjs` and `test/e335-symlinked-pending-harvest.test.mjs`, the two lane-owned files. `test/e246-mailbox-teardown.test.mjs` is byte-identical to main (`git diff --quiet origin/main...HEAD -- test/e246-mailbox-teardown.test.mjs` exits 0).

### R1 coverage — new case `AC-E335-7 (failure path)`

Reviewer recommendation R1: a mutation that restores only the first set-aside entry left every committed test green, because the existing `AC-E335-6 (failure path)` fixture has exactly one aside. I added a sibling case rather than changing that test.

Fixture: the lane's `pending-tickets.md` is an absolute symlink to a findings file. The lane also has `other-link.md`, a symlink to target A. The history dir already holds:
- `pending-tickets.md` as a regular file `OLD-HISTORY`, which is set aside first;
- `other-link.md` as a symlink to a DIFFERENT target B, which the D8 walk sets aside second.

A `chmod 000` lane file makes the whole-dir copy fail after both set-asides.

Assertions after the failed run:
- non-zero exit;
- the unchanged `harvest … failed` / `worktree and branch left in place` error;
- worktree and branch kept;
- history `pending-tickets.md` restored to `OLD-HISTORY`;
- history `other-link.md` is a symlink and `readlinkSync` equals B (its old target);
- B's bytes unchanged (nothing written through the link) and A's bytes unchanged;
- no `*.aside.tmp` and no `*.tmp` left in the history dir.

After the permissions are restored, the re-run exits 0, the worktree is removed, the branch is kept, `assertConverged` holds, history `other-link.md` is a symlink resolving to A, and B is still never written.

**Negative controls.** Each control ran on a scratch copy of `bin/` + `dist/` + the test file outside the worktree; none was committed, and the copies were deleted after the run. Results under Node 20.x and under Node 22.x:

| control | restore loop in the copy | AC-E335-6 (failure path) | AC-E335-7 (failure path) | rest of file |
|---|---|---|---|---|
| unmutated | `asides.reverse()` | ok | ok | 16/16 |
| NC-first (R1 mutation) | `asides.slice(0, 1)` | ok | **not ok** — "restored history link still points at its old target" | 15/16 |
| NC-last | `asides.reverse().slice(0, 1)` | ok | **not ok** — the history `pending-tickets.md` is not restored | 15/16 |
| NC-none | no restore | not ok | **not ok** | 14/16 |

NC-first shows why the `readlinkSync` assertion is load-bearing. Under that mutation the copy had already put the lane's link at `other-link.md` before failing, so a check that only asked "is it a symlink" would have passed. The new case discriminates all three restore-loop regressions on both runtimes and passes on the real code.

### Spec-to-Test Map (AC-E335-*, amendment 2 scope)

| AC | test(s) in `test/e335-symlinked-pending-harvest.test.mjs` |
|---|---|
| AC-E335-1 | `AC-E335-1: --shipped, <shape>` ×3 |
| AC-E335-2 | `AC-E335-2: --abandoned, <shape>` ×3 |
| AC-E335-3 | `AC-E335-3: --shipped re-run …` ×2 |
| AC-E335-4 | `AC-E335-4: --abandoned, lane file a symlink / regular file …` ×2 |
| AC-E335-5 | `AC-E335-5: regular-file pending-tickets.md …`, plus the unmodified finish suites (e287, e180, agc-feature-finish-history, e246) |
| AC-E335-6 | `AC-E335-6 (a)`, `AC-E335-6 (b)`, `AC-E335-6 (failure path)` |
| AC-E335-7 success clause | `AC-E335-6 (a)` / `(b)`: the refused first run leaves history `other-link.md` as a link to the same target; the re-run must exit 0 and the history link must resolve to the lane link's target. These cases were red on Node 20 before T-E335-04 (CI `test (20)`, reviewer NC1). |
| AC-E335-7 failure clause | `AC-E335-7 (failure path)` (new, this round) |

AC-E291-* mapping is unchanged from `qa_reports/review_T-E291-03.md` (`test/e291-start-link-locations.test.mjs`, not touched this round).

### Coverage gate

There is no line-coverage tooling for `bin/agc-init.mjs` (a spawned CLI). Branch-level coverage of the T-E335-04 delta, by reasoning:
- the walk recursion and link-pair set-aside: AC-E335-6 a/b and AC-E335-7;
- the pending-tickets set-aside: AC-E335-6 a, failure paths;
- the restore loop (every entry): AC-E335-7 failure path;
- the success removal: all `.tmp` / aside-left assertions;
- the empty-asides path: AC-E335-5 and AC-E335-2.

Security smoke: not applicable beyond the no-write-through-link assertions. There is no new input boundary, and entry names come from `readdirSync`.

## AC Execution Log

Run on lane HEAD `77f8e1b` with a clean tree, unless stated otherwise. Runtimes: any Node 20.x and any Node 22.x selected through the version manager (here 20.20.2 and 22.22.3).

- **AC-E335-1..7** — `node --test test/e335-symlinked-pending-harvest.test.mjs`
  - Under Node 22.x: exit 0, 16/16 pass.
  - Under Node 20.x: exit 0, 16/16 pass.
  - Verdict: pass.
- **AC-E335-5 (e246 byte-identity)** — `git diff --quiet origin/main...HEAD -- test/e246-mailbox-teardown.test.mjs`
  - Exit 0.
  - The finish suites (e287, e180, agc-feature-finish-history, e246) are green inside both full-suite runs below.
  - Verdict: pass.
- **AC-LANE-1** — `node scripts/test-lock.mjs -- npm test` on HEAD `77f8e1b`, clean tree:
  - **Under Node 22.x: exit 0 — 3373 pass / 3375 tests, 0 fail, 2 skipped** (the 2 skips are pre-existing and history-dependent, the same as the cc4ae03 round).
  - **Under Node 20.x: exit 1 — 3318 pass / 3375 tests, 55 fail, 2 skipped.**
    - All 55 failures share one environmental cause: `better-sqlite3` "was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 115". The local `node_modules` native binding is built for Node 22, and the lane may not reinstall it.
    - The failures are confined to 15 SQLite-mode test files: dispatch-pins, e117-void-task, e120-void-recut-refusal, e18-write-provenance, feature-lease, hop-count-transitions, qa-review-scoped-append, rag-lifecycle, rag, repro-first-gate, reviewer-completed-tasks-gate, sqlite-versioning, stale-dispatch-detection, success-metrics, visual-round-sqlite.
    - None is a lane-owned file or path. No E291/E335/finish/e246 test failed: the failure locations name only those 15 files.
  - **Supplementary check (outside the lane):** I exported HEAD with `git archive` to a scratch dir, installed dependencies there under Node 20.x so the native binding matches, and ran `npm run build`. Then I ran those same 15 files under Node 20.x: **360/360 pass, 0 fail.** The scratch dir was then deleted.
  - Verdict: pass for lane scope. The local Node 20 red is a test-infra environment defect outside lane scope; it is reported, not re-baselined. CI job `test (20)` installs its own Node 20 binding and is the authoritative Node 20 full-suite proof for this HEAD.
- **AC-LANE-2** — `node scripts/fanout.mjs owners specs/fanout-post-v4-w6.md --range origin/main...HEAD`
  - "23 path(s), 23 hit(s)"; every path is attributed to e291.
  - Verdict: pass.
- **AC-LANE-3** — `npm run build && git status --porcelain dist/`
  - Build exit 0; porcelain output is empty.
  - Verdict: pass.

## Verdict

PASS. T-E335-04 implements D8 / AC-E335-7 as specified and is green on both runtimes. T-E335-05 closes R1 with a failure-clause test that fails against three restore-loop mutations on Node 20 and on Node 22.

**Finding for the integrator (not blocking, outside lane scope):** a local Node 20 full-suite run in a worktree that shares a Node 22-built `node_modules` cannot load `better-sqlite3`, which produces 55 SQLite-only reds. Running under Node 20 locally needs a Node 20-built binding (a separate install), or CI.
## 2026-10-17T15:27:50.691Z — PASS — by qa-engineer

PASS (amendment 2 QA round, opus, Task-spawned). Evidence: qa_reports/review_T-E335-05.md (covers T-E335-04, T-E335-05). Earlier PASS at cc4ae03 was re-opened by CI test (20) (AC-E335-6 a/b, Node 20 cpSync EINVAL); T-E335-04 (316f25d, review APPROVED 5470550) implements D8 set-aside of colliding history links. R1 closed: new test AC-E335-7 (failure path) in test/e335-symlinked-pending-harvest.test.mjs (commit 22e968d) - two set-aside entries, history other-link.md -> different old target; asserts readlink restored, old target bytes untouched, no .aside.tmp, unchanged error, worktree+branch kept, re-run converges. Negative controls on scratch copy (restore only first / only last / none) all red on Node 20.x and 22.x; real code 16/16 on both. Full suite on HEAD 77f8e1b clean tree: Node 22.x 3373/3375 pass, 0 fail, 2 pre-existing skips (exit 0). Node 20.x 3318/3375, 55 fail - all better-sqlite3 NODE_MODULE_VERSION mismatch (shared node_modules built for Node 22) in 15 SQLite-mode files outside lane scope; same 15 files 360/360 under Node 20.x with a matching binding in a scratch export; reported, not re-baselined; CI test (20) is the authoritative Node 20 full-suite proof. e246 byte-identical to main; AC-LANE-2 23/23 paths e291; AC-LANE-3 build clean, dist porcelain empty.

