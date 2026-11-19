---
id: T1
title: One sentence that names the change
priority: P2
depends on: []
allowed paths: [path/to/file-this-ticket-may-change]
needs device or person: no
status: not started
source:
---

<!--
Replace every value above. The field block, the scenario shape and the
verification forms are explained in the ticket format document.
- depends on: ticket ids this ticket waits for, e.g. [T0]; [] when none.
- allowed paths: every repo-relative path or glob this ticket may change.
- needs device or person: yes only when a scenario's verification is
  device-or-person.
- status: not started, done, or stopped — <reason>.
- source: leave empty unless the ticket was cut from an issue-tracker item;
  then [<item number> rev <revision>]. Never a URL.
-->

## Context

Why this ticket exists and what is out of scope, in a few sentences.

## Scenarios

### S1 — Short scenario title

- Given the starting situation
- When the action happens
- Then the observable result
- Verification: automated test

## Added during build
