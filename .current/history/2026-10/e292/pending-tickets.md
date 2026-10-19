# Pending tickets — lane e292

## Applied

```pending-ticket
lane_local_id: E292-NEW-1
title: fanout-handoff.ts file-header comment is 10 lines, over the agc check long-block limit
priority: P3
depends_on: [E292]
source: code-reviewer, e292 review round 1 (recommended finding)
body: |
  The sister-repo work added two header lines to tools/fanout-handoff.ts that repeat
  the compareExternalDeps doc comment; the header grew from 8 to 10 lines and agc check
  now warns (limit 7). Trim the repeated lines. Comment-only; no behaviour change.
```

```pending-ticket
lane_local_id: E292-NEW-2
title: handoff --check accepts a sister path that is a plain directory inside another repo
priority: P3
depends_on: [E292]
source: code-reviewer, e292 review round 1 (optional finding)
body: |
  The git-repo check for a declared sister repo uses rev-parse --git-dir, which also
  succeeds for a plain directory nested in some other repo's working tree; the branch
  sha would then be read from the enclosing repo. Comparing --show-toplevel with the
  declared sister root would reject that case.
```

```pending-ticket
lane_local_id: E292-NEW-3
title: render reports a drifted template pointer only after addendum errors are fixed
priority: P3
depends_on: [E343]
source: qa-engineer, e292 qa round 1 (observation)
body: |
  TEMPLATE_POINTER_ABSENT is checked only once the addendum and the generic lane-rules
  file both resolve, so a broken template stays hidden behind ADDENDUM_ABSENT or
  LANE_PROTOCOL_ABSENT in the same run. Matches the spec's valid-key scope; reporting it
  alongside would show every problem in one run.
```

```pending-ticket
lane_local_id: E292-NEW-4
title: e132 lane-registry gap-7 failed once under full-suite load (git ceiling timing)
priority: P3
depends_on: none
source: e292 lane coordinator, final-HEAD full suite
body: |
  test/e132-lane-registry.test.mjs gap-7 failed once in a full run (lane_registry was
  null on the exists:false return), then passed alone (22/22) and in a full rerun.
  The lane registry drops to null when its git subprocess exceeds the time ceiling, so a
  loaded machine can trip it. Consider a longer ceiling seam for that test.
```
