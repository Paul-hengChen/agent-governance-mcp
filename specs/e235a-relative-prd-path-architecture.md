# e235a-relative-prd-path — architecture

Blueprint for `specs/e235a-relative-prd-path.md` (AC1–AC10), tasks
T-E235A-01..08. Everything below is described by class. No local absolute
path, OS username, or adopter project name appears in this file.

**Scope verdict:** this architecture **does not change the approved cut's
scope or ACs.** It narrows *where* code changes land (fewer files than the
spec's "may touch" list: `prompts/build.ts`, `tools/rag.ts` and
`tools/storage-sqlite.ts` need **no code change**, and
`tools/handoff-orchestrator.ts` gets only T-E235A-06's comment edit). It also
settles the three decisions the spec delegated here: AC4 guard placement and
failure shape, AC6 no-bump, and the T-E235A-05 rewrite form. One consequence
for qa is written down so AC10 is not misread (see DR-5 / OQ-1): a few
**owned** test fixtures use made-up absolute `prd_path` values that sit
outside their temp workspace, and qa must point them inside it.

## Affected Files

| file | change | task |
|---|---|---|
| `tools/handoff-parse.ts` | **modify.** Add three exported pure helpers (see Interface Contracts). In `readAndMigrate`, replace `const prdPath = asString(frontmatter.prd_path) \|\| undefined` with `resolveStoredPrdPath(workspacePath, raw)` (AC2/AC3/AC4). No other change. The heal-write call already passes `state.prd_path`, which is now the resolved absolute value, so it gets relativized on write for free. | T-01, T-02 |
| `tools/handoff-write.ts` | **modify.** At the single emit site (`if (effectivePrdPath) frontmatterData.prd_path = effectivePrdPath;`), emit `relativizePrdPath(workspacePath, effectivePrdPath)` instead. If that returns `undefined`, omit the field and write one stderr warning (DR-3). This single site covers new values, carry-forward (`existing?.prd_path` from `parseHandoff`, already resolved), and heal writes (AC1). Also update the `prdPath?` option doc comment to say it is absolute in memory and relative on disk. | T-01 |
| `tools/registry.ts` | **modify (refactor only, no behavior change).** The two inline copies of the traversal predicate (the `UpdateStateArgs` refine and the `IndexPrdArgs` refine) call `isInsideWorkspace(d.workspace_path, path.resolve(d.workspace_path, d.prd_path))` imported from `./handoff-parse.js`. The input `isAbsolute` refines, error messages, and JSON-schema descriptions stay **byte-identical** (AC5). | T-02 |
| `tools/handoff-types.ts` | **modify (comment only).** The `prd_path?` field comment becomes: "absolute in memory (resolved at parse); stored workspace-relative on disk (e235a)". | T-01 |
| `tools/handoff-orchestrator.ts` | **comment-only** (T-E235A-06, AC8). **No `prd_path` logic change:** it passes `parsed.prd_path` (zod-validated absolute) to `storage.writeState`, and relativization happens downstream in `handoff-write.ts`. | T-06 |
| `tools/storage-sqlite.ts` | **no change.** Documented exemption (DR-4). | T-03 |
| `tools/rag.ts` | **no change.** `tw_index_prd` receives a zod-validated absolute `prd_path` from its own args, and its chunk rows live in SQLite (DR-1). | — |
| `prompts/build.ts` | **no change.** `appendSpecContext` is gated on `isRagCapable(storage)`, which means SQLite mode only, and there `state.prd_path` comes from SQLite, not from `handoff.md` (DR-1). | — |
| `schema/versions.ts`, `schema/migrations-*.ts` | **no change** (DR-4: no bump). | T-04 |
| `docs/schema-versions.md` | **modify.** Add a "Representation note (e235a, no version bump)" paragraph right under the handoff version-history table (text in DR-4). | T-04 |
| `dist/tools/{handoff-parse,handoff-write,registry,handoff-types,handoff-orchestrator}.*` | rebuilt by `npm run build` | T-01/02/06 |
| `.current/_primary/handoff.md`, 17 × `.current/history/2026-09/*/handoff.md`, `.current/history/2026-09/e125c/compaction-procedure.md` | one-line / one-field rewrites (DR-6) | T-05 |
| `.current/history/2026-09/{e180,e213}/tasks.md` | prose-only (AC8) | T-06 |
| `test/e235a-relative-prd-path.test.mjs` | **new, qa-owned** | T-07 |
| `test/handoff-migration.test.mjs`, `test/writestate-options-object.test.mjs` | **qa-owned fixture re-point** (DR-5) | T-07 |

`content/**`, `test/fixtures/compose-golden/**`, and `test/context-budget.test.mjs`
are **not touched**. This was verified, not assumed:
- No `content/**` or `templates/**` file mentions `prd_path`.
- `prompts/build.ts` is not modified at all.
- The tool descriptions for `prd_path` in `tools/registry.ts` keep saying
  "absolute", which is still the input contract.

Composed prompt output is therefore byte-identical, and no stop-and-flag is
needed.

## Data Structures

- **No new types.**
- `HandoffState.prd_path?: string` keeps its type. Its **in-memory meaning is
  unchanged** (an absolute path). Only the on-disk frontmatter encoding changes.
- **On-disk encoding, file mode, from e235a on:** `prd_path: "<rel>"`.
  - `<rel>` is `path.relative(workspace_path, abs)` with `path.sep`
    normalized to `/`.
  - It is never empty, never starts with `..`, and is never absolute (the
    `isInsideWorkspace` post-condition).
- **Legacy on-disk encoding:** `prd_path: "<abs>"`. It is still readable,
  and `path.isAbsolute` tells the two encodings apart (AC3).
- **SQLite `handoff_state.prd_path` / `prd_chunks.prd_path`:** unchanged,
  still absolute (DR-4).

## Interface Contracts

All three helpers live in `tools/handoff-parse.ts` and are exported. They
are pure: no I/O, no `fs`, only `path`.

```ts
/** The existing traversal bound, extracted verbatim so there is one source.
 *  candidateAbs MUST already be absolute/resolved. Lexical (no realpath) —
 *  identical to the current zod refines, so the bound is neither loosened
 *  nor tightened. */
export function isInsideWorkspace(workspacePath: string, candidateAbs: string): boolean {
  const rel = path.relative(workspacePath, candidateAbs);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** Write side (AC1). Accepts an absolute (or, defensively, relative) value,
 *  resolves it against workspacePath, and returns the POSIX-separator
 *  workspace-relative form — or undefined when it falls outside the bound
 *  (never returns an absolute string, so an absolute path can never be
 *  persisted). */
export function relativizePrdPath(workspacePath: string, prdPath: string): string | undefined;
//   const abs = path.resolve(workspacePath, prdPath);
//   if (!isInsideWorkspace(workspacePath, abs)) return undefined;
//   return path.relative(workspacePath, abs).split(path.sep).join("/");

/** Read side (AC2/AC3/AC4). stored = raw frontmatter string (non-empty).
 *  - absolute + in-bounds  → returned VERBATIM (AC3: no normalization rewrite)
 *  - relative + in-bounds  → path.resolve(workspacePath, stored)  (AC2)
 *  - either, out-of-bounds → undefined (AC4 drop-to-absent, DR-2) */
export function resolveStoredPrdPath(workspacePath: string, stored: string): string | undefined;
```

Call sites:
- `readAndMigrate` (`handoff-parse.ts`):
  - `const rawPrd = asString(frontmatter.prd_path) || undefined;`
  - `const prdPath = rawPrd ? resolveStoredPrdPath(workspacePath, rawPrd) : undefined;`
  - If `rawPrd && !prdPath`, write one `console.error` line: `prd_path in
    handoff frontmatter resolves outside workspace_path — ignored (treated
    as absent)`. Do not echo the value.
- `writeHandoffStateCore` (`handoff-write.ts`): see Affected Files.
- `registry.ts`: see Affected Files.

External contracts (AC5), all unchanged:
- `tw_update_state.prd_path` and `tw_index_prd.prd_path` still require an
  absolute path inside `workspace_path`.
- `tw_get_state` still returns an absolute `prd_path`.
- `storage.writeState({ prdPath })` still takes an absolute path.

## Sequence Diagram

```mermaid
sequenceDiagram
  participant C as MCP caller
  participant R as registry.ts (zod)
  participant O as handoff-orchestrator.ts
  participant W as handoff-write.ts
  participant P as handoff-parse.ts
  participant D as .current/<lane>/handoff.md
  C->>R: tw_update_state {workspace_path, prd_path: absolute}
  R->>R: isAbsolute + isInsideWorkspace(ws, resolve(ws, p)) (unchanged bound)
  R->>O: parsed args
  O->>W: storage.writeState({ prdPath: absolute | undefined })
  W->>P: parseHandoff(ws) (carry-forward read)
  P->>D: read frontmatter prd_path (relative or legacy absolute)
  P->>P: resolveStoredPrdPath → absolute | undefined (AC4 drop)
  P-->>W: existing.prd_path (absolute)
  W->>W: effective = new ?? existing; relativizePrdPath(ws, effective)
  W->>D: atomic write, prd_path: "docs/backlog.md" (relative)
  C->>O: tw_get_state
  O->>P: parseHandoff(ws)
  P-->>C: prd_path: absolute (resolved in memory)
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| **DR-1 (a) Where relativize/resolve live, and how every consumer sees an absolute path.** Candidates were: each consumer resolves for itself (build.ts, rag.ts, orchestrator, sqlite), or the file-storage serializer boundary does it once. | Only the **file-storage serialization boundary** does it. Relativize happens at the one frontmatter emit site in `handoff-write.ts`. Resolve happens at the one frontmatter read site in `handoff-parse.ts` `readAndMigrate`. The pure helpers sit in `handoff-parse.ts`, which `handoff-write.ts` already imports, so no new module and no new import cycle. The rejected alternatives were a new `tools/*.ts` file (forbidden: "other tools/**") and `handoff-types.ts` (types-only by convention). | Every in-memory `HandoffState.prd_path` is absolute, so consumers need no change. Consumer walk-through: **orchestrator** passes zod-absolute input down and never reads the raw frontmatter; **carry-forward** reads `parseHandoff` (resolved) and re-relativizes on emit; the **heal-write** does the same; **`prompts/build.ts`** runs the RAG hook only in SQLite mode, where `prd_path` comes from SQLite (absolute, unchanged); **`tools/rag.ts`** uses its own zod-absolute args. So three of the spec's "maybe touch" files need no edit, which reduces risk. A side benefit: a moved checkout or worktree now keeps a valid `prd_path`, because relative values follow the workspace. |
| **DR-2 (b) AC4: where the guard goes and what failure looks like.** The new traversal surface exists only at **read time**, where a hand-edited or corrupted stored value is combined with `workspace_path`. At the MCP boundary, the existing refine already calls `path.relative` on both arguments, which normalizes `..` segments, so it already checks the resolved form. Failure-shape options: **reject the read** (throw), or **drop the field to absent**. | The guard goes at the **read-time resolution step** (`resolveStoredPrdPath` in `handoff-parse.ts`) and uses the same `isInsideWorkspace` predicate. The two `registry.ts` refines are refactored to call that predicate on `path.resolve(ws, p)`, which is semantically identical for absolute input, so there is one source for the bound. The predicate stays lexical (no `realpath`), exactly like today: neither loosened nor tightened. **Failure shape: drop to absent**, plus one stderr line that does not echo the value. The same rule is applied on the write side: `relativizePrdPath` returns `undefined`, so an out-of-bounds value is never persisted, and an absolute string is never persisted at all. | Throwing was rejected because it would take down `tw_get_state`, every gated write, and the pre-flight for a whole workspace over one optional, non-load-bearing field. Absent is already a safe, well-trodden state: the RAG hook falls back to in-workspace auto-discovery. The bad value **self-heals**: the next write's carry-forward sees `undefined` and drops it from disk. The rule covers both encodings: a legacy **absolute** value outside the workspace (for example a checkout that moved) is also dropped. Behavior before this change was equivalent, because `build.ts` `existsSync` failed and fell through to auto-discover. |
| **DR-3 Write-side out-of-bounds from direct (non-zod) callers.** `writeHandoffState` / `FileHandoffStorage.writeState` can be called directly (tests, the heal-write) without the zod refine. | Omit the field, and emit one stderr warning. Do **not** fall back to persisting the absolute string. | This keeps the invariant "no absolute `prd_path` is ever written by e235a+ code", which is the whole point of the ticket. The only real-world producers are zod-validated input and parse-resolved carry-forward, and both are in-bounds by construction. Only synthetic test fixtures hit this branch (DR-5). |
| **DR-4 (c) AC6: `schema_version` bump, handoff and sqlite.** A bump (v15→v16 stamp-only) would make any not-yet-restarted older server refuse-loud on every newly written handoff. It would also break ≥7 **non-owned** sanity tests that pin `CURRENT_VERSIONS.handoff === 15` (forbidden files, so an ownership re-draw would be needed). What does a bump buy? It protects old readers from misreading a relative value. In file mode, an old reader uses `prd_path` only for the `tw_get_state` display and a verbatim carry-forward. Its RAG hook is SQLite-only and reads SQLite. So there is no misresolution hazard. | **No bump, for either `handoff` or `sqlite`.** SQLite stays absolute and unchanged: the DB file is never git-committed, so the leak class does not apply, and its values come only from zod-absolute input, so there is no new traversal surface. T-E235A-03 is closed as a **documented exemption** with no code. **`docs/schema-versions.md` note text (T-04):** "Representation note (e235a, no version bump): from e235a on, file-mode `prd_path` is stored relative to `workspace_path` (POSIX separators) and resolved back to an absolute path at parse time. A value outside `workspace_path` is dropped as absent. No version gate: absolute vs relative is self-describing (`path.isAbsolute`), legacy absolute values read unchanged, and an older server reading a relative value only displays or carries it forward (its RAG hook is SQLite-only). The SQLite `prd_path` columns stay absolute: the DB is never committed, so there is nothing to protect, and sqlite stays at v2." | AC6 is satisfied through the "not bumped" branch, and the AC6 proof `git diff docs/schema-versions.md` shows the note. No non-owned test needs to change. One residual, acceptable edge: between merge and MCP-server restart, an old server shows a relative `prd_path` in `tw_get_state`. If an agent echoes it back into `tw_update_state`, the old zod refine rejects it loudly ("must be absolute"). That is visible and harmless. |
| **DR-5 AC10 and owned fixtures.** Some owned tests use synthetic absolute `prd_path` values outside their temp workspace. Under AC4/DR-2/DR-3 they now read as absent, and the assertions expect them preserved. Affected: `test/handoff-migration.test.mjs` (legacy v3 and v5 raw-frontmatter fixtures, plus the field-preservation write) and `test/writestate-options-object.test.mjs` (the positional-vs-options byte-identity case). Not affected: `test/cut-approval-gate.test.mjs` (a pure `runMigrations` payload, not parse), and `test/rag*.test.mjs` / `test/prompt-state-footer.test.mjs` (already in-workspace, or SQLite/chunk rows, or `build.resolvePrdPath` directly). | qa re-points those fixtures to paths **inside** the test's temp workspace (e.g. `path.join(ws, "specs/x.md")`). For raw-frontmatter legacy fixtures, qa writes an absolute value under the temp workspace. qa adds the new AC4 cases to `test/e235a-relative-prd-path.test.mjs` instead of weakening the old assertions. | This stays within AC10: both files are on the lane's owned list, and the assertions keep their intent ("preserved across migration/writes"). It is not an AC change. It is surfaced as OQ-1 so the integrator can confirm the reading. |
| **DR-6 (d) T-E235A-05 exact rewrite form** (already agreed via to-lane#2 / to-integrator#2). | **`prd_path:` lines** (1 primary + 17 history handoffs): keep the key, the double-quote style, and the line position. Replace the value with the part of the path **after that handoff's own workspace root**. For history files that root is the lane worktree named by the history folder. For `_primary` it is the primary checkout root. Resulting values:<br>• `docs/backlog.md`: `_primary`, e108, e125a, e125b, e126, e137, e174a, e179, e180, e212, e223, e231, e73<br>• `specs/e125c-index-compaction.md`: e125c<br>• `specs/e177a-fanout-manifest.md`: e177a<br>• `specs/e178a-integrator-role.md`: e178a<br>• `specs/e178b-lane-watch-tooling.md`: e178b<br>• `specs/e229-history-independent-scope-tests.md`: e229<br>**e178b `external_refs`** (two `ref:` values; `state:` untouched): `"<lanes-root>/lane-state-watch.mjs (integrator prototype)"` and `"<lanes-root>/_mailbox/*/to-integrator.md (recognizer corpus)"`.<br>**e125c `compaction-procedure.md` line 4:** replace only the back-ticked absolute worktree path with `` `<lanes-root>/e125c` ``. The rest of the line stays byte-identical.<br>Other rules: no in-file annotation, no `schema_version` restamp, no other field touched. | Every rewritten `prd_path` is relative and has no `..`, so under DR-2 it resolves in-bounds for any workspace root (T-08 check). The rewritten values equal exactly what AC1 would write, so AC2/AC3 hold for history files. A stale `schema_version` (≤15) sitting on a relative value is fine, because the encoding is self-describing (DR-4). Count reconciliation: the spec's "18 history handoffs" is really 17 history handoffs + `_primary` = 18 `prd_path` lines. With `compaction-procedure.md` that makes the 19 files, which matches the integrator's scan. See OQ-2. |

## Deferred Resources

_None. The spec's Dependencies / Prerequisites records zero external
references; `external_refs` is omitted from the routing write._

## Open Questions

These are **non-blocking.** Each one comes with a recommended default, and
the build proceeds on that default unless the integrator objects in its
second pre-review (lane-protocol §5 rule 2). None changes scope or ACs.

1. **OQ-1 (AC10 reading):** DR-5 needs qa to point out-of-bounds synthetic
   `prd_path` fixtures in two **owned** test files inside their temp
   workspace. *Default:* treat this as within AC10 (owned files, assertion
   intent kept). *Ask:* confirm this is not an AC change.
2. **OQ-2 (count wording):** AC7's "18 `.current/history/2026-09/*/handoff.md`
   files" is really 17 history handoffs + `_primary`. The architect's scan
   of the owned scope, using a generic home-directory-prefix pattern, finds
   exactly 19 files, matching your count. *Default:* rewrite the 19 files as
   enumerated in DR-6. qa's keyword re-scan (T-08) is authoritative for "no
   file missed". *Ask:* confirm your keyword scan also returns exactly these
   19 in the owned scope.
3. **OQ-3 (DR-3 write-side policy):** when a direct, non-zod caller passes an
   out-of-bounds value, the default is to omit the field plus a stderr warn,
   rather than persisting it verbatim. *Ask:* any objection?
4. **OQ-4 (post-merge window, notice only):** until the primary MCP server
   is restarted after the e235a merge, the running old build (a) still
   writes absolute `prd_path` on any write that sets it, and (b) shows the
   rewritten `_primary` relative value verbatim in `tw_get_state`. Neither
   is harmful (DR-4). *Default:* integrator restarts the server right after
   merge and includes `_primary` / its own handoff in the post-merge
   re-scan. No lane action.
