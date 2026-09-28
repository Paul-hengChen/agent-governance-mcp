# Review — T-E110-03

covers: T-E110-01, T-E110-02, T-E110-03

## Verdict — PASS — by qa-engineer

Final QA verdict for feature `e110-pm-parallel-lane-template` against
`specs/e110-pm-parallel-lane-template.md` AC1-AC8. code-reviewer APPROVED
T-E110-01/02 (`review_reports/review_T-E110-01.md`). This doc covers Phase
0.5, the AC1-AC5/AC8 re-verification, T-E110-03's own re-baseline work, and
the Phase 3.5 AC Execution Log for AC1-AC8.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e110-pm-parallel-lane-template.txt` (6 entries).

Ran the full suite BEFORE any re-baseline edit (`npm test` in
`<lanes-root>/e110`): **pass 2228 / fail 6**. The 6 failures
are exactly the manifest's 6 entries, confirmed by name:

1. `test/context-budget.test.mjs` — "AC1/AC2: skill-pm stripped token count meets ≤ 4128 cap"
2. `test/context-budget.test.mjs` — "AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 18982 ~tok)"
3. `test/skill-manifest.test.mjs` — "t-golden-byte-identity (AC1/AC5): composeSkill(\"skill-coordinator.md\", {taskTool:true}) === frozen golden monolith, byte-for-byte"
4. `test/cut-approval-gate.test.mjs` — "C3: S03 — inline cut draft table header present verbatim in skill-pm.md"
5. `test/check-md-tables.test.mjs` — AC7 (real corpus)
6. `test/check-md-tables.test.mjs` — CQ-9 (real corpus)

**Phase 0.5: clean (6/6 manifest entries confirmed red, 0 unexplained reds).**

Disposition (all six, before re-baseline):
- 1, 2, 3, 4 — expected, qa-owned re-baseline work for T-E110-03 (AC6/AC7 +
  the AC8-amendment C3 fix). Re-baselined below; all 4 now green.
- 5, 6 — **pre-existing on base `dea8544`, NOT caused by this lane.**
  `node scripts/check-md-tables.mjs docs/backlog.md` reports a malformed
  table at `specs/e123a-lane-layout-migration.md:280` (row has 3 cells,
  header declares 4). `git log --oneline -1 -- specs/e123a-lane-layout-migration.md`
  shows the file's only commit is `dea8544` (this lane's base commit) and
  `git show dea8544:specs/e123a-lane-layout-migration.md` already contains
  the malformed row at the same line — this lane never touches that file.
  Filed as `NEW-TICKETS.md` L-CONTENT-NEW-2, owner: the e123a lane. Out of
  scope for this verdict; left red and NOT fixed here, per the dispatch
  brief and the manifest's own disposition.

## Phase 1 — Review (AC1-AC5, AC8 literal re-verification)

Independently re-ran code-reviewer's cited greps against the working tree
(not trusted from the review report):

- AC1: `grep -c 'Parallel-Lane Cut' content/skill-pm.md` → `2`. Step 2's
  ordered sequence reads "Visual State-Count Split → Geometric-Density Split
  Gate → Parallel-Lane Cut → Scope Decision Gate" (content/skill-pm.md:84).
  The Gate Summary row (content/skill-pm.md:104) states S0/L1..Ln/J with all
  required qualifiers and "never a general DAG".
- AC2: `Per-AC \`proof:\` audit` and `NOT the lane its subject suggests` each
  present once, outside the `<!-- rationale:start -->` fence.
- AC3: `serial — shared layer` present, U+2014 em-dash confirmed, outside the
  fence.
- AC4: `` `id | desc | depends_on | est. files | touches | design-link` ``
  present verbatim; `grep -c 'est. files | design-link\`' content/skill-pm.md`
  → `0` (old 5-column header gone). Definition line directly below, separated
  by a blank line.
- AC5: `| order | feature id | scope | touches | figma link |` present in
  `content/coord-01-core-head.md`. `tools/join-precondition.ts`'s
  `parseDeclaredFeatureIds` resolves by header alias, not position — no
  `tools/` change needed or made.
- AC8: `git status --porcelain` + `git diff --name-only main...HEAD | grep -E
  '^(tools|gates|guards|prompts|bin|schema|dist)/'` — zero matches (grep exit
  1). Full changed-path set: `content/skill-pm.md`, `content/coord-01-core-head.md`,
  `test/context-budget.test.mjs`, `test/cut-approval-gate.test.mjs`,
  `test/fixtures/compose-golden/skill-coordinator-monolith.txt`,
  `specs/e110-pm-parallel-lane-template.md`, `.current/**`, `tasks.md`,
  `qa_reports/**`, `review_reports/**`, `NEW-TICKETS.md` — every path is in
  the AC8 allowed set.

Copy Audit Gate (3a) / Visual Audit Gate (3b): spec's Copy/Strings table has
6 authored-here string ids, all verified present verbatim above (pm.gate.parallel-lane,
pm.parallel.audit, pm.parallel.rule, pm.parallel.serial, pm.cut.header,
coord.split.header). Visual Tokens / Visual Widgets tables are both `N/A`
("feature has no visual literals" / "no non-visual widgets") — no design file,
mode = no-design. No drift, no coverage gap. Phase 1.5 (Visual Compare):
skipped (no Visual Baselines declared — no `design/e110-pm-parallel-lane-template.md`).

## T-E110-03 work performed

1. **Floor re-measurement** (not trusted from sr-engineer's handoff note,
   independently re-derived via the real render path — `stripRationale(
   stripOriginTags(expandSkill(body)))` for skill-pm, and
   `stripRationale(stripOriginTags(CONSTITUTION)) + SEP +
   stripRationale(stripOriginTags(coordBody))` for the design-arm bundle,
   matching `buildPromptForRole`'s own composition order):
   - `skill-pm` stripped body: **4376 ~tok** (17503 chars / 4).
   - teamwork design-arm bundle: **18990 ~tok**.
   Both match sr-engineer's cited figures exactly.
2. Raised the two caps in `test/context-budget.test.mjs` to these exact
   values (Phase-2 convention, no headroom), with qa-owned bump comments and
   matching title-string updates (4128→4376, 18982→18990). No other cap
   touched.
3. Added `"Parallel-Lane Cut"`, `` "Per-AC `proof:` audit" ``, and
   `"serial — shared layer"` to `PM_RULE_MARKERS` in
   `test/context-budget.test.mjs`.
4. Regenerated goldens via `node scripts/capture-constitution-golden.mjs`.
   `git status --porcelain -- test/fixtures/compose-golden/` shows exactly
   one changed fixture: `skill-coordinator-monolith.txt`.
5. Updated C3 in `test/cut-approval-gate.test.mjs` to the new 6-column cut
   header literal (`id | desc | depends_on | est. files | touches |
   design-link`), per the coordinator's AC8 amendment (2026-09-23): AC4
   requires the old 5-column header gone, so C3's old literal and AC4 cannot
   both hold; the fix belongs to the test, not the content file.

## AC Execution Log

All proofs run from `<lanes-root>/e110`, AFTER the T-E110-03
re-baseline above.

- **AC1**: `grep -c 'Parallel-Lane Cut' content/skill-pm.md` → `2`. `node --test
  --test-name-pattern="every operative rule/gate/SOP marker survives
  stripRationale in skill-pm.md" test/context-budget.test.mjs` → `pass 1 / fail 0`.
  **PASS.**
- **AC2**: `grep -F 'Per-AC \`proof:\` audit' content/skill-pm.md && grep -F
  'NOT the lane its subject suggests' content/skill-pm.md` → both exit 0,
  neither inside a rationale fence. **PASS.**
- **AC3**: `grep -F 'serial — shared layer' content/skill-pm.md` → exit 0.
  **PASS.**
- **AC4**: `grep -F '\`id | desc | depends_on | est. files | touches |
  design-link\`' content/skill-pm.md` → exit 0. `grep -c 'est. files |
  design-link\`' content/skill-pm.md` → `0`. **PASS.**
- **AC5**: `grep -F '| order | feature id | scope | touches | figma link |'
  content/coord-01-core-head.md` → exit 0. `node --test
  test/e115-join-precondition.test.mjs` → `pass 23 / fail 0`. **PASS.**
- **AC6**: `git diff --name-only -- test/fixtures/compose-golden/` → prints
  exactly `test/fixtures/compose-golden/skill-coordinator-monolith.txt`.
  `node --test test/compose-equivalence.test.mjs
  test/e90-golden-capture-completeness.test.mjs` → `pass 17 / fail 0`. **PASS.**
- **AC7**: `git diff -U0 test/context-budget.test.mjs | grep -E
  '^[-+]\s*assert\.ok\(.*<= ?[0-9]+|^[-+]\s*assert\.ok\(.*≤ ?[0-9]+'` shows
  exactly two changed asserts: `4128→4376` (skill-pm stripped) and
  `18982→18990` (teamwork stripped bundle) — no other cap touched. Full
  `npm test` exits with `pass 2232 / fail 2` (the 2 pre-existing
  check-md-tables reds, dispositioned above; not part of AC7's "npm test
  exits 0" literal reading — see Phase 4 below for the full-suite
  disposition). **PASS** (both caps raised to exact re-measured values, no
  other floor moved).
- **AC8**: `git diff --name-only main...HEAD | grep -E
  '^(tools|gates|guards|prompts|bin|schema|dist)/'` → prints nothing (exit
  1). **PASS.**

## Phase 4 — Run

- Build: `npm run build` — zero errors. `git status --porcelain -- dist/`
  both before and after rebuild — empty. **dist/ is unchanged by this lane.**
- CI runnability: `npm test` runs headlessly, zero human interaction.
- Full regression, post-re-baseline: **pass 2232 / fail 2**. The 2 failures
  are exactly `test/check-md-tables.test.mjs` AC7 and CQ-9 (real corpus),
  independently re-confirmed via `node scripts/check-md-tables.mjs
  docs/backlog.md` → malformed table at `specs/e123a-lane-layout-migration.md:280`,
  pre-existing on base `dea8544` (that file's sole commit), caused by the
  e123a lane, filed `NEW-TICKETS.md` L-CONTENT-NEW-2, explicitly out of
  scope per the dispatch brief and the expected-red manifest. **Not fixed
  here.** All 4 T-E110-03-owned reds (the 2 caps, the monolith golden, C3)
  are confirmed green individually (targeted `--test-name-pattern` runs
  above) and as part of the full suite.
- N1/N2 (code-reviewer non-blockers): filed L-CONTENT-NEW-3/4, not part of
  this verdict.

**PASS.** T-E110-01, T-E110-02, T-E110-03 all meet their acceptance
criteria. AC1-AC8 hold. The only reds left in the suite are the 2
pre-existing, out-of-scope `check-md-tables` failures caused by the e123a
lane, correctly dispositioned as pre-existing and not fixed here.
## 2026-09-23T06:44:52.679Z — PASS — by qa-engineer

PASS. AC1-AC8 verified against specs/e110-pm-parallel-lane-template.md, all proofs pass (see qa_reports/review_T-E110-03.md AC Execution Log). Phase 0.5 expected-red diff clean: all 6 manifest entries confirmed red pre-baseline; 4 (2 caps, monolith golden, C3) turned green after T-E110-03's re-baseline (skill-pm cap 4128->4376, design-arm floor 18982->18990, both independently re-measured at exact values; golden regen touched only skill-coordinator-monolith.txt; C3 updated to the new 6-col cut header per the AC8 amendment); 2 (check-md-tables AC7/CQ-9) confirmed pre-existing on base dea8544, caused by specs/e123a-lane-layout-migration.md:280 (other lane), filed L-CONTENT-NEW-2, correctly left unfixed and out of scope. Full suite: pass 2232 / fail 2 (only the 2 pre-existing reds). npm run build clean, dist/ unchanged before and after. AC8 scope boundary confirmed via git status/diff — every changed path in the allowed set, zero touches under tools/gates/guards/prompts/bin/schema/dist. N1/N2 non-blockers filed L-CONTENT-NEW-3/4, not part of this verdict.

## 2026-09-23T06:45:05.744Z — PASS — by qa-engineer

PASS. AC1-AC8 verified against specs/e110-pm-parallel-lane-template.md, all proofs pass (see qa_reports/review_T-E110-03.md AC Execution Log). Phase 0.5 expected-red diff clean: all 6 manifest entries confirmed red pre-baseline; 4 (2 caps, monolith golden, C3) turned green after T-E110-03's re-baseline (skill-pm cap 4128->4376, design-arm floor 18982->18990, both independently re-measured at exact values; golden regen touched only skill-coordinator-monolith.txt; C3 updated to the new 6-col cut header per the AC8 amendment); 2 (check-md-tables AC7/CQ-9) confirmed pre-existing on base dea8544, caused by specs/e123a-lane-layout-migration.md:280 (other lane), filed L-CONTENT-NEW-2, correctly left unfixed and out of scope. Full suite: pass 2232 / fail 2 (only the 2 pre-existing reds). npm run build clean, dist/ unchanged before and after. AC8 scope boundary confirmed via git status/diff — every changed path in the allowed set, zero touches under tools/gates/guards/prompts/bin/schema/dist. N1/N2 non-blockers filed L-CONTENT-NEW-3/4, not part of this verdict.

