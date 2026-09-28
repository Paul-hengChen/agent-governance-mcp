# QA Review — T-E204-01 (E204: pin e125c AC10/AC11 fixtures)

Lane: `<lanes-root>/e204`, branch `feat/e204-pin-e125c-fixture`, base `98052c6`.
Single-role qa-engineer dispatch per Constitution §3.1 (PM-sanctioned, cut_approved: true,
human-approved cut — no sr/code-reviewer on this test-only ticket). This QA authored the
test/fixture change AND issues the verdict.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e204-pin-e125c-fixture.txt` manifest declared — this is
not a bugfix-mode ticket).

## Phase 1 — Review

**Problem**: `test/e125c-index-compaction.test.mjs` AC10/AC11 called a local `readCommitted()`
helper that read `tasks.md`, `.current/_primary/tasks.md`, and
`.current/tasks-index-receipt.json` straight off the LIVE repo disk (relative to the test
file's own directory). AC11 hard-codes facts about that content (exactly 3 kept sections,
exactly 7 `T-E125A-*` ids, `emitFeatureMetrics` ticket count === 7). Any future commit that
adds a row to the primary ledger (e.g. a release step 8a staging analogous to the already-
merged `T-RELV4W6-01` row) silently changes what "live disk" means out from under these
assertions with no code change to the feature under test — a false regression signal, or
(worse) a false pass if the drift happens to leave those exact facts intact until the day it
doesn't.

**Fix**: added `test/fixtures/e125c-frozen/{root-tasks.md, primary-tasks.md,
tasks-index-receipt.json}` — byte-exact copies of the 3 live paths as of commit `ed7432f`
(the E125c compaction snapshot AC11's facts describe), extracted via
`git show ed7432f:<path>` **in bash, outside the test file** (T-E77-02 forbids the TEST
itself from reading history — it does not forbid an engineer citing a sha in a fixture-
refresh comment or in this evidence doc). `readCommitted()` now reads only these frozen
files via a static `FROZEN` path map; it never touches the live repo tree and the test file
contains no `git` invocation of any kind (verified — see AC Execution / proof below).

Corrected two stale header comments that claimed live-disk/git-show/clean-working-tree
provenance:
- top-of-file summary comment (was: "AC10 reads the repo's OWN committed files (via `git show
  HEAD:<path>`)")
- the T-E77-02 rule note (was: "read straight off disk via fs (not git), which is exactly the
  committed content as long as the working tree is clean for these paths")

Both now describe the actual (frozen-fixture) mechanism. The AC10/AC11 test bodies,
assertion logic, and expected values are **unchanged** — only the data source changed, per
the cut.

## Phase 1.5 — Visual Compare

Skipped (no `design/e204-*.md` file, no `## Visual Baselines` H2 — this is a non-UI,
test-infrastructure-only ticket).

## Phase 3 — Tests

**Test File Discovery**: existing test file (`test/e125c-index-compaction.test.mjs`) — per
dispatch brief's Test-file placement line, this file is edited in place; the fixture
directory `test/fixtures/e125c-frozen/**` is new, creation pre-authorized.

**Spec-to-test map**: no `specs/e204-*.md` exists for this ticket (it was cut directly in
`docs/backlog.md` E204 / `tasks.md` T-E204-01, below the architect-split threshold per this
workspace's `scope_decision_why`). The ticket's own acceptance criteria (its 6 numbered cut
steps) map 1:1 to this doc's sections: (1) frozen fixtures → Phase 1 above; (2) repoint +
correct comments → Phase 1 above; (3) proof → AC Execution Log below; (4) integrator asks
(a)/(b) → AC Execution Log below; (5) commit + full suite → Run section below; (6) PASS +
complete → this write's `tw_update_state`/`tw_complete_task`.

**Coverage**: no new production code — this ticket only repoints two existing test cases at
frozen fixtures and adds fixture data files. No coverage-gate applies (test-infra-only
change, no `.ts`/`.js` source touched).

## Phase 3.5 — AC Execution Log

No `specs/<active_feature>.md` file exists for this ticket, so there are no `proof:`-
annotated Acceptance Criteria to scan. Skipped per SOP §6a absent-branch. The commands below
are recorded here as the ticket's own required proof steps (its cut items 3 and 4), not as
spec `proof:` annotations.

### 1. Fixture-content sha256 parity (integrator ask (a))

```
$ git show ed7432f:tasks.md                          | sha256sum
b0fb7d2e42c719b6c24448b8c086f64177df7f0b8483c77ce6b56874ab37ac44
$ sha256sum test/fixtures/e125c-frozen/root-tasks.md
b0fb7d2e42c719b6c24448b8c086f64177df7f0b8483c77ce6b56874ab37ac44   <- MATCH

$ git show ed7432f:.current/_primary/tasks.md         | sha256sum
7fdc034f3b5316cda0bc086e1ae99d3243a7188cbd50342b36c05d9a51a6a9e2
$ sha256sum test/fixtures/e125c-frozen/primary-tasks.md
7fdc034f3b5316cda0bc086e1ae99d3243a7188cbd50342b36c05d9a51a6a9e2   <- MATCH

$ git show ed7432f:.current/tasks-index-receipt.json  | sha256sum
7c029a0d57e665bef21651e0b9f2f3b4e75973f101df4d2cd340f204ff10253e
$ sha256sum test/fixtures/e125c-frozen/tasks-index-receipt.json
7c029a0d57e665bef21651e0b9f2f3b4e75973f101df4d2cd340f204ff10253e   <- MATCH
```

All 3 frozen copies are byte-exact to `git show ed7432f:<path>`. (Note: extracted via `git
show` run directly in bash against the primary checkout, never inside the test file — the
`sha256sum ed7432f`/`git show` commands above are commented, non-executable evidence text,
not code in `test/e125c-index-compaction.test.mjs`.)

Also confirmed via `git diff ed7432f 98052c6 -- .current/_primary/tasks.md
.current/tasks-index-receipt.json` (empty — those 2 paths are unchanged in committed history
between ed7432f and this lane's base commit); `git diff ed7432f 98052c6 -- tasks.md` shows
only appended `## Closed Lanes` marker lines (irrelevant to AC10's generic round-trip
property and to AC11's `_primary`-ledger-scoped assertions).

### 2. Proof: throwaway temp-git-repo regression demonstration (cut item 3)

Built in `$TMPDIR/e204-proof-<ts>/` — a full copy of this lane's working tree with `.git`
removed and re-initialized as its own throwaway repo (never the primary checkout, never this
lane worktree; `node_modules` is the lane's existing symlink to primary, read-only, never
written to).

| step | action | result |
|---|---|---|
| commit `dc7bc47` | init; commit lane content as-is (fixed test + frozen fixtures, pre-drift) | — |
| sanity run | `node --test test/e125c-index-compaction.test.mjs` (FIXED test, pre-drift) | 12/12 pass |
| commit `6ba8abd` | append `- [x] T-E125A-08 ... release-v4-wave7 step 8a ...` to `.current/_primary/tasks.md` — a `T-RELV4W6-01`-analogue row simulating the future primary-ledger addition E130 will introduce | — |
| **proof (post-fix, post-drift)** | `node --test test/e125c-index-compaction.test.mjs` (FIXED test, AFTER the drift commit) | **12/12 pass, 0 fail** — the fix is fully decoupled from live-ledger drift |
| **proof (pre-fix, post-drift)** | swap in `git show 98052c6:test/e125c-index-compaction.test.mjs` (the ORIGINAL, unmodified, live-disk-reading test) in the same drifted working tree, then `node --test test/e125c-index-compaction.test.mjs` | **10/12 pass, 2 fail**: `AC10 real-data round trip` (`AssertionError`, receipt/root mismatch against the now-drifted live ledger) and `AC11 consumer parity` (`AssertionError: expected 7, actual: 8` — the added row bumped the live `T-E125A-*` count) |

This demonstrates both halves the cut asked for: green after the fix, red before it, in the
identical drifted repo state — the exact regression this ticket exists to prevent.

### 3. Render-structure T-E77-02 stays green (integrator ask (b))

```
$ node --test test/render-structure.test.mjs
...
ok 15 - T-E77-02 guard-the-guard: the history-fixture detector reds against the pre-fix `git show ffa4082:...` line
# tests 15
# pass 15
# fail 0
```

Confirmed by direct inspection too: `findGitInvocations()` (the T-E77-02 detector) matches
only actual `execFileSync`/`spawnSync`/`spawn`/`execFile`/`execSync` calls whose command is
the literal `"git"` (plus a local `git(args, cwd)` wrapper convention), scanned with JS
comments stripped first. `test/e125c-index-compaction.test.mjs` contains zero such
invocations — `grep -n "git \|child_process\|execSync|spawn"` on the file matches only prose
inside `//` comments (the T-E77-02 rule citation and the fake-`.git` fixture-helper note),
which the detector's comment-strip pass excludes by design.

### 4. `**/tasks.md` scanner sweep

`npm run check:md-tables` (git-tracked-`*.md` scan, filename-agnostic) with the 3 new
fixtures staged: **OK — 301 file(s) scanned, 0 malformed tables** (4 pre-existing advisory
notes on `docs/backlog.md`, unrelated to this change, non-blocking). The fixture files are
named `root-tasks.md` / `primary-tasks.md` (not literally `tasks.md`), so no exact-filename
`**/tasks.md` glob can match them; the content-shape scan (`check-md-tables`) passed clean
regardless of name.

## Phase 4 — Run

- Build: `npm run build` — clean (tsc + `check:transitions-sync` OK, `check:version` OK,
  version 3.119.0).
- Full suite, post-commit-equivalent state (fixtures + test change staged in the lane):
  `npm test` → **2648/2648 pass, 0 fail**.
- `npm run check:md-tables` → **OK, 301 scanned, 0 malformed** (see above).
- Nothing outside the owned file set (`test/e125c-index-compaction.test.mjs`,
  `test/fixtures/e125c-frozen/**`, `qa_reports/**`, `.current/e204/**`) was touched.

**Verdict: PASS.**
## 2026-09-26T19:03:13.826Z — PASS — by qa-engineer

T-E204-01 PASS. Repointed test/e125c-index-compaction.test.mjs AC10/AC11 readCommitted() at new byte-exact frozen fixtures (test/fixtures/e125c-frozen/{root-tasks.md,primary-tasks.md,tasks-index-receipt.json}, pinned to commit ed7432f, sha256-verified identical to git show ed7432f:<path>); corrected the stale top-of-file and T-E77-02 header comments; no git invocation anywhere in the test file (confirmed against render-structure.test.mjs's T-E77-02 meta-test, 15/15 green). Proof in a throwaway $TMPDIR git repo (not primary, not this lane worktree): staged a T-RELV4W6-01-analogue row into .current/_primary/tasks.md — fixed test stayed 12/12 green post-drift; the original base-98052c6 test went 10/12 red (AC10, AC11) in the identical drifted tree. Commit 84a8818 on feat/e204-pin-e125c-fixture. Post-commit, clean tree: npm test 2648/2648 pass, 0 fail; npm run check:md-tables OK (303 files, 0 malformed tables, 4 pre-existing non-blocking advisories on docs/backlog.md unrelated to this change). Full details: qa_reports/review_T-E204-01.md.

