# Pending tickets — lane e297

New blocks go above `## Applied`.

```pending-ticket
lane_local_id: E297-NEW-1
title: Stale release pull request under the branch-up-to-date rule (release-engineer 8c/13a only)
priority: P3
depends_on: [E297]
source: pm cut, lane e297 (narrowed at integrator pre-review)
body: |
  The ruleset requires a pull request to be up to date with the default branch before
  merge. The integrator's remedy is in E297 (merge the default branch into the
  integration branch under its own grant). The release-engineer has no merge
  authorization, so E297 keeps the STOP (D10 collision shape) for a `release/*` pull
  request that falls behind. Decide whether `gh pr update-branch` (a host-side merge of
  the default branch into the pull request head) joins the release-engineer's section 6
  namespace, and what re-verification (8b strict CI check, 9a) follows it.
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
title: "`git merge --ff-only` stays in the Integrator-only grant but no SOP step uses it after E297"
priority: P3
depends_on: [E297]
source: pm cut, lane e297
body: |
  E297 is additive to the pinned grant clause. After Stage 6 moves to pull-request merge,
  `git merge --ff-only` has no caller in any SOP. A later constitution pass can retire it
  (one sentence, one test re-pin, goldens).
```

## Applied
