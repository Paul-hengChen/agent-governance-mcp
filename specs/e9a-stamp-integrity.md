# e9a-stamp-integrity

## Problem Statement

`research/e9a-stamp-forensics.md` (2026-07-13, coordinator forensics —
investigation phase, DONE, not repeated here) found 5 hand-authored
`last_updated` stamps across the full `.current/handoff.md` history
(v3.48.0, v3.49.0, v3.72.0, v3.73.1 release-closing writes + one
pre-hardening-era seed), every one of them in the release-close class, none
anywhere else. Every other stamp in history carries millisecond entropy
consistent with `new Date().toISOString()` — i.e. produced by
`tw_update_state` itself.

The forensics converge on a **tool-surface** root cause, not a
rule-compliance failure:

- `content/skill-release-engineer.md` L20 already forbids hand-editing
  `.current/handoff.md`/`tasks.md` under any circumstance (STOP-on-⛔
  rejection rule). The hand-authored stamps are not evidence release-engineer
  ignored that rule when it had a choice — v3.48.0/v3.49.0 (2026-07-08)
  predate C13, when release-engineer had no legal `tw_update_state`
  transition at all, so a hand-edit was the *only* mechanically available way
  to record those releases.
- The live 2026-07-13 (v3.81.0) datapoint is the load-bearing positive
  control: a haiku release-engineer subagent with a Read/Edit/Write/Bash-only
  tool surface (no `tw_*` MCP path) hit exactly this situation post-C13,
  *escalated instead of hand-editing*, and the coordinator relayed the
  closing write via MCP. The release closed with a correct, entropy-stamped
  write and zero hand-edit. This proves the relay pattern works — it is
  currently tribal knowledge (one transcript), not a codified rule.
- Since v3.75.0, every closing write has an entropy stamp — the problem has
  not recurred once *any* sanctioned path (direct MCP or relay) existed and
  was used. Nothing here indicates a live, ongoing risk of recurrence against
  a release-engineer that has direct MCP access; the risk is narrowly
  "a future subagent dispatch with no MCP tool surface, and no codified relay
  rule to fall back on, improvises a hand-edit under time/fatigue pressure the
  way the pre-C13 seeds did."

**Blast radius today**: contained. E1A's negative-age guard
(`gates/feature-lease.ts`) already treats a stamp that cannot establish a
trustworthy non-negative elapsed time as lease-NOT-held (fail-open) — a
mislabeled-offset stamp cannot wedge the feature-lease mechanism. This ticket
is an integrity/audit-trail improvement, not an active-outage fix.

## Decision

Two independent, additive changes — no shared code path, no ordering
dependency between them:

1. **Coordinator-relay codification (primary, content-only).**
   `content/skill-release-engineer.md` gets a new Hard rule (mirroring the
   existing "STOP on ⛔ rejection" / "STOP on push rejection" bullets'
   phrasing convention) stating: when this session's tool surface has no
   MCP tool-invocation path at all (no `tw_*` tools reachable — confirmed
   2026-07-13 with a haiku Read/Edit/Write/Bash-only dispatch), release-engineer
   MUST NOT hand-edit `.current/handoff.md` or `tasks.md` to simulate any
   `tw_update_state` write. Instead it performs every non-MCP release
   mechanic in the SOP normally (fetch/bump/build/test/commit/tag/push/`gh
   release`), and for each write the SOP calls for that it cannot make
   itself (SOP step 2's opening write, step 12's closing write), it states
   the **exact literal `tw_update_state` call** — every argument, verbatim
   values — in its reply to the coordinator, clearly marked (e.g. a
   `RELAY REQUIRED:` prefix), so the coordinator can issue it via MCP. The
   Output rule (`Done. Released <tag>.`) is amended: that line is only
   emitted after either (a) release-engineer's own step-13 read-back
   confirms the write it made directly, or (b) the coordinator confirms back
   that a relayed write landed — never asserted speculatively by a subagent
   that could not itself verify the write happened.

   `templates/claude-code-agents/release-engineer.md` (the dispatch prompt
   that actually configures the subagent's tool surface and persona) gets a
   short paragraph carrying the same rule forward into the dispatch context
   itself, since that file — not the skill SOP — is what a tool-surface-
   limited subagent reads before it ever calls `tw_switch_role`.

   This is the ticket's primary fix per the forensics' own recommendation:
   the problem is tool-surface, and the fix that already worked once
   (2026-07-13) is a relay pattern — codifying it (rather than granting
   release-engineer template-wide MCP access, the forensics' other option)
   keeps today's least-privilege dispatch shape unchanged while closing the
   gap that produced 4 of the 5 confirmed hand-edits.

2. **Server-side stamp-shape advisory (secondary, small code).**
   `tools/drift.ts`'s `detectDrift()` gets a new, purely additive check: a
   regex test on `handoff.last_updated` for the hand-authored shape —
   round-minute/round-hour with zero-millisecond `.000Z`
   (`/T\d{2}:\d{2}:00\.000Z$/`, matching all 5 confirmed forensics hits: the
   regex only requires seconds `00` and ms `000`, which the round-hour and
   round-half-hour hits satisfy as a subset). On a match, the result carries
   a new **top-level field**, `stampAdvisory: string | null` — a plain
   informational string when the shape matches, `null` otherwise. This field
   is *separate from* `driftDetected`/`details` (the existing vibe-coding /
   handoff-ahead drift machinery) — it is never merged into `details`, never
   flips `driftDetected`, and is not consumed by any gate. Advisory-only, by
   design: E1A's negative-age guard already fail-opens on an untrustworthy
   stamp, so this is audit-trail signal, not a new rejection path, and no new
   `GateErrorCode` is introduced.

**Architecture note (in place of a separate ARCH ticket — this is a
small content + small code change with a single non-obvious design decision,
same shape as E7/E13, which shipped without an ARCH ticket):**

- **Field placement**: `stampAdvisory` is added to the existing
  `DriftReport` interface and computed once, right after `handoff` is
  confirmed non-null, then threaded into every return path from that point
  forward in `detectDrift()` (the "no tasks" branch and the main return). The
  two early-return branches that run before a `handoff` object exists
  (version-skew short-circuit, `!handoff && !tasks`, `!handoff`) return
  `stampAdvisory: null` — there is no timestamp to check.
- **No storage-mode scoping needed** (contrast with E13's file-mode-only
  `pending_notes` restriction): `last_updated` is a plain `string` column
  populated by both `HandoffStorage` implementations
  (`tools/handoff.ts`'s file-mode reader and `tools/storage-sqlite.ts`'s
  `parse()`, `storage-sqlite.ts:398`) via the same server-side
  `new Date().toISOString()` write path. This check reads an
  already-universally-populated field — it introduces no new persisted
  state and needs no `instanceof FileHandoffStorage` branch the way E13's
  `pending_notes`-carrying disjunct did. The advisory is equally meaningful
  (and equally inert in practice, since SQLite-mode writes go exclusively
  through `tw_update_state`) in both modes.
- **Why a new field instead of folding into `details`**: `details` entries
  are consumed by existing tests via `assert.deepEqual(report.details, [...])`
  (e.g. `test/drift-baseline.test.mjs`). Folding the advisory into `details`
  would force every existing exact-array test to enumerate it, and would
  make `driftDetected` flip `true` on a control-group entropy-stamped
  handoff that has zero genuine task/handoff drift — an unwanted coupling.
  A new, independent field keeps this a strictly additive change: zero
  behavior change to `driftDetected`, `details`, `tasksCompleted`,
  `tasksIncomplete`, or any gate that reads them.

## User Stories

- As the coordinator, when a tool-surface-limited release-engineer subagent
  cannot call `tw_update_state` directly, I want it to hand me the exact
  payload to relay instead of guessing or hand-editing, so the closing write
  stays server-validated and audit-accurate.
- As a future release-engineer subagent dispatched with a restricted tool
  surface, I want an explicit, discoverable rule telling me what to do when
  I have no MCP path, so I don't have to improvise under time pressure the
  way the pre-C13 hand-edits did.
- As a maintainer auditing `.current/handoff.md` history, I want
  `tw_detect_drift` to flag a stamp shape that could not have come from
  `new Date().toISOString()`, so a future out-of-band edit surfaces on the
  next drift check instead of requiring a manual full-history forensic audit
  like this ticket's own investigation phase.

## Acceptance Criteria

- **AC1** — Given `content/skill-release-engineer.md`, when read for its Hard
  rules and Output rule, then a new rule is present stating: no-MCP-tool-
  surface sessions MUST NOT hand-edit `.current/handoff.md`/`tasks.md` to
  simulate a `tw_update_state` write; instead they perform all non-MCP
  release mechanics normally and state the exact literal `tw_update_state`
  call (all arguments, verbatim values) in the reply to the coordinator,
  marked for relay (e.g. `RELAY REQUIRED:`); and the Output rule is amended
  so `Done. Released <tag>.` is emitted only after a confirmed write
  (own read-back, or coordinator relay confirmation) — never asserted on an
  unverified relay.
  proof: grep-based pinning test in a release-engineer-skill-adjacent test
  file (mirrors the `test/feature-lease.test.mjs` S1-S7 / T-E7-05 skill-text
  pinning convention) asserting the new rule text and the amended Output
  rule text are both present, byte-identifiable.
- **AC2** — Given `templates/claude-code-agents/release-engineer.md`, when
  read, then a paragraph carrying the same no-MCP-path / relay-required rule
  is present in the dispatch template itself (not only the skill SOP it
  later loads via `tw_switch_role`), consistent with `test/subagent-
  templates.test.mjs`'s existing convention of pinning template prose.
  proof: pinning test in `test/subagent-templates.test.mjs` (existing file,
  new case) asserting the relay-rule paragraph is present in
  `templates/claude-code-agents/release-engineer.md`.
- **AC3** — Given a synthetic handoff state whose `last_updated` matches the
  hand-authored shape (e.g. `2026-07-12T01:35:00.000Z` — seconds `00`, ms
  `000`), when `tw_detect_drift` runs, then the JSON result's `stampAdvisory`
  field is a non-null string naming the suspected out-of-band write and
  contrasting it with the server's millisecond-entropy write path — and
  `driftDetected`/`details`/`tasksCompleted`/`tasksIncomplete` are
  byte-identical to what they would be without this change (control:
  removing the advisory computation changes nothing else in the report).
  proof: new case in `test/drift-baseline.test.mjs` or a new
  `test/drift-stamp-advisory.test.mjs` — synthetic round-minute-zero-ms
  `last_updated` → `stampAdvisory` non-null, `driftDetected` unaffected by
  the presence/absence of genuine task drift in the same fixture.
- **AC4** — Given a synthetic handoff state whose `last_updated` carries
  millisecond entropy (e.g. `2026-07-13T03:22:38.181Z`, the shape every
  `tw_update_state`-produced stamp has), when `tw_detect_drift` runs, then
  `stampAdvisory` is `null`.
  proof: same test file as AC3 — entropy-stamp fixture → `stampAdvisory ===
  null`.
- **AC5** — Given the full existing `test/drift-baseline.test.mjs`,
  `test/drift-archived-tasks.test.mjs`, and `test/drift-skew.test.mjs`
  suites (pre-existing `driftDetected`/`details` exact-value assertions),
  when run after this change, then all pass unmodified — the new field is
  additive-only and touches no existing assertion.
  proof: full `npm test` run, 0 unexplained regressions in the three
  existing drift test files.
- **AC6** (repro/verification discipline, feature-mode — no bugfix-mode
  repro-first gate applies since this is a new advisory, not a fix to
  existing broken behavior) — Given both changes (AC1/AC2 content, AC3/AC4/AC5
  code), when QA runs full verification, then `npm run build && npm audit
  --audit-level=high && npm test` all pass with 0 failures, and
  `qa_reports/review_T-E9A-*.md` records the AC-by-AC execution log.
  proof: `qa_reports/review_T-E9A-05.md` (or equivalent QA-ticket-numbered
  filename) with an AC1-AC6 execution log and green build/audit/test output.

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

- **Granting release-engineer template-wide MCP tool access** — the
  forensics named this as an alternative primary fix; explicitly not chosen
  here, to keep today's least-privilege dispatch shape unchanged. A future
  ticket could revisit this tradeoff if the relay pattern proves insufficient
  in practice.
- **Rejecting (vs. flagging) a client-shaped timestamp on `tw_update_state`
  writes** — the original backlog row's other server-side option. Not
  pursued: E1A's negative-age guard already fail-opens on an untrustworthy
  stamp, so a hard rejection would add a new failure mode for zero
  additional safety margin. Advisory-only, per the backlog's own
  recommendation.
- **Extending the no-MCP-path relay rule to any role besides
  release-engineer** — out of scope. The forensics evidence (haiku
  Read/Edit/Write/Bash-only dispatch, 2026-07-13) is release-engineer-
  specific; other roles' dispatch templates are untouched.
- **Reproducing the investigation itself** — already done
  (`research/e9a-stamp-forensics.md`, referenced above, not repeated).
- **A new `GateErrorCode` or any `gates/`/orchestrator wiring** — the
  advisory is a plain informational field on the existing
  `tw_detect_drift` JSON result, not a gate.
- **Backfilling or correcting the 5 historical hand-authored stamps
  themselves** — out of scope; this ticket prevents recurrence and adds
  detection, it does not rewrite history.

## Dependencies / Prerequisites

None blocking. Both changes are independent of every other open backlog
ticket (E5, E6, E14). Root-cause citations for the implementing engineer:

- `content/skill-release-engineer.md` L20 (STOP-on-⛔-rejection Hard rule,
  phrasing convention to mirror), SOP steps 2/12/13 (the two writes a
  no-MCP-path session cannot make directly), and the Output rule line
  (`## Output rule`, near the top).
- `templates/claude-code-agents/release-engineer.md` (the dispatch prompt;
  note it already documents the "no `tw_*` tools" scenario implicitly via
  its Read/Edit/Write/Bash tool grant — this ticket makes the resulting
  obligation explicit).
- `tools/drift.ts` `DriftReport` interface (~line 14-20) and `detectDrift()`
  (~line 165-295) — insertion point is after the `!handoff` early return
  (~line 195-203), threading `stampAdvisory` through the "no tasks" branch
  (~line 205-213) and the main return (~line 283-292).
- `research/e9a-stamp-forensics.md` — full investigation, evidence table,
  and recommended cut (already incorporated above).

Zero external references (no URLs/Figma/tickets) found in the backlog entry
or intake instructions — Resource Audit Gate: no action needed.
