# e235a-relative-prd-path

## Problem Statement
The server persists a workspace's `prd_path` (and, historically, a handful of
free-text `external_refs.ref` values) as absolute local filesystem paths
inside `.current/<lane>/handoff.md`, which lanes commit on their branch. An
absolute path under a user's home directory exposes that user's OS account
name in tracked git history — the "absolute local path/username" class the
Information hygiene rule (Constitution §6) bans from any durable output. The
same class already leaked into 19 existing tracked handoff/history files and
one prose file, plus (per a follow-on human ruling, E240) an adopter
project's own directory name in a handoff-orchestrator comment and two
history task ledgers. Because a tool's own input schema requires the value
verbatim (an absolute path), the fix belongs in the server's storage layer —
store the field relative to `workspace_path`, resolve it back to absolute
only in memory at read time — not in role behaviour, and not by loosening
the input contract.

## User Stories
- As a lane or workspace contributor, I want a newly-written `prd_path` to be
  stored relative to `workspace_path`, so that committing `.current/<lane>/handoff.md` never
  embeds my local username in tracked history.
- As a maintainer preparing this repository for public visibility, I want
  every existing tracked handoff/history file's local-path and adopter-name
  leaks scrubbed, so that a keyword re-scan of the owned scope returns zero
  hits.
- As a caller of `tw_get_state` / the RAG lazy-reindex hook / `tw_index_prd`,
  I want a relative-form `prd_path` transparently resolved back to an
  absolute, in-bounds path, so that existing consumers keep working with no
  behavior change from their perspective.

## Acceptance Criteria

- **AC1** — Given `tw_update_state` (file mode) persists a `prd_path` (a
  newly-supplied value, or one carried forward from the existing on-disk
  state), when the handoff is written to `.current/<lane>/handoff.md`, then
  the frontmatter's `prd_path` value is stored **relative to
  `workspace_path`**, not the raw absolute string the caller supplied. (Every
  valid `prd_path` input is already guaranteed to resolve inside
  `workspace_path` by the existing zod traversal refine, so this relativize
  step is always well-defined for new writes.)
  proof: `node --test test/e235a-relative-prd-path.test.mjs -t "write stores relative prd_path"`

- **AC2** — Given a `handoff.md` frontmatter whose `prd_path` is a relative
  value (AC1's output), when it is read (`parseHandoff` / `readHandoffState`,
  and the SQLite-mode equivalent if AC7 extends this to sqlite), then the
  returned state's `prd_path` is resolved back to the original absolute path
  (`workspace_path` + the stored relative value), so `tw_get_state`, the RAG
  lazy-reindex hook (`prompts/build.ts`), and `tools/rag.ts` keep receiving
  an absolute path exactly as they do today — no consumer-side changes
  required.
  proof: `node --test test/e235a-relative-prd-path.test.mjs -t "read resolves relative prd_path to absolute"`

- **AC3** — Given an existing (pre-e235a) `handoff.md` whose `prd_path`
  frontmatter value is already absolute (the legacy format), when it is
  read, then it parses unchanged and returns that same absolute path
  verbatim — no forced rewrite, no corruption. Absolute-vs-relative is
  self-describing (`path.isAbsolute`); no version-gated branch is required
  for this backward-compat path.
  proof: `node --test test/handoff-migration.test.mjs` plus a legacy-absolute fixture case in `test/e235a-relative-prd-path.test.mjs`

- **AC4** — Given a stored `prd_path` (relative or absolute) that would
  resolve **outside** `workspace_path` once combined with it (e.g. a
  hand-edited or corrupted `../../outside.md`), when that value is read and
  resolved, then the resolved path is never returned or used as a valid
  `prd_path` — the same "must resolve inside `workspace_path`" bound
  `IndexPrdArgs` already enforces at the `tw_index_prd` MCP boundary is
  re-applied to the **resolved** value at this new read-time resolution
  step, so relative storage does not introduce a path-traversal regression
  that didn't exist when `prd_path` was absolute-only. The bound must not be
  loosened in either direction (an in-bounds value — relative or legacy
  absolute — still resolves and is usable; an out-of-bounds one is still
  rejected/treated as absent). Where the check lives (read-time resolution
  in `tools/handoff-parse.ts` / a shared helper, and/or `tools/registry.ts`)
  and the exact failure shape (reject the read vs.
  drop the field to absent) is an architecture decision, recorded in
  `specs/e235a-relative-prd-path-architecture.md`.
  proof: `node --test test/e235a-relative-prd-path.test.mjs -t "resolved-path traversal guard"`

- **AC5** — The `tw_update_state` / `tw_index_prd` **input contracts are
  unchanged**: callers continue to supply an absolute `prd_path` (existing
  zod `absoluteWorkspacePath`-style refine stays as-is); only the **on-disk
  persisted representation** changes. This is explicit to prevent scope
  creep into a client-facing contract change.
  proof: existing `test/handoff-write-arg-guard.test.mjs` continues to pass unmodified in behavior (still rejects a relative or out-of-workspace `prd_path` argument at the tool boundary).

- **AC6** — The architecture blueprint records, as a Decision Record, whether
  this storage-representation change requires a `handoff` (and `sqlite`)
  `schema_version` bump. Either branch updates `docs/schema-versions.md`:
  if bumped, `schema/versions.ts` `CURRENT_VERSIONS.handoff` increments with
  a migration entry and a version-history table row (the v9/v13 stamp-only
  template, since no existing on-disk value needs rewriting — AC3's
  self-describing discrimination handles backward compat without a
  migration step); if not bumped, a documented note explains why the
  self-describing absolute-vs-relative format made a version gate
  unnecessary. `sqlite` is addressed the same way — `tools/storage-sqlite.ts`
  is owned scope, but since the SQLite backing file is never git-committed,
  the architect may determine no behavior change (and no bump) is needed
  there; that determination must also be recorded.
  proof: `git diff docs/schema-versions.md` shows a new row or note referencing e235a's `prd_path` change.

- **AC7** — One-time rewrite: the 19 existing tracked handoff/history files
  carrying the local-path leak are rewritten, touching **only** the leaking
  field or prose line in each (the E232 single-field discipline) —
  `.current/_primary/handoff.md`'s `prd_path:` line; the 18
  `.current/history/2026-09/*/handoff.md` files' `prd_path:` lines; e178b's
  two `external_refs` `ref:` values; and
  `.current/history/2026-09/e125c/compaction-procedure.md`'s prose line. Per
  the human ruling relayed via the integrator mailbox
  (`_mailbox/e235a/to-lane.md#1`): rewrite directly, no in-file annotation of
  what changed (the integrator records that in E235's done-mark). Rewritten
  value form: each `prd_path:` becomes exactly AC1's relative form — the path
  relative to the workspace that handoff belongs to (e.g. `docs/backlog.md`,
  `specs/<feature>.md`); never a placeholder, never a deleted field, so the new
  parser reads history files the same way it reads new writes (AC2/AC3 hold
  for them). e178b's two `external_refs` `ref:` values are role-authored
  descriptions, not resolved paths: they become class descriptions
  (`<lanes-root>/…` prefix in place of the absolute lanes-root directory),
  `state` untouched. After the rewrite, a re-scan of this scope for the
  local-path leak class returns zero hits, and every one of the 19 files
  still parses, with `prd_path` resolving inside its workspace (T-E235A-08).
  proof: `grep -rn "/Users/" .current/_primary/handoff.md .current/history/2026-09/*/handoff.md .current/history/2026-09/e125c/compaction-procedure.md` returns no matches (a generic OS-home-dir prefix pattern, not the leaked value itself — qa additionally re-runs the integrator's own keyword grep out-of-band).

- **AC8** — E240 adopter-project-name cleanup (human ruling E240=A, relayed
  via `_mailbox/e235a/to-lane.md#1`): the adopter project's full name
  (hyphenated/spaced form) and short form (prefix + protocol name), and any
  `~/.claude_<personal-name>`-style personal config-dir name, are removed
  from `tools/handoff-orchestrator.ts` (comment-only edit) and its matching
  `dist/tools/handoff-orchestrator.*` build output, and from
  `.current/history/2026-09/e180/tasks.md` and
  `.current/history/2026-09/e213/tasks.md` (prose-only — no checkbox, task
  id, heading, or `covers:` line touched), replaced with a class-neutral
  description (e.g. "adopter acceptance project"). The literal string is
  never written into any tracked file, including this spec or any task/qa
  note. A case-insensitive re-scan of these four files for both forms
  returns zero hits.
  proof: qa re-runs the integrator-supplied case-insensitive keyword grep (keywords held out-of-band, per Information hygiene — never reproduced in a tracked file) against the four owned files and records zero-hit confirmation in `qa_reports/review_<id>.md`.

- **AC9** — Final owned-scope re-scan (AC7 + AC8 combined) returns zero hits,
  and `dist/**` mirrors for every edited `tools/*.ts` file are rebuilt
  (`npm run build`) and confirmed clean.
  proof: `npm run build && grep -rn "/Users/" dist/tools/handoff-orchestrator.js` (and the qa keyword re-scan from AC8) both return no matches.

- **AC10** — No regression: the full test suite passes, including every
  owned pre-existing test file (`test/cut-approval-gate.test.mjs`,
  `test/handoff-migration.test.mjs`, `test/handoff-versioning.test.mjs`,
  `test/handoff-write-arg-guard.test.mjs`, `test/prompt-state-footer.test.mjs`,
  `test/rag-lifecycle.test.mjs`, `test/rag.test.mjs`,
  `test/visual-gate-e2e.test.mjs`, `test/visual-round-sqlite.test.mjs`,
  `test/writestate-options-object.test.mjs`, `test/schema-versions.test.mjs`),
  and the shared-generated-artifact suite is untouched since no `content/**`
  file changes in this lane.
  proof: `npm test` — 0 failures; `git diff --stat -- content/ test/fixtures/compose-golden/ test/context-budget.test.mjs` is empty.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature is a storage-layer/protocol change; introduces no new user-facing copy |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Changing the `tw_update_state` / `tw_index_prd` **input** contracts to
  accept a relative `prd_path` directly — callers keep supplying an absolute
  path (AC5); only the persisted representation changes.
- The fan-out manifest's worktree column, `docs/lane-protocol.md`, or any
  other SOP prose — that surface is lane e235b.
- Any edit to `content/**` (composed prompt output) — if the schema/version
  decision (AC6) is found to require touching role SOP prose, STOP and
  report to the integrator rather than widen scope.
- This lane's own handoff (`.current/e235a/handoff.md`): during the lane the
  running server is primary's pre-e235a build, so any `prd_path` it writes is
  still absolute. The integrator fixes that one line in the close-out commit
  after `finish --shipped`; the AC7/AC9 re-scans exclude this file. (The lane
  avoids setting `prd_path` at all.)
- Git history rewrite/reset for already-committed leaked values — the human
  handles this once, post-merge, outside lane scope
  (`_mailbox/e235a/to-lane.md#1`).
- Re-scanning or touching e235b's owned files (fan-out manifests, lane
  tooling, `content/**`, the 5 E232-leftover evidence files).
- Widening the leak-class taxonomy beyond what E232/E240 already ruled on —
  any newly-discovered class during this work goes to
  `.current/e235a/pending-tickets.md`, not into this cut.

## Dependencies / Prerequisites
- **Architect hop required** (routed via `next_role: "architect"`) — this
  change touches cross-module field semantics (`tools/registry.ts`,
  `tools/handoff-write.ts`, `tools/handoff-parse.ts`,
  `tools/handoff-orchestrator.ts`, `tools/storage-sqlite.ts`, `tools/rag.ts`,
  `prompts/build.ts`) and a `schema_version` bump decision (AC6) — exactly
  the threshold the PM SOP routes to architect rather than sr-engineer
  directly.
- **No design file** — `design/e235a-relative-prd-path.md` does not exist;
  Visual Structural Assertions section is correctly omitted (mode =
  no-design).
- **Resource Audit Gate**: zero external references found in the assignment
  (`docs/lane-protocol.md`, `specs/fanout-e235.md`, `docs/backlog.md`'s E235
  row, `content/const-15-core-tail.md` §6 are all in-repo tracked docs, not
  external artifacts) — `external_refs` omitted from the routing write.
- **No remaining open human decisions specific to this lane.** E240 (adopter
  names sensitive), the "rewrite directly, no in-file annotation" posture,
  and the "evidence files: prose-only" posture were all resolved by the
  human via the integrator mailbox (`_mailbox/e235a/to-lane.md#1`,
  2026-09-28) before this cut was drafted. The schema-version-bump call
  (AC6) is an architect engineering decision, not a human decision.
  git-history reset is explicitly out of lane scope (same mailbox message).
- **Test-file ownership (§2)**: only qa-engineer edits `test/**`, including
  the new `test/e235a-*.test.mjs` files this spec's ACs reference — sr-engineer
  implements AC1–AC9; qa-engineer authors/extends the test coverage and runs
  the final re-scans (AC7–AC10).
- **Dispatch pin**: `sr-engineer=fable` (human long-standing preference, per
  `specs/fanout-e235.md` Dispatch pins).
- **Merge ordering**: e235a merges in parallel with e235b (files are
  disjoint); each lane's own `PASS` triggers its own merge — see
  `specs/fanout-e235.md` "合併順序".
