# e248-relative-mailbox-header

Ticket E248 (lane `e248`). Spec sources: the E248 row in `docs/backlog.md` and the e248 row in `specs/fanout-e243-e248.md`. This mirrors E235b (`specs/e235b-relative-manifest-worktree.md`), which made the worktree cell primary-relative.

## Problem Statement

A fan-out manifest can set an optional `mailbox:` header line. `parseManifest` stores the value as written (`MAILBOX_RE`, `tools/fanout-manifest.ts`), and `renderPrompt` joins it into `信箱: <root>/<lane>/` unchanged. The only way to write a header that works is an absolute local path, and committing that path to a tracked manifest leaks it. E235b fixed the same leak for the worktree column by resolving a relative value against `primary`. `primary` is already computed in the same render call, so the header can use that resolution too. No tracked manifest sets `mailbox:` today, so the leak is latent, not live.

## User Stories

- As an integrator, I want to write `mailbox: ../<lanes-dir>/_mailbox` in a tracked manifest, so that render prints a usable absolute mailbox path and no local path gets committed.
- As an integrator with an existing absolute header or a `--mailbox-root` habit, I want both to keep working the same way, so that nothing I already rely on breaks.
- As a manifest author, I want `validate` to warn me when my header is absolute, so that I notice the leak before I commit, the same way I am warned about an absolute worktree cell.

## Acceptance Criteria

Definitions used below:
- **relative header**: a `mailbox:` value (group 1 of `^mailbox:\s*(\S+)`, unchanged) for which `path.isAbsolute(value)` is false and which does not start with `~`. `.`, `..`, `../x`, `x/y` and `./x` all count. A `..` that climbs above `primary` is **allowed**, because the expected form is `../<lanes-dir>/_mailbox`, a sibling of primary, just like the worktree cell. There is no escape refusal.
- **resolution**: the same rule as `resolveWorktree(cell, primary)`: `~`-prefixed → refused; absolute → the value byte for byte; relative → `path.resolve(primary, value)`. The existing strip of trailing `/` runs after resolution, as it does today.

- **AC1 (relative header resolves against primary)**: Given a manifest with `mailbox: ../lanes/_mailbox` and `--primary /p`, and no `--mailbox-root`, when `render` runs for lane `e1`, then the prompt contains `信箱: /lanes/_mailbox/e1/` and exit is 0.
  proof: `node --test test/e248-relative-mailbox-header.test.mjs` (the relative-resolves test; it asserts `renderPrompt(...).prompt` matches `/信箱: \/lanes\/_mailbox\/e1\//`).
- **AC2 (relative header, primary from git)**: Given a relative header, no `--primary`, and a manifest directory inside a git repo, when render runs, then the mailbox resolves against that repo's first `git worktree list --porcelain` entry. This is the same primary the `primary:` line shows.
  proof: `node --test test/e248-relative-mailbox-header.test.mjs` (the git-primary test; it asserts the `信箱:` path equals `path.resolve(<rendered primary>, <header>) + "/e1/"`).
- **AC3 (absolute header unchanged)**: Given `mailbox: /hdr` with no flag, then render prints `信箱: /hdr/e177a/` exactly as today. An absolute value is not normalised: `mailbox: /a/./b` renders `/a/./b/<lane>/`. Only the existing trailing-`/` strip applies.
  proof: `node --test test/e177a-manifest.test.mjs` (existing `/hdr` assertion stays green) plus the e248 absolute-verbatim test.
- **AC4 (`--mailbox-root` precedence, flag semantics untouched)**: Given a manifest with a relative or absolute header and `--mailbox-root /m`, then render prints `信箱: /m/<lane>/`. The header is not consulted, and a malformed (`~`) header does not raise an error. The flag value itself is still used byte for byte and is never resolved against primary. For example, `--mailbox-root rel` still renders `rel/<lane>/`, as it does today.
  proof: `node --test test/e248-relative-mailbox-header.test.mjs` (the precedence tests: flag beats relative header, flag beats `~` header with ok=true, relative flag stays verbatim).
- **AC5 (refusal: `~` header)**: Given `mailbox: ~/mb` and no flag, when render runs with a primary, then exit is 2, no prompt is printed, and the errors include the new code `MAILBOX_TILDE` (scope `input`). The message says home-directory expansion is not performed and suggests the primary-relative form. The message does not echo the value.
  proof: `node --test test/e248-relative-mailbox-header.test.mjs` (the tilde test).
- **AC6 (refusal: empty / no header)**: A `mailbox:` line with no non-space value does not match `MAILBOX_RE`, which is unchanged. With no flag, render still fails `MAILBOX_ROOT_ABSENT` exactly as today, and the message text is unchanged. An empty or whitespace-only `--mailbox-root` also still falls through to the header, as today.
  proof: `node --test test/e248-relative-mailbox-header.test.mjs` (the empty-header test asserts code `MAILBOX_ROOT_ABSENT`).
- **AC7 (relative header with no primary)**: Given a relative header, no flag, no `--primary`, and a manifest directory outside any git repo, then render fails with `PRIMARY_NOT_FOUND`. It does not also report a mailbox error, and it never falls back to cwd. With an absolute header in the same situation, the only error is `PRIMARY_NOT_FOUND`, as today.
  proof: `node --test test/e248-relative-mailbox-header.test.mjs` (the no-primary test asserts the error code set is exactly `{PRIMARY_NOT_FOUND}`).
- **AC8 (validate follows the new semantics)**: `validate` stays exit 0 for any `mailbox:` value. A manifest with no header or a relative header produces no mailbox output line. An absolute header produces exactly one extra non-fatal line: `WARN  mailbox header (line <n>): mailbox: is an absolute path — write it relative to primary (e.g. ../<lanes-dir>/_mailbox); render still accepts it`. The line does not echo the path, which is the same policy as `WORKTREE_ABSOLUTE_WARN`. A `~` header gets no validate line, because `~` is a render-time refusal, just as `WORKTREE_TILDE` is render-only. The line number `<n>` is the 1-based line of the header match that won.
  proof: `node --test test/e248-relative-mailbox-header.test.mjs` (the validate tests run `runValidate` on a temp manifest for each of the three values and assert exit 0 and the WARN line is present or absent).
- **AC9 (format spec rows synced)**: The two `mailbox:` rows in `specs/e177a-fanout-manifest.md` (the manifest-format `mailbox:` row and the render-field-sources `信箱` row) say the following: the value may be primary-relative and is resolved against primary; an absolute value is taken byte for byte, and validate WARNs on it; a `~` value fails `MAILBOX_TILDE`; `--mailbox-root` wins and is taken byte for byte. No other line of that spec changes.
  proof: `git diff main -- specs/e177a-fanout-manifest.md` shows changes on exactly those two table rows.
- **AC10 (no regressions)**: `npm test` is green after commit, and `dist/tools/fanout-manifest.*` is rebuilt and committed.
  proof: `npm test` exit 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| mailbox.tilde.code | `MAILBOX_TILDE` | authored-here — parallels E235b `WORKTREE_TILDE` |
| mailbox.tilde.message | `mailbox: header starts with "~" — home-directory expansion is not performed; write it relative to primary (e.g. ../<lanes-dir>/_mailbox)` | authored-here — mirrors the `WORKTREE_TILDE` message shape |
| mailbox.absolute.warn | `WARN  mailbox header (line <n>): mailbox: is an absolute path — write it relative to primary (e.g. ../<lanes-dir>/_mailbox); render still accepts it` | authored-here — mirrors `WORKTREE_ABSOLUTE_WARN`; path deliberately not echoed |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The `--mailbox-root` flag: semantics, resolution and usage text are unchanged. The usage line in `scripts/fanout.mjs` and `FANOUT_USAGE` needs no edit, because the flag's syntax does not change.
- The worktree column and `resolveWorktree` (reuse or import is fine; behaviour must not change).
- `docs/lane-protocol.md`, SOP prose, `content/**`, and any existing manifest (none sets `mailbox:`).
- Existence checks on the resolved mailbox directory. Render stays pure, as E235b's resolution is.
- Changing `MAILBOX_RE` or the "first match wins" header rule.

## Dependencies / Prerequisites

- E235 (E235b `resolveWorktree`) is merged on base `3663b3a`.
- No design file; mode = no-design. Visual Structural Assertions are omitted.
- Resource audit: the requirement sources (the backlog row, the fan-out lane row) reference only in-repo files (`specs/e235b-relative-manifest-worktree-architecture.md`, `specs/e177a-fanout-manifest.md`). There are no external refs, so `external_refs` is omitted.
- No clarifications were needed. The PM decided three open points against E235b precedent: `..` is allowed; `~` fails at render only; validate WARNs on absolute.
