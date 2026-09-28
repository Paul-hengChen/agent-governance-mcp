# e13-terminal-marker-advisory

## Problem Statement

The E1A feature-lease terminal marker (`gates/feature-lease.ts`) treats a
release-engineer closing write as "shipped, lease released" only on the exact
triple `last_agent === "release-engineer" && status === "In_Progress" &&
next_role === "pm"`. This triple has now failed silently twice, each time
re-arming a dead lease and stalling the next feature's PM start for the
~30-minute TTL window:

- **First occurrence (v3.75.0 close-out)**: the coordinator briefed
  release-engineer to omit `next_role` ("parked, awaiting human"). The write
  landed without complaint (`next_role` is documented TRANSIENT — omitted on
  any write that doesn't set it, never rejected), the third conjunct silently
  failed to match, and the next feature's PM write was rejected with
  `FEATURE_LEASE_HELD`.
- **Second occurrence (v3.77.0 close-out, discovered during E9 intake)**: the
  closing write DID carry the full triple (`next_role="pm"` confirmed by an
  11:08Z read). A later, unrelated read triggered a schema-migration heal-write
  (`readHandoffState`'s fire-and-forget re-persist in `tools/handoff.ts`,
  ~line 506-544) at 11:14:49.627Z. That heal-write explicitly re-passes
  `pendingNotes: state.pending_notes` (line 523, preserved verbatim) but —
  per `next_role`'s documented AC-3 "transient, write-scoped" semantics
  (`tools/handoff.ts` line 987-992, and the positional-overload comment at
  line 757-759: "an omitting write — including the migration-heal write in
  `readHandoffState` — simply drops them") — never carries `next_role`
  forward. The heal-write is not a bug; it is `next_role`'s designed
  behavior colliding with the terminal marker's dependency on that same
  field surviving indefinitely.

**Why this matters for the fix choice**: the first occurrence is a write-time
mistake (a server-side advisory at write time, backlog option (a), could catch
it). The second occurrence is NOT a write-time mistake — the write was correct
when written; the corruption happens later, at an unrelated read. A
write-time-only advisory (option (a) alone) cannot see it. Only relaxing the
marker itself so it no longer depends on `next_role` surviving (backlog
option (b), or the both-belt option (c)) covers both classes.

**Why the literal option-(b) text isn't safe as written**: the backlog phrasing
("relax the marker to `last_agent === "release-engineer" && status ===
"In_Progress"`", dropping the `next_role` conjunct entirely) would ALSO match
release-engineer's OPENING write (SOP step 2 — no `next_role` either, by
design), which is exactly the D9/D10 in-flight-release race the terminal
marker's own header comment (`gates/feature-lease.ts` line 27-29) warns
against: "keying on `last_agent` alone would reopen the D9/D10 race." A naive
drop of the `next_role` conjunct would release the lease WHILE the release's
git commit/tag/push mechanics are still running, letting a second feature
start work mid-release.

## Decision

Adopt a **corrected, narrower relaxation** — not the literal option-(b) text,
but a version that achieves its goal (stop depending on `next_role`
surviving) without reopening the opening-write race — **plus** a
documentation belt (option (c), "both-belt", with the belt aimed at the right
mechanism):

1. **Durable substitute signal**: broaden the terminal marker's third
   conjunct from `next_role === "pm"` (only) to `next_role === "pm" OR
   pending_notes[0] matches the closing-write signature (/^Released v/)`.
   SOP step 12 (`content/skill-release-engineer.md`) always stamps
   `pending_notes=["Released vX.Y.Z", "tag: <sha>"]` on the closing write —
   a pattern the opening write's `pending_notes=["release-engineer: starting
   release for <active_feature>"]` never matches, and escalation writes
   (Blocked / `next_role="qa-engineer"`/`"human"`) never match either. Unlike
   `next_role`, `pending_notes` is NOT dropped by the migration heal-write —
   `writeHandoffState`'s heal call explicitly re-passes `pendingNotes:
   state.pending_notes` unchanged. This is a strict broadening: every
   previously-terminal case stays terminal; it additionally covers both the
   first occurrence (next_role never set) and the second (next_role set,
   then dropped by an unrelated later heal).
2. **File-mode-only scoping, enforced at the call site, not the predicate**:
   SQLite/HTTP storage DOES persist `pending_notes` (unlike `next_role`,
   which SQLite never persists at all — the existing, accepted asymmetry).
   To avoid silently changing SQLite-mode lease behavior as an unreviewed
   side effect of a file-mode bugfix, the orchestrator call site
   (`tools/handoff-orchestrator.ts` ~line 174) passes `pending_notes` into
   the predicate ONLY when `storage instanceof FileHandoffStorage`; SQLite
   mode's `isFeatureLeaseHeld` inputs stay byte-for-byte what they are today
   (TTL-bounded only, no terminal-marker relief). Extending relief to SQLite
   mode is explicitly deferred — a future ticket's deliberate decision, not
   an accidental one.
3. **Documentation belt**: `content/skill-release-engineer.md` gets a short
   note near SOP steps 12/13 clarifying that the exact triple remains the
   PRIMARY closing-write contract (step 13's read-back still verifies
   `next_role="pm"` verbatim) — the relaxed marker is a safety net for the
   two known incident classes above, not license to deliberately omit
   `next_role`.

This keeps the fix scoped to `gates/feature-lease.ts` (predicate + type),
`tools/handoff-orchestrator.ts` (one call-site scoping change), and
`content/skill-release-engineer.md` (one clarifying note) — matching the
ticket's own "~3 files" estimate — with zero schema bump and zero change to
`next_role`'s existing transient (AC-3) semantics anywhere else in the
codebase (D5 stale-dispatch detection, review_verdict consistency gate, etc.
are untouched).

## User Stories

- As the coordinator starting a new feature, I want the feature lease to
  release immediately once a release-engineer closing write has genuinely
  shipped — even if `next_role` is missing at write time or gets dropped by
  an unrelated later heal — so that I don't wait out a ~30-minute TTL stall
  on a dead lease.
- As a release-engineer, I want the exact closing-write triple to remain the
  contract I'm told to follow, so the relaxed marker reads as a safety net,
  not permission to skip `next_role`.
- As a maintainer, I want SQLite/HTTP-mode lease behavior to stay unchanged
  by this fix, so a file-mode bugfix doesn't silently alter a different
  storage mode's behavior.

## Acceptance Criteria

- **AC1** — Given a release-engineer closing write whose `pending_notes[0]`
  matches `/^Released v/` but `next_role` was never set on that write (first
  occurrence class), when `isFeatureLeaseHeld` evaluates the next feature's
  incoming write in file mode, then it returns `false` (lease released).
  proof: `test/feature-lease.test.mjs` — new case, closing-signature
  `pending_notes` present, `next_role` undefined → `isFeatureLeaseHeld`
  returns `false`.
- **AC2** — Given a release-engineer closing write that correctly carried
  `next_role="pm"` at write time, followed by a simulated migration
  heal-write that drops `next_role` while preserving `pending_notes`
  verbatim (second occurrence class), when `isFeatureLeaseHeld` evaluates
  the post-heal state, then it returns `false` (lease released).
  proof: `test/feature-lease.test.mjs` — new case simulating the post-heal
  shape (no `next_role`, closing-signature `pending_notes` intact) →
  `isFeatureLeaseHeld` returns `false`.
- **AC3** — Given release-engineer's OPENING write (`pending_notes=
  ["release-engineer: starting release for <feature>"]`, no `next_role`),
  when `isFeatureLeaseHeld` evaluates it, then it returns `true` (lease
  held) — the in-flight release window (git commit/tag/push) stays
  protected; the fix must not reopen the D9/D10 race.
  proof: `test/feature-lease.test.mjs` — existing opening-write case plus a
  new explicit regression assertion.
- **AC4** — Given SQLite/HTTP storage mode, when the orchestrator evaluates
  the lease for a release-engineer closing write whose SQLite-persisted
  `pending_notes` would otherwise match the closing signature, then the new
  disjunct MUST NOT be evaluated against SQLite-sourced `pending_notes` —
  the call site passes `pending_notes: undefined` for non-file storage, so
  SQLite-mode lease behavior stays byte-for-byte unchanged (TTL-bounded
  only), matching the existing `next_role` asymmetry.
  proof: `test/feature-lease.test.mjs` — new SQLite-mode orchestrator-path
  test: closing-signature `pending_notes`, no `next_role`, SQLite storage →
  lease still TTL-bounded (held until TTL elapses), unchanged from
  pre-fix behavior.
- **AC5** — Given any release-engineer escalation write (`status="Blocked"`,
  or `next_role` set to something other than `"pm"`, e.g. `"qa-engineer"` /
  `"human"`), when `isFeatureLeaseHeld` evaluates it, then it returns `true`
  (lease held) — escalation `pending_notes` never match `/^Released v/`, so
  the new disjunct never fires for these cases.
  proof: `test/feature-lease.test.mjs` — existing escalation-case
  regressions stay green, plus one new explicit case.
- **AC6** — Given `content/skill-release-engineer.md`, when read at SOP
  steps 12-13, then a clarifying note is present stating (a) the exact
  triple (`last_agent="release-engineer"`, `status="In_Progress"`,
  `next_role="pm"`) remains the PRIMARY closing-write contract, still
  verified by step 13's read-back, and (b) the relaxed marker in
  `gates/feature-lease.ts` is a documented safety net for the two known
  incident classes (AC1, AC2), not license to omit `next_role`.
  proof: grep-based skill-text pinning test in `test/feature-lease.test.mjs`
  (mirrors the existing S1-S7 convention).
- **AC7** (repro-first, bugfix-mode discipline) — Given the bugfix-mode
  repro-first gate, when the fix is authored, then a failing reproduction
  test for AC2's second-occurrence class is recorded (red, against the
  PRE-fix predicate) in `qa_reports/expected-red_e13-terminal-marker-
  advisory.txt` BEFORE the predicate change lands, and turns green after,
  with zero unexplained new reds elsewhere in the suite.
  proof: `qa_reports/expected-red_e13-terminal-marker-advisory.txt` names
  the exact new test id(s); QA confirms red→green turnover at PASS.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no new user-facing strings (internal governance-tooling fix only) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **E10** (feature-lease human-override + non-work write exemptions) —
  sequence-adjacent, same trust surface, but a separate open ticket; not
  folded into this fix.
- **E9A** — out of scope, per intake instructions.
- Extending terminal-marker relief to SQLite/HTTP mode — deliberately
  deferred (AC4 keeps SQLite behavior unchanged); a future ticket's explicit
  decision, not a side effect of this one.
- Changing `next_role`'s fundamental transient/AC-3 semantics anywhere else
  in the codebase (D5 stale-dispatch detection, `review_verdict`
  consistency gate, dispatch-liveness stamping, etc.) — untouched.
- The E8 success-metrics emit signature check
  (`tools/handoff-orchestrator.ts` ~line 965-979) — a separate concern that
  fires synchronously against the just-validated incoming write (not a
  stale `prevState` read later), already made idempotent per E12; not
  touched here.
- Root-causing or fixing the migration-heal mechanism itself (why a read
  during a PM session triggered a schema migration at all) — out of scope;
  this ticket makes the terminal marker resilient to that mechanism's
  documented, by-design behavior, not the mechanism itself.

## Dependencies / Prerequisites

None blocking. Root-cause citations for the second-occurrence class (for the
implementing engineer's reference):
- `tools/handoff.ts` ~line 506-544: `readHandoffState`'s fire-and-forget
  migration heal-write.
- `tools/handoff.ts` ~line 518-523: the heal-write explicitly re-passes
  `pendingNotes: state.pending_notes` (preserved).
- `tools/handoff.ts` ~line 757-759, 987-992: `next_role` (and `resume_of`,
  `review_verdict`) are documented TRANSIENT — any write that omits them,
  including the migration heal-write, drops them by design (AC-3).
- `gates/feature-lease.ts` line 27-29: the existing header comment already
  documents why keying on `last_agent` alone (dropping `next_role` entirely)
  would reopen the D9/D10 race — this spec's Decision section explains why
  the literal backlog option-(b) text is corrected here rather than applied
  verbatim.

Zero external references (no URLs/Figma/tickets) found in the backlog entry
or intake instructions — Resource Audit Gate: no action needed.
