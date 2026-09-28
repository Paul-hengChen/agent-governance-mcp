# Review — pm-repair-resume-routing (C1-02, C1-03, C1-04, C1-05, C1-06, C1-08)

Covering report for the full review round. `review_C1-03.md`, `review_C1-04.md`, `review_C1-05.md`, `review_C1-06.md`, `review_C1-08.md` are pointer stubs to this file (per-id evidence-check requirement; see backlog C3).

## Round 1 — APPROVED — by code-reviewer

## Summary

- Amend-Resume routing repair per `specs/pm-repair-resume-routing.md` + `specs/pm-repair-resume-routing-architecture.md` (Option A: self-attested `resume_of:` marker in `pending_notes`, guard pure in `transitions.ts`).
- Single server-code change: `tools/transitions.ts` — new module-private `resumeMarkerNames()` helper + step-3.5 Amend-Resume Edge in `validateTransition` (+30 lines). No signature change, no `TransitionRejection` union change, no new error code, no `any`.
- Governance text: one Constitution §3.1 bullet (`const-08-chain-31-mid.md`), two skill pointer edits (`skill-coordinator.md` stop-condition 7, `skill-pm.md` declaration), one qa-flow doc precedence-rule sync. C1-03 is a verified NO-OP under Option A (no persistence change; `handoff.ts`/`handoff-orchestrator.ts`/`schema/` zero-diff).
- Fixtures: 6 chain/monolith compose-golden fixtures each +1/−0 (exactly the new bullet); lite fixtures byte-identical. `dist/` rebuilt and in sync (`npm run build` produces zero further diff).
- Verdict: **APPROVED**. Implementation matches the architecture blueprint verbatim; no blocking findings.

## Correctness

- `tools/transitions.ts:359-367` — guard predicate is exact per AC-2/architecture §Interface Contracts: prev pinned `(pm, In_Progress)` (both `req.prev.agent === "pm"` and `req.prev.status === "In_Progress"`), `req.next.status === "In_Progress"` on the target side, target restricted to `code-reviewer`/`qa-engineer`, and `resumeMarkerNames(req.next_pending_notes, req.next.agent)` requires the marker role to EQUAL the target role (the marker is matched against the concrete `next.agent`, so a marker naming the other role cannot open the edge). AC-2/AC-3 ✓.
- `tools/transitions.ts:246-253` — `resumeMarkerNames` matches AC-4 grammar exactly: `undefined` notes → `false`; per-entry `typeof n === "string"` guard; `n.trim() === \`resume_of: ${target}\`` is a full trim-equal, so `resume_of:code-reviewer` (no space), trailing junk, and out-of-set roles all fail to match. No substring/prefix leniency. Marker-grammar test cases 3/4 in the architecture Test Surface will pass.
- **Precedence verified against the surrounding code (`tools/transitions.ts:303-367`)**: step 3.5 is inserted AFTER all three round-cap overrides (qa `:304`, review `:315`, visual `:330`) and AFTER the self-loop fast path (`:342`), BEFORE the table lookup (`:369`). A maxed `review_round`/`qa_round`/`visual_round` returns `*_ROUND_EXCEEDED` and never reaches step 3.5 even with a valid marker — round cap correctly outranks the resume edge (architecture §Precedence, defense-in-depth test 7 ✓). The self-loop fast path stays first; no overlap risk since it requires `prev.agent === next.agent` while 3.5 requires `prev=pm, next∈{code-reviewer,qa-engineer}` (disjoint).
- **Fall-through** (`tools/transitions.ts:369-379`): a missing/mismatched/malformed marker takes no new code path — control reaches the unchanged step-4 table lookup, which has no `pm:In_Progress → {code-reviewer,qa-engineer}` entry, so it returns the pre-existing `rejection(req, "TRANSITION_REJECTED", allowed, hint)` with the static `pm:In_Progress` `allowed` set and identical hint. Byte-identical rejection envelope, no new error code (AC-3 ✓).
- Type-safety: `next_pending_notes` is typed `ReadonlyArray<string> | undefined` (`transitions.ts:39`), matching the helper's param type exactly; the helper's `target` is the literal union `"code-reviewer" | "qa-engineer"`. No `any`; `TransitionRequest`/`validateTransition` signatures and the `TransitionRejection` union are unchanged (AC-2 "additive", architecture §Data Structures ✓).

## Quality

- Helper is module-private (not exported) and placed adjacently to `rejection()`; doc-comment states purity/trust-class. The step-3.5 doc-comment and the function-level precedence JSDoc (`:287-288`) both name the new step — house style matches the round-cap/self-loop comments.
- Constitution bullet (`const-08-chain-31-mid.md:3`) follows the adjacent Cut-Approval Gate bullet style, including the `<!-- origin:start --> (v3.47.0)<!-- origin:end -->` version tag (sequential after C2's v3.46.0 tag; package bump is post-PASS release scope, consistent with the committed cut-approval precedent).
- Skills are pointers, not restatements (AC-6/AC-7 ✓): `skill-coordinator.md:92` stop-condition 7 states only the coordinator action (carry the identical `resume_of:` entry onto the routing write) + a one-line consequence, deferring the mechanism to §3.1; `skill-pm.md:46` states only the PM declaration action, deferring to §3.1. Neither restates the trust-class/consistency-check mechanism.

## Architecture

- Implementation matches `specs/pm-repair-resume-routing-architecture.md` with no deviation: guard lives in `transitions.ts` (pure, fs-free) as step 3.5, self-attested marker, no schema bump, no orchestrator gate. C1-03's NO-OP is correct — Option A adds no persisted field, so `handoff.ts`/`handoff-orchestrator.ts`/`schema/versions.ts`/`storage-sqlite.ts`/`index.ts` are all verified zero-diff.
- **AC-9 doc sync** (`specs/qa-flow-enforcement-architecture.md:170`): the two edges are documented as a distinct conditional precedence rule placed after the round-cap override block and describing step-3.5 placement (after round cap + self-loop, before the table), NOT as static-table rows — matches the implemented precedence and AC-9's "distinct precedence rule" requirement exactly.
- Constitution bullet semantics cross-checked against the code: two named edges, self-attested marker, server checks only marker⟺target consistency, scoped to the named role, static table still forbids `pm→{code-reviewer,qa-engineer}` absent a marker, and explicit non-interaction with the Scope/Cut gates. All match `validateTransition`.

## Security

- **Cannot skip code-reviewer/qa-engineer on a normal forward flow** (the ticket's core audit-corruption risk): the new edge *reaches* code-reviewer/qa-engineer FROM pm; it does not route *past* them. Skipping a stage would require a different edge (e.g. sr→qa, or code-reviewer→PASS) — none touched. Without a marker the static table forbids `pm→{code-reviewer,qa-engineer}`, so the marker is strictly additive and can only open a resume, never a skip. AC-3/User-Story-3 ✓.
- **Honest-attestation trust boundary**: attaching `resume_of:` on a first-pass (non-stranded) route is not server-detectable by design — the server verifies only marker⟺target consistency; genuine strandedness is a PM SOP attestation (trust class of `scope_decision_why`). This is the accepted trust class per the architecture's AC-4 decision and matches the C2 `cut_approved` precedent; an agent that could forge this could already forge any `agent_id`, so no new perimeter is opened. Audit trail is readable: `resume_of: <role>` persists in `pending_notes` at the edge-crossing write.
- **Gate isolation proven** (AC-1): both orchestrator gate predicates (`tools/handoff-orchestrator.ts:98` and `:151`) require `nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer"` — disjoint from the new edges' `{code-reviewer, qa-engineer}` targets, so neither gate body executes on the new edges. `handoff-orchestrator.ts` is zero-diff, so the Scope Decision and Cut-Approval gates are untouched by construction and still fire on their own `pm→{architect,sr-engineer}` edges.
- No secrets, no injection surface; the marker is compared by exact string equality against a fixed literal, not interpolated into any query/path.

## Performance

- No regression. `resumeMarkerNames` is O(n) over `pending_notes` (a short array), short-circuits via `.some`, and runs only when the prev/next tuple already matches the narrow pm→{code-reviewer,qa-engineer} shape. No new I/O, no fs access, no allocation in a hot path. Content/fixture growth (~1 bullet on chain dispatches) is intentional and gated by the qa-owned budget re-baseline (C1-09).

## Verdict

**APPROVED** — `tools/transitions.ts` implements the architecture blueprint verbatim; guard predicate, precedence position, and byte-identical fall-through are all exact; gate isolation holds by construction; governance text and doc sync match code semantics; fixture blast radius is exactly the new bullet (6 chain fixtures +1 each, lite untouched); `dist/` is rebuilt and in sync.

Test-state at review time: `npm test` = **820 pass / 4 fail** (824 total). The 4 fails are ALL in `test/context-budget.test.mjs` (`not ok 103` skill-pm cap; `not ok 107/108/120` design-arm constitution / teamwork bundle / non-design constitution floors) — the qa-owned budget re-baseline reserved for C1-09 (AC-11). No unexpected failures. Known unrelated flake (`test/handoff-write-arg-guard.test.mjs` stdio timeout) did not occur this run.

Reviewer context: clean-context review — read only the diff vs base, `specs/pm-repair-resume-routing.md`, and `specs/pm-repair-resume-routing-architecture.md`; did not read sr-engineer's `pending_notes` commentary or `qa_reports/`. Same-model-bias note: this review ran on opus (code-reviewer tier); if sr-engineer ran on a fable-family context, blind spots differ. Verification relied on code cross-check and the architecture contract rather than judgment-only review.
