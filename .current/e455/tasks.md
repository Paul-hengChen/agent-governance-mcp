<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E455-01 [P0] qa-engineer: new test/e455-ticket-checker-strict.test.mjs, tests for AC1-AC9 (titles start "AC<n> "; Copy / Strings pinned verbatim; suppressed messages asserted absent; AC3 both directions; no git show of base) + qa_reports/expected-red_e455-ticket-checker-strict.txt + qa_reports/tests_e455-ticket-checker-strict.md | depends_on: none
- [ ] T-E455-02 [P0] sr-engineer: tools/ticket-file.ts scenario heading separator + id shape (AC1) and fenced lines excluded from scenario lines (AC3) | depends_on: T-E455-01
- [ ] T-E455-03 [P0] sr-engineer: tools/ticket-file.ts needs-device-or-person yes/no check (AC2) and per-entry list messages (AC5) | depends_on: T-E455-02
- [ ] T-E455-04 [P0] sr-engineer: tools/ticket-file.ts real calendar Added: date (AC6) and sections after "## Added during build" reported with their ### headings (AC7) | depends_on: T-E455-03
- [ ] T-E455-05 [P0] sr-engineer: tools/config.ts isNonEmptyString trims and isUsableTicketDir rejects a value normalizing to "." (AC4) | depends_on: T-E455-01
- [ ] T-E455-06 [P0] sr-engineer, last implementation task: docs/ticket-format.md (AC8) and docs/config.md lines 185-225 (AC9) synced; npm run build; full suite node scripts/test-lock.mjs -- npm test with no red beyond the baseline (AC10) | depends_on: T-E455-04, T-E455-05
