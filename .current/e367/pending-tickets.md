<!-- pending-tickets for lane e367 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E368-NEW-1
title: make active_feature spec/design/expected-red paths injective (deferred E368 read side) together with the raw-name writer convention (write side)
priority: P3
depends_on: [E367, E136]
source: pm, e367 lane cut (specs/e367-evidence-and-feature-path-encoding.md, NHR-1 ruled B by the human 2026-10-29)
body: |
  Carries BOTH halves of the work deferred from lane e367 by human ruling B (2026-10-29), which
  must land together in one wave that may touch content/**:

  (1) Read side = backlog E368 as filed. specFilePath (gates/ac-execution.ts),
  expectedRedManifestPath (gates/expected-red.ts) and designFilePath (gates/visual.ts) map
  active_feature through replace(/[^A-Za-z0-9._-]/g, "_") plus a ".." collapse, so two feature
  names differing only in case or in sanitised characters share one file. The full design is
  kept in the "Deferred (E368, ruled B 2026-10-29)" section of
  specs/e367-evidence-and-feature-path-encoding.md: a shared encodeFeatureStem in
  tools/evidence-file.ts (case-mirrored E136 encoding: [a-z0-9-] and isolated interior dots
  unchanged, [A-Z] -> "_" + lower-case letter, everything else -> "__" + 4 lower-case hex;
  identity set ^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*)?$), the ".." guard argument, the shipped-name
  inventory (0 of 380 names move at base f5485a7), a re-check command, and the four predicted
  test re-pins.

  (2) Write side. Role SOP prose in content/** tells roles to write specs/<feature>.md,
  design/<feature>.md and qa_reports/expected-red_<feature>.txt by the raw active_feature, and
  tools/lane-status.ts's cut-pre-review check reads specs/${feature}.md by raw name. With the
  read side alone, a non-canonical name (e.g. "Foo") would be read at specs/_foo.md while the
  role wrote specs/Foo.md: the AC-execution gate and the visual arm would read absence as "not
  armed" (fail-open) and REPRO_MANIFEST_MISSING would block. Fix candidates (combinable):
  reject or canonicalise a non-canonical active_feature at tw_update_state
  (tools/handoff-orchestrator.ts); surface the resolved paths in tw_get_state; state the
  encoded name in the SOP prose; align the lane-status raw-name readers.

  Exposure at filing: 0 shipped files with non-canonical names; 1 of 84 historical
  active_feature values in .current/ was non-canonical (E260E), with no spec/design/manifest.
```

## Applied
