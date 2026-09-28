preamble line: not inside any block
type: proposal
--- msg
seq: 1
type: proposal
type: report
re: first re wins
re: second re ignored
---
type: body
--- msg trailing words on the start line
seq: 2
type: proposal
re: crlf cut
---
---msg
seq: 99
--- msg
Seq: 3
seq:4
re:no space after colon
type:  proposal 
X-Other: y
