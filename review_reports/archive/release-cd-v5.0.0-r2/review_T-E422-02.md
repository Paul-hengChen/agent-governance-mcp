# Review — T-E422-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Adds the `ticketDir` key, `DEFAULT_TICKET_DIR` and `resolveTicketDir` (tools/config.ts, +25 lines), with their `dist/tools/config.*` output.
- Adds one `package.json` scripts line, `docs/ticket-format.md` (171 lines), `templates/ticket.md` (37 lines) and one `docs/config.md` section.
- The config change is additive only: no other behaviour in `tools/config.ts` changed. The 13 AC11 config test files pass 213/213.
- The template and the embedded example ticket both pass the checker (1 and 4 scenarios, exit 0).
- Verdict: CHANGES_REQUESTED. The format doc says "every value is read as text" but never says how to write a value that the field-block syntax treats specially. A ` #` in a value is silently cut off, and a value containing `: ` or starting with `*` (e.g. the glob `**/*.md`) fails with a "not valid YAML" message. The doc never mentions YAML, so a reader cannot fix the file from the doc alone (BA4).

## AC Completeness
AC3 — implemented (doc half) — docs/ticket-format.md:43-59 lists all seven names in the same order as `FORBIDDEN_FIELD_NAMES` and gives the word-split rule.
AC8 — partial — docs/ticket-format.md explains every field, the four verification forms, the three status forms, the forbidden list, backfill (86-90), append (92-103) and backlog index (105-109), with tooling named only in the closing section (165-171). The example and the template pass the checker. But the field-block explanation (14-17) is not enough for a reader without this tooling to write common values; see the required finding under Correctness.
AC9 — implemented — tools/config.ts:203-207, 436-441, 489-492; docs/config.md has exactly one `### \`ticketDir\`` section (default, usable-value rule, optional, `schema_version` unchanged). Reviewer probes, each of which kept the key out of `loadConfig` and resolved to `docs/tickets`: `/abs`, `~/x`, `../x`, `a/../../x`, `..\x`, `C:\x`, `C:x`, `\\srv\share`, `""`, `5`, `null`, `["a"]`. Kept, as the spec allows: `work/tickets`, `..foo`, `./a/../b` (resolves to `b`).
AC11 — implemented — reviewer rerun: `# pass 213`, `# fail 0`
AC12 — implemented — `package.json` differs by exactly the `check:tickets` line, and `dist/` changes only `dist/tools/config.*` (plus T-E422-01's `dist/tools/ticket-file.*`).

AC8 "four status forms": this is a wording slip in the spec, not a gap. The backlog Audit amendment (3) says "the three status values are unchanged", and the spec's own field table and the p.unknown-status Copy string list three (`not started`, `done`, `stopped — <reason>`). The doc correctly explains those three and states that a bare `stopped` is invalid (docs/ticket-format.md:32-41). The "four" probably came from the four verification forms. Optional: the PM corrects the AC8 wording. QA should test the three forms.

## Correctness
- **required** — docs/ticket-format.md:14-17 (and 25, 28, 38): the field-block explanation is incomplete in a way that silently loses data. The doc says values are `name: value` lines and that "every value is read as text", but the block is parsed as YAML front matter, and the doc never says so or gives the quoting rule. Reproduced with the checker:
  - `title: Retry 3 times #flaky` passes, and the stored title is `Retry 3 times`; the ` #…` is dropped as a YAML comment. The same thing happens to a stop reason: `status: stopped — blocked by #123` stores `stopped — blocked by`. Issue numbers written with `#` are common in a stop reason.
  - `status: stopped — vendor: late` fails with `field block is not valid YAML: bad indentation of a mapping entry`. The doc never introduces the word YAML.
  - `allowed paths: [**/*.md]` fails with `unidentified alias "*/*.md"`, although line 25 invites glob patterns. A quoted `["**/*.md"]` passes.
  - `title: &a T` silently becomes `T`.

  Fix (doc only, a few lines): say the field block is YAML front matter, and state that a value must be put in quotes (`"…"`) when it contains `: ` or ` #`, or starts with one of `[ ] { } , # & * ! | > ' " % @` or a backtick. Give one quoted example, e.g. `allowed paths: ["**/*.md"]` or `status: "stopped — blocked by #123"`. Also change "every value is read as text" so it does not promise more than the parser gives. This is a defect this diff introduced (a new public doc that misleads its target reader), and the backlog acceptance requires a reader without this tooling to be able to work from the format doc, so it is required. Optionally the parser could also flag a ` #` in the raw block line, but the doc fix is enough.
- **optional** — tools/config.ts:203-207: `"."` and whitespace-only `"  "` count as usable. `"."` makes the checker scan the repository root (where every non-ticket `.md` fails), and `"  "` resolves to a directory named with two spaces. Both satisfy the spec's literal rule ("non-empty string … relative"), so neither is a defect.
- **optional** — docs/ticket-format.md:21: "Unique among the ticket files" for `id` is a rule the checker does not (and cannot, per file) check. That is fine as a human rule, but QA should not expect the checker to enforce it.
- **optional** — docs/ticket-format.md:10: "and at the end an `## Added during build` section" reads as required. The parser treats it as optional and the template ships it empty. Say "and, when scenarios were added during the work, an `## Added during build` section at the end".

## Quality
- **optional** — tools/config.ts:205: `isUsableTicketDir` reuses `isRejectedSisterPath`. Reuse is right, but the helper's name now misleads (it is no longer only for sister repos). Consider renaming it to something neutral (e.g. `isRejectedRelativePath`) in a later touch of the file.
- Comment check (SOP 4b): the new comments in tools/config.ts (92-95, 199, 202-203, 436-437, 489) are short and say what and why. `agc check — comments` reports `tools/config.ts high-ratio 39.7%`, but the file was already over the 30% limit at base. This diff adds about 9 comment lines out of 25, so the warning is kept: it predates this diff, and the new comments are needed for the interface.
- Information hygiene: none of the new files contains an absolute local path, a username, a tracker URL or a project codename. `docs/ticket-format.md` uses no governance jargon outside the forbidden-name list and the closing tooling section. The example ticket is generic (`the implementer`, `src/export/csv.ts`). The template's comment refers to "the ticket format document" without a path, which suits a file copied into other repos.
- `docs/config.md`: the section sits after `sisterRepos` and before the closing `---`, as the spec placed it. `check:md-tables` is OK.

## Architecture
No architecture spec. The default lives in the exported `DEFAULT_TICKET_DIR` and is applied by `resolveTicketDir`, not injected into `loadConfig` (D1, the probe-backed design that keeps the 4 existing deep-equal tests green). This is the same split as `taskPaths` / `resolveTaskPaths`. `loadConfig` surfaces the key only when the value is usable. No `schema_version` change.

## Security
No findings. Escape attempts through the path (absolute POSIX, Windows rooted, UNC, drive-relative `C:x`, `~`, `..` after normalizing with backslashes folded) are all rejected and fall back to the default (tools/config.ts:205-206). The default is joined under the workspace path.

## Performance
No findings. `resolveTicketDir` makes one cached `loadConfig` call.

Same-model note: sr-engineer and code-reviewer both ran on opus (dispatch pins), so their blind spots may overlap.

## Verdict
CHANGES_REQUESTED — the format doc's field-block section must name YAML front matter and give the quoting rule, because unquoted ` #`, `: ` and leading-`*` values are currently cut off silently or rejected with an error the doc never explains.

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Round-2 diff (`git diff 20bd6cf..HEAD`): `docs/ticket-format.md` only (+18/-4, commit 81c2def), plus `.current/e422/` lane state. No source, test, template or `dist/` change.
- The round-1 required finding is fixed as asked. The doc now says the block is YAML front matter (line 16). It no longer promises "every value is read as text" (lines 17-18 now say "not converted to numbers or true/false", which is accurate for `FAILSAFE_SCHEMA`). It gives the quoting rule (21-25) and a quoted example (27-31). Lines 10-11 also fix the round-1 optional note on `## Added during build`.
- All three round-1 repros, quoted as the new rule says, now pass and keep the whole value. The unquoted forms still fail or truncate in the same way, so the rule is needed.
- New defect from this fix: the rule tells the reader to use double quotes but does not say that a backslash inside double quotes starts an escape. A quoted value that contains `\n` or `\t` is silently changed, and the checker reports 0 problems. See Correctness.
- Verdict: CHANGES_REQUESTED, one required doc-only fix (one sentence, or switch the rule to single quotes).

## AC Completeness
AC3 — implemented (doc half) — unchanged from round 1.
AC8 — partial — docs/ticket-format.md:16-31 now explains the YAML front matter and the quoting rule, and the template and embedded example still pass (`node scripts/check-tickets.mjs templates/ticket.md <extracted example>` → ok, 1 and 4 scenarios, 0 problems). But the double-quote advice at 21-23 silently changes values that contain a backslash; see the required finding.
AC9, AC11, AC12 — implemented — no source, config, test or `dist/` change this round (`git diff --stat 20bd6cf..HEAD`).

## Correctness
Round-1 repros through `parseTicketFile` (dist build), each swapped into the doc's embedded example ticket:

| value | unquoted | quoted per the new rule |
|---|---|---|
| title `Retry 3 times #flaky` | title stored as `Retry 3 times` (silent) | `"Retry 3 times #flaky"` → whole value, 0 problems |
| status `stopped — vendor: late` | `field block is not valid YAML: bad indentation of a mapping entry` | `"stopped — vendor: late"` → whole value, 0 problems |
| allowed paths `[**/*.md]` | `unidentified alias "*/*.md"` | `["**/*.md"]` → `["**/*.md"]`, 0 problems |
| doc's own example block (27-31) | — | title, status and both path entries kept whole, 0 problems |

The doc alone now explains how to fix each one. The listed leading characters were checked one by one against js-yaml `FAILSAFE_SCHEMA`: every one either errors or changes the value when left unquoted (`#x` → empty, `&a T` → `T`, the rest error). None is listed wrongly. The comma rule for list entries is correct (`[a, b]` is two entries).

- **required** — docs/ticket-format.md:21-23: the rule says to use double quotes `"…"` but does not say that a backslash inside double quotes is an escape character. Following the rule can therefore change a value silently, which is the same kind of defect round 1 asked to remove. Repro: `title: "Escape \n in notes: crash"` must be quoted because it contains `: `. It parses with 0 problems, and the stored title holds a real line break (char code 10) where `\n` was written. `"C:\temp\new: crash"` gets a tab and a line break the same way. `"match \d+"` fails instead, with `unknown escape sequence`, an error the doc does not explain. A value that contains a `"` cannot be written by following the doc either. Ticket titles and stop reasons often mention `\n`, regexes or Windows paths. Fix (doc only, either option):
  - (a) add one sentence: "Inside double quotes, `\` starts an escape: write a backslash as `\\` and a double quote as `\"`." or
  - (b) switch the rule to single quotes `'…'`, inside which every character is kept as written except `'`, which is written twice (`''`). Update the three example lines to match.

  Option (b) is the simpler rule for a reader who does not know YAML. Re-run the three example lines and one backslash value through the checker after the edit.
- **recommended** — docs/ticket-format.md:21-23: three cases that the rule does not cover still fail loudly (the checker reports `field block is not valid YAML`), so nothing is lost silently, but a reader cannot fix them from the doc alone:
  - a list entry that contains `[ ] { }` partway through, e.g. the route path `app/[id]/page.tsx` → `missed comma between flow collection entries`. Suggested change: "inside a list, also quote an entry that contains a comma or any of `[ ] { }`";
  - a value that starts with `- `, `? ` or `: ` (dash, question mark or colon followed by a space);
  - a value that ends with `:`, e.g. `title: Note:`.

  The rule could be shortened to "when in doubt, quote it; quoting a plain value never hurts". That covers all of these in one clause and could be added in the same edit.

## Quality
No new findings. The added prose is plain and has no jargon beyond the word YAML, which the reader needs to search for the rule. The example block has no language tag, which is consistent with the `Added:` block at 112-114.

## Architecture
No change; no parser change was needed or made.

## Security
No findings. Doc-only change.

## Performance
No findings. Doc-only change.

Same-model note: sr-engineer and code-reviewer both ran on opus (dispatch pins).

## Verdict
CHANGES_REQUESTED — the round-1 finding is fixed, but the new double-quote advice silently turns `\n` and `\t` written inside the quotes into real control characters. The doc must state the backslash escape or switch to single quotes.

### sr-engineer reply (round 2)

- required (backslash escape): switched the rule to single quotes (option b). docs/ticket-format.md:21-32 now says a value of only letters, digits, spaces and `. / _ - —` (not starting with `-`) may be bare; anything else, or when in doubt, goes in single quotes; inside them every character stays as written and `'` is written as `''`; double quotes are named as the thing not to use, with the `\n` reason. Example block (34-38) rewritten in the single-quote form and now also shows a backslash, `app/[id]/page.tsx` and a doubled quote.
- recommended (brackets mid-entry, leading `- ` / `? ` / `: `, trailing `:`): covered by the same rule, since none of those values is in the bare set. Each one round-trips through the parser with 0 problems (table in the lane handoff notes).
- Template and embedded example contain only bare-set values, so neither changed.

## Round 3 — APPROVED — by code-reviewer

covers: T-E422-01, T-E422-02

## Summary
- Round-3 diff (`git diff 8a0508b..HEAD`): `docs/ticket-format.md` (+15/-8, commit 554934d), the appended "sr-engineer reply (round 2)" subsection in this file, and `.current/e422/` lane state. No source, test, template, config or `dist/` change.
- The round-2 required finding is fixed with option (b). docs/ticket-format.md:21-32 now gives a bare set (letters, digits, spaces, `. / _ - —`, not starting with `-`), single quotes for everything else, `''` for a quote inside, and "when in doubt, quote it". It also tells the reader not to use double quotes and gives the `\n` reason. The example block (34-38) uses the new form.
- The round-2 recommended note (brackets partway through an entry, leading `- `/`? `/`: `, trailing `:`) is covered by the same rule, because none of those values is in the bare set.
- About the "sr-engineer reply (round 2)" subsection above: it is sr-engineer's fix note, not review content. It stays in the file, but it is not evidence for this verdict. Everything below comes from my own runs.
- Verdict: APPROVED. No required findings.

## AC Completeness
AC3 — implemented (doc half) — unchanged.
AC8 — implemented — docs/ticket-format.md:15-38 explains the YAML front matter, the bare set and the single-quote rule. Every value written per the rule reads back byte for byte (see Correctness). The template and the embedded example still pass.
AC1, AC2, AC4–AC7, AC9–AC12 — implemented — no file in their scope changed this round (`git diff --stat 8a0508b..HEAD`).

## Correctness
Independent verification. My own scratch script applies the doc's rule literally: bare when the value matches `^[\p{L}\p{N} ./_\-—]+$` and does not start with `-`, otherwise `'…'` with `'` doubled. Each value was written into a full ticket both as `title` and as the first `allowed paths` entry, then parsed with `parseTicketFile` from `dist/tools/ticket-file.js`:

- Quoted per the rule, all byte-equal with 0 problems in both positions:
  - `\n`, `Escape \n in notes`, `\t`, `C:\temp\new`, `\d+`
  - `'` (written `''''`), `it's`, `''`
  - `a: b`, `a:b`, `a #b`, `x # y`, `Retry #flaky`
  - `- x`, `? x`, `: x`, `x:`
  - `app/[id]/page.tsx`, `src/a,b.ts` (comma inside a list entry), `src/{a,b}.ts`
  - `~`, `say "hi"`, a literal tab, and values starting with each of `%`, `@`, a backtick, `!`, `&`, `*`, `|` and `>`
- Bare-set probes, all byte-equal with 0 problems:
  - all-digit and number-like values: `123`, `007`, `0`, `0x1F`, `1e3`, `1.0`, `.inf`, `.nan`
  - FAILSAFE keywords: `yes`, `no`, `null`, `Null`, `true`, `False`, `on`, `off`. Under `FAILSAFE_SCHEMA` all of these stay text.
  - dots and dashes: `...`, `.`, `..`, `a - b`, `a -b`, `a --b`, `a---`, `a ... b`, `end.`, `x .`, `. x`
  - paths: `/abs`, `a/b/`, `_x`
  - non-ASCII: `café`, `日本語`, `Ωmega`, `a—b`, `— leading em dash`
  - double space: `a  b`
  - `stopped — waiting on vendor firmware`
- `status` field: bare `stopped — reason` is accepted and kept whole. `'stopped — vendor''s firmware: late'`, `'stopped — blocked by #123'` and `'stopped — C:\temp\new'` are byte-equal.
- Fuzz: 16 893 random bare-set strings (ASCII and non-ASCII letters, `²`, `٣`, em dash, `. / _ -`) were written bare as title and as list entry. All round-trip with 0 problems.
- Negative controls, both confirming the doc's claims: `"a\nb"` in double quotes stores a real line break, and bare `Retry #flaky` stores `Retry`.
- The doc's own example block (34-38) gives title `Retry 3 times #flaky on C:\temp\new`, paths `**/*.md`, `app/[id]/page.tsx`, `src/export/csv.ts`, and status `stopped — vendor's firmware: late`, with 0 problems.
- Checker: `node scripts/check-tickets.mjs templates/ticket.md <extracted embedded example> <80 generated files>` gives `82 file(s), 85 scenario(s), 0 problem(s)`, exit 0. `npm run check:md-tables` reports OK.

- **optional** — docs/ticket-format.md:23-24: "spaces" in the bare set includes leading and trailing spaces, and YAML drops those from a bare value. For text fields this changes nothing, because the parser trims them anyway (tools/ticket-file.ts:111). For a list entry, a bare entry loses them while a quoted one keeps them. A path with a trailing space is unrealistic, so this is not a defect. If the doc is touched again, it could say "spaces between words".
- **optional** — docs/ticket-format.md:25-26: "quoting … never changes the value" is true for YAML. The parser still trims leading and trailing spaces from text fields after quoting (tools/ticket-file.ts:111). This does not matter for any realistic ticket.

## Quality
No new findings. The rule is two bullets plus one paragraph, uses no YAML jargon beyond the word YAML, and stays tool-neutral. Moving from "list the dangerous characters" to "allow a small safe set" is easier for a reader to apply, and it is stricter, so a reader who follows it cannot silently lose part of a value.

## Architecture
No change. This round is doc-only.

## Security
No findings. This round is doc-only.

## Performance
No findings. This round is doc-only.

Same-model note: sr-engineer and code-reviewer both ran on opus (dispatch pins).

## Verdict
APPROVED — the single-quote rule and the bare set are accurate: every probed value written per the rule reads back byte for byte, and the template and embedded example still pass. Only optional notes remain.
