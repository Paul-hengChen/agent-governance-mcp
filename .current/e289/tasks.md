<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E289-01 [P2] sr: laneProtocolAddendum config key (WorkspaceConfig + non-fatal filter, no schema bump) + docs/config.md section; rebuild dist. qa: test/e289-config-key.test.mjs (AC-E289-1..3) — spec specs/e289-render-addendum.md | depends_on: none
- [x] T-E289-02 [P2] sr: PROMPT_TEMPLATE_3B EnterWorktree line + render two-layer pointer (install-root resolution D2, errors ADDENDUM_INVALID/ADDENDUM_ABSENT/LANE_PROTOCOL_ABSENT/CONFIG_UNREADABLE); rebuild dist. qa: re-pin E177a render golden (one added line), test/e289-render-addendum.test.mjs (AC-E289-4..10) | depends_on: T-E289-01
- [x] T-E337-01 [P3] sr: HANDOFF_SUBITEMS comment drops "in order", states order not checked; rebuild dist. qa: test/e337-subitem-order.test.mjs (AC-E337-1) | depends_on: T-E289-02
- [x] T-E338-01 [P3] sr: backtick before ** never opens bold in the handoff absolute-path start pattern; other boundaries unchanged; rebuild dist. qa: test/e338-backtick-glob.test.mjs (AC-E338-1..3) + validate baseline sweep (AC-HC-1) | depends_on: T-E337-01
- [x] T-E339-01 [P3] sr: handoff git status fact runs git -c core.quotePath=false; HANDOFF_GIT_FAILED subcommand lookup skips -c value; rebuild dist. qa: test/e339-non-ascii-manifest.test.mjs (AC-E339-1..3) | depends_on: none
