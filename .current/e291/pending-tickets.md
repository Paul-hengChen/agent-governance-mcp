# Pending tickets — lane e291

```pending-ticket
lane_local_id: E291-NEW-1
title: No task-list tool edits an existing unchecked task's description or depends_on
priority: P3
depends_on: none
source: coordinator, e291 cut amendment (PM hand-edited one unchecked task line; integrator to-lane#7 suggested filing)
body: |
  When a cut is amended mid-chain, an existing unchecked task may need a new description or a new
  depends_on (here: a qa task had to cover one more acceptance criterion and depend on a new task).
  The only sanctioned path today is void + add, which changes the task id that evidence files are
  named after. Consider a tool that rewrites the description / depends_on of an unchecked task in
  place, refusing on checked or voided tasks, so amendments stay on tools and keep their ids.
```

## Applied
