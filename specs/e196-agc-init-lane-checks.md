# e196-agc-init-lane-checks

Lane `e196` of backlog wave B (`specs/fanout-backlog-wave-b.md`). Tickets: **E196** (+ **E206** folded in), **E225** (+ **E353** folded in), **E205**. Human rulings that apply (Decisions table of the fan-out plan, 2026-11-09; the lane does not re-ask): ruling 2 = a (E205 warns only), ruling 3 = a (E225 directions (1) + (2), not (3)), ruling 6 = a (four lanes, ownership as re-cut in the plan).

All three tickets change `agc feature start` / `agc feature finish` / `agc check` in `bin/agc-init.mjs`. E225 also adds one line to `docs/lane-protocol.md` §6. E196 also removes the §3 known-gaps sub-item that names it, because fixing E196 makes that line false; its two test pins are re-pinned in this lane (integrator re-assignment, fan-out plan Decisions 2026-11-10).

## Problem Statement

Three lane-lifecycle gaps in `agc`:

1. **E196 / E206.** If `.current/<lane>/` is tracked, `agc feature finish` loses git-ignored files under it on the first run. `--shipped` moves the tracked dir with `git mv`, which carries tracked files only. `--abandoned` skips the harvest when the dir has any tracked content (E180 AC8). Either way, `git worktree remove` then deletes the ignored files (except `base-sha`, which is recorded in the pointer). Only the `--shipped` re-run path (`alreadyClosed`) copies them, using `laneIgnoredStateFiles`.
2. **E225 / E353.** A malformed `pending-ticket` block in `.current/<lane>/pending-tickets.md` is not parsed until `agc feature finish`, after the lane has merged. Fixing it then costs an extra lane commit and a second merge. Also, the `agc check` orphan detector reads only `parsePendingTickets(...).entries`. A branch whose findings are all malformed (they land in `errors`) is reported as having no unapplied findings, so those findings are lost without a warning.
3. **E205.** Nothing notices when a lane session writes into the primary checkout by mistake. The harness resets the shell cwd to primary after every call (E127), and no gate watches filesystem writes outside `workspace_path`.

## User Stories

- As an integrator, I want `agc feature finish` to keep a lane's git-ignored `.current/<lane>/` files when the lane dir is tracked, on the first run and for both dispositions, so that no governance record is deleted with the worktree.
- As a lane session, I want `agc check` to report malformed `pending-ticket` blocks in my lane's `pending-tickets.md` while the lane is still open, so that I can fix them before the report and finish does not refuse after the merge.
- As an integrator, I want the orphan-lane advisory to warn about a stranded branch whose findings are all malformed, so that those findings are never dropped without a warning.
- As an integrator, I want `agc feature finish` to name every path that appeared in the primary checkout's `git status` during the lane, so that I catch lane side-effect writes into primary before they get committed by mistake.

## Acceptance Criteria

Every new test lives in a temporary fixture repo (`mkTmp` + `git init`) and never in the real checkout. It does not read real `specs/fanout-*.md` content and does not diff against a fixed base sha. Test file names below are proposals: qa-engineer names them, within the owned globs `test/e196-*.test.mjs`, `test/e225-*.test.mjs` and `test/e205-*.test.mjs`.

### E196 + E206: git-ignored lane state on the first finish, tracked shape

- **AC-E196-1 (`--shipped`, first run, tracked shape).** Setup: a primary repo whose lane dir `.current/<lane>/` is tracked on `--base`. The lane worktree holds one or more git-ignored files under `.current/<lane>/` other than `base-sha` (for example an info/exclude rule `/.current/*/notes.local`). When `agc feature finish <lane> --shipped` runs for the first time (no `lane_closed` pointer yet), then:
  - each such file is in primary at `.current/history/<YYYY-MM>/<lane>/<relpath>` with the lane's bytes;
  - it is not committed (`git ls-files --error-unmatch` fails);
  - stdout carries string `e196.shipped-copy-line` followed by one `e196.copy-item` line per file;
  - the close commit, pointer line and `git mv` result are unchanged from today;
  - exit 0, the worktree is removed and the branch is deleted.

  proof: `node --test test/e196-ignored-lane-state.test.mjs` (case `AC-E196-1`)
- **AC-E196-2 (`--abandoned`, partly-tracked lane dir).** Given a lane whose `.current/<lane>/` has tracked content on the lane branch plus one or more git-ignored files other than `base-sha`, when `agc feature finish <lane> --abandoned` runs, then each such file is in primary at `.current/history/<YYYY-MM>/<lane>/<relpath>` with the lane's bytes, is not committed, and stdout carries `e196.abandoned-copy-line` + one `e196.copy-item` per file. Exit 0, the worktree is removed, the branch is kept. The tracked files are NOT copied (they are durable on the kept branch).
  proof: `node --test test/e196-ignored-lane-state.test.mjs` (case `AC-E196-2`)
- **AC-E196-3 (`base-sha` only: no change).** If the only git-ignored file under a tracked `.current/<lane>/` is `base-sha` (the default shape after `agc feature start`), neither disposition prints an `e196.*` line, and no `.current/history/<YYYY-MM>/<lane>/` dir is created for `--abandoned` (E180 AC8 holds unchanged). `--shipped` output is byte-identical to today's.
  proof: `node --test test/e180-abandoned-harvest.test.mjs test/agc-feature-finish-history.test.mjs test/e196-ignored-lane-state.test.mjs` all pass (case `AC-E196-3` in the new file).
- **AC-E196-4 (same listing as the re-run path).** Both dispositions list the files at risk with `laneIgnoredStateFiles`, the function the `alreadyClosed` re-run already uses: `git ls-files --others --ignored --exclude-standard` in the lane worktree, minus `base-sha`. They copy each file with the same per-file copy as `executeHarvestRefresh`, including its E335 D7 rule that a symlinked `pending-tickets.md` covered by the E287 findings plan is written as the findings' bytes. No second listing or copy routine is added.
  proof: code-reviewer reads the diff; `grep -n "laneIgnoredStateFiles(" bin/agc-init.mjs` shows exactly the definition, the `alreadyClosed` call, the first-run `--shipped` call and the `--abandoned` call.
- **AC-E196-5 (a failed copy is safe to re-run).** If a copy fails, finish throws `e196.copy-fail`, the worktree and branch stay in place, and exit is non-zero.
  - `--shipped`: the copy runs only after the close commit has landed. A re-run therefore takes the existing `alreadyClosed` path and finishes the copy through `executeHarvestRefresh`.
  - `--abandoned`: a re-run copies again. A history file with identical bytes is skipped; one with different bytes is overwritten (the copy-over rule `executeAbandonCurrentHarvest` already uses). **Exception, `pending-tickets.md` only** (AC-E196-6, amended after code-review round 1): a differing history copy of `pending-tickets.md` is not overwritten. The run refuses with `e287.preserve-differs-refuse` before any mutation, so nothing is lost. Every other ignored file keeps the copy-over rule.

  proof: `node --test test/e196-ignored-lane-state.test.mjs` (case `AC-E196-5`; a history destination that cannot be written, such as a dir at a file's path, forces the failure)
- **AC-E196-6 (E287 findings stay correct).** Setup: an ignored, worktree-only `.current/<lane>/pending-tickets.md` inside a tracked lane dir, which the E196 copy now covers. Rules (amended after code-review round 1):
  - **`--shipped` first run:**
    - the findings target's `covered` flag is true when the copy list includes that file (the rule the `alreadyClosed` branch of `shippedFindingsTarget` already applies);
    - **the E287 carry check stays armed regardless of `covered`**. Whenever primary itself holds a `.current/<lane>/pending-tickets.md` that `git mv` would carry into history (`carryAbs` exists) and its bytes differ from the lane's file, finish refuses with `e287.preserve-carry-refuse` before any mutation (nothing applied, nothing removed), exactly as on base. Coordinator's ruling: option (a) of the round-1 review.
  - **`--abandoned`:** `abandonedFindingsTarget` counts the file as covered only when the per-file plan includes it **and** no history destination for it exists yet. A differing existing destination is refused with `e287.preserve-differs-refuse`, which is the AC-E196-5 exception. This keeps `test/e287-finish-findings.test.mjs` AC-E287-3 and the non-owned `test/e335-symlinked-pending-harvest.test.mjs` AC-E335-4 green (AC-L7).
  - With no primary copy and no prior history copy, the end state is still exactly one regular file at `<hist>/pending-tickets.md` with the lane's bytes, plus the existing E287 warning; no refusal occurs.
  - With a carried primary copy whose bytes differ (`--shipped` first run): exit non-zero, the `e287.preserve-carry-refuse` text on stderr, primary's file unchanged, no close commit, and the worktree and branch left in place. Base `e5da97a` refuses this case the same way; the round-1 code also refused it.

  proof: `node --test test/e287-finish-findings.test.mjs test/e335-symlinked-pending-harvest.test.mjs test/e196-ignored-lane-state.test.mjs` all pass. The new file has cases `AC-E196-6` (covered, no refusal) and `AC-E196-6-carry` (tracked lane dir, ignored worktree-only `pending-tickets.md`, primary holds a differing copy at the same path, so `--shipped` refuses with `e287.preserve-carry-refuse` and primary's bytes survive).
- **AC-E196-7 (untracked shape unchanged).** When `.current/<lane>/` has no tracked content, both dispositions keep today's whole-dir harvest (`harvestSrc` / `planAbandonCurrentHarvest` copy). The new per-file copy never runs for that shape.
  proof: `node --test test/e213-shipped-ignored-shape.test.mjs test/e180-abandoned-harvest.test.mjs test/e217-abandoned-specs-harvest.test.mjs` pass unmodified.
- **AC-E196-8 (stale known-gap line removed).** `docs/lane-protocol.md` §3 line 44 is the sub-item `  - 已知缺口：E196（…）。`. E196 is the only gap it lists, so the whole line is deleted, not just the ticket name. After the change:
  - §3 has no `已知缺口` line;
  - the harvest sub-item (`  - 證據不靠 commit 進到 primary…`) is directly followed by the E383 ledger sub-item (`  - task 帳本（E383）：…`);
  - nothing else in §3 changes;
  - `E196` appears nowhere in `docs/lane-protocol.md`.
  proof: `grep -c "已知缺口" docs/lane-protocol.md` prints `0`, and `git diff $(git merge-base main HEAD)..HEAD -- docs/lane-protocol.md` shows exactly one removed line in §3.
- **AC-E196-9 (re-pins of the two tests that pin the removed line).** Only these two tests change:
  - `test/e351-lane-protocol-gaps.test.mjs` AC-E351-3 asserts that the line after the harvest sub-item is the E383 ledger sub-item (`  - task 帳本（E383）：` prefix), and that `E196` and `E217` each occur 0 times in the generic file. The `S3_GAPS` const, used only by AC-E351-3, may be deleted.
  - `test/e383-lane-ledger-worktree.test.mjs` AC-E383-7 asserts that `doc.s3-ledger` appears exactly once, directly after the harvest sub-item (`/^ {2}- 證據不靠 commit 進到 primary/`); its other assertions are unchanged.

  No other test in either file is edited. AC-E351-1/-2/-4, AC-E352-* and the other E383 cases stay with their current owners and stay green.
  proof: `node --test test/e351-lane-protocol-gaps.test.mjs test/e383-lane-ledger-worktree.test.mjs` passes, and `git diff $(git merge-base main HEAD)..HEAD -- test/e351-lane-protocol-gaps.test.mjs test/e383-lane-ledger-worktree.test.mjs` touches only the AC-E351-3 / AC-E383-7 test bodies (plus the `S3_GAPS` const).

### E225 + E353: malformed pending-ticket blocks reported early

- **AC-E225-1 (lane-side entry point = `agc check`).** Setup: `agc check` runs at the toplevel of a linked worktree whose branch resolves to lane `<lane>` (`resolveCurrentLane`), and the worktree's `.current/<lane>/pending-tickets.md` has malformed blocks. The file is parsed with `parsePendingTickets` and the same options `planPendingApply` passes: `appliedLaneLocalIds` = the keys of `findAppliedProvenance(<worktree docs/backlog.md text or "">, <lane>)`. Then stderr carries `e225.lane-check-head` once, followed by one `e225.lane-check-item` per `errors` entry, verbatim and in parser order.
  proof: `node --test test/e225-pending-tickets-check.test.mjs` (case `AC-E225-1`; the fixture has one YAML-invalid block and one block missing `title`, so stderr shows both errors)
- **AC-E225-2 (silent when clean).** If the file is absent, or every block parses, the new advisory prints nothing. Silence also holds in the primary checkout, which is not a linked worktree, and in a linked worktree whose branch names no lane.
  proof: `node --test test/e225-pending-tickets-check.test.mjs` (case `AC-E225-2`) and `node --test test/agc-adapters.test.mjs` passes unmodified.
- **AC-E225-3 (advisory, exit code unchanged).** The advisory never changes `agc check`'s exit code: 0 with current adapters, 1 only for stale adapters, as today. A failure inside the advisory prints `e225.lane-check-skip` and continues.
  proof: `node --test test/e225-pending-tickets-check.test.mjs` (case `AC-E225-3`: malformed file + current adapters gives exit 0)
- **AC-E225-4 (orphan detector never silent on malformed blocks).** Setup: a local `feat/<lane>-…` branch with no live worktree, whose committed `.current/<lane>/pending-tickets.md` has only malformed blocks (`entries` 0, `errors` ≥ 1). When `agc check` runs from primary, then:
  - the existing orphan warning line is printed for that branch, unchanged byte for byte;
  - right after it, `e225.orphan-errors-head` and one `e225.orphan-errors-item` per error are printed.
  The orphan scan keeps the two-argument parse (E124 AC7's contract). A branch with valid unapplied entries and no errors prints exactly today's output, and a branch with a live worktree is never reported.
  proof: `node --test test/e225-pending-tickets-check.test.mjs` (case `AC-E225-4`) and `node --test test/agc-feature-lifecycle.test.mjs` passes unmodified.
- **AC-E225-5 (parser and finish untouched).** `tools/lane-ticket-allocation.ts` is not modified. Finish still refuses a malformed block with today's message.
  proof: `git diff --name-only $(git merge-base main HEAD)..HEAD -- tools/ dist/` prints nothing; `node --test test/lane-ticket-allocation.test.mjs test/agc-feature-lifecycle.test.mjs` pass.
- **AC-E225-6 (lane-protocol §6 checklist line).** `docs/lane-protocol.md` §6 gains exactly one line, string `doc.s6-agc-check`, placed directly after the `## 6. 收工回報格式` heading and its blank line, before `寫進 \`to-integrator.md\``. Outside §6, the only change to the file is AC-E196-8's §3 line removal. The new line holds no repo-only string (`test/e290-lane-protocol-generic.test.mjs` AC-E290-3 stays green).
  proof: `git diff $(git merge-base main HEAD)..HEAD -- docs/lane-protocol.md` shows one added line inside §6 plus AC-E196-8's one removed §3 line, and nothing else; `node --test test/e290-lane-protocol-generic.test.mjs` passes unmodified.

### E205: primary side-effect detector (ruling 2 = a)

- **AC-E205-1 (snapshot at start).** When `agc feature start` succeeds, it writes the primary checkout's `git status --porcelain -z --untracked-files=all` output (raw bytes) to the lane's per-worktree git dir. The path is resolved with `git rev-parse --git-path agc-primary-status`, run in the new worktree and resolved against it. The snapshot is taken after `bootstrapLaneEnv`, in the same place `base-sha` is written. On success, start's stdout and stderr are byte-identical to today's. `test/e291-start-link-locations.test.mjs` asserts an empty stderr and must pass unmodified.
  proof: `node --test test/e205-primary-side-effects.test.mjs` (case `AC-E205-1`: the file exists at the `--git-path` location, and `git status --porcelain` in the lane worktree does not list it) and `node --test test/e291-start-link-locations.test.mjs`.
- **AC-E205-2 (finish names every new path, both dispositions).** Setup: after `agc feature start`, a new untracked file and a newly modified tracked file appear in primary. When `agc feature finish <lane> --shipped` or `--abandoned` runs, then:
  - before its first mutation, finish prints `e205.finish-new-paths-head` once, then one `e205.finish-new-paths-item` per new path, sorted, on stderr;
  - each named path is display-escaped with `escapeSegmentForDisplay`;
  - the exit code and every other line are unchanged, and teardown proceeds as today.

  proof: `node --test test/e205-primary-side-effects.test.mjs` (cases `AC-E205-2-shipped`, `AC-E205-2-abandoned`)
- **AC-E205-3 (primary's own in-flight work is not flagged).** A path already in primary's porcelain output at start (untracked or modified) is never named at finish, even if its content changed in between. The comparison is between path sets, not contents.
  proof: `node --test test/e205-primary-side-effects.test.mjs` (case `AC-E205-3`)
- **AC-E205-4 (finish's own outputs are not flagged).** These paths are excluded from the new set:
  - anything under `.current/history/<any bucket>/<lane>/`;
  - `<dir>/archive/<lane>/` for each `SHIPPED_EVIDENCE_DIRS` entry;
  - `<dir>/abandoned/<lane>/` for each `ABANDON_EVIDENCE_DIRS` and `ABANDON_HARVEST_DIRS` entry;
  - anything inside the lane worktree's own path, when that path is under primary.

  So a re-run after a refused `git worktree remove` does not name the first run's own harvest copies.
  proof: `node --test test/e205-primary-side-effects.test.mjs` (case `AC-E205-4`: first finish refused by a dirty lane worktree, then the re-run; neither run names a `.current/history/` path)
- **AC-E205-5 (no snapshot: silent skip).** If the snapshot file is absent (a lane started before this change, or a worktree made with plain `git worktree add`), finish prints no `e205.*` line and behaves as today. If `git status` in primary fails at finish, finish prints `e205.finish-check-skip` and goes on.
  proof: `node --test test/e205-primary-side-effects.test.mjs` (case `AC-E205-5`) and every existing finish suite passes, unmodified except where noted: `test/agc-feature-lifecycle.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e217-abandoned-specs-harvest.test.mjs`, `test/e246-mailbox-teardown.test.mjs`, `test/e287-finish-findings.test.mjs`, `test/e298-finish-remote-delete.test.mjs`, `test/e335-symlinked-pending-harvest.test.mjs`, and `test/e383-lane-ledger-worktree.test.mjs` (where only AC-E383-7 is re-pinned, per AC-E196-9).
- **AC-E205-6 (snapshot write failure is loud, not fatal).** If start cannot record the snapshot, it prints `e205.start-snapshot-warn` on stderr, still exits 0, and prints the `lane:` line. The same contract as the `base-sha` write.
  proof: code-reviewer reads the diff (the failure is hard to force portably; no test required).
- **AC-E205-7 (nothing tracked, nothing harvested).** The snapshot is never inside any working tree. It cannot be committed, does not show in `git status`, is never copied by any finish harvest (E196's included), and goes away with the worktree's admin dir on `git worktree remove`.
  proof: `node --test test/e205-primary-side-effects.test.mjs` (case `AC-E205-7`: after `--shipped`, no `agc-primary-status` file exists anywhere under primary's working tree, and `git worktree list` no longer lists the lane)

### Lane-level

- **AC-L1 (scope).** `git diff --name-only $(git merge-base main HEAD)..HEAD` lists only paths in this lane's owned set (fan-out plan, Lanes row `e196`).
- **AC-L2 (dist).** `npm run build` followed by `git status --porcelain dist/` prints nothing. No owned TypeScript source changes, so no `dist/` artefact changes.
- **AC-L3 (stamps).** `node bin/agc-init.mjs check` exits 0 in the lane worktree.
- **AC-L4 (full suite).** On the final committed HEAD with a clean tree, `node scripts/test-lock.mjs -- npm test` passes. qa records `qa_suite_result`.
- **AC-L5 (Node 20).** The targeted suites in *Dependencies / Prerequisites → Node 20 verification* pass under Node 20.
- **AC-L6 (audit + bookkeeping).** `npm audit --audit-level=high` and `npm run check:bookkeeping` both exit 0.
- **AC-L7 (forbidden tests untouched and green).** `test/e130-lane-default.test.mjs` and `test/e125a-lane-local-ledgers.test.mjs` are unmodified and green. So are the non-owned suites named above: e106, e108, e246, e290, e291, e298 and e335. In `test/e351-lane-protocol-gaps.test.mjs` and `test/e383-lane-ledger-worktree.test.mjs`, everything except AC-E351-3 / AC-E383-7 (AC-E196-9) is unmodified and green. If any of these turns red, stop and send mail. Do not edit it.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e196.shipped-copy-line | `agc feature finish — copied <n> git-ignored file(s) under .current/<lane>/ into <histRel>/ (fs copy, not committed — git mv carries tracked files only):` | authored-here — mirrors e125b.harvest-refresh-line's shape; stdout, after the close commit's line |
| e196.abandoned-copy-line | `agc feature finish — copied <n> git-ignored file(s) under .current/<lane>/ into .current/history/<bucket>/<lane>/ (fs copy, not committed — the tracked rest of .current/<lane>/ stays on <branch>):` | authored-here — the --abandoned twin (E206) |
| e196.copy-item | `  <rel>` (two spaces, the worktree-relative path `laneIgnoredStateFiles` returned) | authored-here — same item form as e125b.harvest-refresh-line |
| e196.copy-fail | `agc feature finish <verb>: copy of git-ignored .current/<lane>/ files into <histRel>/ failed (<reason>) — worktree and branch left in place (re-running finish is safe)` | authored-here — same tail as e125b re-harvest failure |
| e196.list-fail | `agc feature finish <verb>: could not list git-ignored files under <laneRel>/ in <lanePath> (nothing removed)` — `<verb>` = `--shipped` keeps today's text byte for byte | existing text of `laneIgnoredStateFiles`, verb now a parameter |
| e225.lane-check-head | `agc check — warning: .current/<lane>/pending-tickets.md has <n> problem(s) that agc feature finish will refuse — fix them on this branch before the lane report:` | authored-here — mirrors finish's refusal header (`planPendingApply`) |
| e225.lane-check-item | `  <error>` (the parser's `errors` entry verbatim) | authored-here — same item form as finish's refusal |
| e225.lane-check-skip | `agc check — warning: pending-tickets check skipped (<reason>)` | authored-here — same shape as the orphan-scan skip line |
| e225.orphan-errors-head | `agc check — warning: branch <branch>'s .current/<lane>/pending-tickets.md has <n> malformed pending-ticket block(s) — agc feature finish will refuse it until they are fixed:` | authored-here — printed directly after the existing orphan line for that branch |
| e225.orphan-errors-item | `  <error>` | authored-here |
| e205.start-snapshot-warn | `agc feature start — warning: could not record the primary checkout's git status snapshot (<reason>) — finish will not check the primary checkout for new paths` | authored-here — same contract as the base-sha warning |
| e205.finish-new-paths-head | `agc feature finish — warning: <n> path(s) in the primary checkout's git status are new since agc feature start (a lane session may have written here by mistake; nothing was changed — check them by hand):` | authored-here — ruling 2 = a: warn, name every path |
| e205.finish-new-paths-item | `  <path>` (escapeSegmentForDisplay) | authored-here |
| e205.finish-check-skip | `agc feature finish — warning: primary checkout new-path check skipped (<reason>)` | authored-here |
| doc.s6-agc-check | `送出回報前，在 worktree 跑 \`agc check\`：它用 \`agc feature finish\` 的同一個 parser 解析 \`.current/<lane>/pending-tickets.md\`；印出的每一個 pending-tickets 問題都先在本 branch 修好、commit，再回報。` | authored-here — ruling 3 = a direction (1), the §6 pre-report checklist line |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Changing `parsePendingTickets`, relaxing what it accepts, or changing finish's refusal of a malformed block (backlog E225: "do not relax the parser").
- Direction (3) of E225: the integrator SOP stage-5a check parsing the file instead of `git show` (`content/skill-integrator.md`, ruling 3 = a).
- Reporting `allocateTicketIds` unresolved `depends_on` early. The lane check prints the parser's `errors` only.
- Refusing finish on new primary paths (ruling 2 = b was not chosen). The same goes for any automatic clean-up of them.
- Detecting writes into git-ignored primary paths, or content changes to a path already dirty at start. The snapshot is a path set of the default porcelain view.
- Symlinks under `.current/<lane>/` other than the E335 `pending-tickets.md` case. The first-run copy treats them exactly as the existing re-run copy does.
- Every other line of `docs/lane-protocol.md` §3, and every test in `test/e351-lane-protocol-gaps.test.mjs` / `test/e383-lane-ledger-worktree.test.mjs` other than AC-E351-3 / AC-E383-7. Those stay with lane e262 or stay common-forbidden.
- Preserving primary's own copy of a git-ignored non-findings file that `git mv` carries. If primary holds a file at `.current/<lane>/<rel>` with the same relpath as a git-ignored lane file, the first-run `--shipped` copy overwrites the carried bytes with the lane's bytes (lane bytes win, per the copy rule). Only `pending-tickets.md` is protected, by the E287 carry check (AC-E196-6).
- `STR_USAGE_FEATURE` help text and `docs/install.md` descriptions of finish.
- Release bookkeeping: version bump, CHANGELOG, `docs/backlog.md` done-marks (E353 marked CLOSED by E225). These belong to the integrator / release-engineer after the merge.

## Dependencies / Prerequisites

- **Decisions inherited (no Question Batch needed):** rulings 2 = a and 3 = a, plus the plan's ownership re-cut. Two choices the plan left to PM are made here:
  - **E225 entry point = `agc check`** (`bin/agc-init.mjs`). Reasons:
    - it already runs in lane worktrees and already hosts the orphan detector, so both directions live in one file;
    - `lane-status` is the integrator's observability script, run from primary, so it is the wrong side for a lane-side pre-report check;
    - `parsePendingTickets` and `findAppliedProvenance` are already exported, so `tools/lane-ticket-allocation.ts`, `tools/lane-status.ts`, `scripts/lane-status.mjs` and their `dist/` artefacts are **not touched**.
  - **E205 snapshot location = the lane's per-worktree git dir** (`git rev-parse --git-path agc-primary-status` in the lane worktree; under `artifacts: repo` that is `<common git dir>/worktrees/<name>/agc-primary-status`). Reasons:
    - (a) In this repo's `artifacts: repo` shape, `.current/<lane>/` is committed whole. A snapshot there would be committed unless a new exclude rule is added to `LANE_EXCLUDE_RULES`. That rule list is pinned by `test/e106-init-artifacts-flag.test.mjs`, `test/e108-eject.test.mjs` and `test/e291-start-link-locations.test.mjs`, none of them owned by this lane.
    - (b) An ignored file under `.current/<lane>/` would also be picked up by E196's new copy and land in history.
    - (c) The per-worktree git dir is outside every working tree. It survives until finish (which reads it before `git worktree remove`) and is deleted by git together with the worktree's admin dir.
    - (d) It is not a `.current/` filename, so `tools/lane-paths.ts` (the sole owner of lane `.current/` filenames) is **not touched**.
- **Line numbers re-verified on base `4b25061`:**
  - in `bin/agc-init.mjs`:
    - `checkOrphanLanes` :728 (two-argument parse :758), `runCheck` :892, `isLinkedWorktree` :637;
    - `runFeatureStart` :1528 (`base-sha` write after `bootstrapLaneEnv` :1611), `parsePorcelainZ` :1633;
    - `planAbandonCurrentHarvest` :1841 (AC8 tracked-content early return :1852), `executeAbandonCurrentHarvest` :1909;
    - `planPendingApply` :2095 (parse :2099), `readUnallocatedFindings` :2319 (parse :2334), `shippedFindingsTarget` :2343, `abandonedFindingsTarget` :2372;
    - `laneIgnoredStateFiles` :2624, `planLaneClose` :2656 (`alreadyClosed` branch :2660–2684, first-run return :2710–2711);
    - `executeLaneClose` :2754 (`git mv` :2811, commit :2852), `executeHarvestRefresh` :2885;
    - `applyPendingOnAbandoned` :3103, `runFeatureFinish` :3211;
  - `parsePendingTickets` at `tools/lane-ticket-allocation.ts:389`;
  - `docs/lane-protocol.md` §3 known-gaps sub-item :44 (the only `已知缺口` line in the file), §4 :55–74, §6 :114–132;
  - test pins of that line: `test/e351-lane-protocol-gaps.test.mjs` `S3_GAPS` :46–47 and AC-E351-3 :81–85; `test/e383-lane-ledger-worktree.test.mjs` AC-E383-7 :182–190 (the `已知缺口：E196` match at :187).
- **Ownership re-cut (integrator, fan-out plan Decisions 2026-11-10, cut pre-review flag (a)):** this lane now also owns the §3 line 44 of `docs/lane-protocol.md`, plus AC-E351-3 of `test/e351-lane-protocol-gaps.test.mjs` and AC-E383-7 of `test/e383-lane-ledger-worktree.test.mjs`. The rest of e351 stays with e262.
- **Intentional reds between T-E196-08 and T-E196-09:** after the §3 removal, AC-E351-3 and AC-E383-7 fail until qa re-pins them. sr records both in `qa_reports/expected-red_e196-agc-init-lane-checks.txt`.
- **Order inside finish (E205):** the snapshot compare runs after the target worktree is resolved and before the `--shipped` merge guard and every other check or mutation. That way it never sees finish's own writes, and it prints even when finish later refuses.
- **Order inside finish (E196 `--shipped`):** the per-file copy runs after `executeLaneClose` returns, so the close commit has landed. It runs before `executeFindingsPreserve`, `applyIgnoredEvidenceHarvest` and `removeWorktreeNoForce`. Copying before the commit would let the `git mv` rollback carry the copies back into `.current/<lane>/`.
- **Node 20 verification (CI runs Node 20 and 22; this lane touches filesystem copies).** The local default is Node 22. qa runs the targeted suites under Node 20 with fnm:
  ```
  fnm exec --using=20 node --test test/e196-ignored-lane-state.test.mjs test/e205-primary-side-effects.test.mjs test/e225-pending-tickets-check.test.mjs test/e180-abandoned-harvest.test.mjs test/e213-shipped-ignored-shape.test.mjs test/e217-abandoned-specs-harvest.test.mjs test/e287-finish-findings.test.mjs test/e335-symlinked-pending-harvest.test.mjs test/agc-feature-finish-history.test.mjs test/agc-feature-lifecycle.test.mjs
  ```
  Run it after `npm run build` on the final HEAD. Record pass/total for each Node version in the QA evidence.
  - Known-environmental Node 20 failures in unrelated SQLite suites are not part of this run.
  - The risk to cover is Node 20's `fs.cpSync`, which refuses link-over-link (E335 D8). The `--abandoned` re-run copy-over must skip byte-identical destinations (`sameFileBytes`) the way `planLaneClose`'s refresh does.
- **Visual Structural Assertions:** omitted (no `design/<feature>.md`; mode = no-design).
- **External references:** none (all sources are in-repo backlog rows and the fan-out plan).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E196-01 | sr (E196 + E206; AC-E196-1..7). In `bin/agc-init.mjs`: give `laneIgnoredStateFiles` a `verb` parameter (`--shipped` text unchanged). In `planLaneClose`'s first-run tracked branch, plan the per-file copy into `histAbs` with the same `{src,dst,rel}` mapping the `alreadyClosed` branch uses, and set `covered` in `shippedFindingsTarget` from it. Run the copy after `executeLaneClose` with a shared copy loop factored out of `executeHarvestRefresh`; the message is a parameter, keeping string `e125b.harvest-refresh-line` byte for byte for the re-run. In `planAbandonCurrentHarvest`, replace the tracked-content early return with a per-file plan when `laneIgnoredStateFiles(..., "--abandoned")` is non-empty: identical destinations skipped, others copied over, history non-dir refusal kept. Execute it in place of the whole-dir copy and make `abandonedFindingsTarget`'s `covered` match the plan. Strings `e196.*`. About 120 lines | none | 1 | `bin/agc-init.mjs` | — |
| T-E196-02 | sr (E225 + E353; AC-E225-1..6). In `bin/agc-init.mjs`: add an advisory to `runCheck`, gated like `checkWorktreeEvidence` (linked worktree, a real lane from `resolveCurrentLane`). It parses the worktree's `.current/<lane>/pending-tickets.md` with `planPendingApply`'s options (`appliedLaneLocalIds` from `findAppliedProvenance` over the worktree's backlog file or `""`) and prints `e225.lane-check-*`. In `checkOrphanLanes`, keep the two-argument parse and compute `has` as live non-`target_repo` entries OR `errors.length > 0`. After the unchanged orphan line, print `e225.orphan-errors-*` for a branch with errors. In `docs/lane-protocol.md` §6, add the one line `doc.s6-agc-check`. About 70 lines | T-E196-01 | 2 | `bin/agc-init.mjs`、`docs/lane-protocol.md` | — |
| T-E196-03 | sr (E205; AC-E205-1..7). In `bin/agc-init.mjs`, `runFeatureStart`: after `bootstrapLaneEnv`, next to the `base-sha` write, save primary's `git status --porcelain -z --untracked-files=all` bytes to `git rev-parse --git-path agc-primary-status` (resolved against the lane worktree). On failure, print `e205.start-snapshot-warn`; silent on success. In `runFeatureFinish`, right after the worktree is resolved and before any check or mutation: read the snapshot (absent means silent skip), re-run the same status in primary, and diff the path sets with `parsePorcelainZ`. Drop the AC-E205-4 prefixes, then print `e205.finish-new-paths-*` on stderr, sorted and escaped. On a git failure, print `e205.finish-check-skip`. Exit code unchanged. About 90 lines | T-E196-02 | 1 | `bin/agc-init.mjs` | — |
| T-E196-04 | qa (E196 tests): new `test/e196-ignored-lane-state.test.mjs` covering AC-E196-1..6 in temporary fixture repos (an info/exclude rule for one ignored lane file; tracked lane dir; both dispositions; failed-copy re-run; E287 interplay). No real `specs/fanout-*.md`, no fixed base sha | T-E196-01 | 1 | `test/e196-ignored-lane-state.test.mjs` | — |
| T-E196-05 | qa (E225 tests): new `test/e225-pending-tickets-check.test.mjs` covering AC-E225-1..4 (lane-side advisory in a fixture linked worktree; silent cases; exit code; orphan branch with malformed-only file). AC-E225-5/6 by the diff commands | T-E196-02 | 1 | `test/e225-pending-tickets-check.test.mjs` | — |
| T-E196-06 | qa (E205 tests): new `test/e205-primary-side-effects.test.mjs` covering AC-E205-1..5 and 7 (snapshot location + not in lane `git status`; new untracked + newly modified paths named for both dispositions; pre-existing dirty paths not named; re-run after a refused worktree remove names no `.current/history/` path; absent snapshot is silent; snapshot gone after teardown) | T-E196-03 | 1 | `test/e205-primary-side-effects.test.mjs` | — |
| T-E196-08 | sr (E196 doc; AC-E196-8): first re-check the line number. In `docs/lane-protocol.md` §3, delete the whole known-gaps sub-item at line 44 (`  - 已知缺口：E196（…）。`); E196 is the only gap it lists. Nothing else in §3 changes. Record the two intentional reds (AC-E351-3, AC-E383-7) in `qa_reports/expected-red_e196-agc-init-lane-checks.txt`. 1 line | T-E196-03 | 1 | `docs/lane-protocol.md` | — |
| T-E196-09 | qa (E196 re-pins; AC-E196-9): re-pin only AC-E351-3 in `test/e351-lane-protocol-gaps.test.mjs` (harvest sub-item directly followed by the E383 ledger sub-item; `E196` and `E217` counts 0; `S3_GAPS` may be deleted) and only AC-E383-7 in `test/e383-lane-ledger-worktree.test.mjs` (ledger line directly after the harvest sub-item). Dispose of both expected-red entries. No other test in either file changes | T-E196-08 | 2 | `test/e351-lane-protocol-gaps.test.mjs`、`test/e383-lane-ledger-worktree.test.mjs` | — |
| T-E196-10 | qa (lane verification; replaces the voided T-E196-07, which lacked the re-pin dependency): no other re-pins planned. If an owned existing test needs one (`test/agc-feature-lifecycle.test.mjs`, `test/agc-feature-finish-history.test.mjs`, `test/agc-adapters.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/e217-abandoned-specs-harvest.test.mjs`, `test/e287-finish-findings.test.mjs`, `test/lane-ticket-allocation.test.mjs`, `test/lane-paths.test.mjs`), explain it in evidence. A red non-owned test means stop and send mail. On the final committed HEAD with a clean tree, run AC-L1..L7, including the Node 20 command above and the full suite under `node scripts/test-lock.mjs -- npm test` with `qa_suite_result` recorded | T-E196-04, T-E196-05, T-E196-06, T-E196-09 | 0 | — | — |

## Station Map

Station → AC → task (companion to the Cut table above).

| station (file : site) | ACs | task |
|---|---|---|
| `bin/agc-init.mjs` : `laneIgnoredStateFiles`, `planLaneClose`, `executeLaneClose` / new copy step, `executeHarvestRefresh`, `shippedFindingsTarget`, `planFindingsPreserve` (carry check armed whenever `carryAbs` exists) | AC-E196-1, -3, -4, -5, -6, -7 | T-E196-01 |
| `bin/agc-init.mjs` : `planAbandonCurrentHarvest`, `executeAbandonCurrentHarvest`, `abandonedFindingsTarget` | AC-E196-2, -3, -5, -6, -7 | T-E196-01 |
| `bin/agc-init.mjs` : `runCheck` + new lane pending-tickets advisory | AC-E225-1, -2, -3 | T-E196-02 |
| `bin/agc-init.mjs` : `checkOrphanLanes` | AC-E225-4 | T-E196-02 |
| `docs/lane-protocol.md` : §3 line 44 (known-gaps sub-item, removed) | AC-E196-8 | T-E196-08 |
| `docs/lane-protocol.md` : §6 | AC-E225-6 | T-E196-02 |
| `bin/agc-init.mjs` : `runFeatureStart` | AC-E205-1, -6, -7 | T-E196-03 |
| `bin/agc-init.mjs` : `runFeatureFinish` (compare before first check) | AC-E205-2, -3, -4, -5 | T-E196-03 |
| `test/e196-ignored-lane-state.test.mjs` | AC-E196-1..6 | T-E196-04 |
| `test/e225-pending-tickets-check.test.mjs` | AC-E225-1..4 | T-E196-05 |
| `test/e205-primary-side-effects.test.mjs` | AC-E205-1..5, 7 | T-E196-06 |
| `test/e351-lane-protocol-gaps.test.mjs` : AC-E351-3 (+ `S3_GAPS`) | AC-E196-9 | T-E196-09 |
| `test/e383-lane-ledger-worktree.test.mjs` : AC-E383-7 | AC-E196-9 | T-E196-09 |
| lane-wide | AC-E225-5, AC-L1..L7 | T-E196-10 |

The four sr tasks run serially (T-E196-01 → 02 → 03 → 08): 01–03 share `bin/agc-init.mjs`, and 02 and 08 share `docs/lane-protocol.md`. T-E196-07 was voided at the pre-review amendment and replaced by T-E196-10. The §3 removal is a separate sr task (T-E196-08) so the already-recorded ledger rows T-E196-01..06 stay as written. Each one is within the task-size budget (≤ 5 files, ≤ 300 lines).
