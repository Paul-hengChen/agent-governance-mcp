<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E429-01 sr-engineer: `agc feature start` copies the primary checkout's .current/.config.json into the new lane when the lane has none after checkout (COPYFILE_EXCL, never overwrite), prints one line naming the copy; no file created when primary has none. File: bin/agc-init.mjs
- [x] T-E429-02 sr-engineer: docs/lane-protocol.md states the lane config is a snapshot taken when the lane opens, later primary changes do not reach an open lane, and names the manual copy. File: docs/lane-protocol.md
- [x] T-E429-03 qa-engineer: one new test file covering the four acceptance scenarios of backlog row E429 (local-artifacts copy + output line; tracked-artifacts no copy; no primary config → no file, success; loadConfig on the lane path returns the primary's cutApprovalAutoTier). Verify under Node 20 and 22.
