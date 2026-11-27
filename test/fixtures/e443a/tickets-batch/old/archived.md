---
id: TX2
title: Not read — the lookup reads the ticket directory's top level only
priority: P2
depends on: []
allowed paths: [test/x.test.mjs]
needs device or person: no
status: done
---

## Scenarios

### O1 — never read

- Given this file sits in a subdirectory and holds id TX2
- When the ticket lookup runs
- Then it is skipped, so TX2 is not a duplicate
- Verification: automated test
