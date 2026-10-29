<!-- pending-tickets for lane e367 (E179). New blocks go ABOVE ## Applied. -->

```pending-ticket
lane_local_id: E368-NEW-1
title: after E368, roles still write specs/, design/ and expected-red_ files by the raw active_feature, so a non-canonical feature name's files are not found by the gates
priority: P3
depends_on: [E368]
source: pm, e367 lane cut (specs/e367-evidence-and-feature-path-encoding.md, NHR-1)
body: |
  E368 routes specFilePath, expectedRedManifestPath and designFilePath through an injective,
  case-fold-safe encoding (encodeFeatureStem). That encoding is the identity on canonical
  lower-case slugs, so canonical names are unaffected. For a non-canonical active_feature
  (upper case, "_", a doubled or leading/trailing dot, other characters), the gate now reads an
  encoded file name (e.g. "Foo" -> specs/_foo.md), while the role SOP prose in content/** tells
  roles to write specs/<feature>.md, design/<feature>.md and qa_reports/expected-red_<feature>.txt
  by the raw name. A file written at the raw name is then not found:
  - the AC-execution gate and the visual arm treat absence as "not armed" (fail-open);
  - REPRO_MANIFEST_MISSING blocks, though its text cites the encoded path.
  Before E368, names made only of [A-Za-z0-9._-] without ".." had writer path == gate path.
  tools/lane-status.ts's cut-pre-review check also reads specs/${feature}.md by raw name; it
  mirrors the writer convention and should follow whatever this ticket decides.
  Fix candidates (pick one): reject or canonicalise a non-canonical active_feature at
  tw_update_state (tools/handoff-orchestrator.ts); surface the resolved spec/design/manifest
  paths in tw_get_state; or state the encoded name in the SOP prose (content/**). Exposure at
  filing: 0 shipped files with non-canonical names; 1 of 84 historical active_feature values
  in .current/ was non-canonical (E260E), with no spec/design/manifest file.
```

## Applied
