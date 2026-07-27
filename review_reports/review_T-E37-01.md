# Review — T-E37-01

covers: T-E37-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Single source hunk: `tools/transitions.ts:261-270` adds `{ agent: "design-auditor", status: "In_Progress" }` to the `"qa-engineer:PASS"` `ALLOWED` row, plus a 9-line provenance comment. `dist/tools/transitions.js` is the matching rebuild; `docs/backlog.md` / `tasks.md` / `.current/handoff.md` are bookkeeping.
- **The widening itself is sound.** I traced every consumer keyed off the previous tuple (feature lease, `hop_count`, all three round counters, `cut_approved` re-arm, `dispatch_mode` / `external_refs` / `dispatch_pins` / `evidence_schema` carry-forward, the E18/E32 evidence gates) and all 17 E35 pipeline steps. Nothing keys on the successor set of a PASS, and the new edge cannot reach build-entry without passing through PM. No correctness finding.
- **Scope guard honored.** `qa-engineer:FAIL` (`:250-253`) is untouched at `{sr-engineer:In_Progress, pm:In_Progress}` — verified in the diff (one hunk, lines 258-267) and by reading the file. E38 stays deferred.
- **Two blocking findings, both one-liners, neither behavioral.** (1) `specs/qa-flow-enforcement-architecture.md:163` — the row this diff edits was *correct* in the authoritative doc before this change and is *wrong* after it; `tools/transitions.ts:3-4` makes the mirror an explicit MUST, and the named precedent C13 (`6ce344e`) shipped exactly that 3-line doc-sync alongside the identical row edit. (2) `tools/transitions.ts:268` — the comment claims **7** fires for this edge; the backlog row it derives from says **6** are the `PASS→design-auditor` shape and the 7th is E38's `FAIL` shape.
- Verified independently, not from handoff notes: `npx tsc --noEmit` clean; `npm test` → 1620 tests / 1619 pass / 1 fail, the single failure being `not ok 1015 - T-MATRIX-C13: qa-engineer:PASS allowed-next contains all three successors` (the sanctioned expected-red).
- Verdict: CHANGES_REQUESTED.

## Correctness

No findings. The reachability analysis, consumer by consumer:

- **Feature lease (E1)** — `gates/feature-lease.ts:112` releases the lease on `prevState.status === "PASS"`. A design-auditor write carrying a *different* `active_feature` after PASS is therefore unblocked, identically to `pm` / `researcher` / `release-engineer`. No new lease bypass: the lease was already crossable from this exact terminal state; the change only adds a fourth role that may cross it.
- **`hop_count`** — `tools/transitions.ts:415-429` (gate) and `:572-574` (accounting). `design-auditor` is a counted role transition (`next.agent !== prev.agent`) and is *not* the `(pm, In_Progress)` landing exemption, so `HOP_CAP_EXCEEDED` still fires on a same-feature post-PASS write at `hop_count >= 10`. Opening a new feature sets `feature_changed`, which resets the base to 0 — the same path `pm`/`researcher` already take. No cap exemption was widened.
- **Round counters (`computeNewRound:536-564`)** — every reset/increment branch keys on `next.agent ∈ {qa-engineer, pm, code-reviewer}`. `design-auditor` matches none, so all three carry forward. That is safe because at any *reachable* `qa-engineer:PASS` state all three per-cycle counters are already 0: PASS zeroes `qa_round` (`:537`) and `visual_round` (`:560`); `review_round` was zeroed by the `code-reviewer:In_Progress → qa-engineer:In_Progress` hop (`:541-547`) that necessarily precedes PASS, and a `review_round >= REVIEW_ROUND_CAP` would have collapsed the allowed set to `pm` alone (`:378-388`) long before PASS was reachable. Corollary: the new edge cannot be used to launder a hot counter — it resets nothing, and it is unreachable from `FAIL`.
- **`cut_approved` re-arm** — this is the load-bearing one, and it holds. `tools/handoff-write.ts:271-273,354-357`: carry-forward is `existing.active_feature === _activeFeature`, agent-agnostic, with a PM-re-entry re-arm. Two cases: (a) design-auditor opens the **next** feature → feature changed → `cut_approved` dropped to `undefined`; (b) design-auditor **re-audits the same** just-shipped feature → `cut_approved: true` carries forward, *but* `design-auditor:In_Progress`'s only forward edge is `(pm, In_Progress)` (`:190-193`), which is by definition a PM re-entry and re-arms `cut_approved` to `undefined`. In both cases `CUT_APPROVAL_REQUIRED` (orchestrator `:438`) is intact at the build-entry hop. The new edge structurally cannot skip PM.
- **`dispatch_mode` / `external_refs` / `dispatch_pins` / `evidence_schema`** — `tools/handoff-write.ts:359-377`, all four use the identical `existing.active_feature === _activeFeature` predicate with no agent term, so drop-on-feature-change / carry-on-same-feature behaves exactly as for any other opener. The orchestrator's `evidenceSchema: feature_changed ? EVIDENCE_SCHEMA_CURRENT : undefined` stamp (`:1443`) is likewise agent-agnostic, so a design-auditor-opened feature gets a correct v-pin.
- **E18 / E32 completion-evidence gates** — `QA_COMPLETION_EVIDENCE_MISSING` arms on `parsed.agent_id === "qa-engineer"`, `REVIEWER_COMPLETED_TASKS_REJECTED` on `agent_id === "code-reviewer"` (`:710`), and the whole `PASS_*` family on `parsed.status === "PASS"`. A `design-auditor` + `In_Progress` write arms none of them. No new evidence side door.
- **`STAMP_PROVENANCE_SUSPECT`** — keys on the shape of `prevState.last_updated` only (`:197-202`); agent- and edge-independent, unaffected.

## Quality

**Finding Q1 (blocking) — `tools/transitions.ts:268`: the comment's fire count is wrong.**

```
    // feature thereafter (7 fires / 2 workspaces / 5 features, 07-21..07-23,
```

The sentence attributes all **7** `TRANSITION_REJECTED` fires to the edge this diff opens. The backlog row (the spec) is explicit that it does not: *"6 are the `PASS→design-auditor` shape, 1 is the `FAIL→design-auditor` shape covered by E38."* Cross-checking the row's own enumeration confirms it — the E38 row identifies the outlier as `2026-07-23T02:37:17Z` (`app/web`, settings-item), leaving 6 fires across the same 2 workspaces and the same 5 features (toggle-component, header-component, pagination-component, network-status, settings-item). So the workspace/feature counts survive; only the fire count is inflated.

This matters more than a typo would, because the comment exists solely as the durable forensic justification for widening a state machine, and it overstates the evidence for its own edge by including a fire that E37 demonstrably does **not** fix. Nothing downstream re-audits a shipped comment — if it ships wrong it stays wrong.

Required fix (same comment block, zero behavior risk, no scope conflict):

```
    // feature thereafter (6 of 7 observed fires / 2 workspaces / 5 features,
    // 07-21..07-23, VS-NDI-Receiver telemetry; the 7th is the qa-engineer:FAIL
    // shape, deferred to E38).
```

**Finding Q2 (advisory) — `:261-262`: "parity with the null:null opener row" is over-claimed.**

`null:null` (`:172-179`) carries six entries, including `{design-auditor, Blocked}` at `:178` (and `{pm, Blocked}` / `{researcher, Blocked}`). `qa-engineer:PASS` now carries four, all `In_Progress`. The `:177` cite pins the intended scope to the one entry, so the comment is defensible as written, but "parity with the row" reads wider than what shipped. The backlog row's phrasing — *"making the post-PASS opener set a superset of `null:null`'s"* — is simply false, and PM may want to correct it.

No code change needed: a post-PASS auditor that must block writes `design-auditor:In_Progress` first, then `design-auditor:Blocked` via `:190-193`. Two writes instead of one, and the identical friction already exists for `pm`/`researcher` post-PASS, so this is a consistent pre-existing asymmetry rather than something E37 introduced. Suggest narrowing the wording to "restoring parity with the `null:null` opener's `design-auditor:In_Progress` entry (`:177`)".

**Verified-accurate claims** (I checked each rather than taking them):

- `:172` / `:177` — correct post-change line numbers for the `null:null` row header and its `design-auditor:In_Progress` entry.
- "C13 added release-engineer here but never restored this edge" — correct; `6ce344e` (v3.49.0) added `:257-260` and left the row at three successors.
- "the design-armed chain's canonical opening move (coordinator dispatches design-auditor before PM)" — correct; `content/coord-01-core-head.md:74` states *"If ≥ 1 hit → route to `design-auditor` *before* PM"*, and `:18` routes design-source detection to `design-auditor`.
- Style matches the C13 idiom directly above it (version + ticket tag, wedge description, consequence).

**Note (no action for sr-engineer)** — `content/skill-design-auditor.md` needs no update. C13 had to amend `content/skill-release-engineer.md:19,42` because that SOP names its opening edge explicitly; the design-auditor SOP documents only its *closing* handoff (`:101`) and never enumerates legal opening edges, so it is already correct.

## Architecture

**Finding A1 (blocking) — `specs/qa-flow-enforcement-architecture.md:163` was correct before this diff and is wrong after it.**

```
| qa-engineer | PASS | (pm, In_Progress), (researcher, In_Progress), (release-engineer, In_Progress) |
```

`tools/transitions.ts:3-4` — the header of the file this diff edits — states: *"See `specs/qa-flow-enforcement-architecture.md` §ALLOWED_TRANSITIONS for the authoritative matrix. **Any change here MUST be mirrored in the design doc.**"* The mirror did not happen.

The ticket asks whether C13 needed anything beyond the matrix row. It did: `git show --stat 6ce344e` lists `specs/qa-flow-enforcement-architecture.md | 3 +-` alongside the ten-line `tools/transitions.ts` edit. And `specs/constitution-v3.27-sync-consistency-architecture.md:178` records the same obligation being enforced for the T-MATRIX-A5 row change — *"adds `tools/transitions.ts` (3 edits…), a `specs/qa-flow-enforcement-architecture.md` doc-sync, a qa-engineer-owned test (§2), and a version bump."* Two consecutive matrix-row changes, both doc-synced. E37 is the first to skip it.

Mitigating, and worth recording: that table is *already* stale in ~5 other places — it has no `design-auditor` rows at all, no `code-reviewer` rows, `null|null` omits `design-auditor`, `pm|In_Progress` omits `design-auditor`, and `sr-engineer|In_Progress` still says `(qa-engineer, In_Progress)` where the code says `code-reviewer`. So the header's MUST is systemically unobserved, and one added cell will not make the table authoritative.

That is why I am asking only for the one cell, not the table:

```
| qa-engineer | PASS | (pm, In_Progress), (researcher, In_Progress), (release-engineer, In_Progress), (design-auditor, In_Progress) |
```

Rationale for making it blocking rather than advisory: this diff *newly* falsifies a line that was accurate, in the file its own header names authoritative, against an unbroken two-change precedent, and the fix is one line with no test impact. The broader table rot is a separate concern — recommend PM file a backlog row for a full matrix doc-sync (all 5 stale rows + the two missing role row-groups) rather than folding it here.

If the "touch ONLY `tools/transitions.ts`" hard scope is read as forbidding the second file, that is a conflict between the cut and an explicit in-file MUST, and §7 requires surfacing it rather than silently shipping the divergence. My reading is that the doc-sync is in scope — the scope guard was aimed at `qa-engineer:FAIL` and at test ownership, neither of which this touches.

**No other architecture findings.** Gate-pipeline check (E35, `gates/pipeline.ts` + the 17 `UPDATE_STATE_GATE_PIPELINE` steps in `tools/handoff-orchestrator.ts`): only `TRANSITION_VALIDATION` (`:138`) consults the matrix at all, and it does so generically via `validateTransition`. No step enumerates the successors of a PASS. Every edge-pinned gate pins an edge this change cannot reach — `SCOPE_DECISION_REQUIRED` / `CUT_APPROVAL_REQUIRED` / `EXTERNAL_REFS_UNRESOLVED` / `SOURCE_CREDIBILITY_UNVERIFIED` all require `prevTuple.agent === "pm"` with `nextTuple.agent ∈ {architect, sr-engineer}` (e.g. `:566-570`); `REPRO_MANIFEST_MISSING` pins the sr-engineer→code-reviewer fix-phase hop; `MISSING_REVIEW_EVIDENCE` pins `prevTuple = (code-reviewer, In_Progress)` → `nextTuple = (qa-engineer, In_Progress)` (`:1201-1205`). The change is genuinely one row of data in a table whose ordering and step set are untouched.

## Security

No findings. No new trust boundary, no input parsing, no secrets, no filesystem or network surface. The added value is a compile-time-typed literal (`AgentName` × `StatusName`) in a frozen map; `isAgent` (`:305-316`) already admitted `design-auditor`, so no validation surface widened either.

Governance-boundary note, since a transition widening *is* the security surface here: the new edge grants `design-auditor` no capability it did not already have from `null:null` and `pm:In_Progress`, and its onward reachability is unchanged and narrow — `design-auditor:In_Progress` routes only to `pm:In_Progress` or `design-auditor:Blocked`. It cannot reach `sr-engineer` or `architect` directly, so no build-entry attestation (`cut_approved`, `scope_decision`, `external_refs`, source credibility) becomes skippable.

`npm audit` reports 4 pre-existing HIGH transitive advisories (esbuild, fast-uri, js-yaml, sharp). No dependency file is in the diff — `git diff --stat` shows no `package.json` / lockfile change. Noted, not blocking, correctly out of this ticket's scope.

## Performance

No findings. The `ALLOWED` map is built once at module load; the row gains a fourth element, so the linear `allowed.some(...)` scan at `:464` goes from at most 3 to at most 4 comparisons on one key. No new allocation, no I/O, no hot-path change, no complexity-class change vs base.

## Test integrity

Independently reproduced, not taken from handoff notes:

- `npx tsc --noEmit` — clean.
- `node --test test/qa-flow.test.mjs` — 127 tests, 126 pass, 1 fail.
- `npm test` — 1620 tests, 1619 pass, 1 fail. The full run's only `not ok` line is `not ok 1015 - T-MATRIX-C13: qa-engineer:PASS allowed-next contains all three successors {pm, researcher, release-engineer}`.
- `dist/tools/transitions.js:110-119` matches the source hunk verbatim; the rebuild is in sync.

**The expected-red is correctly and precisely characterized — with one over-statement in the ticket.** I swept for every test that pins this row (`grep -rn "qa-engineer:PASS" test/` plus `grep -rn "ALLOWED_TRANSITIONS" test/`) and found exactly one: `test/qa-flow.test.mjs:1841`. Within it, exactly one assertion fails — `:1855`, `assert.equal(row.length, 3, ...)`. **No other test pins this row and none was missed.**

The ticket says qa-engineer must modernize `:1841` *"plus the C13 no-regression cases at `:1815`/`:1829`"*. Those two do **not** need touching: `:1815` and `:1829` only assert that `validateTransition` still accepts `PASS→pm` and `PASS→researcher`, which an additive row edit cannot break — both pass today. Directing qa at them invites a needless edit to green tests.

For qa-engineer, the actual flip is:
1. `:1855` — `row.length` `3` → `4`.
2. `:1841` + `:1853` — test title and message still say "all three successors {pm, researcher, release-engineer}"; retitle to four and add a `row.some(c => c.agent === "design-auditor" && c.status === "In_Progress")` assertion so the new entry is pinned, not merely counted.
3. Recommended additions (E37 currently ships with zero positive coverage of its own edge): a behavioral accept test `validateTransition({prev: qa-engineer:PASS, next: design-auditor:In_Progress}) === null`, mirroring the C13(a) test at `:1711`; and a scope-guard reject test proving `qa-engineer:FAIL → design-auditor:In_Progress` is still `TRANSITION_REJECTED`, which pins E38's deferral so a future widening cannot happen silently.

## Handoff-ledger note (outside the diff)

sr-engineer's handoff wrote `completed_tasks: ["T-E37-01"]`. Constitution §3 reserves the completion ledger for QA-evidence-backed completions — sr-engineer signals readiness via `pending_notes`, and only qa-engineer flips completion. **Judgement: a real §3 boundary violation, but benign in effect here.** It produced observable drift (`tw_detect_drift` returned *"Handoff says T-E37-01 completed, but task list shows it as incomplete"*), and it self-healed the moment I made the Phase-2 claim write, because `completedTasks` replaces wholesale (`tools/handoff-write.ts:166`, `const completedTasks = opts.completedTasks ?? []`) and my claim carried none. No fix is required from sr-engineer.

Worth recording for PM, though, because the *class* is not benign: `QA_COMPLETION_EVIDENCE_MISSING` scopes its evidence check to the set-*difference* against the on-disk completed set, and `REVIEWER_COMPLETED_TASKS_REJECTED` arms only on `agent_id === "code-reviewer"`. An `sr-engineer`-stamped prefill is gated by neither, and while it sits on disk it would exempt those ids from the evidence check on a subsequent qa-engineer write — the E18 incident shape, reached through a role the E18 defense does not cover. The exposure window is a single write (any intervening write that omits `completed_tasks` clears it), which is why it is low severity rather than a finding here. Suggest a backlog row to extend the reject to any non-qa-engineer `agent_id` carrying non-empty `completed_tasks`.

## Verdict

**CHANGES_REQUESTED** — the state-machine widening is correct, minimal, and provably safe against every prev-tuple consumer and all 17 gate-pipeline steps, but the diff ships a comment that overstates its own forensic evidence (7 fires vs the backlog's 6, `tools/transitions.ts:268`) and leaves the authoritative matrix doc newly wrong on the exact row it edits (`specs/qa-flow-enforcement-architecture.md:163`), against an explicit in-file MUST and the C13 precedent that shipped that doc-sync. Both fixes are one line each, carry no behavior or test impact, and should land in a single round.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- Both round-1 blocking findings fixed, nothing else in the source changed. Round-1's Correctness / Security / Performance analysis of the widening stands unchanged — the `ALLOWED` row edit is byte-identical to round 1; only the comment above it and one spec-table cell moved.
- Q1 fixed at `tools/transitions.ts:266-269`; Q2 (advisory) also taken up at `:261-263`. A1 fixed at `specs/qa-flow-enforcement-architecture.md:163`.
- I re-derived both factual claims from source rather than accepting the relay, per the coordinator's request. Both hold.
- Mirror obligation confirmed complete for this diff: `:163` is the **only** enumeration of the `qa-engineer:PASS` successor set in the repo.
- Verdict: APPROVED.

## Correctness

No findings. No behavioral change from round 1 — `git diff` on the `ALLOWED` map shows the same single added entry, `{ agent: "design-auditor", status: "In_Progress" }`. Scope guard re-verified: `qa-engineer:FAIL` (`:250-253`) still `{sr-engineer:In_Progress, pm:In_Progress}`, untouched. No test file in the diff.

**Re-derivation of "6 of 7" (not taken on trust).** The backlog E37 row enumerates seven fires; I attributed each:

| # | Sidecar | When | Feature | Shape |
|---|---|---|---|---|
| 1 | `/VS-NDI-Receiver/.current/` | 07-23 05:22:13 | toggle-component | PASS |
| 2 | `/VS-NDI-Receiver/.current/` | 07-23 09:05:09 | header-component | PASS |
| 3 | `/VS-NDI-Receiver/.current/` | 07-23 10:48:30 | pagination-component | PASS |
| 4 | `app/web/.current/` | 07-22 05:08:30 | network-status | PASS |
| 5 | `app/web/.current/` | 07-22 11:35:48 | settings-item | PASS |
| 6 | `app/web/.current/` | 07-23 02:37:17 | settings-item | **FAIL → E38** |
| 7 | (predates both sidecars) | 07-21 04:48:27 | — | PASS |

Row #6 is the FAIL-shape outlier, independently pinned by the **E38** row's own text: *"Live instance 2026-07-23T02:37:17Z (`app/web`, settings-item)… the handoff carried `next_role=design-auditor` on a `qa-engineer:FAIL` state"*, and corroborated a second time by E38's closing line *"E37 removes 6 of the 7 observed fires and leaves this one."* Two independent statements in the spec agree with the corrected comment.

Removing #6 leaves **6 fires**; both sidecars still contribute (#1-3 and #4-5), so **2 workspaces** holds; the five distinct features survive because settings-item still appears via #5, so **5 features** holds; #7 (07-21) and #1-3 (07-23) both remain, so **07-21..07-23** holds. Every number in the corrected comment is right.

One inherited imprecision, explicitly *not* a finding: fire #7 predates both sidecars and is unattributed to a feature, so "5 features" counts only the five named ones and #7 could in principle be a sixth. The comment reproduces the backlog's own arithmetic verbatim, which is the correct standard for a code comment — it should not be more precise than the spec it cites.

**Re-derivation of the `:177` anchor.** `sed -n '171,179p' tools/transitions.ts` gives the `null:null` row as `172` (key), `173` pm:In_Progress, `174` pm:Blocked, `175` researcher:In_Progress, `176` researcher:Blocked, **`177` `{ agent: "design-auditor", status: "In_Progress" }`**, `178` design-auditor:Blocked. The cite is exact, and it is stable under this diff: the added hunk starts at `:258`, well below, so no insertion shifted it. The `:178` Blocked entry the round-1 advisory raised is likewise real, and the backlog row now cites it correctly.

## Quality

Both round-1 findings resolved.

- **Q1 resolved** — `:266-269` now reads *"(6 of 7 observed fires / 2 workspaces / 5 features, 07-21..07-23, VS-NDI-Receiver telemetry; the 7th is the qa-engineer:FAIL shape, deferred to E38)"*. Matches the backlog exactly and correctly attributes the residue to E38 rather than claiming it.
- **Q2 resolved (was advisory)** — `:261-263` narrowed from "parity with the null:null opener row" to *"parity with the null:null opener's design-auditor:In_Progress entry (:177)"*. The claim is now exactly as wide as what shipped.
- Every other factual claim in the comment re-verified this round and still accurate: the C13 attribution, and the "coordinator dispatches design-auditor before PM" characterization (`content/coord-01-core-head.md:74`).
- `dist/tools/transitions.js:110-120` carries the revised comment and entry verbatim — rebuild is in sync.

Minor, no action required and not sr-engineer's field: the handoff's `scope_decision_why` still contains the round-1-corrected phrase *"so the post-PASS opener set is a superset of null:null's"*. The backlog row was fixed; this PM-authored attestation string was not. It is a frozen cut-time record, so leaving it is defensible — noting it only so the inconsistency is not mistaken for a live claim.

## Architecture

**A1 resolved.** `specs/qa-flow-enforcement-architecture.md:163` now reads `(pm, In_Progress), (researcher, In_Progress), (release-engineer, In_Progress), (design-auditor, In_Progress)`, and the diff on that file is exactly one line. The `tools/transitions.ts:3-4` MUST is satisfied and the C13 precedent (`6ce344e`) is matched.

**Mirror obligation is complete for this diff.** Verifying the coordinator's question (b), I swept for any other description of this successor set:

- Within the authoritative spec: `:163` is the only successor-set line for the row. The other `PASS` hits are unrelated — `:160` is the `qa-engineer|In_Progress` row, `:179`/`:279` are code excerpts, `:462` is the `visual_round` counter table (`(qa-engineer, PASS) | — | 0`, about resets, not successors), `:833-834` are visual gate rows.
- Repo-wide (`grep -rn "release-engineer, In_Progress)" --include=*.md --include=*.ts --include=*.mjs`, excluding `dist/`): the only successor-set enumeration outside `:163` is in `test/qa-flow.test.mjs` (the expected-red qa owns) and in historical point-in-time design docs (`specs/c13-release-engineer-write-path.md`), which are records of their own ticket and are not updated by convention.
- Live governance content (`content/`, the fragments actually loaded into agent context): no file enumerates the PASS successor set. `skill-release-engineer.md:19,42` names only its **own** edge (`qa-engineer:PASS → release-engineer:In_Progress`) — a single-edge claim that stays true under an additive widening. `skill-doc-writer.md:28` and `skill-release-engineer.md:13,41` state PASS as a *precondition* for themselves, not as an exhaustive successor list. `skill-design-auditor.md` needs nothing: unlike release-engineer's SOP it never names legal opening edges, documenting only its closing handoff (`:101`).

Positive corroboration worth recording: `content/coord-03-core-fallback.md:18` + `:36-45` already document the coordinator, at a PASS stop-condition, running the Backlog Intake Loop → Cheapest-Compliant-Path Intake → Design-source detection for the next ticket — which routes to `design-auditor` **before** PM (`content/coord-01-core-head.md:74`). The governance docs already described the behavior the matrix was rejecting; E37 makes server and doc agree rather than introducing something new.

Out of scope, flagged for the doc-staleness backlog row the coordinator is already filing: `docs/skills/release-engineer.md:125` asserts *"there is NO edge routing INTO `release-engineer`"*, which C13 falsified in v3.49.0. Stale since long before E37, unrelated to this row, correctly not touched here.

## Security

No findings. Unchanged from round 1 — same literal in the same frozen map, no new trust boundary, no validation surface widened (`isAgent` already admitted `design-auditor`), and onward reachability from `design-auditor:In_Progress` is still only `{pm:In_Progress, design-auditor:Blocked}`, so no build-entry attestation becomes skippable.

`npm audit`: the same 4 pre-existing HIGH transitives (esbuild, fast-uri, js-yaml, sharp). No dependency file in the diff. Noted, not blocking.

## Performance

No findings. Comment-only delta on top of round 1's already-negligible change: the `allowed.some(...)` scan at `:464` remains at most 4 comparisons on one key.

## Test integrity

Independently re-run this round, not relayed:

- `npx tsc --noEmit` — clean.
- `npm test` — 1620 tests, 1619 pass, 1 fail. Sole `not ok` is `#1015 - T-MATRIX-C13: qa-engineer:PASS allowed-next contains all three successors {pm, researcher, release-engineer}` — the sanctioned expected-red, identical to round 1. Nothing regressed, no new failure, no test file touched.
- `dist/tools/transitions.js` — rebuilt and matching source.

The round-1 guidance for qa-engineer stands unchanged and is now also recorded in the backlog row: flip `:1855` (`row.length` 3→4), retitle `:1841`/`:1853` and add a `design-auditor` `row.some(...)` pin, add a positive accept test for the new edge (mirroring C13(a) at `:1711`), and add a reject pin on `qa-engineer:FAIL → design-auditor` to lock E38's deferral. `:1815`/`:1829` still need no edit.

## Verdict

**APPROVED** — both blocking findings are fixed exactly and minimally; I re-derived "6 of 7" from the backlog's own fire enumeration (cross-checked twice against the E38 row) and confirmed the `:177` anchor by reading the row, and I verified `specs/qa-flow-enforcement-architecture.md:163` is the sole enumeration of this successor set anywhere in the repo, so the mirror obligation for this diff is complete. The widening itself was sound in round 1 and is unchanged.
