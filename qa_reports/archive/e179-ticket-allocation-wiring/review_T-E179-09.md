# Review — T-E179-09

covers: T-E179-09, T-E179-10, T-E179-11, T-E179-12, T-E179-17

## Round 1 — qa-engineer, Phase A (test-authorship + goldens only — no PASS, no tw_complete_task)

## Scope

sr's round (review_reports/review_T-E179-02.md, code-reviewer APPROVED) implemented
AC1-AC10 of specs/e179-ticket-allocation-wiring.md. This round is QA's
test-authorship pass over that implementation, plus the qa-owned golden
re-baseline for T-E179-15's prose edit (AC8). Per the coordinator's dispatch
brief, this is phase A only: AC5's own-lane-only reading (E179-NEW-2 option
(a), human ruling 2026-09-25) and the reviewer's R1 land in the NEXT sr round,
so proof (4) below is written now and is genuinely, expectedly red.

Files touched this round (all test/ or qa_reports/, no production code):
- test/lane-ticket-allocation.test.mjs (T-E179-09: AC6 R1, AC7 (b), AC9)
- test/lane-paths.test.mjs (T-E179-10: AC1)
- test/lane-migrate.test.mjs (T-E179-12: AC10 + fixed the 7 T-E179-02 reds)
- test/agc-feature-lifecycle.test.mjs (T-E179-11: AC2/AC3/AC4, G1-G4, the
  error-refusal precondition, AC5 proofs (1)-(4))
- test/context-budget.test.mjs (T-E179-17: raised the one floor T-E179-15's
  prose edit pushed)
- test/fixtures/compose-golden/skill-coordinator-monolith.txt (T-E179-17:
  re-baselined)
- qa_reports/expected-red_e179-ticket-allocation-wiring.txt (updated)

## Phase 0.5 — Expected-Red Diff

Manifest present (qa_reports/expected-red_e179-ticket-allocation-wiring.txt,
sr-authored). Ran the full suite BEFORE any re-baseline edit:
`node --test test/*.test.mjs` -> 2485 tests, 2475 pass, 10 fail. The 10 reds
were exactly the manifest's 10 entries (8 lane-paths/lane-migrate LANE_FILES-
count tests + context-budget AC8/AC-P2-7 teamwork bundle + skill-manifest
t-golden-byte-identity). Diff: clean, 0 unexplained reds. Disposition: all 10
are this round's own job to fix (T-E179-10/T-E179-12 for the 8, T-E179-17 for
the 2), not pre-existing unrelated flakes.

After the fixes below, re-ran the full suite: 2517 tests, 2516 pass, 1 fail —
the fail is `test/agc-feature-lifecycle.test.mjs`'s new AC5 proof (4), which
this round's own updated manifest now records (see below) — a genuine,
expected regression against the CURRENT (pre-next-round) implementation, per
the human's 2026-09-25 ruling on E179-NEW-2, not a disposition-away case.

## Fixes landed this round (T-E179-10 / T-E179-12)

- test/lane-paths.test.mjs REG1: LANE_FILES now has 6 entries (1 required +
  5 optional, pendingTickets added). Updated the count/filename-list
  assertions; added 3 new AC1-specific tests (registry entry shape,
  resolveLanePaths/resolveFlatLanePaths both expose pendingTicketsPath).
- test/lane-migrate.test.mjs: the shared `seedAllFiveFiles` fixture helper
  (used by FL1/REV1/AC5-DEBRIS1-4/RT1) now also seeds pending-tickets.md, so
  the dynamically-derived `ALL_FILENAMES`/`OPTIONAL_FILENAMES` arrays those 7
  tests already compare against line back up with the registry's new count
  with no other change needed. Added 5 new AC10 tests: present-only-at-flat
  moves like any optional sidecar; matching-content at both ends drops (never
  merges); conflicting-content at both ends refuses in BOTH directions with
  no data loss; round-trips lane->flat. Confirms sr's `isAppendLog` gate
  correctly excludes pending-tickets.md from the JSONL sidecar-merge branch.

## AC Execution Log

Every `proof:` line below was run via `node --test <file>` (T-E179-09/10/12)
or the black-box `runAgc`/`runAgcCheck` CLI harness against scratch git repos
under `os.tmpdir()` (T-E179-11), never against this repo's own tracked state
or `agc feature finish` on the real worktree/primary (per the dispatch
brief's explicit prohibition).

- **AC1** `node --test test/lane-paths.test.mjs` -> 57/57 pass (registry
  entry, both path resolvers).
- **AC2 proof** (2 sub-cases + preconditions (a)/(b)/(c)):
  `node --test test/agc-feature-lifecycle.test.mjs` -> new tests "AC2 proof
  (1)" through "AC2 precondition (c)" all pass. (1) confirmed 2 entries
  allocated E2/E3, committed on --base, branch deleted, pending file archived
  on main. (a) wrong-primary-branch refuses, backlog/branch/worktree
  untouched. (b) dirty docs/backlog.md refuses, edit preserved verbatim,
  nothing else mutated. (c) an unrelated staged file survives a SUCCESSFUL
  apply commit (path-limited commit proven, not just claimed).
- **Error-refusal precondition** (3 cases, one per class + the abandoned
  repeat): "Error-refusal (1)" combines a malformed block with a wrong
  primary branch and asserts the CONTENT error wins (branch-mismatch text
  absent) — proves the ordering, not just the individual refusal.
  "Error-refusal (2)" combines an unresolvable depends_on with a dirty
  primary and asserts the DEPENDENCY error wins. "Error-refusal (3)" repeats
  both classes under `--abandoned` (unmerged branch, read via `git show`),
  same refusal, nothing committed. All pass.
- **AC3 proof**: "AC3: finish --abandoned applies pending tickets
  identically..." — 2 entries allocated on an UNMERGED branch, backlog
  commit lands on --base, branch's own pending file (read via
  `git show refs/heads/<branch>:...`, never fs) shows both archived, branch
  kept, worktree removed. Pass.
- **AC3(a) G4 ordering proof**: "AC3(a) G4 ordering: a dirty lane worktree
  ... refuses BEFORE the primary-side backlog-append commit runs" — asserts
  docs/backlog.md on main is byte-unchanged after the refusal. Pass.
- **AC3(b) G4 idempotency proof**: "AC3(b) G4 idempotency: a re-run after a
  simulated partial failure..." — pre-seeded a backlog row bearing the exact
  provenance parenthetical `formatBacklogRow`/`findAppliedProvenance` share,
  then re-ran `--abandoned`; asserted 0 new rows, the "already applied,
  skipping" stdout line naming the skipped id and its backlog row, and the
  branch-side archive still completing despite `onBase` being false. Pass.
- **AC4 proof**: "AC4: sequential finishes for two lanes allocate disjoint id
  ranges..." — two lanes cut from the same base, finished as two SEPARATE
  process invocations (matching real usage); asserted E2 then E3, and E2
  appears exactly once (never re-minted by the second, fresh-process run).
  Pass.
- **AC5 proofs (1)-(3)**: "AC5 proof (1)" (orphan surfaced, exit 0),
  "AC5 proof (2)" (byte-identical warning from primary vs. a different live
  lane's own worktree), "AC5 proof (3)" (a live worktree with unapplied
  entries is never an orphan). All pass.
- **AC5 proof (4)** (E179-NEW-2 option (a), human ruling 2026-09-25): a
  branch forked while ANOTHER lane's unapplied pending-tickets.md already
  sits on base, with no live worktree of its own, must NOT be flagged and
  must never name the other lane. **FAILS** against the current
  `checkOrphanLanes` (bin/agc-init.mjs), which still ORs every
  `.current/<lane>/` the branch's tree carries rather than reading only
  `resolveCurrentLane(branch)`'s own lane — actual stderr names the forked
  branch and suggests `finish --abandoned e999` (the OTHER lane's id).
  Recorded in the updated expected-red manifest; the fix (own-lane-only scan
  + `detectOrphanLanes` docstring update) is the next sr round's job per the
  dispatch brief.
- **AC6 (ruling R1)**: 3 new tests, `opts` omitted / empty
  `appliedLaneLocalIds` / matching `appliedLaneLocalIds`, per the spec's own
  3-case proof. All pass, including the E124 `:342` no-regression pin.
- **AC7 (ruling (b))**: 3 new tests — `unclosed-at-eof`, the reviewer's own
  `closes-enclosing-fence` repro (asserts the message names BOTH the
  swallowed opener's line and the enclosing fence's own opening line), and
  the legitimate 4-backtick-enclosing-3-backtick nesting case (silent). All
  pass.
- **AC9**: grep proof (`~{3,}`, `comma-separated`, `isSafeInteger(next)` all
  absent from live code) plus 2 behavioural probes (a tilde-fenced block is
  now inert; a comma-separated `depends_on` string is one literal reference,
  not split). All pass.
- **AC10**: 5 new tests in test/lane-migrate.test.mjs (see "Fixes landed"
  above). All pass.
- **AC11** (partial, qa's half): `node scripts/capture-constitution-golden.mjs`
  regenerated all 12 fixtures; `git diff --stat` shows exactly ONE fixture
  changed (`skill-coordinator-monolith.txt`, +2 lines — the AC8 prose
  paragraph, nothing else) — diff-verified minimal. Raised exactly the one
  context-budget floor T-E179-15's edit pushed (19284 -> 19408, +124 ~tok;
  the other three AC8/AC-P2-7 floor tests in that file were re-confirmed
  untouched). `T-E179-18` (the post-commit full-suite gate) is out of scope
  for this uncommitted-tree round per lane protocol §3 — deferred to the next
  qa round after sr's AC5 fix + the reviewer's R1 land and the tree is
  committed.

## Copy Audit Gate (Phase 3a)

- `finish.applied-summary`: implementation's `printAppliedSummary` emits
  `agc feature finish — applied ${N} pending ticket(s): ${ids.join(", ")}` —
  matches the spec's Copy/Strings table verbatim.
- `finish.applied-none`: silent no-op when `allocated.length === 0` — matches.
- `check.orphan-warning`: the spec's own table explicitly marks this entry
  "exact wording is sr-engineer's to finalize within that style, this is the
  intent/shape" — not a verbatim requirement. sr's actual wording
  (`bin/agc-init.mjs`'s `checkOrphanLanes`) differs in phrasing from the
  table's illustrative text but matches its intent and the house
  `agc check — warning: ...` style (`checkWorktreeEvidence` precedent). No
  drift, no coverage gap.

No new user-facing string was introduced outside the spec's table — no
coverage gap to escalate to PM.

## Visual Audit Gate / Phase 1.5

N/A — spec's own Visual Tokens/Visual Widgets tables are both explicitly
"N/A" (backend CLI + governance-prose feature, no visual literals). No
`design/e179-*.md` exists. Both gates skipped per their own absent-branch
rule; logged here for the record.

## Suite numbers (this round's end state)

`node --test test/*.test.mjs` (uncommitted tree): **2517 tests, 2516 pass,
1 fail** — the sole fail is the newly-authored, expected-red
`test/agc-feature-lifecycle.test.mjs`'s "AC5 proof (4)" (E179-NEW-2 option
(a)). No other regression anywhere in the suite. This is NOT a PASS-eligible
state (by design — phase A only, no tw_complete_task, no PASS write): AC5's
own-lane-only fix + code-reviewer's R1 land in the next sr round, then a
final qa round re-verifies proof (4) turns green and runs the committed-tree
full suite (T-E179-18) before any PASS.
## 2026-09-25T07:47:22.403Z — PASS — by qa-engineer

Final QA (hop 10, cap). Committed-tree (aae9d62) full suite: 2517/2517 pass. Build clean (tsc, check:version, check:transitions-sync OK, no dist drift). npm audit --audit-level=high exit 0 (6 pre-existing moderate/low transitive vulns, 0 high/critical). check:md-tables OK (279 files, 0 malformed; 4 pre-existing E88 advisories unrelated). AC5 proof (4) re-verified green (51/51 in test/agc-feature-lifecycle.test.mjs) against sr round-2 own-lane-only fix, confirming code-reviewer round-2 APPROVED delta. Retitled the AC5 proof (4) test (dropped stale "EXPECTED RED" clause) per reviewer's optional nit -- qa-owned, non-committed change in test/agc-feature-lifecycle.test.mjs, alongside the append-only NEW-TICKETS.md; coordinator to commit. Evidence: qa_reports/review_T-E179-18.md (covers all 12 live tasks; T-E179-01 architect blueprint named, no verdict needed).

