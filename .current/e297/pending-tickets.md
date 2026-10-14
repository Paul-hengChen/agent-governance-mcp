# Pending tickets — lane e297

New blocks go above `## Applied`.

```pending-ticket
lane_local_id: E297-NEW-1
title: Stale pull request recovery under the branch-up-to-date rule (integrator Stage 6, release-engineer 8c/13a)
priority: P3
depends_on: [E297]
source: pm cut, lane e297
body: |
  The ruleset requires a pull request to be up to date with the default branch before
  merge. When the default branch moves after the pull request opened, E297 rules STOP
  and report (the D10 collision shape). Decide whether `gh pr update-branch` (a host-side
  merge of the default branch into the pull request head) joins the Constitution section
  6 grant for the integrator and release-engineer, with the merge-resolution review duty
  (integrator 5b-5) applied when it produces a non-trivial merge.
```

```pending-ticket
lane_local_id: E297-NEW-2
title: Model-tier tables outside the parser still list three tiers after `fable` joined MODEL_TIERS
priority: P3
depends_on: [E297]
source: pm cut, lane e297
body: |
  `specs/model-routing.md`, `specs/model-routing-architecture.md` (the MODEL_TIERS
  excerpt) and `specs/d8-lite-recommended-model.md` describe a three-tier vocabulary.
  E297 adds `fable` to `tools/skill-frontmatter.ts` and sets the integrator SOP to it.
  Docs-only alignment; `specs/` outside `specs/e297-*` is not owned by lane e297.
```

```pending-ticket
lane_local_id: E297-NEW-3
title: `git merge --ff-only` stays in the Integrator-only grant but no SOP step uses it after E297
priority: P3
depends_on: [E297]
source: pm cut, lane e297
body: |
  E297 is additive to the pinned grant clause. After Stage 6 moves to pull-request merge,
  `git merge --ff-only` has no caller in any SOP. A later constitution pass can retire it
  (one sentence, one test re-pin, goldens).
```

## Applied
