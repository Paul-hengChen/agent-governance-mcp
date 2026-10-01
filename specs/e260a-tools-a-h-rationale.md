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

### tools/handoff-orchestrator.ts — effectiveAllowedSuccessors

The function calls `validateTransition` itself for every (agent, status) pair instead of reading the static ALLOWED table, because three edges sit outside that table:

- **The `resume_of` edge** (pm:In_Progress to code-reviewer or qa-engineer:In_Progress) is legal only when the write sets `resume_of` to that role. A future write's `resume_of` cannot be known here, so by default the edge counts as reachable: a false warning on a legal routing directive is worse than a missed one. `assumeResumeOf: false` returns the strict set, which the caller uses to mark conditional edges in its message.
- **The round and hop caps** collapse the allowed set to pm:In_Progress. The three round-cap overrides ignore `feature_changed`, so passing the post-write counters reproduces exactly what the next transition will see. The hop-cap override does read `feature_changed`: a write that opens a new feature bypasses it, and whether the next write will do so is unknowable. So the function unions both `feature_changed` branches: a candidate counts if either accepts it. Below the hop cap the branches agree. At or above it, this accepts missing a warning on an illegal same-feature `next_role` (the hop-cap-cross sentinel already covers that writer) in exchange for never warning on a legal next-feature one.
- **The self-loop fast path** (same agent, In_Progress to In_Progress) bypasses the static table entirely.

### tools/handoff-write.ts — field lifetimes

Handoff frontmatter fields follow one of four lifetimes when a write omits them:

- **Kept on every write** (`prd_path`, `scope_decision`, `scope_decision_why`): PM sets each once and later roles never re-pass them, so an omitting write keeps the on-disk value.
- **Feature-scoped, re-armed on PM re-entry** (`cut_approved` only): kept within the same `active_feature`, dropped on a feature change, and cleared on every PM In_Progress write. Every route back to PM (a new feature, a QA FAIL bounce, scope rework) passes through that write, so a stale `true` from an earlier cut can never approve a reworked one. Its absence blocks, which is why re-arming is safe: it forces a fresh approval.
- **Feature-scoped, no re-arm** (`external_refs`, `dispatch_pins`, `dispatch_mode`, `evidence_schema`, `cut_approved_source`): kept within the same feature, dropped on a feature change, untouched by PM re-entry. These record facts or directives that stay true for the life of the ticket. For `external_refs` the absence of the field *clears* the gate, so re-arming would silently discard a valid ledger and unblock `EXTERNAL_REFS_UNRESOLVED`.
- **One write only** (`next_role`, `resume_of`, `review_verdict`, `dispatched_at`, `dispatch_mechanism`, `dispatch_mechanism_tier`): written only when set on this write, never read back from the existing file. Carrying a single-hop directive or attestation forward would attach it to the wrong hop.

The round and hop counters (`qa_round`, `review_round`, `visual_round`, `hop_count` and the three cumulative totals) are always written, even as 0, so the fields are discoverable and a migration heal-write persists the seeded values.

### tools/handoff-write.ts — archive file name

`active_feature` may be up to 500 characters (the zod limit in `tools/registry.ts`), but a file name is limited to 255 bytes. The archive suffix `.<pid>.<epoch>.md` costs at most 25 bytes: 1 + 7 for the pid (generous for a Linux `pid_max` default), 1 + 13 for the epoch in milliseconds (enough until the year 2286), and 3 for `.md`. That leaves 230; the name is clamped to 200 for headroom. Truncating only the file name loses nothing, because the full outgoing `active_feature` survives verbatim in the copied file's own frontmatter. Without the clamp, a feature name of 233 or more characters (with a 5-digit pid) would throw `ENAMETOOLONG` on every later feature-change write, wedging the workspace on that feature with no `tw_*` way out.

### tools/drift.ts — buildEvidenceBackedLine

A qualifying record is one in the root `qa_reports/`, in `qa_reports/archive/<feature>/`, or a `covers:` label line in either, whose last recorded verdict is PASS or which records no verdict at all (the content test in `tools/evidence-lookup.ts`). Such ids are not agent error: `completed_tasks` is feature-scoped and legitimately empties when `active_feature` changes, and a merged parallel lane's ledger can be discarded on a merge conflict. This line only detects that; it does not fix the cause. `tw_sync`, the natural response to reported drift, is the wrong remedy because it would carry the previous feature's completion marks into the new feature's ledger. The line is one aggregate line, like the other compressed drift lines, and is never merged into `compressDriftDetails` output. Because the check reads a record and not the work itself, the line must not claim flatly that this "is NOT vibe-coding drift".
