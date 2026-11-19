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
`[]`.

Some characters have a meaning of their own in YAML. Put a text value, or one entry of a list, in double
quotes `"…"` when it contains `: ` (a colon and a space) or ` #` (a space and a hash), or when it starts with
one of `[ ] { } , # & * ! | > ' " % @` or a backtick; inside a list, also quote an entry that contains a comma.
Without quotes, ` #` starts a comment and everything from it to the end of the line is silently dropped, and
the other cases make the field block invalid or change the value. For example:

```
title: "Retry 3 times #flaky"
allowed paths: ["**/*.md", src/export/csv.ts]
status: "stopped — blocked by #123"
```

| field | required | what to write |
|---|---|---|
| `id` | yes | The ticket's short identifier, for example `E900`. Unique among the ticket files. |
| `title` | yes | One line that names the change. |
| `priority` | yes | How urgent the ticket is, for example `P0` (most urgent) to `P3`. The format does not fix a scale; use the one your team uses. |
| `depends on` | yes | A list of ticket ids that must be finished before this one starts. Write `[]` when there are none. |
| `allowed paths` | yes | A list of the repository paths (or glob patterns such as `src/export/*.ts`) this ticket may change. Paths are relative to the repository root. The list must not be empty. |
| `needs device or person` | yes | `yes` or `no`. It is `yes` exactly when at least one scenario is verified by `device-or-person` (see below), so a reader can tell at a glance that the ticket cannot be finished by automation alone. |
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

Under `## Scenarios`, each scenario starts with a heading `### <scenario id> — <short title>`. The scenario id
starts with a letter, then letters, digits or `-` (for example `S1`, `csv-header`), and is unique in the file.

The heading is followed by:

- at least one `Given` line (the starting situation), one `When` line (the action) and one `Then` line (the
  observable result); `And` lines may continue any of them;
- exactly one verification line.

Each of these lines may be written as a list item (`- Given ...`) so that it shows on its own line when the
Markdown is rendered.

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

Existing scenarios are never edited or removed while the work is under way. If one has to change or go, the
ticket is stopped (`stopped — <reason>`) and re-agreed instead.

## Where ticket files are listed

The project's backlog stays the index of all work. A backlog entry for a ticket that has a ticket file points
at it by the ticket file's path relative to the repository root. Older backlog entries without a ticket file
are not converted.

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
