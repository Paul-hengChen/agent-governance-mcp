# e135-handoff-notes-ledger

Fan-out lane `e135` (post-v4 wave 10, `specs/fanout-post-v4-w10.md`). Four tickets, one feature:
E181, E135, E138 (D1 — merged into this lane), E150. All four are the same class of defect: the
handoff's read view, its on-disk serialisation and what an author actually wrote cannot be told
apart, and every hop compounds the error.

## Problem Statement

`tw_update_state` / `tw_get_state` lose or forge handoff content in four places.
**E181** — `tools/handoff-write.ts` serialises each `pending_notes` entry as one `- <note>` line
and `tools/handoff-parse.ts` reads `/^- (?!\[)(.+)/gm` back; any note that is not a single
non-`[`-led, non-sentinel line does not round-trip. Reproduced by the PM before this cut against
the lane base (scratch script, not committed): writing the six notes
`["line one\nline two", "first\n- forged note", "[P0] bracket-led note", "(none)", "  padded  ", "sec\n## Completed\n- [x] T-FORGED-99"]`
read back as `["line one", "first", "forged note", "padded", "sec"]` — continuation lines lost,
one forged note (`forged note`), a `[`-led note and a `(none)` note silently dropped.
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
directories; `tools/drift.ts`'s hint still describes it as current.)

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

## Acceptance Criteria

### E181 — every accepted note round-trips

- **AC1** — Given the lane base, when the repro test writes a two-line note (and the other
  lossy shapes listed in the Problem Statement) through `writeHandoffState` and reads it back with
  `parseHandoff`, then the read-back differs from what was written (expected-red, recorded in
  `qa_reports/expected-red_e135-handoff-notes-ledger.txt` before any fix lands).
  proof: `node --test test/e181-pending-notes-roundtrip.test.mjs` is red at the lane base and the
  failing test names match the manifest lines.
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
- **AC5** — Given the fix, no `schema_version` changes and no existing rejection condition or
  error message changes (E86's `trailingTagFragmentMessage` stays byte-identical).
  proof: `git diff <lane-base>...HEAD -- schema/` is empty and `test/e92-e86-handoff-write-boundary.test.mjs`'s
  E86 cases pass unmodified.

### E138 — the read view keeps both ends, never slices a note

- **AC6** — Given notes whose total length exceeds `PENDING_NOTES_CHAR_LIMIT` (3000, unchanged),
  when `tw_get_state` builds its view, then: note[0] is kept if it fits the budget; then whole
  notes are kept from the END backwards while they fit; the notes between are elided; and
  exactly one `marker.elided` entry stands at the elision point (index 1 when note[0] is kept,
  index 0 otherwise). No note is ever sliced — the `…[truncated]` suffix shape is retired.
  proof: `node --test test/e138-read-view-keeps-tail.test.mjs` green (and red at the lane base).
- **AC7** — Given the E138 field measurement (13 notes / 5113 chars, of which the last five carry
  the handover), when the same shape is read, then the last notes come back and the marker counts
  the middle ones.
  proof: same test file, "13-note handover" case.
- **AC8** — Given truncation fires, then `pending_notes_truncated` keeps its existing keys
  `total_chars` and `limit` with the same meanings and gains `omitted_notes: <n>`; when it does
  not fire, the view is byte-identical to today's (no key, no marker).
  proof: `node --test test/token-efficiency.test.mjs` (re-pinned truncation cases) green.

### E135 — read-view markers are structural and refused on write-back

- **AC9** — Given the fix, the only synthetic entry the read view can emit starts with the fixed
  prefix `marker.prefix`, exported as one constant from `tools/handoff-types.ts` and used by both
  the reader that emits it and the boundary that refuses it (no second copy of the literal).
  proof: `node --test test/e135-read-view-marker.test.mjs` (constant-identity case) green.
- **AC10** — Given a `tw_get_state` view that contains the elision marker, when a caller writes
  that `pending_notes` array back verbatim through `tw_update_state`, then the write is rejected
  with `note.read-view` naming the index, and the on-disk notes are unchanged. The same rejection
  fires for the two legacy shapes still possibly sitting in a caller's context (a note ending in
  `…[truncated]`; a note matching E92's `…[<n> further note(s) omitted — see pending_notes_truncated]`).
  proof: `node --test test/e135-read-view-marker.test.mjs` (write-back cases) green; red at the
  lane base (the base accepts them).
- **AC11** — Given the rejection, the caller does not need any cleaning convention to stay
  correct: an author note that merely mentions the prefix text in the middle of prose is still
  rejected (containment, not prefix match), so no carried-forward array can persist display text.
  proof: same test file, "prefix mid-note" case.

### E150 — the completion ledger carries forward within a feature

- **AC12** — Given file mode and an on-disk ledger `[A]` for feature F, when a write for F omits
  `completed_tasks` (any agent), then the ledger is still `[A]` after the write.
  proof: `node --test test/e150-completed-tasks-carry-forward.test.mjs` green (red at the lane base).
- **AC13** — Given file mode and an on-disk ledger for feature F, when a write names a different
  `active_feature`, then the new handoff's ledger is empty unless that write itself grows it
  (today's behaviour; the archive copy still captures the old one).
  proof: same test file, feature-change case.
- **AC14** — `[]` semantics and the shrink rule: as decided in
  `specs/e135-handoff-notes-ledger-architecture.md` (T-E150-01). PM proposal for the architect to
  confirm or overturn with reasons: `completed_tasks: []` is treated exactly like omission for
  every agent (file mode) — it never shrinks the ledger; a `qa-engineer` write with a non-empty
  list merges into the on-disk ledger of the same feature (union, on-disk order first) rather than
  replacing it; the ledger empties only on an `active_feature` change. Under that proposal the two
  `content/**` sentences that say "omit `completed_tasks` (or pass `[]`)" (Constitution §3.1
  Non-QA Completed-Tasks Gate in `content/const-08-chain-31-mid.md`; `content/skill-code-reviewer.md`
  CHANGES_REQUESTED row) stay true as written and `content/**`, the compose goldens and
  `test/context-budget.test.mjs` are NOT touched.
  proof: `node --test test/e150-completed-tasks-carry-forward.test.mjs` (`[]` and qa-merge cases, as
  pinned by T-E150-02 from the architecture's decision) green.
- **AC15** — The Non-QA Completed-Tasks Gate is unchanged: any write whose `agent_id` is present
  and is not `qa-engineer`, carrying a non-empty `completed_tasks`, is rejected with
  `NON_QA_COMPLETED_TASKS_REJECTED` / `REVIEWER_COMPLETED_TASKS_REJECTED` byte-identical; the QA
  Completion-Evidence gate still diffs the incoming list against the on-disk set.
  proof: `node --test test/reviewer-completed-tasks-gate.test.mjs test/e32-e33-gate-hardening.test.mjs test/e18-write-provenance.test.mjs` green.
- **AC16** — SQLite/HTTP mode is unchanged for the ledger: an omitted `completed_tasks` is stored
  as `[]` exactly as today (carry-forward is file-mode only, like `dispatch_pins`); the change
  lives in `tools/handoff-write.ts` (file writer) plus the boundary/orchestrator normalisation, and
  `tools/storage-sqlite.ts` is not edited.
  proof: `git diff <lane-base>...HEAD --stat -- tools/storage-sqlite.ts` is empty and the SQLite
  storage test files pass unmodified.
- **AC17** — Given the fix, `tw_detect_drift`'s evidence-backed detail line no longer states that
  a merged parallel lane's ledger can be discarded on conflict; it says the ledger is
  feature-scoped, carries forward across same-feature writes and empties on an `active_feature`
  change (`drift.evidence-line` below).
  proof: `grep -c "discarded on conflict" tools/drift.ts dist/tools/drift.js` prints `0` for both.
- **AC18** — The `tw_update_state` input-schema description of `completed_tasks` states the new
  lifetime (`tool.completed_tasks.description` below), replacing "Tasks completed now".
  proof: `grep -c "Tasks completed now" tools/registry.ts` prints `0`.

### Whole lane

- **AC19** — The full suite is green at the lane's final HEAD (committed, clean tree), run as
  `node scripts/test-lock.mjs -- npm test`; every test in the expected-red manifest is green; the
  e209-owned tests (`test/e177b-test-lock.test.mjs`, `test/usage-accounting.test.mjs`,
  `test/success-metrics.test.mjs`) are untouched and green; only the test files named in the Cut
  were modified.
  proof: qa's final evidence quotes the suite's pass/total line and
  `git diff <lane-base>...HEAD --stat -- test/`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| marker.prefix | `⟦agc read-view⟧` | authored-here — E135 fix shape 1: a sentinel no author writes by accident (U+27E6/U+27E7), short, and not `[`-led so it cannot collide with the checkbox reader |
| marker.elided | `⟦agc read-view⟧ {n} note(s) omitted here — full text is on disk; see pending_notes_truncated. Do not write this line back.` | authored-here — replaces E92's `…[{n} further note(s) omitted — see pending_notes_truncated]` (specs/e92-e86-handoff-write-boundary.md Copy/Strings); `{n}` is the elided count; the last sentence tells a reader what the boundary will enforce |
| note.multiline | `pending_notes[{i}] contains a line break. handoff.md stores each note as one list line, so a multi-line note would be split or forged on read-back. Send each line as its own note.` | authored-here — E181 fix (reject, fail loud: the scope_decision_why precedent cited by E138) |
| note.bracket-led | `pending_notes[{i}] starts with "[". handoff.md skips a "[" -led list line on read-back (it reads as a checkbox), so the note would be lost. Reword it so it does not start with "[".` | authored-here — E181 round-trip class found by the PM repro |
| note.empty-sentinel | `pending_notes[{i}] is empty or an empty-section sentinel ("(none)", "無") and would be dropped on read-back. Remove it or reword it.` | authored-here — E181 round-trip class found by the PM repro |
| note.read-view | `pending_notes[{i}] contains tw_get_state read-view display text (the "⟦agc read-view⟧" marker or a legacy "…[truncated]" / "further note(s) omitted" marker), not an author's note. Drop it before writing; the omitted notes are still on disk.` | authored-here — E135 fix shape 1 (write boundary rejects the sentinel, reusing E86's zod superRefine) |
| drift.evidence-line (changed sentence) | `completed_tasks is feature-scoped: it carries forward across same-feature writes and empties on an active_feature change (E150).` | authored-here — replaces `completed_tasks is feature-scoped and legitimately empties on an active_feature change, and a merged parallel lane's ledger can be discarded on conflict (root cause: E150 — not fixed by this detector).` in `tools/drift.ts` `buildEvidenceBackedLine`; the rest of that line is unchanged |
| tool.completed_tasks.description | `Task ids QA has completed for this feature (only agent_id "qa-engineer" may grow it). File mode: kept across same-feature writes that omit it or pass []; cleared when active_feature changes. SQLite: stored as given.` | authored-here — E150; final wording follows the architecture's `[]` / merge decision (AC14) |

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
- `tools/storage-sqlite.ts`, `tools/tasks-file.ts`, `tools/storage.ts`, `gates/**`,
  `tools/transitions.ts` — `tw_rollback_task` / `tw_void_task` are not taught to shrink the
  handoff ledger in this cut.
- Raising `PENDING_NOTES_CHAR_LIMIT` (E138's third fix shape): it trades context budget that
  `test/token-efficiency.test.mjs` pins; the keep-both-ends policy addresses the loss without it.
- Leading/trailing whitespace inside a note is trimmed on read today and stays so (meaning-
  preserving; rejecting it would refuse ordinary input).
- `completed_tasks` ids containing line breaks (same serialisation family as E181, read by the
  `- [x] (.+)` regex) — see Dependencies, open item O2.

## Dependencies / Prerequisites

- No design file (`design/e135-handoff-notes-ledger.md` absent) → mode = no-design; Visual
  Structural Assertions omitted.
- Resource Audit Gate: the only references are in-repo (`docs/backlog.md` rows E135/E138/E150/E181,
  `docs/v4.0.0-new-tickets.md` queue rows #1/#2/#3/#6, `specs/fanout-post-v4-w10.md`,
  `specs/e92-e86-handoff-write-boundary.md`); zero external refs → `external_refs` omitted.
- **Architect hop (T-E150-01)** — required for E150: it changes the lifetime of a ledger read by
  three gates, the drift detector and `tw_sync`, across `tools/registry.ts`,
  `tools/handoff-orchestrator.ts` and `tools/handoff-write.ts`. The architecture decides AC14
  (`[]` semantics, merge vs replace, whether any `content/**` sentence must change) and how the
  orchestrator learns omission. Known constraint from the PM's blast-radius spike: several tests
  call `handleUpdateState` directly with plain objects (bypassing zod), so omission must be
  detected from the parsed object itself (`completed_tasks === undefined`), with every gate
  reading a normalised `?? []` — not via a zod-only side field.
- **Blast radius (PM spike, scratch copy of the lane base, full suite, not committed)**: baseline
  3574/3576 pass (2 skipped). With boundary newline rejection + same-feature carry-forward of
  omitted/`[]` `completed_tasks` (both replace and union variants for qa non-empty writes), the
  only red test was `test/e92-e86-handoff-write-boundary.test.mjs` › "AC2 (documented accepted
  miss, NOT a defect): pending_notes[0] accepts NEW-4: unterminated attribute value containing a
  newline" (3573/3574 pass in both variants), which pins the very newline acceptance E181 removes
  and is re-pinned by T-E181-01. No existing ledger assertion (`test/e32-e33-gate-hardening.test.mjs`,
  `test/reviewer-completed-tasks-gate.test.mjs`, `test/e18-write-provenance.test.mjs` or the other
  ~53 files touching `completed_tasks`) went red, so T-E150-02 re-pins no existing file. The spike
  did not include the E135/E138 read-view change; the only tests pinning the marker / truncation
  text are `test/e92-e86-handoff-write-boundary.test.mjs`, `test/e92-e86-handoff-write-boundary-repro.test.mjs`
  and `test/token-efficiency.test.mjs` (grep for `truncated]`, `further note`,
  `pending_notes_truncated`, `PENDING_NOTES_CHAR`). If the architecture's final semantics or
  sr's implementation turns another existing test red, qa names it in a spec amendment before
  touching it.
- **Repro-first, qa-owned** (lane-protocol §2: only qa-engineer writes `test/**`): the qa
  pre-pass (T-E181-01, T-E138-01, T-E135-01, T-E150-02) runs after the architect hop and before
  any sr-engineer fix. It writes the new red tests, re-pins the existing tests whose pinned
  behaviour this lane changes (so they too are red at the base and green after the fix), records
  every such test in `qa_reports/expected-red_e135-handoff-notes-ledger.txt` (`<path> | <test name>`),
  and commits. It writes no `tw_update_state` (there is no pm/architect → qa edge); the
  coordinator dispatches it as a file-only qa Task. sr-engineer's SOP step 3b is then satisfied by
  that manifest: sr runs the listed tests, confirms them red, and writes no test.
- **`dispatch_mode: "bugfix"`** — applies: all four tickets are defects with a constructible
  reproduction, and bugfix mode makes the manifest load-bearing (`REPRO_MANIFEST_MISSING` on
  sr → code-reviewer; QA Phase 0.5 red → green with zero unexplained reds). The architect hop is
  routed explicitly (bugfix mode only changes the default chain). Chain:
  pm → architect → [qa pre-pass, file-only] → sr-engineer → code-reviewer → qa-engineer.
- Open items for integrator pre-review:
  - **O1 — boundary rejection is mode-agnostic.** The E181 / E135 rejections live in
    `tools/registry.ts`'s zod superRefine (the integrator's recommendation), so they also apply in
    SQLite/HTTP mode, where a multi-line note happens to round-trip today. PM reading: the hard
    constraint "SQLite/HTTP behaviour unchanged" is scoped by its parenthetical to carry-forward,
    and one input contract for both storage modes is the E86 precedent. Integrator to confirm.
  - **O2 — `completed_tasks` ids with line breaks** (`"T-1\n- [x] T-FORGED"`) take the same
    serialisation path (`- [x] ${t}` / `- \[x\] (.+)`). PM proposal: record as a new finding
    (`E181-NEW-1` in `.current/e135/pending-tickets.md`), not in this cut; folding it into
    T-E181-02 would cost one more superRefine clause in an owned file if the integrator prefers.

## Cut Decisions

E135 fix shape: **shape 1 — structural sentinel refused at the write boundary** (not
strip-on-write). Reasons: (a) stripping cannot repair the data loss — a partially kept note
stripped of its suffix would persist a truncated prefix as if complete; shape 1 plus E138's
never-slice rule removes the partial-note shape entirely; (b) it reuses E86's zod superRefine
layer and keeps the write path free of content mutation; (c) it is loud, matching the
`scope_decision_why` precedent and E181's rejection; (d) callers need no convention — the
boundary refuses display text wherever it sits in a note.

E138 keep/drop direction: whole notes only; note[0] first, then the newest notes backwards; one
marker at the elision point; cap unchanged (AC6–AC8).

E150 `[]` semantics: PM proposal in AC14, decided by the architect (T-E150-01); if the
architecture overturns it and a `content/**` sentence must change, T-E150-03 also re-baselines
`test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` (qa) — those rows are not
in the table below because the proposal does not need them; a spec amendment adds them.

`dispatch_mode: "bugfix"` applies (see Dependencies).

Owned test files this cut modifies, by name (integrator pre-review list): `test/e181-pending-notes-roundtrip.test.mjs` (new),
`test/e138-read-view-keeps-tail.test.mjs` (new), `test/e135-read-view-marker.test.mjs` (new),
`test/e150-completed-tasks-carry-forward.test.mjs` (new), `test/e92-e86-handoff-write-boundary.test.mjs`,
`test/e92-e86-handoff-write-boundary-repro.test.mjs`, `test/token-efficiency.test.mjs`
(pending_notes truncation/marker assertions only). No other existing `test/**` file is modified
(blast-radius spike above). Not modified:
`test/e32-e33-gate-hardening.test.mjs`, `test/reviewer-completed-tasks-gate.test.mjs` (AC15 proves
them unchanged), the e209-owned tests, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`.

Shared-file note: `tools/registry.ts` (+ its dist) is written by three sr tasks in sequence
(T-E181-02 → T-E135-02 → T-E150-03) and `test/e92-e86-handoff-write-boundary.test.mjs` by two qa
tasks in one pre-pass; the `depends_on` chain serialises them. All in one lane, one branch.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E150-01 | architect: ledger lifetime blueprint — `[]` semantics, qa merge vs replace, omission detection without zod side fields, SQLite isolation, content/** decision (AC12–AC18) | none | 1 | `specs/e135-handoff-notes-ledger-architecture.md` | — |
| T-E181-01 | qa-engineer (pre-pass): E181 repro + boundary tests, expected-red; re-pin E92's "documented accepted miss" newline case (AC1–AC5) | none | 2 | `test/e181-pending-notes-roundtrip.test.mjs`, `test/e92-e86-handoff-write-boundary.test.mjs` | — |
| T-E138-01 | qa-engineer (pre-pass): keep-both-ends read-view tests, expected-red; re-pin truncation/marker cases (AC6–AC8) | none | 4 | `test/e138-read-view-keeps-tail.test.mjs`, `test/token-efficiency.test.mjs`, `test/e92-e86-handoff-write-boundary.test.mjs`, `test/e92-e86-handoff-write-boundary-repro.test.mjs` | — |
| T-E135-01 | qa-engineer (pre-pass): marker constant + write-back rejection tests incl. legacy shapes, expected-red (AC9–AC11) | none | 1 | `test/e135-read-view-marker.test.mjs` | — |
| T-E150-02 | qa-engineer (pre-pass): carry-forward / `[]` / feature-change tests per the architecture, expected-red; no existing ledger assertion needs re-pinning per the spike (AC12–AC16) | T-E150-01 | 1 | `test/e150-completed-tasks-carry-forward.test.mjs` | — |
| T-E181-02 | sr-engineer: zod rejection of non-round-trippable notes (multiline, `[`-led, empty/sentinel) + schema description; rebuild dist (AC2–AC5) | T-E181-01 | 2 | `tools/registry.ts`, `dist/tools/registry.*` | — |
| T-E138-02 | sr-engineer: read-view keep-both-ends, never slice, one elision marker, `omitted_notes`; export the marker prefix constant; rebuild dist (AC6–AC9) | T-E138-01, T-E135-01 | 4 | `tools/handoff-parse.ts`, `tools/handoff-types.ts`, `dist/tools/handoff-parse.*`, `dist/tools/handoff-types.*` | — |
| T-E135-02 | sr-engineer: boundary rejection of read-view display text (prefix containment + two legacy shapes) using the shared constant; rebuild dist (AC10–AC11) | T-E135-01, T-E138-02, T-E181-02 | 2 | `tools/registry.ts`, `dist/tools/registry.*` | — |
| T-E150-03 | sr-engineer: `completed_tasks` carry-forward per the architecture (boundary optional, orchestrator normalisation, file-writer clause), schema description, drift hint; rebuild dist (AC12–AC18) | T-E150-02, T-E135-02 | 8 | `tools/registry.ts`, `tools/handoff-orchestrator.ts`, `tools/handoff-write.ts`, `tools/drift.ts`, `dist/tools/registry.*`, `dist/tools/handoff-orchestrator.*`, `dist/tools/handoff-write.*`, `dist/tools/drift.*` | — |
