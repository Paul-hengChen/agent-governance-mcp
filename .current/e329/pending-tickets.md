# Pending tickets — lane e329

## Applied

```pending-ticket
lane_local_id: E329-NEW-1
title: fanout-manifest HANDOFF_SUBITEMS doc comment says "in order" but validate does not enforce sub-item order
priority: P3
depends_on: [E283]
source: pm, e329 cut (specs/e329-integrator-sop-followups.md, Dependencies / Findings filed)
body: |
  In tools/fanout-manifest.ts the comment on HANDOFF_SUBITEMS reads "Sub-items every handoff section must
  hold, in order", but handoffSectionErrors only checks that each mandatory sub-item is present once and
  non-empty; it never checks their order. Either drop "in order" from the comment or enforce the order
  (with a new HANDOFF_* code). The integrator SOP text written by lane e329 lists the headings in the
  canonical order without claiming validate enforces it. Lane e329 does not own tools/**.
```
