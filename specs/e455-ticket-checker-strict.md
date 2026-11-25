# e455-ticket-checker-strict

Ticket: E455 (pre-v5.0.0, wave 1 lane e455 of `specs/fanout-pre-v5-w1.md`). Chain: test-first (pm → qa-engineer → sr-engineer → code-reviewer), no architect. Non-design. No persisted schema change.

## Problem Statement

The ticket-file checker (`tools/ticket-file.ts`, CLI `scripts/check-tickets.mjs`) and the `ticketDir` config rule (`tools/config.ts`) accept tickets and values that `docs/ticket-format.md` / `docs/config.md` say are invalid. Reproduced at the lane base with crafted tickets (PM probe, dist built at base): `### S1 - hyphen not emdash` passes with id `S1 - hyphen not emdash` and an empty title; `### 1bad id with spaces — x` passes; `needs device or person: maybe` only surfaces as a misleading count mismatch; a `Verification:` line inside a fenced code block trips "has more than one verification", and a `Given` that exists only inside a fence satisfies the missing-Given check; `ticketDir` `"."` checks every root `.md` file and whitespace-only reports "no ticket directory" even when `docs/tickets/` exists; `depends on: [E1, [x]]` and `[E1, '']` report `must be a list`; `Added: me, 2026-13-45, why` passes; and a `##` section after `## Added during build` passes while a `###` scenario under it is silently dropped. The checker ships to adopters, so each documented rule must be enforced with an accurate message.

## User Stories

- As a ticket writer, I want a malformed scenario heading or id reported, so that later per-scenario records keyed by id never inherit a merged title.
- As a ticket writer, I want `needs device or person` values other than `yes` / `no` reported as such, so that I am not sent chasing a scenario count.
- As a ticket writer, I want example text inside a fenced code block ignored by the scenario checks, so that quoting an example neither breaks a valid scenario nor hides a missing line.
- As an adopter configuring `ticketDir`, I want `"."` and whitespace-only values treated as unusable, so that the checker never sweeps the repo root or silently checks nothing.
- As a ticket writer, I want a bad list entry and an impossible `Added:` date named precisely, and a section placed after `## Added during build` reported, so that no scenario disappears without a message.

## Acceptance Criteria

Test file (qa-engineer creates it): `test/e455-ticket-checker-strict.test.mjs`. Every test title starts with its AC id followed by a space (`AC1 …`), so the `proof:` name patterns below select exactly that AC's tests. Messages are the Copy / Strings rows, verbatim; the CLI prints each as `check-tickets: <file>: <message>` (existing prefix, unchanged).

- **AC1** — scenario heading and id shape.
  - Given a scenario heading with no ` — ` (space, em dash, space), e.g. `### S1 - hyphen not emdash` or `### S1`, when the ticket is checked, then exactly one `e455.heading-no-separator` problem is reported for that heading (quoting the heading text after `### `), the scenario's `id` is the whole heading text and its `title` is `""` (unchanged parse shape), no `e455.id-shape` problem is added for that heading, and the CLI exits 1.
  - Given a heading with the separator whose id is not a letter followed by letters, digits or `-` (e.g. `### 1bad id with spaces — x`, `### S 1 — x`, `### S_1 — x`), when checked, then one `e455.id-shape` problem quoting the id is reported and the CLI exits 1.
  - Given ids `S1`, `csv-header`, `a`, `Z9-x` with the separator and a title, then no heading/id problem is reported.
  proof: `node --test --test-name-pattern "^AC1 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC2** — Given `needs device or person` is any value other than exactly `yes` or `no` after trimming (e.g. `maybe`, `Yes`, `true`), when checked, then one `e455.yes-no` problem is reported, the count-mismatch line (`"needs device or person" is "…" but N scenario(s) use device-or-person`) is NOT reported for that ticket, `fields["needs device or person"]` is absent, and the CLI exits 1. `yes` / `no` keep today's mismatch behaviour (existing e422 AC6 tests stay green).
  proof: `node --test --test-name-pattern "^AC2 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC3** — fenced lines are not scenario lines, both directions.
  - Given a valid scenario that also holds a fenced block (``` or ~~~ fence) containing `Verification: command x`, when checked, then no "has more than one verification" problem is reported and the ticket is valid (exit 0).
  - Given a scenario whose only `Given` line is inside a fenced block, when checked, then `scenario S1 has no Given line` is reported (exit 1); the same holds for `When`, `Then`, and for a scenario whose only `Verification:` line is fenced (`scenario S1 has no verification`).
  - Given an added-during-build scenario whose only `Added:` line is fenced, then the existing missing-Added message is reported.
  - The fence delimiter lines themselves are not scenario lines either. Headings inside fences stay ignored (existing behaviour).
  proof: `node --test --test-name-pattern "^AC3 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC4** — `ticketDir` and `isNonEmptyString`.
  - Given `.current/.config.json` `ticketDir` is `"."`, `"./"`, `"a/.."`, `"  "`, `"\t"` or `" "`, when `loadConfig` runs, then `ticketDir` is absent from the result, `resolveTicketDir` returns `<workspace>/docs/tickets`, and `getConfigError` is `null` (dropped silently, never an error).
  - Given `ticketDir` is whitespace-only and `docs/tickets/` exists with one valid ticket, when `scripts/check-tickets.mjs` runs with no argument, then it checks `docs/tickets/<file>` (ok line + `1 file(s)` summary), not "no ticket directory".
  - Given `ticketDir` is `"."` and the workspace root holds a non-ticket `.md` file, when the checker runs with no argument, then it does not check the root files (it reports on `docs/tickets`, or the no-directory line when that is absent).
  - Given `sisterRepos` entries whose `path` or `owns` is whitespace-only, when `loadConfig` runs, then those entries are dropped; a whitespace-only `backlog` is left out of its entry and whitespace-only `contracts` strings are dropped (consequence of the shared `isNonEmptyString` trimming). Non-blank values with surrounding spaces (e.g. `owns: " owns ç "`) are still kept verbatim (existing e292 test stays green).
  - Existing usable values `"./x"`, `"a/../b"`, `"..foo/tickets"`, `"work/tickets"` stay usable and verbatim.
  proof: `node --test --test-name-pattern "^AC4 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC5** — Given a list field (`depends on`, `allowed paths`, `source`) whose list holds an entry that is not text (nested list, `name: value` map, or an empty block-sequence item, which YAML reads as null), when checked, then one `e455.entry-not-text` problem per such entry (1-based position) is reported; given an entry that is blank text (`''`, `'  '`), one `e455.entry-empty` problem per such entry; `field "…" must be a list` is NOT reported in either case; the field is absent from `fields`; the CLI exits 1. A scalar written where a list is expected still reports `field "…" must be a list` (existing e422 AC4 test stays green). A `source` list with a bad entry reports only the entry problems (no `source entry … is not "<number> rev <revision>"` line for that field).
  proof: `node --test --test-name-pattern "^AC5 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC6** — Given an added-during-build scenario whose `Added:` line has the documented shape but a date that is not a real calendar date (`2026-13-45`, `2026-02-30`, `2026-00-10`, `2026-04-31`, `2025-02-29`), when checked, then one `e455.added-date` problem quoting the date is reported, the existing `… has no "Added: <who>, <YYYY-MM-DD>, <reason>" line` message is NOT reported for that scenario, and the CLI exits 1. Real dates (`2026-01-15`, `2024-02-29`, `2000-02-29`, `2026-12-31`) are valid. A badly shaped date (`15-01-2026`) keeps the existing missing-Added message (existing e422 AC7 test stays green).
  proof: `node --test --test-name-pattern "^AC6 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC7** — Given a ticket with `## Added during build` followed (outside any fence) by another `##` heading (e.g. `## Notes`, a second `## Scenarios`, or a second `## Added during build`), when checked, then one `e455.section-after-added` problem per such heading is reported (quoting the heading line), and every `###` heading under such a section is reported with one `e455.heading-not-read` problem (quoting the heading line) and is not added to `scenarios`; the CLI exits 1. A ticket whose `## Added during build` is the last `##` section (with or without scenarios under it) reports neither message (the doc example and `templates/ticket.md` stay green).
  proof: `node --test --test-name-pattern "^AC7 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC8** — Given `docs/ticket-format.md` after the change, then: the Scenarios section states the heading must contain ` — ` between id and title; the fenced-code rule is stated (lines inside a fenced code block are not read as headings, Given/When/Then/And, verification or `Added:` lines); the field-block section states every list entry is non-empty text; the `needs device or person` row still says `yes` or `no` and adds that any other value is refused; the added-during-build section states the date must be a real calendar date and that a `##` section after `## Added during build` is reported and scenarios under it are not read. The explanations still hold no link, no repo path, and no ticket id (existing e422 doc tests stay green), and the embedded example still passes the checker.
  proof: `node --test --test-name-pattern "^AC8 " test/e455-ticket-checker-strict.test.mjs` exits 0.
- **AC9** — Given `docs/config.md` lines 185–225 after the change, then the `ticketDir` "Usable value" bullet names whitespace-only values and values that normalize to `.` (the workspace root itself, e.g. `.` or `a/..`) as unusable, and the `sisterRepos` "Which entries are dropped" bullet states that a string of only whitespace counts as empty. No line outside 185–225 of the base file changes.
  proof: `node --test --test-name-pattern "^AC9 " test/e455-ticket-checker-strict.test.mjs` exits 0, and every hunk of `git diff -U0 70d34c6...HEAD -- docs/config.md` starts at a base line within 185–225 (judge-run scope check, not a resident test).
- **AC10** — Given the change is built (`npm run build`), when the full suite runs (`node scripts/test-lock.mjs -- npm test`), then all three `test/e422-*.test.mjs` files are green unedited, `templates/ticket.md` and the doc example still pass the checker, and the suite has zero failing tests (baseline: 0 fail, the two known e130 skips).
  proof: `node scripts/test-lock.mjs -- npm test` prints `# fail 0`.

## Copy / Strings

New or changed checker messages (problem text, without the `check-tickets: <file>: ` prefix). `<…>` marks the interpolated value; quotes shown are literal `"` characters. No message cites a repo path or a ticket id.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e455.heading-no-separator | `scenario heading "<heading>" has no " — " between the id and the title, so its title is empty` | authored-here — E455 (1) re-check: a missing separator also leaves the title empty; `<heading>` = heading text after `### `, trimmed |
| e455.id-shape | `scenario id "<id>" must start with a letter and hold only letters, digits or -` | authored-here — E455 (1): restates the documented id shape (`docs/ticket-format.md` Scenarios) in the message |
| e455.yes-no | `field "needs device or person" must be yes or no, not "<value>"` | authored-here — E455 (2); `<value>` trimmed; matches the existing `field "<name>" must be …` family |
| e455.entry-not-text | `field "<name>" entry <n> is not text` | authored-here — E455 (5): accurate replacement for `must be a list` when the value is a list; `<n>` 1-based |
| e455.entry-empty | `field "<name>" entry <n> is empty` | authored-here — E455 (5): a blank-text entry (`''`) was also reported as `must be a list` |
| e455.added-date | `scenario <id> has an Added date "<date>" that is not a real calendar date` | authored-here — E455 (6); `<id>` unquoted like the other `scenario <id> …` messages |
| e455.section-after-added | `section "<heading line>" comes after "## Added during build", which must be the last section` | authored-here — E455 (7); `<heading line>` = trimmed line incl. `## ` |
| e455.heading-not-read | `heading "<heading line>" is not read as a scenario: it is under a section after "## Added during build"` | authored-here — E455 (7) re-check: the `###` scenario must not be dropped silently; `<heading line>` = trimmed line incl. `### ` |

Unchanged messages that the new rules suppress in specific cases (text not changed): `"needs device or person" is "<v>" but <k> scenario(s) use device-or-person` (not emitted when `e455.yes-no` fires), `field "<name>" must be a list` (not emitted for a list value), `scenario <id> added during build has no "Added: <who>, <YYYY-MM-DD>, <reason>" line` (not emitted when a shape-matching `Added:` line exists).

Doc text (`docs/ticket-format.md`, `docs/config.md` 185–225): sr-engineer authors the sentences to carry exactly the facts AC8 / AC9 list; qa pins them by the regexes in the AC8 / AC9 tests (facts, not whole sentences), so wording stays sr's within those facts. Source: authored-here — documentation of the rules above.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Implementation notes for sr-engineer

- All checker changes stay in `tools/ticket-file.ts`; `scripts/check-tickets.mjs` is NOT changed (not in touches). Exported types / `TicketParseResult` shape unchanged; `TICKET_FIELDS`, `FORBIDDEN_FIELD_NAMES`, `TICKET_STATUSES` unchanged.
- Id shape: `/^[A-Za-z][A-Za-z0-9-]*$/`. Split on the first ` — ` as today. When the separator is missing: `e455.heading-no-separator` only (id = whole heading, title `""`); otherwise test the id shape.
- yes-no: validate in `checkFields` for `kind: "yes-no"`; an invalid value is not stored in `fields`, which already skips the count-mismatch block in `parseTicketFile`.
- List entries: replace the `asTextList` null-path for array values with per-entry problems (non-string → `entry-not-text`; string with `trim() === ""` → `entry-empty`); a non-array value keeps `must be a list`. The `source`-as-scalar-string path is unchanged.
- Fences: in `collectScenarios`, a fence delimiter line and every line while `inFence` is not pushed to `current.lines` (fence pairing logic unchanged: any line starting ``` or ~~~ toggles).
- Calendar date: month 01–12, day 01–days-in-month, Gregorian leap rule (÷4, not ÷100 unless ÷400). Applies to shape-matching `Added:` lines of added-during-build scenarios only.
- After `## Added during build` has been seen (outside a fence), every later `##` heading yields `section-after-added` and switches to a state in which `###` headings yield `heading-not-read` and start no scenario. `#` (h1) headings keep today's behaviour.
- `tools/config.ts`: `isNonEmptyString` = `typeof value === "string" && value.trim().length > 0`; `isUsableTicketDir` additionally rejects a value whose `path.posix.normalize(value.replace(/\\/g, "/"))` is `.` (after stripping one trailing `/`; normalize of `./` is `./`). The surfaced value stays verbatim. Update the two comments above `isUsableTicketDir` / the `ticketDir` interface field if they restate the rule.
- Code comments: no repo-only paths beyond the existing file header line, no bare ticket ids in new comments (comment hygiene).
- `npm run build` after the source change; `dist/tools/ticket-file.*` and `dist/tools/config.*` are committed by the coordinator with the source.

## Test placement and base reads (for qa-engineer)

- One new file `test/e455-ticket-checker-strict.test.mjs` (only name needed; any other new test file name needs the integrator first). Fixtures inline in a temp dir, like `test/e422-ticket-file.test.mjs` (no new `test/fixtures/` files needed). Use the CLI (`spawnSync` of `scripts/check-tickets.mjs`) for exit-code assertions and `parseTicketFile` for parse-shape assertions; import from `dist/`.
- Pin every Copy / Strings message verbatim (exact string equality or a fully escaped regex), and assert the suppressed messages are absent where AC2 / AC5 / AC6 say so.
- AC9's "no hunk outside 185–225" is a judge-run `git diff` scope check, NOT a resident test: the e453 lane edits `docs/config.md` lines 240–290 and the waves merge into one branch, so a test pinning the rest of the file would turn red at merge. The AC9 test asserts only the facts inside the `ticketDir` section and the `sisterRepos` "Which entries are dropped" bullet (sliced by heading, like the e422 / e292 doc tests).
- No test here needs the base tree. If one ever does: freeze the base text as string literals in the test, never `git show` (the T-E77-02 meta-test refuses it), and read anything captured from disk into memory at capture time (a temp dir re-read later hits ENOENT on Node 20). CI runs Node 20 and 22.
- Write `qa_reports/expected-red_e455-ticket-checker-strict.txt` (`<test file> | <exact test name> | reason`) listing every AC1–AC9 test that is red at base, and `qa_reports/tests_e455-ticket-checker-strict.md` (scenario → test map). Tests that pass at base (e.g. the "stays usable" and "real date is valid" guards) are not listed.
- Do not edit the three `test/e422-*.test.mjs` files (owned, but no change is planned; they are the AC10 regression guard). E422 test hardening is wave-2 work (out of scope).

## Out of Scope

- E424 per-scenario records (not built); E461 (7) hardening of the E422 tests (wave 2); E462.
- A `##` section between `## Scenarios` and `## Added during build`, or prose after `## Scenarios` without an added section (doc order not otherwise enforced); `#` (h1) headings after the added section.
- Fence pairing rules (``` vs ~~~ mismatch, unclosed fence) and indented code blocks — unchanged.
- `Added:` lines in ordinary-section scenarios (not checked today; unchanged).
- Trimming the surfaced `ticketDir` / `sisterRepos` values (they stay verbatim); `laneProtocolAddendum` (own check, not `isNonEmptyString`).
- `scripts/check-tickets.mjs`, `templates/ticket.md`, `package.json`, `content/**`, any compose golden or `test/context-budget.test.mjs`.

## Dependencies / Prerequisites

- Base `70d34c6`; E422 (shipped). No external references (Resource Audit: the inputs are the backlog row, the fan-out manifest and in-repo files; zero `http(s)://` / Figma / tracker hits) — `external_refs` omitted.
- **Schema**: no persisted schema change (config `schema_version` stays 2; handoff/tasks/SQLite untouched). **Design**: non-design, no design source.
- **Cross-lane**: `test/context-budget.test.mjs` (e453-owned) does not read `tools/ticket-file.ts`, `tools/config.ts`, `docs/ticket-format.md` or `docs/config.md` (grep: only a comment on line 629 mentions "ticket-file"); compose goldens mention `ticketDir` only as served coordinator text, which this lane does not change. No mailbox item needed.
- **Tests that read this lane's files** (grep of `test/`, literal and regex forms): `test/e422-ticket-file.test.mjs`, `test/e422-ticket-dir-config.test.mjs`, `test/e422-ticket-format-doc.test.mjs` (owned; stay green unedited — checked against every planned message and doc fact: no existing assertion pins `must be a list` for a list value, the count-mismatch line for a non-yes/no value, fenced lines, or `"."`); `test/e292-config-sister-repos.test.mjs` (reads `docs/config.md` sisterRepos section needles `name`, `path`, `owns`, `backlog`, `contracts`, `lane-status.mjs --repo`, `handoff --check`, `外部依賴`, `schema_version` — keep them; its loader cases have no whitespace-only value, and `" owns ç "` stays kept); `test/e342-config-doc-wording.test.mjs`, `test/e289-config-key.test.mjs`, `test/e291-start-link-locations.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/e234-hygiene-scan.test.mjs`, `test/e258b-comment-scan.test.mjs`, `test/e259-comment-scan-limits.test.mjs`, `test/e434-reviewer-visual.test.mjs`, `test/e5-intake-tiering.test.mjs` read other sections of `docs/config.md` (outside 185–225; unaffected); `test/e423-spec-workshop.test.mjs`, `test/e445-spec-workshop-questioning.test.mjs` pin served text naming `docs/ticket-format.md` / `ticketDir` (not changed); `test/agc-adapters.test.mjs`, `test/config-cache.test.mjs`, `test/e22-stale-notify.test.mjs` exercise `loadConfig` on other keys (unaffected). No test reads `tools/ticket-file.ts` or `tools/config.ts` source text.
- **PM probe baseline** (`npm run build` then `node scripts/test-lock.mjs -- npm test` at base, untracked `.current/e455/` only, Node 22): **4579 tests, 4577 pass, 0 fail, 0 cancelled, 2 skipped**. No red file. The 2 skips are pre-existing and known: `test/e130-lane-default.test.mjs` AC4 and AC14, history-dependent, loud `t.skip` because base commit `121ddc8` is not in this history. No red in the manifest's cross-lane table, and nothing new. AC10 baseline = zero reds.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E455 | Ticket checker enforces seven documented rules: scenario heading separator + id shape (empty title reported); `needs device or person` only `yes`/`no`; fenced lines are not scenario lines (both directions); `ticketDir` `"."` / whitespace-only unusable and `isNonEmptyString` trims (sisterRepos whitespace-only values dropped as a consequence); per-entry message for a non-text / empty list entry; `Added:` date must be a real calendar date; a `##` section after `## Added during build` reported and its `###` headings reported, not dropped. Eight new messages (Copy / Strings); `docs/ticket-format.md` and `docs/config.md` (lines 185–225 only) synced; one new test file | E422 | 2 source + 2 docs + `dist/` + 1 new test file | `tools/ticket-file.ts`、`tools/config.ts`、`docs/ticket-format.md`、`docs/config.md`、`test/e455-*.test.mjs`、`specs/e455-ticket-checker-strict.md` | — |

## Tasks

Cut notes: `docs/config.md` is written in lines 185–225 only (manifest 所有權重劃). `dist/tools/ticket-file.*` and `dist/tools/config.*` are the tracked build product of the two source files (lane-protocol addendum §3), committed with them. `scripts/check-tickets.mjs` and the three `test/e422-*.test.mjs` files are owned but not touched. No `tools/*.ts` file is added (no CLAUDE.md Layout row). No compose golden, no `test/context-budget.test.mjs`, no `content/**`.

Order (test-first chain): qa T-E455-01 → sr T-E455-02 … T-E455-06 (in id order) → code-reviewer judges every task and writes PASS. sr never edits a qa-written test; any red sr leaves is appended to the expected-red manifest with its reason.

- [ ] T-E455-01 [P0] qa-engineer: new `test/e455-ticket-checker-strict.test.mjs`, tests for AC1–AC9 (titles start `AC<n> `; Copy / Strings pinned verbatim; suppressed messages asserted absent; AC3 both directions; base reads in memory, no `git show`); `qa_reports/expected-red_e455-ticket-checker-strict.txt` and `qa_reports/tests_e455-ticket-checker-strict.md` | depends_on: none
- [ ] T-E455-02 [P0] sr-engineer: `tools/ticket-file.ts` scenario heading separator + id shape (AC1) and fenced lines excluded from scenario lines (AC3) | depends_on: T-E455-01
- [ ] T-E455-03 [P0] sr-engineer: `tools/ticket-file.ts` `needs device or person` yes/no check (AC2) and per-entry list messages (AC5) | depends_on: T-E455-02
- [ ] T-E455-04 [P0] sr-engineer: `tools/ticket-file.ts` real calendar `Added:` date (AC6) and sections after `## Added during build` reported with their `###` headings (AC7) | depends_on: T-E455-03
- [ ] T-E455-05 [P0] sr-engineer: `tools/config.ts` `isNonEmptyString` trims and `isUsableTicketDir` rejects a value normalizing to `.` (AC4) | depends_on: T-E455-01
- [ ] T-E455-06 [P0] sr-engineer, last implementation task: `docs/ticket-format.md` (AC8) and `docs/config.md` lines 185–225 (AC9) synced; `npm run build`; full suite `node scripts/test-lock.mjs -- npm test` with no red beyond the baseline (AC10) | depends_on: T-E455-04, T-E455-05
