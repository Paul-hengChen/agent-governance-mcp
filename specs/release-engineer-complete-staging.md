# Release-Engineer Complete Staging (v3.22.1)

## Problem Statement

Two consecutive release-engineer subagent invocations (v3.21.2 commit `a14b15f` and v3.22.0 commit `f5a0b4d`) produced incomplete release commits: both staged only the version-bump metadata files (`package.json`, `index.ts`, `CHANGELOG.md`, `README.md`, `dist/**`) and silently omitted the feature source files that ARE the release — templates, lib sources, content skills, specs, tests, and QA/review evidence. A backfill commit (`6aaa042`) was required to repair v3.22.0. The root cause is `content/skill-release-engineer.md` SOP step 7 (`git add <touched files including dist/>`), which is ambiguous for a haiku-tier model: it interprets "touched files" as files the current agent edited in this turn (i.e., the version-bump files), not the full set of uncommitted upstream work the coordinator accumulated across multiple role sessions. Additionally, the "release-artifact whitelist" failure-mode wording in step 8 of the same file implicitly teaches that staging source files is abnormal — the exact opposite of the correct behavior.

## User Stories

- As an agc operator, I want every release commit to include all feature source files (lib sources, content skills, templates, specs, tests, qa_reports, review_reports), so that `git log --stat` on any release tag shows a complete, self-contained diff with no backfill commits needed.
- As a haiku-tier release-engineer subagent, I want a concrete, enumerated list of directories and file patterns to stage, so I do not have to infer "all upstream work" from vague prose.
- As a release post-mortem reader, I want the release-engineer SOP to include a post-staging sanity check that fails loud if the commit is missing source files linked to the active feature, so incomplete releases are caught before `git push`.

## Acceptance Criteria

- **AC1** — Given `content/skill-release-engineer.md` SOP step 7, when the file is read, then the `git add` instruction MUST enumerate the following directories and file patterns explicitly (in order): `lib/` (if it exists), `content/` (if changed), `templates/` (if changed), `specs/` (if changed), `test/` (if changed), `qa_reports/` (if changed), `review_reports/` (if changed), `tsconfig.json` (if changed), plus the metadata files `package.json index.ts CHANGELOG.md README.md dist/`. The instruction MUST use concrete paths, not abstract language like "touched files" or "all relevant files".
- **AC2** — Given `content/skill-release-engineer.md` SOP step 7, when the file is read, then it MUST include an explicit post-staging verification step: run `git diff --cached --stat` and inspect the output. If the cached diff is missing any directory that contains uncommitted changes relevant to the active feature (determined by cross-referencing `git status --short`), the release-engineer MUST STOP, surface the missing paths, and refuse to commit until they are staged.
- **AC3** — Given `content/skill-release-engineer.md` Failure modes section, when the file is read, then the "release-artifact whitelist" framing MUST be replaced. The new wording MUST: (a) describe pre-existing uncommitted changes as a staged-but-not-yet-committed warning only for files that are UNRELATED to the active feature (e.g. stray editor swap files, `.DS_Store`, unrelated source edits), and (b) make explicit that feature source files (`lib/`, `content/`, `templates/`, `specs/`, `test/`, `qa_reports/`, `review_reports/`) are EXPECTED in a release commit and MUST NOT trigger the stop condition.
- **AC4** — Given `content/skill-release-engineer.md` SOP step 7, when the file is read, then it MUST include a commit-completeness sanity check: after `git commit`, run `git diff HEAD~1 --name-only` and verify that at minimum the spec file `specs/<active_feature>.md` (where `active_feature` is read from `tw_get_state`) appears in the diff. If it does not, STOP with: `"Release commit incomplete: specs/<active_feature>.md is absent from the commit. Stage missing files and amend or create a fix commit."` Rationale: every release that ships a feature must contain the spec that documents its ACs; if the spec is missing the commit is certainly incomplete.
- **AC5** — Given `templates/claude-code-agents/release-engineer.md` (the subagent shim), when the file is read, then it MUST include a reinforcement hint reminding the haiku-tier model that its staging scope includes all upstream feature work, not just the files it edited in the current turn. The hint MUST be ≤ 2 sentences and MUST NOT alter the watermark line or the `tw_get_state` / `tw_switch_role` instruction.
- **AC6** — Given a test file `test/release-staging.test.mjs` (new file, authored by qa-engineer), when `npm test` runs, then it MUST exercise at minimum:
  - Fixture: mock `git status --short` returns staged metadata files only (no `lib/`, `content/`, `specs/`, `test/`) → sanity check detects incomplete staging and produces a FAIL signal with a list of missing directories.
  - Fixture: mock `git diff --cached --stat` output includes all required directories → sanity check passes.
  - Fixture: mock `git diff HEAD~1 --name-only` missing `specs/<feature>.md` → post-commit check fires with the AC4 verbatim error string.
  - Fixture: mock `git diff HEAD~1 --name-only` includes `specs/<feature>.md` → post-commit check passes silently.
- **AC7** — Given the existing `npm test` suite, when run after the SOP edits (which are prompt-only, not code), then all tests pass with zero regressions. `npm run build` MUST be clean (no compile errors) — required because `templates/release-engineer.md` changes trigger `test/subagent-templates.test.mjs` assertions.
- **AC8** — Given `package.json` and `index.ts`, when this feature ships, then both versions read `3.22.1` (PATCH bump — prompt-only SOP fix, no API surface changes).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| staging.directories | `lib/ (if exists) content/ (if changed) templates/ (if changed) specs/ (if changed) test/ (if changed) qa_reports/ (if changed) review_reports/ (if changed) tsconfig.json (if changed) package.json index.ts CHANGELOG.md README.md dist/` | authored-here — enumerated from analysis of v3.21.2 and v3.22.0 backfill commit `6aaa042` which added 38 missing files across these paths |
| staging.verify.cmd | `git diff --cached --stat` | authored-here — standard git command to inspect what is staged before commit |
| staging.missing.stop | `"Release commit incomplete: specs/<active_feature>.md is absent from the commit. Stage missing files and amend or create a fix commit."` | authored-here — AC4 verbatim error string |
| staging.unrelated.stop | `"Pre-existing uncommitted changes found in <path> — this path is unrelated to the active feature. Commit or stash it first."` | authored-here — replaces v3.22.0 "release-artifact whitelist" stop condition; fires only on UNRELATED paths |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Design Decisions (PM-authored)

### Decision 1: Where to fix

**Mandatory edit:** `content/skill-release-engineer.md` — this is the SOP file that haiku-tier reads at invocation via `tw_switch_role("release-engineer")`. It is the authoritative behavioral specification.

**Optional reinforcement:** `templates/claude-code-agents/release-engineer.md` — the subagent shim body. Adding a short hint here provides a second, earlier injection point before `tw_switch_role` loads the full SOP. Justified because: (a) haiku-tier is the most context-budget-constrained model and benefits from dual anchoring; (b) the shim is already the first text the subagent sees; (c) the shim's body is currently only 3 lines — a 2-sentence hint is a trivial footprint increase. **Included as AC5.**

### Decision 2: Staging strategy

**Selected: (a) Explicit directory enumeration with post-staging verify.**

Rejected (b) stage-all-then-exclude-blocklist: risks staging stray editor files (`.DS_Store`, `*.swp`, IDE caches) and would require an exclusion list that is harder to reason about at haiku-tier than an inclusion list.

Rejected (c) verification-only (keep `git add` vague, add post-commit check): the post-commit check is too late — by then the tag is about to be pushed. The sanity check is a complementary safety net (AC4), not a substitute for the correct `git add` step.

The explicit directory list (AC1) is the primary fix. The pre-commit `git diff --cached --stat` inspection (AC2) is the first safety net. The post-commit `git diff HEAD~1 --name-only` spec-file check (AC4) is the second safety net.

### Decision 3: Commit-completeness sanity check scope

The post-commit check (AC4) uses `specs/<active_feature>.md` as the minimum required file. Rationale:

- Every feature that ships a spec must include that spec in its release commit. The spec enumerates which files implement which ACs; if the spec is missing, the commit is certainly incomplete by construction.
- `active_feature` is always available from `tw_get_state` (step 1 of the SOP), so haiku-tier already has it in context.
- Checking against all files referenced in the spec would require the release-engineer to parse the spec and resolve paths — too complex for a reliable haiku-tier check. The spec-file presence is a simple, reliable proxy.
- The full directory staging (AC1) + pre-commit verify (AC2) together prevent the incomplete-staging bug. The post-commit check (AC4) is defense-in-depth for edge cases.

### Decision 4: "Release-artifact whitelist" wording fix

The current `content/skill-release-engineer.md` Failure modes bullet reads:

> Pre-existing uncommitted changes in `git status` outside the release-artifact whitelist → STOP, ask user to commit/stash first.

This wording is backwards: it implies that feature source files (`lib/`, `content/`, etc.) are OUTSIDE the acceptable staging set (the "whitelist"), teaching haiku-tier to avoid staging them. The fix (AC3) inverts the framing: source files in the feature directories are EXPECTED and must be staged; only UNRELATED uncommitted changes (files outside the feature directories that have no connection to the active feature) trigger the stop condition. The replacement must name the expected directories explicitly.

### Decision 5: Test plan

`test/release-staging.test.mjs` is authored by qa-engineer. It uses mocked `git` output (strings, not real git processes) to exercise the staging-sanity and post-commit-check logic described in the SOP. This is a content-assertion/behavioral-simulation test pattern consistent with the existing `test/feature-scope-gate.test.mjs` and `test/researcher-deep-research.test.mjs` tests in this repo.

No new `tw_*` tools, no schema changes, no transitions matrix changes. The test simply validates that the SOP text contains the required verification commands and error strings (AC1–AC4), and simulates the branching logic (missing vs present staging).

### Decision 6: Backwards compatibility

- No change to `tools/transitions.ts`, `content/constitution.md`, `schema/`, `guards/`, or any existing test.
- No new MCP tool; this is a pure prompt/SOP change.
- `templates/claude-code-agents/release-engineer.md` body gains ≤ 2 sentences; the watermark line and shim invocation lines are preserved verbatim.
- ALLOWED_TRANSITIONS matrix: unchanged.
- Version bump: `3.22.0` → `3.22.1` (PATCH — prompt-only fix).

### Decision 7: Why sr-engineer (not architect) for the skill edit

The edit scope is two files: `content/skill-release-engineer.md` (primary, ≤ 20 line change) and `templates/claude-code-agents/release-engineer.md` (optional reinforcement, ≤ 2 sentences). No new module, no new data model, no cross-cutting API change. This is well within a single sr-engineer session (≤ 5 files / 300 lines). `next_role: sr-engineer`.

## Out of Scope

- Modifying `tools/transitions.ts`, `content/constitution.md`, or any other skill file.
- Adding a new `tw_*` MCP tool for release validation.
- Backfilling or amending the v3.21.2 or v3.22.0 release commits (already repaired by `6aaa042`).
- Changing the CHANGELOG or README for prior releases.
- Enforcing the staging rule via server-side tooling (e.g. a pre-commit git hook in this repo) — out of scope for a PATCH release.
- Handling non-haiku-tier release-engineers — the fix is SOP text; all tiers benefit.

## Dependencies / Prerequisites

- v3.22.0 is the released baseline (confirmed: commit `f5a0b4d`, tag `v3.22.0`, backfill `6aaa042` already applied — repo source and dist are in sync).
- No external references in requirements. Resource Audit Gate: zero `http(s)://`, `figma`, `sketch`, `mockup`, `設計圖`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, or `JIRA` references in the user brief or this spec.
- `content/skill-release-engineer.md` current line 43 (`git add <touched files including dist/>`) and line 52 (failure-mode whitelist wording) are the exact edit targets; sr-engineer must read the file before editing.
- `qa_reports/review_T430.md`, `qa_reports/review_T431.md`, `qa_reports/review_T432.md` (untracked per git status) are evidence from the prior QA cycle; they must be staged in the v3.22.1 release commit per AC1.
