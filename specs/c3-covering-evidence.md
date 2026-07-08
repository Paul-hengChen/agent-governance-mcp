# Spec: c3-covering-evidence

## Problem Statement

`tools/evidence-file.ts` enforces two file-mode gates, both by strict
per-task-id file existence:

- `hasEvidenceInFile()` — QA PASS gate (`storage.hasEvidence`, consumed in
  `tools/handoff-orchestrator.ts` at the PASS path). Requires
  `qa_reports/review_<id>.md` to exist for EVERY id in `completed_tasks`.
- `hasCodeReviewEvidenceInFile()` — code-reviewer → qa-engineer handoff gate
  (`storage.hasCodeReviewEvidence`). Requires `review_reports/review_<id>.md`
  to exist for EVERY id in `completed_tasks`.

Both predicates are literal per-id filename checks
(`review_<safe(id)>.md` — see `evidencePath()` / `codeReviewPath()`); there is
no auto-record mechanism for code-reviewer evidence (`recordCodeReviewInFile`
is never invoked automatically anywhere in `tools/handoff-orchestrator.ts` —
confirmed by grep), so a code-reviewer covering a batched round of tasks
(observed live: T-REG-01..07, one real review + 6 one-line pointer stubs)
must manually create a same-content stub file per extra id purely to satisfy
`hasCodeReviewEvidenceInFile`'s existence check. This is bookkeeping noise
that buries the one real report a reader actually wants.

## Mechanism Decision

Backlog C3's Fix line names three possible id-declaration surfaces: a
`covers:` line, ids in the filename, or frontmatter. This spec picks **one**:
a `covers:` label line inside the file's content, parsed with the same
permissive label-line convention `tools/evidence-file.ts` already uses for
`baseline:` / `diff-metric:` / `pixel_gate_complete:` (optional leading
bullet/bold, `:`/`—`/`-` separator, case-insensitive label).

**Why not filename-embedded ids or frontmatter too**: both are real
alternatives but add a second parsing surface for the same outcome. The
`covers:` line alone fully satisfies the backlog's stated fix ("lets one file
satisfy N ids... keep per-id files valid") with the smallest diff, is
consistent with the file's existing label-line parser family, and needs no
change to the safe-filename sanitiser (`evidencePath`/`codeReviewPath`
untouched). Filename/frontmatter parsing is deferred to a follow-up if a real
need surfaces (Out of Scope).

**Where the covering file lives**: no new naming rule. The reviewer/QA writes
their one real report at its normal per-id path (e.g.
`review_reports/review_T-REG-01.md`) and adds a `covers: T-REG-01, T-REG-02,
..., T-REG-07` line inside it. The file already satisfies its own id via the
existing direct-existence check; the `covers:` line additionally satisfies
the other N-1 ids via a new fallback lookup. No filename convention changes,
no new directory, no new tool.

**Lookup mechanism**: a new `buildCoverageIndex(dir)` helper scans every
`*.md` file in the evidence directory (`qa_reports/` or `review_reports/`),
parses each for a `covers:` line, and builds a first-seen-wins
`id -> filename` map. `hasEvidenceInFile()` / `hasCodeReviewEvidenceInFile()`
call this lazily — **only** when a requested id's direct per-id file is
missing — so the common single-task-round path (every id has its own file)
never pays the extra directory scan.

**Why not touch `recordReviewInFile()` / `recordCodeReviewInFile()`**: those
functions are the auto-record-on-PASS path (QA only; code-reviewer has no
auto-record at all). They write real, timestamped `qa_review` content per id
— not stub litter — and the backlog's Fix line targets the **check**
(`evidence check accepts a covering report`), not the auto-record write path.
Leaving them unchanged keeps this MVP scoped to exactly the two `has*`
predicates, per the owner note ("evidence check in
`tools/handoff-orchestrator.ts` / `evidence-file.ts`").

**Storage-mode scope**: file-mode only (mirrors the `cut_approved` and
`driftBaselineIds` precedents). SQLite mode already records one `reports` row
per id directly in the database (`storage-sqlite.ts` `hasEvidence` /
`hasCodeReviewEvidence`, confirmed by reading the implementation) — there is
no stub-file problem to fix there, so it is untouched.

## User Stories

- As a code-reviewer who reviews a batch of 7 tasks in one round, I want to
  write ONE real review file with a `covers:` line instead of 6 pointer
  stubs, so the `review_reports/` directory holds signal, not litter.
- As a qa-engineer who manually authors a batch review ahead of PASS, I want
  the same `covers:` convention available for `qa_reports/`, so I'm not
  forced into the same stub pattern QA otherwise inherited from code-review.
- As a future reader of `review_reports/` or `qa_reports/`, I want to open a
  file and find a real report, not a one-line pointer to another file.
- As a maintainer of a single-task feature, I want per-id files to keep
  working exactly as before — no new authoring burden when there's nothing to
  batch.

## Acceptance Criteria

**AC-1 — Covering report satisfies N ids (code-reviewer path)**
Given `review_reports/review_T-REG-01.md` exists and contains a line
`covers: T-REG-01, T-REG-02, T-REG-03, T-REG-04, T-REG-05, T-REG-06, T-REG-07`,
and no other `review_reports/review_T-REG-0{2..7}.md` files exist,
When the code-reviewer → qa-engineer handoff evidence gate
(`hasCodeReviewEvidence`) runs for `completed_tasks = [T-REG-01..T-REG-07]`,
Then all 7 ids report present; no `MISSING_REVIEW_EVIDENCE` error.

**AC-2 — Covering report satisfies N ids (QA path)**
Symmetric to AC-1 for `qa_reports/` + `hasEvidence` (the PASS gate).

**AC-3 — Partial coverage reports the correct missing subset**
Given a `covers:` line lists only some of the requested ids (and no other
covering or per-id file exists for the rest),
When the gate runs,
Then ids covered (directly filed OR named in `covers:`) report present; the
remaining ids report missing, and the `MISSING_EVIDENCE` /
`MISSING_REVIEW_EVIDENCE` message lists exactly that missing subset (same
message format as today).

**AC-4 — Backward compatible: existing per-id files unaffected**
Given a directory containing only classic per-id files, none with a
`covers:` line anywhere (the pre-C3 convention),
When the gate runs,
Then behavior is identical to pre-C3: each id reports present iff its own
per-id file exists. No false positives from the new lookup path.

**AC-5 — Malformed/empty/non-matching `covers:` line does not falsely satisfy**
Given a file has a `covers:` label present but empty, or listing ids that do
not include the requested id,
When the gate runs,
Then the requested id is NOT marked present via that file (falls back to its
own per-id existence check).

**AC-6 — Lazy evaluation: no directory scan when every id has its own file**
Given every requested id's own per-id file is present,
When the gate runs,
Then `buildCoverageIndex()` is never invoked for that call (verified by the
qa-engineer via a code-path assertion or spy — exact test technique is a QA
implementation choice, not a server-visible behavior change).

**AC-7 — File-mode only; SQLite mode unchanged**
`tools/storage-sqlite.ts`'s `hasEvidence` / `hasCodeReviewEvidence`
implementations are not modified; SQLite-mode gate behavior is unchanged (no
stub-file problem exists there today).

**AC-8 — No schema bump; no new error code**
The fix adds no new error code — `MISSING_EVIDENCE` / `MISSING_REVIEW_EVIDENCE`
messages are unchanged in format, just computed over a superset of
"present" ids. No `schema_version` bump to handoff/tasks/sqlite/config.

**AC-9 — Skill docs document the convention**
`content/skill-code-reviewer.md` and `content/skill-qa-engineer.md` each
document the `covers:` line (syntax + one minimal example) and explicitly
state per-id files remain the default/valid choice for single-task rounds —
`covers:` is additive, not a replacement.

## Copy / Strings

| string id | exact text | source |
|-----------|-----------|--------|
| S01 | `covers: <id>, <id>, ...` (label line inside a `review_<id>.md` file; separator may be `:`, `—`, or `-`; optional leading `-`/`*` bullet and `**bold**` wrapper, mirroring the existing `baseline:`/`diff-metric:` label-line convention) | `tools/evidence-file.ts` new `COVERS_LINE_RE` |
| S02 | Error message format unchanged: `⛔ MISSING_EVIDENCE: <ids>. ...` / `⛔ MISSING_REVIEW_EVIDENCE: <ids>. ...` | `tools/handoff-orchestrator.ts` (existing, untouched) |

## Visual Tokens

| token id | property | value | source |
|----------|----------|-------|--------|
| N/A | — | feature has no visual surface | — |

## Visual Widgets

| widget id | description | source-node |
|-----------|-------------|-------------|
| N/A | — | feature has no non-primitive widgets | — |

## Out of Scope

- Filename-embedded id lists (e.g. `review_T-REG-01_T-REG-07.md`) — deferred;
  the `covers:` line alone satisfies the backlog's fix (Mechanism Decision).
- YAML frontmatter parsing — deferred for the same reason.
- Any change to `recordReviewInFile()` / `recordCodeReviewInFile()` auto-write
  behavior (real content, not stub litter — out of scope per Mechanism
  Decision).
- SQLite/HTTP-mode evidence-check changes (no stub-file problem exists there;
  AC-7 documents no-op).
- Any new `tw_*` MCP tool surface.
- Any `schema_version` bump to handoff/tasks/sqlite/config (AC-8).
- Touching any other gate in `tools/evidence-file.ts` (visual gates, scope
  decision, cut approval) — this feature touches exactly
  `hasEvidenceInFile()` and `hasCodeReviewEvidenceInFile()`.

## Dependencies / Prerequisites

- No external references (no URLs/Figma/tickets) in this ticket — Resource
  Audit Gate is a no-op.
- No dependency on other open backlog items.

## Tasks

- [ ] C3-01 [P0] sr-engineer: add `parseCoversIds()` pure parser + `COVERS_LINE_RE` to `tools/evidence-file.ts`, mirroring the existing `baseline:`/`diff-metric:` label-line regex style (optional bullet/bold, `:`/`—`/`-` separator, case-insensitive). Splits the captured value on comma/whitespace, trims each token, strips surrounding backticks/brackets, drops empties, returns `string[]` (empty array when the label is absent or its value is empty) (AC-5). | depends_on: none
- [ ] C3-02 [P0] sr-engineer: add `buildCoverageIndex(dir: string): Map<string,string>` to `tools/evidence-file.ts` — lists `*.md` files in `dir`, reads each (skip unreadable files, never throw), runs `parseCoversIds()` over the content, and returns a first-seen-wins `coveredId -> filename` map. Pure w.r.t. fs errors. | depends_on: C3-01
- [ ] C3-03 [P0] sr-engineer: wire the coverage-index fallback into `hasEvidenceInFile()` — for each requested id whose direct `qa_reports/review_<id>.md` is absent, lazily build (once per call, only on first miss) the coverage index over `qa_reports/` and check membership before marking the id missing; ids with their own file present skip the lookup entirely (AC-1, AC-3, AC-4, AC-6). | depends_on: C3-02
- [ ] C3-04 [P0] sr-engineer: wire the identical coverage-index fallback into `hasCodeReviewEvidenceInFile()` for `review_reports/`, mirroring C3-03 exactly (AC-2, AC-3, AC-4, AC-6). | depends_on: C3-02
- [ ] C3-05 [P1] sr-engineer: update `content/skill-code-reviewer.md` step 4 — replace the "One file per task id reviewed" line with covering-report guidance: a single `review_reports/review_<primary-id>.md` may declare `covers: <id1>, <id2>, ...` to satisfy the `MISSING_REVIEW_EVIDENCE` gate for a batched round; per-id files remain the default/valid choice for single-task rounds. Include one minimal example (AC-9). | depends_on: C3-03, C3-04
- [ ] C3-06 [P1] sr-engineer: update `content/skill-qa-engineer.md` (Phase 1 write-target line + PASS step) to document the same `covers:` convention for `qa_reports/review_<id>.md`, and note that the auto-record-on-PASS path (`recordReview`) is unchanged — it still writes `qa_review` content per id; `covers:` applies to manually-authored batch review files written ahead of PASS (AC-9). | depends_on: C3-03, C3-04
- [ ] C3-07 [P1] [qa-engineer] write `test/covering-evidence.test.mjs` covering AC-1 through AC-6: `parseCoversIds` unit tests (comma list, whitespace list, bracket/backtick-wrapped ids, malformed/empty → `[]`); `hasEvidenceInFile` — single covering file satisfies N ids, partial coverage reports the correct missing subset, absent `covers:` line unaffected (byte-for-byte backward-compat); mirrored tests for `hasCodeReviewEvidenceInFile`; lazy-evaluation check (AC-6). Run `npm test` — full suite green. | depends_on: C3-05, C3-06
- [ ] C3-08 [P1] sr-engineer: bump `package.json` + `index.ts` `Server()` literal version; add `CHANGELOG.md` entry describing the covering-evidence mechanism; run `npm run build && node scripts/check-version.mjs`. | depends_on: C3-07
- [ ] C3-09 [P2] pm/coordinator (post-PASS): mark backlog ticket C3 done in `docs/backlog.md` with mechanism summary and commit reference, matching the C1/C2/C4 "Done" convention. | depends_on: C3-08
