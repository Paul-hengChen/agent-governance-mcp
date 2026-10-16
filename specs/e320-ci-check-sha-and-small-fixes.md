# e320-ci-check-sha-and-small-fixes

Lane `e320` of fan-out wave `specs/fanout-post-v4-w4.md` (post-v4 queue wave 4). Four small, disjoint tickets batched per the integrator manifest: **E320** (P1), **E319** (P2), **E317** (P3), **E321** (P3, qa-only). The scope cut is the manifest's e320 `範圍切線` cell (human-approved 2026-10-15); this spec writes it down, it does not re-open it.

Line references below were re-verified against the lane base (`cac3036`) at cut time.

## Problem Statement

Three independent correctness defects and one test-hygiene audit.
**E320** — `scripts/verify-release.mjs --ci-check --sha <sha>` asks for CI runs on the branch derived from the *current checkout* (`deriveCIBranch`, :384–437; query `listCompletedRuns`, :439–457, `--branch <ciBranch>`), so run from primary (`main`) against a lane-branch sha it never finds the lane's run. In lenient mode every "cannot find" path ends in `warn()` (:363–371), which prints `WARN … graceful degradation, E14` and lets the check report `CI-CHECK PASSED` — observed on lane e296 (run 38718419503 was `failure`, `--ci-check --sha d9d4036` exited 0). Integrator Stage 5a's test-claim step therefore cannot fail.
**E319** — `parseDesignMode` (`gates/visual.ts` :98–131, function body :105–131) returns the first mode in `KNOWN_MODES` *list order* that appears anywhere on the Mode line, so `image (no Figma)` parses as `figma` and `no-design (no Figma)` parses as `figma`. Both consumers read it: the visual-gate arm (`hasDesignModeRequiringVisual`, call at :88) and the source-credibility gate (`checkSourceCredibility`, call at :825).
**E317** — `emitZodGateTelemetry` (`tools/registry.ts` :84–100) emits for any absolute existing directory; with `workspace_path = <ws>/.current` plus a bad `dispatch_pins` tier (zod v4 skips the `.current`-basename refine once another issue fails), it writes `<ws>/.current/.current/<lane>/telemetry.jsonl`.
**E321** — tests that read a live `specs/fanout-*.md` and pin growable content break when an integrator appends a Decisions row (CI run 38723137283); plus the folded-in same-class hazard: tests that assert a file is unchanged by diffing it against a fixed lane base sha break at the next legitimate edit (v4.6.0 bump hit `test/e308-single-source-tier-enum.test.mjs`).

## User Stories

- As the integrator, I want `verify-release.mjs --ci-check --sha <lane sha>` run from primary to find that sha's CI run on whatever branch it ran, so that a red lane run fails Stage 5a instead of printing PASSED.
- As the integrator, I want `--ci-check --sha` to FAIL when no completed run for that sha appears within the poll budget, so that "could not verify" is never reported as "verified".
- As a design-auditor / lane author, I want a Mode line such as `image (no Figma)` or `no-design (no Figma)` to parse as the mode it declares, so that negation prose does not arm the wrong gate.
- As an operator, I want a malformed `tw_*` call with `workspace_path` pointing at `.current` itself to emit no telemetry, so that no stray `.current/.current/**` tree is created.
- As a maintainer, I want resident tests to assert only stable structure of real manifests (or use frozen in-test fixtures), so that routine bookkeeping never turns CI red.

## Acceptance Criteria

Unless stated, tests run with the existing `gh` PATH shim of `test/verify-release.test.mjs` (or an equivalent shim in a new `test/e320-*.test.mjs`) and `AGC_VERIFY_CI_WAIT_SECONDS` set small/zero.

### E320 — `--ci-check --sha` resolves by sha and never degrades to PASSED (`scripts/verify-release.mjs`)

- **AC-E320-1** (ticket (a)) — Given `--ci-check --sha <S>` and a checkout whose branch (or upstream) is `main`, when `gh` has a completed `CI` run for headSha `<S>` only on another branch, then the script queries runs by commit (`gh run list --commit <full S> --workflow CI --status completed …`, or `--branch` taken from the remote branch containing `<S>`), finds that run, and its conclusion decides the verdict. The query issued for the `--sha` path MUST NOT be scoped to the checkout-derived branch.
  proof: new test asserting the shim recorded a `gh run list` argv containing `--commit <S>` (or the lane branch, not `main`) and the exit status follows the shim's conclusion.
- **AC-E320-2** (ticket (a), red) — Given AC-E320-1's setup where the matching run concluded `failure`, when `--ci-check --sha <S>` runs (lenient, no `--strict`), then it exits non-zero and stderr carries a FAIL line naming the conclusion and `<S>` (12-char prefix); stdout never contains `CI-CHECK PASSED`.
  proof: new test `--ci-check --sha` red-on-other-branch → exit 1, stderr `/FAIL/` and `/failure/`, stdout lacks `CI-CHECK PASSED`.
- **AC-E320-3** (ticket (a), green) — Given the matching run concluded `success`, when `--ci-check --sha <S>` runs, then it exits 0 with `CI-CHECK PASSED (<S 12>)`.
  proof: new test green-on-other-branch → exit 0.
- **AC-E320-4** (ticket (b)) — Given `--ci-check --sha <S>` (lenient), when `gh` succeeds but returns no completed `CI` run for `<S>` (empty list, or only runs for other shas) until the poll budget (`AGC_VERIFY_CI_WAIT_SECONDS`, existing default 480 s / 20 s interval) is exhausted, then the script polls within that budget (an empty list is polled, not answered immediately) and then exits non-zero with a FAIL line saying no completed CI run for `<S>` was found within the budget. It MUST NOT print the `graceful degradation, E14` WARN for this case and MUST NOT print `CI-CHECK PASSED`.
  proof: new test, shim returns `[]`, budget 0 → exit 1, stderr FAIL, stdout lacks `graceful degradation` and `CI-CHECK PASSED`; second case shim returns `[]` then a success run on the 2nd call with a small budget → exit 0 (poll path exercised).
- **AC-E320-5** (abbreviated sha) — Given `--sha` is an abbreviated sha that `git rev-parse --verify <sha>^{commit}` resolves in the checkout, then the full 40-hex sha is used for the query and the headSha match; given it does not resolve, then the script FAILs loudly (exit non-zero, message names the unresolved value) — never PASSED. (PM-derived: required for (a) to work with `gh --commit` and the existing exact `headSha ===` match; the e296 incident was reported as `--sha d9d4036`.)
  proof: new test with a 7-char `--sha` of a local commit + shim keyed on the full sha → verdict follows the shim; unresolvable `--sha deadbee` → exit 1.
- **AC-E320-6** (unchanged — `gh` unavailable, E298 fallback) — Given `--ci-check --sha <S>` lenient, when `gh` cannot be spawned (ENOENT) or `gh run list` exits non-zero (unauthenticated / network / workflow not found), then behaviour is exactly as at base: lenient prints the E14 WARN and continues; `--strict` FAILs. Output parse failure is likewise unchanged.
  proof: the existing VR tests for gh-missing / gh-error stay green unmodified, plus one new `--sha` + gh-missing lenient case → exit 0 with the WARN line.
- **AC-E320-7** (unchanged — no-`--sha` paths) — Given no `--sha` (`--ci-check` alone on HEAD, or the full release run's Check 6 on the tag sha), then branch derivation, query, WARN/FAIL wording and exit codes are byte-for-byte the base behaviour; `--strict` semantics unchanged.
  proof: every pre-existing test in `test/verify-release.test.mjs` passes unmodified (`git diff cac3036 -- test/verify-release.test.mjs` shows only added tests — checked once in QA evidence, not as a resident assertion).
- **AC-E320-8** (E238 untouched) — The E238 load-sensitive timing tests in `test/verify-release.test.mjs` are not edited and pass.
  proof: QA evidence quotes the E238 test names and their pass lines from the full-suite run; the diff of that file touches none of their lines.
- **AC-E320-9** (detached HEAD with `--sha`) — Given a detached HEAD and `--ci-check --sha <S>`, then the sha path does not require a checkout branch (no "detached HEAD" WARN) and the verdict follows the run for `<S>`.
  proof: new test, detached checkout + shim success → exit 0.
- Ticket (c): no content change — `content/skill-integrator.md` 5a and the verifier brief are not edited.

### E319 — `parseDesignMode` picks the mode by position (`gates/visual.ts`)

- **AC-E319-1** — Given a design file whose Mode line is `**Mode** — image (no Figma)`, when `checkSourceCredibility` runs, then `mode === "image"` and the gate is dormant for that file (`ok: true`).
  proof: new case in `test/source-credibility-gate.test.mjs`.
- **AC-E319-2** — Given a Mode line `mode: no-design (no Figma)`, when `hasDesignModeRequiringVisual` runs, then `mode === "no-design"` and `required === false`.
  proof: new case in `test/visual-evidence-gate.test.mjs`.
- **AC-E319-3** — Both consumers get a negation case each: the visual arm with `image (no Figma)` → `mode: "image"`, `required: true`; source-credibility with `no-design (no Figma)` → `mode: "no-design"`, dormant.
  proof: one added case per consumer in the two test files above.
- **AC-E319-4** — Selection rule: among all `KNOWN_MODES` word-boundary matches on the chosen candidate line, the one with the lowest match index wins (or, equivalently, only the first token after the separator is parsed); `no-design` still wins over a bare `design` (which is not a known mode). Candidate-line order (inline form first, then H2 form) is unchanged.
  proof: covered by AC-E319-1..3 plus AC-E319-5.
- **AC-E319-5** (no regression) — The existing forms still parse: inline `mode: no-design`, bullet `- **Mode** — figma`, H2 `## Mode` with the value on the next content line, and backtick-wrapped values (`` `figma` ``, `` `penpot` ``); a line with no known mode still returns `null`.
  proof: every existing case in both test files passes unmodified; QA adds a backtick + trailing-prose case (e.g. `` `pdf` — exported from Figma `` → `pdf`).
- **AC-E319-6** — The one function fixes both call sites (:88, :825); no consumer-side change. The stale comment above `KNOWN_MODES` claiming "first-match over the enum is safe" is corrected. `dist/gates/visual.*` rebuilt and committed.
  proof: `git diff cac3036 --stat -- gates/ dist/gates/` lists only `gates/visual.ts` and `dist/gates/visual.*`.

### E317 — no telemetry emit for a `.current` workspace path (`tools/registry.ts`)

- **AC-E317-1** — Given `workspace_path = <ws>/.current` (an existing directory) and a `tw_update_state` call carrying a bad `dispatch_pins` tier, when the zod boundary rejects it, then the original validation error is returned unchanged and no file exists under `<ws>/.current/.current/**` (in particular no `telemetry.jsonl`).
  proof: new case in `test/e303-zod-boundary-telemetry.test.mjs` asserting `fs.existsSync(path.join(ws, ".current", ".current")) === false` after the rejected call.
- **AC-E317-2** — The fix is one guard in `emitZodGateTelemetry`: return early when `path.basename(workspace_path) === ".current"`. The existing absolute / isDirectory guards and the normal-workspace emit (E303-E2E1: count 1 under `fired`) are unchanged. `dist/tools/registry.*` rebuilt and committed.
  proof: existing E303-E2E1/E2E2 stay green unmodified.

### E321 — manifest-reading and fixed-base-diff test audit (qa-only)

- **AC-E321-1** — Each of `test/e177b-lane-status.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e235b-relative-worktree.test.mjs`, `test/e299-check-bookkeeping.test.mjs` is audited for assertions on growable content of a real `specs/fanout-*.md` (row counts, latest dates, line numbers/positions, whole-output hashes). Every such assertion is moved onto a fixed in-test manifest; assertions on stable structure or a validate sweep (e.g. the `e235b` sweep over all `specs/fanout-*.md`) may stay. A per-file verdict ("changed: <what>" or "no change needed: <why>, cite line(s)") is written in `qa_reports/review_T-E321-01.md`.
  proof: the evidence file has one verdict row per test file, each citing line numbers.
- **AC-E321-2** (folded-in same-class audit) — QA greps all of `test/**` for "diff against a fixed lane base sha asserting a file unchanged" (starting point: `grep -rnE '"diff"|git diff|diff --quiet|--name-only' test/*.test.mjs`, then inspecting each hit for a pinned sha vs the working tree / HEAD), lists **every** hit in the evidence with a classification (hazard: fixed base vs working tree/HEAD; or safe: a closed historical range such as two fixed shas), and fixes only hits in e320-owned files. Known non-owned hits (`test/e178a-integrator-role.test.mjs:19` / `:283`, `test/e296-manifest-tier.test.mjs:290`, and any others found) are listed only.
  proof: the evidence file's hit table; `git diff cac3036 --name-only -- test/` shows no non-owned test file.
- **AC-E321-3** — If the audit finds a second instance of the growable-manifest pattern, the "one-line convention" from the E321 ticket is NOT written in-lane (qa SOP is `content/**`, forbidden; no `test/README*` exists and none is owned) — it is filed as a `pending-ticket` block in `.current/e320/pending-tickets.md`.
  proof: evidence states the count; if ≥ 2, the pending-ticket block exists.

### Completion definition (manifest `完成定義` rows for e320, verbatim)

| 完成定義條目 | 由哪張票讓它成立 | ACs |
|---|---|---|
| `verify-release.mjs --ci-check --sha <sha>` 在 primary（`main`）上對 lane sha 能找到它的 run；紅 → FAILED；找不到已完成 run → FAILED，不再 PASSED | e320（E320） | AC-E320-1..5, 9 |
| 不給 `--sha` 的發版路徑與 `--strict` 行為不變；`test/verify-release.test.mjs` 的 E238 timing 測試未動且綠 | e320（E320 + qa） | AC-E320-6..8 |
| `parseDesignMode` 對 `image (no Figma)` 回 `image`、對 `no-design (no Figma)` 回 `no-design`；visual gate 與 source-credibility 兩個消費者都有否定句案例 | e320（E319 + qa） | AC-E319-1..6 |
| `workspace_path` 為 `<ws>/.current` 加錯誤 tier 時不再寫 `<ws>/.current/.current/…/telemetry.jsonl` | e320（E317 + qa） | AC-E317-1..2 |
| 四個讀真實清單的測試稽核完畢，可增長內容的斷言改用固定清單（或證據寫明無需改） | e320（E321） | AC-E321-1..3 |

### Lane-wide

- **AC-LANE-1** — The full suite is run once, via `node scripts/test-lock.mjs -- npm test`, after the final commit, on a clean tree (no untracked files), on the lane's final HEAD; pass/total quoted in QA evidence.
- **AC-LANE-2** — `git diff cac3036 --name-only` lists only files in the manifest e320 row's `擁有` column (which already covers `specs/e320-*`, `qa_reports/*E320*` / `*E319*` / `*E317*` / `*E321*`, `review_reports/*E320*` / `*E319*` / `*E317*`, `.current/e320/**`).
- **AC-LANE-3** — No new test asserts growable content of a real `specs/fanout-*.md`, and no new test diffs a file against a fixed lane base sha.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| verify-release.sha-not-found | FAIL line for AC-E320-4; must contain `FAIL: CI ground-truth`, the sha 12-char prefix, and the words `no completed CI run` | authored-here — operator-facing diagnostic; sr-engineer chooses the remaining wording, tests match on the quoted fragments only |
| verify-release.sha-unresolved | FAIL line for AC-E320-5; must contain `--sha` and the unresolved value | authored-here — operator-facing diagnostic; same rule |

No user-facing strings in E319 / E317 / E321.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `content/**` (incl. `content/skill-integrator.md` 5a and `content/skill-release-engineer.md`) — ticket E320 (c) settled that no wording change is needed.
- Editing the E238 load-sensitive timing tests in `test/verify-release.test.mjs`.
- E312 and every file the manifest e320 row forbids (`content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, `docs/**`, other `scripts/**`, other `tools/**`, other `gates/**`, other `test/**`, other `dist/**`, other `specs/**`, and the wave-wide common forbidden list).
- Changing the no-`--sha` release path, the `--strict` semantics, the poll budget defaults, or the E298 `gh`-unavailable fallback.
- Fixing fixed-base-diff tests in files e320 does not own (list only, AC-E321-2).
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks) — integrator / release-engineer.

## Dependencies / Prerequisites

- Lane base `cac3036` (wave manifest merged into `main` after v4.6.0). No cross-lane dependency (manifest `相依` = 無).
- `gh run list --commit <SHA>` is available in the installed `gh` (2.92.0 lists `-c, --commit SHA`).
- **PM interpretations recorded for integrator pre-review** (no option choice — each follows from the ticket text):
  1. "`gh` unavailable" (graceful degradation kept) is read as the base code's *cannot-obtain* family: spawn failure (ENOENT), non-zero `gh` exit, unparseable output. Only "gh answered, and no completed run for this sha within the budget" becomes a FAIL under `--sha` (AC-E320-4/6).
  2. Under `--sha`, an empty run list is polled within the budget (base code WARNs immediately on empty), since for a commit-scoped query empty is the normal "not finished yet" answer.
  3. When several completed runs exist for the sha (e.g. push + re-run), the most recent completed one decides (`gh`'s default order, same as base `runs.find`).
  4. Abbreviated `--sha` is resolved to the full sha via `git rev-parse` (AC-E320-5).
- Resource Audit: zero external references to fetch — the spec cites only in-repo files and CI run ids as incident history (no fetch needed).
- Routing: pm → sr-engineer (T-E320-01, T-E319-01, T-E317-01) → code-reviewer → qa-engineer (T-E320-02, T-E321-01). No architect: three single-file fixes, no new data model or cross-cutting API. `dispatch_pins`: `sr-engineer=opus`.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E320-01 | sr: `--ci-check --sha` queries runs by commit (not checkout branch), resolves abbreviated sha, polls then FAILs when no completed run for the sha; no-`--sha` and gh-unavailable paths unchanged (AC-E320-1..9) | none | 1 | `scripts/verify-release.mjs` | — |
| T-E319-01 | sr: `parseDesignMode` picks the lowest-index known mode on the line; fix stale comment; rebuild dist (AC-E319-4..6) | none | 3 | `gates/visual.ts`, `dist/gates/visual.*` | — |
| T-E317-01 | sr: one basename-`.current` guard in `emitZodGateTelemetry`; rebuild dist (AC-E317-2) | none | 3 | `tools/registry.ts`, `dist/tools/registry.*` | — |
| T-E320-02 | qa: tests for E320 / E319 / E317 (AC-E320-1..9, AC-E319-1..5, AC-E317-1..2), full suite after commit on clean tree, verdict | T-E320-01, T-E319-01, T-E317-01 | 4–5 | `test/verify-release.test.mjs`, `test/e320-*.test.mjs`, `test/source-credibility-gate.test.mjs`, `test/visual-evidence-gate.test.mjs`, `test/e303-zod-boundary-telemetry.test.mjs` | — |
| T-E321-01 | qa-only: audit the four manifest-reading tests + repo-wide fixed-base-diff grep; fix only owned files; evidence (AC-E321-1..3) | none | 0–4 | `test/e177b-lane-status.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e235b-relative-worktree.test.mjs`, `test/e299-check-bookkeeping.test.mjs` | — |
