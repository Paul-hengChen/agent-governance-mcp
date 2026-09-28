# Review — T-E243-03

## Round 1 — APPROVED — by code-reviewer

Diff: `9a07f6b..HEAD` (code commit b1e1b5c; lane-state commit afb5824). Spec: `specs/e243-init-path-escape-refusal.md`. No architecture spec exists for this feature.

## Summary
- Widens the one shared predicate (`GITIGNORE_WILDCARD_RE` renamed to `GITIGNORE_UNSAFE_SEGMENT_RE = /[*?[\]\\\x00-\x1f\x7f]/`) so it also covers backslash, the C0 range and DEL. Only `repoRelativeWorkspacePrefix()` uses it (`bin/agc-init.mjs:1300`, `:1332`).
- Adds the display-only `escapeSegmentForDisplay()` (`bin/agc-init.mjs:1308`). Only the two message interpolations call it (`:523`, `:1168`). The raw `unsafeSegment` is still what every logic use reads.
- Rewrites the `init` refusal, the `agc check` advisory and the `docs/install.md:150` sentence to match the Copy / Strings table word for word.
- No test files are touched, so the ownership split holds. Both expected reds are real and are the only two failures.
- Verdict: APPROVED. Every AC in T-E243-03's scope is implemented and I checked each one black-box. The one finding is an optional stale comment.

## AC Completeness
AC1 — implemented — `bin/agc-init.mjs:521-528`. Smoke: `init --artifacts=local` in a directory named `a\b` gives rc=2 and creates no scaffold files.
AC2 — implemented — same branch. Smoke: segments with CR and with LF each give rc=2 and create no scaffold.
AC3 — implemented — the regex range `\x00-\x1f\x7f`. Smoke: BEL, ESC, TAB and DEL segments each give rc=2 and create no scaffold.
AC4 — implemented — `* ? [ ]` are still in the class at `:1300`. The existing AC9 wildcard test passes. The existing AC8 test is red only on its pinned message text, which is expected (AC12, qa-owned).
AC5 — implemented — the refusal is gated on `mode === "local"` (`:521`). Smoke: `init --artifacts=repo` in `a\b` gives rc=0, stamps `"artifacts": "repo"` and leaves the exclude file unchanged.
AC6 — implemented (confirmed by reading the code and by smoke) — `checkArtifactsDrift` (`:1165-1174`) returns right after the advisory when `unsafeSegment !== null`. That branch has no character test of its own. Smoke: a hand-authored local config in the `g<ESC>h` directory prints the advisory with `g\x1bh`, and `agc check` exits 0. In the repo-mode branch (`:1187`), `excludeLines` is a set of single lines, so a rule that contains CR or LF can never match one by mistake.
AC7 — implemented (confirmed by reading the code and by smoke) — `planExcludeEntry` `:3370`, `if (ctx.workspace.unsafeSegment !== null) return null;`, is unchanged. Smoke: the `agc eject` dry-run in `a\b` lists (i), (ii-b) and (iii) adapter entries, and no `.git/info/exclude` entry.
AC8 — implemented — `grep` finds exactly one character-class definition (`:1300`) and one use of it (`:1332`). The three call sites (`:521`, `:1166`, `:3370`) only read `unsafeSegment`. The regex inside `escapeSegmentForDisplay` is a display transform, not a second safety test, and it never decides refuse or skip.
AC9 — implemented — `:523-526`. It matches the `init.local.unsafe-segment-refusal` string word for word once the concatenation is joined. `grep 'one of \* ? \[ \]' bin/agc-init.mjs` finds nothing.
AC10 — implemented — `:1168-1170`. It matches `check.local.unsafe-segment-advisory` word for word, including the trailing newline.
AC11 — implemented — `docs/install.md:150` matches `install.local.unsafe-segment-sentence` word for word. `grep 'gitignore wildcard character' docs/install.md` finds nothing.
AC12 — out of this task's scope (T-E243-04, qa). The two pinned cases are red, as the manifest lists.
AC13 — implemented (checked independently) — `repoRelativeWorkspacePrefix()` (`:1325-1333`) splits `path.relative()` on `path.sep`, joins the pieces with `/`, and only then splits on `/` for the per-segment test. On win32, `path.sep === "\\"` and `path.relative` returns a path separated by backslashes. Every backslash is therefore used up as a separator before any segment exists, and a segment can never contain one. The `..` escape guard (`:1327`) also uses `path.sep`, so it is correct on both platforms. No win32 branch is needed. The claim holds. The test-skip half is qa-owned (T-E243-04).
AC14 — implemented — `escapeSegmentForDisplay` (`:1308-1315`): `\n`, `\r` and `\t` get named escapes, other C0 bytes and DEL become lowercase `\xHH` (via `toString(16)` and `padStart(2,"0")`), and backslash and wildcards pass through unchanged. `cat -v` on the smoke output shows no raw control bytes. CR prints as `\r`, ESC as `\x1b`, BEL as `\x07` and DEL as `\x7f`, in both the `init` and `check` messages.

## Correctness
No required findings.
- informational: a literal backslash prints as-is, so the display is ambiguous. A directory named `c\rd` (a literal backslash followed by `r`) and one named `c<CR>d` print the same message. The human approved this at the cut ("backslash prints as-is, no `\\`"), and the spec states it (AC14, Dependencies). Both cases refuse, so no logic depends on telling them apart. Recorded only.
- Expected-red sampling (SOP 4a): `qa_reports/expected-red_e243-init-path-escape-refusal.txt` exists and has 2 entries. I sampled both. `test/e239-init-subdir-exclude.test.mjs:264` (AC8) and `:375` (AC13) are real tests that can be found by name. `node --test test/e239-init-subdir-exclude.test.mjs test/e108-eject.test.mjs` gives 46 pass and 2 fail, and the 2 failures are exactly those entries.

## Quality
- optional: a stale comment remains at `bin/agc-init.mjs:1129-1130`. The `checkArtifactsDrift` header still says "A \"local\" workspace whose path has a gitignore-wildcard segment". The diff updated the matching comments at `:516-520`, `:1321` and `:3362` but missed this one. A one-word fix ("…has an exclude-unsafe segment") would stop it misleading future readers. It does not block.
- The rename to `GITIGNORE_UNSAFE_SEGMENT_RE` is allowed by the spec's Out of Scope note. No references to the old name remain in `bin/`.

## Architecture
No architecture spec exists. The single-predicate constraint (AC8) holds, and the display helper stays separate from the logic value, as the spec requires. The change fits the E239 mechanism and does not revisit any of its decisions.

## Security
No findings. This change removes an injection vector in two places. It stops CR/LF injection into the shared `.git/info/exclude` file, because local mode refuses before any write. It stops terminal escape injection through the two messages it rewrites, because of the display escaping. The eject plan still prints the workspace path raw. That is out of scope and already logged as E243-NEW-1 in `.current/e243/pending-tickets.md`.

## Performance
No findings. The only per-segment work is one regex test, and one `replace` runs on the error path only. There is no hot path.

## Verdict
APPROVED. All T-E243-03 ACs (AC1-AC11, AC14, plus the confirmations for AC6, AC7 and AC13) are implemented and verified black-box, and the only finding is an optional stale comment.
