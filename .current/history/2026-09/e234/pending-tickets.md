# Pending tickets — lane e234

## Applied

```pending-ticket
lane_local_id: E234-NEW-1
title: docs/config.md env-var overrides table does not list AGC_HYGIENE_KEYWORDS
priority: P3
depends_on: [E234]
source: sr-engineer, E234 T-E234-04 docs sync
body: |
  The fan-out manifest limits lane e234 to the `agc check` rows of docs/config.md, so the
  hygiene-scan keyword-source env var is documented only in the artifacts section's advisory
  bullet and in docs/install.md, not in the "Env-var overrides" table at the end of
  docs/config.md, where readers look for every env var. Add one row that names the var, says it
  points at the keyword-list file for the advisory `agc check` hygiene scan, and links to the
  install.md paragraph.
```
