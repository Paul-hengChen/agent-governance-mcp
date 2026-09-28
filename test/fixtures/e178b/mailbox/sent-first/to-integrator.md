--- msg
seq: 1
from: sent-first
type: question
re: cut scope — may I split?
time: 2026-09-27T01:00:00Z
hop: 1/10
---
A question that mentions cut: not a proposal, never counts.
--- msg
seq: 2
from: sent-first
type: report
re: cut done
time: 2026-09-27T01:05:00Z
hop: 2/10
---
A report whose re: mentions cut: never counts (AC11).
--- msg
seq: 3
from: sent-first
type: proposal
re: E177a PM cut pre-review
time: 2026-09-27T01:10:00Z
hop: 3/10
---
The FIRST matching block: the state must name seq 3.
--- msg
seq: 4
from: sent-first
type: proposal
re: cut-draft
time: 2026-09-27T01:20:00Z
hop: 4/10
---
A later match: must NOT be the one reported.
