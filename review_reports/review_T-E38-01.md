# Review — T-E38-01

covers: T-E38-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Scope is exactly as spec'd: one file, two additive blocks in `tools/handoff-orchestrator.ts` — the pure helper `effectiveAllowedSuccessors(prev, counters)` (`:1231-1292`) and a post-write advisory block (`:1610-1646`) that merges into the existing E28 `warnings` envelope mutation (`:1649-1661`). No `GATE_REGISTRY` entry, no new error code, no pipeline step, nothing that can reject. `dist/` is the matching rebuild. `npx tsc --noEmit` clean.
- **The core design decision is right and I want to say so first.** Calling `validateTransition` itself instead of re-deriving a second notion of "allowed" from the static `ALLOWED` table is the correct call: it makes the backlog row's three mandated whitelists (`resume_of` edges, cap-collapse-to-pm, self-loop) fall out for free rather than as three hand-maintained special cases that would drift from `transitions.ts` on the next matrix edit. I verified all three hold empirically, not by reading the comment.
- **The primary AC works.** Against the real `validateTransition`: the live 2026-07-23 bug shape (`qa-engineer:FAIL` + `next_role=design-auditor`) warns and names exactly `pm, sr-engineer`; E37's newly-legal `qa-engineer:PASS` + `next_role=design-auditor` is silent; `pm:In_Progress` + `next_role=code-reviewer` is silent (resume_of); `sr-engineer:In_Progress` self-loop is silent; `qa_round=4` collapses to `pm` alone.
- **One blocking finding (C1).** `feature_changed: false` is hardcoded in the helper's `validateTransition` call. I enumerated all 18 reachable landing states × 6 cap regimes against the compiled `validateTransition`: at `hop_count >= HOP_CAP`, **9 of the 18 states** have strictly more legal successors under `feature_changed=true` than the helper computes. The advisory therefore fires on **legal** routing in a reachable regime — the exact failure direction the ticket forbids — and one of the affected edges is `qa-engineer:PASS → design-auditor`, the edge E37 shipped one commit ago to stop being falsely rejected. Fix is ~4 lines inside the helper.
- **Hypothesis 2 does not hold — good news for the ticket.** `"(none — terminal state)"` is not a wrong message; it is **unreachable dead code**. Across all 18 reachable landing states × the no-cap / hop-cap / qa-cap / review-cap / visual-cap / combined regimes, the effective set is never empty. Details and the corrected form of the underlying `HOP_CAP` asymmetry are under **Correctness → Q2 disposition** and **Out of scope**.
- Verdict: CHANGES_REQUESTED, on C1 alone.

### Method note (clean-context)

The mandatory pre-flight `tw_get_state` returns `pending_notes`, so sr-engineer's commentary was in context before I could avoid it. Every finding below is derived from `tools/handoff-orchestrator.ts`, `tools/transitions.ts`, `gates/registry.ts` and a throwaway probe I wrote against `dist/tools/transitions.js` (scratchpad only; no repo file, no repo state touched). My conclusion on the empty-set question **contradicts** the handoff note, which is the best available evidence the analysis is independent.

---

## Correctness

### C1 (BLOCKING) — `tools/handoff-orchestrator.ts:1287` — hardcoded `feature_changed: false` produces false warnings on legal next-feature routing at hop cap

```ts
        feature_changed: false,
```

`validateTransition` reads `feature_changed` in exactly one place — the hop-cap override at `tools/transitions.ts:417-422`:

```ts
  if (
    !req.feature_changed &&
    prev_hop_count >= HOP_CAP &&
    req.next.agent !== req.prev.agent &&
    !(req.next.agent === "pm" && req.next.status === "In_Progress")
  ) {
```

so `feature_changed=true` bypasses the gate entirely (and `:574` resets the hop base). Below `HOP_CAP` the flag is inert and the hardcode is harmless. At or above it, the helper computes a **strictly smaller** set than the next write may actually be entitled to, and a smaller allowed set means **more** warnings.

Measured against the compiled `validateTransition`, all 18 reachable landing states, `hop_count = 10`:

| state just written | helper computes (fc=false) | actually also legal (fc=true) |
|---|---|---|
| `qa-engineer:PASS` | `pm` | **`researcher`, `design-auditor`, `release-engineer`** |
| `pm:In_Progress` | `pm` | `researcher`, `design-auditor`, `architect`, `sr-engineer`, `code-reviewer`, `qa-engineer` |
| `code-reviewer:In_Progress` | `code-reviewer` | `qa-engineer` |
| `sr-engineer:In_Progress` | `pm`, `sr-engineer` | `code-reviewer` |
| `qa-engineer:FAIL` | `pm` | `sr-engineer` |
| `code-reviewer:FAIL` | `pm` | `sr-engineer` |
| `qa-engineer:Blocked` | `qa-engineer` | `sr-engineer` |
| `architect:In_Progress` | `pm`, `architect` | `sr-engineer` |
| `researcher:In_Progress` | `pm`, `researcher` | `design-auditor` |

**Is the shape real?** Yes, and the top row is the one that matters. `hop_count` is feature-scoped and resets *only* on feature change (`transitions.ts:574`, DR-6) — a QA PASS does not reset it. Reaching `qa-engineer:PASS` with `hop_count = 10` needs only a feature whose 10th role transition was the `code-reviewer:In_Progress → qa-engineer:In_Progress` handoff (`qa:In_Progress → qa:PASS` is same-agent, so it does not increment). A full design-armed chain with two QA fail loops gets there: `design-auditor→pm→architect→sr→cr→qa` (6) `→sr→cr→qa` (9) `→sr` (10). That is a normal bad-luck feature, not a pathological one.

And `qa-engineer:PASS` is *definitionally* the "previous feature closed, next one may open" state — its `researcher` / `design-auditor` successors exist for no other purpose than opening a **new** feature, i.e. `feature_changed=true`. So the write that follows is legal, and the advisory says:

> `next_role="design-auditor"` does not match any allowed successor of the state just written (`qa-engineer:PASS`). Actual allowed next agent(s): `pm`. … a next hop that follows next_role as given **will hit TRANSITION_REJECTED** — re-route to one of the allowed agent(s) above…

Three things are wrong at once: the categorical claim is false, the "actual allowed" list is incomplete, and the remedial instruction ("re-route to `pm`") actively misroutes an agent whose correct move is to open the next feature. Worth stating plainly: **E37 removed 6 false `TRANSITION_REJECTED` fires on `qa-engineer:PASS → design-auditor`; E38 as written re-introduces that same false signal as prose on the same edge**, one commit later, whenever the closing feature ran long.

The helper's own comment at `:1259-1263` asserts the opposite of what the code does:

```
//   (b) the round/hop-cap overrides … validateTransition
//       checks these BEFORE the table lookup, so passing the post-write
//       round/hop counters here reproduces the exact collapse the next real
//       transition attempt will see.
```

Passing the counters is necessary but not sufficient — the collapse also depends on `feature_changed`, which is not passed. The three round caps genuinely have no `feature_changed` term, so the claim holds for them and fails only for `HOP_CAP`.

**Required fix** — union over both branches, which is the "warn only when illegal under *both*" option and keeps the ticket's under-warn bias. Inside the double loop, replace the single call with:

```ts
      // E38 — a future write may legitimately open a NEW feature, which
      // bypasses the hop-cap gate (transitions.ts:417-422) and resets the hop
      // base (:574). The next write's active_feature is unknowable from here,
      // so a candidate counts as reachable if EITHER branch accepts it. Same
      // "stay silent when uncertain" bias as next_resume_of below: at hop cap
      // this trades a false warning on a legal next-feature hop for a missed
      // warning on an illegal same-feature one, which is the direction the
      // ticket requires. The three round caps have no feature_changed term,
      // so their collapse is unaffected.
      const accepted = [false, true].some(
        (feature_changed) =>
          validateTransition({
            prev,
            next: { agent, status },
            prev_qa_round: counters.qa_round,
            prev_review_round: counters.review_round,
            prev_visual_round: counters.visual_round,
            prev_hop_count: counters.hop_count,
            feature_changed,
            next_resume_of:
              agent === "code-reviewer" || agent === "qa-engineer" ? agent : undefined,
          }) === null,
      );
      if (accepted) out.push({ agent, status });
```

I verified this costs nothing on the shapes the ticket cares about: below `HOP_CAP` the two branches are identical, so the live-bug shape still warns with `pm, sr-engineer` and the post-E37 PASS shape is still silent. It does newly suppress the true positive "at hop cap, same-feature, non-pm `next_role`" (e.g. `qa-engineer:PASS` + `next_role=release-engineer` releasing the feature that just passed, which really will hit `HOP_CAP_EXCEEDED`). That is a deliberate, ticket-sanctioned trade — and note the writer is not left blind there: the orchestrator already emits the hop-cap-cross sentinel at `:1441-1444` on the write that crosses the cap.

An acceptable alternative, if you prefer to keep 32 calls: skip the advisory entirely when `new_hop_count >= HOP_CAP_EXPORTED` (already imported at `:1441`). Cruder — it silences true positives that the union preserves below cap — but it also removes the class. Either is fine; a comment that merely documents the assumption is **not**, because the assumption is false on a reachable, non-exotic path.

### Q2 disposition — the empty-set branch is unreachable, not wrong

`tools/handoff-orchestrator.ts:1640`:

```ts
`${allowedAgents.length > 0 ? allowedAgents.join(", ") : "(none — terminal state)"}. ` +
```

I enumerated the 18 states reachable as a `nextTuple` (every distinct target in `ALLOWED`, plus the same-agent `In_Progress` self-loop landings) across six counter regimes — no caps, `hop_count=10`, `qa_round=4`, `review_round=4`, `visual_round=6`, and `hop=10 + qa=4`. **The effective set is never empty.** Structurally:

- Every one of the 18 states has a non-empty `ALLOWED` row — there is no genuinely terminal state in the matrix.
- The three round-cap overrides `return null` unconditionally for `(pm, In_Progress)` (`transitions.ts:371/382/397`), so under a round cap the set is exactly `{pm}`, never empty.
- Under the hop cap, same-agent candidates skip the gate (`:420`) and reach either the self-loop fast path or the table, so the acting agent's own edges always survive.

So the branch cannot emit a false "terminal" diagnosis, because it cannot emit at all. It is dead code rather than a defect — recorded under **Quality Q1** and non-blocking.

### Placement and blast radius (asked, verified)

- The advisory block is at `:1626`, strictly after `const result = await storage.writeState({...})` at `:1453`. It reads `nextTuple` and the four post-write counters and writes only the local `nextRoleWarnings`. It cannot alter what was persisted.
- The computation sits **outside** the `try { JSON.parse … } catch {}` at `:1650-1660`, which protects only the envelope mutation. A throw would escape into the success path after the state was already written. In practice it cannot throw: the helper is a double loop over frozen literal arrays, and `validateTransition`'s only throw path is `gate()` (`gates/registry.ts:666-671`, on an unknown code) reached with six codes that are all `GATE_REGISTRY` members. Same structural exposure as the E28 block directly above it, so this is precedent-consistent — see **Quality Q4** for the optional hardening.

### Side-effect freedom (asked, verified independently)

Confirmed clean. `tools/transitions.ts` has exactly one import (`gate` from `../gates/registry.js`, line 6) — no fs, no telemetry, no logging. `gates/registry.ts` has **no imports at all** and `gate()` is a pure `REGISTRY_BY_CODE[code]` lookup. `validateTransition` allocates only the rejection object via `rejection()` (`:319-338`), a pure constructor; the helper discards all 31-ish rejections. `emitGateTelemetry` has exactly one call site, `handoff-orchestrator.ts:120`, inside `handleUpdateState`'s `if (result.isError)` branch — it keys off the returned `ToolResult`, never off `validateTransition`. The helper runs inside `handleUpdateStateCore` on a **success** path, so `result.isError` is false and no telemetry is emitted. `tw_gate_stats` and the E6 retro data are not at risk. No module-level mutable state is touched (`ALL_AGENT_NAMES` / `ALL_STATUS_NAMES` are read-only literals, never mutated).

### `next_resume_of` generosity (asked, verified)

Cannot suppress a warning for any other reason. `next_resume_of` is read at exactly one place, the Amend-Resume accept at `transitions.ts:452-460`, which only ever *returns null* — it is purely additive and can never cause a rejection. Because the set is a union over 32 independent candidate evaluations, adding `(code-reviewer|qa-engineer, In_Progress)` from `pm:In_Progress` cannot remove any other candidate, and `isLegalSuccessor` matches on `e.agent === parsed.next_role`, so the extra entries can only ever silence `next_role ∈ {code-reviewer, qa-engineer}`. That is precisely the intended under-warn: if the real next write omits `resume_of`, it rejects and we stayed silent. Correct trade. One knock-on effect on the *message*, not on the predicate — see **Quality Q2**.

---

## Quality

**Q1 (non-blocking) — `:1640` dead branch.** Per the analysis above, `allowedAgents.length` is never 0. Either drop the ternary, or — better, since it is cheap insurance against a future matrix edit introducing a genuinely empty row — keep it but stop asserting a diagnosis the code cannot substantiate: `"(none — no successor is currently reachable from this state)"`.

**Q2 (non-blocking) — `:1636` the printed remedy list is lossy in two ways.**

```ts
const allowedAgents = [...new Set(effective.map((e) => e.agent))];
```

Deduping to bare agent names discards information the reader needs:

1. **It advertises conditionally-legal edges as unconditional.** From `pm:In_Progress` the list is `pm, researcher, design-auditor, architect, sr-engineer, code-reviewer, qa-engineer` — `code-reviewer` and `qa-engineer` are in there only because the helper generously assumed `resume_of`. An agent told to "re-route to `qa-engineer`" and who then writes without `resume_of` gets rejected by the very advisory meant to prevent that.
2. **It lists the acting agent itself**, sourced from a self-loop or a `*:Blocked` edge. From `sr-engineer:In_Progress` the list is `pm, sr-engineer, code-reviewer`; "re-route to `sr-engineer`" is not routing advice. Worst case is C1's `code-reviewer:In_Progress` at hop cap, where the whole list collapses to `code-reviewer` — a self-loop presented as the sole remedy.

Cheapest honest fix: print the `agent:status` pairs rather than deduped agents, and exclude pairs whose agent equals `nextTuple.agent`. Both are one-liners over the array you already have.

**Q3 (non-blocking) — `:1642` names the wrong error code in the cap regimes.** The string hardcodes `will hit TRANSITION_REJECTED`, but when the collapse is caused by a cap the real code is `HOP_CAP_EXCEEDED` / `QA_ROUND_EXCEEDED` / `REVIEW_ROUND_EXCEEDED` / `VISUAL_ROUND_EXCEEDED`. An agent that greps the transcript for the named code after the fact will not find it. `will be rejected` costs nothing and is always true.

**Q4 (non-blocking, optional) — `:1626-1646` outside the envelope try/catch.** Non-throwing today (argued under Correctness) and consistent with the E28 block above it. If you want the advisory to be structurally incapable of harming a write that already landed, move the `if (parsed.next_role) {…}` body inside the existing `try` (or give it its own), matching the "advisory only" contract the `catch` comment already states.

**Positive notes.** Provenance comments carry the live incident timestamp and workspace, matching the house style. `ALL_AGENT_NAMES` / `ALL_STATUS_NAMES` are typed `readonly AgentName[]` / `readonly StatusName[]`, so a future member added to either union is a compile error here rather than a silently under-enumerated set — that is the right way to write this. No dead imports, no duplication with `transitions.ts`.

---

## Architecture

Fits the E28 precedent exactly and honors the backlog row's explicit non-goals: no `GATE_REGISTRY` entry, no `ALL_GATE_CODES` addition, no `UPDATE_STATE_GATE_PIPELINE` step, no new arg, no schema bump, and one single envelope mutation shared with E28 that appends rather than clobbers (`:1652-1656`). `next_role` remains advisory-only.

The helper is correctly placed as a module-level pure function outside `UPDATE_STATE_GATE_PIPELINE` (`:1136-1228`), which keeps E35's "check order is data" invariant intact — an advisory that lived as a pipeline step would have muddied that. Delegating to `validateTransition` rather than reading `ALLOWED_TRANSITIONS` directly is the single most important structural choice here and it is the right one: `transitions.ts:3-4` already treats the matrix as having exactly one authority, and a hand-rolled predicate would have silently desynced on the next edge change (see E39, filed for precisely that class of drift in the *doc* mirror).

No architecture spec exists for E38; the backlog row is the contract, and the implementation matches it modulo C1.

---

## Security

No findings. `next_role` is zod-enum-validated at the tool boundary before reaching here, so the interpolation at `:1638` cannot carry attacker-controlled text; `nextTuple.agent` / `.status` are likewise enum-constrained. Output is `JSON.stringify`d, so no injection into the envelope. No new trust boundary, no fs access, no secrets, no user-supplied path.

---

## Performance

No regression. The helper is 32 `validateTransition` calls per accepted write **that carries `next_role`** — zero for writes without it, since the call is guarded by `if (parsed.next_role)` at `:1627`. Each call is a handful of string comparisons plus at most one `Map.get` and a `.some` over a ≤6-entry frozen array; the allocation cost is the discarded rejection objects, all short-lived. This is nanoseconds against a code path that has just done a file lock, an mtime stat and an atomic rename. The C1 fix doubles it to 64 calls, which is still nothing on that scale — do not let call count drive the fix choice.

No new I/O, no loop over anything caller-sized (both bounds are compile-time constants), no retained references, no cache.

---

## Out of scope — confirmed, please file separately

**The `HOP_CAP` / `ROUND_CAP` asymmetry is real.** The three round caps `return null` for `(pm, In_Progress)` unconditionally (`transitions.ts:371/382/397`). `HOP_CAP` (`:417-422`) instead merely *excludes* that candidate from its own rejection and falls through to the table lookup, so the escape edge exists only if `pm:In_Progress` is in the row. Three rows lack it — `code-reviewer:In_Progress` (`:228`), `qa-engineer:In_Progress` (`:241`), `qa-engineer:Blocked` (`:246`). Verified directly: from each of those three at `hop_count=10`, `(pm, In_Progress)` is rejected with `TRANSITION_REJECTED`. The hop cap's advertised "freeze at the (pm, In_Progress) landing" (`:296-299`) is therefore not available from those three states.

**Two corrections to how it was characterized to me**, both of which lower the severity:

1. It does **not** produce an empty successor set. Same-agent candidates skip the hop gate, so from `code-reviewer:In_Progress` the set is `{code-reviewer:In_Progress, code-reviewer:FAIL, code-reviewer:Blocked}` and from `qa-engineer:In_Progress` it is `{qa:PASS, qa:FAIL, qa:Blocked, qa:In_Progress}`. This is why E38's `"(none — terminal state)"` branch never fires.
2. It is **not a hard wedge**. Every one of the three states can reach `pm` in one extra same-agent move (which does not increment `hop_count`, `:573-575`): `code-reviewer:In_Progress → code-reviewer:FAIL → pm` (`:233-236`), `qa-engineer:In_Progress → qa:FAIL|PASS → pm` (`:250`, `:254`), `qa-engineer:Blocked → qa:In_Progress → qa:FAIL → pm`.

So: a genuine inconsistency between two sibling override mechanisms, worth an inexpensive backlog row (add `{ agent: "pm", status: "In_Progress" }` to the three rows, or make `HOP_CAP` `return null` on the pm landing the way the round caps do), but it is a routing detour, not a deadlock. Correctly excluded from E38 — `tools/transitions.ts` must stay untouched by this ticket.

---

## Verdict

**CHANGES_REQUESTED** — the design, placement, purity and non-enforcement are all correct and the primary AC demonstrably works, but the hardcoded `feature_changed: false` at `:1287` makes the advisory fire on legal routing from 9 of 18 reachable states once `hop_count` reaches the cap — including `qa-engineer:PASS → design-auditor`, the edge E37 shipped one commit earlier — which violates the ticket's one hard constraint that a false warning is worse than a missed one; the union-over-both-branches fix is ~4 lines inside the helper and provably changes nothing below the cap.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary

- **C1 is fully closed, verified by re-enumeration rather than by reading the diff.** `effectiveAllowedSuccessors` (`:1267-1300`) now unions both `feature_changed` branches. I re-ran the round-1 method against the round-2 helper transcribed verbatim from `dist/tools/handoff-orchestrator.js:1198-1222`: 90 (state × below-cap regime) pairs are **byte-identical** to the round-1 helper (`feature_changed` is genuinely inert below `HOP_CAP` — nothing was silently widened), and at/above the cap the new set equals the *exact* union of both branches on all 18 states, closing all 9 divergences including `qa-engineer:PASS → design-auditor`. Primary AC unregressed: the live 07-23 shape still warns with `pm, sr-engineer`; the E37 shape is silent at hop 2 **and** hop 10.
- Q1 and Q3 are correctly applied. The `:1259-1287` comment now states the round-cap/HOP_CAP distinction accurately.
- **Q2's fix is "differently wrong" — and it is blocking (C2).** The self-loop exclusion `if (e.agent === nextTuple.agent) continue;` (`:1537` src / dist `:1536`) is too broad, and it **resurrects the empty-remedy branch that round 1 proved dead — this time reachably**. Two states have successor sets that are *entirely* same-agent, so the filter empties the list and the message prints `"(none — no successor is currently reachable from this state)"`, which is categorically false. Both are reachable with **no cap armed at all**: `qa-engineer:In_Progress` (4 real successors, reached from `code-reviewer:In_Progress` — this role's own APPROVED row) and `pm:Blocked` (2 real successors, reached from 4 states).
- The `resume_of` annotation itself is correct and non-spurious — it appears on exactly one state (`pm:In_Progress`) and nowhere else, and it reads as an instruction naming the field to set rather than a prohibition. No finding.
- Non-blocking N1: the union I asked for has a mirror cost — at hop cap the remedy list now names edges legal *only* if the next write opens a new feature (9 states). The machinery to annotate that already exists.
- `npx tsc --noEmit` clean; `npm test` **1623 / 1623 pass, 0 fail** (verified myself, not taken from the handoff); `tools/transitions.ts` untouched; no test file touched; `dist/` in parity with source.
- Verdict: CHANGES_REQUESTED on C2 alone.

---

## Correctness

### C1 — CLOSED. Re-verified by enumeration.

Method: transcribed the round-2 helper and the round-2 message block **verbatim from the compiled `dist/`** (not from the TS diff, so the thing under test is the thing that ships), then re-ran the round-1 sweep over the 18 reachable landing states × 9 counter regimes (no caps, hop 9 / 10 / 25, qa=4, review=4, visual=6, and two combined).

| check | result |
|---|---|
| Below `HOP_CAP` (90 state × regime pairs), round-2 set vs round-1 set | **0 divergences** — nothing widened where `feature_changed` must be inert |
| At/above cap, round-2 set vs independently computed union of both `fc` branches | **exact match on all 18 states**, both regimes |
| Round-1's 9 divergent states | **all 9 closed** at hop=10 and hop=25 |
| `qa-engineer:PASS @ hop=10` | `{pm, researcher, design-auditor, release-engineer}` — identical to the no-cap set |
| Live 07-23 shape (`qa-engineer:FAIL` + `next_role=design-auditor`, hop=3) | still WARNS, remedy `pm, sr-engineer` |
| E37 shape (`qa-engineer:PASS` + `next_role=design-auditor`) | SILENT at hop=2 **and** hop=10 |
| `pm:In_Progress` + `next_role=code-reviewer` | SILENT (resume_of whitelist intact) |

The corrected comment at `:1259-1287` now says the right thing: the three round caps have no `feature_changed` term so the counters alone reproduce their collapse, while `HOP_CAP` reads it and therefore needs the union. That matches `transitions.ts:371/382/397` vs `:417-422` exactly. Good.

### C2 (BLOCKING) — `tools/handoff-orchestrator.ts:1537` — the self-loop filter empties the remedy list on two reachable states, printing a categorically false message

```ts
            for (const e of effective) {
              if (e.agent === nextTuple.agent) continue; // self-loop: not routing advice
```

Excluding every candidate whose **agent** matches conflates two different things. The genuine self-loop is the `In_Progress → In_Progress` fast path (`transitions.ts:432-440`). A same-agent **status change** — `qa-engineer:In_Progress → qa-engineer:PASS`, `sr-engineer:In_Progress → sr-engineer:Blocked` — is a normal table edge (`:241-245`, `:219-223`) and is very often *the* correct next move. The filter discards both.

On two states every legal successor is same-agent, so the filter empties the list entirely and the fallback fires:

| state written | real successors | printed remedy |
|---|---|---|
| `qa-engineer:In_Progress` | `qa:PASS`, `qa:FAIL`, `qa:Blocked`, `qa:In_Progress` | `(none — no successor is currently reachable from this state)` |
| `pm:Blocked` | `pm:In_Progress`, `pm:Blocked` | `(none — no successor is currently reachable from this state)` |

Both hold with **zero caps armed**, at any `hop_count`. This is strictly worse than round 1, where the same shapes printed a useless-but-true `code-reviewer` / `pm`: round 2 upgrades them to concise and false. It also resurrects, as live output, the exact branch I proved unreachable in round 1 — which is the specific regression the re-review brief asked me to look for.

**Reachability is not marginal.** `qa-engineer:In_Progress` is entered from `code-reviewer:In_Progress` (`transitions.ts:231`) — the APPROVED handoff this very role writes — and from `qa-engineer:Blocked` (`:248`). Any write landing there whose `next_role` is not `qa-engineer` fires the advisory and gets the false text. `pm:Blocked` is entered from `null:null`, `researcher:In_Progress`, `pm:In_Progress` and itself; a PM writing `Blocked` with `next_role="sr-engineer"` ("blocked, need engineering to unwedge this") is an entirely natural directive and produces the false text too.

I proposed the blunt `agent === nextTuple.agent` exclusion in round-1 Q2, so this one is on me as much as on the implementation — but the other half of that suggestion (print `agent:status` pairs) is what prevents it, and only the first half was taken.

**Preferred fix** — narrow the exclusion to the true self-loop and print pairs, which makes the same-agent survivors informative instead of confusing:

```ts
            for (const e of effective) {
              // Exclude ONLY the In_Progress→In_Progress self-loop fast path
              // (transitions.ts:432-440) — "keep working as yourself" is not
              // routing advice. A same-agent STATUS CHANGE (qa:In_Progress →
              // qa:PASS/FAIL/Blocked, sr:In_Progress → sr:Blocked) is a real
              // table edge and is frequently the correct next move; dropping
              // it emptied the remedy list on qa-engineer:In_Progress and
              // pm:Blocked, whose successors are ALL same-agent.
              if (e.agent === nextTuple.agent && e.status === nextTuple.status) continue;
              …
            }
```

paired with keying the map on `` `${e.agent}:${e.status}` `` so the printed entries are pairs. Verified outputs under that shape, all non-empty and all true:

- `qa-engineer:In_Progress` → `qa-engineer:PASS, qa-engineer:FAIL, qa-engineer:Blocked` — the genuinely actionable answer ("QA must write its own verdict; no hand-off is legal from here")
- `pm:Blocked` → `pm:In_Progress`
- `sr-engineer:In_Progress` → `pm:In_Progress, sr-engineer:Blocked, code-reviewer:In_Progress` (round 2 currently drops the legitimate `sr-engineer:Blocked` option)
- `code-reviewer:In_Progress @ hop=10` → `code-reviewer:FAIL, code-reviewer:Blocked, qa-engineer:In_Progress`
- `pm:In_Progress` → `…, code-reviewer:In_Progress (only legal with resume_of set), qa-engineer:In_Progress (only legal with resume_of set)` — annotation still lands correctly

**Minimal alternative** if you want to keep the agent-level dedupe: keep the current filter, but fall back to the unfiltered list when the filtered one is empty. That removes the false statement in ~2 lines. It is strictly worse than the above (it still tells a `qa-engineer:In_Progress` writer to "re-route to qa-engineer", and still hides `sr-engineer:Blocked`), but it clears the blocker.

Either way the `"(none — …)"` fallback goes back to being unreachable, which is where round 1 established it belongs.

### Re-review question 3 — `isLegalSuccessor` against the generous set is deliberate and correct

Confirmed, and it should stay. `isLegalSuccessor` (`:1522`) tests `effective` (assumed `resume_of`), while `strict` (`:1530`) exists **only** to classify entries for printing — it is never consulted by the fire/no-fire decision. That separation is right: switching the predicate to `strict` would make `pm:In_Progress` + `next_role=code-reviewer` warn, which is precisely false-positive source (a) that the backlog row mandates be whitelisted, and would re-open a C1-class defect. The `strict` set is presentational, the generous set is decisional, and the asymmetry is the under-warn bias working as designed. Not an inconsistency.

### Re-review question 2, second half — the `resume_of` annotation does not mislead in the other direction

I enumerated every state that produces an annotated entry: exactly one, `pm:In_Progress`, yielding `code-reviewer (only legal with resume_of set)` and `qa-engineer (only legal with resume_of set)`. No spurious annotation anywhere else, and no unconditional edge is mislabelled — the per-agent `hasUnconditional.get(e.agent) || unconditional` fold is order-insensitive and correctly reports an agent as unconditional if *any* of its edges is. A PM who can legitimately set `resume_of` reads the parenthetical as the precondition to satisfy, not as a closed door; it names the exact field. If you want it airtight, `(only legal with resume_of="<agent>")` removes the last ambiguity about what the field's value must be — cosmetic, take it or leave it.

---

## Quality

**N1 (non-blocking) — the union's mirror cost: at hop cap the remedy list names edges that are legal only if the next write opens a new feature.** Nine states at `hop_count >= HOP_CAP`, e.g. `qa-engineer:FAIL @ hop=10` prints `pm, sr-engineer` although `sr-engineer` same-feature is `HOP_CAP_EXCEEDED` — and from a QA failure you are not opening a new feature, so in practice only `pm` is reachable. This is the direct, accepted cost of the union I asked for in round 1 and it is far better than round 1's outright false *warning*; the writer also already has the hop-cap-cross sentinel at `:1441-1444`. But the fix is nearly free and reuses the machinery Q2 just built: compute a third set with `feature_changed` pinned to `false` and annotate union-only entries symmetrically —

```
sr-engineer (only legal if the next write opens a new feature)
```

Same strict-vs-generous diff pattern, same `hasUnconditional`-style fold, ~6 lines. Worth doing while the block is open; not worth another round on its own.

**N2 (non-blocking, carried) — Q4 try/catch placement** left as-is per round 1. Still fine: non-throwing in practice, same structural exposure as the E28 block above it.

**Positives.** The `options: { assumeResumeOf?: boolean } = {}` parameter with a `true` default is the right shape — existing call sites keep the safe generous behavior and the strict variant is explicitly opted into. The comment block at `:1249-1287` is now accurate about all three whitelist classes plus the `feature_changed` unknown, and it correctly frames the hop-cap union as the same "unknowable future input" shape as `resume_of`, which is a genuinely useful piece of reasoning to leave behind. `strict` is computed lazily inside the `!isLegalSuccessor` branch, so the 128-call worst case only occurs on writes that actually warn.

---

## Architecture

Unchanged from round 1 and still sound: no `GATE_REGISTRY` entry, no `ALL_GATE_CODES` addition, no pipeline step, one shared envelope mutation, `next_role` still advisory-only, `tools/transitions.ts` untouched, `dist/` in parity. The second `effectiveAllowedSuccessors` call reuses the single authority rather than introducing a parallel notion of "conditionally allowed" — the same reason the round-1 design was right.

---

## Security

No findings. Unchanged surface: `next_role`, `nextTuple.agent` and `nextTuple.status` remain zod-enum-constrained before reaching the interpolation; the new `" (only legal with resume_of set)"` suffix is a compile-time literal.

---

## Performance

No regression. The helper doubles to 64 calls on a warning-eligible write, and the `strict` recomputation adds another 64 **only on writes that actually warn** (guarded by `!isLegalSuccessor`, `:1523`). Worst case 128 pure in-memory calls, each a few string compares plus at most one `Map.get` over a ≤6-entry array — immaterial next to the file lock, `stat` and atomic rename the write has already performed. Both loop bounds remain compile-time constants; no new I/O, no retained state.

---

## Verdict

**CHANGES_REQUESTED** — C1 is genuinely closed and I verified it by re-running the enumeration that found it (0 divergences below cap, exact union at/above, all 9 states closed, primary AC unregressed); but Q2's self-loop exclusion is over-broad and empties the remedy list on `qa-engineer:In_Progress` and `pm:Blocked` — two states reachable with no cap armed, one of them created by this role's own APPROVED handoff — resurrecting the `"(none …)"` branch as live, categorically false output; narrowing the exclusion to the true `In_Progress→In_Progress` self-loop and printing `agent:status` pairs fixes it in a few lines.

---

## Round 3 — APPROVED — by code-reviewer

## Summary

- **C2 closed, N1 closed, no new findings. APPROVED.** Both halves of the round-2 fix landed this time: the exclusion is narrowed to the exact `(agent, status)` pair (`:1667`) and the dedup/annotation is rekeyed to pairs, which is what makes the narrowed filter informative rather than ambiguous.
- **Re-verified everything by enumeration against compiled `dist/`, transcribing the round-3 helper and message block verbatim from `dist/tools/handoff-orchestrator.js:1198-1226` and `:1553-1578`.** 18 reachable states × 9 counter regimes (my round-2 eight plus `review=4+hop=10`). Zero empty remedy lists on any reachable combination; all three round-2-broken outputs match the exact expected text I specified.
- **The `pm:In_Progress` unreachability claim holds, and holds structurally rather than empirically** — see A below. I also found one more excluded combination than was declared (5, not 4), which is an artifact of my extra regime, not a missed case.
- **N1's new annotation logic is correct in every state that emits it.** I verified all 273 printed pairs across all 162 combinations against `validateTransition` ground truth in *both* directions — annotated ⇒ the claim is true, unannotated ⇒ the pair is legal unconditionally (same feature, no `resume_of`). **0 incorrect.** The new-feature clause is hop-cap-exclusive, as it must be.
- `npx tsc --noEmit` clean; `npm test` **1623 / 1623 pass, 0 fail** — both run by me, not taken from the handoff. `tools/transitions.ts` untouched, no test file touched, `dist/` in parity.
- Two follow-ups named below rather than held against the ticket, per the cap-round framing. Neither is a defect in this diff.

---

## Correctness

### A. The 4 excluded `pm:In_Progress` × round-cap combinations — verified, and the reasoning is stronger than "analytically unreachable"

This was the right thing to flag, because it is load-bearing: if a round cap *could* be armed on a `pm:In_Progress` landing, `effective` would collapse to `[{pm, In_Progress}]`, the pair filter would remove that single entry as the just-written pair, and the `"(none — …)"` fallback would go live and false. The exclusion is the only thing standing between this ticket and a re-run of C2.

**It holds, on two independent grounds.**

*Structural.* All three counters reset in terminal `else if` arms keyed on nothing but `next`:

```
transitions.ts:539   else if (next.agent === "pm" && next.status === "In_Progress") qa_round = 0;
transitions.ts:549-551 } else if (next.agent === "pm" && next.status === "In_Progress") { review_round = 0; }
transitions.ts:563-564 } else if (next.agent === "pm" && next.status === "In_Progress") { visual_round = 0; }
```

No arm above any of them can match simultaneously — each preceding branch requires `next.agent` to be `qa-engineer` or `code-reviewer`. There is no dependence on `prev`, on `feature_changed`, or on `next_pending_notes`. And `computeNewRound` is the **single** producer: one call site, `handoff-orchestrator.ts:1426`, whose destructured outputs feed both the persisted write (`:1489-1492`) and the advisory's `counters` object (`:1657-1662`). So when `nextTuple` is `pm:In_Progress`, the counters handed to `effectiveAllowedSuccessors` are *necessarily* `0/0/0` — not "in practice", but by construction of the same expression that persists them.

*Empirical.* 33,750 `(pm, In_Progress)` landings — every `prev` tuple including the `null:null` opener, `{0,1,3,4,9}³` counter inputs, both `feature_changed` values, and three `pending_notes` shapes including a `visual_fail:` token — **0 failed to reset all three**. `hop_count` correctly survives (DR-6).

Two notes on the sweep itself. First, my run finds **5** empty-remedy combinations, not 4: `pm:In_Progress` × `{qa=4, review=4, visual=6, qa=4+hop=10, review=4+hop=10}`. The fifth is only because I added a `review=4+hop=10` regime that the round-3 sweep did not have; it is the same state under the same unreachable precondition, so this is a coverage difference, not a missed case. Second — and this is the part worth writing down — **the `"(none …)"` fallback's deadness is no longer self-evident from the file it lives in.** In round 1 it was dead because no reachable state has an empty `ALLOWED` row, a fact local to `transitions.ts`. It is now dead because of a *cross-module* invariant: `computeNewRound` resets all three round counters on every `pm:In_Progress` landing. That is exactly the class of thing the brief warned about — true until a later edge makes it false. Not a defect; filed as F1 below.

### B. Pair-keyed rewrite — no regression against my own 18 × 9 sweep

| state | round-3 remedy | round-2 |
|---|---|---|
| `qa-engineer:In_Progress` | `qa-engineer:PASS, qa-engineer:FAIL, qa-engineer:Blocked` | `(none — …)` **false** |
| `pm:Blocked` | `pm:In_Progress` | `(none — …)` **false** |
| `sr-engineer:In_Progress` | `pm:In_Progress, sr-engineer:Blocked, code-reviewer:In_Progress` | dropped `sr-engineer:Blocked` |
| `code-reviewer:In_Progress @ hop=10` | `code-reviewer:FAIL, code-reviewer:Blocked, qa-engineer:In_Progress (only legal if the next write opens a new feature)` | `qa-engineer` (unannotated, over-promised) |

All three of my round-2 expected outputs are matched exactly. Primary ACs unregressed: live 07-23 shape warns (`pm:In_Progress, sr-engineer:In_Progress`); E37 shape silent at hop 2 **and** hop 10; `pm:In_Progress + next_role=code-reviewer` silent; `sr-engineer` self-loop silent.

### C. Both new annotations are true in every state that emits them

273 printed pairs across 162 combinations, each clause checked against `validateTransition` directly:

- annotated `resume_of` ⇒ the pair really is illegal without `next_resume_of` and legal with it — **0 violations**;
- annotated new-feature ⇒ the pair really is illegal at `feature_changed=false` and legal at `true` — **0 violations**;
- **unannotated ⇒ legal unconditionally** (no `resume_of`, same feature) — **0 violations**. This is the direction that would catch a silent over-promise, and it is clean.

The non-obvious part is that the two comparison sets use *different* defaults, and both choices are load-bearing in opposite directions:

- `strict` (`:1652`) passes `assumeResumeOf: false` and lets `featureChanged` default to the **union**. Had it pinned `featureChanged: false`, then at hop cap every non-`pm` pair would be missing from `strictKeys` and would acquire a spurious `resume_of="sr-engineer"`-style clause — naming a value the `resume_of` enum does not even accept.
- `sameFeatureOnly` (`:1662`) pins `featureChanged: false` and lets `assumeResumeOf` default to **true**. Had it passed `false`, the two `pm:In_Progress` resume-edges would acquire a spurious new-feature clause.

Both traps are avoided, and the composition renders correctly when a pair needs both: `pm:In_Progress @ hop=10` prints `code-reviewer:In_Progress (only legal with resume_of="code-reviewer"; only legal if the next write opens a new feature)` — and I confirmed that is genuinely true, since the hop-cap gate (`transitions.ts:417-422`) precedes the Amend-Resume check (`:452-460`), so both conditions really are required.

One structural safety property worth recording: the `resume_of` clause interpolates `e.agent` generically, so a clause naming a non-`resume_of`-eligible agent would be nonsense. It cannot happen — `assumeResumeOf` only alters `next_resume_of`, which is read only at rule 3.5, which requires `next.agent ∈ {code-reviewer, qa-engineer}`. So `effective \ strict ⊆ {code-reviewer, qa-engineer}` pairs by construction, confirmed empirically across all 162 combinations.

### D. New-feature clause is hop-cap-exclusive

Zero occurrences below `HOP_CAP` across all states and sub-cap regimes, as required — `feature_changed` is inert there, so `sameFeatureKeys` equals `effective`.

---

## Quality

Clean. `featureChangedBranches = featureChanged === undefined ? [false, true] : [featureChanged]` is the right way to add the option — the tri-state (`undefined` = union, `false`/`true` = pinned) keeps every existing call site byte-identical in behavior, and the default-union is the safe default. The `clauses` array + `join("; ")` composes without special-casing the both-clauses path. The round-3 comment block accurately records *why* round 2 was wrong, which is the kind of provenance that stops the next person re-introducing it.

Both extra `effectiveAllowedSuccessors` calls remain inside the `!isLegalSuccessor` branch, so the cost is paid only by writes that actually warn.

---

## Architecture

Unchanged and still sound: no `GATE_REGISTRY` entry, no `ALL_GATE_CODES` addition, no pipeline step, one shared envelope mutation appended not clobbered, `next_role` still advisory-only, strictly post-`writeState`, `tools/transitions.ts` untouched. All three sets are derived from the one authority (`validateTransition`) rather than a parallel re-derivation — the same reason the original design was right, now applied three times.

---

## Security

No findings. `next_role`, `nextTuple.agent`, `nextTuple.status` and `e.agent` are all enum-constrained values; the annotation clauses are compile-time literals plus an enum interpolation. Output is `JSON.stringify`d into the envelope.

---

## Performance

No regression. Warning-free writes carrying `next_role` pay 64 pure in-memory calls; writes that warn pay 64 + 64 + 64 = 192, each a few string comparisons plus at most one `Map.get` over a ≤6-entry frozen array. Immaterial against the file lock, `stat` and atomic rename already performed. Both loop bounds remain compile-time constants; no I/O, no retained state, no cache.

---

## Follow-ups — named, not held against this ticket

**F1 — pin the invariant the `"(none …)"` fallback now depends on.** Its deadness rests on `computeNewRound` resetting all three round counters on every `pm:In_Progress` landing (`transitions.ts:539/550/563-564`). That invariant lives in a different module from the fallback and nothing currently pins it, so a future counter-semantics change could make a categorically false message go live with no test failing. Cheapest fix is a one-line cross-reference comment at the fallback plus a unit test asserting `computeNewRound(q, r, v, {agent:"pm", status:"In_Progress"}, …)` returns `0/0/0` for arbitrary inputs. Backlog row, not this ticket.

**F2 — E38 ships with zero coverage of itself.** Correct per §2 (tests are qa-engineer's), but flagging the natural pins so they are not missed: the live 07-23 shape warns and names `pm:In_Progress, sr-engineer:In_Progress`; the E37 shape is silent at hop 2 *and* hop 10 (the C1 regression pin); `qa-engineer:In_Progress` and `pm:Blocked` produce non-empty remedies (the C2 regression pin); the new-feature clause never appears below `HOP_CAP`; and an unannotated pair is always legal same-feature without `resume_of`.

**F3 — procedural, no code impact.** The `## Round 3 reply — sr-engineer` section was appended into this file at line 340. This artifact is the reviewer's, is consumed by `MISSING_REVIEW_EVIDENCE`, and is append-only *across reviewer rounds*; implementer responses belong in `pending_notes`. The concrete cost is that the round sections are now interleaved, so a reader scanning for `## Round N — VERDICT — by code-reviewer` hits an implementer section between rounds 2 and 3. I have left it in place rather than delete another role's text — please relocate it to the handoff. Not a defect and it did not affect this verdict.

---

## Verdict

**APPROVED** — C2 and N1 are both genuinely closed, verified by re-running the enumeration that found them rather than by reading the diff: zero empty remedy lists across 162 state × regime combinations, all 273 printed pairs correct against `validateTransition` ground truth in both directions, the new-feature annotation hop-cap-exclusive, every primary AC unregressed, and the `pm:In_Progress` unreachability exclusion verified structurally (single-site `computeNewRound`, three unconditional `else if` arms) as well as across 33,750 landings.

---

## Appendix A — implementer round-3 reply (sr-engineer)

> Relocated 2026-07-27 by the coordinator, at the reviewer's F3 request. This section was originally authored inline between rounds 2 and 3, which interleaved an implementer section into a sequence of `## Round N — VERDICT — by code-reviewer` headings. Content is preserved verbatim; only its position changed. Review reports are the reviewer's artifact — implementer responses belong in `pending_notes`.

Applied the preferred fix exactly as specified, plus N1 while the block was open.

- **C2 fixed** (`tools/handoff-orchestrator.ts:1671`, now the pair-exact exclusion): `if (e.agent === nextTuple.agent && e.status === nextTuple.status) continue;` — narrows the exclusion to the exact `(agent,status)` pair just written, not every same-agent candidate. `strictKeys` / `sameFeatureKeys` are now keyed on `` `${agent}:${status}` `` and the printed list is `agent:status` pairs, not deduped bare agent names.
- **`resume_of` annotation carried to the pair form**, and took the optional cosmetic: `(only legal with resume_of="<agent>")` names the exact value (cheap, removes the last ambiguity the round-2 review flagged).
- **N1 applied**: `effectiveAllowedSuccessors` gained a `featureChanged` option (default `undefined` = union both branches, unchanged from round 2; pass `false` to pin the same-feature-only subset). A third call with `featureChanged: false` isolates hop-cap union-only entries, annotated `(only legal if the next write opens a new feature)`. The two annotations compose independently and can co-occur (verified on `pm:In_Progress @ hop=10`, where `code-reviewer:In_Progress` needs both `resume_of` and a feature change, since the hop-cap gate is checked before the Amend-Resume edge in `transitions.ts`).
- **Verified by enumeration, not by reading the diff**: wrote a probe (scratchpad-only) that imports `validateTransition` + `ALLOWED_TRANSITIONS` from the compiled `dist/tools/transitions.js` and transcribes the round-3 message-building logic verbatim from `dist/tools/handoff-orchestrator.js`. Reachable landing states were extracted *programmatically* from `ALLOWED_TRANSITIONS`' values (not hand-listed) — confirms exactly 18, matching both prior rounds. Swept all 18 × 8 counter regimes (no-cap, hop=9/10/25, qa=4, review=4, visual=6, hop=10+qa=4) = 144 combinations: **0 empty remedy lists on any reachable combination.** 4 combinations (`pm:In_Progress` paired with a round-cap regime) are analytically unreachable — a write landing on `pm:In_Progress` always resets `qa_round`/`review_round`/`visual_round` to 0 in `computeNewRound` (`transitions.ts:539/550/563-564`; only `hop_count` survives that landing, DR-6) — and were excluded from the "must be non-empty" check accordingly, not silently dropped.
  - `qa-engineer:In_Progress` → `qa-engineer:PASS, qa-engineer:FAIL, qa-engineer:Blocked` (matches the reviewer's exact expected output).
  - `pm:Blocked` → `pm:In_Progress`.
  - `sr-engineer:In_Progress` → `pm:In_Progress, sr-engineer:Blocked, code-reviewer:In_Progress` (recovers `sr-engineer:Blocked`, which round 2 dropped).
  - `code-reviewer:In_Progress @ hop=10` → `code-reviewer:FAIL, code-reviewer:Blocked, qa-engineer:In_Progress (only legal if the next write opens a new feature)`.
- **Primary ACs re-verified, unregressed**: live 07-23 shape (`qa-engineer:FAIL` + `next_role=design-auditor`, hop=3) still warns, remedy `pm:In_Progress, sr-engineer:In_Progress`; E37 shape (`qa-engineer:PASS` + `next_role=design-auditor`) silent at hop=2 **and** hop=10; `pm:In_Progress` + `next_role=code-reviewer` silent (resume_of whitelist intact).
- `npm run build` zero errors, `npx tsc --noEmit` clean, `npm test` 1623/1623, `npm audit --audit-level=high` unchanged (4 pre-existing HIGH transitives: esbuild, fast-uri, js-yaml, sharp — out of scope). `tools/transitions.ts` untouched by this ticket (its only diff is the pre-existing E37 `design-auditor` edge, not part of this change). No test files touched. `dist/` rebuilt and in parity.
