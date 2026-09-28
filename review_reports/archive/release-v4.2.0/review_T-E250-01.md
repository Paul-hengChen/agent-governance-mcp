# Review — T-E250-01

covers: T-E250-01, T-E250-02, T-E250-03, T-E250-04, T-E250-05

## Round 1 — APPROVED — by code-reviewer

## Summary
- Range reviewed: `8437af1..HEAD` on `feat/e250-eject-path-escape` (4336e1d, d8e25f6, e83c5b2), checked against `specs/e250-eject-path-escape.md`. There is no architecture spec.
- `bin/agc-init.mjs`: `agc eject` now passes every path it prints through `escapeSegmentForDisplay()`. A new `CONTROL_CHAR_RE` and `STR_EJECT_CONTROL_CHAR_NOTE` replace the `git rm -r` and `rm` paste-me lines when a listed path contains a control character.
- `docs/install.md` gains a "Leaving agc" bullet. `docs/config.md` gains the `AGC_HYGIENE_KEYWORDS` env-var row (E251).
- Two out-of-scope findings are filed in `.current/e250/pending-tickets.md` using the lane-protocol §4 format.
- Verdict: APPROVED. No required findings.

## AC Completeness
AC1 — implemented — `runEject` `cwdDisplay` used in the dry-run header (bin/agc-init.mjs ~3521). Smoke run: header is one line and shows `sub\nx\x1bq`.
AC2 — implemented — same `cwdDisplay` in the `applying to` header (~3524). Smoke run under `--yes` confirms it.
AC3 — implemented — escaped labels in `planClaudeBlockEntry` (~3331) and `planAdapterFileEntry` (~3374). Class KEPT/DELETE lines are escaped at ~3493 and ~3504. `.git/info/exclude` has a constant label.
AC4 — implemented — the hostChanges list escapes `e.display` (~3555). `Entry.display` stays raw, as the updated shape comment (~3287) says.
AC5 — implemented — the stderr tracked list escapes `p.display` (~3564). Smoke run: `sub\nx\x1bq/tasks.md`.
AC6 — implemented — `tracked.some((p) => CONTROL_CHAR_RE.test(p.target))` swaps in the note (~3567). The intro line and the trailing `Note:` line are kept. Smoke run confirms.
AC7 — implemented — the ordinary path goes through unchanged strings, because the helper returns input with no control byte as-is. `test/e108-eject.test.mjs` passes 35/35.
AC8 — implemented — `linkedList` is escaped (~3460). Smoke run: a worktree named `wt\rE` prints escaped in the dry-run warning.
AC9 — implemented — the `--yes` refusal uses the same `linkedList` and is thrown before any plan is printed. Smoke run: refused, escaped, and `.current/` left intact.
AC10 — implemented — `ejectCannotDoBlock` escapes each entry in `present` (~3260). Smoke run with `HOME=…/ho\x1bme` confirms.
AC11 — implemented — the `rm` line is swapped for the same shared note string (~3262). The `(none)` branch is unchanged.
AC12 — implemented — docs/config.md:204. The row text matches Copy/Strings exactly. The anchor matches docs/config.md:29 and resolves to docs/install.md:133 (`### Keeping governance artifacts out of git: …`). The hygiene-scan prose at install.md:157 sits under that heading.
AC13 — implemented — `node --test test/e108-eject.test.mjs` passes 35/35, and that file is not modified in the diff.
AC14 — implemented — `abs`, `apply`, `trackedTargets`, `p.target` and `Entry.display` all stay raw. Escaping happens only inside the print template literals. Smoke run under `--yes` deleted `.current/` and left the tracked `tasks.md` alone. The regression tests themselves are T-E250-06 (qa).

## Correctness
No required findings.
- (a) Print-site sweep. The print sites inside `runEject` and `ejectCannotDoBlock` that interpolate a path are: the header (both wordings), the class lines (KEPT and DELETE), host-trace labels, the hostChanges list, the stderr tracked list, the linked list (warning and refusal), and the `present` list. All of them are escaped. The "nothing to eject" branch prints advisory lines built from the already-escaped labels, plus the cannot-do block, and no cwd. The `unknown option ${a}` usage error echoes argv, not a path, so it is out of scope.
- **recommended**: the shared helpers that `runEject` calls first still interpolate cwd/top/primary raw in their error messages: `resolvePrimaryRepoRoot` (linked-worktree refusal), `resolveRepoRootOrNull` and `repoRelativeWorkspacePrefix`. So `agc eject` run from inside a control-character linked worktree still prints raw bytes on stderr. The spec's Problem Statement says "every path `agc eject` prints". However, these messages belong to helpers shared with `agc init` and `agc feature`, which the spec puts out of scope, and no AC lists them. Filing them as E250-NEW-1 is the correct handling. This does not block.
- (c) Note indentation. The note line keeps the indentation of the command it replaces: 2 spaces in the stderr block, 7 spaces under cannot-do item 4. Copy/Strings pins the string's text, and the Copy/Strings row describes it as *replacing* the paste-me line. The string itself is byte-verbatim (em dash included). Keeping the slot's indentation matches every other list and command line in both blocks, so I judge it conformant. AC6's wording "a single line reading exactly" could be read strictly. Note for QA (T-E250-06): assert on the trimmed line or with `includes()`, not whole-line equality.
- The `git rm -r` swap tests `p.target`, while the tracked list prints `p.display`. The two differ only by a trailing `/`, so they carry the same control-char verdict.

## Quality
- **optional**: `CONTROL_CHAR_RE` (`/[\x00-\x1f\x7f]/`) repeats the character class inline in `escapeSegmentForDisplay()` (~1340). A single shared constant would keep the two from drifting apart. This is a cosmetic change; the spec allows the helper to be "reused as-is".
- Naming (`STR_*`, `*_RE`) follows the file's conventions. The added comments (~1335, ~3216, ~3287) are generic, contain no local paths or ticket-only explanations, and describe behavior. Comment hygiene: pass.
- The `docs/install.md` bullet is accurate against the code. It covers the visible escapes (`\n`, `\r`, `\x1b`), the replacement of both the `git rm -r` and `rm` commands, and the unchanged operated paths.
- `.current/e250/pending-tickets.md` follows lane-protocol §4: `pending-ticket` fences with no `id`, `lane_local_id` `E250-NEW-n`, and blocks placed above `## Applied`.

## Architecture
There is no architecture spec. The change stays inside `bin/agc-init.mjs`, and `tools/**` is not touched (as the spec's Out of Scope requires). It reuses the existing E243 helper and adds no new escaping primitive.

## Security
This change closes the terminal-injection and line-splitting vector for eject's own output. Leaving the paste-me command out, rather than printing a broken or raw-byte command, is the safe choice. No new input boundaries or secrets. The remaining raw echoes in the shared helpers are the recommended finding above, tracked as E250-NEW-1.

## Performance
No findings. It adds one linear regex pass per printed path and one `some()` per list. There is no hot path.

## Verdict
APPROVED. All 14 ACs are implemented, and a control-character smoke run covered subdirectory, linked-worktree and `$HOME` paths. The ordinary-path suite passes unmodified. The findings are recommended or optional only.
