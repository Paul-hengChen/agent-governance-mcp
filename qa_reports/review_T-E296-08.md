# QA review — T-E296-08 (integration-time test fix on integ/post-v4-w3)

Verdict: PASS. Single-role judge (test-only), dispatched by the integrator (skill-integrator 5b-7 precedent). Changed file: `test/e296-manifest-tier.test.mjs` (plus this evidence). No program code, `content/`, `specs/`, `dist/` or other test file touched. No state writes (E222 precedent).

## Defect

CI run 38723137283 on `42d1305` was red 1/3185: `test/e296-manifest-tier.test.mjs` "AC11: in-bounds cut exits 0 and prints the approval / human-decisions fact lines" asserted `^human-decisions: 2 row\(s\); latest 2026-10-15$` while running `check --cut` against the committed wave manifest `specs/fanout-post-v4-w3.md`.

## Root cause

A test defect, not a flake. The test pinned the content of a living document: the wave manifest's `## Decisions` table grows as integrators append rows during and after a wave (the close-out bookkeeping commit brought it to 9 人類 rows). The same coupling ran through the whole file: every `runCut` default, `nineCol`, and the AC9/AC10/AC12/AC11 cases read `specs/fanout-post-v4-w3.md`, so lane re-drawing (the e296 擁有 cell already changed mid-wave), new lanes, or new Decisions rows could break them.

## Fix

The file now builds a frozen manifest in-test (`MANIFEST_TEXT`, written once to the test's tmp dir as `MANIFEST`):
- 8-column Lanes table, two lanes. Lane e296's 擁有 and 禁止 cells are copied verbatim from the wave-3 manifest at wave close (they drive every containment case). 範圍切線 and the e308 row are shortened; no assertion reads them.
- Dispatch pins for both lanes.
- A fixed Decisions table: 3 人類 rows (2026-10-13, 2026-10-15, 2026-10-14 in that order) plus one 整合者 row dated 2026-10-16. The expected fact line `human-decisions: 3 row(s); latest 2026-10-15` therefore pins the count, "latest = max 人類 date, not last row", and "non-人類 rows do not count toward latest".

All references to the committed wave-3 manifest (`W3`, `w3Text`) are gone; the committed manifests are read only by AC9's validate sweep and AC10's w2 control.

## Assertions audited (every use of a committed manifest)

| test | assertion(s) | before | disposition |
|---|---|---|---|
| AC9 validate sweep | every `specs/fanout-*.md` validates; only wave5.1 / wave6 exit 2 | all committed manifests | KEPT. Pins validity, not content: well-formed Decisions appends, close-out sections and bookkeeping don't change the validate exit. A new or edited manifest that fails validate is a real defect (fanout refuses it at dispatch), so failing is correct. Remaining coupling: a future manifest committed with a deliberate validate error would need this list updated. |
| AC9 9-column accepted | human / — / empty validate 0 | w3 + 9th column | SWITCHED to frozen (`nineCol` now extends `MANIFEST_TEXT`) |
| AC9 bad approval / header | `APPROVAL_VALUE_UNKNOWN`; `0 dispatchable lane(s), 2 provisional`; `LANE_PROVISIONAL`; parsed `approval` human / undefined | w3 | SWITCHED. The "2 provisional" count depended on the live lane count. |
| AC9 8-column + short row | validate 0; dropping a cell gives exit 2 | w3 | SWITCHED |
| AC10 HEAD vs base render | sha256 and stdout equal, HEAD code vs base `c392cc3` code | w3/e296 + w2/e295 | w3 SWITCHED to frozen (still an existing 8-column manifest, as AC10 requires). w2 KEPT: wave 2 is closed, and the check compares HEAD with base on the same input, so no content is pinned. It would only break if the closed w2 file gained a 9th `approval` column, which base code cannot render. |
| AC10 9-col == 8-col render | render output equal | w3 | SWITCHED |
| AC12 plain check | `check <m> nolane` gives LANE_NOT_FOUND; `check <m> e296 --repo <empty>` gives REF_NOT_FOUND; `check --cut <m>` gives USAGE | w3 | SWITCHED (the lane must exist with a branch cell; frozen copy guarantees it) |
| AC11 in-bounds (the CI failure) | exit 0; no OUT; `approval: —`; human-decisions fact line; summary line | w3 Decisions (mutable count / date) | SWITCHED; now exact `3 row(s); latest 2026-10-15` against the fixed table |
| AC11 out-of-bounds | one OUT line `(禁止: tools/**)` | live e296 禁止 cell | SWITCHED (verbatim frozen cell) |
| AC11 glob / out-of-set / separators / two rows | exit 0/1 and OUT lines | live e296 擁有 cell | SWITCHED via the `runCut` default |
| AC11 approval: human | APPROVAL_HUMAN exit 1; `—` exit 0 | w3 + 9th column | SWITCHED |
| AC11 no 人類 row | DECISIONS_HUMAN_ROW_ABSENT exit 1; fact line | w3 with 人類 rewritten | SWITCHED; tightened to the exact line `human-decisions: 0 row(s); latest —` |
| AC11 Decisions header / unknown lane | exit 2 DECISIONS_HEADER_DIFFERS; unknown lane exit 2 | w3 | SWITCHED |
| AC11 spec-side errors, unreadable spec | exit 2 with own code | w3 | SWITCHED |
| AC11 never writes | spec and manifest byte-identical after `check --cut` | w3 | SWITCHED (frozen manifest file compared before/after) |
| AC15 C4 / C5 / R1 / rounds 1-3 / edges / bare CR | exit codes and first error codes | live e296 擁有 cell (exit 0/1 baselines) | SWITCHED via the `runCut` default |
| AC15 own spec | no format error; OUT only the e297 token; CRLF parity; without-token exit 0 | live e296 row + `specs/e296-manifest-tier-cut-approval.md` | Manifest SWITCHED. The frozen row carries the e297 token, so nothing is OUT. The tolerance and its comment are kept. Still reads the shipped lane spec, which is not a wave manifest. |

Not in scope (no manifest read): AC1–AC8, AC12 usage text, and AC14 pin `content/`, `docs/` and `scripts/` literals per the spec proofs. Those are deliberate contract pins.

## Commands and results

- `node --test test/e296-manifest-tier.test.mjs`: exit 0; tests 35, pass 35, fail 0, skipped 0 (AC10 ran: base commit present).
- `node scripts/test-lock.mjs -- npm test` (serial, includes prebuild): exit 0; tests 3185, pass 3182, fail 0, cancelled 0, skipped 3. The 3 skips are pre-existing history-dependent ACs for unresolvable commits 121ddc8 / 3c72a83. E312 (`test/e123b9-lane-flip.test.mjs` AC-MIG-3) did not fire. `git status` after the run showed only the target test file modified (the build produced no `dist/` diff).

## Mutation check

Copies of the test file were placed outside the worktree (session scratchpad), with `ROOT` pointed at the checkout. Each was run with `--test-name-pattern="AC11: in-bounds"`:
- control (unmutated copy): pass 1, fail 0.
- m1: the 2026-10-13 人類 row changed to 整合者. FAIL, actual `human-decisions: 2 row(s); latest 2026-10-15`.
- m2: the 2026-10-16 整合者 row changed to 人類. FAIL, actual `human-decisions: 4 row(s); latest 2026-10-16`.

The repo file was never mutated, and the copies were discarded. The assertion is sensitive to both the count and the latest date.

## Notes

- Phase 0.5 / 1.5 / 3.5: not applicable (integration-time test-only fix; no expected-red manifest, visual baselines or proof-annotated spec for this id).
- A pre-existing `git stash` entry on this branch (`w3 integrator bookkeeping (ride 5c)`) was left untouched.
