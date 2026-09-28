# e177b-lane-status-tooling

## Problem Statement
The integrator SOP (`.claude/commands/integrator.md`) currently does lane
observability by hand: reading each worktree's `.current/<lane>/handoff.md`,
running `git log`/`git status` per lane, adding up ticket/hop/round counts
against caps, and eyeballing whether a lane's claimed `completed_tasks` count
matches its on-disk qa evidence. Wave 5 showed each of these fail by hand:
a PASS lane was misreported as "still in code review" from inference
(no `/integrator status` script — item 8), a merged handoff read
`completed_tasks: []` while its `qa_reports/` held 8 review files (item 9,
the E175(d) class gap), and concurrent lanes' full-suite `npm test` runs
starved each other because macOS has no `flock` (item 11, E182). The
Wave 5.1 mailbox watcher was a hand-written shell loop whose counting
(`grep -c ... || echo 0`) silently produced `0\n0` and missed a message for
~15 minutes. This ticket (E177b) ships all four as tracked, tested tools so
the integrator (and lanes, for the mailbox wait loop) stop re-deriving this
by hand every wave.

## User Stories
- As the integrator, I want a single command that lists every lane's git
  state and handoff state together, so that I never report a lane's status
  from inference.
- As the integrator, I want per-feature roll-up totals that are
  cross-checked against on-disk qa evidence, so that a lane under-reporting
  (or over-reporting) `completed_tasks` is caught mechanically, not by luck.
- As a lane or the integrator, I want concurrent `npm test` runs on this
  machine to queue instead of starving each other, so that Wave-5-style
  flakes from parallel full suites stop recurring.
- As the integrator, I want a single watcher tool that both continuously
  monitors every lane's mailbox and serves a lane's one-shot "wait for the
  next message" loop, so that mailbox message counting is correct and
  consistent everywhere it's used.

## Acceptance Criteria

- **AC1** — Given a git repo with sibling worktrees, when
  `node scripts/lane-status.mjs` runs with no arguments, then it lists every
  sibling lane derived from `git worktree list` (via `tools/lane-registry.ts`,
  imported not modified), and never reads or requires any
  `specs/fanout-*.md` manifest (E177a's concern, out of scope here).
  proof: `test/e177b-lane-status.test.mjs` asserts the lane list is produced
  with no `specs/fanout-*.md` fixture present.

- **AC2** — Given a lane worktree with `.current/<lane>/handoff.md`, when
  lane-status runs, then that lane's row reports `active_feature`, `status`,
  `last_agent` (from the handoff), the `git log main..<branch> --oneline`
  commit list/count, and `git status --porcelain` (clean/dirty + changed-file
  count).
  proof: `test/e177b-lane-status.test.mjs` fixture lane asserts all four
  fields present and correctly sourced.

- **AC3** — Given a lane whose `handoff.md` is missing or unparseable, when
  lane-status runs, then that lane is still listed (never dropped) with a
  stated reason, and the overall report is marked degraded — same
  degrade-honestly posture as `tools/feature-rollup.ts`.
  proof: `test/e177b-lane-status.test.mjs` fixture with a corrupt handoff
  asserts the lane is carried with `readable: false` and a reason string.

- **AC4** — Given N lanes whose handoffs report `hop_count` / round data for
  one feature, when `node scripts/lane-status.mjs --rollup <feature-id>`
  runs, then it sums tickets/hop/review+qa rounds for the matching lanes and
  compares the totals against the caps imported from `tools/transitions.ts`
  by their REAL exported names — `HOP_CAP_EXPORTED`, `ROUND_CAP_EXPORTED`,
  `REVIEW_ROUND_CAP_EXPORTED` (`ROUND_CAP`/`REVIEW_ROUND_CAP` are internal,
  unexported constants — do not reference them) — never a hardcoded number.
  proof: `test/e177b-rollup.test.mjs` synthetic fixture exceeding a cap
  asserts the OVER-cap verdict line names the correct cap constant's value.

- **AC5** — Given a lane's handoff reports a `completed_tasks` count that
  disagrees with the qa evidence actually on disk in that lane's worktree
  (`qa_reports/review_<id>.md`, `qa_reports/archive/<feature>/review_<id>.md`,
  and the `covers:` label-line convention — reusing `tools/evidence-file.ts`'s
  `buildCoverageIndex`/`parseCoversIds`, imported not modified), when the
  roll-up runs, then it independently counts evidence-backed task ids and
  flags a mismatch explicitly (the E175(d) class bug: a merged handoff read
  0 completed while evidence covered 8) — it never silently trusts the
  handoff's own count. The in-scope test, the PASS-only filter, the
  ticket-token-not-derivable posture, and the voided-id exclusion (AC5a-AC5d)
  apply identically to the flat `qa_reports/` dir and to
  `qa_reports/archive/<feature>/` — neither directory is ever scanned
  unfiltered.
  proof: `test/e177b-rollup.test.mjs` fixture lane with `completed_tasks: []`
  but 8 `review_<id>.md` files asserts the mismatch is flagged with both
  numbers shown.

- **AC5a** (R3 amendment — archive scoping parity) — Given a lane's
  `qa_reports/archive/<feature>/` directory holds evidence for MANY features
  (a wave-level release archive, e.g. `archive/release-v4-wave6/` holding
  `T-E125A-*`, `T-E125B-*`, `T-E125C-*`, `T-E126-*` and `T-E145-*` alongside
  the lane's own `T-RELV4W6-01`), when the evidence cross-check runs, then
  the SAME in-scope test applied to the flat `qa_reports/` dir (AC5) also
  applies to the archive dir — an id counts only when it is in the lane's
  `completed_tasks` OR carries the lane's ticket token as a delimited
  segment — never every id the archive directory happens to hold. This is
  the live false positive the unfiltered archive scan produces today:
  `--all` on a lane whose `active_feature` is `release-v4-wave6` must NOT
  report evidence-backed ids = 29 when only `T-RELV4W6-01` is actually in
  scope; the other 28 archived ids from unrelated features are silently
  excluded, never flagged as a mismatch.
  proof: `test/e177b-rollup.test.mjs` fixture with an
  `archive/release-v4-wave6/` directory holding 28 out-of-scope
  `review_<id>.md` files plus one in-scope `review_T-RELV4W6-01.md`, and a
  handoff whose `completed_tasks` already lists `T-RELV4W6-01`, asserts the
  evidence count is 1 (not 29) and NO mismatch is reported.

- **AC5b** (R3 amendment — PASS-only evidence) — Given a `review_<id>.md`
  file (flat or archived) whose only recorded round(s) end in FAIL (no
  `— PASS — by qa-engineer` section header, per the format
  `gates/qa-review.ts`'s `recordReviewInFile` writes, ever appears in the
  file), when the evidence cross-check runs, then that id is NOT counted as
  evidence-backed — a FAIL-only round is not proof the task is done. A file
  that later reached PASS in a subsequent round (a FAIL section followed by
  a PASS section, both present) DOES count.
  proof: `test/e177b-rollup.test.mjs` fixture with one `review_<id>.md`
  containing only a FAIL round and a second containing a FAIL round followed
  by a PASS round asserts the first id is excluded from `evidenceIds` and
  the second is included.

- **AC5c** (R3 amendment — ticket token not derivable) — Given a lane whose
  `active_feature` yields no derivable ticket token (e.g. `release-v4-wave6`
  — no `e<digits>`-shaped leading segment), when the evidence cross-check
  runs, then the report explicitly prints `ticket token not derivable —
  comparing completed_tasks only` for that lane instead of guessing, and
  scoping falls back to `completed_tasks` membership alone for BOTH the flat
  and archive directories.
  proof: `test/e177b-rollup.test.mjs` fixture with `active_feature:
  "release-v4-wave6"` asserts the exact printed line and that only ids
  already in `completed_tasks` are ever counted as in-scope.

- **AC5d** (R3 amendment — voided ids excluded) — Given a task id that has
  been voided in the lane's own `tasks.md` (the `- [-] <id> ... (voided:
  ...)` marker convention documented in `tools/tasks-file.ts`), when the
  evidence cross-check runs, then that id is excluded from evidence-backed
  ids even if a `review_<id>.md` file (or a `covers:` line naming it) exists
  on disk — a voided task's leftover evidence must never count toward the
  roll-up.
  proof: `test/e177b-rollup.test.mjs` fixture with a voided task id that
  still has a `review_<id>.md` file on disk asserts that id is excluded from
  `evidenceIds`.

- **AC6** — Given a fan-out wave whose lanes each carry a DIFFERENT
  `active_feature` (this wave: e204/e180/e177a/e177b — the normal shape per
  the integrator SOP's 5c-4 roll-up step), when
  `node scripts/lane-status.mjs --lanes e204,e180,e177a,e177b` (or `--all`)
  runs, then it sums tickets/hop/review+qa rounds ACROSS those lanes
  regardless of each one's own `active_feature`, lists every named lane by
  its own feature id, and explicitly prints that the sum is cross-feature,
  that caps remain evaluated PER LANE (never a shared cap across differing
  features), and that the combined total is informational only — this is
  E177 (9)'s actual intent (a wave-level roll-up), not a scope add over the
  same-feature `--rollup` mode in AC4.
  proof: `test/e177b-rollup.test.mjs` fixture with 3 lanes on 3 distinct
  `active_feature` values asserts the cross-feature banner text and correct
  per-lane + combined-total numbers.

- **AC7** — Given two concurrent `npm test` invocations against worktrees
  that share one primary repo, when both run, then the second acquires the
  shared lock only after the first releases it — their full suites never
  execute concurrently.
  proof: `test/e177b-test-lock.test.mjs` spawns two child processes wrapping
  a timestamped dummy command via `scripts/test-lock.mjs` and asserts
  non-overlapping execution windows.

- **AC8** — Given lane worktrees that share one primary repo's `.git` (via
  `git rev-parse --git-common-dir`), when each lane's wrapped `npm test`
  runs, then all of them contend for the SAME lock file derived from that
  common dir — never a per-worktree lock (which would fail to serialize
  across lanes at all). (Integrator-confirmed 2026-09-27: this scope is OK.)
  proof: `test/e177b-test-lock.test.mjs` asserts the resolved lock path is
  identical from two different worktree-fixture cwds pointing at one common
  dir.

- **AC9** — Given a test run already holding the lock, when that same run's
  command spawns a NESTED `npm test` (directly, or a test that shells out to
  it), then the nested invocation detects the lock via an inherited
  environment variable and proceeds without re-acquiring — no self-deadlock.
  proof: `test/e177b-test-lock.test.mjs` runs `scripts/test-lock.mjs -- node
  scripts/test-lock.mjs -- true` in one process tree and asserts it returns
  immediately (bounded time), never blocking on itself.

- **AC10** — Given a lock file left behind by a DEAD process (its recorded
  pid no longer exists), when a new wrapped `npm test` requests the lock,
  then `scripts/test-lock.mjs`'s OWN O_EXCL acquire loop (`fs.openSync(path,
  "wx")`, same payload shape as `guards/file-lock.ts` — `{pid, acquiredAt}`
  plus `worktreePath` and `startedAt` — but a SEPARATE implementation, never
  `guards/file-lock.ts`'s `withFileLock`/`isLockPayloadStale`) reclaims the
  lock: staleness is decided ONLY by PID liveness (`process.kill(pid, 0)`),
  never by the lock's age. `guards/file-lock.ts` is unsuitable here (R1,
  integrator finding 2026-09-27): its `isLockPayloadStale` treats a lock
  older than 30s as stale even with a live holder — that would let a waiter
  steal a live multi-minute full-suite lock — and its `withFileLock` throws
  after a 10s max-wait instead of queueing, which a multi-minute `npm test`
  run cannot tolerate.
  proof: `test/e177b-test-lock.test.mjs` writes a lock payload with a
  non-existent pid and asserts the next acquisition reclaims it promptly.

- **AC11** (regression lock for AC10/R1) — Given a lock file whose recorded
  PID IS alive but whose `acquiredAt` is old (e.g. faked to ~1 hour ago —
  the test fakes the timestamp, it does not actually wait an hour), when a
  new `npm test` requests the lock, then it is NOT reclaimed — the lock is
  correctly treated as still held, proving staleness is decided by liveness
  alone, never by age.
  proof: `test/e177b-test-lock.test.mjs` fixture with a live pid (e.g. the
  test's own process) and an ancient `acquiredAt` asserts the waiter blocks
  (does not proceed) until that lock is released.

- **AC12** — Given a waiter queued behind a live lock, when it enters the
  wait, then it immediately prints `waiting for test lock held by pid <p>
  (<worktree>) since <t>` (using the payload's pid/worktreePath/startedAt),
  and repeats that same line every 30s while still waiting — because an
  agent's Bash tool call times out at 2-10 minutes, so a queued qa run must
  be able to tell "queued" from "hung" without extra tooling.
  proof: `test/e177b-test-lock.test.mjs` asserts the exact message format on
  first entering the wait and again after a simulated 30s tick.

- **AC13** — Given an optional `--max-wait <seconds>` flag, when the wait
  exceeds it, then `test-lock.mjs` exits with a distinct, non-zero exit code
  reserved for "lock timeout" (never the wrapped command's own failure exit
  code) and a message stating plainly that this was a lock-wait timeout, not
  a test failure. Omitting `--max-wait` waits indefinitely (today's default
  posture — queueing, never throwing, per R1).
  proof: `test/e177b-test-lock.test.mjs` holds the lock artificially and
  asserts a `--max-wait 1` invocation exits with the reserved code and a
  timeout-specific message within ~1s.

- **AC13a** (R2 fix — reclaim race closed for ≥3 concurrent waiters) — Given
  a lock file left by a dead holder and THREE OR MORE processes
  simultaneously requesting the lock, when they race to reclaim it, then
  exactly ONE waiter succeeds — the reclaim step itself is serialized (e.g.
  a second O_EXCL guard file around the rename-and-restore step) so no
  window exists in which two waiters can both believe they hold the lock.
  proof: `test/e177b-test-lock.test.mjs` spawns ≥3 processes racing to
  reclaim one dead-PID lock and asserts exactly one acquires it while the
  others correctly queue behind the winner — never two concurrent holders.

- **AC13b** (R4 fix — SIGKILLed wrapper does not orphan a live child) —
  Given a `test-lock.mjs` wrapper process that holds the lock and has
  spawned the wrapped command, when the wrapper itself is SIGKILLed (its own
  cleanup/signal handling never runs) while the wrapped child keeps
  running, then the lock is NOT reclaimed by a new waiter while that child
  is still alive — the lock payload records the child's pid alongside the
  wrapper's, and staleness is decided by "is EITHER pid alive", never the
  wrapper pid alone.
  proof: `test/e177b-test-lock.test.mjs` acquires the lock, SIGKILLs the
  wrapper process, confirms the wrapped child is still running, and asserts
  a new lock request does NOT reclaim the lock until that child also exits.

- **AC14** — Given a mailbox file with zero `--- msg` blocks, when
  `node scripts/mailbox-watch.mjs <file> --baseline 0` starts, then it prints
  `armed: baseline 0, current 0` and does not falsely fire — fixing the
  Wave 5.1 `grep -c ... || echo 0` defect (which printed `0\n0` and broke
  every subsequent integer comparison).
  proof: `test/e177b-mailbox-watch.test.mjs` asserts the exact startup line
  and no spurious event on an empty file.

- **AC15** — Given a watch armed at baseline N, when a new `--- msg` block is
  appended making the count N+1, then the watcher detects it within one poll
  interval: the lane-side single-file mode exits (0) naming the new count
  (suitable for Bash `run_in_background`), and the integrator's multi-file
  mode emits a change line naming which file changed.
  proof: `test/e177b-mailbox-watch.test.mjs` appends a block mid-watch in
  both modes and asserts detection + correct exit/notification shape.

- **AC16** — Given a single-file watch approaching its deadline with no new
  messages, when the deadline nears, then it prints `expiring — re-arm`
  followed by a ready-to-run re-arm command carrying `--baseline <N>`, where
  N is the last count THIS watch actually observed/read at that moment —
  never a count freshly re-sampled at re-arm time. This is load-bearing
  (coordinator clarification, 2026-09-27): a message arriving during the gap
  between this watch's expiry and the re-armed watch's start must not be
  treated as already-seen just because a fresh sample at re-arm time
  happened to already include it.
  proof: `test/e177b-mailbox-watch.test.mjs` simulates near-expiry, captures
  the printed baseline, appends a message in the expiry-to-rearm gap, starts
  the new watch with the printed `--baseline`, and asserts that gap message
  IS detected (not swallowed).

- **AC17** — Given a watch already running against file F, when a second
  `mailbox-watch.mjs` invocation targets the same F, then it refuses to start
  (non-zero exit, clear stated reason) instead of both processes waking on
  the same message.
  proof: `test/e177b-mailbox-watch.test.mjs` starts one watch in the
  background, then asserts a second invocation on the same file exits
  non-zero immediately.

- **AC18** — Given `node scripts/mailbox-watch.mjs <file> --send --from
  <lane|integrator> --type <t> --re <target> --body <text>`, when it appends
  a message block, then it auto-stamps `time` (computed in-process as UTC
  ISO-8601, never hand-typed), `re: <file>#n` (file-qualified, per
  `docs/lane-protocol.md` §5), `hop: <n>/<cap>` on the lane side (integrator
  writes `hop: —`), and auto-assigns `seq` as the file's last seq + 1.
  proof: `test/e177b-mailbox-watch.test.mjs` sends two messages and asserts
  seq increments, `time` parses as a valid UTC timestamp, and `re`/`hop`
  match the §5 block format exactly.

- **AC19** — Given the integrator wants to watch ALL lanes' `to-integrator.md`
  files at once, when `mailbox-watch.mjs` is invoked with multiple file
  arguments, then it monitors all of them and reports which specific file
  changed; given a lane wants to wait on its own single `to-lane.md`, when
  invoked with one file, then it exits on the first new message (the
  Bash `run_in_background`-friendly shape already used today).
  proof: `test/e177b-mailbox-watch.test.mjs` covers both a two-file watch
  (only one of which changes) and a single-file exit-on-first-message run.

- **AC20** (R4, multi-file expiring/deadline) — Given a MULTI-file watch
  approaching its deadline, when it nears, then the printed `expiring —
  re-arm` line carries EACH watched file's own last-read baseline, in a
  format directly usable to re-arm all of them (`--baseline
  e204=1,e180=0,...` — one `<lane-or-file-key>=<N>` pair per watched file,
  comma-separated); and the default deadline is fixed BELOW the Monitor
  tool's 30-minute expiry cap (29 minutes) so a watch always announces its
  own expiry before Monitor's, and is adjustable via a `--deadline
  <minutes>` flag (single-file mode uses the same flag/default).
  proof: `test/e177b-mailbox-watch.test.mjs` multi-file fixture with two
  files at different baselines asserts the printed `--baseline` string
  parses back into the correct per-file map, and that the default deadline
  constant is < 30 minutes.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| watch.armed | `armed: baseline {N}, current {N}` | docs/backlog.md E177 row (2026-09-25 mailbox paragraph) — "腳本啟動時先印一行 `armed: baseline N, current N`" |
| watch.expiring | `expiring — re-arm` | docs/backlog.md E177 row (2026-09-25 mailbox paragraph) — "到期前印 `expiring — re-arm` 這行" |
| watch.rearm-hint | `re-arm with: node scripts/mailbox-watch.mjs {file} --baseline {N}` (single-file) / `... --baseline {lane1}={N1},{lane2}={N2},...` (multi-file) | coordinator dispatch message, 2026-09-27 (AC16, AC20) — the printed re-arm command must carry the exact last-READ baseline(s), ready to run |
| lock.waiting | `waiting for test lock held by pid {p} ({worktree}) since {t}` | coordinator dispatch message, 2026-09-27 (AC12, R1) — printed immediately on entering the wait and every 30s while queued, so a Bash tool call (2-10 min timeout) can tell "queued" from "hung" |
| (other CLI output) | table headers, per-lane status lines, lock-timeout/refusal messages | authored-here — internal dev-tool console output, not specified verbatim by any ticket row; sr-engineer's own wording, kept short and unambiguous |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI/dev-tooling only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets (CLI/dev-tooling only) |

## Out of Scope
- Manifest parsing / rendering / fan-in ownership checks — E177a
  (`tools/fanout-manifest.ts`, `scripts/fanout.mjs`), parallel lane, disjoint
  files.
- Editing SOP or protocol prose (`docs/lane-protocol.md`,
  `.claude/commands/integrator.md`) — E178 will cite these tools by
  reference once it lands; this ticket ships the tools only.
- `agc feature start <lane>` reading the fan-out manifest — E177c, moved
  post-v4 (human decision D1, `specs/fanout-wave7.md`).
- Any change to `tools/lane-registry.ts` or `tools/feature-rollup.ts` —
  import only, never edit (lane boundary).
- Using `guards/file-lock.ts` (`withFileLock`/`isLockPayloadStale`) for the
  suite lock at all — R1 (integrator finding, 2026-09-27): its age-based
  staleness (30s) and 10s max-wait are the wrong shape for a multi-minute
  `npm test` run and would let a waiter steal a live lock. `test-lock.mjs`
  implements its own O_EXCL loop instead (AC10-AC13). `guards/file-lock.ts`
  itself is untouched — this ticket simply does not use it here.
- True OS/global lock scope (e.g. across unrelated repos on the same
  machine) — the lock is scoped to one repo's shared `git-common-dir`,
  which is the actual contention point for this wave's fan-out (all lanes
  are worktrees of one primary). A truly cross-repo machine lock is not
  needed by E182 and is not built. (Integrator-confirmed 2026-09-27: this
  scope decision is OK.)

## Dependencies / Prerequisites
- `tools/lane-registry.ts` (`laneRegistryList`, `getLaneRegistrySummary`) and
  `tools/feature-rollup.ts` (`computeFeatureRollup`, `localFallbackLaneList`,
  `LaneListProvider` type) — imported by `tools/lane-status.ts`, never
  modified. `scripts/lane-status.mjs` follows the same thin-shell-over-`dist/`
  pattern as `scripts/feature-rollup.mjs` (argv → `tools/lane-status.js`
  exports → console.log; zero script-level logic).
- `tools/transitions.ts` — cap comparisons use its REAL exported names only:
  `HOP_CAP_EXPORTED`, `ROUND_CAP_EXPORTED`, `REVIEW_ROUND_CAP_EXPORTED`
  (`:706-711`) — never a hardcoded cap number, and never the internal
  unexported `ROUND_CAP`/`REVIEW_ROUND_CAP` names.
- `tools/evidence-file.ts` (`buildCoverageIndex`, `parseCoversIds`) reused
  for the evidence cross-check's `covers:` fallback — imported, not
  modified.
- `scripts/test-lock.mjs` does NOT import `guards/file-lock.ts` (R1 — see
  Out of Scope). It implements its own O_EXCL acquire loop
  (`fs.openSync(path, "wx")`), payload `{pid, acquiredAt, worktreePath,
  startedAt}`, staleness decided by PID liveness only
  (`process.kill(pid, 0)`), never by age. macOS has no `flock` (confirmed in
  `specs/fanout-wave7.md` "派工前核對"); do not shell out to `flock` either.
  **R4/AC13b amendment**: the payload additionally carries `childPid` (the
  wrapped command's own pid, recorded once the child is spawned) — liveness
  is then "wrapper pid alive OR childPid alive", so a SIGKILLed wrapper with
  a still-running child is never treated as a dead holder. **R2/AC13a
  amendment**: the reclaim step (rename-aside + verify + `linkSync` restore
  on mismatch) is itself serialized behind a second O_EXCL guard file (e.g.
  `<lock>.reclaim`) so a third simultaneous waiter cannot open the lock path
  in the brief window between another waiter's rename and its restore.
- `package.json`: only the `scripts.test` line changes, to wrap the existing
  `node --test test/*.test.mjs` command through `scripts/test-lock.mjs`.
  `pretest` (`npm run build`) is untouched and still runs first.
- `docs/lane-protocol.md` §5 (mailbox message block format: `seq` / `from` /
  `type` / `re` / `time` / `hop`) is the format `mailbox-watch.mjs --send`
  must reproduce exactly — read, never edited (owned by a different lane /
  ticket).
- Lane list source is `git worktree list` + `tools/lane-registry.ts` only —
  explicitly NOT any fan-out manifest, so this ticket has zero dependency on
  E177a and can run fully in parallel with it (per `specs/fanout-wave7.md`'s
  e177b row).
- No `design/<feature>.md` exists for this feature (non-visual, dev-tooling
  ticket) — the Scope Decision Gate and Visual Structural Assertions section
  are not triggered; `scope_decision: single-feature` is recorded directly.
- **`tools/lane-paths.ts` reuse (R1 amendment, code-review round 1,
  2026-09-27)**: `tools/lane-status.ts` imports `resolveLaneName` (mapping
  its `LEGACY_LANE` sentinel to `null`) and, where feasible, the branch-token
  parsing it already exposes — from `tools/lane-paths.ts` — for the ticket
  token used by AC5/AC5a/AC5c. It never restates `TICKET_ID_RE` or any
  equivalent regex locally; that is the e73 (`bin/agc-init.mjs`) / e126
  (`tools/merge-invariants.ts`) precedent: import-only reuse of the
  already-exported resolver, never a byte-copied pattern that silently
  drifts when `TICKET_ID_RE` is widened (as happened in e123b0 AC3 /
  e123b8 J1). `isSafeArchiveSegment`/equivalent path-segment guards may stay
  local if lane-paths' own guard disallows something this ticket needs
  (e.g. dot-named archive dirs).
  **Ownership extension (pending human approval, integrator-authorized)**:
  this reuse turns the `test/lane-paths.test.mjs` CALLERS2 importer
  allow-list red on purpose. e177b's qa-engineer may edit
  `test/lane-paths.test.mjs` ONLY to (a) add one `"tools/lane-status.ts"`
  entry plus a justification comment to `SANCTIONED_LANE_PATHS_IMPORTERS`,
  in the same format as the existing lane-registry/gate-stats/agc-init
  entries, and (b) record the resulting expected-red in
  `qa_reports/expected-red_e177b-lane-status-tooling.txt` — nothing else in
  that file changes. This is a scoped, one-line exception to this ticket's
  own "import only, never edit" boundary for files outside its ownership,
  authorized specifically because `test/lane-paths.test.mjs` is shared
  qa-owned test code with no other legitimate route to add a new sanctioned
  importer.
- **Task id note (integrator R1/R3/R4 amendment, 2026-09-27)**: the original
  cut (`T-E177B-01/02/03`) was voided and re-cut as `T-E177B-05` (lane-status
  + roll-up, AC1-6), `T-E177B-04` (test lock, AC7-13), `T-E177B-06` (mailbox
  watcher, AC14-20) — the file/AC scope per task is otherwise unchanged from
  the original three-way split; only ids and AC ranges moved.
