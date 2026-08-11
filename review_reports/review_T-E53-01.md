# Review — T-E53-01

covers: T-E53-01, T-E53-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- `tools/transitions.ts` opens three edges: `release-engineer:In_Progress -> release-engineer:Blocked` (entry), a NEW `release-engineer:Blocked` key with three destinations, and `sr-engineer:Blocked -> design-auditor:In_Progress` (audit gap B). Three matching rows mirrored into `specs/qa-flow-enforcement-architecture.md:159/164/165`. `content/skill-release-engineer.md` converts step 7a's in-SOP halt into a real Escalation Routes row and deletes both now-false "unreachable" claims.
- **AC1–AC4 proven exhaustively against the compiled validator**, not the source table: I enumerated all 33 `prev` × 32 `next` tuples (1056 combos) through `validateTransition` from `dist/tools/transitions.js` and from the base build (`git show HEAD:dist/tools/transitions.js`). Accepted edges went 63 → 68. **Exactly the five intended edges opened; zero edges closed.** AC4 is therefore a proof, not a spot-check.
- AC5 mirror rows verified programmatically — all three parse order-exact against the compiled map. AC6 verified by hash: rows `:152-157` byte-identical to base, the step-7a STOP message byte-identical, the `STOP_QA`/`STOP_RR` trigger block (`:56-83`) byte-identical, zero remaining "unreachable" claims in the file. AC7: `npm run build` clean and idempotent (rebuild produced no dist delta, so the compiled artifact I probed is source-faithful).
- Known-red suite confirmed as characterised: **exactly 2 failures, both in `test/qa-flow.test.mjs` T-MATRIX-C13**, both the `assert.deepEqual` exact-shape pins on the `release-engineer:In_Progress` row (`:1767`, `:1806`). Isolated run of that file gives 136/138, so the other 1539 tests are green. Expected fallout of AC1, qa-engineer's T-E53-03 to retarget. Not a defect.
- **One finding recorded, non-blocking for this cut: gap C.** My independent re-run of the ticket's "audit every role's `:Blocked` reachability in the same pass" instruction found a third instance sr-engineer's audit missed — `pm:Blocked -> design-auditor:In_Progress`. It must NOT be fixed here (that would breach AC4 and the pinned 4-file cut); it needs its own ticket. Verdict: **APPROVED**.

## Correctness

**No blocking findings.**

**AC verification method.** Every acceptance check below was run against `dist/tools/transitions.js` (the compiled validator), since compiling-but-unreachable source is precisely the defect class E53 exists to fix. `npm run build` was re-run first and produced a zero-byte dist delta, so the compiled artifact provably corresponds to the reviewed `tools/transitions.ts`.

**AC1** — `release-engineer:In_Progress -> release-engineer:Blocked`: ACCEPT.

**AC2** — from `release-engineer:Blocked`: `-> pm:In_Progress` ACCEPT, `-> qa-engineer:In_Progress` ACCEPT, `-> release-engineer:In_Progress` ACCEPT. A control probe (`-> architect:In_Progress`) is correctly REJECTED and now returns `allowed=[release-engineer:In_Progress, pm:In_Progress, qa-engineer:In_Progress]`. On the base build the same probe returned `TRANSITION_REJECTED` with `allowed=[]` — the dead-end signature is gone.

**AC3** — `sr-engineer:Blocked -> design-auditor:In_Progress`: ACCEPT. The destination is correct against `content/skill-sr-engineer.md:50` (`visual structure unspecified | Blocked | ... | design-auditor`).

**AC4 — exhaustive, not sampled.** Full 1056-tuple differential between the base and new compiled validators:

```
combos=1056  acceptBase=63  acceptNew=68
NEWLY OPENED (5):
  + sr-engineer:Blocked      -> design-auditor:In_Progress
  + release-engineer:In_Progress -> release-engineer:Blocked
  + release-engineer:Blocked -> pm:In_Progress
  + release-engineer:Blocked -> qa-engineer:In_Progress
  + release-engineer:Blocked -> release-engineer:In_Progress
NEWLY CLOSED (0)
```

The opened set is exactly the intended set with nothing extra, and no previously-legal edge regressed. This closes AC4 as a proof rather than sr-engineer's three-edge spot-check.

**Destination set for the new `release-engineer:Blocked` key — checked against the SOP's own rows, derivation holds.** `content/skill-release-engineer.md:152-158` now carries seven Blocked rows. Their `next_role` cells are: `human` (`:152`, `:154`, `:155`, `:156`, `:157`, `:158`) and `qa-engineer` (`:153`, the `npm test` regression row). `human` is not a matrix agent — a human-directed halt resolves either by the role resuming (`release-engineer:Blocked -> release-engineer:In_Progress`) or by handing to pm for recovery (`:155`'s D10 note literally says "needs coordinator recovery"). Both are offered. `qa-engineer` is offered. **No SOP row implies a destination the new key withholds, and no offered destination is unjustified by a row.** The derivation in the code comment is accurate.

**AC5 — mirror rows.** Parsed the three spec rows and compared to the compiled map; all three match order-exact:

| spec line | key | result |
|---|---|---|
| `:159` | `sr-engineer \| Blocked` | MATCH — `sr-engineer:In_Progress, pm:In_Progress, design-auditor:In_Progress` |
| `:164` | `release-engineer \| In_Progress` | MATCH — `pm:In_Progress, release-engineer:Blocked` |
| `:165` | `release-engineer \| Blocked` | MATCH — `release-engineer:In_Progress, pm:In_Progress, qa-engineer:In_Progress` |

Only these three rows changed. The file's broader drift (missing design-auditor / code-reviewer / release-engineer coverage, the `:158` naming mismatch) is untouched, correctly left to E39 as the cut pins.

**AC6 — SOP reconcile, hash-verified.**
- Rows `:152-157` byte-identical to base (`sha1 1cf631359e...` on both sides). The two byte-pinning assertions (`test/release-staging.test.mjs:757` D10 row, `test/verify-release.test.mjs:701` self-check row) both pass.
- Step 7a's STOP message string at `:84` byte-identical to base (`sha1 cc7ef27f03...`).
- The `STOP_QA`/`STOP_RR` derivation and trigger block (`:56-83`) byte-identical to base (`sha1 8bba956bc6...`).
- Zero remaining "unreachable" / "not a reachable transition" / "NOT a row in this table" claims anywhere in the file.
- The new row is `:158`, inserted immediately after `:157`, ahead of the "Expected vs unrelated scope rule" paragraph — correct placement inside the table.

**Table-cell escaping — worth one line to qa-engineer, not a defect.** The new row's pending-note cell escapes the pipe as `<qa_reports\|review_reports>` (required, or the markdown table splits), while the same message at `:84` uses a bare `<qa_reports|review_reports>`. The two are therefore *semantically* verbatim but not *byte*-equal. A naive byte-equality assertion in T-E53-03 across both occurrences would fail spuriously; the assertion should normalise `\|` first.

**AC7 — build and suite.** `npm run build` clean (tsc, zero errors) and idempotent. `npm test`: 1675/1677.

**Expected-red manifest (SOP step 4a) — considered, correctly not armed.** No `qa_reports/expected-red_e53-blocked-reachability.txt` exists. Step 4a's trigger is a diff that touches test files, or reds "the diff doesn't explain". Neither holds: the diff touches zero test files, this is a feature-mode chain (no `dispatch_mode: "bugfix"`, so the `REPRO_MANIFEST_MISSING` gate is unarmed), and the two reds are *fully* explained by the diff — they are exact-shape pins on the one row AC1 intentionally changed. The manifest records sr-engineer-authored failing repro tests; there are none here. No finding.

**Known-red characterisation verified accurate.** Both failures:
- `test/qa-flow.test.mjs:1767` — `assert.deepEqual(r.allowed, [{new_agent:"pm",new_status:"In_Progress"}], "allowed set must be exactly {pm, In_Progress} per AC2 — no other successor")`
- `test/qa-flow.test.mjs:1806` — `assert.deepEqual(row, [{agent:"pm",status:"In_Progress"}], "row must be exactly [{pm, In_Progress}] per AC2 — no researcher/architect/self successor")`

Both now see the two-element row. Every *other* assertion inside those two tests still passes (non-empty allowed set, no sr-engineer successor) — i.e. the wedge-regression guard the tests exist to protect is intact; only the frozen exact shape is stale. The sibling test at `:1774` still passes because it uses `some()` rather than `deepEqual`, and `release-engineer:In_Progress -> qa-engineer:In_Progress` remains REJECTED (confirmed in the exhaustive sweep). An isolated `node --test test/qa-flow.test.mjs` run gives 136/138, confirming these 2 are the *only* reds in the suite. This is intentional fallout of AC1 under Constitution §2 test ownership, correctly left to qa-engineer's T-E53-03.

### Finding C1 (non-blocking here — file as its own ticket): a third `:Blocked` reachability gap the audit missed

E53's own instruction was to audit every role's `:Blocked` reachability in the same pass. That audit found gap B (`sr-engineer:Blocked -> design-auditor`) and fixed it. I re-ran the audit independently across all eight `<role>:Blocked` keys against every `next_role` their SOPs declare, and found a **third instance of the identical defect shape**, still open:

`content/skill-pm.md:28` instructs:

```
tw_update_state(status=Blocked, next_role="design-auditor", pending_notes=["PM blocked: design lacks Visual Structural Assertions"])
```

but the matrix's `pm:Blocked` key offers only `[pm:In_Progress, pm:Blocked]`. So `pm:Blocked -> design-auditor:In_Progress` is **REJECTED** — the design-auditor cannot legally claim the handoff the PM SOP just routed to it. This is exactly gap B with the roles changed, and it was fixed for sr-engineer in this cut while pm was left inconsistent.

Severity is lower than B/the release-engineer gap because a workaround exists and is two hops: `pm:Blocked -> pm:In_Progress -> design-auditor:In_Progress` (the latter edge is present). But a coordinator that honours the `next_role` directive literally — which is what the field is for — hits a `TRANSITION_REJECTED`.

**Do not fix it in this cut.** Opening a fourth edge would breach AC4 ("no other previously-rejected edge opened") and the human-pinned 4-file cut. Recording it here so it becomes its own ticket rather than being quietly dropped.

Full audit result for the record (all other SOP-declared Blocked routes verified reachable): `architect:Blocked -> pm` ACCEPT; `design-auditor:Blocked -> pm` ACCEPT; `qa-engineer:Blocked -> {sr-engineer, pm}` ACCEPT; `sr-engineer:Blocked -> {self, pm, design-auditor}` ACCEPT; `release-engineer:Blocked -> {self, pm, qa-engineer}` ACCEPT; `pm:Blocked -> pm` ACCEPT, `-> design-auditor` **REJECT** (C1). `researcher:Blocked` and `code-reviewer:Blocked` declare no SOP escalation rows and both carry self + pm escapes.

## Quality

**Q1 (minor, non-blocking) — garbled sentence in the new step-7a prose, `content/skill-release-engineer.md:84`.** The replacement clause reads:

> …not the in-SOP-only halt this guard used before matching step 8's AC4 branches were the only option available.

The subordinate clause is a run-on: "used before" + "matching step 8's AC4 branches were the only option available" collide without punctuation, so it first parses as "the halt this guard used before matching step 8's AC4 branches". Intended sense is "…used before, when matching step 8's AC4 branches was the only option available." This ships into every release-engineer dispatch's context; recommend a one-line copy fix on the next touch of this file. Beyond the grammar, the entire trailing historical clause is context cost paid on every dispatch for no operational value — trimming it to "…not an in-SOP-only halt (E53)" would read better and cost less. Neither is in this cut's AC.

**Q2 (observation only, correct as-is) —** the new row's pending note is the only one of the seven that lacks the `release-engineer: ` prefix its six siblings carry. This is *required* by AC6 (the STOP message text is preserved verbatim, and the original message begins "step 7a has…"), so it is correct here, not drift. Flagging only so it is not "fixed" later by someone pattern-matching the column.

**Q3 (observation) — stale claims survive in `CHANGELOG.md:60` and `:67`**, both still asserting `release-engineer:Blocked` is unreachable / "filed not fixed". These are historical release entries for the shipped v3.97.x cut and should NOT be rewritten — the correct remedy is the forthcoming v3.98.0 entry superseding them, which is release-engineer's step. No action for sr-engineer. Noted so nobody reads them as live contradictions of this change.

**Positives.** Comment quality is high and, unusually, the cross-references are *correct*: `tools/transitions.ts` cites `specs/qa-flow-enforcement-architecture.md:159` and `:164` and "new row after `:164`" — the mirrored rows land at exactly L159, L164, L165. The `:152-157` citation in the skill file matches the real row span. Precedent citations (E45's qa-engineer gap, E50 round 1 F10) are accurate and the comment correctly distinguishes this defect's shape (no key at all) from E45's (key present, one edge missing). House comment style matches the surrounding map.

## Architecture

No architecture spec for this feature (mini-chain, backlog row is the spec). Layering unchanged: `tools/transitions.ts` remains a pure data table plus `validateTransition`; the change is three declarative additions and no control-flow edit. The new key is placed adjacent to `release-engineer:In_Progress` and before `release-engineer:PASS`, consistent with the file's per-role grouping.

The design constraint that matters here is the file's own header contract — "Any change here MUST be mirrored in the design doc" — and it is honoured for all three rows (AC5). The `specs/` mirror remains the declared authoritative statement of the matrix and is now consistent with source for every row this cut touched.

One structural note: `release-engineer:Blocked -> qa-engineer:In_Progress` is a genuinely new *routing shape* for this role (release-engineer had only ever handed to pm), but it has direct precedent in `qa-engineer:Blocked -> sr-engineer:In_Progress` — route the block to the role that must fix it. It does not create a cycle risk beyond what `hop_count` already caps, and `computeNewRound`'s counters are untouched by this diff.

## Security

No findings. No new input crosses a trust boundary; the change is a static in-process map of string literals with no user-supplied keys, no secrets, no I/O, no dependency changes. `npm audit --audit-level=high` is unchanged from base (5 standing pre-existing HIGH advisories, tracked under E57); this cut adds none.

The one security-adjacent consideration for a transition-matrix change is *privilege widening*: does an added edge let a role reach a state it should not? The exhaustive sweep answers it — the only newly reachable tuple is `release-engineer:Blocked`, a strictly de-escalating halt state, and its three exits all route to roles that already had legitimate paths to `In_Progress`. `qa-engineer:PASS` remains the sole entry into `release-engineer:In_Progress`, so nothing gains a shortcut into the release path. No gate predicate keys off `release-engineer:Blocked`, so no gate is bypassed by the new state existing.

## Performance

No findings. `ALLOWED` grows from 63 to 68 entries across one added map key; lookup stays a single `Map.get` on a composed string key, O(1). No hot-path change, no added I/O, no allocation in a loop. Prompt-context cost of `content/skill-release-engineer.md` rises by roughly one table row net (one paragraph deleted, one row added) — near-neutral, and the context-budget tests pass.

## Verdict

**APPROVED** — AC1 through AC7 all verified, with AC4 proven exhaustively (1056-tuple differential against the base compiled validator: exactly the 5 intended edges opened, 0 closed) rather than sampled, AC5/AC6 verified programmatically and by hash, and the 2 red tests confirmed to be exactly the two stale `deepEqual` shape pins that AC1 intentionally invalidates. Finding C1 (`pm:Blocked -> design-auditor:In_Progress` still unreachable) is a real third instance of the same defect but is out of this cut's pinned scope and must be filed as its own ticket; Q1 is a one-line copy fix for the next touch of the release SOP.
