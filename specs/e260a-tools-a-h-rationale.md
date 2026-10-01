# e260a — rationale moved out of tools/[a-h]* comments

This file holds what lane e260a took out of long comment blocks in `tools/[a-h]*.ts`: the blocks of 8 to 20 counted lines kept on purpose, each with a one-line reason, and the reasons still worth keeping that no longer fit in the code. A comment that points here names this file and one heading below.

## Kept blocks

| block | counted | reason |
|---|---|---|

## Moved rationale

### tools/handoff-orchestrator.ts — check order

`tw_update_state` runs its checks in this order: pre-flight, the PASS-is-qa-engineer check, context derivation, then the `UPDATE_STATE_GATE_PIPELINE` steps, then the round-cap sentinels, `storage.writeState`, and the PASS-time RAG clean-up hook. Two placements inside the pipeline are load-bearing:

- The stamp-provenance gate runs before the feature-lease gate because the lease predicate reads `last_updated`; on a hand-authored stamp the lease's freshness answer cannot be trusted.
- The QA completion-evidence gate runs after the `qa_review` auto-record, so a write that carries its own review counts as evidence for itself.

The order is asserted by a QA-owned order test, not by this comment. Several tests (the error-code contract, the AC-execution source checks, the expected-red gate tests) match exact byte shapes inside gate bodies, which is why the bodies keep their deep indentation.

### tools/handoff-orchestrator.ts — STAMP_PROVENANCE_SUSPECT

- The predicate is the one `tools/drift.ts` uses for its read-only stamp advisory, so the gate and the advisory always agree.
- It runs after `validateTransition`, so a transition-shaped rejection is still reported first.
- It is unrelated to the freshness guard inside `writeState`, which compares file modification times and never reads the stamp.
- The remediation must be a normal write: a `bookkeeping_write` keeps the old `last_updated`, so the suspect stamp would survive it.
- File mode only, because SQLite/HTTP stamps come from the database write path, as with the other attestation gates.

### tools/handoff-orchestrator.ts — FEATURE_LEASE

- Same-feature writes never gate: the predicate short-circuits when the feature has not changed.
- The core clauses read `active_feature`, `status` and `last_updated`, which SQLite rows also have, so the gate works in both storage modes. The release-engineer closing-write marker also reads `last_agent` and `next_role`, which only file mode stores, so that clause never matches under SQLite. This asymmetry is accepted.
- The marker's `pending_notes` clause is limited to file mode at the call site, not inside the pure predicate. SQLite does store `pending_notes`, so passing `prevState` whole would quietly extend the marker's relief to SQLite; the explicit lease-fields object passes `pending_notes` only under `FileHandoffStorage`, and SQLite inputs stay bounded by the TTL alone.
- The gate lives here, not in `tools/transitions.ts`, which stays pure and free of file-system reads.

### tools/handoff-orchestrator.ts — NON_QA_COMPLETED_TASKS_REJECTED

The QA completion-evidence gate compares an incoming qa-engineer write's `completed_tasks` against the on-disk set. Ids that some other role persisted before any qa-engineer write would therefore add no difference and never be checked for evidence. That is why this check rejects any non-empty `completed_tasks` from every role except `qa-engineer` (and `code-reviewer`, handled by its own branch), whatever the ids: a set difference here would leave exactly that gap open. No exemptions: an exemption on this kind of check reopens the same gap. `tw_complete_task` has its own evidence path and never goes through `tw_update_state`.

### tools/handoff-orchestrator.ts — QA_REVIEW_RECORD

There is no fallback that stamps every open task when both `review_task_ids` and `completed_tasks` are empty. A FAIL write legitimately has an empty `completed_tasks`, so such a fallback would copy the review into the evidence file of every unrelated open task. Rejecting with `QA_REVIEW_TARGET_REQUIRED` means evidence is never forged and never silently dropped. The check reads only the incoming arguments, so it behaves the same in file and SQLite mode.

### tools/handoff-orchestrator.ts — QA_COMPLETION_EVIDENCE_MISSING

- It closes the identity-swap path the reviewer gate cannot see: another agent writing with `agent_id="qa-engineer"` to pre-fill `completed_tasks` before any real QA ran.
- Only new ids are checked, so the normal cumulative flow works: QA can pass the full list back without fresh evidence for ids already on disk. Carry-forward never gates.
- No exemption for the APPROVED handoff (code-reviewer:In_Progress to qa-engineer:In_Progress): a forged write of that shape is byte-identical to a real one, and ids persisted that way would poison the on-disk baseline so later carry-forwards pass unchecked. Review scope on that handoff travels only in the transient `review_task_ids` field; `completed_tasks` on a qa-engineer write is reserved for evidence-backed completions.
- No `prevState` guard: on a new workspace every claimed id is new, and a first-write completion claim with no evidence is exactly what this rejects.
- `bookkeeping_write` touches do not grow the ledger. Ledgers polluted before this rule existed are left as they are.
- File mode only, like the other attestation gates; SQLite's `hasEvidence` path is based on report rows and is out of scope.
