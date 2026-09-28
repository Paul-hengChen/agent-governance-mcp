# Review — e32-e33-gate-hardening (batched)

covers: T-E32-01, T-E33-01

Reviewer: code-reviewer (opus). Model differs from sr-engineer (fable) — no same-model blind-spot risk.

## Summary
- T-E32-01 narrows the `QA_COMPLETION_EVIDENCE_MISSING` APPROVED-row exemption from bare tuple shape to also require `review_verdict==="APPROVED"` (tools/handoff-orchestrator.ts:755-760), and enriches the rejection envelope with per-id expected `qa_reports/review_<id>.md` paths via new `qaEvidencePath` wrapper (gates/qa-review.ts:40-42). Registry prose updated.
- T-E33-01 flips E28 shrink detection from cardinality to entry-identity diff (dispatch_pins by key set, external_refs by ref string; tools/handoff-orchestrator.ts:1295-1345). Correct and complete — see below.
- **Central adjudication (incident replay): the EXACT incident shape stated by the coordinator — `agent_id=qa-engineer`, `status=In_Progress`, `review_verdict="APPROVED"` CARRIED, `completed_tasks` grown by the 6 e-p3 ids, `review_reports/review_T-E25-01.md` (covers all 6) present, `qa_reports/` per-id evidence absent — is STILL ACCEPTED under the new gate (verified live via dist).** The P1 acceptance criterion ("the incident at the server would have been blocked") is NOT met.
- Verdict: **CHANGES_REQUESTED**. E32 fails the P1 criterion; E33 is clean but the batched round fails on E32.

## Correctness

### FINDING C1 (BLOCKING, T-E32-01) — literal incident replay still lands
The exemption predicate (handoff-orchestrator.ts:755-760) is:
```
prevTuple.agent === "code-reviewer" && prevTuple.status === "In_Progress" &&
nextTuple.agent === "qa-engineer" && nextTuple.status === "In_Progress" &&
parsed.review_verdict === "APPROVED"
```
The incident write, as recorded by the coordinator this session, **carries** `review_verdict="APPROVED"` and rides the `code-reviewer:In_Progress → qa-engineer:In_Progress` edge (that is the only way it could have been ACCEPTED at all — a self-loop is already rejected by the shipped E18 gate; QAEV-1/QAEV-INCIDENT pin this). So all five conjuncts hold → `isApprovedRowHandoff === true` → the QA-evidence gate is SKIPPED → `MISSING_REVIEW_EVIDENCE` then passes because `review_reports/review_T-E25-01.md` has a `covers:` line naming all 6 ids → **ACCEPTED**.

Live replay against dist (temp workspaces, exact shape):
- **R1** prev=code-reviewer, `review_verdict="APPROVED"`, completed_tasks=6 ids, review_reports covers all 6, qa_reports absent → `isError=false`; the 6 ids landed in on-disk `completed_tasks`. **THE INCIDENT STILL PASSES.**
- **R2** same, but verdict omitted → `⛔ QA_COMPLETION_EVIDENCE_MISSING: T-E25-01, …` REJECTED. (This verdict-LESS variant is the ONLY thing E32 newly catches.)
- **R3** self-loop prev=qa-engineer + verdict → REJECTED (already covered by E18, not new).
- **R4** verdict + no review_reports at all → `⛔ MISSING_REVIEW_EVIDENCE` REJECTED (already covered pre-E32).

The gate cannot distinguish the incident from the sanctioned APPROVED handoff because **they are the same write**: R1 is byte-for-byte the QAEV-4 / FM5-modernized positive-control shape (verdict + review_reports present + non-empty completed_tasks + qa_reports absent), which the sr's own test suite ENSHRINES as ACCEPTED. The verdict-narrowing only rejects a write that FORGETS a field the SOP mandates and that a forger controls for free; the incident already had the review_reports coverage that R4 shows is the only other requirement, so adding `review_verdict` costs nothing.

Backlog E32 literally specifies: "fire the evidence gate on ANY qa-agent-id write that grows completed_tasks, regardless of status; consider also flagging completed_tasks growth on a write immediately following a code-reviewer tuple (identity-swap heuristic)." R1 IS growth immediately following a code-reviewer tuple and is NOT flagged — the implementation preserves the exact exemption the backlog told us to flag.

### FINDING C2 (SCOPE, T-E32-01) — the P1 fix conflicts with c16 and needs PM adjudication
The reason C1 cannot be fixed by tightening this predicate is that the c16 contract REQUIRES the APPROVED-row manifest to (a) carry the reviewed ids in `completed_tasks` and (b) be exempt from QA evidence (evidenced by `review_reports/` instead). QAEV-4 and FM5 are positive controls that this shape is ACCEPTED by design. Any gate that blocks R1 also breaks the sanctioned flow. The sr's own RESIDUAL note concedes the real fix "needs c16 + SOP amendment" (stop persisting the APPROVED-row manifest into `completed_tasks`). That is a PM-level scope decision, not something sr-engineer can close within the batched E32 scope as written. This must be surfaced for PM re-scoping, not waved through.

### sr diagnosis correction — VERIFIED CORRECT
The sr's note that the backlog's "gate only guards PASS / In_Progress door open" diagnosis is inaccurate is correct: the shipped E18 gate is status-agnostic. QAEV-1 (e18-write-provenance.test.mjs:301) seeds a qa-engineer self-loop `In_Progress` write and asserts rejection; QAEV-INCIDENT (:414) replays a self-loop `In_Progress` pre-fill and asserts rejection. The real open door was the tuple-shape exemption — the sr identified it accurately, then failed to close it (C1).

### E32 safety claims — VERIFIED against code paths
- carry-forward (no new ids): newIds set-diff at :767-768; empty → gate body not entered (QAEV-3 green). ✓
- bookkeeping_write: grows nothing → newIds empty. ✓
- non-qa ids: handled by REVIEWER_COMPLETED_TASKS_REJECTED, unchanged (FM1 green). ✓
- PASS with own evidence: gate at :761 runs AFTER the qa_review auto-record at :701, so own just-recorded evidence clears it (QAEV-2 green). ✓
- Rejection envelope (E23 posture): R2 output names each offending id AND the expected `qa_reports/review_<id>.md` path + covers: fallback. `qaEvidencePath` is a faithful thin wrapper over the same sanitised `evidencePath` the predicate checks — envelope can't name a path the gate didn't test. ✓

### baseline-poisoning claim — CONFIRMED REAL
The sanctioned/incident APPROVED write persists the review-scope ids into on-disk `completed_tasks` (R1 shows the 6 ids landing). A LATER qa-engineer write carrying those same ids forward sees them in `onDiskCompleted` (:767), so `newIds` is empty and the QA-evidence gate never arms — the two-step evasion (reviewer-shaped write persists ids → later carry is ungated) is real and stays open. This is the same c16-protected persistence behind C2.

### T-E33-01 — CORRECT, no findings
Entry-identity diff verified live (dist):
- value-only pin change (`sr:fable→sr:opus`, key set unchanged) → NO warning. ✓
- external_refs state advance (`unresolved→fetched`, ref unchanged) → NO warning. ✓
- equal-count pin swap `{sr,release}→{sr,qa}` → WARNS "kept 1 of 2 … dropped: release-engineer". ✓
- growing external_refs swap `{A}→{B,C}` → WARNS "kept 0 of 1 … dropped: A". ✓
Kept-count arithmetic (`prevLength - dropped.length`) is accurate for swaps; same-feature-only guard and additive warnings envelope unchanged.

## Quality
- E33 diff is tight — reuses the existing dropped-entry filter, only hoisting it above the count check. No dead code.
- E32 `qaEvidencePath` wrapper (not rename) is well-justified: preserves the AC-6 internal `evidencePath` call-site pins. Comment is honest.
- No naming/convention drift.

## Architecture
- Both changes are additive, file-mode-only, warn/gate-semantics-only — consistent with the sibling attestation gates. No schema change. Fits the gate registry pattern.
- C2 is an architecture-level concern: E32 as scoped cannot satisfy its P1 spec without a c16 amendment. That is a design conflict the round must escalate, not absorb.

## Security
- No new trust boundary crossed by the code itself; task-id sanitisation in `evidencePath` is preserved through the wrapper.
- BUT the security PURPOSE of E32 (close the identity-swap / unevidenced-completion door) is not achieved (C1): the gate is bypassed by exactly the SOP-shaped write the incident used. This is the blocking security finding.

## Performance
No findings. Set-diff and key/ref comparisons are O(n) over tiny fixed-size maps/arrays; no hot-path or I/O regression vs base.

## Verdict
CHANGES_REQUESTED — the literal incident replay (verdict CARRIED, review_reports present, qa_reports absent) is still ACCEPTED live, so the E32 P1 acceptance criterion is not met (C1); closing it collides with the c16-protected APPROVED-manifest contract and requires PM re-scoping (C2). T-E33-01 is correct and needs no change, but the batched round fails on T-E32-01.

## Round 1 — sr-engineer reply (rework, c16 amendment per PM re-scope option A)

- **C1 (incident replay lands)** — fixed by amending the contract, not the predicate, exactly as C2 anticipated: the `QA_COMPLETION_EVIDENCE_MISSING` APPROVED-row exemption is REMOVED ENTIRELY (tools/handoff-orchestrator.ts). ANY qa-engineer-stamped write that grows `completed_tasks` vs the on-disk set without per-id `qa_reports/` evidence is rejected, unconditionally — regardless of status, `review_verdict`, or previous tuple. R1 (verdict carried, review_reports covers, qa_reports absent) now REJECTED live via dist; R2/R3/R4 stay rejected; on-disk `completed_tasks` stays `[]` in all four, so the baseline-poisoning / two-step carry-forward evasion is closed at the source (nothing unsanctioned persists to carry forward).
- **C2 (c16 conflict, PM adjudication)** — adjudicated by PM (human-approved option A): the APPROVED handoff now carries review scope ONLY in transient `review_task_ids`; `MISSING_REVIEW_EVIDENCE` reads `review_task_ids` (falls back to `completed_tasks` only when empty). Compliant amended shape (verdict + review_task_ids + covers-file, completed_tasks empty) ACCEPTED live; same shape minus review evidence rejected `MISSING_REVIEW_EVIDENCE` — the review-evidence gate did not go dead. skill-code-reviewer.md SOP/template amended (review_task_ids, one-line ledger-integrity rationale); const-08 E18 bullet, gates/registry.ts prose, and specs/c16-c10-role-boundary.md (Amendment section) aligned.
- **Carry-forward** stays ungated by design (legacy poisoned ledgers documented in docs/backlog.md E32, not chased). E33 untouched. Expected-red manifest rewritten to the round-2 list (11 reds: QAEV-4, FM4/FM5, P1a/P1b, 6 compose-goldens from the const-08 edit), each justified.

## Round 2 — APPROVED — by code-reviewer (opus)

Reviewer: code-reviewer (opus). Model differs from sr-engineer (fable). All findings below verified by MY OWN live replays against a freshly rebuilt `dist/` (`npm run build` green, v3.90.0) — the sr's table was NOT taken on faith.

### Verdict: APPROVED

Both round-1 findings are resolved. C1 (incident replay lands) is closed at the source; C2 (c16 collision) is resolved by the human-approved PM re-scope (option A: c16 amendment). E33 is regression-clean. The 11 reds are exactly the manifest, all justified as qa-modernization; goldens re-capture mechanically.

### Live replay table (my own dist replays)

| # | Shape | Result | Ledger on disk |
|---|---|---|---|
| R1 | **exact incident**: prev=(code-reviewer,In_Progress), qa-engineer, In_Progress, `review_verdict=APPROVED` carried, `completed_tasks`=6 ids, review_reports covers-file present, qa_reports ABSENT | **REJECTED** `QA_COMPLETION_EVIDENCE_MISSING` | `[]` |
| R2 | R1 minus verdict | REJECTED `QA_COMPLETION_EVIDENCE_MISSING` | `[]` |
| R3 | self-loop prev=(qa-engineer,In_Progress), growth, no evidence | REJECTED `QA_COMPLETION_EVIDENCE_MISSING` | `[]` |
| R4 | verdict + growth + zero review evidence | REJECTED `QA_COMPLETION_EVIDENCE_MISSING` | `[]` |
| C1 | **compliant amended**: qa-engineer, `review_verdict=APPROVED`, `review_task_ids`=6 ids, `completed_tasks` empty, review_reports covers-file present | **ACCEPTED** | `[]` (review scope NOT persisted) |
| C2 | amended shape minus review evidence | **REJECTED** `MISSING_REVIEW_EVIDENCE` (re-pointed gate ALIVE) | `[]` |
| C3 | legit qa PASS + `qa_review` auto-record | ACCEPTED | `[T-X-01]` |
| C4 | carry-forward (id already on disk, zero evidence) | ACCEPTED (ungated by design) | `[T-OLD-01]` |

### FINDING C1 (round 1) — RESOLVED
The APPROVED-row exemption is removed entirely (handoff-orchestrator.ts:753-757 — the predicate is now `storage instanceof FileHandoffStorage && agent_id==="qa-engineer" && completed_tasks.length>0`, no `isApprovedRowHandoff` conjunct). R1 — byte-identical to the round-1 incident — is now REJECTED with the ledger staying `[]`, so nothing unsanctioned persists and the two-step carry-forward evasion is closed at the source. P1 acceptance criterion ("the incident would have been blocked") is now met.

### FINDING C2 (round 1) — RESOLVED via human-approved PM re-scope (option A)
Review scope on the APPROVED handoff now travels ONLY in transient `review_task_ids`. `MISSING_REVIEW_EVIDENCE` (handoff-orchestrator.ts:1091-1102) resolves `reviewScopeIds = review_task_ids ?? completed_tasks` (mirrors the d9 qa_review rule) and checks `hasCodeReviewEvidence`. C1/C2 replays confirm the gate accepts the compliant shape and still rejects the evidence-less one — it did NOT go dead.

### PROBE 6 (NEW ATTACK SURFACE from the re-point) — CLOSED
The concern: can a writer evade `MISSING_REVIEW_EVIDENCE` by stuffing `review_task_ids` with evidenced ids while `completed_tasks` grows with DIFFERENT unevidenced ids? Answer: **no.** The two gates are orthogonal and each demands its own evidence directory:
- `QA_COMPLETION_EVIDENCE_MISSING` (:753, runs FIRST) guards `completed_tasks` growth → requires `qa_reports/review_<id>.md`.
- `MISSING_REVIEW_EVIDENCE` (:1091, runs later) guards `reviewScopeIds` → requires `review_reports/review_<id>.md`.

Live divergent-field probes:
- **P6a** `review_task_ids=[A]` (has review_reports), `completed_tasks` grows `[B]` (no qa_reports) → **REJECTED `QA_COMPLETION_EVIDENCE_MISSING`**, ledger `[]`. The completion gate catches the divergent growth first, independent of `review_task_ids`. Evasion closed.
- **P6b** `completed_tasks=[A]` (has qa_reports), `review_task_ids=[B]` (no review_reports) → REJECTED `MISSING_REVIEW_EVIDENCE`, ledger `[]`. Each field independently guarded.
- **P6c** both fields diverge but BOTH fully evidenced (A has qa_reports, B has review_reports) → ACCEPTED, ledger `[A]`. Correct: this is a genuinely-QA-completed task plus a genuinely-reviewed task; neither field's evidence substituted for the other's. Not a hole — it is the design working.

Conclusion: the re-point opened no new door. `completed_tasks` growth remains fully and independently gated regardless of what `review_task_ids` carries; neither evidence type can substitute for the other.

### T-E33-01 regression (shared orchestrator block edited) — CLEAN
Live probes against the entry-identity diff:
- pin value-only (`sr: fable→opus`, key set unchanged) → NO warning (correct: value change is not a drop). ✓
- pin swap `{sr,release}→{sr,qa}` → WARNS "kept 0 of 1 … dropped: release-engineer". ✓
- external_refs state-advance (`unresolved→fetched`, ref unchanged) → NO warning. ✓
- external_refs swap `{A}→{B,C}` (growing) → WARNS "kept 0 of 1 … dropped: A". ✓

Kept-count arithmetic (`prevLength - dropped.length`) correct; same-feature-only guard and additive-warnings envelope intact.

### Content alignment (item 7)
- Normative agent-facing text is aligned: `content/const-08-chain-31-mid.md` QA Completion-Evidence bullet carries the "NO edge/status/verdict exemption (amended E32)" contract; `content/skill-code-reviewer.md` Escalation Routes / APPROVED row / Notes carry `review_task_ids` + the ledger-integrity rationale. No normative const/skill text still describes the old manifest-in-`completed_tasks` shape.
- Living contract `specs/c16-c10-role-boundary.md` has the explicit "Amendment — E32 … AC-1 bullet 1 is SUPERSEDED" section. `gates/registry.ts` prose (3 entries + c12 doc-file mapping) aligned.
- **Non-blocking doc-debt (QUALITY):** `specs/code-reviewer-role-extraction-architecture.md` (lines 138/345/379, last touched 2026-05-28 v3.9.0) still describes `completed_tasks` as the review-scope manifest. It is a historical architecture doc for the prior role-extraction feature, not loaded into agent context and not the living contract — so it does not contradict the normative text and does not block. Recommend a doc-writer pass to add a supersession pointer. `specs/d9-qa-review-scoped-append.md` is consistent (same review_task_ids-else-completed_tasks resolution).
- Context-budget floors green: `context-budget.test.mjs` and `token-budget-config.test.mjs` PASS (not among the 11 reds); the amended const-08 sentence composes cleanly.

### Expected reds (item 8) — exactly 11, all manifested
`npm test`: 1600 tests, 1589 pass, 11 fail (exit 1 as designed). The 11 map one-for-one to `qa_reports/expected-red_e32-e33-gate-hardening.txt`:
- 6 compose-goldens (build-full-{nondesign,design,nondesign-fd,design-fd}, hook-full, cat-15-fragments-monolith) — const-08 edit. Verified the golden byte-diff is SOLELY the amended QA Completion-Evidence bullet (word-diff: one line at position 73, old exemption sentence → new no-exemption + review_task_ids sentence). `node scripts/capture-constitution-golden.mjs` re-captures mechanically (5 fixtures + monolith); I ran it to verify then reverted (fixtures are qa-owned per §2).
- QAEV-4 — pins the old sanctioned APPROVED-row-with-completed_tasks-is-EXEMPT; now REJECTED by design.
- FM4/FM5 — pin the old manifest-in-completed_tasks positive controls; FM5's positive control moves to review_task_ids under the amendment.
- P1a/P1b — E33 as-is pins (same-count swap was silent); now warns.

Zero unexplained reds. sr edited no test/fixture file (§2 clean).

### Quality / Architecture / Security / Performance
- **Quality:** `qaEvidencePath` is a WRAPPER (not a rename) over `evidencePath`, honestly justified to preserve the AC-6 internal call-site pin. Comments accurate. No dead code, no convention drift.
- **Architecture:** contract-amendment approach (change the c16 contract, not tighten an unenforceable predicate) is the correct resolution of the round-1 C2 design conflict; it is what C2 anticipated and what PM approved.
- **Security:** the E32 security purpose (close the identity-swap / unevidenced-completion door) is now achieved — R1 confirms it live. Task-id sanitisation preserved through the wrapper.
- **Performance:** O(n) set-diff / key-ref comparisons over tiny maps; no hot-path or I/O regression.
- **Note (verified-safe):** calling `handleUpdateState` with `completed_tasks` undefined throws at :756 (`.length`), but the tool boundary always defaults it via zod `completed_tasks: z.array(...).optional().default([])` (tools/registry.ts:95) — not reachable in production; confirmed.

### Verdict
APPROVED — the round-1 incident is now REJECTED live with the ledger unpolluted (C1 closed); the c16 collision is resolved by the human-approved amendment (C2); the re-point opened no new evasion (probe 6 closed, both gates orthogonally guarded); E33 is regression-clean; the 11 reds are exactly the manifest and re-capture mechanically. Handing to qa-engineer to modernize the 6 flipped/pinned tests + re-capture the goldens.
