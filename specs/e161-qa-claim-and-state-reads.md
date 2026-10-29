# e161-qa-claim-and-state-reads — E161 + E184 + E366

Lane `e161`, post-v4 wave 12 (`specs/fanout-post-v4-w12.md`). Branch `feat/e161-qa-claim-and-state-reads`, base `f5485a7`. Three tickets on the handoff read/write path: what a qa PASS claims, what `tw_get_state` shows the next writer, and what a refused qa write leaves behind in SQLite mode.

## Problem Statement

Three gaps on the `tw_update_state` / `tw_get_state` path.

- **E161.** A qa PASS states its suite figures (for example *"Full npm test: 2146/2146 green"*) only inside the free-text `qa_review`. The server writes that text into the evidence record and never looks at it. In the originating instance the claim was 2146/2146 while the suite was 2144/2146; the coordinator found it only by re-running the suite. No field carries the figure, so nothing downstream can check it, and the figure has the same standing as any other sentence of prose.
- **E184.** `tw_get_state` returns the previous hop's `dispatch_mechanism_tier` (a transient self-report of the model that wrote the last state). The next writer reads `tw_get_state` first, every time (Pre-Flight). A tier value sitting in that read invites the next writer to copy it instead of reporting the model it is actually running on. E174 made the tier a self-report; showing the last writer's value at the moment of the next write weakens that.
- **E366.** In SQLite/HTTP mode, the `QA_REVIEW_RECORD` step inserts `reports` rows (`storage.recordReview`) before the later PASS gates run. When a later step rejects the write, or `writeState` throws, the rows stay. A PASS row is evidence for `hasEvidence`, so the durable record then shows a verdict the server refused. E236 fixed the same defect for file mode (`recordReviewInFileUndoable`); the SQLite half was left open.

## User Stories

- As a coordinator, I want a qa PASS's suite figures in a structured field that the server records in a fixed format, so that a later check can compare them against a real run without parsing prose.
- As a qa-engineer, I want my suite figures recorded exactly as I submitted them next to my review, so that the evidence states plainly what I claimed.
- As the next role in a chain, I want `tw_get_state` not to show me the previous hop's model tier, so that I report my own tier instead of copying someone else's.
- As an auditor, I want the per-hop tier record to stay where it is today (the handoff file and `.current/<lane>/dispatch.jsonl`), so that removing it from the read view loses no history.
- As an operator of the HTTP/SQLite server, I want a rejected qa PASS/FAIL write to leave no `reports` row, so that SQLite evidence never shows a verdict the server refused.

## Design decisions (per ticket)

### E161 — PM decision D-E161: a structured field, recorded by the server into the evidence record (architect confirms or overturns, T-E161-01)

The backlog row makes this design question the first task. PM's decision, for architect to confirm in the architecture doc:

- **Option A (chosen): a structured field on the qa write.** `tw_update_state` gains an optional `qa_suite_result` argument. The server writes it into the evidence record in one fixed, server-formatted line. The figure stops being prose: it has a schema, the server checks its shape, and the server alone writes the line.
- **Option B (rejected): parse the claim out of the evidence file / `qa_review` prose.** Rejected for three reasons. (1) The backlog row itself calls prose parsing brittle: qa writes the figure in many shapes ("2146/2146 green", "2146 pass, 0 fail", "all 2146 tests pass"), so a parser either misses claims or invents them. (2) The evidence-file parser (`tools/evidence-file.ts`) belongs to lane e367 this wave, so B cannot be built here. (3) The sibling precedents went the same way: `review_verdict` and `evidence_schema` became fields instead of note lines.

**Field shape (architect may refine the shape, not the decision):**

- `qa_suite_result?: { passed: integer ≥ 0, total: integer ≥ 1, command?: string }`.
- `passed ≤ total`.
- `command`: 1–200 characters, no carriage return or line feed (so the field cannot forge a markdown heading or a `covers:` line in the evidence file).
- Unknown keys are rejected.
- All of the above is checked at the zod boundary (`tools/registry.ts`), plus the matching JSON `inputSchema` entry. A malformed value is refused like any other zod failure. No new gate code is added.

**Where it is recorded (no schema bump):**

- In the `QA_REVIEW_RECORD` step (`tools/handoff-orchestrator.ts`), when that step records evidence (a qa-engineer PASS/FAIL write with `qa_review` and a resolved target), and the write carries `qa_suite_result`, the notes handed to the record call become: the server line, a blank line, then the `qa_review` text.
- The server line comes first so that it never lands inside a qa-authored subsection (for example an `## AC execution log` table at the end of `qa_review`).
- File mode: the line sits in the new `## <ts> — <status> — by qa-engineer` section of each `qa_reports/review_<id>.md` (through `recordReviewInFileUndoable`, so the E236 undo covers it with no change to `gates/qa-review.ts`).
- SQLite mode: the same composed text goes into the `notes` column of each `reports` row (covered by the E366 undo).
- No handoff frontmatter field and no SQLite column are added, so no `schema_version` changes (`docs/schema-versions.md`: a bump is needed only for a new persisted handoff/tasks/sqlite/config field).
- Composing the notes in the orchestrator keeps one composition site for both modes and leaves `gates/qa-review.ts` and `tools/storage-sqlite.ts`'s record format untouched.

**What this lane does not do (D1 ruling A, plus the gate-registry boundary):**

- No rejection on `passed < total`, no "required on PASS", and no authorship rejection when a non-qa role supplies the field. Each of these is a new reject condition and needs a new `GATE_REGISTRY` entry. `gates/registry.ts` belongs to lane e152 this wave, so these are filed as a new finding (`E161-NEW-1`).
- Making the field required before the qa SOP tells qa to fill it would also break every qa PASS.
- The qa SOP sentence (`content/**`) is deferred to the ticket the integrator files at wave close (D1 A).
- When the step does not record (non-qa writer, `In_Progress`, no `qa_review`), the field is silently ignored: it is not persisted and it changes no outcome.

**Architect checks for T-E161-01:**

1. Confirm that no existing evidence reader treats a leading `suite-result:` line specially. Readers to check: `buildCoverageIndex` / `COVERS_LINE_RE`, the expected-red and AC-execution disposition readers, the visual evidence reader, and the evidence-schema v2 anchors.
2. Confirm the source pins listed under Dependencies stay intact.
3. Confirm the zod refinement surfaces through the existing zod-boundary error path and telemetry (`test/e303-zod-boundary-telemetry.test.mjs`, `test/e324-zod-telemetry-under-current.test.mjs`) without a new code.
4. If architect overturns D-E161 (Option B, or a persisted handoff field that needs a schema bump), the file set in the Cut changes: route back to PM for a re-cut. Do not extend the touches silently.

### E184 — PM decision D-E184: omit the tier from the `tw_get_state` read view (option choice)

- **Chosen: omit.** `handleGetState` drops the top-level `dispatch_mechanism_tier` key from the JSON envelope it returns. This is an envelope transform in `tools/handoff-orchestrator.ts`, next to the existing `withDispatchPinsAdvisory`. When the key is absent, the text is returned byte-identical to `storage.readState` (the same posture as the advisory).
- **Rejected: label it as the previous hop's value** (for example `previous_hop_dispatch_mechanism_tier`). A labelled value is still a value sitting in the read the next writer always does first. It can still be copied, and the E137 data point (a reviewer dispatched on sonnet self-reported opus) shows labels do not stop that. No reader needs the value from `tw_get_state`: the coordinator's pin-vs-actual audit reads the handoff file or the append-only `.current/<lane>/dispatch.jsonl`, which keeps every hop, while the handoff holds only the last.
- **Unchanged:**
  - The write path (`handoff-write.ts` still persists the tier when set on this write).
  - `parseHandoff` / `readHandoffState` (the library read keeps returning it).
  - The dispatch sidecar.
  - SQLite mode (it never stores the field).
  - `dispatch_mechanism` (out of scope, see below).
- **Known residual (new finding `E184-NEW-1`):** the role-prompt state block (`prompts/build.ts` `renderHandoffStateBlock`, also used by the opt-in SessionStart hook) renders the parsed state, tier included. `prompts/**` and `bin/**` are forbidden to this lane.

### E366 — PM decision D-E366: an undo handle mirroring E236 (option choice)

- **Chosen: undo handle.**
  - `SqliteHandoffStorage` gains an undoable record: it inserts exactly as `recordReview` does (same rows, same single synchronous transaction) and returns an undo.
  - The undo deletes exactly the rows it inserted, keyed by the `reports` primary key `(workspace_path, task_id, created_at)` plus `status`/`reviewer`/`notes`, in one transaction. A row written by anyone else is never touched.
  - The undo never throws (a closed database or a failed delete leaves the rows as they are).
  - The optional method is declared on the `HandoffStorage` interface (`tools/storage.ts`). `QA_REVIEW_RECORD` uses it through the interface when the storage provides it and registers the undo in the existing `evidenceUndoByCtx` WeakMap. The existing reject, pipeline-throw and `writeState`-throw paths then undo SQLite rows exactly as they already undo file evidence.
  - `tools/handoff-orchestrator.ts` must not import `tools/storage-sqlite.ts` (that would load `better-sqlite3` on the file-mode path).
  - File mode keeps calling `recordReviewInFileUndoable` unchanged. A storage without the method keeps calling `recordReview` unchanged.
- **Rejected: a transaction spanning record → writeState.** better-sqlite3 transactions are synchronous and cannot span the `await`s between `QA_REVIEW_RECORD` and `writeState`. A manual `BEGIN` held open across those awaits on the HTTP server's shared connection would pull concurrent requests from other workspaces into the same transaction, and a rollback would erase their writes. The undo handle also keeps the same-write evidence visible to `PASS_MISSING_EVIDENCE`, exactly as today.

## Acceptance Criteria

### E161

- **AC-E161-1** — Given this spec and the architecture doc, when T-E161-01 is done, then `specs/e161-qa-claim-and-state-reads-architecture.md` has a section that confirms D-E161 (structured field, server-recorded, no schema bump) or overturns it with a reason, and answers the four architect checks above.
  proof: `grep -n "D-E161" specs/e161-qa-claim-and-state-reads-architecture.md` prints at least one line.
- **AC-E161-2** — Given file mode, when a qa-engineer PASS write carries `qa_review`, `review_task_ids: [T]` and `qa_suite_result: { passed: 2146, total: 2146, command: "npm test" }` and is accepted, then the new section in `qa_reports/review_T.md` has the body: the line `suite-result: 2146/2146 passed (server-recorded from qa_suite_result; command: npm test)`, a blank line, then the trimmed `qa_review` text. The section heading and the file header are byte-identical to today's format.
  proof: `node --test --test-name-pattern="AC-E161-2" test/e161-qa-suite-result.test.mjs` passes.
- **AC-E161-3** — Given SQLite storage, when the same write is accepted, then each `reports` row it inserts has `notes` equal to that line, `\n\n`, and the `qa_review` text. Without `command`, the line is `suite-result: <passed>/<total> passed (server-recorded from qa_suite_result)`.
  proof: `node --test --test-name-pattern="AC-E161-3" test/e161-qa-suite-result.test.mjs` passes.
- **AC-E161-4** — Given a qa PASS/FAIL write without `qa_suite_result`, then the evidence bytes (file mode) and the `notes` value (SQLite) are exactly what they are today. `test/qa-review-scoped-append.test.mjs` and `test/e236-rejected-write-evidence.test.mjs` AC-E236-6 stay green unmodified.
  proof: `node --test --test-name-pattern="AC-E161-4" test/e161-qa-suite-result.test.mjs` passes.
- **AC-E161-5** — Given each malformed `qa_suite_result` value, then the write is rejected at the zod boundary. The handoff and the evidence are unchanged, and no new error code appears. The malformed values are: `passed > total`, a negative or non-integer count, `total: 0`, a missing `passed` or `total`, an unknown key, a `command` containing `\n` or `\r`, and a `command` over 200 characters.
  proof: `node --test --test-name-pattern="AC-E161-5" test/e161-qa-suite-result.test.mjs` passes.
- **AC-E161-6** — Given a write that carries a well-formed `qa_suite_result` but where `QA_REVIEW_RECORD` does not record (a non-qa `agent_id`, `status: In_Progress`, or no `qa_review`), then the outcome (accepted or rejected, and the envelope) is the same as for the same write without the field. Nothing is recorded, and `qa_suite_result` does not appear in the handoff file.
  proof: `node --test --test-name-pattern="AC-E161-6" test/e161-qa-suite-result.test.mjs` passes.
- **AC-E161-7** — Given a qa PASS write that carries `qa_suite_result` and that a later step rejects (file mode: a step after `QA_REVIEW_RECORD`; SQLite: `MISSING_EVIDENCE`), then the suite line is undone with the rest of the record. The evidence file is byte-identical (file mode), or no row is left (SQLite).
  proof: `node --test --test-name-pattern="AC-E161-7" test/e161-qa-suite-result.test.mjs` passes.
- **AC-E161-8** — Given a qa PASS write whose `qa_suite_result` has `passed < total`, then it is recorded verbatim and the write is not rejected on that basis. Rejection is deferred to `E161-NEW-1`.
  proof: `node --test --test-name-pattern="AC-E161-8" test/e161-qa-suite-result.test.mjs` passes.
- **AC-E161-9** — Given `tools/list`, then the `tw_update_state` `inputSchema` has a `qa_suite_result` property (type object, required `passed` and `total`, `additionalProperties: false`) whose description states that it is recorded into the evidence record, that it is not persisted to the handoff, and that it gates nothing.
  proof: `node --test --test-name-pattern="AC-E161-9" test/e161-qa-suite-result.test.mjs` passes.

### E184

- **AC-E184-1** — Given file mode and an on-disk handoff carrying `dispatch_mechanism_tier: opus`, when `handleGetState` runs, then the parsed JSON has no `dispatch_mechanism_tier` key, and every other key and value equals `storage.readState`'s output (including `dispatch_mechanism`).
  proof: `node --test --test-name-pattern="AC-E184-1" test/e184-get-state-omits-tier.test.mjs` passes.
- **AC-E184-2** — Given a handoff without `dispatch_mechanism_tier` (file mode), and separately SQLite mode, then `handleGetState`'s text is byte-identical to `storage.readState`'s.
  proof: `node --test --test-name-pattern="AC-E184-2" test/e184-get-state-omits-tier.test.mjs` passes.
- **AC-E184-3** — Given an on-disk handoff with an out-of-enum `dispatch_pins` value and a tier, then the response carries `dispatch_pins_advisory` exactly as today and still omits the tier.
  proof: `node --test --test-name-pattern="AC-E184-3" test/e184-get-state-omits-tier.test.mjs` passes.
- **AC-E184-4** — Given a write that sets `dispatch_mechanism_tier`, then the handoff file, `readHandoffState` / `parseHandoff`, and `.current/<lane>/dispatch.jsonl` still carry it as today. `test/dispatch-log.test.mjs` stays green unmodified. `test/dispatch-mechanism.test.mjs` keeps its assertions. RT2 may only be retitled so that it names the library read, not `tw_get_state`.
  proof: `node --test test/dispatch-log.test.mjs test/dispatch-mechanism.test.mjs` passes.

### E366

- **AC-E366-1** — Given SQLite storage and a qa-engineer PASS write with `qa_review`, `review_task_ids: [T1]` and `completed_tasks: [T1, T2]`, where T2 has no PASS row, when `MISSING_EVIDENCE` rejects it, then the workspace's `reports` row count and contents equal their pre-write values.
  proof: `node --test --test-name-pattern="AC-E366-1" test/e366-sqlite-rejected-write-evidence.test.mjs` passes.
- **AC-E366-2** — Given SQLite storage and a qa PASS/FAIL write that passes every gate but whose `writeState` throws, then no `reports` row from that write remains, and the same error propagates.
  proof: `node --test --test-name-pattern="AC-E366-2" test/e366-sqlite-rejected-write-evidence.test.mjs` passes.
- **AC-E366-3** — Given SQLite storage and an accepted qa PASS write whose only evidence is its own `qa_review`, then it is accepted as today and its rows remain (positive control: same-write evidence still satisfies `MISSING_EVIDENCE`).
  proof: `node --test --test-name-pattern="AC-E366-3" test/e366-sqlite-rejected-write-evidence.test.mjs` passes.
- **AC-E366-4** — Given the undo for one record, when another row exists for the same `(workspace_path, task_id)` with a different `created_at`, or the database is closed, then the undo deletes only its own rows, or deletes nothing, and never throws.
  proof: `node --test --test-name-pattern="AC-E366-4" test/e366-sqlite-rejected-write-evidence.test.mjs` passes.
- **AC-E366-5** — Given file mode, then E236 behaviour is unchanged.
  proof: `node --test test/e236-rejected-write-evidence.test.mjs test/qa-flow.test.mjs test/sqlite-versioning.test.mjs test/qa-review-scoped-append.test.mjs` passes, with those files unmodified.

### Lane-wide

- **AC-L1** — No error code is added, removed or reworded. `GATE_REGISTRY` and `UPDATE_STATE_GATE_PIPELINE` step names, `codes` and order are unchanged.
  proof: `node --test test/e35-pipeline-order.test.mjs test/error-code-contract.test.mjs` passes, with those files unmodified.
- **AC-L2** — No `schema_version` changes for any kind.
  proof: `git diff --stat f5485a7 -- schema docs/schema-versions.md` prints nothing.
- **AC-L3** — Every changed path is in the lane's 擁有 set.
  proof: `node scripts/fanout.mjs check specs/fanout-post-v4-w12.md e161` exits 0 on the final HEAD.
- **AC-L4** — The full suite is green on the final HEAD, run after commit with a clean tree.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e161.suite-line | `suite-result: {passed}/{total} passed (server-recorded from qa_suite_result)` | authored-here — a fixed, greppable prefix that matches no existing evidence anchor (`covers:`, `## ` headings) |
| e161.suite-line-cmd | `suite-result: {passed}/{total} passed (server-recorded from qa_suite_result; command: {command})` | authored-here — same line with the optional command, so a re-run can use the exact command qa named |
| e161.schema-desc | `qa_suite_result` inputSchema description (architect finalizes wording): must state that it is optional, is recorded into the qa evidence record on a qa-engineer PASS/FAIL write carrying qa_review, is not persisted to the handoff, is attested not verified, and gates nothing | authored-here — mirrors the dispatch_mechanism_tier description style |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E359 and E361 (manifest).
- Parsing in `tools/evidence-file.ts` (lane e367).
- Any `content/**` change, including the qa SOP sentence for `qa_suite_result` (D1 A: the integrator files it at wave close).
- Any new `GATE_REGISTRY` entry or new reject condition. This covers: `passed < total` on PASS, making the field required, non-qa authorship, and any comparison against an actual suite run. All filed as `E161-NEW-1`.
- `dispatch_mechanism` in the read view. It is a three-value enum that the dispatch prompt dictates explicitly, so the copy-instead-of-self-report risk the ticket names is the tier's.
- The prompt and hook state-block render of the tier (`E184-NEW-1`).
- `tools/registry.ts` descriptions of `dispatch_mechanism_tier` and `tw_get_state`. These stay as they are: they describe the write and the record, which do not change.
- `code_review_reports` in SQLite mode (`recordCodeReview` is not part of E366).

## Dependencies / Prerequisites

- Base `f5485a7`. Mode `no-design` (no `design/e161-qa-claim-and-state-reads.md`). Visual Structural Assertions are omitted.
- Resource Audit: the backlog rows E161, E184 and E366, and the manifest, reference no external artifact (no URL, Figma, mockup or ticket system). `external_refs` is omitted.
- Architect hop: needed for E161 (manifest; the design decision goes through architect). The architect's Open Questions go to integrator pre-review like the cut (manifest 所有 lane 共通的範圍).
- Serial order for sr: T-E366-01 → T-E161-02 → T-E184-01. All three edit `tools/handoff-orchestrator.ts`. E161's record composition sits on top of E366's undo registration in the same step, so this is one serial sr lane, never parallel. Each sr task commits its own `dist/` outputs.
- `dispatch_mode` stays `feature`.
- **Option choices for the human** (each has PM's pick and the reason above; none is a needs-human-ruling item, but the human may override any of them at cut approval):
  - D-E161: structured field (A) vs prose parse (B). Architect confirms in T-E161-01.
  - D-E184: omit vs label.
  - D-E366: undo handle vs transaction.
- **STOP conditions carried into the chain**, with the coordinator mailing the integrator:
  - The architect or sr finds that E161 needs a `GATE_REGISTRY` entry or any `content/**` change.
  - The architect overturns D-E161 into a persisted handoff field, which needs a schema bump. The file set then changes: re-cut.
  - A test outside the hit table below goes red.
- Source pins sr must keep intact (none should need edits):
  - `test/context-budget.test.mjs` AC8 (the `hasDesignModeRequiringVisual` import in `tools/handoff-orchestrator.ts`).
  - `test/e35-pipeline-order.test.mjs` (step names, codes, order).
  - `test/e236-rejected-write-evidence.test.mjs` (file-mode undo behaviour).
  - `test/ac-execution.test.mjs` / `test/gates-expected-red.test.mjs` I5b guard-to-call shape.
  - `test/visual-evidence-gate.test.mjs` AC-4.
  - `test/e38-next-role-lookahead.test.mjs`, `test/e32-e33-gate-hardening.test.mjs`, `test/e20-e21-crash-resilience.test.mjs`, `test/e28-shrink-warning.test.mjs`, `test/e296-manifest-tier.test.mjs` and `test/e308-single-source-tier-enum.test.mjs` (orchestrator source reads).
- **Existing tests checked against this change** (found by grepping for `dispatch_mechanism_tier`, `handleGetState`, `recordReview`, `reports` and `handoff-orchestrator.ts`):

  | test file | hit? | assertion that changes |
  |---|---|---|
  | `test/dispatch-mechanism.test.mjs` | **possible retitle only** | RT2 reads through `readHandoffState` (the library), which keeps the tier. Its assertions stay. qa may retitle the test name/messages that say "tw_get_state-equivalent" |
  | `test/dispatch-log.test.mjs` | not hit | sidecar unchanged |
  | `test/e236-rejected-write-evidence.test.mjs` | not hit (must stay unmodified) | file-mode undo unchanged |
  | `test/sqlite-versioning.test.mjs` | not hit | no sqlite schema change |
  | `test/qa-flow.test.mjs` | not hit | recordReview format unchanged when the field is absent |
  | `test/qa-review-scoped-append.test.mjs` | not hit | SQ3 rejects before the record; accepted-write row counts unchanged |
  | `test/dispatch-pins.test.mjs`, `test/cut-approval-gate.test.mjs`, `test/handoff-versioning.test.mjs`, `test/handoff-migration.test.mjs`, `test/success-metrics.test.mjs`, `test/stale-dispatch-detection.test.mjs`, `test/repro-first-gate.test.mjs`, `test/lane-migrate.test.mjs` | not hit | they read the tier through parse/migration payloads, not `handleGetState` |
  | `test/e303-zod-boundary-telemetry.test.mjs`, `test/e324-zod-telemetry-under-current.test.mjs` | not hit | the new zod field uses the existing boundary path |
  | `test/error-code-contract.test.mjs`, `test/e35-pipeline-order.test.mjs` | not hit (must stay unmodified) | no code or step change |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E161-01 | architect (E161 design decision, first task): write `specs/e161-qa-claim-and-state-reads-architecture.md`. Confirm or overturn D-E161 with a reason, and answer the four architect checks. Blueprint D-E184 (envelope transform beside `withDispatchPinsAdvisory`) and D-E366 (optional `HandoffStorage` method, SQLite undo by primary key, no import of `storage-sqlite` from the orchestrator). Open Questions go to integrator pre-review. An overturn that changes the file set goes back to PM for a re-cut. **Option choice: D-E161 A vs B** | none | 1 | `specs/e161-qa-claim-and-state-reads-architecture.md` | — |
| T-E366-01 | sr (E366): add the undoable record to `SqliteHandoffStorage`: same inserts as `recordReview`, returning an undo that deletes exactly its own rows in one transaction and never throws. Declare it as an optional method on `HandoffStorage`. `QA_REVIEW_RECORD` uses it when the storage provides it and registers the undo in `evidenceUndoByCtx`. File mode and storages without the method are unchanged. Step name, `codes` and order are unchanged. Rebuild `dist/`. ~60 lines. **Option choice: D-E366 undo vs transaction** | T-E161-01 | 3 (+dist) | `tools/storage.ts`、`tools/storage-sqlite.ts`、`tools/handoff-orchestrator.ts`、`dist/tools/storage.*`、`dist/tools/storage-sqlite.*`、`dist/tools/handoff-orchestrator.*` | — |
| T-E161-02 | sr (E161): add `qa_suite_result` to the `tw_update_state` zod args and the JSON `inputSchema` (shape and description per spec and architecture). In `QA_REVIEW_RECORD`, when the step records and the field is present, prepend the server line (Copy/Strings) and a blank line to the notes passed to both the file and the SQLite record call. Nothing else reads or persists the field. No schema bump, no gate. Rebuild `dist/`. ~50 lines | T-E366-01 | 2 (+dist) | `tools/registry.ts`、`tools/handoff-orchestrator.ts`、`dist/tools/registry.*`、`dist/tools/handoff-orchestrator.*` | — |
| T-E184-01 | sr (E184): `handleGetState` drops the top-level `dispatch_mechanism_tier` key from its JSON envelope. When the key is absent, or the payload is not a JSON object, the text is returned byte-identical. This composes with `withDispatchPinsAdvisory`. The write path, parse and the sidecar are unchanged. Rebuild `dist/`. ~20 lines. **Option choice: D-E184 omit vs label** | T-E161-02 | 1 (+dist) | `tools/handoff-orchestrator.ts`、`dist/tools/handoff-orchestrator.*` | — |
| T-E366-02 | qa (E366): new `test/e366-sqlite-rejected-write-evidence.test.mjs` (AC-E366-1..4). Verify AC-E366-5 with the named files unmodified | T-E366-01 | 1 | `test/e366-sqlite-rejected-write-evidence.test.mjs` | — |
| T-E161-03 | qa (E161): new `test/e161-qa-suite-result.test.mjs` (AC-E161-2..9). Verify AC-E161-1 | T-E161-02, T-E366-02 | 1 | `test/e161-qa-suite-result.test.mjs` | — |
| T-E184-02 | qa (E184): new `test/e184-get-state-omits-tier.test.mjs` (AC-E184-1..3). Verify AC-E184-4. Retitle RT2's name/messages in `test/dispatch-mechanism.test.mjs` only if they still claim to be a `tw_get_state` read (assertions unchanged) | T-E184-01 | 2 | `test/e184-get-state-omits-tier.test.mjs`、`test/dispatch-mechanism.test.mjs` | — |
| T-E161-04 | qa (lane close): run AC-L1..L4 on the final HEAD, after commit with a clean tree, with the full suite under `node scripts/test-lock.mjs -- npm test`. Any red outside the hit table is a STOP (mail the integrator), never a re-pin | T-E161-03, T-E184-02 | 0 | — | — |

## Findings filed

These are recorded in `.current/e161/pending-tickets.md`:

- `E161-NEW-1` — gate the structured suite result. Covers rejecting or requiring an explanation for a PASS with `passed < total`, requiring `qa_suite_result` on PASS once the qa SOP tells qa to fill it, and rejecting the field from non-qa writers. Needs `GATE_REGISTRY` entries (lane e152's file this wave). Pairs with the D1-A SOP ticket.
- `E184-NEW-1` — the role-prompt and SessionStart state block (`prompts/build.ts` `renderHandoffStateBlock`) still renders the previous hop's `dispatch_mechanism_tier`.
