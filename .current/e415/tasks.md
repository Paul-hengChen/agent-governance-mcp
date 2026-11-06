<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E415-01 sr-engineer: reword the two content/coord-03-core-fallback.md sites (PASS Escalation Routes row; Backlog Intake Loop Bounds) so the release is a human decision carried out by dispatching the Release workflow (docs/release-cd.md), release-engineer named as its manual fallback; keep the no-auto-hop bound and the exact pinned sentence "this loop NEVER auto-hops to release-engineer"
- [x] T-E415-02 qa-engineer: re-capture the compose goldens for the coord-03 change, confirm the e5 intake-tiering pin and the context-budget caps still hold, run the full suite on the committed branch
- [x] T-E415-03 sr-engineer: make the two coord-03 sites workspace-generic — drop the repo-only `Release` workflow / docs/release-cd.md citation; say the release is a deliberate human decision made through the project's own release process, release-engineer being agc's release role; keep the no-auto-hop bound and every test pin
- [x] T-E415-04 qa-engineer: re-capture the coordinator compose golden for the T-E415-03 wording, re-check pins and context budget, full suite on the committed branch
