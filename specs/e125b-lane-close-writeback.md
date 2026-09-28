# e125b-lane-close-writeback

## Problem Statement
`agc feature finish --shipped` today removes a merged lane's worktree and deletes its
branch, but it never does anything with the lane's own governance history
(`.current/<lane>/` — handoff, telemetry, metrics, dispatch, pending-tickets, tasks
ledger), and it leaves no durable pointer from the outer index back to where that
history went. Two related gaps compound this: (1) `tools/lane-registry.ts`'s
`getLaneFeatureHistory` reconstructs a lane's feature history from a single live
snapshot (`.current/<lane>/handoff.md`) plus whatever sits in `.current/history/`
today (nothing) — so a long-lived lane such as `_primary`, which changes
`active_feature` **in place** across many features without ever "closing," silently
loses every earlier feature the moment the next write overwrites `active_feature`
(J2-NEW-4); (2) `agc check`'s orphan-lane advisory (E179 AC5) needs a settled answer
on whether it must also scan `.current/history/` once lanes start moving there (S1) —
today it deliberately does not, and that needs to be either confirmed or changed
before the mechanism ships. This ticket (E125b, Wave 6.1b, `specs/fanout-wave6.md`)
builds the **mechanism**: the lane-close move + index writeback, the `_primary`
featureHistory fix, and a settled S1 answer. E125c (SOP prose extending release SOP
7a, and `tasks.md` compaction) and E126 (post-merge invariant checks) are separate,
later lanes — this ticket does not touch `content/**` or write any SOP prose.

## User Stories
- As the integrator running `agc feature finish <ticket> --shipped`, I want the
  lane's `.current/<lane>/` governance history moved into a dated history bucket and
  a durable pointer left in the outer index, so that the lane's audit trail survives
  worktree removal and is findable later without guessing.
- As a PM/coordinator reading `tw_get_state`'s `featureHistory` advisory for a
  long-lived lane (e.g. `_primary`), I want it to include features that were shipped
  and superseded in place, not just the current `active_feature`, so a feature-close
  roll-up is not silently missing prior work (E113's Feature-close roll-up
  obligation).
- As an operator running `agc check`, I want the orphan-lane advisory to give a
  correct answer about closed lanes without either false-flagging them or silently
  never covering a real gap.

## Acceptance Criteria

- **AC1** — Given a shipped, merged lane branch `feat/<ticket>-*` whose
  `.current/<ticket>/` directory is tracked and present on `--base` (merged in),
  when `agc feature finish <ticket> --shipped` runs, then `.current/<ticket>/` no
  longer exists at its old path in the primary checkout and
  `.current/history/<YYYY-MM>/<ticket>/` exists instead, holding the same files,
  committed on `base` in the same commit (or an adjacent commit) as the pending-
  ticket application already performed by `applyPendingOnShipped`. `<YYYY-MM>` is
  the UTC year-month at finish time.
  proof: `node --test test/agc-feature-finish-history.test.mjs`

- **AC2** — Given AC1's run, when root `tasks.md` is read afterward, then it
  contains exactly one new line, appended under a `## Closed Lanes` section (created
  if absent), matching the pointer format in Copy / Strings below — primary key
  `ticket` + `branch`; `base_sha` present with its invalidation caveat; `pr` present
  as `none` when the workspace has no PR concept — and that line is a single HTML
  comment, **never** a markdown checkbox (`- [ ]` / `- [x]`) row (X3). `base_sha`
  and `pr` are sourced exactly as AC11 (REQUIRED-2) and AC12 (REQUIRED-3) below
  define — this AC governs the line's shape; those two govern its two variable
  fields' provenance.
  proof: `grep -F "lane_closed: ticket=" tasks.md` after the fixture run in
  `test/agc-feature-finish-history.test.mjs` matches exactly one line for the ticket
  under test, and `grep -c "^- \[ \]\|^- \[x\]" <that line>` is 0.

- **AC3** — Given a lane whose root `tasks.md` already carries an e125a
  `tasks_moved` feat-marker line for that lane (a lane with pre-e125a legacy rows
  that were forward-migrated into its ledger), when `agc feature finish --shipped`
  closes it, then the stale feat-marker line is removed and the lane has exactly one
  authoritative pointer left in `tasks.md`: the new Closed Lanes row from AC2 (X3 —
  the feat marker's target, `.current/<lane>/tasks.md`, no longer exists once the
  lane closes, so leaving it in place would dangle).
  proof: `test/agc-feature-finish-history.test.mjs` fixture case
  "replaces a pre-existing feat marker"

- **AC4** — Given `agc check`'s orphan-lane advisory (`checkOrphanLanes`,
  `bin/agc-init.mjs` ~:827) after a lane has been closed per AC1, when the scan
  runs, then it does not read `.current/history/` at all, and it does not flag the
  closed lane — because `--shipped` also deletes the branch (existing behavior,
  unchanged), so a closed lane is never a candidate in the first place (candidates
  are drawn from `refs/heads/`). S1 is resolved as: **no**, the orphan scan does not
  need to scan `history/`, because nothing reachable through history/ can ever have
  a live branch ref pointing at it under this mechanism — not a relaxation of the
  completion definition, a structural non-applicability. The existing "Never
  `.current/history/` (S1, E125)" code comment is updated to record this as decided
  by E125b, with the rationale above, rather than pending.
  proof: `test/agc-orphan-lanes.test.mjs` (extend) — asserts a closed lane produces
  no warning and that `checkOrphanLanes` never `readdir`s `.current/history/`.

- **AC5** — Given a long-lived lane (e.g. `_primary`) whose `active_feature`
  changes in place across two `tw_update_state` writes, with an intervening
  release-engineer shipped close for the first feature (so
  `.current/_primary/metrics.jsonl` gains one `{feature, ts, ...}` row for it per
  the existing `emitFeatureMetrics` call site), when
  `tools/lane-registry.ts`'s `getLaneFeatureHistory` runs, then its returned
  `featureHistory` includes **both** the first feature (recovered from
  `metrics.jsonl`) and the current feature (from `handoff.md`), ordered by
  timestamp — closing the J2-NEW-4 gap for a lane that never "closes" into history.
  Documented limitation (stated in the module's header comment, not silently
  dropped): a feature that was **abandoned** (never reached a release-engineer
  shipped close) and then overwritten in place by a later `active_feature` remains
  unrecoverable — `metrics.jsonl` only records shipped closes, matching this
  module's existing degrade-honestly posture (never claim data that was not durably
  recorded).
  proof: `test/lane-registry-feature-history.test.mjs` (extend) — case "in-place
  active_feature change preserves a shipped predecessor via metrics.jsonl"

- **AC6** — Given `resolveHistoryLaneDir(workspacePath, bucket, lane)` (new,
  `tools/lane-paths.ts`) called with a malformed bucket (e.g. `"2026"`, no day-less
  `YYYY-MM` match) or an unsafe lane name (e.g. `"../x"`), when called, then it
  throws — it never silently returns a path outside `.current/history/<bucket>/`.
  proof: unit test in `test/lane-paths-history.test.mjs` (new)

- **AC8** — (X7, ownership extended by integrator pre-review 2026-09-25) Given
  `_primary`'s ledger (`.current/_primary/tasks.md`) carrying a stale `## <lane>-...`
  section for a lane `L` whose ledger has since closed to
  `.current/history/<bucket>/L/tasks.md` (AC1), when any `tw_*` task reader
  (`tw_get_next_task`, `tw_detect_drift`, `tw_sync`, `listTasks`) runs against
  `_primary`, then that section is excluded exactly as a live-lane section already is
  (D12/AC14(a)) — hidden from every read. When `tw_add_task` targets that section in
  `_primary`, then it is refused exactly as a live-foreign-lane target already is (no
  new refusal message needed — it is the SAME `isPrimaryLedger(...) &&
  makeForeignCheck(...)` check at `tools/tasks-file.ts:779-781`, now foreign for one
  more reason). Mechanism: `tools/lane-paths.ts` gains `hasHistoryLedger(workspacePath,
  lane, filename)` (new, pure fs, scans every `HISTORY_BUCKET_RE` bucket under
  `.current/history/` for `<bucket>/<lane>/<filename>`, never throws — same
  degrade-honestly posture as `enumerateLaneSidecarSources`). `makeForeignCheck` in
  `tools/tasks-file.ts` (call-site-only edit, no other change to that function or file)
  ORs its existing live-ledger `fs.existsSync` check with
  `hasHistoryLedger(workspacePath, lane, filename)`, where `workspacePath =
  path.dirname(path.dirname(path.dirname(primaryTasksPath)))` (i.e.
  `path.dirname(lanesDir)`, `lanesDir` already being `path.dirname(path.dirname(...))`
  in that function today) and `filename = path.basename(primaryTasksPath)`.
  proof: `test/tasks-file-foreign-check.test.mjs` (new, or an extension of the nearest
  e125a D12 fixture test) — case "a `_primary` section for a closed (history-bucket)
  lane is hidden on read and refused on add"

- **AC9** — (REQUIRED-1, gitignored `.current/` adopter shape — decision: **fs-copy
  harvest**, not loud refusal). Given a lane whose `.current/<ticket>/` was NEVER
  tracked in git (the adopter's `.gitignore` covers it — e125a's "ignored lane path"
  shape, `specs/e125a-lane-local-ledgers.md` D-C/AC4b — so after merge there is
  nothing at `.current/<ticket>/` in the primary checkout for `git mv` to move; the
  lane's only copy is the real, untracked directory still sitting in the lane's own
  worktree), when `agc feature finish <ticket> --shipped` runs, then: the run detects
  this shape via `hasTrackedContent(repoRoot, ".current/<ticketId>")` (existing
  helper, `bin/agc-init.mjs`, already used by `checkWorktreeEvidence` — reused
  verbatim, no new tracked-vs-untracked predicate is written) returning `false`; if
  `<lanePath>/.current/<ticketId>/` exists on disk, its contents are recursively
  copied (plain `fs`, e.g. `fs.cpSync(src, dst, { recursive: true })`) into
  `<repoRoot>/.current/history/<bucket>/<ticketId>/` (via T-E125B-01's
  `resolveHistoryLaneDir`) BEFORE `removeWorktreeNoForce` runs; the copy is untracked
  and NOT committed (committing it would violate the adopter's own gitignore intent,
  and `git add` on an ignored path silently no-ops or requires `-f`, which this ticket
  never uses); an advisory line is printed (Copy / Strings
  `e125b.harvest-advisory-line`) naming the fs-copy path taken. The `## Closed Lanes`
  pointer line (AC2) is still appended and still committed on `base` — it is
  `tasks.md`-only content, independent of whether the evidence itself is tracked. If
  `<lanePath>/.current/<ticketId>/` does not exist either (a lane that made zero
  governance writes), nothing is copied and nothing is treated as an error — there is
  genuinely nothing to lose.
  **Re-run note (code-review round 1, R1/R2):** a re-run whose pointer is already
  committed (`alreadyClosed` — typically after `git worktree remove` refused on the first
  run) does not redo the close, but it re-harvests: every git-ignored file under the
  lane's `.current/<ticket>/` (the only files `git worktree remove` deletes without
  refusing; `base-sha` excepted, it is durable in the pointer) whose copy under the
  pointer's `history=` dir is missing or differs is copied over it before the worktree is
  removed (Copy / Strings `e125b.harvest-refresh-line`); if that `history=` field does not
  resolve, the run refuses and removes nothing. A harvest copy that fails part-way is
  rolled back including the history dir itself (the plan asserted it absent), so the
  "re-running finish is safe" message holds.
  proof: `test/agc-feature-finish-history.test.mjs` fixture case "gitignored
  `.current/` — untracked lane state is fs-copy harvested before worktree removal,
  never committed"

- **AC10** — (REQUIRED-1, the AC4b root-ledger shape). Given a workspace whose
  `.gitignore` covers `.current/` (or at least the lane path — e125a AC4b), so root
  `tasks.md` is the LIVE ledger `tw_*` itself reads and writes (never an index), when
  `agc feature finish --shipped` appends this ticket's `## Closed Lanes` section and a
  `lane_closed:` pointer comment line to that same root file (AC2), then every `tw_*`
  task reader still reports the correct task count and the `## Closed Lanes` section
  contributes exactly zero tasks: `resolveLaneName("Closed Lanes")` has no leading
  `[a-z]+\d[a-z0-9]*` token and returns `LEGACY_LANE` (not a foreign lane, and not
  excluded — its lines are simply never checkbox-shaped), and an HTML comment line
  never matches `parseTaskLine`'s checkbox regex, so it is silently skipped like any
  other prose line. No production code change is required for this AC beyond AC1/AC2's
  own writer — it is a proof obligation confirming existing `tools/tasks-file.ts`
  parse behavior holds in this specific adopter shape, not a new predicate.
  proof: `test/agc-feature-finish-history.test.mjs` or
  `test/e125a-lane-local-ledgers.test.mjs` fixture case "root tasks.md as live ledger
  (AC4b shape): a `## Closed Lanes` pointer line parses as zero tasks"

- **AC11** — (REQUIRED-2, `base_sha`). **RESOLVED 2026-09-25 per integrator blocker
  (to-lane#2), option (a).** `agc feature start` records the fork-point commit it
  already resolves (`resolveBaseCommit(repoRoot, base, "start")`, computed today, just
  never persisted) to a new file `.current/<ticket>/base-sha` (plain text, the
  40-hex-char sha and nothing else) in the NEW lane worktree. `base-sha` is a NEW
  `LANE_FILES` entry in `tools/lane-paths.ts` (owned): `{ key: "baseSha", filename:
  "base-sha", required: false }` — no `noFlatCounterpart`. This corrects the prior
  draft, which kept it OUT of `LANE_FILES` on a false analogy to
  `.current/tasks-index-receipt.json`; that file sits at the `.current/` TOP LEVEL
  (outside every lane dir), so `migrateLaneToFlatLocked`'s lane-dir scan never sees it
  — it was never a comparable case. A file that lives INSIDE `.current/<lane>/` and is
  NOT a `LANE_FILES` entry is exactly what `migrateLaneToFlatLocked` (`tools/lane-
  migrate.ts:540-553`) refuses on: it builds `known` from `MOVABLE_LANE_FILES`
  (`LANE_FILES` minus any `noFlatCounterpart` entry) and throws
  `lane-migrate (lane->flat): ... holds non-lane entries (...)` on anything else, so
  every lane started after this ticket shipped would have become permanently
  irreversible (the Wave 5.1 trap the plan already names: "LANE_FILES 登記必須先於任何
  寫出 pending-tickets.md 的程式碼"). `noFlatCounterpart` is the WRONG flag here too:
  it exists for an entry whose flat<->lane transition is owned by a DIFFERENT
  migration module (`tasks.md`'s is `tools/tasks-lane-migrate.ts`) — `MOVABLE_LANE_FILES`
  filters such entries OUT of the E123 runners entirely, which for `base-sha` (no other
  migration path exists or ever will) would leave it foreign forever, reproducing the
  exact blocker. `required: false` and a non-`.jsonl` filename instead mirror
  `pendingTickets`'s existing entry exactly: `isAppendLog` (`tools/lane-migrate.ts`) is
  false for it, so both directions treat it as required-shaped-when-present (absent at
  destination -> rename; identical bytes at both ends -> drop, the resume case;
  different bytes -> refuse, never merged) — the same discipline `pendingTickets`
  already gets (e179 AC10, DR-10). The registration adds `baseShaPath: string` to
  `LanePaths` and a `baseSha: "baseShaPath"` row to `LANE_PATH_FIELD` (both compiler-
  enforced by the existing `Record<LaneFileKey, keyof LanePaths>` total map — omitting
  either is a build error). The prior draft's standalone `BASE_SHA_FILENAME`/
  `resolveBaseShaPath` composer is DROPPED: every consumer instead calls
  `resolveLanePaths(ws, lane).baseShaPath` (or `resolveCurrentLanePaths` for the live
  lane) — the same generic, registry-derived path every other lane file already goes
  through (the module's own "ONE owner of the filename set" discipline).
  `enumerateLaneSidecarSources`'s content-dedup and `tw_gate_stats`' sidecar
  aggregation need no change to skip it: every call site
  (`tools/gate-stats.ts:306,383`, `tools/usage-accounting.ts:77`,
  `tools/metrics.ts:84`) passes an explicit, hardcoded key (`"telemetry"`,
  `"metrics"`, `"usage"`, `"tasks"`) — there is no generic "iterate every
  `LANE_FILES` key" call site anywhere, so `"baseSha"` is simply never one of the keys
  asked for, by construction, not by a new exclusion check.

  **Grep survey (integrator ask): every place that strictly enumerates a lane dir's
  entries and refuses on an unrecognized one.** Only ONE such place exists in the
  codebase, and it is the blocker above: `migrateLaneToFlatLocked`
  (`tools/lane-migrate.ts:540-553`), fixed by this AC's `LANE_FILES` registration.
  Every other lane-dir reader was checked and reads by EXPLICIT filename or pattern,
  silently ignoring anything else (never refuses on an unknown entry), so `base-sha`
  passes through unnoticed either way: `tools/lane-registry.ts`'s
  `getLaneFeatureHistory` (lists lane subdirectory NAMES, then checks only for
  `handoff.md` / `metrics.jsonl` by literal name); `tools/handoff-parse.ts`'s
  `assertNoHandoffLayoutConflict` (`HANDOFF_LAYOUT_CONFLICT` — checks only
  `handoff.md` existence at the flat and lane paths, nothing else); `bin/agc-init.mjs`'s
  `checkOrphanLanes` (reads only `pending-tickets.md` by literal name) and
  `checkWorktreeEvidence`/`planAbandonEvidence` (operate on `qa_reports`/
  `review_reports`/`specs`, never on `.current/<lane>/` at all); `tools/evidence-
  file.ts`'s `buildCoverageIndex` and `tools/evidence-lookup.ts`'s `safeReaddir`
  (filter by `.md` extension / evidence-dir scope, unrelated to `.current/<lane>/`);
  `bin/agent-governance-usage-hook.mjs` (filters by an `agent-*.jsonl` regex).

  At `agc feature finish --shipped`, before the worktree is removed, the pointer
  line's `base_sha=` field is read via `resolveLanePaths(lanePath,
  ticketId).baseShaPath`: the file's content when present, else the literal token
  `unknown` (a lane started before this ticket shipped never wrote the file — the
  field is never omitted, see the Copy / Strings note). Given a lane whose base
  advanced with new commits AFTER the lane forked (so `merge-base(branch, base)` at
  finish time equals the branch tip, not the original fork point — the exact drift
  the integrator flagged), the recorded `base_sha` equals the commit `agc feature
  start` resolved at creation time, which is provably NOT equal to
  `git rev-parse <branch>` (the tip) nor to `git merge-base <branch> <base>` at
  finish time in that scenario.
  proof: `test/agc-feature-finish-history.test.mjs` (start+finish round trip) — case
  "base_sha in the pointer line is the fork point, not the branch tip, when base
  advanced after start" — and a second case "lane started before this ticket:
  base_sha=unknown"; PLUS (the integrator's required proof) a new case in
  `test/lane-migrate.test.mjs` (or the nearest `LANE_FILES` round-trip fixture) —
  "a lane dir containing `base-sha` reverse-migrates (`migrateLaneToFlat`) to flat
  `.current/` without refusing, and round-trips forward again unchanged"
  **Implementation note (deviation, recorded 2026-09-25 per the code-review round 1
  report):** `base-sha` is worktree-local — kept out of git by the shared
  `info/exclude` rule `/.current/**/base-sha` (`LANE_EXCLUDE_RULES`, written by every
  `agc feature start`) and never committed, so `git worktree remove` (never `--force`)
  and the clean-status preconditions never trip on it. Consequence: in the tracked
  shape (AC1) the moved `.current/history/<bucket>/<lane>/` holds no `base-sha`, and the
  pointer line's `base_sha=` field is its only durable record; in the gitignored shape
  (AC9) the harvested copy also contains it.

- **AC12** — (REQUIRED-3, `pr`). `agc feature finish` gains an optional `--pr <n>`
  flag (added to the existing finish `parseFeatureArgs` value-flag list alongside
  `--base`; `<n>` must match `/^\d+$/`, else `usageError` — same discipline as every
  other `parseFeatureArgs` value flag). When `--pr` is given, the pointer line's `pr=`
  field is the given `<n>`; when omitted (the default), it is the literal `none`. The
  server never queries a PR host (no network call is added anywhere in this ticket) —
  `--pr` is purely operator-supplied.
  proof: `test/agc-feature-finish-history.test.mjs` fixture cases "--pr 42 → pr=42"
  and "no --pr → pr=none"

- **AC13** — Given the full test suite plus `npm run build` on this branch, when
  `npm test` runs, then all tests pass, and `git diff --stat main...HEAD -- content/
  test/fixtures/compose-golden/ test/context-budget.test.mjs schema/ docs/` is empty
  (this ticket owns no content/schema/docs lane — §2.1/§2.2 of
  `docs/v4.0.0-execution-plan.md`).
  proof: `npm test` (target: same pass count as base plus this ticket's new tests,
  zero regressions) and the `git diff --stat` command above

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e125b.closed-lane-pointer-line | `<!-- lane_closed: ticket=<ticketId> branch=<branch> base_sha=<sha\|unknown> pr=<n\|none> history=.current/history/<bucket>/<lane>/ closed_at=<ISO8601> (base_sha invalidated by a history rewrite; git log --grep <ticketId> is the universal fallback) -->` | authored-here — new pointer convention implementing D2 (`specs/fanout-wave6.md`, human decision 2026-09-25: primary key = ticket id + branch, `pr` optional, `base_sha` auxiliary and documented as invalidated by history rewrite, `git log --grep <ticket>` the universal fallback). Mirrors the existing HTML-comment marker convention already used by `TASKS_INDEX_NOTICE` and `featMarker()` in `tools/tasks-lane-migrate.ts` (e125a) — one line, grep-able, machine-composed by a single function, never hand-typed. `base_sha=unknown` is the REQUIRED-2 fallback for a lane started before this ticket shipped (see AC11); the field is always present (fixed line shape, never conditionally omitted) so a single regex always finds it. |
| e125b.closed-lanes-section-heading | `## Closed Lanes` | authored-here — new index section `agc feature finish --shipped` appends to (creates if absent) in root `tasks.md`; deliberately a `##` heading with comment-only rows underneath, never a checkbox task row (X3), so `tools/tasks-file.ts`'s task-row parser (owned by e125a; this ticket's ownership is now extended by one targeted call-site edit — see Dependencies / Prerequisites) never mistakes a closed-lane pointer for a task. |
| e125b.orphan-scan-comment-update | (code comment only, not user-facing) — updates the existing `bin/agc-init.mjs` comment above `checkOrphanLanes` from "Never `.current/history/` (S1, E125)" to state the AC4 rationale as decided | authored-here |
| e125b.harvest-advisory-line | `agc feature finish — harvested untracked .current/<ticketId>/ into .current/history/<bucket>/<ticketId>/ (fs copy, not committed — <reason>; if your .gitignore does not also cover .current/history/, this copy will show up as untracked in \`git status\` here)\n` (stdout), where `<reason>` is `the source path is git-ignored in this workspace` when `git check-ignore` reports `.current/<ticketId>` ignored in the primary checkout, else `this lane never committed .current/<ticketId>/, so there was nothing on <base> to git mv` (code-review round 1, non-blocking wording fix) | authored-here — REQUIRED-1 advisory printed by the gitignored-`.current/` harvest branch (AC9), so the operator sees that this closure took the fs-copy path instead of `git mv`, why nothing was committed, AND (integrator pre-review, to-lane#2, non-blocking fold-in) why primary's working tree may now look dirty when the adopter's `.gitignore` covers only the lane path and not `.current/history/` too. |
| e125b.harvest-refresh-line | `agc feature finish — lane <ticketId> was already closed, but <n> git-ignored file(s) under .current/<ticketId>/ changed since its history copy; re-harvested into .current/history/<bucket>/<ticketId>/ before removing the worktree:\n` followed by one `  <path>\n` line per re-harvested file (stdout) | authored-here — code-review round 1 R1 fix: printed by the `alreadyClosed` re-run when it re-harvests lane state that changed after the first run's harvest (AC9 re-run note), so the refresh is never silent. |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI/server plumbing only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Release SOP 7a prose, declaring the outer files as history indexes in prose,
  compacting `tasks.md` — all **E125c**.
- Moving `qa_reports/`/`review_reports/` evidence directories into per-lane
  directories — explicitly prohibited for all of E125 (E168, post-v4).
- Compacting `docs/backlog.md` — out of v4 entirely (D3).
- **X2** (`agc init` scaffolding `.current/_primary/tasks.md` directly at init
  time instead of via the existing lazy forward-migration-on-first-write path) —
  marked optional in `specs/fanout-wave6.md`; recommendation is **out** of this cut
  (see the cut draft's decision table for rationale). Not implemented here.
- ~~X7 not implemented~~ **SUPERSEDED 2026-09-25 (integrator pre-review, to-lane#1):**
  X7 was assigned to e125b in the `specs/fanout-wave6.md` manifest (row `e125b`, cut
  input (X7)); leaving `tools/tasks-file.ts` off the owned-files list was the
  manifest's gap, not a scope grab. X7 is now **in scope** — see AC8 (impl:
  `tools/lane-paths.ts`'s `hasHistoryLedger`, T-E125B-01; call-site-only edit of
  `makeForeignCheck`, T-E125B-05). Ownership of `tools/tasks-file.ts` is extended for
  this ONE targeted call-site edit only — no other change to that file. No concurrent
  lane owns it (serial wave; e125c/e126 forbid `tools/**`).
- **REQUIRED-4 / `--abandoned` (integrator pre-review, to-lane#1) — kept OUT**, for
  hop budget (integrator's own recommendation). This ticket adds no `--abandoned`
  handling of `.current/<lane>/` at all. What happens **today** (unchanged by this
  ticket) to an abandoned lane's `.current/<lane>/`: `agc feature finish --abandoned`
  moves only `qa_reports/`/`review_reports/` evidence into `abandoned/` and always
  **keeps the branch** (so a git-*tracked* `.current/<lane>/` survives on that kept
  branch's own history even after the worktree is removed), but never touches
  `.current/<lane>/` itself — so in a workspace where `.current/` is git-ignored
  (REQUIRED-1's adopter shape), an abandoned lane's untracked `.current/<lane>/` is
  deleted for good by `removeWorktreeNoForce`, with no harvest and no warning. Filed
  as a lane-local pending-ticket (`E125b-NEW-2`, `.current/e125b/pending-tickets.md`)
  for future consideration; not built here.
- Post-merge invariant checks (any parent's ticket rows still present, `[x]`
  preserved, sidecar counts) — **E126**.
- Any `content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`,
  or `schema/**` change. No schema bump is needed for this ticket: the pointer line
  and `## Closed Lanes` section are new content inside `tasks.md`, which is
  explicitly **not** read or written by any `tw_*`/schema-versioned path any more
  (it is an index only `agc-init.mjs` touches directly via `fs`/`git`, per e125a's
  `TASKS_INDEX_NOTICE`) — so nothing here changes a parsed/migrated file format.

## Owned Files (this ticket)
`bin/agc-init.mjs`, `tools/lane-registry.ts`, `tools/feature-rollup.ts`,
`tools/lane-ticket-allocation.ts`, `tools/lane-paths.ts` (history + base-sha
resolvers), `dist/**`, this spec, its evidence, `.current/e125b/`, its tests — per
`specs/fanout-wave6.md`'s manifest row for `e125b`. **Extended 2026-09-25** (X7,
integrator pre-review) to also cover ONE targeted call site in
`tools/tasks-file.ts` — `makeForeignCheck` only, no other change to that file; the
rest of `tools/tasks-file.ts` remains e125a-owned.

## Dependencies / Prerequisites
- Base: `f174d89` (post e125a merge to `main`). e125a shipped 2026-09-25:
  `LANE_FILES` gained `tasks`, `_primary` read-time ownership filter (D12/AC14),
  `.current/history/` already recognized as a `NON_LANE_DIRS` entry and already
  read by `tools/lane-paths.ts`'s `enumerateLaneSidecarSources` and
  `tools/lane-registry.ts`'s `getLaneFeatureHistory` — this ticket is the first to
  ever **write** into `.current/history/`.
- `npm run build` must run (and `dist/**` be committed) after every `tools/*.ts` /
  `bin/agc-init.mjs` change — `bin/agc-init.mjs` is plain JS and runs directly, but
  it imports compiled output from `dist/tools/lane-paths.js`.
- **X7 ownership question — RESOLVED 2026-09-25** (integrator pre-review, to-lane#1,
  option (a)): e125b's ownership is extended for the one targeted
  `tools/tasks-file.ts` call-site edit; see Owned Files and AC8. No task in this
  ticket touches any other part of that file.
- **X2 recommendation (out, not blocking):** filed as a lane-local pending-ticket
  (`E125b-NEW-1`, `.current/e125b/pending-tickets.md`, low priority) rather than
  implemented here — the lazy forward-migration-on-first-write path
  (`ensureTasksMigrated`) already produces the identical end state on first
  `tw_add_task`, so this is a minor first-touch ergonomics gain, not a defect, and
  doing it well risks touching `schema/**` seeding parity with
  `migratePrimaryForward`'s exact byte shape.
- **REQUIRED-1 decision (gitignored `.current/`) — fs-copy harvest, not loud
  refusal:** chosen because a loud refusal would make `--shipped` unusable for the
  entire adopter class e125a's AC4b already accommodates (gitignored `.current/`),
  turning a routine close into a stuck lane; the harvested copy is strictly better
  than today's silent deletion (E180's shape) even though it is untracked, and the
  advisory line makes the untracked/uncommitted nature visible rather than
  surprising. See AC9/AC10.
- **REQUIRED-2 (`base_sha`)** touches `agc feature start` in addition to `agc
  feature finish` — `runFeatureStart` (not previously listed as changing in this
  ticket) now also writes `.current/<ticket>/base-sha` (T-E125B-07), and
  `tools/lane-paths.ts` gains a `base-sha` `LANE_FILES` entry (T-E125B-01, must land
  first) per the integrator's blocker on the prior draft — see AC11 for the full
  fix, the corrected `tasks-index-receipt.json` analogy, and the lane-dir-enumeration
  grep survey. REQUIRED-3 (`pr`) touches `agc feature finish` only (the `--pr` flag, folded into
  T-E125B-02 alongside the rest of the finish-time pointer-line composition — no
  separate task). See AC11/AC12.
