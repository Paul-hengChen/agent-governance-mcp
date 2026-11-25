# Tests — e455-ticket-checker-strict (T-E455-01)

Test file: `test/e455-ticket-checker-strict.test.mjs` (new; placement from the dispatch brief's `Test-file placement` line, pre-authorized). Runner: `node --test`; imports `dist/tools/ticket-file.js` and `dist/tools/config.js`; CLI runs spawn `scripts/check-tickets.mjs`. Fixtures are inline in an `os.tmpdir()` temp dir (no `test/fixtures/` files). No base-tree read, no `git show`, no absolute local path. Every title starts `AC<n> `, so each AC's `proof:` pattern `^AC<n> ` selects exactly its tests.

Base run (lane base build, Node 22): 34 tests, 8 pass, 26 fail. The 26 reds are exactly the manifest entries (`qa_reports/expected-red_e455-ticket-checker-strict.txt`, verified by diff). The three `test/e422-*.test.mjs` files: 79/79 pass, unedited.

## Scenario → Test Map

| scenario | test (exact title) | red at base |
|---|---|---|
| AC1 | AC1 a scenario heading with no em-dash separator reports heading-no-separator once, keeps id = whole heading and an empty title, adds no id-shape problem, and exits 1 | yes |
| AC1 | AC1 a scenario id that is not a letter followed by letters, digits or - reports id-shape quoting the id, and exits 1 | yes |
| AC1 | AC1 well-formed ids S1, csv-header, a and Z9-x with the separator and a title report no heading or id problem | no (guard) |
| AC2 | AC2 a needs device or person value other than yes or no reports yes-no, not the count-mismatch line, drops the field, and exits 1 | yes |
| AC2 | AC2 yes and no, after trimming, keep the count-mismatch behaviour | no (guard) |
| AC3 | AC3 a fenced Verification line inside a valid scenario is not a second verification, for ``` and ~~~ fences | yes |
| AC3 | AC3 a Given, When or Then line found only inside a fence does not satisfy the missing-keyword check | yes |
| AC3 | AC3 a Verification line found only inside a fence leaves the scenario with no verification | yes |
| AC3 | AC3 an Added line found only inside a fence leaves the added-during-build scenario without its Added line | yes |
| AC3 | AC3 a heading inside a fence stays ignored and the fenced lines under it are not scenario lines either | yes |
| AC4 | AC4 a ticketDir that normalizes to the workspace root or is whitespace-only is dropped silently and the default applies | yes |
| AC4 | AC4 with a whitespace-only ticketDir and docs/tickets holding one valid ticket, the no-argument checker checks docs/tickets | yes |
| AC4 | AC4 with ticketDir . the no-argument checker never checks the workspace root's .md files | yes |
| AC4 | AC4 sisterRepos entries whose path or owns is whitespace-only are dropped; whitespace-only backlog and contracts strings are left out; non-blank values stay verbatim | yes |
| AC4 | AC4 the usable ticketDir values ./x, a/../b, ..foo/tickets and work/tickets stay usable and verbatim | no (guard) |
| AC5 | AC5 a list entry that is not text reports entry-not-text with its 1-based position, not must be a list, and drops the field | yes |
| AC5 | AC5 a blank-text list entry reports entry-empty with its 1-based position, not must be a list, and drops the field | yes |
| AC5 | AC5 a list mixing not-text and blank entries reports one problem per bad entry | yes |
| AC5 | AC5 a source list with a bad entry reports only the entry problems, never a source-entry shape line for that field | yes |
| AC5 | AC5 a scalar written where a list is expected still reports must be a list | no (guard) |
| AC6 | AC6 an Added line with the documented shape but an impossible date reports added-date quoting the date, not the missing-Added line, and exits 1 | yes |
| AC6 | AC6 real calendar dates, leap days included, are valid Added dates | no (guard) |
| AC6 | AC6 a badly shaped date keeps the existing missing-Added message and no added-date line | no (guard) |
| AC7 | AC7 a ## section after Added during build is reported once per heading, quoting the heading line, and exits 1 | yes |
| AC7 | AC7 a ### scenario under a second Scenarios or a second Added during build section is reported as not read and is not a scenario | yes |
| AC7 | AC7 a ticket whose Added during build is the last ## section, with or without scenarios, reports neither message | no (guard) |
| AC8 | AC8 the Scenarios section states the heading holds an em dash between the scenario id and the title | yes |
| AC8 | AC8 the doc states that lines inside a fenced code block are not read as headings, Given/When/Then/And, verification or Added lines | yes |
| AC8 | AC8 the field-block section states that every list entry is non-empty text | yes |
| AC8 | AC8 the needs device or person row still says yes or no and adds that any other value is refused | yes |
| AC8 | AC8 the added-during-build section states the date must be a real calendar date and that a ## section after it is reported and its scenarios are not read | yes |
| AC8 | AC8 the explanations still hold no link, no repo path and no ticket id beyond the doc's own example ids, and the example still passes the checker | no (guard) |
| AC9 | AC9 the ticketDir Usable value bullet names whitespace-only values and values normalizing to . (the workspace root) as unusable | yes |
| AC9 | AC9 the sisterRepos Which entries are dropped bullet states that a string of only whitespace counts as empty | yes |
| AC9 (scope) | not a resident test: `git diff -U0 70d34c6...HEAD -- docs/config.md` hunks within base lines 185–225 — judge-run | — |
| AC10 | not a test in this file: sr-engineer's full-suite run `node scripts/test-lock.mjs -- npm test` (`# fail 0`) | — |

## Open Interface Details

- **Doc-fact regexes (AC8 / AC9)** — the spec leaves wording to sr within the listed facts; the tests pin facts, not sentences. What each test needs (sentences are split on `.`/`!`/`?` followed by whitespace; paragraphs on blank lines):
  - Scenarios intro (text between `## Scenarios` and its first `###` subsection): one sentence holding `between`, the word `id`, `title`, and `—` or `em dash`.
  - Fenced-code rule: one paragraph of the explanations (doc minus the example block and the tooling section) holding `fenced code block` and `not read`, plus `heading`, `Given`, `When`, `Then`, `And` (case-sensitive words), `verification` and `Added:`.
  - `## Field block` section: one sentence holding `entry`/`entries`, the word `text`, and one of `non-empty` / `not empty` / `not be empty` / `never empty` / `cannot be empty`.
  - `needs device or person` table row: still `` `yes` or `no` ``, plus `other value` followed in the same cell by `refused` / `rejected` / `not valid` / `invalid` / `reported`.
  - `### Scenarios added during the work`: one sentence with `date` and `real` or `calendar`; one sentence with `after`, `Added during build` and `reported` / `refused` / `a problem`; and `not read` somewhere in the section.
  - `docs/config.md` `ticketDir` "**Usable value.**" bullet (one line): `whitespace`, a `` `.` `` code span, and `workspace root`.
  - `docs/config.md` sisterRepos "**Which entries are dropped.**" bullet (one line): one sentence holding `whitespace` and `empty`.
  - The new doc text must not cite a ticket id: the explanations may hold no `[A-Z]` + 2-or-more-digit token other than the example's `E900` / `E899`; no link, no repo path (`docs/`, `scripts/`, `templates/`, `specs/`, `tools/`, `content/`, `test/`, `dist/`).
- **Trimmed yes/no value** — `' maybe '` (quoted, with spaces) reports `not "maybe"` (spec: `<value>` trimmed); `' no '` is valid (exactly `no` after trimming).
- **AC5 fixtures** — not-text entries cover a nested flow list, a flow `{k: v}` map, an implicit `k: v` pair inside a flow list, and an empty block-sequence item (YAML null). Mixed lists are compared as sorted sets (the spec fixes one problem per entry, not the order between the two kinds).
- **AC5 source** — `source: [[x], foo]` reports only `field "source" entry 1 is not text`; the shape-bad text entry `foo` is NOT reported for that field (spec: "only the entry problems").
- **AC6 extra dates** — beyond the five listed, `2026-01-00` (day 00) and `1900-02-29` (÷100 not ÷400) are pinned as invalid, from the spec's implementation note (day 01–days-in-month, Gregorian leap rule).
- **AC7 heading line** — quoted as the trimmed line including the `## ` / `### ` marker, e.g. `section "## Notes" …` and `heading "### S9 — late" …`. A `###` under `## Notes` after the added section is also reported as not read (the spec's "every `###` heading under such a section").
- **AC3 fence delimiter lines** — "the delimiter lines themselves are not scenario lines" has no observable effect through the public interface (a delimiter starts with ``` or ~~~, so it can never match a keyword, `Verification:` or `Added:`); no dedicated test, covered implicitly.

## Red Reasons

- AC1 (2): no separator or id-shape check exists; malformed headings pass silently.
- AC2 (1): a non-yes/no value surfaces only as the count-mismatch line and stays in `fields`.
- AC3 (5): fenced lines are added to the scenario's lines, so fenced Verification / Given / When / Then / Added lines count.
- AC4 (4): the non-empty-string rule does not trim and a `ticketDir` normalizing to `.` is usable (root sweep, whitespace dir, whitespace sisterRepos values kept).
- AC5 (4): any list with a non-text or blank entry reports `must be a list`.
- AC6 (1): only the date shape is checked; impossible dates pass.
- AC7 (2): sections after `## Added during build` are not reported; a second `## Scenarios` re-opens parsing; `###` under other sections is dropped silently.
- AC8 (5): the format doc does not yet state the new rules.
- AC9 (2): the config doc bullets do not yet mention whitespace-only / workspace-root values.

## CI Runnability

Headless, no network, no interaction; temp dirs under `os.tmpdir()` removed in `after()`. Uses only Node built-ins (regex lookbehind, `fs.mkdtempSync`, `spawnSync`), all available on Node 20 and 22. Files are read into memory at module load; no temp dir is re-read after removal.
