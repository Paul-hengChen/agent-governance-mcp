# Review — e161-qa-claim-and-state-reads (E366 + E161 + E184, sr round 1)

covers: T-E366-01, T-E161-02, T-E184-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Range `f5485a7...a0fa96e`, source commits `c3ffd00` (T-E366-01), `5ca4834` (T-E161-02), `be5b6f2` (T-E184-01). Source touched: `tools/storage.ts`, `tools/storage-sqlite.ts`, `tools/handoff-orchestrator.ts`, `tools/registry.ts`, plus their `dist/` outputs.
- E366: `SqliteHandoffStorage.recordReviewUndoable` shares one private insert helper with `recordReview` and returns a one-shot undo that never throws. The undo deletes by primary key plus status, reviewer and notes. `QA_REVIEW_RECORD` feature-detects it through the optional `HandoffStorage` method and registers the undo in the existing `evidenceUndoByCtx`, so the existing reject, pipeline-throw and `writeState`-throw paths cover it.
- E161: the zod field `qa_suite_result` and the JSON `inputSchema` entry match the architecture contract. The notes are composed once in the orchestrator. When the field is absent, the same string reference is passed through, so the recorded bytes do not change.
- E184: `handleGetState` drops only the top-level `dispatch_mechanism_tier` before the existing pins advisory runs. When the key is absent, the text comes back byte-identical.
- The implementation follows the approved architecture contract almost line for line. There are no required findings. Verdict: APPROVED.

## AC Completeness
Code-level status. Each `proof:` test file belongs to a qa task (T-E366-02, T-E161-03, T-E184-02, T-E161-04) and does not exist yet. That is expected per the Cut, so it is not a finding.
- AC-E161-1 — implemented — `specs/e161-qa-claim-and-state-reads-architecture.md` "D-E161 — confirmed" and checks 1-4
- AC-E161-2 — implemented — `tools/handoff-orchestrator.ts:189-201,784`. The reviewer's scratch run recorded a file section body of exactly `suite-result: 2146/2146 passed (server-recorded from qa_suite_result; command: npm test)\n\nLooks good.\n\n` (the input `qa_review` had surrounding whitespace). The heading and the file header were unchanged.
- AC-E161-3 — implemented — same composition passed to `recordReviewUndoable`. Scratch run: SQLite `notes` = `suite-result: 3/5 passed (server-recorded from qa_suite_result)\n\nbody` with no `command`.
- AC-E161-4 — implemented — `composeQaReviewNotes` returns `qaReview` unchanged when `suite === undefined` (`tools/handoff-orchestrator.ts:198`). Scratch run: SQLite notes `"  raw  "` stored raw. `test/e236-*`, `test/qa-review-scoped-append.test.mjs` and `test/qa-flow.test.mjs` are green and unmodified.
- AC-E161-5 — implemented — `tools/registry.ts:295,315-336`. Every listed malformed shape is rejected at zod, plus U+2028, U+2029, U+0085, DEL, tab, a blank value, NaN, Infinity, 2^53, a string count, `null` and an array.
- AC-E161-6 — implemented — the composition sits inside the existing record guard (after the `QA_REVIEW_TARGET_REQUIRED` early return). `qa_suite_result` is read nowhere else and is not passed to `writeState`. Scratch run: the handoff carries no suite field.
- AC-E161-7 — implemented — the line is part of `notes`, so both undo paths cover it. Scratch run: a SQLite `MISSING_EVIDENCE` reject leaves only the pre-existing row.
- AC-E161-8 — implemented — there is no `passed < total` check outside the zod `passed <= total` refine. Scratch run: 3/5 was accepted and recorded verbatim.
- AC-E161-9 — implemented — `tools/registry.ts:710-726`: `type: "object"`, `required: ["passed","total"]`, `additionalProperties: false`. The description states that the field is recorded into the evidence, is not persisted to the handoff, and gates nothing.
- AC-E184-1 — implemented — `tools/handoff-orchestrator.ts:68,111-121`. Scratch run: the tier is absent, `dispatch_mechanism` is kept, and the other keys keep their order.
- AC-E184-2 — implemented — returns `text` unchanged when the key is absent. Scratch run: the SQLite `handleGetState` output is byte-identical to `readState`.
- AC-E184-3 — implemented — the advisory composes after the omission. Scratch run with on-disk pin `pm: gpt-9` plus a tier: the advisory is present and still the last key, and the tier is absent.
- AC-E184-4 — implemented — the write path, parse and sidecar are untouched. `test/dispatch-log.test.mjs` and `test/dispatch-mechanism.test.mjs` are green unmodified.
- AC-E366-1 — implemented — `tools/storage-sqlite.ts:848-872` plus the orchestrator branch at `:794-798`. Scratch run confirms.
- AC-E366-2 — implemented — reached through the existing `writeStateKeepingEvidence`. Scratch run with a monkeypatched `writeState` that throws: the same error propagated and no row was left.
- AC-E366-3 — implemented — the rows are inserted before `PASS_MISSING_EVIDENCE`. Scratch run: a PASS whose only evidence is its own write is accepted and its rows remain.
- AC-E366-4 — implemented — scratch run: an older same-task row and a later row with identical notes but a different `created_at` both survive the undo. A second undo is a no-op. A closed DB means no throw and the row stays. A row whose notes were altered after the record is left in place. Mutating the caller's array after the call does not change the undo set.
- AC-E366-5 — implemented — the file branch is unchanged apart from passing `notes` (the same reference when the field is absent). The four named test files are green unmodified.
- AC-L1 — implemented — no step, code or registry change. `test/e35-pipeline-order.test.mjs` and `test/error-code-contract.test.mjs` are green.
- AC-L2 — implemented — no `schema/**` or `docs/schema-versions.md` path is in the diff.
- AC-L3 — implemented — `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e161`: 24 files, 0 out of bounds, exit 0.
- AC-L4 — deferred to T-E161-04 (qa lane close, by Cut design). Targeted run here: 21 files, 506/506 pass.

## Correctness
No required findings. Verified:
- Undo registration. Exactly one branch runs per write, so at most one undo is registered per `ctx`. Its callers are unchanged: `undoRecordedEvidence` on a pipeline rejection or throw (`tools/handoff-orchestrator.ts:1342-1349`), and `writeStateKeepingEvidence` on a `writeState` throw (`:170-181`). The code between the pipeline and `writeState` (`:1352-1432`) is synchronous and cannot throw, so no path leaves rows behind other than the residual window accepted in OQ-5.
- The SQLite undo deletes by PK `(workspace_path, task_id, created_at)` AND `status`/`reviewer`/`notes` (`tools/storage-sqlite.ts:371-375`), in one transaction. It is one-shot through the `done` latch and never throws (`try`/`catch` around both the creation and the run of the transaction). It works on an id snapshot (`[...taskIds]`). A throw from the insert propagates before any undo exists, which matches today's `recordReview` (OQ-6).
- `storage.recordReviewUndoable(...)` is called as a method, so `this` is bound. The orchestrator does not import `storage-sqlite`.
- The OQ-1 character set is enforced. `tools/registry.ts:295` and `dist/tools/registry.js:236` both hold the ASCII `\u0000-\u001F\u007F\u0085  ` escapes. A perl scan of all four source files and their `dist/` counterparts finds no raw U+0085, U+2028 or U+2029.
- OQ-2 trimming applies only when the field is present.
- The zod checks are stricter than the JSON schema in two places that JSON Schema cannot express: the forbidden character set and the `passed <= total` cross-field rule. Both are described in the JSON schema's description strings. All other constraints match (integer, minimum 0 or 1, string length 1..200, required, no extra keys).
- optional — `tools/handoff-orchestrator.ts:784`: a whitespace-only `qa_review` together with `qa_suite_result` records SQLite notes as `"<line>\n\n"`, with a trailing blank. File mode trims this away. This is harmless, and the architecture doc already accepts it for file mode.

## Quality
- The literal `if (storage instanceof FileHandoffStorage)` still appears 3 times, the same as at base, so the I5b `lastIndexOf` anchors hold.
- No new SNAKE_CASE gate-like tokens. The custom zod messages start with lower-case `qa_suite_result`, so `emitZodGateTelemetry` never matches them (`test/e303`/`test/e324` are green).
- Comments (§6): each new helper has a WHAT/WHY head comment. The in-body comments in the `QA_REVIEW_RECORD` step and the registry object literal replace or mirror existing in-place comments, which is the convention of the surrounding code. The best-effort rationale for the SQLite undo's `catch` sits in the head comment of `recordReviewUndoable`. `agc check` printed no comment warnings. No absolute paths or sensitive information appear in the source.
- optional — `tools/storage-sqlite.ts:867-869`: `catch { return; }` could be `catch { /* best effort */ }` or a bare empty catch. The explicit `return` reads as if it might carry meaning.
- optional — `tools/handoff-orchestrator.ts:153-155`: the reflowed `evidenceUndoByCtx` comment still ends "so the evidence files never record a verdict". This could now say "evidence files or rows". It is wording only.
- `dist/` matches a fresh `npm run build`: the in-place rebuild left `git status` clean apart from this hop's handoff and sidecar.

## Architecture
The code matches `specs/e161-qa-claim-and-state-reads-architecture.md` in placement, signatures, ordering (tier omission, then advisory), and the D-E366, D-E161 and D-E184 choices. There are no unjustified deviations. OQ-4 holds: the file-mode E236 call site keeps its shape and position, with only the `notes` argument changed. `FileHandoffStorage` does not implement the new method.

## Security
- `command` cannot forge a `covers:` line, a verdict heading or an H2 anchor. All JS line terminators and C0 controls are rejected at the zod boundary, before the handler runs. The value is rendered after a fixed `suite-result:` prefix.
- The new SQL is a parameterised prepared statement, so there is no injection vector.
- `withoutDispatchMechanismTier` only deletes a key from parsed JSON and never throws.

## Performance
No regression. `handleGetState` adds one `JSON.parse` on a small envelope, and one `JSON.stringify` only when the key is present. The undo is O(ids) prepared deletes in one transaction, and it runs only on a rejected write.

## Verdict
APPROVED. All 22 ACs are implemented or correctly deferred to qa, with zero required findings. Three optional nits do not block.

Note (same-model bias, per SOP): sr-engineer and this reviewer both ran on opus.
