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
