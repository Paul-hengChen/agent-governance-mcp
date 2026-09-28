# QA Review — T-E103-01, T-E91-01

covers: T-E103-01, T-E91-01

Feature `e91-e103-dispatch-pin-mechanics`. Worktree
`<lanes-root>/e91-e103-e102`, branch
`feat/e91-e103-e102-wave1-content-init`, base `c35dcf8`. Code review APPROVED at
round 3 (`review_reports/review_T-E103-01.md`, covers both tasks). No `specs/`
file — mini-chain, backlog-row-as-spec (`docs/backlog.md:213` E91,
`docs/backlog.md:225` E103, `docs/v4.0.0-execution-plan.md` §8 decision C). The
AC-execution machinery (Phase 3.5) is dormant for that reason, not skipped by
oversight.

## Phase 0.5 — Expected-Red Diff

Skipped (no expected-red manifest declared): `qa_reports/expected-red_e91-e103-dispatch-pin-mechanics.txt`
does not exist, and `dispatch_mode` is absent on the handoff (= `feature`).
`git diff --stat c35dcf8 -- test/` was empty going into this round — the two
reds in play were the qa-owned re-baseline surface named in `pending_notes`
(golden byte-identity + context-budget floor), not sr-engineer-authored
intentional reds. Confirmed via `npm test` before touching any test file: the
suite was 1862/1864 passing with exactly those two named subtests red, nothing
else.

## Phase 1 — Review

Re-derived every claim in `pending_notes` and `review_reports/review_T-E103-01.md`
against the tree rather than trusting the handoff:

- `git diff c35dcf8 --stat`: only `content/coord-02-host-dispatch.md` (+1/-1),
  `content/coord-03-core-fallback.md` (+6/-4), `content/coord-04-host-watermark.md`
  (+9/-8), `tasks.md` (+2), plus `.current/handoff.md` and `.current/telemetry.jsonl`
  bookkeeping. `docs/`, `bin/`, `prompts/`, `tools/`, `gates/` are empty in the
  diff — confirmed directly, not from the review doc's say-so.
- `tasks.md:361` (T-E103-01 row) reads `reads the dispatch_pins entry for the
  role, else that role's ~/.claude/agents/<role>.md model frontmatter, and
  passes it as the model override on EVERY Task dispatch` — the shipped
  resolution order, not the superseded SOP-frontmatter wording decision C
  originally named. Matches `content/coord-02-host-dispatch.md:1` verbatim.
  `tasks.md:362` (T-E91-01 row) matches what shipped in `coord-03`/`coord-04`.
- Grepped for the three retired enforcement-implying strings across all of
  `content/*.md`: `the pin did not take effect`, `verify they're honored`,
  `silently degrades back to frontmatter default` — zero hits. The only
  surviving hit for the broader pattern family is `coord-04:17`'s "a match
  never establishes which model actually served the turn", which is a denial
  of verifiability (the point of E91 (iii)), not a residual enforcement claim.
- Grepped for composed-away line-number references (`line [0-9]`) and
  server-source-path references (`content/`) across `content/coord-*.md`:
  zero hits for both, confirming round-1/round-2 findings R1/R2/N4 are
  resolved repo-wide, not just at the originally flagged sites.
- Lane boundary: only `content/coord-02`, `coord-03`, `coord-04`, and `tasks.md`
  touched in-scope; no out-of-boundary file written.

No Copy Audit or Visual Audit gates apply (no user-facing strings/visual
tokens; this is coordinator-internal SOP prose). Phase 1.5 (Visual Compare):
skipped, no `design/<feature>.md` exists.

No issues found — Phase 2 discussion round not needed, proceeding to Phase 3.

## Phase 3 — Tests

Per the dispatch brief's Test-file placement line: re-baseline
`test/fixtures/compose-golden/**` via `scripts/capture-constitution-golden.mjs`,
bump the coordinator-bundle floor in `test/context-budget.test.mjs`, and add
the behavioural pin to `test/skill-manifest.test.mjs` (fits there — the file
already owns the golden-byte-identity test for the same composed artifact).

### 1. Golden re-baseline (`test/fixtures/compose-golden/**`)

Ran `node scripts/capture-constitution-golden.mjs` (the standing regeneration
tool named in its own header). Regenerated all 12 fixtures; diffed:

```
git diff --stat -- test/fixtures/compose-golden/
 .../compose-golden/skill-coordinator-monolith.txt | 27 ++++++++++++----------
 1 file changed, 15 insertions(+), 12 deletions(-)
```

Only `skill-coordinator-monolith.txt` moved — the only fixture that composes
`skill-coordinator.md` (which pulls in `coord-02`/`coord-03`/`coord-04`). The
other 11 fixtures (8 `build-*` + 2 `hook-*` + `constitution-monolith.txt`)
capture only the constitution slice or a different skill body; `coord-*.md` is
never part of `CONSTITUTION`, so they are correctly untouched — confirmed by
the empty diff on all of them, not assumed. The diff on the one fixture that
did move is byte-for-byte the same three spans the code-reviewer's diff shows
in `content/coord-02/03/04` — no other content moved.

### 2. Context-budget floor (`test/context-budget.test.mjs:1405`)

Independently re-measured (not trusted from the handoff note or the review
doc) via the exact construction the test itself uses — `composeConstitution({chain:true,
design:true})` for the constitution side, `composeSkill("skill-coordinator.md",
hostCapabilitiesFor("claude-code"), readContent)` sliced past its frontmatter
for the skill side, both through `stripOriginTags` → `stripRationale`, joined
by the test's own `SEP`:

```
bundle chars: 74280
bundle ~tok (ceil(len/4)): 18570
```

This matches the three independent measurements cited in the handoff (sr's
figure, the reviewer's round-2 projection, the reviewer's round-3
re-measurement) exactly — I did not need to override with a different number.
Bumped the assertion from `18369` to `18570` (+201 net vs base `c35dcf8`, per
the reviewer's accounting). Per the plan's §2.2 hard constraint, this is the
ONLY floor in the file that moved — every constitution-only floor (the AC8
design-arm/non-design-arm constitution floors at 9374/7276, etc.) is untouched,
since none of `coord-02/03/04` is part of `CONSTITUTION`.

**Pre-existing title/assertion mismatch, flagged through all three review
rounds** (`test/context-budget.test.mjs:1096` title said "≤ 18303" while the
`:1405` assertion checked "≤ 18369", out of sync since before this feature):
reconciled in the same edit — the title now reads "≤ 18570 ~tok", matching the
new assertion. Decision: fix it now rather than defer, since I was editing
this exact line's neighborhood anyway and the fix is free (a label correction,
no behavior change); a future reader diffing the title against the assertion
would otherwise still see a stale, unrelated-looking gap.

**Non-vacuous, proven by execution, not assumption:**
- Before this edit: `node --test test/context-budget.test.mjs` — the AC8/AC-P2-7
  coordinator-bundle test was the one visible `not ok` (measured bundle 18570 >
  asserted-then floor 18369).
- After this edit: same test file, 54/54 pass.

### 3. Behavioural pin (`test/skill-manifest.test.mjs`)

Added `t-e91-e103-behavioural-pin`, right after the existing
`t-full-includes-host` test (same file already owns
`t-golden-byte-identity` for this exact composed artifact, so this is the
natural home — no new test file needed).

The test runs the same render path a dispatching coordinator experiences —
`composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"),
readContent)`, sliced past the frontmatter block the same way
`test/context-budget.test.mjs`'s bundle construction does, then
`stripOriginTags` → `stripRationale` — and asserts:

- PRESENT: coord-02's REQUIRED-`model` dispatch clause, its `dispatch_pins`
  → `~/.claude/agents/<role>.md` resolution order, and its no-resolvable-tier
  escape hatch.
- PRESENT: coord-03's reworded Crash-Resume step-3 warrant ("gets silently
  dropped from the resume call") and its self-report disclaimer ("Passing the
  override is all the coordinator can do here...").
- PRESENT: coord-04's self-report framing, self-report premise, and the
  honest relay obligation ("surface in your relay that the reply did not
  claim the pin").
- ABSENT (anywhere in the composed, stripped bundle): the three retired
  enforcement-implying strings — `"the pin did not take effect"`, `"verify
  they're honored"`, `"silently degrades back to frontmatter default"`.

**Why this and not just the golden refresh** (the reviewer's round-3 point,
verified by executing the failure mode, not just reasoning about it): I
reverted `content/coord-02/03/04` to their base `c35dcf8` text (`git stash`),
rebuilt, and re-ran `scripts/capture-constitution-golden.mjs` to re-baseline
the golden fixture against the *reverted* source. Result:

```
t-golden-byte-identity ......... ok   (passes — fixture matches reverted source)
t-e91-e103-behavioural-pin ..... not ok (fails — obligations genuinely missing)
```

This is the exact scenario the reviewer described: a golden refresh alone
would pass even if the new obligations were silently dropped, because
byte-identity fixtures re-baseline to whatever the source currently says. The
behavioural pin is what turns that silent drop into a failing test. Restored
the stash and regenerated the golden fixture correctly afterward; re-ran the
full suite to confirm the restore was clean (see Phase 4).

## Phase 3.5 — AC Execution

Skipped (no `proof:`-annotated ACs) — no `specs/<active_feature>.md` exists at
all; this is the backlog-row-as-spec mini-chain the assignment names, and the
per-AC machinery is dormant by design, not by oversight.

## Phase 4 — Run

- Build: `npm run build` — zero errors, `check:version` and
  `check:transitions-sync` both OK.
- `npm test`: **1865/1865 passing**. Before this round: 1864 tests, 1862 pass /
  2 fail (the two named expected reds). This round added exactly 1 new test
  (`t-e91-e103-behavioural-pin`) and fixed both pre-existing reds, landing at
  1865 total / 1865 pass / 0 fail — verified by direct `npm test` runs before
  and after, not derived arithmetically.
- `npm run check:md-tables`: OK (243 files scanned, 0 malformed tables).
- `npm run check:version`: OK (3.110.0; note about being past the last tag is
  pre-existing and not this feature's concern — release-engineer's job).
- CI runnability: `npm test` runs headlessly, zero human interaction, node's
  built-in test runner.

No FAIL conditions found. Both tasks pass.

## Verdict

**PASS** — T-E103-01, T-E91-01.

Both decided options (E103 (iii), E91 (iii)) ship correctly per code review's
round-3 APPROVED verdict, independently re-verified against the tree: lane
boundary respected, `tasks.md` ledger rows match the shipped mechanism, and
the divergence-from-decision-C amendment is carried in `pending_notes` for the
coordinator to relay (not this lane's job to resolve further). Both expected
reds are cleared by qa-owned re-baseline, not by relaxing the assertions
arbitrarily — the coordinator-bundle floor is set to the exact independently
re-measured value (18570), matching three prior independent measurements, and
the golden fixture's only change is the three intended `coord-0{2,3,4}` spans.
A behavioural pin now guards the specific failure mode the reviewer flagged
(a golden refresh alone silently absorbing a dropped obligation) — proven
non-vacuous by executing the exact regression-plus-refresh sequence and
watching it fail before restoring the fix.

Full suite green (1865/1865), `check:md-tables` and `check:version` both OK.

E103's second facet (coordinator dispatch briefs verifying factual claims,
extending `skill-release-engineer.md:24` to `coord-*.md`) remains
deliberately out of this cut, as recorded in `pending_notes` and
`tasks.md:361` — integrator residue, not a defect in this lane.
## 2026-09-17T03:54:21.226Z — PASS — by qa-engineer

PASS. Both expected reds cleared by qa-owned re-baseline: (1) test/fixtures/compose-golden/skill-coordinator-monolith.txt regenerated via scripts/capture-constitution-golden.mjs — only that one of 12 fixtures moved, diff confined to the three coord-0{2,3,4} spans, independently confirmed. (2) test/context-budget.test.mjs:1405 floor bumped 18369->18570, independently re-measured at 74280 chars via the exact composeConstitution+composeSkill+strip pipeline the test uses — matches all three prior independent measurements. Also reconciled the pre-existing title/assertion label mismatch at :1096 (now both say 18570). Added a new behavioural-pin test (test/skill-manifest.test.mjs: t-e91-e103-behavioural-pin) asserting the composed, stripped coordinator bundle contains the new REQUIRED-model dispatch obligation and the self-report framing, and does NOT contain the three retired enforcement strings. Proved non-vacuous by executing the exact regression the reviewer described: reverted content/coord-02/03/04 to base, re-baselined the golden fixture against the reverted source (byte-identity test passed vacuously as predicted), and confirmed the new behavioural test still failed -- then restored the fix. Verified independently against the tree (not trusted from handoff): tasks.md:361/362 describe the shipped mechanism accurately; diff confined to content/coord-0{2,3,4}+tasks.md, docs/bin/prompts/tools/gates untouched. Full npm test 1865/1865, check:md-tables OK, check:version OK. See qa_reports/review_T-E103-01.md.

