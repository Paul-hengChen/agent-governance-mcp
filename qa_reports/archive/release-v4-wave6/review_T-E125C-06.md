# Review — T-E125C-05 / T-E125C-06

covers: T-E125C-01, T-E125C-02, T-E125C-03, T-E125C-04, T-E125C-05, T-E125C-06

Prior hop: code-reviewer APPROVED T-E125C-01..04 (`review_reports/review_T-E125C-04.md`, commit `3285a3a`). This
review covers QA's own two tasks (T-E125C-05 test authorship, T-E125C-06 budget/goldens check) and closes out the
whole ticket (T-E125C-01..04 close on QA's PASS per the chain contract — code-reviewer already independently
re-verified all 14 ACs; this pass does not re-litigate Correctness/Architecture/Security/Performance, only test
coverage + spec-mapped acceptance evidence per QA's Constitution §3 scope).

## Phase 0.5 — Expected-Red Diff

Phase 0.5: skipped (no `qa_reports/expected-red_e125c-index-compaction.txt` manifest declared; `dispatch_mode` is
absent from handoff state, i.e. feature mode, not bugfix).

## Phase 1.5 — Visual Compare

Phase 1.5: skipped (no `design/e125c-index-compaction.md` file; spec's Visual Tokens / Visual Widgets tables are
both `N/A` — feature has no visual literals).

## Copy Audit Gate (3a)

All six spec Copy/Strings entries verified verbatim against the actual implementation output (not the spec's
restatement of them):

| string id | verified against | result |
|---|---|---|
| `e125c.compacted-comment` | `.current/_primary/tasks.md:9` | byte-verbatim, all four interpolated fields correct (67 sections, 891/26 rows, date, pre-compaction sha `165b72d`) |
| `e125c.summary-line` | `.current/_primary/tasks.md:10-76` (67 lines) | byte-verbatim format, heading text matches original headings exactly, no checkbox prefix (confirmed no task-pattern parser mis-matches it) |
| `e125c.compacted-heading` | `.current/_primary/tasks.md:8` (`## Compacted History`) | verbatim |
| `e125c.7a-writeback` | `content/skill-release-engineer.md:198` | all five AC12 clauses (a)-(e) present; `grep -c 'git log -i --grep'` = 1, `grep -c 'history index'` = 1 |
| `e125c.pm-ledger` | `content/skill-pm.md` | bootstrap wording removed (`grep -c 'bootstrap .tasks.md. directly\|create it directly'` = 0), lane-local ledger referenced (`grep -c '.current/<lane>/tasks.md'` = 2), final-reply string `Done. Tasks in tasks.md.` unchanged |
| `e195.refuse-changed` | `tools/tasks-lane-migrate.ts:563` | unchanged: `... body changed since the forward migration` |

No drift, no coverage gap.

## Visual Audit Gate (3b)

N/A — spec's Visual Tokens table is `N/A` (feature has no visual literals). No hard-coded literal introduced by
this diff falls outside that (data/prose-only feature).

## Spec-to-Test Map

New file `test/e125c-index-compaction.test.mjs` (12 cases). AC7-AC9 and AC12-AC14 are proved by
`.current/e125c/compaction-procedure.md` (sr's evidence) plus the independent re-checks in the AC Execution Log
below — no new test cases for those (per T-E125C-05's dispatch brief, only AC1-AC6/AC10/AC11 needed new test code).

| AC | test case(s) |
|---|---|
| AC1 | "AC1 identity round trip" |
| AC2 | "AC2 closed-lanes carry" (trailing-CL case), "AC2 closed-lanes carry" (non-trailing-CL case) |
| AC3 | "AC3 removed markers" |
| AC4 | "AC4 hand-edit refuses" |
| AC5 | "AC5 legacy receipt" |
| AC6 | "AC6 double round trip", "AC6 forward unchanged without CL" (marker-free case), "AC6 forward unchanged without CL" (marker-bearing case, disclosed F1) |
| AC7-AC9 | `.current/e125c/compaction-procedure.md` (sr's evidence) — independently re-derived from git history below (AC Execution Log) |
| AC10 | "AC10 real-data round trip" |
| AC11 | "AC11 consumer parity" |
| AC12-AC14 | grep/golden checks below (AC Execution Log) — no test-file case, matching each AC's own `proof:` (a shell command, not a `node --test` case) |
| F2 (reviewer finding, review_T-E125C-04.md, filed E125c-NEW-5) | "F2 (pinned known behaviour, not a failure)" — pinned per dispatch brief, not counted as a spec AC |

`test/e125a-lane-local-ledgers.test.mjs` run **unmodified**: 36/36 green (AC6 integrator condition (i)).
`test/context-budget.test.mjs` **untouched** — see T-E125C-06 below.

Coverage gate: the new file is 100% acceptance-criteria-driven (every case maps to a numbered AC or a disclosed
review finding); line coverage on the touched `tools/tasks-lane-migrate.ts` surface (the new normalization/receipt
helpers) is exercised by both this file and the untouched e125a suite — no uncovered branch found while writing
these cases (every `refuse(...)` call site in the reverse runners is hit by either suite).

Security smoke: boundary inputs exercised incidentally by the fixtures above — empty ledger sections, a
marker-shaped-but-fabricated line (F2 test), a hand-edited row (AC4). No auth/permission surface in this feature
(local governance files only, already noted by code-reviewer's Security section).

## AC Execution Log

Every `proof:`-annotated AC in `specs/e125c-index-compaction.md` (all of AC1-AC14 carry one), executed and
recorded before PASS, independently (not copied from sr's or code-reviewer's own numbers where a command was
cheap to re-run):

- **AC1** — `node --test test/e125a-lane-local-ledgers.test.mjs` (unmodified, e125a's own AC7 case) — 36/36 pass.
  Plus `node --test test/e125c-index-compaction.test.mjs` case "AC1 identity round trip" — pass.
- **AC2** — case "AC2 closed-lanes carry" (both sub-cases) — pass.
- **AC3** — case "AC3 removed markers" — pass.
- **AC4** — case "AC4 hand-edit refuses" — pass.
- **AC5** — case "AC5 legacy receipt" — pass.
- **AC6** — cases "AC6 double round trip", "AC6 forward unchanged without CL" (both sub-cases) — pass.
- **AC7** — re-derived independently from git history (not copied from `.current/e125c/compaction-procedure.md`):
  ```
  pre-compaction ## sections (_primary): 70
  pre rows: done=905 voided=28 open=0
  post rows (_primary ledger): done=14 voided=2 open=0
  kept set present in post ledger: true
  kept set count == 3, all in pre-headings: true; compacted = 67
  summary lines: 67  sumDone: 891  sumVoid: 26
  kept rows in post ledger: done=14 voided=2 open=0
  done sum check: 891+14=905 == pre done 905 -> true
  void sum check: 26+2=28 == pre voided 28 -> true
  ```
  Matches spec exactly: 70 = 3 kept + 67 compacted; (905 − 14)=891 and (28 − 2)=26 summarized; 0 open before/after.
- **AC8** — re-derived independently:
  ```
  root startsWith sentinel+notice: true
  primaryIndexReceiptSha(rootBody) === sha256(ledgerBody): true
  receipt.bodySha256 === sha256(ledgerBody): true
  rootBody startsWith ledgerBody: true
  rootBody after ledgerBody starts: "\n## Closed Lanes\n\n<!-- lane_closed: ticket=e125b branch=feat..."
  ```
  `grep -c 'lane_closed: ticket=e125b' tasks.md` = 1. Matches AC8 exactly.
- **AC9** — re-derived independently: no `## e125b*` / `## e123c*` (or any live/history lane) heading found under
  `.current/_primary/tasks.md`'s 70 pre-compaction sections; X7 = 0. Matches sr's own procedure-file figure.
- **AC10** — case "AC10 real-data round trip" (reads the repo's CURRENT on-disk `tasks.md` /
  `.current/_primary/tasks.md` / `.current/tasks-index-receipt.json` into a `$TMPDIR` copy — never `git show`,
  see note below) — pass.
- **AC11** — case "AC11 consumer parity" — pass (14 rows across exactly the 3 kept sections;
  `allComplete: true`; `emitFeatureMetrics` tickets for `e125a-lane-local-ledgers` = 7).
- **AC12** — `grep -c 'git log -i --grep' content/skill-release-engineer.md` = 1;
  `grep -c 'history index' content/skill-release-engineer.md` = 1. Both ≥ 1 — pass.
- **AC13** — `grep -c 'bootstrap .tasks.md. directly\|create it directly' content/skill-pm.md` = 0;
  `grep -c '.current/<lane>/tasks.md' content/skill-pm.md` = 2 (≥ 1) — pass.
- **AC14** — `node scripts/capture-constitution-golden.mjs && git diff --stat -- test/fixtures/compose-golden/`
  → captured 12 fixtures, **zero diff, zero untracked files** under that path. Budget floor: see T-E125C-06 below
  — no floor moved (none was pushed). `npm test` green after commit with zero untracked files — see Phase 4 below.

**Hermetic-fixture note (E77)**: the first draft of "AC10 real-data round trip" read the committed files via
`git show HEAD:<path>`, which trips `test/render-structure.test.mjs`'s T-E77-02 meta-test (no `test/` file may read
repo history as a fixture — `git show`/`git log`/pinned-sha are all flagged, `HEAD` included, since the predicate
gates on the `show`/`log` subcommand, not on which ref is used). Fixed before this PASS: it now reads the same
paths straight off disk via `fs.readFileSync` relative to the repo root — equivalent content (working tree is
clean for all three paths, confirmed by `git status --short` showing no modification to `tasks.md`,
`.current/_primary/tasks.md`, or `.current/tasks-index-receipt.json` throughout this QA pass), zero git history
reads. `test/render-structure.test.mjs`'s two T-E77-02 cases both pass post-fix.

## T-E125C-06 — context budget / goldens

- **Goldens**: `node scripts/capture-constitution-golden.mjs && git diff --stat -- test/fixtures/compose-golden/`
  → 12 fixtures captured, **empty diff** (no file changed). AC14 satisfied.
- **skill-pm cap**: independently re-measured (not trusted from the review report's own citation) via
  `stripRationale(stripOriginTags(expandSkill(body)))` on the current `content/skill-pm.md` (post-AC13 edit):
  **4392 ~tok**, cap is `≤ 4401` (9-token headroom). AC13's edit (bootstrap-wording removal + lane-local-ledger
  wording) is a net-small change and does NOT push the existing floor.
  Per the dispatch brief and spec AC14 ("the only budget floor moved is the one actually pushed, else leave
  context-budget untouched") — **no floor is pushed. `test/context-budget.test.mjs` is left untouched.**
  `node --test test/context-budget.test.mjs` — all cases green, including
  "AC1/AC2: skill-pm stripped token count meets ≤ 4376 cap" (title stale from an earlier bump, live assert
  correctly reads `<= 4401`; pre-existing drift, not introduced by this ticket — not touched here per scope
  (Out of Scope: qa's own test/context-budget.test.mjs edit is authorized only if a floor moves, which it does
  not)).

## Phase 4 — Run

- `npx tsc --noEmit` — clean, zero errors.
- `npm run build` — clean (`check:version`, `tsc`, `check:transitions-sync` all OK; version 3.118.0, no bump
  needed at this hop — release-engineer's job post-PASS).
- Committed `test/e125c-index-compaction.test.mjs` and this file (`git status --short` shows zero untracked
  files after the commit; the pre-existing modified `.current/e125c/*` bookkeeping files and
  `specs/e125c-index-compaction.md` (integrator's F1-condition amendment) are left as-is — not QA's artifacts to
  commit, per this repo's ownership convention (release-engineer step 13a stages `.current/<lane>/*`; the spec
  amendment is the integrator's own edit)).
- **Full `npm test`: 2630/2630 pass, 0 fail.** (First run surfaced 1 failure — the E77-02 hermetic-fixture
  meta-test, tripped by AC10's original `git show HEAD:<path>` implementation; fixed as described above, re-run
  green.)
- `test/e125a-lane-local-ledgers.test.mjs`: 36/36 green, unmodified (byte-for-byte same file as before this
  ticket).

## Verdict

**PASS** — T-E125C-01..06. All 14 spec ACs independently re-verified (test cases for AC1-6/AC10/AC11; re-derived
counts for AC7-9; grep/golden checks for AC12-14); zero regressions; one E77 hermetic-fixture defect found and
fixed in QA's own new test file before commit (not a defect in sr's or code-reviewer's work — it was introduced
by QA's first draft and corrected within this same pass); `test/context-budget.test.mjs` correctly left untouched
(no floor pushed, independently re-measured at 4392/4401); goldens unchanged; e125a suite unmodified and green.
## 2026-09-25T18:17:21.363Z — PASS — by qa-engineer

PASS T-E125C-01..06. All 14 spec ACs verified: AC1-6/AC10/AC11 by new test/e125c-index-compaction.test.mjs (12 cases, all green); AC7-9 independently re-derived from git history (70=3 kept+67 compacted, row-sums match, 0 open before/after, X7=0); AC12-14 by grep/golden checks (goldens empty diff; skill-pm re-measured 4392/4401 tok, no floor pushed, context-budget left untouched per spec AC14). e125a suite run unmodified: 36/36 green. One E77 hermetic-fixture violation found in QA's own first draft (AC10 used `git show HEAD:<path>`) and fixed in the same pass (now plain fs reads) before commit. Full npm test 2630/2630 green pre- and post-commit, tsc/build clean, zero untracked files after commit (495f941). See qa_reports/review_T-E125C-06.md for the full AC Execution Log and Copy Audit Gate detail.

