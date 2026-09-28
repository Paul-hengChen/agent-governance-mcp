# e239-init-subdir-exclude

## Problem Statement
`bin/agc-init.mjs`'s `runInit(cwd, argv)` scaffolds `.current/`, `tasks.md`, `qa_reports/`, and
`review_reports/` at `cwd` (wherever the operator's shell happens to be), but its `local`-mode
exclude write calls `upsertSharedExclude(repoRoot, ARTIFACT_EXCLUDE_RULES)` with the fixed,
root-anchored rule strings `/.current/`, `/tasks.md`, `/qa_reports/`, `/review_reports/` — always
anchored at the repo's top level regardless of where the scaffold actually landed. When `cwd` is a
subdirectory of the repo (e.g. `<repo>/sub`), the scaffold lands at `sub/.current/` and
`sub/tasks.md`, but the exclude rule only ever matches `<repo>/.current/` and `<repo>/tasks.md` —
so the newly created files are untracked-but-not-ignored, the exact accidental-commit path E106's
flag exists to close. `agc check`'s `checkArtifactsDrift(cwd)` and its `trackedArtifactPaths`
helper key on the same root-anchored strings/pathspecs, so the drift advisory is equally blind to
a subdirectory workspace: it can neither detect the missing-rule case nor the already-tracked case
correctly from `sub/`. This spec fixes both call sites together, since E106's own design already
established them as one mechanism (`checkArtifactsDrift`'s file comment: the check "keys on
`ARTIFACT_EXCLUDE_RULES` string entries", so any change to what gets written must be mirrored in
what gets checked).

**Key decision (anchor-follows-scaffold, not refuse-by-default)**: when `cwd` is a subdirectory,
the exclude rules and tracked-path pathspecs are prefixed with the repo-root-relative path to
`cwd` (e.g. `/sub/.current/` instead of `/.current/`) rather than refusing to run `local` mode
from a subdirectory outright. Rationale:
- E106 already established default-to-`local` as the safe-by-default behavior; refusing local
  mode from every subdirectory would make the *default*, flag-omitted invocation fail in a
  legitimate, common case (a monorepo package running `agc init` in its own package directory)
  that today at least partially works (config key + scaffold land correctly; only the exclude
  anchor is wrong) — a bigger regression than the bug being fixed.
- E108 (`agc eject`, the next ticket in this lane) needs to know *exactly* which rules a given
  workspace's `agc init` wrote, so it can reverse them. A prefix mechanically derived from
  `path.relative(repoRoot, cwd)` is a small, pure, idempotent function E108 can call again to
  reconstruct the exact rule set for any workspace — a blanket refusal would leave no
  subdirectory-workspace case for E108 to eject at all, silently narrowing its scope too.
- The one place refusal *is* the right call: a workspace path segment containing a gitignore
  wildcard metacharacter (`*`, `?`, `[`, `]`). Escaping these robustly inside a `.gitignore`-style
  pattern is disproportionate scope for this ticket (E106's own exclude-file writer never needed
  escaping, since none of its four fixed strings contain any). Refusing local mode in that one
  narrow case — with a clear message naming the offending segment and a `--artifacts=repo`
  escape hatch — is honest and small. `repo` mode never writes to the exclude file at all, so this
  refusal never applies to it; the subdirectory-anchor question simply does not arise for `repo`.

## User Stories
- As an adopter running `agc init` (default or `--artifacts=local`) from a package subdirectory of
  a larger repo, I want the exclude rule agc writes to actually cover the files agc just created,
  so `git status` shows a clean tree instead of untracked-but-not-ignored governance files.
- As an adopter running `agc check` from that same subdirectory, I want the drift advisory to
  compare my subdirectory's declared mode against my subdirectory's actual exclude/tracked state —
  not the repo root's — so I get a correct signal instead of a false negative or false positive.
- As an adopter whose workspace directory name happens to contain a gitignore wildcard character,
  I want `agc init --artifacts=local` to refuse clearly rather than silently write a pattern that
  matches more or fewer files than I created, so I'm never surprised by a wildcard I didn't intend.

## Acceptance Criteria

- **AC1** — Given a fresh git repo with a subdirectory `sub/` and cwd = `<repo>/sub` (nothing
  tracked, nothing declared), when `agc init` runs with no `--artifacts` flag, then it defaults to
  `local` exactly as the root-cwd case does, AND the shared `.git/info/exclude` gains exactly
  `/sub/.current/`, `/sub/tasks.md`, `/sub/qa_reports/`, `/sub/review_reports/` — the repo-root
  relative, subdir-prefixed strings — never the un-prefixed root-anchored strings.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC1: subdir default-local writes subdir-prefixed exclude rules"

- **AC2** — Given the AC1 setup after `agc init --artifacts=local` has run from `<repo>/sub`, when
  `git check-ignore -v sub/.current/anything` and `git check-ignore -v sub/tasks.md` are run from
  the repo root, then both succeed (report as ignored) — proving the written rule actually covers
  the scaffold `agc init` just created, not merely that some string was appended.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC2: scaffold created under subdir is actually ignored by the written rules"

- **AC3** — Given cwd = the repo root (the unchanged case), when `agc init` or `agc check` runs in
  any mode, then every exclude rule written, every tracked-path pathspec used, and every printed
  message is byte-identical to pre-E239 behavior (`/.current/`, `/tasks.md`, `/qa_reports/`,
  `/review_reports/`, no prefix, no repo-root qualifier line) — a regression guard proving the
  subdirectory fix is additive, not a rewrite of the root-cwd path.
  proof: `test/e106-init-artifacts-flag.test.mjs`'s existing suite passes unmodified

- **AC4** — Given cwd = `<repo>/sub` and `sub/.current/` is already tracked (committed) before
  `agc init --artifacts=local` runs explicitly, when it runs, then the already-tracked warning
  lists the subdir-prefixed path (`sub/.current`), the suggested untrack command's targets are
  also subdir-prefixed (`git rm -r --cached sub/.current ...`), AND the message is qualified with
  "(run from the repository root)" — so the command is correct to paste regardless of whether the
  operator's shell is still sitting in `sub/` or has moved elsewhere.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC4: subdir already-tracked warning is subdir-prefixed and repo-root-qualified"

- **AC5** — Given cwd = `<repo>/sub`, nothing declared, and `sub/tasks.md` already tracked, when
  `agc init` runs with `--artifacts` OMITTED, then it leaves the `artifacts` key undeclared (same
  policy as e106 AC8) and its printed already-tracked list uses the subdir-prefixed path
  (`sub/tasks.md`) — never the root-anchored one, which would silently miss it.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC5: subdir omitted-flag tracked detection uses subdir-prefixed paths"

- **AC6** — Given cwd = `<repo>/sub`, when `agc init --artifacts=local` runs twice in a row, then
  the second run adds zero new lines to `.git/info/exclude` (idempotent), matching the existing
  root-cwd idempotency guarantee.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC6: subdir re-run is idempotent, no duplicate exclude lines"

- **AC7** — Given cwd = `<repo>/sub`, when `agc init --artifacts=repo` runs, then `.git/info/exclude`
  is neither created nor modified — identical to the root-cwd case, since `repo` mode never writes
  the exclude file and the subdirectory anchor question does not arise for it.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC7: subdir repo mode still writes no exclude rules"

- **AC8** — Given cwd = `<repo>/weird[dir]` (a subdirectory whose name contains a gitignore
  wildcard metacharacter — one of `* ? [ ]`) where the effective mode (flag omitted and nothing
  tracked, OR `--artifacts=local` explicit) would resolve to `local`, when `agc init` runs, then it
  refuses BEFORE writing anything: exits 2, prints a usage-shaped error to stderr naming the
  offending path segment and instructing the user to rename the directory or pass
  `--artifacts=repo`, and leaves no `.current/`, `tasks.md`, or other scaffold file behind (same
  no-partial-write guarantee as AC2 of e106).
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC8: gitignore-metacharacter subdir name refuses local mode cleanly"

- **AC9** — Given the same `<repo>/weird[dir]` cwd as AC8, when `agc init --artifacts=repo` runs
  explicitly, then it proceeds normally (creates the scaffold, stamps `"artifacts": "repo"`,
  writes no exclude file) — the AC8 refusal is scoped to `local` mode only.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC9: gitignore-metacharacter subdir name is fine under explicit repo mode"

- **AC10** — Given cwd = `<repo>/sub`, `sub/.current/.config.json` declares `"artifacts": "local"`,
  the subdir-prefixed exclude rules ARE present, and no subdir artifact path is tracked, when
  `agc check` runs from `<repo>/sub`, then it prints no artifacts-drift line — the subdirectory
  analogue of e106 AC13's declared-and-matching silence.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC10: agc check subdir declared-and-matching is silent"

- **AC11** — Given the AC10 setup but the subdir-prefixed exclude rules are missing (e.g.
  hand-edited away), OR a subdir artifact path is tracked despite local mode, when `agc check`
  runs from `<repo>/sub`, then it prints the same `agc check — artifacts drift: ...` advisory shape
  as the root case, naming the subdir-prefixed path/fact, and exits 0.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC11: agc check subdir drift detection mirrors the root case"

- **AC12** — Given cwd = `<repo>/sub` where `sub/.current/.config.json` declares `"artifacts": "repo"`,
  and the repo's shared `.git/info/exclude` carries the root-anchored artifact rules from a separate,
  earlier `agc init --artifacts=local` run at the repo root, when `agc check` runs from `<repo>/sub`,
  then it prints no artifacts-drift line — the root workspace's rules never count as the
  subdirectory workspace's rules; only the subdirectory's own prefixed strings are tested.
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC12: agc check does not cross-contaminate root and subdir artifact rule sets"

- **AC13** — Given cwd = `<repo>/weird[dir]` (the AC8 unsafe-name case) where
  `weird[dir]/.current/.config.json` already declares `"artifacts": "local"` (e.g. hand-authored,
  since `agc init` itself would have refused per AC8), when `agc check` runs, then it prints one
  advisory line stating the workspace path cannot be safely checked for artifact drift (naming the
  offending segment) instead of silently testing against a wrong or ambiguous exclude pattern, and
  still exits 0 (advisory only, consistent with every other `agc check` sub-check in this family).
  proof: `test/e239-init-subdir-exclude.test.mjs` case "AC13: agc check advises rather than mis-tests on a gitignore-unsafe subdir path"

- **AC14** — Given `docs/install.md`, when a reader looks up the `--artifacts` flag, then the
  same passage states in one sentence that local mode refuses to run (exit 2, nothing written) when
  the workspace path contains a gitignore wildcard character (`*`, `?`, `[`, `]`), and that
  `--artifacts=repo` works there — written without a ticket id as the explanation.
  proof: `grep -n 'wildcard' docs/install.md` shows the sentence within the `--artifacts` passage

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| init.local.already-tracked-warning.subdir-qualifier | `Untrack them with (run from the repository root):\n  git rm -r --cached <targets>\nNote: history still contains these files after that command.` | authored-here — extends `init.local.already-tracked-warning` (e106 spec) for `cwd != repo root` only; the targets are now repo-root-relative (subdir-prefixed) so the location qualifier is load-bearing, not decorative — pasting the un-qualified command from within the subdirectory would resolve to the wrong path |
| init.subdir.unsafe-refusal | `agc init: refusing --artifacts=local — workspace path segment "<segment>" contains a gitignore-wildcard character (one of * ? [ ]), so the exclude rule agc would write could match unintended files. Rename the directory, or re-run with --artifacts=repo.` | authored-here — mirrors the existing usage-error voice (`agc init: --artifacts must be "local" or "repo" (got ...)`, e106); exits 2 like that sibling usage error |
| check.subdir.unsafe-advisory | `agc check — cannot verify artifacts drift: workspace path segment "<segment>" contains a gitignore-wildcard character (one of * ? [ ]) — rename the directory, or declare artifacts explicitly via agc init --artifacts=repo` | authored-here — mirrors the existing `agc check — artifacts drift: ...` / `agc check — artifacts undeclared — ...` advisory voice (e106); advisory only, never affects exit code |

## Cut amendments (integrator pre-review, 2026-09-28)
- Chain runs in feature mode, not bugfix mode; the red-against-base run of AC1/AC2 moves into
  T-E239-02 (qa). The "repro-first" clause in the T-E239-01 task row is superseded by this section.
- AC3's proof no longer allows any edit to the E106 suite.
- AC12 reworded (no behaviour change).
- AC14 added: one sentence in `docs/install.md`; folded into T-E239-01.

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI-only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any config schema change (per integrator scope for this ticket) — no new `.current/.config.json`
  key, no change to `schema_version`.
- Any SOP/`content/**` prose change.
- Documenting subdirectory usage in `docs/config.md` / `README.md`, or anything in
  `docs/install.md` beyond AC14's single sentence.
- Retroactively cleaning up already-tracked artifacts — unchanged E106 policy: agc detects and
  prints, never runs `git rm --cached` itself.
- **`agc feature start`'s `LANE_EXCLUDE_RULES`** (`.env`, `/node_modules`,
  `/.current/**/base-sha`, written by `bootstrapLaneEnv`): checked and found NOT the same bug by
  construction — every lane worktree `agc feature start` creates is itself a fresh working-tree
  root (`git worktree add <path>`), so `LANE_EXCLUDE_RULES`'s root-anchored strings are always
  anchored at that worktree's own top level, which is exactly where `node_modules`/`.env` land.
  There is no cwd-vs-scaffold-location mismatch analogous to `agc init`'s, because `feature start`
  does not scaffold into an arbitrary `cwd` the way `init` does — it always creates a brand-new
  worktree root. Not trivially the same helper (no `path.relative(repoRoot, cwd)` prefix concept
  applies), so left untouched here. Filed as a lane-local finding (see
  `.current/e108/pending-tickets.md`) for a narrower, separate question this ticket did not need
  to answer: whether `agc feature start` itself can be *invoked* with cwd inside a subdirectory of
  the primary checkout (as opposed to the worktree it creates having a subdirectory problem) —
  out of this ticket's scope either way.

## Dependencies / Prerequisites
- Builds on `specs/e106-init-artifacts-flag.md` (shipped) — reuses, generalizes, does not
  re-litigate any of its four settled decisions (flag not prompt; default `local`; `local` writes
  `.git/info/exclude` never `.gitignore`; already-tracked paths are detected/printed, never
  auto-untracked).
- Reuses existing mechanisms in `bin/agc-init.mjs`, generalized rather than duplicated (exact
  naming at sr-engineer's discretion, behavior below is load-bearing):
  - A new pure helper — e.g. `repoRelativeWorkspacePrefix(repoRoot, cwd)` — computing
    `path.relative(repoRoot, cwd)`, normalized to `/`-separated form (the same normalization
    style already used for repo-relative posix strings elsewhere in this file, e.g.
    `path.posix.relative(laneRel, p)` in `planLaneClose`), returning `""` when `cwd === repoRoot`
    and flagging when any path segment contains a gitignore wildcard metacharacter (`* ? [ ]`).
  - `ARTIFACT_EXCLUDE_RULES` (today a fixed 4-string array) and `ARTIFACT_PATHS` (its
    display/target pairs) both become prefix-parameterized — e.g.
    `artifactExcludeRulesForPrefix(prefix)` / `artifactPathsForPrefix(prefix)` — such that
    `prefix === ""` reproduces today's exact four strings and display/target pairs byte-for-byte
    (AC3's regression guard depends on this).
  - `trackedArtifactPaths(repoRoot, artifactPaths)` generalizes to accept the paths array as a
    parameter (currently hardcoded to the module-level `ARTIFACT_PATHS`) so both call sites
    (`runInit`'s already-tracked detection, `checkArtifactsDrift`'s local-mode drift check) can
    pass the prefix-appropriate set.
  - `upsertSharedExclude(repoRoot, rules)` is unchanged — it already takes an arbitrary `rules`
    array (that is how `LANE_EXCLUDE_RULES` and `ARTIFACT_EXCLUDE_RULES` already share it); only
    the `rules` argument `agc init` passes it changes, from the bare constant to
    `artifactExcludeRulesForPrefix(prefix)`.
  - `checkArtifactsDrift(cwd)` gains the same `repoRelativeWorkspacePrefix` call (using its own
    `cwd`, not the config file's location, since the config is already read `cwd`-relative) and
    uses the prefixed rule/path sets in place of the module-level constants; the unsafe-segment
    case takes the new advisory branch (AC13) instead of running the existing missing/present
    tests against a pattern that may not mean what it looks like it means.
- **For E108's benefit** (next ticket, same lane): `artifactExcludeRulesForPrefix` /
  `artifactPathsForPrefix` are the exact-rule-reconstruction functions `agc eject` needs to call
  (with the same `repoRelativeWorkspacePrefix` result for a given workspace) to know precisely
  which exclude lines a given workspace's `agc init` wrote, rather than assuming the fixed
  4-string root set. Note this in the implementation's comments so E108 finds it without
  re-deriving it.
- **Test-ownership note** (`docs/lane-protocol.md` §3): only qa-engineer may touch `test/`. The
  new `test/e239-init-subdir-exclude.test.mjs` is qa-engineer's file; qa-engineer may also extend
  `test/e106-init-artifacts-flag.test.mjs` with a regression case per the wave-2 manifest's
  ownership carve-out ("`test/e106-init-artifacts-flag.test.mjs` → e108: E239's regression case
  may extend it, qa-engineer only"), but must not otherwise modify its existing AC1-AC16 assertions
  (AC3 above requires they keep passing unmodified).
- **Repro (feature mode, qa-owned)**: sr-engineer writes no test and no repro file (Constitution
  §2). In T-E239-02, qa-engineer first runs the new AC1/AC2 cases against the lane base `d0c66f0`,
  records them red in its evidence, then runs them against the fix.
- No architect hop: this is a same-file, same-class generalization as E106 itself (parameterize
  two constants and two functions, no new data model, no cross-cutting API) — routed directly to
  sr-engineer, `dispatch_mode: "feature"` (chain pm → sr-engineer → code-reviewer → qa-engineer;
  architect and design-auditor skipped; the bugfix-mode expected-red step is replaced by qa's
  red-against-base run above).
- Resource Audit Gate: zero external references found load-bearing to this ticket's own
  requirements (no URLs, Figma/Sketch/mockup links, or external ticket refs beyond the in-repo
  `specs/e106-init-artifacts-flag.md` and `docs/backlog.md` E239 row already read) —
  `external_refs` omitted from the routing write.
