<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E223-01 [P0] sr-engineer: in tools/lane-status.ts, default watch set only — a --baseline key naming no listed lane is reported `[<lane>] gone` after the watched-lane start lines (in --baseline order), not counted in `armed:` N, not carried in re-arm; --lanes unknown key + malformed/bad fp/duplicate/empty stay exit 64 (spec decisions a–f, AC1–AC5); rebuild dist/tools/lane-status.* (AC6) | depends_on: none
- [x] T-E223-02 [P0] qa-engineer: author test/e223-watch-rearm-gone.test.mjs (AC1–AC4), update test/e178b-lane-watch.test.mjs "AC5 re-arm round trip" usage-error loop (AC5), run build-no-diff + full npm test post-commit (AC6) | depends_on: T-E223-01
