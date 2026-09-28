# e114-cut-approval-inheritance — E114

Ticket: `docs/backlog.md` E114 (execution order `0o`) — Wave 3 of
`docs/v4.0.0-execution-plan.md` ("扇出語意"), lane **L-SCHEMA**, `depends_on: E109`
(framework decision, shipped v3.113.0). Filed 2026-09-14 from H2-b B4 in
`docs/agc-feedback-2026-09-08.md`.

Lane: **L-SCHEMA** primary (`schema/versions.ts`, `schema/migrations-handoff.ts`,
`docs/schema-versions.md`), with a genuinely cross-lane write into **L-STATE**
territory (`tools/handoff-{types,parse,write}.ts`, `tools/registry.ts`'s zod
schema, `tools/handoff-orchestrator.ts`) — see **Dependencies / Prerequisites**
for why this ticket cannot be scoped to L-SCHEMA alone, and why that is named
here rather than discovered mid-build, per
`v4.0.0-execution-plan.md` §3's "一張票的檔案跨越多條 lane 時 —— 拆票，不要硬塞" rule.

## Problem Statement

One human cut approval, given once in the parent coordinator's chat on
2026-09-07, propagated into five `cut_approved: true` self-attestations across
five NDI lane handoffs (an adopter acceptance project, `screen-source-list`, 7 tickets fanned
across 5 workspaces). The coordinator SOP's writer obligation for
`cut_approved` (Constitution §3.1) requires that the human's approval text
appear in the writer's **own** conversation turn, and forbids writing
`cut_approved` from a relayed claim — this is what makes `CUT_APPROVAL_REQUIRED`
unforgeable inside a single workspace. But a lane coordinator that inherits a
git-committed handoff snapshot from a parent feature witnesses nothing; it
inherits a summary (or, in the flat-`.current/` world this ticket ships into,
a stale committed snapshot — see `v4.0.0-execution-plan.md` §2.3's "你的新
worktree 會帶著陳舊的 handoff 出生" note, the exact mechanism this lane itself hit
on `active_feature: e109-workspace-feature-anchoring` before this cut). Filed
against a workspace boundary, not a defect in the gate: the gate is doing
exactly its job (`CUT_APPROVAL_REQUIRED` is unforgeable within one workspace);
it degrades to an honour system only when a *second* workspace's coordinator
copies the attestation across the boundary without a way to say "I did not
witness this — I inherited it."

What is missing is **inheritance semantics**, not a fifth witnessing. A lane
must be able to record "this cut's `cut_approved: true` was inherited from
parent feature X's approval" as a distinct, honest claim from "I personally
witnessed the human approve this cut in my own turn" — preserving the audit
property §3.1 exists to provide instead of quietly voiding it the moment a
feature crosses a workspace boundary.

**待決 #7 (ratified by the human, not reopened here):** bump the handoff schema
to **v14**. Stamp-only migration, in the exact three-line shape of the
v12→v13 step in `schema/migrations-handoff.ts:164-178`. Seed nothing —
absence === non-inherited (the safe direction). Closest precedent: **v5**
(`cut_approved?: boolean`, absence === unapproved — `docs/schema-versions.md`
line 31); closest *mechanical* precedent for an optional, client-settable,
feature-scoped field: the v10→v11 `dispatch_mode` scalar.

## User Stories

- As a lane coordinator whose workspace inherited a parent feature's human cut
  approval (via a git-committed handoff snapshot, a summarized relay, or any
  other cross-workspace channel), I want to record that inheritance honestly
  instead of either (a) falsely claiming I witnessed the approval myself, or
  (b) being forced to block on a re-approval the human already gave, so that
  `cut_approved: true` never appears in a workspace's handoff without an
  accompanying, truthful account of where it came from.
- As a human or auditor reviewing a lane's handoff after the fact, I want to
  distinguish "this workspace's coordinator personally witnessed the approval"
  from "this workspace inherited an approval attested elsewhere," so that a
  post-hoc audit of the NDI five-lane incident (or its successors) does not
  have to take every `cut_approved: true` at equal evidentiary weight.
- As the next reader of `docs/schema-versions.md`, I want the "Handoff version
  history" table to actually list every version the running server implements,
  so that a ticket's "N precedents" citation is not built on a stale table
  (E114's own filing cited "8 precedents" off a table that stops at v12 while
  `CURRENT_VERSIONS.handoff` was already 13).

## Acceptance Criteria

- **AC1** — Given a fresh handoff at schema v13, when the v13→v14 migration
  runs, then the payload's `schema_version` becomes `14` and no other field is
  added, changed, or removed (stamp-only, no seed).
  proof: `test/e114-cut-approval-inheritance.test.mjs` migration case (see
  T-E114-03).
- **AC2** — Given a handoff with no `cut_approved_source` field (a pre-E114
  payload, or any write that never set it), when it is read back through
  `parseHandoff`/`readHandoffState`, then `cut_approved_source` is `undefined`
  — absence reads as "non-inherited," never as a false negative "not
  approved" or false positive "inherited."
  proof: `test/e114-cut-approval-inheritance.test.mjs` absence-default case.
- **AC3** — Given a `tw_update_state` call passing
  `cut_approved_source: "inherited:<feature>"` with `<feature>` naming the
  parent feature the approval came from, when the write is accepted, then the
  handoff's frontmatter carries `cut_approved_source: inherited:<feature>`
  verbatim, and a subsequent `tw_get_state` on the same workspace returns it
  unchanged.
  proof: round-trip write/read case in `test/e114-cut-approval-inheritance.test.mjs`.
- **AC4** — Given a `tw_update_state` call passing a malformed
  `cut_approved_source` (missing the `inherited:` prefix, or an empty feature
  suffix), when the write is processed, then the field is dropped defensively
  at parse time (mirrors `dispatch_mode`'s defensive enum-filtering posture) —
  it MUST NOT throw, and MUST NOT silently pass through a value the field's own
  shape forbids.
  proof: malformed-value case in `test/e114-cut-approval-inheritance.test.mjs`.
- **AC5** — Given a workspace whose `cut_approved_source` was set on a prior
  write within the same `active_feature`, when a later write in the same
  feature omits the field, then the value is carried forward verbatim (the
  `dispatch_mode` scalar algorithm: feature-scoped, no PM-re-entry re-arm).
  Given the same workspace's `active_feature` then changes, when the next
  write lands, then `cut_approved_source` is dropped (undefined), even if the
  write omits it — a new feature starts with no inherited-approval claim
  unless the writer states one.
  proof: carry-forward + drop-on-feature-change case in
  `test/e114-cut-approval-inheritance.test.mjs` (mirrors the existing
  `dispatch_mode` carry-forward tests in `test/dispatch-pins.test.mjs`).
- **AC6** — Given the `tw_update_state` zod input schema, when
  `cut_approved_source` is supplied, then it is accepted as a client-settable
  string argument (NOT server-stamped, NOT rejected at the boundary) —
  distinguishing this field from `evidence_schema` (server-stamped, no client
  arg, AC6-1 in `test/e23-evidence-schema.test.mjs`).
  proof: zod-schema-accepts case in `test/e114-cut-approval-inheritance.test.mjs`.
- **AC7** — Given `docs/schema-versions.md`'s "Handoff version history" table,
  when this ticket ships, then the table contains BOTH a **v13** row (the
  `evidence_schema` pin, e23-evidence-schema-versioning — missing today even
  though `CURRENT_VERSIONS.handoff` has been 13 since that ticket shipped) and
  a **v14** row (this ticket), in the same format as the existing v2–v12 rows.
  proof: `grep -c '^| v13 ' docs/schema-versions.md` and
  `grep -c '^| v14 ' docs/schema-versions.md` each print `1`.
- **AC8** — Given the nine test files enumerated in **Dependencies /
  Prerequisites** below, when this ticket's qa-engineer task completes, then
  every hard-coded `13`/`v13` constant-assertion in those files that pins
  `CURRENT_VERSIONS.handoff` (or a payload's resulting `schema_version` after
  a full migration chain) is re-baselined to `14`/`v14`, with **zero**
  semantic change to any other ticket's assertion in those files.
  proof: full suite green (`npm test`) at the new baseline count; qa's
  evidence file names the exact lines changed per file.
- **AC9** — Given the `CUT_APPROVAL_REQUIRED` gate and every other gate in
  `gates/registry.ts`, when this ticket ships, then no gate predicate reads
  `cut_approved_source` — it is recording-only in this ticket (see **Out of
  Scope**).
  proof: `grep -rn "cut_approved_source" gates/` prints nothing.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| schema-versions.v13-row | (full row text — see **Dependencies / Prerequisites**, "The v13 row this ticket also owes") | authored-here — derived verbatim from `schema/migrations-handoff.ts:164-178`'s existing code comment, matching the v2–v12 row style already in the table |
| schema-versions.v14-row | (full row text — see **Dependencies / Prerequisites**, "The v14 row") | authored-here — this ticket's own decision record, matching the v2–v12 row style |
| registry.cut_approved_source-description | "Cut-approval inheritance attestation (handoff schema v14, e114-cut-approval-inheritance). Client-settable: the writer's own honest claim that this workspace's `cut_approved: true` was NOT witnessed in this workspace's own conversation turn but inherited from a parent feature's human approval. Shape: `inherited:<parent-feature>` — malformed values (missing prefix, empty feature name) are dropped defensively at parse time, never rejected at the boundary. Does NOT satisfy `CUT_APPROVAL_REQUIRED` or any other gate by itself — recording-only (see spec Out of Scope). Feature-scoped: preserved across same-feature writes that omit it (the `dispatch_mode` scalar algorithm), dropped on `active_feature` change, NOT re-armed on PM re-entry. Absence === non-inherited (the safe direction)." | authored-here — mirrors the `dispatch_mode` / `dispatch_pins` JSON-Schema description style at `tools/registry.ts:645-649` |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (server-side schema/field work, no UI) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Field Design Decisions (the genuinely open questions this ticket had to settle)

**1. Field name and shape: `cut_approved_source: "inherited:<feature>"`, not
`lane_of: <parent_feature>`.**

Chosen because the audit property at stake is about the **approval's
provenance**, not the **lane's topology**. A `lane_of` field would answer "what
feature is this worktree structurally descended from" — a fact about how the
worktree was created (which base commit it forked from), not about which
human decision covers this cut. Those two facts can diverge: a lane can be
structurally descended from feature X's worktree yet need its OWN fresh
`cut_approved` (its ticket cut is materially different from X's and was never
covered by X's approval), or a lane can need to claim inheritance from a
feature it is not structurally "of" at all (e.g. a re-approval given in a
side conversation, relayed by the coordinator, that names a different
feature than the one the worktree forked from). Naming the field after the
attestation it modifies (`cut_approved` → `cut_approved_source`) keeps the
claim scoped to exactly what it is evidence for, and matches this server's own
naming convention: `scope_decision` → `scope_decision_why` is the existing
precedent for "a companion field carrying provenance/rationale for an
existing attestation," not a new structural concept.

**2. Client-settable, not server-stamped.**

`evidence_schema` is server-stamped with no client arg (E23 D1, pinned by
`test/e23-evidence-schema.test.mjs` AC6-1) because it records a fact the
server itself computes (which evidence-heading convention was current at
dispatch time) — the client cannot get this right by construction, so letting
it set the value would open a forgery surface identical to the one E23 closed.
`cut_approved_source` is the opposite case: it is an attestation **by the
writer**, exactly like `cut_approved` itself and `scope_decision_why` — the
server has no independent way to know which parent feature's approval a lane
is claiming to have inherited (it cannot see across workspaces; that is the
entire premise of this ticket). If the server stamped this field, it would be
stamping a claim it cannot verify, which is worse than an honest
client-supplied claim that at least names a real accountable writer. So:
zod-arg on `tw_update_state`, JSON-Schema description on the hand-written
schema, following the `dispatch_mode` precedent exactly (`tools/registry.ts:281-291`
and `:645-649`).

**3. Carry-forward semantics: the `dispatch_mode` scalar algorithm, not
`cut_approved`'s PM-re-entry reset.**

`cut_approved` resets to `undefined` on every PM `In_Progress` re-entry
(`tools/handoff-write.ts:415-419`) because re-arming forces re-approval —
correct for a boolean whose absence BLOCKS a gate and whose safety property is
"never let a stale approval cover new scope." `dispatch_mode` instead carries
forward across same-feature writes with no PM-re-entry re-arm, because a
bug-vs-feature classification is a **stable fact about the ticket for the
life of the feature**, not a per-cut approval that must be re-witnessed every
time a PM bounces a QA FAIL back to `In_Progress`.

`cut_approved_source` is the `dispatch_mode` shape, not the `cut_approved`
shape: whether this workspace inherited its approval from a parent feature is
a stable fact about *how this lane came to exist*, established once, at the
first write that records it. A PM re-entry mid-feature (e.g. after a review
round) does not change the answer to "did this lane witness its own
approval or inherit one" — re-arming it on every PM re-entry would force the
lane to either re-state the same claim on every bounce (pure noise) or,
worse, silently lose the claim and let a subsequent write look like a fresh,
unaccompanied `cut_approved: true` (exactly the audit gap this ticket exists
to close). Feature-scoped, dropped on `active_feature` change (a new feature
in the same workspace starts with no inheritance claim of its own — the exact
mechanic this dispatching lane itself is watching happen to `dispatch_pins`
on its own `active_feature` flip from `e109-workspace-feature-anchoring` to
`e114-cut-approval-inheritance`), not re-armed on PM re-entry.

**4. The `CUT_APPROVAL_REQUIRED` gate does NOT read this field in this
ticket.**

Recorded per the human's steer, and independently argued here: landing the
recording semantics is this ticket's whole deliverable. Teaching
`CUT_APPROVAL_REQUIRED` (or any gate) to treat `cut_approved_source` as an
alternate satisfaction path is a second, separate design question — it needs
its own threat-model pass (does an inherited-approval claim satisfy the gate
unconditionally, or only when the named parent feature itself shows a
witnessed `cut_approved: true` on record somewhere the gate can actually
read — which, across workspace boundaries, it structurally cannot, per this
ticket's own Problem Statement). Folding that into this cut would silently
widen it from "make the honest claim expressible" to "decide when the honest
claim is sufficient," and the second question is exactly the kind of
cross-workspace trust decision that produced the NDI incident in the first
place. AC9 pins the boundary: no gate predicate reads the field.

## Out of Scope

- Any change to `CUT_APPROVAL_REQUIRED` or any other gate predicate's
  behavior (decision 4 above; AC9).
- Coordinator-SOP / `content/*.md` prose instructing any role to actually SET
  `cut_approved_source` — **forbidden in this lane** (`content/` is
  L-CONTENT-exclusive per `v4.0.0-execution-plan.md` §2.1; a parallel session
  owns it entirely for Wave 2.5/3 content work). See **Dependencies /
  Prerequisites**, "Field is inert without follow-on prose," for the
  follow-up ticket this files instead of writing the prose here.
- `scripts/verify-release.mjs` (Wave 2.5's lane; do not touch).
- Any part of E112 / E113 / E115 / E116 (Wave 3's other five lanes).
- Re-litigating 待決 #7 (schema-bump-or-not) — already ratified by the human;
  this spec implements the ruling, it does not re-derive it.
- A `witnessed:<...>` or any other `cut_approved_source` value shape beyond
  `inherited:<feature>` — out of scope until a concrete second use case
  exists; the parser (AC4) rejects anything that does not match the one
  shape this ticket defines, so adding a second shape later is additive, not
  a breaking change.

## Dependencies / Prerequisites

**This ticket's files do not fit in the L-SCHEMA lane alone — named here, not
discovered mid-build.** Per `v4.0.0-execution-plan.md` §3, `schema/versions.ts`
and `schema/migrations-*.ts` are L-SCHEMA's exclusive files, but
`tools/handoff-types.ts`, `tools/handoff-parse.ts`, `tools/handoff-write.ts`,
`tools/registry.ts`'s zod schema, and `tools/handoff-orchestrator.ts` are
explicitly L-STATE's exclusive files (same table, same section) — and the
`dispatch_mode` / `evidence_schema` precedents this spec follows both show
that a new handoff field is inert without touching every one of those five
L-STATE files (type + parse + write + zod-arg + orchestrator threading), on
top of the L-SCHEMA-owned version bump and migration. The plan itself names
this exact failure mode as a standing rule (§3, "一張票的檔案跨越多條 lane 時 ——
拆票，不要硬塞"): "指派前先問「這張票的所有檔案，裝得進那一條 lane 嗎？」裝不進 →
按 lane 拆成兩半，並在票面明寫哪一半歸誰."

Resolution taken here: the cut below splits T-E114-01 (L-SCHEMA: version bump,
migration, `docs/schema-versions.md`) from T-E114-02 (the L-STATE-owned wiring:
type, parse, write, zod arg, orchestrator threading), and **names T-E114-02 as
a cross-lane write that must coordinate with whoever is running Wave 3's
L-STATE lane** — which in this same wave is **E116** (`tools/handoff-write.ts`,
"worktree 重用永久摧毀前一張票的 ledger," per `v4.0.0-execution-plan.md` line 541).
Both tickets touch `tools/handoff-write.ts` in the same wave; the plan already
sets a precedent for exactly this shape of collision between E132 (L-LANEREG)
and E116 (L-STATE) on a different line of the same file ("兩條 lane 必須就那一行
協調") — this is the same class of conflict, one E114-specific instance the
plan did not itself flag. **Recommendation for the coordinator**: either
sequence T-E114-02 to land after E116's `handoff-write.ts` changes merge (E116
is the wave's actual L-STATE owner), or run both against the same base and
reconcile the two additive `if (...NeedsExisting)` carry-forward blocks by
hand at merge time — they are structurally independent additions (each field
gets its own guarded block, mirroring how `dispatch_mode` and
`evidence_schema` sit side-by-side today) and should not textually collide,
but the human/coordinator should confirm before either lane merges, not
after.

**Missing `docs/schema-versions.md` row, discovered while tracing this
ticket's own precedent citation.** The "Handoff version history" table
(`docs/schema-versions.md` lines 24-38) stops at v12, but
`CURRENT_VERSIONS.handoff` has been `13` since e23-evidence-schema-versioning
shipped (schema/migrations-handoff.ts:164-178). E114's own backlog filing
cites "8 precedents" off that stale table (a table that, correctly counted,
already had a 9th at the time of filing). This ticket's cut MUST add BOTH the
missing v13 row and the new v14 row — shipping v14 while v13 stays absent
would widen the same gap it is fixing. Drafted row text (derived from the
migration's own code comment, matching the existing table's style, for
sr-engineer to use verbatim or refine):

> `| v13 | adds optional `evidence_schema?: number` pin (e23-evidence-schema-versioning D1) — server-stamped, NEVER client-supplied: the orchestrator stamps `EVIDENCE_SCHEMA_CURRENT` on the first accepted write of a new `active_feature`; pins which evidence-heading-match convention (v1 exact-anchored H2, v2 normalized-contains) the `qa_reports/*.md` gate predicates run under for the life of the feature, so a mid-flight tightening of the conventions can never retroactively invalidate crash-era artifacts (the 104447-F0 incident class); feature-scoped carry-forward (the `dispatch_mode` scalar algorithm), NO PM-re-entry re-arm, file-mode-only | v12→v13 stamp-only, seeds nothing — **absence === pre-E23 feature, gets the v2 normalized-contains default at the gates** (D2 fallback: v2 is a strict superset of v1, an absent pin can only newly ACCEPT, never newly reject); seeding `EVIDENCE_SCHEMA_CURRENT` would fabricate a dispatch-time attestation the feature never received. Mirrors the v9→v10 / v10→v11 stamp-only template. |`
>
> `| v14 | adds optional `cut_approved_source?: string` provenance attestation (e114-cut-approval-inheritance) — client-settable companion to `cut_approved`: the writer records `"inherited:<parent-feature>"` when this workspace's `cut_approved: true` was NOT witnessed in this workspace's own conversation turn but carried forward from a parent feature's human approval; preserves the audit property `cut_approved` exists to provide instead of quietly voiding it across workspace/lane boundaries. Feature-scoped carry-forward (the `dispatch_mode` scalar algorithm, NOT `cut_approved`'s PM-re-entry re-arm — inheritance is a stable fact about the lane, not a per-cut approval), NO PM-re-entry re-arm, file-mode-only. Recording-only: does NOT satisfy `CUT_APPROVAL_REQUIRED` or any other gate by itself (out of scope — see spec) | v13→v14 stamp-only, seeds nothing — **absence === non-inherited** (the safe direction: an old handoff with no such field must never be read as claiming inheritance); closest precedent v4→v5 (`cut_approved`), closest mechanical precedent v10→v11 (`dispatch_mode`). |`

**Nine-file mechanical re-baseline, named as qa-engineer's task, not
discovered mid-build.** A bump to v14 forces a mechanical re-baseline of
hard-coded `13`/`v13` constants pinning `CURRENT_VERSIONS.handoff` (or a full
migration chain's resulting `schema_version`) in nine existing test files,
verified present in the tree at time of writing:
`test/schema-versions.test.mjs`, `test/cut-approval-gate.test.mjs`,
`test/dispatch-pins.test.mjs`, `test/e23-evidence-schema.test.mjs`,
`test/success-metrics.test.mjs`, `test/handoff-migration.test.mjs`,
`test/repro-first-gate.test.mjs`, `test/e22-stale-notify.test.mjs`,
`test/skill-evolution-v3.11.test.mjs`. Every prior schema bump did exactly
this (each of those files carries comments naming the bumping ticket, e.g.
"e23-evidence-schema-versioning re-baseline") — established practice, not
scope creep. It is a **constants re-baseline only**: no semantic change to
any other ticket's assertion is permitted (AC8). Assigned to T-E114-03
(qa-engineer) below — named in the cut, not discovered mid-build.

**Field is inert without follow-on coordinator-SOP prose — a follow-up
ticket is required, and is NOT written in this lane.** A field nobody is
instructed to set is decorative: nothing in this ticket teaches any
coordinator or lane-PM to actually write `cut_approved_source` when it
applies, or to know that recording it does NOT itself satisfy
`CUT_APPROVAL_REQUIRED` (decision 4 above — that boundary needs to be stated
in prose too, or a future reader will reasonably assume setting the field is
sufficient). That prose lives in `content/coord-*.md` (most likely
`coord-03-core-fallback.md`'s Feature-Scope Gate paragraph, the same site
E109 just amended for the workspace/feature anchoring statement, and/or
`content/skill-pm.md`'s Cut-Approval Gate row) — **forbidden in this lane**
per the hard boundary above. Filed as `L-SCHEMA-NEW-1` in this lane's
`NEW-TICKETS.md`, with a drafted `docs/backlog.md` row proposed there for the
coordinator to promote and sequence. Per
`v4.0.0-execution-plan.md` §2.4's default ("被提升成正式票的執行中發現，一律排在
v4.0.0 發版之後，除非它擋住某個尚未完成的波次"), this spec's position is that the
follow-up does **not** block any remaining v4.0.0 wave (nothing in Wave 3-8
depends on the prose existing) and should default to the post-v4 queue
(`docs/v4.0.0-new-tickets.md`) rather than being inserted into Wave 3's
already-occupied L-CONTENT slot (E113) or Wave 2.5's L-CONTENT slot (E149) —
but this ticket's own dispatch prompt named "sequenced into Wave 3's
L-CONTENT lane" as a candidate, so the sequencing call is flagged here for
the human/coordinator to make explicitly rather than defaulted silently
either way.

**External references.** None found by grep (`http(s)://`, `figma`,
`design`, `Azure DevOps`, `JIRA`, etc.) in the source material for this
ticket (backlog E114 row, execution-plan §7/§8, dispatch prompt). Resource
Audit Gate: zero hits, field omitted (non-blocking) per PM SOP.
