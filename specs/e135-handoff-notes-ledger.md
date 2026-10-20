# e135-handoff-notes-ledger

Fan-out lane `e135` (post-v4 wave 10, `specs/fanout-post-v4-w10.md`). Four tickets, one feature:
E181, E135, E138 (D1 — merged into this lane), E150. All four are the same class of defect: the
handoff's read view, its on-disk serialisation and what an author actually wrote cannot be told
apart, and every hop compounds the error.

Revision: integrator pre-review round 1 (mailbox `to-lane#1`) applied — R1 chain shape, R2
rollback path, Q2/O1 reading recorded, Q3/O2 folded into E181.

## Problem Statement

`tw_update_state` / `tw_get_state` lose or forge handoff content in four places.
**E181** — `tools/handoff-write.ts` serialises each `pending_notes` entry as one `- <note>` line
and `tools/handoff-parse.ts` reads `/^- (?!\[)(.+)/gm` back; any note that is not a single
non-`[`-led, non-sentinel line does not round-trip. Reproduced by the PM before this cut against
the lane base (scratch script, not committed): writing the six notes
`["line one\nline two", "first\n- forged note", "[P0] bracket-led note", "(none)", "  padded  ", "sec\n## Completed\n- [x] T-FORGED-99"]`
read back as `["line one", "first", "forged note", "padded", "sec"]` — continuation lines lost,
one forged note (`forged note`), a `[`-led note and a `(none)` note silently dropped.
`completed_tasks` ids take the same path (`- [x] <id>` written, `- \[x\] (.+)` read), so an id
carrying a line break splits on read-back and a `- [x] <other id>` continuation would read as an
extra completed id; the boundary accepts such an id today.
**E135** — `readHandoffState` injects two synthetic shapes into the returned `pending_notes`
(the per-note `…[truncated]` suffix and E92's `…[N further note(s) omitted — see pending_notes_truncated]`
marker) with no structural mark, and `tw_update_state` accepts them verbatim when a role carries
notes forward, so read-view artifacts accrete as authored state.
**E138** — the same read-view loop keeps notes from the head and drops the tail, so what is lost
is systematically the newest material (the handover itself, including instructions such as
"do not mark these tasks complete").
**E150** — `completed_tasks` is `z.array(...).optional().default([])` at the boundary and has no
carry-forward clause in the writer, so a same-feature write that omits it (any coordinator
amendment, any non-qa write) empties the completion ledger; `tw_detect_drift` then reports
genuinely evidence-backed PASSes as drift. (The ticket's second door — a parallel-lane merge
conflict on one shared `handoff.md` — is already closed by E123's per-lane `.current/<lane>/`
directories; `tools/drift.ts`'s hint still describes it as current.) Carry-forward has a cost the
fix must pay: today a qa FAIL write usually omits `completed_tasks` (it carries `review_task_ids`),
which clears the ledger and so incidentally removes a rolled-back id; `tw_rollback_task` edits
only `tasks.md` and `tw_sync` mirrors the ledger back onto `tasks.md`, so once the ledger carries
forward a rolled-back id would stay in it and the next `tw_sync` would re-mark it `[x]`.

## User Stories

- As any role writing handoff notes, I want a note the server cannot store losslessly to be
  rejected loudly, so that what the next role reads back is exactly what I wrote — never a
  truncated, merged or forged note.
- As any role carrying notes forward from `tw_get_state`, I want read-view display text to be
  structurally recognisable and refused on write-back, so that I cannot persist a display
  artifact as real state even if I forget to clean it.
- As the next role reading a long note list, I want the read view to keep the newest notes (the
  handover) and the first note (server advisories, the lease-override audit line), eliding the
  middle with one marker, so that instructions at the end of a handoff are never the part I lose.
- As a coordinator amending a feature mid-chain, I want a write that does not mention
  `completed_tasks` to leave the completion ledger intact, so that I do not have to send a
  two-write detour through PM and QA to restore evidence-backed completions.
- As a qa-engineer failing a task, I want my FAIL write to take that task out of the completion
  ledger, so that a later `tw_sync` cannot re-mark a rolled-back task as done.

## Acceptance Criteria

### E181 — every accepted note and ledger id round-trips

- **AC1** — Given the lane base, when the reproduction test sends a two-line note (and the other
  lossy shapes in the Problem Statement) through the `tw_update_state` tool and reads the handoff
  back, then the call is accepted and the read-back differs from what was sent (forged / lost
  notes). Given HEAD, the same calls are rejected and nothing is written.
  proof: `node --test test/e181-pending-notes-roundtrip.test.mjs` — qa runs it red against a copy
  of base `2ad039d` and green against HEAD, and records both runs in its evidence.
- **AC2** — Given the fix, when `tw_update_state` is called with a `pending_notes` entry that
  contains `\n` or `\r`, then the call is rejected at the tool boundary (zod, the same layer as
  E86's trailing-tag check) with the `note.multiline` message naming the index, and nothing is
  written.
  proof: `node --test test/e181-pending-notes-roundtrip.test.mjs` (boundary cases) green.
- **AC3** — Given the fix, when a `pending_notes` entry starts with `[` after leading whitespace,
  or is empty / whitespace-only / exactly `(none)` or `無` after trimming, then the call is
  rejected with `note.bracket-led` or `note.empty-sentinel` respectively.
  proof: same test file, boundary cases green.
- **AC4** — Given the fix, when any `pending_notes` array that the boundary accepts is written and
  read back, then every note reads back equal to `note.trim()` (surrounding whitespace is the only
  normalisation) and the count is unchanged.
  proof: same test file, round-trip property case green.
- **AC5** — Given the fix, when `tw_update_state` is called with a `completed_tasks` id that
  contains `\n` or `\r` (e.g. `"T-1\n- [x] T-FORGED"`), then the call is rejected at the tool
  boundary with the `ledger.multiline` message naming the index, before any gate runs, and
  nothing is written. (Folded in by the integrator, round 1 Q3.)
  proof: same test file, `completed_tasks` line-break case green (red at base: accepted).
- **AC6** — Given the fix, no `schema_version` changes and no existing rejection condition or
  error message changes (E86's `trailingTagFragmentMessage` stays byte-identical).
  proof: `git diff 2ad039d...HEAD -- schema/` is empty and `test/e92-e86-handoff-write-boundary.test.mjs`'s
  E86 cases pass unmodified.

### E138 — the read view keeps both ends, never slices a note

- **AC7** — Given notes whose total length exceeds `PENDING_NOTES_CHAR_LIMIT` (3000, unchanged),
  when `tw_get_state` builds its view, then: note[0] is kept if it fits the budget; then whole
  notes are kept from the END backwards while they fit; the notes between are elided; and
  exactly one `marker.elided` entry stands at the elision point (index 1 when note[0] is kept,
  index 0 otherwise). No note is ever sliced — the `…[truncated]` suffix shape is retired.
  (note[0] is where the orchestrator unshifts the server's ⛔ round/hop warnings, so they survive.)
  proof: `node --test test/e138-read-view-keeps-tail.test.mjs` green; qa runs it red against base.
- **AC8** — Given the E138 field measurement (13 notes / 5113 chars, of which the last five carry
  the handover), when the same shape is read, then the last notes come back and the marker counts
  the middle ones.
  proof: same test file, "13-note handover" case.
- **AC9** — Given truncation fires, then `pending_notes_truncated` keeps its existing keys
  `total_chars` and `limit` with the same meanings and gains `omitted_notes: <n>`; when it does
  not fire, the view is byte-identical to today's (no key, no marker).
  proof: `node --test test/token-efficiency.test.mjs` (re-pinned truncation cases) green.

### E135 — read-view markers are structural and refused on write-back

- **AC10** — Given the fix, the only synthetic entry the read view can emit starts with the fixed
  prefix `marker.prefix`, exported as one constant from `tools/handoff-types.ts` and used by both
  the reader that emits it and the boundary that refuses it (no second copy of the literal).
  proof: `node --test test/e135-read-view-marker.test.mjs` (constant-identity case) green.
- **AC11** — Given a `tw_get_state` view that contains the elision marker, when a caller writes
  that `pending_notes` array back verbatim through `tw_update_state`, then the write is rejected
  with `note.read-view` naming the index, and the on-disk notes are unchanged. The same rejection
  fires for the two legacy shapes still possibly sitting in a caller's context (a note ending in
  `…[truncated]`; a note matching E92's `…[<n> further note(s) omitted — see pending_notes_truncated]`).
  proof: `node --test test/e135-read-view-marker.test.mjs` (write-back cases) green; qa runs the
  legacy-shape cases red against base (the base accepts them).
- **AC12** — Given the rejection, the caller does not need any cleaning convention to stay
  correct: an author note that merely mentions the prefix text in the middle of prose is still
  rejected (containment, not prefix match), so no carried-forward array can persist display text.
  proof: same test file, "prefix mid-note" case.

### E150 — the completion ledger carries forward within a feature

- **AC13** — Given file mode and an on-disk ledger `[A]` for feature F, when a write for F omits
  `completed_tasks` (any agent, any status other than the qa FAIL case of AC16), then the ledger
  is still `[A]` after the write.
  proof: `node --test test/e150-completed-tasks-carry-forward.test.mjs` green; qa runs it red against base.
- **AC14** — Given file mode and an on-disk ledger for feature F, when a write names a different
  `active_feature`, then the new handoff's ledger is empty unless that write itself grows it
  (today's behaviour; the archive copy still captures the old one).
  proof: same test file, feature-change case.
- **AC15** — `[]` semantics and qa merge vs replace: as decided in
  `specs/e135-handoff-notes-ledger-architecture.md` (T-E150-04). PM proposal for the architect to
  confirm or overturn with reasons: `completed_tasks: []` is treated exactly like omission for
  every agent (file mode) — it never shrinks the ledger by itself; a `qa-engineer` write with a
  non-empty list merges into the on-disk ledger of the same feature (union, on-disk order first)
  rather than replacing it. Under that proposal the two `content/**` sentences that say "omit
  `completed_tasks` (or pass `[]`)" (Constitution §3.1 Non-QA Completed-Tasks Gate in
  `content/const-08-chain-31-mid.md`; `content/skill-code-reviewer.md` CHANGES_REQUESTED row)
  stay true as written and `content/**`, the compose goldens and `test/context-budget.test.mjs`
  are NOT touched.
  proof: `node --test test/e150-completed-tasks-carry-forward.test.mjs` (`[]` and qa-merge cases,
  as pinned by qa from the architecture's decision) green.
- **AC16** — Rollback path (integrator round 1 R2). Given file mode and an on-disk ledger
  `[A, B]` for feature F, when qa writes `agent_id: qa-engineer`, `status: FAIL`,
  `review_task_ids: [B]` (no `completed_tasks`) and `tw_rollback_task B` runs (in either order),
  then the ledger contains `A` and does not contain `B`, and a following `tw_sync` does not
  re-mark `B` `[x]` in `tasks.md`. Only a `qa-engineer` write may shrink the ledger; a
  `qa-engineer` write with `status: In_Progress` carrying `review_task_ids` (the code-reviewer
  APPROVED row is stamped that way) never shrinks it. Integrator's suggested mechanism, for the
  architect to decide: the orchestrator removes the FAIL write's `review_task_ids` from the
  carried ledger; `tools/tasks-file.ts` is not changed.
  proof: same test file, "qa FAIL + rollback + tw_sync" case green.
- **AC17** — The Non-QA Completed-Tasks Gate is unchanged: any write whose `agent_id` is present
  and is not `qa-engineer`, carrying a non-empty `completed_tasks`, is rejected with
  `NON_QA_COMPLETED_TASKS_REJECTED` / `REVIEWER_COMPLETED_TASKS_REJECTED` byte-identical; the QA
  Completion-Evidence gate still diffs the incoming list against the on-disk set.
  proof: `node --test test/reviewer-completed-tasks-gate.test.mjs test/e32-e33-gate-hardening.test.mjs test/e18-write-provenance.test.mjs` green.
- **AC18** — SQLite/HTTP mode is unchanged for the ledger: an omitted `completed_tasks` is stored
  as `[]` exactly as today (carry-forward and the AC16 shrink are file-mode only, like
  `dispatch_pins`); `tools/storage-sqlite.ts` is not edited. Input rules (AC2–AC5, AC11–AC12) are
  shared by both modes — see Dependencies, "Mode reading".
  proof: `git diff 2ad039d...HEAD --stat -- tools/storage-sqlite.ts` is empty and the SQLite
  storage test files pass unmodified.
- **AC19** — Given the fix, `tw_detect_drift`'s evidence-backed detail line no longer states that
  a merged parallel lane's ledger can be discarded on conflict; it says the ledger is
  feature-scoped, carries forward across same-feature writes and empties on an `active_feature`
  change (`drift.evidence-line` below).
  proof: `grep -c "discarded on conflict" tools/drift.ts dist/tools/drift.js` prints `0` for both.
- **AC20** — The `tw_update_state` input-schema description of `completed_tasks` states the new
  lifetime (`tool.completed_tasks.description` below), replacing "Tasks completed now".
  proof: `grep -c "Tasks completed now" tools/registry.ts` prints `0`.

### Whole lane

- **AC21** — The full suite is green at the lane's final HEAD (committed, clean tree), run as
  `node scripts/test-lock.mjs -- npm test`; every test in
  `qa_reports/expected-red_e135-handoff-notes-ledger.txt` is green; the e209-owned tests
  (`test/e177b-test-lock.test.mjs`, `test/usage-accounting.test.mjs`,
  `test/success-metrics.test.mjs`) are untouched and green; only the test files named in Cut
  Decisions were modified.
  proof: qa's final evidence quotes the suite's pass/total line and
  `git diff 2ad039d...HEAD --stat -- test/`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| marker.prefix | `⟦agc read-view⟧` | authored-here — E135 fix shape 1: a sentinel no author writes by accident (U+27E6/U+27E7), short, and not `[`-led so it cannot collide with the checkbox reader |
| marker.elided | `⟦agc read-view⟧ {n} note(s) omitted here — full text is on disk; see pending_notes_truncated. Do not write this line back.` | authored-here — replaces E92's `…[{n} further note(s) omitted — see pending_notes_truncated]` (specs/e92-e86-handoff-write-boundary.md Copy/Strings); `{n}` is the elided count; the last sentence tells a reader what the boundary will enforce |
| note.multiline | `pending_notes[{i}] contains a line break. handoff.md stores each note as one list line, so a multi-line note would be split or forged on read-back. Send each line as its own note.` | authored-here — E181 fix (reject, fail loud: the scope_decision_why precedent cited by E138) |
| note.bracket-led | `pending_notes[{i}] starts with "[". handoff.md skips a "[" -led list line on read-back (it reads as a checkbox), so the note would be lost. Reword it so it does not start with "[".` | authored-here — E181 round-trip class found by the PM repro |
| note.empty-sentinel | `pending_notes[{i}] is empty or an empty-section sentinel ("(none)", "無") and would be dropped on read-back. Remove it or reword it.` | authored-here — E181 round-trip class found by the PM repro |
| ledger.multiline | `completed_tasks[{i}] contains a line break. handoff.md stores each completed id as one "- [x]" line, so the id would be split, or forge another id, on read-back.` | authored-here — E181 extension folded in by the integrator (round 1 Q3) |
| note.read-view | `pending_notes[{i}] contains tw_get_state read-view display text (the "⟦agc read-view⟧" marker or a legacy "…[truncated]" / "further note(s) omitted" marker), not an author's note. Drop it before writing; the omitted notes are still on disk.` | authored-here — E135 fix shape 1 (write boundary rejects the sentinel, reusing E86's zod superRefine) |
| drift.evidence-line (changed sentence) | `completed_tasks is feature-scoped: it carries forward across same-feature writes and empties on an active_feature change (E150).` | authored-here — replaces `completed_tasks is feature-scoped and legitimately empties on an active_feature change, and a merged parallel lane's ledger can be discarded on conflict (root cause: E150 — not fixed by this detector).` in `tools/drift.ts` `buildEvidenceBackedLine`; the rest of that line is unchanged |
| tool.completed_tasks.description | `Task ids QA has completed for this feature (only agent_id "qa-engineer" may change it). File mode: kept across same-feature writes that omit it or pass []; a qa-engineer FAIL write removes its review_task_ids; cleared when active_feature changes. SQLite: stored as given.` | authored-here — E150; final wording follows the architecture's `[]` / merge / shrink decision (AC15–AC16) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E184 (the read view echoing the previous hop's tier) — same file, queue #20; record as a new
  finding if touched.
- E181's "move notes into YAML frontmatter" option and ANY `schema_version` bump (`schema/**` is
  forbidden for this wave); escape-plus-decode serialisation (would need a versioned format to
  keep legacy notes containing backslashes readable).
- `tools/storage-sqlite.ts`, `tools/tasks-file.ts`, `tools/storage.ts`, `tools/sync.ts`,
  `gates/**`, `tools/transitions.ts` — `tw_rollback_task` / `tw_void_task` / `tw_sync` are not
  changed; the AC16 shrink happens on the qa FAIL write in the orchestrator / file writer.
- Raising `PENDING_NOTES_CHAR_LIMIT` (E138's third fix shape): it trades context budget that
  `test/token-efficiency.test.mjs` pins; the keep-both-ends policy addresses the loss without it.
- Leading/trailing whitespace inside a note is trimmed on read today and stays so (meaning-
  preserving; rejecting it would refuse ordinary input).

## Dependencies / Prerequisites

- No design file (`design/e135-handoff-notes-ledger.md` absent) → mode = no-design; Visual
  Structural Assertions omitted.
- Resource Audit Gate: the only references are in-repo (`docs/backlog.md` rows E135/E138/E150/E181,
  `docs/v4.0.0-new-tickets.md` queue rows #1/#2/#3/#6, `specs/fanout-post-v4-w10.md`,
  `specs/e92-e86-handoff-write-boundary.md`); zero external refs → `external_refs` omitted.
- **Mode reading (integrator round 1 Q2, to be recorded in the manifest Decisions by the
  integrator)**: the manifest's hard constraint "SQLite/HTTP behaviour unchanged" means ledger
  carry-forward (and the AC16 shrink that comes with it). Input rules at the `tools/registry.ts`
  boundary — the E181 line-break / bracket / sentinel rejections and the E135 read-view
  rejection — apply in both storage modes, on the E86 precedent, even though a multi-line note
  happens to round-trip in SQLite today.
- **Architect hop (T-E150-04)** — required for E150: it changes the lifetime of a ledger read by
  three gates, the drift detector and `tw_sync`, across `tools/registry.ts`,
  `tools/handoff-orchestrator.ts` and `tools/handoff-write.ts`. The architecture decides AC15
  (`[]` semantics, merge vs replace, whether any `content/**` sentence must change), AC16 (how a
  qa FAIL write shrinks the carried ledger; who else, if anyone, may shrink it) and how the
  orchestrator learns omission. Known constraint from the PM's blast-radius spike: several tests
  call `handleUpdateState` directly with plain objects (bypassing zod), so omission must be
  detected from the parsed object itself (`completed_tasks === undefined`), with every gate
  reading a normalised `?? []` — not via a zod-only side field.
- **Blast radius (PM spike, scratch copy of the lane base, full suite, not committed)**: baseline
  3574/3576 pass (2 skipped). With boundary newline rejection + same-feature carry-forward of
  omitted/`[]` `completed_tasks` (both replace and union variants for qa non-empty writes), the
  only red test was `test/e92-e86-handoff-write-boundary.test.mjs` › "AC2 (documented accepted
  miss, NOT a defect): pending_notes[0] accepts NEW-4: unterminated attribute value containing a
  newline" (3573/3574 pass in both variants), which pins the very newline acceptance E181 removes.
  No existing ledger assertion (`test/e32-e33-gate-hardening.test.mjs`,
  `test/reviewer-completed-tasks-gate.test.mjs`, `test/e18-write-provenance.test.mjs` or the other
  ~53 files touching `completed_tasks`) went red. The spike did not include the E135/E138
  read-view change or the AC16 shrink; the only tests pinning the marker / truncation text are
  `test/e92-e86-handoff-write-boundary.test.mjs`, `test/e92-e86-handoff-write-boundary-repro.test.mjs`
  and `test/token-efficiency.test.mjs` (grep for `truncated]`, `further note`,
  `pending_notes_truncated`, `PENDING_NOTES_CHAR`). If the architecture's final semantics or
  sr's implementation turns another existing test red, the lane names it in a spec amendment
  before qa touches it.
- **Repro discipline (feature mode, qa-owned — integrator round 1 R1; precedent
  `specs/e239-init-subdir-exclude.md`, `specs/e243-init-path-escape-refusal.md`)**:
  - `dispatch_mode: "feature"` (not bugfix). Chain: pm → architect → sr-engineer →
    code-reviewer → qa-engineer.
  - sr-engineer writes no test. Each sr task appends to
    `qa_reports/expected-red_e135-handoff-notes-ledger.txt` (`<path> | <test name>`, SOP step 7a)
    every EXISTING test its change turns red: T-E181-03 the e92 "documented accepted miss" newline
    case; T-E138-03 the `test/token-efficiency.test.mjs` and e92 / e92-repro truncation and marker
    cases; T-E150-05 any it causes (none expected per the spike).
  - qa-engineer writes the new tests AFTER sr, re-pins the manifest-listed existing tests to the
    new behaviour, runs every new reproduction test red against a copy of base `2ad039d` and green
    against HEAD, and records both runs in its evidence.

## Cut Decisions

E135 fix shape: **shape 1 — structural sentinel refused at the write boundary** (not
strip-on-write). Reasons: (a) stripping cannot repair the data loss — a partially kept note
stripped of its suffix would persist a truncated prefix as if complete; shape 1 plus E138's
never-slice rule removes the partial-note shape entirely; (b) it reuses E86's zod superRefine
layer and keeps the write path free of content mutation; (c) it is loud, matching the
`scope_decision_why` precedent and E181's rejection; (d) callers need no convention — the
boundary refuses display text wherever it sits in a note.

E138 keep/drop direction: whole notes only; note[0] first, then the newest notes backwards; one
marker at the elision point; cap unchanged (AC7–AC9).

E150 `[]` semantics and shrink rule: PM proposal in AC15, rollback requirement in AC16, both
decided by the architect (T-E150-04). If the architecture requires a `content/**` sentence to
change, T-E150-05 also re-baselines `test/fixtures/compose-golden/**` and
`test/context-budget.test.mjs` is re-pinned by qa — those rows are not in the table below
because the proposal does not need them; a spec amendment adds them.

`dispatch_mode: "feature"`, chain pm → architect → sr-engineer → code-reviewer → qa-engineer
(integrator round 1 R1; see Dependencies, "Repro discipline").

Task ids: the round-0 rows T-E150-01..03, T-E181-01..02, T-E138-01..02, T-E135-01..02 were
voided in the lane ledger (never started; their order and dependencies encoded the declined qa
pre-pass) and re-cut under fresh ids below — a voided id is never re-cut (E120).

Owned test files this cut modifies, by name (integrator pre-review list):
`test/e181-pending-notes-roundtrip.test.mjs` (new), `test/e138-read-view-keeps-tail.test.mjs`
(new), `test/e135-read-view-marker.test.mjs` (new), `test/e150-completed-tasks-carry-forward.test.mjs`
(new), `test/e92-e86-handoff-write-boundary.test.mjs`, `test/e92-e86-handoff-write-boundary-repro.test.mjs`,
`test/token-efficiency.test.mjs` (pending_notes truncation/marker assertions only). No other
existing `test/**` file is modified (blast-radius spike above). Not modified:
`test/e32-e33-gate-hardening.test.mjs`, `test/reviewer-completed-tasks-gate.test.mjs` (AC17 proves
them unchanged), the e209-owned tests, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`.

Shared-file note: `tools/registry.ts` (+ its dist) is written by three sr tasks in sequence
(T-E181-03 → T-E135-03 → T-E150-05) and `test/e92-e86-handoff-write-boundary.test.mjs` by two qa
tasks (T-E181-04, T-E138-04); the `depends_on` chain serialises them. All in one lane, one branch.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E150-04 | architect: ledger lifetime blueprint — `[]` semantics, qa merge vs replace, qa FAIL shrink + rollback/`tw_sync` path, omission detection without zod side fields, SQLite isolation, content/** decision (AC13–AC20) | none | 1 | `specs/e135-handoff-notes-ledger-architecture.md` | — |
| T-E181-03 | sr-engineer: zod rejection of non-round-trippable notes (multiline, `[`-led, empty/sentinel) and of `completed_tasks` ids with a line break + schema description; list newly-red existing tests in the expected-red manifest; rebuild dist (AC2–AC6) | none | 2 | `tools/registry.ts`, `dist/tools/registry.*` | — |
| T-E138-03 | sr-engineer: read-view keep-both-ends, never slice, one elision marker, `omitted_notes`; export the marker prefix constant; list newly-red existing tests in the expected-red manifest; rebuild dist (AC7–AC10) | T-E181-03 | 4 | `tools/handoff-parse.ts`, `tools/handoff-types.ts`, `dist/tools/handoff-parse.*`, `dist/tools/handoff-types.*` | — |
| T-E135-03 | sr-engineer: boundary rejection of read-view display text (prefix containment + two legacy shapes) using the shared constant; rebuild dist (AC11–AC12) | T-E138-03 | 2 | `tools/registry.ts`, `dist/tools/registry.*` | — |
| T-E150-05 | sr-engineer: `completed_tasks` carry-forward and qa FAIL shrink per the architecture (boundary optional, orchestrator normalisation, file-writer clause), schema description, drift hint; rebuild dist (AC13–AC20) | T-E150-04, T-E135-03 | 8 | `tools/registry.ts`, `tools/handoff-orchestrator.ts`, `tools/handoff-write.ts`, `tools/drift.ts`, `dist/tools/registry.*`, `dist/tools/handoff-orchestrator.*`, `dist/tools/handoff-write.*`, `dist/tools/drift.*` | — |
| T-E181-04 | qa-engineer: E181 reproduction + boundary tests (notes and `completed_tasks` ids), red on base copy / green on HEAD; re-pin E92's "documented accepted miss" newline case (AC1–AC6) | T-E181-03 | 2 | `test/e181-pending-notes-roundtrip.test.mjs`, `test/e92-e86-handoff-write-boundary.test.mjs` | — |
| T-E138-04 | qa-engineer: keep-both-ends read-view tests, red on base copy / green on HEAD; re-pin truncation/marker cases (AC7–AC9) | T-E138-03 | 4 | `test/e138-read-view-keeps-tail.test.mjs`, `test/token-efficiency.test.mjs`, `test/e92-e86-handoff-write-boundary.test.mjs`, `test/e92-e86-handoff-write-boundary-repro.test.mjs` | — |
| T-E135-04 | qa-engineer: marker constant + write-back rejection tests incl. legacy shapes, red on base copy / green on HEAD (AC10–AC12) | T-E135-03 | 1 | `test/e135-read-view-marker.test.mjs` | — |
| T-E150-06 | qa-engineer: carry-forward / `[]` / feature-change / qa FAIL + rollback + `tw_sync` tests per the architecture, red on base copy / green on HEAD; full suite under test-lock (AC13–AC21) | T-E150-05, T-E181-04, T-E138-04, T-E135-04 | 1 | `test/e150-completed-tasks-carry-forward.test.mjs` | — |
