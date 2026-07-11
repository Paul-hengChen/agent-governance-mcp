# Review — T-D9-01

covers: T-D9-01, T-D9-02, T-D9-03, T-D9-04

## Summary
- Scoped qa_review auto-append target resolution: `review_task_ids ?? completed_tasks`, workspace-wide "every incomplete task" fallback DELETED, both-empty → loud `QA_REVIEW_TARGET_REQUIRED` reject before any `recordReview` (4 source files +66/-11, plus rebuilt dist).
- Verified against spec `specs/d9-qa-review-scoped-append.md` AC1–AC5 — all satisfied; no architecture spec present for this feature.
- The fan-out bug is genuinely dead: the sole `storage.recordReview` call site (`handoff-orchestrator.ts:364`) now keys only on incoming parsed args; `storage.listTasks` no longer appears anywhere in the orchestrator; both backends (`recordReviewInFile`, SQLite `recordReview`) faithfully record exactly the ids passed — no path resolves qa_review targets from open/incomplete task lists.
- `review_task_ids` is truly transient — the `storage.writeState({...})` call enumerates persisted fields explicitly and does not include it; never written to handoff YAML.
- Verdict: APPROVED.

## Correctness
No findings.
- **Fan-out dead (AC1)** — `tools/handoff-orchestrator.ts:348-366`: `const ids = parsed.review_task_ids?.length ? parsed.review_task_ids : parsed.completed_tasks`; the old `ids.length===0 → storage.listTasks(...).filter(!completed)` branch is removed. Confirmed no residual resolution path in either storage mode: `grep listTasks tools/handoff-orchestrator.ts` is empty; the only `recordReview` caller is line 364.
- **PASS back-compat (AC2)** — with `review_task_ids` omitted (undefined) the ternary guard `parsed.review_task_ids && parsed.review_task_ids.length > 0` is falsy, so `ids = parsed.completed_tasks`. A normal PASS with populated `completed_tasks` records for exactly those ids — byte-identical to prior behavior (prior PASS never hit the deleted fallback since `completed_tasks` was non-empty). No crash risk on undefined: `completed_tasks` carries the zod default `[]`.
- **Reject scoping (AC3 / focus 3)** — the reject lives inside the outer guard `parsed.qa_review && agent_id==="qa-engineer" && status ∈ {PASS,FAIL}` (L343-347). A §3 escalation FAIL that carries no `qa_review` skips the entire block and is never blocked. The early `return { isError:true }` fires before `recordReview` and before `writeState`, so on both-empty nothing is recorded anywhere and the write fails loud — matches AC3 ("rejected … no review text recorded … not silent no-op").
- **Transient field (AC / focus 4)** — `handoff-orchestrator.ts:688-721` `writeState` passes named fields only; `review_task_ids` is absent, so it is never persisted or carried across writes, exactly like `next_role`/`resume_of`/`review_verdict`.
- **Test evidence** — `npm test` → 1162/1166; the 4 reds are the expected T-D9-05 QA re-baselines only: #284 & #303 (registry count/mapping 23→24), #304 (FREE_TEXT_ALLOWLIST rows for the new code), #716 (skill-qa-engineer byte budget). No product reds; no test files modified in the diff (`git diff HEAD --stat -- test/` empty — sr's claim of a pre-session edit to test/covering-evidence.test.mjs is indeed spurious/empty).

## Quality
No findings. `review_task_ids` mirrors the `completed_tasks` shape and the c9-protocol-fields transient convention; comments accurately describe intent and cite the D8 incident and AC numbers. Gate registry doc-order comment and count references updated 23→24 consistently.

## Architecture
No findings. Fix is confined to the write-side id-resolution as the spec's root-cause analysis and D9 scope note require; read-side paths (`hasEvidence`/`hasEvidenceInFile`, `buildCoverageIndex`/`parseCoversIds`) are untouched (AC5). Storage-agnostic by design — resolution keys on parsed args, so file and SQLite modes behave identically.

## Security
No findings. No new trust boundary; `review_task_ids` is zod-bounded (`z.array(z.string().max(500)).max(200).optional()`), same limits as `completed_tasks`. No secrets, no injection surface.

## Performance
No findings. Net improvement: the deleted branch removed a `storage.listTasks` + filter/map over the whole task list on every FAIL write; resolution is now O(1) arg selection. No new hot-path work.

## Verdict
APPROVED — implementation matches AC1–AC5 with zero findings; gate `hintStatic` is byte-exact to the spec Copy/Strings row, dist rebuild is in sync with source (fresh `npm run build` introduced no further diff), and the only test reds are the known QA-owned re-baselines scoped to T-D9-05.
