# e235b-relative-manifest-worktree — architecture

Resolves Open Questions 1–3 of `specs/e235b-relative-manifest-worktree.md`
(T-E235B-01). Scope authority: the e235b row of `specs/fanout-e235.md`.

## Summary of decisions

- **OQ1 (mechanism):** the `worktree` cell holds a path **relative to the
  primary checkout** (for example `../<lanes-dir>/<lane>`), which is the form
  `specs/fanout-e235.md` already uses. No new manifest header line, and the
  cell is not dropped or reduced to the lane id. `render` resolves the cell
  against the primary path it already computes. A cell that is already absolute
  is passed through **byte-verbatim**, so it is still a distinct case, detected
  with `path.isAbsolute`.
- **OQ2 (CLI input):** **no new flag.** `render` already gets `primary` from
  `--primary <path>` or, when that is missing, from `resolvePrimary(manifestDir)`
  (the first `git worktree list --porcelain` entry). Resolution uses that one
  value. Nothing in the code assumes a fixed lanes-directory name. This matters
  because history already has two different lanes-directory names, which rules
  out option (b)'s "derive from the lane id" approach.
- **OQ3 (check / lane-status):** confirmed. **No behavior change** to `checkLane`
  / `runCheck` or to `tools/lane-status.ts` / `scripts/lane-status.mjs`. Neither
  of them reads the worktree cell. The parser (`parseManifest`) does not change
  either: row validation still does not look at the worktree cell. So a
  relative cell produces the same `check` and `lane-status` behavior as an
  absolute one. qa pins this with regression cases R7–R9.
- **validate:** it already accepts any worktree cell, because the parser never
  validates that column. AC1 therefore holds today. This ticket adds one
  **warning** (exit code still 0) when a dispatchable row's worktree cell is
  absolute. That catches the leak class from coming back without rejecting
  manifests already written (AC2).
- **No `schema_version` bump.** This is a change to the markdown format of the
  manifest. Nothing under `schema/`, no handoff field, and nothing in
  `.config.json` or the SQLite store is touched. The manifest has never carried
  a schema version, and it is not a persisted artifact under
  `docs/schema-versions.md`.
- **`content/**` is not touched.** AC4 is met by one bullet in
  `docs/lane-protocol.md` plus the updated module header in
  `tools/fanout-manifest.ts`. AC5 is therefore vacuous, and T-E235B-08 is a
  recorded no-op (qa states N/A with this reference).

## Affected Files

- `tools/fanout-manifest.ts`: modify.
  - New exported `resolveWorktree(cell, primary)` and `isAbsoluteWorktree(cell)`
    (see Interface Contracts).
  - `renderPrompt`:
    - resolve `<worktree>` through `resolveWorktree` instead of using
      `lane.worktree` byte-verbatim;
    - add two render-only row errors, `WORKTREE_EMPTY` and `WORKTREE_TILDE`,
      raised next to the existing render-only `BRANCH_NOT_FEAT`.
  - `runValidate`: after the existing `fanout: ok — …` line, add one `WARN` line
    per dispatchable row whose cell is absolute.
  - Module header comment:
    - amend "Row cells are rendered byte-verbatim" to say that the one exception
      is `worktree`, which is resolved against primary when relative;
    - cite this blueprint as the amendment to the e177a "Render field sources"
      row.
- `dist/tools/fanout-manifest.{js,d.ts,js.map}`: rebuild with `npm run build`.
- `scripts/fanout.mjs`: **unchanged.** Its usage comment already matches, since
  no flag is added.
- `tools/lane-status.ts`, `scripts/lane-status.mjs` and their `dist/**`:
  **unchanged** (OQ3). They are listed only so the "no change" state is
  explicit.
- `docs/lane-protocol.md`: add one bullet under §1 step 1 (wording in
  Interface Contracts §4). No other paragraph changes.
- `specs/fanout-*.md` (9 files, including `specs/fanout-e235.md`): one-time
  rewrite of the worktree cells to the relative form (rule in Interface
  Contracts §5). `specs/fanout-e235.md` is already relative and needs no cell
  change.
- `test/fixtures/e177a/{fanout-wave5.1,fanout-wave6,fanout-wave7}.md`,
  `test/fixtures/e178b/fanout-wave7-e177a.md`: qa-owned. Worktree cells get the
  same rewrite.
- `test/fixtures/e177a/render-e177a.golden.txt`: qa-owned. Regenerate it. With
  `--primary /p` and the cell `../agm-lanes/e177a`, the worktree line becomes
  `worktree: /agm-lanes/e177a`.
- `test/e177a-manifest.test.mjs`: qa-owned. The AC6 spot-check regex for the
  worktree line moves to the resolved value. The new cases live in a new file
  (below).
- `test/e235b-relative-worktree.test.mjs`: qa-owned, **new**. Cases R1–R11.
- The E232-leftover files and the E240 add-on files: prose- and comment-only
  scrub, handled per the PM spec's ACs 7 and 9–13. No architecture content
  beyond the discipline rule in Decision Records row 7.

## Data Structures

No new types or persisted fields. `DispatchableLane.worktree` stays the
trimmed, **raw** cell text. It is never rewritten at parse time, so
`parseManifest` / `validateManifest` output and `checkLane` stay exactly as
they are. The `Manifest` shape does not change, and nothing is added to it.
Resolution happens only in `renderPrompt`.

New constants, exported from `tools/fanout-manifest.ts`:

```ts
/** Render-only row error codes (not gate codes; their suffixes are outside the error-code-contract vocabulary). */
FANOUT_CODES.worktreeEmpty = "WORKTREE_EMPTY";
FANOUT_CODES.worktreeTilde = "WORKTREE_TILDE";

/** validate warning line; the absolute value is deliberately NOT echoed. */
export const WORKTREE_ABSOLUTE_WARN = (lane: string, line: number): string =>
  `WARN  lane ${lane} (line ${line}): worktree cell is an absolute path — write it relative to primary (e.g. ../<lanes-dir>/${lane}); render still accepts it`;
```

Do **not** use a `_REQUIRED` / `_MISSING` / `_MISMATCH` / … suffix. That would
drag the codes into `test/error-code-contract.test.mjs`'s gate-code harvest.
The precedent for this is the note on `FANOUT_CODES`.

## Interface Contracts

### 1. `resolveWorktree`

```ts
export function isAbsoluteWorktree(cell: string): boolean; // path.isAbsolute(cell)

/**
 * Rules, in this order:
 * - cell is empty (after trim) → { ok: false, code: "WORKTREE_EMPTY" }
 * - cell starts with "~"       → { ok: false, code: "WORKTREE_TILDE" }
 *   (never shell-expanded — the tool does not guess a home directory)
 * - path.isAbsolute(cell)      → { ok: true, path: cell } (byte-verbatim: no
 *   normalisation, no trailing-slash strip — AC2's "unchanged" guarantee)
 * - otherwise                  → { ok: true, path: path.resolve(primary, cell) }
 */
export function resolveWorktree(
  cell: string,
  primary: string,
): { ok: true; path: string } | { ok: false; code: string; message: string };
```

Constraints:

- It is pure. There are no fs calls, and it does not check whether the target
  exists. The existing non-goal in `specs/e177a-fanout-manifest.md` ("Validating
  that `worktree`/owned paths exist on disk") still holds.
- It uses Node's platform `path`, the same module the rest of the file already
  imports. The base is the `primary` that `renderPrompt` has already resolved.
  It is never `manifestDir` and never `process.cwd()`.
- Any relative form is allowed (`./x`, `x`, `../a/b`). `path.resolve` normalizes
  it. It does not check that the resolved path is outside primary. A lane
  worktree inside primary is unusual, but it is not an information-hygiene
  problem, and the tool does not guess intent.

### 2. `renderPrompt(m, laneId, opts)`

The signature does not change (`RenderOptions` gets no new field).

Behavior changes:

1. Once `primary` has been resolved and before the early error return, if
   `primary` is defined, call `resolveWorktree(lane.worktree, primary)`.
2. If the result is `ok: false`, push
   `{ code, scope: "row", lanes: [lane.lane], message: "lane <id>: <reason>" }`
   into the same `errors` array that `BRANCH_NOT_FEAT` uses.
   - All missing inputs are still collected before the function returns.
   - When `primary` is missing, only `PRIMARY_NOT_FOUND` is reported. Worktree
     resolution is skipped because there is no base to resolve against, so the
     same condition never produces two errors.
3. `values["<worktree>"]` becomes the resolved path.
4. Every other placeholder, and the prompt template (`PROMPT_TEMPLATE_3B`), is
   byte-for-byte unchanged.

### 3. `runValidate(args)`

- The exit code is unchanged: 0 when there are no errors, 2 otherwise.
- The first stdout line is unchanged.
- After the first line, append one `WORKTREE_ABSOLUTE_WARN(lane, line)` line
  for each `manifest.dispatchable` row where `isAbsoluteWorktree(worktree)` is
  true. Keep manifest order and end each with `\n`.
- Provisional rows are not inspected, since they have no worktree column
  contract.
- When there are errors (exit 2), no warnings are printed. stdout stays empty,
  as it is today.

`validateManifest()` (the library API) does **not** change. The warning is a
presentation layer on top of it, the same way `checkLane` layers its E208 WARN
lines onto its report.

### 4. `docs/lane-protocol.md` (§1 step 1, one bullet appended)

Add this bullet with this meaning (sr may polish the Chinese; the meaning is
fixed):

> - 派工 prompt 裡的 `<worktree>` 一定是絕對路徑（`render` 把清單中「相對於 primary」的 worktree 欄解析成絕對路徑）；它只用來 `cd`，**不要**把它寫進任何 tracked 檔（handoff、spec、報告、測試）。tracked 檔提到 worktree 時用 `../<lanes-dir>/<lane>` 這種相對形式或類別描述。

### 5. One-time rewrite rule (T-E235B-04 specs; T-E235B-06 fixtures)

- For each dispatchable row whose worktree cell is `<abs-prefix>/<lanes-dir>/<lane>`,
  the new cell is `../<lanes-dir>/<lane>`.
- `<lanes-dir>` is kept as that manifest already names it. History uses two
  names, and both are neutral directory names.
- Only the worktree cell changes. Prose occurrences in the same files (the
  `fanout-wave7.md` 7.0 row, `fanout-wave7.2.md` line 14) get the same
  replacement or a class description, and only those lines change.
- Never introduce a username, a home-directory prefix, or a temp-directory
  path.
- After the rewrite, `node scripts/fanout.mjs validate <f>` prints **no**
  `WARN` line for any of the 9 specs or the 4 fixtures.

## Sequence Diagram

```mermaid
sequenceDiagram
  participant I as Integrator
  participant F as fanout.mjs render
  participant G as git
  participant L as Lane session
  I->>F: render specs/fanout-X.md <lane> --summary … --reading … --mailbox-root … [--primary P]
  F->>F: parseManifest (worktree cell kept raw, e.g. ../<lanes-dir>/<lane>)
  alt --primary given
    F->>F: primary = P
  else
    F->>G: git worktree list --porcelain (in manifestDir)
    G-->>F: first entry = primary
  end
  F->>F: resolveWorktree(cell, primary)
  alt cell absolute
    F->>F: worktree = cell (byte-verbatim)
  else cell relative
    F->>F: worktree = path.resolve(primary, cell)
  else empty or ~-prefixed
    F-->>I: exit 2, WORKTREE_EMPTY / WORKTREE_TILDE
  end
  F-->>I: prompt with absolute worktree (stdout, never committed)
  I->>L: paste prompt; lane cd's into worktree
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| OQ1: how a tracked cell avoids an absolute path | Cell is relative to the **primary checkout**, resolved at render. Rejected: (a) a `lanes-root:` header, because it adds a second input and a second place a local path could be typed into a tracked file; (b) lane-id-only derivation, because history already uses two different lanes-dir names, so any fixed convention guesses wrong for some manifests | No new header or flag. The rule reads the same in every manifest. The existing `specs/fanout-e235.md` form becomes the norm with zero edits to that file's cells |
| Base for relative resolution | `primary` (the value already rendered as `primary:`), not the manifest's directory and not cwd | The prompt's `primary:` and `worktree:` lines always agree. Running render from inside a lane worktree still resolves correctly, because `resolvePrimary` returns the main worktree first |
| Back-compat for absolute cells (AC2) | Detected via `path.isAbsolute` and passed through byte-verbatim (no normalisation) | Render output for any already-written absolute manifest is byte-identical to today. The "never guesses" property stays: resolution is one stated rule, not a heuristic |
| Tilde and empty cells | Render-only row errors `WORKTREE_EMPTY` / `WORKTREE_TILDE`. Not raised by the parser | `~` is never expanded, since the tool does not guess a home directory. Because these errors live in render only, `check` and `validate` exit codes do not change for any manifest (AC3), following the `BRANCH_NOT_FEAT` precedent |
| Preventing recurrence | `validate` prints a non-fatal `WARN` per absolute cell, without echoing the value. Exit code stays 0 | Integrators see the leak class at validate time without breaking old manifests. The warning does not repeat the leaked string in its own output |
| `mailbox:` header / `--mailbox-root` | **Not** extended to relative-to-primary in this ticket. No current manifest has a `mailbox:` line, and the root is a CLI input that is not committed | Out of AC scope. A future manifest that types an absolute `mailbox:` line into a tracked file would still leak. Suggested as an integrator follow-up ticket, not built here |
| e177a normative spec | `specs/e177a-fanout-manifest.md` (a closed ticket, not in e235b's owned scope) is **not** edited. This blueprint and the updated module header are the amendment to its "Render field sources" `<worktree>` row | No edit outside owned scope. A reader of the e177a spec is sent here by the module header's citation |
| Information-hygiene cleanup (AC7, AC9–13) | Prose and comment lines only. In evidence files, never a heading, verdict line or `covers:` line. `tools/transitions.ts` is comment-only, with `dist` rebuilt so compiled comments match | No functional diff from the cleanup. code-reviewer can verify with a diff that touches only comment and prose lines |

## Deferred Resources

_None. The spec's scope and non-goals reference only in-repo files. No external
URL, design file or ticket was marked `ignore` / `defer`._

## Regression cases (for qa-engineer; `test/e235b-relative-worktree.test.mjs` unless noted)

Use synthetic manifests built the same way as `manifestText()` in
`test/e177a-manifest.test.mjs`, with `primary: "/p"` and `mailboxRoot: "/m"`.

1. **R1 relative resolves.** Row cell `../lanes/e1`. `renderPrompt` returns ok
   and the prompt contains `worktree: /lanes/e1    lane: e1`.
2. **R2 absolute passes through byte-verbatim.** Row cell `/tmp/e1/` (trailing
   slash kept). The prompt contains `worktree: /tmp/e1/    lane: e1`, not
   normalized.
3. **R3 AC2 golden.** A manifest identical to the rewritten `fanout-wave7.md`
   except the e177a cell is set back to an absolute value `/abs/agm-lanes/e177a`.
   Its render equals the regenerated golden with only the worktree line
   differing, and that line equals the absolute cell. This shows the only
   difference between the two modes is the resolution step.
4. **R4 empty cell.** Cell is empty (8 cells, worktree blank).
   - `render` returns ok false with a `WORKTREE_EMPTY` error scoped `row`,
     `lanes: ["e1"]`.
   - `validateManifest` has no error for it.
   - `check` on a real branch (reuse the e177a-check-cli repo helper) is
     unaffected.
5. **R5 tilde cell.** `~/lanes/e1`. `render` returns `WORKTREE_TILDE`, and the
   prompt text never contains an expanded home directory.
6. **R6 primary absent.** No `--primary` and `manifestDir` is not a git repo,
   with a relative cell. Only `PRIMARY_NOT_FOUND` is reported (no worktree
   error). An isolated temp git repo as `manifestDir` resolves the cell against
   that repo root.
7. **R7 check unaffected (AC3).** Two manifests that differ only in the
   worktree cell (relative vs absolute). `checkLane` against the same repo,
   base and branch produces byte-identical `report.output` and the same
   `exitCode`.
8. **R8 parse unaffected.** `parseManifest` on the relative manifest gives
   `dispatchable[0].worktree === "../lanes/e1"` (raw) and `errors` deep-equal
   to the absolute variant's `errors`.
9. **R9 lane-status unaffected (AC3).**
   - Assert statically that `tools/lane-status.ts` does not import
     `fanout-manifest` and has no reference to `specs/fanout-`.
   - Also run `node scripts/lane-status.mjs` in an isolated repo that contains
     a relative-cell manifest under `specs/`, and assert that its listing
     equals the listing from the same repo without that manifest.
10. **R10 validate warning (CLI).**
    - The absolute-cell manifest exits 0, stdout line 1 is the unchanged
      `fanout: ok — …` line, and line 2 matches
      `^WARN  lane e1 \(line \d+\): worktree cell is an absolute path`.
    - stdout does **not** contain the absolute cell value.
    - The relative-cell manifest's stdout is exactly the single ok line.
    - A manifest with a format error exits 2 with empty stdout (no warnings).
11. **R11 repo sweep.**
    - Every `specs/fanout-*.md` and every fixture under `test/fixtures/e177a/`
      and `test/fixtures/e178b/` validates with zero `WARN` lines.
    - None of them contains a dispatchable worktree cell for which
      `isAbsoluteWorktree` is true. This pins AC6 so it cannot regress.

Existing tests to update (qa-owned):

- `test/e177a-manifest.test.mjs` AC6: the worktree spot-check becomes
  `worktree: \/agm-lanes\/e177a {4}lane: e177a`, and the golden is regenerated.
- The validate stdout assertions in `test/e177a-manifest.test.mjs` and
  `test/e177a-check-cli.test.mjs` stay exact. They pass unchanged only because
  the fixtures are rewritten to relative form, and that coupling is intended.
- The other listed `test/e17*` / `test/e223*` files: change only the literal
  worktree strings. No behavior assertions change.

## Open Questions

None. Resolved 2026-09-28: the integrator adds the E240 add-on files to e235b's owned-files cell in `specs/fanout-e235.md` after merge; T-E235B-04 changes only the worktree column. The relative `mailbox:` follow-up is filed as E235B-NEW-1 in `.current/e235b/pending-tickets.md`.
