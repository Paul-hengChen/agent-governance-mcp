# Judge report — T-E455-01

covers: T-E455-01, T-E455-02, T-E455-03, T-E455-04, T-E455-05, T-E455-06

## Round 1 — APPROVED — by code-reviewer

Feature `e455-ticket-checker-strict`, head `d03392d`, base `70d34c6`. Suite run by the judge after `npm run build` (dist byte-identical to the committed tree): `node scripts/test-lock.mjs -- npm test` → `# tests 4613`, `# pass 4611`, `# fail 0`, `# cancelled 0`, `# skipped 2` (test/e130-lane-default.test.mjs AC4 and AC14, history-dependent loud skips, known baseline), exit 0. Node 22.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e455-ticket-checker-strict.txt`, 26 entries. Actual reds in the full suite: 0.

- All 26 manifest entries (AC1 ×2, AC2 ×1, AC3 ×5, AC4 ×4, AC5 ×4, AC6 ×1, AC7 ×2, AC8 ×5, AC9 ×2) — scenario tests, now green — built by T-E455-02..06 (each matched to an `ok` line in the suite log; the three titles holding `##` appear TAP-escaped as `\#\#`).
- Actual reds not on the manifest: none.

## AC Execution Log

| AC | command | raw outcome | result |
|---|---|---|---|
| AC1 | `node --test --test-name-pattern "^AC1 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 3`, `# fail 0` | pass |
| AC2 | `node --test --test-name-pattern "^AC2 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 2`, `# fail 0` | pass |
| AC3 | `node --test --test-name-pattern "^AC3 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 5`, `# fail 0` | pass |
| AC4 | `node --test --test-name-pattern "^AC4 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 5`, `# fail 0` | pass |
| AC5 | `node --test --test-name-pattern "^AC5 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 5`, `# fail 0` | pass |
| AC6 | `node --test --test-name-pattern "^AC6 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 3`, `# fail 0` | pass |
| AC7 | `node --test --test-name-pattern "^AC7 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 3`, `# fail 0` | pass |
| AC8 | `node --test --test-name-pattern "^AC8 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 6`, `# fail 0` | pass |
| AC9 | `node --test --test-name-pattern "^AC9 " test/e455-ticket-checker-strict.test.mjs` | exit 0, `# pass 2`, `# fail 0` | pass |
| AC9 (scope) | `git diff -U0 70d34c6 -- docs/config.md` hunk headers | `@@ -185 +185 @@`, `@@ -208 +208 @@` — both within base lines 185–225 | pass |
| AC10 | `node scripts/test-lock.mjs -- npm test` | exit 0, `# fail 0` (4611/4613 pass, 2 known e130 skips); `node --test test/e422-*.test.mjs` → `# pass 79`, `# fail 0`; e422 files absent from `git diff --name-only 70d34c6..HEAD`; `scripts/check-tickets.mjs templates/ticket.md` → exit 0, `ok templates/ticket.md (1 scenarios)` | pass |

Judge probes of the built checker (`dist/tools/ticket-file.js`, `dist/tools/config.js`), crafted inputs outside the test file:

| probe | outcome |
|---|---|
| `### S1 - hyphen not emdash` | one `scenario heading "S1 - hyphen not emdash" has no " — " between the id and the title, so its title is empty`; id = whole heading, title `""` |
| `### 1bad id — x` | one `scenario id "1bad id" must start with a letter and hold only letters, digits or -` |
| `needs device or person: maybe` (with a device-or-person scenario) | only `field "needs device or person" must be yes or no, not "maybe"`; no count-mismatch; field absent |
| fenced extra `Verification: command x` in a valid scenario | no problem |
| Given only inside a `~~~` fence | `scenario S1 has no Given line` |
| `depends on: [E1, [x]]` / `[E1, '']` | `field "depends on" entry 2 is not text` / `... entry 2 is empty`; no `must be a list` |
| `depends on: E1` (scalar) | `field "depends on" must be a list` (unchanged) |
| `Added: me, 2026-13-45, why` / `2026-02-30` | one `scenario S2 has an Added date "<date>" that is not a real calendar date`; no missing-Added; `2024-02-29` valid |
| `## Notes` + `### S3 — x` after `## Added during build` | `section "## Notes" comes after "## Added during build", which must be the last section` and `heading "### S3 — x" is not read as a scenario: ...`; S3 not in scenarios |
| fenced `## Notes` after the added section | no problem |
| `ticketDir` `"."`, `"./"`, `"a/.."`, `"a/../"`, `"./."`, `"   "` with `docs/tickets/t.md` and a root `CHANGELOG.md` | config drops the key, `getConfigError` null, CLI exit 0 checks only `docs/tickets/t.md` |
| `sisterRepos` with whitespace-only `path` / `owns` / `backlog` / one `contracts` entry | those entries / keys dropped; `owns: " o "` kept verbatim |
## 2026-11-25T07:07:43.260Z — PASS — by code-reviewer

suite-result: 4611/4613 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED. AC1-AC10 implemented and proven: per-AC proof commands exit 0 (34/34 e455 tests), AC9 scope check (docs/config.md hunks at base lines 185 and 208 only), full suite 4611/4613 with 0 fail and the 2 known e130 skips, e422 files 79/79 unedited. All 26 expected-red entries green, no off-manifest red. Copy / Strings messages verbatim (8 rows); judge probes of the built checker confirm each of the seven E455 items plus the re-check corrections (both fence directions, ticketDir '.'/whitespace with docs/tickets present, ### under a later ## reported not dropped). dist/ byte-identical to a fresh npm run build; tsc --noEmit clean, no any; all changed paths in the lane's owned set. Recommended (non-blocking): test file header is 9 comment lines (agc check limit 7). Optional: ticketDir ' . ' kept verbatim (spec out of scope); a ticket with Added during build before Scenarios now reports three kinds of message. review_report: review_reports/review_T-E455-01.md

