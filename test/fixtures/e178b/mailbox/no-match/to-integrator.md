--- msg
seq: 1
from: no-match
type: proposal
re: api shape for the watch line
time: 2026-09-27T03:00:00Z
hop: 1/10
---
A proposal whose re: is not about a cut.
type: proposal
re: cut pre-review
(the two lines above are BODY text, after the header closed: they must not count)
--- msg
seq: 2
from: no-match
type: report
re: cut pre-review report
time: 2026-09-27T03:05:00Z
hop: 2/10
---
body
--- msg
seq: 3
from: no-match
type: ack
re: cut 預審 ack
time: 2026-09-27T03:06:00Z
hop: 3/10
---
body
