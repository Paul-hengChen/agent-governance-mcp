# Pending tickets — lane e320

```pending-ticket
lane_local_id: E321-NEW-1
title: test hygiene — fixed-lane-base diff tests in non-owned files, plus the one-line convention for growable manifests and fixed-base diffs
priority: P3
depends_on: [E321]
source: qa-engineer, T-E321-01 audit (qa_reports/review_T-E321-01.md, AC-E321-2/3)
body: |
  The E321 audit found a second instance of the growable-fixture / fixed-base class in files this lane does
  not own: test/e178a-integrator-role.test.mjs (BASE_SHA diff of content/const-15-core-tail.md counted
  against the working tree, grows with every legitimate const-15 edit) and test/e296-manifest-tier.test.mjs
  (AC10 compares HEAD fanout output with output of a fixed base commit, c392cc3; w2 input is a real
  specs/fanout-*.md). Both are guarded by a loud skip when history is absent, but neither survives
  later legitimate edits of the code they compare. e308 already moved to a content check for the same reason.
  Fix shape: replace each with a content/structure assertion or a frozen in-test fixture. Also write the
  one-line convention (resident tests assert stable structure of real manifests or use frozen in-test
  fixtures; never diff against a fixed lane base sha) where test conventions live — content/** or docs/**,
  which no wave-4 lane owns.
```

```pending-ticket
lane_local_id: E317-NEW-1
title: emitZodGateTelemetry still emits under <ws>/.current/<lane>/.current/ when workspace_path is a lane directory
priority: P3
depends_on: [E317]
source: code-reviewer E317 review note, confirmed by qa-engineer T-E320-02 probe
body: |
  E317 guards basename(workspace_path) === ".current" only. With workspace_path = <ws>/.current/<lane>
  (an existing directory) and a bad dispatch_pins tier, the unfixed-path emit still writes
  <ws>/.current/<lane>/.current/_primary/telemetry.jsonl. Probe on the lane build reproduced it.
  Fix shape: reject any workspace_path that contains a `.current` path segment, not just a trailing one.
```

## Applied
