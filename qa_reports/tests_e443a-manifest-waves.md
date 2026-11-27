# Tests — e443a-manifest-waves (T-E443A-01)

qa-engineer, 2026-11-27. Spec: `specs/e443a-manifest-waves.md` (interface I1–I4, scenarios A1-1..A1-12). No
ticket-format file exists for this ticket (the spec's Acceptance Criteria stand in as the scenarios), so no
`Verification:` line was rewritten. Test-file placement: the dispatch brief's `Test-file placement` line (new files
pre-authorized) — that branch of Constitution §2 *Conditional test writing* was acted on.

## Scenario → Test Map

| scenario | test file | exact test name |
|---|---|---|
| A1-1 | `test/e443a-wave-columns.test.mjs` | `A1-1: a Lanes table with 波次 (shapes 3 and 4) validates, checks clean, and parses wave and depLanes` (subtests: validate ok line; parseManifest wave/depLanes; approval by position; check against a temp repo) |
| A1-2 | `test/e443a-wave-columns.test.mjs` | `A1-2: a bad 波次 or 相依 cell exits 2 with exactly one lane-attributed row error naming the cell` (one subtest per bad cell: `0`, `1.5`, `二`, empty, `01`, prose, `—`, unknown lane, self, later wave, empty cell, empty entry, `無` + name; plus render refusal) |
| A1-3 | `test/e443a-wave-columns.test.mjs` | `A1-3: manifests without 波次 keep their pre-ticket validate results; 相依 stays free text` (base sweep vs `qa_reports/validate-baseline_e443a-manifest-waves.txt`; pinned 8-col and 9-col-`approval` output; `wave`/`depLanes` undefined) |
| A1-4 | `test/e443a-wave-compare.test.mjs` | `A1-4: a manifest that serialises or groups the approved tickets passes with the reason line last` |
| A1-5 | `test/e443a-wave-compare.test.mjs` | `A1-5: a manifest that drops the approved dependency C→A exits 1 with DEPENDENCY_DROPPED` |
| A1-6 | `test/e443a-wave-compare.test.mjs` | `A1-6: a manifest that adds, removes or double-lists a ticket exits 1 naming it` |
| A1-7 | `test/e443a-wave-compare.test.mjs` | `A1-7: an owned path outside the lane's allowed paths exits 1; bookkeeping never fails; a missing ticket file exits 2` |
| A1-8 | `test/e443a-integrator-sop.test.mjs` | `A1-8: integrator SOP carries SOP_STAGE1_WAVES on Stage 1 step 6 and SOP_STAGE2_WAVES in place of the old Stage 2 exception` |
| A1-9 | `test/e443a-batch-render.test.mjs` | `A1-9: render --batch exits 0 and the prompt ends with BATCH_CLOSING_LINE, never the wait-for-typing sentence` |
| A1-10 | `test/e443a-batch-render.test.mjs` | `A1-10: render --batch takes the summary and reading list from the lane's ticket files` |
| A1-11 | `test/e443a-batch-render.test.mjs` | `A1-11: render --batch puts BATCH_FIRST_STEP_LINE after the reading line, drops feature start / EnterWorktree, keeps the two-layer pointer` |
| A1-12 | — (command scenario) | no resident test: a test diffing against the lane's dispatch base would violate resident-test hygiene. The judge runs the spec's proof: `node --test test/e177a-manifest.test.mjs test/e289-render-addendum.test.mjs test/e343-render-pointer-guard.test.mjs test/render-structure.test.mjs test/e376-render-omits-tier.test.mjs test/e235b-relative-worktree.test.mjs test/e248-relative-mailbox-header.test.mjs test/e294-lane-enterworktree.test.mjs` passes, and `git diff --exit-code $(cat .current/e443a/base-sha) -- test/fixtures/e177a/render-e177a.golden.txt test/e289-render-addendum.test.mjs test/e343-render-pointer-guard.test.mjs test/render-structure.test.mjs test/e376-render-omits-tier.test.mjs test/e235b-relative-worktree.test.mjs test/e248-relative-mailbox-header.test.mjs test/e294-lane-enterworktree.test.mjs` exits 0. At this hand-off that diff (plus `test/e285-integrator-session-handoff.test.mjs` and `test/e430-mailbox-outside-lane.test.mjs`) exits 0. A1-11's "batch prompt = hand-started prompt apart from the two replaced lines" subtest also guards the derivation. |

Smoke tests (interface boundaries the spec fixes; not scenarios of their own):
`test/e443a-wave-compare.test.mjs` — `smoke: waves input errors exit 2 with their codes; ticketDir from primary's config is honoured`;
`test/e443a-batch-render.test.mjs` — `smoke: batch render lookup errors — empty 票 cell, duplicate and invalid ticket files, all collected`.

Fixtures (`test/fixtures/e443a/`): `manifest-waves.md` (shape 3, five lanes, every 相依 separator),
`manifest-8col.md` (pre-ticket shape, prose 相依), `manifest-compare.md` + `wave-table.md` + `tickets-waves/*.md`
(A1-4..A1-7), `manifest-batch.md` + `tickets-batch/**` (A1-9..A1-11; includes `ReadMe.md` and `old/archived.md`
holding duplicate ids, which the lookup must skip). Ticket files are copied into a temporary primary under
`os.tmpdir()` and passed with `--primary`; no tracked file is rewritten and no absolute path is written anywhere.

### Re-pins (owned tests whose pinned behaviour this ticket changes)

| test | change | turns green with |
|---|---|---|
| `test/e423-spec-workshop.test.mjs` AC12 | pins `SOP_STAGE2_WAVES` content (waves command, pass / fail rule, `整合者` reason row); old "conversion changed nothing" asserted gone; earlier Stage 2 sentences and the no-`E443`/`relax` rule kept | T-E443A-05 |
| `test/e428-tracker-mirror.test.mjs` base hash | integrator base sha256 `bebdd0e8…` → `81ea9cf3dbc3c706285b8e54105d0745aa81eae56f3a69ba2407eb0c205ff840` (base with the two spec strings applied verbatim); turns AC6 and AC12 red until applied | T-E443A-05 |
| `test/e292-integrator-sop.test.mjs` AC-E292-9 stage1-ext | step 6 = sister-repo copy, one space, then the wave-columns block to the end of the line | T-E443A-05 |
| `test/e296-manifest-tier.test.mjs` AC12 | usage continuation lines 5 → 6 | T-E443A-04 |
| `test/e322-owners.test.mjs` AC-E322-9 | usage continuation lines 5 → 6 — **not in the spec's Test impact list**; found by grep (`       node scripts/fanout.mjs` count); in the lane's 擁有 column | T-E443A-04 |

Dry run: with the two SOP strings applied verbatim to a scratch copy swapped in for `content/skill-integrator.md`
(then restored byte-identical), `e443a-integrator-sop`, `e423`, `e428`, `e292`, `e430` and `e410` were 54/54 green
— the SOP re-pins and A1-8 are consistent with the spec's Copy, and the line-number pins hold.

## Open Interface Details

- **`depLanes` for `無`**: `[]` (an empty list, not `undefined`) — `undefined` is reserved by I1 for rows of a
  table without `波次`; list order = cell order.
- **Lane with a row error is still a known lane**: with lb's `波次` = `0`, lanes naming lb in `相依` get no
  `DEPS_LANE_UNKNOWN` (I1 says "a lane id of a Lanes table that has the 波次 column" and skips `DEPS_LATER_WAVE` when
  a wave cell is in error), so exactly one error line is expected (A1-2).
- **`01` as 波次**: `WAVE_NOT_INTEGER` (I1 regex `^[1-9][0-9]*$`).
- **waves exit-0 stdout**: tests pin the ok line (exactly once) and the reason line as the last line, not the full
  stdout, so the order "ok line, then reason line" is checked only through "reason line last".
- **waves exit-1 summary `<k>`**: every negative case is built to break exactly one condition with one FAIL line,
  so `k` = 1 under either reading (conditions broken vs FAIL lines); the tests do not decide between the two.
- **waves wave-table `<file>` in input errors**: only the code is asserted (`WAVE_TABLE_*`), not how `<file>` is
  displayed — the spec does not say whether it is the operand as given or relative to primary.
- **`TICKET_FILE_DUPLICATE` file order**: either order accepted.
- **`--batch` position**: tested at the end and between flags after `<lane>`; not before `<lane>`.
- **Worktree in `BATCH_FIRST_STEP_LINE`**: compared with the worktree the same prompt's fields line carries
  (render's existing resolution), so the test does not re-derive resolveWorktree.

## Red Reasons

- A1-1, A1-2 — a header with `波次` is not a dispatchable shape yet (rows provisional; `check` refuses); no
  `WAVE_*` / `DEPS_*` checks; `wave` / `depLanes` absent (T-E443A-02).
- A1-3 — **green now** (regression guard): base sweep equals the recorded baseline, 8/9-column output pinned at
  its pre-ticket value.
- A1-4..A1-7, waves smoke — `waves` subcommand does not exist: generic USAGE, exit 2 (T-E443A-04).
- A1-8 — SOP strings not in `content/skill-integrator.md` yet (T-E443A-05).
- A1-9..A1-11, batch smoke — `unknown flag --batch` USAGE, exit 2 (T-E443A-03).
- e423 AC12, e428 AC6 + AC12, e292 AC-E292-9 stage1-ext — re-pinned to the SOP text (T-E443A-05).
- e296 AC12, e322 AC-E322-9 — re-pinned to six usage continuation lines (T-E443A-04).

CI runnability: all new tests are headless `node --test`, temp dirs under `os.tmpdir()`, git only in a throwaway
repo (A1-1 check). No human interaction.

## Suite result (after the test commit, clean tree)

See the section appended after the full run.
