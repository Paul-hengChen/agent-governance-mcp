# Review — T-E40-01

Feature: `e40-nonqa-completed-tasks-write-gate` · Round 1 · reviewer model: opus (sr-engineer pinned `fable` — different model, no same-model-bias concern)

## Summary

- 3 source files + rebuilt `dist/`: `tools/handoff-orchestrator.ts` (the c16 step widened to two codes), `gates/registry.ts` (union + doc-map line + 33rd entry), `content/const-08-chain-31-mid.md` (one new row). No `test/**` edit. `.current/feature-split.md` is a pre-existing modification about E48/E59 doc guards — unrelated to this cut.
- The bypass is genuinely closed, verified end-to-end rather than by code-read: against a `git worktree` at HEAD the two-write sequence **succeeds** (a non-qa write prefills `T-BOGUS-01`; a `qa-engineer` write then carries that same id into the persisted ledger with **zero** `qa_reports/` evidence on disk); against the working tree the FIRST write is rejected `NON_QA_COMPLETED_TASKS_REJECTED` and the ledger stays `[]`.
- The E18/E32 set-difference gate was neither loosened nor reordered: it is untouched in the diff, still step 13 after this step 10, and my control proves it is still armed for a genuinely new id in **both** builds (`QA_COMPLETION_EVIDENCE_MISSING`).
- `agent_id` handling is safe: absent, empty, and unknown `agent_id` are all already rejected `AGENT_ID_REQUIRED` at pipeline step 1 in both builds, so the `parsed.agent_id &&` guard rejects nothing that was previously accepted. c16's `agent_id="code-reviewer"` envelope is byte-identical to HEAD's.
- One blocking finding (F1): the new const-08 row backtick-quotes `REVIEWER_COMPLETED_TASKS_REJECTED`, which makes `gates/registry.ts`'s doc-file mapping comment for that code **stale** — a source-side defect currently *masked* by the 32-count assertion in `test/error-code-contract.test.mjs` test 563. QA re-baselining 32→33 will uncover it, and the fix does not belong in the test.
- Verdict: **CHANGES_REQUESTED** (F1 blocking, one line in `gates/registry.ts`; F2–F3 non-blocking).

## Correctness

**F1 (BLOCKING) — `gates/registry.ts:121` doc-file mapping comment is now stale for `REVIEWER_COMPLETED_TASKS_REJECTED`.**

The new const-08 row legitimately names both codes, and names the pre-existing one in backticks:

```
… an `agent_id: code-reviewer` write keeps the pre-existing `REVIEWER_COMPLETED_TASKS_REJECTED` envelope byte-identical …
```

`content/const-08-chain-31-mid.md` is therefore now a backtick-quote site for `REVIEWER_COMPLETED_TASKS_REJECTED`, but the mapping comment still declares only one file:

```
//   REVIEWER_COMPLETED_TASKS_REJECTED  skill-code-reviewer.md
//   NON_QA_COMPLETED_TASKS_REJECTED  const-08-chain-31-mid.md
```

`test/error-code-contract.test.mjs` test 563 asserts that comment is byte-for-byte the file set `extractDocCodes()` finds by scanning `content/*.md`. Today it aborts on `assert.equal(mapping.size, 32)` before reaching the per-code comparison — so the mismatch is invisible in the expected-red inventory. I replicated the test's per-code `deepEqual` (its exact `BACKTICK_TOKEN_RE`) against the shipped tree with the count check removed. Exactly one code mismatches, and it is not the new one:

```
mapping comment entries: 33; GATE_REGISTRY: 33
MISMATCH REVIEWER_COMPLETED_TASKS_REJECTED
  declared: [skill-code-reviewer.md]
  actual:   [const-08-chain-31-mid.md, skill-code-reviewer.md]
1 mismatch(es)
```

This is not the 32→33 re-baseline class and must not be re-baselined in the test: the c12 guarantee is precisely that the comment (which the AC2 doc checks trust) never goes stale when a code is re-documented elsewhere — the exact drift this cut introduced. Fix in source:

```
//   REVIEWER_COMPLETED_TASKS_REJECTED  const-08-chain-31-mid.md, skill-code-reviewer.md
```

(The test compares sorted sets, so only membership matters; alphabetical order matches the sibling `REVIEW_VERDICT_STATUS_MISMATCH` line's convention.) Rebuild `dist/` after the edit — the mapping comment is parsed from `.ts` source, but the cut ships `dist/` and `agc check`/release expects source and `dist/` in sync.

**T-E40-02(a) — bypass closed END-TO-END, constructed here, not inherited.** Baseline = `git worktree` at `bff034e` (HEAD, pre-E40, its own committed `dist/`); target = the working tree's `dist/`. Same script, real chain edges, file mode:

```
###### BASELINE HEAD (pre-E40) ######
WRITE1  pm self-loop, completed_tasks=[T-BOGUS-01]            -> isError=false (ACCEPTED)
        on-disk ledger after WRITE1: ["T-BOGUS-01"]
WRITE2  qa resume, completed_tasks=[T-BOGUS-01], no evidence   -> isError=false (ACCEPTED)
        on-disk ledger after WRITE2: ["T-BOGUS-01"]      qa_reports/ exists: false
SEQ-C   qa resume, NEW id not prefilled, no evidence           -> isError=true QA_COMPLETION_EVIDENCE_MISSING

###### WORKING TREE (E40 applied) ######
WRITE1  pm self-loop, completed_tasks=[T-BOGUS-01]            -> isError=true NON_QA_COMPLETED_TASKS_REJECTED
        on-disk ledger after WRITE1: []
WRITE2  qa resume, completed_tasks=[T-BOGUS-01], no evidence   -> isError=true QA_COMPLETION_EVIDENCE_MISSING
        on-disk ledger after WRITE2: []                  qa_reports/ exists: false
SEQ-C   qa resume, NEW id not prefilled, no evidence           -> isError=true QA_COMPLETION_EVIDENCE_MISSING
```

The baseline block is the incident reproduced: a bogus id reaches the persisted ledger with no QA evidence anywhere. On the fixed build the door closes at the first write, and the qa write then correctly hits `QA_COMPLETION_EVIDENCE_MISSING` because the id is now genuinely new — which is the honest proof that E18/E32 was **not** loosened to compensate: `SEQ-C` fires identically on both builds.

Full identity matrix (non-empty `completed_tasks`, one legal edge each), baseline → target:

| `agent_id` | HEAD | working tree |
|---|---|---|
| pm, researcher, design-auditor, architect, sr-engineer, release-engineer | **ACCEPTED** (6 open doors) | `NON_QA_COMPLETED_TASKS_REJECTED` |
| code-reviewer | `REVIEWER_COMPLETED_TASKS_REJECTED` | `REVIEWER_COMPLETED_TASKS_REJECTED` (unchanged) |
| qa-engineer | `QA_COMPLETION_EVIDENCE_MISSING` | `QA_COMPLETION_EVIDENCE_MISSING` (unchanged) |

**T-E40-02(b) — absent `agent_id` is not misclassified.** `tools/registry.ts:97` makes `agent_id` `z.string().max(200).optional()`, so the schema does permit omission; `tools/handoff-orchestrator.ts:1421-1424` maps a missing value to `nextTuple.agent = null`, and `validateTransition` (`tools/transitions.ts:445-450`) rejects both `null` and any non-`AgentName` string with `AGENT_ID_REQUIRED` at step 1 — before this step runs. Measured, both builds:

```
agent_id ABSENT + completed_tasks=[T-X-01] -> AGENT_ID_REQUIRED
agent_id ABSENT + completed_tasks=[]       -> AGENT_ID_REQUIRED
agent_id ""     + completed_tasks=[T-X-01] -> AGENT_ID_REQUIRED
```

So no legitimate `tw_update_state` caller omits `agent_id` (none can), and the `parsed.agent_id &&` conjunct is correctly described in the comment as defense-in-depth. No behavior change for absent-`agent_id` writes.

**T-E40-02(c) — c16's envelope is byte-identical.** Captured from both builds and compared as whole strings; identical, including the trailing `hintStatic` and the `specs/c16-c10-role-boundary.md AC-3 + the E32 amendment` citation. The diff adds only comment lines inside that branch. Step name stays `REVIEWER_COMPLETED_TASKS_REJECTED` (no published-code retirement), as the approved decision requires.

**No legitimate write is newly forbidden.** No non-qa SOP writes `completed_tasks`: `content/skill-release-engineer.md:140` and `content/skill-doc-writer.md:29` only READ it, `content/coord-05-core-visual-drift.md:20` only reads, `skill-qa-engineer.md:86` is the sole writer and is `qa-engineer`-stamped, and `skill-code-reviewer.md:77,84,85,88` already forbids it. `tw_complete_task` is genuinely untouched: `tools/tasks-file.ts:153` rewrites the `tasks.md` checkbox under its own lock and never enters `tw_update_state`'s pipeline, so the evidence-backed completion path still works.

**Storage parity holds.** The predicate reads only `parsed`; no `FileHandoffStorage` guard. Measured in SQLite mode: `sr-engineer`/`pm`/`release-engineer` → `NON_QA_COMPLETED_TASKS_REJECTED`, `code-reviewer` → `REVIEWER_COMPLETED_TASKS_REJECTED`, `qa-engineer` → accepted (E18 is file-mode only, unchanged, as its own row documents).

**Telemetry attribution is correct.** The `⛔ NON_QA_COMPLETED_TASKS_REJECTED: …` prefix parses cleanly through `extractGateCodeFromText`, despite the step name differing from the code:

```json
{"ts":"…","gate":"orchestrator","error_code":"NON_QA_COMPLETED_TASKS_REJECTED","agent_id":"sr-engineer","feature":"F"}
```

## Quality

**F2 (non-blocking) — the new row omits the mode-scope sentence its neighbours all carry.** Every adjacent row in `content/const-08-chain-31-mid.md` closes on storage scope ("File-mode only.", "Transient, write-scoped; file-mode only."). The new row states none, and it sits directly below a `File-mode only` row — a reader is likely to carry that scope down by parallel. The gate is in fact storage-agnostic (measured above). One clause ("Applies in file and SQLite/HTTP mode alike — the predicate reads only the incoming write's args") would remove the ambiguity and match the fragment's convention.

**F3 (non-blocking, informational for QA) — the row costs a measured +359 ~tok.** Identical delta in all three breached ceilings (design-arm 8804→9163, teamwork bundle 16898→17257, non-design 6706→7065). That is in the same weight class as the QA Completion-Evidence row it parallels, so it is defensible, but it is the number QA must record when re-baselining, and roughly a third of it re-states "why" that also lives verbatim in the orchestrator comment.

Otherwise clean: comment style, `v3.100.0 — E40 (<feature>)` provenance tag, `type: "text" as const` envelope shape, and the `gate(...).hintStatic` composition all match the sibling branch immediately above. No dead code, no duplication beyond the intentional two-branch shape the approved decision mandates.

## Architecture

No `specs/<feature>-architecture.md` for this mini-chain — `docs/backlog.md:166` plus the approved decision in `scope_decision_why` is the contract, and the implementation matches it point for point: one pipeline step, two codes in `codes:[]`, strict non-empty predicate (not a set-difference), no exemption channel, c16 code preserved. I confirmed the "NO exemptions" claim structurally, not just from the comment: `gates/pipeline.ts:77-78` runs `step.run(ctx)` with no exemption interception, and `loadExemptions` (E24) is referenced only from the `tools/handoff-parse.ts` read path — no gate predicate consults it.

Layering is right: predicate in the orchestrator step (where the parsed args live), metadata declared once in `GATE_REGISTRY`, prose in the chain fragment, nothing restated per-role in `content/skill-*.md` (E59 precedent honored). Registration is complete — union at `gates/registry.ts:56`, doc-map line added, 33rd entry with `producer: "orchestrator"`, `envelope: "plain-text"`, `documentedInProse: true`, `armCondition` matching the code conjunct-for-conjunct, non-empty and actionable `hintStatic` (names the field, names who may write it, names the clearing action). The code string is literally present in its producer file. The suffix `_REJECTED` is already in the contract test's vocabulary, so no `SUFFIX_RE` widening is needed — a real trap this cut avoided.

Fragment tagging is corroborated by which goldens moved: the 4 `build-full-*`, `hook-full`, and the monolith failed; all 4 `build-lite-*` and `hook-lite` stayed green, consistent with `const-08-chain-31-mid.md` being chain-tagged and lite mode never issuing state writes.

## Security

No new trust boundary. The change is a rejection added on an already-authenticated tool path; it strictly narrows what a write may carry and introduces no new input, parsing, filesystem path, or secret. The envelope interpolates `parsed.completed_tasks` ids and `parsed.agent_id` into plain text returned to the same caller that supplied them (`agent_id` is `z.string().max(200)`-bounded), matching the sibling branch's existing pattern — no injection or disclosure vector. Identity remains attestation-based, unchanged; this gate is the "verify what the server CAN verify" posture applied one step earlier than E18, which is the security improvement.

## Performance

No regression. The predicate is three string comparisons plus a `.length` check on an already-parsed array, executed once per `tw_update_state` call inside an existing step — no new I/O, no allocation, no loop. The full suite ran in 43.0s (43.7s at HEAD, noise). `GATE_REGISTRY` grows 32→33 entries, and `computeGateStats` remains linear in registry size.

## Expected-Red Disposition

`qa_reports/expected-red_e40-nonqa-completed-tasks-write-gate.txt` does **not** exist; the manifest arrived as `pending_notes` prose instead. SOP 4a's citation-of-missing-manifest finding is not raised as blocking here because the diff touches no test file and the reds are all baseline-shift, not intentional new reds — but note the gap. I ran `npm test` myself: **1685 pass / 19 fail**, the exact 19 ids claimed. Independent disposition:

| reds | class | owner |
|---|---|---|
| 544, 563, 499 | hardcoded `32`→`33` count / frozen `codes[]` | QA re-baseline — **but 563 also masks F1; the source fix is sr's, only the count is QA's** |
| 564 | `NON_QA_COMPLETED_TASKS_REJECTED` × {`triggerEdge`, `armCondition`} need `FREE_TEXT_ALLOWLIST` entries (both free-English / snake_case shorthand, the exact `REVIEWER_COMPLETED_TASKS_REJECTED` precedent) | QA re-baseline |
| 436, 437, 444, 451, 452, 461 | all six fail *only* on `33 !== 32` sanity asserts | QA re-baseline — verified below |
| 103–106, 108, 109 | 6 goldens under `test/fixtures/compose-golden/` | QA re-baseline |
| 165, 166, 178 | ceilings, +359 ~tok each | QA re-baseline |

The gate-stats six deserved the closest look, because each aborts on the count *before* its substantive assertions run — the same masking that hides F1 in 563. I replicated their substance at 33 with the count removed:

```
registry=33 fired=0 zero_fire=33 sum=33
new code in zero_fire: true
zero_fire in catalog order: true
prose_behavioral count=4 all fires===null: true
sum after fires=33 (expect 33)
union === registry code set: true     disjoint: true
new code counted as fired: true       unregistered handled: true
new fired row: {"error_code":"NON_QA_COMPLETED_TASKS_REJECTED","category":"gate-backed","producer":"orchestrator","fires":1,…}
bare ws: throws=false zero_fire=33 (expect 33)
```

Full-registry coverage, catalog-order enumeration, fired/zero_fire disjointness and union-equality, unregistered-code isolation, the `prose_behavioral … fires:null` boundary, and graceful degradation on a bare workspace all hold at 33, and the new entry is correctly categorized `gate-backed`. So R1/R2/U1/D1/D2/T3b are genuinely the 32→33 class — nothing substantive about the new entry breaks them.

Provenance also checked: `npm run build` reproduces the committed `dist/` byte-for-byte (132 emitted files, identical checksums), so the shipped `dist/` is this source and not a stale artifact.

## Verdict

CHANGES_REQUESTED — the bypass is genuinely and verifiably closed with c16's contract intact, but the cut leaves `gates/registry.ts`'s doc-file mapping comment stale for `REVIEWER_COMPLETED_TASKS_REJECTED` (F1), a source-side defect that today hides behind test 563's `32` count and would land on QA as an unexplained red after re-baselining.

---

## Round 2 — APPROVED — by code-reviewer

covers: T-E40-01, T-E40-02, T-E40-03

### Summary
- Round-2 diff is two edits: `gates/registry.ts:121` doc-map line (F1, comment-only) and one appended clause on the new `content/const-08-chain-31-mid.md` row (F2). `qa_reports/expected-red_<feature>.txt` now exists (F3).
- **F1 CLOSED — independently confirmed, not accepted.** F2 CLOSED and now *empirically* verified in both storage modes. F3 CLOSED; the manifest's 19 rows are byte-identical to the 19 actual reds and its token numbers are exactly right.
- Because round 1 and round 2 are both uncommitted, "comment-only" was unprovable from git — so I re-derived the end-to-end bypass closure live rather than trust it. It holds, in file mode and SQLite mode.
- `test/**` untouched (tracked and untracked). `dist/` reproducible: 264 emitted files, all SHA-256 identical across a fresh `npm run build`.
- One non-blocking nit remains, in a manifest comment, not in shipped code or in any number QA consumes. Verdict: **APPROVED**.

### Correctness
**F1 — verified closed, by my own measurement.** I re-implemented the c12 check independently (mapping comment parsed from `gates/registry.ts` *source* via the test's `LINE_RE`; `GATE_REGISTRY` imported from the rebuilt `dist/`; actual sites harvested from `content/*.md` via `BACKTICK_TOKEN_RE`), with the count assert removed and **both** directions checked:

```
dist GATE_REGISTRY entries : 33
mapping comment entries    : 33
dup registry codes         : 0
mismatches                 : 0
```

Zero mismatches, no mapping key absent from the registry, no doc-quoted code outside the registry. I also confirmed the failure's *character* directly: test 563 now aborts on `expected the mapping comment to list all 32 codes, found 33` → `33 !== 32`. Nothing else. F1 has genuinely changed from a masked source defect to a pure count re-baseline. Note the new `// The 33-gate catalog…` block comment does **not** collide with `LINE_RE` (single space after `//`), so it adds no phantom mapping key — checked, since a collision there would have re-broken the count silently.

**Bypass closure re-derived live (round 1's verification, re-run because I could not prove the predicate unchanged):**

```
PASS  A1 write-1 (sr-engineer prefill) REJECTED at the FIRST write
PASS  A1 rejected with NON_QA_COMPLETED_TASKS_REJECTED
PASS  A2 ledger NOT poisoned on disk after the rejected write   :: []
PASS  C1 E18/E32 QA_COMPLETION_EVIDENCE_MISSING still fires on a growing qa write
PASS  D1 code-reviewer still gets REVIEWER_COMPLETED_TASKS_REJECTED (not the new code)
PASS  E2 absent agent_id does NOT hit the new code (AGENT_ID_REQUIRED owns it first)
PASS  F1 SQLite mode: NON_QA_COMPLETED_TASKS_REJECTED fires identically
```

The control also reproduces *why* E40 is needed: with a pre-poisoned on-disk ledger, the `qa-engineer` PASS carrying that same id does **not** trip `QA_COMPLETION_EVIDENCE_MISSING` (set-difference = 0) — it falls through to the separate `MISSING_EVIDENCE` PASS gate. So the E18/E32 blind spot is real as documented, and E40 closes it at the first write. `agent_id` values `pm`, `researcher`, `design-auditor`, `sr-engineer`, `release-engineer` all reach the new code on a legal edge; `architect` is caught earlier by `CUT_APPROVAL_REQUIRED` and `doc-writer` by `AGENT_ID_REQUIRED` (not in the agent enum) — earlier-gate shadowing, not a hole.

*Note for QA (test-design hazard, not a defect):* the new step sits **after** `AGENT_ID_REQUIRED`, `TRANSITION_REJECTED` and `CUT_APPROVAL_REQUIRED` in the pipeline. A per-role rejection test that picks an illegal prev-tuple will assert the wrong code and pass for the wrong reason. Seed a legal edge per identity.

### Quality
**F2 — verified accurate, and not merely by code-read.** The step carries no `instanceof FileHandoffStorage` guard (`tools/handoff-orchestrator.ts:691-764`), reads only `ctx.parsed`, and `runUpdateStatePipeline` is invoked unconditionally at `:1446` with no storage branch above it — and F1 above shows it firing identically under `SqliteHandoffStorage`. The clause is true.

It also does not misdescribe its neighbour: the QA Completion-Evidence row's own `File-mode only.` ending is untouched (the diff only *adds* a line), and that gate is indeed file-mode-guarded at `:863`. The wording matches the file's convention.

*Residual nit (non-blocking, no round needed):* the same E40 row says the qa-only ledger growth is "backed by the QA Completion-Evidence gate above" — a backstop that, per that row's own `File-mode only.`, does not fire in SQLite/HTTP mode. The E40 gate's own scope is stated correctly; only the cross-reference is mode-blurry. Worth a clause someday; not worth a round, and no gate or test depends on it.

### Architecture
Unchanged from round 1. No architecture spec for this feature; layering untouched — one comment and one prose row. Registry/pipeline separation (DR-5) intact: the 33rd entry is DOC order, evaluation order still lives in `UPDATE_STATE_GATE_PIPELINE`.

### Security
No new finding. The added text crosses no trust boundary; the predicate is unchanged from the round-1 review's security assessment (attestation-based identity, `agent_id` still the only key, no exemption path).

### Performance
No regression. Round 2 adds zero executable statements. Suite time 42.6s (43.0s round 1, noise).

### Expected-Red Disposition
`qa_reports/expected-red_e40-nonqa-completed-tasks-write-gate.txt` now exists — F3 closed. Verified mechanically, not read:

- **Set equality**: manifest rows vs `not ok` names from my own `npm test` run — `diff` reports *identical sets*, 19 and 19.
- **Counts**: 1704 tests, 1685 pass, 19 fail — matches.
- **SOP 4a locatability**: all 19 located in their named files. 15 hit by literal grep; the 4 `compose-equivalence: buildPromptForRole(...)` rows are template-generated at `test/compose-equivalence.test.mjs:93` and resolve to exactly those names — real, locatable tests, correctly attributed.
- **Token ceilings QA will consume** — re-measured from the live failures, not taken on trust:

| ceiling | floor | measured | delta |
|---|---|---|---|
| design-arm rationale-stripped | 8804 | **9187** | +383 |
| teamwork coordinator bundle | 16898 | **17281** | +383 |
| non-design | 6706 | **7089** | +383 |

All three match the manifest exactly. Against round 1's +359 figures the F2 clause costs **+24 on all three** (9163→9187, 17257→17281, 7065→7089).

*Non-blocking nit:* the manifest's comment at line 66 says F2 adds "+24/+24/+23 ~tok respectively". The third is +24, not +23 — the arithmetic in that sentence contradicts its own `+383` total two lines below. The load-bearing numbers (the three totals) are correct; only the parenthetical is off by one. QA should re-baseline to 9187 / 17281 / 7089 and ignore the "+23".

Provenance re-checked this round: `test/**` clean (tracked *and* untracked), and `npm run build` reproduces `dist/` with all 264 emitted files SHA-256 identical.

### Verdict
APPROVED — F1 is closed and independently confirmed (33/33, 0 mismatches, test 563 failing on the count alone); F2 is accurate and now empirically proven storage-agnostic; F3's manifest matches the 19 actual reds byte-for-byte with correct ceilings. The two residual items are one-clause wording nits in a comment and a prose cross-reference, neither in shipped logic nor in any number QA consumes — not worth a third round.
