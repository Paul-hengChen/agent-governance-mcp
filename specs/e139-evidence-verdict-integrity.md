# e139-evidence-verdict-integrity — E139 + E236 + E136 + E154

Lane `e139`, post-v4 wave 11 (`specs/fanout-post-v4-w11.md`). Branch `feat/e139-evidence-verdict-integrity`, base `1adb50b`. Four tickets, one problem: a gate passes on the wrong author, on the wrong evidence, or leaves a record the server never accepted.

## Problem Statement

Four gaps in the evidence and verdict layer of `tw_update_state`. All four are file-mode gaps.

- **E139.** `review_verdict` is checked only for consistency, and only on `agent_id=code-reviewer` writes (`REVIEW_VERDICT_STATUS_MISMATCH`). Any other role can stamp it and every gate passes. A forged `APPROVED` is not harmless: auto-routing reads it and moves the chain on to qa. `completed_tasks` already has both halves, consistency (`REVIEWER_COMPLETED_TASKS_REJECTED`) and authorship (`NON_QA_COMPLETED_TASKS_REJECTED`). `review_verdict` has only the first.
- **E236.** `QA_REVIEW_RECORD` (pipeline step 12) appends the `qa_review` text to `qa_reports/review_<id>.md` before steps 13–17 run. When one of those steps rejects the write, or `writeState` throws after the pipeline, the evidence file still keeps a timestamped PASS/FAIL section, and sometimes a file created from nothing. The record then shows a verdict the server refused.
- **E136.** The evidence path is a lossy projection of the task id. Today it is `review_${id.replace(/[^A-Za-z0-9._-]/g, "_")}.md`, built separately in six places. Two ids that differ only in case land on one file on APFS/NTFS, and so do two ids that differ only in characters the sanitiser rewrites. One task's evidence then satisfies another task's gate, and E120's refusal of a voided-id re-cut can be dodged by changing the case.
- **E154.** `parseCoversIds` reads only the first `covers:` line in a file. A review round that widens scope by appending a second `covers:` line is ignored, and its write is rejected with a misleading "evidence missing" message.

## User Stories

- As the coordinator, I want a `review_verdict` from any role other than code-reviewer to be rejected, so that auto-routing cannot be moved forward by a forged approval (Constitution §3.2 builder ≠ judge at the state layer).
- As a code-reviewer, I want my APPROVED handoff, which I stamp `agent_id=qa-engineer`, to keep passing, so that the canonical approval edge does not regress.
- As a qa-engineer, I want a write the server rejects to leave the evidence files exactly as they were, so that the durable record never shows a PASS the server refused.
- As anyone reading or writing evidence, I want two different task ids never to resolve to one evidence file, so that a gate is never satisfied by another task's report.
- As a reviewer running a multi-round review, I want every `covers:` line in my report to count, so that widening scope by appending a line works the way every other part of the append-only convention does.

## Design decisions (per ticket)

### E139 — one pipeline step, two codes; a new registry entry `NON_REVIEWER_VERDICT_REJECTED`

- **Shape.** A new `GateDefinition` `NON_REVIEWER_VERDICT_REJECTED` is added to `GATE_REGISTRY`, which goes from 34 to 35 entries. Its check is a second branch inside the existing `REVIEW_VERDICT_STATUS_MISMATCH` pipeline step, whose `codes` becomes `["REVIEW_VERDICT_STATUS_MISMATCH", "NON_REVIEWER_VERDICT_REJECTED"]`. The pipeline stays at 18 steps.
- **Why one step, not a new step.** This mirrors the `completed_tasks` precedent exactly: `REVIEWER_COMPLETED_TASKS_REJECTED` and `NON_QA_COMPLETED_TASKS_REJECTED` are two registry entries emitted by one step. Both branches read the same field and split on `agent_id`, so they are disjoint and their order inside the step does not matter. A new step would add a new pipeline position, and with it a new ordering question, for no behavioural gain.
- **Why a new code, not a reuse of `REVIEW_VERDICT_STATUS_MISMATCH`.** Reusing it would change what an existing code means. The hard condition says additive only.
- **Position.** Step 10, before `QA_REVIEW_RECORD`. A rejected forged-verdict write therefore never reaches the evidence write, which makes it consistent with E236.
- **The rejection predicate (file mode only).** The write is rejected when all of the following hold:
  - `storage instanceof FileHandoffStorage`
  - `parsed.review_verdict` is present
  - `parsed.agent_id` is present
  - `parsed.agent_id !== "code-reviewer"`
  - the write is NOT the APPROVED handoff row (defined next)
- **How the APPROVED row is recognised.** All of the following hold:
  - `ctx.prevTuple` = `code-reviewer:In_Progress`, i.e. the on-disk `last_agent` and `status` read by `storage.parse` at handler entry
  - `ctx.nextTuple` = `qa-engineer:In_Progress`, i.e. the incoming `agent_id` and `status`
  - `parsed.review_verdict === "APPROVED"`
- **Why that signal is robust.**
  - `prevTuple` is server-derived from the on-disk state, never client-supplied.
  - It is the same tuple `TRANSITION_VALIDATION` validated a few steps earlier.
  - It is exactly the edge predicate `MISSING_REVIEW_EVIDENCE` already uses to arm on this handoff, so the two gates agree on what "the APPROVED row" is.
  - Cross-process changes between the read and the write are caught by `verifyFreshness` (STATE DRIFT) inside `writeHandoffState`.
- **What the predicate rejects.** Every other non-reviewer `review_verdict` write: any verdict from pm, researcher, design-auditor, architect, sr-engineer or release-engineer, and from qa-engineer a CHANGES_REQUESTED, an APPROVED on any other edge (for example the qa self-loop), or any verdict on a PASS/FAIL write.
- **File mode only, and why.** The hard condition requires SQLite/HTTP behaviour to stay unchanged. In SQLite mode `review_verdict` is also never persisted (`SqliteHandoffStorage.writeState` ignores it, DR-5), so a forged verdict has nothing downstream to read it there. The gap is inert in that mode.
- **The constitution is not edited.** The new entry ships `documentedInProse: false`, with the mapping-comment row `(none)`. `test/error-code-contract.test.mjs` explicitly supports this (the E300 precedent: `DISPATCH_PIN_TIER_REJECTED` shipped that way). The rejection envelope explains itself: it names the field, the author and the one legal exception. As a result `content/**`, `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` are NOT touched by this lane. Quoting the code in prose is filed as `E139-NEW-1`.
- **Existing bytes.** The code-reviewer branch of the step stays byte-identical, including its `const { parsed } = ctx;` line. The new branch reads `ctx.storage`, `ctx.prevTuple` and `ctx.nextTuple` directly.

### E236 — roll back on rejection (file mode), not reorder

- **Choice.** The record stays at step 12, so `PASS_MISSING_EVIDENCE`, `QA_COMPLETION_EVIDENCE_MISSING`, `PASS_EXPECTED_RED_DIFF` and `PASS_AC_EXECUTION_LOG` keep seeing the evidence this write records. The record becomes undoable, and the undo runs whenever the write does not land.
- **Why not "every rejecting check before the evidence write".**
  1. The check order is frozen and additive: `UPDATE_STATE_GATE_PIPELINE` must not be reordered.
  2. Four later steps read the content this same write records, not just its existence. The E236 instance itself was the expected-red heading inside `qa_review`. Checking first would mean giving `hasEvidenceInFile`, `hasExpectedRedDisposition`, `hasAcExecutionLogDisposition` and the visual predicates a staged in-memory overlay, which changes the signatures of four gate modules.
  3. A write can also fail after every gate has passed: `writeHandoffState` throws on STATE DRIFT or lock failure. Only a rollback covers that case.
- **Mechanism.**
  - `gates/qa-review.ts` gains `recordReviewInFileUndoable(workspacePath, taskIds, status, reviewer, notes): Promise<() => void>`. It must be declared above `hasEvidenceInFile`, because `test/covering-evidence.test.mjs` slices `hasEvidenceInFile` to EOF.
  - Before writing, the function snapshots whether `qa_reports/` existed and, for each distinct target path, whether the file existed and its byte size.
  - It then appends exactly the bytes `recordReviewInFile` appends today, and records each file's post-append size.
  - If an append throws part-way, it undoes what it already wrote and rethrows.
  - The returned undo never throws. It works through the paths in reverse order:
    - A file this write created is unlinked, but only if its size still equals the post-append size.
    - A file that already existed is truncated back to its pre-size, but only if its size still equals the post-append size and the bytes from the pre-size offset onward equal what this write appended. Otherwise the file is left alone, so a concurrent writer's append is never destroyed.
    - Finally, if `qa_reports/` was created by this write and is now empty, it is removed.
  - `recordReviewInFile` keeps its signature and its observable behaviour: it delegates and drops the undo. `tools/storage.ts` and `tools/storage-sqlite.ts` are unchanged.
- **Orchestrator wiring (`tools/handoff-orchestrator.ts`).**
  - In file mode (`storage instanceof FileHandoffStorage`) the `QA_REVIEW_RECORD` step calls `recordReviewInFileUndoable` and registers the undo in a module-level `WeakMap<UpdateStateGateContext, () => void>`. A WeakMap is used because `gates/pipeline.ts`, which owns the readonly context type, is outside this lane.
  - In any other mode the step calls `storage.recordReview` exactly as today.
  - In `handleUpdateStateCore`:
    - a pipeline rejection runs the undo, then returns the rejection envelope unchanged;
    - a throw from the pipeline or from `storage.writeState` runs the undo, then rethrows the same error;
    - a successful `writeState` discards the undo.
  - The step's `codes`, name and position are unchanged.
- **SQLite.** Unchanged. In SQLite mode a rejected write still leaves its `reports` row, because the fix would live in the forbidden `tools/storage-sqlite.ts`. Filed as `E236-NEW-1`.

### E136 — one injective encoder, `encodeEvidenceId`, in `tools/evidence-file.ts`

- **Helper.** `export function encodeEvidenceId(taskId: string): string` is added to `tools/evidence-file.ts`. Every gate module and `tools/evidence-lookup.ts` already import from that module, and it stays import-free of `gates/`, so no new module is needed.
- **Encoding (exact).** The id is processed one UTF-16 code unit at a time, left to right (not by code point). Each unit `u` maps as follows, and the results are concatenated:

  | input code unit | output |
  |---|---|
  | `u` ∈ `[A-Z0-9.-]` | `u` unchanged |
  | `u` ∈ `[a-z]` | `"_"` + the upper-case letter (`a` → `_A`) |
  | any other unit (including `_`, space, `/`, `\`, `:`, NUL, non-ASCII, lone surrogates) | `"__"` + the unit's value as exactly 4 upper-case hex digits (`_` → `__005F`, `/` → `__002F`, `é` → `__00E9`) |

  Examples: `T-E139-01` → `T-E139-01` · `t-e139-01` → `_T-_E139-01` · `T-A_1` → `T-A__005F1` · `T-A/1` → `T-A__002F1` · `../escape` → `..__002F_E_S_C_A_P_E`.
- **Properties.**
  1. *Identity on the canonical shape.* For every id matching `^[A-Z0-9.-]*$`, the output equals the input. That covers every `T-<TICKET>-NN` id with an upper-case ticket, plus bare `T01`/`X1`/`A10-ARCH`. Shipped evidence paths for those ids are byte-identical, so nothing has to move.
  2. *Injective.* The output is a prefix code. `_` is never emitted on its own: it always starts a token, and the character after it says which kind (`_` means four hex digits follow, `A`–`Z` means a lower-case letter). Decoding is therefore unambiguous.
  3. *Safe on case-insensitive filesystems.* The output contains no lower-case letters, so two outputs are equal under ASCII case folding only if they are equal. It is pure ASCII, so APFS Unicode normalisation cannot merge two outputs either.
  4. *Path-safe.* The output alphabet is `[A-Z0-9._-]`, with no `/`, `\`, NUL or `:`, so no traversal is possible. Every name keeps its `review_`/`visual_` prefix and `.md` suffix.
- **No fallback to the old path.** A lookup for a non-canonical id never also tries the legacy sanitised name, because the legacy name is the lossy projection this ticket removes. A live non-canonical id whose evidence sits at a legacy path has to re-record it. The rejection envelopes already name the expected path (`qaEvidencePath`, `visualEvidencePath`).
- **Sites converged (task-id path derivation only).** Function names are kept, because source pins reference them:
  - `gates/qa-review.ts` `evidencePath`
  - `gates/code-review.ts` `codeReviewPath`
  - `gates/ac-execution.ts` `reviewPath`
  - `gates/expected-red.ts` `reviewPath`
  - `gates/visual.ts` `visualEvidencePath`
  - `tools/evidence-lookup.ts` `sanitizeTaskId` (or its call site)
- **Unchanged.** The `active_feature` sanitisers (`specFilePath`, `expectedRedManifestPath`, `designFilePath`) are not touched. Filed as `E136-NEW-2`.

### E154 — `parseCoversIds` reads every `covers:` line

- **Rule (exact).**
  - Every line matching `COVERS_LINE_RE` is collected, in document order, using an internal global copy `new RegExp(COVERS_LINE_RE.source, "gim")`.
  - The exported `COVERS_LINE_RE` keeps its source and its `im` flags.
  - The first matching line's tokens are returned exactly as today, including any duplicates within that line.
  - Each later line adds only the tokens not already in the result, in order.
- **Consequences.**
  - With zero or one `covers:` line, the output is byte-identical to today.
  - Ids restated on a later line are de-duplicated.
  - `buildCoverageIndex` and `tools/lane-status.ts`'s `passEvidenceIdsIn` inherit the union without edits.

## Acceptance Criteria

### E139

- **AC-E139-1** — Given file mode and a legal edge, when a write stamped with any of `pm`, `researcher`, `design-auditor`, `architect`, `sr-engineer`, `qa-engineer` or `release-engineer` carries `review_verdict` (`APPROVED` or `CHANGES_REQUESTED`) and is not the APPROVED handoff row, then it is rejected (`isError: true`). Its text is `⛔ NON_REVIEWER_VERDICT_REJECTED: review_verdict=<v> on an agent_id=<agent> write. ` followed by `gate("NON_REVIEWER_VERDICT_REJECTED").hintStatic`, and `.current/handoff.md` is byte-unchanged.
  proof: `node --test --test-name-pattern="AC-E139-1" test/e139-non-reviewer-verdict.test.mjs` passes.
- **AC-E139-2** — Given on-disk `code-reviewer:In_Progress`, when the APPROVED handoff row is written (`agent_id=qa-engineer`, `status=In_Progress`, `review_verdict=APPROVED`, `review_task_ids` evidenced), then it is accepted as today, and the existing pins stay green unmodified: `test/e18-write-provenance.test.mjs` QAEV-4b and QAEV-INCIDENT, `test/reviewer-completed-tasks-gate.test.mjs` FM4/FM5, and `test/e32-e33-gate-hardening.test.mjs` R1–R4/C2/P6a–c.
  proof: `node --test --test-name-pattern="AC-E139-2" test/e139-non-reviewer-verdict.test.mjs` passes.
- **AC-E139-3** — Given file mode, when a write is a near-miss of the APPROVED row, then it is rejected with `NON_REVIEWER_VERDICT_REJECTED`. The near-misses are: qa-engineer `APPROVED` from on-disk `qa-engineer:In_Progress` (self-loop), qa-engineer `CHANGES_REQUESTED` on the `code-reviewer:In_Progress → qa-engineer:In_Progress` edge, and a qa-engineer PASS or FAIL write carrying any verdict.
  proof: `node --test --test-name-pattern="AC-E139-3" test/e139-non-reviewer-verdict.test.mjs` passes.
- **AC-E139-4** — Given any `agent_id=code-reviewer` write, then `NON_REVIEWER_VERDICT_REJECTED` never fires, and the `REVIEW_VERDICT_STATUS_MISMATCH` matrix behaves as today. The four code-reviewer `T-C9-10/AC-5` cases in `test/qa-flow.test.mjs` stay green unmodified.
  proof: `node --test --test-name-pattern="AC-E139-4" test/e139-non-reviewer-verdict.test.mjs` passes.
- **AC-E139-5** — Given a non-reviewer write that does not carry `review_verdict`, then the new branch never fires.
  proof: `node --test --test-name-pattern="AC-E139-5" test/e139-non-reviewer-verdict.test.mjs` passes.
- **AC-E139-6** — Given SQLite storage (`SqliteHandoffStorage`), when an `sr-engineer` write carries `review_verdict=APPROVED`, then it is not rejected with `NON_REVIEWER_VERDICT_REJECTED` (SQLite behaviour unchanged).
  proof: `node --test --test-name-pattern="AC-E139-6" test/e139-non-reviewer-verdict.test.mjs` passes.
- **AC-E139-7** — Registry and pipeline:
  - `GATE_REGISTRY` has 35 entries and includes `NON_REVIEWER_VERDICT_REJECTED` with `producer: "orchestrator"`, `envelope: "plain-text"`, `documentedInProse: false`, and the Copy/Strings field values.
  - The mapping comment lists it with `(none)`.
  - The `REVIEW_VERDICT_STATUS_MISMATCH` step's `codes` is `["REVIEW_VERDICT_STATUS_MISMATCH", "NON_REVIEWER_VERDICT_REJECTED"]`, and every other step is unchanged.
  - `test/e35-pipeline-order.test.mjs`, `test/error-code-contract.test.mjs`, `test/e26-gate-stats.test.mjs` and `test/e308-single-source-tier-enum.test.mjs` are green after the re-pin.
  - A rejected write appends one telemetry line carrying the new code, and `tw_gate_stats` lists it.
  proof: `node --test test/e35-pipeline-order.test.mjs test/error-code-contract.test.mjs test/e26-gate-stats.test.mjs test/e308-single-source-tier-enum.test.mjs` exits 0.
- **AC-E139-8** — Given a qa-engineer PASS write that carries `qa_review` and a forged `review_verdict` from on-disk `qa-engineer:In_Progress`, when it is rejected with `NON_REVIEWER_VERDICT_REJECTED`, then no evidence file is created or changed. The rejection is at step 10, before `QA_REVIEW_RECORD`.
  proof: `node --test --test-name-pattern="AC-E139-8" test/e139-non-reviewer-verdict.test.mjs` passes.
- **AC-E139-9** — Given the lane's final HEAD, then `content/**`, `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` are unchanged against the merge-base.
  proof: `git diff --name-only $(git merge-base HEAD main) HEAD -- content test/fixtures/compose-golden test/context-budget.test.mjs` prints nothing.

### E236

- **AC-E236-1** — Given file mode, an expected-red manifest for the feature, and an existing `qa_reports/review_<X>.md` with bytes B, when a qa-engineer PASS write with `qa_review` lacking `## Expected-Red Diff` and `review_task_ids=[X]` is rejected with `EXPECTED_RED_DIFF_MISSING`, then the file's bytes are still exactly B. This is the E236 instance.
  proof: `node --test --test-name-pattern="AC-E236-1" test/e236-rejected-write-evidence.test.mjs` passes.
- **AC-E236-2** — Given the same setup but no evidence file for X, when that write is rejected, then `qa_reports/review_<X>.md` does not exist afterwards, and no other file appears in `qa_reports/`.
  proof: `node --test --test-name-pattern="AC-E236-2" test/e236-rejected-write-evidence.test.mjs` passes.
- **AC-E236-3** — Given a workspace with no `qa_reports/` directory, when a qa-engineer write records evidence and is then rejected by a later step (`QA_COMPLETION_EVIDENCE_MISSING` for a `completed_tasks` id outside `review_task_ids`), then `qa_reports/` still does not exist.
  proof: `node --test --test-name-pattern="AC-E236-3" test/e236-rejected-write-evidence.test.mjs` passes.
- **AC-E236-4** — Every step after `QA_REVIEW_RECORD` that can reject a qa-engineer PASS/FAIL write carrying `qa_review` leaves the evidence files byte-identical to their pre-write state. One case each: `QA_COMPLETION_EVIDENCE_MISSING`, `MISSING_EVIDENCE`, `VISUAL_BASELINES_REQUIRED` (as the visual-subgate representative), `EXPECTED_RED_DIFF_MISSING`, `AC_EXECUTION_LOG_MISSING`.
  proof: `node --test --test-name-pattern="AC-E236-4" test/e236-rejected-write-evidence.test.mjs` passes.
- **AC-E236-5** — Given a write that passes every gate but whose `writeState` throws (for example STATE DRIFT: the handoff mtime changes after `tw_get_state`), then the same error propagates as today and the evidence files are byte-identical to their pre-write state.
  proof: `node --test --test-name-pattern="AC-E236-5" test/e236-rejected-write-evidence.test.mjs` passes.
- **AC-E236-6** — Given a qa-engineer PASS write whose only evidence for its `completed_tasks` is this write's own `qa_review`, then it is accepted (`PASS_MISSING_EVIDENCE` still relies on same-write evidence), and the file holds the same header and the same `## <ISO> — PASS — by qa-engineer` section that `recordReviewInFile` wrote before this change.
  proof: `node --test --test-name-pattern="AC-E236-6" test/e236-rejected-write-evidence.test.mjs` passes.
- **AC-E236-7** — Given the undo returned by `recordReviewInFileUndoable`, when the target file was changed after the append (its size or tail bytes differ), then the undo leaves the file untouched and does not throw.
  proof: `node --test --test-name-pattern="AC-E236-7" test/e236-rejected-write-evidence.test.mjs` passes.
- **AC-E236-8** — The existing record and append behaviour is unchanged: `test/qa-review-scoped-append.test.mjs`, `test/covering-evidence.test.mjs` and the SQLite cases in `test/qa-flow.test.mjs` stay green unmodified.
  proof: `node --test test/qa-review-scoped-append.test.mjs test/covering-evidence.test.mjs` exits 0.

### E136

- **AC-E136-1** — `tools/evidence-file.ts` exports `encodeEvidenceId`, implementing the encoding table above exactly. The examples line of the E136 design section maps as stated.
  proof: `node --test --test-name-pattern="AC-E136-1" test/e136-evidence-path-injective.test.mjs` passes.
- **AC-E136-2** — For a fixed in-test list of canonical ids (at least `T-E139-01`, `T-REL4-02`, `T-E178A-06`, `T-QRSA-SQL-OTHER-1`, `T01`, `X1`, `A10-ARCH`, `T-1.2`), `encodeEvidenceId(id) === id`, and each of the six sites yields the same path as the pre-change sanitiser (`review_<id>.md` / `visual_<id>.md`).
  proof: `node --test --test-name-pattern="AC-E136-2" test/e136-evidence-path-injective.test.mjs` passes.
- **AC-E136-3** — Over a generated corpus, no two distinct ids produce outputs that are equal after `.toLowerCase()`, and every output decodes back to its input. The corpus is every string of length ≤ 3 over `a`, `A`, `_`, `-`, `/`, space, `é`, `\uD800`, plus the pairs `T-X-01`/`t-x-01`, `T-A/1`/`T-A_1`/`T-A 1`/`T-A:1`.
  proof: `node --test --test-name-pattern="AC-E136-3" test/e136-evidence-path-injective.test.mjs` passes.
- **AC-E136-4** — For each site, the path's stem equals `encodeEvidenceId(id)`: `qaEvidencePath`, the code-review path (observed via `recordCodeReviewInFile` and `hasCodeReviewEvidenceInFile`), the ac-execution and expected-red `reviewPath` (observed via `AcDispositionResult.checkedPaths` and the disposition lookups), `visualEvidencePath`, and `hasEvidenceAnywhere`. None of the six files still contains a `taskId.replace(` call.
  proof: `node --test --test-name-pattern="AC-E136-4" test/e136-evidence-path-injective.test.mjs` passes.
- **AC-E136-5** — Given `qa_reports/review_T-X-01.md` and `review_reports/review_T-X-01.md`, when `hasEvidenceInFile(ws, ["t-x-01"])` and `hasCodeReviewEvidenceInFile(ws, ["t-x-01"])` run, then both report `t-x-01` missing. This holds on a case-insensitive filesystem too (the E120 door is closed).
  proof: `node --test --test-name-pattern="AC-E136-5" test/e136-evidence-path-injective.test.mjs` passes.
- **AC-E136-6** — `recordReviewInFile(ws, ["../escape"], …)` writes `qa_reports/review_..__002F_E_S_C_A_P_E.md` and nothing outside `qa_reports/`.
  proof: `node --test --test-name-pattern="recordReviewInFile sanitises path-traversal in task id" test/qa-flow.test.mjs` passes after the T-E139-03 re-pin.
- **AC-E136-7** — `specFilePath`, `expectedRedManifestPath` and `designFilePath` (the `active_feature` sanitisers) are byte-unchanged.
  proof: `node --test --test-name-pattern="AC-E136-7" test/e136-evidence-path-injective.test.mjs` passes.

### E154

- **AC-E154-1** — Given content with `covers: A, B` and, later, `covers: C`, then `parseCoversIds` returns `["A", "B", "C"]`.
  proof: `node --test --test-name-pattern="AC-E154-1" test/e154-multi-covers.test.mjs` passes.
- **AC-E154-2** — Given `covers: A, B` and, later, `covers: B, C`, then the result is `["A", "B", "C"]`, with the restated id de-duplicated.
  proof: `node --test --test-name-pattern="AC-E154-2" test/e154-multi-covers.test.mjs` passes.
- **AC-E154-3** — Given content with exactly one `covers:` line, then the result equals today's, including within-line duplicates (`covers: A, A` → `["A", "A"]`). `test/covering-evidence.test.mjs` stays green unmodified.
  proof: `node --test --test-name-pattern="AC-E154-3" test/e154-multi-covers.test.mjs` passes.
- **AC-E154-4** — Given a `review_reports/` report whose second `covers:` line names id Y, when the APPROVED row with `review_task_ids=[Y]` is written, then it is accepted with no `MISSING_REVIEW_EVIDENCE`. The same holds for a `qa_reports/` report covering Y on its second line under `QA_COMPLETION_EVIDENCE_MISSING`.
  proof: `node --test --test-name-pattern="AC-E154-4" test/e154-multi-covers.test.mjs` passes.
- **AC-E154-5** — `COVERS_LINE_RE` keeps its source and its `im` flags, and the prose guards (`discovers:`, mid-sentence `covers:`) hold on every line, not only the first.
  proof: `node --test --test-name-pattern="AC-E154-5" test/e154-multi-covers.test.mjs` passes.
- **AC-E154-6** — `tools/lane-status.ts` is unchanged and `test/e177b-lane-status.test.mjs` is green unmodified.
  proof: `git diff --name-only $(git merge-base HEAD main) HEAD -- tools/lane-status.ts test/e177b-lane-status.test.mjs` prints nothing, and `node --test test/e177b-lane-status.test.mjs` exits 0.

### Lane-wide

- **AC-L1** — There is no `schema_version` bump: `schema/**` is unchanged.
  proof: `git diff --name-only $(git merge-base HEAD main) HEAD -- schema` prints nothing.
- **AC-L2** — Every existing `GATE_REGISTRY` entry is byte-unchanged, and the registry diff only adds lines. The exceptions are the type-union line, the count wording in the catalog comment and the `code 34 → 35` tool-boundary comment.
  proof: `git diff $(git merge-base HEAD main) HEAD -- gates/registry.ts` shows no removed line inside any existing `GateDefinition` object.
- **AC-L3** — Every changed path is in the lane's 擁有 set, plus the ruled `test/e308-single-source-tier-enum.test.mjs`, and no forbidden path is touched.
  proof: `git diff --name-only $(git merge-base HEAD main) HEAD` lists only paths named in the `## Cut` touches cells or under `.current/e139/`, `qa_reports/`, `review_reports/`.
- **AC-L4** — `dist/` is rebuilt and committed: running `npm run build` on the final HEAD leaves the tree clean.
  proof: `npm run build && git status --porcelain dist` prints nothing.
- **AC-L5** — The full suite is green on the final HEAD.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e139.envelope | `⛔ NON_REVIEWER_VERDICT_REJECTED: review_verdict=${parsed.review_verdict} on an agent_id=${parsed.agent_id} write. ` + `gate("NON_REVIEWER_VERDICT_REJECTED").hintStatic` | authored-here — mirrors the `NON_QA_COMPLETED_TASKS_REJECTED` envelope shape field for field |
| e139.hintStatic | `review_verdict is the code-reviewer's verdict field: only an agent_id=code-reviewer write, or the APPROVED handoff the code-reviewer stamps agent_id=qa-engineer on the code-reviewer:In_Progress -> qa-engineer:In_Progress edge, may carry it. Omit review_verdict on this write. See docs/backlog.md E139.` | authored-here — names the field, the author, the single exception and the clearing action, like the E40 hint |
| e139.triggerEdge | `any file-mode write whose agent_id is present and is NOT code-reviewer, carrying review_verdict, except the APPROVED handoff (code-reviewer:In_Progress -> qa-engineer:In_Progress with review_verdict=APPROVED)` | authored-here — free English; qa adds a `FREE_TEXT_ALLOWLIST` row for `triggerEdge` |
| e139.armCondition | `FileHandoffStorage && review_verdict present && agent_id present && agent_id !== "code-reviewer" && !(prevTuple code-reviewer:In_Progress && nextTuple qa-engineer:In_Progress && review_verdict=APPROVED)` | authored-here — `prevTuple`/`nextTuple` are camelCase literals present in `tools/handoff-orchestrator.ts`, so the c12 predicate check covers it mechanically (no allowlist row) |
| e139.clearingArtifact | `omit review_verdict on any write not stamped agent_id=code-reviewer; the one exception is the APPROVED handoff row (agent_id=qa-engineer on code-reviewer:In_Progress -> qa-engineer:In_Progress)` | authored-here |
| e139.mapping | `//   NON_REVIEWER_VERDICT_REJECTED   (none)` | authored-here — the E300 `(none)` marker, parsed by `test/error-code-contract.test.mjs` |
| e139.arch-count | `— 35 entries covering the pipeline gates plus the read-path and task-tool gates.` (replaces `— 33 entries covering …` in `docs/architecture.md`) | authored-here — the true registry count after this lane (the 33 was already stale at 34) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E184, E152, E161 (manifest «不在本波»).
- `tools/storage-sqlite.ts`, and therefore the SQLite half of E236 (`E236-NEW-1`).
- `tools/lane-status.ts`. Its `REVIEW_FILE_RE` reads the id back out of the filename, so for a non-canonical id it will see the encoded stem (`E136-NEW-1`). Canonical ids are unaffected.
- Quoting `NON_REVIEWER_VERDICT_REJECTED` in `content/**` prose (`E139-NEW-1`).
- The `active_feature` sanitisers (`E136-NEW-2`).
- Moving or renaming existing evidence files for non-canonical ids. Archived evidence of that kind is history and is left in place.
- Filename-length limits for long ids. This is existing behaviour: the old sanitiser shared it, and the new encoding expands non-canonical characters.
- `CLAUDE.md`'s gate count, which is updated at release time and is jointly forbidden.

## Dependencies / Prerequisites

- Base `1adb50b`. No architect hop: every design question the manifest handed this lane is decided above, and no genuine open question remains.
- Resource Audit: the four backlog rows, the queue rows and the manifest reference no external artifact (no URL, Figma, mockup or ticket system), so `external_refs` is omitted.
- Mode `no-design` (no `design/e139-evidence-verdict-integrity.md`). Visual Structural Assertions are omitted.
- Serial order for sr: T-E154-01 → T-E136-01 → T-E136-02 → T-E139-01 → T-E236-01. Several tasks share files (`tools/evidence-file.ts`, `gates/qa-review.ts`, `tools/handoff-orchestrator.ts`), so this is one serial sr lane, never parallel. Each sr task commits its own `dist/` outputs (the generated `dist/` files are not counted against the `task_size` budget).
- `dispatch_mode` stays `feature`. The tickets are bug fixes, but the lane spans four tickets and the qa tests double as the reproductions.
- **Needs human ruling R1.** `test/e308-single-source-tier-enum.test.mjs` pins `GATE_REGISTRY.length === 34` (its `E303-AC12` test). Adding the E139 registry entry necessarily breaks that pin. The file is not in the lane's named 擁有 list, and it does not read or write evidence or verdicts. Requested grant: qa may change that one test's expected count (34 → 35) and its title text, nothing else.
- Source pins that sr must keep intact (none of them is expected to need edits):
  - `test/covering-evidence.test.mjs` slices `hasEvidenceInFile` to EOF and looks for `fs.existsSync(evidencePath(workspacePath, id))` and `fs.existsSync(codeReviewPath(workspacePath, id))`.
  - `test/ac-execution.test.mjs` I5b and `test/gates-expected-red.test.mjs` I5b pin the guard-to-call shape at the PASS steps.
  - `test/qa-flow.test.mjs` AC-13 pins the round-sentinel wording.
  - `test/visual-evidence-gate.test.mjs` AC-4 pins the `SCOPE_DECISION_REQUIRED` envelope block.
  - `test/context-budget.test.mjs` AC8 pins the `hasDesignModeRequiringVisual` import.
- **Existing tests checked against this change.** The table covers the manifest's 「會被擊中的測試」 list plus everything found by grepping for `review_verdict`, registry counts, evidence paths and `covers:`. A dist-level prototype of all four behaviour changes was run against the 64 evidence/verdict/registry test files in a scratch copy: 3 new failures, all in `test/qa-flow.test.mjs`, everything else unchanged. The count pins were found by grep, because the prototype added no registry entry.

  | test file | hit? | assertion that changes |
  |---|---|---|
  | `test/e35-pipeline-order.test.mjs` | **hit** | frozen `REVIEW_VERDICT_STATUS_MISMATCH` step `codes` gains `NON_REVIEWER_VERDICT_REJECTED` |
  | `test/error-code-contract.test.mjs` | **hit** | registry/ALL_GATE_CODES/mapping-comment counts 34 → 35 (AC-1/AC-5, doc-file mapping, E308/AC3); `FREE_TEXT_ALLOWLIST` gains the `triggerEdge` row for the new code |
  | `test/e26-gate-stats.test.mjs` | **hit** | every hard-coded `34` (R1, R2, U1, D1, line ~343, line ~656) → 35 |
  | `test/e308-single-source-tier-enum.test.mjs` | **hit — needs R1** | `GATE_REGISTRY.length, 34` → 35 (E303-AC12) |
  | `test/qa-flow.test.mjs` | **hit** | (a) `T-C9-10/AC-2` "ACCEPTS valid enum values" sends a `pm` write carrying `review_verdict` — keep the zod-acceptance intent without a non-reviewer verdict on an accepted write; (b) `T-C9-10/AC-5` "sr-engineer write carrying review_verdict=APPROVED is ACCEPTED" flips to REJECTED with `NON_REVIEWER_VERDICT_REJECTED` (the E139 behaviour change itself); (c) "recordReviewInFile sanitises path-traversal in task id" expects `review_..__002F_E_S_C_A_P_E.md` instead of `review_.._escape.md` (E136) |
  | `test/reviewer-completed-tasks-gate.test.mjs` | not hit | FM4/FM5 are the APPROVED row from `code-reviewer:In_Progress` |
  | `test/covering-evidence.test.mjs` | not hit | single-line `covers:` only; source pins kept |
  | `test/ac-execution.test.mjs` | not hit | canonical ids; single `covers:` line |
  | `test/gates-expected-red.test.mjs` | not hit | canonical ids; single `covers:` line |
  | `test/e32-e33-gate-hardening.test.mjs` | not hit | every verdict write is the APPROVED row from `code-reviewer:In_Progress` |
  | `test/e112-drift-fanout-feature-scope.test.mjs` | not hit | canonical ids; single `covers:` lines |
  | `test/release-staging.test.mjs` | not hit | `covers:` is SOP prose/sweep text, not `parseCoversIds`; `review_t-e51-01.md`/`review_b8.md` are filename-token fixtures |
  | `test/render-structure.test.mjs` | not hit | prose only |
  | `test/e177b-lane-status.test.mjs` | not hit (must stay unmodified) | one `covers:` line per file; lane-status reads filenames itself |
  | `test/e18-write-provenance.test.mjs` | not hit | verdict writes are the APPROVED row |
  | `test/handoff-migration.test.mjs`, `test/dispatch-mechanism.test.mjs`, `test/cut-approval-gate.test.mjs` | not hit | call `writeHandoffState` directly (no gate) or only read the field |
  | `test/qa-review-scoped-append.test.mjs` | not hit | accepted writes; byte format unchanged |
  | `test/visual-widgets-unverified-gate.test.mjs` | not hit | `T_does_not_exist` is asserted absent, which stays true under the new path |
  | `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**` | not hit | no `content/**` change |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E154-01 | sr (E154): `parseCoversIds` reads every `COVERS_LINE_RE` line via an internal `new RegExp(COVERS_LINE_RE.source, "gim")`. Line 1's tokens are returned as today; later lines add only tokens not yet present. The exported regex is unchanged. Update the function comment ("FIRST" → every line). Rebuild `dist/`. ~15 lines | none | 1 (+dist) | `tools/evidence-file.ts`、`dist/tools/evidence-file.*` | — |
| T-E136-01 | sr (E136, part 1): add `export function encodeEvidenceId` to `tools/evidence-file.ts`, exactly per the encoding table. Point `gates/qa-review.ts` `evidencePath`, `gates/code-review.ts` `codeReviewPath` and `tools/evidence-lookup.ts` `sanitizeTaskId` at it; function names stay, the source pins stay intact, and the stale "applied independently" comment is rewritten. Rebuild `dist/`. ~45 lines | T-E154-01 | 4 (+dist) | `tools/evidence-file.ts`、`gates/qa-review.ts`、`gates/code-review.ts`、`tools/evidence-lookup.ts`、`dist/tools/evidence-file.*`、`dist/gates/qa-review.*`、`dist/gates/code-review.*`、`dist/tools/evidence-lookup.*` | — |
| T-E136-02 | sr (E136, part 2): point `gates/ac-execution.ts` `reviewPath`, `gates/expected-red.ts` `reviewPath` and `gates/visual.ts` `visualEvidencePath` (task-id path derivation only) at `encodeEvidenceId`. The `active_feature` sanitisers stay byte-unchanged. Rebuild `dist/`. ~15 lines | T-E136-01 | 3 (+dist) | `gates/ac-execution.ts`、`gates/expected-red.ts`、`gates/visual.ts`、`dist/gates/ac-execution.*`、`dist/gates/expected-red.*`、`dist/gates/visual.*` | — |
| T-E139-01 | sr (E139): add `NON_REVIEWER_VERDICT_REJECTED` to the `GateErrorCode` union and `GATE_REGISTRY`, placed after `NON_QA_COMPLETED_TASKS_REJECTED`, with the Copy/Strings field values and `documentedInProse: false`. Add the `(none)` mapping-comment row and update the catalog/tool-boundary count comments to 35. Add the second branch to the `REVIEW_VERDICT_STATUS_MISMATCH` step and its `codes`, keeping the code-reviewer branch byte-identical; the branch is file-mode only and uses the APPROVED-row predicate above. Change `docs/architecture.md`'s gate count to 35 (the count only). Rebuild `dist/`. ~60 lines | none | 3 (+dist) | `gates/registry.ts`、`tools/handoff-orchestrator.ts`、`docs/architecture.md`、`dist/gates/registry.*`、`dist/tools/handoff-orchestrator.*` | — |
| T-E236-01 | sr (E236): add `recordReviewInFileUndoable` in `gates/qa-review.ts`, declared above `hasEvidenceInFile`; `recordReviewInFile` delegates to it with byte-identical behaviour. In `tools/handoff-orchestrator.ts`, `QA_REVIEW_RECORD` uses it in file mode and registers the undo in a module-level `WeakMap` keyed by ctx; other modes call `storage.recordReview` unchanged. `handleUpdateStateCore` runs the undo on a pipeline rejection (envelope returned unchanged) and on a throw from the pipeline or `writeState` (rethrown), and discards it on success. Step name, `codes` and order are unchanged. `tools/storage.ts` is not touched. Rebuild `dist/`. ~90 lines | T-E136-01, T-E139-01 | 2 (+dist) | `gates/qa-review.ts`、`tools/handoff-orchestrator.ts`、`dist/gates/qa-review.*`、`dist/tools/handoff-orchestrator.*` | — |
| T-E154-02 | qa (E154): new `test/e154-multi-covers.test.mjs` (AC-E154-1..5). Verify AC-E154-6 | T-E154-01 | 1 | `test/e154-multi-covers.test.mjs` | — |
| T-E136-03 | qa (E136): new `test/e136-evidence-path-injective.test.mjs` (AC-E136-1..5, AC-E136-7), with the fixed in-test canonical list and the generated corpus; no assertions on real `qa_reports/` contents. AC-E136-6 is proven through the T-E139-03 re-pin | T-E136-02 | 1 | `test/e136-evidence-path-injective.test.mjs` | — |
| T-E139-02 | qa (E139): new `test/e139-non-reviewer-verdict.test.mjs` (AC-E139-1..6, AC-E139-8), covering a per-role matrix, the APPROVED row, the near-misses, code-reviewer non-interference, absence, SQLite and the telemetry line | T-E139-01 | 1 | `test/e139-non-reviewer-verdict.test.mjs` | — |
| T-E236-02 | qa (E236): new `test/e236-rejected-write-evidence.test.mjs` (AC-E236-1..7), with one case per rejecting step after `QA_REVIEW_RECORD`, the STATE DRIFT throw case, the same-write evidence positive control and the undo concurrency guard. Verify AC-E236-8 | T-E236-01 | 1 | `test/e236-rejected-write-evidence.test.mjs` | — |
| T-E139-03 | qa (E139 + E136 re-pins): change only the assertions in the hit table. `test/e35-pipeline-order.test.mjs` gets the step `codes`. `test/error-code-contract.test.mjs` gets counts 34 → 35 and a `FREE_TEXT_ALLOWLIST` `triggerEdge` row. `test/e26-gate-stats.test.mjs` gets counts 34 → 35. `test/e308-single-source-tier-enum.test.mjs` gets 34 → 35, ONLY if R1 is granted. `test/qa-flow.test.mjs` gets the three tests named in the hit table. Then run AC-L1..L5 on the final HEAD, including the full suite under `node scripts/test-lock.mjs -- npm test` | T-E139-02, T-E236-02, T-E136-03, T-E154-02 | 5 | `test/e35-pipeline-order.test.mjs`、`test/error-code-contract.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/e308-single-source-tier-enum.test.mjs`、`test/qa-flow.test.mjs` | — |

## Findings filed

These are recorded in `.current/e139/pending-tickets.md`:

- `E139-NEW-1` — quote `NON_REVIEWER_VERDICT_REJECTED` in constitution prose and flip it to `documentedInProse: true`.
- `E236-NEW-1` — in SQLite mode a rejected qa write still leaves a `reports` row.
- `E136-NEW-1` — `tools/lane-status.ts` reads the id back from `review_<stem>.md` without decoding.
- `E136-NEW-2` — the `active_feature` sanitisers are the same lossy projection.
