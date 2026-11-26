# Review — T-E425-01

covers: T-E425-01, T-E425-02, T-E425-03, T-E425-04, T-E425-05, T-E425-06

## Round 1 — APPROVED — by code-reviewer

## Summary
- Feature `e425-stop-ticket-batch` (E425 + E427 amendment (2)), lane e425, `git diff 976a7890...HEAD` (28 files). Spec `specs/e425-stop-ticket-batch.md`, human-approved cut @ 25aabf19 (rulings Q1 (a), Q2 ticket file, Q3 two extra groups).
- Text: lane-protocol §3 `### 批次 lane` (C-LP2) + C-LP1 / C-LP3 suffixes; ticket-format C-TF1 / C-TF2 / C-TF3; const-08 C-C08; coord-03 C-CO3 row, coord-07 C-CO7; integrator C-IN1..C-IN3; qa C-QA; code-reviewer C-CR (step 4a).
- Code: new `scripts/batch-summary.mjs` (237 lines), read-only, imports `parseTicketFile` / `resolveTicketDir` from `dist/`. No `.ts`, `dist/`, gate, error-code, `GATE_REGISTRY` (33) or `UPDATE_STATE_GATE_PIPELINE` (17) change (verified from `dist/`).
- Tests: `test/e425-stop-ticket-batch.test.mjs` (14 tests, AC1–AC14) + T-E425-06 re-captures (exactly the 7 chain/coordinator goldens) and three context-budget caps; integrator-granted re-pins e118 AC7, e410 AC2, e349 AC-E349-2 and the one addendum entry stay inside their grants (mailbox `_mailbox/e425/to-lane.md` lines 42, 53–54).
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — docs/lane-protocol.md:41 (C-LP1), :55–65 (C-LP2), §5 rule 2 cut 預審 line (C-LP3); only line 41 changes before §3's end; eight `## ` headings kept
AC2 — implemented — content/const-08-chain-31-mid.md:5 (C-C08 directly after the Manifest-tier line; Cut-Approval and Manifest lines byte-unchanged)
AC3 — implemented — content/coord-03-core-fallback.md:40 (C-CO3, last row, 4 cells); content/coord-07-core-sop.md:15 (C-CO7 suffix)
AC4 — implemented — content/skill-integrator.md:120 (C-IN1), :176 (C-IN2), :208 (C-IN3); once-approval sentence kept; no Escalation Routes heading
AC5 — implemented — docs/ticket-format.md:65–69 (C-TF1, wrapped to the doc's column like its neighbours); check-tickets accepts the fixed wordings and the two prose sections
AC6 — implemented — docs/ticket-format.md:180–201 (C-TF2 between Named tests and Example ticket), :276–285 (C-TF3, tooling section last)
AC7 — implemented — scripts/batch-summary.mjs:122–131 (classification), :186–206 (render)
AC8 — implemented — scripts/batch-summary.mjs:194–197; C-LP2 「理由點名卡住的東西」
AC9 — implemented — scripts/batch-summary.mjs:110–120 (Added notes), :139–142 (decisions), :156–190 (report match by whole-word id)
AC10 — implemented — scripts/batch-summary.mjs:129, :143–145, :199; C-LP2 *待人工驗收* bullet
AC11 — implemented — scripts/batch-summary.mjs:44–60, :209–216, :231–237 (no write call anywhere in the script)
AC12 — implemented — scripts/batch-summary.mjs:220–223, :205
AC13 — implemented — content/skill-qa-engineer.md:56 (C-QA last bullet of step 6); content/skill-code-reviewer.md:73 (C-CR as step 4a)
AC14 — implemented — every added content line is free of bare ticket ids and repo-only paths (only `docs/lane-protocol.md` and `<agc install>/scripts/batch-summary.mjs`)
AC15 — implemented — 7 goldens (8+, 1−), 5 lite goldens unchanged; caps 9236→9336, 7324→7424, 19221→19449 each with a per-hunk comment and the E418 delta; full suite green

## Correctness
Tests (step 4): every AC1–AC14 has one test on the public surface (served prompt via `buildPromptForRole`, the docs as shipped, the script as a black-box subprocess) whose assertion fails on a wrong outcome. AC7 pins the whole summary output exactly; AC9 pins the unrelated-`e9010` exclusion and the section stop at the next `## `; AC11 pins sha256 trees before/after plus the three messages and exit codes; AC12 derives the problem count from the parser rather than a magic number. Negative control (scratch copy outside the worktree, deleted afterwards): disabling the `waiting` branch in the script turned AC7 red; renumbering C-CR to `4b.` turned AC13 and AC14 red; the other 11 stayed green.

Step 4a (named tests, the step this lane adds): this lane runs without a ticket file (spec AC list stands in as scenarios), so there is no `Verification: test …` line to check; the Scenario → Test Map titles in `qa_reports/tests_e425-stop-ticket-batch.md` each match exactly one test title in the file and each test checks its AC (read above).

Copy audit (step 5a): all 15 Copy / Strings blocks are present verbatim — the content/** blocks as exact lines (AC2/3/4/13 tests compare byte-equal), C-LP1..3 byte-equal, C-TF1..3 whitespace-normalised (the doc hard-wraps at its existing column; prose meaning and every token identical). C-BS: every header, item-line shape and message in the script matches the spec block (`batch-summary: <n> ticket(s)`, ten groups in order, two- and four-space indents, `(none recorded)`, `(no check text)`, the no-directory message and the three exit-2 messages).

Semantics: stop / waiting / manual are consistent across C-LP2, C-C08, C-CO3, C-IN1..3, C-TF1/2 and the script — a `waiting on` status goes only to `waiting`, `awaiting manual verification` only to its group (not `stopped`), any other `stopped — <reason>` to `stopped` with its `## Open question` lines; C-CO3 "a PASS stays PASS" matches C-LP2's run-to-PASS-then-set-status rule; C-LP2 (d) writes `Blocked` only where the server accepts it.

- `recommended` — docs/ticket-format.md:60 (pre-existing *Status values* example) `stopped — waiting on vendor firmware` now collides with the fixed `waiting on <id>` wording C-TF1 introduces: the summary would list such a ticket under `waiting` ("waiting on vendor firmware") instead of `stopped` with its open question. Not a defect against the approved spec (the spec fixes only the form), but the example invites exactly the ambiguous wording; a follow-up could change the example text.
- `optional` — scripts/batch-summary.mjs:69–84: passing a directory and a file inside it counts that ticket twice; harmless for the documented call shape (one directory or a file list).

## Quality
No findings beyond the above. The script mirrors `scripts/check-tickets.mjs` conventions (`display()`, `README.md` skip, first-clause error reason so no absolute path leaks). Naming is clear; no dead code.

Comment check (step 5d), `agc check — comments` warnings touching the diff:
- test/e425-stop-ticket-batch.test.mjs:1 long-block 13 lines — kept: it states the WHY of the feature, the AC-id title convention used for `--test-name-pattern`, and the resident-test-hygiene note on frozen literals (base 3de5b143 = the cut-approval commit, an ancestor of HEAD), all load-bearing for whoever re-pins later. `optional`: could be trimmed to ~7 lines.
- test/context-budget.test.mjs:594 / :624 / :957 long-block, high-ratio; test/e118-reviewer-ac-completeness.test.mjs:223 long-block — kept: each hunk adds one line to the file's existing per-cap re-baseline history, which AC15 requires ("one comment per cap explaining the hunk and the delta against the E418 saving").

## Architecture
No architecture spec (no gate/schema/pipeline change; spec chose no architect). Layering fits: the mechanism lives once in `docs/lane-protocol.md` §3; the constitution, coordinator and integrator only name the override and point at it; the script reuses the existing `dist/` parser and config resolver rather than adding exports to `tools/ticket-file.ts`. Scope: every touched file is in the lane's owned set (`specs/fanout-post-v5-w2.md` Lanes row) or under the integrator's mailbox grant (addendum §5 bullet 2 gains exactly one `node scripts/batch-summary.mjs` entry and no other line; e118 changes only the AC7 cap/title + one comment; e410 only AC2 line numbers / counts; e349 only the TOOLS literal plus `batch-summary` in the SOP-calls list). `content/**` additions carry no repo-only path or bare ticket id.

## Security
No findings. The script only reads (`readdirSync`, `statSync`, `readFileSync`); paths come from argv/config of the operator's own repo; error messages print the first clause of the error (no absolute path, no stack) for expected failures; the RegExp built from a ticket id is escaped (scripts/batch-summary.mjs:152–158). No secrets, no network. `npm audit --audit-level=high` exit 0.

## Performance
No findings. One pass over ticket files and the reports directory; report-to-ticket matching is O(tickets × reports) over small sets in a one-shot CLI. Served-prompt cost: +100 ~tok on both constitution arms and +228 ~tok on the teamwork bundle, measured and capped, about 9–10% of the E418 saving; lean bundle and role caps unchanged.

## Verdict
APPROVED — every AC1–AC15 is implemented and genuinely tested, Copy / Strings are verbatim, the batch-lane semantics are consistent across all six surfaces, scope stays within the lane and the integrator grants, and build, audit and the full suite are clean.
