# Pending tickets — lane e393

## Applied

```pending-ticket
lane_local_id: E393-NEW-1
title: test/context-budget.test.mjs comment ratio 38.9% exceeds the agc check 30% limit — move the cap-history comments into a spec
priority: P3
depends_on: [E393]
source: qa-engineer, E393 T-E393-06 (agc check warning after the saving-floor re-baseline)
body: |
  `node bin/agc-init.mjs check` still exits 0 but warns that the test file is 38.9% comments
  (limit 30%). The cap history (e43 → E258 → E336 → E350 → E365 → E393 re-baselines) is
  narrative, not assertion; it belongs in a spec (e.g. specs/context-budget-cap-history.md)
  with the test keeping one pointer line per ceiling.
```

```pending-ticket
lane_local_id: E393-NEW-2
title: e96 lean-absent dispatch-preference test passes vacuously — add a positive anchor
priority: P3
depends_on: [E393]
source: qa-engineer, E393 T-E393-06 (re-pin of the three e96 tests via one shared regex)
body: |
  test/e96-dispatch-preference.test.mjs: the lean case only asserts the WHEN/DO marker is
  absent, so any marker regex (including a stale one) keeps it green. Pair it with a positive
  assertion on the lean text (or derive the marker from the full-case match) so a wording
  change at coord-02 cannot leave the lean case silently meaningless. The e96 case titles
  still say "§3.2"; rename them with the same change (qa-owned, test-only).
```
