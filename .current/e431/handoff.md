---
schema_version: 15
active_feature: "e431-test-first-server-path"
status: "In_Progress"
last_updated: "2026-11-20T05:56:59.718Z"
last_agent: "sr-engineer"
prd_path: "specs/e431-test-first-server-path.md"
scope_decision: "single-feature"
scope_decision_why: "One ticket in one lane: the integrator-approved fan-out plan (specs/fanout-v5-w2.md, human-approved 2026-11-20) cuts E431 as a single lane. Its parts (marker, matrix, judge identity, counters, schema) share tools/transitions.ts and tools/handoff-orchestrator.ts, so splitting them would mean shared files across tickets. No design surface."
cut_approved: true
dispatch_pins:
  pm: "opus"
  architect: "opus"
  sr-engineer: "opus"
  code-reviewer: "opus"
  qa-engineer: "sonnet"
evidence_schema: 2
next_role: "sr-engineer"
dispatched_at: "2026-11-20T05:56:59.718Z"
dispatch_mechanism: "task"
dispatch_mechanism_tier: "opus"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 3
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- sr-engineer session 3: T-E431-04 landed 35676c3 (tools/handoff-orchestrator.ts + dist/tools/handoff-orchestrator.{js,js.map,d.ts,d.ts.map}). TRANSITION_VALIDATION passes prev_chain_path (file mode && !feature_changed), next_chain_path (file mode), prev_sr_return_count. New module helpers above the pipeline doc comment: export readPersistedChainPath(ws, activeFeature?) (per blueprint, never throws, file mode only), resolveChainPath(ctx), isTestFirstEntryTarget(next, chainPath). Post-pipeline: resolvedChainPath + new_sr_return_count = computeSrReturnCount(...) -> writeState chainPath/srReturnCount; next_role lookahead gets chainPath + sr_return_count (strict and sameFeatureOnly calls spread the same options). Pipeline still 17 steps; gates/pipeline.ts, storage*.ts untouched.
- DEVIATION from blueprint (shape only, same behaviour): the four build-entry steps keep their inline pm-pinned predicate and OR the marked target in one line -- `(nextTuple.agent === "architect" || nextTuple.agent === "sr-engineer" || isTestFirstEntryTarget(nextTuple, resolveChainPath(ctx)))` -- instead of a whole isBuildEntryEdge() call, because test/cut-approval-gate.test.mjs XG-both-edges pins the "architect"/"sr-engineer" literals in the compiled external-refs block (went red with the helper). The `allowed` lists DO use allowedSuccessors("pm:In_Progress", resolveChainPath(ctx)) per blueprint.
- Verification: npm run build exit 0 (check:transitions-sync OK), npm audit --audit-level=high exit 0. Assigned 7 suites: 314 tests, 307 pass, 7 fail = 6 cut-approval-gate schema 15->16 (R-schema-1, M1-M4, X-malformed-parse; Probe) + e151 AC11 (:60, AC9 hint; Probe). Full node --test test/*.test.mjs: 4391 tests, 4320 pass, 69 fail, 2 skipped. All 69 are Probe groups (schema 15->16, registry 34->35, AC9 hint, descriptions incl. e150 AC20 :491 from T-02's completed_tasks desc) EXCEPT: (a) known cross-lane e295:122/125 (ignored), (b) NEW from T-04, non-behavioural: test/visual-evidence-gate.test.mjs:610 'AC-4: rejection envelope shape' -- a source regex pin /allowed:\s*\(ALLOWED_TRANSITIONS\.get\("pm:In_Progress"\)/ on the SCOPE_DECISION envelope, broken by the blueprint-mandated allowedSuccessors(...) call. No old-path outcome changed (unmarked allowed list is the same array contents/order).
- Smoke (TMPDIR script vs dist, 28/28 pass): marked pm->qa accepted with cut approved (no resume_of); marked pm->qa without cut -> CUT_APPROVAL_REQUIRED with overlay allowed list (qa in, sr out); marked pm->qa WITH resume_of still CUT_APPROVAL_REQUIRED (OQ1=a); entry-write marker on pm->qa accepted + persisted; qa->sr accepted; sr->qa returns 1,2 accepted (sr_return_count persisted), 3rd -> SR_RETURN_CAP_EXCEEDED; lookahead warns next_role=qa-engineer at cap; unmarked pm->qa no resume_of -> TRANSITION_REJECTED with AC9 hint; unmarked pm->qa resume_of without cut accepted (exemption kept), no chain_path/sr_return_count keys written; unmarked pm->sr without cut -> CUT_APPROVAL_REQUIRED with today's allowed list; marker on sr->cr, sr self-loop, pm->architect -> TRANSITION_REJECTED with AC10 hint, nothing persisted; feature change drops chain_path + sr_return_count.
- For T-05: (1) add test/visual-evidence-gate.test.mjs | AC-4: rejection envelope shape — error/attempted/allowed/hint keys present in handler to the expected-red manifest (qa re-pins to allowedSuccessors("pm:In_Progress"); group 1). (2) readPersistedChainPath is ready for the pre-preflight code-reviewer PASS guard and tasks.ts. (3) resolveChainPath(ctx) is available to the REVIEW_VERDICT_STATUS_MISMATCH / REVIEWER_COMPLETED_TASKS_REJECTED steps; for the general PASS guard (blueprint step 2) compute the marker from locals before ctx exists, or move the guard to just after ctx is built and call resolveChainPath(ctx). (4) ledger removal and RAG clear still hardcode qa-engineer (lines ~1453, ~1550): T-05 swaps to judgeFor(resolvedChainPath) -- resolvedChainPath is computed right after computeNewRound, before ledgerRemove, so it is in scope. (5) T-02 interim gap still open: unmarked code-reviewer PASS reaches the defense-in-depth requireQaEngineer text until the T-05 guard lands.

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
