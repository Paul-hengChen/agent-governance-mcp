<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E351-01 [P0] sr-engineer: edit docs/lane-protocol.md per specs/e351-lane-protocol-gaps.md Copy / Strings — §1 replace copy.s1-old with copy.s1-fallback (E352); §3 insert copy.s3-local, copy.s3-harvest, copy.s3-gaps directly after copy.s3-commit-kept; §4 insert copy.s4-local directly after copy.s4-commit-kept (E351). 1 line removed, 5 added, nothing else; no dist/ rebuild; commit title carries E351 E352 | depends_on: none
- [ ] T-E351-02 [P0] qa-engineer: new test/e351-lane-protocol-gaps.test.mjs (AC-E352-1/2, AC-E351-1..5, AC-E351-6(d)); verify AC-E352-3 and AC-E351-6(a-c,e) via unchanged e290/e294 + diff count; full suite after commit on a clean tree (AC-E351-7); scope check (AC-E351-8). e290/e294 expected green unmodified | depends_on: T-E351-01
