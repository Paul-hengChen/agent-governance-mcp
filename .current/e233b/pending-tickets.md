# Pending tickets — lane e233b

## Applied

```pending-ticket
lane_local_id: E233B-NEW-1
title: research/visual-fidelity.md header and old CHANGELOG entries still name source files with a product-style filename prefix that may be a project codename
priority: P3
depends_on: [E241]
source: e233b code review (T-E233B-05), out-of-scope note
body: |
  E241's fix dropped the product-style prefix from the one missing recommendations file it rewrote,
  in case that prefix is a project codename (Information hygiene rule). The same prefix still appears
  on the other source-file names in the research/visual-fidelity.md header (line 5, the improvement
  plan) and in the historical CHANGELOG citations the integrator ruled are accurate release history
  and must stay. Needs a human call: is the prefix a codename? If yes, describe those names by class
  without rewriting the substance of the history; if no, close as not-a-leak.
```
