# e243-init-path-escape-refusal

## Problem Statement
E239 taught `bin/agc-init.mjs` to refuse `--artifacts=local` (and to have `agc check` print a
"cannot verify" advisory, and `agc eject` skip its exclude-removal entry) whenever a workspace
path segment below the repo root contains a gitignore wildcard metacharacter — `* ? [ ]` — because
a literal exclude rule built from such a segment could match unintended files. E239's own review
(`review_reports/review_T-E239-01.md`, finding F1) flagged that the same silent-miss class is not
actually closed: a **backslash** is a gitignore escape character, so a directory named `a\b` yields
the written rule `/a\b/.current/`, which git reads as `/ab/.current/` — the created files are
untracked but not ignored, and `agc check` stays silent because the exact (wrong) rule string is
present. A **CR or LF** embedded in a directory name would be written verbatim into the shared
`.git/info/exclude` file and split what agc intends as one rule into multiple lines, letting the
directory name inject an unrelated pattern the operator never asked for. Both are the same defect
this ticket's title names: the refusal set is too narrow, so the exclude rule agc writes can
silently miss the scaffold it just created, and `agc check` has no way to notice.

This spec widens the one predicate all three call sites share — `repoRelativeWorkspacePrefix()`'s
`unsafeSegment` — rather than re-deriving three separate character tests, and rewrites the two
user-facing runtime messages plus the one `docs/install.md` sentence that currently enumerate
exactly `* ? [ ]` so they describe the character *class* instead of a fixed four-character list.

Widening the refusal set to include control characters raises a second, adjacent hazard the
integrator's pre-review caught: both runtime messages print the offending `<segment>` back to the
user verbatim. A segment carrying a raw CR or LF would split agc's own one-line error across
multiple terminal lines; a segment carrying ESC (0x1B) could inject a terminal control sequence
into the operator's shell. Since this spec is already widening the refusal to include exactly these
bytes, it also requires both messages to print `<segment>` in an escaped, visible form rather than
raw (AC14).

**Ticket-text correction (confirmed by this lane's PM before cutting tasks)**: the `docs/backlog.md`
E243 row says the fixed verbatim strings appear "in three user-facing messages." Reading the actual
call sites shows two user-facing runtime messages (`init`'s refusal, `agc check`'s cannot-verify
advisory) plus one `docs/install.md` prose sentence plus one silent behavioral path (`agc eject`'s
`planExcludeEntry` skip, which prints nothing distinctive today and needs none — see AC7). This
spec's Acceptance Criteria are written against that corrected count of four affected surfaces (two
messages + one doc sentence + one behavior), not three messages.

**Character-class decision (why the full C0 range, not just CR/LF)**: the integrator's cut asks for
"at least CR/LF," leaving the rest of the C0 range to this lane's judgment. This spec covers the
full C0 control range (0x01–0x1F; 0x00 NUL cannot occur in any real path segment, POSIX or
Windows, so it is not separately testable) plus DEL (0x7F), for three reasons:
1. CR (0x0D) and LF (0x0A) are required — they are the two control characters that can split one
   written exclude line into several, the same injection shape motivating this ticket.
2. No other C0 control character or DEL has any legitimate use inside a directory name, and every
   mainstream filesystem convention users already rely on agrees — NTFS forbids all of 0x00–0x1F in
   a filename outright — so refusing the rest of the range costs zero real flexibility.
3. A single contiguous range test (`\x00-\x1f\x7f`) is one predicate to audit, not a hand-picked
   subset that leaves a plausible-looking gap for the *next* ticket to rediscover — which is exactly
   how this ticket itself originated from E239's narrower `* ? [ ]`-only scope.

## User Stories
- As an agc operator whose workspace directory name happens to contain a backslash, I want
  `agc init --artifacts=local` to refuse clearly (same shape as the existing wildcard refusal)
  rather than silently write an exclude rule that means something other than my directory name, so
  I'm never left with an untracked-but-not-ignored scaffold I can't see.
- As an agc operator whose workspace directory name happens to contain a CR, LF, or other control
  character, I want the same refusal, so a stray control byte in a path can never inject an
  unintended line into the shared `.git/info/exclude` file.
- As an agc operator running `agc check` or `agc eject` against such a path, I want both to treat it
  exactly the same way `init` does — because all three read the one shared predicate — so no two
  commands ever quietly disagree about which paths are unsafe.
- As a reader of the refusal message or of `docs/install.md`, I want the text to describe the kind
  of character that's unsafe rather than list exactly four of them, so the copy doesn't go stale the
  next time the class widens.

## Acceptance Criteria

- **AC1** — Given a workspace path segment below the repo root contains a backslash (`\`), when the
  effective mode is `local` (flag omitted with nothing tracked, or `--artifacts=local` explicit) and
  `agc init` runs, then it exits 2 before any write, prints the (new, AC9) refusal message naming
  that segment, and leaves no `.current/`, `tasks.md`, or other scaffold file behind.
  proof: `test/e239-init-subdir-exclude.test.mjs` new case "AC15: backslash subdir name refuses local mode cleanly"

- **AC2** — Given a workspace path segment contains a CR (0x0D) or an LF (0x0A), when the effective
  mode is `local` and `agc init` runs, then it refuses identically to AC1 (exit 2, the AC9 message,
  no partial scaffold), for each of CR and LF tested separately.
  proof: `test/e239-init-subdir-exclude.test.mjs` new case "AC16: CR/LF subdir name refuses local mode cleanly"

- **AC3** — Given a workspace path segment contains another C0 control byte (0x01–0x1F excluding
  CR/LF, sampled at minimum with BEL 0x07 and US 0x1F) or DEL (0x7F), when the effective mode is
  `local` and `agc init` runs, then it refuses identically to AC1.
  proof: `test/e239-init-subdir-exclude.test.mjs` new case "AC17: other C0/DEL subdir name refuses local mode cleanly"

- **AC4** — Given a workspace path segment contains a gitignore wildcard character (`* ? [ ]`, the
  pre-existing E239 refusal set), when `agc init` runs in `local` mode, then it still refuses exactly
  as before — a regression guard proving the widened predicate is additive, not a replacement that
  narrows the existing set.
  proof: `test/e239-init-subdir-exclude.test.mjs`'s existing AC8/AC9 cases (message-text portion
  updated per AC12) continue to pass

- **AC5** — Given any of the AC1/AC2/AC3 unsafe segments, when `agc init --artifacts=repo` runs
  explicitly, then it proceeds normally: scaffolds the workspace, stamps `"artifacts": "repo"`, and
  writes no exclude file — the refusal is scoped to `local` mode only, unchanged from E239.
  proof: `test/e239-init-subdir-exclude.test.mjs` new case "AC18: backslash/control-character subdir name is fine under explicit repo mode"

- **AC6** — Given a workspace whose `.current/.config.json` declares `"artifacts": "local"` at a
  path with an AC1/AC2/AC3 unsafe segment (hand-authored, since `agc init` itself would have
  refused), when `agc check` runs, then it prints the one cannot-verify advisory (AC10's new
  message) naming the offending segment, does not attempt (and get wrong) the normal drift test, and
  still exits 0 — the same shape E239 established for the wildcard case, extended to the widened set.
  proof: sr-engineer confirms at implementation time (code reading, T-E243-03, no separate test of
  its own) that `checkArtifactsDrift`'s local-mode branch (~L1163) already reads the same widened
  `unsafeSegment` with no character-class logic of its own, so no code change beyond AC10's message
  text is needed; `test/e239-init-subdir-exclude.test.mjs` new case "AC19: agc check advises rather
  than mis-tests on a backslash/control-character path" (extends the existing AC13 case) proves it
  black-box.

- **AC7** — Given a workspace with an AC1/AC2/AC3 unsafe segment, when `agc eject` plans its
  host-trace entries, then `planExcludeEntry` treats it exactly as it already treats a wildcard
  segment: it returns no plan entry for `.git/info/exclude` (since `local` mode never had a chance
  to write rules there), with no crash and no false "removed" or "kept" claim — consistent with
  `init` and `agc check` because all three read the same `unsafeSegment` value.
  proof: sr-engineer confirms at implementation time (code reading, T-E243-03, no separate test of
  its own) that `planExcludeEntry`'s existing `if (ctx.workspace.unsafeSegment !== null) return
  null;` branch (~L3349) already covers the widened set with no code change; `test/e108-eject.test.mjs`
  new case covering a backslash-named workspace proves it black-box, asserting the eject plan/output
  matches the existing wildcard-named-workspace shape (no `.git/info/exclude` line among the plan
  entries)

- **AC8** — The widened character-class test exists in exactly one place — the predicate
  `repoRelativeWorkspacePrefix()` uses to compute `unsafeSegment` (today via the constant
  `GITIGNORE_WILDCARD_RE`) — and `init`'s refusal, `agc check`'s cannot-verify branch, and `agc
  eject`'s `planExcludeEntry` skip all read that same `unsafeSegment` value rather than re-testing
  the character class independently. This is an architectural constraint, not independently
  provable by one test; verified at code-review time by confirming no second character-class regex
  or hand-rolled test was introduced at any of the three call sites.

- **AC9** — The `init` local-mode refusal message (`bin/agc-init.mjs`, currently ~L520–525) no
  longer says "gitignore-wildcard character (one of \* ? \[ \])"; it names the broader class per the
  Copy / Strings table below, while still naming the offending segment and still exiting 2 before
  any write.
  proof: `grep -n 'unsafe for a gitignore exclude rule' bin/agc-init.mjs` matches the `init`
  refusal's template string, and `grep -n 'one of \* ? \[ \]' bin/agc-init.mjs` matches nothing

- **AC10** — The `agc check` cannot-verify advisory (currently ~L1163–1170) is rewritten the same
  way as AC9, per the Copy / Strings table below.
  proof: same `grep` pair as AC9, run against the `check` advisory's template string

- **AC11** — `docs/install.md`'s `--artifacts` passage (currently the sentence at line 150) no
  longer says "a gitignore wildcard character (\`\*\`, \`?\`, \`[\`, \`]\`)"; it is rewritten per the
  Copy / Strings table below, in the same one sentence, still with no ticket id.
  proof: `grep -n 'unsafe for a gitignore exclude rule' docs/install.md` matches; `grep -n
  'gitignore wildcard character' docs/install.md` matches nothing

- **AC12** — `test/e239-init-subdir-exclude.test.mjs`'s existing pinned message-text assertions
  (today's AC8 case ~L273 and AC13 case ~L385, both matching the literal substring `one of \* \? \[
  \]`) are updated to match the AC9/AC10 message text exactly, and continue to pass.
  proof: `npm test` — `test/e239-init-subdir-exclude.test.mjs`'s AC8 and AC13 cases pass

- **AC13** — Windows is not touched: `repoRelativeWorkspacePrefix()` splits `path.relative(...)` on
  `path.sep` before testing each segment for unsafe characters, and on `win32` `path.sep` is `\`
  itself — so a literal backslash can never survive inside a single segment there (it is always a
  separator, never a character to test), and no production-code change is needed for that platform.
  Every new test built on a directory name containing a raw backslash, CR, LF, or other control byte
  is POSIX-only (NTFS itself forbids embedding 0x00–0x1F in a filename, so the scenario cannot even
  be constructed on Windows) and is guarded to skip on `process.platform === "win32"`, following the
  existing skip-with-reason precedent in `test/e130-lane-default.test.mjs`.
  proof: sr-engineer confirms at implementation time (code reading, T-E243-03, no separate test of
  its own) that `repoRelativeWorkspacePrefix()`'s own `path.sep` split already makes this true with
  no win32-specific branch needed; `test/e239-init-subdir-exclude.test.mjs` and
  `test/e108-eject.test.mjs`'s new AC1/AC2/AC3/AC7 cases each carry a `process.platform === "win32"`
  skip guard with a stated reason, proving it black-box.

- **AC14** — Given a workspace path segment containing a C0 control character or DEL (e.g. CR, LF,
  or ESC 0x1B), when `agc init`'s refusal message or `agc check`'s cannot-verify advisory prints
  that segment, then the printed segment contains no raw control byte: each such byte appears in its
  escaped display form (the exact scheme is in Dependencies / Prerequisites below), not raw — so the
  one-line message can never be split by an embedded CR/LF, and can never inject a terminal control
  sequence such as ESC. A literal backslash in the segment is printed as-is (unescaped); gitignore
  wildcard characters are likewise printed as-is.
  proof: `test/e239-init-subdir-exclude.test.mjs` new case "AC20: message printed for a CR/LF/ESC
  segment contains no raw control byte" — for each of CR, LF, and ESC (0x1B), asserts the printed
  stderr contains no raw occurrence of that byte, only its escaped form

## Copy / Strings

| string id | exact text (quote verbatim; the two runtime messages' `<segment>` = the offending path segment **in its escaped display form per AC14**, not raw — see Dependencies / Prerequisites for the exact scheme; the `docs/install.md` sentence names no specific segment) | source |
|---|---|---|
| init.local.unsafe-segment-refusal | `agc init: refusing --artifacts=local — workspace path segment "<segment>" contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character), so the exclude rule agc would write could match unintended files or be split across lines. Rename the directory, or re-run with --artifacts=repo.` | authored-here — rewrites E239's `init.subdir.unsafe-refusal` (`specs/e239-init-subdir-exclude.md`) to describe the widened character class per this ticket's explicit requirement, instead of enumerating exactly `* ? [ ]`; keeps the same usage-error voice and exit-2 shape |
| check.local.unsafe-segment-advisory | `agc check — cannot verify artifacts drift: workspace path segment "<segment>" contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character) — rename the directory, or declare artifacts explicitly via agc init --artifacts=repo` | authored-here — rewrites E239's `check.subdir.unsafe-advisory` the same way; advisory only, never affects exit code |
| install.local.unsafe-segment-sentence | `When a directory name below the repo root in the workspace path contains a character unsafe for a gitignore exclude rule — a wildcard (`*`, `?`, `[`, `]`), a backslash (`\`), or a control character (including CR and LF) — `local` refuses to run (exit 2, nothing written) because the written rule could match unintended files or be split across lines, while `--artifacts=repo` works there as usual.` | authored-here — rewrites the AC14 sentence E239 added at `docs/install.md:150`, same one-sentence scope, no ticket id, per this ticket's requirement not to enumerate only four characters |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI-only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Escaping the unsafe characters instead of refusing (per integrator's fixed scope cut) — no
  attempt to write a correctly-escaped gitignore pattern for a backslash- or control-character-
  bearing segment. (Distinct from AC14: AC14's escaping is display-only, for the two printed
  messages, and exists alongside the refusal — it does not let `local` mode proceed.)
- E234's scan (per integrator's fixed scope cut) — not this lane's ticket.
- Any other `agc check` sub-check beyond the one cannot-verify advisory this spec touches.
- Any config schema change — no new `.current/.config.json` key, no `schema_version` bump.
- Any change to `agc eject`'s other plan classes (CLAUDE.md block, adapter files, host-trace
  entries other than the exclude line) — only `planExcludeEntry`'s existing `unsafeSegment` read is
  exercised by new coverage, not modified.
- Escaping/refusing on Windows — the backslash case cannot arise there (AC13); no Windows-specific
  code path is added.
- Renaming `GITIGNORE_WILDCARD_RE` is not mandated — sr-engineer may rename it to reflect the wider
  class (e.g. `GITIGNORE_UNSAFE_SEGMENT_RE`) or keep the name with an updated comment; either is
  fine as long as AC8's single-predicate constraint holds.

## Dependencies / Prerequisites
- Builds on `specs/e239-init-subdir-exclude.md` (shipped, lane `e108`) — reuses and widens its
  `repoRelativeWorkspacePrefix()` / `unsafeSegment` mechanism; does not re-litigate any of its
  settled decisions (anchor-follows-scaffold for subdirectories; refusal only for genuinely unsafe
  segments; `repo` mode never touches the exclude file).
- Direct basis: `review_reports/review_T-E239-01.md` finding F1, which named exactly this gap
  (backslash, plus "in the same pass... refuse control characters, CR and LF in particular") as a
  recommended follow-up.
- Implementation surface (`bin/agc-init.mjs`, exact naming at sr-engineer's discretion, behavior
  below is load-bearing):
  - Widen the character-class test the constant near `GITIGNORE_WILDCARD_RE` (~L1293) implements —
    from `/[*?[\]]/` to a class additionally matching a literal backslash and the C0 control range
    plus DEL (e.g. `/[*?[\]\\\x00-\x1f\x7f]/`) — used by `repoRelativeWorkspacePrefix()` (~L1304) to
    compute `unsafeSegment`. This is the one place to change; `init`'s refusal (~L520), `agc
    check`'s cannot-verify branch (~L1163), and `agc eject`'s `planExcludeEntry` (~L3349) each
    already read `workspace.unsafeSegment`/`ctx.workspace.unsafeSegment` and need no separate
    character-class logic of their own — only their message strings change (AC9/AC10), and
    `planExcludeEntry`'s existing `if (ctx.workspace.unsafeSegment !== null) return null;` branch
    (~L3349) needs no code change at all, only the new test coverage AC7 asks for.
  - Rewrite the two message template strings per the Copy / Strings table (AC9, AC10).
  - Rewrite the one `docs/install.md:150` sentence per the Copy / Strings table (AC11).
  - **Display-escaping helper (AC14)**: add a small pure function (naming at sr-engineer's
    discretion, e.g. `escapeSegmentForDisplay(segment)`) applied ONLY to the copy of `<segment>`
    interpolated into the two message strings (AC9, AC10) — never to the `unsafeSegment` value
    itself, which stays raw for every logic use (equality tests against the actual path, the eject
    rule reconstruction, etc.). Exact scheme, byte by byte:
    - LF (0x0A) → `\n`; CR (0x0D) → `\r`; TAB (0x09) → `\t` (familiar two-character escapes).
    - Every other C0 control byte (0x01–0x08, 0x0B–0x0C, 0x0E–0x1F) and DEL (0x7F) → `\xHH`, lowercase
      two-digit hex (e.g. ESC 0x1B → `\x1b`, BEL 0x07 → `\x07`, DEL → `\x7f`).
    - A literal backslash (`\`) in the segment is left as-is — NOT doubled to `\\` — since the goal
      is a readable, non-raw-control-byte message, not a round-trippable encoding.
    - Gitignore wildcard characters (`* ? [ ]`) are left as-is; they were already safe to print
      (E239's original messages already did).
  - sr-engineer confirms (code reading only, no test of its own) that `agc check`'s cannot-verify
    branch (AC6), `agc eject`'s `planExcludeEntry` skip (AC7), and the win32 path-sep behavior
    (AC13) already hold with no further code change beyond the message rewrites above; qa's tests
    (T-E243-04) prove each black-box.
- **Test-ownership note** (`docs/lane-protocol.md` §3, constitution §2): only qa-engineer may touch
  `test/`. sr-engineer implements AC1–AC11 and AC14 without touching any test file (its AC6/AC7/AC13
  contribution is a code-level confirmation recorded in its own hop, not a test); qa-engineer owns
  AC6/AC7/AC12/AC13/AC14's black-box test coverage in `test/e239-init-subdir-exclude.test.mjs` and
  the new case in `test/e108-eject.test.mjs`.
- **Repro discipline (feature mode, qa-owned — same pattern E239 itself used, see
  `specs/e239-init-subdir-exclude.md`'s "Repro (feature mode, qa-owned)" note)**: qa-engineer first
  runs the new AC1/AC2/AC3/AC7 scenarios against the lane's base commit (3663b3a) and records them
  red in its evidence — proving the gap this ticket closes actually existed — before running them
  against the fix.
- `dispatch_mode: "feature"` (not bugfix): this is a same-file, same-class generalization of an
  existing predicate and two message strings, no new data model, no cross-cutting API — the same
  shape and reasoning E239 itself used to route directly to sr-engineer with `dispatch_mode:
  "feature"`, skipping architect and design-auditor.
- Resource Audit Gate: zero external references found load-bearing to this ticket's own
  requirements (no URLs, Figma/Sketch/mockup links, or external ticket refs beyond the in-repo
  `docs/backlog.md` E243 row, `specs/fanout-e243-e248.md`, and `review_reports/review_T-E239-01.md`
  already read) — `external_refs` omitted from the routing write.
