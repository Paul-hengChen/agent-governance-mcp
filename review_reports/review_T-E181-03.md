# Review — T-E181-03, T-E138-03, T-E135-03, T-E150-05

covers: T-E181-03, T-E138-03, T-E135-03, T-E150-05

## Round 1 — APPROVED — by code-reviewer

Range `3c460ec..HEAD` (2e4b787, de6e2bf, 691f5af, 025a40e). Judged against
`specs/e135-handoff-notes-ledger.md` @ 3c460ec and
`specs/e135-handoff-notes-ledger-architecture.md` @ ba4d5af. Reviewer model:
opus (sr-engineer was also opus, so blind spots may overlap; the probes below
were run against the built code, not just read).

## Summary
- E181: a second zod `superRefine`, added after the untouched E86 one, rejects
  notes that cannot round-trip (any of the four line-break characters, `[`
  after optional leading whitespace, empty, whitespace-only, `(none)` or `無`)
  and `completed_tasks` ids that contain a line break or are empty /
  whitespace-only. Each note or id gets at most one issue.
- E138 + E135: `selectPendingNotesView` keeps note[0] when it fits, then a
  contiguous run of the newest notes, with one `⟦agc read-view⟧` marker where
  notes were dropped, and `omitted_notes` added. No note is sliced. The write
  boundary refuses notes containing the shared `READ_VIEW_MARKER_PREFIX`
  anywhere, plus the two legacy shapes.
- E150: in file mode the orchestrator sends a `completedTasksCarry` directive.
  Inside the lock the writer takes the same-feature on-disk ledger, adds the
  incoming ids, and removes the ids named by a qa-engineer FAIL write's
  `review_task_ids`. SQLite does not receive the directive. No gate bodies
  changed. The drift hint and the `completed_tasks` description are updated.
- File bounds respected. `dist/` matches a fresh `tsc` build byte-for-byte.
  No `schema/`, `content/`, `gates/`, `test/`, `tools/sync.ts`,
  `tools/tasks-file.ts`, `tools/storage*.ts` or `tools/transitions.ts`
  changes since base `2ad039d`.
- Verdict: APPROVED. No `required` findings; 1 `recommended`, 2 `optional`.

## AC Completeness
AC1 — implemented — tools/registry.ts:487-504. The boundary now rejects every lossy shape in the Problem Statement (probed). The red-on-base / green-on-HEAD test is qa's (T-E181-04).
AC2 — implemented — tools/registry.ts:198 (`/[\r\n  ]/`), :250. All four characters probed: each gives the `note.multiline` message byte-exact, with the index.
AC3 — implemented — tools/registry.ts:251-253. Probed `  [P0] x` (bracket-led) and `""`, `"   "`, `"(none)"`, `" 無 "` (empty-sentinel): messages byte-exact.
AC4 — implemented — the reader (tools/handoff-parse.ts:444-446) drops or splits exactly the classes the boundary now rejects. Probed as accepted and still round-tripping: `"  padded  "`, `"- dash led"`, `"note with [bracket] mid"`, `"T-1 - [x] T-2"`. The property test is qa's.
AC5 — implemented — tools/registry.ts:260, :498-503. All four characters probed: `ledger.multiline` byte-exact, with the index.
AC5a — implemented — tools/registry.ts:261. `""` and `"  "` probed: `ledger.empty` byte-exact. The spec ruling is followed (the architecture predates F1).
AC6 — implemented — the E86 `superRefine` (tools/registry.ts:458-486) is unchanged. `git diff 2ad039d...HEAD -- schema/` is empty. The e92 E86 cases pass; the only e92 reds are manifest entries.
AC7 — implemented — tools/handoff-parse.ts:75-95. 13-note probe: head kept, marker at index 1, newest 7 kept, 5 omitted. When the first note exceeds the budget: marker at index 0, newest notes kept.
AC8 — implemented — same function. Probe of 100 + 12×400 chars: the last 7 notes come back and the marker counts 5.
AC9 — implemented — tools/handoff-parse.ts:91, :725-727. Key order is `total_chars, limit, omitted_notes`. Under the limit the result is `{notes:[...], truncated:null}`, so no key is added. `PENDING_NOTES_CHAR_LIMIT` is still 3000 (:54).
AC10 — implemented — tools/handoff-types.ts:17. `grep ⟦ tools/` finds one literal, in handoff-types.ts. The parse and registry files import the constant.
AC11 — implemented — tools/registry.ts:238-244, :250. Writing the marker back verbatim, `abc…[truncated]  ` and the E92 whole-note marker are each rejected with `note.read-view`, byte-exact, with the index.
AC12 — implemented — `note.includes(READ_VIEW_MARKER_PREFIX)` (:240). The prefix in the middle of a note is rejected (probed).
AC13 — implemented — tools/handoff-orchestrator.ts:1307-1309, tools/handoff-write.ts:406-422. Probed: sr-engineer writes that omit `completed_tasks` (no key, so zod is bypassed) or pass `[]` leave the ledger at `[T-A, T-B]`.
AC14 — implemented — handoff-write.ts:409 (`base = []` on a feature change). Probed: the ledger is `[]` after a feature change. The archive copy path is unchanged.
AC15 — implemented — omission and `[]` are treated the same. Union with on-disk order first, deduplicated on trimmed values (handoff-write.ts:410-418). The zod default is unchanged.
AC16 — implemented — handoff-orchestrator.ts:1295-1301 decides the policy; handoff-write.ts:419-421 does the removal inside the lock. Probed: a qa In_Progress write with `review_task_ids` leaves the ledger unchanged; a qa FAIL write with `review_task_ids:[T-B]` turns `[T-A,T-B,T-B-REV]` into `[T-A]`. Dropping `T-B-REV` is the accepted P3 `\b` behaviour. The rollback + `tw_sync` case is qa's.
AC17 — implemented — gate bodies are unchanged and still read the incoming `parsed.completed_tasks`. Probed: an sr-engineer write carrying `[T-C]` still gets `NON_QA_COMPLETED_TASKS_REJECTED`, and the ledger is unchanged.
AC18 — implemented — the directive is attached only when `storage instanceof FileHandoffStorage` (:1307). `tools/storage-sqlite.ts` diff is empty.
AC19 — implemented — tools/drift.ts:73-74, byte-exact to `drift.evidence-line`. `grep -c "discarded on conflict"` gives 0 in source and in dist.
AC20 — implemented — tools/registry.ts:657-658, byte-exact to the spec row (probed against the spec table). `grep -c "Tasks completed now"` gives 0.
AC21 — out of this sr round's scope (qa-owned, T-E150-06), so it is not graded here. The full suite at HEAD is 3567/3576 (2 skipped); the 7 failures are exactly the manifest's expected reds, waiting for qa to re-pin them.

## Correctness
No `required` findings.

- Expected-red manifest (SOP 4a): `qa_reports/expected-red_e135-handoff-notes-ledger.txt` lists 7 entries. Running the e92, e92-repro and token-efficiency files gives 150/157 passing. The 7 failures are exactly the 7 manifest entries, matched by test name, and every one pins old behaviour this lane deliberately changed (newline accepted; slice / keep-head / trailing marker). Nothing else is red in those files.
- Full suite (`node scripts/test-lock.mjs -- npm test`, run during this review at HEAD 025a40e): `# tests 3576 / # pass 3567 / # fail 7 / # skipped 2`. The 7 failures are exactly the 7 manifest entries; nothing else is red. The `prebuild` step left `dist/` unchanged (`git status` clean apart from `.current/`). AC21 (all green after qa re-pins the 7, on a clean tree) is still qa's to sign off in T-E150-06.
- E150 race safety: the policy is decided outside the lock, but the ledger is re-read and resolved inside `withFileLock` after `verifyFreshness`. The lock → freshness → tmp+rename → snapshot-refresh sequence is unchanged, because the new code sits between the existing `existing` read and the publish.
- `existing` is always read (`archiveCheckNeedsExisting = true`, handoff-write.ts:347), so the carry clause adds no I/O and cannot see a stale `null`.
- (optional) The QA completion-evidence gate compares the incoming ids with `prevState`, which is read outside the lock, while the union runs against `existing`, read inside it. If a same-process qa FAIL write removed `B` between those two reads, a concurrent qa write listing `B` would skip the evidence check and re-add it. This check-then-act gap already existed for every `prevState` gate. Recorded only; not introduced by this lane.

## Quality
- (recommended) tools/handoff-orchestrator.ts:1284-1294 — `agc check — comments` reports `long-block 11 lines (limit 7)`. The 7-line E150 comment was added straight under the existing 4-line v3.15.0 comment, so they read as one block. Also, the v3.15.0 comment ("call site uses the new options-object overload…") is now separated from the `storage.writeState` call it describes by the `ledgerRemove` const. Put the E150 comment directly above `ledgerRemove`, move the v3.15.0 comment back above `storage.writeState`, and cut the E150 comment to 7 lines or fewer.
- Kept: tools/handoff-write.ts:103 `long-block 9 lines`. It is the interface contract of a new writer option, matches the architecture's Data Structures text, and sits among sibling option comments of the same length.
- Kept: tools/handoff-parse.ts:64 `long-block 8 lines`. It is the contract of an exported pure helper; one line over the limit.
- The `high-ratio` warnings for handoff-parse.ts, handoff-types.ts and handoff-write.ts are file-wide ratios that were already over the limit before this lane; its additions do not change them materially.
- `escapeRegExp` and `ledgerEntryMatchesId` are private copies in handoff-write.ts, which the architecture explicitly allows (`sync.ts` and `drift.ts` are out of scope).

## Architecture
The code follows the architecture @ ba4d5af point for point:
- the checks are ordered multiline → read-view → bracket-led → empty-sentinel, after the E86 loop (DR-8);
- the `?? []` normalisation happens once at entry, and no zod side field was added (AC15);
- the directive is attached on every file-mode write; the policy lives in the orchestrator and the resolution in the writer (DR-4);
- without the directive the writer still replaces the ledger, so the heal-write, the positional overload and direct callers are unchanged (DR-5);
- the marker is not counted against the budget (DR-9);
- legacy shapes are matched as a suffix and as a whole note (DR-10).

The `external_refs` comment fixes the architecture asked for were made in both registry.ts and handoff-write.ts. The one deviation from the architecture, the `ledger.empty` check, follows the spec's AC5a ruling, as the brief directed.

## Security
No findings. Ids are passed through `escapeRegExp` before `new RegExp`, so a `review_task_ids` entry cannot inject regex syntax, and the escaped pattern is a literal with no ReDoS risk. The boundary validation now covers more input, and every rejection happens before any gate and before any write. No secrets, paths or shell use are introduced.

## Performance
- (optional) tools/handoff-write.ts:419-421 — `merged.filter(entry => remove.some(id => ledgerEntryMatchesId(entry, id)))` builds a new `RegExp` for every (entry, id) pair: up to ledger × 200 per qa FAIL write. In practice the ledger is small, so this is negligible. Compiling the `remove` patterns once before the filter would make it linear in pattern construction.
- `selectPendingNotesView` is O(n) with `unshift` on a tail that is bounded by the 3000-character budget. It costs no more than the loop it replaces.

## Verdict
APPROVED — all 22 ACs that this sr round owns (AC1–AC20 and AC5a) are implemented with byte-exact strings and behaviour confirmed by probes, and the expected reds match the manifest exactly. The only open findings are recommended or optional.
