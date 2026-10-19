# Pending tickets — lane e290

```pending-ticket
lane_local_id: E290-NEW-1
title: integrator SOP still carries this repo's own commands outside the two-layer sentences
priority: P3
depends_on: [E290]
source: pm, e290 cut (specs/e290-lane-protocol-generic.md, Findings filed)
body: |
  After E290 the lane rules are split into agc's generic file and a per-repo addendum, but
  content/skill-integrator.md still states this repo's facts as if they were generic: the Stage 1
  hard-constraint shared-artifact list ("this repo: content/** + test/fixtures/compose-golden/** +
  test/context-budget.test.mjs"), Stage 4 base-fix step 5 (npm run build, npm audit in the worktree),
  Stage 6 step 1 ("this repo: node bin/agc-init.mjs feature finish ..."), and the repo-relative
  node scripts/*.mjs calls throughout (an adopter runs them from the agc install). Decide whether the
  integrator side reads the same repo addendum or gets its own, and move these sentences there.
  Lane e290 does not own content/**; lane e292 owns only the two-layer sentences (lines 101, 105, 109).
```

```pending-ticket
lane_local_id: E290-NEW-2
title: PM SOP Manifest-Tier row calls node scripts/fanout.mjs repo-relative
priority: P3
depends_on: [E290]
source: pm, e290 cut (specs/e290-lane-protocol-generic.md, Findings filed)
body: |
  content/skill-pm.md's Manifest-Tier Self-Attestation row says to run
  `node scripts/fanout.mjs check --cut ...`. That path exists only when the workspace is the agc
  checkout itself; in an adopter the script lives in the agc install. E290 made the generic
  lane-protocol name `node <agc install>/scripts/fanout.mjs`, with the repo addendum free to give the
  repo's own call. Align the
  PM SOP wording (shared artifact: content/**, compose goldens and the PM context budget may move).
```

```pending-ticket
lane_local_id: E290-NEW-3
title: lane-protocol commit rules assume artifacts: repo
priority: P3
depends_on: [E290]
source: pm, e290 cut (specs/e290-lane-protocol-generic.md, Findings filed)
body: |
  docs/lane-protocol.md §3 tells the lane to commit .current/<lane>/, qa_reports/, review_reports/ and
  §4 says pending-tickets.md must be committed for finish to allocate ids. Under `artifacts: local`
  (E73: agc artifacts stay out of a team repo's history) those paths are excluded, so the rules cannot
  be followed as written and finish's allocation path is unclear. State the local-mode behaviour in the
  generic file (or declare fan-out repo-mode only) once the tool side is decided.
```

```pending-ticket
lane_local_id: E290-NEW-4
title: generic lane protocol gives no fallback when agc is not on PATH and no addendum exists
priority: P3
depends_on: [E290]
source: code-reviewer, e290 round 1 (review_reports/review_T-E290-01.md, optional finding 1)
body: |
  docs/lane-protocol.md §1 now says the call form for an agc that is not on PATH comes from the repo
  addendum. An adopter with no addendum whose agc is not on PATH (e.g. installed only as a project
  dependency) gets no runnable form from the generic file. Add a generic fallback (for example the
  package runner form, or `node <agc install>/bin/agc-init.mjs`, matching how §5 now names the fan-out
  tool). New rule wording, so it was out of E290's fixed copy.
```

## Applied
