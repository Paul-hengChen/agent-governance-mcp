# e422-ticket-file-format

Backlog ticket E422 (`docs/backlog.md` E422 row, including the 2026-11-18 Addendum and the 2026-11-19 Audit
amendment, which wins where they conflict). Fan-out lane `e422` of `specs/fanout-v5-w1.md` (row, ownership,
scope cut and ruling 1 = (a) are human-approved there and are not re-asked here). Rulings this cut implements:
`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` §11.4 rulings 9–12, §11.6 (the four format rules),
§15.2 rulings 1 and 5, §16.1 rulings 11 and 12.

## Problem Statement

A ticket today is one table cell of free prose in `docs/backlog.md`: it has no structured acceptance list, no
machine-readable list of the paths it may change, and nothing that a person or agent without this tooling can
act on. The v5.0.0 flow needs one tracked file per new ticket, in a tool-neutral format: Markdown with a leading
field block and Given/When/Then scenarios, each scenario carrying exactly one verification. This ticket defines
that format in a self-contained document, ships a template, a parser and a checker, and adds the
ticket-directory config key. It migrates nothing: existing backlog rows stay as they are, and backlog rows point
at ticket files by path from the first ticket file on (written by E423's `spec-workshop`).

## User Stories

- As an engineer or agent without this tooling, I want one ticket file that names its fields in plain words and
  explains them in one document, so that I can start work from the file alone.
- As the person who writes tickets, I want a template and a checker, so that a ticket with a missing field, a
  scenario without a verification, an unknown status or a tooling-vocabulary field name is caught before work
  starts.
- As a later tool (E423 `spec-workshop`, E424, E425, E427, E428), I want a parser with a fixed, documented shape,
  so that I read ticket files the same way the checker does.
- As a workspace owner, I want the ticket directory to be a config key with a default, so that I can put ticket
  files where my repo keeps documents.

## Decisions (each needs human approval with this cut)

**D1 — config key name and default directory.** Recommendation: key `ticketDir`, default `docs/tickets`.

| option | value | worked example (ticket E900 in an adopter repo) | what breaks |
|---|---|---|---|
| (a) recommended | `ticketDir`, default `docs/tickets` | ticket file `docs/tickets/E900-csv-header-row.md`; the backlog row's ticket cell says `docs/tickets/E900-csv-header-row.md`; `npm run check:tickets` with no config checks that directory | nothing; `docs/` is where this repo and most adopters keep tracked documents |
| (b) | `ticketDir`, default `tickets` | `tickets/E900-csv-header-row.md` at the repo root | every adopter gains a new root directory |
| (c) | `ticketDir`, default `.current/tickets` | `.current/tickets/E900-…md` | in a team repo with `artifacts: "local"`, `.current/` is kept out of git, so the ticket file, which §11.6 says goes into git, would be untracked; rejected |

Key-name alternatives `ticketsDir` / `ticketPath` were considered; `ticketDir` follows the existing camelCase
singular style (`laneProtocolAddendum`, `staleDispatchNotifyFile`).

Where the default is applied (probe-backed, see Dependencies): `loadConfig` surfaces `ticketDir` only when the
key holds a usable value, exactly like `laneProtocolAddendum`; the default lives in an exported constant
`DEFAULT_TICKET_DIR` and is applied by a new resolver `resolveTicketDir(workspacePath)` in `tools/config.ts`,
the same split as `taskPaths` / `resolveTaskPaths`. Injecting the default into the `loadConfig` result instead
was probed and turns 4 existing tests red (listed under Dependencies), so it is not chosen.

Usable value: a non-empty string that is relative (not POSIX/Windows absolute, no drive prefix), does not start
with `~`, and does not normalize to a path whose first segment is `..`. Anything else is dropped silently and the
default applies (non-fatal, same as every other key). No `schema_version` change.

**D2 — `check:tickets` in `package.json`.** Recommendation: yes, one line
`"check:tickets": "node scripts/check-tickets.mjs"`. Worked example: in this repo today there is no
`docs/tickets/`, so `npm run check:tickets` prints the no-directory line and exits 0; after E423 writes the first
ticket file there, the same command checks it. Not wired into `npm test` or CI (that is E427). Option "no": users
run `node scripts/check-tickets.mjs` directly; nothing else differs.

**D3 — architect hop.** Recommendation: skip, route pm → sr-engineer. One new module (`tools/ticket-file.ts`)
with one consumer (the checker script), one additive config key, no MCP tool, no handoff/schema change, no gate.
The public interface (field names, scenario syntax, messages) is fixed by this spec, so there is no open
interface question for an architect to settle.

**D4 — field-block syntax.** Recommendation: YAML front matter (a `---` line, `key: value` lines, a `---` line),
keys in plain lower-case words, every value read as text (no YAML type coercion, so `no` stays the word `no`).
Worked example:

```markdown
---
id: E900
title: CSV export adds a header row
priority: P2
depends on: [E899]
allowed paths: [src/export/csv.ts, test/export-csv.test.ts]
needs device or person: no
status: not started
source:
---
```

Option "bullet list" (`- **id:** E900` lines): renders the same without front-matter support but needs an ad-hoc
parser and has no standard way to write a list; GitHub, most editors and static-site tools already render YAML
front matter as a field table. Parsed with the `js-yaml` dependency the repo already has.

**D5 — unknown field name.** Recommendation: an error (non-zero, names the field). Worked example: a ticket
adds `owner: alice`; the checker prints `unknown field "owner"`. Reason: the acceptance requires every field to be
explained in the format doc; a field the doc does not define cannot be. Option "warning, exit 0": lets ad-hoc
fields in, so two repos' ticket files drift apart and a renamed tooling term (`review cycle`) slips past the
forbidden list. A forbidden name is reported as forbidden, not as unknown (D5 applies only after the forbidden
check).

**D6 — where the example ticket lives.** Recommendation: embedded in `docs/ticket-format.md` as one fenced
` ```markdown ` block under a heading `## Example ticket`; no new file. The template is `templates/ticket.md`.
A separate example file would need a path outside the lane's approved ownership.

**D7 — how the checker finds files.** No arguments: every `*.md` file directly inside the configured ticket
directory (`resolveTicketDir`, resolved against the current working directory as the workspace), except
`README.md` (any case), in name order, not recursive. With arguments: each argument is a file (checked whatever
its name) or a directory (same rule as the no-argument case). Exit 0 = every checked file is valid (including
zero files), 1 = at least one problem, 2 = cannot run (an argument path that does not exist or cannot be read,
or an unknown option). A missing configured/default directory with no arguments is not an error: exit 0 with the
no-directory line (tickets are new-only; this repo has none until E423).

## The format (what `docs/ticket-format.md` defines and the parser enforces)

**Field block.** The file starts with a line `---`; the field block ends at the next line `---`. Fields:

| field | required | value |
|---|---|---|
| `id` | yes | non-empty text, e.g. `E900` |
| `title` | yes | non-empty text |
| `priority` | yes | non-empty text (this repo uses `P0`–`P3`; the format does not fix a scale) |
| `depends on` | yes | list of ticket ids; `[]` when none |
| `allowed paths` | yes | non-empty list of repo-relative paths or globs the ticket may change |
| `needs device or person` | yes | `yes` or `no`; `yes` exactly when at least one scenario's verification is `device-or-person` |
| `status` | yes | exactly `not started`, `done`, or `stopped — <reason>` (em dash, non-empty reason) |
| `source` | no | empty, or a list of `<item number> rev <revision>` entries (issue-tracker item number and its revision at import); number only, never a URL; empty in a public repository |

**Forbidden field names** (listed in the doc): `next_role`, `agent_id`, `handoff`, `lane`, `round`, `evidence`,
`dispatch`. Matching: lower-case the field name and split it into words on spaces, `_` and `-`; the name is
forbidden when its word sequence contains a listed name's word sequence (`agent_id` = `agent id`) as consecutive
words. So `next role`, `Review-Round`, `dispatch mechanism` and `handoff` are all forbidden; `id` is not.

**Scenarios.** A section `## Scenarios`. Each scenario is a `### <scenario id> — <short title>` heading (id:
letter first, then letters, digits or `-`; unique in the file) followed by `Given` / `When` / `Then` lines (`And`
allowed) and exactly one verification line, one of:

| verification line | meaning |
|---|---|
| `Verification: automated test` | an automated test will exist; name not filled in yet |
| `Verification: test <test file path> — <test title>` | the backfilled automated test |
| `Verification: command <command>` | a command anyone can run; exit 0 = pass |
| `Verification: device-or-person` (optionally `: <what to check>`) | needs a real device or a person |

Backfill rule (doc states it): whoever writes the ticket may write `automated test`; once the test exists, the
verification line is replaced by the test file path and test title. That edit touches only the verification line
and is not a scenario change.

Append rule (doc states it): a scenario added during the build is appended under a last section
`## Added during build`, using the same scenario shape plus one line
`Added: <who>, <YYYY-MM-DD>, <reason>`. Existing scenarios are never edited or removed during the build (changing
or removing one means stopping the ticket).

**Other body text.** Free prose sections (for example `## Context`) may sit between the field block and
`## Scenarios`; they are not parsed.

**Backlog index (ruling 1 = a, doc states it):** the backlog file stays the index; a backlog row for a ticket that
has a ticket file points at it by repo-relative path. This lane edits no backlog row.

## Acceptance Criteria

Mapped to the backlog acceptance (BA1–BA4) and the fan-out done-definition rows for e422 (FD1–FD6).

- **AC1** (BA1, FD1) — Given a ticket file that follows the template and has 3 scenarios, when
  `node scripts/check-tickets.mjs <file>` runs, then it exits 0 and prints `check-tickets: ok <file> (3 scenarios)`
  and the summary line `check-tickets: 1 file(s), 3 scenario(s), 0 problem(s)`.
  proof: `test/e422-*.test.mjs` test spawning the checker on a temp ticket file.
- **AC2** (BA2, FD2) — Given a ticket file whose scenario `S2` has no verification line, when the checker runs on
  it, then it exits 1 and prints a line containing `scenario S2 has no verification`. Given a scenario with two
  verification lines, then it exits 1 and names the scenario (`scenario S2 has more than one verification`).
  proof: `test/e422-*.test.mjs` checker-spawn tests.
- **AC3** (BA3, FD3) — Given a ticket file whose field block has a field named `next_role` (and, separately,
  `Review Round`, `lane`), when the checker runs, then it exits 1 and prints `forbidden field name "<name as
  written>"`; and `docs/ticket-format.md` lists all seven names `next_role`, `agent_id`, `handoff`, `lane`,
  `round`, `evidence`, `dispatch`, matching the parser's exported `FORBIDDEN_FIELD_NAMES`.
  proof: `test/e422-*.test.mjs`.
- **AC4** (FD4) — Given a ticket file missing `allowed paths`, then exit 1 with `missing field "allowed paths"`.
  Given `status: in progress`, then exit 1 with `unknown status "in progress"`. Given `status: stopped` with no
  reason, then exit 1 (unknown-status line). Given `status: stopped — waiting on vendor firmware`, then the file is
  valid. Given no `source` field, or `source:` empty, then the file is valid. Given `source: [1234 rev 7, 1240 rev
  2]`, then valid; given a source entry that is a URL, then exit 1 with `source entry "<entry>" is not "<number>
  rev <revision>"`. proof: `test/e422-*.test.mjs`.
- **AC5** (D5) — Given a field block with `owner: alice`, then exit 1 with `unknown field "owner"`.
  proof: `test/e422-*.test.mjs`.
- **AC6** — Given `needs device or person: no` but a scenario verified by `device-or-person` (or `yes` with none),
  then exit 1 with the mismatch line. Given a duplicate scenario id, a scenario lacking a `Given`, `When` or `Then`
  line, a file with no scenarios, no leading `---` field block, or an invalid YAML field block, then exit 1 with
  the matching line from Copy / Strings. proof: `test/e422-*.test.mjs`.
- **AC7** (FD5, append rule) — Given a scenario under `## Added during build` with an `Added:` line naming who,
  a `YYYY-MM-DD` date and a reason, then it is valid and counted in the scenario total; without the `Added:` line,
  exit 1 naming the scenario. proof: `test/e422-*.test.mjs`.
- **AC8** (BA4, FD5) — Given `docs/ticket-format.md`, then it explains every field in the parser's exported field
  list, every verification form, the four status forms, the forbidden list, the backfill rule, the append rule
  and the backlog-index convention, without a link or path reference to any other file inside those
  explanations (a closing "Checking with this repository's tooling" section may name the checker and config
  key). And the `## Example ticket` block and `templates/ticket.md`, each written to a temp file, pass the checker
  with exit 0. proof: `test/e422-*.test.mjs` doc and template tests.
- **AC9** (FD6) — Given `.current/.config.json` with `"ticketDir": "work/tickets"`, then `loadConfig` returns
  `ticketDir: "work/tickets"` and `resolveTicketDir` returns that path under the workspace; given the key absent,
  or holding an absolute, `~`, `..`-escaping, empty or non-string value, then `loadConfig` has no `ticketDir` and
  `resolveTicketDir` returns `<workspace>/docs/tickets` (`DEFAULT_TICKET_DIR`). And `docs/config.md` has exactly one
  `### \`ticketDir\`` section stating the default, the usable-value rule, that it is optional and that
  `schema_version` is unchanged. proof: `test/e422-*.test.mjs`.
- **AC10** (D7) — Given no arguments and no ticket directory, then exit 0 and the no-directory line. Given no
  arguments and a directory holding `README.md` plus two ticket files, then only the two are checked. Given an
  argument that does not exist, then exit 2 with the cannot-read line. proof: `test/e422-*.test.mjs`.
- **AC11** — The existing config tests stay green with no edit: `node --test test/config-cache.test.mjs
  test/config-versioning.test.mjs test/e31-config-nonfatal.test.mjs test/e289-config-key.test.mjs
  test/e292-config-sister-repos.test.mjs test/drift-baseline.test.mjs test/e342-config-doc-wording.test.mjs
  test/e5-intake-tiering.test.mjs test/token-budget-config.test.mjs test/e291-start-link-locations.test.mjs
  test/e296-manifest-tier.test.mjs test/e22-stale-notify.test.mjs test/e429-lane-config-copy.test.mjs` passes
  213/213, and the full suite has zero new reds.
  proof: the command above prints `# pass 213` and `# fail 0`.
- **AC12** (fan-out row: lane `dist/`) — `dist/` changes only in `dist/tools/ticket-file.*` and
  `dist/tools/config.*`; nothing is added under `content/**`, `tools/registry.ts` or `docs/backlog.md`; with D2
  approved, `package.json` differs from base by exactly the one `scripts` line.
  proof: `git diff --stat c29f100 -- dist/ content/ tools/registry.ts docs/backlog.md package.json`.

## Copy / Strings

Checker output (`<file>` is the path as given or as found under the directory, relative to the working
directory when it is inside it).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| ok.file | `check-tickets: ok <file> (<n> scenarios)` | authored-here — one line per valid file; carries the scenario count BA1 asks for |
| summary | `check-tickets: <f> file(s), <s> scenario(s), <p> problem(s)` | authored-here — last line of every run that checked files |
| no-dir | `check-tickets: no ticket directory at <dir>; 0 file(s), 0 scenario(s), 0 problem(s)` | authored-here — D7, exit 0 |
| cannot-read | `check-tickets: cannot read <path>: <reason>` | authored-here — exit 2 |
| bad-option | `check-tickets: unknown option <arg>` | authored-here — exit 2 |
| p.missing-field | `check-tickets: <file>: missing field "<name>"` | backlog E422 "fails on a missing field" |
| p.forbidden | `check-tickets: <file>: forbidden field name "<name>"` | backlog E422 BA3 + Audit amendment (2) |
| p.unknown-field | `check-tickets: <file>: unknown field "<name>"` | authored-here — D5 |
| p.unknown-status | `check-tickets: <file>: unknown status "<value>" (expected not started, done, or stopped — <reason>)` | backlog E422 "unknown status" + Audit amendment (3) |
| p.no-verification | `check-tickets: <file>: scenario <id> has no verification` | backlog E422 BA2 |
| p.two-verifications | `check-tickets: <file>: scenario <id> has more than one verification` | backlog E422 "ONE verification" |
| p.bad-verification | `check-tickets: <file>: scenario <id> has an unknown verification "<text>"` | authored-here — the four forms above |
| p.no-gwt | `check-tickets: <file>: scenario <id> has no <keyword> line` | §11.6 rule 1 — `<keyword>` is `Given`, `When` or `Then`, one line per missing keyword |
| p.dup-scenario | `check-tickets: <file>: duplicate scenario id <id>` | authored-here — ids must be unique for later per-scenario records |
| p.no-scenarios | `check-tickets: <file>: no scenarios` | authored-here — a ticket is its scenarios |
| p.added-line | `check-tickets: <file>: scenario <id> added during build has no "Added: <who>, <YYYY-MM-DD>, <reason>" line` | Audit amendment (4) |
| p.device-mismatch | `check-tickets: <file>: "needs device or person" is "<value>" but <k> scenario(s) use device-or-person` | authored-here — field must agree with scenarios |
| p.source | `check-tickets: <file>: source entry "<entry>" is not "<number> rev <revision>"` | Addendum + ruling 11 (number only) |
| p.no-block | `check-tickets: <file>: no field block (the first line must be ---)` | authored-here |
| p.bad-yaml | `check-tickets: <file>: field block is not valid YAML: <message>` | authored-here |
| p.bad-value | `check-tickets: <file>: field "<name>" must be <shape>` | authored-here — `<shape>` is `text` or `a list`, per the field table |

Field names, section headings (`## Scenarios`, `## Added during build`, `## Example ticket`), the `Verification:`
forms and the `Added:` line are format text defined in "The format" above (authored-here; §11.6 rule 2 plain
words).

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Implementation notes for sr-engineer

- `tools/ticket-file.ts` (new, ~260 lines): exports `TICKET_FIELDS` (ordered: name, required, value kind),
  `FORBIDDEN_FIELD_NAMES` (the seven, in the order above), `TICKET_STATUSES`, a `parseTicketFile(text)` that
  returns the parsed ticket (fields, scenarios with id / title / verification / added-during-build marker) plus a
  list of problems, and a `runCheckTicketsCli(argv, cwd)` returning `{ output, exitCode }`. All checker logic lives
  here; `scripts/check-tickets.mjs` (new, ~15 lines) is a thin wrapper importing `../dist/tools/ticket-file.js`,
  like `scripts/lane-status.mjs`. Parse the field block with `js-yaml` using a schema that keeps every scalar as
  text (failsafe). Read-only: the module never writes a file.
- `tools/config.ts` (+~30 lines): `ticketDir?: string` on `WorkspaceConfig` with a comment, the filter in
  `loadConfigEntry` after `sisterRepos`, `export const DEFAULT_TICKET_DIR = "docs/tickets"`,
  `export function resolveTicketDir(workspacePath)`. Nothing else in the file changes.
- `docs/config.md` (+~20 lines): one `### \`ticketDir\` — ticket-file directory (optional)` section placed after
  the `sisterRepos` section and before its closing `---` (keeps `test/e292-config-sister-repos.test.mjs`'s
  "section follows the addendum section directly" check and the e289 / e342 section slicing intact).
- `docs/ticket-format.md` (new, ~170 lines) and `templates/ticket.md` (new, ~40 lines, placeholder values that
  still pass the checker, one scenario with `Verification: automated test`, an empty `## Added during build`).
  The example ticket must be generic (no repo-specific path, no project codename, no tracker URL, no person's name).
- `package.json`: the one `scripts` line from D2.
- `npm run build` regenerates `dist/tools/ticket-file.*` and `dist/tools/config.*`; commit nothing else under
  `dist/`. `check-md-tables` only sees tracked files, so tables in the two new Markdown files are checked after
  the coordinator's commit: keep every table row's cell count equal to its header.
- Comments: generic, no ticket ids-as-names, no local paths (comment hygiene).

## Test placement guidance for qa-engineer

Tests are qa-owned (`test/e422-*.test.mjs`, names chosen by qa). Suggested split:
`test/e422-ticket-file.test.mjs` (parser + checker CLI: AC1–AC7, AC10),
`test/e422-ticket-config.test.mjs` (AC9, both code and `docs/config.md`),
`test/e422-ticket-format-doc.test.mjs` (AC3's doc list, AC8). Fixtures are written inline to `os.tmpdir()`;
`test/fixtures/**` is not in this lane's ownership. Spawn `scripts/check-tickets.mjs` with `process.execPath` for
CLI tests; import `dist/tools/ticket-file.js` / `dist/tools/config.js` for unit tests. AC11 / AC12 are qa
verification commands, not new test files. No expected-red manifest is needed (feature mode, no intentional
reds) unless sr leaves one.

## Out of Scope

- Migrating existing backlog rows; editing `docs/backlog.md` at all (ruling 1 = a; the first pointer is written
  with E423's first ticket file).
- `.feature` files (ruling 12); any tracker URL (ruling 11); tracker read-back or revision comparison (E428).
- `content/**`, compose goldens, context budget; the `CLAUDE.md` layout section (a later docs update adds the new
  files' layout rows).
- `spec-workshop` (E423); CI checking that `done` tickets name existing tests (E427), so `automated test` is not
  rejected on a `done` ticket here; per-scenario acceptance records (E424); stop propagation (E425).
- A new MCP tool or any `tools/registry.ts` change; any gate; any handoff / config `schema_version` change.
- Wiring `check:tickets` into `npm test` or CI.

## Dependencies / Prerequisites

- E418 is DONE (v4.21.0). No dependency on lane e419 (files disjoint per the fan-out manifest).
- No `design/` file: mode = no-design; Visual Structural Assertions omitted; Scope Decision Gate not armed (the
  routing write still records `scope_decision: "single-feature"` as asked by the coordinator).
- Resource audit: the backlog row, the fan-out row and the cited discussion sections contain no external
  reference (no URL, design file or tracker item); `external_refs` = [].
- **PM probe (real run, 2026-11-19, this worktree at c29f100).** Baseline: the 13 config-reading test files in
  AC11 pass 213/213. Probe A (compiled loader patched to always put `ticketDir` with its default into the
  `loadConfig` result): 209/213, red = `test/e31-config-nonfatal.test.mjs` (2 tests: the two "E31 cache
  invalidation" tests deep-equal `{ host: "claude-code" }`), `test/e5-intake-tiering.test.mjs` (1: "existing config
  fields are untouched when cutApprovalAutoTier is absent"), `test/token-budget-config.test.mjs` (1: "existing
  config fields are untouched when tokenBudgetPerFeature is absent"). Probe B (key surfaced only when present, the
  D1 design): 213/213. The patch was reverted; the tree is unchanged. **Predicted-red existing tests with the
  chosen design: none.**
- Doc-section tests checked by reading: `test/e342-config-doc-wording.test.mjs`, `test/e289-config-key.test.mjs`
  and `test/e291-start-link-locations.test.mjs` end their section at the next `###` / `---`;
  `test/e292-config-sister-repos.test.mjs` slices sisterRepos to the next `---` and only asserts needles are
  present, so a new `###` section after sisterRepos keeps all four green (covered by AC11's run). No test
  enumerates `package.json` scripts or `templates/` top-level files (`test/e108-eject.test.mjs` and
  `test/e250-eject-path-escape.test.mjs` list only the two template subdirectories).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E422 | Tool-neutral ticket file: format doc with template and embedded example, parser, checker (+ `check:tickets` script line), `ticketDir` config key (default `docs/tickets`, applied by resolver) and its config doc section | none | 7 + dist + tests | `docs/ticket-format.md`、`templates/ticket.md`、`tools/ticket-file.ts`、`scripts/check-tickets.mjs`、`tools/config.ts`、`docs/config.md`、`package.json`、`dist/tools/ticket-file.*`、`dist/tools/config.*`、`test/e422-*.test.mjs` | — |

## Tasks

Ledger: `.current/e422/tasks.md` (written with `tw_add_task`). Chain: pm → sr-engineer (T-E422-01, T-E422-02) →
code-reviewer → qa-engineer (T-E422-03).

| id | role | P | summary | depends_on |
|---|---|---|---|---|
| T-E422-01 | sr-engineer | P0 | `tools/ticket-file.ts` parser + checker core, `scripts/check-tickets.mjs`, `ticketDir` key + `DEFAULT_TICKET_DIR` + `resolveTicketDir` in `tools/config.ts`, `package.json` script line, build `dist/` | none |
| T-E422-02 | sr-engineer | P1 | `docs/ticket-format.md` (self-contained, example ticket embedded), `templates/ticket.md`, `docs/config.md` `ticketDir` section; template and example pass the checker | T-E422-01 |
| T-E422-03 | qa-engineer | P1 | `test/e422-*.test.mjs` for AC1–AC10; run AC11 and AC12 commands and the full suite | T-E422-02 |
