# Review — T-E128-02 (feature `e128-blocked-self-loop`, round 1)

covers: T-E128-01, T-E128-02, T-E128-03

**Reviewer**: code-reviewer (opus) — clean context, adversarial.
**Base**: `feat/e92-e86-e128-wave1-state-trans` @ `c35dcf8`, lane worktree
`<lanes-root>/e92-e86-e128`.
**Contract**: the E128 row of `docs/backlog.md:250` (no per-feature spec file).
**Diff under review** (scoped away from the closed L-STATE E92/E86 work in
`tools/registry.ts` + `tools/handoff-parse.ts`, which is NOT reviewed here):
`tools/transitions.ts`, `specs/qa-flow-enforcement-architecture.md` (1 line),
`test/e128-blocked-self-loop-repro.test.mjs` (new),
`qa_reports/expected-red_e128-blocked-self-loop.txt` (new), plus the
corresponding `dist/tools/transitions.*` build output.

## Summary

- `validateTransition`'s step-3 self-loop fast path now accepts same-agent
  `Blocked → Blocked` in addition to `In_Progress → In_Progress`, written as an
  OR of two **explicit named `(prev, next)` status pairs** — verified in source
  and in the compiled artifact that it is NOT a `prev.status === next.status`
  wildcard (`tools/transitions.ts:531-537`).
- The static `ALLOWED` map is **byte-identical** to base: a full `diff -u` of
  `git show HEAD:dist/tools/transitions.js` against the rebuilt
  `dist/tools/transitions.js` shows exactly two hunks — the precedence JSDoc and
  the fast-path conditional. Nothing else in the compiled module changed.
- **Accepted-edge delta verified by computation, not assertion**: an exhaustive
  sweep of the full 1440-tuple space (9 prev agents incl. `null` x 5 prev
  statuses incl. `null` x 8 next agents x 4 next statuses) against the pre-fix
  and post-fix compiled modules gives **69 → 76, exactly +7, zero removals**.
  The 7 added tuples are precisely `<role>:Blocked -> <role>:Blocked` for
  architect, code-reviewer, design-auditor, qa-engineer, release-engineer,
  researcher, sr-engineer. `pm` contributes none — it already had a static
  `pm:Blocked -> pm:Blocked` row. sr-engineer's claimed arithmetic is correct.
- PASS terminality confirmed **structurally**, not assumed: `PASS → PASS` and
  `FAIL → FAIL` are rejected for **all 8 roles** post-fix, and no same-agent
  same-status pair other than `In_Progress` and `Blocked` appears anywhere in
  the 76-edge accepted set.
- Verdict: **APPROVED**. One advisory finding filed as `NEW-5` (P3,
  non-blocking): the `TRANSITION_REJECTED` envelope's `allowed` hint list is
  table-derived and therefore does not advertise the newly-legal self-loop for
  the 7 non-pm roles.

## Correctness

**No blocking findings.** Everything below was established by executing the
compiled modules, not by reading the diff.

### C1 — Accepted-edge differential (the "what else did this admit?" question)

Sweep harness: both compiled modules loaded side by side, every
`(prev.agent ∈ {null}∪8 roles) x (prev.status ∈ {null}∪4) x (next.agent ∈ 8) x
(next.status ∈ 4)` tuple evaluated with all counters at 0 and
`next_resume_of` unset.

```
[before] swept=1440 accepted=69
[after]  swept=1440 accepted=76
ADDED (after - before):
  architect:Blocked        -> architect:Blocked
  code-reviewer:Blocked    -> code-reviewer:Blocked
  design-auditor:Blocked   -> design-auditor:Blocked
  qa-engineer:Blocked      -> qa-engineer:Blocked
  release-engineer:Blocked -> release-engineer:Blocked
  researcher:Blocked       -> researcher:Blocked
  sr-engineer:Blocked      -> sr-engineer:Blocked
REMOVED (before - after): (none)
```

Exactly +7, one per role except `pm`. No edge was removed or altered. The
honest claim in the dispatch brief holds.

### C2 — PASS / FAIL terminality, all 8 roles

Same-agent same-status probe against the post-fix module:

| role | In_Progress | PASS | FAIL | Blocked |
|---|---|---|---|---|
| pm | ACCEPT | reject | reject | ACCEPT |
| researcher | ACCEPT | reject | reject | ACCEPT |
| design-auditor | ACCEPT | reject | reject | ACCEPT |
| architect | ACCEPT | reject | reject | ACCEPT |
| sr-engineer | ACCEPT | reject | reject | ACCEPT |
| code-reviewer | ACCEPT | reject | reject | ACCEPT |
| qa-engineer | ACCEPT | reject | reject | ACCEPT |
| release-engineer | ACCEPT | reject | reject | ACCEPT |

8/8 reject `PASS→PASS`; 8/8 reject `FAIL→FAIL`. The E86 on-record case
(`qa-engineer:PASS → PASS` correctly rejected) is preserved. The named-pair
shape delivers what the cut was approved for: PASS terminality is unreachable
through this fast path by construction, not merely by omission of a test.

### C3 — Interaction with the round caps (fast path sits *after* them)

Probed at each cap boundary (`ROUND_CAP=4`, `REVIEW_ROUND_CAP=4`,
`VISUAL_ROUND_CAP=6`, `HOP_CAP=10`), for the new `Blocked` self-loop and the
pre-existing `In_Progress` self-loop as control:

| precondition | Blocked self-loop (new) | In_Progress self-loop (control, post-fix) | In_Progress self-loop (pre-fix baseline) |
|---|---|---|---|
| `qa_round >= 4` | reject `QA_ROUND_EXCEEDED` | reject `QA_ROUND_EXCEEDED` | reject `QA_ROUND_EXCEEDED` |
| `review_round >= 4` | reject `REVIEW_ROUND_EXCEEDED` | reject `REVIEW_ROUND_EXCEEDED` | reject `REVIEW_ROUND_EXCEEDED` |
| `visual_round >= 6` | reject `VISUAL_ROUND_EXCEEDED` | reject `VISUAL_ROUND_EXCEEDED` | reject `VISUAL_ROUND_EXCEEDED` |
| `hop_count >= 10` | ACCEPT | ACCEPT | ACCEPT |

The three round-cap overrides correctly dominate the new edge — verified for
**all 8 roles**, not just one (`all 8 blocked by cap` at each of the three
caps). The `hop_count` pass-through is **correct and pre-existing**, not a
regression: the hop-cap predicate at `tools/transitions.ts:508` requires
`req.next.agent !== req.prev.agent` (DR-9 — self-loops are not counted role
transitions), so it has never applied to any self-loop. The post-fix
`In_Progress` control is byte-for-byte identical to the pre-fix baseline,
confirming the new pair changed nothing about cap precedence. The spec sentence
that already said caps deny "all other entries (including the self-loop fast
path)" remains accurate under the widened definition of "self-loop".

### C4 — `computeNewRound` does not tick on the new edge

`computeNewRound(qa=1, review=2, visual=3, next=<role>:Blocked,
prev=<role>:Blocked, notes=[], hop=5, feature_changed=false, totals=7/8/9)`
returns `{qa_round:1, review_round:2, visual_round:3, hop_count:5,
qa_rounds_total:7, review_rounds_total:8, visual_rounds_total:9}` — identical
in, identical out — for **all 8 roles**. No counter increments, and the hop
count is unmoved because `next.agent === prev.agent`. Self-loops remain
uncounted for hop purposes as intended.

### C5 — End-to-end through the 18-step pipeline (what the unit sweep cannot see)

`validateTransition` is pure; acceptance there does not by itself prove the
write lands. I drove the real orchestrator (`handleGetState` +
`handleUpdateState` from the rebuilt `dist/`) against a throwaway workspace in
the scratchpad, reproducing the incident shape:

```
pm:In_Progress -> sr-engineer:In_Progress -> sr-engineer:Blocked
   (blocking_reason: 'MALFORMED <parameter name="pending_notes">leaked')
-> sr-engineer:Blocked  (the repair)   => success
```

Post-repair on-disk state: `blocking_reason: "REPAIRED: awaiting human on
tagged unpushed release"`, `status: "Blocked"`, `last_agent: "sr-engineer"`,
`hop_count: 2` (unchanged across both self-loop writes), corrected
`pending_notes` persisted. This is the property the E128 backlog row actually
asks for and it is delivered: the record is repaired **in place**, without
misstating status as `In_Progress` and therefore **without** emitting the
`next_role: pm` terminal marker that would release the feature lease while a
tagged, unpushed release waits on a human.

### C6 — Expected-red manifest sampling (SOP 4a, `dispatch_mode: bugfix`)

`qa_reports/expected-red_e128-blocked-self-loop.txt` exists and carries two
`<file> | <test name>` entries; both sampled (2 entries < 3, so all sampled):

1. `test/e128-blocked-self-loop-repro.test.mjs | E128 repro: release-engineer:Blocked -> release-engineer:Blocked is accepted (the incident case, fixed)`
   — located verbatim in the named file. **Genuineness proven by execution,
   not inspection**: the test body was run unmodified against the pre-fix
   compiled module (`git show HEAD:dist/tools/transitions.js`) and against the
   post-fix one, with only the import path rewritten:
   `pre-fix → # pass 0 / # fail 1`, `post-fix → # pass 1 / # fail 0`. It would
   genuinely have been red before the fix. It is also non-vacuous: it asserts
   `validateTransition(...) === null` with the rejection envelope in the
   failure message, and it targets the literal incident role.
2. `test/qa-flow.test.mjs | T-E53-03(h): exhaustive matrix sweep — accepted edge set is EXACTLY the 69 tuples ...`
   — located verbatim at `test/qa-flow.test.mjs:2367`. Confirmed to be the
   single failing test in the suite (`not ok 1308`, same string). Its `69` is
   exactly the count my independent sweep measured pre-fix, and `69 + 7 = 76`
   is exactly what I measured post-fix, so the manifest's stated arithmetic is
   independently confirmed rather than taken on trust. Correctly attributed to
   qa under `T-QA-E128-01`.

Suite state: `npm test` → **2008 pass / 1 fail of 2009**, the single failure
being the declared intentional red above. **No other red.** `npx tsc` clean via
`npm run build`; `npm run check:version` clean.

### C7 — Guard preserved

The `req.prev.agent !== null` guard is retained ahead of the widened pair test
(`tools/transitions.ts:532`), so a `null:null` prev cannot match. Confirmed by
the sweep: no `null:*` edge was added.

## Quality

### Q1 (advisory, filed as NEW-5) — the rejection hint does not advertise the new edge

`rejection()` builds its `allowed` array from the static `ALLOWED` table
(`tools/transitions.ts:565-566`), which the cut deliberately left untouched.
Consequence, measured post-fix on a rejected write from a `Blocked` prev:

| prev | `allowed` hint returned to the caller | advertises its own self-loop? |
|---|---|---|
| `pm:Blocked` | pm:In_Progress, **pm:Blocked**, design-auditor:In_Progress | yes |
| `sr-engineer:Blocked` | sr-engineer:In_Progress, pm:In_Progress, design-auditor:In_Progress | no |
| `release-engineer:Blocked` | release-engineer:In_Progress, pm:In_Progress, qa-engineer:In_Progress | no |
| `qa-engineer:Blocked` | sr-engineer:In_Progress, qa-engineer:In_Progress, pm:In_Progress | no |
| `architect:Blocked` | pm:In_Progress, architect:In_Progress | no |

The `release-engineer:Blocked` row is *verbatim the three edges the E128
backlog row cites as what the stranded role was shown on 2026-09-15* — and it
is unchanged by this fix. A role that hits a different rejection while Blocked
is still told the same three edges and never learns self-correction is now
legal. `pm`, whose table row is redundant, is the only role that does get told.

**Why this is not a blocker**: the repair write itself succeeds (C5); only the
*guidance printed on some other rejected write* is incomplete, and the backlog
row scopes the defect to "a same-agent, same-status record correction has no
edge at all", which is fixed. Filed as `NEW-5` in `NEW-TICKETS.md`.

Worth recording for whoever picks NEW-5 up: the orchestrator's *other*
allowed-successor surface, `effectiveAllowedSuccessors`
(`tools/handoff-orchestrator.ts:1324-1364`), is **not** affected — it derives
its list by calling `validateTransition` exhaustively over all
(agent, status) pairs, so it picked the new edge up automatically. Only the
table-derived `rejection().allowed` is stale. That asymmetry is the whole bug
and also the hint at its fix.

### Q2 — the now-redundant `pm:Blocked -> pm:Blocked` table row: right call, but uncommented

`tools/transitions.ts:208` is now double-covered (fast path at :531 returns
`null` before the table lookup at :565 is ever reached). **Confirmed no
double-accept side effect** — `validateTransition` returns on first match,
there is no accumulator, and `pm:Blocked -> pm:Blocked` appears exactly once in
the accepted-edge set in both before and after sweeps.

I judge **leaving the row is the correct call for this cut**, and it is what
`tasks.md:366` (T-E128-03) explicitly instructs. Removing it would force a
coordinated `specs/...md:157` mirror edit to keep `check:transitions-sync`
green, and would *equalize downward* — pm would lose the one accurate hint
rather than the other 7 gaining one. It is also a *self-detecting* trap rather
than a live one: a future editor who deletes the row gets a loud
`check:transitions-sync` failure, and the behavior would be unchanged anyway
because the fast path covers it.

**Nit (non-blocking, not requested by any ticket)**: the entry at :208 carries
no comment of its own — the long E58 comment block at :209-217 belongs to the
`design-auditor` entry beneath it. A one-line `// (E128) redundant with the
step-3 fast path; retained deliberately — removing it requires a matching
spec:157 edit for check:transitions-sync.` would close the gap. This is the
inverse of the comment-drift failure this chain was burned by twice: not a
comment that outlived its code, but a code line whose rationale silently
changed with no comment at all. Recorded as a rider on NEW-5 rather than as a
round-2 request, because it is documentation-only, zero-behavior, and outside
what T-E128-02/03 asked for.

### Q3 — prose accuracy at both updated sites (checked for substance, not for having changed)

**JSDoc, `tools/transitions.ts:438-441`.** Claims step 3 accepts same-agent
`In_Progress→In_Progress` or `Blocked→Blocked`, as two named pairs, not a
same-status wildcard, with PASS/FAIL deliberately excluded. Every clause is
true of the code at :531-537 and of the measured behavior (C1, C2). The
precedence ordering it lists (1, 2, 2.5, 3, 3.5, 4) matches the actual control
flow line-for-line: agent_id checks :447-456, three round caps :459-495,
hop cap :508-521, fast path :531, Amend-Resume :551, table :565.

**Spec, `specs/qa-flow-enforcement-architecture.md:175`.** Both predicates are
transcribed correctly. "Either pair matching skips the table lookup and
accepts" is exactly what the code does. The incident citation
(`TRANSITION_REJECTED — No edge release-engineer:Blocked ->
release-engineer:Blocked`) matches `docs/backlog.md:250` verbatim. The
PASS/FAIL exclusion rationale is stated and is true. The only omission at
either site is the `prev.agent !== null` guard, which is immaterial — it is
implied by `prev.agent === next.agent` with a non-null `next.agent`.

Neither site overclaims. I specifically checked for the E92/E86 failure
pattern (prose describing a stronger property than the code delivers) and found
none: if anything the spec text is slightly *more* conservative than the code,
which is the safe direction.

### Q4 — `check:transitions-sync` still green at 21 keys

```
check:transitions-sync — OK (21 keys, exact match between
  dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)
```

Run as `npm run build`'s postbuild step. Independently corroborated two ways:
(a) `git diff -U0` on the spec shows exactly one changed line, `175`, well
outside the mirror table at 149-171; (b) the full compiled-module `diff -u`
shows the `ALLOWED` map literal is byte-identical to base. The table was
genuinely not edited — the stated reason for preferring shape (a) over 7
coordinated table edits holds up.

### Q5 — repro test hygiene

`test/e128-blocked-self-loop-repro.test.mjs` is appropriately minimal for the
bugfix-mode carve-out, carries the `// Coded by @sr-engineer` watermark, states
in its header that it is not full coverage and names `T-QA-E128-01` as the
owner of that, and imports from `dist/` consistently with the surrounding
suite. No dead code, no duplication of existing `test/qa-flow.test.mjs`
coverage.

## Architecture

The change is confined to step 3 of `validateTransition`'s documented
precedence ladder and preserves every ordering invariant the surrounding
architecture depends on:

- **Placed correctly in the ladder.** Sits after the four overrides and before
  Amend-Resume and the table lookup, so the caps still dominate (C3) and the
  Amend-Resume edge is unreachable from a `Blocked` prev anyway (it requires
  `prev.agent === "pm" && prev.status === "In_Progress"`).
- **No new state, no new field, no new `GateErrorCode`, no gate.** Consistent
  with the backlog row's `~2 files` estimate and with the L-TRANS lane's
  declared "no cross-lane dependency".
- **Additive only** — zero edges removed (C1), so no existing chain can break.
- **`ALLOWED` as authoritative source preserved.** The fast path was already an
  acknowledged exception to the table; this widens the existing exception
  rather than introducing a second mechanism. `scripts/check-transitions-sync.mjs`
  continues to pin table↔spec, and `effectiveAllowedSuccessors` continues to
  derive from `validateTransition`, so the two documented sources of truth stay
  consistent.
- No architecture spec file exists for this feature; `docs/backlog.md:250` is
  the contract and the implementation matches it, including its explicit
  framing that the repair must not misstate status or release the lease (C5).

**Lane boundary (execution plan §3) — verified clean.** The feature's diff
touches `tools/transitions.ts`, `specs/qa-flow-enforcement-architecture.md`,
`test/e128-blocked-self-loop-repro.test.mjs`,
`qa_reports/expected-red_e128-blocked-self-loop.txt` and the corresponding
`dist/tools/transitions.*` build output. **No breach**: `gates/*.ts` and
`gates/registry.ts` (L-GATE) untouched; `content/**` untouched;
`test/fixtures/compose-golden/**` untouched; `test/context-budget.test.mjs`
untouched. `tools/registry.ts` and `tools/handoff-parse.ts` are modified in the
worktree but belong to the **closed, qa-PASSed** L-STATE E92/E86 feature and
are not part of this feature's diff — excluded from review as instructed.

## Security

No findings. The change adds two equality comparisons inside a pure function;
no input crosses a trust boundary, no I/O, no secrets, no new parsing.

I additionally checked the change against the four integrity properties the
transition machine exists to protect, since "which invariant did this quietly
weaken?" is the real security question here:

1. **PASS terminality** — intact, proven for all 8 roles (C2). The named-pair
   shape is what makes this structural.
2. **builder != judge (Constitution §3.2)** — unaffected. A self-loop by
   definition does not change `agent`, so no role can reach another role's seat
   through it. All 7 new tuples are `X → X`.
3. **Round-cap escape hatches** — intact, proven at all three cap boundaries
   for all 8 roles (C3). The new edge cannot be used to loop past a cap.
4. **QA evidence gating** — unaffected; the new edge writes `Blocked`, which is
   not a completion status and stamps no evidence.

One residual worth naming, **pre-existing and not widened in kind**: a
`Blocked → Blocked` write refreshes `last_updated` and therefore extends the
feature lease (`tools/handoff-orchestrator.ts:234` — "Blocked counts as held").
An agent could in principle hold a lease indefinitely by self-looping without
progress. This capability already existed via `In_Progress → In_Progress`
self-loops, so E128 adds no new class of abuse — and holding the lease while
Blocked is precisely the behavior the backlog row wants. The `bookkeeping_write`
attestation remains available for genuinely administrative touches.

## Performance

No findings. The fast path grows from two `===` comparisons to at most four,
short-circuited, on a code path that runs once per `tw_update_state`. No loop,
no allocation, no I/O, no complexity-class change. The full accepted-edge sweep
of 1440 tuples x 2 modules completed in well under a second. No regression vs
base.

## Verdict

**APPROVED** — the diff does exactly and only what the E128 row specifies. The
accepted-edge delta is exactly +7 (69 → 76) with zero removals, measured by
exhaustive sweep of both compiled modules rather than asserted; PASS and FAIL
self-loops are rejected for all 8 roles, making PASS terminality structurally
unreachable as the cut approval required; all three round caps still dominate
the new edge; `computeNewRound` ticks nothing; `check:transitions-sync` is green
at 21 keys with the mirror table byte-unchanged; both prose sites accurately
describe the shipped code; the repro is genuine, proven red pre-fix and green
post-fix by execution; and the full incident scenario round-trips through the
real 18-step pipeline. The single advisory finding (NEW-5, stale
`rejection().allowed` hint) is a P3 discoverability gap outside the ticket's
stated defect and does not warrant a round.
