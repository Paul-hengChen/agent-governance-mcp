# Review — T-E248-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff `6770283..ae3f044`: `tools/fanout-manifest.ts` (+77/-8), rebuilt `dist/tools/fanout-manifest.*`, two table rows in `specs/e177a-fanout-manifest.md`, and sr's own `.current/e248/` handoff write. Every touched path is inside the owned-file set. `scripts/fanout.mjs` is unchanged, which is correct because the flag's usage text needs no edit (spec Out of Scope).
- A relative `mailbox:` header now resolves against primary through the new `resolveMailboxHeader`. An absolute header passes through byte for byte. A `~` header fails `MAILBOX_TILDE`. A non-blank `--mailbox-root` still wins and is used byte for byte. `validate` WARNs on an absolute header and prints no path.
- Independent verification: `npx tsc -p .` gives the same `dist/` as the commit (no diff after rebuild). The e177a-* and e235b-* tests pass 26/26. Full `npm test` ran 2910 tests: 2907 pass, 0 fail, 3 not run (skipped or todo). A scratchpad probe against `dist` covered AC1–AC8, and every case matched the spec.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — `tools/fanout-manifest.ts:897-901` + `resolveMailboxHeader` `:806-816`. The probe gave `mailbox: ../lanes/_mailbox`, `--primary /p` → `信箱: /lanes/_mailbox/e1/`. A trailing `/` is still stripped after resolution (`:909`).
AC2 — implemented — `:865-871` then `:897`. The header resolves against the same `primary` that `resolvePrimary(manifestDir)` returns. The probe from this lane worktree resolved against the first porcelain entry (the primary checkout).
AC3 — implemented — `:813`. The probe gave `mailbox: /a/./b` → `/a/./b/e1/` and `/hdr/` → `/hdr/e1/`.
AC4 — implemented — `:858-860`. When `flagRoot` is set, `header` is forced to `undefined`, so a `~` header never gets checked. The probe gave `/m` for both a relative and a `~` header (ok=true), and `--mailbox-root rel` rendered `rel/e1/`.
AC5 — implemented — `:807-812`. The code is `MAILBOX_TILDE`, the scope is `input`, and the message matches the Copy table exactly without echoing the value. `ok=false` means no prompt is printed.
AC6 — implemented — `:858-862`. The `MAILBOX_ROOT_ABSENT` message text is unchanged. A whitespace-only flag falls through to the header, and the probe confirmed this both with and without a header.
AC7 — implemented — `:897` (guard `primary !== undefined`). The probe outside any repo returned exactly `{PRIMARY_NOT_FOUND}` for relative, absolute and `~` headers. There is no cwd fallback.
AC8 — implemented — `:1219-1223` + `MAILBOX_ABSOLUTE_WARN` `:141-142`. The WARN text matches the Copy table. Exit is 0 in all four cases. No line appears for no header, a relative header or a `~` header. The line number comes from `mailboxLine` (`:385-388`, first match wins; the probe gave `/first` at line 1 when two headers were present).
AC9 — implemented — `specs/e177a-fanout-manifest.md`. The diff changes exactly two lines: the `mailbox:` format row and the `信箱` render-source row. Both carry all four required statements.
AC10 — implemented — `npm test` has 0 failures and the rebuilt `dist` matches the source.

## Correctness
No required findings.
- Ruling on the sr judgement call (a `~` header with no primary reports only `PRIMARY_NOT_FOUND`): **accepted**. AC5 is scoped "when render runs with a primary". AC7 establishes that a missing primary is the only report for the header. The E235b worktree skip (`:885-893`) sets the same precedent: a `~` worktree cell with no primary is also not reported. Detecting `~` needs no primary, so reporting it would be possible. But splitting the rule (tilde reported, relative skipped) would make the mailbox path behave differently from the worktree path for no gain. The user sees `MAILBOX_TILDE` on the next run once a primary resolves. `optional`: if T-E248-02 adds a test for this case, pin the exact error set `{PRIMARY_NOT_FOUND}` so the chosen behaviour is locked in.
- The non-null assertion at `:909` (`mailboxRoot!`) is safe. When `errors` is empty, either `flagRoot` was set or `header` and `primary` were both defined and `resolveMailboxHeader` returned ok, which assigns `mailboxRoot`.

## Quality
- `optional`: `resolveMailboxHeader` repeats the tilde/absolute/relative branches of `resolveWorktree` (`:778-791`). The spec says reuse is optional, and keeping them separate lets each carry its own code and message. Acceptable.
- `optional`: the `runValidate` check at `:1221` uses `path.isAbsolute` directly, while the worktree WARN uses `isAbsoluteWorktree`. They behave the same; this is cosmetic only.
- Naming (`mailboxTilde`, `MAILBOX_ABSOLUTE_WARN`, `mailboxLine`) follows the E235b conventions.

## Architecture
There is no `specs/e248-relative-mailbox-header-architecture.md` (the cut records no-architect: one module). Layering is unchanged: resolution stays pure (no fs access), render stays pure, and `validate` only adds a non-fatal line. `MAILBOX_RE` and the first-match-wins rule are unchanged, as the Out of Scope list requires.

## Security
This change closes the latent leak of absolute local paths through tracked manifests: the primary-relative form now works, and the WARN nudges authors toward it. `~` is refused and never shell-expanded. Neither the error message nor the WARN echoes the path. No new process spawn or shell use; git is still read only through the existing `execFileSync` argv path. `..` above primary is deliberately allowed per the spec, and the path is only rendered into prompt text, never opened.

## Performance
No findings. The change adds one `path.resolve` per render and one `path.isAbsolute` per validate. The `lines.entries()` iteration has the same complexity as before.

## Verdict
APPROVED — all AC1–AC10 are implemented and verified independently, every touched path is inside the owned-file set, and the no-primary `~` judgement call matches E235b precedent.
