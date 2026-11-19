<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E422-01 [P0] sr-engineer: tools/ticket-file.ts parser + checker core (TICKET_FIELDS, FORBIDDEN_FIELD_NAMES, parseTicketFile, runCheckTicketsCli), thin scripts/check-tickets.mjs, npm run build (dist/tools/ticket-file.* only) — spec specs/e422-ticket-file-format.md | depends_on: none
- [ ] T-E422-02 [P1] sr-engineer: ticketDir key + DEFAULT_TICKET_DIR + resolveTicketDir in tools/config.ts (surfaced only when present), package.json check:tickets line, npm run build (dist/tools/config.*); docs/ticket-format.md (self-contained; fields, verification forms incl. backfill, append rule, status forms, forbidden list, backlog-index convention, embedded ## Example ticket), templates/ticket.md, docs/config.md ticketDir section after sisterRepos; template and example pass the checker | depends_on: T-E422-01
- [ ] T-E422-03 [P1] qa-engineer: test/e422-*.test.mjs for AC1-AC10 (inline tmp fixtures, no test/fixtures/**); run AC11 (13 config test files, 213/213) and AC12 (dist/package.json diff) commands and the full suite | depends_on: T-E422-02
