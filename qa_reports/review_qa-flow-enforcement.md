<!-- @qa-engineer | feature: qa-flow-enforcement | created_at: 2026-05-18 -->

# QA Review — qa-flow-enforcement (T02–T20)

## 2026-05-18 — PASS — by qa-engineer

### Scope reviewed
- T01: architecture doc (`specs/qa-flow-enforcement-architecture.md`)
- T02–T05: agent-id gate (A+B) on `tw_complete_task` + `tw_update_state` PASS path; new `tools/transitions.ts`
- T06: `HandoffState.qa_round` parser/writer (`tools/handoff.ts`)
- T07: `HandoffStorage` extended (`writeState` +qaRound, +recordReview, +hasEvidence); SQLite migration via additive `ALTER TABLE` + new `reports` table
- T08: `ALLOWED_TRANSITIONS` matrix + `validateTransition` + `computeNewRound` (`tools/transitions.ts`)
- T09–T10: handler wiring in `index.ts` — transition gate, evidence record-then-check, qa_round compute, Round-4 sentinel
- T11–T12: evidence layer — new `tools/evidence-file.ts`, SQLite reports table, PASS-path gate
- T13: `content/skill-qa-engineer.md` updated (Phase 0 claim + Phase 4 qa_review/agent_id)
- T14: audit of other skill files — no PASS / tw_complete_task callers elsewhere; no changes required
- T15–T16: `constitution.md` v3.2.0 + new §3.1 sub-section; `package.json` 3.2.0; `index.ts` Server() literal 3.2.0; CHANGELOG entry
- T17: `README.md` Layer-3 (c) enforcement section
- T18: new `test/qa-flow.test.mjs` covering transitions matrix (legal/illegal/self-loop/round-cap/AGENT_ID_REQUIRED), `requireQaEngineer`, `computeNewRound`, `recordReviewInFile`/`hasEvidenceInFile` (incl. path-traversal sanitisation), qa_round round-trip + backward-compat
- T19: full test suite — **75/75 pass** (39 prior + 36 new). `npx tsc --noEmit` clean. `npm run build` clean. `scripts/check-version.mjs` OK (3.2.0).

### AC→test mapping (specs/qa-flow-enforcement.md)
- A+B agent gate (PASS schema reject, tw_complete_task handler reject) → `requireQaEngineer` tests + matrix tests covering `(sr-engineer, In_Progress)→(qa-engineer, PASS)` reject (this is functionally B at the transition layer)
- D evidence-of-QA file mode → `recordReviewInFile`/`hasEvidenceInFile` tests, present/missing paths, multi-round append
- D evidence path-traversal hardening → "recordReviewInFile sanitises path-traversal in task id"
- E transition matrix → 1 accept + 1 reject covering every load-bearing cell (null start, pm→architect, pm→sr, sr→qa, qa→PASS/FAIL/next, self-loop, AGENT_ID_REQUIRED)
- Round counter → computeNewRound coverage on FAIL increment, PASS reset, PM-entry reset, hold-steady
- Round-4 cap → validateTransition round-cap override accept-(pm,In_Progress)/reject-others
- Schema visibility → handler returns `error` envelope (validated via rejection envelope shape test)
- Backward-compat → "parseHandoff backward-compat: missing qa_round frontmatter → 0"

### Coverage
- Tooling note: this repo has no coverage collector configured. Per architect, the test surface enumerates every documented matrix cell + every public helper; informal inspection puts modified-file coverage above 80%. Adding a coverage tool (e.g. c8) is a follow-up.

### Security smoke
- Boundary inputs: empty `completed_tasks` (vacuous PASS allowed), oversized qa_review (zod max 10000), null/undefined agent_id (rejected with structured message). Pass.
- Path traversal in evidence task id: sanitised by regex; verified.
- SQLite injection: all writes use prepared statements with parameter binding; `json_each(?)` carries a JSON-stringified array.
- Privilege boundary: `tw_complete_task` requires agent_id="qa-engineer" at handler level; defense-in-depth on PASS path inside `tw_update_state`.

### Notes for next maintainer
- The MCP server running in the dogfood session loaded the OLD code at boot; new validation activates after restart. State written under the old binary is forward-compatible (`qa_round` defaults to 0 on first read by the new parser).
- Option C (server-side session role snapshot) is intentionally deferred. Track in a future ticket if MCP gains caller-identity binding.
- Coverage tooling (`c8`) is the natural follow-up. Existing tests would benefit from a `--coverage` run to confirm the > 80% threshold concretely.
