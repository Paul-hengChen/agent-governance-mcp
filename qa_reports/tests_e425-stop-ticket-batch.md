# Tests — e425-stop-ticket-batch (T-E425-01)

Author: qa-engineer. Spec: `specs/e425-stop-ticket-batch.md` (cut approved; Q1 (a), Q2 ticket-file section, Q3 two extra groups).
No ticket file: the spec's Acceptance Criteria stand in as the scenarios. AC15 is T-E425-06 (planned return), not here.

Test-file placement: the dispatch brief's `Test-file placement` line pre-authorised a new `test/e425-*.test.mjs`
file (Constitution §2 *Conditional test writing*, brief branch). No existing test file covers these scenarios.
One file, `test/e425-stop-ticket-batch.test.mjs`; every summary-script fixture is built in an `os.tmpdir()` temp dir
inside the test (no files under `test/fixtures/`).

Frozen literals: the 14 Copy / Strings blocks (`FROZEN.COPY`), the served Cut-Approval Gate and Manifest-tier lines
(`CUT_LINE`, `MANIFEST_LINE`) and the 16 served coordinator Escalation Routes lines (`ESC_ROWS`, header and separator
included) were extracted once, mechanically (JSON), from the spec and from `buildPromptForRole` output at base
3de5b143. Nothing is read through git or from the spec at test time.

Satisfiability check: in a scratch copy of the worktree (deleted afterwards, nothing committed) the Copy / Strings
were placed exactly as the spec states and a throwaway summary script was written to the C-BS / C-TF3 contract:
all 14 tests went green, and the placement pins the spec lists (`e290`, `e433`, `e383`, `e385`, `e422-ticket-format-doc`,
`e178a`, `e286`, `e295`, `e453`, `e427-ticket-format-doc`) stayed green apart from an `e295` AC12 case that needs a
`.git` (absent in the copy; green on the real tree).

## Scenario → Test Map

All tests are in `test/e425-stop-ticket-batch.test.mjs`.

| scenario | test name |
|---|---|
| AC1 | `AC1: lane protocol holds C-LP1, C-LP2 and C-LP3 at their places; skeleton and line 41 index kept` |
| AC2 | `AC2: C-C08 is served once, directly after the Manifest-tier line, on both arms; lite does not carry it` |
| AC3 | `AC3: coordinator Escalation Routes ends with the C-CO3 row, other rows unchanged; step 6 ends with C-CO7` |
| AC4 | `AC4: integrator stage text carries C-IN1, C-IN2, C-IN3 as sub-bullets; once-approval sentence kept; no Escalation Routes` |
| AC5 | `AC5: ticket format holds C-TF1 after 'No other value is valid'; the fixed stop wordings pass check-tickets` |
| AC6 | `AC6: ticket format has ## Batch summary (C-TF2) between Named tests and Example ticket; tooling ends with C-TF3` |
| AC7 | `AC7: a stop spreads to dependents only — A stopped, B and D waiting on A, C done` |
| AC8 | `AC8: a stop outside the allowed paths shows its reason with the path; C-LP2 requires naming it` |
| AC9 | `AC9: added scenarios, agent decisions, qa interface decisions and allowed visual differences reach the summary` |
| AC10 | `AC10: a device-or-person ticket is listed under awaiting manual verification with its check; C-LP2 states PASS-then-stop` |
| AC11 | `AC11: the summary only reads — no file changes; no ticket directory and unknown option messages` |
| AC12 | `AC12: a malformed ticket is listed under unreadable tickets with its problem count; the valid ones are summarised` |
| AC13 | `AC13: qa-engineer step 6 ends with C-QA; code-reviewer carries step C-CR directly after step 4` |
| AC14 | `AC14: every string this lane adds under content/** names no repo-only path and no bare ticket id` |
| AC15 | T-E425-06 (no new test; existing pins re-baselined): `test/compose-equivalence.test.mjs` (the six build/hook/monolith golden tests), `test/skill-manifest.test.mjs` t-golden-byte-identity, `test/context-budget.test.mjs` `AC8/AC-P2-7: rationale-stripped (design-arm) constitution is at/below the measured floor (≤ 9336 ~tok)`, `AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 19449 ~tok)`, `AC8/AC-P2-7: non-design (design-only + rationale stripped) constitution is at/below the floor (≤ 7424 ~tok)` |
| AC16 | `AC16: the Status values example reason for 'stopped — <reason>' is C-TF4, not a 'waiting on' form` (doc half; the `agc check` half is a command for the judge, see T-E425-07) |

Not automated by these tests, for the judge: AC1's proof also names `node --test test/e290-lane-protocol-generic.test.mjs
test/e433-test-first-rules.test.mjs test/e383-lane-ledger-worktree.test.mjs test/e385-worktree-evidence.test.mjs`
(existing tests, run as-is). AC1's "no line before line 41 changes" is pinned here as an index check (line 39 is the §3
heading, line 41 the §3 first bullet), which catches any inserted or removed line before it; a same-length content
change on lines 1–40 is visible only in `git diff <base>...HEAD -- docs/lane-protocol.md`, which the judge reads.

## T-E425-06 — AC15 re-capture and re-pins (planned return)

Goldens re-captured by tool: `npm run build && node scripts/capture-constitution-golden.mjs`. `git diff --stat` over
`test/fixtures/compose-golden` lists exactly the seven chain/coordinator goldens (build-full-design, build-full-design-fd,
build-full-nondesign, build-full-nondesign-fd, constitution-monolith, hook-full, skill-coordinator-monolith; 8+, 1-);
the five lite goldens are byte-unchanged. No golden hand-edited.

Context-budget caps (measured, zero headroom, one per-hunk comment each in `test/context-budget.test.mjs`):

| cap | was | measured | delta | E418 saving | share given back | net vs pre-E418 |
|---|---|---|---|---|---|---|
| design-arm constitution (C-C08) | 9236 | 9336 | +100 | −1065 | 9.4% | −965 |
| non-design constitution (C-C08) | 7324 | 7424 | +100 | −985 | 10.2% | −885 |
| teamwork bundle (C-C08 +100, C-CO3 + C-CO7 +128) | 19221 | 19449 | +228 | −2490 | 9.2% | −2262 |

Design-only strip saving stays 1912 (C-C08 lands on both arms). Matches the spec estimate (+100 / +100 / ≈ +229).

Re-pinned tests (integrator-assigned; only the assigned values changed):

- `test/e118-reviewer-ac-completeness.test.mjs` `AC7 - token discipline: file grows by at most 4466 bytes over BASE (9525 bytes)`
  — size cap 13760 → 13991 (measured `content/skill-code-reviewer.md`), title growth 4235 → 4466; reason: the
  code-reviewer named-test confirmation step (C-CR). `growth >= 0` assertion unchanged.
- `test/e410-task-alias-content-tail.test.mjs` both AC2 tests — line numbers / counts only, verified against the files:
  const-08 row 5 → 6, count 11 → 12; skill-integrator rows 177 → 179, 181 → 183, 248 → 251, count 249 → 252. The brief's
  178 / 182 were off by one: the two spans actually sit on lines 179 and 183 (C-IN1 and C-IN2 both land above them).
- `test/e349-integrator-repo-facts.test.mjs` AC-E349-2 — `TOOLS` literal gains `、`node scripts/batch-summary.mjs`` to match
  the addendum §5 line; `batch-summary` added to the enumerated SOP-calls list (the integrator SOP calls it through
  `<agc install>`).

Expected-red manifest: unchanged in substance — the re-pins are green on arrival, so T-E425-06 adds no red.

## T-E425-07 — rework (AC16, R2)

Spec: `## Rework after lane report` (human-approved cut @ 7c20a10a). Placement: the brief's `Test-file placement` line
(existing file `test/e425-stop-ticket-batch.test.mjs`).

- **AC16 (R1)**: new test; reads the one `| \`stopped — <reason>\` |` row of `docs/ticket-format.md`, takes its single
  ``for example `…` `` value, asserts it does not begin with `stopped — waiting on` and equals C-TF4 (added to
  `FROZEN.COPY` verbatim from the spec table). Red now: the example is `stopped — waiting on vendor firmware`.
- **AC16 `agc check` half (command, for the judge)**: `node bin/agc-init.mjs check` — after this commit it prints no
  `comments` line at all for the lane's files (checked before commit: zero `comments` warnings in the whole run).
- **R2 trims (comments only; no assertion, cap, title or expected value changed)**:
  - `test/e425-stop-ticket-batch.test.mjs:1` header 13 → 7 lines (Coded-by line + 6).
  - `test/context-budget.test.mjs`: the three `// E425 re-baseline:` cap-history lines are removed, so the blocks at
    594 / 624 / 957 are byte-identical to `main` and the file adds no comment line (the high-ratio advisory fires only
    when the file adds one; ratio back to main's). The E425 cap detail lives in the spec rework section, the
    `T-E425-06` table above and the assert messages ("E425 re-baseline, zero headroom").
  - `test/e118-reviewer-ac-completeness.test.mjs:223`: the E425 line is folded into the E424 entry, block 8 → 7 lines.

## Open Interface Details

The spec's C-BS / C-TF3 fix the output lines, messages and exit codes. Decided here, following
`scripts/check-tickets.mjs` (the script imports the same `parseTicketFile` / `resolveTicketDir`):

1. **Header count** — `batch-summary: <n> ticket(s)`: `<n>` counts every ticket file read, unreadable ones included
   (AC12: two valid plus one malformed prints `3 ticket(s)`). Reason: same as check-tickets' `<n> file(s)`; a malformed
   file must not vanish from the count either (Q3).
2. **Shown paths** (`<file>` under `unreadable tickets`, `<report path>` in report groups, `<dir>` in the no-directory
   message, `<path>` in `cannot read`) — relative to the working directory when the file is under it, otherwise as
   given; i.e. check-tickets' `display()` rule. Pinned cases: `tickets/bad.md`, `qa_reports/tests_e901-csv.md`,
   `docs/tickets` (default ticket directory, empty cwd), `nope.md`.
3. **Directory arguments** — a directory argument summarises every `.md` file directly inside it except `README.md`
   (case ignored), like check-tickets; the default ticket directory behaves the same (AC11 puts a `README.md` there).
4. **Item order inside one ticket** — added scenarios, agent decisions and report lines keep their order in the file;
   across tickets, ids are sorted; across reports of one ticket, file names are sorted (C-BS "ids and file names
   sorted").
5. **`awaiting manual verification`** — one line per `device-or-person` scenario of a ticket whose status is
   `stopped — awaiting manual verification`; such a ticket is not also listed under `stopped`. A `stopped — waiting on …`
   ticket is listed only under `waiting`. Every other `stopped — <reason>` goes under `stopped`.
6. **Report line trimming** — each section line is trimmed on both sides (AC9 pins an indented line with trailing
   spaces); the leading `- ` of a report line is kept (C-BS prints `<line>`), while an agent-decision item loses it
   (C-BS: "without the leading `- `"). A report section ends at the next `## ` heading (AC9 pins that a following
   `## Red Reasons` section is not read).
7. **Report kinds** — only `tests_*.md` files contribute `## Open Interface Details` lines and only `visual_*.md`
   files contribute `## Allowed Differences` lines (C-TF3).
8. **Usage errors print nothing on stdout** (AC11: `--bogus` leaves stdout empty).
9. **`cannot read <path>: <reason>`** — the test pins the prefix up to `: ` only; the reason text is free (check-tickets
   uses the first clause of the error message).

## Red Reasons

- AC1 — `docs/lane-protocol.md` has no C-LP1 suffix (first failing assert: "§3 first bullet ends with C-LP1").
- AC2 — C-C08 is not in `content/const-08-chain-31-mid.md` (0 occurrences, expected 1).
- AC3 — the last Escalation Routes row is still the visual-judge row, not C-CO3.
- AC4 — C-IN1 is not a line of `content/skill-integrator.md`.
- AC5 — the paragraph after "No other value is valid" is still `### Field names that are not allowed`, not C-TF1 (the
  check-tickets half already passes: the three fixed wordings and the two prose sections are valid today).
- AC6 — `docs/ticket-format.md` has no `## Batch summary` heading.
- AC7–AC12 — `scripts/batch-summary.mjs` does not exist: node exits 1 with "Cannot find module" (AC8 and AC10 also need
  C-LP2 in the lane protocol).
- AC13 — the last bullet of qa step 6 is still *No new test needed*, not C-QA.
- AC16 — `docs/ticket-format.md` *Status values* example is still `stopped — waiting on vendor firmware` (T-E425-08 sets C-TF4).
- AC14 — C-C08 is not yet in `content/const-08-chain-31-mid.md` (presence is checked before the scan).

## CI Runnability

Headless: `node --test test/e425-stop-ticket-batch.test.mjs` needs only `dist/` (built by `npm test`'s prebuild) and
`os.tmpdir()`; no network, no human input.
