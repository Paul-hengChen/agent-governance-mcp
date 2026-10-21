# QA review — T-E181-04, T-E138-04, T-E135-04, T-E150-06 (lane e135, feature e135-handoff-notes-ledger)

covers: T-E181-04, T-E138-04, T-E135-04, T-E150-06

Role: qa-engineer (sonnet). Under test: sr commits 2e4b787 (T-E181-03), de6e2bf (T-E138-03), 691f5af (T-E135-03),
025a40e (T-E150-05); code-reviewer APPROVED round 1 (`review_reports/review_T-E181-03.md`, 0 required findings).
Spec `specs/e135-handoff-notes-ledger.md` @ 3c460ec, architecture `specs/e135-handoff-notes-ledger-architecture.md` @ ba4d5af.
Raw run logs (path-scrubbed): `qa_reports/e135-evidence/`.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e135-handoff-notes-ledger.txt` (7 entries). Full suite run at lane HEAD d263853
BEFORE any re-baseline edit (test files then unmodified), in an unpacked export of d263853 (a worktree-free copy,
so the working tree held no half-edited tests). Result 3559 pass / 15 fail / 2 skipped of 3576. Diff against the manifest:

- 7/7 manifest entries confirmed red (list below), 0 manifest entries missing.
- 8 further reds, all environmental artifacts of the export copy (it has no `.git` directory, and no
  concurrent-lane docs state), none touching this lane's code; each dispositioned below. All 8 are green in the real
  worktree (code-reviewer's run at 025a40e had exactly the 7 manifest reds, and the final run below is fully green).

Manifest entries (all red pre-edit, all dispositioned "re-pinned to the new behaviour"):

| # | entry | disposition |
|---|---|---|
| 1 | e92-e86 `AC2 (documented accepted miss…): pending_notes[0] accepts NEW-4: … newline` | RE-PINNED + RENAMED. The shape is now rejected for pending_notes[0] with `note.multiline` (E181 AC2). The "accepts" test is skipped for that one field/shape only (still accepted in the other four free-text fields, which store free text) and replaced by `AC2 (re-pinned by E181): pending_notes[0] REJECTS NEW-4 … newline, with note.multiline`. Renamed because a test called "accepts" that asserts rejection would mislead. |
| 2 | e92-e86 `AC3: 4x1000 … marker is the last entry` | RE-PINNED (renamed). New view `[n0, marker(1), n2, n3]`, `omitted_notes=1`. |
| 3 | e92-e86 `AC3: 5x900 … omitted=1` | RE-PINNED (renamed). Notes are never partially kept now; view `[n0, marker(2), n3, n4]`, omitted=2 (the old omitted=1 counted a sliced note as kept). |
| 4 | e92-e86 `AC3: 2500 + 1000 + 1000 …` | RE-PINNED (renamed). View `[n0, marker(2)]`. |
| 5 | e92-e86 `AC3: 3000 + 50x10 … omitted=50` | RE-PINNED (renamed). View `[n0, marker(50)]`, marker byte-exact in the new text. |
| 6 | e92-e86-repro `E92 repro: a wholly-dropped … marker as the array's last element` | RE-PINNED (renamed). Exactly one marker at index 1, newest note last, `omitted_notes=1`. |
| 7 | token-efficiency `pending_notes: notes exceeding 3000 chars are truncated` | RE-PINNED (renamed). `[longNote, marker(1)]`, no slice, `omitted_notes=1`. |

Because the new names differ from the manifest names, the manifest's literal names no longer exist in the suite; the
disposition is "re-pinned, replaced by the renamed test of the same intent, green". Two stale-but-green tests were also
brought in line, both inside the owned files: `AC3: 1x4000-char note` (old intent "no whole-drop marker for a single
partial note" is false now; re-pinned: elided whole, `[marker(1)]`) and one new AC9 "not firing = unchanged view" case
in token-efficiency. `qa_reports/expected-red…txt` itself is left as sr wrote it.

Non-manifest reds seen in the export copy only (environmental, not regressions):

- E104(ii) zero tracked binaries under research/ — needs `git ls-files`; export has no `.git`.
- E88 AC7 real-corpus `check-md-tables` and CQ-9 real-corpus backlog check, E-bookkeeping AC12, REAL-CORPUS AC13/AC16 —
  read live `docs/backlog.md` / git history state of the real checkout.
- hygiene AC16 and comments AC14 "isolated copy of committed HEAD" — need a real git repo.
- Partition (E66) top-level directories — the export lacks untracked/ignored top-level dirs the test enumerates.
All eight pass in the worktree (see final full-suite line below).

## Phase 1 — review notes

- Code under test read: registry round-trip helpers + read-view refusal, `selectPendingNotesView` / `formatElidedMarker`,
  `READ_VIEW_MARKER_PREFIX` (sole copy of the literal in `tools/`), writer `completedTasksCarry` clause, orchestrator directive.
  No correctness defect found; behaviour matches the architecture on every pinned case.
- Observation (not a FAIL, out of QA scope, already recorded as architecture OQ1): an id rolled back without the paired qa FAIL
  write stays in the carried ledger. Test `AC16 … FAIL + rollback + tw_sync` pins the sanctioned path in both orders.
- Observation: a single legacy on-disk note larger than the 3000-char budget is elided whole behind one marker (view is
  only the marker). Per architecture ("no note is ever sliced"); pinned in e138 test and the re-pinned e92 1x4000 case.

3a Copy Audit: every spec Copy/Strings entry is asserted verbatim by a test: marker.prefix (e135 AC10), marker.elided
(e138, e92, token-efficiency), note.multiline / note.bracket-led / note.empty-sentinel / ledger.empty / ledger.multiline
(e181), note.read-view (e135), drift.evidence-line and tool.completed_tasks.description (e150 AC19/AC20). No user-facing
string outside the spec's table was found (the pre-existing 1000-char "Too big" cap is unchanged and pinned unchanged).
3b Visual Audit: N/A (spec Visual Tokens: none). Phase 1.5: skipped (no Visual Baselines declared).

## Spec-to-Test Map

| AC | tests |
|---|---|
| AC1 | `test/e181-pending-notes-roundtrip.test.mjs` AC1 x3 (six lossy shapes rejected + nothing written; forged ledger id; prior notes untouched). Red at base: the six shapes are accepted and read back as `["line one","first","forged note","padded","sec"]`. |
| AC2 | e181 AC2 x6 (LF, CR, CRLF, U+2028, U+2029, trailing break) + e92 re-pinned NEW-4 newline case |
| AC3 | e181 AC3 x9 (bracket-led x3, empty/whitespace/`(none)`/padded/`無`/padded) + near-miss accept + DR-8 precedence |
| AC4 | e181 AC4 property (fixed + seeded corpus, count and trim equality), smoke cases |
| AC5 / AC5a | e181 AC5 x5 (all four chars + CRLF) + zod-layer pin, AC5a x3 (empty, spaces, tab) |
| AC6 | e181 AC6 (E86 message byte-identical, still emitted) + e92 suite unmodified-for-E86 (142/142) + `git diff 2ad039d...HEAD -- schema/` empty |
| AC7 | `test/e138-read-view-keeps-tail.test.mjs` AC7 x8 + e92 re-pinned AC3 x5 + repro |
| AC8 | e138 "13-note handover" (5113 chars) |
| AC9 | e138 AC9 x4, token-efficiency re-pinned truncation + new unchanged-view case, pure-helper cases |
| AC10 | `test/e135-read-view-marker.test.mjs` constant identity, emitter uses it, literal occurs once in `tools/*.ts` |
| AC11 | e135 write-back of a real `tw_get_state` view, marker alone, `…[truncated]` suffix (+trailing whitespace), E92 whole-note marker (n=1,3,50, padded) |
| AC12 | e135 prefix mid-note / end / start / bare; near-misses accepted; precedence cases; DR-10 prose-quoting accepted |
| AC13 | `test/e150-completed-tasks-carry-forward.test.mjs` omission across 4 hops + tool boundary + 3 successive hops |
| AC14 | e150 feature change (empty ledger, archive keeps old) + fresh ledger case |
| AC15 | e150 `[]` x4 agents, undefined (zod bypass), qa merge, cumulative list, current-ids-only PASS, writer-level trimmed dedupe |
| AC16 | e150 FAIL shrink, `[]` spelling, removal-wins (DR-3), word-boundary, APPROVED row no shrink, no-target FAIL refused, non-qa never shrinks, FAIL+rollback+`tw_sync` in both orders |
| AC17 | e150 gate pins x3 + proof command `test/reviewer-completed-tasks-gate`, `e32-e33-gate-hardening`, `e18-write-provenance` (45/45 green) |
| AC18 | e150 SQLite replace-semantics case + `git diff 2ad039d...HEAD --stat -- tools/storage-sqlite.ts` empty |
| AC19 / AC20 | e150 string tests + grep proofs (0 / 0) |
| AC21 | final full-suite line in the PASS write and the final report |

Coverage (node `--experimental-test-coverage`, the four new files): all new/modified code is line-covered — handoff-types
100%, handoff-write carry clause (dist lines 263-280) covered, orchestrator directive (dist 1172-1184) covered,
`selectPendingNotesView`/`formatElidedMarker` covered, registry round-trip helpers covered (whole-file registry.js 99.6%).
Whole-file figures for handoff-parse/orchestrator are lower only because those files hold unrelated code.

Security smoke: boundary inputs (empty, whitespace, 1000/1001-char, special characters, all four line-break characters,
Unicode sentinel near-misses, oversized note elided whole) are covered in e181/e135/e138.

## Reproduction discipline (spec "Repro discipline")

Base copy: a tar export of 2ad039d unpacked outside the repo, `node_modules` symlinked, `dist` rebuilt with `tsc`.

| file | base 2ad039d copy | HEAD |
|---|---|---|
| `test/e181-pending-notes-roundtrip.test.mjs` | 6 pass / 28 FAIL (red) | 34 / 34 green |
| `test/e138-read-view-keeps-tail.test.mjs` | 3 pass / 12 FAIL (red) | 15 / 15 green |
| `test/e135-read-view-marker.test.mjs` | 2 pass / 15 FAIL (red) | 17 / 17 green |
| `test/e150-completed-tasks-carry-forward.test.mjs` | 5 pass / 27 FAIL (red) | 32 / 32 green |

The tests that pass at base are intended unchanged-behaviour guards (E86 message, near-miss accepts, 1000-cap, AC17 gates,
AC18 SQLite, "no truncation = same view"). Logs: `qa_reports/e135-evidence/<file>.base-red.txt` and `<file>.head-green.txt`.

## AC Execution Log

| AC | command | output | verdict |
|---|---|---|---|
| AC1 | `node --test test/e181-pending-notes-roundtrip.test.mjs` base copy / HEAD | base 6 pass / 28 fail; HEAD 34 pass / 0 fail | pass (red then green) |
| AC2-AC5a | same file, HEAD | 34/34 | pass |
| AC6 | `git diff 2ad039d...HEAD --stat -- schema/ tools/storage-sqlite.ts tools/tasks-file.ts tools/sync.ts gates/ content/` | empty (exit 0) | pass |
| AC6 | `node --test test/e92-e86-handoff-write-boundary.test.mjs` | 142 pass / 0 fail (E86 cases unmodified) | pass |
| AC7, AC8 | `node --test test/e138-read-view-keeps-tail.test.mjs` base / HEAD | base 3 pass / 12 fail; HEAD 15/15 | pass |
| AC9 | `node --test test/token-efficiency.test.mjs test/e92-e86-handoff-write-boundary.test.mjs test/e92-e86-handoff-write-boundary-repro.test.mjs` | 158 pass / 0 fail | pass |
| AC10-AC12 | `node --test test/e135-read-view-marker.test.mjs` base / HEAD | base 2 pass / 15 fail; HEAD 17/17 | pass |
| AC13-AC16 | `node --test test/e150-completed-tasks-carry-forward.test.mjs` base / HEAD | base 5 pass / 27 fail; HEAD 32/32 | pass |
| AC17 | `node --test test/reviewer-completed-tasks-gate.test.mjs test/e32-e33-gate-hardening.test.mjs test/e18-write-provenance.test.mjs` | 45 pass / 0 fail | pass |
| AC18 | `git diff 2ad039d...HEAD --stat -- tools/storage-sqlite.ts` | empty | pass |
| AC19 | `grep -c "discarded on conflict" tools/drift.ts dist/tools/drift.js` | `tools/drift.ts:0`, `dist/tools/drift.js:0` | pass |
| AC20 | `grep -c "Tasks completed now" tools/registry.ts` | `0` | pass |
| AC21 | `node scripts/test-lock.mjs -- npm test` on the final HEAD, clean tree; `git diff 2ad039d...HEAD --stat -- test/` | recorded in the PASS write / final report (pass/total + sha) | see final report |

## Verdict

PASS for T-E181-04, T-E138-04, T-E135-04 and T-E150-06 subject to the AC21 full-suite line (green) in the final report.
