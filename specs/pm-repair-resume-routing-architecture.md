# Architecture: PM Amend-Resume Routing (Transitions Repair Edge)

> v1.0 — authored 2026-07-07 by @architect
> Spec: `specs/pm-repair-resume-routing.md` (v1.0, @pm). Backlog `docs/backlog.md` **C1**.
> Scope attested `single-feature` (handoff, this feature).
> Schema: **no bump** — handoff stays v5. The marker rides the existing
> `pending_notes` array; no new persisted field.

This is server-internal architecture. No UI, no external design source
(`design/pm-repair-resume-routing.md` does not exist → no visual mode armed →
no Visual Harness section). All output surfaces are the existing MCP transition
envelope and governance (constitution/skill) text.

---

## AC-4 Decision (the one open decision this ticket exists to close)

**Chosen: Option A — self-attested `resume_of:` token in `pending_notes`,
trust class of `scope_decision_why`. Guard lives entirely in
`tools/transitions.ts` `validateTransition` (pure / fs-free). No new persisted
field, no schema bump, no orchestrator gate, no new error code, no file-mode
vs SQLite divergence.**

### Why Option A over Option B (server-computed predecessor snapshot)

The ticket's own framing is decisive: this is *"strictly a routing-graph
defect, not a gate defect."* A routing-graph fix belongs in the routing-graph
module, using inputs `validateTransition` already receives.

1. **Option B verifies nothing against the adversary the ticket names.** B
   would persist a `resume_target` snapshot written by the server when a PM
   re-entry interrupts a downstream role. But the server computes that snapshot
   from the `(last_agent, status)` tuple sequence on disk — and *"a
   malicious/sloppy agent can already claim any `agent_id`"* (spec User Stories;
   C2 spec Out of Scope L215-219). The same actor who could forge a routing
   jump also controls the tuple history B computes from. So B raises the audit
   bar against **nobody** the honest-attestation model does not already cover.
2. **Precedent: narrow, auditable, honest-attestation trust boundaries.** C2's
   `cut_approved` was deliberately kept a pure attestation, NOT a cryptographic
   guarantee, precisely because *"the server cannot verify … an agent can always
   claim any `agent_id` anyway"* (`specs/cut-approval-coordinator-attestation.md`
   AC-2/AC-6, Out of Scope). The spec nominates `scope_decision_why`'s trust
   class for Option A — the same honest-attestation family. Option A stays
   inside the perimeter C2 established.
3. **Blast radius.** B needs: a new handoff field → handoff schema **v6** bump +
   migration (`docs/schema-versions.md`); file-mode-YAML vs SQLite divergence
   (re-creating the exact `cut_approved` file-mode-only special-case in
   `handoff-orchestrator.ts` L149-155, AC-13); new orchestrator write-logic to
   snapshot the predecessor on every PM re-entry AND distinguish a *repair*
   re-entry from a normal forward `pm→build` entry; and feature-scoped
   reset/re-arm rules for the new field (the load-bearing, error-prone part of
   C2). Option A needs **one predicate in one pure function** and touches no
   persisted state. For a narrow problem, B is a large, mode-divergent,
   migration-bearing surface that buys no real integrity.
4. **Option A is strictly stronger on mode-parity.** Because the check reads
   only in-memory transition inputs, it behaves **identically in file and
   SQLite/HTTP mode** — the mode-specific gap AC-13 worries about cannot exist
   (contrast B, which reproduces `cut_approved`'s file-mode-only hole).

### What the server actually checks (and what it trusts)

The server accepts the edge **iff** the edge-crossing write carries
`resume_of: <next.agent>` in its `pending_notes`. It does **not** verify that
`next.agent` was truly the pre-`pm` stranded role — it *cannot*, without
persisting history (Option B). AC-2's *"immediately-preceding non-`pm` tuple
was one of {code-reviewer, qa-engineer}×{In_Progress, FAIL}"* is therefore a
**PM-attested precondition (SOP obligation, AC-7)**, not a server check. The
server enforces marker⟺target **consistency**; PM attests genuineness. This is
the honest-attestation boundary — identical in spirit to `cut_approved`.

AC-3's *"marker naming a role other than the one actually stranded → rejected"*
is realized as marker⟺`next.agent` consistency: a marker naming a role other
than `next.agent` does not fire the resume step, and the static table has no
`code-reviewer`/`qa-engineer` entry for `pm:In_Progress`, so it falls through to
the unchanged `TRANSITION_REJECTED`.

---

## Affected Files

| File | Change | Owner ticket |
|---|---|---|
| `tools/transitions.ts` | Add one pure precedence step ("Amend-Resume Edge") in `validateTransition`, between the self-loop fast path (step 3) and the table lookup (step 4), plus a small pure helper `resumeMarkerNames(notes, target)`. **No** `TransitionRejection["error"]` union change, **no** `TransitionRequest` signature change (`next_pending_notes` already exists). | C1-02 (sr) |
| `content/const-08-chain-31-mid.md` | New §3.1 bullet immediately AFTER the Cut-Approval Gate bullet, BEFORE the Code-reviewer-approval bullet (AC-5). Full text in §Interface Contracts below. | C1-03/04 (sr) |
| `content/skill-coordinator.md` | Auto-Routing stop-condition entry: coordinator sets the marker on the routing write; points to Constitution §3.1 (AC-6). | C1-03/04 (sr) |
| `content/skill-pm.md` | SOP: PM records `resume_of: <role>` on its `pm:In_Progress` amend write as the resume declaration; points to §3.1 (AC-7). | C1-03/04 (sr) |
| `specs/qa-flow-enforcement-architecture.md` | Add the two conditional edges to the `## ALLOWED_TRANSITIONS Matrix` section as a **distinct precedence rule** (same shape as the round-cap override block that sits above the static table), NOT a plain table row (AC-9). | C1-05/06 (sr/doc) |
| `test/qa-flow.test.mjs` (+ siblings) | Transition-matrix + gate-isolation coverage (AC-8). **qa-owned (C1-07)** — NOT sr. | C1-07 (qa) |
| `test/fixtures/compose-golden/*.txt` | Regenerate after the `const-08` edit (AC-10). Script + one manual `cat`. | C1-08 (qa/release) |
| `test/context-budget.test.mjs` | Re-baseline the now-larger `const-08` bundle cap, versioned comment (AC-11). **qa-owned** — NOT sr. | C1-07/09 (qa) |
| `docs/backlog.md` | Mark **C1** done at PASS, citing commit + chosen mechanism (option (b) edges + self-attested `resume_of:` marker) (AC-14). | C1-10 (doc/coord) |

**Explicitly NOT touched (isolation is by construction):**
- `tools/handoff-orchestrator.ts` — **no new gate block.** The Scope Decision
  and Cut-Approval gate predicates (`nextTuple.agent === "architect" ||
  "sr-engineer"`) are disjoint from the new edges' `next.agent ∈
  {code-reviewer, qa-engineer}`, so neither gate body executes on the new edges.
  Zero diff here is the AC-1 guarantee. (See §Gate-Isolation Guarantee.)
- `tools/handoff.ts` — no new field, no parse/write change (marker is a
  pre-existing `pending_notes` entry).
- `schema/versions.ts`, `schema/migrations-handoff.ts`, `docs/schema-versions.md`
  — **no schema bump.** `CURRENT_VERSIONS.handoff` stays `5`.
- `tools/storage-sqlite.ts` — nothing to add; mechanism is mode-agnostic.
- `tools/evidence-file.ts` — no new predicate (unlike `hasCutApproval`/
  `hasScopeDecision`; the check is pure and lives in `transitions.ts`).
- `index.ts` — no new zod field (`pending_notes` already exists), no new error
  code to surface (falls through to existing `TRANSITION_REJECTED`).

Net sr-engineer code surface: **one file (`tools/transitions.ts`)** + governance text.

---

## Data Structures

**No new types. No changed signatures.** The marker is a plain string in the
existing `TransitionRequest.next_pending_notes: ReadonlyArray<string>` field
(`transitions.ts` L39) — already threaded from `parsed.pending_notes` by
`handoff-orchestrator.ts` L78.

Marker grammar (S01, verbatim from spec):

```
resume_of: <target>        where <target> ∈ { "code-reviewer", "qa-engineer" }
```

- One `pending_notes` array entry, e.g. `"resume_of: code-reviewer"`.
- Match rule: **trim the whole note, then exact-equal** against
  `` `resume_of: ${target}` `` (literal single space after the colon). Any other
  form (`resume_of:code-reviewer` no space, trailing junk, a role outside the
  two valid targets) does NOT match → edge not opened → `TRANSITION_REJECTED`.
- No persisted flag, no YAML frontmatter key, no schema field. Trust class:
  `scope_decision_why` (client-supplied free text, not server-verified).

---

## Interface Contracts

### `tools/transitions.ts` — new pure helper

```ts
// Amend-Resume Edge (C1). Pure, fs-free. Returns true iff `notes` contains a
// single trimmed entry exactly equal to `resume_of: <target>`. Trust class of
// scope_decision_why: client-attested, not server-verified.
function resumeMarkerNames(
  notes: ReadonlyArray<string> | undefined,
  target: "code-reviewer" | "qa-engineer",
): boolean {
  if (!notes) return false;
  const want = `resume_of: ${target}`;
  return notes.some((n) => typeof n === "string" && n.trim() === want);
}
```

### `tools/transitions.ts` — `validateTransition` precedence insertion

Insert as **step 3.5**, AFTER the self-loop fast path (current L328-336) and
BEFORE the table lookup (current L338-342). Do NOT reorder steps 1–3; the
round-cap override (step 2) MUST retain higher precedence (see §Precedence).

```ts
// 3.5 Amend-Resume Edge (C1). Additive: opens pm:In_Progress →
// {code-reviewer,qa-engineer}:In_Progress ONLY when the incoming write
// self-attests `resume_of: <that exact role>` in pending_notes. The static
// table has no such entry, so absent/mismatched markers fall through to the
// unchanged TRANSITION_REJECTED. "Was actually stranded" is PM-attested (SOP);
// the server checks only marker⟺target consistency. Pure (reads only
// prev/next/pending_notes) — no fs, no schema field, works in every storage mode.
if (
  req.prev.agent === "pm" &&
  req.prev.status === "In_Progress" &&
  req.next.status === "In_Progress" &&
  (req.next.agent === "code-reviewer" || req.next.agent === "qa-engineer") &&
  resumeMarkerNames(req.next_pending_notes, req.next.agent)
) {
  return null; // accept
}
```

### Rejection envelope (unchanged)

A missing/wrong marker takes NO new code path: control falls to the existing
step-4 table lookup, which returns
`rejection(req, "TRANSITION_REJECTED", allowed, hint)` where `allowed` is the
static `pm:In_Progress` set `[architect, sr-engineer, researcher,
design-auditor, (pm,Blocked), (pm,In_Progress)]` and `hint` is the existing
generic message. **The `TransitionRejection` union, the `allowed` list, and the
hint are all identical to today** (AC-3: "rejected exactly as today"). sr-engineer
MUST NOT add an error code or alter the rejection message.

### `content/const-08-chain-31-mid.md` — new §3.1 bullet (AC-5)

Placed immediately after the Cut-Approval Gate bullet, before the
Code-reviewer-approval bullet. sr-engineer writes this text verbatim (S02
opener carried from spec, extended per AC-5 with mechanism + isolation clause):

> **Amend-Resume Edge:** when PM re-enters `pm:In_Progress` mid-chain to amend a
> spec-only issue flagged by a downstream role, two additional guarded edges —
> `pm:In_Progress → code-reviewer:In_Progress` and
> `pm:In_Progress → qa-engineer:In_Progress` — allow PM to hand back directly to
> the role that was stranded, instead of a manufactured detour through
> sr-engineer. **Mechanism:** the write that crosses the edge must carry a
> self-attested `resume_of: <code-reviewer|qa-engineer>` entry in `pending_notes`
> (trust class of `scope_decision_why`: attested, not server-verified — the
> server checks only that the marker names the exact target role; whether that
> role was genuinely stranded is the writer's honest attestation). Scoped to
> exactly the stranded role — the marker only opens an edge to the role it
> names, and the static routing table still forbids `pm→{code-reviewer,
> qa-engineer}` absent a marker, so this can never skip code-reviewer or
> qa-engineer on a normal forward flow. **It does not interact with the Scope
> Decision Gate or the Cut-Approval Gate**, which fire only on
> `pm:In_Progress → {architect,sr-engineer}:In_Progress`; these edges target
> `code-reviewer`/`qa-engineer`, so neither gate arms.

### `content/skill-coordinator.md` (AC-6) — coordinator action only

Auto-Routing stop-condition entry: when relaying a PM amendment that resumes a
stranded `code-reviewer`/`qa-engineer`, set `resume_of: <role>` in
`pending_notes` on the routing `tw_update_state(agent_id="<role>",
status="In_Progress", ...)` write. Full mechanism: Constitution §3.1.

### `content/skill-pm.md` (AC-7) — PM action only

On its `pm:In_Progress` amend write, when the amendment resumes a specific
stranded downstream role, PM records `resume_of: <role>` in `pending_notes` as
the resume declaration (tells the next writer which role to resume; also the
audit-trail entry). Full mechanism: Constitution §3.1.

---

## Marker placement, consumption, and re-arm semantics

**Authoritative load-bearing location:** `resume_of: <role>` must be present in
the `pending_notes` of the write that **crosses** the edge — the
`tw_update_state` write with `agent_id ∈ {code-reviewer, qa-engineer}`,
`status=In_Progress`, whose prev tuple is `(pm, In_Progress)`. This is the write
`validateTransition` inspects via `next_pending_notes`.

**Two-role division (mirrors C2's present→attest split), no drift risk:**
- **AC-7 / PM** sets `resume_of: <role>` on its `pm:In_Progress` amend write.
  Under the recommended Task-subagent dispatch this copy is **informational**:
  it declares the resume target, drives the coordinator's next action, and lands
  in the audit trail at the point of amendment. It is not what the guard reads.
- **AC-6 / coordinator** carries the same token onto the routing write. This is
  the **load-bearing** copy the guard checks.
- Under same-context `tw_switch_role` continuation (one agent performs both
  writes), the same token is carried forward onto the routing write — same rule.

**Consumption — single-use by construction, nothing to clear:** `pending_notes`
are **replaced** on every write (`writeHandoffState` writes the supplied
`pendingNotes`, not a merge — `handoff.ts` L423-425). The marker therefore never
persists past the write that carries it. The next write (e.g. code-reviewer →
qa-engineer, or code-reviewer → FAIL) supplies its own notes without the marker.
There is **no stored `resume_of` flag** — so, unlike `cut_approved`, there is no
feature-scoped reset to implement, no stale-`true` hole, and no re-arm logic. Each
resume edge-crossing must independently self-attest; a retry naturally re-sends
its own `pending_notes`.

---

## Precedence (within `validateTransition`)

Highest → lowest; the insertion changes only step 3.5:

1. `agent_id` required / valid agent + status.
2. **Round-cap overrides** (`qa_round`/`review_round`/`visual_round` ≥ cap →
   only `(pm, In_Progress)`). **Retains higher precedence than the resume edge.**
   A maxed counter forces PM-rebudget even if a valid `resume_of:` marker is
   present — correct: the round cap means "PM must rebudget," and resuming the
   stranded role would defeat it. (In the normal repair sequence this never
   collides: PM's re-entry write resets all three counters to 0 via
   `computeNewRound`, so by the routing write `prev_*_round` is already 0.)
3. Self-loop fast path (same agent, `In_Progress → In_Progress`).
4. **3.5 — Amend-Resume Edge (new).**
5. Static table lookup → `TRANSITION_REJECTED` on miss.

---

## File-mode vs SQLite behavior (AC-13)

**Identical in both modes; no file-mode-only guard.** The mechanism reads only
`req.prev`, `req.next`, and `req.next_pending_notes` — all in-memory transition
inputs supplied by `handoff-orchestrator.ts` regardless of the active storage
(`getActiveStorage()`). Nothing storage-specific is persisted or read. This is a
concrete positive of Option A: it avoids the `cut_approved` file-mode-only
special-case (`handoff-orchestrator.ts` L149-155) entirely. No mode-specific gap
exists to discover post-ship.

## Schema-version impact (AC-13 companion)

**None.** No persisted field is added; the marker lives in the already-persisted,
already-versioned `pending_notes` array. `CURRENT_VERSIONS.handoff` stays `5`;
no migration step; `docs/schema-versions.md` unchanged.

---

## Gate-Isolation Guarantee (AC-1 — the load-bearing safety property)

The Scope Decision Gate and Cut-Approval Gate remain **untouched**, proven three ways:

1. **Disjoint `next.agent` domains.** Both gate predicates
   (`handoff-orchestrator.ts` L97-102, L149-155) require `nextTuple.agent ===
   "architect" || nextTuple.agent === "sr-engineer"`. The new edges have
   `next.agent ∈ {code-reviewer, qa-engineer}`. The predicates evaluate `false`
   → neither gate body runs on the new edges.
2. **Different module / different phase.** The resume-edge acceptance is in
   `validateTransition` (step 3.5), which runs *before* the gates in the frozen
   orchestrator order (`transition validation → scope-decision → cut-approval →
   …`). It returns `null` (accept) and never enters the gate blocks. Zero lines
   of the gate blocks change.
3. **Disjoint state.** Resume reads `pending_notes`; the gates read
   `scope_decision` / `cut_approved` / `.current/feature-split.md` / design-arm.
   No shared variable.

Conversely, the gates still fire on their own edges — AC-8(e) tests a positive
control (`pm→sr-engineer`, armed, no scope/cut → gates still emit) alongside the
negative (`pm→code-reviewer` with marker, armed, no scope/cut → gates silent).

---

## Sequence Diagram

```mermaid
sequenceDiagram
    actor Human
    participant CR as code-reviewer (stranded)
    participant PM as PM
    participant Coord as Coordinator
    participant Srv as MCP server (transitions.ts)

    CR->>Srv: tw_update_state(code-reviewer, FAIL) — spec-only flag, no code defect
    Note over PM: PM re-enters to amend spec
    PM->>Srv: tw_update_state(pm, In_Progress, pending_notes=["resume_of: code-reviewer", ...])
    Note over PM,Srv: computeNewRound resets qa/review/visual_round → 0
    PM-->>Coord: amend done; stranded role = code-reviewer (final reply)
    Coord->>Srv: tw_update_state(agent_id="code-reviewer", In_Progress,\n pending_notes=["resume_of: code-reviewer", ...])
    Srv->>Srv: validateTransition — step 3.5: prev=(pm,In_Progress),\n next=(code-reviewer,In_Progress), marker names code-reviewer → accept
    Note over Srv: scope/cut gates skipped (next.agent ∉ {architect,sr-engineer})
    Srv-->>Coord: written — code-reviewer resumed, no detour through sr-engineer

    Note over Coord,Srv: Counter-case — no / wrong marker:
    Coord->>Srv: tw_update_state(qa-engineer, In_Progress, pending_notes=[])  %% or resume_of: code-reviewer
    Srv->>Srv: step 3.5 does not fire → table lookup → no edge
    Srv-->>Coord: ⛔ TRANSITION_REJECTED (identical to today; allowed = static pm:In_Progress set)
```

---

## Test Surface (C1-07, qa-owned — AC-8)

Unit tests against `validateTransition` in `test/qa-flow.test.mjs` (+ siblings),
plus a small gate-isolation integration case exercising `handleUpdateState`:

1. **Accept — correct marker, exact role:** `prev=(pm,In_Progress)`,
   `next=(code-reviewer,In_Progress)`, `next_pending_notes=["resume_of:
   code-reviewer"]`, rounds 0 → returns `null`. Same for `qa-engineer` +
   `resume_of: qa-engineer`.
2. **Reject — no marker:** same edges, `next_pending_notes=[]` →
   `TRANSITION_REJECTED`; assert `allowed` = static `pm:In_Progress` set (no
   code-reviewer/qa-engineer present).
3. **Reject — wrong-role marker:** `next=(qa-engineer,In_Progress)` +
   `["resume_of: code-reviewer"]` → rejected; and `next=(code-reviewer,In_Progress)`
   + `["resume_of: qa-engineer"]` → rejected.
4. **Reject — malformed / non-resumable marker:** `resume_of:code-reviewer`
   (no space), trailing junk, `resume_of: architect`, `resume_of: sr-engineer`
   → none open a new edge (architect/sr-engineer still accept via the *table*,
   unaffected by any marker — assert their acceptance is marker-independent).
5. **Pre-existing `pm:In_Progress` edges unaffected (AC-8d):** with and without
   a `resume_of` marker present, `(pm,In_Progress) → (architect,In_Progress) /
   (sr-engineer,In_Progress) / (researcher,In_Progress) /
   (design-auditor,In_Progress) / (pm,Blocked) / (pm,In_Progress)` all still
   accept; a marker does not change their behavior.
6. **Gate isolation (AC-8e), via `handleUpdateState`:** in a design-armed
   workspace with neither `scope_decision` nor `cut_approved` set —
   `pm:In_Progress → code-reviewer:In_Progress` with `resume_of: code-reviewer`
   emits **neither** `SCOPE_DECISION_REQUIRED` **nor** `CUT_APPROVAL_REQUIRED`.
   Positive control: `pm:In_Progress → sr-engineer:In_Progress` (same armed,
   unattested state) STILL emits both gates — proving the new edge did not
   weaken them.
7. **Round-cap precedence (defense-in-depth):**
   `prev=(pm,In_Progress)`, `next=(code-reviewer,In_Progress)`, valid marker,
   but `prev_review_round=4` (or `prev_qa_round=4`) → returns the round-exceeded
   rejection, NOT accept (round cap outranks the resume edge).
8. **Mode parity (AC-13):** the pure unit accept-case (test 1) is storage-mode
   independent by construction; note no file-mode-only guard exists to test
   (contrast the `cut_approved` file-mode skip).
9. **Golden fixtures + budget (AC-10/AC-11, qa-owned):** after the `const-08`
   bullet edit, regenerate `build-full-nondesign.txt`, `build-full-design.txt`,
   `build-full-nondesign-fd.txt`, `build-full-design-fd.txt`, `hook-full.txt`
   via `node scripts/capture-constitution-golden.mjs`, and
   `constitution-monolith.txt` via
   `cat content/const-*.md > test/fixtures/compose-golden/constitution-monolith.txt`;
   `test/compose-equivalence.test.mjs` diff = only the new bullet text.
   Re-baseline the now-larger `const-08` cap in `test/context-budget.test.mjs`
   with a versioned comment (precedent: "v3.28.0 / v3.46.0 (qa-owned bump)").

---

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Resume-marker trust boundary (spec AC-4): self-attested `pending_notes` token vs. server-computed persisted predecessor snapshot | **Self-attested `resume_of:` token, trust class `scope_decision_why`** | Guard is pure `validateTransition` code reading existing inputs; no schema bump, no orchestrator gate, no error code, no mode divergence. "Actually stranded" becomes a PM-attested SOP precondition, not a server check — matching C2's honest-attestation boundary. |
| Does server-computed (Option B) buy real integrity? | **No — rejected.** An agent that could forge a routing jump also controls the tuple history the server would compute the snapshot from (any `agent_id` is claimable) | Avoids handoff schema v6 + migration, file-mode-vs-SQLite divergence, predecessor-snapshot write logic, and a new feature-scoped reset rule — all for zero added assurance against the named adversary. |
| Where does the guard live: `transitions.ts` (pure) vs `handoff-orchestrator.ts` (fs-reading gate)? | **`transitions.ts`**, as step 3.5 above the static table | Keeps the module's "pure, fs-free" contract; `next_pending_notes` is already an input. An orchestrator check would run *after* `validateTransition` already rejected the edge (frozen order), so it could not work without also loosening the pure table — worse. |
| New error code for missing/wrong marker? | **No** — fall through to existing `TRANSITION_REJECTED` | `TransitionRejection` union, `allowed` list, and hint stay byte-identical (AC-3 "rejected exactly as today"). Smaller diff; no envelope/test churn on the reject path. |
| Marker persistence / re-arm (cf. `cut_approved`'s feature-scoped reset) | **None** — marker is a single-use `pending_notes` entry, replaced on the next write | No stale-marker hole, no reset logic, no re-arm bug surface. Strictly simpler than `cut_approved`. |
| Load-bearing marker location vs AC-7's "PM sets on its `pm:In_Progress` write" | **Load-bearing copy is on the edge-crossing routing write (AC-6);** PM's copy on the amend write (AC-7) is the informational resume-declaration + audit entry | Mirrors C2's present(PM)→attest(coordinator) split. Guard stays pure (reads the routing write's `next_pending_notes`); PM's declaration keeps the intent auditable at amendment time and drives the coordinator's correct marker. |
| File-mode vs SQLite scope (AC-13) | **Both modes, identical** — no file-mode-only guard | Positive side effect of the pure-inputs design; no `cut_approved`-style mode gap. |

---

## Deferred Resources

_No non-trivial trade-offs deferred._ The spec's *Dependencies / Prerequisites*
lists only on-disk repository files (related prior-art specs
`specs/pm-cut-approval-gate-architecture.md`,
`specs/cut-approval-coordinator-attestation.md`; the golden-fixture set; the
`const-08` fragment; `docs/backlog.md`) — read for context, no action required
of sr-engineer. **Zero external URLs, design files, or tickets** were marked
`ignore`/`defer` by PM (Constitution §7 satisfied; empty section valid per the
architect SOP).

---

## Open Questions

_None._ The single open decision (AC-4's trust boundary) is resolved above in
favor of Option A with full rationale. The blueprint is ready for sr-engineer.
