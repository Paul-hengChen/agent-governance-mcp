# Spec: PM Amend-Resume Routing (Transitions Repair Edge)

> Backlog: `docs/backlog.md` **C1** (P1, observed 2026-07-07).
> v1.0 — authored 2026-07-07 by @pm

## Problem Statement

`ALLOWED_TRANSITIONS` (`tools/transitions.ts`) models the ideal forward flow
of the routing chain only. Real development has sanctioned backtracking: a
downstream role (sr-engineer, code-reviewer, or qa-engineer) can raise a
legitimate flag that only PM can resolve (a spec gap, e.g. the §7 Test
Impact table), without any actual code defect. PM re-enters
`pm:In_Progress` to amend the spec — an edge that already exists from every
downstream `In_Progress`/`FAIL` state — but once PM is done, there is no
edge from `pm:In_Progress` back to whichever role was stranded mid-chain
(only `architect`, `sr-engineer`, `researcher`, `design-auditor`, and `pm`
itself are reachable from `pm:In_Progress`). If the stranded role was
`code-reviewer` or `qa-engineer`, the coordinator must hand-author a
multi-step detour (`pm → sr-engineer` reclaim `→` reviewer/QA reclaim) that
exists only to satisfy the state machine, not because sr-engineer has any
actual work to do. Done manually and under time pressure, this detour risks
corrupting the chain's audit trail (spurious agent claims with nothing to
show for them).

This is strictly a **routing-graph** defect, not a **gate** defect: the
Scope Decision Gate and Cut-Approval Gate both already re-arm correctly on
every PM `In_Progress` re-entry (feature-scoped, per
`content/const-08-chain-31-mid.md`) — a real cut/scope change SHOULD force
re-attestation, and it does. This spec touches neither mechanism. It adds a
narrowly-scoped **routing edge** so PM can hand back directly to the role
that was actually stranded, instead of manufacturing false intermediate
claims.

Of the backlog's three fix directions — (a) a `spec-amend` write mode that
preserves the prior chain position, (b) conditional edges from
`pm:In_Progress` to the stranded role guarded by an explicit resume marker,
(c) a sanctioned coordinator `repair` transition — this spec adopts
**(b)**. Rationale: (a) requires the persisted "current tuple" to diverge
from "who actually called the tool," which ripples into round-counter and
evidence-tracking logic that assume a single current agent; that is a much
larger blast radius for a narrow problem. (c) is a generic escape hatch —
exactly the shape of risk the Cut-Approval Gate spec (C2) deliberately
avoided by defining a narrow, auditable trust boundary instead of a
blanket override; a generic `repair` transition would let PM (or anyone
holding its `agent_id`) jump to *any* downstream role, including skipping
code-reviewer or qa-engineer entirely on a normal forward flow, which is the
exact audit-corruption risk the ticket itself flags. (b), scoped to *only*
the specific role that was actually stranded and gated by an explicit,
persisted resume marker, gives PM exactly the edge it needs and no more —
it cannot be used to skip a stage on a normal forward flow, and it leaves an
auditable trace of why the "shortcut" was taken.

## User Stories

- As a PM who must amend a spec mid-chain in response to a legitimate
  downstream flag (sr-engineer's §7 Test Impact note, a code-reviewer FAIL,
  or a qa-engineer FAIL that is spec-only), I want to hand routing back
  directly to the role that was stranded, so the coordinator does not have
  to hand-author multiple transition writes to route around a missing edge.
- As a coordinator, I want an explicit, auditable marker recording which
  role a PM amendment resumes to, so the repair path is distinguishable
  from an undocumented or unauthorized routing jump in the handoff history.
- As a maintainer of `tools/transitions.ts`, I want the repair edge scoped
  so tightly that it cannot be used to bypass code-reviewer or qa-engineer
  on a normal forward flow — only to resume a role that was genuinely
  in-flight when PM interrupted it.
- As an architect, I want the trust-boundary question — a self-attested
  resume marker (client-supplied `pending_notes` token, same trust class as
  `scope_decision_why`) vs. a server-computed resume target (persisted
  field snapshotting the actual predecessor, same trust class as
  `cut_approved`) — resolved with an explicit decision and rationale before
  implementation, since this edge changes the review-chain's security
  perimeter (unlike C2's `cut_approved`, which was deliberately kept a
  pure boolean with no `agent_id` restriction because it gates a
  human-consent fact, not a routing-integrity fact).

## Acceptance Criteria

**AC-1 — Existing gates untouched:**
Given the Scope Decision Gate and Cut-Approval Gate (`content/const-08-chain-31-mid.md`,
`tools/handoff-orchestrator.ts` L87-183),
When this feature ships,
Then neither gate's trigger condition, clearing artifact, or re-arm logic
changes. Both remain scoped to the `pm:In_Progress → {architect,sr-engineer}:In_Progress`
edge exactly as today; the new edges added by this spec target
`code-reviewer`/`qa-engineer`, not `architect`/`sr-engineer`, so neither
gate fires on them (confirm this explicitly in tests — AC-8).

**AC-2 — New guarded edges:**
Given `tools/transitions.ts`,
When PM is at `pm:In_Progress` and the immediately-preceding non-`pm` tuple
was `(code-reviewer, In_Progress)`, `(code-reviewer, FAIL)`, `(qa-engineer, In_Progress)`,
or `(qa-engineer, FAIL)`,
Then `validateTransition` accepts `(pm, In_Progress) → (code-reviewer, In_Progress)`
or `(pm, In_Progress) → (qa-engineer, In_Progress)` respectively — but ONLY
when the resume marker (mechanism per AC-4) identifies that exact target
role. This is additive: it does not remove or alter any existing entry in
`ALLOWED_TRANSITIONS`.

**AC-3 — Narrow rejection on the common path:**
Given the same starting tuple `pm:In_Progress`,
When PM writes without a resume marker, or with a marker naming a role
other than the one actually stranded,
Then the transition is rejected exactly as today (`TRANSITION_REJECTED`,
falling through to the existing static table) — the normal forward edges
(`architect`, `sr-engineer`, `researcher`, `design-auditor`, `pm`) are
unaffected and remain the only reachable targets absent a valid marker.

**AC-4 — Architect resolves the trust-boundary mechanism:**
Given the two candidate mechanisms in the User Stories section,
When `architect` writes `specs/pm-repair-resume-routing-architecture.md`,
Then it picks ONE mechanism with rationale, specifies the exact
marker/field name, its persistence location (handoff YAML frontmatter vs.
`pending_notes` token), whether it is file-mode-only (mirroring
`cut_approved`'s file-mode-only scope per AC-13) or also needs SQLite/HTTP
support, and whether `tools/transitions.ts` can validate it purely from
`(prev, next, pending_notes)` (keeping the module fs-free, per its existing
"pure, fs-free" contract) or requires a new orchestrator-level check in
`tools/handoff-orchestrator.ts` (mirroring how `SCOPE_DECISION_REQUIRED`/
`CUT_APPROVAL_REQUIRED` live outside `transitions.ts` because they read
`fs`/handoff state).

**AC-5 — Constitution documents the mechanism:**
Given `content/const-08-chain-31-mid.md` (§3.1, `chain`-tagged),
When a new bullet is added immediately after the existing Cut-Approval Gate
bullet (before the Code-reviewer-approval bullet),
Then it states, in the same style as the two existing bullets: the trigger
edges (`pm:In_Progress → code-reviewer:In_Progress`,
`pm:In_Progress → qa-engineer:In_Progress`), the resume-marker mechanism
per AC-4's decision, why it is scoped to exactly the stranded role (not a
blanket edge), and that it does not interact with the Scope Decision Gate
or Cut-Approval Gate (per AC-1).

**AC-6 — `content/skill-coordinator.md` action text:**
Given the Auto-Routing section's stop-condition list,
When updated,
Then a new entry points to Constitution §3.1 for the mechanism and states
only the coordinator-specific action: when relaying a PM amendment that
resumes a stranded `code-reviewer`/`qa-engineer`, set the resume marker
per AC-4's chosen mechanism on the routing write.

**AC-7 — `content/skill-pm.md` action text:**
Given the PM SOP,
When updated,
Then it instructs PM to set the resume marker (per AC-4) on its
`pm:In_Progress` write whenever the amendment is resuming a specific
stranded downstream role, pointing to Constitution §3.1 for the mechanism
rather than restating it.

**AC-8 — Regression tests:**
Given the existing transition-matrix test coverage (`test/qa-flow.test.mjs`
and siblings),
When new tests are added,
Then they cover: (a) the guarded edge is accepted for the exact stranded
role with a correct marker; (b) rejected with no marker; (c) rejected with
a marker naming the wrong role; (d) all pre-existing `pm:In_Progress`
unconditional edges (`architect`, `sr-engineer`, `researcher`,
`design-auditor`, `pm`) remain reachable and unaffected; (e) the Scope
Decision Gate and Cut-Approval Gate do not fire on the new edges (AC-1,
tested explicitly, not just asserted in prose).

**AC-9 — Doc sync (`specs/qa-flow-enforcement-architecture.md`):**
Given the `## ALLOWED_TRANSITIONS Matrix` section (authoritative-source
table, currently already stale re: `code-reviewer` rows — pre-existing
drift, not introduced here),
When updated,
Then the new conditional edges are documented as a distinct
precedence rule (same pattern already used for the round-cap override,
which sits above the static table rather than inside it), not silently
folded into the plain table (which would misrepresent them as
unconditional).

**AC-10 — Golden-fixture regeneration:**
Given `content/const-08-chain-31-mid.md` changes (AC-5),
When `npm run build && node scripts/capture-constitution-golden.mjs` is run
and `test/fixtures/compose-golden/constitution-monolith.txt` is
regenerated manually via `cat content/const-*.md > test/fixtures/compose-golden/constitution-monolith.txt`,
Then `npm test` passes `test/compose-equivalence.test.mjs` with the only
diff being the intentional new bullet text (same blast radius as C2's AC-7:
`build-full-nondesign.txt`, `build-full-design.txt`,
`build-full-nondesign-fd.txt`, `build-full-design-fd.txt`, `hook-full.txt`,
`constitution-monolith.txt`).

**AC-11 — Budget re-baseline (QA-owned):**
Given `test/context-budget.test.mjs`'s hardcoded `~tok` ceiling/floor
assertions against `composeConstitution({chain: true, ...})`,
When the AC-5 bullet grows the `const-08` bundle,
Then qa-engineer (not sr-engineer — test files are §2 test-owned)
re-baselines any now-failing cap with a documented, versioned comment,
following the existing precedent (`test/context-budget.test.mjs`
"v3.28.0 (qa-owned bump)" / C2's "v3.46.0 (qa-owned bump)").

**AC-12 — Build/test/audit gate:**
Given all changes are in place,
When `npm run build && npm audit --audit-level=high && npm test` are run,
Then all three exit 0.

**AC-13 — File-mode scope confirmed:**
Given `tools/handoff-orchestrator.ts`'s existing file-mode-only guard on the
Cut-Approval Gate (`getActiveStorage() instanceof FileHandoffStorage`),
When AC-4's mechanism is finalized,
Then the spec/architecture doc explicitly states whether the new edges'
guard is likewise file-mode-only or works in SQLite/HTTP mode too, so no
mode-specific gap is discovered post-ship.

**AC-14 — Backlog updated:**
Given `docs/backlog.md`,
When this feature PASSes,
Then **C1** is marked done citing the commit/PR and the chosen mechanism
(option (b): guarded conditional edges + resume marker).

## Copy / Strings

Normative prose (not end-user UI copy), provisional pending AC-4's
mechanism decision. If architect selects the self-attested marker
(recommended default below — same trust class as `scope_decision_why`,
free-text, not server-verified), this wording carries forward verbatim; if
architect selects the server-computed mechanism instead, sr-engineer
updates S01/S02 to match the architecture doc's exact field name before
implementing AC-5/AC-6/AC-7 (the architecture doc, not this spec, is
authoritative on the final field name per normal PM→architect handoff).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S01 | Resume-marker token format (self-attested default): `resume_of: <code-reviewer\|qa-engineer>` as a `pending_notes` entry, e.g. `"resume_of: code-reviewer"` | authored-here — this spec, AC-2/AC-4 default recommendation |
| S02 | Constitution §3.1 bullet opener (style-matched to existing two bullets): `"Amend-Resume Edge: when PM re-enters pm:In_Progress mid-chain to amend a spec-only issue flagged by a downstream role, two additional guarded edges — pm:In_Progress → code-reviewer:In_Progress and pm:In_Progress → qa-engineer:In_Progress — allow PM to hand back directly to the role that was stranded, instead of a manufactured detour through sr-engineer."` | authored-here — this spec, AC-5 (final wording finalized against AC-4's mechanism) |

## Visual Tokens

N/A — no visual surface. Server-gate + governance-text feature only.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual tokens | authored-here — governance-text-only feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — `design/<feature>.md` does not exist; no design mode is armed for
this feature.

## Out of Scope

- **Option (a) — `spec-amend` write mode preserving prior chain position.**
  Rejected: would decouple "who called the tool" from "the persisted
  current tuple," rippling into round-counter (`qa_round`/`review_round`/
  `visual_round`) and evidence-tracking logic that assume a single current
  agent. Larger blast radius than the problem warrants.
- **Option (c) — a generic coordinator `repair` transition.** Rejected: an
  unscoped escape hatch that could route PM's `agent_id` to *any*
  downstream role, including skipping code-reviewer or qa-engineer
  entirely on a normal (non-repair) flow — the exact audit-corruption risk
  the backlog ticket flags. C2's Cut-Approval Gate deliberately chose a
  narrow, auditable trust boundary over a blanket override; this spec
  follows the same precedent.
- **Any change to the Scope Decision Gate or Cut-Approval Gate mechanisms**
  (trigger, clearing artifact, or re-arm semantics) — both already work
  correctly per the backlog ticket; only the routing-graph gap is fixed
  here (AC-1).
- **Any change to round-cap logic** (`qa_round`/`review_round`/`visual_round`
  computation in `computeNewRound`) — untouched.
- **Fixing the pre-existing `code-reviewer` omission in
  `specs/qa-flow-enforcement-architecture.md`'s older Interface
  Contracts/Sequence Diagram pseudocode sections** — that drift predates
  this ticket and is a separate documentation debt; AC-9 only adds the new
  edges to the matrix table, it does not do a full pass on the rest of the
  doc.
- **SQLite/HTTP mode support**, unless AC-4/AC-13 explicitly decide the
  mechanism should work there too.

## Dependencies / Prerequisites

### Ticket ordering

Architect (T-C1-01) must resolve AC-4's trust-boundary decision and produce
`specs/pm-repair-resume-routing-architecture.md` before any sr-engineer
ticket that touches `tools/transitions.ts` or `tools/handoff-orchestrator.ts`
starts (T-C1-02, T-C1-03 both `depends_on: T-C1-01`).

### Fragment placement

`content/const-08-chain-31-mid.md` is `chain`-tagged in
`prompts/constitution-manifest.ts` (ships on every non-lite dispatch,
independent of design-arm) — same placement precedent as the adjacent Scope
Decision Gate and Cut-Approval Gate bullets. No new fragment file, no
manifest change.

### Golden-fixture blast radius

Identical to C2's (see `specs/cut-approval-coordinator-attestation.md`
Dependencies section): `build-full-nondesign.txt`, `build-full-design.txt`,
`build-full-nondesign-fd.txt`, `build-full-design-fd.txt`, `hook-full.txt`,
`constitution-monolith.txt`. Lite fixtures are unaffected (lite excludes
`chain`-tagged fragments).

### Related prior art

`specs/pm-cut-approval-gate-architecture.md` and
`specs/cut-approval-coordinator-attestation.md` are the closest prior
architecture/spec pairs for a gate/edge-class change of this shape —
useful reading for the trust-boundary framing (self-attested vs.
server-verified) this spec's AC-4 asks architect to resolve.

### Backlog cross-reference

`docs/backlog.md` **C2** (done) explicitly lists C1 as a separate,
untouched ticket in its Out of Scope section — no overlap to reconcile.
