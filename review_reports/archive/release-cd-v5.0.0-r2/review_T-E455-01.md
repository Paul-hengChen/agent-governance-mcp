# Review — T-E455-01

covers: T-E455-01, T-E455-02, T-E455-03, T-E455-04, T-E455-05, T-E455-06

## Round 1 — APPROVED — by code-reviewer

Feature `e455-ticket-checker-strict`, branch `feat/e455-ticket-checker-strict`, base `70d34c6`, head `d03392d`. Model: opus (the sr-engineer hop is also pinned opus; same-model bias possible, mitigated by independent probes of the built checker below).

## Summary
- Tightens the ticket-file checker (`tools/ticket-file.ts`) on the seven E455 items: heading separator + id shape, `needs device or person` yes/no, fenced lines excluded from scenario lines (both directions), per-entry list messages, real calendar `Added:` dates, and `##` sections / `###` headings after `## Added during build` reported; `tools/config.ts` trims in `isNonEmptyString` and rejects a `ticketDir` normalizing to `.`.
- Docs: `docs/ticket-format.md` states every new rule; `docs/config.md` changes are two one-line hunks at base lines 185 and 208 (inside 185–225). `dist/` is byte-identical to a fresh `npm run build`.
- Tests: one new file, 34 tests over AC1–AC9, Copy / Strings pinned verbatim, suppressed messages asserted absent; manifest of 26 base reds, all green now.
- Every changed path is inside the lane's owned set; `scripts/check-tickets.mjs` and the three `test/e422-*` files are untouched.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — tools/ticket-file.ts:72 (`SCENARIO_ID_RE`), :206-211 (`checkScenario`: separator first, id shape only when the separator exists); probes `### S1 - hyphen not emdash`, `### S1`, `### 1bad id — x` each yield exactly one message, parse shape unchanged.
AC2 — implemented — tools/ticket-file.ts:126-127 (yes-no branch in `checkFields`; value not stored, so the count-mismatch block is skipped); probe `maybe` with a device-or-person scenario reports only `e455.yes-no`.
AC3 — implemented — tools/ticket-file.ts:167-169 (fence delimiter and fenced lines `continue`); probes: fenced extra `Verification:` → no problem; Given only inside `~~~` → `scenario S1 has no Given line`.
AC4 — implemented — tools/config.ts:154-156, :207-211; probes `"."`, `"./"`, `"a/.."`, `"a/../"`, `"./."`, `"   "` all drop to `docs/tickets` with `getConfigError` null; the CLI checks `docs/tickets/t.md`, never the root `CHANGELOG.md`; whitespace-only `sisterRepos` `path` / `owns` / `backlog` / `contracts` dropped, `" o "` kept verbatim.
AC5 — implemented — tools/ticket-file.ts:89-100 (`checkListEntries`), :114-121; probes `[E1, [x]]` → `entry 2 is not text`, `[E1, '']` → `entry 2 is empty`, no `must be a list`; scalar `depends on: E1` still `must be a list`; scalar `source` string unchanged.
AC6 — implemented — tools/ticket-file.ts:194-200 (`isCalendarDate`), :224-230; probes `2026-13-45`, `2026-02-30` → `e455.added-date`, missing-Added suppressed; `2024-02-29` valid.
AC7 — implemented — tools/ticket-file.ts:170-182; probe `## Notes` + `### S3 — x` after the added section → one `section-after-added` and one `heading-not-read`, S3 not in `scenarios`; a fenced `## Notes` after the added section is not reported.
AC8 — implemented — docs/ticket-format.md:19-20, :48, :85-88, :99-101, :130-132; e422 doc tests green; example passes the checker.
AC9 — implemented — docs/config.md:185, :208; `git diff -U0 70d34c6 -- docs/config.md` hunks `@@ -185 +185 @@` and `@@ -208 +208 @@` only.
AC10 — implemented — full suite after the last commit, see qa_reports/review_T-E455-01.md; e422 files unedited (`git diff --name-only` shows none).

## Correctness
No required findings.

Tests (step 4): every AC1–AC9 scenario has at least one test on the public interface (`parseTicketFile`, `loadConfig` / `resolveTicketDir` / `getConfigError`, and the `scripts/check-tickets.mjs` CLI); assertions use exact-string counts (`count(... ) === 1`) or `deepEqual` on the full problem list, so a wrong or doubled message fails. Suppression assertions exist for AC2 (count-mismatch), AC5 (`must be a list`, `source entry`), AC6 (missing-Added). AC3 is tested in both directions and for both fence kinds. AC4 covers the `sisterRepos` side effect of the trim (path, owns, backlog, contracts, and a non-blank value with surrounding spaces kept verbatim). No `git show`, no base-tree read; files read into memory at module load; only Node 20-available built-ins. AC9's out-of-range scope check is judge-run (done above), as the spec directs. Coverage: no line-coverage tooling is wired for `node --test` here; by inspection every new branch in the two source files is reached by at least one test (separator / id-shape, yes-no, fence skip, entry-not-text / entry-empty / scalar, calendar date valid / invalid, after-added `##` / `###`, ticketDir `.` / whitespace, sister trim).

Implementation probes beyond the tests (all behave as the spec says or as unchanged base behaviour):
- `### — only title` → `heading-no-separator` (no ` — ` because the line is trimmed); accurate.
- Two `Added:` lines, one impossible → one `added-date` for the bad date, no missing-Added (spec: shape-matching line exists).
- `# Title` (h1) after `## Added during build` keeps base behaviour (spec Out of Scope).
- `## Added during build` placed before `## Scenarios` now reports `section-after-added` and `heading-not-read` for each `### ` under `## Scenarios`, plus `no scenarios`. This follows the documented rule ("last section") and AC7's "a second `## Scenarios`" wording; noted below as optional.

## Quality
- recommended — test/e455-ticket-checker-strict.test.mjs:1-9: `agc check — comments` flags a 9-line header block (limit 7). Kept: it is the file's single WHAT/WHY header, advisory only; trimming two lines would be enough if the file is touched again.
- `agc check — comments` also flags tools/config.ts high-ratio (40%); pre-existing (base 203/512 comment lines, 39.6%; this diff adds 3 net comment lines). Kept: not introduced here.
- New code comments (tools/ticket-file.ts:89-92, :154-158, :194; tools/config.ts:152-153, :204-206) state WHAT/WHY only, cite no repo-only path and no ticket id (Constitution §6, information hygiene).
- `checkListEntries` replaces `asTextList` cleanly; no dead code left.

## Architecture
No architecture spec (test-first chain, no architect). Changes stay in the two files the spec names; exported types, `TicketParseResult` shape, `TICKET_FIELDS`, `FORBIDDEN_FIELD_NAMES`, `TICKET_STATUSES` unchanged; `scripts/check-tickets.mjs` unchanged. `collectScenarios` now takes the shared `problems` array, the same pattern `checkFields` / `checkScenario` already use.

## Security
No findings. Input is local ticket text and a local config file; no new I/O, no new trust boundary. The `ticketDir` change narrows the accepted set (rejects the workspace root), which removes the root-sweep behaviour.

## Performance
No findings. All new checks are single passes over lines or list entries (O(n)); `addedDates` maps the scenario's lines once. No regression vs base.

## Verdict
APPROVED — all ten ACs are implemented and proven, every Copy / Strings message matches verbatim, the tests pin each scenario with tight assertions, and the full suite is green apart from the two known e130 skips.

## Notes (non-blocking, not tickets)
- optional — `ticketDir: " . "` (dot with surrounding spaces) is kept verbatim and resolves to a directory literally named ` . `; consistent with the spec's "surfaced value stays verbatim" (Out of Scope: trimming), mentioned only for awareness.
- optional — a ticket with `## Added during build` before `## Scenarios` now fails with `no scenarios` plus a `heading-not-read` per scenario; correct per the documented order, but a writer who swapped the two sections sees three kinds of message for one mistake.
