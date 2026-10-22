# e135-handoff-notes-ledger — architecture

Task T-E150-04. Covers the interface contracts for the whole lane (E181 boundary rejection, E138
read view and exported marker constant, E135 boundary rejection, E150 ledger lifetime) and makes
the AC15/AC16 decisions explicit. Binding inputs: `specs/e135-handoff-notes-ledger.md` @ 62297e8
(AC1–AC21, Copy/Strings, Out of Scope, Dependencies, Cut Decisions, Cut) and the e135 row of
`specs/fanout-post-v4-w10.md`.

## Decisions in one place (T-E150-04)

- **AC15 — `[]` semantics.** The PM proposal is confirmed. In file mode, `completed_tasks: []` and
  an omitted `completed_tasks` are one input class for every agent: neither shrinks the ledger.
  A `qa-engineer` write with a non-empty list **merges** into the same-feature on-disk ledger
  (union, on-disk order first, then incoming ids not already present). It does not replace it.
- **AC15 — detecting omission.** Not needed. Because `[]` and omission mean the same thing, the
  zod field keeps `.optional().default([])` byte-identical. No zod side field, no
  `.optional()`-without-default change, no change to the `UpdateStateInput` type. The
  orchestrator normalises `completed_tasks ?? []` once at entry, for direct callers that skip zod.
- **AC16 — shrink.** The orchestrator, in file mode only, passes a ledger directive to the file
  writer. The writer resolves it inside the handoff lock against the same-feature on-disk
  ledger. The only removal source is a write with `agent_id: "qa-engineer"` **and**
  `status: "FAIL"` **and** a non-empty `review_task_ids`. Every ledger entry that matches one of
  those ids is removed. Matching uses the word-boundary predicate that `tw_sync` uses, so the
  next `tw_sync` cannot re-mark a removed id. The APPROVED row (`qa-engineer`, `In_Progress`,
  `review_task_ids`) never shrinks the ledger. `tools/tasks-file.ts`, `tools/sync.ts` and
  `gates/**` stay unchanged.
- **SQLite/HTTP.** Carry-forward, merge and shrink all apply in file mode only. SQLite stores
  `parsed.completed_tasks` exactly as it does today. Feature change still clears the ledger.
- **`content/**`.** No sentence changes. The compose goldens and `test/context-budget.test.mjs`
  stay untouched. Reasoning is in Decision Records, DR-6.
- **Gates.** Every gate body, error code, rejection condition and envelope text stays
  byte-identical. The Non-QA Completed-Tasks Gate still reads the incoming list and stays strict.

## Affected Files

| file | task | change |
|---|---|---|
| `tools/registry.ts` | T-E181-03 | Changes to the `UpdateStateArgs` `.superRefine`: per-note round-trip checks (`note.multiline`, `note.bracket-led`, `note.empty-sentinel`) and the per-id `ledger.multiline` check on `completed_tasks`. |
| `tools/handoff-types.ts` | T-E138-03 | Exports the runtime constant `READ_VIEW_MARKER_PREFIX` and the `PendingNotesTruncated` interface. This is the module's first runtime export; the header comment is updated to say so. |
| `tools/handoff-parse.ts` | T-E138-03 | Read view: keep-both-ends selection, no note is ever sliced, one `marker.elided` entry, `omitted_notes`. Exports the pure helpers `selectPendingNotesView` and `formatElidedMarker`. |
| `tools/registry.ts` | T-E135-03 | Adds the `note.read-view` check, built on the imported `READ_VIEW_MARKER_PREFIX` plus two local legacy-shape tests. |
| `tools/registry.ts` | T-E150-05 | The `completed_tasks` inputSchema description becomes `tool.completed_tasks.description` (final text below). Comment fix at the `external_refs` zod comment ("wholesale, like completed_tasks — never merged" is no longer true of completed_tasks). |
| `tools/handoff-orchestrator.ts` | T-E150-05 | `completed_tasks ?? []` normalisation at the top of `handleUpdateStateCore`. Builds the file-mode `completedTasksCarry` directive and passes it to `storage.writeState`. Gate bodies are not touched. |
| `tools/handoff-write.ts` | T-E150-05 | New option `completedTasksCarry` and the ledger-resolution clause inside the lock, plus the private matcher. Comment fix at `externalRefs` ("like completedTasks — never merged"). |
| `tools/drift.ts` | T-E150-05 | `buildEvidenceBackedLine`: replace the one sentence with `drift.evidence-line` (AC19). Nothing else changes. |
| `dist/tools/{registry,handoff-types,handoff-parse,handoff-orchestrator,handoff-write,drift}.*` | each sr task | `npm run build` output. |
| `qa_reports/expected-red_e135-handoff-notes-ledger.txt` | each sr task | Appends the existing tests the task turns red (spec "Repro discipline"). |
| `test/e181-*.test.mjs`, `test/e138-*.test.mjs`, `test/e135-*.test.mjs`, `test/e150-*.test.mjs` + the three re-pinned files | qa tasks | As listed in the spec's Cut Decisions. The architecture adds none. |

**Not touched:** `tools/storage-sqlite.ts`, `tools/storage.ts`, `tools/tasks-file.ts`, `tools/sync.ts`,
`tools/transitions.ts`, `gates/**`, `schema/**`, `content/**`, `test/fixtures/compose-golden/**`,
`test/context-budget.test.mjs`. `tools/storage.ts`'s `FileHandoffStorage.writeState` already passes
the options object through to `writeHandoffState` unchanged, so the new option needs no edit there.

## Data Structures

```ts
// tools/handoff-types.ts (T-E138-03): the ONLY copy of the literal in tools/ source.
/** Prefix of every synthetic entry the tw_get_state read view may emit (marker.prefix).
 *  Emitted by tools/handoff-parse.ts, refused by tools/registry.ts. */
export const READ_VIEW_MARKER_PREFIX = "⟦agc read-view⟧"; // U+27E6 … U+27E7

/** View-only sibling key of pending_notes, present only when elision fired. */
export interface PendingNotesTruncated {
  total_chars: number;   // sum of on-disk note lengths (unchanged meaning)
  limit: number;         // PENDING_NOTES_CHAR_LIMIT (3000, unchanged)
  omitted_notes: number; // count of elided notes (new; AC9)
}
```

```ts
// tools/handoff-write.ts (T-E150-05): new member of WriteHandoffStateOptions.
/**
 * E150 file-mode ledger lifetime. Transient: never persisted and never read
 * from existing state. When PRESENT, the written ledger is
 *   (sameFeatureExisting ∪ completedTasks) minus every entry matching an id in `remove`,
 * where sameFeatureExisting = existing.completed_tasks if existing.active_feature
 * === activeFeature, else []. When ABSENT, completedTasks replaces the ledger
 * exactly as today (`?? []`). That keeps the heal-write, the positional
 * overload and every direct caller byte-identical.
 */
completedTasksCarry?: { remove: readonly string[] };
```

No HandoffState field, frontmatter key, `schema_version` or SQLite column changes (AC6, AC18).

## Interface Contracts

### E181: boundary round-trip rules (T-E181-03, `tools/registry.ts`)

New private helpers, called from the existing `UpdateStateArgs.superRefine`. They are appended
**after** the existing E86 `pending_notes` loop, so an E86 issue on the same note keeps its place
and its byte-identical message (AC6). The e92 tests check E86 messages with `includes`, so an
extra issue on the same note does not break them.

```ts
/** Line terminators that split a list line on read-back. JS `.` and `^`/m treat all four as
 *  line ends, so the reader's /^- (?!\[)(.+)/gm and /- \[x\] (.+)/g split on each. Same class
 *  as tools/tasks-file.ts containsLineBreak. */
function hasLineBreak(s: string): boolean;           // /[\r\n  ]/

/** First round-trip defect of one note, or null. Precedence (at most ONE issue per note):
 *  multiline → read-view (T-E135-03 inserts it here) → bracket-led → empty-sentinel. */
function pendingNoteRoundTripIssue(note: string, i: number): string | null;
//   hasLineBreak(note)                               → note.multiline(i)
//   /^\s*\[/.test(note)                              → note.bracket-led(i)
//   t = note.trim(); t === "" || t === "(none)" || t === "無" → note.empty-sentinel(i)

/** completed_tasks ids: hasLineBreak(id) → ledger.multiline(i). Nothing else is added. */
```

Issue shape: `ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["pending_notes", i] })`
(or `["completed_tasks", i]`). Each message is the spec's Copy/Strings row, filled in by a
function of `i` (`note.multiline`, `note.bracket-led`, `note.empty-sentinel`, `ledger.multiline`).
Because these checks live in the zod schema, they reject before any gate runs and before any
write, in both storage modes (spec Dependencies, "Mode reading").

Invariant (AC4): for every `pending_notes` array the boundary accepts, parse(write(notes)) equals
`notes.map(n => n.trim())`, with the same count.

### E138: read view (T-E138-03, `tools/handoff-parse.ts`)

```ts
/** Pure. notes = on-disk pending_notes (already trimmed by parse). Never slices a note. */
export function selectPendingNotesView(
  notes: readonly string[],
  limit: number,
): { notes: string[]; truncated: PendingNotesTruncated | null };

/** marker.elided, built from READ_VIEW_MARKER_PREFIX:
 *  `${READ_VIEW_MARKER_PREFIX} ${n} note(s) omitted here — full text is on disk; see pending_notes_truncated. Do not write this line back.` */
export function formatElidedMarker(n: number): string;
```

Algorithm. `total` is the sum of `note.length`. When `total <= limit`, return the input unchanged
with `truncated: null` (no key and no marker, so the view is byte-identical to today's; AC9).
Otherwise:

1. `budget = limit`. Keep `note[0]` iff `note[0].length <= budget`; if kept, `budget -= note[0].length`.
2. `start = keptHead ? 1 : 0`. Walk `j = n-1` down to `start`. Keep `note[j]` while
   `note[j].length <= budget`, subtracting each kept note from the budget. **Stop at the first note
   that does not fit.** The kept tail is contiguous, so there is exactly one elision point.
3. `omitted = n - (keptHead ? 1 : 0) - tailCount`. This is always ≥ 1 when `total > limit`.
4. Output: `[note[0]]` if kept, then `formatElidedMarker(omitted)`, then the kept tail in original
   order. The marker sits at index 1 when `note[0]` is kept and at index 0 otherwise (AC7).
5. `truncated = { total_chars: total, limit, omitted_notes: omitted }`. Key order is fixed as
   written.

The marker's own length is **not** charged to the budget. That matches today: E92's marker was not
charged either. The `…[truncated]` suffix and the E92 `…[N further note(s) omitted …]` literal are
deleted from `handoff-parse.ts`. `readHandoffState` calls `selectPendingNotesView` and spreads
`pending_notes_truncated` only when `truncated !== null`. SQLite's `readState` has no notes
truncation, so it emits no marker and is not edited.

### E135: read-view refusal (T-E135-03, `tools/registry.ts`)

```ts
import { READ_VIEW_MARKER_PREFIX } from "./handoff-types.js";

/** True when the note carries tw_get_state display text. */
function isReadViewDisplayText(note: string): boolean;
//   note.includes(READ_VIEW_MARKER_PREFIX)                                   // AC12: containment
//   || note.trimEnd().endsWith("…[truncated]")                                // legacy suffix
//   || /^…\[\d+ further note\(s\) omitted — see pending_notes_truncated\]$/.test(note.trim()) // legacy E92 whole note
```

Placed second in `pendingNoteRoundTripIssue`'s precedence, returning `note.read-view(i)`. The
message is built with `${READ_VIEW_MARKER_PREFIX}` interpolated where the Copy/Strings row shows
`"⟦agc read-view⟧"`. As a result the literal `⟦agc read-view⟧` occurs exactly once in `tools/`
source, in `handoff-types.ts` (AC10). The two legacy literals live only in `registry.ts`, because
after T-E138-03 the reader no longer emits them.

### E150: ledger lifetime (T-E150-05)

**Orchestrator (`handleUpdateStateCore`).**

```ts
// first statement after enforcePreFlight: non-zod direct callers only; zod already defaults it
parsed = { ...parsed, completed_tasks: parsed.completed_tasks ?? [] };
// … pipeline unchanged …
const ledgerRemove =
  parsed.agent_id === "qa-engineer" && parsed.status === "FAIL" && (parsed.review_task_ids?.length ?? 0) > 0
    ? parsed.review_task_ids!
    : [];
storage.writeState({
  …,
  completedTasks: parsed.completed_tasks,                 // unchanged argument
  ...(storage instanceof FileHandoffStorage && { completedTasksCarry: { remove: ledgerRemove } }),
  …,
});
```

The directive is attached on **every** file-mode write: omission, `[]`, the merge case and the
FAIL case. SQLite never receives it (AC18). The `instanceof FileHandoffStorage` check is the same
one `QA_COMPLETION_EVIDENCE_MISSING` already uses.

**Writer (`writeHandoffStateCore`, inside `withFileLock`, after `verifyFreshness`).** `existing` is
already read on every write (`archiveCheckNeedsExisting = true`), so this adds no I/O.

```ts
// when opts.completedTasksCarry is present:
const base = existing?.active_feature === _activeFeature ? existing.completed_tasks : [];
const seen = new Set(base.map((s) => s.trim()));
const merged = [...base];
for (const id of opts.completedTasks ?? []) {
  const k = id.trim();
  if (!seen.has(k)) { seen.add(k); merged.push(id); }
}
const effective = merged.filter((entry) => !opts.completedTasksCarry.remove.some((id) => ledgerEntryMatchesId(entry, id)));
// when absent: effective = opts.completedTasks ?? []   (today, byte-identical)

/** Mirrors tools/sync.ts and tools/drift.ts exactly: new RegExp(`\\b${escapeRegExp(id)}\\b`).test(entry).
 *  Private to handoff-write.ts (sync.ts/drift.ts are not exported from / out of scope). */
function ledgerEntryMatchesId(entry: string, id: string): boolean;
```

`effective` replaces `completedTasks` in the existing `completedList` serialisation. Nothing else
in the writer changes.

**Resulting lifetime (file mode).**

| write | ledger after |
|---|---|
| same feature, any agent, `completed_tasks` omitted or `[]`, not a qa FAIL with `review_task_ids` | unchanged (AC13, AC15) |
| same feature, `qa-engineer`, non-empty `completed_tasks` (PASS or otherwise; passes the gates) | on-disk ∪ incoming (AC15) |
| same feature, `qa-engineer`, `status: FAIL`, non-empty `review_task_ids` | (on-disk ∪ incoming) minus entries matching `review_task_ids` (AC16) |
| same feature, `qa-engineer`, `In_Progress` + `review_task_ids` (APPROVED row) | unchanged (AC16) |
| non-qa write carrying non-empty `completed_tasks` | rejected by the unchanged gate before any write (AC17) |
| `active_feature` changes | incoming list only (minus `remove`, which is a no-op on an empty base); the archive copy keeps the old ledger (AC14) |
| heal-write, positional overload, direct `writeHandoffState` callers without the directive | replace, as today |

**Gate interaction (unchanged code, verified semantics).** `REVIEWER_/NON_QA_COMPLETED_TASKS_REJECTED`,
`QA_REVIEW_TARGET_REQUIRED`, `QA_COMPLETION_EVIDENCE_MISSING`, `MISSING_EVIDENCE`, the visual,
expected-red and AC-execution PASS sub-gates, and `MISSING_REVIEW_EVIDENCE` all keep reading
`parsed.completed_tasks`, which is the incoming list and never the merged ledger. Every id the
union adds is either already on disk or is an incoming id that `QA_COMPLETION_EVIDENCE_MISSING`
checked against `prevState`. The "QA-evidence-backed ledger" invariant therefore holds.

**Strings (T-E150-05).**

- `drift.evidence-line`: replace exactly the sentence quoted in the spec row. The text before and
  after it in `buildEvidenceBackedLine` stays byte-identical (AC19).
- `tool.completed_tasks.description` (final; AC20). The spec row defers its wording to this
  artifact; the decision adds the merge clause:

  `Task ids QA has completed for this feature (only agent_id "qa-engineer" may change it). File mode: a qa-engineer list is added to the ids already recorded; kept across same-feature writes that omit it or pass []; a qa-engineer FAIL write removes its review_task_ids; cleared when active_feature changes. SQLite: stored as given.`

  `review_task_ids`'s description stays unchanged: it is still transient and never persisted, and
  the shrink is documented on `completed_tasks`.

## Sequence Diagram

AC16, qa FAIL plus rollback in either order, then `tw_sync`:

```mermaid
sequenceDiagram
    participant QA as qa-engineer
    participant Z as registry (zod)
    participant O as orchestrator
    participant W as handoff-write (lock)
    participant T as tasks-file (rollback)
    participant S as tw_sync
    Note over W: on disk: ledger [A, B] (feature F); tasks.md [x] A, [x] B
    alt FAIL write first
        QA->>Z: tw_update_state(qa-engineer, FAIL, review_task_ids=[B], qa_review)
        Z->>O: parsed (completed_tasks defaulted to [])
        O->>O: pipeline unchanged (QA_REVIEW_RECORD stamps FAIL for B)
        O->>W: writeState(completedTasks=[], completedTasksCarry={remove:[B]})
        W->>W: base=[A,B] ∪ [] minus \bB\b → [A]
        QA->>T: tw_rollback_task(B)
        T->>T: tasks.md [ ] B (reverted), handoff untouched
    else rollback first
        QA->>T: tw_rollback_task(B)
        T->>T: tasks.md [ ] B (reverted)
        QA->>Z: tw_update_state(qa-engineer, FAIL, review_task_ids=[B], qa_review)
        Z->>O: parsed
        O->>W: writeState(completedTasks=[], completedTasksCarry={remove:[B]})
        W->>W: ledger → [A]
    end
    QA->>S: tw_sync
    S->>S: B matches no ledger entry → not re-marked; A already [x]
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| DR-1 (AC15): what `[]` means | `[]` equals omission for every agent in file mode; it never shrinks the ledger. | The Non-QA gate's clearing artifact ("omit … or pass `[]`") keeps meaning "this write leaves the ledger alone", so a non-qa role following its SOP cannot reopen E150's door. The alternative, `[]` = "clear", would have required rewriting two `content/**` sentences plus goldens and budget, and would have given every role a shrink door. The cost: no write can clear the ledger wholesale. The only shrink is a targeted qa FAIL (DR-3). |
| DR-2 (AC15): qa non-empty list | Union (on-disk order first, incoming appended, deduped on trimmed value), not replace. | The qa SOP's PASS row passes `completed_tasks=[<ids>]` for the current ids only. Under replace, every later qa PASS would wipe earlier PASSes and undo E150. Under union, the existing Constitution sentence "passing the full cumulative list back never re-gates ids already on disk" stays true, and so does a short list. The ledger can grow past the zod input cap of 200 over a long feature; the read view already caps it at 50 (`COMPLETED_TASKS_RETURN_LIMIT`). |
| DR-3 (AC16): who may shrink, and by what key | Only `agent_id: qa-engineer` + `status: FAIL` + non-empty `review_task_ids`. Removal is keyed on `review_task_ids`, not on the `completed_tasks` fallback. `qa_review` is not required. | It matches the qa SOP exactly: every qa FAIL row already "carries `qa_review` plus `review_task_ids`" and follows `tw_rollback_task`. The APPROVED row is `In_Progress`, so it can never shrink. Not requiring `qa_review` keeps AC16's literal call shape valid. In practice a SOP FAIL write always carries one, so the shrink comes with a FAIL record. If one write both lists `B` in `completed_tasks` and names `B` in `review_task_ids`, removal wins: the FAIL verdict on `B` is the later and more specific claim. `qa-engineer` identity is attested, not verified. A forged qa FAIL can only *under*-claim completion, and `tw_detect_drift` surfaces that against on-disk PASS evidence. |
| DR-4: where the shrink and carry-forward run | Policy (who, what to remove) lives in the orchestrator, which knows agent, status and review ids. Resolution (base, union, removal) lives in the writer, inside the lock, against the same `existing` that every other feature-scoped carry clause reads. | There is one read of the ledger under the lock. A same-process write between `prevState` and the publish cannot be lost, because the writer re-reads `existing` while holding the lock. `tools/tasks-file.ts`, `tools/sync.ts` and `gates/**` are unchanged, as the spec requires. The alternative, the orchestrator computing the final list from `prevState`, would read outside the lock and copy policy into a second place. |
| DR-5: making carry-forward opt-in in the writer | `completedTasksCarry` present → carry/merge/remove. Absent → today's replace. Undefined `completedTasks` is **not** reinterpreted as "carry". | The 158 direct options-object writer calls in `test/`, the migration heal-write and the positional overloads stay byte-identical. That keeps the blast radius to the spike's measurement. The cost is that the carry-forward is not automatic for a future non-orchestrator caller; such a caller must opt in. |
| DR-6: `content/**` | No sentence changes. Checked: Constitution §3.1 Non-QA gate "Clearing artifact: omit `completed_tasks` (or pass `[]`) … only `agent_id: qa-engineer` may grow the ledger" stays true (both forms leave the ledger as is; only qa grows it). The QA Completion-Evidence paragraph stays true (union never re-gates on-disk ids). code-reviewer SOP "omit the field entirely, or pass `[]`" and "NO `completed_tasks`" stay true. qa SOP PASS/FAIL rows and Escalation Routes ("FAIL rows carry `qa_review` plus `review_task_ids` … follow the `tw_rollback_task`") already describe the exact shrink shape. `gates/registry.ts` hints ("omit completed_tasks (or pass [])") stay true. | `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` are not touched, and no spec amendment adds their rows. No sentence anywhere claims that an omitting write clears the ledger, so nothing has become false. |
| DR-7 (AC2/AC4): line-break class | Reject `\r`, `\n`, U+2028 and U+2029 in notes and ledger ids. That is a superset of AC2's literal `\n`/`\r`. | AC4 requires every accepted note to round-trip, and JS `.` / `^`(m) end a line at U+2028/U+2029, so a note containing either would split and forge on read-back. The class is the one `tools/tasks-file.ts` `containsLineBreak` already uses. The `note.multiline` / `ledger.multiline` text ("contains a line break") is accurate for all four. See Open Question 2. |
| DR-8 (AC3): one issue per note | At most one E181/E135 issue per note, in the order multiline → read-view → bracket-led → empty-sentinel. Appended after the unchanged E86 loop. | Error output stays readable. The E86 message is still present on the same note when it applies (the e92 tests use `includes`). |
| DR-9 (AC7): keep-both-ends shape | Keep note[0], then a contiguous tail from the end. Stop at the first tail note that does not fit, so there is one marker at one elision point. The marker is not charged to the budget. | A very long newest note can push out shorter middle notes, which is accepted: one marker, one gap. The budget stays the 3000 chars of author text that `token-efficiency` measures, and the view grows by at most one marker line, as E92's did. |
| DR-10 (AC11): legacy-shape detection | `…[truncated]` is matched as a suffix (after `trimEnd`). The E92 marker is matched as the whole note (after `trim`). The new prefix is matched anywhere in the note (AC12). | Only the shapes the old reader actually produced are refused, which keeps false positives low for prose that mentions these bugs. A handoff that already persisted a legacy marker gets a one-time `note.read-view` rejection on its next carry-forward write. That is the AC11 intent. |

## Deferred Resources

_None. The spec's Dependencies / Prerequisites records zero external references (Resource Audit
Gate: in-repo references only; `external_refs` omitted)._

## Recorded findings (not this lane's scope; for the integrator's ticket queue)

- **F1.** A `completed_tasks` id that is empty, or whitespace-only, is accepted by the boundary
  but written as `- [x] ` and lost on read-back. This is the same round-trip class as E181, but
  not in the cut. The E150 union does not make it worse.
- **F2.** The `content/skill-qa-visual.md` Phase 1.5 FAIL rows show a `tw_update_state(status=FAIL, …, qa_review=…)`
  call **without** `review_task_ids`. The server already rejects that call with
  `QA_REVIEW_TARGET_REQUIRED` (pre-existing). The qa-engineer Escalation Routes format line
  ("FAIL rows carry `qa_review` plus `review_task_ids`") governs, and that shape also performs the
  E150 shrink. The visual rows should eventually be aligned with it.

## Open Questions

1. **The `tw_void_task` refusal remains after a rollback that has no qa FAIL write.**
   `voidTaskInFile` refuses an id that is still in `handoff.completed_tasks` and tells the caller
   to "roll it back first (tw_rollback_task)". Today any later omitting write empties the ledger,
   so this refusal was short-lived. With carry-forward, an id rolled back **without** the paired
   qa FAIL write stays in the ledger until a qa FAIL names it. Until then, `tw_void_task` keeps
   refusing it and `tw_sync` would re-mark it.
   Every qa SOP FAIL row pairs the rollback with a FAIL write carrying `review_task_ids`, so the
   sanctioned path is covered (AC16). The gap is limited to off-SOP rollbacks.
   **Recommendation:** accept for this lane (`tools/tasks-file.ts` and `tools/sync.ts` stay out of
   scope, per the integrator's round-1 direction) and file a new finding: either the void message
   names the qa FAIL step, or `tw_rollback_task` gains ledger removal in a later wave.
2. **AC2 text versus the line-break class (DR-7).** The architecture rejects U+2028/U+2029 in
   addition to AC2's literal `\n`/`\r`, because AC4's round-trip property requires it.
   **Recommendation:** accept as a refinement of AC2. The PM amends AC2/AC5 to "a line break
   (`\n`, `\r`, U+2028, U+2029)" so qa pins all four. The message strings are unchanged.
3. **Copy/Strings row `tool.completed_tasks.description` must match the final text.** The spec
   row's wording omits the merge clause. This artifact's final string adds
   "a qa-engineer list is added to the ids already recorded;". T-E181-03's cut entry also says
   "+ schema description", but no Copy/Strings row exists for a `pending_notes` description
   change.
   **Recommendation:** the PM amends the `tool.completed_tasks.description` row to the exact
   string under Interface Contracts → E150 → Strings. T-E181-03 changes no inputSchema description
   (`pending_notes`' "Notes for next agent" stays). If a `pending_notes` description is wanted,
   the PM adds a Copy/Strings row first. Neither change touches `content/**`.
