# Review — T-E359-01, T-E359-02, T-E359-03

covers: T-E359-01, T-E359-02, T-E359-03

## Round 1 — APPROVED — by code-reviewer

Diff reviewed: `git diff e052902 632a749` (feat/e359-server-core-fixes) against `specs/e359-server-core-fixes.md`. No architecture spec exists for this feature (non-design lane, no architect hop).

## Summary
- T-E359-01 (E359): the void refusal text is now chosen by a new exported helper `voidRefusalMessage(taskId, rowCompleted, ledgerCompleted)` in `tools/tasks-file.ts`; `tools/storage-sqlite.ts` imports the same helper, so both storage modes return the same bytes. The refusal predicate is unchanged at both sites.
- T-E359-02 (E376): `renderHandoffStateBlock` in `prompts/build.ts` drops only the top-level `dispatch_mechanism_tier` (rest-destructure before `sanitizeForRender`); key order and `dispatch_mechanism` are kept.
- T-E359-03 (E172): `normalizeWorkspacePath` moved from `index.ts` to `prompts/build.ts` with an injectable `platform` (default `process.platform`); `~\` expands only on win32. `index.ts` imports it and re-exports the name; the `resolveWorkspacePath` call is unchanged.
- Scope: 4 owned sources plus their `dist/` files only (19 files). No `test/`, `content/`, goldens, `bin/`, `gates/`, `tools/handoff-*.ts` or `tools/sync.ts` change.
- Verdict: APPROVED. No required findings.

## AC Completeness
Spec tests (`test/e359-*`, `test/e376-*`, `test/e172-*`) belong to qa tasks T-E359-04..06 and are not in this diff. Each AC below is judged on whether the source change implements it, using the reviewer's own checks against the rebuilt `dist/`.
- AC-E359-1 — implemented — `tools/tasks-file.ts:470-476` (ledger-only branch) picked from `tools/tasks-file.ts:577`; the message equals `void.refused.ledger` byte for byte (reviewer script, `T-B` substituted). The refusal returns before any write, so nothing on disk changes.
- AC-E359-2 — implemented — `tools/tasks-file.ts:478-484`; byte-equal to `void.refused.both`.
- AC-E359-3 — implemented — `tools/tasks-file.ts:486`; byte-equal to `void.refused.row`, which is the base text unchanged.
- AC-E359-4 — implemented — `tools/storage-sqlite.ts:769` calls the same helper with `existing.completed === 1` and `ledgerCompleted`; one source of the literal, so file and SQLite text cannot drift.
- AC-E359-5 — implemented — the ledger-only message names a qa-engineer FAIL write through `tw_update_state` carrying `review_task_ids=[<id>]`, the step that clears the ledger. The end-to-end success proof is qa's T-E359-04.
- AC-E359-6 — implemented — predicate lines `tools/tasks-file.ts:576` and `tools/storage-sqlite.ts:766` unchanged; `rollbackTaskInFile`, `SqliteHandoffStorage.rollbackTask`, the `alreadyVoided` and not-found branches and `tools/sync.ts` are untouched (empty diff). `test/e117-void-task`, `e120-void-recut-refusal`, `e121-tasks-file-injection`, `tasks`, `e125a-lane-local-ledgers` pass unmodified (SQLite cases ran, 0 skipped).
- AC-E376-1 — implemented — `prompts/build.ts:163-164`; reviewer check: a state with `dispatch_mechanism: "task"` and `dispatch_mechanism_tier: "opus"` renders without the tier key, keeps `"dispatch_mechanism": "task"`, and the output equals the render of the same state with the key removed. Input object not mutated.
- AC-E376-2 — implemented — the hook loads the same `dist/prompts/build.js` renderer; `bin/` untouched. Spawned proof is qa's T-E359-05.
- AC-E376-3 — implemented — for a state with no tier key, rest-destructure yields the same keys in the same order, so output is unchanged; `test/e137-render-sanitise`, `e122-state-render-injection`, `prompt-state-footer` pass unmodified.
- AC-E376-4 — implemented — the change is render-only; no handoff parse/write file touched; `test/e184-get-state-omits-tier` passes unmodified.
- AC-E376-5 — implemented — after `npm run build`, `node scripts/capture-constitution-golden.mjs` exited 0 and `git status --porcelain` showed no change under `test/fixtures/compose-golden`.
- AC-E172-1 — implemented — `prompts/build.ts:142-152`; `normalizeWorkspacePath("~\\sub", "win32")` returns `path.resolve(path.join(os.homedir(), "sub"))`.
- AC-E172-2 — implemented — on `linux` and `darwin`, `"~\\sub"` returns `path.resolve("~\\sub")`.
- AC-E172-3 — implemented — on all three platforms `"~"`, `"~/sub"`, `"~user/x"` (not expanded) and an absolute path return the expected values.
- AC-E172-4 — implemented — `index.ts:78` calls `normalizeWorkspacePath(resolved)` with no platform argument; `index.ts:33` re-exports the name (`dist/index.d.ts` still exports it); `test/prompt-state-footer` AC2 spawned cases pass.
- AC-G1 — implemented — fresh `npm run build` left `dist/` clean; `git diff --stat main...632a749 -- dist/` lists only `dist/index.*`, `dist/prompts/build.*`, `dist/tools/tasks-file.*`, `dist/tools/storage-sqlite.*`.
- AC-G2 — implemented — the forbidden-path diff (`content test bin gates tools/handoff-*.ts tools/sync.ts`) over the reviewed range is empty.
- AC-G3 — not judged here — full suite on final HEAD is qa scope (the qa test tasks are still to land). Reviewer ran the 11 pinned suites: 252/252 pass, 0 skipped.

## Correctness
No findings.
- Branch logic in `voidRefusalMessage` (`tools/tasks-file.ts:464-487`): ledger and not row gives `.ledger`; ledger and row gives `.both`; row only gives `.row`. The fourth combination (neither) also returns `.row` but is unreachable, because both callers only call it inside `if (row || ledger)`.
- The win32 branch uses `p.slice(2)`, which is correct for both `~/` and `~\` (two-character prefixes); `~\` alone resolves to the home directory.
- No circular import: `tools/tasks-file.ts` does not import `tools/storage-sqlite.ts`.

## Quality
- optional — `tools/storage-sqlite.ts:25` now imports a message helper from the file-mode module `tools/tasks-file.ts`. The spec leaves helper-vs-duplicate to sr and this keeps a single literal, which is the stronger guarantee for byte-identity. A neutral home would read cleaner, but no such owned file exists in this lane. Not blocking.
- optional — `prompts/build.ts:163` binds `_omitTier` only to discard it; this is the usual rest-omit idiom and `tsc` accepts it.
- Comments: three new doc comments (`tools/tasks-file.ts:457-463`, `prompts/build.ts:134-141`, `prompts/build.ts:159-160`) state the why in plain terms, carry no paths or personal data, and `agc check` reported no comment warnings for the diff.

## Architecture
No architecture spec exists. The E172 move follows the spec's recorded PM decision (function lives in `prompts/build.ts`, which tests import in-process; `index.ts` imports and re-exports). The renderer stays the single shared renderer for role prompts and the SessionStart hook.

## Security
No findings. The new message interpolates `taskId`, the same value the old message already interpolated, inside a `JSON.stringify` payload. No new input crosses a trust boundary. The `~\` expansion is gated to win32, where `\` is a path separator, so POSIX paths with a literal backslash are not rewritten.

## Performance
No findings. One extra object rest-copy per state render and constant-time string selection on a refusal path; no loops or I/O added.

## Verdict
APPROVED — all source-side ACs are implemented with byte-exact strings, unchanged predicates and branches, a render that only drops the one key, and win32-only tilde handling; `dist/` and goldens rebuild clean.
