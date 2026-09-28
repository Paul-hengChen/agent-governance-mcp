# QA Review — T-E166-01 (batched with T-E165-01)

covers: T-E166-01, T-E165-01

Feature: `e166-e165-reltool-wave45`. Workspace: `<lanes-root>/e166-e165` (linked git worktree, branch `feat/e166-e165-reltool-wave45`), base `af0dd77`. No `specs/<active_feature>.md` and no `design/<active_feature>.md` exist — mini-chain, backlog-row-as-spec per the handoff's `scope_decision_why` (docs/backlog.md rows E166 + E165 ARE the spec; PM/architect skipped, cut approved by the human 2026-09-23). Code-reviewer verdict: APPROVED (`review_reports/review_T-E166-01.md`, covers both ids), 3 non-blocking advisories (A1-A3), no blocking findings.

## Phase 0.5 — Expected-Red Diff

`Phase 0.5: skipped (no expected-red manifest declared)` — no `qa_reports/expected-red_e166-e165-reltool-wave45.txt` exists, and `dispatch_mode` is absent from the handoff (feature mode, not bugfix).

## Phase 1 — Review

Read both diffs directly (`git diff` against base `af0dd77` inside the worktree):

- `templates/claude-code-agents/release-engineer.md:11` — the 19-path restated staging list is gone. The line now reads "stage exactly the enumerated path list in the SOP's step 8a (\"Stage explicitly\")... this file deliberately restates none of it" and separately names the "Pre-commit verify" anchor. Verified both anchors exist, in order, inside step 8a's body in `content/skill-release-engineer.md` (line 201 `8a. **Commit + push branch**` through line 228 `8b. **CI gate**`): `**Stage explicitly**` at line 202, `**Pre-commit verify (AC2)**` at line 216. No sibling template under `templates/claude-code-agents/` restates a path list (matches code-reviewer's Architecture section).
- `scripts/verify-release.mjs` `evaluateCIGroundTruth` — new `deriveCIBranch()`: tries `@{u}` (remote-prefix-stripped via `branch.<cur>.remote`, correctly handling a remote name that itself contains `/`), falls back to the current local branch, and treats a detached HEAD (`current === "" || current === "HEAD"`) as a cannot-obtain-ground-truth condition routed through the shared `warn()` closure — WARN+continue in lenient mode, FAIL in `--strict` (the same closure Check 6's other degradation paths already use, so the stdout/stderr split and exit-code contract are inherited for free, not re-implemented). `--workflow CI` is unchanged. Messages (`no completed CI runs found on ${ciBranchLabel}`, the matched-FAIL line, the poll-expiry line) all name the derived branch/label. Check 6's E147 sha resolution (tag-first, HEAD fallback) sits outside every diff hunk — confirmed byte-unchanged by reading the surrounding lines.
- Security: the derived value is defensively rejected before reaching `spawnSync`'s argv (`branch === "" || branch.startsWith("-")`), on top of git's own refname rules. `spawnSync` uses an array argv (no shell), so this is defense-in-depth, not the only guard — consistent with the code-reviewer's Security section.
- No architecture spec exists (mini-chain, matches code-reviewer). Lane boundaries hold: `git diff --stat` against base shows only `NEW-TICKETS.md`, `scripts/verify-release.mjs`, `tasks.md`, `templates/claude-code-agents/release-engineer.md`, `.current/handoff.md` plus this session's new files under `test/`, `qa_reports/`, `.current/archive/` — nothing under `content/`, `tools/`, `gates/`, `guards/`, `prompts/`, `bin/`, or `schema/`.

### Copy / Visual Audit Gates (3a/3b)

No `specs/<feature>.md` exists, so there is no *Copy / Strings* or *Visual Tokens* H2 to audit against — both gates are inapplicable by construction for this backlog-row-as-spec mini-chain (same posture the SOP's Phase 0.5/1.5/3.5 absent-branches use elsewhere). Neither diff introduces user-facing copy or visual-literal tokens (both are internal tooling: an internal SOP-authoring template and a release script's CLI plumbing) — no coverage-gap escalation applies.

## Phase 1.5 — Visual Compare

`Phase 1.5: skipped (no Visual Baselines declared)` — no `design/e166-e165-reltool-wave45.md` exists at all.

## Phase 3 — Tests

**Test File Discovery / placement (dispatch brief, Constitution §2 conditional test writing):**
- T-E165-01 → dispatch brief named `test/verify-release.test.mjs` (add a gh-shim argv-capture case). That file already exists and already covers Check 6/CI-ground-truth end to end (VR-11..VR-22, VR-33/34) — extended it in place, per the brief.
- T-E166-01 → dispatch brief said no existing file covers it, creation pre-authorized, `test/e166-template-defers-staging.test.mjs` suggested, or extend `test/release-staging.test.mjs` if it already holds the template contract. **Disclosure**: `test/release-staging.test.mjs` DOES hold *some* template-contract tests (its AC5 test asserts the shim's reinforcement-hint phrasing and sentence-count, and confirmed still green against the new wording), but none of its existing assertions check for the ABSENCE of a restated path list, or that the shim defers to a specific SOP step/anchor by name — which is the actual T-E166-01 contract. Rather than bolt an unrelated-shaped assertion onto AC5, I created the new file `test/e166-template-defers-staging.test.mjs` as pre-authorized. Verified against a scratch copy of the OLD (pre-fix) template text that the new file's key regression assertion (T-E166-01a) actually fails on the pre-fix restated list — confirms the test discriminates, not just documents.

**AC→test map** (docs/backlog.md rows + `scope_decision_why`, no `specs/` ACs to cite instead):
| AC (from scope_decision_why) | test(s) |
|---|---|
| E166: template names no staging path list | `test/e166-template-defers-staging.test.mjs` T-E166-01a |
| E166: template defers to SOP step 8a by name | T-E166-01b |
| E166: named anchors exist in step 8a of `content/skill-release-engineer.md` | T-E166-01c |
| E165: non-main branch → `gh run list` gets `--branch <branch>` AND `--workflow CI` | `test/verify-release.test.mjs` VR-35 |
| E165: detached HEAD, lenient → zero gh calls, WARN stdout, exit 0 | VR-36 |
| E165: detached HEAD, `--ci-check --strict` → zero gh calls, FAIL, exit 1 | VR-37 |
| E165: no-upstream fallback to current branch (cheap to cover) | VR-38 |
| E165: existing VR suite stays green | full `test/verify-release.test.mjs` run below |

**Coverage gate**: both new/modified surfaces are exercised at the seam that matters — `deriveCIBranch()`'s three branches (upstream-derived, current-branch fallback, detached-HEAD) are each hit by a dedicated test (VR-35/38/36-37), and the template's staging line is asserted both for what it must NOT contain and what it MUST name. Coverage tooling (istanbul/c8) isn't wired into this repo's `npm test`; noting explicitly per SOP 6c.

**Security smoke**: VR-36/37 cover the "no derivable branch" boundary condition (an empty-string-shaped input to the downstream `spawnSync` argv), and the pre-existing VR-SEC-1..4 (shell-metacharacter/oversized version args) are unmodified and still green. `deriveCIBranch`'s own `branch === "" || branch.startsWith("-")` guard is a defensive boundary the diff adds; VR-36/37 exercise the one code path (detached HEAD) that reaches it via `current === "HEAD"` before any branch value is even computed — the guard's own dead-code-if-unreachable status was flagged by code-reviewer as acceptable (advisory, not a gap) since git refname rules already forbid the shapes it defends against.

## Phase 3.5 — AC Execution

`Phase 3.5: skipped (no proof:-annotated ACs)` — no `specs/e166-e165-reltool-wave45.md` exists to carry `proof:` annotations.

## Phase 4 — Run

- Build: no compile step touches either changed file (`.md` template, `.mjs` script run directly by Node); `npm run build` not required for this diff's own correctness and was not run standalone (it runs as part of `npm test`'s pretest hook — see below).
- New/extended test files, isolated:
  - `node --test test/e166-template-defers-staging.test.mjs` → 3/3 pass.
  - `node --test test/verify-release.test.mjs` → 50/50 pass (46 pre-existing + VR-35/36/37/38 new), 0 fail. Confirms the code-reviewer's "126 pass, 0 fail" claim's `verify-release.test.mjs` half still holds after this session's additions, and that all pre-existing branch-derivation-adjacent tests (VR-11..VR-22, VR-33/34, all of which push branch `main` via `mkFixtureRepo`'s default) are unaffected — `deriveCIBranch()` resolves the identical `main`/`origin/main` those fixtures always exercised.
  - `node --test test/release-staging.test.mjs` → 80/80 pass, 0 fail — confirms the template's new staging line still satisfies AC5's shim-hint contract untouched.
- **CI runnability**: all three suites run headlessly via `node --test`, zero human interaction, deterministic (all git/gh interactions are against fully-controlled temp fixtures, not the real network).
- **Full regression run** (`npm test`, prebuild + 87 test files, 2241 subtests): **2239 pass, 2 fail**. The 2 failures are `test/check-md-tables.test.mjs` AC7 and CQ-9 ("real corpus" runs against `docs/backlog.md`), both tracing to `specs/e123a-lane-layout-migration.md:280` ("row has 3 cell(s), header declares 4") — a table malformed in `dea8544` (Wave 4/E123 cut), untouched by this lane's diff, and already logged as `L-RELTOOL-NEW-3` in `NEW-TICKETS.md`. Independently reproduced by running `node --test test/check-md-tables.test.mjs` alone, which shows the identical 2 failures at the identical location, on the identical base commit `af0dd77` — pre-existing, not a regression introduced by T-E166-01/T-E165-01. Per the dispatch brief, treated as known pre-existing red, disclosed here, not charged to this feature.
- No other suite in the 2241-subtest run regressed. `test/e35-pipeline-order.test.mjs`, `test/error-code-contract.test.mjs`, and every gate/handoff/schema-migration suite pass unchanged — expected, since this diff touches only `scripts/`, `templates/`, and (this session) `test/`/`qa_reports/`.

**PASS.**

## Verdict

PASS for T-E166-01 and T-E165-01. Both non-negotiable ACs hold (template restates no staging path list and defers to step 8a's named anchors, which exist; the CI branch query is derived — non-main branch gets `--branch <branch>` + `--workflow CI`, detached HEAD makes zero gh calls and WARN/exit-0 lenient or FAIL/exit-1 strict, no-upstream falls back to the current branch). Existing VR/AC5 suites stay green. The one red in the full run (`check-md-tables.test.mjs` AC7/CQ-9) is pre-existing, unrelated, and already ticketed (L-RELTOOL-NEW-3) — not a regression of this feature.

Release bookkeeping (version bump, CHANGELOG, `docs/backlog.md` done-marking) is out of scope here per the qa-engineer SOP's Hard Rules — release-engineer's job post-PASS.
## 2026-09-23T06:48:01.973Z — PASS — by qa-engineer

PASS T-E166-01 + T-E165-01 (batched, qa_reports/review_T-E166-01.md covers both). E166: templates/claude-code-agents/release-engineer.md restates no staging path list, defers to SOP step 8a's "Stage explicitly"/"Pre-commit verify" anchors, both confirmed present in content/skill-release-engineer.md. E165: scripts/verify-release.mjs deriveCIBranch() derives --branch from @{u} (remote-stripped) -> current branch -> detached HEAD = WARN(lenient)/FAIL(strict), zero gh calls; --workflow CI kept; messages name the derived branch. New tests: test/e166-template-defers-staging.test.mjs (3/3 pass, regression-checked against pre-fix template text) and test/verify-release.test.mjs VR-35..38 (50/50 pass incl. 46 pre-existing). release-staging.test.mjs 80/80 pass unchanged. Full npm test: 2239/2241 pass; the 2 failures (check-md-tables.test.mjs AC7/CQ-9) are pre-existing at base af0dd77 from specs/e123a-lane-layout-migration.md:280, unrelated to this feature, logged as L-RELTOOL-NEW-3 -- not charged as a regression.

