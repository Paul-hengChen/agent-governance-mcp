# QA review — T-E335-04

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-10-17T15:27:50.691Z — PASS — by qa-engineer

PASS (amendment 2 QA round, opus, Task-spawned). Evidence: qa_reports/review_T-E335-05.md (covers T-E335-04, T-E335-05). Earlier PASS at cc4ae03 was re-opened by CI test (20) (AC-E335-6 a/b, Node 20 cpSync EINVAL); T-E335-04 (316f25d, review APPROVED 5470550) implements D8 set-aside of colliding history links. R1 closed: new test AC-E335-7 (failure path) in test/e335-symlinked-pending-harvest.test.mjs (commit 22e968d) - two set-aside entries, history other-link.md -> different old target; asserts readlink restored, old target bytes untouched, no .aside.tmp, unchanged error, worktree+branch kept, re-run converges. Negative controls on scratch copy (restore only first / only last / none) all red on Node 20.x and 22.x; real code 16/16 on both. Full suite on HEAD 77f8e1b clean tree: Node 22.x 3373/3375 pass, 0 fail, 2 pre-existing skips (exit 0). Node 20.x 3318/3375, 55 fail - all better-sqlite3 NODE_MODULE_VERSION mismatch (shared node_modules built for Node 22) in 15 SQLite-mode files outside lane scope; same 15 files 360/360 under Node 20.x with a matching binding in a scratch export; reported, not re-baselined; CI test (20) is the authoritative Node 20 full-suite proof. e246 byte-identical to main; AC-LANE-2 23/23 paths e291; AC-LANE-3 build clean, dist porcelain empty.

