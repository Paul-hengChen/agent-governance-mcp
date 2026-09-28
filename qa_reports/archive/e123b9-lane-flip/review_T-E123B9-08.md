# Review — T-E123B9-08 (QA, batched round)

covers: T-E123B9-06, T-E123B9-07, T-E123B9-08

## Verdict — PASS — by qa-engineer

specs/e123b9-lane-flip.md "## Amendment 2026-09-24" (AC16-AC20) verified,
plus this task's own AC21 (durable interrupted-migration-then-read/write
coverage, including a REAL process-death case). code-reviewer APPROVED the
sr-engineer diff (`review_reports/review_T-E123B9-06.md`, `git diff 7dc9d0d
-- tools/`) with one non-blocking `recommended` finding, already filed as
NEW-TICKETS.md J2-NEW-12 by code-reviewer (T-E123B9-07); this round
independently reproduces it with a REAL process death per the dispatch
brief's instruction, rather than fixing it (the reviewer's finding is a
documented AC12 fallback, not a defect). `npm run build` clean, full suite
**2390/2390 green** (up from the prior round's 2371 — this round adds 19 net
new test entries in `test/e123b9-lane-flip.test.mjs`, 0 removed), zero
expected-red exemptions, `npm audit --audit-level=high` exit 0 (6 pre-existing
moderate/low advisories in dev-only transitive deps — `hono`, `body-parser`,
`esbuild`, `protobufjs`, `qs`, `@hono/node-server` — none reach the
`--audit-level=high` threshold; unrelated to this ticket's diff),
`node scripts/check-version.mjs` exit 0.

No production code was modified by QA — `git diff -- tools/` between the
start and end of this QA pass is empty (constraint honored: this worktree's
`tools/`, `content/`, and the primary checkout were left untouched; only
`test/` and this `qa_reports/` file changed).

## Phase 0.5 — Expected-Red Diff

`qa_reports/expected-red_e123b9-lane-flip.txt` does not exist (T-E123B9-05
emptied and removed it — all 4 of its entries are now permanently green).
Phase 0.5: skipped (no expected-red manifest declared).

## Phase 1 — Review

Read the full uncommitted amendment diff (`git diff 7dc9d0d -- tools/`:
`tools/lane-migrate.ts`, `tools/handoff-parse.ts`, `tools/handoff-write.ts`,
+82/-36) directly, and cross-checked it against
`review_reports/review_T-E123B9-06.md` (code-reviewer, APPROVED). Agree with
every AC16-AC20 completeness finding in that review:

- **AC16** — `hasFlatLaneFiles` (new predicate, iterates `LANE_FILES`,
  `isFile`, short-circuits) used identically at both own-workspace sites
  (`migrateOwnWorkspaceIfFlat` in `tools/handoff-parse.ts`, after the AC14
  dual-presence assert; `writeHandoffStateCore`'s locked section in
  `tools/handoff-write.ts`, also after that assert).
- **AC17** — `planMoves`'s `sidecarsFirst` array puts every non-required
  `LANE_FILES` entry ahead of the required one, so `handoff.md` is always
  the LAST move attempted.
- **AC18** — the core's only `alreadyMigrated: true` return is
  `missingRequired.length > 0 && alreadyInLane && plan.length === 0`;
  otherwise it always calls `planMoves(..., requiredMayBeAbsent)` and sweeps
  whatever is left, whether that is "handoff.md missing at flat because it's
  already in the lane" (legacy-order resume) or "handoff.md present at flat,
  some sidecars already in the lane" (new-order resume).
- **AC19** — `FlatToLaneOptions.allowMissingRequired`, set ONLY by the two
  own-workspace triggers, lets the core skip the required-entry throw and
  move sidecars anyway; the direct wrapper (`migrateFlatToLane`) still
  defaults to strict (unset) and refuses.
- **AC20** — `readAndMigrate`'s catch treats `ENOTDIR` exactly like `ENOENT`.

**Copy / Strings**: N/A — spec states "feature introduces no new user-facing
copy". Gate skipped by the spec's own escape hatch.

**Visual Tokens / Visual Widgets**: N/A — spec states "no visual literals" /
"no non-navigation widgets" (server-internal storage-layout change). Gate
skipped by the spec's own escape hatch.

**Visual Baselines**: absent (no `design/e123b9-lane-flip.md`). Phase 1.5
skipped per the SOP's own absent branch.

## Phase 2 — Discussion

No issues found in Phase 1 (code-reviewer's APPROVED verdict holds; my own
independent read surfaced no new correctness concerns). Proceeding directly
to Phase 3.

## Phase 3 — Tests

### Spec-to-test map (this round's scope: AC16-AC21)

| AC | test(s) | file |
|---|---|---|
| AC16 (trigger predicate) | exercised by every AC21(a)/(b)/(c) case below (each fixture only migrates because `hasFlatLaneFiles` fires) | `test/e123b9-lane-flip.test.mjs` |
| AC17 (sidecars-first, handoff last order) | `AC21(a) new-ordering k=0/1/2/4` (handoff always the last file moved); `AC21(b)` (crash lands exactly between the sidecar rename and the handoff rename) | same |
| AC18 (resume after interruption, both orderings + sweep) | `AC21(a) new-ordering k=0/1/2/4`, `AC21(a) legacy-ordering, no lane sidecar copy`, `AC21(a) legacy-ordering, WITH lane sidecar to merge`, `AC21(a) mid-merge: lane sidecar already starts with flat bytes` (each run twice — once via `readHandoffState`, once via `writeHandoffState` on a fresh copy) | same |
| AC19 (flat sidecars, no handoff anywhere) | `AC21(c): ... readHandoffState ...`, `AC21(c): ... writeHandoffState ...`, `AC21(c) [e123a FL3]: a DIRECT migrateFlatToLane call ...` | same |
| AC20 (ENOTDIR degrades like ENOENT) | `AC21(d) [AC20]: a workspace_path with a file as a path component ...` | same |
| AC21 (this task's own contract: real crash / J2-NEW-12) | `AC21(b) [J2-NEW-12]: a real crashed child process ...` | same |
| AC8 (reversibility, both rounds) — must stay green | `AC8 Round 1`, `AC8 Round 2` (pre-existing, unmodified by this round) | same |

## AC Execution Log

`specs/e123b9-lane-flip.md`'s Acceptance Criteria carry line-leading
`proof:` annotations throughout the ORIGINAL body (AC1-AC15); the "##
Amendment 2026-09-24" section (AC16-AC21, this round's actual scope) adds
none — confirmed via `awk '/## Amendment 2026-09-24/,0' specs/e123b9-lane-flip.md
| grep -n "proof:"`, zero matches. Per Phase 3.5, this section is still
load-bearing for PASS because the SPEC as a whole carries `proof:`
annotations, even though this round's own diff doesn't add new ones.

AC1-AC7/AC9-AC15's proofs were executed and logged in the prior round
(`qa_reports/review_T-E123B9-05.md`'s own `## AC Execution Log`, covering
T-E123B9-01..05) and are unaffected by this round's diff — `git diff` for
this round touches only the AC16-AC20 amendment's own code paths inside the
three already-reviewed files, confirmed via `git diff -- tools/` matching
`review_T-E123B9-06.md`'s own scope note. This round re-executes the one
proof-bearing AC this task's own scope explicitly requires re-confirming:

| AC | proof (summary) | executed via | result |
|---|---|---|---|
| AC8 | Round 1 (direct runners) + Round 2 (wired `readHandoffState`, via `dist/`) against a REAL copy of the primary checkout's `.current/`, byte-identical round trip | `test/e123b9-lane-flip.test.mjs` "AC8 Round 1" / "AC8 Round 2" (pre-existing, run unmodified as part of this round's full suite) | PASS — see item (e) below |
| AC12 (binding, unchanged in shape) | write against unmigrated flat fixture completes well under `LOCK_MAX_WAIT_MS` | `test/e123b9-lane-flip.test.mjs` "AC12" (pre-existing) | PASS |
| AC-MIG-3 (binding) | concurrent processes never half-move | `test/e123b9-lane-flip.test.mjs` "AC-MIG-3" (pre-existing) | PASS |
| AC13 (binding) | cross-workspace read never migrates | `test/e123b9-lane-flip.test.mjs` "AC13" (pre-existing) | PASS |
| AC14 (binding) | dual-presence throws `HANDOFF_LAYOUT_CONFLICT` | `test/e123b9-lane-flip.test.mjs` "AC14" (pre-existing) | PASS |

All five ran as part of this round's `npm test` (2390/2390 green) — none
regressed.

### (a)-(e) — this task's own required coverage

- **(a) Interrupted layouts, fresh fixtures, one `readHandoffState` / one
  `writeHandoffState` (fresh copy) each — PASS.**
  - New ordering (k = 0, 1, 2, 4 sidecars already in the lane dir, the rest
    + `handoff.md` still flat): 4 scenarios × 2 (read/write) = 8 tests, all
    green.
  - Legacy ordering, WITHOUT a lane copy to merge into (`handoff.md` in the
    lane dir, sidecars purely flat): 2 tests, green — this is the exact
    "must sweep them into the lane, must not return `alreadyMigrated` and
    skip them" case AC18's own text calls out.
  - Legacy ordering, WITH a lane copy to merge into (one sidecar present at
    BOTH paths with independent, non-overlapping content): 2 tests, green —
    a real AC15 merge (flat lines first, then the lane's own pre-existing
    lines), not a refusal and not a silent pick-one-side.
  - Mid-merge (`metrics.jsonl`'s lane copy already starts with the flat
    bytes — i.e. a merge already published, tmp renamed into place — but the
    flat source was not yet unlinked): 2 tests, green — resume takes the
    "drop" branch (remove the leftover flat file, leave the lane file's
    bytes untouched), never re-merges and duplicates.
  - Every case asserted: every lane file at its lane path, no flat lane file
    remains, exact line content (`Set(lines).size === lines.length` plus a
    literal array-equal against the expected flat-then-lane-preexisting
    concatenation) with no duplicates or losses, `parseHandoff` state
    deep-equals a canonical gold state (for the write cases, every field
    except `last_updated`, which a real write legitimately advances — plus
    an explicit assertion that it DID advance), and no throw of any kind
    (which would have caught a spurious `HANDOFF_LAYOUT_CONFLICT`, since
    none of these fixtures ever place `handoff.md` at both paths at once).
- **(b) A REAL process-death case — PASS. Test name carries `[J2-NEW-12]`
  for visibility, per the dispatch brief's instruction.**
  - Technique: Node's stable module-customization hook
    (`node --import 'data:...;register(...)'`, `test/_e123b9-fault-fs-loader.mjs`
    resolving the bare `"fs"` specifier — the exact form every compiled
    `dist/` module imports it as — to `test/_e123b9-fault-fs-shim.mjs`,
    which wraps `renameSync` to `process.exit(137)` right after a configured
    call count, importing the real implementation from the untouched
    `"node:fs"` specifier). This is a genuine child-process OS-level
    termination — verified via `process.kill(pid, 0)` throwing `ESRCH`
    against the crashed lock's own recorded PID, not a simulated one.
  - Fixture: `handoff.md` flat, one sidecar (`telemetry.jsonl`) flat.
    `CRASH_AFTER_RENAME=1` kills the child right after the sidecar's rename
    (AC17: sidecars move first), before `handoff.md`'s rename ever runs.
  - Asserted post-crash: the lock file exists at
    `.current/<lane>/.handoff.lock` and names the now-dead PID; the sidecar
    is at its lane path; `handoff.md` is still flat.
  - Asserted next READ (`readHandoffState`, same process, no crash): does
    not throw; returns `exists: true` with the correct `active_feature`;
    does NOT complete the migration — `handoff.md` is still flat and the
    stale lock is still present, untouched. This is the exact,
    non-blocking, documented `recommended` finding from
    `review_T-E123B9-06.md`: the read's own lock acquisition is a single
    non-blocking `openSync("wx")` that gets `EEXIST` and returns without
    checking staleness (`guards/file-lock.ts`'s `looksStale` is never
    consulted on this path).
  - Asserted next WRITE (`writeHandoffState`, same process): clears the
    stale lock (`guards/file-lock.ts`'s `withFileLock` DOES check
    `looksStale` on acquisition — the dead PID makes `isAlive` false
    immediately, no 30s wait needed) and completes the migration, with the
    same end-state assertions as (a) (lane paths, no flat leftover, exact
    line content, state deep-equal to gold modulo the write's own new
    `last_updated`).
  - **J2-NEW-12** (`NEW-TICKETS.md`, already filed by code-reviewer) names
    this exact limitation and the reviewer's own suggested fix (export
    `looksStale` from `guards/file-lock.ts`, let the read path clear a
    dead-PID lock before giving up) — out of scope to fix per the dispatch
    brief; this round's test is the independent real-crash reproduction.
- **(c) AC19 — PASS.**
  - `readHandoffState` on a flat-sidecars-only, no-handoff-anywhere fixture:
    does not throw, moves both sidecars (content verified byte-exact),
    returns `exists: false` (the normal "no state" result), creates no
    `handoff.md`.
  - `writeHandoffState` on a fresh copy of the same shape: does not throw,
    moves the sidecar, and — as expected, since writing IS creating state —
    the write's own `handoff.md` lands at the lane path (this is not a
    violation of AC19's "no state" claim, which is read-only-result scoped).
  - Direct `migrateFlatToLane(ws)` (no `allowMissingRequired`) on the same
    shape: still refuses with the `required lane file ... handoff.md ...
    not found` error (e123a FL3), and moves nothing (the flat sidecar is
    still there afterward, no lane directory survives).
- **(d) AC20 — PASS.**
  - `readHandoffState` / `parseHandoff` against two `workspace_path`s with a
    plain file as a path component (the workspace root itself, and one
    nested a level deeper under it) both degrade to the pre-ticket
    no-prior-state result (`exists: false` / `null`) without throwing. The
    file itself is verified byte-unchanged afterward (read-only degrade,
    never a repair attempt).
- **(e) AC8 reversibility — PASS, unchanged.** "AC8 Round 1" and "AC8 Round
  2" (pre-existing, from T-E123B9-05) ran unmodified as part of this round's
  full suite and are still green — see the AC Execution Log table above.

### Coverage Gate

New/modified file for this round: `test/e123b9-lane-flip.test.mjs`
(appended, ~640 new lines) plus three new qa-owned fixture helpers
(`test/_e123b9-fault-fs-loader.mjs`, `test/_e123b9-fault-fs-shim.mjs`,
`test/_e123b9-crash-worker.mjs`, per the dispatch brief's pre-authorization
of "a new helper next to `test/_e123b9-migration-worker.mjs`"). No
production `tools/`/`guards/` line changed by this round, so there is no new
production surface to line-cover — every new test line directly exercises
already-implemented AC16-AC21 production behavior. Tooling can't measure
%-line-coverage on test-only additions; noted explicitly per the SOP's own
escape hatch.

### Security Smoke Tests

- Boundary inputs: AC20's fixtures are exactly a boundary-input case (a
  malformed `workspace_path` whose path components aren't directories);
  AC19's fixtures are the "required file absent" boundary; AC21(a)'s k=0/k=4
  cases are the two numeric boundaries of the sidecar-count range.
- No new input boundary or auth/permission surface is introduced by AC16-21
  (matches code-reviewer's own Security section: "the lane name still goes
  through `assertSafeLane`").

## Phase 4 — Run

- `npm run build`: clean (0 errors), including `check:version` and
  `check:transitions-sync` postbuild steps.
- `npm test`: **2390/2390 green**, exit 0, headless, zero human interaction,
  zero expected-red exemptions.
- `npm audit --audit-level=high`: exit 0 (6 pre-existing moderate/low
  advisories in dev-only transitive deps, none at or above `high`).
- `node scripts/check-version.mjs`: exit 0.

## Quality / Architecture / Security / Performance

No findings beyond code-reviewer's own (all non-blocking, already
dispositioned in `review_reports/review_T-E123B9-06.md`). QA's own new test
files (`test/_e123b9-fault-fs-*.mjs`, `test/_e123b9-crash-worker.mjs`) touch
only `test/`; the fault-injection technique (module-customization resolve
hook) intercepts the bare `"fs"` specifier only — `"node:fs"` (what the shim
itself imports the real implementation from) is left alone, so there is no
risk of the shim recursively re-resolving to itself, and no production
module's behavior is altered outside the one crash-worker child process that
explicitly opts into the hook via its own `--import`.

## Ticket Cross-Reference (none newly filed by this round)

- **J2-NEW-12** (`NEW-TICKETS.md`, already filed by code-reviewer,
  T-E123B9-07) — the read path's single non-blocking lock attempt does not
  check staleness, so a crashed migrator's stale lock is only cleared by the
  NEXT WRITE, not the next read. This round's AC21(b) test independently
  reproduces the exact behavior that ticket describes, with a REAL
  process death (not a simulation), and confirms it: documented behavior
  (matches AC12's own busy-lock design and AC18's "read OR write" wording),
  not a defect. No new ticket filed by QA for this finding — it was already
  on record before this task started. This round found no NEW issues
  warranting a J2-NEW-13+ entry.
## 2026-09-24T03:45:30.602Z — PASS — by qa-engineer

PASS — specs/e123b9-lane-flip.md Amendment 2026-09-24 (AC16-AC20) plus this task's own AC21 verified. code-reviewer APPROVED (review_reports/review_T-E123B9-06.md). Added durable interrupted-migration-then-read/write coverage in test/e123b9-lane-flip.test.mjs: (a) new-ordering k=0/1/2/4, legacy-ordering with/without lane sidecar to merge, mid-merge resume — all via one readHandoffState + one writeHandoffState on a fresh copy each, asserting lane-path settlement, exact line content, and state deep-equal to gold; (b) a REAL child-process crash (module-customization fs shim, process.exit(137) after a real rename) leaving a stale per-lane lock — confirms the documented J2-NEW-12 fallback (next read: correct state, migration not completed; next write: clears stale lock, completes migration); (c) AC19 (flat sidecars, no handoff anywhere) for read+write plus the direct migrateFlatToLane refusal (e123a FL3); (d) AC20 (ENOTDIR degrades like ENOENT) for a file-as-path-component workspace_path. npm run build clean, npm test 2390/2390 green (zero expected-red), npm audit --audit-level=high exit 0, node scripts/check-version.mjs exit 0. See qa_reports/review_T-E123B9-08.md for full detail. No production code touched by QA.

## 2026-09-24T03:46:16.352Z — PASS — by qa-engineer

PASS — specs/e123b9-lane-flip.md Amendment 2026-09-24 (AC16-AC20) plus this task's own AC21 verified. code-reviewer APPROVED (review_reports/review_T-E123B9-06.md). Added durable interrupted-migration-then-read/write coverage in test/e123b9-lane-flip.test.mjs: (a) new-ordering k=0/1/2/4, legacy-ordering with/without lane sidecar to merge, mid-merge resume — all via one readHandoffState + one writeHandoffState on a fresh copy each, asserting lane-path settlement, exact line content, and state deep-equal to gold; (b) a REAL child-process crash (module-customization fs shim, process.exit(137) after a real rename) leaving a stale per-lane lock — confirms the documented J2-NEW-12 fallback (next read: correct state, migration not completed; next write: clears stale lock, completes migration); (c) AC19 (flat sidecars, no handoff anywhere) for read+write plus the direct migrateFlatToLane refusal (e123a FL3); (d) AC20 (ENOTDIR degrades like ENOENT) for a file-as-path-component workspace_path. npm run build clean, npm test 2390/2390 green (zero expected-red), npm audit --audit-level=high exit 0, node scripts/check-version.mjs exit 0. See qa_reports/review_T-E123B9-08.md for full detail. No production code touched by QA.

