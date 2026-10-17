# QA review — T-E284-01 (lane e284, e284-fanout-handoff-command)

covers: T-E331-01, T-E332-01, T-E330-01, T-E284-01, T-E284-02, T-E333-01

## Round 1 — QA by qa-engineer

Contract: `specs/e284-fanout-handoff-command.md` (rulings R1 = (a), R2 = (a)). Code review round 1 APPROVED (`review_reports/review_T-E284-01.md`); its accepted deviation (a), the primary lane-status row's clean/dirty following the manifest-excluded `git status` fact, is treated as part of the contract here and pinned by the tests. R-1 / R-2 are recommended, not blocking, and are not re-raised.

Code under test: lane commits b0e77ec (E331), f0517fd (E332), 670d489 (E330), a1af4ff (E284). QA test commits: 8179ec4, 2b414ee (fixture name fix, see Phase 4). Full suite run on 8179ec4.

**Verdict: FAIL (round 1).** All five implementation tasks meet their ACs, but AC-HC-3 (full suite green) does not hold: `test/e234-hygiene-scan.test.mjs` AC16 is red on a line of the lane's own spec. Details under Phase 4.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e284-fanout-handoff-command.txt` declares 2 entries (e296 AC12, e322 AC-E322-9). Before any re-pin, the lane code was run against the pre-re-pin test files (b57d579 copies, scratch tree outside the worktree, lane `dist/` byte-identical):

- `test/e296-manifest-tier.test.mjs | AC12: …` — red (expects 3 continuation lines, gets 5). On manifest. Re-pinned 3 → 5, AC12 assertion line only.
- `test/e322-owners.test.mjs | AC-E322-9 usage unchanged and read-only` — red (expects 3 lines and no `owners`). On manifest. Re-pinned to "generic usage lists owners" (the case is renamed accordingly; it also checks that `OWNERS_USAGE` is still printed on an owners usage error and that the header no longer says owners is missing).
- Everything else in those three files: green. Every other test file and all source are byte-identical between the pre-re-pin tree and 8179ec4, and the full suite is green on 8179ec4, so no red outside the manifest existed.

Phase 0.5: clean (2/2 manifest entries confirmed red, 0 unexplained reds).

## Phase 1 — Review

Read `tools/fanout-handoff.ts`, the `tools/fanout-manifest.ts` and `scripts/fanout.mjs` diffs against the dispatch base. No correctness finding beyond the code review's. Surviving-mutant analysis (below) found the `primaryBranch !== target` guard in `movedReason` redundant with the rest-of-line comparison (an equivalent mutant: `primary（<other>）` can never equal `primary（<target>）`); harmless, no action.

### 3a Copy Audit

Every Copy / Strings row is asserted verbatim by a test:
- `usage.owners`, `usage.handoff`: e322 AC-E322-9 (owners line equality), e284 "integration branch and --closing" (handoff usage on a usage error); the 5-line count in e296 AC12.
- `handoff.intro`, `handoff.placeholder.closed`, `handoff.placeholder.decide`, `handoff.background.none`, `handoff.fact.*` (all ten keys and value shapes): e284 "generate fills facts" (exact stdout), "target relation", "status, foreign worktrees, watch-lock", "integration branch and --closing", "skeleton passes validate".
- `handoff.closing.annotation`: "integration branch and --closing", "closing round trip".
- `handoff.check.diff` / `.moved` / `.moved-closing` / `.summary`: "check names each difference", "target moved forward", "closing round trip", "check clean".
- `handoff.note.no-mailbox`: "read-only and no mailbox" (exact stderr).
- `handoff.err.fact-duplicate`: "errors" (message shape `fact "git status" appears on 2 lines (lines n, m)`).
- `handoff.err.git` (`HANDOFF_GIT_FAILED`): not reachable from a fixture without breaking git itself between calls; checked by inspection only (`gitFact`, `tools/fanout-handoff.ts:109-116`).
- `diff.err`: e331 (`GIT_DIFF_FAILED: git diff <a>...<b> failed in <repo>: <first stderr line>`).
- `handoff.err.reused`: "errors" (HANDOFF_SECTION_ABSENT, HANDOFF_SECTION_DUPLICATE, REPO_NOT_GIT, MANIFEST_UNREADABLE, USAGE), "target relation" (REF_NOT_FOUND). `MAILBOX_TILDE` is the existing `resolveMailboxHeader` path, unchanged; not re-tested.

No user-facing string outside the table was found. No drift.

### 3b Visual Audit

Visual Tokens: N/A (no visual literals). Nothing to audit.

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no Visual Baselines declared).

## Phase 3 — Tests

Placement (dispatch brief `Test-file placement` line, pre-authorized): re-pinned `test/e296-manifest-tier.test.mjs` (AC12 only, one line) and `test/e322-owners.test.mjs` (AC-E322-9); rewrote `test/e283-validate-handoff.test.mjs` (T-E333-01); created `test/e284-fanout-handoff.test.mjs`, `test/e331-git-diff-failure.test.mjs`, `test/e332-absolute-path-boundaries.test.mjs`. No `e330-*` file: the spec's E330 proofs are the two re-pins. No other file under `test/` was touched.

Wave rules: every fixture is built in the test under `os.tmpdir()`; no test asserts content of a growing `specs/fanout-*.md` (the only read of them is the existing AC-E283-11 invariant, kept as an invariant); no diff against a fixed sha; no machine-local path literal.

### AC → test map

| AC | test |
|---|---|
| AC-E284-1 | e284 "generate fills facts" (exact D2 stdout, `formatRearmCommand` shape, no temp root on stdout, CLI = in-process) |
| AC-E284-2 | e284 "skeleton passes validate" |
| AC-E284-3 | e284 "target relation" (ahead / behind / diverged / no origin ref / `--target integ/x` / `REF_NOT_FOUND` incl. option-shaped target) |
| AC-E284-4 | e284 "status, foreign worktrees, watch-lock" |
| AC-E284-5 | e284 "integration branch and --closing" |
| AC-E284-6 | e284 "check clean" |
| AC-E284-7 | e284 "check names each difference" (each change on a fresh fixture with its exact DIFF key set; 無 background; deleted line = `（缺）`; several changes) |
| AC-E284-8 | e284 "target moved forward" (MOVED + exit 0; non-ancestor and unknown sha = DIFF) |
| AC-E284-9 | e284 "errors" (CLI, both modes, no `    at `) |
| AC-E284-10 | e284 "read-only and no mailbox" (CLI; manifest, mailbox files, HEAD, porcelain, branches, remote refs, lane porcelain unchanged across generate / --check / --closing / --target) |
| AC-E284-11 | e284 "mailbox-watch parity" |
| AC-E284-12 | e284 "closing round trip", "closing round trip: not merged is a DIFF" |
| AC-E331-1 | e331 "owners range without merge base" |
| AC-E331-2 | e331 "check without merge base" |
| AC-E331-3 | e331 "other owners / check exit codes are unchanged on the same repo" + e322 / e177a / e178b pass |
| AC-E330-1 | e296 AC12 (re-pinned), e322 AC-E322-9 (re-pinned) |
| AC-E332-1 | e332 "new boundaries and forms" |
| AC-E332-2 | e332 "non-hits", "the earlier hit and non-hit sets are unchanged"; e283 AC-E283-5 |
| AC-E332-3 | ad-hoc sweep (AC Execution Log) + e296 / e235b pass |
| AC-E333-1 | rewritten e283 (all AC-E283-1..11 cases kept with the same codes; grammar via `validateManifest` / `isManifestClosed`; 5 CLI spawns, asserted ≤ 6 by its last case) + timing below |
| AC-HC-1 | ad-hoc render comparison (AC Execution Log) |
| AC-HC-2 | `git diff --stat` empty (AC Execution Log) |
| AC-HC-3 | full suite (Phase 4) |

### Negative controls

Run in scratch copies outside the worktree (never `git stash`):
- e331 against the dispatch-base build: both no-merge-base cases fail (base exits 1 with a stack trace); the unchanged-codes case passes.
- e332 against the dispatch-base build: "new boundaries and forms" and "non-hits" fail; the sanity and unchanged-set cases pass.
- e284 against mutated copies of `dist/tools/fanout-handoff.js`, each killed: R1 MOVED disabled; manifest not excluded from `git status`; 無 written over live facts; closing merge-ancestor check removed; closing rest-of-line check removed; closing `commits 0` removed; background-無 rule removed (killed after adding the misplaced-fact sub-case); non-fact lines read as facts; watch-lock fact disabled. One equivalent mutant survives (see Phase 1).

### Coverage

No line-coverage tooling is wired for `dist/` under `node --test`; not measured. Every exported function of `tools/fanout-handoff.ts` and every branch of `collectFacts` / `compareFacts` / `movedReason` / `parseHandoffArgs` named in the spec is reached by a case above, except `HANDOFF_GIT_FAILED` (needs git to fail between two calls on the same repo).

### Security smoke

Option-shaped `--target` (`--upload-pack=x`) → `REF_NOT_FOUND`; unknown flag, missing flag value, duplicate flag, extra positional, `--check` not first, no manifest → `USAGE`; non-git `--repo` → `REPO_NOT_GIT`; missing manifest → `MANIFEST_UNREADABLE`; no stack trace on any of them; no temp path on stdout; the absolute-path detector's messages never echo the path.

## T-E333-01 timing

`time node --test test/e283-validate-handoff.test.mjs`, same machine, same session (other lanes' suites were running, so absolute numbers are noisy):

| file | runs (real) |
|---|---|
| before (dispatch-base file, 13 cases, one CLI child per case) | 30.47 s, 39.79 s, 36.23 s |
| after (lane file, 17 cases, 5 CLI children) | 3.11 s, 2.63 s, 2.66 s |

After / before ≤ 3.11 / 30.47 ≈ 0.10, under the required quarter. `grep -c "spawnSync"` = 2 (the import and the one `cli()` helper).

## AC Execution Log

Spec ACs carry `proof:` lines; one log for the round (covers all six ids). Commands run from the lane worktree unless noted; the dispatch-base tree was extracted with `git archive 902462e` and built with `tsc` in a scratch dir outside the worktree (its `dist/tools/fanout-manifest.js` is byte-identical to the base's committed one).

| AC | command | result | verdict |
|---|---|---|---|
| AC-E284-1..12 | `node --test test/e284-fanout-handoff.test.mjs` | 13/13 pass (one case per proof name, AC-E284-12 split into two) | pass |
| AC-E331-1, -2 | `node --test test/e331-git-diff-failure.test.mjs` | 3/3 pass; against the base build the two no-merge-base cases fail | pass |
| AC-E331-3 | `node --test test/e322-owners.test.mjs test/e177a-check-cli.test.mjs test/e178b-fanout-unmatched.test.mjs` | all pass (e322 edited only in AC-E322-9) | pass |
| AC-E330-1 | `node --test test/e296-manifest-tier.test.mjs test/e322-owners.test.mjs` | all pass after the two re-pins (e296 diff = the AC12 count line only) | pass |
| AC-E332-1 | `node --test test/e332-absolute-path-boundaries.test.mjs` "new boundaries and forms" | pass; 9 lines, one error each, named by line number, no path echoed | pass |
| AC-E332-2 | same file "non-hits" + `node --test test/e283-validate-handoff.test.mjs` | pass | pass |
| AC-E332-3 | validate sweep over every `specs/fanout-*.md` present at the base, lane CLI vs base CLI, exit + stderr code set; plus `node --test test/e296-manifest-tier.test.mjs test/e235b-relative-worktree.test.mjs` | 23 manifests, 0 differ; non-zero at lane HEAD only `fanout-wave5.1.md` and `fanout-wave6.md`, exit 2, `{DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}`; both suites pass | pass |
| AC-E333-1 | `grep -c "spawnSync" test/e283-validate-handoff.test.mjs`; timing pair | 2; 5 CLI children at run time (asserted ≤ 6 in-file); after/before ≈ 0.10 (table above) | pass |
| AC-HC-1 | `render` for every dispatchable lane of every `specs/fanout-*.md`, lane CLI vs base CLI, identical args (`--summary SUM --reading R1 --reading R2 --primary <fixed> --base abc1234 --mailbox-root <fixed>`) | 65 lanes, 0 byte differences in stdout, stderr or exit (5 lanes exit non-zero identically on both sides) | pass |
| AC-HC-2 | `git diff --stat 902462e..HEAD -- tools/lane-status.ts scripts/mailbox-watch.mjs dist/tools/lane-status.js dist/tools/lane-status.d.ts` | empty; `HANDOFF_SECTION` / `HANDOFF_SUBITEMS` lines unchanged in the `fanout-manifest.ts` diff | pass |
| AC-HC-3 | `node scripts/test-lock.mjs -- npm test` on 8179ec4 (clean tree apart from the lane's tracked state files) | `# tests 3345 / pass 3342 / fail 1 / skipped 2`, exit 1 | **fail** |

## Phase 4 — Run

Build: `npm test`'s prebuild (`tsc`) succeeded with zero errors and left `dist/` unchanged. Headless, no interaction.

Full suite on 8179ec4: 3342/3345 pass, 2 skipped, **1 fail**: `test/e234-hygiene-scan.test.mjs` "AC16: an isolated copy of committed HEAD lists zero hits". Shared-artifact tests (compose-golden, context-budget) were green.

The scan reported three home-path hits:
- two in my new `test/e332-absolute-path-boundaries.test.mjs` (the AC-E332-1 colon-boundary probe used a one-letter home-dir name, which the scan does not treat as a placeholder). Fixed in 2b414ee by using the placeholder name `user`; the boundary case is unchanged and the file still passes 4/4.
- one in `specs/e284-fanout-handoff-command.md` line 239, the AC-E332-1 bullet with the colon-boundary example: its home-dir segment is a one-letter name, not on the scan's placeholder list. This line is not a test file, so QA cannot change it. After 2b414ee, `node --test test/e234-hygiene-scan.test.mjs` is 19/20 with this line as the only hit.

The suite was not re-run in full on 2b414ee: the only change is the e332 fixture, and the remaining red is in a file QA does not own. Round 2 re-runs it in full.

### Defect (round 1)

- **D-1 (blocks AC-HC-3)**: `specs/e284-fanout-handoff-command.md:239`, the AC-E332-1 bullet with the `path:` colon-boundary example. Its home-dir segment is a one-letter name, so `test/e234-hygiene-scan.test.mjs` AC16 counts it as a real home path and the suite is red at the lane HEAD. Fix: write the segment as a placeholder name (`user`, which is what the test now uses). The rule the line describes does not change. Expected effect: e234 AC16 green and the full suite green. The test fixture is already fixed. The spec is PM-authored text, so this is a one-line spec amendment.

No implementation defect was found in T-E331-01, T-E332-01, T-E330-01, T-E284-01 or T-E284-02. T-E333-01 is complete (rewrite and timing above).
