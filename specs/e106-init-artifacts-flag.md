# e106-init-artifacts-flag

## Problem Statement
`bin/agc-init.mjs`'s `init` subcommand is zero-flag and fully non-interactive: it writes no ignore rule of any kind, so `.current/`, `tasks.md`, and every other governance runtime artifact land tracked in a shared repo the moment an adopter's first `git add .` runs. This is the exact path that produced the adopter acceptance project's mid-project untracking and its ~2541 now-dangling comment citations (E104). Four decisions were taken by the human on 2026-09-14 (`docs/agc-feedback-2026-09-08.md` §H8): ship a non-interactive `--artifacts=local|repo` flag, default to `local`, write `.git/info/exclude` (never `.gitignore`) for `local`, and for already-tracked paths only detect and print the untrack command — never run it. This spec cuts that work; it does not re-open any of the four decisions.

## User Stories
- As an adopter running `agc init` in a fresh repo, I want governance artifacts kept out of git by default, so that I don't accidentally commit runtime files to a shared repo.
- As an adopter who wants the ledger to travel with the repo (e.g. this repo's own dogfood choice), I want to opt into `--artifacts=repo` explicitly, so `.current/` and `tasks.md` are tracked like any other file.
- As an adopter running `agc init --artifacts=local` on a repo where `.current/` is already tracked from an earlier run, I want to be told exactly which paths are tracked and the exact command to untrack them, so I understand the exclude rule alone does nothing for already-tracked files and I'm never surprised by agc silently running a history-rewriting command on my behalf.
- As an adopter running `agc check`, I want to be told when the declared `artifacts` choice and the repo's actual tracked/excluded state disagree, so drift is caught before it reaches a shared branch.

## Acceptance Criteria

- **AC1** — Given a fresh workspace with no artifact path already tracked (`git ls-files` shows none of the artifact paths), when `agc init` runs with no `--artifacts` flag, then it behaves exactly as `--artifacts=local` (writes the exclude rules and stamps `"artifacts": "local"` into `.current/.config.json`).
  proof: `test/e106-init-artifacts-flag.test.mjs` case "no flag defaults to local when nothing is tracked"

- **AC2** — Given `agc init --artifacts=bogus`, when it runs, then it exits 2, prints a usage error naming `local|repo` to stderr, and writes no file at all (not even a partial `.current/.config.json`).
  proof: `node bin/agc-init.mjs init --artifacts=bogus; echo "exit=$?"` run in an empty temp git repo prints a usage message to stderr, `exit=2`, and the dir has no `.current/`

- **AC3** — Given a fresh git repo, when `agc init --artifacts=local` runs, then `.git/info/exclude` gains the artifact exclude rules and `.current/.config.json` is created with `"schema_version": 2, "artifacts": "local"` (plus the existing `"host"` key, unchanged).
  proof: `test/e106-init-artifacts-flag.test.mjs` case "fresh local writes exclude rules + config key"

- **AC4** — Given a fresh git repo, when `agc init --artifacts=repo` runs, then `.git/info/exclude` is neither created nor modified by this feature, and `.current/.config.json` is created with `"artifacts": "repo"`.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "fresh repo writes config key only, no exclude write"

- **AC5** — Given an existing `.current/.config.json` with other keys (e.g. `driftBaselineIds`) and no `artifacts` key, AND no artifact path already tracked, when `agc init` runs (with or without `--artifacts`), then the file gains the `artifacts` key in place — every other key and the file's formatting are preserved byte-for-byte outside the spliced region (mirrors `upsertHostKey`) — defaulting to `"local"` when the flag is omitted.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "existing config upserts artifacts key, preserves other keys (untracked case)"

- **AC6** — Given `.current/.config.json` already declares `"artifacts": "repo"`, when `agc init` runs again with no `--artifacts` flag, then the file is left byte-identical and the run reports it under the existing skip bucket (mirrors the `host` "has-host" skip path) rather than rewriting it.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "re-run without flag is a no-op when already declared"

- **AC7** — Given a repo where `.current/handoff.md` and `tasks.md` are already committed (tracked) before `agc init --artifacts=local` runs **explicitly**, when it runs, then it still writes the exclude rules and the config key, AND prints to stderr: the list of already-tracked artifact paths, the exact `git rm -r --cached ...` command that would untrack them, and an explicit note that git history still contains the files after that command — and it never executes that command itself (the tracked files are still tracked immediately after the run). An explicit `--artifacts=local` always behaves this way on a tracked tree, regardless of AC8's omitted-flag behavior below.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "already-tracked paths are detected and printed, never executed"

- **AC8** — **(Human ruling 2026-09-28 — narrows decision 2 ["default `local`"] for the specific case of a workspace with pre-existing tracked artifacts; integrator + coordinator recommendation, approved by the human.)** Given a repo where at least one artifact path is already tracked, when `agc init` runs with the `--artifacts` flag OMITTED (and the `artifacts` key is not already declared — AC6 governs the already-declared case), then it does NOT write any exclude rules, does NOT write the `artifacts` key (leaves it absent/undeclared), and prints to stderr the list of already-tracked artifact paths plus a line instructing the user to re-run with `--artifacts=local` or `--artifacts=repo` explicitly.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "omitted flag on an already-tracked tree leaves the key undeclared and tells the user to choose"

- **AC9** — Given `.current/.config.json` declares `"artifacts": "local"` but either the exclude rules are missing from `.git/info/exclude` or an artifact path is tracked, when `agc check` runs, then it prints one advisory line per mismatch to stderr naming the fact, and exits 0 (advisory only — never affects exit code, consistent with `checkResearchBinaries` / `checkWorktreeEvidence` / `checkOrphanLanes`, NOT the stale-adapter exit(1) path).
  proof: `test/e106-init-artifacts-flag.test.mjs` case "agc check reports local-mode drift, exit 0"

- **AC10** — Given `.current/.config.json` declares `"artifacts": "repo"` but the shared `.git/info/exclude` contains at least one `ARTIFACT_EXCLUDE_RULES` entry, when `agc check` runs, then it prints one advisory line to stderr naming the mismatch, and exits 0.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "agc check reports repo-mode drift when an artifact exclude rule is present, exit 0"

- **AC11** — Given `.current/.config.json` declares `"artifacts": "repo"` and `.git/info/exclude` contains one or more `LANE_EXCLUDE_RULES` entries (`.env`, `/node_modules`, `/.current/**/base-sha`, written by `agc feature start`) but NO `ARTIFACT_EXCLUDE_RULES` entry, when `agc check` runs, then it prints NO artifacts-drift line — the check keys on `ARTIFACT_EXCLUDE_RULES` only and must never trip on lane-bootstrap exclude entries.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "agc check does not confuse LANE_EXCLUDE_RULES entries for artifact drift"

- **AC12** — Given `.current/.config.json` has no `artifacts` key (undeclared), when `agc check` runs, then it prints exactly one advisory line to stderr — `agc check — artifacts undeclared — run agc init --artifacts=local|repo` — and exits 0. (This repo's own `agc check` will print this line once this ticket ships, since this repo's `.current/.config.json` stays undeclared by design — out of scope for this ticket to change; see Out of Scope.)
  proof: `test/e106-init-artifacts-flag.test.mjs` case "agc check prints the undeclared-artifacts advisory, exit 0"

- **AC13** — Given `.current/.config.json` declares `"local"` with the exclude rules present and no artifact path tracked, OR declares `"repo"` with no `ARTIFACT_EXCLUDE_RULES` entry in `.git/info/exclude`, when `agc check` runs, then it prints no artifacts-drift line and no undeclared line — declared-and-matching is the only silent state; an undeclared key always prints per AC12.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "no drift line when declared+actual truly agree (local or repo)"

- **AC14** — Given a directory that is not inside a git repository (no `.git`), when `agc init --artifacts=local` runs (including when `local` is reached by the AC1 default), then it stamps `"artifacts": "local"` into `.current/.config.json`, skips the `.git/info/exclude` write entirely, prints one note line to stderr, and exits 0 — no error, no crash.
  proof: `test/e106-init-artifacts-flag.test.mjs` case "local outside a git repo skips the exclude write and notes it, no error"

- **AC15** — Given a `.current/.config.json` at schema v1 (no `artifacts` key), when the server's `loadConfig`/`tw_get_state` path reads it, then it lazily upgrades the file to `schema_version: 2` and does NOT seed any `artifacts` value — absence stays absence (undeclared, not `"local"`).
  proof: `test/config-versioning.test.mjs` new case "config v1→v2 is stamp-only; artifacts stays absent"

- **AC16** — Given `.current/.config.json` has `"artifacts"` set to `"local"` or `"repo"`, when `loadConfig()` runs, then `WorkspaceConfig.artifacts` equals that value; given any other value, or the key absent/malformed, then `WorkspaceConfig.artifacts` is `undefined` (never throws).
  proof: `test/config-versioning.test.mjs` case "artifacts field narrow-typed, non-fatal on garbage input"

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| init.usage.invalid-artifacts | `agc init: --artifacts must be "local" or "repo" (got "<value>")` | authored-here — mirrors the existing usage-error voice (`agc feature: missing subcommand ...`, `agc feature: unknown subcommand ...`) |
| init.local.exclude-added | `agc init — added <rules> to the shared info/exclude` | authored-here — reuses the exact wording pattern already shipped for `agc feature start — added ... to the shared info/exclude` (`bin/agc-init.mjs`), just s/feature start/init/ |
| init.local.already-tracked-warning | `agc init — warning: the following artifact path(s) are already tracked in this repo — the exclude rule just added has no effect on tracked files:\n  <path>\n  ...\nUntrack them with:\n  git rm -r --cached <targets>\nNote: history still contains these files after that command.` | authored-here — required verbatim content per backlog E106 decision 4: name the `git rm -r --cached` line AND state that history still holds the files |
| init.omitted-flag.tracked-undeclared | `agc init — the following artifact path(s) are already tracked in this repo:\n  <path>\n  ...\nNot defaulting to "local" automatically — re-run with --artifacts=local or --artifacts=repo to choose explicitly.` | authored-here — required by integrator pre-review item A1 (human ruling 2026-09-28; narrows decision 2 for a workspace with pre-existing tracked artifacts) |
| check.artifacts-drift | `agc check — artifacts drift: config declares "<declared>" but <fact>` where `<fact>` is one of `exclude rules are missing from .git/info/exclude`, `<path> is tracked despite local mode`, or `an artifact exclude rule is present in .git/info/exclude despite repo mode` | authored-here — mirrors the existing `agc check — stale adapter: ...` wording style; the third `<fact>` variant is the A2(a) repo-mode direction |
| check.artifacts-undeclared | `agc check — artifacts undeclared — run agc init --artifacts=local\|repo` | authored-here — exact wording specified by integrator pre-review item A2(b) |
| init.local.no-git-repo-note | `agc init — note: not inside a git repository — skipped .git/info/exclude; recorded "artifacts": "local" in .current/.config.json` | authored-here — required by integrator pre-review item A3 |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (CLI-only) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- `agc eject` (E108) — a separate ticket sharing `bin/agc-init.mjs` and `test/agc-adapters.test.mjs`, later wave, waits on this ticket's `artifacts` key.
- Retroactively cleaning up already-tracked artifacts in ANY repo — agc detects and prints, never runs `git rm --cached` itself (decision 4; `git rm --cached` is not on the Constitution §6 sanctioned git-operations list).
- Interactive/prompted mode — flag only (decision 1); `agc init` commonly runs inside an agent session via `npx github:...`, where a readline prompt hangs.
- Changing this repo's (`agent-governance-mcp` itself) own `.current/.config.json` content — this repo already chose `repo` mode (H8 answer to open question #2); this ticket does not touch it.
- The `LANE_EXCLUDE_RULES` set (`.env`, `/node_modules`, `/.current/**/base-sha`) written by `agc feature start` — untouched; this ticket adds a second, independent rule set for `agc init`.
- SOP/prose changes to any `content/*.md` or role skill file.
- After this ticket merges, the config v1→v2 lazy migration (AC15) will heal-write `schema_version: 2` into THIS repo's own tracked `.current/.config.json` on the first server read post-merge (this repo runs in `repo` mode, so its `.current/.config.json` is itself tracked) — that diff on `main` is authored by the migration, not by this ticket; do not revert it. Its `artifacts` key stays undeclared by this repo's own choice (AC12's note) — also out of scope to change here.

## Dependencies / Prerequisites
- The four decisions below are already taken (human, 2026-09-14, `docs/agc-feedback-2026-09-08.md` §H8) and are NOT re-opened by this spec:
  1. Flag, not an interactive prompt: `agc init --artifacts=local|repo`.
  2. Default `local` — local→repo is one `git add`; repo→local leaves the blobs in history (E104 precedent).
  3. `local` writes `.git/info/exclude`, never `.gitignore` — zero footprint for teammates who don't run agc; the cost is it doesn't travel with a clone.
  4. Already-tracked paths: detect and print the `git rm -r --cached ...` line plus a "history still holds these" note; agc never runs it.
- `docs/schema-versions.md` stamp-only precedent (handoff v4 `scope_decision`, v6 `external_refs`, v10 `dispatched_at`, v11 `dispatch_mode`, v13 `evidence_schema`, v14 `cut_approved_source`, v15 `dispatch_mechanism` — 7 handoff precedents plus config's own v0→v1 — 8 total) governs the config v1→v2 migration shape: stamp `schema_version: 2`, seed nothing, absence stays "undeclared, not local".
- Reuses two existing mechanisms in `bin/agc-init.mjs`, generalized rather than duplicated:
  - `upsertSharedExclude(repoRoot)` (currently hardcoded to `LANE_EXCLUDE_RULES`) → generalize to accept a rules array parameter; `agc init` calls it with a new, independent `ARTIFACT_EXCLUDE_RULES` set.
  - `upsertHostKey(abs)`'s byte-preserving regex-splice approach → a new `upsertArtifactsKey(abs, value)` following the identical shape (value-declared check, in-place key repair vs. insert-at-open-brace, reparse guard).
- **Cut-detail decisions made here** (implementation choices within the four settled decisions, not re-opening them):
  - **Exact exclude path set** (decision 3's "what"): `/.current/`, `/tasks.md`, `/qa_reports/`, `/review_reports/` — root-relative, directory-anchored the same way the existing `/node_modules` rule is. `specs/`, `design/`, and `research/` are deliberately excluded from this set (H9: prose artifacts are meant to stay generic and tracked; `research/assets/` already has its own E104-era gitignore convention).
  - **`agc check` drift exit-code semantics**: advisory only, never affects exit code — matches 3 of the 4 existing `agc check` sub-checks (`checkResearchBinaries`, `checkWorktreeEvidence`, `checkOrphanLanes`); the stale-adapter check is the one exception (exit 1) and this new check does not follow it, since a declared-vs-actual artifacts mismatch is a workspace-local drift signal, not a stale-install signal.
  - **`repo` mode writes nothing besides the config key** — it does not remove, or otherwise touch, any exclude entries a prior `local` run added; a stale exclude line has zero effect once the path is tracked, so there is nothing to clean up.
- **Integrator pre-review amendments** (post-cut, folded into the ACs above rather than left as separate notes):
  - **A1 (AC8, human ruling 2026-09-28)** — the omitted-flag default only resolves to `"local"` when no artifact path is already tracked; an already-tracked tree with the flag omitted leaves the key undeclared and asks the user to choose. Detecting "already tracked" for this purpose reuses the same `git ls-files` check as AC7's already-tracked-path detection — one shared helper, not two.
  - **A2 (AC9-AC13)** — the `agc check` drift predicate must literally test for `ARTIFACT_EXCLUDE_RULES` string entries in the exclude file content, never a generic "any exclude rule present" test, or AC11's negative case (lane-bootstrap rules) would false-positive. The undeclared-key advisory (AC12) is unconditional — it does not require a git repo, an exclude file, or any tracked-state check, only the absence of the `artifacts` key.
  - **A3 (AC14)** — detecting "not inside a git repository" wraps the existing `git()`/`gitTry()` helpers: a `git rev-parse --git-common-dir` (or equivalent) failure with git's own "not a git repository" signal is treated as the outside-git case, not an unexpected error to propagate. The config key write still goes through the normal `upsertArtifactsKey`/fresh-template path — only the exclude-file write and already-tracked detection are skipped.
- **Test-ownership note** (`docs/lane-protocol.md` §3 — only qa-engineer may touch `test/`, no exception): `test/agc-adapters.test.mjs` has ~15 sites asserting `schema_version: 1` verbatim on freshly-`agc init`'d config; these must be updated (to 2, or to whatever the specific fresh-init assertion needs) as part of this ticket's QA task, not left to drift into a false failure. `test/config-versioning.test.mjs`, `test/config-cache.test.mjs`, and `test/p0-onboarding-lite-default.test.mjs` need the same review pass for schema-version-literal assumptions.
- No architect hop: this is a well-precedented stamp-only schema bump (8th of its kind) plus a mechanical CLI-flag/exclude-file change with no new data model or cross-cutting API — routed directly to sr-engineer.
- Resource Audit Gate: zero external references (no URLs, Figma/Sketch/mockup links, or external ticket refs) found load-bearing to this ticket's own requirements — `external_refs` omitted from the routing write.
