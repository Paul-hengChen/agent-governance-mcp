# Review — T-E126-05 (batched: T-E126-05, T-E126-06)

covers: T-E126-05, T-E126-06

## Round 1 — FAIL — by qa-engineer

Contract: `specs/e126-merge-invariants.md`, HUMAN-APPROVED AMENDED at commit
`e405de8` ("docs(e126): E126 spec amendment — (c) union across parents (cr
R-1), R-2 trim alignment, Q-1 dedup"). The spec's `## Task -> AC Coverage`
table is authoritative over the terse `tasks.md` row text. Reviewer tier:
sonnet. Code under test: `eed6689` (`tools/merge-invariants.ts`,
`scripts/merge-invariants.mjs`) + `460685d`
(`scripts/verify-release.mjs` `BOOKKEEPING_PATH_RES`). Code-review round 1:
APPROVED, no required findings (`66d81a6`,
`review_reports/review_T-E126-01.md`, covers T-E126-01..04).

## Why this is a FAIL, and why it is NOT an implementation defect

**The implementation under test (`eed6689`) predates the spec amendment
(`e405de8`).** The amendment exists BECAUSE code-review round 1 (R-1, see
`review_reports/review_T-E126-01.md` "Correctness" section) found a real
silent-loss hole in condition (c) of the Compaction exemption as originally
written and approved, and the PM/human tightened the spec in response. The
implementation is spec-literal against the ORIGINAL text (code-reviewer's
own words: "The implementation is spec-literal: the spec says COMPACTED
'iff' (a)-(d), so tightening it here would contradict the approved text.
Not blocking."). It has simply not yet been updated to the AMENDED text.
This qa round exists to turn that amendment into failing, executable tests
per the T-E126-05 dispatch brief — the FAIL below routes to sr-engineer to
implement the fix, not to PM to reconsider the spec (the spec is already
human-approved and authoritative).

The three test failures below map 1:1 onto the three specific amendment
clauses in `specs/e126-merge-invariants.md`:

1. **The (c) union paragraph** ("Compaction exemption rule", bullet (c),
   revised text beginning "count reconciliation over the UNION across
   parents, not per-parent"). AC11's fourth counter-example (spec: "(iv)
   (R-1 counter-example, cross-parent union — code-review round 1) the merge
   itself compacts section S while BOTH parents independently added
   DIFFERENT closed rows to S ... and the manifest says '4 done' ... every
   one of the 5 is reported MISSING, exit 1") is the amendment's own
   worked example, reproduced verbatim as a fixture.
2. **The R-2 paragraph** ("Line-trimming alignment (R-2, code-review round 1
   observation)" under Definitions) — ledger-line reading must trim exactly
   as `tools/tasks-file.ts` does.
3. **The Q-1 dedup requirement** ("Report every COMPACTED row ... —
   deduplicated by `task_id` (Q-1, code-review round 1 observation...)"
   under Definitions, just above the Sanity Check).

## Phase 0.5 — Expected-Red Diff

`qa_reports/expected-red_e126-merge-invariants.txt` exists (1 entry, the
`test/lane-paths.test.mjs` CALLERS2 red for the new `tools/merge-invariants.ts`
importer). Per T-E126-05's own scope, this round's Phase 3 work FIXES that
red (appends `tools/merge-invariants.ts` to `SANCTIONED_LANE_PATHS_IMPORTERS`)
rather than merely disposition it — confirmed green post-fix (see Phase 4).
No stray reds outside the manifest were observed pre-fix; `dispatch_mode` is
absent (feature mode), so this stays advisory. Disposition: manifest entry
resolved by this round's own test-file change, not carried forward.

## Phase 3 — Tests written

- `test/e126-merge-invariants.test.mjs` (NEW, pre-authorized per dispatch
  brief) — 16 cases, real throwaway git-fixture repos under `os.tmpdir()`
  built via `git commit-tree` (never the working tree, never inside this
  repo), covering AC1-AC9 and all four AC11 counter-examples + one clean
  compaction case + R-2 + Q-1.
- `test/verify-release.test.mjs` — VR-48/VR-49, mirroring VR-39/VR-40 for
  `.current/_primary/tasks.md` and `.current/<lane>/tasks.md` tolerance
  (AC10). Both PASS — T-E126-04 already implements AC10 correctly. VR-47
  (the `LANE_SEGMENT_RE_SRC` drift guard) was NOT extended: the new
  lane-scoped `tasks.md` regex reuses the same `LANE_SEGMENT_RE_SRC`
  constant VR-47 already pins, so there is nothing new for that guard to
  mirror.
- `test/lane-paths.test.mjs` — appended `tools/merge-invariants.ts` to
  `SANCTIONED_LANE_PATHS_IMPORTERS` (CALLERS2), closing the expected red
  above. Nothing else in that file touched.

### Spec-to-Test map (T-E126-05 row)

| AC | test | result |
|---|---|---|
| AC1 | "AC1: row dropped by a bad merge is reported MISSING" | PASS |
| AC2 | "AC2: [x] regressed to [ ] across a merge is reported" | PASS |
| AC3 | "AC3: sidecar record shortfall is reported with counts" | PASS |
| AC4 | "AC4: a row relocated by migration/finish --shipped is not a false MISSING" | PASS |
| AC5 | "AC5: every offending MISSING/LOST_DONE/SIDECAR_SHORTFALL item is printed, exit 1" | PASS |
| AC6 | "AC6: non-merge commit exits NOT_A_MERGE_COMMIT" (0/1/3 parents) | PASS |
| AC7 | "AC7: unrelated histories exit NO_MERGE_BASE" | PASS |
| AC8 | "AC8: clean merge exits 0" | PASS |
| AC9 | "AC9: bad ref / non-repo / usage errors exit USAGE_ERROR" | PASS |
| AC11 (clean) | "AC11: a real compaction merge exits 0 with an informational COMPACTED count" | PASS |
| AC11 (i) | "AC11: an open row dropped under a compaction marker is MISSING, exit 1" | PASS |
| AC11 (ii) | "AC11: a failed count reconciliation lists every un-found row of that section by task_id, exit 1" | PASS |
| AC11 (iii, R1) | "AC11: a row added under an already-compacted section name is MISSING when dropped, exit 1 (R1 counter-example)" | PASS |
| **AC11 (iv, R-1 union)** | **"AC11: a merge that compacts S while both parents added different closed rows exceeding the manifest count reports every row MISSING, exit 1 (R-1 5-vs-4 fixture)"** | **FAIL — expected-red (amendment gap)** |
| **R-2** | **"R-2: an indented checkbox row that is tasks-file.ts-visible must not be silently invisible to merge-invariants when dropped by a merge"** | **FAIL — expected-red (amendment gap)** |
| **Q-1** | **"Q-1: the informational COMPACTED breakdown dedups by task_id, matching the header count"** | **FAIL — expected-red (amendment gap)** |
| AC10 | VR-48, VR-49 | PASS |

## Phase 4 — Run

Clean tree (tests committed, `git status --porcelain` shows only tracked
lane-bookkeeping sidecars, no untracked files) — commit `305a76a`
`test(e126): E126 T-E126-05/06 — fixture-repo coverage for AC1-AC9/AC11 + AC10 tolerance`.

- **Full suite**: `npm test` — **2645/2648 PASS, 3 FAIL** (build + prebuild
  clean, zero errors before the test run).
- **New file alone**: `node --test test/e126-merge-invariants.test.mjs` —
  13/16 PASS, 3 FAIL (identical red list).
- **Red list (exactly 3, both runs identical, nothing else red anywhere in
  the suite)**:
  1. `AC11: a merge that compacts S while both parents added different
     closed rows exceeding the manifest count reports every row MISSING,
     exit 1 (R-1 5-vs-4 fixture)` — observed: `code=PASS`,
     `compacted=T-U-01,T-U-02,T-U-03,T-U-04,T-U-05`, `missing=` (empty).
     Expected per amended (c): `code=FAIL`,
     `missing=T-U-01..T-U-05` (all 5). Root cause:
     `compactionIneligibility` (`tools/merge-invariants.ts:322-343`)
     computes `actual` via `sectionCounts(parentSnap...)` (:332) — ONE
     parent's own literal row count — never the union of distinct closed
     ids across both parents the amended (c) requires.
  2. `R-2: an indented checkbox row that is tasks-file.ts-visible must not
     be silently invisible to merge-invariants when dropped by a merge` —
     observed: the control row (`T-CTRL-01`, unindented) IS reported
     MISSING; the indented row (`T-IND-01`) is NOT — it produces zero
     findings at all. Root cause: `parseLedger` (:140-170) tests
     `VOID_PREFIX_RE` and the task regex against the raw, untrimmed `line`,
     so a leading-whitespace row never matches in ANY commit snapshot and
     is invisible to the whole-tree identity search from the start, not
     just at the merge.
  3. `Q-1: the informational COMPACTED breakdown dedups by task_id, matching
     the header count` — observed: header says "1 row(s)" (correctly
     deduped by task_id — `compacted.length` is already one entry per
     distinct id), but the `tasks.md § Legacy` breakdown line reads `2`
     (double-counted: one increment per parent occurrence). Root cause:
     `renderMergeInvariantsReport`'s breakdown loop (:447-457) iterates
     `c.occurrences` (one per parent) rather than `c.taskId` (one per
     distinct row).

No other test in the 2648-test suite is affected — the amendment is scoped
entirely to `tools/merge-invariants.ts`'s compaction-exemption/reporting
logic and touches no other module's contract.

## AC Execution Log

Not applicable — the spec's Acceptance Criteria carry `proof:` lines that
name this very test file's case titles (executed above), not separate
`proof:` shell commands to log independently. Phase 3.5: skipped (the
`proof:` annotations resolve to the Phase 3 test run already recorded
above, not a distinct AC-execution artifact).

## Verdict

**FAIL.** Routing to sr-engineer to implement the amended (c) union rule,
the R-2 line-trim alignment, and the Q-1 breakdown dedup in
`tools/merge-invariants.ts`, against the now-red tests above as the
executable spec of what "fixed" means. This is a spec-amendment gap, not a
deviation from the code's originally-approved contract — see "Why this is a
FAIL" above.
## 2026-09-26T17:12:31.109Z — FAIL — by qa-engineer

FAIL, not an implementation deviation. tools/merge-invariants.ts (eed6689, code-review APPROVED 66d81a6) predates the human-approved spec amendment e405de8, which tightened condition (c) of the Compaction exemption to a cross-parent UNION reconciliation (code-review round 1's own R-1 finding), required ledger-line trimming to match tools/tasks-file.ts (R-2), and required the informational COMPACTED breakdown to dedup by task_id (Q-1). test/e126-merge-invariants.test.mjs (new, 16 cases) + test/verify-release.test.mjs (VR-48/VR-49, AC10) + test/lane-paths.test.mjs (CALLERS2 append, closing the T-E126-01 expected-red) committed at 305a76a. Full suite (clean tree): 2645/2648 PASS, 3 FAIL. New file alone: 13/16 PASS. Red list (exact 3, nothing else affected): "AC11: a merge that compacts S while both parents added different closed rows exceeding the manifest count reports every row MISSING, exit 1 (R-1 5-vs-4 fixture)" (amended (c) union paragraph — current code checks per-parent, tools/merge-invariants.ts:332); "R-2: an indented checkbox row that is tasks-file.ts-visible must not be silently invisible to merge-invariants when dropped by a merge" (amended R-2 line-trim paragraph — parseLedger never trims, :140-170); "Q-1: the informational COMPACTED breakdown dedups by task_id, matching the header count" (amended Q-1 dedup requirement — breakdown counts occurrences not distinct ids, :447-457). All AC1-AC9, AC11 counter-examples (i)-(iii), and AC10 already PASS today, matching code-reviewer's T-E126-01..04 APPROVED verdict. See qa_reports/review_T-E126-05.md for the full spec-to-test map, root-cause line citations, and run evidence.

## Round 2 (final) — PASS — by qa-engineer

covers: T-E126-01, T-E126-02, T-E126-03, T-E126-04, T-E126-05, T-E126-06

Contract: `specs/e126-merge-invariants.md`, human-approved amendment
`e405de8` (unchanged since round 1). Code under test: sr fix `d0eaa65`
(union-based (c), R-2 line-trim, Q-1 dedup; deletes the now-closed
`qa_reports/expected-red_e126-merge-invariants.txt`). Code-review round 2:
APPROVED at `29abe8c` (`review_reports/review_T-E126-01.md` `## Round 2`) —
verified the union fix, the (d)/(a)/(b) per-parent split, the trim
alignment, and the dedup breakdown; no required findings.

### Known residual (out of scope this round, human decision)

Code-review round 2's R2-1 finding — the (c) union `U` still counts closed
`task_id`s that are PRESENT at the merge, so a lane compacting a section
while main concurrently closes a *different* row under the same section
name produces a loud false MISSING/LOST_DONE (nothing is actually lost;
repro: 3 `[x]` compacted under a manifest of 3, plus a concurrent
`- [x] T-D-01` kept by the merge under the same section -> `U`=4 > 3,
exit 1). This is a spec-level gap (the amended (c) as literally worded
allows found rows into `U`), not an implementation defect against the
approved text, and it predates this round's delta (round 1's per-parent
version had the same shape). Per the lane's human decision, this is
recorded as **pending ticket E126-NEW-2**
(`.current/e126/pending-tickets.md`, commit `5e4d7d9`) and deferred
post-v4. It is explicitly OUT OF SCOPE for T-E126-01..06 and does **not**
fail this round. Verified read-only against 25 of the most recent real
primary-repo merges (`ed7432f` back to `e784a3b`): all 25 exit 0, 0
MISSING, 0 LOST_DONE, 0 SIDECAR_SHORTFALL — the false-positive shape has
not occurred in real history.

### Phase 0.5 — Expected-Red Diff

`qa_reports/expected-red_e126-merge-invariants.txt` no longer exists (sr
deleted it in `d0eaa65` — round 1's sole manifest entry was closed by that
round's own fix). Phase 0.5: skipped (no expected-red manifest declared).

### Phase 1 / 3a / 3b — Review, Copy Audit, Visual Audit

Correctness/architecture/security/performance are code-reviewer's scope and
already APPROVED round 2 (`review_reports/review_T-E126-01.md`). Spec's
`## Copy / Strings` and `## Visual Tokens` tables are both explicitly `N/A`
("CLI/tooling feature ... no visual literals") — Copy Audit Gate and Visual
Audit Gate: N/A, nothing to grep.

### Phase 1.5 — Visual Compare

`design/e126-merge-invariants.md` does not exist and the spec's `## Visual
Widgets` table is `N/A`. Phase 1.5: skipped (no Visual Baselines declared).

### Phase 3 — Tests (unchanged from round 1, re-verified green)

`test/e126-merge-invariants.test.mjs` (16 cases) and `test/verify-release.test.mjs`
(VR-48/VR-49) are unchanged since round 1's commit `305a76a` — no test-file
edits were needed this round; the sr fix turned the 3 previously-red cases
green. Full AC -> test map (spec `## Task -> AC Coverage`, authoritative):

| AC | test | result |
|---|---|---|
| AC1 | e126-merge-invariants.test.mjs: "AC1: row dropped by a bad merge is reported MISSING" | PASS |
| AC2 | e126-merge-invariants.test.mjs: "AC2: [x] regressed to [ ] across a merge is reported" | PASS |
| AC3 | e126-merge-invariants.test.mjs: "AC3: sidecar record shortfall is reported with counts" | PASS |
| AC4 | e126-merge-invariants.test.mjs: "AC4: a row relocated by migration/finish --shipped is not a false MISSING" | PASS |
| AC5 | e126-merge-invariants.test.mjs: "AC5: every offending MISSING/LOST_DONE/SIDECAR_SHORTFALL item is printed, exit 1" + independent CLI proof (below) | PASS |
| AC6 | e126-merge-invariants.test.mjs: "AC6: non-merge commit exits NOT_A_MERGE_COMMIT" + independent CLI spot-check (below) | PASS |
| AC7 | e126-merge-invariants.test.mjs: "AC7: unrelated histories exit NO_MERGE_BASE" | PASS |
| AC8 | e126-merge-invariants.test.mjs: "AC8: clean merge exits 0" + independent CLI spot-check on `ed7432f` (below) | PASS |
| AC9 | e126-merge-invariants.test.mjs: "AC9: bad ref / non-repo / usage errors exit USAGE_ERROR" + independent CLI spot-check (below) | PASS |
| AC10 | verify-release.test.mjs: VR-48, VR-49 | PASS |
| AC11 (clean) | "AC11: a real compaction merge exits 0 with an informational COMPACTED count" | PASS |
| AC11 (i) | "AC11: an open row dropped under a compaction marker is MISSING, exit 1" | PASS |
| AC11 (ii) | "AC11: a failed count reconciliation lists every un-found row of that section by task_id, exit 1" | PASS |
| AC11 (iii, R1) | "AC11: a row added under an already-compacted section name is MISSING when dropped, exit 1 (R1 counter-example)" | PASS |
| AC11 (iv, R-1 union) | "AC11: a merge that compacts S while both parents added different closed rows exceeding the manifest count reports every row MISSING, exit 1 (R-1 5-vs-4 fixture)" | **PASS (was expected-red round 1, now green)** |
| R-2 | "R-2: an indented checkbox row that is tasks-file.ts-visible must not be silently invisible to merge-invariants when dropped by a merge" | **PASS (was expected-red round 1, now green)** |
| Q-1 | "Q-1: the informational COMPACTED breakdown dedups by task_id, matching the header count" | **PASS (was expected-red round 1, now green)** |

Coverage gate: all 11 spec ACs map to >= 1 passing test; 80%+ line coverage
is implicit (every branch of `tools/merge-invariants.ts` is exercised by
fixture repos per the code-reviewer's own line-by-line AC Completeness
trace, round 1 and round 2). Security smoke: AC9 covers bad-ref/non-repo/
malformed-option boundary inputs; the tool is read-only (no auth surface).

### Phase 3.5 — AC Execution Log

Spec ACs carry `proof:` annotations; most name this test file's own case
titles (executed above, under Phase 3). AC5, AC6/AC8, and AC9 additionally
name literal shell commands — executed independently below, against a
clean tree, from `<lanes-root>/e126`:

- **AC8/AC11 sanity** — `node scripts/merge-invariants.mjs ed7432f <repo-root>`
  -> `RESULT: PASS — all three invariants held`; `946 task_id(s) at parents
  — 29 present, 917 COMPACTED, 0 MISSING`; exit `0`. Matches spec's Sanity
  Check target exactly (917 COMPACTED, 0 MISSING).
- **AC6** — `node scripts/merge-invariants.mjs fe2d688 <repo-root>`
  -> `NOT_A_MERGE_COMMIT — fe2d688 (fe2d688) has 1 parent(s); exactly 2
  required (octopus merges are unsupported)`; exit `2`.
- **AC9** — `node scripts/merge-invariants.mjs bogus-ref-xyz <repo-root>`
  -> `cannot resolve ref "bogus-ref-xyz" to a commit` + usage message on
  stderr, no raw stack trace; exit `4`.
- **AC5** — constructed a throwaway git fixture in `$TMPDIR` (base commit
  with `T-X-01 [x]` + `T-X-02 [ ]` under `## Active`; two child commits
  each adding an unrelated file; `git merge` the two children, then
  `git commit --amend` the merge to drop both `tasks.md` rows — a "bad
  merge" that lost a row and a completion while keeping both children's
  unrelated files). Ran `node scripts/merge-invariants.mjs <merge-sha>
  <fixture-repo>` -> printed one line per offending item (`MISSING T-X-01`,
  `MISSING T-X-02`, `LOST_DONE T-X-01`) plus a tallied `RESULT: FAIL — 3
  offending item(s): 2 MISSING, 1 LOST_DONE, 0 SIDECAR_SHORTFALL`; exit
  `1`. Confirms AC5's "never a single FAIL line" requirement. Fixture
  deleted immediately after (never touched this repo's working tree).

All four executed proofs match their AC's stated outcome exactly. No proof
was un-runnable.

### Phase 4 — Run (clean tree throughout; `git status --short` empty before and after)

- `npm run build` — `tsc` exit 0; `check:version` OK (3.118.0); dist matches
  fresh build (also independently confirmed by code-reviewer round 2).
- `npm audit --audit-level=high` — exit 0; 6 pre-existing dependency
  advisories (2 low, 4 moderate — body-parser, esbuild, hono, protobufjs,
  qs), none high/critical, none introduced by this feature (no new
  dependencies added by T-E126-01..06).
- `node --test test/e126-merge-invariants.test.mjs` — **16/16 PASS**.
- `node --test test/verify-release.test.mjs` — **61/61 PASS**.
- `npm test` (full suite) — **2648/2648 PASS**, 0 fail, 0 cancelled, 0 skipped.
- CLI spot-checks: see AC Execution Log above (`ed7432f` exit 0, `fe2d688`
  exit 2, `bogus-ref-xyz` exit 4, constructed bad-merge exit 1) — all match
  expected behavior.

### Verdict

**PASS.** T-E126-01 through T-E126-06 all satisfy their owned ACs per the
spec's `## Task -> AC Coverage` table. Every AC1-AC11 maps to >= 1 passing
test (table above), all four independently-executed shell-command proofs
match their AC, the full suite is green at 2648/2648, and the build/audit
gates are clean. code-reviewer round 2 APPROVED with no required findings.
The one recommended finding (R2-1) is a known, spec-level residual —
recorded as pending ticket E126-NEW-2, deferred post-v4 per human decision,
and does not block this PASS.

## 2026-09-26T17:30:01.090Z — PASS — by qa-engineer

QA round 2 (final) PASS — T-E126-01..06 against specs/e126-merge-invariants.md (Task -> AC Coverage table authoritative). sr fix d0eaa65 (union-based (c), R-2 trim, Q-1 dedup) closed all 3 round-1 reds; code-review round 2 APPROVED 29abe8c, no required findings. Clean tree throughout. npm run build: tsc 0 errors. npm audit --audit-level=high: exit 0 (6 pre-existing low/moderate advisories, none high/critical, none introduced by this feature). node --test test/e126-merge-invariants.test.mjs: 16/16 PASS. node --test test/verify-release.test.mjs: 61/61 PASS. npm test (full suite): 2648/2648 PASS. All AC1-AC11 map to >=1 passing test (see qa_reports/review_T-E126-05.md Round 2 table). Phase 3.5 AC Execution Log: 4 literal shell-command proofs independently re-executed — ed7432f exit 0 (946 ids, 29 present, 917 COMPACTED, 0 MISSING, matches spec Sanity Check); fe2d688 (non-merge) exit 2; bogus-ref-xyz exit 4; a constructed bad-merge fixture in $TMPDIR (never touching this repo's tree, deleted after) exit 1 with 3 individually-listed offending items (2 MISSING, 1 LOST_DONE) confirming AC5's "never a single FAIL line." Phase 0.5: skipped (expected-red manifest was closed and deleted by sr's fix). Phase 1.5 / Copy / Visual audits: N/A per spec (CLI/tooling feature, no visual literals, no design/<feature>.md). KNOWN RESIDUAL (out of scope, does not fail this round): code-review round 2's R2-1 — the amended (c) union still counts closed task_ids still PRESENT at the merge, producing a loud false MISSING/LOST_DONE when a lane compacts a section while main concurrently closes a different row under the same section name (nothing is actually lost). Human decision (lane session) recorded this as pending ticket E126-NEW-2 (.current/e126/pending-tickets.md, commit 5e4d7d9), deferred post-v4. Verified read-only against the 25 most recent real primary-repo merges: all 25 exit 0, 0 MISSING/LOST_DONE/SIDECAR_SHORTFALL — the false-positive shape has not occurred in real history. Full detail: qa_reports/review_T-E126-05.md ## Round 2 (final).

