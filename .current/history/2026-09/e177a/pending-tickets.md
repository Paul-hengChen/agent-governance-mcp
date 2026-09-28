# Pending tickets — lane e177a

## Applied

```pending-ticket
lane_local_id: E177A-NEW-1
title: fanout check over-permits prose backtick paths in 擁有 (wave7 e177a owns bogus `feature-rollup.mjs`)
priority: P3
depends_on: [E177a]
source: coordinator self-check `node scripts/fanout.mjs check specs/fanout-wave7.md e177a` @ 4a441dd
body: |
  The parsed owned set for wave7 e177a includes `dist/tools/*.js` and `feature-rollup.mjs`, both taken from the
  prose aside （薄殼，吃 `dist/tools/*.js`，同 `feature-rollup.mjs` 模式）. `feature-rollup.mjs` resolves
  repo-root-relative, i.e. a file that does not exist; harmless here but it is the known over-permission
  (spec Out of Scope, cut decision (g)). Fix options: a manifest quoting convention (e.g. owned paths only
  before the first （ or a dedicated separator), or `check` warning on owned tokens that match no path at base.
  Needs the manifest author (integrator) convention, not a tool guess — candidate for E178's format section.
```
