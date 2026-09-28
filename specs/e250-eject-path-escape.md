# e250-eject-path-escape

## Problem Statement

`agc eject` prints workspace and repo-relative paths raw into its plan
header, every plan entry line, the "tracked file(s) changed" list, and two
stderr blocks (the tracked-artifacts notice and the "cannot do" block's
`~/.claude/agents` listing). E243 taught `agc init`/`agc check` to show an
unsafe path segment with visible escapes (`escapeSegmentForDisplay()`) so a
CR/LF/ESC byte in a directory name can't split a message across lines or
reach the terminal raw — but `agc eject` is a further-out surface E243 never
touched, and a workspace or linked-worktree directory name containing such a
byte still splits or injects into `eject`'s plan output today. This ticket
closes that surface: every path `agc eject` prints gets the same visible
escaping, while the paths it actually operates on (delete, `atomicWriteFile`,
the literal `git rm -r` targets) stay byte-for-byte unchanged — escaping is a
display-time transform only, never a logic change. It also folds in E251, an
unrelated one-line documentation gap (`AGC_HYGIENE_KEYWORDS` is missing from
the `docs/config.md` env-var table) that the same lane picked up in fan-out.

## User Stories

- As an operator running `agc eject` against a workspace whose path (or a
  linked worktree's path) contains a control character, I want the plan
  output to stay on the lines and characters I expect, so that a hostile or
  accidental directory name can't corrupt my terminal or hide part of the
  plan.
- As an operator reading `agc eject`'s stderr `git rm -r …` / `rm …`
  paste-me lines, I want a command I can actually run, not one that silently
  refers to a different path than the one on disk, so that copying it never
  does the wrong thing.
- As a reader of `docs/config.md`'s "Env-var overrides" table, I want
  `AGC_HYGIENE_KEYWORDS` listed there like every other env var, so that I
  don't have to already know about the hygiene-scan prose elsewhere in the
  file to find it.

## Acceptance Criteria

Shared fixture note: "a control character" below means a byte in
`escapeSegmentForDisplay()`'s existing class (C0 control range 0x00–0x1F or
DEL 0x7F) — LF, CR and ESC are the three the ticket calls out by name and
MUST each be covered by at least one test in `test/e250-eject-path-escape.test.mjs`
(they exercise the two escape forms: LF/CR/TAB have a named `\n`/`\r`/`\t`
form, every other byte including ESC gets the generic `\xHH` form). Every AC
below except AC12 (E251) is a repro built around a workspace subdirectory
name, a linked-worktree directory name, or a `$HOME` directory name carrying
one or more of these bytes — real directories on disk, created the same way
`test/e108-eject.test.mjs`'s existing E243 case does (skipped on win32,
where a literal backslash/most control bytes can't survive in a path
segment — mirror that file's skip guard).

- **AC1** — Given a workspace whose path contains a control character (LF,
  CR or ESC), when `agc eject` (dry-run) runs there, then the plan header
  (`agc eject — plan for <cwd> …`) shows the escaped form of `<cwd>` and is
  a single line — the control byte never reaches stdout raw.
  proof: `test/e250-eject-path-escape.test.mjs` "AC1"
- **AC2** — Given the same workspace, when `agc eject --yes` runs, then the
  `agc eject — applying to <cwd>:` header is escaped the same way.
  proof: `test/e250-eject-path-escape.test.mjs` "AC2"
- **AC3** — Given a **subdirectory** workspace whose repo-relative prefix
  contains a control character, when `agc eject` runs, then every
  `(iii) host traces — <display>` label (CLAUDE.md, AGENTS.md,
  .antigravityrules, `.git/info/exclude` is prefix-independent so is
  covered by AC1/AC2 instead) shows the escaped prefix, and the
  `(i)`/`(ii-a)`/`(ii-b)` class lines (`ejectPathClasses` entries) show the
  escaped `display` the same way.
  proof: `test/e250-eject-path-escape.test.mjs` "AC3"
- **AC4** — Given the AC3 workspace with a host-trace file actually changed
  (e.g. CLAUDE.md holding user prose, so the block-removal edits it in
  place), when `agc eject --yes` runs, then the "Tracked host-trace file(s)
  were changed…" list (and, on a dry-run, the "will change tracked file(s)"
  list) shows the escaped display path, not the raw one.
  proof: `test/e250-eject-path-escape.test.mjs` "AC4"
- **AC5** — Given a tracked artifact path (e.g. `tasks.md`) under a
  control-character-bearing prefix, when `agc eject` runs, then the stderr
  "The following are tracked and were left untouched…" list shows the
  escaped display path for that entry.
  proof: `test/e250-eject-path-escape.test.mjs` "AC5"
- **AC6** — Given the AC5 setup, when `agc eject` runs, then the paste-me
  `git rm -r <targets>` line is **not printed**; in its place a single line
  reading exactly `note: one or more of the path(s) above contain a control
  character and cannot be pasted into a command safely — remove it by
  hand.` is printed, and the trailing `Note: history still contains these
  files after that command.` line is still printed. Reason: the escaped
  display no longer names the real file, and re-embedding the raw control
  byte into a copy-paste command would just relocate the injection risk
  into whatever shell or terminal runs it — the command is not printable
  and functional at the same time, so it is omitted rather than either
  broken or unsafe.
  proof: `test/e250-eject-path-escape.test.mjs` "AC6"
- **AC7** — Given the *ordinary* AC5/AC6 fixture with no control character
  anywhere in the tracked paths (i.e. today's `test/e108-eject.test.mjs`
  AC3/AC4/AC5/AC7c/AC9-region fixtures), the stderr block's text — the
  tracked-path list, the `git rm -r <targets>` line and the trailing
  `Note:` line — is byte-for-byte identical to the current output; `git rm
  -r`'s target list is unaffected by this ticket regardless.
  proof: `npm test -- test/e108-eject.test.mjs` (unmodified) plus
  `test/e250-eject-path-escape.test.mjs` "AC7"
- **AC8** — Given a linked worktree whose directory name contains a control
  character, when `agc eject` (dry-run, primary checkout) runs, then the
  stderr `warning: linked worktree(s) still exist…` list shows the escaped
  path. Decision: in scope. The linked-worktree list is a path echo of the
  exact same class as the workspace/host-trace paths above — a
  worktree directory name is user-controlled the same way a workspace
  directory name is, and leaving it raw would just move the injection one
  line down inside the same command's output; the fix is the same one-line
  reuse of the escaping helper, so there is no reason to leave it out.
  proof: `test/e250-eject-path-escape.test.mjs` "AC8"
- **AC9** — Given the AC8 setup, when `agc eject --yes` runs (refusal path:
  `--yes` always refuses while a linked worktree exists), then the thrown
  refusal message's linked-worktree list is escaped the same way, and the
  refusal still happens before any plan is printed (unchanged from today).
  proof: `test/e250-eject-path-escape.test.mjs` "AC9"
- **AC10** — Given `$HOME/.claude/agents/` contains an installed agent
  template file whose **directory path** (not the filename — filenames are
  matched against the shipped template list and are never attacker-chosen)
  contains a control character, when `agc eject` runs, then the "cannot do"
  block's item 4 listing shows the escaped path for each present file.
  Decision: in scope, same reasoning as AC8 — it is still a path `agc
  eject` prints, sourced from `$HOME`, which is exactly as much
  operator/environment-controlled as a workspace or worktree path.
  proof: `test/e250-eject-path-escape.test.mjs` "AC10"
- **AC11** — Given the AC10 setup, the `rm <paths>` line under item 4 is
  **not printed**; in its place, the single `note: one or more of the
  path(s) above contain a control character and cannot be pasted into a
  command safely — remove it by hand.` line is printed (same string as
  AC6 — one shared string, two call sites). The ordinary case (today's
  "(none)" filler, and a normal populated listing with no control
  character) is byte-for-byte identical to current output, including the
  `rm <paths>` line.
  proof: `test/e250-eject-path-escape.test.mjs` "AC11"
- **AC12** (E251) — Given `docs/config.md`'s "Env-var overrides" table
  (the same table `docs/install.md`'s "Env-var overrides" section links
  readers to), when the table is read, then it has one additional row
  naming `AGC_HYGIENE_KEYWORDS`, saying it names the keyword-list file the
  advisory `agc check` information-hygiene scan reads, and linking to
  `docs/install.md`'s "Keeping governance artifacts out of git" section —
  reusing the exact anchor `docs/config.md` already uses elsewhere
  (`install.md#keeping-governance-artifacts-out-of-git-agc-init---artifactslocalrepo`,
  see line 29) rather than inventing a new one.
  proof: `grep -n "AGC_HYGIENE_KEYWORDS" docs/config.md` shows one row in
  the Env-var overrides table with that anchor.
- **AC13** — Ordinary-path regression: `test/e108-eject.test.mjs` (owned by
  no lane task — read-only per this lane's brief) passes unmodified, proving
  every existing ordinary-path assertion (plan header wording, entry
  labels, the `git rm -r` line, the cannot-do block) is untouched by this
  change.
  proof: `npm test -- test/e108-eject.test.mjs`
- **AC14** — Operated-paths-unchanged: for every repro above that reaches
  `--yes`, the actual filesystem effect (file deleted/edited, exclude line
  removed, tracked paths left untouched) is identical to what the
  equivalent ordinary-path case produces — escaping is display-only and
  never changes what `runEject` deletes, edits, or lists as a `git rm -r`
  target internally (the target list itself, as opposed to its printed
  form, is addressed by AC6/AC11's "not printed" behavior, not a changed
  target).
  proof: `test/e250-eject-path-escape.test.mjs` (assertions embedded in the
  AC1/AC3/AC4/AC5 test cases — no separate test name)

## AC → Task

| AC | implementing task | test task |
|---|---|---|
| AC1–AC3 | T-E250-01 | T-E250-06 |
| AC4–AC7 | T-E250-02 | T-E250-06 |
| AC8–AC9 | T-E250-03 | T-E250-06 |
| AC10–AC11 | T-E250-04 | T-E250-06 |
| AC12 | T-E250-05 | — (grep proof) |
| AC13–AC14 | T-E250-01..04 | T-E250-06 |

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| control-char-manual-removal-note | `note: one or more of the path(s) above contain a control character and cannot be pasted into a command safely — remove it by hand.` | authored-here — replaces the `git rm -r …` / `rm …` paste-me line only when a target/path in that list contains a control character (AC6, AC11); the surrounding lines (intro sentence, trailing `Note:` line) are unchanged existing copy |
| AGC_HYGIENE_KEYWORDS row (purpose cell) | `Names the keyword-list file the advisory \`agc check\` information-hygiene scan reads for the \`keyword\` category. See [docs/install.md](install.md#keeping-governance-artifacts-out-of-git-agc-init---artifactslocalrepo).` | authored-here — mirrors the existing row style in the same table (see `docs/config.md`'s current Env-var overrides rows); anchor reused verbatim from `docs/config.md` line 29's existing link to the same section |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI stdout/stderr text only, no design source) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any other `agc init` / `agc check` / `agc feature` message that echoes a
  `cwd` or a path (per the fan-out manifest's explicit exclusion). If found
  during implementation or QA, record it as a `pending-ticket` block in
  `.current/e250/pending-tickets.md` per lane-protocol §4 — do not fix it
  here.
- Any change to `agc eject`'s actual plan/behavior (what gets deleted,
  edited, kept, or listed as a `git rm -r` target) — this ticket only
  changes how paths are *displayed*.
- `tools/**` (import-only; `escapeForDisplay()` in `tools/hygiene-scan.ts`
  is not reused or modified — `bin/agc-init.mjs` already has its own
  equivalent, `escapeSegmentForDisplay()`, reused as-is for whole-path
  strings, not only single segments — its existing implementation already
  operates on the whole input string with no assumption of a single
  segment, so no new escaping primitive is needed).
- Widening the *refusal* class E243 already owns (`GITIGNORE_UNSAFE_SEGMENT_RE`)
  or touching `agc init --artifacts=local`'s refusal logic — out of scope,
  unrelated to display.

## Dependencies / Prerequisites

- Builds on E243's `escapeSegmentForDisplay()` (`bin/agc-init.mjs` ~line
  1336) — reused as-is, not modified, except that its doc comment may be
  updated by sr-engineer to note it is also used on whole display paths
  (comment-only change, not a behavior change).
- E243 and E234 are both shipped on `main` (`3c20ed1`); this lane forks
  from that commit per `specs/fanout-e250.md`.
- No external references (URLs, Figma/Sketch links, tracker links) were
  found in the requirement documents for E250 or E251 — Resource Audit
  Gate clear, `external_refs` omitted.
- No `design/<feature>.md` exists for this feature (backend CLI output,
  no visual surface) — Scope Decision Gate and Visual Structural
  Assertions are both not triggered; `scope_decision: "single-feature"` is
  set anyway per this lane's dispatch instructions (one lane, two related
  tickets, already fan-out-approved together in `specs/fanout-e250.md`).
