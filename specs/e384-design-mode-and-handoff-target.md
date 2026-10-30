# e384-design-mode-and-handoff-target — E384 + E386 + E346

Lane `e384`, post-v4 wave 13 (`specs/fanout-post-v4-w13.md`). Branch `feat/e384-design-mode-and-handoff-target`, dispatch base `35f20e2`. Three small tool fixes in one lane: `parseDesignMode` in `gates/visual.ts` (E384), and two fixes to `handoff --check` in `tools/fanout-handoff.ts`: the default target branch (E386) and the sister-repo root check (E346, merged into this lane by human ruling). The plan is one sr-engineer pass, one code-review round and one qa round.

## Decisions

| date | who | decision | rationale |
|---|---|---|---|
| 2026-10-30 | pm | **E384: a declared Mode value that is not a known mode is treated as undeclared** (`parseDesignMode` gives no mode for that candidate line). It is **not** a loud error. | (1) Undeclared is what the parser already does for an unknown value with no known mode word on its line: `mode: freehand` returns `null`, pinned by `test/visual-evidence-gate.test.mjs` ("a Mode line naming no known mode still returns mode null"). The fix removes only the dependence on the explanatory text, so `code (not from Figma)` and `freehand` now behave the same. (2) Neither caller can carry a loud error. `hasDesignModeRequiringVisual` wraps the parse in `try/catch` and returns `required:false`, so a thrown error would be swallowed and end up undeclared anyway. That helper is also called by `prompts/build.ts`, which must never throw. `checkSourceCredibility` calls the parser outside any `try`, so a throw would escape the `tw_update_state` pipeline as an uncaught exception instead of a structured gate error. (3) A structured loud error needs an error code. A new code means a new `GATE_REGISTRY` entry, which this lane may not add. Reusing an existing code, for example `SOURCE_CREDIBILITY_UNVERIFIED`, would mislabel the failure, and that mislabel is the very bug E384 reports. |
| 2026-10-30 | pm | E384 does **not** require adding `code` to the design-auditor Mode list (`content/skill-design-auditor.md`). No STOP is needed. | The fix is about how the parser reads any unknown value, not about `code` in particular. With the fix, `code` is read as undeclared, the same as every other value outside the list. Whether `code` should become a known mode that arms the visual gates is a separate product question and is out of scope (see Out of Scope). |
| 2026-10-30 | pm | E384 keeps per-candidate fallthrough. The parser reads up to two candidate lines: the inline `mode:` / `**Mode** —` line, then the `## Mode` H2 value line. An unknown declared value on the inline line makes that line yield no mode, and the H2 line is still consulted, as today. | Today a candidate line with no known mode already falls through to the next candidate. An unrelated inline match such as `- mode: dark` must not hide a real `## Mode` / `figma` declaration. |
| 2026-10-30 | pm | E384 keeps the pre-E384 earliest-known-mode scan only when a candidate line has **no declared value at all**, meaning that after the leading markdown wrappers are stripped, the line does not start with a letter. | That is the backlog's own wording of the fix ("only fall back to scanning when it is not a value at all"). It keeps unusual but valid forms working, such as `mode: <figma>`. An unknown declared value is never scanned past. |
| 2026-10-30 | pm | E386: only `handoff --check` reads the recorded target. `handoff` (generate) and `handoff --closing` keep the `main` default, but get the new error message. | The ticket and the manifest scope name `--check`. Generate mode writes the section and does not read one, so there is nothing recorded for it to use. |
| 2026-10-30 | pm | **`checkLane` `--base` default: it should change.** Recorded as finding `E386-NEW-1` in `.current/e384/pending-tickets.md`. No code change here, because `tools/fanout-manifest.ts` is forbidden to this lane. | `checkLane` defaults to `opts.base ?? "main"`. In a repo with no `main` branch, `check <manifest> <lane>` fails `REF_NOT_FOUND` with `base ref "main" does not resolve …` until `--base` is passed. That is the same defect class as E386, and the message does not name the `--base` flag. The manifest headers do not fix it. The `base:` sha is the planning base: it can predate the dispatch base, and `base...branch` would then list main's own later merges as OUT. After the integration branch has merged the lane, `integ...branch` is empty (`RANGE_EMPTY`). A default that follows the E386 rule (the recorded target, else `main`) would make `check` and `handoff --check` agree, and the message should name `--base`. |
| 2026-10-30 | pm | E346: when `git rev-parse --show-toplevel` fails in the declared root (a bare repository, or a path inside a `.git` directory), the check falls back to today's `rev-parse --git-dir` test. | The ticket targets one case only: a plain directory nested in another repo's working tree. Keeping the fallback leaves every other input, and its error code and exit code, as it is today. |

## Problem Statement

E384: in `gates/visual.ts`, `parseDesignMode` returns the earliest known mode word found anywhere on the Mode line. A design declared `code`, a value outside the known list, and the explanatory text on the same line mentioned Figma. The parser returned `figma`, and the build hop was then wrongly rejected with `SOURCE_CREDIBILITY_UNVERIFIED`. E319 fixed the case of two known modes on one line, but not an unknown declared value.

E386: `handoff --check` defaults its target to `main` (`opts.target ?? "main"`). In a repo whose integration target has another name, it fails with exit 2 `REF_NOT_FOUND`, even though the manifest's `### 核對 primary` section already records the target branch (`- 目標分支：<branch> @ <sha>`).

E346: the sister-repo check under `## 外部依賴` tests `git rev-parse --git-dir`, and that also succeeds for a plain directory nested in another repo's working tree. The branch sha is then read from the enclosing repo.

## User Stories

- As a design-auditor writing `**Mode** — code (screenshots, not Figma)`, I want the declared value to decide the mode, so that the explanatory text cannot arm a Figma-only gate.
- As an integrator taking over a wave in a repo without `main`, I want `handoff --check <manifest>` to compare against the target branch the manifest recorded, so that a valid handoff is not reported as broken.
- As an integrator whose `sisterRepos` entry points at the wrong directory, I want `handoff --check` to say that the sister repo is not a git repository, so that it never reports another repo's branch sha as the sister's.

## Acceptance Criteria

`checkSourceCredibility` and `hasDesignModeRequiringVisual` are the exported entry points over the unexported `parseDesignMode`. Every E384 AC asserts through both of them.

### E384 — declared Mode value wins

- **AC-E384-1** — Given a design file whose Mode line is `- **Mode** — code (not from Figma)`, plus a `## Source` table with an audited `figma` row that lacks `full-page-composite`, when `checkSourceCredibility` and `hasDesignModeRequiringVisual` run, then both report `mode: null`, the credibility check returns `ok: true`, and the arm check returns `required: false`. The same holds for the inline form `mode: code — screenshots, not Figma`.
  proof: `node --test test/e384-design-mode-declared.test.mjs` green (the declared-`code` / Figma-explanation cases).
- **AC-E384-2** — Given the H2 form `## Mode` followed by the value line `code (no Figma export)`, when both entry points run, then the mode is `null`.
  proof: `node --test test/e384-design-mode-declared.test.mjs`.
- **AC-E384-3** — The declared value is read like this:
  - Strip the leading whitespace and the wrapper characters `` ` `` `*` `_` `"` `'` `(` `[`.
  - The declared token is the leading `[a-z][a-z0-9]*(?:-[a-z0-9]+)*`, matched case-insensitively and lowercased.
  - The token is compared whole with the known modes. For example, `` `figma` ``, `**sketch**`, `MODE: SKETCH`, `(xd)` and `"pdf"` resolve to `figma`, `sketch`, `sketch`, `xd` and `pdf`.
  - A hyphen-joined unknown token such as `figma-export` is unknown and gives `null`. It does not give `figma`.
  proof: `node --test test/e384-design-mode-declared.test.mjs`.
- **AC-E384-4** (E319 unchanged) — Given the existing E319 cases (`image (no Figma)`, `no-design (no Figma)`, `paper / figma`, `` `pdf` — exported from Figma ``, `freehand`), when the existing suites run **unmodified**, then they pass.
  proof: `node --test test/source-credibility-gate.test.mjs test/visual-evidence-gate.test.mjs` green; `git diff --quiet 35f20e2...HEAD -- test/source-credibility-gate.test.mjs test/visual-evidence-gate.test.mjs; echo "exit=$?"` prints `exit=0`.
- **AC-E384-5** (no declared value → pre-E384 scan) — Given the Mode line `mode: <figma> (see board)`, when both entry points run, then the mode is `figma`. The line does not start with a letter after the wrappers are stripped, so the earliest-known-mode scan applies.
  proof: `node --test test/e384-design-mode-declared.test.mjs`.
- **AC-E384-6** (candidate fallthrough) — Given a design file with `## Mode` / `figma` and, later, a bullet `- mode: dark`, when both entry points run, then the mode is `figma`. The inline candidate declares an unknown value and yields nothing, and the H2 candidate is consulted next.
  proof: `node --test test/e384-design-mode-declared.test.mjs`.
- **AC-E384-7** (containment) — `KNOWN_MODES`, `FETCH_BASED_MODES`, `GATE_REGISTRY`, every other function in `gates/visual.ts` and `content/**` are unchanged.
  proof: `git diff --quiet 35f20e2...HEAD -- gates/registry.ts content schema; echo "exit=$?"` prints `exit=0`. The code reviewer confirms that the `gates/visual.ts` hunks are confined to `parseDesignMode` and the doc comment directly above it.

### E386 — `handoff --check` uses the recorded target

- **AC-E386-1** — Given a temp primary whose only branch is `develop` (no `main`), and a manifest whose `## 接手步驟` section was generated with `handoff <manifest> --target develop` and pasted, when `handoff --check <manifest>` runs without `--target`, then it exits 0, reports `0 differ`, and prints no `REF_NOT_FOUND`.
  proof: `node --test test/e386-handoff-recorded-target.test.mjs`.
- **AC-E386-2** — Given AC-E386-1's setup, after one more commit on `develop`, when `handoff --check <manifest>` runs without `--target`, then the `目標分支` line is `MOVED … （前進 1 個 commit）` and the exit code is 0.
  proof: `node --test test/e386-handoff-recorded-target.test.mjs`.
- **AC-E386-3** (none recorded → `main`, as today) — Given a section without a `目標分支` fact line, or one whose value does not match `<branch> @ <sha>` (for example `<待填：…>`), when `--check` runs without `--target` in a repo with `main`, then the facts use `main` exactly as before. In a repo without `main`, it exits 2 with `REF_NOT_FOUND` and copy `err.target-default`.
  proof: `node --test test/e386-handoff-recorded-target.test.mjs`.
- **AC-E386-4** — Given a recorded `目標分支：gone-branch @ <sha7>` where `gone-branch` does not resolve, when `--check` runs without `--target`, then it exits 2 with `REF_NOT_FOUND` and copy `err.target-recorded`. The copy names the branch and `--target`.
  proof: `node --test test/e386-handoff-recorded-target.test.mjs`.
- **AC-E386-5** (explicit `--target` unchanged) — Given a recorded `develop`, when `--check <manifest> --target <other>` runs, then the facts use `<other>`, as today. An unresolvable explicit `--target` gives exit 2 `REF_NOT_FOUND` with the message byte-identical to the base: `--target "<x>" does not resolve to a commit (git rev-parse --verify)`.
  proof: `node --test test/e386-handoff-recorded-target.test.mjs test/e284-fanout-handoff.test.mjs`.
- **AC-E386-6** (generate unchanged except message) — Given `handoff <manifest>` (generate, with or without `--closing`) and no `--target`, the target is `main`, as today. When `main` does not resolve, it exits 2 `REF_NOT_FOUND` with copy `err.target-default`.
  proof: `node --test test/e386-handoff-recorded-target.test.mjs`.
- **AC-E386-7** — The existing handoff suites pass unmodified.
  proof: `node --test test/e284-fanout-handoff.test.mjs test/e285-integrator-session-handoff.test.mjs test/e283-validate-handoff.test.mjs test/e292-handoff-sister-sha.test.mjs test/e339-non-ascii-manifest.test.mjs` green.

### E346 — sister root must be a repo top level

- **AC-E346-1** — Given a `sisterRepos` entry whose path is a plain directory nested inside another repo's working tree (a subdirectory of a temp git repo, with no `.git` of its own), and a `## 外部依賴` row for it, when `handoff --check` runs, then it exits 2 with `SISTER_REPO_NOT_GIT` and the existing copy `err.sister-not-git`. The message echoes no path.
  proof: `node --test test/e346-sister-nested-dir.test.mjs`.
- **AC-E346-2** — Given an entry whose path is a subdirectory of the sister repo itself (not its root), when `--check` runs, then it gives the same `SISTER_REPO_NOT_GIT` rejection.
  proof: `node --test test/e346-sister-nested-dir.test.mjs`.
- **AC-E346-3** — Given an entry whose path reaches the sister repo's root through a symlink, or whose root is a linked git worktree, when `--check` runs, then it is accepted. The comparison is between the realpaths of `rev-parse --show-toplevel` and the declared root.
  proof: `node --test test/e346-sister-nested-dir.test.mjs`.
- **AC-E346-4** — The existing `test/e292-handoff-sister-sha.test.mjs` passes unmodified. In particular, the missing-directory and plain-directory cases keep their codes and messages.
  proof: `node --test test/e292-handoff-sister-sha.test.mjs`.

### Lane-level

- **AC-L1** — The lane's committed changes are inside the e384 `擁有` set.
  proof: `node scripts/fanout.mjs check specs/fanout-post-v4-w13.md e384 --base 35f20e2` exits 0.
- **AC-L2** — `tools/fanout-manifest.ts`, `GATE_REGISTRY`, the schema and `content/**` are untouched, and there is no `schema_version` bump.
  proof: `git diff --quiet 35f20e2...HEAD -- tools/fanout-manifest.ts gates/registry.ts schema content package.json; echo "exit=$?"` prints `exit=0`.
- **AC-L3** — The full suite is green on the final committed HEAD with a clean worktree.
  proof: `node scripts/test-lock.mjs -- npm test`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| err.target-recorded | `target branch "<branch>" recorded in the manifest (目標分支 under ### 核對 primary) does not resolve to a commit (git rev-parse --verify) — pass --target <branch> to check against another branch` | authored-here — E386 asks for a message that names `--target`; it also says where the target came from |
| err.target-default | `default target "main" does not resolve to a commit (git rev-parse --verify) and the manifest records no target branch (目標分支 under ### 核對 primary) — pass --target <branch>` | authored-here — E386; the case the adopter hit (a repo with no `main`) |
| err.target-flag | `--target "<x>" does not resolve to a commit (git rev-parse --verify)` (unchanged) | existing (`tools/fanout-handoff.ts` at base) |
| err.sister-not-git | `SISTER_REPO_NOT_GIT: sister repo "<name>" (sisterRepos in .current/.config.json) is not a git repository at its declared path` (unchanged, reused) | `specs/e292-sister-repos.md` Copy table |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Adding `code`, or any other value, to the known Mode list or to the design-auditor SOP (`content/**` is forbidden to this lane). Whether an implementation-as-source mode should arm the visual gates is a separate product question.
- Any change to `tools/fanout-manifest.ts`, including `checkLane`'s `--base` default (filed as `E386-NEW-1`).
- E345 (the long header comment in `tools/fanout-handoff.ts`).
- Reading the recorded target in `handoff` generate or `--closing` mode.
- Bare-repository or in-`.git` sister paths. These keep today's `--git-dir` behaviour.

## Dependencies / Prerequisites

None. There is no `design/<feature>.md` (mode = no-design), so the Visual Structural Assertions are omitted. There are zero external references: every reference is an in-repo file or backlog row (Resource Audit: the grep found no URL, Figma link or external ticket), so `external_refs` is `[]`. No clarifications are needed: the integrator's brief fixed the scope, and the one option choice (E384) is decided in Decisions with its reasoning.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E384-01 | sr (E384): in `gates/visual.ts`, rewrite `parseDesignMode` so that for each candidate line it reads the declared token (strip `` ` * _ " ' ( [ `` and whitespace, then the leading `[a-z][a-z0-9]*(?:-[a-z0-9]+)*`, lowercased). A known token → return it. An unknown token → this candidate yields nothing, continue to the next candidate. No token (the line does not start with a letter) → the existing earliest-known-mode scan. Update the doc comment above `KNOWN_MODES`. `KNOWN_MODES`, the two regexes and every other function stay unchanged. Rebuild `dist/`. About 40 lines | none | 1 (+dist) | `gates/visual.ts`、`dist/gates/visual.*` | — |
| T-E386-01 | sr (E386): in `tools/fanout-handoff.ts` `runHandoff`, when `--check` is given without `--target`, take the target from the written `目標分支` fact (`TARGET_FACT_RE` group 1); fall back to `main` when it is absent or unparseable. Add an optional `targetSource: "flag" \| "manifest" \| "default"` to `HandoffOptions`, and pick the `REF_NOT_FOUND` copy in `collectFacts` by source (`err.target-flag` stays byte-identical). Update the `target` doc comment. Rebuild `dist/`. About 40 lines | none | 1 (+dist) | `tools/fanout-handoff.ts`、`dist/tools/fanout-handoff.*` | — |
| T-E346-01 | sr (E346): in `compareExternalDeps`, accept a sister root only when the realpath (`realOrResolved`) of `git rev-parse --show-toplevel` run there equals the realpath of the declared root. When `--show-toplevel` throws, fall back to today's `--git-dir` test. A mismatch goes down the existing `SISTER_REPO_NOT_GIT` path (same message, no path echoed). Rebuild `dist/`. About 20 lines | T-E386-01 | 1 (+dist) | `tools/fanout-handoff.ts`、`dist/tools/fanout-handoff.*` | — |
| T-E384-02 | qa (E384): new `test/e384-design-mode-declared.test.mjs` for AC-E384-1..3, 5 and 6, through `checkSourceCredibility` and `hasDesignModeRequiringVisual` in temp workspaces. It includes the required case: declared `code`, with an explanation that contains Figma | T-E384-01 | 1 | `test/e384-design-mode-declared.test.mjs` | — |
| T-E386-02 | qa (E386): new `test/e386-handoff-recorded-target.test.mjs` for AC-E386-1..6, using a temp primary with no `main` (only `develop`) and in-test manifests. Assert nothing about the real `specs/fanout-*.md` | T-E386-01 | 1 | `test/e386-handoff-recorded-target.test.mjs` | — |
| T-E346-02 | qa (E346): new `test/e346-sister-nested-dir.test.mjs` for AC-E346-1..3: a nested plain-directory fixture, a sister-subdirectory fixture, and symlinked-root and linked-worktree acceptance | T-E346-01 | 1 | `test/e346-sister-nested-dir.test.mjs` | — |
| T-E384-03 | qa (lane verification, all three tickets): on the final committed HEAD with a clean worktree, run AC-E384-4, AC-E384-7, AC-E386-7, AC-E346-4 and AC-L1..L3, with the full suite under `node scripts/test-lock.mjs -- npm test`. No re-pins are expected. The regression files stay unmodified: `test/source-credibility-gate.test.mjs`, `test/visual-evidence-gate.test.mjs`, `test/e284-fanout-handoff.test.mjs`, `test/e285-integrator-session-handoff.test.mjs`, `test/e283-validate-handoff.test.mjs`, `test/e292-handoff-sister-sha.test.mjs`, `test/e339-non-ascii-manifest.test.mjs`. If one of the owned files among them needs a re-pin, that is a finding to report, not a silent edit | T-E384-02, T-E386-02, T-E346-02 | 0 | — | — |

## Re-pin survey

Grep at base `35f20e2`. Every Mode line in `test/**` starts with a known mode token, or has no Mode line at all, so the E384 rule changes no existing assertion. Every `handoff --check` fixture records `目標分支：main @ …`, so E386 changes no existing assertion. Of the `REF_NOT_FOUND` assertions, only `test/e284-fanout-handoff.test.mjs:265` covers handoff, and it matches the code prefix of an explicit `--target`, which keeps a byte-identical message. Every sister plain-directory fixture in `test/e292-handoff-sister-sha.test.mjs` sits under the OS temp dir, outside any repo. The sr-engineer pass is three tasks, each well under the 5-file / 300-line budget.

## Findings filed

Recorded in `.current/e384/pending-tickets.md`:

- `E386-NEW-1`: `fanout.mjs check <manifest> <lane>` defaults `--base` to `main`, so it fails `REF_NOT_FOUND` in a repo without `main`, and the message does not name `--base`. Proposed fix: use the same resolution order as E386 and name `--base` in the message (see Decisions).
