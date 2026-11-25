# Ticket file format

A ticket is one Markdown file. It says what will change, which files may change, and how each expected
behaviour will be checked. Anyone can work from the file alone: it needs no tool, account or tracker to read.

A ticket file has three parts, in this order:

1. a **field block** at the very top,
2. optional free prose (for example a `## Context` section),
3. a `## Scenarios` section, and, when scenarios were added during the work, an `## Added during build`
   section at the end.

## Field block

The file starts with a line holding only `---`. The field block ends at the next line holding only `---`.
The block is YAML front matter: between the two `---` lines, each line is `name: value`. Field names are plain
lower-case words. Values are not converted to numbers or true/false: `no` stays the word `no`, and `007` stays
`007`. A list is written in square brackets, entries separated by commas: `[first, second]`; an empty list is
`[]`. Every entry of a list must be non-empty text: a nested list, a `name: value` pair or a blank entry such as
`''` is reported by its position in the list.

Many characters have a meaning of their own in YAML, so write each value, and each entry of a list, like this:

- A value made only of letters, digits, spaces and the characters `.` `/` `_` `-` `—` may be written as it
  is, as long as it does not start with `-`.
- Anything else goes in single quotes `'…'`. When in doubt, quote it: quoting is always allowed and never
  changes the value.

Inside single quotes every character stays exactly as written, including `\`, `#`, `:`, brackets and commas.
The one exception is the single quote itself, which is written twice: `it's` becomes `'it''s'`. Do not use
double quotes `"…"`: inside them a backslash starts an escape, so `\n` silently turns into a line break.
Without quotes, ` #` starts a comment that silently drops the rest of the line, and other characters make the
field block invalid or change the value. For example:

```
title: 'Retry 3 times #flaky on C:\temp\new'
allowed paths: ['**/*.md', 'app/[id]/page.tsx', src/export/csv.ts]
status: 'stopped — vendor''s firmware: late'
```

| field | required | what to write |
|---|---|---|
| `id` | yes | The ticket's short identifier, for example `E900`. Unique among the ticket files. |
| `title` | yes | One line that names the change. |
| `priority` | yes | How urgent the ticket is, for example `P0` (most urgent) to `P3`. The format does not fix a scale; use the one your team uses. |
| `depends on` | yes | A list of ticket ids that must be finished before this one starts. Write `[]` when there are none. |
| `allowed paths` | yes | A list of the repository paths (or glob patterns such as `src/export/*.ts`) this ticket may change. Paths are relative to the repository root. The list must not be empty. |
| `needs device or person` | yes | `yes` or `no`; any other value, such as `Yes` or `maybe`, is refused. It is `yes` exactly when at least one scenario is verified by `device-or-person` (see below), so a reader can tell at a glance that the ticket cannot be finished by automation alone. |
| `status` | yes | One of the status values below. |
| `source` | no | Leave it out or empty, unless the ticket was cut from an issue-tracker item. Then it is a list of `<item number> rev <revision>` entries, for example `[1234 rev 7]`: the tracker's item number and the item's revision when the ticket was written. Write the number only, never a link. Leave it empty in a public repository. |

A required field written with no value counts as missing.

### Status values

| value | meaning |
|---|---|
| `not started` | Nobody has started the work. |
| `done` | Every scenario is met and verified. |
| `stopped — <reason>` | Work stopped before it was done. The reason follows an em dash (`—`) on the same line, for example `stopped — waiting on vendor firmware`. A bare `stopped` with no reason is not valid. |

No other value is valid; "in progress" is deliberately not a status, because who is working on what is not
recorded in the ticket.

### Field names that are not allowed

A ticket describes the work, not the tools that move it along. These field names belong to orchestration
tooling and are refused:

- `next_role`
- `agent_id`
- `handoff`
- `lane`
- `round`
- `evidence`
- `dispatch`

A field name is refused when, after lower-casing it and splitting it into words on spaces, `_` and `-`, it
contains one of the names above as consecutive words. So `next role`, `Review-Round` and
`dispatch mechanism` are refused, while `id` is fine. Any other name that is not in the field table is refused
as an unknown field, so that every field in every ticket is one this document explains.

## Scenarios

Under `## Scenarios`, each scenario starts with a heading `### <scenario id> — <short title>`. The heading must
hold ` — ` (a space, an em dash and a space) between the scenario id and the title; a heading without it is
reported, because its title would be empty. The scenario id starts with a letter, then letters, digits or `-`
(for example `S1`, `csv-header`), and is unique in the file.

The heading is followed by:

- at least one `Given` line (the starting situation), one `When` line (the action) and one `Then` line (the
  observable result); `And` lines may continue any of them;
- exactly one verification line.

Each of these lines may be written as a list item (`- Given ...`) so that it shows on its own line when the
Markdown is rendered.

Lines inside a fenced code block (opened and closed by a line starting with three backticks or three tildes)
are not read as part of a scenario: a heading, a `Given`, `When`, `Then` or `And` line, a verification line or
an `Added:` line written there is only quoted text, so it neither counts for the scenario nor breaks it.

### Verification forms

A verification line says how the scenario will be checked. Each scenario has exactly one:

| verification line | meaning |
|---|---|
| `Verification: automated test` | An automated test will check this scenario; its name is not known yet. |
| `Verification: test <test file path> — <test title>` | The automated test that checks this scenario: the test file's repository path, an em dash, and the test's title. |
| `Verification: command <command>` | A command anyone can run from the repository root; it passes when it exits with status 0. |
| `Verification: device-or-person` | A real device or a person must check it. Add what to check after a colon: `Verification: device-or-person: <what to check>`. |

### Filling in the test name later

Whoever writes the ticket may write `Verification: automated test` before the test exists. Once the test
exists, that line is replaced by `Verification: test <test file path> — <test title>`. This edit touches only
the verification line; it does not change the scenario.

### Scenarios added during the work

The scenarios are agreed before the work starts. If a new scenario turns up while the work is being done, it is
appended at the end of the file under the last section, `## Added during build`, in the same shape as any other
scenario plus one line saying who added it, when and why:

```
Added: <who>, <YYYY-MM-DD>, <reason>
```

The date must be a real calendar date: `2026-02-30` or `2026-13-01` is refused. `## Added during build` is the
last section of the file: any `##` section after it is reported as a problem, and the scenarios under such a
section are not read.

Existing scenarios are never edited or removed while the work is under way. If one has to change or go, the
ticket is stopped (`stopped — <reason>`) and re-agreed instead.

## Where ticket files are listed

The project's backlog stays the index of all work. A backlog entry for a ticket that has a ticket file points
at it by the ticket file's path relative to the repository root. Older backlog entries without a ticket file
are not converted.

## Named tests checked in CI

A project may check, on every push and pull request, that the tests its finished tickets name exist and
passed, using the test runner's own result file rather than anyone's report. The check reads every ticket
whose status is `done`; `not started` and `stopped — <reason>` tickets are not checked, since their tests may
not exist yet. Within a `done` ticket it checks only scenarios verified by
`Verification: test <test file path> — <test title>`. An unnamed `automated test`, a `command` and a
`device-or-person` verification are out of scope: they name no test to look up.

A named test is found when both halves match one test in the result file:

- the test file path equals the file the runner recorded for the test, relative to the repository root
  (a leading `./` is ignored);
- the test title equals the test's full nested title: the names of its enclosing groups (for example
  `describe` blocks, or a parent test that holds subtests), from the file's top level down to the test itself,
  joined by ` > ` (a space, `>` and a space). A test at the top level of its file has its own name as full
  nested title. Case and spaces count. A name that resolves to a group matches the group as a whole.

The check fails for a named test that is not found, was skipped (a todo test counts as skipped) or failed,
and for a `done` ticket whose own format has problems. When no `done` ticket names a test, it passes without
reading the result file.

Another project that uses a different test runner supplies one function, `readResults(resultsPath)`. It reads
the runner's result file at `resultsPath` and returns a list with one entry per test (and per group), each an
object `{ file, title, status }`: `file` is the test file path as described above, `title` the full nested
title, and `status` one of `passed`, `failed` or `skipped`. When the same test appears more than once, the
worst status counts: failed, then skipped, then passed.

Renaming a test that a `done` ticket names makes the check report it as not found. A change that renames such
a test therefore updates the ticket's verification line in the same change.

## Example ticket

```markdown
---
id: E900
title: CSV export adds a header row
priority: P2
depends on: [E899]
allowed paths: [src/export/csv.ts, test/export-csv.test.ts]
needs device or person: yes
status: not started
source:
---

## Context

Exported CSV files have no header row, so spreadsheet users cannot tell the columns apart.
Column order and quoting rules do not change.

## Scenarios

### S1 — Header row comes first

- Given a report with the columns date, amount and note
- When the report is exported as CSV
- Then the first line is date,amount,note
- And every later line is a data row
- Verification: test test/export-csv.test.ts — first line is the header row

### S2 — Empty report still has a header

- Given a report with no rows
- When the report is exported as CSV
- Then the file holds exactly one line, the header row
- Verification: automated test

### S3 — Opens cleanly in a spreadsheet application

- Given an exported CSV file with 3 rows
- When it is opened in a desktop spreadsheet application
- Then the header row shows as the first row and the columns line up
- Verification: device-or-person: open the file and compare the columns

## Added during build

### S4 — Header names are quoted when needed

- Given a column named "amount, net"
- When the report is exported as CSV
- Then that header cell is written in double quotes
- Verification: command npm test -- export-csv
- Added: the implementer, 2026-01-15, a column name with a comma broke the header row
```

## Checking with this repository's tooling

In this repository, `node scripts/check-tickets.mjs [<file or directory> ...]` (also `npm run check:tickets`)
checks ticket files against this format. With no argument it checks every `.md` file directly inside the
ticket directory, except `README.md`; the directory is the `ticketDir` key of `.current/.config.json`, default
`docs/tickets`. It prints one line per problem, or `check-tickets: ok <file> (<n> scenarios)` per valid file,
then a summary line. Exit status: 0 when every file is valid, 1 when any problem is found, 2 when it cannot run.

The CI check of named tests is `node scripts/check-scenario-tests.mjs --results <file> [--tickets <dir>]
[--adapter <module>]`. It reads the same ticket directory, and reads the results through the default adapter
`scripts/scenario-results-node.mjs`, whose `readResults` reads Node's JUnit output; `--adapter` loads another
module that exports `readResults`, resolved from the working directory. The same file is also a Node test
reporter that writes that JUnit output with each test's file recorded. In `.github/workflows/ci.yml` the
`Test` step runs the suite with that reporter writing `$RUNNER_TEMP/test-results.xml`, and the next step,
`Check ticket scenario tests`, runs the checker on it even when `Test` failed. It prints one line per problem
naming the ticket id, scenario id and test, then a summary line. Exit status: 0 when every named test of every
`done` ticket passed or there is none, 1 when any problem is found, 2 when it cannot run (usage error,
unreadable ticket directory, unreadable or unparseable results, adapter without `readResults`).
