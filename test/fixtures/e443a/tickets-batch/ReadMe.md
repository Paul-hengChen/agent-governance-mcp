---
id: TX1
title: Not a ticket — a README in any case is never read by the lookup
priority: P1
depends on: []
allowed paths: [src/x.ts]
needs device or person: no
status: not started
---

## Scenarios

### R1 — never read

- Given this README holds id TX1
- When the ticket lookup runs
- Then it is skipped, so TX1 is not a duplicate
- Verification: automated test
