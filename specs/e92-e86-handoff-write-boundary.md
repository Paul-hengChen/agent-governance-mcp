# e92-e86-handoff-write-boundary

## Problem Statement

Two defects share the same write/read boundary around free-text handoff
fields (`pending_notes`, `scope_decision_why`, `qa_review`, `tw_add_task`
`description`, etc.), and both were caused or surfaced by the same class of
incident: a malformed multi-argument `tw_update_state`/`tw_add_task` call
whose argument tags bled into an adjacent field.

**E86** — the write boundary has no shape/markup validation on any free-text
arg (verified: `grep -n "MALFORMED\|parameter name\|markup" tools/handoff-orchestrator.ts`
returns nothing). When a client-side malformed tool call absorbs a sibling
argument's literal XML tag markup into a field's tail, the server accepts it
silently; the only symptom on record is an unrelated length-cap rejection
that stands in for a structural error, costing retries, or — worse — a
successful write that persists the contamination into an evidence artifact.

**E92** — `PENDING_NOTES_CHAR_LIMIT = 3000` (`tools/handoff-parse.ts:60`) is a
**read-view** truncation applied only when `readHandoffState` builds its
returned view (`tools/handoff-parse.ts:442-485`); `tools/handoff-write.ts`
contains no truncation of any kind, so the full notes are always persisted to
disk intact. The write-time cap that does exist for `pending_notes` is the
zod schema in `tools/registry.ts` (`z.array(z.string().max(1000)).max(50)`),
which already rejects loudly. The genuine residual defect is narrower than
filed: in the read-view loop, a note that is *partially* kept gets an inline
`…[truncated]` marker, but a note dropped *wholly* (`if (charBudget <= 0)
break;`) leaves no inline trace at all in the returned array — its absence is
signalled only by the sibling `pending_notes_truncated: {total_chars, limit}`
advisory field, which a caller that does not specifically inspect it will
never notice.

## Scope correction (binding — read before implementing)

Coordinator-measured findings (verified independently before this spec was
written; do not re-derive):

1. There is no over-cap `pending_notes` write to reject — the write path
   (`tools/handoff-write.ts`) does no truncation, and the zod schema already
   rejects any write that would exceed its caps. **This retires E92 filed
   option (i) ("reject the over-cap `pending_notes` write") as filed**: there
   is nothing to reject, and rejecting a within-cap write to "fix" a
   read-view truncation would refuse content the server already preserves.
2. E92's second half (write-time caps are never re-checked on read, so an
   already-over-cap value could sit on disk) is true by inspection — the read
   path is `js-yaml` + a type cast, with no zod re-validation — but its cited
   instance is unverified (400 committed revisions of `.current/handoff.md`
   scanned; none has `scope_decision_why` over 2000 chars — absence is not
   proof, since `handoff.md` is rarely committed). A read-path length check
   would carry a real, unmeasured risk of wedging existing on-disk state that
   predates the cap. **Out of scope for this cut** (see Out of Scope).

## User Stories

- As any role reading `tw_get_state`, I want a whole-note drop in the
  `pending_notes` read view to leave an inline trace in the array itself, so
  that I don't have to remember to separately inspect
  `pending_notes_truncated` to know content is missing.
- As any role issuing `tw_update_state`/`tw_add_task`, I want a free-text
  field that ends in leftover tool-call tag markup to be rejected with a
  message naming the field and the likely cause, so that a malformed
  multi-argument call fails loudly at the boundary instead of silently
  contaminating an audit-trail field or being deflected by an unrelated
  length-cap error.

## Acceptance Criteria

- **AC1** — Given a `tw_update_state`/`tw_add_task` free-text field value
  whose trimmed tail is an unbalanced tool-call tag-markup fragment (e.g. it
  ends with a trailing `<parameter name="...">`- or `</invoke>`-style
  fragment), when the write is attempted, then the server rejects it via a
  zod-level check in `tools/registry.ts` with a message naming the offending
  field and identifying it as leftover tool-call markup — not the length-cap
  message that stood in for it before.
  proof: qa-authored unit test in `test/` constructing such a value and
  asserting rejection with the new message (not `"Too big"`).
- **AC2** — Given a free-text field value that legitimately quotes a
  tag-markup fragment mid-string (not at the tail), when the write is
  attempted, then it is accepted normally. (This backlog row's own E86
  paragraph, which quotes such fragments as prose, is the worked example the
  predicate must not flag.)
  proof: qa-authored unit test with a string containing
  `<parameter name="pending_notes">` mid-sentence followed by further prose,
  asserting acceptance.
- **AC3** — Given the `readHandoffState` `pending_notes` read-view
  truncation loop drops one or more notes wholly (`charBudget <= 0` before
  that note is considered), when the view is built, then the returned
  `pending_notes` array's last entry is a synthetic marker stating how many
  notes were omitted, in addition to the existing `pending_notes_truncated`
  advisory field (unchanged).
  proof: qa-authored unit test round-tripping a handoff whose notes are sized
  so at least one is wholly dropped (e.g. three 1000-char notes fill the
  3000-char budget exactly, a fourth note is dropped wholly), asserting the
  marker is present as the array's last element.
- **AC4** — Given a `scope_decision_why` (or other write-time-capped field)
  value already on disk that exceeds its write-time zod ceiling — simulating
  data written before the cap existed — when it is read via
  `readHandoffState`, then the read succeeds without a new rejection; this
  cut introduces no read-path length re-validation.
  proof: qa-authored unit test reading a crafted over-cap `scope_decision_why`
  from a handoff fixture, asserting no throw.
- **AC5** — Given a fully-valid `tw_update_state`/`tw_add_task` call within
  all existing zod caps and with no trailing tag-markup fragment, when it is
  submitted, then it is accepted exactly as before this cut (no new false
  rejections).
  proof: full existing suite green (`npm test`) plus a qa-authored boundary
  test just under each affected cap.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e86.rejection_message | `Field "<field>" appears to end with leftover tool-call markup (a trailing tag fragment) — this usually means a malformed multi-argument call bled into this field. Re-issue the call with each argument in its own tag.` | authored-here — new validation message; wording names the field and states the likely cause per E86's own diagnosis in `docs/backlog.md` |
| e92.omission_marker | `…[{n} further note(s) omitted — see pending_notes_truncated]` | authored-here — extends the existing `…[truncated]` per-note convention (`tools/handoff-parse.ts`) to the whole-note-drop case per this spec's Scope correction §2 |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any read-path re-validation or length re-check of `scope_decision_why` or
  any other write-time-capped field against its zod ceiling (E92's second
  half). Deferred: the wedge-existing-state risk is real in principle and
  unmeasured in fact (Scope correction §2 above); not fixed in this cut.
- Raising `PENDING_NOTES_CHAR_LIMIT` itself (E92 filed option (iii)) — merely
  moves the cliff, not taken.
- A new `GateErrorCode` / `gates/registry.ts` entry for the E86 rejection.
  The rejection is a zod-level input-schema check in `tools/registry.ts`
  (L-STATE-owned), not a gate (`gates/*.ts` is L-GATE-owned, a different
  concurrent lane per `docs/v4.0.0-execution-plan.md` §3). If implementation
  finds the zod-level check insufficient and a dedicated gate is genuinely
  required, that is a cross-lane dependency to report, not to build here.
- E128 (Blocked role cannot self-correct its own Blocked record) — the third
  facet of the same 2026-09-15 incident, but a separate ticket/feature this
  same session runs immediately after this one. Not folded into this cut.
- Any change to `content/**`, `test/fixtures/compose-golden/**`, or
  `test/context-budget.test.mjs` (L-CONTENT-owned), or to
  `tools/transitions.ts` (L-TRANS/E128-owned), or to `gates/*.ts` /
  `gates/registry.ts` (L-GATE-owned).

## Dependencies / Prerequisites

None blocking. Informational only: E128 (self-loop for `Blocked` roles) is
the third facet of the same source incident as E86/E92 and is planned as a
separate feature in this same session immediately after this one — no code
dependency exists between them, since E86/E92 touch the write/read boundary
for free-text fields while E128 touches `tools/transitions.ts` (a different
lane's file).
