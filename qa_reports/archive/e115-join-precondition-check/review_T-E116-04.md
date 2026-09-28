covers: T-E116-01, T-E116-03, T-E116-04

# QA Review — T-E116-04 (archive-on-feature-change)

Spec: `specs/e116-archive-on-feature-change.md`. Production diff: ONE file,
`tools/handoff-write.ts` (+63/-1 vs base `1b5a48c`). Verified by EXECUTION per
the human's explicit bar for this ticket, not by reading the diff.

## Phase 0 — Claim

Claimed review of T-E116-01, T-E116-03, T-E116-04 via `tw_update_state`
(status=In_Progress, agent_id=qa-engineer) before starting.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e116-archive-on-feature-change.txt`
manifest declared).

## Phase 1 — Review

Read `tools/handoff-write.ts:350-509` (the full v15 archive block plus its
surrounding context) directly, not just the round-1/round-2 code-review
reports. Confirmed:

- `archiveCheckNeedsExisting = true` (unconditional, :384) forces the shared
  `existing = parseHandoff(...)` read on every write, exactly as the spec's
  "Reconciliation with E114's v14 block" section describes.
- The archive block (:453-:488) never reads or writes any of the six
  feature-scoped fields, never touches `frontmatterData` — confirmed by
  inspection, and confirmed empirically in the AC2 test below (the six fields'
  reset/carry-forward behavior is unchanged with or without the archive
  firing).
- The copy (`fs.copyFileSync`, :487) sits after the same `verifyFreshness`
  call and inside the same `withFileLock` critical section, strictly before
  the tmp-write+rename publish (:636-:638) — no TOCTOU gap.
- Sanitization is `.replace(/[^A-Za-z0-9._-]/g, "-")` (:479) THEN
  `.slice(0, 200)` (:480) — the C1 fix, confirmed both present and in the
  correct order.

No Copy Audit Gate / Visual Audit Gate applicable — spec's Copy/Strings and
Visual Tokens tables are both explicitly N/A (no user-facing strings or
literals; internal server mechanism).

## Phase 1.5 — Visual Compare

Skipped (no `design/e116-*.md`, no Visual Baselines declared).

## Phase 2 — Discussion

None needed — round 1 (opus) and round 2 (opus) code review already resolved
all findings (`review_reports/review_T-E116-03.md`); C1 (ENAMETOOLONG wedge)
was found and fixed, verified empirically in round 2. QA's own job here is
independent execution-based verification of the same ACs plus the C1
regression, not re-litigating what review already cleared.

## Phase 3 — Tests

Test file: **`test/e116-archive-on-feature-change.test.mjs`** (new file, per
the dispatch brief's pre-authorized placement — the only test file this
ticket needed; no cases scattered elsewhere).

Calling convention: `writeHandoffState()` called directly (bypassing
`TOOL_REGISTRY`/`tw_update_state`), the same convention
`test/e114-cut-approval-inheritance.test.mjs` uses for its AC5/F1 multi-write
scenarios — the archive mechanism lives entirely inside
`writeHandoffStateCore`, and a direct call exercises the exact real function
production code goes through while staying free of `ALLOWED_TRANSITIONS`
gate-chain friction across the multiple sequential writes each scenario
needs. E116 adds no new client-settable zod field, so there is no zod-surface
property to test via `dispatch()`/`TOOL_REGISTRY` — the sibling file's
`dispatch()` helper is for a different concern (AC6's zod-arg pin) that
doesn't apply here.

### Spec-to-Test map

| AC | proof (spec) | test case(s) |
|---|---|---|
| AC1 | executed | "AC1: archive captures the outgoing ledger verbatim on feature change" |
| AC2 | executed | "AC2: live handoff still resets on feature change — six feature-scoped fields carry forward same-feature, drop on feature change" |
| AC3 | executed | "AC3: no archive on a same-feature write" |
| AC4 | executed | "AC4: no archive on the first-ever write to a fresh workspace" |
| AC5 | executed | "AC5-1" (charset/traversal), "AC5-2" (233-char C1 wedge), "AC5-3" (500-char schema max), "AC5-4" (10000-char unconditional clamp, bypasses zod), "AC5-5" (multi-byte replace-before-slice ordering) |
| AC6 | inspection | this doc, "AC6/AC7 inspection" section below |
| AC7 | inspection | this doc, "AC6/AC7 inspection" section below |
| bonus | executed | "bonus: an archive-copy failure (ENOTDIR) aborts the whole write..." — pins the deliberate fail-closed semantics (uncaught `fs.copyFileSync`) the dispatch brief flagged as worth protecting cheaply |

### Notable case design decisions

- **AC1** asserts `Buffer`-level `assert.deepEqual` between the pre-overwrite
  `handoff.md` bytes and the archived file's bytes — a true verbatim-byte
  proof, not a field-by-field reconstruction. `completed_tasks`/`pending_notes`
  live in markdown body sections (`## Completed` / `## Pending & Handoff
  Notes`), not YAML frontmatter — the test asserts those via regex against the
  raw archived text (matching production's own `extractSectionContent`
  convention) rather than trying to `yaml.load` the whole file.
- **AC2** is written as the "central tension" pin per the dispatch brief: the
  SAME six fields (`cut_approved`, `external_refs`, `dispatch_pins`,
  `dispatch_mode`, `evidence_schema`, `cut_approved_source`) are asserted to
  carry forward on a same-feature write (baseline/contrast) and then, in the
  same test, drop to `undefined` on a feature-change write. `lastAgent` is
  deliberately never `"pm"` in this test — `cut_approved` has its own
  independent PM-re-entry re-arm rule (unrelated to the feature-scoped drop
  this AC is about), and using `"pm"` would have confounded the two
  mechanisms. A future edit that "improves" E116 by preserving these fields
  across a feature change fails this test's final block.
- **AC5-2/AC5-3/AC5-4** directly pin the C1 regression the dispatch brief
  called out: 233 chars (the exact historical wedge threshold that threw
  `ENAMETOOLONG` before the fix), 500 chars (the registry's
  `z.string().max(500)` schema ceiling), and 10000 chars via a direct
  `writeHandoffState` call that bypasses the zod boundary entirely (proving
  the `.slice(0, 200)` clamp is unconditional, protecting internal callers
  like the migration heal-write in `tools/handoff-parse.ts` too, not just
  `tw_update_state`'s client-facing surface).
- **AC5-5** pins the replace-before-slice ordering the dispatch brief flagged
  as load-bearing for non-ASCII input: 5 astral emoji (10 UTF-16 code units,
  engineered to straddle the 200-code-unit clamp boundary) plus CJK padding.
  Asserts the resulting stem is exactly 200 chars, matches
  `/^[A-Za-z0-9._-]+$/`, and — the key invariant — `Buffer.byteLength(stem,
  "utf-8") === stem.length`, proving the stem is pure single-byte ASCII (no
  lone/split surrogate or multi-byte code unit survived into the filename).
  Added a comment in the test explaining why this ordering matters and what a
  reordering (slice-then-replace) would risk, per the dispatch brief's ask to
  encode this "in a test or at minimum a comment."
- **bonus** (fail-closed): forced `fs.copyFileSync` to fail with `ENOTDIR` by
  making `.current/archive` a regular file (the same technique round 2 of
  code review used), then asserted the whole write rejects, the live
  `handoff.md` is byte-identical to before the attempt, the `.handoff.lock`
  file is not left behind, and no `.tmp` file is left behind. This is a
  protective regression test for deliberate, already-approved behavior — not
  a change request.

### Coverage gate

New/modified production surface is entirely inside the archive block
(`tools/handoff-write.ts:453-488`, ~36 lines) plus the one forcing-function
flag (:384) and its participation in the existing trigger `if` (:402). Every
branch is exercised: `featureChanged` true+existing (AC1/AC2/AC5/bonus),
`featureChanged` false (AC3), `existing === null` (AC4), the `mkdirSync`
happy path (AC1 first archive) and its already-exists path (AC2's later
archives / AC5 sequential runs), and the failure path (bonus). Effectively
100% branch coverage of the new code by inspection (no coverage tool
configured in this repo to measure automatically — noted per SOP Phase 3c).

### Security smoke

Boundary inputs covered: empty/first-write (AC4), pathological charset
including `/` and `..` (AC5-1), extreme lengths from 233 to 10000 chars
(AC5-2/3/4), non-ASCII/multi-byte (AC5-5). No auth/permission surface — this
is a local file-lock-protected write path, not an access-control boundary.

## Phase 3.5 — AC Execution Log

Spec has no `proof:`-annotated ACs in the sense Phase 3.5 means (the spec's
own `proof:` lines name the test file/case, which IS what Phase 3 is for) —
logging execution here anyway since AC6/AC7 are inspection-proof commands,
run and recorded verbatim:

```
$ git diff --stat 1b5a48c -- tools/storage-sqlite.ts
(no output — file absent from the diff, AC6 confirmed)

$ git diff --stat 1b5a48c -- schema/versions.ts tools/handoff-types.ts
(no output — both files absent from the diff, AC7 confirmed)

$ git diff --stat 1b5a48c -- .
 .current/handoff.md               |  25 +++-----
 .current/telemetry.jsonl          |   2 +
 NEW-TICKETS.md                    | 129 ++++++++++++++++++++++++++++++++++++++
 dist/tools/handoff-write.d.ts.map |   2 +-
 dist/tools/handoff-write.js       |  60 +++++++++++++++++-
 dist/tools/handoff-write.js.map   |   2 +-
 tasks.md                          |   3 +
 tools/handoff-write.ts            |  64 ++++++++++++++++++-
 8 files changed, 265 insertions(+), 22 deletions(-)
```

Confirms the production diff is exactly one source file
(`tools/handoff-write.ts`); `dist/` is regenerated tsc output;
`.current/handoff.md`/`.current/telemetry.jsonl`/`tasks.md`/`NEW-TICKETS.md`
are this workspace's own governance bookkeeping, not ticket production code.

Note on `schema_version`: this workspace's own live `.current/handoff.md`
(the one the `tw_*` MCP tools write, served by an already-running server
process) currently shows `schema_version: 13` even though
`schema/versions.ts`'s `CURRENT_VERSIONS.handoff` in THIS worktree's checkout
is `14` — that discrepancy is an artifact of the running MCP server process
being a separate instance from this worktree's own build (likely pointed at
a different checkout or started before this lane's code landed), not an
E116/E114 defect and not something in scope to chase down here. It does not
affect AC7, which is about the git diff, and it does not affect any test
result above (every test in `test/e116-archive-on-feature-change.test.mjs`
runs against THIS worktree's own `dist/`, built fresh via `npm run build`
during this review, where `CURRENT_VERSIONS.handoff` correctly resolves to
14).

## Phase 4 — Run

- Build: `npm run build` — clean (tsc, check:version, check:transitions-sync
  all OK).
- New test file alone: `node --test
  test/e116-archive-on-feature-change.test.mjs` — 10/10 pass.
- Full suite: `npm test` — **2145/2145 pass, 0 fail** (baseline was
  2135/2135; this ticket's new file adds exactly the expected 10 cases, no
  other file regressed).
- `npm audit --audit-level=high` — **exit 0** (0 high/critical). 6
  pre-existing vulnerabilities reported at lower severity (2 low, 4 moderate:
  `protobufjs`, `qs`, `hono`'s transitive deps) — pre-existing, unrelated to
  this ticket's one-file diff, not introduced by T-E116-01. Reporting honestly
  per instructions, not papering over: these are informational, not a QA
  blocker (moderate/low is below the `--audit-level=high` gate and this
  ticket touches none of the affected packages).

**Test artifact housekeeping**: this test file uses `os.tmpdir()`-based
throwaway workspaces (`mkWs()`) exclusively — every `.current/archive/`
directory the test run produced lives under the OS temp dir, not this repo.
Confirmed via `ls .current/archive` (does not exist) and a repo-wide `find`
for directories named `archive` (only pre-existing, unrelated
`review_reports/archive` and `qa_reports/archive` dirs — not
`.current/archive`). Nothing from this test run landed in the repo working
tree; nothing needs to be gitignored or cleaned up.

**PASS** — T-E116-01, T-E116-03, T-E116-04 all pass. AC1-AC5 verified by
execution (10 test cases, all green); AC6-AC7 verified by inspection (git
diff, recorded above); the C1 regression (233-char wedge / ENAMETOOLONG) is
now permanently pinned; the fail-closed copy-failure semantics are pinned as
a regression test, not re-litigated as a finding.

No new out-of-scope findings. `NEW-TICKETS.md`'s existing L-STATE-NEW-1
(closed) and L-STATE-NEW-2 (filed, non-blocking, collision-window measured at
zero across 400 writes) are unchanged by this review — not re-litigated per
the dispatch brief.
## 2026-09-18T12:34:35.687Z — PASS — by qa-engineer

PASS. test/e116-archive-on-feature-change.test.mjs (new, 10 cases) verifies AC1-AC5 by execution: AC1 verbatim byte-copy, AC2 the reset/carry-forward central tension, AC3 no-archive-same-feature, AC4 no-archive-first-write, AC5 charset+200-char clamp incl. the C1 233-char wedge regression, the 500-char schema max, an unconditional 10000-char clamp bypassing zod, and multi-byte replace-before-slice ordering. Plus a bonus fail-closed regression (ENOTDIR forces copyFileSync to throw; live ledger untouched, no leaked lock/tmp). AC6/AC7 verified by inspection (git diff --stat shows storage-sqlite.ts/schema/versions.ts/tools/handoff-types.ts absent). npm run build clean; npm test 2145/2145 (baseline 2135 + 10 new); npm audit --audit-level=high exit 0 (6 pre-existing lower-severity advisories, unrelated). Evidence: qa_reports/review_T-E116-04.md (covers T-E116-01, T-E116-03, T-E116-04).

