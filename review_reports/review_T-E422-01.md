# Review — T-E422-01

## Round 1 — APPROVED (task scope) — by code-reviewer

Round verdict for the feature is CHANGES_REQUESTED because of one required finding in T-E422-02
(`review_reports/review_T-E422-02.md`); this task carries no required finding of its own.

## Summary
- Adds `tools/ticket-file.ts` (parser + checker core, 285 lines), `scripts/check-tickets.mjs` (13-line wrapper),
  their `dist/tools/ticket-file.*` build output, and the two approved `CLAUDE.md` layout edits.
- Diff range `c29f100...HEAD`; outside `.current/e422/**` and `specs/e422-*.md` only in-scope files changed.
- `npm run build` is clean and leaves `dist/` unchanged (committed output is in sync with the source).
- Probed 37 parser inputs and 7 CLI cases with throwaway files. Every Copy / Strings line and every exit code
  (0/1/2) matched.
- Task verdict: APPROVED, with recommended and optional notes only.

## AC Completeness
AC1 — implemented — tools/ticket-file.ts:280,283; template run prints `ok … (1 scenarios)` and the summary line, exit 0
AC2 — implemented — tools/ticket-file.ts:170-173
AC3 — implemented (code half) — tools/ticket-file.ts:33-35,75-81,95; `Review-Round`, `agent id`, `next_role`, `lane` are refused as forbidden; `rounds`, `nextRole` are not (correct: the spec splits only on spaces, `_`, `-`)
AC4 — implemented — tools/ticket-file.ts:68-69,98-116; status `stopped — waiting on vendor firmware` valid, bare `stopped` / `in progress` rejected, `source` absent / empty / `[]` / `[1234 rev 7, 1240 rev 2]` valid, URL entry rejected with the p.source line
AC5 — implemented — tools/ticket-file.ts:96
AC6 — implemented — tools/ticket-file.ts:179-182 (G/W/T), 211 (no scenarios), 212-216 (duplicate id), 217-223 (mismatch), 193-196 (no block), 198-206 (bad YAML)
AC7 — implemented — tools/ticket-file.ts:70,183-185; added scenarios count in the total (example: 4 scenarios)
AC8 — implemented in T-E422-02 (doc + template); the checker half passes both (exit 0)
AC9 — implemented in T-E422-02 (per the cut amendment)
AC10 — implemented — tools/ticket-file.ts:236-241 (README any case, `*.md` files only, sorted, sub-directories skipped), 252-258 (no-dir line, exit 0), 262-271 (cannot-read, exit 2, stderr)
AC11 — implemented — the 13 config test files: `# pass 213`, `# fail 0` (rerun by the reviewer)
AC12 — implemented — `git diff --stat c29f100...HEAD`: `dist/` changes only `dist/tools/ticket-file.*` and `dist/tools/config.*`; no `content/**`, `tools/registry.ts` or `docs/backlog.md` change

## Correctness
No required findings.

Edge cases verified by running the code: a byte-order mark followed by CRLF line ends parses clean; a duplicate field key gives the bad-YAML line (`duplicated mapping key`); an unclosed block gives the no-block line; an empty block lists the 7 missing required fields; a non-mapping block (`hello`) gives the bad-YAML line; `id: [E1]` gives the bad-value line (`must be text`); a scalar `depends on: E2` gives `must be a list`; a whitespace-only `title: '   '` counts as missing; `--- ` (trailing space) is accepted as the opening line, ` ---` (leading space) is not.

- **recommended** — tools/ticket-file.ts:166-169: the scenario heading shape is not checked. `### S1 - x` (hyphen instead of em dash) passes with id `S1 - x` and an empty title, and an id that does not start with a letter is accepted. The spec's "The format" section says the parser enforces the id rule ("letter first, then letters, digits or `-`"). Copy / Strings has no line for it, so this is a gap in the spec, and the sr interpretation (no check) is defensible. Later per-scenario records (E424) key on these ids, so the PM should add one Copy string (e.g. `scenario heading "<text>" is not "<id> — <title>"`) before E424 reads ids.
- **optional** — tools/ticket-file.ts:149-161: lines inside a fenced code block within a scenario still count. A `Verification:` or `Given` line inside a fence satisfies the checks (probe `fenceVerif` passes). Headings are fence-aware; content lines are not.
- **optional** — tools/ticket-file.ts:150-153: `## Added during build` is not required to be the last section. Placed before `## Scenarios`, its scenarios are still accepted. The append rule says "last section", and the doc says the same; no Copy string exists for it.
- **optional** — tools/ticket-file.ts:104: a single unquoted `source: 1234 rev 7` is accepted as a one-entry list (sr interpretation), while a single unquoted `depends on: E2` is rejected as "must be a list". The behaviour is lenient and harmless, but the two list fields are inconsistent, and the doc presents `source` only as a list.
- **optional** — tools/ticket-file.ts:217-222: a `needs device or person` value other than `yes`/`no` (e.g. `maybe`) is reported through the mismatch line (`is "maybe" but 0 scenario(s) use device-or-person`). It is reported, which is enough, and there is no Copy string for a bad yes/no value. The sr interpretation is accepted.
- **optional** — tools/ticket-file.ts:194-195: an unclosed block reports `the first line must be ---` even when the first line is `---`. The wording is fixed by Copy / Strings, so it is accepted as is.
- **optional** — tools/ticket-file.ts:250: every argument that starts with `-` is treated as an option, so a file named `-x.md` cannot be checked and `--` is not supported. This matches D7's "unknown option" rule and is negligible in practice.
- **optional** — tools/ticket-file.ts:70: the `Added:` date is checked only as `\d{4}-\d{2}-\d{2}`, so `2026-13-45` passes.

## Quality
- **optional** — tools/ticket-file.ts:38 vs 83-85: `TICKET_STATUSES` is exported but `isKnownStatus` hard-codes the same literals. Deriving one from the other would stop the two from drifting.
- Comment check (SOP 4b): the module header (lines 1-5) and JSDoc blocks are short and say what and why. They contain no local path, username or tracker URL. `agc check — comments` raises no warning on `tools/ticket-file.ts` or `scripts/check-tickets.mjs` (its one warning is on `tools/config.ts`, already over the limit at base; see T-E422-02).
- Strict TypeScript: no `any`. The `(err as Error)` casts follow the repo convention.
- `CLAUDE.md`: exactly the two approved edits (new `tools/ticket-file.ts` row after `tools/config.ts`; the `tools/transitions.ts` row joined onto one line with its text unchanged); `wc -l` = 250; nothing else changed.

## Architecture
No architecture spec (D3: architect hop skipped). The layering matches the spec's implementation notes: all logic is in `tools/ticket-file.ts`, and `scripts/check-tickets.mjs` is a thin wrapper importing `dist/` (same shape as `scripts/lane-status.mjs`). The field block is parsed with `js-yaml` using `FAILSAFE_SCHEMA` (every scalar is text, as D4 requires). The module never writes a file.
- **optional** — tools/ticket-file.ts:253 → tools/config.ts `loadConfig`: the checker inherits the loader's existing heal-on-read, which rewrites a pre-v2 `.current/.config.json` (observed in a probe: an unversioned config gained `"schema_version": 2`). The statement "this module never writes a file" (tools/ticket-file.ts:4-5) holds for this module, but running the checker can still write the config file through the loader. This is pre-existing loader behaviour and needs no change.

## Security
No findings. Input is read-only file text. `js-yaml` with `FAILSAFE_SCHEMA` constructs no custom types, and a merge key `<<` is reported as an unknown field. Paths come from the user's own argv/cwd. Output echoes field names and values verbatim to the terminal, which is acceptable for a local checker.

## Performance
No findings. One linear pass per file. `TICKET_FIELDS.some` runs over 8 entries. One `statSync` per directory entry. No hot path.

Same-model note: sr-engineer and code-reviewer both ran on opus (dispatch pins), so their blind spots may overlap.

## Verdict
APPROVED (task scope) — the parser and checker meet AC1–AC7 and AC10 with exact Copy / Strings text and exit codes; only recommended and optional notes remain. The feature-round verdict is CHANGES_REQUESTED on T-E422-02.

## Round 2 — APPROVED (task scope, carried) — by code-reviewer
No T-E422-01 file changed in `20bd6cf..HEAD` (only `docs/ticket-format.md` and `.current/e422/`), so the round-1 task approval and its recommended/optional notes carry over unchanged. The feature-round verdict is CHANGES_REQUESTED on T-E422-02 (round 2: double-quote backslash escape, docs/ticket-format.md:21-23).

## Round 3 — APPROVED (task scope, carried) — by code-reviewer
No T-E422-01 file changed in `8a0508b..HEAD` (only `docs/ticket-format.md`, review_reports/review_T-E422-02.md and `.current/e422/`), so the round-1 approval and its recommended/optional notes carry over unchanged. The feature-round verdict is APPROVED (round 3, see review_reports/review_T-E422-02.md).
