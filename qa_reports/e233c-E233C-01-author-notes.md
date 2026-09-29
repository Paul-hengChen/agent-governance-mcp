# E233C-01 author notes (qa-engineer author context; not a verdict)

Scanned the 353 id-citing comment lines in the 60 owned test files. Almost all
already explain the behaviour in plain words and only carry an id, so they were
left unchanged. Seven comment lines in five files had the id or a jargon label
as the main explanation and were rewritten (id kept as trailing pointer):

- test/e116-archive-on-feature-change.test.mjs (E150 loss-prevention label)
- test/e120-void-recut-refusal.test.mjs (E120 end-state)
- test/e177b-lane-status.test.mjs (two: E182-class label, E175(d) shape)
- test/e177b-test-lock.test.mjs (E182-class label)
- test/e178b-fanout-unmatched.test.mjs (two: E208 exit-code and error-code notes)

Comment text only; AC1 comment-stripped comparison printed bad=0.
