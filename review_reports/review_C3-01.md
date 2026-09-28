# Code Review — c3-covering-evidence

covers: C3-01, C3-02, C3-03, C3-04, C3-05, C3-06

## Round 1 — APPROVED — by code-reviewer

## Summary

- Adds `COVERS_LINE_RE` + `parseCoversIds()` (pure label-line parser) and `buildCoverageIndex(dir)` (lazy, first-seen-wins id→filename map, never throws) to `tools/evidence-file.ts`, plus a `covers:` fallback wired into `hasEvidenceInFile()` and `hasCodeReviewEvidenceInFile()` only on a direct per-id miss.
- Scope is exactly the two `has*InFile` predicates + two skill docs. No SQLite change, no `schema_version` bump, no new error code, no new tool surface — matches the spec's Out-of-Scope fence.
- Headline verdict: APPROVED. All nine acceptance criteria verified (AC-1/3/4/5 by end-to-end run in a temp workspace; AC-6 by inspection; AC-7/8 by scope diff; AC-9 by doc read). `npm run build` clean, `npm test` 868/868.

## Correctness

- `tools/evidence-file.ts:29` — `COVERS_LINE_RE` correctly anchors the label to line start (only optional whitespace/bullet/bold may precede `covers`), so mid-sentence prose ("This covers: …"), `discovers:`, `recovers:`, `coversheet:` all fail to match. Verified empirically — all returned `[]`.
- `tools/evidence-file.ts:35-43` — `parseCoversIds()` correctly yields `[]` for bare `covers:`, whitespace-only, and commas-only values (AC-5): the capture group requires ≥1 char and the `split(/[,\s]+/)` + non-empty `filter` discards any residual whitespace token. Bracket/backtick/emphasis stripping works. First `covers:` line wins (documented + verified).
- `tools/evidence-file.ts:100-122` / `156-178` — lazy fallback is correct: direct-hit path is byte-identical to pre-C3 (present + continue); index is built at most once per call and only after the first direct miss (`coverage === null` guard). End-to-end run confirmed AC-1 (all N present), AC-3 (correct missing subset), AC-4 (classic per-id file unaffected, no false positive), AC-5 (id not named → missing). qa_reports/ and review_reports/ dirs are correctly isolated.
- `tools/evidence-file.ts:51-72` — `buildCoverageIndex()` never throws: unreadable dir → empty map (early return in catch), unreadable file → `continue`. First-seen-wins is deterministic via `[...entries].sort()`.

## Quality

- Naming, comments, and label-line regex shape faithfully mirror the established `BASELINE_LINE_RE` / `DIFF_METRIC_LINE_RE` / `PIXEL_GATE_COMPLETE_LINE_RE` family already in this file — the near-duplicate regex is consistent with the file's existing convention (3 prior near-identical regexes), not new drift; factoring a shared builder would exceed MVP scope. No dead code, no leftover debug.
- `[...entries].sort()` copies before sorting — harmless (readdir result is already a fresh array, but the copy is defensive and cheap on a small dir).

## Architecture

- Fits the "existence is sufficient; server does not parse content for meaning" convention only in the direct path; the `covers:` fallback is a deliberate, spec-sanctioned superset extension computed over the same directory. No architecture spec present for this feature; the Mechanism Decision in `specs/c3-covering-evidence.md` is honored exactly (single `covers:` surface, no filename/frontmatter parsing, `record*` write paths untouched, SQLite untouched).
- Lazy placement respects AC-6: the common single-task path pays no directory scan.

## Security

- No path traversal: the map's filename *values* are never used to construct a read path — they exist only for debuggability; membership is tested with `coverage.has(id)` where `id` is a caller-supplied task id, never a filesystem path. The pre-existing `evidencePath`/`codeReviewPath` sanitiser (`[^A-Za-z0-9._-] → _`) is untouched and still governs the only place a task id becomes a path.
- No injection vector: `parseCoversIds` is pure string processing; regex is line-bounded (`[^\n]`), no catastrophic-backtracking risk beyond the already-shipped sibling regexes.
- fs boundaries are wrapped in try/catch and degrade to empty/skip.

## Performance

- No regression vs base on the direct-hit path (identical). On a miss, one `readdirSync` + one `readFileSync` per `*.md` file, memoized once per call — linear in directory size, incurred only when a covering lookup is actually needed. Acceptable for the infrequent PASS/handoff gate path; no hot-loop or unbatched-I/O concern.

## Verdict

APPROVED — correct, minimally scoped, backward-compatible, and all nine acceptance criteria verified independently; ready for qa-engineer.
