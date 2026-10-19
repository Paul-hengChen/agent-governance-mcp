<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E290-01 [P0] sr-engineer: rewrite docs/lane-protocol.md per specs/e290-lane-protocol-generic.md Line disposition (Copy strings verbatim); create docs/lane-protocol-addendum.md byte-verbatim from addendum.file; insert the one laneProtocolAddendum line into .current/.config.json — all in ONE commit (E289 D6); no dist/ change | depends_on: none
- [x] T-E290-02 [P0] qa-engineer: new test/e290-lane-protocol-generic.test.mjs (AC-E290-2,3,5,7,8,9); re-pin lane-protocol assertions only in e286 AC5/AC6 and e329 AC-E327-2 (AC-E290-11); e294 untouched unless red; verify AC-E290-1,4,6,10,12,14; full suite after commit | depends_on: T-E290-01
