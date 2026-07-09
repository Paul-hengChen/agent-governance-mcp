# Spec: c8-crash-resume-protocol

Source: `docs/backlog.md` §C8 — "No crash-resume protocol; resume drops the dispatch-time model pin"
(P2, observed 2026-07-08).
Design mode: `no-design` — pure SOP governance text. No server, schema, or test-runner changes.
Related-but-separate: backlog C9 (promoting `pending_notes` tokens to first-class handoff fields)
is a distinct future ticket. This spec deliberately keeps `dispatch_pins` a **note convention**,
not a schema field — do not bump `schema_version` or touch `tools/handoff.ts` for this ticket.

---

## Problem Statement

When a role subagent dies mid-task without making its own §3 failure-state write (e.g. killed by a
session/usage limit), two things go wrong at once: (1) the chain has no failure record — the
coordinator only discovers the death indirectly (a tool-error, an empty reply, or a host/user
report) — and (2) the resume path, driven by an improvised `git status` + transcript read, silently
drops any dispatch-time override the coordinator had applied, most concretely a human-directed
`model` pin (e.g. "pin sr-engineer to fable" for this feature). The resumed role comes back on its
frontmatter default tier instead, which is a silent violation of a human directive that no existing
gate catches — the watermark check only verifies the reply's stamped tier against the role's
*frontmatter* default, so a pin that never took effect passes validation cleanly. This spec gives
`skill-coordinator.md` an explicit resume protocol and a `pending_notes` convention
(`dispatch_pins`) so a pin survives the coordinator's own context loss, not just the resumed role's.

---

## User Stories

- As a human who pinned a role to a specific model tier for this feature (e.g. `fable` for
  `sr-engineer`), I want that pin to survive an externally-killed subagent and its resume, so that
  my directive isn't silently dropped by an improvised recovery.
- As a coordinator resuming a role that died mid-task, I want an explicit ground-truth step before
  I trust anything the dead role claimed, so that I don't resume from a false "done" and skip real
  work, or redo work that was in fact already committed.
- As a coordinator handing a resumed role its brief, I want to restate what I actually verified
  (not what the dead role's transcript said), so the resumed role starts from reality.

---

## Acceptance Criteria

### AC-1 — `dispatch_pins` recorded at dispatch time, before the `Task` call

**Given** the coordinator is about to dispatch or re-dispatch a role via
`Task(subagent_type=<role>, …)` with a non-default `model` override (a human-directed pin),
**When** it issues that `Task` call,
**Then** it MUST first persist a `dispatch_pins: <role>=<model>` line into the CURRENT handoff
`pending_notes` via a same-tuple `tw_update_state` amendment (same `agent_id`/`status` already on
record — not a role transition; same pattern as the existing Cut-approval gate writer obligation)
BEFORE calling `Task`. Because `pending_notes` is a full-replace field, the write MUST include every
other note line already present, plus the new/updated `dispatch_pins` line (one entry per pinned
role; updating a role's pin replaces only that role's segment).

**Testable**: `content/skill-coordinator.md`'s Auto-Routing section states the persist-before-dispatch
requirement, the exact `dispatch_pins: <role>=<model>` note format, and the full-replace caveat.

### AC-2 — pinned-tier expectation in watermark validation

**Given** a `dispatch_pins: <role>=<model>` entry exists in `pending_notes` for a dispatched role,
**When** the coordinator runs Subagent Reply Watermark Validation on that role's reply,
**Then** the expected `<tier>` for the match MUST be the pin, not the role's `~/.claude/agents/<role>.md`
frontmatter default. A reply stamped with the frontmatter-default tier despite an active pin is a
**mismatch** (the pin silently failed to take effect), not a pass — the existing correction strategy
(append the canonical suffix) still applies to fix the *string*, but does not fix which model actually
executed; that fact must be surfaced, not silently patched over.

**Testable**: `content/skill-coordinator.md`'s Subagent Reply Watermark Validation section states this
pinned-tier precedence rule.

### AC-3 — Crash-Resume Protocol (ground-truth → restate → re-assert)

**Given** a dispatched role subagent dies (tool-error, empty/truncated reply, or a host/user-reported
kill) before making its own `tw_update_state` write (handoff `agent_id`/`status` unchanged since
dispatch),
**When** the coordinator is about to resume or re-dispatch that role,
**Then** it MUST run, in this order:
1. **Ground-truth the working tree** — before trusting anything the dead role claimed (its last
   `pending_notes`, transcript text, or `tasks.md` checkbox state), verify independently via
   `git status`, `git diff`, `git log -1`, and re-reading the specific target files. Treat any claim
   not independently verifiable from the tree as **not done**, regardless of transcript confidence.
2. **Restate findings in the resume brief** — the prompt handed to the resumed/re-dispatched role
   (via `Task(...)` or the `tw_switch_role` fallback) MUST explicitly state what step 1 found: which
   claimed changes are verified present, which are verified absent, and which task(s) remain open.
   The resumed role must not be left to re-derive this from a stale transcript.
3. **Re-assert dispatch-time overrides and verify they're honored** — read `pending_notes` for a
   `dispatch_pins` entry covering the role being resumed; if present, pass that same `model` override
   on the resume dispatch call, then re-run Subagent Reply Watermark Validation against the **pin**
   (per AC-2) once the resumed role replies.

**Testable**: `content/skill-coordinator.md` contains a `## Crash-Resume Protocol` section with these
three steps, numbered, in this order.

### AC-4 — Crash-detection escalation row

**Given** a dispatched `Task` call returns a tool-error or empty/truncated reply, or the host/user
reports the subagent was killed, and the handoff `agent_id`/`status` is unchanged since that
dispatch,
**When** the coordinator's Auto-Routing/Escalation logic evaluates stop conditions,
**Then** a dedicated `## Escalation Routes` row fires that routes to the Crash-Resume Protocol
(AC-3) — explicitly NOT a direct resume — before any re-dispatch happens.

**Testable**: the `## Escalation Routes` table in `content/skill-coordinator.md` contains a "Crash
detection" row whose "DO" action points at the Crash-Resume Protocol section.

### AC-5 — `skill-coordinator-lite.md` is explicitly out of scope

**Given** `coordinator-lite` is single-shot by SOP (step 3: scope creep → STOP and recommend
`/teamwork`, "don't simulate the chain"), is server-read-only (no `tw_update_state`/`pending_notes`
writes per its Hard rules), and never runs a multi-hop chain that a role could die mid-way through,
**When** this feature's changes are scoped,
**Then** `content/skill-coordinator-lite.md` receives NO changes — the crash-resume protocol and the
`dispatch_pins` convention both require persisted routing state and a multi-hop chain, neither of
which lite has.

**Testable**: this spec's Out of Scope section states the lite exclusion rationale; the shipped diff
touches no line of `content/skill-coordinator-lite.md`.

---

## Copy / Strings

No user-facing strings — this feature modifies internal SOP governance text only.

| string id | exact text | source |
|---|---|---|
| N/A | — | feature introduces no user-facing strings |

---

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | feature introduces no visual tokens |

---

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

---

## Out of Scope

- `content/skill-coordinator-lite.md` — see AC-5; structurally inapplicable (no chain, no state
  writes, no dispatch-time pins to lose).
- Promoting `dispatch_pins` (or `next_role`/`resume_of`) to a first-class `handoff.md` schema field
  — that is backlog C9, a distinct future ticket. This spec keeps `dispatch_pins` a `pending_notes`
  string convention, matching the existing `next_role:` / `resume_of:` pattern.
- Server-side enforcement of crash detection or pin re-assertion — this is content-only (agent SOP
  text). No changes to `tools/transitions.ts`, `tools/handoff.ts`, `guards/`, or any `.ts` file.
- Any change to `lib/watermark-check.ts` or its compiled `dist/lib/watermark-check.js` — AC-2's
  pinned-tier expectation is an instruction to the coordinator about which tier string to compare
  against when it calls the existing `validateWatermark(reply, name, tier)`; the util's signature and
  behavior are unchanged (the coordinator simply passes the pin as `tier` instead of the frontmatter
  default when a pin is active).
- Retroactive repair of the C8 incident itself (the `sr-engineer` session that already lost its
  `fable` pin) — this spec is prevention-only, going forward.

---

## Dependencies / Prerequisites

- Constitution §3 core standard: "On crash/failure, still call `tw_update_state` with the failure
  summary in `pending_notes`" — this spec's Crash-Resume Protocol is the coordinator-side complement
  for the case where that call never happens (the role is dead, not merely failing).
- Constitution §3.1 (Cut-approval gate writer obligation precedent in `skill-coordinator.md`): the
  "same-tuple amendment" pattern (writing `tw_update_state` with the SAME `agent_id`/`status` already
  on record, adding a field, without triggering a role transition) is the mechanism AC-1 reuses for
  persisting `dispatch_pins` before dispatch.
- Backlog C9 (pending_notes → first-class fields): explicitly NOT a prerequisite and NOT touched here
  — see Out of Scope. C8 must ship using the note-convention approach only.
- Resource Audit Gate (Constitution §7): zero hits — `docs/backlog.md` §C8 is an internal repo
  pointer, not a URL/Figma/ticket external reference; no `external_refs` ledger entry required.
- `scope_decision`: `single-feature` — one file (`content/skill-coordinator.md`), four additive text
  sections, no schema/server change. No split warranted.

---

## Tasks

Tasks are registered via `tw_add_task` (see ticket-cut table in the PM's final reply). Each task is
scoped to a single, independently-gradable text addition in `content/skill-coordinator.md`, ordered
so later tasks may cross-reference text landed by earlier ones (see `depends_on`).

### Exact text additions (binding on sr-engineer)

#### T-C8-01 — Auto-Routing: `dispatch_pins` convention

Insert a new paragraph in `content/skill-coordinator.md`'s `## Auto-Routing` section, immediately
after the existing **Subagent Dispatch (Claude Code)** paragraph (which currently ends "...NOT the
routing chain itself.") and before the **Fallback (`tw_switch_role`)** paragraph:

```
**Dispatch-time overrides (`dispatch_pins`)** — when dispatching (or re-dispatching) a role with a
non-default `model` override (e.g. a human directive to pin `sr-engineer` to `fable` for this
feature, overriding its `~/.claude/agents/<role>.md` frontmatter default), you MUST persist the pin
BEFORE calling `Task(subagent_type=<role>, model=<pin>, …)`: call `tw_update_state` on the CURRENT
handoff tuple (same `agent_id`/`status` already on record — a same-tuple amendment, not a role
transition; same pattern as the Cut-approval gate writer obligation below) with `pending_notes` set
to every existing note PLUS one line `dispatch_pins: <role>=<model>` (one entry per pinned role;
re-pinning a role replaces only that role's segment, other notes and other roles' pins survive).
`pending_notes` is replaced wholesale on every write — carry every note you still want kept. This is
a note-convention, not a schema field (backlog C9 covers promoting these tokens to first-class
fields — out of scope here). The pin now survives context loss: any future coordinator instance
reading `handoff.md` recovers the override from `pending_notes` alone, with no dependence on the
dispatching session's own memory.
```

#### T-C8-02 — Subagent Reply Watermark Validation: pinned-tier expectation

Append a new paragraph to `content/skill-coordinator.md`'s `## Subagent Reply Watermark Validation`
section, immediately after the existing paragraph that begins "The leading character MUST be
U+2014..." and before the **Correction strategy** paragraph:

```
**Pinned-tier expectation** — if `pending_notes` carries a `dispatch_pins: <role>=<model>` entry for
the dispatched role, the expected `<tier>` for this match is the PIN, not the role's frontmatter
default. A reply stamped with the frontmatter-default tier while a pin is active is a MISMATCH (the
pin silently failed to take effect), not a pass — apply the Correction strategy below to fix the
stamped string, but also surface in your relay that the pin did not take effect; a corrected
watermark string does not mean the pinned model actually executed.
```

#### T-C8-03 — new `## Crash-Resume Protocol` section

Insert a new `## Crash-Resume Protocol` section in `content/skill-coordinator.md`, immediately after
`## Escalation Routes`'s closing **Cut-approval gate writer obligation** paragraph and before
`## Subagent Reply Watermark Validation`:

```
## Crash-Resume Protocol<!-- origin:start --> (v3.53.0)<!-- origin:end -->

Constitution §3 requires "on crash/failure, still call `tw_update_state` with the failure summary" —
but an externally-killed subagent (session/usage-limit kill, host crash) cannot honor that; it dies
mid-task with NO failure record. The **Crash detection** row in Escalation Routes above routes here.
Run this protocol BEFORE any re-dispatch or resume — do NOT improvise a resume from transcript alone;
that is how a dispatch-time `model` pin silently degrades back to frontmatter default.

1. **Ground-truth the working tree.** Before trusting anything the dead role claimed (its last
   `pending_notes`, transcript text, or `tasks.md` checkbox state), verify independently: `git
   status`, `git diff`, `git log -1`, and re-read the specific target files against the claims — did
   the files it said it touched actually change? Did the tests it said it added exist? Treat any
   claim you cannot verify from the tree as **not done**, regardless of transcript confidence.
2. **Restate findings in the resume brief.** The prompt handed to the resumed/re-dispatched role (via
   `Task(subagent_type=<role>, …)` or the `tw_switch_role` fallback) MUST explicitly state what step 1
   found: which claimed changes are verified present, which are verified absent, and which task(s)
   therefore remain open. Do not let the resumed role re-derive this from a stale transcript — hand
   it the ground-truth summary directly so it resumes from reality, not from the dead role's last
   (possibly false) claim.
3. **Re-assert dispatch-time overrides and verify they're honored.** Read `pending_notes` for a
   `dispatch_pins: <role>=<model>` entry covering the role being resumed. If present, pass that SAME
   `model` override on the resume `Task(...)` call — do not fall back to frontmatter default just
   because the crash lost session memory; the pin lives in `pending_notes`, not in your context.
   After the resumed role replies, run Subagent Reply Watermark Validation as usual, but check the
   tier against the pin per the Pinned-tier expectation below, not the frontmatter default.
```

#### T-C8-04 — Escalation Routes: Crash detection row

Insert a new row into `content/skill-coordinator.md`'s `## Escalation Routes` table, immediately
after the `hop counter ≥ 10` row and before the `Cut-approval gate` row:

```
| **Crash detection** — a dispatched `Task(subagent_type=<role>, …)` call returns a tool-error or empty/truncated reply, or the host/user reports the subagent was killed (session or usage-limit kill), BEFORE that role's own `tw_update_state` landed (handoff `agent_id`/`status` unchanged since dispatch) | — | do not resume or re-dispatch directly — run the Crash-Resume Protocol first, then resume | (role being resumed) |
```
