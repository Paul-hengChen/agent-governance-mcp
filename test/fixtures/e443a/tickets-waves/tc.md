---
id: TC
title: Fixture ticket C
priority: P1
depends on: [TA]
allowed paths: [src/c.ts, 'test/c-*.test.mjs']
needs device or person: no
status: not started
---

## Scenarios

### S1 — C works after A

- Given A is done
- When C runs
- Then C works
- Verification: automated test
