<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E444-01 [P1] sr-engineer: agc init --adapter=shared|local — parse/validate flag, ADAPTER_LOCAL_EXCLUDE_RULES (separate constant), B' default placement, CLAUDE.local.md write + exclude upsert, removal notice (ruling 2), tracked-CLAUDE.md suggestion, outside-git note, unsafe-segment refusal, STR_USAGE (bin/agc-init.mjs; spec AC1-AC7) | depends_on: none
- [ ] T-E444-02 [P1] sr-engineer: agc check — block-in-either-file stale rule (decision (i)), duplicate advisory, adapterIndexFlags helper + skip-worktree / assume-unchanged advisories, exit code unchanged (bin/agc-init.mjs; spec AC8-AC11) | depends_on: T-E444-01
- [ ] T-E444-03 [P1] sr-engineer: agc eject — CLAUDE.local.md block entry, /CLAUDE.local.md exclude-line removal with new wording, cannot-do item 5 for flagged adapter files (bin/agc-init.mjs; spec AC12-AC13) | depends_on: T-E444-01, T-E444-02
- [ ] T-E444-04 [P2] sr-engineer: agc feature start copies an ignored untracked CLAUDE.local.md into the lane (decision (g), no lane-paths call) + STR_USAGE_FEATURE wording + docs/install.md team-file section and check/eject/feature-start doc updates (bin/agc-init.mjs, docs/install.md; spec AC14-AC16) | depends_on: T-E444-01, T-E444-02, T-E444-03
- [ ] T-E444-05 [P1] qa-engineer: write test/e444-claude-local-adapter.test.mjs (one test per AC1-AC15, scratch git repos), run node scripts/test-lock.mjs -- npm test, confirm expected red list (none); any red in an e432-owned or shared file -> mail the integrator (spec AC1-AC17) | depends_on: T-E444-01, T-E444-02, T-E444-03, T-E444-04
