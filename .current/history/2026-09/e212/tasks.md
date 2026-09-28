<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E212-01 E212 — test/e177b-test-lock.test.mjs AC13b: replace the child's fixed 700ms busy-wait with a test-controlled lifetime (child exits only after the test writes a release file post-probe); assertions unchanged; repeated-under-load runs recorded in evidence (note: PASS — AC13b deflaked via test-controlled release-file handshake; 25/25 under stress + concurrent full suite; post-commit clean-tree gate 2737/2737)
