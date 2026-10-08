<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E264-01 [P1] sr-engineer: comment-only fixes AC1-AC4 in tools/{lane-paths,merge-invariants,telemetry,lane-migrate}.ts; rebuild + commit their dist/tools/**; add .current/e264/check-invariance.mjs (AC5/AC6, adapted from 82cf48a) | depends_on: none
- [x] T-E264-02 [P1] qa-engineer: verify AC1-AC9 on final committed HEAD (clean tree, full suite via test-lock), evidence in qa_reports | depends_on: T-E264-01
